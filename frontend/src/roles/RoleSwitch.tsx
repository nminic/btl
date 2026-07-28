import { useI18n } from '../i18n/useI18n'
import { ROLES, type Role } from './context'
import { roleSwitchEnabled } from './devTools'
import { useRole } from './useRole'
import './RoleSwitch.css'

/* A control for development and for QA. It exists because the member and
 * administration flows have to be walked through and approved before
 * authentication is built, and there is otherwise no way to reach them. It is
 * never rendered in the production build; see devTools.ts. */
export function RoleSwitch() {
  const { t } = useI18n()
  const { role, setRole } = useRole()

  if (!roleSwitchEnabled()) {
    return null
  }

  return (
    <div className="role-switch">
      <label className="role-switch__label" htmlFor="role-switch">
        {t('role.label')}
      </label>
      <select
        id="role-switch"
        className="role-switch__select"
        value={role}
        onChange={(event) => setRole(event.target.value as Role)}
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {t(`role.${option}`)}
          </option>
        ))}
      </select>
    </div>
  )
}
