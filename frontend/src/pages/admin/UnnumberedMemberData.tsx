import { useParams } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { NotFound } from '../NotFound'
import { addressOfTheUnnumbered, TheMembersData } from '../profile/TheMembersData'
import '../Profile.css'
import '../member/Member.css'

/** A key as the server spells one (`MemberDataApi.A_KEY`): anything else names nobody. */
const A_KEY = /^[1-9][0-9]{0,17}$/

/**
 * THE FORM OF A MEMBER'S DATA FOR SOMEBODY WHO REGISTERED AND HAS NO MEMBER NUMBER YET, reached from the
 * pencil on his row of the screen Uplate.
 *
 * <p>Owner, 10.11.2026 (PDL, „Ekran Uplate: izmena podataka pre knjiženja i čišćenje reda"), asked whether
 * the data of somebody newly registered can be edited before his fee is booked: „Može na uplatama. [...]
 * Dodaj ikonicu olovkice kao na redu članova". And, chosen with the recommendation: „Olovčica otvara istu
 * formu kao na redu člana (registraciona, bez lozinke)". So this draws `TheMembersData`, the very component
 * the card „Podaci" draws, and nothing of its own but the page around it.
 *
 * <p><b>The page around it is the card's own for a member the public list does not carry</b>
 * (`CompetitorData.tsx`, `TheCard`): a heading „Podaci" and the form. He has no profile to draw a head
 * from, because he has no number, which is what a profile's address is made of (PDL P11). His picture and
 * his words are not drawn here: the owner asked for the data, and their routes take a member number.
 *
 * <p><b>Who may open it is the door of the screen of the members</b> (`needs.ts`), because the owner chose
 * that the same people correct these data as correct a member's: „admin i moderator sa pravom nad
 * članovima". A moderator holding only the payments sees no pencil (`Payments.tsx`) and is turned away at
 * this address as from any screen he may not open.
 */
export function UnnumberedMemberData() {
  const { competitorId } = useParams()
  const { t } = useI18n()

  /* A KEY SPELT ANY OTHER WAY IS AN ADDRESS THAT IS NOT THERE, here as on the server, and it is never
     handed to `fetch`: a segment such as `..` would be resolved by the browser into some other route. */
  if (competitorId === undefined || !A_KEY.test(competitorId)) {
    return <NotFound />
  }

  return (
    <div className="profile">
      <h1>{t('profile.parts.data')}</h1>
      <TheMembersData address={addressOfTheUnnumbered(competitorId)} />
    </div>
  )
}
