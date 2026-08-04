import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { RESOURCE_NAMES } from './client'

/* Two rules that say something the code cannot say for itself, and that have
 * each been broken once without anything noticing.
 */

const SRC = join(process.cwd(), 'src')

describe('the list of resources', () => {
  it('is the ten names the backend has to answer for', () => {
    /* ADL A7 calls this a contract: whoever adds an eleventh resource adds it to
       the contract on the same day. Nothing was holding it, so the list could
       have grown or shrunk in silence, and the sentence in the log that says it
       is closed would have gone on saying so. */
    expect([...RESOURCE_NAMES]).toEqual([
      'badges',
      'competitors',
      'events',
      'leagues',
      'moderators',
      'pages',
      'races',
      'results',
      'teams',
      'verification',
    ])
  })

  it('is matched by a file under public/mock for every one of them', () => {
    /* The other half: a name in the contract with no file behind it is a screen
       that fails on a request nobody can answer. */
    const served = readdirSync(join(process.cwd(), 'public', 'mock'))

    expect(RESOURCE_NAMES.filter((name) => !served.includes(`${name}.json`))).toEqual([])
  })
})

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return sourceFiles(path)
    }

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** A file with what it says about itself taken out, so a rule about what the code
 *  does is not answered by a comment explaining the rule. */
function codeOf(path: string): string {
  return readFileSync(path, 'utf-8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/\/\/[^\n]*/g, '')
}

describe('the screens that draw a section of a written page', () => {
  /* Three of them: the rulebook, the written pages, and the card on the front
   * page that carries the address of the president. What a record shows is its
   * own sections and the ones it takes in, and that is `sectionsOf`; reading
   * `page.sections` instead draws one record two ways depending on which screen
   * is drawing it.
   *
   * It has been broken quietly once already: the front page went on reading
   * `page.sections` while the comment that said why it should not was deleted in
   * the same change. A comment is not a guard, so this is one. Read off the
   * source, the same shape as the guard on the clock (src/clock/oneClock.test.ts)
   * and the one on the writing of a filter (src/app/filterParams.test.ts).
   *
   * It has to be read off the source, because no screen test can ever catch it:
   * no record in `public/mock/pages.json` takes another one in today, so the two
   * ways of reading a record draw the same thing. The day one does, the screen
   * that reads it the wrong way draws less, and nothing says so.
   */
  const files = sourceFiles(SRC)

  /* The two files that reach for the field itself, each for a reason that is not
     drawing a page: one says what a page shows, the other lists the pages for the
     administrator and counts the sections of each. */
  const ALLOWED = [join('data', 'pages.ts'), join('pages', 'admin', 'AdminPages.tsx')]

  it('reads the whole application, and finds both files that are allowed it', () => {
    expect(files.length).toBeGreaterThan(80)
    expect(files.filter((path) => ALLOWED.some((one) => path.endsWith(one)))).toHaveLength(2)
  })

  it('reaches a record through sectionsOf, never through its own sections', () => {
    /* The field itself, both ways it can be spelt: read off the record, and
       pulled out of it into a name of its own. The first version of this forbade
       `page.sections.map(` and held nothing, because the most ordinary rewrite
       there is walks straight past it; the second forbade `.sections` and was
       walked past by `const { sections } = page`.

       A name that merely reads `sections` is left alone: what comes back from
       `sectionsOf` is called that in the rulebook, and rightly. */
    const READ_OFF_THE_RECORD = /\.sections\b|\{[^}]*\bsections\b[^}]*\}\s*=/

    const straight = files.filter(
      (path) =>
        !ALLOWED.some((one) => path.endsWith(one)) && READ_OFF_THE_RECORD.test(codeOf(path)),
    )

    expect(straight.map((path) => path.slice(SRC.length + 1))).toEqual([])
  })
})
