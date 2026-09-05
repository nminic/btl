import ts from 'typescript'
import { inside, sources, WHOLE_PORTAL } from '../test/sources'

/**
 * No screen says a word in its own voice: every word a reader sees comes from the
 * dictionary.
 *
 * **Why this exists.** A sentence written straight into a component reaches the
 * portal and cannot be corrected by whoever the words belong to: not by the owner,
 * who dictates them, and not by an administrator, who maintains the written pages.
 * It is also invisible to every guard the portal has over its words — the snapshot of
 * the dictionary holds keys, the snapshot of the drawn screens holds the seats it
 * happens to take, and the sweep of the words a competition is written with reads only
 * the components named after one. Measured: a sentence appended to the branch
 * `components/Resource.tsx` draws when a file does not arrive passed the whole gate,
 * all 2448 tests green (review, 03.09.2026).
 *
 * **Read with the parser, not with a pattern.** The first draft looked for text
 * between `>` and `<` on one line, and this repository writes a text child on its own
 * line — `Resource.tsx` itself does. A sentence written the way the code around it is
 * written was therefore invisible to it (review, 05.09.2026). The parser answers where
 * a text node is regardless of how it is broken across lines, and it tells a comment
 * from a string without blanking anything.
 *
 * **Three rules, and the first two need no guess about language.**
 *
 * 1. **No words standing in the markup.** A text node that is not whitespace is a
 *    word a screen says. Everything the portal draws comes through `{t(…)}`, so there
 *    is nothing for such a node to be.
 * 2. **No words handed to an attribute a reader meets.** `title`, `alt`,
 *    `aria-label`, `aria-description` and `placeholder` are read out or shown, and a
 *    literal there is the same fault wearing another shape.
 * 3. **And no Serbian letters anywhere else in a literal**, which catches a sentence
 *    on its way to a screen through some third road. This half is a guess and its
 *    limit is written down: a sentence with none of č, ć, ž, š, đ passes it, and the
 *    portal has plenty — „Ovo polje je obavezno." is one. It is the weakest of the
 *    three and it is here because it costs nothing, not because it is complete
 *    (review, 05.09.2026).
 *
 * **What it does not read**, said plainly: `.ts` files, which draw nothing on their
 * own, and the records that stand in for a database (`data/seedMessages.ts`,
 * `public/mock`), which are rows somebody will replace rather than words a screen
 * says.
 */
const DRAWN = sources().filter(({ path }) => path.endsWith('.tsx'))

/**
 * Two words standing beside each other, which is what a sentence is made of and a
 * unit is not.
 *
 * Measured before it was written: the markup of this portal carries thirteen text
 * nodes today and twelve of them are a bracket, a comma, a colon, a middle dot, a
 * slash, `%`, `km`, `EUR` or `RSD` — symbols and units, which are the same in every
 * language and are deliberately not in the dictionary. The thirteenth was „BTL
 * points", two English words on a Serbian screen, and it went into the dictionary
 * with this rule (05.09.2026). So the limit is one word: a single word written into
 * the markup passes, and that is the price of a rule that does not argue about units.
 */
const WORDS = /\p{L}{2,}\s+\p{L}{2,}/u

/** The five letters no other language on this portal writes. */
const SERBIAN = /[čćžšđČĆŽŠĐ]/

/** Attributes a reader meets, by the name they are written under. */
const SPOKEN = ['title', 'alt', 'aria-label', 'aria-description', 'placeholder']

/** Every word a screen would say out of its own source, with the shape it takes. */
export function saidIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (ts.isJsxText(node) && WORDS.test(node.text)) {
      found.push(`markup: ${node.text.trim()}`)
    }

    if (
      ts.isJsxAttribute(node) &&
      SPOKEN.includes(node.name.getText(source)) &&
      node.initializer !== undefined &&
      ts.isStringLiteral(node.initializer) &&
      /* An empty one is the right way to say „this picture is decoration" (WCAG 2.2
         SC 1.1.1), and the portal writes three of those. There is nothing in it for a
         reader to be told in the wrong language. */
      node.initializer.text.trim() !== ''
    ) {
      found.push(`${node.name.getText(source)}: ${node.initializer.text}`)
    }

    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      SERBIAN.test(node.text)
    ) {
      found.push(`said: ${node.text}`)
    }

    if (
      (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) &&
      SERBIAN.test(node.text)
    ) {
      found.push(`said: ${node.text}`)
    }

    ts.forEachChild(node, walk)
  }

  walk(source)

  return found
}

describe('what a screen says in its own voice', () => {
  it('is nothing at all, in every component the portal ships', () => {
    const said = DRAWN.flatMap(({ path, code }) =>
      saidIn(path, code).map((one) => `${path}: ${one.slice(0, 60)}`),
    )

    expect(said).toEqual([])
  })

  it('is asked of the whole portal, and of every corner of it', () => {
    /* The floor and the witnesses, because a sweep that finds nothing agrees with
       everything. **Not half the portal**, which is what the first draft asked for:
       one folder holds seventy one of the hundred and twenty one components, so a
       sweep narrowed to two folders cleared a floor of half and left a sentence
       standing in a third (review, 05.09.2026). The whole sweep is compared against
       the same number every other reader of it compares against, and a witness is
       named in each corner a component lives in. */
    expect(sources().length).toBeGreaterThan(WHOLE_PORTAL)

    for (const one of [
      inside('components', 'Resource.tsx'),
      inside('app', 'ErrorBoundary.tsx'),
      inside('forms', 'FormRenderer.tsx'),
      inside('session', 'SessionProvider.tsx'),
      inside('pages', 'Teams.tsx'),
    ]) {
      expect(DRAWN.some(({ path }) => path.endsWith(one)), one).toBe(true)
    }
  })

  it('reads a word wherever it stands, and says what it cannot read', () => {
    /* The reading itself, asked of text rather than of the portal. The first two
       rules are exact; the third is a guess and both halves of it are named. */
    const read = (code: string) => saidIn('proba.tsx', code)

    /* Markup, on one line and broken over three, which is how this repository writes
       a text child and what the first draft could not see. */
    expect(read('const a = <p>Nema podataka za ovaj period.</p>')).toHaveLength(1)
    expect(
      read('const a = (\n  <p>\n    Nema podataka za ovaj period.\n  </p>\n)'),
    ).toHaveLength(1)
    /* And a sentence with none of the five letters, which the third rule would miss
       and the first one catches all the same. */
    expect(read('const a = <p>Ovo polje je obavezno.</p>')).toHaveLength(1)
    /* And what one word in the markup costs, which is what the rule is priced at:
       units and symbols pass, because they are the same in every language. */
    expect(read('const a = <p>{n} km</p>')).toEqual([])
    expect(read('const a = <p>{n} EUR</p>')).toEqual([])
    /* An attribute a reader meets. */
    expect(read('const a = <img alt="Znak tima" />')).toHaveLength(1)
    /* And an empty one is how a decorative picture says it has nothing to say. */
    expect(read('const a = <img alt="" />')).toEqual([])
    /* And a literal anywhere else, by its letters. */
    expect(read("const a = 'Predlog tima je vraćen'")).toHaveLength(1)
    expect(read('const a = `Tim „${name}“ čeka odluku`')).toHaveLength(1)

    /* What it lets through, written down rather than found later: whitespace between
       elements, a word the two alphabets share, an attribute nobody reads out, and
       anything a comment says. */
    expect(read("const a = (\n  <p>\n    {t('data.error')}\n  </p>\n)")).toEqual([])
    expect(read("const a = 'Dunav Novi Sad'")).toEqual([])
    expect(read('const a = <p className="resource-state" />')).toEqual([])
    expect(read('/* Član 44 kaže ovako */ const a = 1')).toEqual([])
  })
})
