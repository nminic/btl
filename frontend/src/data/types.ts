/* Domain types, in the terminology fixed by ADL A2: an event (dogadjaj) holds
 * one or more races (trka). The word "distance" is never an entity, because
 * timed and free races have no fixed length.
 */

import type { AgeBand } from './categories'

export type Gender = 'M' | 'F'

/**
 * Which square of a picture is the picture, as three fractions.
 *
 * Here rather than beside the arithmetic that reads it (components/crop.ts),
 * because it is part of two records and a record cannot be described in terms
 * of a component: a team keeps one, and so does a picture waiting for a
 * moderator. What each number means, and why they are fractions rather than
 * pixel edges, is written where the arithmetic is.
 */
export type Crop = { x: number; y: number; size: number }

/** The five length categories from PDL P5. Marathon and half marathon are
 *  recognised by the exact value 42.2 and 21.1, with no tolerance. */
/* Shortest to longest, the same order as CATEGORIES in derive.ts, which is
   where the order is decided and where a test holds it. */
export type RaceCategory = 'short' | 'half' | 'long' | 'marathon' | 'ultra'

/* What a coloured dot beside an event can say, which is the five lengths and one
   thing besides: that the event holds a race which fixes no length at all.

   **Not a sixth `RaceCategory`.** That list is read in thirteen places across seven
   files and by five families of words: the ring on a profile, the filter of the
   standings, the boards by length, the rotation on the front page. None of them has
   anything to say about a race with no fixed length, because such a race belongs to
   no board and has no ring segment; the owner asked for a colour **in the calendar**
   on 30.08.2026, not for a sixth length in the whole portal. Measured before the
   code was written, and it is what kept `CATEGORIES` at five.

   A list rather than a union, so the guard over the words for these can be walked
   (`i18n/keys.test`). Written out rather than spread from `CATEGORIES`, which lives
   in `data/derive.ts` and would make this file depend on that one; a case holds the
   two to each other instead (`derive.test.ts`). */
export const DOTS = ['short', 'half', 'long', 'marathon', 'ultra', 'unmeasured'] as const

export type Dot = (typeof DOTS)[number]

/* What a race fixes before anybody runs it, and so what is left to the runner
   (PDL, from the specification on): a race of a **length** fixes the distance and
   the runner brings the time, a **timed** race fixes the time and the runner
   brings the distance, and a **free** race fixes neither and is run until its own
   goal is met, the way Round 'n' Around is.

   First in the list is what a race is unless somebody says otherwise, so the order
   is not cosmetic. That is the same reason `EVENT_KINDS` is ordered as it is, and
   this list is that one's shape on purpose: a list rather than a union, so a guard
   over the words for these can be walked (i18n/keys.test) and so the data can be
   held to them (data.test). A union is gone by the time anything runs. */
export const RACE_KINDS = ['length', 'time', 'free'] as const

export type RaceKind = (typeof RACE_KINDS)[number]

/* What is being put on: a race, a training session, or a gathering (owner,
   10.08.2026). The calendar has always carried things that are not races; this
   is the first field that says which is which. First in the list is what a new
   event is, so the order is not cosmetic.

   A list rather than a union, so the guard over the words for these can be
   walked (keys.test). A union is gone by the time anything runs. */
export const EVENT_KINDS = ['race', 'training', 'gathering'] as const

export type EventKind = (typeof EVENT_KINDS)[number]

/**
 * One member saying they are going to one event (owner, 11.08.2026).
 *
 * A stated intention and nothing more: PDL P10 has said since the beginning that
 * signing up through the portal is „samo iskazana namera, ne obaveza".
 */
export type Attending = {
  eventId: number
  memberNumber: string
}

/* The two ways a membership is held. A list rather than a union, so what the server
   said can be looked FOR among them rather than asserted to be one of them (ADL A14,
   and the shape `SIGNED_IN_ROLES` already has): a word the answer carries that the
   portal does not know is „I was not told", not a third basis. */
export const MEMBERSHIP_BASES = ['payment', 'feeExempt'] as const

export type MembershipBasis = (typeof MEMBERSHIP_BASES)[number]

/** What a member shows of their birthday on their own profile. */
export const BIRTHDAY_SHOWN = ['none', 'year', 'full'] as const

export type BirthdayShown = (typeof BIRTHDAY_SHOWN)[number]

/**
 * A member of the league, as `/api/competitors` answers for one.
 *
 * **WHETHER THE FEE IS STANDING IS NOT A FIELD HERE, AND SINCE 21.09.2026 IT IS THE
 * PRESENCE OF THE ROW.** `active` stood here until the portal read the generated
 * file, where every member was on the list and a flag said which of them counted.
 * The server does not answer that way and cannot be made to: the owner closed it on
 * 13.09.2026, and `CompetitorApi` says why in one line - a member whose fee has
 * lapsed is not on the list, so that nothing may be read out of the DIFFERENCE
 * between one answer and another.
 *
 * **So every question the flag used to answer is now asked of the list**, and the
 * two are not the same shape of question. „Is this member active" was a field on a
 * record somebody already had; „is this member on the list" is a lookup that
 * answers nothing for a number nobody has - which is the same answer, deliberately
 * (PDL P23: a profile that cannot be reached and a profile that does not exist read
 * alike). The five screens that asked it all held the `undefined` half already,
 * because a member administration had deleted has always been able to leave a
 * comment or a result behind.
 *
 * **What it cost to get wrong, measured before it could:** `profile/visible.ts` read
 * the flag, and a field the answer has not got arrives `undefined`, so the first
 * reader of the switched portal would have been refused every profile on it.
 */
export type Competitor = {
  memberNumber: string
  firstName: string
  lastName: string
  gender: Gender
  city: string
  country: string
  /**
   * The age band this member competes in, which is the whole of what the portal
   * is allowed to know about how old they are.
   *
   * **The band is stored and the year of birth is not, since 13.09.2026.** The
   * record carried `birthYear` and the band was worked out from it. That is the
   * right way round for a database and the wrong way round here: every field on
   * this record that is not behind the question of who is asking is public to
   * anybody who asks for the address, signed in or not (ADL A8), and the band is
   * not one of the three that are (`/api/competitors`). Član 74 and
   * the privacy policy both say the date of birth „se nikada ne prikazuje, ni u
   * punom ni u skraćenom obliku. Javna je samo kategorija koja iz njega
   * proizlazi", and a year is the short form. So the portal now carries the
   * thing that is public and not the thing it was derived from.
   *
   * **What that costs, measured rather than guessed.** The band moves with the
   * calendar and this field does not: it is the band for `SEASON`. Counted over
   * the served data on 13.09.2026, 25 of the 32 members change band somewhere
   * between 2010 and 2027, so every screen that draws a category for an earlier
   * season now draws today's band for them. Keeping that exact would mean a band
   * per season, and that was measured too: from a band per season over 2010-2027
   * the **exact** year of birth comes back for those same 25 members, because the
   * season a band changes in fixes it. One band pins nobody: nought of the 32.
   *
   * **What one band does still give away, and the first draft of this got it
   * wrong.** It said the narrowest set of years a band is consistent with is
   * fifteen wide. That is true of the band READ ON ITS OWN and false of the record
   * it sits in. Nobody enters a league, joins a club, runs a race or writes a
   * comment before they are born, and all four of those are public and dated on
   * the same file or beside it. Measured against the years this change removed,
   * 000007's window is **eight** years wide (2003-2010, closed by a comment of his
   * dated 2010-05-08) and six of the 32 come in under fifteen. Every one of the 32
   * true years lies inside its window, so these are hard bounds and not a guess.
   *
   * **So the rule this field is under is not „the band gives nothing away".** It is
   * that a window is not a year: eight candidates is not a date of birth, and Član
   * 74 is about the date. What follows is a cost to weigh rather than a licence:
   * every further public fact with a date on it narrows these windows again, so one
   * is worth adding on its own merits and not on the grounds that the band already
   * reveals nothing.
   *
   * So exactness through history and a private date of birth cannot both be had out
   * of a public file, and this is the half the policy names. The other half is what
   * the backend is for (ADL A8).
   */
  ageBand: AgeBand
  /**
   * Whether this member runs in the beginners' category rather than in the one
   * for their age (PDL P7).
   *
   * A yes or a no, and the record keeps it as one. The registration form asks it
   * as two buttons, „Početnička" and „Starosna", which write the words „yes"
   * and „no"; the layer between the two turns those into this (forms/records.ts,
   * `like` and `recordValue`). It matters that they meet: „no" read as a yes
   * puts a member into the beginners' category for a whole season, and that
   * cannot be undone mid-season.
   */
  firstSeason2027: boolean
  firstSeason: number
  /**
   * How this membership is held, and ONLY TO THE ADMINISTRATION.
   *
   * PDL, 793: the basis is administration's to see. `/api/competitors` answers it
   * on every row or on none, and the condition is the CALLER rather than the row
   * (`CompetitorApi`), so a screen that is not the administration's gets a record
   * without the key at all.
   *
   * **The `?` is the whole of that sentence and it is not a convenience.** Typed
   * `MembershipBasis` the portal claimed every member carries it, which was true of
   * the generated file and is false of the answer; the one screen that draws it
   * (`pages/admin/AdminMembers.tsx`) is behind the same door the field is.
   */
  membershipBasis?: MembershipBasis
  /**
   * The code this member's own referral link carries, AND ONLY ON THE CALLER'S OWN
   * ROW.
   *
   * Not the member number, which is what the link used to carry: that number is
   * public and consecutive, since it is the address of a profile and the sign in
   * list prints it beside every name. Anybody could have assembled somebody
   * else's link, or credited themselves with a member they never brought.
   *
   * **Absent from every other row**, which is the shape `/api/competitors` answers
   * (`case when c.id = :me then c.referral_code end`) and the reason for the `?`:
   * a code is what somebody else's link would be assembled out of, so nobody is
   * given anybody's but their own.
   */
  referralCode?: string
  /**
   * How many members this one brought in whose fee is standing, AND ONLY ON THE
   * CALLER'S OWN ROW.
   *
   * **This replaced `referredBy` on 21.09.2026, and the reason is that the portal
   * cannot work the count out any more.** It used to be counted here, over the
   * whole list: „everybody whose `referredBy` is my code, and whose fee is
   * standing". Neither half of that survives the switch to `/api`. A member whose
   * fee has lapsed is not on the list at all (13.09.2026), and `referredBy` is not
   * answered for anybody: it is the KEY of whoever brought a member (V7), and a
   * key is not a thing the portal may be handed. So the count is worked out where
   * both halves are known, which is the database, and arrives as one number.
   *
   * Absent from every other row, for the same reason the code above is.
   */
  referredCount?: number
  /**
   * Whether this member has hidden their profile from readers who are not signed in.
   *
   * The published privacy policy has promised this since it was written: „U podešavanjima
   * možete sakriti profil od posetilaca koji nisu prijavljeni, ali ne i od ostalih članova,
   * jer bi time nestao smisao zajedničkog rangiranja." Nothing in the code answered for it
   * until 06.09.2026, when the owner asked for the control rather than for the sentence to go.
   *
   * **What it hides is the profile page, not the member.** The reason is in the policy's own
   * sentence: the standing would stop meaning anything. So the name keeps its place in every
   * table and every ranking, and it is the page behind it that says nothing to a stranger.
   */
  profileHidden: boolean
  /**
   * How much of the birthday this member has chosen to show on their own profile.
   *
   * Owner, 06.09.2026: „Izbor privatnosti da li član želi da prikaže ceo datum rođenja, samo
   * godinu ili ništa služi za to šta će biti vidljivo na njegovom / njenom profilu, i ni za šta
   * više." One field with three values rather than two switches, because that is the shape of
   * the question, and the default is „none" because both the policy and Član 74 already say the
   * exception is off unless chosen.
   *
   * **No value of this shows anything at all, and since 13.09.2026 there is nothing left for
   * one to show.** It was already so on the 12th, when the owner had the exception struck from
   * Član 74 and from the privacy policy rather than rewritten: the birthday list it existed for
   * was abolished on 06.09.2026, so the exception named a thing that did not exist. What stands
   * is the rule with nothing beside it, „Datum rođenja se nikada ne prikazuje, ni u punom ni u
   * skraćenom obliku", and `profile/profile.test.tsx` holds the card to it.
   *
   * This used to add that `full` would show the year, since the record held `birthYear` and
   * nothing finer. It holds neither now. The year left the record on 13.09.2026 for the reason
   * written on `ageBand`, and `birthDate` was never here: it is one of the thirteen registration
   * fields with nowhere to live until the backend.
   *
   * **So why it is still a field.** The choice is a member's own and the portal has been asking
   * for it since 06.09.2026; throwing the answers away would mean asking everybody again. It is
   * also what makes the guard on the card mean anything: two members ask for a birthday to be
   * shown, and the case can only measure „nothing is drawn" against a record that asked for
   * something. What it must never become is a reason to put the data back.
   *
   * It hid the day, never the category: „Javna je samo kategorija koja iz njega proizlazi"
   * (Član 74). That half is now the whole of what the record carries — see `ageBand`.
   */
  birthdayShown: BirthdayShown
  teamId: number | null
  /**
   * The season this member joined their club, which is not the season they
   * joined the league.
   *
   * The profile names both, one after the other, because they answer different
   * questions and people join a club years after they start racing (owner,
   * 31.07.2026). Null wherever there is no club, so the two always travel
   * together and a club can never be named without a year.
   */
  teamSince: number | null
  /**
   * The racing biography, as published.
   *
   * Written by the member, and approved as written or refused with a reason and
   * handed back (PDL P11, P22, 06.08.2026), so what is here is what the member
   * wrote. Empty for most of them, which is the state the profile has to look
   * right in.
   */
  bio: string
}

/* ~~A race has no name of its own (owner, 11.08.2026).~~ **Overturned 23.08.2026
   by the owner**, and this note was left behind saying the opposite of the field
   two lines below it: „ja mogu da u okviru Beogradskog maratona imam dve trke, od
   42.2 i 21.1, i obe će dobiti default naziv Beogradski maraton. Ali onda mogu
   izmeniti ovu drugu da se zove Beogradski polumaraton."
 *
   So what tells one race from another is its name and its length, always both,
   and its day where two of them share those (`data/raceLabel.ts`). The 11.08.2026 sentence
   is kept here in its own words because it explains why every race in the
   generated file still carries its event's name: they were made before there was
   anything else to carry. */
export type Race = {
  id: number
  eventId: number
  /**
   * What this race is called.
   *
   * Every race has one, and it starts out as the name of its event (owner,
   * 23.08.2026): „ja mogu da u okviru Beogradskog maratona imam dve trke, od 42.2 i
   * 21.1, i obe će dobiti default naziv Beogradski maraton. Ali onda mogu izmeniti
   * ovu drugu da se zove Beogradski polumaraton."
   *
   * Never empty. It is what a member is offered when they report a result and what
   * their own list of results shows them afterwards, so a race with no name is a
   * row nobody can pick out.
   */
  name: string
  /**
   * Whether that name was given by hand.
   *
   * A race that still carries its event's name follows it when the event is
   * renamed; one that was renamed keeps what it was given (owner, 23.08.2026).
   * Written down rather than worked out by comparing the two names, because
   * comparing gets it wrong for the race somebody deliberately typed the event's
   * name into: it would go on following, and the next rename would take away a
   * choice that was made.
   *
   * A true or a false, which is what the schema keeps and what `/api/races`
   * answers with (`CalendarApi.Race`, `renamed boolean not null`). It was the
   * words „yes" and „no" until 20.09.2026, because the session store keeps every
   * value as text (`session/context.ts`, `Created`) and a boolean written into it
   * comes back as the string „false", which is true. That is a fault of the
   * store and not a shape of the record, and the store already answers for it:
   * `forms/records.ts` turns the two buttons of a yes-or-no question into a
   * boolean on the way in (`recordValue`, `like`) and back into the words on the
   * way out (`valuesFor`), which is how `Competitor.firstSeason2027` has been
   * kept since it was written.
   */
  renamed: boolean
  /**
   * The day this race is run on, which is not always the day of its event.
   *
   * One event may run over more than one morning: two races on the Saturday and
   * one on the Sunday are one event with three races and not two events (owner,
   * 10.08.2026). The event's own date is the day it begins, which is the day of
   * its first race, and that is the date its address is made from; a race that
   * runs later carries the day it runs on.
   */
  date: string
  /**
   * Which of the three kinds this race is.
   *
   * Every race in the data is `length` and was before this field existed, because
   * until it existed there was nothing else a race could be. It is written on all
   * 1612 of them rather than left out and read as a default, which is how
   * `EVENT_KINDS` was carried into the events when it arrived: a field written on
   * every record can be held to the list of words that exist (`data.test`), and a
   * default cannot, since a misspelt kind and an absent one read alike.
   */
  kind: RaceKind
  /**
   * How long a timed race lasts, in seconds. Zero on every other kind.
   *
   * This is the race's own limit and not anybody's time: on a timed race it is the
   * same for everyone who finished, and it is what the formula scores against
   * (owner, 29.08.2026, `Tsec` = 24 h = 86400 s). He turned down the other reading,
   * in which `Tsec` is the time a runner actually spent, because that one rewards
   * stopping: 60 km in 6 h would beat the same 60 km run out over the full 24.
   */
  limitSeconds: number
  /**
   * How far this race is, in kilometres.
   *
   * Fixed by the race only where `kind` is `length`. On a timed and on a free race
   * the distance is what each runner covered, so it is carried by their result and
   * not by the race, and this is zero.
   */
  distanceKm: number
  ascentM: number
  descentM: number
  category: RaceCategory
}

export type BtlEvent = {
  id: number
  slug: string
  name: string
  date: string
  city: string
  country: string
  kind: EventKind
  /**
   * Whether the event is singled out in the calendar and on the front page
   * (owner, 11.08.2026).
   *
   * **The form still asks it as a list of two and not as a box to tick**, which
   * is what the owner asked for: a list says what both answers are before either
   * is chosen, and a box says only one of them. What the RECORD keeps is a true
   * or a false, because that is what the schema keeps and what `/api/events`
   * answers with (`CalendarApi.Event`, `featured boolean not null`). The two
   * meet in `forms/records.ts`, which is where every question asked in words and
   * kept as a flag has met since `Competitor.firstSeason2027` was written.
   */
  featured: boolean
  /**
   * What the organiser says this race is, and where they say the rest of it.
   *
   * Neither is asked for (owner, 23.08.2026): an event entered a fortnight before
   * its distances are known has neither, and the calendar is drawn from the name,
   * the day and the town. Both are carried onto a copy, because next year's
   * running of a race is described the same way and points at the same page, and
   * whoever is copying edits them from there.
   *
   * The link is an address of somebody else's page, which is the second such
   * value the portal keeps; the first is the link to official results on a
   * result. It is refused the same way, by the shape the form asks for.
   */
  description: string
  link: string
  /**
   * The event this one was copied from, or nothing at all.
   *
   * **Nothing, and not an empty string.** The column is nullable and
   * `/api/events` answers with `null` for an event nobody copied
   * (`CalendarApi.Event`, `Long copiedFrom`); an empty string is a value that
   * says the copy came out of an event whose identity is blank, which is not a
   * state this portal has.
   *
   * Written the moment a copy is made and never again (owner, 11.08.2026), so
   * one edition knows what it came out of and a chain of them reads backwards
   * however long it is. What it carries is the comments: what was said about
   * last year's running is said about this race.
   *
   * Explicit and not by name, because the name changes: "Beogradski maraton"
   * becomes "Wizz Air Beogradski maraton" and is the same race, while two
   * unrelated "Novogodišnja trka" are not one race in two towns.
   */
  copiedFrom: number | null
}

/* An event does not list its races. It did, in `raceIds`, and the same link was
   written a second time on the race itself: two records of one fact drift apart
   the moment one is written and the other is not, which is what happened to
   every race entered by hand. The race says which event it belongs to and that
   is the whole of it (ADL A7, 06.08.2026). */

export type Result = {
  id: number
  /**
   * Whose run it was, while there is a member number to name.
   *
   * **Nothing is an ordinary answer here since V16.** A row in `competitor` is a
   * person who registered; a MEMBER is a row whose `member_number` is there, so a
   * result can belong to somebody who has no number yet and `/api/results`
   * answers with `null` for them (`ResultApi.Result`).
   */
  memberNumber: string | null
  raceId: number
  /**
   * The name of the race this result was run in, carried on the result the way
   * the event's name already is.
   *
   * This is what every list of results shows (owner, 23.08.2026): „u listi
   * rezultata na profilu npr. treba da se prikazuju nazivi trka na kojima je čovek
   * učestvovao, a ne događaja."
   */
  raceName: string
  /**
   * And the name of the event it belonged to, which is **not** what those lists
   * show any more. It stays because the link out of such a row goes to the event
   * and is built from it, and because the calendar and the event's own page name
   * the event and go on doing so.
   */
  eventName: string
  /**
   * The address of the event this race belonged to, carried on the result
   * itself the way the event's name already is.
   *
   * Every race named in a table of results is a link to its event (owner,
   * 31.07.2026). The alternative was for each such screen to load the races and
   * the events as well, two files of one and a half and one and two tenths
   * thousand rows, to print one column. A results endpoint would join the event
   * anyway, so this is the shape the backend will hand back.
   */
  eventSlug: string
  date: string
  distanceKm: number
  ascentM: number
  descentM: number
  seconds: number
  points: number
  category: RaceCategory
}

/**
 * A racing pair: two members who confirmed one another, for one season.
 *
 * **A record of its own rather than a field on a member** (odluka 07.09.2026). A team is a field
 * (`teamId`) because the relation is many to one; a pair is symmetric, so `pairWith` written on
 * both members would be one fact in two homes and the two could drift apart (ADL A31). It is also
 * what the board of best pairs ranks, and a board ranks records.
 *
 * `season` is the season the pair holds for. Forming has to be finished by 31 December for the
 * pair to count in the season that follows (PDL, „Trkacki par"), so a pair is made in one year and
 * raced in the next.
 *
 * **THE DAY THE PAIR WAS MADE IS NOT HERE, AND THAT IS THE OWNER'S DECISION RATHER THAN A FIELD
 * THE SERVER HAS NOT GOT YET.** 13.09.2026, of `pairs.since`: the day „se ne prikazuje nikome",
 * and when the mock is switched off it „sklanja se i sa ekrana". `/api/pairs` answers `id`,
 * `season` and the two numbers and nothing else, so a field here would be a promise every row
 * broke. What the season already says is the thing anybody needed it for: which season the pair
 * runs in.
 */
export type RacingPair = {
  id: number
  season: number
  /** Both members, and exactly two: a pair is one man and one woman (PDL). */
  memberNumbers: [string, string]
}

export type Team = {
  id: number
  slug: string
  name: string
  city: string
  country: string
  /**
   * Who sits in this team's seat, AND ONLY TO THE ADMINISTRATION.
   *
   * PDL P13: the seat is appointed by „Superadmin ili moderator sa pravom nad timovima", and
   * somebody who may appoint it cannot be refused the sight of who is in it. `/api/teams`
   * answers this field to them and to nobody else.
   *
   * **The `?` and the `null` are two different sentences and both are needed** (`TeamApi`, four
   * states, 21.09.2026). The key ABSENT is „I am not telling you", which is every reader outside
   * the administration. An empty string is „nobody holds this seat". A number is the member who
   * does. JSON `null` is „somebody holds it and he is not a member, so there is no number to give
   * you" - a row in `competitor` may have no member number since V16, and it may hold a seat.
   *
   * **A member is answered `foundedByMe` instead**, which is this reduced to what Article 73 lets
   * a reader have: nothing about anybody else at all.
   */
  organizerMemberNumber?: string | null
  /**
   * Whether the one asking founded this team, AND ONLY WHEN SOMEBODY IS ASKING.
   *
   * Absent - not false - from a visitor's answer, because „you did not found this" and „I do not
   * know who you are" are two sentences and a visitor must be told the second (`TeamApi`).
   *
   * This is what `data/teamAdmin.ts` reads since 21.09.2026, and the whole reason it may: the
   * question every screen asks is whether the READER administers the team, never who does.
   */
  foundedByMe?: boolean
  /**
   * What the team says about itself, as published.
   *
   * The first third of the team page (owner, 31.07.2026), beside the races and
   * the figures. Empty on a team that has just been founded, which is the state
   * the page has to look right in.
   */
  bio: string
  /**
   * The logo, as a path to a picture, or null until the team has one.
   *
   * Owner, 12.08.2026: added at team level and drawn in the table of teams
   * before the name, in a circle. Null and not an empty string, because the two
   * would mean the same thing on screen and different things in a record: a team
   * that has none is not a team whose logo is the empty path.
   */
  logo: string | null
  /**
   * Which square of that logo the circle shows (components/crop.ts).
   *
   * Kept on the record rather than cut into the file, which is the same
   * decision as on a waiting item and made for a second reason here: the file
   * is what the team sent, and a mark drawn from it is one of the sizes it is
   * drawn at. Cutting the file would mean a team that wanted its logo framed
   * differently had to send the logo again.
   *
   * The whole picture where nobody chose, which is every team the league
   * started with and every team an administrator enters by hand.
   *
   * **Nothing at all for a team with no mark, and that is the answer's shape rather than a
   * looseness.** `/api/teams` reads the square off the picture's own row, every column of which
   * is NOT NULL, so the mark and its square „go out together or neither does" (`TeamApi`). Typed
   * `Crop` the portal claimed a square for a team that has no picture to cut. Nothing breaks at
   * the one place that reads it, because `components/crop.ts` has answered `WHOLE` for a record
   * with no square since the day a missing key took a whole table into the error boundary.
   */
  crop: Crop | null
}

export type League = {
  id: number
  slug: string
  name: string
  season: number
  eventIds: number[]
  /** Written for this league; empty until somebody writes it, and then the
   *  section does not appear at all. */
  rules: string
  prizes: string
}

/**
 * Somebody the superadmin has made a moderator (PDL P21, P28a).
 *
 * Three things are asked for and the fourth is given rather than typed. There is
 * no password here and there never will be: a credential somebody else types is
 * a credential two people know, so the moderator sets their own when the backend
 * arrives (ADL A8).
 *
 * `rights` is what the superadmin has ticked, as the keys from rights.ts. An
 * empty list is not a broken record, it is a moderator who has just been made and
 * may do nothing yet.
 */
export type Moderator = {
  id: number
  firstName: string
  lastName: string
  email: string
  rights: string[]
}

export type PageSection = {
  heading: string
  body: string
  /**
   * A drawing the section carries, named rather than written.
   *
   * Where it stands is the body's to say: a line holding nothing but
   * `[[gallery]]` is the place it goes (src/components/PageSectionBody.tsx). The name
   * is here and the place is there, so neither is written twice, and a section
   * that names a drawing has to mark a place for it.
   *
   * The renderer of written pages is a deliberately small subset of Markdown and
   * has no pictures in it (ADL A7), which is right: an administrator writes these
   * records, and a page that can point at any image is a page that can point at
   * anything. One name for one drawing the portal already has is a different
   * thing, and it is what the rulebook needed when the owner made the ducats a
   * section of it rather than a screen of their own (04.08.2026).
   *
   * The list is closed and it is this: `ducats`, the wall of every ducat the
   * league awards, and `prices`, the price list of the membership fee.
   *
   * `statute` was a third value for one day, 22.08.2026: the owner asked for the
   * statute at the foot of the rulebook in the morning and, on reading the terms
   * the same evening, asked for it to be a link in their first section instead.
   * A link in prose needs no drawing and no third value.
   *
   * `prices` is here for the same reason `ducats` is. The statute puts the
   * amount of the fee with the management board (član 24), so the rulebook names
   * that decision and shows the table under it; typed into the text it would be
   * a third copy of figures that already live in `data/pricing.ts`, and the copy
   * that drifts is the one a member reads.
   */
  gallery?: 'ducats' | 'prices' | null
}

/** A page of written text: the rulebook, the terms, the page about the league.
 *  Kept as data rather than in the translation dictionary because these run to
 *  thousands of words and are written and revised on their own schedule. */
export type StaticPage = {
  /** The address this page answers at, and the one identity in this portal a
   *  human still types (ADL A4d). It is on the record rather than the key of a
   *  dictionary around it, because that is what `/api/pages` answers with
   *  (`PageApi.Page`): a list whose rows carry their own address. */
  slug: string
  title: string
  sections: PageSection[]
  /**
   * Slugs of other written pages shown above this page's own sections.
   *
   * One text that belongs on two screens is kept once and pointed at twice: the
   * address of the president stands on the front page and on "O ligi" (PDL P28a),
   * and the administrator who maintains it edits one record. Copying it into both
   * would guarantee that one of the copies is out of date.
   */
  includes?: string[]
}

/* What is waiting for a decision, in the seven queues that are read from a file.
 *
 * Here rather than beside the screens that draw it, because it describes a file
 * under `public/mock` and `src/data` is the only place that says what the
 * portal's data looks like. It also has to be reachable from the session: a
 * competitor proposes a team during a visit, and that proposal joins the same
 * queue as everything read off the disc, so both ends need the shape and neither
 * may import the other.
 */
export const PENDING_QUEUE_IDS = [
  'payments',
  'teams',
  'profiles',
  'comments',
  'schedule',
] as const

export type PendingQueueId = (typeof PENDING_QUEUE_IDS)[number]

/**
 * What a member wrote about an event, once it is out on the portal.
 *
 * The queue item it came from stays in the queue: this is the record of what was
 * published, and it is what every public screen reads. Keeping one shape for
 * both would mean a comment on the event page carrying an email address and two
 * dates it has no use for, and every reader of it deciding all over again what
 * counts as published.
 */
export type EventComment = {
  id: number
  /** Which event, by the id and not the name: an event is copied into the next
   *  season with its name unchanged (PDL P6), and a comment belongs to the one
   *  it was written about. */
  eventId: number
  /** The author's, while there is a profile to lead to, and nothing where there
   *  is not: a member who did not renew, or one who is gone altogether. The
   *  comment itself stays either way, because it is published prose (owner,
   *  07.08.2026); it is the LINK that goes (`CommentApi.EventComment`). */
  memberNumber: string | null
  /** The name as it was when the comment went out, for a comment whose author
   *  has since left the league and has no profile to read it off. */
  who: string
  date: string
  rating: EventRating
  /** Empty where the member rated the event and said nothing, which the form
   *  allows on purpose (RateEvent.tsx). */
  body: string
}

/* The three marks an event is rated on (PDL P6). The names are the owner's, with
   "okruženje" renamed to "ambijent" on 07.08.2026.

   A list with the shape derived from it, rather than the shape alone. Both the
   form that asks and the card that shows walk them, and both wrote the list out
   again for want of one to import; the words for them are walked off it too
   (keys.test). */
export const RATING_MARKS = ['organisation', 'value', 'ambience'] as const

export type RatingMark = (typeof RATING_MARKS)[number]

export type EventRating = Record<RatingMark, number>

/**
 * A rating nobody has given: the starting state of the form, and what a comment
 * written before the ratings existed carries.
 *
 * Frozen, and deliberately not annotated `: EventRating`. `Object.freeze`
 * returns `Readonly<T>` and the annotation widened that straight back to
 * mutable, so the compiler allowed a write to it and the freeze was left to
 * throw at the reader instead. Without the annotation the write is a build
 * error, which is where it belongs: this object is handed out by reference, so
 * one careless assignment would give a rating to everything that has none.
 *
 * The shape is given to `freeze` rather than to the constant, so a mark spelled
 * wrong is still refused: without it anywhere to check against, an extra field
 * would go in silently and the three real ones would be the only ones read.
 */
export const NO_RATING = Object.freeze<EventRating>({
  organisation: 0,
  value: 0,
  ambience: 0,
})

/* What sorts of thing a queue may hold. The empty one is every queue that holds
   only one sort, which is all of them but the racing profile and the teams.

   `teamEdit` is a team that already exists, put forward again by its
   administrator with something about it changed (owner, 04.09.2026: „Izmena tima
   ide u isti red za verifikaciju kao i predlog novog tima, uz oznaku šta je
   šta"). One queue and a mark on the item, rather than a queue of its own: a
   moderator looks at one place to decide about teams, and the two decisions
   differ only in what an approval writes. */
export const ITEM_KINDS = ['', 'bio', 'photo', 'teamEdit'] as const

export type ItemKind = (typeof ITEM_KINDS)[number]

export type PendingItem = {
  id: string
  queue: PendingQueueId
  /**
   * Which sort of thing it is, where one queue holds more than one.
   *
   * The racing profile alone: a biography and a picture are the same member's
   * profile and are looked at together (owner, 06.08.2026), but the decision
   * over them is not quite the same one. Both are approved as they stand or
   * refused with a reason and handed back; what differs is what the moderator
   * is asked to write, since a picture is changed by an instruction precise
   * enough to work from and a text is written again. Empty everywhere else,
   * because every other queue holds one sort of thing.
   *
   * A closed list and not an open string, exactly as the queues are: a value
   * outside it would be quietly treated as a picture, so a biography would be
   * refused under the heading „Profilna slika je vraćena", about a thing the
   * member never sent (`returned` in pages/admin/queues.ts). The empty one is every queue that
   * holds a single sort of thing, and the racing profile never carries it.
   */
  kind: ItemKind
  /** The day it arrived in the queue. */
  date: string
  /**
   * Who sent it in, or empty. A change of date may be reported by somebody with
   * no account at all (PDL P10), and on the payments queue it is empty for a
   * different reason: a registration whose fee is not recorded has no member
   * number yet, which is the whole of the 30.07.2026 decision made visible in
   * the data.
   */
  memberNumber: string
  who: string
  /** What the decision is about: the name of the league, the team, the member
   *  or the event. */
  subject: string
  /**
   * The same thing by its id, where approving it has to write a record about it.
   *
   * A name is what a moderator reads and is not what a record is filed under: two
   * events across two seasons carry one name (PDL P6), so a comment approved by
   * its subject would land on whichever of them was looked up first.
   *
   * Read today by the comments queue alone, whose approval writes a record filed
   * under the event. The reported changes of date carry it as well and nothing
   * reads it yet: moving the event and its races onto the new date is the next
   * thing asked for on that queue (owner, 06.08.2026), and it is the id that
   * will say which event to move. Empty on the four that decide about something
   * with no id yet, or about a person rather than a record.
   */
  subjectId: string
  /** The text to read before deciding: the biography, the comment, the reason
   *  given, or the file name of a picture. */
  body: string
  /**
   * The picture itself, on the two queues that carry one, and empty on the
   * other five.
   *
   * A profile picture and a team's logo, which are the two the owner asked to
   * be croppable inside the site (12.08.2026). The file name in `body` is what
   * a moderator reads; this is what they look at, and without it a decision
   * about a photograph is made by reading its file name aloud.
   *
   * The picture as text, because until F5 there is nowhere to put a file. The
   * browser reads it off the member's own disc and it travels no further than
   * the tab it was chosen in, which is what lets the whole flow be walked before
   * a server stores anything. What replaces it in F5 is a path, and nothing that
   * draws it changes.
   *
   * Empty on the items seeded into the mock file as well, and that is not an
   * oversight: those stand for pictures sent before this visit, and there is
   * nowhere they could have been kept. A card with no picture says so
   * (pages/admin/PendingQueue.tsx) rather than drawing an empty frame.
   */
  picture: string
  /**
   * Which square of that picture the member chose (components/crop.ts).
   *
   * Beside the picture rather than baked into it. Cutting the file down would
   * throw away exactly what the owner asked to keep visible: „da se nazire
   * ispod... i ono što se neće videti", and a moderator who cannot see what was
   * cut out cannot tell a portrait from a photograph with somebody else's child
   * in it. Kept apart, the decision is reversible and the evidence survives it.
   *
   * The whole picture where nothing was chosen, which is what every queue that
   * carries no picture holds.
   */
  crop: Crop
  /** A reported change of date carries both dates, so the difference is the
   *  thing on screen. Empty on every other queue. */
  currentDate: string
  proposedDate: string
  /**
   * What a member thought of the event, on the comments queue and nought
   * everywhere else (PDL P6, owner 06.08.2026).
   *
   * Three marks and not four. The fourth is the overall, and PDL P6 says it is
   * arithmetic: the average of these three. Stored as well it would be a fourth
   * place for the same fact to disagree with itself, and the first rounding
   * anybody changed would leave two answers on the portal at once.
   *
   * A comment with no rating at all is nought on all three: the rating is what
   * a member came to give and the comment is optional, so a nought here means
   * the record predates the rating rather than that somebody rated it nothing.
   */
  rating: EventRating
  /** The payments queue only. Until the fee is recorded there is no number to go
   *  by, so a waiting registration is known by its name and its address (PDL
   *  P8). Empty on the other six. */
  email: string
  /**
   * The town and the country, on the two queues that have one.
   *
   * On the payments, because how a member pays follows the country they live in
   * (PDL P8), so it belongs beside the fee. On the new teams, because approving
   * a proposal is what makes the team and these are two of the four things it is
   * made from (PDL P13). Empty on the other five.
   */
  city: string
  country: string
}
