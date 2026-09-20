import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { formDef } from './definitions'

/* THE LENGTH A FORM DEMANDS IS THE LENGTH THE SERVER KEEPS.
 *
 * The rule is the owner's, 11.09.2026: „lozinka najmanje 12 znakova, bez ostalih
 * uslova, uz proveru na listi procurelih" (`ADL.md` A43). The server holds it in
 * one place, `PasswordPolicy.SHORTEST`, and every route that takes a password -
 * registration and the password reset alike - asks that one type.
 *
 * A form definition is the second place the same number lives, and it has to, for
 * a reason that is not tidiness: the form is the only half that can refuse before
 * the member presses the button. `RegistrationApi` says so itself, about why the
 * server tells a leaked password apart from a short one but not a short one from a
 * complete form - „the length is a rule the form carries and can apply as he
 * types". A form that demands less than the server is therefore not a smaller rule
 * but a broken promise: it lets the password through, the server refuses it, and
 * the member gets the refusal after sending, on a screen that does not remember
 * what he typed.
 *
 * That is not a thought experiment. Until this file existed
 * `registracija.form.json` said ten where the server said twelve, so a password of
 * ten or eleven characters passed the form and died at the server, and nothing
 * anywhere noticed the two numbers had never agreed.
 *
 * WHAT HOLDS THE PAIR, AND IN WHICH DIRECTION. The Java source is the source of
 * truth and this file reads it; the JSON is the copy and this file checks it. So
 * the pair falls apart whichever of the two is moved - changing the JSON fails
 * because it no longer equals the server, and changing `SHORTEST` fails because
 * the JSON no longer follows it. A file that only knew the JSON would hold one
 * side and call it a pair.
 *
 * WHY IT SWEEPS RATHER THAN NAMES. Reading the folder means a form definition
 * written tomorrow with a password field on it is held on the day it is written,
 * not on the day somebody remembers this file. The same reason
 * `definitions.test.ts` reads the folder instead of `./definitions`.
 *
 * Its twin is `pages/account/passwordRule.test.ts`, which holds the number the
 * screen writes out beside the field. Same source of truth, different copy: one
 * is what the portal says, this one is what the form refuses.
 */

const DEFINITIONS = join(process.cwd(), 'src', 'forms', 'definitions')

const POLICY = join(
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
)

/* Read rather than imported, because nothing compiles Java on this side of the
   portal. The declaration is matched whole so that the file cannot quietly start
   reading nothing: `SHORTEST` renamed, moved to a method or turned into a
   computed value leaves no match, and the first case below is what says so out
   loud rather than letting `Number(undefined)` become a NaN that equals nothing. */
const JAVA = readFileSync(POLICY, 'utf-8')
const DECLARED = /public static final int SHORTEST = (\d+);/.exec(JAVA)
const SHORTEST = Number(DECLARED?.[1])

/* Off the disk and through `formDef` on the way, which is what says the field
   types are ones the portal can draw: a definition naming `"pasword"` would
   otherwise slip past a sweep looking for `"password"` and be held by nothing. */
const PASSWORDS = readdirSync(DEFINITIONS)
  .filter((name) => name.endsWith('.form.json'))
  .flatMap((name) =>
    formDef(JSON.parse(readFileSync(join(DEFINITIONS, name), 'utf-8')))
      .fields.filter((field) => field.type === 'password')
      .map((field) => ({ where: `${name}, field ${field.name}`, field })),
  )

/* A password the member is choosing, as opposed to one he is typing a second
   time. The repeat is held by the field it mirrors and needs no length of its
   own; asking it for one would be inventing a rule nobody decided. */
const CHOSEN = PASSWORDS.filter(({ field }) => field.matches === undefined)

describe('how long a password a form will accept', () => {
  it('is still a number that can be read out of PasswordPolicy', () => {
    /* The whole file rests on this one line of Java. If it stops being found,
       every case below would compare against NaN and pass nothing on to anybody,
       so the failure has to be here and has to say what happened. */
    expect(
      DECLARED,
      `PasswordPolicy no longer declares SHORTEST the way this file reads it (${POLICY}),`
        + ' so every form definition below is being held to nothing',
    ).not.toBeNull()
    expect(SHORTEST).toBeGreaterThan(0)
  })

  it('is asked of a password field that really exists', () => {
    /* So the two cases below cannot pass by sweeping an empty list. Both kinds
       have to be found: a password somebody chooses, and the folder holding at
       least one password field at all. Registration has one of each today. */
    expect(PASSWORDS.length, 'no form definition has a password field, so nothing below is measured')
      .toBeGreaterThan(0)
    expect(CHOSEN.length, 'every password field is a repeat of another, so no length is measured')
      .toBeGreaterThan(0)
  })

  it('is exactly the length the server keeps, in every definition that names one', () => {
    /* The pair. Move either number and this is what falls. */
    for (const { where, field } of PASSWORDS) {
      if (field.minLength === undefined) {
        continue
      }

      expect(
        field.minLength,
        `${where} demands ${field.minLength} characters where PasswordPolicy.SHORTEST keeps`
          + ` ${SHORTEST}. The form would take a password the server refuses, and the member`
          + ' would be told so only after sending.',
      ).toBe(SHORTEST)
    }
  })

  it('is demanded at all, wherever a member chooses a password', () => {
    /* The other way the promise breaks, and it passes the case above silently:
       drop `minLength` out of the definition and there is no number left to
       disagree with the server, so a sweep for disagreement finds none. The form
       would then refuse nothing and send every short password to be refused. */
    for (const { where, field } of CHOSEN) {
      expect(
        field.minLength,
        `${where} is a password a member chooses and it demands no length at all, so the form`
          + ` sends a password of any length to a server that keeps ${SHORTEST}`,
      ).toBe(SHORTEST)
    }
  })
})
