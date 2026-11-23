import { configure, screen, within } from '@testing-library/react'
import leagues from '../../test/mock/leagues.json'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'

/* Every wait of this file is given half of the time a case has (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE THREE PLACES A LEAGUE'S MARK IS SEEN, AND ONLY ITS OWN MARK IN EACH (owner, PDL 23.11.2026, „Pravi
 * logo lige”: „gde se vidi: kartica lige na strani „Lige”, glava lista izabrane lige i strana pojedinačne
 * lige”; „bez loga ostaje krug sa inicijalima”).
 *
 * The served file gives RunTrace (the first card) a mark and Planinska (the second) none, so a card drawn
 * with the chosen league's mark rather than its own, or a page drawn with the first league's, carries a
 * picture where the initials belong.
 */
const IN_THE_SEASON = '2027-03-01'

const RUNTRACE = must(leagues.find((one) => one.slug === 'runtrace-2027'), 'RunTrace in the served file')

const markIn = (place: HTMLElement): HTMLElement => must(place.querySelector('.leagues__mark'), 'a mark')

describe('the mark of a league', () => {
  it('stands on each card of the page of the leagues, its own on each', async () => {
    renderAt('/sr/lige?sezona=2027', 'visitor', null, undefined, IN_THE_SEASON)

    const list = await screen.findByRole('list', { name: 'Lige u sezoni 2027' })
    const [runtrace, planinska] = within(list).getAllByRole('listitem')

    expect(markIn(must(runtrace, 'the first card')).querySelector('img')).toHaveAttribute('src', RUNTRACE.smallLogo)
    expect(markIn(must(planinska, 'the second card')).querySelector('img')).toBeNull()
    expect(markIn(must(planinska, 'the second card')).textContent).toBe('P')
  }, SLOW)

  it.each([
    ['the second, which has none', 'planinska-2027', null, 'P'],
    ['the first, which has one', 'runtrace-2027', RUNTRACE.smallLogo, ''],
  ])('stands in the head of the sheet of the league chosen, %s', async (_, slug, picture, letters) => {
    renderAt(`/sr/lige?sezona=2027&liga=${slug}`, 'visitor', null, undefined, IN_THE_SEASON)

    const head = markIn(await screen.findByRole('article'))

    expect(head.querySelector('img')?.getAttribute('src') ?? null).toBe(picture)
    expect(head.textContent).toBe(letters)
  }, SLOW)

  it.each([
    ['with a mark', 'runtrace-2027', 'RunTrace liga 2027', RUNTRACE.smallLogo, ''],
    ['with none', 'planinska-2027', 'Planinska liga 2027', null, 'P'],
  ])('stands in the heading of the page of a league %s, and the heading is still read as the name', async (
    _,
    slug,
    name,
    picture,
    letters,
  ) => {
    renderAt(`/sr/liga/${slug}`, 'visitor', null, undefined, IN_THE_SEASON)

    const heading = await screen.findByRole('heading', { level: 1, name })
    const mark = markIn(heading)

    expect(mark).toHaveAttribute('aria-hidden', 'true')
    expect(mark.querySelector('img')?.getAttribute('src') ?? null).toBe(picture)
    expect(mark.textContent).toBe(letters)
  }, SLOW)
})
