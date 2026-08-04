import { useI18n } from '../i18n/useI18n'
import { ALL_SEASONS } from './season'
import { useFilterParams } from '../app/useFilterParams'

/**
 * The season control, beside the name of the competitor (owner, 31.07.2026).
 *
 * At the top of the page rather than inside one of its parts, because it governs
 * both of them: the results below and the trophies on the other part are both
 * read season by season.
 *
 * The colours are set on the control and on its options. A select with
 * `appearance: none` and no background of its own hands the browser's own
 * dropdown a light text colour and a white sheet to put it on, and on the dark
 * theme the years were invisible in the open list.
 */
export function SeasonPicker({
  seasons,
  season,
  fallback,
  named = false,
}: {
  seasons: number[]
  /**
   * The season the screen is being read in. Handed in rather than read from the
   * address here, so that the control and the content below it cannot disagree:
   * whoever draws the table works out which season it is, and the control shows
   * that same one.
   */
  season: string
  /**
   * What the control shows when the address says nothing, and the one value the
   * address never carries.
   *
   * The profile hands in nothing and gets all of them. The teams hand in the
   * running year, and by handing in a year they also lose the option of all of
   * them, which is what they want: a team is a thing of one season.
   */
  fallback?: string
  /**
   * Draws the control with its name beside it, in the shape a screen with a
   * heading uses (owner, 04.08.2026: the one on the teams "je ružnija nego u Top
   * listama").
   *
   * Two shapes, because there are two places. Beside a heading it stands in a row
   * of controls and says what it is, like the season on the Top liste and the
   * search on the competitors. Beside a name, on a profile, the name is what the
   * screen is about and a labelled field beside it would read as a second
   * heading, so there it is a pill and says its name only to a screen reader.
   */
  named?: boolean
}) {
  const { t } = useI18n()
  const [params, setParams] = useFilterParams()
  const all = fallback === undefined

  function choose(value: string) {
    const merged = new URLSearchParams(params)

    /* Written into the address unless it is the default, so an address stays as
       short as it can be. The default is all of them (owner, 31.07.2026), so
       that is the one value the address does not carry. */
    if (value === (fallback ?? ALL_SEASONS)) {
      merged.delete('sezona')
    } else {
      merged.set('sezona', value)
    }

    setParams(merged)
  }

  const years = (
    <select value={season} onChange={(event) => choose(event.target.value)}>
      {all && <option value={ALL_SEASONS}>{t('profile.allTime')}</option>}
      {seasons.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  )

  if (named) {
    return (
      <label className="rankings__field">
        <span>{t('rankings.season')}</span>
        {years}
      </label>
    )
  }

  return (
    <label className="profile__season">
      <span className="visually-hidden">{t('rankings.season')}</span>
      {years}
    </label>
  )
}
