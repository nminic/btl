import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { MY_DATA_ADDRESS } from '../app/routes'
import { Loader } from '../components/Loader'
import { Resource } from '../components/Resource'
import { pairsNow } from '../data/derive'
import type { Competitor } from '../data/types'
import { combinePair, useCompetitors, usePairs, useTeams } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { isActiveMemberOrAdministration } from '../roles/activeMemberOrAdministration'
import { useRole } from '../roles/useRole'
import { useServerIsStillBeingAsked } from '../session/useServerIsStillBeingAsked'
import { useSession } from '../session/useSession'
import { MEMBERS, recordsOf } from './admin/entityForms'
import { useOverlay } from './admin/overlay'
import { ProfileTop } from './profile/ProfileHead'
import { addressOfTheData, TheMembersData } from './profile/TheMembersData'
import { TheirBoxesOffTheirData, TheMembersPictureAndWords } from './profile/TheMembersPictureAndWords'
import { profileFor } from './profile/visible'
import { THE_DATA, useWhoReadsTheData } from './profile/whoReadsTheData'
import { useWhereARefusedReaderGoes } from './member/whereARefusedReaderGoes'
import { memberNumberIn, redirectTo } from './profileAddress'
import './Profile.css'
import './member/Member.css'

/**
 * THE CARD „PODACI" OF A PROFILE, which only the administration sees.
 *
 * <p>Owner, 22.10.2026 (PDL, „Red člana, kartica Podaci i strana Podešavanja"): „Profil dobija karticu
 * „Podaci", posle „Pregled" i „Priznanja i nagrade"", and, chosen between offered outcomes with the
 * recommendation: „Tuđe podatke otvara i menja samo moderator sa pravom nad članovima, i admin." And
 * 07.11.2026 (PDL, „Član svojim podacima pristupa iz glavnog menija”): „na svom profilu član vidi samo
 * „Rezultati” i „Priznanja”. Administracija i dalje vidi karticu „Podaci” na strani takmičara." The
 * owner's own words: „Takmicari vide samo u glavnom meniju i tu pristupaju, a administratori vide na
 * stranici takmicara i tu pristupaju”.
 *
 * <p><b>Three readers and three answers</b>, asked of one home (`profile/whoReadsTheData.ts`) so the tab
 * the head offers and the card cannot disagree:
 *
 * <ol>
 * <li><b>The member himself</b>, a moderator who races among them: sent to „Moji podaci", where his data
 * are now, with the query and the part after `#` (`#slika` is how a link reaches the boxes). [IZVEDENO]
 * The address was his card until 07.11.2026, so a bookmark and a link written before then still lead to
 * his data and not to the home page. A member whose fee has lapsed is sent there too, and that page sends
 * him on to the one he renews on (owner, 07.11.2026).</li>
 * <li><b>The administration over the members</b>, a moderator holding `entity:members` or the
 * superadmin: the form of the registration, without the password (`TheMembersData.tsx`), and under it
 * the member's picture and words (PDL 06.11.2026).</li>
 * <li><b>Everybody else</b>: the home page, the answer the profile gives a reader who may not read it
 * (owner, 06.09.2026), so the address says nothing about whether a card is there (ADL A8). Somebody who
 * registered and has not paid is sent to the page he pays on instead (owner, 22.10.2026;
 * `member/whereARefusedReaderGoes.ts`).</li>
 * </ol>
 *
 * <p><b>The head is the profile's head</b> („Ista strana"), drawn from the public list the profile is
 * drawn from. A member the list does not carry - his fee has lapsed, and the administration opened his
 * card from the screen of the members - is drawn the card under a heading of its own, because his
 * profile is shown to nobody (PDL P11) and its head would be a page about a profile that is not there.
 */
export function CompetitorData() {
  const { memberNumber: part } = useParams()
  const memberNumber = memberNumberIn(part)
  const { signedIn } = useSession()
  const asking = useServerIsStillBeingAsked()
  const reader = useWhoReadsTheData(memberNumber)
  const away = useWhereARefusedReaderGoes()
  const { locale } = useI18n()
  const { search, hash } = useLocation()

  /* UNTIL THE SERVER HAS SAID WHO IS READING, nothing is decided (owner, 10.10.2026, PDL P26): a cold
     load of this address by the member himself would otherwise send him to the home page. */
  if (signedIn === null && asking) {
    return <Loader inline={false} />
  }

  if (reader === null) {
    return <Navigate to={away} replace />
  }

  if (reader === 'his') {
    return <Navigate to={`/${locale}/${MY_DATA_ADDRESS}${search}${hash}`} replace />
  }

  return (
    <TheCard
      part={part}
      memberNumber={memberNumber}
      panel={<TheMembersData address={addressOfTheData(memberNumber)} />}
      boxes={(competitor) => <TheMembersPictureAndWords competitor={competitor} />}
      /* A member the public list does not carry is drawn the card under a heading of its own (see
         `TheCard`), and his boxes are drawn off the administration's own route: owner, 06.11.2026, „Vidi i
         samu sliku". */
      alone={<TheirBoxesOffTheirData memberNumber={String(memberNumber)} />}
    />
  )
}

/**
 * THE PAGE AROUND THE CARD: the profile's own head where the public list carries the member, at the one
 * address the profile has (PDL P11, „One address and no alias"), and a heading of its own where it does
 * not.
 */
function TheCard({
  part,
  memberNumber,
  panel,
  boxes,
  alone,
}: {
  part: string | undefined
  memberNumber: string | undefined
  /** The form of the data, which every road of the card draws. */
  panel: ReactNode
  /** The picture and the words about himself, at the bottom, drawn about the record the head is drawn from. */
  boxes: (competitor: Competitor) => ReactNode
  /** The same boxes for a member the public list does not carry, drawn under the form there. */
  alone: ReactNode
}) {
  const { locale, t } = useI18n()
  const { search, hash } = useLocation()
  const { signedIn, theServerHasAnswered, pairsMade, pairsBroken } = useSession()
  const { role } = useRole()
  const overlay = useOverlay()
  const state = combinePair(combinePair(useCompetitors(), useTeams()), usePairs())

  return (
    <Resource state={state}>
      {([[everybody, allTeams], fromFile]) => {
        const competitors = recordsOf(MEMBERS, everybody, overlay)
        const readable = profileFor(
          competitors,
          memberNumber,
          isActiveMemberOrAdministration(role, signedIn),
          theServerHasAnswered,
          /* NOBODY'S OWN PAGE: the member himself never reaches the card (`CompetitorData`), so the
             record is never asked for as his. */
          null,
        )

        const drawn = (competitor: Competitor) => {
          const elsewhere = redirectTo(competitor, part, locale, THE_DATA)

          if (elsewhere !== null) {
            /* THE PART AFTER `#` GOES WITH THE READER, as it does wherever the portal moves him
               (`app/Shell.tsx`): `#slika` is how the screen of the fee leads to the boxes. */
            return <Navigate to={`${elsewhere}${search}${hash}`} replace />
          }

          return (
            <div className="profile profile--competitor">
              <PageMeta
                title={t('seo.competitor.dataTitle', {
                  name: `${competitor.firstName} ${competitor.lastName}`,
                })}
                description={t('seo.competitorData.description')}
              />
              <ProfileTop
                competitor={competitor}
                team={allTeams.find((one) => one.id === competitor.teamId)}
                competitors={competitors}
                pairs={pairsNow(fromFile, pairsMade, pairsBroken)}
              />
              {panel}
              {boxes(competitor)}
            </div>
          )
        }

        if (readable.kind === 'shown') {
          return drawn(readable.competitor)
        }

        /* NOT ON THE PUBLIC LIST, which for a reader who got this far is the administration opening the
           card of a member whose fee has lapsed: the card, under a heading of its own. No wait for the
           server to say who is reading, unlike the profile's (`profile/visible.ts`): the card asked that
           before it drew anything (`CompetitorData`), so by here it has been said. */
        return (
          <div className="profile">
            <h1>{t('profile.parts.data')}</h1>
            {panel}
            {alone}
          </div>
        )
      }}
    </Resource>
  )
}
