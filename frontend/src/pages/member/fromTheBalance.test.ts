import { afterEach, describe, expect, it } from 'vitest'
import { arrivedResource, loadResource } from '../../data/client'
import { first } from '../../test/at'
import { componentsOf } from '../../test/javaRecords'
import { answeredWith, refused, serverThat } from '../../test/serverAnswers'
import { letInBy, theServerWasAskedToLetMeIn } from './fromTheBalance'

/**
 * WHAT `POST /api/me/membership` IS SENT, AND WHAT COUNTS AS ITS ANSWER.
 *
 * <p>The screen's own cases (`letMeIn.test.tsx`) stand on a server that answers properly. These are the
 * halves that cannot be seen from the screen: the exact verb and address, that nothing about any member
 * is in the request, which resource is dropped and on which answer, and the narrowing of the answer
 * itself, each refusal of it on its own.
 */

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

const letIn = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 201, headers: { 'content-type': 'application/json' } })

describe('the press', () => {
  it('is a POST to the address the read uses, and names nobody', async () => {
    const server = serverThat((path, init) =>
      path === '/api/me/membership' && init?.method === 'POST' ? letIn({ season: 2027, memberNumber: '000032' }) : null,
    )

    stops.push(server.stop)

    expect((await theServerWasAskedToLetMeIn()).got).toBe('done')

    const sent = server.asked.filter((one) => one.init?.method === 'POST')

    expect(sent).toHaveLength(1)
    expect(first(sent).path).toBe('/api/me/membership')
    expect(first(sent).init?.body).toBe('{}')
  })

  /* `competitors` answers `where c.active`, and being let in is what makes him active, so a list held
     from before would go on leaving him out of it. A refusal changed nothing, so it drops nothing. */
  it.each([
    ['drops the list of members where he was let in', () => letIn({ season: 2027, memberNumber: '000032' }), false],
    ['keeps it where he was refused', () => refused('theBalanceDoesNotCoverTheFee', 409), true],
    ['keeps it where the server failed', () => answeredWith(500), true],
  ])('%s', async (_what, answer, kept) => {
    const server = serverThat((path, init) =>
      path === '/api/me/membership' && init?.method === 'POST' ? answer() : null,
    )

    stops.push(server.stop)
    await loadResource('competitors')

    expect(arrivedResource('competitors')).not.toBeUndefined()

    await theServerWasAskedToLetMeIn()

    expect(arrivedResource('competitors') !== undefined).toBe(kept)
  })
})

describe('the answer, narrowed by looking at it', () => {
  it('reads the season and the number', () => {
    expect(letInBy({ season: 2028, memberNumber: '000077', fromTheBalance: {} })).toEqual({
      season: 2028,
      memberNumber: '000077',
    })
  })

  it.each([
    ['nothing at all', null],
    ['a number', 7],
    ['no season', { memberNumber: '000077' }],
    ['a season that is not a whole number', { season: 2027.5, memberNumber: '000077' }],
    ['a season that is a string', { season: '2027', memberNumber: '000077' }],
    ['no number', { season: 2027 }],
    ['a number that is a number', { season: 2027, memberNumber: 77 }],
  ])('is nothing for %s', (_what, body) => {
    expect(letInBy(body)).toBeNull()
  })

  /* THE SPOJ BETWEEN THE TWO SIDES IS THE NAME: each name read here is a component of the record the
     route answers with, so a rename on the server fails here and not on a screen that quietly says no
     season. */
  it('reads only names the Java record declares', () => {
    const declared = componentsOf('Activated', 'MyMembershipWriteApi.java')

    expect(declared).toContain('season')
    expect(declared).toContain('memberNumber')
    expect(Object.keys(letInBy({ season: 2027, memberNumber: '000032' }) ?? {}).sort()).toEqual(
      ['memberNumber', 'season'].filter((name) => declared.includes(name)),
    )
  })
})
