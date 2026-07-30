import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PageMetaContext } from '../app/pageMetaContext'
import { I18nProvider } from '../i18n/I18nProvider'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionContext, type SessionValue, type SubmissionStatus } from '../session/context'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { Admin } from './admin/Admin'
import { ruleSentence, type BadgeRule } from '../data/badgeRule'
import { ENTITIES } from './admin/entityList'
import { type PendingItem, type PendingQueueId } from './admin/pending'
import { countsFor, QUEUE, QUEUES } from './admin/queues'
import { ReviewQueue } from './admin/ReviewQueue'
import { categoryOf } from '../data/raceCategory'
import { epcPayload, ipsPayload, methodsFor } from '../data/paymentQr'

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
    inbox: [],
    markRead: vi.fn(),
    notify: vi.fn(),
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

/** The sentence the rule tryer reads back. It lives in a live region of its own,
 *  which is what tells it apart from the same sentence on a badge in the table
 *  above it. */
const sentence = () => screen.getByRole('status', { name: 'Proba pravila' })

describe('the badge rule editor', () => {
  it('builds a rule from closed lists and reads it back as a sentence', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/znacke', 'superadmin')

    await screen.findByLabelText('Vrsta')
    expect(sentence()).toHaveTextContent(/broj trka bude najmanje 10/)

    // "Vrsta", not "Veličina" (PDL P28a, 30.07.2026).
    await user.selectOptions(screen.getByLabelText('Vrsta'), 'totalKm')

    expect(sentence()).toHaveTextContent(/ukupno kilometara bude najmanje 10/)
  })

  /* There is no operator to choose any more: the condition is always "at least"
     (PDL, 30.07.2026), so the only closed list left is the kind. */
  it('offers no way to write a condition by hand', async () => {
    renderAt('/sr/administracija/znacke', 'superadmin')

    await screen.findByLabelText('Vrsta')
    // A free text box here is the shortest path to running code on the server.
    expect(screen.getByLabelText('Vrsta').tagName).toBe('SELECT')
    expect(screen.queryByLabelText('Uslov')).not.toBeInTheDocument()
  })

  /* Three of the kinds read one race rather than a season (PDL P28a,
     30.07.2026), and the sentence has to stay a sentence when one of them is
     chosen. */
  it('reads a rule about a single race back as a sentence too', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/znacke', 'superadmin')

    await user.selectOptions(await screen.findByLabelText('Vrsta'), 'bestRaceKm')

    expect(sentence()).toHaveTextContent(/najviše kilometara na jednoj trci bude najmanje 10/)
  })
})

describe('ruleSentence', () => {
  const base: BadgeRule = {
    kind: 'raceCount',
    value: 5,
    from: '',
    to: '',
  }
  const t = (key: string, params?: Record<string, string | number>) =>
    `${key}${params === undefined ? '' : JSON.stringify(params)}`

  it('says a rule with no dates counts every season', () => {
    expect(ruleSentence(base, t, 'sr')).toContain('badges.everSince')
  })

  it('says a rule with both dates counts between them', () => {
    expect(ruleSentence({ ...base, from: '2027-01-01', to: '2027-12-31' }, t, 'sr')).toContain(
      'badges.between',
    )
  })

  it('says a rule with one date counts from it, or up to it', () => {
    expect(ruleSentence({ ...base, from: '2027-01-01' }, t, 'sr')).toContain('badges.after')
    expect(ruleSentence({ ...base, to: '2027-12-31' }, t, 'sr')).toContain('badges.before')
  })

  it('writes the value the way this language writes a number', () => {
    // A marathon is 42,2 in Serbian and 42.2 in the data. The sentence and the
    // threshold on the badge stand on the same card and must agree.
    expect(ruleSentence({ ...base, kind: 'bestRaceKm', value: 42.2 }, t, 'sr')).toContain('42,2')
    expect(ruleSentence({ ...base, kind: 'totalKm', value: 1200 }, t, 'sr')).toContain('1.200')
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
    expect(sentence()).toHaveTextContent(/računato od 2027-01-01, bez kraja/)

    await user.type(screen.getByLabelText('Do datuma'), '2027-12-31')
    expect(sentence()).toHaveTextContent(/od 2027-01-01 do 2027-12-31/)

    await user.clear(screen.getByLabelText('Od datuma'))
    expect(sentence()).toHaveTextContent(/računato do 2027-12-31/)
  })

  it('takes a value that is typed rather than chosen', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/znacke', 'superadmin')

    const value = await screen.findByLabelText('Vrednost')
    await user.clear(value)
    await user.type(value, '42')

    expect(sentence()).toHaveTextContent(/bude najmanje 42/)
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

      /* The file feeds seven of the eight rows, memberships among them since the
         member number became something the system hands out (PDL P8). Results
         come from the session, so that row touches no file at all: a failure used
         to take it down with the rest, and the whole screen with it. The header
         treats the same failure the other way round (src/app/Shell.tsx), and this
         still matches it. */
      const results = await screen.findByRole('link', { name: /Rezultati/ })
      expect(within(results).getByText('0')).toBeVisible()
      expect(screen.getByRole('link', { name: /Uplate i aktivacija članova/ })).toBeVisible()

      // What a failure must not do is pass for an empty queue without a word.
      expect(await screen.findByRole('alert')).toHaveTextContent(/nije dostupan/)
    } finally {
      globalThis.fetch = served
    }
  })

  it('raises no alarm over a file none of the numbers come from', async () => {
    const served = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/competitors.json')
        ? new Response('nema', { status: 500 })
        : served(input)) as typeof fetch

    try {
      renderAt('/sr/administracija/verifikacija', 'moderator')

      /* Nothing here is counted off the member list any more (PDL P8, 30.07.2026),
         so with only that file down every one of the eight numbers is right. The
         screen still handed the list in and still said the numbers might be short
         of the truth. An alarm that goes off when nothing is wrong is how a
         moderator learns to ignore the one that matters. */
      const memberships = await screen.findByRole('link', {
        name: /Uplate i aktivacija članova/,
      })
      expect(within(memberships).getByText('3')).toBeVisible()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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

  it('holds everyone who opened an account and has not paid yet', async () => {
    await openPayments()

    const table = screen.getByRole('table', { name: 'Uplate i aktivacija članova' })
    // Three of them are generated, and the file holds no other membership.
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()
  })

  it('goes by the name and the address, because there is no number yet', async () => {
    await openPayments()

    const table = within(screen.getByRole('table', { name: 'Uplate i aktivacija članova' }))

    /* The member number is handed out when the fee is recorded (PDL P8,
       30.07.2026), so a row that is still waiting has none, and the two things
       that identify the person are the name and the address. The rows used to
       carry 000032 to 000034, numbers nobody had given them. */
    expect(table.getByText('Miodrag Stanković')).toBeVisible()
    expect(table.getByText('miodrag.stankovic@primer.rs')).toBeVisible()
    expect(table.queryByText(/^\d{6}$/)).not.toBeInTheDocument()
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

  it('shows the number it handed out, first free and one per activation', async () => {
    const user = await openPayments()

    /* The generated members hold 000001 to 000031, so the next free one is
       000032, and every activation after it takes the one after that. The number
       is what the administrator passes on to the member, so it is on screen the
       moment it is given (PDL P8, 30.07.2026). */
    await user.click(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Počasno članstvo' })[0])

    const decided = within(screen.getByRole('table', { name: 'Rešeno' }))
    expect(decided.getByText('000032')).toBeVisible()
    expect(decided.getByText('000033')).toBeVisible()
  })

  it('hands out no number to a membership it sends back', async () => {
    const user = await openPayments()

    await user.click(screen.getAllByRole('button', { name: 'Vrati na doradu' })[0])
    await user.type(screen.getByLabelText('Razlog vraćanja'), 'Uplata nije vidljiva na izvodu.')
    await user.click(screen.getByRole('button', { name: 'Vrati uz ovaj razlog' }))

    /* A refusal leaves the registration waiting for a fee, so a number given
       here would be one nobody could ever use, and the next activation would
       have to skip it for nothing. */
    const decided = within(screen.getByRole('table', { name: 'Rešeno' }))
    expect(decided.queryByText(/^\d{6}$/)).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })[0])
    expect(within(screen.getByRole('table', { name: 'Rešeno' })).getByText('000032')).toBeVisible()
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

    await user.click(within(rows[0]).getByRole('button', { name: 'Vrati na doradu' }))

    /* The box hangs below the table, so on a list of twenty there is nothing on
       screen that says whose membership it decides unless it says so itself. The
       name is what it says, because a member number is exactly what a row here
       does not have yet (PDL P8, 30.07.2026). */
    const box = screen.getByRole('group', { name: /Vraćanje na doradu/ })
    expect(box).toHaveAccessibleName('Vraćanje na doradu: Miodrag Stanković')
    expect(within(box).getByText(/Miodrag Stanković/)).toBeVisible()
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

  it('gives the member form no number an activation has already handed out', async () => {
    const user = setupUser()
    renderAt(`/sr/${QUEUE.payments.path}`, 'superadmin')
    await screen.findByRole('heading', { level: 1, name: 'Uplate i aktivacija članova' })

    /* An activation writes a decision and not a member, so the member form never
       saw the number the activation had just given out: record a fee, get 000032,
       then enter a member without reloading and get 000032 again. Two members
       answered to one number, and because the overlay of changes is keyed by the
       number, changing the town of one of them changed both. That is the fault
       the check for uniqueness used to catch before the field left the form (PDL
       P8, 30.07.2026; ADL A4d). */
    await user.click(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })[0])
    expect(within(screen.getByRole('table', { name: 'Rešeno' })).getByText('000032')).toBeVisible()

    // The same visit, walked the way an administrator walks it: no reload.
    await user.click(screen.getByRole('button', { name: 'Administracija' }))
    await user.click(screen.getByRole('link', { name: 'Entiteti' }))
    await user.click(await screen.findByRole('link', { name: 'Članovi' }))

    await user.click(await screen.findByRole('button', { name: 'Novi član' }))
    const form = within(screen.getByRole('form', { name: 'Novi član' }))

    for (const [label, value] of [
      ['Ime', 'Milica'],
      ['Prezime', 'Pavlović'],
      ['Godina rođenja', '1991'],
      ['Mesto', 'Kraljevo'],
      ['U ligi od sezone', '2027'],
    ]) {
      await user.type(form.getByLabelText(new RegExp(`^${label}`)), value)
    }
    await user.selectOptions(form.getByLabelText(/^Pol/), 'F')
    await user.selectOptions(form.getByLabelText(/^Država/), 'RS')
    await user.selectOptions(form.getByLabelText(/^Osnov članstva/), 'payment')
    await user.click(form.getByRole('button', { name: 'Sačuvaj' }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const list = within(await screen.findByRole('table', { name: 'Članovi' }))
    expect(list.queryByText('000032')).not.toBeInTheDocument()
    expect(within(list.getByText('000033').closest('tr')!).getByText(/Milica/)).toBeVisible()
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
    ['photos', 'Profilne slike', 2],
    ['schedule', 'Prijave promene termina', 3],
  ] as [PendingQueueId, string, number][])(
    'has something waiting in %s, and decides it both ways',
    async (queue, title, waiting) => {
      const user = await open(queue, title)

      // A queue with no data cannot be reviewed at all, so every one of them is
      // generated with items in it.
      expect(
        screen.getByRole('heading', { level: 2, name: `Čeka proveru ${waiting}` }),
      ).toBeVisible()
      expect(screen.getAllByRole('button', { name: 'Odobri' })).toHaveLength(waiting)
      expect(screen.getAllByRole('button', { name: 'Vrati na doradu' })).toHaveLength(waiting)

      // The rule on these queues: no reason, no sending back.
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

  /* Comments go their own way (PDL P22, 30.07.2026): accepted or deleted, in one
     click, with no reason asked for and nothing at all sent to the member. The
     word is half the decision. "Odbijeno" reads as a refused comment being kept
     somewhere it could be brought back from, and there is no such place. */
  it('deletes a comment in one click, and never asks why', async () => {
    const user = await open('comments', 'Komentari')

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Vrati na doradu' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Odbij' })).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Obriši' })[0])

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'Razlog vraćanja' })).not.toBeInTheDocument()

    const decided = within(screen.getByRole('table', { name: 'Rešeno' }))
    expect(decided.getByText('Obrisano')).toBeVisible()
    expect(decided.queryByText('Odbijeno')).not.toBeInTheDocument()
    // Nothing is ever written down about a comment, so the table has no column
    // for it: a heading over a run of empty cells is a question with no answer.
    expect(decided.queryByRole('columnheader', { name: 'Obrazloženje' })).not.toBeInTheDocument()
  })

  /* Biographies go their own way too, and further: there is no second decision at
     all. The moderator adjusts the text as they see fit and publishes what they
     left, and it never goes back to the competitor (PDL P22, 30.07.2026). */
  it('edits a biography in place and publishes what the moderator left', async () => {
    const user = await open('bios', 'Trkačke biografije')

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()
    // Nothing here goes back, so there is no button for it and no reason to write.
    expect(screen.queryByRole('button', { name: 'Vrati na doradu' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Odobri' })).not.toBeInTheDocument()

    const card = within(within(screen.getByRole('list')).getAllByRole('listitem')[0])

    await user.click(card.getByRole('button', { name: 'Izmeni' }))
    const box = card.getByRole('textbox', { name: 'Tekst biografije' })
    await user.clear(box)
    await user.type(box, 'Rekreativac iz Čačka, trči zbog druženja.')
    await user.tab()

    // What the moderator wrote is what stands on the card, before anything is
    // published and after the box has closed.
    expect(card.getByText('Rekreativac iz Čačka, trči zbog druženja.')).toBeVisible()

    await user.click(card.getByRole('button', { name: 'Objavi' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 1' })).toBeVisible()

    const decided = within(screen.getByRole('table', { name: 'Rešeno' }))
    expect(decided.getByText('Objavljeno')).toBeVisible()
    // And the published version is the edited one, not what came in.
    expect(decided.getByText('Rekreativac iz Čačka, trči zbog druženja.')).toBeVisible()
  })

  it('publishes a biography nobody touched exactly as it came in', async () => {
    const user = await open('bios', 'Trkačke biografije')

    const first = within(screen.getByRole('list')).getAllByRole('listitem')[0]
    // Two paragraphs with an empty line between them, which is what a biography
    // looks like and what has to survive being published untouched.
    const sent = within(first).getByText(/Rekreativac iz Čačka/).textContent

    await user.click(within(first).getByRole('button', { name: 'Objavi' }))

    const cells = within(screen.getByRole('table', { name: 'Rešeno' })).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toContain(sent)
  })

  /* Pictures are the only one of the three that still goes back to a competitor.
     It is the same box with the same words as every other queue that hands work
     back, because it is the same decision; what differs is what the moderator is
     asked to write, since that reason is what the member reads and changes the
     picture by (PDL P22, owner, 30.07.2026). */
  it('asks the picture queue for a reason precise enough to work from', async () => {
    const user = await open('photos', 'Profilne slike')

    await user.click(screen.getAllByRole('button', { name: 'Vrati na doradu' })[0])

    // The name of the field is the one every queue uses, so a member is never
    // told about two different things.
    const reason = screen.getByLabelText('Razlog vraćanja')
    expect(screen.getByRole('button', { name: 'Vrati uz ovaj razlog' })).toBeInTheDocument()

    // The empty field is where the queue says what it wants: not "no good" but
    // what has to change for the picture to be accepted.
    expect(reason).toHaveAttribute(
      'placeholder',
      'Napiši tačno šta na slici treba promeniti da bi bila prihvaćena.',
    )
    expect(screen.getAllByRole('button', { name: 'Vrati na doradu' })).toHaveLength(1)
  })

  it('leaves the reason for a returned picture in the inbox of the member', async () => {
    const user = setupUser()
    /* Signed in as the member whose picture is waiting, because the prototype has
       one person at the keyboard and the point of the test is where the message
       lands. A message carries the number it was written to (Message.to), so a
       moderator who is somebody else never sees it. */
    renderAt(`/sr/${QUEUE.photos.path}`, 'moderator', '000013')
    await screen.findByRole('heading', { level: 1, name: 'Profilne slike' })

    const card = within(
      within(screen.getByRole('list')).getAllByRole('listitem').find((one) =>
        within(one).queryByText('Damjan Krstić') !== null,
      )!,
    )

    await user.click(card.getByRole('button', { name: 'Vrati na doradu' }))
    await user.type(
      screen.getByLabelText('Razlog vraćanja'),
      'Slika je mutna, pošalji oštriju u kojoj se vidi lice.',
    )
    await user.click(screen.getByRole('button', { name: 'Vrati uz ovaj razlog' }))

    /* A reason the member never reads is a reason to nobody, and this is the one
       queue where the member is expected to act on it. The portal already has an
       inbox, so it goes there (PDL P22, P28a). */
    await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))
    await user.click(screen.getByRole('link', { name: /Profilna slika je vraćena/ }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Profilna slika je vraćena' }),
    ).toBeVisible()
    expect(
      screen.getByText('Slika je mutna, pošalji oštriju u kojoj se vidi lice.'),
    ).toBeVisible()
  })

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
    // A team rather than a biography: biographies stopped going back at all
    // (PDL P22, 30.07.2026), so there is nothing to refuse on that queue.
    const user = await open('teams', 'Novi timovi')

    await user.click(screen.getAllByRole('button', { name: 'Vrati na doradu' })[0])

    const confirm = screen.getByRole('button', { name: 'Vrati uz ovaj razlog' })
    expect(confirm).toBeDisabled()
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()

    await user.type(screen.getByLabelText('Razlog vraćanja'), 'Naziv je već zauzet.')
    await user.click(confirm)

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 1' })).toBeVisible()
    expect(
      within(screen.getByRole('table', { name: 'Rešeno' })).getByText('Naziv je već zauzet.'),
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
  const item = (id: string, queue: PendingQueueId) => ({ id, queue }) as PendingItem
  const empty = { pendingResults: 0, items: [], decisions: {} }

  it('counts every queue from the one place', () => {
    const counts = countsFor({
      pendingResults: 3,
      items: [
        item('u', 'payments'),
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

  it('counts a membership from the queue and never from the member list', () => {
    /* It used to be counted as the member who was not active yet. A member number
       is handed out when the fee is recorded (PDL P8, 30.07.2026), so somebody who
       has not paid has no number and is not a member; counting them off the member
       list would mean they were in it, and everything that reads that list reads
       all of it, front page included.

       The member list is not even handed in any more, and that is what this holds:
       while it still was, the counter in the header asked for the file of members
       on every screen of the portal so it could pass it in unread. */
    expect(Object.keys(empty)).not.toContain('competitors')
    expect(countsFor({ ...empty, items: [item('u', 'payments')] }).payments).toBe(1)
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
    const items = [item('a', 'teams'), item('b', 'teams'), item('u', 'payments')]

    expect(countsFor({ ...empty, items })).toMatchObject({ teams: 2, payments: 1 })
    expect(
      countsFor({
        ...empty,
        items,
        decisions: {
          a: { status: 'approved', note: '', basis: '', memberNumber: '' },
          u: { status: 'approved', note: '', basis: 'payment', memberNumber: '000032' },
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
