import { askTheServer, type Answer } from '../pages/account/askTheServer'
import { mailLanguageOfMe, type MailLanguage } from '../pages/member/mailLanguage'
import { SIGNED_IN_ROLES, type SignedInRole } from '../roles/context'
import { AGE_BANDS, type AgeBand } from '../data/categories'
import { REFERRAL_CODE } from '../data/pricing'
import {
  BIRTHDAY_SHOWN,
  MEMBERSHIP_BASES,
  type BirthdayShown,
  type Competitor,
  type Crop,
  type Gender,
  type MembershipBasis,
} from '../data/types'

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
 * <p><b>THE SECOND OF THE THREE IS READ THREE TIMES SINCE 11.10.2026</b>: once for who is asking
 * ({@link whoTheServerSaysIAm}, which the session believes), once for the page of the member
 * himself ({@link whatTheServerSaysOfMyProfile}, which one screen asks for when the page is his
 * own and the public list does not carry him) and once for the data of somebody who has registered
 * and has no number ({@link whatTheServerSaysOfMyData}, which the settings screen asks for when
 * there is no profile to draw and still a name and a town to show). They share the request and
 * nothing it returns, so that a fault in the second or the third can never sign him out of the
 * first.
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
   * not a string. The shape is not judged beyond that, and `countryIn` below says why
   * that is a boundary of its own and not a ground shared with the referral code: the
   * schema does hold a shape for a country (`country_code_shape`, V2), and what asking
   * it would do to the screen is not decided.
   */
  country: string | null
  /**
   * THE FIRST SEASON THE CALLER RACED, and null where the answer did not say.
   *
   * Here for the same reason the country above is, and off the same row.
   *
   * **A whole number and never merely „a number"**, which is the shape `referredCount`
   * below is read with and for the same measurement: a season that arrived as a string
   * would go into a sentence as one („Član od 2016. sezone"), and neither a fraction nor a
   * number below nought is a season. Which numbers count is `wholeIn`'s to say, and it is
   * written there once.
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
   * answering a team that is not a whole number of nought or more is read here as „no
   * team", and the screen
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
   * `case when cast(:administration as boolean) then held.basis end`), so a
   * member is not given it even on his own row. `/api/me` is where the first half
   * lives: `MeApi.MyOwnRecord` carries it, on one row, and that row is his.
   *
   * **What reading it the other way cost, measured 21.09.2026 before it shipped.** The
   * screen about a member's own fee read the basis off the public list, so for every
   * member it came back nothing, „freed of the fee" was false, and the renewal panel
   * opened with a payment slip on it. A member who owes the league nothing would have
   * been asked for money the first time he opened „Moja clanarina".
   *
   * **It is the basis of the SEASON ON SALE since V62** (owner, 18.10.2026, PDL P8: „do
   * 14.10. je osnova 2027, od 15.10 je osnova 2028"), read off his membership row of that
   * season, which is the one home of the fact.
   *
   * Null for a visitor, for an account that races for nobody, for a member who holds no
   * row for the season on sale, and for a word the answer carries that the portal does not
   * know. The last of those is told apart by `membershipSeason`, which the server answers
   * exactly when a row stands: a season with no word the portal knows is still a season he
   * holds, and the screen may not turn it into „you pay".
   */
  membershipBasis: MembershipBasis | null
  /**
   * THE SEASON THAT BASIS IS THE BASIS OF, which is whether he holds a membership of the season
   * on sale at all, and null where the answer did not say. Present exactly when a row stands
   * (`MeApi.MyOwnRecord.membershipSeason`), so it is the one fact the renewal panel turns on: a
   * member who holds the season on sale is offered no payment for it, on whichever basis.
   */
  membershipSeason: number | null
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
   * states the basis above is null for, and for a code that is not a code: a value that
   * is not a string, or a string that is not sixteen lowercase hexadecimal characters
   * (`codeIn` below says why that is asked). The screen draws an address with nothing
   * after the sign in all of them, which is a link that plainly does not work rather
   * than one that looks as if it might.
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
  /**
   * WHETHER THE ANSWER CARRIED A RECORD OF THE CALLER AT ALL, and a member number does not say
   * it.
   *
   * **Here because the number answers a narrower question than the one the portal now asks.**
   * Until 11.10.2026 „no number" was one state and the portal drew one sentence for it. It is two:
   * an account that races for nobody, which has no `member` in the answer, and somebody who
   * registered and has not paid, who has the `member` and not the number inside it (ADL A44,
   * `numberIn` above). The second may pay, choose his category and change his password and his
   * data (PDL P8, „Šta sme neplaćen član", 10.10.2026), so the portal has to be able to tell him
   * from the first. This is the presence of the object, nothing more: it is true for the record of
   * a member whose fee has lapsed and for a member, and it is the number that parts them from him.
   */
  hasARecord: boolean
  /**
   * WHETHER HIS FEE STANDS, and null where the answer did not say.
   *
   * **`MeApi.MyOwnRecord.active`, which is `competitor.active`, since 11.10.2026.** Before that
   * day the answer did not say, and a member whose fee has lapsed was drawn every screen of a
   * member whose fee stands (measured against a real database that day: the two were answered the
   * same names). The server refuses him 404 on `PUT /api/me` and `PUT /api/me/password` (PDL P8,
   * the addition of 11.10.2026), so this is what lets a screen not offer him two forms that fail
   * every time.
   *
   * **Looked for and never asserted, and null for four things**: no record, a record that does not
   * carry the key (a server one release behind), a value that is not a yes or a no, and a caller
   * who is not a member. The session turns a null into „stands", because the flag is only ever
   * acted on to take something AWAY from a member and a word the portal was not told is a word it
   * may not act on (`session/context.ts`, first arm of `SignedIn`).
   */
  feeStands: boolean | null
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
 * What `GET /api/me` answered, as an object, or nothing at all.
 *
 * <p><b>The one place the question is asked, and the only thing the two readers below SHARE.</b>
 * {@link whoTheServerSaysIAm} reads the answer for who is asking and
 * {@link whatTheServerSaysOfMyProfile} reads the same answer for his page, and they are two
 * readers on purpose: a member's identity must never be lost to a fault in the part of the
 * answer that draws his profile. What they share is this network step and nothing it returns -
 * each narrows the object for itself, so a field one of them cannot believe is a field the
 * other never looks at.
 *
 * <p>Nothing is said out loud for any of the ways it can fail. No server to talk to, a refusal,
 * a body that is not JSON and a body that is not an object are all `null`, which is what a
 * visitor sees, and the callers decide what `null` means to them.
 */
async function whatTheServerAnswersMe(): Promise<object | null> {
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

  return typeof body !== 'object' || body === null ? null : body
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
  const body = await whatTheServerAnswersMe()

  if (body === null) {
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

  /* READ ONCE AND HANDED TO ALL NINE, rather than dug out nine times. Readers walking
     to the same record by themselves are that many places that can disagree about where
     it is, and the fact they are reading - „does this caller race for anybody" - is one
     fact. It said „all four" until 25.09.2026 and „all seven" until 11.10.2026, and the
     number is the only thing in it that moved. */
  const mine = recordIn(body)

  return {
    role,
    account,
    memberNumber: numberIn(mine),
    country: countryIn(mine),
    firstSeason: wholeIn(mine, 'firstSeason'),
    teamId: wholeIn(mine, 'teamId'),
    membershipBasis: basisIn(mine),
    membershipSeason: wholeIn(mine, 'membershipSeason'),
    referralCode: codeIn(mine),
    referredCount: wholeIn(mine, 'referredCount'),
    /* The presence of the object and not of any key inside it, which is the one difference
       between „races for nobody" and „registered and has not paid". */
    hasARecord: mine !== null,
    feeStands: feeStandsIn(mine),
  }
}

/**
 * THE PAGE OF THE CALLER HIMSELF, as `GET /api/me` answers it, or nothing: the record his own
 * profile is drawn from.
 *
 * <p>PDL P8, 25.09.2026, „Treba da moze da otvori svoj profil dokle god postoji" - and a member
 * whose fee has lapsed is on no row of the public list, so his name, his town, his category,
 * his biography and his portrait reach the screen through this answer and no other
 * (`MeApi.MyOwnRecord`, which says why that is the right door).
 *
 * <p><b>IT IS READ APART FROM {@link whoTheServerSaysIAm}, AND THAT IS THE CONDITION IT EXISTS
 * UNDER.</b> That function answers `null` for every fault, and the session treats `null` as
 * nobody: a portrait or a gender the portal cannot believe, read there, would sign a member
 * out of every screen of the portal because of a fault in the part of the answer that draws one
 * page. Here the same fault is `null` for THIS page only, which the profile says out loud
 * („Podaci se ne mogu učitati.", with the way to ask again), and the member stays signed in. What
 * the two share is the request and nothing it returned ({@link whatTheServerAnswersMe}).
 *
 * <p><b>Looked for and never asserted</b>, field by field, as everything off this answer is
 * (ADL A14). The facts a page cannot be drawn without - the number, the name, the town, the
 * gender, the category, the season he started in, the biography, the two choices he made about
 * his page - make the whole answer `null` when one of them is missing or of a kind the portal
 * does not know. The two that may honestly be absent (the club and its year, the portrait and
 * its square) are `null` on the record, which is how the public list says it as well.
 *
 * <p>It returns a {@link Competitor} and not a shape of its own, so the screen that draws a
 * member draws him the same way whichever door he came through. The one field of that record it
 * leaves out is the basis of his membership, which is optional there, is the administration's to
 * read on the public list, and is read by the page about his fee off the session
 * (`pages/member/Membership.tsx`) and by nothing that draws a profile.
 */
export async function whatTheServerSaysOfMyProfile(): Promise<Competitor | null> {
  const body = await whatTheServerAnswersMe()

  return body === null ? null : profileIn(recordIn(body))
}

/**
 * WHAT A MEMBER'S OWN DATA SCREEN IS DRAWN FROM: who he is, in the six facts it shows and the two
 * he can change.
 *
 * <p>His first and last name, his gender, his town, the band he races in and whether he runs in
 * the beginners' category, and **since 18.10.2026 his postal address and his telephone**
 * (`MeApi.MyOwnRecord.address`, `.phone`): the owner saved both on QA, was told so, refreshed, and
 * found both boxes empty, because nothing served them. They are the one place the portal ever
 * reads them back, and they are his alone; the public record (`Competitor`) still carries neither,
 * which is why they are added to THIS type and not to the one it is picked from.
 *
 * <p>Nothing else, in particular **no member number**. That is what
 * parts it from {@link Competitor}: somebody who registered and has not paid has no number, so
 * there is no profile to draw (the profile is headed by a number and stands on a page nobody may
 * open for him yet), and he still has a name to correct and a town and a category to read
 * (PDL P8, „Šta sme neplaćen član", 10.10.2026: „svoje podatke za evidenciju i majicu").
 *
 * <p>A type of its own and not a {@link Competitor} with a hole in it, because a record with a
 * number that may be absent is a record every screen that draws a member would then have to ask
 * about; this one is read by one screen, and a screen that wants a number cannot be handed it.
 */
export type MyData = Pick<
  Competitor,
  'firstName' | 'lastName' | 'gender' | 'city' | 'ageBand' | 'firstSeason2027'
> & {
  /** Where a shirt and a medal are sent. Never empty: the server takes no blank one. */
  address: string
  /**
   * His telephone, and the EMPTY STRING for a member who has none. The server leaves the key out
   * for him (`@JsonInclude(NON_NULL)`, V8: "no phone is NULL"), and the box a member types into
   * has no other way to say "none" than to be empty.
   */
  phone: string
}

/**
 * THE SAME RECORD AS {@link whatTheServerSaysOfMyProfile}, read for the eight facts above, or
 * nothing.
 *
 * <p>Its own reader for the reason that one has: a fault in it must never sign him out, and it
 * shares the request and nothing it returned ({@link whatTheServerAnswersMe}). The first six are
 * read by the very functions the profile is read with (`dataIn`), so the two cannot disagree about
 * what a name is or what makes a record unreadable.
 */
export async function whatTheServerSaysOfMyData(): Promise<MyData | null> {
  const body = await whatTheServerAnswersMe()

  return body === null ? null : dataIn(recordIn(body))
}

/**
 * THE LANGUAGE THE ACCOUNT'S MAIL IS WRITTEN IN, or nothing.
 *
 * <p>The fourth reader of the request the second of the three things above makes, and the first
 * that reads nothing of the member: `GET /api/me` carries `mailLanguage` beside the role and the
 * account (`MeApi.WhoIAm`), for every account that is signed in, a record or no record. It is read
 * off the OUTER answer, which is why it needs no {@link recordIn} and why an administration account
 * with no competitor record has one.
 *
 * <p>Its own reader for the reason the other two have: a fault in it must never sign him out
 * ({@link whatTheServerAnswersMe} is shared and nothing it returns is).
 */
export async function whatTheServerSaysOfMyMailLanguage(): Promise<MailLanguage | null> {
  const body = await whatTheServerAnswersMe()

  return body === null ? null : mailLanguageOfMe(body)
}

/**
 * THE WORDS OF HIS THAT WAIT FOR A MODERATOR, or nothing when the record cannot be believed.
 *
 * <p>`bioWaiting` on the caller's own record (`MeApi.MyOwnRecord`, PDL P11, 18.10.2026), which the
 * server leaves OUT for a member whose words do not wait, so absence is read as the empty string - the
 * empty box - and anything that is not text is a server saying something the portal does not know.
 * A member without a record is nothing, like every other reader of the record.
 */
export async function whatTheServerSaysOfMyWaitingText(): Promise<string | null> {
  const body = await whatTheServerAnswersMe()
  const mine = body === null ? null : recordIn(body)

  if (mine === null) {
    return null
  }

  const said: unknown = Reflect.get(mine, 'bioWaiting')

  if (said === undefined) {
    return ''
  }

  return typeof said === 'string' ? said : null
}

/**
 * ONE PICTURE OF A MEMBER'S, as an address to fetch it from and the circle over it.
 *
 * <p>`photo` is an address and never a key (`MePhotoApi.Picture`): `/api/photos/<digest>` for the
 * one that stands on the profile, which is public, and `/api/me/photo/<digest>` for the one that
 * waits, which is nobody's address but his.
 */
export type HeldPicture = { photo: string; crop: Crop }

/**
 * WHAT THIS MEMBER'S PORTRAIT IS DOING, BOTH HALVES OF IT, and either may be nothing.
 *
 * <p>`GET /api/me/photo` (`MePhotoApi.mine`), the answer a reload needs. PDL P11, the entry of
 * 27.09.2026 „Na ekranu za slanje slike vidi se slika koja čeka, sa krugom i oznakom da čeka
 * odobrenje" (the owner: „ukoliko udjem da posaljem ponovo, vidim da je trenutno slika u statusu
 * cekanja i tu vidim trenutno azuriranu sliku sa krugom"). The route has served it since PR 531 and
 * until 18.10.2026 nothing on this side asked: a picture sent in one visit was gone from the screen
 * in the next, and the circle with it.
 */
export type MyPictures = { waiting: HeldPicture | null; standing: HeldPicture | null }

/**
 * THE PICTURES A MEMBER HAS, or nothing when the answer cannot be believed.
 *
 * <p>Both keys are always there on the server and each is null for a member who has no such
 * picture, so a missing key is not "none" but a server saying something this portal does not
 * know, and it ends the reading as it does for every other fact of a record. Each picture is
 * believed only under the address that belongs to it: a waiting picture under a public address
 * would be drawn from a route that refuses it.
 */
export async function whatTheServerSaysOfMyPictures(): Promise<MyPictures | null> {
  let answer: Response

  try {
    answer = await fetch('/api/me/photo')
  } catch {
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

  const waiting = heldIn(body, 'waiting', '/api/me/photo/')
  const standing = heldIn(body, 'standing', '/api/photos/')

  return waiting === undefined || standing === undefined ? null : { waiting, standing }
}

/** One of the two pictures: `null` where there is none, `undefined` where the answer is not believed. */
function heldIn(body: object, name: 'waiting' | 'standing', under: string): HeldPicture | null | undefined {
  const said: unknown = Reflect.get(body, name)

  if (said === null) {
    return null
  }

  if (typeof said !== 'object') {
    return undefined
  }

  const photo: unknown = Reflect.get(said, 'photo')
  const crop = squareIn(said)

  return typeof photo === 'string' && photo.startsWith(under) && crop !== null ? { photo, crop } : undefined
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
 * **Looked for and never asserted**, for the reason written above, **and asked what it
 * looks like**: sixteen lowercase hexadecimal characters are believed, and anything else
 * is „I was not told", exactly as a code that is not a string is (PENDING 227, part b).
 *
 * **This said the opposite until 02.10.2026**: that the shape was the SCHEMA's to keep,
 * that a portal re-judging it would be a second opinion about a rule it does not own, and
 * that the only thing it could do with a code it disliked was refuse a member the link the
 * server really gave him. That was an argument, and the worry in it is a measurement now:
 * every code of the generated members is believed (`session/theServer.test.ts` reads the
 * file), and the server draws its codes with `ReferralCode.fresh()` and holds them to the
 * same shape where they are stored (`competitor_referral_code_shape`, V7), so the only code
 * this refuses is one no row can carry. What the argument left out is where the string goes
 * next: this is the link a member copies and sends on (`member/Membership.tsx`), and a
 * reader that handed ANY string to the address handed on whatever the answer carried, an
 * ampersand or a hash included.
 *
 * **The question goes to the one place that already says what a code looks like**,
 * `REFERRAL_CODE` in `data/pricing.ts`, which `pages/Registration.tsx` asks of a code that
 * arrives in an address. So a code the registration page would refuse is a code this one
 * does not draw: one rule asked at both ends of the link, with no second expression and no
 * list of what is refused. `data/referralCodeShape.test.ts` holds that constant to the
 * schema's own text.
 *
 * **Which is why nothing is encoded where the link is built.** Sixteen lowercase
 * hexadecimal characters have no other spelling in an address than themselves, so
 * `Membership.tsx` writes the code as it is, and what makes that safe is this question and
 * not a second one asked there: a code with an ampersand and a hash in it goes in at the
 * wire and the page draws an address with nothing after the sign
 * (`data/theRealAnswer.test.tsx`).
 */
function codeIn(mine: object | null): string | null {
  if (mine === null) {
    return null
  }

  const said: unknown = Reflect.get(mine, 'referralCode')

  return typeof said === 'string' && REFERRAL_CODE.test(said) ? said : null
}

/**
 * Where the caller lives, out of the answer, or nothing.
 *
 * **Looked for and never asserted**, and the shape is not checked beyond „it is a
 * string". **That is a boundary and it is written as one, not a ground borrowed from
 * `codeIn` above**, which asks its code what it looks like since 02.10.2026. The schema
 * does hold a shape for a country (`country_code_shape`, V2: two capital letters), so the
 * question could be asked here too; what asking it would do is why it is not. A country
 * that is any other string is a member drawn in euros (`paysInDinars` is `=== 'RS'`),
 * while one refused here is „I was not told", and „Moja članarina" then draws the page
 * that says the portal cannot read his record in place of his fee. Which of the two a
 * country in no known shape should get is a question of that screen and is left as it was,
 * and `theServer.test.ts` holds it: such a country comes back as it was sent.
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
 * alone, because `Number.isInteger` answers a boolean and narrows nothing, so the value
 * would still have to be asserted into a number, which is what ADL A14 refuses.
 * `typeof` narrows and the other two halves then say which numbers count.
 *
 * **THE SET IT BELIEVES IS A WHOLE NUMBER OF NOUGHT OR MORE, and it is written once and
 * not as a list of what is refused.** This said the two halves differ on `NaN` and a
 * fraction, which stopped one step short of the set the sentence named: `-3` is a whole
 * number, `Number.isInteger` says so, and it reached the fee screen as a balance of
 * „-1.800 RSD" (measured on the screen, 02.10.2026, PENDING 227). A count of members, a
 * season and the number of a team are none of them below nought, so a whole number below
 * nought is the server saying something this portal has no screen for, and it ends as „I
 * was not told" exactly as a fraction does. `theServer.test.ts` asks every number the
 * server declares for this record the same two questions rather than naming the wrong ones.
 *
 * **Nought is believed for all three, and for the count it is the answer that matters**:
 * „you brought in nobody" is a statement and „I was not told" is not. For the other two it
 * is looser than it could be - `team.id` is a `bigserial` (V11), so no team is numbered
 * nought - and that is written here and not mended, because a floor of its own per key
 * would be three readers where this says there is one.
 *
 * **What each null MEANS is the caller's to know and is not the same for the three**, so
 * it is written where each is declared rather than here: no balance was mentioned, no
 * season was mentioned, and - for the team - no team, which is ordinary.
 */
function wholeIn(
  mine: object | null,
  name: 'firstSeason' | 'teamId' | 'teamSince' | 'referredCount' | 'membershipSeason',
): number | null {
  if (mine === null) {
    return null
  }

  const said: unknown = Reflect.get(mine, name)

  return typeof said === 'number' && Number.isInteger(said) && said >= 0 ? said : null
}

/**
 * THE RECORD OF HIS OWN PAGE out of the caller's record, or nothing (see
 * {@link whatTheServerSaysOfMyProfile}, which says why this is read apart from who he is).
 *
 * <p>Every fact a page needs is asked for under the name `CompetitorApi` answers it under, and
 * the ones the page cannot be drawn without end the whole reading when they are missing:
 * a page with no name is not a page, and a page drawn with a category the portal made up is a
 * lie about a member to the member himself. The two pairs that may honestly be absent are
 * `teamId` with `teamSince`, and `photo` with `crop`.
 *
 * <p><b>The portrait and its square travel together, here as on the server</b>: one of the two
 * without the other is read as no portrait at all, which draws the monogram - a circle that is
 * wrong in a corner is better than a profile that is not drawn because of its decoration.
 */
function profileIn(mine: object | null): Competitor | null {
  if (mine === null) {
    return null
  }

  /* THE SIX THAT A DATA SCREEN IS DRAWN FROM ARE READ BY `sixFactsIn`, and are not read a second
     time here: two readers of the same name are two answers to „is this a name", and the
     profile used to be the only one. Its own conditions are exactly what they were.

     **AND ONLY THE SIX, which is the point of the split of 18.10.2026.** `dataIn` also reads the
     postal address and the telephone, which are his alone (`MeApi.MyOwnRecord`) and which a
     profile neither needs nor may carry: spread into this record they would have travelled to every
     screen that draws a member, and a profile of a member who has none to read would have gone
     unreadable. */
  const data = sixFactsIn(mine)
  const memberNumber = numberIn(mine)
  const country = countryIn(mine)
  const firstSeason = wholeIn(mine, 'firstSeason')
  const bio = textIn(mine, 'bio')
  const profileHidden = flagIn(mine, 'profileHidden')
  const birthdayShown = birthdayShownIn(mine)

  if (
    data === null ||
    memberNumber === null ||
    country === null ||
    firstSeason === null ||
    bio === null ||
    profileHidden === null ||
    birthdayShown === null
  ) {
    return null
  }

  const photo = photoIn(mine)
  const crop = squareIn(mine)

  return {
    ...data,
    memberNumber,
    country,
    firstSeason,
    profileHidden,
    birthdayShown,
    teamId: wholeIn(mine, 'teamId'),
    teamSince: wholeIn(mine, 'teamSince'),
    bio,
    photo: crop === null ? null : photo,
    crop: photo === null ? null : crop,
  }
}

/**
 * THE SIX FACTS OF A MEMBER'S RECORD that both his data screen and his profile are drawn from, or
 * nothing when any of them is missing or of a kind the portal does not know.
 *
 * <p>The conditions are the profile's own - a name that says nothing, a gender that is not one of
 * the two words, a band the portal does not know, a flag that merely reads as one - and they end the
 * whole reading, because a screen showing a member his own category made up is a lie about him to
 * himself (`profileIn` says it for the profile).
 */
function sixFactsIn(
  mine: object | null,
): Pick<Competitor, 'firstName' | 'lastName' | 'gender' | 'city' | 'ageBand' | 'firstSeason2027'> | null {
  if (mine === null) {
    return null
  }

  const firstName = nameIn(mine, 'firstName')
  const lastName = nameIn(mine, 'lastName')
  const gender = genderIn(mine)
  const city = nameIn(mine, 'city')
  const ageBand = ageBandIn(mine)
  const firstSeason2027 = flagIn(mine, 'firstSeason2027')

  if (
    firstName === null ||
    lastName === null ||
    gender === null ||
    city === null ||
    ageBand === null ||
    firstSeason2027 === null
  ) {
    return null
  }

  return { firstName, lastName, gender, city, ageBand, firstSeason2027 }
}

/**
 * THE EIGHT FACTS OF {@link MyData} out of the caller's record, or nothing when any of them is
 * missing or of a kind the portal does not know: the six of {@link sixFactsIn}, and the two that
 * are his alone.
 *
 * <p>The address is text that says something, like a name; the telephone is text or nothing at
 * all, and nothing at all is a member who has none.
 */
function dataIn(mine: object | null): MyData | null {
  const six = sixFactsIn(mine)

  if (mine === null || six === null) {
    return null
  }

  const address = nameIn(mine, 'address')
  const phone = phoneIn(mine)

  if (address === null || phone === null) {
    return null
  }

  return { ...six, address, phone }
}

/**
 * Whether the caller's fee stands, out of the answer, or nothing.
 *
 * **Looked for and never asserted**: a yes or a no and nothing that merely reads as one. Null for
 * a caller with no record, for a record without the key, and for a value of another sort - all of
 * them „I was not told", which the session turns into „stands" because the flag is only acted on
 * to take something away (`session/context.ts`, first arm of `SignedIn`).
 */
function feeStandsIn(mine: object | null): boolean | null {
  return mine === null ? null : flagIn(mine, 'active')
}

/**
 * A name, a town or a postal address: text that says something. A blank one is a server saying
 * nothing.
 */
function nameIn(mine: object, name: 'firstName' | 'lastName' | 'city' | 'address'): string | null {
  const said: unknown = Reflect.get(mine, name)

  return typeof said === 'string' && said.trim() !== '' ? said : null
}

/**
 * The telephone: text, or nothing at all for a member who has none.
 *
 * <p>The server leaves the key OUT for him (`MeApi.MyOwnRecord.phone`), so absence is read as the
 * empty box. Anything else that is not text is a server saying something the portal does not know,
 * and ends the reading like every other fact of the record.
 */
function phoneIn(mine: object): string | null {
  const said: unknown = Reflect.get(mine, 'phone')

  if (said === undefined) {
    return ''
  }

  return typeof said === 'string' ? said : null
}

/** Text that may be empty: what a member has written about himself, when he has written nothing. */
function textIn(mine: object, name: 'bio'): string | null {
  const said: unknown = Reflect.get(mine, name)

  return typeof said === 'string' ? said : null
}

/** One of the two words the schema allows, looked for and never asserted. */
function genderIn(mine: object): Gender | null {
  const said: unknown = Reflect.get(mine, 'gender')

  return said === 'M' || said === 'F' ? said : null
}

/** The band the server worked out, looked for among the bands the portal knows. */
function ageBandIn(mine: object): AgeBand | null {
  const said: unknown = Reflect.get(mine, 'ageBand')

  return AGE_BANDS.find((one) => one === said) ?? null
}

/** What he chose to show of his birthday, looked for among the three words there are. */
function birthdayShownIn(mine: object): BirthdayShown | null {
  const said: unknown = Reflect.get(mine, 'birthdayShown')

  return BIRTHDAY_SHOWN.find((one) => one === said) ?? null
}

/** A yes or a no, and nothing that merely reads as one. */
function flagIn(mine: object, name: 'firstSeason2027' | 'profileHidden' | 'active'): boolean | null {
  const said: unknown = Reflect.get(mine, name)

  return typeof said === 'boolean' ? said : null
}

/**
 * Where his approved portrait is asked for, or nothing.
 *
 * <p>The whole address as the server gives it, and only an address under the portal's own
 * `/api/photos/`: it goes into an `img`, so the question is where the string goes next, as
 * `codeIn` asks of a code (my reasoning, not a recorded decision). Anything else is „no portrait".
 */
function photoIn(mine: object): string | null {
  const said: unknown = Reflect.get(mine, 'photo')

  return typeof said === 'string' && said.startsWith('/api/photos/') ? said : null
}

/** The square of the portrait: three finite numbers, or nothing. */
function squareIn(mine: object): Crop | null {
  const said: unknown = Reflect.get(mine, 'crop')

  if (typeof said !== 'object' || said === null) {
    return null
  }

  const x: unknown = Reflect.get(said, 'x')
  const y: unknown = Reflect.get(said, 'y')
  const size: unknown = Reflect.get(said, 'size')

  return typeof x === 'number' &&
    typeof y === 'number' &&
    typeof size === 'number' &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(size)
    ? { x, y, size }
    : null
}
