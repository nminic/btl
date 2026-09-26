import { askTheServer, type Answer } from '../pages/account/askTheServer'
import { SIGNED_IN_ROLES, type SignedInRole } from '../roles/context'
import { MEMBERSHIP_BASES, type MembershipBasis } from '../data/types'

/**
 * THE THREE THINGS THE PORTAL SAYS TO THE SERVER ABOUT BEING SIGNED IN.
 *
 * <p>Getting in, asking who it thinks you are, and getting out. Nothing else, and
 * nothing about any resource. **This said the fourteen resources „still come out of
 * `/mock`" and that `BASE` is untouched, and both went out of date on 21.09.2026**, when
 * ADL A50 was carried out and they moved to `/api` in one go. What that paragraph was
 * really for survives it: signing in is not a resource, it is a write, and it belongs on
 * no list of them - no name of it is in `RESOURCE_NAMES` and nothing here goes through
 * the cache in `data/client.ts`. That is the same ground `pages/account` stood on from
 * 19.09.2026.
 *
 * <p><b>The token is asked of `askTheServer` rather than copied out of it.</b> That
 * file warns the next reader off IMPORTING AND WIDENING it, and nothing here widens it:
 * both writes below are a POST of a small object to an address under `/api`, which is
 * the whole of what it does, and 401 already lands in the `wrong` arm of its answer
 * carrying its own number. Copying it would have made a second home for the one fact it
 * exists to hold - the name of the cookie and the name of the header - and that is the
 * thing it says it is avoiding.
 *
 * <p><b>THE ROLE IS NARROWED AND NEVER ASSERTED</b> (ADL A14). What comes off the wire
 * is `unknown` and is looked at, exactly as `RoleSwitch` looks at the word coming out of
 * its own control: a server one release ahead, a proxy answering something else, or an
 * address that is not ours at all must end as "nobody is signed in" rather than as a
 * role the portal then draws a screen for.
 *
 * <p><b>NOTHING HERE WRITES WHAT IT IS GIVEN ANYWHERE BUT INTO THE BODY OF ONE
 * REQUEST.</b> Not to the console, not into an address, not into storage, and not into
 * anything it answers with. `signIn.test.tsx` holds that by sweeping every place a
 * value could land rather than by trusting this paragraph, the same way
 * `newPassword.test.tsx` does for the other route that carries a password.
 */

/**
 * What the server says back about whoever is asking: `MeApi.WhoIAm`, and no more than
 * that.
 *
 * <p><b>This said „there is no member number in it and `MeApi` says at length why", and
 * that was false when it was written.</b> That class has carried one since 20.09.2026 and
 * refuses the sentence in bold - „AND SINCE 20.09.2026 IT CARRIES A MEMBER NUMBER, which
 * is the sentence this class used to spend four paragraphs refusing." It is corrected here
 * rather than deleted because of what it cost: a sentence saying a field is not there is
 * an instruction to the next reader not to look for it, and nobody did for four days,
 * which is exactly as long as every member of the league was locked out of his own
 * screens.
 *
 * <p><b>Three roles and not four.</b> This answer only exists for somebody the chain has
 * already let through, and „visitor" is the portal's own word for nobody being let
 * through (`roles/context.ts`, `isMember`). Believed off the wire it signed somebody in
 * as a visitor: measured 20.09.2026, `{"role":"visitor","account":99}` drew the account
 * menu and named them „Nalog 99", which is the header saying somebody is signed in while
 * the word it was given says the opposite. The boundary this narrowing has - that the
 * schema does not itself refuse such an account - is written where `SIGNED_IN_ROLES` is.
 */
export type WhoTheServerSaysIAm = {
  role: SignedInRole
  account: number
  /**
   * WHICH MEMBER OF THE LEAGUE THE CALLER IS, and null where he is none.
   *
   * **This is the only door it can come through, and until 24.09.2026 the portal did not
   * open it.** `MeApi` has carried the number since 20.09.2026 and said so in bold; this
   * file read the role, the account and the basis past it. The cost was the whole member
   * area: `useMemberScreen` asks whether the session names a member, nothing else on the
   * portal sets one (`signIn` has no caller outside the tests, measured 24.09.2026), so
   * all eleven screens behind a signed in member's own picture - his profile among them -
   * answered „Ovaj deo je za takmicare". Owner, 24.09.2026: „Trenutno ne mogu cak ni
   * svojim profilom da se igram, podesavam, prilozim slika."
   *
   * **Null on all THREE of the ways there is no number, which are not one state.** No
   * `member` key at all is an account that races for nobody, which is what a moderator
   * and a superadmin permanently are (PDL P21). The key present with no `memberNumber`
   * inside it is somebody who registered and has not been given one (ADL A44, owner
   * 11.09.2026: „Osoba je `competitor` od registracije, a clan postaje kad dobije broj").
   * A word the answer carries that is not a string is a server saying something this
   * portal does not know. The portal draws one screen for all three and that is written
   * down as a boundary rather than left to be found (`pages/member/memberScreen.tsx`).
   */
  memberNumber: string | null
  /**
   * WHERE THE CALLER LIVES, as his own record has it, and null where the answer did not
   * say.
   *
   * **Here since 25.09.2026, and unlike the four below it this one HAS another door.**
   * `/api/competitors` carries a country on every row, the caller's among them, and
   * „Moja članarina" read it off there until today. The owner closed that road for this
   * screen (PDL P8a): that list ends `where c.active`, so the member whose fee has
   * LAPSED has no row on it at all - and he is the whole reason the screen exists, since
   * renewing is what he opens it to do. `/api/me` answers one row, and that row is his
   * whether or not his fee is standing.
   *
   * **Which is a different reason from the one the basis below is here for, and the
   * difference is worth keeping.** That field has no second home anywhere; this one has,
   * and is read here anyway because the second home cannot answer the one person who
   * needs it. So „a field is remembered here when it has no other door" is not the whole
   * rule any more, and the rule that replaces it is: when the other door cannot answer
   * the caller, it is not a door.
   *
   * Null for a visitor, for an account that races for nobody, and for a value that is
   * not a string. The shape is not judged beyond that, for the same reason the code
   * below is not: which words are countries is the schema's (V7,
   * `competitor_town_is_from_the_codebook_or_typed`), and a portal that re-judged it
   * here could only refuse to draw a member the server really answered.
   */
  country: string | null
  /**
   * THE FIRST SEASON THE CALLER RACED, and null where the answer did not say.
   *
   * Here for the same reason the country above is, and off the same row.
   *
   * **A whole number and never merely „a number"**, which is the shape `referredCount`
   * below is read with and for the same measurement: a season that arrived as a string
   * would go into a sentence as one („Član od 2016. sezone"), and a fraction is not a
   * season. `typeof` narrows and `Number.isInteger` then says which numbers count.
   */
  firstSeason: number | null
  /**
   * THE TEAM THE CALLER IS IN, and null where he is in none.
   *
   * **The one field on this answer whose null is ORDINARY rather than „I was not
   * told"**, and the two cannot be told apart here. `MeApi.MyOwnRecord` leaves the key
   * out altogether for a member with no team (`@JsonInclude(NON_NULL)`), which is
   * sixteen of the thirty two in the data, so absence is the common case and not a
   * fault.
   *
   * **That is a boundary and it is written down rather than papered over**: a server
   * answering a team that is not a number is read here as „no team", and the screen
   * then says „Trenutno nisi ni u jednom timu." rather than naming a team it cannot
   * find. Which is what it would have said anyway - a team id no team on
   * `/api/teams` carries draws the same sentence - so the two states the portal cannot
   * separate are the two states it draws alike.
   */
  teamId: number | null
  /**
   * HOW THE CALLER'S OWN MEMBERSHIP IS HELD, and null where the answer did not say.
   *
   * **This is the only door it can come through, and that is measured rather than
   * chosen.** The owner, 20.09.2026: „Clan vidi SVOJ osnov clanstva; tudj ne vidi niko
   * osim administracije." `/api/competitors` keeps the second half by asking about the
   * CALLER and never about the row (`CompetitorApi`,
   * `case when cast(:administration as boolean) then c.membership_basis end`), so a
   * member is not given it even on his own row. `/api/me` is where the first half
   * lives: `MeApi.MyOwnRecord` carries it, on one row, and that row is his.
   *
   * **What reading it the other way cost, measured 21.09.2026 before it shipped.** The
   * screen about a member's own fee read the basis off the public list, so for every
   * member it came back nothing, „freed of the fee" was false, and the renewal panel
   * opened with a payment slip on it. A member who owes the league nothing would have
   * been asked for money the first time he opened „Moja clanarina".
   *
   * Null for a visitor, for an account that races for nobody, and for a word the
   * answer carries that the portal does not know: all three are „I was not told", and
   * the screen may not turn any of them into „you pay".
   */
  membershipBasis: MembershipBasis | null
  /**
   * THE CALLER'S OWN REFERRAL LINK, and null where the answer did not say.
   *
   * **This is the only door it can come through, and that became true on 25.09.2026
   * rather than being true all along.** `/api/competitors` answered it on the caller's
   * own row from 20.09.2026, and the screen read it off there. The owner took it off
   * that list (PDL P26a): the personal link „se sklanja sa javne liste takmicara" and
   * stays only on „Moja članarina".
   *
   * **What reading it the other way cost, and it is measured rather than argued.** That
   * list ends `where c.active`, so the member whose fee has LAPSED has no row on it and
   * was answered no link - while the terms promise him one on exactly the page he opens
   * to renew (V24, section 6). `/api/me` answers one row and that row is his, standing
   * fee or not.
   *
   * Null for a visitor and for an account that races for nobody, which are the same two
   * states the basis above is null for, and for a code that is not a string. The screen
   * draws an address with nothing after the sign in all three, which is a link that
   * plainly does not work rather than one that looks as if it might.
   */
  referralCode: string | null
  /**
   * HOW MANY MEMBERS THE CALLER BROUGHT IN WHOSE FEE IS STANDING, and null where the
   * answer did not say.
   *
   * **A COUNT and never the column it is counted from.** `referred_by` holds the KEY of
   * whoever brought a member (V7) and a key does not leave the server, so the query „nad
   * svima, ne nad sobom" (PDL, 06.09.2026) happens where the data is.
   *
   * **Null and not nought, which is the distinction this field exists to keep.** „I was
   * not told" and „you brought in nobody" are two different sentences, and a screen that
   * turned the first into the second would promise a member a balance of zero on an
   * answer that never mentioned him. The screen decides what to draw for null; this
   * says only what arrived.
   */
  referredCount: number | null
}

/**
 * Signing in, which is the one request on this portal that carries a password.
 *
 * <p>`SignInApi` answers 204 with a session cookie, or 401 with nothing at all. The
 * five ways of not getting in - an address nobody has, a wrong password, an account
 * with no password, an address nobody has confirmed, and an account that is shut - are
 * ONE answer on purpose, said so in `SignIn`'s own words: told apart, this form becomes
 * a way of asking the portal who its members are. Nothing here may take that apart, and
 * nothing here can: there is nothing in the answer to take apart.
 */
export async function signInWith(email: string, password: string): Promise<Answer> {
  return askTheServer('/api/sign-in', { email, password })
}

/**
 * Signing out.
 *
 * <p>Always 204, whatever the browser was carrying, and the cookie comes back already
 * over: `SignOutApi` says why, and it is the same reason as above - an answer that
 * differed would be a way of asking whether a stolen cookie still opens anything.
 *
 * <p>The empty object is a body the route does not read. It is sent because that is the
 * shape `askTheServer` posts in, and a POST with a body Spring never binds is a POST
 * with a body Spring never binds.
 */
export async function signOutOfTheServer(): Promise<Answer> {
  return askTheServer('/api/sign-out', {})
}

/**
 * Who the portal is signed in as, straight from the server, or nobody.
 *
 * <p><b>This is the only place a role comes from once somebody has signed in.</b> Not
 * the form, which asks for an address and a password and is told nothing back; not the
 * answer to the sign in, which is 204 and empty. `MeApi` is behind the chain like every
 * other route, so nobody signed in is 401 rather than a body saying so, and 401 here is
 * simply nobody.
 *
 * <p>A plain `fetch` and no token, because a read needs none: `ApiSecurity` protects
 * what changes something, and `askTheServer` would fetch a cookie this call does not
 * want. Cookies go with it because the address is our own and that is what
 * `credentials: 'same-origin'` means, which is the default and is why it is not written
 * out here.
 */
export async function whoTheServerSaysIAm(): Promise<WhoTheServerSaysIAm | null> {
  let answer: Response

  try {
    answer = await fetch('/api/me')
  } catch {
    /* No server to talk to. Nobody is signed in as far as any screen is concerned,
       which is the same thing a visitor sees, so there is nothing to say out loud. */
    return null
  }

  if (!answer.ok) {
    return null
  }

  let body: unknown

  try {
    body = await answer.json()
  } catch {
    return null
  }

  if (typeof body !== 'object' || body === null) {
    return null
  }

  const said: unknown = Reflect.get(body, 'role')
  const account: unknown = Reflect.get(body, 'account')
  /* Looked for rather than declared, exactly as `RoleSwitch` looks for the word its
     own control hands back (ADL A14). Looked for among the THREE a signed in answer may
     carry and not among the four `V5__role_and_admin_right.sql` inserts: the fourth is
     the word for nobody, and a fourth taken as an answer is a session that signs
     somebody in as a visitor. See `WhoTheServerSaysIAm` above. */
  const role = SIGNED_IN_ROLES.find((one) => one === said)

  if (role === undefined || typeof account !== 'number') {
    return null
  }

  /* READ ONCE AND HANDED TO ALL SEVEN, rather than dug out seven times. Readers walking
     to the same record by themselves are that many places that can disagree about where
     it is, and the fact they are reading - „does this caller race for anybody" - is one
     fact. It said „all four" until 25.09.2026 and the number is the only thing in it
     that moved. */
  const mine = recordIn(body)

  return {
    role,
    account,
    memberNumber: numberIn(mine),
    country: countryIn(mine),
    firstSeason: wholeIn(mine, 'firstSeason'),
    teamId: wholeIn(mine, 'teamId'),
    membershipBasis: basisIn(mine),
    referralCode: codeIn(mine),
    referredCount: wholeIn(mine, 'referredCount'),
  }
}

/**
 * The caller's own record out of the answer, or nothing.
 *
 * Absent altogether for an account that races for nobody (`MeApi.WhoIAm`, „Absent rather
 * than null, and rather than an object of nulls"), which is the state a moderator and a
 * superadmin are permanently in.
 *
 * Written as its own function rather than inline because four fields are read out of it
 * and the reader above is already the longest sentence in this file.
 */
function recordIn(body: object): object | null {
  const member: unknown = Reflect.get(body, 'member')

  return typeof member !== 'object' || member === null ? null : member
}

/**
 * Which member of the league the caller is, or nothing.
 *
 * **Looked for and never asserted**, the same shape the role above is read with. The
 * number is ABSENT from a record that has one owner and no number yet (ADL A44), so the
 * key missing is an ordinary answer rather than a broken one; and a number that is not a
 * string is a server saying something this portal has no screen for, which must end as
 * „no member" and never as a member whose number is an object.
 */
function numberIn(mine: object | null): string | null {
  if (mine === null) {
    return null
  }

  const said: unknown = Reflect.get(mine, 'memberNumber')

  return typeof said === 'string' ? said : null
}

/**
 * The caller's own membership basis out of the answer, or nothing.
 *
 * **Looked for and never asserted**, for the reason written above: a word inside the
 * record that the portal does not know is a word it may not act on.
 */
function basisIn(mine: object | null): MembershipBasis | null {
  if (mine === null) {
    return null
  }

  const said: unknown = Reflect.get(mine, 'membershipBasis')

  return MEMBERSHIP_BASES.find((one) => one === said) ?? null
}

/**
 * The caller's own referral code out of the answer, or nothing.
 *
 * **Looked for and never asserted**, for the reason written above. The shape is not
 * checked beyond „it is a string": `competitor_referral_code_shape` is sixteen
 * hexadecimal characters and it is the SCHEMA's job to keep that, checked at the moment
 * the code is stored (`ReferralCode`). A portal that re-judged it here would be a second
 * opinion about a rule it does not own, and the only thing it could do with a code it
 * disliked is refuse to show a member the link the server really gave him.
 */
function codeIn(mine: object | null): string | null {
  if (mine === null) {
    return null
  }

  const said: unknown = Reflect.get(mine, 'referralCode')

  return typeof said === 'string' ? said : null
}

/**
 * Where the caller lives, out of the answer, or nothing.
 *
 * **Looked for and never asserted**, and the shape is not checked beyond „it is a
 * string", which is the ground `codeIn` above stands on and the same ground: which words
 * name a country is the SCHEMA's (V7, `competitor_town_is_from_the_codebook_or_typed`),
 * checked where a town is stored. A portal re-judging it here would be a second opinion
 * about a rule it does not own, and the only thing it could do with a country it disliked
 * is refuse to draw a member the server really answered.
 */
function countryIn(mine: object | null): string | null {
  if (mine === null) {
    return null
  }

  const said: unknown = Reflect.get(mine, 'country')

  return typeof said === 'string' ? said : null
}

/**
 * A whole number off the caller's own record, by name, or nothing.
 *
 * **One function and not three, which is the correction of 25.09.2026.** It was written
 * for the count alone; the season and the team arrived beside it needing the same two
 * questions, and three copies of one rule are three places that can answer it
 * differently. What it is a rule ABOUT is the only thing named here - „is this a whole
 * number" - so the three readers differ by a key and by nothing else.
 *
 * **Looked for and never asserted**, and the type is asked for as well as the presence: a
 * value that arrives as a string would go into an arithmetic, or into a sentence, and
 * come out as something nobody meant. `Number.isInteger` on top of `typeof` rather than
 * alone, because the two differ on exactly the values that are not one of these - `NaN`
 * and a fraction - and because `Number.isInteger` answers a boolean and narrows nothing,
 * so the value would still have to be asserted into a number, which is what ADL A14
 * refuses. `typeof` narrows and the other half then says which numbers count.
 *
 * **What each null MEANS is the caller's to know and is not the same for the three**, so
 * it is written where each is declared rather than here: no balance was mentioned, no
 * season was mentioned, and - for the team - no team, which is ordinary.
 */
function wholeIn(mine: object | null, name: 'firstSeason' | 'teamId' | 'referredCount'): number | null {
  if (mine === null) {
    return null
  }

  const said: unknown = Reflect.get(mine, name)

  return typeof said === 'number' && Number.isInteger(said) ? said : null
}
