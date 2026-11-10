import { act, configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clearResourceCache } from '../../data/client'
import type { MembershipDue, Outstanding } from '../../data/types'
import sr from '../../i18n/sr.json'
import { moderatorWith, renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { OVER_THE_MEMBERS } from '../profile/whoReadsTheData'
import { QUEUE } from './queues'

/* Every wait of this file is given half of the time a case has (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE ROW OF THE SCREEN UPLATE AS THE OWNER CLEANED IT ON 10.11.2026 (PDL, „Ekran Uplate: izmena podataka
 * pre knjiženja i čišćenje reda"), and the pencil he added to it, in his words: „Obriši kolonu Mesto iz
 * tabele, besmislenu labelu Uplaćeno (RSD) iz svakog reda, reči "uključi balans" nego samo da piše koliki
 * je balans i da ima checkbox pored. Ukoliko su strani takmičari, pisaće EUR umesto RSD na oba mesta.
 * Dodaj ikonicu olovkice kao na redu članova, na poziciji pre štikle na kraju."
 *
 * <p><b>THE AXES, EACH WITH BOTH STATES, and no row the only one of its kind.</b> Two rows hold a member
 * number and two hold none; one row is in euros and three in dinars, and the euro row is neither first
 * nor last; two balances are nought and two are not, and the two currencies' balances differ; the key of
 * a row is never its position, and the key and the member number of a row never spell one another. The
 * readers are the superadmin, a moderator over the members, and a moderator over the payments alone.
 */

const ADDRESS = `/sr/${QUEUE.payments.path}`

const ACCOUNTS: MembershipDue[] = [
  {
    competitorId: 41,
    memberNumber: '',
    firstName: 'Ana',
    lastName: 'Ilić',
    city: 'Novi Sad',
    currency: 'RSD',
    expected: 4800,
    price: 4800,
    balance: 0,
  },
  {
    competitorId: 58,
    memberNumber: '',
    firstName: 'Petar',
    lastName: 'Marko',
    city: 'Ljubljana',
    currency: 'EUR',
    expected: 43,
    price: 40,
    balance: 12.75,
  },
  {
    competitorId: 23,
    memberNumber: '000031',
    firstName: 'Jovana',
    lastName: 'Ilić',
    city: 'Beograd',
    currency: 'RSD',
    expected: 4800,
    price: 4800,
    balance: 6000,
  },
  {
    competitorId: 17,
    memberNumber: '000009',
    firstName: 'Marko',
    lastName: 'Marković',
    city: 'Niš',
    currency: 'RSD',
    expected: 4800,
    price: 4800,
    balance: 0,
  },
]

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function serving(): Asked[] {
  clearResourceCache()

  const answer: Outstanding = { season: 2031, accounts: ACCOUNTS }
  const { asked, stop } = serverThat((path, init) =>
    path === '/api/payments' && (init?.method ?? 'GET') === 'GET' ? json(answer) : null,
  )

  stops.push(stop)

  return asked
}

async function rowOf(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name)
  const row = cell.closest('tr')

  if (row === null) {
    throw new Error(`no row holds ${name}`)
  }

  return row
}

describe('the row, cleaned', () => {
  it('has no column Mesto and draws no town anywhere', async () => {
    serving()
    renderAt(ADDRESS, 'superadmin')

    const table = await screen.findByRole('table', { name: sr.verification.payments })
    const headings = within(table).getAllByRole('columnheader').map((one) => one.textContent)

    expect(headings).not.toContain(sr.competitors.columns.city)
    expect(headings).toContain(sr.verification.paid)

    for (const town of ['Novi Sad', 'Ljubljana', 'Beograd', 'Niš']) {
      expect(within(table).queryByText(town)).toBeNull()
    }

    /* Five columns now: the member, the amount expected, what was paid, the balance, the actions. */
    expect(headings).toHaveLength(5)
    expect(within(await rowOf('Ana Ilić')).getAllByRole('cell')).toHaveLength(5)
  }, SLOW)

  it('says „Uplaćeno (RSD)" to nobody who sees it, and still names the field by it, in his own money', async () => {
    serving()
    renderAt(ADDRESS, 'superadmin')

    const ana = await rowOf('Ana Ilić')
    const petar = await rowOf('Petar Marko')

    /* SEEN: no label in the row. The heading over the column says „Uplaćeno" once. */
    for (const row of [ana, petar]) {
      const label = row.querySelector('label[for^="paid-"]')

      expect(label).not.toBeNull()
      expect(label).toHaveClass('visually-hidden')
    }

    /* NAMED, and in HIS money: the euro row's field is not named in dinars, nor the other way round. */
    expect(within(ana).getByRole('textbox', { name: 'Uplaćeno (RSD)' })).toBeInTheDocument()
    expect(within(petar).getByRole('textbox', { name: 'Uplaćeno (EUR)' })).toBeInTheDocument()
    expect(within(petar).queryByRole('textbox', { name: 'Uplaćeno (RSD)' })).toBeNull()

    /* AND THE MARK BESIDE THE FIELD IS HIS MONEY, the first of the owner's „oba mesta". */
    expect(ana.querySelector('.activate__mark')?.textContent).toBe('RSD')
    expect(petar.querySelector('.activate__mark')?.textContent).toBe('EUR')
  }, SLOW)

  it('shows the balance alone beside the box, in his money, and the box keeps its whole name', async () => {
    serving()
    renderAt(ADDRESS, 'superadmin')

    const petar = await rowOf('Petar Marko')
    const jovana = await rowOf('Jovana Ilić')
    const marko = await rowOf('Marko Marković')

    /* WHAT IS SEEN is the amount and the currency, the second of the owner's „oba mesta", and no word. */
    const seen = (row: HTMLElement) => row.querySelector('label.activate__balance')?.textContent

    expect(seen(petar)).toBe('12,75 EUR')
    expect(seen(jovana)).toBe('6.000 RSD')
    expect(seen(marko)).toBe('0 RSD')

    /* AND THE BOX IS NAMED BY THE WHOLE SENTENCE, which holds what is seen (WCAG 2.2 AA 2.5.3). */
    expect(within(petar).getByRole('checkbox', { name: 'uključi balans (12,75 EUR)' })).toBeChecked()
    expect(within(jovana).getByRole('checkbox', { name: 'uključi balans (6.000 RSD)' })).toBeChecked()
  }, SLOW)
})

describe('the pencil', () => {
  it('stands before the tick, named for the man, and leads by the key where there is no number', async () => {
    serving()
    renderAt(ADDRESS, 'superadmin')

    const ana = await rowOf('Ana Ilić')
    const petar = await rowOf('Petar Marko')
    const jovana = await rowOf('Jovana Ilić')

    const pencil = within(ana).getByRole('link', { name: 'Izmeni podatke: Ana Ilić' })
    const tick = within(ana).getByRole('button', { name: sr.verification.activate })

    /* BEFORE THE TICK, in the same cell, and neither holding the other. */
    expect(pencil.closest('td')).toBe(tick.closest('td'))
    expect(pencil.contains(tick) || tick.contains(pencil)).toBe(false)
    expect(pencil.compareDocumentPosition(tick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    /* BY HIS OWN KEY, and the next row without a number by its own: neither is the first row's. */
    expect(pencil).toHaveAttribute('href', '/sr/administracija/podaci-clana/41')
    expect(within(petar).getByRole('link', { name: 'Izmeni podatke: Petar Marko' })).toHaveAttribute(
      'href',
      '/sr/administracija/podaci-clana/58',
    )

    /* BY THE NUMBER where there is one, the road the row of the members takes, never by the key. */
    expect(within(jovana).getByRole('link', { name: 'Izmeni podatke: Jovana Ilić' })).toHaveAttribute(
      'href',
      '/sr/takmicar/000031/podaci',
    )
  }, SLOW)

  it('is drawn for a moderator over the members, and not for one over the payments alone', async () => {
    serving()

    const members = renderAt(ADDRESS, 'moderator', null, moderatorWith(['queue:payments', OVER_THE_MEMBERS]))

    expect(within(await rowOf('Ana Ilić')).getByRole('link', { name: 'Izmeni podatke: Ana Ilić' })).toBeVisible()
    members.unmount()

    serving()
    renderAt(ADDRESS, 'moderator', null, moderatorWith(['queue:payments']))

    const ana = await rowOf('Ana Ilić')

    /* The row is there and can be booked; only the pencil is not. */
    expect(within(ana).getByRole('button', { name: sr.verification.activate })).toBeInTheDocument()
    expect(screen.queryAllByRole('link', { name: /^Izmeni podatke/ })).toHaveLength(0)
  }, SLOW)
})

describe('the form it opens for somebody with no number', () => {
  const PETAR = {
    memberNumber: null,
    firstName: 'Petar',
    lastName: 'Marko',
    fatherName: 'Jovan',
    gender: 'M',
    birthDate: '1990-05-15',
    idNumber: 'AB123',
    email: 'petar@primer.rs',
    emailConfirmed: false,
    address: 'Ulica 1',
    phone: '060111222',
    placeId: null,
    city: 'Ljubljana',
    country: 'SI',
    shirtSize: 'M',
    bio: null,
    photo: null,
    crop: null,
  }

  /** A server of his data at his key, and of somebody else's at another key, so a read of the wrong key shows. */
  function hisServer(): Asked[] {
    let held: Record<string, unknown> = PETAR
    const { asked, stop } = serverThat((path, init) => {
      if (path === '/api/members/unnumbered/41/data') {
        return json({ ...PETAR, firstName: 'Ana', lastName: 'Ilić' })
      }

      if (path !== '/api/members/unnumbered/58/data') {
        return null
      }

      if (init?.method === 'PUT') {
        held = { ...held, ...JSON.parse(String(init.body)) }
      }

      return json(held)
    })

    stops.push(stop)

    return asked
  }

  it('is the form of the card „Podaci", filled with his data, and saves to his key', async () => {
    const asked = hisServer()
    const user = setupUser()

    renderAt('/sr/administracija/podaci-clana/58', 'superadmin')

    expect(await screen.findByRole('heading', { level: 1, name: sr.profile.parts.data })).toBeVisible()

    const first = await screen.findByRole('textbox', { name: /^Ime(?! oca)/ })

    expect(first).toHaveValue('Petar')
    expect(screen.queryByLabelText(/lozink/i)).toBeNull()

    await user.clear(first)
    await user.type(first, 'Pera')
    await user.click(screen.getByRole('button', { name: sr.account.save }))

    expect(await screen.findByText(sr.account.saved)).toBeVisible()

    const puts = asked.filter((one) => one.init?.method === 'PUT')

    expect(puts.map((one) => one.path)).toEqual(['/api/members/unnumbered/58/data'])
    expect(JSON.parse(String(puts[0]?.init?.body))).toEqual({ firstName: 'Pera' })
    expect(asked.some((one) => one.path === '/api/members/unnumbered/41/data')).toBe(false)
  }, SLOW)

  it('is not there for a moderator over the payments alone', async () => {
    const asked = hisServer()
    const { router } = renderAt('/sr/administracija/podaci-clana/58', 'moderator', null, moderatorWith(['queue:payments']))

    await waitFor(() => expect(router.state.location.pathname).not.toBe('/sr/administracija/podaci-clana/58'))
    expect(asked.some((one) => one.path.startsWith('/api/members/unnumbered/'))).toBe(false)
  }, SLOW)

  /* An address the portal does not have sends the reader to the front page (`NotFound.tsx`). */
  it('is a page that is not there for a key spelt any other way, and asks the server nothing', async () => {
    const asked = hisServer()

    for (const key of ['058', '58a', '0', '-58']) {
      const page = renderAt(`/sr/administracija/podaci-clana/${key}`, 'superadmin')

      await waitFor(() => expect(page.router.state.location.pathname).toBe('/sr'))
      page.unmount()
    }

    expect(asked.some((one) => one.path.startsWith('/api/members/'))).toBe(false)
  }, SLOW)
})

/**
 * BACK ON UPLATE AFTER A CORRECTION, THE ROW IS READ AGAIN (review of PR 712, VISOK 1). The list is kept for
 * the whole visit (`data/client.ts`), so a save through the pencil that does not drop it leaves the row
 * with the old name and, after a change of country, the old money in both places the owner named.
 *
 * <p><b>The server is the only source of the new row</b>: the name and the currency of the second list are
 * what the server answers once the save has reached it, and the form never sends a currency. So the row can
 * only show them by asking again, and a second `GET /api/payments` is counted, not assumed. The other row
 * stays as it was, so a list read again cannot pass for one rebuilt by the screen.
 */
describe('back on Uplate after a correction through the pencil', () => {
  /**
   * A server of the list and of one member's data at `address`: once that member is saved, the list names
   * him `Pera` and bills him in the other money, as a corrected name and a corrected country would.
   */
  function servingACorrection(competitorId: number, address: string, before: 'RSD' | 'EUR'): Asked[] {
    clearResourceCache()

    let saved = false
    const after = before === 'EUR' ? 'RSD' : 'EUR'
    const { asked, stop } = serverThat((path, init) => {
      if (path === '/api/payments' && (init?.method ?? 'GET') === 'GET') {
        const accounts = ACCOUNTS.map((one) =>
          one.competitorId !== competitorId || !saved
            ? one
            : { ...one, firstName: 'Pera', currency: after, expected: after === 'EUR' ? 43 : 4800 },
        )

        return json({ season: 2031, accounts })
      }

      if (path === address) {
        if (init?.method === 'PUT') {
          saved = true
        }

        const one = ACCOUNTS.find((row) => row.competitorId === competitorId)

        return json({
          memberNumber: one?.memberNumber === '' ? null : one?.memberNumber,
          firstName: saved ? 'Pera' : one?.firstName,
          lastName: one?.lastName,
          fatherName: 'Jovan',
          gender: 'M',
          birthDate: '1990-05-15',
          idNumber: 'AB123',
          email: 'clan@primer.rs',
          emailConfirmed: false,
          address: 'Ulica 1',
          phone: '060111222',
          placeId: null,
          city: 'Beograd',
          country: 'RS',
          shirtSize: 'M',
          bio: null,
          photo: null,
          crop: null,
        })
      }

      return null
    })

    stops.push(stop)

    return asked
  }

  const listReads = (asked: Asked[]) =>
    asked.filter((one) => one.path === '/api/payments' && (one.init?.method ?? 'GET') === 'GET').length

  async function correctedThroughThePencil(name: string, router: { navigate: (to: number) => Promise<void> }) {
    const user = setupUser()

    await user.click(await screen.findByRole('link', { name: `Izmeni podatke: ${name}` }))

    const box = await screen.findByRole('textbox', { name: /^Ime(?! oca)/ })

    await user.clear(box)
    await user.type(box, 'Pera')
    await user.click(screen.getByRole('button', { name: sr.account.save }))

    expect(await screen.findByText(sr.account.saved)).toBeVisible()

    await act(async () => {
      await router.navigate(-1)
    })

    /* THE LIST IS DRAWN, AND ONLY THEN COUNTED: a list kept from before is drawn at once with one read
       behind it, so this fails on the count and not on a wait for a name that never comes. */
    await screen.findByRole('table', { name: sr.verification.payments })
  }

  it('reads the list again for somebody with no number, with his new name and his new money', async () => {
    const asked = servingACorrection(58, '/api/members/unnumbered/58/data', 'EUR')
    const { router } = renderAt(ADDRESS, 'superadmin')

    expect(within(await rowOf('Petar Marko')).getByRole('textbox', { name: 'Uplaćeno (EUR)' })).toBeInTheDocument()

    await correctedThroughThePencil('Petar Marko', router)

    expect(listReads(asked)).toBe(2)

    const pera = await rowOf('Pera Marko')

    expect(pera.querySelector('.activate__mark')?.textContent).toBe('RSD')
    expect(pera.querySelector('label.activate__balance')?.textContent).toBe('12,75 RSD')
    expect(within(pera).getByRole('textbox', { name: 'Uplaćeno (RSD)' })).toBeInTheDocument()
    expect(screen.queryByText('Petar Marko')).toBeNull()
    expect((await rowOf('Ana Ilić')).querySelector('.activate__mark')?.textContent).toBe('RSD')
  }, SLOW)

  it('reads the list again for a member with a number, opened at his card', async () => {
    const asked = servingACorrection(23, '/api/members/000031/data', 'RSD')
    const { router } = renderAt(ADDRESS, 'superadmin')

    expect(within(await rowOf('Jovana Ilić')).getByRole('textbox', { name: 'Uplaćeno (RSD)' })).toBeInTheDocument()

    await correctedThroughThePencil('Jovana Ilić', router)

    expect(listReads(asked)).toBe(2)

    const pera = await rowOf('Pera Ilić')

    expect(pera.querySelector('.activate__mark')?.textContent).toBe('EUR')
    expect(pera.querySelector('label.activate__balance')?.textContent).toBe('6.000 EUR')
    expect(screen.queryByText('Jovana Ilić')).toBeNull()
  }, SLOW)
})
