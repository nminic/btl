import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { sources } from '../test/sources'

/**
 * No text a member or a visitor reads on a screen carries the Serbian quotation marks.
 *
 * Owner, 18.10.2026 (PDL P18, „Navodnici"): the text the portal writes uses the English
 * quotation mark, on both languages, on the whole portal. The backend half of this is
 * held by `TheQuotesAMemberReadsAreEnglishTest`, the written pages by
 * `pages/writtenVerification.test.ts`; this is the third, the one for what a screen
 * draws.
 *
 * **Three places, and each is asked of a tool and not of a list.**
 *
 * 1. **Every value in every dictionary under `src/i18n`.** The folder is read, so a
 *    third language arriving as `xx.json` is inside this the day it is added, without
 *    anybody remembering to name it.
 * 2. **Every literal the compiler finds in a production source file:** string literals
 *    (an `aria-label`, a `title`, an `alt` and a `placeholder` are string literals), the
 *    pieces of a template literal, and the text standing in JSX. The parser is asked
 *    and not a pattern, so a comment cannot be one of these by construction, and the
 *    cooked value is read, so `„` written out counts exactly as the mark typed.
 * 3. **Every string in every form definition** under `src/forms/definitions`, read from
 *    the folder.
 *
 * **What it deliberately does not read:** comments, which the decision names as outside
 * it; the test files, which hold sentences a member TYPES (an address with a Serbian
 * mark around it is the input the address readers are tested against) and the names of
 * cases; and `test/mock`, which holds records the league's people write.
 *
 * **The three marks are named by code point and not typed,** so an editor cannot turn
 * this line into a different line: the low opening mark and the two high ones are every
 * mark the decision is about. The single and the angle marks are not in it: the portal
 * writes none in a text for a reader (measured 18.10.2026), and the apostrophe in a
 * word is not a quotation mark.
 */
const MARKS = [0x201e, 0x201c, 0x201d].map((code) => String.fromCharCode(code))

/** The same three, as HTML spells them in the text of a JSX element, where the compiler
 *  hands the text over undecoded. */
const AS_ENTITIES = /&(?:bdquo|ldquo|rdquo|#8222|#8220|#8221|#x201e|#x201c|#x201d);/i

function marked(text: string): boolean {
  return MARKS.some((mark) => text.includes(mark))
}

/** Every string in a parsed JSON value, with the path that leads to it. */
function stringsIn(node: unknown, path: string): { at: string; text: string }[] {
  if (typeof node === 'string') {
    return [{ at: path, text: node }]
  }

  if (typeof node !== 'object' || node === null) {
    return []
  }

  return Object.entries(node).flatMap(([key, child]) => stringsIn(child, `${path}.${key}`))
}

/** The literals the compiler finds in one source, and where each one starts. */
function literalsIn(file: string, code: string): { at: string; text: string }[] {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const found: { at: string; text: string }[] = []

  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      found.push({ at: place(source, file, node), text: node.text })
    } else if (ts.isJsxText(node)) {
      found.push({ at: place(source, file, node), text: node.text })
    }

    ts.forEachChild(node, visit)
  }

  visit(source)

  return found
}

function place(source: ts.SourceFile, file: string, node: ts.Node): string {
  return `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`
}

/** What a literal says that this decision forbids, one line per offender. */
function offendersIn(literals: { at: string; text: string }[]): string[] {
  return literals
    .filter(({ text }) => marked(text) || AS_ENTITIES.test(text))
    .map(({ at, text }) => `${at}: ${text.replaceAll(/\s+/g, ' ').slice(0, 80)}`)
}

function jsonFilesIn(folder: string): { file: string; value: unknown }[] {
  return readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({
      file: name,
      value: JSON.parse(readFileSync(join(folder, name), 'utf-8')) as unknown,
    }))
}

describe('the text a reader meets on a screen', () => {
  it('carries no Serbian quotation mark in any value of any dictionary', () => {
    const dictionaries = jsonFilesIn(join(process.cwd(), 'src', 'i18n'))
    const values = dictionaries.flatMap(({ file, value }) =>
      stringsIn(value, file).map((each) => ({ ...each })),
    )

    /* Asked of the folder, so the floor is the folder: the two languages the portal
       speaks, and every value they hold. A sweep that found one file or none would
       read as "nothing is wrong" where it meant "nothing was looked at". */
    expect(dictionaries.map(({ file }) => file)).toEqual(expect.arrayContaining(['sr.json', 'en.json']))
    expect(values.length).toBeGreaterThan(2000)
    expect(offendersIn(values)).toEqual([])
  })

  it('carries none in any literal or any JSX text of a production source file', () => {
    const everything = sources().flatMap(({ path, code }) =>
      literalsIn(path.slice(path.lastIndexOf('src')), code),
    )

    /* The floor is the whole portal and not a folder of it (`WHOLE_PORTAL` in
       `test/sources.ts`), and it is a floor on the literals the walk read, which is
       the quantity that would silently be small if the walk had been narrowed. */
    expect(sources().length).toBeGreaterThan(150)
    expect(everything.length).toBeGreaterThan(1000)
    expect(offendersIn(everything)).toEqual([])
  })

  it('carries none in any string of any form definition', () => {
    const definitions = jsonFilesIn(join(process.cwd(), 'src', 'forms', 'definitions'))
    const strings = definitions.flatMap(({ file, value }) => stringsIn(value, file))

    expect(definitions.length).toBeGreaterThanOrEqual(10)
    expect(strings.length).toBeGreaterThan(100)
    expect(offendersIn(strings)).toEqual([])
  })
})

describe('the reader of source that holds those two to the decision', () => {
  /* The guard above passes when there is nothing to find, which is exactly what it
     passes on a reader that cannot find anything. So the reader is asked here about
     sources written to have one of the marks in each place a sentence can stand, and
     about two that must not be found, and it has to answer every one of them. */
  const LOW = MARKS[0]
  const HIGH = MARKS[1]

  const found = (file: string, code: string) => offendersIn(literalsIn(file, code))

  it('finds a mark in a string literal', () => {
    expect(found('a.ts', `export const a = 'Tim ${LOW}x${HIGH}'`)).toHaveLength(1)
  })

  it('finds a mark in the text standing in JSX', () => {
    expect(found('a.tsx', `export const a = <p>Tim ${LOW}x${HIGH}</p>`)).toHaveLength(1)
  })

  it('finds a mark in an attribute a reader meets', () => {
    expect(found('a.tsx', `export const a = <img alt="Tim ${LOW}x${HIGH}" />`)).toHaveLength(1)
  })

  it('finds a mark in the head, the middle and the tail of a template literal, and in one with no hole', () => {
    expect(found('a.ts', 'export const a = `' + LOW + '${1}' + LOW + '${2}' + LOW + '`')).toHaveLength(3)
    expect(found('a.ts', 'export const a = `' + LOW + '`')).toHaveLength(1)
  })

  it('finds a mark written as an escape, because the cooked value is read', () => {
    expect(found('a.ts', "export const a = 'Tim \\u201ex'")).toHaveLength(1)
  })

  it('finds a mark written as an entity in JSX text, which the compiler does not decode', () => {
    expect(found('a.tsx', 'export const a = <p>Tim &bdquo;x&ldquo;</p>')).toHaveLength(1)
  })

  it('does not find a mark in a comment, which the decision leaves alone', () => {
    expect(found('a.ts', `// Tim ${LOW}x${HIGH}\n/* ${LOW} */\nexport const a = 1`)).toEqual([])
  })

  it('does not find the plain mark, or an apostrophe inside a word', () => {
    expect(found('a.tsx', `export const a = <p title='Tim "x"'>member${String.fromCharCode(0x2019)}s</p>`)).toEqual([])
  })

  it('names the line of the offender, so a failure says where to look', () => {
    expect(found('a.ts', `export const ok = 1\nexport const a = '${LOW}'`)).toEqual([`a.ts:2: ${LOW}`])
  })
})
