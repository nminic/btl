import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { Resource } from '../../components/Resource'
import type { Competitor } from '../../data/types'
import { useCompetitors } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { THE_PICTURE_AND_THE_WORDS } from '../profile/finishTheProfile'
import { HisOwnRecord } from '../profile/HisOwnRecord'
import { profileFor } from '../profile/visible'
import { useScreenOfHisData } from './memberScreen'
import { PersonalData } from './PersonalData'
import { ProfileBio } from './ProfileBio'
import { ProfilePicture } from './ProfilePicture'
import { useMyData } from './useMyData'
import './Member.css'

/**
 * „MOJI PODACI": WHERE A MEMBER CHANGES HIS DATA, HIS PICTURE AND HIS WORDS ABOUT HIMSELF, AND WHERE
 * SOMEBODY WHO REGISTERED AND HAS NOT PAID CHANGES HIS DATA.
 *
 * <p>Owner, 07.11.2026 (PDL, „Član svojim podacima pristupa iz glavnog menija”): „Član svojim podacima
 * pristupa iz glavnog menija, stavkom „Moji podaci” (`/moji-podaci`): forma, slika i tekst o sebi; na
 * svom profilu član vidi samo „Rezultati” i „Priznanja”." The form and the two boxes were the card
 * „Podaci" of his own profile until then, and are drawn here as they were drawn there: the panel
 * (`PersonalData.tsx`), sent to the same route, and under it the picture and the words, which stand at
 * `#slika` so the screen of the fee can lead to them (`Membership.tsx`). The administration still opens
 * a member's card on his profile (`CompetitorData.tsx`).
 *
 * <p><b>Somebody who has not paid is drawn the panel and not the boxes</b>: he may change his data and
 * may not set a picture or words about himself until he has paid (PDL 10.10.2026, „Šta sme neplaćen
 * član": „Ne sme ništa što ga čini vidljivim [...]: sliku, biografiju").
 *
 * <p><b>Who is drawn what</b> is the hook's to say (`memberScreen.tsx`, `useScreenOfHisData`): a member
 * whose fee has lapsed is sent to the page he renews on, and the rest are told what every screen of the
 * member area tells them.
 *
 * <p><b>His data are read off the answer that has a row for him</b> (`useMyData`, `GET /api/me`), under
 * his own cookie. A read that fails says so in the portal's own words and offers to ask again
 * (`components/Resource.tsx`), and the heading stays.
 */
export function MyData() {
  const { t } = useI18n()
  const who = useScreenOfHisData()

  if (who.instead !== null) {
    return who.instead
  }

  return (
    <div className="member">
      <h1>{t('nav.myData')}</h1>
      {who.memberNumber === null ? (
        <HisData asked={who.account} />
      ) : (
        <>
          {/* KEYED BY THE MEMBER, BECAUSE EVERYTHING ON THIS PAGE BELONGS TO ONE PERSON: what he typed,
              what stands on his profile, what of his is waiting, and what the server last said. One visit
              can hold two people - a shared laptop at a race - and without this the second reads the
              first man's words out of the boxes. */}
          <HisData key={`data-${who.memberNumber}`} asked={who.memberNumber} />
          <HisBoxes key={`boxes-${who.memberNumber}`} memberNumber={who.memberNumber} />
        </>
      )}
    </div>
  )
}

/** His data, asked for under his own cookie and held against the key it was asked for. */
function HisData({ asked }: { asked: number | string }) {
  const mine = useMyData(asked)

  return (
    <Resource state={mine} inline>
      {(data) => <PersonalData me={data} />}
    </Resource>
  )
}

/**
 * THE PICTURE AND THE WORDS, drawn off his record: the one the public list carries, or, where it does not
 * carry him, the one the server gives him of himself (`profile/HisOwnRecord.tsx`), which is the road his
 * own profile takes (`profile/visible.ts`).
 */
function HisBoxes({ memberNumber }: { memberNumber: string }) {
  const competitors = useCompetitors()
  const { theServerHasAnswered } = useSession()

  return (
    <Resource state={competitors} inline>
      {(everybody) => {
        const readable = profileFor(everybody, memberNumber, true, theServerHasAnswered, memberNumber)

        return readable.kind === 'shown' ? (
          <TheTwoBoxes me={readable.competitor} />
        ) : (
          <HisOwnRecord memberNumber={memberNumber}>{(me) => <TheTwoBoxes me={me} />}</HisOwnRecord>
        )
      }}
    </Resource>
  )
}

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
      <ProfileBio me={me} />
    </div>
  )
}
