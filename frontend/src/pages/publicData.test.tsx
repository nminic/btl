import { act, cleanup, screen, within } from '@testing-library/react'
import { EXTRA_ADDRESSES, ROUTES } from '../app/routes'
import { DEFAULT_LOCALE } from '../i18n/config'
import { QUEUES } from './admin/queues'
import type { Role } from '../roles/context'
import { beginsWith, metSaid } from '../test/met'
import { renderAt } from '../test/render'

/**
 * What a browser is allowed to ask the server for, and on whose behalf.
 *
 * A screen reads a resource by fetching the whole of it, so "the words never
 * reach the page" is not the same as "the words never reach the reader". They
 * are in the tab either way, one keystroke of the network panel apart.
 *
 * The moderation queue is the one that matters here. It carries the addresses
 * of people who have registered and are not members yet, and the bodies of
 * comments nobody has approved, one of which is the referral spam this portal
 * exists to keep off itself. So does the list of moderators, which carries
 * staff names, addresses and the whole matrix of rights. Both are
 * administration's to read, and administration is behind a sign-in.
 *
 * Written as a sweep rather than as a note on one screen, because this went
 * wrong by accident: a hook the event page calls started reading the queue in
 * order to find approved comments, and nothing said so. The next hook that does
 * it will not say so either.
 *
 * Read as production reads: the two development controls are switched off here.
 * They fetch the moderators on every screen they are drawn on, and they are
 * drawn on none in production (src/dev/tools.ts). A sweep that left them on
 * would have to allow that file everywhere.
 */

vi.mock('../dev/tools', () => ({ devToolsEnabled: () => false }))

/** What no screen outside administration may ask for, by the name in the
 *  address. */
const DENIED = ['verification', 'moderators']

/**
 * Every address outside administration, with the heading each one is supposed
 * to draw.
 *
 * Held against the route table below rather than trusted as written: a list
 * typed out by hand stops being every address the moment somebody adds a
 * screen, and this one had already missed eight when it was first written.
 *
 * The heading is here because without it the sweep swept whatever it happened
 * to land on. A slug that stops matching the generated data does not fail: the
 * portal answers an address it does not have by going to the front page, which
 * has a heading like everything else, and the sweep went on passing while the
 * screen it names was never drawn. Three of these are records looked up by a
 * hand-written slug, and those are exactly the ones that would rot quietly.
 *
 * Two headings, because half of these screens say something different once
 * somebody has signed in, and both readings have to be swept: a leak below a
 * sign-in guard is invisible to a visitor and is still a leak.
 *
 * Four of these are one part of a screen whose other part carries the same
 * heading, so the heading alone cannot tell them apart: swapping the awards for
 * the overview left the sweep green. Those four name the part they are, which
 * the screen marks as the one being read.
 */
const PUBLIC: [address: string, asVisitor: string, asMember: string, part?: string][] = [
  ['/sr', 'Balkanska trkačka liga', 'Balkanska trkačka liga'],
  ['/sr/kalendar', 'Kalendar', 'Kalendar'],
  ['/sr/kalendar/dan/2027-05-08', 'Trke, 8. maj 2027.', 'Trke, 8. maj 2027.'],
  [
    '/sr/kalendar/fruskogorski-maraton-2010',
    'Fruškogorski maraton',
    'Fruškogorski maraton',
  ],
  [
    '/sr/kalendar/fruskogorski-maraton-2010/ocena',
    'Za ovo treba prijava',
    'Fruškogorski maraton',
  ],
  [
    /* With the race in it, which is the only address this form answers since
       23.08.2026: it is written by the button in the row of the race, and one
       typed without it says where the way in is instead of drawing a form. The
       id is written out because this list is read before anything is rendered;
       it is the one race of that event. */
    '/sr/kalendar/fruskogorski-maraton-2010/prijava?trka=evt-fruskogorski-maraton-2010-05-08-5768',
    'Za ovo treba prijava',
    'Prijava rezultata',
  ],
  ['/sr/takmicari', 'Takmičari', 'Takmičari'],
  ['/sr/takmicar/000001', 'Vladan Đurišić', 'Vladan Đurišić', 'Svojim rečima'],
  ['/sr/takmicar/000001/priznanja', 'Vladan Đurišić', 'Vladan Đurišić', 'Pehari 5'],
  ['/sr/timovi', 'Timovi', 'Timovi'],
  ['/sr/tim/dunavski-trkaci', 'Dunavski trkači', 'Dunavski trkači'],
  /* The front page, to a member, and that is the screen this address answers with
     for them: `ME` has a team and `DAY` is outside the transfer window, and either
     one alone sends them to the front (PDL, increment 133, 05.09.2026) — sent away,
     not told why, which is the owner's own words. A visitor still meets the sign-in,
     because that is asked before anything else.

     **The form's own heading is held elsewhere**, by `member/headingFirst.test.tsx`,
     which signs in as a member with no team on a day inside the window; measured
     05.09.2026 by moving `titleKey` in the definition, which fails there and not
     here. What this row is worth is the other half of this file's question: even the
     redirect must not ask the server for anything a member may not have. */
  ['/sr/novi-tim', 'Za ovo treba prijava', 'Balkanska trkačka liga'],
  /* And the same rule on the way into a team's own data: `ME` does not administer
     Dunav, so the address is not a page for them either and answers with the front.
     The form's own heading is read by `member/editTeam.test.tsx`, which signs in as
     the member who does administer it. */
  ['/sr/tim/dunavski-trkaci/izmena', 'Za ovo treba prijava', 'Balkanska trkačka liga'],
  ['/sr/tabela', 'BTL tabele', 'BTL tabele'],
  ['/sr/top-liste', 'Top liste', 'Top liste'],
  ['/sr/lige', 'Lige', 'Lige'],
  [
    '/sr/liga/runtrace-2027',
    'RunTrace liga 2027',
    'RunTrace liga 2027',
    'Propozicije',
  ],
  /* The results carry no heading of their own, so the part is named by what
     the other part has and this one must not: a table of standings instead of
     the terms of the competition. */
  [
    '/sr/liga/runtrace-2027/rezultati',
    'RunTrace liga 2027',
    'RunTrace liga 2027',
    '',
  ],
  ['/sr/pravilnik', 'Opšti pravilnik Balkanske trkačke lige za sezonu 2027', 'Opšti pravilnik Balkanske trkačke lige za sezonu 2027'],
  ['/sr/politika-privatnosti', 'Politika privatnosti', 'Politika privatnosti'],
  ['/sr/uslovi-koriscenja', 'Uslovi korišćenja', 'Uslovi korišćenja'],
  /* Read on a fixed day, because this heading changes on 01.10.2026 when
     registration opens (pricing.ts). A row that turns over on a date is a row
     that breaks the build on a date. */
  [
    '/sr/registracija',
    'Registracija još nije otvorena',
    'Registracija još nije otvorena',
  ],
  ['/sr/prijava', 'Prijava', 'Prijava'],
  ['/sr/moj-profil', 'Za ovo treba prijava', 'Ksenija Vasiljević'],
  ['/sr/moji-rezultati', 'Za ovo treba prijava', 'Moji rezultati'],
  ['/sr/moja-clanarina', 'Za ovo treba prijava', 'Moja članarina'],
  ['/sr/podesavanja', 'Za ovo treba prijava', 'Podešavanja'],
  ['/sr/poruke', 'Za ovo treba prijava', 'Poruke'],
  ['/sr/poruke/msg-1', 'Za ovo treba prijava', 'Dobro došao u pripremu sezone 2027'],
  ['/sr/rezultat/novi', 'Za ovo treba prijava', 'Unos rezultata'],
]

/** The member the signed-in half of the sweep reads as. */
/* Somebody with a result on the event whose rating screen is among the
   addresses below: since 11.08.2026 the rating opens only for a member who ran
   the race, and an address that answers with a refusal is not the screen this
   file means to read. */
const ME = '000021'

/**
 * The day every row is read on.
 *
 * Fixed, because half these screens say something different on a date: the
 * registration opens on 01.10.2026 (pricing.ts), and a table of headings read
 * against the real clock is a table that breaks the build on a morning nobody
 * changed anything. Chosen before that day and before next season, which is
 * where the generated calendar lives.
 */
const DAY = '2026-08-07'

/**
 * A route pattern as what it matches: `takmicar/:memberNumber` against
 * `/sr/takmicar/000001`.
 *
 * Whole segments and anchored at both ends, because the first attempt compared
 * first segments only: `kalendar` then stood for the month, the day, an event,
 * the report of a result and the rating alike, and a new screen under any of
 * them joined the portal without joining this sweep.
 */
export function matcher(path: string): RegExp {
  return new RegExp(`^/sr${path === '' ? '' : `/${path.replaceAll(/:[^/]+/g, '[^/]+')}`}$`)
}

/**
 * Waits until the screen has stopped asking for things.
 *
 * Not "until something was asked for", which is what this did and was the whole
 * of its weakness: the shell fetches before any screen does, and a screen that
 * reads a second resource inside a `Resource` of the first only mounts once the
 * first has arrived. Measured on the event page, the old check fired while four
 * files had been asked for and the comments had not been reached at all, so the
 * one leak this file exists to catch walked straight past it.
 */
async function quiet(asked: string[]): Promise<void> {
  for (let still = 0; still < 3; ) {
    const before = asked.length

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 5)
      })
    })

    still = asked.length === before ? still + 1 : 0
  }
}

/** What was in place before a case wrapped it, so it can be put back exactly.
 *  `vi.unstubAllGlobals` is the wrong tool here: it reverts to what stood before
 *  the setup file installed its own reader of the disc, which leaves every
 *  later case in this file with no fetch at all. */
let unwrapped: typeof globalThis.fetch | null = null

/** Writes down every address asked for, and hands the question on whole, so the
 *  screen renders exactly as it would. */
function watch(): string[] {
  const asked: string[] = []
  const real = globalThis.fetch

  unwrapped = real
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    asked.push(String(input))
    return real(input, init)
  }

  return asked
}

/** The part of a screen that is being read, where two parts share one heading.
 *  The screen marks it, so it is asked for the way a reader meets it. */
function expectPart(part: string | undefined): void {
  if (part === undefined) {
    return
  }

  /* Read off the body and not off the navigation: the link is marked by the
     address, so it says which part was asked for and not which one was drawn.
     Swapping one part's screen for the other left the sweep green until this
     read what is actually under the heading. */
  if (part === '') {
    expect(screen.queryByRole('heading', { level: 2, name: 'Propozicije' })).toBeNull()
    return
  }

  expect(screen.getByRole('heading', { level: 2, name: part })).toBeVisible()
}


/**
 * That the page offers no way of its own up a level, on every address the portal has.
 *
 * Owner, 05.09.2026: „Obriši sve Nazad linkove koje si pomenuo, **ne želim da imam ni jedan
 * takav slučaj na portalu**... Default Back akcija mi je OK." That is a rule about the portal,
 * and the guard that stood knew only the word „Nazad". A review measured the hole: a way back
 * reading „Kalendar" walks straight past it, and two of the nine that were removed read exactly
 * that (06.09.2026).
 *
 * **Asked of the shape of the link, not of its words.** A way up a level is a link whose address
 * is a strict ancestor of the address being read: from `/sr/tim/dunavski-trkaci` to `/sr/timovi`
 * is not one, because `timovi` is not `tim`; from `/sr/kalendar/dan/2027-05-08` to `/sr/kalendar`
 * is. Read off the one link, with nothing followed through the code.
 *
 * **What is allowed is a named list, not a shape.** The first draft freed anything inside a
 * `<nav>` and anything standing beside a button, and both were measured and thrown out: on
 * `/sr/moji-rezultati` the second freed **277 of 278** links in the page, because every row
 * carries „Izmeni" beside a delete control, and the first freed any way back at all the moment
 * somebody wrapped it in breadcrumbs (review, 06.09.2026). A shape that common is not an
 * exception, it is a door.
 *
 * So the two that exist are written down by address and by target, and everything else fails.
 * They are the parts of a competition, where the link to the competition is the **other tab**,
 * and „Odustani" beside „Pošalji". A third cannot be let in by wrapping it in anything: it
 * fails the gate and asks for a decision once, which is where the cost belongs.
 */
const ALLOWED: Record<string, string[]> = {
  /* **Keyed by the role as well as by the address**, because every public address is drawn
     twice and a render that does not draw the allowed link leaves the allowance unspent: on
     `/ocena` a visitor meets `SignedOut`, so a real way back added there was let through for
     free, one for one (review, 06.09.2026). Each render now says exactly what it may hold. */
  'competitor /sr/liga/runtrace-2027/rezultati': ['/sr/liga/runtrace-2027'],
  'visitor /sr/liga/runtrace-2027/rezultati': ['/sr/liga/runtrace-2027'],
  /* „Odustani" beside „Pošalji" on the screen that rates an event. Only to a member: a
     visitor is shown `SignedOut` and there is no form to close.
     **Not covered by the owner's sentence, and said so rather than dressed up.** What he kept on
     05.09.2026 was „samo dva dugmeta u administraciji (D), koja i nisu veze nego zatvaraju
     formu": those are buttons, in administration. This is a `<Link>` on a member's screen. It is
     allowed here because it does the same job, and because taking it away would leave a
     half-filled form with no way out but the browser; that reading is written down as a decision
     in `btl-produkt/PDL.md` so the journal carries it, and the owner can overturn it there. */
  'competitor /sr/kalendar/fruskogorski-maraton-2010/ocena': [
    '/sr/kalendar/fruskogorski-maraton-2010',
  ],
}

/** Which of the allowances were actually met, so the list cannot quietly go stale. */
const met = new Set<string>()

function noWayUp(address: string, role: Role): void {
  const path = address.split('?')[0] ?? address
  const allowed = ALLOWED[`${role} ${address}`] ?? []

  const up = within(screen.getByRole('main'))
    .queryAllByRole('link')
    .map((one) => (one.getAttribute('href') ?? '').split('?')[0] ?? '')
    .filter((href) => href !== FRONT && path.startsWith(`${href}/`))

  up.filter((href) => allowed.includes(href)).forEach((href) => met.add(`${role} ${address} ${href}`))

  expect(
    up.filter((href) => !allowed.includes(href)),
    `${address} offers no way of its own up a level`,
  ).toEqual([])

  /* **And exactly the ones it names, no more.** Read as „is this target allowed", a second link
     to the same address rides in free: on the screen that rates an event „Odustani" holds
     `/sr/kalendar/:slug`, so a real way back to the event was let through beside it, and that is
     the very link the owner had removed. Read as „no more than the allowance", the render that
     draws none of them leaves the allowance unspent and frees one anyway (reviews, 06.09.2026). */
  expect(up.sort(), `${role} on ${address} offers exactly the ways up allowed`).toEqual(
    [...allowed].sort(),
  )
}

/** The portal itself, which is nobody's parent, in the language every row here is written in.
 *  Read off `i18n/config.ts` rather than written out, because the day an `/en` row joins the
 *  table a hand-written `/sr` would call the way home a way back and free the real one. */
const FRONT = `/${DEFAULT_LOCALE}`


/**
 * And the same question over administration and over the two member forms the sweep above
 * cannot reach.
 *
 * **Why they are not in that sweep.** It asks what a browser downloads on behalf of somebody who
 * is not entitled to it, so administration is deliberately outside it. And two member forms
 * (`/sr/novi-tim`, `/sr/tim/:slug/izmena`) answer `SignedOut` or send the reader away for both
 * roles it walks with, so the form itself is never drawn there.
 *
 * **Why they must be asked anyway.** The owner's sentence was about the portal, and he reasoned
 * about administration by name when he kept the two controls that close a form. A review put a
 * real way back into `admin/AdminMembers.tsx` and into `member/EditTeam.tsx` and the whole
 * package stayed green (06.09.2026): eleven addresses and two forms had nobody at all.
 *
 * **Each row names the heading it expects**, for the reason this file already gives about the
 * public table: two of these rows reach a record through a hand-written slug or a hand-written
 * path, and those are exactly the ones that rot quietly. Without the name, a renamed team or a
 * renamed route leaves the row measuring the front page and passing (review, 06.09.2026).
 *
 * **And the list has a floor**: every administration address the route table has, with the one
 * pattern `verifikacija/:queue` opened into the six queues it stands for. Five of those six had
 * never been asked, because the table hides them behind one pattern.
 *
 * **The two member forms are named by hand and that is a boundary**, said rather than left to be
 * found: the floor below reads the route table for administration only, so deleting those two
 * rows takes them out of every sweep at once. A third form of the same kind needs its row written
 * here, and nothing will ask for it.
 *
 * **What is still outside, said rather than hidden:** the six screens that confirm a sending.
 * Nothing here draws the state after something is sent, so a way up on a confirmation would slip
 * past. Those six are held for what lies under them (`pages/backAfterSending.test.tsx`).
 */
/** The one pattern that stands for six screens. Compared whole rather than by its ending:
 *  another address with the same parameter name would be swallowed by it and lose its row
 *  without a sound (review, 06.09.2026). */
const QUEUE_PATTERN = 'administracija/verifikacija/:queue'

const ADMIN = '000001'

const BEHIND: [string, Role, string | null, string][] = [
  ['/sr/administracija', 'superadmin', ADMIN, 'Administracija'],
  ['/sr/administracija/entiteti', 'superadmin', ADMIN, 'Članovi'],
  ['/sr/administracija/verifikacija', 'superadmin', ADMIN, 'Red za proveru rezultata'],
  ['/sr/administracija/verifikacija/rezultati', 'superadmin', ADMIN, 'Red za proveru rezultata'],
  ['/sr/administracija/verifikacija/uplate', 'superadmin', ADMIN, 'Uplate i aktivacija članova'],
  ['/sr/administracija/verifikacija/timovi', 'superadmin', ADMIN, 'Novi timovi'],
  ['/sr/administracija/verifikacija/trkacki-profil', 'superadmin', ADMIN, 'Trkački profil'],
  ['/sr/administracija/verifikacija/komentari', 'superadmin', ADMIN, 'Komentari'],
  ['/sr/administracija/verifikacija/termini', 'superadmin', ADMIN, 'Prijave promene termina'],
  ['/sr/administracija/cenovnik', 'superadmin', ADMIN, 'Cenovnik'],
  ['/sr/administracija/clanovi', 'superadmin', ADMIN, 'Članovi'],
  ['/sr/administracija/dogadjaji', 'superadmin', ADMIN, 'Događaji'],
  ['/sr/administracija/timovi', 'superadmin', ADMIN, 'Timovi'],
  ['/sr/administracija/lige', 'superadmin', ADMIN, 'Lige'],
  ['/sr/administracija/strane', 'superadmin', ADMIN, 'Statične strane'],
  ['/sr/administracija/moderatori', 'superadmin', ADMIN, 'Moderatori'],
  /* A member with no team, inside the window, so the form is really drawn. */
  ['/sr/novi-tim', 'competitor', '000002', 'Predlog tima'],
  /* And the one who administers this team, likewise. */
  ['/sr/tim/dunavski-trkaci/izmena', 'competitor', '000001', 'Izmena tima'],
]

describe('what administration and the member forms offer', () => {
  it('has a row for every administration address the route table has', () => {
    const every = [...ROUTES, ...EXTRA_ADDRESSES]
      .map((route) => route.path)
      .filter((path) => path.startsWith('administracija'))
      /* One pattern stands for six screens through three components, and five of them had
         never been opened by anything. */
      .flatMap((path) =>
        path === QUEUE_PATTERN ? QUEUES.map((queue) => queue.path) : [path],
      )

    const missing = every.filter(
      (path) => !BEHIND.some(([address]) => address === `/sr/${path}`),
    )

    expect(missing).toEqual([])
  })

  it('keeps every row it has, including the two nothing else asks for', () => {
    /* The rows for administration have a real floor above: the route table asks for them. The
       two member forms have only this. Deleting one of them took it out of every sweep at once
       and nothing fell (review, 06.09.2026), because the public walk sends both roles away from
       those addresses before the form is drawn.

       A count is a weak floor and it is written down as one: it cannot say a row is right, only
       that one went missing. Changing this number is a decision, not a formality. */
    expect(BEHIND).toHaveLength(18)
  })

  it.each(BEHIND)('offers no way of its own up a level on %s', async (
    address,
    role,
    who,
    heading,
  ) => {
    renderAt(address, role, who, undefined, '2026-10-15')

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeVisible()

    noWayUp(address, role)
  })
})

describe('what a browser downloads outside administration', () => {
  it('visits every address the route table has', () => {
    const every = [...ROUTES, ...EXTRA_ADDRESSES]
      .map((route) => route.path)
      .filter((path) => !path.startsWith('administracija'))
    /* The address without its query, because a route is a path: one address in
       the list below carries `?trka=`, which the form it opens needs and which
       the route table knows nothing about. */
    const missing = every.filter(
      (path) => !PUBLIC.some(([address]) => matcher(path).test(address.split('?')[0] ?? address)),
    )

    expect(missing).toEqual([])
  })

  it.each(PUBLIC)('asks for nothing of anybody else on %s, to a visitor', async (
    address,
    heading,
    _member,
    part,
  ) => {
    const asked = watch()

    renderAt(address, 'visitor', null, undefined, DAY)

    await quiet(asked)

    /* The screen this row names, by the heading it draws. Without it a slug
       that stopped matching the data would send the portal to the front page
       and the sweep would go on passing, having swept the front page three
       times over. */
    const named = await screen.findByRole('heading', { level: 1, name: heading })

    expect(named).toBeVisible()

    /* **And the page begins with it.** Held here rather than in a sweep of its own,
       because this one already opens every address outside administration twice and
       waits for it to settle, so the question costs nothing more than the asking.

       It is asked because a guard over three chosen screens was not enough: two rounds
       of review found first a third screen of the same shape and then four more pages
       that began with „Nazad na…" before their own heading (04.09.2026). Chosen screens
       are a list somebody keeps; this row is every address the route table has, and the
       case above refuses to let one in without a row here. */
    expect(beginsWith(named), `${address} begins with its heading, met ${metSaid(named)}`).toBe(true)

    noWayUp(address, 'visitor')
    expectPart(part)
    expect(asked.filter((one) => DENIED.some((name) => one.includes(name)))).toEqual([])
  })

  /* And the same walk signed in. Half of these screens draw `SignedOut` before
     they read anything, so to a visitor they are a sweep of an empty room: a
     hook added under the guard would be invisible. The queue is no less
     somebody else's in a member's browser than in a stranger's. */
  it.each(PUBLIC)('asks for nothing of anybody else on %s, to a member', async (
    address,
    _visitor,
    heading,
    part,
  ) => {
    const asked = watch()

    renderAt(address, 'competitor', ME, undefined, DAY)

    await quiet(asked)

    const named = await screen.findByRole('heading', { level: 1, name: heading })

    expect(named).toBeVisible()

    /* Signed in as well as out, because half of these screens draw something else
       entirely to a visitor: measured, a member's own screens answer `SignedOut` to a
       stranger, which begins with a heading of its own and would have said nothing
       about the screen behind it (review, 04.09.2026). */
    expect(beginsWith(named), `${address} begins with its heading, met ${metSaid(named)}`).toBe(true)

    noWayUp(address, 'competitor')
    expectPart(part)
    expect(asked.filter((one) => DENIED.some((name) => one.includes(name)))).toEqual([])
  })

  /* The other half, so the sweep above is known to be looking at something: the
     queue is fetched, by the screen whose queue it is. */
  it('meets every way up it allows, so the list cannot go stale', () => {
    /* The allowance is written by hand, and a hand-written list rots in two directions: it can
       be short, which the case above catches, and it can keep a line for a link nobody draws any
       more, which nothing would catch. Both walks above have run by now, so what was met is
       known. */
    const promised = Object.entries(ALLOWED).flatMap(([address, hrefs]) =>
      hrefs.map((href) => `${address} ${href}`),
    )

    expect([...met].sort()).toEqual(promised.sort())
  })

  it('asks for it on the screen that decides on it', async () => {
    const asked = watch()

    renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

    await quiet(asked)

    expect(asked.some((one) => one.includes('verification'))).toBe(true)
  })

  /* And that the waiting is long enough to see a screen's second wave: the
     comments under an event are read inside the `Resource` of the event, so
     they are asked for only after it has arrived. */
  it('waits long enough to see what a screen reads second', async () => {
    const asked = watch()

    renderAt('/sr/kalendar/fruskogorski-maraton-2010')

    await quiet(asked)

    expect(asked.some((one) => one.includes('comments'))).toBe(true)
  })
})

describe('the pattern a route is matched by', () => {
  /* Its own checks, because a matcher that is too loose only ever makes the
     sweep above pass: it shortens the list of what is missing. */
  it('matches an address of that shape and nothing longer or shorter', () => {
    expect(matcher('takmicar/:memberNumber').test('/sr/takmicar/000001')).toBe(true)
    expect(matcher('takmicar/:memberNumber').test('/sr/takmicar/000001/priznanja')).toBe(false)
    expect(matcher('takmicar/:memberNumber').test('/sr/takmicar')).toBe(false)
    expect(matcher('kalendar/:slug').test('/sr/kalendar/dan/2027-05-08')).toBe(false)
    expect(matcher('kalendar/:slug/ocena').test('/sr/kalendar/neka-trka/ocena')).toBe(true)
    expect(matcher('').test('/sr')).toBe(true)
    expect(matcher('').test('/sr/kalendar')).toBe(false)
  })
})

afterEach(() => {
  cleanup()

  if (unwrapped !== null) {
    globalThis.fetch = unwrapped
    unwrapped = null
  }
})
