import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../components/Resource'
import {
  categoryOfMember,
  defaultSeason,
  overallStanding,
  seasonsWithResults,
} from '../data/derive'
import { combinePair, useCompetitors, useResults } from '../data/useResource'
import { formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'

/* The league's own table: everybody in one standing for the season, men and
 * women together. The rankings screen is the one that splits by gender and
 * category (PDL P12); this one is the single line-up the league is known by. */
export function BtlTable() {
  const { locale, t } = useI18n()
  const [season, setSeason] = useState<number | null>(null)
  const state = combinePair(useCompetitors(), useResults())

  return (
    <div className="rankings">
      <h1>{t('nav.btlTable')}</h1>
      <p className="rankings__note">{t('btlTable.intro')}</p>

      <Resource state={state}>
        {([people, all]) => {
          const seasons = seasonsWithResults(all)
          const chosen = season ?? defaultSeason(all, new Date().toISOString().slice(0, 10))
          const rows = overallStanding(people, all, chosen)

          return (
            <>
              <div className="field">
                <label className="field__label" htmlFor="btl-season">
                  {t('rankings.season')}
                </label>
                <select
                  className="field__control"
                  id="btl-season"
                  value={chosen}
                  onChange={(event) => setSeason(Number(event.target.value))}
                >
                  {seasons.map((one) => (
                    <option key={one} value={one}>
                      {one}
                    </option>
                  ))}
                </select>
              </div>

              {rows.length === 0 ? (
                <p className="profile__empty">{t('rankings.empty')}</p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <caption className="visually-hidden">{t('nav.btlTable')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('rankings.columns.position')}</th>
                        <th scope="col">{t('rankings.columns.member')}</th>
                        <th scope="col">{t('rankings.columns.category')}</th>
                        <th scope="col">{t('rankings.columns.races')}</th>
                        <th scope="col">{t('rankings.columns.distance')}</th>
                        <th scope="col">{t('rankings.columns.points')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.competitor.memberNumber}>
                          <td>{formatNumber(row.position, locale)}</td>
                          <td>
                            <Link to={`/${locale}/takmicar/${row.competitor.memberNumber}`}>
                              {row.competitor.firstName} {row.competitor.lastName}
                            </Link>
                          </td>
                          <td>{categoryOfMember(row.competitor, chosen)}</td>
                          <td>{formatNumber(row.races, locale)}</td>
                          <td>{formatNumber(row.kilometers, locale, 1)}</td>
                          <td>{formatNumber(row.points, locale, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
