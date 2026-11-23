import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import sr from '../../i18n/sr.json'
import { theMarkOf, WHEN_SETTING_A_LEAGUES_MARK } from './leagueMarkWrites'

/**
 * EVERY REASON THE TWO DOORS OF A LEAGUE'S MARK CAN NAME HAS A SENTENCE, AND NOTHING ELSE DOES.
 *
 * `LeagueMarkApi` declares no reason of its own and refuses with constants of two other classes, so the
 * floor in `account/refusals.test.ts`, which reads the constants a file DECLARES, has nothing to read in it.
 * This reads what it USES instead: every `MePhotoApi.X` and `LeagueWriteApi.X` the class names, resolved to
 * its value in the file that declares it. A refusal added to the class, or one taken away, fails here by
 * name, in both directions.
 */
const WEB = join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web')

function valueOf(owner: string, constant: string): string {
  const java = readFileSync(join(WEB, `${owner}.java`), 'utf-8')
  const found = new RegExp(`static final String ${constant}\\s*=\\s*"([^"]+)";`).exec(java)

  if (found?.[1] === undefined) {
    throw new Error(`${owner}.${constant} is not a text constant of ${owner}.java`)
  }

  return found[1]
}

function sentence(key: string): unknown {
  return key.split('.').reduce<unknown>((at, part) => (typeof at === 'object' && at !== null ? Reflect.get(at, part) : undefined), sr)
}

describe('the refusals of a league’s mark', () => {
  it('are exactly the reasons LeagueMarkApi names, each with a sentence of the dictionary', () => {
    const java = readFileSync(join(WEB, 'LeagueMarkApi.java'), 'utf-8')
    const named = [...java.matchAll(/\b(MePhotoApi|LeagueWriteApi)\.([A-Z][A-Z_]+)\b/g)]
      .map((one) => valueOf(one[1] ?? '', one[2] ?? ''))

    expect(named.length, 'no reason was read out of LeagueMarkApi.java at all').toBeGreaterThan(0)
    expect(Object.keys(WHEN_SETTING_A_LEAGUES_MARK).sort()).toEqual([...new Set(named)].sort())

    for (const [reason, key] of Object.entries(WHEN_SETTING_A_LEAGUES_MARK)) {
      expect(typeof sentence(key), `${reason} points at ${key}, which the dictionary does not carry`).toBe('string')
    }
  })

  it('go to the address of the league named, and of no other', () => {
    expect(theMarkOf(7)).toBe('/api/leagues/7/logo')
    expect(theMarkOf(12)).toBe('/api/leagues/12/logo')
  })
})
