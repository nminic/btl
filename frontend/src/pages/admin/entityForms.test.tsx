import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import sr from '../../i18n/sr.json'
import { translate } from '../../i18n/translate'
import type { FieldDef } from '../../forms/types'
import { at, first, must } from '../../test/at'
import { loadResource } from '../../data/client'
import { emptyValues } from '../../forms/validate'
import { ClockProvider } from '../../clock/ClockProvider'
import { I18nProvider } from '../../i18n/I18nProvider'
import { SessionProvider } from '../../session/SessionProvider'
import { expectFrontPage, renderAt } from '../../test/render'
import { answeredWith, serverThat } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { SLOW } from '../../test/slow'
import { categoryOf } from '../../data/raceCategory'
import { EditableCell } from './EditableCell'
import { EntityEditor, RowActions } from './EntityEditor'
import { useOverlay } from './overlay'
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
  recordsOf,
  takenAddress,
  type EntityDef,
} from './entityForms'

/* The five entities entered whole, each opened whole.
 *
 * The price list is not among them: its rows are given rather than entered, and
 * the screen for it is its own (adminEntities.test). Nor, since 27.09.2026, are
 * the written pages: a written page is never entered or changed through the
 * portal at all (ADL.md, resolved 18.09.2026, "Nijedna pisana strana se ne
 * uredjuje u portalu"), so AdminPages.tsx dropped the form along with every
 * other control that wrote nowhere - what that screen still shows is covered in
 * adminEntities.test, as a plain list.
 *
 * Every screen behind Entities used to change one text field in a row and had no
 * way at all to enter a record. These tests walk all five through the same four
 * questions: does the form show every field the entity has, does an empty
 * obligatory field stop the save and say so beside itself, does a change survive
 * the way back to the list, and is every one of them shut to a competitor.
 */

const dictionary = sr

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

/* Every entity with a screen of its own that still enters and changes a whole
   record through a form. The races are not among them: a race is edited inside
   its event, which is the only place that knows which event it is (owner,
   06.08.2026), and the tests for that stand in adminEntities.test. Nor are the
   ducats, which left administration on the same day. Nor, since 27.09.2026, are
   the written pages (see the file comment above). */
const SCREENS: Screen[] = [
  { entity: MEMBERS, path: 'administracija/clanovi', list: 'Članovi' },
  { entity: EVENTS, path: 'administracija/dogadjaji', list: 'Događaji' },
  { entity: TEAMS, path: 'administracija/timovi', list: 'Timovi' },
  { entity: LEAGUES, path: 'administracija/lige', list: 'Lige' },
  /* The last of them. It is entered and changed by the same renderer reading the
     same kind of JSON as the four above, which is the whole point of it being an
     entity rather than a screen somebody wrote by hand (PDL P28a). What it may
     do is not on the form; that is the matrix below the list. */
  { entity: MODERATORS, path: 'administracija/moderatori', list: 'Moderatori' },
]

/**
 * FOUR OF THE FIVE, LESS THE ONE WHOSE „NEW" BUTTON HAS NOTHING BEHIND IT (26.09.2026).
 * (Five of the six until 27.09.2026, when the written pages left `SCREENS` entirely -
 * see the file comment above `SCREENS` itself.)
 *
 * <p>A member is no longer entered on this screen, and the reason is not that the work is
 * unfinished: `POST /api/competitors` is the GROUP entry that sends invitations (PDL P8b,
 * 25.09.2026), which is a different act from filling one record in. `admin/AdminMembers.tsx`
 * states it in full, and the shape of the refusal is measurable rather than argued -
 * `CompetitorWriteApi.Invited` takes eighteen fields where `admin-clan.form.json` has nine,
 * and the form carries no email address at all, which is the one field an invitation cannot
 * be sent without.
 *
 * <p><b>So this is the same narrowing `SCREENS_WITH_AN_EXISTING_ROW_TO_OPEN` below already
 * does for a moderator, one step earlier in the record's life.</b> A moderator has a „new"
 * form and nothing to open; a member now has neither. The floor under „and no screen quietly
 * grows one back" is not here but in `adminMemberWrites.test.tsx`, which asks the DOM for
 * that button by name and requires it absent - a question one look answers.
 */
const SCREENS_WITH_A_NEW_RECORD_FORM: Screen[] = SCREENS.filter(
  ({ entity }) => entity !== MEMBERS,
)

describe('every entity has a form for a record that does not exist yet', () => {
  it.each(SCREENS_WITH_A_NEW_RECORD_FORM)('$path opens one with every field the entity has', async ({ entity, path }) => {
    const user = setupUser()
    const title = t(`admin.form.new.${entity.id}`)
    renderAt(`/sr/${path}`, 'superadmin')

    await user.click(await screen.findByRole('button', { name: title }))

    expect(screen.getByRole('heading', { level: 2, name: title })).toBeVisible()

    for (const field of entity.form.fields) {
      expect(control(field, title)).toBeInTheDocument()
    }
  })

  it.each(SCREENS_WITH_A_NEW_RECORD_FORM)('$path refuses to save an empty obligatory field', async ({ entity, path }) => {
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
  /**
   * FOUR OF THE FIVE, LESS THE ONE WHOSE EXISTING ROW HAS NOTHING LEFT TO OPEN.
   *
   * <p>A moderator's name and address have no route to write to yet - `ModeratorWriteApi`
   * says so in its own words, quoted in full in `AdminModerators.tsx`'s class comment:
   * „{@link #add} WRITES a name and an address, once; {@link #change} carries the row of
   * boxes and nothing else... a request naming them is refused by the shape of {@link
   * Ticks}, which has no field for either." And his rights are not on this form at all -
   * they are the matrix below the list, ticked one box at a time. So the existing row has
   * no „Otvori" to press and this one test of the four below is narrowed to the four that
   * still have one; the other three `it.each(SCREENS)` blocks in this file are all about
   * the NEW-record form, which a moderator still has in full (three fields, same as ever).
   *
   * <p><b>AND A MEMBER SINCE 26.09.2026, FOR THE SAME REASON WORD FOR WORD.</b> There is no
   * `PUT /api/competitors/{memberNumber}` - measured over `backend/src/main/java`, which
   * declares three (verb, address) pairs for a member and no `PUT` among them - so a row
   * that was opened could only keep a correction for the length of one visit. That is the
   * fault this increment closes, so „Otvori" is gone from that screen and the town cell with
   * it. A member is now the one entity on this list with neither half, which is why it is
   * also out of `SCREENS_WITH_A_NEW_RECORD_FORM` above.
   */
  const SCREENS_WITH_AN_EXISTING_ROW_TO_OPEN: Screen[] = SCREENS.filter(
    ({ entity }) => entity !== MODERATORS && entity !== MEMBERS,
  )

  /**
   * A SERVER IN FRONT OF THE ONE ENTITY THAT HAS ROUTES, and in front of nothing else.
   *
   * <p>Four of the five left now still keep a change as an overlay on the session, which
   * happens inside the press. The competitions call `PUT /api/leagues/{id}` since
   * 25.09.2026 (PDL P28c point 2), so for that one row of this table „it was saved" is an
   * ANSWER, and the case has to wait for it rather than read the screen in the same tick.
   *
   * <p><b>Narrowed to that one address on purpose.</b> A blanket answer to every write
   * would be this file quietly standing in for `test/setup.ts` for four entities that send
   * nothing, and the day one of them starts sending, its first request would be answered
   * „done" by a fixture nobody wrote for it.
   */
  let stop = (): void => {}

  beforeEach(() => {
    ;({ stop } = serverThat((path, init) =>
      init?.method !== undefined && init.method !== 'GET' && path.startsWith('/api/leagues')
        ? answeredWith(200)
        : null,
    ))
  })

  afterEach(() => {
    stop()
  })

  it.each(SCREENS_WITH_AN_EXISTING_ROW_TO_OPEN)(
    '$path keeps the change after the way back',
    async ({ entity, path, list }) => {
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
      // "saved" and left to be trusted. Awaited, because for one of the six the
      // confirmation is the server's answer and not the press (see the server above).
      const saved = await screen.findByRole('status', { name: t('admin.form.saved') })
      expect(within(saved).getByText(changed)).toBeVisible()

      await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

      // The list names the record by what it is called now, which is how the
      // change shows without every screen having a column for every field.
      await user.click(
        screen.getByRole('button', { name: labelled(`${t('admin.form.open')}: ${changed}`) }),
      )

      expect(control(field, title)).toHaveValue(changed)
    },
  )
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
  /**
   * THIS CASE WAS DRIVEN THROUGH THE MEMBER FORM UNTIL 26.09.2026, AND WHAT IT HELD HAS BEEN
   * SPLIT RATHER THAN DROPPED.
   *
   * <p>It asked two different things in one breath: what a form WRITES into a record, and
   * what the list then DRAWS of it. The member form is gone (PDL P8b, and the note on
   * `admin/AdminMembers.tsx`), so the first half has no subject any more. The second half
   * still has one, because the table is still there - so every assertion about the drawn row
   * now stands in `adminMemberWrites.test.tsx`, over a SERVED member rather than a typed one:
   * the beginners' category instead of her band, the town, and the basis of her membership.
   * Read off a fixture, those assertions are stronger than they were, because a typed record
   * and the row drawn from it could agree by both being wrong about the same field.
   *
   * <p>What remains here is the one claim that was never about the screen at all.
   */
  it('has no field for a flag nothing reads any more', () => {
    /* The form used to carry a box saying the membership was active, with a note
       that an unpaid member has an account but is visible nowhere. Nothing reads
       that flag any more: an unpaid member is not in the member list at all, they
       wait in the queue of memberships (ADL A4d), so the box was a way to put back
       into the list exactly what that change took out of it. Held on the
       definition rather than on the screen, because a field that is not there has
       no label to ask the screen about - which is also why this outlived the screen
       that used to drive it. */
    expect(MEMBERS.form.fields.map((one) => one.name)).not.toContain('active')
  })

  it('carries every field the record has, including the ones no field asks for', () => {
    /* A record is what was made; a form is one way of filling it. A team has a
       logo and a square of that logo, and the form an administrator enters
       one on asks for neither, so both come off the blank the entity carries.

       Written as a test because the blank went in without one and the review
       proved it: taking `logo` back out left 1849 tests passing. What it costs
       is not abstract. `TeamMark` decides between a picture and a monogram by
       asking whether the logo is null, and a field that is simply absent is
       `undefined`, which is not null: every team entered by an administrator
       drew an empty picture element where its initials belong.

       Read off the entity rather than off a screen, because the screens that
       draw teams read the file the league was seeded from and not the overlay
       this record lives in until F5 (entityForms.ts). */
    const made = recordFrom(TEAMS, { id: 'tim-probni', values: { name: 'Probni tim' } })

    expect(made.logo).toBeNull()
    expect(made.crop).toEqual({ x: 0.5, y: 0.5, size: 1 })
    expect(made.name).toBe('Probni tim')
  })

  it.each([
    ['competitors' as const, MEMBERS],
    ['events' as const, EVENTS],
    ['teams' as const, TEAMS],
    ['leagues' as const, LEAGUES],
    ['moderators' as const, MODERATORS],
  ])('makes a %s record with every field the served ones have', async (name, entity) => {
    /* The case above says this about one entity and its title claims the class; a review
       measured that the class was not held, and three fields were missing from the member
       blank while the package stayed green (06.09.2026).

       **Asked of the record, not of the sources that write it.** The first draft of this
       counted names across the identity, the form and the blank, and `Object.keys` counts a
       key whose value is `undefined` too, which is the very state the blank exists to
       forbid: `like` has nothing to read the shape off, so „false" comes back as a string
       and a member can tick „hide my profile" and never untick it. It also modelled three
       writers when there are four, and missed the country a place field writes.

       So the record is made the way the portal makes one, off the form's own empty values,
       and every field the served records carry must be there **and be something**.

       Over all served records rather than the first, because a field that only some of them
       carry is exactly the one that goes quietly short.

       **One road, and it is the road a record is made on from an empty form.** A field the
       form itself asks about is answered by the form, so taking it out of the blank as well
       leaves this green: measured on the event's `description` and `link`, which the blank
       carries for the other road, creation by copying an event. That road is not walked here.

       **Two of the eight entities are outside this, measured and said rather than left out
       quietly.** `RACES` carries a form no screen has rendered since 23.08.2026, since a race
       is entered inside its event, so nothing makes a race this way. And `pages` is not served
       as a list of records at all, so there is nothing to compare against. `PRICING` has no
       served resource of its own. */
    const served = await loadResource<Record<string, unknown>[]>(name)
    /* A checkbox as the word the overlay holds, everything else as it comes, which is exactly
       what the portal writes: `textFrom` puts every form value through `String` on the way to a
       record, and `emptyValues` hands out only `''` and `false`, so these are the same strings.

       Written as a ternary rather than `String` over everything because that is what keeps the
       type honest: the record wants `Record<string, string>`, and anything else here is a
       compile error rather than a value quietly turning into its own name. Measured in review
       06.09.2026, and worth saying plainly: `String` over everything catches exactly as much as
       this does, because `emptyValues` cannot return a value that is not there. */
    const values = Object.fromEntries(
      Object.entries(emptyValues(entity.form)).map(([field, value]) => [
        field,
        typeof value === 'boolean' ? String(value) : value,
      ]),
    )
    const made = recordFrom(entity, { id: 'probni', values })

    /* **The shape, not the presence.** Asked only „is it there", a value of the wrong shape
       walks through: `birthdayShown: null` in the blank is present, and a member entered in
       administration then opens Podešavanja with none of the three answers chosen, while the
       record behaves as „show nothing" (review, 06.09.2026). The shapes the served records
       carry are the answer, and they carry every shape a field is allowed: `teamId` is a
       string on some and null on others, so both are right and neither is guessed here.

       A field that is not there at all has the shape „undefined", which no served record
       carries, so one question answers both.

       **Where this floor stops, measured rather than left for the next reader.** It holds a
       blank field the form does not ask for, in both directions: `copiedFrom` off the event
       blank falls, and so does `copiedFrom: null`. It does not hold `description` and `link`
       off that same blank, because `emptyValues` seeds every form field, so the record is
       made whole without them; the blank says as much in its own comment. And it says
       nothing about a value that is the right shape and the wrong answer, which is a question
       about behaviour: „ništa" as the birthday a new member starts on is held where it shows,
       on the three buttons in Podešavanja (profilePrivacy.test.tsx). */
    const shapeOf = (value: unknown): string =>
      value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value

    const shapes = new Map<string, Set<string>>()

    for (const one of served) {
      for (const [field, value] of Object.entries(one)) {
        shapes.set(field, (shapes.get(field) ?? new Set()).add(shapeOf(value)))
      }
    }

    const wrong = [...shapes]
      .filter(([field, seen]) => !seen.has(shapeOf(made[field])))
      .map(([field, seen]) => `${field}: ${shapeOf(made[field])}, served ${[...seen].join('/')}`)

    expect(wrong).toEqual([])

    /* **And the answer, where the shape cannot tell right from wrong.** A field the data ever
       leaves empty is a field a record is allowed not to have, so a record where nothing was
       entered has not got it. Asked only about shape, `teamId: 'team-dunav'` on the blank is a
       string like any other, and every member entered in administration would be in the Dunav
       club without a request and without an invitation, counted into that club's standing
       (PDL P13). Measured in review 06.09.2026: the whole package stays green. The same for
       `referredBy`, which credits somebody a referral they never brought.

       Derived, not listed: whichever fields the served records leave empty are the fields this
       asks about, and today that is three on a member (`teamId`, `teamSince`, `referredBy`) and
       one on a team (`logo`). A fifth arriving tomorrow is asked the same question without
       anybody adding it here.

       Where it stops: a field the data never leaves empty says nothing here, and „ništa" as the
       birthday a new member starts on is held on the three buttons in Podešavanja
       (profilePrivacy.test.tsx), because „none" and „full" are the same shape and neither is
       empty. */
    const filled = [...shapes]
      .filter(([field, seen]) => seen.has('null') && made[field] !== null)
      .map(([field]) => `${field}: ${String(made[field])}`)

    expect(filled).toEqual([])

    /* **The floor of the floor.** Everything above is read off `served`, so an empty list makes
       both questions ask about nothing at all and pass by saying so (review, 06.09.2026):
       `loadResource` handing back `[]` would let a field leave the blank unseen. */
    expect(shapes.size).toBeGreaterThan(0)
  })
})

describe('the identity of a record', () => {
  /**
   * TWO CASES ABOUT A MEMBER NUMBER STOOD HERE UNTIL 26.09.2026, AND THIS IS WHERE THEY WENT.
   *
   * <p>Both drove the member form: one asked that the number is never a field on it, the
   * other that two members entered in turn are handed two different numbers. The form is gone
   * (PDL P8b, and the note on `admin/AdminMembers.tsx`), so „the form does not ask for it" has
   * become vacuous - there is no form to ask - and neither case could reach a save.
   *
   * <p><b>Neither claim lost its floor, and that was measured rather than assumed before they
   * were removed.</b>
   *
   * <ul>
   * <li><b>„The number is handed out, not typed" is now a stronger statement</b>, and it is
   * made where it can be: `adminMemberWrites.test.tsx` requires that screen to offer no
   * control that makes a member at all. A field that cannot be reached cannot be typed into.
   * <li><b>„Each one gets the next free number" is still live and still measured</b>, because
   * handing numbers out never belonged to the form: it happens when a membership is
   * activated (`admin/memberNumbers.ts:121`, ADL A4d), and `adminFlows.test.tsx` has „hands
   * every activated membership its own number, not one number to all of them" over exactly
   * that path.
   * <li><b>And the arithmetic itself is tested directly</b>, below, in „the identity a new
   * record is handed": five cases over `idFor` with no screen involved (four over the counter
   * a team or an event answers to, one over the one entity that types its own - a written
   * page's `slug` - added 27.09.2026 for the same reason this comment exists: a claim that
   * lost its screen is measured directly rather than dropped), which is where a question
   * about identity belongs anyway.
   * </ul>
   */

  /* "is refused for a written page whose address answers already" removed
     27.09.2026: it drove this refusal through the New-page form, which is
     gone along with every other control that wrote on AdminPages.tsx (ADL.md,
     resolved 18.09.2026, a written page is never entered or changed through
     the portal). The refusal itself is not lost - it is `takenAddress`, a pure
     function of `entityForms.ts` still measured directly, PAGES included, in
     "which field of a form carries the address" below. What only the UI test
     could show, that a rejected attempt leaves no row behind, no longer has a
     UI capable of making the attempt. */

  /**
   * TWO RECORDS ENTERED IN ONE VISIT, WHICH IS A DIFFERENT QUESTION FROM ONE.
   *
   * <p><b>Why it is here, and it is a measurement of 26.09.2026 rather than thoroughness.</b>
   * When a new record is saved, `EntityEditor` works out its identity against what this
   * visit has ALREADY made as well as against what is taken - and that first list is read by
   * walking `creations[entity.id]`. Walked when it is empty, the walk does nothing, so the
   * whole of that reading is exercised only by a SECOND record in one visit.
   *
   * <p>The second record was a member until 26.09.2026, then a written page until
   * 27.09.2026 (this PR's own first pass, when the member form went and this moved to
   * pages for being the last entity left that still typed its own identity). Both forms
   * are gone now, along with the whole reason pages were chosen: a written page is never
   * entered through the portal (ADL.md, resolved 18.09.2026), so the case moves again,
   * this time onto a counter-assigned identity rather than a typed one.
   *
   * <p><b>Asked of teams instead.</b> The question was never really about typing an
   * address - it is about `creations[entity.id]` being read at all, which `idFor`'s own
   * unit cases below (`the identity a new record is handed`) already prove for the shape
   * of the counter itself. What only a full `EntityEditor` render still proves, and what
   * moves here rather than disappearing with the pages screen, is that TWO PRESSES of
   * „Sačuvaj" in the same visit leave TWO rows rather than one overwriting the other -
   * the wiring between the screen and `idFor`, not the arithmetic.
   *
   * <p><b>Listed twice is not proven distinct, so this also edits one of them</b> - the same
   * shape as the historical fault this file already names twice over (above: „two members
   * answered to one number... changing the city of one of them changed both, since the
   * overlay of changes is keyed by the number"). Two rows with the SAME identity would still
   * count and name correctly right after entry; only a later edit reaching both, because
   * `EditableCell`/`EntityEditor` file changes under `recordKey(entity.id, id)`, would show
   * the collision. Measured: forcing `creations[entity.id]` empty at the point `idFor` reads
   * it makes both new teams claim „-1" and passes every assertion above unchanged, while the
   * edit below then reaches the second team as well as the first. */
  it('keeps the first when a second is entered in the same visit', async () => {
    const user = setupUser()
    const title = t('admin.form.new.teams')
    renderAt('/sr/administracija/timovi', 'superadmin')

    const before = within(await screen.findByRole('table', { name: 'Timovi' }))
    const rows = before.getAllByRole('row').length

    for (const name of ['Prvi novi tim', 'Drugi novi tim']) {
      await user.click(screen.getByRole('button', { name: title }))

      const form = open(title)

      await user.type(form.getByLabelText(labelled(t('admin.field.teamName'))), name)
      await user.type(form.getByLabelText(labelled(t('admin.field.city'))), 'Čačak')
      await user.selectOptions(form.getByLabelText(labelled(t('admin.field.country'))), 'RS')
      await user.selectOptions(form.getByLabelText(labelled(t('admin.field.teamOrganizer'))), '000001')
      await user.click(form.getByRole('button', { name: t('form.submit') }))
      await user.click(screen.getByRole('button', { name: t('admin.form.back') }))
    }

    const list = within(await screen.findByRole('table', { name: 'Timovi' }))

    /* Both, and the first named as well as the second: a second entry that overwrote the
       first would leave the row count right and one of the two names missing. */
    expect(list.getByRole('button', { name: 'Otvori: Prvi novi tim' })).toBeVisible()
    expect(list.getByRole('button', { name: 'Otvori: Drugi novi tim' })).toBeVisible()
    expect(list.getAllByRole('row')).toHaveLength(rows + 2)

    /* And distinct, not merely listed twice: editing the first's town must not reach
       the second, which is what a shared identity would do. */
    await user.click(list.getByRole('button', { name: 'Otvori: Prvi novi tim' }))
    const editForm = open(t('admin.form.edit.teams'))
    await user.clear(editForm.getByLabelText(labelled(t('admin.field.city'))))
    await user.type(editForm.getByLabelText(labelled(t('admin.field.city'))), 'Vranje')
    await user.click(editForm.getByRole('button', { name: t('form.submit') }))
    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    const after = within(await screen.findByRole('table', { name: 'Timovi' }))
    const second = must(
      after.getByText('Drugi novi tim').closest('tr'),
      'the row of the team that was not edited',
    )
    expect(within(second).getByText('Čačak')).toBeVisible()
  }, SLOW)

  /**
   * „DOES NOT STAND IN THE WAY OF THE RECORD IT BELONGS TO" WAS HERE, OVER A MEMBER, AND IT
   * WENT WITH „OTVORI" ON 26.09.2026.
   *
   * <p>It opened an existing member, changed the town and asked that the save was not refused
   * for the number the record already holds. There is no `PUT /api/competitors/{memberNumber}`
   * and therefore no „Otvori" on that screen any more, so the case had no door to go through.
   *
   * <p><b>What it guarded is `takenAddress`, and both the UI case that stood above this
   * comment and the door this one lost are gone the same way, one PR later.</b> „is refused
   * for a written page whose address answers already" (above, this file) drove the same
   * question through the New-page form and was removed 27.09.2026 for the reason its own
   * comment gives. What survives both removals is the same: `takenAddress` is a pure
   * function of `entityForms.ts` and is measured directly, PAGES included, in „which field
   * of a form carries the address" below - a member number was always the weaker subject for
   * this question anyway, because it is handed out rather than typed, which is why
   * `addressField` returns nothing for it at all (`entityForms.ts:611`).
   */
})

/**
 * A race is entered inside its event, so every one of these opens the event
 * first (owner, 06.08.2026). The screen of races is gone, and with it the
 * question of which event a race belongs to.
 */
/** The screen of events with the first of them open, which is where a race is
 *  entered since 23.08.2026. */
async function openFirstEvent(user: ReturnType<typeof setupUser>) {
  renderAt('/sr/administracija/dogadjaji', 'superadmin')

  const events = within(await screen.findByRole('table', { name: 'Događaji' }))

  await user.click(within(at(events.getAllByRole('row'), 1)).getByRole('button', { name: /^Otvori:/ }))
  await screen.findByRole('heading', { name: /^Trke na događaju/ })
}

describe('the category of a race', () => {
  it('is read off the length in the row, and never asked for', async () => {
    /* It was a free choice beside the distance, so a race of 42,2 km could be
       saved as a short one and the board of most marathons lied. The category is
       the distance, by the exact value and with no tolerance (PDL P5), so there is
       nothing to ask.

       Since 23.08.2026 there is no form for a race at all: the rows are the form
       (owner). The cell changes as the length is typed, before anything is saved,
       which is what „kategorija se zavisno od toga menja automatski" asks for. */
    const user = setupUser()

    await openFirstEvent(user)
    await user.click(screen.getByRole('button', { name: t('admin.form.new.races') }))

    const rows = () =>
      within(screen.getByRole('table', { name: /^Trke na doga\u0111aju/ })).getAllByRole('row')
    const last = () => within(must(rows()[rows().length - 1], 'the row just opened'))

    /* Nothing chooses it and nothing asks which event this is: the screen it is
       entered on already answers that. */
    expect(last().queryByLabelText(/^Kategorija/)).toBeNull()
    expect(last().queryByLabelText(/^Događaj/)).toBeNull()

    /* And since 24.08.2026 nothing says it either, because the owner took the column
       back out („U dodavanju trka na događaju (administriranje) ne treba da postoji
       Kategorija kolona ipak"). A length typed into the row must add no category.

       Asked after the length is typed and not only before it: the cell was worked out
       as it was typed, so a row with no length reads the same whether the column is
       there or not, and asking only the empty row would pass either way. */
    await user.type(last().getByLabelText(/^Dužina/), '42.2')

    expect(last().queryByText(t('category.marathon')), 'the row still says a category').toBeNull()

    await user.clear(last().getByLabelText(/^Dužina/))
    await user.type(last().getByLabelText(/^Dužina/), '10')

    expect(last().queryByText(t('category.short')), 'the row still says a category').toBeNull()

    /* The reading itself did not go out with the column. It is asked of the rule
       rather than of a screen now (`data/raceCategory.test.ts`), which is where it
       belongs: the boards, the filters and the ducats read it too, and none of them
       goes through this table. */
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

  /* „Every field whose filling in has a rule carries the rule next to it" stood
     here until 31.08.2026, and it stopped being true by decision: the owner read
     the whole list of sixty one and kept seven, none of them on these forms
     („Sve ostalo treba obrisati"). What a field with a pattern promises is now
     held by the pattern alone, and what it refuses is said when it refuses. */

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
    /* The words the FORM opens with, and not what the record keeps: the two
       buttons carry „yes" and „no" and the record keeps a flag, which is where
       `forms/records.ts` stands between them. */
    expect(EVENTS.start).toEqual({ kind: 'race', featured: 'no', country: 'RS' })
  })

  it('ask about a league only what a league still has', () => {
    /* One of these five used to be six. `groupsByCategory` asked which way the
       competition ranks, and on 31.08.2026 the owner settled that there is one
       way and it is by gender: „Lige treba da imaju poredak samo po polu. Ne
       želim dodatna pravila", said of every league („nego globalno!") and not of
       the one the portal was built for.

       Named here rather than left to the record, because the two are not held
       together by anything: a field on the form the record has no room for is
       written into the record all the same, under a name nothing reads. That is
       what would happen the moment somebody puts this one back — the answer would
       be saved on every league and change nothing at all, which is worse than a
       setting that works.

       The other five are named too, so the guard fails on a field going missing
       as well as on one coming back. */
    expect(LEAGUES.form.fields.map((one) => one.name)).toEqual([
      'name',
      'slug',
      'season',
      'rules',
      'prizes',
    ])

    /* And the words each of them is asked under. A field carries its label by a name in
       the dictionary, and a name is a place the overturned rule can be put: the label of
       „prizes" pointed at a key holding „Podela na kategorije zadaje se na nivou svake
       Lige" and the whole gate stayed green, because the screen guards read routes and
       this form is drawn on a press (review, 01.09.2026). The way in through `hintKey` is
       closed in `forms/fieldHint.test.tsx`; this is the same door with another handle. */
    const labels = LEAGUES.form.fields.map((one) => one.labelKey)

    expect(labels).toEqual([
      'admin.field.leagueName',
      'admin.address',
      'rankings.season',
      'leagues.rules',
      'leagues.prizes',
    ])

    /* **And the words behind those names**, which the names alone do not hold: the value
       of `admin.field.leagueName` was made to read „Naziv lige. Podela na kategorije
       zadaje se na nivou svake Lige." and the whole gate stayed green, because **three**
       of these five — `admin.field.leagueName`, `admin.address` and `rankings.season` —
       live in branches no snapshot holds, and the only case that reads the first anchors
       on the start of the label (review, 01.09.2026). Of the three only the first was
       loose: the other two are held by screens that ask for them by their exact word,
       and by nothing that says why.

       Held here rather than by widening a snapshot over the whole dictionary: these five
       are the words a competition is entered under, and they are the ones that can carry
       a rule about a competition.

       **What it costs, said plainly:** `admin.address` is also the address on the form a
       static page is written on, so renaming it for a reason that has nothing to do with
       competitions fails here, under a name that points at leagues. That is the price of
       holding a shared word, and it is paid knowingly. */
    expect(labels.map((key) => translate(sr, 'sr', must(key, 'a label'), {}))).toEqual([
      'Naziv lige',
      'Adresa',
      'Sezona',
      'Propozicije',
      'Nagrade',
    ])
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
        kind: 'race',
      },
    })

    expect(made.city).toBe('Beograd')
    expect(made.country).toBe('RS')
    /* And it came out of nothing, said rather than left missing: `EVENTS.blank`
       holds the `null` and this writes nothing over it, so the walk of editions
       reads „not copied" rather than `undefined` (data/editions.ts). */
    expect(made.copiedFrom).toBeNull()
  })

  it('offer no choice at all where the value is read off another one', () => {
    /* The category of a race is its distance (PDL P5), so it is not a field, and
       since 23.08.2026 it is not a derived value of a form either: a race is
       entered in a row of the event's own table and the cell is worked out from
       the length beside it (`admin/EventRaces.tsx`, held by `adminEntities`). */
    expect(RACES.form.fields.map((one) => one.name)).not.toContain('category')
    expect(RACES.derived, 'the entity still derives something nothing draws')
      .toBeUndefined()
    expect(categoryOf(21.1), 'the rule itself moved as well').toBe('half')
  })
})

describe('the identity a new record is handed', () => {
  /* Counted DOWN from the lowest already used, never from the length of the list.
   * The length goes back down: make two, delete the first, make a third, and the
   * third is handed the identity the second holds. The list then draws two rows
   * under one key and a change to either reaches both, because the overlay of
   * changes is keyed by exactly that identity.
   *
   * Downwards since 20.09.2026, because a team is identified by a `bigserial` now
   * (`/api/teams`) and a screen that has not read the file cannot know which
   * numbers are taken. Below nought it does not have to: a sequence starts at one
   * and never goes under it (`admin/raceIds.ts`, `nextIdentity`). */
  it('follows the ones already made', () => {
    expect(idFor(TEAMS, {}, [], [])).toBe('-1')
    expect(idFor(TEAMS, {}, ['-1'], [])).toBe('-2')
    expect(idFor(TEAMS, {}, ['-1', '-2'], [])).toBe('-3')
  })

  it('does not go back when one of them is deleted', () => {
    /* Two made, the first deleted, so the list holds one. Counted by length that
       is „-2" again, which is the identity the survivor answers to. */
    expect(idFor(TEAMS, {}, ['-2'], [])).toBe('-3')
  })

  /**
   * AND FOR THE ONE ENTITY THAT HANDS ITS OWN OUT, WHICH SINCE 26.09.2026 IS ASKED HERE AND
   * NOWHERE ELSE.
   *
   * <p>`MEMBERS` is the only entity carrying `handsOutIdentity` (`entityForms.ts:125`), and
   * the only thing that ever reached that branch was the member form. The form is gone (PDL
   * P8b), so the branch went from „covered by two screen cases" to unreachable in the same
   * commit - and nothing said so: every test stayed green and the whole list of mutations
   * stayed caught, because a mutation can only ask whether something that RUNS has a guard.
   * The 100 per cent threshold is what reported it, which is the division `CLAUDE.md` states.
   *
   * <p><b>Asked directly rather than through a screen on purpose.</b> Handing a number out is
   * arithmetic over what is taken; it belongs beside the three cases above it, and the flow
   * that still uses it in production - activating a membership (`admin/memberNumbers.ts:121`)
   * - is measured on its own screen in `adminFlows.test.tsx`.
   *
   * <p><b>And it reads `taken` rather than `made`</b>, which is the whole difference between
   * this entity and the three cases above: a member number is decided by what has ever been
   * spoken for, so what this visit happens to have entered is not a separate list to count.
   */
  it('counts up from the highest spoken for, for the one entity that hands its own out', () => {
    expect(idFor(MEMBERS, {}, [], ['000001', '000002'])).toBe('000003')
    /* A GAP IS STEPPED OVER RATHER THAN FILLED, and that is the decision rather than an
       implementation detail: a number only ever counts up (PDL P8, 31.07.2026), because
       deleting a member unties the number from the person while the number itself stays
       spent - it stands in old results, old tables and a printed card. Reading this the
       other way round handed the highest number straight back to the next member to join,
       which is the one thing the rule exists to prevent. */
    expect(idFor(MEMBERS, {}, [], ['000001', '000003'])).toBe('000004')
    /* And what this visit made is not what decides it: only what is taken. */
    expect(idFor(MEMBERS, {}, ['000009'], ['000001'])).toBe('000002')
  })

  it('steps over anything not of that shape', () => {
    /* Approving a proposal used to file the team under an identity of its own
       making, which moved this counter for everything entered by hand. It comes
       through here now, and anything else in the list is ignored rather than
       counted: `Number('tim-ver-tim-1')` is not a number, and `Number('')` is
       nought, which is neither a record of the file nor one made here. */
    expect(idFor(TEAMS, {}, ['tim-ver-tim-1', '-4'], [])).toBe('-5')
    expect(idFor(TEAMS, {}, ['tim-ver-tim-1'], [])).toBe('-1')
    expect(idFor(TEAMS, {}, [''], [])).toBe('-1')
  })

  /* And the file's own numbers are stepped over as well, which is what makes the
     screen that has not read it safe: `ReviewQueue` hands in what this visit made
     and nothing else. */
  it('is below nought whatever the file holds', () => {
    expect(idFor(TEAMS, {}, ['1', '2', '1167'], [])).toBe('-1')
  })

  /* THE THIRD WAY, WHICH NO SCREEN REACHES ANY MORE (27.09.2026). `idFor` answers
   * three ways an entity comes by an identity: handed out (members), counted up
   * from what is free (the case above), or typed where the form asks for it -
   * `namesItself`, true of exactly one entity, a written page, because its `slug`
   * is both its address and its idField. Written pages stopped being entered
   * through the portal that day (ADL.md, resolved 18.09.2026), so no `it.each(SCREENS)`
   * walk exercises this branch through a screen any longer.
   *
   * `namesItself` and this branch of `idFor` are not deleted along with the
   * screen: they are `entityForms.ts`'s own claim about what a form asks for, not
   * about which screen calls it, and deleting an assertion is not something this
   * change was asked to do. So the claim is measured directly against the one
   * entity it is still true of, `PAGES`, exactly as `addressField`/`takenAddress`
   * already are below ("which field of a form carries the address"). */
  it('is read straight off the form for the one entity that types its own', () => {
    expect(idFor(PAGES, { slug: 'nova-strana' }, [], [])).toBe('nova-strana')
  })
})

describe('a field changed in the row rather than on the form', () => {
  /* WHAT IT IS FILED UNDER, which since 20.09.2026 is the family AND the number
   * and not the number alone (`session/context.ts`, `recordKey`).
   *
   * The cell was writing the bare number for a day while every reader of it had
   * moved on to the pair, so the two never met: the cell drew the new value out
   * of its own writing and everything that reads a record through `recordsOf`
   * went on showing the old one. Six cells on four screens, and on the public
   * side a member's town and a written page's title.
   *
   * **Read off something the cell does not write**, or the case proves nothing:
   * the cell's own text is new either way, because it falls back to what it
   * wrote under whatever key it used. The button that opens the record is fed
   * from `recordsOf`, so it is the one that tells a key that meets from one that
   * does not, and it tells a wrong FAMILY apart as well - a cell handed the
   * wrong one writes and reads a key of its own just as happily.
   *
   * MOVED OFF `AdminPages.tsx` ON 27.09.2026, ONTO A FIXTURE ENTITY RATHER THAN A
   * SCREEN, AND THIS IS THE SECOND MOVE OF THE SAME CASE. It measured a
   * moderator's first name until B106, then a written page's title from B106
   * until this move: moderators lost their cell first (`AdminModerators.tsx`'s
   * class comment names why), and a written page's title was, after that, the
   * one remaining screen whose cell IS the row's own name - teams and members
   * also keep a cell, but theirs is a town beside a name the cell does not
   * touch, which cannot show the „Otvori" button moving with it.
   *
   * Pages left too (ADL.md, resolved 18.09.2026: a written page is never
   * entered or changed through the portal, so `AdminPages.tsx` dropped
   * `EditableCell` along with every other control that wrote). No entity's
   * screen puts a name in a cell at all any more, so what is measured here no
   * longer has a screen that shows it and stands on a fixture instead: `TEAMS`,
   * borrowed for its shape and not exercised for being a team, the same way
   * `deleting.test.tsx` already borrows it for a case that is not about teams
   * either. The sweep over the other cells is still the compiler's, as before:
   * the family is a required prop, so a cell that does not take one does not
   * build. What it cannot answer is whether the family handed in is the right
   * one, which is what this measures. */
  it('reaches the record every other reader of it sees', async () => {
    const user = setupUser()
    const base = [{ id: 'tim-1', name: 'Prvobitno' }]

    function FixtureRow() {
      const overlay = useOverlay()
      const row = must(recordsOf(TEAMS, base, overlay).at(0), 'the one row this fixture holds')

      return (
        <>
          <EditableCell under={TEAMS.id} id={row.id} field="name" value={row.name} label="Naziv" />
          <RowActions entity={TEAMS} record={row} name={row.name} onOpen={vi.fn()} />
        </>
      )
    }

    render(
      <I18nProvider locale="sr">
        <SessionProvider>
          <FixtureRow />
        </SessionProvider>
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: `Naziv: Prvobitno. ${t('admin.change')}` }))
    await user.clear(screen.getByRole('textbox', { name: 'Naziv' }))
    await user.type(screen.getByRole('textbox', { name: 'Naziv' }), 'Izmenjena')
    await user.tab()

    /* The half that must go on working, first: without it the case below passes
       on a fixture that has stopped drawing a cell altogether. */
    expect(
      screen.getByRole('button', { name: `Naziv: Izmenjena. ${t('admin.change')}` }),
    ).toBeVisible()

    /* And the half that was broken. The name on this button is built out of the
       record `recordsOf` merged, not out of the cell. */
    expect(screen.getByRole('button', { name: 'Otvori: Izmenjena' })).toBeVisible()
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
    /* ASKED OF A WRITTEN PAGE AND NO LONGER OF A COMPETITION (25.09.2026). The two were
       this function's only two entities until the screen of competitions began calling
       `LeagueWriteApi` (PDL P28c point 2). `AdminLeagues.tsx` stopped handing in a list of
       addresses that day, because such a list can only ever be INCOMPLETE - what this
       browser was served plus what this visit made, against a table every administrator
       writes into - so it refused some collisions and let others through to a route that
       refuses all of them by name. A case asserting the league branch would be measuring
       a combination the portal no longer makes, which is a guard that cannot fail.

       `addressField(LEAGUES)` above is still live and is still asked on every save: the
       editor reads it to keep a record from competing with its own address. */
    expect(takenAddress(PAGES, { slug: 'pravilnik' }, ['pravilnik'])).toEqual({
      slug: { key: 'form.errors.taken' },
    })
    expect(takenAddress(PAGES, { slug: 'statut' }, ['pravilnik'])).toEqual({})
    /* And an event is refused by its own rule, on the date, not by this one
       (entityForms.ts, `eventClash`). */
    expect(takenAddress(EVENTS, { name: 'Trka', date: '01/06/2027' }, ['trka-2027'])).toEqual({})
  })
})

describe('a record does not compete with its own address', () => {
  /* `EntityEditor` reads `addressField` to keep a saved record from being told its
   * own address is taken (`entityForms.ts`, `others`, comment: "A record being
   * changed is not competing with itself"). No screen still hands this a `taken`
   * list of more than one address to prove it against: `AdminLeagues.tsx` stopped
   * on 25.09.2026 ("which field of a form carries the address" above explains
   * why), and `AdminPages.tsx` stopped on 27.09.2026 along with every other
   * control that wrote (this PR). The exclusion itself is not deleted along with
   * either screen, so it is measured here, straight against `EntityEditor`,
   * rather than through a screen that no longer calls it this way - the same
   * move `EditableCell`'s own case above already made.
   *
   * Written with `PAGES` because its form still has the one field
   * (`addressField(PAGES) === 'slug'`) this needs, not because the portal edits
   * pages again: nothing here calls `usePages` or mounts `AdminPages`. */
  it('lets a save keep the address it already had, and still refuses a different one already taken', async () => {
    const user = setupUser()
    const record = { slug: 'pravilnik', title: 'Pravilnik', heading: 'Uvod', body: 'Tekst.' }

    function Editing() {
      /* `EntityEditor` never resets its own „saved" state; the screens that use it
         return to a list and mount a fresh one on the next „Otvori" instead. This
         fixture has no list, so the key changes on `onDone` to do the same thing:
         force a fresh instance for the second half of this case, rather than one
         still showing the first save's confirmation. */
      const [remount, setRemount] = useState(0)

      return (
        <EntityEditor
          key={remount}
          entity={PAGES}
          editing={{ mode: 'one', record }}
          taken={['pravilnik', 'uslovi-koriscenja']}
          onDone={() => setRemount((n) => n + 1)}
        />
      )
    }

    render(
      <I18nProvider locale="sr">
        <ClockProvider>
          <SessionProvider>
            <Editing />
          </SessionProvider>
        </ClockProvider>
      </I18nProvider>,
    )

    const title = t('admin.form.edit.pages')

    // Saved with the address unchanged: `others` excluded it from `taken`, or this
    // reads as the record arguing with itself over its own address.
    await user.click(open(title).getByRole('button', { name: t('form.submit') }))
    expect(screen.getByRole('status', { name: t('admin.form.saved') })).toBeVisible()

    await user.click(screen.getByRole('button', { name: t('admin.form.back') }))

    // The other address `taken` still names is refused exactly as before; nothing
    // about excluding this record's own address widens what else is free.
    const address = open(title).getByLabelText(labelled(t('admin.address')))
    await user.clear(address)
    await user.type(address, 'uslovi-koriscenja')
    await user.click(open(title).getByRole('button', { name: t('form.submit') }))

    expect(document.getElementById('field-slug-error')).toHaveTextContent(t('form.errors.taken'))
    expect(screen.queryByText(t('admin.form.saved'))).not.toBeInTheDocument()
  })
})

/* „The explanation of what a race is called" was measured here until 31.08.2026,
   when the owner kept seven rules on the whole portal and this was not one of them.
   The case that survived asked the dictionary for the key it had just deleted, and
   `translate` answers an unknown key with the key itself, so it was looking for the
   literal words „admin.hint.raceName" on the screen, which nothing has ever drawn.
   A guard that cannot fail is worse than none, since it reads as cover; it is gone
   rather than rewritten, because the thing it covered is gone. */
