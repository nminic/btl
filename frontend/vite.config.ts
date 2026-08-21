import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    /* Never reach into a git worktree checked out inside the project. A session
       working in .claude/worktrees has its own copy of every test file, and
       running both copies at once fails the suite here on work that is half
       finished somewhere else. */
    exclude: [...configDefaults.exclude, '**/.claude/**'],
    /**
     * How long one test may take, written here so the gate is one number.
     *
     * It was not written anywhere, so it was the default five seconds on the machine that
     * decides, and something else wherever anybody typed `--testTimeout` by hand. That is
     * two gates, and the softer one was the one being run before pushing: three different
     * tests have now timed out on CI at five seconds and passed on the next run, each of
     * them a screen that renders a whole page under jsdom.
     *
     * Fifteen, because the suite as a whole takes about thirty seconds and the slowest
     * honest test on this machine takes five, so this leaves room for a machine three
     * times slower without leaving room for a test that hangs.
     */
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // Bootstrap only: main.tsx mounts React, App.tsx builds the browser
      // router from routeObjects. The route table itself is covered through
      // src/app/navigation.test.tsx, which mounts it in a memory router.
      exclude: ['src/main.tsx', 'src/app/App.tsx', 'src/vite-env.d.ts', 'src/test/**'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
