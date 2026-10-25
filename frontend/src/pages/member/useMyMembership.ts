import type { ResourceState } from '../../data/useResource'
import { whatIOwe, type MyMembership } from './myMembership'
import { useHeldRead } from './useHeldRead'

/**
 * What he sends for the season on sale, held as a read of its own, keyed by whose read it is: the
 * same shape `useMyBalance` has beside it, for the reason `useHeldRead` gives.
 */
export function useMyMembership(asked: number | string): ResourceState<MyMembership> {
  return useHeldRead(whatIOwe, asked, 'What he owes could not be read')
}
