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
 * that. There is no member number in it and `MeApi` says at length why.
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

  return role === undefined || typeof account !== 'number'
    ? null
    : { role, account, membershipBasis: basisIn(body) }
}

/**
 * The caller's own membership basis out of the answer, or nothing.
 *
 * **Looked for and never asserted**, the same shape the role above is read with: the
 * record is absent altogether for an account that races for nobody (`MeApi.WhoIAm`,
 * „Absent rather than null, and rather than an object of nulls"), and a word inside it
 * that the portal does not know is a word it may not act on.
 *
 * Written as its own function rather than inline because it walks two levels and the
 * reader above is already the longest sentence in this file.
 */
function basisIn(body: object): MembershipBasis | null {
  const member: unknown = Reflect.get(body, 'member')

  if (typeof member !== 'object' || member === null) {
    return null
  }

  const said: unknown = Reflect.get(member, 'membershipBasis')

  return MEMBERSHIP_BASES.find((one) => one === said) ?? null
}
