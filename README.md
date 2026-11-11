# Taskboard

A Kanban-style task management web app for small teams. Three columns — **To Do**, **Doing**, **Done** — with drag-and-drop, assignees, priority badges, due-date shortcuts, and a Supabase backend.

Live URL: *(deploy to Vercel and paste URL here)*

---

## Features

- Three-column Kanban board with per-column task counters
- Create / edit / delete tasks via modal form
- Drag-and-drop reordering and column switching (SortableJS — works on touch too)
- Quick-move ← → arrow buttons on each card
- Priority badges: High / Medium / Low (colour-coded)
- Assignee selector and filter
- Due-date field with Today / Tomorrow / Next Week / Clear shortcuts
- Overdue highlighting (red border) for cards past their due date
- Live search (title + description) and priority filter
- Nickname picker on first visit (display name stored locally)
- All task data persisted in **Supabase** (hosted Postgres)
- Content-Security-Policy headers via `vercel.json`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Vanilla JS (ES2020 modules), HTML5, CSS3 |
| Backend / DB | [Supabase](https://supabase.com) (hosted Postgres) |
| Hosting | [Vercel](https://vercel.com) |
| Drag & Drop | [SortableJS](https://sortablejs.github.io/Sortable/) via CDN |
| Unit tests | Node.js built-in test runner |
| Visual tests | [Playwright](https://playwright.dev) |

---

## Project Structure

```
taskboard/
├── index.html              — Board layout, modals, nickname picker
├── css/
│   └── style.css           — All styling (CSS custom properties, Inter font)
└── js/
    ├── supabase-client.js  — Supabase client init (leaf module)
    ├── storage.js          — All DB operations via Supabase
    ├── board.js            — Task CRUD + card rendering (async)
    ├── ui.js               — Events, modals, filters, drag-and-drop
    ├── drag-state.js       — Shared drag flag (leaf module)
    ├── date-utils.js       — Pure date helpers (5 exports)
    └── date-utils.test.js  — 31 unit tests for date-utils
tests/
└── taskboard.spec.cjs      — 26 Playwright visual tests
playwright.config.cjs       — Playwright config (MS Edge, port 4000)
package.json
vercel.json
```

---

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org) v18+
- Microsoft Edge (required by the Playwright config on Windows)

### Run locally

```powershell
# Install dependencies (Playwright + serve)
npm install

# Serve the app on http://localhost:4000
npx serve taskboard --listen 4000
```

Open `http://localhost:4000` in your browser.

> **No build step.** The app is pure HTML/CSS/JS — open `taskboard/index.html` directly or serve it with any static server.

---

## Running Tests

### Unit tests (date utilities)

```powershell
npm test
# → 31 tests, all passing
```

### Visual / end-to-end tests (Playwright)

Requires the app to be running on port 4000 first:

```powershell
# Terminal 1 — serve the app
npx serve taskboard --listen 4000

# Terminal 2 — run visual tests
npm run test:visual
# → 26 tests across 6 suites, all passing
```

---

## Deployment (Vercel)

1. Push this repository to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new).
3. Set **Output Directory** to `taskboard` (already defined in `vercel.json`).
4. Add the following **Environment Variables** in Vercel project settings (or a `.env` file locally — never commit it):

   ```
   SUPABASE_URL=https://<your-project>.supabase.co
   SUPABASE_ANON_KEY=<your-anon-key>
   ```

   > The current repo uses hard-coded keys in `supabase-client.js` for the demo project. Replace with your own before making the repo public.

5. Click **Deploy**. Vercel picks up `vercel.json` automatically — CSP headers are applied at the CDN edge.

---

## Database Schema (Supabase / Postgres)

```sql
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  priority     text check (priority in ('High','Medium','Low')) default 'Medium',
  due_date     date,
  label        text,
  status       text check (status in ('todo','doing','done')) default 'todo',
  assignee     text,
  created_at   timestamptz default now(),
  completed_at timestamptz
);
```

---

## Contributing

1. Fork and clone the repo.
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes and run both test suites.
4. Open a pull request against `main`.

Please follow the coding standards in `.bob/rules/fullstack-expert.md`.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.
