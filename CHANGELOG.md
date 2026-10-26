# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
