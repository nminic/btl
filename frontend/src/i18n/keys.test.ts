import { ROUTES } from '../app/routes'
import registracija from '../forms/definitions/registracija.form.json'
import type { FormDef } from '../forms/types'
import sr from './sr.json'
import { translate, type Dictionary } from './translate'

const dictionary = sr as Dictionary

/* translate() returns the key itself when a key is missing, which keeps the
 * screen usable but is invisible to every other test: a route pointing at
 * nav.nepostoji renders "nav.nepostoji" and nothing fails. This is the test
 * that notices. */
function resolves(key: string): boolean {
  return translate(dictionary, 'sr', key) !== key
}

describe('translation keys used in code', () => {
  it('exist for every route label', () => {
    const missing = ROUTES.map((route) => route.labelKey).filter((key) => !resolves(key))

    expect(missing).toEqual([])
  })

  it('exist for every part of the registration form', () => {
    const form = registracija as FormDef
    const keys = [form.titleKey, form.submitKey]

    for (const field of form.fields) {
      keys.push(field.labelKey)

      if (field.hintKey !== undefined) {
        keys.push(field.hintKey)
      }

      for (const option of field.options ?? []) {
        keys.push(option.labelKey)
      }
    }

    expect(keys.filter((key) => !resolves(key))).toEqual([])
  })

  it('notices a key that is not there', () => {
    expect(resolves('nav.nepostoji')).toBe(false)
  })
})
