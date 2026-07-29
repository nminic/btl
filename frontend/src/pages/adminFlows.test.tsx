import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionContext, type SessionValue, type SubmissionStatus } from '../session/context'
import { renderAt } from '../test/render'
import { Admin } from './admin/Admin'
import { ruleSentence, type BadgeRule } from './admin/badgeRule'
import { ENTITIES } from './admin/entityList'
import { countsFor, QUEUES } from './admin/queues'
import { categoryOf } from '../data/raceCategory'
import { epcPayload, ipsPayload, methodsFor } from '../data/paymentQr'
import type { BtlEvent, Competitor } from '../data/types'

/** A session holding results in the states the panel has to tell apart. */
function sessionWith(states: SubmissionStatus[]): SessionValue {
  return {
    memberNumber: 'M0005',
    signIn: vi.fn(),
    signOut: vi.fn(),
    submissions: states.map((status, index) => ({
      id: `sub-${index}`,
      memberNumber: 'M0005',
      eventName: 'Probna trka',
      date: '2026-05-10',
      distanceKm: 10,
      ascentM: 0,
      descentM: 0,
      startTime: '09:00',
      seconds: 2700,
      points: 12,
      photo: '',
      category: 'short' as const,
      link: 'https://primer.rs/r',
      status,
      note: '',
    })),
    submit: vi.fn(),
    decide: vi.fn(),
    messages: [],
    markRead: vi.fn(),
    notifications: {
      resultApproved: true,
      resultChanged: true,
      upcomingEvent: true,
      newsletter: false,
    },
    setNotification: vi.fn(),
    edits: {},
    edit: vi.fn(),
  }
}

describe('administration is closed to everyone else', () => {
  it.each([
    ['/sr/administracija'],
    ['/sr/administracija/verifikacija'],
    ['/sr/administracija/verifikacija/rezultati'],
    ['/sr/administracija/entiteti'],
    ['/sr/administracija/clanovi'],
    ['/sr/administracija/dogadjaji'],
    ['/sr/administracija/znacke'],
    ['/sr/administracija/cenovnik'],
  ])('turns a competitor away from %s', async (path) => {
    renderAt(path, 'competitor')

    expect(await screen.findByRole('heading', { name: 'Ovo nije za tebe' })).toBeVisible()
  })
})

describe('the panel', () => {
  it('counts what is waiting and leads to every screen', async () => {
    renderAt('/sr/administracija', 'moderator')

    expect(await screen.findByRole('heading', { level: 1, name: 'Administracija' })).toBeVisible()
    expect(screen.getByText('Čeka proveru')).toBeVisible()
    expect(screen.getAllByRole('link', { name: 'Značke' }).length).toBeGreaterThan(0)
  })

  it('counts only what has not been decided yet', async () => {
    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <RoleProvider initialRole="moderator">
            <SessionContext.Provider value={sessionWith(['pending', 'pending', 'approved'])}>
              <Admin />
            </SessionContext.Provider>
          </RoleProvider>
        </MemoryRouter>
      </I18nProvider>,
    )

    const waiting = (await screen.findByText('Čeka proveru')).closest('div')!
    expect(within(waiting).getByText('2')).toBeVisible()
  })
})

describe('members', () => {
  it('is the only place that says on what basis a membership is active', async () => {
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Članovi' })
    expect(within(table).getAllByText('Počasno').length).toBeGreaterThan(0)
  })

  it('searches', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    await user.type(await screen.findByLabelText('Pretraga'), 'M0001')

    expect(within(screen.getByRole('table', { name: 'Članovi' })).getAllByRole('row')).toHaveLength(
      2,
    )
  })
})

describe('events', () => {
  it('opens on what is still ahead, and searches the whole calendar', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Događaji' })
    const ahead = within(table).getAllByRole('row').length

    await user.type(screen.getByLabelText('Pretraga'), 'maraton')

    expect(within(screen.getByRole('table', { name: 'Događaji' })).getAllByRole('row').length)
      .not.toBe(ahead)
  })
})

describe('the price list', () => {
  it('is shown as rows with a period of validity, not as numbers in a screen', async () => {
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Cenovnik' })
    expect(within(table).getByText('2026-10-01')).toBeVisible()
    expect(within(table).getByText('2026-11-30')).toBeVisible()
    // The in-season price buys a profile but no place in the standing.
    expect(within(table).getAllByText('Ne')).toHaveLength(1)
  })
})

describe('the badge rule editor', () => {
  it('builds a rule from closed lists and reads it back as a sentence', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/znacke', 'superadmin')

    expect(await screen.findByText(/broj trka bude najmanje 10/)).toBeVisible()

    await user.selectOptions(screen.getByLabelText('Veličina'), 'totalKm')
    await user.selectOptions(screen.getByLabelText('Uslov'), 'moreThan')

    expect(screen.getByText(/ukupno kilometara bude više od 10/)).toBeVisible()
  })

  it('offers no way to write a condition by hand', async () => {
    renderAt('/sr/administracija/znacke', 'superadmin')

    await screen.findByLabelText('Veličina')
    // A free text box here is the shortest path to running code on the server.
    expect(screen.getByLabelText('Veličina').tagName).toBe('SELECT')
    expect(screen.getByLabelText('Uslov').tagName).toBe('SELECT')
  })
})

describe('ruleSentence', () => {
  const base: BadgeRule = {
    quantity: 'raceCount',
    operator: 'atLeast',
    value: 5,
    from: '',
    to: '',
  }
  const t = (key: string, params?: Record<string, string | number>) =>
    `${key}${params === undefined ? '' : JSON.stringify(params)}`

  it('says a rule with no dates counts every season', () => {
    expect(ruleSentence(base, t)).toContain('badges.everSince')
  })

  it('says a rule with both dates counts between them', () => {
    expect(ruleSentence({ ...base, from: '2027-01-01', to: '2027-12-31' }, t)).toContain(
      'badges.between',
    )
  })

  it('says a rule with one date counts from it, or up to it', () => {
    expect(ruleSentence({ ...base, from: '2027-01-01' }, t)).toContain('badges.after')
    expect(ruleSentence({ ...base, to: '2027-12-31' }, t)).toContain('badges.before')
  })
})

describe('categoryOf', () => {
  it('recognises a marathon and a half by the exact value, with no tolerance', () => {
    expect(categoryOf(42.2)).toBe('marathon')
    expect(categoryOf(21.1)).toBe('half')
    // A hundred metres short of a marathon is a long race, not a marathon.
    expect(categoryOf(42.19)).toBe('long')
    expect(categoryOf(21.09)).toBe('short')
  })

  it('puts everything longer than a marathon into the ultras', () => {
    expect(categoryOf(42.21)).toBe('ultra')
    expect(categoryOf(100)).toBe('ultra')
  })
})

describe('payment payloads', () => {
  it('builds the NBS IPS payload in the order the standard fixes', () => {
    const payload = ipsPayload({
      account: '000000000000000000',
      recipient: 'Sportsko udruzenje BTL',
      amountRsd: 4800,
      purpose: 'Clanarina',
      reference: '',
    })

    expect(payload.startsWith('K:PR|V:01|C:1|')).toBe(true)
    expect(payload).toContain('I:RSD4800,00')
    // No reference means the tag is left out, not sent empty.
    expect(payload).not.toContain('RO:')
  })

  it('carries the reference when there is one', () => {
    const payload = ipsPayload({
      account: '000000000000000000',
      recipient: 'x',
      amountRsd: 100,
      purpose: 'y',
      reference: '97-1234',
    })

    expect(payload).toContain('RO:97-1234')
  })

  it('builds the EPC payload line by line, blank lines included', () => {
    const payload = epcPayload({
      iban: 'RS00000000000000000000',
      bic: 'XXXXRSBG',
      recipient: 'Sportsko udruzenje BTL',
      amountEur: 40,
      purpose: 'Clanarina',
    })
    const lines = payload.split('\n')

    expect(lines[0]).toBe('BCD')
    expect(lines[7]).toBe('EUR40.00')
    // Readers go by position, so the empty lines are load bearing.
    expect(lines).toHaveLength(11)
  })

  it('never offers PayPal to a member in Serbia', () => {
    expect(methodsFor('RS')).toEqual(['ips', 'card'])
    expect(methodsFor('ME')).toContain('paypal')
    // Bosnia is not in SEPA, so PayPal is all there is.
    expect(methodsFor('BA')).toEqual(['paypal'])
  })
})

describe('the badge rule dates', () => {
  it('narrows the rule to a range and back again', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/znacke', 'superadmin')

    await user.type(await screen.findByLabelText('Od datuma'), '2027-01-01')
    expect(screen.getByText(/računato od 2027-01-01, bez kraja/)).toBeVisible()

    await user.type(screen.getByLabelText('Do datuma'), '2027-12-31')
    expect(screen.getByText(/od 2027-01-01 do 2027-12-31/)).toBeVisible()

    await user.clear(screen.getByLabelText('Od datuma'))
    expect(screen.getByText(/računato do 2027-12-31/)).toBeVisible()
  })

  it('takes a value that is typed rather than chosen', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/znacke', 'superadmin')

    const value = await screen.findByLabelText('Vrednost')
    await user.clear(value)
    await user.type(value, '42')

    expect(screen.getByText(/bude najmanje 42/)).toBeVisible()
  })
})

describe('an empty queue', () => {
  it('says so and offers no decisions', async () => {
    renderAt('/sr/administracija/verifikacija/rezultati', 'moderator')

    // Nothing is waiting, so the queue says so and offers no decisions.
    expect(await screen.findByText('Nema nijednog rezultata na čekanju.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Odobri' })).not.toBeInTheDocument()
  })
})

describe('verification', () => {
  it('lists every queue, with the count each one holds', async () => {
    renderAt('/sr/administracija/verifikacija', 'moderator')

    expect(await screen.findByRole('heading', { level: 1, name: 'Verifikacija' })).toBeVisible()

    // Results is the only queue with a screen behind it so far; the rest are
    // listed so the work is visible and countable before the database has it.
    const results = screen.getByRole('link', { name: /Rezultati/ })
    expect(results).toHaveAttribute('href', '/sr/administracija/verifikacija/rezultati')
    expect(within(results).getByText('0')).toBeVisible()
    expect(screen.getAllByText('Radi se')).toHaveLength(QUEUES.length - 1)
  })

  it('leads to the queue of results', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/verifikacija', 'superadmin')

    await user.click(await screen.findByRole('link', { name: /Rezultati/ }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Red za proveru rezultata' }),
    ).toBeVisible()
  })

  it('counts a result from the moment it is sent in', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rezultat/novi', 'superadmin', 'M0005')

    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Probna trka')
    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText(/Vreme starta/), '09:00')
    await user.type(screen.getByLabelText(/Dužina/), '10')
    await user.type(screen.getByLabelText(/Uspon/), '0')
    await user.type(screen.getByLabelText(/Spust/), '0')
    await user.type(screen.getByLabelText('Sati'), '0')
    await user.type(screen.getByLabelText('Minuta'), '45')
    await user.type(screen.getByLabelText('Sekundi'), '0')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/r')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    await user.click(await screen.findByRole('button', { name: 'Administracija' }))
    await user.click(screen.getByRole('link', { name: 'Verifikacija' }))

    const results = await screen.findByRole('link', { name: /Rezultati/ })
    expect(within(results).getByText('1')).toBeVisible()
  })
})

describe('countsFor', () => {
  const competitor = (memberNumber: string, active: boolean) =>
    ({ memberNumber, active }) as Competitor
  const event = (status: BtlEvent['status']) => ({ status }) as BtlEvent

  it('counts what the prototype can already count', () => {
    const counts = countsFor(
      3,
      [competitor('M0001', true), competitor('M0002', false)],
      [event('checking'), event('confirmed'), event('checking')],
    )

    expect(counts.results).toBe(3)
    expect(counts.payments).toBe(1)
    expect(counts.schedule).toBe(2)
  })

  it('reports zero for the queues whose tables do not exist yet', () => {
    const counts = countsFor(0, [], [])

    expect(QUEUES.every((queue) => counts[queue.id] === 0)).toBe(true)
  })
})

describe('the list of entities', () => {
  it('offers every entity administration owns, screen or not', async () => {
    renderAt('/sr/administracija/entiteti', 'superadmin')

    const names = [
      'Članovi',
      'Događaji',
      'Trke',
      'Timovi',
      'Lige',
      'Značke',
      'Cenovnik',
      'Statične strane',
    ]

    expect(await screen.findByRole('heading', { level: 1, name: 'Entiteti' })).toBeVisible()
    expect(names).toHaveLength(ENTITIES.length)

    for (const name of names) {
      expect(screen.getByRole('link', { name })).toBeVisible()
    }

    expect(screen.getByRole('link', { name: 'Članovi' })).toHaveAttribute(
      'href',
      '/sr/administracija/clanovi',
    )
  })

  it('opens an entity that has no screen yet as a placeholder', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/entiteti', 'superadmin')

    await user.click(await screen.findByRole('link', { name: 'Statične strane' }))

    expect(screen.getByText(/Ovaj ekran dolazi u sledećoj fazi/)).toBeVisible()
  })
})
