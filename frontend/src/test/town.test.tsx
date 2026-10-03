import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { renderAt } from './render'
import { serverThat } from './serverAnswers'
import { typeATownTheCodebookKnows } from './town'
import { setupUser } from './user'

/**
 * THE HELPER TWENTY ONE CASES NOW LEAN ON, HELD TO THE ONE THING IT PROMISES: it does not come
 * back before the country is there.
 *
 * <p><b>Measured on 03.10.2026, and it is why this file exists.</b> With the wait taken out of
 * `typeATownTheCodebookKnows`, all seventeen cases of the branch that wrote it stayed green. On
 * the machine it was written on the country was already there by the time the next line asked for
 * it (typing and waiting together took 126 to 297 ms for five towns), so nothing could tell a
 * helper that waits from one that does not. A wait that nothing needs on one machine is a wait
 * that is needed on a faster one, and a helper whose whole reason for being is the wait cannot be
 * left to the speed of the runner to prove it.
 *
 * <p><b>So the codebook is made slow here</b>, by a server of this case's own: six hundred
 * milliseconds, which is longer than the typing and shorter than the four seconds the helper
 * gives it. What is read when it comes back is the select itself and nothing else, and read at
 * once: a helper that returned early finds it empty, and one that waits for anything but the
 * value finds it empty too.
 */
describe('typing a town the codebook knows', () => {
  it('does not come back before the codebook has written the country', async () => {
    const codebook = readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'places.json'))
    const server = serverThat((path) =>
      path === '/api/places'
        ? new Promise<Response>((answer) => {
            setTimeout(() => {
              answer(
                new Response(codebook, {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                }),
              )
            }, 600)
          })
        : null,
    )

    try {
      const user = setupUser()

      renderAt('/sr/novi-tim', 'competitor', '000002', undefined, '2026-10-15')
      await user.type(await screen.findByLabelText(/Naziv tima/), 'Probni tim')

      /* Empty before, so that what is read after is the codebook's doing and not a country that
         was already standing there. */
      expect(screen.getByLabelText(/^Država/)).toHaveValue('')

      await typeATownTheCodebookKnows(user, 'Kranj', 'SI')

      expect(screen.getByLabelText(/^Država/)).toHaveValue('SI')
    } finally {
      server.stop()
    }
  })
})
