---
name: repo-architecture
description: Use when the user asks about the current state of the repo, the project architecture, how files relate to each other, what has been built, or what is planned next. Gives a grounded overview of the Taskboard project.
---

# Repo Architecture — Taskboard Project

When this skill activates, give a complete, grounded overview of the project using the information below.
Always read any file you are uncertain about before describing it — never guess at current contents.

---

## Project Summary

This is a **Kanban-style task management web app** (Taskboard) built for a small team of three.
It is currently in the frontend-only MVP phase. A MySQL backend is planned (see `backend-plan.md`).

---

## Repository Layout

```
/
├── taskboard/                  — The runnable frontend app (open index.html in a browser)
│   ├── index.html              — All markup: board, task modal, detail modal
│   ├── css/
│   │   └── style.css           — All styling via CSS custom properties
│   └── js/
│       ├── storage.js          — localStorage abstraction (swap this for API calls later)
│       ├── board.js            — Task CRUD, card DOM rendering, column rendering
│       ├── ui.js               — Event wiring, modals, search/filter, drag-and-drop
│       └── drag-state.js       — Shared drag flag (leaf module, no imports)
│
├── backend-plan.md             — 10-step plan for adding MySQL + Express backend
├── REQUIREMENTS.md             — Functional + non-functional requirements for the MVP
├── QUALITY_ASSURANCE.md        — Guardrails, coding standards, manual test checklist (§5)
├── STRATEGY.md                 — Deployment strategy, risks, architecture decisions
├── CHANGELOG.md                — Version history (currently v0.1.0)
├── netlify.toml                — Static hosting config (publish dir = taskboard/)
├── .bob/
│   ├── rules/
│   │   └── fullstack-expert.md — Persistent role + coding standards for Bob
│   └── skills/
│       └── repo-architecture/
│           └── SKILL.md        — This file
```

---

## Frontend Architecture

### Module Dependency Graph

```
index.html
  └── ui.js  (entry point, type="module")
        ├── board.js
        │     ├── storage.js   (leaf)
        │     └── drag-state.js (leaf)
        └── drag-state.js      (leaf)
```

### Module Responsibilities

| File | Owns | Must NOT |
|------|------|---------|
| `storage.js` | Read/write localStorage; Task typedef | Touch DOM; contain business logic |
| `board.js` | Task CRUD; card rendering; column rendering | Read localStorage directly; wire UI events |
| `ui.js` | Event listeners; modal open/close; filter state | Contain task data logic; write to localStorage |
| `drag-state.js` | Shared boolean drag flag | Import from any other module |

### Data Model (Task object)

```
{
  id:          string   — crypto.randomUUID()
  title:       string   — required, trimmed
  description: string   — optional, may be ''
  priority:    'High' | 'Medium' | 'Low'
  dueDate:     string   — 'YYYY-MM-DD' or ''
  label:       string   — optional, may be ''
  status:      'todo' | 'doing' | 'done'
  createdAt:   string   — ISO 8601
  completedAt: string | null
}
```

Stored under localStorage key `taskboard_v1` as a JSON array.

---

## What Is Built (v0.1.0)

- Three-column Kanban board (To Do / Doing / Done) with per-column task counts
- Task cards: title, priority badge (colour-coded), description, due date, label, overdue highlight
- Create / edit / delete tasks via modal form
- Read-only detail modal (click a card to open)
- Drag-and-drop via SortableJS (cross-column + reorder within column)
- Quick-move ← → arrow buttons on each card
- Completion timestamp set automatically on move to Done
- Live search (title + description) + priority filter toggles
- Due date shortcuts: Today / Tomorrow / Next week / Clear
- Date year clamped to 2000–2099
- Full localStorage persistence
- Netlify deployment config (`netlify.toml`)

---

## What Is Planned (Not Yet Built)

### Backend (see `backend-plan.md`)

10 sub-tasks, all pending:

1. Install and verify Podman/Docker
2. Set up project folder structure (`backend/`, `podman-compose.yml`)
3. Stand up MySQL 8 with Podman/Docker
4. Build Express API skeleton + `/health` endpoint
5. Users API (`GET/POST /api/users` — nickname-only, no passwords)
6. Tasks API (full CRUD + drag reorder)
7. Migrate `storage.js` from localStorage to API client
8. Assignee feature on the frontend (dropdown, card chip, filter)
9. End-to-end test pass against QA checklist
10. Documentation update (README, CHANGELOG, STRATEGY, QA)

### Frontend Rebuild (separate todo list, in progress)

The frontend has known bugs documented in the todo list:
- Dynamic `import()` anti-pattern inside card button event handlers (board.js)
- Post-drag click event causing detail modal to open after drop
- Escape key handler race condition (two separate document listeners)

---

## Key Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| JS framework | Vanilla ES2020+ | No build step, small codebase |
| Drag & drop | SortableJS @1.15.2 (CDN) | Touch support, simpler than native DnD API |
| Persistence (MVP) | localStorage | Zero backend, single user |
| Persistence (v1) | MySQL 8 + Express | Team of 3, shared board, nickname-based users |
| Container runtime | Docker (or Podman) | Local dev only, production TBD |
| ID generation | crypto.randomUUID() | Collision-safe, consistent frontend ↔ backend |
| Hosting (MVP) | Netlify | Free tier, auto-deploy on git push |

---

## How to Run the Frontend

No build step required. Open `taskboard/index.html` directly in a browser,
or serve with any static server:

```bash
npx serve taskboard
# then open http://localhost:3000
```

---

## Important Files to Read for Context

Before making any significant change, read:
- `REQUIREMENTS.md` — what the app must do
- `QUALITY_ASSURANCE.md` — guardrails and the §5 manual test checklist
- `backend-plan.md` — the full backend roadmap with sub-task details
