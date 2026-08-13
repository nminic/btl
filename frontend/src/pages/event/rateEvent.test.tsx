import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { formatDate } from '../../i18n/format'
import { prijava } from '../../forms/definitions'
import { limitOf } from '../../forms/records'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { at, must } from '../../test/at'
import { loadResource } from '../../data/client'
import type { BtlEvent, Competitor, EventComment, PendingItem } from '../../data/types'
import { overall, rated } from './overall'

/** The two letters a portrait draws for a name. */
const initialsOf = (who: string) =>
  who
    .split(' ')
    .map((part) => part.slice(0, 1))
    .join('')

/**
 * The words on a card, in the order they stand on it, with the overall left out:
 * that one is a figure beside a picture rather than a line of the card.
 *
 * Read as paragraphs, which is the one thing here no role reaches: a paragraph
 * has none, and what is being held is that a card with no words has no empty
 * one under the marks. Its content is what the checks compare, never its class.
 */
const paragraphsIn = (card: HTMLElement) =>
  [...card.getElementsByTagName('p')]
    .map((one) => (one.textContent ?? '').trim())
    .filter((one) => !one.startsWith('Ukupna ocena'))

/** The name on a card, which is the first paragraph on it. */
const whoOf = (card: HTMLElement) => paragraphsIn(card)[0] ?? ''

/* Rating an event, and reading what other people made of it (owner,
 * 06.08.2026).
 *
 * The event used for both is the one the mock file carries comments for. A past
 * event on purpose: the portal refuses to rate one that has not been run, for
 * the same reason it refuses a result from the future (PDL P9), and the rating
 * asks about the organisation and the surroundings, which are things somebody
 * saw on the day.
 */
const EVENT = 'fruskogorski-maraton-2010'
/** One nobody has run yet, read on the real day the suite runs on. */
const AHEAD = 'sidski-novogodisnji-maraton-2027'
/** The day that event is run, so the boundary itself can be stood on. */
const AHEAD_DAY = '2027-01-16'
/** A day before it, so the three cases about a race nobody has run say what
 *  they say whatever day the suite is run on. On the real clock they would swap
 *  their answers on 16.01.2027. */
const BEFORE_AHEAD = '2026-12-31'
/** One nobody has run and nobody has commented on, which is what makes the
 *  whole section absent rather than empty. AHEAD carries a comment on purpose:
 *  it stands for an event moved onto a later date. */
const AHEAD_EMPTY = 'podgoricka-desetka-2027'
const AHEAD_EMPTY_NAME = 'Podgorička desetka'
/* Somebody with a result on EVENT, because a rating belongs to whoever ran the
   race (owner, 11.08.2026): they are the only member the rating form opens
   for. Read off the data rather than picked: 000021 is the one competitor with
   a result on the Fruškogorski maraton of 2010. */
const ME = '000021'

/** The event that answers at an address, since an address is no longer its id
 *  with a prefix: it is the name and the year (owner, 10.08.2026). */
async function eventAt(slug: string): Promise<BtlEvent> {
  const events = await loadResource<BtlEvent[]>('events')

  return must(
    events.find((one) => one.slug === slug),
    `an event at /${slug}`,
  )
}

/** And the other way round: the event carrying that id. */
async function eventWithId(id: string): Promise<BtlEvent> {
  const events = await loadResource<BtlEvent[]>('events')

  return must(
    events.find((one) => one.id === id),
    `an event with the id ${id}`,
  )
}
/** A second event that has been run, for the step from one rating to another. */
const OTHER = 'ironman-70-3-st-polten-2010'
const OTHER_NAME = 'Ironman 70.3 - St Polten'

/** All three marks given, which is what the form asks for before it will send
 *  anything: the overall is their average (PDL P6), so one mark on its own would
 *  be published as a third of itself. */
async function rateAll(user: ReturnType<typeof setupUser>, mark = 4) {
  for (const name of ['Organizacija', 'Vrednost za novac', 'Ambijent']) {
    const group = screen.getByRole('radiogroup', { name })

    await user.click(at(within(group).getAllByRole('radio'), mark - 1))
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
      expect(screen.getByRole('radiogroup', { name: mark })).toBeInTheDocument()
    }
    expect(screen.queryByRole('radiogroup', { name: 'Ukupna ocena' })).not.toBeInTheDocument()

    /* „Komentar (neobavezno)", as every optional field on the portal is named
       since 12.08.2026: the three ratings beside it are obligatory and say so
       with a star, and a field with neither mark says nothing about itself. */
    expect(screen.getByLabelText(/^Komentar \(neobavezno\)$/)).toBeInTheDocument()

    /* And the three that are asked for say it on the group, since it is the
       rating that is asked for and not any one star of it. */
    for (const mark of ['Organizacija', 'Vrednost za novac', 'Ambijent']) {
      const group = screen.getByRole('radiogroup', { name: mark })

      /* A radiogroup and not a bare fieldset, which is a plain `group`: ARIA
         gives `group` no `aria-required`, so the word went where no reader
         looks. Around the five stars and nothing else, since a radiogroup may
         own radios and nothing besides. */
      expect(group, `${mark} does not say it is obligatory`).toHaveAttribute(
        'aria-required',
        'true',
      )
      expect(within(group).getAllByRole('radio')).toHaveLength(5)
      expect(group.querySelector('legend')).toBeNull()

      /* One box carries the name, and it is this one: a fieldset around it named
         itself by its legend and the row named itself by the same words, so the
         name was announced twice on entering the rating.

         The star is beside the name and not among the stars, and the words the
         group is named by do not hold it: holding it, „Organizacija" reads as
         „Organizacija*" for anything that looks by text (forms/AskedLabel.tsx);
         laid outside the name entirely, it fell in among the five stars. */
      const field = must(group.closest('.stars--asking'), `the rating of ${mark}`)
      const named = must(field.querySelector('.stars__name'), `the name of ${mark}`)

      /* One box with that name and no second one around it. A fieldset named by
         its legend wrapped the row named by the same words, so a reader entering
         the rating heard „Organizacija" twice. Asked by role, since that is what
         a reader goes by: the outer box was a `group`, and there is none now. */
      expect(screen.queryByRole('group', { name: mark })).toBeNull()
      expect(named.querySelector('.field__required')).not.toBeNull()
      expect(must(named.firstElementChild, `the words of ${mark}`).textContent).toBe(mark)
    }

    expect(screen.getByText('Polja sa zvezdicom su obavezna.')).toBeVisible()
  })

  it('offers five stars to each mark, as radios rather than as five buttons', async () => {
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    const group = await screen.findByRole('radiogroup', { name: 'Organizacija' })

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
       member came to give.

       Said and not switched off, so the reason beside it can be tabbed to
       (Pager.css). Pressed anyway, it sends nothing, which is the half a
       reader who ignores the word depends on. */
    expect(send).toHaveAttribute('aria-disabled', 'true')

    await user.click(send)
    expect(screen.queryByText('Ocena je poslata na odobrenje.')).toBeNull()

    /* Two of the three is still not a rating. The average divides by three
       whatever is given, so a mark left out is published as a nought and the
       same card calls it "Bez ocene". */
    const ambience = screen.getByRole('radiogroup', { name: 'Ambijent' })

    await user.click(at(within(ambience).getAllByRole('radio'), 3))
    expect(send).toHaveAttribute('aria-disabled', 'true')

    await rateAll(user, 4)
    expect(send).toHaveAttribute('aria-disabled', 'false')

    await user.click(send)

    /* Nothing is published on the spot. It goes to the queue a moderator reads,
       which is the route every comment has taken since the queues were written
       (PDL P22). */
    expect(await screen.findByText('Ocena je poslata na odobrenje.')).toBeVisible()
  })

  it('says how much room the comment has, and what a paste lost', async () => {
    /* The limit is refused at the door (owner, 01.08.2026), and a door that
       refuses in silence cuts three hundred characters off a pasted race report
       and says nothing. This box draws the one the form next door draws for the
       same field of the same definition (forms/LongBox.tsx), so it says all
       three things: the room on the way in, what a paste lost, and that it will
       take no more. */
    const user = setupUser()

    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    const box = await screen.findByLabelText(/^Komentar/)
    const limit = limitOf(prijava, 'comment')

    /* Read on the way into the field rather than left to whoever can see it: the
       box points at the count, so a screen reader says it on arrival. */
    /* Both halves: the rule the field is for and the room it has left, each
       read on the way in. Without the first, the one sentence saying the comment
       may be left out reaches nobody who cannot see it (WCAG 2.2 SC 3.3.2). */
    expect((box.getAttribute('aria-describedby') ?? '').split(' ').sort()).toEqual([
      'comment-hint',
      'comment-left',
    ])
    expect(screen.getByText(/^Neobavezno\./)).toHaveAttribute('id', 'comment-hint')
    expect(screen.getByText(new RegExp(`^Još ${limit} znak`))).toBeVisible()

    await user.type(box, 'Kratko.')

    expect(screen.getByText(new RegExp(`^Još ${limit - 'Kratko.'.length} znak`))).toBeVisible()

    /* And the door itself: what does not fit does not go in, and the writer is
       told what was left outside. */
    await user.clear(box)
    await user.paste('x'.repeat(limit + 12))

    expect(box).toHaveValue('x'.repeat(limit))
    /* Twice on purpose: the line under the box for whoever can see it, and the
       live region for whoever cannot (forms/LongBox.tsx). */
    expect(screen.getAllByText(/^Nalepljeni tekst je bio 12 znak/)).toHaveLength(2)
    expect(screen.getByText(new RegExp(`^Dosta je, granica je ${limit} znak`))).toBeVisible()
  })

  it('carries the comment a member types, and sends it with the marks', async () => {
    const user = setupUser()
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    const box = await screen.findByLabelText(/^Komentar/)

    await user.type(box, 'Staza je bila jasno obeležena.')
    expect(box).toHaveValue('Staza je bila jasno obeležena.')

    await rateAll(user, 5)
    await user.click(screen.getByRole('button', { name: 'Pošalji' }))

    expect(await screen.findByText('Ocena je poslata na odobrenje.')).toBeVisible()
  })

  it('takes a rating from a member the list of members has not caught up with', async () => {
    /* The number is handed out when the fee is recorded (PDL P8) and the member
       list is read separately, so for a moment there is a signed-in number with
       a result and no record behind it. The rating goes with no name on it
       rather than the screen falling over.

       Stood up by taking the record away rather than by finding a member
       without one: since 11.08.2026 the rating opens only for somebody with a
       result, and every result in the data belongs to somebody the list has. */
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/competitors.json')
        ? new Response('[]', { status: 200 })
        : real(input))

    try {
      const user = setupUser()
      renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

      await screen.findByRole('radiogroup', { name: 'Organizacija' })
      await rateAll(user, 3)
      await user.click(screen.getByRole('button', { name: 'Pošalji' }))

      expect(await screen.findByText('Ocena je poslata na odobrenje.')).toBeVisible()
    } finally {
      /* Put back whatever happens: a stub left standing is every later test in
         the file reading an empty list of members. */
      globalThis.fetch = real
    }
  })

  it('turns away somebody with no result on the event, however they got here', async () => {
    /* The address can be typed, and a rule kept by hiding a link is not kept
       (owner, 11.08.2026). A member number that is not in the file at all is
       the sharpest case: it happens while a registration is going through, and
       what it must not do is fall over on the way to saying no. */
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', '999999')

    expect(
      await screen.findByRole('heading', { name: 'Ovaj događaj ocenjuju oni koji su ga istrčali' }),
    ).toBeVisible()
    expect(screen.queryByRole('radiogroup', { name: 'Organizacija' })).toBeNull()
  })

  it('leads back to the event from that refusal, which is what they wanted anyway', async () => {
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', '999999')

    expect(await screen.findByRole('link', { name: 'Nazad na događaj' })).toHaveAttribute(
      'href',
      `/sr/kalendar/${EVENT}`,
    )
  })

  it('starts empty on the next event, rather than carrying the last one over', async () => {
    /* The router keeps one element across a change of the address's own parts,
       so the marks, the words and "it has been sent" all survived a step from
       one event's rating to another's. One press would then have filed the
       first event's answers under the second. */
    const user = setupUser()
    const { router } = renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    await screen.findByRole('radiogroup', { name: 'Organizacija' })
    await user.type(screen.getByLabelText(/^Komentar/), 'Reci o prvoj trci.')
    await rateAll(user, 4)

    await router.navigate(`/sr/kalendar/${OTHER}/ocena`)
    await screen.findByRole('heading', { level: 1, name: OTHER_NAME })

    expect(screen.getByLabelText(/^Komentar/)).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Pošalji' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    for (const mark of ['Organizacija', 'Vrednost za novac', 'Ambijent']) {
      const group = screen.getByRole('radiogroup', { name: mark })

      expect(within(group).queryAllByRole('radio', { checked: true })).toHaveLength(0)
    }
  })

  it('carries nothing over after one has been sent either', async () => {
    const user = setupUser()
    const { router } = renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    await screen.findByRole('radiogroup', { name: 'Organizacija' })
    await rateAll(user, 5)
    await user.click(screen.getByRole('button', { name: 'Pošalji' }))
    await screen.findByText('Ocena je poslata na odobrenje.')

    await router.navigate(`/sr/kalendar/${OTHER}/ocena`)

    expect(await screen.findByRole('radiogroup', { name: 'Organizacija' })).toBeVisible()
    expect(screen.queryByText('Ocena je poslata na odobrenje.')).toBeNull()
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

    await screen.findByRole('radiogroup', { name: 'Organizacija' })
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
    expect(screen.queryByRole('radiogroup', { name: 'Organizacija' })).not.toBeInTheDocument()
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

    /* Chosen by what it carries, not by where it sits: taken as the first item
       of the queue this said nothing the day a comment with no marks was put in
       front of it, and said it by throwing rather than by failing. */
    const queue = await loadResource<PendingItem[]>('verification')
    const marked = must(
      queue.find((one) => one.queue === 'comments' && rated(one.rating)),
      'a waiting comment carrying all three marks',
    )
    const first = await cardFor(marked.body)

    /* A comment is a rating and a paragraph, and the queue was drawing only the
       paragraph: the moderator was deciding about half of what was sent. */
    for (const mark of ['Organizacija', 'Vrednost za novac', 'Ambijent', 'Ukupna ocena']) {
      expect(within(first).getByText(mark)).toBeInTheDocument()
    }
    /* One picture per mark, and one only: `getAllByRole(...).not.toHaveLength(0)`
       stood here and asserted nothing, because getAllByRole throws on none. */
    expect(
      within(first).getAllByRole('img', { name: `Organizacija: ${marked.rating.organisation} od 5` }),
    ).toHaveLength(1)
  })

  it('draws the marks on the comments queue and on none of the others', async () => {
    /* A rating is about an event and the other six queues are not, so a card in
       them carrying "Organizacija / Vrednost za novac / Ambijent / Ukupna
       ocena: Bez ocene" is four lines of nothing on every biography, every
       photograph and every payment. The condition was written and held nowhere:
       drawn unconditionally, all 1384 tests passed. */
    const { router } = renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

    await screen.findByRole('list', { name: /Čeka/ })

    expect(screen.getAllByText('Vrednost za novac').length).toBeGreaterThan(0)

    for (const [address, named] of [
      ['trkacki-profil', 'Trkački profil'],
      ['termini', 'Prijave promene termina'],
    ] as const) {
      await router.navigate(`/sr/administracija/verifikacija/${address}`)
      /* Waited for by the name of the queue that was asked for: the list of
         waiting items is on every one of these screens, so waiting for that
         alone is satisfied by the screen already there. */
      await screen.findByRole('heading', { level: 1, name: named })

      expect(screen.queryAllByText('Vrednost za novac')).toEqual([])
      expect(screen.queryAllByText('Ukupna ocena')).toEqual([])
    }
  })

  it('says the same words the event page does about a comment with no marks', async () => {
    /* The record allows a comment carrying no rating: one written before the
       ratings existed, still waiting. The queue read it as 0,0 while the event
       page called it "Bez ocene", which is two answers to one question about one
       record. */
    renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

    const queue = await loadResource<PendingItem[]>('verification')
    const bare = must(
      queue.find(
        (one) =>
          one.queue === 'comments' &&
          one.rating.organisation === 0 &&
          one.rating.value === 0 &&
          one.rating.ambience === 0,
      ),
      'a waiting comment with no marks',
    )
    const card = await cardFor(bare.body)

    expect(within(card).getByText('Bez ocene')).toBeInTheDocument()
    expect(card.textContent).not.toContain('0,0')
  })

  it('carries what was said about an earlier running of the same race', async () => {
    /* The whole of the editions feature, asked of the screen (owner,
       11.08.2026). Until this the screen read one event's comments, and nothing
       failed when the walk of editions was taken back out: `editionsOf` had its
       own tests and the page that uses it had none.

       Read out of the record rather than named here, so what is looked for is a
       comment that really is on the parent of the edition being opened. */
    const events = await loadResource<BtlEvent[]>('events')
    const comments = await loadResource<EventComment[]>('comments')
    const inherited = must(
      comments.find((one) =>
        events.some((event) => event.copiedFrom === one.eventId),
      ),
      'a comment on an event some later edition was copied from',
    )
    const later = must(
      events.find((event) => event.copiedFrom === inherited.eventId),
      'the later edition',
    )

    renderAt(`/sr/kalendar/${later.slug}`, 'competitor', ME)

    expect(await underEvent(inherited.body)).toBe(true)
  })

  it('says which running an inherited comment was written about', async () => {
    /* Otherwise the page of the 2027 race carries a paragraph about the 2024
       one with nothing to say so, and a reader takes last year's startni paket
       for this year's promise. */
    const events = await loadResource<BtlEvent[]>('events')
    const comments = await loadResource<EventComment[]>('comments')
    const inherited = must(
      comments.find((one) => events.some((event) => event.copiedFrom === one.eventId)),
      'a comment on an event some later edition was copied from',
    )
    const later = must(
      events.find((event) => event.copiedFrom === inherited.eventId),
      'the later edition',
    )
    const from = must(
      events.find((event) => event.id === inherited.eventId),
      'the edition it was written under',
    )

    renderAt(`/sr/kalendar/${later.slug}`, 'competitor', ME)

    const card = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes(inherited.body),
      ),
      'the inherited comment',
    )

    expect(card).toHaveTextContent(`Izdanje ${from.date.slice(0, 4)}.`)
  })

  it('shows ten of them and grows by ten, rather than the whole of a long list', async () => {
    /* Ten before the first refill (owner, 11.08.2026). The generated data has
       six comments on its busiest event, so a longer list is stood up here: it
       is the length that is under test and not the data. */
    const real = globalThis.fetch
    const many = Array.from({ length: 23 }, (_, at) => ({
      id: `kom-mnogo-${String(at)}`,
      eventId: 'evt-fruskogorski-maraton-2010-05-08',
      memberNumber: '000007',
      who: 'Neko Nekić',
      date: `2010-05-${String(10 + (at % 20)).padStart(2, '0')}`,
      rating: { organisation: 4, value: 4, ambience: 4 },
      body: `Komentar broj ${String(at + 1)}.`,
    }))

    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/comments.json')
        ? new Response(JSON.stringify(many), { status: 200 })
        : real(input))

    const user = setupUser()
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const list = await screen.findByRole('list', { name: 'Komentari' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)

    await user.click(screen.getByRole('button', { name: 'Učitaj još komentara' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(20)

    await user.click(screen.getByRole('button', { name: 'Učitaj još komentara' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(23)
    expect(screen.getByText('To je sav sadržaj, 23 komentara')).toBeVisible()

    globalThis.fetch = real
  })

  it('stands the overall mark beside the name of the race, and nowhere else', async () => {
    /* One place, by the owner's word (11.08.2026). It used to stand over the
       list of comments; asked of the head of the page, a mark that stayed down
       there would be missing here, and asked of the whole document a mark drawn
       twice would pass. */
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const head = must(
      (await screen.findByRole('heading', { level: 1, name: 'Fruškogorski maraton' })).closest(
        'header',
      ),
      'the head of the page',
    )

    await waitFor(() => {
      expect(head.querySelectorAll('.comments__mark')).toHaveLength(1)
    })

    /* And nowhere else on the page: it used to stand over the list of comments
       as well, and asked of the whole document a mark drawn twice would pass. */
    expect(document.querySelectorAll('.comments__mark')).toHaveLength(1)
  })

  it('is the average of every running of the race, not of this one and not the best of them', async () => {
    /* Three claims in one number, and the figure is the only place any of them
       can be read: that it counts the earlier editions (a race rated for
       fifteen years does not start from nothing because this year is a copy
       with an id of its own), that it is a mean and not a maximum, and that the
       count beside it says how many went into it.

       Worked out here from the record rather than written down, so the day a
       comment is added to the fixture this says what the screen says. */
    const events = await loadResource<BtlEvent[]>('events')
    const comments = await loadResource<EventComment[]>('comments')
    const inherited = must(
      comments.find((one) => events.some((event) => event.copiedFrom === one.eventId)),
      'a comment on an event some later edition was copied from',
    )
    const later = must(
      events.find((event) => event.copiedFrom === inherited.eventId),
      'the later edition',
    )

    const counted = comments.filter(
      (one) => (one.eventId === later.id || one.eventId === inherited.eventId) && rated(one.rating),
    )
    const mean = counted.reduce((so, one) => so + overall(one.rating), 0) / counted.length
    const highest = Math.max(...counted.map((one) => overall(one.rating)))

    /* The two must differ, or the mean and the maximum are the same number and
       this proves nothing about which of them is drawn. */
    expect(counted.length).toBeGreaterThan(1)
    expect(mean).not.toBeCloseTo(highest, 2)

    renderAt(`/sr/kalendar/${later.slug}`, 'competitor', ME)

    await screen.findByRole('heading', { level: 1 })

    const said = (value: number) => value.toFixed(1).replace('.', ',')

    expect(await screen.findByText(said(mean))).toBeVisible()
    expect(screen.queryByText(said(highest))).toBeNull()
    expect(screen.getByText(`iz ${String(counted.length)} ocene`)).toBeVisible()

    /* And the stars beside it, drawn to that number: they are the picture of
       it, and a figure with no picture is half of what was asked for. */
    const mark = must(document.querySelector<HTMLElement>('.comments__mark'), 'the mark')

    expect(within(mark).getByRole('img', { hidden: true })).toBeVisible()
  })

  it('starts the list again when the reader walks to another race', async () => {
    /* How far a list has grown belongs to the list, and a different race is a
       different list. React keeps a component across a change of address, so
       without a key the next race opened grown to wherever the last one was
       left: twenty six shown, no button, and the foot claiming that was all of
       them. */
    const real = globalThis.fetch
    const many = (eventId: string, howMany: number, from: number) =>
      Array.from({ length: howMany }, (_, at) => ({
        id: `kom-${eventId}-${String(at)}`,
        eventId,
        memberNumber: '000007',
        who: 'Neko Nekić',
        date: `2010-05-${String(10 + (at % 20)).padStart(2, '0')}`,
        rating: { organisation: 4, value: 4, ambience: 4 },
        body: `Komentar ${String(from + at)}.`,
      }))

    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/comments.json')
        ? new Response(
            JSON.stringify([
              ...many('evt-fruskogorski-maraton-2010-05-08', 23, 1),
              ...many('evt-ironman-70-3-st-polten-2010-05-30', 14, 100),
            ]),
            { status: 200 },
          )
        : real(input))

    try {
      const user = setupUser()
      const { router } = renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

      const list = await screen.findByRole('list', { name: 'Komentari' })
      await user.click(screen.getByRole('button', { name: 'Učitaj još komentara' }))
      expect(within(list).getAllByRole('listitem')).toHaveLength(20)

      await router.navigate('/sr/kalendar/ironman-70-3-st-polten-2010')

      /* Waited for a comment that belongs to the other race: the list of the one
         being left is still on screen for a beat, and asked too early this
         counts the old one and passes whatever the key does. Its own words and
         not its heading, because the heading arrives before the comments do,
         and any of them rather than the first: the list is newest first and the
         first written is the last shown. */
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Ironman 70.3 - St Polten' },
        /* Longer than the default, because this waits for a second screen and
           its data behind a suite that is measuring its own coverage. */
        { timeout: 5000 },
      )

      /* Counted once the list belongs to the other race, which is what the
         second half of the count says: fourteen there, ten of them shown. */
      await waitFor(() => {
        const drawn = within(screen.getByRole('list', { name: 'Komentari' })).getAllByRole(
          'listitem',
        )

        expect(drawn).toHaveLength(10)
        expect(must(drawn[0], 'the newest of them').textContent).toContain('Komentar 1')
      })

      expect(screen.getByRole('button', { name: 'Učitaj još komentara' })).toBeVisible()
    } finally {
      globalThis.fetch = real
    }
  })

  it('shows no overall mark for an event whose only comment carries none', async () => {
    /* The mark over the list is an average of the comments that carry one. A
       comment written before the ratings existed carries none (types.ts), and
       an event holding only that one has nothing to average: what it shows is
       no mark at all rather than a mark of nought, which would be a claim
       nobody made (owner, 11.08.2026). */
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

    const queue = await loadResource<PendingItem[]>('verification')
    const bare = must(
      queue.find(
        (one) =>
          one.queue === 'comments' &&
          one.subjectId !== '' &&
          one.rating.organisation === 0 &&
          one.rating.value === 0 &&
          one.rating.ambience === 0,
      ),
      'a waiting comment with no marks',
    )

    await user.click(within(await cardFor(bare.body)).getByRole('button', { name: 'Odobri' }))

    const event = await eventWithId(bare.subjectId)
    await router.navigate(`/sr/kalendar/${event.slug}`)

    /* The comment is under the event, and there is no figure over it. */
    expect(await underEvent(bare.body)).toBe(true)
    expect(document.querySelector('.comments__mark')).toBeNull()
  })

  it('draws each of the three marks under its own name, not one under all three', async () => {
    /* Read off the record, and off a comment whose three marks differ: given the
       same mark three times, a queue drawing the organisation under all three
       names is indistinguishable from one drawing them right. */
    renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

    const queue = await loadResource<PendingItem[]>('verification')
    const mixed = must(
      queue.find(
        (one) =>
          one.queue === 'comments' &&
          new Set([one.rating.organisation, one.rating.value, one.rating.ambience]).size > 1,
      ),
      'a comment whose marks are not all the same',
    )

    const card = await cardFor(mixed.body)

    for (const [mark, name] of [
      ['organisation', 'Organizacija'],
      ['value', 'Vrednost za novac'],
      ['ambience', 'Ambijent'],
    ] as const) {
      expect(
        within(card).getByRole('img', { name: `${name}: ${mixed.rating[mark]} od 5` }),
      ).toBeInTheDocument()
    }
  })

  it('carries a rating from the form all the way under its event', async () => {
    /* The one path nothing followed end to end: the form writes the id of the
       event beside the name, and without it an approved rating is published
       under no event at all and disappears with nothing saying so. */
    const user = setupUser()
    const { router } = renderAt(`/sr/kalendar/${EVENT}/ocena`, 'superadmin', ME)

    await screen.findByRole('radiogroup', { name: 'Organizacija' })
    await user.type(screen.getByLabelText(/^Komentar/), 'Prva trka u sezoni i dobro postavljena.')
    await rateAll(user, 4)
    await user.click(screen.getByRole('button', { name: 'Pošalji' }))
    await screen.findByText('Ocena je poslata na odobrenje.')

    await router.navigate('/sr/administracija/verifikacija/komentari')

    const mineHere = await cardFor('Prva trka u sezoni i dobro postavljena.')
    const me = must(
      (await loadResource<Competitor[]>('competitors')).find((one) => one.memberNumber === ME),
      'the member who wrote it',
    )

    /* The name as it was on the day, which is what the queue shows the
       moderator and what the card keeps after that member leaves the league
       (types.ts, `who`). Held here because the event page reads it off the
       record instead while the member is still there, so a name left blank by
       the form is invisible on the only screen that would show it. */
    expect(
      within(mineHere).getByText(`Poslao ${me.firstName} ${me.lastName}, član ${ME}`),
    ).toBeInTheDocument()
    /* And the marks the moderator is deciding about, so what is approved here
       can be compared with what appears under the event. */
    for (const mark of ['Organizacija', 'Vrednost za novac', 'Ambijent']) {
      expect(within(mineHere).getByRole('img', { name: `${mark}: 4 od 5` })).toBeInTheDocument()
    }

    await user.click(within(mineHere).getByRole('button', { name: 'Odobri' }))

    await router.navigate(`/sr/kalendar/${EVENT}`)

    expect(await underEvent('Prva trka u sezoni i dobro postavljena.')).toBe(true)

    /* Not only that it arrived, but whose it is and when. The form fills four
       things in beside the marks, and three of them were leaving the card blank
       without anything noticing: the member number is what the portrait and the
       link are looked up by, the name is what the card says after that member
       leaves the league, and the date is the day it was written. */
    const card = must(
      within(screen.getByRole('list', { name: 'Komentari' }))
        .getAllByRole('listitem')
        .find((one) => (one.textContent ?? '').includes('Prva trka u sezoni')),
      'the comment that was just published',
    )
    const mine = within(card).getByRole('link', { name: `${me.firstName} ${me.lastName}` })

    expect(mine).toHaveAttribute('href', `/sr/takmicar/${ME}`)
    /* The year the suite is running in. The day itself is written by the
       screen through Intl, and repeating that here would be the source
       assessing itself. */
    expect(card.textContent).toContain(String(new Date().getFullYear()))

    /* And the marks themselves, which is what the whole walk is about and was
       the one thing it did not check: four given, four approved, four drawn.
       Anything published in their place passed every test there was. */
    for (const mark of ['Organizacija', 'Vrednost za novac', 'Ambijent']) {
      expect(within(card).getByRole('img', { name: `${mark}: 4 od 5` })).toBeInTheDocument()
    }
    expect(card.textContent).toContain('Ukupna ocena: 4')
  })

  /* The number is written in the reader's language, not in the one the portal
     was built in. Held on the queue and on the event both, because each formats
     its own and a hardcoded 'sr' in either reads 4,7 to somebody on /en. */
  it('writes the overall mark in the language the page is read in', async () => {
    const { router } = renderAt('/en/administracija/verifikacija/komentari', 'superadmin')

    const waiting = await screen.findByRole('list', { name: /Čeka|Waiting/ })
    expect(within(waiting).getByText('4.7')).toBeInTheDocument()
    expect(within(waiting).queryByText('4,7')).toBeNull()

    await router.navigate(`/en/kalendar/${EVENT}`)

    /* Read off the whole list rather than off one node: the mark stands in the
       same sentence as the word for it, so it is not a text node of its own. */
    const list = await screen.findByRole('list', { name: /Komentari|Comments/ })
    expect(list.textContent).toMatch(/\d\.\d/)
    expect(list.textContent).not.toMatch(/\d,\d/)

    /* The day the comment was written, the same way. The Serbian date of kom-1
       is "8. 5. 2010." and the English one is "May 8, 2010": one string cannot
       be both, so either spelling proves which language did the writing. */
    expect(list.textContent).toContain('May 8, 2010')
    expect(list.textContent).not.toContain('8. 5. 2010.')
  })

  it('publishes nothing from the queues that are not about comments', async () => {
    /* The merge asks two things of a waiting item: that it was approved, and
       that it is a comment. Without the second, approving a reported change of
       date publishes a card with no words and no marks under a real event, and
       nothing on any screen would say where it came from. */
    const user = setupUser()
    const about = must(
      (await loadResource<PendingItem[]>('verification')).find((one) => one.queue === 'schedule'),
      'a change of date in the record',
    )
    /* Its own event, not one picked in advance: what a widened merge would
       publish is a card on the event the item names, so an event chosen
       anywhere else is a screen the mistake never reaches. */
    const slug = (await eventWithId(about.subjectId)).slug

    /* Read after that event, so the comments are drawn at all: before the race
       the whole section is absent (EventComments.tsx), and "no card appeared"
       would then be true of every screen. */
    const { router } = renderAt(
      '/sr/administracija/verifikacija/termini',
      'superadmin',
      null,
      undefined,
      '2027-05-01',
    )

    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const card = must(
      within(waiting)
        .getAllByRole('listitem')
        .find((one) => (one.textContent ?? '').includes(about.who)),
      'that change of date in the queue',
    )

    await user.click(within(card).getByRole('button', { name: 'Odobri' }))
    await router.navigate(`/sr/kalendar/${slug}`)

    /* The event has no comments, so the sentence that says so is what stands
       there. A card published by mistake takes it away. */
    expect(await screen.findByText('Za ovaj događaj još nema odobrenih komentara.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Komentari' })).toBeNull()
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
    /* Deleting asks for a note since 06.08.2026, which may be left empty, so it
       is two presses rather than one. */
    await user.click(
      within(await cardFor(sent.body)).getByRole('button', { name: /^Obriši: / }),
    )
    await user.click(screen.getByRole('button', { name: 'Obriši komentar' }))
    await router.navigate(`/sr/kalendar/${(await eventWithId(sent.subjectId)).slug}`)

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
    await router.navigate(`/sr/kalendar/${(await eventWithId(sent.subjectId)).slug}`)

    expect(await underEvent(sent.body)).toBe(false)

    /* Back to the queue, and the card found again: the one caught before the
       detour is a node two navigations have since taken down, and clicking it
       does nothing at all while looking exactly like a click. */
    await router.navigate('/sr/administracija/verifikacija/komentari')
    await user.click(within(await cardFor(sent.body)).getByRole('button', { name: 'Odobri' }))

    /* Approving is what publishes it. Until this it wrote a decision into the
       session and the event page went on showing what the file carried, so a
       moderator approved a comment and nothing appeared anywhere. */
    await router.navigate(`/sr/kalendar/${(await eventWithId(sent.subjectId)).slug}`)

    expect(await underEvent(sent.body)).toBe(true)
  })
})

describe('what an event nobody has run yet offers', () => {
  /* The rule is PDL P9: a date in the future is refused. It was kept by hiding
     the two links, which keeps nothing, so each half is held separately: the row
     does not offer them, and the screens behind them refuse. */
  it('offers neither of the two forms in the row', async () => {
    renderAt(`/sr/kalendar/${AHEAD}`, 'competitor', ME, undefined, BEFORE_AHEAD)

    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('link', { name: 'Dodaj komentar' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Prijavi rezultat' })).toBeNull()
  })

  it('refuses the rating at its own address', async () => {
    renderAt(`/sr/kalendar/${AHEAD}/ocena`, 'competitor', ME, undefined, BEFORE_AHEAD)

    expect(await screen.findByRole('heading', { name: 'Ovaj događaj još nije održan' }))
      .toBeVisible()
    expect(screen.queryByRole('radiogroup', { name: /Organizacija/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Nazad na događaj' })).toBeVisible()
  })

  it('refuses the report of a result at its own address', async () => {
    renderAt(`/sr/kalendar/${AHEAD}/prijava`, 'competitor', ME, undefined, BEFORE_AHEAD)

    expect(await screen.findByRole('heading', { name: 'Ovaj događaj još nije održan' }))
      .toBeVisible()
    expect(screen.queryByLabelText(/^Trka/)).toBeNull()
  })

  /* The boundary itself. PDL P9 refuses a date in the future and says nothing
     against the day of the race, and a rating is given on the way home from it:
     that is the whole difference between `>` and `>=` here, and it is a
     difference no test would otherwise see. */
  it('offers the result on the day the race is run, and the rating only after it', async () => {
    /* The boundary the date draws is open on the day itself: a result is
       reported on the way home. The rating is not offered beside it, because a
       rating belongs to somebody with a result on the event and on the day of
       the race nobody has one yet (owner, 11.08.2026). It opens when the result
       is in. */
    renderAt(`/sr/kalendar/${AHEAD}`, 'competitor', ME, undefined, AHEAD_DAY)

    expect(await screen.findByRole('link', { name: 'Prijavi rezultat' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Dodaj komentar' })).toBeNull()
  })

  it('says nothing about comments at all, not even that there are none', async () => {
    /* The sentence saying there are none would stand on the whole of next
       season's calendar and would mean only "not yet", which is the reason the
       results above it are silent there too (EventDetail.tsx).

       Walked from an event that has been run, so the absence is read after the
       comments have arrived: the section is drawn inside a Resource, and asked
       for the moment the name of the event appears it is not there yet on any
       screen at all. */
    const { router } = renderAt(
      `/sr/kalendar/${EVENT}`,
      'competitor',
      ME,
      undefined,
      BEFORE_AHEAD,
    )

    expect(await screen.findByRole('heading', { name: 'Komentari' })).toBeVisible()

    await router.navigate(`/sr/kalendar/${AHEAD_EMPTY}`)
    await screen.findByRole('heading', { level: 1, name: AHEAD_EMPTY_NAME })

    expect(screen.queryByRole('heading', { name: 'Komentari' })).toBeNull()
    expect(screen.queryByText('Za ovaj događaj još nema odobrenih komentara.')).toBeNull()
  })

  it('keeps the comments of an event that has been moved onto a later date', async () => {
    /* Approving a change of date moves an event and its races (types.ts,
       `subjectId`), so a race that has been run can carry tomorrow's date. What
       is suppressed before a race is the sentence saying there are none, never
       a comment somebody wrote: hiding those would take them off the portal
       with nothing anywhere saying why. */
    const comments = await loadResource<EventComment[]>('comments')
    const ahead = await eventAt(AHEAD)
    const moved = must(
      comments.find((one) => one.eventId === ahead.id),
      'a comment on an event dated ahead of the day it is read on',
    )

    renderAt(`/sr/kalendar/${AHEAD}`, 'competitor', ME, undefined, BEFORE_AHEAD)

    expect(await screen.findByRole('heading', { name: 'Komentari' })).toBeVisible()
    expect(screen.getByText(moved.body)).toBeVisible()
  })

  it('stops saying the race has not been run, from the day it is', async () => {
    /* The boundary between `>` and `>=`, which is a difference no other test
       would see. What stands in the way from that day on is the other rule and
       not this one: the rating belongs to whoever has a result on the event
       (owner, 11.08.2026), and on the day of the race nobody has one. */
    renderAt(`/sr/kalendar/${AHEAD}/ocena`, 'competitor', ME, undefined, AHEAD_DAY)

    expect(
      await screen.findByRole('heading', { name: 'Ovaj događaj ocenjuju oni koji su ga istrčali' }),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Ovaj događaj još nije održan' })).toBeNull()
  })

  it('says there are none from the day the race is run', async () => {
    /* The one nobody has commented on: AHEAD carries a comment, which is the
       other case a few lines down. */
    renderAt(`/sr/kalendar/${AHEAD_EMPTY}`, 'competitor', ME, undefined, '2027-01-30')

    expect(await screen.findByRole('heading', { name: 'Komentari' })).toBeVisible()
    expect(
      await screen.findByText('Za ovaj događaj još nema odobrenih komentara.'),
    ).toBeVisible()
  })

  it('takes a reported result on the day the race is run', async () => {
    renderAt(`/sr/kalendar/${AHEAD}/prijava`, 'competitor', ME, undefined, AHEAD_DAY)

    expect(await screen.findByLabelText(/^Trka/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Ovaj događaj još nije održan' })).toBeNull()
  })

  /* And the other half of the row: somebody who runs the portal but is not a
     member of the league has nothing to report and nothing to rate. Held because
     the whole condition could be deleted with the rest of the suite still
     green: the visitor case is answered earlier, by the row drawing nothing at
     all. */
  it('offers neither to an administrator who is not a member', async () => {
    renderAt(`/sr/kalendar/${EVENT}`, 'superadmin')

    /* The row is there: an administrator has the two buttons that edit an
       event, so this is not the empty row a visitor gets. */
    expect(await screen.findByRole('button', { name: 'Kopiranje' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Dodaj komentar' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Prijavi rezultat' })).toBeNull()
  })
})

describe('the comments under an event', () => {
  it('draws each one with its author, the day, and the marks it carries', async () => {
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

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

  it('keeps a comment whose author is in no record at all, with no link', async () => {
    /* The number on the comment answers to nobody. It is not the case below and
       was standing in for it: there the member is in the record and is not to
       be linked to, which is a different question and was the one going wrong. */
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const gone = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes('Nekadašnji član'),
      ),
      'a comment by somebody in no record',
    )

    expect(within(gone).queryByRole('link')).not.toBeInTheDocument()
  })

  it('keeps a comment whose author has left the league, with no link on the name', async () => {
    /* A member whose fee has run out is still in the record and has no visible
       profile (PDL P11), so the card must not link to one: it did, and the link
       led to "Ovog takmičara nema". What they wrote stays where it was
       published, under the name it was published with. */
    const competitors = await loadResource<Competitor[]>('competitors')
    const left = must(
      competitors.find((one) => !one.active),
      'a member who has left the league',
    )
    const comments = await loadResource<EventComment[]>('comments')
    const theirs = must(
      comments.find((one) => one.memberNumber === left.memberNumber),
      'a comment by that member',
    )

    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const card = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes(theirs.body),
      ),
      'that comment under the event',
    )

    expect(within(card).getByText(`${left.firstName} ${left.lastName}`)).toBeInTheDocument()
    expect(within(card).queryByRole('link')).not.toBeInTheDocument()
  })

  it('says a comment from before the ratings carries no mark, all four times', async () => {
    /* Nought on all three is not a rating of nought (types.ts). The three marks
       already said "Bez ocene" and the overall beside them read "Ukupna ocena:
       0,0", which is the same card answering one question two ways. */
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const comments = await loadResource<EventComment[]>('comments')
    const ran = await eventAt(EVENT)
    const old = must(
      comments.find(
        (one) =>
          one.eventId === ran.id &&
          one.rating.organisation === 0 &&
          one.rating.value === 0 &&
          one.rating.ambience === 0,
      ),
      'a comment written before the ratings existed',
    )
    const card = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes(old.body),
      ),
      'that comment under the event',
    )

    expect(within(card).getByText('Ukupna ocena: Bez ocene')).toBeInTheDocument()
    expect(card.textContent).not.toContain('Ukupna ocena: 0,0')
    /* And the three it is the average of, each said the same way. */
    expect(within(card).getAllByRole('img', { name: /: Bez ocene$/ })).toHaveLength(3)
    /* No stars for the overall either, where there is no overall to draw. */
    expect(
      within(card).queryAllByRole('img', { name: /^Ukupna ocena/, hidden: true }),
    ).toHaveLength(0)
  })

  it('withholds the overall where one of the three is missing, and keeps the rest', async () => {
    /* Two marks and a gap is not an average of three. Read as a rating it drew
       "Ukupna ocena: 3,0" beside a mark reading "Bez ocene", which is the card
       the form exists to refuse. What was given is still drawn. */
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const comments = await loadResource<EventComment[]>('comments')
    const ran = await eventAt(EVENT)
    const partial = must(
      comments.find(
        (one) =>
          one.eventId === ran.id &&
          !rated(one.rating) &&
          (one.rating.organisation > 0 || one.rating.value > 0 || one.rating.ambience > 0),
      ),
      'a comment missing one of the three marks',
    )
    const card = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes(partial.body),
      ),
      'that comment under the event',
    )

    expect(within(card).getByText('Ukupna ocena: Bez ocene')).toBeInTheDocument()
    expect(
      within(card).getByRole('img', { name: `Organizacija: ${partial.rating.organisation} od 5` }),
    ).toBeInTheDocument()
    expect(within(card).getAllByRole('img', { name: /: Bez ocene$/ })).toHaveLength(1)

    /* And the picture, which said the opposite of the words beside it: drawn
       from the average whatever the record held, it filled three stars next to
       "Bez ocene". Read with `hidden`, because it is out of what is spoken. */
    expect(
      within(card).queryAllByRole('img', { name: /^Ukupna ocena/, hidden: true }),
    ).toHaveLength(0)
  })

  it('draws no empty paragraph where nobody wrote anything', async () => {
    /* The comment is optional, so a rating with no words is a card of marks and
       nothing else. Drawn unconditionally it is an empty paragraph: a gap under
       the marks that reads as something that failed to load. */
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const comments = await loadResource<EventComment[]>('comments')
    const ran = await eventAt(EVENT)
    const wordless = must(
      comments.find((one) => one.eventId === ran.id && one.body === ''),
      'a rating given with no words',
    )
    const card = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes(wordless.who),
      ),
      'that rating under the event',
    )

    /* Read by what is on the card rather than by the class the paragraph wears:
       a card with no words has one paragraph, the day it was written, and a
       second empty one would be a second. */
    expect(paragraphsIn(card)).toEqual([wordless.who, formatDate(wordless.date, 'sr-Latn')])

    /* And the other side of it, so the check above is known to be looking at
       the right thing: a comment that does have words draws exactly one. */
    const spoken = must(
      comments.find((one) => one.eventId === ran.id && one.body !== ''),
      'a comment with words',
    )
    const said = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes(spoken.body),
      ),
      'that comment under the event',
    )

    expect(paragraphsIn(said)).toEqual([
      whoOf(said),
      formatDate(spoken.date, 'sr-Latn'),
      spoken.body,
    ])
  })

  it('draws the portrait, the marks and the words, each of them', async () => {
    /* Every part the owner named (06.08.2026), because each is one line of
       markup and any one of them can go quietly: the portrait is a drawing with
       no text, the marks are pictures, and the body is a paragraph that is
       allowed to be empty. */
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

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

  it('draws the overall to the figure itself, and says the figure once', async () => {
    /* The stars beside the figure are hidden from a reader, which is right: the
       figure is the fact and hearing both is hearing one number twice. Hidden
       means no role, so this is the one thing on these screens read out of the
       markup rather than by role, and it is read because the alternative is a
       rounding nobody would notice: 4,7 drawn up is five filled stars saying
       what nobody gave, and 4,7 drawn down is four, saying less than the number
       beside it. The last star is cut across at the remainder (owner,
       11.08.2026).

       Read off the width of the cut, which is a number in the markup: jsdom
       computes no layout, so the drawing has to say in figures what it does in
       ink.

       `getByRole('img', { hidden: true })` would find it by role, but it would
       also find it if the `aria-hidden` came off, which is the other half of
       what this holds. */
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const comments = await loadResource<EventComment[]>('comments')
    const uneven = must(
      comments.find((one) => Number.isInteger(overall(one.rating)) === false),
      'a comment whose overall is not a whole number',
    )
    const card = must(
      (await screen.findAllByRole('listitem')).find((one) =>
        (one.textContent ?? '').includes(uneven.who),
      ),
      'that comment under the event',
    )
    const mark = overall(uneven.rating)
    /* Named by the number it draws, written the way the portal writes numbers:
       the stars used to be drawn to the whole below the figure and said so, and
       now they say the figure. */
    const named = { name: `Ukupna ocena: ${mark.toString().replace('.', ',')} od 5` }

    /* Out of what is read aloud, and found by that: the figure beside it says
       the number, so a reader hearing the stars as well hears one number twice.
       Asked for without `hidden` there is nothing to find, which is the whole
       claim; asked for with it there is exactly one. */
    expect(within(card).queryAllByRole('img', named)).toHaveLength(0)

    const stars = must(
      within(card).getAllByRole('img', { ...named, hidden: true })[0],
      'the stars beside the figure',
    )
    /* The drawing itself, which no role can reach: a filled star and an empty
       one are one shape and differ by an attribute (Stars.tsx). */
    const filled = [...stars.querySelectorAll('path')].filter(
      (one) => one.getAttribute('fill') === 'currentColor',
    )

    /* The whole ones, and one more that is cut. */
    expect(filled).toHaveLength(Math.ceil(mark))

    const cut = must(stars.querySelector('clipPath rect'), 'the cut across the last star')
    /* 2.6 is where the star begins across the box it is drawn in and 18.8 is
       how far it runs, so the remainder is measured on the star and not on the
       box around it. */
    expect(Number(cut.getAttribute('width'))).toBeCloseTo(2.6 + 18.8 * (mark % 1), 5)
    /* And the figure itself, said once and named. */
    expect(
      within(card).getAllByText(
        `Ukupna ocena: ${overall(uneven.rating).toString().replace('.', ',')}`,
      ),
    ).toHaveLength(1)
  })

  it('puts the newest comment first', async () => {
    /* The record carries three comments on this event on three days, which it
       has to for this to say anything: written on one day, the sorted list and
       the unsorted one are the same list and the sort is unheld. */
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    /* By the event the address answers with, not by the address itself: an
       address is the name and the year since 10.08.2026, and an id carries the
       whole day. */
    const ran = await eventAt(EVENT)
    const comments = (await loadResource<EventComment[]>('comments')).filter(
      (one) => one.eventId === ran.id,
    )

    expect(comments.length).toBeGreaterThan(1)

    const drawn = (await screen.findAllByRole('listitem'))
      .map((one) => comments.find((c) => (one.textContent ?? '').includes(c.who))?.date)
      .filter((one): one is string => one !== undefined)

    expect([...drawn].sort((left, right) => right.localeCompare(left))).toEqual(drawn)
  })

  it('is not read by a visitor at all, and says as much', async () => {
    /* Owner, 11.08.2026: „komentare vide samo prijavljeni članovi BTL. Drugim
       (posetiocima) se ne prikazuju." Said rather than silently absent: a
       section that is simply not there reads as an event nobody has said
       anything about. */
    renderAt(`/sr/kalendar/${EVENT}`)

    await screen.findByRole('heading', { level: 1 })

    expect(await screen.findByText('Komentare vide prijavljeni članovi.')).toBeVisible()
    expect(screen.queryByRole('list', { name: 'Komentari' })).toBeNull()
    /* And neither is the mark they add up to, which is read out of them. */
    expect(document.querySelector('.comments__mark')).toBeNull()
  })

  it('says nothing at all to a visitor on a race still to be run', async () => {
    /* Not even that the comments are for members. Said on a future event, the
       line appeared on exactly those whose earlier editions carry something and
       was missing from the rest, so the sentence meant to keep what was said
       from a visitor told them which race there is something to read about.
       Šidski novogodišnji maraton 2027 is a copy of the 2024 running, and that
       one has been commented on. */
    const AHEAD = '/sr/kalendar/sidski-novogodisnji-maraton-2027'

    /* First from a member's side, for two reasons: it proves this event really
       does carry what an earlier edition of it was told, so the absence below is
       an absence of something; and it leaves the three files in the cache
       (data/client.ts), so the visitor's page is whole at its first paint and
       „not there yet" cannot pass for „not shown". */
    const { unmount } = renderAt(AHEAD, 'competitor', ME)
    await screen.findByRole('list', { name: 'Komentari' })
    unmount()

    renderAt(AHEAD)

    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByText('Komentare vide prijavljeni članovi.')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Komentari' })).toBeNull()
  })

  it('still shows a member what the earlier editions said about it', async () => {
    /* The other half of the same event: what the visitor is not shown is shown
       to whoever is signed in, or the guard above would have quietly undone the
       chain of editions. */
    renderAt('/sr/kalendar/sidski-novogodisnji-maraton-2027', 'competitor', ME)

    expect(await screen.findByRole('list', { name: 'Komentari' })).toBeVisible()
  })

  it('is read by a moderator, who has no member number of their own', async () => {
    /* The rule is about visitors and not about member numbers: a queue that
       publishes a comment leads straight to the event to look at it, and the
       moderator who approved it has no number. */
    renderAt(`/sr/kalendar/${EVENT}`, 'superadmin')

    expect(await screen.findByRole('list', { name: 'Komentari' })).toBeVisible()
  })

  it('says so where nobody has commented yet', async () => {
    renderAt('/sr/kalendar/jadovnicki-ultramaraton-2026', 'competitor', ME)

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

  it('works the overall out only when all three were given', () => {
    /* The overall is the average of the three (PDL P6), so two of them and a
       gap is not an overall of anything: read as one it printed 1,7 beside two
       marks reading "Bez ocene", which is the card the form refuses to send.
       The marks that were given are still drawn; only the figure is withheld. */
    expect(rated({ organisation: 4, value: 4, ambience: 3 })).toBe(true)
    expect(rated({ organisation: 0, value: 0, ambience: 0 })).toBe(false)
    expect(rated({ organisation: 5, value: 0, ambience: 0 })).toBe(false)
    expect(rated({ organisation: 0, value: 5, ambience: 0 })).toBe(false)
    expect(rated({ organisation: 0, value: 0, ambience: 5 })).toBe(false)
    expect(rated({ organisation: 5, value: 4, ambience: 0 })).toBe(false)
  })
})
