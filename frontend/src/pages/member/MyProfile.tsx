import { Navigate, useLocation } from 'react-router'
import { Loader } from '../../components/Loader'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { useMemberScreen } from './memberScreen'

/* NOT A SCREEN ANY MORE, ONLY A WAY TO HIS OWN PUBLIC ADDRESS (owner, 16.11.2026, PDL P11, „Moj profil
 * vodi na javnu adresu člana”): „Ne treba mi da postoji moj-profil adresa, nego da uvek otvori onu koju
 * moze lako da share-uje drugima kako smo danas vec napravili?”
 *
 * The address stays because something may still lead here - a bookmark made before, a link somebody
 * sent, the sign in page, which sends a member here when there is nowhere else to go back to - and each
 * of them lands on his profile at `/takmicar/<number>-<name>` with the mark of his card in the address
 * (`profile/CardMarkInTheAddress.tsx`). Sent by the number, and the profile page moves him on to the
 * one canonical spelling itself (`redirectTo`), so the rule of that address keeps one home. Both moves
 * are in place, so the way back is one step.
 *
 * Whoever may not have a profile of his own here is answered exactly as before, by the one hook that
 * answers it (`memberScreen.tsx`): a visitor, somebody who has not paid, and an account with no
 * competitor record.
 *
 * **And nobody is sent anywhere before the server has said who is reading.** The decision is the one of
 * 29.09.2026 for the addresses of the administration (PDL, „Čuvar ne preusmerava dok server ne kaže ko
 * čita”), which `CompetitorProfile` carries to a hidden profile; carried here the same way, as a
 * derivation and not a new word of the owner's. A screen drawn off a number follows the session when the answer changes it; a move to
 * another address is made once and stays made, so made off a number the answer is about to take away
 * it would leave the reader on a stranger's profile. The portal's own indicator stands for that moment. */
export function MyProfile() {
  const { locale } = useI18n()
  const { search } = useLocation()
  const { theServerHasAnswered } = useSession()
  const who = useMemberScreen()

  if (who.memberNumber === null) {
    return who.instead
  }

  if (!theServerHasAnswered) {
    return <Loader inline={false} />
  }

  return <Navigate to={`/${locale}/takmicar/${who.memberNumber}${search}`} replace />
}
