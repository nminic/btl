import { screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { must } from '../test/at'
import { clearResourceCache, loadResource } from './client'
import { renderAt } from '../test/render'
import { theCookieNames } from '../test/setup'
import { membersAsServed, serverThat } from '../test/serverAnswers'
import {
  aCompetitor,
  asAnswered,
  aWaitingItem,
  myOwnRecordFromMe,
  myOwnRow,
} from '../test/theAnswer'
import { readerAdministers, teamAdminOf } from './teamAdmin'
import type { Competitor, Team } from './types'

/**
 * THE SCREENS, AGAINST THE ANSWER THE SERVER REALLY GIVES.
 *
 * **Why this file has to exist, and it is the one thing a green suite could be
 * hiding.** Every other case on the portal is answered out of `public/mock`, which
 * is what keeps them reading real generated data rather than a fixture somebody
 * wrote (`test/setup.ts`). That file is older than the resources it now stands in
 * for. It carries `competitors[].active`, it carries `pairs[].since`, and it
 * carries a team's seat on every row. `/api` carries none of the three: the first
 * two the owner closed (13.09.2026), and the third leaves only to the
 * administration (P-javno, 13.09.2026, and `TeamApi`).
 *
 * So a screen that went on reading one of those three would be green in every case
 * the portal has and wrong on QA, and it is exactly what happened to be measured
 * before the switch: `profile/visible.ts` read `active`, and a field an answer has
 * not got arrives `undefined`, so the first reader of the switched portal would
 * have been refused every profile on it, the owner's included.
 *
 * **What each case below does is put the real answer in front of the screen**, with
 * the three names gone, and then ask for the thing the field used to decide. Each
 * one fails if the reading comes back, which is what none of the other cases can
 * say.
 *
 * **The address is not what is measured here**, and that is deliberate: `BASE`
 * moving back to `/mock` is held by `data/contract.test.ts`, which reads what was
 * ASKED FOR. These read what is DRAWN out of what was answered, so the two together
 * say „the portal goes to `/api`" and „the portal can read what `/api` says".
 */

/** The generated members, as JSON rather than as the type: this file is about the
 *  difference between the two, so it starts from what is really on the disc. */
const generated: Record<string, unknown>[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/competitors.json'), 'utf-8'),
)

/**
 * Every member `/api/competitors` answers a VISITOR with, off the generated file.
 *
 * Both halves of what the route does, and neither is a tidy-up: the rows whose fee has
 * lapsed are gone, and every name the answer does not carry is gone with them.
 *
 * **Reduced by the KEYS of the record the server declares and never by a list of names
 * to take away** (`test/theAnswer.ts`). A list here would be a second home for the
 * thing `test/serverAnswers.ts` already keeps, and a second home is how the first one
 * went short: `active` was on it, `referredBy` was on it, and `membershipBasis` was
 * not, so a member's own fee screen read a field the server does not give him with
 * every case green.
 */
function membersTheServerAnswers(): Record<string, unknown>[] {
  return generated
    .filter((one) => one.active === true)
    .map((one) => asAnswered(one, aCompetitor))
}

/** And the numbers it leaves out, which is what „their fee has run out" is now. */
const lapsed = generated
  .filter((one) => one.active !== true)
  .map((one) => String(one.memberNumber))

/** Somebody the answer does carry, for the half of every case that says „and this
 *  one is fine", so „nobody is drawn" cannot pass for „this one is not". */
const theMember = generated.find((one) => one.active === true) ?? {}

const stillAMember = String(theMember.memberNumber ?? '')

/** And what they are called, because a page has to be read by the one thing only
 *  that page says. Taken off the record rather than written here, so a change to the
 *  seed moves the case with it. */
const theirName = `${String(theMember.firstName ?? '')} ${String(theMember.lastName ?? '')}`

function answering(rows: Record<string, unknown>[], at: string) {
  return serverThat((path) =>
    path === at
      ? new Response(JSON.stringify(rows), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      : null,
  )
}

describe('the answer the harness stands in with', () => {
  /* **THE FLOOR UNDER THE THING THAT STANDS IN FOR THE SERVER, and it is here because
     without it the standing-in is not load-bearing.** `test/serverAnswers.ts` is what a
     case gets when it asks for the answer a member really receives, and it reduces the
     generated rows to the keys of the record the server declares
     (`test/theAnswer.ts`). Measured 21.09.2026: taking that reduction away left every
     case that uses it green, because no screen reads the three names it removes - so
     nothing held the harness to its own claim, and the next name to be withheld would
     have gone through unnoticed exactly as `membershipBasis` did.

     Asked of what goes ON THE WIRE rather than of the function, because that is what a
     screen is handed: the case loads the resource the way the portal does. */
  it('carries the names the record declares, and not one more', async () => {
    const { stop } = membersAsServed('000001')

    try {
      clearResourceCache()

      const answered = await loadResource<Record<string, unknown>[]>('competitors')
      const mine = must(
        answered.find((one) => one.memberNumber === '000001'),
        "the caller's own row",
      )
      const somebodyElse = must(
        answered.find((one) => one.memberNumber !== '000001'),
        'a row that is not his',
      )

      /* His own row carries the two the caller is given about himself; every other row
         carries neither, and no row carries the basis - that one is the
         administration's and reaches a member through `/api/me` instead. */
      expect(Object.keys(mine).sort()).toEqual(Object.keys(myOwnRow).sort())
      expect(Object.keys(somebodyElse).sort()).toEqual(Object.keys(aCompetitor).sort())
    } finally {
      stop()
      clearResourceCache()
    }
  })

  it("carries the caller's own record by the same measure, at /api/me", async () => {
    /* **THE SAME FLOOR OVER THE ONE ANSWER THAT IS NOT A RESOURCE.** `data/contract.test.ts`
       holds the record's KEYS against the components `MeApi.MyOwnRecord` declares; this
       holds what the harness really puts on the wire against that record. The two together
       are what the fourteen resources have had since round 2, and without this one the
       harness could go back to writing the whole generated row into `member` - measured
       21.09.2026, that mutation left every case green, which is the same shape of blindness
       the hand-written list had.

       Asked of the answer rather than of the function, because that is what the portal
       parses. */
    /* The cookie has to name somebody, or the answer is the 401 a visitor gets and there
       is no record on it at all. `renderAt` does this for every case that goes through
       the router; this one asks the address straight. */
    theCookieNames({ role: 'competitor', memberNumber: stillAMember })

    const answered: unknown = await (await fetch('/api/me')).json()
    const member: unknown =
      typeof answered === 'object' && answered !== null ? Reflect.get(answered, 'member') : null

    /* Narrowed by asking rather than by asserting (ADL A14): what comes back is the
       one value on this portal nobody can vouch for, so a cast here would be the file
       claiming what it is here to measure. An answer that carried no record at all
       leaves nothing to compare and fails against the seven names below. */
    const names =
      typeof member === 'object' && member !== null ? Object.keys(member) : []

    expect(names.sort()).toEqual(Object.keys(myOwnRecordFromMe).sort())
  })
})

describe('a profile, on the answer the server gives', () => {
  it('opens for a member the answer carries, although no field says they are active', async () => {
    /* **The case the whole switch turned on.** `reachable` read `competitor.active`;
       the answer has no such field, so the reading came back `undefined` for every
       member there is and `undefined && anything` is false. Put the reading back and
       this fails, on the real answer rather than on the generated file - which is the
       difference, because the file still carries the flag and would keep it green. */
    const { stop } = answering(membersTheServerAnswers(), '/api/competitors')

    try {
      const { router } = renderAt(`/sr/takmicar/${stillAMember}`)

      /* **BY THEIR NAME, AND NOT BY „there is a heading".** Written as
         `findByRole('heading', { level: 1 })` this passed with the reading of `active`
         put back, measured 21.09.2026: a profile that may not be read sends the reader
         to the front page (PDL P23), and the front page has a heading of its own. The
         assertion was satisfied by the very screen it was meant to refuse. */
      expect(await screen.findByRole('heading', { level: 1, name: theirName })).toBeVisible()
      /* And the reader is still where they asked to be, which is the other half of the
         same mistake: a redirect is what „refused" looks like, so it is the address that
         says the profile opened. */
      expect(router.state.location.pathname).toContain(stillAMember)
    } finally {
      stop()
    }
  })

  it('is not there for a member the answer leaves out', async () => {
    /* The other state of the same axis, and the reason the first case is not just
       „every profile opens": a member whose fee has run out is not in the answer, and
       the portal has to say the same thing about them as about a number nobody has
       (PDL P23). Measured on somebody who IS in the generated file, so a screen that
       went back to reading the file instead of the answer would draw them. */
    const { stop } = answering(membersTheServerAnswers(), '/api/competitors')

    try {
      const gone = lapsed[0] ?? ''

      expect(gone).not.toBe('')

      /* The home page, and not a page saying the profile is missing: an address that
         leads nowhere and an address somebody is hiding behind answer the same way
         (PDL P23, 06.09.2026). Read off the address, because the name of the portal
         is written on every screen. */
      const { router } = renderAt(`/sr/takmicar/${gone}`)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/sr')
      })
    } finally {
      stop()
    }
  })
})

describe('a member freed of the fee, on the answer the server gives', () => {
  /* **THE ONE SCREEN THAT ASKS FOR MONEY, MEASURED AGAINST THE ANSWER A MEMBER REALLY
     GETS.** The owner's sentence has two halves and one answer keeps each: „Clan vidi
     SVOJ osnov clanstva; tudj ne vidi niko osim administracije" (20.09.2026).
     `/api/competitors` keeps the second by asking whether the CALLER is the
     administration and never whether the row is his, so it withholds the field from a
     member about himself; `/api/me` keeps the first, on one row, and that row is his.

     Read off the public list the field came back nothing for every member, „freed of
     the fee" was false, and this screen opened the renewal panel with a payment slip on
     it: a member who owes the league nothing, asked to pay. Nothing failed, because the
     generated file still carries the field and the whole suite reads that file.

     Both states of the axis, because one of them alone says nothing: a member the
     league has freed is shown no renewal, and a member who pays is shown one. */
  function meAnswering(membershipBasis: string) {
    return serverThat((path) =>
      path === '/api/me'
        ? new Response(
            JSON.stringify({ role: 'competitor', account: 1, member: { membershipBasis } }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        : null,
    )
  }

  /* **AND THE TWO SOURCES ARE PULLED APART, which is what makes either case able to
     fail.** The generated file carries a basis of its own on every row, and the case
     below puts the OTHER word on the wire, so the screen reading the wrong source draws
     the wrong screen. Written the other way round - the wire agreeing with the file -
     both cases passed with the bug put back, measured 21.09.2026: the same value reached
     the screen either way and the case said nothing at all.

     Taken off the file rather than written here, so a change to the seed moves the case
     with it instead of quietly making the two agree again. */
  const generatedBasis = (memberNumber: string) =>
    String(
      (generated.find((one) => one.memberNumber === memberNumber) ?? {}).membershipBasis ?? '',
    )

  const whoPaysInTheFile = String(
    (generated.find((one) => one.membershipBasis === 'payment' && one.active === true) ?? {})
      .memberNumber ?? '',
  )

  it('is asked for nothing at all, although the list says he pays', async () => {
    /* A member the generated file calls a PAYER, told by the answer that he is freed. */
    expect(generatedBasis(whoPaysInTheFile)).toBe('payment')

    const { stop } = meAnswering('feeExempt')

    try {
      renderAt('/sr/moja-clanarina', 'competitor', whoPaysInTheFile, undefined, '2026-11-01')

      expect(
        await screen.findByText(/Oslobođen si plaćanja članarine za sezonu \d{4}, odlukom/),
      ).toBeVisible()
      /* **AND NO WAY TO PAY ANYWHERE ON THE SCREEN, which is the harm rather than the
         sentence.** A slip, a code and an amount are what a member acts on, and a member
         freed of the fee was being shown all three. The renewal panel itself stays, and
         says there is nothing to pay: that is the portal answering the question rather
         than hiding it. */
      expect(screen.getByText(/nema šta da uplatiš/)).toBeVisible()
      expect(screen.queryByRole('heading', { name: 'Uplatnica' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Kartica' })).not.toBeInTheDocument()
    } finally {
      stop()
    }
  })

  it('is asked to pay although the list says he is freed', async () => {
    /* The other state, off the same field and the same door, and with the two sources
       crossed the other way: the file calls this one freed. Without this case „nobody is
       asked to pay" would read exactly like „the screen is right". */
    expect(generatedBasis(stillAMember)).toBe('feeExempt')

    const { stop } = meAnswering('payment')

    try {
      renderAt('/sr/moja-clanarina', 'competitor', stillAMember, undefined, '2026-11-01')

      expect(await screen.findByRole('heading', { name: 'Uplatnica' })).toBeVisible()
      expect(screen.queryByText(/Oslobođen si plaćanja/)).not.toBeInTheDocument()
    } finally {
      stop()
    }
  })
})

describe('the referral link, on the answer the server gives', () => {
  it('carries no code where the answer carried none, rather than the word undefined', async () => {
    /* **The three conditional fields are answered on the CALLER'S OWN ROW and on no
       other** (`/api/competitors`), so a screen drawing „my own" reads a row that has
       them. That is true while the portal's idea of who is reading and the server's agree,
       and the two have one way of parting: the development switch puts a member number in
       the tab, and the cookie names an account (`pages/member/oneQuestion.test.tsx`). Read
       as somebody the cookie is not, the row comes back without the code, and the address
       under the sentence would read „…?preporuka=undefined" - a link a reader would copy
       and send on.

       What is drawn instead is the address with nothing after the sign, which is a link
       that plainly does not work rather than one that looks as if it might. */
    const { stop } = answering(
      membersTheServerAnswers().map(({ referralCode: _mine, ...rest }) => rest),
      '/api/competitors',
    )

    try {
      renderAt('/sr/moja-clanarina', 'competitor', stillAMember)

      expect(await screen.findByText(/registracija\?preporuka=$/)).toBeVisible()
      expect(screen.queryByText(/preporuka=undefined/)).not.toBeInTheDocument()
    } finally {
      stop()
    }
  })
})

describe('a racing pair, on the answer the server gives', () => {
  it('says which season it is for, and asks the answer for no day', async () => {
    /* The day a pair was made „se ne prikazuje nikome" (owner, 13.09.2026) and
       `/api/pairs` does not answer it, so a screen that drew it would print
       „Invalid Date" over every pair on the portal. Answered without it here, which
       the generated file cannot do because it still carries one. */
    /* A season that has not been run yet, read on a day inside the one before it: a
       pair of a season already over is history and this line does not draw one at all
       (`RacingPairLine`), so a pair of 2019 read on today's date would be measuring
       nothing. */
    const pairs = [{ id: 1, season: 2027, memberNumbers: [stillAMember, '000009'] }]
    const { stop } = answering(pairs, '/api/pairs')

    try {
      renderAt(`/sr/takmicar/${stillAMember}`, 'competitor', stillAMember, undefined, '2026-11-01')

      const said = await screen.findByText('Za sezonu 2027.')

      expect(said).toBeVisible()

      /* **ASKED AS A PROPERTY OF THE WHOLE LINE, not as a list of days to refuse.**
         Written as „it does not say 20. 11. 2026" the case passed while the line carried
         any OTHER day, which is what a portal reading a field the answer has not got
         would draw: `undefined` through a formatter is „Invalid Date", and `undefined`
         through none is nothing at all. So what is read is the line, whole, and what is
         refused is anything shaped like a day - digits with dots between them, which is
         how every date on this portal is written (`i18n/format.ts`, sr-Latn).

         The season is a number too, and it survives: it has no dots. */
      const line = must(said.closest('p'), 'the line the pair is said on').textContent ?? ''

      expect(line).toContain('Za sezonu 2027.')
      expect(line).not.toMatch(/\d{1,2}\.\s*\d{1,2}\./)
      expect(line).not.toContain('Invalid Date')
    } finally {
      stop()
    }
  })
})

/**
 * THE QUEUE AS `/api/verification` REALLY ANSWERS IT, out of the generated file.
 *
 * **Why this one had nothing and had to get something, which is measured and not
 * argued.** Every case that draws a moderation screen is answered out of
 * `public/mock/verification.json` by `test/setup.ts`, and that file carries all
 * SEVENTEEN names a card is drawn by. The answer carries twelve: the six that have no
 * home in the schema are filled in on this side (`pages/admin/pending.ts`), the key is a
 * number rather than text, and the member number may be nothing at all. So no case on the
 * portal had ever walked a queue screen through the world the server really makes, and it
 * showed: `pages/admin/pending.ts` put back to the day before this increment left all 944
 * cases green and `npm run build` at nought, although it is the whole of the half that
 * makes the answer readable.
 *
 * **Reduced by the KEYS of the record the server declares and never by a list of names
 * to take away** (`test/theAnswer.ts`), which is the same floor `membersTheServerAnswers`
 * stands on above and for the same reason: a list written here is a second home for the
 * shape, and it is the home that goes short.
 *
 * **What it claims, said exactly, because it is not everything.** The set of field NAMES
 * a row carries, and the two whose SORT differs. The VALUES beside them are the file's:
 * where the server's value differs by tab - the town it answers on two tabs and not on
 * six, the key of the team a change is about - that is measured on the side that decides
 * it (`VerificationApiTest`), and saying it twice would be two homes for one fact.
 */
function queueAsServed(): Record<string, unknown>[] {
  const file: Record<string, unknown>[] = JSON.parse(
    readFileSync(join(process.cwd(), 'public/mock/verification.json'), 'utf-8'),
  )

  return file.map((row, nth) => ({
    ...asAnswered(row, aWaitingItem),
    /* `verification.id` is a `bigserial` and the file's are text slugs, which is the
       first of the two differences of sort the portal's own type writes out. */
    id: nth + 1,
    /* And the second: the server answers nothing where there is no member number to
       give, and the file spells the same state as an empty string. */
    memberNumber: row.memberNumber === '' ? null : row.memberNumber,
    /* The key of the row in `photo`, which the portal does not read and the answer
       carries. Nothing here, because ADL A60 keeps a picture that is waiting for a
       decision out of every address the portal could ask for it at. */
    photoId: null,
  }))
}

/** One card off a queue screen, by something only that card says. */
function cardSaying(waiting: HTMLElement, said: string): HTMLElement {
  return must(
    within(waiting)
      .getAllByRole('listitem')
      .find((one) => (one.textContent ?? '').includes(said)),
    `the card that says ${said}`,
  )
}

describe('a queue of things waiting, on the answer the server gives', () => {
  /* **THE FLOOR UNDER THE ANSWER THE CASES BELOW ARE FED, and it is the one this
     resource never had.** `servedShape.test.ts` holds the declared record against the
     generated file and prints the six the server has nowhere to read; this holds what
     really goes to a screen against that same record. Written as a comparison of the two
     key sets rather than as six names, so a seventh name leaving the answer - or one of
     the six quietly coming back - is red here on the day it happens. */
  it('carries the names the queue item declares, and not one more', () => {
    const served = must(queueAsServed()[0], 'a first item of the answer')

    expect(Object.keys(served).sort()).toEqual(Object.keys(aWaitingItem).sort())
  })

  it('draws no frame where the answer carries no picture', async () => {
    /* **`ABSENT.picture` is the empty string and its own docstring calls that the one
       that matters**, because the card asks `one.picture !== ''` before it draws a
       frame. Nothing measured it: every row of the generated file carries `picture: ""`
       of its own, so the fill-in had nothing to do and `ABSENT.picture` could be set to
       any file name at all with the whole package green. Here the name does not arrive,
       so this side is the only thing deciding, and a frame drawn around nothing is a
       moderator looking at a broken image instead of at what he is judging. */
    const { stop } = answering(queueAsServed(), '/api/verification')

    try {
      renderAt('/sr/administracija/verifikacija/trkacki-profil', 'superadmin')

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const card = cardSaying(waiting, 'profilna-sa-maratona.jpg')

      /* The file name is what a moderator reads and it is still there, so „nothing is
         drawn" cannot pass for „the card is not on the screen". */
      expect(within(card).getByText('profilna-sa-maratona.jpg')).toBeVisible()
      expect(
        within(card).queryByRole('img', { name: /Slika koju je poslao/ }),
      ).not.toBeInTheDocument()
    } finally {
      stop()
    }
  })

  it('refuses to hand back a reported change nobody sent, and says why on the card', async () => {
    /* **THE ROW THE COMMENT OVER `canSendBack` HAS BEEN WAITING FOR.** It says: „Every
       picture in the data carries a number today, which is exactly the kind of safety
       that lasts until the backend hands over the first row that does not." The server
       answers a member number as nothing - `verification.competitor_id` is nullable by
       V9's decision, and since V16 somebody who registered and has not paid has no
       number - and `canSendBack` asks `item.memberNumber !== ''`, which a null PASSES.

       What is on the other side of that door is not a blank name on a card: an empty
       recipient in this portal is the WHOLE LEAGUE (`session/context.ts`, `Message.to`),
       so a refusal built from this item would be addressed to nothing and reach nobody,
       one instruction away from reaching everybody. A change of term may be reported by
       somebody with no account at all (PDL P10), so this is an ordinary row and not a
       broken one. */
    const { stop } = answering(queueAsServed(), '/api/verification')

    try {
      renderAt('/sr/administracija/verifikacija/termini', 'superadmin')

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const fromNobody = cardSaying(waiting, 'Pisao sam organizatoru')

      expect(within(fromNobody).getByText(/nema člana kome bi odgovor stigao/)).toBeVisible()
      expect(within(fromNobody).queryByRole('button', { name: 'Odbij' })).not.toBeInTheDocument()

      /* **And the card beside it, which is what makes this about the ROW rather than
         about the tab.** Written without it, a portal that had stopped offering the way
         back on the whole of this queue would read exactly like a portal that reads the
         member number. */
      const fromAMember = cardSaying(waiting, 'Borivoje Jovanović')

      expect(within(fromAMember).getByRole('button', { name: 'Odbij' })).toBeVisible()
    } finally {
      stop()
    }
  })

  it('leaves a registration without an address rather than inventing one', async () => {
    /* **THE ADDRESS IS THE ONE OF THE SIX THAT IS NOT A MISSING COLUMN**: `account.email`
       exists and is reachable through `account.competitor_id`, so what the payments tab
       may say about it is a decision and it is the owner's (`PENDING.md`). Until he takes
       it the card has to be plainly without one, which is a different thing from a card
       with a plausible address on it that belongs to nobody: a moderator activates a
       membership by reading exactly that line (PDL P8).

       Asked as „nothing on this row is an address" rather than as a list of addresses to
       refuse, because the question is about the shape and not about a value. Every
       address has the sign in it and nothing else on this row does. */
    const { stop } = answering(queueAsServed(), '/api/verification')

    try {
      renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

      const table = await screen.findByRole('table', { name: /Uplate/ })
      const row = must(
        within(table)
          .getAllByRole('row')
          .find((one) => (one.textContent ?? '').includes('Miodrag Stanković')),
        'the registration waiting for its fee',
      )

      expect(row.textContent ?? '').not.toContain('@')

      /* **And the town beside it IS drawn, which is the other half of this round.** The
         query read `team_proposal` alone, so this column was empty on every row while
         `competitor` carried the columns to fill it (V7). Read here off what the answer
         carries, and off the schema on the side that decides it
         (`VerificationApiTest.aRegistrationAnswersWithTheTownItsSenderLivesIn...`). */
      expect(within(row).getByText('Kraljevo')).toBeVisible()
    } finally {
      stop()
    }
  })

  it('says a waiting comment carries no marks rather than showing nought out of five', async () => {
    /* **The three marks of a comment are columns of `event_comment`, and that is a
       comment ALREADY PUBLISHED**; one waiting for a moderator is a row in
       `verification`, which has no column for a mark and no pointer to one. So they
       arrive as the portal's own „nobody has marked this" - `NO_RATING` - and the card
       has to say so in the same words the event page uses, because two screens showing
       one record must not answer „Bez ocene" and „0,0" to the same question.

       Filled in with any real mark instead, a moderator would be shown a rating the
       member never gave, on the tab where he decides whether it goes out. */
    const { stop } = answering(queueAsServed(), '/api/verification')

    try {
      renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const card = cardSaying(waiting, 'Trčao sam ovo tri godine zaredom')

      expect(within(card).getByText('Bez ocene')).toBeVisible()
    } finally {
      stop()
    }
  })

  it('names the two days it has not got rather than drawing empty ones', async () => {
    /* **THE BOUNDARY MEASURED RATHER THAN DESCRIBED, and it is in `PENDING.md` with the
       table that lacks the column.** `verification` has no pointer to `btl_event` and no
       column for either day: V9 keeps the day asked for as free TEXT inside `body`. So a
       reported change of term arrives with both dates empty, and `datesOf`
       (`pages/admin/PendingQueue.tsx`) drops an empty one rather than printing a blank
       label - which is the difference between a moderator seeing nothing and a moderator
       seeing „Prijavljen datum:" with nothing after it.

       **What it costs is an action and not a gap**, and that is why this is a case: the
       screen moves the event only where there is a day to move it to, so approving a
       report on this tab moves nothing at all. The day the owner decides on the pointer,
       this case is what has to change. */
    const { stop } = answering(queueAsServed(), '/api/verification')

    try {
      renderAt('/sr/administracija/verifikacija/termini', 'superadmin')

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const card = cardSaying(waiting, 'Pisao sam organizatoru')

      /* What the member wrote is there, which is the one thing about this report the
         schema really holds. */
      expect(within(card).getByText(/potvrdio mi je nov datum mejlom/)).toBeVisible()
      expect(within(card).queryByText('Prijavljen datum')).not.toBeInTheDocument()
      expect(within(card).queryByText('Datum u kalendaru')).not.toBeInTheDocument()
    } finally {
      stop()
    }
  })
})

/** Every team as a signed in MEMBER is answered one: no seat at all, and a yes or a
 *  no about his own. Built out of the generated file rather than written here, so the
 *  rosters and the seats stay the portal's own. */
function teamsAsAMemberIsAnswered(reader: string): Record<string, unknown>[] {
  const file: Record<string, unknown>[] = JSON.parse(
    readFileSync(join(process.cwd(), 'public/mock/teams.json'), 'utf-8'),
  )

  return file.map(({ organizerMemberNumber: seat, ...rest }) => ({
    ...rest,
    foundedByMe: seat === reader,
  }))
}

describe('the controls of a team, on the answer a member is given', () => {
  it('refuses the edit screen to a member who founded nothing', async () => {
    /* **MEASURED ON THE PORTAL'S OWN DATA, AND THIS IS THE HOLE THIS ROUND CLOSED.**
       One team's seat names a member who joined it later than another member did. Read
       through „who administers this team, compared with me", the second member was
       handed the whole edit screen - and with it the way to change the team, to delete
       it, and to decide who joins - because a member is not told who sits in the seat
       and the comparison fell through to „whoever has been here longest".

       The answer here is the one a member really gets: no seat on any team, and
       `foundedByMe` false on all of them. */
    const { stop } = answering(teamsAsAMemberIsAnswered('000011'), '/api/teams')

    try {
      const { router } = renderAt('/sr/tim/nisavski-maraton-klub/izmena', 'competitor', '000011')

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/sr')
      })

      expect(screen.queryByRole('heading', { name: 'Izmena tima' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Pošalji izmenu/ })).not.toBeInTheDocument()
    } finally {
      stop()
    }
  })

  it('opens it for the member whose seat it is, so the refusal is not of everybody', async () => {
    /* The other side of the same answer, and the reason the case above says something:
       `foundedByMe` true opens the screen. Without this, „nobody may edit" would read
       exactly like „the guard is right". */
    const { stop } = answering(teamsAsAMemberIsAnswered('000005'), '/api/teams')

    try {
      renderAt('/sr/tim/nisavski-maraton-klub/izmena', 'competitor', '000005')

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Izmena tima' }),
      ).toBeVisible()
    } finally {
      stop()
    }
  })
})

describe('who administers a team, on the answer a member is given', () => {
  /* A member is never told who sits in a team's seat: the number leaves to the
     administration alone, and what a member gets instead is whether the seat is his
     (`TeamApi`, P-javno 13.09.2026). These are asked of `teamAdminOf` directly rather
     than through a screen, because what is being measured is which FIELD the answer
     is read off, and the two fields never arrive together. */
  const team = (fields: Partial<Team>): Team => ({
    id: 1,
    slug: 'dunav',
    name: 'Dunav',
    city: 'Novi Sad',
    country: 'RS',
    bio: '',
    logo: null,
    crop: null,
    ...fields,
  })

  const member = (memberNumber: string, teamSince: number): Competitor => ({
    memberNumber,
    firstName: 'Ime',
    lastName: 'Prezime',
    gender: 'M',
    city: 'Novi Sad',
    country: 'RS',
    ageBand: '25-39',
    firstSeason2027: false,
    firstSeason: 2019,
    teamId: 1,
    teamSince,
    profileHidden: false,
    birthdayShown: 'none',
    bio: '',
  })

  it('is the founder, read off foundedByMe where no seat is answered', () => {
    /* The founder is NOT the longest-serving member here, which is what makes this
       case about the field rather than about the fallback: read off
       `organizerMemberNumber`, which this answer has not got, the standing rule would
       hand the team to 000002. */
    expect(
      readerAdministers(
        team({ foundedByMe: true }),
        [member('000001', 2019), member('000002', 2017)],
        '000001',
      ),
    ).toBe(true)
  })

  it('is not the reader where the answer says they founded nothing', () => {
    /* False and absent are two sentences and this is the first: somebody is asking,
       and the seat is not theirs. */
    expect(
      readerAdministers(
        team({ foundedByMe: false }),
        [member('000001', 2019), member('000002', 2017)],
        '000001',
      ),
    ).toBe(false)
  })

  it('is STILL not the reader where the standing rule would have taken them', () => {
    /* **THE OTHER STATE OF THE SAME AXIS, AND THE ONE THIS WAS WRONG ABOUT UNTIL
       21.09.2026.** The case above is a setup where the standing rule refuses the
       reader anyway, so it passed with the hole wide open. Here the reader IS the
       longest-serving member, so the old reading - the seat the member is not told
       about, falling through to that rule - handed him the team, its deletion and its
       applications. `false` is a definite no: it does not say whether the seat is
       empty, and the rule may not be reached for it. */
    expect(
      readerAdministers(
        team({ foundedByMe: false }),
        [member('000001', 2017), member('000002', 2019)],
        '000001',
      ),
    ).toBe(false)
  })

  it('is not the reader whose seat it is once they have left the team', () => {
    /* `foundedByMe` compares the seat with the caller and says nothing about the
       roster, so the half of the rule it cannot carry is asked here: a moderator
       moving the founder to another team empties the seat without touching the
       field. */
    expect(
      readerAdministers(
        team({ foundedByMe: true }),
        [{ ...member('000001', 2019), teamId: 2 }, member('000002', 2017)],
        '000001',
      ),
    ).toBe(false)
  })

  it('is nobody at all where nobody is asking', () => {
    /* A visitor is answered neither field and draws no control this decides. */
    expect(
      readerAdministers(team({}), [member('000001', 2019)], null),
    ).toBe(false)
  })

  it('reads the seat itself where the administration is the one asking', () => {
    /* The other half of the same function, and the reason it takes both: the
       administration is answered the number and no `foundedByMe` at all, and it may
       ask about anybody rather than only about itself. */
    expect(
      teamAdminOf(team({ organizerMemberNumber: '000001' }), [
        member('000001', 2019),
        member('000002', 2017),
      ]),
    ).toBe('000001')
  })

  it('answers the standing rule for a seat nobody holds', () => {
    /* The empty string is „nobody holds this seat" and is the administration's
       answer for a team whose founder has gone (`TeamApi`, four states). It matches
       no member number, so the rule below it answers, and this is the state the
       whole fallback exists for. */
    expect(
      teamAdminOf(team({ organizerMemberNumber: '' }), [
        member('000001', 2019),
        member('000002', 2017),
      ]),
    ).toBe('000002')
  })

  it('answers the standing rule for a seat held by somebody with no number', () => {
    /* JSON null is the fourth state: somebody holds it and there is no member number
       to give. A row in `competitor` may have none since V16, and nothing keeps such
       a row out of a seat. */
    expect(
      teamAdminOf(team({ organizerMemberNumber: null }), [
        member('000001', 2019),
        member('000002', 2017),
      ]),
    ).toBe('000002')
  })
})
