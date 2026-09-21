import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import './Member.css'

/**
 * What a signed in account with no competitor record of its own meets on a competitor's
 * own screen.
 *
 * <p>Beside `SignedOut` and not inside it, because it answers a different question and
 * the two must not be able to be mistaken for one another: that one says nobody is
 * signed in, and here somebody is. Which of the two a screen draws is decided once
 * (`memberScreen.tsx`), and that file carries the reasoning for why there are three
 * answers rather than two.
 *
 * <p>The shape of `SignedOut` and none of its words: a heading, one sentence, and one
 * way onward. The way onward is the front page and not the sign in, because whoever
 * reads this is signed in already and offering them the form is the portal arguing with
 * them.
 */
export function NotRacing() {
  const { locale, t } = useI18n()

  return (
    <div className="member">
      <h1>{t('signIn.noRecord')}</h1>
      <p className="member__note">{t('signIn.noRecordText')}</p>
      <Link className="button button--primary" to={`/${locale}`}>
        {t('shell.home')}
      </Link>
    </div>
  )
}
