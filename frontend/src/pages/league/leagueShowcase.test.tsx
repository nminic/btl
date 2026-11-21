import { screen, waitFor, within } from '@testing-library/react'
import { onTestFinished } from 'vitest'
import type { League } from '../../data/types'
import { at, must } from '../../test/at'
import { renderAt } from '../../test/render'
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

    /* ONE SHEET, AND IT IS THE CHOSEN ONE'S. A superadmin is read, because to him every competition
       draws both boxes whether or not anything is written in them: what is counted is how many
       competitions are written out, and the second one has nothing written. */
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

      expect(within(card).getByRole('link', { name: /^Tabela lige / })).toHaveAttribute('href', `/sr/liga/${slug}`)
    }

    expect(within(sheet()).getByRole('link', { name: 'Tabela lige RunTrace liga 2027' })).toHaveAttribute(
      'href',
      '/sr/liga/runtrace-2027',
    )
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

describe('the terms and the prizes of the chosen competition', () => {
  it('can be changed by somebody with the right and only read by a visitor', { timeout: SLOW }, async () => {
    const first = renderAt('/sr/lige?sezona=2027', 'superadmin', null, undefined, IN_THE_SEASON)

    await showcase()
    expect(within(sheet()).getAllByRole('button', { name: 'Izmeni' })).toHaveLength(2)
    first.unmount()

    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)
    await showcase()
    expect(within(sheet()).getByRole('heading', { name: 'Propozicije' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Izmeni' })).toBeNull()
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

  it('writes the events of the sheet one to a line, the name as a link, the day in brackets and the lengths after a dash', { timeout: SLOW }, async () => {
    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    await showcase()

    const line = must(
      (await within(sheet()).findByRole('link', { name: 'Beogradski maraton' })).closest('li'),
      'the line of the event',
    )

    expect(line.textContent).toMatch(/^Beogradski maraton \(3\. 4\. 2027\.\)( - \d+(,\d+)? (km|h)(, \d+(,\d+)? (km|h))*)?$/)
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
