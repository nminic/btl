/* The only module that knows where THE DATA comes from.
 *
 * **SINCE 21.09.2026 IT FETCHES `/api`, AND THAT IS THE WHOLE OF THE SWITCH THIS
 * FILE EXISTED TO WAIT FOR.** No screen that draws a resource calls fetch, and none
 * of them knows where the answer came from; that is what made one constant enough
 * to move fourteen resources at once, which is what ADL A50 asks for („gasi se
 * odjednom, a ne resurs po resurs").
 *
 * **AND „ONE CONSTANT AND NOTHING ELSE" WAS STILL FALSE, which is why this file
 * spent a month saying so.** What moved with the constant is written down here
 * rather than left to be rediscovered, because a sentence promising the switch is
 * one line is what somebody plans the next one by:
 *
 * <ul>
 * <li>`.json` came off the address. A resource is asked for by name now, and the
 * answer's sort is the server's business.</li>
 * <li>Three fields the answer has not got left the types: `competitor.active`
 * entirely, `pairs.since` entirely, and `team.crop` gained a nothing. Two more
 * became conditional, `membershipBasis` and `referralCode`, because the answer
 * carries them to the administration and to the caller's own row and to nobody
 * else.</li>
 * <li>Two questions changed shape rather than losing a field. „Is this member
 * active" became „is this member on the list", because the server does not answer
 * for one whose fee has lapsed. And „who administers this team" became „did the
 * reader found it" (`data/teamAdmin.ts`), because the seat leaves only to the
 * administration.</li>
 * <li>One count moved to the server whole: how many members somebody brought in was
 * counted here over a field (`referredBy`) that is a KEY on the server and is
 * answered to nobody, so it arrives as `referredCount` instead.</li>
 * </ul>
 *
 * **What was measured on 20.09.2026, and is kept here because it is the record of
 * why this took two more days.** All fourteen names had a GET route, which
 * `contract.test.ts` holds, and **a declared address is not an answer a screen can
 * read**: on the morning of that day none of the fourteen answered in the shape read
 * here. Ten carried a text identity where the schema says `bigserial` (A36 O1);
 * `events.featured` and `races.renamed` carried „yes" and „no" where it says
 * `boolean`; `pages` was a record keyed by address here and a list there. The shapes
 * were closed that day and the FIELDS were not, and the owner's order was „Uskladi
 * oblike, pa polje po polje odluci". The fields were decided one by one over the two
 * days after it, through PRs 327 to 334, and this is the day after the last of them.
 *
 * **That one shape WAS `verification`, and it reached the owner as a crash before it
 * reached anybody as a decision (22.09.2026).** What stood here said it „answers
 * grouped by queue and carries nine fields fewer than the screen draws, and its shape
 * is a decision the owner has not taken". Both halves were true and naming them was
 * not enough: grouped, each `{queue, waiting}` wrapper passed this portal's own filter
 * for an item - it has a `queue`, and `decisions[undefined]` is undefined - so the
 * Timovi tab drew a wrapper as though it were an item and threw on `undefined.trim()`.
 * The answer is a flat list of `PendingItem` now, like the other thirteen, and the
 * shape is measured rather than named: `servedShape.test.ts` has no resource left in
 * its `notSeen` list. The fields it still does not carry are in `PENDING.md`, each
 * with the table that has nowhere to hold it.
 *
 * **Two more things speak to `/api` and are not resources, and that has been true
 * since before the switch.** `pages/account` spends a link out of a message on
 * `/api/password-reset` and `/api/email-confirmation`, and `session/theServer.ts`
 * on `/api/sign-in`, `/api/sign-out` and `/api/me`. Those are writes, and the
 * question of who is asking; none of them has a shape on the list below, and none of
 * them goes through the cache.
 *
 * The files are served rather than imported so a million and a half bytes of
 * results stay out of the JavaScript bundle, and so the screens go through a
 * real request with a real loading state.
 */

const BASE = '/api'

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
  const response = await fetch(`${BASE}/${name}`)

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
 * **And both of the things it was waiting for have now happened, so what is left
 * owing is this and nothing else.** The screens came to the shapes on 20.09.2026,
 * and the resources that know who is asking arrived over the two days after
 * (P-javno, 13.09.2026, and PRs 330 to 334). The switch above is done and the three
 * assertions are still here, which is the measurement rather than the plan: naming
 * a shape per resource is a change of its own size and nothing about it got easier
 * or harder on the day `BASE` moved.
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
