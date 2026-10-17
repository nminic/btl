import { act, cleanup, configure, getConfig, screen } from '@testing-library/react'
import axe from 'axe-core'
import { matchRoutes, type RouteObject } from 'react-router'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { routeObjects } from '../app/routeObjects'
import type { Role } from '../roles/context'
import { BEHIND, BEHIND_DAY, DAY, PUBLIC } from '../test/addresses'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'

/**
 * EVERY SCREEN OF THE PORTAL IS HANDED TO AXE, AND WHAT AXE FINDS FAILS THE GATE.
 *
 * <p><b>Why.</b> ADL, 02.10.2026, the owner choosing between offered outcomes: „Alat za automatsku
 * proveru pristupačnosti (axe) ulazi u testove posle tekućeg čišćenja nalaza." The standard is WCAG 2.2
 * AA as a minimum (ADL A7, `btl/CLAUDE.md`). Every other guard over accessibility in this portal is
 * written by hand about one thing, a label here and a heading there; axe asks the same questions of
 * every screen.
 *
 * <p><b>Which screens, and the floor under that.</b> The walk is not a list written for this file. It
 * is the two tables the other walks already read (`test/addresses.ts`): every address outside
 * administration, read once by a visitor and once by a member, and administration with the two member
 * forms the first table cannot reach, plus the two addresses that are no screen of their own and only
 * send a reader on. And the floor is not those tables either: the case at the foot asks THE ROUTER
 * (`matchRoutes` over `routeObjects`) which of the routes it serves were named by a row that axe
 * actually ran on, and every one must be. A screen added to the router tomorrow fails here until
 * somebody walks it, and a row that is skipped fails it today.
 *
 * <p><b>A route that only sends the reader on counts as walked</b> (`*`, the bare `/`, and the two
 * sectors of administration, which open their first section): what a reader meets there is the screen
 * it sends them to, and that screen is what axe was given.
 *
 * <p><b>The boundary, said rather than left to be found.</b> The floor is over routes, not over the
 * states of a screen. `/sr/novi-tim` is named by the visitor's row, which meets the sign-in sentence at
 * that very address, so the floor would still be satisfied if the row that draws the form were deleted
 * from `BEHIND`. What holds those rows is the count of `BEHIND` in `pages/publicData.test.tsx`.
 *
 * <p><b>What is waited for before axe runs.</b> A fresh render per row, so no earlier screen can still
 * be standing; then the heading that only that screen draws, which is what makes the row about the
 * screen it names; then the page has to stop changing (`settled`), because half of these screens read a
 * second resource inside the first and axe would otherwise judge the skeleton.
 *
 * <p><b>Read as production reads:</b> the development controls are switched off, as in
 * `pages/publicData.test.tsx`. They are drawn on no screen in production (`src/dev/tools.ts`).
 */

vi.mock('../dev/tools', () => ({
  devToolsEnabled: () => false,
  DEV_TOOLS_IN_THIS_BUILD: false,
  loadTheDevControls: null,
}))

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, so a screen that never draws its heading
   fails with the words of the wait and not with the clock of the case. The precedent and the reason are
   in `pages/admin/saveWhileSaving.test.tsx`; the case at the foot holds that the half is still half. */
configure({ asyncUtilTimeout: SLOW / 2 })

/** The member the public half of the walk signs in as, the same one `pages/publicData.test.tsx` uses:
 *  somebody with a result on the event whose rating screen is in the table, so that row draws a form. */
const ME = '000021'

/**
 * The rules axe cannot answer in jsdom, each switched off by name and for a reason. Nothing else is.
 *
 * jsdom builds the document and never draws it: there is no layout and no painted colour. A rule that
 * reads either one answers about nothing, and an answer about nothing in a gate is worse than none.
 */
const NOT_IN_JSDOM: Record<string, string> = {
  /* Contrast is measured on the painted page, colour against colour, and jsdom paints nothing. What is
     held of it is held elsewhere and only in part: chosen pairs of tokens, measured by the WCAG formula
     in `test/contrast.ts` (`styles/goldBand.test.ts`, `forms/choiceControl.test.tsx`), not every pair a
     screen draws. */
  'color-contrast': 'jsdom does not paint, so there is no colour to measure against another',
  /* Whether a link inside a sentence can be told from the sentence without its colour: the same two
     colours again, and a stylesheet this harness does not load. */
  'link-in-text-block': 'jsdom does not paint, and the stylesheets are not loaded under Vitest',
  /* Whether a box that scrolls can be reached by the keyboard. A box scrolls when what is in it is taller
     than the box, and in jsdom every height is nought, so no box ever scrolls and the rule never applies. */
  'scrollable-region-focusable': 'jsdom has no layout, so nothing is ever taller than its box',
  /* WCAG 2.2 AA 2.5.8, the size of what is pressed. Axe leaves it off by default and it is named here
     anyway, so that the one criterion of 2.2 that axe can test is not mistaken for one that is tested:
     it reads the box an element is drawn in, and jsdom draws no box. */
  'target-size': 'jsdom has no layout, so every target measures nought by nought',
}

/** One screen as the walk reads it: where, as whom, the heading that says it is that screen, and the
 *  day it is read on, each table on the day the walks before this one read it. */
type Row = [address: string, role: Role, who: string | null, heading: string, day: string]

/**
 * WHAT IS DRAWN AT A POINT OF THE SCREEN, answered the way jsdom would answer it if it could: nothing.
 *
 * jsdom has no `document.elementFromPoint`, and axe asks it before two rules that are about the
 * document and not about the screen: whether the page has a `main` and whether it has an `h1`. It asks
 * in order to find a box drawn over the whole page that behaves like a dialog without saying so, and
 * without the function the question throws and axe files both rules as „incomplete" on every screen,
 * which is two rules quietly measuring nothing. Measured 16.10.2026: 81 rows, 81 times each.
 *
 * Nothing is drawn at any point of a document that has no layout, so that is the answer given. It
 * keeps the half of the question jsdom can answer (an open `dialog`, `role="dialog"` or
 * `aria-modal="true"` is found by axe without any point) and gives up only the half about geometry,
 * which no rule here could answer anyway. Put back exactly as it was after the file.
 */
const UNDRAWN = (): Element | null => null

beforeAll(() => {
  expect(document.elementFromPoint, 'jsdom has its own now, and this answer is no longer needed').toBeUndefined()
  document.elementFromPoint = UNDRAWN
})

afterAll(() => {
  Reflect.deleteProperty(document, 'elementFromPoint')
})

/** Where the portal sends whoever arrives somewhere it has no screen for. */
const FRONT_PAGE = 'Balkanska trkačka liga'

const WALK: Row[] = [
  ...PUBLIC.map(([address, asVisitor]): Row => [address, 'visitor', null, asVisitor, DAY]),
  ...PUBLIC.map(([address, , asMember]): Row => [address, 'competitor', ME, asMember, DAY]),
  ...BEHIND.map(([address, role, who, heading]): Row => [address, role, who, heading, BEHIND_DAY]),
  /* The two routes that are no screen at all, so that the router's own list has no exception in it:
     the bare root, which picks the language, and an address the portal does not have (`NotFound`).
     Both end on the front page (owner, 30.07.2026), which is what is handed to axe. */
  ['/', 'visitor', null, FRONT_PAGE, DAY],
  ['/sr/ove-adrese-nema', 'visitor', null, FRONT_PAGE, DAY],
]

/**
 * What axe finds and is known, by the screen, by the rule and by how many places, with the reason.
 *
 * Keyed by role and address, so an allowance on one reading of an address does not free the other; and
 * counted, so a second place breaking the same rule on the same screen does not ride in on the first.
 * Every entry is a decision about a look or a text that is not this branch's to make, and the report
 * that brought this file in offers outcomes for each. Every entry must also be MET: the case at the foot
 * fails on an allowance nobody needs any more.
 */
const KNOWN: Record<string, Record<string, { places: number; why: string }>> = {
  'superadmin /sr/administracija/lige': {
    /* The box „Trke u ligi" under a competition is headed `h3` (`admin/LeagueRaceModeration.tsx`),
       because on the public page of a league it stands under the competition's own `h2`. In
       administration it stands in a row of a table under the screen's `h1`, with no `h2` between.
       Making it an `h2` changes how big it is drawn, and adding an `h2` over the table adds words to the
       screen: both are the owner's to choose. Axe files this rule under best practice, not under a
       numbered criterion of WCAG. */
    'heading-order': {
      places: 1,
      why: 'the h3 of the box of races sits under the h1 of the screen, with no h2 between',
    },
  },
}

/** Which allowances were actually needed, so the list above cannot quietly go stale. */
const met = new Set<string>()

/** The rows axe really ran on, by the address the row names. Written after axe answers, so a row that
 *  is skipped, or that throws before axe is asked, is missing here and the floor says so. */
const measured: string[] = []

/** Waits until the page stops changing: three readings of the whole body in a row, all the same and
 *  none of them empty. */
async function settled(): Promise<void> {
  let last = ''

  for (let still = 0; still < 3; ) {
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 5)
      })
    })

    const now = document.body.innerHTML

    still = now === last && now !== '' ? still + 1 : 0
    last = now
  }
}

/** A finding as a reader of the log needs it: the rule, what it asks, and where. */
function said(found: axe.Result): string {
  return `${found.id}: ${found.help} at ${found.nodes.map((node) => node.target.join(' ')).join(', ')}`
}

describe('every screen, as axe reads it', () => {
  it.each(WALK)('%s, as %s', async (address, role, who, heading, day) => {
    renderAt(address, role, who, undefined, day)

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeVisible()

    await settled()

    const results = await axe.run(document, {
      rules: Object.fromEntries(Object.keys(NOT_IN_JSDOM).map((rule) => [rule, { enabled: false }])),
      /* Every place is listed for a violation, and one place for every other answer, which is all the
         cases below read of them: that a rule passed, and which rules were left undecided. Measured
         16.10.2026 on `/sr/moji-rezultati` as a member, 2918 elements: 8.6 s for a full report, 0.8 s
         for this one. The full one timed out at 20 s under coverage in CI (PR 534). */
      resultTypes: ['violations'],
    })

    /* That axe asked something at all. A run that matched nothing answers „no violations" in the
       words of a clean screen. */
    expect(results.passes.length, `${role} on ${address}`).toBeGreaterThan(0)

    /* And that axe decided every rule it asked. „Incomplete" is two things and neither is an answer: a
       rule that threw (axe says so in `error`, and it reads like a question left to a person when it is
       a question never asked), and a rule axe could not settle and leaves to a person. A gate has no
       person, so either one is a screen this file did not measure. Measured 16.10.2026: with the
       answer above and contrast off, no row of the walk leaves anything undecided. */
    expect(
      results.incomplete.map((found) => `${found.id}${found.error === undefined ? '' : ' (threw)'}`),
      `${role} on ${address}`,
    ).toEqual([])

    measured.push(address)

    const screenOf = `${role} ${address}`
    const known = KNOWN[screenOf] ?? {}
    const unknown = results.violations.filter((found) => known[found.id] === undefined)

    expect(unknown.map(said), `${role} on ${address}`).toEqual([])

    results.violations.forEach((found) => {
      const allowed = known[found.id]

      expect(found.nodes, `${role} on ${address}, ${found.id}: ${allowed?.why}`).toHaveLength(
        allowed?.places ?? 0,
      )
      met.add(`${screenOf} ${found.id}`)
    })
  }, SLOW)
})

/** Every route the router serves, down to the leaves: the routes that answer an address. */
function leaves(routes: RouteObject[]): RouteObject[] {
  return routes.flatMap((route) => (route.children === undefined ? [route] : leaves(route.children)))
}

describe('the walk itself', () => {
  it('named every route the router serves, on a row axe ran on', () => {
    const reached = new Set(
      measured.flatMap((address) => {
        const leaf = matchRoutes(routeObjects, address.split('?')[0] ?? address)?.at(-1)

        return leaf === undefined ? [] : [leaf.route]
      }),
    )

    const missing = leaves(routeObjects)
      .filter((route) => !reached.has(route))
      .map((route) => (route.index === true ? '(the front page)' : route.path))

    /* Asked beside the answer, because a walk narrowed by accident answers „nothing is missing" in
       the words of a clean portal. */
    expect(measured).toHaveLength(WALK.length)
    expect(missing).toEqual([])
  })

  it('meets every allowance it keeps', () => {
    const promised = Object.entries(KNOWN).flatMap(([screenOf, rules]) =>
      Object.keys(rules).map((rule) => `${screenOf} ${rule}`),
    )

    expect([...met].sort()).toEqual(promised.sort())
  })

  it('switches off only rules axe has, so a misspelt name switches nothing off in silence', () => {
    const rules = new Set(axe.getRules().map((rule) => rule.ruleId))

    expect(Object.keys(NOT_IN_JSDOM).filter((rule) => !rules.has(rule))).toEqual([])
    expect(
      Object.values(KNOWN)
        .flatMap((byRule) => Object.keys(byRule))
        .filter((rule) => !rules.has(rule)),
    ).toEqual([])
  })

  it('waits half of the time a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBe(SLOW / 2)
  })
})

afterEach(() => {
  cleanup()
})
