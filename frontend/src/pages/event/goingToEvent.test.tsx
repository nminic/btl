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

    const button = await screen.findByRole('button', { name: 'Prijavi da ideš' })
    /* Not by the words alone: they change, and a reader who cannot see the
       button hears only the words. */
    expect(button).toHaveAttribute('aria-pressed', 'false')

    const before = within(screen.getByRole('list', { name: 'Ko ide' })).getAllByRole('listitem')

    await user.click(button)

    expect(screen.getByRole('button', { name: 'Ideš. Otkaži prijavu' })).toHaveAttribute(
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

    await user.click(await screen.findByRole('button', { name: 'Prijavi da ideš' }))

    const withMe = within(screen.getByRole('list', { name: 'Ko ide' })).getAllByRole('listitem')

    await user.click(screen.getByRole('button', { name: 'Ideš. Otkaži prijavu' }))

    expect(
      within(screen.getByRole('list', { name: 'Ko ide' })).getAllByRole('listitem'),
    ).toHaveLength(withMe.length - 1)
    expect(screen.getByRole('button', { name: 'Prijavi da ideš' })).toBeVisible()
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

    await user.click(screen.getByRole('button', { name: 'Ideš. Otkaži prijavu' }))

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

    await user.click(screen.getByRole('button', { name: 'Odustani' }))

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
        `Poruka je poslata članu ${them.firstName} ${them.lastName}, u portalski inboks.`,
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
        `Poruka je poslata članu ${them.firstName} ${them.lastName}, u portalski inboks.`,
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
