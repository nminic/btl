import { bare } from './sources'

/**
 * The blanker every sweep of the portal's own source reads through.
 *
 * It had three homes and each of them was a little different, which is how the
 * portal came to have a guard that could not fail: two of the three blanked from
 * the first `//` to the end of the line, so every line carrying an address
 * blanked whatever was written after it. Measured on 23.08.2026 in
 * `src/app/head.ts`: a violation on the same line as an address went unseen while
 * the identical violation on the line below was found.
 *
 * One home since 28.08.2026, and this is the guard it never had. Nothing measured
 * it before, so putting the colon back into the pattern and taking it out again
 * left the whole suite green either way.
 *
 * Five copies rather than three, which a second round of review counted: two more
 * stood in `styles/cellSpecificity.test.ts` and in `test/unwritten.ts`, and the
 * last of those was the only one that knew `accept="image/*"` is not the opening
 * of a comment. Its cases are here, since the function it guarded is this one now.
 */
describe('the code with what it says about itself taken out', () => {
  it('keeps what a line of code says and drops what a comment says', () => {
    expect(bare('const a = 1 // and a word about it').trim()).toBe('const a = 1')
    expect(bare('/* a whole note */ const a = 1').trim()).toBe('const a = 1')
  })

  it('leaves an address alone, which is where two copies of it went wrong', () => {
    /* The line that made this a real fault rather than a nicety: the address is
       code, and what follows it on the line is code too. A blanker that starts at
       the `//` inside `https://` blanks both. */
    const line = "const at = 'https://primer.rs' // where it points"

    expect(bare(line)).toContain("'https://primer.rs'")
    expect(bare(line)).not.toContain('where it points')
  })

  it('reads the code of a file and not the prose around it', () => {
    /* The two faults the five copies of this disagreed about, and both were
       measured on 23.08.2026 and answered in one copy each while the others went
       on carrying them.

       `//` inside a string is not a comment: `src/app/head.ts` came out reading
       `export const SITE_ORIGIN = 'https:` and an offender written after that
       string on the same line was invisible. And `/*` inside a string is not a
       comment either: read as the opening of one, `accept="image/*"` hid sixteen
       lines of `forms/FormRenderer.tsx` and thirteen of
       `components/CropChooser.tsx` from every sweep built on it.

       Four shapes, and the last two are the ones that cost something. */
    const quote = String.fromCharCode(39)
    const asks = `startsWith(${quote}|${quote})`

    expect(bare(`  // ${asks}\nconst a = 1`), 'a comment survives the blanker')
      .not.toContain(asks)
    expect(bare(`const a = 1 // ${asks}`), 'a trailing comment survives the blanker')
      .not.toContain(asks)
    /* An address is not a comment, which is the whole of the first fault. */
    expect(bare(`export const SITE_ORIGIN = ${quote}https://primer.rs${quote}`)).toContain(
      'primer.rs',
    )
    /* And neither is the value of an `accept` attribute. Measured: read as the
       opening of a comment, it hid sixteen lines of `forms/FormRenderer.tsx` and
       thirteen of `components/CropChooser.tsx` from this sweep. */
    const upload = [
      '<input accept="image/*" />',
      `const a = ${asks}`,
      '/* an ordinary comment, which is what closes the window */',
    ].join('\n')

    expect(bare(upload), 'the code between an `accept` and the next comment is gone').toContain(
      asks,
    )
  })

  it('answers with a text the same length, so a position in it still holds', () => {
    /* Blanked and not removed, which is the whole reason this returns spaces. A
       sweep that reports a line number reports it against what it read, so the
       two texts have to agree on where everything is. */
    const code = 'a /* note */ b // tail\nc'

    expect(bare(code)).toHaveLength(code.length)
    expect(bare(code).split('\n')).toHaveLength(2)
  })
})
