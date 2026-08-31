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
 *
 * **Both rules count their homes, and that took two rounds.** The first draft
 * counted none. The second counted them for the waiting result and left the
 * neighbouring constant filtering on „Administracija sme da ispravi", a phrase
 * only the rulebook uses: the terms say „Administrator sme da ispravi", one rule
 * in two voices, so the second home was invisible again and the count said one
 * where there are two. Both are found by the part that does not change with the
 * voice.
 *
 * **The wording is asked of both pages, and that took until 31.08.2026.** It was
 * asked only of the rulebook while the terms still carried the older sentences:
 * they were written down as a question rather than corrected, because the
 * published text is derived from a draft the owner closed on 21.08.2026, and
 * correcting one home without the other puts the old sentence back at the next
 * publication. He read the four sentences and gave the instruction, so both homes
 * were corrected in one go and both are now asked the same questions. Asking only
 * one of them again would leave exactly the hole this file exists to close.
 */

const BODIES = Object.entries(pages).flatMap(([slug, page]) =>
  page.sections.map((section) => ({ slug, heading: section.heading, body: section.body })),
)

/** Every passage that uses the word for a result which has not been approved yet.
 *  The word, since the two pages say the rule in their own turns of phrase. */
const ABOUT_WAITING = BODIES.filter(({ body }) => /neverifikovan/i.test(body))

/** Every passage where somebody in the league corrects one. The rulebook says
 *  „Administracija sme da ispravi" and the terms say „Administrator sme da
 *  ispravi", which is one rule in two voices and was one home too few until
 *  30.08.2026. */
const ABOUT_CORRECTING = BODIES.filter(({ body }) => /sme da ispravi/i.test(body))

/** Which pages a list of passages falls in, each named once. */
const pagesOf = (found: typeof BODIES) => [...new Set(found.map((one) => one.slug))].sort()


describe('what the written pages say about a result that is waiting', () => {
  it('is written in exactly the two pages that carry these rules', () => {
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
    expect(pagesOf(ABOUT_WAITING)).toEqual(['pravilnik', 'uslovi-koriscenja'])
    expect(pagesOf(ABOUT_CORRECTING)).toEqual(['pravilnik', 'uslovi-koriscenja'])
  })

  it('says in both of them that it is not shown publicly', () => {
    /* „Neverifikovan rezultat se nigde ne prikazuje" was not true and stood there
       until 30.08.2026: a member sees their own waiting result in „Moji
       rezultati", marked „Čeka proveru", and that screen is where they delete it
       or change it, which the owner decided on 27.08.2026. A moderator sees it in
       the queue, and the count of what waits is drawn in the shell for whoever
       may open that queue.

       So the promise the portal can keep is the public one, and the word is what
       makes the sentence true rather than nearly true. Matched loosely enough
       that the two words may swap places, since the rule is which promise is
       made and not the order it is written in.

       **What is asked is that the public promise is there, not that nothing else
       was added beside it.** A sentence added saying the member does not see
       their own waiting result either would be untrue and would pass here; the
       title said „only" for one round and this is the correction. Holding „and
       nothing else" over prose means listing what may be said, which is a rule
       nobody could keep. */
    for (const { slug, heading, body } of ABOUT_WAITING) {
      expect(body, `${slug}: ${heading}`).toMatch(/nigde javno|javno nigde/)
    }
  })

  it('no longer promises in either of them how the tables look', () => {
    /* The tail of Član 43 went out on the owner's instruction, 30.08.2026: „, pa
       u tabelama nema ni oznake „nepotvrđen"". It was a consequence rather than a
       rule, and a promise about how a screen looks, which ages faster than a rule
       does. Held as a sentence that must not come back, the way the five struck
       on 21.08.2026 are held (`writtenPages.test.tsx`), because a deletion with
       nothing holding it is a deletion somebody restores while tidying. */
    for (const { slug, heading, body } of BODIES) {
      expect(body, `${slug}: ${heading}`).not.toMatch(/[Nn]epotvrđen/)
    }
  })

  it('says in both of them that a result may be corrected while it is being verified', () => {
    /* The article spoke of „verifikovanog rezultata", a result already verified,
       while the correction the owner described happens **at** verification, on
       one that is not verified yet (owner, 30.08.2026: „ja ću lako promeniti
       njegovo vreme sa recimo 23:23:15 na 24:00:00"). A rule that covers only the
       later moment does not cover the ordinary one. */
    for (const { slug, heading, body } of ABOUT_CORRECTING) {
      expect(body, `${slug}: ${heading}`).toMatch(/pri verifikaciji (i|kao i) posle nje/)
    }
  })

  it('promises in neither of them a notice carrying the old value, or a name beside a result', () => {
    /* Two promises the terms carried alone, deleted on the owner's instruction of
       31.08.2026 after he read the passage („Obriši rečenice iz nalaza 3 i 4 kako
       si predložio").

       Neither was true. „O svakoj izmeni vašeg rezultata dobijate obaveštenje i ono
       sadrži staru vrednost" is the opposite of the decision of 30.08.2026, which
       settled on one warning given in advance instead of a note per submission; and
       „Uz svaki rezultat stoji datum poslednje izmene i ime administratora" is what
       Član 44 lost on 22.08.2026, leaving the terms the only document promising it
       and the portal showing neither.

       Held as sentences that must not come back, the same way the tail of Član 43
       is held below: a deletion with nothing holding it is a deletion somebody
       restores while tidying. Asked of every written page rather than of the one
       that carried them, because a promise moved to a neighbouring page is a
       promise still made. */
    for (const { slug, heading, body } of BODIES) {
      expect(body, `${slug}: ${heading}`).not.toMatch(/staru vrednost|stara vrednost/)
      expect(body, `${slug}: ${heading}`).not.toMatch(/datum poslednje izmene/)
    }
  })

  it('tells the competitor, in both of them, what to do when they think a correction is wrong', () => {
    /* The other half of the owner's own wording, and the half a rule about the
       administration's rights does not carry by itself: „ukoliko takmičar
       proceni da se radi o grešci da može da kontaktira". */
    for (const { slug, heading, body } of ABOUT_CORRECTING) {
      expect(body, `${slug}: ${heading}`).toMatch(/obraća se ligi/)
    }
  })
})
