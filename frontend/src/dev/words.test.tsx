import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import en from '../i18n/en.json'
import { I18nProvider } from '../i18n/I18nProvider'
import type { Locale } from '../i18n/config'
import sr from '../i18n/sr.json'
import type { Dictionary } from '../i18n/translate'
import { ROLES } from '../roles/context'
import { DEV_WORDS, useDevWords } from './words'

/**
 * THE WORDS OF THE TWO DEVELOPMENT CONTROLS, HELD AS A PAIR AND HELD APART FROM THE PORTAL'S.
 *
 * They are in a book of their own so that a production bundle does not carry them
 * (`dev/words.ts`; what holds that is `productionPackage.test.ts`, which asks the bundler).
 * What is held here is the other half of it: that the two books are a pair, as
 * `i18n/bothDictionaries.test.ts` holds the portal's, and that no name has two homes. A name
 * written in both would be asked of whichever book the asking file happens to import, and the
 * one that was not edited would go on saying what it said.
 */

function names(node: Dictionary, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : names(value, `${prefix}${key}.`),
  )
}

function inLocale(locale: Locale) {
  return renderHook(() => useDevWords().t, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nProvider locale={locale}>{children}</I18nProvider>
    ),
  }).result.current
}

describe('the words of the development controls', () => {
  it('are a pair: the same names in both languages, and a language in each', () => {
    expect(names(DEV_WORDS.sr).length).toBeGreaterThan(0)
    expect(names(DEV_WORDS.en)).toEqual(names(DEV_WORDS.sr))

    /* The alphabet, as `bothDictionaries.test.ts` asks it: a byte copy of the Serbian book
       has the same names by construction. */
    const serbianLetters = /[čćšžđČĆŠŽĐ]/
    const carrying = names(DEV_WORDS.sr).filter((name) => serbianLetters.test(read(DEV_WORDS.sr, name)))

    expect(carrying.length).toBeGreaterThan(0)
    expect(names(DEV_WORDS.en).filter((name) => serbianLetters.test(read(DEV_WORDS.en, name)))).toEqual(
      [],
    )
  })

  it('name every role the switch offers, in both languages', () => {
    /* A family, `role.${option}`: a name composed out of a value, so the source scan of
       `i18n/said.test.ts` cannot read it and it is walked here against the list it is
       built from (`roles/RoleSwitch.tsx`). */
    const missing = ROLES.flatMap((role) => [
      ...(read(DEV_WORDS.sr, `role.${role}`) === '' ? [`sr role.${role}`] : []),
      ...(read(DEV_WORDS.en, `role.${role}`) === '' ? [`en role.${role}`] : []),
    ])

    expect(ROLES.length).toBeGreaterThan(0)
    expect(missing).toEqual([])
  })

  it('live in no other book: a name has one home', () => {
    const portal = new Set([...names(sr), ...names(en)])

    expect(names(DEV_WORDS.sr).filter((name) => portal.has(name))).toEqual([])
    expect(names(DEV_WORDS.en).filter((name) => portal.has(name))).toEqual([])
  })

  it('answer in the language of the address', () => {
    expect(inLocale('sr')('clock.label')).toBe('Današnji datum')
    expect(inLocale('en')('clock.label')).toBe("Today's date")
    expect(inLocale('sr')('server.named')).toBe('sa servera')
    expect(inLocale('en')('server.named')).toBe('from the server')
  })
})

function read(book: Dictionary, name: string): string {
  let at: string | Dictionary | undefined = book

  for (const step of name.split('.')) {
    at = typeof at === 'object' ? at[step] : undefined
  }

  return typeof at === 'string' ? at : ''
}
