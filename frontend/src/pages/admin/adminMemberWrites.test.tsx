import { screen, waitFor, within } from '@testing-library/react'
import { arrivedResource, clearResourceCache, loadResource, type ResourceName } from '../../data/client'
import type { Competitor } from '../../data/types'
import { person } from '../../test/plate'
import { renderAt } from '../../test/render'
import { answeredWith, did, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'

/**
 * THE ADMINISTRATION'S SCREEN OF MEMBERS SENDS ITS ONE VERB TO THE SERVER (B107).
 *
 * **NOTHING IN THE FIXTURE IS THE ONLY ONE OF ITS KIND, AND THE AXES ARE COUNTED**, the way
 * `AdminModerators.test.tsx` counts its own:
 *
 * - **Served neither alphabetically nor by number**, so a screen that quietly sorted its own
 *   copy would pass this fixture and fail the next one that arrived already in order.
 * - **The member every write is aimed at is NEITHER first in the list NOR first by number.**
 *   `000007` stands second and is the highest number of the three, so `rows[0]`,
 *   `served[0]` and „the smallest number" are three different members and none of them is
 *   the one under test. A screen that deleted the first row, or the first served record,
 *   would look right on a fixture of one and is caught by this one.
 * - **Three members, so a deletion leaves two**, and „the list is empty" can never stand in
 *   for „that row is gone".
 * - **Two of them share a town** (`Niš`), so the town cell cannot be read as an identity
 *   either.
 *
 * Nothing is read out of what was pressed. Every assertion about a write reads the request
 * the screen really made, off the recording server.
 */
describe('the members screen', () => {
  const DELETED = '000007'

  const MEMBERS: Competitor[] = [
    { ...person('000004', 'Zoran', 'Vuković'), city: 'Niš' },
    { ...person(DELETED, 'Ana', 'Jovanović'), city: 'Novi Sad' },
    { ...person('000005', 'Marko', 'Petrović'), city: 'Niš' },
  ]

  const TEAMS = [{ id: 3, name: 'Trkači', slug: 'trkaci', organiserMemberNumber: '000004' }]

  /** The five `AdminMembers.tsx`'s own note names as cascading off a deleted competitor
   *  (V7:557, V12:114-118, V7:594, V7:646+V33:89, V9:67), plus `payments`, which the same
   *  note names as a DERIVED list rather than a cascade (`PaymentsDueApi.due()`'s join
   *  onto `competitor`, PR 397's review) - six in all, beside `competitors` and `teams`,
   *  which the case below already counts by hand. */
  const ALSO_CLEARED: ResourceName[] = [
    'results',
    'pairs',
    'attendance',
    'comments',
    'verification',
    'payments',
  ]

  /**
   * The three served above, with whatever a case wants said about a write.
   *
   * **Its own server rather than a line in `test/setup.ts`**, which is deliberate and is
   * the note that file already carries: its `/^\/api\/([a-z]+)$/` does not match an address
   * with an identity on the end, so `/api/competitors/000007` would fall through to the
   * disc and be answered 404 by a fixture nobody wrote for it. A case that needs that
   * address answered brings its own server instead of widening the shared one.
   */
  function serving(
    toAWrite: (asked: string, init: RequestInit | undefined) => Response | Promise<Response> = did,
  ) {
    clearResourceCache()

    return serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (path === '/api/competitors' && how === 'GET') {
        return new Response(JSON.stringify(MEMBERS), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (path === '/api/teams' && how === 'GET') {
        return new Response(JSON.stringify(TEAMS), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
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

  /** How many times one address was READ, which is what a cleared cache shows up as. */
  function reads(asked: Asked[], address: string): number {
    return asked.filter(
      (one) => one.path === address && (one.init?.method ?? 'GET') === 'GET',
    ).length
  }

  /** Presses Delete on a named member, both times, which is what the row asks for. */
  async function deleteNamed(user: ReturnType<typeof setupUser>, name: string) {
    const button = await screen.findByRole('button', { name: `Obriši: ${name}` })
    const row = must(button.closest('tr'), `the row of ${name}`)

    await user.click(button)
    await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${name}` }))

    return row
  }

  /** Away to another screen and back, with the other screen really drawn in between - two
   *  navigations with nothing between them do not unmount anything. */
  async function awayAndBack(router: ReturnType<typeof renderAt>['router']) {
    await router.navigate('/sr/administracija/timovi')
    await screen.findByRole('table', { name: 'Timovi' })
    await router.navigate('/sr/administracija/clanovi')
    await screen.findByRole('table', { name: 'Članovi' })
  }

  it('draws the served rows in the order the server sent them, not its own', async () => {
    const server = serving()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Članovi' })
    const names = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => must(row.textContent, 'a row with words in it'))

    expect(names.map((one) => one.includes('Zoran'))).toEqual([true, false, false])
    expect(names.map((one) => one.includes('Ana'))).toEqual([false, true, false])
    expect(names.map((one) => one.includes('Marko'))).toEqual([false, false, true])

    server.stop()
  })

  /**
   * THE BOUNDARY, AND IT IS THREE SEPARATE ABSENCES RATHER THAN ONE.
   *
   * <p>Each of the three was a live control until 26.09.2026 and each wrote somewhere no
   * route reads. They are asked for one at a time because they went for three different
   * reasons, which the screen's own note sets out: „Nov član" because `POST` is the group
   * entry and a different act (PDL P8b), and the other two because there is no `PUT` at
   * all.
   *
   * <p><b>This is also the floor under `memberWrites.ts`'s claim that nothing makes a member
   * in the session any more</b>, which is what lets that module carry no
   * `standsOnTheServer`. Asked of the DOM rather than of the source, because „is there a
   * control that does this" is a question one look answers.
   */
  it('offers nothing that writes where no route reads: no new member, no open, no town cell',
    async () => {
      const server = serving()
      renderAt('/sr/administracija/clanovi', 'superadmin')

      const table = await screen.findByRole('table', { name: 'Članovi' })

      expect(screen.queryByRole('button', { name: 'Nov član' })).not.toBeInTheDocument()
      expect(within(table).queryByRole('button', { name: /^Otvori:/ })).not.toBeInTheDocument()
      /* The town is drawn and is not a control. `EditableCell` renders a button whose
         accessible name ends in the word that opens it, so the town being a button at all
         is the whole of what this refuses. */
      expect(within(table).queryByRole('button', { name: /Niš/ })).not.toBeInTheDocument()
      expect(within(table).getAllByText('Niš')).toHaveLength(2)
      /* And the one control a row does still carry, so this case cannot pass by the table
         being empty or unread. */
      expect(within(table).getAllByRole('button', { name: /^Obriši:/ })).toHaveLength(3)

      server.stop()
    })

  /**
   * WHAT A ROW DRAWS OF A MEMBER, WHICH CAME HERE FROM `entityForms.test.tsx` ON 26.09.2026.
   *
   * <p>It used to be asked of a member TYPED INTO the member form, in „a record that is
   * entered rather than changed". That form is gone (PDL P8b), and the claims came here rather
   * than going with it, because the table is still drawn and these are claims about the table.
   *
   * <p><b>Over a served member they are stronger than they were.</b> A typed record and the
   * row drawn from it come out of one act, so the two could agree by being wrong about the
   * same field together - the trap `CLAUDE.md` names „dva izvora, jedna vrednost". Read off a
   * fixture the server answered, the row has nowhere to get these words from but the record.
   *
   * <p><b>Her own row and not the first one.</b> The beginner is third in the fixture and her
   * number is the lowest of the three, so neither „the first row" nor „the smallest number"
   * finds her.
   */
  it('draws the category a member carries, her town and the basis of her membership', async () => {
    const beginner: Competitor = {
      ...person('000002', 'Milica', 'Pavlović'),
      gender: 'F',
      ageBand: '25-39',
      firstSeason2027: true,
      city: 'Kraljevo',
      membershipBasis: 'feeExempt',
    }
    clearResourceCache()
    const server = serverThat((path, init) =>
      path === '/api/competitors' && (init?.method ?? 'GET') === 'GET'
        ? new Response(JSON.stringify([...MEMBERS, beginner]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : null,
    )
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Članovi' })
    const row = within(must(within(table).getByText('000002').closest('tr'), 'her row'))

    expect(row.getByText('Milica Pavlović')).toBeVisible()
    /* „Početnice" and not „Ž25-39": a beginner carries that category INSTEAD of her band and
       never both (owner, 03.08.2026), so this also says the band is being read through
       `categoryOfMember` and the dictionary rather than printed raw. */
    expect(row.getByText('Početnice')).toBeVisible()
    expect(row.queryByText('Ž25-39')).not.toBeInTheDocument()
    expect(row.getByText('Kraljevo')).toBeVisible()
    expect(row.getByText('Oslobođen članarine')).toBeVisible()

    /* And no year of birth anywhere on the row, which is the half of this that is about
       privacy rather than about wording: the record is served to anybody who asks for its
       address (ADL A8), so a year drawn only here would still have been public. */
    expect(row.queryByText(/19\d\d/)).not.toBeInTheDocument()

    server.stop()
  })

  it('sends a deletion to DELETE on that member’s own address, saying what becomes of the account',
    async () => {
      const server = serving()
      const user = setupUser()
      renderAt('/sr/administracija/clanovi', 'superadmin')

      await deleteNamed(user, 'Ana Jovanović')

      await waitFor(() => {
        expect(writes(server.asked)).toEqual([
          { path: `/api/competitors/${DELETED}?account=delete`, how: 'DELETE' },
        ])
      })

      server.stop()
    }, SLOW)

  it('takes that row away and leaves the other two standing', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    await deleteNamed(user, 'Ana Jovanović')

    const table = await screen.findByRole('table', { name: 'Članovi' })

    await waitFor(() => {
      expect(within(table).queryByText('Jovanović')).toBeNull()
    })

    expect(within(table).getByText(/Vuković/)).toBeVisible()
    expect(within(table).getByText(/Petrović/)).toBeVisible()

    server.stop()
  }, SLOW)

  /**
   * THE REFUSAL IS THE ROUTE'S WORD AND NOT THIS SCREEN'S GUESS.
   *
   * <p>Nothing on the screen knows that this member administers the portal: the fixture
   * says nothing about it, and `Competitor` has no field that could. The sentence can only
   * have come from the answer, which is the axis - a screen that worked the reason out for
   * itself would be a second rule over one the route already holds.
   *
   * <p><b>TWO SOURCES, ONE VALUE, WHICH IS WHY THE SECOND ASSERTION EXISTS (PR 382's
   * review).</b> `WHEN_DELETING_A_MEMBER`'s own note says the Serbian sentence the route
   * names and its dictionary translation are, in this locale, THE SAME STRING. So a mapped
   * answer and an UNMAPPED one both put that sentence in front of a reader here: mapped, it
   * is the whole alert; unmapped, `ServerSaid`'s honest branch wraps it in „Server je odbio
   * zahtev uz razlog …, koji ovaj ekran ne prepoznaje." Read as a substring, as the first
   * assertion below does, the wrapped sentence STILL contains the bare one, so
   * `refusals={{}}` passed all thirteen cases in this file the day this was found. The
   * second assertion names the one phrase that can only be there if the map was never
   * asked, and the case after this one moves to English, where the two sources no longer
   * agree on a single word.
   */
  it('says why a deletion was refused, in the words the ROUTE named and not its own',
    async () => {
      const server = serving(() =>
        refused('Nalog ovog člana administrira portal, pa se član ne može obrisati odavde.', 409),
      )
      const user = setupUser()
      renderAt('/sr/administracija/clanovi', 'superadmin')

      const row = await deleteNamed(user, 'Ana Jovanović')
      const alert = await within(row).findByRole('alert')

      expect(alert).toHaveTextContent(
        'Nalog ovog člana administrira portal, pa se član ne može obrisati odavde.',
      )
      /* AND NOT THE WRAPPER `ServerSaid` reaches for when the map does not know the reason -
         the one phrase a mapped answer never carries, in either locale. Without this, the
         assertion above is satisfied whether or not `refusals` was ever consulted, because
         the wrapped sentence contains the bare one as a substring. */
      expect(alert).not.toHaveTextContent('ne prepoznaje')

      server.stop()
    }, SLOW)

  /**
   * THE SAME REFUSAL, READ IN ENGLISH, WHERE THE TWO SOURCES STOP AGREEING ON EVEN ONE WORD.
   *
   * <p>In Serbian the mapped sentence and the fallback's echo of the raw reason share every
   * word, which is what let `refusals={{}}` hide behind the case above. In English the
   * dictionary's `admin.memberDeleteRefused.theAccountAdministers` is a sentence of its own
   * - "This member's account administers the portal, so the member cannot be deleted from
   * here." - while the fallback still quotes the reason exactly as the route sent it,
   * UNTRANSLATED: "The server refused the request with the reason Nalog ovog člana
   * administrira portal…, which this screen does not recognise." The two share almost no
   * words at all, so this case would have caught `refusals={{}}` on the FIRST assertion
   * alone; the second is kept for the same reason the Serbian case keeps it.
   */
  it('says why a deletion was refused in English too, rather than an untranslated Serbian '
    + 'reason inside an English sentence', async () => {
      const server = serving(() =>
        refused('Nalog ovog člana administrira portal, pa se član ne može obrisati odavde.', 409),
      )
      const user = setupUser()
      renderAt('/en/administracija/clanovi', 'superadmin')

      const button = await screen.findByRole('button', { name: 'Delete: Ana Jovanović' })
      const row = must(button.closest('tr'), 'the row of Ana Jovanović')

      await user.click(button)
      await user.click(
        within(row).getByRole('button', { name: 'Confirm the deletion: Ana Jovanović' }),
      )

      const alert = await within(row).findByRole('alert')

      expect(alert).toHaveTextContent(
        "This member's account administers the portal, so the member cannot be deleted "
          + 'from here.',
      )
      expect(alert).not.toHaveTextContent('does not recognise')

      server.stop()
    }, SLOW)

  /**
   * AND THE ROW STAYS, WHICH IS MEASURED FROM OUTSIDE THIS SCREEN'S OWN STATE.
   *
   * <p><b>This is the guard PR 378's review found missing one entity along, and it is the
   * reason this case navigates at all.</b> „The row is still in the table" proves nothing
   * by itself: the table is drawn from `recordsOf` over the session overlay, and the whole
   * question is whether the screen wrote that overlay too early. Reading it in the same
   * tick asks the suspect about himself.
   *
   * <p>So the case leaves, comes back, and reads the list the SERVER answers. The server
   * goes on serving all three - it refused, so nothing changed there - and the only thing
   * that could hide one of them from a remounted screen is `session.remove` having run on
   * the strength of a press. Four mutations were run against this: dropping the
   * `answer.got !== 'done'` early return, moving `remove` above it, deleting the guard's
   * whole line, and writing `remove` in both branches. All four are caught here and none
   * of them by the case above.
   */
  it('keeps a refused member after the screen is left and returned to, not only on it',
    async () => {
      const server = serving(() => answeredWith(404))
      const user = setupUser()
      const { router } = renderAt('/sr/administracija/clanovi', 'superadmin')

      await deleteNamed(user, 'Ana Jovanović')
      await screen.findByRole('alert')

      await awayAndBack(router)

      const table = await screen.findByRole('table', { name: 'Članovi' })

      expect(within(table).getByText(/Jovanović/)).toBeVisible()
      expect(within(table).getAllByRole('row')).toHaveLength(4)

      server.stop()
    }, SLOW)

  it('does not bring a deleted member back after the screen is left and returned to', async () => {
    /* The server forgets him, exactly as the real one would, so this case cannot pass on
       the session overlay alone either: both halves agree only if both happened. */
    const remembered = [...MEMBERS]
    const server = serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (path === '/api/competitors' && how === 'GET') {
        return new Response(JSON.stringify(remembered), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (path === '/api/teams' && how === 'GET') {
        return new Response(JSON.stringify(TEAMS), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (how === 'DELETE') {
        remembered.splice(
          remembered.findIndex((one) => one.memberNumber === DELETED),
          1,
        )

        return did()
      }

      return how === 'GET' ? null : did()
    })
    clearResourceCache()
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/clanovi', 'superadmin')

    await deleteNamed(user, 'Ana Jovanović')
    await awayAndBack(router)

    const table = await screen.findByRole('table', { name: 'Članovi' })

    expect(within(table).queryByText(/Jovanović/)).toBeNull()
    expect(within(table).getByText(/Vuković/)).toBeVisible()

    server.stop()
  }, SLOW)

  /**
   * BOTH LISTS ARE READ AGAIN, AND THE SECOND IS THE ONE THAT WOULD BE FORGOTTEN.
   *
   * <p>A member who was the last of his team takes the team with him, so a screen of teams
   * remounted after a deletion would otherwise draw a team the server has already forgotten.
   * Counted rather than copied off another screen: the moderators clear one and the teams
   * clear two, so the number is a measurement each time.
   *
   * <p><b>The teams list is read BEFORE the deletion on purpose.</b> Asked only afterwards,
   * one read would prove nothing: a resource nobody had loaded is fetched on first sight
   * whether or not anything cleared it.
   *
   * <p><b>AND THE FIVE THE SCHEMA CASCADES OFF A COMPETITOR ARE GONE FROM THE CACHE TOO
   * (PR 382's review), AND SINCE PR 397'S REVIEW SO IS `payments`, A SIXTH.</b> Measured
   * through `arrivedResource` rather than through a screen, because no one screen on this
   * portal reads `results`, `pairs`, `attendance`, `comments`, `verification` and `payments`
   * all at once - `AdminMembers.tsx`'s own note names the migration that cascades each of
   * the first five off `competitor`, and names `payments` separately as a DERIVED list
   * instead (`PaymentsDueApi.due()`'s join onto `competitor`, not a foreign key). Loaded
   * directly here for the same reason, and confirmed IN HAND before the deletion, so „gone
   * afterwards" is a change this case can see rather than a guess about a resource nobody
   * had asked for yet.
   */
  it('reads the members again after a deletion, and the teams with them, and forgets the '
    + 'five the schema cascades from a competitor plus the derived list of payments', async () => {
    const server = serving()
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/timovi', 'superadmin')

    await screen.findByRole('table', { name: 'Timovi' })
    expect(reads(server.asked, '/api/teams')).toBe(1)

    await router.navigate('/sr/administracija/clanovi')
    await screen.findByRole('table', { name: 'Članovi' })

    const beforeMembers = reads(server.asked, '/api/competitors')

    await Promise.all(ALSO_CLEARED.map((name) => loadResource(name)))
    for (const name of ALSO_CLEARED) {
      expect(arrivedResource(name), `${name} never landed, so nothing below was measured`)
        .toBeDefined()
    }

    await deleteNamed(user, 'Ana Jovanović')
    await waitFor(() => {
      expect(writes(server.asked)).toHaveLength(1)
    })

    /* `clearResourceCache` runs synchronously once `deleteOne` reads the answer back, but
       that answer is still a promise settling on its own schedule, so this is waited for
       rather than read straight after the write above. */
    await waitFor(() => {
      for (const name of ALSO_CLEARED) {
        expect(arrivedResource(name), `${name} was still cached after the member left`)
          .toBeUndefined()
      }
    })

    await router.navigate('/sr/administracija/timovi')
    await screen.findByRole('table', { name: 'Timovi' })
    await router.navigate('/sr/administracija/clanovi')
    await screen.findByRole('table', { name: 'Članovi' })

    await waitFor(() => {
      expect(reads(server.asked, '/api/teams')).toBe(2)
    })
    await waitFor(() => {
      expect(reads(server.asked, '/api/competitors')).toBeGreaterThan(beforeMembers)
    })

    server.stop()
  }, SLOW)

  /**
   * THREE PERSONALITIES AND NEVER 403 (ADL A8, owner 13.09.2026).
   *
   * <p>The one who is not signed in is answered 401 and the one who is signed in without
   * the right is answered 404, the same answer as an address that is not there. Both are
   * said with the number in them, and the two numbers differ - which is the half a single
   * „it did not work" sentence would lose.
   */
  it.each([
    [401, 'Server je odgovorio brojem 401'],
    [404, 'Server je odgovorio brojem 404'],
  ])('says what the server answered when it was %s, with the number in it', async (status, said) => {
    const server = serving(() => answeredWith(status))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await deleteNamed(user, 'Ana Jovanović')

    expect(await within(row).findByRole('alert')).toHaveTextContent(said)

    server.stop()
  }, SLOW)

  /**
   * A MEMBER TAKEN AWAY HERE STAYS AWAY WHEN A NUMBER IS HANDED OUT TWO SCREENS ALONG.
   *
   * <p><b>This case came from `deleting.test.tsx` on 26.09.2026 and changed BOTH of its ends
   * on the way.</b> It used to delete a member and then enter one on the member form, which
   * was the second place that handed numbers out. The form is gone (PDL P8b), so the case
   * would have gone with it - except that neither end of what it measures has gone anywhere:
   * the deletion is now a real `DELETE` to the route, and numbers are still handed out when a
   * membership is activated (`admin/memberNumbers.ts:121`, ADL A4d).
   *
   * <p><b>The fault it exists for.</b> Deletions were one flat list of identities and the list
   * of records was filtered by it AFTER this visit's own entries had been merged in, so a
   * record arriving during the same visit could be filtered out by a deletion that had nothing
   * to do with it - and because the overlay of changes is keyed by the identity, one that did
   * survive would wear the town and the name of whoever had been deleted under that key.
   *
   * <p><b>A deletion does NOT free the number, and saying so would be the easy mistake here.</b>
   * `admin/memberNumbers.ts:64-71` puts the deleted back among the taken on purpose: deleting
   * unties the number from the person and the number stays spent, because it stands in old
   * results, old tables and a printed card (PDL P8, 31.07.2026). So what this case walks is a
   * deletion and a hand-out in one visit, not a number changing hands.
   *
   * <p><b>Why the two ends have to be different screens for this to say anything.</b> Both
   * halves used to be on one screen, so „the number came back" and „the row came back" could
   * be satisfied by one piece of state being wrong once. Walked across two screens in one
   * visit, the number is freed by an answer from the server and taken by a different flow
   * entirely, which is the shape the portal really has now.
   */
  /* A CASE STOOD HERE THAT WALKED FROM THIS SCREEN TO THE PAYMENTS TAB AND ACTIVATED A
   * MEMBERSHIP, to hold that a member deleted a moment earlier did not come back wearing the
   * number the activation handed out. It is gone with the mechanism it was about (27.09.2026).
   *
   * The number used to be worked out IN THE BROWSER, by `admin/memberNumbers.ts`, which counted
   * what it could see and read this screen's own deletions to know which numbers were free -
   * that is why the two screens had to be walked in one visit. The module is deleted: both
   * routes that activate a membership draw the number from a sequence on the server, for the
   * reason V16 gives, namely that a query reads what is there and what is there is missing
   * exactly the people who have left.
   *
   * What this case really guarded on THIS screen - that a deletion clears every cache a deleted
   * competitor appears in, so no later screen reads a row the server has forgotten - is held by
   * the cases above, one per resource, against the seven foreign keys `AdminMembers.tsx` names.
   */
  it('says one sentence out loud once a member is gone, and moves the focus off the row',
    async () => {
      const server = serving()
      const user = setupUser()
      renderAt('/sr/administracija/clanovi', 'superadmin')

      await deleteNamed(user, 'Ana Jovanović')

      await waitFor(() => {
        expect(screen.getByText('Član je obrisan.')).toBeInTheDocument()
      })

      /* Off the row that is about to vanish and onto the one control that cannot be it.
         The other six lists anchor on „Nov …"; this one has no such button any more, so
         the search field is what a reader lands on. */
      expect(document.activeElement).toBe(screen.getByLabelText('Pretraga'))

      server.stop()
    }, SLOW)
})
