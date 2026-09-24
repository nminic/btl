import { screen, within } from '@testing-library/react'
import { join, relative, sep } from 'node:path'
import { isValidElement } from 'react'
import { matchRoutes } from 'react-router'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routeObjects } from '../../app/routeObjects'
import { renderAt } from '../../test/render'
import {
  answeredWith,
  forgetEveryCookie,
  isResource,
  serverThat,
  type Asked,
} from '../../test/serverAnswers'
import { sources, WHOLE_PORTAL } from '../../test/sources'

/**
 * THE MEMBER AREA ASKS THE QUESTION THE HEADER ASKS, AND THERE IS ONE DOOR TO THE ANSWER.
 *
 * <p><b>What this is for.</b> `session/context.ts` says the question „is anybody signed
 * in" „must not be asked twice and get two answers", and until 20.09.2026 it was: the
 * header read `signedIn` and eleven screens behind the picture read the member number,
 * so every link in the menu behind a signed in member's own picture led to „Za ovo treba
 * prijava".
 *
 * <p><b>AND THE ONE DOOR THEN ANSWERED THE WRONG THING FOR EVERY MEMBER, for four days,
 * with this file green.</b> `GET /api/me` had carried a member number since 20.09.2026
 * and `session/theServer.ts` read past it, so the session knew an account and no person
 * and the hook rightly said „Ovaj deo je za takmicare" - on the owner's own profile.
 * Nothing here saw it because every case in this file signed somebody in as an ACCOUNT,
 * which was the only session the portal could make: the second half of the axis, a
 * member, had no case at all. That half is the first `describe` below, and it is the
 * whole reason to read this file for the shape rather than for the subject.
 *
 * <p><b>WHY THE QUESTION HERE IS ABOUT MODULES AND NOT ABOUT ADDRESSES.</b> The first
 * draft of this file walked `ACCOUNT_ROUTES` and called those five addresses „every screen
 * of the member area". Eleven screens had been changed. The six that are not on that list
 * live in `EXTRA_ADDRESSES` and `UNLISTED_ROUTES` - `rezultat/novi`, `novi-tim`,
 * `poruke/:id`, `tim/:slug/izmena`, `kalendar/:slug/prijava`, `kalendar/:slug/ocena` - and
 * a review put the old question back into all six at once with the package staying green,
 * 178 files and 2917 cases, the same numbers as a clean run (21.09.2026). „Which screens
 * belong to one person" has no bottom while it is answered with a list of addresses: the
 * addresses are spread over three exported lists and not one of them is about belonging.
 *
 * <p><b>What is asked instead has a bottom.</b> Which modules of the portal NAME
 * `SignedOut`. The files are found on the disc rather than written out (`test/sources.ts`);
 * every `import`, `export … from`, `import(…)` and `require(…)` is read off the parser
 * rather than off the text (`ts.preProcessFile`); and each specifier is resolved into a
 * path the way the bundler resolves it, so `'./SignedOut'`, `"./SignedOut.tsx"` and
 * `'../member/SignedOut'` are one answer and not three. Four drafts of one guard were lost
 * to those three spellings on 07.09.2026, which is why none of them is read here.
 *
 * <p><b>And the session is not handed in.</b> There is no prop for it: `SessionProvider`
 * refuses one on purpose, so that nothing can measure a signed in portal without
 * measuring the signing in. The only way in is the one a member has - a cookie in the
 * browser and `GET /api/me` answering - which is what the server below is.
 */

/** Where the portal's own modules live, so one can be named by its place under it. */
const SRC = join(process.cwd(), 'src')

/** A module by its place under `src`, spelt the one way on either platform. */
function named(path: string): string {
  return relative(SRC, path).split(sep).join('/')
}

/**
 * Enough of the project's own settings for a specifier to be resolved the way the
 * bundler resolves it.
 *
 * `allowImportingTsExtensions` is not decoration: `tsconfig.app.json` turns it on, so
 * `'./SignedOut.tsx'` is a spelling somebody may write tomorrow, and a reader that does
 * not know it would answer „nothing names this module".
 */
const AS_THE_BUNDLER_DOES: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
}

/**
 * Every module of the portal that names the given one, and how many were opened.
 *
 * The count comes back with the answer and is asserted beside it, because a sweep
 * narrowed by accident answers „nothing names it" in exactly the words of a clean
 * portal (`data/season.test.ts`, which measured that).
 */
function modulesNaming(wanted: string): { walked: number; naming: string[] } {
  let walked = 0

  const naming = sources().flatMap((one) => {
    const names = ts.preProcessFile(one.code, true, true).importedFiles.some((ref) => {
      const { resolvedModule } = ts.resolveModuleName(
        ref.fileName,
        one.path,
        AS_THE_BUNDLER_DOES,
        ts.sys,
      )

      return resolvedModule !== undefined && named(resolvedModule.resolvedFileName) === wanted
    })

    /* Counted after the file has been read rather than before, so this says what was
       parsed and not what was offered. */
    walked += 1

    return names ? [named(one.path)] : []
  })

  return { walked, naming }
}

const HOOK = 'pages/member/memberScreen.tsx'

/**
 * Every module of the portal, as the bundler itself resolves them.
 *
 * Lazily, so that asking which module the router hangs at an address costs the eleven
 * modules the table names and not two hundred and twenty seven.
 *
 * Swept from the PROJECT ROOT, which is the one spelling that does not change with whoever
 * asks. Measured: the same sweep written relative to this folder comes back keyed
 * `./MyProfile.tsx` and `../event/RateEvent.tsx`, so the key a row would have to guess at
 * depends on where the row is written down. That is the class of fault four drafts of one
 * guard were lost to on 07.09.2026, and the root-relative form has none of it.
 *
 * A prefix written out by hand cannot narrow this quietly: were it wrong, no row at all
 * would find its module and every one of them would fail below.
 */
const MODULES = import.meta.glob<Record<string, unknown>>('/src/**/*.tsx')

/** What is at an address the router does not serve. A module cannot export it, so „nothing
 *  is there" can never be mistaken for „the row's own module is there". */
const NOTHING = Symbol('no screen at this address')

/**
 * Every screen that asks the question, and one address each.
 *
 * <p><b>The list is written by hand and both of its columns have a floor.</b> Which modules
 * ask is derived from the module graph, and a row is required for every one of them; which
 * screen the router hangs at an address is derived from the router. That is the shape
 * `pages/publicData.test.tsx` already uses: a hand table that fails on the day there is
 * something it has no row for.
 *
 * <p><b>The address had no floor until 21.09.2026 and that was a hole, not a limit.</b> A
 * module knows nothing about where it is hung, so this file long said the address could not
 * be derived at all. It can: the ROUTER knows, and is asked below. What the missing floor
 * allowed, measured by a review: a row naming the right module and pointing at ANOTHER
 * walked screen's address left that screen visited by nothing, and `Messages.tsx` given a
 * second door beside the hook passed the whole package of 2932 cases.
 *
 * <p><b>The addresses that carry a value carry a real one</b> - an event that was run, a
 * team that exists, a message that was sent. A made up slug would let a screen that bailed
 * out with „Ove strane nema" before the question was ever asked pass the first half of the
 * walk, which reads „a heading, and not the sign in".
 */
const WALKED: { screen: string; at: string }[] = [
  { screen: 'pages/event/RateEvent.tsx', at: '/sr/kalendar/jadovnicki-ultramaraton-2026/ocena' },
  { screen: 'pages/event/ReportResult.tsx', at: '/sr/kalendar/resolution-run-2027/prijava' },
  { screen: 'pages/member/EditTeam.tsx', at: '/sr/tim/dunavski-trkaci/izmena' },
  { screen: 'pages/member/Membership.tsx', at: '/sr/moja-clanarina' },
  { screen: 'pages/member/MessageDetail.tsx', at: '/sr/poruke/msg-1' },
  { screen: 'pages/member/Messages.tsx', at: '/sr/poruke' },
  { screen: 'pages/member/MyProfile.tsx', at: '/sr/moj-profil' },
  { screen: 'pages/member/MyResults.tsx', at: '/sr/moji-rezultati' },
  { screen: 'pages/member/NewResult.tsx', at: '/sr/rezultat/novi' },
  { screen: 'pages/member/ProposeTeam.tsx', at: '/sr/novi-tim' },
  { screen: 'pages/member/Settings.tsx', at: '/sr/podesavanja' },
]

let server: { asked: Asked[]; stop: () => void } | null = null

/**
 * A server holding a session for somebody with no competitor record of their own.
 *
 * **This said „which is what every real session is today", and the function twenty lines
 * below refuted it in the same commit**: `aSignedInMember` is a real session with a
 * record, and the portal has read one since 24.09.2026. It was the eighth home of that
 * sentence and the only one left standing after the sweep that closed the other seven,
 * which is the whole argument for sweeping a class with more than one tool - the seven
 * were found by the field name and by the decision's words, and this one by reading.
 *
 * What is true of it, and always will be: a moderator's session and a superadmin's are
 * this, because one account is exactly one member (owner, 14.09.2026, PDL P21) and
 * administration has no member to be.
 */
function aSignedInAccount(role = 'competitor', account = 107): void {
  aServerAnswering({ role, account })
}

/**
 * A server holding a session for a MEMBER: the same answer with his own record in it.
 *
 * <p>Which is what `GET /api/me` really sends anybody the league has given a number, and
 * has sent since 20.09.2026. The portal read past it until 24.09.2026, so every real
 * member was the account above and met „Ovaj deo je za takmicare" on all eleven screens
 * of his own.
 *
 * <p><b>The account number is not the member number and is deliberately nothing like
 * it.</b> 107 is not a member of anything; `000001` is a row of the generated file with a
 * name on it. Read off the wrong one, a screen looks for member 107 and finds nobody, and
 * the two could not be told apart if the case let one number play both parts.
 */
function aSignedInMember(memberNumber = '000001', role = 'competitor', account = 107): void {
  aServerAnswering({ role, account, member: { memberNumber } })
}

function aServerAnswering(said: object): void {
  server = serverThat((path) => {
    if (path === '/api/me') {
      return new Response(JSON.stringify(said), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    /* Everything else off the disc, exactly as every other screen reads it - and
       since 21.09.2026 „everything else" has to say which else. A resource is under
       `/api` now too, so the line below used to hand a 404 to every list the shell
       asks for and left every screen in this file empty. The question is derived from
       the contract rather than written out (`test/serverAnswers.ts`). */
    return path.startsWith('/api') && !isResource(path) ? answeredWith(404) : null
  })
}

beforeEach(() => {
  forgetEveryCookie()
})

afterEach(() => {
  server?.stop()
  server = null
  forgetEveryCookie()
})

describe('the one door to „nobody is signed in"', () => {
  /**
   * The sentence eleven screens used to say for themselves.
   *
   * <p>A screen that draws `SignedOut` has decided by itself that nobody is signed in,
   * which is the very fault this work removed, and it is the only way that sentence can
   * reach a reader: `SignedOut` is what writes it. So the answer has to be one module,
   * and it has to be the one that is asked instead.
   */
  it('is named by exactly one module, and that module is the hook', () => {
    const { walked, naming } = modulesNaming('pages/member/SignedOut.tsx')

    expect(walked, 'the portal is still here').toBeGreaterThan(WHOLE_PORTAL)
    expect(naming).toEqual([HOOK])
  })

  /**
   * And the same for the third answer, which arrived with this work.
   *
   * <p>„Ovaj deo je za takmičare" is a permanent state rather than a moment on the way to
   * being a member (`memberScreen.tsx` carries the reasoning), so a screen deciding on it
   * by itself is the same fault one answer along: two homes for one fact.
   */
  it('has a twin for „you are not racing", named by the same one module', () => {
    const { walked, naming } = modulesNaming('pages/member/NotRacing.tsx')

    expect(walked, 'the portal is still here').toBeGreaterThan(WHOLE_PORTAL)
    expect(naming).toEqual([HOOK])
  })

  /**
   * The floor under the table below, and it is what makes the walk every screen rather
   * than the ones somebody remembered.
   *
   * <p>Both ways round on purpose. A twelfth screen asking the question and having no row
   * fails here, which is the fault a list of five addresses hid; and a row whose module has
   * stopped asking fails here too, which is a row that has quietly begun measuring nothing.
   *
   * <p><b>Where this is wider than „a screen", said rather than left to be found.</b> What
   * is asked is „which modules NAME this one", so something taking only the `MemberScreen`
   * type off it would be counted and would be asked for a row it has no address for.
   * Nothing does today. The answer then is to give that module an address or to move the
   * type, never to teach this to skip a kind of import: `import type` and `import` are one
   * statement away from each other, and a reader that skipped one would hand back the hole
   * this exists to close.
   */
  it('has a row for every screen that asks the question, and no row for one that does not', () => {
    const { walked, naming } = modulesNaming(HOOK)

    expect(walked, 'the portal is still here').toBeGreaterThan(WHOLE_PORTAL)
    expect(naming.toSorted()).toEqual(WALKED.map((one) => one.screen).toSorted())
  })

  /**
   * The floor under the OTHER column, and it is the router that lays it.
   *
   * <p>Which module a row names is derived above. WHERE that module is hung was written out
   * by hand and had nothing under it, so a row was free to name the right module and point
   * at the address of a different screen on the very same list. That screen is then visited
   * by nothing on the portal while every case here goes on passing, which a review proved
   * twice: the swap alone left all twenty nine of them green, and with `Messages.tsx` given
   * a second door beside the hook the whole package of 2932 cases stayed green too.
   *
   * <p>A SECOND DOOR and not a screen naming `SignedOut` again, and the difference was
   * measured on 21.09.2026: a screen that names it is caught by the module graph above
   * whatever the address column says, so it proves nothing about this. The regression that
   * really hid behind a wrong address is one that names nothing new - it keeps the hook and
   * answers the third case itself - and with the address put right that one falls on the
   * walk, one case out of 2933.
   *
   * <p><b>What is asked, and of whom.</b> A module knows nothing about where it is hung, but
   * the router does: `matchRoutes` hands back the very element `routeObjects` serves at an
   * address. So the question is put to the router and answered BY IDENTITY - is the thing
   * drawn there one of the things this row's module exports - never by a name, because a
   * name is a spelling and spellings are what sink guards like this one.
   *
   * <p>Both halves fail loudly rather than quietly. A module the sweep does not hold exports
   * nothing, and an address the router does not serve draws {@link NOTHING}; either way the
   * row reports what is really there instead of its own module, so an accidentally narrowed
   * sweep cannot read as a clean portal.
   *
   * <p><b>Where this is narrower than it looks, said rather than left to be found.</b> It is
   * the LEAF the router serves that must be the row's module, so a row pointing at an
   * administrative address would fail here even if the screen behind the door were right:
   * what is hung there is the door (`routeObjects.tsx`). No screen of the member area is
   * behind one today, and the answer on the day one is would be to ask this for the door's
   * child, never to stop asking.
   */
  it('has the router hanging that very module at the address written beside it', async () => {
    const hung = await Promise.all(
      WALKED.map(async ({ screen: itsModule, at }) => {
        const load = MODULES[`/src/${itsModule}`]
        const element = matchRoutes(routeObjects, at)?.at(-1)?.route.element
        const drawn = isValidElement(element) ? element.type : NOTHING
        const exported = load === undefined ? [] : Object.values(await load())
        /* What IS there, for the row that is wrong. A component's name carries no slash and
           no suffix, so this can never spell one of the modules and pass by accident. */
        const instead = typeof drawn === 'function' ? drawn.name : String(drawn)

        return `${at} · ${exported.includes(drawn) ? itsModule : instead}`
      }),
    )

    expect(hung).toEqual(WALKED.map((one) => `${one.at} · ${one.screen}`))
  })
})

/** The two things the member area says INSTEAD of itself, and the only two. */
const REFUSALS = ['Za ovo treba prijava', 'Ovaj deo je za takmičare']

/**
 * The screen's own heading, once the server has answered who is asking.
 *
 * <p><b>WAITED FOR ON THE HEADER FIRST, and that is not tidiness.</b> A visit begins with
 * nobody signed in and `GET /api/me` answers a tick later, so „Za ovo treba prijava" is
 * really on screen for one render. Read without this wait, every case below finds that
 * heading and reports the increment as undone - measured 24.09.2026, all eleven failed on
 * the sentence they exist to prove is gone. The sibling `describe` carries the same wait
 * and the same reason.
 *
 * <p>The account menu is the header saying it knows somebody is signed in, which is the
 * very question the screen behind it is being asked, and the two are written in one pass:
 * `SignIn` and `useTheServersSession` both set the role and the session together.
 */
async function theHeadingOnceTheAnswerHasArrived(): Promise<HTMLElement> {
  expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()

  /* AND THEN WAITED FOR AGAIN, because the answer and the screen are two arrivals and
     not one. The menu appearing says the session knows who is asking; the screen behind
     it may still be fetching the lists it draws from and carry no heading at all for a
     tick. Measured 24.09.2026: three of the eleven were in that state at this line.

     Sound to wait rather than read, and the reason is not patience: once the session
     names a member, `useMemberScreen` answers the same thing for the rest of the visit,
     so no refusal can appear AFTER this point. What is waited for can only be the
     screen's own heading. */
  return screen.findByRole('heading', { level: 1 })
}

describe('every screen of the member area, to a MEMBER the server has signed in', () => {
  /**
   * THE INCREMENT OF 24.09.2026, MEASURED ON EVERY ONE OF THE ELEVEN AND NOT ON ONE.
   *
   * <p>Owner, that day: „Trenutno ne mogu cak ni svojim profilom da se igram, podesavam,
   * prilozim slika." All three of those are addresses on this list and all three drew
   * „Ovaj deo je za takmicare", and so did the other eight: the session took no member
   * number off `GET /api/me`, so `useMemberScreen` had nobody to name.
   *
   * <p><b>Why the whole list rather than his profile.</b> One fact is read in one place
   * and every screen of the area hangs off it, so a case about one of them would measure
   * the hook and report it as a screen. The list is the module graph's (above), which is
   * what makes „every screen" mean every screen rather than the ones somebody remembered.
   *
   * <p><b>What is asserted, and why it is not the heading each screen really draws.</b>
   * That there IS a level one heading and that it is neither refusal. Named headings
   * would be a table about eleven screens, and this is one fact about one hook: the
   * screens have their own cases. „Not a refusal" alone would be satisfied by a screen
   * that draws nothing at all, which is a worse fault reported as none - `findByRole`
   * requires the heading to be there, so both halves have to hold.
   */
  it.each(WALKED)('draws $at rather than one of the two refusals', async ({ at }) => {
    aSignedInMember()
    /* A VISITOR AND NO MEMBER NUMBER HANDED IN, which is a browser that has touched no
       development control and a case that cannot pass on the prop: the only thing that
       makes this a member is the answer above. */
    renderAt(at, 'visitor', null)

    expect(REFUSALS).not.toContain((await theHeadingOnceTheAnswerHasArrived()).textContent)
  })

  /**
   * AND IT IS HIS SCREEN, WHICH IS A SECOND QUESTION AND THE ONE THE NUMBER ANSWERS.
   *
   * <p>Every case above is satisfied by a member area that draws SOMEBODY. What says the
   * portal read the member number and not the account number is a name, and only one of
   * the two facts in the answer leads to one: `000001` is a row of the generated file
   * called Vladan Đurišić, and 107 is a number no member has.
   */
  it('names the member off the answer, and never the account beside him', async () => {
    aSignedInMember()
    renderAt('/sr/moj-profil', 'visitor', null)

    expect(await screen.findByRole('heading', { level: 1, name: 'Vladan Đurišić' })).toBeVisible()
  })

  /**
   * AND THE NUMBER IS THE ONE THE ANSWER CARRIES, not the first member the portal can
   * find.
   *
   * <p>The case above is read against a file whose first row is that same member, so „the
   * answer's number" and „whoever comes first" are one string there and it tells them
   * apart nowhere. A second member, named by the answer and not first in anything, is the
   * only thing that does.
   */
  it('names the member the answer carries, and not the first one on the list', async () => {
    aSignedInMember('000009')
    renderAt('/sr/moj-profil', 'visitor', null)

    const drawn = await theHeadingOnceTheAnswerHasArrived()

    expect(drawn.textContent).not.toBe('Vladan Đurišić')
    expect(REFUSALS).not.toContain(drawn.textContent)
  })
})

describe('every screen of the member area, to somebody the server has signed in', () => {
  it.each(WALKED)('does not send $at back to the sign in', async ({ at }) => {
    aSignedInAccount()
    /* A visitor and no member number, which is a browser that has touched no
       development control: the only thing that makes this a session is the answer
       above. */
    renderAt(at, 'visitor', null)

    /* WAITED FOR ON THE HEADER FIRST, and that is not tidiness. A visit begins with
       nobody signed in and the answer arrives a tick later, so the sign in really is on
       screen for one render. The account menu is the header saying it knows somebody is
       signed in, which is exactly the question the screen below is supposed to be asking
       too. */
    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()

    /* NAMED RATHER THAN DENIED. „Not the sign in" is satisfied by a screen that draws
       nothing at all, which is a worse fault reported as none; this is the one thing such
       a reader is to be told, and the address is in it only to say which screen said it. */
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovaj deo je za takmičare' }),
    ).toBeVisible()
  })

  it.each(WALKED)('still sends $at to the sign in when nobody is signed in at all', async ({ at }) => {
    /* THE OTHER HALF OF THE SAME AXIS. Read alone, the case above is satisfied by a
       member area that lets everybody in, which is a worse fault than the one it
       measures, and by a screen that answers a visitor with nothing at all.

       WHAT IT CANNOT TELL APART, said rather than left to be found: a session the server
       refused and one it has not answered yet are the same state by design, because
       `signedIn` is null in both and the hook is meant to answer them the same. So the
       401 below fixes which of the two this is, and cannot be what makes it pass. */
    server = serverThat((one) => (one.startsWith('/api') ? answeredWith(401) : null))
    renderAt(at, 'visitor', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Za ovo treba prijava' }),
    ).toBeVisible()
  })
})

describe('what a signed in account with no competitor record is told', () => {
  it('is that this part is for competitors, and not that nobody is signed in', async () => {
    aSignedInAccount()
    renderAt('/sr/moj-profil', 'visitor', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovaj deo je za takmičare' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Prijavljen si, ali uz ovaj nalog ne stoji takmičarski zapis, pa ovde nema šta da se prikaže.',
      ),
    ).toBeVisible()
    /* The way onward is the front page and not the sign in: whoever reads this is signed
       in already, and offering them the form is the portal arguing with them. Read
       inside the screen rather than on the page, because the sign of the league in the
       header is a way to the front page as well. */
    const mine = within(screen.getByRole('main'))

    expect(mine.getByRole('link', { name: 'Naslovna strana' })).toHaveAttribute('href', '/sr')
    expect(mine.queryByRole('link', { name: 'Prijava' })).not.toBeInTheDocument()
  })

  it('is the same for a moderator, who by decision has no competitor record at all', async () => {
    /* Not a different sentence and not a different screen. „Jedan nalog je tacno jedan
       clan" (owner, 14.09.2026, PDL P21), and administration is nobody's member. */
    aSignedInAccount('moderator', 11)
    renderAt('/sr/moja-clanarina', 'visitor', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovaj deo je za takmičare' }),
    ).toBeVisible()
  })
})

describe('the member number the screens read', () => {
  /**
   * THE SOURCE AND NOT THE OUTCOME. Both facts below say „somebody is signed in", and a
   * screen reading either one draws something rather than the sign in. What tells them
   * apart is WHOSE screen is drawn: only the member number names a person in the file of
   * members, and only one of the two homes carries it.
   */
  it('is taken from the answer even when a number is handed in beside it', async () => {
    /* **THE MUTATION THIS EXISTS FOR IS THE COMFORTABLE VERSION OF THE 24.09.2026
       CHANGE**, and it is comfortable because it looks careful: write the member number
       only when the answer really carries one, so that nothing can be cleared. It is
       wrong on the road where the answer is asked twice in a visit - `SignIn` can be
       walked back to and used by somebody else - and a moderator signing in after a
       member would keep the member's number and be handed his profile, his messages and
       his settings, with the header naming the moderator.

       Here the server says the account races for nobody and a number is handed in
       beside it. Written the careful way, the number survives and this screen draws
       Vladan Đurišić to somebody the server has just said is not him. */
    aSignedInAccount()
    renderAt('/sr/moj-profil', 'competitor', '000001')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovaj deo je za takmičare' }),
    ).toBeVisible()
  })

  /**
   * AND A RECORD WITH NO NUMBER IN IT IS THE THIRD WAY OF BEING NOBODY, which is a state
   * of the server's making rather than of this portal's.
   *
   * <p>ADL A44, owner 11.09.2026: „Osoba je `competitor` od registracije, a clan postaje
   * kad dobije broj", so `MeApi.MyOwnRecord` leaves `memberNumber` out for somebody who
   * has registered and has not been given one. Read as „the record is here, so he is a
   * member", such a person is signed in as the member number `undefined`.
   *
   * <p><b>What he is told is not true of him and that is a boundary rather than a
   * decision</b>: „uz ovaj nalog ne stoji takmicarski zapis" - his account has one, and
   * what it has not got is a number. No decision anywhere says what his screen should be,
   * so he is not given an invented one (`memberScreen.tsx` carries this).
   */
  it('is missing rather than invented when the record carries no number', async () => {
    aServerAnswering({ role: 'competitor', account: 107, member: { membershipBasis: 'payment' } })
    renderAt('/sr/moj-profil', 'visitor', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovaj deo je za takmičare' }),
    ).toBeVisible()
  })

  it('is missing rather than guessed at when only the account is there', async () => {
    /* The same two facts with the member number taken away, which is the only difference
       between this case and the one above. */
    aSignedInAccount()
    renderAt('/sr/moj-profil', 'competitor', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovaj deo je za takmičare' }),
    ).toBeVisible()
  })
})
