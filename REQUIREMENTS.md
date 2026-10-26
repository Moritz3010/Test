# Task Management Web App — Requirements

## Overview

A lightweight, browser-based Kanban-style task board with three columns: **To Do**, **Doing**, and **Done**. Users can create, manage, and move tasks across columns to track their work progress.

---

## Functional Requirements

### 1. Board Layout
- Display three fixed columns: **To Do**, **Doing**, **Done**
- Each column shows its name as a header and a count of tasks it currently contains
- Columns are arranged horizontally side by side

### 2. Task Card
Each task card must display:
- **Title** (required) — short summary of the task
- **Description** (optional) — additional detail
- **Priority** — one of: `Low`, `Medium`, `High`
- **Due date** (optional)
- **Label/Tag** (optional) — e.g. "Bug", "Feature", "Chore"
- **Creation date** — set automatically on creation

### 3. Creating Tasks
- A "Add Task" button per column (or a global "New Task" button that defaults to **To Do**)
- Opens a modal/form with fields: Title, Description, Priority, Due Date, Label
- Title is the only required field
- Submitting the form adds the card to the target column

### 4. Moving Tasks
- Drag-and-drop cards between columns
- Quick-move buttons on each card (e.g. arrow icons) as an alternative to drag-and-drop
- Moving a task to **Done** optionally sets a completion timestamp

### 5. Editing Tasks
- Clicking a card opens an edit modal pre-filled with the card's current data
- All fields editable
- Save button updates the card; Cancel discards changes

### 6. Deleting Tasks
- Delete button (with a confirmation prompt) on each card or inside the edit modal
- Deleted tasks are removed immediately from the board

### 7. Filtering & Search
- Global search bar to filter cards by title or description (live filter as you type)
- Filter by priority (multi-select: Low / Medium / High)
- Filter by label/tag

### 8. Persistence
- Board state persisted in **localStorage** so the board survives page refreshes
- No backend or login required for the MVP

---

## Non-Functional Requirements

| # | Requirement | Detail |
|---|-------------|--------|
| NFR-1 | Responsive design | Usable on desktop and tablet screens (min. 768 px wide) |
| NFR-2 | Performance | Board renders smoothly with up to 200 tasks |
| NFR-3 | Accessibility | Keyboard-navigable; ARIA labels on interactive elements |
| NFR-4 | No external backend | All data stored client-side (localStorage) for MVP |
| NFR-5 | Modern browser support | Chrome, Firefox, Edge (latest two versions) |

---

## UI / UX Guidelines

- Clean, minimal design — white/light background, clear column separators
- Color-coded priority badges: `High` = red, `Medium` = amber, `Low` = green
- Overdue tasks (past due date, not in Done) highlighted with a subtle red border
- Empty columns show a placeholder message (e.g. *"No tasks here yet"*)
- Drag-and-drop provides visual feedback (card shadow, column highlight on hover)

---

## Tech Stack (Recommended)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Markup | HTML5 | Standard, no build step |
| Styling | CSS3 (custom) or Tailwind CSS | Utility-first, fast prototyping |
| Logic | Vanilla JavaScript (ES2020+) | No framework dependency for MVP |
| Drag & Drop | Native HTML5 DnD API or SortableJS | Lightweight |
| Persistence | `localStorage` (JSON) | Zero-backend requirement |

> Framework alternatives: React + Zustand, Vue 3, or Svelte are all viable if a component-based approach is preferred.

---

## Out of Scope (MVP)

- User authentication / multi-user support
- Real-time collaboration
- File attachments
- Comments / activity log per task
- Backend database or API
- Mobile (< 768 px) layout

---

## Future Enhancements (Post-MVP)

- Swimlanes / multiple boards
- Assignee per task
- Notifications / reminders for due dates
- Export board as CSV or JSON
- Dark mode toggle
- Backend sync (REST API + database)
