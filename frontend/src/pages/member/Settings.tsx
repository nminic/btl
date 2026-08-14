import { Resource } from '../../components/Resource'
import { useCompetitors } from '../../data/useResource'
import { useTheme } from '../../app/useTheme'
import type { Theme } from '../../app/themeContext'
import { useI18n } from '../../i18n/useI18n'
import { NOTIFICATION_KEYS } from '../../session/context'
import { useSession } from '../../session/useSession'
import { ProfilePicture } from './ProfilePicture'
import { SignedOut } from './SignedOut'
import './Member.css'

const THEMES: Theme[] = ['dark', 'light']

/* Where the cog in the header leads. The theme switch used to sit in the
 * header; it moved here because the header is for getting around the portal,
 * and a control you press once a year does not belong next to the ones you
 * press every visit (PDL P28a). */
export function Settings() {
  const { t } = useI18n()
  const { memberNumber, notifications, setNotification } = useSession()
  const { theme, choose } = useTheme()
  /* Above the early return, because a hook is: called after it, the order of
     hooks changes between a signed in reader and a signed out one. */
  const competitors = useCompetitors()

  if (memberNumber === null) {
    return <SignedOut />
  }

  return (
    <div className="member">
      <h1>{t('settings.title')}</h1>
      <p className="member__note">{t('settings.intro')}</p>

      {/* First, because it is the only thing on this screen other people see.
          The theme and the notifications are the reader's own business; the
          picture is what the league sees beside their name. */}
      <Resource state={competitors} inline>
        {(competitors) => {
          const me = competitors.find((one) => one.memberNumber === memberNumber)

          return me === undefined ? null : <ProfilePicture me={me} />
        }}
      </Resource>

      <section className="member__panel" aria-labelledby="settings-appearance">
        <h2 className="profile__section" id="settings-appearance">
          {t('settings.appearance')}
        </h2>

        <fieldset className="field field--radio">
          <legend className="field__label">{t('settings.themeLabel')}</legend>
          {THEMES.map((one) => (
            <div key={one} className="field__confirm">
              <input
                className="field__control"
                type="radio"
                name="theme"
                id={`theme-${one}`}
                value={one}
                checked={theme === one}
                onChange={() => choose(one)}
              />
              <label className="field__label" htmlFor={`theme-${one}`}>
                {t(one === 'dark' ? 'settings.themeDark' : 'settings.themeLight')}
              </label>
            </div>
          ))}
          <p className="member__note">{t('settings.themeHint')}</p>
        </fieldset>
      </section>

      <section className="member__panel" aria-labelledby="settings-notifications">
        <h2 className="profile__section" id="settings-notifications">
          {t('settings.notifications')}
        </h2>
        <p className="member__note">{t('myProfile.notificationsNote')}</p>

        {NOTIFICATION_KEYS.map((key) => (
          <div key={key} className="field field--checkbox">
            <div className="field__confirm">
              <input
                className="field__control"
                type="checkbox"
                id={`notify-${key}`}
                checked={notifications[key]}
                onChange={(event) => setNotification(key, event.target.checked)}
              />
              <label className="field__label" htmlFor={`notify-${key}`}>
                {t(`myProfile.notify.${key}`)}
              </label>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
