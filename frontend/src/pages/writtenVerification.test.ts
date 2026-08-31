import pages from '../../public/mock/pages.json'
import { must } from '../test/at'

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

  it('no longer promises on any written page a mark in the tables for a waiting result', () => {
    /* The tail of Član 43 went out on the owner's instruction, 30.08.2026: „, pa
       u tabelama nema ni oznake „nepotvrđen"". It was a consequence rather than a
       rule, and a promise about how a screen looks, which ages faster than a rule
       does. Held as a sentence that must not come back, the way the five struck
       on 21.08.2026 are held (`writtenPages.test.tsx`), because a deletion with
       nothing holding it is a deletion somebody restores while tidying.

       Asked of every written page and not only of the two that carry this rule:
       the sentence was a promise about a table, and a table is drawn on more pages
       than these. Nothing else says the word today, so refusing it everywhere costs
       nothing and catches it wherever it is put back.

       **The name of this case used to promise a class and hold a word.** „How the
       tables look" would cover „u tabelama nema ni oznake za rezultat koji čeka
       proveru", the same promise retold, which walks past a guard on one word
       (review, 31.08.2026). Rather than chase every retelling, the name now says
       what is held: the two words the sentence was struck for. */
    for (const { slug, heading, body } of BODIES) {
      expect(body, `${slug}: ${heading}`).not.toMatch(/[Nn]epotvrđen/)
    }
  })

  it('carries, in both of them, exactly the sentence the owner settled about correcting', () => {
    /* One assertion in place of five, and the reason is worth writing down: the five
       were **bans on words**, and a ban on a word is wrong in both directions at once.

       It refuses what is true — „…i vreme, a ne i posle nje" says exactly the rule the
       owner settled and was refused by a ban on „posle", and „…ali ne i dužinu, uspon
       ni spust" was refused by a ban on „dužinu". And it misses what is false, because
       there is always another wording: „pri verifikaciji i posle verifikacije" walked
       past a ban naming „posle nje", and „…i vreme, kao i mesto trke i osvojene bodove"
       walked past a ban naming four other fields. Four rounds of this file went that
       way, one wording at a time (measured in review, 30. and 31.08.2026).

       The sentence itself is the fact. It was settled word by word: the moment it
       covers (owner, 31.08.2026, „Tekst kaže istinu sad"), the four things the panel
       really writes (`Amendment` allows `eventName`, `raceName`, `raceKind`, `seconds`
       and nothing else), and the competitor's recourse. Frozen whole, a second moment
       cannot be added, the list cannot grow or be reordered, and a rewrite has to be a
       deliberate act that comes here as well — which is what a sentence the owner
       dictated should cost.

       The same in both pages, because it is one rule, and the pair of them drifting
       apart is why this file exists at all. */
    const SETTLED =
      'Administracija sme da ispravi činjenične podatke rezultata pri verifikaciji: ' +
      'naziv događaja, naziv trke, vrstu trke i vreme.'

    for (const { slug, heading, body } of ABOUT_CORRECTING) {
      /* Split on the line first and on the full stop after it: the rulebook keeps
         the title of the article on the line above, and it is not part of the rule. */
      const sentence = must(
        body
          .split(/\n+/)
          .flatMap((line) => line.split(/(?<=\.)\s+/))
          .find((one) => /sme da ispravi/.test(one)),
        `the sentence about correcting, in ${slug}`,
      )

      expect(sentence, `${slug}: ${heading}`).toBe(SETTLED)
    }
  })

  it('sends the competitor to the league, in both of them, when they think it is wrong', () => {
    /* The other half of the owner's own wording, and the half a rule about the
       administration's rights does not carry by itself: „ukoliko takmičar proceni da
       se radi o grešci da može da kontaktira" (30.08.2026). It follows the sentence
       above rather than standing inside it, so it is asked for separately. */
    for (const { slug, heading, body } of ABOUT_CORRECTING) {
      expect(body, `${slug}: ${heading}`).toMatch(/[Tt]akmičar koji smatra da je ispravka greška obraća se ligi/)
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

      /* And a fourth, which the owner had deleted the same way („Može li jednostavno
         da se obriše rečenica?"): that a result may be taken back before verification
         and not after. His own P9 says the opposite — „Član sme da obriše svoj
         rezultat i posle verifikacije" — and every counted row carries a delete.

         Refused as the claim rather than as its wording, since what is false is the
         limit and not the words it came in: a sentence that says when deleting stops
         being possible. */
      expect(body, `${slug}: ${heading}`).not.toMatch(/obrisati[^.]*posle|posle[^.]*ne možete obrisati/i)
    }
  })

})
