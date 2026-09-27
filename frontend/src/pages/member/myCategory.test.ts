import { describe, expect, it } from 'vitest'
import { serverThat } from '../../test/serverAnswers'
import {
  categoryIn,
  MY_CATEGORY,
  tellTheServerMyCategory,
  whatCategoryTheServerSaysIChose,
} from './myCategory'
import { first } from '../../test/at'

/**
 * WHAT COUNTS AS AN ANSWER FROM `GET /api/me/category`, AND WHAT DOES NOT.
 *
 * <p>The whole of the member's box is drawn off this, so the thing worth measuring is not the
 * happy path - the screen's own cases walk that - but the refusals. Every one of them is the
 * same outcome on purpose (`null`, which the screen draws as no box), and that is exactly why
 * each has to be measured separately: folded into one answer, five different faults look
 * alike, and a version that stopped checking one of them would pass every case about the
 * other four.
 */
describe('what the server says about my category', () => {
  const COMPLETE = {
    season: 2028,
    firstSeason: true,
    firstSeasonAllowed: false,
    category: 'M40-54',
    open: true,
  }

  it('reads the five fields off a complete answer', async () => {
    const { stop } = serverThat((path) =>
      path === MY_CATEGORY
        ? new Response(JSON.stringify(COMPLETE), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : null,
    )

    try {
      /* Compared whole rather than field by field, so a reader that dropped one, or invented
         a sixth, is a failure here and not a surprise on a screen. */
      expect(await whatCategoryTheServerSaysIChose()).toEqual(COMPLETE)
    } finally {
      stop()
    }
  })

  it('asks the one address both verbs use', async () => {
    const { asked, stop } = serverThat(() => new Response(JSON.stringify(COMPLETE), { status: 200 }))

    try {
      await whatCategoryTheServerSaysIChose()

      expect(first(asked).path).toBe('/api/me/category')
      /* No method, which is what a read is, and no token: `ApiSecurity` guards what changes
         something, and `askTheServer` would fetch a cookie this call does not want. */
      expect(first(asked).init).toBeUndefined()
    } finally {
      stop()
    }
  })

  /**
   * FIVE WAYS TO GET NOTHING, EACH MEASURED ON ITS OWN.
   *
   * 401 is a visitor, 404 an account that does not race, 500 a portal that is broken, a
   * throwing `fetch` is no server at all, and a body that is not JSON is a proxy answering in
   * its own words. The screen draws the same thing for all five, which is written down in
   * `myCategory.ts` as a decision rather than left to be inferred.
   */
  it.each([
    ['a visitor', () => new Response(null, { status: 401 })],
    ['an account that does not race', () => new Response(null, { status: 404 })],
    ['a portal that is broken', () => new Response(null, { status: 500 })],
    ['a body that is not JSON', () => new Response('not json', { status: 200 })],
    [
      'no server at all',
      () => {
        throw new TypeError('failed to fetch')
      },
    ],
  ])('answers nothing for %s', async (_what, answering) => {
    const { stop } = serverThat(() => answering())

    try {
      expect(await whatCategoryTheServerSaysIChose()).toBeNull()
    } finally {
      stop()
    }
  })

  it('answers nothing where the answer is JSON but not a category', async () => {
    const { stop } = serverThat(
      () => new Response(JSON.stringify({ season: 2028 }), { status: 200 }),
    )

    try {
      expect(await whatCategoryTheServerSaysIChose()).toBeNull()
    } finally {
      stop()
    }
  })

  /**
   * ONE FIELD WRONG AT A TIME, AND THE FIELD IS TAKEN OFF THE COMPLETE ANSWER.
   *
   * Walked over the KEYS of a body that works rather than over a list written here: a sixth
   * field arriving tomorrow is a case the day it is added, and there is no list to go short.
   *
   * <p><b>Two wrong values per field, and both are wrong for ALL FIVE types.</b> `null` is what
   * a column that went nullable sends, and `{}` is what a field that grew into an object sends.
   * A value wrong for only some of the fields would have been worse than useless here: written
   * as a string it passed for `category`, which is a string, and the case said the reader was
   * missing a check it really makes.
   */
  it.each(Object.keys(COMPLETE))('answers nothing where %s is of the wrong type', (field) => {
    expect(categoryIn({ ...COMPLETE, [field]: null })).toBeNull()
    expect(categoryIn({ ...COMPLETE, [field]: {} })).toBeNull()
  })

  it.each([
    ['nothing at all', null],
    ['a number', 7],
    ['a string', 'M R'],
    ['a list', []],
  ])('answers nothing where the body is %s', (_what, body) => {
    expect(categoryIn(body)).toBeNull()
  })

  /**
   * THE WRITE GOES OUT AS A PUT CARRYING THE ONE FIELD, UNDER THE NAME THE ROUTE READS.
   *
   * Both values, because the way BACK is the half a screen loses: a route asked only ever to
   * turn the wish on would pass a case that only ever sends true. The name is asserted
   * literally - `MeCategoryWriteApi.Wish` reads `firstSeason`, and a body under any other name
   * is answered `theFormIsNotComplete` by a server that looks like it is working.
   */
  it.each([true, false])('sends the wish as %s', async (wish) => {
    const { asked, stop } = serverThat(() => new Response(null, { status: 204 }))

    try {
      await tellTheServerMyCategory(wish)

      const wrote = first(asked.filter((one) => one.init?.method === 'PUT'))

      expect(wrote.path).toBe('/api/me/category')
      expect(JSON.parse(String(wrote.init?.body))).toEqual({ firstSeason: wish })
    } finally {
      stop()
    }
  })
})
