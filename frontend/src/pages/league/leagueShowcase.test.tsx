import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, onTestFinished } from 'vitest'
import type { League } from '../../data/types'
import { at, must } from '../../test/at'
import { matchingMedia } from '../../test/media'
import { moderatorWith, renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { initialsOf } from './LeagueMark'

/**
 * THE LIST OF COMPETITIONS AS A SHOWCASE OF CARDS AND THE SHEET OF THE ONE CHOSEN (owner, 21.11.2026,
 * PDL „Strana „Lige” se radi po predlogu B”): „Propozicije, nagrade i događaji se ispisuju samo za
 * izabranu ligu; kad se strana otvori, izabrana je prva kartica, a izbor se pamti u adresi”.
 *
 * The served file has two competitions in 2027 (RunTrace first, Planinska second) and one in 2019, so
 * „the first" and „the one the address names" are two different answers, and a season with one
 * competition is there to be read as well.
 *
 * The day is handed in, so which dot is the next one is not a question of when the suite runs.
 */
const IN_THE_SEASON = '2027-03-01'

const showcase = async (): Promise<HTMLElement> =>
  screen.findByRole('list', { name: 'Lige u sezoni 2027' })

const sheet = (): HTMLElement => must(screen.getByRole('article'), 'the sheet of the chosen competition')

const chosenLink = (list: HTMLElement): HTMLElement[] =>
  within(list)
    .getAllByRole('link')
    .filter((one) => one.getAttribute('aria-current') === 'true')

describe('the showcase of competitions', () => {
  it('opens on the first card, and only its sheet is written out', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027', 'superadmin', null, undefined, IN_THE_SEASON)

    const list = await showcase()

    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(chosenLink(list).map((one) => one.textContent)).toEqual(['RunTrace liga 2027'])

    /* ONE SHEET, AND IT IS THE CHOSEN ONE'S. Read as the superadmin, who is drawn everything this
       screen draws for anybody: what is counted is how many competitions are written out. */
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(within(sheet()).getByRole('heading', { level: 2 })).toHaveTextContent('RunTrace liga 2027')
    expect(screen.getAllByRole('heading', { name: 'Propozicije' })).toHaveLength(1)
    expect(screen.getAllByRole('heading', { name: 'Nagrade' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /^Događaji i trke, / })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Događaji i trke, RunTrace liga 2027' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Događaji i trke, Planinska liga 2027' })).toBeNull()
  })

  it('opens on the one the address names', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027&liga=planinska-2027', 'superadmin', null, undefined, IN_THE_SEASON)

    const list = await showcase()

    expect(chosenLink(list).map((one) => one.textContent)).toEqual(['Planinska liga 2027'])
    expect(within(sheet()).getByRole('heading', { level: 2 })).toHaveTextContent('Planinska liga 2027')
    expect(screen.getByRole('button', { name: 'Događaji i trke, Planinska liga 2027' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Događaji i trke, RunTrace liga 2027' })).toBeNull()
  })

  it.each([
    ['a slug of nothing', 'nepostoji'],
    ['a slug of another season', 'brdska-2019'],
  ])('falls to the first card on %s', { timeout: SLOW }, async (_, slug) => {
    renderAt(`/sr/lige?sezona=2027&liga=${slug}`, 'visitor', null, undefined, IN_THE_SEASON)

    const list = await showcase()

    expect(chosenLink(list).map((one) => one.textContent)).toEqual(['RunTrace liga 2027'])
    expect(within(sheet()).getByRole('heading', { level: 2 })).toHaveTextContent('RunTrace liga 2027')
  })

  it('writes the choice into the address, keeps the season beside it, and puts the reader on the sheet', { timeout: SLOW }, async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    const list = await showcase()

    await user.click(within(list).getByRole('link', { name: 'Planinska liga 2027' }))

    await waitFor(() =>
      expect(within(sheet()).getByRole('heading', { level: 2 })).toHaveTextContent('Planinska liga 2027'),
    )

    const asked = new URLSearchParams(router.state.location.search)

    expect(asked.get('liga')).toBe('planinska-2027')
    expect(asked.get('sezona')).toBe('2027')
    expect(router.state.location.pathname).toBe('/sr/lige')
    expect(within(sheet()).getByRole('heading', { level: 2 })).toHaveFocus()
    expect(chosenLink(list).map((one) => one.textContent)).toEqual(['Planinska liga 2027'])

    /* And back: the browser's own button walks the choice, which is what living in the address is for. */
    await router.navigate(-1)

    await waitFor(() =>
      expect(within(sheet()).getByRole('heading', { level: 2 })).toHaveTextContent('RunTrace liga 2027'),
    )
  })

  it('puts the reader on the sheet when the chosen card is pressed again, and changes nothing else', { timeout: SLOW }, async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/lige?sezona=2027&liga=runtrace-2027', 'visitor', null, undefined, IN_THE_SEASON)

    const list = await showcase()

    await user.click(within(list).getByRole('link', { name: 'RunTrace liga 2027' }))

    await waitFor(() => expect(within(sheet()).getByRole('heading', { level: 2 })).toHaveFocus())
    expect(new URLSearchParams(router.state.location.search).get('liga')).toBe('runtrace-2027')
  })

  it('gives each card and the sheet the way to the table of its competition', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    const list = await showcase()

    for (const [index, slug] of [
      [0, 'runtrace-2027'],
      [1, 'planinska-2027'],
    ] as const) {
      const card = at(within(list).getAllByRole('listitem'), index)

      const way = within(card).getByRole('link', { name: /^Tabela / })

      expect(way).toHaveAttribute('href', `/sr/liga/${slug}`)
      /* „dugme se zove samo „Tabela”, bez strelice, svuda” (owner, 21.11.2026): the words and the
         hidden name of the competition, and nothing drawn after them. */
      expect(way.textContent).toMatch(/^Tabela \S/)
      expect(way.textContent).not.toContain('→')
    }

    const onTheSheet = within(sheet()).getByRole('link', { name: 'Tabela RunTrace liga 2027' })

    expect(onTheSheet).toHaveAttribute('href', '/sr/liga/runtrace-2027')
    expect(onTheSheet.textContent).toBe('Tabela RunTrace liga 2027')
  })

  it('says on each card the season, how many events count and how many people are in it', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    const list = await showcase()
    const first = at(within(list).getAllByRole('listitem'), 0)

    await waitFor(() => expect(first).toHaveTextContent(/2027 · 8 događaja · \d+ učesni(k|ka)/))
    await waitFor(() => expect(at(within(list).getAllByRole('listitem'), 1)).toHaveTextContent('2027 · 0 događaja · 0 učesnika'))

    /* And the sheet carries the same three in its pills. */
    await waitFor(() => expect(sheet()).toHaveTextContent('Sezona 2027.'))
    expect(sheet()).toHaveTextContent('8 događaja')
  })
})

describe('a season with one competition', () => {
  it('draws no showcase, only the sheet', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2019', 'visitor', null, undefined, IN_THE_SEASON)

    expect(await screen.findByRole('heading', { level: 2, name: 'Brdska liga 2019' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /^Lige u sezoni/ })).toBeNull()
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })
})

describe('a season with no competition at all', () => {
  it('says so, as it always did', { timeout: SLOW }, async () => {
    const server = serverThat((path) =>
      path === '/api/leagues'
        ? new Response(JSON.stringify([] satisfies League[]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : null,
    )

    onTestFinished(server.stop)
    renderAt('/sr/lige', 'visitor', null, undefined, IN_THE_SEASON)

    expect(await screen.findByText('Trenutno nema nijednog dodatnog takmičenja.')).toBeInTheDocument()
    expect(screen.queryByRole('article')).toBeNull()
  })
})

describe('the head of the sheet', () => {
  /* WHO SEES THE PENCIL IS WHO THE ADMINISTRATION OF COMPETITIONS OPENS FOR (owner, 21.11.2026, PDL
     „Glava lista lige: na desktopu sve u jednom redu”): „Ikonica (samo za onog ko ima pravo) vodi na
     izmenu te lige u administraciji”. Each row parts the right that opens that door from one that does
     not: a moderator with the events and not the competitions is staff with a right, so neither „any
     right" nor „any staff" draws the pencil for him; one with the competitions alone is not the
     superadmin, so „only the superadmin" does not draw it for him either. */
  it.each([
    ['the superadmin', 'superadmin', undefined, true],
    ['a moderator with the competitions', 'moderator', moderatorWith(['entity:leagues']), true],
    ['a moderator with the events and not the competitions', 'moderator', moderatorWith(['entity:events', 'queue:profiles']), false],
    ['a moderator with no right at all', 'moderator', moderatorWith([]), false],
    ['a member', 'competitor', undefined, false],
    ['a visitor', 'visitor', undefined, false],
  ] as const)('draws the pencil for %s only if the form opens for him', { timeout: SLOW }, async (_, role, moderator, drawn) => {
    renderAt('/sr/lige?sezona=2027', role, role === 'competitor' ? '000001' : null, moderator, IN_THE_SEASON)

    await showcase()

    expect(within(sheet()).queryAllByRole('link', { name: 'Izmeni ligu: RunTrace liga 2027' })).toHaveLength(drawn ? 1 : 0)
  })

  it('leads the pencil to the form of the competition that is open, and not of the first card', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027&liga=planinska-2027', 'superadmin', null, undefined, IN_THE_SEASON)

    await showcase()

    /* The second card's competition, whose identity is 2 against the first card's 1. */
    expect(within(sheet()).getByRole('link', { name: 'Izmeni ligu: Planinska liga 2027' })).toHaveAttribute(
      'href',
      '/sr/administracija/lige?izmena=2',
    )
  })

  it('offers nothing to change the terms or the prizes on the sheet itself', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027', 'superadmin', null, undefined, IN_THE_SEASON)

    await showcase()
    expect(within(sheet()).getByRole('heading', { name: 'Propozicije' })).toBeInTheDocument()
    expect(within(sheet()).queryByRole('button', { name: 'Izmeni' })).toBeNull()
    expect(within(sheet()).queryByRole('textbox')).toBeNull()
  })
})

describe('the chosen card', () => {
  it('is told by its frame and by aria-current, and says nothing the card does not say when it is not chosen', { timeout: SLOW }, async () => {
    const user = setupUser()

    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    const list = await showcase()
    const card = (): HTMLElement => at(within(list).getAllByRole('listitem'), 0)

    await waitFor(() => expect(card()).toHaveTextContent(/2027 · 8 događaja · \d+ učesni(k|ka)/))

    const chosen = card().textContent

    await user.click(within(list).getByRole('link', { name: 'Planinska liga 2027' }))
    await waitFor(() => expect(chosenLink(list).map((one) => one.textContent)).toEqual(['Planinska liga 2027']), {
      timeout: SLOW / 4,
    })

    expect(card().textContent).toBe(chosen)
  })
})

/** The tiles of the events of the sheet, in the order they are drawn, and the dots of the line. */
const tiles = (): HTMLElement[] => {
  const list = must(
    must(within(sheet()).getByRole('link', { name: 'Beogradski maraton' }).closest('li'), 'a tile').parentElement,
    'the list of the tiles',
  )

  return within(list)
    .getAllByRole('listitem')
    .filter((one) => one.parentElement === list)
}

const dots = (): HTMLElement[] =>
  within(sheet())
    .getAllByRole('link', { hidden: true })
    .filter((one) => one.getAttribute('tabindex') === '-1')

const litTiles = (): number[] => tiles().flatMap((one, index) => (one.classList.contains('leagues__event-tile--lit') ? [index] : []))

const litDots = (): number[] => dots().flatMap((one, index) => (one.classList.contains('leagues__dot--lit') ? [index] : []))

/** What a tile says in its two rows, read by role and by text. */
const said = (tile: HTMLElement) => ({
  state: within(tile).getByText(/^(Održan|Sledeći|Predstoji)$/).textContent,
  day: within(tile).getByText(/^\d{1,2}\. \d{1,2}\. \d{4}\.$/).textContent,
  name: within(tile).getByRole('link').textContent,
  lengths: within(tile).queryByRole('list') === null ? [] : within(within(tile).getByRole('list')).getAllByRole('listitem').map((one) => one.textContent),
})

describe('the tiles of the events', () => {
  it('writes a tile to an event: its state and its day, then its name as a link and the lengths of the races that count', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    await showcase()
    await within(sheet()).findByRole('link', { name: 'Beogradski maraton' })

    const read = tiles().map(said)

    expect(read).toHaveLength(8)
    expect(read.map((one) => one.state)).toEqual(['Održan', 'Održan', 'Sledeći', 'Predstoji', 'Predstoji', 'Predstoji', 'Predstoji', 'Predstoji'])
    expect(at(read, 2)).toMatchObject({ name: 'Beogradski maraton', day: '3. 4. 2027.' })
    expect(within(at(tiles(), 2)).getByRole('link')).toHaveAttribute('href', '/sr/kalendar/beogradski-maraton-2027')

    for (const one of read) {
      expect(one.lengths.length, one.name ?? '').toBeGreaterThan(0)
      for (const length of one.lengths) {
        expect(length).toMatch(/^\d+(,\d+)? (km|h)$/)
      }
    }
  })

  /* THE DAY OF READING IS THE DAY OF AN EVENT: the one place the tile and the dot could part, if
     either asked „has it passed" its own way. */
  it('says „Sledeći” of an event read on its own day, on its tile and on its dot alike', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, '2027-04-03')

    await showcase()
    await within(sheet()).findByRole('link', { name: 'Beogradski maraton' })

    expect(tiles().map((one) => said(one).state)).toEqual(['Održan', 'Održan', 'Sledeći', 'Predstoji', 'Predstoji', 'Predstoji', 'Predstoji', 'Predstoji'])
    expect(dots().map((one) => one.className.includes('leagues__dot--next'))).toEqual([false, false, true, false, false, false, false, false])
  })
})

describe('a dot and the tile of its event', () => {
  async function opened(): Promise<void> {
    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    await showcase()
    await within(sheet()).findByRole('link', { name: 'Beogradski maraton' })
    expect(dots()).toHaveLength(8)
  }

  /* Never the first: a light tied to the first tile, or to one tile whatever the dot, is satisfied
     there. */
  it('light together while a pointer is over the dot, the very tile of that event and no other', { timeout: SLOW }, async () => {
    await opened()

    fireEvent.pointerOver(at(dots(), 4), { pointerType: 'mouse' })
    expect(litTiles()).toEqual([4])
    expect(litDots()).toEqual([4])

    fireEvent.pointerOut(at(dots(), 4), { pointerType: 'mouse', relatedTarget: document.body })
    expect(litTiles()).toEqual([])
    expect(litDots()).toEqual([])
  })

  it('light together while a pointer is over the tile, the very dot of that event and no other', { timeout: SLOW }, async () => {
    await opened()

    fireEvent.pointerOver(at(tiles(), 5), { pointerType: 'mouse' })
    expect(litDots()).toEqual([5])
    expect(litTiles()).toEqual([5])

    fireEvent.pointerOut(at(tiles(), 5), { pointerType: 'mouse', relatedTarget: document.body })
    expect(litDots()).toEqual([])
  })

  it('light together while the focus is on the name in the tile, which is how the keyboard reaches them, or on the dot', { timeout: SLOW }, async () => {
    await opened()

    const name = within(at(tiles(), 6)).getByRole('link')

    act(() => name.focus())
    expect(litDots()).toEqual([6])
    expect(litTiles()).toEqual([6])

    act(() => name.blur())
    expect(litDots()).toEqual([])

    act(() => at(dots(), 3).focus())
    expect(litTiles()).toEqual([3])

    act(() => at(dots(), 3).blur())
    expect(litTiles()).toEqual([])
  })

  it('stay as they are when a finger only passes over them, since a finger has no hovering', { timeout: SLOW }, async () => {
    await opened()

    fireEvent.pointerOver(at(dots(), 4), { pointerType: 'touch' })
    fireEvent.pointerOver(at(tiles(), 5), { pointerType: 'touch' })
    expect(litTiles()).toEqual([])

    fireEvent.pointerOver(at(tiles(), 5), { pointerType: 'mouse' })
    fireEvent.pointerOut(at(dots(), 4), { pointerType: 'touch', relatedTarget: document.body })
    fireEvent.pointerOut(at(tiles(), 5), { pointerType: 'touch', relatedTarget: document.body })
    expect(litTiles(), 'a finger leaving does not put out what a pointer lit').toEqual([5])
  })
})

describe('a touch on a dot', () => {
  const brought: { tile: Element; how: unknown }[] = []
  const had = Element.prototype.scrollIntoView

  beforeEach(() => {
    brought.length = 0
    Element.prototype.scrollIntoView = function (this: Element, how?: boolean | ScrollIntoViewOptions) {
      brought.push({ tile: this, how })
    }
  })

  afterEach(() => {
    Element.prototype.scrollIntoView = had
  })

  it('lights the tile of its event and brings that tile into view, and does not leave the list', { timeout: SLOW }, async () => {
    const { router } = renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    await showcase()
    await within(sheet()).findByRole('link', { name: 'Beogradski maraton' })

    fireEvent.pointerDown(at(dots(), 5), { pointerType: 'touch' })
    fireEvent.click(at(dots(), 5))

    expect(litTiles()).toEqual([5])
    expect(brought).toEqual([{ tile: at(tiles(), 5), how: { block: 'nearest', behavior: 'smooth' } }])
    expect(router.state.location.pathname).toBe('/sr/lige')

    /* Another dot moves the light; a touch anywhere else puts it out, and a press of the mouse
       elsewhere does not, since a mouse that hovers lets go on its own. */
    fireEvent.pointerDown(at(dots(), 1), { pointerType: 'touch' })
    expect(litTiles()).toEqual([1])

    fireEvent.pointerDown(document.body, { pointerType: 'mouse' })
    expect(litTiles()).toEqual([1])

    fireEvent.pointerDown(document.body, { pointerType: 'touch' })
    expect(litTiles()).toEqual([])

    fireEvent.pointerDown(at(dots(), 2), { pointerType: 'touch' })
    fireEvent.pointerDown(document, { pointerType: 'touch' })
    expect(litTiles()).toEqual([])
  })

  it('brings the tile into view without motion for a reader who asked for less of it', { timeout: SLOW }, async () => {
    const before = window.matchMedia

    window.matchMedia = matchingMedia((query) => query === '(prefers-reduced-motion: reduce)')
    onTestFinished(() => {
      window.matchMedia = before
    })

    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    await showcase()
    await within(sheet()).findByRole('link', { name: 'Beogradski maraton' })

    fireEvent.pointerDown(at(dots(), 6), { pointerType: 'touch' })

    expect(brought).toEqual([{ tile: at(tiles(), 6), how: { block: 'nearest', behavior: 'auto' } }])
  })
})

describe('a press of the mouse on a dot', () => {
  it('leads to its event, as it always did', { timeout: SLOW }, async () => {
    const { router } = renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    await showcase()
    await within(sheet()).findByRole('link', { name: 'Beogradski maraton' })

    fireEvent.pointerDown(at(dots(), 2), { pointerType: 'mouse' })
    fireEvent.click(at(dots(), 2))

    /* On a clock shorter than the case's, so a press that does not lead fails on this line and not on
       the clock of the case (`btl/CLAUDE.md`, section 25). */
    await waitFor(() => expect(router.state.location.pathname).toBe('/sr/kalendar/beogradski-maraton-2027'), {
      timeout: SLOW / 4,
    })
  })
})

describe('the line through the year', () => {
  it('names how many events there are and the next one, and leads each dot to its event', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    await showcase()
    expect(await within(sheet()).findByText('8 događaja kroz godinu, sledeći 3. 4. 2027.')).toBeInTheDocument()

    /* The dots are links out of the order of the keyboard: the names in the list under them are the
       same addresses, and the ones a keyboard reaches. */
    const dots = within(sheet())
      .getAllByRole('link', { hidden: true })
      .filter((one) => one.getAttribute('tabindex') === '-1')

    expect(dots).toHaveLength(8)
    expect(dots.map((one) => one.getAttribute('title'))).toContain('Beogradski maraton (3. 4. 2027.)')

    const next = dots.filter((one) => one.className.includes('leagues__dot--next'))

    expect(next.map((one) => one.getAttribute('href'))).toEqual(['/sr/kalendar/beogradski-maraton-2027'])
    expect(dots.filter((one) => one.className.includes('leagues__dot--held'))).toHaveLength(2)
    expect(
      within(sheet()).getByRole('link', { name: 'Beogradski maraton' }).getAttribute('href'),
      'the dot and the name in the list lead to the same event',
    ).toBe(at(next, 0).getAttribute('href'))
  })

  it('says every event is held once the last one is behind', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, '2028-02-01')

    await showcase()
    expect(await within(sheet()).findByText('8 događaja kroz godinu, svi su održani')).toBeInTheDocument()
  })
})

describe('the sign of a competition', () => {
  it.each([
    ['RunTrace liga 2027', 'RT'],
    ['Trail liga Srbije', 'TS'],
    ['Planinska liga 2027', 'P'],
    ['Liga ultra staza Dinarida i Prokletija', 'US'],
    ['Vojvođanska liga ravnice „Đeram”', 'VR'],
    ['2027', ''],
  ])('is the initials of %s', (name, initials) => {
    expect(initialsOf(name)).toBe(initials)
  })
})
