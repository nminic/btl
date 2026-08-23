/**
 * One source file with its comments blanked, for the sweeps that read the portal's
 * own code.
 *
 * A rule described in prose is not a rule, and a sweep that reads prose finds the
 * very sentences explaining what it is looking for. `styles/scale.test.ts` keeps the
 * same rule over stylesheets and for the same reason.
 *
 * **One home, since 23.08.2026.** The same idea was written twice, once here as it
 * is now and once in `pages/writtenPages.test.tsx` as „from `//` to the end of the
 * line". The second was measured wrong: `//` inside a string is not a comment, so
 * `src/app/head.ts` came out of it reading `export const SITE_ORIGIN = 'https:` and
 * an offender written after that string on the same line was invisible. The version
 * kept is the one that already answered that, by refusing a `//` that follows a
 * colon.
 *
 * Blanked to a space rather than to nothing, because a sweep that reads words needs
 * the boundary a comment used to be.
 *
 * **Two limits, both measured, both left standing on purpose.**
 *
 * A `//` inside a string that has no colon in front of it is still eaten:
 * `'foo//bar'` loses its tail. Nothing in the portal writes one today.
 *
 * A block comment is recognised only where `/*` is followed by a blank or by a
 * second star, which is how every comment in this repo is written. Without that
 * test, `accept="image/*"` reads as the opening of a comment and everything up to
 * the next `*​/` disappears: measured on 23.08.2026, that hid `forms/FormRenderer.tsx`
 * lines 466 to 481 and `components/CropChooser.tsx` lines 103 to 115 from every
 * sweep. The cost of the test is that `/*written like this*​/` is not recognised as a
 * comment at all; nothing in the portal writes one of those either, and a comment
 * left standing is a false alarm somebody rewrites rather than an offender that
 * quietly disappears.
 */
export function unwritten(code: string): string {
  return code
    .replaceAll(/\/\*(?=[\s*])[\s\S]*?\*\//g, ' ')
    .replaceAll(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}
