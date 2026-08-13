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
  /* Who has said they are going to which event (owner, 11.08.2026). Its own
     record and not a list on the event: it is written by members and read by
     members, and an event is written by administration. */
  'attendance',
  'ducats',
  /* What members wrote about an event, after a moderator let it out (owner,
     06.08.2026). Its own record and not the queue it came through: the queue is
     what is waiting, and reading a published comment out of it would mean every
     screen that draws comments has to know what "decided" means. */
  'comments',
  'competitors',
  'events',
  'leagues',
  'moderators',
  'pages',
  /* Every town in the region from five hundred people up, and every town in the
     world from fifteen thousand up, with the country each belongs to (owner,
     10.08.2026). Nine hundred kilobytes, which is why it is a resource and not
     an import: it is asked for when somebody starts typing a place, and on no
     other screen. */
  'places',
  'races',
  'results',
  'teams',
  'verification',
] as const

export type ResourceName = (typeof RESOURCE_NAMES)[number]

async function request<T>(name: ResourceName): Promise<T> {
  const response = await fetch(`${BASE}/${name}.json`)

  if (!response.ok) {
    throw new Error(`Cannot load ${name}: ${response.status}`)
  }

  /* Written out rather than left to `json()`, which is typed `Promise<any>` and
     would carry the same claim into `T` with nothing said. That is worse than
     the assertion, not better: the linter cannot see a type, so an `any` here
     would be the one lie on the portal that nothing reports. This is the third
     of the named places below, and it goes when the answers have a known shape.
  */
  // oxlint-disable-next-line typescript/consistent-type-assertions
  return (await response.json()) as T
}

/* One request per resource per visit. Without this every screen change fetches
 * and parses the whole result set again, and on QA the no-store header means
 * the browser cannot help either. The promise is cached rather than the value,
 * so two screens mounting at once share a single request.
 *
 * A failure is not cached: it is dropped so the next attempt can succeed. */
const inFlight = new Map<ResourceName, Promise<unknown>>()

/* What has already arrived, kept beside the promise that fetched it.
 *
 * A promise cannot be read while a component renders, so a screen opened for the
 * second time still had to start empty and fill a moment later. That is not only
 * a flash: the reader who goes back to a table they had scrolled halfway down
 * lands on a page that is one loading box tall at the moment the router puts the
 * scroll back, so the browser has nowhere to scroll to and the position is lost
 * (owner, 04.08.2026). The value is what makes the second visit whole from the
 * first paint. */
const arrived = new Map<ResourceName, unknown>()

/*
 * The two assertions below, with the one in `request` above, are three of the
 * four left under `src/` (ADL A14 bans them, and the linter refuses them
 * everywhere else; the fourth is in `pages/admin/entityForms.ts`).
 *
 * They are here because the two caches are one store holding twelve different
 * shapes, keyed by name, and what a name is worth is decided by the caller.
 * TypeScript has no way to say that: a map's value type is one type, so what
 * comes back out is `unknown` and the caller's `T` has to be put back on it.
 *
 * Not written round with `any`, which would let the same claim through in
 * silence. Left visible, named, and refused by default, so the day the backend
 * arrives and the shapes are known by name this is the place that changes.
 *
 * `arrivedResource` is the one of the three that a table of shapes by resource
 * name would actually remove, because an object typed `{ [K in ResourceName]?:
 * Shapes[K] }` reads and writes by key without a claim. It is left as it is
 * because the signature would then be keyed by name rather than by the caller's
 * `T`, and `useResource` and every one of its callers would have to follow; a
 * change of that size is its own PR. `loadResource` would not fall out even
 * then: the stored value wraps the indexed type in a promise, and TypeScript
 * refuses the correlated write.
 */
export function loadResource<T>(name: ResourceName): Promise<T> {
  const cached = inFlight.get(name)

  if (cached !== undefined) {
    // oxlint-disable-next-line typescript/consistent-type-assertions
    return cached as Promise<T>
  }

  const promise = request<T>(name)
    .then((data) => {
      arrived.set(name, data)

      return data
    })
    .catch((error: unknown) => {
      inFlight.delete(name)
      throw error
    })

  inFlight.set(name, promise)

  return promise
}

/**
 * What this visit already holds for a resource, or nothing where it holds none.
 *
 * Read while rendering, which is the whole point of it: absence here means the
 * screen has to wait, and that is a fact about the visit rather than a failure.
 */
export function arrivedResource<T>(name: ResourceName): T | undefined {
  const known = arrived.get(name)

  // oxlint-disable-next-line typescript/consistent-type-assertions
  return known === undefined ? undefined : (known as T)
}

/** Tests start from an empty cache; nothing in the application calls this. */
export function clearResourceCache(): void {
  inFlight.clear()
  arrived.clear()
}
