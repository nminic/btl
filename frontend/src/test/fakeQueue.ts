import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NO_RATING } from '../data/types'
import type { ServedPendingItem } from '../data/types'
import { refused, serverThat, type Asked } from './serverAnswers'
import { whoTheCookieCurrentlyNames } from './setup'

/**
 * A SERVER THAT REMEMBERS WHAT WAS POSTED TO IT, standing in for `TeamWriteApi` and
 * `CommentWriteApi` TOGETHER WITH the one answer both of them feed afterwards,
 * `VerificationApi`'s `GET /api/verification`.
 *
 * <p><b>Why this exists rather than the default `test/setup.ts` now answers with.</b>
 * That default is a bare 201 that persists nowhere, which is enough for every case that
 * only asks „did the confirmation appear" - the great majority of them. It is not enough
 * for a case that walks on: proposes, THEN opens the moderator's queue in the same
 * visit and reads what is on the card, or decides it and reads what that did. Those
 * cases need the round trip a real server gives for nothing and this file does not:
 * there is no database here, so what a later `GET` answers has to be built from what an
 * earlier `POST` carried.
 *
 * <p><b>Whose it is comes off the session, never off the request</b> - the real routes'
 * own rule (`TeamWriteApi`, `CommentWriteApi`: „never a value the caller supplies"), kept
 * here by reading {@link whoTheCookieCurrentlyNames} rather than a name this file is
 * handed. A case that renders as one member and then, mid-visit, would need a second
 * identity to submit as is not a case this file was built for.
 *
 * <p><b>What it does NOT stand in for.</b> Nothing here enforces a rule either route
 * measures for itself - the transfer window, the three marks, a race not yet run, a
 * taken name. Those are `TeamWriteApiTest` and `CommentWriteApiTest`'s to hold, in Java,
 * against the real thing; a second copy of them here would be a second place to keep
 * them equal. The one refusal this file DOES answer, a blank name, is the one every case
 * that reaches this helper needs refused to stay off the queue at all - without it, a
 * case proving the form empties the box would still see a card.
 */
export function fakeQueue(): { asked: Asked[]; stop: () => void } {
  let nextId = 900001
  const added: ServedPendingItem[] = []
  const members = fileOf<FileMember[]>('competitors')
  const events = fileOf<FileEvent[]>('events')
  const seeded = fileOf<ServedPendingItem[]>('verification')

  const nameOf = (memberNumber: string): string => {
    const found = members.find((one) => one.memberNumber === memberNumber)

    return found === undefined ? '' : `${found.firstName} ${found.lastName}`
  }

  const { asked, stop } = serverThat((path, init) => {
    if (path === '/api/teams' && init?.method === 'POST') {
      return proposeTeam(String(init.body))
    }

    if (path === '/api/comments' && init?.method === 'POST') {
      return rateEvent(String(init.body))
    }

    if (path === '/api/verification') {
      return new Response(JSON.stringify([...seeded, ...added]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    return null
  })

  function proposeTeam(sentBody: string): Response {
    const sent: {
      name: string
      note: string
      bio: string
      link: string
      city: string
      country: string
    } = JSON.parse(sentBody)
    const name = sent.name.trim()

    /* THE ONE REFUSAL THIS FILE ANSWERS. Every other field `TeamWriteApiTest` refuses
       for (an unknown country, a name making no address, a name already taken) is a
       question about the real codebook or the real league, neither of which is here to
       ask; a case about any of those measures the Java route, never this one. */
    if (name === '') {
      return refused('theFormIsNotComplete')
    }

    const who = whoTheCookieCurrentlyNames()
    const id = nextId
    nextId += 1

    added.push({
      queue: 'teams',
      kind: '',
      date: TODAY,
      who: who === null ? '' : nameOf(who.memberNumber),
      subject: name,
      subjectId: '',
      /* JUST THE NOTE, never composed with the town - `TeamWriteApi.write`'s own
         shape: „note is not the team's description... it goes into verification.body
         and into no column of team_proposal". The town is what `TeamFields` draws
         from `city`/`country` below, on the card itself. */
      body: sent.note.trim(),
      rating: NO_RATING,
      city: sent.city.trim(),
      country: sent.country.trim(),
      id,
      memberNumber: who?.memberNumber ?? null,
      photoId: null,
    })

    return new Response(JSON.stringify({ id, name }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }

  function rateEvent(sentBody: string): Response {
    const sent: {
      eventId: number
      organisation: number
      value: number
      ambience: number
      body: string
    } = JSON.parse(sentBody)
    const event = events.find((one) => one.id === sent.eventId)
    const who = whoTheCookieCurrentlyNames()
    const id = nextId

    nextId += 1

    added.push({
      queue: 'comments',
      kind: '',
      date: TODAY,
      who: who === null ? '' : nameOf(who.memberNumber),
      subject: event === undefined ? '' : event.name,
      subjectId: String(sent.eventId),
      body: sent.body,
      rating: { organisation: sent.organisation, value: sent.value, ambience: sent.ambience },
      city: '',
      country: '',
      id,
      memberNumber: who?.memberNumber ?? null,
      photoId: null,
    })

    return new Response(JSON.stringify({ id }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }

  return { asked, stop }
}

/** Read once per call, off the same generated files the disc reader answers a GET
 *  with, so a fixture added there is a fixture this file sees too. */
function fileOf<T>(name: string): T {
  const parsed: T = JSON.parse(readFileSync(join(process.cwd(), 'public', 'mock', `${name}.json`), 'utf-8'))

  return parsed
}

type FileMember = { memberNumber: string; firstName: string; lastName: string }

type FileEvent = { id: number; name: string }

/**
 * The day a fresh row is stamped with, fixed rather than read off the machine.
 *
 * <p><b>`clock/oneClock.test.ts` refuses the machine's own moment in any file but
 * `clock/context.ts`</b>: the portal has one clock and this file is not it, so asking
 * for it here would be exactly the fault that guard exists to catch - a screen
 * simulating one day while this answered with another. And there is nothing to lose by
 * fixing it: `PendingItem.date` draws nowhere any case in this repository reads, so the
 * value only has to be a valid date, never today's.
 */
const TODAY = '2026-01-01'
