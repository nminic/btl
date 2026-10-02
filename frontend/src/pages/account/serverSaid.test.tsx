import { cleanup, render, screen } from '@testing-library/react'
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

/**
 * A ROUTE THAT GIVES ONE OF ITS BARE NUMBERS A MEANING OF ITS OWN (PENDING stavka 316).
 *
 * <p>`DELETE /api/pairs/{id}` names no refusal at all and answers an empty 404 for four callers at
 * once on purpose (`ADL` A8), so its 404 cannot be said by name, and it cannot be said as „try again
 * in a few minutes" either: of the four, one is answered by waiting and three are not. The route's
 * screen hands in what its OWN number means, and `ServerSaid` says that instead of the portal's
 * general sentence for a number.
 *
 * <p><b>The table is for the numbers a route gives a meaning to and for nothing else.</b> A number
 * that is not in it is read as every other screen reads it (a 400 as the portal's own fault, any
 * other as a wait), and the answers that are not a bare number at all (no answer, the token
 * refused) never look at it.
 */
describe('a bare number that the route gives a meaning of its own', () => {
  const MEANINGS = { 404: 'pair.breakRefused.notHeld' }

  /** `null` is „no table at all", which is every other screen, and not an empty one. */
  function saidWith(
    answer: Parameters<typeof ServerSaid>[0]['answer'],
    numbers: Record<number, string> | null = MEANINGS,
    locale: Locale = 'sr',
  ) {
    render(
      <I18nProvider locale={locale}>
        <MemoryRouter>
          <ServerSaid answer={answer} refusals={{}} numbers={numbers ?? undefined} />
        </MemoryRouter>
      </I18nProvider>,
    )

    return screen.getByRole('alert')
  }

  it.each([
    ['sr', sr.pair.breakRefused.notHeld],
    ['en', en.pair.breakRefused.notHeld],
  ] as const)('says the route’s own sentence for the number it names, in %s', (locale, words) => {
    expect(saidWith({ got: 'wrong', status: 404 }, MEANINGS, locale)).toHaveTextContent(words)
  })

  it('does not say the general sentence for that number as well', () => {
    expect(saidWith({ got: 'wrong', status: 404 })).not.toHaveTextContent(
      sr.server.wrong.replace('{status}', '404'),
    )
  })

  it('reads a number the table does not name as every other screen does', () => {
    expect(saidWith({ got: 'wrong', status: 500 })).toHaveTextContent(
      sr.server.wrong.replace('{status}', '500'),
    )
  })

  it('reads a 400 the table does not name as the portal’s own fault', () => {
    expect(saidWith({ got: 'wrong', status: 400 })).toHaveTextContent(sr.server.malformed)
  })

  it('lets the table take a 400 too, and says the route’s sentence for it', () => {
    expect(
      saidWith({ got: 'wrong', status: 400 }, { 400: 'pair.breakRefused.notHeld' }),
    ).toHaveTextContent(sr.pair.breakRefused.notHeld)
  })

  it('does not look at the table for an answer that is not a bare number', () => {
    expect(saidWith({ got: 'nothing' })).toHaveTextContent(sr.server.nothing)

    cleanup()

    expect(saidWith({ got: 'rejected' })).toHaveTextContent(sr.server.rejected)
  })

  it('needs no table at all, which is every other screen', () => {
    expect(saidWith({ got: 'wrong', status: 404 }, null)).toHaveTextContent(
      sr.server.wrong.replace('{status}', '404'),
    )
  })
})
