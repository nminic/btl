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
 * <p>Owner, 22.10.2026 (PDL, „Profil dobija karticu „Podaci""), chosen between offered outcomes with the
 * recommendation: „Tuđe podatke otvara i menja samo moderator sa pravom nad članovima, i admin". And
 * 07.11.2026 (PDL, „Član svojim podacima pristupa iz glavnog menija”): „na svom profilu član vidi samo
 * „Rezultati” i „Priznanja”. Administracija i dalje vidi karticu „Podaci” na strani takmičara." One home
 * for the question, asked by the part of the profile's head that offers the card (`ProfileHead.tsx`) and
 * by the card itself (`CompetitorData.tsx`), so the tab cannot be offered to a reader the card would turn
 * away, or the other way round.
 *
 * <p><b>His own first, whatever his fee and whatever his rights</b>: the card is not offered to him and
 * its address sends him to „Moji podaci", where his data are. A moderator who races, and the superadmin
 * where he races, is HIS on his own profile and not the administration: it is his own profile, and the
 * administration's route refuses a moderator his own record as well (PDL, M7: „moderator ne ispravlja
 * svoj zapis"). The superadmin holds every right there is (`useMay`).
 */
export function useWhoReadsTheData(memberNumber: string | undefined): 'his' | 'administration' | null {
  const { signedIn } = useSession()
  const may = useMay()

  if (signedIn?.as === 'member' && signedIn.memberNumber === memberNumber) {
    return 'his'
  }

  return may(OVER_THE_MEMBERS) ? 'administration' : null
}
