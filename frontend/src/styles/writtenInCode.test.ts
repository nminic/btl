import { bare, inside, sources, WHOLE_PORTAL } from '../test/sources'

/**
 * No screen says anything in Serbian in its own voice.
 *
 * **Why this exists.** A sentence written straight into a component reaches the
 * portal and cannot be corrected by whoever the words belong to: not by the owner,
 * who dictates them, and not by an administrator, who maintains the written pages.
 * It is also invisible to every guard the portal has over its words — the snapshot
 * of the dictionary holds keys, the snapshot of the drawn screens holds the seats it
 * happens to take, and the sweep of the words a competition is written with reads
 * only the components named after one.
 *
 * Measured, and it is why this is a high finding rather than a tidy-up: a sentence
 * appended to the branch `components/Resource.tsx` draws when a file does not arrive
 * passed the whole gate, all 2448 tests green (review, 03.09.2026). Nothing there
 * said it, and nothing anywhere would have.
 *
 * **What it reads.** Every `.tsx` the portal ships, comments blanked, looking for the
 * letters that only Serbian writes: č, ć, ž, š, đ. That is a narrower question than
 * „is this a sentence", and it is the one that can be answered without deciding what
 * counts as prose. A name written in the Latin alphabet the two languages share —
 * „Dunav", „Novi Sad" — is not caught, and that is the honest limit of it: what is
 * caught is every sentence anybody would actually write for a Serbian reader, because
 * a sentence of any length carries one of those five letters.
 *
 * **What it does not read**, said plainly: `.ts` files, which draw nothing, and the
 * records that stand in for a database (`data/seedMessages.ts`, `public/mock`), which
 * are rows somebody will replace rather than words a screen says. The one component
 * that carried such records had them moved out on 05.09.2026 rather than excused, so
 * this has no exception at all.
 */
const DRAWN = sources().filter(({ path }) => path.endsWith('.tsx'))

/** The five letters no other language on this portal writes. */
const SERBIAN = /[čćžšđČĆŽŠĐ]/

/** Where a text stands in the source, near enough to point at. */
function saidIn(code: string): string[] {
  const blanked = bare(code)

  return [
    /* A quoted string of any kind, and the words standing directly in the markup.
       Asked of the opening of each rather than of a balanced pair, because a sentence
       is what is being looked for and a sentence is inside one of these three. */
    ...[...blanked.matchAll(/'[^'\n]{2,}'|"[^"\n]{2,}"|`[^`\n]{2,}`/g)].map((one) => one[0]),
    ...[...blanked.matchAll(/>[^<>{}\n]{2,}</g)].map((one) => one[0]),
  ].filter((one) => SERBIAN.test(one))
}

describe('what a screen says in its own voice', () => {
  it('is nothing at all, in every component the portal ships', () => {
    const said = DRAWN.flatMap(({ path, code }) =>
      saidIn(code).map((one) => `${path}: ${one.slice(0, 60)}`),
    )

    expect(said).toEqual([])
  })

  it('is asked of the whole portal, and of a file that is really there', () => {
    /* The floor and the witness, because a sweep that finds nothing agrees with
       everything: the list emptied, the case above passes while a sentence stands on
       a screen. Held the way `forms/fieldHint.test.tsx` holds its own. */
    expect(DRAWN.length).toBeGreaterThan(WHOLE_PORTAL / 2)
    expect(DRAWN.some(({ path }) => path.endsWith(inside('components', 'Resource.tsx')))).toBe(true)
  })

  it('reads the letters and not the length', () => {
    /* The expression itself, asked of text rather than of the portal: a check over
       source is only as good as what it recognises, and this one is deliberately
       narrow. Both halves are named so the next reader knows what it does not catch.
     */
    expect(saidIn("const one = 'Predlog tima je vraćen'")).toHaveLength(1)
    expect(saidIn('<p>Ovo je rečenica</p>')).toHaveLength(1)
    expect(saidIn('const one = `Tim „${name}“ čeka odluku`')).toHaveLength(1)
    /* And what it lets through, which is the limit written down rather than found:
       words the two alphabets share, and anything a comment says. */
    expect(saidIn("const one = 'Dunav Novi Sad'")).toEqual([])
    expect(saidIn("/* Član 44 kaže ovako */ const one = 'plain'")).toEqual([])
  })
})
