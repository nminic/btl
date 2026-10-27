import { configure, getConfig, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ipsPayload, paymentPurpose, RECIPIENT_ACCOUNT, RECIPIENT_NAME } from '../../data/paymentQr'
import { must } from '../../test/at'
import { neverPaidAsServed } from '../../test/neverPaid'
import { readQr } from '../../test/readQr'
import { renderAt } from '../../test/render'
import { seasonBeingPaidFor } from '../../data/pricing'
import { anInvoice, invoiceAsServed, serverThat, type InvoiceAnswered } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import servedPrices from '../../test/mock/pricing.json'

/**
 * „MOJA ČLANARINA" OUTSIDE THE RENEWAL WINDOW: SOMEBODY WHO OWES A FEE FOR THE RUNNING SEASON PAYS AT ONCE.
 *
 * <p><b>Why this file exists.</b> PDL P8, the price list, the owner's confirmation of 16.10.2026
 * (item U1): „Tacno, ali moze da uplati odmah za tekucu godinu bez rangiranja, pricali smo o ovome 5
 * puta". Somebody who registers between 1 January and 10 November pays for the RUNNING season, at the
 * row „1. januara do 14. oktobra" (40 EUR, no right to be ranked). The screen drew its payment panel
 * only from 15 October to 31 December, so for nine and a half months a new member had no road to
 * the one act the league asks of him. The server was measured first and takes the payment
 * (`PaymentOutsideTheWindowTest`), so this is a fault of the screen alone.
 *
 * <p><b>THE AXES, each with its own cases and each stood on BOTH sides of its edge:</b>
 * the date (10 November against 11 November, 31 December against 1 January, and the day before the
 * first sale, 15 October 2026, which this file does not move); the standing of the member (never
 * paid, fee lapsed, fee standing, freed of the fee); the money (Serbia and abroad); the junior
 * sentence; and the season the money buys, which is the running one outside the window and the next
 * one inside it. The two seasons part company on every day of the year but the window, so a screen
 * that reads the wrong one is told apart on the first day tried.
 *
 * <p><b>THE SENTENCES ARE MINE AND THE OWNER CHANGES THEM ON QA</b>, so the cases read them whole.
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

/** A member with a number whose fee has lapsed, the one of this file. His reference is the season and 50. */
const LAPSED = { memberNumber: '000050' }

/** The same member, whose fee stands. */
const STANDING = { memberNumber: '000050', active: true }

/**
 * His page on `today`, with `GET /api/me/membership` answering what he sends.
 *
 * <p>The answer is about the season the panel sells that day, in his money (dinars for Serbia, euro
 * for anywhere else, as the server decides by his country), and its figures are on no row of the
 * price list (`anInvoice`). Since 25.10.2026 the amount is the server's, so WHICH ROW of the price
 * list a day falls in is the server's question too (`MembershipPrice`); what this file still holds
 * the screen to is the season, the reference, the sentences, and that the slip carries the answer.
 */
function openHisPage(
  changes: Record<string, unknown>,
  today: string,
  invoice: InvoiceAnswered = anInvoice(
    seasonBeingPaidFor(today),
    changes.country === undefined || changes.country === 'RS' ? 'RSD' : 'EUR',
  ),
) {
  stand(neverPaidAsServed(changes))
  stand(invoiceAsServed(invoice))
  renderAt('/sr/moja-clanarina', 'visitor', null, undefined, today)
}

/** What the slip carries: the server's answer, `anInvoice`'s dinar figure. */
const SENT = '3.700 RSD'

function rowOf(key: string) {
  return must(
    servedPrices.find((one) => one.key === key),
    `the served row ${key}`,
  )
}

function dinars(amount: number | null): string {
  return `${must(amount, 'a dinar amount').toLocaleString('sr-Latn')} RSD`
}

const NO_RANKING = 'Članarina plaćena sada ne daje pravo rangiranja.'

const SHUT = 'Obnova se otvara 11. novembra i traje do 31. decembra.'

/** Every day outside the window on which something is on sale, with the season a payment buys on it. */
const OUTSIDE: [string, number][] = [
  ['2027-01-01', 2027],
  ['2027-05-03', 2027],
  ['2027-11-10', 2027],
  ['2028-01-01', 2028],
]

describe('somebody who has never paid, outside the window', () => {
  it.each(OUTSIDE)(
    'pays on %s for the season that is running, %i, without a reference',
    async (today, season) => {
      openHisPage({}, today)

      expect(
        await screen.findByRole('heading', { level: 2, name: `Uplata članarine za ${season}.` }),
      ).toBeVisible()

      const slip = must(
        (await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })).closest<HTMLElement>(
          '.pay__slip',
        ),
        'the slip',
      )

      expect(within(slip).getByText(`Članarina za ${season}. godinu`)).toBeVisible()
      expect(within(slip).queryByText('Poziv na broj')).not.toBeInTheDocument()
      expect(within(slip).getByText(SENT)).toBeVisible()

      /* THE WHOLE CODE, from the same four facts, so the season in it, the amount and the absence
         of a reference tag are one assertion. The empty string is what `IpsPayment` means by none. */
      expect(readQr(within(slip).getByRole('img', { name: /QR/ }))).toBe(
        ipsPayload({
          account: RECIPIENT_ACCOUNT,
          recipient: RECIPIENT_NAME,
          amountRsd: 3700,
          purpose: paymentPurpose(season),
          reference: '',
        }),
      )

      expect(screen.getByText('Uplata je otvorena.')).toBeVisible()
      expect(await screen.findByText(/Prepoznaje se po imenu/)).toBeVisible()
      expect(screen.queryByText(SHUT)).not.toBeInTheDocument()
    },
    SLOW,
  )
})

describe('a member whose fee has lapsed, outside the window', () => {
  it.each(OUTSIDE)(
    'renews on %s for the season that is running, %i, under the reference of that season',
    async (today, season) => {
      openHisPage(LAPSED, today)

      expect(
        await screen.findByRole('heading', { level: 2, name: `Obnova članarine za ${season}.` }),
      ).toBeVisible()

      const slip = must(
        (await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })).closest<HTMLElement>(
          '.pay__slip',
        ),
        'the slip',
      )

      expect(within(slip).getByText(`${season}000050`)).toBeVisible()
      expect(within(slip).getByText(`Članarina za ${season}. godinu`)).toBeVisible()
      expect(readQr(within(slip).getByRole('img', { name: /QR/ }))).toBe(
        ipsPayload({
          account: RECIPIENT_ACCOUNT,
          recipient: RECIPIENT_NAME,
          amountRsd: 3700,
          purpose: paymentPurpose(season),
          reference: `${season}000050`,
        }),
      )
      expect(screen.getByText(/Ne registruješ se ponovo/)).toBeVisible()
      expect(screen.queryByText(SHUT)).not.toBeInTheDocument()
    },
    SLOW,
  )

  it('is told once that this payment does not give the right to be ranked', async () => {
    openHisPage(LAPSED, '2027-05-03')

    await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })

    expect(
      screen.getAllByText(NO_RANKING),
      'the sentence stands once for the panel, whatever the ways of paying',
    ).toHaveLength(1)
  }, SLOW)

  it('and the transfer window stays shut, because it is the window and nothing else', async () => {
    openHisPage(LAPSED, '2027-05-03')

    /* The panel about a team reads the window, not the question „does he pay now". A screen that
       drew the payment panel and then took the transfer sentence off the same condition would tell
       a member in March that he may enter a team, which the server answers 404. */
    expect(await screen.findByText(/Prelazni rok je zatvoren/)).toBeVisible()
    expect(screen.queryByText(/Prelazni rok je otvoren/)).not.toBeInTheDocument()
    expect(screen.queryByText(/U tim ulaziš prijavom/)).not.toBeInTheDocument()
  }, SLOW)

  it('and the junior sentence is still the fixed one, whatever the date', async () => {
    /* A JUNIOR, AS THE SERVER ANSWERS HIM: 2.400 dinars less 500 on his book. The server knows the
       year of birth and this side does not (PDL P23, 31.07.2026, „Uzrast se meri kroz celu sezonu,
       ne na jedan dan"), so the slip carries its answer, and the sentence above it stays the price
       list's fixed rate. Until 25.10.2026 the slip was the adult row of the day, because nothing on
       the record tells a junior from an adult. */
    openHisPage(LAPSED, '2027-05-03', anInvoice(2027, 'RSD', { toTransfer: 1900, fromTheBalance: 500 }))

    const junior = rowOf('junior')

    expect(
      await screen.findByText(
        `Ko u sezoni ima bar jedan dan 14 godina ili manje plaća ${junior.eur} EUR, a iz Srbije ${dinars(junior.rsd).replace(' RSD', '')} RSD, bez obzira na datum uplate.`,
      ),
    ).toBeVisible()

    const slip = must(
      (await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })).closest<HTMLElement>(
        '.pay__slip',
      ),
      'the slip',
    )

    expect(within(slip).getByText('1.900 RSD')).toBeVisible()
    expect(within(slip).queryByText(dinars(rowOf('season').rsd))).not.toBeInTheDocument()
    expect(within(slip).queryByText(dinars(junior.rsd))).not.toBeInTheDocument()
  }, SLOW)

  it('abroad is given the PayPal data of the running season, with the tax in the amount', async () => {
    openHisPage({ ...LAPSED, country: 'MK' }, '2027-05-03')

    expect(await screen.findByRole('heading', { level: 4, name: 'PayPal' })).toBeVisible()

    /* The answer's transfer and the answer's fee (`anInvoice`: 33,50 and 3), as letter C adds them. */
    expect(await screen.findByText('36,50')).toBeVisible()
    expect(screen.getByText('2027000050')).toBeVisible()
    expect(screen.queryByRole('img', { name: /QR/ })).not.toBeInTheDocument()
    expect(screen.getByText(NO_RANKING)).toBeVisible()
  }, SLOW)
})

describe('the edges of the window, from both sides', () => {
  /* **EACH ROW IS A DAY, THE SEASON ITS PAYMENT BUYS, THE ROW OF THE PRICE LIST IT FALLS IN AND WHETHER
     THE SENTENCE ABOUT RANKING STANDS.** 10 November and 11 November are the last day outside and the
     first inside; 31 December and 1 January the last inside and the first outside. A window wrong by
     a day is wrong on exactly one of the four, and the sentence about ranking is the part of the panel
     that follows the date in both directions. */
  it.each([
    ['2027-11-10', 2027, 'season', true],
    ['2027-11-11', 2028, 'early', false],
    ['2027-12-31', 2028, 'regular', false],
    ['2028-01-01', 2028, 'late', false],
    ['2028-04-01', 2028, 'season', true],
  ])('on %s the money buys %i at the row %s', async (today, season, key, ranking) => {
    openHisPage(LAPSED, today)

    expect(
      await screen.findByRole('heading', { level: 2, name: `Obnova članarine za ${season}.` }),
    ).toBeVisible()
    expect(
      screen.getByText(
        `Danas članarina košta ${rowOf(key).eur} EUR, a iz Srbije ${dinars(rowOf(key).rsd).replace(' RSD', '')} RSD.`,
      ),
    ).toBeVisible()

    const slip = must(
      (await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })).closest<HTMLElement>(
        '.pay__slip',
      ),
      'the slip',
    )

    expect(within(slip).getByText(`${season}000050`)).toBeVisible()
    /* The amount on the slip is the server's for that day (`MembershipPrice` picks the row), so the
       row this case names is held by the price line above and the slip by the answer. */
    expect(within(slip).getByText(SENT)).toBeVisible()
    expect(screen.queryAllByText(NO_RANKING)).toHaveLength(ranking ? 1 : 0)
  }, SLOW)

  it('and a renewal still opens the same way inside it for a member whose fee stands', async () => {
    openHisPage(STANDING, '2027-11-11')

    expect(await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Obnova članarine za 2028.' })).toBeVisible()
    expect(screen.queryByText(NO_RANKING)).not.toBeInTheDocument()
  }, SLOW)
})

describe('whoever owes nothing for the running season is told what he was told', () => {
  it.each(OUTSIDE)('a member whose fee stands, on %s, is told when renewal opens', async (today) => {
    openHisPage(STANDING, today)

    expect(await screen.findByText(SHUT)).toBeVisible()
    /* THE HEADING OVER IT STAYS THE RENEWAL STILL TO OPEN, which is the next season: the one
       sentence a shut panel carries is about that. */
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: `Obnova članarine za ${Number(today.slice(0, 4)) + 1}.`,
      }),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { level: 3, name: 'Uplatnica' })).not.toBeInTheDocument()
    expect(screen.queryByText(NO_RANKING)).not.toBeInTheDocument()
  }, SLOW)

  /* **THE MEMBER WHOSE FEE STANDS, AS PRODUCTION HAS HIM**: from 1 January to 14 October the season
     on sale is the running one and he holds a membership row of it, so the server answers a basis
     AND the season beside it (PDL P8, 18.10.2026). The case above stands him with neither, a state
     that cannot exist once a fee stands, and so measured a panel production never draws.

     **TWO SOURCES OF THE SEASON, SEPARATED BY THE DATE.** The season a payment buys
     (`seasonBeingPaidFor`) and the season the renewal still to open is for (`seasonBeingRenewed`)
     are the same year on every day inside the window and different on every day outside it, so
     these three days are the only ones on which a sentence that names the wrong one reads a
     different year. The state line names the running season, the heading over the shut panel
     names the next. */
  it.each([
    ['2027-05-03', 'payment', 'Članarina za sezonu 2027 je plaćena.'],
    ['2027-05-03', 'balance', 'Članarina za sezonu 2027 je plaćena iz balansa.'],
    ['2027-11-10', 'payment', 'Članarina za sezonu 2027 je plaćena.'],
  ])(
    'a member whose fee stands and who holds the running season, on %s on a %s, is still told when renewal opens',
    async (today, basis, stated) => {
      openHisPage({ ...STANDING, membershipBasis: basis, membershipSeason: 2027 }, today)

      expect(await screen.findByText(SHUT)).toBeVisible()
      expect(screen.getByText(stated)).toBeVisible()
      expect(screen.getByRole('heading', { level: 2, name: 'Obnova članarine za 2028.' })).toBeVisible()
      expect(screen.queryByText(/je već plaćena/)).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 3, name: 'Uplatnica' })).not.toBeInTheDocument()
    },
    SLOW,
  )

  /* **AND WHERE A PAYMENT WOULD OTHERWISE BE OFFERED, HE IS TOLD HE HAS PAID, FOR THE SEASON THE
     PAYMENT WOULD HAVE BOUGHT.** Outside the window the panel is drawn to somebody whose fee does
     not stand, and a basis of the season on sale beside such a flag is the seam this measures: the
     sentence names the running season, and a screen that took it from the renewal (the next one)
     reads 2028 on every one of these days. Whether production ever answers this pair is not claimed;
     what is claimed is which season the sentence names when it does. */
  it.each([
    ['2027-05-03', 2027],
    ['2027-11-10', 2027],
    ['2028-01-01', 2028],
  ])('a member holding the running season whose fee does not stand, on %s, is told it is paid for %i', async (today, season) => {
    openHisPage({ ...LAPSED, membershipBasis: 'payment', membershipSeason: season }, today)

    expect(
      await screen.findByText(`Članarina za ${season} je već plaćena, pa nema šta da uplatiš.`),
    ).toBeVisible()
    expect(screen.queryByText(SHUT)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Uplatnica' })).not.toBeInTheDocument()
  }, SLOW)

  it.each([
    ['whose fee has lapsed', LAPSED],
    ['whose fee stands', STANDING],
  ])('a member %s who is freed of the fee is asked for nothing', async (_what, record) => {
    /* Freed of the season on sale, which on 3 May 2027 is 2027 (PDL P8, 18.10.2026): the basis
       comes with the season it is the basis of, as the server answers it. */
    openHisPage({ ...record, membershipBasis: 'feeExempt', membershipSeason: 2027 }, '2027-05-03')

    expect(await screen.findByText('Oslobođen si plaćanja članarine, pa nema šta da uplatiš.')).toBeVisible()
    expect(screen.queryByRole('heading', { level: 3, name: 'Uplatnica' })).not.toBeInTheDocument()
    expect(screen.queryByText(NO_RANKING)).not.toBeInTheDocument()
  }, SLOW)

  /* **AND THE DAYS BEFORE THE FIRST SALE ARE UNTOUCHED**: nothing is for sale until 15 October 2026,
     so there is nothing to pay at once, and the sentence that says when it opens stays where it was
     for both of the people who would otherwise be drawn a panel. 14 October is the last such day. */
  it.each([
    ['never paid', {}],
    ['lapsed', LAPSED],
  ])('somebody %s is told when payment opens until the first sale, 15 October 2026', async (_who, record) => {
    openHisPage(record, '2026-10-14')

    expect(await screen.findByText(SHUT)).toBeVisible()
    expect(screen.queryByRole('heading', { level: 3, name: 'Uplatnica' })).not.toBeInTheDocument()
    expect(screen.queryByText(NO_RANKING)).not.toBeInTheDocument()
  }, SLOW)
})

describe('the sentence about ranking follows the row and not the date', () => {
  function servedWith(change: (row: (typeof servedPrices)[number]) => object) {
    stand(
      serverThat((path) =>
        path === '/api/pricing'
          ? new Response(JSON.stringify(servedPrices.map(change)), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          : null,
      ),
    )
  }

  it('is not drawn outside the window when the served row carries the right', async () => {
    servedWith((row) => (row.key === 'season' ? { ...row, ranking: true } : row))
    openHisPage(LAPSED, '2027-05-03')

    expect(await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })).toBeVisible()
    expect(screen.queryByText(NO_RANKING)).not.toBeInTheDocument()
  }, SLOW)

  it('is drawn inside the window when the served row does not carry it', async () => {
    servedWith((row) => (row.key === 'early' ? { ...row, ranking: false } : row))
    openHisPage(LAPSED, '2027-11-12')

    expect(await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })).toBeVisible()
    expect(screen.getAllByText(NO_RANKING)).toHaveLength(1)
  }, SLOW)
})

describe('the notes about a price follow what he owes for the season on sale, and the fee is said to everybody (PENDING 29388, review of PR 609 round 1)', () => {
  /* The sentences under the state line: what it costs today, what a payment from abroad adds, and
     the junior rate. The price line and the junior rate are the price of the season on sale, so
     they are said to whoever is asked for it and to nobody who holds it already. The processing
     fee is not behind that: PDL P8, owner 04.08.2026, „Taksa se prikazuje svima, samo je ne plaćaju
     svi.": the screen has one sentence for everybody, and it says who pays it. */
  const PRICE = /^Danas članarina košta/
  const PROCESSING = /^Uz uplatu u evrima ide i taksa/
  const JUNIOR = /^Ko u sezoni ima bar jedan dan 14 godina/

  /* Held, or freed of the fee: no price line and no junior rate, and the fee sentence all the same. */
  function theFeeAndNoPrice() {
    expect(screen.queryByText(PRICE)).not.toBeInTheDocument()
    expect(screen.queryByText(JUNIOR)).not.toBeInTheDocument()
    expect(screen.getByText(PROCESSING)).toBeVisible()
  }

  /* **TWO SEASONS IN THE ARRANGEMENT, so that holding the one on sale and holding the one that is
     running are not the same member.** On 12 November 2027 the season on sale is 2028 and the one
     running is 2027; on 3 May 2027 both are 2027. */
  it.each([
    ['payment', 'Članarina za sezonu 2028 je plaćena.'],
    ['balance', 'Članarina za sezonu 2028 je plaćena iz balansa.'],
  ])('a member who holds the season on sale, 2028, on a %s, is told so, quoted no price and told the fee', async (basis, stated) => {
    openHisPage({ ...STANDING, membershipBasis: basis, membershipSeason: 2028 }, '2027-11-12')

    expect(await screen.findByText(stated)).toBeVisible()
    expect(screen.getByText('Članarina za 2028 je već plaćena, pa nema šta da uplatiš.')).toBeVisible()
    theFeeAndNoPrice()
  }, SLOW)

  it.each([
    ['payment', 'Članarina za sezonu 2027 je plaćena.'],
    ['balance', 'Članarina za sezonu 2027 je plaćena iz balansa.'],
  ])('and, on 3 May 2027, holding the running one, which is then the one on sale, on a %s, he reads the fee and no price', async (basis, stated) => {
    openHisPage({ ...STANDING, membershipBasis: basis, membershipSeason: 2027 }, '2027-05-03')

    expect(await screen.findByText(stated)).toBeVisible()
    theFeeAndNoPrice()
  }, SLOW)

  it.each([
    ['payment', 2027],
    ['balance', 2027],
  ])('a member who holds only the RUNNING season, 2027, on 12 November 2027, is still quoted the price of 2028, on a %s', async (basis, season) => {
    /* Holds a season, and not the one on sale: nothing is said of 2027 here (the running season is
       not touched after 14 October), and the one thing he can still be asked for is the next. */
    openHisPage({ ...STANDING, membershipBasis: basis, membershipSeason: season }, '2027-11-12')

    expect(await screen.findByText(PRICE)).toBeVisible()
    expect(screen.getByText(JUNIOR)).toBeVisible()
    expect(screen.getByText(PROCESSING)).toBeVisible()
    expect(screen.queryByText(/je plaćena/)).not.toBeInTheDocument()
  }, SLOW)

  it.each([
    ['2028 on 12 November 2027', 2028, '2027-11-12'],
    ['2027 on 3 May 2027', 2027, '2027-05-03'],
  ])('a member freed of the fee for the season on sale, %s, is quoted no price and reads the fee all the same', async (_label, season, today) => {
    openHisPage({ ...STANDING, membershipBasis: 'feeExempt', membershipSeason: season }, today)

    expect(await screen.findByText('Oslobođen si plaćanja članarine, pa nema šta da uplatiš.')).toBeVisible()
    theFeeAndNoPrice()
  }, SLOW)

  it('somebody who holds nothing is quoted all three, so the notes are still drawn where a price is owed', async () => {
    openHisPage(LAPSED, '2027-11-12')

    expect(await screen.findByText(PRICE)).toBeVisible()
    expect(screen.getByText(JUNIOR)).toBeVisible()
    expect(screen.getByText(PROCESSING)).toBeVisible()
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
