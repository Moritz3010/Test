/**
 * ui.js — event wiring, modals, search/filter, drag-and-drop.
 * Entry point: loaded as <script type="module"> from index.html.
 */

import {
  init, getTasks, createTask, updateTask, deleteTask,
  moveTask, renderAll, applyDragOrder, setDetailHandler, setFilters,
} from './board.js';
import { dragState } from './drag-state.js';
import {
  loadUsers, loadOrCreateUser, getLocalUserId, setLocalUserId, clearLocalUserId,
} from './storage.js';
import { toLocalISODate, getTodayISO, getMaxDateISO, clampDate, addDays } from './date-utils.js';

// ─── DOM references ───────────────────────────────────────────────────────────
const modal         = document.getElementById('task-modal');
const modalTitle    = document.getElementById('modal-title');
const taskForm      = document.getElementById('task-form');
const fieldId       = document.getElementById('field-id');
const fieldStatus   = document.getElementById('field-status');
const fieldTitle    = document.getElementById('field-title');
const fieldDesc     = document.getElementById('field-description');
const fieldPriority = document.getElementById('field-priority');
const fieldDueDate  = document.getElementById('field-due-date');
const fieldLabel    = document.getElementById('field-label');
const fieldAssignee = document.getElementById('field-assignee');
const dateShortcuts = document.querySelectorAll('.date-shortcut[data-offset]');
const dateClearBtn  = document.getElementById('date-clear-btn');
const errorTitle    = document.getElementById('error-title');
const deleteBtn     = document.getElementById('delete-task-btn');
const closeBtn      = document.getElementById('modal-close-btn');
const cancelBtn     = document.getElementById('cancel-btn');
const newTaskBtn    = document.getElementById('new-task-btn');
const searchInput   = document.getElementById('search-input');
const filterBtns    = document.querySelectorAll('.filter-btn');
const addColBtns    = document.querySelectorAll('.btn-add-col');

// Nickname picker
const pickerOverlay   = document.getElementById('nickname-picker');
const pickerInput     = document.getElementById('picker-nickname');
const pickerError     = document.getElementById('picker-error');
const pickerConfirm   = document.getElementById('picker-confirm');
const headerNickname  = document.getElementById('header-nickname');
const changeUserBtn   = document.getElementById('change-user-btn');

// Detail modal
const detailModal     = document.getElementById('detail-modal');
const detailTitle     = document.getElementById('detail-title');
const detailPriority  = document.getElementById('detail-priority');
const detailLabel     = document.getElementById('detail-label');
const detailAssignee  = document.getElementById('detail-assignee');
const detailDesc      = document.getElementById('detail-description');
const detailDue       = document.getElementById('detail-due');
const detailCreated   = document.getElementById('detail-created');
const detailCompleted = document.getElementById('detail-completed');
const detailEditBtn   = document.getElementById('detail-edit-btn');
const detailCloseBtn  = document.getElementById('detail-close-btn');

// ─── Filter state ─────────────────────────────────────────────────────────────
let activeFilters = {
  search:     '',
  priorities: ['High', 'Medium', 'Low'],
  assigneeId: null,
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────
setDetailHandler(openDetailModal);
bootstrap();

async function bootstrap() {
  const userId = getLocalUserId();
  if (userId) {
    showBoard();
    await init();
    initDragAndDrop();
  } else {
    showPicker();
  }
}

// ─── Nickname picker ──────────────────────────────────────────────────────────
function showPicker() {
  pickerOverlay.classList.remove('hidden');
  document.getElementById('board-wrapper').classList.add('hidden');
  pickerInput.focus();
}

function showBoard() {
  pickerOverlay.classList.add('hidden');
  document.getElementById('board-wrapper').classList.remove('hidden');

  const userId = getLocalUserId();
  if (userId) {
    // Restore nickname display from storage users list if available
    // The nickname will be filled in properly after loadUsers() runs
  }
}

pickerConfirm.addEventListener('click', async () => {
  const nickname = pickerInput.value.trim();
  if (!nickname) {
    pickerError.textContent = 'Please enter a nickname.';
    pickerError.classList.remove('hidden');
    return;
  }
  if (nickname.length > 50) {
    pickerError.textContent = 'Nickname must be 50 characters or fewer.';
    pickerError.classList.remove('hidden');
    return;
  }

  pickerConfirm.disabled = true;
  pickerError.classList.add('hidden');

  try {
    const user = await loadOrCreateUser(nickname);
    setLocalUserId(user.id);
    headerNickname.textContent = user.nickname;
    showBoard();
    await init();
    initDragAndDrop();
    await populateAssigneeFilter();
  } catch {
    pickerError.textContent = 'Could not connect to the server. Please try again.';
    pickerError.classList.remove('hidden');
  } finally {
    pickerConfirm.disabled = false;
  }
});

pickerInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') pickerConfirm.click();
});

changeUserBtn.addEventListener('click', () => {
  clearLocalUserId();
  headerNickname.textContent = '';
  activeFilters.assigneeId = null;
  pickerInput.value = '';
  pickerError.classList.add('hidden');
  showPicker();
});

// ─── Populate assignee filter in toolbar ──────────────────────────────────────
async function populateAssigneeFilter() {
  const users = await loadUsers();
  const container = document.getElementById('assignee-filters');
  if (!container) return;

  // Clear existing dynamic buttons (keep "All" button)
  container.querySelectorAll('.filter-btn[data-assignee-id]').forEach(b => b.remove());

  users.forEach(user => {
    const btn = document.createElement('button');
    btn.className   = 'filter-btn filter-btn--assignee';
    btn.textContent = user.nickname;
    btn.dataset.assigneeId = user.id;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      const currentId = activeFilters.assigneeId;
      const newId     = currentId === user.id ? null : user.id;

      // Update button states
      container.querySelectorAll('.filter-btn[data-assignee-id]').forEach(b => {
        const active = Number(b.dataset.assigneeId) === newId;
        b.setAttribute('aria-pressed', String(active));
        b.classList.toggle('active', active);
      });
      document.getElementById('assignee-filter-all')?.classList.toggle('active', newId === null);
      document.getElementById('assignee-filter-all')?.setAttribute('aria-pressed', String(newId === null));

      activeFilters.assigneeId = newId;
      setFilters(activeFilters);
    });
    container.appendChild(btn);
  });
}

document.getElementById('assignee-filter-all')?.addEventListener('click', function () {
  activeFilters.assigneeId = null;
  document.querySelectorAll('.filter-btn[data-assignee-id]').forEach(b => {
    b.setAttribute('aria-pressed', 'false');
    b.classList.remove('active');
  });
  this.classList.add('active');
  this.setAttribute('aria-pressed', 'true');
  setFilters(activeFilters);
});

// ─── Date shortcuts ───────────────────────────────────────────────────────────
// toLocalISODate, addDays, clampDate imported from date-utils.js

function setActiveShortcut(btn) {
  dateShortcuts.forEach(b => b.classList.remove('active'));
  dateClearBtn.classList.remove('active');
  if (btn) btn.classList.add('active');
}

dateShortcuts.forEach(btn => {
  btn.addEventListener('click', () => {
    const offset = parseInt(btn.dataset.offset, 10);
    const date   = new Date();
    date.setDate(date.getDate() + offset);
    fieldDueDate.value = toLocalISODate(date);
    setActiveShortcut(btn);
  });
});

dateClearBtn.addEventListener('click', () => {
  fieldDueDate.value = '';
  setActiveShortcut(null);
});

fieldDueDate.addEventListener('change', () => {
  setActiveShortcut(null);
  // Re-read min/max from the element — these are set dynamically on modal open
  fieldDueDate.value = clampDate(fieldDueDate.value, fieldDueDate.min, fieldDueDate.max);
});

// ─── Drag & Drop (SortableJS) ─────────────────────────────────────────────────
function initDragAndDrop() {
  document.querySelectorAll('.card-list').forEach(list => {
    Sortable.create(list, {
      group:      'board',
      animation:  150,
      ghostClass: 'sortable-ghost',
      dragClass:  'sortable-drag',
      onStart() { dragState.start(); },
      onEnd(evt) {
        dragState.end();
        const newStatus = evt.to.closest('.column').dataset.status;
        const ids = [...evt.to.querySelectorAll('.task-card')].map(c => c.dataset.id);
        applyDragOrder(newStatus, ids);
      },
    });
  });
}

// ─── New Task / Add Task buttons ──────────────────────────────────────────────
newTaskBtn.addEventListener('click', () => openCreateModal('todo'));
addColBtns.forEach(btn => {
  btn.addEventListener('click', () => openCreateModal(btn.dataset.status));
});

// ─── Search ───────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  activeFilters.search = searchInput.value;
  setFilters(activeFilters);
});

// ─── Priority filter toggles ──────────────────────────────────────────────────
filterBtns.forEach(btn => {
  if (!btn.dataset.priority) return; // skip non-priority buttons
  btn.addEventListener('click', () => {
    const p      = btn.dataset.priority;
    const pressed = btn.getAttribute('aria-pressed') === 'true';

    if (pressed) {
      if (activeFilters.priorities.length === 1) return;
      activeFilters.priorities = activeFilters.priorities.filter(x => x !== p);
      btn.setAttribute('aria-pressed', 'false');
      btn.classList.remove('active');
    } else {
      activeFilters.priorities.push(p);
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('active');
    }
    setFilters(activeFilters);
  });
});

// ─── Detail modal ─────────────────────────────────────────────────────────────
export function openDetailModal(id) {
  const task = getTasks().find(t => t.id === id);
  if (!task) return;

  detailTitle.textContent     = task.title;
  detailPriority.textContent  = task.priority;
  detailPriority.className    = `priority-badge ${task.priority}`;
  detailLabel.textContent     = task.label || '';
  detailAssignee.textContent  = task.assignee ? `Assigned to: ${task.assignee.nickname}` : '';
  detailDesc.textContent      = task.description || '';
  detailDue.textContent       = task.dueDate     ? `Due: ${formatDetailDate(task.dueDate)}` : '';
  detailCreated.textContent   = `Created: ${formatDetailDate(task.createdAt)}`;
  detailCompleted.textContent = task.completedAt ? `Completed: ${formatDetailDate(task.completedAt)}` : '';

  detailEditBtn.onclick = () => { hideDetailModal(); openEditModal(id); };
  detailModal.classList.remove('hidden');
}

function hideDetailModal() {
  detailModal.classList.add('hidden');
}

detailCloseBtn.addEventListener('click', hideDetailModal);
detailModal.addEventListener('click', e => { if (e.target === detailModal) hideDetailModal(); });

// ─── Task modal helpers ───────────────────────────────────────────────────────

/** Populate the assignee <select> with current users. */
async function populateAssigneeDropdown(selectedId = null) {
  if (!fieldAssignee) return;
  const users = await loadUsers();
  fieldAssignee.innerHTML = '';

  const emptyOpt = document.createElement('option');
  emptyOpt.value       = '';
  emptyOpt.textContent = 'Unassigned';
  fieldAssignee.appendChild(emptyOpt);

  users.forEach(user => {
    const opt = document.createElement('option');
    opt.value       = user.id;
    opt.textContent = user.nickname;
    if (user.id === selectedId) opt.selected = true;
    fieldAssignee.appendChild(opt);
  });
}

/** Open the modal in "create" mode. */
export async function openCreateModal(status = 'todo') {
  modalTitle.textContent  = 'New Task';
  fieldId.value           = '';
  fieldStatus.value       = status;
  fieldTitle.value        = '';
  fieldDesc.value         = '';
  fieldPriority.value     = 'Medium';
  fieldDueDate.min        = getTodayISO();
  fieldDueDate.max        = getMaxDateISO();
  fieldDueDate.value      = '';
  fieldLabel.value        = '';
  errorTitle.classList.add('hidden');
  fieldTitle.classList.remove('error');
  deleteBtn.classList.add('hidden');
  setActiveShortcut(null);
  await populateAssigneeDropdown(null);
  showModal();
}

/** Open the modal in "edit" mode for an existing task. */
export async function openEditModal(id) {
  const task = getTasks().find(t => t.id === id);
  if (!task) return;

  modalTitle.textContent  = 'Edit Task';
  fieldId.value           = task.id;
  fieldStatus.value       = task.status;
  fieldTitle.value        = task.title;
  fieldDesc.value         = task.description;
  fieldPriority.value     = task.priority;
  fieldDueDate.min        = getTodayISO();
  fieldDueDate.max        = getMaxDateISO();
  // If existing due date is out of the new window, clamp it
  fieldDueDate.value      = clampDate(task.dueDate, fieldDueDate.min, fieldDueDate.max);
  fieldLabel.value        = task.label;
  errorTitle.classList.add('hidden');
  fieldTitle.classList.remove('error');
  deleteBtn.classList.remove('hidden');
  setActiveShortcut(null);
  await populateAssigneeDropdown(task.assigneeId);
  showModal();
}

/** Called by move arrow buttons on cards (exported for board.js). */
export function onMoveCard(id, direction) {
  moveTask(id, direction);
}

function showModal() {
  modal.classList.remove('hidden');
  fieldTitle.focus();
}

function hideModal() {
  modal.classList.add('hidden');
}

// ─── Unified Escape key handler ───────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!modal.classList.contains('hidden'))       { hideModal();       return; }
  if (!detailModal.classList.contains('hidden')) { hideDetailModal(); return; }
});

// ─── Modal close buttons ──────────────────────────────────────────────────────
closeBtn.addEventListener('click',  hideModal);
cancelBtn.addEventListener('click', hideModal);
modal.addEventListener('click', e => { if (e.target === modal) hideModal(); });

// ─── Form submit ──────────────────────────────────────────────────────────────
taskForm.addEventListener('submit', async e => {
  e.preventDefault();

  const title = fieldTitle.value.trim();
  if (!title) {
    fieldTitle.classList.add('error');
    errorTitle.classList.remove('hidden');
    fieldTitle.focus();
    return;
  }

  fieldTitle.classList.remove('error');
  errorTitle.classList.add('hidden');

  const data = {
    title,
    description: fieldDesc.value,
    priority:    fieldPriority.value,
    dueDate:     fieldDueDate.value,
    label:       fieldLabel.value,
    status:      fieldStatus.value,
    assigneeId:  fieldAssignee?.value ? Number(fieldAssignee.value) : null,
  };

  if (fieldId.value) {
    await updateTask(fieldId.value, data);
  } else {
    await createTask(data);
  }

  hideModal();
});

// ─── Delete button ────────────────────────────────────────────────────────────
deleteBtn.addEventListener('click', async () => {
  const id = fieldId.value;
  if (!id) return;
  if (confirm('Delete this task? This cannot be undone.')) {
    await deleteTask(id);
    hideModal();
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDetailDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
