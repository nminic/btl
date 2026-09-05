import ts from 'typescript'
import { sources } from '../test/sources'

/**
 * Which sentence of the dictionary is handed a formatted date, and by which formatter.
 *
 * **Why this is a guard and not a note.** Serbian puts a date in a different case
 * depending on what stands around it: „Trke, 1. oktobar 2026." takes the nominative,
 * „Učlanjenje se otvara 1. oktobra 2026." takes the genitive, and no tool can tell which
 * a sentence needs. What a tool can do is refuse to let a new one arrive unnoticed. On
 * 05.09.2026 a review found the second live on the registration screen with the first
 * formatter, ten days from the period of insight, and a second in the message every
 * member's inbox starts with; both had been written without anybody being asked the
 * question (ADL A35).
 *
 * **So the list below is written by hand and the sweep under it is computed.** Whoever
 * adds the seventh answers one question — does a verb govern the date? — and writes the
 * answer here. That is one minute, once, instead of a screen that says the wrong thing
 * until somebody reads it aloud.
 */
const FORMATTERS = [
  'formatDate',
  'formatShortDate',
  'formatDayMonth',
  'formatDayInSentence',
  'formatMonth',
]

/** Every `t('key', …)` in the drawn portal that is handed one of them. */
export function datesIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't'
    ) {
      const [named, ...rest] = node.arguments

      if (named !== undefined && ts.isStringLiteral(named)) {
        const used = new Set<string>()
        const scan = (one: ts.Node): void => {
          if (ts.isIdentifier(one) && FORMATTERS.includes(one.text)) {
            used.add(one.text)
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

describe('a date handed to a sentence', () => {
  it('is handed to exactly these sentences, by exactly these formatters', () => {
    const said = [
      ...new Set(sources().filter(({ path }) => path.endsWith('.tsx')).flatMap(({ path, code }) => datesIn(path, code))),
    ].sort()

    expect(said).toEqual([
      /* „Nov događaj {date}", and the date is written in numbers: 1. 10. 2026. has no
         month word in it, so it has no case to be wrong in. */
      'calendar.addOnDay <- formatShortDate',
      /* „Trke, {date}" — the date stands after a comma as the thing being named, which
         is the nominative, and that is what this formatter gives. */
      'calendar.dayTitle <- formatDate',
      /* „Učlanjenje se otvara {date}, za {count} dana." — a verb governs the date, so
         the genitive, and this is the sentence the review of 05.09.2026 found wrong. */
      'registration.opensIn <- formatDayInSentence',
      /* „{date}: sve trke tog dana…" — the date opens the sentence as its subject. */
      'seo.calendarDay.recordDescription <- formatDate',
      /* „Trke, {date}", the title of the same screen. */
      'seo.calendarDay.recordTitle <- formatDate',
      /* „{name}, {date}" — the race and then the day it is run, both named. */
      'seo.event.recordTitle <- formatDate',
    ])
  })

  it('is read wherever it is written, and only where a sentence is being made', () => {
    const read = (code: string) => datesIn('proba.tsx', code)

    /* The two shapes the portal writes it in, one argument and several. */
    expect(read("const a = t('x.y', { date: formatDate(d, locale) })")).toEqual([
      'x.y <- formatDate',
    ])
    expect(read("const a = t('x.y', { name: n, date: formatDayInSentence(d, locale) })")).toEqual([
      'x.y <- formatDayInSentence',
    ])
    /* And nested inside another call, which is how a title is built. */
    expect(read("const a = t('x.y', { date: String(formatDate(d, locale)) })")).toEqual([
      'x.y <- formatDate',
    ])

    /* What it is not: a date drawn on its own, which is a value and not a sentence. */
    expect(read('const a = <span>{formatDate(d, locale)}</span>')).toEqual([])
    /* Nor a sentence with nothing formatted in it. */
    expect(read("const a = t('x.y', { name: n })")).toEqual([])
    /* Nor the formatter named as the key itself, which would satisfy this by itself. */
    expect(read("const a = t('formatDate', { name: n })")).toEqual([])
  })
})
