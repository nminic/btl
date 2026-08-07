import { useI18n } from '../i18n/useI18n'
import { ALL_SEASONS } from './season'
import { useFilterParams } from '../app/useFilterParams'

/**
 * The season control, beside the heading of whatever screen it governs.
 *
 * One shape everywhere (owner, 05.08.2026). It had two: a named field beside a
 * heading and a pill with its name hidden beside a person's or a team's name, on
 * the reasoning that a labelled field next to a name reads as a second heading.
 * The owner asked for the field on the profile as well, and with that the pill
 * had nowhere left to be drawn.
 *
 * At the top of the page rather than inside one of its parts, because it governs
 * both of them: the results below and the trophies on the other part are both
 * read season by season.
 *
 * What it looks like is the shared field's business (`rankings__field` in
 * Rankings.css), which is what one shape means: the pill had a stylesheet of its
 * own here, and it went with the pill.
 */
export function SeasonPicker({
  seasons,
  season,
  fallback,
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

  return (
    <label className="rankings__field">
      <span>{t('rankings.season')}</span>
      {years}
    </label>
  )
}
