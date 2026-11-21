import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClockProvider } from '../../clock/ClockProvider'
import { btlPoints } from '../../data/scoring'
import { formatPoints } from '../../i18n/format'
import { I18nProvider } from '../../i18n/I18nProvider'
import sr from '../../i18n/sr.json'
import { inputElement, must } from '../../test/at'
import { Calculator } from './Calculator'

/**
 * THE MINUTES AND THE SECONDS OF THE CALCULATOR ARE FROM 0 TO 59.
 *
 * Owner, 21.11.2026 (`btl-produkt/PDL.md`): "Minuti i sekunde u kalkulatoru mogu biti od 0 do 59. Ako
 * otkucam broj veci od 59, polje treba da se promeni na 59, a ispod 0 na 0." A figure above 59 becomes
 * 59 and one below nought becomes 0, in the box itself, and the score is read off the corrected box.
 * The hours are not part of the decision.
 */
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

const LABEL = { minutes: sr.home.minutes, seconds: sr.home.seconds, hours: sr.home.hours }

function box(calc: HTMLElement, name: keyof typeof LABEL): HTMLInputElement {
  return inputElement(within(calc).getByRole('textbox', { name: LABEL[name] }))
}

async function type(calc: HTMLElement, name: keyof typeof LABEL, text: string): Promise<void> {
  const one = box(calc, name)

  await userEvent.clear(one)
  await userEvent.type(one, text)
}

async function typeLength(calc: HTMLElement, text: string): Promise<void> {
  await userEvent.type(within(calc).getByRole('textbox', { name: sr.home.calcLength }), text)
}

function figure(seconds: number): string {
  return formatPoints(must(btlPoints(10, 0, 0, seconds), 'a score'), 'sr')
}

const CASES: [string, string][] = [
  ['65', '59'],
  ['60', '59'],
  ['59', '59'],
  ['-3', '0'],
  ['0', '0'],
  ['7', '7'],
  ['999', '59'],
]

describe.each(['minutes', 'seconds'] as const)('the %s box of the calculator', (name) => {
  it.each(CASES)('turns %s into %s', async (written, kept) => {
    const calc = mount()

    await type(calc, name, written)

    expect(box(calc, name)).toHaveValue(kept)
  })

  it('lets a figure be written on: 6 stays 6 and 65 then becomes 59, and a lone minus is left alone', async () => {
    const calc = mount()
    const one = box(calc, name)

    await userEvent.type(one, '6')
    expect(one).toHaveValue('6')

    await userEvent.type(one, '5')
    expect(one).toHaveValue('59')

    await userEvent.clear(one)
    await userEvent.type(one, '-')
    expect(one).toHaveValue('-')
  })

  it('stays empty when nothing is written', () => {
    const calc = mount()

    expect(box(calc, name)).toHaveValue('')
  })
})

describe('the score of the calculator', () => {
  it('is computed with 59 and not with 65 in the minutes', async () => {
    const calc = mount()

    await typeLength(calc, '10')
    await type(calc, 'minutes', '65')

    expect(within(calc).getByRole('status')).toHaveTextContent(`${sr.home.calcResult} ${figure(59 * 60)}`)
    expect(figure(59 * 60)).not.toBe(figure(65 * 60))
  })

  it('is computed with 59 and not with 65 in the seconds', async () => {
    const calc = mount()

    await typeLength(calc, '10')
    await type(calc, 'minutes', '5')
    await type(calc, 'seconds', '65')

    expect(within(calc).getByRole('status')).toHaveTextContent(`${sr.home.calcResult} ${figure(5 * 60 + 59)}`)
    expect(figure(5 * 60 + 59)).not.toBe(figure(5 * 60 + 65))
  })

  it('is computed with nought for a negative figure', async () => {
    const calc = mount()

    await typeLength(calc, '10')
    await type(calc, 'minutes', '50')
    await type(calc, 'seconds', '-3')

    expect(within(calc).getByRole('status')).toHaveTextContent(`${sr.home.calcResult} ${figure(50 * 60)}`)
  })
})

describe('the hours and the fractions', () => {
  it('leave the hours alone: 65 hours stays 65', async () => {
    const calc = mount()

    await type(calc, 'hours', '65')

    expect(box(calc, 'hours')).toHaveValue('65')
  })

  it("leave a fraction in the minutes to be refused in the forms' words, as before", async () => {
    const calc = mount()

    /* Pasted whole, since typed key by key „65" would already have become 59 on the way. */
    await userEvent.clear(box(calc, 'minutes'))
    await userEvent.click(box(calc, 'minutes'))
    await userEvent.paste('65,5')

    expect(box(calc, 'minutes')).toHaveValue('65,5')
    expect(within(calc).getByText(sr.form.errors.integer)).toBeInTheDocument()
  })
})
