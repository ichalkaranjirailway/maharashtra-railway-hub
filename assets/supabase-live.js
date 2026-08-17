/**
 * MRIH — Supabase live-data loader (Phase 2 wiring).
 *
 * What this does:
 *   1. Reads the demo dataset from data/data.js first (already rendered
 *      synchronously by app.js — this is the "graceful fallback" state).
 *   2. In the background, fetches projects / news / RTIs / status-history
 *      from Supabase (public REST API, anon key only — RLS enforces what
 *      this key can see: VERIFIED/ARCHIVED rows, plus rows explicitly
 *      flagged is_demo=true).
 *   3. If the fetch succeeds AND returns at least one project, it replaces
 *      the contents of window.MRIH_DATA.PROJECTS / UPDATES / RTI_RECORDS
 *      in place and re-renders (reusing the existing mrih:langchange
 *      event, the same mechanism app.js already uses for language swaps).
 *   4. If anything fails (offline, RLS denies, network error, etc.), it
 *      logs a warning and leaves the demo data on screen untouched —
 *      it never crashes the page and never fabricates data.
 *
 * Only the PUBLIC anon key lives here. It cannot write, and per RLS
 * (see database/rls_policies.sql) it cannot read anything that isn't
 * VERIFIED/ARCHIVED or explicitly marked is_demo=true. Never put the
 * service_role key in this file or any file that ships to GitHub Pages.
 */
(function () {
  const SUPABASE_URL = "https://keprhzlbcrivnbcfagsk.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlcHJoemxiY3Jpdm5iY2ZhZ3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NjExNTEsImV4cCI6MjEwMjQzNzE1MX0.HZ1zexyuCELpQxBViYlvzmg_YbUrbt9XFikldgy66fg";
  const REST = SUPABASE_URL + "/rest/v1";
  const HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY };
  const TIMEOUT_MS = 8000;

  function fetchTable(table, query) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetch(REST + "/" + table + "?" + query, { headers: HEADERS, signal: controller.signal })
      .then((res) => {
        clearTimeout(timer);
        if (!res.ok) throw new Error(table + " request failed: " + res.status);
        return res.json();
      })
      .catch((err) => {
        clearTimeout(timer);
        throw err;
      });
  }

  // DB verification_status (moderation workflow) → frontend VERIFICATION
  // (evidence-confidence badge). These are two different enums that only
  // happen to share a name — see docs/PHASE2.md.
  function mapVerification(v) {
    if (v === "VERIFIED") return "VERIFIED";
    if (v === "ARCHIVED") return "HISTORICAL";
    if (v === "REJECTED") return "UNVERIFIED";
    return "UNDER_VERIFICATION"; // NEW, PENDING_REVIEW
  }

  function mapProject(row, versionsByProject) {
    const history = (versionsByProject[row.id] || []).map((v) => ({
      date: (v.changed_at || "").slice(0, 10),
      status: v.new_value,
      costCrore: null, // project_versions only tracks field-level diffs; no per-entry cost in this schema yet
      source: (v.sources && v.sources.name) || "—",
      verification: mapVerification(v.verification)
    }));
    return {
      id: row.id,
      isDemo: !!row.is_demo,
      featured: !!row.featured,
      name_en: row.name_en,
      name_mr: row.name_mr,
      district: row.district,
      zone: row.zone,
      division: row.division,
      category: row.category,
      lengthKm: row.length_km,
      status: row.status,
      costCrore: row.cost_crore,
      summary_en: row.summary_en,
      summary_mr: row.summary_mr,
      statusHistory: history,
      updatedAt: (row.updated_at || "").slice(0, 10)
    };
  }

  function mapUpdate(row, projectsById) {
    const proj = projectsById[row.project_id];
    return {
      id: row.id,
      isDemo: !!row.is_demo,
      date: row.published_at,
      time: "",
      projectId: row.project_id,
      category: proj ? proj.category : "OTHER",
      headline_en: row.headline_en,
      headline_mr: row.headline_mr || row.headline_en,
      // news_updates has no body_en/body_mr column in the current schema —
      // left blank rather than inventing summary text.
      summary_en: "",
      summary_mr: "",
      source_en: (row.sources && row.sources.name) || row.publication || "—",
      sourceDate: row.published_at,
      sourceUrl: row.article_url || (row.sources && row.sources.url) || "",
      verification: mapVerification(row.verification)
    };
  }

  function mapRti(row) {
    return {
      id: row.id,
      isDemo: !!row.is_demo,
      projectId: row.project_id,
      applicationDate: row.application_date,
      applicationNumber: row.application_number,
      authority: row.authority,
      // rtis.subject has no separate Marathi column in the current schema.
      subject_en: row.subject,
      subject_mr: row.subject,
      replyDate: row.reply_date,
      replyReference: row.reply_number,
      keyInfo_en: row.key_information_en,
      keyInfo_mr: row.key_information_mr,
      documentUrl: (row.documents && row.documents.file_url) || "",
      verification: mapVerification(row.verification)
    };
  }

  async function loadLive() {
    const [projRes, verRes, newsRes, rtiRes] = await Promise.all([
      fetchTable(
        "projects",
        "select=id,name_en,name_mr,district,zone,division,category,length_km,status,cost_crore,summary_en,summary_mr,featured,is_demo,verification,updated_at"
      ),
      fetchTable(
        "project_versions",
        "select=project_id,field_name,old_value,new_value,changed_at,verification,is_demo,sources(name,url)&field_name=eq.status&order=changed_at.asc"
      ),
      fetchTable(
        "news_updates",
        "select=id,project_id,headline_en,headline_mr,publication,article_url,published_at,verification,is_demo,sources(name,url)&order=published_at.desc"
      ),
      fetchTable(
        "rtis",
        "select=id,project_id,application_date,application_number,authority,subject,reply_date,reply_number,key_information_en,key_information_mr,verification,is_demo,documents(file_url),sources(name,url)"
      )
    ]);

    if (!Array.isArray(projRes) || !projRes.length) {
      // Nothing publicly readable yet — keep showing the demo dataset.
      return;
    }

    const versionsByProject = {};
    verRes.forEach((v) => {
      (versionsByProject[v.project_id] = versionsByProject[v.project_id] || []).push(v);
    });

    const liveProjects = projRes.map((r) => mapProject(r, versionsByProject));
    const projectsById = {};
    liveProjects.forEach((p) => (projectsById[p.id] = p));

    const liveUpdates = newsRes.map((r) => mapUpdate(r, projectsById));
    const liveRtis = rtiRes.map(mapRti);

    const D = window.MRIH_DATA;
    if (!D) return;
    D.PROJECTS.length = 0;
    D.PROJECTS.push.apply(D.PROJECTS, liveProjects);
    D.UPDATES.length = 0;
    D.UPDATES.push.apply(D.UPDATES, liveUpdates);
    D.RTI_RECORDS.length = 0;
    D.RTI_RECORDS.push.apply(D.RTI_RECORDS, liveRtis);

    // Re-run every renderer that app.js already wires up for language
    // switches — same event, so no other file needs to know this ran.
    window.dispatchEvent(new Event("mrih:langchange"));
    console.info("[MRIH] Live data loaded from Supabase (" + liveProjects.length + " projects).");
  }

  loadLive().catch((err) => {
    console.warn("[MRIH] Could not load live data from Supabase — showing demo data instead.", err);
  });
})();
