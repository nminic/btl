import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SHORTEST_PASSWORD } from './passwordRule'

/**
 * THE NUMBER THE SCREEN PROMISES IS THE NUMBER THE SERVER KEEPS.
 *
 * <p>The rule is the owner's, 11.09.2026: „lozinka najmanje 12 znakova, bez ostalih
 * uslova, uz proveru na listi procurelih" (`ADL.md`). It is enforced in one place,
 * `PasswordPolicy.SHORTEST`, and the number below is the portal's only copy of it.
 *
 * <p>Two sentences on one screen carry that number, and both were decided rather than
 * assumed: the words the server's refusal is told in, and - since the owner asked for
 * it on 20.09.2026 - the rule beside the field itself. Which sentences those are is
 * `pages/account/newPassword.test.tsx`'s business; this file holds only that the number
 * in them is the server's.
 *
 * <p><b>Two places holding one number is the fault this file exists against, and the
 * portal already carries a standing example of it.</b> `forms/definitions/registracija.form.json`
 * says `minLength: 10` where the owner decided twelve, and has said so since before
 * there was a server to disagree with. That is not this increment's to change - it is
 * a registration screen and a decision about what happens to a form that has been
 * written against for weeks - but it is exactly what an unheld copy becomes.
 */

describe('how long a password has to be', () => {
  it('is the number PasswordPolicy keeps', () => {
    const java = readFileSync(
      join(
        process.cwd(),
        '..',
        'backend',
        'src',
        'main',
        'java',
        'com',
        'btl',
        'portal',
        'domain',
        'account',
        'PasswordPolicy.java',
      ),
      'utf-8',
    )

    const written = /public static final int SHORTEST = (\d+);/.exec(java)

    expect(
      written,
      'PasswordPolicy no longer declares SHORTEST the way this reads it, so the number'
        + ' beside the field is held to nothing',
    ).not.toBeNull()
    expect(Number(written?.[1])).toBe(SHORTEST_PASSWORD)
  })
})
