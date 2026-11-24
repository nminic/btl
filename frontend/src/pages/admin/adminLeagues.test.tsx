import { act, configure, fireEvent, getConfig, screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache, timesDropped } from '../../data/client'
import { moderatorWith, renderAt } from '../../test/render'
import {
  answeredWith,
  did,
  refused,
  serverThat,
  type Asked,
} from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { at, must } from '../../test/at'
import { sayYes } from '../../test/deleteSheet'
import { SLOW } from '../../test/slow'
import { theDayTheSuiteIsReadAs } from '../../test/theDay'
import { seasonsALeagueMayBeMadeFor } from './leagueSeasons'

/**
 * THE SCREEN OF COMPETITIONS WRITES TO THE SERVER (PDL P28c point 2, owner 24.09.2026:
 * „Svi ekrani administracije prestaju da pisu u sesijski sloj i pocinju da zovu rute",
 * with his reason - „bez toga nijedan entitet unet kroz portal stvarno ne postoji, pa se
 * ni liga ne moze isprobati iako su joj rute gotove").
 *
 * **NOTHING IN THE FIXTURE IS THE ONLY ONE OF ITS KIND, AND THE AXES ARE COUNTED.** The
 * competition every case acts on is:
 *
 * - **neither the first served nor the last**, so „this competition", „the first" and
 *   „the last" are three different rows and an address built off the wrong one is a
 *   different address;
 * - **not the lowest key and not the highest**, for the same reason one number up;
 * - **not the only one of its season**, so „its season" is a claim that can fail;
 * - **one that COUNTS RACES, with one beside it that counts none**, which is the one axis
 *   `theSeasonCannotMoveWhileRacesCount` lives on;
 * - **beside a competition of a FROZEN season**, which is the whole of PDL P15a point 2
 *   against PDL P15c point 1: the frozen one refuses to be changed and agrees to be
 *   deleted.
 *
 * **Nothing is read out of what was sent in.** Every assertion about a write reads the
 * request the screen really made, off the recording server.
 */
/* EVERY WAIT IS GIVEN HALF OF WHAT A CASE HAS (CLAUDE.md, section 25), since the cases of the box „Istakni
   događaje" were added (24.11.2026): a save that never comes back fails on its own query, not on the clock. */
configure({ asyncUtilTimeout: SLOW / 2 })

it('waits less than a case has, so a miss is an assertion and never the clock', () => {
  expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
})

describe('a competition made, changed and taken away', () => {
  /** The competition every case acts on. Written second of four and keyed third of four. */
  const ACTED = 9

  const ITS_NAME = 'Druga liga 2027'

  const ITS_ADDRESS = 'druga-2027'

  /** The one beside it that counts no race at all, so a season may be moved under it. */
  const COUNTS_NOTHING = 7

  /** And the one whose season has frozen (PDL P15a point 2 against P15c point 1). */
  const FROZEN = 11

  const FROZEN_NAME = 'Stara liga 2019'

  /** And one of a season the FORM accepts, for the refusals that have to reach the route. */
  const CHANGEABLE_NAME = 'Buduća liga 2028'

  /* The box „Istakni događaje" (V109) is ticked on the competition acted on and on no other, so a form that
     opened another competition's box, or the first one's, sends a different answer. */
  const LEAGUES = [
    { id: COUNTS_NOTHING, slug: 'prva-2027', name: 'Prva liga 2027', season: 2027, rules: '',
      prizes: '', eventIds: [], raceIds: [], highlightsEvents: false },
    { id: ACTED, slug: ITS_ADDRESS, name: ITS_NAME, season: 2027, rules: 'Propozicije druge',
      prizes: 'Nagrade druge', eventIds: [1133], raceIds: [125], highlightsEvents: true },
    { id: FROZEN, slug: 'stara-2019', name: FROZEN_NAME, season: 2019, rules: '', prizes: '',
      eventIds: [], raceIds: [], highlightsEvents: false },
    { id: 13, slug: 'buduca-2028', name: 'Buduća liga 2028', season: 2028, rules: '', prizes: '',
      eventIds: [], raceIds: [], highlightsEvents: false },
  ]

  /**
   * The four competitions above in front of the disc reader, with whatever a case wants
   * said about a write. Everything else goes on to the disc, which is what keeps the
   * screen measured against the real calendar.
   */
  function serving(
    toAWrite: (asked: string, init: RequestInit | undefined) => Response | Promise<Response> = did,
  ) {
    clearResourceCache()

    return serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      /* THE VERB AND NOT ONLY THE ADDRESS, and it is measured rather than careful.
         `POST /api/leagues` and `GET /api/leagues` are the same string, so a branch on the
         path alone answered a WRITE with the list of competitions - status 200, which
         `askTheServer` reads as „it was done", carrying an array as the body. Every case
         about a refusal then passed through the success branch and read the one sentence
         for „saved and not drawable". Nothing about the screen was wrong; the fixture
         could not tell the two requests apart. The panel of races never met this because
         its writes go to `/api/leagues/{id}/races`, which is a different string. */
      if (path === '/api/leagues' && how === 'GET') {
        return new Response(JSON.stringify(LEAGUES), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      /* EVERY READ GOES ON TO THE DISC AND ONLY A WRITE REACHES THE CASE'S OWN ANSWER.
         This asked `isResource(path)` and that was not the same question: `askTheServer`
         reads `/api/countries` to be handed the token, and `countries` is not one of the
         fourteen, so that READ was being answered with whatever a case had written for its
         WRITE. Harmless while every case answered at once; the case that hands back a
         promise which settles later deadlocked on it, because the token is fetched before
         the request it is for. */
      return how === 'GET' ? null : toAWrite(path, init)
    })
  }

  /** What was written, and to where: the recording server's own account of it. */
  function writes(asked: Asked[]): { path: string; how: string; body: unknown }[] {
    return asked
      .filter((one) => one.init?.method !== undefined && one.init.method !== 'GET')
      .map((one) => ({
        path: one.path,
        how: String(one.init?.method),
        body: typeof one.init?.body === 'string' ? JSON.parse(one.init.body) : null,
      }))
  }

  /** Opens the form of the competition every case acts on. */
  async function openIt(user: ReturnType<typeof setupUser>) {
    const rows = within(await screen.findByRole('table', { name: 'Lige' }))
    const row = must(
      rows.getAllByRole('row').find((one) => one.textContent?.includes(ITS_NAME)),
      'the row of the competition being acted on',
    )

    await user.click(within(row).getByRole('button', { name: `Otvori: ${ITS_NAME}` }))
  }

  /** Presses Delete on a named competition, both times, which is what the row asks for. */
  async function deleteNamed(user: ReturnType<typeof setupUser>, name: string) {
    const rows = within(await screen.findByRole('table', { name: 'Lige' }))
    const row = must(
      rows.getAllByRole('row').find((one) => one.textContent?.includes(name)),
      `the row of ${name}`,
    )

    await user.click(within(row).getByRole('button', { name: `Obriši: ${name}` }))
    await sayYes(user, 'Obriši ligu?')

    return row
  }

  it('sends a new one to POST /api/leagues with everything the form asked for', async () => {
    const server = serving(() =>
      new Response(JSON.stringify({ id: 4212, slug: 'vojvodjanska-2027' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
    await user.type(screen.getByLabelText(/^Adresa/), 'vojvodjanska-2027')
    await user.selectOptions(screen.getByLabelText(/^Sezona/), '2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(writes(server.asked)).toEqual([
      {
        path: '/api/leagues',
        how: 'POST',
        body: {
          name: 'Vojvođanska liga 2027',
          slug: 'vojvodjanska-2027',
          season: 2027,
          rules: '',
          prizes: '',
          highlightsEvents: false,
        },
      },
    ])

    server.stop()
  }, SLOW)

  it('draws the new row under the identity the DATABASE handed out, and the races panel uses it',
    async () => {
      /* THE FAULT THIS WHOLE INCREMENT CLOSES, MEASURED ON THE ONE THING THAT SHOWS IT.
         A competition entered here used to be remembered as an overlay, and an entity
         filed under `id` takes its identity from `admin/raceIds.ts`, which counts DOWN
         from nought. So the first one entered during a visit was `-1`, and the panel of
         races underneath it - which speaks to the server - posted to
         `/api/leagues/-1/races`.

         The address is what this reads and never merely „something was sent": with the
         id wrong, a request still goes out and still carries a race. */
      const server = serving(() =>
        new Response(JSON.stringify({ id: 4212, slug: 'vojvodjanska-2027' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      )
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
      await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
      await user.type(screen.getByLabelText(/^Adresa/), 'vojvodjanska-2027')
      await user.selectOptions(screen.getByLabelText(/^Sezona/), '2027')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

      const listed = within(await screen.findByRole('table', { name: 'Lige' }))

      expect(listed.getByRole('link', { name: '/liga/vojvodjanska-2027' })).toHaveAttribute(
        'href',
        '/sr/liga/vojvodjanska-2027',
      )

      /* THE BOX STANDS IN THE FORM OF THE COMPETITION (PDL 21.11.2026), so the competition that was
         just made is opened from the list, and it is found there by the identity the route handed
         out. */
      await user.click(
        within(
          must(
            listed.getAllByRole('row').find((one) => one.textContent?.includes('Vojvođanska liga 2027')),
            'the row of the competition that was just made',
          ),
        ).getByRole('button', { name: 'Otvori: Vojvođanska liga 2027' }),
      )
      await user.click(
        await screen.findByRole('button', { name: 'Trke u ligi Vojvođanska liga 2027' }),
      )
      await user.selectOptions(
        await screen.findByLabelText('Događaj', { selector: '#league-moderation-4212-event' }),
        '1133',
      )
      await user.click(
        within(must(document.getElementById('league-moderation-4212'), 'its own panel'))
          .getByRole('button', { name: 'Dodaj u ligu' }),
      )

      expect(writes(server.asked).map((one) => one.path)).toEqual([
        '/api/leagues',
        '/api/leagues/4212/races',
      ])

      server.stop()
    }, SLOW)

  it('says so, and draws no row, where a 201 carries no identity to draw one under',
    async () => {
      /* The write happened and this screen cannot show it, which is neither a refusal nor
         something to draw. A row under a made-up number is the fault one line along. */
      const server = serving(() => answeredWith(201))
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
      await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
      await user.type(screen.getByLabelText(/^Adresa/), 'vojvodjanska-2027')
      await user.selectOptions(screen.getByLabelText(/^Sezona/), '2027')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/Osveži stranu/)
      expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()

      server.stop()
    }, SLOW)

  it('sends one competition once, however many times Save is pressed while it is out',
    async () => {
      /* A second press on a NEW record is a second row, and nothing takes it back: the
         route answers 201 twice and the database has two competitions at two addresses -
         or one refusal for a taken address over a competition that was in fact saved.
         The editor holds the press in a ref rather than in state, because two presses
         inside one tick would both read a `false` React has not re-rendered yet. */
      let answer = (): void => {}
      const held = new Promise<Response>((settle) => {
        answer = () =>
          settle(
            new Response(JSON.stringify({ id: 4212, slug: 'vojvodjanska-2027' }), {
              status: 201,
              headers: { 'content-type': 'application/json' },
            }),
          )
      })
      const server = serving(() => held)
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
      await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
      await user.type(screen.getByLabelText(/^Adresa/), 'vojvodjanska-2027')
      await user.selectOptions(screen.getByLabelText(/^Sezona/), '2027')

      /* SENT THREE TIMES INSIDE ONE TICK, which is the arrangement the ref exists for and
         the one `user.click` cannot make: it awaits between presses, so a lock held in
         React state would have re-rendered and each press would be the only one in flight.
         The form is submitted directly for that reason and for no other. */
      const form = must(
        screen.getByRole('button', { name: 'Sačuvaj' }).closest('form'),
        'the form the button sends',
      )

      fireEvent.submit(form)
      fireEvent.submit(form)
      fireEvent.submit(form)

      answer()

      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(writes(server.asked).filter((one) => one.how === 'POST')).toHaveLength(1)

      server.stop()
    }, SLOW)

  it('leaves the form of a competition open to be left while its save is out: only the events hold the reader',
    async () => {
      /* Owner, 04.10.2026 (PDL, P6, „Dok čuvanje događaja traje", and the scope he chose in the same
         breath: „blokada važi samo za obrazac događaja"). What the hold closes is a press writing
         into a form it was not begun in, and that needs a screen that outlives its forms with
         something beside them to write into: the events have one, a competition has not. So this
         form goes on doing what it did, and this case holds that it does - a hold that reached every
         editor would fail here, on the button, on the sentence and on the way to the list. */
      let answer = (): void => {}
      const held = new Promise<Response>((settle) => {
        answer = () =>
          settle(
            new Response(JSON.stringify({ id: 4212, slug: 'vojvodjanska-2027' }), {
              status: 201,
              headers: { 'content-type': 'application/json' },
            }),
          )
      })
      const server = serving(() => held)
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
      await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
      await user.type(screen.getByLabelText(/^Adresa/), 'vojvodjanska-2027')
      await user.selectOptions(screen.getByLabelText(/^Sezona/), '2027')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await waitFor(() => {
        expect(writes(server.asked)).toHaveLength(1)
      })

      /* The request is out and nothing says the reader is held: the button is not told off, no
         sentence says the save is on its way, and the button leaves for the list. */
      const back = screen.getByRole('button', { name: 'Nazad na spisak' })

      expect(back).not.toHaveAttribute('aria-disabled')
      expect(screen.queryByText('Šalje se')).toBeNull()
      await user.click(back)
      expect(await screen.findByRole('table', { name: 'Lige' })).toBeVisible()

      answer()
      server.stop()
    }, SLOW)

  it('sends a change to PUT on ITS OWN address, and never to the first competition served',
    async () => {
      /* THE SOURCE REPLACEMENT THIS CASE EXISTS FOR. `ACTED` is written second and keyed
         third, so an address built out of „the first row", „the lowest id" or „the first
         served" is a different address and a different competition. */
      const server = serving()
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await openIt(user)

      const name = await screen.findByLabelText(/^Naziv lige/)

      await user.clear(name)
      await user.type(name, 'Druga liga 2027 i prijatelji')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(writes(server.asked)).toEqual([
        {
          path: `/api/leagues/${ACTED}`,
          how: 'PUT',
          body: {
            name: 'Druga liga 2027 i prijatelji',
            slug: ITS_ADDRESS,
            season: 2027,
            rules: 'Propozicije druge',
            prizes: 'Nagrade druge',
            highlightsEvents: true,
          },
        },
      ])

      server.stop()
    }, SLOW)

  /**
   * THE BOX „ISTAKNI DOGAĐAJE" (owner, PDL 24.11.2026): opened as each competition holds it, sent as it is left,
   * and the calendar's answer dropped once the route has taken the write, because the calendar's gold is worked
   * out from it.
   *
   * **Both of its states and both directions.** The competition acted on opens ticked and the one beside it
   * unticked, and each is changed into the other: a form that opened every box ticked, or every box unticked,
   * or the first competition's box, fails one of the two. And the moderator of the leagues does it as well as
   * the superadministrator („Kućicu sme da štiklira i moderator te lige, ne samo administrator").
   */
  describe('the box that highlights the events of a competition', () => {
    const BOX = /^Istakni događaje/

    it('opens ticked on a competition that highlights, is sent unticked, and drops the calendar after', async () => {
      const server = serving()
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await openIt(user)

      const box = await screen.findByRole('checkbox', { name: BOX })

      expect(box).toBeChecked()

      const dropped = timesDropped('events')

      await user.click(box)
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(writes(server.asked).map((one) => [one.path, Reflect.get(Object(one.body), 'highlightsEvents')]))
        .toEqual([[`/api/leagues/${ACTED}`, false]])
      expect(timesDropped('events'), 'the calendar was not dropped after the save').toBe(dropped + 1)

      server.stop()
    }, SLOW)

    it('opens unticked on one that does not, and the moderator of the leagues ticks it', async () => {
      const server = serving()
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'moderator', null, moderatorWith(['entity:leagues']))

      const rows = within(await screen.findByRole('table', { name: 'Lige' }))
      const row = must(
        rows.getAllByRole('row').find((one) => one.textContent?.includes('Prva liga 2027')),
        'the row of the competition that does not highlight',
      )

      await user.click(within(row).getByRole('button', { name: 'Otvori: Prva liga 2027' }))

      const box = await screen.findByRole('checkbox', { name: BOX })

      expect(box).not.toBeChecked()

      await user.click(box)
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(writes(server.asked).map((one) => [one.path, Reflect.get(Object(one.body), 'highlightsEvents')]))
        .toEqual([[`/api/leagues/${COUNTS_NOTHING}`, true]])

      server.stop()
    }, SLOW)

    it('drops the calendar on a refused save not at all, after a race leaves once, and after a deletion once',
      async () => {
        const server = serving((_path, init) =>
          init?.method === 'PUT' ? refused('theSeasonIsFrozen', 409) : did(),
        )
        const user = setupUser()

        renderAt('/sr/administracija/lige', 'superadmin')

        await openIt(user)

        const before = timesDropped('events')

        await user.click(await screen.findByRole('checkbox', { name: BOX }))
        await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Sezona ove lige je zamrznuta. Liga se može samo obrisati.',
        )
        expect(timesDropped('events'), 'a refused save dropped the calendar').toBe(before)

        /* A race taken out of a competition that highlights („Ako ih izbacim iz lige, istaknutost se gubi"). */
        await user.click(await screen.findByRole('button', { name: `Trke u ligi ${ITS_NAME}` }))
        await user.click(await screen.findByRole('button', { name: /^Izbaci trku/ }))
        await waitFor(() => {
          expect(timesDropped('events'), 'the calendar was not dropped after a race left').toBe(before + 1)
        })

        await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
        await deleteNamed(user, ITS_NAME)
        await waitFor(() => {
          expect(timesDropped('events'), 'the calendar was not dropped after the deletion').toBe(before + 2)
        })

        server.stop()
      }, SLOW)
  })

  it('shows the new name in the list afterwards, without asking the server again', async () => {
    const server = serving()
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await openIt(user)

    const name = await screen.findByLabelText(/^Naziv lige/)

    await user.clear(name)
    await user.type(name, 'Druga liga 2027 i prijatelji')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const listed = within(await screen.findByRole('table', { name: 'Lige' }))

    expect(listed.getByText('Druga liga 2027 i prijatelji')).toBeVisible()
    /* And the competition beside it is untouched: an overlay keyed by the wrong identity
       renames whichever row it lands on. */
    expect(listed.getByText('Prva liga 2027')).toBeVisible()

    server.stop()
  }, SLOW)

  /**
   * THE SEASON IS CHOSEN, NOT TYPED (owner, 23.11.2026, PDL „Tri brze izmene administracije": „Želim dropdown
   * gde mogu izabrati naredne dve sezone"), out of the seasons of the day the screen is read on: on one of the
   * two days the suite is read as that is 2027 alone, on the other 2027 and 2028, so a box of choices that is
   * not worked out of the portal's day fails one of the two passes. And a competition of a season that has gone
   * by opens with its own season chosen, not with this year's.
   */
  it('offers the seasons of the day as choices, and opens a competition on its own season', async () => {
    const server = serving()
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))

    const chosen = screen.getByRole('combobox', { name: /^Sezona/ })
    const offered = within(chosen)
      .getAllByRole('option')
      .map((one) => one.textContent)
      .filter((one) => one !== 'Izaberi')

    expect(offered).toEqual(seasonsALeagueMayBeMadeFor(theDayTheSuiteIsReadAs()).map(String))

    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const rows = within(await screen.findByRole('table', { name: 'Lige' }))
    const old = must(
      rows.getAllByRole('row').find((one) => one.textContent?.includes(FROZEN_NAME)),
      'the row of the competition of 2019',
    )

    await user.click(within(old).getByRole('button', { name: `Otvori: ${FROZEN_NAME}` }))

    expect(await screen.findByRole('combobox', { name: /^Sezona/ })).toHaveValue('2019')

    server.stop()
  }, SLOW)

  it('says in words what the route refused, and keeps the form as it was', async () => {
    const server = serving(() => refused('theSeasonIsNotThisOneOrTheNext'))
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Liga 2099')
    await user.type(screen.getByLabelText(/^Adresa/), 'liga-2099')
    /* The box offers no season the route refuses (`leagueSeasons.ts`), so the refusal is reached the way a reader
       can still reach it: a season chosen while the year is turning under the form. */
    await user.selectOptions(screen.getByLabelText(/^Sezona/), '2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Liga se pravi samo za tekuću ili narednu sezonu.',
    )
    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
    /* What was typed is still there, so the reader corrects one field instead of four. */
    expect(screen.getByLabelText(/^Naziv lige/)).toHaveValue('Liga 2099')

    server.stop()
  }, SLOW)

  it('says a taken address is taken, and it is the ROUTE that says so and not the screen',
    async () => {
      /* `takenAddress` used to refuse this before anything was sent, off the addresses this
         browser happened to hold. That list can only ever be incomplete, so it refused some
         collisions and let others through; the route refuses all of them. The address typed
         here IS on the screen, which is exactly what the removed check would have caught -
         so the case measures that the refusal comes back from the wire. */
      const server = serving(() => refused('theAddressIsTaken', 409))
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
      await user.type(screen.getByLabelText(/^Naziv lige/), 'Još jedna druga')
      await user.type(screen.getByLabelText(/^Adresa/), ITS_ADDRESS)
      await user.selectOptions(screen.getByLabelText(/^Sezona/), '2027')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(writes(server.asked).map((one) => one.how)).toEqual(['POST'])
      expect(await screen.findByRole('alert')).toHaveTextContent('Na toj adresi već stoji jedna liga.')

      server.stop()
    }, SLOW)

  it('lets a competition be saved again on its own address, which the route decides too',
    async () => {
      const server = serving()
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await openIt(user)
      await user.click(await screen.findByRole('button', { name: 'Sačuvaj' }))

      expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
      expect(at(writes(server.asked), 0).body).toMatchObject({ slug: ITS_ADDRESS })

      server.stop()
    }, SLOW)

  it('sends a deletion to DELETE on ITS OWN address and takes that row away', async () => {
    const server = serving()
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await deleteNamed(user, ITS_NAME)

    expect(writes(server.asked)).toEqual([
      { path: `/api/leagues/${ACTED}`, how: 'DELETE', body: {} },
    ])

    const listed = within(await screen.findByRole('table', { name: 'Lige' }))

    expect(listed.queryByText(ITS_NAME)).toBeNull()
    /* And nothing else went with it. Deleting by the wrong key takes a neighbour. */
    expect(listed.getByText('Prva liga 2027')).toBeVisible()
    expect(listed.getByText(FROZEN_NAME)).toBeVisible()

    server.stop()
  }, SLOW)

  it('takes away one entered during this very visit, which is not in the served list',
    async () => {
      /* TWO STORES AND ONE LIST, WHICH IS THE AXIS THIS CASE EXISTS ON. A competition
         entered here is held as a CREATION and one that was served is filtered out by a
         DELETION, so a deletion written only into the second leaves the row it was pressed
         on standing - and the reader presses it again, on a competition the server has
         already forgotten.

         Found by the coverage gate rather than by reading: the line that takes it out of
         the creations was the only one on this screen nothing reached. */
      const server = serving((_asked, init) =>
        init?.method === 'POST'
          ? new Response(JSON.stringify({ id: 4212, slug: 'vojvodjanska-2027' }), {
              status: 201,
              headers: { 'content-type': 'application/json' },
            })
          : did(),
      )
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
      await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
      await user.type(screen.getByLabelText(/^Adresa/), 'vojvodjanska-2027')
      await user.selectOptions(screen.getByLabelText(/^Sezona/), '2027')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

      await deleteNamed(user, 'Vojvođanska liga 2027')

      expect(writes(server.asked).map((one) => `${one.how} ${one.path}`)).toEqual([
        'POST /api/leagues',
        'DELETE /api/leagues/4212',
      ])

      const listed = within(await screen.findByRole('table', { name: 'Lige' }))

      expect(listed.queryByText('Vojvođanska liga 2027')).toBeNull()
      /* And the four that were served are all still there: a deletion keyed wrong takes
         a neighbour, and one written into the wrong store takes nothing at all. */
      expect(listed.getByText(ITS_NAME)).toBeVisible()
      expect(listed.getByText('Prva liga 2027')).toBeVisible()

      server.stop()
    }, SLOW)

  it('keeps the row and says why where the route refused the deletion', async () => {
    const server = serving(() => answeredWith(404))
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await deleteNamed(user, ITS_NAME)

    const listed = within(await screen.findByRole('table', { name: 'Lige' }))

    expect(listed.getByText(ITS_NAME)).toBeVisible()
    expect(await screen.findByRole('alert')).toHaveTextContent('404')

    server.stop()
  }, SLOW)

  it('deletes a competition whose season has frozen, because the owner said it may (PDL P15c)',
    async () => {
      /* P15c point 1, owner 22.09.2026, choosing between three outcomes: deleted at any
         moment, frozen season or not. `LeagueWriteApi.remove` is the one of its four routes
         that does not ask `isFrozen`, so a screen that refused first would be a second rule
         over a decision already taken. */
      const server = serving()
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await deleteNamed(user, FROZEN_NAME)

      expect(writes(server.asked)).toEqual([
        { path: `/api/leagues/${FROZEN}`, how: 'DELETE', body: {} },
      ])

      server.stop()
    }, SLOW)

  it('refuses to change one whose season has frozen, in the words of THAT screen', async () => {
    /* One reason name, two screens, two sentences. On the panel of races
       `theSeasonIsFrozen` means „no more races go in and taking one out still works"; here
       it means „the record is settled and deleting it still works".

       ASKED OF `buduca-2028` AND NOT OF `stara-2019`. Freezing is the ROUTE'S answer and this
       screen computes none of it, so which row is used would be arbitrary. ~~Except that the
       form's own `season` field carries `min: 2027`, so the 2019 row is refused by the FIELD.~~
       Since 23.11.2026 the season is a box of choices that holds the competition's own season
       (`leagueSeasons.ts`), so either row would reach the route; this one is kept because
       production cannot hold the other at all. */
    const server = serving(() => refused('theSeasonIsFrozen', 409))
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    const rows = within(await screen.findByRole('table', { name: 'Lige' }))
    const row = must(
      rows.getAllByRole('row').find((one) => one.textContent?.includes(CHANGEABLE_NAME)),
      'the row of the competition the route will call frozen',
    )

    await user.click(within(row).getByRole('button', { name: `Otvori: ${CHANGEABLE_NAME}` }))
    await user.click(await screen.findByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sezona ove lige je zamrznuta. Liga se može samo obrisati.',
    )

    server.stop()
  }, SLOW)

  describe('what this visit wrote, once the screen is left and returned to', () => {
    /**
     * A REVIEW MEASURED THIS ON PR 368, 25.09.2026, BY PROBING `origin/main` AND THIS
     * BRANCH WITH THE SAME THREE STEPS: A COMPETITION MADE OR RENAMED HERE STOOD ON
     * `main` AND VANISHED HERE THE MOMENT THE SCREEN WAS LEFT AND RETURNED TO, because
     * `written` had moved from the session's own provider - which lives as long as the
     * visit - to this component's state, which the router throws away the moment it
     * unmounts the screen, while the cache behind it was never cleared either.
     *
     * `serving` above answers every GET with the same four rows it was handed, forever,
     * which is right for every case above it - none of them reads `leagues` a second
     * time - and wrong for this one, because a fixture that never remembers a write
     * cannot tell a screen reading the server again apart from one that never does.
     * This one keeps its own copy and answers a write by changing it, the way
     * `LeagueWriteApi` really does.
     */
    function servingWithMemory() {
      clearResourceCache()

      const remembered = LEAGUES.map((one) => ({ ...one }))

      return serverThat((path, init) => {
        const how = init?.method ?? 'GET'
        const changed = /^\/api\/leagues\/(\d+)$/.exec(path)
        const sent: Record<string, unknown> =
          typeof init?.body === 'string' ? JSON.parse(init.body) : {}

        if (path === '/api/leagues' && how === 'GET') {
          return new Response(JSON.stringify(remembered), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }

        if (path === '/api/leagues' && how === 'POST') {
          const id = 4212

          remembered.push({
            id,
            slug: String(sent.slug),
            name: String(sent.name),
            season: Number(sent.season),
            rules: String(sent.rules ?? ''),
            prizes: String(sent.prizes ?? ''),
            eventIds: [],
            raceIds: [],
            highlightsEvents: sent.highlightsEvents === true,
          })

          return new Response(JSON.stringify({ id, slug: sent.slug }), {
            status: 201,
            headers: { 'content-type': 'application/json' },
          })
        }

        if (changed !== null && how === 'PUT') {
          const pos = remembered.findIndex((one) => one.id === Number(changed[1]))

          /* `at()` and not `remembered[pos]` directly: under `noUncheckedIndexedAccess`
             the second is `(typeof remembered)[number] | undefined`, and spreading that
             turns every field the object literal below does not name - `id`, `eventIds`,
             `raceIds` - optional in the result, which no longer matches what `remembered`
             holds. `pos !== -1` already says the row is there; `at` is what tells the
             compiler the same thing. */
          if (pos !== -1) {
            remembered[pos] = {
              ...at(remembered, pos),
              name: String(sent.name),
              slug: String(sent.slug),
              season: Number(sent.season),
              rules: String(sent.rules ?? ''),
              prizes: String(sent.prizes ?? ''),
            }
          }

          return did()
        }

        if (changed !== null && how === 'DELETE') {
          const pos = remembered.findIndex((one) => one.id === Number(changed[1]))

          if (pos !== -1) {
            remembered.splice(pos, 1)
          }

          return did()
        }

        return how === 'GET' ? null : did()
      })
    }

    /**
     * AWAY TO ANOTHER SCREEN AND BACK, WITH THE OTHER SCREEN REALLY DRAWN IN BETWEEN.
     *
     * **The wait in the middle is the whole of it, and it was missing until 25.09.2026.**
     * Two `router.navigate` calls one after the other do not unmount anything: a probe put
     * between them found `screen.queryByRole('table', { name: 'Lige' })` still in the
     * document, so the screen never left and never mounted a second time, and three of the
     * four cases below passed with the production fix taken back out. Measured by returning
     * the call in `AdminLeagues.saveOne`, then in `deleteOne`, and watching nothing fail.
     *
     * Waiting for something only the OTHER screen has is what this project already writes
     * down for a walk through screens (`CLAUDE.md`, 07.09.2026), and the table of teams is
     * that thing: this screen has no table by that name and that screen has nothing else.
     * What follows the second navigation is each case's own wait for the competitions.
     */
    async function awayAndBack(router: ReturnType<typeof renderAt>['router']) {
      await router.navigate('/sr/administracija/timovi')
      await screen.findByRole('table', { name: 'Timovi' })
      await router.navigate('/sr/administracija/lige')
    }

    it('keeps a competition made this visit after the screen is left and returned to',
      async () => {
        const server = servingWithMemory()
        const user = setupUser()
        const { router } = renderAt('/sr/administracija/lige', 'superadmin')

        await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
        await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
        await user.type(screen.getByLabelText(/^Adresa/), 'vojvodjanska-2027')
        await user.selectOptions(screen.getByLabelText(/^Sezona/), '2027')
        await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
        await screen.findByRole('status', { name: 'Sačuvano' })
        await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

        /* THE ROUTER UNMOUNTS THIS SCREEN AND MOUNTS ANOTHER, exactly what the review's
           own probe did against a real browser. `/sr/administracija/timovi` is the very
           address it used, and coming back is the second half of the same probe. */
        await awayAndBack(router)

        const listed = within(await screen.findByRole('table', { name: 'Lige' }))

        expect(listed.getByText('Vojvođanska liga 2027')).toBeVisible()

        server.stop()
      }, SLOW)

    it('keeps a rename after the screen is left and returned to', async () => {
      const server = servingWithMemory()
      const user = setupUser()
      const { router } = renderAt('/sr/administracija/lige', 'superadmin')

      await openIt(user)

      const name = await screen.findByLabelText(/^Naziv lige/)

      await user.clear(name)
      await user.type(name, 'Druga liga 2027 i prijatelji')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

      await awayAndBack(router)

      const listed = within(await screen.findByRole('table', { name: 'Lige' }))

      expect(listed.getByText('Druga liga 2027 i prijatelji')).toBeVisible()
      expect(listed.queryByText(ITS_NAME)).toBeNull()

      server.stop()
    }, SLOW)

    it('does not bring a deleted competition back after the screen is left and returned to',
      async () => {
        const server = servingWithMemory()
        const user = setupUser()
        const { router } = renderAt('/sr/administracija/lige', 'superadmin')

        await deleteNamed(user, ITS_NAME)

        await awayAndBack(router)

        const listed = within(await screen.findByRole('table', { name: 'Lige' }))

        expect(listed.queryByText(ITS_NAME)).toBeNull()
        expect(listed.getByText('Prva liga 2027')).toBeVisible()

        server.stop()
      }, SLOW)

    it('shows a proposition changed in the administration on the public list, opened fresh',
      async () => {
        /* THE THIRD ROW OF THE REVIEW'S OWN TABLE: not this screen read twice, but a
           DIFFERENT one, `pages/Leagues.tsx`, mounted for the first time in this visit
           after the write. It has never read `leagues` before this point, so the only
           way it can show the old text is if the cache this screen fetched at its OWN
           mount is still what answers the public screen's first read. */
        const server = servingWithMemory()
        const user = setupUser()
        const { router } = renderAt('/sr/administracija/lige', 'superadmin')

        await openIt(user)

        /* NOT AN EXACT MATCH: the field is not one of the three required ones
           (`admin-liga.form.json`), and the form appends „ (neobavezno)" to the label of
           every field that is not - `LABEL:Propozicije (neobavezno)`, measured off this
           very screen. `entityForms.test.tsx` reads the dictionary key alone and never
           sees that suffix, which is why the bare word is not what a reader is offered. */
        /* THE BOX IS ASKED WHAT IT HOLDS BEFORE THE FORM IS SAVED (CI, 06.11.2026, twice, on
           branches that touch no frontend). The run that failed drew the public box with
           „Još nije napisano.": `clear` had reached the form and the sentence had not. The field
           is the editor of the texts (`components/markdownEditor/`), not an `<input>`: a text
           handed back to it by the form that is not the one it last said it holds replaces what
           is in the box, so a keystroke that lands while the form is still handing back an
           earlier text is lost, and on a busy runner that is a matter of order. Nothing about
           the claim moves - the box of the competition must still carry exactly this sentence,
           read off the public screen. Only the SETTING UP of the case waits until the box
           really holds what it is about to save, and writes again if it does not. */
        const sentence = 'Nove propozicije sa administracije.'

        await screen.findByLabelText(/^Propozicije/)

        for (let attempt = 0; attempt < 3; attempt += 1) {
          await user.clear(screen.getByLabelText(/^Propozicije/))
          await user.type(screen.getByLabelText(/^Propozicije/), sentence)
          await act(async () => {})

          if (screen.getByLabelText(/^Propozicije/).textContent === sentence) {
            break
          }
        }

        expect(screen.getByLabelText(/^Propozicije/)).toHaveTextContent(sentence)
        await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
        await screen.findByRole('status', { name: 'Sačuvano' })

        await router.navigate(`/sr/lige?sezona=2027&liga=${ITS_ADDRESS}`)

        const box = must(
          (await screen.findByRole('heading', { level: 2, name: new RegExp(ITS_NAME) })).closest(
            'article',
          ),
          'the box of the competition just changed',
        )

        expect(within(box).getByText(sentence)).toBeVisible()

        server.stop()
      }, SLOW)
  })

  /**
   * AND THE PANEL OF RACES IN EVERY FORM STILL COUNTS WHAT IT COUNTED, AFTER A SAVE HERE.
   *
   * **What this measures is what the fix above CREATED, and it was measured in a browser
   * before it was written down (review, PR 368, 25.09.2026).** `clearResourceCache('leagues')`
   * empties the one entry `LeagueRaceModeration` used to seed itself from, and closing the
   * editor swaps this screen's whole subtree, so every panel mounted again against an empty
   * cache: the competition that counts a race read „no race has been given to this
   * competition yet", and the control that takes one out was gone with it - a moderator could
   * not drop a race for the rest of the visit, and could add one that was already in.
   *
   * **The competition SAVED is not the competition LOOKED AT**, because the fault was never
   * about the row being edited: it took every panel on the screen. Read the other way round,
   * a fix that only carried the edited row's own races through would pass.
   */
  it('leaves a competition counting its races after a DIFFERENT one is renamed here',
    async () => {
      /** What tells race 125 from everything else drawn here, and it is never the name.
       *  Both races of Beogradski maraton carry the event's name (`data/raceLabel.ts`); the
       *  distance is what parts them, and only this one is counted. */
      const ITS_RACE = '2,5 km'

      /* The controls that take a race out of a competition, one per race it really counts.
         Counted rather than read out of the text, for the reason `leagueRaceModeration.test.tsx`
         gives: the races of a chosen day are drawn as OPTIONS of the second box, so a distance
         can be on the screen without being counted. Nothing is chosen here, and this is still
         the claim that survives somebody choosing one. */
      const dropsIn = (id: number) =>
        within(
          must(document.getElementById(`league-moderation-${id}`), 'the panel of races'),
        ).queryAllByRole('button', { name: /^Izbaci trku/ })

      const openTheBoxOf = async (user: ReturnType<typeof setupUser>, name: string) => {
        const table = within(await screen.findByRole('table', { name: 'Lige' }))
        const row = must(
          table.getAllByRole('row').find((one) => one.textContent?.includes(name)),
          `the row of ${name}`,
        )

        await user.click(within(row).getByRole('button', { name: `Otvori: ${name}` }))
        await user.click(await screen.findByRole('button', { name: `Trke u ligi ${name}` }))
      }

      const server = serving()
      const user = setupUser()

      renderAt('/sr/administracija/lige', 'superadmin')

      await openTheBoxOf(user, ITS_NAME)

      expect(dropsIn(ACTED).map((one) => one.getAttribute('aria-label') ?? '')).toEqual([
        `Izbaci trku Beogradski maraton 2027. (${ITS_RACE}) iz lige`,
      ])

      /* THE OTHER COMPETITION IS OPENED, RENAMED AND SAVED, and then the list is come back
         to - which is what unmounts the panel and mounts one again, now that it stands in the form. */
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

      const rows = within(await screen.findByRole('table', { name: 'Lige' }))
      const other = must(
        rows.getAllByRole('row').find((one) => one.textContent?.includes('Prva liga 2027')),
        'the row of the competition that counts nothing',
      )

      await user.click(within(other).getByRole('button', { name: 'Otvori: Prva liga 2027' }))

      const name = await screen.findByLabelText(/^Naziv lige/)

      await user.clear(name)
      await user.type(name, 'Prva liga 2027 preimenovana')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

      await screen.findByRole('table', { name: 'Lige' })
      await openTheBoxOf(user, ITS_NAME)

      /* The same one control, with the same race on it. `Druga liga 2027` was not written
         to, nothing was asked of the server about its races, and the only thing between the
         two readings is the write to the competition above it. */
      expect(dropsIn(ACTED).map((one) => one.getAttribute('aria-label') ?? '')).toEqual([
        `Izbaci trku Beogradski maraton 2027. (${ITS_RACE}) iz lige`,
      ])

      /* And the sentence for a competition that counts nothing is NOT what it says, which is
         the exact face the fault wore. */
      expect(
        must(
          document.getElementById(`league-moderation-${ACTED}`),
          'the panel of races',
        ).textContent ?? '',
      ).not.toContain('Ovoj ligi još nije dodeljena nijedna trka')

      server.stop()
    }, SLOW)

  /**
   * THE FORM OF A COMPETITION OPENED FROM THE ADDRESS (`?izmena=`), THE WAY THE EVENTS DO (`AdminEvents.tsx`;
   * the pencil in the head of the page of a competition sends the reader here, PDL 21.11.2026).
   *
   * **The axes, counted.** `ACTED` is written second and keyed third of four, so „the one the address names",
   * „the first served" and „the one a row opens" are three different competitions. An address that names
   * nothing, a number this list has not got, and two that a lookup by number would accept (`09`, `9abc`)
   * are four ways of being wrong. And the save of a form opened this way is the one thing no state holds.
   */
  describe('and the form of one is opened from the address', () => {
    it('opens THE competition the address names, with its own values, and not the first served',
      async () => {
        const server = serving()

        renderAt(`/sr/administracija/lige?izmena=${ACTED}`, 'superadmin')

        expect(await screen.findByLabelText(/^Naziv lige/)).toHaveValue(ITS_NAME)
        expect(screen.getByLabelText(/^Adresa/)).toHaveValue(ITS_ADDRESS)
        expect(screen.getByRole('button', { name: `Trke u ligi ${ITS_NAME}` })).toBeVisible()
        expect(screen.queryByRole('table', { name: 'Lige' })).not.toBeInTheDocument()

        server.stop()
      }, SLOW)

    it.each(['999999', '', '09', '9abc', 'devet'])(
      'draws the list and not a form where the address names %j',
      async (named) => {
        const server = serving()

        renderAt(`/sr/administracija/lige?izmena=${named}`, 'superadmin')

        expect(await screen.findByRole('table', { name: 'Lige' })).toBeVisible()
        expect(screen.queryByLabelText(/^Naziv lige/)).not.toBeInTheDocument()
        expect(writes(server.asked)).toEqual([])

        server.stop()
      }, SLOW)

    it('saves as a change of THAT competition: a PUT on its own address, and never a POST', async () => {
      const server = serving()
      const user = setupUser()

      renderAt(`/sr/administracija/lige?izmena=${ACTED}`, 'superadmin')

      const name = await screen.findByLabelText(/^Naziv lige/)

      await user.clear(name)
      await user.type(name, 'Druga liga 2027 i prijatelji')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(writes(server.asked).map((one) => `${one.how} ${one.path}`)).toEqual([
        `PUT /api/leagues/${ACTED}`,
      ])

      server.stop()
    }, SLOW)

    it('forgets the address when the form is left, so the list comes back and stays', async () => {
      const server = serving()
      const user = setupUser()
      const { router } = renderAt(`/sr/administracija/lige?izmena=${ACTED}`, 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nazad na spisak' }))

      expect(await screen.findByRole('table', { name: 'Lige' })).toBeVisible()
      expect(router.state.location.search).toBe('')
      /* IN PLACE OF THE ENTRY THAT OPENED THE FORM, and not on top of it: a push would leave the entry with
         `?izmena=` one step back, and the browser's Back would open the form again (`AdminEvents.tsx` does
         the same). */
      expect(router.state.historyAction).toBe('REPLACE')
      expect(screen.queryByLabelText(/^Naziv lige/)).not.toBeInTheDocument()

      server.stop()
    }, SLOW)

    it('lets what was pressed win over an address that arrives while it is open', async () => {
      const server = serving()
      const user = setupUser()
      const { router } = renderAt('/sr/administracija/lige', 'superadmin')

      /* THE FIRST ROW IS PRESSED, and then the address names ANOTHER competition (the browser's Forward, a
         link to this screen), so „what was pressed" and „what the address names" are two competitions. */
      const table = within(await screen.findByRole('table', { name: 'Lige' }))
      const row = must(
        table.getAllByRole('row').find((one) => one.textContent?.includes('Prva liga 2027')),
        'the row of the first competition',
      )

      await user.click(within(row).getByRole('button', { name: 'Otvori: Prva liga 2027' }))
      expect(await screen.findByLabelText(/^Naziv lige/)).toHaveValue('Prva liga 2027')

      await act(() => router.navigate(`/sr/administracija/lige?izmena=${ACTED}`))

      /* Asked of the BOX and not of the field: the fields of an open form hold what they were opened with
         whatever the record under them becomes, so the name in the field says nothing about which
         competition the screen thinks is open. The box is drawn for the competition it is open on. */
      expect(screen.getByRole('button', { name: 'Trke u ligi Prva liga 2027' })).toBeVisible()
      expect(screen.queryByRole('button', { name: `Trke u ligi ${ITS_NAME}` })).not.toBeInTheDocument()

      server.stop()
    }, SLOW)

    it('opens a form for a new competition from the list, with no box of races', async () => {
      const server = serving()
      const user = setupUser()

      renderAt(`/sr/administracija/lige?izmena=${ACTED}`, 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nazad na spisak' }))
      await user.click(await screen.findByRole('button', { name: 'Nova liga' }))

      expect(await screen.findByLabelText(/^Naziv lige/)).toHaveValue('')
      expect(screen.queryByRole('button', { name: /^Trke u ligi / })).not.toBeInTheDocument()

      server.stop()
    }, SLOW)
  })

  it('is open to a moderator holding the right over competitions, and shut to one without it',
    async () => {
      const server = serving()

      renderAt('/sr/administracija/lige', 'moderator', null, moderatorWith(['entity:leagues']))

      expect(await screen.findByRole('table', { name: 'Lige' })).toBeVisible()

      server.stop()
    }, SLOW)

  it('is shut to a moderator whose box for competitions is not ticked', async () => {
    const server = serving()

    renderAt('/sr/administracija/lige', 'moderator', null, moderatorWith(['entity:teams']))

    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent('Lige')

    server.stop()
  }, SLOW)
})
