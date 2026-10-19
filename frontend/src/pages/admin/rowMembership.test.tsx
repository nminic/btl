import { act, configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { arrivedResource, clearResourceCache, loadResource, type ResourceName } from '../../data/client'
import type { Competitor, Member } from '../../data/types'
import sr from '../../i18n/sr.json'
import { asMember, person } from '../../test/plate'
import { renderAt } from '../../test/render'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'

/**
 * „STORNIRAJ” AND THE CHANGE OF BASIS ON THE MEMBER'S ROW, AS THE MODERATOR MEETS THEM.
 *
 * What a basis offers is `memberMembership.test.ts`'s; this file holds what only a drawn row can show:
 * which rows carry which option, that each act asks in the owner's words before it sends, that „Ne”
 * sends nothing, that the request goes to that member's address with the basis the row showed, that a
 * refusal stays beside the row in the words of the act that met it, and which answers are asked again.
 *
 * **THE ROWS SEPARATE THE SECOND SOURCE OF EVERY VALUE**: one row on each of the three bases for the
 * season on sale, so a body that named a fixed basis is wrong on two of them; a fourth who holds an
 * older season on a payment and nothing on sale, so an option read off his last season rather than off
 * the season on sale is drawn where it must not be; and the moderator's own row is a row of its own,
 * so the inbox is asked again on it and on no other.
 */
/* Every wait is given half of what a case is given, for the reason `rowPayment.test.tsx` gives. */
configure({ asyncUtilTimeout: SLOW / 2 })

describe('cancelling a season or changing its basis on a member’s row', () => {
  const PAID = '000002'
  const EXEMPT = '000004'
  const ON_THE_BALANCE = '000006'
  const AN_OLDER_SEASON = '000008'

  const COMPETITORS: Competitor[] = [
    person(PAID, 'Ana', 'Držić'),
    person(EXEMPT, 'Zoran', 'Vuković', { city: 'Niš' }),
    person(ON_THE_BALANCE, 'Mila', 'Tomić', { city: 'Podgorica', country: 'ME' }),
    person(AN_OLDER_SEASON, 'Ivan', 'Jović'),
  ]

  const ON_SALE = { seasonOnSale: 2028, membershipSeason: 2028, active: true }

  const ROWS: Member[] = [
    asMember(must(COMPETITORS[0], 'Ana'), {
      ...ON_SALE,
      membershipBasis: 'payment',
      seasons: [
        { season: 2027, basis: 'feeExempt' },
        { season: 2028, basis: 'payment' },
      ],
    }),
    asMember(must(COMPETITORS[1], 'Zoran'), {
      ...ON_SALE,
      membershipBasis: 'feeExempt',
      seasons: [{ season: 2028, basis: 'feeExempt' }],
      currency: 'RSD',
      expected: 4200,
      price: 4200,
      balance: 1000,
    }),
    asMember(must(COMPETITORS[2], 'Mila'), {
      ...ON_SALE,
      membershipBasis: 'balance',
      seasons: [{ season: 2028, basis: 'balance' }],
      currency: 'EUR',
      expected: 38,
      price: 35,
    }),
    asMember(must(COMPETITORS[3], 'Ivan'), {
      seasonOnSale: 2028,
      membershipBasis: undefined,
      membershipSeason: undefined,
      seasons: [{ season: 2027, basis: 'payment' }],
      active: true,
    }),
  ]

  type Answering = (path: string, init: RequestInit | undefined) => Response | Promise<Response>

  function serving(toTheRow: Answering = () => Response.json({ season: 2028, basis: null })) {
    clearResourceCache()

    return serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (path === '/api/competitors' && how === 'GET') {
        return Response.json(COMPETITORS)
      }

      if (path === '/api/members' && how === 'GET') {
        return Response.json(ROWS)
      }

      if (path.startsWith('/api/members/') && how !== 'GET') {
        return toTheRow(path, init)
      }

      return null
    })
  }

  /** Every write the screen sent to a member's address, with its verb. */
  function sent(asked: Asked[]): { how: string; path: string; body: unknown }[] {
    return asked
      .filter((one) => (one.init?.method ?? 'GET') !== 'GET' && one.path.startsWith('/api/members/'))
      .map((one) => ({
        how: String(one.init?.method),
        path: one.path,
        body: JSON.parse(String(one.init?.body)),
      }))
  }

  function reads(asked: Asked[], address: string): number {
    return asked.filter((one) => one.path === address && (one.init?.method ?? 'GET') === 'GET').length
  }

  async function rowOf(memberNumber: string): Promise<HTMLElement> {
    const table = await screen.findByRole('table', { name: 'Članovi' })

    return must(within(table).getByText(memberNumber).closest('tr'), `the row of ${memberNumber}`)
  }

  it('offers on each row exactly what its basis on sale allows, and nothing on a row that holds none', async () => {
    const server = serving()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const paid = await rowOf(PAID)
    const exempt = await rowOf(EXEMPT)
    const balance = await rowOf(ON_THE_BALANCE)
    const older = await rowOf(AN_OLDER_SEASON)

    for (const row of [paid, exempt, balance]) {
      expect(within(row).getByRole('button', { name: 'Storniraj' })).toBeInTheDocument()
    }

    expect(within(paid).getByRole('button', { name: 'Promeni osnov u oslobođenje' })).toBeInTheDocument()
    expect(within(paid).queryByRole('button', { name: 'Upiši uplatu' })).toBeNull()

    expect(within(exempt).queryByRole('button', { name: 'Promeni osnov u oslobođenje' })).toBeNull()
    expect(within(exempt).getByLabelText('Uplaćeno (RSD)')).toBeInTheDocument()

    expect(within(balance).queryByRole('button', { name: 'Promeni osnov u oslobođenje' })).toBeNull()
    expect(within(balance).queryByRole('button', { name: 'Upiši uplatu' })).toBeNull()

    /* AN OLDER SEASON ON A PAYMENT OFFERS NOTHING OF THIS: only the payment of the season on sale. */
    expect(within(older).queryByRole('button', { name: 'Storniraj' })).toBeNull()
    expect(within(older).queryByRole('button', { name: 'Promeni osnov u oslobođenje' })).toBeNull()
    expect(within(older).getByRole('button', { name: 'Upiši uplatu' })).toBeInTheDocument()

    server.stop()
  })

  it.each([
    [PAID, 'payment', 'Storniraj uplatu za sezonu 2028?', 'Ana Držić, sezona 2028.'],
    [EXEMPT, 'feeExempt', 'Storniraj oslobođenje za sezonu 2028?', 'Zoran Vuković, sezona 2028.'],
    [ON_THE_BALANCE, 'balance', 'Storniraj aktivaciju iz balansa za sezonu 2028?', 'Mila Tomić, sezona 2028.'],
  ])(
    'asks before cancelling %s in the words of its basis, sends nothing on „Ne” and the basis it showed on „Da”',
    async (number, basis, question, whose) => {
      const server = serving()
      const user = setupUser()
      renderAt('/sr/administracija/clanovi', 'superadmin')

      const row = await rowOf(number)

      await user.click(within(row).getByRole('button', { name: 'Storniraj' }))

      const sheet = await screen.findByRole('dialog', { name: question })

      expect(within(sheet).getByText(whose)).toBeInTheDocument()

      await user.click(within(sheet).getByRole('button', { name: 'Ne' }))

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(sent(server.asked)).toEqual([])

      await user.click(within(row).getByRole('button', { name: 'Storniraj' }))
      await user.click(
        within(await screen.findByRole('dialog', { name: question })).getByRole('button', { name: 'Da' }),
      )

      await waitFor(() =>
        expect(sent(server.asked)).toEqual([
          { how: 'DELETE', path: `/api/members/${number}/membership`, body: { basis } },
        ]),
      )

      server.stop()
    },
    SLOW,
  )

  it('asks before turning a payment into an exemption that the record of the payment is deleted', async () => {
    const server = serving(() => Response.json({ season: 2028, basis: 'feeExempt' }))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(PAID)

    await user.click(within(row).getByRole('button', { name: 'Promeni osnov u oslobođenje' }))
    await user.click(
      within(
        await screen.findByRole('dialog', {
          name: 'Promeni osnov u oslobođenje za sezonu 2028? Zapis o uplati se briše.',
        }),
      ).getByRole('button', { name: 'Da' }),
    )

    await waitFor(() =>
      expect(sent(server.asked)).toEqual([
        { how: 'PUT', path: `/api/members/${PAID}/membership`, body: { from: 'payment', to: 'feeExempt' } },
      ]),
    )
    expect(await screen.findByText('Osnov članstva je promenjen.')).toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('books a payment over the exemption as a change of basis, and never as a payment of its own', async () => {
    const server = serving(() => Response.json({ season: 2028, basis: 'payment' }))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(EXEMPT)

    /* 3.200 of 4.200 with a book of 1.000: the book covers the rest, so nothing is asked. */
    await user.type(within(row).getByLabelText('Uplaćeno (RSD)'), '3200')
    await user.click(within(row).getByRole('button', { name: 'Upiši uplatu' }))

    await waitFor(() =>
      expect(sent(server.asked)).toEqual([
        {
          how: 'PUT',
          path: `/api/members/${EXEMPT}/membership`,
          body: { from: 'feeExempt', to: 'payment', received: 3200, method: 'ips' },
        },
      ]),
    )
    expect(await screen.findByText('Osnov članstva je promenjen.')).toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('says beside the row why a cancellation was refused, in its words, and asks nothing again', async () => {
    const server = serving(() => refused('theBasisHasChanged', 409))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(ON_THE_BALANCE)

    await user.click(within(row).getByRole('button', { name: 'Storniraj' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

    expect(
      await within(row).findByText(
        'Osnov za ovu sezonu se u međuvremenu promenio, pa ništa nije urađeno. Osveži stranicu.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(await rowOf(PAID)).queryByText(/u međuvremenu promenio/)).toBeNull()
    expect(reads(server.asked, '/api/members')).toBe(1)

    server.stop()
  }, SLOW)

  /**
   * EACH ACT IN THE WORDS OF ITS OWN ROUTE: the change meets a reason a cancellation cannot, and the
   * payment over the exemption meets one the row's own payment never does, which only the map of a
   * change of basis answers.
   */
  it('says a refused change, and a refused payment over the exemption, in the words of the change', async () => {
    const server = serving((path, init) =>
      init?.method === 'PUT' && path.includes(EXEMPT)
        ? refused('theBasisHasChanged', 409)
        : refused('thisChangeIsNotOffered', 400),
    )
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const paid = await rowOf(PAID)

    await user.click(within(paid).getByRole('button', { name: 'Promeni osnov u oslobođenje' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

    expect(
      await within(paid).findByText(sr.admin.membershipRefused.thisChangeIsNotOffered),
    ).toBeInTheDocument()
    /* A REFUSED CHANGE CHANGED NOTHING, so nothing is asked again: the list was read once. */
    expect(reads(server.asked, '/api/members')).toBe(1)

    const exempt = await rowOf(EXEMPT)

    await user.type(within(exempt).getByLabelText('Uplaćeno (RSD)'), '4200')
    await user.click(within(exempt).getByRole('button', { name: 'Upiši uplatu' }))

    expect(
      await within(exempt).findByText(sr.admin.membershipRefused.theBasisHasChanged),
    ).toBeInTheDocument()
    expect(reads(server.asked, '/api/members')).toBe(1)

    server.stop()
  }, SLOW)

  it('sends one request for two presses on „Da” with nothing awaited between them', async () => {
    let answer: (value: Response) => void = () => {}
    const server = serving(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    )
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(PAID)

    await user.click(within(row).getByRole('button', { name: 'Storniraj' }))

    const da = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' })

    act(() => {
      da.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      da.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    await waitFor(() => expect(sent(server.asked)).toHaveLength(1))
    answer(Response.json({ season: 2028, basis: null }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    expect(sent(server.asked)).toHaveLength(1)

    server.stop()
  }, SLOW)

  it('asks again for every answer a cancellation changes, and leaves the inbox of another row alone', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin', PAID)

    const row = await rowOf(EXEMPT)

    const dropped: ResourceName[] = ['payments', 'results', 'teams', 'pairs']

    for (const name of dropped) {
      await loadResource(name)
    }

    /* THE INBOX IS COUNTED BY HOW OFTEN IT IS ASKED FOR, because the shell of a signed-in member holds
       a reader of it that asks again the moment it is told to. */
    await waitFor(() => expect(reads(server.asked, '/api/inbox')).toBeGreaterThan(0))
    const inboxReads = reads(server.asked, '/api/inbox')

    await user.click(within(row).getByRole('button', { name: 'Storniraj' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

    await waitFor(() => expect(reads(server.asked, '/api/members')).toBe(2))
    expect(reads(server.asked, '/api/competitors')).toBe(2)

    for (const name of dropped) {
      expect(arrivedResource(name), name).toBeUndefined()
    }

    expect(reads(server.asked, '/api/inbox'), 'the inbox was asked again for somebody else’s row').toBe(
      inboxReads,
    )
    expect(await screen.findByText('Članstvo je stornirano.')).toBeInTheDocument()

    server.stop()
  }, SLOW)

  /**
   * AND THE SAME FOR BOTH CHANGES OF BASIS, each through its own door: the change from a payment on
   * `RowMembership`, and the payment over the exemption on `RowPayment`. Each must drop the six
   * answers, read the list again, say that the basis changed, and leave the inbox of another row alone,
   * which is what tells it apart from `paymentRecorded`.
   */
  it.each([
    [PAID, 'the change to the exemption'],
    [EXEMPT, 'the payment over the exemption'],
  ])('asks again for every answer after %s (%s), and leaves the inbox of another row alone', async (number) => {
    const server = serving(() => Response.json({ season: 2028, basis: 'changed' }))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin', AN_OLDER_SEASON)

    const row = await rowOf(number)
    const dropped: ResourceName[] = ['payments', 'results', 'teams', 'pairs']

    for (const name of dropped) {
      await loadResource(name)
    }

    await waitFor(() => expect(reads(server.asked, '/api/inbox')).toBeGreaterThan(0))
    const inboxReads = reads(server.asked, '/api/inbox')

    if (number === PAID) {
      await user.click(within(row).getByRole('button', { name: 'Promeni osnov u oslobođenje' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))
    } else {
      await user.type(within(row).getByLabelText('Uplaćeno (RSD)'), '3200')
      await user.click(within(row).getByRole('button', { name: 'Upiši uplatu' }))
    }

    await waitFor(() => expect(reads(server.asked, '/api/members')).toBe(2))
    expect(reads(server.asked, '/api/competitors')).toBe(2)

    for (const name of dropped) {
      expect(arrivedResource(name), name).toBeUndefined()
    }

    expect(reads(server.asked, '/api/inbox'), 'the inbox was asked again for somebody else’s row').toBe(
      inboxReads,
    )
    expect(await screen.findByText('Osnov članstva je promenjen.')).toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('asks for the inbox again when the row is the moderator’s own', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin', EXEMPT)

    const row = await rowOf(EXEMPT)

    await waitFor(() => expect(reads(server.asked, '/api/inbox')).toBeGreaterThan(0))
    const inboxReads = reads(server.asked, '/api/inbox')

    await user.click(within(row).getByRole('button', { name: 'Storniraj' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

    await waitFor(() => expect(reads(server.asked, '/api/inbox')).toBeGreaterThan(inboxReads))

    server.stop()
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
