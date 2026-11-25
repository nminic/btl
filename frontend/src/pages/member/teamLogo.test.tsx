import { configure, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { timesDropped } from '../../data/client'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/* Every wait of this file is given half of the time a case has (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE TEAM'S LOGO ON „IZMENI TIM”, SENT FOR APPROVAL BY THE MEMBER WHO RUNS THE TEAM (owner, PDL 25.11.2026,
 * „Urednik tima postavlja znak tima slikom”, and „Logo tima, pitanja iz plana”: „urednik šalje logo na strani
 * „Izmeni tim”, u posebnom okviru”; „i urednik tima sme da ukloni logo, i to važi odmah, bez odobrenja”).
 *
 * Member 000001 runs Dunavski trkači (team 1) in the served files. The route's own reading of the team's logo is
 * answered here, case by case: nothing, a logo that stands, a logo that waits, or both, and the logo that STANDS and
 * the one that WAITS carry different digests, so a send that named the one when it meant the other is told apart.
 */
const STANDS = '/api/photos/' + 'ab'.repeat(32)
const WAITS = '/api/teams/own-logo/' + 'cd'.repeat(32)
const ANSWERED = 'ef'.repeat(32)

type Halves = { waiting: { photo: string; crop: { x: number; y: number; size: number } } | null; standing: typeof STANDING | null }

const STANDING = { photo: STANDS, crop: { x: 0.3, y: 0.15, size: 0.55 } }
const WAITING = { photo: WAITS, crop: { x: 0.6, y: 0.4, size: 0.5 } }

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** A server that reads the team's logo as `halves`, serves the bytes of the logo that stands as `bytes`, and takes
 *  a write with `write`, or with the route's own answer where `write` answers nothing. */
function aServer(
  halves: Halves,
  write: (method: string) => Response | null = () => null,
  bytes: () => Response | Promise<Response> = () => new Response(new Blob(['logo'], { type: 'image/png' })),
): Asked[] {
  const { asked, stop } = serverThat((path, init) => {
    if (path === '/api/teams/1/own-logo' && init?.method === undefined) {
      return json(halves)
    }

    if (path === STANDS && init?.method === undefined) {
      return bytes()
    }

    if (path === '/api/teams/1/own-logo' && init?.method === 'POST') {
      return write('POST') ?? json({ waiting: 9, digest: ANSWERED, standing: null })
    }

    if (path === '/api/teams/1/own-logo' && init?.method === 'DELETE') {
      return write('DELETE') ?? new Response(null, { status: 200 })
    }

    return null
  })

  stops.push(stop)

  return asked
}

const writes = (asked: Asked[]) => asked.filter((one) => one.init?.method === 'POST' || one.init?.method === 'DELETE')

function sentOf(asked: Asked[], at: number): FormData {
  const body = must(writes(asked)[at], 'the write').init?.body

  if (!(body instanceof FormData)) {
    throw new Error('the write carried no form')
  }

  return body
}

async function theBox() {
  renderAt('/sr/tim/dunavski-trkaci/izmena', 'competitor', '000001')

  return within(await screen.findByRole('region', { name: sr.teamLogo.title }))
}

async function moveTheCircle(box: ReturnType<typeof within>) {
  await measurePicture()
  fireEvent.change(await box.findByLabelText('Veličina isečka'), { target: { value: '0.4' } })
}

describe('the logo of a team, on the page that changes the team', () => {
  it('says the team has none, and offers neither a send nor a removal of what is not there', async () => {
    const user = setupUser()
    const asked = aServer({ waiting: null, standing: null })
    const box = await theBox()

    expect(await box.findByText(sr.teamLogo.none)).toBeVisible()

    const send = box.getByRole('button', { name: sr.teamLogo.send })

    expect(box.queryByRole('button', { name: sr.teamLogo.remove })).toBeNull()
    expect(send).toHaveAttribute('aria-disabled', 'true')

    await user.click(send)
    expect(writes(asked)).toHaveLength(0)
  }, SLOW)

  it('sends a chosen picture with its circle to this team’s address, and then shows it waiting', async () => {
    const user = setupUser()
    const asked = aServer({ waiting: null, standing: STANDING })
    const box = await theBox()

    expect(await box.findByText(sr.teamLogo.standingNote)).toBeVisible()
    expect(box.getByText(sr.teamLogo.standingMove)).toBeVisible()
    await measurePicture()
    expect(await box.findByAltText(sr.teamLogo.currentAlt)).toBeVisible()

    await user.upload(box.getByLabelText(sr.teamLogo.choose), new File(['logo'], 'logo.png', { type: 'image/png' }))
    await measurePicture()
    expect(await box.findByAltText(sr.teamLogo.chosenAlt)).toBeVisible()

    const dropped = timesDropped('verification')

    await user.click(box.getByRole('button', { name: sr.teamLogo.send }))

    expect(await box.findByText(sr.teamLogo.sent)).toHaveAttribute('role', 'status')
    expect(timesDropped('verification'), 'the queue was not dropped after the send').toBe(dropped + 1)
    expect(writes(asked).map((one) => [one.path, one.init?.method])).toEqual([['/api/teams/1/own-logo', 'POST']])
    expect(sentOf(asked, 0).get('picture')).toBeInstanceOf(File)
    expect(sentOf(asked, 0).get('over')).toBeNull()
    expect(box.getByText(sr.teamLogo.waitingNote)).toBeVisible()
    await measurePicture()
    expect(await box.findByAltText(sr.teamLogo.sentAlt)).toBeVisible()

    /* AND A CIRCLE MOVED NOW IS SENT OVER THE LOGO THE ANSWER NAMED, alone: the row waits to move it on. */
    await moveTheCircle(box)
    await user.click(box.getByRole('button', { name: sr.teamLogo.send }))
    await box.findByText(sr.teamLogo.sent)

    expect(writes(asked)).toHaveLength(2)
    expect(sentOf(asked, 1).get('picture')).toBeNull()
    expect(sentOf(asked, 1).get('over')).toBe('/api/teams/own-logo/' + ANSWERED)
  }, SLOW)

  it('sends a circle moved over the logo that waits alone, naming that logo and not the one that stands', async () => {
    const user = setupUser()
    const asked = aServer({ waiting: WAITING, standing: STANDING })
    const box = await theBox()

    expect(await box.findByText(sr.teamLogo.waitingNote)).toBeVisible()
    expect(box.getByText(sr.teamLogo.waitingMove)).toBeVisible()

    await moveTheCircle(box)
    await user.click(box.getByRole('button', { name: sr.teamLogo.send }))
    await box.findByText(sr.teamLogo.sent)

    expect(sentOf(asked, 0).get('over')).toBe(WAITS)
    expect(sentOf(asked, 0).get('picture')).toBeNull()
    expect(sentOf(asked, 0).get('cropSize')).toBe('0.40000000')
  }, SLOW)

  it('sends a circle moved over the logo that stands as that logo’s own bytes, since nothing waits to move it on', async () => {
    const user = setupUser()
    const asked = aServer({ waiting: null, standing: STANDING })
    const box = await theBox()

    await box.findByText(sr.teamLogo.standingNote)
    await moveTheCircle(box)
    await user.click(box.getByRole('button', { name: sr.teamLogo.send }))
    await box.findByText(sr.teamLogo.sent)

    expect(asked.some((one) => one.path === STANDS)).toBe(true)
    expect(sentOf(asked, 0).get('picture')).toBeInstanceOf(File)
    expect(sentOf(asked, 0).get('over')).toBeNull()
  }, SLOW)

  it.each([
    ['answers no picture', () => new Response(null, { status: 404 })],
    ['cannot be reached', () => Promise.reject(new Error('offline'))],
  ])('sends nothing and says so where the logo that stands %s', async (_, bytes) => {
    const user = setupUser()
    const asked = aServer({ waiting: null, standing: STANDING }, () => null, bytes)
    const box = await theBox()

    await box.findByText(sr.teamLogo.standingNote)
    await moveTheCircle(box)
    await user.click(box.getByRole('button', { name: sr.teamLogo.send }))

    expect(await box.findByRole('alert')).toBeVisible()
    expect(writes(asked)).toHaveLength(0)
  }, SLOW)

  it('says what the server refused in its own sentence, and keeps the picture chosen', async () => {
    const user = setupUser()

    aServer({ waiting: null, standing: null }, (method) => (method === 'POST' ? refused('thePictureIsTooBig') : null))

    const box = await theBox()

    await box.findByText(sr.teamLogo.none)
    await user.upload(box.getByLabelText(sr.teamLogo.choose), new File(['logo'], 'logo.png', { type: 'image/png' }))
    await measurePicture()
    await user.click(box.getByRole('button', { name: sr.teamLogo.send }))

    expect(await box.findByText(sr.picture.sendRefused.thePictureIsTooBig)).toBeVisible()
    expect(box.getByAltText(sr.teamLogo.chosenAlt)).toBeVisible()
  }, SLOW)

  it('draws the logo that was there again when the chosen file is put away', async () => {
    const user = setupUser()

    aServer({ waiting: null, standing: STANDING })

    const box = await theBox()

    await box.findByText(sr.teamLogo.standingNote)
    await user.upload(box.getByLabelText(sr.teamLogo.choose), new File(['logo'], 'logo.png', { type: 'image/png' }))
    await measurePicture()
    fireEvent.change(box.getByLabelText(sr.teamLogo.choose), { target: { files: [] } })
    await measurePicture()

    expect(await box.findByAltText(sr.teamLogo.currentAlt)).toBeVisible()
  }, SLOW)

  it('takes the logo that stands down at once, and what waits stays on the screen', async () => {
    const user = setupUser()
    const asked = aServer({ waiting: WAITING, standing: STANDING })
    const box = await theBox()
    const dropped = timesDropped('teams')

    await box.findByText(sr.teamLogo.waitingNote)
    await user.click(box.getByRole('button', { name: sr.teamLogo.remove }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: sr.admin.form.delete }))

    expect(await box.findByText(sr.teamLogo.removed)).toHaveAttribute('role', 'status')
    expect(timesDropped('teams'), 'the list of teams was not dropped after the removal').toBe(dropped + 1)
    expect(writes(asked).map((one) => [one.path, one.init?.method])).toEqual([['/api/teams/1/own-logo', 'DELETE']])
    expect(box.getByText(sr.teamLogo.waitingNote)).toBeVisible()
    expect(box.queryByRole('button', { name: sr.teamLogo.remove })).toBeNull()
  }, SLOW)

  it('says the team has none once the only logo it had is taken down', async () => {
    const user = setupUser()

    aServer({ waiting: null, standing: STANDING })

    const box = await theBox()

    await box.findByText(sr.teamLogo.standingNote)
    await user.click(box.getByRole('button', { name: sr.teamLogo.remove }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: sr.admin.form.delete }))

    expect(await box.findByText(sr.teamLogo.none)).toBeVisible()
  }, SLOW)

  it('says what the server refused when the removal is refused, and keeps the logo', async () => {
    const user = setupUser()

    aServer({ waiting: null, standing: STANDING }, (method) => (method === 'DELETE' ? refused('theFormIsNotComplete') : null))

    const box = await theBox()

    await box.findByText(sr.teamLogo.standingNote)
    await user.click(box.getByRole('button', { name: sr.teamLogo.remove }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: sr.admin.form.delete }))

    expect(await box.findByText(sr.picture.sendRefused.theFormIsNotComplete)).toBeVisible()
    expect(box.getByText(sr.teamLogo.standingNote)).toBeVisible()
  }, SLOW)
})
