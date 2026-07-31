import { useSearchParams } from 'react-router'
import { useToday } from '../../clock/useClock'
import { useI18n } from '../../i18n/useI18n'
import { ALL_SEASONS, useSeason } from './season'

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
export function SeasonPicker({ seasons }: { seasons: number[] }) {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const season = useSeason()
  const today = useToday()

  function choose(value: string) {
    const merged = new URLSearchParams(params)

    /* Written into the address unless it is the default, so an address stays as
       short as it can be, and choosing all of them has to be said out loud:
       deleting the parameter would put the reader back on the running season. */
    if (value === today.slice(0, 4)) {
      merged.delete('sezona')
    } else {
      merged.set('sezona', value)
    }

    setParams(merged)
  }

  return (
    <label className="profile__season">
      <span className="visually-hidden">{t('rankings.season')}</span>
      <select value={season} onChange={(event) => choose(event.target.value)}>
        <option value={ALL_SEASONS}>{t('profile.allTime')}</option>
        {seasons.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  )
}
