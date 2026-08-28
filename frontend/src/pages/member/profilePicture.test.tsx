import sr from '../../i18n/sr.json'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import type { PendingItem } from '../../data/types'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'

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
  readFileSync(join(process.cwd(), 'public/mock/verification.json'), 'utf-8'),
)

/** Somebody whose picture is already waiting, taken out of the file rather than
 *  named here: if the seed ever changes, this says so instead of passing. */
const waiting = must(
  queue.find((one) => one.queue === 'profiles' && one.kind === 'photo'),
  'a picture already waiting in the file',
)

const anImage = () => new File(['slika'], 'nova-slika.jpg', { type: 'image/jpeg' })

const panelFor = async () => within(await screen.findByRole('region', { name: 'Profilna slika' }))

describe('the picture on a profile, changed later', () => {
  it('sends it for review, and refuses until one is chosen', async () => {
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

    await user.upload(await panel.findByLabelText(/Izaberi novu sliku/), anImage())
    await measurePicture()
    /* Waited for rather than assumed. The browser reads the file off the disc
       and hands it back a tick later, and the cropper is what says it has: sent
       before that, the picture would be a name with nothing behind it. */
    await panel.findByLabelText('Veličina isečka')
    await user.click(panel.getByRole('button', { name: 'Pošalji na odobrenje' }))

    const told = (await panelFor()).getByText(/čeka odobrenje/)

    expect(told).toBeVisible()
    /* And the reader is taken to what replaced the control they pressed, rather
       than dropped on the body with nothing announced. */
    expect(told).toHaveFocus()
  })

  it('downloads nothing about anybody else to say what is waiting', async () => {
    /* Why a picture sent on an earlier visit is not counted, held as a test
       rather than as a sentence. The only place it is written is the whole
       verification queue: names and postal addresses of people who are not
       members yet, and the words of comments nobody has approved. Reading it
       here would download all of that into a member`s browser.
     *
       So the panel knows about this visit, and with a database it will ask one
       question about one member. Until then somebody who sends a second picture
       across two visits gives the moderator two cards, which is written down
       rather than left to be found (PENDING, and PDL P22). */
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
       earlier version of this test checked neither and passed through both. */
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

  it('is not held up by something else the member put forward', async () => {
    /* The queue holds what a member has put forward, of every sort. A team
       waiting for a decision is not a picture waiting for one, and reading the
       queue without asking which sort would leave somebody unable to change
       their photograph because they once proposed a team. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000007')

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
