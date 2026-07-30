import { useMemo } from 'react'
import { useSession } from '../../session/useSession'
import type { Overlay } from './entityForms'

/**
 * Everything administration has changed, as one thing.
 *
 * The prototype has no database, so a change is remembered as an overlay on top
 * of the generated records: what was edited, what was created, what was deleted
 * (session/context.ts). Every list of every entity is read through all three.
 *
 * Handed over whole rather than a field at a time, so a tenth screen cannot read
 * two of them and forget the third. A record somebody deleted going on standing
 * in a list is the kind of fault nobody reports, because it reads as a screen
 * that has not refreshed.
 */
export function useOverlay(): Overlay {
  const { edits, creations, deletions } = useSession()

  return useMemo(() => ({ edits, creations, deletions }), [edits, creations, deletions])
}
