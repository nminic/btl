import { screen } from '@testing-library/react'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { renderWithI18n } from '../../test/render'
import { SLOW } from '../../test/slow'
import { sources, WHOLE_PORTAL } from '../../test/sources'
import { EditableText } from './EditableText'

/**
 * EVERY LINK DRAWN OUT OF `addressesIn` IS DRAWN LEFT TO RIGHT, and nothing draws one without a case
 * in this file.
 *
 * **What it prevents, measured.** A right-to-left override or embedding in the word before an address
 * reorders the address as it is drawn, and neither `addressesIn` nor the gate beneath it can see that,
 * because the control is not in the address (review of PR 484, 03.10.2026). It was measured again for
 * this change in Chrome 154.0.8037.95, on the markup the real component draws under the real
 * stylesheet, at 360, 768 and 1280 CSS pixels. Every row below opened `zlo.example`, and was drawn:
 *
 *   - after U+202E, with U+202C behind the address: `https://www.runtrace.net/#/elpmaxe.olz//:sptth`
 *   - after U+202B, with U+05D0 in the path: `www.runtrace.net/<U+05D0>/https://zlo.example`
 *   - after U+2067, with U+05D0 in the path: the same
 *
 * With `dir="ltr"` on the link all three are drawn as they were typed, at all three widths. The same
 * address with no control beside it is drawn as typed with the attribute and without it, and for every
 * text with no control in it the boxes of the links and the sideways scroll of the page are the same
 * with the attribute and without it.
 *
 * **What this file can hold, and what it cannot.** jsdom lays nothing out, so no case here can see a
 * reordering. What is held is the thing that prevents it, as structure: every link carries the
 * attribute ITSELF. The alternatives were measured in the same browser, and the file is written to
 * those measurements and not to taste:
 *
 * - `dir="ltr"` on the paragraph protects nothing, since the override stands inside the paragraph.
 *   All three rows above are drawn reordered with it, so it is not accepted in place of the link's own.
 * - `dir="rtl"` on the link protects the first row and not the other two, the ones with a letter of a
 *   right-to-left script in the path.
 * - `unicode-bidi: isolate` on the link, a `<span dir="ltr">` around it and one inside it all protect
 *   as the attribute does, and none is accepted in its place: what is asked is what the link
 *   carries, and a second shape of the answer is a second thing to hold.
 * - A rule of a sheet that sets `unicode-bidi` on links beats the attribute, which is only the
 *   browser's own rule for it: with `dir="ltr"` still on the link, all three rows are drawn
 *   reordered. No sheet of the portal sets it, and the value measured on the built sheet is
 *   `isolate`. Nothing here holds that, because jsdom computes no cascade (ADL A18).
 *
 * **WHY THE FLOOR ASKS THE IMPORT GRAPH, AND NOT THE NAME OF THE FUNCTION OR A LIST OF SCREENS.** The
 * seats below are written by hand, and each of them has a floor: which modules draw a link out of
 * `addressesIn` is the parser's and the resolver's to say (`ts.preProcessFile`, `ts.resolveModuleName`,
 * the way `components/oneFace.test.ts` and `pages/member/oneQuestion.test.tsx` ask it), so
 * `'./addressesIn'`, `"./addressesIn.ts"` and `'../league/addressesIn'` are one answer, and so are
 * `export ... from` and `import(...)`. A module that imports it and has no seat fails here, and so does
 * a seat for a module that no longer does. Asked by name it would be a different question: there is a
 * function called `addressesIn` in `pages/admin/teamProposal.ts` too, read by four screens, which
 * answers which addresses the teams already have and draws no link.
 *
 * **Where this is narrower than it looks, said here and not left to be found.** The floor names the
 * modules that IMPORT the function, so a module that re-exports it is named in its place and its own
 * readers are not; the answer on the day there is one is to give the re-exporting module a seat or to
 * stop re-exporting, and never to teach this to skip a kind of import. A reader of the words that does
 * not import the function at all is not seen by an import, and is a decision and not a missed instance.
 * The words around a link are drawn as their author typed them (an override in them still reorders
 * them), and nothing here is about that. And a seat draws the component and not the screen around it,
 * which is where the attribute is written.
 */

/** Where the portal's own modules live, so one can be named by its place under it. */
const SRC = join(process.cwd(), 'src')

/** A module by its place under `src`, spelt the one way on either platform. */
function named(path: string): string {
  return relative(SRC, path).split(sep).join('/')
}

/** Enough of the project's own settings for a specifier to be resolved the way the bundler resolves
 *  it. `allowImportingTsExtensions`, which `tsconfig.app.json` turns on, is left out on purpose: it
 *  only permits writing the extension, and a module that imports `'./addressesIn.ts'` is found with
 *  the option turned off as well (measured on 03.10.2026). */
const AS_THE_BUNDLER_DOES: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
}

/**
 * Every module of the portal that imports the given one, and how many were read.
 *
 * The count comes back with the answer and is asserted beside it, because a sweep narrowed by accident
 * answers "nothing imports it" in the very words of a portal with one home.
 */
function modulesImporting(wanted: string): { walked: number; importing: string[] } {
  let walked = 0

  const importing = sources().flatMap((one) => {
    const imports = ts.preProcessFile(one.code, true, true).importedFiles.some((ref) => {
      const { resolvedModule } = ts.resolveModuleName(
        ref.fileName,
        one.path,
        AS_THE_BUNDLER_DOES,
        ts.sys,
      )

      return resolvedModule !== undefined && named(resolvedModule.resolvedFileName) === wanted
    })

    /* Counted after the file has been read rather than before, so this says what was parsed and not
       what was offered. */
    walked += 1

    return imports ? [named(one.path)] : []
  })

  return { walked, importing }
}

/**
 * Every module that draws a link out of `addressesIn`, and how this file makes it draw one.
 *
 * The table is written by hand and the first `it` below is its floor, in both directions.
 */
const SEATS: Record<string, (text: string) => void> = {
  'pages/league/EditableText.tsx': (text) => {
    renderWithI18n(
      <EditableText
        value={text}
        field="rules"
        headingId="seat-rules"
        heading="Propozicije"
        canEdit={false}
        onSave={() => Promise.resolve(true)}
      />,
    )
  },
}

/* Written by code point, since a control character typed into a file is one nobody can see. */
const RLO = String.fromCodePoint(0x202e)
const PDF = String.fromCodePoint(0x202c)
const RLE = String.fromCodePoint(0x202b)
const RLI = String.fromCodePoint(0x2067)
const ALEF = String.fromCodePoint(0x5d0)

/**
 * What is typed beside the addresses, and which links it must draw.
 *
 * The three shapes of the review of PR 484: an override (U+202E) with its end (U+202C) behind the
 * address, and an embedding (U+202B) and an isolate (U+2067) with a Hebrew letter (U+05D0) in the
 * path. And one text of ordinary addresses of both forms, so that a link which carries the attribute
 * only when it is the first, or only when it is of one form, is found without it.
 *
 * The names are kept short enough for Vitest to print them whole: it cut the first draft of them.
 */
const TEXTS: { shape: string; text: string; links: string[] }[] = [
  {
    shape: 'ordinary addresses of both forms',
    text: 'Vreme meri portal www.runtrace.net, a nagrade su na https://nagrade.example/runtrace.',
    links: ['www.runtrace.net', 'https://nagrade.example/runtrace'],
  },
  {
    shape: 'U+202E before it, U+202C behind it',
    text: `Pravila: ${RLO} https://zlo.example/#/ten.ecartnur.www//:sptth ${PDF} i dalje.`,
    links: ['https://zlo.example/#/ten.ecartnur.www//:sptth'],
  },
  {
    shape: 'U+202B before it, U+05D0 in its path',
    text: `Pravila: ${RLE} https://zlo.example/${ALEF}/www.runtrace.net i dalje.`,
    links: [`https://zlo.example/${ALEF}/www.runtrace.net`],
  },
  {
    shape: 'U+2067 before it, U+05D0 in its path',
    text: `Pravila: ${RLI} https://zlo.example/${ALEF}/www.runtrace.net i dalje.`,
    links: [`https://zlo.example/${ALEF}/www.runtrace.net`],
  },
]

describe('the modules that draw a link out of addressesIn', () => {
  it('are the modules this file has a seat for, and no seat is held for a module that is not one', () => {
    const { walked, importing } = modulesImporting('pages/league/addressesIn.ts')

    expect(walked, 'the portal is still here').toBeGreaterThan(WHOLE_PORTAL)
    expect(importing.toSorted()).toEqual(Object.keys(SEATS).toSorted())
  }, SLOW)

  describe.each(Object.entries(SEATS))('%s', (_module, draw) => {
    it.each(TEXTS)('draws every link left to right: $shape', ({ text, links }) => {
      draw(text)

      const found = screen.getAllByRole('link')

      /* The links this case means and no others, so that what is asked below is asked of them and a
         text that drew nothing is not a text that passed. */
      expect(found.map((one) => one.textContent)).toEqual(links)

      for (const one of found) {
        expect(one).toHaveAttribute('dir', 'ltr')
      }
    })
  })
})
