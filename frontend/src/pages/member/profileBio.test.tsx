import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import type { Competitor } from '../../data/types'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import sr from '../../i18n/sr.json'
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
    expect(panel.getByText(sr.bio.standing)).toBeVisible()

    const send = panel.getByRole('button', { name: 'Pošalji na odobrenje' })

    expect(send).toHaveAttribute('aria-disabled', 'true')
    expect(send).not.toBeDisabled()
    expect(send).toHaveAccessibleDescription('Izmeni tekst da bi imao šta da pošalješ.')

    /* Pressed anyway, because reachable means pressable: the refusal lives in
       the handler as well as in the attribute. */
    await user.click(send)

    expect((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
  })

  it('says the limit on the way into the box, not by stopping the typing', async () => {
    /* The box cuts at 360 characters, and until 16.08.2026 that number lived
       only in a counter drawn `aria-hidden`, with nothing pointing at it. A
       member who cannot see the screen met the limit as a wall: the keys simply
       stopped working. `LongBox` says in its own comment that pointing at the
       count is the caller's business (forms/LongBox.tsx), and the comment box on
       an event does it (pages/event/RateEvent.tsx); this panel did not.
     *
       The rule beside the box said the number in words and it went out on
       31.08.2026 with the last three of its kind, so what carries it now is the
       count alone. **And the count says what is left, not what the whole is**,
       which is the same thing only for an empty box: somebody with a biography
       already written hears „Još 123 znaka" and hears 360 nowhere on this screen.
       That is still an instruction on the way in rather than a wall met in silence
       (WCAG 2.2 SC 3.3.2, and the wall itself is named by `registration.bioFull`),
       but it is less than the rule said, so it is measured both ways rather than
       described from the empty one. A first draft of this comment claimed the
       number was still said, and only the empty box was drawn (review, 31.08.2026).

       One id, and it is the whole of what the description may say: a second one
       here would point at an element that no longer exists, which is read as
       nothing at all and which no assertion about text can see. */
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const field = await box()

    expect(field).toHaveAttribute('aria-describedby', 'settings-bio-left')
    expect(field).toHaveAccessibleDescription(/Još 360 znak/)

    /* Every id in the list points at something. Asked of the document rather than
       of the attribute, because an attribute naming a ghost reads the same. */
    for (const id of must(field.getAttribute('aria-describedby'), 'what describes the box').split(' ')) {
      expect(document.getElementById(id), id).not.toBeNull()
    }
  })

  it('says what is left of the limit to somebody who has already written', async () => {
    /* The other half of the sentence above, and the half that changed: what this
       member used to hear was the rule, which carried 360 whatever they had
       written. Now the description carries the remainder **and no longer carries the
       rule**, and that is what this freezes so the difference is a decision rather
       than a thing nobody wrote down.

       Two things, not one. „The remainder and nothing else" is what an earlier
       version of this line promised, and it is not what the two assertions below say:
       they say the remainder is there and that 360 is not. Whether anything else
       stands beside them is unmeasured, and saying so is cheaper than a sentence that
       has to be believed (review, 31.08.2026). */
    renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

    const field = await box()

    expect(field).toHaveAccessibleDescription(/Još \d+ znak/)
    expect(field).not.toHaveAccessibleDescription(/360/)
  })

  it('asks somebody with nothing on their profile to write rather than to change', async () => {
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()

    expect(await box()).toHaveValue('')
    expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toHaveAccessibleDescription(
      'Napiši nešto da bi mogao da pošalješ.',
    )
    /* And the sentence above the box says there is nothing yet, rather than
       „this is what stands on your profile" over an empty box. Both sentences
       ran and neither was read, so a review swapped one for the other and the
       whole suite stayed green. */
    expect(panel.getByText(sr.bio.none)).toBeVisible()
    expect(panel.queryByText(sr.bio.standing)).not.toBeInTheDocument()
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
    /* The decision offered is the one for a text and not the one for a picture,
       and the two are not told apart by the buttons: both are refused with a
       reason and both carry „Odbij" and „Odobri". What differs is what the
       moderator is asked to write, which `outcomeFor` decides (queues.ts): a
       picture is handed back with an instruction precise enough to work from, a
       text with a plain reason. So the words in the box are read, not the
       buttons. A review renamed the sort on both sides at once and this test
       stayed green while it read them. */
    expect(card.getByRole('button', { name: 'Odbij' })).toBeVisible()
    expect(card.getByRole('button', { name: 'Odobri' })).toBeVisible()

    await user.click(card.getByRole('button', { name: 'Odbij' }))

    expect(screen.getByLabelText('Razlog odbijanja')).toHaveAttribute(
      'placeholder',
      sr.review.reasonPlaceholder,
    )
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

  it('hands the box straight back once the text is approved in the same visit', async () => {
    /* The panel reads decisions as well as proposals, so somebody whose text is
       approved while they are still on the portal is not left told to wait. That
       was written down in a comment and nothing measured it: a review made the
       filter ignore decisions altogether and all 1935 tests stayed green.
     *
       Walked rather than stated: the member sends, the moderator approves on the
       queue, the member comes back and the box is theirs again. Both roles in
       one session, which is what the development switch is for. */
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'superadmin', withOne.memberNumber)

    await panelFor()
    await user.clear(await box())
    await user.type(await box(), 'Trčim jer volim šumu.')
    await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

    expect((await panelFor()).getByText(/čeka odobrenje/)).toBeVisible()

    await router.navigate('/sr/administracija/verifikacija/trkacki-profil')

    const heading = await screen.findByRole('heading', {
      name: `${withOne.firstName} ${withOne.lastName}`,
    })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))
    await router.navigate('/sr/podesavanja')

    const panel = await panelFor()

    expect(panel.queryByText(/čeka odobrenje/)).not.toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
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
    await measurePicture()
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
