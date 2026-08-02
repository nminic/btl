import { screen, within } from '@testing-library/react'
import sr from '../../i18n/sr.json'
import { translate, type Dictionary } from '../../i18n/translate'
import { first, must } from '../../test/at'
import { expectFrontPage, renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { ENTITY_FORMS } from './entityForms'
import { QUEUES } from './queues'
import { GROUP_STARTS, RIGHT_GROUPS, RIGHTS } from './rights'

/* The matrix that says what each moderator may do (PDL P28a, 30.07.2026).
 *
 * Four moderators are generated with four different sets, one of them empty, so
 * every one of these questions is asked of data somebody could actually have:
 * is a box readable on its own, is a tick remembered, does a moderator with
 * nothing look deliberate, and is the superadmin kept out of a table he has no
 * business being in.
 */

const dictionary = sr as Dictionary

function t(key: string, params?: Record<string, string | number>): string {
  return translate(dictionary, 'sr', key, params)
}

const MATRIX = t('rights.title')

/** The matrix, once it has its data. */
async function matrix() {
  return within(await screen.findByRole('table', { name: MATRIX }))
}

describe('every box in the matrix', () => {
  it('carries a name that says whose it is and what it does', async () => {
    renderAt('/sr/administracija/moderatori', 'superadmin')
    const table = await matrix()

    /* A screen reader does not read the column heading and the row heading for
       you when you land on a checkbox, so a box named after its column alone is
       one of sixteen boxes named "Događaji" and the person hearing it cannot
       tell whose it is. */
    expect(
      table.getByRole('checkbox', { name: 'Jelena Radulović, uređivanje događaja' }),
    ).toBeChecked()
    expect(
      table.getByRole('checkbox', { name: 'Nenad Vujačić, odlučivanje o rezultatima' }),
    ).toBeChecked()
    expect(
      table.getByRole('checkbox', { name: 'Milena Šarić, odlučivanje o uplatama' }),
    ).not.toBeChecked()
  })

  it('is named differently from every other box on the screen', async () => {
    renderAt('/sr/administracija/moderatori', 'superadmin')
    const table = await matrix()

    /* Four moderators times sixteen rights, and no two of them reading the
       same. The pair that would collide first is the league somebody proposed
       and the league record itself, which share an id and share nothing else. */
    const names = table
      .getAllByRole('checkbox')
      .map((box) => box.getAttribute('aria-label') ?? '')

    expect(names).toHaveLength(4 * RIGHTS.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it('remembers being ticked, and being unticked, after the screen is left', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/moderatori', 'superadmin')

    const given = 'Milena Šarić, uređivanje trka'
    const taken = 'Jelena Radulović, odlučivanje o rezultatima'

    await user.click((await matrix()).getByRole('checkbox', { name: given }))
    await user.click((await matrix()).getByRole('checkbox', { name: taken }))

    /* Away and back, so what is read is the session rather than the state of a
       checkbox that never went anywhere. Unticking has to survive the trip as
       well as ticking: a right somebody arrived holding and had taken away is
       not the same as one they never had, and a store of what is switched on
       could not tell those apart. */
    await user.click(first(screen.getAllByRole('button', { name: /^Otvori:/ })))
    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    const back = await matrix()
    expect(back.getByRole('checkbox', { name: given })).toBeChecked()
    expect(back.getByRole('checkbox', { name: taken })).not.toBeChecked()
  })
})

describe('a moderator with no right at all', () => {
  it('says so in his row instead of showing sixteen empty boxes', async () => {
    renderAt('/sr/administracija/moderatori', 'superadmin')
    const table = await matrix()

    /* The state of every moderator the moment he is entered, so the row has to
       read as deliberate rather than as a row that failed to load. */
    const row = within(table.getByRole('rowheader', { name: /Milena Šarić/ }))
    expect(row.getByText(t('rights.none'))).toBeVisible()

    const boxes = within(
      must(table.getByRole('rowheader', { name: /Milena Šarić/ }).closest('tr'), 'tr'),
    ).getAllByRole('checkbox')

    expect(boxes).toHaveLength(RIGHTS.length)
    for (const box of boxes) {
      expect(box).not.toBeChecked()
    }
  })

  it('is counted the same way once a right is given to him', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/moderatori', 'superadmin')

    await user.click(
      (await matrix()).getByRole('checkbox', { name: 'Milena Šarić, uređivanje trka' }),
    )

    const row = within((await matrix()).getByRole('rowheader', { name: /Milena Šarić/ }))
    expect(row.queryByText(t('rights.none'))).not.toBeInTheDocument()
    expect(row.getByText(t('rights.granted', { count: 1 }))).toBeVisible()
  })
})

describe('the superadmin', () => {
  it('is not a row in the matrix, because he may everything always', async () => {
    renderAt('/sr/administracija/moderatori', 'superadmin')
    const table = await matrix()

    /* He does nothing a moderator cannot; what he alone does is decide what the
       moderator may (PDL P21). A row for him would be sixteen boxes nobody can
       untick and a lie about where the limit is. */
    expect(table.queryByRole('rowheader', { name: /[Ss]uperadmin/ })).not.toBeInTheDocument()
    expect(table.getAllByRole('rowheader')).toHaveLength(4)
    expect(
      table.queryByRole('checkbox', { name: /[Ss]uperadmin/ }),
    ).not.toBeInTheDocument()

    // And it is said out loud beside the table, not left to be worked out.
    expect(screen.getByText(t('rights.superadminNote'))).toBeVisible()
  })
})

describe('the headings of the matrix', () => {
  it('are real table headers with a scope, in both directions', async () => {
    renderAt('/sr/administracija/moderatori', 'superadmin')
    const table = await matrix()

    /* Without these a cell is a checkbox in a grid of checkboxes: the name on
       the box says what it is, and the headers are what let somebody read the
       table as a table. */
    for (const row of table.getAllByRole('rowheader')) {
      expect(row).toHaveAttribute('scope', 'row')
    }

    expect(table.getByRole('columnheader', { name: t('rights.moderator') })).toHaveAttribute(
      'scope',
      'col',
    )

    for (const group of RIGHT_GROUPS) {
      const heading = table.getByRole('columnheader', { name: t(group.headingKey) })
      expect(heading).toHaveAttribute('scope', 'colgroup')
      expect(heading).toHaveAttribute('colspan', String(group.rights.length))
    }

    for (const right of RIGHTS) {
      expect(table.getByRole('columnheader', { name: t(right.nameKey) })).toHaveAttribute(
        'scope',
        'col',
      )
    }
  })
})

describe('the columns of the matrix', () => {
  it('are read off the entities and the queues, so a new one brings its own', () => {
    /* The point of reading them rather than writing them out: a ninth queue
       added to queues.ts gets a column the day it is added. It is also why the
       words are checked below rather than assumed. */
    const editable = ENTITY_FORMS.filter((entity) => entity.superadminOnly !== true)

    expect(RIGHT_GROUPS.map((group) => group.rights.length)).toEqual([
      editable.length,
      QUEUES.length,
    ])
    expect(RIGHTS.map((right) => right.key)).toEqual([
      ...editable.map((entity) => `entity:${entity.id}`),
      ...QUEUES.map((queue) => `queue:${queue.id}`),
    ])
  })

  it('leave out the entity no tick could ever open, which is the moderators', () => {
    /* A column for moderators was a promise the specification forbids anybody to
       keep: the superadmin could tick it, the row would read seventeen rights,
       and the screen behind it would go on refusing, because it is closed to a
       moderator by PDL P21 and not by a missing right. The exclusion is a fact
       on the entity (superadminOnly), so a second such entity leaves the matrix
       on the day it is added rather than on the day somebody remembers. */
    expect(RIGHTS.map((right) => right.key)).not.toContain('entity:moderators')
    expect(ENTITY_FORMS.some((entity) => entity.superadminOnly === true)).toBe(true)

    // And the words for it are gone too, so nothing can quietly draw a column
    // out of a key that still resolves.
    expect(t('rights.column.entity.moderators')).toBe('rights.column.entity.moderators')
    expect(t('rights.action.entity.moderators')).toBe('rights.action.entity.moderators')
  })

  it('draw the line between the two groups from the groups, not from a number', () => {
    // Written into the stylesheet as "the ninth column", it would move silently
    // the day a tenth entity arrives.
    expect([...GROUP_STARTS]).toEqual([`queue:${first(QUEUES).id}`])
  })

  it('carry no key the dictionary cannot answer', () => {
    /* A group used to declare a note under two keys nobody had written and
       nothing rendered. Dead is not harmless: translate() gives back the key it
       cannot find, so the first person to draw it would have put
       "rights.groupEntitiesNote" on the screen and had no way of knowing that
       was the fault rather than the text. */
    const keys = RIGHT_GROUPS.flatMap((group) =>
      Object.entries(group)
        .filter(([field]) => field.endsWith('Key'))
        .map(([, value]) => String(value)),
    )

    expect(keys.filter((key) => t(key) === key)).toEqual([])
    // One heading each and nothing beside it, so a dead field cannot hide among
    // live ones.
    expect(keys).toHaveLength(RIGHT_GROUPS.length)
  })

  it('have words for every one of them, and no two of them read the same', () => {
    const missing = RIGHTS.flatMap((right) => [right.nameKey, right.actionKey]).filter(
      (key) => t(key) === key,
    )

    expect(missing).toEqual([])

    /* Two rights that read the same are two boxes nobody can tell apart, and the
       pair that nearly does is leagues: the record and the proposal. */
    const actions = RIGHTS.map((right) => t(right.actionKey))
    expect(new Set(actions).size).toBe(actions.length)
  })
})

describe('the screen behind the matrix', () => {
  it('is closed to a moderator, who may not decide what a moderator may', async () => {
    renderAt('/sr/administracija/moderatori', 'moderator')

    /* And says nothing about it. Assigning rights is the one thing the two roles
       do not share (PDL P21), and a sentence explaining that is a sentence
       telling a moderator there is a room he is kept out of; the address simply
       does not answer (owner, 30.07.2026). */
    await expectFrontPage()
    expect(screen.queryByRole('table', { name: MATRIX })).not.toBeInTheDocument()
  })

  it('lists the moderators with the address each of them signs in with', async () => {
    renderAt('/sr/administracija/moderatori', 'superadmin')

    const list = within(await screen.findByRole('table', { name: t('admin.moderators') }))

    expect(list.getByText('jelena.radulovic@primer.rs')).toBeVisible()
    expect(list.getByRole('button', { name: 'Otvori: Milena Šarić' })).toBeVisible()
    // All sixteen there are. Making moderators is not among them and cannot
    // be: it is the one thing the superadmin keeps to himself (PDL P21).
    expect(list.getByText(t('rights.granted', { count: RIGHTS.length }))).toBeVisible()
    expect(list.getByText(t('rights.none'))).toBeVisible()
  })

  it('asks a new moderator for three things and never for his rights', async () => {
    const user = setupUser()
    const title = t('admin.form.new.moderators')
    renderAt('/sr/administracija/moderatori', 'superadmin')

    await user.click(await screen.findByRole('button', { name: title }))
    const form = within(screen.getByRole('form', { name: title }))

    /* Rights are ticked in the matrix and nowhere else. A second place to set
       them would be a second answer to one question, and the two would disagree
       within a month. */
    expect(form.getAllByRole('textbox')).toHaveLength(3)
    expect(form.queryByRole('checkbox')).not.toBeInTheDocument()

    await user.type(form.getByLabelText(/^Ime/), 'Radoslav')
    await user.type(form.getByLabelText(/^Prezime/), 'Petrović')
    await user.type(form.getByLabelText(/^Adresa elektronske pošte/), 'radoslav@primer.rs')
    await user.click(form.getByRole('button', { name: t('form.submit') }))
    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    /* He joins the matrix holding nothing, which is what a moderator who has
       just been made is, and the row says so rather than looking unfinished. */
    const table = await matrix()
    const row = within(table.getByRole('rowheader', { name: /Radoslav Petrović/ }))

    expect(row.getByText(t('rights.none'))).toBeVisible()
    expect(
      table.getByRole('checkbox', { name: 'Radoslav Petrović, uređivanje članova' }),
    ).not.toBeChecked()
  })
})
