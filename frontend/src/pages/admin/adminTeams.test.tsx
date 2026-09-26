import { screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import { moderatorWith, renderAt } from '../../test/render'
import { answeredWith, did, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'

/**
 * THE SCREEN OF TEAMS DELETES THROUGH THE SERVER (PDL P28c point 2, owner 24.09.2026: „Svi
 * ekrani administracije prestaju da pisu u sesijski sloj i pocinju da zovu rute"), AND IT IS
 * THE SAME ACT THE TEAM'S OWN ADMINISTRATOR PERFORMS (PDL P13b, owner 25.09.2026: „Superadmin
 * i moderator sa pravom nad timovima imaju isto dugme i iste posledice kao administrator tog
 * tima").
 *
 * <p><b>MAKING AND CHANGING A TEAM ARE NOT MEASURED HERE AGAINST A ROUTE, BECAUSE THERE IS
 * NONE.</b> The note on `admin/AdminTeams.tsx` states that boundary and how it was measured;
 * what this file adds is the one case that holds the SPLIT itself
 * (`sends nothing at all for a team entered during this visit`), so that the day a route for
 * making one arrives, the case that has to change says so by name.
 *
 * <p><b>NOTHING IN THE FIXTURE IS THE ONLY ONE OF ITS KIND, AND THE AXES ARE COUNTED.</b> The
 * team every case acts on is:
 *
 * <ul>
 * <li><b>neither the first served nor the last</b>, so „this team", „the first" and „the last"
 * are three different rows and an address built off the wrong one is a different address;</li>
 * <li><b>not the lowest key and not the highest</b>, for the same reason one number up;</li>
 * <li><b>a team WITH members, two of them</b>, so „its members" is not „the only member", and
 * with an EMPTY team beside it - which is the axis PDL P13a lives on and the one the old
 * `alsoRemove` used to act over;</li>
 * <li><b>administered by its SECOND member and not its first</b>, so „the organiser" and „the
 * first member of the team" are two different people;</li>
 * <li><b>beside a team whose members are somebody else's</b>, so
 * `teamId === team.id` is a claim that can fail rather than one that cannot.</li>
 * </ul>
 *
 * <p><b>AND THE SERVED ORDER IS THE REVERSE OF THE NAME ORDER, deliberately.</b> The route
 * answers `order by t.name, t.id` (`TeamApi`), so a screen that sorted for itself would agree
 * with a fixture served in name order whatever it did. Served backwards, the two answers are
 * different documents and `draws them in the order the server answered` can tell them apart.
 *
 * <p><b>Nothing is read out of what was sent in.</b> Every assertion about a write reads the
 * request the screen really made, off the recording server.
 */
describe('a team taken away from the administration', () => {
  /** The team every case acts on. Served second of four and keyed third of four. */
  const ACTED = 14

  const ITS_NAME = 'Savski tim'

  /** The one with nobody in it, which PDL P13a is about and which must still be deletable. */
  const EMPTY = 21

  const EMPTY_NAME = 'Moravski klub'

  /** Served first, so „the first row" is never the row being acted on. */
  const FIRST_SERVED = 12

  const FIRST_SERVED_NAME = 'Vardarski krug'

  /** Served last and keyed lowest, so neither of those is the acted team either. */
  const LAST_SERVED_NAME = 'Dunavski trkači'

  /**
   * THE FOUR TEAMS, IN AN ORDER THAT IS NOT THEIR NAME ORDER.
   *
   * By name they run Dunavski, Moravski, Savski, Vardarski; served, they run exactly
   * backwards. Only the fields this screen reads are written out, which is honest about what
   * is being measured: a served team carries more (`TeamApi.Team`), and none of the rest
   * reaches this table.
   */
  const TEAMS = [
    { id: FIRST_SERVED, slug: 'vardarski-krug', name: FIRST_SERVED_NAME, city: 'Skoplje',
      country: 'MK', bio: '', logo: null, crop: null, organizerMemberNumber: '000003' },
    { id: ACTED, slug: 'savski-tim', name: ITS_NAME, city: 'Šabac', country: 'RS',
      bio: '', logo: null, crop: null, organizerMemberNumber: '000007' },
    { id: EMPTY, slug: 'moravski-klub', name: EMPTY_NAME, city: 'Čačak', country: 'RS',
      bio: '', logo: null, crop: null, organizerMemberNumber: '' },
    { id: 9, slug: 'dunavski-trkaci', name: LAST_SERVED_NAME, city: 'Novi Sad', country: 'RS',
      bio: '', logo: null, crop: null, organizerMemberNumber: '000001' },
  ]

  /**
   * AND THE MEMBERS, ARRANGED ALONG THE SAME AXES.
   *
   * 000002 is in the acted team and 000007 administers it, so the roster is two people and
   * the seat is not the first of them. 000003 is in another team, so a filter on the wrong
   * key draws the wrong roster rather than an empty one. 000005 is in no team at all.
   */
  const MEMBERS = [
    { memberNumber: '000002', firstName: 'Relja', lastName: 'Momčilović', teamId: ACTED },
    { memberNumber: '000007', firstName: 'Strahinja', lastName: 'Vukićević', teamId: ACTED },
    { memberNumber: '000003', firstName: 'Anđelija', lastName: 'Vukotić', teamId: FIRST_SERVED },
    { memberNumber: '000005', firstName: 'Časlav', lastName: 'Radenković', teamId: null },
  ]

  function listOf(what: unknown): Response {
    return new Response(JSON.stringify(what), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  /**
   * The four teams and the four members in front of the disc reader, with whatever a case
   * wants said about a write.
   *
   * <p><b>The VERB and not only the address</b>, which is the measurement `adminLeagues.test.tsx`
   * paid for: `GET /api/teams` and `POST /api/teams` are the same string, so a branch on the
   * path alone answers a write with the list - status 200, which `askTheServer` reads as „it
   * was done". Every case about a refusal would then pass through the success branch.
   *
   * <p><b>And every READ goes on to the disc unless it is one of these two</b>, because
   * `askTheServer` reads `/api/countries` to be handed the token and that read must not be
   * answered with whatever a case wrote for its WRITE.
   */
  function serving(
    toAWrite: (asked: string, init: RequestInit | undefined) => Response | Promise<Response> = did,
  ) {
    clearResourceCache()

    return serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (how === 'GET' && path === '/api/teams') {
        return listOf(TEAMS)
      }

      if (how === 'GET' && path === '/api/competitors') {
        return listOf(MEMBERS)
      }

      return how === 'GET' ? null : toAWrite(path, init)
    })
  }

  /** What was written, and to where: the recording server's own account of it. */
  function writes(asked: Asked[]): { path: string; how: string }[] {
    return asked
      .filter((one) => one.init?.method !== undefined && one.init.method !== 'GET')
      .map((one) => ({ path: one.path, how: String(one.init?.method) }))
  }

  /** How many times a resource was asked for, which is the whole of the cache question. */
  function reads(asked: Asked[], path: string): number {
    return asked.filter((one) => one.path === path && (one.init?.method ?? 'GET') === 'GET').length
  }

  /** Presses Delete on a named team, both times, which is what the row asks for. */
  async function deleteNamed(user: ReturnType<typeof setupUser>, name: string) {
    const rows = within(await screen.findByRole('table', { name: 'Timovi' }))
    const row = must(
      rows.getAllByRole('row').find((one) => one.textContent?.includes(name)),
      `the row of ${name}`,
    )

    await user.click(within(row).getByRole('button', { name: `Obriši: ${name}` }))
    await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${name}` }))

    return row
  }

  /** A day inside the transfer window, and one outside it (PDL P13b, 1.10-31.12). */
  const IN_WINDOW = '2026-10-15'

  const OUTSIDE = '2026-06-15'

  it('sends the deletion to DELETE on ITS OWN address, and never to the first team served',
    async () => {
      const server = serving()
      const user = setupUser()
      renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

      await deleteNamed(user, ITS_NAME)

      await waitFor(() => {
        expect(writes(server.asked)).toEqual([
          { path: `/api/teams/${String(ACTED)}`, how: 'DELETE' },
        ])
      })

      server.stop()
    }, SLOW)

  it('takes that row away and says so once, for whoever is not watching the list', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

    await deleteNamed(user, ITS_NAME)

    const listed = () => within(screen.getByRole('table', { name: 'Timovi' }))

    await waitFor(() => {
      expect(listed().queryByText(ITS_NAME)).toBeNull()
    })

    /* AND THE OTHER THREE ARE STILL THERE, so „the row went" is not „the table emptied". */
    expect(listed().getByText(FIRST_SERVED_NAME)).toBeVisible()
    expect(listed().getByText(EMPTY_NAME)).toBeVisible()
    expect(listed().getByText(LAST_SERVED_NAME)).toBeVisible()
    expect(screen.getByText('Tim je obrisan.')).toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('deletes the team that has NOBODY in it too, which is the one PDL P13a is about',
    async () => {
      const server = serving()
      const user = setupUser()
      renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

      await deleteNamed(user, EMPTY_NAME)

      await waitFor(() => {
        expect(writes(server.asked)).toEqual([
          { path: `/api/teams/${String(EMPTY)}`, how: 'DELETE' },
        ])
      })

      server.stop()
    }, SLOW)

  /**
   * THE WINDOW, MEASURED IN BOTH DIRECTIONS, AND NEITHER CASE LETS THE SCREEN HAVE AN OPINION
   * ABOUT IT.
   *
   * PDL P13b, owner 25.09.2026, choosing between three offered outcomes: „Van prozora
   * 1.10-31.12 ruta vraca 409, i to i administratoru tima i administraciji." The route asks
   * `SeasonClock.transferWindowOpen`; a second condition on this screen would be that window
   * with a second home.
   *
   * <p><b>Both halves are a SWAP OF THE SOURCE and not a removal of behaviour.</b> The day the
   * screen is read as and the answer the route gives are set to DISAGREE, once each way. A
   * screen carrying its own copy of 1 October fails one of the two: reading its clock to
   * suppress the sentence fails the first, and reading it to refuse before asking fails the
   * second.
   */
  it('says why a deletion did not happen in the words of the ROUTE, on a day it would have '
    + 'called the window open', async () => {
      const server = serving(() => refused('theWindowIsShut', 409))
      const user = setupUser()
      renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

      const row = await deleteNamed(user, ITS_NAME)

      /* THE ROUTE'S REASON, IN THE ADMINISTRATION'S OWN SENTENCE. Beside the row it was
         pressed in, as an alert. */
      const said = await within(row).findByRole('alert')

      expect(said).toHaveTextContent(
        'Prelazni rok je zatvoren. Otvara se 1. oktobra i traje do 31. decembra. '
          + 'Tim se do tada ne briše, ni iz administracije.',
      )

      /* AND IT IS NOT THE SENTENCE THE MEMBERSHIP PAGE DRAWS FOR THE SAME REASON, which is
         the whole point of `theWindowIsShut` living in two dictionaries under two keys
         (`admin/teamWrites.ts`). That one ends „ostaješ tamo gde jesi", which is about the
         reader's own team and says nothing a moderator can act on. */
      expect(said).not.toHaveTextContent('ostaješ tamo gde jesi')

      /* AND THE ROW IS STILL THERE, because nothing happened. */
      expect(within(screen.getByRole('table', { name: 'Timovi' })).getByText(ITS_NAME))
        .toBeVisible()

      server.stop()
    }, SLOW)

  it('takes the row away on a day it would have called the window SHUT, because the route '
    + 'decides and this screen does not', async () => {
      const server = serving()
      const user = setupUser()
      renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, OUTSIDE)

      await deleteNamed(user, ITS_NAME)

      /* THE REQUEST WENT AT ALL, which is the half a screen with its own clock would fail
         first: it would have refused before asking anybody. */
      await waitFor(() => {
        expect(writes(server.asked)).toEqual([
          { path: `/api/teams/${String(ACTED)}`, how: 'DELETE' },
        ])
      })

      await waitFor(() => {
        expect(within(screen.getByRole('table', { name: 'Timovi' })).queryByText(ITS_NAME))
          .toBeNull()
      })

      server.stop()
    }, SLOW)

  /**
   * WHAT THE ADMINISTRATION IS TOLD WHEN THE ROUTE ANSWERS 404, WHICH CARRIES NO REASON AT
   * ALL.
   *
   * ADL A8, owner 13.09.2026: „prijavljen kome pravo nedostaje dobija 404, isti odgovor kao
   * da adresa ne postoji", and `TeamWriteApi.remove` says in as many words that its 404 is
   * empty and covers four callers at once. So there is nothing to look up in any dictionary,
   * and the screen must say what it honestly can with the number in it rather than choose the
   * nearest refusal it happens to know.
   */
  it('says the number and nothing it cannot know, where the route answered an empty 404',
    async () => {
      const server = serving(() => answeredWith(404))
      const user = setupUser()
      renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

      const row = await deleteNamed(user, ITS_NAME)
      const said = await within(row).findByRole('alert')

      expect(said).toHaveTextContent(
        'Server je odgovorio brojem 404 i ništa nije promenjeno. Pokušaj ponovo za koji minut.',
      )

      /* AND IT DOES NOT REACH FOR THE WINDOW'S SENTENCE, which is the one refusal this
         screen's dictionary holds and the one a 404 has not got. */
      expect(said).not.toHaveTextContent('Prelazni rok')
      expect(within(screen.getByRole('table', { name: 'Timovi' })).getByText(ITS_NAME))
        .toBeVisible()

      server.stop()
    }, SLOW)

  /**
   * AND THE SESSION IS NOT WRITTEN OVER A REFUSED DELETION, WHICH IS WHERE `alsoRemove` USED
   * TO LIVE.
   *
   * <p>Until 26.09.2026 this row handed `RowActions` an `alsoRemove` that blanked `teamId` on
   * every member of the team. `RowActions.deleteRow` runs that BEFORE it asks anybody and
   * regardless of the answer, so a refused deletion emptied the roster of a team that is still
   * standing. The mutation that proves this case: put `alsoRemove` back and watch the head
   * count of a refused team fall to nought while the row is still there.
   */
  it('leaves the head count alone when the route refused, because nothing went with a team '
    + 'that did not go', async () => {
      const server = serving(() => refused('theWindowIsShut', 409))
      const user = setupUser()
      renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

      const row = await deleteNamed(user, ITS_NAME)

      await within(row).findByRole('alert')

      /* TWO, WHICH IS WHAT IT WAS. Read off the row that is still standing, and the number is
         the one the fixture put there rather than „not nought". */
      const cells = within(screen.getByRole('table', { name: 'Timovi' }))
        .getAllByRole('row')
        .filter((one) => one.textContent?.includes(ITS_NAME))

      expect(within(must(cells[0], 'the row of the refused team')).getByText('2')).toBeVisible()

      server.stop()
    }, SLOW)

  /**
   * THE ORDER IS THE SERVER'S, AND THIS CASE CAN TELL THE DIFFERENCE.
   *
   * The fixture is served in the reverse of its own name order, so a screen that sorted would
   * draw a different document. `TeamApi` answers `order by t.name, t.id`, which makes sorting
   * here a second answer to a question the route already answered.
   */
  it('draws the teams in the order the server answered and does not sort them itself',
    async () => {
      const server = serving()
      renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

      const rows = within(await screen.findByRole('table', { name: 'Timovi' }))
        .getAllByRole('row')
        .slice(1)
        .map((one) => must(one.textContent, 'a row of the table'))

      expect(rows).toHaveLength(4)
      expect(rows[0]).toContain(FIRST_SERVED_NAME)
      expect(rows[1]).toContain(ITS_NAME)
      expect(rows[2]).toContain(EMPTY_NAME)
      expect(rows[3]).toContain(LAST_SERVED_NAME)

      server.stop()
    }, SLOW)

  /**
   * A TEAM ENTERED DURING THIS VISIT IS NOT THE DATABASE'S, AND ITS DELETE IS SENT NOWHERE.
   *
   * <p>This is the boundary of the increment held as a case rather than as a paragraph.
   * Making a team is still the session's, because no route makes one (`admin/AdminTeams.tsx`
   * says how that was measured), and `entityForms.idFor` counts identities DOWN from nought so
   * that nothing it hands out collides with a `bigserial`. So the row entered here is number
   * `-1`, and a delete sent for it would go to `DELETE /api/teams/-1` - the fault PR 368 closed
   * one number along, where a panel posted to `/api/leagues/-1/races`.
   *
   * <p><b>The assertion is over EVERY write, not over the absence of one address.</b> „Nothing
   * was sent" is the claim; naming `/api/teams/-1` would pass a screen that had invented some
   * other address for the same row.
   */
  it('sends nothing at all for a team entered during this visit, and still takes its row away',
    async () => {
      const server = serving()
      const user = setupUser()
      renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

      await screen.findByRole('table', { name: 'Timovi' })
      await user.click(screen.getByRole('button', { name: 'Novi tim' }))
      await user.type(screen.getByLabelText(/^Naziv tima/), 'Probni tim')
      await user.type(screen.getByLabelText(/^Mesto/), 'Užice')
      await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
      await user.selectOptions(screen.getByLabelText(/^Organizator tima/), '000005')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

      await screen.findByText('Probni tim')
      await deleteNamed(user, 'Probni tim')

      expect(within(screen.getByRole('table', { name: 'Timovi' })).queryByText('Probni tim'))
        .toBeNull()

      /* NOT ONE WRITE, of any verb, to any address. Making it was the session's and so was
         taking it away. */
      expect(writes(server.asked)).toEqual([])

      server.stop()
    }, SLOW)

  /**
   * WHAT THE NEXT MOUNT READS, WHICH IS THE SERVER AND NOT THIS VISIT'S FIRST ANSWER.
   *
   * <p>A review of PR 368 measured this on the competitions: a screen that is still mounted
   * never asks its resource again, so the cache fetched at the first mount answered the next
   * one with the row still in it. `AdminTeams.deleteOne` empties that entry, and for TWO
   * resources rather than one.
   */
  describe('after the screen is left and returned to', () => {
    /**
     * A SERVER THAT REMEMBERS, so that the SECOND read answers with different content.
     *
     * <p><b>This is the swap of the source, and without it the case measures nothing.</b> A
     * fixture that answers the same array both times cannot tell „asked again" from „read the
     * cache": the screen draws the same table either way. What proves the cache was dropped is
     * that the second answer is a DIFFERENT document and the screen shows the second one.
     */
    function servingWithMemory() {
      clearResourceCache()

      let teams = [...TEAMS]
      let members = [...MEMBERS]

      return serverThat((path, init) => {
        const how = init?.method ?? 'GET'

        if (how === 'GET' && path === '/api/teams') {
          return listOf(teams)
        }

        if (how === 'GET' && path === '/api/competitors') {
          return listOf(members)
        }

        const which = /^\/api\/teams\/(-?\d+)$/.exec(path)

        if (which !== null && how === 'DELETE') {
          const gone = Number(which[1])

          /* WHAT THE ROUTE REALLY DOES TO BOTH TABLES: the team goes, and the memberships of
             everybody in it cascade (V11). The second half is what makes the second resource
             worth asking for again, and a fake server that only forgot the team would let a
             screen pass while leaving every member pointing at it. */
          teams = teams.filter((one) => one.id !== gone)
          members = members.map((one) => (one.teamId === gone ? { ...one, teamId: null } : one))

          return did()
        }

        return how === 'GET' ? null : did()
      })
    }

    /**
     * AWAY TO ANOTHER SCREEN AND BACK, WITH THE OTHER SCREEN REALLY DRAWN IN BETWEEN.
     *
     * Two `router.navigate` calls one after the other do not unmount anything, which a review
     * measured on 25.09.2026 with a probe: the screen never left and never mounted a second
     * time, and cases passed with the production fix taken back out. So this waits for
     * something only the OTHER screen has - the competitions have a table called „Lige" and
     * this screen has none - before coming back.
     */
    async function awayAndBack(router: ReturnType<typeof renderAt>['router']) {
      await router.navigate('/sr/administracija/lige')
      await screen.findByRole('table', { name: 'Lige' })
      await router.navigate('/sr/administracija/timovi')
    }

    it('does not bring a deleted team back', async () => {
      const server = servingWithMemory()
      const user = setupUser()
      const { router } = renderAt(
        '/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW,
      )

      await deleteNamed(user, ITS_NAME)
      await waitFor(() => {
        expect(within(screen.getByRole('table', { name: 'Timovi' })).queryByText(ITS_NAME))
          .toBeNull()
      })

      await awayAndBack(router)

      const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

      expect(listed.queryByText(ITS_NAME)).toBeNull()
      expect(listed.getByText(FIRST_SERVED_NAME)).toBeVisible()

      server.stop()
    }, SLOW)

    /**
     * AND IT ASKS FOR THE MEMBERS AGAIN TOO, WHICH IS THE HALF THAT IS EASY TO MISS.
     *
     * <p>A deleted team empties the memberships of everybody in it on the server (V11
     * cascades), and a member's team reaches this portal as `Competitor.teamId` off
     * `/api/competitors`. Clearing only `teams` leaves that answer in the cache, so the head
     * count beside every remaining row - and every other screen that draws somebody's club -
     * goes on counting people into a team that is gone.
     *
     * <p><b>Measured as the head count the reader really sees, and not only as a second
     * request.</b> A count read off a stale resource is the thing that is wrong; the request
     * is how it gets put right.
     */
    it('asks for the members again as well, so nobody is left counted into a team that is gone',
      async () => {
        const server = servingWithMemory()
        const user = setupUser()
        const { router } = renderAt(
          '/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW,
        )

        /* THE FIRST SERVED TEAM THIS TIME, so that a team with members remains after it and
           the count being checked is somebody else's rather than the deleted team's own. */
        await deleteNamed(user, FIRST_SERVED_NAME)
        await waitFor(() => {
          expect(within(screen.getByRole('table', { name: 'Timovi' }))
            .queryByText(FIRST_SERVED_NAME)).toBeNull()
        })

        const before = reads(server.asked, '/api/competitors')

        await awayAndBack(router)
        await screen.findByRole('table', { name: 'Timovi' })

        expect(reads(server.asked, '/api/competitors')).toBeGreaterThan(before)

        /* AND 000003, WHO WAS IN THE DELETED TEAM, IS COUNTED INTO NOTHING NOW. The acted team
           still has its two, which is what says the fresh answer was read rather than an empty
           one drawn. */
        const rows = within(screen.getByRole('table', { name: 'Timovi' })).getAllByRole('row')
        const acted = must(
          rows.find((one) => one.textContent?.includes(ITS_NAME)),
          'the row of the team that still has members',
        )

        expect(within(acted).getByText('2')).toBeVisible()

        server.stop()
      }, SLOW)
  })

  /**
   * WHO MAY OPEN THIS SCREEN AT ALL, WHICH IS THREE PEOPLE AND NOT TWO.
   *
   * <p>Without the third - the one who SUCCEEDS - „refused" is the only outcome the fixture
   * can produce, and a screen shut to everybody would pass every case about a refusal.
   */
  it('is open to a moderator holding the right over teams, and he can delete', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'moderator', null, moderatorWith(['entity:teams']),
      IN_WINDOW)

    expect(await screen.findByRole('table', { name: 'Timovi' })).toBeVisible()

    await deleteNamed(user, ITS_NAME)

    await waitFor(() => {
      expect(writes(server.asked)).toEqual([
        { path: `/api/teams/${String(ACTED)}`, how: 'DELETE' },
      ])
    })

    server.stop()
  }, SLOW)

  it('is shut to a moderator whose box for teams is not ticked', async () => {
    const server = serving()

    renderAt('/sr/administracija/timovi', 'moderator', null, moderatorWith(['entity:leagues']),
      IN_WINDOW)

    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent('Timovi')

    server.stop()
  }, SLOW)
})
