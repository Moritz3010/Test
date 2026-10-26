# ~~Taskboard — MySQL Backend Plan~~

> ⚠️ **Superseded.** This plan (MySQL + Express + Docker) has been replaced by
> [`vercel-supabase-plan.md`](vercel-supabase-plan.md) which uses Supabase (hosted Postgres)
> and Vercel instead. No implementation work should be done from this file.

---

# Taskboard — MySQL Backend Plan (archived)

## Overview

Add a MySQL-backed REST API to the existing Taskboard frontend so that a small team of three
can share one board, assign tasks to named users (nickname-based, no login required), and
persist data in a real database instead of `localStorage`.

**Scope of this plan:** backend only — the frontend will be adapted in a separate plan once
the API is stable and tested locally.

**Local development stack:**
- **Podman** (Docker-compatible container runtime) to run MySQL and the API server locally
- **Node.js + Express** for the REST API
- **MySQL 8** as the database
- **Podman Compose** to wire the containers together with one command

**Out of scope for this plan:**
- Production deployment (that comes after local testing is complete)
- User authentication / passwords / sessions
- Real-time collaboration (WebSockets)
- Frontend changes (separate plan)

---

## Architecture Overview

```
Browser (Frontend)
      │
      │  HTTP REST  (JSON)
      ▼
┌─────────────────┐
│  Express API    │  :3001
│  (Node.js)      │
│  Podman container│
└────────┬────────┘
         │  MySQL protocol
         ▼
┌─────────────────┐
│   MySQL 8       │  :3306
│  Podman container│
└─────────────────┘
```

Both containers are managed by **Podman Compose** and share a private internal network.
The frontend (opened as a local HTML file or served on :3000) calls the API on :3001.

---

## Data Model

### Table: `users`
Stores the three team nicknames. No passwords. A user is created on first use if the
nickname does not already exist.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT PK | |
| `nickname` | VARCHAR(50) UNIQUE NOT NULL | e.g. "Alice" |
| `created_at` | DATETIME DEFAULT NOW() | |

### Table: `tasks`
Mirrors the existing frontend `Task` typedef from `storage.js`, with `assignee_id` added.

| Column | Type | Notes |
|--------|------|-------|
| `id` | CHAR(36) PK | UUID — matches frontend `crypto.randomUUID()` |
| `title` | VARCHAR(255) NOT NULL | |
| `description` | TEXT | nullable |
| `priority` | ENUM('High','Medium','Low') DEFAULT 'Medium' | |
| `due_date` | DATE | nullable |
| `label` | VARCHAR(100) | nullable |
| `status` | ENUM('todo','doing','done') DEFAULT 'todo' | |
| `assignee_id` | INT FK → users.id | nullable — unassigned tasks allowed |
| `sort_order` | INT DEFAULT 0 | preserves drag-and-drop order within a column |
| `created_at` | DATETIME DEFAULT NOW() | |
| `completed_at` | DATETIME | nullable — set when status → done |

---

## API Endpoints

All endpoints return JSON. All request bodies are JSON (`Content-Type: application/json`).

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List all nicknames |
| POST | `/api/users` | Create or fetch a user by nickname |

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | Get all tasks (with optional `?status=` and `?assignee=` filters) |
| POST | `/api/tasks` | Create a new task |
| PATCH | `/api/tasks/:id` | Update any fields of a task (title, status, assignee, etc.) |
| DELETE | `/api/tasks/:id` | Delete a task |
| PATCH | `/api/tasks/reorder` | Bulk-update `sort_order` after drag-and-drop |

---

## Sub-Tasks

---

### Sub-Task 1 — Install and verify Podman

**Intent**
Confirm Podman and Podman Compose are available on the local machine. This is the
foundation everything else runs on. Nothing else can proceed without this.

**Expected Outcomes**
- `podman --version` prints a version number
- `podman-compose --version` prints a version number
- A simple `podman run hello-world` succeeds

**Todo List**
- [ ] Download and install Podman Desktop from https://podman.io (includes Podman CLI)
- [ ] Open a terminal and run `podman --version` to confirm the install
- [ ] Install Podman Compose: `pip3 install podman-compose` (requires Python 3)
- [ ] Run `podman-compose --version` to confirm
- [ ] Run `podman run --rm hello-world` to verify containers work end-to-end

**Relevant Context**
- Podman is a drop-in replacement for Docker — all Docker concepts (images, volumes, networks, compose files) apply identically
- On Windows, Podman runs inside a lightweight Linux VM (WSL2) automatically — no manual setup needed

**Status:** `[ ] pending`

---

### Sub-Task 2 — Set up the project folder structure

**Intent**
Create the backend folder layout and all config files before writing any code.
A clean structure from the start avoids reorganisation later.

**Expected Outcomes**
- A `backend/` folder exists at the repo root alongside `taskboard/`
- `backend/` contains the Node.js project skeleton, Dockerfile, and SQL init script
- A `podman-compose.yml` exists at the repo root
- Running `podman-compose up` (even before code is written) builds the images without errors

**Todo List**
- [ ] Create `backend/` folder at repo root
- [ ] Create `backend/package.json` with Express, mysql2, cors, and dotenv as dependencies
- [ ] Create `backend/src/` folder for source files
- [ ] Create `backend/src/app.js` — Express app entry point (health check route only at this stage)
- [ ] Create `backend/src/db.js` — MySQL connection pool (reads credentials from env vars)
- [ ] Create `backend/src/routes/` folder for route files
- [ ] Create `backend/Dockerfile` — Node.js 20 Alpine image, copies source, runs `npm install`
- [ ] Create `backend/sql/init.sql` — CREATE TABLE statements for `users` and `tasks`
- [ ] Create `podman-compose.yml` at repo root — defines `db` (MySQL 8) and `api` (Node) services
- [ ] Create `.env.example` at repo root documenting required environment variables
- [ ] Create `.env` at repo root with local dev values (never commit this file)
- [ ] Add `.env` to `.gitignore`

**Relevant Context**
- `backend/sql/init.sql` is mounted into the MySQL container at `/docker-entrypoint-initdb.d/`
  so the database schema is created automatically on first start
- Environment variables needed: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`
- The existing `taskboard/js/storage.js` typedef defines the exact field names the API must match

**Status:** `[ ] pending`

---

### Sub-Task 3 — Stand up MySQL with Podman

**Intent**
Get a running, persistent MySQL 8 instance locally using Podman. Verify the schema
is created correctly from the init script before writing any API code.

**Expected Outcomes**
- `podman-compose up db` starts MySQL without errors
- The `taskboard` database exists with `users` and `tasks` tables
- A MySQL client (e.g. DBeaver, TablePlus, or the CLI) can connect on `localhost:3306`
- Stopping and restarting the container preserves data (volume mount confirmed working)

**Todo List**
- [ ] Define the `db` service in `podman-compose.yml` with MySQL 8 image, env vars, volume, and port mapping
- [ ] Write `backend/sql/init.sql` with CREATE TABLE for `users` and `tasks` (schema from Data Model section above)
- [ ] Run `podman-compose up db` and check logs for "ready for connections"
- [ ] Connect with a MySQL client and verify both tables exist with correct columns
- [ ] Insert a test row into `users`, stop the container, restart it, and confirm the row persists
- [ ] Document the local connection string in `.env.example`

**Relevant Context**
- MySQL image: `mysql:8.0`
- Default port: 3306 — map to host port 3306
- Data volume should be a named Podman volume (e.g. `taskboard_mysql_data`) so data survives container restarts
- The `init.sql` file is only run once on first container start — to re-run it, the volume must be deleted

**Status:** `[ ] pending`

---

### Sub-Task 4 — Build the Express API skeleton

**Intent**
Create a running Node.js/Express server inside Podman that connects to MySQL and
responds to a health-check endpoint. This confirms the API container and database
container can communicate before any real routes are written.

**Expected Outcomes**
- `podman-compose up` starts both `db` and `api` containers
- `GET http://localhost:3001/health` returns `{ "status": "ok", "db": "connected" }`
- Restarting the `api` container without touching `db` works cleanly
- Hot reload works during development (nodemon inside the container watching `backend/src/`)

**Todo List**
- [ ] Define the `api` service in `podman-compose.yml` (depends on `db`, mounts `backend/src` as a volume for hot reload)
- [ ] Write `backend/src/db.js` — create a `mysql2/promise` connection pool using env vars
- [ ] Write `backend/src/app.js` — create Express app, mount CORS middleware, add `/health` route that pings the DB
- [ ] Write `backend/Dockerfile` — use `node:20-alpine`, install nodemon for dev, expose port 3001
- [ ] Run `podman-compose up` and hit `GET /health` in a browser or with curl
- [ ] Confirm logs show successful DB connection

**Relevant Context**
- Use `mysql2` (not the older `mysql` package) — it supports Promises natively
- CORS must allow requests from `http://localhost:3000` (the frontend dev origin) and `null` (file:// origin for opening HTML directly)
- Connection pool size: 5 connections is sufficient for a 3-person team
- `nodemon` watches for file changes and restarts the server automatically — the `backend/src/` folder is bind-mounted so edits on the host are reflected immediately without rebuilding the image

**Status:** `[ ] pending`

---

### Sub-Task 5 — Implement the Users API

**Intent**
Build the two user endpoints. Users are identified only by nickname — no passwords,
no sessions. The POST endpoint is idempotent: if the nickname already exists it
returns the existing user rather than creating a duplicate.

**Expected Outcomes**
- `GET /api/users` returns an array of all nicknames with their IDs
- `POST /api/users` with `{ "nickname": "Alice" }` creates Alice if she doesn't exist, or returns her record if she does
- Nickname is trimmed and validated non-empty (400 error if blank)
- Nickname longer than 50 characters is rejected with a 400 error

**Todo List**
- [ ] Create `backend/src/routes/users.js`
- [ ] Implement `GET /api/users` — SELECT all from `users` table
- [ ] Implement `POST /api/users` — INSERT IGNORE + SELECT (idempotent upsert pattern)
- [ ] Add input validation: trim nickname, reject empty or > 50 chars
- [ ] Mount the users router in `app.js` at `/api/users`
- [ ] Test both endpoints with curl or a REST client (e.g. Bruno, Insomnia, Postman)

**Relevant Context**
- The frontend will call `POST /api/users` when the user types their nickname on first visit, then store the returned `id` in `localStorage` for subsequent requests
- `INSERT IGNORE INTO users (nickname) VALUES (?)` followed by `SELECT * FROM users WHERE nickname = ?` is the safest idempotent pattern in MySQL

**Status:** `[ ] pending`

---

### Sub-Task 6 — Implement the Tasks API

**Intent**
Build all five task endpoints — the core of the backend. This replaces what
`localStorage` currently does in the frontend.

**Expected Outcomes**
- `GET /api/tasks` returns all tasks, each with a nested `assignee` object `{ id, nickname }` or `null`
- `POST /api/tasks` creates a task and returns the full created object
- `PATCH /api/tasks/:id` updates any subset of fields and returns the updated object
- `DELETE /api/tasks/:id` removes the task and returns `{ "deleted": true }`
- `PATCH /api/tasks/reorder` accepts an array of `{ id, sort_order }` and bulk-updates ordering
- Status transition to `done` automatically sets `completed_at` to NOW() on the server
- All endpoints return appropriate HTTP status codes (200, 201, 400, 404, 500)

**Todo List**
- [ ] Create `backend/src/routes/tasks.js`
- [ ] Implement `GET /api/tasks` with optional `?status=` and `?assignee_id=` query params; JOIN with `users` to include assignee nickname
- [ ] Implement `POST /api/tasks` — validate `title` non-empty, generate UUID on server with `crypto.randomUUID()`, insert, return full row
- [ ] Implement `PATCH /api/tasks/:id` — build dynamic SET clause from provided fields only; handle `status → done` → set `completed_at`; return updated row
- [ ] Implement `DELETE /api/tasks/:id` — delete and return confirmation
- [ ] Implement `PATCH /api/tasks/reorder` — accept array, run bulk UPDATE in a transaction
- [ ] Add error handling middleware to `app.js` for unhandled errors (returns `{ "error": "message" }` with 500)
- [ ] Mount tasks router in `app.js` at `/api/tasks`
- [ ] Test all endpoints with curl or a REST client

**Relevant Context**
- The existing `Task` typedef in `taskboard/js/storage.js` defines the exact field names the API response must use (camelCase on the frontend, snake_case in the DB — the API layer maps between them)
- Field name mapping: `due_date` → `dueDate`, `created_at` → `createdAt`, `completed_at` → `completedAt`, `assignee_id` → `assignee`
- The `reorder` route must come before `/:id` in the router definition, otherwise Express matches "reorder" as an ID

**Status:** `[ ] pending`

---

### Sub-Task 7 — Migrate the frontend storage layer

**Intent**
Replace `taskboard/js/storage.js` with an API client that calls the Express backend
instead of reading/writing `localStorage`. Because `storage.js` was designed as a
swappable abstraction layer (per `STRATEGY.md` Decision 2), this is a single-file
change — no other files need to change.

**Expected Outcomes**
- `loadTasks()` calls `GET /api/tasks` and returns the same shape the rest of the app expects
- `saveTasks()` is replaced by individual `createTask` / `updateTask` / `deleteTask` API calls (called from `board.js` — no change to `board.js` API surface)
- The board loads tasks from the server on page load
- Creating, editing, deleting, and moving tasks persists to MySQL
- `localStorage` is no longer used for task data

**Todo List**
- [ ] Add a `API_BASE` constant to `storage.js` pointing to `http://localhost:3001/api`
- [ ] Replace `loadTasks()` with an async `fetch(GET /api/tasks)` call
- [ ] Add `createTaskRemote()`, `updateTaskRemote()`, `deleteTaskRemote()` wrappers
- [ ] Update `board.js` to await async storage calls (change `renderAll()` calls to async where needed)
- [ ] Add a nickname picker to the frontend — shown on first visit, stored in `localStorage` as just the user ID (not task data)
- [ ] Test the full board flow end-to-end: create, edit, move, delete, refresh page

**Relevant Context**
- `board.js` currently calls `saveTasks(tasks)` after every mutation — this becomes individual API calls per operation
- `storage.js` must remain the only file that calls `fetch()` — same rule as "no direct `localStorage` calls outside `storage.js`"
- Keep `localStorage` for the nickname/user ID only — this is not task data and does not need to be in MySQL

**Status:** `[ ] pending`

---

### Sub-Task 8 — Assignee feature on the frontend

**Intent**
Add the ability to assign a task to one of the three team members from the task
create/edit modal. This is the only new UI feature introduced by the backend plan.

**Expected Outcomes**
- The create/edit modal has a new "Assignee" dropdown populated from `GET /api/users`
- Tasks can be left unassigned
- Task cards show the assignee nickname as a small chip if assigned
- Filtering by assignee works (a new filter button in the toolbar)

**Todo List**
- [ ] Add `<select id="field-assignee">` to the task modal in `index.html`
- [ ] Populate the assignee dropdown on modal open from the users API
- [ ] Pass `assignee_id` in create/update API calls
- [ ] Display assignee nickname on the task card (new `card-assignee` span)
- [ ] Add assignee filter to the toolbar (alongside priority filters)
- [ ] Style the assignee chip in `style.css` using existing CSS variable conventions

**Relevant Context**
- "Unassigned" should be the default option in the dropdown (value = empty string, maps to `null` in the API)
- The assignee chip on the card should show initials or a short name to avoid cluttering small cards

**Status:** `[ ] pending`

---

### Sub-Task 9 — Local end-to-end test pass

**Intent**
Run the full QA checklist from `QUALITY_ASSURANCE.md` §5 against the backend-connected
app to confirm nothing regressed and the new features work correctly.

**Expected Outcomes**
- All existing checklist items from §5.1–§5.11 still pass
- New backend-specific items pass: data persists after `podman-compose down && podman-compose up`, all three team members can set their nickname and see the shared board, assignee filters work

**Todo List**
- [ ] Run through `QUALITY_ASSURANCE.md` §5.1–§5.11 manually, note any failures
- [ ] Verify data survives a full container restart (`podman-compose down` then `up`)
- [ ] Open the app in two different browsers simultaneously, create a task in one, refresh the other — confirm it appears
- [ ] Assign a task to each of the three nicknames and verify filter works
- [ ] Corrupt the DB connection string in `.env`, reload the app — confirm a user-visible error appears (not a silent failure)
- [ ] Fix any regressions found
- [ ] Update `QUALITY_ASSURANCE.md` with backend-specific guardrails (no direct DB queries outside `routes/`, all inputs validated, no SQL string concatenation — use parameterised queries only)

**Relevant Context**
- The two-browser test is the simplest smoke test for shared state — it does not require WebSockets, just a page refresh
- SQL injection prevention: `mysql2` parameterised queries (`?` placeholders) are mandatory — never concatenate user input into SQL strings

**Status:** `[ ] pending`

---

### Sub-Task 10 — Documentation update

**Intent**
Update all project docs to reflect the new backend so the team can run the project
from scratch using only the docs.

**Expected Outcomes**
- A `README.md` exists at the repo root with step-by-step local setup instructions
- `CHANGELOG.md` has a new `[1.0.0]` entry listing all backend changes
- `STRATEGY.md` updated: localStorage risks 1–3 marked as resolved by the backend
- `QUALITY_ASSURANCE.md` updated with backend-specific guardrails

**Todo List**
- [ ] Create `README.md` with: prerequisites (Podman, Node, Python for podman-compose), clone instructions, `podman-compose up` command, URL to open
- [ ] Add `.env.example` values to README
- [ ] Update `CHANGELOG.md` with `[1.0.0]` entry
- [ ] Update `STRATEGY.md` risks section to mark resolved items
- [ ] Add backend guardrails section to `QUALITY_ASSURANCE.md`

**Relevant Context**
- The README is the single most important document for onboarding a new team member
- Target audience is non-experts — write setup steps as explicit numbered commands, not prose

**Status:** `[ ] pending`

---

## Key Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Container runtime | Podman (not Docker) | User requested Podman |
| API language | Node.js + Express | Minimal setup, same language as frontend, large ecosystem |
| Authentication | None — nickname only | Team of 3, no security requirement, keeps it simple |
| Nickname storage | `localStorage` (user ID only) | Avoids a session system entirely |
| ID generation | `crypto.randomUUID()` on the server | Consistent with existing frontend convention |
| SQL injection prevention | Parameterised queries only | Non-negotiable security baseline |
| Frontend storage swap | Single-file change to `storage.js` | STRATEGY.md Decision 2 designed for this |

---

## Environment Variables Reference

```
# .env.example
DB_HOST=localhost
DB_PORT=3306
DB_USER=taskboard
DB_PASSWORD=taskboard_dev
DB_NAME=taskboard
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

---

## File Structure After Completion

```
/
├── taskboard/          — frontend (unchanged except storage.js + assignee UI)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── storage.js  ← swapped to API client
│       ├── board.js
│       ├── ui.js
│       └── drag-state.js
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── sql/
│   │   └── init.sql    ← schema: users + tasks tables
│   └── src/
│       ├── app.js      ← Express entry point, CORS, error handler
│       ├── db.js       ← mysql2 connection pool
│       └── routes/
│           ├── users.js
│           └── tasks.js
├── podman-compose.yml  ← spins up db + api with one command
├── .env                ← local secrets (git-ignored)
├── .env.example        ← template committed to repo
├── README.md
├── CHANGELOG.md
├── REQUIREMENTS.md
├── QUALITY_ASSURANCE.md
└── STRATEGY.md
```
