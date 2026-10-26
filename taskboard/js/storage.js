/**
 * storage.js — Supabase persistence layer.
 * All database access goes through this module — no other file calls supabase directly.
 * Mirrors the same function signatures as the old localStorage version so board.js
 * requires minimal changes.
 */

import { supabase } from './supabase-client.js';

// ─── Local user state (nickname stored in localStorage, not the DB) ───────────
const USER_KEY = 'taskboard_user_id';

export function getLocalUserId() {
  return localStorage.getItem(USER_KEY);
}

export function setLocalUserId(id) {
  localStorage.setItem(USER_KEY, String(id));
}

export function clearLocalUserId() {
  localStorage.removeItem(USER_KEY);
}

/**
 * Upsert a user by nickname. Returns the user record.
 * If the nickname already exists, returns the existing record.
 * @param {string} nickname
 * @returns {Promise<{id: number, nickname: string}>}
 */
export async function loadOrCreateUser(nickname) {
  const trimmed = nickname.trim();
  // Try insert; if it conflicts on unique nickname, select the existing row
  const { error: insertErr } = await supabase
    .from('users')
    .insert({ nickname: trimmed })
    .select()
    .maybeSingle();

  // Conflict (duplicate nickname) is not an error we want to surface
  if (insertErr && insertErr.code !== '23505') {
    console.error('Taskboard: failed to create user', insertErr);
    throw insertErr;
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, nickname')
    .eq('nickname', trimmed)
    .single();

  if (error) {
    console.error('Taskboard: failed to load user', error);
    throw error;
  }
  return data;
}

/**
 * Load all users (for assignee dropdown).
 * @returns {Promise<Array<{id: number, nickname: string}>>}
 */
export async function loadUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, nickname')
    .order('nickname');

  if (error) {
    console.error('Taskboard: failed to load users', error);
    return [];
  }
  return data ?? [];
}

// ─── Task operations ──────────────────────────────────────────────────────────

/**
 * Load all tasks from Supabase, with nested assignee nickname.
 * Returns tasks mapped to camelCase to match the existing Task typedef.
 * @returns {Promise<Task[]>}
 */
export async function loadTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, users(nickname)')
    .order('sort_order')
    .order('created_at');

  if (error) {
    console.error('Taskboard: failed to load tasks', error);
    return [];
  }
  return (data ?? []).map(dbToTask);
}

/**
 * Insert a new task into Supabase.
 * @param {Partial<Task>} task — must include at least title and status
 * @returns {Promise<Task>}
 */
export async function insertTask(task) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskToDb(task))
    .select('*, users(nickname)')
    .single();

  if (error) {
    console.error('Taskboard: failed to insert task', error);
    throw error;
  }
  return dbToTask(data);
}

/**
 * Update an existing task in Supabase.
 * @param {string} id
 * @param {Partial<Task>} changes
 * @returns {Promise<Task>}
 */
export async function updateTask(id, changes) {
  const { data, error } = await supabase
    .from('tasks')
    .update(taskToDb(changes))
    .eq('id', id)
    .select('*, users(nickname)')
    .single();

  if (error) {
    console.error('Taskboard: failed to update task', error);
    throw error;
  }
  return dbToTask(data);
}

/**
 * Delete a task from Supabase.
 * @param {string} id
 */
export async function deleteTask(id) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Taskboard: failed to delete task', error);
    throw error;
  }
}

/**
 * Bulk-update sort_order for a list of tasks after drag-and-drop.
 * @param {Array<{id: string, sort_order: number, status: string}>} updates
 */
export async function reorderTasks(updates) {
  const { error } = await supabase
    .from('tasks')
    .upsert(updates, { onConflict: 'id' });

  if (error) {
    console.error('Taskboard: failed to reorder tasks', error);
    throw error;
  }
}

// ─── Field mapping: DB (snake_case) ↔ App (camelCase) ────────────────────────

/**
 * Map a Supabase row to the app's Task shape.
 * @param {object} row
 * @returns {Task}
 */
function dbToTask(row) {
  return {
    id:          row.id,
    title:       row.title,
    description: row.description ?? '',
    priority:    row.priority ?? 'Medium',
    dueDate:     row.due_date ?? '',
    label:       row.label ?? '',
    status:      row.status ?? 'todo',
    sortOrder:   row.sort_order ?? 0,
    createdAt:   row.created_at,
    completedAt: row.completed_at ?? null,
    assigneeId:  row.assignee_id ?? null,
    assignee:    row.users ? { id: row.assignee_id, nickname: row.users.nickname } : null,
  };
}

/**
 * Map app Task fields to DB column names for insert/update.
 * Only includes fields that are explicitly provided.
 * @param {Partial<Task>} task
 * @returns {object}
 */
function taskToDb(task) {
  const row = {};
  if (task.title       !== undefined) row.title        = task.title.trim();
  if (task.description !== undefined) row.description  = task.description.trim() || null;
  if (task.priority    !== undefined) row.priority     = task.priority;
  if (task.dueDate     !== undefined) row.due_date     = task.dueDate || null;
  if (task.label       !== undefined) row.label        = task.label.trim() || null;
  if (task.status      !== undefined) row.status       = task.status;
  if (task.sortOrder   !== undefined) row.sort_order   = task.sortOrder;
  if (task.assigneeId  !== undefined) row.assignee_id  = task.assigneeId || null;
  if (task.completedAt !== undefined) row.completed_at = task.completedAt;
  return row;
}

/**
 * @typedef {Object} Task
 * @property {string}   id
 * @property {string}   title
 * @property {string}   description
 * @property {'High'|'Medium'|'Low'} priority
 * @property {string}   dueDate        — 'YYYY-MM-DD' or ''
 * @property {string}   label
 * @property {'todo'|'doing'|'done'} status
 * @property {number}   sortOrder
 * @property {string}   createdAt      — ISO 8601
 * @property {string|null} completedAt
 * @property {number|null} assigneeId
 * @property {{id:number, nickname:string}|null} assignee
 */
