import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Locale } from '../../i18n/config'
import en from '../../i18n/en.json'
import { I18nProvider } from '../../i18n/I18nProvider'
import sr from '../../i18n/sr.json'
import { ServerSaid } from './ServerSaid'

/**
 * WHAT A BARE NUMBER SAYS, ASKED OF THE ONE COMPONENT THAT SAYS IT FOR ALMOST EVERY SCREEN.
 *
 * <p>Owner, 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza", PENDING stavka 376): a
 * 400 that names no reason gets a sentence of its own instead of „pokusaj ponovo za koji minut".
 * <b>The text is the coordinator's proposal and not the owner's words</b>, and the PDL says so.
 *
 * <p><b>Why 400 and no other number.</b> Measured over `backend/src/main/java` on 02.10.2026:
 * every route that answers 400 without naming a reason does it for a request the portal should
 * never have sent - a body Spring cannot read, a value of the wrong type, a field the route does
 * not take (`ModeratorWriteApi.change` answers `no(BAD_REQUEST, null)` for an address nobody sends).
 * Trying again with the same request cannot go differently, so the old advice was wrong for every
 * one of them. A 404, a 409 without a name and a 5xx are different facts and keep what they said.
 *
 * <p>The component is handed the answer directly, which is what lets every number be asked in one
 * place; that the answer a real route gives arrives here as one of these is measured on a real
 * screen (`pages/Registration.test.tsx`), because `askTheServer` and this component are two files
 * and a case against either alone would not hold the join.
 */

function said(answer: Parameters<typeof ServerSaid>[0]['answer'], locale: Locale = 'sr') {
  render(
    <I18nProvider locale={locale}>
      <MemoryRouter>
        <ServerSaid answer={answer} refusals={{}} />
      </MemoryRouter>
    </I18nProvider>,
  )

  return screen.getByRole('alert')
}

describe('a 400 that named no reason', () => {
  it.each([
    ['sr', sr.server.malformed],
    ['en', en.server.malformed],
  ] as const)('says the portal sent something the server cannot read, in %s', (locale, words) => {
    expect(said({ got: 'wrong', status: 400 }, locale)).toHaveTextContent(words)
  })

  it('does not tell the reader to try again, which would send the same request', () => {
    /* The old sentence for the same number, compared as a whole and not matched by a pattern over
       its words: what the portal says is held as a text by the snapshot of the dictionary, and a
       pattern over prose has no bottom. */
    expect(said({ got: 'wrong', status: 400 })).not.toHaveTextContent(
      sr.server.wrong.replace('{status}', '400'),
    )
  })
})

describe('an answer that named no reason and is not a 400', () => {
  it.each([404, 409, 500, 502])('keeps the number of a %i, and the advice that goes with it', (status) => {
    expect(said({ got: 'wrong', status })).toHaveTextContent(
      sr.server.wrong.replace('{status}', String(status)),
    )
  })

  it('keeps it in English too', () => {
    expect(said({ got: 'wrong', status: 500 }, 'en')).toHaveTextContent(
      en.server.wrong.replace('{status}', '500'),
    )
  })
})
