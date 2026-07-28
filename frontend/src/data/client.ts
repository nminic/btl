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

async function request<T>(name: ResourceName): Promise<T> {
  const response = await fetch(`${BASE}/${name}.json`)

  if (!response.ok) {
    throw new Error(`Cannot load ${name}: ${response.status}`)
  }

  return (await response.json()) as T
}

/* One request per resource per visit. Without this every screen change fetches
 * and parses the whole result set again, and on QA the no-store header means
 * the browser cannot help either. The promise is cached rather than the value,
 * so two screens mounting at once share a single request.
 *
 * A failure is not cached: it is dropped so the next attempt can succeed. */
const inFlight = new Map<ResourceName, Promise<unknown>>()

export function loadResource<T>(name: ResourceName): Promise<T> {
  const cached = inFlight.get(name)

  if (cached !== undefined) {
    return cached as Promise<T>
  }

  const promise = request<T>(name).catch((error: unknown) => {
    inFlight.delete(name)
    throw error
  })

  inFlight.set(name, promise)

  return promise as Promise<T>
}

/** Tests start from an empty cache; nothing in the application calls this. */
export function clearResourceCache(): void {
  inFlight.clear()
}
