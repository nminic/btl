import { afterEach, describe, expect, it } from 'vitest'
import { ROLES, SIGNED_IN_ROLES } from '../roles/context'
import { serverThat, type Asked } from '../test/serverAnswers'
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

describe('who the server says I am', () => {
  it('is the role and the account it answered with', async () => {
    server = serverThat(() => saying(JSON.stringify({ role: 'superadmin', account: 41, membershipBasis: null })))

    expect(await whoTheServerSaysIAm()).toEqual({
      role: 'superadmin',
      account: 41,
      memberNumber: null,
      membershipBasis: null,
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
        membershipBasis: null,
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
