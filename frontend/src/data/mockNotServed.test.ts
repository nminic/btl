import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { inside } from '../test/sources'

/**
 * NOTHING UNDER `frontend/public/` IS A `.json` FILE, so nothing the tests read off
 * disc can also be handed to a visitor who asks for its address.
 *
 * **Why this exists.** Until 26.09.2026 the fifteen generated resources and the
 * team logo lived at `public/mock/`, and Vite copies the whole of `public/` into
 * `dist/` verbatim: `curl` against the built site answered `mock/competitors.json`
 * with 200, in full, to anybody, signed in or not (ADL A8). `competitors.json`
 * carries a member's age band and the privacy policy is specific that nothing
 * about age is ever shown (Član 74). The portal has read `/api/*` and not `/mock/*`
 * since 21.09.2026 (`data/client.ts`, `BASE`), so nothing was reading these files
 * for what they answer any more; they were only still being served. PDL „Mock
 * fajlovi izlaze iz isporuke odmah" [ODLUKA 26.09.2026, vlasnik]: the files move to
 * `src/test/mock` (tests still read them off disc, `test/setup.ts` chief among
 * them) and stop being anywhere under `public/`.
 *
 * **Derived, not listed.** A hand-written list of the fifteen resource files would
 * pass the day a sixteenth is added anywhere under `public/`, in any subfolder, by
 * anybody who has not read this file. `readdirSync` is asked instead, recursively,
 * so a new file is caught the day it lands rather than the day someone remembers to
 * extend a list. Recursive on purpose: `servedAge.test.ts` measured on 13.09.2026
 * that a single-level sweep of this same mock folder let `logo/roster.json` carry a
 * year of birth and an age past a whole suite, because the folder had `logo/`
 * nested inside it and nobody had asked one level down. `public/` holds no
 * subfolder today, but the guard that only works while that stays true is the guard
 * that already failed once here.
 *
 * **Recursion was asked for, not yet proved, and review found the gap (27.09.2026).**
 * `public/` holding no subfolder today means the case below never once actually
 * exercises the `recursive` option it depends on: a sweep that silently stopped
 * descending would read exactly as clean as one that still works. A combined
 * mutation showed it: dropping `{ recursive: true }` from the call below AND
 * restoring `public/mock/competitors.json` one level down each passed alone
 * (expected either way, since neither is the fault by itself), but passed
 * TOGETHER too, `Tests 1 passed`, because a non-recursive listing of `public/`
 * sees only the name `mock`, which does not end in `.json`. `jsonPathsUnder`
 * below is the fix: the one function the case above calls is called again,
 * unchanged, against `src/test`, a root proven to nest a `.json` file today
 * (precedent: `servedAge.test.ts:163-183`, which proves its own hand-rolled
 * walker the same way). One function shared by both calls means a mutation that
 * drops its recursion cannot spare one root and miss the other: `public/` stays
 * blind exactly as before, but `src/test` can no longer find its nested file and
 * the suite fails.
 *
 * **Asked of `public/`, the source Vite copies from, and not of `dist/`, the build
 * it produces — and that is a measured equivalence, not a shortcut.** `vite.config.ts`
 * sets neither `publicDir` nor `build.outDir` away from Vite's defaults and adds no
 * plugin beyond `@vitejs/plugin-react`; `Dockerfile` runs `npm run build` and copies
 * `dist` straight into the nginx image with no copy step of its own. So today
 * everything in `dist/` that is not built from `src/` is everything in `public/`,
 * unchanged, and a guard on either side catches exactly the same fault. `public/`
 * is asked because it is instant: no build, no child process, nothing to add to a
 * suite that already runs twice per gate (`vitest.anotherDay.config.ts`). Measured
 * 26.09.2026: `npm run build` itself takes about 9 seconds end to end, and before
 * this fix `dist/mock/` held all fifteen files plus the logo, about 3.4 MB of the
 * 4.9 MB the whole build produced — roughly seventy percent of every visit was mock
 * data nobody read any more.
 *
 * **Where this stops, said rather than left to be found.** If a future change adds
 * a build step, a plugin, or a manifest that writes into `dist/` from somewhere
 * other than `publicDir` — a generated `manifest.json`, an asset copied by a
 * plugin — this guard does not see it, because it never looks at `dist/` at all.
 * The fix then is not to rewrite this one: add a sibling case in this file that
 * runs after `npm run build` and applies the same recursive `.json` sweep to
 * `dist/` instead of `public/`, and drop the equivalence claim above once there is
 * a second source `dist/` can come from.
 */
const PUBLIC_DIR = join(process.cwd(), 'public')

/**
 * Every `.json` path under `dir`, at any depth, named the way this platform
 * writes one (`inside`, `test/sources.ts:60`): `readdirSync`'s own `recursive`
 * option answers with `mock\\competitors.json` on Windows and
 * `mock/competitors.json` elsewhere, so a literal forward slash cannot be
 * compared against it directly.
 *
 * Called twice below against two different roots. That sharing, not the option
 * by itself, is what proves recursion for `public/`: see the file comment above.
 */
function jsonPathsUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .filter((name): name is string => typeof name === 'string')
    .filter((name) => name.endsWith('.json'))
}

describe('what the portal ships under public/', () => {
  it('carries no .json file, at any depth', () => {
    expect(jsonPathsUnder(PUBLIC_DIR)).toEqual([])
  })

  it('the recursive sweep really descends, proved against a root known to nest one', () => {
    /* public/ has no subfolder today (file comment above), so this cannot be
       proved there. src/test can: src/test/mock/competitors.json sits one level
       down, the same depth every mock resource was served from before
       26.09.2026. */
    expect(jsonPathsUnder(join(process.cwd(), 'src', 'test'))).toContain(
      inside('mock', 'competitors.json'),
    )
  })
})
