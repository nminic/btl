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
 * home could not have been seen. **The homes are counted first, and then both are
 * asked the same questions.**
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

/** Every passage where somebody in the league corrects one. Both pages now say
 *  „Administracija sme da ispravi"; until 31.08.2026 the terms said
 *  „Administrator", one rule in two voices, and a filter written on the whole
 *  phrase saw one home where there are two. Matched on the part that does not
 *  change with the voice, so a third wording is found rather than missed. */
const ABOUT_CORRECTING = BODIES.filter(({ body }) => /sme da ispravi/i.test(body))

/** Which pages a list of passages falls in, each named once. */
const pagesOf = (found: typeof BODIES) => [...new Set(found.map((one) => one.slug))].sort()


describe('what the written pages say about a result that is waiting', () => {
  it('is written in exactly the two pages that carry these rules', () => {
    /* The count, before any wording. A third page picking this up is a third
       place to correct, and the two that exist were already corrected apart:
       until 30.08.2026 both said a waiting result is shown nowhere, the rulebook
       was put right and the terms were not, and no test could tell.

       The terms are asked the same thing below, which they were not until
       31.08.2026: their passage is the published side of a draft in
       `btl-produkt/pravni/`, closed by the owner on 21.08.2026 („po pravnim
       dokumentima se više ne petlja"), so it waited for his instruction rather
       than being corrected here. He gave it, both homes were changed together,
       and a comment saying otherwise would send the next reader to add a rule for
       the rulebook alone and reopen the hole this file exists to close. */
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

  it('no longer promises on any written page how the tables look', () => {
    /* The tail of Član 43 went out on the owner's instruction, 30.08.2026: „, pa
       u tabelama nema ni oznake „nepotvrđen"". It was a consequence rather than a
       rule, and a promise about how a screen looks, which ages faster than a rule
       does. Held as a sentence that must not come back, the way the five struck
       on 21.08.2026 are held (`writtenPages.test.tsx`), because a deletion with
       nothing holding it is a deletion somebody restores while tidying.

       Asked of every written page and not only of the two that carry this rule:
       the sentence was a promise about a table, and a table is drawn on more pages
       than these. Nothing else says the word today, so refusing it everywhere costs
       nothing and catches it wherever it is put back. */
    for (const { slug, heading, body } of BODIES) {
      expect(body, `${slug}: ${heading}`).not.toMatch(/[Nn]epotvrđen/)
    }
  })

  it('says in both of them that a result is corrected while it is being verified, and not after', () => {
    /* Two corrections, a day apart, and the second undid half of the first.

       The article spoke of „verifikovanog rezultata", a result already verified,
       while the correction the owner described happens **at** verification, on one
       that is not verified yet (owner, 30.08.2026: „ja ću lako promeniti njegovo
       vreme sa recimo 23:23:15 na 24:00:00"). A rule covering only the later moment
       does not cover the ordinary one, so „pri verifikaciji i posle nje" was written.

       **The second half of that was not true and is gone.** The portal cannot touch
       a decided result at all: `SessionProvider` returns the record unchanged for
       anything that is not `pending`, the queue draws only what waits, and the
       administration has no result among its records. Found in review on 31.08.2026
       and settled by the owner the same day: the text says what the portal does, and
       correcting an approved result is written down as work he may order.

       So both halves are asked. „posle nje" refused as well as „pri verifikaciji"
       required, because a rule that grows a second moment back is the same promise
       returning, and it would return in exactly those words. */
    for (const { slug, heading, body } of ABOUT_CORRECTING) {
      expect(body, `${slug}: ${heading}`).toMatch(/pri verifikaciji/)
      expect(body, `${slug}: ${heading}`).not.toMatch(/posle nje|posle verifikacije sme/)
    }
  })

  it('names, in both of them, the four things verification really changes', () => {
    /* The list was „vreme, dužinu, uspon, spust, trku ili link", and four of those
       six are fields no screen offers: the panel writes `eventName`, `raceName`,
       `raceKind` and `seconds` and the `Amendment` type allows nothing else. So it
       promised corrections that cannot be made and left out the two that are made
       most often — the name of the event and the kind of the race, which is the very
       thing the member only hints at (PDL, 30.08.2026, point 4).

       That matters more than a wrong list usually would: point 16 makes this sentence
       the **one warning given in advance**, in place of a note per correction. A
       warning that does not name what is corrected is not one. */
    for (const { slug, heading, body } of ABOUT_CORRECTING) {
      expect(body, `${slug}: ${heading}`).toMatch(/naziv događaja, naziv trke, vrstu trke i vreme/)
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
       is held in the case above: a deletion with nothing holding it is a deletion
       somebody restores while tidying. Asked of every written page rather than of
       the one that carried them, because a promise moved to a neighbouring page is
       a promise still made.

       **Three things are refused, not two, and the first is refused by its stem.**
       The first draft named two cases of one phrase, „staru vrednost" and „stara
       vrednost", so „obaveštenje **sa starom vrednošću**" walked past it — the same
       promise in the same words, one case further along — and so did „prethodnom
       vrednošću". And the title promised a name beside a result while nothing held
       it, so half of the second sentence could come back alone (all measured in
       review, 31.08.2026). „ime administratora" is safe to refuse whole: the pages
       speak of an „administrator tima" elsewhere, and this asks for the name of one.

       What this cannot hold is a promise invented in wholly different words. That
       is said here rather than left to be found. */
    for (const { slug, heading, body } of BODIES) {
      expect(body, `${slug}: ${heading}`).not.toMatch(/(?:star|prethodn)\w*\s+vredno/i)
      expect(body, `${slug}: ${heading}`).not.toMatch(/datum poslednje izmene/)
      expect(body, `${slug}: ${heading}`).not.toMatch(/ime(?:nom)? administratora/i)

      /* And a third promise, deleted the same day for the same reason: „Tuđi
         rezultat možete prijaviti; prijava ide tiho". No control on the portal does
         it and no article describes it, so the owner had it go. */
      expect(body, `${slug}: ${heading}`).not.toMatch(/[Tt]uđi rezultat možete prijaviti/)
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
