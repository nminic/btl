import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { useSession } from '../../session/useSession'

/**
 * ONE UPLOAD IS ONE ROW IN FRONT OF THE MODERATOR, AND HE DECIDES IT THROUGH THE ROUTE.
 *
 * <p><b>The owner met this himself on QA on 27.09.2026 and it is his sentence that sets the
 * measure:</b> „kad neko posalje sliku na odobrenje, zelim da dobijem jedan jedini red na
 * strani verifikacije gde cu videti tu sliku i odobriti njeno takvo postavljanje na profil
 * clana."
 *
 * <p><b>What he actually got.</b> He uploaded a picture, refused it with a reason, was shown
 * a refusal and a message in his inbox - and when he signed out and back in, none of it had
 * happened. Measured against the database and nginx afterwards: `verification` held the row
 * `2|waiting`, and in those four hours there was no `POST` to a decision route at all. His
 * approval an hour earlier HAD reached it.
 *
 * <p><b>The cause, and it was not the act.</b> `ProfilePicture.tsx` sent the picture to
 * `POST /api/me/photo` AND ALSO called `propose`, so one upload put a row of the browser's own
 * beside the row the server had just filed. `admin/pending.ts` merges the two lists, so the
 * moderator saw the member TWICE, the two cards alike in everything he could see. A decision
 * on the browser's copy is taken locally by construction - `isProposal`, in
 * `admin/PendingQueue.tsx`, because `prop-1` cannot reach a route that reads its id as
 * `@PathVariable long id` - and it is taken locally for an APPROVAL exactly as for a refusal.
 * The owner's approval reached the route because the served row is merged first and he pressed
 * that one; by the second upload the queue had already been read this visit, `data/client.ts`
 * fetches a resource once per visit and nothing cleared it, so the only card about that upload
 * was the browser's.
 *
 * <p><b>So the axes this file holds are the ones that fault was invisible to,</b> and each one
 * has both of its states here rather than one: approving beside refusing, the row the server
 * made beside a queue that has already been read once, and the member's own mark cleared by a
 * decision on HIS row beside one on somebody else's.
 *
 * <p><b>WHAT WAS NOT MEASURED, and it is reasoning rather than a measurement.</b> The three
 * widths (360, 768, 1280) were not walked for this change. The argument is that no element,
 * rule or wrapper moved: what left is a card the moderator's queue drew from a second source,
 * and the queue draws each card the same way whichever list it came out of, so a queue holding
 * one card where it held two is the same layout with one fewer item in it. The sending screen
 * lost nothing it draws - the waiting picture and its circle are still there (PDL 21b). This is
 * set down as an argument, not as a pass: side-scrolling is measured once at the end rather
 * than on a branch that does not touch the layout.
 */

/* Annotated rather than asserted, which is the shape `profilePicture.test.tsx` beside this
   already uses to read the same file (ADL A14 bans the assertion). */
const DISC: Record<string, unknown>[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/verification.json'), 'utf-8'),
)

const A_PHOTO_ROW = must(
  DISC.find((one) => one.queue === 'profiles' && one.kind === 'photo'),
  'a picture already waiting in the file',
)

/** SOMEBODY ELSE'S PICTURE, waiting on the same queue throughout. Taken out of the file
 *  rather than named here, and it is the third party every case needs: a mark that cleared
 *  on any decision at all would pass every case that only ever had one row to decide. */
const SOMEBODY_ELSE = must(
  DISC.find((one) => one !== A_PHOTO_ROW && one.queue === 'profiles' && one.kind === 'photo'),
  'a second picture waiting in the file',
)

/** THE ROW THE SERVER FILES for the upload, as the QA database really held it
 *  (`2|waiting|photo_id 2`). Its body is not the name of the file the browser sent, so that
 *  a card drawn from the server can be told from one drawn from the session. */
const THE_SERVER_ROW = {
  ...A_PHOTO_ROW,
  id: 2,
  memberNumber: '000007',
  who: 'Strahinja Vukićević',
  subject: 'Strahinja Vukićević',
  body: 'sa-servera.jpg',
  photoId: 2,
  /* The circle the server answers for it, neither the whole picture nor the file's constant:
     what the decision below names has to be this and nothing the screen makes up. */
  crop: { x: 0.2, y: 0.4, size: 0.6 },
}

/** What `MePhotoApi.Waiting` answers with: the key of the queue row it just filed, and two
 *  digests this side deliberately does not read (`photoWrites.ts`). */
const THE_ROUTE_NAMES_THE_ROW = { waiting: 2, digest: 'abc', standing: null }

const decisionsIn = (asked: Asked[]): Asked[] =>
  asked.filter((one) => one.path.includes('/decision'))

/**
 * The portal as QA had it: the picture is accepted, the row appears in the queue FROM THAT
 * MOMENT and not before, and a decision is recorded.
 *
 * <p>The row is added only once the upload has answered, rather than standing in the list
 * from the start, because a list that already held it would let „the queue shows one row"
 * pass off a read taken before the member had sent anything.
 */
const theServer = (answers: unknown = THE_ROUTE_NAMES_THE_ROW) => {
  let uploaded = false

  return serverThat((path, init) => {
    if (path === '/api/me/photo' && init?.method === 'POST') {
      uploaded = true

      return new Response(JSON.stringify(answers), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (path === '/api/verification' && init?.method === undefined) {
      return new Response(JSON.stringify(uploaded ? [...DISC, THE_SERVER_ROW] : DISC), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (init?.method === 'POST' && path.includes('/decision')) {
      return new Response(JSON.stringify({ id: 2, state: 'decided' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    return null
  })
}

const panelFor = async () => within(await screen.findByRole('region', { name: 'Profilna slika' }))

/**
 * SOMEBODY ELSE SIGNING IN DURING THE SAME VISIT, through the portal's own live writer.
 *
 * <p>`theServerSignedMeIn` and not a fake session, because the fault this drives lives in
 * what that writer does and does not clear: it is the very call `member/SignIn.tsx` makes
 * with the answer to `GET /api/me`, and the comment over it names this road - „a value kept
 * from the person before is a value shown to the person after". A test that built a session
 * object by hand would be measuring its own object.
 *
 * <p>Reachable without a reload, which is why the road is real: `SessionProvider` is mounted
 * above the router so it never comes down, and the sign in screen can be walked to while
 * somebody is signed in. A shared laptop at a race is the ordinary case.
 */
function SignInAs({ memberNumber }: { memberNumber: string }) {
  const { theServerSignedMeIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        theServerSignedMeIn({
          account: 2,
          memberNumber,
          country: null,
          firstSeason: null,
          teamId: null,
          membershipBasis: null,
          referralCode: null,
          referredCount: null,
        })
      }}
    >
      sign in somebody else
    </button>
  )
}

const THE_QUEUE = '/sr/administracija/verifikacija/trkacki-profil'

/** Sends a picture from the settings screen, as a member who may also moderate - which is
 *  what the owner is, and the one session in which both halves of this are reachable. */
async function send(user: ReturnType<typeof setupUser>, at = '/sr/podesavanja') {
  const { router } = renderAt(at, 'superadmin', '000007')

  if (at !== '/sr/podesavanja') {
    await screen.findByRole('list', { name: /Čeka/ })
    await router.navigate('/sr/podesavanja')
  }

  const panel = await panelFor()

  await user.upload(
    await panel.findByLabelText(/Izaberi novu sliku/),
    new File(['slika'], 'nova-slika.jpg', { type: 'image/jpeg' }),
  )
  await measurePicture()
  await panel.findByLabelText('Veličina isečka')
  await user.click(panel.getByRole('button', { name: 'Pošalji na odobrenje' }))
  await waitFor(() => (expect(screen.getByText(/čeka odobrenje/)).toBeVisible()))

  return router
}

const cardOf = (name: string) =>
  within(must(screen.getByRole('heading', { name }).closest('li'), 'the card of ' + name))

describe('a picture sent for a decision', () => {
  it('stands in front of the moderator as ONE row, and it is the row the server filed', async () => {
    const user = setupUser()
    const server = theServer()

    try {
      const router = await send(user)

      await router.navigate(THE_QUEUE)
      await screen.findByRole('list', { name: /Čeka/ })

      /* One heading and not two, which is the owner's sentence itself. */
      expect(screen.getAllByRole('heading', { name: 'Strahinja Vukićević' })).toHaveLength(1)
      /* And it is the SERVER'S row: the body it carries is the one the answer held, not the
         name of the file this browser sent. A screen still minting its own card would draw
         `nova-slika.jpg` here, which is what it drew until 27.09.2026. */
      expect(screen.getByText(/sa-servera\.jpg/)).toBeVisible()
      expect(screen.queryByText(/nova-slika\.jpg/)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('reaches the route when it is REFUSED, which is the half that never did', async () => {
    const user = setupUser()
    const server = theServer()

    try {
      const router = await send(user)

      await router.navigate(THE_QUEUE)
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Strahinja Vukićević').getByRole('button', { name: 'Odbij' }))
      await user.type(await screen.findByLabelText(/^Razlog odbijanja/), 'Slika je mutna.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      const sent = decisionsIn(server.asked)

      /* The address names the row, so this also says WHICH row was decided. */
      expect(sent.map((one) => one.path)).toEqual(['/api/verification/2/decision'])
      expect(JSON.parse(String(sent[0]?.init?.body ?? 'null'))).toEqual({
        approved: false,
        reason: 'Slika je mutna.',
        seenPhotoId: 2,
        seenCrop: { x: 0.2, y: 0.4, size: 0.6 },
      })
    } finally {
      server.stop()
    }
  }, SLOW)

  it('reaches the route when it is APPROVED too, the other state of the same axis', async () => {
    const user = setupUser()
    const server = theServer()

    try {
      const router = await send(user)

      await router.navigate(THE_QUEUE)
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Strahinja Vukićević').getByRole('button', { name: 'Odobri' }))

      const sent = decisionsIn(server.asked)

      expect(sent.map((one) => one.path)).toEqual(['/api/verification/2/decision'])
      expect(JSON.parse(String(sent[0]?.init?.body ?? 'null'))).toEqual({
        approved: true,
        reason: '',
        seenPhotoId: 2,
        seenCrop: { x: 0.2, y: 0.4, size: 0.6 },
      })
    } finally {
      server.stop()
    }
  }, SLOW)

  it('appears on a queue this visit had ALREADY read once', async () => {
    /* The other half of the fault, and the reason the owner's second upload had no served
       card at all: `data/client.ts` fetches a resource once per visit. The walk starts at
       the queue on purpose, so the list is already held before the picture is sent. */
    const user = setupUser()
    const server = theServer()

    try {
      const router = await send(user, THE_QUEUE)

      await router.navigate(THE_QUEUE)
      await screen.findByRole('list', { name: /Čeka/ })

      expect(screen.getByText(/sa-servera\.jpg/)).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it("stops telling the member to wait once HIS row is decided, and not before", async () => {
    const user = setupUser()
    const server = theServer()

    try {
      const router = await send(user)

      await router.navigate(THE_QUEUE)
      await screen.findByRole('list', { name: /Čeka/ })

      /* SOMEBODY ELSE'S PICTURE FIRST, and this is the source swap the whole key rests on:
         a decision is filed under the id of the row it was about, so a mark read under a key
         of the browser's own - `prop-1`, which is what it was - could never be reached by it,
         and a mark cleared by ANY decision would be no key at all. */
      await user.click(cardOf(String(SOMEBODY_ELSE.who)).getByRole('button', { name: 'Odobri' }))
      await router.navigate('/sr/podesavanja')

      const stillWaiting = await panelFor()

      expect(stillWaiting.getByText(/čeka odobrenje/)).toBeVisible()

      await router.navigate(THE_QUEUE)
      /* Waited for by the heading of THIS card rather than by the list around it: the list is
         still in the document from the walk above, so a case that waited on it would read the
         queue as it stood before this navigation. */
      await screen.findByRole('heading', { name: 'Strahinja Vukićević' })
      await user.click(cardOf('Strahinja Vukićević').getByRole('button', { name: 'Odobri' }))
      await router.navigate('/sr/podesavanja')

      const panel = await panelFor()

      expect(await panel.findByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
      expect(panel.queryByText(/čeka odobrenje/)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is not shown to the NEXT member who signs in during the same visit', async () => {
    /* VISOK, review of PR 400. This branch took the member out of the reading: it replaced
       `one.memberNumber === me.memberNumber` (which `member/ProfileBio.tsx` still asks of the
       same fact, on the same screen family) with „there is one picture a visit can have
       sent", and **a visit is not a member**. Measured on the head of this branch before the
       fix: the second member was told a picture of his was waiting, WAS SHOWN THE FIRST
       MEMBER'S PHOTOGRAPH, and could not send one of his own.
     *
       The three assertions are the three states that were wrong, and the middle one is the
       fault rather than a symptom: what it reads by is the alt of the frame, so it fails on a
       picture drawn to the wrong person even if the sentence beside it were right. */
    const user = setupUser()
    const server = theServer()

    try {
      renderAt('/sr/podesavanja', 'superadmin', '000007', undefined, null, (
        <SignInAs memberNumber="000002" />
      ))

      const mine = await panelFor()

      await user.upload(
        await mine.findByLabelText(/Izaberi novu sliku/),
        new File(['slika'], 'nova-slika.jpg', { type: 'image/jpeg' }),
      )
      await measurePicture()
      await mine.findByLabelText('Veličina isečka')
      await user.click(mine.getByRole('button', { name: 'Pošalji na odobrenje' }))
      await waitFor(() => (expect(screen.getByText(/čeka odobrenje/)).toBeVisible()))

      await user.click(screen.getByRole('button', { name: 'sign in somebody else' }))

      const theirs = await panelFor()

      expect(theirs.queryByText(/čeka odobrenje/)).toBeNull()
      expect(theirs.queryByRole('img', { name: /Slika koju si poslao/ })).toBeNull()
      expect(await theirs.findByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('goes on telling the member to wait where the answer named no row', async () => {
    /* `MePhotoApi` answers the key on every success, so this is the shape of a route that
       changed rather than one the portal meets today. It is measured all the same, because
       the alternative branch is the one that decides what an unknown key does: no decision is
       ever filed under the empty string, so the mark stands for the rest of the visit. That
       is the direction that cannot mislead - the owner's reason for the mark is „da je ne
       salje tri puta" - and the route refuses a second picture 409 in any case. */
    const user = setupUser()
    const server = theServer({ digest: 'abc' })

    try {
      await send(user)

      const panel = await panelFor()

      expect(panel.getByText(/čeka odobrenje/)).toBeVisible()
      expect(panel.queryByRole('button', { name: 'Pošalji na odobrenje' })).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)
})
