# Taskboard — Quality Assurance Guidelines

> This document defines the guardrails, testing checklists, coding standards, and review rules
> that every contributor must follow before merging any change into this project.

---

## 1. Core Principles

| # | Principle | What it means in practice |
|---|-----------|--------------------------|
| 1 | **No regressions** | Every existing feature must still work after a change |
| 2 | **Minimal footprint** | Only change what the task requires — no opportunistic refactors |
| 3 | **User data is sacred** | Never write code that can silently discard `localStorage` data |
| 4 | **Fail visibly** | Errors must surface to the user or console — never swallowed silently |
| 5 | **Accessibility first** | Every interactive element must be keyboard-reachable and labelled |

---

## 2. File & Module Guardrails

### 2.1 Module responsibilities — do not cross these boundaries

| File | Owns | Must NOT |
|------|------|---------|
| `storage.js` | Read/write `localStorage`; define the `Task` typedef | Touch the DOM; contain business logic |
| `board.js` | Task CRUD; card DOM rendering; column rendering | Read `localStorage` directly; wire UI events |
| `ui.js` | Event listeners; modal open/close; filter state | Contain task data logic; write to `localStorage` |
| `drag-state.js` | Shared drag flag only | Import from any other module |
| `index.html` | Static markup and CDN script tags | Contain inline JavaScript (`<script>` blocks with logic) |
| `style.css` | All visual styling | Hardcode colours outside `:root` CSS variables |

### 2.2 Import rules

- `drag-state.js` must remain a leaf module — **no imports**.
- `storage.js` must remain a leaf module — **no imports from project files**.
- Circular imports between `board.js` and `ui.js` are **forbidden**. If shared state is needed, create a new leaf module (as was done with `drag-state.js`).

---

## 3. Data Model Guardrails

Every task object stored in `localStorage` under key `taskboard_v1` must conform to the `Task` typedef in [`storage.js`](taskboard/js/storage.js):

```
{
  id:          string   — crypto.randomUUID(), never Date.now() or Math.random()
  title:       string   — required, trimmed, non-empty
  description: string   — optional, trimmed, may be ''
  priority:    'High' | 'Medium' | 'Low'
  dueDate:     string   — 'YYYY-MM-DD' or ''
  label:       string   — optional, trimmed, may be ''
  status:      'todo' | 'doing' | 'done'
  createdAt:   string   — ISO 8601 datetime, set once on creation
  completedAt: string | null — ISO 8601 datetime or null
}
```

**Guardrails:**
- `id` must be generated with `crypto.randomUUID()` — no other method is acceptable.
- `title` must be validated non-empty before any `createTask` or `updateTask` call.
- `status` must be one of the three allowed values — no freeform strings.
- `dueDate` must be `''` (not `null`, not `undefined`) when absent.
- `completedAt` must be set automatically when `status` transitions to `'done'`, and must never be overwritten once set.
- Any code reading tasks from `localStorage` must wrap `JSON.parse` in a `try/catch` and return `[]` on failure.

---

## 4. Security Guardrails

### 4.1 XSS prevention — non-negotiable

- **Never** use `element.innerHTML = userValue` where `userValue` comes from task data.
- **Always** use `element.textContent = userValue` for any user-supplied string.
- This applies to: title, description, label, and any future field added to the task model.
- The `Content-Security-Policy` meta tag in `index.html` must not be removed or weakened.

### 4.2 Input validation

| Field | Rule |
|-------|------|
| Title | Required; non-empty after `.trim()` |
| Description | Optional; no length limit enforced in UI, but rendered via `textContent` |
| Priority | Must be one of the enum values; enforced via `<select>` options only |
| Due date | Must match `YYYY-MM-DD`; year clamped to `2000–2099` by `min`/`max` attributes and the `change` handler |
| Label | Optional; no special characters forbidden, but rendered via `textContent` |

### 4.3 Storage safety

- All `localStorage.setItem` calls must be wrapped in `try/catch`.
- A `QuotaExceededError` must be caught and surfaced to the user with a meaningful message.
- Data must never be written to `localStorage` in partial/incomplete state — build the full object first, then call `saveTasks`.

---

## 5. Manual Test Checklist

Run this checklist in Chrome and Firefox before every release.

### 5.1 Board layout
- [ ] Three columns (To Do, Doing, Done) display side-by-side horizontally
- [ ] Each column header shows the correct task count
- [ ] Columns scroll horizontally on narrow viewports rather than stacking
- [ ] Empty columns show the "No tasks here yet" placeholder

### 5.2 Creating a task
- [ ] "New Task" button opens the modal defaulting to To Do
- [ ] "+ Add Task" buttons in each column open the modal pre-set to that column's status
- [ ] Submitting with an empty title shows the validation error and does not create a task
- [ ] Submitting with a valid title creates the card in the correct column
- [ ] Card appears with correct title, priority badge colour, label, and due date
- [ ] `createdAt` timestamp is set (visible in detail view)

### 5.3 Due date shortcuts
- [ ] "Today" sets today's date in local timezone
- [ ] "Tomorrow" sets tomorrow's date
- [ ] "Next week" sets a date 7 days from today
- [ ] "Clear" empties the date field
- [ ] Typing a year beyond 2099 clamps to 2099-12-31
- [ ] Typing a year before 2000 clamps to 2000-01-01
- [ ] Active shortcut pill is highlighted blue; deselects when a custom date is typed

### 5.4 Editing a task
- [ ] Clicking a card opens the detail modal (not the edit modal)
- [ ] Edit button in detail modal opens the edit modal pre-filled with correct data
- [ ] Saving changes updates the card in place without duplicating it
- [ ] Cancelling discards changes

### 5.5 Deleting a task
- [ ] Delete button in edit modal shows a confirmation prompt
- [ ] Confirming removes the card and updates the column count
- [ ] Cancelling the prompt leaves the task intact

### 5.6 Moving tasks
- [ ] Left arrow moves a card one column to the left
- [ ] Right arrow moves a card one column to the right
- [ ] Left arrow is disabled on cards in "To Do"
- [ ] Right arrow is disabled on cards in "Done"
- [ ] Moving a task to "Done" sets `completedAt` (visible in detail view)
- [ ] Moving a task back from "Done" does not overwrite `completedAt`

### 5.7 Drag and drop
- [ ] Cards can be dragged within the same column to reorder
- [ ] Cards can be dragged across columns
- [ ] Dragging to "Done" sets `completedAt`
- [ ] Dropping a card does NOT open the detail modal
- [ ] Ghost and drag CSS classes apply correctly during drag

### 5.8 Search and filters
- [ ] Typing in the search bar filters cards live across all columns
- [ ] Clearing the search bar restores all cards
- [ ] Priority filter buttons toggle on/off; cards filtered correctly
- [ ] At least one priority filter remains active at all times (last one cannot be deselected)

### 5.9 Persistence
- [ ] Refreshing the page restores all tasks exactly as left
- [ ] Tasks survive closing and reopening the browser tab
- [ ] Corrupting `localStorage` manually (e.g. set to `"bad json"`) results in an empty board, not a crash

### 5.10 Overdue highlighting
- [ ] A card with a past due date (not in Done) shows a red left border
- [ ] A card in Done with a past due date does NOT show the overdue border
- [ ] A card with no due date shows no overdue styling

### 5.11 Accessibility
- [ ] All buttons have visible labels (`aria-label` or visible text)
- [ ] Cards are focusable via Tab and openable via Enter
- [ ] Modal traps focus correctly (or at minimum, Escape closes it)
- [ ] Priority filter buttons update `aria-pressed` correctly

---

## 6. Coding Standards

### 6.1 JavaScript
- Use **ES2020+** syntax (optional chaining `?.`, nullish coalescing `??`, `crypto.randomUUID()`)
- Use **ES modules** (`import`/`export`) — no `<script>` blocks with inline logic in HTML
- No `var` — use `const` by default, `let` only when reassignment is required
- Function and variable names: `camelCase`
- Exported functions: documented with a JSDoc comment stating purpose and params
- No `console.log` in committed code — use `console.warn` / `console.error` for genuine error paths only

### 6.2 CSS
- All colours must reference a `--css-variable` from `:root` — no hardcoded hex values outside that block
- No `!important` except `.hidden { display: none !important }` (already established)
- Class names: `kebab-case`
- New layout additions must not break the three-column horizontal grid

### 6.3 HTML
- Every `<input>`, `<select>`, and `<textarea>` must have an associated `<label>` (via `for`/`id`)
- Every `<button>` must have either visible text or an `aria-label`
- No inline `style=""` attributes
- No inline `onclick=""` or other event handler attributes — wire everything in JS

---

## 7. Change Review Rules

Before any change is merged:

1. **Run the full manual test checklist** (§5) — all items must pass.
2. **Verify no new `innerHTML` assignments** with user-supplied data have been introduced.
3. **Verify no new direct `localStorage` calls** outside `storage.js`.
4. **Verify no circular imports** have been introduced.
5. **Update `CHANGELOG.md`** with a new entry describing what changed.
6. **Check the browser console** — no errors or warnings on page load and during normal use.

---

## 8. Known Limitations (Accepted Risks)

These are documented risks that are **intentionally not fixed** in the current MVP scope:

| Risk | Reason accepted | Mitigation |
|------|----------------|------------|
| `localStorage` is per-browser/device | MVP is single-user | Document clearly; plan backend for v2 |
| No automated test suite | Static MVP, no build step | Manual checklist (§5) substitutes |
| Native date picker UX varies by browser | OS-level control | `min`/`max` + shortcut buttons reduce friction |
| SortableJS loaded from CDN | Adds external dependency | Pin to a specific version (`@1.15.2`) |
| No data export | MVP scope | Planned for post-MVP (see `REQUIREMENTS.md`) |

---

## 9. Future QA Work (Post-MVP)

- Introduce an automated test runner (Vitest or Jest) with unit tests for `storage.js` and `board.js`
- Add end-to-end tests (Playwright) covering the manual checklist scenarios
- Set up a CI pipeline (GitHub Actions) to run tests on every pull request
- Add a linter (ESLint) and formatter (Prettier) with pre-commit hooks
- Add `localStorage` quota usage indicator in the UI
