import { htmlElement, must } from '../test/at'
import { render, screen, within } from '@testing-library/react'
import { setupUser } from '../test/user'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { DatePicker } from './DatePicker'

/** The day the portal is on while these run. Fixed rather than the machine's,
 *  so "opens on this month" is a month the test can name. */
const TODAY = '2026-07-30'

function renderPicker(value = '', onChange = vi.fn()) {
  render(
    <ClockProvider simulatedDay={TODAY}>
      <I18nProvider locale="sr">
        <DatePicker
          id="proba"
          name="proba"
          value={value}
          invalid={false}
          describedBy={undefined}
          onChange={onChange}
        />
      </I18nProvider>
    </ClockProvider>,
  )

  return onChange
}

describe('DatePicker', () => {
  it('takes a typed date and puts the slashes in', async () => {
    const user = setupUser()
    const onChange = renderPicker()

    await user.type(screen.getByRole('textbox'), '1')

    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('opens a month and closes it again', async () => {
    const user = setupUser()
    renderPicker()

    const open = screen.getByRole('button', { name: 'Otvori kalendar' })
    expect(open).toHaveAttribute('aria-expanded', 'false')

    await user.click(open)
    expect(open).toHaveAttribute('aria-expanded', 'true')

    await user.click(open)
    expect(open).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Escape and on a click outside', async () => {
    const user = setupUser()
    renderPicker()

    const open = screen.getByRole('button', { name: 'Otvori kalendar' })

    await user.click(open)
    await user.keyboard('{Escape}')
    expect(open).toHaveAttribute('aria-expanded', 'false')

    await user.click(open)
    await user.click(document.body)
    expect(open).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays open for a key it does not handle', async () => {
    const user = setupUser()
    renderPicker()

    const open = screen.getByRole('button', { name: 'Otvori kalendar' })
    await user.click(open)
    await user.keyboard('{ArrowDown}')

    expect(open).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens on the month of the date already typed', async () => {
    const user = setupUser()
    renderPicker('12/04/1985')

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    expect(screen.getByText('april 1985.')).toBeVisible()
    // The day already chosen is marked.
    expect(screen.getByRole('button', { name: '12' })).toHaveClass('datepicker__day--on')
  })

  it('walks to the month before and after', async () => {
    const user = setupUser()
    renderPicker('12/04/1985')

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))
    await user.click(screen.getByRole('button', { name: 'Sledeći mesec' }))
    expect(screen.getByText('maj 1985.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Prethodni mesec' }))
    await user.click(screen.getByRole('button', { name: 'Prethodni mesec' }))
    expect(screen.getByText('mart 1985.')).toBeVisible()
  })

  it('gives back the day that was picked, and shuts', async () => {
    const user = setupUser()
    const onChange = renderPicker('12/04/1985')

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))
    await user.click(screen.getByRole('button', { name: '20' }))

    expect(onChange).toHaveBeenCalledWith('20/04/1985')
    expect(screen.getByRole('button', { name: 'Otvori kalendar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('opens on this month when what was typed is not a date yet', async () => {
    const user = setupUser()
    renderPicker('12/')

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    const heading = must(screen.getByRole('button', { name: 'Sledeći mesec' }).previousElementSibling, 'an element before it')
    expect(heading.textContent).toContain('jul 2026')
  })

  it("opens on the month the portal is on, not the one the machine's clock is on", async () => {
    const user = setupUser()
    renderPicker()

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    /* The portal reads one clock, and the switch in the header moves it
       (src/clock). A calendar that opened on the machine's month while the
       price beside it was quoted for another would read as a bug in the portal
       rather than as one half of it not having heard. */
    const heading = must(screen.getByRole('button', { name: 'Sledeći mesec' }).previousElementSibling, 'an element before it')
    expect(heading.textContent).toContain('jul 2026')
  })

  it('leaves the days outside the month blank', async () => {
    const user = setupUser()
    renderPicker('01/05/2027')

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    // 1 May 2027 is a Saturday, so the week starts with five empty cells.
    const grid = htmlElement(screen.getByText('maj 2027.').closest('.datepicker__pop'))
    expect(within(grid).getAllByRole('button', { name: /^\d+$/ })).toHaveLength(31)
  })
})

describe('where the calendar stands', () => {
  /** A field of the given shape, and a calendar of the given height. jsdom lays
   *  nothing out and answers nought to every rect (ADL A18), so the two are said
   *  here; what is measured is the arithmetic that chooses a side. */
  async function openAt({ top, height, tall }: { top: number; height: number; tall: number }) {
    const user = setupUser()

    renderPicker()

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const asked = this.classList.contains('datepicker__pop')

      return {
        top: asked ? 0 : top,
        bottom: asked ? tall : top + height,
        left: 40,
        right: 240,
        width: 200,
        height: asked ? tall : height,
        x: 40,
        y: asked ? 0 : top,
        toJSON: () => ({}),
      }
    })

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    const pop = htmlElement(
      must(document.querySelector('.datepicker__pop'), 'the calendar'),
    )

    vi.restoreAllMocks()

    return pop
  }

  it('stands under the field where the room under it is enough', async () => {
    /* 768 of window, a field ending at 200, a calendar 245 tall: it fits under. */
    const pop = await openAt({ top: 160, height: 40, tall: 245 })

    expect(pop.style.position).toBe('fixed')
    expect(pop.style.top).toBe('208px')
    expect(pop.style.bottom).toBe('')
  })

  it('stands over the field where there is more room over it', async () => {
    /* The row of a race far down a long screen: nothing fits under it, and the
       calendar was cut to a strip of twenty pixels by the box that scrolls around
       the table (`admin/EventRaces.tsx`). Anchored by its bottom edge, so its own
       height is not needed to place it. */
    const pop = await openAt({ top: 700, height: 40, tall: 245 })

    expect(pop.style.position).toBe('fixed')
    expect(pop.style.top).toBe('')
    expect(pop.style.bottom).toBe(`${String(window.innerHeight - 700 + 8)}px`)
  })
})
