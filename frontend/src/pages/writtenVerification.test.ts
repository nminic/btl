import pages from '../../public/mock/pages.json'

/* What the rulebook says about a result waiting to be checked, against what the
 * portal does with one.
 *
 * The same shape as `writtenAges.test.ts` and for the same reason: a written
 * page that promises something the portal does not do is a page that has to be
 * corrected by whoever notices, and nobody notices prose.
 *
 * Two sentences were measured wrong on 30.08.2026 and both are held here.
 */

const BODIES = Object.entries(pages).flatMap(([slug, page]) =>
  page.sections.map((section) => ({ slug, heading: section.heading, body: section.body })),
)

/** Every passage that speaks about a result which has not been approved yet. */
const ABOUT_WAITING = BODIES.filter(({ body }) => body.includes('Neverifikovan rezultat'))

/** Every passage that speaks about the administration correcting one. */
const ABOUT_CORRECTING = BODIES.filter(({ body }) => body.includes('Administracija sme da ispravi'))

describe('what the rulebook says about a result that is waiting', () => {
  it('is written about at all, so what follows is not a check over an empty list', () => {
    /* Both lists are one passage today. Written as a floor rather than as the
       number, since the rulebook is one long page and a passage may be split. */
    expect(ABOUT_WAITING.length).toBeGreaterThan(0)
    expect(ABOUT_CORRECTING.length).toBeGreaterThan(0)
  })

  it('promises only that it is not shown publicly, which is what the portal does', () => {
    /* „Neverifikovan rezultat se nigde ne prikazuje" was not true and stood in
       the rulebook until 30.08.2026: a member sees their own waiting result in
       „Moji rezultati", marked „Čeka proveru", and that screen is where they
       delete it or change it, which the owner decided on 27.08.2026. A moderator
       sees it in the queue. Measured the same day: submissions are read by five
       files, two screens of the administration, two of the member, and the form
       itself, and by nothing public.

       So the promise the portal can keep is the public one, and the word is what
       makes the sentence true rather than nearly true. */
    for (const { slug, heading, body } of ABOUT_WAITING) {
      expect(body, `${slug}, ${heading}`).toContain('nigde javno ne prikazuje')
    }
  })

  it('says the administration may correct a result while it is being verified, not only after', () => {
    /* The article spoke of „verifikovanog rezultata", a result already verified,
       while the correction the owner described happens **at** verification, on
       one that is not verified yet (owner, 30.08.2026: „ja ću lako promeniti
       njegovo vreme sa recimo 23:23:15 na 24:00:00"). A rule that covers only the
       later moment does not cover the ordinary one. */
    for (const { slug, heading, body } of ABOUT_CORRECTING) {
      expect(body, `${slug}, ${heading}`).toContain('pri verifikaciji i posle nje')
    }
  })

  it('tells the competitor what to do when they think a correction is wrong', () => {
    /* The other half of the owner's own wording, and the half a rule about the
       administration's rights does not carry by itself: „ukoliko takmičar
       proceni da se radi o grešci da može da kontaktira". */
    for (const { slug, heading, body } of ABOUT_CORRECTING) {
      expect(body, `${slug}, ${heading}`).toContain('obraća se ligi')
    }
  })
})
