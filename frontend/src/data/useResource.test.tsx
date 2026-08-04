import { render, screen, waitFor } from '@testing-library/react'
import { useResource } from './useResource'
import type { ResourceName } from './client'

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
 * exactly what that window is.
 */
const held = { value: undefined as unknown }
let asked = 0

vi.mock('./client', () => ({
  RESOURCE_NAMES: ['competitors'],
  arrivedResource: () => {
    asked += 1
    /* Nothing the first time it is asked, which is the render; the value from
       then on, which is the effect and everything after it. */
    return asked === 1 ? undefined : held.value
  },
  loadResource: () => Promise.resolve(held.value),
  clearResourceCache: () => undefined,
}))

function Screen({ name }: { name: ResourceName }) {
  const state = useResource<string[]>(name)

  return <p>{state.status === 'ready' ? state.data.join(', ') : state.status}</p>
}

describe('a value that lands between a render and its effect', () => {
  beforeEach(() => {
    asked = 0
    held.value = ['Ana', 'Bojan']
  })

  it('reaches the screen rather than leaving it waiting for ever', async () => {
    render(<Screen name="competitors" />)

    /* The render saw nothing, so it drew a loading box; the effect saw the value.
       An effect allowed to return because the value had already arrived would
       leave the screen on that box with nothing scheduled to take it off, and
       this is where it would sit for ever.

       The loading state itself is not asserted, and cannot be: `render` flushes
       the effects before it hands back, so what is on the screen by then is
       already the answer. What is asserted is that an answer comes at all. */
    await waitFor(() => expect(screen.getByText('Ana, Bojan')).toBeVisible())
  })

  it('answers the resource it is asked about now, not the one it was asked about', async () => {
    /* The state is worked out once, as the hook mounts. Asked about another
       resource it has to be worked out again, or the screen draws the first
       one's data under the second one's name and calls it ready. */
    const { rerender } = render(<Screen name="competitors" />)

    await waitFor(() => expect(screen.getByText('Ana, Bojan')).toBeVisible())

    held.value = ['Dunavski trkači']
    rerender(<Screen name="teams" />)

    expect(screen.queryByText('Ana, Bojan')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Dunavski trkači')).toBeVisible())
  })
})
