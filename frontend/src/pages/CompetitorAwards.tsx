import { useMemo } from 'react'
import { useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { BadgeArt } from '../components/BadgeArt'
import { Resource } from '../components/Resource'
import { earnedBadges } from '../data/badgeEarned'
import { thresholdOf } from '../data/badgeRule'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import {
  combinePair,
  combineResources,
  useBadges,
  useCompetitors,
  useResults,
  useTeams,
} from '../data/useResource'
import { awardsOf } from './profile/awards'
import { ProfileHead, ProfileParts } from './profile/ProfileHead'
import './Profile.css'

/**
 * The second part of a profile: what this competitor has won.
 *
 * Its own address rather than a section at the foot of the overview (the design
 * decision of 30.07.2026). It is the one kind of thing here that is not scoped
 * to a season: a trophy and a badge are permanent by decision, "osvojeno se
 * nikad ne skida" (PDL P11), so it has no business inside a page governed by a
 * season filter.
 *
 * The owner calls the badges "BTL novčići", after the coin they are drawn as.
 * The portal calls them badges everywhere, including here: there is already a
 * public page that is the catalogue of all of them and how they are won, and one
 * thing must not have two names. This is the collection rather than the
 * catalogue.
 */
function AwardsBody({ memberNumber }: { memberNumber: string | undefined }) {
  const { t } = useI18n()
  const state = combinePair(
    combineResources(useCompetitors(), useResults(), useTeams()),
    useBadges(),
  )

  return (
    <Resource state={state}>
      {([[competitors, results, teams], badges]) => {
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
            badges={badges}
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
  badges,
  team,
}: {
  competitor: Parameters<typeof awardsOf>[0]
  competitors: Parameters<typeof awardsOf>[1]
  results: Parameters<typeof awardsOf>[2]
  badges: Parameters<typeof earnedBadges>[2]
  team: Parameters<typeof ProfileHead>[0]['team']
}) {
  const { locale, t } = useI18n()

  const awards = useMemo(
    () => awardsOf(competitor, competitors, results),
    [competitor, competitors, results],
  )
  const earned = useMemo(
    () => earnedBadges(competitor, results, badges),
    [competitor, results, badges],
  )

  const name = `${competitor.firstName} ${competitor.lastName}`

  return (
    <div className="profile">
      <PageMeta
        title={t('seo.competitor.awardsTitle', { name, number: competitor.memberNumber })}
        description={t('seo.competitor.awardsDescription', { name })}
      />

      <ProfileHead competitor={competitor} team={team} />
      <ProfileParts memberNumber={competitor.memberNumber} />

      <p className="profile__scope">{t('awards.note')}</p>

      <section aria-labelledby="awards-trophies">
        <h2 className="profile__section" id="awards-trophies">
          {t('awards.trophies')} <span className="profile__count">{awards.length}</span>
        </h2>

        {awards.length === 0 ? (
          <p className="profile__empty">{t('awards.empty')}</p>
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

      <section aria-labelledby="awards-badges">
        <h2 className="profile__section" id="awards-badges">
          {t('awards.badges')} <span className="profile__count">{earned.length}</span>
        </h2>

        {earned.length === 0 ? (
          <p className="profile__empty">{t('awards.noBadges')}</p>
        ) : (
          <ul className="awards__badges">
            {earned.map((badge) => (
              <li key={badge.id} className="awards__badge">
                <BadgeArt
                  kind={badge.kind}
                  threshold={thresholdOf(badge, locale)}
                  label={badge.label}
                />
                <strong>{badge.name}</strong>
                <span className="profile__scope">{badge.description}</span>
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
