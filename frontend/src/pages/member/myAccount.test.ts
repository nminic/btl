import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import sr from '../../i18n/sr.json'
import { answeredWith, forgetEveryCookie, refused, serverThat } from '../../test/serverAnswers'
import { tellTheServer } from '../account/askTheServer'
import {
  AS_LONG_AS_THE_FORM_ALLOWS,
  WHAT_THIS_SCREEN_SENDS,
  WHEN_CHANGING_MY_DATA,
  WHEN_CHANGING_MY_PASSWORD,
  whatChanged,
  type Box,
  type Sent,
} from './myAccount'

/** Where the server's own words live, spelled as `pages/account/refusals.test.ts` spells it. */
const WEB = join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web')

/**
 * Every reason one route can answer with.
 *
 * <p><b>A constant the class SHARES, and never one it keeps to itself</b>, which is one word
 * narrower than the reading `pages/account/refusals.test.ts` does and the difference was
 * measured rather than foreseen. That one matches `static final String` anywhere on a line,
 * and the five classes it reads happen to hold no private one. `MeWriteApi` does:
 * {@code private static final String THE_PROFILES_TAB = "profiles"}, the queue a waiting
 * biography stands in. Read the wider way this file demanded that the screen carry a sentence
 * for „profiles", which is not a refusal and which no reader could ever be shown.
 *
 * <p>The distinction is the class's own and not a trick of spelling: a reason is package
 * private precisely so the tests and the screen can be held to it, and the tab is private
 * because nothing outside the class has business with it.
 */
function reasonsIn(file: string): string[] {
  const java = readFileSync(join(WEB, file), 'utf-8')

  return [...java.matchAll(/^\s*static final String \w+ = "([^"]+)";/gm)].map((one) => one[1] ?? '')
}

/** A box with nothing standing behind it and nothing typed into it. */
function boxes(some: Partial<Record<Sent, Box>>): Record<Sent, Box> {
  return {
    firstName: { standing: 'Strahinja', typed: 'Strahinja' },
    lastName: { standing: 'Vukićević', typed: 'Vukićević' },
    address: { standing: null, typed: '' },
    phone: { standing: null, typed: '' },
    ...some,
  }
}

describe('what of the member’s own form actually travels', () => {
  it('is nothing at all while nothing has been touched', () => {
    expect(whatChanged(boxes({}))).toEqual({})
  })

  it('is the one field that moved, and never the ones beside it', () => {
    expect(whatChanged(boxes({ firstName: { standing: 'Strahinja', typed: 'Strahinje' } }))).toEqual(
      { firstName: 'Strahinje' },
    )
  })

  /**
   * A field left OUT means „do not touch it" to the route (ADL A54, and `MeWriteApi` writes
   * every column through a `coalesce` that leaves a null parameter as it was).
   *
   * **The mutation this case exists for is a replacement of the source and not a deletion.**
   * Written the obvious way - send everything on the screen - the request still carries the
   * right new name and the case about the new name still passes. What it also carries is the
   * OTHER three columns, rewritten with whatever happened to be in their boxes. So the thing
   * to measure is not „did the change arrive" but „did anything else".
   */
  it('leaves out every field that did not move, so a save rewrites nothing else', () => {
    const changed = whatChanged(
      boxes({
        firstName: { standing: 'Strahinja', typed: 'Strahinje' },
        phone: { standing: null, typed: '' },
      }),
    )

    expect(Object.keys(changed)).toEqual(['firstName'])
  })

  /**
   * THE ONE THE PORTAL CANNOT SEE, WHICH IS THE OTHER HALF OF THE SAME RULE.
   *
   * Nothing serves a postal address or a telephone, so an empty box here means „I do not
   * know what is there and I am not changing it". Sent as an empty string it would ask the
   * server to CLEAR a column the form requires, which is its own refusal.
   */
  it('leaves out an unseen field that was never typed into', () => {
    expect(whatChanged(boxes({ address: { standing: null, typed: '   ' } }))).toEqual({})
  })

  it('carries an unseen field the moment something is typed into it', () => {
    expect(whatChanged(boxes({ phone: { standing: null, typed: ' 065 1234 ' } }))).toEqual({
      phone: '065 1234',
    })
  })

  /**
   * **Emptying a box the portal CAN see is a change and travels**, and this is the case that
   * keeps the two knowledge states from being folded into one rule.
   *
   * Written as „send it when something was typed" for both, a name deliberately cleared would
   * be silently dropped and the member would press Save, be told nothing was wrong, and find
   * his name still there. What happens instead is that the empty string travels and the server
   * answers `aFieldIsBlank`, which this screen says in words. The rule is the server's; this
   * only makes sure the question reaches it.
   */
  it('carries a seen field that was emptied, so the server is the one that refuses it', () => {
    expect(whatChanged(boxes({ lastName: { standing: 'Vukićević', typed: '' } }))).toEqual({
      lastName: '',
    })
  })

  it('reads what is typed as trimmed, so spaces alone are not a change', () => {
    expect(whatChanged(boxes({ firstName: { standing: 'Strahinja', typed: '  Strahinja  ' } }))).toEqual(
      {},
    )
  })
})

describe('how long each box on the member’s own form is', () => {
  /**
   * **The numbers are the form's and are never written here**, which is the floor under this
   * list rather than a second copy of it: `registracija.form.json` is the one place a length
   * is decided, `MeWriteApi.EACH_BOX_ON_THE_FORM` holds the SERVER to that same file, and
   * this reads it through `limitOf`, which throws for a field that has no length at all.
   *
   * So what is left to measure is that every field this screen sends really has one, and that
   * the four are not quietly the same number - which is what a broken read would look like.
   */
  it('is a real number for every field the screen sends', () => {
    expect(WHAT_THIS_SCREEN_SENDS.length).toBe(4)

    for (const name of WHAT_THIS_SCREEN_SENDS) {
      expect(AS_LONG_AS_THE_FORM_ALLOWS[name], name).toBeGreaterThan(0)
    }

    expect(new Set(Object.values(AS_LONG_AS_THE_FORM_ALLOWS)).size).toBeGreaterThan(1)
  })
})

describe('the reasons these two routes can name', () => {
  /**
   * WHICH OF THE SERVER'S FILES ARE IN THIS BASE AT ALL, AND THIS IS THE FLOOR UNDER A
   * BOUNDARY RATHER THAN AN EXCUSE FOR ONE.
   *
   * <p>The screen above is written against routes that are decided and written but are not in
   * `main` yet: `PUT /api/me` grows from two fields to nine, and `PUT /api/me/password` does
   * not exist here at all. A guard wired to a file that is not there is a red gate over
   * somebody else's merge, and a guard that quietly skips it is no guard.
   *
   * <p>So the skipping is ITSELF held: the day either file lands, this list stops being right
   * and this case goes red, which is the one moment somebody has to wire the table to it. A
   * boundary that announces its own end rather than waiting to be noticed.
   */
  const NOT_IN_THIS_BASE_YET = ['MePasswordApi.java']

  it('is a list that empties itself the day those routes are merged', () => {
    expect(NOT_IN_THIS_BASE_YET.filter((file) => existsSync(join(WEB, file)))).toEqual([])
  })

  it('are every one of them carried by the screen, for the route that is here', () => {
    const named = reasonsIn('MeWriteApi.java')

    expect(named.length, 'MeWriteApi names no reason at all, so this measures nothing').toBeGreaterThan(
      0,
    )
    expect(named.filter((reason) => !Object.hasOwn(WHEN_CHANGING_MY_DATA, reason))).toEqual([])
  })

  /**
   * AND THE OTHER DIRECTION, WHICH IS WHERE THE BOUNDARY IS WRITTEN DOWN AS A NUMBER.
   *
   * <p>`pages/account/refusals.test.ts` asks this of its five routes as „the screens claim no
   * reason their route cannot answer", and the answer there is the empty list. Here it cannot
   * be, because five of the eight reasons this table carries belong to the widened route.
   * Naming them makes the claim checkable: the day `MeWriteApi` names them, this list must be
   * emptied by hand, and until then nothing else can creep in beside them.
   */
  it('claims only what that route answers, beside the five its widening brings', () => {
    const named = new Set(reasonsIn('MeWriteApi.java'))

    expect(Object.keys(WHEN_CHANGING_MY_DATA).filter((reason) => !named.has(reason)).sort()).toEqual([
      'aFieldIsBlank',
      'aFieldIsTooLong',
      'onlyAnAdministratorChangesThese',
      'theTownIsNotKnown',
      'theTownIsNotSaidOnce',
    ])
  })

  /**
   * The password route is not in this base, so what CAN be held about it is held: that every
   * sentence it points at is really in the dictionary. A key that is not there reaches a reader
   * as the key itself, printed.
   */
  it('each point at a sentence the dictionary really has', () => {
    const words: Record<string, unknown> = sr

    for (const key of [
      ...Object.values(WHEN_CHANGING_MY_DATA),
      ...Object.values(WHEN_CHANGING_MY_PASSWORD),
    ]) {
      const [section, name] = key.split('.')
      const inside = words[section ?? '']

      expect(typeof inside === 'object' && inside !== null && Object.hasOwn(inside, name ?? ''), key).toBe(
        true,
      )
    }
  })

  it('name three for the password, which is what that route answers', () => {
    expect(Object.keys(WHEN_CHANGING_MY_PASSWORD).sort()).toEqual([
      'theFormIsNotComplete',
      'theOldPasswordIsWrong',
      'thePasswordHasLeaked',
    ])
  })
})

describe('telling the server to change something', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
    forgetEveryCookie()
  })

  /**
   * THE CASE THIS FUNCTION EXISTS FOR, AND IT IS A REPLACEMENT OF THE SOURCE RATHER THAN A
   * DELETION.
   *
   * <p>`PUT /api/me` answers <b>200</b> with the member's record as it now stands, and
   * `askTheServer` - the function this one stands beside - reads only 204 and 201 as done.
   * Sent that way, a change that WAS SAVED came back `{got:'wrong', status:200}` and the
   * member was told it was not kept.
   *
   * <p>The mutation that proves it is not „take the 200 branch out" (which fails loudly) but
   * „send this through `askTheServer` instead", which is the wrong that was there to be made.
   */
  it('reads the 200 that carries the saved record as done', async () => {
    ;({ stop } = serverThat((path) => (path === '/api/me' ? answeredWith(200) : null)))

    expect(await tellTheServer('/api/me', { phone: '065' }, 'PUT')).toEqual({ got: 'done' })
  })

  it('reads the 204 the password route answers as done', async () => {
    ;({ stop } = serverThat((path) => (path === '/api/me/password' ? answeredWith(204) : null)))

    expect(await tellTheServer('/api/me/password', {}, 'PUT')).toEqual({ got: 'done' })
  })

  it('carries the reason a 400 named', async () => {
    ;({ stop } = serverThat((path) => (path === '/api/me' ? refused('aFieldIsBlank') : null)))

    expect(await tellTheServer('/api/me', {}, 'PUT')).toEqual({
      got: 'refused',
      reason: 'aFieldIsBlank',
    })
  })

  /** 409 is what a biography already waiting is answered with, and it carries a name too. */
  it('carries the reason a 409 named, exactly as it carries a 400’s', async () => {
    ;({ stop } = serverThat((path) =>
      path === '/api/me' ? refused('aTextAlreadyWaits', 409) : null,
    ))

    expect(await tellTheServer('/api/me', {}, 'PUT')).toEqual({
      got: 'refused',
      reason: 'aTextAlreadyWaits',
    })
  })

  it('says a refusal carrying no reason by its number instead', async () => {
    ;({ stop } = serverThat((path) => (path === '/api/me' ? answeredWith(400) : null)))

    expect(await tellTheServer('/api/me', {}, 'PUT')).toEqual({ got: 'wrong', status: 400 })
  })

  it('tells a token that did not match apart from everything else', async () => {
    ;({ stop } = serverThat((path) => (path === '/api/me' ? answeredWith(403) : null)))

    expect(await tellTheServer('/api/me', {}, 'PUT')).toEqual({ got: 'rejected' })
  })

  it('says the number of any other answer rather than guessing at it', async () => {
    ;({ stop } = serverThat((path) => (path === '/api/me' ? answeredWith(404) : null)))

    expect(await tellTheServer('/api/me', {}, 'PUT')).toEqual({ got: 'wrong', status: 404 })
  })

  it('says so plainly when there was no answer at all', async () => {
    ;({ stop } = serverThat(() => {
      throw new Error('no connection')
    }))

    expect(await tellTheServer('/api/me', {}, 'PUT')).toEqual({ got: 'nothing' })
  })

  /**
   * THE VERB, THE ADDRESS AND THE BODY, measured off what was really asked.
   *
   * <p>Without this the whole file passes over a function that sent a POST to the wrong
   * address with an empty body, because every case above only ever looks at what came back.
   */
  it('sends what it was given, to the address it was given, under the verb it was given', async () => {
    let asked: { path: string; init: RequestInit | undefined }[] = []
    ;({ stop, asked } = serverThat((path) => (path === '/api/me' ? answeredWith(200) : null)))

    await tellTheServer('/api/me', { firstName: 'Strahinje' }, 'PUT')

    const sent = asked.find((one) => one.path === '/api/me')

    expect(sent?.init?.method).toBe('PUT')
    expect(sent?.init?.body).toBe(JSON.stringify({ firstName: 'Strahinje' }))
  })

  /**
   * The token is fetched off an open route when the browser holds none, and echoed in the
   * header the server wants it back in. `askTheServer` says at length why it is echoed
   * character for character; this measures that the appended function does it too, because a
   * copy that quietly forgot the header would be a door nobody can open.
   */
  it('is handed a token first and echoes it back', async () => {
    forgetEveryCookie()

    let asked: { path: string; init: RequestInit | undefined }[] = []
    ;({ stop, asked } = serverThat((path) => {
      if (path === '/api/countries') {
        document.cookie = 'XSRF-TOKEN=a-token'

        return new Response('[]', { status: 200 })
      }

      return path === '/api/me' ? answeredWith(200) : null
    }))

    await tellTheServer('/api/me', {}, 'PUT')

    expect(asked.map((one) => one.path)).toEqual(['/api/countries', '/api/me'])

    const headers = asked.find((one) => one.path === '/api/me')?.init?.headers as Record<string, string>

    expect(headers['X-XSRF-TOKEN']).toBe('a-token')
  })
})
