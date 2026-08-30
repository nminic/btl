import pages from '../../public/mock/pages.json'

/* Where the written pages speak about a result that has not been approved yet,
 * and what they promise about it.
 *
 * The same shape as `writtenAges.test.ts`, and for the same two reasons: a
 * written page that promises what the portal does not do is corrected only by
 * whoever notices, and nobody notices prose; and a rule that lives in two pages
 * is a rule that will be half corrected. That is not a worry, it is what
 * happened here on 30.08.2026: Član 43 was put right and the terms of use, which
 * say the same thing in their own words, were left saying the old one. The first
 * draft of this file filtered on a phrase only the rulebook uses, so the second
 * home could not have been seen. **The homes are counted first now**, and the
 * wording is asked of the one that has been settled.
 *
 * This file reads the written pages and nothing else. What the portal actually
 * does with a waiting result is measured where that behaviour lives
 * (`pages/member/MyResults.tsx` and the queue in the administration have their
 * own tests); the claim here is about the text.
 */

const BODIES = Object.entries(pages).flatMap(([slug, page]) =>
  page.sections.map((section) => ({ slug, heading: section.heading, body: section.body })),
)

/** Every passage that speaks about a result which has not been approved yet,
 *  found by the word itself rather than by any one page's turn of phrase. */
const ABOUT_WAITING = BODIES.filter(({ body }) => /neverifikovan/i.test(body))

/** Every passage that speaks about the administration correcting one. */
const ABOUT_CORRECTING = BODIES.filter(({ body }) => /Administracija sme da ispravi/.test(body))

describe('what the written pages say about a result that is waiting', () => {
  it('says it in exactly the two pages that have always said it', () => {
    /* The count, before any wording. A third page picking this up is a third
       place to correct, and the two that exist were already corrected apart:
       until 30.08.2026 both said a waiting result is shown nowhere, the rulebook
       was put right and the terms were not, and no test could tell.

       The terms are not asked about their wording below, deliberately. Their
       passage is the published side of a draft in `btl-produkt/pravni/`, which
       the owner closed on 21.08.2026 („po pravnim dokumentima se više ne
       petlja"), and changing one without the other puts the old sentence back on
       the portal at the next publication. It is written down as waiting instead,
       with three further sentences in that same passage that a review found
       older decisions have already overtaken. */
    expect(ABOUT_WAITING.map((one) => one.slug).sort()).toEqual(['pravilnik', 'uslovi-koriscenja'])
    expect(ABOUT_CORRECTING.map((one) => one.slug)).toEqual(['pravilnik'])
  })

  it('promises in the rulebook only that it is not shown publicly, which is what the portal does', () => {
    /* „Neverifikovan rezultat se nigde ne prikazuje" was not true and stood there
       until 30.08.2026: a member sees their own waiting result in „Moji
       rezultati", marked „Čeka proveru", and that screen is where they delete it
       or change it, which the owner decided on 27.08.2026. A moderator sees it in
       the queue, and the count of what waits is drawn in the shell for whoever
       may open that queue.

       So the promise the portal can keep is the public one, and the word is what
       makes the sentence true rather than nearly true. Matched loosely enough
       that the two words may swap places, since the rule is which promise is
       made and not the order it is written in. */
    const written = ABOUT_WAITING.filter((one) => one.slug === 'pravilnik')

    for (const { heading, body } of written) {
      expect(body, heading).toMatch(/nigde javno|javno nigde/)
    }
  })

  it('no longer promises how the tables look', () => {
    /* The tail of Član 43 went out on the owner's instruction, 30.08.2026: „, pa
       u tabelama nema ni oznake „nepotvrđen"". It was a consequence rather than a
       rule, and a promise about how a screen looks, which ages faster than a rule
       does. Held as a sentence that must not come back, the way the five struck
       on 21.08.2026 are held (`writtenPages.test.tsx`), because a deletion with
       nothing holding it is a deletion somebody restores while tidying. */
    for (const { slug, heading, body } of BODIES) {
      expect(body, `${slug}, ${heading}`).not.toMatch(/nepotvrđen/)
    }
  })

  it('says the administration may correct a result while it is being verified, not only after', () => {
    /* The article spoke of „verifikovanog rezultata", a result already verified,
       while the correction the owner described happens **at** verification, on
       one that is not verified yet (owner, 30.08.2026: „ja ću lako promeniti
       njegovo vreme sa recimo 23:23:15 na 24:00:00"). A rule that covers only the
       later moment does not cover the ordinary one. */
    for (const { slug, heading, body } of ABOUT_CORRECTING) {
      expect(body, `${slug}, ${heading}`).toMatch(/pri verifikaciji (i|kao i) posle nje/)
    }
  })

  it('tells the competitor what to do when they think a correction is wrong', () => {
    /* The other half of the owner's own wording, and the half a rule about the
       administration's rights does not carry by itself: „ukoliko takmičar
       proceni da se radi o grešci da može da kontaktira". */
    for (const { slug, heading, body } of ABOUT_CORRECTING) {
      expect(body, `${slug}, ${heading}`).toMatch(/obraća se ligi/)
    }
  })
})
