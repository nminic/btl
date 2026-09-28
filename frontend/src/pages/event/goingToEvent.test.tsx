import { cleanup, screen, within } from '@testing-library/react'
import { clearResourceCache, loadResource } from '../../data/client'
import { answeredWith, membersAsServed, refused, serverThat } from '../../test/serverAnswers'
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
  const counted = new Map<number, number>()

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

/**
 * EVERY CASE IN THIS FILE HAS A SERVER IN FRONT OF IT FOR `/api/inbox`, AND THAT IS A
 * MEASUREMENT RATHER THAN TIDINESS.
 *
 * <p><b>What happens without one.</b> `test/setup.ts` answers a `POST` off the disc for
 * any address its `fileFor` maps to a generated file, and it maps `/api/inbox` to
 * `src/test/mock/inbox.json`, WHICH EXISTS. So a `POST` there comes back <b>200 with an
 * array</b>, `askTheServer` reads 200 as „done", and the confirmation „Poruka je poslata
 * članu…" appears over a write nothing recognised as one. That is two sources for one
 * screen state - the route said yes, or a `GET` fixture was served under a `POST` - and a
 * case resting on it measures neither.
 *
 * <p><b>The floor in `test/setup.ts` is deliberately NOT widened to cover it.</b> That file
 * is one for every branch in flight, and this increment does not need it moved; the hole is
 * reported as its own item rather than patched from here. The mutation that proves this
 * stand-in is load-bearing is therefore „take it away and let the fixture answer", and the
 * cases that read what was sent are what fail.
 *
 * <p><b>And it serves the addressee's mail keyed on the MEMBER NUMBER</b>, which is the join
 * between the two halves of the axis about who gets it: this suite cannot open somebody
 * else's inbox without becoming them, and becoming them is a second render. A note posted to
 * one number is served to that number and to no other, so addressing it to the league, to
 * the sender or to a third member empties the screen the note is looked for on.
 */
const posted: Record<string, unknown>[] = []

/** The sender's name AS THE SERVER CHOSE IT, never as the screen sent it.
 *  `InboxWriteApi.nameTheLeagueKnowsHimBy` reads `competitor.first_name` and `last_name`
 *  off the sender's own row, so this name is one no request could carry: the request has
 *  no `from` at all. A case that finds it on the addressee's screen has found the
 *  server's answer and not an echo of what was typed. */
const THE_SERVER_NAMES_THE_SENDER = 'Pošiljalac Sa Servera'

/** WHAT THE ADDRESSEE'S MAIL ALREADY HOLDS, so no case is ever about the only message of
 *  its kind, and dated AFTER the note so that the note is never the first row either. */
const ALREADY_IN_HIS_MAIL = {
  id: 9001,
  from: 'Balkanska trkačka liga',
  subject: 'Članarina je evidentirana',
  body: 'Tvoja članarina za sezonu 2027 je evidentirana.',
  date: '2026-09-30',
  read: true,
  teamInvitationId: null,
  pairInviteId: null,
}

let inboxServer: { stop: () => void } | null = null

/**
 * What a request body carried, key by key, WITHOUT CLAIMING ANY SHAPE FOR IT.
 *
 * <p>Read the way `account/askTheServer.ts` reads an answer and for the same reason
 * (ADL A14, and this repo's ban on `as`): what comes off the wire is `unknown` and is
 * narrowed by looking at it. Every key is kept, including one no route would read, which
 * is exactly what the case about „three fields and no more" needs to be able to see.
 */
function everyFieldIn(sent: unknown): Record<string, unknown> {
  const fields: Record<string, unknown> = {}

  if (typeof sent !== 'object' || sent === null) {
    return fields
  }

  for (const name of Object.keys(sent)) {
    const value: unknown = Reflect.get(sent, name)

    fields[name] = value
  }

  return fields
}

/**
 * Puts the route in front of the disc reader, serving `GET /api/inbox` as `mine` would see
 * it.
 *
 * @param mine whose mail the `GET` answers, or nothing where no case is going to read one
 */
function anInboxOnTheServer(mine: string | null): void {
  /* Stopped before it is replaced, always: `serverThat` remembers whatever `fetch` was
     when it was installed, so installing twice over would leave the first wrapper behind
     as the thing the last `stop` restores. */
  inboxServer?.stop()
  inboxServer = serverThat((path, init) => {
    if (path !== '/api/inbox') {
      return null
    }

    if (init?.method === 'POST') {
      const said: unknown = JSON.parse(String(init.body))
      const fields = everyFieldIn(said)

      posted.push(fields)

      /* What the route really answers: 201, and the row as it now stands, with the title
         read back off it (`InboxWriteApi.Sent`). */
      return new Response(JSON.stringify({ id: 4242, subject: String(fields['subject'] ?? '') }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify([
        ALREADY_IN_HIS_MAIL,
        ...posted
          .filter((one) => one['to'] === mine)
          .map((one, index) => ({
            id: 5000 + index,
            from: THE_SERVER_NAMES_THE_SENDER,
            subject: String(one['subject'] ?? ''),
            body: String(one['body'] ?? ''),
            date: '2026-09-28',
            read: false,
            teamInvitationId: null,
            pairInviteId: null,
          })),
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  })
}

beforeEach(() => {
  posted.length = 0
  anInboxOnTheServer(null)
})

afterEach(() => {
  inboxServer?.stop()
  inboxServer = null
})

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
      .filter((one) => one !== undefined)

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
      .filter((one): one is Competitor => one !== undefined)
      .slice(0, 2)
    const first = must(two[0], 'the first of them')
    const second = must(two[1], 'the second of them')

    /* Signed in as somebody not on the list, so every name carries an
       envelope. */
    const outsider = must(
      competitors.find(
        (one) => !going.some((each) => each.memberNumber === one.memberNumber),
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

    /* And nothing goes out while there is nothing to send. The browser used to
       refuse that; taking its refusal away without putting one in its place, an
       empty message went into somebody's inbox and the screen said it had been
       sent. Spaces are not a message either. */
    const send = screen.getByRole('button', { name: 'Pošalji poruku' })

    /* Told off rather than switched off, so somebody moving by keyboard still
       reaches the button and reaches the reason it points at. `disabled` would
       have taken it out of the tab order along with the explanation, which is
       what the portal decided against three times before this one
       (RateEvent.tsx, PendingQueue.tsx, Pager.tsx). */
    expect(send).toHaveAttribute('aria-disabled', 'true')
    expect(send).not.toBeDisabled()
    expect(send).toHaveAccessibleDescription('Napiši poruku da bi mogao da je pošalješ.')

    /* And pressed, not merely inspected. An attribute is a promise about a
       press; this is the press. Reachable means pressable, so the refusal has
       to live in the handler too, and without it this sends an empty message. */
    await user.click(send)
    expect(screen.queryByText(/^Poruka je poslata članu/)).not.toBeInTheDocument()

    await user.type(box, '   ')
    expect(send).toHaveAttribute('aria-disabled', 'true')

    await user.click(send)
    expect(screen.queryByText(/^Poruka je poslata članu/)).not.toBeInTheDocument()

    await user.clear(box)
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
        (one) => going.some((each) => each.memberNumber === one.memberNumber),
      ),
      'somebody going to it',
    )

    const outsider = must(
      competitors.find(
        (one) => !going.some((each) => each.memberNumber === one.memberNumber),
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

  it('sends it where the writer is not on the list of members the portal serves', async () => {
    /* The number is handed out when the fee is recorded (PDL P8) and the list of
       members is read separately, so for a moment there is a signed-in number
       with nothing behind it.
     *
       WHAT THAT CASE IS ABOUT CHANGED ON 28.09.2026 AND IS WORTH SAYING. Until then
       the screen worked the sender's name out of that list and put it in the note, so
       this measured the branch that wrote „Član lige" when the lookup found nothing.
       The server reads the sender off his own row now, so the screen never looks him
       up and there is no branch left: what this holds instead is that the request is
       THE SAME ONE either way, which is the only way to tell „the name moved to the
       server" from „the name is quietly gone". */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const them = must(
      competitors.find(
        (one) => going.some((each) => each.memberNumber === one.memberNumber),
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

    expect(posted).toEqual([
      {
        to: them.memberNumber,
        subject: `Dogovor za ${event.name}`,
        body: 'Idem i ja, javi se.',
      },
    ])
  })

  it('names the member whose envelope was pressed, and never the league, the writer or a bystander', async () => {
    /* THE AXIS THIS FILE EXISTS FOR SINCE 28.09.2026, and the three wrong answers are
       named rather than left to be imagined, because each of them is a value this very
       screen holds and could put there by one slip:
     *
       - the LEAGUE, which is `to: ''`. `session/context.ts` reads an empty addressee as
         „everybody", and `InboxWriteApi` reads it as a field nobody filled in („Empty is
         not the league here"), so either way a note meant for one person addressed that
         way is a note every member of the portal can read.
       - the WRITER, which is what the screen used to hold as `me` and no longer does.
       - a BYSTANDER, somebody the portal knows who is not going to this race at all.
     *
       Written as three separate refusals rather than as one equality, so that a failure
       says WHICH of the four the note was addressed to. */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const mine = must(going[0], 'somebody the file has going').memberNumber
    const them = must(
      competitors.find(
        (one) => one.memberNumber !== mine && going.some(
          (each) => each.memberNumber === one.memberNumber,
        ),
      ),
      'somebody else going to it',
    )
    const bystander = must(
      competitors.find(
        (one) => !going.some((each) => each.memberNumber === one.memberNumber),
      ),
      'a member who is not going to it',
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', mine, undefined, day)

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

    await screen.findByText(new RegExp(`^Poruka je poslata članu ${them.firstName}`))

    const wrote = must(posted[0], 'the note that was sent')

    expect(wrote['to']).toBe(them.memberNumber)
    expect(wrote['to']).not.toBe('')
    expect(wrote['to']).not.toBe(mine)
    expect(wrote['to']).not.toBe(bystander.memberNumber)
  })

  it('sends three fields, and lets the server name the writer and the moment', async () => {
    /* `InboxWriteApi.Written` takes `to`, `subject` and `body` and says why there is no
       fourth: „There is no `from`, no `date` and no `read`: each of the three is the
       server's or the database's, and a field for one of them would be a value the
       caller gets to choose." Taken off the request the sender's name would be a name
       ANYBODY COULD PICK, which is the whole reason `from_name` is read off
       `competitor` and `sent_at` is the database's `now()`.
     *
       Asked over the WHOLE object rather than over the three names, so that a fourth
       field added here fails this rather than going unnoticed: unknown fields are
       dropped on the way in, so the server would never say a word about it. */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const mine = must(going[0], 'somebody the file has going').memberNumber
    const them = must(
      competitors.find(
        (one) => one.memberNumber !== mine && going.some(
          (each) => each.memberNumber === one.memberNumber,
        ),
      ),
      'somebody else going to it',
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', mine, undefined, day)

    await user.click(
      await screen.findByRole('button', {
        name: `Piši članu ${them.firstName} ${them.lastName}`,
      }),
    )
    await user.type(
      screen.getByRole('textbox', { name: `Piši članu ${them.firstName} ${them.lastName}` }),
      'Krećem u šest ujutru.',
    )
    await user.click(screen.getByRole('button', { name: 'Pošalji poruku' }))

    await screen.findByText(new RegExp(`^Poruka je poslata članu ${them.firstName}`))

    const wrote = must(posted[0], 'the note that was sent')

    expect(Object.keys(wrote).sort()).toEqual(['body', 'subject', 'to'])
    expect(wrote).not.toHaveProperty('from')
    expect(wrote).not.toHaveProperty('date')
  })

  it('reaches the member it was addressed to, under the name the server put on it', async () => {
    /* Owner, 11.08.2026: „To ne stiže na mail nego njemu u portalski inbox."
     *
       READ IN TWO RENDERS BECAUSE A SESSION BELONGS TO ONE MEMBER: the addressee's mail
       cannot be opened without becoming him. The join between the two halves is the
       MEMBER NUMBER and nothing else - the stand-in serves a posted note to the number
       it was addressed to and to no other - so this is the one case the three wrong
       addressees above all empty out.
     *
       AND THE NAME ON IT IS ONE NO REQUEST COULD HAVE CARRIED. The stand-in puts the
       server's own name on the served row, the way `nameTheLeagueKnowsHimBy` does; the
       case above has already held that the request carries no `from` at all. So finding
       that name here is finding the server's answer rather than an echo. */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const mine = must(going[0], 'somebody the file has going').memberNumber
    const them = must(
      competitors.find(
        (one) => one.memberNumber !== mine && going.some(
          (each) => each.memberNumber === one.memberNumber,
        ),
      ),
      'somebody else going to it',
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', mine, undefined, day)

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

    await screen.findByText(new RegExp(`^Poruka je poslata članu ${them.firstName}`))

    /* HIS MAIL, and the walk to it is a second visit: a fresh render is a fresh session,
       and the cache of the last one is dropped the way a reload drops it. */
    cleanup()
    clearResourceCache()
    anInboxOnTheServer(them.memberNumber)
    renderAt('/sr/poruke', 'competitor', them.memberNumber, undefined, day)

    await screen.findByRole('heading', { level: 1, name: 'Poruke' })

    expect(await screen.findByText('Imam mesta u kolima, javi se.')).toBeVisible()
    expect(screen.getByText(new RegExp(THE_SERVER_NAMES_THE_SENDER))).toBeVisible()

    /* And it is not the only thing on that screen, nor the first thing on it: his mail
       already held a later row, so „the note is there" cannot be satisfied by a screen
       that draws whatever it is handed first. */
    expect(screen.getByText(ALREADY_IN_HIS_MAIL.body)).toBeVisible()
  })

  it('leaves nothing in the writer’s own mail, because his own mail is not where it went', async () => {
    /* GREEN BEFORE THIS INCREMENT TOO, AND THAT IS WHY IT IS NOT LEFT TO STAND ALONE.
       Until 28.09.2026 the note was written into the browser and `SessionProvider`'s
       `inbox` filter (`to === '' || to === memberNumber`) is what kept it out of the
       writer's own list; today there is nothing written into the browser at all, and
       `InboxApi` serves `where m.to_id = :me or m.to_id is null`, so the server has
       nothing of his to give back either. One screen state, two reasons, so this case
       says what it can honestly say - his mail is UNCHANGED - and the cases above are
       what say where the note really went. */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const mine = must(going[0], 'somebody the file has going').memberNumber
    const them = must(
      competitors.find(
        (one) => one.memberNumber !== mine && going.some(
          (each) => each.memberNumber === one.memberNumber,
        ),
      ),
      'somebody else going to it',
    )

    anInboxOnTheServer(mine)

    const { router } = renderAt(
      `/sr/kalendar/${event.slug}`,
      'competitor',
      mine,
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

    await screen.findByText(new RegExp(`^Poruka je poslata članu ${them.firstName}`))

    await router.navigate('/sr/poruke')
    await screen.findByRole('heading', { level: 1, name: 'Poruke' })

    /* His mail is what it was: the one row the server holds for him, and not the note. */
    expect(await screen.findByText(ALREADY_IN_HIS_MAIL.body)).toBeVisible()
    expect(screen.queryByText('Imam mesta u kolima, javi se.')).toBeNull()
  })

  it('says why the server refused, and keeps every word of the note in the box', async () => {
    /* The envelope is only drawn beside a member the served list carries, but the route
       asks `active` at the moment it writes: a membership that lapses in between is this
       refusal, and it is the same race `WHEN_PROPOSING_A_TEAM` names for a team name
       taken a moment before the request lands.
     *
       AND THE WORDS STAY. A note refused is a note that can be sent again, not one that
       has to be written again. */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const mine = must(going[0], 'somebody the file has going').memberNumber
    const them = must(
      competitors.find(
        (one) => one.memberNumber !== mine && going.some(
          (each) => each.memberNumber === one.memberNumber,
        ),
      ),
      'somebody else going to it',
    )

    inboxServer?.stop()
    inboxServer = serverThat((path, init) =>
      path === '/api/inbox' && init?.method === 'POST'
        ? refused('theMemberIsNotKnown')
        : null,
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', mine, undefined, day)

    await user.click(
      await screen.findByRole('button', {
        name: `Piši članu ${them.firstName} ${them.lastName}`,
      }),
    )

    const box = screen.getByRole('textbox', {
      name: `Piši članu ${them.firstName} ${them.lastName}`,
    })

    await user.type(box, 'Imam mesta u kolima, javi se.')
    await user.click(screen.getByRole('button', { name: 'Pošalji poruku' }))

    expect(
      await screen.findByText('Portal ne poznaje tog člana, pa poruka nije poslata.'),
    ).toBeVisible()

    /* Nothing was confirmed, and nothing was lost. */
    expect(screen.queryByText(new RegExp('^Poruka je poslata članu'))).toBeNull()
    expect(box).toHaveValue('Imam mesta u kolima, javi se.')
    expect(screen.getByRole('button', { name: 'Pošalji poruku' })).toBeVisible()

    /* AND THE FORM HAS STOPPED SAYING IT IS SENDING, asked HERE and not only on the case
       about waiting: a note that was refused leaves the form standing, so this is the one
       place where „that line is gone" is a fact about the line rather than about the form
       having been replaced by the confirmation. */
    expect(screen.queryByText('Šalje se')).toBeNull()
  })

  it('does not invent a sentence for a refusal it has no name for', async () => {
    /* 403 is the token, not the note: `askTheServer` reads it as „rejected" and the
       portal says so in its own words. The nearest sentence this screen has would send
       the reader to change the text, which is the one thing that is not wrong
       (`account/ServerSaid.tsx` gives that reasoning in full). */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const mine = must(going[0], 'somebody the file has going').memberNumber
    const them = must(
      competitors.find(
        (one) => one.memberNumber !== mine && going.some(
          (each) => each.memberNumber === one.memberNumber,
        ),
      ),
      'somebody else going to it',
    )

    inboxServer?.stop()
    inboxServer = serverThat((path, init) =>
      path === '/api/inbox' && init?.method === 'POST' ? answeredWith(403) : null,
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', mine, undefined, day)

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

    expect(
      await screen.findByText(
        'Portal nije uspeo da dokaže serveru da zahtev dolazi sa ove strane. Osveži stranu i pokušaj ponovo.',
      ),
    ).toBeVisible()
    expect(screen.queryByText(new RegExp('^Poruka je poslata članu'))).toBeNull()
  })

  it('confirms nothing while the answer is still out, and says it is sending', async () => {
    /* THE CONFIRMATION IS DRAWN ONLY AFTER THE SERVER HAS SAID SO, which is the half a
       green answer cannot measure: with the route answering at once, „drawn after 201"
       and „drawn on the press" look the same. Held open on purpose, which is what
       `serverThat` takes a promise for. */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const mine = must(going[0], 'somebody the file has going').memberNumber
    const them = must(
      competitors.find(
        (one) => one.memberNumber !== mine && going.some(
          (each) => each.memberNumber === one.memberNumber,
        ),
      ),
      'somebody else going to it',
    )

    let letItAnswer = (): void => {}
    const held = new Promise<Response>((resolve) => {
      letItAnswer = () => resolve(new Response(null, { status: 201 }))
    })

    inboxServer?.stop()
    inboxServer = serverThat((path, init) =>
      path === '/api/inbox' && init?.method === 'POST' ? held : null,
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', mine, undefined, day)

    await user.click(
      await screen.findByRole('button', {
        name: `Piši članu ${them.firstName} ${them.lastName}`,
      }),
    )
    await user.type(
      screen.getByRole('textbox', { name: `Piši članu ${them.firstName} ${them.lastName}` }),
      'Imam mesta u kolima, javi se.',
    )
    /* NOTHING IS IN FLIGHT YET, SO NOTHING SAYS IT IS, and this half is what makes the
       other half a claim at all. Without it „it says so while it waits" is satisfied by
       a line that is simply always there: measured, and a line drawn unconditionally
       passed every other assertion in this case. */
    expect(screen.queryByText('Šalje se')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Pošalji poruku' }))

    expect(await screen.findByText('Šalje se')).toBeVisible()
    expect(screen.queryByText(new RegExp('^Poruka je poslata članu'))).toBeNull()

    letItAnswer()

    expect(
      await screen.findByText(new RegExp(`^Poruka je poslata članu ${them.firstName}`)),
    ).toBeVisible()
    expect(screen.queryByText('Šalje se')).toBeNull()
  })

  it('writes one row and not two when the button is pressed twice before an answer', async () => {
    /* A message cannot be taken back (PDL, 06.09.2026: „Ne briše se: brisanje poruke iz
       tuđeg sandučeta je brisanje istorije"), so a doubled press is a second row in
       somebody's mail for ever. Guarded in a ref rather than in the state beside it,
       because a redraw cannot land between two presses that arrive before one answer. */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const mine = must(going[0], 'somebody the file has going').memberNumber
    const them = must(
      competitors.find(
        (one) => one.memberNumber !== mine && going.some(
          (each) => each.memberNumber === one.memberNumber,
        ),
      ),
      'somebody else going to it',
    )

    let letItAnswer = (): void => {}
    const held = new Promise<Response>((resolve) => {
      letItAnswer = () => resolve(new Response(null, { status: 201 }))
    })

    inboxServer?.stop()
    inboxServer = serverThat((path, init) => {
      if (path !== '/api/inbox' || init?.method !== 'POST') {
        return null
      }

      const said: unknown = JSON.parse(String(init.body))

      posted.push(everyFieldIn(said))

      return held
    })

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', mine, undefined, day)

    await user.click(
      await screen.findByRole('button', {
        name: `Piši članu ${them.firstName} ${them.lastName}`,
      }),
    )
    await user.type(
      screen.getByRole('textbox', { name: `Piši članu ${them.firstName} ${them.lastName}` }),
      'Imam mesta u kolima, javi se.',
    )

    const send = screen.getByRole('button', { name: 'Pošalji poruku' })

    await user.click(send)
    await user.click(send)

    letItAnswer()

    await screen.findByText(new RegExp(`^Poruka je poslata članu ${them.firstName}`))

    expect(posted).toHaveLength(1)
  })

  it('sends nothing at all while the box is empty', async () => {
    /* Told off rather than switched off, so the button is reachable and can be pressed:
       the refusal therefore has to live in the submit as well as in the attribute, and
       what it is worth is measured here as „the server was never spoken to" rather than
       as „no confirmation appeared". */
    const user = setupUser()
    const { event, going, day } = await upcoming()
    const competitors = await loadResource<Competitor[]>('competitors')
    const mine = must(going[0], 'somebody the file has going').memberNumber
    const them = must(
      competitors.find(
        (one) => one.memberNumber !== mine && going.some(
          (each) => each.memberNumber === one.memberNumber,
        ),
      ),
      'somebody else going to it',
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', mine, undefined, day)

    await user.click(
      await screen.findByRole('button', {
        name: `Piši članu ${them.firstName} ${them.lastName}`,
      }),
    )

    /* Three spaces are not a message (forms/validate.ts, admin/SendBack.tsx). */
    await user.type(
      screen.getByRole('textbox', { name: `Piši članu ${them.firstName} ${them.lastName}` }),
      '   ',
    )
    await user.click(screen.getByRole('button', { name: 'Pošalji poruku' }))

    expect(screen.getByText('Napiši poruku da bi mogao da je pošalješ.')).toBeVisible()
    expect(screen.queryByText(new RegExp('^Poruka je poslata članu'))).toBeNull()
    expect(posted).toEqual([])
  })
})

describe('a name the list cannot lead to', () => {
  /* Two rows the record cannot fully answer, and both are on the same event in
     the data on purpose: a member who is no longer active (their profile is not
     shown at all, PDL P11) and a number with nothing behind it, which happens
     while a registration is going through. Neither may vanish from the list:
     the switch and the list are one answer to one question, and a switch
     saying „you are going" over a list saying „nobody is" is the screen
     contradicting itself.

     **THE FIRST OF THE TWO IS ONLY A STRANGER ON THE ANSWER THE SERVER GIVES,
     SINCE 21.09.2026.** The generated file still carries the member whose fee has
     lapsed, with a flag saying so; `/api/competitors` carries neither the row nor
     the flag (owner, 13.09.2026). Read off the file this describe would have had
     one stranger where it needs two, and the shape it exists to measure - a list
     with both kinds of nameless row on it - would have stopped existing without
     anything saying so. `membersAsServed` is what puts the answer in front of the
     file, and it is also what makes this case measure the rule rather than the
     seed: „no record" and „fee run out" are one state now, and this is where that
     is said out loud. */
  /* The answer in front of the file for every case below, rather than inside each
     one: they all read the same list, and a case that forgot would quietly go back
     to measuring the seed. Put back after each, because `serverThat` stands in
     front of the disc reader rather than replacing it, and the next file's cases
     need the disc reader back. */
  let putTheDiscBack = () => {}

  beforeEach(() => {
    putTheDiscBack = membersAsServed().stop
  })

  afterEach(() => {
    putTheDiscBack()
  })

  async function withStrangers() {
    const events = await loadResource<BtlEvent[]>('events')
    const attendance = await loadResource<Attending[]>('attendance')
    const competitors = await loadResource<Competitor[]>('competitors')
    const known = new Set(competitors.map((one) => one.memberNumber))
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

    /* Two of them and not one, which is the whole shape this describe measures:
       a number with nothing behind it, and a member whose fee has run out. */
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
