import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { cropIn } from '../../components/crop'
import { fittedTo } from '../../components/fitted'
import { timesDropped } from '../../data/client'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { moderatorWith, renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/* Every wait of this file is given half of the time a case has (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE MARK OF A LEAGUE, SET AND TAKEN DOWN IN ITS MODERATION (owner, PDL 23.11.2026, „Pravi logo lige”:
 * „administracija (administrator ili moderator sa pravom nad ligama) u moderaciji lige, bez odobravanja, i
 * odmah važi”).
 *
 * The served file gives the first league (RunTrace, id 1) a mark and the second (Planinska, id 2) none, and
 * the form is opened on the SECOND for every write, so an address built from the first league, or from the
 * first of the list, is told from the one whose form is open.
 */
const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function aServerThatTakes(answer: (path: string, method: string) => Response | null = () => null): Asked[] {
  const { asked, stop } = serverThat((path, init) => {
    if (init?.method === 'POST' && /^\/api\/leagues\/\d+\/logo$/.test(path)) {
      return answer(path, 'POST') ?? json({ photo: '/api/photos/abc', crop: { x: 0.25, y: 0.75, size: 0.5 } })
    }

    if (init?.method === 'DELETE' && /^\/api\/leagues\/\d+\/logo$/.test(path)) {
      return answer(path, 'DELETE') ?? new Response(null, { status: 200 })
    }

    return null
  })

  stops.push(stop)

  return asked
}

const writes = (asked: Asked[]) => asked.filter((one) => one.init?.method === 'POST' || one.init?.method === 'DELETE')

async function theBox(league: number) {
  renderAt(`/sr/administracija/lige?izmena=${String(league)}`, 'moderator', null, moderatorWith(['entity:leagues']))

  return within(await screen.findByRole('region', { name: sr.leagueMark.title }))
}

async function chooseAPicture(box: ReturnType<typeof within>, user: ReturnType<typeof setupUser>) {
  await user.upload(await box.findByLabelText(sr.leagueMark.choose), new File(['znak'], 'znak.png', { type: 'image/png' }))
  await measurePicture()
  await box.findByLabelText('Veličina isečka')
}

describe('the mark of a league, in its moderation', () => {
  it('opens on the mark that stands, drawn as the pages draw it, for a league that has one', async () => {
    const box = await theBox(1)

    expect(box.getByText(sr.leagueMark.standing)).toBeVisible()
    expect(box.getByText(sr.leagueMark.atOnce)).toBeVisible()
    expect(must(document.querySelector('.leagues__mark-standing .leagues__mark img'), 'the mark').getAttribute('src')).toBe(
      '/mock/logo/runtrace-liga.small.svg',
    )
    expect(box.getByRole('button', { name: sr.leagueMark.remove })).toBeVisible()
  }, SLOW)

  it('opens on the initials, and offers no way to take down what is not there, for a league with none', async () => {
    const box = await theBox(2)

    expect(box.getByText(sr.leagueMark.none)).toBeVisible()
    expect(must(document.querySelector('.leagues__mark-standing .leagues__mark'), 'the mark').textContent).toBe('P')
    expect(box.queryByRole('button', { name: sr.leagueMark.remove })).toBeNull()
  }, SLOW)

  it('sends nothing while no picture is chosen, then the picture and its circle to this league’s own address, once', async () => {
    const user = setupUser()
    const asked = aServerThatTakes()
    const box = await theBox(2)
    const save = box.getByRole('button', { name: sr.leagueMark.save })

    expect(save).toHaveAttribute('aria-disabled', 'true')
    await user.click(save)
    expect(writes(asked)).toHaveLength(0)

    await chooseAPicture(box, user)

    /* What every page of the leagues reads is dropped once the route has taken the write, so the card, the
       sheet and the page of the league ask the server again. */
    const dropped = timesDropped('leagues')

    await user.click(save)

    expect(await box.findByText(sr.leagueMark.saved)).toHaveAttribute('role', 'status')
    expect(timesDropped('leagues'), 'the list of the leagues was not dropped after the save').toBe(dropped + 1)

    const [sent] = writes(asked)

    expect(writes(asked)).toHaveLength(1)
    expect(must(sent, 'the write').path).toBe('/api/leagues/2/logo')
    expect(must(sent, 'the write').init?.method).toBe('POST')

    const body = must(sent, 'the write').init?.body

    expect(body).toBeInstanceOf(FormData)
    expect(body instanceof FormData ? body.get('picture') : null).toBeInstanceOf(File)
    expect(body instanceof FormData ? [body.get('cropX'), body.get('cropY'), body.get('cropSize')] : []).not.toContain(
      null,
    )

    /* And the box now stands on the mark just saved, with the way to take it down. */
    expect(box.getByText(sr.leagueMark.standing)).toBeVisible()
    await waitFor(() => expect(save).toHaveAttribute('aria-disabled', 'true'))

    /* TAKEN DOWN AGAIN, at the same league's address: the second league, so a removal built from the first
       league of the list is told apart (the first is the one the file gives a mark). */
    await user.click(box.getByRole('button', { name: sr.leagueMark.remove }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: sr.admin.form.delete }))

    expect(await box.findByText(sr.leagueMark.removed)).toHaveAttribute('role', 'status')
    expect(timesDropped('leagues'), 'the list of the leagues was not dropped after the removal').toBe(dropped + 2)
    expect(writes(asked).map((one) => [one.path, one.init?.method])).toEqual([
      ['/api/leagues/2/logo', 'POST'],
      ['/api/leagues/2/logo', 'DELETE'],
    ])
  }, SLOW)

  /**
   * THE BOX STANDS ON WHAT WAS SAVED AND ON NOTHING OF WHAT STOOD (review of PR 806, medium 3): saved over a league
   * that HAS a mark, so each of the three things the box draws has an old value to be told from. The first league of
   * the served file has all three (the picture, its circle, and the small circle the server cut), and the box is
   * opened on it. After the save the picture is the chosen one, the circle is the one that was sent, and the small
   * circle is gone, since it is the server's to cut again and the old one is of the old picture; a box that kept
   * any of the three draws the old mark under the words „Znak je postavljen”.
   */
  it('draws what was saved, picture and circle, and not what stood, over a league that already has a mark', async () => {
    const user = setupUser()
    const asked = aServerThatTakes()
    const box = await theBox(1)
    const standing = must(document.querySelector('.leagues__mark-standing .leagues__mark img'), 'the mark that stands')

    expect(standing.getAttribute('src')).toBe('/mock/logo/runtrace-liga.small.svg')

    await chooseAPicture(box, user)
    /* A circle that is not the whole picture, which is what stood (`size: 1` in the served file). */
    fireEvent.change(box.getByLabelText('Veličina isečka'), { target: { value: '0.5' } })

    const chosen = box.getByAltText(sr.leagueMark.chosenAlt).getAttribute('src')

    await user.click(box.getByRole('button', { name: sr.leagueMark.save }))
    expect(await box.findByText(sr.leagueMark.saved)).toHaveAttribute('role', 'status')

    const drawn = must(
      document.querySelector<HTMLImageElement>('.leagues__mark-standing .leagues__mark img'),
      'the mark that stands now',
    )
    const body = must(writes(asked)[0], 'the write').init?.body
    const sent = body instanceof FormData ? [body.get('cropX'), body.get('cropY'), body.get('cropSize')].map(Number) : []
    const circle = fittedTo(cropIn({ x: sent[0], y: sent[1], size: sent[2] }))

    expect(chosen, 'the chooser showed no picture').toBeTruthy()
    expect(drawn.getAttribute('src'), 'the box draws the picture that stood, or the small circle of it').toBe(chosen)
    expect(drawn.style.objectPosition, 'the circle of the box is not the one that was sent').toBe(circle.objectPosition)
    expect(drawn.style.transform, 'the circle of the box is not the one that was sent').toBe(circle.transform)
    expect(
      fittedTo(cropIn({ x: 0.5, y: 0.5, size: 1 })).transform,
      'the circle that stood is the one that was sent, so this measures nothing',
    ).not.toBe(circle.transform)
  }, SLOW)

  it.each([
    ['a frozen season', 409, 'theSeasonIsFrozen', sr.admin.leagueSaveRefused.theSeasonIsFrozen],
    ['a file that is not a picture', 400, 'thisIsNotAPicture', sr.picture.sendRefused.thisIsNotAPicture],
    ['a picture too big', 400, 'thePictureIsTooBig', sr.picture.sendRefused.thePictureIsTooBig],
  ])('says what the server refused for %s, in its own sentence, and keeps what stood', async (_, status, reason, said) => {
    const user = setupUser()

    aServerThatTakes(() => json({ reason }, status))

    const box = await theBox(2)

    await chooseAPicture(box, user)

    const dropped = timesDropped('leagues')

    await user.click(box.getByRole('button', { name: sr.leagueMark.save }))

    expect(await box.findByText(said)).toBeVisible()
    expect(timesDropped('leagues'), 'a refused write dropped the list of the leagues').toBe(dropped)
    expect(box.queryByText(sr.leagueMark.saved)).toBeNull()
    expect(box.getByText(sr.leagueMark.none)).toBeVisible()
  }, SLOW)

  it('takes the mark down at this league’s own address, behind the sheet, and draws the initials again', async () => {
    const user = setupUser()
    const asked = aServerThatTakes()
    const box = await theBox(1)

    await user.click(box.getByRole('button', { name: sr.leagueMark.remove }))
    await user.click(
      within(await screen.findByRole('dialog', { name: sr.leagueMark.removeAsks })).getByRole('button', {
        name: sr.admin.form.delete,
      }),
    )

    expect(await box.findByText(sr.leagueMark.removed)).toHaveAttribute('role', 'status')
    expect(box.getByText(sr.leagueMark.none)).toBeVisible()
    expect(must(document.querySelector('.leagues__mark-standing .leagues__mark'), 'the mark').textContent).toBe('RT')
    expect(box.queryByRole('button', { name: sr.leagueMark.remove })).toBeNull()
    expect(writes(asked).map((one) => [one.path, one.init?.method])).toEqual([['/api/leagues/1/logo', 'DELETE']])
  }, SLOW)

  it('keeps the mark where the server refused to take it down, and says why', async () => {
    const user = setupUser()

    aServerThatTakes((_, method) => (method === 'DELETE' ? json({ reason: 'theSeasonIsFrozen' }, 409) : null))

    const box = await theBox(1)

    await user.click(box.getByRole('button', { name: sr.leagueMark.remove }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: sr.admin.form.delete }))

    expect(await box.findByText(sr.admin.leagueSaveRefused.theSeasonIsFrozen)).toBeVisible()
    expect(box.getByText(sr.leagueMark.standing)).toBeVisible()
  }, SLOW)
})
