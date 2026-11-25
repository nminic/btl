import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import sr from '../../i18n/sr.json'
import {
  A_WAITING_LOGO_IS_NAMED_BY,
  ourLogoAt,
  theTeamsLogoAt,
  theWaitingLogoAddressIn,
  WHEN_SENDING_A_TEAMS_LOGO,
  WHEN_SETTING_A_TEAMS_LOGO,
} from './teamLogoWrites'

/**
 * EVERY REASON THE TWO DOORS OF A TEAM'S LOGO CAN NAME HAS A SENTENCE, AND NOTHING ELSE DOES.
 *
 * `TeamLogoApi` declares no reason of its own and refuses with `MePhotoApi`'s constants, so the floor in
 * `account/refusals.test.ts`, which reads the constants a file DECLARES, has nothing to read in it. This reads what
 * it USES instead, resolved to its value in `MePhotoApi.java`, and for each door apart: the editor's door is the
 * whole class, and the administration's door is its own method and the check of the picture it calls. A refusal
 * added to either door, or taken away, fails here by name, in both directions.
 */
const WEB = join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web')
const JAVA = readFileSync(join(WEB, 'TeamLogoApi.java'), 'utf-8')
const PHOTO = readFileSync(join(WEB, 'MePhotoApi.java'), 'utf-8')

function valueOf(constant: string): string {
  const found = new RegExp(`static final String ${constant}\\s*=\\s*"([^"]+)";`).exec(PHOTO)

  if (found?.[1] === undefined) {
    throw new Error(`MePhotoApi.${constant} is not a text constant of MePhotoApi.java`)
  }

  return found[1]
}

function namedIn(text: string): string[] {
  return [...new Set([...text.matchAll(/\bMePhotoApi\.([A-Z][A-Z_]+)\b/g)].map((one) => valueOf(one[1] ?? '')))].sort()
}

function between(from: string, to: string): string {
  const start = JAVA.indexOf(from)
  const end = JAVA.indexOf(to, start)

  if (start < 0 || end < 0) {
    throw new Error(`TeamLogoApi.java has no stretch from ${from} to ${to}`)
  }

  return JAVA.slice(start, end)
}

function sentence(key: string): unknown {
  return key.split('.').reduce<unknown>((at, part) => (typeof at === 'object' && at !== null ? Reflect.get(at, part) : undefined), sr)
}

describe('the refusals of a team’s logo', () => {
  it('are, on the editor’s door, exactly the reasons TeamLogoApi names, each with a sentence', () => {
    const named = namedIn(JAVA)

    expect(named.length, 'no reason was read out of TeamLogoApi.java at all').toBeGreaterThan(0)
    expect(Object.keys(WHEN_SENDING_A_TEAMS_LOGO).sort()).toEqual(named)

    for (const [reason, key] of Object.entries(WHEN_SENDING_A_TEAMS_LOGO)) {
      expect(typeof sentence(key), `${reason} points at ${key}, which the dictionary does not carry`).toBe('string')
    }
  })

  it('are, on the administration’s door, the reasons its own method and the check it calls name', () => {
    const named = namedIn(
      between('ResponseEntity<?> setTheLogo(', 'ResponseEntity<?> takeTheLogoDown(') +
        between('whyThePictureIsRefused(MultipartFile', 'private long aPhotoRow('),
    )

    expect(named).not.toContain(valueOf('THE_PICTURE_HAS_CHANGED'))
    expect(Object.keys(WHEN_SETTING_A_TEAMS_LOGO).sort()).toEqual(named)
  })

  it('go to the address of the team named, and of no other', () => {
    expect(ourLogoAt(7)).toBe('/api/teams/7/own-logo')
    expect(theTeamsLogoAt(12)).toBe('/api/teams/12/logo')
  })

  it('name the logo that waits by the digest the route answered with, and by nothing else', () => {
    expect(A_WAITING_LOGO_IS_NAMED_BY).toBe('/api/teams/own-logo/')
    expect(theWaitingLogoAddressIn({ waiting: 3, digest: 'ab12', standing: null })).toBe('/api/teams/own-logo/ab12')
    expect(theWaitingLogoAddressIn({ digest: '' })).toBeNull()
    expect(theWaitingLogoAddressIn({ digest: 7 })).toBeNull()
    expect(theWaitingLogoAddressIn(null)).toBeNull()
    expect(theWaitingLogoAddressIn('ab12')).toBeNull()
  })
})
