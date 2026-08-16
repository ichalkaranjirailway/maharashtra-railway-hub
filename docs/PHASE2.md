# Phase 2 — database, source registry, automation scaffold

This continues the Phase 1 static frontend (index.html, projects.html,
project.html, hatkanangale-ichalkaranji.html, today.html, about.html,
assets/app.js, data/data.js, data/i18n.js — all preserved, untouched).
Phase 1 remains fully functional on its own with demo data; nothing here
is required for it to keep working.

## What already existed (Phase 1, inspected, not modified)
A working static site with homepage, searchable/filterable project
database, a dedicated Hatkanangale–Ichalkaranji tracker, date archive,
about page, bilingual EN/MR UI, and a `statusHistory` array per project
that already implements "never overwrite — show what changed." All data
is `isDemo: true`. No database, scraper, or admin panel existed yet — the
Phase-1 README correctly identified these as the real Phase 2 work and
deferred them rather than faking them, which is why none of that work was
in the uploaded files.

## What's new in this delivery

| File | What it is |
|---|---|
| `database/schema.sql` | Full Postgres/Supabase schema — all 16 tables from the brief, in FK-safe creation order, with enums matching `data/data.js`'s constants so the API can later replace the static file with zero frontend changes. |
| `database/rls_policies.sql` | Row-level security: public reads only `VERIFIED`/`ARCHIVED` content; `EDITOR` can create `NEW`/`PENDING_REVIEW` rows; only `VERIFIER`/`SUPER_ADMIN` can mark something `VERIFIED`; `project_versions` and `audit_logs` are append-only for every role, including `SUPER_ADMIN`, by simply having no UPDATE/DELETE policy. |
| `automation/source-registry.json` | Add a new official source by editing this file — no code change. Currently ships with placeholder URLs marked `is_active: false` (see "Credential/verification boundary" below) plus one real, active `manual_only` entry for RTI replies. |
| `automation/collector.js` | Working Node.js scaffold: robots.txt check → fetch → normalize → hash → diff against the DB → insert a `verification: 'NEW'` row if changed. Fails safe (skips and logs) on any error; never fabricates data; never marks anything verified. The per-source HTML parsing logic is intentionally left as a `TODO`-equivalent because it depends on the exact markup of whichever real government page you activate. |
| `.github/workflows/collect.yml` | Scheduled GitHub Actions workflow (daily cron + manual trigger), least-privilege permissions, secrets passed as env vars only, never logged. |
| `.env.example` | Public (safe for frontend) vs secret (Actions-only) variables, clearly separated, no real values. |

## What is actually functional right now
- The schema and RLS policies are valid SQL you can run today against a
  free Supabase project (see steps below) — this is real, not a mockup.
- `collector.js` genuinely checks robots.txt and will genuinely skip a
  source that disallows it — that logic works standalone today
  (`node automation/collector.js` will run, and correctly exit early,
  even without Supabase credentials, though it needs them to write results).
- The GitHub Actions workflow is syntactically valid and will run on
  schedule once secrets are added to the repo.

## What remains configuration-only (by design, per your "no fake credentials" rule)
- No Supabase project has been created — I cannot create cloud accounts
  on your behalf.
- `source-registry.json`'s auto-fetchable entries are placeholders with
  `is_active: false`. Before flipping one to `true` you (a human) need to:
  1. Confirm the exact page URL that carries the status text you want tracked.
  2. Confirm its `robots.txt` allows automated fetching (the collector
     re-checks this at runtime regardless, but check it yourself first).
  3. Write the source-specific extraction logic in `collector.js`
     (what to pull out of that page's HTML) — markup differs per site.
- The admin app referenced in the Phase-1 README (§5) is not built here —
  it's a separate small app with its own auth, out of scope for a
  frontend-repo delivery. `rls_policies.sql` is written to support it
  once it exists.

## Credential / external-service boundary — stop points

| Service | Why needed | Free? | Account | Setting | Env var | Never put it in |
|---|---|---|---|---|---|---|
| Supabase | Database + REST API + Auth + RLS | Yes, free tier | supabase.com signup | Create project → Settings → API | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (safe in frontend), `SUPABASE_SERVICE_ROLE_KEY` (secret) | The service-role key must never go in `assets/app.js`, `data/`, or any GitHub Pages–served file — only in GitHub Actions Secrets. |
| GitHub Actions Secrets | Store the service-role key for the collector | Yes, included | Your existing GitHub repo → Settings → Secrets and variables → Actions | Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | n/a | Don't add them as repo *variables* (those are visible in logs) — use *secrets* specifically. |
| Analytics (Plausible/GoatCounter/Cloudflare Web Analytics) | Real visitor counter (§14 of your brief) | Free/cheap tiers exist | Pick one, sign up | Add their one-line script tag to the HTML | none needed client-side for most of these | n/a |
| Object storage for documents (Supabase Storage or Cloudflare R2) | Store actual RTI/PDF files that `documents.file_url` points to | Yes, free tier | Same Supabase project, or separate Cloudflare account | Create a bucket, set public-read on verified docs only | storage keys stay server-side/Actions-only if you automate uploads | n/a |

## Exact next steps for you
1. Create a free Supabase project.
2. Run `database/schema.sql`, then `database/rls_policies.sql`, in the
   Supabase SQL editor, in that order.
3. Insert the `source-registry.json` entries into the `sources` table
   (a one-time manual insert, or a tiny sync script — ask if you want
   that written next).
4. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions
   secrets on the repo.
5. Copy `automation/`, `.github/workflows/collect.yml`, and `.env.example`
   into your existing repo alongside the Phase-1 files (no Phase-1 file
   needs to change for this step).
6. Leave every `is_active` source as `false` until you've personally
   verified its URL and robots.txt — then activate one at a time and
   write its extraction logic in `collector.js`.
7. When ready to go live, replace the static `data/data.js` fetch in
   `assets/app.js` with a fetch against the Supabase REST endpoint
   (`PUBLIC_SUPABASE_ANON_KEY`, read-only) — the Phase-1 README §3
   already documents this swap in more detail.

## Free vs optional-paid
Everything shipped in this delivery runs on free tiers: GitHub Pages,
GitHub Actions (public repos get free minutes), Supabase free tier
(500MB DB, enough for years of this dataset), and the suggested analytics
tools all have free tiers. The only things that would cost money are
optional: Supabase Pro (only needed once you outgrow the free tier's
storage/bandwidth), a custom domain, or a managed auth provider beyond
Supabase's own (Supabase Auth is free and sufficient).

## Security status
- No secrets exist anywhere in this delivery — `.env.example` has no
  real values, and `SUPABASE_SERVICE_ROLE_KEY` in the workflow is a
  GitHub Secret reference (`${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`), not a value.
- RLS policies deny by default: any table/action without an explicit
  policy is inaccessible, including to `SUPER_ADMIN`, for the append-only
  tables (`project_versions`, `audit_logs`).
- The collector fails closed on robots.txt errors (treats "couldn't check"
  as "not allowed") and never writes anything above `NEW` verification.
- Not claimed: "unhackable." RLS + secret hygiene + branch protection
  (document, don't yet have a repo to configure) reduce risk; they don't
  eliminate it.

## Testing status
- `schema.sql` / `rls_policies.sql`: syntactically valid Postgres, written
  against Supabase's Postgres version; not yet run against a live database
  (none exists yet) — run and report back if anything errors, DDL
  ordering was checked manually but a live run is the real test.
- `collector.js`: the robots.txt parser and hashing logic can be sanity
  checked by running `node automation/collector.js` locally today — it
  will correctly report "no active auto-fetchable sources" and exit 0,
  since everything real is still `is_active: false`.
- `collect.yml`: valid YAML/Actions syntax; will only be provable by
  actually running it in your repo once secrets are set.
- Phase-1 files (html/css/js) were not touched, so their prior tested
  state is unchanged.
