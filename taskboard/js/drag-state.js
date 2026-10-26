/**
 * drag-state.js — shared drag flag to avoid circular board ↔ ui imports
 */
let _dragging = false;
export const dragState = {
  start() { _dragging = true; },
  end()   { setTimeout(() => { _dragging = false; }, 0); },
  active() { return _dragging; },
};
