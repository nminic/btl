import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { at, first, must, selectElement } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { loadResource } from '../../data/client'
import type { Competitor } from '../../data/types'
import { awardsOf } from './awards'
import { shortBio } from './bio'

/* The parts of the profile that a screen alone cannot show: the cut on a long
 * biography, the awards of somebody who has won nothing, and the one piece of
 * layout jsdom refuses to compute. */

describe('the biography, cut to fit beside the widgets', () => {
  it('leaves a short one alone', () => {
    expect(shortBio('Trčim zbog druženja.')).toBe('Trčim zbog druženja.')
  })

  it('cuts a long one at a word, never in the middle of one', () => {
    const long = `${'reč '.repeat(200)}kraj`
    const cut = shortBio(long)

    expect(cut.length).toBeLessThanOrEqual(361)
    expect(cut.endsWith('…')).toBe(true)
    // The character before the ellipsis is the end of a word, not half of one.
    expect(cut.slice(-2, -1)).not.toBe(' ')
    expect(long.startsWith(cut.slice(0, -1))).toBe(true)
  })

  it('cuts one long word rather than refusing to cut', () => {
    // Nothing on the portal writes like this; a row that arrives from somewhere
    // else might, and the layout still has to survive it.
    const wall = 'a'.repeat(900)

    expect(shortBio(wall)).toHaveLength(361)
  })

  it('cuts the long one in the data, so the third card stays level with the other two', async () => {
    /* The rotation hands out nothing longer than two hundred and thirty seven
       characters, so until 000009 was given a long one the limit had nothing to
       act on and the card that has to finish where the two beside it finish was
       never once asked to. Measured in the browser at the limit: all three cards
       come to the same height and the words do not spill. */
    renderAt('/sr/takmicar/000009')

    const card = await screen.findByRole('heading', { name: 'Svojim rečima' })
    const text = must(must(card.parentElement, 'a parent').textContent, 'text')

    expect(text).toContain('…')
    expect(text.length).toBeLessThan(400)
  })

  it('now cuts a biography that used to fit', () => {
    /* The limit came down from six hundred to three hundred and sixty when the
       widget beside it lost its heading and a row (owner, 31.07.2026). A text
       right on the old limit must now be cut, or the card grows past the two it
       stands beside and the row of three stops being a row. */
    const wasFine = 'reč '.repeat(150).trim()

    expect(wasFine.length).toBeGreaterThan(361)
    expect(shortBio(wasFine).endsWith('…')).toBe(true)
  })
})

describe('what a competitor has won', () => {
  it('says so plainly where they have won nothing', async () => {
    // 000031 has never raced, so no board has ever had them on it.
    renderAt('/sr/takmicar/000031/priznanja')

    /* Named for what the screen actually holds. P16 also gives a medal for
       twelve points and figures for the boards of Article 25, and neither is
       here yet, so "no award at all" would have been a claim the screen cannot
       make. */
    expect(await screen.findByText('Ovaj takmičar još nema nijedan pehar.')).toBeVisible()
    expect(screen.getByText('Još nijedan dukat.')).toBeVisible()
  })

  it('lists the seasons a place was taken in, newest first', async () => {
    renderAt('/sr/takmicar/000001/priznanja?sezona=sve')

    const table = await screen.findByRole('table', { name: 'Pehari' })
    const seasons = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => Number(first(within(row).getAllByRole('cell')).textContent))

    expect(seasons.length).toBeGreaterThan(0)
    expect([...seasons].sort((left, right) => right - left)).toEqual(seasons)
  })

  it('is not there at all for a member who is no longer active', async () => {
    renderAt('/sr/takmicar/000032/priznanja')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovog profila nema.' }),
    ).toBeVisible()
  })
})

describe('clearing the filters', () => {
  it('puts the reader back on the season the profile opens on', async () => {
    const user = setupUser()
    renderAt('/sr/takmicar/000007?sezona=2010&duzina=marathon')

    expect(await screen.findByText(/nema nijednog rezultata/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Poništi filtere' }))

    expect(screen.getByRole('table', { name: 'Rezultati' })).toBeVisible()
    // The length is a row of six now, and the one that is on says which.
    expect(screen.getByRole('button', { name: 'Sve dužine Sve' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Maraton 42,2 km' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('the length, as one row of six', () => {
  it('narrows the table on one click and says which one is on', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/takmicar/000002?sezona=sve')

    const table = await screen.findByRole('table', { name: 'Rezultati' })
    const all = within(table).getAllByRole('row').length

    await user.click(screen.getByRole('button', { name: 'Polumaraton 21,1 km' }))

    const narrowed = within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row')
    expect(narrowed.length).toBeLessThan(all)
    expect(narrowed.length).toBeGreaterThan(1)
    expect(screen.getByRole('button', { name: 'Polumaraton 21,1 km' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Sve dužine Sve' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // One click, and the choice is in the address so the link carries it.
    expect(router.state.location.search).toContain('duzina=half')
  })

  it('drops the length out of the address again when all of them are chosen', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/takmicar/000002?sezona=sve&duzina=half')

    await screen.findByRole('table', { name: 'Rezultati' })
    expect(router.state.location.search).toContain('duzina=half')

    await user.click(screen.getByRole('button', { name: 'Sve dužine Sve' }))

    // Written into the address only where it differs from the default, so an
    // address stays as short as it can be.
    expect(router.state.location.search).not.toContain('duzina')
    expect(router.state.location.search).toContain('sezona=sve')
  })

  it('is named by both of its names, at every width', async () => {
    renderAt('/sr/takmicar/000002?sezona=sve')

    await screen.findByRole('table', { name: 'Rezultati' })

    /* Both names are always in the reading, and only one of them is on screen.
       The first attempt hid the long one with `display: none` and the short one
       with `aria-hidden`, which between them left the control with no accessible
       name at all below 620px: six unnamed buttons on the width PDL P24 calls
       the main one. */
    expect(screen.getByRole('button', { name: 'Maraton 42,2 km' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sve dužine Sve' })).toBeVisible()
    expect(document.querySelector('.profile__length-short')).not.toHaveAttribute('aria-hidden')
  })

  it('hides one of the two names by moving it, never by removing it', () => {
    /* jsdom computes no media queries, so the rule is read as text, the way the
       ducat art and the ring are tested (ADL A7). `display: none` on either name
       is what would take it out of the reading, and it is the one thing this
       stylesheet must not do to them. */
    const css = readFileSync(join(process.cwd(), 'src/pages/Profile.css'), 'utf-8')

    /* Matched on the rules themselves rather than on everything after the first
       mention of one. A slice to the end of the file catches any `display: none`
       written below it, for any selector at all, and misses one written above. */
    expect(css).toMatch(/\.profile__length-short\s*\{[^}]*clip-path: inset\(50%\)/)
    expect(css).toMatch(
      /@media \(max-width: 620px\)[\s\S]*?\.profile__length-full\s*\{[^}]*clip-path: inset\(50%\)/,
    )
    expect(css).not.toMatch(/\.profile__length-(full|short)\s*\{[^}]*display:\s*none/)
  })
})

describe('the five lengths, as five colours', () => {
  it('carries a value for each of them in both themes', () => {
    /* Blue, green, yellow, orange, red, shortest to longest (owner,
       31.07.2026). Per theme, because a colour that reads on a white card
       disappears on a dark one. jsdom computes no custom properties, so the
       tokens are read as text, the way the ducat art is tested (ADL A7). */
    const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')

    for (const name of ['short', 'half', 'long', 'marathon', 'ultra']) {
      // Once for the light theme and twice for the dark one, which is written
      // out for the media query and for the switch.
      expect(css.match(new RegExp(`--length-${name}:`, 'g'))).toHaveLength(3)
    }
  })

  it('turns the slices and not the figures in the middle of them', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/CategoryDonut.css'), 'utf-8')

    expect(css).toContain('.donut__ring')
    expect(css).toContain('transform: rotate(-90deg)')
    // The names beside the ring, and the lines that ran to them, are gone.
    expect(css).not.toContain('donut-leader')
    expect(css).not.toContain('writing-mode')
  })
})

describe('a season in which both a trophy and a plaque were taken', () => {
  /* Built by hand rather than found in the generated data, because what has to
     be shown is one competitor on two boards in one season: the general standing
     of their gender, and their own category inside it. Both give out three
     (PDL P16), so somebody near the top of a small field takes both. */
  const person = (memberNumber: string, birthYear: number) => ({
    memberNumber,
    firstName: 'Probni',
    lastName: memberNumber,
    gender: 'M' as const,
    city: 'Čačak',
    country: 'RS',
    birthYear,
    firstSeason2027: false,
    firstSeason: 2020,
    active: true,
    membershipBasis: 'payment' as const,
    referralCode: 'proba0000',
    referredBy: null,
    teamId: null,
    teamSince: null,
    bio: '',
  })

  const race = (memberNumber: string, points: number, id: string) => ({
    id,
    memberNumber,
    raceId: 'r1',
    eventName: 'Proba',
    eventSlug: 'proba',
    date: '2027-05-01',
    distanceKm: 10,
    ascentM: 0,
    descentM: 0,
    seconds: 3000,
    points,
    category: 'short' as const,
  })

  it('carries both, the better place first', () => {
    const mine = person('000101', 1990)
    const others = [person('000102', 1990), person('000103', 1955)]
    const results = [
      race('000101', 100, 'a'),
      race('000102', 200, 'b'),
      race('000103', 300, 'c'),
    ]

    const awards = awardsOf(mine, [mine, ...others], results)

    /* Third of the three overall, second of the two in the age band, and the
       better place is listed first. */
    expect(awards.map((one) => one.kind)).toEqual(['category', 'overall'])
    expect(awards.map((one) => one.position)).toEqual([2, 3])
    expect(first(awards).category).not.toBe('')
    expect(at(awards, 1).category).toBe('')
  })

  it('carries nothing from a season the competitor was not in the top three of', () => {
    const mine = person('000101', 1990)
    const others = Array.from({ length: 5 }, (_, index) => person(`00020${index}`, 1990))
    const results = [
      race('000101', 1, 'a'),
      ...others.map((one, index) => race(one.memberNumber, 100 + index, `b${index}`)),
    ]

    expect(awardsOf(mine, [mine, ...others], results)).toEqual([])
  })
})

describe('the address stays as short as it can be', () => {
  it('carries the season only where it differs from the default', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1 })
    const season = selectElement(screen.getByLabelText('Sezona'))
    const another = must(at(within(season).getAllByRole('option'), 1).getAttribute('value'), 'value')

    /* All of them is the default (owner, 31.07.2026), so the bare address is
       the one that means it. Read from the router: a memory router never
       touches window.location, so an assertion against it passes no matter
       what the screen does. */
    expect(season.value).toBe('sve')
    expect(router.state.location.search).toBe('')

    await user.selectOptions(season, another)
    expect(router.state.location.search).toBe(`?sezona=${another}`)

    // And choosing all of them again takes it back out.
    await user.selectOptions(season, 'sve')
    expect(router.state.location.search).toBe('')
  })

  it('names the board a place was taken on, in both kinds', async () => {
    /* 000005 has taken a place in the general standing as well as in a
       category. Over the whole career: the trophies are narrowed by the season
       now (owner, 31.07.2026), and the season now has none in it. */
    renderAt('/sr/takmicar/000005/priznanja?sezona=sve')

    const table = await screen.findByRole('table', { name: 'Pehari' })
    const boards = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => at(within(row).getAllByRole('cell'), 1).textContent)

    expect(boards.some((one) => one === 'Generalni plasman')).toBe(true)
    expect(boards.some((one) => one?.startsWith('Kategorija'))).toBe(true)
  })
})

describe('an empty table says which of the four kinds of nothing it is', () => {
  it('names the length where the season is all of them', async () => {
    /* Never raced at all is a different fact from raced but not this season, and
       that from raced but never at this length. A reader told the wrong one goes
       looking for a fault in the portal. */
    renderAt('/sr/takmicar/000031?sezona=sve&duzina=ultra')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('Na ovom profilu još nema nijednog rezultata.')).toBeVisible()
  })

  it('names the length for somebody who has raced, but never that far', async () => {
    // 000002 has raced a hundred and thirteen times and never an ultra.
    renderAt('/sr/takmicar/000002?sezona=sve&duzina=ultra')

    expect(
      await screen.findByText('Nema nijednog rezultata izabrane dužine.'),
    ).toBeVisible()
  })

  it('names both where both are chosen', async () => {
    renderAt('/sr/takmicar/000002?sezona=2010&duzina=ultra')

    expect(
      await screen.findByText('Za izabranu sezonu i dužinu nema nijednog rezultata.'),
    ).toBeVisible()
  })
})

describe('a member whose fee has run out', () => {
  it('is on no list of this season, and nowhere carries a link', async () => {
    /* PDL P11: "u tabeli tekuće godine se ne pojavljuje uopšte", "link ka
       profilu postoji samo dok je članarina aktivna". 000032 is the first such
       member in the data, and being the newest number they went straight to the
       top of "Najnoviji članovi" on the front page, linking to a profile this
       change had just made unreachable. That widget has since gone (owner,
       31.07.2026) and the rule has not: the boards and the turning chart draw
       the same field, so the front page is still where this is proved. */
    renderAt('/sr')

    expect(await screen.findByRole('heading', { name: 'Top 10 muškarci' })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Vojislav Antonijević/ })).not.toBeInTheDocument()
  })

  it('is not among the competitors either', async () => {
    renderAt('/sr/takmicari')

    await screen.findByRole('heading', { level: 1, name: 'Takmičari' })
    expect(screen.queryByText('Vojislav Antonijević')).not.toBeInTheDocument()
  })
})

describe('the season, over both parts of the profile', () => {
  it('narrows the trophies too, and says which kind of empty it is', async () => {
    /* One control at the top of the page governs the results and the trophies
       alike (owner, 31.07.2026). 000001 has trophies, but not in every season,
       so a season without one has to say that rather than that there are none
       at all. */
    renderAt('/sr/takmicar/000001/priznanja?sezona=2010')

    expect(
      await screen.findByText('U izabranoj sezoni nije osvojen nijedan pehar.'),
    ).toBeVisible()
    expect(screen.queryByText('Ovaj takmičar još nema nijedan pehar.')).not.toBeInTheDocument()
  })

  it('opens on all of them, which is what a profile is', async () => {
    /* Owner, 31.07.2026. A profile is somebody's whole running life, and the
       question it answers first is what they have done rather than what they
       have done since January; opening on the running season leaves it empty
       for the first weeks of every year. It opened on the running season for
       part of one day, and on the newest season they had raced before that. */
    renderAt('/sr/takmicar/000001', 'visitor', null, undefined, '2022-06-01')

    await screen.findByRole('heading', { level: 1 })

    expect(selectElement(screen.getByLabelText('Sezona')).value).toBe('sve')
  })

  it('will not take a year that only looks like one', async () => {
    /* Four digits, not merely digits: `02010` is not 2010, and letting it
       through puts the control on a value none of its own options carry, so the
       table shows one year and the control shows another. */
    renderAt('/sr/takmicar/000001?sezona=02010', 'visitor', null, undefined, '2022-06-01')

    await screen.findByRole('heading', { level: 1 })

    expect(selectElement(screen.getByLabelText('Sezona')).value).toBe('sve')
  })

  /* The choice travels between the two parts of one profile, because it lives
     in the address and every link in the control carries the query. */
  it('keeps the season chosen while moving between the two parts', async () => {
    const user = setupUser()
    renderAt('/sr/takmicar/000001?sezona=2019')

    await screen.findByRole('heading', { level: 1 })
    expect(selectElement(screen.getByLabelText('Sezona')).value).toBe('2019')

    await user.click(screen.getByRole('link', { name: 'Priznanja i nagrade' }))

    expect(selectElement(await screen.findByLabelText('Sezona'))).toHaveValue('2019')
  })
})

describe('a ducat that belongs to one month rather than to all of them', () => {
  it('says which month, beside the coin that carries it', async () => {
    /* A profile holding July and August must not read as one ducat written down
       twice, so the month stands beside the coin as words of the page.
     *
     * Two files are stood in for, because nothing in the generated data can
     * reach this on its own: the season of 2027 has not begun, and every result
     * there is was run before it. One race in July 2027 and one family that
     * repeats by the month are the smallest world in which a monthly ducat can
     * be held at all. */
    const real = globalThis.fetch
    const race = {
      id: 'r-jul',
      memberNumber: '000001',
      raceId: 't-jul',
      eventName: 'Julska trka',
      eventSlug: 'julska-trka',
      date: '2027-07-04',
      distanceKm: 21.1,
      ascentM: 200,
      descentM: 200,
      seconds: 7200,
      points: 30,
      category: 'half',
    }
    const family = {
      id: 'duk-mesecni-km',
      name: 'Mesečni kilometri',
      kind: 'totalKm',
      value: 20,
      period: 'month',
      top: 'ISTRČANIH',
      topFemale: '',
      bottom: '',
      periodAt: 'bottom',
      mark: 'distance',
      art: 'none',
      tier: 1,
      step: 0,
      last: 0,
      tierUpFrom: 0,
    }

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const asked = String(input)

      if (asked.endsWith('/results.json')) {
        return new Response(JSON.stringify([race]), { status: 200 })
      }

      return asked.endsWith('/ducats.json')
        ? new Response(JSON.stringify([family]), { status: 200 })
        : real(input)
    })

    try {
      /* A season that is not the ducat's, on purpose: a trophy belongs to the
         season it was won in and the filter narrows those, but a ducat is
         permanent and the filter must not touch it (PDL P11). */
      renderAt('/sr/takmicar/000001/priznanja?sezona=2010', 'visitor', null, undefined, '2027-08-01')

      expect(await screen.findByText('jul 2027.')).toBeVisible()

      /* The coin is an image with a name since the hint went (11.08.2026), and
         on a profile that name is the only thing telling one instance of a
         family from another: two months of the same ducat carry the same two
         words under them.

         It carries what the coin is worth as well, since the line that used to
         say so under the coin was taken off the page the same day: on screen
         the metal is the only thing left telling a bronze from a gold, and
         colour is never the only thing that says anything. */
      expect(
        screen.getByRole('img', {
          name: 'Mesečni kilometri, 20 km. Vrednost 1 od 5, bronzani dukat.',
        }),
      ).toBeVisible()

      /* And it is not written under the coin as well: the wall is coins, not
         coins and a grey sentence under each (owner, 11.08.2026). */
      expect(screen.queryByText('Vrednost 1 od 5, bronzani dukat.')).toBeNull()
    } finally {
      globalThis.fetch = real
    }
  })
})

describe('what the portal calls the person whose page it is', () => {
  /* A portal that calls every woman on it a takmičar is one written for half
     its members (owner, 11.08.2026). Said where the sentence is about the
     person: the empty biography and the empty list of results. */

  it('says takmičarka on a woman page, and takmičar on a man page', async () => {
    const competitors = await loadResource<Competitor[]>('competitors')
    const silent = (gender: string) =>
      must(
        competitors.find((one) => one.gender === gender && one.active && one.bio === ''),
        `an active ${gender} with no biography`,
      )
    renderAt(`/sr/takmicar/${silent('F').memberNumber}`)
    expect(await screen.findByText('Ova takmičarka još nije napisala ništa o sebi.')).toBeVisible()

    cleanup()

    renderAt(`/sr/takmicar/${silent('M').memberNumber}`)
    expect(await screen.findByText('Ovaj takmičar još nije napisao ništa o sebi.')).toBeVisible()
  })

  it('asks no gender at all for a profile that is not there', async () => {
    /* There is no record to read one off, so the sentence is written not to
       need one rather than guessed at. */
    renderAt('/sr/takmicar/999999')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ovog profila nema.' })).toBeVisible()
  })
})

describe('a wall of ducats that grows as it is read', () => {
  /* Five rows before the first refill (owner, 11.08.2026), and a row is however
     many stand across at this width. jsdom lays nothing out, so it counts one
     across and a row is one ducat: five before the button, which is the
     arrangement a telephone comes closest to.

     Stood up rather than found: the most decorated member of the generated data
     holds three ducats, so nothing in it is long enough to be cut. What is
     under test is the cutting. */
  function servingMany(howMany: number) {
    const real = globalThis.fetch
    const many = Array.from({ length: howMany }, (_, at) => ({
      id: `duk-proba-${String(at)}`,
      name: `Proba ${String(at + 1)}`,
      kind: 'raceCount',
      value: at + 1,
      period: 'always',
      top: 'ISTRČANIH',
      topFemale: '',
      bottom: 'TRKA',
      periodAt: 'none',
      mark: 'races',
      art: 'none',
      tier: 1,
      step: 0,
      last: 0,
      tierUpFrom: 0,
      counted: '',
    }))

    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/ducats.json')
        ? new Response(JSON.stringify(many), { status: 200 })
        : real(input))

    return () => {
      globalThis.fetch = real
    }
  }

  it('shows five of them and grows, rather than the whole wall at once', async () => {
    const stop = servingMany(12)
    const user = setupUser()

    /* 000021 has run more races than anybody else in the data, so every one of
       the twelve thresholds above is behind them. */
    renderAt('/sr/takmicar/000021/priznanja')

    const wall = await screen.findByRole('list', { name: '' })
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Učitaj još dukata' })).toHaveLength(1)
    })

    const count = () => within(wall).getAllByRole('listitem').length
    expect(count()).toBe(5)

    await user.click(screen.getByRole('button', { name: 'Učitaj još dukata' }))
    expect(count()).toBe(10)

    await user.click(screen.getByRole('button', { name: 'Učitaj još dukata' }))
    expect(count()).toBe(12)
    expect(screen.getByText('To je sve, 12 dukata')).toBeVisible()

    stop()
  })
})
