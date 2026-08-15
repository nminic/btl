import { Link } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { useConsent } from './useConsent'
import './ConsentBar.css'

/**
 * The bar that asks, once, whether measurement with cookies is allowed.
 *
 * What it may and may not do is settled (PDL P8, ADL A9), and every line of it
 * is one of those rules:
 *
 * - Nothing is measured with cookies before „Prihvati" is pressed. The bar does
 *   not decide that; the loader does (`analytics/Analytics.tsx`), and the bar is
 *   only where the answer is given.
 * - There is no „Odbij sve" beside „Prihvati". The owner decided against it on
 *   28.07.2026 with the risk stated. Closing is not consent and is not written
 *   down either, so nothing here can be mistaken for a refusal that was recorded.
 * - Nothing is ticked in advance, because there is nothing to tick: one question,
 *   one button.
 *
 * A `dialog` role would trap the reader in it, and this is not a decision the
 * portal is waiting on: everything on the page works whether it is answered or
 * not. So it is a region with a name, announced politely, and the reader may
 * walk past it. It is last in the markup and drawn at the foot, so a keyboard
 * reaches the page before it reaches the bar.
 */
export function ConsentBar() {
  const { locale, t } = useI18n()
  const { asking, accept, close } = useConsent()

  if (!asking) {
    return null
  }

  return (
    <aside className="consent" aria-label={t('consent.title')}>
      <p className="consent__text">
        {t('consent.text')}{' '}
        <Link className="consent__link" to={`/${locale}/politika-privatnosti`}>
          {t('consent.more')}
        </Link>
      </p>

      <p className="consent__actions">
        <button type="button" className="button button--primary" onClick={accept}>
          {t('consent.accept')}
        </button>
        {/* Named for what it does and not with a bare cross: „Zatvori" is a
            promise this reader can check, and a cross is a promise they have to
            guess at. It leaves the question unanswered, which is why it is the
            quieter of the two. */}
        <button type="button" className="button button--secondary" onClick={close}>
          {t('consent.close')}
        </button>
      </p>
    </aside>
  )
}
