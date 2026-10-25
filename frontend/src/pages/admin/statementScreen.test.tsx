import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { inputElement } from '../../test/at'
import { renderAt } from '../../test/render'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { STATEMENT_LINES, STATEMENTS } from './statement'

/**
 * THE BANK STATEMENT ON THE PAYMENTS SCREEN (owner, 24.10.2026, PDL „Učitavanje izvoda iz banke na
 * ekranu Uplate"): the file is sent to the server, which reads it, books what qualifies and says so,
 * and the list under the box shows every payment that still waits and whom it may be about.
 *
 * <p>The cases of the box that stood in `pages/adminFlows.test.tsx` moved here with it, because the
 * box now speaks to a route and every one of them needs a server in front.
 */

const PAYMENTS = '/sr/administracija/verifikacija/uplate'

const DUSKO = { competitorId: 4, memberNumber: '000004', firstName: 'Duško', lastName: 'Kunić', city: 'Beograd' }

function aLine(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 1,
    dated: '2026-10-23',
    statement: 1,
    position: 1,
    payer: 'DUŠKO KUNIĆ, KRALJA PETRA 1, BEOGRAD',
    payerAccount: '200-0000000000001-11',
    amount: 4200,
    currency: 'RSD',
    paymentCode: '289',
    purpose: 'Članarina za 2027. godinu',
    reference: null,
    season: 2027,
    state: 'waiting',
    member: null,
    candidates: [],
    waitsBecause: 'noReference',
    ...overrides,
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

let stop = (): void => {}

afterEach(() => {
  stop()
})

/** A server for the two addresses of the statement; everything else goes on to the disc. */
function aServer(answers: { lines?: unknown[]; taken?: () => Response }): Asked[] {
  const server = serverThat((path, init) => {
    if (path === STATEMENT_LINES) {
      return json(answers.lines ?? [])
    }

    if (path === STATEMENTS && init?.method === 'POST') {
      return answers.taken === undefined ? null : answers.taken()
    }

    return null
  })

  stop = server.stop

  return server.asked
}

function sentStatements(asked: Asked[]): Asked[] {
  return asked.filter((one) => one.path === STATEMENTS && one.init?.method === 'POST')
}

const A_PDF = (): File => new File(['%PDF-1.7'], 'izvod-oktobar.pdf', { type: 'application/pdf' })

describe('the statement box', () => {
  it('sends the PDF as one part to the route and says what the server did with it', async () => {
    const asked = aServer({
      taken: () =>
        json({
          number: 1,
          dated: '2026-10-23',
          bookedNow: 0,
          lines: [
            aLine({ id: 1, state: 'alreadyRecorded', member: DUSKO, waitsBecause: null }),
            aLine({ id: 2, payer: 'NEKO DRUGI', candidates: [] }),
          ],
        }),
    })
    const user = setupUser()
    renderAt(PAYMENTS, 'superadmin')

    await user.upload(await screen.findByLabelText('Izaberi PDF izvoda'), A_PDF())

    expect(
      await screen.findByText(
        'Izvod broj 1 od 23.10.2026. je učitan. Uplate proknjižene same od sebe: 0. Uplate koje čekaju' +
          ' tvoju potvrdu: 1. Uplate koje su već bile evidentirane: 1.',
      ),
    ).toBeVisible()
    expect(screen.getByText('Već evidentirano: Duško Kunić (000004), Beograd, sezona 2027')).toBeVisible()

    const sent = sentStatements(asked)

    expect(sent).toHaveLength(1)
    expect(sent[0]?.init?.body).toBeInstanceOf(FormData)
  })

  it('says it is reading the statement while the server has not answered', async () => {
    let answer = (_taken: Response): void => {}
    const server = serverThat((path, init) =>
      path === STATEMENTS && init?.method === 'POST'
        ? new Promise<Response>((resolve) => {
            answer = resolve
          })
        : path === STATEMENT_LINES
          ? json([])
          : null,
    )
    stop = server.stop
    const user = setupUser()
    renderAt(PAYMENTS, 'superadmin')

    await user.upload(await screen.findByLabelText('Izaberi PDF izvoda'), A_PDF())

    expect(await screen.findByText('Čitam izvod izvod-oktobar.pdf…')).toBeVisible()

    answer(json({ number: 5, dated: '2026-10-27', bookedNow: 0, lines: [] }))

    expect(await screen.findByText(/Izvod broj 5 od 27\.10\.2026\. je učitan/)).toBeVisible()
    expect(screen.queryByText(/Čitam izvod/)).not.toBeInTheDocument()
  })

  it('takes a real PDF whose type the machine never wrote down', async () => {
    const asked = aServer({ taken: () => json({ number: 2, dated: '2026-10-24', bookedNow: 0, lines: [] }) })
    renderAt(PAYMENTS, 'superadmin')

    /* Handed over rather than picked, because `user.upload` matches `accept` against the type alone;
       a browser matches the extension as well, so a `.pdf` with no type does reach the screen there. */
    fireEvent.change(inputElement(await screen.findByLabelText('Izaberi PDF izvoda')), {
      target: { files: [new File(['%PDF-1.4 ...'], 'izvod.pdf', { type: '' })] },
    })

    expect(await screen.findByText(/Izvod broj 2 od 24\.10\.2026\. je učitan/)).toBeVisible()
    expect(sentStatements(asked)).toHaveLength(1)
  })

  it('refuses anything renamed to look like a statement, and sends nothing', async () => {
    const asked = aServer({})
    const user = setupUser()
    renderAt(PAYMENTS, 'superadmin')

    // A spreadsheet with the extension changed, which is what a hurried administrator actually does.
    await user.upload(
      await screen.findByLabelText('Izaberi PDF izvoda'),
      new File(['ime;iznos'], 'izvod.pdf', { type: 'application/pdf' }),
    )

    expect(await screen.findByText(/mora biti PDF/)).toBeVisible()
    expect(sentStatements(asked)).toEqual([])
  })

  it('refuses a file that is not a statement handed over anyway, and sends nothing', async () => {
    const asked = aServer({})
    renderAt(PAYMENTS, 'superadmin')

    /* `accept` already turns a CSV away in the dialog, and `user.upload` honours that, so the one case
       worth testing is somebody choosing "all files" and handing over a CSV anyway. */
    fireEvent.change(inputElement(await screen.findByLabelText('Izaberi PDF izvoda')), {
      target: { files: [new File(['ime;iznos'], 'izvod.csv', { type: 'text/csv' })] },
    })

    expect(await screen.findByText(/mora biti PDF/)).toBeVisible()
    expect(sentStatements(asked)).toEqual([])
  })

  it('asks the dialog for PDFs only', async () => {
    aServer({})
    renderAt(PAYMENTS, 'superadmin')

    expect(await screen.findByLabelText('Izaberi PDF izvoda')).toHaveAttribute('accept', 'application/pdf')
  })

  it('replaces what it said last time rather than piling messages up', async () => {
    aServer({ taken: () => json({ number: 3, dated: '2026-10-25', bookedNow: 0, lines: [] }) })
    const user = setupUser()
    renderAt(PAYMENTS, 'superadmin')

    const pick = await screen.findByLabelText('Izaberi PDF izvoda')

    await user.upload(pick, A_PDF())
    expect(await screen.findByText(/Izvod broj 3/)).toBeVisible()

    await user.upload(pick, new File(['ne pdf'], 'drugi.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText(/mora biti PDF/)).toBeVisible()
    expect(screen.queryByText(/Izvod broj 3/)).not.toBeInTheDocument()
  })

  it('says nothing at all when the picking was called off', async () => {
    const asked = aServer({})
    renderAt(PAYMENTS, 'superadmin')

    /* Opening the dialog and closing it again fires the same event with an empty list. */
    fireEvent.change(inputElement(await screen.findByLabelText('Izaberi PDF izvoda')), {
      target: { files: [] },
    })

    expect(screen.queryByText(/je učitan|Čitam izvod/)).not.toBeInTheDocument()
    expect(screen.queryByText(/mora biti PDF/)).not.toBeInTheDocument()
    expect(sentStatements(asked)).toEqual([])
  })

  it('says the refusal of the server in its own words', async () => {
    aServer({ taken: () => refused('theStatementIsOfAnotherAccount') })
    const user = setupUser()
    renderAt(PAYMENTS, 'superadmin')

    await user.upload(await screen.findByLabelText('Izaberi PDF izvoda'), A_PDF())

    expect(
      await screen.findByText(
        'Ovo je izvod drugog računa. Portal čita samo izvod računa 105-0000000003284-71.',
      ),
    ).toBeVisible()
    expect(screen.queryByText(/je učitan/)).not.toBeInTheDocument()
  })

  it('says so when it cannot read what the server answered', async () => {
    aServer({ taken: () => json({ number: 'jedan' }) })
    const user = setupUser()
    renderAt(PAYMENTS, 'superadmin')

    await user.upload(await screen.findByLabelText('Izaberi PDF izvoda'), A_PDF())

    expect(await screen.findByText(/portal ne ume da pročita njegov odgovor/)).toBeVisible()
  })

  /**
   * A STATEMENT THAT BOOKED A PAYMENT CHANGES WHO OWES, so the list is read again, as after an
   * activation; and what the box said about it is still there once the list is back.
   */
  it('reads the list of who owes again when the statement booked a payment, and still says what it did', async () => {
    const asked = aServer({
      taken: () =>
        json({
          number: 4,
          dated: '2026-10-26',
          bookedNow: 1,
          lines: [aLine({ state: 'booked', member: DUSKO, reference: '2027000004', waitsBecause: null })],
        }),
    })
    const user = setupUser()
    renderAt(PAYMENTS, 'superadmin')

    await user.upload(await screen.findByLabelText('Izaberi PDF izvoda'), A_PDF())

    expect(await screen.findByText('Proknjiženo samo od sebe: Duško Kunić (000004), Beograd, 4.200 RSD'))
      .toBeVisible()
    await waitFor(() =>
      expect(asked.filter((one) => one.path === STATEMENT_LINES).length).toBeGreaterThanOrEqual(2),
    )
    expect(screen.getByText(/Izvod broj 4 od 26\.10\.2026\. je učitan/)).toBeVisible()
  })
})

describe('the payments that wait', () => {
  it('are listed with what the statement printed, why they wait and whom they may be about', async () => {
    aServer({
      lines: [
        aLine({
          id: 1,
          payer: 'ANA ANIĆ, ULICA 3',
          reference: '2027999999',
          waitsBecause: 'unknownReference',
          candidates: [
            { competitorId: 6, memberNumber: '000006', firstName: 'Ana', lastName: 'Anić', city: 'Beograd' },
            { competitorId: 7, memberNumber: null, firstName: 'Ana', lastName: 'Anić', city: 'Niš' },
          ],
        }),
        aLine({ id: 2, payer: 'SUPRUGA NIKOLIĆ', amount: 4100, payerAccount: null, paymentCode: null }),
      ],
    })
    renderAt(PAYMENTS, 'superadmin')

    const table = await screen.findByRole('table', { name: /Uplate sa izvoda koje čekaju potvrdu/ })
    const rows = within(table).getAllByRole('row')

    expect(rows).toHaveLength(3)

    const ana = within(rows[1] ?? table)

    expect(ana.getByText(/ANA ANIĆ, ULICA 3/)).toBeVisible()
    expect(ana.getByText('Račun 200-0000000000001-11')).toBeVisible()
    expect(ana.getByText('Poziv na broj 2027999999')).toBeVisible()
    expect(ana.getByText('Šifra plaćanja 289')).toBeVisible()
    expect(ana.getByText('Izvod broj 1 od 23.10.2026.')).toBeVisible()
    expect(ana.getByText('Poziv na broj ne imenuje nijednog člana.')).toBeVisible()
    expect(ana.getByText('Ana Anić (000006), Beograd')).toBeVisible()
    expect(ana.getByText('Ana Anić, Niš')).toBeVisible()

    const wife = within(rows[2] ?? table)

    expect(wife.getByText(/4\.100 RSD/)).toBeVisible()
    expect(wife.getByText('Nema predloga')).toBeVisible()
    expect(wife.getByText('Uplata nema poziv na broj.')).toBeVisible()
    expect(wife.queryByText(/^Račun /)).not.toBeInTheDocument()
    expect(wife.queryByText(/^Šifra plaćanja/)).not.toBeInTheDocument()
  })

  it('read a reason the screen does not know as a payment not booked', async () => {
    aServer({ lines: [aLine({ waitsBecause: 'somethingNew' })] })
    renderAt(PAYMENTS, 'superadmin')

    expect(await screen.findByText('Uplata nije proknjižena.')).toBeVisible()
  })

  it('are not drawn into a screen that has already gone', async () => {
    let answer = (_lines: Response): void => {}
    const server = serverThat((path) =>
      path === STATEMENT_LINES
        ? new Promise<Response>((resolve) => {
            answer = resolve
          })
        : null,
    )
    stop = server.stop

    const { unmount } = renderAt(PAYMENTS, 'superadmin')

    await screen.findByLabelText('Izaberi PDF izvoda')
    await waitFor(() => expect(server.asked.some((one) => one.path === STATEMENT_LINES)).toBe(true))
    unmount()
    answer(json([aLine({})]))

    await new Promise((settled) => setTimeout(settled, 0))
    expect(screen.queryByText(/čekaju potvrdu/)).not.toBeInTheDocument()
  })

  it('say so when none waits', async () => {
    aServer({ lines: [] })
    renderAt(PAYMENTS, 'superadmin')

    expect(await screen.findByText('Nijedna uplata sa izvoda ne čeka potvrdu.')).toBeVisible()
  })

  it('are not drawn at all when they could not be read', async () => {
    const server = serverThat((path) => (path === STATEMENT_LINES ? new Response(null, { status: 500 }) : null))
    stop = server.stop
    renderAt(PAYMENTS, 'superadmin')

    await screen.findByLabelText('Izaberi PDF izvoda')
    await waitFor(() => expect(server.asked.some((one) => one.path === STATEMENT_LINES)).toBe(true))

    expect(screen.queryByText(/čekaju potvrdu/)).not.toBeInTheDocument()
    expect(screen.queryByText('Nijedna uplata sa izvoda ne čeka potvrdu.')).not.toBeInTheDocument()
  })
})
