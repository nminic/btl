import { screen } from '@testing-library/react'
import type { ResourceState } from '../../data/useResource'
import type { EventComment, Result } from '../../data/types'
import { first } from '../../test/at'
import { aFailedRead } from '../../test/failedRead'
import { renderAt } from '../../test/render'
import { membersAsServed } from '../../test/serverAnswers'

/**
 * What the foot of an event does while its two lower parts are not there yet.
 *
 * An event still to be run draws neither the results nor the comments, so it
 * must not hold a box open for either: the reader would watch a space that
 * resolves into nothing, and on a broken connection an alert about a part that
 * was never going to be drawn.
 *
 * Both parts in every case, because the two are one decision. They diverged
 * once, on the error state, and each carried a comment saying the other agreed
 * with it.
 *
 * The state is forced, because it cannot be caught by hand: these parts mount
 * only after the event itself has arrived, and by then the files have been read
 * off the disc and settled. Only these two resources are held; everything else
 * on the screen loads as it does.
 */

/** What the two hooks are made to answer with, per case. Typed against their own
 *  returns, so a change to either shape is a build error here rather than a file
 *  that goes on passing while proving nothing. */
let comments: ResourceState<EventComment[]> = { status: 'loading' }
let results: ResourceState<Result[]> = { status: 'loading' }

vi.mock('../../data/useResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/useResource')>()),
  useComments: (): ResourceState<EventComment[]> => comments,
  useResults: (): ResourceState<Result[]> => results,
}))

const RAN = 'fruskogorski-maraton-2010'
const AHEAD = 'podgoricka-desetka-2027'
const BEFORE = '2026-12-31'

/* Each part named once, so the loop below and the anchor further down cannot come
   to name two different sentences for the same box. Read by position out of the
   table they used to be written into, the anchor would have followed a reordering
   of that table onto the wrong part in silence. */
const COMMENTS = ['the comments', 'Učitavanje: Komentari', 'Komentari'] as const
const RESULTS = ['the results', 'Učitavanje: Rezultati članova', 'Rezultati članova'] as const

/** The two parts, by what each says while it waits and what it is called. */
const PARTS = [COMMENTS, RESULTS] as const

function waiting(): void {
  comments = { status: 'loading' }
  results = { status: 'loading' }
}

function broken(): void {
  comments = aFailedRead()
  results = aFailedRead()
}

/**
 * The one of the two that a visitor is never shown, broken on its own.
 *
 * Its neighbour is left on its way rather than broken beside it, and that is what
 * makes the pair of cases below say anything: a box held open for the results is
 * drawn for a visitor and for a member alike, so „no alert" is measured on a screen
 * that demonstrably reached the foot of the event. Broken together, the silence
 * asked for below would have been satisfied by a page that drew neither.
 */
function onlyTheCommentsAreBroken(): void {
  comments = aFailedRead()
  results = { status: 'loading' }
}

describe('a part of an event that has not arrived', () => {
  for (const [name, said] of PARTS) {
    it(`holds a box open for ${name} where the race has been run`, async () => {
      waiting()
      renderAt(`/sr/kalendar/${RAN}`, 'competitor', '000007', undefined, BEFORE)

      expect(await screen.findByText(said)).toBeVisible()
    })
  }

  it('holds none where the race has not been run', async () => {
    waiting()
    renderAt(`/sr/kalendar/${AHEAD}`, 'competitor', '000007', undefined, BEFORE)

    /* Waited for by something else on the screen, so the check is made after the
       event itself has arrived and the sections would have been drawn. The table
       of races and not the heading over it: the heading went on 23.08.2026 and
       the table names itself in a caption instead. */
    await screen.findByRole('table', { name: 'Trke' })

    for (const [, said, heading] of PARTS) {
      expect(screen.queryByText(said)).toBeNull()
      expect(screen.queryByRole('heading', { name: heading })).toBeNull()
    }
  })
})

describe('a part of an event that will not arrive', () => {
  it('says so where the race has been run', async () => {
    broken()
    renderAt(`/sr/kalendar/${RAN}`, 'competitor', '000007', undefined, BEFORE)

    expect(await screen.findAllByRole('alert')).toHaveLength(PARTS.length)
  })

  it('says nothing where the race has not been run', async () => {
    broken()
    renderAt(`/sr/kalendar/${AHEAD}`, 'competitor', '000007', undefined, BEFORE)

    await screen.findByRole('table', { name: 'Trke' })

    /* An alert about a section nobody was going to be shown is worse than the
       silence: it is the portal reporting a fault in something it had already
       decided not to draw. */
    expect(screen.queryByRole('alert')).toBeNull()

    for (const [, , heading] of PARTS) {
      expect(screen.queryByRole('heading', { name: heading })).toBeNull()
    }
  })
})

/**
 * AND THE SAME SENTENCE ABOUT A READER RATHER THAN ABOUT A RACE, WHICH IS THE ONE
 * CASE OF IT THE PORTAL REALLY MEETS.
 *
 * The cases above force a state the mock layer cannot produce, because it serves one
 * static file to everybody. For the comments that stopped being a forced state on the
 * day the portal moved to `/api`: `/api/comments` is not in
 * `ApiSecurity.READ_BY_ANYBODY`, so an unauthenticated caller is answered 401,
 * `data/client.ts` throws on anything that is not `ok`, and this resource is in error
 * for EVERY visitor on EVERY event. Measured on the real route from the QA host
 * before it was written down here.
 *
 * So what is measured is not a cable that broke. It is what a visitor gets, and the
 * owner decided what that is on 11.08.2026: „komentare vide samo prijavljeni članovi
 * BTL. Drugim (posetiocima) se ne prikazuju." A red alarm is not that.
 *
 * **Both sides of one axis, and it is the reader.** The same address, the same day,
 * the same broken part; only who is at the keyboard changes. Without the member's
 * half, a screen that drew nothing under any race for anybody would satisfy the
 * visitor's half while deciding nothing at all about who is reading.
 *
 * **WHAT THIS DOES NOT HOLD, written down rather than left to be found.** This is
 * one screen, and the fault it measures is a CLASS: a screen that draws a
 * `Resource` over a resource the chain refuses to a visitor, and asks who is
 * reading inside that `Resource` rather than in front of it. Eight files carry that
 * shape today (the three here, `admin/AdminModerators`, `admin/Payments`,
 * `admin/PendingQueue`, `member/Messages`, `member/MessageDetail`, with
 * `member/ServedTeamInvite` drawn inside the last of them) and the other seven ask
 * in the right place already - the administrative ones behind `Guard`, the member
 * ones in front of the asking. A derived floor over the class was looked for and
 * not written, and the reason is measured rather than shrugged at: six of the eight
 * screens a visitor cannot reach at all, so a sweep asserting „no alert" over them
 * would pass because nothing was drawn, which is the portal's own „dva izvora jedne
 * vrednosti" fault dressed as coverage. The fact the whole class rests on -
 * WHICH resources the chain refuses to a visitor - is named in ELEVEN places under
 * `src/` in prose and measured by nothing, and one of those eleven sentences is what
 * stood over the gate this file now holds. Closing that properly means a floor that
 * reads `READ_BY_ANYBODY` out of `ApiSecurity.java` the way `account/refusals.test.ts`
 * reads `MePhotoApi.java`, and it is a guard of its own size rather than part of this
 * one.
 */
describe('a part of an event that a visitor was never going to be shown', () => {
  it('is still reported to a member, who was going to be shown it', async () => {
    onlyTheCommentsAreBroken()
    renderAt(`/sr/kalendar/${RAN}`, 'competitor', '000007', undefined, BEFORE)

    /* One and not „at least one": `findByRole` refuses a second match, so this
       also says the neighbour left on its way reports nothing. */
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(await screen.findByText(RESULTS[1])).toBeVisible()
  })

  it('is not reported to a visitor, who is given a sentence in its place', async () => {
    onlyTheCommentsAreBroken()
    renderAt(`/sr/kalendar/${RAN}`, 'visitor', null, undefined, BEFORE)

    /* What the visitor IS shown, and asserting it is the whole difference between a
       guard and a screen that went dark: a section answered with nothing at all
       would keep the alarm away too, and would take the owner's own sentence with
       it (`rateEvent.test.tsx` holds that sentence from the other side, on a screen
       where nothing is broken). */
    expect(await screen.findByText('Komentare vide članovi sa važećom članarinom.')).toBeVisible()
    /* And the part beside it, drawn and still on its way: the foot of the event was
       reached, so the absence below is an absence of an alarm and not of a page. */
    expect(await screen.findByText(RESULTS[1])).toBeVisible()

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('is not reported to a member whose fee has lapsed either, who is given the same sentence', async () => {
    /* Since 03.10.2026 the server refuses him 404 where it refuses a visitor 401 (PDL P6,
       03.10.2026, „Komentare vide aktivni članovi i administracija, isto kao najava dolaska"),
       so a part that is in error for him is in error for the same reason it is for a visitor.
       He is signed in, so the list of members is what says he is not a reader, and it is the
       list the server really serves that says it (`membersAsServed`). */
    onlyTheCommentsAreBroken()
    const { lapsed, stop } = membersAsServed()

    try {
      renderAt(`/sr/kalendar/${RAN}`, 'competitor', first(lapsed), undefined, BEFORE)

      expect(await screen.findByText('Komentare vide članovi sa važećom članarinom.')).toBeVisible()
      expect(await screen.findByText(RESULTS[1])).toBeVisible()

      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      stop()
    }
  })
})
