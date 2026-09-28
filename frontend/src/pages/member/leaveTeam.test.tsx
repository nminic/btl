import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, screen, waitFor } from '@testing-library/react'
import { arrivedResource, clearResourceCache, loadResource } from '../../data/client'
import sr from '../../i18n/sr.json'
import { theServerWasToldILeft } from './teamExit'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, did, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/**
 * A MEMBER LEAVING HIS TEAM, FROM THE ONE SCREEN THAT OFFERS IT.
 *
 * <p>`DELETE /api/teams/{id}/membership` (`TeamWriteApi.leave`) has existed since 24.09.2026
 * and nothing on this side called it until this branch. The button is on „Moja članarina"
 * and not on the team's own page: owner, 28.09.2026, choosing between three offered
 * outcomes, on the ground that this screen already draws the sentence about the transfer
 * window, so a member looking for the window is already here.
 *
 * <p><b>WHAT THE SETUP KEEPS APART, AND WHY EACH ONE IS A SEPARATE THING.</b> Every value
 * an assertion here reads could arrive from somewhere else if the screen were wrong, so no
 * two of them are allowed to be the same value:
 *
 * <ul>
 * <li><b>The team is never the first in the list.</b> `000011` runs for Nišavski maraton
 * klub, which is `id` 2 and the SECOND row of the generated teams. Read off `teams[0]` the
 * screen would send `DELETE /api/teams/1/membership` and every assertion about „something
 * was sent" would still pass.
 * <li><b>He is never the only member of it.</b> Five members run for that team, so a team
 * that went away with him would be a fault rather than the ordinary case, and „the team is
 * still there" is a thing worth being able to see.
 * <li><b>He is never the one who administers it.</b> `000005` does. Whether the seat empties
 * is the route's business (`update team set admin_id = null where id = ? and admin_id = ?`),
 * and the case below about `000003` is what says this screen has no condition about it.
 * <li><b>And there is always a third member with nothing to do with any of it.</b> `000002`
 * is in no team at all, which is the state sixteen of the thirty two members are in.
 * </ul>
 */

/** A resource, answered the way the server answers one. */
const listOf = (what: unknown): Response =>
  new Response(JSON.stringify(what), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

/* A day inside the transfer window. Owner, 24.09.2026: „Iz tima se izlazi u istom prozoru u
   kom se i ulazi (1.10-31.12)", so this is the only kind of day the button is drawn on. */
const DAY = '2026-10-15'

/* And a day outside it. PDL, 05.09.2026, on the same window from the other direction: „Van
   tog roka dugmeta ... nema, a na njegovom mestu stoji rečenica kad se rok otvara." */
const OUTSIDE = '2026-06-15'

/**
 * THE MEMBERS AND THE TEAMS AS THE GENERATED FILES HOLD THEM, read rather than restated.
 *
 * <p>Who runs for which team is a fact about the seed, and a fixture that wrote it out again
 * would pass on the day the seed moved and the portal did not.
 */
const MEMBERS_ON_FILE: {
  memberNumber: string
  country: string
  firstSeason: number
  teamId: number | null
  membershipBasis: string
  referralCode: string
}[] = JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'))

const TEAMS_ON_FILE: { id: number; name: string }[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/teams.json'), 'utf-8'),
)

const memberOnFile = (number: string) =>
  must(
    MEMBERS_ON_FILE.find((one) => one.memberNumber === number),
    `${number} in the generated members`,
  )

const teamOnFile = (id: number) =>
  must(
    TEAMS_ON_FILE.find((one) => one.id === id),
    `team ${String(id)} in the generated teams`,
  )

/** In a team, not the first one on the list, not its administrator, not its only member. */
const ME = memberOnFile('000011')
/** The team he is in, by name, as the screen has to print it. */
const MINE = teamOnFile(2)
/** Somebody else's team, and the FIRST row of the list, which is the wrong answer. */
const FIRST = teamOnFile(1)
/** The administrator of a third team, for the case that says this screen does not care. */
const RUNS_ONE = memberOnFile('000003')
/** And a member with nothing to do with any of it. */
const NO_TEAM = memberOnFile('000002')

/**
 * A SERVER THAT ANSWERS `/api/me` AND THE LEAVING, AND REMEMBERS WHAT IT ANSWERED.
 *
 * <p><b>`/api/me` is answered here rather than left to the shared floor, and that is the
 * whole point of this harness.</b> `test/setup.ts` answers it off the generated file, which
 * never changes, so a screen that had asked again would be told the same team it was told at
 * mount and nothing could tell that apart from a screen that never asked. Held here, the
 * answer moves when the route says it moved.
 *
 * <p><b>The identity is taken off the ADDRESS and never off the fixture</b>, so a screen that
 * sent the right verb to the wrong team leaves the wrong team here and the assertions say so.
 *
 * @param toALeaving what the route answers, 204 unless a case says otherwise. Anything else
 *                   leaves the membership exactly as it was, because a refusal is a thing
 *                   that did not happen.
 * @param whoAmI     who `/api/me` is about. Its own parameter because two cases need a
 *                   member this file's main one is not.
 * @param afterwards what `/api/me` answers ONCE THE ROUTE HAS AGREED. It defaults to the
 *                   truth - no team - and one case hands it the old team on purpose, to tell
 *                   a screen that reads the server from one that decided for itself.
 */
function aServerThatIsLeft(
  toALeaving: () => Response = did,
  whoAmI: { memberNumber: string; teamId: number | null } = ME,
  afterwards: number | null = null,
) {
  let teamId = whoAmI.teamId
  const mine = memberOnFile(whoAmI.memberNumber)

  return serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (path === '/api/me') {
      return listOf({
        role: 'competitor',
        account: 1,
        member: {
          memberNumber: mine.memberNumber,
          country: mine.country,
          firstSeason: mine.firstSeason,
          /* Left OUT rather than sent as null when there is no team, which is what the
             server really does: `MyOwnRecord.teamId` carries `@JsonInclude(NON_NULL)`. */
          ...(teamId === null ? {} : { teamId }),
          membershipBasis: mine.membershipBasis,
          referralCode: mine.referralCode,
          referredCount: 0,
        },
      })
    }

    const leaving = /^\/api\/teams\/(-?\d+)\/membership$/.exec(path)

    if (how === 'DELETE' && leaving !== null) {
      const answer = toALeaving()

      if (answer.status === 204) {
        teamId = afterwards
      }

      return answer
    }

    return how === 'GET' ? null : did()
  })
}

/** What was written, and to where: the recording server's own account of it. */
function writes(asked: Asked[]): { path: string; how: string }[] {
  return asked
    .filter((one) => one.init?.method !== undefined && one.init.method !== 'GET')
    .map((one) => ({ path: one.path, how: String(one.init?.method) }))
}

/** How many times `/api/me` was asked, which is how „it asked again" is measured. */
const asksAboutMe = (asked: Asked[]): number =>
  asked.filter((one) => one.path === '/api/me').length

describe('leaving a team from the membership screen', () => {
  let stop = () => {}

  afterEach(() => {
    stop()
  })

  /**
   * THE WHOLE ROAD, AND THE ADDRESS IS THE HALF THAT CAN BE WRONG WITHOUT ANYTHING SAYING SO.
   *
   * <p>`000011` runs for team 2 and the list begins with team 1, so „it sent a DELETE" is not
   * enough on its own: the assertion is on the exact address, and the sibling case below
   * swaps the source to prove it.
   */
  it('sends the leaving to the team the member is in', async () => {
    const user = setupUser()
    let asked: Asked[] = []
    ;({ stop, asked } = aServerThatIsLeft())

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

    /* The team he is in is drawn before anything is pressed, which is also what says the
       harness really is answering `/api/me` for HIM. */
    expect(
      await screen.findByText(`Trenutno si u timu ${MINE.name}.`, undefined, { timeout: SLOW }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeam }))
    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeamSure }))

    await waitFor(
      () => {
        expect(writes(asked)).toEqual([
          { path: `/api/teams/${String(MINE.id)}/membership`, how: 'DELETE' },
        ])
      },
      { timeout: SLOW },
    )

    /* AND IT IS NOT THE FIRST TEAM ON THE LIST, said as its own assertion rather than left
       to the equality above: this is the source swap that case would otherwise not see. */
    expect(writes(asked)).not.toContainEqual({
      path: `/api/teams/${String(FIRST.id)}/membership`,
      how: 'DELETE',
    })
  })

  /**
   * AND WHAT STANDS AFTERWARDS COMES OFF THE SERVER, WHICH IS THE AXIS THIS SCREEN COULD
   * MOST EASILY GET RIGHT BY ACCIDENT.
   *
   * <p>The route answers 204 and therefore answers nothing, so the screen has to ask
   * `GET /api/me` again (`Membership.leaveTheTeam`). A screen that simply decided „I am out
   * of a team now" would pass every other case in this file, because the server agrees with
   * it every time.
   *
   * <p><b>So this case makes the server DISAGREE.</b> The leaving is accepted and `/api/me`
   * goes on naming the old team - which is not a thing the real route does, and is exactly
   * the point: the screen must draw what it was told rather than what it worked out. The
   * sibling case below is the same axis with the server telling the truth.
   */
  it('draws what the server says afterwards and not what it worked out itself', async () => {
    const user = setupUser()
    let asked: Asked[] = []
    ;({ stop, asked } = aServerThatIsLeft(did, ME, MINE.id))

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

    expect(
      await screen.findByText(`Trenutno si u timu ${MINE.name}.`, undefined, { timeout: SLOW }),
    ).toBeInTheDocument()

    const before = asksAboutMe(asked)

    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeam }))
    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeamSure }))

    /* It really asked again, which is the mechanism this case is about. */
    await waitFor(
      () => {
        expect(asksAboutMe(asked)).toBeGreaterThan(before)
      },
      { timeout: SLOW },
    )

    /* And believed the answer, however odd it is. */
    expect(screen.getByText(`Trenutno si u timu ${MINE.name}.`)).toBeInTheDocument()
    expect(screen.queryByText(sr.membership.noTeam)).not.toBeInTheDocument()
  })

  /** And with the server telling the truth, the member reads that he is in no team. */
  it('says he is in no team once the server says so', async () => {
    const user = setupUser()
    ;({ stop } = aServerThatIsLeft())

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

    expect(
      await screen.findByText(`Trenutno si u timu ${MINE.name}.`, undefined, { timeout: SLOW }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeam }))
    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeamSure }))

    expect(
      await screen.findByText(sr.membership.noTeam, undefined, { timeout: SLOW }),
    ).toBeInTheDocument()

    /* And the way back out is gone with the team, because there is nothing left to leave. */
    expect(screen.queryByRole('button', { name: sr.membership.leaveTeam })).not.toBeInTheDocument()
  })

  /**
   * THE LEAVING HAPPENED AND THE QUESTION ABOUT WHO HE NOW IS DID NOT COME BACK.
   *
   * <p><b>A real road and not a contrived one:</b> the two are separate requests, so a
   * connection that drops between them leaves the membership ended on the server and the
   * portal with nothing to redraw from. `whoTheServerSaysIAm` answers `null` for every one
   * of those - no server, a number that is not 200, a body that will not parse.
   *
   * <p><b>What must NOT happen is the interesting half.</b> `theServerSignedMeIn` writes all
   * eight of its fields even when they are null, on purpose (`session/SessionProvider.tsx`),
   * so handing it an empty answer would wipe this member's country, his first season and his
   * referral link - and the country is what decides the currency of every amount on this very
   * screen. So the session is left exactly as it was, which is
   * `session/useTheServersSession.ts`'s own rule: „an answer that never came writes nothing
   * at all."
   *
   * <p>The caches are already dropped by then, so the next mount asks the server again and
   * the member is never stuck with this for longer than one screen.
   */
  it('leaves the session alone when the question about who I am does not come back', async () => {
    const user = setupUser()
    let left = false
    ;({ stop } = serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (path === '/api/me') {
        /* Fine until the leaving, and gone afterwards: asked before, this screen could not
           have drawn the team at all and the case would be measuring a blank page. */
        return left
          ? answeredWith(500)
          : listOf({
              role: 'competitor',
              account: 1,
              member: {
                memberNumber: ME.memberNumber,
                country: ME.country,
                firstSeason: ME.firstSeason,
                teamId: ME.teamId,
                membershipBasis: ME.membershipBasis,
                referralCode: ME.referralCode,
                referredCount: 0,
              },
            })
      }

      if (how === 'DELETE' && path.endsWith('/membership')) {
        left = true

        return did()
      }

      return how === 'GET' ? null : did()
    }))

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

    await user.click(
      await screen.findByRole('button', { name: sr.membership.leaveTeam }, { timeout: SLOW }),
    )
    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeamSure }))

    /* The question is put away, so the press really did finish rather than hanging. */
    await waitFor(
      () => {
        expect(
          screen.queryByRole('button', { name: sr.membership.leaveTeamSure }),
        ).not.toBeInTheDocument()
      },
      { timeout: SLOW },
    )

    /* And nothing of his was cleared: the team still stands, and so does the country, which
       is the one that would take the money on this screen with it. */
    expect(screen.getByText(`Trenutno si u timu ${MINE.name}.`)).toBeInTheDocument()
    expect(screen.queryByText(sr.membership.noRecordTitle)).not.toBeInTheDocument()
  })

  /**
   * NOTHING IS SENT UNTIL IT IS ASKED TWICE.
   *
   * <p>The confirmation is reasoning over what is measurable rather than a decision of the
   * owner's, and the reason is on `Membership.tsx`: a member cannot put himself back into a
   * team from this portal at all, so one stray press costs him his team until the
   * administration acts.
   */
  it('sends nothing on the first press', async () => {
    const user = setupUser()
    let asked: Asked[] = []
    ;({ stop, asked } = aServerThatIsLeft())

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

    await user.click(
      await screen.findByRole('button', { name: sr.membership.leaveTeam }, { timeout: SLOW }),
    )

    /* The whole sentence and not „Sigurno", because the name of the team is the half that
       could be wrong: asked of the words alone this would pass over a question about
       somebody else's team. */
    expect(
      screen.getByText(
        `Sigurno izlaziš iz tima ${MINE.name}? U tim se ne vraćaš sam: ponovo te upisuje administracija.`,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(FIRST.name))).not.toBeInTheDocument()
    expect(writes(asked)).toEqual([])
  })

  /** And the question can be put away, which leaves the membership exactly as it was. */
  it('puts the question away again and sends nothing', async () => {
    const user = setupUser()
    let asked: Asked[] = []
    ;({ stop, asked } = aServerThatIsLeft())

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

    await user.click(
      await screen.findByRole('button', { name: sr.membership.leaveTeam }, { timeout: SLOW }),
    )
    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeamKeep }))

    expect(
      screen.getByRole('button', { name: sr.membership.leaveTeam }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: sr.membership.leaveTeamSure }),
    ).not.toBeInTheDocument()
    expect(writes(asked)).toEqual([])
    expect(screen.getByText(`Trenutno si u timu ${MINE.name}.`)).toBeInTheDocument()
  })

  /**
   * THE REASON A LEAVING WAS REFUSED COMES OFF THE ANSWER, AND NOT OFF A CONDITION HERE.
   *
   * <p>`theWindowIsShut` is the one reason this route names (`account/refusals.ts`,
   * `WHEN_LEAVING_A_TEAM`), and the sentence it maps to is the one the portal already draws
   * on this very screen when the window is shut - „Ako se do tada ništa ne dogovori, ostaješ
   * tamo gde jesi."
   *
   * <p>It is reachable although the button is only drawn inside the window, because the
   * window shuts at midnight on 31 December and a member who drew the button at 23.59 meets
   * a route that has changed its mind a minute later.
   */
  it('says why the server refused, in the portal\'s own words', async () => {
    const user = setupUser()
    ;({ stop } = aServerThatIsLeft(() => refused('theWindowIsShut', 409)))

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

    await user.click(
      await screen.findByRole('button', { name: sr.membership.leaveTeam }, { timeout: SLOW }),
    )
    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeamSure }))

    expect(
      await screen.findByText(sr.membership.transferShut, undefined, { timeout: SLOW }),
    ).toBeInTheDocument()

    /* AND HE IS STILL IN THE TEAM, which is the half a refusal is really about: a screen
       that emptied the team on the asking would draw „nisi ni u jednom timu" over a
       membership the server had just kept. */
    expect(screen.getByText(`Trenutno si u timu ${MINE.name}.`)).toBeInTheDocument()
  })

  /**
   * A REFUSAL THE ROUTE DOES NOT NAME IS STILL SAID OUT LOUD.
   *
   * <p>Everything this route turns away other than the shut window is one empty 404 by
   * ADL A8, so there is nothing for the screen to look up and `ServerSaid` says what it
   * honestly can with the number in it.
   */
  it('says something even when the answer names no reason', async () => {
    const user = setupUser()
    ;({ stop } = aServerThatIsLeft(() => answeredWith(404)))

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

    await user.click(
      await screen.findByRole('button', { name: sr.membership.leaveTeam }, { timeout: SLOW }),
    )
    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeamSure }))

    /* The number is IN the sentence (`server.wrong` interpolates `{status}`), so the
       assertion carries it: matched on the template alone this would pass for any number
       the server answered, 404 and 500 alike. */
    expect(
      await screen.findByText(/Server je odgovorio brojem 404/, undefined, { timeout: SLOW }),
    ).toBeInTheDocument()
    expect(screen.getByText(`Trenutno si u timu ${MINE.name}.`)).toBeInTheDocument()
  })

  /** And the reason goes away with the question it was an answer to. */
  it('takes the reason away when the question is put away', async () => {
    const user = setupUser()
    ;({ stop } = aServerThatIsLeft(() => refused('theWindowIsShut', 409)))

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

    await user.click(
      await screen.findByRole('button', { name: sr.membership.leaveTeam }, { timeout: SLOW }),
    )
    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeamSure }))

    expect(
      await screen.findByText(sr.membership.transferShut, undefined, { timeout: SLOW }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeamKeep }))

    expect(screen.queryByText(sr.membership.transferShut)).not.toBeInTheDocument()
  })

  /**
   * TWO PRESSES WHILE THE FIRST IS STILL OUT ARE ONE REQUEST.
   *
   * <p>The answer is held open on purpose rather than raced for: a case that pressed twice
   * and hoped the second landed first would pass or fail by scheduling.
   *
   * <p>Without the guard the second request meets a route that no longer has a membership to
   * end, is answered 404, and the member is told his leaving failed a moment after it
   * succeeded.
   */
  it('sends one request for two presses while the first is still out', async () => {
    const user = setupUser()
    let letItAnswer = () => {}
    const held = new Promise<void>((resolve) => {
      letItAnswer = resolve
    })
    let asked: Asked[] = []
    ;({ stop, asked } = aServerThatIsLeft(
      () => new Response(null, { status: 204 }),
    ))

    /* The holding is put in front of the recording server rather than inside it, so that
       what is recorded is still exactly what the screen sent. */
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/membership') && init?.method === 'DELETE') {
        await held
      }

      return answering(input, init)
    }

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

    await user.click(
      await screen.findByRole('button', { name: sr.membership.leaveTeam }, { timeout: SLOW }),
    )

    const sure = screen.getByRole('button', { name: sr.membership.leaveTeamSure })

    await user.click(sure)
    await user.click(sure)

    /* It says out loud that it cannot act, rather than going away and taking the keyboard
       focus with it. */
    await waitFor(
      () => {
        expect(sure).toHaveAttribute('aria-disabled', 'true')
      },
      { timeout: SLOW },
    )

    letItAnswer()

    await waitFor(
      () => {
        expect(
          writes(asked).filter((one) => one.path.endsWith('/membership')),
        ).toHaveLength(1)
      },
      { timeout: SLOW },
    )
  })

  /**
   * TWO PRESSES WITH NOTHING AWAITED BETWEEN THEM ARE ONE REQUEST TOO (VISOK, review of PR 442).
   *
   * <p><b>The case above does not measure a genuine double press, and that is exactly why a
   * mutation swapping the guard for the state beside it survived it.</b> `Membership.tsx` reads
   * the ref (`outstanding.current`) when the button is pressed and the state (`leaving`) for
   * `aria-disabled`. The second press of the case above comes only after the first has been
   * carried all the way through `user.click`, which awaits its own click and lets React render,
   * so `leaving` is already `true` by the time the second press is tried: `if (outstanding.current)`
   * and a mutated `if (leaving)` agree there, because both values have caught up.
   *
   * <p><b>A genuine double press agrees with neither, because nothing has been awaited for
   * either to catch up.</b> `user.click` cannot produce that by construction, so this fires two
   * raw clicks on the very same button inside one `act`, which is the shape
   * `admin/paymentsActivation.test.tsx` gives its own „Da" case for the same reason. Nothing
   * commits between them: the second is handled by the very closure the first was, from before
   * `setLeaving` had been seen anywhere. A ref is read fresh whichever closure asks; the state is
   * fooled by exactly this.
   *
   * <p><b>The road is walked to its end before anything is counted</b> (the member reads that he
   * is in no team), because a screen that lets the second press through sends that request in the
   * same breath as the first: counted earlier, a request still on its way would read as one that
   * was never sent. And the count is over EVERY write the server was sent and not over the address
   * alone, so a second request to anywhere is one too.
   *
   * <p>What the second request would cost is written on `Membership.tsx`, at `outstanding`. This
   * server answers every leaving 204, so what is measured here is the NUMBER of requests and not
   * that sentence: the number is the cause, and it is what the guard is there to hold.
   */
  it(
    'sends one request for two presses with nothing awaited between them',
    async () => {
      const user = setupUser()
      let asked: Asked[] = []
      ;({ stop, asked } = aServerThatIsLeft())

      renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, DAY)

      await user.click(
        await screen.findByRole('button', { name: sr.membership.leaveTeam }, { timeout: SLOW }),
      )

      const sure = screen.getByRole('button', { name: sr.membership.leaveTeamSure })

      /* THE RACE ITSELF: two clicks on the same button with nothing awaited between them,
         grouped in one `act` so that neither can commit before the other is dispatched. */
      act(() => {
        sure.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        sure.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      /* The road ends where the member reads that he is in no team. */
      expect(
        await screen.findByText(sr.membership.noTeam, undefined, { timeout: SLOW }),
      ).toBeInTheDocument()

      /* One request, to HIS team and not to the first on the list, and nothing else written. */
      expect(writes(asked)).toEqual([
        { path: `/api/teams/${String(MINE.id)}/membership`, how: 'DELETE' },
      ])
    },
    SLOW,
  )

  /**
   * OUTSIDE THE WINDOW THERE IS NO BUTTON, AND THE SENTENCE IS WHAT STANDS IN ITS PLACE.
   *
   * <p>PDL, 05.09.2026, on the same window from the other direction: „Van tog roka dugmeta
   * ... nema, a na njegovom mestu stoji rečenica kad se rok otvara", and the portal already
   * draws that sentence here (`membership.transferShut`).
   *
   * <p><b>Nothing is sent either, which is the half that is easy to leave out:</b> a button
   * that is merely invisible is still a control if anything else can reach it.
   */
  it('offers nothing outside the transfer window', async () => {
    let asked: Asked[] = []
    ;({ stop, asked } = aServerThatIsLeft())

    renderAt('/sr/moja-clanarina', 'competitor', ME.memberNumber, undefined, OUTSIDE)

    expect(
      await screen.findByText(sr.membership.transferShut, undefined, { timeout: SLOW }),
    ).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: sr.membership.leaveTeam })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: sr.membership.leaveTeamSure }),
    ).not.toBeInTheDocument()
    expect(writes(asked)).toEqual([])

    /* He is still told which team he is in, because leaving is what is shut and not the
       fact. */
    expect(screen.getByText(`Trenutno si u timu ${MINE.name}.`)).toBeInTheDocument()
  })

  /**
   * AND A MEMBER WHO IS IN NO TEAM IS OFFERED NOTHING, ON A DAY THE WINDOW IS OPEN.
   *
   * <p>The day matters: tested outside the window this case would pass on the window rather
   * than on the team, which is the other half of the very condition it is about.
   */
  it('offers nothing to a member who is in no team', async () => {
    ;({ stop } = aServerThatIsLeft(did, NO_TEAM))

    renderAt('/sr/moja-clanarina', 'competitor', NO_TEAM.memberNumber, undefined, DAY)

    expect(
      await screen.findByText(sr.membership.noTeam, undefined, { timeout: SLOW }),
    ).toBeInTheDocument()

    /* The window really is open, so nothing here is passing for the wrong reason. */
    expect(screen.getByText(/Prelazni rok je otvoren/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: sr.membership.leaveTeam })).not.toBeInTheDocument()
  })

  /**
   * THE MEMBER WHO ADMINISTERS HIS TEAM IS OFFERED THE SAME BUTTON, AND THAT IS THIS
   * SCREEN HAVING NO CONDITION RATHER THAN AN EXTRA ONE.
   *
   * <p>What happens to the seat is the route's: `update team set admin_id = null where id = ?
   * and admin_id = ?` empties it, and who takes it next is the standing query's
   * (`TeamApi`, ordered by `season_from` then `member_number`). PDL, 04.09.2026: „kad se
   * mesto isprazni preuzima ga član koji je najduže u timu."
   *
   * <p>`000003` administers Vardarski krug, which is a THIRD team, so this case is not
   * reading anything the two above set up.
   */
  it('offers it to the member who administers the team as well', async () => {
    const user = setupUser()
    let asked: Asked[] = []
    ;({ stop, asked } = aServerThatIsLeft(did, RUNS_ONE))

    renderAt('/sr/moja-clanarina', 'competitor', RUNS_ONE.memberNumber, undefined, DAY)

    await user.click(
      await screen.findByRole('button', { name: sr.membership.leaveTeam }, { timeout: SLOW }),
    )
    await user.click(screen.getByRole('button', { name: sr.membership.leaveTeamSure }))

    await waitFor(
      () => {
        expect(writes(asked)).toEqual([
          { path: `/api/teams/${String(must(RUNS_ONE.teamId, 'his team'))}/membership`, how: 'DELETE' },
        ])
      },
      { timeout: SLOW },
    )
  })
})

/**
 * WHAT A LEAVING DROPS OUT OF THE CACHE, ASKED OF THE MODULE RATHER THAN OF THE SCREEN.
 *
 * <p><b>Why not through the screen.</b> A dropped cache is not something a MOUNTED screen
 * shows: `data/useResource.ts` says in as many words that `clearResourceCache` „drops the
 * promise and says nothing to anybody holding a state that came out of it", and making it
 * notify readers was refused there for its blast radius. So what the drop changes is what
 * the NEXT mount reads, and the honest place to ask is the cache itself.
 *
 * <p><b>And a third resource is filled every time on purpose.</b> `pricing` is nothing this
 * write touches, so it is what tells „drops the two it should" from „drops everything" -
 * the bare `clearResourceCache()` with no name empties the lot, and without a resource
 * standing outside the pair both would look the same.
 */
describe('what a leaving drops out of the cache', () => {
  let stop = () => {}

  beforeEach(() => {
    clearResourceCache()
  })

  afterEach(() => {
    stop()
    clearResourceCache()
  })

  /**
   * <p>Both and not one: a member's team reaches the portal twice over, as `Competitor.teamId`
   * off `/api/competitors` (which every screen that draws somebody's club reads) and as the
   * row of `/api/teams`, which this write can REMOVE outright when he was the last of his
   * team (`TeamWriteApi.leaving` ends on `emptyTeams.goIfEmpty`).
   */
  it('drops the two resources the write moves, and leaves the rest alone', async () => {
    ;({ stop } = aServerThatIsLeft())

    await loadResource('teams')
    await loadResource('competitors')
    await loadResource('pricing')

    expect(arrivedResource('teams')).not.toBeUndefined()
    expect(arrivedResource('competitors')).not.toBeUndefined()

    await theServerWasToldILeft(must(ME.teamId, 'the team he is in'))

    expect(arrivedResource('teams')).toBeUndefined()
    expect(arrivedResource('competitors')).toBeUndefined()
    expect(arrivedResource('pricing')).not.toBeUndefined()
  })

  /**
   * AND DROPS NOTHING WHERE THE SERVER REFUSED, which is the axis this cannot get wrong.
   *
   * <p>`member/teamWrites.ts` states the rule this follows: a portal that dropped them on the
   * asking would draw a member out of a team that still holds him.
   */
  it('drops nothing when the server refused', async () => {
    ;({ stop } = aServerThatIsLeft(() => refused('theWindowIsShut', 409)))

    await loadResource('teams')
    await loadResource('competitors')

    await theServerWasToldILeft(must(ME.teamId, 'the team he is in'))

    expect(arrivedResource('teams')).not.toBeUndefined()
    expect(arrivedResource('competitors')).not.toBeUndefined()
  })
})
