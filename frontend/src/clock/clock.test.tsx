import { fireEvent, render, screen } from '@testing-library/react'
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

  it('ignores anything in that slot that is not a day', () => {
    /* The store is the tab's, not ours alone, and a leftover from an older
       shape of this would otherwise be shown as though it were a date. */
    sessionStorage.setItem(KEY, 'juče')

    renderClock()

    expect(screen.getByTestId('simulirano')).toHaveTextContent('ne')
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
