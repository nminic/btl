import { act, configure, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aNeverPaidRecord, neverPaidAsServed } from '../../test/neverPaid'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'

/**
 * THE SETTINGS SCREEN HAS THREE SHAPES, AND WHICH ONE A READER IS DRAWN IS DECIDED BY WHO HE IS.
 *
 * <p>PDL P8, the entry „Šta sme neplaćen član" (10.10.2026) and its addition of 11.10.2026, both
 * chosen by the owner between offered outcomes - the sentences are the record's and not his own
 * words:
 *
 * <ul>
 * <li><b>Somebody who registered and has not paid</b> may change „lozinku, adresu pošte i svoje
 * podatke za evidenciju i majicu", and may not do „ništa što ga čini vidljivim ili ga uključuje u
 * ligu: sliku, biografiju, skrivanje profila".</li>
 * <li><b>A member whose fee has lapsed</b> „dopire samo do obnove i svog profila": the data and the
 * password are answered 404 (`PUT /api/me`, `PUT /api/me/password`), and the picture, the
 * biography and the switch with them.</li>
 * <li><b>A member whose fee stands</b> may change all of it, and is the anchor the other two are
 * measured against: a screen that took everything from everybody would pass every absence below
 * and fail every presence.</li>
 * </ul>
 *
 * <p><b>Each panel is asked by its heading</b> (`getByRole`, not a class), and the absences are
 * asked only after the screen has finished drawing what it is going to draw - the heading of the
 * screen and then a tick for the public list to arrive - so that „the picture is not there" is
 * never satisfied by „the picture has not arrived yet". That is the one way an absence on this
 * screen can be vacuous: the three panels a member is drawn arrive behind a read.
 */

/* Every wait of this file is given half of the time a case has, so a wait that never succeeds ends
   the case with the assertion's own words and not with the case's clock. */
configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function stand<T extends { stop: () => void }>(server: T): T {
  stops.push(server.stop)

  return server
}

/** The headings of the panels, by what they are called on the screen. */
const PANELS = {
  data: 'Lični podaci',
  locked: 'Podaci koji se ne menjaju ovde',
  picture: 'Profilna slika',
  biography: 'Tekst o sebi',
  password: 'Lozinka',
  appearance: 'Izgled',
  privacy: 'Privatnost',
} as const

const WHAT_OPENS_LATER =
  'Slika, biografija i skrivanje profila otvaraju se kad tvoja članarina bude evidentirana.'

/**
 * The screen once it has drawn what it is going to draw: its own heading, and then everything the
 * public list was asked for and the settings was waiting on.
 *
 * <p>The list is asked for by the header's menu too, and a second `serverThat` in front of the
 * disc reader is how the case sees WHEN it was asked; a few ticks after that it has been drawn from,
 * if it is going to be. Said once here so that no absence below is asked in the first render.
 */
async function drawn(): Promise<void> {
  expect(await screen.findByRole('heading', { level: 1, name: 'Podešavanja' })).toBeVisible()
  expect(await screen.findByRole('heading', { level: 2, name: PANELS.appearance })).toBeVisible()

  await act(async () => {
    for (let tick = 0; tick < 5; tick += 1) {
      await new Promise((settled) => {
        setTimeout(settled, 0)
      })
    }
  })
}

describe('the settings of somebody who registered and has not paid', () => {
  it('draws his data and his password and the theme, and nothing that makes a member visible', async () => {
    stand(neverPaidAsServed())
    renderAt('/sr/podesavanja', 'visitor', null)

    await drawn()

    /* What the entry lets him do. His data arrives behind a read of its own, so it is waited for. */
    expect(await screen.findByRole('heading', { level: 2, name: PANELS.data })).toBeVisible()
    expect(screen.getByDisplayValue('Tek')).toBeVisible()
    expect(screen.getByDisplayValue('Stigao')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: PANELS.locked })).toBeVisible()
    expect(screen.getByText('Beograd')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: PANELS.password })).toBeVisible()

    /* What it does not: „sliku, biografiju, skrivanje profila". */
    expect(screen.queryByRole('heading', { name: PANELS.picture })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: PANELS.biography })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: PANELS.privacy })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('is told, once, that the three he does not see open with his fee', async () => {
    stand(neverPaidAsServed())
    renderAt('/sr/podesavanja', 'visitor', null)

    await drawn()

    expect(await screen.findByText(WHAT_OPENS_LATER)).toBeVisible()
    expect(screen.getAllByText(WHAT_OPENS_LATER)).toHaveLength(1)
  })

  it('draws his data from the answer that has a row for him, and not from the public list', async () => {
    /* The list the server serves is every member whose fee stands, and he is on no row of it, so a
       screen that looked him up THERE would draw nothing of his. His data is asked for under his own
       cookie (`GET /api/me`) a second time, after the shell's own question. */
    const { asked } = stand(neverPaidAsServed())

    renderAt('/sr/podesavanja', 'visitor', null)

    await drawn()
    await screen.findByRole('heading', { level: 2, name: PANELS.data })

    expect(asked.filter((one) => one.path === '/api/me')).toHaveLength(2)
  })

  it('says his data could not be read, and offers to ask again, when the server will not give it', async () => {
    /* The shell's question is answered, and the one that follows is not: the second read of the
       same address is the screen's own. Said in the portal's own words (`components/Resource`) and
       not in a sentence of this screen's. */
    let answered = 0

    stand(
      serverThat((path) => {
        if (path !== '/api/me') {
          return null
        }

        answered += 1

        return answered === 1
          ? new Response(
              JSON.stringify({ role: 'competitor', account: 1, member: aNeverPaidRecord }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          : new Response(null, { status: 500 })
      }),
    )
    renderAt('/sr/podesavanja', 'visitor', null)

    await drawn()

    expect(await screen.findByText('Podaci se ne mogu učitati.')).toBeVisible()
    expect(screen.getByRole('button', { name: /Pokušaj ponovo/ })).toBeVisible()
    /* And the rest of the screen is there, because a failed read of his data is not a reason to
       take his password or the theme away from him. */
    expect(screen.getByRole('heading', { level: 2, name: PANELS.password })).toBeVisible()
  })
})

describe('the settings of a member whose fee has lapsed', () => {
  /* 000032 is the member of the generated data whose fee has lapsed: the harness answers
     `GET /api/me` off the file, and his row there is `active: false`. */
  it('draws the theme and nothing else, because the server answers 404 to everything else', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000032')

    await drawn()

    for (const panel of [
      PANELS.data,
      PANELS.locked,
      PANELS.picture,
      PANELS.biography,
      PANELS.password,
      PANELS.privacy,
    ]) {
      expect(screen.queryByRole('heading', { name: panel }), panel).not.toBeInTheDocument()
    }

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    /* And not the sentence that is for somebody who has not paid: he HAS a number, and „kad tvoja
       članarina bude evidentirana" is said to a person whose fee was never recorded. */
    expect(screen.queryByText(WHAT_OPENS_LATER)).not.toBeInTheDocument()
  })
})

describe('the settings of a member whose fee stands', () => {
  /* 000001 is freed of the fee in the generated data and stands. The anchor of the other two:
     everything is drawn, in the order it was always drawn in. */
  it('draws every panel there is, and not the sentence for somebody who has not paid', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000001')

    await drawn()

    for (const panel of [
      PANELS.data,
      PANELS.locked,
      PANELS.picture,
      PANELS.biography,
      PANELS.password,
      PANELS.privacy,
    ]) {
      expect(await screen.findByRole('heading', { name: panel }), panel).toBeVisible()
    }

    expect(screen.getByRole('checkbox')).toBeVisible()
    expect(screen.queryByText(WHAT_OPENS_LATER)).not.toBeInTheDocument()
  })

  it('draws them in the order of how much each is his own, with the password before the theme', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000001')

    await drawn()
    await screen.findByRole('heading', { level: 2, name: PANELS.privacy })

    expect(
      within(screen.getByRole('main'))
        .getAllByRole('heading', { level: 2 })
        .map((one) => one.textContent),
    ).toEqual([
      PANELS.data,
      PANELS.locked,
      PANELS.picture,
      PANELS.biography,
      PANELS.password,
      PANELS.appearance,
      PANELS.privacy,
    ])
  })
})
