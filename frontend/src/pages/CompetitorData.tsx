import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
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
import { PersonalData } from './member/PersonalData'
import { ProfileBio } from './member/ProfileBio'
import { ProfilePicture } from './member/ProfilePicture'
import { useMyData } from './member/useMyData'
import { BoxesSentContext, THE_PICTURE_AND_THE_WORDS } from './profile/finishTheProfile'
import { HisOwnRecord } from './profile/HisOwnRecord'
import { ProfileTop } from './profile/ProfileHead'
import { TheMembersData } from './profile/TheMembersData'
import { TheMembersPictureAndWords } from './profile/TheMembersPictureAndWords'
import { profileFor } from './profile/visible'
import { THE_DATA, useWhoReadsTheData } from './profile/whoReadsTheData'
import { useWhereARefusedReaderGoes } from './member/whereARefusedReaderGoes'
import { memberNumberIn, redirectTo } from './profileAddress'
import './Profile.css'
import './member/Member.css'

/**
 * THE CARD „PODACI" OF A PROFILE, which only the member himself and the administration see.
 *
 * <p>Owner, 22.10.2026 (PDL, „Red člana, kartica Podaci i strana Podešavanja"): „Profil dobija karticu
 * „Podaci", posle „Pregled" i „Priznanja i nagrade", koju vidi samo sam član i administracija", and
 * „Ista strana treba da se otvori ukoliko takmičar ode na sopstveni profil i onda ima novu opciju koju
 * vidi samo on Podaci [...] Dakle tu on može da edituje sve svoje podatke osim šifre." And, chosen
 * between offered outcomes with the recommendation: „Tuđe podatke otvara i menja samo moderator sa
 * pravom nad članovima, i admin."
 *
 * <p><b>Three readers and three answers</b>, asked of one home (`profile/whoReadsTheData.ts`) so the tab
 * the head offers and the card cannot disagree:
 *
 * <ol>
 * <li><b>The member himself, whose fee stands</b>: his own panel (`PersonalData.tsx`), sent to
 * {@code PUT /api/me}. „Član sam menja sve osim pola i datuma rođenja", and the father's name stays the
 * administration's („Ime oca i dalje menja samo administracija", 22.10.2026). A moderator who races
 * reads his own card here too, because the administration's route refuses a moderator his own record
 * (PDL, M7: „moderator ne ispravlja svoj zapis").</li>
 * <li><b>The administration over the members</b>, a moderator holding `entity:members` or the
 * superadmin: the form of the registration, without the password (`TheMembersData.tsx`).</li>
 * <li><b>Everybody else</b>, and a member whose fee has lapsed reading his own (the server answers his
 * writes 404, PDL P8, 11.10.2026): the home page, the answer the profile gives a reader who may not
 * read it (owner, 06.09.2026), so the address says nothing about whether a card is there (ADL A8).
 * Somebody who registered and has not paid is sent to the page he pays on instead (owner, 22.10.2026;
 * `member/whereARefusedReaderGoes.ts`): his own card opens with the fee, like the rest.</li>
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
  const [times, setTimes] = useState(0)
  const boxesSent = useMemo(() => ({ times, sent: () => setTimes((one) => one + 1) }), [times])

  /* UNTIL THE SERVER HAS SAID WHO IS READING, nothing is decided (owner, 10.10.2026, PDL P26): a cold
     load of this address by the member himself would otherwise send him to the home page. */
  if (signedIn === null && asking) {
    return <Loader inline={false} />
  }

  if (reader === null) {
    return <Navigate to={away} replace />
  }

  /* ONE COUNT FOR THE WHOLE CARD, so the boxes at its bottom and the name in its head are told the same
     thing (`profile/finishTheProfile.ts`). */
  return (
    <BoxesSentContext.Provider value={boxesSent}>
      <TheCard
        part={part}
        memberNumber={memberNumber}
        panel={reader === 'his' ? <HisOwnData whose={String(memberNumber)} /> : <TheMembersData memberNumber={memberNumber} />}
        boxes={(competitor) =>
          reader === 'his' ? <TheTwoBoxes me={competitor} /> : <TheMembersPictureAndWords competitor={competitor} />
        }
      />
    </BoxesSentContext.Provider>
  )
}

/** His own panel, drawn from what the server says of him on `GET /api/me` (`useMyData`). */
function HisOwnData({ whose }: { whose: string }) {
  const mine = useMyData(whose)

  return (
    <Resource state={mine} inline>
      {(data) => <PersonalData me={data} />}
    </Resource>
  )
}

/**
 * THE PICTURE, AND BESIDE IT THE WORDS ABOUT HIMSELF, at the bottom of his card „Podaci" and under the
 * button of the form (owner, 06.11.2026, PDL „Boksovi „Profilna slika" i „Tekst o sebi" prelaze sa
 * Podešavanja": „prelaze sa Podešavanja na dno kartice „Podaci""; „ponašanje ostaje, menja se strana").
 * They moved as they were, each going for review on its own (owner, 15.08.2026), from the second of the
 * three rows the settings had (`.member__pair member__row`, PDL 22.10.2026).
 *
 * <p><b>Only here, and so only for a member whose fee stands</b>: the card is drawn to him and to nobody
 * else of his own (`whoReadsTheData.ts`), and somebody who has not paid changes his data on „Moji podaci",
 * which draws `PersonalData` and not this (PDL P8, 10.10.2026: „Ne sme ništa što ga čini vidljivim ili ga
 * uključuje u ligu: sliku, biografiju").
 *
 * <p><b>`#slika` leads here</b>, from the sentence the screen of the fee says when the membership is let
 * in (`Membership.tsx`), and the card keeps the part after `#` when it moves the reader to the profile's
 * one address (`TheCard`). Scrolled to once the two are drawn, because the browser looked for the element
 * before the list it is drawn from had arrived.
 *
 * <p><b>Handed the record the head of the card is drawn from</b>, so the head and the boxes are about one
 * record and cannot be about two (`TheCard`).
 */
function TheTwoBoxes({ me }: { me: Competitor }) {
  const { hash } = useLocation()
  const here = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hash === `#${THE_PICTURE_AND_THE_WORDS}`) {
      here.current?.scrollIntoView()
    }
  }, [hash])

  return (
    <div ref={here} id={THE_PICTURE_AND_THE_WORDS} className="member__pair member__row">
      <ProfilePicture me={me} />
      {/* KEYED BY THE MEMBER, BECAUSE EVERYTHING THAT PANEL HOLDS BELONGS TO ONE PERSON: what he typed,
          what stands on his profile, what of his is waiting, and what the server last said. One visit can
          hold two people - a shared laptop at a race - and without this the second reads the first man's
          words out of the box. */}
      <ProfileBio key={me.memberNumber} me={me} />
    </div>
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
}: {
  part: string | undefined
  memberNumber: string | undefined
  /** The form of the data, which every road of the card draws. */
  panel: ReactNode
  /** The picture and the words about himself, at the bottom, drawn only where there is a record to draw
   *  them about: the profile's own. A member the public list does not carry gets the form alone. */
  boxes: (competitor: Competitor) => ReactNode
}) {
  const { locale, t } = useI18n()
  const { search, hash } = useLocation()
  const { signedIn, theServerHasAnswered, memberNumber: readerNumber, pairsMade, pairsBroken } = useSession()
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
          readerNumber,
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

        if (readable.kind === 'his') {
          return <HisOwnRecord memberNumber={readable.memberNumber}>{drawn}</HisOwnRecord>
        }

        /* NOT ON THE PUBLIC LIST, which for a reader who got this far is the administration opening the
           card of a member whose fee has lapsed: the card, under a heading of its own. No wait for the
           server to say who is reading, unlike the profile's (`profile/visible.ts`): the card asked that
           before it drew anything (`CompetitorData`), so by here it has been said. */
        return (
          <div className="profile">
            <h1>{t('profile.parts.data')}</h1>
            {panel}
          </div>
        )
      }}
    </Resource>
  )
}
