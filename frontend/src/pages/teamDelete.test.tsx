import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { did, refused, serverThat, type Asked } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

/** A resource, answered the way the server answers one. */
const listOf = (what: unknown): Response =>
  new Response(JSON.stringify(what), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

/* A day inside the transfer window, because founding a team is only offered there
   (owner, 05.09.2026), and the half of this that matters most is what the founder of
   a deleted team may do next. Read on the real day, that half would measure the
   window rather than the deletion. */
const DAY = '2026-10-15'

/* And a day outside it, for the pair of cases that measure WHO decides the window.
   PDL P13b, owner 25.09.2026: „Van prozora 1.10-31.12 ruta vraca 409, i to i
   administratoru tima i administraciji." */
const OUTSIDE = '2026-06-15'

/**
 * THE TEAMS AND THE MEMBERS AS THE GENERATED FILES HOLD THEM, read rather than restated.
 *
 * <p>Which team is which and who is in it are facts about the seed; a fixture that wrote them
 * out again would pass the day the seed moved and the portal did not.
 */
const TEAMS_ON_FILE: { id: number; slug: string; name: string }[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/teams.json'), 'utf-8'),
)

const MEMBERS_ON_FILE: { memberNumber: string; teamId: number | null; active: boolean }[] =
  JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'))

const teamAt = (slug: string) =>
  must(
    TEAMS_ON_FILE.find((one) => one.slug === slug),
    `${slug} in the generated teams`,
  )

/**
 * A SERVER THAT ANSWERS `DELETE /api/teams/{id}` THE WAY THE ROUTE DOES, AND REMEMBERS.
 *
 * <p><b>Why every case that presses „Obriši" now needs one, which is the whole of this
 * increment.</b> Until 28.09.2026 the team's own page wrote the deletion into the session and
 * told nobody, so three of the cases below deleted a team with no socket in front of them at
 * all and passed. They cannot now: nothing answers `DELETE /api/teams/1` off the disc, so a
 * screen that really asks is refused 404 by `test/setup.ts` and the team stays.
 *
 * <p><b>What the route really does to BOTH tables</b> (`TeamWriteApi.remove`,
 * `ATeamGoesWithItsLastMember`): the team goes, and the memberships of everybody in it cascade
 * (V11). A server that forgot the second half would let a screen pass while leaving every
 * member of a deleted team pointing at a team that is not there, which is the exact fault
 * these cases exist for.
 *
 * <p><b>The identity is taken off the ADDRESS and never off the fixture</b>, so a screen that
 * sent the right verb to the wrong team deletes the wrong team here and the assertions say so.
 *
 * @param toADelete what the route answers, which is 204 where a case does not say otherwise.
 *                  Anything else leaves both tables exactly as they were, because a refusal is
 *                  a thing that did not happen.
 */
function aServerThatDeletes(toADelete: () => Response = did) {
  let standing = TEAMS_ON_FILE
  let roster = MEMBERS_ON_FILE

  return serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (how === 'GET' && path === '/api/teams') {
      return listOf(standing)
    }

    if (how === 'GET' && path === '/api/competitors') {
      return listOf(roster.filter((one) => one.active))
    }

    /* THE TWO LISTS THE TEAM'S PAGE READS ABOUT ITSELF (`joiningThisTeam.ts`), answered as a
       server with nobody asking would. A server that answers neither makes the page say so
       since 02.10.2026 (PENDING stavka 368: a list that cannot be read says that it cannot), and
       that sentence is a second `alert` beside the one these cases are about, so a case that
       asks for THE alert could no longer find it. The world here is a healthy one. */
    if (how === 'GET' && /^\/api\/teams\/-?\d+\/(applications|invitations)$/.test(path)) {
      return listOf([])
    }

    const which = /^\/api\/teams\/(-?\d+)$/.exec(path)

    if (how === 'DELETE' && which !== null) {
      const answer = toADelete()

      if (answer.status === 204) {
        const gone = Number(which[1])

        standing = standing.filter((one) => one.id !== gone)
        roster = roster.map((one) => (one.teamId === gone ? { ...one, teamId: null } : one))
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

/* A team taken down by the member who administers it.
 *
 * Owner, 04.09.2026: „Obriši tim pokreće Da li ste sigurni? dijalog i onda se tim
 * briše kao i bodovi iz tabele za tu sezonu." And 05.09.2026, on what follows:
 * „svako brisanje tima do kraja godine je OK i besplatno, ne brani mu se da napravi
 * novi tim."
 *
 * Dunavski trkači is the team all of this is asked of: 000001 founded it and is still
 * in it, so they administer it; 000007 runs for it and does not.
 *
 * **What is not asked here, said plainly.** The owner's „zamrznuta tabela ostaje" is
 * not measured on this side at all: freezing happens at 1 January 16:00 and belongs to
 * the backend (`clock/context.ts`), so there is nothing in this portal that could hold
 * or break it. It is written down for the database rather than pretended at here.
 */

/** The name of the team, wherever it is drawn as a row of the standing. */
const listedTeams = async () =>
  within(await screen.findByRole('table', { name: 'Timovi' })).getAllByRole('row')

describe('a team its administrator takes down', () => {
  it('is asked about twice, and one press changes nothing', async () => {
    /* The portal's one way of asking about something nothing brings back, and it is
       the reason nothing here writes a dialog of its own: the first press opens the
       question, the second answers it. Pressed once, the team is still there. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000001', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }))

    /* And both answers are on offer, each carrying the name, so a reader who arrives
       at the question is told what it is about without going back up the page. */
    expect(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^Odustani od brisanja: Dunavski trkači/ }))

    await router.navigate('/sr/timovi')

    expect(
      (await listedTeams()).some((one) => /Dunavski trkači/.test(one.textContent ?? '')),
    ).toBe(true)
  }, SLOW)

  it('goes out of the standing with its points, once the question is answered', async () => {
    /* „pa se tim briše kao i bodovi iz tabele za tu sezonu": one act and not two,
       because there is no standing without a record. Measured on the standing rather
       than on the record, because the standing is what the owner named and because it
       read the file until 05.09.2026, when a team deleted this visit went on standing
       in it with its points. */
    const server = aServerThatDeletes()
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000001', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/timovi')
    })

    /* THE REQUEST ITSELF, AND NOT ONLY ITS EFFECT, which is what this case was missing
       until 28.09.2026 and why it went on passing over a screen that spoke to nobody. The
       session still takes the row out of the list when the answer comes back, so the walk
       below is satisfied by the overlay whether anything was sent or not: two sources for
       one value, and the assertion has to read the one only a socket can carry. */
    expect(writes(server.asked)).toEqual([
      { path: `/api/teams/${String(teamAt('dunavski-trkaci').id)}`, how: 'DELETE' },
    ])

    expect(
      (await listedTeams()).some((one) => /Dunavski trkači/.test(one.textContent ?? '')),
    ).toBe(false)
    /* And the other teams are still there, which is what says the table was read and
       not merely emptied. */
    expect(
      (await listedTeams()).some((one) => /Nišavski maraton klub/.test(one.textContent ?? '')),
    ).toBe(true)

    server.stop()
  }, SLOW)

  it('leaves the people who were in it without a team, and free to found another', async () => {
    /* Two halves of one rule. „ne brani mu se da napravi novi tim" is the owner's, and
       the way this portal takes somebody out of a team is to write an empty string over
       their `teamId`, because the session keeps values as text. Read as a team, that
       empty string would refuse the founder the very thing the owner allowed, and it
       would refuse it on the address as well; `teamOf` is the one reading that knows an
       empty string is not a team. */
    const server = aServerThatDeletes()
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000001', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/timovi')
    })

    /* AND IT WAS THE ROUTE THAT EMPTIED THE TEAM, not this screen: the memberships cascade
       on the server (V11) and nothing here writes over anybody's `teamId` any more. Read off
       the request, because the freedom below is the same whichever of the two did it. */
    expect(writes(server.asked)).toEqual([
      { path: `/api/teams/${String(teamAt('dunavski-trkaci').id)}`, how: 'DELETE' },
    ])

    /* The way in is offered again, on the screen the owner put it on. The address
       itself answers the same way and is not asked here: all three doors — this
       button, the address, and the queue that decides — read one function, and that
       function is asked about an empty string on its own (`data/derive.test.ts`).
       Asked here as well it would be the same measurement twice, once cheaply and
       once through a screen. */
    expect(await screen.findByRole('link', { name: 'Predloži tim' })).toBeVisible()

    /* And the address answers the same way, which is where the rule really lives: a
       hidden control is not a rule, and that was a finding once already (04.09.2026).
       Two of the three doors read `teamOf` and neither had a case: put back on their own
       comparison, the whole gate stayed green (review, 05.09.2026). */
    await router.navigate('/sr/novi-tim')

    expect(await screen.findByLabelText(/Naziv tima/)).toBeVisible()

    server.stop()
  }, SLOW)

  /**
   * THE OTHER PLACE A TEAM CAN BE DELETED, AND SINCE 26.09.2026 IT GOES THROUGH THE ROUTE.
   *
   * <p>The claim has not moved: two buttons that delete one thing must not delete two
   * different amounts of it. Administration has always been able to delete a team, and it
   * left the people in it pointing at a record that was gone - the portal went on refusing
   * them a new team, because `teamId` still named one, while their profile showed no club,
   * because `teams.find` answered nothing (review, 05.09.2026).
   *
   * <p><b>What moved is WHO does it.</b> `admin/AdminTeams.tsx` now sends
   * `DELETE /api/teams/{id}` for a team the database handed out, and the roster is emptied by
   * the route rather than by the screen: the memberships cascade (V11), and the screen drops
   * both `teams` and `competitors` so the next read is the server's. So the server in front of
   * this case has to do what the route does, and the walk afterwards is unchanged - which is
   * the point of leaving the walk exactly as it was.
   *
   * <p><b>And the request itself is asserted, not only its effect.</b> Without that this case
   * could be satisfied entirely by the fake server's own bookkeeping, and would go on passing
   * if the screen stopped asking anybody anything.
   */
  it('takes the roster with it from the other place a team can be deleted too', async () => {
    const dunav = teamAt('dunavski-trkaci')
    const server = aServerThatDeletes()
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/timovi', 'superadmin', '000001', undefined, DAY)

    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
    const row = must(
      listed.getAllByRole('row').find((one) => /Dunavski trkači/.test(one.textContent ?? '')),
      'the row of the team being deleted',
    )

    await user.click(within(row).getByRole('button', { name: /^Obriši: Dunavski trkači/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ }))

    /* THE SCREEN ASKED THE ROUTE, at the address of the team in the row and nowhere else. */
    await waitFor(() => {
      expect(
        server.asked
          .filter((one) => (one.init?.method ?? 'GET') !== 'GET')
          .map((one) => `${String(one.init?.method)} ${one.path}`),
      ).toEqual([`DELETE /api/teams/${String(dunav.id)}`])
    })

    await router.navigate('/sr/timovi')

    /* The same answer the team's own page gives: nobody is left in a team that is gone,
       so the way to found one opens again. */
    expect(await screen.findByRole('link', { name: 'Predloži tim' })).toBeVisible()

    server.stop()
  }, SLOW)

  it('takes the roster with it even when that roster exists only in this visit', async () => {
    /* **The half the case above cannot see.** Dunav's roster lives in the file, so a
       deletion that read the file took it along all the same. Who is in a team approved
       during this visit is written by `PendingQueue` into the session and nowhere else,
       and read from the file that roster is empty: the deletion took nothing along and
       left the founder holding an address that answers nothing — refused a new team,
       and shown no club on their own profile (review, 05.09.2026). */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/administracija/verifikacija/timovi',
      'superadmin',
      '000004',
      undefined,
      DAY,
    )

    const waiting = await screen.findByRole('heading', { name: 'Timočka trkačka družina' })
    const card = within(must(waiting.closest('li'), 'the card the team stands on'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/administracija/timovi')

    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
    const row = must(
      listed.getAllByRole('row').find((one) => /Timočka trkačka družina/.test(one.textContent ?? '')),
      'the row of the team just approved',
    )

    /* **The state before the deletion, said out loud, because the founder is free at the
       start of this walk too.** 000004 has no team in the file, so „Predloži tim" is
       offered from the first moment and the assertion at the end would hold without
       anything here happening at all (review, 05.09.2026). What says the approval landed
       is the roster this screen counts: one member, and it is counted through the same
       layer the deletion reads. */
    expect(within(row).getByText('1')).toBeVisible()

    await user.click(within(row).getByRole('button', { name: /^Obriši: Timočka/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Timočka/ }))

    /* And nobody else lost their team with it: emptying every member rather than this
       team's would pass everything below. Dunav keeps its six. */
    const dunav = must(
      within(await screen.findByRole('table', { name: 'Timovi' }))
        .getAllByRole('row')
        .find((one) => /Dunavski trkači/.test(one.textContent ?? '')),
      'the row of the team nobody deleted',
    )

    expect(within(dunav).getByText('6')).toBeVisible()

    await router.navigate('/sr/timovi')

    /* The founder is free again, which is the whole of what the roster being taken along
       means to the person it happened to. */
    expect(await screen.findByRole('link', { name: 'Predloži tim' })).toBeVisible()
  }, SLOW)

  it('is not offered to a member of the team who does not administer it', async () => {
    /* 000007 runs for Dunav and did not found it. Taking the team down is about who
       may change the record, not about who belongs to it, and it is the same boundary
       the way into changing the team already draws. */
    renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

    expect(screen.queryByRole('button', { name: /^Obriši/ })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Izmeni' })).toBeNull()
  })

  it('is not offered to a visitor, on the team whose administrator is nobody', async () => {
    /* **Asked of the team that has no administrator, which is the only place it can be
       asked.** `teamAdminOf` answers `null` for a team nobody is in, and a visitor's own
       member number is `null` too, so the two match unless something says otherwise.
       Asked of a team that does have an administrator, this passes whether that
       something is there or not, and it did: taking it out left the whole gate green
       (review, 05.09.2026). Novoosnovani tim has no members and no organiser. */
    renderAt('/sr/tim/novoosnovani-tim')

    await screen.findByRole('heading', { level: 1, name: 'Novoosnovani tim' })

    expect(screen.queryByRole('button', { name: /^Obriši/ })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Izmeni' })).toBeNull()
  })

  it('does not touch anybody outside it, which is what taking one team down means', async () => {
    /* The half a reading over the whole file would get wrong: emptying `teamId` on
       everybody would pass every case above and leave the portal with no teams at all.
       Nišavski maraton klub keeps its people, and its own page still counts them. */
    const server = aServerThatDeletes()
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000001', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/timovi')
    })

    await router.navigate('/sr/tim/nisavski-maraton-klub')

    /* The count itself and not „not empty": emptying one member of another team would
       pass a reading that only refuses nought, and that member loses their team while
       their team loses their points (review, 05.09.2026). Nišavski has five. */
    expect(await screen.findByText('Niš · 5 članova')).toBeVisible()

    /* AND THE ONE REQUEST WENT TO THE ONE TEAM. „Nobody outside it was touched" is about
       the roster; this is the same claim about the ADDRESS, and it is the half the walk
       cannot see, because the session takes the row out either way. */
    expect(writes(server.asked)).toEqual([
      { path: `/api/teams/${String(teamAt('dunavski-trkaci').id)}`, how: 'DELETE' },
    ])

    server.stop()
  }, SLOW)

  /**
   * WHERE THE DELETION GOES, AND WHO DECIDES THE WINDOW, MEASURED ON A TEAM THAT IS NOT THE
   * OBVIOUS ONE.
   *
   * <p><b>Vardarski krug rather than Dunavski trkači, and the axes are counted rather than
   * felt.</b> Dunav is served FIRST and carries the LOWEST key of the four, so „this team",
   * „the first team on the list" and „the team with the smallest number" are one value there
   * and an address built off any of the three is the same address. Vardar is served third of
   * four and keyed third of four, so those are three different documents; it has FIVE members
   * rather than one, so „its members" is not „the only member"; and the other three teams have
   * members of their own, so a filter on the wrong key draws somebody rather than nobody.
   *
   * <p><b>000003 holds Vardar's seat and stands in it</b>, which is what
   * `data/teamAdmin.ts` reads to put „Obriši" on the page at all.
   */
  describe('and the address it is sent to, and whose the window is', () => {
    const VARDAR = 'vardarski-krug'

    const ITS_NAME = 'Vardarski krug'

    /** Presses „Obriši" and then „Potvrdi brisanje", which is what the page asks for. */
    async function deleteIt(user: ReturnType<typeof setupUser>) {
      await user.click(await screen.findByRole('button', { name: `Obriši: ${ITS_NAME}` }))
      await user.click(screen.getByRole('button', { name: `Potvrdi brisanje: ${ITS_NAME}` }))
    }

    it('goes to DELETE on ITS OWN address, and never to the first team on the list',
      async () => {
        const server = aServerThatDeletes()
        const user = setupUser()
        renderAt(`/sr/tim/${VARDAR}`, 'competitor', '000003', undefined, DAY)

        await deleteIt(user)

        /* EVERY write of every verb, rather than „this one is among them": naming only the
           address expected would pass a screen that had also sent something else. */
        await waitFor(() => {
          expect(writes(server.asked)).toEqual([
            { path: `/api/teams/${String(teamAt(VARDAR).id)}`, how: 'DELETE' },
          ])
        })

        server.stop()
      }, SLOW)

    /**
     * THE WINDOW, MEASURED IN BOTH DIRECTIONS, AND NEITHER CASE LETS THIS SCREEN HAVE AN
     * OPINION ABOUT IT.
     *
     * <p>PDL P13b, owner 25.09.2026, choosing between three offered outcomes: „Van prozora
     * 1.10-31.12 ruta vraca 409, i to <b>i administratoru tima i administraciji</b>", the
     * outcome refused by name being „rok vazi za clana, ne za administraciju". The route asks
     * `SeasonClock.transferWindowOpen`; a second condition on this screen would be 1 October
     * with a second home.
     *
     * <p><b>Both halves are a SWAP OF THE SOURCE and not a removal of behaviour.</b> The day
     * the portal is read as and the answer the route gives are set to DISAGREE, once each
     * way. A screen carrying its own copy of the window fails one of the two: reading its
     * clock to suppress the sentence fails the first, and reading it to refuse before asking
     * fails the second.
     */
    it('says why it did not happen in the words of the ROUTE, on a day this screen would have '
      + 'called the window open', async () => {
        const server = aServerThatDeletes(() => refused('theWindowIsShut', 409))
        const user = setupUser()
        const { router } = renderAt(`/sr/tim/${VARDAR}`, 'competitor', '000003', undefined, DAY)

        await deleteIt(user)

        /* THE ROUTE'S REASON, IN THE SENTENCE THE ADMINISTRATION'S SCREEN ALREADY DRAWS FOR
           IT (`admin/teamWrites.ts`), because PDL P13b calls the two „ista radnja". */
        const said = await screen.findByRole('alert')

        expect(said).toHaveTextContent(
          'Prelazni rok je zatvoren. Otvara se 15. oktobra i traje do 31. decembra. '
            + 'Tim se do tada ne briše, ni iz administracije.',
        )

        /* AND IT IS NOT THE SENTENCE THE MEMBERSHIP PAGE DRAWS FOR THE SAME WORD, which is
           the whole point of `theWindowIsShut` living under two keys. That one ends „ostaješ
           tamo gde jesi", which is about the reader's own membership and says nothing about
           a team that is not going anywhere. */
        expect(said).not.toHaveTextContent('ostaješ tamo gde jesi')

        /* AND THE READER IS STILL ON THE TEAM'S PAGE. A screen that navigated anyway would
           carry him to the list of teams and leave the sentence behind with the screen. */
        expect(router.state.location.pathname).toBe(`/sr/tim/${VARDAR}`)
        expect(screen.getByRole('heading', { level: 1, name: ITS_NAME })).toBeVisible()

        /* AND THE ROSTER IS UNTOUCHED, which the check below cannot see by itself: it reads
           `TEAMS`, and `deleteOne` leaves `remove(TEAMS.id, ...)` uncalled on this branch, but
           nothing before this line said the same about `editRecord` over `roster`. Read right
           here rather than after navigating away, because a member written out of Vardar shows
           up in `everMembers` on this very page's next render, before anybody moves anywhere.
           Vardar has five (see the class comment above). */
        expect(await screen.findByText('Skoplje · 5 članova')).toBeVisible()

        /* AND THE TEAM IS STILL THERE, because nothing happened. Read on the list rather than
           on this page, which is where a session write to `TEAMS` would have shown itself. */
        await router.navigate('/sr/timovi')

        expect(
          (await listedTeams()).some((one) => new RegExp(ITS_NAME).test(one.textContent ?? '')),
        ).toBe(true)

        server.stop()
      }, SLOW)

    it('sends the deletion on a day this screen would have called the window SHUT, because '
      + 'the route decides and this screen does not', async () => {
        const server = aServerThatDeletes()
        const user = setupUser()
        const { router } = renderAt(`/sr/tim/${VARDAR}`, 'competitor', '000003', undefined, OUTSIDE)

        await deleteIt(user)

        /* THE REQUEST WENT AT ALL, which is the half a screen with its own clock would fail
           first: it would have refused before asking anybody. */
        await waitFor(() => {
          expect(writes(server.asked)).toEqual([
            { path: `/api/teams/${String(teamAt(VARDAR).id)}`, how: 'DELETE' },
          ])
        })

        await waitFor(() => {
          expect(router.state.location.pathname).toBe('/sr/timovi')
        })

        expect(
          (await listedTeams()).some((one) => new RegExp(ITS_NAME).test(one.textContent ?? '')),
        ).toBe(false)

        server.stop()
      }, SLOW)

    /**
     * A TEAM APPROVED DURING THIS VISIT IS NOT THE DATABASE'S, AND ITS DELETE IS SENT NOWHERE.
     *
     * <p>This is the boundary of the increment held as a case rather than as a paragraph, and
     * it is the same one `admin/adminTeams.test.tsx` holds for the other screen. Making a team
     * is still the session's, because no route makes one, and `admin/entityForms.ts` counts
     * identities DOWN from nought so that nothing it hands out collides with a `bigserial`. So
     * the team approved below is number `-1`, and a delete sent for it would go to
     * `DELETE /api/teams/-1` - the fault PR 368 closed one number along, where a panel posted
     * to `/api/leagues/-1/races`.
     *
     * <p><b>And the roster still goes with it by hand on this half</b>, because the server has
     * never heard of either the team or the membership: 000004's team is written into the
     * session by the approval and nowhere else. Left undone, that member kept a team nobody
     * could open (review, 05.09.2026).
     */
    it('sends nothing at all for a team approved during this visit, and still frees its '
      + 'founder', async () => {
        const server = aServerThatDeletes()
        const user = setupUser()
        const { router } = renderAt(
          '/sr/administracija/verifikacija/timovi',
          'superadmin',
          '000004',
          undefined,
          DAY,
        )

        const waiting = await screen.findByRole('heading', { name: 'Timočka trkačka družina' })
        const card = within(must(waiting.closest('li'), 'the card the team stands on'))

        await user.click(card.getByRole('button', { name: 'Odobri' }))

        /* TO ITS OWN PAGE BY THE ADDRESS THE PORTAL MADE FOR IT, followed rather than spelt
           out here: what a name turns into is `admin/entityForms.ts`'s business and a guess
           written down here would be a second answer to it. */
        await router.navigate('/sr/timovi')
        await user.click(await screen.findByRole('link', { name: 'Timočka trkačka družina' }))

        await screen.findByRole('heading', { level: 1, name: 'Timočka trkačka družina' })

        /* WHAT HAD BEEN SENT BEFORE THE DELETION, so that „nothing was sent" is a claim about
           the deletion and not about the visit. Approving is itself a write - the moderator's
           decision goes to `POST /api/verification/{id}/decision` - and the team it creates is
           still the session's, which is exactly the split this case is about. */
        const approving = writes(server.asked)

        expect(approving).toHaveLength(1)

        await user.click(
          await screen.findByRole('button', { name: 'Obriši: Timočka trkačka družina' }),
        )
        await user.click(
          screen.getByRole('button', { name: 'Potvrdi brisanje: Timočka trkačka družina' }),
        )

        await waitFor(() => {
          expect(router.state.location.pathname).toBe('/sr/timovi')
        })

        /* NOT ONE WRITE MORE, of any verb, to any address. The team itself is the session's
           and so was taking it away. */
        expect(writes(server.asked)).toEqual(approving)

        expect(
          (await listedTeams()).some((one) => /Timočka/.test(one.textContent ?? '')),
        ).toBe(false)

        /* And the founder is free again, which is what the roster being taken along by hand
           means to the person it happened to. */
        expect(await screen.findByRole('link', { name: 'Predloži tim' })).toBeVisible()

        /* AND NOBODY OUTSIDE THE TEAM LOST THEIRS WITH IT. Handing this half the whole list
           of members instead of this team's would pass every assertion above and leave the
           portal with nobody in any team, which is the same fault the served half is held
           against one case along. Dunav keeps its six. */
        await router.navigate('/sr/tim/dunavski-trkaci')

        expect(await screen.findByText(/6 članova/)).toBeVisible()

        server.stop()
      }, SLOW)
  })
})

/**
 * A REFUSAL IS ABOUT THE ATTEMPT IT ANSWERED, AND STANDS BESIDE THE BUTTON UNTIL IT STOPS BEING THE
 * PAGE'S (registry item 311; owner, 02.10.2026).
 *
 * <p><b>What stood on the page, measured.</b> `refused` was written when the route said no and
 * never cleared: pressing „Odustani od brisanja" put the question away and left „Prelazni rok je
 * zatvoren..." standing beside a button that asked nothing, and so did a change of season in the
 * picker beside it. The sentence is drawn by `ServerSaid` as an alert, so a reader heard a refusal
 * about a thing he had just taken back.
 *
 * <p>Since 02.10.2026 the refusal also closes the question (PDL, „Odbijanje zatvara pitanje kao i
 * uspeh"), so the sentence stands beside „Obriši" with the focus on it - which is the answer to the
 * register's „bez ijedne kontrole pored sebe".
 *
 * <p><b>Four ends of one sentence, and each is its own case</b>: the reader asks again and puts that
 * question away; a second attempt starts, when the old sentence must not stand over the new request;
 * the season changes; and the address changes to another team's page, which is the same component
 * with another team in it (`app/routeObjects.tsx` carries no `key` on this route).
 *
 * <p><b>Dunavski trkači is the other team in the last case</b> and Vardarski krug the one refused,
 * so „the team on the page" is a thing that can be told apart from „a team".
 */
describe('a refusal of the deletion of a team', () => {
  const VARDAR = 'vardarski-krug'
  const ITS_NAME = 'Vardarski krug'

  /** The question asked and answered once, and the route's refusal on the page. */
  async function refusedOnce(user: ReturnType<typeof setupUser>) {
    const server = aServerThatDeletes(() => refused('theWindowIsShut', 409))
    const view = renderAt(`/sr/tim/${VARDAR}`, 'competitor', '000003', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: `Obriši: ${ITS_NAME}` }))
    await user.click(screen.getByRole('button', { name: `Potvrdi brisanje: ${ITS_NAME}` }))
    await screen.findByRole('alert')

    return { server, router: view.router }
  }

  it('goes when the season is changed', async () => {
    const user = setupUser()
    const { server } = await refusedOnce(user)

    const picker = screen.getByLabelText('Sezona')
    const options = within(picker).getAllByRole('option')

    /* THE FIXTURE HAS TO OFFER A SECOND SEASON, or the case would measure nothing: a select with
       one option cannot be changed. Measured against what the team really has, not assumed. */
    expect(options.length, 'a team with results in more than one season').toBeGreaterThan(1)

    const other = must(
      options.find((one) => !(one instanceof HTMLOptionElement && one.selected)),
      'a season other than the one shown',
    )

    await user.selectOptions(picker, must(other.getAttribute('value'), 'its value'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('is not carried to the page of another team', async () => {
    const user = setupUser()
    const { server, router } = await refusedOnce(user)

    await router.navigate('/sr/tim/dunavski-trkaci')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' }),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('is drawn again by a refusal on a page that was left and come back to', async () => {
    /* THE RESET MUST NOT BE A SWITCH THAT STAYS OFF: clearing it when the address changes is not
       the same as never drawing it after the address has changed. */
    const user = setupUser()
    const { server, router } = await refusedOnce(user)

    await router.navigate('/sr/tim/dunavski-trkaci')
    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })
    await router.navigate(`/sr/tim/${VARDAR}`)

    await user.click(await screen.findByRole('button', { name: `Obriši: ${ITS_NAME}` }))
    await user.click(screen.getByRole('button', { name: `Potvrdi brisanje: ${ITS_NAME}` }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Prelazni rok je zatvoren.')

    server.stop()
  }, SLOW)

  /*
   * THE ENDS THAT ARE EVENTS, AFTER 02.10.2026 (PDL, „Odbijanje zatvara pitanje kao i uspeh"): the
   * refusal closes the question itself and the sentence stands beside the button that asked. The
   * reader's end of it is therefore the SECOND asking's - he asks again, and puts that one away - and
   * the start of a second attempt is an asking of its own.
   */
  it('goes when a question asked again is put away', async () => {
    const user = setupUser()
    const { server } = await refusedOnce(user)

    await user.click(screen.getByRole('button', { name: `Obriši: ${ITS_NAME}` }))
    await user.click(screen.getByRole('button', { name: `Odustani od brisanja: ${ITS_NAME}` }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Obriši: ${ITS_NAME}` })).toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('goes when a second asking is answered, and comes back if that one is refused too', async () => {
    const user = setupUser()
    const { server } = await refusedOnce(user)

    /* THE SECOND DELETION IS HELD, in front of the recording server, so what is read is the page
       WHILE it is out: the old sentence must not stand over a request that has not been answered. */
    let letItAnswer = () => {}
    const held = new Promise<void>((resolve) => {
      letItAnswer = resolve
    })
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        await held
      }

      return answering(input, init)
    }

    await user.click(screen.getByRole('button', { name: `Obriši: ${ITS_NAME}` }))
    await user.click(screen.getByRole('button', { name: `Potvrdi brisanje: ${ITS_NAME}` }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    letItAnswer()

    expect(await screen.findByRole('alert')).toHaveTextContent('Prelazni rok je zatvoren.')

    server.stop()
  }, SLOW)

  it('stands beside the button the question came from, until one of the four', async () => {
    const user = setupUser()
    const { server } = await refusedOnce(user)

    expect(screen.getByRole('alert')).toHaveTextContent('Prelazni rok je zatvoren.')
    /* THE QUESTION HAS CLOSED, and the focus is on the button the sentence stands beside. */
    expect(
      screen.queryByRole('button', { name: `Potvrdi brisanje: ${ITS_NAME}` }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Obriši: ${ITS_NAME}` })).toHaveFocus()

    server.stop()
  }, SLOW)
})
