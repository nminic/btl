import { formatShortDate } from '../i18n/format'
import sr from '../i18n/sr.json'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PageMetaContext } from '../app/pageMetaContext'
import { PRICES, PROCESSING_FEE_EUR } from '../data/pricing'
import { I18nProvider } from '../i18n/I18nProvider'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionContext, type SessionValue, type SubmissionStatus } from '../session/context'
import { Decided } from '../test/decided'
import { at, first, inputElement, must } from '../test/at'
import { expectFrontPage, moderatorWith, renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { ENTITIES } from './admin/entityList'
import type { PendingItem, PendingQueueId } from '../data/types'
import { NO_RATING } from '../data/types'
import { canSendBack, countFor, QUEUE, QUEUES, returned } from './admin/queues'
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

/** A session holding results in the states the queue has to tell apart. */
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
    resubmit: vi.fn(),
    decide: vi.fn(),
    inbox: [],
    going: {},
    setGoing: vi.fn(),
    markRead: vi.fn(),
    notify: vi.fn(),
    notifications: {
      resultApproved: true,
      resultChanged: true,
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
  it('sends away a moderator who holds nothing at all', async () => {
    /* The address draws no content of its own since 06.08.2026, and a sector
       with nothing in it is not drawn either, so somebody holding no right at
       all arrived at a white screen with a hidden heading, by a link the header
       still offered him. Every other closed door on the portal answers with the
       front page. */
    renderAt('/sr/administracija', 'moderator', null, moderatorWith([]))

    await expectFrontPage()
  })

  it.each([
    ['queue:results', 'Verifikacija'],
    /* Both sides, because either sector on its own is enough: asked only about
       the queues, a moderator who keeps records and decides nothing was turned
       away from a screen with his own work standing on it. */
    ['entity:members', 'Podaci'],
  ])('lets in a moderator who holds only %s', async (right, sector) => {
    renderAt('/sr/administracija', 'moderator', null, moderatorWith([right]))

    expect(await screen.findByRole('button', { name: sector })).toBeVisible()
  })

  it('draws no sector a moderator holds nothing in', async () => {
    /* A moderator is not to be aware that there are actions nobody gave him
       (owner, 30.07.2026). Both sectors were drawn to everybody, and the one he
       held nothing in opened an empty list: a control that answers nothing, and
       an inventory of the rooms he is being kept out of. */
    renderAt(
      '/sr/administracija/verifikacija/rezultati',
      'moderator',
      null,
      moderatorWith(['queue:results']),
    )

    expect(await screen.findByRole('button', { name: 'Verifikacija' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Podaci' })).toBeNull()
  })

  it('draws the other one alone for somebody who only keeps records', async () => {
    renderAt('/sr/administracija/clanovi', 'moderator', null, moderatorWith(['entity:members']))

    expect(await screen.findByRole('button', { name: 'Podaci' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Verifikacija' })).toBeNull()
  })

  it('carries no content of its own, and the work stands beside it', async () => {
    /* Four counts and three links stood here, and every one of them said again
       what the navigation beside it says: the number waiting is on each queue
       and on the bell in the header, and the links led to the two sectors, which
       are the navigation itself (owner, 06.08.2026). */
    renderAt('/sr/administracija', 'moderator')

    expect(await screen.findByRole('heading', { level: 1, name: 'Administracija' })).toBeVisible()
    expect(screen.queryByText('Čeka proveru')).toBeNull()

    /* What is here instead: one navigation of two sectors, on this address as on
       every other administrative one, so nobody arrives at a dead end. The price
       list is one of its entries now rather than a road of its own. */
    expect(screen.getByRole('button', { name: 'Podaci' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Verifikacija' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Cenovnik' })).toBeVisible()
  })

  it('counts what is waiting in one place, and the header says the same', async () => {
    /* The panel used to carry a tile of its own with the same sum on it, which
       is two numbers on one screen and the thing PDL P28a forbids. It is gone
       (owner, 06.08.2026); what is left is the header, and beside every queue
       the number waiting in it. The sum is exact because the data is fixed: an
       "at least" here would survive the counter losing a whole queue. */
    renderAt('/sr/administracija/verifikacija/rezultati', 'superadmin')

    const said = await screen.findByRole('link', { name: /^Administracija, \d+ na čekanju$/ })

    expect(said).toHaveAccessibleName('Administracija, 18 na čekanju')
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
  it('opens the empty form on the day the calendar sent, and on no day otherwise', async () => {
    /* The other half of the `+` in the corner of a calendar day (owner,
       12.08.2026): pressing it is only a saving if the day arrives with it.
       The date is read from the address, so the shortcut is a link and the
       screen has one way of being open rather than two. */
    renderAt('/sr/administracija/dogadjaji?nov=2027-05-08', 'superadmin')

    expect(await screen.findByLabelText(/^Datum$/)).toHaveValue('08/05/2027')

    /* And the same screen without it opens on the list, with nothing being
       written. */
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    expect(await screen.findByRole('table', { name: 'Događaji' })).toBeVisible()
  })

  it('opens the form empty when the address carries a day that does not exist', async () => {
    /* „2027-13-45" has the shape of a date and is not one, and the shape was all
       that was asked: the form opened holding „45/13/2027", a day the calendar
       cannot show and the form refuses only once it is sent. Reachable by hand
       typed address alone, which is exactly why nothing was watching it. */
    renderAt('/sr/administracija/dogadjaji?nov=2027-13-45', 'superadmin')

    expect(await screen.findByLabelText(/^Datum$/)).toHaveValue('')
  })

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

  it('writes both currencies the same way, in the language of the page', async () => {
    /* The dinar figure went through a formatter and the euro one went out raw
       beside it, so a Serbian sentence read „35.5 EUR, a iz Srbije 4.200 RSD":
       one amount with a Serbian thousands separator and the other with the
       decimal point of another language. The form takes decimals, so this is
       reachable by an administrator with no unusual intent.

       The formatter is also no longer told which language to use. It was pinned
       to `sr-Latn` on a screen that has the page's own language to hand. */
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Cenovnik' })

    /* Thousands grouped the Serbian way, and nothing carrying a foreign point. */
    expect(within(table).getAllByText('4.200').length).toBeGreaterThan(0)
    expect(within(table).queryByText(/\d\.\d{1,2}$/)).not.toBeInTheDocument()
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
    /* Five in the table and a sixth under it: the amount of a referral is set
       on this screen too (owner, 12.08.2026) and goes through the same form,
       which asks for a name, euro and dinars and nothing else. */
    expect(within(table).getAllByRole('button', { name: /^Otvori:/ }).length).toBe(5)
    expect(screen.getAllByRole('button', { name: /^Otvori:/ }).length).toBe(6)
  })

  it('sets the referral amount here as well, apart from the prices', async () => {
    /* Owner, 12.08.2026: „ovo admin treba da konfiguriše na strani cenovnika
       takođe." Apart, because nobody pays it: it is credited, so it has no
       window in the year and no bearing on the right to be ranked, and two of
       the five columns of the price table would have had nothing to say. */
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Preporuka' })

    /* One row of prices under one row of headings, so the words are the row. */
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(within(table).getByText('Preporuka novog člana')).toBeVisible()
    expect(within(table).getByText('5')).toBeVisible()
    expect(within(table).getByText('600')).toBeVisible()
    /* And it is not among the prices, where it would read as something a member
       pays. */
    expect(
      within(screen.getByRole('table', { name: 'Cenovnik' })).queryByText('Preporuka novog člana'),
    ).toBeNull()
  })

  it('opens the referral amount in the same form every price is changed in', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    await screen.findByRole('table', { name: 'Preporuka' })
    await user.click(screen.getByRole('button', { name: 'Otvori: Preporuka novog člana' }))

    /* The form of a price, which asks for a name, euro and dinars and nothing
       else: a credit has no window in the year and nothing to say about the
       right to be ranked, so it fits this form exactly. */
    expect(await screen.findByLabelText(/^Iznos u evrima/)).toHaveValue(5)
    expect(screen.getByLabelText(/^Iznos u dinarima/)).toHaveValue(600)
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

  it('stands in Podaci with the rest of the records', async () => {
    /* It was outside both sections, because nothing is created or removed on it
       and the section was about creating and removing. What that produced was a
       screen in no section, which the panel had to link to because nothing else
       did. The section is Podaci now, and a price list is data (owner,
       06.08.2026). */
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    await screen.findByRole('table', { name: 'Cenovnik' })

    expect(screen.getByRole('navigation', { name: 'Odeljak Podaci' })).toBeVisible()
  })

  it('changes what a period costs and what it is called, and nothing else', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    await screen.findByRole('table', { name: 'Cenovnik' })
    await user.click(screen.getByRole('button', { name: 'Otvori: 1. do 5. oktobra' }))

    /* Three fields and no more. The window is the year itself and is not
       something an administrator types (owner, 30.07.2026); it used to ask for a
       date from and a date to, which is how a price list expires.

       „Naziv" and not „Naziv perioda" since 12.08.2026: the same form now opens
       for the referral amount, which is a row of the price list with no period
       at all. The column header of the price table still says „Naziv perioda",
       because there every row is one. */
    expect(screen.getByLabelText('Naziv')).toBeVisible()
    expect(screen.queryByLabelText(/Važi od/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Važi do/)).not.toBeInTheDocument()

    const eur = screen.getByLabelText(/Iznos u evrima/)
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

  it('says the number beside a queue in words, not as a bare digit', async () => {
    /* The digit beside the name is hidden from a screen reader and the name
       carries the number instead, because "Rezultati 1" read out is a number with
       no unit. Nothing read the accessible name until the twelfth review said so:
       every test matched the link by its visible words and then read the digit. */
    renderAt('/sr/administracija/verifikacija/rezultati', 'superadmin')

    const sector = within(await screen.findByRole('navigation', { name: 'Odeljak Verifikacija' }))

    expect(sector.getByRole('link', { name: /^Rezultati, / })).toHaveAccessibleName(
      /^Rezultati, \d+ (na čekanju|na čekanja|nema)/,
    )
  })

  it('says how many events a search found, not only how many it drew', async () => {
    /* The list stops at sixty. The screen of races said so and the screen of
       events never did, and since 06.08.2026 this is the only way to a race: a
       search matching five hundred events drew the earliest sixty and said
       "Prikazano: 60", with everything from this season on behind a cut that
       nothing on the page mentioned. */
    const user = setupUser()
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    await user.type(await screen.findByLabelText(/Pretraga/), 'a')

    const count = await screen.findByText(/Prikazano: 60/)

    expect(count).toHaveTextContent(/od \d/)
    expect(count).toHaveTextContent(/Suzi pretragu/)
  })

  it('says where somebody waiting to be activated is from, in words', async () => {
    /* The town and the country under it are what a moderator has to go by before
       the fee is recorded (PDL P8). The country arrives as a code and the card
       used to ask the dictionary for it, which held the five of the region only;
       it reads the file the select is filled from now (countryName), and no test
       touched this cell at all until the ninth review said so. */
    renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

    const waiting = await screen.findByRole('table', { name: 'Uplate i aktivacija članova' })
    const cells = within(waiting).getAllByRole('cell')

    expect(cells.filter((cell) => cell.textContent?.includes('Srbija')).length).toBeGreaterThan(0)
    expect(within(waiting).queryByText(/country\./)).toBeNull()
    expect(within(waiting).queryByText(/^RS$/)).toBeNull()
  })

  /* The statement, as the way a hundred payments are reconciled at once (owner,
     31.07.2026). Turning the file into decisions is the server's work and the
     server does not exist yet, so what it does today is take the file and say
     so; what it can honestly refuse is a file that is not a statement at all. */
  it('does not promise a message on the queue that sends none', async () => {
    /* The payments queue draws the same box as the others and passes no words of
       its own, so it takes whatever the default is. That default promised „Član
       dobija tvoj razlog" until 15.08.2026, while `notify` is not called from
       that screen at all: a moderator was told the member would read what they
       were writing.
     *
       Read off the screen rather than off the default, because what is being
       guarded is what a moderator sees. A review changed the default back and
       every test passed, since nothing opened this box. */
    const user = setupUser()
    renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

    await user.click(first(await screen.findAllByRole('button', { name: 'Odbij' })))

    expect(screen.getByLabelText('Razlog odbijanja')).toHaveAttribute(
      'placeholder',
      sr.review.reasonKeptPlaceholder,
    )
  })

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

    const pick = inputElement(await screen.findByLabelText('Izaberi PDF izvoda'))

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

    const pick = inputElement(await screen.findByLabelText('Izaberi PDF izvoda'))

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

    const pick = inputElement(await screen.findByLabelText('Izaberi PDF izvoda'))

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

  it('says the reason has to be written, in both ways a field says it', async () => {
    /* Owner, 12.08.2026: „Ova pravila... treba da funkcioniše na svim formama za
       unos i verifikaciju." This box is not built by the renderer, so it carries
       the rule itself: a star for the eye and `aria-required` for a reader.
       Without them the button below simply stayed dead and nothing said why.

       And the star outside the label, or „Razlog odbijanja" is not the name of
       this field any more. */
    const { user } = openWith(['pending'])

    await user.click(screen.getByRole('button', { name: 'Odbij' }))

    const reason = screen.getByLabelText('Razlog odbijanja')

    expect(reason).toHaveAttribute('aria-required', 'true')
    expect(
      must(reason.closest('.rankings__field'), 'the field it stands in').querySelector(
        '.field__required',
      ),
    ).not.toBeNull()
    /* And it does not promise a message. This queue has a field of its own rather
       than the shared box, so it carries its own words, and it kept the promising
       ones after the shared default was corrected. Nothing measured that: a review
       put them back and all 1905 tests passed. `notify` is never called from this
       screen (PENDING R9b). */
    expect(reason).toHaveAttribute('placeholder', sr.review.reasonKeptPlaceholder)
  })

  it('takes no reason made of spaces, and writes down the one it takes trimmed', async () => {
    const { user, session } = openWith(['pending'])

    await user.click(screen.getByRole('button', { name: 'Odbij' }))

    const confirm = screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })
    const reason = screen.getByLabelText('Razlog odbijanja')

    await user.type(reason, '   ')
    /* Told off, not switched off: the button stays reachable so the line saying
       why it will not go is reachable with it. */
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(confirm).not.toBeDisabled()
    expect(confirm).toHaveAccessibleDescription('Upiši razlog da bi mogao da pošalješ.')
    expect(session.decide).not.toHaveBeenCalled()

    /* And pressed, not merely inspected. Reachable means pressable, so the
       refusal has to live in the handler as well as in the attribute, and
       without it three spaces go back to the member as a reason. */
    await user.click(confirm)

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

      await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))
      expect(screen.getByLabelText('Razlog odbijanja')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(screen.queryByLabelText('Razlog odbijanja')).not.toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: 'Odbij' }))
    expect(screen.getByLabelText('Razlog odbijanja')).toBeInTheDocument()

    /* The box stands below the table, so it used to survive the decision taken by
       the buttons in the row: confirming it afterwards refused a result that had
       just been approved, without a word. */
    await user.click(screen.getByRole('button', { name: 'Odobri' }))

    expect(screen.queryByLabelText('Razlog odbijanja')).not.toBeInTheDocument()
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

    // Nought is shown as well, unlike the ducat in the header: here it is the
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
       says so in the name of the link rather than only in the ducat, so a screen
       reader hears the number too. It is the one word of administration that is
       left in the header since 04.08.2026, so the sum stands on that. The sum is
       every queue at once, so the one result is checked on its own row. */
    expect(screen.getByRole('link', { name: /^Administracija, \d+ na čekanju$/ })).toBeVisible()

    /* The sector is a navigation of its own now, so its entries stand beside
       every administrative screen rather than behind a road to a section. */
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
        : served(input))

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
        : served(input))

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
        : served(input))

    try {
      /* The alarm used to stand on the way into the section, which was the only
         screen the numbers were on. The landing draws nothing of its own since
         06.08.2026 and the numbers are in the navigation beside every screen: a
         moderator who opens a queue directly sees eight quiet noughts in the
         column beside him and reads them as an afternoon's work already done. */
      renderAt(`/sr/${QUEUE.leagues.path}`, 'moderator')

      const nav = within(
        await screen.findByRole('navigation', { name: 'Odeljak Verifikacija' }),
      )
      const alarm = nav.getByRole('alert')

      expect(alarm).toHaveTextContent(/nije dostupan/)
      /* Outside the folded list, not inside it. Below 51.25em the list is
         `display: none` until it is unfolded, and an alert drawn hidden is never
         announced: the warning was silent on the screen it matters most on.

         What folds is what the button opens, and the button says which that is,
         so this is read off the button rather than off a class name. */
      const opens = nav.getByRole('button', { name: 'Verifikacija' }).getAttribute('aria-controls')
      const panel = opens === null ? null : document.getElementById(opens)

      expect(panel).not.toBeNull()
      expect(panel?.contains(alarm)).toBe(false)
    } finally {
      globalThis.fetch = served
    }
  })

  it('raises no alarm over a file none of the numbers come from', async () => {
    const served = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/competitors.json')
        ? new Response('nema', { status: 500 })
        : served(input))

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

    /* Moved to a queue that has something in it: an empty queue is not in the
       navigation any more (owner, 06.08.2026), and the results are empty until
       somebody sends one in during the visit. */
    const nav = within(screen.getByRole('navigation', { name: 'Odeljak Verifikacija' }))
    await user.click(nav.getByRole('link', { name: /Komentari/ }))

    await waitFor(() => expect(document.title).toContain('Komentari (administracija)'))
  })

  it('leaves an empty queue out of the navigation, and keeps the one being worked in', async () => {
    /* Owner, 06.08.2026. A name that leads to "nothing is waiting" is a step
       taken for nothing, and a moderator reads this list to find work rather
       than to count doors. The results are the empty one until somebody sends a
       result in during the visit. */
    renderAt(`/sr/${QUEUE.comments.path}`, 'moderator')

    const nav = within(await screen.findByRole('navigation', { name: 'Odeljak Verifikacija' }))

    expect(nav.getByRole('link', { name: /Komentari/ })).toBeVisible()
    expect(nav.queryByRole('link', { name: /Rezultati/ })).toBeNull()
  })

  it('draws every queue where the moderator has nothing waiting anywhere', async () => {
    /* Somebody with no work this morning, not somebody to be shown a section
       with no way out of it: the landing draws nothing of its own, so an empty
       navigation beside it is an empty screen. */
    const served = globalThis.fetch
    vi.stubGlobal('fetch', async () => new Response('[]', { status: 200 }))

    try {
      renderAt('/sr/administracija', 'moderator')

      const nav = within(await screen.findByRole('navigation', { name: 'Odeljak Verifikacija' }))

      expect(nav.getAllByRole('link').length).toBeGreaterThan(1)
    } finally {
      vi.stubGlobal('fetch', served)
    }
  })

  it('keeps the queue in view even after the last thing in it is decided', async () => {
    /* Otherwise the entry disappears from under the moderator at the moment of
       the last decision, and they are left standing on a screen the navigation
       beside them says is not there. */
    const user = setupUser()
    renderAt(`/sr/${QUEUE.leagues.path}`, 'moderator')

    await screen.findByRole('heading', { level: 1, name: 'Predložene lige' })

    const nav = () => within(screen.getByRole('navigation', { name: 'Odeljak Verifikacija' }))

    while (screen.queryAllByRole('button', { name: 'Odobri' }).length > 0) {
      await user.click(first(screen.getAllByRole('button', { name: 'Odobri' })))
    }

    expect(screen.getByText('Nema nijedne stavke na čekanju.')).toBeVisible()
    expect(nav().getByRole('link', { name: /Predložene lige/ })).toBeVisible()
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
      expect(screen.getByRole('button', { name: 'Verifikacija' })).toBeVisible()
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
    renderAt(`/sr/${QUEUE.payments.path}`, 'moderator', null, undefined, null, <Decided />)
    /* The table and not the heading. The heading is drawn before the records
       arrive, so a test that waited on it went looking for a button that was not
       there yet: it failed once in a run of the coverage gate and passed on the
       next, which is the worst way for a test to fail. */
    await screen.findByRole('table', { name: 'Uplate i aktivacija članova' })

    return user
  }

  /* What the session was told, which is where a decision lives now: the queue
     draws what is waiting and nothing else since 06.08.2026. Every line is one
     decision, written as id, state, reason, ground, member number. */
  const decidedLines = () =>
    within(screen.getByRole('list', { name: 'session decisions' }))
      .queryAllByRole('listitem')
      .map((one) => String(one.textContent))

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
    const lines = decidedLines()

    expect(lines.filter((line) => line.includes('| payment |'))).toHaveLength(1)
    expect(lines.filter((line) => line.includes('| honorary |'))).toHaveLength(1)
  })

  it('shows the number it handed out on screen, beside who it went to', async () => {
    const user = await openPayments()

    /* The generated members hold 000001 to 000032, so the next free one is
       000033, and every activation after it takes the one after that. The number
       is what the administrator passes on to the member, so it is on screen the
       moment it is given (PDL P8, 30.07.2026). Two of them, because one number
       twice is the fault this is here to catch. */
    await user.click(first(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })))
    await user.click(first(screen.getAllByRole('button', { name: 'Počasno članstvo' })))

    /* On the screen and not only in the session: a member number is the first
       thing the administrator passes on to whoever paid (PDL P8), and the table
       of settled items that used to carry it is gone (owner, 06.08.2026). */
    const said = within(screen.getByRole('status', { name: 'Dodeljeni članski brojevi' }))
    const lines_shown = said.getAllByRole('listitem').map((one) => String(one.textContent))

    /* Each number beside the name it went to: a list of numbers with nobody
       against them is a list the administrator has to match up from memory. */
    expect(lines_shown.filter((line) => /000033/.test(line) && /\p{L}/u.test(line))).toHaveLength(1)
    expect(lines_shown.filter((line) => /000034/.test(line) && /\p{L}/u.test(line))).toHaveLength(1)

    const lines = decidedLines()

    expect(lines.some((line) => line.endsWith('000033'))).toBe(true)
    expect(lines.some((line) => line.endsWith('000034'))).toBe(true)
  })

  it('has the region for the numbers before there is a number to put in it', async () => {
    /* A live region added to the page together with its text is the kind a
       screen reader misses, which is the rule the sweep line beside it keeps
       (Swept). So it is drawn empty and says so. */
    await openPayments()

    const said = within(screen.getByRole('status', { name: 'Dodeljeni članski brojevi' }))

    expect(said.getByText('Još nijedan broj nije dodeljen na ovom ekranu.')).toBeVisible()
    expect(said.queryAllByRole('listitem')).toEqual([])
  })

  it('still says the numbers after the moderator has been somewhere else', async () => {
    /* Held in the session and not in the screen: a number given is a number the
       administrator writes to whoever paid, and a walk to another queue and back
       used to take it away. */
    const user = setupUser()
    const { router } = renderAt(`/sr/${QUEUE.payments.path}`, 'moderator')

    await screen.findByRole('heading', { level: 1, name: 'Uplate i aktivacija članova' })
    await user.click(first(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })))

    await router.navigate(`/sr/${QUEUE.comments.path}`)
    await screen.findByRole('heading', { level: 1, name: 'Komentari' })
    await router.navigate(`/sr/${QUEUE.payments.path}`)

    const said = within(
      await screen.findByRole('status', { name: 'Dodeljeni članski brojevi' }),
    )

    expect(said.getByText('000033')).toBeVisible()
  })

  it('hands out no number to a membership it sends back', async () => {
    const user = await openPayments()

    await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))
    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Uplata nije vidljiva na izvodu.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

    /* A refusal leaves the registration waiting for a fee, so a number given
       here would be one nobody could ever use, and the next activation would
       have to skip it for nothing. */
    expect(decidedLines().filter((line) => /\d{6}$/.test(line))).toEqual([])

    await user.click(first(screen.getAllByRole('button', { name: 'Evidentiraj uplatu' })))
    expect(decidedLines().some((line) => line.endsWith('000033'))).toBe(true)
  })

  it('will not send a membership back without a reason', async () => {
    const user = await openPayments()

    await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))

    const confirm = screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })
    /* Told off, not switched off: the button stays reachable so the line saying
       why it will not go is reachable with it. */
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(confirm).not.toBeDisabled()
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()

    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Uplata nije vidljiva na izvodu.')
    await user.click(confirm)

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()
    expect(decidedLines().some((line) => line.includes('Uplata nije vidljiva na izvodu.'))).toBe(
      true,
    )
  })

  it('does not take spaces for a reason', async () => {
    const user = await openPayments()

    await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))

    const confirm = screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })
    /* Three spaces are not a reason. The rule is one rule on all seven queues,
       and it is the rule the forms already use (src/forms/validate.ts). */
    await user.type(screen.getByLabelText('Razlog odbijanja'), '   ')
    /* Told off, not switched off: the button stays reachable so the line saying
       why it will not go is reachable with it. */
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(confirm).not.toBeDisabled()

    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Izvod ne pokazuje uplatu.   ')
    await user.click(confirm)

    // And what is written down has no spaces hanging off it either.
    expect(decidedLines().some((line) => line.includes('| Izvod ne pokazuje uplatu. |'))).toBe(
      true,
    )
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

    await user.click(row.getByRole('button', { name: 'Odbij' }))

    /* The box hangs below the table, so on a list of twenty there is nothing on
       screen that says whose membership it decides unless it says so itself. The
       name is what it says, because a member number is exactly what a row here
       does not have yet (PDL P8, 30.07.2026). */
    const box = screen.getByRole('group', { name: /Odbijanje/ })
    expect(box).toHaveAccessibleName('Odbijanje: Miodrag Stanković')
    expect(within(box).getByText(/Miodrag Stanković/)).toBeVisible()
    // And the field it opens on has the focus, not the document body.
    expect(screen.getByLabelText('Razlog odbijanja')).toHaveFocus()

    /* The row is decided by the buttons beside it while the box is open. Before,
       the box stayed open over a member who was already active, and confirming it
       replaced the activation with a refusal, quietly, and the ground of the
       membership went with it. */
    await user.click(row.getByRole('button', { name: 'Evidentiraj uplatu' }))

    expect(screen.queryByLabelText('Razlog odbijanja')).not.toBeInTheDocument()
    const lines = decidedLines()

    expect(lines.some((line) => line.includes('| approved |'))).toBe(true)
    expect(lines.some((line) => line.includes('| payment |'))).toBe(true)
    expect(lines.filter((line) => line.includes('| rejected |'))).toEqual([])
  })

  it('closes the reason without deciding anything', async () => {
    const user = await openPayments()

    await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))
    await user.click(screen.getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByLabelText('Razlog odbijanja')).not.toBeInTheDocument()
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

    // The same visit, walked the way an administrator walks it: no reload.
    await user.click(await screen.findByRole('link', { name: /^Administracija/ }))
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
    expect(decidedLines()).toHaveLength(3)
  })
})

describe('the six queues read from the file', () => {
  const open = async (queue: PendingQueueId, title: string) => {
    const user = setupUser()
    renderAt(`/sr/${QUEUE[queue].path}`, 'moderator', null, undefined, null, <Decided />)
    await screen.findByRole('heading', { level: 1, name: title })

    return user
  }

  /** The cards waiting on the screen, by the name of the heading over them. The
   *  screen carries the navigation of the whole section beside it now, so a
   *  list asked for without a name is one of two and neither says which. */
  const waitingList = () => screen.getByRole('list', { name: /Čeka proveru/ })

  /** The section standing beside the work, and the counts on it. */
  const sectionNav = () => within(screen.getByRole('navigation', { name: 'Odeljak Verifikacija' }))

  const QUEUES: [PendingQueueId, string, number][] = [
    ['leagues', 'Predložene lige', 2],
    ['teams', 'Novi timovi', 2],
    ['schedule', 'Prijave promene termina', 3],
  ]

  it.each(QUEUES)(
    'has something waiting in %s, and decides it both ways',
    async (queue, title, waiting) => {
      const user = await open(queue, title)

      // A queue with no data cannot be reviewed at all, so every one of them is
      // generated with items in it.
      expect(
        screen.getByRole('heading', { level: 2, name: `Čeka proveru ${waiting}` }),
      ).toBeVisible()
      expect(screen.getAllByRole('button', { name: 'Odobri' })).toHaveLength(waiting)
      expect(screen.getAllByRole('button', { name: 'Odbij' })).toHaveLength(waiting)

      // The rule on these queues: no reason, no sending back.
      await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))
      /* Told off, not switched off: the button stays reachable so the line saying
         why it will not go is reachable with it. */
      const confirm = screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })

      expect(confirm).toHaveAttribute('aria-disabled', 'true')
      expect(confirm).not.toBeDisabled()
      expect(confirm).toHaveAccessibleDescription('Upiši razlog da bi mogao da pošalješ.')

      /* Pressed with nothing written, on the box five queues share. Reachable
         means pressable, so the refusal has to live in the handler too: without
         it this sends the item back with no reason at all, on all five. */
      await user.click(confirm)

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

  /* Comments go their own way (PDL P22, 30.07.2026): accepted or deleted, and
     nothing at all is sent to the member either way. The word is half the
     decision. "Odbijeno" reads as a refused comment being kept somewhere it
     could be brought back from, and there is no such place.

     Deleting asks for a note since 06.08.2026, and the note may be left empty:
     it is a trace for whoever reads the queue next, not a reason given to
     anybody. A trace nobody is obliged to leave is a trace that gets left; one
     that is obliged is three dots typed to get past a button. */
  it('moves the event when a reported change of date is approved', async () => {
    /* Owner, 06.08.2026. Approving used to do nothing beyond taking the card off
       the screen: a moderator who agreed that a race had been put off left the
       calendar saying the old day, and the next visitor read the wrong date from
       a report the league had already accepted. */
    const user = setupUser()
    const { router } = renderAt(`/sr/${QUEUE.schedule.path}`, 'superadmin')

    await screen.findByRole('heading', { level: 1, name: 'Prijave promene termina' })

    const card = within(
      must(
        within(screen.getByRole('list', { name: /Čeka proveru/ }))
          .getAllByRole('listitem')
          .find((one) => (one.textContent ?? '').includes('Beogradski maraton')),
        'a reported change of date',
      ),
    )

    expect(card.getByText('10. 4. 2027.')).toBeVisible()

    await user.click(card.getByRole('button', { name: 'Odobri' }))

    /* Where the administration reads it. */
    await router.navigate('/sr/administracija/dogadjaji')
    await user.type(await screen.findByLabelText(/Pretraga/), 'Beogradski maraton')

    const rows = within(await screen.findByRole('table', { name: 'Događaji' }))

    expect(rows.getByText('10. 4. 2027.')).toBeVisible()
    expect(rows.queryByText('3. 4. 2027.')).toBeNull()

    /* And the races with it, by the same number of days. This event runs over
       two mornings, so approving the report used to leave both races a week
       before the event they belong to, and the page a visitor reads said so. */
    const listed = must(
      within(await screen.findByRole('table', { name: 'Događaji' }))
        .getAllByRole('row')
        /* The 2027 one: the name has been run every year since 2010 and the
           list holds every year of it. */
        .find(
          (one) =>
            /Beogradski maraton/.test(one.textContent ?? '') && /2027/.test(one.textContent ?? ''),
        ),
      'the event that was moved',
    )

    await user.click(within(listed).getByRole('button', { name: /^Otvori/ }))

    const races = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => String(at(within(row).getAllByRole('cell'), 0).textContent))

    expect(races).toEqual(['10. 4. 2027.', '11. 4. 2027.'])
  })

  it('folds a card open and shut, one at a time', async () => {
    /* On a telephone a card is a screenful, so five of them mean scrolling
       through four to reach the third (owner, 06.08.2026). The control is drawn
       at every width in the markup and hidden by the stylesheet from 51.25em up,
       exactly as the sectors of the navigation are, so what is held here is the
       folding itself. */
    const user = await open('comments', 'Komentari')

    const cards = within(waitingList()).getAllByRole('listitem')
    const first_card = within(at(cards, 0))
    const second = within(at(cards, 1))

    /* The part of the card the control opens, found through the control rather
       than by a class name: what has to hold is that pressing it marks that part
       as open, since the stylesheet draws the card off that mark and jsdom lays
       nothing out. The button's own label proves nothing: it reads off the same
       state either way. */
    const bodyOf = (card: ReturnType<typeof within>) => {
      const opens = card.getByRole('button', { name: /^(Prikaži|Sakrij): / }).getAttribute('aria-controls')

      return must(document.getElementById(String(opens)), 'the part of the card that folds')
    }

    expect(first_card.getByRole('button', { name: /^Prikaži: / })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(bodyOf(first_card).className).not.toContain('--open')

    await user.click(first_card.getByRole('button', { name: /^Prikaži: / }))

    expect(first_card.getByRole('button', { name: /^Sakrij: / })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(bodyOf(first_card).className).toContain('--open')

    /* One at a time: two open cards on a telephone are the scrolling this was
       meant to end. */
    await user.click(second.getByRole('button', { name: /^Prikaži: / }))

    expect(bodyOf(second).className).toContain('--open')
    expect(bodyOf(first_card).className).not.toContain('--open')

    await user.click(second.getByRole('button', { name: /^Sakrij: / }))

    expect(bodyOf(second).className).not.toContain('--open')
  })

  it('names the part of the card the control opens', async () => {
    /* The control says which region it opens, so a screen reader moving by
       controls knows what is about to appear rather than hearing "Prikaži" four
       times over. */
    await open('comments', 'Komentari')

    const card = within(first(within(waitingList()).getAllByRole('listitem')))
    const opens = card.getByRole('button', { name: /^Prikaži: / }).getAttribute('aria-controls')

    expect(opens).not.toBeNull()
    expect(document.getElementById(String(opens))).not.toBeNull()
  })

  it('moves a race entered during the visit, and moves it from the day it now has', async () => {
    /* Two things the queue reads through the session rather than off the file:
       a race entered or re-dated during this visit is moved with its event, and
       the day it is moved from is the day the event is on now. A report written
       a fortnight ago may name a day the event has since left. */
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const find2027 = async () => {
      const search = await screen.findByLabelText(/Pretraga/)

      await user.clear(search)
      await user.type(search, 'Beogradski maraton')

      return must(
        within(await screen.findByRole('table', { name: 'Događaji' }))
          .getAllByRole('row')
          .find(
            (one) =>
              /Beogradski maraton/.test(one.textContent ?? '') &&
              /2027/.test(one.textContent ?? ''),
          ),
        'the event of 2027',
      )
    }

    /* A race added to it this visit, on the day the event begins. */
    await user.click(within(await find2027()).getByRole('button', { name: /^Otvori/ }))
    await user.click(await screen.findByRole('button', { name: 'Nova trka' }))
    await user.type(screen.getByLabelText(/^Dužina/), '5')
    await user.type(screen.getByLabelText(/^Uspon/), '0')
    await user.type(screen.getByLabelText(/^Spust/), '0')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    /* And the event moved a day on before the report is answered, so the day the
       report names is a day the event has already left. */
    const date = screen.getByLabelText(/^Datum/)

    await user.clear(date)
    await user.type(date, '04042027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    /* And the change of date accepted, onto 10 April: six days from where the
       event stands now, not seven from where the report says it stood. */
    await router.navigate(`/sr/${QUEUE.schedule.path}`)

    const card = within(
      must(
        within(await screen.findByRole('list', { name: /Čeka proveru/ }))
          .getAllByRole('listitem')
          .find((one) => (one.textContent ?? '').includes('Beogradski maraton')),
        'the reported change of date',
      ),
    )

    await user.click(card.getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/administracija/dogadjaji')
    await user.click(within(await find2027()).getByRole('button', { name: /^Otvori/ }))

    const races = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
    /* Found by its length, since a race carries no name of its own
       (data/types.ts). Five kilometres is a length no other race of this event
       has, which is why it was the one entered. */
    const mine = must(
      races.getAllByRole('row').find((one) => (one.textContent ?? '').includes('5,00')),
      'the race entered during the visit',
    )

    /* Moved with everything else, rather than left on the day it was entered on,
       and moved by six days rather than seven. */
    expect(within(mine).getByText('10. 4. 2027.')).toBeVisible()

    /* And the second report of the same change moves nothing more. Two
       independent reports are what a reported change is made of (PDL P10), so
       answering both is the ordinary case, and answering the second from the day
       the first one named would move the races a second time. */
    await router.navigate(`/sr/${QUEUE.schedule.path}`)

    const second = within(
      must(
        within(await screen.findByRole('list', { name: /Čeka proveru/ }))
          .getAllByRole('listitem')
          .find((one) => (one.textContent ?? '').includes('Beogradski maraton')),
        'the second report of the same change',
      ),
    )

    await user.click(second.getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/administracija/dogadjaji')
    await user.click(within(await find2027()).getByRole('button', { name: /^Otvori/ }))

    const after = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => String(at(within(row).getAllByRole('cell'), 0).textContent))

    expect(after).toEqual(['10. 4. 2027.', '10. 4. 2027.', '11. 4. 2027.'])
  })

  it('deletes a comment with a note nobody has to write', async () => {
    const user = await open('comments', 'Komentari')

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 4' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Odbij' })).not.toBeInTheDocument()

    await user.click(first(screen.getAllByRole('button', { name: /^Obriši: / })))

    /* Not a reason: the words say what it is and what it is for, and so does
       the name of the box around them. The one word this queue must not use is
       "Odbij": a deleted comment is not kept anywhere it could be brought back
       from (queues.ts). */
    expect(screen.getByRole('group', { name: /^Brisanje komentara: / })).toBeVisible()
    expect(screen.queryByRole('group', { name: /^Odbijanje: / })).toBeNull()

    /* „(neobavezno)" beside its name, as every optional field on the portal
       carries: this is the one hand written field that may be left empty, and it
       said nothing at all about itself while the obligatory ones beside it
       carried a star (forms/AskedLabel.tsx). */
    const note = screen.getByLabelText('Napomena o brisanju (neobavezno)')
    expect(screen.queryByLabelText('Razlog odbijanja')).not.toBeInTheDocument()

    const confirm = screen.getByRole('button', { name: 'Obriši komentar' })
    // Empty is an answer here, unlike everywhere else the box is opened.
    expect(confirm).toBeEnabled()

    await user.type(note, 'Reklama za prodavnicu opreme.')
    await user.click(confirm)

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()

    const decided = within(screen.getByRole('list', { name: 'session decisions' }))
    expect(decided.getAllByRole('listitem')).toHaveLength(1)
    expect(decided.getByText(/Reklama za prodavnicu opreme\./)).toBeVisible()
  })

  it('takes an empty note for a deletion, which is the whole point of it', async () => {
    const user = await open('comments', 'Komentari')

    await user.click(first(screen.getAllByRole('button', { name: /^Obriši: / })))
    await user.click(screen.getByRole('button', { name: 'Obriši komentar' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()
    expect(
      within(screen.getByRole('list', { name: 'session decisions' })).getAllByRole('listitem'),
    ).toHaveLength(1)
  })


  it('holds the text and the picture in one queue, decided each its own way', async () => {
    /* Owner, 06.08.2026: the same member's profile is one thing to look at, so
       the two used to be two queues and are one. What is done with them is not
       quite one thing: both go back to the member when they are refused, and
       what the moderator is asked to write differs. A biography is refused with
       a reason and the member writes another; a picture is handed back with an
       instruction precise enough to work from, which is what the empty box on
       that card asks for (PDL P22). */
    await open('profiles', 'Trkački profil')

    const cards = within(waitingList()).getAllByRole('listitem')
    const texts = cards.filter((one) => within(one).queryByText('Tekst biografije') !== null)
    const pictures = cards.filter((one) => within(one).queryByText('Datoteka') !== null)

    expect(texts).toHaveLength(2)
    expect(pictures).toHaveLength(2)

    /* The same two decisions on both sorts. „Objavi" stood on a biography
       alone until 15.08.2026, when the code caught up with the decision that
       took it away (PDL P22, 06.08.2026): a word that says the moderator lets
       something out belongs to a text they may rewrite, and they may not. */
    for (const one of [...texts, ...pictures]) {
      const card = within(one)

      expect(card.getByRole('button', { name: 'Odobri' })).toBeVisible()
      expect(card.getByRole('button', { name: 'Odbij' })).toBeVisible()
      /* And there is no such word to draw. Asking the screen alone stopped being
         an assertion the moment `verification.publish` left the dictionary: a
         button nobody can name cannot appear. So the dictionary is asked as
         well, which is where the word would have to come back first. */
      expect(card.queryByRole('button', { name: 'Objavi' })).toBeNull()
      expect(JSON.stringify(sr.verification)).not.toContain('Objavi')
    }
  })

  it('refuses a biography with a reason, and hands it back to the member', async () => {
    /* Owner, 06.08.2026, confirmed 11.08.2026 (PDL P22): „Sve što se odbije
       vraća se članu", uz obavezan razlog, i član sme da pošalje ponovo. Until
       15.08.2026 the code did the thing that decision replaced: the moderator
       rewrote the text in place and published what they left, so somebody
       else's sentences went onto a member's profile under their name. */
    const user = await open('profiles', 'Trkački profil')

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 4' })).toBeVisible()

    const card = within(
      must(
        within(waitingList())
          .getAllByRole('listitem')
          .find((one) => within(one).queryByText('Tekst biografije') !== null),
        'a card carrying a biography',
      ),
    )

    /* The same two decisions every other queue that hands work back offers, and
       not the one word that used to stand here alone. */
    expect(card.getByRole('button', { name: 'Odobri' })).toBeVisible()
    expect(card.getByRole('button', { name: 'Odbij' })).toBeVisible()
    expect(card.queryByRole('button', { name: 'Objavi' })).not.toBeInTheDocument()
    expect(JSON.stringify(sr.verification)).not.toContain('Objavi')

    await user.click(card.getByRole('button', { name: 'Odbij' }))

    const reason = screen.getByLabelText('Razlog odbijanja')

    await user.type(reason, 'Napiši nešto o sebi, ovo je prepisano sa tuđeg profila.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()

    /* And the reason is written down where a refusal is written down, so the
       member can be told what to change. */
    expect(
      within(screen.getByRole('list', { name: 'session decisions' })).getByText(
        /prepisano sa tuđeg profila/,
      ),
    ).toBeVisible()
  })

  it('approves a biography exactly as it came in, and nowhere lets it be rewritten', async () => {
    const user = await open('profiles', 'Trkački profil')

    const waiting = first(within(waitingList()).getAllByRole('listitem'))
    const card = within(waiting)
    /* Two paragraphs with an empty line between them, which is what a biography
       looks like and what has to survive being read untouched. */
    const sent = must(card.getByText(/Rekreativac iz Čačka/).textContent, 'the biography')

    /* Nothing to press that would open it for editing. A moderator used to
       adjust the text and publish what they left; the owner withdrew that on
       06.08.2026 (PDL P22), so the words on the card are the words that go out. */
    expect(card.queryByRole('button', { name: 'Izmeni' })).not.toBeInTheDocument()
    expect(card.queryByRole('textbox')).not.toBeInTheDocument()

    expect(sent).toContain(String.fromCharCode(10))

    await user.click(card.getByRole('button', { name: 'Odobri' }))

    /* An approval records that it happened and nothing about the text, which is
       the difference the withdrawal made: what used to be written down here was
       „what the profile now says", because a moderator could have changed it on
       the way out. Nothing can change it now, so the item is the record. */
    const lines = within(screen.getByRole('list', { name: 'session decisions' }))
      .getAllByRole('listitem')
      .map((one) => String(one.textContent))

    expect(lines.some((line) => line.includes('approved'))).toBe(true)
    expect(lines.some((line) => line.includes(sent))).toBe(false)
    expect(within(waitingList()).queryAllByRole('listitem')).not.toContain(waiting)
  })

  /* Both sorts go back to the member (PDL P22, 06.08.2026).
     It is the same box with the same words as every other queue that hands work
     back, because it is the same decision; what differs is what the moderator is
     asked to write, since that reason is what the member reads and changes the
     picture by (PDL P22, owner, 30.07.2026). */
  it('does not promise one on the three queues in the middle either', async () => {
    /* Leagues, teams and reported dates draw the shared box through the queue
       screen, which chooses the words itself rather than taking the default. That
       branch had nothing behind it: a review set it back to the promising words
       and all 1905 tests passed, and the leagues queue is the very one the
       promise was first measured on (PENDING R9b). */
    const user = await open('leagues', 'Predložene lige')

    await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))

    expect(screen.getByLabelText('Razlog odbijanja')).toHaveAttribute(
      'placeholder',
      sr.review.reasonKeptPlaceholder,
    )
  })

  it('asks the picture for an instruction and the biography for a reason', async () => {
    const user = await open('profiles', 'Trkački profil')

    const cardFor = (words: string) =>
      within(
        must(
          within(waitingList())
            .getAllByRole('listitem')
            .find((one) => within(one).queryByText(words) !== null),
          `a card carrying ${words}`,
        ),
      )

    await user.click(cardFor('Datoteka').getByRole('button', { name: 'Odbij' }))

    /* The name of the field is the one every queue uses, so a member is never
       told about two different things. */
    expect(screen.getByLabelText('Razlog odbijanja')).toHaveAttribute(
      'placeholder',
      'Napiši tačno šta na slici treba promeniti da bi bila prihvaćena.',
    )
    expect(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })).toBeInTheDocument()

    /* And the biography beside it asks for the ordinary reason. Both go back to
       the member since 06.08.2026 (PDL P22), and they are not the same errand:
       a picture is handed back with an instruction to work from, a text is
       refused and the member writes another. Until 15.08.2026 this could not be
       compared at all, because a biography had no way back. */
    await user.click(screen.getByRole('button', { name: 'Odustani' }))
    await user.click(cardFor('Tekst biografije').getByRole('button', { name: 'Odbij' }))

    expect(screen.getByLabelText('Razlog odbijanja')).toHaveAttribute(
      'placeholder',
      sr.review.reasonPlaceholder,
    )
  })

  it('leaves the reason for a returned biography in the inbox too, under its own heading', async () => {
    /* The half that was missing. When the biography stopped being published and
       started being refused (PDL P22, 06.08.2026), the refusal arrived without
       the message: the empty box went on promising „Član dobija tvoj razlog"
       and the inbox stayed exactly as it was. A review measured it, two
       messages before and two after, and then measured the obvious repair as
       well: handed the picture heading, a refused biography reaches the member
       as „Profilna slika je vraćena", a message about a thing they did not
       send. Both halves are asserted here, the arrival and the heading. */
    const user = setupUser()
    /* Read on a named day rather than on whatever day the machine is having, so
       the date the refusal carries can be checked against something. */
    const day = '2026-08-15'

    renderAt(`/sr/${QUEUE.profiles.path}`, 'moderator', '000011', undefined, day)
    await screen.findByRole('heading', { level: 1, name: 'Trkački profil' })

    /* The card of the member at the keyboard, and not simply the first
       biography in the queue: a message carries the number it was written to
       (Message.to), so a refusal aimed at somebody else never reaches this
       inbox and the test would fail for the wrong reason. */
    const card = within(
      must(
        within(waitingList())
          .getAllByRole('listitem')
          .find((one) => within(one).queryByText('Vukašin Todorović') !== null),
        'a waiting card carrying the biography of Vukašin Todorović',
      ),
    )

    await user.click(card.getByRole('button', { name: 'Odbij' }))
    await user.type(
      screen.getByLabelText('Razlog odbijanja'),
      'Napiši nešto svoje, ovo je prepisano sa tuđeg profila.',
    )
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

    await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))
    await user.click(screen.getByRole('link', { name: /Tekst o sebi je vraćen/ }))

    const subject = screen.getByRole('heading', { level: 1, name: 'Tekst o sebi je vraćen' })

    expect(subject).toBeVisible()
    expect(screen.getByText(/prepisano sa tuđeg profila/)).toBeVisible()
    /* And it is not the other heading, which is the mistake the one place that
       knows both was written to stop (queues.ts, `returned`). */
    expect(screen.queryByText('Profilna slika je vraćena')).not.toBeInTheDocument()
    /* And it says who it is from. The league writes it, never the moderator by
       name (PDL P22: a decision is the league's, and a member who could read the
       name of whoever refused them would write back to a person rather than to
       the association). Held here because nothing held it: a review emptied the
       sender and all 1906 tests passed, which left a member with a message
       whose one line of provenance read „ · 15.08.2026." */
    const provenance = must(
      subject.nextElementSibling,
      'the line of provenance under the subject',
    ).textContent

    expect(provenance).toContain(sr.app.name)
    /* And the day it was written, which is the other half of that one line and
       was covered without being checked: a review put 2000-01-01 in its place
       and all 1907 tests stayed green, so a refusal could carry any date at all.
       Read as the portal writes it, through the same formatter the screen uses,
       so this says „today" rather than one spelling of it. */
    expect(provenance).toContain(formatShortDate(day, 'sr'))
  })

  it('promises the message only where one is actually sent', async () => {
    /* Owner, R10: the screen must not promise what the code does not do. The
       empty box used to read „Član dobija tvoj razlog" everywhere a reason is
       asked for, and a refusal writes to the member on one queue only, so on the
       other six it was telling a moderator that words they were about to write
       would be read by somebody who never sees them.
     *
       Read against `returned`, which is the one place that knows whether a
       message goes, rather than against a list of queue names written here: a
       queue added later gets the right words or fails this. */
    /* `QUEUE` and not `QUEUES`, because a local list of that name shadows the
       import inside this describe block and holds tuples rather than queues. */
    for (const one of Object.values(QUEUE)) {
      const sends = returned(one, { kind: 'bio' }) !== null

      /* Which of the two makes the promise, and not merely that one of them
         does. Written the loose way this passed while a review swapped the two
         values in the dictionary, at which point every queue that sends nothing
         promised a message and the one that sends one said it does not: exactly
         backwards, on both screens this round had just corrected. Every other
         test compares a placeholder against `sr.review.*`, so they all move
         together with the values and none of them can see it. */
      /* The queue that sends is the racing profile and only it. */
      expect(sends, one.id).toBe(one.id === 'profiles')
    }

    /* And the words themselves, once rather than once per queue: these say
       nothing about any single one of them.
     *
       **Brittle on purpose, which is worth knowing before rewriting either
       sentence.** „Član dobija tvoj razlog" written as „Član će dobiti tvoj
       razlog" fails this, and so does „još ne ide" written as „se još ne šalje",
       although neither changes the meaning. Anything looser cannot see the thing
       it exists for: a review swapped the two values in the dictionary and every
       other test moved with them, since they all compare a placeholder against
       `sr.review.*` rather than against words. Reword freely, and change these
       three lines with the sentence. */
    expect(sr.review.reasonPlaceholder).toContain('Član dobija tvoj razlog u poruci')
    expect(sr.review.reasonKeptPlaceholder).toContain('još ne ide')
    expect(sr.review.reasonKeptPlaceholder).not.toContain('Član dobija tvoj razlog')
    /* And neither of them says the member may send another. They may not: a
       biography is written once, at joining, and there is nowhere to write a
       second one. The promise stood in the words that now belong to the
       biography alone, which is the one place it was false (PDL P22, PENDING
       R10). */
    for (const words of [sr.review.reasonPlaceholder, sr.review.reasonKeptPlaceholder]) {
      expect(words, words).not.toContain('pošalje ponovo')
    }
  })

  it('writes it to that member and to nobody else, least of all to everybody', async () => {
    /* The half the two tests below cannot see. Each of them signs in as the very
       member whose item is refused, and an inbox shows a member what was written
       to them as well as what was written to the whole league, which is the empty
       recipient (SessionProvider). So a refusal addressed to nobody still lands in
       front of the one person looking, and both tests pass: a review changed the
       recipient to an empty string and all 1902 of them did.
     *
       This one refuses the biography of one member and then reads the inbox of
       another, which is the only way to tell what was written to somebody from
       what was written to everybody. It is the fault canSendBack exists to
       prevent, so it is worth a test that can see it. */
    const user = setupUser()
    renderAt(`/sr/${QUEUE.profiles.path}`, 'moderator', '000013')
    await screen.findByRole('heading', { level: 1, name: 'Trkački profil' })

    const card = within(
      must(
        within(waitingList())
          .getAllByRole('listitem')
          .find((one) => within(one).queryByText('Vukašin Todorović') !== null),
        'a waiting card carrying the biography of Vukašin Todorović',
      ),
    )

    await user.click(card.getByRole('button', { name: 'Odbij' }))
    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Prepisano sa tuđeg profila.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

    /* The refusal really happened, said before anything is read about where it
       went. Without this the test can pass because nothing was refused at all,
       which is how its first two versions passed while the recipient was an
       empty string. */
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 3' })).toBeVisible()

    /* Read as somebody else, in the same visit, and through the control the
       member would press rather than by pushing an address: the two are not the
       same screen, and the first version of this walked to one that never holds
       messages, so the assertion could not fail either way. */
    await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))

    /* This inbox is not simply empty, and it is not proved so by counting links:
       the first version did that and counted the navigation, which draws „Sve
       poruke" whether or not there is a message. A review emptied the seeded
       messages and it still passed. What is asked for is one of those messages by
       name, since a message written to everybody is exactly what an empty
       recipient would be mixed up with. */
    expect(await screen.findByText(/Dobro došao u pripremu sezone 2027/)).toBeVisible()
    expect(screen.queryByText(/Tekst o sebi je vraćen/)).not.toBeInTheDocument()
  })

  it('leaves the reason for a returned picture in the inbox of the member', async () => {
    const user = setupUser()
    /* Signed in as the member whose picture is waiting, because the prototype has
       one person at the keyboard and the point of the test is where the message
       lands. A message carries the number it was written to (Message.to), so a
       moderator who is somebody else never sees it. */
    renderAt(`/sr/${QUEUE.profiles.path}`, 'moderator', '000013')
    await screen.findByRole('heading', { level: 1, name: 'Trkački profil' })

    const card = within(
      must(
        within(waitingList())
          .getAllByRole('listitem')
          .find((one) => within(one).queryByText('Damjan Krstić') !== null),
        'a waiting card for Damjan Krstić',
      ),
    )

    await user.click(card.getByRole('button', { name: 'Odbij' }))
    await user.type(
      screen.getByLabelText('Razlog odbijanja'),
      'Slika je mutna, pošalji oštriju u kojoj se vidi lice.',
    )
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

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
      /* Both sorts on the racing profile queue write to the member who sent the
         thing in, so both need somebody to write to. The other five refuse
         without sending anything, so the question does not arise there.
       *
         The biography answered yes until 15.08.2026, on the reasoning that it
         was never handed back at all. It is now, and an empty recipient in this
         portal is the whole league rather than nobody (Message.to), so a
         refusal with no number would put a moderator words about one member on
         the front of every member inbox. */
      expect(canSendBack(QUEUE.profiles, { kind: 'photo', memberNumber: '000013' })).toBe(true)
      expect(canSendBack(QUEUE.profiles, { kind: 'photo', memberNumber: '' })).toBe(false)
      expect(canSendBack(QUEUE.profiles, { kind: 'bio', memberNumber: '000011' })).toBe(true)
      expect(canSendBack(QUEUE.profiles, { kind: 'bio', memberNumber: '' })).toBe(false)
      expect(canSendBack(QUEUE.teams, { kind: '', memberNumber: '' })).toBe(true)
      /* And a racing profile item of no sort at all cannot go back either. The
         empty sort belongs to the queues that hold one kind of thing and this
         one never carries it (data/types.ts), so an item that does is a record
         nobody understands: there is no heading it could arrive under, and the
         first shape of `returned` called it a picture. */
      expect(canSendBack(QUEUE.profiles, { kind: '', memberNumber: '000011' })).toBe(false)
    })

    it('offers no way to send it, and says why in the place the button stood', async () => {
      const orphan: PendingItem = {
        id: 'ver-sli-bez-clana',
        queue: 'profiles',
        kind: 'photo',
        date: '2026-07-27',
        memberNumber: '',
        who: '',
        subject: 'Nepoznat pošiljalac',
        subjectId: '',
        body: 'profilna.jpg',
        picture: '',
        crop: { x: 0.5, y: 0.5, size: 1 },
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
          : original(input))

      renderAt(`/sr/${QUEUE.profiles.path}`, 'moderator')
      await screen.findByRole('heading', { level: 1, name: 'Trkački profil' })

      expect(screen.queryByRole('button', { name: 'Odbij' })).not.toBeInTheDocument()
      expect(
        screen.getByText(/nema člana kome bi odgovor stigao/),
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

  it('tells the member their team was accepted, and says who is telling them', async () => {
    /* The other place on these screens that writes to a member, and until now
       the only one nothing followed. A review emptied the sender here and all
       1907 tests stayed green, so the one line of provenance on the message
       would have read „ · 15.08.2026" with nobody's name in front of it.
     *
       The league writes it, never the moderator by name: a decision is the
       league's, and a member who could read the name of whoever decided would
       write back to a person rather than to the association (PDL P22). */
    const user = setupUser()
    const day = '2026-08-15'

    renderAt(`/sr/${QUEUE.teams.path}`, 'superadmin', '000007', undefined, day)
    await screen.findByRole('heading', { level: 1, name: 'Novi timovi' })

    const card = within(
      must(
        within(waitingList())
          .getAllByRole('listitem')
          .find((one) => within(one).queryByText('Timočka trkačka družina') !== null),
        'the card carrying the team proposed by the member at the keyboard',
      ),
    )

    await user.click(card.getByRole('button', { name: 'Odobri' }))

    await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))
    await user.click(screen.getByRole('link', { name: /Timočka trkačka družina/ }))

    const subject = screen.getByRole('heading', { level: 1, name: /je prihvaćen/ })
    const provenance = must(
      subject.nextElementSibling,
      'the line of provenance under the subject',
    ).textContent

    expect(provenance).toContain(sr.app.name)
    expect(provenance).toContain(formatShortDate(day, 'sr'))
    /* And the sentence itself, which is the only part of the message that tells
       the member anything they did not already know: that the team exists and
       that they are the one who runs it. Emptied, it left all 1908 tests green,
       so a member could be told their team was accepted by a message with
       nothing in it. */
    expect(screen.getByText(/Ti si njegov organizator/)).toBeVisible()
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

    await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))
    expect(screen.getByLabelText('Razlog odbijanja')).toBeVisible()

    // Away without cancelling, then back.
    await user.click(sectionNav().getByRole('link', { name: /Novi timovi/ }))
    await screen.findByRole('heading', { level: 1, name: 'Novi timovi' })

    // The box must not be standing open on a screen just arrived at, with the
    // focus taken into it (SendBack takes the focus as it appears).
    expect(screen.queryByLabelText('Razlog odbijanja')).not.toBeInTheDocument()

    await user.click(sectionNav().getByRole('link', { name: /Predložene lige/ }))
    await screen.findByRole('heading', { level: 1, name: 'Predložene lige' })

    expect(screen.queryByLabelText('Razlog odbijanja')).not.toBeInTheDocument()
  })

  it('says every obligatory field is obligatory, on every queue', async () => {
    /* Owner, 12.08.2026: „Ova pravila... treba da funkcioniše na svim formama za
       unos i verifikaciju." Eight fields on these screens are written by hand
       rather than drawn from a definition, and the rule reached one of them: the
       reason a result is sent back. The other seven, this box and the three a
       proposed team is corrected in, said nothing at all and the button below
       them simply stayed dead.

       Both halves at each, since one without the other is what was found: the
       star for the eye and `aria-required` for a reader, plus the one line that
       says what a star means. */
    const user = await open('teams', 'Novi timovi')

    /* Exactly one, wherever it comes from: the queue draws it over the three
       fields, and the box for a reason draws its own when it opens. Both at
       once explained the same mark twice on one screen. */
    expect(screen.getAllByText('Polja sa zvezdicom su obavezna.')).toHaveLength(1)
    /* And in the box the stylesheet folds away with the cards, since every star
       it explains is inside one (admin/verificationStyle.test.ts). Named here
       because that file reads the stylesheet and cannot see the markup. */
    expect(
      screen.getByText('Polja sa zvezdicom su obavezna.').closest('.pending__legend'),
    ).not.toBeNull()

    for (const name of ['Naziv tima', 'Mesto', /^Država/]) {
      const field = screen.getAllByLabelText(name)[0]

      expect(field, `${name} is not on the screen`).toBeDefined()
      expect(field).toHaveAttribute('aria-required', 'true')
    }

    await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))

    const reason = screen.getByLabelText('Razlog odbijanja')

    expect(reason).toHaveAttribute('aria-required', 'true')
    expect(
      must(reason.closest('.rankings__field'), 'the field the reason stands in').querySelector(
        '.field__required',
      ),
    ).not.toBeNull()
    /* And still one line explaining the star, not two. */
    expect(screen.getAllByText('Polja sa zvezdicom su obavezna.')).toHaveLength(1)
  })

  it('keeps that line on the screen when a sweep takes the card it stood in', async () => {
    /* It used to stand inside the box for a reason, which stands inside a card,
       and a card is not a safe place for it: a sweep settles the card the box
       belongs to and the line went with it while three stars stayed on the
       screen. A star this portal deliberately keeps out of the accessibility
       tree, so the line is all a sighted reader has.

       Two ways in, and this is the one a test can walk: open a reason, then
       press „Odobri sve". The other is a telephone, where a card folds shut and
       takes whatever is inside it. */
    const user = await open('teams', 'Novi timovi')

    const asked = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))
      expect(screen.getAllByText('Polja sa zvezdicom su obavezna.')).toHaveLength(1)

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
    } finally {
      /* In a `finally`, as everywhere else in this repo: left to the next line,
         a failed assertion between the two would leave `confirm` answering yes
         for every test after it in the file. */
      asked.mockRestore()
    }

    /* The stars are still drawn, so the line has to be there with them. */
    expect(document.querySelectorAll('.field__required').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Polja sa zvezdicom su obavezna.')).toHaveLength(1)
  })

  it('says nothing about a star on a queue that draws none', async () => {
    /* The comments queue is the one where nothing is obligatory: the only field
       on it is the note that goes with a deletion, and that note may be left
       blank, so it carries no star. A line saying „fields with a star are
       obligatory" over that screen tells the moderator the opposite of the truth
       about the only field in front of them.

       It was drawn there for a while, because whether to draw it was guessed at
       from the name of the queue and from whether a box was open, and this box
       is open exactly when a comment is being deleted. */
    const user = await open('comments', 'Komentari')

    expect(screen.queryByText('Polja sa zvezdicom su obavezna.')).not.toBeInTheDocument()

    await user.click(first(screen.getAllByRole('button', { name: /^Obriši:/ })))

    expect(screen.getByLabelText(/Napomena/)).toBeVisible()
    expect(document.querySelectorAll('.field__required')).toHaveLength(0)
    expect(screen.queryByText('Polja sa zvezdicom su obavezna.')).not.toBeInTheDocument()
  })

  it('says nothing about a star on a queue that has emptied', async () => {
    /* The three fields of a proposed team are drawn once per proposal, so a
       queue with nothing left in it has no star on it either. The line stood
       there all the same, because it was drawn for the name of the queue rather
       than for anything on the screen. */
    const user = await open('teams', 'Novi timovi')
    const asked = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      expect(screen.getAllByText('Polja sa zvezdicom su obavezna.')).toHaveLength(1)

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      /* The sweep leaves the one proposal it cannot take, so it is refused by
         hand to empty the queue. */
      await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Naziv je već zauzet.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))
    } finally {
      asked.mockRestore()
    }

    expect(document.querySelectorAll('.field__required')).toHaveLength(0)
    expect(screen.queryByText('Polja sa zvezdicom su obavezna.')).not.toBeInTheDocument()
  })

  it('takes the reason away with the card the sweep settled, and the line with it', async () => {
    /* The other way round, on a queue with no fields of its own: the only star
       there is the reason's, so when the sweep takes the card away the line has
       to go too, or it explains a mark that is nowhere on the screen. The box
       was left standing open over nothing, which is also a reason half written
       about a proposal already decided. */
    const user = await open('leagues', 'Predložene lige')

    const asked = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))
      expect(screen.getByLabelText('Razlog odbijanja')).toBeVisible()
      expect(screen.getAllByText('Polja sa zvezdicom su obavezna.')).toHaveLength(1)

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
    } finally {
      asked.mockRestore()
    }

    expect(screen.queryByLabelText('Razlog odbijanja')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.field__required')).toHaveLength(0)
    expect(screen.queryByText('Polja sa zvezdicom su obavezna.')).not.toBeInTheDocument()
  })

  it('will not send anything back without a reason', async () => {
    // A team rather than a biography: biographies stopped going back at all
    // (PDL P22, 30.07.2026), so there is nothing to refuse on that queue.
    const user = await open('teams', 'Novi timovi')

    await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))

    const confirm = screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })
    /* Told off, not switched off: the button stays reachable so the line saying
       why it will not go is reachable with it. */
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(confirm).not.toBeDisabled()
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 2' })).toBeVisible()

    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Naziv je već zauzet.')
    await user.click(confirm)

    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 1' })).toBeVisible()
    expect(
      within(screen.getByRole('list', { name: 'session decisions' })).getByText(
        /Naziv je već zauzet\./,
      ),
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
    await open('profiles', 'Trkački profil')

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
    const user = await open('profiles', 'Trkački profil')

    await user.click(first(screen.getAllByRole('button', { name: 'Odbij' })))
    await user.click(screen.getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByLabelText('Razlog odbijanja')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Čeka proveru 4' })).toBeVisible()
  })

  it('keeps the focus on the card in both directions', async () => {
    const user = await open('profiles', 'Trkački profil')
    /* Every card carries the button since 15.08.2026, the biographies among
       them (PDL P22), so this reads whichever ones have it rather than naming
       a sort. The second of them and not the first, because the fault being
       held is the focus landing on the top card instead of the one the
       moderator was working on. */
    const cards = within(waitingList())
      .getAllByRole('listitem')
      .filter((one) => within(one).queryByRole('button', { name: 'Odbij' }) !== null)
    const second = within(at(cards, 1))

    /* The box takes the place of the buttons of its own card, so both directions
       used to drop the focus onto the document and the next Tab started the page
       from the top, past everything (src/app/Dropdown.tsx has the same problem in
       the header). */
    await user.click(second.getByRole('button', { name: 'Odbij' }))
    expect(second.getByLabelText('Razlog odbijanja')).toHaveFocus()

    await user.click(second.getByRole('button', { name: 'Odustani' }))
    expect(second.getByRole('button', { name: 'Odbij' })).toHaveFocus()

    // And the card it came from is the one that has it, not the first on screen.
    expect(within(first(cards)).getByRole('button', { name: 'Odbij' })).not.toHaveFocus()
  })

  it('carries no dates on a queue that has none', async () => {
    await open('profiles', 'Trkački profil')

    expect(screen.queryByText('Prijavljen datum')).not.toBeInTheDocument()
    expect(screen.getByText('profilna-sa-maratona.jpg')).toBeVisible()
  })
})

describe('what is counted beside a queue', () => {
  /* Whole items, because that is what a queue holds. Two fields of one with
     the rest asserted away read as though `countFor` promised to look at no
     more than those two, which is not a promise it makes (ADL A14). */
  const BLANK: PendingItem = {
    id: '',
    queue: 'teams',
    kind: '',
    date: '',
    memberNumber: '',
    who: '',
    subject: '',
    subjectId: '',
    body: '',
    picture: '',
    crop: { x: 0.5, y: 0.5, size: 1 },
    currentDate: '',
    proposedDate: '',
    rating: { organisation: 0, value: 0, ambience: 0 },
    email: '',
    city: '',
    country: '',
  }
  const item = (id: string, queue: PendingQueueId): PendingItem => ({ ...BLANK, id, queue })
  const empty = { pendingResults: 0, items: [], decisions: {} }
  /* Through countFor, one queue at a time, which is how the navigation and the
     header both read it (SectionNav, Shell). There was a second function here
     answering for all eight at once; nothing on the portal called it, and these
     tests were the whole of its life. */
  const countsFor = (waiting: Parameters<typeof countFor>[0]): Record<string, number> =>
    Object.fromEntries(QUEUES.map((queue) => [queue.id, countFor(waiting, queue)]))

  it('counts every queue from the one place', () => {
    const counts = countsFor({
      pendingResults: 3,
      items: [
        item('u', 'payments'),
        item('a', 'profiles'),
        item('b', 'profiles'),
        item('c', 'comments'),
        item('d', 'schedule'),
      ],
      decisions: {},
    })

    expect(counts.results).toBe(3)
    expect(counts.payments).toBe(1)
    expect(counts.profiles).toBe(2)
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
    /* Seven, in the order the owner gave them (06.08.2026). The price list is
       among them now; it was outside both sections, because nothing is created
       or removed on it, which left it an address the panel had to link to. The
       races are not: a race is edited inside its event. Nor are the ducats,
       which are a catalogue in the rulebook and a collection on a profile. */
    const names = [
      'Članovi',
      'Događaji',
      'Timovi',
      'Lige',
      'Statične strane',
      'Moderatori',
      'Cenovnik',
    ]

    await openSection()
    /* Written out and not counted off the list under test: an entity that fell
       out of it would have satisfied a count taken from itself. */
    expect(names).toHaveLength(7)
    expect(ENTITIES.map((one) => one.id)).toEqual([
      'members',
      'events',
      'teams',
      'leagues',
      'pages',
      'moderators',
      'pricing',
    ])

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

  it('puts the list away when the screen is left by any other road', async () => {
    /* Following an entry used to be the only thing that closed it, so leaving by
       the header menu or by the browser's back button left the panel standing
       over whatever came next. It is open at an address rather than open, so
       going anywhere at all closes it.

       Read on the sector's own button rather than on the presence of the
       navigation: both sectors stand beside every administrative screen since
       06.08.2026, so what changes is whether the list under one of them is
       unfolded. */
    const user = setupUser()
    await openSection()

    await user.click(screen.getByRole('button', { name: 'Podaci' }))

    expect(screen.getByRole('button', { name: 'Podaci' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    // Through the header rather than through the panel, which is the road that
    // used to leave it standing open.
    await user.click(await screen.findByRole('link', { name: /^Administracija/ }))

    expect(await screen.findByRole('button', { name: 'Podaci' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})
