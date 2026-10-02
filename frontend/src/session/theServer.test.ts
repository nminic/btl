import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ROLES, SIGNED_IN_ROLES } from '../roles/context'
import { must } from '../test/at'
import { serverThat, type Asked } from '../test/serverAnswers'
import { myOwnRecordFromMe } from '../test/theAnswer'
import { whoTheServerSaysIAm } from './theServer'

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
      /* AND THE TWO P26a MOVED HERE ON 25.09.2026, null for the same reason the two above
         are: this answer carries no record at all, so nothing was said about any of them.
         An answer with no `member` key is an account that races for nobody, and a link for
         a man who does not run is a sentence nobody can finish. */
      referralCode: null,
      referredCount: null,
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
        referralCode: null,
        referredCount: null,
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

     **Nought is believed for all three, and that is the boundary of one rule rather than a finding about
     each.** A team numbered nought cannot exist (`team.id` is a `bigserial`, V11) and a season numbered
     nought is not a year, so for those two the floor is looser than it could be. That is written here and
     not mended, because a floor of its own per key would be three readers where `wholeIn` says there is
     one, and nothing in PENDING asks for it. */
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

  it.each(NUMBERS_THE_SERVER_DECLARES)('believes a whole number of nought or more for %s', async (key) => {
    for (const sent of BELIEVED) {
      server?.stop()
      server = serverThat(() =>
        saying(`{"role":"competitor","account":41,"member":{"${key}":${sent}}}`),
      )

      const who = must(await whoTheServerSaysIAm(), 'an answer that names a member')

      expect(Reflect.get(who, key), `${key} sent as ${sent}`).toBe(Number(sent))
    }
  })

  it.each(NUMBERS_THE_SERVER_DECLARES)('believes nothing else for %s', async (key) => {
    for (const [kind, sent] of NOT_BELIEVED) {
      server?.stop()
      server = serverThat(() =>
        saying(`{"role":"competitor","account":41,"member":{"${key}":${sent}}}`),
      )

      const who = must(await whoTheServerSaysIAm(), 'an answer that names a member')

      expect(Reflect.get(who, key), `${key} sent as ${kind}: ${sent}`).toBeNull()
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
})
