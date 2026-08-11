import { screen, within } from '@testing-library/react'
import sr from '../../i18n/sr.json'
import { translate, type Dictionary } from '../../i18n/translate'
import type { FieldDef } from '../../forms/types'
import { at, first, must } from '../../test/at'
import { expectFrontPage, renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import {
  ENTITY_FORMS,
  EVENTS,
  LEAGUES,
  MEMBERS,
  MODERATORS,
  PAGES,
  RACES,
  TEAMS,
  addressField,
  idFor,
  recordFrom,
  takenAddress,
  type EntityDef,
} from './entityForms'

/* The six entities entered whole, each opened whole.
 *
 * The price list is not among them: its rows are given rather than entered, and
 * the screen for it is its own (adminEntities.test).
 *
 *
 * Every screen behind Entities used to change one text field in a row and had no
 * way at all to enter a record. These tests walk all six through the same four
 * questions: does the form show every field the entity has, does an empty
 * obligatory field stop the save and say so beside itself, does a change survive
 * the way back to the list, and is every one of them shut to a competitor.
 */

const dictionary = sr as Dictionary

function t(key: string): string {
  return translate(dictionary, 'sr', key)
}

/** The accessible name of a field starts with its label and may carry the note
 *  that it is optional, so the match is anchored rather than loose: "Ime" must
 *  not find "Prezime". */
function labelled(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
}

/** Everything inside the form that is open, and nothing outside it: the words
 *  "Uslov" also name the footer, and "Naslov" also names a column. */
function open(title: string) {
  return within(screen.getByRole('form', { name: title }))
}

function control(field: FieldDef, title: string): HTMLElement {
  return open(title).getByLabelText(labelled(t(field.labelKey)))
}

/** The first field a person can type words into that is not the identity of the
 *  record, which is the one field a change must not touch. */
function writable(entity: EntityDef): FieldDef {
  return must(
    entity.form.fields.find(
      (one) => (one.type === 'text' || one.type === 'textarea') && one.name !== entity.idField,
    ),
    `a text field on the ${entity.id} form that is not its own number`,
  )
}

type Screen = {
  entity: EntityDef
  /** Where the list lives, below the language. */
  path: string
  /** The name of its table, which is also the name of the screen. */
  list: string
}

/* Every entity with a screen of its own. The races are not among them: a race is
   edited inside its event, which is the only place that knows which event it is
   (owner, 06.08.2026), and the tests for that stand in adminEntities.test. Nor
   are the ducats, which left administration on the same day. */
const SCREENS: Screen[] = [
  { entity: MEMBERS, path: 'administracija/clanovi', list: 'Članovi' },
  { entity: EVENTS, path: 'administracija/dogadjaji', list: 'Događaji' },
  { entity: TEAMS, path: 'administracija/timovi', list: 'Timovi' },
  { entity: LEAGUES, path: 'administracija/lige', list: 'Lige' },
  { entity: PAGES, path: 'administracija/strane', list: 'Statične strane' },
  /* The last of them. It is entered and changed by the same renderer reading the
     same kind of JSON as the five above, which is the whole point of it being an
     entity rather than a screen somebody wrote by hand (PDL P28a). What it may
     do is not on the form; that is the matrix below the list. */
  { entity: MODERATORS, path: 'administracija/moderatori', list: 'Moderatori' },
]

describe('every entity has a form for a record that does not exist yet', () => {
  it.each(SCREENS)('$path opens one with every field the entity has', async ({ entity, path }) => {
    const user = setupUser()
    const title = t(`admin.form.new.${entity.id}`)
    renderAt(`/sr/${path}`, 'superadmin')

    await user.click(await screen.findByRole('button', { name: title }))

    expect(screen.getByRole('heading', { level: 2, name: title })).toBeVisible()

    for (const field of entity.form.fields) {
      expect(control(field, title)).toBeInTheDocument()
    }
  })

  it.each(SCREENS)('$path refuses to save an empty obligatory field', async ({ entity, path }) => {
    const user = setupUser()
    const title = t(`admin.form.new.${entity.id}`)
    renderAt(`/sr/${path}`, 'superadmin')

    await user.click(await screen.findByRole('button', { name: title }))
    await user.click(open(title).getByRole('button', { name: t('form.submit') }))

    const required = must(
    entity.form.fields.find((one) => one.required === true),
    'a required field on the form',
  )
    const field = control(required, title)

    expect(field).toHaveAttribute('aria-invalid', 'true')
    // The message stands beside the field, tied to it, not only in the summary.
    expect(field.getAttribute('aria-describedby')).toContain(`field-${required.name}-error`)
    expect(document.getElementById(`field-${required.name}-error`)).toHaveTextContent(
      t('form.errors.required'),
    )
    expect(screen.queryByText(t('admin.form.saved'))).not.toBeInTheDocument()
  })
})

describe('every entity can be opened and changed whole', () => {
  it.each(SCREENS)('$path keeps the change after the way back', async ({ entity, path, list }) => {
    const user = setupUser()
    const changed = 'Provera unosa'
    const title = t(`admin.form.edit.${entity.id}`)
    renderAt(`/sr/${path}`, 'superadmin')

    const table = await screen.findByRole('table', { name: list })
    await user.click(first(within(table).getAllByRole('button', { name: /^Otvori:/ })))

    expect(screen.getByRole('heading', { level: 2, name: title })).toBeVisible()

    const field = writable(entity)
    await user.clear(control(field, title))
    await user.type(control(field, title), changed)
    await user.click(open(title).getByRole('button', { name: t('form.submit') }))

    // What was saved is read back, field by field, rather than announced as
    // "saved" and left to be trusted.
    const saved = screen.getByRole('status', { name: t('admin.form.saved') })
    expect(within(saved).getByText(changed)).toBeVisible()

    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    // The list names the record by what it is called now, which is how the
    // change shows without every screen having a column for every field.
    await user.click(
      screen.getByRole('button', { name: labelled(`${t('admin.form.open')}: ${changed}`) }),
    )

    expect(control(field, title)).toHaveValue(changed)
  })
})

describe('the confirmation that a record was saved', () => {
  it('takes the focus, because the form it replaced had it', async () => {
    const user = setupUser()
    const title = t('admin.form.edit.teams')
    renderAt('/sr/administracija/timovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Timovi' })
    await user.click(first(within(table).getAllByRole('button', { name: /^Otvori:/ })))
    await user.click(open(title).getByRole('button', { name: t('form.submit') }))

    /* The whole form goes away and the confirmation takes its place, so the button
       that was pressed is no longer on the page. Without this the focus is on
       nothing and the next Tab starts the page from the top; with it a screen
       reader also reads the confirmation from its heading down. */
    expect(screen.getByRole('status', { name: t('admin.form.saved') })).toHaveFocus()
  })
})

describe('a competitor', () => {
  it.each(SCREENS)('is offered no form at all on $path', async ({ entity, path }) => {
    // The address is not refused with a sentence any more, it is not there at
    // all (owner, 30.07.2026).
    renderAt(`/sr/${path}`, 'competitor')

    await expectFrontPage()
    expect(
      screen.queryByRole('button', { name: t(`admin.form.new.${entity.id}`) }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Otvori:/ })).not.toBeInTheDocument()
  })
})

describe('a record that is entered rather than changed', () => {
  it('joins the list it was entered on, and carries every field it was given', async () => {
    const user = setupUser()
    const title = t('admin.form.new.members')
    renderAt('/sr/administracija/clanovi', 'superadmin')

    await user.click(await screen.findByRole('button', { name: title }))
    const form = open(title)

    await user.type(form.getByLabelText(labelled(t('admin.field.firstName'))), 'Milica')
    await user.type(form.getByLabelText(labelled(t('admin.field.lastName'))), 'Pavlović')
    await user.selectOptions(form.getByLabelText(labelled(t('admin.field.gender'))), 'F')
    await user.type(form.getByLabelText(labelled(t('admin.field.birthYear'))), '1991')
    await user.type(form.getByLabelText(labelled(t('admin.field.city'))), 'Kraljevo')
    await user.selectOptions(form.getByLabelText(labelled(t('admin.field.country'))), 'RS')
    await user.type(form.getByLabelText(labelled(t('admin.field.firstSeason'))), '2027')
    await user.click(form.getByLabelText(labelled(t('admin.field.firstSeason2027'))))
    await user.selectOptions(form.getByLabelText(labelled(t('admin.basis'))), 'honorary')

    /* The form used to carry a box saying the membership was active, with a note
       that an unpaid member has an account but is visible nowhere. Nothing reads
       that flag any more: an unpaid member is not in the member list at all, they
       wait in the queue of memberships (ADL A4d), so the box was a way to put back
       into the list exactly what that change took out of it. Held on the
       definition rather than on the screen, because a field that is not there has
       no label to ask the screen about. */
    expect(MEMBERS.form.fields.map((one) => one.name)).not.toContain('active')

    await user.click(form.getByRole('button', { name: t('form.submit') }))

    const saved = screen.getByRole('status', { name: t('admin.form.saved') })
    expect(within(saved).getByText('Milica')).toBeVisible()
    // The country is named rather than shown as a code, and a box reads yes.
    expect(within(saved).getByText('Srbija')).toBeVisible()
    expect(within(saved).getAllByText(t('admin.yes')).length).toBeGreaterThan(0)
    expect(within(saved).getByText(t('admin.basisValue.honorary'))).toBeVisible()

    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    const list = within(await screen.findByRole('table', { name: 'Članovi' }))
    // The generated members hold 000001 to 000031, so the first free one is next.
    const row = within(must(list.getByText('000033').closest('tr'), 'tr'))

    expect(row.getByText('Milica Pavlović')).toBeVisible()
    // The year of birth is on this screen and on no other (PDL P11, P23).
    expect(row.getByText('1991')).toBeVisible()
    expect(row.getByText('Kraljevo')).toBeVisible()
    expect(row.getByText(t('admin.basisValue.honorary'))).toBeVisible()
  })

})

describe('the identity of a record', () => {
  /** Everything the member form does ask for, so a test can get to the save. */
  const fillMember = async (
    user: ReturnType<typeof setupUser>,
    form: ReturnType<typeof open>,
    firstName: string,
  ) => {
    await user.type(form.getByLabelText(labelled(t('admin.field.firstName'))), firstName)
    await user.type(form.getByLabelText(labelled(t('admin.field.lastName'))), 'Pavlović')
    await user.selectOptions(form.getByLabelText(labelled(t('admin.field.gender'))), 'F')
    await user.type(form.getByLabelText(labelled(t('admin.field.birthYear'))), '1991')
    await user.type(form.getByLabelText(labelled(t('admin.field.city'))), 'Kraljevo')
    await user.selectOptions(form.getByLabelText(labelled(t('admin.field.country'))), 'RS')
    await user.type(form.getByLabelText(labelled(t('admin.field.firstSeason'))), '2027')
    await user.selectOptions(form.getByLabelText(labelled(t('admin.basis'))), 'payment')
    await user.click(form.getByRole('button', { name: t('form.submit') }))
  }

  it('is never asked for on a new member, because the system hands it out', async () => {
    const user = setupUser()
    const title = t('admin.form.new.members')
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const list = within(await screen.findByRole('table', { name: 'Članovi' }))
    const rows = list.getAllByRole('row').length

    await user.click(screen.getByRole('button', { name: title }))
    const form = open(title)

    /* It was an obligatory field of six digits with a check that the number was
       still free, because it used to be taken as typed: two members answered to
       one number, React drew two rows with the same key, and changing the city of
       one of them changed both, since the overlay of changes is keyed by the
       number. The field is gone (PDL P8, 30.07.2026): the number is handed out at
       the moment the fee is recorded and an administrator never types it. */
    expect(form.queryByLabelText(labelled(t('admin.field.memberNumber')))).not.toBeInTheDocument()

    await fillMember(user, form, 'Milica')

    expect(screen.getByRole('status', { name: t('admin.form.saved') })).toBeVisible()
    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    /* Uniqueness survives the field going away, and it survives differently: the
       number given is the first one nobody holds, so there is nothing left to
       refuse. The generated members hold 000001 to 000031. */
    const grown = within(await screen.findByRole('table', { name: 'Članovi' }))
    expect(grown.getAllByRole('row')).toHaveLength(rows + 1)
    expect(grown.getByText('000033')).toBeVisible()
  })

  it('is the next free number for each member entered in turn', async () => {
    const user = setupUser()
    const title = t('admin.form.new.members')
    renderAt('/sr/administracija/clanovi', 'superadmin')

    await screen.findByRole('table', { name: 'Članovi' })

    for (const name of ['Milica', 'Jelena']) {
      await user.click(screen.getByRole('button', { name: title }))
      await fillMember(user, open(title), name)
      await user.click(screen.getByRole('button', { name: t('admin.form.back') }))
    }

    /* The second must not read the file and hand out 000033 again: what the screen
       shows is what counts as taken, records entered a moment ago included. */
    const list = within(await screen.findByRole('table', { name: 'Članovi' }))
    expect(within(must(list.getByText('000033').closest('tr'), 'tr')).getByText(/Milica/)).toBeVisible()
    expect(within(must(list.getByText('000034').closest('tr'), 'tr')).getByText(/Jelena/)).toBeVisible()
  })

  it('is refused for a written page whose address answers already', async () => {
    const user = setupUser()
    const title = t('admin.form.new.pages')
    renderAt('/sr/administracija/strane', 'superadmin')

    const before = within(await screen.findByRole('table', { name: 'Statične strane' }))
    const rows = before.getAllByRole('row').length

    await user.click(screen.getByRole('button', { name: title }))
    const form = open(title)

    // Two records on /pravilnik would be one page arguing with itself.
    await user.type(form.getByLabelText(labelled(t('admin.address'))), 'pravilnik')
    await user.type(form.getByLabelText(labelled(t('admin.field.pageTitle'))), 'Drugi pravilnik')
    await user.type(form.getByLabelText(labelled(t('admin.field.sectionHeading'))), 'Uvod')
    await user.type(form.getByLabelText(labelled(t('admin.field.sectionBody'))), 'Tekst.')
    await user.click(form.getByRole('button', { name: t('form.submit') }))

    expect(document.getElementById('field-slug-error')).toHaveTextContent(t('form.errors.taken'))
    /* And nothing was written down. Without this the test passes on the behaviour
       it exists to forbid: the message appears and the duplicate is made anyway,
       two records answer to /pravilnik, and one change reaches both of them,
       because the overlay of changes is keyed by exactly that address. */
    expect(screen.queryByText(t('admin.form.saved'))).not.toBeInTheDocument()

    /* A free address saves, and the record answers to what was typed. Written
       pages are the one entity left that names itself: a member number is handed
       out (PDL P8) and the other six get an identity nobody types. */
    const address = form.getByLabelText(labelled(t('admin.address')))
    await user.clear(address)
    await user.type(address, 'nova-strana')
    await user.click(form.getByRole('button', { name: t('form.submit') }))
    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    const list = within(await screen.findByRole('table', { name: 'Statične strane' }))
    const row = within(must(list.getByRole('link', { name: '/nova-strana' }).closest('tr'), 'tr'))

    expect(row.getByRole('button', { name: 'Otvori: Drugi pravilnik' })).toBeVisible()
    // Exactly one row more: the refused attempt left nothing behind either.
    expect(list.getAllByRole('row')).toHaveLength(rows + 1)
  })

  it('does not stand in the way of the record it belongs to', async () => {
    const user = setupUser()
    const title = t('admin.form.edit.members')
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Članovi' })
    await user.click(first(within(table).getAllByRole('button', { name: /^Otvori:/ })))

    const form = open(title)
    await user.clear(form.getByLabelText(labelled(t('admin.field.city'))))
    await user.type(form.getByLabelText(labelled(t('admin.field.city'))), 'Vranje')
    await user.click(form.getByRole('button', { name: t('form.submit') }))

    // Its own number is in the list of the taken ones, and it is not competing
    // with itself for it.
    expect(screen.getByRole('status', { name: t('admin.form.saved') })).toBeVisible()
  })
})

/**
 * A race is entered inside its event, so every one of these opens the event
 * first (owner, 06.08.2026). The screen of races is gone, and with it the
 * question of which event a race belongs to.
 */
async function newRaceOnFirstEvent(user: ReturnType<typeof setupUser>) {
  renderAt('/sr/administracija/dogadjaji', 'superadmin')

  const events = within(await screen.findByRole('table', { name: 'Događaji' }))
  const first = at(events.getAllByRole('row'), 1)

  await user.click(within(first).getByRole('button', { name: /^Otvori:/ }))
  await user.click(await screen.findByRole('button', { name: t('admin.form.new.races') }))

  return open(t('admin.form.new.races'))
}

/** The row of a race under the event that is open. */
async function raceRow(named: string) {
  return within(
    must(
      within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
        .getByText(named)
        .closest('tr'),
      `the row of the race called ${named}`,
    ),
  )
}

describe('the category of a race', () => {
  it('is read off the distance rather than asked for, and says where it comes from', async () => {
    const user = setupUser()
    const form = await newRaceOnFirstEvent(user)

    /* It was a free choice beside the distance, so a race of 42.2 km could be
       saved as a short one and the board of most marathons lied. The category is
       the distance, by the exact value and with no tolerance (PDL P5), so there
       is nothing to ask. */
    expect(form.queryByLabelText(labelled(t('admin.field.category')))).not.toBeInTheDocument()
    expect(form.getByText(t('admin.field.categoryFromDistance'))).toBeVisible()

    /* Nor which event it is. The screen it is entered on already answers that. */
    expect(form.queryByLabelText(labelled(t('admin.field.event')))).not.toBeInTheDocument()

    await user.type(form.getByLabelText(labelled(t('admin.raceName'))), 'Provera kategorije')
    await user.type(form.getByLabelText(labelled(t('admin.field.distanceKm'))), '42.2')
    await user.type(form.getByLabelText(labelled(t('admin.field.ascentM'))), '120')
    await user.type(form.getByLabelText(labelled(t('admin.field.descentM'))), '120')

    // Shown as it is typed, with the rule that produced it beside it.
    expect(form.getByText(t('category.marathon'))).toBeVisible()
    expect(form.getByText(t('admin.hint.category'))).toBeVisible()

    await user.click(form.getByRole('button', { name: t('form.submit') }))

    const saved = within(screen.getByRole('status', { name: t('admin.form.saved') }))
    expect(saved.getByText(t('category.marathon'))).toBeVisible()

    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    expect((await raceRow('Provera kategorije')).getByText(t('category.marathon'))).toBeVisible()
  })

  it('is written again when the record is changed, and not only when it is made', async () => {
    /* The half of it that had no proof, and the half every screen leans on: a
       name and an address, a distance and a category, are two facts on one
       record, and only the form keeps them in step. Read off the list rather
       than off the table of what was saved, because that table works the value
       out again from the fields and would say the right thing over a record
       that still says the old one.

       Whether it can be changed anywhere else is the other question this branch
       answers: not in a cell in the row, for exactly this reason. */
    const user = setupUser()
    const form = await newRaceOnFirstEvent(user)

    /* Entered rather than picked out of the file, so the race this is about has
       a name no other race shares. */
    await user.type(form.getByLabelText(labelled(t('admin.raceName'))), 'Provera izmene')
    await user.type(form.getByLabelText(labelled(t('admin.field.distanceKm'))), '42.2')
    await user.type(form.getByLabelText(labelled(t('admin.field.ascentM'))), '120')
    await user.type(form.getByLabelText(labelled(t('admin.field.descentM'))), '120')
    await user.click(form.getByRole('button', { name: t('form.submit') }))
    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    expect((await raceRow('Provera izmene')).getByText(t('category.marathon'))).toBeVisible()

    await user.click((await raceRow('Provera izmene')).getByRole('button', { name: /^Otvori:/ }))

    const distance = await screen.findByLabelText(labelled(t('admin.field.distanceKm')))
    await user.clear(distance)
    await user.type(distance, '10')
    await user.click(screen.getByRole('button', { name: t('form.submit') }))
    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    const changed = await raceRow('Provera izmene')

    expect(changed.getByText(t('category.short'))).toBeVisible()
    expect(changed.queryByText(t('category.marathon'))).toBeNull()
  })

  it('is a hundred metres short of a marathon and says so', async () => {
    const user = setupUser()
    const form = await newRaceOnFirstEvent(user)

    await user.type(form.getByLabelText(labelled(t('admin.field.distanceKm'))), '42.195')

    // The deliberate consequence of there being no tolerance (PDL P5).
    expect(form.getByText(t('category.long'))).toBeVisible()
  })
})

describe('a written page nobody has written yet', () => {
  it('is listed, and its form opens empty instead of throwing', async () => {
    const user = setupUser()
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/pages.json')
        ? new Response(JSON.stringify({ nova: { title: 'Nova strana', sections: [] } }), {
            status: 200,
          })
        : real(input)) as typeof fetch

    renderAt('/sr/administracija/strane', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Otvori: Nova strana' }))
    const form = open(t('admin.form.edit.pages'))

    expect(form.getByLabelText(labelled(t('admin.field.sectionHeading')))).toHaveValue('')
    expect(form.getByLabelText(labelled(t('admin.address')))).toHaveValue('nova')

    globalThis.fetch = real
  })
})

describe('the words the seven forms need', () => {
  it('are all in the dictionary', () => {
    const missing: string[] = []

    for (const entity of ENTITY_FORMS) {
      /* An entity whose rows are fixed is never created, so it has no words for
         creating one: the price list is the year itself, four windows that
         repeat (owner, 30.07.2026). */
      const keys = [
        ...(entity.fixed === true ? [] : [`admin.form.new.${entity.id}`]),
        `admin.form.edit.${entity.id}`,
        entity.form.titleKey,
        entity.form.submitKey,
      ]

      for (const field of entity.form.fields) {
        keys.push(field.labelKey)

        if (field.hintKey !== undefined) {
          keys.push(field.hintKey)
        }

        for (const option of field.options ?? []) {
          keys.push(option.labelKey)
        }
      }

      missing.push(...keys.filter((key) => t(key) === key))
    }

    expect(missing).toEqual([])
  })

  it('put every rule beside the field it belongs to, and not in a help page', () => {
    // Every field whose filling in has a rule carries the rule next to it
    // (PDL P8). These are the ones where the rule is not the field type.
    const withRule = ENTITY_FORMS.flatMap((entity) =>
      entity.form.fields.filter((field) => field.pattern !== undefined),
    )

    expect(withRule.length).toBeGreaterThan(0)
    expect(withRule.filter((field) => field.hintKey === undefined)).toEqual([])
  })

  it('offer an event the three kinds it can be, and asks for no state', () => {
    /* An event has no state at all (owner, 10.08.2026): one on the portal is
       confirmed, one that is not confirmed is not entered, and one that is off
       is deleted. What it has instead is a kind, and a race is the first of the
       three because that is what nearly every one of them is.

       The field the state used to be is named here as well, so that removing it
       stays removed: it was a required select, and a required field left on the
       definition would stop every event from being saved. */
    const options =
      must(
        EVENTS.form.fields.find((one) => one.name === 'kind'),
        'a kind field on the event form',
      ).options ?? []

    expect(options.map((one) => one.value)).toEqual(['race', 'training', 'gathering'])
    expect(EVENTS.form.fields.map((one) => one.name)).not.toContain('status')
    /* And a new one opens on a race before anybody answers (owner,
       10.08.2026). Written as what the form starts holding rather than as what
       a created record carries, because it is a press saved on the form. */
    expect(EVENTS.start).toEqual({ kind: 'race', featured: 'no', country: 'RS' })
  })

  it('file an event in the country its town came with, which is not a field', () => {
    /* The place field writes two values and only one of them is a field
       (forms/types.ts), so the record is built out of a loop that cannot see
       the second. Left out, an event entered on this screen was filed in no
       country at all while the form had been holding one the whole time, and
       nothing on the screen said so, because the country is no longer drawn. */
    const made = recordFrom(EVENTS, {
      id: 'evt-proba',
      values: {
        name: 'Probna trka',
        date: '2027-05-01',
        city: 'Beograd',
        country: 'RS',
        organizer: 'BTL',
        kind: 'race',
      },
    })

    expect(made.city).toBe('Beograd')
    expect(made.country).toBe('RS')
    /* And it came out of nothing, said rather than left missing: the type
       promises a string, and the walk of editions read the field of every event
       entered by hand as undefined (data/editions.ts). */
    expect(made.copiedFrom).toBe('')
  })

  it('offer no choice at all where the value is read off another one', () => {
    // The category of a race is its distance (PDL P5), so it is not a field.
    expect(RACES.form.fields.map((one) => one.name)).not.toContain('category')
    expect(RACES.derived?.({ distanceKm: '21.1' })[0]).toMatchObject({
      name: 'category',
      value: 'half',
      shownKey: 'category.half',
    })
  })
})

describe('the identity a new record is handed', () => {
  /* Counted up from the highest already used, never from the length of the list.
   * The length goes back down: make two, delete the first, make a third, and the
   * third is handed the identity the second holds. The list then draws two rows
   * under one key and a change to either reaches both, because the overlay of
   * changes is keyed by exactly that identity. */
  it('follows the ones already made', () => {
    expect(idFor(TEAMS, {}, [], [])).toBe('teams-nov-1')
    expect(idFor(TEAMS, {}, ['teams-nov-1'], [])).toBe('teams-nov-2')
    expect(idFor(TEAMS, {}, ['teams-nov-1', 'teams-nov-2'], [])).toBe('teams-nov-3')
  })

  it('does not go back when one of them is deleted', () => {
    /* Two made, the first deleted, so the list holds one. Counted by length that
       is "teams-nov-2" again, which is the identity the survivor answers to. */
    expect(idFor(TEAMS, {}, ['teams-nov-2'], [])).toBe('teams-nov-3')
  })

  it('steps over anything not of that shape', () => {
    /* Approving a proposal used to file the team under an identity of its own
       making, which moved this counter for everything entered by hand. It comes
       through here now, and anything else in the list is ignored rather than
       counted. */
    expect(idFor(TEAMS, {}, ['tim-ver-tim-1', 'teams-nov-4'], [])).toBe('teams-nov-5')
    expect(idFor(TEAMS, {}, ['tim-ver-tim-1'], [])).toBe('teams-nov-1')
  })
})

describe('two teams under one name', () => {
  /* A name already taken is refused (PDL P13), and refused by the address it
     makes: the address is read off the name, so two names that make one address
     are two teams at one address. The queue that approves proposals refuses it;
     this is the other door. */
  it('cannot be entered in the administration either', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    await screen.findByRole('table', { name: t('admin.teams') })
    await user.click(screen.getByRole('button', { name: 'Novi tim' }))

    /* Spelt differently on purpose: the address is what collides, and the
       address drops the case and the diacritics. */
    await user.type(screen.getByLabelText(/^Naziv tima/), 'DUNAVSKI TRKACI')
    await user.type(screen.getByLabelText(/^Mesto/), 'Novi Sad')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.selectOptions(screen.getByLabelText(/^Organizator tima/), '000001')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* By the sentence that says why these two are one name, and not only by
       "already exists": the words have to match what is compared, or a member
       reads that a team of that name exists, goes to the list, and finds a name
       that is not the one they typed. */
    expect(screen.getByText(/ne računaju kao razlika/)).toBeVisible()
    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
  })

  it('cannot be made by renaming one in the list either', async () => {
    /* The third door, and the one that was open. A cell writes one field of one
       record: it cannot refuse a name the league already answers to, and it
       cannot put the address right after it, so a team renamed in the row kept
       the address of the name it used to have. Both of those live on the form,
       so the name is read in the list and changed there. The town beside it
       carries neither, and stays a cell. */
    renderAt('/sr/administracija/timovi', 'superadmin')

    await screen.findByRole('table', { name: t('admin.teams') })

    expect(
      screen.getByRole('button', { name: `Mesto: Novi Sad. ${t('admin.change')}` }),
    ).toBeVisible()
    /* "Tim", which is what the column of names is called. */
    expect(screen.queryByRole('button', { name: new RegExp(`^${t('teams.name')}:`) })).toBeNull()
    expect(screen.getByRole('cell', { name: 'Dunavski trkači' })).toBeVisible()
  })

  it('does not refuse a team that is being saved under the name it already has', async () => {
    /* Compared against every team but the one being edited, or opening a team
       and pressing save would refuse it against itself. */
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    await screen.findByRole('table', { name: t('admin.teams') })
    await user.click(screen.getByRole('button', { name: /^Otvori: Dunavski trkači$/ }))

    const city = await screen.findByLabelText(/^Mesto/)
    await user.clear(city)
    await user.type(city, 'Petrovaradin')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
  })
})

describe('which field of a form carries the address', () => {
  /* Two shapes, because a record answers at an address in two ways. A written
     page is filed under it: the address is the identity and the form asks for
     it. A league is filed under an id nobody sees and answers at an address
     somebody chose (`runtrace-2027` is not what the rule would make of "RunTrace
     liga 2027"), so the address is a field of its own. An event's is
     neither: it is worked out from the name and the year and never typed. */
  it('is the field where there is one, and nothing where the address is not typed', () => {
    expect(addressField(PAGES)).toBe('slug')
    expect(addressField(LEAGUES)).toBe('slug')
    expect(addressField(EVENTS)).toBe('')
    expect(addressField(MEMBERS)).toBe('')
  })

  it('is what two records are refused for sharing', () => {
    expect(takenAddress(LEAGUES, { slug: 'runtrace-2027' }, ['runtrace-2027'])).toEqual({
      slug: { key: 'form.errors.taken' },
    })
    expect(takenAddress(LEAGUES, { slug: 'runtrace-2028' }, ['runtrace-2027'])).toEqual({})
    /* And an event is refused by its own rule, on the date, not by this one
       (entityForms.ts, `eventClash`). */
    expect(takenAddress(EVENTS, { name: 'Trka', date: '01/06/2027' }, ['trka-2027'])).toEqual({})
  })
})
