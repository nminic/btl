import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/** The module the portal starts from, written the way the bundler writes a module's id. */
const MAIN = fileURLToPath(new URL('./src/main.tsx', import.meta.url)).replaceAll('\\', '/')

type TheGraph = { getModuleInfo: (id: string) => { importedIds: readonly string[] } | null }

let loadedWithIt: Set<string> | null = null

/** Every module `main.tsx` reaches by a static import, read off the bundler's own graph once per build. */
function reachedFromMain(graph: TheGraph): Set<string> {
  if (loadedWithIt === null) {
    const reached = new Set<string>()
    const next = [MAIN]

    for (let one = next.pop(); one !== undefined; one = next.pop()) {
      if (!reached.has(one)) {
        reached.add(one)
        next.push(...(graph.getModuleInfo(one)?.importedIds ?? []))
      }
    }

    loadedWithIt = reached
  }

  return loadedWithIt
}

/**
 * EVERYTHING THE PORTAL LOADS WITH ITSELF, IN ONE PIECE, `portal` (inkrement „Poboljšanje performansi”,
 * korak 2): every module `main.tsx` reaches by a static import, read off the bundler's own graph rather
 * than named. Left to itself the bundler cut that part into 63 pieces, one for every set of screens that
 * share a module, and a slow phone asked for all of them before it drew anything. Measured on 22.11.2026
 * over HTTP/2, a phone four times slower and 1.6 Mbit/s at 150 ms, a cold profile to its first row: 3.7 s
 * before the change, 3.1 s cut by the bundler, 2.7 s with this piece. The screens themselves are still
 * their own pieces, cut as the bundler cuts them.
 */
function loadedWithThePortal(id: string, graph: TheGraph): string | null {
  return !id.endsWith('.css') && reachedFromMain(graph).has(id.replaceAll('\\', '/')) ? 'portal' : null
}

/**
 * AND EVERY STYLESHEET THE PORTAL LOADS WITH ITSELF IN A PIECE OF ITS OWN, `styles`, in the order
 * `src/app/stylesheets.ts` imports them (see `build` below). Asked of the same graph, so a stylesheet only
 * a development control imports (`dev/tools.ts`) is not pulled into a production sheet:
 * `dev/productionPackage.test.ts` holds that, and a group that captured every `.css` failed it.
 */
function theStylesheetsOfThePortal(id: string, graph: TheGraph): string | null {
  return id.endsWith('.css') && reachedFromMain(graph).has(id.replaceAll('\\', '/')) ? 'styles' : null
}

export default defineConfig({
  plugins: [
    react(),
    /* The graph read above belongs to one build, and a process may build twice (`dev/productionPackage.test.ts`
       builds production and QA one after the other). */
    {
      name: 'forget-the-graph-of-the-last-build',
      buildStart() {
        loadedWithIt = null
      },
    },
  ],
  build: {
    /* ONE STYLESHEET FOR THE WHOLE PORTAL, AND ITS RULES IN THE ORDER THEY ALWAYS HAD, while the code is
       loaded screen by screen (inkrement „Poboljšanje performansi”, korak 2).

       Split along with the code, the rules of a screen would arrive in a sheet of their own appended
       after the portal's, and at equal specificity the later sheet wins (ADL A7, 13.08.2026, which
       foresaw exactly this: „čim se uvede deljenje po rutama ... pravila odlaze i ništa to ne javi”). So
       `cssCodeSplit` is off. And one sheet alone was measured NOT to be enough: its order follows how the
       code is cut, and the moved order changed what two screens of the administration draw. So every
       stylesheet is also put into ONE piece (`styles`, below), where the order is the order the portal
       imports them in, and that order is written down in `src/app/stylesheets.ts`, which `main.tsx` loads
       first. Measured on the change: the built sheet is the same 1155 rules in the same order as the
       build before it, and every element's computed style on 49 addresses at 360, 768 and 1280 is the
       same. What it costs is that a visitor downloads the rules of the administration with the rest,
       about 24 KB over the wire for all of them, as he did before. */
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: theStylesheetsOfThePortal, priority: 2 },
            { name: loadedWithThePortal, priority: 1 },
          ],
        },
      },
    },
  },
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
