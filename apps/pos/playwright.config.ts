import { defineConfig, devices } from '@playwright/test';

// Device baselines from CLAUDE.md §8: phone, 10" tablet in landscape, laptop.
// Runs against the local Supabase stack (pnpm db:start) through .env.e2e, on its own port so it
// never reuses a dev server that points at the hosted project.
const port = 5290;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: 'list',
  workers: 1, // the auth flow shares seeded staff (PIN lockout counters) across projects
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: `pnpm exec vite --mode e2e --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
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
