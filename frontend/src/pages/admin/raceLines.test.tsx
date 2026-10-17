import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { dogadjaj } from '../../forms/definitions'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/**
 * THE FORM OF AN EVENT AND THE RACES UNDER IT, AS LINES OF FIELDS (owner, 16.10.2026, PDL „Ispravke
 * sa ekrana 16.10.2026").
 *
 * <p>Two sentences of the owner's, each taken apart into what it says, and each part asked of the
 * three ways the same form is opened: a new event, a change of one that stands, and a copy of one
 * (`AdminEvents.tsx` draws all three with the one `EntityEditor` and the one `EventRaces`; a copy
 * with the narrower form `copyOfEvent`, which has no town and no kind).
 *
 * <p>- „Naziv, Vrsta; Datum, istaknuto; Mesto, država; Dalje idu Opis, pa link, pa dodavanje trka
 * kao što je trenutno slučaj".
 *
 * <p>- „U prvom redu mora da se vidi Trka, Datum, Vrsta, a onda u drugom redu: Ako je obeleženo
 * Dužinska ili Slobodna, onda Dužina, Uspon, Spust", and for a timed race, chosen between the
 * outcomes he was offered, only „Trajanje (h)".
 *
 * <p><b>What is asked is where a control stands and which line it is on</b>, found by its label and
 * its name as a reader finds it. `.form__row` and `.race__row` are named only to say „the same
 * line": jsdom lays nothing out (ADL A18), so a line is the element the markup puts its fields in,
 * and the widths and the thirds are asked of a browser (`entityStyle.test.ts` holds what the sheet
 * says; the pull request holds what a browser measured).
 *
 * <p><b>Each mutation of the list in the pull request is one of these cases failing:</b> a timed
 * race that draws a length, a race of a length that draws a duration, a free race that loses its
 * climb, a date written before the name, a change of kind that leaves the second line where it was,
 * and a second line that reads the kind of the FIRST race instead of its own. The last is what the
 * two-races case below is for: with every race of one kind the two sources of the kind give the same
 * line and a case about it asks nothing.
 */

const THE_LIST = '/sr/administracija/dogadjaji'

type Way = 'new' | 'change' | 'copy'

const WAYS: Way[] = ['new', 'change', 'copy']

/** Event 32 of the fixtures: a race, with two races of a length of its own. */
const AN_EVENT = '32'

const follows = (earlier: Node, later: Node) =>
  (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

/** The form opened the way asked for, with at least `races` races on it. */
async function open(way: Way, races = 2) {
  const user = setupUser()

  if (way === 'new') {
    renderAt(THE_LIST, 'superadmin')
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'race')

    for (let made = 0; made < races; made += 1) {
      await user.click(screen.getByRole('button', { name: 'Nova trka' }))
    }
  } else {
    renderAt(`${THE_LIST}?${way === 'copy' ? 'kopija' : 'izmena'}=${AN_EVENT}`, 'superadmin')
    await screen.findByRole('heading', { name: /^Trke na događaju/ })
  }

  expect(
    screen.getAllByRole('group', { name: /^\d+\. trka$/ }).length,
    'the races asked for are not on the screen',
  ).toBeGreaterThanOrEqual(races)

  return user
}

const raceNumber = (n: number) => within(screen.getByRole('group', { name: `${n}. trka` }))

/** The names of the boxes of one race, in the order they stand on the screen. */
const boxesOf = (n: number): string[] =>
  [
    ...raceNumber(n).queryAllByRole('textbox'),
    ...raceNumber(n).queryAllByRole('combobox'),
  ]
    .sort((left, right) => (follows(left, right) ? -1 : 1))
    .map((one) => (one.getAttribute('aria-label') ?? '').replace(/, \d+\. trka$/, ''))

/** The lines of one race and what stands on each, by the first word of the box's name. */
function linesOf(n: number): string[][] {
  const lines = new Map<Element, string[]>()

  for (const box of [
    ...raceNumber(n).queryAllByRole('textbox'),
    ...raceNumber(n).queryAllByRole('combobox'),
  ].sort((left, right) => (follows(left, right) ? -1 : 1))) {
    const line = must(box.closest('.race__row'), 'the line a box of a race stands on')

    lines.set(line, [
      ...(lines.get(line) ?? []),
      (box.getAttribute('aria-label') ?? '').replace(/, \d+\. trka$/, ''),
    ])
  }

  return [...lines.values()]
}

describe('the fields of an event, line by line', () => {
  it('is written in the owner\'s order and on his lines, in the definition', () => {
    /* The definition is the one home of the order (`forms/types.ts`, `row`): a field of another
       line, or one written before its neighbour, is what the screen below would draw. */
    expect(dogadjaj.fields.map((one) => [one.name, one.row])).toEqual([
      ['name', 1],
      ['kind', 1],
      ['date', 2],
      ['featured', 2],
      ['city', 3],
      ['description', undefined],
      ['link', undefined],
    ])
    /* In thirds, the way the registration is (owner, 12.08.2026: „Podeli je racionalno na trećine
       horizontalno"), so a line of two leaves a third empty and does not become two halves. */
    expect(dogadjaj.columns, 'the form of an event is not in thirds').toBe(3)
  })

  /**
   * „U formi događaja Naziv zauzima dve trećine reda, a Vrsta jednu." (owner, 17.10.2026, PDL
   * „Odgovori vlasnika 17.10.2026 na pitanja posle izvođenja"), taken apart into what it says:
   * the name is TWO of the three columns of its line, the kind is one, and nothing else on the
   * form is widened.
   *
   * <p>Asked of the definition (the one home of a width, `FieldDef.span`) AND of the field the
   * screen draws: the definition says two, and the stylesheet only gives two columns to a field
   * that wears the class the renderer puts on it, so each of the two halves is asked and the join
   * between them is the class (`entityStyle.test.ts` and `forms/formStyle.test.ts` hold the sheet).
   */
  it.each(['new', 'change'] as const)(
    'gives the name two of the three columns of its line and the kind one, when opened as: %s',
    async (way) => {
      expect(
        dogadjaj.fields.filter((one) => one.span !== undefined).map((one) => [one.name, one.span]),
        'the only widened field of the form is the name',
      ).toEqual([['name', 2]])

      await open(way)

      const wrapperOf = (label: RegExp) =>
        must(screen.getByLabelText(label).closest('.field'), 'the field a control stands in')

      expect(wrapperOf(/^Naziv događaja/)).toHaveClass('field--wide')
      expect(wrapperOf(/^Vrsta događaja/)).not.toHaveClass('field--wide')
      for (const rest of [/^Datum/, /^Istaknuto/, /^Mesto/]) {
        expect(wrapperOf(rest), `${String(rest)} was widened`).not.toHaveClass('field--wide')
      }
      /* The line has three columns, and the name and the kind fill them: the third that stood empty
         beside them is gone. */
      expect(
        must(
          screen.getByLabelText(/^Naziv događaja/).closest('.form__row'),
          'the line of the name',
        ).getAttribute('style'),
      ).toContain('--columns: 3')
    },
    SLOW,
  )

  it.each([
    ['new', [['Naziv događaja', 'Vrsta događaja'], ['Datum', 'Istaknuto'], ['Mesto', 'Država']]],
    ['change', [['Naziv događaja', 'Vrsta događaja'], ['Datum', 'Istaknuto'], ['Mesto', 'Država']]],
    /* A copy has its town, its country and its kind out of the event it came from and is not asked
       for them (owner, 23.08.2026, `copyOfEvent`), so what is left of the three lines is what it
       is asked, in the same order. */
    ['copy', [['Naziv događaja'], ['Datum', 'Istaknuto']]],
  ] as const)(
    'stands on these lines when it is opened as: %s',
    async (way, expected) => {
      await open(way)

      const form = screen.getByRole('form', { name: /./ })
      const lines = [...form.querySelectorAll<HTMLElement>(':scope .form__row')]

      expect(lines.length, 'the event form is not drawn in lines').toBe(expected.length)

      for (const [at, names] of expected.entries()) {
        const line = within(must(lines[at], `line ${String(at + 1)}`))
        const found = names.map((name) => line.getByLabelText(new RegExp(`^${name}`)))

        /* All of them on this line, and in the order the owner wrote them. */
        for (let each = 1; each < found.length; each += 1) {
          expect(
            follows(must(found[each - 1], 'the one before'), must(found[each], 'the next')),
            `${names[each - 1]} does not stand before ${names[each]}`,
          ).toBe(true)
        }
      }

      /* And what follows them is the description, then the link, then the races, each on a line of
         its own and not in a row. */
      const description = screen.getByLabelText(/^Opis događaja/)
      const link = screen.getByLabelText(/^Link ka strani organizatora/)

      expect(description.closest('.form__row'), 'the description is on a row').toBeNull()
      expect(link.closest('.form__row'), 'the link is on a row').toBeNull()
      expect(follows(must(lines.at(-1), 'the last line'), description)).toBe(true)
      expect(follows(description, link)).toBe(true)
      expect(
        follows(link, screen.getByRole('heading', { name: /^Trke na događaju/ })),
        'the races are not under the link',
      ).toBe(true)
    },
    SLOW,
  )
})

describe('a race, in two lines', () => {
  it.each(WAYS)(
    'has Trka, Datum and Vrsta on the first line and the measures of a length on the second, when opened as: %s',
    async (way) => {
      await open(way)

      for (const n of [1, 2]) {
        expect(linesOf(n), `race ${String(n)}`).toEqual([
          ['Trka', 'Datum', 'Vrsta'],
          ['Dužina (km)', 'Uspon (m)', 'Spust (m)'],
        ])
      }
    },
    SLOW,
  )

  it('stands in the order the owner wrote, which the date does not lead', async () => {
    await open('change')

    expect(boxesOf(1)).toEqual(['Trka', 'Datum', 'Vrsta', 'Dužina (km)', 'Uspon (m)', 'Spust (m)'])
  }, SLOW)

  it.each(WAYS)(
    'draws only how long it lasts on the second line of a timed race, when opened as: %s',
    async (way) => {
      const user = await open(way)

      await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 1. trka' }), 'time')

      expect(linesOf(1)).toEqual([['Trka', 'Datum', 'Vrsta'], ['Trajanje (h)']])
      /* The three it is not asked for are not drawn at all, and not merely not asked: a cell that
         is not on the screen cannot be the reason a press is refused. */
      for (const gone of [/^Dužina/, /^Uspon/, /^Spust/]) {
        expect(raceNumber(1).queryByLabelText(gone), `a timed race draws ${String(gone)}`).toBeNull()
      }
    },
    SLOW,
  )

  /**
   * A FREE RACE HAS NO SECOND LINE (owner, 17.10.2026: „Zapravo za slobodnu onda ne treba ukucavati
   * ni jedno od tih polja, mozes izbaciti sve sto bi se dicalo duzine, uspona, spusta, sati,
   * minuta, ili sekundi."), taken apart into what he named: no length, no climb, no fall, no hours,
   * and not an empty line in their place.
   */
  it.each(WAYS)(
    'draws nothing at all on a second line of a free race, and not an empty line, when opened as: %s',
    async (way) => {
      const user = await open(way)

      await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 1. trka' }), 'free')

      expect(linesOf(1)).toEqual([['Trka', 'Datum', 'Vrsta']])
      expect(boxesOf(1), 'a free race draws more than its name, day and kind').toEqual(['Trka', 'Datum', 'Vrsta'])
      for (const gone of [/^Dužina/, /^Uspon/, /^Spust/, /^Trajanje/]) {
        expect(raceNumber(1).queryByLabelText(gone), `a free race draws ${String(gone)}`).toBeNull()
      }
      expect(
        raceNumber(1).getByLabelText(/^Trka/).closest('fieldset')?.querySelectorAll('.race__row').length,
        'a free race keeps a second line with nothing on it',
      ).toBe(1)
    },
    SLOW,
  )

  it('gives the second line back when a free race is turned into a race of a length', async () => {
    const user = await open('change')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 1. trka' }), 'free')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 1. trka' }), 'length')

    expect(linesOf(1)[1]).toEqual(['Dužina (km)', 'Uspon (m)', 'Spust (m)'])
  }, SLOW)

  it('draws no duration on a race of a length', async () => {
    await open('change')

    expect(raceNumber(1).queryByLabelText(/^Trajanje/)).toBeNull()
  }, SLOW)

  it('changes its own second line when its kind changes, and the other race keeps its own', async () => {
    const user = await open('change')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 2. trka' }), 'time')

    expect(linesOf(2)[1]).toEqual(['Trajanje (h)'])
    expect(linesOf(1)[1], 'the first race followed the kind of the second').toEqual([
      'Dužina (km)',
      'Uspon (m)',
      'Spust (m)',
    ])

    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 2. trka' }), 'length')

    expect(linesOf(2)[1], 'the second line did not come back with its kind').toEqual([
      'Dužina (km)',
      'Uspon (m)',
      'Spust (m)',
    ])
  }, SLOW)

  it('reads the kind of ITS OWN race when an event has two of different kinds', async () => {
    /* The two sources of a kind: the race the line is drawn for, and the first race of the event.
       With every race of one kind they give the same line and nothing is asked, so the two races
       here are of two kinds, and each is asked in both orders. */
    const user = await open('change')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 1. trka' }), 'time')

    expect(linesOf(1)[1]).toEqual(['Trajanje (h)'])
    expect(linesOf(2)[1], 'the second race drew the second line of the first').toEqual([
      'Dužina (km)',
      'Uspon (m)',
      'Spust (m)',
    ])

    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 1. trka' }), 'length')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 2. trka' }), 'time')

    expect(linesOf(1)[1], 'the first race drew the second line of the second').toEqual([
      'Dužina (km)',
      'Uspon (m)',
      'Spust (m)',
    ])
    expect(linesOf(2)[1]).toEqual(['Trajanje (h)'])
  }, SLOW)

  it('reads the kind of ITS OWN race when an event has a race of a length and a free one', async () => {
    /* The same two sources as above, asked with the kind that draws nothing. A second line that read
       the first race's kind would draw a free first race's nothing under the race of a length, and
       the length's three under the free one, in the two orders. */
    const user = await open('change')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 1. trka' }), 'free')

    expect(linesOf(1)).toEqual([['Trka', 'Datum', 'Vrsta']])
    expect(linesOf(2)[1], 'the second race drew the (empty) second line of the first').toEqual([
      'Dužina (km)',
      'Uspon (m)',
      'Spust (m)',
    ])

    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 1. trka' }), 'length')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 2. trka' }), 'free')

    expect(linesOf(1)[1], 'the first race drew the second line of the second').toEqual([
      'Dužina (km)',
      'Uspon (m)',
      'Spust (m)',
    ])
    expect(linesOf(2)).toEqual([['Trka', 'Datum', 'Vrsta']])
  }, SLOW)

  it('asks a timed race for how long it lasts, and says so in the box', async () => {
    const user = await open('change')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Vrsta, 1. trka' }), 'time')

    const duration = raceNumber(1).getByLabelText(/^Trajanje \(h\)/)

    expect(duration).toHaveAttribute('aria-required', 'true')
    expect(duration).toHaveAttribute('inputmode', 'decimal')
  }, SLOW)
})
