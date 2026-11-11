// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.cjs',
  outputDir: './tests/results',
  snapshotDir: './tests/snapshots',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'tests/report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4000',
    screenshot: 'on',
    video: 'off',
    trace: 'off',
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  webServer: {
    command: 'npx serve taskboard -l 4000',
    url: 'http://localhost:4000',
    reuseExistingServer: true,
    timeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, channel: 'msedge' },
    },
  ],
});
