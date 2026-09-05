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
 * shape that same commit had just written in `data/seedMessages.ts`. So what is read is
 * the import: whatever a file takes from `i18n/format`, under whatever name, counts, and
 * a constant made from one of them counts as that one.
 *
 * What stays written by hand is the answer, because it is a judgement about language and
 * not about code.
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

  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't' &&
      node.arguments.length > 1
    ) {
      const [named, ...rest] = node.arguments

      if (named !== undefined && ts.isStringLiteral(named)) {
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
          found.push(`${named.text} <- ${one}`)
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

  it('is read in all three shapes the portal writes, and in files that draw nothing', () => {
    const read = (path: string, code: string) => datesIn(path, code)
    const brought = "import { formatDate, wholePeriod } from '../i18n/format'\n"

    /* Written straight into the call, which is most of them. */
    expect(
      read('proba.tsx', `${brought}const a = t('x.y', { date: formatDate(d, locale) })`),
    ).toEqual(['x.y <- formatDate'])
    /* Kept in a constant first, which is what `data/seedMessages.ts` does and what the
       first draft of this could not see (review, 05.09.2026). */
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
    /* Whatever the formatter is called, because nothing here holds a list of them: the
       one that writes a whole period counts the same as the one that writes a day. */
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
