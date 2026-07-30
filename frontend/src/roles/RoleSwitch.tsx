import type { Moderator } from '../data/types'
import { dataOr, useModerators } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { ROLES, type Role } from './context'
import { roleSwitchEnabled } from './devTools'
import { useRole } from './useRole'
import './RoleSwitch.css'

/* A control for development and for QA. It exists because the member and
 * administration flows have to be walked through and approved before
 * authentication is built, and there is otherwise no way to reach them. It is
 * never rendered in the production build; see devTools.ts.
 *
 * Moderator is not one choice on it but as many as there are moderators, because
 * "a moderator" is not a person whose rights can be looked up: the superadmin
 * gives each of them a different set (PDL P21), so what a limited moderator
 * actually runs into is only visible from inside one of them. That is the whole
 * point of the screen the owner walks through, and until the switch could name
 * one, the matrix of rights had nobody to belong to.
 */

/** The value a choice carries. Prefixed rather than the bare id, so a moderator
 *  whose id happened to read "visitor" could not quietly become one. */
function optionFor(moderator: Moderator): string {
  return `moderator:${moderator.id}`
}

function RoleChooser() {
  const { t } = useI18n()
  const { role, moderator, become } = useRole()
  /* Read for what it is worth rather than waited for: this sits in the header
     above every screen, and a development control must never be what holds a
     page up. Until it arrives the list of moderators is empty and the other
     three choices work. */
  const moderators = dataOr(useModerators(), [])

  return (
    <div className="role-switch">
      <label className="role-switch__label" htmlFor="role-switch">
        {t('role.label')}
      </label>
      <select
        id="role-switch"
        className="role-switch__select"
        value={moderator === null ? role : optionFor(moderator)}
        onChange={(event) => {
          const chosen = moderators.find((one) => optionFor(one) === event.target.value)

          if (chosen === undefined) {
            become(event.target.value as Role)
            return
          }

          become('moderator', chosen)
        }}
      >
        {ROLES.map((option) =>
          option === 'moderator' ? (
            /* A group rather than an entry, because becoming "a moderator" is
               not something anybody can be: every one of them may something
               different. */
            <optgroup key={option} label={t('role.moderator')}>
              {moderators.map((one) => (
                <option key={one.id} value={optionFor(one)}>
                  {`${one.firstName} ${one.lastName}`}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={option} value={option}>
              {t(`role.${option}`)}
            </option>
          ),
        )}
      </select>
    </div>
  )
}

/* Split in two so the production build asks for nothing. A hook cannot be
 * called behind a condition, so a single component would fetch the moderators
 * on every screen of a portal that never draws this control. */
export function RoleSwitch() {
  if (!roleSwitchEnabled()) {
    return null
  }

  return <RoleChooser />
}
