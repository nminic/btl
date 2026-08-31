import pages from '../../public/mock/pages.json'

/* What the written pages say about verifying a result, frozen whole.
 *
 * **Why the whole passage and not the rules inside it.** This file spent five
 * rounds of review writing patterns over prose, and every one of them was measured
 * wrong in one direction or the other. A ban on a word refuses what is true — „…a
 * ne i posle nje" is exactly the settled rule and fell to a ban on „posle", and a
 * sentence in the privacy policy about deleting an account fell to a ban meant for
 * a sentence about deleting a result. And it misses what is false, because prose
 * has no end of wordings: „i posle verifikacije" walked past a ban naming „posle
 * nje", „Verifikovan rezultat ne možete obrisati" walked past one built on the word
 * „posle", „obaveštenje sa vrednošću pre izmene" walked past one naming „staru
 * vrednost", and a list grown with two other fields walked past one naming four.
 * Freezing one sentence was the same fault one size up: a second sentence added
 * beside it was invisible, which the guard it replaced had caught.
 *
 * That is not a pattern that can be written better. Prose says one thing in
 * unboundedly many ways, so a pattern over it is a guess about wording, and what is
 * guarded here is not wording but **what the league promises**.
 *
 * So the passage is held as it stands. Nothing can be added, removed, reordered or
 * reworded without this failing, and there is nothing left for a wording to slip
 * past. The five rounds are written up in `btl-produkt/PENDING.md`.
 *
 * **What it costs, said plainly.** Every deliberate change to these words has to be
 * made here too, including a change to the markdown around them: the draft these
 * pages are published from writes the same rule with `**` around its opening, so
 * publishing from it unchanged would fail this. That is the price of a text the
 * owner dictates sentence by sentence, and it is the right price — the last four
 * changes to this passage were each his instruction, and each should cost a
 * deliberate act rather than slip through on a pattern that happened not to match.
 *
 * **What is still asked separately:** that both pages carry these rules at all. A
 * passage silently dropped from one of them would leave the other frozen and
 * correct, and nobody would notice — which is the fault this file was opened for on
 * 30.08.2026, when Član 43 was put right and the terms were left saying the old
 * thing.
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
 *  change with the voice. */
const ABOUT_CORRECTING = BODIES.filter(({ body }) => /sme da ispravi/i.test(body))

/** Which pages a list of passages falls in, each named once. */
const pagesOf = (found: typeof BODIES) => [...new Set(found.map((one) => one.slug))].sort()

/** What one page says from a heading onwards, which is where these rules live. */
function from(slug: string, heading: string): string {
  const body = BODIES.filter((one) => one.slug === slug)
    .map((one) => one.body)
    .find((one) => one.includes(heading))

  if (body === undefined) {
    throw new Error(`${slug} no longer has a passage under „${heading}"`)
  }

  return body.slice(body.indexOf(heading))
}

/** The terms, from the sub-heading to the end of the section. */
const TERMS = `### Verifikacija rezultata

Nijedan rezultat ne ulazi u rang liste dok ga ne odobrimo. Neverifikovan rezultat se nigde javno ne prikazuje. Administracija sme da ispravi činjenične podatke rezultata pri verifikaciji: naziv događaja, naziv trke, vrstu trke i vreme. Bodove ne dira nikada, jer su izračunata vrednost. Takmičar koji smatra da je ispravka greška obraća se ligi.`

/** The rulebook, both articles, which are the last thing in their section. */
const RULEBOOK = `### Član 43. Rezultat ulazi tek posle odobrenja

Nijedan rezultat ne ulazi u rang liste dok ga liga ne odobri. Neverifikovan rezultat se nigde javno ne prikazuje.

### Član 44. Ispravke

Administracija sme da ispravi činjenične podatke rezultata pri verifikaciji: naziv događaja, naziv trke, vrstu trke i vreme. Takmičar koji smatra da je ispravka greška obraća se ligi.`

describe('what the written pages say about a result that is waiting', () => {
  it('is written in exactly the two pages that carry these rules', () => {
    /* The count, before any wording. A third page picking this up is a third place
       to correct, and the two that exist were already corrected apart: until
       30.08.2026 both said a waiting result is shown nowhere, the rulebook was put
       right and the terms were not, and no test could tell. */
    expect(pagesOf(ABOUT_WAITING)).toEqual(['pravilnik', 'uslovi-koriscenja'])
    expect(pagesOf(ABOUT_CORRECTING)).toEqual(['pravilnik', 'uslovi-koriscenja'])
  })

  it('says in the terms exactly what the owner settled, and nothing beside it', () => {
    expect(from('uslovi-koriscenja', '### Verifikacija rezultata')).toBe(TERMS)
  })

  it('says in the rulebook exactly what the owner settled, and nothing beside it', () => {
    expect(from('pravilnik', '### Član 43.')).toBe(RULEBOOK)
  })

  it('no longer promises on any written page a mark in the tables for a waiting result', () => {
    /* The tail of Član 43 went out on the owner's instruction, 30.08.2026: „, pa u
       tabelama nema ni oznake „nepotvrđen"". It was a consequence rather than a
       rule, and a promise about how a screen looks, which ages faster than a rule
       does.

       Held across every page rather than inside the two frozen ones, which is the
       one thing freezing cannot do: a promise moved to a neighbouring page is a
       promise still made, and this word is said nowhere today. */
    for (const { slug, heading, body } of BODIES) {
      expect(body, `${slug}: ${heading}`).not.toMatch(/[Nn]epotvrđen/)
    }
  })
})
