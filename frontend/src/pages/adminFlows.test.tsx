import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PageMetaContext } from '../app/pageMetaContext'
import { PRICES, PROCESSING_FEE_EUR } from '../data/pricing'
import { I18nProvider } from '../i18n/I18nProvider'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionContext, type SessionValue, type SubmissionStatus } from '../session/context'
import { at, first, must } from '../test/at'
import { expectFrontPage, moderatorWith, renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { Admin } from './admin/Admin'
import { ruleSentence, type BadgeRule } from '../data/badgeRule'
import { ENTITIES } from './admin/entityList'
import type { PendingItem, PendingQueueId } from '../data/types'
import { NO_RATING } from '../data/types'
import { canSendBack, countsFor, QUEUE, QUEUES } from './admin/queues'
import { RIGHTS } from './admin/rights'
import { ReviewQueue } from './admin/ReviewQueue'
import { categoryOf } from '../data/raceCategory'
import {
  ipsPayload,
  methodsFor,
  paymentPurpose,
  paymentReference,
  RECIPIENT_ACCOUNT,
  RECIPIENT_NAME,
} from '../data/paymentQr'

/** A session holding results in the states the panel has to tell apart. */
/** Every box in the matrix ticked, for the tests about a screen doing its
 *  work rather than about what a limited moderator runs into. */
const EVERY_RIGHT = RIGHTS.map((right) => right.key)

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
      seconds: 2700,
      points: 12,
      photo: '',
      category: 'short' as const,
      link: 'https://primer.rs/r',
      comment: '',
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
    rights: {},
    setRight: vi.fn(),
    decisions: {},
    settle: vi.fn(),
    deletions: {},
    remove: vi.fn(),
    proposals: [],
    propose: vi.fn(),
  published: [],
  publish: vi.fn(),
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

    /* To the front page, and with nothing of administration around it (owner,
       30.07.2026). The door is fitted outside the section on purpose
       (routeObjects.tsx): drawn inside it, a competitor at a queue would be
       turned away from the work and handed the column beside it, which names
       every queue and says how much is waiting in each. */
    await expectFrontPage()
    expect(
      screen.queryByRole('navigation', { name: 'Odeljak Verifikacija' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Odeljak Podaci' })).not.toBeInTheDocument()
  })

  it('turns a moderator away from a queue he has no right to, section and all', async () => {
    /* The other half of the same rule, and the one that is not about a stranger:
       a moderator is staff, so it is only the right that stops him. He is not
       told which right it was; he is told nothing, which is the whole of the
       30.07.2026 decision. */
    renderAt(`/sr/${QUEUE.payments.path}`, 'moderator', null, moderatorWith(['queue:results']))

    await expectFrontPage()
    expect(
      screen.queryByRole('navigation', { name: 'Odeljak Verifikacija' }),
    ).not.toBeInTheDocument()
  })

  it('turns a moderator away from the entity of moderators, section and all', async () => {
    renderAt('/sr/administracija/moderatori', 'moderator')

    await expectFrontPage()
    expect(screen.queryByRole('navigation', { name: 'Odeljak Podaci' })).not.toBeInTheDocument()
  })
})

describe('the panel', () => {
  it('counts what is waiting and leads to every screen', async () => {
    renderAt('/sr/administracija', 'moderator')

    expect(await screen.findByRole('heading', { level: 1, name: 'Administracija' })).toBeVisible()
    expect(screen.getByText('Čeka proveru')).toBeVisible()
    /* Badges are edited from the section of records like the other eight, so
       the panel no longer offers a road of its own to them (owner, 01.08.2026).
       What it offers is the two sections and the price list, which is in neither
       of them and lost its place in the header when the navigation lost its
       groups (owner, 04.08.2026). */
    expect(screen.getByRole('link', { name: 'Podaci' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Verifikacija' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Cenovnik' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Značke' })).not.toBeInTheDocument()
  })

  it('counts everything that is waiting, not results alone', async () => {
    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          {/* Named, and holding everything: "a moderator" is nobody, and nobody
              holds no rights and therefore reaches no queue (rights.ts). */}
          <RoleProvider initialRole="moderator" initialModerator={moderatorWith(EVERY_RIGHT)}>
            <SessionContext.Provider value={sessionWith(['pending', 'pending', 'approved'])}>
              <Admin />
            </SessionContext.Provider>
          </RoleProvider>
        </MemoryRouter>
      </I18nProvider>,
    )

    const waiting = must((await screen.findByText('Čeka proveru')).closest('div'), 'div')
    /* Two results are waiting, three memberships, and fourteen items in the six
       queues read from the file. The tile counted the two while the navigation
       counted the lot, which is two numbers disagreeing on one screen. The sum
       is exact because the data is fixed: an "at least" here would survive the
       counter losing a whole queue.

       The moderator holds every right here, so the panel counts all eight. One
       who held fewer would see fewer, which is the point of the number: it is
       the work he can actually reach (owner, 30.07.2026). */
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
  it('is a period of the year rather than a date, because the list repeats', async () => {
    /* Owner, 30.07.2026: membership for 2027 is sold until 30 September 2027,
       and on 1 October the same four periods open again for 2028. Written as
       dates they would have expired. */
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Cenovnik' })

    expect(within(table).getByText('1.10. - 5.10.')).toBeVisible()
    expect(within(table).getByText('1.1. - 30.9.')).toBeVisible()
    // The junior price is the one row with no period at all.
    expect(within(table).getByText('Svaka uplata')).toBeVisible()
    // The in-season price buys a profile but no place in the standing.
    expect(within(table).getAllByText('Ne')).toHaveLength(1)
  })

  it('is named by its own field, and neither added to nor taken from', async () => {
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Cenovnik' })

    expect(within(table).getByRole('columnheader', { name: 'Naziv perioda' })).toBeVisible()
    /* The four periods are the year itself. A fifth row would have to fall
       inside one of them, and a row taken away would leave a stretch of the
       year with no price at all. */
    expect(screen.queryByRole('button', { name: /^Nov/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Obriši:/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Otvori:/ }).length).toBe(5)
  })

  it('says what a payment from abroad carries on top of the price', async () => {
    /* Whoever records a payment sees three euro more on the statement than the
       table quotes, and has to be able to tell processing from overpayment
       (PDL P8, 03.08.2026). The fee is not a row of the price list, because it
       is not membership. */
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Cenovnik' })
    const note = screen.getByText(/taksu za obradu plaćanja/)

    expect(note).toHaveTextContent(`${PROCESSING_FEE_EUR} EUR`)
    expect(note).toHaveTextContent('nije članarina')
    /* And no row of the list has the fee inside it: a cell of exactly "3" is a
       cell no price list would ever have, so looking for one proved nothing.
       What could go wrong is a price with the fee added, and that is what is
       looked for. */
    for (const price of PRICES) {
      expect(within(table).queryByText(String(price.eur + PROCESSING_FEE_EUR))).toBeNull()
    }
  })

  it('stands beside the sections rather than inside the entities', async () => {
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    await screen.findByRole('table', { name: 'Cenovnik' })

    // Nothing is created or removed on it, which is what the section is for.
    expect(screen.queryByRole('navigation', { name: 'Odeljak Podaci' })).not.toBeInTheDocument()
  })

  it('changes what a period costs and what it is called, and nothing else', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    await screen.findByRole('table', { name: 'Cenovnik' })
    await user.click(screen.getByRole('button', { name: 'Otvori: 1. do 5. oktobra' }))

    /* Three fields and no more. The window is the year itself and is not
       something an administrator types (owner, 30.07.2026); it used to ask for a
       date from and a date to, which is how a price list expires. */
    expect(screen.getByLabelText(/Naziv perioda/)).toBeVisible()
    expect(screen.queryByLabelText(/Važi od/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Važi do/)).not.toBeInTheDocument()

    const eur = screen.getByLabelText(/Cena u evrima/)
    await user.clear(eur)
    await user.type(eur, '33')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const table = within(await screen.findByRole('table', { name: 'Cenovnik' }))
    expect(table.getByText('33')).toBeVisible()
    // And the period it belongs to is where it was.
    expect(table.getByText('1.10. - 5.10.')).toBeVisible()
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
    /* A range that describes no whole period is read out from one end to the
       other, and both ends are written for the reader. They used to be dropped
       in as they are stored, so a badge on the public page said "od 2027-07-01
       do 2027-07-15" (PDL P28a, 30.07.2026). */
    const sentence = ruleSentence({ ...base, from: '2027-07-01', to: '2027-07-15' }, t, 'sr')

    expect(sentence).toContain('badges.between')
    expect(sentence).toContain('15. 7. 2027.')
    expect(sentence).not.toContain('2027-07')
  })

  it('names the period instead of reciting its edges where the two make one', () => {
    // A whole month, a whole year, and one day, in the order the rule is tried.
    const during = (from: string, to: string) =>
      ruleSentence({ ...base, from, to }, t, 'sr')

    expect(during('2027-07-01', '2027-07-31')).toContain('badges.during{"period":"jul 2027.')
    expect(during('2027-01-01', '2027-12-31')).toContain('badges.during{"period":"2027.')
    expect(during('2027-10-15', '2027-10-15')).toContain('badges.during{"period":"15. 10. 2027.')
  })

  it('says a rule with one date counts from it, or up to it', () => {
    // One end is not a period, so it is a date, and a date is written for the
    // reader here as everywhere else.
    expect(ruleSentence({ ...base, from: '2027-01-01' }, t, 'sr')).toContain(
      'badges.after{"from":"1. 1. 2027.',
    )
    expect(ruleSentence({ ...base, to: '2027-12-31' }, t, 'sr')).toContain(
      'badges.before{"to":"31. 12. 2027.',
    )
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

  /* The statement, as the way a hundred payments are reconciled at once (owner,
     31.07.2026). Turning the file into decisions is the server's work and the
     server does not exist yet, so what it does today is take the file and say
     so; what it can honestly refuse is a file that is not a statement at all. */
  it('takes a statement in PDF and says what it did with it', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

    const pick = await screen.findByLabelText('Izaberi PDF izvoda')

    await user.upload(pick, new File(['%PDF-1.7'], 'izvod-jul.pdf', { type: 'application/pdf' }))

    expect(await screen.findByText(/Primljen izvod izvod-jul\.pdf/)).toBeVisible()
    expect(screen.queryByText(/mora biti PDF/)).not.toBeInTheDocument()
  })

  /* A statement saved without a type is still a statement. What decides is the
     file, not what the operating system called it. */
  it('takes a real PDF whose type the machine never wrote down', async () => {
    renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

    const pick = (await screen.findByLabelText('Izaberi PDF izvoda')) as HTMLInputElement

    /* Handed over rather than picked, because `user.upload` matches `accept`
       against the type alone; a browser matches the extension as well, so a
       `.pdf` with no type does reach the screen there. */
    fireEvent.change(pick, {
      target: { files: [new File(['%PDF-1.4 ...'], 'izvod.pdf', { type: '' })] },
    })

    expect(await screen.findByText(/Primljen izvod izvod\.pdf/)).toBeVisible()
  })

  it('refuses anything renamed to look like a statement', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

    const pick = await screen.findByLabelText('Izaberi PDF izvoda')

    // A spreadsheet with the extension changed, which is what a hurried
    // administrator actually does.
    await user.upload(pick, new File(['ime;iznos'], 'izvod.pdf', { type: 'application/pdf' }))

    expect(await screen.findByText(/mora biti PDF/)).toBeVisible()
    expect(screen.queryByText(/Primljen izvod/)).not.toBeInTheDocument()
  })

  it('refuses a file that is not a statement, and says why', async () => {
    renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

    const pick = (await screen.findByLabelText('Izaberi PDF izvoda')) as HTMLInputElement

    /* Handed over rather than picked through the control: `accept` already
       turns a CSV away in the dialog, and `user.upload` honours that, so the
       one case worth testing is the one `accept` cannot cover, which is
       somebody choosing "all files" and handing over a CSV anyway. */
    fireEvent.change(pick, {
      target: { files: [new File(['ime;iznos'], 'izvod.csv', { type: 'text/csv' })] },
    })

    expect(await screen.findByText(/mora biti PDF/)).toBeVisible()
    expect(screen.queryByText(/Primljen izvod/)).not.toBeInTheDocument()
  })

  /* The dialog turns a spreadsheet away before it reaches the screen, which is
     why the case above has to be handed over rather than picked. */
  it('asks the dialog for PDFs only', async () => {
    renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

    expect(await screen.findByLabelText('Izaberi PDF izvoda')).toHaveAttribute(
      'accept',
      'application/pdf',
    )
  })

  it('replaces what it said last time rather than piling messages up', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

    const pick = await screen.findByLabelText('Izaberi PDF izvoda')

    await user.upload(pick, new File(['%PDF-1.7'], 'prvi.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText(/Primljen izvod prvi\.pdf/)).toBeVisible()

    await user.upload(pick, new File(['ne pdf'], 'drugi.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText(/mora biti PDF/)).toBeVisible()
    expect(screen.queryByText(/Primljen izvod/)).not.toBeInTheDocument()
  })

  it('says nothing at all when the picking was called off', async () => {
    /* Opening the dialog and closing it again fires the same event with an
       empty list, and a screen that answers "primljen izvod" to a file nobody
       chose is worse than one that says nothing. */
    renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

    const pick = (await screen.findByLabelText('Izaberi PDF izvoda')) as HTMLInputElement

    fireEvent.change(pick, { target: { files: [] } })

    expect(screen.queryByText(/Primljen izvod/)).not.toBeInTheDocument()
    expect(screen.queryByText(/mora biti PDF/)).not.toBeInTheDocument()
  })

  /* The whole payload, written out, built from the exported constants.
   *
   * Every other test here checked a part: a prefix, one tag, one value. Under
   * that, the account number could be changed to a different one, the recipient
   * renamed, the seat corrected to a wrong address, or the tags reordered, and
   * the suite stayed green. This is the payload real money is sent by, so it is
   * held whole and by value: the number below is the association's account and
   * the only test that fails when it changes. */
  it('is exactly this, tag for tag', () => {
    expect(
      ipsPayload({
        account: RECIPIENT_ACCOUNT,
        recipient: RECIPIENT_NAME,
        amountRsd: 4800,
        purpose: paymentPurpose(2027),
        reference: paymentReference(2027, '000037'),
      }),
    ).toBe(
      'K:PR|V:01|C:1|R:105000000000328471|N:Sportsko udruženje BTL|I:RSD4800,00|SF:289' +
        '|S:Članarina za 2027. godinu|RO:202737',
    )
  })

  /* The seat is on the screen in writing and not in the code: the field it would
     sit in has a length the two together were pushing at. */
  it('keeps the seat of the association out of the code', () => {
    const dinars = ipsPayload({
      account: RECIPIENT_ACCOUNT,
      recipient: RECIPIENT_NAME,
      amountRsd: 4800,
      purpose: paymentPurpose(2027),
      reference: paymentReference(2027, '000037'),
    })

    expect(dinars).not.toContain('Čarnojevića')
    expect(dinars.length).toBeLessThan(200)
  })

  it('carries the reference exactly as it was handed in', () => {
    /* The association's slips use no model, so nothing is prefixed to the
       reference (owner, 31.07.2026). */
    const payload = ipsPayload({
      account: '000000000000000000',
      recipient: 'x',
      amountRsd: 100,
      purpose: 'y',
      reference: '202737',
    })

    expect(payload).toContain('RO:202737')
  })

  it('writes the reference as the season and the member number, digits only', () => {
    /* Whose money it is, in the one field a bank statement carries through
       (owner, 31.07.2026). The season is in it because the same person pays
       every year; the noughts are out because nobody copies four of them
       correctly; and there is no separator, because the field is read by a
       machine and a separator is one more thing that can go missing. */
    expect(paymentReference(2027, '000037')).toBe('202737')
    expect(paymentReference(2027, '000001')).toBe('20271')
    expect(paymentReference(2027, '001234')).toBe('20271234')
    expect(paymentPurpose(2027)).toBe('Članarina za 2027. godinu')
  })

  /* Two boundaries, not preferences. PayPal is not allowed between residents of
     Serbia under the foreign exchange act (PDL P8), and the slip pays into a
     dinar account at a Serbian bank, which from abroad is the slowest and
     dearest way there is (owner, 31.07.2026). */
  it('offers the slip only inside Serbia, and PayPal only outside it', () => {
    expect(methodsFor('RS')).toEqual(['ips', 'card'])
    expect(methodsFor('ME')).toEqual(['paypal', 'card'])
    expect(methodsFor('HR')).toEqual(['paypal', 'card'])
    expect(methodsFor('BA')).toEqual(['paypal', 'card'])
    expect(methodsFor('DE')).toEqual(['paypal', 'card'])
  })
})

describe('the badge rule dates', () => {
  it('narrows the rule to a range and back again', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/znacke', 'superadmin')

    /* The superadmin types the dates the way a date field takes them and reads
       back the sentence the member will read, so no date in it is an ISO string
       (PDL P28a, 30.07.2026). */
    await user.type(await screen.findByLabelText('Od datuma'), '2027-01-01')
    expect(sentence()).toHaveTextContent(/računato od 1\. 1\. 2027\., bez kraja/)

    // Both ends now, and together they are a whole year, so the sentence says
    // the year rather than reciting the first and the last day of it.
    await user.type(screen.getByLabelText('Do datuma'), '2027-12-31')
    expect(sentence()).toHaveTextContent(/računato za 2027\./)
    expect(sentence()).not.toHaveTextContent('2027-01-01')

    await user.clear(screen.getByLabelText('Od datuma'))
    expect(sentence()).toHaveTextContent(/računato do 31\. 12\. 2027\./)
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

  it('has the one decision for the whole queue, like every other queue', async () => {
    /* The button was written once, on the screen six queues share, and reported
       as being on every queue. The results and the payments each draw their own
       table and neither had it, so a moderator told the queues all work the same
       way found two that did not. It asks first here too, because approving is
       what puts a result into the standings and there is nothing to undo. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      const { user, session } = openWith(['pending', 'pending', 'approved', 'pending'])

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(confirm).toHaveBeenCalledTimes(1)
      expect(String(first(confirm.mock.calls)?.[0])).toContain('3')
      /* The three waiting ones and not the one already decided. */
      expect(session.decide).toHaveBeenCalledTimes(3)
      expect(session.decide).toHaveBeenCalledWith('sub-0', 'approved', '')
      expect(session.decide).toHaveBeenCalledWith('sub-1', 'approved', '')
      expect(session.decide).toHaveBeenCalledWith('sub-3', 'approved', '')
    } finally {
      confirm.mockRestore()
    }
  })

  it('says what it did, with the number it really settled, and takes the focus', async () => {
    /* The line and its number, on the third of the three screens. Written as a
       nought it would have said "Rešeno je 0 stavki." after approving thirty
       results, and nothing here would have noticed. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      const { user } = openWith(['pending', 'pending', 'approved', 'pending'])

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      const said = screen.getByText(/^Rešen.* 3 stavk/)

      expect(said).toBeVisible()
      expect(said).toHaveFocus()
    } finally {
      confirm.mockRestore()
    }
  })

  it('leaves no reason box open over results the sweep has just approved', async () => {
    /* The box stands below the table. Left open, confirming it would refuse
       what the sweep approved a moment ago and say nothing about it. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      const { user } = openWith(['pending', 'pending'])

      await user.click(first(screen.getAllByRole('button', { name: 'Vrati na doradu' })))
      expect(screen.getByLabelText('Razlog vraćanja')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(screen.queryByLabelText('Razlog vraćanja')).not.toBeInTheDocument()
    } finally {
      confirm.mockRestore()
    }
  })

  it('settles nothing when the question is answered no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    try {
      const { user, session } = openWith(['pending', 'pending'])

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(session.decide).not.toHaveBeenCalled()
    } finally {
      confirm.mockRestore()
    }
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
  it('puts every queue in the navigation beside the work, with its count', async () => {
    /* The section has no screen of its own any more (owner, 30.07.2026): its
       address opens the first queue, so this lands on the results. */
    renderAt('/sr/administracija/verifikacija', 'superadmin')

    expect(
      await screen.findByRole('heading', { level: 2, name: /Čeka proveru/ }),
    ).toBeVisible()

    // The eight, in the order of QUEUES, and nothing above them: the way in is
    // not an entry, because there is no longer anything at it.
    const nav = within(screen.getByRole('navigation', { name: 'Odeljak Verifikacija' }))
    const rows = nav.getAllByRole('listitem')

    /* One comparison rather than a walk with an index in it: the whole list of
       addresses against the whole list of queues, in order. It fails on a
       missing row, an extra one, a wrong address and a wrong order alike, and
       when it fails it prints both lists instead of one href. */
    expect(rows.map((row) => within(row).getByRole('link').getAttribute('href'))).toEqual(
      QUEUES.map((queue) => `/sr/${queue.path}`),
    )

    // Nought is shown as well, unlike the badge in the header: here it is the
    // answer to "is there anything left", and nothing is not an answer.
    expect(within(nav.getByRole('link', { name: /Rezultati/ })).getByText('0')).toBeVisible()
  })

  it('names the queue for the tab and the screen reader, and nowhere on the screen', async () => {
    renderAt(`/sr/${QUEUE.leagues.path}`, 'superadmin')

    /* Everything above the work is gone (owner, 30.07.2026). The name stays in
       the markup, because a page with no name is a page a screen reader cannot
       announce and a browser tab cannot title. */
    const name = await screen.findByRole('heading', { level: 1, name: 'Predložene lige' })

    expect(name).toHaveClass('visually-hidden')
    expect(
      within(screen.getByRole('main')).queryByText('Nova liga se objavljuje tek kad je odobrena'),
    ).not.toBeInTheDocument()
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
    await user.type(screen.getByLabelText(/Dužina/), '10')
    await user.type(screen.getByLabelText(/Uspon/), '0')
    await user.type(screen.getByLabelText(/Spust/), '0')
    await user.type(screen.getByLabelText('Sati'), '0')
    await user.type(screen.getByLabelText('Minuta'), '45')
    await user.type(screen.getByLabelText('Sekundi'), '0')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/r')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    await user.click(await screen.findByRole('link', { name: /^Administracija/ }))

    /* The navigation carries the sum of everything waiting (PDL P28a), and it
       says so in the name of the link rather than only in the badge, so a screen
       reader hears the number too. It is the one word of administration that is
       left in the header since 04.08.2026, so the sum stands on that. The sum is
       every queue at once, so the one result is checked on its own row. */
    expect(screen.getByRole('link', { name: /^Administracija, \d+ na čekanju$/ })).toBeVisible()

    await user.click(await screen.findByRole('link', { name: 'Verifikacija' }))

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

  it('says the numbers may be short wherever the numbers are, not only on the way in', async () => {
    const served = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/verification.json')
        ? new Response('nema', { status: 500 })
        : served(input)) as typeof fetch

    try {
      /* The alarm used to stand on the way into the section, which was the only
         screen the numbers were on. They are on all nine now: a moderator who
         opens a queue directly sees eight quiet noughts in the column beside him
         and reads them as an afternoon's work already done. */
      renderAt(`/sr/${QUEUE.leagues.path}`, 'moderator')

      const nav = within(
        await screen.findByRole('navigation', { name: 'Odeljak Verifikacija' }),
      )
      expect(nav.getByRole('alert')).toHaveTextContent(/nije dostupan/)
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

    const nav = within(screen.getByRole('navigation', { name: 'Odeljak Verifikacija' }))
    await user.click(nav.getByRole('link', { name: /Rezultati/ }))

    await waitFor(() => expect(document.title).toContain('Rezultati (administracija)'))
  })

  it('says nothing beside Verification while nothing is waiting', async () => {
    const user = setupUser()
    const served = globalThis.fetch
    // An empty league has nothing to approve, and a zero beside a name is noise.
    vi.stubGlobal('fetch', async () => new Response('[]', { status: 200 }))

    try {
      renderAt('/sr/prijava', 'moderator', '000007')

      await user.click(await screen.findByRole('link', { name: /^Administracija/ }))

      /* No number in the name of the way in, and none beside it. */
      expect(screen.getByRole('link', { name: 'Administracija' })).toBeVisible()
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

    await user.click(first(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })))
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()

    await user.click(first(screen.getAllByRole('button', { name: 'Počasno članstvo' })))
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

    /* The generated members hold 000001 to 000032, so the next free one is
       000033, and every activation after it takes the one after that. The number
       is what the administrator passes on to the member, so it is on screen the
       moment it is given (PDL P8, 30.07.2026). Two of them, because one number
       twice is the fault this is here to catch. */
    await user.click(first(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })))
    await user.click(first(screen.getAllByRole('button', { name: 'Počasno članstvo' })))

    const decided = within(screen.getByRole('table', { name: 'Rešeno' }))
    expect(decided.getByText('000033')).toBeVisible()
    expect(decided.getByText('000034')).toBeVisible()
  })

  it('hands out no number to a membership it sends back', async () => {
    const user = await openPayments()

    await user.click(first(screen.getAllByRole('button', { name: 'Vrati na doradu' })))
    await user.type(screen.getByLabelText('Razlog vraćanja'), 'Uplata nije vidljiva na izvodu.')
    await user.click(screen.getByRole('button', { name: 'Vrati uz ovaj razlog' }))

    /* A refusal leaves the registration waiting for a fee, so a number given
       here would be one nobody could ever use, and the next activation would
       have to skip it for nothing. */
    const decided = within(screen.getByRole('table', { name: 'Rešeno' }))
    expect(decided.queryByText(/^\d{6}$/)).not.toBeInTheDocument()

    await user.click(first(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })))
    expect(within(screen.getByRole('table', { name: 'Rešeno' })).getByText('000033')).toBeVisible()
  })

  it('will not send a membership back without a reason', async () => {
    const user = await openPayments()

    await user.click(first(screen.getAllByRole('button', { name: 'Vrati na doradu' })))

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

    await user.click(first(screen.getAllByRole('button', { name: 'Vrati na doradu' })))

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

    /* Asked for by the name written in it rather than by its place in the table.
       What this test is about is that the box and the buttons are on the same
       person, so the person is what the row is found by, and a table that no
       longer holds him fails saying his name. Held rather than asked for twice,
       because the second click is what takes the row out of the table. */
    const row = within(
      within(screen.getByRole('table', { name: 'Uplate i aktivacija članova' })).getByRole('row', {
        name: /Miodrag Stanković/,
      }),
    )

    await user.click(row.getByRole('button', { name: 'Vrati na doradu' }))

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
    await user.click(row.getByRole('button', { name: 'Evidentiraj uplatu' }))

    expect(screen.queryByLabelText('Razlog vraćanja')).not.toBeInTheDocument()
    const decided = within(screen.getByRole('table', { name: 'Rešeno' }))
    expect(decided.getByText('Odobreno')).toBeVisible()
    expect(decided.getByText('Uplata')).toBeVisible()
    expect(decided.queryByText('Vraćeno')).not.toBeInTheDocument()
  })

  it('closes the reason without deciding anything', async () => {
    const user = await openPayments()

    await user.click(first(screen.getAllByRole('button', { name: 'Vrati na doradu' })))
    await user.click(screen.getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByLabelText('Razlog vraćanja')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()
  })

  it('gives the member form no number an activation has already handed out', async () => {
    const user = setupUser()
    renderAt(`/sr/${QUEUE.payments.path}`, 'superadmin')
    await screen.findByRole('heading', { level: 1, name: 'Uplate i aktivacija članova' })

    /* An activation writes a decision and not a member, so the member form never
       saw the number the activation had just given out: record a fee, get the
       first free number, then enter a member without reloading and get it
       again. Two members
       answered to one number, and because the overlay of changes is keyed by the
       number, changing the town of one of them changed both. That is the fault
       the check for uniqueness used to catch before the field left the form (PDL
       P8, 30.07.2026; ADL A4d). */
    await user.click(first(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })))
    expect(within(screen.getByRole('table', { name: 'Rešeno' })).getByText('000033')).toBeVisible()

    // The same visit, walked the way an administrator walks it: no reload.
    await user.click(await screen.findByRole('link', { name: /^Administracija/ }))
    await user.click(screen.getByRole('link', { name: 'Podaci' }))
    await user.click(await screen.findByRole('link', { name: 'Članovi' }))

    await user.click(await screen.findByRole('button', { name: 'Novi član' }))
    const form = within(screen.getByRole('form', { name: 'Novi član' }))

    /* Pairs rather than a list of lists. Written plainly this is `string[][]`,
       and taking two names out of a list of unknown length is exactly the shape
       that has to be guarded; fixed as pairs, both the label and the value the
       loop takes apart are known to be there. */
    for (const [label, value] of [
      ['Ime', 'Milica'],
      ['Prezime', 'Pavlović'],
      ['Godina rođenja', '1991'],
      ['Mesto', 'Kraljevo'],
      ['U ligi od sezone', '2027'],
    ] as const) {
      await user.type(form.getByLabelText(new RegExp(`^${label}`)), value)
    }
    await user.selectOptions(form.getByLabelText(/^Pol/), 'F')
    await user.selectOptions(form.getByLabelText(/^Država/), 'RS')
    await user.selectOptions(form.getByLabelText(/^Osnov članstva/), 'payment')
    await user.click(form.getByRole('button', { name: 'Sačuvaj' }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    /* The number the activation handed out is spoken for, so the form must not
       hand it out again: the new member is 000034. */
    const list = within(await screen.findByRole('table', { name: 'Članovi' }))
    expect(list.queryByText('000033')).not.toBeInTheDocument()
    expect(within(must(list.getByText('000034').closest('tr'), 'tr')).getByText(/Milica/)).toBeVisible()
  })

  it('says so once every membership has been decided', async () => {
    const user = await openPayments()

    // Three are waiting, and the row of whoever is decided leaves the table, so
    // the first button is a different member every time.
    await user.click(first(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })))
    await user.click(first(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })))
    await user.click(first(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })))

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

  /** The cards waiting on the screen, by the name of the heading over them. The
   *  screen carries the navigation of the whole section beside it now, so a
   *  list asked for without a name is one of two and neither says which. */
  const waitingList = () => screen.getByRole('list', { name: /Čeka proveru/ })

  /** The section standing beside the work, and the counts on it. */
  const sectionNav = () => within(screen.getByRole('navigation', { name: 'Odeljak Verifikacija' }))

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
      await user.click(first(screen.getAllByRole('button', { name: 'Vrati na doradu' })))
      expect(screen.getByRole('button', { name: 'Vrati uz ovaj razlog' })).toBeDisabled()
      expect(
        screen.getByRole('heading', { level: 2, name: `Čeka proveru ${waiting}` }),
      ).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Odustani' }))

      // Approving needs none, and the counter falls the moment it happens.
      await user.click(first(screen.getAllByRole('button', { name: 'Odobri' })))
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

    await user.click(first(screen.getAllByRole('button', { name: 'Obriši' })))

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

    const card = within(first(within(waitingList()).getAllByRole('listitem')))

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

    const card = within(first(within(waitingList()).getAllByRole('listitem')))
    // Two paragraphs with an empty line between them, which is what a biography
    // looks like and what has to survive being published untouched.
    const sent = card.getByText(/Rekreativac iz Čačka/).textContent

    await user.click(card.getByRole('button', { name: 'Objavi' }))

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

    await user.click(first(screen.getAllByRole('button', { name: 'Vrati na doradu' })))

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
      must(
        within(waitingList())
          .getAllByRole('listitem')
          .find((one) => within(one).queryByText('Damjan Krstić') !== null),
        'a waiting card for Damjan Krstić',
      ),
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

  /* An instruction is written to one person, and this portal has no way of
   * writing to nobody: an empty recipient is the whole league (Message.to). A
   * picture with no member behind it is therefore one click away from
   * "Slika je mutna, vidi ti se lice" in the inbox of every member there is. */
  describe('a picture with nobody to send it back to', () => {
    const original = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = original
    })

    it('is decided by the queue rather than by the screen that draws it', () => {
      // Every other queue hands work back to somebody it can name, or does not
      // hand it back at all, so only the one that instructs is asked.
      expect(canSendBack(QUEUE.photos, { memberNumber: '000013' })).toBe(true)
      expect(canSendBack(QUEUE.photos, { memberNumber: '' })).toBe(false)
      expect(canSendBack(QUEUE.teams, { memberNumber: '' })).toBe(true)
    })

    it('offers no way to send it, and says why in the place the button stood', async () => {
      const orphan: PendingItem = {
        id: 'ver-sli-bez-clana',
        queue: 'photos',
        date: '2026-07-27',
        memberNumber: '',
        who: '',
        subject: 'Nepoznat pošiljalac',
        subjectId: '',
        body: 'profilna.jpg',
        currentDate: '',
        proposedDate: '',
        rating: NO_RATING,
        email: '',
        city: '',
        country: '',
      }

      globalThis.fetch = ((input: RequestInfo | URL) =>
        String(input).endsWith('verification.json')
          ? Promise.resolve(
              new Response(JSON.stringify([orphan]), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              }),
            )
          : original(input)) as typeof fetch

      renderAt(`/sr/${QUEUE.photos.path}`, 'moderator')
      await screen.findByRole('heading', { level: 1, name: 'Profilne slike' })

      expect(screen.queryByRole('button', { name: 'Vrati na doradu' })).not.toBeInTheDocument()
      expect(
        screen.getByText(/nema člana kome bi uputstvo stiglo/),
      ).toBeVisible()
      // Approving is still a decision the moderator can take; nothing is sent.
      expect(screen.getByRole('button', { name: 'Odobri' })).toBeVisible()
    })
  })

  it('drops the count beside the queue the moment the work is done', async () => {
    /* What the owner asked for on 30.07.2026: the section stands beside the
       work, and its numbers come down as the work is settled, without leaving
       the screen. Before this the only place that said how much was left
       anywhere was the list of queues, which meant walking back to it. */
    const user = await open('leagues', 'Predložene lige')

    expect(within(sectionNav().getByRole('link', { name: /Predložene lige/ })).getByText('2'))
      .toBeVisible()

    await user.click(first(screen.getAllByRole('button', { name: 'Odobri' })))

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 1' })).toBeVisible()
    expect(within(sectionNav().getByRole('link', { name: /Predložene lige/ })).getByText('1'))
      .toBeVisible()
  })

  it('leads from one queue straight to the next', async () => {
    const user = await open('leagues', 'Predložene lige')

    await user.click(sectionNav().getByRole('link', { name: /Novi timovi/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Novi timovi' })).toBeVisible()
  })

  it('hands the next queue a clean screen, not what the last one was in the middle of', async () => {
    /* Going from one queue straight to another is new: before this it went
       through the way into the section, which built a different screen and took
       this one down with it. Now both are the same element in the same place in
       the tree, and React Router does not key what it renders, so the state of
       one would be waiting on the next. */
    const user = await open('leagues', 'Predložene lige')

    await user.click(first(screen.getAllByRole('button', { name: 'Vrati na doradu' })))
    expect(screen.getByLabelText('Razlog vraćanja')).toBeVisible()

    // Away without cancelling, then back.
    await user.click(sectionNav().getByRole('link', { name: /Novi timovi/ }))
    await screen.findByRole('heading', { level: 1, name: 'Novi timovi' })

    // The box must not be standing open on a screen just arrived at, with the
    // focus taken into it (SendBack takes the focus as it appears).
    expect(screen.queryByLabelText('Razlog vraćanja')).not.toBeInTheDocument()

    await user.click(sectionNav().getByRole('link', { name: /Predložene lige/ }))
    await screen.findByRole('heading', { level: 1, name: 'Predložene lige' })

    expect(screen.queryByLabelText('Razlog vraćanja')).not.toBeInTheDocument()
  })

  it('will not send anything back without a reason', async () => {
    // A team rather than a biography: biographies stopped going back at all
    // (PDL P22, 30.07.2026), so there is nothing to refuse on that queue.
    const user = await open('teams', 'Novi timovi')

    await user.click(first(screen.getAllByRole('button', { name: 'Vrati na doradu' })))

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

    await user.click(first(screen.getAllByRole('button', { name: 'Odobri' })))
    await user.click(first(screen.getAllByRole('button', { name: 'Odobri' })))

    expect(screen.getByText('Nema nijedne stavke na čekanju.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Odobri' })).not.toBeInTheDocument()
  })

  it('shows a biography of three and a half thousand characters whole', async () => {
    await open('bios', 'Trkačke biografije')

    const cards = within(waitingList()).getAllByRole('listitem')
    const longest = first(
      cards.map((card) => card.textContent).sort((a, b) => b.length - a.length),
    )

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

    await user.click(first(screen.getAllByRole('button', { name: 'Odobri' })))

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 3, name: 'Beogradski maraton' })).toHaveLength(1)
  })

  it('closes the reason without deciding anything', async () => {
    const user = await open('photos', 'Profilne slike')

    await user.click(first(screen.getAllByRole('button', { name: 'Vrati na doradu' })))
    await user.click(screen.getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByLabelText('Razlog vraćanja')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()
  })

  it('keeps the focus on the card in both directions', async () => {
    const user = await open('photos', 'Profilne slike')
    const cards = within(waitingList()).getAllByRole('listitem')
    // The second and not the first, because the fault being held is the focus
    // landing on the top card instead of the one the moderator was working on.
    const second = within(at(cards, 1))

    /* The box takes the place of the buttons of its own card, so both directions
       used to drop the focus onto the document and the next Tab started the page
       from the top, past everything (src/app/Dropdown.tsx has the same problem in
       the header). */
    await user.click(second.getByRole('button', { name: 'Vrati na doradu' }))
    expect(second.getByLabelText('Razlog vraćanja')).toHaveFocus()

    await user.click(second.getByRole('button', { name: 'Odustani' }))
    expect(second.getByRole('button', { name: 'Vrati na doradu' })).toHaveFocus()

    // And the card it came from is the one that has it, not the first on screen.
    expect(within(first(cards)).getByRole('button', { name: 'Vrati na doradu' })).not.toHaveFocus()
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
          u: { status: 'approved', note: '', basis: 'payment', memberNumber: '000033' },
        },
      }),
    ).toMatchObject({ teams: 1, payments: 0 })
  })

  it('reports zero for every queue when nothing is waiting', () => {
    const counts = countsFor(empty)

    expect(QUEUES.every((queue) => counts[queue.id] === 0)).toBe(true)
  })
})

describe('the section of entities', () => {
  /** The section standing beside the work, which is where the entities are now
   *  (owner, 30.07.2026). */
  const sectionNav = () => within(screen.getByRole('navigation', { name: 'Odeljak Podaci' }))

  /** The section has no screen of its own: its address opens the first entity
   *  this person may work on, which for the superadmin is the members. */
  const openSection = async (role: 'superadmin' | 'moderator' = 'superadmin') => {
    renderAt('/sr/administracija/entiteti', role)
    await screen.findByRole('navigation', { name: 'Odeljak Podaci' })
  }

  it('offers every entity administration owns, screen or not', async () => {
    /* Eight, not nine: the price list left the section on 30.07.2026, because
       nothing is created or removed on it and that is what the section is. */
    const names = [
      'Članovi',
      'Događaji',
      'Trke',
      'Timovi',
      'Lige',
      'Značke',
      'Statične strane',
      'Moderatori',
    ]

    await openSection()
    /* Eight written out, not counted with the predicate under test: an entity
       wrongly marked fixed would have satisfied that quietly. */
    expect(names).toHaveLength(8)
    expect(ENTITIES).toHaveLength(9)

    const nav = sectionNav()

    for (const name of names) {
      expect(nav.getByRole('link', { name })).toBeVisible()
    }

    expect(nav.getByRole('link', { name: 'Članovi' })).toHaveAttribute(
      'href',
      '/sr/administracija/clanovi',
    )
  })

  it('stays beside the entity being worked on', async () => {
    /* The point of moving them out of the screen and into a navigation: opening
       a second entity was a trip back through the list of entities every time. */
    renderAt('/sr/administracija/clanovi', 'superadmin')

    await screen.findByRole('heading', { level: 1, name: 'Članovi' })

    expect(sectionNav().getByRole('link', { name: 'Događaji' })).toBeVisible()
  })

  it('names the entity for the tab and the screen reader, and nowhere on the screen', async () => {
    renderAt('/sr/administracija/timovi', 'superadmin')

    const name = await screen.findByRole('heading', { level: 1, name: 'Timovi' })

    expect(name).toHaveClass('visually-hidden')
  })

  it('offers a moderator only the entities he was given', async () => {
    /* Owner, 30.07.2026: a moderator is not to be aware that there are actions
       nobody gave him. He used to be shown all nine and refused at the door on
       eight of them, which is a list of rooms he is being kept out of. */
    renderAt(
      '/sr/administracija/entiteti',
      'moderator',
      null,
      moderatorWith(['entity:teams', 'entity:leagues']),
    )

    await screen.findByRole('navigation', { name: 'Odeljak Podaci' })
    const nav = sectionNav()

    expect(nav.getByRole('link', { name: 'Timovi' })).toBeVisible()
    expect(nav.getByRole('link', { name: 'Lige' })).toBeVisible()
    expect(nav.queryByRole('link', { name: 'Članovi' })).not.toBeInTheDocument()
    expect(nav.queryByRole('link', { name: 'Cenovnik' })).not.toBeInTheDocument()
  })

  it('leaves moderators off it for a moderator, who may not assign rights', async () => {
    /* The one entity the two roles do not share, and the one a moderator cannot
       be given: assigning rights is what the superadmin does not hand over
       (PDL P21). */
    await openSection('moderator')

    const nav = sectionNav()

    expect(nav.getByRole('link', { name: 'Članovi' })).toBeVisible()
    expect(nav.queryByRole('link', { name: 'Moderatori' })).not.toBeInTheDocument()
  })

  it('opens an entity from the section', async () => {
    const user = setupUser()
    await openSection()

    await user.click(sectionNav().getByRole('link', { name: 'Statične strane' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Statične strane' }),
    ).toBeVisible()
  })

  it('carries no count, because nothing about an entity is waiting', async () => {
    /* How many members there are is not work to be done, and a number beside
       every entity would mean loading all nine files to draw a navigation. */
    await openSection()

    expect(sectionNav().getByRole('link', { name: 'Članovi' }).textContent).toBe('Članovi')
  })

  it('folds behind a button, for the telephone where it would push the work off', async () => {
    const user = setupUser()
    await openSection()

    /* One button, closed to begin with. Which of the two the screen is wide
       enough for is a question for the stylesheet; what has to be true here is
       that the button says whether the list is open, and that following an
       entry closes it again rather than leaving it over the screen it just
       opened. */
    const toggle = screen.getByRole('button', { name: 'Podaci' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // Pressing it again puts it away, without going anywhere.
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    await user.click(sectionNav().getByRole('link', { name: 'Lige' }))
    expect(screen.getByRole('button', { name: 'Podaci' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('removes a record, once it has been asked twice', async () => {
    /* Owner, 30.07.2026: every row can be deleted. Twice, because nothing brings
       it back and the control stands in a row of twenty beside the one that
       merely opens the record. */
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    const table = () => within(screen.getByRole('table', { name: 'Timovi' }))
    const before = (await screen.findAllByRole('button', { name: /^Obriši:/ })).length
    const remove = first(table().getAllByRole('button', { name: /^Obriši:/ }))
    const name = must(remove.getAttribute('aria-label'), 'a name on the delete control').replace('Obriši: ', '')

    await user.click(remove)
    // Asking is not doing: the row is still there while the question stands.
    expect(table().getByText(name)).toBeVisible()

    await user.click(table().getByRole('button', { name: `Potvrdi brisanje: ${name}` }))

    expect(table().queryAllByRole('button', { name: /^Obriši:/ })).toHaveLength(before - 1)
    expect(table().queryByText(name)).not.toBeInTheDocument()
  })

  it('puts the question away again on second thoughts', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    const table = () => within(screen.getByRole('table', { name: 'Timovi' }))
    const before = (await screen.findAllByRole('button', { name: /^Obriši:/ })).length

    await user.click(first(table().getAllByRole('button', { name: /^Obriši:/ })))
    await user.click(table().getByRole('button', { name: /^Odustani od brisanja:/ }))

    expect(table().queryAllByRole('button', { name: /^Obriši:/ })).toHaveLength(before)
    expect(table().queryByRole('button', { name: /^Potvrdi brisanje:/ })).not.toBeInTheDocument()
  })

  it('sends a moderator with no entity of his own to the front page', async () => {
    /* Not to an empty section. Somebody who may open nothing here has no
       business being told the section exists (owner, 30.07.2026). */
    renderAt('/sr/administracija/entiteti', 'moderator', null, moderatorWith(['queue:results']))

    await expectFrontPage()
  })

  it('puts the list away when the section is left by any other road', async () => {
    /* Following an entry used to be the only thing that closed it, so leaving by
       the header menu or by the browser's back button left the panel standing
       over whatever came next. It is now open at an address rather than open,
       so going anywhere at all closes it. */
    const user = setupUser()
    await openSection()

    await user.click(screen.getByRole('button', { name: 'Podaci' }))

    // Through the header rather than through the panel, which is the road that
    // used to leave it standing open.
    await user.click(await screen.findByRole('link', { name: /^Administracija/ }))
    /* By a pattern, because the count of what is waiting is part of the name of
       that link: "Verifikacija, 17 na čekanju". */
    await user.click(screen.getByRole('link', { name: /^Verifikacija/ }))
    await screen.findByRole('navigation', { name: 'Odeljak Verifikacija' })

    /* Verifikacija and not Cenovnik: the price list sits outside the section of
       records, so the section is gone there whatever the code does and the
       assertion would hold with the behaviour entirely broken. Verifikacija is
       the other section, so the panel of this one has to be put away rather than
       be absent by construction. */
    expect(screen.queryByRole('navigation', { name: 'Odeljak Podaci' })).not.toBeInTheDocument()
  })
})
