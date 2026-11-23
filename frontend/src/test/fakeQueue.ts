import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NO_RATING } from '../data/types'
import type { EventComment, ServedPendingItem, WaitingRunFields } from '../data/types'
import { answeredWith, did, refused, serverThat, type Asked } from './serverAnswers'
import { whoTheCookieCurrentlyNames } from './setup'
import { addressOf } from '../pages/admin/teamProposal'

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
 *
 * @param waiting cards the queue holds beside the generated file's own, for a case that needs a
 *   member who already has a rating published on the event the card is about (`aWaitingRating`).
 */
export function fakeQueue(
  waiting: ServedPendingItem[] = [],
  /**
   * The season a team made here begins in, which the server answers off the day
   * (`transfersTakeEffect`) and a file that has no clock cannot: 2027 for a day of the window of
   * 2026, 2028 for one of the window of 2027.
   */
  seasonOfFounding = 2027,
): { asked: Asked[]; stop: () => void } {
  let nextId = 900001
  const added: ServedPendingItem[] = []
  const members = fileOf<FileMember[]>('competitors')
  const events = fileOf<FileEvent[]>('events')
  const seeded = [...fileOf<ServedPendingItem[]>('verification'), ...waiting]
  /* What `CommentWriteApi` publishes at once (owner, 19.10.2026: three marks and no words), which
     `GET /api/comments` then serves beside the generated file. Newest first, as the real route
     answers it. */
  const published: EventComment[] = []
  const seededComments = fileOf<EventComment[]>('comments')
  /* The cards of the comments a moderator has decided, which the queue no longer answers. */
  const decided = new Set<string>()
  /* WHAT THE SERVER HOLDS OF TEAMS AND OF WHO IS IN THEM, copied off the files on the first write
     that touches a team and served from then on (`GET /api/teams`, `GET /api/competitors`), so a
     screen that reads the two resources again after an approval draws what the route wrote, and one
     that wrote a copy of its own into the session would draw it twice. Before that first write both
     addresses are the disc's and this file stands in for nothing. */
  let teams: FileTeam[] | null = null
  let people: FileCompetitor[] | null = null
  const held = (): { teams: FileTeam[]; people: FileCompetitor[] } => {
    teams ??= fileOf<FileTeam[]>('teams').map((one) => ({ ...one }))
    people ??= fileOf<FileCompetitor[]>('competitors').map((one) => ({ ...one }))

    return { teams, people }
  }

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

    const changing = init?.method === 'POST' ? A_CHANGE_OF_A_TEAM.exec(path) : null

    if (changing !== null) {
      return changeTeam(Number(changing[1]), String(init?.body ?? '{}'))
    }

    if (path === '/api/teams/direct' && init?.method === 'POST') {
      return makeTeamDirectly(String(init.body))
    }

    const own = A_TEAM_OF_ITS_OWN.exec(path)

    if (own !== null && init?.method === 'PUT') {
      return changeTeamDirectly(Number(own[1]), String(init.body))
    }

    if (own !== null && init?.method === 'DELETE') {
      return deleteTeam(Number(own[1]))
    }

    if (path === '/api/teams' && (init?.method ?? 'GET') === 'GET' && teams !== null) {
      return json(teams)
    }

    if (path === '/api/competitors' && (init?.method ?? 'GET') === 'GET' && people !== null) {
      return json(people)
    }

    if (path === '/api/comments' && (init?.method ?? 'GET') === 'GET') {
      return new Response(JSON.stringify([...published, ...seededComments]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (path === '/api/verification') {
      return new Response(JSON.stringify([...seeded, ...added].filter((one) => !decided.has(String(one.id)))), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const deciding = init?.method === 'POST' ? A_DECISION.exec(path) : null

    if (deciding !== null) {
      return decide(deciding[1] ?? '', String(init?.body ?? '{}'))
    }

    return null
  })

  /**
   * ONE RATING PER MEMBER PER EVENT, THE NEW ONE REPLACING THE OLD (PDL, 19.10.2026): what the
   * member already has published on the event stops being served, wherever it stood - in the file
   * or among the ones published in this visit. Both ways a rating becomes published (an approval
   * and a rating with no words) go through here, so neither can leave two behind.
   */
  function replaceTheirs(memberNumber: string | null, eventId: number): void {
    for (const list of [published, seededComments]) {
      list.splice(
        0,
        list.length,
        ...list.filter((one) => !(one.memberNumber === memberNumber && one.eventId === eventId)),
      )
    }
  }

  /**
   * THE DECISION ON A CARD OF THE COMMENTS, standing in for `VerificationWriteApi.decide` and
   * `publishTheComment` and for nothing else: a card of any other queue is answered by the floor
   * in `test/setup.ts` (null here), which is all those cases ever needed.
   *
   * <p><b>An approval does what the route does and what the screen then reads.</b> The card leaves
   * the queue, and the comment goes into what `GET /api/comments` answers - REPLACING every comment
   * the same member already has published on the same event, because that is the route's own
   * statement („Jedna ocena po članu po događaju; nova zamenjuje staru", PDL, 19.10.2026) and the
   * reason the event page must read the server's answer again after an approval and not draw a copy
   * of its own beside it. A refusal deletes the card and publishes nothing, as the route does.
   */
  function decide(id: string, sentBody: string): Response | null {
    const card = [...seeded, ...added].find(
      (one) =>
        String(one.id) === id && !decided.has(id) && (one.queue === 'comments' || one.queue === 'teams'),
    )

    if (card === undefined) {
      return null
    }

    const approved = Reflect.get(Object(JSON.parse(sentBody)), 'approved') === true

    if (card.queue === 'teams') {
      return decideTeam(card, approved, sentBody)
    }

    decided.add(id)

    if (approved) {
      replaceTheirs(card.memberNumber, Number(card.subjectId))

      published.unshift({
        id: nextId,
        eventId: Number(card.subjectId),
        memberNumber: card.memberNumber ?? '',
        who: card.who,
        date: card.date,
        rating: card.rating,
        body: card.body,
      })
      nextId += 1
    }

    return new Response(JSON.stringify({ id, state: approved ? 'approved' : 'rejected' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  type Written = { name: string; city: string; country: string; bio: string; link: string; organizerMemberNumber?: string }

  /** `POST /api/teams/direct`: the team and its organizer in it, at once, no queue. */
  function makeTeamDirectly(sentBody: string): Response {
    const sent: Written = JSON.parse(sentBody)
    const { teams: all, people: members } = held()
    const organizer = members.find((one) => one.memberNumber === sent.organizerMemberNumber)

    if (organizer === undefined) {
      return refused('theOrganizerIsNotKnown', 409)
    }

    if (organizer.teamId !== null) {
      return refused('heIsAlreadyInATeam', 409)
    }

    const team: FileTeam = {
      id: Math.max(0, ...all.map((one) => one.id)) + 1,
      slug: addressOf(sent.name),
      name: sent.name,
      city: sent.city,
      country: sent.country,
      bio: sent.bio,
      link: sent.link,
      logo: null,
      smallLogo: null,
      crop: null,
      alsoInTheTeam: [],
      organizerMemberNumber: organizer.memberNumber,
    }

    all.push(team)
    organizer.teamId = team.id
    organizer.teamSince = seasonOfFounding

    return json({ id: team.id, slug: team.slug, name: team.name }, 201)
  }

  /** `PUT /api/teams/{id}`: the team as the administration wrote it, the organizer included. */
  function changeTeamDirectly(id: number, sentBody: string): Response {
    const sent: Written = JSON.parse(sentBody)
    const team = held().teams.find((one) => one.id === id)

    if (team === undefined) {
      return answeredWith(404)
    }

    Object.assign(team, sent, { slug: addressOf(sent.name) })

    return json({ id: team.id, slug: team.slug, name: team.name })
  }

  /** `DELETE /api/teams/{id}`: the team goes and so does every seat in it. */
  function deleteTeam(id: number): Response {
    const { teams: all, people: members } = held()

    teams = all.filter((one) => one.id !== id)

    for (const one of members) {
      if (one.teamId === id) {
        one.teamId = null
        one.teamSince = null
      }
    }

    return did()
  }

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }

  /**
   * A TEAM'S ADMINISTRATOR ASKS FOR A CHANGE (`POST /api/teams/{id}/changes`, `TeamAdministrationWriteApi`
   * 23.11.2026): a card of the queue of teams that names the team, and nothing moves in the team
   * until it is approved.
   */
  function changeTeam(teamId: number, sentBody: string): Response {
    const sent: { name: string; bio: string; link: string; city: string; country: string } = JSON.parse(sentBody)
    const who = whoTheCookieCurrentlyNames()
    const id = nextId

    nextId += 1
    held()

    const card: ServedPendingItem = {
      queue: 'teams',
      kind: 'teamEdit',
      date: TODAY,
      who: who === null ? '' : nameOf(who.memberNumber),
      subject: sent.name.trim(),
      subjectId: String(teamId),
      body: sent.bio.trim(),
      rating: NO_RATING,
      city: sent.city.trim(),
      country: sent.country.trim(),
      id,
      memberNumber: who?.memberNumber ?? null,
      photoId: null,
      crop: null,
      ...NO_RUN,
      link: sent.link.trim(),
    }

    /* A SECOND CHANGE OF THE SAME TEAM REPLACES THE ONE THAT WAITS (PDL P13, [ODLUKA 23.11.2026]):
       the card that waits is repointed at the new words and keeps its key, as the route does it
       (`TeamWriteApi.replaceTheChangeThatWaits`, after `MePhotoApi`). Only a card of THIS team, only a
       change, and only one nobody has decided: another team's card, a proposal of a new team (which
       names no team) and a decided card stand where they stood. */
    const waiting = added.find(
      (one) =>
        one.queue === 'teams' && one.kind === 'teamEdit' && one.subjectId === String(teamId) && !decided.has(String(one.id)),
    )

    if (waiting !== undefined) {
      Object.assign(waiting, card, { id: waiting.id })

      return json({ id: waiting.id }, 201)
    }

    added.push(card)

    return json({ id }, 201)
  }

  /**
   * THE DECISION ON A CARD OF THE QUEUE OF TEAMS, standing in for `VerificationWriteApi.decide`
   * and `FoundingATeam` and for the three things they do that a screen can read afterwards: the
   * team is made, or the one the change names is changed, from the card's words or the moderator's
   * corrections (`team`); the founder is in it and in its seat; a founder who is already in a
   * team is refused. Whatever else the route writes (the notices, the other teams that had asked
   * him) is `TeamDecisionsCarryWhatTheCardShowsTest`'s and the notice tests', in Java.
   */
  function decideTeam(card: ServedPendingItem, approved: boolean, sentBody: string): Response {
    const id = String(card.id)

    /* WHAT THE MODERATOR SAW IS WHAT THE CARD HOLDS NOW, or nothing is decided (`VerificationWriteApi.
       whyTheChangeIsNotTheOneHeSaw`, PDL P13 [ODLUKA 23.11.2026]): the same for an approval and a refusal,
       and a decision that names no words is a form not filled in. */
    const seen: { seenTeam?: { name: string; city: string; country: string; bio: string; link: string } } =
      JSON.parse(sentBody)

    if (seen.seenTeam === undefined) {
      return refused('theFormIsNotComplete')
    }

    const same = [seen.seenTeam.name, seen.seenTeam.city, seen.seenTeam.country, seen.seenTeam.bio, seen.seenTeam.link]
      .map((one) => one.trim())
      .join('|') === [card.subject, card.city, card.country, card.body, card.link ?? ''].map((one) => one.trim()).join('|')

    if (!same) {
      return refused('Izmena tima je promenjena, pogledaj je ponovo.', 409)
    }

    if (!approved) {
      decided.add(id)

      return json({ id, state: 'rejected' })
    }

    const corrected: { team?: { name: string; city: string; country: string; bio: string; link: string } } =
      JSON.parse(sentBody)
    const made = corrected.team ?? {
      name: card.subject,
      city: card.city,
      country: card.country,
      bio: card.body,
      link: card.link,
    }
    const { teams: all, people: members } = held()

    if (card.kind === 'teamEdit') {
      const team = all.find((one) => String(one.id) === card.subjectId)

      if (team === undefined) {
        return refused('theTeamIsGone', 404)
      }

      Object.assign(team, made, { slug: addressOf(made.name) })
    } else {
      const founder = members.find((one) => one.memberNumber === card.memberNumber)

      if (
        founder === undefined ||
        founder.teamId !== null ||
        all.some((one) => one.organizerMemberNumber === card.memberNumber)
      ) {
        return refused('heIsAlreadyInATeam', 409)
      }

      const team: FileTeam = {
        ...made,
        id: Math.max(0, ...all.map((one) => one.id)) + 1,
        slug: addressOf(made.name),
        logo: null,
        smallLogo: null,
        crop: null,
        alsoInTheTeam: [],
        organizerMemberNumber: card.memberNumber,
      }

      all.push(team)
      founder.teamId = team.id
      founder.teamSince = seasonOfFounding
    }

    decided.add(id)

    return json({ id, state: 'approved' })
  }

  function proposeTeam(sentBody: string): Response {
    const sent: {
      name: string
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
      /* THE DESCRIPTION, never composed with the town: the card's text is the proposal's
         description since 23.11.2026 (`VerificationApi`, `coalesce(tp.bio, ...)`) and the note is
         gone. The town is what `TeamFields` draws from `city`/`country` below. */
      body: sent.bio.trim(),
      rating: NO_RATING,
      city: sent.city.trim(),
      country: sent.country.trim(),
      id,
      memberNumber: who?.memberNumber ?? null,
      photoId: null,
      crop: null,
      ...NO_RUN,
      link: sent.link.trim(),
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

    /* NO WORDS: PUBLISHED AT ONCE, NEVER QUEUED, and the answer says so (`waiting: false`). The
       words are the box's text without its white space, the server's `strip`. The newest rating
       a member sends wins, so it also takes his waiting one of the same event out of the queue. */
    if (sent.body.trim() === '') {
      const number = who?.memberNumber ?? ''

      for (let at = added.length - 1; at >= 0; at -= 1) {
        const card = added[at]

        if (card?.queue === 'comments' && card.memberNumber === number && card.subjectId === String(sent.eventId)) {
          added.splice(at, 1)
        }
      }

      replaceTheirs(number, sent.eventId)

      published.unshift({
        id,
        eventId: sent.eventId,
        memberNumber: number,
        who: nameOf(number),
        date: TODAY,
        rating: { organisation: sent.organisation, value: sent.value, ambience: sent.ambience },
        body: '',
      })

      return new Response(JSON.stringify({ id, waiting: false }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    }

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
      crop: null,
      ...NO_RUN,
    })

    return new Response(JSON.stringify({ id, waiting: true }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }

  return { asked, stop }
}

/** `POST /api/verification/{id}/decision`, the address `test/setup.ts` matches the same way. */
const A_DECISION = /^\/api\/verification\/([\w-]+)\/decision$/

/**
 * A rating with words in it that is waiting for a moderator, as `GET /api/verification` serves it.
 *
 * <p>Its own function so a case states only the three things it is about - who, which event, which
 * words and marks - and not the eight names of a run and the other fields of a card that are empty
 * on every queue but one.
 */
export function aWaitingRating(
  id: number,
  member: { memberNumber: string; who: string },
  eventId: number,
  body: string,
  rating: EventComment['rating'],
): ServedPendingItem {
  return {
    queue: 'comments',
    kind: '',
    date: TODAY,
    who: member.who,
    subject: fileOf<FileEvent[]>('events').find((one) => one.id === eventId)?.name ?? '',
    subjectId: String(eventId),
    body,
    rating,
    city: '',
    country: '',
    id,
    memberNumber: member.memberNumber,
    photoId: null,
    crop: null,
    ...NO_RUN,
  }
}

/** Read once per call, off the same generated files the disc reader answers a GET
 *  with, so a fixture added there is a fixture this file sees too. */
function fileOf<T>(name: string): T {
  const parsed: T = JSON.parse(readFileSync(join(process.cwd(), 'src', 'test', 'mock', `${name}.json`), 'utf-8'))

  return parsed
}

type FileMember = { memberNumber: string; firstName: string; lastName: string }

type FileCompetitor = FileMember & { teamId: number | null; teamSince: number | null }

type FileTeam = {
  id: number
  slug: string
  name: string
  city: string
  country: string
  bio: string
  link?: string
  logo: string | null
  smallLogo: string | null
  crop: { x: number; y: number; size: number } | null
  alsoInTheTeam: unknown[]
  organizerMemberNumber: string | null
}

/** `PUT` and `DELETE /api/teams/{id}`. */
const A_TEAM_OF_ITS_OWN = /^\/api\/teams\/(\d+)$/

/** `POST /api/teams/{id}/changes`. */
const A_CHANGE_OF_A_TEAM = /^\/api\/teams\/(\d+)\/changes$/

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

/**
 * The run a result waits with, as the server answers it on every item that is not one:
 * all ten names empty (`data/types.ts`, `WaitingRunFields`). A team proposed or an event
 * rated here is never a run, so both rows carry this and nothing else.
 */
const NO_RUN: WaitingRunFields = {
  raceId: null,
  raceDate: null,
  raceKind: '',
  distanceKm: null,
  ascentM: null,
  descentM: null,
  seconds: null,
  link: '',
  eventId: null,
  eventName: null,
  eventKind: null,
}
