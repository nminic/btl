import { configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { moderatorWith, renderAt } from '../../test/render'
import { membersAsServed, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { OVER_THE_MEMBERS } from './whoReadsTheData'

/**
 * THE CARD „PODACI" (owner, 22.10.2026, PDL „Profil dobija karticu „Podaci", posle „Pregled" i „Priznanja
 * i nagrade", koju vidi samo sam član i administracija"; „Tuđe podatke otvara i menja samo moderator sa
 * pravom nad članovima, i admin").
 *
 * <p><b>Every reader there is, and each one twice</b>: whether the head of the profile offers him the tab,
 * and what the card's own address does when he opens it. The two are asked of one home
 * (`whoReadsTheData.ts`), and these cases hold them to each other from the outside, so a tab offered to a
 * reader the card turns away, or the other way round, is a red case.
 *
 * <p><b>The member read and the member asking are never the same row</b> unless the case is about his
 * own card: 000007 reads 000001's card as somebody else, and the administration corrects 000001, not the
 * member the session would name.
 */

/* Every wait of this file is given half of the time a case has, so a wait that never succeeds ends the
   case with the assertion's own words and not with the case's clock (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

const HIS = '000007'
const SOMEBODY = '000001'
const LAPSED = '000032'

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** What `GET /api/members/{memberNumber}/data` answers, for a member of the sample. */
function dataOf(memberNumber: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    memberNumber,
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
    ...over,
  }
}

/**
 * A SERVER OF THE ADMINISTRATION'S DATA, which answers a read of `memberNumber` and a correction of it,
 * and what the correction is answered with is what was sent laid over what stood.
 */
function theAdministrationsServer(
  memberNumber: string,
  over: Record<string, unknown> = {},
  answerTheCorrection: (body: Record<string, unknown>) => Response | null = () => null,
): Asked[] {
  let held = dataOf(memberNumber, over)
  const { asked, stop } = serverThat((path, init) => {
    if (path !== `/api/members/${memberNumber}/data`) {
      return null
    }

    if (init?.method === 'PUT') {
      const body: Record<string, unknown> = JSON.parse(String(init.body))
      const instead = answerTheCorrection(body)

      if (instead !== null) {
        return instead
      }

      held = { ...held, ...body }

      return json(held)
    }

    return json(held)
  })

  stops.push(stop)

  return asked
}

const corrections = (asked: Asked[]) =>
  asked.filter((one) => one.init?.method === 'PUT').map((one) => JSON.parse(String(one.init?.body)))

async function theDataTab(): Promise<HTMLElement | null> {
  const parts = await screen.findByRole('navigation', { name: sr.profile.parts.label })

  return within(parts).queryByRole('link', { name: sr.profile.parts.data })
}

async function sentHome(router: { state: { location: { pathname: string } } }): Promise<void> {
  await waitFor(() => expect(router.state.location.pathname).toBe('/sr'))
}

describe('who is offered the tab, and who the card turns away', () => {
  it('offers a member his own card and opens it at his profile’s own address', async () => {
    const { router } = renderAt(`/sr/takmicar/${HIS}/podaci`, 'competitor', HIS)

    expect(await screen.findByRole('heading', { level: 2, name: sr.account.personalTitle })).toBeVisible()
    await waitFor(() => expect(router.state.location.pathname).toMatch(new RegExp(`^/sr/takmicar/${HIS}-.+/podaci$`)))

    const tab = must(await theDataTab(), 'the tab of his own card')

    expect(tab).toHaveAttribute('aria-current', 'page')
    expect(tab.getAttribute('href')).toBe(router.state.location.pathname)
  }, SLOW)

  it('does not offer a member the card of somebody else, and the address of it sends him home', async () => {
    renderAt(`/sr/takmicar/${SOMEBODY}`, 'competitor', HIS)

    expect(await theDataTab()).toBeNull()

    const { router } = renderAt(`/sr/takmicar/${SOMEBODY}/podaci`, 'competitor', HIS)

    await sentHome(router)
  }, SLOW)

  it('does not offer a visitor any card, and the address of one sends him home', async () => {
    renderAt(`/sr/takmicar/${SOMEBODY}`)

    expect(await theDataTab()).toBeNull()

    const { router } = renderAt(`/sr/takmicar/${SOMEBODY}/podaci`)

    await sentHome(router)
  }, SLOW)

  it('sends a member whose fee has lapsed home from his own card, which his route answers 404', async () => {
    const { router } = renderAt(`/sr/takmicar/${LAPSED}/podaci`, 'competitor', LAPSED)

    await sentHome(router)
  }, SLOW)

  it('does not offer a moderator without the right over the members the card, and its address sends him home', async () => {
    const without = moderatorWith(['queue:results'])

    renderAt(`/sr/takmicar/${SOMEBODY}`, 'moderator', null, without)

    expect(await theDataTab()).toBeNull()

    const { router } = renderAt(`/sr/takmicar/${SOMEBODY}/podaci`, 'moderator', null, without)

    await sentHome(router)
  }, SLOW)

  it.each([
    ['a moderator with the right over the members', 'moderator' as const],
    ['the superadmin', 'superadmin' as const],
  ])('offers %s the card of a member, and opens the registration’s form on it', async (_who, role) => {
    theAdministrationsServer(SOMEBODY)

    renderAt(`/sr/takmicar/${SOMEBODY}`, role, null, moderatorWith([OVER_THE_MEMBERS]))

    expect(await theDataTab()).not.toBeNull()

    renderAt(`/sr/takmicar/${SOMEBODY}/podaci`, role, null, moderatorWith([OVER_THE_MEMBERS]))

    expect(await screen.findByRole('textbox', { name: /Ime oca/ })).toHaveValue('Petar')
  }, SLOW)
})

describe('the card the administration opens', () => {
  const asTheAdministration = (memberNumber = SOMEBODY) =>
    renderAt(`/sr/takmicar/${memberNumber}/podaci`, 'moderator', null, moderatorWith([OVER_THE_MEMBERS]))

  it('is the registration’s form without the password, the health, the parent and the category', async () => {
    theAdministrationsServer(SOMEBODY)
    asTheAdministration()

    const form = await screen.findByRole('form', { name: sr.account.personalTitle })

    expect(within(form).getByRole('textbox', { name: /^Ime(?! oca)/ })).toHaveValue('Vladan')
    expect(within(form).getByRole('textbox', { name: /Ime oca/ })).toHaveValue('Petar')
    expect(within(form).getByRole('textbox', { name: /Broj ličnog dokumenta/ })).toHaveValue('AB12345')
    expect(within(form).getByRole('textbox', { name: /Adresa elektronske pošte/ })).toHaveValue('vladan@primer.rs')
    expect(within(form).getByRole('radio', { name: sr.registration.genderMale })).toBeChecked()

    for (const left of [/Lozinka/, /Ponovi lozinku/, /zdravstveno/, /roditelj/i, sr.registration.categoryFirstSeason]) {
      expect(within(form).queryByLabelText(left), String(left)).toBeNull()
    }
  }, SLOW)

  it('sends only what moved, to the member the address names, and says it was kept', async () => {
    const user = setupUser()
    const asked = theAdministrationsServer(SOMEBODY)

    asTheAdministration()

    const fatherName = await screen.findByRole('textbox', { name: /Ime oca/ })

    await user.clear(fatherName)
    await user.type(fatherName, 'Jovan')
    await user.click(screen.getByRole('button', { name: sr.account.save }))

    expect(await screen.findByText(sr.account.saved)).toBeVisible()
    expect(corrections(asked)).toEqual([{ fatherName: 'Jovan' }])
    expect(asked.filter((one) => one.init?.method === 'PUT').map((one) => one.path)).toEqual([
      `/api/members/${SOMEBODY}/data`,
    ])
  }, SLOW)

  it('says nothing changed, and sends nothing, when the form is saved as it was opened', async () => {
    const user = setupUser()
    const asked = theAdministrationsServer(SOMEBODY)

    asTheAdministration()

    await screen.findByRole('textbox', { name: /Ime oca/ })
    await user.click(screen.getByRole('button', { name: sr.account.save }))

    expect(await screen.findByText(sr.memberData.nothingChanged)).toBeVisible()
    expect(corrections(asked)).toEqual([])
  }, SLOW)

  it('compares the next save with what the server answered, so a second save of the same sends nothing', async () => {
    const user = setupUser()
    const asked = theAdministrationsServer(SOMEBODY)

    asTheAdministration()

    const fatherName = await screen.findByRole('textbox', { name: /Ime oca/ })

    await user.clear(fatherName)
    await user.type(fatherName, 'Jovan')
    await user.click(screen.getByRole('button', { name: sr.account.save }))
    await screen.findByText(sr.account.saved)
    await user.click(screen.getByRole('button', { name: sr.account.save }))

    expect(await screen.findByText(sr.memberData.nothingChanged)).toBeVisible()
    expect(corrections(asked)).toHaveLength(1)
  }, SLOW)

  it('says the server’s reason in its own sentence, and not that anything was kept', async () => {
    const user = setupUser()

    theAdministrationsServer(SOMEBODY, {}, () => refused('aPairHoldsTheGender', 409))
    asTheAdministration()

    await user.click(await screen.findByRole('radio', { name: sr.registration.genderFemale }))
    await user.click(screen.getByRole('button', { name: sr.account.save }))

    expect(await screen.findByText(sr.memberData.aPairHoldsTheGender)).toBeVisible()
    expect(screen.queryByText(sr.account.saved)).toBeNull()
  }, SLOW)

  it('says the number of an answer that says done and cannot be read, and not that it was kept', async () => {
    const user = setupUser()

    theAdministrationsServer(SOMEBODY, {}, () => json({ nothing: 'here' }))
    asTheAdministration()

    const fatherName = await screen.findByRole('textbox', { name: /Ime oca/ })

    await user.clear(fatherName)
    await user.type(fatherName, 'Jovan')
    await user.click(screen.getByRole('button', { name: sr.account.save }))

    expect(await screen.findByText(/200/)).toBeVisible()
    expect(screen.queryByText(sr.account.saved)).toBeNull()
  }, SLOW)

  it('holds the address of post where it is confirmed, and draws no box for it where there is no account', async () => {
    theAdministrationsServer(SOMEBODY, { emailConfirmed: true })
    asTheAdministration()

    const email = await screen.findByRole('textbox', { name: /Adresa elektronske pošte/ })

    expect(email).toHaveAttribute('readonly')
  }, SLOW)

  it('draws no box for the address of post for a member with no account', async () => {
    const user = setupUser()
    const asked = theAdministrationsServer(SOMEBODY, { email: null, emailConfirmed: null })

    asTheAdministration()

    await screen.findByRole('textbox', { name: /Ime oca/ })
    expect(screen.queryByRole('textbox', { name: /Adresa elektronske pošte/ })).toBeNull()

    /* And a save with the box absent sends no address at all. */
    const fatherName = screen.getByRole('textbox', { name: /Ime oca/ })

    await user.clear(fatherName)
    await user.type(fatherName, 'Jovan')
    await user.click(screen.getByRole('button', { name: sr.account.save }))
    await screen.findByText(sr.account.saved)

    expect(corrections(asked)).toEqual([{ fatherName: 'Jovan' }])
  }, SLOW)

  it('opens the card of a member the public list does not carry, under a heading of its own', async () => {
    /* The list as the server serves it: every member whose fee stands, and 000032 is not one. */
    stops.push(membersAsServed().stop)
    theAdministrationsServer(LAPSED, { firstName: 'Vojislav', fatherName: 'Milan' })
    asTheAdministration(LAPSED)

    expect(await screen.findByRole('heading', { level: 1, name: sr.profile.parts.data })).toBeVisible()
    expect(await screen.findByRole('textbox', { name: /Ime oca/ })).toHaveValue('Milan')
  }, SLOW)

  it('says the card could not be read when the server will not give it', async () => {
    const { stop } = serverThat((path) => (path === `/api/members/${SOMEBODY}/data` ? json({}, 404) : null))

    stops.push(stop)
    asTheAdministration()

    expect(await screen.findByRole('button', { name: /Pokušaj ponovo/ })).toBeVisible()
  }, SLOW)
})

describe('his own card', () => {
  it('sends a new town together with its country, and a new size alone', async () => {
    const user = setupUser()
    const { asked, stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT' ? json({}) : null,
    )

    stops.push(stop)
    renderAt(`/sr/takmicar/${HIS}/podaci`, 'competitor', HIS)

    const size = await screen.findByRole('combobox', { name: new RegExp(sr.registration.shirtSize) })

    await user.selectOptions(size, 'XXL')
    await user.click(screen.getByRole('button', { name: sr.account.save }))
    await screen.findByText(sr.account.saved)

    const town = screen.getByRole('combobox', { name: new RegExp(`^${sr.registration.city}`) })

    await user.clear(town)
    await user.type(town, 'Novi Grad')
    await user.click(screen.getByRole('button', { name: sr.account.save }))
    await screen.findByText(sr.account.saved)

    expect(
      asked.filter((one) => one.path === '/api/me' && one.init?.method === 'PUT').map((one) => JSON.parse(String(one.init?.body))),
    ).toEqual([{ shirtSize: 'XXL' }, { city: 'Novi Grad', country: expect.any(String) }])
  }, SLOW)
})
