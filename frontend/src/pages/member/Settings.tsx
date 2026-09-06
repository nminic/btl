import { Resource } from '../../components/Resource'
import { useCompetitors } from '../../data/useResource'
import { useTheme } from '../../app/useTheme'
import type { Theme } from '../../app/themeContext'
import { useI18n } from '../../i18n/useI18n'
import { NOTIFICATION_KEYS } from '../../session/context'
import { useSession } from '../../session/useSession'
import { BIRTHDAY_SHOWN } from '../../data/types'
import { MEMBERS, recordsOf } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { ProfileBio } from './ProfileBio'
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
  const { memberNumber, notifications, setNotification, editRecord } = useSession()
  const overlay = useOverlay()
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

          if (me === undefined) {
            return null
          }

          /* The picture and the words about oneself, one under the other and
             each going for review on its own (owner, 15.08.2026). */
          return (
            <>
              <ProfilePicture me={me} />
              <ProfileBio me={me} />
            </>
          )
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
        </fieldset>
      </section>

      {/* **What other people see, and the one thing on this screen that is not only the
          reader's own business.** The published privacy policy has promised this control since
          it was written („U podešavanjima možete sakriti profil od posetilaca koji nisu
          prijavljeni"), and until 06.09.2026 nothing in the code answered for it. The owner
          chose the control rather than striking the sentence.

          Read through the overlay rather than off the file, so the box shows what was chosen
          in this visit and not what the data shipped with. */}
      <Resource state={competitors} inline>
        {(everybody) => {
          const me = recordsOf(MEMBERS, everybody, overlay).find(
            (one) => one.memberNumber === memberNumber,
          )

          return me === undefined ? null : (
            <section className="member__panel" aria-labelledby="settings-privacy">
              <h2 className="profile__section" id="settings-privacy">
                {t('settings.privacy')}
              </h2>
              <p className="member__note">{t('settings.hideProfileNote')}</p>

              <div className="field field--checkbox">
                <div className="field__confirm">
                  <input
                    className="field__control"
                    type="checkbox"
                    id="hide-profile"
                    checked={me.profileHidden}
                    onChange={(event) => {
                      /* „true" and „false" as words, because the overlay keeps every value as
                         text and `forms/records.ts` turns them back into the shape the record
                         holds (`like`). */
                      editRecord(memberNumber, {
                        profileHidden: String(event.target.checked),
                      })
                    }}
                  />
                  <label className="field__label" htmlFor="hide-profile">
                    {t('settings.hideProfile')}
                  </label>
                </div>
              </div>

              {/* One question with three answers, not two switches: that is the shape the owner
                  described on 06.09.2026, and radios are how the portal already asks a question
                  with one answer (the theme, above). */}
              <fieldset className="field field--radio">
                <legend className="field__label">{t('settings.birthday')}</legend>
                {BIRTHDAY_SHOWN.map((one) => (
                  <div key={one} className="field__confirm">
                    <input
                      className="field__control"
                      type="radio"
                      name="birthday"
                      id={`birthday-${one}`}
                      value={one}
                      checked={me.birthdayShown === one}
                      onChange={() => {
                        editRecord(memberNumber, { birthdayShown: one })
                      }}
                    />
                    <label className="field__label" htmlFor={`birthday-${one}`}>
                      {t(
                        one === 'none'
                          ? 'settings.birthdayNone'
                          : one === 'year'
                            ? 'settings.birthdayYear'
                            : 'settings.birthdayFull',
                      )}
                    </label>
                  </div>
                ))}
              </fieldset>
              <p className="member__note">{t('settings.birthdayNote')}</p>
            </section>
          )
        }}
      </Resource>

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
