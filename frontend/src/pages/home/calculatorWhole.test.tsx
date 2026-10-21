import { fireEvent, render, screen, within } from '@testing-library/react'
import { ClockProvider } from '../../clock/ClockProvider'
import { btlPoints } from '../../data/scoring'
import { unosRezultata } from '../../forms/definitions'
import { parseNumber } from '../../forms/numberField'
import { validateField } from '../../forms/validate'
import { formatPoints } from '../../i18n/format'
import { I18nProvider } from '../../i18n/I18nProvider'
import sr from '../../i18n/sr.json'
import { inputElement, must } from '../../test/at'
import { Calculator } from './Calculator'

/**
 * THE CALCULATOR TAKES A WHOLE NUMBER IN THE FIVE BOXES THAT THE FORMS TAKE ONE IN, AND REFUSES A
 * SEPARATOR THERE IN THE FORMS' OWN WORDS.
 *
 * <p>Owner, 20.10.2026 (`btl-produkt/PDL.md`, „Kalkulator bodova u poljima za uspon, spust i
 * sate/minute/sekunde prima samo cele brojeve, isto kao forme („Unesi ceo broj.")", finding PENDING
 * 28132). Until then the calculator read „1,200" metres of climb as one point two, where the form of
 * a result says „Unesi ceo broj." to the same writing.
 *
 * <p>**Two things are held, and the second is the one a copy of the rule would get wrong.** What the
 * calculator does with a fraction in a whole-number box (it gives no answer and says the forms'
 * sentence under that box and no other), and that it does it for exactly the writing the forms refuse:
 * each box is set against the field of `unos-rezultata` it is the calculator of, and for every number
 * in the table below the calculator shows the sentence if and only if `validateField` says
 * `form.errors.integer` for the field. A calculator with a pattern of its own for „whole" (digits and
 * no sign, say, or one that does not trim) disagrees with the form on „-3" or on „ 12 " and fails there.
 *
 * <p>**The length is the other half**: the form's `distanceKm` is not whole, and the calculator's
 * length box takes „10,9" and „10.9" and says nothing.
 */
type Box = 'length' | 'ascent' | 'descent' | 'hours' | 'minutes' | 'seconds'

const BOXES: Box[] = ['length', 'ascent', 'descent', 'hours', 'minutes', 'seconds']

/** The field of the form of a result that each box of the calculator is the calculator of. */
const FIELD_OF: Record<Box, string> = {
  length: 'distanceKm',
  ascent: 'ascentM',
  descent: 'descentM',
  hours: 'hours',
  minutes: 'minutes',
  seconds: 'seconds',
}

const RACE: Record<Box, number> = {
  length: 10,
  ascent: 2000,
  descent: 2000,
  hours: 0,
  minutes: 50,
  seconds: 0,
}

/** Writing that is a number in the shape every number box of the portal takes (`parseNumber`), whole
 *  and not: the separator of the decimals both ways, the separator of the thousands, a sign, a space
 *  round it, an exponent, a lone separator before the digits. Each is asked of the form as well. */
const NUMBERS = [
  '0',
  '7',
  '007',
  '1200',
  ' 12 ',
  '-3',
  '1.200',
  '1,200',
  '10,0',
  '10.0',
  '.5',
  ',5',
  '1e3',
  '2000,9',
  '0.5',
]

function mount(): HTMLElement {
  render(
    <ClockProvider>
      <I18nProvider locale="sr">
        <Calculator />
      </I18nProvider>
    </ClockProvider>,
  )

  return screen.getByRole('region', { name: sr.home.calculator })
}

function boxesOf(calc: HTMLElement): Record<string, HTMLInputElement> {
  return Object.fromEntries(
    within(calc)
      .getAllByRole('textbox')
      .map((one) => [inputElement(one).name, inputElement(one)]),
  )
}

function boxOf(calc: HTMLElement, name: Box): HTMLInputElement {
  return must(boxesOf(calc)[name], `the box named ${name}`)
}

function write(calc: HTMLElement, name: Box, text: string): void {
  fireEvent.input(boxOf(calc, name), { target: { value: text } })
}

function writeRace(calc: HTMLElement): void {
  for (const name of BOXES) {
    write(calc, name, String(RACE[name]))
  }
}

/** What the box says about itself: the sentence its `aria-describedby` points at, or null where it
 *  points at nothing. Read off the box and not searched for on the page, so a sentence under the
 *  wrong box is a sentence the right box does not have. */
function sentenceOf(calc: HTMLElement, name: Box): string | null {
  const id = boxOf(calc, name).getAttribute('aria-describedby')

  if (id === null) {
    return null
  }

  return must(calc.ownerDocument.getElementById(id), `the sentence of ${name}`).textContent
}

function figureFor(race: Record<Box, number>): string {
  const points = must(
    btlPoints(
      race.length,
      race.ascent,
      race.descent,
      race.hours * 3600 + race.minutes * 60 + race.seconds,
    ),
    'a score for the race',
  )

  return formatPoints(points, 'sr')
}

function expectFigure(calc: HTMLElement, figure: string): void {
  expect(within(calc).getByRole('status')).toHaveTextContent(`${sr.home.calcResult} ${figure}`)
}

function expectWaiting(calc: HTMLElement, what: string): void {
  const status = within(calc).getByRole('status')

  expect(status, what).toHaveTextContent(`${sr.home.calcResult} ${sr.home.calcWaiting}`)
  expect(status, what).not.toHaveTextContent('NaN')
}

const WHOLE: Box[] = ['ascent', 'descent', 'hours', 'minutes', 'seconds']

describe('the five whole-number boxes of the calculator', () => {
  it('say the forms\' sentence, and the forms\' sentence is the one the dictionary has for a form', () => {
    expect(sr.form.errors.integer).toBe('Unesi ceo broj.')
  })

  it.each(WHOLE)('refuse a fraction in the %s box either way round, and say so under that box only', (name) => {
    const calc = mount()

    writeRace(calc)
    expectFigure(calc, figureFor(RACE))

    for (const text of ['2000,9', '2000.9', '0,5', '0.5']) {
      write(calc, name, text)

      expectWaiting(calc, `${name} holding ${JSON.stringify(text)}`)
      expect(sentenceOf(calc, name), `${name} holding ${JSON.stringify(text)}`).toBe(sr.form.errors.integer)
      expect(boxOf(calc, name)).toHaveAttribute('aria-invalid', 'true')

      /* And under no other box: the five others say nothing, and so does the length. */
      for (const other of BOXES.filter((one) => one !== name)) {
        expect(sentenceOf(calc, other), `${other} while ${name} is refused`).toBeNull()
        expect(boxOf(calc, other)).not.toHaveAttribute('aria-invalid')
      }

      /* It comes back when the box is written whole, so „refused" was about the box and not a state
         the widget could not leave. */
      write(calc, name, String(RACE[name]))

      expectFigure(calc, figureFor(RACE))
      expect(sentenceOf(calc, name)).toBeNull()
      expect(boxOf(calc, name)).not.toHaveAttribute('aria-invalid')
    }
  })

  it.each(WHOLE)('do not read a separator in the %s box as the thousands, and do not round it either', (name) => {
    const calc = mount()

    writeRace(calc)

    /* „1.200" and „1,200" are twelve hundred written with a separator or one point two; the forms
       decline to guess (`numberField.ts`, `isWhole`), and so does the widget: no figure at all, not
       the figure of 1200 and not the figure of 1 or 2 either. */
    for (const text of ['1.200', '1,200']) {
      write(calc, name, text)

      expectWaiting(calc, `${name} holding ${JSON.stringify(text)}`)
      expect(sentenceOf(calc, name)).toBe(sr.form.errors.integer)
    }
  })

  it.each(WHOLE)('still take a whole number in the %s box, with a space round it and nought for nothing', (name) => {
    const calc = mount()

    writeRace(calc)
    write(calc, name, ` ${String(RACE[name])} `)

    expectFigure(calc, figureFor(RACE))
    expect(sentenceOf(calc, name)).toBeNull()

    /* Emptied, the box is nought as it always was (a flat race has no climb to write), and nothing is
       said about it. */
    write(calc, name, '')

    expect(sentenceOf(calc, name)).toBeNull()
    expect(within(calc).queryByText(sr.form.errors.integer)).toBeNull()
  })

  it('give no answer while a box holds writing that is not a number, and say the same sentence', () => {
    const calc = mount()

    writeRace(calc)
    write(calc, 'minutes', 'abc')

    expectWaiting(calc, 'minutes holding abc')
    expect(sentenceOf(calc, 'minutes')).toBe(sr.form.errors.integer)
  })

  it('read a fraction in the length box as the number it is, and say nothing', () => {
    const calc = mount()
    const withIt = { ...RACE, length: 10.9 }

    writeRace(calc)

    for (const text of ['10,9', '10.9']) {
      write(calc, 'length', text)

      expectFigure(calc, figureFor(withIt))
      expect(sentenceOf(calc, 'length'), text).toBeNull()
      expect(within(calc).queryByText(sr.form.errors.integer), text).toBeNull()
    }
  })
})

describe('the calculator and the form of a result refuse the same writing', () => {
  it('has a row for each box and a field of the form for each row, and the form keeps exactly those five whole', () => {
    const wholeOnTheForm = BOXES.filter(
      (name) =>
        must(
          unosRezultata.fields.find((field) => field.name === FIELD_OF[name]),
          `the field ${FIELD_OF[name]} of unos-rezultata`,
        ).integer === true,
    )

    expect(wholeOnTheForm.sort()).toEqual([...WHOLE].sort())
  })

  it.each(BOXES)('say the sentence in the %s box if and only if the form says it for its field', (name) => {
    const field = must(
      unosRezultata.fields.find((one) => one.name === FIELD_OF[name]),
      `the field ${FIELD_OF[name]} of unos-rezultata`,
    )
    const calc = mount()

    for (const text of NUMBERS) {
      /* Measured is not assumed: every row of the table is a number the reader of the portal reads
         (`parseNumber`), so the form's answer for it is „whole", „not whole", or a bound, and the
         case does not compare a sentence about a number with one about something that is not. */
      expect(parseNumber(text), `${JSON.stringify(text)} is a number`).not.toBeNull()

      write(calc, name, text)

      const formSays = validateField(field, text)?.key === 'form.errors.integer'

      expect(
        sentenceOf(calc, name) === sr.form.errors.integer,
        `${name} holding ${JSON.stringify(text)}: the form ${formSays ? 'refuses' : 'takes'} it`,
      ).toBe(formSays)
    }
  })

  it('has rows that tell the two apart, so the case above can fail', () => {
    /* A table in which every row is whole, or no row is, would pass a calculator that refuses
       everything or nothing. Both kinds are in it, and the form is asked, not assumed. */
    const climb = must(
      unosRezultata.fields.find((one) => one.name === 'ascentM'),
      'the climb',
    )
    const says = NUMBERS.map((text) => validateField(climb, text)?.key === 'form.errors.integer')

    expect(says).toContain(true)
    expect(says).toContain(false)
  })
})
