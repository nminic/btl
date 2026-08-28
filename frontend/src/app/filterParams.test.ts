import { readFileSync } from 'node:fs'
import { bare, sources, WHOLE_PORTAL } from '../test/sources'
import { join } from 'node:path'

/* Every filter on the portal writes itself into the address, and to the router
 * each of those is a navigation like any other: an arrival, which puts the reader
 * at the top of the page. `useFilterParams` says the one thing that is true here
 * instead, that this is not an arrival, and every screen goes through it.
 *
 * Read off the source, because one screen left outside it is one control that
 * still throws the reader up the page, and that is not visible from anywhere
 * except the screen it is on. The same shape as the one that holds the clock to
 * one reader (src/clock/oneClock.test.ts).
 *
 * What it covers is exactly the one hook, by name. A screen that wrote a filter
 * through `useNavigate` or through a `Link` carrying a query would walk past
 * this.
 *
 * Four do carry a query in a `Link`, and all four are meant to: the calendar
 * opening a day of events, the two extracts on the front page, and a member's
 * own results reaching the form for entering another one. Each is a move to
 * another screen, where landing at the top is the right thing and
 * `preventScrollReset` would be the fault. The rule this file holds is about a control that filters the screen it
 * is already on, and none of the four is one. The sentence here used to say
 * „nothing does today", which stopped being true and said nothing about it.
 */

const SRC = join(process.cwd(), 'src')

/** The one file allowed to reach for the router's own hook. */
const HOME = join('app', 'useFilterParams.ts')

describe('writing a filter into the address', () => {
  /* The sweep that fact lives beside (`test/sources.ts`), and not a copy of it
     written here. A copy read the helpers the tests are written with as though
     they were screens, and its own floor was a number typed in by hand. */
  const files = sources()

  it('reads the whole of the application, so it cannot pass on an empty list', () => {
    /* The floor comes from `test/sources.ts`, where that fact lives and where the
       reason for the number is written: the largest single folder holds under a
       hundred, so no one folder can meet it on its own. Held here as 80 for a
       while, which is a number written by hand, and a round measured what that
       cost on 23.08.2026: with `pages` skipped the sweep stayed green while an
       offender sat in the folder it had stopped reading.

       Re-measured on 28.08.2026, over the shared sweep this now uses: the whole
       portal is 204 files and `pages` alone is 98 of them, so skipping it leaves
       106 and the floor of 150 catches it. The number written here before was
       119, and it was 118 in the sentence: it counted a different sweep, the one
       this file kept for itself, which read `src/test/` as well. */
    expect(files.length).toBeGreaterThan(WHOLE_PORTAL)
    expect(files.some(({ path }) => path.endsWith(HOME))).toBe(true)
  })

  it('goes through the one hook that says a filter is not an arrival', () => {
    const elsewhere = files.filter(
      /* Comments blanked, so a file that only explains the rule is not read as
         breaking it. This file is not in the sweep and says the name a dozen
         times; the day a screen does the same in a note, the sweep would have
         called it an offender. */
      ({ path, code }) => !path.endsWith(HOME) && bare(code).includes('useSearchParams'),
    )

    expect(elsewhere.map(({ path }) => path.slice(SRC.length + 1))).toEqual([])
  })

  it('and that hook does say it', () => {
    /* Without this the rule above is a rule about a name. The screens could all
       go through one hook that forgot the very thing it exists for, and every
       filter would go on throwing the reader to the top of the page. */
    const hook = readFileSync(join(SRC, HOME), 'utf-8')

    expect(hook).toMatch(/preventScrollReset:\s*true/)
    /* Spread first, so a caller that asks for `replace` still gets it: the list
       of events replaces its own entry rather than stacking one per edit. */
    expect(hook).toMatch(/\{\s*\.\.\.options,\s*preventScrollReset:\s*true\s*\}/)
  })
})
