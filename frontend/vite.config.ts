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
     * HOW MANY WORKERS THE SUITE GETS IS SET IN THE ENVIRONMENT AND NOT HERE, and
     * this paragraph is why the number exists rather than what it is.
     *
     * **What the number cures.** A case's own clock (`src/test/slow.ts`, `SLOW`)
     * cures DURATION: a case that really takes four seconds is given room. It
     * cannot cure STARVATION, and the two look identical in the log. Measured
     * 27.09.2026: `pages/member/proposeTeam.test.tsx`'s „refuses a member whose
     * team starts next season" takes 118 ms on its own and 591 ms in a quiet pass
     * of this gate, and under sixteen spinning processes it came back
     * `Test timed out in 5000ms` at 5102 ms. In the second such pass 23 cases
     * across 10 files fell, 21 of them between 5000 and 6300 ms. No threshold on
     * a quiet machine can find those: `pages/member/editTeam.test.tsx`'s „leaves
     * the team as it is on the portal while the change waits" measured 432 ms in
     * one pass of this gate and 5148 ms in the next, where it failed.
     *
     * **Why six, and it is arithmetic rather than taste.** This machine has 24
     * logical processors and Vitest's own default is `max(cpus - 1, 1)`, so every
     * agent's gate opens 23 workers on 24 cores and several agents run at once.
     * 24 / 6 is four gates with one worker per core, which is where
     * oversubscription stops.
     *
     * **What it costs and what it buys, one full `--coverage` pass at each.** To a
     * lone agent six workers cost 170 s of wall clock against 96 s at the default,
     * so 1.76 times slower. What it buys is the quantity the five second ceiling
     * is actually measured against: the summed time of all 3266 cases falls from
     * 1032 s to 583 s, because each case stops fighting for a core. And the spread
     * that the cap removes: three passes at the default, same machine, same day,
     * nothing changed but the neighbours, summed 747 s, 1032 s and 1223 s.
     *
     * **Nothing is set here on purpose, and that is the whole of the decision.**
     * CI runs on `ubuntu-latest` (`.github/workflows/verify.yml`), which has far
     * fewer cores, where six would oversubscribe the runner and a percentage would
     * leave it one worker. So the cap is asked for per machine, through Vitest's
     * OWN variable: run the gate as `VITEST_MAX_WORKERS=6 npm run test:coverage`
     * on a machine shared with other agents, and set nothing anywhere else.
     *
     * **And it is Vitest's variable rather than one of ours deliberately.**
     * `VITEST_MAX_WORKERS` is read by Vitest while it resolves this config and it
     * OVERRIDES whatever `maxWorkers` says here, so a second name of our own would
     * give one fact two homes and the one written here would be the one silently
     * losing. The tool already answers the question, so it is asked rather than
     * reimplemented.
     */
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
