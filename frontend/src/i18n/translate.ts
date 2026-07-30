/* The whole translation engine. It is deliberately small: a nested dictionary,
 * dotted keys, {placeholder} interpolation and plural selection through
 * Intl.PluralRules.
 *
 * Plural rules are the reason this cannot be a plain lookup. Serbian has three
 * cardinal categories (1 trka, 3 trke, 5 trka) and the browser already knows
 * them, so a key may hold either a string or a set of plural forms.
 */

import { intlTag } from './intlTag'

export type Dictionary = { [key: string]: string | Dictionary }

export type TranslateParams = Record<string, string | number>

function resolve(dictionary: Dictionary, key: string): string | Dictionary | undefined {
  let node: string | Dictionary | undefined = dictionary

  for (const part of key.split('.')) {
    if (typeof node !== 'object') {
      return undefined
    }
    node = node[part]
  }

  return node
}

/* Kept per locale, like the formatters in ./format.ts and for the same reason:
 * building an Intl object costs, using one again does not. This one is the
 * hottest of the three, because a plural key is what the front page counters read
 * on every frame of the number they unroll. */
const plurals = new Map<string, Intl.PluralRules>()

function pluralRules(locale: string): Intl.PluralRules {
  const tag = intlTag(locale)
  const found = plurals.get(tag)

  if (found !== undefined) {
    return found
  }

  const made = new Intl.PluralRules(tag)
  plurals.set(tag, made)

  return made
}

function interpolate(text: string, params: TranslateParams): string {
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name]
    // An unknown placeholder is left as written, so the gap is visible in the
    // UI instead of turning into the word "undefined".
    return value === undefined ? placeholder : String(value)
  })
}

/**
 * Returns the translated text, or the key itself when the key is missing or
 * used the wrong way. Returning the key keeps the screen usable and makes the
 * mistake obvious at a glance.
 */
export function translate(
  dictionary: Dictionary,
  locale: string,
  key: string,
  params: TranslateParams = {},
): string {
  const node = resolve(dictionary, key)

  if (node === undefined) {
    return key
  }

  if (typeof node === 'string') {
    return interpolate(node, params)
  }

  const count = params.count

  if (typeof count !== 'number') {
    return key
  }

  const category = pluralRules(locale).select(count)
  const form = node[category] ?? node.other

  if (typeof form !== 'string') {
    return key
  }

  return interpolate(form, params)
}
