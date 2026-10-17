import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import sr from '../../i18n/sr.json'
import {
  MAIL_LANGUAGES,
  THE_MAIL_LANGUAGE_GOES_TO,
  WHEN_CHOOSING_THE_LANGUAGE_OF_MAIL,
  mailLanguageChosenIn,
  mailLanguageOfMe,
} from './mailLanguage'

/**
 * THE TWO CODES THIS SIDE OFFERS ARE THE TWO THE SERVER WRITES.
 *
 * <p>The list is written by hand in `mailLanguage.ts`, and the floor under it is a query over the
 * source of truth, in the same commit: `MailLanguage.java` is read off the disc and its codes are
 * required to be exactly these, in both directions. A third language added to the enum arrives here
 * as a red case, and a code offered here that the enum has not got arrives as one too - which is the
 * state `MeMailLanguageApi` answers 400 and a reader would meet as a radio that does nothing.
 */
const ENUM = join(
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
  'mail',
  'MailLanguage.java',
)

const ROUTE = join(
  process.cwd(),
  '..',
  'backend',
  'src',
  'main',
  'java',
  'com',
  'btl',
  'portal',
  'web',
  'MeMailLanguageApi.java',
)

describe('the languages a mail can be written in', () => {
  it('are the codes of the enum the server writes them with, no more and no fewer', () => {
    const java = readFileSync(ENUM, 'utf-8')
    const codes = [...java.matchAll(/^\s*[A-Z_]+\("([a-z]+)",/gm)].map((one) => one[1])

    expect(codes.length, 'the enum was not read, so this measures nothing').toBeGreaterThan(0)
    expect([...MAIL_LANGUAGES].toSorted()).toEqual(codes.toSorted())
  })

  it('go to the address the server maps them to', () => {
    const java = readFileSync(ROUTE, 'utf-8')

    expect(java).toContain(`@PutMapping(path = "${THE_MAIL_LANGUAGE_GOES_TO}"`)
  })
})

describe('reading the language off an answer', () => {
  it('takes the account\'s own from the name GET /api/me gives it', () => {
    expect(mailLanguageOfMe({ role: 'competitor', account: 1, mailLanguage: 'en' })).toBe('en')
    expect(mailLanguageOfMe({ mailLanguage: 'sr' })).toBe('sr')
  })

  it('takes the written one from the name PUT /api/me/mail-language gives it', () => {
    expect(mailLanguageChosenIn({ language: 'en' })).toBe('en')
    expect(mailLanguageChosenIn({ language: 'sr' })).toBe('sr')
  })

  it('does not take either from the other\'s name', () => {
    /* Two routes, two names. A reader that accepted both would answer „en" for a body that named
       the OTHER route's field, which is one release of the server away from the portal. */
    expect(mailLanguageOfMe({ language: 'en' })).toBeNull()
    expect(mailLanguageChosenIn({ mailLanguage: 'en' })).toBeNull()
  })

  it.each([
    ['a language the portal does not write', { mailLanguage: 'de', language: 'de' }],
    ['a capital the server would never send', { mailLanguage: 'EN', language: 'EN' }],
    ['a number', { mailLanguage: 1, language: 1 }],
    ['nothing', { mailLanguage: null, language: null }],
    ['an empty object', {}],
    ['no object at all', null],
    ['a string', 'en'],
    ['an array', ['en']],
  ])('says nothing for %s', (_what, body) => {
    expect(mailLanguageOfMe(body)).toBeNull()
    expect(mailLanguageChosenIn(body)).toBeNull()
  })
})

describe('the one refusal the route names', () => {
  it('is the one the Java file declares, with a sentence in both dictionaries', () => {
    const java = readFileSync(ROUTE, 'utf-8')
    const declared = [...java.matchAll(/static final String \w+\s*=\s*"([^"]+)";/g)].map(
      (one) => one[1],
    )

    expect(declared).toEqual(['theFormIsNotComplete'])
    expect(Object.keys(WHEN_CHOOSING_THE_LANGUAGE_OF_MAIL)).toEqual(declared)
    expect(sr.settings.mailLanguageNotChosen).not.toBe('')
    expect(en.settings.mailLanguageNotChosen).not.toBe('')
    expect(WHEN_CHOOSING_THE_LANGUAGE_OF_MAIL.theFormIsNotComplete).toBe(
      'settings.mailLanguageNotChosen',
    )
  })
})
