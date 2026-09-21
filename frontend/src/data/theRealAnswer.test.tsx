import { screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { teamAdminOf } from './teamAdmin'
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
 * Both halves of what the route does, and neither is a tidy-up: the rows whose fee
 * has lapsed are gone, and the flag that said which those were is gone with them.
 * Leaving the flag on would let a screen go on reading it while this file claimed
 * to be measuring the switch.
 */
function membersTheServerAnswers(): Record<string, unknown>[] {
  return generated
    .filter((one) => one.active === true)
    .map(({ active: _flag, referredBy: _key, ...rest }) => rest)
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
      teamAdminOf(
        team({ foundedByMe: true }),
        [member('000001', 2019), member('000002', 2017)],
        '000001',
      ),
    ).toBe('000001')
  })

  it('is not the reader where the answer says they founded nothing', () => {
    /* False and absent are two sentences and this is the first: somebody is asking,
       and the seat is not theirs. The standing rule answers, which is the longest
       serving member, and that is somebody else. */
    expect(
      teamAdminOf(
        team({ foundedByMe: false }),
        [member('000001', 2019), member('000002', 2017)],
        '000001',
      ),
    ).toBe('000002')
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
