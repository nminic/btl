import ts from 'typescript'
import { sources } from '../test/sources'

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

/** The corner of the portal a file lives in: the first folder under `src`. */
function cornerOf(path: string): string {
  const parts = path.split(/[/\\]/)

  return parts[parts.indexOf('src') + 1] ?? ''
}

/**
 * Two words standing beside each other, which is what a sentence is made of and a
 * unit is not.
 *
 * **Counted, not adjacent.** The first draft asked for two words with only whitespace
 * between them, and „Ime i prezime" walked past it, because every pair there has a
 * one-letter word or a comma in between (review, 05.09.2026). Two words of two letters
 * anywhere in the node is the rule.
 *
 * Measured before it was written: the markup of this portal carries thirteen text
 * nodes today and twelve of them are a bracket, a comma, a colon, a middle dot, a
 * slash, `%`, `km`, `EUR` or `RSD` — symbols and units, which are the same in every
 * language and are deliberately not in the dictionary. The thirteenth was „BTL
 * points", two English words on a Serbian screen, and it went into the dictionary
 * with this rule (05.09.2026). So the limit is one word: a single word written into
 * the markup passes, and that is the price of a rule that does not argue about units.
 */
const WORDS = (text: string) => (text.match(/\p{L}{2,}/gu) ?? []).length > 1

/** The five letters no other language on this portal writes. */
const SERBIAN = /[čćžšđČĆŽŠĐ]/

/**
 * Attributes a reader meets, by the name they are written under.
 *
 * **Written by hand, and held against every attribute that carries a value.** It
 * holds the six this portal reads out or shows. A seventh invented tomorrow
 * (`aria-placeholder`, `aria-roledescription`, or a prop of a component that ends up
 * as text) is outside it, and that is why the case below refuses any attribute name
 * the portal has not been asked about: a name arriving with a value written out is a
 * decision somebody has to make once, not a hole that waits to be found.
 *
 * Said out loud rather than left to be found: `aria-valuetext` was live on the
 * chooser of a picture and outside this list until 05.09.2026 (review), and it is
 * that finding, not this list, that the case below is here to stop repeating.
 */
const SPOKEN = ['title', 'alt', 'aria-label', 'aria-description', 'aria-valuetext', 'placeholder']

/**
 * The value an attribute is written with, when it is written out and not computed.
 *
 * **Both spellings, and the second has no living example.** JSX writes a value as
 * alt="a" or as alt={'a'}, and counted with this same parser the portal writes the
 * first for all sixteen hundred and eighty five of them, the second for none. So the
 * reading of `{'a'}` and of a template literal cannot be held by the floor below, which
 * would freeze the same sixty names with either one removed; it is held by the three
 * cases at the bottom of this file and by nothing else (review, 05.09.2026).
 *
 * It is read all the same, because the fault it stops is a live one: `alt={'Znak tima'}`
 * is a Serbian sentence with none of the five letters the third rule looks for, so with
 * this half gone it would reach a reader through the whole guard.
 *
 * An empty value is the right way to say a picture is decoration (WCAG 2.2 SC 1.1.1)
 * and the portal writes three of those, so an empty value is not a value here.
 *
 * One home, because the two readings below have to agree about what a written value
 * is: the one that refuses them on the attributes a reader meets, and the one that
 * holds the list of those attributes against every attribute that carries one.
 */
function literalOf(attr: ts.JsxAttribute): string | undefined {
  const inside =
    attr.initializer !== undefined &&
    ts.isJsxExpression(attr.initializer) &&
    attr.initializer.expression !== undefined
      ? attr.initializer.expression
      : attr.initializer

  return inside !== undefined &&
    (ts.isStringLiteral(inside) || ts.isNoSubstitutionTemplateLiteral(inside)) &&
    inside.text.trim() !== ''
    ? inside.text
    : undefined
}

/** Every word a screen would say out of its own source, with the shape it takes. */
export function saidIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (ts.isJsxText(node) && WORDS(node.text)) {
      found.push(`markup: ${node.text.trim()}`)
    }

    if (ts.isJsxAttribute(node) && SPOKEN.includes(node.name.getText(source))) {
      const written = literalOf(node)

      if (written !== undefined) {
        found.push(`${node.name.getText(source)}: ${written}`)
      }
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

/**
 * Every attribute name the components write a value out under, computed rather than
 * listed.
 *
 * This is the floor under `SPOKEN`. A written list is safe exactly when it is held
 * against the thing it claims to cover, which is how the sweep of the public
 * addresses is written (`pages/publicData.test.tsx`): the table is written by hand
 * and it fails the day an address exists that has no row in it.
 */
export function namesIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && literalOf(node) !== undefined) {
      found.push(node.name.getText(source))
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

  it('is asked of every corner a component lives in, and of the whole of each', () => {
    /* **The floor has to bound what is really read.** The first draft asked half the
       portal and one folder cleared it alone; the second asked the whole sweep while
       the reading ran over the components inside it, so narrowing the components
       changed nothing it could see (review, 05.09.2026). What is bounded here is the
       list the case above walks.

       **The corners are written out and held against the sweep.** A hand-written list
       is safe exactly when it is compared with the source of truth: drop `forms` from
       the reading and a corner goes missing here. What this list does **not** catch is
       a narrowing inside a corner: `pages/admin` is not a corner of its own, and with
       the whole of it dropped the corners are unchanged while the count below falls to
       99 and the names below fall to 59. Both measured, the second by a review on
       05.09.2026, which is why the count and the names are not decoration. */
    const corners = [...new Set(DRAWN.map(({ path }) => cornerOf(path)))].sort()

    expect(corners).toEqual([
      /* The root of the application itself, which is one file and no folder. */
      'app',
      'clock',
      'components',
      'forms',
      'i18n',
      /* The root of the application itself, which is one file and no folder. */
      'main.tsx',
      'pages',
      'roles',
      'session',
    ])

    /* And the count, which is what a narrowing inside a corner moves. A hundred and
       twenty one components on the day this was written; the floor is set below that
       and above anything a narrowing would leave, and it is a number that will be
       raised by whoever adds enough screens to pass it. */
    expect(DRAWN.length).toBeGreaterThan(110)
  })

  it('meets no attribute the portal has not already been asked about', () => {
    /* **The list above is written by hand; this is what makes that safe.** Every
       finding this guard has taken has had one shape: the reading knew about less
       than the portal writes, and a round of review found the next name. Three of
       them in one day, on one file (05.09.2026). A list cannot be made complete by
       thinking harder about it, so it is not the list that is held here but the
       whole of what it is a list of.

       Sixty names carry a value written out today, over sixteen hundred and
       eighty five values, and none of them is one a reader meets. A name that is
       not among them arriving with a written value fails here, and whoever adds it
       answers one question: does a reader hear it? Yes puts it in `SPOKEN` above,
       no puts it in the list here. Either way it is decided once, by somebody, and
       not left for a round of review to find.

       Which of the two lists a name belongs in is the whole of the judgement, and
       it is a judgement about a name, not about a sentence: `aria-hidden` and `d`
       and `viewBox` are machinery, `alt` and `placeholder` are speech. */
    const carrying = [...new Set(DRAWN.flatMap(({ path, code }) => namesIn(path, code)))].sort()

    expect(carrying).toEqual([
      'accept',
      'aria-autocomplete',
      'aria-controls',
      'aria-describedby',
      'aria-haspopup',
      'aria-hidden',
      'aria-labelledby',
      'aria-live',
      'aria-required',
      'autoComplete',
      'className',
      'counted',
      'cx',
      'cy',
      'd',
      'decoding',
      'describedBy',
      'field',
      'fill',
      'focusable',
      'gender',
      'headingId',
      'height',
      'href',
      'htmlFor',
      'id',
      'inputMode',
      'leftId',
      'loading',
      'look',
      'max',
      'min',
      'name',
      'part',
      'r',
      'rel',
      'role',
      'rx',
      'ry',
      'scope',
      'shapeRendering',
      'slot',
      'slug',
      'src',
      'startOffset',
      'step',
      'stroke',
      'strokeLinecap',
      'strokeLinejoin',
      'strokeWidth',
      'target',
      'textAnchor',
      'transform',
      'type',
      'unit',
      'viewBox',
      'why',
      'width',
      'x',
      'y',
    ])

    /* And the two lists do not overlap, which is the whole claim: not one of the six
       a reader meets is among the names that carry a value written out. */
    expect(carrying.filter((one) => SPOKEN.includes(one))).toEqual([])
  })

  it('reads a word wherever it stands, and says what it cannot read', () => {
    /* The reading itself, asked of text rather than of the portal. The first two
       rules are exact; the third is a guess and both halves of it are named. */
    const read = (code: string) => saidIn('proba.tsx', code)

    /* Markup, on one line and broken over three, which is how this repository writes
       a text child and what the first draft could not see. */
    expect(read('const a = <p>Nema podataka za ovaj period.</p>')).toHaveLength(1)
    expect(read('const a = (\n  <p>\n    Nema podataka za ovaj period.\n  </p>\n)')).toHaveLength(1)
    /* And a sentence with none of the five letters, which the third rule would miss
       and the first one catches all the same. */
    expect(read('const a = <p>Ovo polje je obavezno.</p>')).toHaveLength(1)
    /* And two words that do not stand beside each other, which is the whole of why
       `WORDS` counts rather than pairs: every word here but two is one letter long, and
       a rule asking for two long words in a row walked straight past it. */
    expect(read('const a = <p>Ime i prezime</p>')).toHaveLength(1)
    /* And what one word in the markup costs, which is what the rule is priced at:
       units and symbols pass, because they are the same in every language. */
    expect(read('const a = <p>{n} km</p>')).toEqual([])
    expect(read('const a = <p>{n} EUR</p>')).toEqual([])
    /* An attribute a reader meets. */
    expect(read('const a = <img alt="Znak tima" />')).toHaveLength(1)
    /* And an empty one is how a decorative picture says it has nothing to say. */
    expect(read('const a = <img alt="" />')).toEqual([])
    /* And the other two spellings of a written value, which nothing in the portal uses
       today and which therefore have no other place to be measured. Both carry the
       fault whole: a Serbian sentence with none of the five letters, on an attribute a
       reader hears. */
    expect(read("const a = <img alt={'Znak tima'} />")).toHaveLength(1)
    expect(read('const a = <img alt={`Znak tima`} />')).toHaveLength(1)
    /* And what an unknown name gets: nothing, which is exactly the hole the case above
       closes. This reading is blind to `aria-roledescription`, and the moment a component
       writes one out it is the list of names that stops matching, not this. */
    expect(read('const a = <b aria-roledescription="Traka" />')).toEqual([])
    expect(namesIn('proba.tsx', 'const a = <b aria-roledescription="Traka" />')).toEqual([
      'aria-roledescription',
    ])
    /* And a value that is computed is not a value written out, on either reading. */
    expect(namesIn('proba.tsx', "const a = <b aria-roledescription={t('a.b')} />")).toEqual([])
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
