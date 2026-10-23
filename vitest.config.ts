import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// Tests assert en-US dates. Workers are forked from this process, and ICU reads the default
// locale at startup, so set it here, before any worker starts.
process.env.LANG = 'en_US.UTF-8';
process.env.LC_ALL = 'en_US.UTF-8';
process.env.TZ = 'UTC';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    globals: true,
    pool: 'forks',
    setupFiles: ['./vitest.setup.ts'],
    include: ['{lib,components,tests}/**/*.test.{ts,tsx}'],
  },
});
