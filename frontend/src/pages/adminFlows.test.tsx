import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'
import { ruleSentence, type BadgeRule } from './admin/badgeRule'
import { categoryOf } from '../data/raceCategory'
import { epcPayload, ipsPayload, methodsFor } from '../data/paymentQr'

describe('administration is closed to everyone else', () => {
  it.each([
    ['/sr/administracija'],
    ['/sr/administracija/red-za-proveru'],
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
    renderAt('/sr/administracija/red-za-proveru', 'moderator')

    // Nothing is waiting, so the queue says so and offers no decisions.
    expect(await screen.findByText('Nema nijednog rezultata na čekanju.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Odobri' })).not.toBeInTheDocument()
  })
})

describe('the panel counts a waiting result', () => {
  it('rises from zero once something is sent in', async () => {
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

    await user.click(await screen.findByRole('link', { name: 'Administracija' }))

    const counts = (await screen.findByText('Čeka proveru')).closest('div')!
    expect(within(counts).getByText('1')).toBeVisible()
  })
})
