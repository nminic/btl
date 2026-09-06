import { useI18n } from '../../i18n/useI18n'

/**
 * What a reader who is not signed in meets on a profile its owner has hidden.
 *
 * The name stays, because the reader followed it here from a table where it also stays: what
 * the member hid is the page, not themselves. Said in its own words rather than answered with
 * „no such competitor", which would be untrue to somebody who arrived by that very name, and
 * would leave them with nothing to do about it.
 */
export function ProfileHidden({ name }: { name: string }) {
  const { t } = useI18n()

  return (
    <div className="member">
      <h1>{name}</h1>
      <p className="member__note">{t('profile.hidden')}</p>
      <p className="member__note">{t('profile.hiddenSignIn')}</p>
    </div>
  )
}
