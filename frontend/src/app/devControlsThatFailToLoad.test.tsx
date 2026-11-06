import { screen } from '@testing-library/react'

/* A build that carries the development controls (QA), whose loader is refused: the chunk is
   gone after a deploy, or the connection dropped while it was fetched.

   Everything but the loader says what a development build says, so that the one thing that
   differs from the header every other case draws is the failure. The loader is a rejected
   promise and not a function that throws, because `loadTheDevControls` is an `async`
   function and that is the only way it can fail.

   The console is taken BEFORE the header is imported: the loader is awaited while `Shell` is
   being evaluated, so what is said about its failure is said at import and not when a case
   renders. */
const { REFUSED, said } = vi.hoisted(() => ({
  REFUSED: new Error('Failed to fetch dynamically imported module'),
  said: vi.spyOn(console, 'error').mockImplementation(() => undefined),
}))

vi.mock('../dev/tools', () => ({
  devToolsEnabled: () => true,
  DEV_TOOLS_IN_THIS_BUILD: true,
  loadTheDevControls: () => Promise.reject(REFUSED),
}))

describe('the header of a build whose development controls cannot be loaded (PENDING 28870)', () => {
  it('is drawn all the same, without them, and says in the console what was refused', async () => {
    /* IMPORTED INSIDE THE CASE, and not at the head of the file. `Shell` awaits the loader while it
       is evaluated, so with the `catch` taken out of it (or made to throw on) a static import
       rejects while the file loads and no case starts at all: Vitest reports „no tests”, which is
       neither a pass nor a fail on the assertion, and both mutations went unmeasured. Imported here,
       the same rejection is a thing the case holds in its hand and says in its own words. */
    const drawing = await import('../test/render').catch((failure: unknown) => failure)

    expect(drawing, 'the header did not load when the controls were refused').toHaveProperty(
      'renderAt',
    )

    const { renderAt } = await import('../test/render')

    renderAt('/sr')

    /* The row the two would stand in, drawn: a blank page has no language menu, and that is
       what this build showed before the failure was answered. */
    expect(await screen.findByRole('button', { name: 'Jezik' })).toBeVisible()
    expect(screen.queryByLabelText('Uloga')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Današnji datum')).not.toBeInTheDocument()

    /* Said once and with the reason, so that an absent control on QA is not a mystery. */
    expect(said).toHaveBeenCalledTimes(1)
    expect(said).toHaveBeenCalledWith(expect.stringContaining('development controls'), REFUSED)
  })
})
