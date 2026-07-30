import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PageMetaContext } from '../app/pageMetaContext'
import { I18nProvider } from '../i18n/I18nProvider'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionContext, type SessionValue, type SubmissionStatus } from '../session/context'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { Admin } from './admin/Admin'
import { ruleSentence, type BadgeRule } from './admin/badgeRule'
import { ENTITIES } from './admin/entityList'
import { paymentKey, type PendingItem, type PendingQueueId } from './admin/pending'
import { countsFor, QUEUE, QUEUES } from './admin/queues'
import { ReviewQueue } from './admin/ReviewQueue'
import { categoryOf } from '../data/raceCategory'
import { epcPayload, ipsPayload, methodsFor } from '../data/paymentQr'
import type { Competitor } from '../data/types'

/** A session holding results in the states the panel has to tell apart. */
function sessionWith(states: SubmissionStatus[]): SessionValue {
  return {
    memberNumber: '000007',
    signIn: vi.fn(),
    signOut: vi.fn(),
    submissions: states.map((status, index) => ({
      id: `sub-${index}`,
      memberNumber: '000007',
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
    editRecord: vi.fn(),
    creations: {},
    create: vi.fn(),
    decisions: {},
    settle: vi.fn(),
  }
}

describe('administration is closed to everyone else', () => {
  it.each([
    ['/sr/administracija'],
    ['/sr/administracija/verifikacija'],
    ['/sr/administracija/entiteti'],
    ['/sr/administracija/clanovi'],
    ['/sr/administracija/dogadjaji'],
    ['/sr/administracija/znacke'],
    ['/sr/administracija/cenovnik'],
    // Every one of the eight queues, so a screen cannot be added to the list
    // without the door on it. Granular moderator rights (PDL P21) are not
    // invented here: staff may open all eight, everybody else none.
    ...QUEUES.map((queue) => [`/sr/${queue.path}`]),
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

  it('counts everything that is waiting, not results alone', async () => {
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
    /* Two results are waiting, three memberships, and fourteen items in the six
       queues read from the file. The tile counted the two while the navigation
       counted the lot, which is two numbers disagreeing on one screen. The sum
       is exact because the data is fixed: an "at least" here would survive the
       counter losing a whole queue. */
    expect(within(waiting).getByRole('definition')).toHaveTextContent('19')
  })
})

describe('members', () => {
  it('is the only place that says on what basis a membership is active', async () => {
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Članovi' })
    expect(within(table).getAllByText('Počasno').length).toBeGreaterThan(0)
  })

  it('searches', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    await user.type(await screen.findByLabelText('Pretraga'), '000001')

    expect(within(screen.getByRole('table', { name: 'Članovi' })).getAllByRole('row')).toHaveLength(
      2,
    )
  })
})

describe('events', () => {
  it('opens on what is still ahead, and searches the whole calendar', async () => {
    const user = setupUser()
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
    const user = setupUser()
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
    const user = setupUser()
    renderAt('/sr/administracija/znacke', 'superadmin')

    await user.type(await screen.findByLabelText('Od datuma'), '2027-01-01')
    expect(screen.getByText(/računato od 2027-01-01, bez kraja/)).toBeVisible()

    await user.type(screen.getByLabelText('Do datuma'), '2027-12-31')
    expect(screen.getByText(/od 2027-01-01 do 2027-12-31/)).toBeVisible()

    await user.clear(screen.getByLabelText('Od datuma'))
    expect(screen.getByText(/računato do 2027-12-31/)).toBeVisible()
  })

  it('takes a value that is typed rather than chosen', async () => {
    const user = setupUser()
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

describe('the queue of results', () => {
  const openWith = (states: SubmissionStatus[]) => {
    const user = setupUser()
    const session = sessionWith(states)

    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          {/* The screen names the browser tab after its own queue, and outside the
              shell there is nothing listening (src/app/PageMeta.tsx). */}
          <PageMetaContext.Provider value={vi.fn()}>
            <RoleProvider initialRole="moderator">
              <SessionContext.Provider value={session}>
                <ReviewQueue />
              </SessionContext.Provider>
            </RoleProvider>
          </PageMetaContext.Provider>
        </MemoryRouter>
      </I18nProvider>,
    )

    return { user, session }
  }

  it('takes no reason made of spaces, and writes down the one it takes trimmed', async () => {
    const { user, session } = openWith(['pending'])

    await user.click(screen.getByRole('button', { name: 'Vrati na doradu' }))

    const confirm = screen.getByRole('button', { name: 'Vrati uz ovaj razlog' })
    const reason = screen.getByLabelText('Razlog vraćanja')

    await user.type(reason, '   ')
    expect(confirm).toBeDisabled()
    expect(session.decide).not.toHaveBeenCalled()

    await user.type(reason, 'Vreme se ne poklapa sa zvaničnom listom.  ')
    await user.click(confirm)

    expect(session.decide).toHaveBeenCalledWith(
      'sub-0',
      'rejected',
      'Vreme se ne poklapa sa zvaničnom listom.',
    )
  })

  it('shuts the reason box when the same result is approved from its row', async () => {
    const { user } = openWith(['pending'])

    await user.click(screen.getByRole('button', { name: 'Vrati na doradu' }))
    expect(screen.getByLabelText('Razlog vraćanja')).toBeInTheDocument()

    /* The box stands below the table, so it used to survive the decision taken by
       the buttons in the row: confirming it afterwards refused a result that had
       just been approved, without a word. */
    await user.click(screen.getByRole('button', { name: 'Odobri' }))

    expect(screen.queryByLabelText('Razlog vraćanja')).not.toBeInTheDocument()
  })
})

describe('verification', () => {
  it('lists every queue, with the count each one holds and the screen behind it', async () => {
    renderAt('/sr/administracija/verifikacija', 'moderator')

    expect(await screen.findByRole('heading', { level: 1, name: 'Verifikacija' })).toBeVisible()

    /* Every one of the eight leads somewhere now: a queue nobody can open is a
       list of complaints rather than a place of work. The rows are in the order
       of QUEUES, so the addresses can be checked against it one by one. */
    const rows = within(screen.getByRole('main')).getAllByRole('listitem')
    expect(rows).toHaveLength(QUEUES.length)

    rows.forEach((row, index) => {
      expect(within(row).getByRole('link')).toHaveAttribute('href', `/sr/${QUEUES[index].path}`)
    })

    const results = screen.getByRole('link', { name: /Rezultati/ })
    expect(within(results).getByText('0')).toBeVisible()
  })

  it('leads to the queue of results', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/verifikacija', 'superadmin')

    await user.click(await screen.findByRole('link', { name: /Rezultati/ }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Red za proveru rezultata' }),
    ).toBeVisible()
  })

  it('counts a result from the moment it is sent in', async () => {
    const user = setupUser()
    renderAt('/sr/rezultat/novi', 'superadmin', '000007')

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

    /* The navigation carries the sum of everything waiting (PDL P28a), and it
       says so in the name of the link rather than only in the badge, so a screen
       reader hears the number too. The sum is every queue at once, so the one
       result is checked on its own row. */
    const verification = await screen.findByRole('link', {
      name: /Verifikacija, \d+ na čekanju/,
    })
    await user.click(verification)

    const results = await screen.findByRole('link', { name: /Rezultati/ })
    expect(within(results).getByText('1')).toBeVisible()
  })

  it('counts no more beside a queue than the screen behind it can show', async () => {
    const user = setupUser()
    const served = globalThis.fetch
    /* A date whose freshness clock has run out is under check as well (PDL P10),
       and the calendar used to be counted towards this queue for it. The screen
       behind the row reads the reports somebody sent in and nothing else, so the
       row said four, the screen showed three, and the fourth was a piece of work
       nobody could do. */
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/events.json')
        ? new Response(JSON.stringify([{ id: 'e1', status: 'checking', date: '2027-04-01' }]), {
            status: 200,
          })
        : served(input)) as typeof fetch

    try {
      renderAt('/sr/administracija/verifikacija', 'moderator')

      const row = await screen.findByRole('link', { name: /Prijave promene termina/ })
      const counted = Number(within(row).getByText(/^\d+$/).textContent)

      await user.click(row)
      await screen.findByRole('heading', { level: 1, name: 'Prijave promene termina' })

      expect(
        screen.getByRole('heading', { level: 2, name: `Čeka proveru ${counted}` }),
      ).toBeVisible()
      expect(screen.getAllByRole('button', { name: 'Odobri' })).toHaveLength(counted)
    } finally {
      globalThis.fetch = served
    }
  })

  it('keeps the rows a broken file has nothing to do with', async () => {
    const served = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/verification.json')
        ? new Response('nema', { status: 500 })
        : served(input)) as typeof fetch

    try {
      renderAt('/sr/administracija/verifikacija', 'moderator')

      /* The file feeds six of the eight rows. Results come from the session and
         memberships from the list of members, so a failure on it used to take
         down two rows that never touched it, and the whole screen with them. The
         header treats the same failure the other way round (src/app/Shell.tsx),
         and this now matches it. */
      const memberships = await screen.findByRole('link', {
        name: /Uplate i aktivacija članova/,
      })
      expect(within(memberships).getByText('3')).toBeVisible()
      expect(screen.getByRole('link', { name: /Rezultati/ })).toBeVisible()

      // What a failure must not do is pass for an empty queue without a word.
      expect(await screen.findByRole('alert')).toHaveTextContent(/nije dostupan/)
    } finally {
      globalThis.fetch = served
    }
  })

  it('gives every queue its own name in the browser tab', async () => {
    const user = setupUser()
    renderAt(`/sr/${QUEUE.payments.path}`, 'moderator')

    /* Eight addresses used to share one name, so eight tabs, eight history
       entries and eight bookmarks read the same (ADL A7). */
    await waitFor(() =>
      expect(document.title).toContain('Uplate i aktivacija članova (administracija)'),
    )

    await user.click(screen.getByRole('button', { name: 'Administracija' }))
    await user.click(screen.getByRole('link', { name: /Verifikacija/ }))
    await user.click(await screen.findByRole('link', { name: /Rezultati/ }))

    await waitFor(() => expect(document.title).toContain('Rezultati (administracija)'))
  })

  it('says nothing beside Verification while nothing is waiting', async () => {
    const user = setupUser()
    const served = globalThis.fetch
    // An empty league has nothing to approve, and a zero beside a name is noise.
    vi.stubGlobal('fetch', async () => new Response('[]', { status: 200 }))

    try {
      renderAt('/sr/prijava', 'moderator', '000007')

      await user.click(await screen.findByRole('button', { name: 'Administracija' }))

      expect(screen.getByRole('link', { name: 'Verifikacija' })).toBeVisible()
    } finally {
      vi.stubGlobal('fetch', served)
    }
  })
})

/* The seven queues that had no screen at all. Each one is the same piece of
 * work: read what somebody sent in, and either let it out onto the portal or send
 * it back saying why. */
describe('the queue of memberships waiting to be activated', () => {
  const openPayments = async () => {
    const user = setupUser()
    renderAt(`/sr/${QUEUE.payments.path}`, 'moderator')
    await screen.findByRole('heading', { level: 1, name: 'Uplate i aktivacija članova' })

    return user
  }

  it('holds the members who opened an account and are not active yet', async () => {
    await openPayments()

    const table = screen.getByRole('table', { name: 'Uplate i aktivacija članova' })
    // Three of them are generated, and they are the only ones not active.
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()
  })

  it('activates on a recorded payment, and on honorary membership', async () => {
    const user = await openPayments()

    await user.click(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })[0])
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()

    await user.click(screen.getAllByRole('button', { name: 'Počasno članstvo' })[0])
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 1' })).toBeVisible()

    /* Both grounds exist because the fortnight before registration opens is
       spent entering earlier competitors, and their 2027 fee is waived (PDL P8).
       The ground is a fact about money and never leaves administration. */
    const decided = screen.getByRole('table', { name: 'Rešeno' })
    expect(within(decided).getByText('Uplata')).toBeVisible()
    expect(within(decided).getByText('Počasno')).toBeVisible()
  })

  it('will not send a membership back without a reason', async () => {
    const user = await openPayments()

    await user.click(screen.getAllByRole('button', { name: 'Vrati na doradu' })[0])

    const confirm = screen.getByRole('button', { name: 'Vrati uz ovaj razlog' })
    expect(confirm).toBeDisabled()
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()

    await user.type(screen.getByLabelText('Razlog vraćanja'), 'Uplata nije vidljiva na izvodu.')
    await user.click(confirm)

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()
    expect(
      within(screen.getByRole('table', { name: 'Rešeno' })).getByText(
        'Uplata nije vidljiva na izvodu.',
      ),
    ).toBeVisible()
  })

  it('does not take spaces for a reason', async () => {
    const user = await openPayments()

    await user.click(screen.getAllByRole('button', { name: 'Vrati na doradu' })[0])

    const confirm = screen.getByRole('button', { name: 'Vrati uz ovaj razlog' })
    /* Three spaces are not a reason. The rule is one rule on all seven queues,
       and it is the rule the forms already use (src/forms/validate.ts). */
    await user.type(screen.getByLabelText('Razlog vraćanja'), '   ')
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText('Razlog vraćanja'), 'Izvod ne pokazuje uplatu.   ')
    await user.click(confirm)

    // And what is written down has no spaces hanging off it either.
    expect(
      within(screen.getByRole('table', { name: 'Rešeno' })).getByText('Izvod ne pokazuje uplatu.'),
    ).toBeVisible()
  })

  it('says whose membership is being refused, and forgets it once it is settled', async () => {
    const user = await openPayments()

    const rows = within(screen.getByRole('table', { name: 'Uplate i aktivacija članova' }))
      .getAllByRole('row')
      .slice(1)
    const number = within(rows[0]).getByText(/^\d{6}$/).textContent!

    await user.click(within(rows[0]).getByRole('button', { name: 'Vrati na doradu' }))

    /* The box hangs below the table, so on a list of twenty there is nothing on
       screen that says whose membership it decides unless it says so itself. */
    const box = screen.getByRole('group', { name: /Vraćanje na doradu/ })
    expect(box).toHaveAccessibleName(new RegExp(`Vraćanje na doradu: .+\\(${number}\\)`))
    expect(within(box).getByText(new RegExp(number))).toBeVisible()
    // And the field it opens on has the focus, not the document body.
    expect(screen.getByLabelText('Razlog vraćanja')).toHaveFocus()

    /* The row is decided by the buttons beside it while the box is open. Before,
       the box stayed open over a member who was already active, and confirming it
       replaced the activation with a refusal, quietly, and the ground of the
       membership went with it. */
    await user.click(within(rows[0]).getByRole('button', { name: 'Evidentiraj uplatu' }))

    expect(screen.queryByLabelText('Razlog vraćanja')).not.toBeInTheDocument()
    const decided = within(screen.getByRole('table', { name: 'Rešeno' }))
    expect(decided.getByText('Odobreno')).toBeVisible()
    expect(decided.getByText('Uplata')).toBeVisible()
    expect(decided.queryByText('Vraćeno')).not.toBeInTheDocument()
  })

  it('closes the reason without deciding anything', async () => {
    const user = await openPayments()

    await user.click(screen.getAllByRole('button', { name: 'Vrati na doradu' })[0])
    await user.click(screen.getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByLabelText('Razlog vraćanja')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()
  })

  it('says so once every membership has been decided', async () => {
    const user = await openPayments()

    // Three are waiting, and the row of whoever is decided leaves the table, so
    // the first button is a different member every time.
    await user.click(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })[0])

    expect(screen.getByText('Nema nijedne stavke na čekanju.')).toBeVisible()
    expect(
      within(screen.getByRole('table', { name: 'Rešeno' })).getAllByRole('row'),
    ).toHaveLength(4)
  })
})

describe('the six queues read from the file', () => {
  const open = async (queue: PendingQueueId, title: string) => {
    const user = setupUser()
    renderAt(`/sr/${QUEUE[queue].path}`, 'moderator')
    await screen.findByRole('heading', { level: 1, name: title })

    return user
  }

  it.each([
    ['leagues', 'Predložene lige', 2],
    ['teams', 'Novi timovi', 2],
    ['bios', 'Trkačke biografije', 2],
    ['photos', 'Profilne slike', 2],
    ['comments', 'Komentari', 3],
    ['schedule', 'Prijave promene termina', 3],
  ] as [PendingQueueId, string, number][])(
    'has something waiting in %s, and decides it both ways',
    async (queue, title, waiting) => {
      const user = await open(queue, title)

      // A queue with no data cannot be reviewed at all, so every one of the six
      // is generated with items in it.
      expect(
        screen.getByRole('heading', { level: 2, name: `Čeka proveru ${waiting}` }),
      ).toBeVisible()
      expect(screen.getAllByRole('button', { name: 'Odobri' })).toHaveLength(waiting)
      expect(screen.getAllByRole('button', { name: 'Vrati na doradu' })).toHaveLength(waiting)

      // The rule is the same on every queue: no reason, no sending back.
      await user.click(screen.getAllByRole('button', { name: 'Vrati na doradu' })[0])
      expect(screen.getByRole('button', { name: 'Vrati uz ovaj razlog' })).toBeDisabled()
      expect(
        screen.getByRole('heading', { level: 2, name: `Čeka proveru ${waiting}` }),
      ).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Odustani' }))

      // Approving needs none, and the counter falls the moment it happens.
      await user.click(screen.getAllByRole('button', { name: 'Odobri' })[0])
      expect(
        screen.getByRole('heading', { level: 2, name: `Čeka proveru ${waiting - 1}` }),
      ).toBeVisible()
    },
  )

  it('drops the count in the queue and on the list of queues once approved', async () => {
    const user = await open('leagues', 'Predložene lige')

    await user.click(screen.getAllByRole('button', { name: 'Odobri' })[0])
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 1' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Administracija' }))
    await user.click(screen.getByRole('link', { name: /Verifikacija/ }))

    const row = await screen.findByRole('link', { name: /Predložene lige/ })
    expect(within(row).getByText('1')).toBeVisible()
  })

  it('will not send anything back without a reason', async () => {
    const user = await open('comments', 'Komentari')

    await user.click(screen.getAllByRole('button', { name: 'Vrati na doradu' })[0])

    const confirm = screen.getByRole('button', { name: 'Vrati uz ovaj razlog' })
    expect(confirm).toBeDisabled()
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()

    await user.type(screen.getByLabelText('Razlog vraćanja'), 'Reklama, ne komentar o trci.')
    await user.click(confirm)

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()
    expect(
      within(screen.getByRole('table', { name: 'Rešeno' })).getByText(
        'Reklama, ne komentar o trci.',
      ),
    ).toBeVisible()
  })

  it('says so when the last item has been decided', async () => {
    const user = await open('leagues', 'Predložene lige')

    await user.click(screen.getAllByRole('button', { name: 'Odobri' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Odobri' })[0])

    expect(screen.getByText('Nema nijedne stavke na čekanju.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Odobri' })).not.toBeInTheDocument()
  })

  it('shows a biography of three and a half thousand characters whole', async () => {
    await open('bios', 'Trkačke biografije')

    const cards = within(screen.getByRole('list')).getAllByRole('listitem')
    const longest = cards.map((card) => card.textContent).sort((a, b) => b.length - a.length)[0]

    // People really do write this much about themselves, and the card wraps it
    // rather than pushing the page sideways.
    expect(longest.length).toBeGreaterThan(3000)
    expect(screen.getAllByText('Tekst biografije')).toHaveLength(2)
  })

  it('shows a comment of one word, and the name it is clearly a copy of', async () => {
    await open('comments', 'Komentari')
    expect(screen.getByText('Odlično')).toBeVisible()

    await open('teams', 'Novi timovi')
    // The same name as an approved team but for the capitals, which is exactly
    // the case a person has to see to catch (PDL P13).
    expect(screen.getByRole('heading', { level: 3, name: 'dunavski trkači' })).toBeVisible()
  })

  it('keeps two independent reports of the same date apart', async () => {
    const user = await open('schedule', 'Prijave promene termina')

    /* Two reports of a change set the date under check by themselves (PDL P10),
       and both are shown: deciding one says nothing about the other. */
    expect(screen.getAllByRole('heading', { level: 3, name: 'Beogradski maraton' })).toHaveLength(2)
    expect(screen.getAllByText('Datum u kalendaru')).toHaveLength(3)
    expect(screen.getAllByText('Prijavljen datum')).toHaveLength(3)
    // The button is open to people with no account at all (PDL P10).
    expect(screen.getByText('Prijavio posetilac bez naloga')).toBeVisible()

    await user.click(screen.getAllByRole('button', { name: 'Odobri' })[0])

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 3, name: 'Beogradski maraton' })).toHaveLength(1)
  })

  it('closes the reason without deciding anything', async () => {
    const user = await open('photos', 'Profilne slike')

    await user.click(screen.getAllByRole('button', { name: 'Vrati na doradu' })[0])
    await user.click(screen.getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByLabelText('Razlog vraćanja')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()
  })

  it('keeps the focus on the card in both directions', async () => {
    const user = await open('photos', 'Profilne slike')
    const cards = within(screen.getByRole('list')).getAllByRole('listitem')
    const second = within(cards[1])

    /* The box takes the place of the buttons of its own card, so both directions
       used to drop the focus onto the document and the next Tab started the page
       from the top, past everything (src/app/Dropdown.tsx has the same problem in
       the header). */
    await user.click(second.getByRole('button', { name: 'Vrati na doradu' }))
    expect(second.getByLabelText('Razlog vraćanja')).toHaveFocus()

    await user.click(second.getByRole('button', { name: 'Odustani' }))
    expect(second.getByRole('button', { name: 'Vrati na doradu' })).toHaveFocus()

    // And the card it came from is the one that has it, not the first on screen.
    expect(within(cards[0]).getByRole('button', { name: 'Vrati na doradu' })).not.toHaveFocus()
  })

  it('carries no dates on a queue that has none', async () => {
    await open('photos', 'Profilne slike')

    expect(screen.queryByText('Prijavljen datum')).not.toBeInTheDocument()
    expect(screen.getByText('profilna-sa-maratona.jpg')).toBeVisible()
  })
})

describe('countsFor', () => {
  const competitor = (memberNumber: string, active: boolean) =>
    ({ memberNumber, active }) as Competitor
  const item = (id: string, queue: PendingQueueId) => ({ id, queue }) as PendingItem
  const empty = { pendingResults: 0, competitors: [], items: [], decisions: {} }

  it('counts every queue from the one place', () => {
    const counts = countsFor({
      pendingResults: 3,
      competitors: [competitor('000001', true), competitor('000002', false)],
      items: [
        item('a', 'bios'),
        item('b', 'bios'),
        item('c', 'comments'),
        item('d', 'schedule'),
      ],
      decisions: {},
    })

    expect(counts.results).toBe(3)
    expect(counts.payments).toBe(1)
    expect(counts.bios).toBe(2)
    expect(counts.comments).toBe(1)
    expect(counts.schedule).toBe(1)
  })

  it('counts a date under check only from what somebody sent in', () => {
    /* The calendar used to be counted here as well, for the dates whose freshness
       clock ran out (PDL P10). An event carries no clock and has no card on the
       screen behind the row, so the row said one more than the screen could ever
       show and the last one could not be worked off. What is counted is what a
       moderator can decide, and nothing else, which is why the calendar is not
       even handed in any more. */
    expect(Object.keys(empty)).not.toContain('events')
    expect(countsFor({ ...empty, items: [item('a', 'schedule')] }).schedule).toBe(1)
  })

  it('stops counting an item once it has been decided', () => {
    const items = [item('a', 'teams'), item('b', 'teams')]
    const competitors = [competitor('000002', false)]

    expect(countsFor({ ...empty, items, competitors }).teams).toBe(2)
    expect(
      countsFor({
        ...empty,
        items,
        competitors,
        decisions: {
          a: { status: 'approved', note: '', basis: '' },
          [paymentKey('000002')]: { status: 'approved', note: '', basis: 'payment' },
        },
      }),
    ).toMatchObject({ teams: 1, payments: 0 })
  })

  it('reports zero for every queue when nothing is waiting', () => {
    const counts = countsFor(empty)

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

    // Inside the screen, not the whole page: the navigation carries entries of
    // its own with the same words on them, Timovi among them.
    const page = within(screen.getByRole('main'))

    for (const name of names) {
      expect(page.getByRole('link', { name })).toBeVisible()
    }

    expect(page.getByRole('link', { name: 'Članovi' })).toHaveAttribute(
      'href',
      '/sr/administracija/clanovi',
    )
  })

  it('opens an entity from the list', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/entiteti', 'superadmin')

    await user.click(await screen.findByRole('link', { name: 'Statične strane' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Statične strane' }),
    ).toBeVisible()
  })
})
