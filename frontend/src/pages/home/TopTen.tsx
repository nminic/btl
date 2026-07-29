import { Link } from 'react-router'
import { topTen } from '../../data/derive'
import type { Competitor, Gender, Result } from '../../data/types'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'

export function TopTen({
  competitors,
  results,
  season,
  gender,
}: {
  competitors: Competitor[]
  results: Result[]
  season: number
  gender: Gender
}) {
  const { locale, t } = useI18n()
  const rows = topTen(competitors, results, season, gender)
  const scored = rows.some((row) => row.points > 0)
  const headingId = `top-ten-${gender}`

  return (
    <section className="card" aria-labelledby={headingId}>
      <h2 className="card__title" id={headingId}>
        {t(gender === 'M' ? 'home.topMen' : 'home.topWomen')}
      </h2>

      <ol className="top-ten">
        {rows.map((row) => (
          <li key={row.competitor.memberNumber} className={row.position <= 3 ? 'podium' : undefined}>
            <span className="top-ten__place">{row.position}</span>
            <Link className="top-ten__name" to={`/${locale}/takmicar/${row.competitor.memberNumber}`}>
              {row.competitor.firstName} {row.competitor.lastName}
            </Link>
            {scored && <span className="top-ten__points">{formatPoints(row.points, locale)}</span>}
          </li>
        ))}
      </ol>

      {/* Before the first race there is nothing to rank, so the list says what
          it is actually showing rather than pretending to be a standing. */}
      {!scored && <p className="card__note">{t('home.topBeforeSeason')}</p>}

      {/* The standing lives at /tabela; /rang-liste is the page of top boards
          beside it (PDL P28a). */}
      <Link className="card__more" to={`/${locale}/tabela?pol=${gender === 'M' ? 'm' : 'z'}`}>
        {t('home.wholeStanding')}
      </Link>
    </section>
  )
}
