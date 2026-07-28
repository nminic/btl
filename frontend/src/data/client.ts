/* The only module that knows where data comes from.
 *
 * Today it reads generated JSON from src/mock. When the backend exists this
 * file starts calling /api and nothing else in the application changes. That
 * is the whole point of it: no component ever imports a mock file, and no
 * component ever calls fetch.
 */

import competitors from '../mock/competitors.json'
import events from '../mock/events.json'
import leagues from '../mock/leagues.json'
import races from '../mock/races.json'
import results from '../mock/results.json'
import teams from '../mock/teams.json'

const MOCK_DATA = {
  competitors,
  events,
  leagues,
  races,
  results,
  teams,
} as const

export type ResourceName = keyof typeof MOCK_DATA

export function loadResource<T>(name: ResourceName): Promise<T> {
  const data = MOCK_DATA[name] as T | undefined

  if (data === undefined) {
    return Promise.reject(new Error(`Unknown resource: ${name}`))
  }

  return Promise.resolve(data)
}
