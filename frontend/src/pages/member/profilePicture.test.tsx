import sr from '../../i18n/sr.json'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { closestIn } from '../../components/crop'
import type { PendingItem } from '../../data/types'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { type Asked, did, refused, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { AS_FINE_AS_THE_COLUMN } from './photoWrites'

/* Changing the picture on a profile, after joining.
 *
 * Owner, 12.08.2026: „Članovi treba da imaju mogućnost da promene ili obrišu
 * fotografiju naknadno tokom korišćenja sajta. Tad se samo fotografija šalje na
 * odobrenje Adminu ili moderatoru sa adekvatnim pravima."
 *
 * The first version of these tests passed for the wrong reason, and the review
 * that found it is why this comment is here. „Send it, go away, come back" was
 * written with `router.navigate`, which in this suite does not unmount the
 * screen: the panel never left, so what looked like reading the queue afresh was
 * one component holding its own state. Replacing the whole queue check with a
 * plain `useState` left every test green.
 *
 * So nothing here navigates in order to prove that. What has to be read off the
 * queue is proved by rendering where the queue already holds something, which is
 * what the file on disc is for.
 */
const queue: PendingItem[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/verification.json'), 'utf-8'),
)

/** Somebody whose picture is already waiting, taken out of the file rather than
 *  named here: if the seed ever changes, this says so instead of passing. */
const waiting = must(
  queue.find((one) => one.queue === 'profiles' && one.kind === 'photo'),
  'a picture already waiting in the file',
)

const anImage = () => new File(['slika'], 'nova-slika.jpg', { type: 'image/jpeg' })

const panelFor = async () => within(await screen.findByRole('region', { name: 'Profilna slika' }))

/**
 * A PHOTOGRAPH WHOSE SMALLEST CIRCLE IS ROUND TO NOBODY, and the value one step of the
 * slider really lands on inside it.
 *
 * <p><b>This is the crop axis's other state, and without it every case here would pass over
 * a screen that sent its fractions raw.</b> An untouched frame is `WHOLE` - `0.5`, `0.5` and
 * `1` - and all three of those survive `MePhotoApi`'s `setScale(8, UNNECESSARY)` untouched,
 * so a fixture that only ever presses „Pošalji" measures nothing about the arithmetic. On
 * this shape the slider has no round value anywhere on it: its floor is `closestIn`, and
 * every position is the floor plus some multiple of `0.01`, none of them exact in binary.
 *
 * <p>Derived from the portal's own `closestIn` rather than typed out, so a change to
 * `SMALLEST_PIXELS` moves it instead of leaving a number behind. Measured on this machine:
 * seventeen decimal places, and jsdom hands the value to the control verbatim rather than
 * snapping it to the step, which is what a browser on a non-round `min` does too.
 */
const AN_AWKWARD_SHAPE = { width: 1234, height: 1600 }

const ONE_STEP_ALONG_IT = closestIn(AN_AWKWARD_SHAPE) + 0.01

/** Only the sends. `askTheServer` reads `/api/countries` to be handed the token, and that
 *  read goes through the very same recording server, so a case that counted everything it
 *  was asked for would be satisfied by the token read alone. */
const sends = (asked: Asked[]): Asked[] =>
  asked.filter((one) => one.path === '/api/me/photo' && one.init?.method === 'POST')

/** The one body a send carried, refusing anything that is not a `FormData`: a body this
 *  file could read parts off while the screen sent JSON would be a case measuring itself. */
function partsOf(sent: Asked): FormData {
  const body = sent.init?.body

  if (!(body instanceof FormData)) {
    throw new Error(`the picture was sent as ${typeof body} and not as a multipart body`)
  }

  return body
}

describe('the picture on a profile, changed later', () => {
  it('sends it to the server, as a file and three fractions, and refuses until one is chosen',
    async () => {
      /* THE CASE THIS BRANCH EXISTS FOR, AND THE ONE THING IT MUST NOT DO IS READ THE
         PANEL FOR ITS ANSWER. Until 26.09.2026 this screen wrote the picture into the
         session overlay and sent nothing: measured on the QA database the day the branch
         was opened, `photo` held nought rows and the queue nought, after the owner had
         chosen a photograph and approved it. The panel looked exactly the same then as it
         does now - „čeka odobrenje", focus moved, a card in the moderator's queue - so
         every assertion about the SENDING is read off the recording server. */
      const { asked, stop } = serverThat((path, init) =>
        path === '/api/me/photo' && init?.method === 'POST' ? did() : null,
      )
      const user = setupUser()

      renderAt('/sr/podesavanja', 'competitor', '000007')

      const panel = await panelFor()
      const send = await panel.findByRole('button', { name: 'Pošalji na odobrenje' })

      /* Told off rather than switched off: reachable, and saying why. */
      expect(send).toHaveAttribute('aria-disabled', 'true')
      expect(send).not.toBeDisabled()
      expect(send).toHaveAccessibleDescription('Izaberi sliku da bi mogao da je pošalješ.')

      /* Pressed with nothing chosen: reachable means pressable, so the refusal
         lives in the handler too. */
      await user.click(send)

      expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
      /* And nothing left the browser over a press the screen itself refused. */
      expect(sends(asked)).toEqual([])

      await user.upload(await panel.findByLabelText(/Izaberi novu sliku/), anImage())
      await measurePicture(AN_AWKWARD_SHAPE.width, AN_AWKWARD_SHAPE.height)
      /* Waited for rather than assumed. The browser reads the file off the disc
         and hands it back a tick later, and the cropper is what says it has: sent
         before that, the picture would be a name with nothing behind it. */
      const size = await panel.findByLabelText('Veličina isečka')

      /* MOVED, so the crop is not the one an untouched frame gives. `fireEvent` and not
         `user-event`, which refuses to work an arrow on a `range` control - the cost A17
         writes down for choosing a native slider. The value is the one a real slider on
         this shape lands on. */
      fireEvent.change(size, { target: { value: String(ONE_STEP_ALONG_IT) } })

      await user.click(panel.getByRole('button', { name: 'Pošalji na odobrenje' }))

      const told = await waitFor(() => (screen.getByText(/čeka odobrenje/)))

      expect(told).toBeVisible()
      /* And the reader is taken to what replaced the control they pressed, rather
         than dropped on the body with nothing announced. */
      expect(told).toHaveFocus()

      /* THE PICTURE ITSELF, SHOWN BACK AT HIM WHILE HE WAITS (PDL.md:7582, owner
         24.09.2026: „Dok slika čeka odobrenje, član vidi svoju novu sliku sa oznakom da
         čeka"). Read by the alt `CropWindow` gives it, `picture.sentAlt`, which only the
         waiting branch of this screen ever sets - the chooser above it uses `chosenAlt`
         instead, and the two never stand together. Without this a review measured that
         three mutations over the block that draws it - a dead `&& false &&`, the
         proposal's `picture` field replaced by `''`, and the whole conditional deleted
         outright - all passed with nothing here to catch them, because coverage of a
         branch that no longer exists is not coverage of anything. */
      expect(panel.getByRole('img', { name: sr.picture.sentAlt })).toBeVisible()

      /* ONE SEND, AT THAT ADDRESS, WITH THAT VERB. Asked this narrowly because the token
         read goes through this same server: a case that counted requests would have been
         satisfied by `/api/countries`. */
      expect(sends(asked)).toHaveLength(1)

      const parts = partsOf(must(sends(asked)[0], 'the send'))

      /* The file itself, and it is the one the member chose rather than something built
         out of the data URL the cropper drew. */
      const picture = parts.get('picture')

      expect(picture).toBeInstanceOf(File)
      expect(picture instanceof File ? picture.name : '').toBe('nova-slika.jpg')

      /* THE THREE FRACTIONS, EACH AS FINE AS THE COLUMN AND NO FINER. `MePhotoApi.fraction`
         throws on a ninth decimal place rather than rounding, and answers
         `theCropIsNotACircle`; the value the slider is holding has seventeen. So this is
         the assertion that says the screen sent a crop the database can keep, and the one
         below says the case really put an awkward number in front of it. */
      for (const which of ['cropX', 'cropY', 'cropSize'] as const) {
        const written = String(parts.get(which))
        const places = /^\d+\.(\d+)$/.exec(written)?.[1]?.length ?? 0

        expect(places, `${which} was sent as ${written}`).toBeLessThanOrEqual(
          AS_FINE_AS_THE_COLUMN,
        )
      }

      /* AND THE SIZE REALLY IS THE ONE THAT WAS MOVED, read off its own axis. Without this
         the loop above is satisfied by a screen that sent `0.5` three times: the two
         positions were never touched, so they are round on their own. */
      expect(Number(parts.get('cropSize'))).toBeCloseTo(ONE_STEP_ALONG_IT, 8)
      /* Spelt out so the reader can see the case is not measuring a round number: raw, that
         value is finer than the column and the route would have refused it. */
      expect(String(ONE_STEP_ALONG_IT).split('.')[1]?.length ?? 0).toBeGreaterThan(
        AS_FINE_AS_THE_COLUMN,
      )

      stop()
    }, SLOW)

  it('downloads nothing about anybody else to say what is waiting', async () => {
    /* Why a picture sent on an earlier visit is not counted, held as a test
       rather than as a sentence. The only place it is written is the whole
       verification queue: names and postal addresses of people who are not
       members yet, and the words of comments nobody has approved. Reading it
       here would download all of that into a member`s browser.
     *
       So the panel knows about this visit, and with a database it will ask one
       question about one member. Until then the cost is not the moderator's - a
       review of PR 381 (27.09.2026) measured that `proposals` lives in `useState`
       (`SessionProvider.tsx`), so this very overlay is gone the moment the tab is
       reloaded while the row it cannot see stays open on the server: the member
       who sent it meets `picture.none` on the next visit as though he had sent
       nothing, sends again, and is refused `aPictureAlreadyWaits`. No card is
       what is missing then, not a second one, which is written down rather than
       left to be found (PENDING, and PDL P22). */
    const asked: string[] = []
    const real = globalThis.fetch

    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      asked.push(String(input))

      return real(input, init)
    }

    try {
      renderAt('/sr/podesavanja', 'competitor', waiting.memberNumber)

      await panelFor()

      expect(asked.filter((one) => one.includes('verification'))).toEqual([])
    } finally {
      globalThis.fetch = real
    }
  })
  it('lets the member send another once a moderator has decided', async () => {
    /* A decision is what ends the waiting. Read without it, somebody whose
       picture had just been approved was still told to wait, with no control at
       all and no way out of it. */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/administracija/verifikacija/trkacki-profil',
      'superadmin',
      waiting.memberNumber,
    )

    const heading = await screen.findByRole('heading', { name: waiting.subject })
    const card = must(heading.closest('li'), 'the card the heading stands in')

    await user.click(within(card).getByRole('button', { name: 'Odobri' }))
    await router.navigate('/sr/podesavanja')

    const panel = await panelFor()

    expect(await panel.findByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
    expect(panel.queryByText(/čeka odobrenje/)).not.toBeInTheDocument()
  })

  it('reaches the moderator as a picture, under the member it belongs to', async () => {
    /* The queue holds two sorts and decides them differently. Sent as the wrong
       sort, or under the wrong number, the instruction telling somebody what to
       change reaches the wrong inbox: `memberNumber` is what decides that
       (pages/admin/queues.ts). Both are read off the card here, because the
       earlier version of this test checked neither and passed through both.

       THE CARD IS STILL THE PORTAL'S OWN OVERLAY and this case is why the session is
       still written at all: the moderator's queue is drawn out of it, so the flow the
       owner asked for stays walkable end to end. What changed on 26.09.2026 is WHEN it
       is written - only inside the arm an answer authorised - and the case below is the
       other half of that pair. */
    const { stop } = serverThat((path, init) =>
      path === '/api/me/photo' && init?.method === 'POST' ? did() : null,
    )
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'superadmin', '000007')

    const panel = await panelFor()

    await user.upload(await panel.findByLabelText(/Izaberi novu sliku/), anImage())
    await measurePicture()
    /* Waited for, as above. Without this the send is pressed while the browser
       is still reading the file and nothing is sent at all: it passed on this
       machine, alone, and failed the moment the whole suite ran beside it. */
    await panel.findByLabelText('Veličina isečka')
    await user.click(panel.getByRole('button', { name: 'Pošalji na odobrenje' }))
    await waitFor(() => (expect(screen.getByText(/čeka odobrenje/)).toBeVisible()))

    stop()
    await router.navigate('/sr/administracija/verifikacija/trkacki-profil')

    const heading = await screen.findByRole('heading', { name: 'Strahinja Vukićević' })
    const card = must(heading.closest('li'), 'the card the heading stands in')

    expect(within(card).getByText(/nova-slika\.jpg/)).toBeVisible()
    expect(within(card).getByText(/000007/)).toBeVisible()
    /* The decision offered is the one for a picture: handed back with an
       instruction precise enough to work from, rather than the plain reason a
       text is refused with (PDL P22). */
    expect(within(card).getByRole('button', { name: 'Odobri' })).toBeVisible()
    /* The word left the dictionary with the decision (PDL P22), so asking the
       screen for it can no longer fail on its own; the dictionary is asked with
       it, which is where it would have to reappear. */
    expect(within(card).queryByRole('button', { name: 'Objavi' })).not.toBeInTheDocument()
    expect(JSON.stringify(sr.verification)).not.toContain('Objavi')
  })

  it('says what the server refused, and puts nothing in front of a moderator', async () => {
    /* THE OTHER ARM OF THE FIRST AXIS, AND IT IS NOT READ OFF THIS PANEL.
     *
       The promise this screen's own class comment makes is that the session is written
       „only inside the branch an answer authorised", and the panel cannot hold that: it
       would look the same over a screen that wrote first and asked afterwards. The one
       place a wrongly-early write shows through is the moderator's queue, because that is
       what the overlay feeds - the same reasoning `AdminModerators.test.tsx` gives for
       reading the role switch rather than the table the screen draws itself.
     *
       The queue is read WITH a positive control beside the absence. A screen that drew
       nothing at all would satisfy „Strahinja is not here", so the card that was already
       in the file has to be there in the same breath. */
    const { stop } = serverThat((path, init) =>
      path === '/api/me/photo' && init?.method === 'POST'
        ? refused('aPictureAlreadyWaits', 409)
        : null,
    )
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'superadmin', '000007')

    const panel = await panelFor()

    await user.upload(await panel.findByLabelText(/Izaberi novu sliku/), anImage())
    await measurePicture()
    await panel.findByLabelText('Veličina isečka')
    await user.click(panel.getByRole('button', { name: 'Pošalji na odobrenje' }))

    /* The server's own reason, in the words the dictionary gives that reason, and never
       one sentence of ours over all five. */
    expect(await panel.findByRole('alert')).toHaveTextContent(
      sr.picture.sendRefused.aPictureAlreadyWaits,
    )
    /* The control is still there and still says what it did: a refusal he can act on is
       answered by choosing another file or by waiting, not by being told to wait. */
    expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
    expect(panel.queryByText(/čeka odobrenje/)).not.toBeInTheDocument()
    /* And the picture he chose is still chosen, so he is not asked to find it again over
       something that was not his mistake. */
    expect(panel.getByLabelText('Veličina isečka')).toBeVisible()

    stop()
    await router.navigate('/sr/administracija/verifikacija/trkacki-profil')

    /* The control: a card that was in the file before any of this. */
    expect(await screen.findByRole('heading', { name: 'Damjan Krstić' })).toBeVisible()
    /* And the thing that must not be there. */
    expect(screen.queryByRole('heading', { name: 'Strahinja Vukićević' })).not.toBeInTheDocument()
  }, SLOW)

  it('sends one picture and not two while the first is still on its way', async () => {
    /* `aria-disabled` is something SAID to a reader and not something the browser
       enforces, which is the portal's own rule about telling a control off rather than
       switching it off. So the second press has to be refused in the handler as well, and
       the only thing that can refuse it is a ref: state set during the first press is not
       readable by the second in the same turn.
     *
       What it costs when it is missing is measured on the server rather than guessed:
       `MePhotoApi` refuses a second picture while one waits, 409, so a double press puts
       one picture in front of a moderator and hands the member a refusal for his own. */
    let release: (answer: Response) => void = () => undefined
    const onItsWay = new Promise<Response>((resolve) => {
      release = resolve
    })
    const { asked, stop } = serverThat((path, init) =>
      path === '/api/me/photo' && init?.method === 'POST' ? onItsWay : null,
    )
    const user = setupUser()

    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = await panelFor()

    await user.upload(await panel.findByLabelText(/Izaberi novu sliku/), anImage())
    await measurePicture()
    await panel.findByLabelText('Veličina isečka')

    const send = panel.getByRole('button', { name: 'Pošalji na odobrenje' })

    await user.click(send)

    /* Told off while it is out, and the reason is on the screen rather than only in the
       attribute: a press that changes nothing visible cannot be told from one that did not
       land, least of all by ear. */
    await waitFor(() => (expect(send).toHaveAttribute('aria-disabled', 'true')))
    expect(send).toHaveAccessibleDescription(sr.picture.sending)
    expect(send).not.toBeDisabled()

    await user.click(send)
    await user.click(send)

    expect(sends(asked)).toHaveLength(1)

    release(did())

    const told = await waitFor(() => (screen.getByText(/čeka odobrenje/)))

    expect(told).toBeVisible()
    /* And one send it stays after the answer came back. */
    expect(sends(asked)).toHaveLength(1)

    stop()
  }, SLOW)

  it('is not held up by something else the member put forward', async () => {
    /* The queue holds what a member has put forward, of every sort. A team
       waiting for a decision is not a picture waiting for one, and reading the
       queue without asking which sort would leave somebody unable to change
       their photograph because they once proposed a team. */
    const user = setupUser()
    /* On a day inside the transfer window, because a team is founded only from 1
       October to 31 December (PDL, increment 133) and outside it this address is a
       redirect. The picture this case is about does not care about the day. */
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000002', undefined, '2026-10-15')

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/podesavanja')

    const panel = await panelFor()

    expect(await panel.findByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
  })

  it('draws no picture panel for a number the member list does not hold', async () => {
    /* A number handed out during this visit is not in the file the list is read
       from, and after the database arrives the two can be a moment apart for a
       hundred other reasons. The rest of the settings still work; there is
       simply no face to change. */
    renderAt('/sr/podesavanja', 'competitor', '999999')

    expect(await screen.findByRole('heading', { name: 'Podešavanja' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Profilna slika' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Tema' })).toBeVisible()
  })
})
