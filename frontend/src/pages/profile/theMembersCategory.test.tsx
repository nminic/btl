import { configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import sr from '../../i18n/sr.json'
import { moderatorWith, renderAt } from '../../test/render'
import { answeringCategory, refused, serverThat, type Asked, type CategoryAnswered } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { OVER_THE_MEMBERS } from './whoReadsTheData'

/**
 * THE ADMINISTRATION CHOOSES A MEMBER'S CATEGORY ON HIS CARD „PODACI" (`TheMembersCategory.tsx`).
 *
 * <p>Owner, 24.11.2026 (PDL, „Administracija bira kategoriju članu u njegovim podacima, a u prijavi je
 * starosna podrazumevana"), and the rule derived beside it: the same rules as the member's own box on „Moja
 * članarina". Held here: the box reads and writes the member's address and never the reader's own
 * (`/api/me/category`), it holds the beginners' option where the server says it is closed to him and says
 * why, both options once the deadline has passed, and every answer that is not „done" is said.
 */

/* Half of a case's clock for every wait (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

const SOMEBODY = '000001'

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

const AGE_BAND: CategoryAnswered = { season: 2027, firstSeason: false, firstSeasonAllowed: true, category: 'M40-54', open: true }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const data = {
  memberNumber: SOMEBODY,
  firstName: 'Vladan',
  lastName: 'Đurišić',
  fatherName: 'Petar',
  gender: 'M',
  birthDate: '1980-04-02',
  idNumber: 'AB12345',
  email: 'vladan@primer.rs',
  emailConfirmed: false,
  viberCommunity: false,
  address: 'Bulevar 1',
  phone: '060111222',
  placeId: null,
  city: 'Beograd',
  country: 'RS',
  shirtSize: 'L',
}

/**
 * The administration's server for one member: his data, and his category as given. A write is answered
 * with what is then held, the way `MemberCategoryApi` answers, unless `written` says otherwise.
 */
function theServer(standing: CategoryAnswered, written?: () => Response): Asked[] {
  let held = standing
  const { asked, stop } = serverThat((path, init) => {
    if (path === `/api/members/${SOMEBODY}/data`) {
      return json(data)
    }

    if (path === '/api/me/category') {
      /* The reader's OWN category, a different answer, so a box that read it would show it. */
      return answeringCategory({ ...standing, firstSeason: true, category: 'M R' })
    }

    if (path !== `/api/members/${SOMEBODY}/category`) {
      return null
    }

    if (init?.method === 'PUT') {
      if (written !== undefined) {
        return written()
      }

      const body: { firstSeason: boolean } = JSON.parse(String(init.body))

      held = { ...held, firstSeason: body.firstSeason, category: body.firstSeason && held.firstSeasonAllowed ? 'M R' : 'M40-54' }

      return answeringCategory(held)
    }

    return answeringCategory(held)
  })

  stops.push(stop)

  return asked
}

const asTheAdministration = () =>
  renderAt(`/sr/takmicar/${SOMEBODY}/podaci`, 'moderator', null, moderatorWith([OVER_THE_MEMBERS]))

const theBox = async () =>
  screen.findByRole('group', { name: sr.memberData.categoryFor.replace('{season}', '2027') })

describe('the choice of a member’s category on his card', () => {
  it('opens on what the server holds for him and writes his choice to his address, not the reader’s', async () => {
    const asked = theServer(AGE_BAND)
    const user = setupUser()

    asTheAdministration()

    const box = await theBox()
    const age = within(box).getByRole('radio', { name: sr.registration.categoryByAge })
    const beginners = within(box).getByRole('radio', { name: sr.registration.categoryFirstSeason })

    expect(age).toBeChecked()
    expect(beginners).not.toBeChecked()
    expect(within(box).queryByText(/nije dostupna/)).toBeNull()

    await user.click(beginners)

    await waitFor(() => expect(beginners).toBeChecked())

    const writes = asked.filter((one) => one.init?.method === 'PUT')

    expect(writes.map((one) => [one.path, String(one.init?.body)])).toEqual([
      [`/api/members/${SOMEBODY}/category`, '{"firstSeason":true}'],
    ])
    expect(asked.some((one) => one.path === '/api/me/category')).toBe(false)
    expect(within(box).getByText(/član se takmiči u kategoriji/)).toHaveTextContent(sr.category.rookieMale)

    /* And back, in the other direction (PDL P7, 18.10.2026, „u oba smera"). */
    await user.click(age)

    await waitFor(() => expect(age).toBeChecked())
    expect(asked.filter((one) => one.init?.method === 'PUT').map((one) => String(one.init?.body))).toEqual([
      '{"firstSeason":true}',
      '{"firstSeason":false}',
    ])
    expect(within(box).getByText(/član se takmiči u kategoriji/)).not.toHaveTextContent(sr.category.rookieMale)
  }, SLOW)

  it('holds the beginners’ option for a member it is closed to, and says why', async () => {
    theServer({ ...AGE_BAND, firstSeasonAllowed: false })

    asTheAdministration()

    const box = await theBox()

    expect(within(box).getByRole('radio', { name: sr.registration.categoryFirstSeason })).toBeDisabled()
    expect(within(box).getByRole('radio', { name: sr.registration.categoryByAge })).toBeEnabled()
    expect(within(box).getByText(sr.memberData.categoryClosed.replace('{points}', '12'))).toBeVisible()
  }, SLOW)

  /* THE RADIO STANDS ON THE WISH, NOT ON THE CATEGORY IT TURNS INTO (PDL P7, 26.09.2026, „Ono što se čuva je
     ŽELJA, ne kategorija"), as on his own page: a beginner's wish with no right behind it stays ticked, and the
     sentence under it says the age band he runs in. */
  it('keeps the beginners’ option ticked for a wish the right no longer stands behind', async () => {
    theServer({ ...AGE_BAND, firstSeason: true, firstSeasonAllowed: false, category: 'M40-54' })

    asTheAdministration()

    const box = await theBox()
    const beginners = within(box).getByRole('radio', { name: sr.registration.categoryFirstSeason })

    expect(beginners).toBeChecked()
    expect(beginners).toBeDisabled()
    expect(within(box).getByRole('radio', { name: sr.registration.categoryByAge })).not.toBeChecked()
    expect(within(box).getByText(/član se takmiči u kategoriji/)).not.toHaveTextContent(sr.category.rookieMale)
  }, SLOW)

  it('holds both once the deadline has passed', async () => {
    theServer({ ...AGE_BAND, open: false })

    asTheAdministration()

    const box = await theBox()

    expect(within(box).getByRole('radio', { name: sr.registration.categoryFirstSeason })).toBeDisabled()
    expect(within(box).getByRole('radio', { name: sr.registration.categoryByAge })).toBeDisabled()
  }, SLOW)

  it('says the deadline when the server refuses for it, and the error of the server when it fails', async () => {
    theServer(AGE_BAND, () => refused('theChoiceIsShut', 409))
    const user = setupUser()

    asTheAdministration()

    const box = await theBox()

    await user.click(within(box).getByRole('radio', { name: sr.registration.categoryFirstSeason }))

    expect(await within(box).findByText(sr.membership.choiceRefused)).toBeVisible()
    expect(within(box).getByRole('radio', { name: sr.registration.categoryByAge })).toBeChecked()

    stops.pop()?.()
    theServer(AGE_BAND, () => new Response(null, { status: 500 }))

    await user.click(within(box).getByRole('radio', { name: sr.registration.categoryFirstSeason }))

    await waitFor(() => expect(within(box).queryByText(sr.membership.choiceRefused)).toBeNull())
    expect(within(box).getByText(/500/)).toBeVisible()
  }, SLOW)
})
