import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import type { Competitor } from '../../data/types'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'

/* Changing what a member wrote about themselves, after joining.
 *
 * Owner, 15.08.2026, asked what should happen to somebody whose biography was
 * refused: „Panel u Podešavanjima, kao za sliku." Until then a refusal reached
 * the member with a reason they had nowhere to act on, and the screen said so.
 *
 * These follow the shape of the picture panel's tests, and for the same reason
 * they were written that way: what has to be proved is the errand, not the
 * markup. Nothing here navigates in order to prove that the queue is read
 * afresh, because in this suite `router.navigate` does not unmount the screen,
 * so a component holding its own state passes such a test (profilePicture.test).
 */

const members: Competitor[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/competitors.json'), 'utf-8'),
)

/** Somebody who has written one, and somebody who has not, taken out of the
 *  file rather than named here: if the seed changes, this says so instead of
 *  passing. */
const withOne = must(
  members.find((one) => one.active && one.bio.trim() !== ''),
  'a member whose profile carries a biography',
)
const withNone = must(
  members.find((one) => one.active && one.bio.trim() === ''),
  'a member whose profile carries none',
)

const panelFor = async () => within(await screen.findByRole('region', { name: 'Tekst o sebi' }))

const box = async () => (await panelFor()).getByLabelText(/Svojim rečima|Tekst o sebi/)

describe('the words a member wrote about themselves, changed later', () => {
  it('opens on what stands on the profile, and refuses to send it back unchanged', async () => {
    /* A box that opened empty would read as „write one" to somebody who has
       written one, and what they are usually here to do is mend a sentence. The
       button is told off rather than switched off, so it stays reachable and
       says why it will not act. */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

    const panel = await panelFor()

    expect(await box()).toHaveValue(withOne.bio)

    const send = panel.getByRole('button', { name: 'Pošalji na odobrenje' })

    expect(send).toHaveAttribute('aria-disabled', 'true')
    expect(send).not.toBeDisabled()
    expect(send).toHaveAccessibleDescription('Izmeni tekst da bi imao šta da pošalješ.')

    /* Pressed anyway, because reachable means pressable: the refusal lives in
       the handler as well as in the attribute. */
    await user.click(send)

    expect((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
  })

  it('asks somebody with nothing on their profile to write rather than to change', async () => {
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()

    expect(await box()).toHaveValue('')
    expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toHaveAccessibleDescription(
      'Napiši nešto da bi mogao da pošalješ.',
    )
  })

  it('reaches the moderator as a text, under the member it belongs to', async () => {
    /* The queue holds two sorts and decides them differently: a text is refused
       with a plain reason, a picture with an instruction to work from
       (pages/admin/queues.ts). Sent as the wrong sort, or under the wrong
       number, the reason reaches the wrong inbox. Both are read off the card. */
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'superadmin', withOne.memberNumber)

    await panelFor()
    await user.clear(await box())
    await user.type(await box(), 'Trčim od 2015, najviše po Fruškoj gori.')
    await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

    await router.navigate('/sr/administracija/verifikacija/trkacki-profil')

    const heading = await screen.findByRole('heading', {
      name: `${withOne.firstName} ${withOne.lastName}`,
    })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    expect(card.getByText(/Fruškoj gori/)).toBeVisible()
    /* The number is drawn beside the name on the card, so a moderator can tell
       two members of one name apart; read loosely, because the card writes it
       inside a sentence rather than on its own. */
    expect(card.getByText(new RegExp(withOne.memberNumber))).toBeVisible()
    /* The decision offered is the one for a text: refused with a reason, never
       rewritten by the moderator (PDL P22). */
    expect(card.getByRole('button', { name: 'Odbij' })).toBeVisible()
    expect(card.getByRole('button', { name: 'Odobri' })).toBeVisible()
  })

  it('offers nothing more while one is waiting, and says what was sent', async () => {
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

    await panelFor()
    await user.clear(await box())
    await user.type(await box(), 'Nešto sasvim drugo o sebi.')
    await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

    const panel = await panelFor()
    const told = panel.getByText(/čeka odobrenje/)

    expect(told).toBeVisible()
    /* The reader is taken to what replaced the control they pressed, rather than
       dropped on the body with nothing announced (WCAG 2.2 SC 4.1.3, 2.4.3). */
    expect(told).toHaveFocus()
    expect(panel.queryByRole('button', { name: 'Pošalji na odobrenje' })).not.toBeInTheDocument()
    /* And what was sent is on screen, so somebody who cannot remember what they
       wrote does not have to guess while it is out of their hands. */
    expect(panel.getByText('Nešto sasvim drugo o sebi.')).toBeVisible()
  })

  it('is not held up by a picture the same member is waiting on', async () => {
    /* Two sorts on one queue, and one waiting does not silence the other: they
       are separate errands about one profile (owner, 15.08.2026). */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

    const picture = within(await screen.findByRole('region', { name: 'Profilna slika' }))

    await user.upload(
      await picture.findByLabelText(/Izaberi novu sliku/),
      new File(['slika'], 'nova.jpg', { type: 'image/jpeg' }),
    )
    await picture.findByLabelText('Veličina isečka')
    await user.click(picture.getByRole('button', { name: 'Pošalji na odobrenje' }))

    expect((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
  })

  it('downloads nothing about anybody else to say what is waiting', async () => {
    /* The same limit the picture panel carries, and for the same reason: the
       only place an earlier visit is written is the whole verification queue,
       which holds names and postal addresses of people who are not members yet.
       Reading it here would download all of that into a member`s browser
       (pages/publicData.test.tsx refuses it by name). */
    const asked: string[] = []
    const real = globalThis.fetch

    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      asked.push(String(input))

      return real(input, init)
    }

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      await panelFor()

      expect(asked.filter((one) => one.includes('verification'))).toEqual([])
    } finally {
      globalThis.fetch = real
    }
  })
})
