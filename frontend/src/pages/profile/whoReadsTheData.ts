import { useSession } from '../../session/useSession'
import { MEMBERS } from '../admin/entityForms'
import { entityRight, useMay } from '../admin/rights'

/** The box the superadmin ticks for somebody he trusts with the members (`CompetitorApi.OVER_THE_MEMBERS`). */
export const OVER_THE_MEMBERS = entityRight(MEMBERS).key

/** The part of a profile's address the card „Podaci" lives at. */
export const THE_DATA = '/podaci'

/**
 * WHO READS THE CARD „PODACI" OF THIS MEMBER, AND AS WHOM: the member himself, the administration over
 * the members, or nobody.
 *
 * <p>Owner, 22.10.2026 (PDL, „Profil dobija karticu „Podaci""): „koju vidi samo sam član i
 * administracija", and, chosen between offered outcomes with the recommendation, „Tuđe podatke otvara i
 * menja samo moderator sa pravom nad članovima, i admin". One home for the question, asked by the part of
 * the profile's head that offers the card (`ProfileHead.tsx`) and by the card itself
 * (`CompetitorData.tsx`), so the tab cannot be offered to a reader the card would turn away, or the other
 * way round.
 *
 * <p><b>His own first, and only while his fee stands</b>: a member whose fee has lapsed is answered 404 by
 * the route his card writes to (PDL P8, 11.10.2026), so he is nobody here. A moderator who races is HIS
 * here and not the administration, because the administration's route refuses a moderator his own record
 * (PDL, M7: „moderator ne ispravlja svoj zapis"). The superadmin holds every right there is (`useMay`).
 */
export function useWhoReadsTheData(memberNumber: string | undefined): 'his' | 'administration' | null {
  const { signedIn } = useSession()
  const may = useMay()

  if (signedIn?.as === 'member' && signedIn.memberNumber === memberNumber) {
    return signedIn.feeStands ? 'his' : null
  }

  return may(OVER_THE_MEMBERS) ? 'administration' : null
}
