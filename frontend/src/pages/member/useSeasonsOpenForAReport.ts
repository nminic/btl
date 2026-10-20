import { whatTheServerSaysOfTheSeasonsOpenForAReport } from '../../session/theServer'
import type { ResourceState } from '../../data/useResource'
import { useHeldRead } from './useHeldRead'

/**
 * THE SEASONS THE MEMBER MAY SEND A RUN OF, read off `GET /api/me` for the form that sends one
 * (`session/theServer.ts#whatTheServerSaysOfTheSeasonsOpenForAReport`), held the way `useMyData`
 * holds his data: loading, then the list, or a failure the form says out loud with a way to ask again.
 *
 * @param asked whose form it is, so a reader who changes is asked again rather than shown another's
 */
export function useSeasonsOpenForAReport(asked: number | string): ResourceState<number[]> {
  return useHeldRead(
    whatTheServerSaysOfTheSeasonsOpenForAReport,
    asked,
    'The seasons open for a report could not be read',
  )
}
