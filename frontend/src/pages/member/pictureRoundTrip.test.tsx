import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import sr from '../../i18n/sr.json'
import { inputElement, must } from '../../test/at'
import { measurePicture, theMeasuringPicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/**
 * THE PICTURE A MEMBER SENT, OR HAS, IS ON THE SENDING SCREEN AFTER A REFRESH, WITH THE CIRCLE HE
 * SET, AND THE CIRCLE MOVES.
 *
 * <p>Owner, 18.10.2026: „kad popravis adresu i telefon, budi siguran da se cuvaju i ostala polja,
 * tipa opis, slika i sl. Slika koja je postavljena treba da bude vidljiva sa sve fokus krugom tako da
 * takmicar moze da ga pomera." The decisions under it are PDL P11's of 27.09.2026: the screen for
 * sending shows the picture that waits "sa krugom i oznakom da čeka odobrenje", and sending again
 * overwrites the row that waits, for a new picture and for "pomeren krug nad istom slikom" alike.
 *
 * <p><b>What was measured first, on the code as it stood.</b> `MePhotoApi` answers
 * `GET /api/me/photo` and nothing on the portal's side asked it, so a picture sent in one visit was
 * gone from the screen in the next (the panel said the portal had no photograph over one that was
 * with a moderator), an approved one was never drawn on this screen at all, and a circle could be
 * set only over a file chosen from the disc. Every case below stands on the other side of that.
 *
 * <p><b>The server here keeps what it is told</b> and answers a later `GET` out of the same place, so
 * the screen is torn down (`cleanup`, which is a refresh: nothing of the old screen survives but the
 * server) and drawn again, and what the second screen shows can come from the server and from nowhere
 * else. That is the round trip; the sources it separates are named at each case.
 */

type Circle = { x: number; y: number; size: number }
type Held = { digest: string; crop: Circle }

/** The bytes any picture is served as, and the one thing that tells a sent file from another. */
const BYTES = 'bytes-of-the-picture'

function json(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * THE SERVER'S PICTURES OF ONE MEMBER, and the three routes a screen uses for them.
 *
 * <p>`GET /api/me/photo` answers the waiting picture and the standing one, each as an address and a
 * circle; `/api/me/photo/<digest>` and `/api/photos/<digest>` serve the bytes; `POST /api/me/photo`
 * keeps what it is sent exactly as `MePhotoApi.send` does: a request with a `picture` part makes a
 * new waiting picture (over the one that waits, never beside it), and one with none moves the circle
 * of the picture that waits and keeps its bytes and its digest.
 *
 * @param standing what stands on the profile, or nothing
 * @param waiting  what waits for a moderator, or nothing
 */
function aServerThatKeepsThePictures(initial: { standing?: Held; waiting?: Held }): {
  asked: Asked[]
  stop: () => void
  pictures: () => { standing: Held | null; waiting: Held | null }
  rows: () => number
  failToServeStanding: (how: 'refuses' | 'throws') => void
} {
  let standing: Held | null = initial.standing ?? null
  let waiting: Held | null = initial.waiting ?? null
  let rows = waiting === null ? 0 : 1
  let sent = 0
  let standingFails: 'refuses' | 'throws' | null = null

  const { asked, stop } = serverThat((path, init) => {
    if (path === '/api/me/photo' && init?.method === undefined) {
      return json({
        waiting: waiting === null ? null : { photo: `/api/me/photo/${waiting.digest}`, crop: waiting.crop },
        standing: standing === null ? null : { photo: `/api/photos/${standing.digest}`, crop: standing.crop },
      })
    }

    if (path.startsWith('/api/photos/')) {
      if (standingFails === 'throws') {
        throw new Error('nema veze')
      }

      return standingFails === null
        ? new Response(BYTES, { status: 200, headers: { 'content-type': 'image/png' } })
        : new Response(null, { status: 404 })
    }

    if (path.startsWith('/api/me/photo/') && init?.method === undefined) {
      return new Response(BYTES, { status: 200, headers: { 'content-type': 'image/png' } })
    }

    if (path === '/api/me/photo' && init?.method === 'POST') {
      const body = init.body

      if (!(body instanceof FormData)) {
        return new Response(null, { status: 400 })
      }

      const crop = {
        x: Number(body.get('cropX')),
        y: Number(body.get('cropY')),
        size: Number(body.get('cropSize')),
      }

      if (body.get('picture') === null) {
        if (waiting === null) {
          return new Response(JSON.stringify({ reason: 'theFormIsNotComplete' }), { status: 400 })
        }

        waiting = { digest: waiting.digest, crop }
      } else {
        sent += 1
        rows = 1
        waiting = { digest: `sent-${String(sent)}`, crop }
      }

      return json({ waiting: 2, digest: waiting.digest, standing: standing?.digest ?? null })
    }

    return null
  })

  return {
    asked,
    stop,
    pictures: () => ({ standing, waiting }),
    rows: () => rows,
    failToServeStanding: (how) => {
      standingFails = how
    },
  }
}

const THE_WAITING_ONE: Held = { digest: 'waiting-1', crop: { x: 0.2, y: 0.4, size: 0.6 } }
const THE_STANDING_ONE: Held = { digest: 'standing-1', crop: { x: 0.7, y: 0.1, size: 0.5 } }

const panelFor = async () => within(await screen.findByRole('region', { name: 'Profilna slika' }))

type Panel = ReturnType<typeof within>

/** The circle as the three sliders hold it, once the picture has been measured. */
async function theCircleOn(panel: Panel): Promise<Circle> {
  await measurePicture()

  const x = await panel.findByLabelText(sr.crop.x)
  const y = panel.getByLabelText(sr.crop.y)
  const size = panel.getByLabelText(sr.crop.size)

  return {
    x: Number(inputElement(x).value),
    y: Number(inputElement(y).value),
    size: Number(inputElement(size).value),
  }
}

/**
 * A FILE CHOSEN ON THE DISC, and the screen waited for until it is the FILE that is drawn.
 *
 * <p>The picture that is already there has a measuring element of its own, and the browser hands the
 * chosen file back a tick after the press, so a case that measured at once would measure the old
 * picture and then move a slider that is replaced a moment later. The element is waited for until it
 * carries the file, and the frame until it is the one for a file the member chose.
 */
async function chooseAFile(
  user: ReturnType<typeof setupUser>,
  panel: Panel,
  file: File,
): Promise<void> {
  await user.upload(await panel.findByLabelText(sr.picture.choose), file)
  await waitFor(() => {
    expect(theMeasuringPicture().getAttribute('src')).toMatch(/^data:/)
  })
  await measurePicture()
  await panel.findByRole('img', { name: sr.picture.chosenAlt })
}

const sends = (asked: Asked[]): Asked[] =>
  asked.filter((one) => one.path === '/api/me/photo' && one.init?.method === 'POST')

function partsOf(sent: Asked): FormData {
  const body = sent.init?.body

  if (!(body instanceof FormData)) {
    throw new Error('the picture was not sent as a multipart body')
  }

  return body
}

describe('a picture that waits for a moderator', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
    cleanup()
  })

  /**
   * <p><b>Drawn after a refresh, with the circle the server holds.</b> The two sources of "what is on
   * the screen" are the session of this visit and the server: a screen drawn from the first says the
   * portal has no photograph over a picture a moderator is holding (the fault), and one drawn from
   * the server says "čeka odobrenje" and sets the sliders where the member set them. The circle is a
   * value that exists nowhere else on the page, so the sliders are read.
   */
  it('is drawn with its circle and the sentence that it waits, though this visit sent nothing', async () => {
    const server = aServerThatKeepsThePictures({ waiting: THE_WAITING_ONE, standing: THE_STANDING_ONE })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = await panelFor()

    expect(await panel.findByText(sr.picture.waitingNote)).toBeVisible()
    expect(panel.queryByText(sr.picture.none)).not.toBeInTheDocument()
    expect(panel.queryByText(sr.picture.standingNote)).not.toBeInTheDocument()
    expect(await theCircleOn(panel)).toEqual(THE_WAITING_ONE.crop)
  }, SLOW)

  /**
   * <p><b>The circle is moved over the same picture and sent without the picture.</b> `MePhotoApi` reads
   * a request with no `picture` part as exactly that and keeps the bytes, the digest and the member's
   * place in the queue (PDL P11, „pomeren krug nad istom slikom"). The request is read off the
   * recording server: the screen would look the same if it sent the whole picture again.
   *
   * <p>And the refresh after it shows the circle the server kept, not the one the screen held: the
   * size is moved to a value that is not the one it started at and not the standing picture's.
   */
  it('moves its circle without sending the picture again, and keeps it after a refresh', async () => {
    const user = setupUser()
    const server = aServerThatKeepsThePictures({ waiting: THE_WAITING_ONE, standing: THE_STANDING_ONE })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', '000007')

    let panel = await panelFor()

    await theCircleOn(panel)
    const send = await panel.findByRole('button', { name: sr.picture.send })

    expect(send).toHaveAttribute('aria-disabled', 'true')
    /* Told off and silent about it (PDL P11, 18.10.2026): no sentence under the button, and nothing
       for the button to point at. */
    expect(send).not.toHaveAttribute('aria-describedby')

    fireEvent.change(panel.getByLabelText(sr.crop.size), { target: { value: '0.9' } })
    fireEvent.change(panel.getByLabelText(sr.crop.x), { target: { value: '0.3' } })
    await user.click(panel.getByRole('button', { name: sr.picture.send }))

    await waitFor(() => {
      expect(sends(server.asked)).toHaveLength(1)
    })

    const parts = partsOf(must(sends(server.asked)[0], 'the send'))

    expect(parts.get('picture'), 'the picture was sent again for a circle that moved').toBeNull()
    expect(Number(parts.get('cropSize'))).toBeCloseTo(0.9, 8)
    expect(Number(parts.get('cropX'))).toBeCloseTo(0.3, 8)
    expect(Number(parts.get('cropY'))).toBeCloseTo(THE_WAITING_ONE.crop.y, 8)
    expect(server.rows(), 'a second row was made for a moved circle').toBe(1)
    expect(server.pictures().waiting?.digest).toBe(THE_WAITING_ONE.digest)

    cleanup()
    renderAt('/sr/podesavanja', 'competitor', '000007')
    panel = await panelFor()

    expect(await panel.findByText(sr.picture.waitingNote)).toBeVisible()
    expect(await theCircleOn(panel)).toEqual({ x: 0.3, y: THE_WAITING_ONE.crop.y, size: 0.9 })
  }, SLOW)

  /**
   * <p><b>A circle moved and moved back is the circle that stands.</b> The button is told off again and
   * nothing is sent: "changed" is a question about the circle against the server's, not about whether
   * the member touched a control.
   */
  it('is not sent again when the circle is moved and then put back where it was', async () => {
    const user = setupUser()
    const server = aServerThatKeepsThePictures({ waiting: THE_WAITING_ONE })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = await panelFor()

    await theCircleOn(panel)
    fireEvent.change(panel.getByLabelText(sr.crop.size), { target: { value: '0.9' } })
    expect(panel.getByRole('button', { name: sr.picture.send })).toHaveAttribute('aria-disabled', 'false')
    fireEvent.change(panel.getByLabelText(sr.crop.size), { target: { value: String(THE_WAITING_ONE.crop.size) } })
    expect(panel.getByRole('button', { name: sr.picture.send })).toHaveAttribute('aria-disabled', 'true')

    await user.click(panel.getByRole('button', { name: sr.picture.send }))

    expect(sends(server.asked)).toEqual([])
  }, SLOW)

  it('sends nothing for a press while nothing has changed', async () => {
    const user = setupUser()
    const server = aServerThatKeepsThePictures({ waiting: THE_WAITING_ONE })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = await panelFor()

    await theCircleOn(panel)
    await user.click(await panel.findByRole('button', { name: sr.picture.send }))

    expect(sends(server.asked)).toEqual([])
  }, SLOW)

  /**
   * <p><b>A new picture over the one that waits is one row, and it is what a refresh shows.</b> The
   * file is the one chosen from the disc, and its circle is the one set over it.
   */
  it('is overwritten by a new picture, which is what a refresh then shows', async () => {
    const user = setupUser()
    const server = aServerThatKeepsThePictures({ waiting: THE_WAITING_ONE })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', '000007')

    let panel = await panelFor()

    await theCircleOn(panel)
    await chooseAFile(user, panel, new File(['nova'], 'nova-slika.jpg', { type: 'image/jpeg' }))
    fireEvent.change(await panel.findByLabelText(sr.crop.size), { target: { value: '0.8' } })
    await user.click(panel.getByRole('button', { name: sr.picture.send }))

    await waitFor(() => {
      expect(sends(server.asked)).toHaveLength(1)
    })

    const parts = partsOf(must(sends(server.asked)[0], 'the send'))
    const file = parts.get('picture')

    expect(file instanceof File ? file.name : '', 'the file chosen on the disc was not sent').toBe('nova-slika.jpg')
    expect(server.rows(), 'a second row was made beside the one that waited').toBe(1)
    expect(server.pictures().waiting?.digest).not.toBe(THE_WAITING_ONE.digest)

    cleanup()
    renderAt('/sr/podesavanja', 'competitor', '000007')
    panel = await panelFor()

    expect(await panel.findByText(sr.picture.waitingNote)).toBeVisible()
    expect(await theCircleOn(panel)).toMatchObject({ size: 0.8 })
  }, SLOW)
})

describe('a picture that stands on the profile', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
    cleanup()
  })

  /**
   * <p><b>Drawn on the sending screen with its circle, and said to be the one on the profile.</b> It
   * was never drawn here at all: the screen offered a chooser and, at best, a sentence that the portal
   * had no photograph.
   */
  it('is drawn with its circle and the sentence that it is the one on the profile', async () => {
    const server = aServerThatKeepsThePictures({ standing: THE_STANDING_ONE })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = await panelFor()

    expect(await panel.findByText(sr.picture.standingNote)).toBeVisible()
    expect(panel.queryByText(sr.picture.waitingNote)).not.toBeInTheDocument()
    expect(panel.queryByText(sr.picture.none)).not.toBeInTheDocument()
    expect(await theCircleOn(panel)).toEqual(THE_STANDING_ONE.crop)
    expect(panel.getByRole('img', { name: sr.picture.currentAlt })).toHaveAttribute(
      'src',
      `/api/photos/${THE_STANDING_ONE.digest}`,
    )
  }, SLOW)

  /**
   * <p><b>A circle moved over it has no row to be moved on, so the same bytes go as a new picture.</b>
   * Fetched from the address the picture stands at and sent as a file with the new circle; the profile
   * keeps showing the approved one (PDL P11, 12.08.2026) while the new one waits, and a refresh shows
   * the one that waits, with the circle that was sent.
   */
  it('is sent again with the circle moved, and what then waits is what a refresh shows', async () => {
    const user = setupUser()
    const server = aServerThatKeepsThePictures({ standing: THE_STANDING_ONE })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', '000007')

    let panel = await panelFor()

    await theCircleOn(panel)
    fireEvent.change(panel.getByLabelText(sr.crop.size), { target: { value: '0.7' } })
    await user.click(await panel.findByRole('button', { name: sr.picture.send }))

    await waitFor(() => {
      expect(sends(server.asked)).toHaveLength(1)
    })

    const parts = partsOf(must(sends(server.asked)[0], 'the send'))
    const file = parts.get('picture')

    expect(file instanceof File ? await file.text() : '', 'the bytes of the standing picture were not sent').toBe(BYTES)
    expect(Number(parts.get('cropSize'))).toBeCloseTo(0.7, 8)
    expect(Number(parts.get('cropX'))).toBeCloseTo(THE_STANDING_ONE.crop.x, 8)
    expect(server.pictures().standing, 'the profile lost its picture while the new one waits').toEqual(THE_STANDING_ONE)
    expect(server.pictures().waiting?.crop.size).toBeCloseTo(0.7, 8)

    cleanup()
    renderAt('/sr/podesavanja', 'competitor', '000007')
    panel = await panelFor()

    expect(await panel.findByText(sr.picture.waitingNote)).toBeVisible()
    expect((await theCircleOn(panel)).size).toBeCloseTo(0.7, 8)
  }, SLOW)

  /**
   * <p><b>A file the browser cannot read gives the picture that stands back, with its own circle.</b> The
   * chooser refuses it ("Ova slika se ne može otvoriti") and hands the screen nothing; what the member
   * moved over the picture that stands is not carried over to a file that never opened, and he is not
   * left holding a button that would send the circle he set a moment ago.
   */
  it('is drawn again with its own circle when the file chosen cannot be opened', async () => {
    const user = setupUser()
    const server = aServerThatKeepsThePictures({ standing: THE_STANDING_ONE })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = await panelFor()

    await theCircleOn(panel)
    fireEvent.change(panel.getByLabelText(sr.crop.size), { target: { value: '0.9' } })
    await user.upload(
      await panel.findByLabelText(sr.picture.choose),
      new File(['nije slika'], 'nije-slika.heic', { type: 'image/heic' }),
    )
    await waitFor(() => {
      expect(theMeasuringPicture().getAttribute('src')).toMatch(/^data:/)
    })
    await measurePicture(0, 0)

    expect(await panel.findByRole('alert')).toHaveTextContent(sr.crop.unreadable)
    expect(await theCircleOn(panel)).toEqual(THE_STANDING_ONE.crop)
    expect(panel.getByRole('button', { name: sr.picture.send })).toHaveAttribute('aria-disabled', 'true')
    expect(sends(server.asked)).toEqual([])
  }, SLOW)

  it('sends nothing for a press while the circle has not moved', async () => {
    const user = setupUser()
    const server = aServerThatKeepsThePictures({ standing: THE_STANDING_ONE })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = await panelFor()

    await theCircleOn(panel)
    await user.click(await panel.findByRole('button', { name: sr.picture.send }))

    expect(sends(server.asked)).toEqual([])
  }, SLOW)

  /**
   * <p>When the bytes cannot be had there is nothing to send: the member is told so in the portal's
   * own words for a request that did not reach the server, and nothing is posted.
   */
  it.each(['refuses', 'throws'] as const)('says so, and sends nothing, when the picture cannot be fetched to be sent again (%s)', async (how) => {
    const user = setupUser()
    const server = aServerThatKeepsThePictures({ standing: THE_STANDING_ONE })

    stop = server.stop
    server.failToServeStanding(how)
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = await panelFor()

    await theCircleOn(panel)
    fireEvent.change(panel.getByLabelText(sr.crop.size), { target: { value: '0.7' } })
    await user.click(await panel.findByRole('button', { name: sr.picture.send }))

    await waitFor(() => {
      expect(panel.getByRole('alert')).toBeVisible()
    })
    expect(sends(server.asked)).toEqual([])
  }, SLOW)
})

describe('a member with no picture at all', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
    cleanup()
  })

  it('is told the portal has none, and the first picture he sends waits and is there after a refresh', async () => {
    const user = setupUser()
    const server = aServerThatKeepsThePictures({})

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', '000007')

    let panel = await panelFor()

    expect(await panel.findByText(sr.picture.none)).toBeVisible()
    await chooseAFile(user, panel, new File(['prva'], 'prva.jpg', { type: 'image/jpeg' }))
    fireEvent.change(await panel.findByLabelText(sr.crop.size), { target: { value: '0.6' } })
    await user.click(panel.getByRole('button', { name: sr.picture.send }))

    await waitFor(() => {
      expect(sends(server.asked)).toHaveLength(1)
    })

    cleanup()
    renderAt('/sr/podesavanja', 'competitor', '000007')
    panel = await panelFor()

    expect(await panel.findByText(sr.picture.waitingNote)).toBeVisible()
    expect(panel.queryByText(sr.picture.none)).not.toBeInTheDocument()
    expect(await theCircleOn(panel)).toMatchObject({ size: 0.6 })
  }, SLOW)
})
