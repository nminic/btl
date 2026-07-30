import { Navigate } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { usePermittedQueues } from './mayOpen'

/**
 * The section has no screen of its own any more (owner, 30.07.2026), so its
 * address opens the first queue the moderator may work in.
 *
 * What stood here was a list of the eight queues, and then a page explaining why
 * each exists. Both were a stop on the way to the work: the queues are in the
 * navigation beside every screen of the section, so the way in is a screen
 * nobody would choose to stay on.
 *
 * Where there is nothing to open, the front page. That is somebody who reached
 * this address without a single queue of their own, which is the same case the
 * door answers the same way (Guard.tsx).
 */
export function Verification() {
  const { locale } = useI18n()
  const queues = usePermittedQueues()
  const first = queues[0]

  return <Navigate to={first === undefined ? `/${locale}` : `/${locale}/${first.path}`} replace />
}
