import { act, configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import {
  arrivedResource,
  clearResourceCache,
  loadResource,
  type ResourceName,
} from '../../data/client'
import type { Competitor, Member } from '../../data/types'
import sr from '../../i18n/sr.json'
import { asMember, person } from '../../test/plate'
import { renderAt } from '../../test/render'
import { answeredWith, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'
import { namesThatReadTheFlag, READS_THE_FLAG_AND_IS_NOT_DROPPED } from '../../test/readsTheFlag'
import { WHAT_READS_OR_SHOWS_ACTIVE } from './whatActiveMoves'

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

/** The two the screen asks for again the moment they are dropped, so their landing back in the cache
 *  proves nothing: a drop of theirs is a second request, and that is what is counted. */
const ASKED_AGAIN_AT_ONCE: ResourceName[] = ['members', 'competitors']

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

      if ((path.startsWith('/api/members/') || path.startsWith('/api/competitors/')) && how !== 'GET') {
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

  it('offers on each row exactly what its basis on sale allows, and the exemption on a row that holds none', async () => {
    const server = serving()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const paid = await rowOf(PAID)
    const exempt = await rowOf(EXEMPT)
    const balance = await rowOf(ON_THE_BALANCE)
    const older = await rowOf(AN_OLDER_SEASON)

    for (const row of [paid, exempt, balance]) {
      expect(within(row).getByRole('button', { name: 'Storniraj' })).toBeInTheDocument()
      expect(within(row).queryByRole('button', { name: 'Odobri oslobođenje' })).toBeNull()
    }

    expect(within(paid).getByRole('button', { name: 'Promeni osnov u oslobođenje' })).toBeInTheDocument()
    expect(within(paid).queryByRole('button', { name: 'Upiši uplatu' })).toBeNull()

    expect(within(exempt).queryByRole('button', { name: 'Promeni osnov u oslobođenje' })).toBeNull()
    expect(within(exempt).getByLabelText('Uplaćeno (RSD)')).toBeInTheDocument()

    expect(within(balance).queryByRole('button', { name: 'Promeni osnov u oslobođenje' })).toBeNull()
    expect(within(balance).queryByRole('button', { name: 'Upiši uplatu' })).toBeNull()

    /* AN OLDER SEASON ON A PAYMENT OFFERS NOTHING OF THAT SEASON: the payment of the season on sale, and
       since 20.10.2026 its exemption. */
    expect(within(older).queryByRole('button', { name: 'Storniraj' })).toBeNull()
    expect(within(older).queryByRole('button', { name: 'Promeni osnov u oslobođenje' })).toBeNull()
    expect(within(older).getByRole('button', { name: 'Upiši uplatu' })).toBeInTheDocument()
    expect(within(older).getByRole('button', { name: 'Odobri oslobođenje' })).toBeInTheDocument()

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

  /**
   * THE EXEMPTION OF A ROW THAT HOLDS NONE, in the window the owner chose on 20.10.2026: the year is the
   * season on sale and not his last season (2027 here), „Ne” sends nothing, „Da” sends the one basis a
   * grant may name, and the six answers are asked again while the inbox of another row is left alone.
   */
  it('asks before granting the exemption, for the season on sale, and asks every answer again once it is written', async () => {
    const server = serving(() => Response.json({ season: 2028, basis: 'feeExempt' }, { status: 201 }))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin', PAID)

    const row = await rowOf(AN_OLDER_SEASON)
    const dropped: ResourceName[] = ['payments', 'results', 'teams', 'pairs']

    for (const name of dropped) {
      await loadResource(name)
    }

    await waitFor(() => expect(reads(server.asked, '/api/inbox')).toBeGreaterThan(0))
    const inboxReads = reads(server.asked, '/api/inbox')

    await user.click(within(row).getByRole('button', { name: 'Odobri oslobođenje' }))

    const sheet = await screen.findByRole('dialog', { name: 'Odobri oslobođenje od članarine za sezonu 2028?' })

    expect(within(sheet).getByText('Ivan Jović, sezona 2028.')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Ne' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(server.asked)).toEqual([])

    await user.click(within(row).getByRole('button', { name: 'Odobri oslobođenje' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

    await waitFor(() =>
      expect(sent(server.asked)).toEqual([
        { how: 'POST', path: `/api/members/${AN_OLDER_SEASON}/membership`, body: { basis: 'feeExempt' } },
      ]),
    )
    await waitFor(() => expect(reads(server.asked, '/api/members')).toBe(2))
    expect(reads(server.asked, '/api/competitors')).toBe(2)

    for (const name of dropped) {
      expect(arrivedResource(name), name).toBeUndefined()
    }

    expect(reads(server.asked, '/api/inbox'), 'the inbox was asked again for somebody else’s row').toBe(
      inboxReads,
    )
    expect(await screen.findByText('Oslobođenje je upisano.')).toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('says a refused grant beside its row in the words of a grant, and asks nothing again', async () => {
    const server = serving(() => refused('thisChangeIsNotOffered', 400))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(AN_OLDER_SEASON)

    await user.click(within(row).getByRole('button', { name: 'Odobri oslobođenje' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

    expect(await within(row).findByText(sr.admin.membershipRefused.thisChangeIsNotOffered)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(reads(server.asked, '/api/members')).toBe(1)

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

  /**
   * EVERY CACHED ANSWER THAT READS THE FLAG IS ASKED AGAIN AFTER A CHANGE OF A SEASON (PENDING 29656),
   * through each of the four doors that ends in `seasonChanged`: the cancellation, the change of a
   * basis, the grant and the payment over the exemption. The names are the backend's, read out of its
   * SQL above; each is loaded and confirmed in hand BEFORE the press, so „gone afterwards" is a change
   * this case can see and not a guess about a resource nobody had asked for.
   */
  it.each([
    ['the cancellation', PAID],
    ['the change to the exemption', PAID],
    ['the grant', AN_OLDER_SEASON],
    ['the payment over the exemption', EXEMPT],
  ])('drops every answer that reads the flag after %s', async (door, number) => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin', ON_THE_BALANCE)

    const row = await rowOf(number)
    const names = namesThatReadTheFlag().filter((name) => name !== READS_THE_FLAG_AND_IS_NOT_DROPPED)
    const dropped = names.filter((name) => !ASKED_AGAIN_AT_ONCE.includes(name))

    for (const name of dropped) {
      await loadResource(name)
      expect(arrivedResource(name), `${name} never landed, so nothing below was measured`).toBeDefined()
    }

    const before = ASKED_AGAIN_AT_ONCE.map((name) => reads(server.asked, `/api/${name}`))

    if (door === 'the cancellation') {
      await user.click(within(row).getByRole('button', { name: 'Storniraj' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))
    } else if (door === 'the change to the exemption') {
      await user.click(within(row).getByRole('button', { name: 'Promeni osnov u oslobođenje' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))
    } else if (door === 'the grant') {
      await user.click(within(row).getByRole('button', { name: 'Odobri oslobođenje' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))
    } else {
      await user.type(within(row).getByLabelText('Uplaćeno (RSD)'), '3200')
      await user.click(within(row).getByRole('button', { name: 'Upiši uplatu' }))
    }

    await waitFor(() => {
      for (const name of dropped) {
        expect(arrivedResource(name), `${name} was still cached after ${door}`).toBeUndefined()
      }
    })

    ASKED_AGAIN_AT_ONCE.forEach((name, at) => {
      expect(reads(server.asked, `/api/${name}`), `${name} was not asked again after ${door}`).toBe(
        (before[at] ?? 0) + 1,
      )
    })

    server.stop()
  }, SLOW)

  /**
   * THE FLOOR STANDS ON SOMETHING, and the exception stands on something. A derivation that found no
   * name would make the case above pass over an empty list, and an exception for a name that no longer
   * reads the flag would be a rule about nothing.
   */
  it('reads the flag off the backend: the names are found, and the one exception is still one', () => {
    const names = namesThatReadTheFlag()

    expect(names).toContain('competitors')
    expect(names).toContain('attendance')
    expect(names).toContain('comments')
    expect(names).toContain(READS_THE_FLAG_AND_IS_NOT_DROPPED)
    expect(names).not.toContain('ducats')
  })

  /**
   * THE ONE LIST THAT EVERY PATH MOVING THE FLAG DROPS (`whatActiveMoves.ts`) IS HELD TO THE BACKEND IN
   * BOTH DIRECTIONS, and not only through the screens that happen to be driven in this file: every name
   * the SQL reads the flag in is on it (bar the one exception), and nothing is on it that neither reads
   * the flag nor is one of the two screens the write itself is made on. The three paths (this file's four
   * doors, `rowPayment.test.tsx`'s payment and `paymentsActivation.test.tsx`'s activation) each drive it
   * from the screen.
   */
  it('keeps one list for every path that moves the flag, and it is the backend’s', () => {
    const reading = namesThatReadTheFlag().filter((name) => name !== READS_THE_FLAG_AND_IS_NOT_DROPPED)
    const THE_WRITES_ARE_MADE_ON: ResourceName[] = ['payments', 'members']

    for (const name of reading) {
      expect(WHAT_READS_OR_SHOWS_ACTIVE, `${name} reads the flag and is not dropped`).toContain(name)
    }

    expect(WHAT_READS_OR_SHOWS_ACTIVE).not.toContain(READS_THE_FLAG_AND_IS_NOT_DROPPED)

    for (const name of WHAT_READS_OR_SHOWS_ACTIVE) {
      expect(
        [...reading, ...THE_WRITES_ARE_MADE_ON],
        `${name} is dropped though nothing about it depends on the flag`,
      ).toContain(name)
    }
  })

  /**
   * A REFUSAL DROPS NOTHING, AND NEITHER DOES A RE-DRAW OF THE SCREEN. The two ways to get the new lines
   * wrong that the case above cannot see: dropping when the press is answered whatever the answer was, and
   * dropping in the body of the screen, where it would run on every render. The first is a refused
   * cancellation, the second a change of the filter, which draws the screen again with nothing written.
   */
  it('drops nothing for a refused cancellation, and nothing when the screen is only drawn again', async () => {
    const server = serving(() => refused('theBasisHasChanged', 409))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(ON_THE_BALANCE)
    const names = namesThatReadTheFlag().filter(
      (name) => name !== READS_THE_FLAG_AND_IS_NOT_DROPPED && !ASKED_AGAIN_AT_ONCE.includes(name),
    )

    for (const name of names) {
      await loadResource(name)
    }

    await user.click(within(row).getByRole('button', { name: 'Storniraj' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))
    await within(row).findByText(/u međuvremenu promenio/)

    await user.selectOptions(screen.getByLabelText('Članstvo'), 'Svi')
    await screen.findByRole('table', { name: 'Članovi' })

    for (const name of names) {
      expect(arrivedResource(name), `${name} was dropped though nothing was written`).toBeDefined()
    }

    expect(reads(server.asked, '/api/members')).toBe(1)
    expect(reads(server.asked, '/api/competitors')).toBe(1)

    server.stop()
  }, SLOW)

  /**
   * THE SENTENCE OF A REFUSED CANCELLATION GOES WHEN A PAYMENT OVER THE EXEMPTION GOES THROUGH ON THE
   * SAME ROW (PENDING 29660), AND NO OTHER ROW'S REFUSAL GOES WITH IT.
   *
   * <p>Three rows are refused first and the success is on the second, so that „the first row", „the last
   * refused" and „every row" are three different answers: the first row (Ana) is refused a change, the
   * third (Mila) a cancellation in the very words of the second's (Zoran), so the sentence is told from
   * the other by the ROW it stands beside and not by its text. Asked of each row's own box.
   */
  it('takes the refusal of a row away when another control on that row goes through, and leaves the other rows’', async () => {
    const server = serving((path, init) => {
      if (init?.method === 'PUT' && path.includes(PAID)) {
        return refused('thisChangeIsNotOffered', 400)
      }

      if (init?.method === 'PUT') {
        return Response.json({ season: 2028, basis: 'payment' })
      }

      return refused('theBasisHasChanged', 409)
    })
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const refusedCancel = /u međuvremenu promenio/
    const paid = await rowOf(PAID)
    const exempt = await rowOf(EXEMPT)
    const balance = await rowOf(ON_THE_BALANCE)

    await user.click(within(balance).getByRole('button', { name: 'Storniraj' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))
    await within(balance).findByText(refusedCancel)

    await user.click(within(paid).getByRole('button', { name: 'Promeni osnov u oslobođenje' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))
    await within(paid).findByText(sr.admin.membershipRefused.thisChangeIsNotOffered)

    await user.click(within(exempt).getByRole('button', { name: 'Storniraj' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))
    await within(exempt).findByText(refusedCancel)

    await user.type(within(exempt).getByLabelText('Uplaćeno (RSD)'), '3200')
    await user.click(within(exempt).getByRole('button', { name: 'Upiši uplatu' }))

    expect(await screen.findByText('Osnov članstva je promenjen.')).toBeInTheDocument()
    expect(within(exempt).queryByText(refusedCancel)).toBeNull()
    expect(within(balance).getByText(refusedCancel)).toBeInTheDocument()
    expect(within(paid).getByText(sr.admin.membershipRefused.thisChangeIsNotOffered)).toBeInTheDocument()

    /* AND A SCREEN DRAWN AGAIN WITH NOTHING WRITTEN LEAVES THEM STANDING. */
    await user.type(screen.getByRole('searchbox'), 'Tomić')
    expect(within(balance).getByText(refusedCancel)).toBeInTheDocument()

    /* AND A QUESTION ASKED AND TURNED DOWN IS NOT AN ACTION THAT WENT THROUGH. */
    await user.click(within(balance).getByRole('button', { name: 'Storniraj' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ne' }))
    expect(within(balance).getByText(refusedCancel)).toBeInTheDocument()

    server.stop()
  }, SLOW)

  /**
   * THE OTHER DIRECTION OF THE SAME FAULT: the refusal is the payment's over the exemption and the success
   * is the cancellation beside it. The payment over the exemption is a second `RowPayment` on the row,
   * handed the count by its own line, and a screen that handed it to the first and forgot the second would
   * pass every case above.
   */
  it('takes the refusal of a payment over the exemption away when the exemption is cancelled', async () => {
    const server = serving((_path, init) =>
      init?.method === 'PUT' ? refused('theBasisHasChanged', 409) : Response.json({ season: 2028, basis: null }),
    )
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const exempt = await rowOf(EXEMPT)

    await user.type(within(exempt).getByLabelText('Uplaćeno (RSD)'), '3200')
    await user.click(within(exempt).getByRole('button', { name: 'Upiši uplatu' }))
    expect(await within(exempt).findByText(sr.admin.membershipRefused.theBasisHasChanged)).toBeInTheDocument()

    await user.click(within(exempt).getByRole('button', { name: 'Storniraj' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

    expect(await screen.findByText('Članstvo je stornirano.')).toBeInTheDocument()
    expect(within(exempt).queryByText(sr.admin.membershipRefused.theBasisHasChanged)).toBeNull()

    server.stop()
  }, SLOW)

  /**
   * THE SAME ROW'S OWN NEXT SUCCESS, THROUGH THE CONTROLS THAT CANNOT SEE EACH OTHER'S STATE.
   *
   * <p>A refused payment is gone when the same control's next press goes through, which is the case the
   * finding's mutation survived; a refused payment is gone when a GRANT goes through beside it, which is
   * another control of the same row; and a refused deletion is gone when a payment goes through on its row
   * while the refused deletion beside ANOTHER row stays.
   */
  it('clears a refused payment on its own success and on a grant, and a refused deletion on a payment', async () => {
    let payments = 0
    const server = serving((path, init) => {
      if (init?.method === 'DELETE' && path.startsWith('/api/competitors/')) {
        return answeredWith(404)
      }

      if (path.endsWith('/payment')) {
        payments += 1

        return payments === 1 || payments === 3
          ? refused('theMembershipIsAlreadyHeld', 409)
          : new Response('{}', { status: 201 })
      }

      return Response.json({ season: 2028, basis: 'feeExempt' }, { status: 201 })
    })
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const refusedPayment = sr.verification.activationRefused.theMembershipIsAlreadyHeld
    const refusedDeletion = /Server je odgovorio brojem 404/
    const older = await rowOf(AN_OLDER_SEASON)
    const balance = await rowOf(ON_THE_BALANCE)

    /* A refused payment, then the same control's success. */
    await user.type(within(older).getByLabelText('Uplaćeno (RSD)'), '4800')
    await user.click(within(older).getByRole('button', { name: 'Upiši uplatu' }))
    await within(older).findByText(refusedPayment)

    await user.click(within(older).getByRole('button', { name: 'Upiši uplatu' }))
    expect(await screen.findByText('Uplata je upisana.')).toBeInTheDocument()
    expect(within(older).queryByText(refusedPayment)).toBeNull()

    /* A refused payment, then another control's success on the same row. */
    await user.type(within(older).getByLabelText('Uplaćeno (RSD)'), '4800')
    await user.click(within(older).getByRole('button', { name: 'Upiši uplatu' }))
    await within(older).findByText(refusedPayment)

    await user.click(within(older).getByRole('button', { name: 'Odobri oslobođenje' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))
    expect(await screen.findByText('Oslobođenje je upisano.')).toBeInTheDocument()
    expect(within(older).queryByText(refusedPayment)).toBeNull()

    /* A refused deletion is gone when a payment goes through on ITS row. The screen holds one refused
       deletion at a time, so it is the row pressed last that carries it. */
    async function refuseTheDeletionOf(row: HTMLElement, name: string) {
      await user.click(within(row).getByRole('button', { name: `Obriši: ${name}` }))
      await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${name}` }))
      expect(await within(row).findByText(refusedDeletion)).toBeInTheDocument()
    }

    await refuseTheDeletionOf(older, 'Ivan Jović')
    await user.type(within(older).getByLabelText('Uplaćeno (RSD)'), '4800')
    await user.click(within(older).getByRole('button', { name: 'Upiši uplatu' }))
    await waitFor(() => expect(within(older).queryByText(refusedDeletion)).toBeNull())

    /* ...and stays when the payment goes through on ANOTHER row. */
    await refuseTheDeletionOf(balance, 'Mila Tomić')
    await user.type(within(older).getByLabelText('Uplaćeno (RSD)'), '4800')
    await user.click(within(older).getByRole('button', { name: 'Upiši uplatu' }))
    await waitFor(() => expect(payments).toBe(5))
    expect(within(balance).getByText(refusedDeletion)).toBeInTheDocument()

    server.stop()
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
