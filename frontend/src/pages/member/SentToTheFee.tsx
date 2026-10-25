import { Navigate } from 'react-router'
import { MEMBERSHIP_ADDRESS } from '../../app/routes'
import { useI18n } from '../../i18n/useI18n'

/**
 * WHAT SOMEBODY WHO REGISTERED AND HAS NOT PAID MEETS AT A SCREEN OF A MEMBER'S THAT IS NOT OPEN TO
 * HIM YET: the page he pays on.
 *
 * <p>Owner, 22.10.2026 (PDL, „Član koji još nije platio: bez reči nalog, samo Članarina"): „Sve
 * opcije koje mu nisu dostupne privremeno (dakle sve osim Članarine) ne treba da mu uopšte budu
 * dostupne", and „Kad kažem dostupne, mislim vidljive niti deep linkom dostupne." The address of a
 * page that is not open to him sends him to „Moja članarina", chosen by the owner between offered
 * outcomes with the recommendation: it does not tell him that the page exists. It was a screen with
 * a heading, a sentence and a button (`NotAMemberYet`, until 23.10.2026), and that was the one
 * thing the owner asked to take away: a page that says it is shut is a page that is there.
 *
 * <p>**Replaced rather than pushed**, so the Back button goes where he came from instead of back
 * onto an address that sends him on again.
 *
 * <p>Which screen draws this is decided once (`memberScreen.tsx`), and `oneQuestion.test.tsx`
 * requires that this is the only module that names it, for the reason it gives about the three
 * sentences beside it: a screen deciding by itself that somebody has not paid is a second home for
 * one fact.
 */
export function SentToTheFee() {
  const { locale } = useI18n()

  return <Navigate to={`/${locale}/${MEMBERSHIP_ADDRESS}`} replace />
}
