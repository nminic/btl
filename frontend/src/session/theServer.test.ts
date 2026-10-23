import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ROLES, SIGNED_IN_ROLES } from '../roles/context'
import { must } from '../test/at'
import { serverThat, type Asked } from '../test/serverAnswers'
import { myOwnRecordFromMe } from '../test/theAnswer'
import {
  whatTheServerSaysOfMyData,
  whatTheServerSaysOfMyMailLanguage,
  whatTheServerSaysOfMyPictures,
  whatTheServerSaysOfMyProfile,
  whatTheServerSaysOfMyWaitingText,
  whatTheServerSaysOfTheSeasonsOpenForAReport,
  whoTheServerSaysIAm,
} from './theServer'

/**
 * WHAT THE PORTAL BELIEVES ABOUT THE ANSWER TO „WHO IS ASKING".
 *
 * <p>The two writes beside it are `askTheServer` doing what `askTheServer.test.ts`
 * already measures at length - the token, the header, the four shapes of an answer -
 * and are not measured again here. What is new is this one: a body off the wire being
 * narrowed into a role, and every way that can fail ending as „nobody" rather than as a
 * role the portal then draws the administration for.
 *
 * <p><b>Each case below is a shape a real thing answers with.</b> 401 is the chain when
 * nobody is signed in; 404 and HTML are a proxy or a dev server standing where the API
 * should be; a role the portal does not know is a server one release ahead; an account
 * that is not a number is the same. None of them is hypothetical, and every one of them
 * would be a role if this were written with an assertion (ADL A14).
 */

let server: { asked: Asked[]; stop: () => void } | null = null

afterEach(() => {
  server?.stop()
  server = null
})

/** An answer with a body of whatever text is given, said to be JSON. */
function saying(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } })
}

/** The generated members, as JSON rather than as the type: what a code looks like is read off what
 *  is really on the disc, which is also where the portal's own cases get their members. */
const GENERATED: Record<string, unknown>[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)

/** The referral code of every generated member, and nothing for one that carries none. */
const GENERATED_CODES = GENERATED.flatMap((one) => {
  const code = one.referralCode

  return typeof code === 'string' ? [code] : []
})

describe('who the server says I am', () => {
  it('is the role and the account it answered with', async () => {
    server = serverThat(() => saying(JSON.stringify({ role: 'superadmin', account: 41, membershipBasis: null })))

    expect(await whoTheServerSaysIAm()).toEqual({
      role: 'superadmin',
      account: 41,
      memberNumber: null,
      /* AND THE THREE P8a MOVED HERE ON 25.09.2026, null for the same reason: there is no
         record to read them off. Every one of them is on `/api/competitors` as well, which
         is what makes them different from the four around them, and none of the three is
         read off it by the screen that needs them - that list ends `where c.active` and so
         cannot answer the one member who opens that screen. */
      country: null,
      firstSeason: null,
      teamId: null,
      membershipBasis: null,
      membershipSeason: null,
      /* AND THE TWO P26a MOVED HERE ON 25.09.2026, null for the same reason the two above
         are: this answer carries no record at all, so nothing was said about any of them.
         An answer with no `member` key is an account that races for nobody, and a link for
         a man who does not run is a sentence nobody can finish. */
      referralCode: null,
      referredCount: null,
      /* AND THE TWO THE SESSION KEEPS ABOUT THE RECORD, since 11.10.2026: that there is none
         (an account that races for nobody has no `member` in its answer), and so that nothing
         was said about whether a fee stands. */
      hasARecord: false,
      feeStands: null,
    })
    expect(server.asked.map((one) => one.path)).toEqual(['/api/me'])
  })

  it('is nobody when the chain refuses, which is what nobody signed in looks like', async () => {
    server = serverThat(() => new Response(null, { status: 401 }))

    expect(await whoTheServerSaysIAm()).toBeNull()
  })

  it('is nobody when there is no server to reach at all', async () => {
    server = serverThat(() => {
      throw new Error('nema veze')
    })

    expect(await whoTheServerSaysIAm()).toBeNull()
  })

  it('is nobody when the answer is not JSON, which is what a proxy answers with', async () => {
    server = serverThat(() => saying('<!doctype html><title>ne ovo</title>'))

    expect(await whoTheServerSaysIAm()).toBeNull()
  })

  it('is nobody when the body is not an object', async () => {
    server = serverThat(() => saying('"superadmin"'))

    expect(await whoTheServerSaysIAm()).toBeNull()
  })

  it('is nobody when the body is null, which JSON.parse hands back as an object', async () => {
    /* Its own case and not a variation of the one above: `typeof null` is `"object"`,
       so a check written as `typeof body !== 'object'` alone lets null straight
       through and `Reflect.get(null, 'role')` throws where nothing catches. */
    server = serverThat(() => saying('null'))

    expect(await whoTheServerSaysIAm()).toBeNull()
  })

  it('is nobody when the answer says „visitor", which is the word for nobody', async () => {
    /* ITS OWN CASE AND NOT A VARIATION OF THE ONE BELOW, because „visitor" is a word the
       portal DOES know: it is one of the four `V5__role_and_admin_right.sql` inserts and
       one of the four in `ROLES`, and nothing in the schema stops an account's `role_id`
       from pointing at that row. Read through the four, it signed somebody in: measured
       20.09.2026, this answer drew the account menu and named them „Nalog 99", which is
       the header saying somebody is signed in while the word it was handed says the
       opposite. Read through the three a signed in answer may carry, it is nobody, which
       is what the word means everywhere else on the portal (`isMember`). */
    server = serverThat(() => saying(JSON.stringify({ role: 'visitor', account: 99 })))

    expect(await whoTheServerSaysIAm()).toBeNull()
  })

  it('is somebody for each of the three a signed in answer may carry', async () => {
    /* The other half of the same axis, and all three of it rather than one: read alone,
       the case above is satisfied by a portal that refuses every role there is. Derived
       from `SIGNED_IN_ROLES` rather than written out, so a fifth role decided tomorrow
       is measured here on the line it is decided. */
    for (const role of SIGNED_IN_ROLES) {
      server?.stop()
      server = serverThat(() => saying(JSON.stringify({ role, account: 41 })))

      expect(await whoTheServerSaysIAm(), role).toEqual({
        role,
        account: 41,
        memberNumber: null,
        country: null,
        firstSeason: null,
        teamId: null,
        membershipBasis: null,
        membershipSeason: null,
        referralCode: null,
        referredCount: null,
        hasARecord: false,
        feeStands: null,
      })
    }

    /* And there really were three. An empty list would make the loop above say nothing
       at all, quietly. */
    expect(SIGNED_IN_ROLES.length).toBe(ROLES.length - 1)
  })

  /* **HOW THE CALLER'S OWN MEMBERSHIP IS HELD, WHICH IS THE THIRD THING THIS ANSWER
     CARRIES SINCE 21.09.2026, and the axis has four states rather than two.** It is read
     here and nowhere else on the portal: `/api/competitors` decides that field by asking
     whether the CALLER is the administration rather than whether the row is his
     (`CompetitorApi`), so a member is not given it even about himself, and a screen that
     read it there asked a member freed of the fee to pay. */
  it.each([
    ['a member who pays', { member: { membershipBasis: 'payment' } }, 'payment'],
    ['a member the league has freed', { member: { membershipBasis: 'feeExempt' } }, 'feeExempt'],
    /* The third word, which the portal did not know until 18.10.2026 (PDL P8, „Član se aktivira
       na tri načina"), so a member let in on his balance was read as „I was not told". */
    ['a member let in on his balance', { member: { membershipBasis: 'balance' } }, 'balance'],
    /* An account that races for nobody: the record is ABSENT altogether rather than an
       object of nulls, which is what `MeApi.WhoIAm` says in as many words. */
    ['an account that races for nobody', {}, null],
    /* And a word the portal does not know, which is „I was not told" and never a third
       basis: the same shape the role above is read with (ADL A14, looked for and not
       asserted). */
    ['a word the portal does not know', { member: { membershipBasis: 'barter' } }, null],
  ])('says how the fee is held for %s', async (_what, extra, expected) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, ...extra })),
    )

    expect((await whoTheServerSaysIAm())?.membershipBasis).toBe(expected)
  })

  /* **AND THE SEASON THAT BASIS IS THE BASIS OF, since 18.10.2026** (PDL P8, „Osnov članstva ima
     jedan dom”): the season on sale, which the server answers exactly when he holds a membership
     of it. It is what „Moja članarina" turns the offer of a payment on, so a value of a sort the
     portal does not read is null and never a season he would be told he holds. Each state carries
     a basis beside it except the last, so the season is read off its own key and not off the
     basis. */
  it.each([
    ['a member who holds the season on sale', { member: { membershipBasis: 'payment', membershipSeason: 2028 } }, 2028],
    ['a member who holds none', { member: { membershipBasis: 'payment' } }, null],
    ['a season written as text', { member: { membershipBasis: 'feeExempt', membershipSeason: '2028' } }, null],
    ['a season that is not a whole number', { member: { membershipBasis: 'feeExempt', membershipSeason: 2027.5 } }, null],
    ['an account that races for nobody', {}, null],
  ])('says which season the basis is of for %s', async (_what, extra, expected) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, ...extra })),
    )

    expect((await whoTheServerSaysIAm())?.membershipSeason).toBe(expected)
  })

  /* **WHICH MEMBER OF THE LEAGUE THE CALLER IS, WHICH IS THE FOURTH THING THIS ANSWER
     CARRIES, SINCE 24.09.2026, and the axis has four states rather than two.** `MeApi`
     has sent it since 20.09.2026 and this file read past it, which cost the whole member
     area: `useMemberScreen` asks whether the session names a member, nothing else on the
     portal sets one, so eleven screens of a signed in member's own - his profile among
     them - answered „Ovaj deo je za takmicare". Owner, 24.09.2026: „Trenutno ne mogu cak
     ni svojim profilom da se igram, podesavam, prilozim slika."

     The four states are not one repeated. Two of them are ordinary answers a real server
     really sends, and the portal draws the same screen for both while telling only the
     first of them the truth (`pages/member/memberScreen.tsx` carries that boundary). */
  it.each([
    ['a member the league has given a number', { member: { memberNumber: '000012' } }, '000012'],
    /* An account that races for nobody: the record is ABSENT altogether, which is
       administration for good (PDL P21). */
    ['an account that races for nobody', {}, null],
    /* AND A RECORD WITH NO NUMBER IN IT, which is the state ADL A44 created and is the
       one a hasty reader turns into the member number `undefined`: „Osoba je `competitor`
       od registracije, a clan postaje kad dobije broj" (owner, 11.09.2026). */
    ['somebody registered who has no number yet', { member: { membershipBasis: 'payment' } }, null],
    /* And a number that is not a string, which is a server saying something this portal
       has no screen for: looked for and never asserted (ADL A14), exactly as the role and
       the basis above are. Believed, the session would name the member `[object Object]`
       and every screen would look him up and find nobody. */
    ['a number that is not one', { member: { memberNumber: { value: '000012' } } }, null],
  ])('says which member is asking for %s', async (_what, extra, expected) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, ...extra })),
    )

    expect((await whoTheServerSaysIAm())?.memberNumber).toBe(expected)
  })

  /* **THE CALLER'S OWN REFERRAL LINK, WHICH IS THE FIFTH THING THIS ANSWER CARRIES, SINCE
     25.09.2026, and the axis has more states than two.** It is read here and
     nowhere else on the portal now: it was answered on the caller's own row of
     `/api/competitors` from 20.09.2026 and „Moja članarina" read it off there, and the
     owner took it off that list (PDL P26a) because the list ends `where c.active` - so
     the member whose fee has LAPSED, the one V24 section 6 promises the link to on
     exactly that page, was answered nothing at all.

     **THE STATE THIS NOTE USED TO NAME AS NOT BEING HERE IS HERE SINCE 02.10.2026: a code of
     the wrong SHAPE** (PENDING 227, part b). It said that sixteen hexadecimal characters is
     `competitor_referral_code_shape`, kept where the code is stored, and that re-judging it
     here would be a second opinion about a rule this portal does not own, whose only
     possible outcome was refusing a member the link the server really gave him. That was an
     argument, and the worry in it is measured by the case after the table: it hands the
     reader every code of the generated members and wants each of them back as it was sent.
     What the argument left out is where the string goes next. The link is there so that a
     member copies it and sends it on (`member/Membership.tsx`), and a reader that handed ANY
     string to the address handed on whatever the answer carried.

     **It is asked of `REFERRAL_CODE` and of nothing written here**, so the wrong values after
     the table are KINDS, one dimension each, and not a list of what the portal refuses: what
     it believes is written once, on the constant, and `data/referralCodeShape.test.ts` holds
     that constant to the schema. A reader that asked about less than the shape - only the
     length, only the alphabet, only the beginning, only the end - is refused by some row. */
  it.each([
    ['a member with a link of his own', { member: { referralCode: '7f07b38ff7ee7543' } },
      '7f07b38ff7ee7543'],
    /* An account that races for nobody: the record is ABSENT altogether, so there is no
       link to answer and nobody to answer it to (PDL P21). */
    ['an account that races for nobody', {}, null],
    /* A record with no link in it, which is what a server one release BEHIND sends and
       what the harness sends for a person who has registered and has no number yet. */
    ['a record that carries no link', { member: { memberNumber: '000012' } }, null],
    /* And a link that is not a string, looked for and never asserted (ADL A14). Believed,
       the page would print `?preporuka=[object Object]`, which is a link a reader would
       copy and send on - the exact thing the empty string is drawn instead of. */
    ['a link that is not one', { member: { referralCode: { value: 'abc' } } }, null],
  ])('says the caller his own referral link for %s', async (_what, extra, expected) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, ...extra })),
    )

    expect((await whoTheServerSaysIAm())?.referralCode).toBe(expected)
  })

  /* **EVERY CODE A MEMBER REALLY HAS**, which is the worry the old note stood on asked as a
     question with an answer. The generated members are the ones the rest of the portal's cases
     are made of, so a code the reader refused here would be a link refused to somebody the
     whole suite already treats as a member. Believed one after another on the same reader,
     which is also what finds a constant that remembers where it last stopped. */
  it('says the referral link of every generated member, as it was sent', async () => {
    expect(GENERATED_CODES.length, 'the generated members').toBeGreaterThan(1)
    expect(GENERATED_CODES, 'a generated member with no code in it').toHaveLength(GENERATED.length)

    for (const code of GENERATED_CODES) {
      server?.stop()
      server = serverThat(() =>
        saying(JSON.stringify({ role: 'competitor', account: 41, member: { referralCode: code } })),
      )

      expect((await whoTheServerSaysIAm())?.referralCode, `the code ${code}`).toBe(code)
    }
  })

  /* **THE KINDS OF STRING NEAR THE SHAPE**, each one wrong in the one way its name says and
     right in every other, so that a reader asking about less than the whole shape lets one of
     them through. Written as the text the wire carries, and handed to the reader through the
     wire. A good code with something in front of it, behind it or a line break after it is
     what tells an anchor from no anchor; capitals and a letter past `f` are the alphabet; one
     short and one long are the length; and the five that put a character in the place of a
     letter are the ones an address writes differently from themselves, which is what the
     link would have carried. */
  it.each([
    ['a code one character short', '7f07b38ff7ee754'],
    ['a code one character long', '7f07b38ff7ee75430'],
    ['a code in capitals', '7F07B38FF7EE7543'],
    ['a code of the right length with a letter that is not hexadecimal', '7f07b38ff7ee754g'],
    ['a good code with a space in front of it', ' 7f07b38ff7ee7543'],
    ['a good code with a letter behind it', '7f07b38ff7ee7543x'],
    ['a good code with a line break behind it', '7f07b38ff7ee7543\n'],
    ['a code that is nothing at all', ''],
    ['a code with an ampersand in it', '7f07b38&f7ee7543'],
    ['a code with a hash in it', '7f07b38#f7ee7543'],
    ['a code with a percent sign in it', '7f07b38%f7ee7543'],
    ['a code with a space in it', '7f07b38 f7ee7543'],
    ['a code with a quotation mark in it', '7f07b38"f7ee7543'],
    ['markup where the code should be', '"><img src=x onerror=alert(1)>'],
    ['the member number where the code should be, which no link may ever carry', '000001'],
  ])('says no referral link for %s', async (_what, sent) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, member: { referralCode: sent } })),
    )

    expect((await whoTheServerSaysIAm())?.referralCode, JSON.stringify(sent)).toBeNull()
  })

  /* **AND HOW MANY HE BROUGHT IN WHOSE FEE IS STANDING, THE SIXTH, SINCE THE SAME DAY.**
     A COUNT and never the column it is counted from: `referred_by` holds the KEY of
     whoever brought a member (V7) and a key does not leave the server, so the query „nad
     svima, ne nad sobom" (PDL, 06.09.2026) happens where the data is.

     **NOUGHT IS A STATE OF ITS OWN HERE AND IT IS THE ONE THAT MATTERS.** „You brought in
     nobody" is an answer and „I was not told" is not, so a reader that turned the second
     into the first would promise a balance to somebody the answer never mentioned; and
     one that let nought fall through to null would tell a member with no referrals
     nothing, on the page that exists to tell him. */
  it.each([
    ['a member who brought four in', { member: { referredCount: 4 } }, 4],
    ['a member who brought nobody in', { member: { referredCount: 0 } }, 0],
    ['an account that races for nobody', {}, null],
    ['a record that carries no count', { member: { memberNumber: '000012' } }, null],
    /* A count that is not a number, and one that is a number and not a count. Both are a
       server saying something this portal has no screen for, and both would go into an
       arithmetic: the first multiplies a price by a string, the second by a fraction, and
       what comes out of either is money printed on a member's own page. */
    ['a count that is not a number', { member: { referredCount: '4' } }, null],
    ['a count that is not whole', { member: { referredCount: 2.5 } }, null],
    /* AND ONE THAT IS WHOLE AND STILL NOT A COUNT: nobody has brought in fewer than nobody.
       `Number.isInteger(-3)` is true, so a reader that asks only that hands it on, and the
       page then multiplies the price by it and prints „-1.800 RSD" as the balance of a member
       (PENDING 227). */
    ['a count below nought', { member: { referredCount: -3 } }, null],
  ])('says how many the caller brought in for %s', async (_what, extra, expected) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, ...extra })),
    )

    expect((await whoTheServerSaysIAm())?.referredCount).toBe(expected)
  })

  /* **WHERE THE CALLER LIVES, THE SEVENTH, SINCE 25.09.2026, AND IT IS THE FIRST FIELD
     ON THIS ANSWER THAT HAS A SECOND HOME.**

     The five above are read here because there is nowhere else to read them. This one is
     on `/api/competitors` too, on every row, and „Moja članarina" read it off there until
     today. It is read HERE because that list ends `where c.active`, so it answers
     everybody except the member whose fee has LAPSED - who is the man that screen exists
     for, since renewing is what he opens it to do (PDL P8a).

     **What it decides on that screen, which is why no reader here may fall back to
     anything:** the currency of every figure, whether a payment slip is drawn at all, and
     which ways of paying he is offered (PDL P8, owner 31.07.2026: „QR kod postoji samo za
     uplate iz Srbije"). A country guessed here is a member in North Macedonia handed a
     dinar slip.

     **A country in no shape this portal has met is believed as it was sent, and that is a
     boundary written out and not a ground borrowed from the code above**, which is asked
     what it looks like since 02.10.2026. The schema holds a shape for a country too
     (`country_code_shape`, V2: two capital letters), so the question could be asked here;
     what asking it would do is the reason it is not. Any other string is a member drawn in
     euros (`paysInDinars` is `=== 'RS'`), while a country refused here is „I was not told",
     and „Moja članarina" then draws the page that says the portal cannot read his record in
     place of his fee. Which of the two he should get is a question of that screen and is left
     as it was, so the row below holds it: it asks a reader that has begun to ask a shape
     of the code whether it has begun to ask one of the country as well. */
  it.each([
    ['a member who lives in Serbia', { member: { country: 'RS' } }, 'RS'],
    ['a member who lives abroad', { member: { country: 'MK' } }, 'MK'],
    ['a country in no shape this portal has met', { member: { country: 'Srbija' } }, 'Srbija'],
    /* An account that races for nobody: the record is ABSENT altogether (PDL P21). */
    ['an account that races for nobody', {}, null],
    ['a record that carries no country', { member: { memberNumber: '000012' } }, null],
    /* And a country that is not a string, looked for and never asserted (ADL A14).
       Believed, `paysInDinars` would answer false for it and the screen would quote euro
       to somebody who owes dinars. */
    ['a country that is not one', { member: { country: { code: 'RS' } } }, null],
  ])('says where the caller lives for %s', async (_what, extra, expected) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, ...extra })),
    )

    expect((await whoTheServerSaysIAm())?.country).toBe(expected)
  })

  /* **THE SEASON HE STARTED IN, THE EIGHTH, AND IT IS HERE FOR THE SAME REASON THE
     COUNTRY IS**: on the public list, and unreachable there by the one member who needs
     it.

     A WHOLE NUMBER and not merely a number, which is the shape the count above is read
     with and for the same measurement: a season that arrived as a string would go into
     „Član od {season}. sezone." as one, and neither a fraction nor a number below nought is a
     season. */
  it.each([
    ['a member who started in 2016', { member: { firstSeason: 2016 } }, 2016],
    ['an account that races for nobody', {}, null],
    ['a record that carries no season', { member: { memberNumber: '000012' } }, null],
    ['a season that is not a number', { member: { firstSeason: '2016' } }, null],
    ['a season that is not whole', { member: { firstSeason: 2016.5 } }, null],
    ['a season below nought', { member: { firstSeason: -2016 } }, null],
  ])('says which season the caller started in for %s', async (_what, extra, expected) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, ...extra })),
    )

    expect((await whoTheServerSaysIAm())?.firstSeason).toBe(expected)
  })

  /* **AND THE TEAM HE IS IN, THE NINTH, WHOSE NULL IS ORDINARY RATHER THAN „I WAS NOT
     TOLD" - which is what makes it unlike every other field on this answer.**

     `MeApi.MyOwnRecord` leaves the key out altogether for a member with no team
     (`@JsonInclude(NON_NULL)`), and sixteen of the thirty two members in the data are in
     none, so ABSENT is the common answer here and not a fault. Which means the two states
     this reader cannot separate - „no team" and „a team that is not a number" - are two
     states the screen draws alike anyway: „Trenutno nisi ni u jednom timu." That is a
     boundary and it is written down on the field itself rather than left to be found. */
  it.each([
    ['a member in a team', { member: { teamId: 3 } }, 3],
    ['an account that races for nobody', {}, null],
    ['a member in no team at all', { member: { memberNumber: '000012' } }, null],
    ['a team that is not a number', { member: { teamId: 'dunavski-trkaci' } }, null],
    ['a team below nought', { member: { teamId: -1 } }, null],
  ])('says which team the caller is in for %s', async (_what, extra, expected) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, ...extra })),
    )

    expect((await whoTheServerSaysIAm())?.teamId).toBe(expected)
  })

  /* **THE FLOOR UNDER THE WHOLE NUMBERS, AND IT IS ASKED OF EVERY ONE THERE IS.** The three tables above
     name wrong numbers one at a time, and a list of wrong numbers is exactly what stopped one step short:
     `-3` is a whole number, `Number.isInteger` says so, and it went on to be printed as „-1.800 RSD"
     (PENDING 227). So neither side of the question is a list written here. The KEYS are every one of the
     record the server declares whose value is a number (`test/theAnswer.ts`, which `data/contract.test.ts`
     holds to `MeApi.MyOwnRecord`), so a fourth number the server starts to declare is measured on the day it
     arrives, or fails here by name until this reader reads it. And the WRONG VALUES are kinds, written as
     the JSON the wire carries because `JSON.stringify` cannot say `1e999` and the wire can.

     What each key is asked is the same two things. A number the portal may believe comes back as it was
     sent, nought included, which is the whole difference between „you brought nobody in" and „I was not
     told". And every number it may not believe comes back as „I was not told". The set it believes is
     written once, on the reader: a whole number of nought or more.

     **Nought is believed for all four, and that is the boundary of one rule rather than a finding about
     each.** A team numbered nought cannot exist (`team.id` is a `bigserial`, V11), a season numbered
     nought is not a year and neither is the season he joined his team in, so for those three the floor
     is looser than it could be. That is written here and not mended, because a floor of its own per key
     would be four readers where `wholeIn` says there is one, and nothing in PENDING asks for it.

     **AND SINCE 10.10.2026 THE QUESTION IS ASKED OF BOTH READERS, because a key may be read by either.**
     The record the server declares has nineteen names and the portal has two readers of it:
     `whoTheServerSaysIAm` reads who he is, and `whatTheServerSaysOfMyProfile` reads the page his own
     profile is drawn from. They are two on purpose (the second is `null` for a page the portal cannot
     believe and the first never is, so a fault in his page cannot sign him out; the cases on that are
     below), and the one number the page reads that who-he-is does not is `teamSince`. A floor that asked
     only the first would demand that the session read it, which is the very thing the separation exists
     to refuse. So each key is asked of BOTH, with a whole page around it, and the question for it is
     WHICH READER HANDS IT BACK: a key that neither does fails here by name, which is the whole of what
     this floor is for and is unchanged, and whichever reader does is held to the same two things. Nothing
     is listed by hand: which reader reads which key is found out by asking. */
  const NUMBERS_THE_SERVER_DECLARES = Object.entries(myOwnRecordFromMe)
    .filter(([, value]) => typeof value === 'number')
    .map(([key]) => key)

  const NOT_BELIEVED: [kind: string, onTheWire: string][] = [
    ['a whole number below nought', '-3'],
    ['the first whole number below nought', '-1'],
    ['a fraction', '2.5'],
    ['a fraction below one', '0.5'],
    ['a number too large to be one', '1e999'],
    ['a number written as text', '"4"'],
    ['a truth', 'true'],
    ['nothing', 'null'],
    ['a list', '[4]'],
    ['an object', '{"value":4}'],
  ]

  const BELIEVED = ['0', '4', '2014']

  it('reads the numbers the server declares, and finds some', () => {
    /* An empty list would make both sweeps below say nothing at all, quietly. */
    expect(NUMBERS_THE_SERVER_DECLARES.length).toBeGreaterThanOrEqual(3)
  })

  /** What each of the two readers hands back for `key` when the member says `sent` there (the text the
   *  wire carries) and says everything else a page needs (`HIS_PAGE`, which is further down and is the
   *  page the second reader accepts). `undefined` is „this reader has no such name", which is how the
   *  floor finds out which reader reads which key. */
  async function whatTheReadersHandBack(
    key: string,
    sent: string,
  ): Promise<{ whoHeIs: unknown; hisPage: unknown }> {
    const THE_VALUE = 'THE_VALUE_THIS_CASE_SENDS'
    const member = JSON.stringify({ ...HIS_PAGE, [key]: THE_VALUE }).replace(
      JSON.stringify(THE_VALUE),
      () => sent,
    )

    server?.stop()
    server = serverThat(() => saying(`{"role":"competitor","account":41,"member":${member}}`))

    const who = must(await whoTheServerSaysIAm(), 'an answer that names a member')
    const page = await whatTheServerSaysOfMyProfile()

    return {
      whoHeIs: Reflect.has(who, key) ? Reflect.get(who, key) : undefined,
      hisPage: page !== null && Reflect.has(page, key) ? Reflect.get(page, key) : undefined,
    }
  }

  it.each(NUMBERS_THE_SERVER_DECLARES)('is read by some reader, and believed as a whole number of nought or more, for %s', async (key) => {
    for (const sent of BELIEVED) {
      const { whoHeIs, hisPage } = await whatTheReadersHandBack(key, sent)

      expect(
        whoHeIs !== undefined || hisPage !== undefined,
        `${key} sent as ${sent}: neither reader hands it back, so the portal never reads it`,
      ).toBe(true)

      for (const handedBack of [whoHeIs, hisPage].filter((one) => one !== undefined)) {
        expect(handedBack, `${key} sent as ${sent}`).toBe(Number(sent))
      }
    }
  })

  it.each(NUMBERS_THE_SERVER_DECLARES)('is believed as nothing else by either reader for %s', async (key) => {
    for (const [kind, sent] of NOT_BELIEVED) {
      const { whoHeIs, hisPage } = await whatTheReadersHandBack(key, sent)

      for (const handedBack of [whoHeIs, hisPage].filter((one) => one !== undefined)) {
        expect(handedBack, `${key} sent as ${kind}: ${sent}`).toBeNull()
      }
    }
  })

  it('is nobody when the role is not one the portal knows at all', async () => {
    /* A server one release ahead. Believed, this would be a word handed to
       `navForRole` and to the rights table, both of which answer „not staff" and
       neither of which was asked about this. */
    server = serverThat(() => saying(JSON.stringify({ role: 'organiser', account: 41 })))

    expect(await whoTheServerSaysIAm()).toBeNull()
  })

  it('is nobody when the account is not a number', async () => {
    server = serverThat(() => saying(JSON.stringify({ role: 'competitor', account: '41' })))

    expect(await whoTheServerSaysIAm()).toBeNull()
  })

  /* **WHETHER THERE IS A RECORD AT ALL, WHICH IS THE SIXTH THING THIS ANSWER CARRIES, SINCE
     11.10.2026, and it is not what the member number says.** Until that day „no number" was one
     state and the portal drew one sentence for it. It is two: an account that races for nobody
     (no `member` in the answer) and somebody who registered and has not paid (the `member` is
     there and the number inside it is not, ADL A44). The second may pay, choose his category
     and change his password and his data (PDL P8, „Šta sme neplaćen član", 10.10.2026), so the
     portal has to be able to tell him from the first.

     **The record is the PRESENCE OF THE OBJECT and nothing inside it**: the poorest record a
     server could send is a bare `{}`, and it is still a record. A reader that asked for a field
     would read an almost empty one as no record at all and send its owner to the sentence for a
     moderator. */
  it.each([
    ['a member the league has given a number', { member: { memberNumber: '000012' } }, true],
    ['somebody who registered and has no number yet', { member: { membershipBasis: 'payment' } }, true],
    ['the poorest record there is, an empty one', { member: {} }, true],
    /* An account that races for nobody: the key is ABSENT altogether (`MeApi.WhoIAm`, „Absent
       rather than null, and rather than an object of nulls"). */
    ['an account that races for nobody', {}, false],
    /* And a `member` that is not an object: a server saying something this portal has no
       screen for is not a record, and ends as no record rather than as one with nothing in it
       (ADL A14, looked for and never asserted). */
    ['a record that is null', { member: null }, false],
    ['a record that is a word', { member: 'x' }, false],
  ])('says whether there is a record at all for %s', async (_what, extra, expected) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, ...extra })),
    )

    expect((await whoTheServerSaysIAm())?.hasARecord).toBe(expected)
  })

  /* **WHETHER HIS FEE STANDS, WHICH IS THE SEVENTH, and the axis has more states than two.**
     `MeApi.MyOwnRecord.active` is `competitor.active`, and until 11.10.2026 the answer did not say:
     a member whose fee has lapsed was answered the same names as one whose fee stands, so the
     portal drew him every screen of a member whose fee stands (measured against a real database
     that day, `MeApiTest`). The server refuses him 404 on two of his forms (PDL P8, the addition
     of 11.10.2026), so this is what lets a screen not offer a form that fails every time.

     **Null for four things, and none of them is a plain no**: no record at all, a record that does
     not carry the key (a server one release behind), and a value that merely reads as a yes or a no.
     The session turns a null into „stands", because the flag is only ever acted on to take something
     AWAY from a member and a word the portal was not told is a word it may not act on. */
  it.each([
    ['a member whose fee stands', { member: { memberNumber: '000012', active: true } }, true],
    ['a member whose fee has lapsed', { member: { memberNumber: '000031', active: false } }, false],
    /* Somebody who never paid is `false` as well, and that is exactly why the portal does NOT
       decide „has not paid" by this flag: a lapsed member is a plain no too, and only the number
       parts them (`SessionProvider`, `signedIn`). */
    ['somebody who registered and has not paid', { member: { active: false } }, false],
    ['an account that races for nobody', {}, null],
    ['a record that does not carry it', { member: { memberNumber: '000012' } }, null],
    ['a word that reads as a yes', { member: { memberNumber: '000012', active: 'true' } }, null],
    ['a word that reads as a no', { member: { memberNumber: '000012', active: 'false' } }, null],
    ['a number for a yes', { member: { memberNumber: '000012', active: 1 } }, null],
    ['a number for a no', { member: { memberNumber: '000012', active: 0 } }, null],
    ['a null', { member: { memberNumber: '000012', active: null } }, null],
  ])('says whether the fee stands for %s', async (_what, extra, expected) => {
    server?.stop()
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, ...extra })),
    )

    expect((await whoTheServerSaysIAm())?.feeStands).toBe(expected)
  })
})

/**
 * THE PAGE OF THE CALLER HIMSELF: the record his own profile is drawn from, read APART from who
 * he is.
 *
 * <p>PDL P8, 25.09.2026, „Treba da moze da otvori svoj profil dokle god postoji". A member whose
 * fee has lapsed is on no row of the public list, and `MeApi.MyOwnRecord` is where his name, his
 * town, his category, his biography and his portrait reach the screen.
 *
 * <p><b>The sample is the lapsed member the generated data has</b> (000032, `test/mock/
 * competitors.json`) in the names the server answers, and it is written out here and not read off
 * the disc: this file measures what a body is BELIEVED as, and a sample that came off the same
 * file the screens are drawn from would agree with them however wrong both were. He is in no team
 * and has no portrait, which is the common answer, so the two pairs that may honestly be absent
 * are absent in it.
 */
const HIS_PAGE: Record<string, unknown> = {
  memberNumber: '000032',
  country: 'RS',
  firstSeason: 2016,
  membershipBasis: 'payment',
  /* HIS FEE HAS LAPSED, which is what he is in the generated data and the reason the page is read
     apart from who he is. Not a fact about his PAGE (it is left out of `WHAT_A_PAGE_NEEDS`). */
  active: false,
  referralCode: 'a92a9c8493cecc3e',
  referredCount: 0,
  firstName: 'Vojislav',
  lastName: 'Antonijević',
  gender: 'M',
  city: 'Zaječar',
  ageBand: '40-54',
  firstSeason2027: false,
  bio: '',
  profileHidden: false,
  birthdayShown: 'none',
  /* HIS POSTAL ADDRESS, which is his alone (`MeApi.MyOwnRecord`, since 18.10.2026) and is NOT a fact
     about his PAGE: a profile neither needs it nor may carry it (it is left out of
     `WHAT_A_PAGE_NEEDS`, and `the page of the caller himself` asks that it is not in the page). The
     sample has no telephone, which is how the server says a member has none. */
  address: 'Mihajla Pupina 10',
}

/** What the answer is when somebody signed in with a member behind the account says this. */
function aMemberSaying(member: Record<string, unknown>): string {
  return JSON.stringify({ role: 'competitor', account: 41, member })
}

/**
 * THE FACTS A PAGE CANNOT BE DRAWN WITHOUT, which are the sample's keys less the four that are
 * about his fee and not about his page (the basis he pays on, whether it stands, his referral code
 * and his count) and the one that is about neither: his postal address, which is his own to read on
 * his data screen and no part of a profile.
 * Derived from the sample, so a fact added to it tomorrow is measured here on the day it arrives.
 */
const WHAT_A_PAGE_NEEDS = Object.keys(HIS_PAGE).filter(
  (key) => !['membershipBasis', 'active', 'referralCode', 'referredCount', 'address'].includes(key),
)

/** The three of those that are ALSO who he is, and so are read by the session as well. */
const WHAT_HE_IS = ['memberNumber', 'country', 'firstSeason']

/** A value of the wrong kind for each fact, and for each of them a kind the server could send. */
const NOT_BELIEVED_AS_A_PAGE: [key: string, sent: unknown][] = [
  ['memberNumber', 7],
  ['country', 7],
  ['firstSeason', -1],
  ['firstSeason', 2016.5],
  ['firstSeason', '2016'],
  ['firstName', ''],
  ['firstName', '   '],
  ['firstName', 7],
  ['lastName', ''],
  ['lastName', null],
  ['gender', 'X'],
  ['gender', 'f'],
  ['gender', 1],
  ['city', ''],
  ['city', 7],
  ['ageBand', '99+'],
  ['ageBand', '25–39'],
  ['ageBand', 7],
  ['firstSeason2027', 'false'],
  ['firstSeason2027', 0],
  ['bio', 7],
  ['bio', null],
  ['profileHidden', 'true'],
  ['profileHidden', 1],
  ['birthdayShown', 'date'],
  ['birthdayShown', 3],
]

describe('the page of the caller himself', () => {
  it('is the record the public list would have given him, under the names it gives them', async () => {
    server = serverThat(() => saying(aMemberSaying(HIS_PAGE)))

    expect(await whatTheServerSaysOfMyProfile()).toEqual({
      memberNumber: '000032',
      firstName: 'Vojislav',
      lastName: 'Antonijević',
      gender: 'M',
      city: 'Zaječar',
      country: 'RS',
      ageBand: '40-54',
      firstSeason2027: false,
      firstSeason: 2016,
      profileHidden: false,
      birthdayShown: 'none',
      /* The two pairs that may honestly be absent are null on the record, which is how the public
         list says it as well, and not absent: a record is read by one reader on this portal. */
      teamId: null,
      teamSince: null,
      bio: '',
      photo: null,
      crop: null,
      smallPhoto: null,
    })
    expect(server.asked.map((one) => one.path)).toEqual(['/api/me'])
  })

  it('carries the club and its year, and the portrait and its square, when the answer has them', async () => {
    server = serverThat(() =>
      saying(
        aMemberSaying({
          ...HIS_PAGE,
          teamId: 3,
          teamSince: 2018,
          bio: 'Trci i piše.',
          profileHidden: true,
          birthdayShown: 'full',
          photo: '/api/photos/3c9e5f41',
          crop: { x: 0.125, y: 0.25, size: 0.5 },
          smallPhoto: '/api/photos/3c9e5f41/small/0.12500000-0.25000000-0.50000000',
        }),
      ),
    )

    expect(await whatTheServerSaysOfMyProfile()).toMatchObject({
      teamId: 3,
      teamSince: 2018,
      bio: 'Trci i piše.',
      profileHidden: true,
      birthdayShown: 'full',
      photo: '/api/photos/3c9e5f41',
      crop: { x: 0.125, y: 0.25, size: 0.5 },
      smallPhoto: '/api/photos/3c9e5f41/small/0.12500000-0.25000000-0.50000000',
    })
  })

  it('takes the small portrait only under the portal’s own address and only beside the picture it was cut from', async () => {
    /* The third half of the portrait (PDL, 23.10.2026, „umanjenu, već isečenu sliku za
       kružiće"). It goes into an `img` like `photo`, so it is believed under `/api/photos/` and
       nowhere else; and it is nothing without the picture and square it was cut from, so a
       record that lost those does not keep a circle of them. */
    const small = '/api/photos/3c9e5f41/small/0.12500000-0.25000000-0.50000000'
    const withAPortrait = { ...HIS_PAGE, photo: '/api/photos/3c9e5f41', crop: { x: 0.125, y: 0.25, size: 0.5 } }

    for (const [said, kept] of [
      [{ ...withAPortrait, smallPhoto: small }, small],
      [{ ...withAPortrait, smallPhoto: 'https://elsewhere.example/a.jpg' }, null],
      [{ ...withAPortrait }, null],
      [{ ...withAPortrait, photo: null, smallPhoto: small }, null],
      [{ ...withAPortrait, crop: null, smallPhoto: small }, null],
    ] as const) {
      server = serverThat(() => saying(aMemberSaying(said)))

      expect((await whatTheServerSaysOfMyProfile())?.smallPhoto, JSON.stringify(said)).toBe(kept)
    }
  })

  it('reads the facts a page needs off the sample, and finds some', () => {
    /* An empty list would make both sweeps below say nothing at all, quietly. */
    expect(WHAT_A_PAGE_NEEDS.length).toBeGreaterThanOrEqual(12)
    expect(WHAT_A_PAGE_NEEDS).toContain('gender')
    expect(WHAT_A_PAGE_NEEDS).not.toContain('referralCode')
  })

  it.each(WHAT_A_PAGE_NEEDS)('is nothing at all without %s, which no page can be drawn without', async (key) => {
    const { [key]: _left, ...without } = HIS_PAGE

    server = serverThat(() => saying(aMemberSaying(without)))

    expect(await whatTheServerSaysOfMyProfile(), `${key} left out`).toBeNull()
  })

  it.each(NOT_BELIEVED_AS_A_PAGE)('does not believe %s sent as %j', async (key, sent) => {
    server = serverThat(() => saying(aMemberSaying({ ...HIS_PAGE, [key]: sent })))

    expect(await whatTheServerSaysOfMyProfile()).toBeNull()
  })

  it.each([
    ['a club below nought', { teamId: -1, teamSince: 2018 }, { teamId: null, teamSince: 2018 }],
    ['a year that is not a number', { teamId: 3, teamSince: '2018' }, { teamId: 3, teamSince: null }],
    ['a fraction for a year', { teamId: 3, teamSince: 2018.5 }, { teamId: 3, teamSince: null }],
  ])('keeps the page when the club is %s, and says nothing of the part it cannot believe', async (_what, sent, expected) => {
    server = serverThat(() => saying(aMemberSaying({ ...HIS_PAGE, ...sent })))

    expect(await whatTheServerSaysOfMyProfile()).toMatchObject(expected)
  })

  /* **THE PORTRAIT IS DECORATION, SO IT NEVER COSTS A MEMBER HIS PAGE** - the opposite of the facts
     above. It and its square travel together, here as on the server (`CompetitorApi` reads both off
     one joined row): one without the other is read as no portrait, which draws the monogram. */
  it.each([
    ['an address that is not under the portal\'s own pictures', { photo: 'https://elsewhere.example/x.png', crop: { x: 0, y: 0, size: 1 } }],
    ['a picture with no square', { photo: '/api/photos/3c9e5f41' }],
    ['a square with no picture', { crop: { x: 0, y: 0, size: 1 } }],
    ['a picture and a square that is not an object', { photo: '/api/photos/3c9e5f41', crop: 'whole' }],
    ['a picture and a square that is null', { photo: '/api/photos/3c9e5f41', crop: null }],
    ['a picture and a square missing its left edge', { photo: '/api/photos/3c9e5f41', crop: { y: 0, size: 1 } }],
    ['a picture and a square missing its top edge', { photo: '/api/photos/3c9e5f41', crop: { x: 0, size: 1 } }],
    ['a picture and a square missing its size', { photo: '/api/photos/3c9e5f41', crop: { x: 0, y: 0 } }],
    ['a picture and a square whose left edge is a word', { photo: '/api/photos/3c9e5f41', crop: { x: 'a', y: 0, size: 1 } }],
    ['a picture and a square whose size is a word', { photo: '/api/photos/3c9e5f41', crop: { x: 0, y: 0, size: 'big' } }],
  ])('reads %s as no portrait, and the page is still drawn', async (_what, sent) => {
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, member: { ...HIS_PAGE, ...sent } })),
    )

    expect(await whatTheServerSaysOfMyProfile()).toMatchObject({
      firstName: 'Vojislav',
      photo: null,
      crop: null,
    })
  })

  it('is nothing when the first number of the square is too large to be one', async () => {
    /* `JSON.stringify` cannot say `1e999` (it writes `null`) and the wire can (the same reason the
       whole numbers above are written as text), so these three are sent as the text itself. Each of
       the three numbers has its own case, because each is its own operand of the one condition. */
    for (const square of [
      '{"x":1e999,"y":0,"size":1}',
      '{"x":0,"y":1e999,"size":1}',
      '{"x":0,"y":0,"size":1e999}',
    ]) {
      server?.stop()
      server = serverThat(() =>
        saying(
          `{"role":"competitor","account":41,"member":${JSON.stringify(HIS_PAGE).slice(0, -1)},` +
            `"photo":"/api/photos/3c9e5f41","crop":${square}}}`,
        ),
      )

      expect(await whatTheServerSaysOfMyProfile(), square).toMatchObject({
        photo: null,
        crop: null,
      })
    }
  })

  it.each([
    ['an account that races for nobody', JSON.stringify({ role: 'moderator', account: 41 })],
    ['a record that is null', JSON.stringify({ role: 'competitor', account: 41, member: null })],
    ['a record that is not an object', JSON.stringify({ role: 'competitor', account: 41, member: 'x' })],
    ['nothing but the word for it', '"competitor"'],
    ['null', 'null'],
    ['something that is not JSON', '<!doctype html><title>ne ovo</title>'],
  ])('is nothing for %s', async (_what, body) => {
    server = serverThat(() => saying(body))

    expect(await whatTheServerSaysOfMyProfile()).toBeNull()
  })

  it('is nothing when the chain refuses, and when there is no server to reach', async () => {
    server = serverThat(() => new Response(null, { status: 401 }))

    expect(await whatTheServerSaysOfMyProfile()).toBeNull()

    server.stop()
    server = serverThat(() => {
      throw new Error('nema veze')
    })

    expect(await whatTheServerSaysOfMyProfile()).toBeNull()
  })

  /* **THE CONDITION THIS READER EXISTS UNDER, MEASURED FROM THE OTHER SIDE.** `whoTheServerSaysIAm`
     answers `null` for every fault and the session reads `null` as nobody, so a fact of the page
     that the portal cannot believe, read THERE, would sign the member out of every screen of the
     portal. It is read here instead, and the same body that leaves his page unreadable leaves him
     signed in. Asked of every fact that is only about the page; the three that are also who he is
     are measured by the session's own cases above.

     The mutation that drops the separation is the one that reads the page inside
     `whoTheServerSaysIAm` and answers `null` for it as a whole: it fails every case here. */
  it.each(NOT_BELIEVED_AS_A_PAGE.filter(([key]) => !WHAT_HE_IS.includes(key)))(
    'leaves him signed in when %s is sent as %j, whatever it does to his page',
    async (key, sent) => {
      server = serverThat(() => saying(aMemberSaying({ ...HIS_PAGE, [key]: sent })))

      expect(await whatTheServerSaysOfMyProfile(), 'his page').toBeNull()
      expect(await whoTheServerSaysIAm(), 'who he is').toEqual({
        role: 'competitor',
        account: 41,
        memberNumber: '000032',
        country: 'RS',
        firstSeason: 2016,
        teamId: null,
        membershipBasis: 'payment',
        membershipSeason: null,
        referralCode: 'a92a9c8493cecc3e',
        referredCount: 0,
        hasARecord: true,
        feeStands: false,
      })
    },
  )

  it.each(WHAT_A_PAGE_NEEDS.filter((key) => !WHAT_HE_IS.includes(key)))(
    'leaves him signed in when %s is missing altogether',
    async (key) => {
      const { [key]: _left, ...without } = HIS_PAGE

      server = serverThat(() => saying(aMemberSaying(without)))

      expect(await whoTheServerSaysIAm(), 'who he is').toMatchObject({
        role: 'competitor',
        memberNumber: '000032',
      })
    },
  )
})

/**
 * THE DATA OF THE CALLER HIMSELF, for somebody who may have no number: the six facts a settings
 * screen shows about a person, read APART from who he is and apart from his page.
 *
 * <p>PDL P8, the entry „Šta sme neplaćen član" (10.10.2026): such a person may change „svoje
 * podatke za evidenciju i majicu". He has no number, so there is no page to draw (`profileIn` asks
 * for one), and the public list does not carry him, so the screen has to read him off the one
 * answer that has a row for him.
 *
 * <p><b>The sample is a person who registered and has not paid</b>, written out here for the
 * reason `HIS_PAGE` gives, and it is `HIS_PAGE` with the number taken away and the fee not standing:
 * the one change that makes him the person this reader exists for.
 */
const A_NEWCOMERS_RECORD: Record<string, unknown> = (() => {
  const { memberNumber: _none, ...rest } = HIS_PAGE

  return { ...rest, firstSeason: 2027, active: false }
})()

/** The six this reader is for, which are the facts a data screen draws and nothing a page needs
 *  besides them. Derived from the reader's own sample, never from a list of the page. */
const THE_SIX = ['firstName', 'lastName', 'gender', 'city', 'ageBand', 'firstSeason2027']

/** And the two that are his alone, since 18.10.2026: where a shirt is sent and how he is called. The
 *  data screen draws them in boxes, and the page does not draw them at all. */
const THE_TWO_THAT_ARE_HIS_ALONE = ['address', 'phone']

describe('the data of the caller himself', () => {
  it('is the six facts and his address and no number, for somebody who has registered and has not paid', async () => {
    server = serverThat(() => saying(aMemberSaying(A_NEWCOMERS_RECORD)))

    expect(await whatTheServerSaysOfMyData()).toEqual({
      firstName: 'Vojislav',
      lastName: 'Antonijević',
      gender: 'M',
      city: 'Zaječar',
      ageBand: '40-54',
      firstSeason2027: false,
      address: 'Mihajla Pupina 10',
      phone: '',
    })
    expect(server.asked.map((one) => one.path)).toEqual(['/api/me'])
  })

  /* **A MEMBER WITH NO TELEPHONE IS ANSWERED NO KEY AT ALL, AND THE PORTAL READS THAT AS THE EMPTY
     BOX** (`MeApi.MyOwnRecord.phone`, `@JsonInclude(NON_NULL)`). The case above has none; this one
     has one, and the two together are what tell „absent" from „whatever the key holds". */
  it('reads the telephone the answer carries, and an absent one as the empty box', async () => {
    server = serverThat(() =>
      saying(aMemberSaying({ ...A_NEWCOMERS_RECORD, phone: '+381 60 123 456' })),
    )

    expect(await whatTheServerSaysOfMyData()).toMatchObject({ phone: '+381 60 123 456' })
  })

  /* **AND THE TELEPHONE IS THE ONE FACT OF THE EIGHT THAT MAY BE MISSING, SO ONLY A KEY OF ANOTHER
     SORT ENDS THE READING.** A server that sent a number, a flag or a null for it is saying something
     the portal has no box for, and a telephone drawn as the empty box over a number the server
     holds is the very fault of 18.10.2026 in a new place. */
  it.each([7, true, null, { digits: '065' }])('does not believe a telephone sent as %j', async (sent) => {
    server = serverThat(() => saying(aMemberSaying({ ...A_NEWCOMERS_RECORD, phone: sent })))

    expect(await whatTheServerSaysOfMyData()).toBeNull()
  })

  /* **THE ADDRESS IS NEVER EMPTY AND IS NEVER MISSING**: the column is NOT NULL and V8 refuses a
     blank one, so an answer without it, or with a blank or a non-text one, is a server saying
     something the portal cannot draw a box from. */
  it.each([['missing', undefined], ['blank', '   '], ['a number', 7], ['null', null]])(
    'does not believe an address that is %s',
    async (_what, sent) => {
      const { address: _left, ...without } = A_NEWCOMERS_RECORD

      server = serverThat(() =>
        saying(aMemberSaying(sent === undefined ? without : { ...without, address: sent })),
      )

      expect(await whatTheServerSaysOfMyData()).toBeNull()
    },
  )

  /* **AND THE PAGE DOES NOT CARRY EITHER, which is the half of the split of 18.10.2026 that a data
     reader cannot show.** `profileIn` reads the six through the same function the data is read
     through, and spread into a page the address would have travelled to every screen that draws a
     member. A member whose record has an address and a telephone is handed a page with neither. */
  it('keeps the address and the telephone out of the page', async () => {
    server = serverThat(() =>
      saying(aMemberSaying({ ...HIS_PAGE, phone: '+381 60 123 456' })),
    )

    const page = must(await whatTheServerSaysOfMyProfile(), 'the page is readable')

    expect(Object.keys(page)).not.toContain('address')
    expect(Object.keys(page)).not.toContain('phone')
  })

  /* **AND THE PAGE DOES NOT NEED THEM**: a record without an address is still a profile, because a
     profile is not drawn from it. */
  it('draws a page for a record with no address in it', async () => {
    const { address: _left, ...without } = HIS_PAGE

    server = serverThat(() => saying(aMemberSaying(without)))

    expect(await whatTheServerSaysOfMyProfile()).not.toBeNull()
  })

  /* **THE PROPERTY THE READER EXISTS FOR, asked on its own**: the profile is nothing without a
     number and this is not. A reader that required one would read this man as nobody. */
  it('does not need a number, and does not hand one back even when the answer has it', async () => {
    server = serverThat(() => saying(aMemberSaying(A_NEWCOMERS_RECORD)))

    expect(await whatTheServerSaysOfMyProfile(), 'his page needs a number and he has none').toBeNull()
    expect(await whatTheServerSaysOfMyData(), 'his data does not').not.toBeNull()

    server.stop()
    server = serverThat(() => saying(aMemberSaying(HIS_PAGE)))

    expect(Object.keys(must(await whatTheServerSaysOfMyData(), 'a member has data too')).toSorted()).toEqual(
      [...THE_SIX, ...THE_TWO_THAT_ARE_HIS_ALONE].toSorted(),
    )
  })

  it('reads the six off the sample, and finds six', () => {
    /* An empty list would make both sweeps below say nothing at all, quietly. */
    expect(THE_SIX).toHaveLength(6)
    expect(THE_SIX.every((key) => key in A_NEWCOMERS_RECORD)).toBe(true)
  })

  it.each(THE_SIX)('is nothing at all without %s, which no data screen can be drawn without', async (key) => {
    const { [key]: _left, ...without } = A_NEWCOMERS_RECORD

    server = serverThat(() => saying(aMemberSaying(without)))

    expect(await whatTheServerSaysOfMyData(), `${key} left out`).toBeNull()
  })

  it.each(NOT_BELIEVED_AS_A_PAGE.filter(([key]) => THE_SIX.includes(key)))(
    'does not believe %s sent as %j',
    async (key, sent) => {
      server = serverThat(() => saying(aMemberSaying({ ...A_NEWCOMERS_RECORD, [key]: sent })))

      expect(await whatTheServerSaysOfMyData()).toBeNull()
    },
  )

  /* **AND WHAT A PAGE NEEDS BESIDES THE SIX IS NOT ASKED OF HIM.** A data screen is drawn for a
     person whose record is missing his country, his first season, his biography or his two
     choices, because none of them is on it. This is what parts the reader from `profileIn`, which
     would answer nothing for any of these. */
  it.each(WHAT_A_PAGE_NEEDS.filter((key) => !THE_SIX.includes(key) && key !== 'memberNumber'))(
    'is still the six when %s is missing, which only a page needs',
    async (key) => {
      const { [key]: _left, ...without } = A_NEWCOMERS_RECORD

      server = serverThat(() => saying(aMemberSaying(without)))

      expect(await whatTheServerSaysOfMyData(), `${key} left out`).not.toBeNull()
    },
  )

  it.each([
    ['an account that races for nobody', JSON.stringify({ role: 'moderator', account: 41 })],
    ['a record that is null', JSON.stringify({ role: 'competitor', account: 41, member: null })],
    ['a record that is not an object', JSON.stringify({ role: 'competitor', account: 41, member: 'x' })],
    ['nothing but the word for it', '"competitor"'],
    ['null', 'null'],
    ['something that is not JSON', '<!doctype html><title>ne ovo</title>'],
  ])('is nothing for %s', async (_what, body) => {
    server = serverThat(() => saying(body))

    expect(await whatTheServerSaysOfMyData()).toBeNull()
  })

  it('is nothing when the chain refuses, and when there is no server to reach', async () => {
    server = serverThat(() => new Response(null, { status: 401 }))

    expect(await whatTheServerSaysOfMyData()).toBeNull()

    server.stop()
    server = serverThat(() => {
      throw new Error('nema veze')
    })

    expect(await whatTheServerSaysOfMyData()).toBeNull()
  })

  /* **THE CONDITION THIS READER EXISTS UNDER, MEASURED FROM THE OTHER SIDE** - the same one the
     page's reader is held to, and for the same reason: `whoTheServerSaysIAm` answers `null` for
     every fault and the session reads `null` as nobody, so a fact of his data the portal cannot
     believe, read THERE, would sign him out of every screen of the portal. */
  it.each(NOT_BELIEVED_AS_A_PAGE.filter(([key]) => THE_SIX.includes(key)))(
    'leaves him signed in when %s is sent as %j, whatever it does to his data',
    async (key, sent) => {
      server = serverThat(() => saying(aMemberSaying({ ...A_NEWCOMERS_RECORD, [key]: sent })))

      expect(await whatTheServerSaysOfMyData(), 'his data').toBeNull()
      expect(await whoTheServerSaysIAm(), 'who he is').toMatchObject({
        role: 'competitor',
        account: 41,
        memberNumber: null,
        hasARecord: true,
        feeStands: false,
      })
    },
  )
})

/**
 * THE LANGUAGE OF THE ACCOUNT'S MAIL, read off the same request (JM-B).
 *
 * <p>`GET /api/me` carries `mailLanguage` beside the role and the account, for every account that is
 * signed in, **a record or none** - which is why this reader looks at the OUTER answer and not at
 * `member`. The case that measures that is the second one: an account with no competitor record has
 * a language, and a reader that went through the record would answer nothing for administration.
 */
describe('the language of the mail the server says the account holds', () => {
  it.each(['sr', 'en'] as const)('is %s for a member', async (language) => {
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'competitor', account: 41, member: {}, mailLanguage: language })),
    )

    expect(await whatTheServerSaysOfMyMailLanguage()).toBe(language)
    expect(server.asked.map((one) => one.path)).toEqual(['/api/me'])
  })

  it('is there for an account with no competitor record at all', async () => {
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'moderator', account: 41, mailLanguage: 'en' })),
    )

    expect(await whatTheServerSaysOfMyMailLanguage()).toBe('en')
  })

  it.each([
    ['a language the portal does not write', JSON.stringify({ role: 'moderator', account: 41, mailLanguage: 'de' })],
    ['no language at all', JSON.stringify({ role: 'moderator', account: 41 })],
    ['a language inside the record and not beside it', JSON.stringify({ role: 'competitor', account: 41, member: { mailLanguage: 'en' } })],
    ['null', 'null'],
    ['something that is not JSON', '<!doctype html><title>ne ovo</title>'],
  ])('is nothing for %s', async (_what, body) => {
    server = serverThat(() => saying(body))

    expect(await whatTheServerSaysOfMyMailLanguage()).toBeNull()
  })

  it('is nothing when the chain refuses, and when there is no server to reach', async () => {
    server = serverThat(() => new Response(null, { status: 401 }))

    expect(await whatTheServerSaysOfMyMailLanguage()).toBeNull()

    server.stop()
    server = serverThat(() => {
      throw new Error('nema veze')
    })

    expect(await whatTheServerSaysOfMyMailLanguage()).toBeNull()
  })

  /* **A FAULT HERE MUST NEVER SIGN HIM OUT**, the condition every reader of this request is held
     to: `whoTheServerSaysIAm` answers `null` for every fault and the session reads `null` as nobody,
     so a language the portal cannot believe, read THERE, would sign him out of every screen. */
  it('leaves him signed in when the language is one the portal cannot believe', async () => {
    server = serverThat(() =>
      saying(JSON.stringify({ role: 'moderator', account: 41, mailLanguage: 'de' })),
    )

    expect(await whatTheServerSaysOfMyMailLanguage(), 'his language').toBeNull()
    expect(await whoTheServerSaysIAm(), 'who he is').toMatchObject({ role: 'moderator', account: 41 })
  })
})

/**
 * THE PICTURES OF THE CALLER HIMSELF, which `GET /api/me/photo` answers (`MePhotoApi.mine`): the one
 * that waits for a moderator and the one that stands on his profile, each as an address and a circle.
 *
 * <p>Asked on every visit to the screen that sends a picture, and believed only in the shape the route
 * promises: both keys, each `null` or a picture under the address that belongs to it. A waiting picture
 * under the public address would be drawn from a route that refuses it, so it is not believed; a key
 * that is missing is not "none" but a server saying something the portal does not know.
 */
const A_CIRCLE = { x: 0.25, y: 0.5, size: 0.75 }
const A_WAITING_PICTURE = { photo: '/api/me/photo/' + 'ab'.repeat(32), crop: A_CIRCLE }
const A_STANDING_PICTURE = { photo: '/api/photos/' + 'cd'.repeat(32), crop: A_CIRCLE }

describe('the pictures of the caller himself', () => {
  it.each([
    ['none at all', { waiting: null, standing: null }],
    ['one that waits', { waiting: A_WAITING_PICTURE, standing: null }],
    ['one that stands', { waiting: null, standing: A_STANDING_PICTURE }],
    ['both', { waiting: A_WAITING_PICTURE, standing: A_STANDING_PICTURE }],
  ])('are read as they are said, for a member with %s', async (_what, said) => {
    server = serverThat(() => saying(JSON.stringify(said)))

    expect(await whatTheServerSaysOfMyPictures()).toEqual(said)
    expect(server.asked.map((one) => one.path)).toEqual(['/api/me/photo'])
  })

  it.each([
    ['a waiting picture under the public address', { waiting: A_STANDING_PICTURE, standing: null }],
    ['a standing picture under the address of the waiting one', { waiting: null, standing: A_WAITING_PICTURE }],
    ['a picture with no address', { waiting: { crop: A_CIRCLE }, standing: null }],
    ['a picture whose address is not text', { waiting: { photo: 7, crop: A_CIRCLE }, standing: null }],
    ['a picture with no circle', { waiting: { photo: A_WAITING_PICTURE.photo }, standing: null }],
    [
      'a circle whose size is a word',
      { waiting: { photo: A_WAITING_PICTURE.photo, crop: { x: 0.2, y: 0.2, size: 'big' } }, standing: null },
    ],
    ['a picture that is a word', { waiting: 'yes', standing: null }],
    ['the standing key missing', { waiting: null }],
    ['the waiting key missing', { standing: null }],
  ])('are not believed when the answer has %s', async (_what, said) => {
    server = serverThat(() => saying(JSON.stringify(said)))

    expect(await whatTheServerSaysOfMyPictures()).toBeNull()
  })

  it.each([
    ['a body that is not an object', '"x"'],
    ['null', 'null'],
    ['something that is not JSON', '<!doctype html><title>ne ovo</title>'],
  ])('are not believed for %s', async (_what, body) => {
    server = serverThat(() => saying(body))

    expect(await whatTheServerSaysOfMyPictures()).toBeNull()
  })

  it('are nothing when the route refuses, and when there is no server to reach', async () => {
    server = serverThat(() => new Response(null, { status: 404 }))

    expect(await whatTheServerSaysOfMyPictures()).toBeNull()

    server.stop()
    server = serverThat(() => {
      throw new Error('nema veze')
    })

    expect(await whatTheServerSaysOfMyPictures()).toBeNull()
  })
})

/**
 * THE WORDS OF THE CALLER'S THAT WAIT FOR A MODERATOR, which `GET /api/me` carries as `bioWaiting`
 * (`MeApi.MyOwnRecord`, PDL P11, 18.10.2026).
 *
 * <p>The server leaves the key OUT for a member whose words do not wait, so absence is the empty box;
 * a key of another sort is a server saying something the portal does not know, and a caller with no
 * record at all (a moderator who does not race) has nothing to read it from.
 */
describe('the words of the caller himself that wait for a moderator', () => {
  it('are read as they are said', async () => {
    server = serverThat(() =>
      saying(aMemberSaying({ ...HIS_PAGE, bioWaiting: 'Reči koje čekaju moderatora.' })),
    )

    expect(await whatTheServerSaysOfMyWaitingText()).toBe('Reči koje čekaju moderatora.')
    expect(server.asked.map((one) => one.path)).toEqual(['/api/me'])
  })

  it('are the empty box where the answer carries none', async () => {
    server = serverThat(() => saying(aMemberSaying(HIS_PAGE)))

    expect(await whatTheServerSaysOfMyWaitingText()).toBe('')
  })

  it.each([7, true, null, { words: 'x' }])('are not believed when sent as %j', async (sent) => {
    server = serverThat(() => saying(aMemberSaying({ ...HIS_PAGE, bioWaiting: sent })))

    expect(await whatTheServerSaysOfMyWaitingText()).toBeNull()
  })

  it.each([
    ['an account that races for nobody', JSON.stringify({ role: 'moderator', account: 41 })],
    ['a record that is null', JSON.stringify({ role: 'competitor', account: 41, member: null })],
    ['nothing but the word for it', '"competitor"'],
    ['something that is not JSON', '<!doctype html><title>ne ovo</title>'],
  ])('are nothing for %s', async (_what, body) => {
    server = serverThat(() => saying(body))

    expect(await whatTheServerSaysOfMyWaitingText()).toBeNull()
  })

  it('are nothing when the chain refuses, and when there is no server to reach', async () => {
    server = serverThat(() => new Response(null, { status: 401 }))

    expect(await whatTheServerSaysOfMyWaitingText()).toBeNull()

    server.stop()
    server = serverThat(() => {
      throw new Error('nema veze')
    })

    expect(await whatTheServerSaysOfMyWaitingText()).toBeNull()
  })
})

describe('the seasons the server says he may send a run of', () => {
  /* `MeApi.WhoIAm.seasonsOpenForAReport` (PDL P9, 19.10.2026): read off the answer and not worked
     out, because the window's one home is the server's clock. Off the ACCOUNT, since 20.10.2026; a copy
     left in `member` is no answer, so the member here carries one that the reader must not take. */
  const answering = (seasons: unknown) =>
    serverThat(() =>
      saying(
        JSON.stringify({
          role: 'competitor',
          account: 7,
          member: { ...myOwnRecordFromMe, seasonsOpenForAReport: [1999] },
          seasonsOpenForAReport: seasons,
        }),
      ),
    )

  it.each([
    ['the first season', [2027], [2027]],
    ['the morning of New Year, before ten', [2027, 2028], [2027, 2028]],
    ['before the league, which is no season at all', [], []],
  ])('is the list it says on %s', async (_when, said, read) => {
    server = answering(said)

    expect(await whatTheServerSaysOfTheSeasonsOpenForAReport()).toEqual(read)
  })

  it.each([
    ['a list holding something that is not a whole number', [2027, '2028']],
    ['a year that is not a whole one', [2027.5]],
    ['a word in place of a list', 'sve'],
  ])('is not believed at all when it is %s', async (_what, said) => {
    server = answering(said)

    expect(await whatTheServerSaysOfTheSeasonsOpenForAReport()).toBeNull()
  })

  it('is nothing where nobody is signed in, and the list where the caller races for nobody', async () => {
    server = serverThat(() => new Response(null, { status: 401 }))

    expect(await whatTheServerSaysOfTheSeasonsOpenForAReport()).toBeNull()

    /* A moderator who races for nobody has no `member` and still enters results, so the seasons are
       his as well (the moderator's screen, 20.10.2026). */
    server.stop()
    server = serverThat(() => saying(JSON.stringify({ role: 'moderator', account: 9, seasonsOpenForAReport: [2027] })))

    expect(await whatTheServerSaysOfTheSeasonsOpenForAReport()).toEqual([2027])

    /* And an answer that names none is no answer. */
    server.stop()
    server = serverThat(() => saying(JSON.stringify({ role: 'moderator', account: 9 })))

    expect(await whatTheServerSaysOfTheSeasonsOpenForAReport()).toBeNull()
  })
})
