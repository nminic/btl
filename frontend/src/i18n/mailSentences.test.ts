import { CONTACT_ADDRESS } from '../app/routes'
import en from './en.json'
import sr from './sr.json'

/**
 * THE THREE SENTENCES THAT SPEAK OF A MESSAGE, AND WHAT THEY MAY NOT CLAIM.
 *
 * Owner, 21.10.2026 (PDL P8, „Rečenice posle registracije, ponovnog slanja potvrde i
 * zaboravljene lozinke ne tvrde da je poruka poslata"; chose between the offered ones, with
 * the author's recommendation; PENDING 28430): the relay may refuse the message, and the screen
 * had already said it was sent. So none of them says „sent": each says „we are sending", and
 * each ends with the way to reach the League when it does not arrive.
 *
 * **Read from the dictionaries, as a sentence is, and not drawn through a screen.** The
 * screens that show them (`Registration.test.tsx`, `forgottenPassword.test.tsx`) pin that the
 * sentence appears and when; what none of them pins is what the sentence SAYS, and a sentence
 * written back as „poruka je poslata" would pass every one of them.
 *
 * **The condition of two of them is the other half of the decision, and it is asked for as
 * well.** „Rečenica kod zaboravljene lozinke i dalje ne otkriva da li nalog postoji": the
 * forgotten-password sentence opens with „if there is an account" and names no address, and
 * the sentence after a second press opens with „if this address is still waiting". The
 * route answers the same for every address, so a sentence that dropped the „if" would say
 * what the route refuses to.
 */

const SERBIAN_CLOSING = `Ako ne stigne za nekoliko minuta, javi nam se na ${CONTACT_ADDRESS}.`
const ENGLISH_CLOSING = `If it does not arrive within a few minutes, write to us at ${CONTACT_ADDRESS}.`

/** A claim that the message has gone: the past of „to send", in either language. */
const SERBIAN_CLAIM = /\bposla(ta|to|ti|li|o|la|lo)\b/i
const ENGLISH_CLAIM = /\bsent\b/i

const SENTENCES: [name: string, serbian: string, english: string][] = [
  ['registration.doneText', sr.registration.doneText, en.registration.doneText],
  ['registration.resent', sr.registration.resent, en.registration.resent],
  ['forgottenPassword.done', sr.forgottenPassword.done, en.forgottenPassword.done],
]

describe('the sentences that speak of a message', () => {
  it('are the three of them, each in both languages', () => {
    expect(SENTENCES.map(([name]) => name)).toEqual([
      'registration.doneText',
      'registration.resent',
      'forgottenPassword.done',
    ])

    for (const [, serbian, english] of SENTENCES) {
      expect(serbian.length).toBeGreaterThan(0)
      expect(english.length).toBeGreaterThan(0)
    }
  })

  it.each(SENTENCES)('%s does not say the message is sent', (_name, serbian, english) => {
    expect(serbian).not.toMatch(SERBIAN_CLAIM)
    expect(english).not.toMatch(ENGLISH_CLAIM)
  })

  it.each(SENTENCES)('%s says it is being sent', (_name, serbian, english) => {
    expect(serbian).toContain('šaljemo')
    expect(english.toLowerCase()).toContain('we are sending')
  })

  it.each(SENTENCES)('%s ends with the way to reach the League', (_name, serbian, english) => {
    expect(serbian.endsWith(SERBIAN_CLOSING)).toBe(true)
    expect(english.endsWith(ENGLISH_CLOSING)).toBe(true)
  })

  it('draws the confirmation after registering as the owner approved it', () => {
    expect(sr.registration.doneText).toBe(
      `Na {email} šaljemo poruku za potvrdu. Otvori je i potvrdi adresu, jer se nalog aktivira tek tada. ${SERBIAN_CLOSING}`,
    )
  })

  it('keeps the condition of the two that cannot know whether anything goes out', () => {
    expect(sr.registration.resent.startsWith('Ako ova adresa još čeka potvrdu, ')).toBe(true)
    expect(en.registration.resent.startsWith('If this address is still waiting to be confirmed, ')).toBe(
      true,
    )
    expect(sr.forgottenPassword.done.startsWith('Ako na toj adresi postoji nalog, ')).toBe(true)
    expect(en.forgottenPassword.done.startsWith('If there is an account at that address, ')).toBe(
      true,
    )
  })

  it('does not name an address in the one that must not say whether an account exists', () => {
    expect(sr.forgottenPassword.done).not.toContain('{')
    expect(en.forgottenPassword.done).not.toContain('{')
  })
})
