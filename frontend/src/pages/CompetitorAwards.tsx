import { useMemo } from 'react'
import { useParams } from 'react-router'
import { useToday } from '../clock/useClock'
import { PageMeta } from '../app/PageMeta'
import { DucatArt } from '../components/DucatArt'
import { Resource } from '../components/Resource'
import { earnedDucats } from '../data/ducatEarned'
import { unitOf, type Ducat } from '../data/ducatRule'
import { formatNumber, formatPoints, wholePeriod } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
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
import { ProfileHead, ProfileParts } from './profile/ProfileHead'
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
function AwardsBody({ memberNumber }: { memberNumber: string | undefined }) {
  const { t } = useI18n()
  const state = combinePair(
    combineResources(useCompetitors(), useResults(), useTeams()),
    useDucats(),
  )

  return (
    <Resource state={state}>
      {([[competitors, results, teams], ducats]) => {
        const competitor = competitors.find(
          (one) => one.memberNumber === memberNumber && one.active,
        )

        if (competitor === undefined) {
          return <h1>{t('profile.notFound')}</h1>
        }

        return (
          <AwardsFor
            competitor={competitor}
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

function AwardsFor({
  competitor,
  competitors,
  results,
  ducats,
  team,
}: {
  competitor: Parameters<typeof awardsOf>[0]
  competitors: Parameters<typeof awardsOf>[1]
  results: Parameters<typeof awardsOf>[2]
  ducats: Parameters<typeof earnedDucats>[2]
  team: Parameters<typeof ProfileHead>[0]['team']
}) {
  const { locale, t } = useI18n()
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
    const unit = unitOf(ducat)

    return `${ducat.name}, ${formatNumber(ducat.value, locale, 0)}${unit === '' ? '' : ` ${unit}`}.`
  }

  const name = `${competitor.firstName} ${competitor.lastName}`

  return (
    <div className="profile profile--competitor">
      <PageMeta
        title={t('seo.competitor.awardsTitle', { name })}
        description={t('seo.competitor.awardsDescription', { name })}
      />

      <ProfileHead competitor={competitor} team={team} seasons={seasons} season={season} />
      <ProfileParts memberNumber={competitor.memberNumber} />

      <p className="profile__scope">{t('awards.note')}</p>

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
                        : t('awards.category', { category: award.category })}
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
          <ul className="awards__ducats">
            {earned.map((ducat) => (
              <li key={ducat.id} className="awards__ducat">
                <DucatArt ducat={ducat} label={labelFor(ducat)} />
                <strong>{ducat.name}</strong>
                {/* The coin carries the month, and the coin is hidden from a
                    screen reader, so the month has to stand here too: without
                    it a profile holding July and August reads as one ducat
                    written down twice. Through the same reader of ranges the
                    rest of the portal uses, so "1. do 31. jul" is never what a
                    member is shown. */}
                {ducat.from !== '' && (
                  <span className="profile__scope">
                    {wholePeriod(ducat.from, ducat.to, locale)}
                  </span>
                )}
                {/* What it is worth, in words. The metal says it in colour, and
                    colour is never the only thing that says anything
                    (PDL P16, WCAG 2.2 SC 1.4.1). */}
                <span className="profile__scope">{t(`ducats.tier.${ducat.tier}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function CompetitorAwards() {
  const params = useParams()

  return <AwardsBody memberNumber={params.memberNumber} />
}
