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
