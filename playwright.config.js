import { defineConfig } from '@playwright/test';

// Specs reset alice's data with the service role, so they need the same .env as the integration tests.
try {
  process.loadEnvFile();
} catch {
  // no .env: specs that need it fail with a clear message
}

export default defineConfig({
  testDir: 'tests/e2e',
  // One worker: every spec resets and uses the same seeded user.
  workers: 1,
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
