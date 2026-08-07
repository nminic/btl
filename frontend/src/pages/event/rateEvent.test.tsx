import { screen, within } from '@testing-library/react'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { overall } from './overall'

/* Rating an event, and reading what other people made of it (owner,
 * 06.08.2026).
 *
 * The event used for both is the one the mock file carries comments for. A past
 * event on purpose: the portal refuses to rate one that has not been run, for
 * the same reason it refuses a result from the future (PDL P9), and the rating
 * asks about the organisation and the surroundings, which are things somebody
 * saw on the day.
 */
const EVENT = 'fruskogorski-maraton-2010-05-08'
const ME = '000007'

describe('rating an event', () => {
  it('asks for three marks and a comment that may be left out', async () => {
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    await screen.findByRole('heading', { level: 1, name: 'Fruškogorski maraton' })

    /* Three, and the fourth is not among them: the overall is the average of
       these (PDL P6), so a field for it would be a fourth place for the same
       fact to disagree with itself. */
    for (const mark of ['Organizacija', 'Vrednost za novac', 'Ambijent']) {
      expect(screen.getByRole('group', { name: mark })).toBeInTheDocument()
    }
    expect(screen.queryByRole('group', { name: 'Ukupna ocena' })).not.toBeInTheDocument()

    expect(screen.getByLabelText('Komentar')).toBeInTheDocument()
  })

  it('offers five stars to each mark, as radios rather than as five buttons', async () => {
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    const group = await screen.findByRole('group', { name: 'Organizacija' })

    /* A rating is one choice out of five, so it is one group of radios: the
       arrow keys move through it and a reader hears which of the five is
       chosen. Five buttons would be five things to press with nothing saying
       they are one answer. */
    expect(within(group).getAllByRole('radio')).toHaveLength(5)
    expect(within(group).queryAllByRole('button')).toHaveLength(0)
  })

  it('sends nothing until there is a mark, and then says it is waiting', async () => {
    const user = setupUser()
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    const send = await screen.findByRole('button', { name: 'Pošalji' })

    /* The comment may be empty and the rating may not: the rating is what a
       member came to give. */
    expect(send).toBeDisabled()

    const group = screen.getByRole('group', { name: 'Ambijent' })

    await user.click(within(group).getAllByRole('radio')[3] as HTMLElement)
    expect(send).toBeEnabled()

    await user.click(send)

    /* Nothing is published on the spot. It goes to the queue a moderator reads,
       which is the route every comment has taken since the queues were written
       (PDL P22). */
    expect(await screen.findByText('Ocena je poslata na odobrenje.')).toBeVisible()
  })

  it('carries the comment a member types, and sends it with the marks', async () => {
    const user = setupUser()
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    const box = await screen.findByLabelText('Komentar')

    await user.type(box, 'Staza je bila jasno obeležena.')
    expect(box).toHaveValue('Staza je bila jasno obeležena.')

    await user.click(
      within(screen.getByRole('group', { name: 'Organizacija' })).getAllByRole('radio')[4] as HTMLElement,
    )
    await user.click(screen.getByRole('button', { name: 'Pošalji' }))

    expect(await screen.findByText('Ocena je poslata na odobrenje.')).toBeVisible()
  })

  it('sends a rating from somebody the list of members has never heard of', async () => {
    /* A member number that is not in the file. It happens while a registration
       is still going through: the number is handed out when the fee is recorded
       (PDL P8) and the member list is read separately, so for a moment there is
       a signed-in number with no record behind it. The rating still goes, with
       no name on it, rather than the screen falling over. */
    const user = setupUser()
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', '999999')

    const group = await screen.findByRole('group', { name: 'Organizacija' })

    await user.click(within(group).getAllByRole('radio')[2] as HTMLElement)
    await user.click(screen.getByRole('button', { name: 'Pošalji' }))

    expect(await screen.findByText('Ocena je poslata na odobrenje.')).toBeVisible()
  })

  it('is not offered to somebody who is not signed in', async () => {
    renderAt(`/sr/kalendar/${EVENT}/ocena`)

    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent(
      'Fruškogorski maraton',
    )
    expect(screen.queryByRole('group', { name: 'Organizacija' })).not.toBeInTheDocument()
  })

  it('says so on an address that names no event of ours', async () => {
    renderAt('/sr/kalendar/nepostojeci-dogadjaj/ocena', 'competitor', ME)

    expect(await screen.findByRole('heading', { level: 1, name: 'Ovog događaja nema.' })).toBeVisible()
  })
})

describe('the comments under an event', () => {
  it('draws each one with its author, the day, and the marks it carries', async () => {
    renderAt(`/sr/kalendar/${EVENT}`)

    /* Awaited by the first comment and not by the heading over it: the heading
       is drawn while the comments are still on their way, so waiting for it
       proves only that the section exists. */
    const first = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes('8. maj 2010.'),
      ),
      'a comment from the day of the race',
    )

    /* The name leads to the profile, the way every name on the portal does
       (PDL P11). */
    expect(within(first).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/takmicar/'),
    )
    /* Three marks named, each with its own stars. */
    for (const mark of ['Organizacija', 'Vrednost za novac', 'Ambijent']) {
      expect(within(first).getByText(mark)).toBeInTheDocument()
    }
    /* And the overall, which is the average of the three. */
    expect(within(first).getByText('4,7')).toBeInTheDocument()
  })

  it('keeps a comment whose author has left the league, with no link on the name', async () => {
    /* A member whose fee has run out has no visible profile (PDL P11), and what
       they wrote stays where it was published. The name is drawn as it was on
       the day, because there is no record left to read it off. */
    renderAt(`/sr/kalendar/${EVENT}`)

    const gone = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes('Nekadašnji član'),
      ),
      'a comment by somebody who has left',
    )

    expect(within(gone).queryByRole('link')).not.toBeInTheDocument()
  })

  it('says so where nobody has commented yet', async () => {
    renderAt('/sr/kalendar/jadovnicki-ultramaraton-2026-07-11')

    expect(await screen.findByText('Za ovaj događaj još nema odobrenih komentara.')).toBeVisible()
  })

  it('works the overall out of the three, rather than reading a fourth', () => {
    /* PDL P6 says the overall is arithmetic. Rounded to one decimal, because
       three whole marks out of five cannot honestly carry two: 4,67 claims a
       precision nobody gave. */
    expect(overall({ organisation: 5, value: 4, ambience: 5 })).toBe(4.7)
    expect(overall({ organisation: 3, value: 3, ambience: 3 })).toBe(3)
    expect(overall({ organisation: 0, value: 0, ambience: 0 })).toBe(0)
  })
})
