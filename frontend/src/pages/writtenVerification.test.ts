import pages from '../../public/mock/pages.json'

/* What the written pages say about entering and verifying a result, held whole.
 *
 * **Why the whole section and not the rules inside it.** Six rounds of review were
 * spent here writing patterns over prose, and every one was measured wrong in one
 * direction or the other. A ban on a word refuses what is true — „…a ne i posle nje"
 * is exactly the settled rule and fell to a ban on „posle", and a sentence in the
 * privacy policy about deleting an account fell to a ban meant for one about
 * deleting a result. And it misses what is false, because prose has no end of
 * wordings: „Verifikovan rezultat ne možete obrisati" walked past a ban built on
 * „posle", „obaveštenje sa vrednošću pre izmene" walked past one naming „staru
 * vrednost", and an enumeration came back joined by „i" instead of commas.
 *
 * Freezing was then done twice too small. A frozen sentence left the sentence beside
 * it invisible. A frozen passage left the head of its own section invisible: text put
 * one blank line above the heading is in the same section, on the same screen, and
 * two of the deleted promises went back in there with the whole gate green.
 *
 * So the unit is the **section**, which is what a reader meets as one piece.
 *
 * **And freezing does not replace what was held across all pages.** Four refusals
 * went out when the first freeze came in, and they were the only guard that did not
 * depend on where a sentence is put: a promise moved to a neighbouring page is a
 * promise still made. Both are here now, because they answer different questions —
 * the frozen text says these two sections are exactly what the owner settled, and
 * the refusals say the deleted promises are nowhere at all.
 *
 * **What it costs, said plainly.** Every deliberate change to these words has to be
 * made here too, including a change to the markdown around them: the draft these
 * pages are published from writes one rule with `**` around its opening, so
 * publishing from it unchanged would fail this. That is the price of a text the owner
 * dictates sentence by sentence, and the last five changes to it were each his
 * instruction.
 */

const BODIES = Object.entries(pages).flatMap(([slug, page]) =>
  page.sections.map((section) => ({ slug, heading: section.heading, body: section.body })),
)

/** Every passage that uses the word for a result which has not been approved yet.
 *  The word, since the two pages say the rule in their own turns of phrase. */
const ABOUT_WAITING = BODIES.filter(({ body }) => /neverifikovan/i.test(body))

/** Every passage where somebody in the league corrects one. Both pages say
 *  „Administracija sme da ispravi"; until 31.08.2026 the terms said „Administrator",
 *  one rule in two voices, and a filter written on the whole phrase saw one home
 *  where there are two. Matched on the part that does not change with the voice. */
const ABOUT_CORRECTING = BODIES.filter(({ body }) => /sme da ispravi/i.test(body))

/** Where a list of passages stands, page and section both. Counted by page alone
 *  until 31.08.2026, and a second passage on a page already counted was then nobody's
 *  business: a whole correcting rule was put into „9. Prijava rezultata" and the count
 *  still said the two pages it expected (review, 31.08.2026). */
const placesOf = (found: typeof BODIES) => found.map((one) => `${one.slug}: ${one.heading}`).sort()

/** The body of one section, whole. */
function section(slug: string, heading: string): string {
  const found = BODIES.filter((one) => one.slug === slug && one.heading === heading)

  if (found.length !== 1) {
    throw new Error(`${slug} has ${String(found.length)} sections called „${heading}"`)
  }

  return found[0]?.body ?? ''
}

/** The terms, section 5, as the owner settled it. */
const TERMS = `Rezultati su srce lige i ovo je jedini deo ovih uslova gde ozbiljno računamo na vaše poštenje. Rezultat prijavljujete na dva načina: kroz formu na svom profilu, gde unosite naziv trke, datum, vrstu trke, mesto, dužinu, uspon, spust, vreme i link ka zvaničnim rezultatima; ili dugmetom u redu trke na strani samog događaja, gde portal sa te trke preuzima ono što ona zadaje. Link je obavezan osim ako priložite sliku; tada je obavezan komentar uz nju.

1. Prijavljujete samo trke koje ste sami istrčali.
2. Rok za prijavu je dva dana od dana trke. Kasniju prijavu i dalje unosimo, ali je kršenje ovog pravila razlog za meru iz sekcije 7.
3. Link ka zvaničnim rezultatima je obavezan osim ako priložite sliku. Slika, diploma ili snimak ekrana sata, prihvata se kao dokaz samo uz komentar u kom kažete zbog čega izostaje link ka zvaničnim rezultatima, šta se na slici vidi, i brišemo je odmah posle provere.
4. Boduje se samo trka na kojoj je zvanično mereno vreme.
5. Unosi se neto vreme, u obliku \`hh:mm:ss\`, bez desetinki.
6. Za maraton i polumaraton dužina se unosi tačno kao \`42.2\` i \`21.1\`, bez tolerancije; svaka druga vrednost svrstava trku u drugu kategoriju po dužini.
7. Ako trke nema u kalendaru, prijavite je svejedno; administrator će uz vaš rezultat napraviti i događaj i trku.
8. Isti rezultat se prijavljuje jednom. Sa jednog događaja možete imati više rezultata ako ste trčali više trka, ali ne dva sa iste trke.
9. Ako trku niste završili, rezultata nema. Odustajanje i nedolazak ne evidentiramo.
10. Ako ste prešli na kraću trku, rezultat priznajemo samo ako ste u zvaničnim rezultatima te kraće trke.

### Verifikacija rezultata

Nijedan rezultat ne ulazi u rang liste dok ga ne odobrimo. Neverifikovan rezultat se nigde javno ne prikazuje. Administracija sme da ispravi činjenične podatke rezultata pri verifikaciji: naziv događaja, naziv trke, vrstu trke i vreme. Bodove ne dira nikada, jer su izračunata vrednost. Takmičar koji smatra da je ispravka greška obraća se ligi.`

/** The rulebook, section 10, as the owner settled it. */
const RULEBOOK = `### Član 43. Rezultat ulazi tek posle odobrenja

Nijedan rezultat ne ulazi u rang liste dok ga liga ne odobri. Neverifikovan rezultat se nigde javno ne prikazuje.

### Član 44. Ispravke

Administracija sme da ispravi činjenične podatke rezultata pri verifikaciji: naziv događaja, naziv trke, vrstu trke i vreme. Takmičar koji smatra da je ispravka greška obraća se ligi.`

describe('what the written pages say about entering and verifying a result', () => {
  it('is written in exactly the two places that carry these rules', () => {
    /* The count, before any wording, and by place rather than by page. A third
       passage picking this up is a third place to correct, and the two that exist
       were already corrected apart: until 30.08.2026 both said a waiting result is
       shown nowhere, the rulebook was put right and the terms were not, and no test
       could tell. */
    expect(placesOf(ABOUT_WAITING)).toEqual([
      'pravilnik: 10. Verifikacija rezultata',
      'uslovi-koriscenja: 5. Unos i verifikacija rezultata',
    ])
    expect(placesOf(ABOUT_CORRECTING)).toEqual([
      'pravilnik: 10. Verifikacija rezultata',
      'uslovi-koriscenja: 5. Unos i verifikacija rezultata',
    ])
  })

  it('says in the terms exactly what the owner settled, and nothing beside it', () => {
    expect(section('uslovi-koriscenja', '5. Unos i verifikacija rezultata')).toBe(TERMS)
  })

  it('says in the rulebook exactly what the owner settled, and nothing beside it', () => {
    expect(section('pravilnik', '10. Verifikacija rezultata')).toBe(RULEBOOK)
  })

  it('makes none of the deleted promises about a result, on any written page', () => {
    /* Five sentences the owner had deleted, held wherever they might be put. This is
       what freezing cannot do, and what went out with the first freeze until a review
       put it back: a promise moved to a neighbouring page, or to the head of the same
       section, is a promise still made.

       **Asked of a sentence, and only of one that is about a result.** Written over a
       whole page instead, the same words refused three things nobody had decided
       anything about: „Nepotvrđen nalog brišemo posle 12 meseci", „Uz svaki tim stoji
       ime administratora tima", and a line in the privacy policy about deleting an
       account. None of those is a promise about a result, and none of them should
       cost a round (all three measured in review, 31.08.2026). The subject is what
       tells them apart, so the subject is asked for.

       **The one about deleting is refused as a pairing, not as a wording.** Its false
       form and its true form are the same words with the polarity swapped — „posle
       toga ne" against „i posle verifikacije" — so no pattern can keep one and refuse
       the other. Split into two narrower patterns it fell out of both and the deleted
       sentence came back in the words it was written in (review, 31.08.2026). What is
       asked instead is that no page says anything at all about deleting a result
       outside the frozen sections: no sentence pairs the two subjects. None does
       today. If the owner ever wants that rule written, it belongs in the section
       about results, and putting it there is a deliberate act that comes here too —
       the same cost the freezing carries, applied for the same reason. */
    const RESULT = /rezultat/i

    for (const { slug, heading, body } of BODIES) {
      for (const sentence of body.split(/(?<=\.)\s+|\n+/)) {
        const where = `${slug}: ${heading}: ${sentence.slice(0, 60)}`

        if (!RESULT.test(sentence)) {
          continue
        }

        expect(sentence, where).not.toMatch(/nepotvrđen/i)
        expect(sentence, where).not.toMatch(/(?:star|prethodn)\w*\s+vredno/i)
        expect(sentence, where).not.toMatch(/vredno\w*\s+pre izmene/i)
        expect(sentence, where).not.toMatch(/datum poslednje izmene/i)
        expect(sentence, where).not.toMatch(/ime(?:nom)? administratora/i)
        expect(sentence, where).not.toMatch(/tuđi rezultat/i)
        expect(sentence, where).not.toMatch(/obris|obriš/i)
      }
    }
  })
})
