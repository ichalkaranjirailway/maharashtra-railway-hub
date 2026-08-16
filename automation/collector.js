#!/usr/bin/env node
/**
 * MAHARASHTRA RAILWAY INFORMATION HUB — SCHEDULED COLLECTOR (scaffold)
 * ---------------------------------------------------------------------------
 * What this does, honestly:
 *   1. Reads automation/source-registry.json for active sources.
 *   2. For each source with fetch_strategy "check_robots_then_html":
 *        - checks robots.txt permission before fetching anything
 *        - fetches the page, normalizes text, hashes it
 *        - compares against sources.last_hash in the database
 *        - if changed, inserts a row into project_versions / news_updates
 *          (whichever the source maps to) with verification = 'NEW',
 *          NEVER 'VERIFIED' — a human editor/verifier does that separately.
 *   3. Sources with fetch_strategy "manual_only" are skipped entirely —
 *      by design, not as a bug. Some sources (parliament search UIs, RTI
 *      replies) cannot and should not be auto-scraped.
 *
 * What this does NOT do (on purpose, per the brief):
 *   - It never marks anything VERIFIED.
 *   - It never fabricates a value when a fetch fails — it logs and skips.
 *   - It never runs against a source whose robots.txt disallows it.
 *
 * Required environment variables (set as GitHub Actions Secrets — see
 * .github/workflows/collect.yml — never commit these, never put them in
 * frontend code):
 *   SUPABASE_URL              e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY service-role key (bypasses RLS — server-side only)
 *
 * This is a scaffold: the actual per-source parsing logic (what CSS
 * selector/JSON path holds the "status" text on each specific official
 * page) has to be written once you've picked and activated real sources
 * in source-registry.json, because every government page's markup differs.
 * The plumbing below (robots check, hashing, diffing, safe DB write,
 * logging, failure handling) is complete and reusable for any of them.
 */

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "[collector] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. " +
      "Set them as GitHub Actions Secrets, not in this file. Exiting without making any request."
  );
  process.exit(1);
}

const USER_AGENT = "MaharashtraRailwayHubCollector/1.0 (+contact: set-a-real-contact-email-here)";
const MIN_DELAY_MS = 2000; // simple politeness delay between requests to the same host

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(html) {
  // Minimal, dependency-free normalization: strip tags/scripts/styles,
  // collapse whitespace. Good enough for hashing "did this page change".
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function isAllowedByRobots(pageUrl) {
  try {
    const u = new URL(pageUrl);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const res = await fetch(robotsUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      // No robots.txt or unreachable — fail closed: treat as NOT allowed
      // until a human confirms otherwise, per the brief's "respect robots.txt" rule.
      return { allowed: false, reason: `robots.txt fetch returned ${res.status}` };
    }
    const body = await res.text();
    const disallowedForAll = parseDisallowRules(body, "*");
    const path = u.pathname || "/";
    const blocked = disallowedForAll.some((rule) => rule && path.startsWith(rule));
    return { allowed: !blocked, reason: blocked ? "blocked by robots.txt Disallow rule" : "ok" };
  } catch (err) {
    return { allowed: false, reason: `robots.txt check failed: ${err.message}` };
  }
}

function parseDisallowRules(robotsTxt, targetAgent) {
  const lines = robotsTxt.split("\n").map((l) => l.trim());
  const rules = [];
  let inTargetBlock = false;
  let inWildcardBlock = false;
  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      const agent = line.split(":")[1].trim();
      inTargetBlock = agent === targetAgent;
      inWildcardBlock = agent === "*";
      continue;
    }
    if (/^disallow:/i.test(line) && (inTargetBlock || inWildcardBlock)) {
      const value = line.split(":").slice(1).join(":").trim();
      if (value) rules.push(value);
    }
  }
  return rules;
}

async function supabaseRequest(pathname, { method = "GET", body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${method} ${pathname} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function getSourceRow(sourceKey) {
  const rows = await supabaseRequest(`sources?name=eq.${encodeURIComponent(sourceKey)}&select=*`);
  return rows[0] || null;
}

async function updateSourceHash(sourceId, hash) {
  await supabaseRequest(`sources?id=eq.${sourceId}`, {
    method: "PATCH",
    body: { last_hash: hash, last_checked_at: new Date().toISOString() },
  });
}

async function insertPendingNewsUpdate(sourceId, headline) {
  // Minimal example insert — real per-source logic should extract a real
  // headline/date/summary rather than this placeholder string.
  await supabaseRequest("news_updates", {
    method: "POST",
    body: [
      {
        headline_en: headline,
        source_id: sourceId,
        verification: "NEW",
        published_at: new Date().toISOString().slice(0, 10),
      },
    ],
  });
}

async function processSource(source) {
  console.log(`[collector] Checking source: ${source.key} (${source.url})`);

  const robots = await isAllowedByRobots(source.url);
  if (!robots.allowed) {
    console.warn(`[collector] SKIP ${source.key}: ${robots.reason}`);
    return;
  }

  let html;
  try {
    const res = await fetch(source.url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.error(`[collector] FETCH FAILED ${source.key}: ${err.message}`);
    return; // fail safe — never fabricate a result
  }

  const normalized = normalizeText(html);
  const hash = hashText(normalized);

  const dbRow = await getSourceRow(source.name).catch((err) => {
    console.error(`[collector] Could not read sources row for ${source.key}: ${err.message}`);
    return null;
  });

  if (!dbRow) {
    console.warn(
      `[collector] No matching row in the sources table for "${source.name}". ` +
        `Run the registry sync step first (see docs/PHASE2.md) so this source has a DB id.`
    );
    return;
  }

  if (dbRow.last_hash === hash) {
    console.log(`[collector] No change: ${source.key}`);
    return;
  }

  console.log(`[collector] CHANGE DETECTED: ${source.key} — creating pending_review item`);
  await insertPendingNewsUpdate(
    dbRow.id,
    `Content change detected on ${source.name} — needs editor review`
  );
  await updateSourceHash(dbRow.id, hash);
}

async function main() {
  const registryPath = path.join(__dirname, "source-registry.json");
  const registry = JSON.parse(await readFile(registryPath, "utf8"));

  const active = registry.sources.filter(
    (s) => s.is_active && s.fetch_strategy === "check_robots_then_html"
  );

  if (active.length === 0) {
    console.log(
      "[collector] No active auto-fetchable sources in source-registry.json yet. " +
        "This is expected until you activate real, verified source URLs — see docs/PHASE2.md."
    );
    return;
  }

  for (const source of active) {
    await processSource(source);
    await sleep(MIN_DELAY_MS);
  }
}

main().catch((err) => {
  console.error("[collector] Fatal error:", err.message);
  process.exit(1);
});
