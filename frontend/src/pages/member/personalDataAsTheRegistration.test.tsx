import { configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { neverPaidAsServed } from '../../test/neverPaid'
import { moderatorWith, renderAt } from '../../test/render'
import { answeredWith, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { OVER_THE_MEMBERS } from '../profile/whoReadsTheData'

/**
 * THE MEMBER'S OWN PANEL OF HIS DATA IN THE SHAPE OF THE REGISTRATION (PDL, „Profil: forma „Podaci" po
 * obliku forme za prijavu", owner, 06.11.2026: „Na podacima struktura forme treba da bude kao na formularu
 * za prijavu, dakle ne sve jedno ispod drugog.").
 *
 * <p>jsdom lays nothing out, so where the rows land is asked of Chrome (`geometry/dataCard.geometry.ts`,
 * `geometry/myData.geometry.ts`). What is asked here is what the registration's shape is made of and what
 * a reader can be told of it: <b>the registration's groups, in its order, with the fields in its order
 * inside them</b>, on both pages the panel stands on, and <b>what the panel did before it took that shape
 * and still does</b>: the button that waits while nothing differs, and the sentence that goes when
 * anything moves.
 *
 * <p>And <b>the administration's form on the same card is not moved by any of it</b>: the props the
 * member's panel hands the renderer are its own (`onChange`, `fixedSaidBy`, a held button), and the other
 * reader of the card is asked that his form is the one it was.
 *
 * <p>Every wait is given half of the time a case has (`btl/CLAUDE.md`, section 25).
 */
configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function stands<T extends { stop: () => void }>(server: T): T {
  stops.push(server.stop)

  return server
}

const HIS_CARD = '/sr/takmicar/000001/podaci'
const HIS_PAGE = '/sr/moji-podaci'
const SENTENCE = sr.account.heldNote

type Role = 'textbox' | 'combobox' | 'radiogroup'

/** The groups of the registration this panel draws, each with its fields in order and how each is drawn. */
const THE_REGISTRATIONS_SHAPE: [string, [string, Role][]][] = [
  [
    sr.registration.group.basics,
    [
      ['Ime', 'textbox'],
      ['Prezime', 'textbox'],
      ['Ime oca', 'textbox'],
      ['Pol', 'radiogroup'],
      ['Datum rođenja', 'textbox'],
      ['Broj ličnog dokumenta', 'textbox'],
    ],
  ],
  [
    sr.registration.group.contact,
    [
      ['Adresa za slanje', 'textbox'],
      ['Telefon', 'textbox'],
      ['Mesto', 'combobox'],
    ],
  ],
  [sr.registration.group.competing, [['Veličina majice', 'combobox']]],
]

async function thePanel(): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { level: 2, name: sr.account.personalTitle })

  return must(heading.closest('section'), 'the panel')
}

/** Whether `later` stands after `earlier` in the document and is not inside it. */
function after(earlier: HTMLElement, later: HTMLElement): boolean {
  return (
    !earlier.contains(later) &&
    (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  )
}

/**
 * THE REGISTRATION'S SHAPE, ASKED OF THE PANEL: exactly its groups, in its order, each holding exactly
 * its fields, in its order. Every name is found by its role and its words (a field that may be left empty
 * says so after its name), and nothing else of the kinds asked is in a group but
 * the country a town carries beside it.
 */
function expectTheRegistrationsShape(panel: HTMLElement): void {
  /* The regions of the list of countries are groups as well, of the options inside one control, and not
     groups of the form's fields. */
  const groups = within(panel)
    .getAllByRole('group')
    .filter((one) => one.closest('select') === null)

  expect(groups.map((one) => one.tagName), 'every group of fields the panel draws is a fieldset').toEqual(
    THE_REGISTRATIONS_SHAPE.map(() => 'FIELDSET'),
  )

  THE_REGISTRATIONS_SHAPE.forEach(([groupName, fields], at) => {
    const group = must(groups[at], `the group ${groupName}`)

    expect(within(panel).getByRole('group', { name: groupName }), groupName).toBe(group)

    const drawn = fields.map(([name, role]) =>
      within(group).getByRole(role, {
        /* Exactly the name, or the name and the word of a field that may be left empty, which jsdom joins
           to it without the space. */
        name: (said) => said === name || said.replace(/\s/g, '') === `${name}(${sr.form.optional})`.replace(/\s/g, ''),
      }),
    )

    drawn.slice(1).forEach((one, next) => {
      expect(after(must(drawn[next], 'the field before'), one), `${groupName}: ${fields[next + 1]?.[0]} comes after ${fields[next]?.[0]}`).toBe(true)
    })

    const every = (['textbox', 'combobox', 'radiogroup'] as const).flatMap((role) => within(group).queryAllByRole(role))
    const beside = within(group).queryAllByRole('combobox', { name: /^Država/ })

    expect(every.filter((one) => !drawn.includes(one) && !beside.includes(one)), `${groupName} holds nothing else`).toEqual([])
  })
}

const writes = (asked: Asked[]) =>
  asked.filter((one) => one.path === '/api/me' && one.init?.method === 'PUT').map((one) => JSON.parse(String(one.init?.body)))

describe('the panel of a member whose fee stands, on his card „Podaci"', () => {
  it('is the registration’s groups in the registration’s order, with its fields in its order', async () => {
    renderAt(HIS_CARD, 'competitor', '000001')

    expectTheRegistrationsShape(await thePanel())
  }, SLOW)

  /**
   * <p><b>The panel is a region named by its own heading</b>, which is the heading the form draws and not
   * one of the panel's: the two meet only by an id, so the panel names the form's heading by the form's
   * own name for it.
   */
  it('is a region a screen reader can be taken to, named „Lični podaci"', async () => {
    renderAt(HIS_CARD, 'competitor', '000001')

    const panel = await thePanel()

    expect(screen.getByRole('region', { name: sr.account.personalTitle })).toBe(panel)
  }, SLOW)

  it('says who changes the held four before the first of them, and nothing about the address of post', async () => {
    renderAt(HIS_CARD, 'competitor', '000001')

    const panel = await thePanel()
    const sentence = within(panel).getByText(SENTENCE)
    const first = within(panel).getByRole('textbox', { name: /^Ime oca/ })

    expect(sentence.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sentence.contains(first)).toBe(false)
    expect(within(panel).queryByRole('textbox', { name: /Adresa elektronske pošte/ })).toBeNull()
  }, SLOW)

  /**
   * <p><b>Held again when what was typed is taken back</b>, which is the other state of „changed": the
   * button reads what is on the screen against what the server holds, not whether anybody typed.
   */
  it('holds the button until something differs, and again when the change is taken back', async () => {
    const user = setupUser()
    const asked = stands(serverThat(() => null)).asked

    renderAt(HIS_CARD, 'competitor', '000001')

    const panel = await thePanel()
    const save = within(panel).getByRole('button', { name: sr.account.save })
    const phone = within(panel).getByRole('textbox', { name: /^Telefon/ })
    const was = phone instanceof HTMLInputElement ? phone.value : ''

    expect(save).toHaveAttribute('aria-disabled', 'true')

    await user.type(phone, '9')

    expect(save).not.toHaveAttribute('aria-disabled')

    await user.type(phone, '{Backspace}')

    expect(phone).toHaveValue(was)
    expect(save).toHaveAttribute('aria-disabled', 'true')

    await user.click(save)

    expect(writes(asked)).toEqual([])
  }, SLOW)

  /**
   * <p><b>A box the server will not take empty is refused before it travels</b>, the way the registration
   * refuses it: beside the box, with the cursor on it, and nothing sent. Before the panel took the
   * registration's shape it went to the server and came back as a sentence under the form.
   */
  it('refuses an emptied name beside its box and sends nothing', async () => {
    const user = setupUser()
    const asked = stands(serverThat(() => null)).asked

    renderAt(HIS_CARD, 'competitor', '000001')

    const panel = await thePanel()
    const surname = within(panel).getByRole('textbox', { name: /^Prezime/ })

    await user.clear(surname)
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    await waitFor(() => expect(surname).toHaveFocus())
    expect(surname).toHaveAttribute('aria-invalid', 'true')
    expect(writes(asked)).toEqual([])
  }, SLOW)

  it('takes back what the server refused the moment a box is edited again', async () => {
    const user = setupUser()

    stands(serverThat((path, init) => (path === '/api/me' && init?.method === 'PUT' ? refused('aFieldIsTooLong') : null)))
    renderAt(HIS_CARD, 'competitor', '000001')

    const panel = await thePanel()
    const phone = within(panel).getByRole('textbox', { name: /^Telefon/ })

    await user.type(phone, '1')
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    expect(await within(panel).findByText(sr.account.fieldIsTooLong)).toBeVisible()

    await user.type(phone, '2')

    expect(within(panel).queryByText(sr.account.fieldIsTooLong)).toBeNull()
  }, SLOW)

  /** <p>And the value that travels is the one typed, laid over nothing the server held. */
  it('sends what was typed, and not what stood in the box', async () => {
    const user = setupUser()
    const asked = stands(
      serverThat((path, init) => (path === '/api/me' && init?.method === 'PUT' ? answeredWith(200) : null)),
    ).asked

    renderAt(HIS_CARD, 'competitor', '000001')

    const panel = await thePanel()
    const name = within(panel).getByRole('textbox', { name: /^Ime$/ })

    await user.clear(name)
    await user.type(name, 'Drugo Ime')
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    expect(await within(panel).findByText(sr.account.saved)).toBeVisible()
    expect(writes(asked)).toEqual([{ firstName: 'Drugo Ime' }])
  }, SLOW)
})

describe('the page „Moji podaci" of somebody who has not paid', () => {
  it('is the same shape as his card', async () => {
    stands(neverPaidAsServed())
    renderAt(HIS_PAGE, 'visitor', null)

    expectTheRegistrationsShape(await thePanel())
  }, SLOW)

  it('holds the button until something differs', async () => {
    const user = setupUser()

    stands(neverPaidAsServed())
    renderAt(HIS_PAGE, 'visitor', null)

    const panel = await thePanel()
    const save = within(panel).getByRole('button', { name: sr.account.save })

    expect(save).toHaveAttribute('aria-disabled', 'true')

    await user.type(within(panel).getByRole('textbox', { name: /^Telefon/ }), '065')

    expect(save).not.toHaveAttribute('aria-disabled')
  }, SLOW)
})

describe('the administration’s form on the same card', () => {
  it('is not held while nothing differs, says nothing of the held four, and describes no box by it', async () => {
    stands(
      serverThat((path) =>
        path === '/api/members/000001/data'
          ? new Response(
              JSON.stringify({
                memberNumber: '000001',
                firstName: 'Vladan',
                lastName: 'Đurišić',
                fatherName: 'Petar',
                gender: 'M',
                birthDate: '1980-04-02',
                idNumber: 'AB12345',
                email: 'vladan@primer.rs',
                emailConfirmed: false,
                address: 'Bulevar 1',
                phone: '060111222',
                placeId: null,
                city: 'Beograd',
                country: 'RS',
                shirtSize: 'L',
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          : null,
      ),
    )
    renderAt(HIS_CARD, 'moderator', null, moderatorWith([OVER_THE_MEMBERS]))

    const form = await screen.findByRole('form', { name: sr.account.personalTitle })

    expect(within(form).getByRole('button', { name: sr.account.save })).not.toHaveAttribute('aria-disabled')
    expect(within(form).queryByText(SENTENCE)).toBeNull()

    for (const box of within(form).getAllByRole('textbox')) {
      expect(box.getAttribute('aria-describedby') ?? '', box.id).not.toContain('account-held-note')
      expect(box, box.id).not.toHaveAttribute('readonly')
    }
  }, SLOW)

  /**
   * <p><b>The decision of 06.11.2026 reaches the administration's held e-mail too</b> (PDL, "Isto pravilo
   * važi i za zaključanu e-poštu u administraciji": the held field carries no star). The e-mail of a member
   * who has confirmed it is held without the star and without `aria-required`, and every free required box
   * beside it keeps the star it has always had.
   */
  it('holds the confirmed e-mail without the star and keeps the star on every free required box beside it', async () => {
    stands(
      serverThat((path) =>
        path === '/api/members/000001/data'
          ? new Response(
              JSON.stringify({
                memberNumber: '000001',
                firstName: 'Vladan',
                lastName: 'Đurišić',
                fatherName: 'Petar',
                gender: 'M',
                birthDate: '1980-04-02',
                idNumber: 'AB12345',
                email: 'vladan@primer.rs',
                emailConfirmed: true,
                address: 'Bulevar 1',
                phone: '060111222',
                placeId: null,
                city: 'Beograd',
                country: 'RS',
                shirtSize: 'L',
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          : null,
      ),
    )
    renderAt(HIS_CARD, 'moderator', null, moderatorWith([OVER_THE_MEMBERS]))

    const form = await screen.findByRole('form', { name: sr.account.personalTitle })
    const email = within(form).getByRole('textbox', { name: new RegExp(`^${sr.registration.email}`) })

    expect(email).toHaveAttribute('aria-disabled', 'true')
    expect(email).not.toHaveAttribute('aria-required')
    expect(within(must(email.closest<HTMLElement>('.field'), 'the field of the e-mail')).queryByText('*')).toBeNull()

    const firstName = within(form).getByRole('textbox', { name: new RegExp(`^${sr.registration.firstName}`) })

    expect(firstName).toHaveAttribute('aria-required', 'true')
    expect(within(must(firstName.closest<HTMLElement>('.field'), 'the field of the first name')).getByText('*')).toBeVisible()
  }, SLOW)
})
