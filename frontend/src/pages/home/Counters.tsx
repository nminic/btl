import type { ReactNode } from 'react'
import type { Totals } from '../../data/derive'
import { formatDuration, formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useCountUp } from './useCountUp'

/* The scoreboard of the league, in the shape it had on the old portal: a gold
 * medallion carrying the mark, then a blue pill carrying the number. The owner
 * values this widget above everything else on the page.
 *
 * One thing did change: the points are called BTL points and no longer BTLs.
 */

function Runner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <circle cx="15" cy="4.6" r="1.9" fill="currentColor" stroke="none" />
      <path d="M13.6 9.4L9.2 11l-2.1 3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21l3.2-5 3.4-2-1-4.6 3.4 2.6 2.6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.4 19.6L8 15" strokeLinecap="round" />
    </svg>
  )
}

function Flag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M6 21V4" strokeLinecap="round" />
      <path d="M6 4.5h10l-2 3.2 2 3.3H6z" strokeLinejoin="round" />
    </svg>
  )
}

function Ascent() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M4 18h16L4 6z" strokeLinejoin="round" />
    </svg>
  )
}

function Descent() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M4 18h16L20 6z" strokeLinejoin="round" />
    </svg>
  )
}

function Clock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.5l3.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3.5l2.6 5.5 5.9.8-4.3 4.2 1 6-5.2-2.9-5.2 2.9 1-6L3.5 9.8l5.9-.8z" />
    </svg>
  )
}

function Row({
  icon,
  label,
  value,
  text,
  unit,
  decimals = 0,
}: {
  icon: ReactNode
  label: string
  value: number
  text?: string
  unit?: string
  decimals?: number
}) {
  const { locale } = useI18n()
  const shown = useCountUp(value)

  return (
    <div className="score">
      <span className="score__mark" aria-hidden="true">
        {icon}
      </span>
      <span className="score__pill">
        <span className="visually-hidden">{label}: </span>
        {text ?? `${formatNumber(shown, locale, decimals)}${unit ?? ''}`}
      </span>
    </div>
  )
}

export function Counters({ totals, seasonLabel }: { totals: Totals; seasonLabel: string }) {
  const { t } = useI18n()

  return (
    <section className="scoreboard" aria-labelledby="counters-heading">
      <h2 className="scoreboard__title" id="counters-heading">
        {seasonLabel}
      </h2>

      <Row icon={<Flag />} label={t('home.races')} value={totals.races} />
      <Row
        icon={<Runner />}
        label={t('home.kilometers')}
        value={totals.kilometers}
        unit=" km"
        decimals={2}
      />
      <Row icon={<Ascent />} label={t('home.ascent')} value={totals.ascent} unit=" m" />
      <Row icon={<Descent />} label={t('home.descent')} value={totals.descent} unit=" m" />
      <Row
        icon={<Clock />}
        label={t('home.onCourse')}
        value={totals.seconds}
        text={formatDuration(totals.seconds)}
      />
      <Row
        icon={<Star />}
        label={t('home.points')}
        value={totals.points}
        unit=" BTL points"
        decimals={2}
      />

      <p className="scoreboard__note">{t('home.countersNote')}</p>
    </section>
  )
}
