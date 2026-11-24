import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { cropIn } from '../../components/crop'
import { fittedTo } from '../../components/fitted'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { measurePicture, theMeasuringPicture } from '../../test/picture'
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

/**
 * THE CIRCLE OF THE PICTURE THAT STANDS, MOVED BY THE ADMINISTRATION AND SAVED (owner, 23.11.2026, PDL
 * „Administracija sama podešava krug na članovoj slici": „Čak i kad mu uđem u podatke, želim da mogu da se
 * poigram krugom pa da je sačuvam.", and „Član ne dobija poruku kad administracija pomeri krug.").
 *
 * <p>000003 stands with the circle 0,3 0,15 0,55 (`test/mock/competitors.json`); the circle moved to is
 * unlike it in the two numbers moved, so a request carrying the served circle is another request.
 */
describe('the circle of his picture, moved by the administration', () => {
  const HAS_ONE = '000003'
  const SERVED = { x: 0.3, y: 0.15, size: 0.55 }

  it('is drawn over the picture that stands, sent alone to his address, and says he is not told', async () => {
    const user = setupUser()
    const { asked, stop } = serverThat((path, init) =>
      init?.method === 'POST' && path === `/api/members/${HAS_ONE}/photo`
        ? json({ photo: '/mock/photo/andjelija.svg', crop: { x: 0.13, y: 0.15, size: 0.42 } })
        : null,
    )

    stops.push(stop)
    asTheAdministration(HAS_ONE)

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))
    const save = panel.getByRole('button', { name: sr.theirBoxes.pictureSave })

    expect(save, 'nothing has moved yet').toHaveAttribute('aria-disabled', 'true')

    await measurePicture()
    fireEvent.change(await panel.findByLabelText(sr.crop.x), { target: { value: '0.13' } })
    fireEvent.change(panel.getByLabelText(sr.crop.size), { target: { value: '0.42' } })
    await user.click(save)

    expect(await panel.findByText(sr.theirBoxes.circleSaved)).toHaveAttribute('role', 'status')
    expect(panel.queryByText(sr.theirBoxes.saved), 'the sentence says he was told').toBeNull()

    const sent = writes(asked)

    expect(sent.map((one) => one.path)).toEqual([`/api/members/${HAS_ONE}/photo`])

    const body = must(sent[0], 'the write').init?.body

    expect(body).toBeInstanceOf(FormData)
    expect(body instanceof FormData ? body.get('picture') : 'no form', 'a circle moved sent a file').toBeNull()
    /* AND NAMES THE PICTURE IT WAS DRAWN OVER, the address the member's data served it at (owner, 24.11.2026:
       „ako je u međuvremenu odobrena nova slika, portal odbija upis kruga"). */
    expect(body instanceof FormData ? body.get('over') : 'no form').toBe('/mock/photo/andjelija.svg')
    expect(body instanceof FormData ? [body.get('cropX'), body.get('cropY'), body.get('cropSize')] : []).toEqual([
      '0.13000000',
      '0.15000000',
      '0.42000000',
    ])

    /* AND WHAT STANDS IS DRAWN IN THE NEW CIRCLE, not the one served. */
    expect(panel.getByRole('img', { name: sr.theirBoxes.currentAlt }).style.transform).toBe(
      fittedTo(cropIn({ x: 0.13, y: 0.15, size: 0.42 })).transform,
    )
    expect(fittedTo(cropIn(SERVED)).transform, 'the served circle is the moved one, so this measures nothing').not.toBe(
      fittedTo(cropIn({ x: 0.13, y: 0.15, size: 0.42 })).transform,
    )
    await waitFor(() => expect(save).toHaveAttribute('aria-disabled', 'true'))
  }, SLOW)

  it('names the picture the server answered for, and not the copy the browser draws, when the circle is moved after a file was saved', async () => {
    /* THE TWO SOURCES OF ONE ADDRESS: after a file is saved the screen draws the browser's own copy of it (a data
       URL) until the page is read again, and the server knows the picture by the address it answered with. A
       circle sent over the data URL is a circle over a picture the route has never heard of, so it would be
       refused every time; sent over the address of the picture that stood BEFORE the save, it would be written
       onto a picture that is gone. The save is answered with an address that is neither of those. */
    const user = setupUser()
    const { asked, stop } = serverThat((path, init) =>
      init?.method === 'POST' && path === `/api/members/${HAS_ONE}/photo`
        ? json({ photo: '/api/photos/the-new-one', crop: { x: 0.5, y: 0.5, size: 1 } })
        : null,
    )

    stops.push(stop)
    asTheAdministration(HAS_ONE)

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))
    const save = panel.getByRole('button', { name: sr.theirBoxes.pictureSave })

    await user.upload(
      await panel.findByLabelText(sr.picture.choose),
      new File(['slika'], 'nova.jpg', { type: 'image/jpeg' }),
    )
    await measurePicture()
    await panel.findByLabelText('Veličina isečka')
    await user.click(save)
    expect(await panel.findByText(sr.theirBoxes.saved)).toBeVisible()

    await measurePicture()
    fireEvent.change(await panel.findByLabelText(sr.crop.x), { target: { value: '0.13' } })
    await user.click(save)
    await waitFor(() => expect(writes(asked)).toHaveLength(2))

    const circle = must(writes(asked)[1], 'the second write').init?.body

    expect(circle instanceof FormData ? circle.get('picture') : 'no form', 'the second write sent a file').toBeNull()
    expect(circle instanceof FormData ? circle.get('over') : 'no form').toBe('/api/photos/the-new-one')
  }, SLOW)

  it('says, in the owner\'s own sentence, that the picture changed in the meantime, and sends it once', async () => {
    /* Owner, 24.11.2026, PDL „Sitnice iz recenzije PR-a 815 i 811 i panela tima": „Slika je u međuvremenu
       promenjena. Otvori je ponovo pa namesti krug." The sentence is the dictionary's and the words are his, so
       they are asked of the dictionary AND as written, which is what a rewording of either would fail. */
    const user = setupUser()
    const { asked, stop } = serverThat((path, init) =>
      init?.method === 'POST' && path === `/api/members/${HAS_ONE}/photo`
        ? json({ reason: 'thePictureHasChanged' }, 409)
        : null,
    )

    stops.push(stop)
    asTheAdministration(HAS_ONE)

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))

    await measurePicture()
    fireEvent.change(await panel.findByLabelText(sr.crop.x), { target: { value: '0.13' } })
    await user.click(panel.getByRole('button', { name: sr.theirBoxes.pictureSave }))

    expect(sr.picture.sendRefused.thePictureHasChanged).toBe(
      'Slika je u međuvremenu promenjena. Otvori je ponovo pa namesti krug.',
    )
    expect(await panel.findByText(sr.picture.sendRefused.thePictureHasChanged)).toBeVisible()
    expect(writes(asked)).toHaveLength(1)
  }, SLOW)

  it('reads the list again after the refusal, so that the circle moved next is drawn over the picture that stands now', async () => {
    /* Review of PR 825, high: the sentence says „Otvori je ponovo", and the list the card is drawn from is kept
       for the whole visit, so opening it again used to show the picture the refusal was about and every press
       after it was refused the same way. Two sources told apart: the list says A the first time and B after, and
       the route refuses the first circle and takes the second. What the second circle names is B, not A. */
    const user = setupUser()
    const disc = globalThis.fetch
    const OLD = '/mock/photo/andjelija.svg'
    const NEW = '/mock/photo/the-one-that-stands-now.svg'
    let listed = 0
    let posted = 0
    const { asked, stop } = serverThat((path, init) => {
      if (path === '/api/competitors' && init?.method === undefined) {
        listed += 1

        return listed === 1
          ? null
          : disc(path, init).then(async (answer) => {
              const rows: Record<string, unknown>[] = await answer.json()

              return json(rows.map((one) => (one.memberNumber === HAS_ONE ? { ...one, photo: NEW } : one)))
            })
      }

      if (init?.method === 'POST' && path === `/api/members/${HAS_ONE}/photo`) {
        posted += 1

        return posted === 1
          ? json({ reason: 'thePictureHasChanged' }, 409)
          : json({ photo: NEW, crop: { x: 0.13, y: 0.15, size: 0.42 } })
      }

      return null
    })

    stops.push(stop)
    asTheAdministration(HAS_ONE)

    const first = within(await screen.findByRole('region', { name: sr.picture.title }))

    await measurePicture()
    fireEvent.change(await first.findByLabelText(sr.crop.x), { target: { value: '0.13' } })
    await user.click(first.getByRole('button', { name: sr.theirBoxes.pictureSave }))
    expect(await first.findByText(sr.picture.sendRefused.thePictureHasChanged)).toBeVisible()
    await waitFor(() => expect(listed).toBeGreaterThan(1))

    const again = within(await screen.findByRole('region', { name: sr.picture.title }))

    await measurePicture()
    fireEvent.change(await again.findByLabelText(sr.crop.x), { target: { value: '0.13' } })
    await user.click(again.getByRole('button', { name: sr.theirBoxes.pictureSave }))
    await waitFor(() => expect(writes(asked)).toHaveLength(2))

    const body = must(writes(asked)[1], 'the second write').init?.body

    expect(body instanceof FormData ? body.get('over') : 'no form').toBe(NEW)
    expect(body instanceof FormData ? body.get('over') : 'no form').not.toBe(OLD)
  }, SLOW)

  it('draws the picture that stands again, in the circle it stands in, when a file chosen over it cannot be opened', async () => {
    /* The branch of `onChange` that hears „nothing": the chooser refuses a file the browser cannot read
       (`CropChooser`, „unreadable") and hands up nothing. What stands comes back under the sentence, in the
       circle it stands in: a moved circle was put aside the moment a file arrived, which is the shape
       `member/ProfilePicture.tsx` gives the member („The circle was already put aside when the file
       arrived"). So nothing is left to send, and nothing is sent: the file that could not be opened least of
       all. */
    const user = setupUser()
    const { asked, stop } = serverThat(() => null)

    stops.push(stop)
    asTheAdministration(HAS_ONE)

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))

    await measurePicture()
    fireEvent.change(await panel.findByLabelText(sr.crop.x), { target: { value: '0.13' } })

    await user.upload(panel.getByLabelText(sr.picture.choose), new File(['nije slika'], 'nova.heic', { type: 'image/heic' }))
    await waitFor(() => expect(theMeasuringPicture().getAttribute('src')).not.toBe('/mock/photo/andjelija.svg'))
    fireEvent.error(theMeasuringPicture())

    expect(await panel.findByText(sr.crop.unreadable)).toBeVisible()
    await waitFor(() => expect(theMeasuringPicture().getAttribute('src')).toBe('/mock/photo/andjelija.svg'))
    await measurePicture()
    expect(await panel.findByLabelText(sr.crop.x), 'the picture that stands is not drawn in its own circle').toHaveValue(
      String(SERVED.x),
    )
    expect(panel.getByRole('img', { name: sr.theirBoxes.circleAlt })).toBeVisible()

    const save = panel.getByRole('button', { name: sr.theirBoxes.pictureSave })

    expect(save).toHaveAttribute('aria-disabled', 'true')
    await user.click(save)
    expect(writes(asked), 'something was sent for a file that could not be opened').toHaveLength(0)
  }, SLOW)

  it('sends nothing for a circle moved back to where it stood', async () => {
    const user = setupUser()
    const { asked, stop } = serverThat(() => null)

    stops.push(stop)
    asTheAdministration(HAS_ONE)

    const panel = within(await screen.findByRole('region', { name: sr.picture.title }))

    await measurePicture()

    const across = await panel.findByLabelText(sr.crop.x)

    fireEvent.change(across, { target: { value: '0.13' } })
    fireEvent.change(across, { target: { value: String(SERVED.x) } })
    await user.click(panel.getByRole('button', { name: sr.theirBoxes.pictureSave }))

    expect(writes(asked)).toHaveLength(0)
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
    viberCommunity: false,
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

    const standing = await picture.findByRole('img', { name: sr.theirBoxes.currentAlt })

    expect(standing).toHaveAttribute('src', '/api/photos/abc')
    /* THE CIRCLE HE STANDS IN IS THE ONE THE SERVER SAYS (review of PR 809, low 1): a picture drawn with no circle is
       the whole of it, which is what `crop={null}` draws, and the served square is not the whole (0,3 0,7 0,45). */
    expect(standing.style.transform, 'the picture is drawn whole and not in its circle').toBe(
      fittedTo(cropIn(HIS_DATA.crop)).transform,
    )
    expect(fittedTo(cropIn(null)).transform, 'the circle served is the whole picture, so this measures nothing').not.toBe(
      fittedTo(cropIn(HIS_DATA.crop)).transform,
    )
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
