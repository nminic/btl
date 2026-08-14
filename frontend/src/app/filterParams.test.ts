import { readFileSync, readdirSync } from 'node:fs'
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

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return sourceFiles(path)
    }

    /* Tests are left out: they mount screens rather than write filters, and one
       of them is this file, which names the hook in order to forbid it. */
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('writing a filter into the address', () => {
  const files = sourceFiles(SRC)

  it('reads the whole of the application, so it cannot pass on an empty list', () => {
    expect(files.length).toBeGreaterThan(80)
    expect(files.some((path) => path.endsWith(HOME))).toBe(true)
  })

  it('goes through the one hook that says a filter is not an arrival', () => {
    const elsewhere = files.filter(
      (path) => !path.endsWith(HOME) && readFileSync(path, 'utf-8').includes('useSearchParams'),
    )

    expect(elsewhere.map((path) => path.slice(SRC.length + 1))).toEqual([])
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
