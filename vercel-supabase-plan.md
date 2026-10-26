# Taskboard — Vercel + Supabase Deployment Plan

## Overview

Deploy the Taskboard frontend to **Vercel** and replace the localStorage persistence
with a **Supabase** (hosted PostgreSQL) backend. This supersedes the previous
`backend-plan.md` which assumed a self-hosted MySQL + Express + Docker stack.

**Why this is simpler than the old plan:**
- No containers, no Docker/Podman, no local database server to manage
- No custom Express API to write — Supabase provides a REST API automatically
- No servers to maintain — both Vercel and Supabase are fully managed
- Free tier on both platforms is sufficient for a 3-person team

**Team:** 3 people, nickname-based identity (no passwords/login), shared board.

**Scope of this plan:** full stack — Supabase schema + API + frontend swap + Vercel deploy.

**Out of scope:**
- Real-time collaboration (WebSockets / Supabase Realtime) — post-MVP
- User authentication with passwords — not needed for this team size
- The old Docker/Podman/MySQL/Express approach — fully replaced by this plan

---

## New Architecture

```
Browser (Vercel CDN)
      │
      │  HTTPS REST (JSON)
      ▼
┌──────────────────────────┐
│  Supabase REST API       │  auto-generated from schema
│  (PostgREST, managed)    │  https://<project>.supabase.co/rest/v1/
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  PostgreSQL (managed)    │  hosted by Supabase, no maintenance needed
│  Supabase project DB     │
└──────────────────────────┘
```

The frontend calls Supabase directly using the Supabase JS client (or plain `fetch`
with the auto-generated REST API). No custom backend server is needed.

---

## Data Model (PostgreSQL)

The schema mirrors the existing `Task` typedef from `storage.js` with `assignee_id` added.

### Table: `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial` PRIMARY KEY | Auto-increment integer |
| `nickname` | `varchar(50)` UNIQUE NOT NULL | e.g. "Alice" |
| `created_at` | `timestamptz` DEFAULT `now()` | |

### Table: `tasks`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` DEFAULT `gen_random_uuid()` PK | Matches frontend `crypto.randomUUID()` |
| `title` | `varchar(255)` NOT NULL | |
| `description` | `text` | nullable |
| `priority` | `text` CHECK IN ('High','Medium','Low') DEFAULT 'Medium' | |
| `due_date` | `date` | nullable |
| `label` | `varchar(100)` | nullable |
| `status` | `text` CHECK IN ('todo','doing','done') DEFAULT 'todo' | |
| `assignee_id` | `integer` FK → `users.id` | nullable |
| `sort_order` | `integer` DEFAULT 0 | preserves drag-and-drop order |
| `created_at` | `timestamptz` DEFAULT `now()` | |
| `completed_at` | `timestamptz` | nullable — set when status → done |

---

## API Access

Supabase exposes a **PostgREST** API automatically from the schema.
The frontend uses the **Supabase JavaScript client** (`@supabase/supabase-js`) which wraps
this API with a clean, typed interface.

Key operations:
- `supabase.from('tasks').select('*, users(nickname)')` — fetch all tasks with assignee
- `supabase.from('tasks').insert({...})` — create a task
- `supabase.from('tasks').update({...}).eq('id', id)` — update a task
- `supabase.from('tasks').delete().eq('id', id)` — delete a task
- `supabase.from('users').upsert({ nickname })` — create or return a user

All operations use the **anon key** (public, safe to expose in the browser) with
**Row Level Security (RLS)** policies that allow full read/write for all users
(appropriate for a trusted 3-person team with no sensitive data).

---

## Sub-Tasks

---

### Sub-Task 1 — Create the Supabase project and schema

**Intent**
Set up the hosted database on Supabase and define the tables. This is the foundation
for all subsequent steps — nothing else can be built until the schema exists.

**Expected Outcomes**
- A Supabase project exists and is accessible at the Supabase dashboard
- `users` and `tasks` tables exist with correct columns, types, and constraints
- Row Level Security is enabled with permissive policies (allow all for anon key)
- The Supabase project URL and anon key are available for use in the frontend

**Todo List**
- [ ] Sign up at [supabase.com](https://supabase.com) (free tier, no credit card required)
- [ ] Create a new project — name it `taskboard`, choose the nearest region, set a database password
- [ ] Open the **SQL Editor** in the Supabase dashboard
- [ ] Run the following SQL to create the schema:

```sql
-- Users table
create table users (
  id serial primary key,
  nickname varchar(50) unique not null,
  created_at timestamptz default now()
);

-- Tasks table
create table tasks (
  id uuid default gen_random_uuid() primary key,
  title varchar(255) not null,
  description text,
  priority text check (priority in ('High', 'Medium', 'Low')) default 'Medium',
  due_date date,
  label varchar(100),
  status text check (status in ('todo', 'doing', 'done')) default 'todo',
  assignee_id integer references users(id) on delete set null,
  sort_order integer default 0,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Enable Row Level Security
alter table users enable row level security;
alter table tasks enable row level security;

-- Allow full access via anon key (trusted 3-person team)
create policy "allow all users" on users for all using (true) with check (true);
create policy "allow all tasks" on tasks for all using (true) with check (true);
```

- [ ] Verify both tables appear in the **Table Editor**
- [ ] Copy the **Project URL** and **anon public key** from Project Settings → API
- [ ] Save these two values — they will go into the frontend environment config

**Relevant Context**
- The anon key is safe to expose in browser code when RLS is enabled
- `gen_random_uuid()` is built into PostgreSQL 13+ — no extension needed
- RLS policies control what the anon key can do — the permissive policy here is correct for a small trusted team

**Status:** `[ ] pending`

---

### Sub-Task 2 — Add the Supabase client to the frontend

**Intent**
Install the Supabase JS client and wire it into the frontend so it can talk to the
database. This replaces the `localStorage` abstraction in `storage.js` with real
API calls — a single-file swap designed for in `STRATEGY.md` Decision 2.

**Expected Outcomes**
- The Supabase client is loaded in `index.html` via CDN (no build step required)
- `storage.js` exports the same function signatures (`loadTasks`, `saveTask`, etc.)
  but now calls Supabase instead of `localStorage`
- The board loads tasks from Supabase on page load
- Creating, editing, deleting, and moving tasks persists to the database
- Refreshing the page in two different browsers shows the same tasks

**Todo List**
- [ ] Add the Supabase CDN script to `index.html`:
  `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
- [ ] Create `taskboard/js/supabase-client.js` — initialises the Supabase client with
  the project URL and anon key (leaf module, no other imports)
- [ ] Rewrite `taskboard/js/storage.js` to replace localStorage calls with Supabase queries:
  - `loadTasks()` → `supabase.from('tasks').select('*, users(nickname)').order('sort_order')`
  - `saveTask(task)` → `supabase.from('tasks').upsert(task)`
  - `deleteTask(id)` → `supabase.from('tasks').delete().eq('id', id)`
  - `reorderTasks(updates)` → bulk upsert of `[{ id, sort_order }]`
- [ ] Update `board.js` to handle async storage calls (add `await` where `loadTasks` is called)
- [ ] Update the CSP meta tag in `index.html` to allow Supabase's domain:
  `connect-src 'self' https://*.supabase.co`
- [ ] Test locally: open `taskboard/index.html` via a local server, create a task,
  verify it appears in the Supabase Table Editor

**Relevant Context**
- `supabase-client.js` must be a new leaf module — no imports from other project files
- The Supabase URL and anon key are **not secrets** — they are safe to hardcode in the
  frontend for a public/trusted-team app with RLS enabled
- `board.js` currently calls `saveTasks(tasks)` (synchronous, full array) — this changes
  to per-operation async calls (`saveTask`, `deleteTask`, etc.)
- Keep `localStorage` for the nickname/user ID only — this is not task data

**Status:** `[ ] pending`

---

### Sub-Task 3 — Nickname picker and users integration

**Intent**
Add the nickname picker UI so each team member identifies themselves on first visit.
The chosen nickname is stored locally; the user record lives in Supabase.

**Expected Outcomes**
- On first visit, a simple nickname picker screen is shown (not the board)
- The user enters their name (e.g. "Alice") and clicks confirm
- The nickname is upserted to the `users` table; the returned user ID is stored in `localStorage`
- On subsequent visits, the picker is skipped and the board loads immediately
- A small "You are: Alice" indicator appears in the header with a "Change" link

**Todo List**
- [ ] Add a nickname picker overlay to `index.html` (hidden by default, shown when no user ID in localStorage)
- [ ] Add `loadOrCreateUser(nickname)` to `storage.js` — upserts to `users` table, returns user record
- [ ] On confirm: call `loadOrCreateUser`, store `userId` in `localStorage`, hide picker, show board
- [ ] Show the current nickname in the app header with a "Change" button that clears localStorage and shows the picker again
- [ ] Style the nickname picker in `style.css` using existing CSS variables

**Relevant Context**
- Only the `userId` (integer) is stored in `localStorage` — not task data
- The picker should feel lightweight — a single text input and a confirm button, not a login form
- If the nickname already exists in the DB, `upsert` with `onConflict: 'nickname'` returns the existing record

**Status:** `[ ] pending`

---

### Sub-Task 4 — Assignee feature

**Intent**
Add the ability to assign tasks to team members. This is the primary collaboration
feature enabled by having real user records in the database.

**Expected Outcomes**
- The create/edit task modal has an "Assignee" dropdown
- The dropdown is populated from `GET users` (Supabase query)
- Tasks can be left unassigned (default)
- Task cards show the assignee's nickname as a small chip when assigned
- The toolbar has an assignee filter alongside the priority filters

**Todo List**
- [ ] Add `<select id="field-assignee">` to the task modal in `index.html`
- [ ] Add `loadUsers()` to `storage.js` — fetches all users from Supabase
- [ ] Populate the assignee dropdown when the modal opens
- [ ] Pass `assignee_id` in create/update calls to `storage.js`
- [ ] Display assignee nickname on the task card (new `card-assignee` chip element)
- [ ] Add assignee filter buttons to the toolbar
- [ ] Style the assignee chip in `style.css`

**Relevant Context**
- "Unassigned" should be the first dropdown option (value = `null`)
- The task query already does `select('*, users(nickname)')` — the assignee name arrives
  nested as `task.users.nickname`; map it to `task.assignee.nickname` in `storage.js`

**Status:** `[ ] pending`

---

### Sub-Task 5 — Deploy frontend to Vercel

**Intent**
Push the frontend to Vercel so it is live at a public URL. Replace the existing
`netlify.toml` config with a `vercel.json` equivalent.

**Expected Outcomes**
- The app is live at `https://<project>.vercel.app`
- Every push to the `main` branch auto-deploys
- The Supabase URL and anon key are set as Vercel environment variables
  (even though they are safe to hardcode, using env vars is cleaner practice)
- The `netlify.toml` is replaced by `vercel.json`

**Todo List**
- [ ] Sign up at [vercel.com](https://vercel.com) with your GitHub account
- [ ] Create `vercel.json` at the repo root:
```json
{
  "buildCommand": null,
  "outputDirectory": "taskboard",
  "framework": null,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co;" }
      ]
    }
  ]
}
```
- [ ] Remove (or archive) `netlify.toml` — it is replaced by `vercel.json`
- [ ] Push the code to GitHub (prerequisite: Git and a GitHub repo must exist)
- [ ] In Vercel dashboard: **Add New Project** → import the GitHub repo
- [ ] Set **Output Directory** to `taskboard` in the Vercel project settings
- [ ] Add environment variables in Vercel: `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- [ ] Update `supabase-client.js` to read from these env vars if available, else
  fall back to hardcoded values for local development
- [ ] Trigger a deploy and verify the live URL works end-to-end

**Relevant Context**
- Vercel detects a static site automatically when `framework` is `null`
- The `outputDirectory` tells Vercel where `index.html` lives (`taskboard/`)
- The CSP header in `vercel.json` must include `connect-src https://*.supabase.co`
  or the browser will block Supabase API calls

**Status:** `[ ] pending`

---

### Sub-Task 6 — End-to-end test pass

**Intent**
Verify the full deployed app works correctly for all three team members using the
live Vercel URL and the Supabase database.

**Expected Outcomes**
- All QA checklist items from `QUALITY_ASSURANCE.md` §5 still pass on the live URL
- Two people can open the app simultaneously and see shared task state after refresh
- Nickname picker works and correctly identifies each team member
- Assignee filter correctly shows tasks per person
- Data survives closing and reopening the browser

**Todo List**
- [ ] Open the live Vercel URL in Chrome, complete the QA checklist §5.1–§5.11
- [ ] Open the app in two different browsers, create a task in one, refresh the other — confirm it appears
- [ ] Test all three nickname slots: Alice, Bob, Charlie (or your actual names)
- [ ] Assign tasks to each user, verify the assignee chip and filter work
- [ ] Check the Supabase Table Editor to confirm all operations reflect correctly in the DB
- [ ] Verify no errors in the browser console

**Status:** `[ ] pending`

---

### Sub-Task 7 — Documentation update

**Intent**
Update all project docs to reflect the new Vercel + Supabase stack. The old
`backend-plan.md` (MySQL/Express/Docker) is superseded by this plan.

**Expected Outcomes**
- `README.md` exists with setup instructions for the new stack
- `CHANGELOG.md` has a `[1.0.0]` entry for the backend launch
- `STRATEGY.md` updated: localStorage risks 1–3 marked as resolved
- `backend-plan.md` marked as superseded

**Todo List**
- [ ] Create `README.md` with: Supabase setup steps, Vercel deploy steps, local dev instructions (`npx serve taskboard`), environment variable reference
- [ ] Update `CHANGELOG.md` with `[1.0.0]` entry
- [ ] Update `STRATEGY.md` to mark risks 1 (per-device), 2 (no user isolation), 3 (data loss) as resolved
- [ ] Add a note at the top of `backend-plan.md`: "Superseded by `vercel-supabase-plan.md`"

**Status:** `[ ] pending`

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Frontend hosting | Vercel | Auto-deploy on git push, free tier, instant CDN |
| Database | Supabase (hosted Postgres) | No server to manage, free tier, built-in REST API |
| Custom backend API | None needed | Supabase PostgREST replaces Express entirely |
| Containers | None needed | Fully managed cloud services |
| Auth | Nickname only, no passwords | Team of 3, trusted environment |
| Anon key exposure | Safe with RLS enabled | Standard Supabase pattern for public/trusted apps |
| `storage.js` swap | Single-file change | Designed for this in STRATEGY.md Decision 2 |
| Old plan | Superseded | MySQL/Express/Docker replaced by Supabase |

---

## Environment Variables

```
# For local development — create taskboard/js/supabase-client.js with these values
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>

# Set these same values as environment variables in the Vercel project dashboard
```

---

## File Structure After Completion

```
/
├── taskboard/
│   ├── index.html              ← + nickname picker overlay + assignee dropdown
│   ├── css/style.css           ← + assignee chip + nickname picker styles
│   └── js/
│       ├── supabase-client.js  ← NEW: initialises Supabase client (leaf module)
│       ├── storage.js          ← REWRITTEN: Supabase queries instead of localStorage
│       ├── board.js            ← minor: async/await for storage calls
│       ├── ui.js               ← minor: assignee dropdown wiring
│       └── drag-state.js       ← unchanged
├── vercel.json                 ← NEW: replaces netlify.toml
├── backend-plan.md             ← marked as superseded
├── vercel-supabase-plan.md     ← this file
├── README.md                   ← NEW
├── CHANGELOG.md
├── REQUIREMENTS.md
├── QUALITY_ASSURANCE.md
└── STRATEGY.md
```
