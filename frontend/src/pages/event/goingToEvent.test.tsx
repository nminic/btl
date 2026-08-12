import { screen, within } from '@testing-library/react'
import { loadResource } from '../../data/client'
import type { Attending, BtlEvent, Competitor } from '../../data/types'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'

/**
 * Saying you are going to a race, and writing to somebody else who is.
 *
 * The decision is old (PDL P10: signing up through the portal is a stated
 * intention and the inbox exists so two people going to the same race in
 * another town can share a car); what is new on 11.08.2026 is that it is on the
 * screen, that it is a switch, and that both halves are for members only.
 */

/** Somebody signed in. */
const ME = '000007'

/** An event ahead of us that somebody has already said they are going to, and
 *  the day it is read on. Read off the record, so the fixture may change under
 *  this without it saying something untrue. */
async function upcoming(): Promise<{ event: BtlEvent; going: Attending[]; day: string }> {
  const events = await loadResource<BtlEvent[]>('events')
  const attendance = await loadResource<Attending[]>('attendance')
  /* The busiest of them, because half of what is under test needs two people:
     an envelope stands beside every name but your own, so a race one person is
     going to has a list and no envelope on it. */
  const counted = new Map<string, number>()

  for (const one of attendance) {
    counted.set(one.eventId, (counted.get(one.eventId) ?? 0) + 1)
  }

  const busiest = [...counted.entries()].sort((left, right) => right[1] - left[1])[0]
  const event = must(
    events.find((one) => one.id === must(busiest, 'a race somebody is going to')[0]),
    'the event they are going to',
  )

  return {
    event,
    going: attendance.filter((one) => one.eventId === event.id),
    /* A day before it, so it is ahead of us whatever day the suite is run on. */
    day: '2026-08-01',
  }
}

describe('who is going to a race', () => {
  it('is not shown to a visitor at all', async () => {
    /* Names of people and a way to write to them are not a public directory
       (owner, 11.08.2026). */
    const { event, day } = await upcoming()

    renderAt(`/sr/kalendar/${event.slug}`, 'visitor', null, undefined, day)

    await screen.findByRole('heading', { level: 1, name: event.name })
    expect(screen.queryByRole('heading', { name: 'Ko ide' })).toBeNull()
  })

  it('lists everybody who has said so, to a member', async () => {
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const named = going
      .map((one) => competitors.find((each) => each.memberNumber === one.memberNumber))
      .filter((one) => one !== undefined && one.active)

    expect(named.length).toBeGreaterThan(0)

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', ME, undefined, day)

    const list = await screen.findByRole('list', { name: 'Ko ide' })

    expect(within(list).getAllByRole('listitem')).toHaveLength(named.length)
  })

  it('is not offered at all on a race that has been run', async () => {
    /* Saying you are going to something already run is not an intention, it is a
       memory, and the portal has results for that. */
    const events = await loadResource<BtlEvent[]>('events')
    const past = must(
      events.find((one) => one.date < '2020-01-01'),
      'a race long since run',
    )

    renderAt(`/sr/kalendar/${past.slug}`, 'competitor', ME)

    await screen.findByRole('heading', { level: 1, name: past.name })
    expect(screen.queryByRole('heading', { name: 'Ko ide' })).toBeNull()
  })
})

describe('the switch that says you are going', () => {
  it('puts the member on the list, and says which of the two it is in', async () => {
    const user = setupUser()
    const { event, going, day } = await upcoming()

    expect(going.some((one) => one.memberNumber === ME)).toBe(false)

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', ME, undefined, day)

    const button = await screen.findByRole('button', { name: 'Idem na ovaj događaj' })
    /* The words do not change: `aria-pressed` is what says which of the two it
       is in, and a label that said so as well would be the state read out
       twice. */
    expect(button).toHaveAttribute('aria-pressed', 'false')

    const before = within(screen.getByRole('list', { name: 'Ko ide' })).getAllByRole('listitem')

    await user.click(button)

    expect(screen.getByRole('button', { name: 'Idem na ovaj događaj' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      within(screen.getByRole('list', { name: 'Ko ide' })).getAllByRole('listitem'),
    ).toHaveLength(before.length + 1)
  })

  it('takes the member off the list again, which is what makes it a switch', async () => {
    /* Owner, 11.08.2026: „Ako ponovo kliknem na njega i isključim ga, automatski
       treba i da se sklonim sa liste posetioca događaja." */
    const user = setupUser()
    const { event, day } = await upcoming()

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', ME, undefined, day)

    await user.click(await screen.findByRole('button', { name: 'Idem na ovaj događaj' }))

    const withMe = within(screen.getByRole('list', { name: 'Ko ide' })).getAllByRole('listitem')

    await user.click(screen.getByRole('button', { name: 'Idem na ovaj događaj' }))

    expect(
      within(screen.getByRole('list', { name: 'Ko ide' })).getAllByRole('listitem'),
    ).toHaveLength(withMe.length - 1)
    expect(screen.getByRole('button', { name: 'Idem na ovaj događaj' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('takes a member off a list the file has them on', async () => {
    /* The harder half: the switch has to be able to say no to what the record
       says yes to, which is why it is a value and not an absence. */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const already = must(going[0], 'somebody the file has going')
    const competitors = await loadResource<Competitor[]>('competitors')
    const who = must(
      competitors.find((one) => one.memberNumber === already.memberNumber),
      'their record',
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', already.memberNumber, undefined, day)

    const list = await screen.findByRole('list', { name: 'Ko ide' })

    expect(within(list).getByText(`${who.firstName} ${who.lastName}`)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Idem na ovaj događaj' }))

    /* Out of the list and not out of the page: the header carries the name of
       whoever is signed in, and they are still signed in. */
    expect(
      within(screen.getByRole('list', { name: 'Ko ide' })).queryByText(
        `${who.firstName} ${who.lastName}`,
      ),
    ).toBeNull()
  })

  it('says so where nobody has said they are going', async () => {
    const events = await loadResource<BtlEvent[]>('events')
    const attendance = await loadResource<Attending[]>('attendance')
    const going = new Set(attendance.map((one) => one.eventId))
    const alone = must(
      events.find((one) => one.date > '2027-01-01' && !going.has(one.id)),
      'an event nobody has said they are going to',
    )

    renderAt(`/sr/kalendar/${alone.slug}`, 'competitor', ME, undefined, '2026-08-01')

    expect(await screen.findByText('Još se niko nije prijavio.')).toBeVisible()
  })
})

describe('writing to somebody else who is going', () => {
  it('offers an envelope beside every name but your own', async () => {
    const { event, going, day } = await upcoming()
    const already = must(going[0], 'somebody the file has going')

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', already.memberNumber, undefined, day)

    const list = await screen.findByRole('list', { name: 'Ko ide' })
    const rows = within(list).getAllByRole('listitem')

    /* One fewer envelope than there are names: the portal talking to itself is
       not a message. */
    expect(rows.length).toBeGreaterThan(1)
    expect(within(list).getAllByRole('button')).toHaveLength(rows.length - 1)
  })

  it('opens a fresh note when another envelope is pressed', async () => {
    /* Keyed by whoever is being written to, so the second envelope is a new
       note and not the first one's confirmation standing under the list. */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const two = going
      .map((one) => competitors.find((each) => each.memberNumber === one.memberNumber))
      .filter((one): one is Competitor => one !== undefined && one.active)
      .slice(0, 2)
    const first = must(two[0], 'the first of them')
    const second = must(two[1], 'the second of them')

    /* Signed in as somebody not on the list, so every name carries an
       envelope. */
    const outsider = must(
      competitors.find(
        (one) => one.active && !going.some((each) => each.memberNumber === one.memberNumber),
      ),
      'a member not going to it',
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', outsider.memberNumber, undefined, day)

    const write = async (who: Competitor) => {
      await user.click(
        await screen.findByRole('button', { name: `Piši članu ${who.firstName} ${who.lastName}` }),
      )
    }

    await write(first)
    /* Obligatory, and it says so the way every field on the portal does since
       12.08.2026: a star, `aria-required`, and one line saying what the star
       means. Before that the box carried the browser's own `required`, and an
       empty send was refused by Chrome in English, on a Serbian page. */
    const box = screen.getByRole('textbox', {
      name: `Piši članu ${first.firstName} ${first.lastName}`,
    })

    expect(box).toHaveAttribute('aria-required', 'true')
    expect(box).not.toHaveAttribute('required')
    /* And the form answers for its own rules rather than leaving them to the
       browser, which is the other half of the same decision: whatever the
       browser refuses, it refuses in its own language. */
    expect(must(box.closest('form'), 'the form it stands in')).toHaveAttribute('novalidate')
    expect(screen.getByText('Polja sa zvezdicom su obavezna.')).toBeVisible()
    expect(must(box.closest('.field'), 'the field it stands in').querySelector('.field__required'))
      .not.toBeNull()

    await user.type(
      screen.getByRole('textbox', { name: `Piši članu ${first.firstName} ${first.lastName}` }),
      'Prvo pismo.',
    )
    await user.click(screen.getByRole('button', { name: 'Pošalji poruku' }))
    await screen.findByText(new RegExp(`^Poruka je poslata članu ${first.firstName}`))

    await write(second)

    /* A box again, and for the other person. */
    expect(
      screen.getByRole('textbox', { name: `Piši članu ${second.firstName} ${second.lastName}` }),
    ).toHaveValue('')
    expect(screen.queryByText(new RegExp(`^Poruka je poslata članu ${first.firstName}`))).toBeNull()
  })

  it('closes the confirmation, so the same envelope can be pressed again', async () => {
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const them = must(
      competitors.find(
        (one) => one.active && going.some((each) => each.memberNumber === one.memberNumber),
      ),
      'somebody going to it',
    )

    const outsider = must(
      competitors.find(
        (one) => one.active && !going.some((each) => each.memberNumber === one.memberNumber),
      ),
      'a member not going to it',
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', outsider.memberNumber, undefined, day)

    const envelope = await screen.findByRole('button', {
      name: `Piši članu ${them.firstName} ${them.lastName}`,
    })

    const box = () =>
      screen.getByRole('textbox', { name: `Piši članu ${them.firstName} ${them.lastName}` })

    await user.click(envelope)

    /* And the box the envelope opened is where the keyboard is put. It is drawn
       under the whole list, so without this the way to it from the first row of
       an event with twenty going is nineteen more envelopes. */
    expect(box()).toHaveFocus()

    await user.type(box(), 'Prvo pismo.')
    await user.click(screen.getByRole('button', { name: 'Pošalji poruku' }))

    /* By its words, because the page carries other live regions: the list that
       grows as it is read keeps one open from its first render (LoadMore). */
    const said = await screen.findByText(
      new RegExp(`^Poruka je poslata članu ${them.firstName}`),
    )

    /* And it is a live region, so a reader who cannot see it is told: it
       appears in the same breath as the form it replaced, and a line that only
       appears says nothing to anybody not looking at it (WCAG 2.2 SC 4.1.3). */
    expect(said).toHaveAttribute('role', 'status')

    /* And it holds the focus the submit button was holding, since it is what
       replaced it: without that the focus falls to the page and a keyboard
       reader is put back at the top of the document. */
    expect(said).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Zatvori' }))
    await user.click(envelope)

    expect(box()).toHaveValue('')
  })

  it('lets the note be abandoned, which is the way out of a box nobody wanted', async () => {
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const already = must(going[0], 'somebody the file has going')
    const competitors = await loadResource<Competitor[]>('competitors')
    const them = must(
      competitors.find(
        (one) =>
          one.active &&
          one.memberNumber !== already.memberNumber &&
          going.some((each) => each.memberNumber === one.memberNumber),
      ),
      'somebody else going to it',
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', already.memberNumber, undefined, day)

    await user.click(
      await screen.findByRole('button', {
        name: `Piši članu ${them.firstName} ${them.lastName}`,
      }),
    )

    expect(
      screen.getByRole('textbox', { name: `Piši članu ${them.firstName} ${them.lastName}` }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Zatvori' }))

    expect(
      screen.queryByRole('textbox', { name: `Piši članu ${them.firstName} ${them.lastName}` }),
    ).toBeNull()
  })

  it('writes as a member of the league where the writer has no record yet', async () => {
    /* The number is handed out when the fee is recorded (PDL P8) and the list of
       members is read separately, so for a moment there is a signed-in number
       with nothing behind it. The note still goes; what it cannot carry is a
       name nobody has. */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const them = must(
      competitors.find(
        (one) => one.active && going.some((each) => each.memberNumber === one.memberNumber),
      ),
      'somebody going to it',
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', '999999', undefined, day)

    await user.click(
      await screen.findByRole('button', {
        name: `Piši članu ${them.firstName} ${them.lastName}`,
      }),
    )
    await user.type(
      screen.getByRole('textbox', { name: `Piši članu ${them.firstName} ${them.lastName}` }),
      'Idem i ja, javi se.',
    )
    await user.click(screen.getByRole('button', { name: 'Pošalji poruku' }))

    expect(
      await screen.findByText(
        `Poruka je poslata članu ${them.firstName} ${them.lastName}, u Poruke na portalu.`,
      ),
    ).toBeVisible()
  })

  it('writes to their inbox on the portal, and not to their email', async () => {
    /* Owner, 11.08.2026: „To ne stiže na mail nego njemu u portalski inbox." */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const already = must(going[0], 'somebody the file has going')
    const competitors = await loadResource<Competitor[]>('competitors')
    const them = must(
      competitors.find(
        (one) => one.active && one.memberNumber !== already.memberNumber && going.some(
          (each) => each.memberNumber === one.memberNumber,
        ),
      ),
      'somebody else going to it',
    )

    const { router } = renderAt(
      `/sr/kalendar/${event.slug}`,
      'competitor',
      already.memberNumber,
      undefined,
      day,
    )

    await user.click(
      await screen.findByRole('button', {
        name: `Piši članu ${them.firstName} ${them.lastName}`,
      }),
    )
    await user.type(
      screen.getByRole('textbox', { name: `Piši članu ${them.firstName} ${them.lastName}` }),
      'Imam mesta u kolima, javi se.',
    )
    await user.click(screen.getByRole('button', { name: 'Pošalji poruku' }))

    /* And it went to them and not to the league: the same visit walks to the
       inbox, which is where the portal keeps it (owner, 11.08.2026). A fresh
       render would be a fresh session and an empty inbox. */
    /* By its words, because the page carries other live regions: the list that
       grows as it is read keeps one open from its first render (LoadMore). */
    expect(
      await screen.findByText(
        `Poruka je poslata članu ${them.firstName} ${them.lastName}, u Poruke na portalu.`,
      ),
    ).toBeVisible()

    /* And it went to them rather than to the sender: the inbox shows what was
       written to whoever is signed in (session/context.ts, `Message.to`), so a
       note that lands in the writer's own inbox is a note addressed to the
       wrong person. Read this way because a session belongs to one member: the
       recipient's inbox cannot be opened without becoming them, and becoming
       them is a fresh session with nothing in it. */
    await router.navigate('/sr/poruke')

    await screen.findByRole('heading', { level: 1, name: 'Poruke' })
    expect(screen.queryByText('Imam mesta u kolima, javi se.')).toBeNull()
  })
})

describe('a name the list cannot lead to', () => {
  /* Two rows the record cannot fully answer, and both are on the same event in
     the data on purpose: a member who is no longer active (their profile is not
     shown at all, PDL P11) and a number with nothing behind it, which happens
     while a registration is going through. Neither may vanish from the list:
     the switch and the list are one answer to one question, and a switch
     saying „you are going" over a list saying „nobody is" is the screen
     contradicting itself. */
  async function withStrangers() {
    const events = await loadResource<BtlEvent[]>('events')
    const attendance = await loadResource<Attending[]>('attendance')
    const competitors = await loadResource<Competitor[]>('competitors')
    const known = new Set(competitors.filter((one) => one.active).map((one) => one.memberNumber))
    const stranger = must(
      attendance.find((one) => !known.has(one.memberNumber)),
      'somebody going who has no visible record',
    )

    return {
      event: must(
        events.find((one) => one.id === stranger.eventId),
        'the event they are going to',
      ),
      strangers: attendance.filter(
        (one) => one.eventId === stranger.eventId && !known.has(one.memberNumber),
      ),
    }
  }

  it('draws them as plain words rather than dropping them', async () => {
    const { event, strangers } = await withStrangers()

    expect(strangers.length).toBeGreaterThan(1)

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', ME, undefined, '2026-08-01')

    const list = await screen.findByRole('list', { name: 'Ko ide' })

    expect(within(list).getAllByText('Član lige')).toHaveLength(strangers.length)
  })

  it('keeps the named ones above those it cannot name, and in order', async () => {
    /* Sorted on the surname alone, a row with no record sorted on an empty
       string, and an empty string comes before every letter: the members the
       portal cannot name stood at the head of the list, over people with names.
       Nothing said so, because nothing in this file asked about the order. */
    const { event } = await withStrangers()

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', ME, undefined, '2026-08-01')

    const list = await screen.findByRole('list', { name: 'Ko ide' })
    const rows = within(list)
      .getAllByRole('listitem')
      .map((one) => one.textContent ?? '')
    const nameless = rows.map((one, index) => (one.startsWith('Član lige') ? index : -1))
      .filter((index) => index !== -1)
    const named = rows.map((one, index) => (one.startsWith('Član lige') ? -1 : index))
      .filter((index) => index !== -1)

    expect(nameless.length).toBeGreaterThan(0)
    expect(named.length).toBeGreaterThan(0)
    /* Every named row above every one that is not. */
    expect(Math.max(...named)).toBeLessThan(Math.min(...nameless))

    /* And the named ones alphabetically among themselves, by surname, the way
       the league lists people everywhere else. */
    const surnames = named.map((index) => must(rows[index], 'a named row').split(' ').slice(-1)[0] ?? '')

    expect(surnames).toEqual([...surnames].sort((left, right) => left.localeCompare(right, 'sr')))
  })

  it('offers no envelope to somebody there is no record of', async () => {
    /* There is nowhere to write to and nobody to name in the note. */
    const { event, strangers } = await withStrangers()

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', ME, undefined, '2026-08-01')

    const list = await screen.findByRole('list', { name: 'Ko ide' })
    const rows = within(list).getAllByRole('listitem')

    expect(within(list).getAllByRole('button')).toHaveLength(rows.length - strangers.length)
  })

  it('says the member is going even where their own row cannot be named', async () => {
    /* Signed in as the number with nothing behind it: the switch and the list
       have to agree about them as much as about anybody else. */
    const { event, strangers } = await withStrangers()
    const stranger = must(strangers[0], 'one of them')

    renderAt(
      `/sr/kalendar/${event.slug}`,
      'competitor',
      stranger.memberNumber,
      undefined,
      '2026-08-01',
    )

    expect(await screen.findByRole('button', { name: 'Idem na ovaj događaj' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('is read by the superadmin, who has nothing to say about going', async () => {
    /* The same question decides who reads this as decides who reads the comments
       (event/readsComments.ts), and a moderator has no member number of their
       own: written as „has a number", the rule hid the list from the very people
       the queue sends to an event to look at it. What a number is needed for is
       the switch, and that is the half a moderator does not get. */
    const { event } = await upcoming()

    renderAt(`/sr/kalendar/${event.slug}`, 'superadmin', null, undefined, '2026-08-01')

    expect(await screen.findByRole('list', { name: 'Ko ide' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Idem na ovaj događaj' })).toBeNull()
    /* And no envelope either: writing to a member about sharing a car is a
       thing members do with each other, and the moderation has its own way of
       writing to somebody (PDL P22). Offered, it would be a button that opens
       nothing, since the note itself is written as whoever is sending it. */
    expect(screen.queryByRole('button', { name: /^Piši članu/ })).toBeNull()
  })

  it('agrees with the list about a member the list cannot name', async () => {
    /* The half that was wrong and that nothing could see: the switch was
       counted over the raw numbers and the list was drawn over the records, so
       a member with no record read „you are going" over „nobody is". */
    const user = setupUser()
    const { event, strangers } = await withStrangers()
    const stranger = must(strangers[0], 'one of them')

    renderAt(
      `/sr/kalendar/${event.slug}`,
      'competitor',
      stranger.memberNumber,
      undefined,
      '2026-08-01',
    )

    const rows = () =>
      within(screen.getByRole('list', { name: 'Ko ide' })).getAllByRole('listitem').length
    const before = rows()

    await user.click(screen.getByRole('button', { name: 'Idem na ovaj događaj' }))

    /* Off the list and off the switch, together. */
    expect(screen.getByRole('button', { name: 'Idem na ovaj događaj' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(rows()).toBe(before - 1)
  })
})
