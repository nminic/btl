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
    server = serverThat(() => saying(JSON.stringify({ role: 'superadmin', account: 41 })))

    expect(await whoTheServerSaysIAm()).toEqual({ role: 'superadmin', account: 41 })
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

      expect(await whoTheServerSaysIAm(), role).toEqual({ role, account: 41 })
    }

    /* And there really were three. An empty list would make the loop above say nothing
       at all, quietly. */
    expect(SIGNED_IN_ROLES.length).toBe(ROLES.length - 1)
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
