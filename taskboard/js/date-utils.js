/**
 * date-utils.js — pure date helper functions.
 * No DOM access, no side effects. Fully testable with Node.js.
 */

/**
 * Returns a new Date offset by n days from the given date.
 * Does not mutate the input.
 * @param {Date} date
 * @param {number} n - number of days to add (may be negative)
 * @returns {Date}
 */
export function addDays(date, n) {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

/**
 * Converts a Date to a local-timezone ISO date string (YYYY-MM-DD).
 * Required for <input type="date"> which uses the local timezone, not UTC.
 * @param {Date} date
 * @returns {string} e.g. '2026-11-05'
 */
export function toLocalISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns today's date as a YYYY-MM-DD string in the local timezone.
 * @returns {string}
 */
export function getTodayISO() {
  return toLocalISODate(new Date());
}

/**
 * Returns the date 365 days from today as a YYYY-MM-DD string.
 * @returns {string}
 */
export function getMaxDateISO() {
  return toLocalISODate(addDays(new Date(), 365));
}

/**
 * Clamps a YYYY-MM-DD date string to [min, max].
 * Returns '' unchanged if the value is empty.
 * ISO date strings compare lexicographically in the same order as chronologically,
 * so plain string comparison is correct and safe here.
 * @param {string} value - the date string to clamp
 * @param {string} min   - lower bound (YYYY-MM-DD)
 * @param {string} max   - upper bound (YYYY-MM-DD)
 * @returns {string}
 */
export function clampDate(value, min, max) {
  if (!value) return '';
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
