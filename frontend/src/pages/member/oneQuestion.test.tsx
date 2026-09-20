import { screen, within } from '@testing-library/react'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderAt } from '../../test/render'
import { answeredWith, forgetEveryCookie, serverThat, type Asked } from '../../test/serverAnswers'
import { sources, WHOLE_PORTAL } from '../../test/sources'

/**
 * THE MEMBER AREA ASKS THE QUESTION THE HEADER ASKS, AND THERE IS ONE DOOR TO THE ANSWER.
 *
 * <p><b>What this is for.</b> `session/context.ts` says the question „is anybody signed
 * in" „must not be asked twice and get two answers", and until 20.09.2026 it was: the
 * header read `signedIn` and eleven screens behind the picture read the member number.
 * A real session carries no member number - `GET /api/me` answers a role and an account
 * and {@code MeApi} says at length why - so every link in the menu behind a signed in
 * member's own picture led to „Za ovo treba prijava".
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
 * Every screen that asks the question, and one address each.
 *
 * <p><b>The list is written by hand and it has a floor.</b> Which modules ask is derived
 * below from the module graph, and a row is required for every one of them; what cannot be
 * derived is the ADDRESS, because a module knows nothing about where the router hangs it.
 * That is the shape `pages/publicData.test.tsx` already uses: a hand table that fails on
 * the day there is something it has no row for.
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
 * Which is what every real session is today, and what a moderator's and a superadmin's
 * always will be: one account is exactly one member (owner, 14.09.2026, PDL P21) and
 * administration has no member to be.
 */
function aSignedInAccount(role = 'competitor', account = 107): void {
  server = serverThat((path) => {
    if (path === '/api/me') {
      return new Response(JSON.stringify({ role, account }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    /* Everything else off the disc, exactly as every other screen reads it. */
    return path.startsWith('/api') ? answeredWith(404) : null
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
  it('is the member number and never the account number', async () => {
    aSignedInAccount()
    /* The development switch, which is the one thing that carries a member number
       today, and an account answering beside it with a DIFFERENT number. Read off the
       account, this screen would look for member 107; read off the member number it
       looks for 000001. Neither is the other, and one of them is a real member. */
    renderAt('/sr/moj-profil', 'competitor', '000001')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Vladan Đurišić' }),
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
