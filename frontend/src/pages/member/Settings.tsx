import { Resource } from '../../components/Resource'
import { useCompetitors } from '../../data/useResource'
import { useTheme } from '../../app/useTheme'
import type { Theme } from '../../app/themeContext'
import { useI18n } from '../../i18n/useI18n'
import { NOTIFICATION_KEYS, recordKey } from '../../session/context'
import { useSession } from '../../session/useSession'
import { MEMBERS, recordsOf } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { ChangePassword } from './ChangePassword'
import { PersonalData } from './PersonalData'
import { ProfileBio } from './ProfileBio'
import { ProfilePicture } from './ProfilePicture'
import { useMemberScreen } from './memberScreen'
import './Member.css'

const THEMES: Theme[] = ['dark', 'light']

/* Where the cog in the header leads. The theme switch used to sit in the
 * header; it moved here because the header is for getting around the portal,
 * and a control you press once a year does not belong next to the ones you
 * press every visit (PDL P28a). */
export function Settings() {
  const { t } = useI18n()
  const { notifications, setNotification, editRecord } = useSession()
  const who = useMemberScreen()
  const overlay = useOverlay()
  const { theme, choose } = useTheme()
  /* Above the early return, because a hook is: called after it, the order of
     hooks changes between a signed in reader and a signed out one. */
  const competitors = useCompetitors()

  if (who.memberNumber === null) {
    return who.instead
  }

  const { memberNumber } = who

  return (
    <div className="member">
      <h1>{t('settings.title')}</h1>
      <p className="member__note">{t('settings.intro')}</p>

      {/* First, because this is the part of the screen other people see. The theme
          and the notifications are the reader's own business; a name, a town and a
          picture are what the league sees beside each other.

          The order inside it is the order of how much a thing is HIS: his own data
          first, which he changes himself and which takes effect at once (PDL P28b,
          1); then the two that go to a moderator before anybody else sees them. The
          sentence here said „the picture is the only thing other people see" until
          24.09.2026, which was true while a name could not be edited from this
          screen and stopped being true in the same commit that let it. */}
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
              <PersonalData me={me} />
              <ProfilePicture me={me} />
              <ProfileBio me={me} />
            </>
          )
        }}
      </Resource>

      {/* Outside the block above, because it asks nothing of the member record: a
          password belongs to the ACCOUNT, and an account that races and one that only
          moderates have one each. It is drawn after the profile and before the
          preferences for the same reason the personal data is drawn first - this is
          the part of the screen that is about the account itself rather than about
          how it likes to be shown. */}
      <ChangePassword />

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
                      editRecord(recordKey(MEMBERS.id, memberNumber), {
                        profileHidden: String(event.target.checked),
                      })
                    }}
                  />
                  <label className="field__label" htmlFor="hide-profile">
                    {t('settings.hideProfile')}
                  </label>
                </div>
              </div>

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
