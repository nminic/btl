import { act, configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { arrivedResource, clearResourceCache, loadResource, type ResourceName } from '../../data/client'
import type { Competitor, Member } from '../../data/types'
import { asMember, person } from '../../test/plate'
import { renderAt } from '../../test/render'
import { memberRowOf as rowOf, paymentSheet, recordInTheSheet } from '../../test/memberRow'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'
import { namesThatReadTheFlag, READS_THE_FLAG_AND_IS_NOT_DROPPED } from '../../test/readsTheFlag'

/**
 * „UPIS UPLATE" ON THE MEMBER'S ROW, AS THE MODERATOR MEETS IT.
 *
 * The decision of what a press sends is `memberPayment.test.ts`'s; this file holds what only a drawn
 * row can show: which rows carry the option at all, that the body reaches the right address, that the
 * question is put and „Ne" sends nothing, that a refusal stays beside the row, and that the answers
 * the booking changes are asked again.
 *
 * **THE ROWS SEPARATE THE SECOND SOURCE OF EVERY VALUE THE PRESS READS**: two members without a
 * season on sale, in two currencies, with two different books and two different expected amounts, so
 * a body built off the wrong row or the wrong money is a different body; and a third member who holds
 * the season on sale, who is drawn first. All three are members of 2027 on 20 October, so all three
 * are active and under the filter the screen opens on.
 */
/* EVERY WAIT IN THIS FILE IS GIVEN HALF OF WHAT A CASE IS GIVEN, the shape and the reason of
   `saveWhileSaving.test.tsx`: a request that never leaves, or a list that is never read again, is then
   told by the wait's own assertion and not by the clock of the case, so a series of mutations can tell
   a case that failed from a case that ran out of time (CLAUDE.md, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/** The two the screen asks for again the moment they are dropped, so their landing back in the cache
 *  proves nothing: a drop of theirs is a second request, and that is what is counted (as in
 *  `rowMembership.test.tsx`). */
const ASKED_AGAIN_AT_ONCE: ResourceName[] = ['members', 'competitors']

describe('recording a payment on a member’s row', () => {
  const HOLDS_IT = '000002'
  const IN_DINARS = '000004'
  const IN_EURO = '000006'

  const COMPETITORS: Competitor[] = [
    person(HOLDS_IT, 'Ana', 'Držić'),
    person(IN_DINARS, 'Zoran', 'Vuković', { city: 'Niš' }),
    /* SERBIA, AND BILLED IN EURO, which no member really is: the money of the sheet is `currency`, the
       server's one home for it (`Currency.of`), and a sheet that worked it out of the country instead
       would say dinars here. Every other value the case reads is hers as the server would answer it. */
    person(IN_EURO, 'Mila', 'Tomić', { city: 'Podgorica', country: 'RS' }),
  ]

  const ROWS: Member[] = [
    asMember(must(COMPETITORS[0], 'Ana'), { seasonOnSale: 2028, membershipSeason: 2028 }),
    asMember(must(COMPETITORS[1], 'Zoran'), {
      membershipBasis: undefined,
      membershipSeason: undefined,
      seasons: [{ season: 2027, basis: 'payment' }],
      active: true,
      seasonOnSale: 2028,
      currency: 'RSD',
      expected: 4200,
      price: 4200,
      balance: 1000,
    }),
    asMember(must(COMPETITORS[2], 'Mila'), {
      membershipBasis: undefined,
      membershipSeason: undefined,
      seasons: [{ season: 2027, basis: 'payment' }],
      active: true,
      seasonOnSale: 2028,
      currency: 'EUR',
      expected: 38,
      price: 35,
      balance: 2,
    }),
  ]

  type Answering = (path: string, init: RequestInit | undefined) => Response | Promise<Response>

  function serving(toTheRow: Answering = () => new Response('{}', { status: 201 })) {
    clearResourceCache()

    return serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (path === '/api/competitors' && how === 'GET') {
        return Response.json(COMPETITORS)
      }

      if (path === '/api/members' && how === 'GET') {
        return Response.json(ROWS)
      }

      if (path.startsWith('/api/members/') && how === 'POST') {
        return toTheRow(path, init)
      }

      return null
    })
  }

  function sent(asked: Asked[]): { path: string; body: unknown }[] {
    return asked
      .filter((one) => one.init?.method === 'POST' && one.path.startsWith('/api/members/'))
      .map((one) => ({ path: one.path, body: JSON.parse(String(one.init?.body)) }))
  }

  function reads(asked: Asked[], address: string): number {
    return asked.filter((one) => one.path === address && (one.init?.method ?? 'GET') === 'GET').length
  }

  it('is offered only on a row that holds no season on sale, in a sheet in that member’s own money', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    /* ON EVERY ROW, AND SWITCHED OFF FOR REAL WHERE IT CANNOT ACT (owner, PDL 20.10.2026: „„Aktiviraj" i
       „Upiši uplatu" ostaju pravo neaktivni (bez fokusa)"): out of the order of focus, and a press on it
       opens nothing. It keeps its place, so every symbol stands where it does on every row. */
    const holds = within(await rowOf(HOLDS_IT)).getByRole('button', { name: 'Upiši uplatu' })

    expect(holds).toBeDisabled()
    expect(holds).not.toHaveAttribute('aria-disabled')
    await user.click(holds)
    expect(screen.queryByRole('dialog')).toBeNull()

    for (const [number, currency, expected, balance] of [
      [IN_DINARS, 'RSD', '4.200 RSD', '1.000 RSD'],
      [IN_EURO, 'EUR', '38 EUR', '2 EUR'],
    ] as const) {
      const row = await rowOf(number)

      expect(within(row).getByRole('button', { name: 'Upiši uplatu' })).toBeEnabled()

      const sheet = await paymentSheet(user, row)

      expect(within(sheet).getByLabelText(`Uplaćeno (${currency})`)).toBeInTheDocument()
      /* What he is expected to send and what his book holds, in his money (PDL P8, 18.10.2026). */
      expect(within(sheet).getByText(`Očekivan iznos: ${expected}`)).toBeInTheDocument()
      expect(within(sheet).getByText(`Balans: ${balance}`)).toBeInTheDocument()

      await user.click(within(sheet).getByRole('button', { name: 'Odustani' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    }

    expect(sent(server.asked)).toEqual([])

    server.stop()
  }, SLOW)

  it('sends what arrived to that member’s own address, and asks nothing when his book covers the rest', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_DINARS)

    /* 3.200 of 4.200 with a book of 1.000: case 2, which goes straight through. */
    await recordInTheSheet(user, await paymentSheet(user, row), '3200')

    await waitFor(() =>
      expect(sent(server.asked)).toEqual([
        { path: `/api/members/${IN_DINARS}/payment`, body: { received: 3200, method: 'ips' } },
      ]),
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    server.stop()
  }, SLOW)

  it('asks „Prihvatam umanjen ukupan iznos?” when his book cannot cover the rest, and „Ne” sends nothing', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_EURO)

    /* 30 of 38 euro with a book of 2: 6 is missing however the book is spent. */
    await recordInTheSheet(user, await paymentSheet(user, row), '30')

    const question = await screen.findByRole('dialog', { name: 'Prihvatam umanjen ukupan iznos?' })

    expect(within(question).getByText('Mila Tomić, sezona 2028.')).toBeInTheDocument()
    expect(within(question).getByText('Očekivan iznos: 38 EUR')).toBeInTheDocument()
    expect(within(question).getByText('Nedostaje: 6 EUR')).toBeInTheDocument()

    await user.click(within(question).getByRole('button', { name: 'Ne' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(server.asked)).toEqual([])

    await recordInTheSheet(user, await paymentSheet(user, row), '30')
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Prihvatam umanjen ukupan iznos?' })).getByRole(
        'button',
        { name: 'Da' },
      ),
    )

    await waitFor(() =>
      expect(sent(server.asked)).toEqual([
        { path: `/api/members/${IN_EURO}/payment`, body: { received: 30, method: 'paypal' } },
      ]),
    )

    server.stop()
  }, SLOW)

  /**
   * THE SHEET IS PUT AWAY BY ESCAPE WITH NOTHING SENT, AND EVERY WAY IT CLOSES GIVES THE FOCUS BACK TO
   * „UPIŠI UPLATU" OF THAT ROW (WCAG 2.2 SC 2.4.3): after Escape, and after a payment that went through.
   * The symbol stays on the row in both cases (the coordinator's answer of 22.10.2026, P3), which is what
   * leaves the focus somewhere to go back to.
   */
  it('is put away by Escape with nothing sent, and gives the focus back to its button however it closes', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_EURO)
    const opener = within(row).getByRole('button', { name: 'Upiši uplatu' })

    const sheet = await paymentSheet(user, row)

    await user.type(within(sheet).getByLabelText('Uplaćeno (EUR)'), '38')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(server.asked)).toEqual([])
    expect(opener).toHaveFocus()

    /* Opened again, it starts empty: what was typed into a sheet put away was not a payment. */
    const again = await paymentSheet(user, row)

    expect(within(again).getByLabelText('Uplaćeno (EUR)')).toHaveValue('')

    await user.type(within(again).getByLabelText('Uplaćeno (EUR)'), '38')
    await user.click(within(again).getByRole('button', { name: 'Upiši uplatu' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(server.asked)).toEqual([
      { path: `/api/members/${IN_EURO}/payment`, body: { received: 38, method: 'paypal' } },
    ])
    expect(opener).toHaveFocus()

    server.stop()
  }, SLOW)

  it('sends nothing for a nought or for what it cannot read, and says why beside the field', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const sheet = await paymentSheet(user, await rowOf(IN_DINARS))
    const field = within(sheet).getByLabelText('Uplaćeno (RSD)')
    const button = within(sheet).getByRole('button', { name: 'Upiši uplatu' })
    const notMoney = 'Iznos uplate mora da bude veći od nule, pa uplata nije proknjižena i članstvo nije upisano.'

    /* AN EMPTY FIELD IS SAID ONLY ONCE IT IS PRESSED, and it is the nought's sentence: the two are one
       state (PDL 19, point 5). The row's button used to be switched off; a sheet's answer is not. */
    expect(field).not.toHaveAccessibleDescription(notMoney)
    await user.click(button)
    expect(field).toHaveAccessibleDescription(notMoney)

    await user.type(field, '0')
    await user.click(button)

    expect(field).toHaveAccessibleDescription(notMoney)

    await user.clear(field)
    await user.type(field, '4.200')
    await user.click(button)

    expect(field).toHaveAccessibleDescription('Iznos unesi samo ciframa, bez tačaka i zareza.')
    expect(screen.getByRole('dialog', { name: 'Upiši uplatu' })).toBe(sheet)
    expect(sent(server.asked)).toEqual([])

    server.stop()
  }, SLOW)

  it('says beside the row why the server refused it, and asks nothing again', async () => {
    const server = serving(() => refused('theMembershipIsAlreadyHeld', 409))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_DINARS)

    await recordInTheSheet(user, await paymentSheet(user, row), '4200')

    expect(
      await within(row).findByText('Ovaj član već ima članstvo za ovu sezonu, pa nije upisano ponovo.'),
    ).toBeInTheDocument()
    expect(reads(server.asked, '/api/members')).toBe(1)

    server.stop()
  }, SLOW)

  it('sends one request however often it is pressed while that request is out', async () => {
    let answer: (value: Response) => void = () => {}
    const server = serving(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    )
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const sheet = await paymentSheet(user, await rowOf(IN_DINARS))

    await user.type(within(sheet).getByLabelText('Uplaćeno (RSD)'), '4200')

    const button = within(sheet).getByRole('button', { name: 'Upiši uplatu' })

    await user.click(button)
    await user.click(button)
    await user.click(button)

    expect(sent(server.asked)).toHaveLength(1)
    /* The sheet says a request is out and cannot be put away until the answer comes. */
    expect(within(sheet).getByRole('status')).toHaveTextContent('Šalje se')

    answer(new Response('{}', { status: 201 }))

    await waitFor(() => expect(reads(server.asked, '/api/members')).toBe(2))
    expect(sent(server.asked)).toHaveLength(1)

    server.stop()
  }, SLOW)

  it('sends one request for two presses on „Da” with nothing awaited between them', async () => {
    /* `paymentsActivation.test.tsx`'s race: two raw clicks inside one `act`, so the second is handled
       by the closure the first was, before anything has been drawn again. Only the ref can tell. */
    let answer: (value: Response) => void = () => {}
    const server = serving(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    )
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_EURO)

    await recordInTheSheet(user, await paymentSheet(user, row), '30')

    const da = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' })

    act(() => {
      da.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      da.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    /* The request leaves a few turns of the loop after the press, so the answer waits for it. */
    await waitFor(() => expect(sent(server.asked)).toHaveLength(1))
    answer(new Response('{}', { status: 201 }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    expect(sent(server.asked)).toEqual([
      { path: `/api/members/${IN_EURO}/payment`, body: { received: 30, method: 'paypal' } },
    ])

    server.stop()
  }, SLOW)

  it('asks again for every answer the booking changed once it has gone through', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_DINARS)

    /* The payments screen's list and the inbox are held as this visit already read them, so dropping
       them is something a case can see. */
    await loadResource('payments')
    await loadResource('inbox')

    expect(arrivedResource('payments')).toBeDefined()
    expect(arrivedResource('inbox')).toBeDefined()

    await recordInTheSheet(user, await paymentSheet(user, row), '4200')

    await waitFor(() => expect(reads(server.asked, '/api/members')).toBe(2))
    expect(reads(server.asked, '/api/competitors')).toBe(2)
    expect(arrivedResource('payments')).toBeUndefined()
    expect(arrivedResource('inbox')).toBeUndefined()
    expect(await screen.findByText('Uplata je upisana.')).toBeInTheDocument()

    server.stop()
  }, SLOW)

  /**
   * EVERY CACHED ANSWER THAT READS THE FLAG IS ASKED AGAIN AFTER A PAYMENT ON A ROW WITH NO SEASON ON
   * SALE (the class of PENDING 29656), because the booking can make a lapsed member active. The names are
   * the backend's own, read out of its SQL (`test/readsTheFlag.ts`, the reading `rowMembership.test.tsx`
   * holds the other three doors to), and each is loaded and confirmed in hand BEFORE the press so that
   * „gone afterwards" is a change this case can see. `members` and `competitors` are asked again at
   * once, so their drop is counted as a second request.
   */
  it('drops every answer that reads the flag once the payment has gone through', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_DINARS)
    const dropped = namesThatReadTheFlag().filter(
      (name) => name !== READS_THE_FLAG_AND_IS_NOT_DROPPED && !ASKED_AGAIN_AT_ONCE.includes(name),
    )

    for (const name of dropped) {
      await loadResource(name)
      expect(arrivedResource(name), `${name} never landed, so nothing below was measured`).toBeDefined()
    }

    await recordInTheSheet(user, await paymentSheet(user, row), '4200')

    await waitFor(() => {
      for (const name of dropped) {
        expect(arrivedResource(name), `${name} was still cached after the payment`).toBeUndefined()
      }
    })

    for (const name of ASKED_AGAIN_AT_ONCE) {
      await waitFor(() => expect(reads(server.asked, `/api/${name}`)).toBe(2))
    }

    server.stop()
  }, SLOW)

  it('drops nothing for a refused payment', async () => {
    const server = serving(() => refused('theMembershipIsAlreadyHeld', 409))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_DINARS)
    const names = namesThatReadTheFlag().filter(
      (name) => name !== READS_THE_FLAG_AND_IS_NOT_DROPPED && !ASKED_AGAIN_AT_ONCE.includes(name),
    )

    for (const name of names) {
      await loadResource(name)
    }

    await recordInTheSheet(user, await paymentSheet(user, row), '4200')
    await within(row).findByText('Ovaj član već ima članstvo za ovu sezonu, pa nije upisano ponovo.')

    for (const name of names) {
      expect(arrivedResource(name), `${name} was dropped though nothing was written`).toBeDefined()
    }

    expect(reads(server.asked, '/api/members')).toBe(1)

    server.stop()
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
