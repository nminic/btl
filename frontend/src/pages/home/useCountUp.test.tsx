import { render, screen } from '@testing-library/react'
import { useCountUp } from './useCountUp'

function Probe({ target }: { target: number }) {
  return <span data-testid="value">{useCountUp(target)}</span>
}

/** Runs exactly one frame, at a moment the caller chooses, and no more. Firing
 *  every request would recurse forever, since a frame short of the end asks for
 *  the next one. */
function withSingleFrame(msFromNow: number, run: () => void) {
  const original = window.requestAnimationFrame
  let fired = false

  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    if (!fired) {
      fired = true
      callback(performance.now() + msFromNow)
    }

    return 1
  }) as typeof requestAnimationFrame

  try {
    run()
  } finally {
    window.requestAnimationFrame = original
  }
}

describe('useCountUp', () => {
  it('lands exactly on the target once the time is up', () => {
    // Well past the end of the animation, so this is the final frame.
    withSingleFrame(10_000, () => {
      render(<Probe target={1234} />)
    })

    expect(screen.getByTestId('value')).toHaveTextContent('1234')
  })

  it('is still on the way there in the middle', () => {
    withSingleFrame(100, () => {
      render(<Probe target={1000} />)
    })

    const value = Number(screen.getByTestId('value').textContent)
    expect(value).toBeGreaterThan(0)
    expect(value).toBeLessThan(1000)
  })

  it('hands over the number at once when less motion was asked for', () => {
    const previous = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
    })) as typeof matchMedia

    render(<Probe target={77} />)

    expect(screen.getByTestId('value')).toHaveTextContent('77')
    window.matchMedia = previous
  })
})

it('lands on the number even in a tab that is never drawn', async () => {
  const original = window.requestAnimationFrame
  // A background tab gets no frames at all.
  window.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame

  render(<Probe target={512} />)
  expect(screen.getByTestId('value')).toHaveTextContent('0')

  expect(await screen.findByText('512', {}, { timeout: 3000 })).toBeVisible()
  window.requestAnimationFrame = original
})
