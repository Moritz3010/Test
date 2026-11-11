/**
 * date-utils.test.js — test suite for date-utils.js
 * Run with: node taskboard/js/date-utils.test.js
 * No test framework required — uses Node.js built-ins only.
 */

// ─── Node.js ESM import shim ──────────────────────────────────────────────────
// We use a dynamic import so this file can be run directly with node.
const { addDays, toLocalISODate, getTodayISO, getMaxDateISO, clampDate } =
  await import('./date-utils.js');

// ─── Tiny test harness ────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓  ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${description}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg ?? 'assertion failed'}\n     expected: ${JSON.stringify(expected)}\n     received: ${JSON.stringify(actual)}`
    );
  }
}

// ─── toLocalISODate ───────────────────────────────────────────────────────────
console.log('\ntoLocalISODate');

test('formats a known date correctly', () => {
  const d = new Date(2026, 0, 5); // Jan 5 2026 local time
  assertEqual(toLocalISODate(d), '2026-01-05');
});

test('zero-pads single-digit month', () => {
  const d = new Date(2026, 2, 15); // March 15
  assertEqual(toLocalISODate(d), '2026-03-15');
});

test('zero-pads single-digit day', () => {
  const d = new Date(2026, 10, 5); // Nov 5
  assertEqual(toLocalISODate(d), '2026-11-05');
});

test('zero-pads both month and day', () => {
  const d = new Date(2026, 0, 1); // Jan 1
  assertEqual(toLocalISODate(d), '2026-01-01');
});

test('handles end of year correctly', () => {
  const d = new Date(2026, 11, 31); // Dec 31
  assertEqual(toLocalISODate(d), '2026-12-31');
});

// ─── addDays ──────────────────────────────────────────────────────────────────
console.log('\naddDays');

test('+0 days returns same date', () => {
  const d = new Date(2026, 5, 15); // Jun 15
  assertEqual(toLocalISODate(addDays(d, 0)), '2026-06-15');
});

test('+1 day returns next day', () => {
  const d = new Date(2026, 5, 15);
  assertEqual(toLocalISODate(addDays(d, 1)), '2026-06-16');
});

test('+7 days returns next week', () => {
  const d = new Date(2026, 5, 15);
  assertEqual(toLocalISODate(addDays(d, 7)), '2026-06-22');
});

test('crosses month boundary (Jan 31 + 1 = Feb 1)', () => {
  const d = new Date(2026, 0, 31); // Jan 31
  assertEqual(toLocalISODate(addDays(d, 1)), '2026-02-01');
});

test('crosses year boundary (Dec 31 + 1 = Jan 1 next year)', () => {
  const d = new Date(2025, 11, 31); // Dec 31 2025
  assertEqual(toLocalISODate(addDays(d, 1)), '2026-01-01');
});

test('crosses leap day (Feb 28 2024 + 1 = Feb 29 2024)', () => {
  const d = new Date(2024, 1, 28); // Feb 28 2024 (leap year)
  assertEqual(toLocalISODate(addDays(d, 1)), '2024-02-29');
});

test('skips leap day on non-leap year (Feb 28 2026 + 1 = Mar 1)', () => {
  const d = new Date(2026, 1, 28); // Feb 28 2026 (not a leap year)
  assertEqual(toLocalISODate(addDays(d, 1)), '2026-03-01');
});

test('does not mutate the input date', () => {
  const d = new Date(2026, 5, 15);
  addDays(d, 10);
  assertEqual(toLocalISODate(d), '2026-06-15', 'original date should be unchanged');
});

// ─── getTodayISO ──────────────────────────────────────────────────────────────
console.log('\ngetTodayISO');

test('returns a string matching YYYY-MM-DD format', () => {
  const result = getTodayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new Error(`Expected YYYY-MM-DD format, got: ${result}`);
  }
});

test('matches toLocalISODate(new Date())', () => {
  // Both calls happen within the same millisecond — safe to compare
  assertEqual(getTodayISO(), toLocalISODate(new Date()));
});

// ─── getMaxDateISO ────────────────────────────────────────────────────────────
console.log('\ngetMaxDateISO');

test('returns a string matching YYYY-MM-DD format', () => {
  const result = getMaxDateISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new Error(`Expected YYYY-MM-DD format, got: ${result}`);
  }
});

test('is strictly greater than today', () => {
  const today = getTodayISO();
  const max   = getMaxDateISO();
  if (max <= today) {
    throw new Error(`Max date ${max} should be after today ${today}`);
  }
});

test('is exactly 365 days from today', () => {
  const expected = toLocalISODate(addDays(new Date(), 365));
  assertEqual(getMaxDateISO(), expected);
});

// ─── clampDate ────────────────────────────────────────────────────────────────
console.log('\nclampDate');

test('empty string returns empty string', () => {
  assertEqual(clampDate('', '2026-01-01', '2026-12-31'), '');
});

test('value within range is returned unchanged', () => {
  assertEqual(clampDate('2026-06-15', '2026-01-01', '2026-12-31'), '2026-06-15');
});

test('value equal to min is returned unchanged', () => {
  assertEqual(clampDate('2026-01-01', '2026-01-01', '2026-12-31'), '2026-01-01');
});

test('value equal to max is returned unchanged', () => {
  assertEqual(clampDate('2026-12-31', '2026-01-01', '2026-12-31'), '2026-12-31');
});

test('value before min is clamped to min', () => {
  assertEqual(clampDate('2025-12-31', '2026-01-01', '2026-12-31'), '2026-01-01');
});

test('value after max is clamped to max', () => {
  assertEqual(clampDate('2027-01-01', '2026-01-01', '2026-12-31'), '2026-12-31');
});

test('value far before min is clamped to min', () => {
  assertEqual(clampDate('2000-01-01', '2026-11-05', '2027-11-05'), '2026-11-05');
});

test('value far after max is clamped to max', () => {
  assertEqual(clampDate('2099-12-31', '2026-11-05', '2027-11-05'), '2027-11-05');
});

// ─── Integration: dynamic min/max window ──────────────────────────────────────
console.log('\nIntegration: today → today+365 window');

test('today is within the allowed window', () => {
  const today = getTodayISO();
  const max   = getMaxDateISO();
  assertEqual(clampDate(today, today, max), today);
});

test('yesterday is clamped to today', () => {
  const yesterday = toLocalISODate(addDays(new Date(), -1));
  const today     = getTodayISO();
  const max       = getMaxDateISO();
  assertEqual(clampDate(yesterday, today, max), today);
});

test('tomorrow is within the allowed window', () => {
  const tomorrow = toLocalISODate(addDays(new Date(), 1));
  const today    = getTodayISO();
  const max      = getMaxDateISO();
  assertEqual(clampDate(tomorrow, today, max), tomorrow);
});

test('today+365 is within the allowed window (boundary)', () => {
  const today = getTodayISO();
  const max   = getMaxDateISO();
  assertEqual(clampDate(max, today, max), max);
});

test('today+366 is clamped to today+365', () => {
  const tooFar = toLocalISODate(addDays(new Date(), 366));
  const today  = getTodayISO();
  const max    = getMaxDateISO();
  assertEqual(clampDate(tooFar, today, max), max);
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log(`${'─'.repeat(40)}\n`);

if (failed > 0) process.exit(1);
