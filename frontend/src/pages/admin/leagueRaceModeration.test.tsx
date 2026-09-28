import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { arrivedResource, clearResourceCache } from '../../data/client'
import { renderAt } from '../../test/render'
import { did, isResource, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { at, first, must } from '../../test/at'
import { SLOW } from '../../test/slow'

/**
 * THE `+` THAT PUTS A RACE INTO A COMPETITION, AND THE CONTROL THAT TAKES ONE OUT
 * (PDL P15a and P28b point 7, owner 22. and 24.09.2026).
 *
 * **NOTHING IN THE FIXTURE IS THE ONLY ONE OF ITS KIND, AND THE AXES ARE COUNTED.**
 *
 * - **Three competitions**, and the one acted on is neither the first written nor the lowest
 *   key nor the only one of its season - so „this competition", „the first competition" and
 *   „the only one of 2027" are three different answers, and an address built off the wrong
 *   one is a different address.
 * - **A day of TWO races of which it counts ONE** (Beogradski maraton 2027, races 125 and
 *   126). That is the whole of B40 on a screen: „selekcijom događaja, selektujem automatski i
 *   sve njegove trke, a mogu i samo da selektujem neku od trka" (owner, 12.09.2026), and it
 *   is the one arrangement in which „the races it counts" and „the races of its days" give
 *   different lists.
 * - **A day it counts NOTHING of**, so the chooser is measurably offering days rather than
 *   repeating what is already counted.
 * - **A competition of ANOTHER season** beside it, so „the days of its own year" is a claim
 *   that can fail.
 * - **Nothing is read out of what was sent in.** Every assertion about a write reads the
 *   request the panel really made, off the recording server.
 */
describe('which races count towards a competition', () => {
  /** Beogradski maraton 2027, which runs over two mornings (mock, event 1133). */
  const OVER_TWO_MORNINGS = 1133

  const ITS_FIRST_RACE = 125

  /** Podgorička desetka 2027, one race, counted, under a day of its own (mock, event 1121). */
  const ANOTHER_COUNTED_RACE = 957

  /** Zimski noćni polumaraton 2027, one race, counted by nobody (mock, event 1122). */
  const A_DAY_NOBODY_COUNTS = 1122

  const THE_RACE_OF_THAT_DAY = 1590

  /* WHAT PARTS ONE RACE FROM ANOTHER ON THIS SCREEN, and it is never the name.
     `raceLabel` writes the race's own name and adds what tells it from the races beside it
     (`data/raceLabel.ts`); every race of a day starts out carrying its event's name, so the
     name is the same for both mornings of Beogradski maraton and is drawn a third time in
     the chooser below. The distance is what differs, and these three strings are the only
     things in this file that the assertions lean on.

     **A fourth stood here and is gone, and it is worth a line why.** It was the distance of
     the race chosen in the second box, used to say that a refused press entered nothing -
     and it could never have said that: the race a person chooses is drawn as an OPTION of
     that box, so its label is on the screen whether it was entered or not. What says the
     press entered nothing is that there is still one control to take a race out per race
     that counts, and that is what the case asks now. */
  const THE_SHORT_ONE = '2,5 km'

  const THE_MARATHON = '42,2 km'

  const THE_OTHER_COUNTED = '10,0 km'

  /** The competition every case acts on. Written second and keyed above the first. */
  const ACTED = 9

  const ITS_NAME = 'Druga liga 2027'

  /** The one that counts nothing yet, which is the state a competition made today is in. */
  const COUNTS_NOTHING = 7

  const NOTHING_YET = 'Prva liga 2027'

  /** And the one whose served answer names a day none of whose races it counts. */
  const DISAGREES = 15

  const DISAGREEING_NAME = 'Nesloga liga 2027'

  const LEAGUES = [
    { id: 7, slug: 'prva-2027', name: 'Prva liga 2027', season: 2027, rules: '', prizes: '',
      eventIds: [], raceIds: [] },
    /* THE RACES ARE ANSWERED IN AN ORDER THAT IS NOT THE ORDER THEY ARE DRAWN IN, and that
       is measured rather than tidy. The one every case acts on (race 125) is written SECOND
       here and is drawn SECOND as well - Podgorička desetka runs on 30 January and
       Beogradski maraton on 3 April - so „the race asked for", „the first the server
       answered with" and „the first on the screen" are three different numbers. Written the
       other way round, an address built out of `counted[0]` passed every case in this file
       (measured 24.09.2026, mutation Z2). */
    { id: ACTED, slug: 'druga-2027', name: ITS_NAME, season: 2027, rules: '', prizes: '',
      eventIds: [OVER_TWO_MORNINGS, 1121], raceIds: [ANOTHER_COUNTED_RACE, ITS_FIRST_RACE] },
    { id: 11, slug: 'stara-2019', name: 'Stara liga 2019', season: 2019, rules: '', prizes: '',
      eventIds: [], raceIds: [] },
    /* A season the calendar reaches no further than: the portal ships 1167 events and none
       of them is run in 2035. That is a real state and the first one every competition is
       in - made in October for next year, before a single day of it is entered - and it is
       the one arrangement in which the chooser has nothing to offer. */
    { id: 13, slug: 'buduca-2035', name: 'Buduća liga 2035', season: 2035, rules: '', prizes: '',
      eventIds: [], raceIds: [] },
    /* AND ONE WHOSE TWO FIELDS DISAGREE, which is the one arrangement in which „the badge
       counts the DAYS the answer named" and „the badge counts the days of the RACES it
       counts" give different numbers without anything being written at all. The generated
       file the portal still ships is exactly this shape - its three competitions name
       nineteen days between them and not one race - so this is real data rather than an
       invention.

       **TWO DAYS NAMED AND ONE COUNTED, rather than one named and none counted**, and that
       is a measured correction rather than a tidier fixture. Written the second way it read
       „Bez događaja", which is what THREE other competitions on this screen read, so the
       case that says the answer's own list is ignored was satisfied by any of them: swapping
       the row it asks about for `Prva liga 2027` left the whole file green (measured
       28.09.2026, mutation M17). One counted day gives it „1", which no other row on this
       screen says until something is written. */
    { id: DISAGREES, slug: 'nesloga-2027', name: 'Nesloga liga 2027', season: 2027, rules: '',
      prizes: '', eventIds: [OVER_TWO_MORNINGS, A_DAY_NOBODY_COUNTS], raceIds: [ITS_FIRST_RACE] },
  ]

  /**
   * The four competitions above in front of the disc reader, with whatever a case wants said
   * about a write. Everything else - the calendar and its races - goes on to the disc, which
   * is what keeps this measured against real data rather than against a fixture.
   */
  function serving(toAWrite: () => Response = did) {
    clearResourceCache()

    return serverThat((path) => {
      if (path === '/api/leagues') {
        return new Response(JSON.stringify(LEAGUES), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      /* EVERY OTHER RESOURCE GOES ON TO THE DISC, and that is what keeps these cases
         measured against the real calendar: the days and the races this panel offers are
         the portal's own 1167 events and 1612 races, not three rows written here. Asked
         through `isResource` rather than by name, so a fifteenth resource falls the same
         way on the day it is added. */
      return isResource(path) ? null : toAWrite()
    })
  }

  /** Opens the box of the competition every case acts on. */
  async function openTheBox() {
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(
      await screen.findByRole('button', { name: `Trke u ligi ${ITS_NAME}` }),
    )

    return user
  }

  /**
   * The same four competitions, with one of the two big files refusing to come.
   *
   * The badge that counts days reads the races and the events, and neither of them is the
   * file the names and the seasons come out of. So a screen that waited on them would be a
   * screen a failed calendar replaces with an error, and a badge that counted nought would be
   * this cell telling the same lie the whole branch is about, one file further back.
   */
  function servingWithout(broken: 'races' | 'events') {
    clearResourceCache()

    return serverThat((path) => {
      if (path === '/api/leagues') {
        return new Response(JSON.stringify(LEAGUES), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (path === `/api/${broken}`) {
        return new Response('greska', { status: 500 })
      }

      return isResource(path) ? null : did()
    })
  }

  /** What was written, and to where: the recording server's own account of it. */
  function writes(asked: Asked[]): { path: string; body: unknown; how: string }[] {
    return asked
      .filter((one) => one.init !== undefined && one.init.method !== undefined)
      .map((one) => ({
        path: one.path,
        how: String(one.init?.method),
        body: typeof one.init?.body === 'string' ? JSON.parse(one.init.body) : null,
      }))
      .filter((one) => one.how !== 'GET')
  }

  it('lists the races it counts and not the other race of the same day', async () => {
    const server = serving()

    await openTheBox()

    const box = must(
      document.getElementById(`league-moderation-${ACTED}`),
      'the box of the competition',
    )
    const said = box.textContent ?? ''

    /* The day is on the list because one of its races is counted, and the OTHER race of that
       same morning is not - which is the one difference between reading the races and
       reading the days.

       **Told apart by the DISTANCE and not by the day, and that is measured rather than
       chosen for looks.** Both races carry their event's own name and `raceLabel` adds
       whatever parts them, which here is 2,5 km against 42,2 km. The event's NAME is no
       discriminator at all: it is drawn again in the chooser below, so an assertion on the
       name alone passes whatever the list holds. */
    expect(said).toContain(THE_SHORT_ONE)
    expect(said).not.toContain(THE_MARATHON)
    expect(said).toContain(THE_OTHER_COUNTED)

    server.stop()
  }, SLOW)

  it('the box is folded on arrival, named after its own competition, and points at its own panel',
    async () => {
      const server = serving()

      renderAt('/sr/administracija/lige', 'superadmin')

      const toggles = await screen.findAllByRole('button', { name: /^Trke u ligi / })

      expect(toggles.length).toBe(LEAGUES.length)

      const panels = toggles.map((toggle) => {
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(must(toggle.parentElement, 'what the button sits in').tagName).toBe('H3')

        return toggle.getAttribute('aria-controls')
      })

      /* Its own panel and not a neighbour's: three buttons pointing at one panel is what a
         constant id produces, and a reader following either of the other two lands here. */
      expect(new Set(panels).size).toBe(panels.length)

      server.stop()
    }, SLOW)

  it('sends the whole day when no single race is chosen, and counts every race of it',
    async () => {
      const server = serving()
      const user = await openTheBox()

      await user.selectOptions(
        screen.getByLabelText('Događaj', { selector: `#league-moderation-${ACTED}-event` }),
        String(OVER_TWO_MORNINGS),
      )
      await user.click(screen.getByRole('button', { name: 'Dodaj u ligu' }))

      expect(writes(server.asked)).toEqual([
        {
          path: `/api/leagues/${ACTED}/races`,
          how: 'POST',
          body: { eventId: OVER_TWO_MORNINGS },
        },
      ])

      /* The morning that was not counted before is counted now, which is what „every race of
         that day" means and what a write of ONE race would not do.

         **Counted by its CONTROLS and not by looking for the distance in the text**, and
         that is a measured correction rather than a preference: the races of the day a
         person has chosen are drawn as OPTIONS of the second box, so „42,2 km" is on this
         screen the moment the day is chosen and before anything is written. Read that way,
         a press that entered the EVENT'S key instead of its races passed (measured
         24.09.2026, mutation Z3). A control to take a race out is drawn once per race that
         really counts, so three of them is the whole claim. */
      const box = must(document.getElementById(`league-moderation-${ACTED}`), 'the box')
      const out = within(box).getAllByRole('button', { name: /^Izbaci trku/ })

      expect(out).toHaveLength(3)
      expect(out.map((one) => one.getAttribute('aria-label') ?? '').join(' ')).toContain(
        THE_MARATHON,
      )

      server.stop()
    }, SLOW)

  it('sends one race when one is chosen, and counts that one alone', async () => {
    const server = serving()
    const user = await openTheBox()

    await user.selectOptions(
      screen.getByLabelText('Događaj', { selector: `#league-moderation-${ACTED}-event` }),
      String(A_DAY_NOBODY_COUNTS),
    )
    await user.selectOptions(
      screen.getByLabelText('Trka', { selector: `#league-moderation-${ACTED}-race` }),
      String(THE_RACE_OF_THAT_DAY),
    )
    await user.click(screen.getByRole('button', { name: 'Dodaj u ligu' }))

    expect(writes(server.asked)).toEqual([
      {
        path: `/api/leagues/${ACTED}/races`,
        how: 'POST',
        body: { raceId: THE_RACE_OF_THAT_DAY },
      },
    ])

    server.stop()
  }, SLOW)

  it('takes a race out of THIS competition and names it in the address', async () => {
    const server = serving()
    const user = await openTheBox()

    const box = must(document.getElementById(`league-moderation-${ACTED}`), 'the box')

    await user.click(
      within(box).getByRole('button', { name: /^Izbaci trku Beogradski maraton/ }),
    )

    expect(writes(server.asked)).toEqual([
      {
        path: `/api/leagues/${ACTED}/races/${ITS_FIRST_RACE}`,
        how: 'DELETE',
        body: {},
      },
    ])
    expect(box.textContent ?? '').not.toContain(THE_SHORT_ONE)
    /* And the other race it counts is still counted, which is what says the press reached
       one row rather than the list. */
    expect(box.textContent ?? '').toContain(THE_OTHER_COUNTED)

    server.stop()
  }, SLOW)

  it('draws the refusal the route named, in the words of that refusal', async () => {
    const server = serving(() => refused('theSeasonIsFrozen', 409))
    const user = await openTheBox()

    await user.selectOptions(
      screen.getByLabelText('Događaj', { selector: `#league-moderation-${ACTED}-event` }),
      String(A_DAY_NOBODY_COUNTS),
    )
    await user.click(screen.getByRole('button', { name: 'Dodaj u ligu' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sezona ove lige je zamrznuta, pa se trka više ne dodaje. Izbacivanje i dalje radi.',
    )
    /* And nothing was counted, so the list and the server do not disagree about a race that
       never went in.

       **Counted by its ROWS and not by looking for the race's words**, which is measured
       rather than a preference: the race chosen in the second box is drawn as an OPTION of
       that box, so its label is on this screen whether it was entered or not. What says it
       did not go in is that there is still one control to take a race out per race that
       counts, and there are still two of them. */
    const box = must(document.getElementById(`league-moderation-${ACTED}`), 'the box')

    expect(within(box).getAllByRole('button', { name: /^Izbaci trku/ })).toHaveLength(2)

    /* AND THE SECOND HALF OF THAT SENTENCE IS MEASURED AND NOT MERELY CLAIMED.
       „Izbacivanje i dalje radi" is the owner's own decision (PDL P15c: „Pod 2, mogu da je
       izbacim ručno"), and the route really does allow it after the freeze
       (`LeagueWriteApiTest.aRaceLeavesALeagueWhoseSeasonHasFrozen`). What is asked here is
       that the SCREEN goes on offering it: a panel that greyed the controls out after a
       refusal about adding would make the sentence a lie at the moment it is read.

       The sentence said „spisak trka se više ne menja" until 24.09.2026, which told a
       moderator the opposite of what he may do. */
    await user.click(first(within(box).getAllByRole('button', { name: /^Izbaci trku/ })))

    expect(writes(server.asked).map((one) => one.how)).toContain('DELETE')

    server.stop()
  }, SLOW)

  it('falls back to one sentence for a refusal it has no words for', async () => {
    /* A reason the dictionary does not carry, which is what a route added tomorrow answers
       with. The fallback is the whole reason `sentenceFor` asks the dictionary rather than
       carrying a list of the route's refusals. */
    const server = serving(() => refused('theSkyIsGreen', 409))
    const user = await openTheBox()

    await user.selectOptions(
      screen.getByLabelText('Događaj', { selector: `#league-moderation-${ACTED}-event` }),
      String(A_DAY_NOBODY_COUNTS),
    )
    await user.click(screen.getByRole('button', { name: 'Dodaj u ligu' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Portal nije prihvatio izmenu. Osveži stranu pa pokušaj ponovo.',
    )

    server.stop()
  }, SLOW)

  it('says so for an answer that names no reason at all', async () => {
    const server = serving(() => new Response(null, { status: 500 }))
    const user = await openTheBox()

    await user.selectOptions(
      screen.getByLabelText('Događaj', { selector: `#league-moderation-${ACTED}-event` }),
      String(A_DAY_NOBODY_COUNTS),
    )
    await user.click(screen.getByRole('button', { name: 'Dodaj u ligu' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Portal nije prihvatio izmenu.')

    server.stop()
  }, SLOW)

  it('offers the days of its own season and of no other', async () => {
    const server = serving()

    await openTheBox()

    const chooser = screen.getByLabelText('Događaj', {
      selector: `#league-moderation-${ACTED}-event`,
    })
    const offered = [...within(chooser).getAllByRole('option')].map((one) => one.textContent)

    expect(offered).toContain('Beogradski maraton')
    /* Mrazijada is 2019 and belongs to the competition two rows down. Offered here, a day of
       another year would be refused by the database and the administrator would be told his
       own screen had lied to him. */
    expect(offered.some((one) => one?.includes('Mrazijada'))).toBe(false)

    server.stop()
  }, SLOW)

  it('says so where the competition counts nothing yet and where its season has no days',
    async () => {
      const server = serving()
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await user.click(
        await screen.findByRole('button', { name: 'Trke u ligi Prva liga 2027' }),
      )

      const empty = must(document.getElementById('league-moderation-7'), 'the empty competition')

      expect(empty.textContent ?? '').toContain('Ovoj ligi još nije dodeljena nijedna trka.')
      /* And it still gets a chooser, because 2027 is a season the calendar has: an empty
         competition is a state to be filled rather than one to be apologised for. */
      expect(within(empty).getByRole('button', { name: 'Dodaj u ligu' })).toBeDisabled()

      /* AND THE OTHER SILENCE, WHICH IS A DIFFERENT ONE AND SAYS SO. A competition made for
         a season the calendar has not reached has nothing to be offered, and the two states
         are told apart here because they send an administrator to two different places: one
         is a list to be filled in, the other is a calendar to be entered first. */
      await user.click(screen.getByRole('button', { name: 'Trke u ligi Buduća liga 2035' }))

      const ahead = must(document.getElementById('league-moderation-13'), 'the season ahead')

      expect(ahead.textContent ?? '').toContain(
        'U kalendaru nema nijednog događaja iz sezone 2035.',
      )
      expect(within(ahead).queryByRole('button', { name: 'Dodaj u ligu' })).toBeNull()

      server.stop()
    }, SLOW)

  /**
   * THE ROW ABOVE THE BOX, WHICH IS WHERE THIS PANEL'S WRITES WERE NOT ARRIVING.
   *
   * **The owner met it on QA and read it as work lost** (28.09.2026: „Popunim ovo ovako i
   * onda se nista ne sacuva, nije se kreirala Liga sa ovim dogadjajem"). Nothing had been
   * lost: `league` held one row, `league_race` held four, and `GET /api/leagues` answered
   * with `raceIds` and `eventIds` both filled in. The badge beside the name was drawing
   * `League.eventIds` off the answer this screen had been served BEFORE the panel wrote
   * anything, and for a competition made during the visit that field is the empty list a new
   * record is given and can never stop being. So the box listed four races under a badge
   * saying „Bez dogadjaja".
   *
   * **Nothing in this file could see it, and that is the measurement rather than an
   * apology.** Every case here read the BOX, so the whole package stayed green while the row
   * above the box said the opposite. What the cases below add is the JOIN: one press, and
   * both the thing that lists and the thing that counts are read after it.
   */
  describe('and the badge on the row says what the box under it counts', () => {
    /** The row a competition is named in, which is the first one carrying its name. */
    async function rowOf(name: string): Promise<HTMLElement> {
      const table = within(await screen.findByRole('table', { name: 'Lige' }))

      return must(
        table.getAllByRole('row').find((one) => one.textContent?.includes(name)),
        `the row of ${name}`,
      )
    }

    /**
     * Waits for the cell that counts days to say a thing, in the row of a named competition.
     *
     * The fourth cell and not a search over the row: the season is in the third and „2027"
     * would answer a search for a number as readily as the count does.
     */
    async function badgeSays(name: string, words: string): Promise<void> {
      const cell = at(within(await rowOf(name)).getAllByRole('cell'), 3)

      await within(cell).findByText(words)
    }

    it('counts the days of the races it counts, and not the days the answer happened to name',
      async () => {
        const server = serving()

        renderAt('/sr/administracija/lige', 'superadmin')

        /* The one whose two fields disagree, with nothing written at all. `eventIds` names
           TWO days, `raceIds` names one race of one of them, and under V20 a competition's
           days ARE the days of its races - so a badge reading the first says „2" and a badge
           reading the second says „1".

           **„1" is a number no other row on this screen says at rest**, which is what makes
           this a claim about THIS competition rather than about the column: three of the five
           read „Bez događaja" and the fourth reads „2". */
        await badgeSays(DISAGREEING_NAME, '1')
        /* And the one beside it that counts two days still says so, so the smaller number is
           being worked out rather than drawn over everything. */
        await badgeSays(ITS_NAME, '2')

        server.stop()
      }, SLOW)

    it('moves the moment the route accepts a race, in the row that was written to and in no other',
      async () => {
        const server = serving()
        const user = setupUser()

        renderAt('/sr/administracija/lige', 'superadmin')

        await user.click(
          await screen.findByRole('button', { name: `Trke u ligi ${NOTHING_YET}` }),
        )

        await badgeSays(NOTHING_YET, 'Bez događaja')

        await user.selectOptions(
          screen.getByLabelText('Događaj', {
            selector: `#league-moderation-${COUNTS_NOTHING}-event`,
          }),
          String(OVER_TWO_MORNINGS),
        )
        await user.click(screen.getByRole('button', { name: 'Dodaj u ligu' }))

        const box = must(
          document.getElementById(`league-moderation-${COUNTS_NOTHING}`),
          'the box of the competition that counted nothing',
        )

        /* THE TWO HALVES READ AFTER ONE PRESS, which is the whole of this case: the box lists
           both races of the morning that went in, and the badge over it says the one day they
           are. Either one alone is what the package already had. */
        expect(within(box).getAllByRole('button', { name: /^Izbaci trku/ })).toHaveLength(2)
        await badgeSays(NOTHING_YET, '1')
        /* And the competition next to it has not moved, so the press reached one row rather
           than the column. */
        await badgeSays(ITS_NAME, '2')

        server.stop()
      }, SLOW)

    it('falls back to the words when the last race is taken out again', async () => {
      const server = serving()
      const user = await openTheBox()

      const box = must(document.getElementById(`league-moderation-${ACTED}`), 'the box')

      await badgeSays(ITS_NAME, '2')

      for (const out of [...within(box).getAllByRole('button', { name: /^Izbaci trku/ })]) {
        await user.click(out)
      }

      /* Both races gone is both DAYS gone, because a day is on the list only through a race
         of it. A badge that counted the served `eventIds` would still be saying „2". */
      await badgeSays(ITS_NAME, 'Bez događaja')

      server.stop()
    }, SLOW)

    it('empties the answer it was served, so the next screen to read a competition asks again',
      async () => {
        const server = serving()
        const user = await openTheBox()

        /* `POST /api/leagues/{id}/races` changes what `GET /api/leagues` answers with, and
           this was the third write on this screen and the only one that cleared nothing: the
           public list at `/lige` and this screen entered again both read that cached array.
           Read through `arrivedResource` rather than through a second screen, because what is
           being asked is about the cache itself. */
        expect(arrivedResource('leagues'), 'the competitions never landed').not.toBeUndefined()

        await user.selectOptions(
          screen.getByLabelText('Događaj', { selector: `#league-moderation-${ACTED}-event` }),
          String(A_DAY_NOBODY_COUNTS),
        )
        await user.click(screen.getByRole('button', { name: 'Dodaj u ligu' }))

        expect(arrivedResource('leagues')).toBeUndefined()

        server.stop()
      }, SLOW)

    it.each([['races'], ['events']] as const)(
      'says the count is unknown rather than nought when the %s never arrive',
      async (broken) => {
        const server = servingWithout(broken)

        renderAt('/sr/administracija/lige', 'superadmin')

        /* A count of NOUGHT over a file that failed is the same lie this whole branch is
           about, one file further back: „Bez događaja" would be the screen saying a
           competition counts nothing when what it really knows is nothing. The word is the
           one the public list already uses for it (`pages/Leagues.tsx`, 13.09.2026). */
        await badgeSays(ITS_NAME, 'nepoznato')
        /* And the screen itself is not replaced by an error: what failed is one number in one
           column, and the names, the addresses and the seasons come out of a different file
           altogether. */
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(await screen.findByRole('table', { name: 'Lige' })).toBeVisible()

        server.stop()
      },
      SLOW,
    )

    it('keeps the races entered during a visit when a form is opened over them and closed',
      async () => {
        const server = serving()
        const user = setupUser()

        renderAt('/sr/administracija/lige', 'superadmin')

        await user.click(
          await screen.findByRole('button', { name: `Trke u ligi ${NOTHING_YET}` }),
        )
        await user.selectOptions(
          screen.getByLabelText('Događaj', {
            selector: `#league-moderation-${COUNTS_NOTHING}-event`,
          }),
          String(OVER_TWO_MORNINGS),
        )
        await user.click(screen.getByRole('button', { name: 'Dodaj u ligu' }))

        /* OPENING A FORM SWAPS THIS WHOLE SUBTREE, so every panel is unmounted and mounted
           again. While the list lived inside the panel, that took every race entered during
           the visit with it: the races were on the server and the screen drew them gone,
           which is the same sentence the owner read as „nothing was saved". */
        await user.click(
          within(await rowOf(NOTHING_YET)).getByRole('button', { name: `Otvori: ${NOTHING_YET}` }),
        )
        await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

        await badgeSays(NOTHING_YET, '1')

        await user.click(screen.getByRole('button', { name: `Trke u ligi ${NOTHING_YET}` }))

        const box = must(
          document.getElementById(`league-moderation-${COUNTS_NOTHING}`),
          'the box of the competition that counted nothing',
        )

        expect(within(box).getAllByRole('button', { name: /^Izbaci trku/ })).toHaveLength(2)

        server.stop()
      }, SLOW)
  })

  /**
   * WHAT THE PANEL LOOKS LIKE, WHICH IS TWO CLASSES AND NOTHING ELSE, AND BOTH ENDS OF EACH
   * ARE ASKED FOR HERE.
   *
   * **Written as one case per class and not as two files, because the fault this guards
   * against is the JOIN** (28.09.2026): a sheet that carries a rule for a class nothing wears,
   * or markup wearing a class no sheet has a rule for, each reads as though it works. So the
   * class name is asserted at both ends, and the mutation that proves it is a change to the
   * name at one end alone.
   *
   * **Who wins the cascade is not asked here and cannot be.** jsdom applies no stylesheet, so
   * this says that the rule is written and that the element carries the class; how it looks
   * at 360, 768 and 1280 pixels is measured in a browser (`admin/entityStyle.test.ts` gives
   * the full reasoning for that division).
   */
  describe('and it wears what the portal already dresses a chooser and a row in', () => {
    /** Every selector the screen's own sheet declares a rule for, unconditionally or not. */
    function selectorsOfLeaguesCss(): string[] {
      const tag = document.createElement('style')

      tag.textContent = readFileSync(join(process.cwd(), 'src/pages/Leagues.css'), 'utf-8')
      document.head.append(tag)

      const sheet = must(tag.sheet, 'jsdom did not parse Leagues.css')
      const found = [...sheet.cssRules].flatMap((rule) =>
        rule instanceof CSSStyleRule ? [rule.selectorText] : [],
      )

      tag.remove()

      return found
    }

    it('puts both choosers in the field administration already puts a chooser in', async () => {
      const server = serving()

      await openTheBox()

      const box = must(document.getElementById(`league-moderation-${ACTED}`), 'the box')

      /* THE CLASS IS THE JOIN, so it is read off the element rather than assumed from the
         markup. Bare, these two were the browser's own control - white on the portal's dark
         ground - which is what the owner asked about („zasto su dropdowns ovako nakaradni?").
         `.rankings__field` is what `admin/PendingQueue.tsx` puts a country chooser in, and the
         sheet that carries it is already asked for by `Leagues.css`. */
      for (const label of ['Događaj', 'Trka']) {
        const chooser = within(box).getByLabelText(label)

        /* THE ELEMENT IT STANDS IN AND NOT AN ANCESTOR OF IT. `closest` was written here
           first and is satisfied by the class landing anywhere above, the form included -
           and the form is not a field: the layout that puts the label over the box and the
           box in the portal's own ground is written for the element the two sit in. */
        expect(
          [...must(chooser.parentElement, `what the ${label} chooser stands in`).classList],
          `the ${label} chooser is not in a field`,
        ).toContain('rankings__field')
      }

      /* And the other end of the join: the screen's own sheet lays that field out, because a
         field inside a row of a table has to be told what width to take. */
      expect(selectorsOfLeaguesCss()).toContain('.leagues__adding .rankings__field')

      server.stop()
    }, SLOW)

    it('gives every race that counts a row of its own, so the controls stand in a column',
      async () => {
        const server = serving()

        await openTheBox()

        const box = must(document.getElementById(`league-moderation-${ACTED}`), 'the box')
        const out = within(box).getAllByRole('button', { name: /^Izbaci trku/ })

        expect(out).toHaveLength(2)

        /* Each control's own item carries the class, and not the list it is in: the public
           competition page draws its races in the same list (`league/LeagueEvents.tsx`) and
           has no control to line up, so a rule on the list would reach a screen this branch
           is not about. */
        for (const one of out) {
          /* Its own item and not an ancestor of it, for the reason the chooser above gives:
             the class lays out ONE row, and found on the list instead it would be laying out
             all of them at once and reaching a public screen besides. */
          expect(
            [...must(one.parentElement, 'what the control stands in').classList],
            'a control to take a race out is not in a row of its own',
          ).toContain('leagues__counted-race')
        }

        expect(selectorsOfLeaguesCss()).toContain('.leagues__counted-race')

        server.stop()
      }, SLOW)
  })
})
