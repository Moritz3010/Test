# Task Management Web App — Deployment Strategy & Risk Assessment

## Executive Summary

Deploying this app as a publicly accessible webapp is **low-to-medium difficulty** for the MVP scope defined in `REQUIREMENTS.md`. The app is a static frontend deployed to **Vercel**, backed by a hosted **Supabase** Postgres database. Initial deployment is straightforward via Git push. Risks 1–3 from the original assessment (localStorage per-device, no user isolation, data loss) have been resolved in v0.2.0 by the Supabase integration. Remaining complexity lies in real-time collaboration and authentication.

---

## Difficulty Breakdown by Phase

| Phase | Effort | Difficulty |
|-------|--------|------------|
| Build the app (HTML/CSS/JS) | 1–3 days | 🟢 Low |
| Deploy static files to a hosting provider | < 1 hour | 🟢 Low |
| Custom domain + HTTPS | 1–2 hours | 🟢 Low |
| Add a real backend (API + database) | 3–7 days | 🟡 Medium |
| User authentication | 2–5 days | 🟡 Medium |
| Real-time collaboration | 1–3 weeks | 🔴 High |
| Mobile-first responsive redesign | 2–4 days | 🟡 Medium |

---

## Hosting Options for the MVP (Static)

Since the MVP is pure HTML/CSS/JS with no server component, it can be deployed to any static hosting provider in minutes.

| Provider | Free Tier | Custom Domain | CI/CD | Notes |
|----------|-----------|---------------|-------|-------|
| **GitHub Pages** | ✅ | ✅ | ✅ (GitHub Actions) | Best for open-source projects |
| **Netlify** | ✅ | ✅ | ✅ | Drag-and-drop deploy or Git push |
| **Vercel** | ✅ | ✅ | ✅ | Excellent DX, instant preview URLs |
| **Cloudflare Pages** | ✅ | ✅ | ✅ | Global CDN, very fast |
| **AWS S3 + CloudFront** | Pay-as-you-go | ✅ | Manual/complex | Overkill for MVP |

**Recommendation:** **Vercel** — zero config, free HTTPS, automatic deploys on Git push. `vercel.json` is already configured in this repo.

---

## Key Problems & Risks

### ~~1. `localStorage` Is Per-Browser, Per-Device~~ ✅ RESOLVED (v0.2.0)
**Resolution:** All task data is now stored in **Supabase** (hosted Postgres). `localStorage` is used only for the user's display-name / ID. Any device, any browser, same data.

---

### ~~2. No User Isolation~~ ✅ RESOLVED (v0.2.0)
**Resolution:** The nickname picker assigns each user a UUID stored in `localStorage`. Tasks carry an `assignee` field. Full auth (e.g. Supabase Auth) remains a future step if login/password flows are needed.

---

### ~~3. Data Loss Risk~~ ✅ RESOLVED (v0.2.0)
**Resolution:** Tasks are persisted server-side in Supabase. Browser data-clearing no longer affects task data. Supabase provides automatic daily backups on paid plans.

---

### 4. Drag-and-Drop Accessibility & Mobile
**Problem:** Native HTML5 drag-and-drop does not work on touch screens. Mobile users get no drag-and-drop support at all.

**Impact:** Medium — mobile is currently out of scope, but real-world users will try it.

**Mitigation:**
- Use **SortableJS** (supports both mouse and touch) instead of the native DnD API.
- Always provide the quick-move arrow buttons as a keyboard- and touch-friendly fallback.

---

### 5. Browser Compatibility of Modern JS Features
**Problem:** Using ES2020+ features (optional chaining, nullish coalescing, etc.) without transpilation may break on older enterprise browsers.

**Impact:** Low for modern consumer browsers; medium for enterprise/internal tools.

**Mitigation:**
- If targeting general audiences, add a **Babel** transpilation step and bundle with **esbuild** or **Vite**.
- For a quick MVP with a known modern-browser audience, no transpilation is needed.

---

### 6. Security Considerations (Even for a Static App)
**Problem:** Even without a backend, there are risks:
- **XSS (Cross-Site Scripting):** If user-supplied task titles/descriptions are rendered as raw HTML, an attacker can inject malicious scripts.
- **Content Security Policy (CSP):** Without a CSP header, the browser allows any inline scripts or external resources.

**Impact:** Medium — especially relevant if the app is ever embedded in another site or shared publicly.

**Mitigation:**
- Always render user input as **text content** (`element.textContent`), never `innerHTML`.
- Add a `Content-Security-Policy` header via Netlify/Vercel config (`_headers` or `vercel.json`).

---

### 7. Scalability of the Architecture
**Problem:** `localStorage` has a ~5 MB size limit. At scale (hundreds of tasks with long descriptions), this limit can be hit.

**Impact:** Low for typical use, but worth monitoring.

**Mitigation:** Store only essential fields; truncate or paginate long descriptions if necessary. Flag to the user when storage usage is > 80%.

---

### 8. SEO & Shareability
**Problem:** A pure client-side single-page app renders nothing meaningful to search engines or link-preview crawlers (e.g. Slack/Twitter unfurls).

**Impact:** Low for a personal productivity tool; medium if the app is meant to be discovered or shared.

**Mitigation:**
- Add meaningful `<meta>` tags (title, description, Open Graph) in the HTML `<head>`.
- For SEO beyond that, server-side rendering (SSR) would be required — out of MVP scope.

---

## Architecture Decision Points

These are decisions that, if made incorrectly early, will require expensive rewrites later:

### Decision 1 — Vanilla JS vs. a Framework
- **Vanilla JS** is fastest to ship but becomes painful to maintain at > ~500 lines of logic.
- **React/Vue/Svelte** adds a small setup cost but pays off quickly in maintainability.
- **Recommendation:** Use Vanilla JS for the MVP; migrate to a framework if a second major feature iteration is planned.

### Decision 2 — `localStorage` vs. Backend from Day 1
- ~~`localStorage` is fine for a **single-user personal tool**.~~
- **v0.2.0 decision:** Supabase is used from the first deployed version. The `storage.js` abstraction layer proved its value — the swap from `localStorage` to Supabase was entirely contained within that one file.

### Decision 3 — Monolithic HTML file vs. Module Structure
- A single `index.html` is fine for prototyping.
- As soon as logic exceeds ~300 lines, split into ES modules (`board.js`, `task.js`, `storage.js`, `ui.js`).
- **Recommendation:** Start modular to avoid a painful refactor.

---

## Recommended MVP Delivery Path

```
Week 1
  ├── Day 1–2:  Build static HTML/CSS layout (board + card structure)
  ├── Day 3–4:  Implement JS logic (create, move, edit, delete, localStorage)
  └── Day 5:    Deploy to Netlify/Vercel, add custom domain + HTTPS

Week 2 (if time allows)
  ├── Day 1–2:  Add drag-and-drop (SortableJS), search, and filters
  ├── Day 3:    Polish UI, overdue highlighting, empty states
  └── Day 4–5:  Export/import JSON, CSP headers, basic accessibility pass
```

---

## Important Points to Keep in Mind

1. **Design the data model first.** Define the task object shape (`id`, `title`, `description`, `priority`, `dueDate`, `label`, `status`, `createdAt`) before writing any UI code. Changing it later cascades through every part of the app.

2. **Separate storage from UI.** Never access `localStorage` directly in UI code. Use a `StorageService` wrapper — this makes testing and future backend migration trivial.

3. **Generate unique IDs properly.** Use `crypto.randomUUID()` (available in all modern browsers) for task IDs, not `Date.now()` — timestamp collisions are a real bug risk.

4. **Plan for the "empty state" from the start.** An app that shows a blank screen with no guidance on first load feels broken. Design the empty-column placeholder on day one.

5. **Test localStorage quota.** Call `localStorage.setItem` inside a `try/catch` — browsers throw a `QuotaExceededError` silently in some configurations (especially Safari in private browsing, which has a 0-byte quota).

6. **HTTPS is non-negotiable.** Even for a static app, all modern hosting providers give you free HTTPS. Never serve over plain HTTP — browsers increasingly restrict APIs (like clipboard access) on non-secure origins.

7. **Do not pre-optimise for scale.** The app does not need virtual scrolling, a service worker, or a CDN until there is evidence it needs them. Ship simple, measure, then improve.
