import { render, screen, waitFor } from '@testing-library/react'
import { useResource } from './useResource'

/* The one thing about this hook that no screen test can see, and that broke a
 * screen the first time it was written: what happens when the value a resource
 * holds lands between a render and the effect that render schedules.
 *
 * The hook reads what the data layer already holds while it renders, so a screen
 * opened a second time is its full height from the first paint, which is what
 * lets the router put a scroll position back into it. A first version of that
 * also skipped the fetch when the value was in hand, to save a render. That left
 * one case with no way out: the render looked, saw nothing, and drew a loading
 * box; the effect looked, saw the value, and returned without setting anything;
 * and nothing was ever scheduled to take the screen off that box.
 *
 * The window is a real one, because effects run through the scheduler while the
 * answer to a fetch lands in a microtask. Staged here by giving the module that
 * holds the values one answer for the render and another for the effect, which is
 * exactly what that window is. Nothing drawn on a screen can stage it, because
 * the real `arrivedResource` is a plain read of a map and there is no moment
 * between those two in which a test can reach in.
 *
 * That the second visit is whole from the first render is held elsewhere, on a
 * real screen: src/app/newScreen.test.tsx.
 */
const HELD = ['Ana', 'Bojan']
let asked = 0

vi.mock('./client', () => ({
  arrivedResource: () => {
    asked += 1
    /* Nothing the first time it is asked, which is the render; the value from
       then on, which is the effect and everything after it. */
    return asked === 1 ? undefined : HELD
  },
  loadResource: () => Promise.resolve(HELD),
  clearResourceCache: () => undefined,
}))

function Screen() {
  const state = useResource<string[]>('competitors')

  return <p>{state.status === 'ready' ? state.data.join(', ') : state.status}</p>
}

describe('a value that lands between a render and its effect', () => {
  beforeEach(() => {
    asked = 0
  })

  it('reaches the screen rather than leaving it waiting for ever', async () => {
    render(<Screen />)

    /* The render saw nothing, so it drew a loading box; the effect saw the value.
       An effect allowed to return because the value had already arrived would
       leave the screen on that box with nothing scheduled to take it off, and
       this is where it would sit for ever.

       The loading state itself is not asserted, and cannot be: `render` flushes
       the effects before it hands back, so what is on the screen by then is
       already the answer. What is asserted is that an answer comes at all. */
    await waitFor(() => expect(screen.getByText('Ana, Bojan')).toBeVisible())
  })
})
