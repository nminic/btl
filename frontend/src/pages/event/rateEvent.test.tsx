import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { loadResource } from '../../data/client'
import type { EventComment, PendingItem } from '../../data/types'

/** The two letters a portrait draws for a name. */
const initialsOf = (who: string) =>
  who
    .split(' ')
    .map((part) => part.slice(0, 1))
    .join('')
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

/** All three marks given, which is what the form asks for before it will send
 *  anything: the overall is their average (PDL P6), so one mark on its own would
 *  be published as a third of itself. */
async function rateAll(user: ReturnType<typeof setupUser>, mark = 4) {
  for (const name of ['Organizacija', 'Vrednost za novac', 'Ambijent']) {
    const group = screen.getByRole('group', { name })

    await user.click(within(group).getAllByRole('radio')[mark - 1] as HTMLElement)
  }
}

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

    /* Two of the three is still not a rating. The average divides by three
       whatever is given, so a mark left out is published as a nought and the
       same card calls it "Bez ocene". */
    const ambience = screen.getByRole('group', { name: 'Ambijent' })

    await user.click(within(ambience).getAllByRole('radio')[3] as HTMLElement)
    expect(send).toBeDisabled()

    await rateAll(user, 4)
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

    await rateAll(user, 5)
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

    await screen.findByRole('group', { name: 'Organizacija' })

    await rateAll(user, 3)
    await user.click(screen.getByRole('button', { name: 'Pošalji' }))

    expect(await screen.findByText('Ocena je poslata na odobrenje.')).toBeVisible()
  })

  it('says why it will not send yet, rather than leaving a dead button', async () => {
    /* A member who came from a button called "Dodaj komentar", wrote a comment
       and gave one mark used to face a button that did nothing and said nothing.
       The reason is on the screen and tied to the button, the way the queue next
       door answers the same question. */
    const user = setupUser()
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    const send = await screen.findByRole('button', { name: 'Pošalji' })

    expect(screen.getByText('Dajte sve tri ocene da biste mogli da pošaljete.')).toBeVisible()
    expect(send).toHaveAccessibleDescription('Dajte sve tri ocene da biste mogli da pošaljete.')

    await rateAll(user, 4)

    /* And gone once there is nothing left to wait for. */
    expect(
      screen.queryByText('Dajte sve tri ocene da biste mogli da pošaljete.'),
    ).not.toBeInTheDocument()
  })

  it('leads there from the event, and only for somebody signed in', async () => {
    /* Two things one link has to be: the right address, and drawn for the right
       reader. Pointed at the result form it still reads "Dodaj komentar" and
       still works, and shown to a visitor it leads to a screen that turns them
       away. */
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const link = await screen.findByRole('link', { name: 'Dodaj komentar' })

    expect(link).toHaveAttribute('href', `/sr/kalendar/${EVENT}/ocena`)

    cleanup()
    renderAt(`/sr/kalendar/${EVENT}`)
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('link', { name: 'Dodaj komentar' })).not.toBeInTheDocument()
  })

  it('sends the marks that were given, and not a blank rating', async () => {
    /* The marks travel from three groups of radios into one record, and nothing
       between the two says so: sent as noughts, the screen still thanks the
       member and the queue still shows a card. Read back off the queue the
       moment it lands. */
    const user = setupUser()
    /* Signed in as a member and holding the rights, because this follows one
       rating from the form it is given on to the queue it lands in, and those
       are two screens with two doors. */
    const { router } = renderAt(`/sr/kalendar/${EVENT}/ocena`, 'superadmin', ME)

    await screen.findByRole('group', { name: 'Organizacija' })
    await rateAll(user, 5)
    await user.click(screen.getByRole('button', { name: 'Pošalji' }))
    await screen.findByText('Ocena je poslata na odobrenje.')

    await router.navigate('/sr/administracija/verifikacija/komentari')

    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const mine = must(
      within(waiting)
        .getAllByRole('listitem')
        .find((one) => (one.textContent ?? '').includes('Fruškogorski maraton')),
      'the rating just sent',
    )

    /* Five on each of the three, so the overall is five as well. */
    for (const mark of ['Organizacija', 'Vrednost za novac', 'Ambijent']) {
      expect(within(mine).getByRole('img', { name: `${mark}: 5 od 5` })).toBeInTheDocument()
    }
    expect(within(mine).getByText('5,0')).toBeInTheDocument()
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

/** Whether the words of a comment are drawn in the list under an event.
 *
 * Asked of the list and not of the document, because these tests walk between
 * the queue and the event and the screen they came from is still being taken
 * down: asked of everything, the queue's own copy of the same words answers. */
async function underEvent(body: string): Promise<boolean> {
  await screen.findByRole('heading', { level: 1 })

  /* Waited for until the comments have settled into one of the two things they
     can be: the list, or the sentence saying there is none. Asked before that,
     "is it there" is answered by a section that has not loaded yet, which reads
     as no for the wrong reason. */
  await waitFor(() => {
    expect(
      screen.queryByRole('list', { name: 'Komentari' }) !== null ||
        screen.queryByText('Za ovaj događaj još nema odobrenih komentara.') !== null,
    ).toBe(true)
  })

  const list = screen.queryByRole('list', { name: 'Komentari' })

  /* And read out of that list by name. These tests walk between the queue and
     the event, and the queue a navigation is still taking down is a list of
     items carrying the very same words. */
  return (
    list !== null &&
    within(list)
      .getAllByRole('listitem')
      .some((one) => (one.textContent ?? '').includes(body))
  )
}

/** That comment's card in the queue, found now rather than remembered: these
 *  tests walk between screens, and a node caught before a navigation is one the
 *  router has since taken down. */
async function cardFor(body: string): Promise<HTMLElement> {
  const waiting = await screen.findByRole('list', { name: /Čeka/ })

  return must(
    within(waiting)
      .getAllByRole('listitem')
      .find((one) => (one.textContent ?? '').includes(body)),
    'that comment in the queue',
  )
}

describe('a comment a moderator lets out', () => {
  it('shows the moderator the marks it carries, before they decide', async () => {
    renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const first = must(within(waiting).getAllByRole('listitem')[0], 'a waiting comment')

    /* A comment is a rating and a paragraph, and the queue was drawing only the
       paragraph: the moderator was deciding about half of what was sent. */
    for (const mark of ['Organizacija', 'Vrednost za novac', 'Ambijent', 'Ukupna ocena']) {
      expect(within(first).getByText(mark)).toBeInTheDocument()
    }
    expect(within(first).getAllByRole('img', { name: /Organizacija: \d od 5/ })).not.toHaveLength(0)
  })

  it('publishes nothing from the queues that are not about comments', async () => {
    /* The merge asks two things of a waiting item: that it was approved, and
       that it is a comment. Without the second, approving a reported change of
       date publishes a card with no words and no marks under a real event, and
       nothing on any screen would say where it came from. */
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/verifikacija/termini', 'superadmin')

    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const first = must(within(waiting).getAllByRole('listitem')[0], 'a waiting change of date')
    const about = must(
      (await loadResource<PendingItem[]>('verification')).find(
        (one) => one.queue === 'schedule',
      ),
      'a change of date in the record',
    )

    await user.click(within(first).getByRole('button', { name: 'Odobri' }))
    await router.navigate(`/sr/kalendar/${EVENT}`)

    const list = await screen.findByRole('list', { name: 'Komentari' })

    expect(
      within(list)
        .getAllByRole('listitem')
        .some((one) => (one.textContent ?? '').includes(about.who)),
    ).toBe(false)
  })

  it('stays off the portal when it is deleted rather than approved', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

    const queue = await loadResource<PendingItem[]>('verification')
    const sent = must(
      queue.find((one) => one.queue === 'comments' && one.subjectId !== '' && one.body !== ''),
      'a waiting comment with words in it',
    )

    /* A comment is deleted rather than sent back (PDL P22), so the decision on
       it is the other one, and the other one must not publish. */
    await user.click(within(await cardFor(sent.body)).getByRole('button', { name: 'Obriši' }))
    await router.navigate(`/sr/kalendar/${sent.subjectId.replace(/^evt-/, '')}`)

    expect(await underEvent(sent.body)).toBe(false)
  })

  it('appears under its event once it is approved, and not before', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

    /* Read out of the record, so what is looked for under the event is the very
       comment that was approved rather than any comment at all. */
    const queue = await loadResource<PendingItem[]>('verification')
    const sent = must(
      queue.find((one) => one.queue === 'comments' && one.subjectId !== '' && one.body !== ''),
      'a waiting comment with words in it',
    )

    /* Absent first, which is the half the name of this test promises and the
       half nothing was holding: the event page reads the queue now, so the only
       thing keeping a waiting comment off the portal is that one word
       "approved". Read the other way round, or read as "decided", every waiting
       comment publishes itself, including the one in the fixture offering a
       discount for a referral link. */
    await router.navigate(`/sr/kalendar/${sent.subjectId.replace(/^evt-/, '')}`)

    expect(await underEvent(sent.body)).toBe(false)

    /* Back to the queue, and the card found again: the one caught before the
       detour is a node two navigations have since taken down, and clicking it
       does nothing at all while looking exactly like a click. */
    await router.navigate('/sr/administracija/verifikacija/komentari')
    await user.click(within(await cardFor(sent.body)).getByRole('button', { name: 'Odobri' }))

    /* Approving is what publishes it. Until this it wrote a decision into the
       session and the event page went on showing what the file carried, so a
       moderator approved a comment and nothing appeared anywhere. */
    await router.navigate(`/sr/kalendar/${sent.subjectId.replace(/^evt-/, '')}`)

    expect(await underEvent(sent.body)).toBe(true)
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
    /* And the overall, which is the average of the three, said as a figure with
       its name beside it rather than left to the stars alone. */
    expect(within(first).getByText('Ukupna ocena: 4,7')).toBeInTheDocument()
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

  it('draws the portrait, the marks and the words, each of them', async () => {
    /* Every part the owner named (06.08.2026), because each is one line of
       markup and any one of them can go quietly: the portrait is a drawing with
       no text, the marks are pictures, and the body is a paragraph that is
       allowed to be empty. */
    renderAt(`/sr/kalendar/${EVENT}`)

    const comments = await loadResource<EventComment[]>('comments')
    const here = must(
      comments.find((one) => one.body !== '' && one.rating.organisation > 0),
      'a comment with words and marks',
    )
    const card = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes(here.body),
      ),
      'that comment under the event',
    )

    expect(within(card).getByText(here.who)).toBeInTheDocument()
    expect(within(card).getByText(here.body)).toBeInTheDocument()
    /* The face is a drawing and carries no name of its own, so it is looked for
       as the initials it draws. */
    expect(within(card).getByText(initialsOf(here.who))).toBeInTheDocument()

    for (const [mark, name] of [
      ['organisation', 'Organizacija'],
      ['value', 'Vrednost za novac'],
      ['ambience', 'Ambijent'],
    ] as const) {
      expect(
        within(card).getByRole('img', { name: `${name}: ${here.rating[mark]} od 5` }),
      ).toBeInTheDocument()
    }
  })

  it('puts the newest comment first', async () => {
    renderAt(`/sr/kalendar/${EVENT}`)

    const comments = (await loadResource<EventComment[]>('comments')).filter(
      (one) => one.eventId.endsWith(EVENT),
    )

    expect(comments.length).toBeGreaterThan(1)

    const drawn = (await screen.findAllByRole('listitem'))
      .map((one) => comments.find((c) => (one.textContent ?? '').includes(c.who))?.date)
      .filter((one): one is string => one !== undefined)

    expect([...drawn].sort((left, right) => right.localeCompare(left))).toEqual(drawn)
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
