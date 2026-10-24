import { MEMBERSHIP_ADDRESS } from '../../app/routes'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'

/**
 * WHERE THE PORTAL SENDS A READER AN ADDRESS IS NOT OPEN TO, when it sends him away rather than
 * saying anything: the front page, and for somebody who registered and has not paid the page he
 * pays on.
 *
 * <p>Owner, 22.10.2026 (PDL, „Član koji još nije platio: bez reči nalog, samo Članarina"), chosen
 * between offered outcomes with the recommendation: „Direktna adresa strane koja mu nije otvorena
 * preusmerava na Članarinu (ne otkriva da strana postoji)." The two doors outside the member area
 * that send a reader to the front page are the door of administration (`pages/admin/Guard.tsx`,
 * which also hangs the league's entry of results) and the card „Podaci" of a profile
 * (`pages/CompetitorData.tsx`); both ask this, so the two cannot send him to different places. The
 * screens of the member area itself are sent by `memberScreen.tsx`, which asks the same question
 * one level up.
 *
 * <p>Read from the session, which the server has answered by the time either door refuses anybody
 * (both wait for it first).
 */
export function useWhereARefusedReaderGoes(): string {
  const { locale } = useI18n()
  const { signedIn } = useSession()

  return signedIn?.as === 'neverPaid' ? `/${locale}/${MEMBERSHIP_ADDRESS}` : `/${locale}`
}
