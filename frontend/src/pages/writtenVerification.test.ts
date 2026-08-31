import pages from '../../public/mock/pages.json'
import settled from '../test/writtenPages.snapshot.json'

/* What the written pages say, held exactly as the owner settled it.
 *
 * **Seven rounds of review were spent doing this with patterns, and it did not
 * converge.** Every round refused the wordings the round before let through, and every
 * round a new one arrived, because a language has no end of ways to say one thing.
 * Measured, in order: „i posle verifikacije" past a refusal naming „posle nje";
 * „Verifikovan rezultat ne možete obrisati" past one built on „posle"; „vrednošću pre
 * izmene" past one naming „staru vrednost"; a list joined by „i" past one written over
 * commas; „dužina" past one naming „dužinu"; the same rule in another section past a
 * freeze that held one section; the subject named by the pronoun „ga" past a refusal
 * that asked for the word „rezultat"; „briše" past one asking for „obriš"; three of
 * five things named past one that required all five; „dolaze iz te trke" past a filter
 * that knew „iz nje" and „dolaze sa"; and „bez obzira na to da li ih ta trka zadaje"
 * past a rule that asked only whether the word „zadaje" appears.
 *
 * And the same patterns kept refusing text nobody had decided anything about, because
 * the words are ordinary: deleting an **account**, the name of a **team**
 * administrator, an unconfirmed **account**, and the rule about deleting a photograph
 * that the rulebook itself carries.
 *
 * Nothing has ever escaped from **inside** a frozen passage. Every escape has been
 * outside the range that was frozen, and each round the range grew by one level while
 * the escape moved one level further. So the range is the whole of it.
 *
 * **Every section of every written page is held as it stands**, against a snapshot in
 * `test/writtenPages.snapshot.json`. Nothing can be added, removed, reworded, moved to
 * a neighbouring section or to another page, said with a pronoun or with a prefix, and
 * no wording is left for anything to slip past.
 *
 * **What it costs, said plainly.** Every deliberate change to any written page has to
 * be made in the snapshot too. These are four documents the owner dictates sentence by
 * sentence — the rulebook, the terms, the privacy policy and his own address — and the
 * last six changes to them were each his instruction. A deliberate act is what such a
 * change should cost, and it is cheaper than a round of review each time a pattern
 * turns out to have a hole.
 *
 * What this cannot do is tell a true sentence from a false one. That is not a guard's
 * work: the text is read once, by whoever settles it, and after that the only question
 * is whether it changed.
 */

const BODIES = Object.entries(pages).flatMap(([slug, page]) =>
  page.sections.map((section) => ({ slug, heading: section.heading, body: section.body })),
)

/** Every passage that uses the word for a result which has not been approved yet. */
const ABOUT_WAITING = BODIES.filter(({ body }) => /neverifikovan/i.test(body))

/** Every passage where somebody in the league corrects one. Both pages say
 *  „Administracija sme da ispravi"; until 31.08.2026 the terms said „Administrator",
 *  one rule in two voices, and a filter written on the whole phrase saw one home where
 *  there are two. Matched on the part that does not change with the voice. */
const ABOUT_CORRECTING = BODIES.filter(({ body }) => /sme da ispravi/i.test(body))

/** Where a list of passages stands, page and section both. Counted by page alone until
 *  31.08.2026, and a second passage on a page already counted was then nobody's
 *  business: a whole correcting rule was put into „9. Prijava rezultata" and the count
 *  still said the two pages it expected. */
const placesOf = (found: typeof BODIES) => found.map((one) => `${one.slug}: ${one.heading}`).sort()

/** What the pages say now, in the shape the snapshot holds. */
const asWritten: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(pages).map(([slug, page]) => [
    slug,
    Object.fromEntries(page.sections.map((section) => [section.heading, section.body])),
  ]),
)

describe('the written pages', () => {
  it('say exactly what the owner settled, section by section', () => {
    /* Asked page by page rather than all at once, so a failure names the page before
       it prints anything: four documents in one comparison is a diff nobody reads. */
    for (const [slug, sections] of Object.entries(settled)) {
      expect(asWritten[slug], slug).toEqual(sections)
    }

    /* And no page has appeared or gone. */
    expect(Object.keys(asWritten).sort()).toEqual(Object.keys(settled).sort())
  })

  it('carry the rules about a waiting result in exactly the two places they belong', () => {
    /* The snapshot says the text has not changed; this says where these two rules
       live, which is the question a snapshot cannot answer on its own. A third place
       picking one up is a third place to correct, and the two that exist were already
       corrected apart: until 30.08.2026 both said a waiting result is shown nowhere,
       the rulebook was put right and the terms were not, and no test could tell. */
    expect(placesOf(ABOUT_WAITING)).toEqual([
      'pravilnik: 10. Verifikacija rezultata',
      'uslovi-koriscenja: 5. Unos i verifikacija rezultata',
    ])
    expect(placesOf(ABOUT_CORRECTING)).toEqual([
      'pravilnik: 10. Verifikacija rezultata',
      'uslovi-koriscenja: 5. Unos i verifikacija rezultata',
    ])
  })
})
