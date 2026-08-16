# Maharashtra Railway Information Hub — build notes

## What this is, honestly

This repo is a **working, deployable static frontend**: homepage, full project
database with search/filters, a dedicated Hatkanangale–Ichalkaranji tracker,
a "today in Maharashtra railways" date-archive page, an about/methodology
page, and a bilingual Marathi/English UI. Every number on the dashboard is
computed from the data file at runtime — nothing is hard-coded.

It runs entirely on **demo data** (`data/data.js`, every record marked
`isDemo: true`). It does **not** include a live database, a scraper, a
real visitor counter, or an admin panel with authentication — those need
real infrastructure, real accounts, and real credentials that only you can
provision. Faking them client-side would violate the "no fake data" and
"no secrets in public files" requirements in your brief, so instead this
README gives you the exact, real path to add each one.

Treat this as **v1 of the public frontend** plus a **spec for v2** (the live
system). That split is deliberate — the two are genuinely different projects
with different owners (you control the backend; the frontend can ship today).

---

## 1. File map

```
index.html                       Homepage
projects.html                    Full project database (search + filters)
project.html?id=...              Project detail (generic, data-driven)
hatkanangale-ichalkaranji.html   Dedicated premium tracker for the core project
today.html?date=YYYY-MM-DD       Date-based archive page
about.html                       About / sources / methodology
manifest.json                    Web app manifest (add real icons before shipping)
robots.txt, sitemap.xml          SEO — replace example.org with your real domain
assets/styles.css                Design system (see "Design" below)
assets/app.js                    All rendering logic — reads data/data.js only
data/data.js                     THE DATABASE (demo). Replace with real records.
data/i18n.js                     Marathi/English strings + language switch
README.md                        This file
```

Everything here is plain HTML/CSS/JS — no build step, no framework, no
npm install. It works by opening `index.html` in a browser or serving the
folder with any static host.

## 2. Deploying to GitHub Pages today (with demo data)

1. Create a new GitHub repository (public, since GitHub Pages on the free
   tier is public).
2. Copy every file in this folder into the repo root, preserving the
   `assets/` and `data/` subfolders.
3. In the repo: **Settings → Pages → Source → Deploy from a branch**, branch
   `main`, folder `/ (root)`.
4. Wait a minute, then visit `https://<your-username>.github.io/<repo>/`.
5. Edit `robots.txt` and `sitemap.xml` to use that real URL instead of
   `example.org`.

That's a complete, working deployment — with a demo-data banner clearly
shown, as required.

## 3. Making it live (the real database + automation pipeline)

This is the biggest ask in your brief, so here is the concrete shape of it,
not just a diagram.

**Why GitHub Pages alone can't do this:** GitHub Pages only serves static
files. It cannot run a scraper on a schedule, cannot hold a database
writeable by an admin panel, and cannot keep secrets — anything in the repo
is public. So the architecture below keeps GitHub Pages as the **public
presentation layer only**, exactly as your brief requires in §23.

```
Official sources (Railway Board, Central Railway, MoR, GoM, tenders)
        │  scheduled fetch, respecting robots.txt / ToS / rate limits
        ▼
Collector (scheduled job — see options below)
        │  raw snapshot stored, diffed against last snapshot
        ▼
Change detection  →  flags new/changed items
        │
        ▼
Review queue (human verification: VERIFIED / UNDER_VERIFICATION / etc.)
        │
        ▼
Database (source of truth — see options below)
        │  read-only, public API
        ▼
Static build step  →  regenerates data/data.js (or fetches it at runtime)
        │
        ▼
GitHub Pages (public frontend, this repo)
```

### Recommended concrete stack (pick one path, don't mix)

**Path A — simplest, no server to manage**
- **Database + API:** Supabase (Postgres + auto-generated REST API + row-level
  security) or Firebase (Firestore). Free tier is enough for v1.
- **Scheduled collector:** GitHub Actions on a `schedule:` cron, running a
  small script (Python/Node) that fetches permitted public sources, diffs
  against the last run, and writes candidate updates into a `pending_review`
  table via the database's API using a **server-side service key stored in
  GitHub Actions Secrets** (never in the repo, never in frontend JS).
- **Review/verification:** a small internal admin app (see §5) where an
  editor approves items, which moves them from `pending_review` into the
  public tables.
- **Frontend fetch:** replace the static `data/data.js` with a small fetch
  at page load against the database's public read-only REST endpoint
  (Supabase/Firebase both support anonymous read-only keys scoped by
  row-level security — this key is safe to expose in frontend JS because it
  cannot write).

**Path B — fully within GitHub, no external database**
- Store verified records as JSON/Markdown files in a **separate private
  repo**.
- A GitHub Actions workflow in that private repo validates and merges
  reviewed changes (via pull request, satisfying your §21 requirement for
  protected branches + required checks), then triggers a second workflow
  that copies the public-safe JSON into *this* public repo and redeploys
  Pages.
- Simpler to reason about security-wise (everything sensitive stays in a
  private repo with GitHub's own access controls); less real-time than
  Path A.

Either way: **the collector's credentials and the database's write key
never touch this public repo.** Only a read-only, rate-limited key (Path A)
or already-public JSON (Path B) does.

### What "change detection" concretely means here

For each tracked source page/document: store a hash of its normalized text
alongside the last-seen version. On each run, refetch, compare hashes, and
if different, create a `pending_review` row with old value / new value /
timestamp / source URL — this is exactly the version-history shape already
built into `data/data.js` (`statusHistory` arrays), so no schema change is
needed to go live.

## 4. Visitor counter (§14)

Do **not** ship a `localStorage` counter — it resets per-browser and isn't
real. Real options, roughly in order of effort:

- **Plausible Analytics** or **GoatCounter** (both privacy-conscious,
  cookie-free, GDPR-friendly, have free/cheap tiers) — add their one-line
  script tag, and they expose a small public counter widget/API you can
  read into the footer.
- **Cloudflare Web Analytics** — free, privacy-conscious, no cookies.
- If you want an in-house number instead of a third party: a tiny serverless
  function (Cloudflare Worker or a Supabase Edge Function) that increments a
  counter row on each page load and returns the total — a few lines of code,
  no secret needed since it's a public increment endpoint.

Wire the real total into the `#visitorCounter` element in `assets/app.js`
(`renderFooter`) once you've picked one — that function currently shows an
honest placeholder rather than a fake number.

## 5. Admin panel & security (§20–26)

Do not build `/admin.html` with a password inside JavaScript — anyone can
read it. Concretely:

- Put admin functionality in a **separate app**, not statically hosted next
  to the public site — e.g. a small app hosted on Vercel/Netlify/Cloudflare
  Pages with server-side auth, or Supabase's own Studio/Auth if you use
  Path A above.
- Use **passkeys/WebAuthn or a managed auth provider** (Supabase Auth,
  Clerk, Auth0) rather than rolling your own password system.
- Roles (SUPER_ADMIN / EDITOR / VERIFIER / VIEW_ONLY) map cleanly onto
  Postgres row-level security policies if you use Supabase, or custom
  claims if you use Firebase Auth.
- **Audit log:** a simple append-only table (`audit_log`) written by a
  database trigger on every insert/update to the public tables — editors
  get `INSERT`/`UPDATE` rights on content tables but no `DELETE` on
  `audit_log` itself.
- **GitHub repo hardening:** Settings → Branches → protect `main` (require
  PRs + passing checks); Settings → Security → enable secret scanning,
  Dependabot, and code scanning; require 2FA/passkeys org-wide; give the
  Actions workflow the minimum token scope it needs (`contents: write` only
  on the specific repo it deploys to, nothing broader).
- **Backups:** if you use Supabase, enable its automatic daily backups
  (point-in-time recovery on paid tiers); additionally export a nightly
  JSON dump to a separate private repo or object storage (e.g. Cloudflare
  R2) as an off-platform copy, and periodically test restoring from it.

## 6. Design

Palette: navy `#0B2A4A` / blue `#1B4D7E` / sky `#2E6FB3` for the railway
identity, signal orange `#E8622C` as the single accent (used sparingly —
CTAs, the featured-project rail, status changes) against a neutral warm-grey
background. Display type is Space Grotesk (Latin) paired with Noto Sans
Devanagari so Marathi headings carry the same weight as English ones rather
than reading as a fallback. The signature device is the **rail line** — a
literal track-with-sleepers rule used as section dividers and as the spine
of every status-history timeline — because the site's core job is showing
how a project's status moves along a track over time.

## 7. Extending the data model

`data/data.js` is intentionally the contract between "however you produce
data" and "how the site renders it." Add a new project by adding an object
to `PROJECTS` with the same shape (see `htk-ich` as the template — its
`statusHistory` array is exactly the version-history mechanism your brief
asks for in §24, "never overwrite — preserve old value / new value / date
/ source"). Add a language by adding a key to `STRINGS` in `data/i18n.js` —
nothing else needs to change, per §28's "design so future languages can be
added."

## 8. What's still a placeholder

- `assets/icon-*.png` referenced in `manifest.json` — add real icons before
  shipping (192×192 and 512×512 PNGs).
- `example.org` in `robots.txt` / `sitemap.xml` / meta tags — replace with
  your real domain.
- All content in `data/data.js` — replace demo records with sourced ones,
  and flip `isDemo` to `false` per record only once it has a real source
  and verification level, per §38 ("no fake data").
