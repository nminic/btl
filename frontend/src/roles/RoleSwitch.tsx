import type { Moderator } from '../data/types'
import { dataOr, useModerators } from '../data/useResource'
import { devToolsEnabled } from '../dev/tools'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import { ROLES } from './context'
import { initialsOf } from './initials'
import { useRole } from './useRole'
import './RoleSwitch.css'

/* A control for development and for QA. It is never rendered in the production build;
 * see devTools.ts.
 *
 * It said „it exists because there is otherwise no way to reach them" until 20.09.2026,
 * and that is no longer the reason: `/api/sign-in` exists, and a real session sets the
 * role through the same `become` this control calls (pages/member/SignIn.tsx). WHAT
 * KEEPS IT IS THE MOCK. Every screen behind these roles draws members, teams and
 * results out of `/mock` (data/client.ts), and a real account has no member number to
 * read them by - `MeApi` carries none on purpose. So signing in really reaches the
 * portal and this control is still the only way to reach the member whose results are
 * on it. The two go off together, when ADL A50 says the mock does.
 *
 * WHICH WAY THE TWO OF THEM WIN OVER EACH OTHER, written down because since 20.09.2026
 * there are two and nothing said. THE SWITCH OVERTURNS WHAT THE SERVER SAID, in both
 * directions and by construction: it calls `become` with whatever was chosen, which is
 * the same setter `GET /api/me` is written through (`RoleProvider`), and a member number
 * chosen here wins in the session too, because `signedIn` reads it before the account
 * (`session/SessionProvider.tsx`). So a developer who signs in as a moderator and picks
 * „Posetilac" is a visitor on every screen while the cookie in the browser goes on
 * opening everything on the server.
 *
 * <b>Nothing is gained by that and nothing can be</b>, which is why it is a boundary
 * rather than a hole. The server never reads any of this: it decides from the cookie,
 * route by route (`ApiSecurity`). And the only place a visitor could reach this control
 * is one where it is not built at all - `devToolsEnabled()` is false in the production
 * bundle, so what the switch can overturn there is nothing (dev/tools.ts).
 * What it does buy is the thing it exists for: the portal can be walked as a member of
 * the mock while a real session stands behind it.
 *
 * <b>The one thing it will not do is un-say a real session.</b> A role chosen here does
 * not sign anybody out, and neither does the question asked above every screen sign
 * anybody in or out of what was chosen here (session/useTheServersSession.ts).
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
  const moderators = dataOr(useModerators(), []).filter((one) => !gone.includes(String(one.id)))

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
              {/* A CHOICE FOR THE MODERATOR THE SERVER NAMED, who is on no list here.
                  `GET /api/me` answers a role and no record (MeApi), so a real
                  moderator session leaves `moderator` null and the value below is the
                  bare word „moderator" - which this group is a LABEL for and never an
                  option. A select whose value matches no option draws its first one, so
                  the control read „Posetilac" above a signed in moderator: a
                  development tool telling the developer the opposite of the one thing
                  it is there to show. Drawn only in that state, and choosing it leads
                  back to it, so nothing new can be become by it. */}
              {role === 'moderator' && moderator === null && (
                <option value="moderator">{t('server.named')}</option>
              )}
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
