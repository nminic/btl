import { describe, expect, it } from 'vitest'
import { addressOf, arrivedResource, clearResourceCache, loadResource } from './client'
import { serverThat } from '../test/serverAnswers'

/**
 * ONE MEMBER'S ANSWER OF A NAME IN THE VISIT'S CACHE (`client.ts`, `ONE_MEMBERS_DOORS`; inkrement
 * „Poboljšanje performansi”, korak 1).
 *
 * <p>THE AXES. The member asked for against another member, so an answer kept under the name alone would
 * hand the second the first's runs; the name that is dropped against the names that are not, so a drop
 * that reached everybody's answers would pass as one that reaches his; the scored door against the
 * unscored, because a drop of `results` drops `unscored-results` with it (`GO_WITH`) and the reverse is
 * not said.
 */
describe("one member's answer of a name", () => {
  it('lives at his own address, and the league keeps its own', () => {
    expect(addressOf('results', undefined, '000002')).toBe('/api/competitors/000002/results')
    expect(addressOf('unscored-results', undefined, '000002')).toBe('/api/competitors/000002/unscored-results')
    expect(addressOf('results')).toBe('/api/results')
  })

  it('is asked once per member and held for each, apart from the league and from the other member', async () => {
    const server = serverThat(() => null)

    try {
      const his = await loadResource<unknown[]>('results', undefined, '000002')
      await loadResource<unknown[]>('results', undefined, '000002')
      const another = await loadResource<unknown[]>('results', undefined, '000001')

      expect(server.asked.map((one) => one.path)).toEqual([
        '/api/competitors/000002/results',
        '/api/competitors/000001/results',
      ])
      expect(arrivedResource('results', undefined, '000002')).toBe(his)
      expect(arrivedResource('results', undefined, '000001')).toBe(another)
      expect(his).not.toEqual(another)
      expect(arrivedResource('results'), 'his answer was kept as the whole league').toBeUndefined()
    } finally {
      server.stop()
    }
  })

  it('goes with the name: a drop of the scored runs takes every member of both doors, and nothing else does', async () => {
    const server = serverThat(() => null)

    try {
      await loadResource('results', undefined, '000002')
      await loadResource('results', undefined, '000001')
      await loadResource('unscored-results', undefined, '000002')

      clearResourceCache('teams')

      expect(arrivedResource('results', undefined, '000002'), 'a drop of another name took his runs').toBeDefined()

      clearResourceCache('unscored-results')

      expect(arrivedResource('unscored-results', undefined, '000002')).toBeUndefined()
      expect(
        arrivedResource('results', undefined, '000002'),
        'a drop of the unscored runs took his scored ones, which GO_WITH does not say',
      ).toBeDefined()

      await loadResource('unscored-results', undefined, '000002')
      clearResourceCache('results')

      expect(arrivedResource('results', undefined, '000002')).toBeUndefined()
      expect(arrivedResource('results', undefined, '000001')).toBeUndefined()
      expect(arrivedResource('unscored-results', undefined, '000002')).toBeUndefined()

      const before = server.asked.length

      await loadResource('results', undefined, '000002')

      expect(server.asked.slice(before).map((one) => one.path), 'a dropped answer was not asked for again').toEqual([
        '/api/competitors/000002/results',
      ])
    } finally {
      server.stop()
    }
  })

  it('is dropped with everything else on a full clear', async () => {
    await loadResource('results', undefined, '000002')

    clearResourceCache()

    expect(arrivedResource('results', undefined, '000002')).toBeUndefined()
  })
})
