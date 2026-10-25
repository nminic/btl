import { act, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { must } from '../../test/at'
import { aLapsedMembersPage } from '../../test/hisPage'
import { aNeverPaidRecord } from '../../test/neverPaid'
import { renderAt } from '../../test/render'
import {
  anInvoice,
  refused,
  serverThat,
  type Asked,
  type BookAnswered,
  type InvoiceAnswered,
} from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/**
 * „AKTIVIRAJ ČLANSTVO": A MEMBER WHOSE BALANCE COVERS THE FEE LETS HIMSELF IN, ON „MOJA ČLANARINA".
 *
 * <p>The owner's answers of 25.10.2026 (PDL, „Dugme „Aktiviraj članstvo" na „Mojoj članarini""): the
 * button and the sentence above it, no window asking him to confirm, the member whose balance grew after
 * his slip was minted seeing both the button and the slip, no message in the inbox, and after the press
 * „Članstvo za sezonu {sezona} je aktivirano." with „Tvoj članski broj je {broj}." where the number is
 * new. `POST /api/me/membership` (`MyMembershipWriteApi`) is the route, and it had no caller until now.
 *
 * <p><b>WHAT THE SETUP KEEPS APART, so that no value an assertion reads could arrive from a second
 * place if the screen were wrong:</b>
 *
 * <ul>
 * <li><b>Whether the balance covers the fee, against whether anything is left to transfer.</b> Two
 * fields of one answer that agree for most members and part company for the one the owner decided
 * about: covered today and still holding a slip, and (as a stand-in) nought to transfer beside a book
 * that does not cover.
 * <li><b>The season of the answer, against the season the panel sells.</b> The server's after the press
 * is a year the screen's clock does not name, which is the press a second after midnight.
 * <li><b>The page before the press, against the page after it.</b> `/api/me` answers here and moves when
 * the route lets him in, so a screen that decided for itself what stands is told apart from one that
 * asked; and so does the balance, whose two figures are different.
 * <li><b>The number the route gave him, against the number the session then carries</b>, kept different
 * on purpose in the one case that is about the number: the sentence says the route's.
 * <li><b>Each refusal against the other two</b>, each with its own sentence.
 * </ul>
 */

configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

/** Inside the renewal window: the season on sale is 2027. */
const IN_THE_WINDOW = '2026-11-01'

/** The lapsed member of the generated data, whose page is `aLapsedMembersPage`. */
const LAPSED = aLapsedMembersPage.memberNumber

/** What his page says once the balance has paid for `season`. */
const inOnHisBalance = (season: number) => ({
  active: true,
  membershipBasis: 'balance',
  membershipSeason: season,
})

/** The book, as `GET /api/me/balance` answers it. */
const dinars = (amount: number): BookAnswered => ({ amount, currency: 'RSD' })

/** A member whose balance covers the whole fee: nothing to transfer, and 5.100 on the book against 4.800. */
const COVERED = anInvoice(2027, 'RSD', { toTransfer: 0, fromTheBalance: 4800, balance: 5100 })

/** The same, abroad. */
const COVERED_ABROAD = anInvoice(2027, 'EUR', { toTransfer: 0, fromTheBalance: 40, balance: 42.5 })

/** What the route answers when it let him in. */
const letIn = (season: number, memberNumber: string): Response =>
  new Response(JSON.stringify({ season, memberNumber, fromTheBalance: { amount: 4800, currency: 'RSD' } }), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  })

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

/**
 * A SERVER THAT ANSWERS HIS PAGE, WHAT HE OWES, HIS BOOK AND THE PRESS, AND MOVES WHEN THE ROUTE LETS
 * HIM IN.
 *
 * @param record    his page before the press: the lapsed member's or somebody's who has not paid
 * @param invoices  what `GET /api/me/membership` answers, one per read in order; the last answers
 *                  every read after it
 * @param pressed   what `POST /api/me/membership` answers. A 201 moves his page to `after`
 * @param after     what his page says once he has been let in, over `record`
 * @param books     what `GET /api/me/balance` answers, the first before the route let him in and the
 *                  second after
 * @param afterAnyAnswer what his page says after a refusal, over `record`: the fact that changed
 * @param meFailsAfter   `/api/me` answers 500 once the route has answered, a page that cannot be read
 */
function aServer({
  record = aLapsedMembersPage,
  invoices = [COVERED],
  pressed = () => letIn(2027, LAPSED),
  after = inOnHisBalance(2027),
  books = [dinars(5100), dinars(300)],
  afterAnyAnswer = {},
  meFailsAfter = false,
}: {
  record?: Record<string, unknown>
  invoices?: InvoiceAnswered[]
  pressed?: () => Response | Promise<Response>
  after?: Record<string, unknown>
  books?: BookAnswered[]
  afterAnyAnswer?: Record<string, unknown>
  meFailsAfter?: boolean
} = {}): { asked: Asked[]; stop: () => void } {
  let reads = 0
  let answered = false
  let page = record
  let book = must(books[0], 'a book')

  const server = serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (path === '/api/me') {
      if (answered && meFailsAfter) {
        return new Response(null, { status: 500 })
      }

      return json({ role: 'competitor', account: 1, member: page, mailLanguage: 'sr', seasonsOpenForAReport: [2027] })
    }

    if (path === '/api/me/membership' && how === 'GET') {
      const invoice = must(invoices[Math.min(reads, invoices.length - 1)], 'an invoice')

      reads += 1

      return json(invoice)
    }

    if (path === '/api/me/balance') {
      return json(book)
    }

    if (path === '/api/me/membership' && how === 'POST') {
      return Promise.resolve(pressed()).then((answer) => {
        answered = true

        if (answer.status === 201) {
          page = { ...record, ...after }
          book = must(books[1], 'the book after')
        } else {
          page = { ...record, ...afterAnyAnswer }
        }

        return answer
      })
    }

    return null
  })

  stops.push(server.stop)

  return server
}

/** His page, as a member with a number. */
function openHisPage(server = aServer()): Asked[] {
  renderAt('/sr/moja-clanarina', 'competitor', LAPSED, undefined, IN_THE_WINDOW)

  return server.asked
}

/** Somebody who has not paid: a visitor and no number, with only the answer making it a session. */
function openThePageOfSomebodyWhoHasNotPaid(server: { asked: Asked[] }): Asked[] {
  renderAt('/sr/moja-clanarina', 'visitor', null, undefined, IN_THE_WINDOW)

  return server.asked
}

/* Within half of the case's own clock (`configure` above), so a button that never comes fails on this
   line and never on the clock of the case (`btl/CLAUDE.md`, odeljak 25). */
const theButton = (): Promise<HTMLElement> => screen.findByRole('button', { name: 'Aktiviraj članstvo' })

const presses = (asked: Asked[]): number =>
  asked.filter((one) => one.path === '/api/me/membership' && one.init?.method === 'POST').length

const asksAboutMe = (asked: Asked[]): number => asked.filter((one) => one.path === '/api/me').length

/** The panel is drawn and what he owes has been answered, so an absence after it is not a read still out. */
async function untilWhatHeOwesIsRead(asked: Asked[]): Promise<void> {
  await waitFor(() => {
    expect(asked.some((one) => one.path === '/api/me/membership')).toBe(true)
  })
  expect(await screen.findByText(/^Obnova je otvorena/)).toBeVisible()
}

describe('the button, where the balance covers the fee', () => {
  it('is drawn with its sentence and no slip, and no window stands between the press and the route', async () => {
    const user = setupUser()
    const asked = openHisPage()

    await user.click(await theButton())

    await waitFor(() => {
      expect(presses(asked)).toBe(1)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  }, SLOW)

  it('says what the balance does, and draws no slip, no QR and no PayPal amount beside it', async () => {
    openHisPage()

    await theButton()

    expect(
      screen.getByText(
        'Tvoj balans iz programa preporuke pokriva članarinu za sezonu 2027. Ono što preostane ostaje na balansu za sledeću sezonu.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Uplatnica' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /QR/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Podatke za uplatu vidiš u nastavku/)).not.toBeInTheDocument()
  }, SLOW)

  it('is drawn abroad as at home, because the balance is no way of sending money', async () => {
    openHisPage(aServer({ record: { ...aLapsedMembersPage, country: 'HR' }, invoices: [COVERED_ABROAD] }))

    expect(await theButton()).toBeVisible()
  }, SLOW)

  /* THE MEMBER THE OWNER DECIDED ABOUT (25.10.2026): his slip promised 600 off the book, the book has
     since grown to 4.800, and he „vidi i dugme i uplatnicu, pa bira". Covered today, 4.200 still on the
     slip, so a screen that read „covered" off a transfer of nought draws no button here. */
  it('stands beside the slip for a member whose balance grew after the slip was minted', async () => {
    openHisPage(aServer({ invoices: [anInvoice(2027, 'RSD', { toTransfer: 4200, fromTheBalance: 600, balance: 4800 })] }))

    expect(await theButton()).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Uplatnica' })).toBeVisible()
    expect(screen.getByText('Balans pokriva 600 RSD, pa uplaćuješ 4.200 RSD.')).toBeVisible()
  }, SLOW)
})

describe('no button', () => {
  it.each([
    ['for a balance that does not reach the fee', anInvoice(2027, 'RSD', { toTransfer: 3700, fromTheBalance: 1100 })],
    /* The other half of the two facts: nought to transfer, and the book does NOT cover the fee. No server
       answers this today; it is the stand-in that tells a screen reading either field from one reading
       both. */
    ['for nought to transfer where the server says the balance does not cover', { ...COVERED, coveredByTheBalance: false }],
    ['for an answer about another season than the one the panel sells', { ...COVERED, season: 2028 }],
    ['where a membership of the season already stands', { ...COVERED, alreadyAMember: true }],
  ])('%s', async (_what, invoice) => {
    const asked = openHisPage(aServer({ invoices: [invoice] }))

    await untilWhatHeOwesIsRead(asked)

    expect(screen.queryByRole('button', { name: 'Aktiviraj članstvo' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Tvoj balans iz programa preporuke/)).not.toBeInTheDocument()
  }, SLOW)
})

describe('after the press', () => {
  it('says the season he is in, and the page says what the server now says', async () => {
    const user = setupUser()
    const asked = openHisPage()

    expect(await screen.findByText('5.100 RSD')).toBeVisible()
    const before = asksAboutMe(asked)

    await user.click(await theButton())

    expect(await screen.findByText('Članstvo za sezonu 2027 je aktivirano.')).toBeVisible()
    /* The page asked again and draws what it was told, which is the basis of the season and its year. */
    expect(asksAboutMe(asked)).toBeGreaterThan(before)
    expect(await screen.findByText('Članarina za sezonu 2027 je plaćena iz balansa.')).toBeVisible()
    expect(screen.getByText('Članarina za 2027 je već plaćena, pa nema šta da uplatiš.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Aktiviraj članstvo' })).not.toBeInTheDocument()
    /* His book is read again: he kept his number, so nothing about whose book it is moved. */
    expect(await screen.findByText('300 RSD')).toBeVisible()
    expect(screen.queryByText('5.100 RSD')).not.toBeInTheDocument()
    /* He had a number, so none is announced. */
    expect(screen.queryByText(/^Tvoj članski broj je/)).not.toBeInTheDocument()
  }, SLOW)

  it('puts the focus on what it says, because the button that had it is gone', async () => {
    const user = setupUser()

    openHisPage()

    await user.click(await theButton())

    const sentence = await screen.findByText('Članstvo za sezonu 2027 je aktivirano.')

    await waitFor(() => {
      expect(must(document.activeElement, 'the focus').contains(sentence)).toBe(true)
    })
    expect(document.activeElement).toHaveAttribute('role', 'status')
  }, SLOW)

  /* A PRESS A SECOND AFTER MIDNIGHT ON 15 OCTOBER buys the season the server sells at that second. The
     panel was drawn for 2027 and the route says 2028, so a sentence that took the year off the screen's
     clock says the year he did not buy. */
  it('names the season the server let him in for, and not the one the panel was drawn for', async () => {
    const user = setupUser()

    openHisPage(aServer({ pressed: () => letIn(2028, LAPSED), after: inOnHisBalance(2028) }))

    await user.click(await theButton())

    expect(await screen.findByText('Članstvo za sezonu 2028 je aktivirano.')).toBeVisible()
    expect(screen.queryByText('Članstvo za sezonu 2027 je aktivirano.')).not.toBeInTheDocument()
  }, SLOW)

  it('draws no sentence of its own for a "done" it cannot read, and puts the focus on the panel', async () => {
    const user = setupUser()

    openHisPage(aServer({ pressed: () => new Response('<html>', { status: 201 }) }))

    await user.click(await theButton())

    expect(await screen.findByText('Članarina za sezonu 2027 je plaćena iz balansa.')).toBeVisible()
    const heading = screen.getByRole('heading', { level: 2, name: /^Obnova članarine/ })

    await waitFor(() => {
      expect(document.activeElement).toBe(heading)
    })
    expect(screen.queryByText(/je aktivirano\.$/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  }, SLOW)

  /* AN ANSWER THAT NEVER CAME WRITES NOTHING INTO THE SESSION (`session/useTheServersSession.ts`'s
     rule), so the page goes on drawing what it had, and the sentence about the press, which is the
     route's own answer, still stands. */
  it('keeps the page it had where the page cannot be read again, and still says what the route did', async () => {
    const user = setupUser()

    openHisPage(aServer({ invoices: [COVERED, { ...COVERED, alreadyAMember: true }], meFailsAfter: true }))

    await user.click(await theButton())

    expect(await screen.findByText('Članstvo za sezonu 2027 je aktivirano.')).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Aktiviraj članstvo' })).not.toBeInTheDocument()
    })
    expect(screen.queryByText('Članarina za sezonu 2027 je plaćena iz balansa.')).not.toBeInTheDocument()
  }, SLOW)
})

describe('a double press', () => {
  it('sends one request, and says that it is out while it is', async () => {
    let answer: (response: Response) => void = () => {}
    const waiting = new Promise<Response>((resolve) => {
      answer = resolve
    })
    const asked = openHisPage(aServer({ pressed: () => waiting }))
    const button = await theButton()

    /* Two presses in one go, with no render between them, which is what a double press is: a guard read
       off the state would let the second one out. */
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })

    expect(await screen.findByText('Šalje se')).toBeVisible()
    expect(button).toHaveAttribute('aria-disabled', 'true')

    await act(async () => {
      answer(letIn(2027, LAPSED))
      await waiting
    })

    expect(await screen.findByText('Članstvo za sezonu 2027 je aktivirano.')).toBeVisible()
    expect(presses(asked)).toBe(1)
  }, SLOW)
})

describe('when the server refuses', () => {
  it('says he holds the season already, and the page says so too', async () => {
    const user = setupUser()

    openHisPage(
      aServer({ pressed: () => refused('alreadyAMemberOfThisSeason', 409), afterAnyAnswer: inOnHisBalance(2027) }),
    )

    await user.click(await theButton())

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('Članstvo za ovu sezonu je već aktivirano.')
    expect(await screen.findByText('Članarina za 2027 je već plaćena, pa nema šta da uplatiš.')).toBeVisible()
    await waitFor(() => {
      expect(must(document.activeElement, 'the focus').contains(alert)).toBe(true)
    })
  }, SLOW)

  it('says there is no fee to pay, and the page says he is freed of it', async () => {
    const user = setupUser()

    openHisPage(
      aServer({
        pressed: () => refused('thereIsNoFeeToPay', 409),
        afterAnyAnswer: { membershipBasis: 'feeExempt', membershipSeason: 2027, active: true },
      }),
    )

    await user.click(await theButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Za ovu sezonu nemaš članarinu za plaćanje.')
    expect(await screen.findByText('Oslobođen si plaćanja članarine, pa nema šta da uplatiš.')).toBeVisible()
  }, SLOW)

  /* THE BALANCE NO LONGER REACHES THE FEE, so what he owes is read again and the slip for the rest is
     drawn under the sentence that says it is there. Read once only, the button would stand where the
     slip has to be. */
  it('says the balance no longer covers the fee, and reads what he owes again to draw the slip', async () => {
    const user = setupUser()
    const asked = openHisPage(
      aServer({
        invoices: [COVERED, anInvoice(2027, 'RSD', { toTransfer: 3700, fromTheBalance: 1100 })],
        pressed: () => refused('theBalanceDoesNotCoverTheFee', 409),
      }),
    )

    await user.click(await theButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Balans više ne pokriva celu članarinu, pa su ispod podaci za uplatu ostatka.',
    )
    const slip = must(
      (await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })).closest<HTMLElement>('.pay__slip'),
      'the slip',
    )

    expect(within(slip).getByText('3.700 RSD')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Aktiviraj članstvo' })).not.toBeInTheDocument()
    expect(asked.filter((one) => one.path === '/api/me/membership' && one.init?.method === undefined)).toHaveLength(2)
  }, SLOW)

  it('says the server could not be reached, keeps the button, and asks nothing again', async () => {
    const user = setupUser()
    const asked = openHisPage(aServer({ pressed: () => Promise.reject(new TypeError('Failed to fetch')) }))
    const button = await theButton()
    const before = asksAboutMe(asked)

    await user.click(button)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Portal nije uspeo da dođe do servera. Proveri vezu i pokušaj ponovo.',
    )
    expect(screen.getByRole('button', { name: 'Aktiviraj članstvo' })).toBeVisible()
    expect(asksAboutMe(asked)).toBe(before)
  }, SLOW)
})

describe('somebody who has not paid', () => {
  it('is told he gets his number from the button, and then what number he got', async () => {
    const user = setupUser()

    openThePageOfSomebodyWhoHasNotPaid(
      aServer({
        record: aNeverPaidRecord,
        pressed: () => letIn(2027, '000077'),
        /* NOT the number the route gave him, on purpose: the sentence says the route's, and the page
           the session then draws is the session's business. */
        after: { ...inOnHisBalance(2027), memberNumber: '000078' },
      }),
    )

    expect(
      await screen.findByText(
        'Članarina ti još nije evidentirana, pa još nemaš članski broj. Dobijaš ga kad aktiviraš članstvo iz balansa.',
      ),
    ).toBeVisible()
    expect(screen.queryByText(/kad moderator evidentira tvoju uplatu\.$/)).not.toBeInTheDocument()

    await user.click(await theButton())

    expect(await screen.findByText('Članstvo za sezonu 2027 je aktivirano.')).toBeVisible()
    expect(screen.getByText('Tvoj članski broj je 000077.')).toBeVisible()
  }, SLOW)

  it('is told a moderator gives it, where his balance does not cover the fee', async () => {
    const asked = openThePageOfSomebodyWhoHasNotPaid(
      aServer({ record: aNeverPaidRecord, invoices: [anInvoice(2027, 'RSD')] }),
    )

    /* AFTER the slip is drawn, which is after what he owes has been answered: the sentence about the
       moderator is also what stands before that answer arrives, so read earlier it says nothing about
       the answer at all. */
    expect(await screen.findByRole('heading', { name: 'Uplatnica' })).toBeVisible()
    expect(asked.some((one) => one.path === '/api/me/membership')).toBe(true)
    expect(
      screen.getByText(
        'Članarina ti još nije evidentirana, pa još nemaš članski broj. Dobijaš ga kad moderator evidentira tvoju uplatu.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Aktiviraj članstvo' })).not.toBeInTheDocument()
  }, SLOW)
})
