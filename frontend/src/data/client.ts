/* The only module that knows where THE DATA comes from.
 *
 * Today it fetches generated JSON from /mock. That is the whole point of this
 * file: no screen that draws a resource calls fetch, and none of them knows that
 * mock data exists at all.
 *
 * **THIS SAID „BASE BECOMES '/api' AND NOTHING ELSE IN THE APPLICATION CHANGES"
 * UNTIL 20.09.2026, AND THAT SENTENCE WAS MEASURED AND FOUND FALSE.** It is
 * corrected here rather than left standing, because a sentence promising that the
 * switch is one constant is what somebody plans the switch by.
 *
 * ADL already corrected it twice and the correction never reached this file: once
 * on 31.07.2026 („Prelazak na `/api` nije promena te konstante"), and again on
 * 12.09.2026 („Zamena je jedna konstanta važi za šifarnike, ne za sve").
 *
 * What was measured on 20.09.2026, over all fourteen:
 *
 * All fourteen names have a GET route, which `contract.test.ts` holds. **A
 * declared address is not an answer a screen can read**, and on the morning of
 * that day none of the fourteen answered in the shape read here. Ten carried a
 * text identity in the file where the schema says `bigserial` (A36 O1);
 * `events.featured` and `races.renamed` carried „yes" and „no" where it says
 * `boolean`; `pages` was a record keyed by address here and a list there;
 * `verification` was one flat list here and a list of queues there. And five
 * resources answer with fewer fields than the screens read: `competitors`
 * without `active`, `ageBand`, `membershipBasis`, `referralCode` and
 * `referredBy`, `teams` without `logo` and `organizerMemberNumber`, `pairs`
 * without `since`, `ducats` without seven of its sixteen.
 *
 * **THE SHAPES WERE CLOSED THE SAME DAY, AND THE FIELDS WERE NOT.** The owner's
 * order was „Uskladi oblike, pa polje po polje odluci": the file and the types
 * now carry the identities, the flags, the list of pages and the nothing where an
 * empty string stood, and `data/servedShape.test.ts` holds the real answer
 * against the very types the screens read it through. `verification` is the one
 * shape left, because its answer is grouped by tab and drops nine of the fields
 * that screen draws, and that is a decision rather than an alignment.
 *
 * **What still stops the switch is the fields, and no backend work brings them
 * back here:** P-javno, 13.09.2026, puts everything Article 73 does not list
 * behind a resource that knows who is asking, and that resource does not exist
 * yet. So A50's own condition is not met, and switching today is not a half-empty
 * QA - which is the cost A50 accepted - but a broken one. The measured example
 * that still stands: `profile/visible.ts` reads `competitor.active`, which would
 * arrive undefined and turn every profile invisible. The one beside it no longer
 * does: `usePages` read a record keyed by address until 20.09.2026 and reads the
 * list the server answers with since.
 *
 * **This said „no component calls fetch" until 19.09.2026, and that sentence is
 * corrected here rather than left to be walked past.** `pages/account` speaks to
 * `/api` directly: it spends a link out of a message on `/api/password-reset` and
 * `/api/email-confirmation`, which are writes rather than resources and have no
 * mock of themselves to read. Nothing about the sentence above moved with it -
 * no resource was added to the list below, BASE is untouched, and ADL A50 („mock
 * se gasi tek kad sve bude gotovo, odjednom a ne resurs po resurs") is the same
 * day's work as it was the day before.
 *
 * **And on 20.09.2026 signing in joined them, on exactly the same ground.**
 * `session/theServer.ts` speaks to `/api/sign-in`, `/api/sign-out` and `/api/me`:
 * two writes and the question of who is asking. None of the three is a resource,
 * none has a mock of itself, and the list below is again untouched. What moved
 * with it is one thing and it is about this file rather than about the mock: the
 * role a screen draws itself by no longer comes from a control in the header but
 * from the server, so the portal now has a session that outlives a refresh while
 * its data still comes off the disc.
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
  'pairs',
  /* Every town in the region from five hundred people up, and every town in the
     world from fifteen thousand up, with the country each belongs to (owner,
     10.08.2026). The codebook is 1200 KB, which is why it is a resource and not
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
 * silence. Left visible, named, and refused by default.
 *
 * **This promised that the day the backend arrived and the shapes were known by
 * name, this was the place that changed. That day came on 20.09.2026 and the
 * three stay, so the promise is replaced by what was measured.** Naming a shape
 * here would mean writing down one record type per resource and reading the two
 * caches by that name rather than by the caller's `T`, which is a change of its
 * own size and is written out below. What the shapes being closed changed is that
 * such a name would now be TRUE; it was not before, and that is why the first of
 * the two things this was waiting for is done.
 *
 * So what has to happen first is no longer both. The screens have come to the
 * shapes the schema serves; what is left is a resource that knows who is asking,
 * answering for the fields Article 73 keeps back (P-javno, 13.09.2026). On the
 * day after that one, this is still the place that changes.
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
