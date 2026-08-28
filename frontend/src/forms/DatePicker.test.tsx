import { htmlElement, must } from '../test/at'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
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

describe('a day the box offers beside its calendar', () => {
  const STEPS = [{ label: '+1w', title: 'sedam dana', to: '15/11/2027' }]

  function renderWithSteps(locked: boolean) {
    const onChange = vi.fn()

    render(
      <ClockProvider simulatedDay={TODAY}>
        <I18nProvider locale="sr">
          <DatePicker
            id="proba"
            name="proba"
            value="01/01/2027"
            invalid={false}
            describedBy={undefined}
            locked={locked}
            steps={STEPS}
            onChange={onChange}
          />
        </I18nProvider>
      </ClockProvider>,
    )

    return onChange
  }

  it('writes its day when the box is open to it', async () => {
    const user = setupUser()
    const onChange = renderWithSteps(false)

    await user.click(screen.getByRole('button', { name: '+1w' }))

    expect(onChange).toHaveBeenCalledWith('15/11/2027')
  })

  it('refuses when the box is held, rather than saying so and doing it anyway', async () => {
    /* „A lock that is an ornament is worse than none" (PDL). The button stays in the
       keyboard's path and says it is held, which is what `aria-disabled` is for here,
       but saying so is not doing so: a control that answers to a press it has just
       declared refused tells the reader one thing and shows another. The same fault
       was measured on the calendar button of this very box on 23.08.2026. */
    const user = setupUser()
    const onChange = renderWithSteps(true)
    const step = screen.getByRole('button', { name: '+1w' })

    expect(step).toHaveAttribute('aria-disabled', 'true')

    await user.click(step)

    expect(onChange).not.toHaveBeenCalled()
  })
})

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
  /** A field of the given shape and a calendar of the given height, said out loud:
   *  jsdom lays nothing out and answers nought to every rect (ADL A18), so what is
   *  measured here is the arithmetic that places it. */
  async function openAt({
    top,
    height,
    tall,
    wide = 200,
    left = 40,
    room,
  }: {
    top: number
    height: number
    tall: number
    wide?: number
    left?: number
    /** The window as the reader sees it. jsdom's is 1024 by 768 and every screen
     *  this has to survive is smaller, so a test that leaves it alone measures a
     *  clamp that never fires: both of the two below passed with the clamping
     *  taken out until this was measured on 23.08.2026. */
    room: { across: number; down: number }
  }) {
    const user = setupUser()

    renderPicker()

    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(room.across)
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(room.down)

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const asked = this.classList.contains('datepicker__pop')

      if (asked) {
        /* What the sheet was already wearing when it was measured. Both of these
           change how wide the box is, so both have to be on before anybody reads
           its width: left in the sheet's own `absolute`, the calendar is as wide as
           the column of the form allows and measures 320px where it will be drawn
           344, and the clamp then places it 16px under the right edge. */
        measuredWearing = {
          position: this.style.position,
          maxInlineSize: this.style.maxInlineSize,
        }
      }

      return {
        top: asked ? 0 : top,
        bottom: asked ? tall : top + height,
        left,
        right: left + wide,
        width: wide,
        height: asked ? tall : height,
        x: left,
        y: asked ? 0 : top,
        toJSON: () => ({}),
      }
    })

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    const pop = htmlElement(must(document.querySelector('.datepicker__pop'), 'the calendar'))

    vi.restoreAllMocks()

    return pop
  }

  let measuredWearing: { position: string; maxInlineSize: string } | null = null

  beforeEach(() => {
    measuredWearing = null
  })

  it('stands under the field where the room under it is enough', async () => {
    const pop = await openAt({ top: 160, height: 40, tall: 245, room: { across: 360, down: 768 } })

    expect(pop.style.position).toBe('fixed')
    expect(pop.style.top).toBe('208px')
    /* Both ends written, and the one not in use is `auto` rather than empty:
       emptied, `.datepicker__pop` in the sheet carries `top: calc(100% + …)`, and on
       a `fixed` element that is the height of the window. */
    expect(pop.style.bottom).toBe('auto')
  })

  it('stands over the field where there is no room under it', async () => {
    /* The row of a race far down a long screen: nothing fits under it, and inside a
       box that scrolls the calendar was cut to a strip of twenty pixels. */
    const pop = await openAt({ top: 700, height: 40, tall: 245, room: { across: 360, down: 768 } })

    expect(pop.style.top).toBe(`${String(700 - 245 - 8)}px`)
    expect(pop.style.bottom).toBe('auto')
  })

  it('stays inside the window where neither side has room', async () => {
    /* A short window, and a field near the top of it: under would run past the
       bottom edge and over would run past the top. A window 300 tall and a calendar
       245 tall leave 55, so no placement is comfortable and one has to be chosen. */
    const pop = await openAt({ top: 20, height: 40, tall: 245, room: { across: 360, down: 300 } })
    const placed = Number(pop.style.top.replace('px', ''))

    expect(placed).toBeGreaterThanOrEqual(8)
    expect(placed + 245, 'the calendar hangs under the bottom edge').toBeLessThanOrEqual(300 - 8)
  })

  it('stays inside the window sideways as well', async () => {
    /* A calendar is wider than the cell it belongs to, and `fixed` does not move
       with the page. A field 300 from the left of a 360px window: placed where the
       field is, the calendar of 200 would end at 500. */
    const pop = await openAt({
      top: 160,
      height: 40,
      tall: 245,
      left: 300,
      room: { across: 360, down: 768 },
    })
    const across = Number(pop.style.insetInlineStart.replace('px', ''))

    expect(across).toBeGreaterThanOrEqual(8)
    expect(across + 200, 'the calendar hangs over the right edge').toBeLessThanOrEqual(360 - 8)
  })

  it('is never wider than the window the reader can see', async () => {
    /* Seven columns of `2rem` are 448px of grid at 200% text, and a `fixed` box that
       hangs over the edge cannot be scrolled to. Measured 23.08.2026 in Chrome, on
       the public registration form at 360px: with the columns rigid the sheet stood
       514px wide and `elementFromPoint` over **fourteen** days of the month came
       back `null`. With the cap it is 344 and none are lost.

       Against `clientWidth` and not `innerWidth`: the second counts the scrollbar,
       measured 19px on this machine, and a sheet placed against it sits under the
       bar. */
    const pop = await openAt({ top: 160, height: 40, tall: 245, room: { across: 360, down: 768 } })

    expect(pop.style.maxInlineSize, 'the sheet may grow past the window').toBe('344px')
  })

  it('is measured wearing what changes how wide it is', async () => {
    /* The fault this exists for, measured on 23.08.2026: the cap and `fixed` were
       written after the box was read, so the width that was clamped was the width
       the sheet had inside the column of the form, and the calendar came out 16px
       under the right edge. Order is the whole of the fix, and nothing else here
       can see it. */
    await openAt({ top: 160, height: 40, tall: 245, room: { across: 360, down: 768 } })

    expect(measuredWearing).toEqual({ position: 'fixed', maxInlineSize: '344px' })
  })
})

describe('a calendar standing open when the field is locked under it', () => {
  const TODAY_ISO = '2027-01-01'

  /** The field with a lock that can be turned while it stands, which is the whole
   *  of what this is about: the guard on the button refuses to open a calendar
   *  and says nothing about one already standing. */
  function Turning() {
    const [locked, setLocked] = useState(false)

    return (
      <ClockProvider simulatedDay={TODAY_ISO}>
        <I18nProvider locale="sr">
          <button
            type="button"
            onClick={() => {
              setLocked(true)
            }}
          >
            izaberi trku
          </button>
          <DatePicker
            id="proba"
            name="proba"
            value="01/01/2027"
            invalid={false}
            describedBy={undefined}
            locked={locked}
            onChange={vi.fn()}
          />
        </I18nProvider>
      </ClockProvider>
    )
  }

  it('closes, rather than standing over a date nobody may change', async () => {
    /* Measured on 23.08.2026 with the keyboard alone: open the calendar, walk back
       to the name of the race, choose one from the list; the date becomes the
       portal's and the calendar goes on standing with its thirty-one days. Enter
       on any of them changes nothing and closes the list without a word.

       A calendar over a locked date is not merely useless: it is the portal
       inviting an answer to a question it has just closed. */
    const user = setupUser()

    render(<Turning />)

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    expect(screen.getByRole('button', { name: '15' })).toBeVisible()

    /* Turned without a press of the pointer, and that is not a convenience: a
       press anywhere outside the calendar already closes it, by the rule that
       exists for somebody who opened it and changed their mind. Measured on
       28.08.2026 with the effect taken out and this walk written with
       `user.click`: the calendar closed all the same and the case said nothing.
       In the real walk the lock arrives because another field was answered, and
       nothing was pressed here at all. */
    fireEvent.click(screen.getByRole('button', { name: 'izaberi trku' }))

    expect(screen.queryByRole('button', { name: '15' })).toBeNull()
  })

  it('hands the focus back to the button, rather than to the page', async () => {
    /* The other half of the same measurement: the focus fell onto `<body>`, and a
       reader working by keyboard whose focus falls to the page has to walk the
       whole form again to find their place (WCAG 2.2 SC 2.4.3). It goes back to
       the button the calendar was opened from, which is where that reader was a
       moment ago. */
    const user = setupUser()

    render(<Turning />)

    const opener = screen.getByRole('button', { name: 'Otvori kalendar' })

    await user.click(opener)

    screen.getByRole('button', { name: '15' }).focus()

    /* Pressed without the press moving the focus, which is the walk this is
       about: in the real one the lock arrives because a race was chosen in
       another field and the reader's focus is still standing on a day. A press
       through `user.click` would take the focus itself and there would be nothing
       left inside the calendar to rescue. */
    fireEvent.click(screen.getByRole('button', { name: 'izaberi trku' }))

    expect(document.activeElement).toBe(opener)
  })

  it('leaves a focus that was never inside it where it was', async () => {
    /* And only where the focus is really inside what is being closed. A lock
       arriving while somebody is three fields further down must not drag them
       backwards, which would be the same fault in the other direction. */
    const user = setupUser()

    render(<Turning />)

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    const elsewhere = screen.getByRole('button', { name: 'izaberi trku' })

    /* Standing somewhere else while the calendar is open, which is the state the
       rescue must not touch: the focus is outside it, so closing it takes nothing
       away. Measured with the condition dropped, so the focus is carried back
       whatever it was doing: it is dragged from here to the calendar's button. */
    elsewhere.focus()
    fireEvent.click(elsewhere)

    expect(document.activeElement).toBe(elsewhere)
  })
})
