import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: 'Europe/Berlin', // GDPR region unless a test says otherwise
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /layout\.spec\.js/ },
  ],

  webServer: {
    command: 'node serve.mjs', // runs from this folder (tests/)
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
