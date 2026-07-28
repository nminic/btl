/* The only module that knows where data comes from.
 *
 * Today it fetches generated JSON from /mock. When the backend exists, BASE
 * becomes '/api' and nothing else in the application changes. That is the whole
 * point of this file: no component calls fetch, and no component knows that
 * mock data exists at all.
 *
 * The files are served rather than imported so a million and a half bytes of
 * results stay out of the JavaScript bundle, and so the screens go through a
 * real request with a real loading state.
 */

const BASE = '/mock'

export const RESOURCE_NAMES = [
  'competitors',
  'events',
  'leagues',
  'races',
  'results',
  'teams',
] as const

export type ResourceName = (typeof RESOURCE_NAMES)[number]

export async function loadResource<T>(name: ResourceName): Promise<T> {
  const response = await fetch(`${BASE}/${name}.json`)

  if (!response.ok) {
    throw new Error(`Cannot load ${name}: ${response.status}`)
  }

  return (await response.json()) as T
}
