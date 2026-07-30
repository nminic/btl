import type { ReactElement } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import type { Need } from './needs'
import { useMay } from './rights'
import '../member/Member.css'

/**
 * The door on every administrative screen, and the only one there is.
 *
 * It is fitted by the route table (routeObjects.tsx) rather than by the screens,
 * so a screen cannot be written without one and cannot lose one by being
 * rewritten. In the prototype the role comes from the switch; the server will
 * decide later, and this check is never the boundary that matters.
 *
 * A refusal says which refusal it is, because the three are not the same fact
 * and a moderator who reads the wrong one draws the wrong conclusion:
 *
 * - Not administration at all, which is what a competitor sees.
 * - Moderators, the one entity a moderator may not open (PDL P21). The ordinary
 *   sentence names moderators as the people who *do* see administration, so a
 *   moderator reading it here would take it for a fault.
 * - A right the superadmin has not given him. That one has to name the right, in
 *   the same words the box in the matrix carries, because it is what he has to
 *   go and ask for. "This is not for you" would send him to report a bug.
 */
function Refused({
  titleKey,
  noteKey,
  params,
}: {
  titleKey: string
  noteKey: string
  params?: Record<string, string>
}) {
  const { t } = useI18n()

  return (
    <div className="member">
      <h1>{t(titleKey)}</h1>
      <p className="member__note">{t(noteKey, params)}</p>
    </div>
  )
}

export function Guard({ need, children }: { need: Need; children: ReactElement }) {
  const { t } = useI18n()
  const { role } = useRole()
  const may = useMay()

  if (!isStaff(role)) {
    return <Refused titleKey="admin.notAllowed" noteKey="admin.notAllowedText" />
  }

  if (need.of === 'superadmin' && role !== 'superadmin') {
    return <Refused titleKey="admin.notAllowed" noteKey="admin.moderatorsClosed" />
  }

  if (need.of === 'right' && !may(need.right.key)) {
    return (
      <Refused
        titleKey="admin.rightMissing"
        noteKey="admin.rightMissingText"
        params={{ action: t(need.right.actionKey) }}
      />
    )
  }

  return children
}
