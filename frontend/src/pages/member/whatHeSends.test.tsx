import { configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ipsPayload, paymentPurpose, paymentReference, RECIPIENT_ACCOUNT, RECIPIENT_NAME } from '../../data/paymentQr'
import { must } from '../../test/at'
import { readQr } from '../../test/readQr'
import { renderAt } from '../../test/render'
import {
  anInvoice,
  answeredWith,
  answeringInvoice,
  invoiceAsServed,
  serverThat,
  type InvoiceAnswered,
} from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/**
 * WHAT HE SENDS, ON „MOJA ČLANARINA", IS WHAT THE SERVER SAYS (PDL, 26.09.2026: „QR se kuje na
 * iznos minus balans").
 *
 * <p><b>THE AXES, each with a case on every side of it</b> (the plan of PR „Tačan iznos"):
 * the balance (nought, part of the fee, the whole fee); the money (dinars with the slip and the code,
 * euro with PayPal and the fee); the season the answer is about (the one the panel sells, another);
 * the money of the answer against the way the session says he pays (the same, the other); whether a
 * membership already stands; and the read itself (answered, refused, failed and asked again). And
 * one axis that is not about what is drawn but about what is ASKED: the read writes the promise of
 * the season on the server, so it is asked where a slip is about to be drawn and nowhere else.
 *
 * <p><b>Every figure is on no row of the price list</b> (`anInvoice`), so a screen that read the
 * price list for any of them draws a figure these cases do not accept.
 */

configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function stand<T extends { stop: () => void }>(server: T): T {
  stops.push(server.stop)

  return server
}

/** Inside the renewal window, on the regular period of the price list (4.800 RSD, 40 EUR). */
const IN_THE_WINDOW = '2026-11-01'

/** 000032 pays and lives in Serbia; 000010 pays and lives abroad. */
const IN_SERBIA = '000032'
const ABROAD = '000010'

function openHisPage(member: string, invoice: InvoiceAnswered | null | Response, today = IN_THE_WINDOW) {
  const route = stand(invoiceAsServed(invoice))

  renderAt('/sr/moja-clanarina', 'competitor', member, undefined, today)

  return route
}

/** How many times the page asked what he sends. */
function readsOf(asked: { path: string }[]): number {
  return asked.filter((one) => one.path === '/api/me/membership').length
}

async function theSlip(): Promise<HTMLElement> {
  return must(
    (await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })).closest<HTMLElement>('.pay__slip'),
    'the slip',
  )
}

/** The panel is drawn and the read has been answered, so an absence after it is not a read still out. */
async function untilTheRenewalIsDrawn(): Promise<void> {
  expect(await screen.findByText(/^Obnova je otvorena/)).toBeVisible()
}

describe('the slip, in Serbia', () => {
  it('asks for what is left after the balance, in writing and in the code, and says why', async () => {
    openHisPage(IN_SERBIA, anInvoice(2027, 'RSD', { toTransfer: 4100, fromTheBalance: 700 }))

    const slip = await theSlip()

    expect(within(slip).getByText('4.100 RSD')).toBeVisible()
    expect(readQr(within(slip).getByRole('img', { name: /QR/ }))).toBe(
      ipsPayload({
        account: RECIPIENT_ACCOUNT,
        recipient: RECIPIENT_NAME,
        amountRsd: 4100,
        purpose: paymentPurpose(2027),
        reference: paymentReference(2027, IN_SERBIA),
      }),
    )
    /* Never the period's own price, which a screen reading the price list would draw. */
    expect(within(slip).queryByText('4.800 RSD')).not.toBeInTheDocument()
    /* The owner's sentence, 25.10.2026, with the answer's two figures. */
    expect(screen.getByText('Balans pokriva 700 RSD, pa uplaćuješ 4.100 RSD.')).toBeVisible()
    expect(screen.getByText(/^Podatke za uplatu vidiš u nastavku/)).toBeVisible()
  }, SLOW)

  it('names what the promise of the season takes off, and not what the book holds today', async () => {
    /* THE BALANCE GREW AFTER HIS CODE WAS MINTED (owner, 27.09.2026: „Balans se skida ONOLIKO
       KOLIKO JE KOD OBECAO"): the book holds 1.200 today and the promise 600, so the slip asks for
       4.200 and says 600. A screen that worked the figure out of today's book would say 1.200 and
       ask for 3.600. */
    openHisPage(IN_SERBIA, anInvoice(2027, 'RSD', { toTransfer: 4200, fromTheBalance: 600, balance: 1200 }))

    expect(within(await theSlip()).getByText('4.200 RSD')).toBeVisible()
    expect(screen.getByText('Balans pokriva 600 RSD, pa uplaćuješ 4.200 RSD.')).toBeVisible()
    expect(screen.queryByText(/1\.200 RSD, pa/)).not.toBeInTheDocument()
  }, SLOW)

  it('says nothing about the balance where it takes no part', async () => {
    openHisPage(IN_SERBIA, anInvoice(2027, 'RSD', { toTransfer: 4750, fromTheBalance: 0 }))

    expect(within(await theSlip()).getByText('4.750 RSD')).toBeVisible()
    expect(screen.queryByText(/^Balans pokriva/)).not.toBeInTheDocument()
  }, SLOW)
})

describe('PayPal, abroad', () => {
  it('asks for what is left after the balance plus the fee the answer names, and says why', async () => {
    openHisPage(ABROAD, anInvoice(2027, 'EUR', { toTransfer: 33.5, fromTheBalance: 6.5, processingFeeEur: 3 }))

    expect(await screen.findByText('36,50')).toBeVisible()
    /* Never the price list's period plus its fee (40 + 3). */
    expect(screen.queryByText('43,00')).not.toBeInTheDocument()
    expect(screen.getByText('Balans pokriva 6,50 EUR, pa uplaćuješ 33,50 EUR.')).toBeVisible()
    expect(screen.queryByRole('img', { name: /QR/ })).not.toBeInTheDocument()
  }, SLOW)

  it('adds the fee the answer names and not the price list\'s', async () => {
    openHisPage(ABROAD, anInvoice(2027, 'EUR', { toTransfer: 20, fromTheBalance: 20, processingFeeEur: 4 }))

    expect(await screen.findByText('24,00')).toBeVisible()
    expect(screen.queryByText('23,00')).not.toBeInTheDocument()
  }, SLOW)
})

describe('nothing to send', () => {
  it.each([
    ['in Serbia, when the balance covers the fee', IN_SERBIA, anInvoice(2027, 'RSD', { toTransfer: 0, fromTheBalance: 4800 })],
    ['abroad, when the balance covers the fee', ABROAD, anInvoice(2027, 'EUR', { toTransfer: 0, fromTheBalance: 40 })],
    ['when the answer is about another season', IN_SERBIA, anInvoice(2028, 'RSD')],
    ['when the answer says a membership already stands', IN_SERBIA, anInvoice(2027, 'RSD', { alreadyAMember: true })],
    ['in Serbia, when the answer is in euro', IN_SERBIA, anInvoice(2027, 'EUR')],
    ['abroad, when the answer is in dinars', ABROAD, anInvoice(2027, 'RSD')],
  ])('draws no amount and points at none %s', async (_what, member, invoice) => {
    const { asked } = openHisPage(member, invoice)

    await untilTheRenewalIsDrawn()
    await waitFor(() => expect(readsOf(asked)).toBe(1))

    expect(screen.queryByRole('heading', { level: 3, name: 'Uplatnica' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /QR/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kopiraj iznos za uplatu' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Podatke za uplatu vidiš u nastavku/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Balans pokriva/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Iznos za uplatu nije stigao/)).not.toBeInTheDocument()
  }, SLOW)
})

describe('a read that did not answer', () => {
  it.each([
    ['a server that fails', () => answeredWith(500)],
    ['a refusal the session did not expect', () => answeredWith(404)],
  ])('says so, with a way to ask again, after %s', async (_what, answer) => {
    openHisPage(IN_SERBIA, answer())

    expect(
      await screen.findByText('Iznos za uplatu nije stigao. Osveži stranicu i pokušaj ponovo.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pokušaj ponovo' })).toBeVisible()
    expect(screen.queryByRole('heading', { level: 3, name: 'Uplatnica' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Podatke za uplatu vidiš u nastavku/)).not.toBeInTheDocument()
  }, SLOW)

  it('draws the slip once the asking again is answered, and puts the keyboard on it', async () => {
    let fails = true
    const route = stand(
      serverThat((path, init) =>
        path === '/api/me/membership' && init?.method === undefined
          ? fails
            ? answeredWith(500)
            : answeringInvoice(anInvoice(2027, 'RSD'))
          : null,
      ),
    )
    const user = setupUser()

    renderAt('/sr/moja-clanarina', 'competitor', IN_SERBIA, undefined, IN_THE_WINDOW)

    const again = await screen.findByRole('button', { name: 'Pokušaj ponovo' })

    fails = false
    again.focus()
    await user.keyboard('{Enter}')

    expect(within(await theSlip()).getByText('3.700 RSD')).toBeVisible()
    expect(screen.queryByText(/^Iznos za uplatu nije stigao/)).not.toBeInTheDocument()
    expect(readsOf(route.asked)).toBe(2)
    /* WCAG 2.2 SC 2.4.3: the button left with the focus on it, and the reader is put on the name of
       what replaced it, not dropped on the body. */
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Podaci za uplatu'))
  }, SLOW)
})

describe('the read is asked only where a slip is about to be drawn, because it writes the promise', () => {
  /* MY REASONING over the owner's decision of 27.09.2026, accepted by the coordinator on
     25.10.2026: the first look of a season fixes what the code promises, and the route records the
     promise on the read itself (`MyMembershipApi`). So a member who is shown no slip must not have
     a promise written for him. */
  function meSays(member: Record<string, unknown>) {
    return stand(
      serverThat((path) =>
        path === '/api/me'
          ? new Response(
              JSON.stringify({
                role: 'competitor',
                account: 1,
                member: { memberNumber: IN_SERBIA, country: 'RS', firstSeason: 2016, ...member },
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          : null,
      ),
    )
  }

  it.each([
    ['who holds the season on sale', { membershipBasis: 'payment', membershipSeason: 2027 }, IN_THE_WINDOW, /^Članarina za 2027 je već plaćena/],
    ['freed of the season on sale', { membershipBasis: 'feeExempt', membershipSeason: 2027 }, IN_THE_WINDOW, /^Oslobođen si plaćanja članarine, pa nema/],
  ])('is not asked for a member %s', async (_what, member, today, said) => {
    const route = stand(invoiceAsServed(anInvoice(2027, 'RSD')))
    meSays(member)

    renderAt('/sr/moja-clanarina', 'competitor', IN_SERBIA, undefined, today)

    expect(await screen.findByText(said)).toBeVisible()
    /* The balance under the referral programme is asked off the same mount, so once it has been
       asked the page has had every chance to ask the other. */
    await waitFor(() => expect(route.asked.some((one) => one.path === '/api/me/balance')).toBe(true))
    expect(readsOf(route.asked)).toBe(0)
  }, SLOW)

  it('is not asked while the renewal is shut', async () => {
    const route = openHisPage(IN_SERBIA, anInvoice(2027, 'RSD'), '2026-07-30')

    expect(await screen.findByText('Obnova se otvara 15. oktobra i traje do 31. decembra.')).toBeVisible()
    await waitFor(() => expect(route.asked.some((one) => one.path === '/api/me/balance')).toBe(true))
    expect(readsOf(route.asked)).toBe(0)
  }, SLOW)

  it('is asked once where the slip is drawn', async () => {
    const route = openHisPage(IN_SERBIA, anInvoice(2027, 'RSD'))

    await theSlip()

    expect(readsOf(route.asked)).toBe(1)
  }, SLOW)
})
