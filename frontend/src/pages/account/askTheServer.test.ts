import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { at } from '../../test/at'
import {
  answeredWith,
  did,
  forgetEveryCookie,
  refused,
  serverThat,
  type Asked,
} from '../../test/serverAnswers'
import { askTheServer } from './askTheServer'

/**
 * THE ONE PIECE OF THIS INCREMENT THAT SPEAKS TO A SERVER, MEASURED AWAY FROM THE
 * TWO SCREENS THAT USE IT.
 *
 * <p>The screens are measured by what a reader sees; this is measured by what goes
 * over the wire, which is the half no rendered sentence can show. The other end of
 * it - that a real server accepts exactly this - is measured in Java, over a real
 * socket, by `SettingAPasswordOverRealHttpTest`. Neither is the other: this one says
 * what is sent, that one says what is accepted, and a mistake in between would leave
 * either alone.
 */

const HEADER = 'X-XSRF-TOKEN'

let server: { asked: Asked[]; stop: () => void } | null = null

/** What the request at this position carried in the header that matters.
 *
 *  Through `at`, so a case that recorded no such request fails saying so rather than
 *  reading `undefined` off nothing and agreeing that no header was sent. */
function echoedBy(asked: Asked[], index: number): unknown {
  return Reflect.get(Object(at(asked, index).init?.headers), HEADER)
}

beforeEach(() => {
  forgetEveryCookie()
})

afterEach(() => {
  server?.stop()
  server = null
  forgetEveryCookie()
})

describe('the token that proves a request came from the portal', () => {
  it('echoes the cookie the browser is already holding, and reads nothing first', async () => {
    document.cookie = 'XSRF-TOKEN=vec-imam'
    server = serverThat((path) => (path === '/api/password-reset' ? did() : null))

    await askTheServer('/api/password-reset', { token: 'x' })

    /* One request and not two: a read to be handed a cookie that is already here is
       a round trip nobody needs, and on the slower half of the portal's readers it
       is the difference the screen is waiting on. */
    expect(server.asked.map((one) => one.path)).toEqual(['/api/password-reset'])
    expect(echoedBy(server.asked, 0)).toBe('vec-imam')
  })

  it('reads an open route first when there is no cookie, and echoes what that left', async () => {
    /* jsdom does not put a `Set-Cookie` off a made-up `Response` into the jar, so
       the read writes the cookie itself. That is the one thing being stood in for:
       `SignInOverRealHttpTest` measures, over a real socket, that a plain read of an
       open route really does hand out a readable `XSRF-TOKEN`. */
    server = serverThat((path) => {
      if (path === '/api/countries') {
        document.cookie = 'XSRF-TOKEN=tek-stigao'
        return answeredWith(200)
      }

      return path === '/api/email-confirmation' ? did() : null
    })

    await askTheServer('/api/email-confirmation', { token: 'x' })

    expect(server.asked.map((one) => one.path)).toEqual([
      '/api/countries',
      '/api/email-confirmation',
    ])
    expect(echoedBy(server.asked, 1)).toBe('tek-stigao')
  })

  it('sends the request anyway when no read produced a token, and lets the server judge', async () => {
    server = serverThat((path) =>
      path === '/api/countries' ? answeredWith(200) : answeredWith(403),
    )

    const answer = await askTheServer('/api/password-reset', { token: 'x' })

    expect(server.asked.map((one) => one.path)).toEqual([
      '/api/countries',
      '/api/password-reset',
    ])
    /* No header rather than a header carrying the four letters of the word `null`,
       which is what writing it out unconditionally would send. */
    expect(echoedBy(server.asked, 1)).toBeUndefined()
    /* And the refusal is carried back rather than swallowed: a screen has to be able
       to say this happened, which is the whole of the next case in the two screens. */
    expect(answer).toEqual({ got: 'rejected' })
  })

  it('is not fooled by a cookie whose name only begins like ours', async () => {
    /* `contains`, and a prefix without the equals sign, are the two ways this has
       gone wrong elsewhere on the portal. A value from the wrong cookie is echoed
       with nothing said, and the server answers 403 to a reader who did everything
       right. */
    document.cookie = 'XSRF-TOKEN-NESTO=tudje'
    server = serverThat((path) => (path === '/api/countries' ? answeredWith(200) : did()))

    await askTheServer('/api/password-reset', { token: 'x' })

    expect(server.asked.map((one) => one.path)).toEqual([
      '/api/countries',
      '/api/password-reset',
    ])
    expect(echoedBy(server.asked, 1)).toBeUndefined()
  })

  it('echoes the value exactly as the cookie carries it', async () => {
    /* Not decoded on the way out. The mechanism is that two values MATCH; a value
       this file "corrects" is a value the server does not recognise, and the door
       stops opening for anybody. */
    document.cookie = 'XSRF-TOKEN=a%20b'
    server = serverThat(() => did())

    await askTheServer('/api/password-reset', { token: 'x' })

    expect(echoedBy(server.asked, 0)).toBe('a%20b')
  })
})

describe('what one answer is taken to mean', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=imam'
  })

  it('reads 204 as done', async () => {
    server = serverThat(() => did())

    expect(await askTheServer('/api/password-reset', {})).toEqual({ got: 'done' })
  })

  it('reads 201 as done too, which is what /api/teams and /api/comments answer', async () => {
    server = serverThat(() => answeredWith(201))

    expect(await askTheServer('/api/teams', {})).toEqual({ got: 'done' })
  })

  it('reads 403 as a request nobody proved came from the portal', async () => {
    server = serverThat(() => answeredWith(403))

    expect(await askTheServer('/api/password-reset', {})).toEqual({ got: 'rejected' })
  })

  it('carries the route own word for a refusal, and never one of ours', async () => {
    server = serverThat(() => refused('thePasswordHasLeaked'))

    expect(await askTheServer('/api/password-reset', {})).toEqual({
      got: 'refused',
      reason: 'thePasswordHasLeaked',
    })
  })

  it('does not invent a reason for a refusal that carries none', async () => {
    /* Three bodies, one answer, and it is deliberately not `refused`: a screen that
       was handed an empty reason would look it up, miss, and print the word for a
       cause nobody named. */
    for (const body of ['not json at all', '"a string"', '{"reason":""}']) {
      server?.stop()
      server = serverThat(() => new Response(body, { status: 400 }))

      expect(await askTheServer('/api/password-reset', {})).toEqual({ got: 'wrong', status: 400 })
    }
  })

  it('answers with the number for anything else, so the screen can say it', async () => {
    server = serverThat(() => answeredWith(500))

    expect(await askTheServer('/api/password-reset', {})).toEqual({ got: 'wrong', status: 500 })
  })

  it('carries a refusal named by a 409 exactly as one named by a 400', async () => {
    /* One route answers 409 for one of its three refusals - registering at an address
       somebody already holds - and names it in the body like every other. The number is
       deliberately not carried back: a name is what the screen looks a sentence up by,
       and a screen that told the two numbers apart would be keeping a fact the name
       already holds. */
    server = serverThat(() => refused('theAddressIsTaken', 409))

    expect(await askTheServer('/api/registration', {})).toEqual({
      got: 'refused',
      reason: 'theAddressIsTaken',
    })
  })

  it('says which number it was when a 409 carries no reason anybody can read', async () => {
    /* THE NUMBER ITSELF, AND IT HAD NO CASE UNTIL 21.09.2026: written back as a literal
       400 the whole package stayed green, and a 409 whose body nobody could read would
       have told the reader „Server je odgovorio brojem 400" - a number that was never on
       the wire. The reason is not invented either, for the same reason the 400 beside
       this one does not invent one: a refusal nobody can name is not one of the three
       the screens know. */
    server = serverThat(() => new Response('not json at all', { status: 409 }))

    expect(await askTheServer('/api/registration', {})).toEqual({ got: 'wrong', status: 409 })
  })

  it('says nothing came back when the request never got an answer', async () => {
    server = serverThat(() => {
      throw new TypeError('Failed to fetch')
    })

    expect(await askTheServer('/api/password-reset', {})).toEqual({ got: 'nothing' })
  })

  it('says the same when it is the read for the token that cannot be made', async () => {
    forgetEveryCookie()
    server = serverThat(() => {
      throw new TypeError('Failed to fetch')
    })

    /* And nothing is sent: there is no server to send it to, and what this caller
       would have been sending is a password. */
    expect(await askTheServer('/api/password-reset', { password: 'ne-salji-me' })).toEqual({
      got: 'nothing',
    })
    expect(server.asked.map((one) => one.path)).toEqual(['/api/countries'])
  })
})

describe('what is sent', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=imam'
  })

  it('posts what it was given, whole, as the body and nowhere else', async () => {
    server = serverThat(() => did())

    await askTheServer('/api/password-reset', { token: 'tk', password: 'a', passwordRepeat: 'b' })

    const sent = at(server.asked, 0)

    expect(sent.path).toBe('/api/password-reset')
    expect(sent.init?.method).toBe('POST')
    expect(sent.init?.body).toBe('{"token":"tk","password":"a","passwordRepeat":"b"}')
  })
})
