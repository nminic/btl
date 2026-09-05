import { act, cleanup, screen } from '@testing-library/react'
import { EXTRA_ADDRESSES, ROUTES } from '../app/routes'
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
  /* „Predlog tima" is the heading of two screens at this one address since
     05.09.2026: the form, and the refusal a member who already has a team reads
     instead. `ME` has a team, so this row reads the second. **What the first one's
     title is held by is `member/headingFirst.test.tsx`**, which signs in as a member
     with no team; measured 05.09.2026 by moving `titleKey` in the definition, which
     fails there and not here. */
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

    expectPart(part)
    expect(asked.filter((one) => DENIED.some((name) => one.includes(name)))).toEqual([])
  })

  /* The other half, so the sweep above is known to be looking at something: the
     queue is fetched, by the screen whose queue it is. */
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
