import { configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { arrivedResource, clearResourceCache, loadResource } from '../../data/client'
import type { Competitor, Member } from '../../data/types'
import { asMember, person } from '../../test/plate'
import { renderAt } from '../../test/render'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'

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

describe('recording a payment on a member’s row', () => {
  const HOLDS_IT = '000002'
  const IN_DINARS = '000004'
  const IN_EURO = '000006'

  const COMPETITORS: Competitor[] = [
    person(HOLDS_IT, 'Ana', 'Držić'),
    person(IN_DINARS, 'Zoran', 'Vuković', { city: 'Niš' }),
    person(IN_EURO, 'Mila', 'Tomić', { city: 'Podgorica', country: 'ME' }),
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

  /** By the member number drawn under the name, which is one text node where the name is two. */
  async function rowOf(memberNumber: string): Promise<HTMLElement> {
    const table = await screen.findByRole('table', { name: 'Članovi' })

    return must(within(table).getByText(memberNumber).closest('tr'), `the row of ${memberNumber}`)
  }

  it('is offered only on a row that holds no season on sale, in that member’s own money', async () => {
    const server = serving()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    expect(within(await rowOf(HOLDS_IT)).queryByRole('button', { name: 'Upiši uplatu' })).toBeNull()
    expect(within(await rowOf(IN_DINARS)).getByLabelText('Uplaćeno (RSD)')).toBeInTheDocument()
    expect(within(await rowOf(IN_EURO)).getByLabelText('Uplaćeno (EUR)')).toBeInTheDocument()

    server.stop()
  })

  it('sends what arrived to that member’s own address, and asks nothing when his book covers the rest', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_DINARS)

    /* 3.200 of 4.200 with a book of 1.000: case 2, which goes straight through. */
    await user.type(within(row).getByLabelText('Uplaćeno (RSD)'), '3200')
    await user.click(within(row).getByRole('button', { name: 'Upiši uplatu' }))

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
    await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '30')
    await user.click(within(row).getByRole('button', { name: 'Upiši uplatu' }))

    const question = await screen.findByRole('dialog', { name: 'Prihvatam umanjen ukupan iznos?' })

    expect(within(question).getByText('Mila Tomić, sezona 2028.')).toBeInTheDocument()
    expect(within(question).getByText('Očekivan iznos: 38 EUR')).toBeInTheDocument()
    expect(within(question).getByText('Nedostaje: 6 EUR')).toBeInTheDocument()

    await user.click(within(question).getByRole('button', { name: 'Ne' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(server.asked)).toEqual([])

    await user.click(within(row).getByRole('button', { name: 'Upiši uplatu' }))
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

  it('sends nothing for a nought or for what it cannot read, and says why beside the field', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_DINARS)
    const field = within(row).getByLabelText('Uplaćeno (RSD)')
    const button = within(row).getByRole('button', { name: 'Upiši uplatu' })

    expect(button).toBeDisabled()

    await user.type(field, '0')

    expect(button).toBeDisabled()
    expect(field).toHaveAccessibleDescription(
      'Iznos uplate mora da bude veći od nule, pa uplata nije proknjižena i članstvo nije upisano.',
    )

    await user.clear(field)
    await user.type(field, '4.200')

    expect(button).toBeDisabled()
    expect(field).toHaveAccessibleDescription('Iznos unesi samo ciframa, bez tačaka i zareza.')
    expect(sent(server.asked)).toEqual([])

    server.stop()
  }, SLOW)

  it('says beside the row why the server refused it, and asks nothing again', async () => {
    const server = serving(() => refused('theMembershipIsAlreadyHeld', 409))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(IN_DINARS)

    await user.type(within(row).getByLabelText('Uplaćeno (RSD)'), '4200')
    await user.click(within(row).getByRole('button', { name: 'Upiši uplatu' }))

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

    const row = await rowOf(IN_DINARS)

    await user.type(within(row).getByLabelText('Uplaćeno (RSD)'), '4200')

    const button = within(row).getByRole('button', { name: 'Upiši uplatu' })

    await user.click(button)
    await user.click(button)
    await user.click(button)

    expect(sent(server.asked)).toHaveLength(1)

    answer(new Response('{}', { status: 201 }))

    await waitFor(() => expect(reads(server.asked, '/api/members')).toBe(2))
    expect(sent(server.asked)).toHaveLength(1)

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

    await user.type(within(row).getByLabelText('Uplaćeno (RSD)'), '4200')
    await user.click(within(row).getByRole('button', { name: 'Upiši uplatu' }))

    await waitFor(() => expect(reads(server.asked, '/api/members')).toBe(2))
    expect(reads(server.asked, '/api/competitors')).toBe(2)
    expect(arrivedResource('payments')).toBeUndefined()
    expect(arrivedResource('inbox')).toBeUndefined()
    expect(await screen.findByText('Uplata je upisana.')).toBeInTheDocument()

    server.stop()
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
