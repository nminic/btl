import { expect } from '@playwright/test'
import { THE_DAY_THE_SUITE_IS_READ_AS } from '../src/test/theDay.ts'
import { label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * WHERE THE OWNER'S SENTENCE OF THE UNPAID SEASON STANDS, ASKED OF CHROME (PDL, ODLUKA 30.10.2026,
 * „U prelaznom roku svaki ulaz u tim traži plaćenu narednu sezonu"; ADL A63).
 *
 * <p>The sentence is long ("U tim za sezonu 2028 ulaziš kad platiš članarinu za tu sezonu. Uplatu ćeš
 * naći na strani Moja članarina.") and stands on a telephone in the place of a form, so what is asked is
 * what the UI standard of the repository asks of every screen: <b>the page does not move sideways</b>
 * (PDL P24), and the sentence is wholly inside the width asked, at the widths 360, 768 and 1280, and at
 * 200% text on the narrowest. Relations, never pixels: the box of the sentence against the width the
 * browser was given.
 *
 * <p>Read on `/sr/novi-tim`, where it replaces the form, so it is the screen with the least around it.
 * The team's page draws the same paragraph under the row of controls the way it draws a refusal, and the
 * inbox draws the same words in a line of the message; both are measured by the one property that decides
 * them here, the width of the words against the width of the screen.
 */

const MEMBER = {
  memberNumber: '000001',
  country: 'RS',
  firstSeason: 2027,
  membershipBasis: 'payment',
  active: true,
  referralCode: '7f07b38ff7ee7543',
  referredCount: 0,
  firstName: 'Vladan',
  lastName: 'Đurišić',
  gender: 'M',
  city: 'Beograd',
  ageBand: '40-54',
  beginner: false,
  categorySeason: 2027,
  categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
  bio: '',
  profileHidden: false,
  birthdayShown: 'none',
  address: 'Bulevar Pupina 10',
  phone: '+381 60 123 456',
  shirtSize: 'L',
}

const ROW = {
  memberNumber: MEMBER.memberNumber,
  firstName: MEMBER.firstName,
  lastName: MEMBER.lastName,
  gender: MEMBER.gender,
  city: MEMBER.city,
  country: MEMBER.country,
  category: { season: 2027, ageBand: MEMBER.ageBand, beginner: false },
  categories: MEMBER.categories,
  firstSeason: MEMBER.firstSeason,
  bio: '',
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  photo: null,
  crop: null,
}

/** A member who holds the season being run and owes the one on sale, 2028. */
const OWING: Answers = {
  '/api/me': { role: 'competitor', account: 1, member: MEMBER, mailLanguage: 'sr' },
  '/api/competitors': [ROW],
  '/api/teams': [],
  '/api/me/photo': { waiting: null, standing: null },
  '/api/me/applications': {
    teamApplications: [],
    teamInvitations: [],
    teamProposals: [],
    pairInvites: [],
    alreadyInATeam: false,
    seasonToPayFor: 2028,
  },
}

/**
 * 360 (also at 200% text) and 768. A desktop of 1280 is NOT read here, and it is said rather than left
 * to look forgotten: `harness.ts` refuses a desktop that draws no scrollbar (`NOT MEASURED`, a box would
 * be as wide as no reader's), and this screen, a heading and one sentence, is shorter than the screen.
 * At that width the paragraph stands in the same column as at 768, with more room around it.
 */
const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 360, text: 200 },
  { width: 768, text: 100 },
]

const SENTENCE = 'text=/ulaziš kad platiš članarinu za tu sezonu/'

for (const at of WIDTHS) {
  test(`the sentence of the unpaid season stands wholly inside the screen and moves nothing, ${label(at)}`, async ({ open, theDay }) => {
    /* The first day of the two is 30 September 2026, before the window opens (15 October), where the
       address sends a member to the front page and there is no sentence to measure. */
    test.skip(theDay === THE_DAY_THE_SUITE_IS_READ_AS, 'the transfer window is shut on that day')

    const { page, probe } = await open(at, '/sr/novi-tim', 'h1', OWING)

    await page.locator(SENTENCE).first().waitFor({ state: 'visible' })

    const seen = await page.evaluate((selector) => {
      const found = document.querySelector(selector)
      const box = found === null ? null : found.getBoundingClientRect()

      return box === null ? null : { left: box.left, right: box.right, width: document.documentElement.clientWidth }
    }, 'p.member__note')

    if (seen === null) {
      throw notMeasured('the screen drew no paragraph with the sentence')
    }

    expect(seen.left, 'the sentence starts left of the screen').toBeGreaterThanOrEqual(0)
    expect(seen.right, 'the sentence runs off the right edge of the screen').toBeLessThanOrEqual(seen.width)
    expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
    expect(probe.sideways, 'the page scrolls sideways').toBe(0)
  })
}
