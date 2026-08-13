import type { Moderator } from '../data/types'
import { dataOr, useModerators } from '../data/useResource'
import { devToolsEnabled } from '../dev/tools'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import { ROLES } from './context'
import { initialsOf } from './initials'
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
  const { deletions } = useSession()
  /* Read through the overlay, deletions included. A moderator deleted on the
     screen of moderators must not go on being somebody this switch can become:
     a control that reads as revoking access and does not is worse than none.
     What he holds is read off the record this switch hands over (rights.ts), so
     leaving him selectable would leave every one of his rights standing. */
  const gone = deletions.moderators ?? []
  const moderators = dataOr(useModerators(), []).filter((one) => !gone.includes(one.id))

  return (
    <div className="role-switch">
      {/* The word that used to stand beside it is gone (owner, 30.07.2026): the
          header carries names of places, not labels of controls, and the chosen
          role is written inside the control anyway. The name it is still known
          by is on the control itself, so a screen reader and a hover both get
          it. */}
      <select
        id="role-switch"
        className="role-switch__select"
        aria-label={t('role.label')}
        title={t('role.label')}
        value={moderator === null ? role : optionFor(moderator)}
        onChange={(event) => {
          const chosen = moderators.find((one) => optionFor(one) === event.target.value)

          if (chosen !== undefined) {
            become('moderator', chosen)
            return
          }

          /* Looked for rather than declared. Every option this control draws is
             either a moderator or one of ROLES, so the word coming back is a
             role; saying so with an assertion (ADL A14) meant that a value from
             anywhere else was passed on as a role and became one. */
          const role = ROLES.find((one) => one === event.target.value)

          if (role !== undefined) {
            become(role)
          }
        }}
      >
        {ROLES.map((option) =>
          option === 'moderator' ? (
            /* A group rather than an entry, because becoming "a moderator" is
               not something anybody can be: every one of them may something
               different. */
            <optgroup key={option} label={t('role.moderator')}>
              {moderators.map((one) => (
                <option key={one.id} value={optionFor(one)} title={`${one.firstName} ${one.lastName}`}>
                  {initialsOf(one)}
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
  if (!devToolsEnabled()) {
    return null
  }

  return <RoleChooser />
}
