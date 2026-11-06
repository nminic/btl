import { configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { moderatorWith, renderAt } from '../../test/render'
import { membersAsServed, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { OVER_THE_MEMBERS } from './whoReadsTheData'

/* Every wait of this file is given half of the time a case has, so a wait that never succeeds ends the
   case with the assertion's own words and not with the case's clock (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE ADMINISTRATION CHANGING A MEMBER'S PICTURE AND WORDS ON HIS CARD „PODACI".
 *
 * <p>Owner, 06.11.2026 (PDL „Boksovi „Profilna slika" i „Tekst o sebi" prelaze sa Podešavanja"):
 * „Administracija na tuđoj kartici Podaci sme i da menja članovu sliku i tekst o sebi", „Izmena
 * administracije stupa odmah na profil, bez reda za proveru".
 *
 * <p>The member whose card is read is NOT the first of the file and NOT the reader, so an address built
 * from the first member, or from the reader, is told from his.
 */

const HIS = '000004'
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

function aServerThatTakes(
  answer: (path: string) => Response | Promise<Response> | null = () => null,
): Asked[] {
  const { asked, stop } = serverThat((path, init) => {
    if (init?.method === 'PUT' && path === `/api/members/${HIS}/bio`) {
      return answer(path) ?? json({ bio: JSON.parse(String(init.body)).bio })
    }

    if (init?.method === 'POST' && path === `/api/members/${HIS}/photo`) {
      return answer(path) ?? json({ photo: '/api/photos/abc', crop: { x: 0.25, y: 0.75, size: 0.5 } })
    }

    return null
  })

  stops.push(stop)

  return asked
}

const writes = (asked: Asked[]) => asked.filter((one) => one.init?.method === 'PUT' || one.init?.method === 'POST')

function asTheAdministration(memberNumber = HIS) {
  return renderAt(`/sr/takmicar/${memberNumber}/podaci`, 'moderator', null, moderatorWith([OVER_THE_MEMBERS]))
}

describe('his words, changed by the administration', () => {
  it('open with what stands, are saved at once to his own address, and say so', async () => {
    const user = setupUser()
    const asked = aServerThatTakes()

    asTheAdministration()

    const panel = within(await screen.findByRole('region', { name: sr.bio.title }))
    const box = await panel.findByRole('textbox')
    const save = panel.getByRole('button', { name: sr.theirBoxes.wordsSave })

    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(panel.getByText(sr.theirBoxes.atOnce)).toBeVisible()

    await user.click(save)
    expect(writes(asked)).toHaveLength(0)

    await user.clear(box)
    await user.type(box, '  Tekst koji je napisala administracija.  ')
    await user.click(save)

    expect(await panel.findByText(sr.theirBoxes.saved)).toHaveAttribute('role', 'status')
    expect(writes(asked).map((one) => [one.path, one.init?.method, JSON.parse(String(one.init?.body))])).toEqual([
      [`/api/members/${HIS}/bio`, 'PUT', { bio: 'Tekst koji je napisala administracija.' }],
    ])
    expect(save).toHaveAttribute('aria-disabled', 'true')
  }, SLOW)

  it('say what the server refused, in its own sentence', async () => {
    const user = setupUser()

    aServerThatTakes(() => json({ reason: 'theTextIsTooLong' }, 400))
    asTheAdministration()

    const panel = within(await screen.findByRole('region', { name: sr.bio.title }))

    await user.type(await panel.findByRole('textbox'), ' i još')
    await user.click(panel.getByRole('button', { name: sr.theirBoxes.wordsSave }))

    expect(await panel.findByText(sr.account.textIsTooLong)).toBeVisible()
    expect(panel.queryByText(sr.theirBoxes.saved)).toBeNull()
  }, SLOW)
})

describe('his picture, changed by the administration', () => {
  it('is saved at once to his own address once a new one is chosen, and says so', async () => {
    const user = setupUser()
    const asked = aServerThatTakes()

    asTheAdministration()

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))
    const save = panel.getByRole('button', { name: sr.theirBoxes.pictureSave })

    expect(save).toHaveAttribute('aria-disabled', 'true')

    await user.upload(
      await panel.findByLabelText(sr.picture.choose),
      new File(['slika'], 'nova.jpg', { type: 'image/jpeg' }),
    )
    await measurePicture()
    await panel.findByLabelText('Veličina isečka')
    await user.click(save)

    expect(await panel.findByText(sr.theirBoxes.saved)).toHaveAttribute('role', 'status')

    const [sent] = writes(asked)

    expect(writes(asked)).toHaveLength(1)
    expect(must(sent, 'the write').path).toBe(`/api/members/${HIS}/photo`)

    const body = must(sent, 'the write').init?.body

    expect(body).toBeInstanceOf(FormData)
    expect(body instanceof FormData ? body.get('picture') : null).toBeInstanceOf(File)
    await waitFor(() => expect(save).toHaveAttribute('aria-disabled', 'true'))
  }, SLOW)

  it('says what the server refused, in its own sentence', async () => {
    const user = setupUser()

    aServerThatTakes(() => json({ reason: 'thisIsNotAPicture' }, 400))
    asTheAdministration()

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))

    await user.upload(
      await panel.findByLabelText(sr.picture.choose),
      new File(['slika'], 'nova.jpg', { type: 'image/jpeg' }),
    )
    await measurePicture()
    await panel.findByLabelText('Veličina isečka')
    await user.click(panel.getByRole('button', { name: sr.theirBoxes.pictureSave }))

    expect(await panel.findByText(sr.picture.sendRefused.thisIsNotAPicture)).toBeVisible()
  }, SLOW)

  it('carries no mark beside „Izaberi novu sliku"', async () => {
    asTheAdministration()

    const chooser = await screen.findByLabelText(sr.picture.choose)

    expect(must(chooser.closest('.rankings__field'), 'the field of the chooser').textContent).toBe(sr.picture.choose)
  }, SLOW)
})

describe('what each box opens with, and a press that cannot send', () => {
  it('says whether a picture stands, for a member who has one and one who has none', async () => {
    asTheAdministration('000003')

    expect(
      await within(await screen.findByRole('region', { name: sr.picture.title })).findByText(sr.theirBoxes.pictureStanding),
    ).toBeVisible()
  }, SLOW)

  it('says there is none where none stands', async () => {
    asTheAdministration()

    expect(
      await within(await screen.findByRole('region', { name: sr.picture.title })).findByText(sr.theirBoxes.pictureNone),
    ).toBeVisible()
  }, SLOW)

  it('opens his words empty where the list withholds them', async () => {
    const disc = globalThis.fetch
    const { stop } = serverThat((path, init) =>
      path === '/api/competitors' && init?.method === undefined
        ? disc(path, init).then(async (answer) => {
            const rows: Record<string, unknown>[] = await answer.json()

            return json(rows.map((one) => (one.memberNumber === HIS ? { ...one, bio: null } : one)))
          })
        : null,
    )

    stops.push(stop)
    asTheAdministration()

    const panel = within(await screen.findByRole('region', { name: sr.bio.title }))

    expect(await panel.findByRole('textbox')).toHaveValue('')
  }, SLOW)

  it('sends nothing for a picture while none is chosen, and one request for two presses', async () => {
    const user = setupUser()
    let answer: (one: Response) => void = () => undefined
    const asked = aServerThatTakes(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    )

    asTheAdministration()

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))
    const save = panel.getByRole('button', { name: sr.theirBoxes.pictureSave })

    await user.click(save)
    expect(writes(asked)).toHaveLength(0)

    await user.upload(
      await panel.findByLabelText(sr.picture.choose),
      new File(['slika'], 'nova.jpg', { type: 'image/jpeg' }),
    )
    await measurePicture()
    await panel.findByLabelText('Veličina isečka')
    await user.click(save)
    await user.click(save)

    expect(writes(asked)).toHaveLength(1)

    answer(json({ photo: '/api/photos/abc', crop: { x: 0.25, y: 0.75, size: 0.5 } }))

    expect(await panel.findByText(sr.theirBoxes.saved)).toBeVisible()
    expect(panel.getByText(sr.theirBoxes.pictureStanding)).toBeVisible()
  }, SLOW)

  it('sends one request for two presses of the words', async () => {
    const user = setupUser()
    let answer: (one: Response) => void = () => undefined
    const asked = aServerThatTakes(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    )

    asTheAdministration()

    const panel = within(await screen.findByRole('region', { name: sr.bio.title }))
    const save = panel.getByRole('button', { name: sr.theirBoxes.wordsSave })

    await user.type(await panel.findByRole('textbox'), ' Još.')
    await user.click(save)
    await user.click(save)

    expect(writes(asked)).toHaveLength(1)

    answer(json({ bio: 'x' }))

    expect(await panel.findByText(sr.theirBoxes.saved)).toBeVisible()
  }, SLOW)
})

describe('his picture, taken down by the administration', () => {
  const HAS_ONE = '000003'

  it('is drawn in its circle, and taken down at once after the sheet asks', async () => {
    const user = setupUser()
    const { asked, stop } = serverThat((path, init) =>
      init?.method === 'DELETE' && path === `/api/members/${HAS_ONE}/photo` ? new Response(null, { status: 200 }) : null,
    )

    stops.push(stop)
    asTheAdministration(HAS_ONE)

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))

    expect(await panel.findByRole('img', { name: sr.theirBoxes.currentAlt })).toBeVisible()
    await user.click(panel.getByRole('button', { name: sr.theirBoxes.pictureRemove }))

    const sheet = await screen.findByRole('dialog', { name: sr.theirBoxes.pictureRemoveAsks })

    await user.click(within(sheet).getByRole('button', { name: sr.admin.form.delete }))

    expect(await panel.findByText(sr.theirBoxes.pictureNone)).toBeVisible()
    expect(panel.queryByRole('img', { name: sr.theirBoxes.currentAlt })).toBeNull()
    expect(panel.queryByRole('button', { name: sr.theirBoxes.pictureRemove })).toBeNull()
    expect(asked.filter((one) => one.init?.method === 'DELETE').map((one) => one.path)).toEqual([
      `/api/members/${HAS_ONE}/photo`,
    ])
  }, SLOW)

  it('stays where the server refused, and says so', async () => {
    const user = setupUser()
    const { stop } = serverThat((_path, init) =>
      init?.method === 'DELETE' ? new Response(null, { status: 404 }) : null,
    )

    stops.push(stop)
    asTheAdministration(HAS_ONE)

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))

    await user.click(await panel.findByRole('button', { name: sr.theirBoxes.pictureRemove }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: sr.admin.form.delete }))

    expect(await panel.findByRole('alert')).toBeVisible()
    expect(panel.getByRole('img', { name: sr.theirBoxes.currentAlt })).toBeVisible()
  }, SLOW)

  it('offers no way to take down what is not there', async () => {
    asTheAdministration()

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))

    await panel.findByText(sr.theirBoxes.pictureNone)
    expect(panel.queryByRole('button', { name: sr.theirBoxes.pictureRemove })).toBeNull()
  }, SLOW)
})

describe('a member the public list does not carry', () => {
  /** The administration's route for his data, with what stands on his profile. */
  function hisDataSays(answer: () => Response | Promise<Response>): Asked[] {
    const { asked, stop } = serverThat((path, init) => {
      if (path === `/api/members/${LAPSED}/data` && init?.method === undefined) {
        return answer()
      }

      if (init?.method === 'POST' && path === `/api/members/${LAPSED}/photo`) {
        return json({ photo: '/api/photos/new', crop: { x: 0.25, y: 0.75, size: 0.5 } })
      }

      if (init?.method === 'DELETE' && path === `/api/members/${LAPSED}/photo`) {
        return new Response(null, { status: 200 })
      }

      return null
    })

    stops.push(stop)

    return asked
  }

  const HIS_DATA = {
    memberNumber: LAPSED,
    firstName: 'Vojislav',
    lastName: 'Clan',
    fatherName: 'Milan',
    gender: 'M',
    birthDate: '1980-04-02',
    idNumber: 'AB12345',
    email: 'vojislav@primer.rs',
    emailConfirmed: true,
    address: 'Ulica 1',
    phone: null,
    placeId: null,
    city: 'Beograd',
    country: 'RS',
    shirtSize: 'L',
    bio: 'Njegove reči.',
    photo: '/api/photos/abc',
    crop: { x: 0.3, y: 0.7, size: 0.45 },
  }

  it('is drawn his picture and his words off his data, and they are changed and taken down at his own address', async () => {
    const user = setupUser()

    /* The list as the server serves it: every member whose fee stands, and 000032 is not one. */
    stops.push(membersAsServed().stop)

    const asked = hisDataSays(() => json(HIS_DATA))

    asTheAdministration(LAPSED)

    expect(await screen.findByRole('heading', { level: 1, name: sr.profile.parts.data })).toBeVisible()

    const picture = within(await screen.findByRole('region', { name: sr.picture.title }))
    const words = within(await screen.findByRole('region', { name: sr.bio.title }))

    expect(await picture.findByRole('img', { name: sr.theirBoxes.currentAlt })).toHaveAttribute('src', '/api/photos/abc')
    expect(await words.findByRole('textbox')).toHaveValue('Njegove reči.')

    await user.upload(
      await picture.findByLabelText(sr.picture.choose),
      new File(['slika'], 'nova.jpg', { type: 'image/jpeg' }),
    )
    await measurePicture()
    await picture.findByLabelText('Veličina isečka')
    await user.click(picture.getByRole('button', { name: sr.theirBoxes.pictureSave }))
    expect(await picture.findByText(sr.theirBoxes.saved)).toBeVisible()

    await user.click(picture.getByRole('button', { name: sr.theirBoxes.pictureRemove }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: sr.admin.form.delete }))
    expect(await picture.findByText(sr.theirBoxes.pictureNone)).toBeVisible()

    expect(writes(asked).map((one) => one.path)).toEqual([`/api/members/${LAPSED}/photo`])
    expect(asked.filter((one) => one.init?.method === 'DELETE').map((one) => one.path)).toEqual([
      `/api/members/${LAPSED}/photo`,
    ])
  }, SLOW)

  it.each([
    ['a refusal', () => new Response(null, { status: 500 })],
    ['no server to reach', () => Promise.reject(new TypeError('Failed to fetch'))],
  ] as const)('says what stands could not be read, on %s', async (_what, answer) => {
    stops.push(membersAsServed().stop)
    hisDataSays(answer)
    asTheAdministration(LAPSED)

    expect(await screen.findByRole('heading', { level: 1, name: sr.profile.parts.data })).toBeVisible()
    await waitFor(() => expect(screen.getAllByRole('button', { name: sr.data.retry }).length).toBeGreaterThan(0))
    expect(screen.queryByRole('region', { name: sr.picture.title })).toBeNull()
  }, SLOW)
})
