import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import { first, htmlElement, must } from '../test/at'
import { moderatorWith, renderAt } from '../test/render'
import { setupUser } from '../test/user'

describe('Calendar', () => {
  it('opens on a month that has something in it', async () => {
    renderAt('/sr/kalendar')

    expect(await screen.findByRole('heading', { level: 1, name: 'Kalendar' })).toBeVisible()
    // The month heading only appears once the events are in, so waiting for it
    // is what separates "still loading" from "loaded and empty".
    await screen.findByRole('heading', { level: 2 })
    expect(screen.getAllByRole('link').some((link) => link.className === 'chip')).toBe(true)
  })

  it('opens on the month named in the address', async () => {
    renderAt('/sr/kalendar?mesec=2027-05')

    expect(await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })).toBeVisible()
  })

  it('names its two steps, which are drawn as arrows and nothing else', async () => {
    /* A symbol is a drawing, and a drawing is not a label. Somebody reading the
       screen with their ears gets the same two words a sighted reader used to
       get in the buttons themselves. */
    renderAt('/sr/kalendar?mesec=2027-05')

    expect(await screen.findByRole('button', { name: 'Prethodni mesec' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sledeći mesec' })).toBeVisible()
  })

  it('walks to the previous and the next month', async () => {
    const user = setupUser()
    renderAt('/sr/kalendar?mesec=2027-05')

    await user.click(await screen.findByRole('button', { name: 'Sledeći mesec' }))
    expect(screen.getByRole('heading', { level: 2, name: 'jun 2027.' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Prethodni mesec' }))
    expect(screen.getByRole('heading', { level: 2, name: 'maj 2027.' })).toBeVisible()

    // December to January has to roll the year over, not the month number.
    await user.click(screen.getByRole('button', { name: 'Prethodni mesec' }))
    expect(screen.getByRole('heading', { level: 2, name: 'april 2027.' })).toBeVisible()
  })

  it('says nothing at all about a month that holds nothing', async () => {
    /* Owner, 04.08.2026: "Ne treba da šetam mesec gore dole zbog tog
       disclaimera." A sentence over the grid moved every day of it down a line
       on every quiet month, which is most of them outside the season, and the
       grid with nothing in it already says what the sentence said. */
    renderAt('/sr/kalendar?mesec=2029-01')

    // The month is drawn, whole, and nothing stands above it.
    expect(await screen.findByRole('heading', { level: 2, name: 'januar 2029.' })).toBeVisible()
    expect(screen.getByText('31')).toBeVisible()
    expect(screen.queryByText('U ovom mesecu nema nijednog događaja.')).not.toBeInTheDocument()
  })

  it('marks the weekends in gold, and today with the ring alone', async () => {
    /* Owner, 04.08.2026, and it is his own proposal: the day number goes gold on
       a Saturday and a Sunday, today keeps the ring it had, and a weekend that is
       also today wears both. Each mark is spoken as well as drawn, because a
       colour cannot be the only way to know which day it is (WCAG 2.2 SC 1.4.1)
       and below tablet width the days stack with no headings over them.

       May 2027 begins on a Saturday, so the 1st and the 2nd are the weekend and
       the 3rd is not. Read on a day inside that month, so today is one of them
       and the two marks can be told apart. */
    renderAt('/sr/kalendar?mesec=2027-05', 'visitor', null, undefined, '2027-05-03')

    const weekend = await screen.findAllByText(', Vikend')
    const numbers = weekend.map((one) => one.parentElement?.textContent)

    // Ten of them in a month of thirty-one days that begins on a Saturday.
    expect(weekend).toHaveLength(10)
    expect(numbers.slice(0, 2)).toEqual(['1, Vikend', '2, Vikend'])

    /* Today is the 3rd, a Monday: it says so, and it says nothing about a
       weekend. The ring is drawn from a class, and what colour that is belongs
       to the sweep of the stylesheets. */
    expect(screen.getByText(', Danas').parentElement?.textContent).toBe('3, Danas')
    expect(numbers).not.toContain('3, Vikend')
  })

  it('draws only the days of the month, never a square of nothing', async () => {
    /* May 2027 has 31 days and begins on a Saturday (owner, 31.07.2026: no dead
       cells). Padded to whole weeks it would carry five empty squares before the
       month and six after it, and those read as days with nothing on rather than
       as days of another month. The first day is placed in its own column
       instead. */
    const { container } = renderAt('/sr/kalendar?mesec=2027-05')

    await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })

    const days = container.querySelectorAll('.day')
    expect(days).toHaveLength(31)
    /* The column is handed to CSS as a value, never written on the element:
       written on it, the day was placed in column six on a telephone too, where
       there is no seven column grid, and the implicit grid grew to hold it. */
    const opening = htmlElement(first(days))
    expect(opening.style.gridColumnStart).toBe('')
    expect(opening.style.getPropertyValue('--day-start')).toBe('6')
    expect(opening).toHaveClass('day--first')
    expect(container.querySelectorAll('.day--first')).toHaveLength(1)
  })

  it('lets every day of a row take the row height', () => {
    /* jsdom lays nothing out, so the rule is read off disk the way the tokens
       and the scale are. `align-items: start` on the grid is the opposite of
       what the owner asked for: it gives each box only its own height, so one
       Saturday with two races stands tall beside six short weekdays. Stretch is
       the default and is what a row means. */
    const css = readFileSync(join(process.cwd(), 'src/pages/Calendar.css'), 'utf-8')
    const grid = css.slice(css.indexOf('.calendar__grid {'), css.indexOf('}', css.indexOf('.calendar__grid {')))

    expect(grid).toContain('display: grid')
    expect(grid).not.toMatch(/align-items:\s*(start|flex-start|baseline)/)
  })

  it('rings today, and only today', async () => {
    const { container } = renderAt(
      '/sr/kalendar?mesec=2026-08',
      'visitor',
      null,
      undefined,
      '2026-08-13',
    )

    await screen.findByRole('heading', { level: 2 })

    expect(container.querySelectorAll('.day--today')).toHaveLength(1)
    /* The ring is gold, and a colour cannot be the only way to know which day it
       is, so the word travels with it. */
    expect(screen.getByText(', Danas')).toBeInTheDocument()
  })

  it('goes back to the running month from wherever it has been walked to', async () => {
    const user = setupUser()
    renderAt('/sr/kalendar?mesec=2019-06', 'visitor', null, undefined, '2026-08-13')

    await screen.findByRole('heading', { level: 2, name: 'jun 2019.' })
    await user.click(screen.getByRole('button', { name: 'Danas' }))

    expect(screen.getByRole('heading', { level: 2, name: 'avgust 2026.' })).toBeVisible()
    /* Nothing to go back to once it is here, and the control says so rather
       than disappearing and moving the two arrows under the pointer. */
    expect(screen.getByRole('button', { name: 'Danas' })).toBeDisabled()
  })

  it('sends a day with more on it than fits to a page of its own', async () => {
    const user = setupUser()
    /* 3 April 2027 holds six events, one more than a day shows. The generated
       data puts them there on purpose: such a day used to appear by accident,
       out of multi-day events written as one row per day, and those are one
       event since 10.08.2026. */
    renderAt('/sr/kalendar?mesec=2027-04')

    await screen.findByRole('heading', { level: 2, name: 'april 2027.' })
    await user.click(screen.getByRole('link', { name: /Još 1/ }))

    /* A page and not a panel: a day is a thing somebody sends to somebody else,
       and the panel used to draw itself under the whole grid, which on a
       telephone is under everything. */
    expect(
      await screen.findByRole('heading', { level: 1, name: /3\. april 2027\./ }),
    ).toBeVisible()
    expect(within(screen.getByRole('list', { name: '' })).getAllByRole('listitem')).toHaveLength(6)
  })

  it.each([
    ['nije-datum', 'not a date at all'],
    ['2019-13-45', 'the right shape and not a date'],
    ['2019-02-31', 'a day February does not have'],
    ['9999-99-99', 'nothing at either end'],
  ])('says it does not know the day named by %s, rather than falling over', async (date) => {
    /* The shape used to be the whole test, so a date of the right shape that is
       not a date reached the formatter, which threw, and the error boundary
       replaced the whole screen. 2019-02-31 is the quieter one: the parser rolls
       it forward to 3 March, so the page would have been headed with a day
       nobody asked for. */
    renderAt(`/sr/kalendar/dan/${date}`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Kalendar' })).toBeVisible()
    expect(screen.getByText('Tog dana nema nijednog događaja.')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('names the lengths a day holds, in colour and in words', async () => {
    const { container } = renderAt('/sr/kalendar?mesec=2019-06')

    await screen.findByRole('heading', { level: 2, name: 'jun 2019.' })

    /* A colour on its own says nothing to anybody who cannot separate two of
       them, so every dot is drawn aria-hidden beside a name a screen reader
       reads. The legend under the grid says what the colours mean. */
    const dots = container.querySelectorAll('.chip .length-dot')
    expect(dots.length).toBeGreaterThan(0)
    expect([...dots].every((dot) => dot.getAttribute('aria-hidden') === 'true')).toBe(true)
    /* Nine since 30.08.2026: the three kinds of event stand over the five lengths,
       because the colour of the whole tile says which kind it is and the dots on it
       say which lengths it holds (owner, 24.08.2026: „Za Skup i Trening koristi
       druge boje i objasni ih u legendi"), and a sixth dot joined them for a race
       that fixes no length at all, which is the one thing a length cannot say.

       Written out rather than counted off the two lists this reads from, since a
       count taken from them would be satisfied by either list falling to nothing. */
    const legend = within(screen.getByRole('list', { name: 'Legenda:' }))

    expect(legend.getAllByRole('listitem')).toHaveLength(9)
    expect(legend.getByText('Bez zadate dužine')).toBeVisible()
    expect(legend.getAllByRole('listitem').map((one) => one.textContent).slice(0, 3)).toEqual([
      'Trka',
      'Trening',
      'Skup',
    ])
  })

  it('says which kind a tile is, in words as well as in colour', async () => {
    /* Owner, 23.08.2026: „Za Skup i Trening koristi druge boje i objasni ih u
       legendi", and clearly different from a race rather than a near shade of it.
       A gathering and a training carry no lengths, so without this they read as a
       race whose distances nobody has entered yet.

       The colour is measured in a browser and cannot be measured here (ADL A18).
       What is asked here is the half jsdom can hold, and it is the half that makes
       the colour lawful: the word travels with it. Without the word the tile rests
       on colour alone, which SC 1.4.1 forbids, and a reader who cannot separate a
       violet from a blue has nothing at all. */
    const { container } = renderAt('/sr/kalendar?mesec=2027-03')

    await screen.findByRole('heading', { level: 2, name: 'mart 2027.' })

    const gathering = container.querySelector('.chip--gathering')

    expect(gathering, 'no tile of a gathering to look at').not.toBeNull()
    expect(gathering?.textContent, 'the tile does not say it is a gathering').toContain('Skup')

    /* And a race says nothing of the sort, which is the other half: the calendar
       is made of races, and a word on every one of them would be read out on every
       tile of every day. */
    const race = container.querySelector('.chip:not(.chip--gathering):not(.chip--training)')

    expect(race?.textContent, 'a race tile names its kind').not.toContain('Trka')
  })

  it('leads from a chip to the event', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/kalendar?mesec=2027-05')

    await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })
    const chips = screen.getAllByRole('link').filter((link) => link.className === 'chip')

    expect(chips.length).toBeGreaterThan(0)
    const chip = first(chips)
    const where = chip.getAttribute('href') ?? ''

    await user.click(chip)

    /* The event, by the address the chip carried and by its own name in the
       heading. It used to be checked by the way back to the calendar, which came
       off on 06.08.2026; checking instead that some level one heading had
       appeared held nothing at all, because the calendar has one of those too
       and the check passed with the click deleted. */
    expect(where).toMatch(/\/sr\/kalendar\/[a-z0-9-]+$/)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(where)
    })
    /* A prefix, because the chip says the name and then the length of the race
       under it, and the heading of the event is the name alone. */
    const said = chip.textContent ?? ''

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: (name: string) => name.length > 0 && said.startsWith(name),
      }),
    ).toBeVisible()
  })
})

/* The month, the two steps, then Danas, level with the heading (owner,
 * 05.08.2026). The order is the whole of the request: it read the other way
 * round until then, on its own line under the heading.
 */
describe('the shortcut that starts an event on a day', () => {
  /* Owner, 12.08.2026: „u gornjem desnom uglu svakog kalendarskog dana treba da
     ti bude vidljivo malo dugme + ... prečica da baš tog dana dodaš novi
     događaj." Three things are held: who sees it, where it leads, and that
     whoever does not see it sees nothing at all in its place. */
  it('is not there at all for a visitor', async () => {
    renderAt('/sr/kalendar?mesec=2027-05')
    await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })

    expect(screen.queryAllByRole('link', { name: /^Nov događaj/ })).toHaveLength(0)
  })

  it('is not there for a competitor either', async () => {
    renderAt('/sr/kalendar?mesec=2027-05', 'competitor', '000001')
    await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })

    expect(screen.queryAllByRole('link', { name: /^Nov događaj/ })).toHaveLength(0)
  })

  it('stands on every day for the superadmin, and carries that day into the form', async () => {
    renderAt('/sr/kalendar?mesec=2027-05', 'superadmin')
    await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })

    /* One per day of May, each carrying its own day and named by it.

       Every one of the thirty one, not the first of them: asked only about the
       first, this passed with all thirty one pointing at the first of the month,
       which is the whole shortcut gone. And the names counted rather than merely
       matched on how they open, because thirty one controls called „Nov događaj"
       are thirty one identical names in a reader's list of controls (WCAG 2.2
       SC 2.4.6), and a prefix match is happy with that. */
    const ways = screen.getAllByRole('link', { name: /^Nov događaj/ })

    expect(ways).toHaveLength(31)

    const days = ways.map((_, index) => String(index + 1).padStart(2, '0'))

    expect(ways.map((one) => one.getAttribute('href'))).toEqual(
      days.map((day) => `/sr/administracija/dogadjaji?nov=2027-05-${day}`),
    )

    const names = ways.map((one) => one.getAttribute('aria-label') ?? '')

    expect(new Set(names).size).toBe(31)
    /* And each says the day it stands on, so the list of controls reads as a
       calendar rather than as one name repeated. */
    for (const [index, name] of names.entries()) {
      expect(name).toContain(`${index + 1}. 5. 2027.`)
    }
  })

  it('is there for a moderator who may open the events screen', async () => {
    /* The same right that screen asks of, so the two can never disagree
       (PDL P10, 12.08.2026). */
    renderAt('/sr/kalendar?mesec=2027-05', 'moderator', null, moderatorWith(['entity:events']))
    await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })

    expect(screen.getAllByRole('link', { name: /^Nov događaj/ })).toHaveLength(31)
  })

  it('is not there for a moderator who may not', async () => {
    /* The role is not the question: a moderator with rights over teams and none
       over events is shown nothing here. */
    renderAt('/sr/kalendar?mesec=2027-05', 'moderator', null, moderatorWith(['entity:teams']))
    await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })

    expect(screen.queryAllByRole('link', { name: /^Nov događaj/ })).toHaveLength(0)
  })
})

describe('the row the month is chosen in', () => {
  it('reads month, back, forward, today, in that order', async () => {
    renderAt('/sr/kalendar')

    await screen.findByRole('heading', { level: 1 })

    const bar = must(
      screen.getByRole('button', { name: 'Danas' }).closest('div'),
      'the row around the controls',
    )

    /* Read off the row itself rather than off the page, so a control moved out
       of it fails here rather than passing because it still exists somewhere. */
    expect([...bar.children].map((one) => one.textContent ?? one.getAttribute('aria-label'))).toEqual(
      [expect.stringMatching(/\d{4}\./), '', '', 'Danas'],
    )
    expect(
      [...bar.children].map((one) => one.getAttribute('aria-label') ?? one.tagName),
    ).toEqual(['H2', 'Prethodni mesec', 'Sledeći mesec', 'BUTTON'])

    /* And the row is the shared one beside the heading, not a row of its own. */
    expect(bar.className).toContain('rankings__head-tool')
  })
})
