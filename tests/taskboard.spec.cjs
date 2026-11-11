// @ts-check
const { test, expect } = require('@playwright/test');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Bypass the Supabase calls by injecting localStorage with a fake user ID
 * and intercepting all Supabase API requests so tests run fully offline.
 */
async function mockSupabase(page) {
  // Set a fake user ID so the nickname picker is skipped
  await page.addInitScript(() => {
    localStorage.setItem('taskboard_user_id', '1');
  });

  // Intercept all Supabase REST API calls and return minimal valid responses
  await page.route('**/rest/v1/tasks**', async route => {
    const method = route.request().method();

    // Helper: parse request body if JSON, fall back to empty object
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch {}

    // Build a task that echoes back whatever was sent so assertions can match
    const makeTask = (overrides = {}) => ({
      id: 'test-uuid-1',
      title: body.title ?? 'Mock Task',
      description: body.description ?? '',
      priority: body.priority ?? 'Medium',
      due_date: body.due_date ?? null,
      label: body.label ?? null,
      status: body.status ?? 'todo',
      sort_order: body.sort_order ?? 0,
      created_at: new Date().toISOString(),
      completed_at: null,
      assignee_id: null,
      users: null,
      ...overrides,
    });

    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    } else if (method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: { 'Content-Range': '*/1' },
        body: JSON.stringify(makeTask()),
      });
    } else if (method === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeTask()) });
    } else {
      await route.fulfill({ status: 204, body: '' });
    }
  });

  await page.route('**/rest/v1/users**', async route => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 1, nickname: 'Alice' }]),
    });
  });
}

// ─── 1. Nickname Picker ────────────────────────────────────────────────────────

test.describe('Nickname Picker', () => {
  test('shows the picker on first visit (no localStorage)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#nickname-picker')).toBeVisible();
    await expect(page.locator('#board-wrapper')).toBeHidden();
    await page.screenshot({ path: 'tests/screenshots/picker-initial.png', fullPage: true });
  });

  test('shows an error when confirming with an empty nickname', async ({ page }) => {
    await page.goto('/');
    await page.click('#picker-confirm');
    await expect(page.locator('#picker-error')).toBeVisible();
    await expect(page.locator('#picker-error')).toContainText('nickname');
    await page.screenshot({ path: 'tests/screenshots/picker-empty-error.png', fullPage: true });
  });

  test('picker input accepts text', async ({ page }) => {
    await page.goto('/');
    await page.fill('#picker-nickname', 'Alice');
    await expect(page.locator('#picker-nickname')).toHaveValue('Alice');
    await page.screenshot({ path: 'tests/screenshots/picker-filled.png', fullPage: true });
  });
});

// ─── 2. Board Layout ──────────────────────────────────────────────────────────

test.describe('Board Layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await page.waitForSelector('#board-wrapper:not(.hidden)', { timeout: 5000 });
  });

  test('board is visible with three columns side by side', async ({ page }) => {
    await expect(page.locator('.board')).toBeVisible();
    await expect(page.locator('#col-todo')).toBeVisible();
    await expect(page.locator('#col-doing')).toBeVisible();
    await expect(page.locator('#col-done')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/board-layout.png', fullPage: true });
  });

  test('columns are horizontally aligned (not stacked)', async ({ page }) => {
    const todo  = await page.locator('#col-todo').boundingBox();
    const doing = await page.locator('#col-doing').boundingBox();
    const done  = await page.locator('#col-done').boundingBox();

    // All three columns should be on the same vertical row (tops within 10px of each other)
    expect(Math.abs(todo.y - doing.y)).toBeLessThan(10);
    expect(Math.abs(doing.y - done.y)).toBeLessThan(10);

    // Each column should be to the right of the previous one
    expect(doing.x).toBeGreaterThan(todo.x + todo.width - 5);
    expect(done.x).toBeGreaterThan(doing.x + doing.width - 5);

    await page.screenshot({ path: 'tests/screenshots/board-columns-horizontal.png', fullPage: true });
  });

  test('all three column headers are visible', async ({ page }) => {
    await expect(page.locator('#col-todo  .column-title')).toContainText('To Do');
    await expect(page.locator('#col-doing .column-title')).toContainText('Doing');
    await expect(page.locator('#col-done  .column-title')).toContainText('Done');
    await page.screenshot({ path: 'tests/screenshots/board-column-headers.png', fullPage: true });
  });

  test('empty columns show the placeholder message', async ({ page }) => {
    const placeholders = page.locator('.empty-placeholder');
    await expect(placeholders).toHaveCount(3);
    await expect(placeholders.first()).toContainText('No tasks here yet');
    await page.screenshot({ path: 'tests/screenshots/board-empty-placeholders.png', fullPage: true });
  });

  test('header shows search, priority filters, and new task button', async ({ page }) => {
    await expect(page.locator('#search-input')).toBeVisible();
    await expect(page.locator('[data-priority="High"]')).toBeVisible();
    await expect(page.locator('[data-priority="Medium"]')).toBeVisible();
    await expect(page.locator('[data-priority="Low"]')).toBeVisible();
    await expect(page.locator('#new-task-btn')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/board-header.png', fullPage: true });
  });
});

// ─── 3. Task Modal ────────────────────────────────────────────────────────────

test.describe('Task Modal', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await page.waitForSelector('#board-wrapper:not(.hidden)', { timeout: 5000 });
    await page.click('#new-task-btn');
    await page.waitForSelector('#task-modal:not(.hidden)');
  });

  test('modal opens when New Task is clicked', async ({ page }) => {
    await expect(page.locator('#task-modal')).toBeVisible();
    await expect(page.locator('#modal-title')).toContainText('New Task');
    await page.screenshot({ path: 'tests/screenshots/modal-open.png', fullPage: true });
  });

  test('modal closes on Cancel', async ({ page }) => {
    await page.click('#cancel-btn');
    await expect(page.locator('#task-modal')).toBeHidden();
    await page.screenshot({ path: 'tests/screenshots/modal-closed-cancel.png', fullPage: true });
  });

  test('modal closes on Escape key', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('#task-modal')).toBeHidden();
    await page.screenshot({ path: 'tests/screenshots/modal-closed-escape.png', fullPage: true });
  });

  test('modal closes on backdrop click', async ({ page }) => {
    await page.mouse.click(10, 10); // click outside modal
    await expect(page.locator('#task-modal')).toBeHidden();
    await page.screenshot({ path: 'tests/screenshots/modal-closed-backdrop.png', fullPage: true });
  });

  test('submitting with empty title shows validation error', async ({ page }) => {
    await page.click('#save-btn');
    await expect(page.locator('#error-title')).toBeVisible();
    await expect(page.locator('#field-title')).toHaveClass(/error/);
    await page.screenshot({ path: 'tests/screenshots/modal-title-error.png', fullPage: true });
  });

  test('all form fields are present', async ({ page }) => {
    await expect(page.locator('#field-title')).toBeVisible();
    await expect(page.locator('#field-description')).toBeVisible();
    await expect(page.locator('#field-priority')).toBeVisible();
    await expect(page.locator('#field-due-date')).toBeVisible();
    await expect(page.locator('#field-label')).toBeVisible();
    await expect(page.locator('#field-assignee')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/modal-all-fields.png', fullPage: true });
  });
});

// ─── 4. Date Field Constraints ────────────────────────────────────────────────

test.describe('Date Field Constraints', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await page.waitForSelector('#board-wrapper:not(.hidden)', { timeout: 5000 });
    await page.click('#new-task-btn');
    await page.waitForSelector('#task-modal:not(.hidden)');
  });

  test('min date is today (not in the past)', async ({ page }) => {
    const minAttr = await page.locator('#field-due-date').getAttribute('min');
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(minAttr).toBe(expected);
    await page.screenshot({ path: 'tests/screenshots/date-min-today.png', fullPage: true });
  });

  test('max date is exactly 365 days from today', async ({ page }) => {
    const maxAttr = await page.locator('#field-due-date').getAttribute('max');
    const future = new Date();
    future.setDate(future.getDate() + 365);
    const expected = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(maxAttr).toBe(expected);
    await page.screenshot({ path: 'tests/screenshots/date-max-365.png', fullPage: true });
  });

  test('Today shortcut sets today\'s date', async ({ page }) => {
    await page.click('.date-shortcut[data-offset="0"]');
    const value = await page.locator('#field-due-date').inputValue();
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(value).toBe(expected);
    await page.screenshot({ path: 'tests/screenshots/date-shortcut-today.png', fullPage: true });
  });

  test('Tomorrow shortcut sets tomorrow\'s date', async ({ page }) => {
    await page.click('.date-shortcut[data-offset="1"]');
    const value = await page.locator('#field-due-date').inputValue();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expected = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    expect(value).toBe(expected);
    await page.screenshot({ path: 'tests/screenshots/date-shortcut-tomorrow.png', fullPage: true });
  });

  test('Next week shortcut sets date 7 days from today', async ({ page }) => {
    await page.click('.date-shortcut[data-offset="7"]');
    const value = await page.locator('#field-due-date').inputValue();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const expected = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;
    expect(value).toBe(expected);
    await page.screenshot({ path: 'tests/screenshots/date-shortcut-next-week.png', fullPage: true });
  });

  test('Clear button empties the date field', async ({ page }) => {
    await page.click('.date-shortcut[data-offset="0"]'); // set a date first
    await page.click('#date-clear-btn');
    const value = await page.locator('#field-due-date').inputValue();
    expect(value).toBe('');
    await page.screenshot({ path: 'tests/screenshots/date-shortcut-clear.png', fullPage: true });
  });

  test('active shortcut pill is highlighted after click', async ({ page }) => {
    const btn = page.locator('.date-shortcut[data-offset="0"]');
    await btn.click();
    await expect(btn).toHaveClass(/active/);
    await page.screenshot({ path: 'tests/screenshots/date-shortcut-active.png', fullPage: true });
  });

  test('active shortcut is cleared when Clear is clicked', async ({ page }) => {
    const todayBtn = page.locator('.date-shortcut[data-offset="0"]');
    await todayBtn.click();
    await page.click('#date-clear-btn');
    await expect(todayBtn).not.toHaveClass(/active/);
    await page.screenshot({ path: 'tests/screenshots/date-shortcut-active-cleared.png', fullPage: true });
  });
});

// ─── 5. Task Creation ─────────────────────────────────────────────────────────

test.describe('Task Creation', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await page.waitForSelector('#board-wrapper:not(.hidden)', { timeout: 5000 });
  });

  test('creating a task adds a card to the To Do column', async ({ page }) => {
    await page.click('#new-task-btn');
    await page.waitForSelector('#task-modal:not(.hidden)');
    await page.fill('#field-title', 'My Visual Test Task');
    await page.click('#save-btn');
    await expect(page.locator('#task-modal')).toBeHidden({ timeout: 10000 });
    await expect(page.locator('#list-todo .task-card')).toHaveCount(1);
    await expect(page.locator('#list-todo .card-title')).toContainText('My Visual Test Task');
    await page.screenshot({ path: 'tests/screenshots/task-created.png', fullPage: true });
  });

  test('priority badge colour is correct for High priority', async ({ page }) => {
    await page.click('#new-task-btn');
    await page.waitForSelector('#task-modal:not(.hidden)');
    await page.fill('#field-title', 'High Priority Task');
    await page.selectOption('#field-priority', 'High');
    await page.click('#save-btn');
    await expect(page.locator('#task-modal')).toBeHidden({ timeout: 10000 });
    const badge = page.locator('.priority-badge.High');
    await expect(badge).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/task-priority-high.png', fullPage: true });
  });
});

// ─── 6. Search & Filters ──────────────────────────────────────────────────────

test.describe('Search and Filters', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await page.waitForSelector('#board-wrapper:not(.hidden)', { timeout: 5000 });

    // Create two tasks
    for (const title of ['Alpha Task', 'Beta Task']) {
      await page.click('#new-task-btn');
      await page.waitForSelector('#task-modal:not(.hidden)');
      await page.fill('#field-title', title);
      await page.click('#save-btn');
      await expect(page.locator('#task-modal')).toBeHidden({ timeout: 10000 });
    }
  });

  test('search filters cards by title', async ({ page }) => {
    // Search for a title that matches only the first card
    await page.fill('#search-input', 'Alpha');
    await expect(page.locator('#list-todo .task-card')).toHaveCount(1);
    await expect(page.locator('#list-todo .card-title')).toContainText('Alpha Task');
    await page.screenshot({ path: 'tests/screenshots/search-filtered.png', fullPage: true });
  });

  test('clearing search restores all cards', async ({ page }) => {
    await page.fill('#search-input', 'Alpha');
    await page.fill('#search-input', '');
    await expect(page.locator('#list-todo .task-card')).toHaveCount(2);
    await page.screenshot({ path: 'tests/screenshots/search-cleared.png', fullPage: true });
  });
});
