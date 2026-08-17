/**
 * MRIH — application shell + page renderers.
 * All numbers/lists are computed from window.MRIH_DATA (data/data.js).
 * Nothing here hard-codes a statistic — see README "No fake data".
 */
(function () {
  const D = window.MRIH_DATA;
  const { t, getLang, setLang, renderI18n } = window.MRIH_I18N;

  // ---------------- Shared header / footer -----------------------------
  function renderHeader(activePage) {
    const el = document.getElementById("site-header");
    if (!el) return;
    el.innerHTML = `
      <div class="demo-banner"><strong data-i18n="demoLabel">Demo data</strong> — <span data-i18n="demoBanner"></span></div>
      <div class="topbar">
        <div class="topbar-inner">
          <a class="brand" href="index.html">
            <span class="brand-mark">रे</span>
            <span data-i18n="siteName">Maharashtra Railway Information Hub</span>
          </a>
          <button class="navtoggle" id="navToggle" aria-label="Menu" aria-expanded="false">☰</button>
          <nav class="nav" id="mainNav">
            <a href="index.html" data-i18n="navHome" data-nav="home">Home</a>
            <a href="projects.html" data-i18n="navProjects" data-nav="projects">Projects</a>
            <a href="hatkanangale-ichalkaranji.html" data-i18n="navTracker" data-nav="tracker">Tracker</a>
            <a href="today.html" data-i18n="navToday" data-nav="today">Today</a>
          </nav>
          <div class="lang-switch">
            <button data-lang-btn="mr">मराठी</button>
            <button data-lang-btn="en">EN</button>
          </div>
        </div>
      </div>`;
    const active = el.querySelector(`[data-nav="${activePage}"]`);
    if (active) active.classList.add("active");
    document.getElementById("navToggle").addEventListener("click", (e) => {
      const nav = document.getElementById("mainNav");
      const open = nav.classList.toggle("open");
      e.currentTarget.setAttribute("aria-expanded", open);
    });
    el.querySelectorAll("[data-lang-btn]").forEach(btn => {
      btn.addEventListener("click", () => setLang(btn.getAttribute("data-lang-btn")));
    });
  }

  function renderFooter() {
    const el = document.getElementById("site-footer");
    if (!el) return;
    const year = new Date().getFullYear();
    el.innerHTML = `
      <footer>
        <div class="container">
          <div class="foot-grid">
            <div>
              <h4 data-i18n="siteName"></h4>
              <p class="small" style="color:rgba(255,255,255,.65)" data-i18n="tagline"></p>
            </div>
            <div>
              <h4 data-i18n="footerAbout"></h4>
              <p><a href="about.html#about" data-i18n="footerAbout"></a></p>
              <p><a href="about.html#methodology" data-i18n="footerMethodology"></a></p>
            </div>
            <div>
              <h4 data-i18n="footerSources"></h4>
              <p><a href="about.html#sources" data-i18n="footerSources"></a></p>
            </div>
            <div>
              <h4 data-i18n="navTracker"></h4>
              <p><a href="hatkanangale-ichalkaranji.html" data-i18n="viewTracker"></a></p>
            </div>
          </div>
          <div class="foot-bottom">
            <span>© ${year} — <span data-i18n="siteName"></span></span>
            <span id="visitorCounter" class="small">Visitor counter: not yet connected — see README</span>
          </div>
        </div>
      </footer>`;
  }

  // ---------------- Helpers ---------------------------------------------
  function lang() { return getLang(); }
  function L(obj, base) { return obj[base + "_" + lang()] || obj[base + "_en"] || ""; }
  function statusLabel(code) { return D.STATUS_LABELS[code] ? D.STATUS_LABELS[code][lang()] || D.STATUS_LABELS[code].en : code; }
  function categoryLabel(code) { return D.CATEGORY_LABELS[code] ? D.CATEGORY_LABELS[code][lang()] || D.CATEGORY_LABELS[code].en : code; }
  function verifyChip(code) {
    const v = D.VERIFICATION[code] || D.VERIFICATION.SOURCE_BASED;
    const label = lang() === "mr" ? v.label_mr : v.label_en;
    return `<span class="verify">${v.dot} ${label}</span>`;
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(lang() === "mr" ? "mr-IN" : "en-IN", { year: "numeric", month: "short", day: "numeric" });
  }
  function projectById(id) { return D.PROJECTS.find(p => p.id === id); }
  function qs(name) { return new URLSearchParams(location.search).get(name); }

  // ---------------- Dashboard stats (computed, never hard-coded) --------
  function computeStats() {
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);
    return {
      total: D.PROJECTS.length,
      underConstruction: D.PROJECTS.filter(p => p.status === "UNDER_CONSTRUCTION").length,
      sanctioned: D.PROJECTS.filter(p => p.status === "SANCTIONED").length,
      proposed: D.PROJECTS.filter(p => p.status === "PROPOSED").length,
      completed: D.PROJECTS.filter(p => p.status === "COMPLETED").length,
      updatedThisMonth: D.PROJECTS.filter(p => (p.updatedAt || "").startsWith(monthKey)).length
    };
  }

  function renderDashboard() {
    const el = document.getElementById("dashboardStats");
    if (!el) return;
    const s = computeStats();
    el.innerHTML = `
      <div class="stat"><div class="num">${s.total}</div><div class="lbl" data-i18n="totalProjects"></div></div>
      <div class="stat"><div class="num">${s.underConstruction}</div><div class="lbl" data-i18n="underConstruction"></div></div>
      <div class="stat"><div class="num">${s.sanctioned}</div><div class="lbl" data-i18n="sanctioned"></div></div>
      <div class="stat"><div class="num">${s.proposed}</div><div class="lbl" data-i18n="proposed"></div></div>
      <div class="stat"><div class="num">${s.completed}</div><div class="lbl" data-i18n="completed"></div></div>
      <div class="stat"><div class="num">${s.updatedThisMonth}</div><div class="lbl" data-i18n="updatedThisMonth"></div></div>
    `;
    renderI18n();
  }

  // ---------------- Latest updates ---------------------------------------
  function renderUpdates(limit) {
    const el = document.getElementById("updatesList");
    if (!el) return;
    const items = [...D.UPDATES].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, limit || D.UPDATES.length);
    if (!items.length) { el.innerHTML = `<div class="empty" data-i18n="noResults"></div>`; renderI18n(); return; }
    el.innerHTML = items.map(u => {
      const proj = projectById(u.projectId);
      return `
      <div class="update-item">
        <div class="update-date">${u.date}<br>${u.time || ""}</div>
        <div>
          <div class="update-headline">${L(u, "headline")}</div>
          <p class="small mb0">${L(u, "summary")}</p>
          <div class="update-meta">
            <span class="tag">${categoryLabel(u.category)}</span>
            ${proj ? `<a href="project.html?id=${proj.id}" class="small">${L(proj, "name")}</a>` : ""}
            ${verifyChip(u.verification)}
            <span>· <span data-i18n="source"></span>: ${u.source_en || "—"}</span>
          </div>
        </div>
      </div>`;
    }).join("");
    renderI18n();
  }

  // ---------------- Featured project banner -------------------------------
  function renderFeatured() {
    const el = document.getElementById("featuredProject");
    if (!el) return;
    const p = D.PROJECTS.find(x => x.featured);
    if (!p) { el.style.display = "none"; return; }
    const latest = [...p.statusHistory].sort((a, b) => b.date.localeCompare(a.date))[0];
    el.innerHTML = `
      <div class="featured">
        <div class="eyebrow" data-i18n="featuredProject"></div>
        <h2>${L(p, "name")}</h2>
        <p>${L(p, "summary")}</p>
        <div class="figures">
          <div><b>${p.lengthKm ? p.lengthKm + " km" : "—"}</b><span data-i18n="length"></span></div>
          <div><b>${statusLabel(p.status)}</b><span data-i18n="status"></span></div>
          <div><b>${fmtDate(latest ? latest.date : p.updatedAt)}</b><span data-i18n="latestUpdate"></span></div>
        </div>
        <a class="btn orange" href="hatkanangale-ichalkaranji.html" data-i18n="viewTracker"></a>
      </div>`;
    renderI18n();
  }

  // ---------------- Project list (with filters) ---------------------------
  function renderProjectList(containerId, opts) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const state = opts && opts.state ? opts.state : {};
    let list = [...D.PROJECTS];
    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter(p =>
        L(p, "name").toLowerCase().includes(q) ||
        (p.district || "").toLowerCase().includes(q) ||
        (p.zone || "").toLowerCase().includes(q)
      );
    }
    if (state.status) list = list.filter(p => p.status === state.status);
    if (state.category) list = list.filter(p => p.category === state.category);
    if (state.district) list = list.filter(p => p.district === state.district);

    if (!list.length) { el.innerHTML = `<div class="empty" data-i18n="noResults"></div>`; renderI18n(); return; }

    el.innerHTML = list.map(p => `
      <div class="project-row">
        <div>
          <a class="project-name" href="project.html?id=${p.id}">${L(p, "name")}</a>
          <div class="project-sub">${p.district || ""} · ${categoryLabel(p.category)}${p.lengthKm ? " · " + p.lengthKm + " km" : ""}</div>
        </div>
        <span class="status-badge${p.status === "COMPLETED" ? " done" : p.status === "ON_HOLD" || p.status === "DROPPED" ? " hold" : ""}">${statusLabel(p.status)}</span>
        <span class="small">${fmtDate(p.updatedAt)}</span>
      </div>`).join("");
    renderI18n();
  }

  function wireFilters(onChange) {
    const bar = document.getElementById("filterBar");
    if (!bar) return;
    const state = { q: "", status: "", category: "", district: "" };
    const searchInput = bar.querySelector("[data-filter=q]");
    const statusSel = bar.querySelector("[data-filter=status]");
    const catSel = bar.querySelector("[data-filter=category]");
    const distSel = bar.querySelector("[data-filter=district]");

    if (statusSel) {
      statusSel.innerHTML = `<option value="">${t("filterAll")}</option>` +
        D.STATUS_ORDER.map(s => `<option value="${s}">${statusLabel(s)}</option>`).join("");
    }
    if (catSel) {
      catSel.innerHTML = `<option value="">${t("filterAll")}</option>` +
        D.CATEGORIES.map(c => `<option value="${c}">${categoryLabel(c)}</option>`).join("");
    }
    if (distSel) {
      const districts = [...new Set(D.PROJECTS.map(p => p.district).filter(Boolean))].sort();
      distSel.innerHTML = `<option value="">${t("filterAll")}</option>` +
        districts.map(d => `<option value="${d}">${d}</option>`).join("");
    }
    function fire() {
      state.q = searchInput ? searchInput.value.trim() : "";
      state.status = statusSel ? statusSel.value : "";
      state.category = catSel ? catSel.value : "";
      state.district = distSel ? distSel.value : "";
      onChange(state);
    }
    [searchInput, statusSel, catSel, distSel].forEach(elm => {
      if (!elm) return;
      elm.addEventListener("input", fire);
      elm.addEventListener("change", fire);
    });
    fire();
  }

  // ---------------- Project detail page ------------------------------------
  function renderProjectDetail() {
    const el = document.getElementById("projectDetail");
    if (!el) return;
    const id = qs("id");
    const p = projectById(id);
    if (!p) {
      el.innerHTML = `<div class="empty" data-i18n="noResults"></div>`;
      renderI18n();
      return;
    }
    document.title = L(p, "name") + " — " + t("siteName");
    const history = [...p.statusHistory].sort((a, b) => b.date.localeCompare(a.date));
    el.innerHTML = `
      ${p.isDemo ? `<span class="tag orange" data-i18n="demoLabel"></span>` : ""}
      <h1>${L(p, "name")}</h1>
      <p>${L(p, "summary")}</p>
      <div class="grid grid-4" style="margin:20px 0 28px">
        <div class="card"><div class="small" data-i18n="district"></div><b>${p.district || "—"}</b></div>
        <div class="card"><div class="small" data-i18n="zone"></div><b>${p.zone || "—"}</b></div>
        <div class="card"><div class="small" data-i18n="category"></div><b>${categoryLabel(p.category)}</b></div>
        <div class="card"><div class="small" data-i18n="status"></div><b>${statusLabel(p.status)}</b></div>
      </div>
      <h2 data-i18n="statusHistory"></h2>
      <div class="timeline">
        ${history.map(h => `
          <div class="timeline-item">
            <div class="tdate">${fmtDate(h.date)}</div>
            <div class="tstatus">${statusLabel(h.status)}</div>
            ${h.costCrore != null ? `<div class="small">₹ ${h.costCrore} crore</div>` : ""}
            <div class="small">${verifyChip(h.verification)} · <span data-i18n="source"></span>: ${h.source}</div>
          </div>`).join("")}
      </div>
      <p class="small" style="margin-top:20px"><span data-i18n="lastUpdated"></span>: ${fmtDate(p.updatedAt)}</p>
    `;
    renderI18n();
  }

  // ---------------- Dedicated project tracker (Hatkanangale–Ichalkaranji) ---
  function renderTracker(projectId) {
    const el = document.getElementById("trackerRoot");
    if (!el) return;
    const p = projectById(projectId);
    if (!p) { el.innerHTML = `<div class="empty" data-i18n="noResults"></div>`; renderI18n(); return; }
    const history = [...p.statusHistory].sort((a, b) => b.date.localeCompare(a.date));
    const latest = history[0];
    const previous = history[1];
    const updates = D.UPDATES.filter(u => u.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date));
    const rtis = D.RTI_RECORDS.filter(r => r.projectId === projectId);

    document.title = L(p, "name") + " — " + t("siteName");

    el.innerHTML = `
      ${p.isDemo ? `<span class="tag orange" data-i18n="demoLabel"></span>` : ""}
      <div class="eyebrow" style="color:var(--orange);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:.78rem;margin:10px 0 6px" data-i18n="featuredProject"></div>
      <h1>${L(p, "name")}</h1>
      <p class="small" data-i18n="approxLength"></p>
      <p>${L(p, "summary")}</p>

      <div class="grid grid-4" style="margin:22px 0">
        <div class="card"><div class="small" data-i18n="status"></div><b>${statusLabel(p.status)}</b></div>
        <div class="card"><div class="small" data-i18n="length"></div><b>${p.lengthKm} km</b></div>
        <div class="card"><div class="small" data-i18n="district"></div><b>${p.district}</b></div>
        <div class="card"><div class="small" data-i18n="lastUpdated"></div><b>${fmtDate(p.updatedAt)}</b></div>
      </div>

      ${previous ? `
      <div class="card" style="border-left:4px solid var(--orange); margin-bottom:28px">
        <h3 data-i18n="whatChanged"></h3>
        <p class="small mb0">
          <span data-i18n="status"></span>: <b>${statusLabel(previous.status)}</b> (${fmtDate(previous.date)})
          → <b>${statusLabel(latest.status)}</b> (${fmtDate(latest.date)})
        </p>
      </div>` : ""}

      <h2 data-i18n="timeline"></h2>
      <div class="timeline">
        ${history.map(h => `
          <div class="timeline-item">
            <div class="tdate">${fmtDate(h.date)}</div>
            <div class="tstatus">${statusLabel(h.status)}</div>
            ${h.costCrore != null ? `<div class="small">₹ ${h.costCrore} crore</div>` : ""}
            <div class="small">${verifyChip(h.verification)} · <span data-i18n="source"></span>: ${h.source}</div>
          </div>`).join("")}
      </div>

      <div class="rail-divider" aria-hidden="true"></div>

      <h2 data-i18n="liveUpdates"></h2>
      <div class="card">
        ${updates.length ? updates.map(u => `
          <div class="update-item">
            <div class="update-date">${u.date}<br>${u.time || ""}</div>
            <div>
              <div class="update-headline">${L(u, "headline")}</div>
              <p class="small mb0">${L(u, "summary")}</p>
              <div class="update-meta">${verifyChip(u.verification)}</div>
            </div>
          </div>`).join("") : `<div class="empty" data-i18n="noResults"></div>`}
      </div>

      <h2 style="margin-top:32px" data-i18n="rtiArchive"></h2>
      <div class="card">
        ${rtis.length ? rtis.map(r => `
          <div class="update-item">
            <div class="update-date">${fmtDate(r.applicationDate)}</div>
            <div>
              <div class="update-headline">${L(r, "subject")}</div>
              <p class="small mb0">${L(r, "keyInfo")}</p>
              <div class="update-meta">
                <span class="tag">${r.applicationNumber}</span>
                ${verifyChip(r.verification)}
              </div>
            </div>
          </div>`).join("") : `<div class="empty" data-i18n="noResults"></div>`}
      </div>
    `;
    renderI18n();
  }

  // ---------------- Today-in-history page -----------------------------------
  function renderTodayPage() {
    const el = document.getElementById("todayContent");
    if (!el) return;
    const dateParam = qs("date");
    const date = dateParam || new Date().toISOString().slice(0, 10);
    document.getElementById("todayDateHeading").textContent = fmtDate(date);
    const items = D.UPDATES.filter(u => u.date === date);
    if (!items.length) {
      el.innerHTML = `<div class="empty" data-i18n="noResults"></div>`;
    } else {
      el.innerHTML = items.map(u => `
        <div class="update-item">
          <div class="update-date">${u.time || ""}</div>
          <div>
            <div class="update-headline">${L(u, "headline")}</div>
            <p class="small mb0">${L(u, "summary")}</p>
            <div class="update-meta">${verifyChip(u.verification)}</div>
          </div>
        </div>`).join("");
    }
    renderI18n();
  }

  // ---------------- Boot -----------------------------------------------------
  window.MRIH = {
    renderHeader, renderFooter, renderDashboard, renderUpdates, renderFeatured,
    renderProjectList, wireFilters, renderProjectDetail, renderTracker, renderTodayPage, computeStats
  };

  window.addEventListener("mrih:langchange", () => {
    renderDashboard();
    renderUpdates(window.__mrihUpdatesLimit);
    renderFeatured();
    if (window.__mrihRerenderList) window.__mrihRerenderList();
    renderProjectDetail();
    renderTracker("htk-ich"); // no-op on pages without #trackerRoot
    renderTodayPage();
  });
})();
