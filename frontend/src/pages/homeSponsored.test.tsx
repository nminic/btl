import { configure, screen, within } from '@testing-library/react'
import type { FrontPageSponsors, SponsorShown } from '../data/types'
import { renderAt } from '../test/render'
import { serverThat, type Asked } from '../test/serverAnswers'
import { SLOW } from '../test/slow'

/**
 * THE FRONT PAGE WITH A SPONSOR, AND WITHOUT ONE, ON THE SERVER'S ANSWER (PDL P24, variant A, owner
 * 18.11.2026; PDL 24.11.2026, „Strana za upravljanje sponzorima").
 *
 * The served file answers nobody (`test/mock/sponsors.json`), which is the portal as it stands until the
 * administration enters somebody, so each case here answers `GET /api/sponsors` itself.
 *
 * Whether there is a sponsor of the day is answered once on the page (`Home.tsx`), and three things read
 * it: the box, how many races the calendar shows, and the shape of the grid (`home__split--sponsored`,
 * which `Home.css` lays out, `home/homeLayoutStyle.test.ts`). The strip is its own list on the same
 * answer, because the owner gave the box and the strip a switch each („Zelim prekidace i za rotaciju u
 * boksu i za donju liniju"), so the cases set the two apart in both directions.
 *
 * **The sponsor of the day is never the first of the strip here**, so a page that drew the box out of
 * the strip, which is what it did while there was no server (`[ofTheDay] = SPONSORS`), cannot pass.
 */

configure({ asyncUtilTimeout: SLOW / 2 })

const VOLT: SponsorShown = {
  id: 7,
  name: 'VOLT',
  url: 'https://volt.primer.rs/',
  logo: '/api/photos/5e1f0a9c',
  description: 'Energetsko piće za duge treninge i noćne trke.',
  language: 'sr',
}
const SOFRA: SponsorShown = {
  id: 3,
  name: 'Sofra',
  url: 'https://sofra.primer.rs/',
  logo: '/api/photos/b07d42e1',
  description: 'Domaća kuhinja posle svake trke.',
  language: 'sr',
}

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

/** A server that answers the sponsors of the front page with `answer`, in whichever language they are asked. */
function sponsorsAre(answer: FrontPageSponsors | Response): Asked[] {
  const { asked, stop } = serverThat((path) =>
    /^\/api\/sponsors\?lang=[a-z]+$/.test(path)
      ? answer instanceof Response
        ? answer
        : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })
      : null,
  )

  stops.push(stop)

  return asked
}

/**
 * The day the page is read as, one day and not the suite's: how many races lie ahead in the sample turns
 * on the day, and on the other day the suite is read as (`test/theDay.ts`, 22.11.2027) only three do, so
 * neither four nor nine could be drawn and the count would say nothing about the sponsor. On 01.11.2026
 * forty-five races of different names lie ahead, more than either number, so the list is cut by the rule
 * and never by running out.
 */
const A_DAY_WITH_RACES_AHEAD = '2026-11-01'

async function drawn(at = '/sr') {
  renderAt(at, 'visitor', null, undefined, A_DAY_WITH_RACES_AHEAD)

  const heading = at === '/sr' ? 'Priprema, pozor, SAD!' : 'Ready, steady, GO!'

  await screen.findByRole('heading', { level: 2, name: heading })

  /* The address of the president is a written page of its own (`President.tsx`, `/api/pages`), and it
     lands after the grid; the order of the headings is asked of the Serbian page only. */
  if (at === '/sr') {
    await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })
  }

  const calendar = screen.getByRole('region', { name: heading })

  return {
    headings: screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent),
    races: within(calendar).getAllByRole('listitem').length,
    grid: calendar.closest('.home__split'),
  }
}

function theStrip(): HTMLElement {
  return screen.getByRole('region', { name: 'Sponzori i partneri' })
}

describe('the front page of variant A', () => {
  it('with a sponsor of the day: the box between the address and the calculator, four races, the strip under both columns', async () => {
    sponsorsAre({ ofTheDay: SOFRA, strip: [VOLT, SOFRA] })

    const { headings, races, grid } = await drawn()

    /* „Na telefonu „Sponzor dana” stoji posle obraćanja predsednika, a pre kalkulatora." The markup is the
       order it is seen in (ADL A7, owner 21.11.2026: „Kod prati ekran"), and this is the one column. */
    expect(headings).toEqual([
      'Top 10 muškarci',
      'Top 10 žene',
      expect.stringMatching(/^(Sezona \d{4}\.|Zagrevanje)$/),
      'Priprema, pozor, SAD!',
      'Reč predsednika',
      'Sponzor dana',
      'BTL kalkulator',
    ])

    /* The one of the day, which is the server's and the SECOND of the strip. */
    const box = screen.getByRole('region', { name: 'Sponzor dana' })
    expect(within(box).getByRole('link', { name: 'Sofra (otvara se u novom prozoru)' })).toHaveAttribute(
      'href',
      'https://sofra.primer.rs/',
    )
    expect(within(box).getByText(SOFRA.description)).toBeVisible()
    expect(within(box).queryByText(VOLT.description)).toBeNull()

    /* And the strip in the order it was answered in, which is neither the order of the keys (3, 7) nor
       the order of the names. */
    expect(within(theStrip()).getAllByRole('img').map((one) => [one.getAttribute('alt'), one.getAttribute('src')])).toEqual([
      ['VOLT', '/api/photos/5e1f0a9c'],
      ['Sofra', '/api/photos/b07d42e1'],
    ])

    /* Under both columns and not in either: after the grid, and outside it. */
    expect(grid).not.toBeNull()
    expect(grid?.contains(theStrip())).toBe(false)
    expect(grid?.compareDocumentPosition(theStrip())).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    expect(races).toBe(4)
    expect(grid).toHaveClass('home__split--sponsored')
  }, SLOW)

  /* EXACTLY ONE SPONSOR IS A SPONSOR: the first stanza the portal will meet when the first one signs, and
     the state in which „more than one" and „at least one" part ways. */
  it('with exactly one sponsor: the box, the strip with the one, four races, and the grid of variant A', async () => {
    sponsorsAre({ ofTheDay: VOLT, strip: [VOLT] })

    const { headings, races, grid } = await drawn()

    expect(headings).toContain('Sponzor dana')
    expect(
      within(screen.getByRole('region', { name: 'Sponzor dana' })).getByRole('link', {
        name: 'VOLT (otvara se u novom prozoru)',
      }),
    ).toBeVisible()
    expect(within(theStrip()).getAllByRole('img').map((one) => one.getAttribute('alt'))).toEqual(['VOLT'])
    expect(races).toBe(4)
    expect(grid).toHaveClass('home__split--sponsored')
  }, SLOW)

  it('without one, as the served file answers: neither box nor strip, the calendar to the bottom, the grid without the box', async () => {
    const { headings, races, grid } = await drawn()

    expect(headings).not.toContain('Sponzor dana')
    expect(screen.queryByRole('region', { name: 'Sponzori i partneri' })).not.toBeInTheDocument()

    /* jsdom lays nothing out, so this is the number that stands for the desktop's (`rowsThatFit.ts`). */
    expect(races).toBe(9)
    expect(grid).toHaveClass('home__split')
    expect(grid).not.toHaveClass('home__split--sponsored')
  }, SLOW)

  /* THE TWO SWITCHES, EACH WITHOUT THE OTHER. Nobody in the rotation and somebody in the strip is the page
     without the box, whose strip still stands; somebody in the rotation and nobody in the strip is the box
     with no strip under it. A page that decided the strip by the box, as it did until 24.11.2026, fails
     both. */
  it('with a strip and nobody of the day: no box, the calendar to the bottom, and the strip', async () => {
    sponsorsAre({ ofTheDay: null, strip: [VOLT] })

    const { headings, races, grid } = await drawn()

    expect(headings).not.toContain('Sponzor dana')
    expect(races).toBe(9)
    expect(grid).not.toHaveClass('home__split--sponsored')
    expect(within(theStrip()).getAllByRole('img').map((one) => one.getAttribute('alt'))).toEqual(['VOLT'])
  }, SLOW)

  it('with somebody of the day and nobody in the strip: the box, four races, and no strip', async () => {
    sponsorsAre({ ofTheDay: VOLT, strip: [] })

    const { headings, races, grid } = await drawn()

    expect(headings).toContain('Sponzor dana')
    expect(races).toBe(4)
    expect(grid).toHaveClass('home__split--sponsored')
    expect(screen.queryByRole('region', { name: 'Sponzori i partneri' })).not.toBeInTheDocument()
  }, SLOW)

  /* A FAILED READ OF THE SPONSORS IS THE PAGE WITHOUT THEM, and never the page's failure: the boards, the
     figures, the calendar and the calculator are all drawn, nothing says „cannot be read", and the layout is
     the one of a league with no sponsor (`Home.tsx`, `sponsorsOrNobody`). */
  it('when the sponsors cannot be read: every other box of the page, and the layout of a league with none', async () => {
    sponsorsAre(new Response(null, { status: 500 }))

    const { headings, races, grid } = await drawn()

    expect(headings).toEqual([
      'Top 10 muškarci',
      'Top 10 žene',
      expect.stringMatching(/^(Sezona \d{4}\.|Zagrevanje)$/),
      'Priprema, pozor, SAD!',
      'Reč predsednika',
      'BTL kalkulator',
    ])
    expect(races).toBe(9)
    expect(grid).not.toHaveClass('home__split--sponsored')
    expect(screen.queryByRole('region', { name: 'Sponzori i partneri' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pokušaj ponovo' })).toBeNull()
  }, SLOW)
})

/**
 * THE LANGUAGE OF THE DESCRIPTION: asked for in the language of the address, and drawn under the
 * language the server says it is really written in („ako engleska nije upisana, engleska naslovna
 * pokazuje srpsku", PDL 24.11.2026). Both states on `/en`, so that neither the locale of the page nor a
 * fixed Serbian can stand in for the field the answer carries.
 */
describe('the description of the sponsor of the day', () => {
  it('on /sr is asked for in Serbian and marked as Serbian', async () => {
    const asked = sponsorsAre({ ofTheDay: VOLT, strip: [] })

    await drawn('/sr')

    expect(asked.map((one) => one.path).filter((path) => path.startsWith('/api/sponsors'))).toEqual(['/api/sponsors?lang=sr'])
    expect(within(screen.getByRole('region', { name: 'Sponzor dana' })).getByText(VOLT.description)).toHaveAttribute(
      'lang',
      'sr',
    )
  }, SLOW)

  it('on /en, with no English written, is asked for in English and drawn in Serbian, marked as Serbian', async () => {
    const asked = sponsorsAre({ ofTheDay: VOLT, strip: [] })

    await drawn('/en')

    expect(asked.map((one) => one.path).filter((path) => path.startsWith('/api/sponsors'))).toEqual(['/api/sponsors?lang=en'])
    expect(within(screen.getByRole('region', { name: 'Sponsor of the day' })).getByText(VOLT.description)).toHaveAttribute(
      'lang',
      'sr',
    )
  }, SLOW)

  it('on /en, with English written, is drawn in English and marked as English', async () => {
    sponsorsAre({
      ofTheDay: { ...VOLT, description: 'An energy drink for long sessions and night races.', language: 'en' },
      strip: [],
    })

    await drawn('/en')

    expect(
      within(screen.getByRole('region', { name: 'Sponsor of the day' })).getByText(
        'An energy drink for long sessions and night races.',
      ),
    ).toHaveAttribute('lang', 'en')
  }, SLOW)
})
