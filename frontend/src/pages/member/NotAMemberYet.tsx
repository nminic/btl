import { Link } from 'react-router'
import { MEMBERSHIP_ADDRESS } from '../../app/routes'
import { useI18n } from '../../i18n/useI18n'
import './Member.css'

/**
 * What somebody who registered and has not paid meets on a screen of a member's that is not
 * open to him yet: his results, his messages, his profile, a result to send, a team to propose
 * or edit, an event to rate or report on.
 *
 * <p>Beside `NotRacing` and not inside it, because it answers a different question and the two
 * must not be able to be mistaken for one another: that one says the account has no competitor
 * record at all (a moderator, a superadmin), and this one is said to somebody who HAS one and
 * has not been given a number. Which of the two a screen draws is decided once
 * (`memberScreen.tsx`), and that file carries the reasoning for why there are three answers
 * rather than two.
 *
 * <p>The shape of `NotRacing` and none of its words: a heading, one sentence, and one way
 * onward. The way onward is the page he pays on and not the front page, because that is the only
 * thing he can do that opens the rest (PDL P8, „Šta sme neplaćen član", 10.10.2026: he may pay and
 * choose his category, and may not do anything that makes him visible or puts him in the league)
 * and a link to the front page would leave him looking for it.
 */
export function NotAMemberYet() {
  const { locale, t } = useI18n()

  return (
    <div className="member">
      <h1>{t('membership.notYetTitle')}</h1>
      <p className="member__note">{t('membership.notYetText')}</p>
      <Link className="button button--primary" to={`/${locale}/${MEMBERSHIP_ADDRESS}`}>
        {t('nav.membership')}
      </Link>
    </div>
  )
}
