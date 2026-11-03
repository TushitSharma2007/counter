import { defineConfig, devices } from '@playwright/test';

// Device baselines from CLAUDE.md §8: phone, 10" tablet in landscape, laptop.
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: 'list',
  use: { baseURL: 'http://localhost:5280' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5280',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], browserName: 'chromium' },
    },
    {
      name: 'tablet',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 }, hasTouch: true },
    },
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
  ],
});
