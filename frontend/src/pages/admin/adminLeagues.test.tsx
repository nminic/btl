import { fireEvent, screen, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
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
import { SLOW } from '../../test/slow'

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

  const LEAGUES = [
    { id: COUNTS_NOTHING, slug: 'prva-2027', name: 'Prva liga 2027', season: 2027, rules: '',
      prizes: '', eventIds: [], raceIds: [] },
    { id: ACTED, slug: ITS_ADDRESS, name: ITS_NAME, season: 2027, rules: 'Propozicije druge',
      prizes: 'Nagrade druge', eventIds: [1133], raceIds: [125] },
    { id: FROZEN, slug: 'stara-2019', name: FROZEN_NAME, season: 2019, rules: '', prizes: '',
      eventIds: [], raceIds: [] },
    { id: 13, slug: 'buduca-2028', name: 'Buduća liga 2028', season: 2028, rules: '', prizes: '',
      eventIds: [], raceIds: [] },
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
    await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${name}` }))

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
    await user.type(screen.getByLabelText(/^Sezona/), '2027')
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
      await user.type(screen.getByLabelText(/^Sezona/), '2027')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

      const listed = within(await screen.findByRole('table', { name: 'Lige' }))

      expect(listed.getByRole('link', { name: '/liga/vojvodjanska-2027' })).toHaveAttribute(
        'href',
        '/sr/liga/vojvodjanska-2027',
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
      await user.type(screen.getByLabelText(/^Sezona/), '2027')
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
      await user.type(screen.getByLabelText(/^Sezona/), '2027')

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
          },
        },
      ])

      server.stop()
    }, SLOW)

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

  it('says in words what the route refused, and keeps the form as it was', async () => {
    const server = serving(() => refused('theSeasonIsNotThisOneOrTheNext'))
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Liga 2099')
    await user.type(screen.getByLabelText(/^Adresa/), 'liga-2099')
    await user.type(screen.getByLabelText(/^Sezona/), '2099')
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
      await user.type(screen.getByLabelText(/^Sezona/), '2027')
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
      await user.type(screen.getByLabelText(/^Sezona/), '2027')
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

       ASKED OF `buduca-2028` AND NOT OF `stara-2019`, AND THAT IS A MEASUREMENT OF THE
       FORM. Freezing is the ROUTE'S answer and this screen computes none of it, so which
       row is used would be arbitrary - except that the form's own `season` field carries
       `min: 2027` (`admin-liga.form.json`, which agrees with
       `league_season_not_before_the_league`). Opening the 2019 row and pressing Save is
       therefore refused by the FIELD, before anything is sent, and the case would have
       measured the form rather than the sentence. Production cannot hold such a row at
       all; the fixture carries one only so that „its own season" is a claim that can
       fail. */
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
      'Sezona ove lige je zamrznuta, pa se liga više ne menja. Brisanje i dalje radi.',
    )

    server.stop()
  }, SLOW)

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
