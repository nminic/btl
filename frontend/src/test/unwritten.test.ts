import { unwritten } from './unwritten'

/**
 * The blanker that takes the prose out of a file so a sweep reads its code.
 *
 * It has one home and two readers (`pages/writtenPages.test.tsx` and
 * `styles/hooks.test.ts`), and it was written a second time from memory on
 * 23.08.2026 as „from `//` to the end of the line". That was measured wrong the
 * same day: `//` inside a string is not a comment, so `src/app/head.ts` came out
 * reading `export const SITE_ORIGIN = 'https:` and an offender written after that
 * string on the same line was invisible.
 *
 * Here since 28.08.2026, and it is here rather than where it was written for one
 * reason: this was the only guard over the helper and it stood inside a `describe`
 * about something else, so deleting that block would have taken the guard with it
 * and nothing would have said so. Beside the helper it guards, the way `at.ts` and
 * `sources.ts` are guarded.
 */
describe('the code of a file with the prose around it taken out', () => {
  it('reads the code of a file and not the prose around it', () => {
    /* What this sweep reads. The blanker has one home (`test/unwritten.ts`) and two
       readers, this and `styles/hooks.test.ts`; it was written a second time here
       from memory on 23.08.2026 as „from `//` to the end of the line", and that was
       measured wrong the same day: `//` inside a string is not a comment, so
       `src/app/head.ts` came out reading `export const SITE_ORIGIN = 'https:` and an
       offender written after that string on the same line was invisible.

       Four shapes, and the last two are the ones that cost something. */
    const quote = String.fromCharCode(39)
    const asks = `startsWith(${quote}|${quote})`

    expect(unwritten(`  // ${asks}\nconst a = 1`), 'a comment survives the blanker')
      .not.toContain(asks)
    expect(unwritten(`const a = 1 // ${asks}`), 'a trailing comment survives the blanker')
      .not.toContain(asks)
    /* An address is not a comment, which is the whole of the first fault. */
    expect(unwritten(`export const SITE_ORIGIN = ${quote}https://primer.rs${quote}`)).toContain(
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

    expect(unwritten(upload), 'the code between an `accept` and the next comment is gone').toContain(
      asks,
    )
  })

})
