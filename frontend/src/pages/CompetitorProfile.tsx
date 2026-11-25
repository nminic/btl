import { CardMarkInTheAddress } from './profile/CardMarkInTheAddress'
import { HisOwnRecord } from './profile/HisOwnRecord'
import { InvitesToHim } from './profile/InvitesToHim'
import { memberNumberIn, redirectTo } from './profileAddress'
import { useMemo } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { CategoryDonut } from '../components/CategoryDonut'
import { Loader } from '../components/Loader'
import { Resource } from '../components/Resource'
import { MEMBERS, TEAMS, recordsOf } from './admin/entityForms'
import { useOverlay } from './admin/overlay'
import { isActiveMemberOrAdministration } from '../roles/activeMemberOrAdministration'
import { useRole } from '../roles/useRole'
import { useSession } from '../session/useSession'
import { profileFor } from './profile/visible'
import { useGrowing } from '../components/growing'
import { LoadMore } from '../components/LoadMore'
import { LengthFilter } from '../components/LengthFilter'
import { Counters } from './home/Counters'
import {
  CATEGORIES,
  countsByCategory,
  resultsOf,
  seasonsWithResults,
  totalsOf,
  pairsNow,
} from '../data/derive'
import type { Competitor, Gender, RaceCategory, RacingPair, Result, ShownText, Team } from '../data/types'
import {
  combineFour,
  combinePair,
  useCompetitorsInTheReadersLanguage,
  usePairs,
  useTeams,
} from '../data/useResource'
import { useHisResults, useHisUnscoredResults } from '../data/hisResults'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { MachineNote } from '../components/MachineNote'
import { shownOr } from '../data/shownText'
import { shortBio } from './profile/bio'
import { ProfileTop } from './profile/ProfileHead'
import { ALL_SEASONS, offeredSeason, useSeason } from '../components/season'
import { useFilterParams } from '../app/useFilterParams'
import './Profile.css'

/** One line of the table: a result and whether the league scored it. A pair rather than a flag on
 *  `Result`, because the type is the one `/api/results` serves (his own address serves the same rows,
 *  `data/hisResults.ts`) and an unscored result is the very same row; what says which list it came out of is the list, and nothing the server could get
 *  wrong in a field. */
type Line = { result: Result; unscored: boolean }

/**
 * How many results arrive with the page, before the table starts growing.
 *
 * Fifty, because that is the number the owner named on 12.08.2026 asking why
 * this table did not grow: „Zbog čega na rezultatima takmičara ne ide učitavanje
 * na skroll kad/ako ih ima preko 50 na strani?“
 *
 * The foot is drawn under fifty as well, as it is on the ducats: it is then one
 * sentence saying that is all of them, and nothing is asked of the reader. Said
 * here because an earlier note claimed no control is drawn at all, which the
 * condition below has never done.
 */
const AT_FIRST = 50


/**
 * The biography as it is published, in paragraphs, with no links inside it: a
 * link in text somebody else wrote is an address that has to be policed.
 *
 * The card stands on every profile, empty or not (owner, 31.07.2026). Everybody
 * will have one, since it is written at the moment of joining, and a row of
 * three that is sometimes a row of two changes shape from person to person for
 * no reason the reader can see.
 *
 * <p><b>`text` may be null since 26.09.2026, and reads exactly like `''`.</b> The server
 * answers null for a member who hides their profile from a reader who may not read it
 * (`data/types.ts`'s note on `bio`), and PDL, 06.09.2026 requires that hiding read like
 * having nothing rather than like a fourth, different state: „Oba slucaja dobijaju isti
 * ishod" is the same sentence the portrait already keeps. In practice this page never
 * actually draws that reader a hidden member's card at all - `profile/visible.ts`'s
 * `reachable` sends them to `/sr` first - so treating null here is a guard against the
 * two conditions drifting apart rather than a state a real visit produces;
 * `profile.test.tsx` builds the disagreement by hand to keep the guard from being a
 * branch nothing checks (rule of 14.09.2026).
 */
function Biography({
  text,
  shown,
  gender,
}: {
  text: string | null
  shown?: ShownText
  gender: Gender
}) {
  const { t } = useI18n()
  /* WHAT THIS READER IS SHOWN OF IT, since 25.11.2026 (owner, PDL P18, „Automatski prevod sadržaja koji posetilac
     vidi”): the translation into the language of the address or the words as written, marked with the language they
     are really in and said to be the machine's where they are. `text` decides whether there is anything to show: a
     biography withheld from this reader is null, and nothing is shown in its place. */
  const said = shownOr(text ?? '', shown)

  return (
    <section className="profile__card profile__bio" aria-labelledby="profile-bio">
      <h2 className="profile__card-title" id="profile-bio">
        {t('profile.bio')}
      </h2>
      {/* Said of the person whose page it is, in the gender they are: a portal
          that calls every woman on it a takmičar is one written for half its
          members (owner, 11.08.2026). */}
      {text === null || text === '' ? (
        <p className="profile__bio-text profile__bio-text--none">
          {t(gender === 'F' ? 'profile.bioEmptyFemale' : 'profile.bioEmpty')}
        </p>
      ) : (
        <>
          {shortBio(said.text)
            .split(/\n{2,}/)
            .map((paragraph) => (
              <p className="profile__bio-text" key={paragraph} lang={said.language ?? undefined}>
                {paragraph}
              </p>
            ))}
          <MachineNote shown={said} />
        </>
      )}
    </section>
  )
}

/**
 * The profile, as one page of two parts (the design decision of 30.07.2026).
 *
 * This is the first: who the person is, then one row of three answering who they
 * are and of what kind and how much, then the races.
 *
 * The season is chosen once, at the top of the page beside the name, because it
 * governs both parts and not one of them (owner, 31.07.2026).
 *
 * The order of the three is the biography, the ring, the figures, all of one
 * width. The words come first because they are the only part of the card that
 * had to be written by hand; the two that are worked out follow.
 */
function ProfileBody({
  competitor,
  competitors,
  results,
  unscoredResults,
  team,
  teams,
  pairs,
}: {
  competitor: Competitor
  competitors: Competitor[]
  /** His scored runs, as his own address serves them (`data/hisResults.ts`): the rows of `/api/results`
   *  that carry his number. Still read through `resultsOf` below, which is what puts the newest first. */
  results: Result[]
  /** His runs of the races the league does not score, likewise (`/api/competitors/{broj}/unscored-results`).
   *  Drawn in the list and in the ring and counted in no figure (`data/unscoredResults.ts`). */
  unscoredResults: Result[]
  team: Team | undefined
  teams: Team[]
  /** The pairs that hold now, the file and this visit together (`data/derive.ts`, `pairsNow`). */
  pairs: RacingPair[]
}) {
  const { locale, t } = useI18n()
  const [params, setParams] = useFilterParams()
  const asked = useSeason()

  const mine = useMemo(
    () => resultsOf(results, competitor.memberNumber),
    [results, competitor.memberNumber],
  )
  /* Only the years this person has results in (owner, 02.11.2026: a year with none „ne treba da
     se pojavi kao opcija za tog takmicara u njegovoj listi"). Not the running year, and not a year
     an address names: such an address opens on all of them, through `offeredSeason`. */
  const unscoredMine = useMemo(
    () => resultsOf(unscoredResults, competitor.memberNumber),
    [unscoredResults, competitor.memberNumber],
  )
  /* A year in which somebody only swam is a year they have results in, so the unscored ones offer
     years as well; the figures below still count the scored ones alone. */
  const options = useMemo(
    () => seasonsWithResults([...mine, ...unscoredMine]),
    [mine, unscoredMine],
  )
  /* Held against the list before anything is read in it, so the control and the
     table below it cannot show two different years. */
  const season = offeredSeason(asked, options, undefined)

  /* The length has no such treatment as the season: an unknown length is nothing
     the row of six can show as chosen and nothing a table can narrow by, so it
     is ignored, and the address that used to ask for „Nebodovane trke" (`duzina=nebodovane`, until
     21.11.2026) opens on „Sve" like any other it does not know. */
  const askedLength = params.get('duzina')
  const length: RaceCategory | null = CATEGORIES.find((one) => one === askedLength) ?? null

  const inSeason = useMemo(
    () => mine.filter((result) => season === ALL_SEASONS || result.date.startsWith(season)),
    [mine, season],
  )
  const unscoredInSeason = useMemo(
    () => unscoredMine.filter((result) => season === ALL_SEASONS || result.date.startsWith(season)),
    [unscoredMine, season],
  )
  /* WHAT THE TABLE HOLDS, by the owner's decisions of 14.11.2026 and 21.11.2026: „Sve" shows the scored
     and the unscored together, a length shows only the scored ones of that length, and there is no
     button for the unscored ones alone. Newest first, and on one day the scored one first (the sort is stable and the
     scored ones are put in first). */
  const shown = useMemo<Line[]>(() => {
    const scored = (): Line[] =>
      inSeason
        .filter((result) => length === null || result.category === length)
        .map((result) => ({ result, unscored: false }))
    const unscoredLines = (): Line[] =>
      unscoredInSeason.map((result) => ({ result, unscored: true }))

    return length === null
      ? [...scored(), ...unscoredLines()].sort((left, right) =>
          right.result.date.localeCompare(left.result.date),
        )
      : scored()
  }, [inSeason, unscoredInSeason, length])

  /* The figures follow the season and nothing else, and they count the scored races ALONE (owner,
     14.11.2026: „Brojači statistike na profilu (km, uspon, spust, vreme, bodovi) broje samo bodovane
     trke; nebodovane se vide u krugu i u listi rezultata"). */
  const totals = useMemo(() => totalsOf(inSeason), [inSeason])

  /* A table that grows as it is read, the same mechanism the comments under an
     event and the ducats on a profile already use (components/growing.ts).
     Owner, 12.08.2026, asking why this one did not have it: „Zbog čega na
     rezultatima takmičara ne ide učitavanje na skroll kad/ako ih ima preko 50 na
     strani?"
   *
     Fifty at first, because that is the number he named. The heading above still
     counts the whole filtered set, not what is drawn: it answers „how many
     results does this competitor have", which is not the same question as „how
     far have I read". */
  /* Told what the list is of, and not only how long it is. Two length
     categories holding the same number of races are two lists, and a reader who
     has read one to the end has not asked anything about the other: without
     this, switching between them moves the focus to the foot of the table
     (components/growing.ts). Both filters go in, because both make a different
     list of the same results. */
  const {
    shown: grown,
    whole,
    asked: askedMore,
    more,
  } = useGrowing(shown.length, AT_FIRST, params.toString())

  function changeLength(value: RaceCategory | null) {
    const merged = new URLSearchParams(params)

    if (value === null) {
      merged.delete('duzina')
    } else {
      merged.set('duzina', value)
    }

    setParams(merged)
  }

  return (
    <div className="profile profile--competitor">
      <ProfileTop
        competitor={competitor}
        team={team}
        competitors={competitors}
        pairs={pairs}
        seasons={options}
        season={season}
        /* In the row of the parts, to the right, since 06.11.2026 (owner: „malo normalno dugme alignovano
           desno, istog formata i reda"); until then each stood under the head as a row of its own. Each
           draws nothing unless the reader may ask (profile/InviteToTeam.tsx, profile/InviteToPair.tsx). */
        acts={
          <InvitesToHim competitor={competitor} competitors={competitors} teams={teams} pairs={pairs} />
        }
      />

      {/* THE PAIR ITSELF IS IN THE LINE UNDER THE NAME SINCE 18.10.2026, and the way to end it and
          the questions still standing are on „Moja članarina" (PDL P11, owner, 18.10.2026: „Dugme
          „Raskini" i pozivi u par koji čekaju sele na „Moja članarina", ispod prelaznog roka";
          `profile/ProfileHead.tsx` and `member/MyRacingPairs.tsx`). */}

      <div className="profile__row profile__row--bio">
        <Biography text={competitor.bio} shown={competitor.bioShown} gender={competitor.gender} />

        <section className="profile__card profile__card--donut">
          <CategoryDonut
            counts={countsByCategory(inSeason)}
            unscored={unscoredInSeason.length}
            caption={t('profile.byCategory')}
          />
        </section>

        <Counters totals={totals} races={false} />
      </div>

      <section className="profile__results" aria-labelledby="profile-results">
        <h2 className="profile__section" id="profile-results">
          {t('profile.racesHeading')} <span className="profile__count">{shown.length}</span>
        </h2>

        <LengthFilter fit value={length} onChange={changeLength} />

        {shown.length === 0 ? (
          <div className="profile__results-empty">
            <p>{emptyText(t, mine.length + unscoredMine.length, season)}</p>
            {(season !== ALL_SEASONS || length !== null) && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setParams(new URLSearchParams())}
              >
                {t('profile.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">{t('profile.racesHeading')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('profile.columns.date')}</th>
                  {/* „Trka" and not „Događaj": what stands in this column is the name of
                      the race (owner, 23.08.2026), and a heading that says otherwise
                      is read out with every cell under it. */}
                  <th scope="col">{t('profile.columns.race')}</th>
                  {/* The group a run falls in has no column of its own (owner,
                      31.07.2026). It is the colour of the dot beside the
                      figure, and the figure already says which one it is: 21,10
                      is a half marathon whatever colour it wears.

                      Named in full since 16.10.2026: „SAMO TREBA PREIMENOVATI
                      POSTOJEĆE D + i - na profilu", so the three columns that
                      stood as „d (km)", „+ (m)" and „− (m)" read Dužina (km),
                      Uspon (m) and Spust (m). None is added. */}
                  <th scope="col">{t('profile.columns.length')}</th>
                  <th scope="col" className="table__hide-phone">
                    {t('profile.columns.ascent')}
                  </th>
                  <th scope="col" className="table__hide-phone">
                    {t('profile.columns.descent')}
                  </th>
                  <th scope="col" className="table__hide-phone">
                    {t('profile.columns.time')}
                  </th>
                  <th scope="col">{t('profile.columns.points')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, grown).map(({ result, unscored }) => (
                  <tr key={`${unscored ? 'unscored' : 'scored'}-${result.id}`}>
                    <td>{formatShortDate(result.date, locale)}</td>
                    {/* The event, not just its name (owner, 31.07.2026). Somebody
                        reading a result wants the race it came out of, and until
                        now the only way there was to guess the date in the
                        calendar. */}
                    <td>
                      {/* The name of the race, and the link still to the event it was run at:
                          the race has no page of its own and the event does
                          (owner, 23.08.2026). */}
                      <Link to={`/${locale}/kalendar/${result.eventSlug}`}>{result.raceName}</Link>
                    </td>
                    <td className="table__points">
                      {/* The dot carries the length, and its name goes with it,
                          because a colour on its own says nothing to anyone who
                          cannot tell two of them apart. */}
                      <span
                        className={`profile__dot profile__dot--${unscored ? 'unscored' : result.category}`}
                        aria-hidden="true"
                      />
                      {/* A race the league does not score has no length group: the dot is a
                          hollow one, and the reading says what it is instead of a group (colour
                          is never the only thing that tells them apart). */}
                      <span className="visually-hidden">
                        {unscored
                          ? t('profile.unscoredWord', { count: 1 })
                          : t(`category.${result.category}`)}
                        {': '}
                      </span>
                      {formatNumber(result.distanceKm, locale, 2)}
                    </td>
                    <td className="table__hide-phone">{formatNumber(result.ascentM, locale)}</td>
                    <td className="table__hide-phone">{formatNumber(result.descentM, locale)}</td>
                    <td className="table__hide-phone">{formatDuration(result.seconds)}</td>
                    <td className="table__points">
                      {unscored ? (
                        <>
                          {/* „–" and not 0,00: the league did not score it, which is not the same
                              as scoring nothing. Said in words for a reader who hears a dash as
                              silence. */}
                          <span aria-hidden="true">–</span>
                          <span className="visually-hidden">{t('profile.noPoints')}</span>
                        </>
                      ) : (
                        formatPoints(result.points, locale)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Under the table and outside the box that scrolls sideways: the
            control belongs to the list, not to the width of it, and a reader
            who has pushed the table left must not have to push it back to find
            the button. */}
        {shown.length > 0 && (
          <LoadMore
            whole={whole}
            asked={askedMore}
            onMore={more}
            words={{
              more: t('profile.moreResults'),
              showing: t('profile.showingResults', { shown: grown, total: shown.length }),
              whole: t('profile.allResults', { count: shown.length }),
            }}
            endShown={false}
          />
        )}
      </section>
    </div>
  )
}

/** Which of the three sentences an empty table gets. Never raced at all is a
 *  different fact from raced but not at this distance, and a reader who is told the
 *  wrong one goes looking for a fault. A year is offered only where there are results
 *  (owner, 02.11.2026), so a chosen year is empty only together with a distance. */
function emptyText(
  t: (key: string, params?: Record<string, string | number>) => string,
  raced: number,
  season: string,
): string {
  if (raced === 0) {
    /* Written without a gender, unlike the biography above it. The portal has
       exactly one member who has never raced, so one of the two forms of this
       sentence would be a form nothing could ever show, and a sentence nobody
       can see is a sentence nobody can check. */
    return t('profile.noResults')
  }

  return season === ALL_SEASONS ? t('profile.noneInLength') : t('profile.noneInFilter')
}

/**
 * One competitor, found by number.
 *
 * A member who is not active has no visible profile at all (PDL P11: "Nigde na
 * portalu nema vidljiv profil", "softverski je sakriven kao da ne postoji").
 * Nothing here read that flag, so the profile of somebody who had left was
 * public, which is the sort of thing that is nobody's fault and everybody's
 * problem. It is the same answer as a number nobody has.
 *
 * **EXCEPT TO THE MEMBER HIMSELF, since 25.09.2026 and carried out on 10.10.2026.** PDL P8,
 * 25.09.2026, „Treba da moze da otvori svoj profil dokle god postoji" - and this page sent such a
 * member to the front page even when the profile was his own, which was the portal turning a man
 * away from the page he had to pass to reach his own fee. He is on no
 * row of the list this page is drawn from (it ends where the fee does not), so his record is asked
 * for separately (`profile/HisOwnRecord.tsx`) and the page is drawn from it exactly as it is from a
 * row of the list: `profile/visible.ts` says when, and what it says is `his`.
 */
export function CompetitorProfile() {
  const params = useParams()
  const memberNumber = memberNumberIn(params.memberNumber)

  /* KEYED BY THE NUMBER, so that a profile opened from another one (a partner, a team mate) starts from
     what the visit holds for THIS member and never draws the runs of the one before while his own are on
     their way: the reads below are asked by the number, and a reader kept across a change of number
     would hold the previous member's answer until the new one arrives (`data/useResource.ts`, „Read by
     the effect below"). The same number under a longer address (the name added to it) is the same key,
     so moving to the one address a profile lives at reads nothing again. */
  return memberNumber === undefined || memberNumber === '' ? (
    <NoNumberOnTheAddress />
  ) : (
    <TheProfileOf key={memberNumber} memberNumber={memberNumber} />
  )
}

/**
 * AN ADDRESS WITH NO MEMBER NUMBER ON IT (`/takmicar/-ime`), answered as a profile nobody may reach is
 * answered, without asking the server for anybody's runs: the portal's own indicator until the server has
 * said who is reading, then the front page (`profile/visible.ts`, `profileFor`, which is asked here with
 * nobody to find so that the answer is its answer and not a copy of it).
 */
function NoNumberOnTheAddress() {
  const { locale } = useI18n()
  const { memberNumber: readerNumber, theServerHasAnswered } = useSession()

  return profileFor([], undefined, false, theServerHasAnswered, readerNumber).kind === 'waiting' ? (
    <Loader inline={false} />
  ) : (
    <Navigate to={`/${locale}`} replace />
  )
}

/** The profile of the member whose number is on the address. */
function TheProfileOf({ memberNumber }: { memberNumber: string }) {
  const { locale, t } = useI18n()
  const params = useParams()
  const { search } = useLocation()
  const {
    memberNumber: readerNumber,
    signedIn,
    theServerHasAnswered,
    pairsMade,
    pairsBroken,
  } = useSession()
  const { role } = useRole()
  const overlay = useOverlay()
  /* HIS RUNS AND NOBODY ELSE'S, since 22.11.2026 (inkrement „Poboljšanje performansi”, korak 1;
     `data/hisResults.ts`): the rows of `/api/results` and `/api/unscored-results` that carry his number,
     asked for at his own address instead of the whole league. Asked beside the list of members and not
     after it, so the two arrive together and the page waits for no second round. The races the league does
     not score are still a fifth read beside the four, and not folded into the first: `/api/results` serves
     the scored ones alone so that nothing which counts can ever meet an unscored result
     (`data/unscoredResults.ts`), and his own two addresses keep the same split. */
  const state = combinePair(
    combineFour(useCompetitorsInTheReadersLanguage(), useHisResults(memberNumber), useTeams(), usePairs()),
    useHisUnscoredResults(memberNumber),
  )

  return (
    <Resource state={state}>
      {([[everybody, results, allTeams, fromFile], unscoredResults]) => {
        /* Through the overlay, so a choice made in Podešavanja this visit is answered by this
           screen at once rather than only after the data is loaded again.

           And the clubs the same way, since 06.09.2026: a club founded during this visit lives
           in the overlay and nowhere else, so read off the file this page told the member who
           had just joined it that they were in no club at all (review, same day). */
        const competitors = recordsOf(MEMBERS, everybody, overlay)
        const teams = recordsOf(TEAMS, allTeams, overlay)
        /* Whether THIS reader may read a hidden profile, as the server already answers it: an active
           member (the session says his fee stands, `GET /api/me`) or the administration, which races
           for nobody and reads all the same (`profile/visible.ts`,
           `roles/activeMemberOrAdministration.ts`). A free account and a member whose fee has lapsed
           are signed in and are read as a visitor is. */
        const readsHiddenProfiles = isActiveMemberOrAdministration(role, signedIn)
        const readable = profileFor(
          competitors,
          memberNumber,
          readsHiddenProfiles,
          theServerHasAnswered,
          readerNumber,
        )

        if (readable.kind === 'waiting') {
          /* **Not sent away yet, because nobody has said who is reading** (`profile/visible.ts`,
             `Readable`, for the whole reasoning). At the first paint of a visit the reader is
             nobody, so a cold load of a hidden profile threw a reader who IS signed in onto the
             front page: the decision of 29.09.2026 (`PDL.md`, „Cuvar ne preusmerava dok server ne
             kaze ko cita"), carried here from `pages/admin/Guard.tsx` as the assistant's
             derivation and not a new word of the owner's. The price is the one he accepted there:
             a short moment of the portal's own indicator where the screen will be, the full sheet
             because what is waiting is the whole screen. The same for all three ways to be
             unreadable, so a visitor reads no difference off it (PDL 06.09.2026). */
          return <Loader inline={false} />
        }

        if (readable.kind === 'none') {
          /* **The home page, and the same for a profile that does not exist.** The owner's rule,
             06.09.2026: „javni posetilac se preusmerava na naslovnu stranu portala." Written as
             one answer for both, because a „nije pronađen" for one and a redirect for the other
             would let a visitor read off the difference which numbers belong to members who are
             hiding, which is the thing being hidden. */
          return <Navigate to={`/${locale}`} replace />
        }

        /* THE PAGE, DRAWN FROM A RECORD, whichever way the record came: a row of the list the
           server serves, or the member's own record asked for separately when it is his own page
           and the list does not carry him (`his`). One function for both, so that the two cannot
           be drawn differently - the canonical address, the tab and the body are the same page. */
        const drawn = (competitor: Competitor) => {
          const name = `${competitor.firstName} ${competitor.lastName}`

          /* One address and no alias (PDL P11): a reader who arrived by the
             number alone, or by a bookmark made before the name was in the
             address, is moved to the one this profile lives at rather than being
             left on a second one. In place, so the way back is not doubled.

             „Moj profil" is one of the ways in since 16.11.2026: it sends a member here by his
             number (`member/MyProfile.tsx`), and this is what moves him on to his one address. */
          const elsewhere = redirectTo(competitor, params.memberNumber, locale)

          if (elsewhere !== null) {
            return <Navigate to={`${elsewhere}${search}`} replace />
          }

          return (
            <>
              {/* The profile is the most shared page on the portal, so the tab, the
                  search result and the shared link carry the person rather than
                  the words "profil takmičara". Profiles are indexed unless the
                  member says otherwise (PDL P29); the date of birth is not part of
                  any of this, because it is never shown (PDL P23). */}
              <PageMeta
                title={t('seo.competitor.recordTitle', {
                  name,
                  city: competitor.city,
                })}
                description={t('seo.competitor.recordDescription', { name })}
                shareTitle={t('seo.competitor.shareTitle', { name })}
              />

              {/* HIS OWN PAGE CARRIES THE MARK OF HIS CARD IN ITS ADDRESS (owner, PDL P11, 16.11.2026,
                  point 15: „pusti ispravku iz tačke 2 odmah"), so the link he copies after his card has
                  changed is a new one to Viber and WhatsApp. Only at the address of the profile, which
                  is the one a network draws a preview for, and only for the member the session names:
                  nobody else's page is touched. Keyed by the member and the language, so a mark of one
                  card is never written into the address of another (`profile/CardMarkInTheAddress.tsx`). */}
              {readerNumber === competitor.memberNumber && (
                <CardMarkInTheAddress
                  key={`${competitor.memberNumber}-${locale}`}
                  memberNumber={competitor.memberNumber}
                  locale={locale}
                />
              )}

              <ProfileBody
                competitor={competitor}
                competitors={competitors}
                results={results}
                unscoredResults={unscoredResults}
                team={teams.find((one) => one.id === competitor.teamId)}
                teams={teams}
                pairs={pairsNow(fromFile, pairsMade, pairsBroken)}
              />
            </>
          )
        }

        if (readable.kind === 'his') {
          /* **HIS OWN PAGE, AND THE LIST DOES NOT CARRY HIM** (`profile/visible.ts`, `Readable`).
             Not sent anywhere: the redirect above is for a profile nobody may reach, and this is
             the one profile the reader himself may. What he is shown is whatever the server says
             of him when it is asked with his own cookie, so nothing here admits anybody by the
             number alone. */
          return <HisOwnRecord memberNumber={readable.memberNumber}>{drawn}</HisOwnRecord>
        }

        return drawn(readable.competitor)
      }}
    </Resource>
  )
}
