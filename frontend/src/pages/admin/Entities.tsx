import { Navigate } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { usePermittedEntities } from './mayOpen'

/**
 * The section has no screen of its own any more (owner, 30.07.2026), so its
 * address opens the first entity this person may work on.
 *
 * What stood here was a row of buttons, one per entity, which meant that opening
 * a second entity was a trip back through this screen every time. They are in
 * the navigation beside every screen of the section now.
 *
 * Where there is nothing to open, the front page, exactly as the door answers
 * the same case (Guard.tsx).
 */
export function Entities() {
  const { locale } = useI18n()
  const entities = usePermittedEntities()
  const first = entities[0]

  return <Navigate to={first === undefined ? `/${locale}` : `/${locale}/${first.path}`} replace />
}
