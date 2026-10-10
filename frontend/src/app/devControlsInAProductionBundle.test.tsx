import { screen } from '@testing-library/react'
import { renderAt } from '../test/render'

/* A production bundle, as the header meets it: the constant is off and there is no loader.

   The FUNCTION is left saying yes, on purpose and against what any real build could do. The
   two switches still ask it before drawing themselves, so with it saying no their absence
   would come from either of two places - the header not loading them, or each of them
   declining to draw - and a header that had gone back to importing them would pass. With it
   saying yes, only the first is left to explain an empty row. */
vi.mock('../dev/tools', () => ({
  devToolsEnabled: () => true,
  DEV_TOOLS_IN_THIS_BUILD: false,
  loadTheDevControls: null,
}))

describe('the header of a production bundle', () => {
  it('draws neither development control, whatever the function would answer', async () => {
    renderAt('/sr')

    /* The row the two would stand in, drawn: an empty row is not the same as no header. */
    expect(await screen.findByRole('button', { name: 'Jezik' })).toBeVisible()

    expect(screen.queryByLabelText('Uloga')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Današnji datum')).not.toBeInTheDocument()
  })
})
