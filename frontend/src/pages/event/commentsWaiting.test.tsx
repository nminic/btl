import { screen } from '@testing-library/react'
import { renderAt } from '../../test/render'

/**
 * What the foot of an event does while its comments are on their way.
 *
 * An event still to be run draws no comments section at all, so it must not
 * hold a box open for one either: the reader would watch a space that resolves
 * into nothing, and on a broken connection an alert about a part that was never
 * going to be drawn. The results above it answer the same question the same way
 * (EventDetail.tsx).
 *
 * The comments are made to stay on their way, because the state cannot be
 * caught by hand: the section mounts only after the event itself has arrived,
 * and by then the file is read off the disc and settled. Only this resource is
 * held; everything else on the screen loads as it does.
 */
vi.mock('../../data/useResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/useResource')>()),
  useComments: () => ({ status: 'loading' }) as const,
}))

const RAN = 'fruskogorski-maraton-2010-05-08'
const AHEAD = 'podgoricka-desetka-2027-01-30'
const BEFORE = '2026-12-31'

describe('an event whose comments have not arrived', () => {
  it('holds a box open where the race has been run', async () => {
    renderAt(`/sr/kalendar/${RAN}`, 'visitor', null, undefined, BEFORE)

    expect(await screen.findByText('Učitavanje: Komentari')).toBeVisible()
  })

  it('holds none where it has not', async () => {
    renderAt(`/sr/kalendar/${AHEAD}`, 'visitor', null, undefined, BEFORE)

    /* Waited for by something else on the screen, so the check is made after
       the event itself has arrived and the section would have been drawn. */
    await screen.findByRole('heading', { level: 2, name: 'Trke' })

    expect(screen.queryByText('Učitavanje: Komentari')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Komentari' })).toBeNull()
  })
})
