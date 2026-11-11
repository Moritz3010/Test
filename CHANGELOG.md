# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.2.0] — 2025-11-11

### Added
- **Supabase backend integration** — all task data now persisted in a hosted Postgres database; `storage.js` fully rewritten to use Supabase JS client with parameterised queries
- **Nickname picker** — first-visit flow prompts the user for a display name; stored in `localStorage` (user ID only, no task data in browser storage)
- **Assignee feature** — tasks can be assigned to a team member; assignee chip shown on card; filter by assignee in toolbar
- **Date shortcuts** — "Today", "Tomorrow", "Next week", "Clear" buttons in date fields
- **Date field constraints** — `min = today`, `max = today + 365 days`, enforced dynamically on every modal open
- **Pure date utility module** `date-utils.js` — 5 exported functions (`todayISO`, `tomorrowISO`, `nextWeekISO`, `isOverdue`, `friendlyDate`)
- **Unit test suite** — `date-utils.test.js` with 31 tests; run with `npm test`
- **Playwright visual test suite** — `tests/taskboard.spec.cjs` with 26 tests across 6 suites; run with `npm run test:visual`
- **`vercel.json`** deployment config with static output directory and `Content-Security-Policy` response headers
- **`supabase-client.js`** leaf module for Supabase client initialisation
- **`drag-state.js`** shared leaf module for cross-module drag flag

### Changed
- **Full visual redesign** — indigo→pink gradient header, column-specific colour identities (indigo/orange/emerald), Inter font via Google Fonts, lifted card shadows, outlined priority badges, blurred modal backdrop
- **`board.js`** rewritten as fully async (all CRUD operations await Supabase)
- **`storage.js`** now an async API layer (snake_case ↔ camelCase mapping between DB and frontend)
- **`package.json`** updated with `"type": "module"` and `npm test` / `npm run test:visual` scripts
- Hosting recommendation changed from Netlify to **Vercel** (aligned with `vercel.json` config)

### Fixed
- Risks 1–3 from `STRATEGY.md` (localStorage per-device, no user isolation, data loss) resolved by Supabase backend

---

## [0.1.0] — 2025-07-10

### Added
- Initial prototype of the Kanban task board
- Three-column layout: **To Do**, **Doing**, **Done** with per-column task counters
- Task card displaying title, description, priority badge, due date, label, and creation date
- **Create task** modal form with fields: Title (required), Description, Priority, Due Date, Label
- **Edit task** modal pre-filled with existing card data; Save and Cancel actions
- **Delete task** with inline confirmation prompt
- Quick-move arrow buttons on each card (move left / move right between columns)
- Drag-and-drop reordering and column-switching via SortableJS
- Visual drag feedback: card lift shadow + column highlight on hover
- Overdue task highlighting (red border) for cards past their due date not yet in Done
- Empty-column placeholder message ("No tasks here yet")
- Color-coded priority badges: High = red, Medium = amber, Low = green
- Completion timestamp automatically set when a task is moved to **Done**
- Global live search bar (filters by title and description as you type)
- Filter by priority (multi-select toggle buttons)
- Filter by label/tag (dynamic from existing labels)
- All board state persisted to **localStorage** (survives page refresh)
- Modular ES-module file structure: `storage.js`, `board.js`, `ui.js`
- Unique task IDs via `crypto.randomUUID()`
- `Content-Security-Policy` meta tag to prevent XSS
- ARIA labels and keyboard navigation on all interactive elements

---

<!-- New entries go above this line, newest first -->
