import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    passWithNoTests: true,
    // Integration files share the seeded users and reset their data, so they cannot run in parallel.
    fileParallelism: false,
    // Expose every .env var (not only VITE_*) to tests; integration tests need the service-role key.
    env: loadEnv(mode, process.cwd(), ''),
  },
}));
