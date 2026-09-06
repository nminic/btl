import { memberNumberIn, redirectTo } from './profileAddress'
import { categoryLabel } from '../data/categories'
import { useMemo, useRef } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { useToday } from '../clock/useClock'
import { PageMeta } from '../app/PageMeta'
import { DucatArt } from '../components/DucatArt'
import { Resource } from '../components/Resource'
import { useColumns, useGrowing } from '../components/growing'
import { LoadMore } from '../components/LoadMore'
import { earnedDucats } from '../data/ducatEarned'
import { unitFor, type Ducat } from '../data/ducatRule'
import { formatNumber, formatPoints, wholePeriod } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import { MEMBERS, recordsOf } from './admin/entityForms'
import { useOverlay } from './admin/overlay'
import { ProfileHidden } from './profile/ProfileHidden'
import { profileFor } from './profile/visible'
import {
  combinePair,
  combineResources,
  useDucats,
  useCompetitors,
  useResults,
  useTeams,
} from '../data/useResource'
import { awardsOf } from './profile/awards'
import { ALL_SEASONS, offeredSeason, seasonOptions, useSeason } from '../components/season'
import { ProfileTop } from './profile/ProfileHead'
import './Profile.css'

/**
 * The second part of a profile: what this competitor has won.
 *
 * Its own address rather than a section at the foot of the overview (the design
 * decision of 30.07.2026). It is the one kind of thing here that is not scoped
 * to a season: a trophy and a ducat are permanent by decision, "osvojeno se
 * nikad ne skida" (PDL P11), so it has no business inside a page governed by a
 * season filter.
 *
 * The owner calls the ducats "BTL novčići", after the coin they are drawn as.
 * The portal calls them ducats everywhere, including here: there is already a
 * public page that is the catalogue of all of them and how they are won, and one
 * thing must not have two names. This is the collection rather than the
 * catalogue.
 */
function AwardsBody({
  memberNumber,
  part,
}: {
  memberNumber: string | undefined
  /** The whole of what the address carried, so the screen can tell whether it
   *  is the one address these trophies live at (PDL P11). */
  part: string | undefined
}) {
  const { t } = useI18n()
  const { memberNumber: reader } = useSession()
  const overlay = useOverlay()
  const state = combinePair(
    combineResources(useCompetitors(), useResults(), useTeams()),
    useDucats(),
  )

  return (
    <Resource state={state}>
      {([[everybody, results, teams], ducats]) => {
        /* The same three answers as the profile itself, from the same place, and through the
           same overlay: this page draws the same head from the same record, and a check written
           on one of the two is a check on neither. */
        const competitors = recordsOf(MEMBERS, everybody, overlay)
        const readable = profileFor(competitors, memberNumber, reader)

        if (readable.kind === 'none') {
          return <h1>{t('profile.notFound')}</h1>
        }

        const { competitor } = readable

        if (readable.kind === 'hidden') {
          return <ProfileHidden name={`${competitor.firstName} ${competitor.lastName}`} />
        }

        return (
          <AwardsFor
            competitor={competitor}
            part={part}
            competitors={competitors}
            results={results}
            ducats={ducats}
            team={teams.find((one) => one.id === competitor.teamId)}
          />
        )
      }}
    </Resource>
  )
}

/** How many rows of ducats stand on the page before the first refill (owner,
 *  11.08.2026). */
const ROWS_AT_FIRST = 5

function AwardsFor({
  competitor,
  part,
  competitors,
  results,
  ducats,
  team,
}: {
  competitor: Parameters<typeof awardsOf>[0]
  part: string | undefined
  competitors: Parameters<typeof awardsOf>[1]
  results: Parameters<typeof awardsOf>[2]
  ducats: Parameters<typeof earnedDucats>[2]
  team: Parameters<typeof ProfileTop>[0]['team']
}) {
  const { locale, t } = useI18n()
  const { search } = useLocation()
  const today = useToday()
  const asked = useSeason()

  const all = useMemo(
    () => awardsOf(competitor, competitors, results),
    [competitor, competitors, results],
  )
  /* Narrowed by the same season the overview is read in (owner, 31.07.2026). The
     control stands at the top of the page and governs both parts, so a season
     chosen among the results is still chosen among the trophies.

     The ducats below are not narrowed and cannot be: a ducat is won over a
     career and carries no season, which is the same reason the note above the
     two sections says what it says. */
  const seasons = useMemo(
    () => seasonOptions([...new Set(all.map((one) => one.season))], asked, today),
    [all, asked, today],
  )
  /* Held against the list before anything is read in it, so the control and the
     trophies below it cannot show two different years. */
  const season = offeredSeason(asked, seasons, undefined)
  const awards = useMemo(
    () => all.filter((one) => season === ALL_SEASONS || String(one.season) === season),
    [all, season],
  )
  /* Today, because the families that repeat only have the months that have
     begun: a ducat for August 2027 is not a ducat anybody can be short of in
     July (ADL A12, 7). */
  const earned = useMemo(
    () => earnedDucats(competitor, results, ducats, today),
    [competitor, results, ducats, today],
  )

  /* One held ducat, in a sentence, for a reader who cannot see the coin. The
     coin is an image with a name rather than a decoration since the hint went
     (11.08.2026), and the name has to tell the hundredth race from the three
     hundredth, which on the coin is the only difference there is.
     
     The period and the value are not in it, because both stand beside the coin
     as words of the page and a screen reader reads the whole card. */
  const labelFor = (ducat: Ducat) => {
    const unit = unitFor(ducat.kind)
    const what = `${formatNumber(ducat.value, locale, 0)}${unit === '' ? '' : ` ${unit}`}`

    /* And what it is worth, which used to stand under the coin as a line of its
       own and was taken off the page (owner, 11.08.2026): a wall of coins with
       a grey sentence under each is a wall of sentences. It stays in the name
       the coin carries, because on the page the only thing left saying a
       bronze from a gold is the colour, and colour is never the only thing that
       says anything (PDL P16, WCAG 2.2 SC 1.4.1). */
    return `${ducat.name}, ${what}. ${t(`ducats.tier.${ducat.tier}`)}`
  }

  /* Five rows of them before the first refill (owner, 11.08.2026), and a row is
     however many stand across the wall at this width: six on a desktop, two on
     a telephone. Newest first is the order `earnedDucats` already hands them
     back in. */
  const wall = useRef<HTMLUListElement>(null)
  const across = useColumns(wall)
  const {
    shown,
    whole,
    asked: askedForMore,
    more,
  } = useGrowing(earned.length, across * ROWS_AT_FIRST)

  const name = `${competitor.firstName} ${competitor.lastName}`

  /* One address and no alias, the same as on the profile itself: a reader who
     arrived by the number alone is moved to the one these trophies live at
     rather than being left on a second address (PDL P11). */
  const elsewhere = redirectTo(competitor, part, locale, '/priznanja')

  if (elsewhere !== null) {
    return <Navigate to={`${elsewhere}${search}`} replace />
  }

  return (
    <div className="profile profile--competitor">
      <PageMeta
        title={t('seo.competitor.awardsTitle', { name })}
        description={t('seo.competitor.awardsDescription', { name })}
      />

      <ProfileTop competitor={competitor} team={team} seasons={seasons} season={season} />

      <section aria-labelledby="awards-trophies">
        <h2 className="profile__section" id="awards-trophies">
          {t('awards.trophies')} <span className="profile__count">{awards.length}</span>
        </h2>

        {awards.length === 0 ? (
          <p className="profile__empty">
            {all.length === 0 ? t('awards.empty') : t('awards.noneInSeason')}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">{t('awards.trophies')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('rankings.season')}</th>
                  <th scope="col">{t('awards.board')}</th>
                  <th scope="col">{t('awards.place')}</th>
                  <th scope="col">{t('profile.columns.points')}</th>
                </tr>
              </thead>
              <tbody>
                {awards.map((award) => (
                  <tr key={`${award.season}-${award.kind}`}>
                    <td>{award.season}</td>
                    <td>
                      {award.kind === 'overall'
                        ? t('awards.overall')
                        : t('awards.category', { category: categoryLabel(award.category, t) })}
                    </td>
                    <td>{t('awards.position', { position: formatNumber(award.position, locale) })}</td>
                    <td className="table__points">{formatPoints(award.points, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="awards-ducats">
        <h2 className="profile__section" id="awards-ducats">
          {t('awards.ducats')} <span className="profile__count">{earned.length}</span>
        </h2>

        {earned.length === 0 ? (
          <p className="profile__empty">{t('awards.noDucats')}</p>
        ) : (
          <ul className="awards__ducats" ref={wall}>
            {earned.slice(0, shown).map((ducat) => (
              <li key={ducat.id} className="awards__ducat">
                <DucatArt ducat={ducat} label={labelFor(ducat)} />
                {/* The name alone. What the coin is worth stood here as „3/5"
                    from 11.08.2026 until 23.08.2026, and it was there because
                    tiers one to three differ by the colour of the metal and by
                    nothing else, which leaves colour saying it on its own (PDL
                    P16, WCAG 2.2 SC 1.4.1). The owner asked for it off the
                    screen knowing that, and chose it over the metal written out
                    in a word. It is still in the name a screen reader is given
                    for the coin beside it, „Vrednost 3 od 5, zlatni dukat"
                    (`labelFor` above), so what is lost is the seeing of it. */}
                <strong>{ducat.name}</strong>
                {/* The name the coin carries leaves the period out on purpose,
                    so the month stands here as words of the page: without
                    it a profile holding July and August reads as one ducat
                    written down twice. Through the same reader of ranges the
                    rest of the portal uses, so "1. do 31. jul" is never what a
                    member is shown. */}
                {ducat.from !== '' && (
                  <span className="profile__scope">
                    {wholePeriod(ducat.from, ducat.to, locale)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {earned.length > 0 && (
          <LoadMore
            whole={whole}
            asked={askedForMore}
            onMore={more}
            words={{
              more: t('profile.moreDucats'),
              showing: t('profile.showingDucats', { shown, total: earned.length }),
              whole: t('profile.allDucats', { count: earned.length }),
            }}
            endShown={false}
          />
        )}
      </section>
    </div>
  )
}

export function CompetitorAwards() {
  const params = useParams()

  return <AwardsBody memberNumber={memberNumberIn(params.memberNumber)} part={params.memberNumber} />
}
