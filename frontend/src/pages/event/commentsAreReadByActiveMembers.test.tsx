import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, screen } from '@testing-library/react'
import { loadResource } from '../../data/client'
import type { BtlEvent, EventComment } from '../../data/types'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, membersAsServed, serverThat } from '../../test/serverAnswers'
import type { Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import type { Role } from '../../roles/context'
import { useSession } from '../../session/useSession'

/**
 * WHO THE COMMENTS ON AN EVENT ARE DRAWN TO, asked of the screen the way the server is asked of its
 * route (`CommentApiTest`), and over the same kinds of reader.
 *
 * <p>The owner chose it between offered outcomes on 03.10.2026, and PDL records the choice as:
 * „Komentare vide aktivni članovi i administracija, isto kao najava dolaska i skriven profil od
 * 03.10.2026; nalog bez važeće članarine ih ne vidi" (PDL P6, 03.10.2026, „Komentare vide aktivni
 * članovi i administracija, isto kao najava dolaska"; the record's sentence, not his own words).
 * The entry it narrows (11.08.2026) adds that the mark beside the title is worked out of the
 * comments and shares their fate, so the mark is a door of its own here and is asked apart.
 *
 * <p><b>Three doors, each its own assertion.</b> The list and the sentence under the event
 * (`EventComments.tsx`), the figure beside its name (`OverallMark.tsx`), and what is asked of the
 * server for either (`GET /api/comments`). Taking the old rule - anybody signed in - back at ONE
 * of them is a different failure from taking it back at another, which is the point of asking
 * them apart: the two screens share one question (`readsComments.ts`) and could still be wired to
 * two answers.
 *
 * <p><b>The disc answers everybody, and that is what makes the screen's own decision
 * measurable.</b> `test/setup.ts` serves `/api/comments` off the generated file to every caller,
 * a visitor included, so a part that is not drawn to a reader is not drawn because the screen said
 * no and not because a server did. What a server would say is `CommentApiTest`'s.
 *
 * <p><b>What a screen cannot tell apart, said rather than left to be found.</b> Somebody who
 * registered and never paid and an account that races for nobody are two readers to the server
 * (one has a record, the other has none) and ONE reader to a screen: neither has a number of his
 * own. They are a single row here, named for both.
 */
const SENTENCE = 'Komentare vide članovi sa važećom članarinom.'

/** An event that has been run and carries rated comments: the one whose list, mark and sentence are
 *  all there to be drawn or withheld. */
const RAN = 'fruskogorski-maraton-2010'

/** One nobody has run yet and nobody commented on, read on a day before it. */
const AHEAD = 'podgoricka-desetka-2027'
const BEFORE_AHEAD = '2026-12-31'

/** An active member, with a result on RAN. */
const ACTIVE = '000021'

type Reader = {
  /** What the kind of reader is called in a message. */
  name: string
  role: Role
  /** His number, or nothing for somebody who has none. `LAPSED` is filled in by the case, because it is
   *  read off the answer the server really gives (`membersAsServed`). */
  number: string | null
  reads: boolean
}

/** The member the file still carries with `active: false`, whom the list the server serves leaves
 *  out: the one member of the fixture whose fee has lapsed. */
const LAPSED = '000032'

const READERS: Reader[] = [
  { name: 'a visitor', role: 'visitor', number: null, reads: false },
  { name: 'somebody signed in with no number of his own', role: 'competitor', number: null, reads: false },
  { name: 'a member whose fee has lapsed', role: 'competitor', number: LAPSED, reads: false },
  { name: 'an active member', role: 'competitor', number: ACTIVE, reads: true },
  { name: 'a moderator who races for nobody', role: 'moderator', number: null, reads: true },
  { name: 'a moderator whose own fee has lapsed', role: 'moderator', number: LAPSED, reads: true },
  { name: 'the superadmin', role: 'superadmin', number: null, reads: true },
]

let theList: { lapsed: string[]; stop: () => void } | null = null
let theServer: { asked: Asked[]; stop: () => void } | null = null

beforeEach(() => {
  theList = membersAsServed()
  theServer = serverThat(() => null)
})

afterEach(() => {
  theServer?.stop()
  theList?.stop()
  theServer = null
  theList = null
})

/** The requests for the comments the screen has sent so far. */
function askedForTheComments(): number {
  return (theServer?.asked ?? []).filter((one) => one.path === '/api/comments').length
}

/** What the figure beside the name says it is out of, which is how it is found without a class. */
const THE_MARK = /^iz \d+ ocen/

async function aRatedComment(): Promise<EventComment> {
  const events = await loadResource<BtlEvent[]>('events')
  const ran = must(
    events.find((one) => one.slug === RAN),
    'the event that has been run',
  )
  const comments = await loadResource<EventComment[]>('comments')

  return must(
    comments.find((one) => one.eventId === ran.id && one.body !== '' && one.rating.organisation > 0),
    'a comment with words and marks',
  )
}

describe('the readers of this file', () => {
  it('are what they are called', () => {
    /* The member whose fee has lapsed is the one the list the server serves leaves out, so a row
       that names him is a row about the reader the rule is for. */
    expect(theList?.lapsed, 'the lapsed reader is not the member the served list leaves out').toEqual([
      LAPSED,
    ])
    expect(READERS.filter((one) => one.reads).length, 'no reader reads, so every case below would hold').toBeGreaterThan(0)
    expect(READERS.filter((one) => !one.reads).length, 'every reader reads, so every case below would hold').toBeGreaterThan(0)
    /* Both kinds of administrator, and the one whose own fee has lapsed is the reader who tells the
       two halves of the question apart: refused as a member, drawn the part as the administration. */
    expect(READERS.some((one) => one.role === 'moderator' && one.number === LAPSED)).toBe(true)
    expect(READERS.some((one) => one.role === 'competitor' && one.number === LAPSED)).toBe(true)
  })
})

describe('the comments under an event that has been run', () => {
  for (const reader of READERS) {
    it(`are ${reader.reads ? 'drawn to' : 'not drawn to'} ${reader.name}, and so is the figure beside the name`, async () => {
      const comment = await aRatedComment()

      renderAt(`/sr/kalendar/${RAN}`, reader.role, reader.number)

      await screen.findByRole('heading', { level: 1, name: 'Fruškogorski maraton' })

      if (reader.reads) {
        expect(
          await screen.findByRole('list', { name: 'Komentari' }),
          `${reader.name} was not drawn the comments`,
        ).toBeVisible()
        expect(await screen.findByText(comment.body), `${reader.name} was not drawn what was written`).toBeVisible()
        expect(
          await screen.findByText(THE_MARK),
          `${reader.name} was not drawn the figure the comments add up to`,
        ).toBeVisible()
        expect(screen.queryByText(SENTENCE), `${reader.name} was told the comments are not for him`).toBeNull()
      } else {
        expect(
          await screen.findByText(SENTENCE),
          `${reader.name} was not told who the comments are for`,
        ).toBeVisible()
        /* The part beside the section, drawn and settled: the foot of the event was reached, so
           what is absent below is absent from a page and not from one that went dark. */
        await screen.findByRole('heading', { name: /^Rezultati članova/ })

        expect(
          screen.queryByRole('list', { name: 'Komentari' }),
          `${reader.name} was drawn the comments`,
        ).toBeNull()
        expect(screen.queryByText(comment.body), `${reader.name} was drawn what was written`).toBeNull()
        expect(
          screen.queryByText(THE_MARK),
          `${reader.name} was drawn the figure the comments add up to`,
        ).toBeNull()
      }

      expect(screen.queryByRole('alert'), `${reader.name} was shown an alarm`).toBeNull()
    })

    it(`${reader.reads ? 'send' : 'send no'} request for the comments for ${reader.name}`, async () => {
      renderAt(`/sr/kalendar/${RAN}`, reader.role, reader.number)

      await screen.findByRole('heading', { level: 1, name: 'Fruškogorski maraton' })
      await screen.findByRole('heading', { name: /^Rezultati članova/ })
      /* Settled: either the list is drawn or the sentence is, so the part has made up its mind
         and a request it was going to send has been sent. */
      if (reader.reads) {
        await screen.findByRole('list', { name: 'Komentari' })
      } else {
        await screen.findByText(SENTENCE)
      }

      expect(
        askedForTheComments() > 0,
        reader.reads
          ? `nothing was asked of the server for ${reader.name}, who is drawn the comments`
          : `the comments were asked of the server for ${reader.name}, who is drawn nothing of them`,
      ).toBe(reader.reads)
    })
  }
})

describe('an event still to be run', () => {
  for (const reader of READERS) {
    it(`draws ${reader.name} no section, no sentence and no alarm`, async () => {
      renderAt(`/sr/kalendar/${AHEAD}`, reader.role, reader.number, undefined, BEFORE_AHEAD)

      await screen.findByRole('table', { name: 'Trke' })
      /* Given the time to be drawn if it were going to be, by settling what the list of members
         says first: a member's answer is not known until it has arrived. */
      await act(async () => {
        await loadResource('competitors')
      })

      expect(screen.queryByRole('heading', { name: 'Komentari' }), `${reader.name} was drawn the heading`).toBeNull()
      expect(screen.queryByText(SENTENCE), `${reader.name} was told who the comments are for`).toBeNull()
      expect(screen.queryByText(THE_MARK)).toBeNull()
      expect(screen.queryByRole('alert'), `${reader.name} was shown an alarm`).toBeNull()
    })
  }
})

describe('a reader whose fee is not known yet', () => {
  /**
   * THE LIST OF MEMBERS, HELD BACK, which is the moment a part that waits for it would be drawn as
   * waiting and a part that does not would be drawn already.
   *
   * <p>The page itself waits only for the calendar, so its heading is up while the members are
   * still on their way. A visitor is told the sentence at once, because nothing the list could say
   * changes his answer; a member is not told anything yet, because it does; and the administration
   * is asked for the comments at once, because its own fee does not matter.
   */
  async function withTheListHeldBack<T>(whileHeld: () => Promise<T>): Promise<T> {
    let letTheMembersAnswer = (): void => {}
    const theMembersAnswer = new Promise<void>((resolve) => {
      letTheMembersAnswer = resolve
    })
    const members = serverThat((path) =>
      path === '/api/competitors'
        ? theMembersAnswer.then(
            () =>
              new Response(
                readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'competitors.json'), 'utf-8'),
                { status: 200, headers: { 'content-type': 'application/json' } },
              ),
          )
        : null,
    )

    try {
      return await whileHeld()
    } finally {
      letTheMembersAnswer()
      members.stop()
    }
  }

  it('holds a box open for a member and draws the list when the members arrive', async () => {
    await withTheListHeldBack(async () => {
      renderAt(`/sr/kalendar/${RAN}`, 'competitor', ACTIVE)

      await screen.findByRole('heading', { level: 1, name: 'Fruškogorski maraton' })

      expect(await screen.findByText('Učitavanje: Komentari')).toBeVisible()
      expect(screen.queryByText(SENTENCE), 'a member was told the comments are not for him while it was not known').toBeNull()
      expect(screen.queryByText(THE_MARK)).toBeNull()
      expect(askedForTheComments(), 'the comments were asked for before it was known the reader reads them').toBe(0)
    })
  })

  it('tells a visitor the sentence at once, whatever the list of members is doing', async () => {
    await withTheListHeldBack(async () => {
      renderAt(`/sr/kalendar/${RAN}`, 'visitor')

      await screen.findByRole('heading', { level: 1, name: 'Fruškogorski maraton' })

      expect(await screen.findByText(SENTENCE)).toBeVisible()
      expect(askedForTheComments()).toBe(0)
    })
  })

  it('tells somebody signed in with no number of his own the sentence at once too', async () => {
    await withTheListHeldBack(async () => {
      renderAt(`/sr/kalendar/${RAN}`, 'competitor', null)

      await screen.findByRole('heading', { level: 1, name: 'Fruškogorski maraton' })

      expect(await screen.findByText(SENTENCE)).toBeVisible()
      expect(askedForTheComments()).toBe(0)
    })
  })

  it('asks the administration for the comments at once, for its own fee does not matter', async () => {
    await withTheListHeldBack(async () => {
      renderAt(`/sr/kalendar/${RAN}`, 'moderator', null)

      await screen.findByRole('heading', { level: 1, name: 'Fruškogorski maraton' })

      expect(await screen.findByText('Učitavanje: Komentari')).toBeVisible()
      expect(
        askedForTheComments(),
        'the administration waited for the list of members before it asked for the comments',
      ).toBeGreaterThan(0)
    })
  })

  it('is told the part could not be read, and not that the comments are not for him, when the list does not come', async () => {
    const broken = serverThat((path) => (path === '/api/competitors' ? answeredWith(500) : null))

    try {
      renderAt(`/sr/kalendar/${RAN}`, 'competitor', ACTIVE)

      await screen.findByRole('heading', { level: 1, name: 'Fruškogorski maraton' })

      expect(
        await screen.findByRole('button', { name: 'Pokušaj ponovo: Komentari' }),
        'a reader whose list did not come was not offered to ask again',
      ).toBeVisible()
      expect(
        screen.queryByText(SENTENCE),
        'a reader whose list did not come was read as somebody who may not read',
      ).toBeNull()
      expect(screen.queryByText(THE_MARK)).toBeNull()
      expect(askedForTheComments()).toBe(0)
    } finally {
      broken.stop()
    }
  })
})

/** The reader stops being signed in without leaving the visit, the way `AccountMenu` really does
 *  it: in place, no navigation and no reload (`data/client.ts`). */
function SignOut() {
  const { signOut } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        signOut()
      }}
    >
      odjavi se
    </button>
  )
}

/**
 * A READER WHO SIGNS OUT IN PLACE IS DRAWN THE SENTENCE, with no navigation and no reload.
 *
 * <p>Signing out happens in place (`data/client.ts`), so the part that was drawing a list has to
 * stop drawing it the moment the reader changes, and the answer it held may not outlive him
 * (`session/theCachesFollowTheReader.ts` holds the cache; this holds what the screen does with it).
 * The figure beside the name goes with the list, and neither is left behind by a part that already
 * had its answer in hand.
 */
describe('a member who stops being signed in on the page', () => {
  it('is drawn the sentence and not the list or the figure he was drawn a moment ago', async () => {
    const comment = await aRatedComment()
    const user = setupUser()

    renderAt(`/sr/kalendar/${RAN}`, 'competitor', ACTIVE, undefined, null, <SignOut />)

    expect(await screen.findByText(comment.body)).toBeVisible()
    expect(await screen.findByText(THE_MARK)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'odjavi se' }))

    expect(await screen.findByText(SENTENCE)).toBeVisible()
    expect(screen.queryByText(comment.body), 'the comments outlived the member who read them').toBeNull()
    expect(screen.queryByText(THE_MARK), 'the figure outlived the member who read it').toBeNull()
  })
})
