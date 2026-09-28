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
 * The answer is a flat list now, like the other thirteen, and the shape is measured
 * rather than named: `servedShape.test.ts` has no resource left in its `notSeen` list.
 * A list of `ServedPendingItem` and not of `PendingItem`, which is a distinction worth
 * the two words: six names have no home in the schema and are filled in by
 * `pages/admin/pending.ts`, and two more arrive in another SORT - the key as a number,
 * and the member number as text or as nothing at all. The fields it still does not
 * carry are in `PENDING.md`, each with the table that has nowhere to hold it, and what
 * the screens do with the answer as it really comes is measured in
 * `data/theRealAnswer.test.tsx`.
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
  /* WHAT WAS WRITTEN TO WHOEVER IS ASKING, PLUS WHAT WAS WRITTEN TO THE WHOLE LEAGUE
     (V13: „a message may be addressed to one member or to the whole league, and EMPTY
     MEANS EVERYBODY"). The seventeenth, since 27.09.2026, and the third name here that
     was ANSWERED long before it was ever asked for: `GET /api/inbox` has served this
     since `InboxApi` went in, and the three screens that draw a message read a list the
     browser itself was holding instead.

     **What that cost is the whole reason for this name, and it was measured on the owner
     rather than reasoned about.** He refused a photograph with a reason on 27.09.2026,
     the message arrived, he signed out and in, and IT WAS GONE. Seven places in six classes
     write into `message` on the server - the decision he took is one of them
     (`VerificationWriteApi.tell`) - so what he was shown was never the row the server
     had kept. It was the browser's own copy, held in `useState`, and a copy in a
     component dies with the component.

     THE ONE NAME ON THIS LIST WHOSE ANSWER IS DIFFERENT FOR EVERY CALLER, and the cache
     above is keyed by name with nobody in the key. That is safe for exactly as long as a
     visit is one person, AND A VISIT IS NOT ONE PERSON: measured 27.09.2026, signing out and
     signing back in happen IN PLACE - `AccountMenu` calls `signOutOfTheServer()` and
     `signOut()`, `SignIn` calls `signInWith` and `navigate`, and not one of the four reloads
     anything. So this name is dropped from the cache the moment the caller changes, which is
     `theInboxNowBelongsTo` in `data/useResource.ts`, and that is the one thing on this list
     that a name in the key would otherwise have had to buy. */
  'inbox',
  'leagues',
  'moderators',
  'pages',
  'pairs',
  /* Whoever is not a member for the season being paid for: a DERIVED list and never a
     queue (owner, 27.09.2026, PDL section 15). Nothing writes it and nothing triggers
     it - paying happens entirely outside the portal, the bank shows the owner, and the
     portal learns of it only when a moderator says so. A row leaves this list by the
     membership being written rather than by anybody recording a decision, which is why
     the screen clears this name after a write goes through and reads it again.

     THE SIXTEENTH, AND THE ONE WHOSE ROUTE TAKES A PARAMETER THIS PORTAL NEVER SENDS.
     `GET /api/payments` accepts `?search=`, and the screen filters the answer itself
     instead (`admin/paymentSearch.ts` says which of the two decides and why). A cache
     keyed by name is the reason it has to: `loadResource` holds one promise per name
     with no parameter in the key, so a narrowed answer stored under this name would be
     handed back to the next reader who asked for the whole list. */
  'payments',
  /* Every town in the region from five hundred people up, and every town in the
     world from fifteen thousand up, with the country each belongs to (owner,
     10.08.2026). The codebook is 1200 KB, which is why it is a resource and not
     an import: it is asked for when somebody starts typing a place, and on no
     other screen. */
  'places',
  /* What membership costs, and when each price is the one in force (owner, 04.08.2026:
     „cene su javne u Clanu 14 Pravilnika"). The fifteenth, since 26.09.2026, and the one
     resource that was already answered while nothing read it: `/api/pricing` has served
     `price_row` since the codebooks went in, and the three screens that quote a price read
     a constant compiled into the bundle instead. What that cost is the boundary
     `PricingWriteApi` names in its own heading - an administrator raised a price through
     the route and the page a member reads, together with the QR code he scans, went on
     carrying the old number. */
  'pricing',
  'races',
  'results',
  'teams',
  'verification',
] as const

export type ResourceName = (typeof RESOURCE_NAMES)[number]

/**
 * What the server calls the parameter, held once so the address and every case that reads it
 * are one text rather than two that have to be kept equal.
 *
 * <p>It is `lang` while the column behind it is `language`, and that is deliberate on the
 * server's side too ({@code PageApi.THE_LANGUAGE_ASKED_FOR}): the parameter is named for the
 * `lang` attribute a screen reader reads, and the column is named for the thing it holds.
 */
const THE_LANGUAGE_ASKED_FOR = 'lang'

/**
 * THE ADDRESS OF A RESOURCE, AND THE ONE PLACE THAT KNOWS HOW A LANGUAGE GETS INTO IT.
 *
 * <p>Read by all four of {@link request}, {@link loadResource}, {@link arrivedResource} and
 * {@link clearResourceCache}, so those four cannot disagree about what the address is. That
 * is the whole reason it exists as a function: the two caches below are keyed by what comes
 * out of here, so a fetch that built its address one way and a cache that built it another
 * would hand one language's answer to the other reader and nothing would say so.
 *
 * <p><b>Why the language rides in the address rather than beside it.</b> `PageApi`'s own
 * heading settles this on the server's side and this is the other half of it: „A query string
 * is part of the address, so the edge holds the two languages as two resources." Anything
 * outside the address - a header, a cookie - would have to be varied on at the edge, „što
 * ruši keširanje na ivici (ADL.md, A6)" (PDL P18). The same sentence decides the cache here:
 * two languages are two addresses, therefore two entries, and nothing has to be dropped when
 * a reader switches language.
 *
 * <p><b>The fourteen names that pass no language get back exactly the address they had
 * before</b> - `/api/<name>`, byte for byte - so nothing about them moves. This is not the
 * shape `inbox` needed and the difference is worth the sentence: that answer differs per
 * caller at ONE address, so it is dropped when the caller changes
 * (`theInboxNowBelongsTo`, `data/useResource.ts`). A written page in two languages is two
 * addresses, so there is nothing to drop.
 */
export function addressOf(name: ResourceName, language?: string): string {
  return language === undefined
    ? `${BASE}/${name}`
    : `${BASE}/${name}?${THE_LANGUAGE_ASKED_FOR}=${encodeURIComponent(language)}`
}

async function request<T>(name: ResourceName, language?: string): Promise<T> {
  const response = await fetch(addressOf(name, language))

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
 * A failure is not cached: it is dropped so the next attempt can succeed.
 *
 * **KEYED BY THE ADDRESS AND NOT BY THE NAME SINCE 28.09.2026**, which is what let one name
 * answer in two languages. Keyed by name, `/en/uslovi-koriscenja` was served whatever
 * `/sr/uslovi-koriscenja` had already fetched: measured before the change, switching the
 * language on a written page made NO new request and left the Serbian text on screen. The key
 * comes out of {@link addressOf} and out of nowhere else, so what is fetched and what is
 * stored cannot drift apart. */
const inFlight = new Map<string, Promise<unknown>>()

/* What has already arrived, kept beside the promise that fetched it.
 *
 * A promise cannot be read while a component renders, so a screen opened for the
 * second time still had to start empty and fill a moment later. That is not only
 * a flash: the reader who goes back to a table they had scrolled halfway down
 * lands on a page that is one loading box tall at the moment the router puts the
 * scroll back, so the browser has nowhere to scroll to and the position is lost
 * (owner, 04.08.2026). The value is what makes the second visit whole from the
 * first paint. */
const arrived = new Map<string, unknown>()

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
export function loadResource<T>(name: ResourceName, language?: string): Promise<T> {
  const at = addressOf(name, language)
  const cached = inFlight.get(at)

  if (cached !== undefined) {
    // oxlint-disable-next-line typescript/consistent-type-assertions
    return cached as Promise<T>
  }

  const promise = request<T>(name, language)
    .then((data) => {
      arrived.set(at, data)

      return data
    })
    .catch((error: unknown) => {
      inFlight.delete(at)
      throw error
    })

  inFlight.set(at, promise)

  return promise
}

/**
 * What this visit already holds for a resource, or nothing where it holds none.
 *
 * Read while rendering, which is the whole point of it: absence here means the
 * screen has to wait, and that is a fact about the visit rather than a failure.
 */
export function arrivedResource<T>(name: ResourceName, language?: string): T | undefined {
  const known = arrived.get(addressOf(name, language))

  // oxlint-disable-next-line typescript/consistent-type-assertions
  return known === undefined ? undefined : (known as T)
}

/**
 * Tests start from an empty cache when this is called with nothing, which is what every
 * `serving()` in the suite still does.
 *
 * **A name narrows the clearing to one resource, since 25.09.2026.** Two screens now call
 * it after their own write goes through - `AdminLeagues.tsx` and `Leagues.tsx`, both on
 * `'leagues'` - so the NEXT mount of either one asks the server again rather than reading
 * what this visit fetched before that write. Before that day nothing in the application
 * called this at all; both screens held what they wrote in the session's own provider
 * instead, which is what let them survive being unmounted without asking again, and this
 * cache staying full for the whole visit was never the fault while that was true.
 *
 * **A language narrows it further, and it is asked for through {@link addressOf} like
 * everything else here.** Nothing calls it that way today - the one name that carries a
 * language is `pages`, and nothing on the portal writes a written page (ADL, 18.09.2026:
 * „Upisne rute za strane nema i nece je biti"). It takes the argument regardless, because
 * the alternative is worse than an argument nobody passes: without it this function would
 * build `/api/pages`, an address the cache has not held since the language went into it, and
 * a caller clearing the written pages would be handed a silence that reads as success.
 */
export function clearResourceCache(name?: ResourceName, language?: string): void {
  if (name === undefined) {
    inFlight.clear()
    arrived.clear()

    return
  }

  const at = addressOf(name, language)

  inFlight.delete(at)
  arrived.delete(at)
}
