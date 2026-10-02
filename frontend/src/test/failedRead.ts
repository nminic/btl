import type { FailedRead } from '../data/useResource'

/**
 * A READ THAT FAILED, BUILT BY HAND, for the cases that need a state and not a server.
 *
 * <p>Four files built `{ status: 'error', error: … }` out of three fields by hand until the state
 * gained the way to ask again (`FailedRead` in `data/useResource.ts`), and the compiler found each
 * of them. Written once here so that the next field is one place to change and not four, and typed
 * as the very state so that a change to its shape is a build error in this file rather than a case
 * that goes on passing while it proves nothing.
 *
 * <p>The way to ask again is a function that does nothing, and a case that is about it hands in its
 * own (`readAgain`) and says what it counted.
 */
export function aFailedRead(how: Partial<Pick<FailedRead, 'readAgain' | 'reading'>> = {}): FailedRead {
  return {
    status: 'error',
    error: new Error('pukla veza'),
    readAgain: () => undefined,
    reading: false,
    ...how,
  }
}
