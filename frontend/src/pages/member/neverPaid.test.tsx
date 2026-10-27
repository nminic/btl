import { configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ipsPayload,
  paymentPurpose,
  RECIPIENT_ACCOUNT,
  RECIPIENT_NAME,
} from '../../data/paymentQr'
import { must } from '../../test/at'
import { componentsOf } from '../../test/javaRecords'
import {
  aNeverPaidRecord,
  neverPaidAsServed,
  WHAT_HE_DOES_NOT_HAVE_YET,
} from '../../test/neverPaid'
import { readQr } from '../../test/readQr'
import { renderAt } from '../../test/render'
import {
  anInvoice,
  categoryAsServed,
  invoiceAsServed,
  type CategoryAnswered,
  type InvoiceAnswered,
} from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'

/**
 * „MOJA ČLANARINA", TO SOMEBODY WHO HAS REGISTERED AND HAS NOT PAID.
 *
 * <p><b>Why this file exists.</b> Registration hands out no member number (30.07.2026), so from
 * 15.10.2026 every new member is somebody with a record and no number, and until 11.10.2026 the
 * only page he can pay on told him „Ovaj deo je za takmičare" and showed him a payment slip
 * nowhere (PENDING, found by the agent for P8U and checked in the code). PDL P8, the entry
 * „Šta sme neplaćen član" (10.10.2026): he may pay and choose his category. PDL P8, the entry
 * „Prvu članarinu nov član plaća bez poziva na broj" (the same day): the slip and the code carry
 * everything but the reference, with a sentence that the payment is recognised by name. Both
 * entries were chosen by the owner between offered outcomes, so the sentences are the record's and
 * not his own words.
 *
 * <p><b>THE SENTENCES ARE MINE AND THE OWNER CHANGES THEM ON QA</b>, so the cases that read them
 * read them whole; a change of wording is a change here and nowhere else.
 *
 * <p><b>What a member who HAS a number sees is not measured again here</b>: it is the rest of
 * `pages/memberFlows.test.tsx` and `pages/member/leaveTeam.test.tsx`, forty cases, and the three
 * that say a member with a number is not drawn what is drawn here are the last of this file.
 *
 * <p><b>WHAT THE CASES TURN ON.</b> Every one reads a thing that exists for HIM and not for a
 * member (the reference is absent, the sentence is present, the team panel is gone), and the last
 * three read the same thing for a member with a number, so a screen that dropped the reference for
 * everybody, or kept it for nobody, is caught by a case on each side of the same fact.
 */

/* Every wait of this file is given half of the time a case has, so a wait that never succeeds ends
   the case with the assertion's own words and not with the case's clock (`pages/admin/
   saveWhileSaving.test.tsx` found the arrangement for itself). */
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

/** A day inside the renewal window (11 November to 31 December), the only days the payment panel is
 *  drawn on, and the first period of the price list after its first fortnight. */
const IN_THE_WINDOW = '2026-11-01'

/** The last day before anything is for sale (15 October 2026). */
const BEFORE_THE_FIRST_SALE = '2026-10-14'

/**
 * HIS PAGE, AS THE SERVER ANSWERS HIM.
 *
 * @param changes what this case changes in his record, over `aNeverPaidRecord`
 * @param today   the day the portal is read as
 * @param invoice what `GET /api/me/membership` answers him: by default what he sends for 2027 in his
 *                money, dinars for Serbia and euro for anywhere else, as the server decides by his
 *                country
 */
function openHisPage(
  changes: Record<string, unknown> = {},
  today = IN_THE_WINDOW,
  invoice: InvoiceAnswered = anInvoice(
    2027,
    changes.country === undefined || changes.country === 'RS' ? 'RSD' : 'EUR',
  ),
) {
  stand(neverPaidAsServed(changes))
  stand(invoiceAsServed(invoice))

  /* A VISITOR AND NO NUMBER HANDED IN, the way `oneQuestion.test.tsx` does it: the only thing
     that makes this a session is the answer above. */
  renderAt('/sr/moja-clanarina', 'visitor', null, undefined, today)
}

const OPEN_TO_HIM: CategoryAnswered = {
  season: 2027,
  firstSeason: false,
  firstSeasonAllowed: true,
  category: 'M25-39',
  open: true,
}

describe('the answer the server gives him', () => {
  it('is exactly the sample these cases answer with, and the five names it leaves out', () => {
    /* The floor under every case below: the sample is the record `MeApi.MyOwnRecord` declares,
       read off the backend's own source. A name added to the record and not to the sample is a
       page drawn from an answer the server does not give; a name in the sample the server has not
       got is a case that passes against a body no server sends. */
    expect([...Object.keys(aNeverPaidRecord), ...WHAT_HE_DOES_NOT_HAVE_YET].sort()).toEqual(
      componentsOf('MyOwnRecord'),
    )
  })

  it('is somebody whose fee does not stand and who has no number', () => {
    /* What makes him the person this file is about, said as two facts and not left to the
       sample's shape: no number, and no standing fee. */
    expect(aNeverPaidRecord.active).toBe(false)
    expect('memberNumber' in aNeverPaidRecord).toBe(false)
  })
})

describe('„Moja članarina", to somebody who has registered and has not paid', () => {
  it('is the page itself, and not the sentence he used to be told', async () => {
    openHisPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Moja članarina' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Ovaj deo je za takmičare' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Tvoji podaci o članstvu nisu stigli' }),
    ).not.toBeInTheDocument()
  }, SLOW)

  it('is told the fee has not been recorded, and not that he is a member since a season', async () => {
    openHisPage()

    expect(
      await screen.findByText(
        'Članarina ti još nije evidentirana, pa još nemaš članski broj. Dobijaš ga kad moderator evidentira tvoju uplatu.',
      ),
    ).toBeVisible()
    /* „Član od {season}. sezone." is said of somebody who is one, and it is the sentence this
       status line used to hold for everybody. */
    expect(screen.queryByText(/Član od \d{4}\. sezone/)).not.toBeInTheDocument()
  }, SLOW)

  it('pays under a heading and two sentences of his own, and none of a renewal', async () => {
    openHisPage()

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Uplata članarine za 2027.' }),
    ).toBeVisible()
    expect(screen.getByText('Uplata je otvorena.')).toBeVisible()
    expect(
      await screen.findByText(
        'Podatke za uplatu vidiš u nastavku. Čim uplata stigne, moderator je potvrđuje i dobijaš članski broj.',
      ),
    ).toBeVisible()

    /* What a renewal says and he is not doing: he registers once and has no number, profile or
       history to keep, and his membership starts rather than being extended. */
    expect(screen.queryByRole('heading', { name: /^Obnova članarine/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Ne registruješ se ponovo/)).not.toBeInTheDocument()
    expect(screen.queryByText(/tvoje članstvo se produžava/)).not.toBeInTheDocument()
  }, SLOW)

  it('draws the slip without a reference, in writing and in the code', async () => {
    openHisPage()

    const written = await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })
    const slip = must(
      written.closest<HTMLElement>('.pay__slip'),
      'the wrapper the written half and the QR code share',
    )

    /* THE ROW, asked of the written half. A „Poziv na broj" with nothing after it would be a
       field he is told to fill in and cannot. Exact, so the sentence below that says „poziv na
       broj" in the middle of itself is not mistaken for the label. */
    expect(within(slip).queryByText('Poziv na broj')).not.toBeInTheDocument()
    expect(
      within(slip).queryByText(/Poziv na broj je ono po čemu se uplata prepoznaje/),
    ).not.toBeInTheDocument()

    /* The facts he DOES have, so the absence above is the reference's and not the slip's. */
    expect(within(slip).getByText('Primalac')).toBeVisible()
    expect(within(slip).getByText('Račun')).toBeVisible()
    expect(within(slip).getByText('Svrha uplate')).toBeVisible()
    expect(within(slip).getByText('Iznos')).toBeVisible()

    /* AND NO NOTE UNDER THE CODE'S TITLE, in either form: it used to promise a reference that is
       not there, and since 18.10.2026 there is no sentence there at all (PDL P8, owner: „Ovaj
       tekst ne treba da postoji"). */
    expect(within(slip).queryByText(/Skeniraj kod/)).not.toBeInTheDocument()
    expect(within(slip).queryByText(/su već upisani/)).not.toBeInTheDocument()
  }, SLOW)

  it('says once that the payment is recognised by his name', async () => {
    openHisPage()

    expect(
      await screen.findByText(
        'Pošto još nemaš članski broj, uplata nema poziv na broj. Prepoznaje se po imenu, a moderator je potvrđuje ručno.',
      ),
    ).toBeVisible()
    expect(
      screen.getAllByText(/Prepoznaje se po imenu/),
      'the sentence stands once for the whole panel and not once per way of paying',
    ).toHaveLength(1)
  }, SLOW)

  it('draws a code that carries no reference tag at all, and not the season alone', async () => {
    openHisPage()

    const drawn = readQr(await screen.findByRole('img', { name: /QR/ }))

    /* The whole payload, written out from the same four facts the screen reads for him, and with
       the reference the empty string `IpsPayment` already means „none" by. */
    expect(drawn).toBe(
      ipsPayload({
        account: RECIPIENT_ACCOUNT,
        recipient: RECIPIENT_NAME,
        /* What the server says he sends (`anInvoice`), and no row of the price list. */
        amountRsd: 3700,
        purpose: paymentPurpose(2027),
        reference: '',
      }),
    )
    /* And the two ways the tag could still be there, each of them a reference that looks like
       the thing it is not: the tag itself, and the season on its own, which a bank statement would
       carry as somebody's reference. */
    expect(must(drawn, 'the code says something')).not.toContain('RO:')
    expect(must(drawn, 'the code says something')).not.toMatch(/RO:\s*2027/)
  }, SLOW)

  it('offers somebody abroad the PayPal data to copy, without the note, and says why', async () => {
    openHisPage({ country: 'MK' })

    expect(await screen.findByRole('heading', { level: 4, name: 'PayPal' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Kopiraj adresu za uplatu' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Kopiraj iznos za uplatu' })).toBeVisible()

    /* THE NOTE IS MADE OF THE REFERENCE AND OF NOTHING ELSE (PDL P8, derived on 10.10.2026), so
       with none there is nothing to copy: neither the box nor the button that would copy it. */
    expect(screen.queryByText('Napomena')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kopiraj napomenu za uplatu' })).not.toBeInTheDocument()

    /* No code at all abroad (PDL P8, 31.07.2026), and the same sentence about how the payment is
       known, because he lacks the number for this way of paying as well. */
    expect(screen.queryByRole('img', { name: /QR/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Prepoznaje se po imenu/)).toBeVisible()
  }, SLOW)

  it('is not offered a team, because he may not have one yet', async () => {
    openHisPage()

    await screen.findByRole('heading', { level: 2, name: 'Uplata članarine za 2027.' })

    /* The whole panel and not its sentences one by one (PDL P8, 10.10.2026, „Šta sme neplaćen
       član": the list of what he may not do names the teams). */
    expect(screen.queryByRole('heading', { name: 'Prelazni rok' })).not.toBeInTheDocument()
    expect(screen.queryByText(/U tim ulaziš prijavom/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Trenutno nisi ni u jednom timu/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Izađi iz tima' })).not.toBeInTheDocument()
  }, SLOW)

  it('chooses his category, which the same entry lets him do', async () => {
    stand(categoryAsServed(OPEN_TO_HIM))
    openHisPage()

    expect(await screen.findByRole('radio', { name: 'U svojoj starosnoj kategoriji' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: 'U početničkoj kategoriji' })).toBeEnabled()
  }, SLOW)

  it('is drawn the referral link the record gave him, with the code in the path', async () => {
    openHisPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'Program preporuke' })).toBeVisible()
    expect(screen.getByText(/\/sr\/registracija\/3d6b1f0a9c2e4478$/)).toBeVisible()
    expect(screen.queryByText(/preporuka=/)).not.toBeInTheDocument()
  }, SLOW)

  /* **WHERE THE PAYMENT PANEL STOPS, and it stops at the first sale and not at the window.** It was
     written down here as not decided: nobody had said how somebody who registers in March pays. The
     owner said it on 16.10.2026 (PDL P8, the price list, item U1): he pays at once, for the running
     season, and what that looks like outside the window is measured in `payingOutsideTheWindow.test.tsx`.
     What stays here is the other edge, the day before anything is for sale: 14 October 2026 is told
     when payment opens, as everybody is. */
  it('is told when payment opens, before the first sale, as everybody is', async () => {
    openHisPage({}, BEFORE_THE_FIRST_SALE)

    expect(await screen.findByText('Obnova se otvara 11. novembra i traje do 31. decembra.')).toBeVisible()
    expect(screen.queryByRole('heading', { level: 3, name: 'Uplatnica' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /QR/ })).not.toBeInTheDocument()
  }, SLOW)

  /* **THE TWO SENTENCES THAT POINT AT THE SLIP ARE DRAWN ONLY WHERE A SLIP IS**, for him as for
     everybody (PDL P11, 15.08.2026, „Kontrola koja ništa ne radi je gora nego da je nema"; that a
     sentence pointing at data that is not there is the same fault in words is this record's
     reading). His own sentence about how the payment is known points at the same data, so it is held
     to the same gate. Since 25.10.2026 what decides whether there is a slip is the server's answer
     and not the price list (`member/WhatHeSends.tsx`), so the axes are the answer's: nothing left to
     send because the balance covers the fee (owner, 25.10.2026: no slip, no QR, no PayPal amount),
     in Serbia and abroad, and an answer about another season than the one this panel sells. */
  it.each([
    ['in Serbia, when his balance covers the fee', 'RS', anInvoice(2027, 'RSD', { toTransfer: 0, fromTheBalance: 4800 })],
    ['abroad, when his balance covers the fee', 'MK', anInvoice(2027, 'EUR', { toTransfer: 0, fromTheBalance: 40 })],
    ['in Serbia, when the answer is about another season', 'RS', anInvoice(2028, 'RSD')],
  ])('is told nothing about how a payment is known %s', async (_what, country, invoice) => {
    openHisPage({ country }, IN_THE_WINDOW, invoice)

    expect(await screen.findByRole('heading', { level: 1, name: 'Moja članarina' })).toBeVisible()
    /* The panel itself is drawn, so the absence below is the sentences' and not the page's. */
    expect(screen.getByRole('heading', { level: 2, name: 'Uplata članarine za 2027.' })).toBeVisible()
    /* And the read has been answered, so the absence is not a read still out. */
    await waitFor(() => expect(screen.getByText('Uplata je otvorena.')).toBeVisible())

    expect(screen.queryByText(/Podatke za uplatu vidiš u nastavku/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Prepoznaje se po imenu/)).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /QR/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kopiraj iznos za uplatu' })).not.toBeInTheDocument()
  }, SLOW)
})

describe('a member who HAS a number, on the same page', () => {
  /* **THE OTHER SIDE OF EVERY CASE ABOVE, on the member the generated data has whose fee has
     lapsed (000032, the one `memberFlows.test.tsx` renews as).** A screen that dropped the
     reference for everybody, kept the first-payment sentences for everybody or hid the panel about
     a team from everybody would pass the cases above and fail one of these. They read his page
     through the harness, which answers `/api/me` off the generated file, so the member has his
     number, his flag and his team (none) the way the server gives them. */
  function openAMembersPage(memberNumber = '000032') {
    stand(invoiceAsServed(anInvoice(2027, 'RSD')))
    renderAt('/sr/moja-clanarina', 'competitor', memberNumber, undefined, IN_THE_WINDOW)
  }

  it('is drawn the reference, in writing and in the code', async () => {
    openAMembersPage()

    const written = await screen.findByRole('heading', { level: 3, name: 'Uplatnica' })
    const slip = must(written.closest<HTMLElement>('.pay__slip'), 'the slip wrapper')

    expect(within(slip).getByText('Poziv na broj')).toBeVisible()
    expect(within(slip).getByText('2027000032')).toBeVisible()
    /* The sentence that used to stand under the reference is gone (PDL P8, owner, 18.10.2026,
       „Ovo obriši, ne služi ničemu”), for him as for everybody. */
    expect(within(slip).queryByText(/Poziv na broj je ono po čemu se uplata prepoznaje/)).not.toBeInTheDocument()
    expect(within(slip).queryByText(/Skeniraj kod/)).not.toBeInTheDocument()
    expect(within(slip).queryByText(/su već upisani/)).not.toBeInTheDocument()
    expect(must(readQr(within(slip).getByRole('img', { name: /QR/ })), 'the code')).toContain(
      '|RO:2027000032',
    )
  }, SLOW)

  it('is told what a renewal says, and nothing of a first payment', async () => {
    openAMembersPage()

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Obnova članarine za 2027.' }),
    ).toBeVisible()
    expect(screen.getByText(/Ne registruješ se ponovo/)).toBeVisible()
    expect(await screen.findByText(/tvoje članstvo se produžava/)).toBeVisible()
    expect(screen.getByText('Član od 2016. sezone.')).toBeVisible()

    expect(screen.queryByRole('heading', { name: /^Uplata članarine/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Prepoznaje se po imenu/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Članarina ti još nije evidentirana/)).not.toBeInTheDocument()
  }, SLOW)

  it('is drawn the panel about a team', async () => {
    openAMembersPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'Prelazni rok' })).toBeVisible()
    expect(screen.getByText('Trenutno nisi ni u jednom timu.')).toBeVisible()
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    /* The floor under the `configure` at the head of the file, asked of the number that decides and
       not of the text of the file. Every case above is given `SLOW`, and every wait half of it; take
       the `configure` away and both are `SLOW` again (`test/setup.ts`), so a wait that never
       succeeds is ended by the clock of the case that is waiting for it and the series of mutations
       that reads the log has nothing but a timeout to count. */
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
