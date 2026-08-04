import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { RESOURCE_NAMES } from './client'

/* Two rules about written pages and about the resources behind them, both of
 * which say something the code cannot say for itself, and both of which have
 * already been broken once without anything noticing.
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
   */
  const files = sourceFiles(SRC)

  it('reads the whole application, so it cannot pass on an empty list', () => {
    expect(files.length).toBeGreaterThan(80)
    expect(files.filter((path) => readFileSync(path, 'utf-8').includes('sectionsOf(')).length).toBe(
      4,
    )
  })

  it('reaches a record through sectionsOf, never through its own sections', () => {
    const straight = files.filter((path) => readFileSync(path, 'utf-8').includes('.sections.map('))

    expect(straight.map((path) => path.slice(SRC.length + 1))).toEqual([])
  })
})
