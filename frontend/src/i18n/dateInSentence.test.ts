import ts from 'typescript'
import { sources } from '../test/sources'

/**
 * Every sentence of the dictionary that is filled from a formatted value, and by which
 * formatter.
 *
 * **Why this is a guard and not a note.** Serbian puts a word in a different case
 * depending on what stands around it: „Trke, 1. oktobar 2026." takes the nominative,
 * „Učlanjenje se otvara 1. oktobra 2026." takes the genitive, and no tool can tell which
 * a sentence needs. What a tool can do is refuse to let a new one arrive unnoticed. On
 * 05.09.2026 a review found the second live on the registration screen written with the
 * first formatter, ten days from the period of insight, and a second in the message every
 * member's inbox starts with. Neither had ever been asked the question (ADL A35).
 *
 * **Nothing here is a list of formatters, and that is the point.** The first draft named
 * five by hand, and one round of review broke it three ways: five of the module's eight
 * date formatters were named, the sweep read only `.tsx` while ten `.ts` files build
 * sentences too, and a value bound to a constant first was invisible, which is the very
 * shape the same commit had written in `data/seedMessages.ts`. So what is read is the
 * import: whatever a file takes from `i18n/format` counts, and a constant made from one
 * of them counts as that one.
 *
 * **The key is read as a shape, not scanned for words, and that took two more rounds.**
 * A sentence can be chosen between two — `t(part === 'results' ? 'a' : 'b', …)`, which
 * this portal writes five times with values and eighteen times in all — so a choice
 * contributes **its two answers and never its question**. Scanned for words instead, the
 * word being compared against went in as if it were a sentence of the dictionary, and a
 * choice with one answer written out and one not was recorded as fully named while the
 * unnamed half took its values in silence. Both measured, neither live (review,
 * 05.09.2026).
 *
 * Anything else in a key — a template, a name held in a variable — is „?" with the file it
 * stands in, which breaks the list rather than passing quietly. Sixteen calls have a key
 * that is not written out and take values; not one takes anything from this module today,
 * which is why the frozen list below is unchanged by any of this.
 *
 * **Where the reading does stop, measured rather than assumed.** Two shapes, both about
 * how a name reaches the call: a star import (`import * as fmt` — there is not one of
 * anything in `src`), and `t` bound under another name (nought of the hundred and thirty
 * two `useI18n()` bindings). A third, importing a formatter under an alias, is seen but
 * reported under the alias, so it too fails the list loudly. The day the portal writes one
 * of the two, this stops seeing it, and that is the line to look at.
 *
 * **What each line below answers, and what it does not.** It answers the case: which form
 * of the word the sentence around it takes. It does not answer the language. Whether a
 * formatted value follows the language of the address or the language of the words is one
 * question for the whole portal, it has a live guard pointing at the address
 * (`pages/event/rateEvent.test.tsx`), and it is open with the owner
 * (`btl-produkt/PENDING.md`). The single exception already made is `formatDayInSentence`,
 * which has to follow the words because its rule for the genitive is Serbian and would
 * make „Octobera" of „October".
 */
export function datesIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imported = new Set<string>()

  ts.forEachChild(source, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.endsWith('i18n/format')
    ) {
      const bound = node.importClause?.namedBindings

      if (bound !== undefined && ts.isNamedImports(bound)) {
        for (const one of bound.elements) {
          imported.add(one.name.text)
        }
      }
    }
  })

  /* A value made from a formatter, under the name it is kept as. One step and no more:
     the portal writes `const OPENS = formatDayInSentence(…)` at the top of a module and
     then puts `OPENS` in the sentence, and a reading that stops at the call itself does
     not see it. A constant made from two of them is left out rather than guessed at. */
  const made = new Map<string, string>()

  const bind = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      const seen = new Set<string>()
      const scan = (one: ts.Node): void => {
        if (ts.isIdentifier(one) && imported.has(one.text)) {
          seen.add(one.text)
        }

        ts.forEachChild(one, scan)
      }

      scan(node.initializer)

      const only = [...seen]

      if (only.length === 1) {
        made.set(node.name.text, only.join(''))
      }
    }

    ts.forEachChild(node, bind)
  }

  bind(source)

  /** Which sentences a key can name, by the shape of the key and not by its words. */
  const unknown = `? (${path.split(/[/\\]/).slice(-1).join('')})`

  const keysOf = (node: ts.Node): string[] => {
    if (ts.isStringLiteral(node)) {
      return [node.text]
    }

    if (ts.isConditionalExpression(node)) {
      return [...keysOf(node.whenTrue), ...keysOf(node.whenFalse)]
    }

    if (ts.isParenthesizedExpression(node)) {
      return keysOf(node.expression)
    }

    return [unknown]
  }

  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't' &&
      node.arguments.length > 1
    ) {
      const [named, ...rest] = node.arguments

      if (named !== undefined) {
        const used = new Set<string>()
        const scan = (one: ts.Node): void => {
          if (ts.isIdentifier(one)) {
            const through = imported.has(one.text) ? one.text : made.get(one.text)

            if (through !== undefined) {
              used.add(through)
            }
          }

          ts.forEachChild(one, scan)
        }

        rest.forEach(scan)

        for (const one of [...used].sort()) {
          for (const key of keysOf(named)) {
            found.push(`${key} <- ${one}`)
          }
        }
      }
    }

    ts.forEachChild(node, walk)
  }

  walk(source)

  return found
}

describe('a formatted value handed to a sentence', () => {
  it('is handed to exactly these sentences, by exactly these formatters', () => {
    const said = [...new Set(sources().flatMap(({ path, code }) => datesIn(path, code)))].sort()

    expect(said).toEqual([
      /* The numbers first, and they are all one answer: Serbian inflects around a number,
         and the dictionary carries that in the plural forms of the key itself (`one`,
         `few`, `other`), which `translate.ts` picks by the count. The formatter writes
         the figure and the key writes the words, so neither is in the other's way. They
         stand here so that a sentence which stops being a number and starts being a word
         cannot slip in among them unasked. */
      'awards.position <- formatNumber',
      /* „Nov događaj {date}", and the date is written in numbers: „1. 10. 2026." has no
         month word in it, so it has no case to be wrong in. */
      'calendar.addOnDay <- formatShortDate',
      /* „Trke, {date}": the date stands after a comma as the thing being named, which is
         the nominative, and that is what this formatter gives. */
      'calendar.dayTitle <- formatDate',
      'crop.share <- formatNumber',
      'ducats.again <- formatNumber',
      'ducats.sentence <- formatNumber',
      'ducats.stepUp <- formatNumber',
      'event.rating.stars <- formatNumber',
      'membership.junior <- money',
      'membership.priceNow <- money',
      'newResult.donePoints <- formatPoints',
      'pager.page <- formatNumber',
      'pager.showing <- formatNumber',
      /* „Učlanjenje se otvara {date}, za {count} dana.": a verb governs the date, so the
         genitive, and this is the sentence the review of 05.09.2026 found wrong. */
      'registration.opensIn <- formatDayInSentence',
      /* „{date}: sve trke tog dana…": the date opens the sentence as its subject. */
      'seo.calendarDay.recordDescription <- formatDate',
      /* „Trke, {date}", the title of the same screen. */
      'seo.calendarDay.recordTitle <- formatDate',
      /* „{name}, {date}": the race and then the day it is run, both named. */
      'seo.event.recordTitle <- formatDate',
      'units.btlPoints <- formatPoints',
    ])
  })

  it('names both answers of a choice, and never the question it is asked by', () => {
    const read = (code: string) => datesIn('proba.tsx', code)
    const brought = "import { formatDate } from '../i18n/format'\n"

    /* A choice between two sentences, which this portal writes five times with values.
       Both answers are named, because either can be the one that is drawn. Read as a
       plain literal only, this was invisible and a formatted value put through it passed
       the whole guard (review, 05.09.2026, `pages/LeagueDetail.tsx`). */
    expect(
      read(`${brought}const a = t(x ? 'seo.a.one' : 'seo.a.two', { date: formatDate(d, l) })`),
    ).toEqual(['seo.a.one <- formatDate', 'seo.a.two <- formatDate'])

    /* And never the question. Four of the five choices this portal writes compare against
       a word — `part === 'results'`, `gender === 'F'` — and a reading that scanned the
       key for words put that word in as if it were a sentence of the dictionary, where
       the next person would freeze it as one (review, 05.09.2026). */
    expect(
      read(
        `${brought}const a = t(part === 'results' ? 'seo.a.one' : 'seo.a.two', { date: formatDate(d, l) })`,
      ),
    ).toEqual(['seo.a.one <- formatDate', 'seo.a.two <- formatDate'])

    /* And a choice named on one side only is named on one side only: the half nobody
       wrote out takes its values under „?", which breaks the list. Scanned for words,
       one name anywhere was enough to call the whole key named, and the unnamed half
       took its values in silence (review, 05.09.2026). */
    expect(
      read(`${brought}const a = t(x ? 'pager.showing' : other, { date: formatDate(d, l) })`),
    ).toEqual(['pager.showing <- formatDate', '? (proba.tsx) <- formatDate'])
  })

  it('shouts about a sentence it cannot name, and says where it stops seeing', () => {
    const read = (code: string) => datesIn('proba.tsx', code)
    const brought = "import { formatDate } from '../i18n/format'\n"

    /* A key with nothing written out in it: a template, or a name that says nothing here.
       There is nowhere to look up which sentence that is, so the reading says so out loud
       and by the file it stands in. The portal writes none of these with a formatted
       value today. */
    expect(read(`${brought}const a = t(\`x.\${z}\`, { date: formatDate(d, l) })`)).toEqual([
      '? (proba.tsx) <- formatDate',
    ])
    expect(read(`${brought}const a = t(someKey, { date: formatDate(d, l) })`)).toEqual([
      '? (proba.tsx) <- formatDate',
    ])

    /* The two limits of the reading, both about how a name reaches the call rather than
       about the key. Neither is written anywhere in `src` today: there is not one
       `import * as` of anything, and not one of the hundred and thirty two `useI18n()`
       bindings renames `t`. Each is a case here so that the boundary is a measured thing
       somebody can move rather than a sentence nothing holds to. */
    expect(
      read("import * as fmt from '../i18n/format'\nconst a = t('x.y', { date: fmt.formatDate(d, l) })"),
    ).toEqual([])
    expect(
      read(
        `${brought}const { t: say } = useI18n()\nconst a = say('x.y', { date: formatDate(d, l) })`,
      ),
    ).toEqual([])

    /* And the one that is seen but under the name it was brought in as, so it breaks the
       frozen list rather than slipping past it. That is the safe way to be wrong. */
    expect(
      read("import { formatDate as danKad } from '../i18n/format'\nconst a = t('x.y', { date: danKad(d, l) })"),
    ).toEqual(['x.y <- danKad'])
  })

  it('reads the three shapes the portal writes, in files that draw and files that do not', () => {
    const read = (path: string, code: string) => datesIn(path, code)
    const brought = "import { formatDate, wholePeriod } from '../i18n/format'\n"

    /* Written straight into the call, which is most of them. */
    expect(
      read('proba.tsx', `${brought}const a = t('x.y', { date: formatDate(d, locale) })`),
    ).toEqual(['x.y <- formatDate'])
    /* Kept in a constant first, which is what `data/seedMessages.ts` does and what the
       first draft of this could not see. */
    expect(
      read(
        'proba.tsx',
        `${brought}const KAD = formatDate(d, 'sr')\nconst a = t('x.y', { date: KAD })`,
      ),
    ).toEqual(['x.y <- formatDate'])
    /* And in a file that draws nothing: ten `.ts` modules of this portal build sentences,
       `data/ducatRule.ts` among them, and the first draft read only `.tsx`. */
    expect(read('proba.ts', `${brought}const a = t('x.y', { date: formatDate(d, 'sr') })`)).toEqual(
      ['x.y <- formatDate'],
    )
    /* Whatever the formatter is called, because nothing here holds a list of them. */
    expect(
      read('proba.tsx', `${brought}const a = t('x.y', { date: wholePeriod(a, b, locale) })`),
    ).toEqual(['x.y <- wholePeriod'])

    /* What it is not. A value drawn on its own is a value and not a sentence. */
    expect(read('proba.tsx', `${brought}const a = <span>{formatDate(d, locale)}</span>`)).toEqual([])
    /* A sentence with nothing formatted in it. */
    expect(read('proba.tsx', `${brought}const a = t('x.y', { name: n })`)).toEqual([])
    /* A name that happens to match but was never brought in from the formatter. */
    expect(read('proba.tsx', "const a = t('x.y', { date: formatDate(d, locale) })")).toEqual([])
    /* And the formatter named as the key itself, which would satisfy this by itself. */
    expect(read('proba.tsx', `${brought}const a = t('formatDate', { name: n })`)).toEqual([])
  })
})
