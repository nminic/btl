import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { did, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/* MEASUREMENT PROBE for b130. Not a guard yet: it reproduces the state QA was in
   and reads which card reaches the route. */

const DISC = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/verification.json'), 'utf-8'),
) as Record<string, unknown>[]

const A_PHOTO_ROW = must(
  DISC.find((one) => one.queue === 'profiles' && one.kind === 'photo'),
  'a picture already waiting in the file',
)

/* THE ROW THE SERVER REALLY HAS after `POST /api/me/photo` succeeded, which is what
   the QA database showed: `2|waiting|photo_id 2`. Its body is deliberately NOT the
   name of the file the browser sent, so that the two cards about one upload can be
   told apart by what they say rather than by the order they happen to be in. */
const THE_SERVER_ROW = {
  ...A_PHOTO_ROW,
  id: 2,
  memberNumber: '000007',
  who: 'Strahinja Vukićević',
  subject: 'Strahinja Vukićević',
  body: 'sa-servera.jpg',
  photoId: 2,
}

const decisionsIn = (asked: Asked[]): Asked[] =>
  asked.filter((one) => one.path.includes('/decision'))

const theQueue = () =>
  serverThat((path, init) => {
    if (path === '/api/me/photo' && init?.method === 'POST') {
      return did()
    }

    if (path === '/api/verification' && init?.method === undefined) {
      return new Response(JSON.stringify([...DISC, THE_SERVER_ROW]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (init?.method === 'POST' && path.includes('/decision')) {
      return new Response(JSON.stringify({ id: 2, state: 'rejected' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    return null
  })

const panelFor = async () => within(await screen.findByRole('region', { name: 'Profilna slika' }))

const cardSaying = (what: string | RegExp) =>
  within(must(screen.getByText(what).closest('li'), 'the card that text stands in'))

async function uploadAndOpenTheQueue(user: ReturnType<typeof setupUser>) {
  const { router } = renderAt('/sr/podesavanja', 'superadmin', '000007')
  const panel = await panelFor()

  await user.upload(await panel.findByLabelText(/Izaberi novu sliku/), new File(['slika'], 'nova-slika.jpg', { type: 'image/jpeg' }))
  await measurePicture()
  await panel.findByLabelText('Veličina isečka')
  await user.click(panel.getByRole('button', { name: 'Pošalji na odobrenje' }))
  await waitFor(() => (expect(screen.getByText(/čeka odobrenje/)).toBeVisible()))

  await router.navigate('/sr/administracija/verifikacija/trkacki-profil')
  await screen.findByRole('list', { name: /Čeka/ })
}

async function refuse(card: ReturnType<typeof cardSaying>, user: ReturnType<typeof setupUser>) {
  await user.click(card.getByRole('button', { name: 'Odbij' }))
  await user.type(await screen.findByLabelText(/^Razlog odbijanja/), 'Slika je mutna.')
  await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))
}

describe('b130: one upload, two cards', () => {
  it('draws the member twice on the profiles queue: the server row and a twin this visit minted', async () => {
    const user = setupUser()
    const server = theQueue()

    try {
      await uploadAndOpenTheQueue(user)

      expect(screen.getAllByRole('heading', { name: 'Strahinja Vukićević' })).toHaveLength(2)
      expect(screen.getByText(/sa-servera\.jpg/)).toBeVisible()
      expect(screen.getByText(/nova-slika\.jpg/)).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('sends a refusal of the SERVER row to the route', async () => {
    const user = setupUser()
    const server = theQueue()

    try {
      await uploadAndOpenTheQueue(user)
      await refuse(cardSaying(/sa-servera\.jpg/), user)

      const sent = decisionsIn(server.asked)

      expect(sent.map((one) => one.path)).toEqual(['/api/verification/2/decision'])
      expect(JSON.parse(String(sent[0]?.init?.body ?? 'null'))).toEqual({
        approved: false,
        reason: 'Slika je mutna.',
      })
    } finally {
      server.stop()
    }
  }, SLOW)

  it('sends NOTHING when the twin is refused, and tells the member all the same', async () => {
    const user = setupUser()
    const server = theQueue()

    try {
      await uploadAndOpenTheQueue(user)
      await refuse(cardSaying(/nova-slika\.jpg/), user)

      expect(decisionsIn(server.asked)).toHaveLength(0)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('sends NOTHING when the twin is APPROVED either, so the act is not what parts them', async () => {
    const user = setupUser()
    const server = theQueue()

    try {
      await uploadAndOpenTheQueue(user)
      await cardSaying(/nova-slika\.jpg/).getByRole('button', { name: 'Odobri' }).click()
      await waitFor(() => (expect(screen.queryByText(/nova-slika\.jpg/)).toBeNull()))

      expect(decisionsIn(server.asked)).toHaveLength(0)
    } finally {
      server.stop()
    }
  }, SLOW)
})
