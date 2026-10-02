import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import sr from '../../i18n/sr.json'
import { translate } from '../../i18n/translate'
import { sources, WHOLE_PORTAL } from '../../test/sources'
import { whatABareNumberSays } from './serverWords'

/**
 * WHICH SENTENCE A BARE NUMBER GETS, AND THAT THERE IS ONE PLACE THAT DECIDES IT.
 *
 * <p>Owner, 02.10.2026 (PENDING stavka 376): a 400 that names no reason gets a sentence of its own
 * rather than „pokusaj ponovo za koji minut". The decision lives in `whatABareNumberSays`, and what
 * this file holds is the two halves of that: the function answers what it should, and nothing else
 * on the portal says the old sentence behind its back.
 *
 * <p><b>The floor is a question put to the parser and not a list of files.</b> „Which production
 * modules hold the string literal `server.wrong`" has a bottom: every `.ts` and `.tsx` under `src`
 * is read, and a literal is a node, so a comment that mentions the key (several do) is not
 * one. It is NOT „which screens show a bare number", which would have to follow a value through
 * code and has no bottom.
 */

/**
 * The one module that decides it, by its place under `src`.
 *
 * <p><b>There was a second one named here until 02.10.2026</b>: `admin/PendingQueue.tsx`
 * (`WhatTheServerSaid`) kept its own copy of the old sentence for the verification queue, as a boundary
 * this file named and failed on the day the copy went, because the branch that held that screen was in
 * flight. The copy went in the commit that deleted its name from here, and what the cases below say now
 * has no exception in it.
 */
const THE_ONE_PLACE = 'pages/account/serverWords.ts'

/**
 * Every production module that holds this string literal, read off the parser so a comment that
 * mentions the key is not one, by its place under `src` and spelt the one way on either platform.
 */
function holders(key: string): string[] {
  const src = join(process.cwd(), 'src')

  return sources()
    .filter(({ code }) => code.includes(key))
    .filter(({ path, code }) => {
      const file = ts.createSourceFile(
        path,
        code,
        ts.ScriptTarget.Latest,
        true,
        path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      )
      let found = false

      const visit = (node: ts.Node): void => {
        if (found) {
          return
        }

        if (
          (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
          node.text === key
        ) {
          found = true

          return
        }

        ts.forEachChild(node, visit)
      }

      visit(file)

      return found
    })
    .map(({ path }) => relative(src, path).split(sep).join('/'))
    .sort()
}

describe('which sentence a bare number gets', () => {
  it('reads a 400 as a request the server cannot read, and any other number as a wait', () => {
    expect(whatABareNumberSays(400)).toBe('server.malformed')

    /* Every number a route of this server can answer without a reason and that `askTheServer`
       reads as `wrong`, and 401 and 403 beside them although the first becomes `wrong` only on the
       sign-in screen and the second never does: a number that is not 400 is not read as one. */
    for (const status of [401, 403, 404, 409, 413, 422, 429, 500, 502, 503]) {
      expect(whatABareNumberSays(status), `${String(status)} was read as a 400`).toBe('server.wrong')
    }
  })

  it.each([
    ['sr', sr],
    ['en', en],
  ] as const)('answers keys that both stand in the %s dictionary', (locale, dictionary) => {
    for (const status of [400, 500]) {
      const key = whatABareNumberSays(status)

      expect(translate(dictionary, locale, key, { status }), `${key} is missing in ${locale}`).not.toBe(
        key,
      )
    }
  })

  it('puts the number into the sentence that is about a number and into no other', () => {
    for (const dictionary of [sr, en]) {
      expect(dictionary.server.wrong).toContain('{status}')
      expect(dictionary.server.malformed).not.toContain('{status}')
    }
  })
})

describe('the one place that decides it', () => {
  it('reads the whole portal', () => {
    /* The floor under the two cases below: a sweep narrowed by accident answers with nothing, and
       „nobody else says it" is then true of a portal nobody looked at. */
    expect(sources().length).toBeGreaterThan(WHOLE_PORTAL)
  })

  it('is the only module that says the sentence about a number', () => {
    expect(holders('server.wrong')).toEqual([THE_ONE_PLACE])
  })

  it('is the only module that says the sentence about the portal’s own fault', () => {
    expect(holders('server.malformed')).toEqual([THE_ONE_PLACE])
  })
})
