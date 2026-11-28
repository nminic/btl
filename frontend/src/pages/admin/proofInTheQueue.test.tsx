import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NO_RATING, type ServedPendingItem } from '../../data/types'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { QUEUE } from './queues'

/* EVERY WAIT HAS HALF THE CASE'S CLOCK (`saveWhileSaving.test.tsx`'s arrangement, CLAUDE.md section 25), so a
   wait that does not come true fails on its own assertion and never on the clock of the case. */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE PICTURE SENT AS THE PROOF OF A RUN, IN THE QUEUE OF RESULTS.
 *
 * <p>The owner, 28.09.2026, the outcome he chose and carried out on 28.11.2026: „moderator ih vidi uz rezultat u
 * redu za proveru". And PDL, „Dokaz uz rezultat (DK)": „Slika dokaza koja ne može da se učita drži „Odobri"
 * onemogućenim". The route asks every decision about a row that holds a picture to name the picture the
 * moderator saw (`VerificationWriteApi`), so every door of this queue names it.
 *
 * <p><b>Two pictures on two rows, and a row with none</b>, so a decision that named the first picture it found,
 * or a picture on a row that has none, is told apart from one that names its own.
 */

const PATH = `/sr/${QUEUE.results.path}`

const RUNNER = '000010'

const A_RUN = {
  queue: 'results' as const,
  subjectId: '',
  city: '',
  country: '',
  rating: NO_RATING,
  kind: '' as const,
  raceDate: '2027-03-06',
  raceKind: 'length',
  distanceKm: 10,
  ascentM: 50,
  descentM: 40,
  seconds: 3300,
  link: '',
  eventId: null,
  eventName: null,
  eventKind: null,
}

const WHOLE = { x: 0.5, y: 0.5, size: 1 }

const WITH_A_PICTURE: ServedPendingItem = {
  ...A_RUN,
  id: 711,
  date: '2027-03-08',
  memberNumber: RUNNER,
  who: 'Ana Anić',
  subject: 'Beogradska desetka',
  body: 'Sat pokazuje 55:00',
  raceId: 11,
  photoId: 55,
  crop: WHOLE,
}

const WITH_ANOTHER_PICTURE: ServedPendingItem = {
  ...A_RUN,
  id: 712,
  date: '2027-03-09',
  memberNumber: '000020',
  who: 'Bojan Bojić',
  subject: 'Novosadska desetka',
  body: 'Diploma',
  raceId: 12,
  photoId: 66,
  crop: WHOLE,
}

const WITH_NONE: ServedPendingItem = {
  ...A_RUN,
  id: 713,
  date: '2027-03-10',
  memberNumber: '000030',
  who: 'Vera Verić',
  subject: 'Niška desetka',
  body: '',
  raceId: 13,
  link: 'https://primer.rs/nis',
  photoId: null,
  crop: null,
}

const THE_OTHER_TABS: unknown[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'verification.json'), 'utf-8'),
)

const answering = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function serverWith(runs: ServedPendingItem[]): { asked: Asked[]; stop: () => void } {
  return serverThat((path, init) => {
    if (path === '/api/verification' && (init?.method ?? 'GET') === 'GET') {
      return answering([...runs, ...THE_OTHER_TABS])
    }

    return /^\/api\/verification\/[^/]+\/decision$/.test(path) && init?.method === 'POST'
      ? answering({ id: 1, state: 'approved' })
      : null
  })
}

const decisionsIn = (asked: Asked[]): Asked[] => asked.filter((one) => one.path.endsWith('/decision'))

const bodyOf = (one: Asked | undefined): unknown => JSON.parse(String(one?.init?.body ?? 'null'))

async function rowOf(memberNumber: string) {
  const table = await screen.findByRole('table', { name: sr.review.waiting })

  return within(must(within(table).getByText(memberNumber).closest('tr'), `the row of ${memberNumber}`))
}

const proofOf = (who: string) => sr.review.proofAlt.replace('{who}', who)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the picture sent as proof, in the queue of results', () => {
  it('is drawn on its own row and opens whole at the address that carries its key', async () => {
    const server = serverWith([WITH_A_PICTURE, WITH_ANOTHER_PICTURE, WITH_NONE])

    try {
      renderAt(PATH, 'superadmin', RUNNER, undefined, null)

      const picture = (await rowOf(RUNNER)).getByRole('img', { name: proofOf('Ana Anić') })

      expect(picture).toHaveAttribute('src', '/api/verification/711/photo?photo=55')
      expect(picture.closest('a')).toHaveAttribute('href', '/api/verification/711/photo?photo=55')
      expect(picture.closest('a')).toHaveAttribute('target', '_blank')
      expect((await rowOf('000020')).getByRole('img', { name: proofOf('Bojan Bojić') })).toHaveAttribute(
        'src',
        '/api/verification/712/photo?photo=66',
      )
      expect((await rowOf('000030')).queryByRole('img')).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('waits for its picture before it approves, and then names the picture it drew', async () => {
    const user = setupUser()
    const server = serverWith([WITH_A_PICTURE, WITH_ANOTHER_PICTURE, WITH_NONE])

    try {
      renderAt(PATH, 'superadmin', RUNNER, undefined, null)

      const row = await rowOf(RUNNER)
      const approve = row.getByRole('button', { name: sr.review.approve })

      expect(approve).toHaveAttribute('aria-disabled', 'true')
      await user.click(approve)
      expect(decisionsIn(server.asked)).toHaveLength(0)

      /* And no box for a refusal opens over a picture still on its way. */
      expect(row.getByRole('button', { name: sr.review.sendBack })).toHaveAttribute('aria-disabled', 'true')
      await user.click(row.getByRole('button', { name: sr.review.sendBack }))
      expect(screen.queryByLabelText(new RegExp(`^${sr.review.reason}`))).toBeNull()

      /* The OTHER row's picture arrives first, and this row's approval still waits for its own. */
      fireEvent.load((await rowOf('000020')).getByRole('img'))
      await user.click(approve)
      expect(decisionsIn(server.asked)).toHaveLength(0)

      fireEvent.load(row.getByRole('img'))
      await waitFor(() => {
        expect(approve).toHaveAttribute('aria-disabled', 'false')
      })
      await user.click(approve)

      await waitFor(() => {
        expect(decisionsIn(server.asked)).toHaveLength(1)
      })

      const sent = must(decisionsIn(server.asked)[0], 'the decision')

      expect(sent.path).toBe('/api/verification/711/decision')
      expect(bodyOf(sent)).toEqual({ approved: true, reason: '', seenPhotoId: 55, seenCrop: WHOLE })
    } finally {
      server.stop()
    }
  }, SLOW)

  it('cannot be approved where its picture will not load, and is refused naming it', async () => {
    const user = setupUser()
    const server = serverWith([WITH_A_PICTURE, WITH_NONE])

    try {
      renderAt(PATH, 'superadmin', RUNNER, undefined, null)

      fireEvent.error((await rowOf(RUNNER)).getByRole('img'))

      const row = await rowOf(RUNNER)

      expect(await row.findByText(sr.verification.pictureUnavailable)).toBeVisible()
      expect(row.getByRole('button', { name: sr.review.approve })).toHaveAttribute('aria-disabled', 'true')
      await user.click(row.getByRole('button', { name: sr.review.approve }))
      expect(decisionsIn(server.asked)).toHaveLength(0)

      await user.click(row.getByRole('button', { name: sr.review.sendBack }))
      await user.type(screen.getByLabelText(new RegExp(`^${sr.review.reason}`)), 'Slika se ne otvara.')
      await user.click(screen.getByRole('button', { name: sr.review.confirmSendBack }))

      await waitFor(() => {
        expect(decisionsIn(server.asked)).toHaveLength(1)
      })
      expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({
        approved: false,
        reason: 'Slika se ne otvara.',
        seenPhotoId: 55,
        seenCrop: WHOLE,
      })
    } finally {
      server.stop()
    }
  }, SLOW)

  it('names no picture on a row that holds none', async () => {
    const user = setupUser()
    const server = serverWith([WITH_A_PICTURE, WITH_NONE])

    try {
      renderAt(PATH, 'superadmin', RUNNER, undefined, null)

      await user.click((await rowOf('000030')).getByRole('button', { name: sr.review.approve }))

      await waitFor(() => {
        expect(decisionsIn(server.asked)).toHaveLength(1)
      })
      expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({ approved: true, reason: '' })
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is stepped over by the sweep until it has been seen, and then swept naming its own picture', async () => {
    const user = setupUser()
    const server = serverWith([WITH_A_PICTURE, WITH_ANOTHER_PICTURE, WITH_NONE])
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      renderAt(PATH, 'superadmin', RUNNER, undefined, null)

      fireEvent.load((await rowOf('000020')).getByRole('img'))
      await user.click(await screen.findByRole('button', { name: 'Odobri sve' }))

      await waitFor(() => {
        expect(decisionsIn(server.asked)).toHaveLength(2)
      })

      expect(decisionsIn(server.asked).map((one) => [one.path, bodyOf(one)])).toEqual([
        ['/api/verification/712/decision', { approved: true, reason: '', seenPhotoId: 66, seenCrop: WHOLE }],
        ['/api/verification/713/decision', { approved: true, reason: '' }],
      ])
      expect(screen.getByText(RUNNER)).toBeInTheDocument()
    } finally {
      server.stop()
    }
  }, SLOW)
})
