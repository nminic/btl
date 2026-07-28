import { formatDuration, formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import type { Totals } from '../../data/derive'
import { useCountUp } from './useCountUp'

function Counter({ labelKey, value, text }: { labelKey: string; value: number; text?: string }) {
  const { locale, t } = useI18n()
  const shown = useCountUp(value)

  return (
    <div>
      <dt>{t(labelKey)}</dt>
      <dd>{text === undefined ? formatNumber(shown, locale) : text}</dd>
    </div>
  )
}

/* The scoreboard of the league: five numbers the owner values above everything
 * else on this page. Gold carries a surface here and nowhere else. */
export function Counters({ totals, seasonLabel }: { totals: Totals; seasonLabel: string }) {
  const { t } = useI18n()

  return (
    <section className="counter" aria-labelledby="counters-heading">
      <h2 className="counter__title" id="counters-heading">
        {seasonLabel}
      </h2>
      <dl className="counter__numbers">
        <Counter labelKey="home.kilometers" value={totals.kilometers} />
        <Counter labelKey="home.ascent" value={totals.ascent} />
        <Counter labelKey="home.descent" value={totals.descent} />
        <Counter labelKey="home.onCourse" value={totals.seconds} text={formatDuration(totals.seconds)} />
        <Counter labelKey="home.points" value={totals.points} />
      </dl>
      <p className="counter__note">{t('home.countersNote')}</p>
    </section>
  )
}
