import { act, fireEvent, render, screen } from '@testing-library/react'
import { setupUser } from '../test/user'
import { I18nProvider } from '../i18n/I18nProvider'
import { ClockProvider } from './ClockProvider'
import { realToday } from './context'
import { DateSwitch } from './DateSwitch'
import { useClock, useToday, useTodayDate } from './useClock'

function Reader() {
  const { simulated, simulate } = useClock()
  const today = useToday()
  const asDate = useTodayDate()

  return (
    <>
      <span data-testid="danas">{today}</span>
      <span data-testid="simulirano">{simulated ?? 'ne'}</span>
      <span data-testid="godina">{asDate.getUTCFullYear()}</span>
      <span data-testid="kaoDatum">{asDate.toISOString()}</span>
      {/* Moves the clock without going through the switch, which is the only way
          to ask what the provider does in a build where the switch is not
          drawn. */}
      <button type="button" onClick={() => simulate('2027-05-05')}>
        pomeri
      </button>
    </>
  )
}

function renderClock(simulatedDay: string | null = null) {
  return render(
    <I18nProvider locale="sr">
      <ClockProvider simulatedDay={simulatedDay}>
        <DateSwitch />
        <Reader />
      </ClockProvider>
    </I18nProvider>,
  )
}

/** The control, by the name it is known by rather than by a word beside it: the
 *  header carries no labels any more (owner, 30.07.2026). */
function theDay(): HTMLInputElement {
  return screen.getByLabelText('Današnji datum')
}

describe('the clock', () => {
  it('reads the machine when nobody has moved it', () => {
    renderClock()

    expect(screen.getByTestId('danas')).toHaveTextContent(realToday())
    expect(screen.getByTestId('simulirano')).toHaveTextContent('ne')
  })

  it('reads the day it was put on instead', () => {
    renderClock('2027-01-15')

    expect(screen.getByTestId('danas')).toHaveTextContent('2027-01-15')
    expect(screen.getByTestId('simulirano')).toHaveTextContent('2027-01-15')
  })

  it('hands the same day out as a date, at midnight rather than at some hour', () => {
    renderClock('2027-01-15')

    // The two callers that count in years rather than compare days get the day
    // the rest of the portal agreed on, not the clock complete with its time.
    expect(screen.getByTestId('godina')).toHaveTextContent('2027')
    expect(screen.getByTestId('kaoDatum')).toHaveTextContent('2027-01-15T00:00:00.000Z')
  })

  it('moves on to the next day when midnight passes under an open tab', () => {
    /* Every screen used to read the clock inside its own draw, so this was free.
       Now that they all ask one place, and that place is mounted once above
       everything and never draws again on its own, the day would otherwise be
       the day the tab was opened for as long as it stayed open: somebody who
       left the portal open on the evening of 30 September would come back to it
       on 1 October and still be told that membership is not yet on sale. */
    vi.useFakeTimers()

    try {
      vi.setSystemTime(new Date('2026-09-30T21:59:30Z'))
      renderClock()
      expect(screen.getByTestId('danas')).toHaveTextContent('2026-09-30')

      act(() => {
        vi.setSystemTime(new Date('2026-10-01T00:00:30Z'))
        vi.advanceTimersByTime(60_000)
      })

      expect(screen.getByTestId('danas')).toHaveTextContent('2026-10-01')
    } finally {
      vi.useRealTimers()
    }
  })

  it('looks again as soon as the tab is come back to', () => {
    /* A laptop that slept through the night fires no timers while it sleeps, and
       coming back to the tab is exactly when somebody is looking at it. */
    vi.useFakeTimers()

    try {
      vi.setSystemTime(new Date('2026-09-30T21:59:30Z'))
      renderClock()

      act(() => {
        vi.setSystemTime(new Date('2026-10-01T08:00:00Z'))
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(screen.getByTestId('danas')).toHaveTextContent('2026-10-01')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops looking once it is gone', () => {
    vi.useFakeTimers()

    try {
      const { unmount } = renderClock()
      unmount()

      // A timer and a listener left behind would go on setting state on
      // something that is no longer there, once per minute, for the visit.
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves a simulated day where it is when the real one changes', () => {
    vi.useFakeTimers()

    try {
      vi.setSystemTime(new Date('2026-09-30T21:59:30Z'))
      renderClock('2027-01-15')

      act(() => {
        vi.setSystemTime(new Date('2026-10-01T00:00:30Z'))
        vi.advanceTimersByTime(60_000)
      })

      expect(screen.getByTestId('danas')).toHaveTextContent('2027-01-15')
    } finally {
      vi.useRealTimers()
    }
  })

  it('refuses to work outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Reader />)).toThrow('useClock must be used inside ClockProvider')

    spy.mockRestore()
  })
})

describe('DateSwitch', () => {
  it('moves the day the portal is read as', () => {
    renderClock()

    // fireEvent rather than typing: a native date input takes a whole date at
    // once, and typing into one keystroke by keystroke is not what a person
    // does with it either.
    fireEvent.change(theDay(), { target: { value: '2026-10-02' } })

    expect(screen.getByTestId('danas')).toHaveTextContent('2026-10-02')
  })

  it('gives the clock back', async () => {
    const user = setupUser()
    renderClock('2026-10-02')

    await user.click(screen.getByLabelText('Vrati na stvarni datum'))

    expect(screen.getByTestId('danas')).toHaveTextContent(realToday())
    expect(screen.getByTestId('simulirano')).toHaveTextContent('ne')
  })

  it('offers nothing to give back while it is reading the real clock', () => {
    renderClock()

    /* A button that spends its life disabled is one more stop for anybody
       moving through the header with a keyboard, and its absence says what its
       greyness would. */
    expect(screen.queryByLabelText('Vrati na stvarni datum')).not.toBeInTheDocument()
  })

  it('gives the clock back when the field is emptied', () => {
    renderClock('2026-10-02')

    fireEvent.change(theDay(), { target: { value: '' } })

    expect(screen.getByTestId('simulirano')).toHaveTextContent('ne')
  })

  it('says on itself that it is not on the real day', () => {
    renderClock('2026-10-02')

    /* Nothing else on the screen can say so: every date on it looks exactly as
       it would if that day had really come, which is the whole point. */
    expect(theDay().className).toContain('date-switch__day--on')
  })

  it('does not exist in a production build', () => {
    vi.stubEnv('DEV', false)
    // Both, or the test turns into a failure on a machine that happens to have
    // VITE_DEV_TOOLS exported.
    vi.stubEnv('VITE_DEV_TOOLS', '')

    renderClock()
    expect(screen.queryByLabelText('Današnji datum')).not.toBeInTheDocument()

    vi.unstubAllEnvs()
  })

  it('exists in the QA build, which is a production build with the flag set', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEV_TOOLS', '1')

    renderClock()
    expect(theDay()).toBeVisible()

    vi.unstubAllEnvs()
  })
})

/* Walking the portal on a chosen day means reloading it now and then, by hand or
 * because a form sent something. A day that fell off on every reload would have
 * to be set again on every screen, and half the walk would be spent on the real
 * one without noticing. */
describe('a moved clock survives a reload', () => {
  const KEY = 'btl.simulated-day'

  it('is left behind in the tab, and picked up again', () => {
    const { unmount } = renderClock()

    fireEvent.change(theDay(), { target: { value: '2026-12-31' } })
    expect(sessionStorage.getItem(KEY)).toBe('2026-12-31')

    // The reload: everything goes and comes back, and the tab is what is left.
    unmount()
    renderClock()

    expect(screen.getByTestId('danas')).toHaveTextContent('2026-12-31')
  })

  it('is forgotten when the clock is given back', async () => {
    const user = setupUser()
    renderClock('2026-12-31')

    await user.click(screen.getByLabelText('Vrati na stvarni datum'))

    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it.each([['juče'], ['2026-13-45'], ['2027-02-30']])(
    'ignores %s in that slot, because it is not a day',
    (planted) => {
      /* The store is the tab's, not ours alone. And a day that is only shaped
         like one is worse than nonsense: it becomes an Invalid Date, which
         compares false against everything without ever throwing, so the
         parent's signature would quietly stop appearing on the registration
         form for a competitor under sixteen. */
      sessionStorage.setItem(KEY, planted)

      renderClock()

      expect(screen.getByTestId('simulirano')).toHaveTextContent('ne')
    },
  )

  it('carries on where the browser refuses to keep anything at all', () => {
    /* Blocked site data, a sandboxed frame, some private windows: reaching the
       store throws rather than returning nothing. This provider stands above
       the router and above the only error boundary there is, so a throw here is
       not a lost date but a blank portal. */
    const blocked = () => {
      throw new Error('SecurityError')
    }

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

    try {
      renderClock()
      fireEvent.change(theDay(), { target: { value: '2026-12-31' } })

      // The day still moves. It just will not survive a reload, which is the
      // better of the two ways to be wrong.
      expect(screen.getByTestId('danas')).toHaveTextContent('2026-12-31')

      fireEvent.change(theDay(), { target: { value: '' } })
      expect(screen.getByTestId('simulirano')).toHaveTextContent('ne')
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('is not read in a production build', () => {
    /* The switch is not there to have written it, so anything in that slot was
       put there by hand. It moves nothing. */
    sessionStorage.setItem(KEY, '2026-12-31')
    vi.stubEnv('DEV', false)

    renderClock()

    expect(screen.getByTestId('danas')).toHaveTextContent(realToday())

    vi.unstubAllEnvs()
  })

  it('is not written in a production build either', async () => {
    const user = setupUser()
    vi.stubEnv('DEV', false)

    renderClock()
    await user.click(screen.getByRole('button', { name: 'pomeri' }))

    // The clock moves, because that is the provider doing its work. Nothing is
    // left behind, so the next visit to that tab starts on the real day.
    expect(screen.getByTestId('danas')).toHaveTextContent('2027-05-05')
    expect(sessionStorage.getItem(KEY)).toBeNull()

    vi.unstubAllEnvs()
  })

  it('starts on the day a test asked for, whatever the tab remembers', () => {
    sessionStorage.setItem(KEY, '2026-12-31')

    renderClock('2027-03-01')

    expect(screen.getByTestId('danas')).toHaveTextContent('2027-03-01')
  })
})
