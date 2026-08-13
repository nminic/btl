import pages from '../../public/mock/pages.json'
import { registracija } from '../forms/definitions'

/* The written pages have to say what the portal does.
 *
 * Two age boundaries live next to each other and they are not the same kind of
 * thing, which is how they came to be written as if they were.
 *
 * The junior price is a competition category, so it is a ceiling measured over
 * the whole season: a category must not change under somebody in June. Parental
 * consent is not a category. It is about who is handing over a child's data on
 * the day they hand it over, so it is measured on that day, which is also what
 * the form does and what every string beside it says.
 *
 * Sweeping both into "uzrast se meri kroz celu sezonu" made the policy promise
 * something the form does not do, in both directions: somebody born in December
 * 2010 registering in October 2026 is never 15 during 2027, so the page said no
 * parent was needed while the form demanded one; somebody born in March 2011 was
 * 15 on 1 January 2027, so the page demanded a parent while the form never
 * showed the field.
 */

const YEARS = registracija.fields.find((field) => field.name === 'parentConsent')
  ?.showWhenYoungerThan?.years

const BODIES = Object.entries(pages).flatMap(([slug, page]) =>
  page.sections.map((section) => ({ slug, heading: section.heading, body: section.body })),
)

/** Every passage that speaks about a parent signing or holding the account. */
const ABOUT_A_PARENT = BODIES.filter((one) =>
  /roditelj ili staratelj|prijavu potpisuje roditelj/.test(one.body),
)

describe('what the written pages say about age', () => {
  it('names the same threshold the registration form uses', () => {
    expect(YEARS).toBe(16)
    /* Four passages: the privacy policy, the terms twice, and the rulebook.
       Without this the loop below passes on an empty list. */
    expect(ABOUT_A_PARENT.length).toBeGreaterThanOrEqual(4)

    for (const one of ABOUT_A_PARENT) {
      expect(one.body, `${one.slug} / ${one.heading}`).toMatch(
        new RegExp(`mlađ[ie] od ${YEARS} godina`),
      )
    }
  })

  it('never measures a parent over a season', () => {
    for (const one of ABOUT_A_PARENT) {
      const sentence = one.body
        .split('\n')
        .filter((line) => /roditelj ili staratelj|prijavu potpisuje roditelj/.test(line))
        .join(' ')

      expect(sentence, `${one.slug} / ${one.heading}`).not.toMatch(
        /bar jedan dan (imaju|ima|imate) 15|u sezoni za koju se prijavljuj\w+ \*\*bar jedan dan/,
      )
    }
  })

  it('still measures the junior price over the whole season', () => {
    /* The other half, and the reason this test is not simply "no page mentions a
       season and an age together": the junior price genuinely is a ceiling over
       the season, and a later tidy-up that made these two consistent by pulling
       the price onto the day of payment would be a different mistake. Which day
       the price is measured on is still open in PDL P7. */
    const junior = BODIES.filter((one) => one.body.includes('plaća juniorsku cenu'))

    expect(junior).toHaveLength(2)
    for (const one of junior) {
      expect(one.body, `${one.slug} / ${one.heading}`).toMatch(
        /bar jedan dan ima 14 godina ili manje/,
      )
    }
  })
})
