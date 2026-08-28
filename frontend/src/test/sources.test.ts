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

  it('answers with a text the same length, so a position in it still holds', () => {
    /* Blanked and not removed, which is the whole reason this returns spaces. A
       sweep that reports a line number reports it against what it read, so the
       two texts have to agree on where everything is. */
    const code = 'a /* note */ b // tail\nc'

    expect(bare(code)).toHaveLength(code.length)
    expect(bare(code).split('\n')).toHaveLength(2)
  })
})
