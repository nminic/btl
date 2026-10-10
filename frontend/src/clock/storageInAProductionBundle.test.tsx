import { render, screen } from '@testing-library/react'
import { setupUser } from '../test/user'
import { ClockProvider } from './ClockProvider'
import { realToday } from './context'
import { useClock } from './useClock'

/* The slot a moved day is kept in, in a production bundle: the constant is off.

   The FUNCTION is left saying yes, against what any real build could do, so that only the
   constant is left to keep the slot shut. With both saying no, a provider that had gone back
   to asking the function alone would pass here and send its storage code to production
   (dev/tools.ts says how much of it went, measured). */
vi.mock('../dev/tools', () => ({
  devToolsEnabled: () => true,
  DEV_TOOLS_IN_THIS_BUILD: false,
  loadTheDevControls: null,
}))

const KEY = 'btl.simulated-day'

/* A day no run of this suite can fall on, so that reading the real clock and reading the slot
   can never give the same answer and pass for each other. */
const PLANTED = '2001-01-01'

function Reader() {
  const { today, simulate } = useClock()

  return (
    <>
      <span data-testid="danas">{today}</span>
      <button type="button" onClick={() => simulate('2027-05-05')}>
        pomeri
      </button>
    </>
  )
}

describe('the slot a moved day is kept in, in a production bundle', () => {
  it('is not read', () => {
    sessionStorage.setItem(KEY, PLANTED)

    render(
      <ClockProvider>
        <Reader />
      </ClockProvider>,
    )

    expect(screen.getByTestId('danas')).toHaveTextContent(realToday())
  })

  it('is not written either, though the day still moves for the tab it was moved in', async () => {
    const user = setupUser()

    render(
      <ClockProvider>
        <Reader />
      </ClockProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'pomeri' }))

    expect(screen.getByTestId('danas')).toHaveTextContent('2027-05-05')
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })
})
