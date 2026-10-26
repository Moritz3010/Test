/**
 * board.js — task data management and card rendering.
 * All persistence goes through storage.js — never calls supabase directly.
 */

import { loadTasks, insertTask, updateTask as dbUpdateTask, deleteTask as dbDeleteTask, reorderTasks } from './storage.js';
import { dragState } from './drag-state.js';

/** @type {import('./storage.js').Task[]} */
let tasks = [];

/** @type {function(string):void|null} */
let onDetailOpen = null;

/** @type {object} Active filters applied to rendering */
let activeFilters = {};

/** Register the function that opens the detail modal (set by ui.js before init). */
export function setDetailHandler(fn) {
  onDetailOpen = fn;
}

// ─── State ────────────────────────────────────────────────────────────────────

/** Load tasks from Supabase and render the board. */
export async function init() {
  tasks = await loadTasks();
  renderAll(activeFilters);
}

export function getTasks() {
  return tasks;
}

/** Update the active filter state and re-render. */
export function setFilters(filters) {
  activeFilters = filters;
  renderAll(activeFilters);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Create a new task and add it to the board.
 * @param {Partial<import('./storage.js').Task>} data
 */
export async function createTask(data) {
  const task = await insertTask({
    title:       data.title.trim(),
    description: (data.description || '').trim(),
    priority:    data.priority || 'Medium',
    dueDate:     data.dueDate  || '',
    label:       (data.label   || '').trim(),
    status:      data.status   || 'todo',
    sortOrder:   tasks.filter(t => t.status === (data.status || 'todo')).length,
    assigneeId:  data.assigneeId || null,
  });
  tasks.push(task);
  renderAll(activeFilters);
  return task;
}

/**
 * Update an existing task by id.
 * @param {string} id
 * @param {Partial<import('./storage.js').Task>} data
 */
export async function updateTask(id, data) {
  const idx  = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;

  const prev      = tasks[idx];
  const isNowDone = data.status === 'done';
  const wasntDone = prev.status !== 'done';

  const changes = {
    ...data,
    completedAt: isNowDone && wasntDone ? new Date().toISOString() : prev.completedAt,
  };

  const updated   = await dbUpdateTask(id, changes);
  tasks[idx]      = updated;
  renderAll(activeFilters);
}

/**
 * Delete a task by id.
 * @param {string} id
 */
export async function deleteTask(id) {
  await dbDeleteTask(id);
  tasks = tasks.filter(t => t.id !== id);
  renderAll(activeFilters);
}

/**
 * Move a task to an adjacent column.
 * @param {string} id
 * @param {'left'|'right'} direction
 */
export async function moveTask(id, direction) {
  const order = ['todo', 'doing', 'done'];
  const task  = tasks.find(t => t.id === id);
  if (!task) return;

  const currentIdx = order.indexOf(task.status);
  const nextIdx    = direction === 'right' ? currentIdx + 1 : currentIdx - 1;
  if (nextIdx < 0 || nextIdx >= order.length) return;

  await updateTask(id, { status: order[nextIdx] });
}

/**
 * Persist a reordered card list after a drag-and-drop operation.
 * @param {string} newStatus
 * @param {string[]} orderedIds
 */
export async function applyDragOrder(newStatus, orderedIds) {
  const updates = orderedIds.map((id, idx) => {
    const task = tasks.find(t => t.id === id);
    return { id, sort_order: idx, status: newStatus,
      completed_at: newStatus === 'done' && task && !task.completedAt
        ? new Date().toISOString() : (task?.completedAt ?? null),
    };
  });

  await reorderTasks(updates);

  // Patch local state to stay in sync without a full reload
  const otherTasks = tasks.filter(t => t.status !== newStatus);
  const reordered  = orderedIds
    .map((id, idx) => {
      const t = tasks.find(t => t.id === id);
      if (!t) return null;
      return { ...t, status: newStatus, sortOrder: idx,
        completedAt: newStatus === 'done' && !t.completedAt ? new Date().toISOString() : t.completedAt,
      };
    })
    .filter(Boolean);

  tasks = [...otherTasks, ...reordered];
  updateCounts();
}

// ─── Rendering ────────────────────────────────────────────────────────────────

const STATUS_ORDER = ['todo', 'doing', 'done'];

/**
 * Full re-render of all columns.
 * @param {object} [filters]
 * @param {string}   [filters.search]
 * @param {string[]} [filters.priorities]
 * @param {number|null} [filters.assigneeId]
 */
export function renderAll(filters = {}) {
  for (const status of STATUS_ORDER) {
    renderColumn(status, filters);
  }
  updateCounts();
}

function renderColumn(status, filters = {}) {
  const list = document.getElementById(`list-${status}`);
  if (!list) return;

  const { search = '', priorities = ['High', 'Medium', 'Low'], assigneeId = null } = filters;
  const q = search.toLowerCase();

  const filtered = tasks.filter(t => {
    if (t.status !== status) return false;
    if (!priorities.includes(t.priority)) return false;
    if (q && !t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    if (assigneeId !== null && t.assigneeId !== assigneeId) return false;
    return true;
  });

  list.innerHTML = '';

  if (filtered.length === 0) {
    const ph = document.createElement('p');
    ph.className   = 'empty-placeholder';
    ph.textContent = 'No tasks here yet';
    list.appendChild(ph);
    return;
  }

  for (const task of filtered) {
    list.appendChild(buildCard(task));
  }
}

function updateCounts() {
  for (const status of STATUS_ORDER) {
    const el = document.getElementById(`count-${status}`);
    if (el) el.textContent = tasks.filter(t => t.status === status).length;
  }
}

// ─── Card DOM builder ─────────────────────────────────────────────────────────

function buildCard(task) {
  const isOverdue = isTaskOverdue(task);
  const ORDER     = ['todo', 'doing', 'done'];
  const statusIdx = ORDER.indexOf(task.status);

  const card = document.createElement('article');
  card.className = `task-card${isOverdue ? ' overdue' : ''}`;
  card.dataset.id = task.id;
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', task.title);
  card.setAttribute('tabindex', '0');
  card.addEventListener('click', () => { if (!dragState.active() && onDetailOpen) onDetailOpen(task.id); });
  card.addEventListener('keydown', e => { if (e.key === 'Enter' && onDetailOpen) onDetailOpen(task.id); });

  // Header: title + priority badge
  const header = document.createElement('div');
  header.className = 'card-header';

  const titleEl = document.createElement('span');
  titleEl.className   = 'card-title';
  titleEl.textContent = task.title;

  const badge = document.createElement('span');
  badge.className   = `priority-badge ${task.priority}`;
  badge.textContent = task.priority;

  header.appendChild(titleEl);
  header.appendChild(badge);
  card.appendChild(header);

  // Description
  if (task.description) {
    const desc = document.createElement('p');
    desc.className   = 'card-description';
    desc.textContent = task.description;
    card.appendChild(desc);
  }

  // Meta: label + due date + assignee
  const meta = document.createElement('div');
  meta.className = 'card-meta';

  if (task.label) {
    const lbl = document.createElement('span');
    lbl.className   = 'card-label';
    lbl.textContent = task.label;
    meta.appendChild(lbl);
  }

  if (task.dueDate) {
    const due = document.createElement('span');
    due.className   = `card-due${isOverdue ? ' overdue' : ''}`;
    due.textContent = `Due ${formatDate(task.dueDate)}`;
    meta.appendChild(due);
  }

  if (task.assignee) {
    const assigneeEl = document.createElement('span');
    assigneeEl.className   = 'card-assignee';
    assigneeEl.textContent = task.assignee.nickname;
    assigneeEl.setAttribute('aria-label', `Assigned to ${task.assignee.nickname}`);
    meta.appendChild(assigneeEl);
  }

  if (meta.childElementCount > 0) card.appendChild(meta);

  // Actions: move buttons + edit button
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const moveBtns = document.createElement('div');
  moveBtns.className = 'card-move-btns';

  const btnLeft = document.createElement('button');
  btnLeft.className = 'btn-move';
  btnLeft.textContent = '←';
  btnLeft.setAttribute('aria-label', 'Move task to previous column');
  btnLeft.disabled = statusIdx === 0;
  btnLeft.addEventListener('click', e => {
    e.stopPropagation();
    moveTask(task.id, 'left');
  });

  const btnRight = document.createElement('button');
  btnRight.className = 'btn-move';
  btnRight.textContent = '→';
  btnRight.setAttribute('aria-label', 'Move task to next column');
  btnRight.disabled = statusIdx === ORDER.length - 1;
  btnRight.addEventListener('click', e => {
    e.stopPropagation();
    moveTask(task.id, 'right');
  });

  moveBtns.appendChild(btnLeft);
  moveBtns.appendChild(btnRight);
  actions.appendChild(moveBtns);

  const btnEdit = document.createElement('button');
  btnEdit.className   = 'btn-edit';
  btnEdit.textContent = 'Edit';
  btnEdit.setAttribute('aria-label', `Edit task: ${task.title}`);
  btnEdit.addEventListener('click', e => {
    e.stopPropagation();
    // Imported directly — no dynamic import() anti-pattern
    import('./ui.js').then(ui => ui.openEditModal(task.id));
  });

  actions.appendChild(btnEdit);
  card.appendChild(actions);

  return card;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTaskOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.dueDate) < today;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
