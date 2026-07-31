import type { ReactNode } from 'react'
import type { Totals } from '../../data/derive'
import { formatCourseTime, formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useCountUp } from './useCountUp'

/* The scoreboard of the league, in the shape it had on the old portal: a gold
 * medallion carrying the mark, then a blue pill carrying the number. The owner
 * values this widget above everything else on the page.
 *
 * One thing did change: the points are called BTL points and no longer BTLs.
 *
 * The heading is handed in rather than being the season. On the front page and
 * on a team it is what it always was; on a profile the season is chosen once,
 * above the widget and the one beside it, and repeating it inside would be the
 * same word twice on one screen (owner, 30.07.2026).
 */

/* Kilometres are a road, not a runner (owner, 31.07.2026). A running figure was
   the mark for the one row that is not about running at all: every other row on
   this widget is also something a runner did, so the figure said nothing, and at
   this size its limbs turned into a knot. A road narrowing into the distance
   says length and says it at twenty pixels, and it narrows upwards, which is the
   way a road going away from you looks (owner, 31.07.2026). */
function Road() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M6.2 21L8.4 3.5" strokeLinecap="round" />
      <path d="M17.8 21l-2.2-17.5" strokeLinecap="round" />
      <path d="M12 5.6v2.6M12 11.4v2.6M12 17.2v2.6" strokeLinecap="round" />
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

/* The one row on this widget that counts people rather than something they did,
   so it is the one row a running figure belongs on (owner, 31.07.2026). */
function Runner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <circle cx="14.6" cy="4.6" r="2.1" />
      <path
        d="M13.2 9.1L9.4 11l1.1 3.6 3.1 1.5 1.4 5.2M13.2 9.1l3.9 1.3 1.9 3.3M10.5 14.6L7.2 19"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* The two wedges were the wrong way round: the climb has to rise to the right,
   the descent has to fall away from the left (owner, 29.07.2026). */
function Ascent() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M4 18h16L20 6z" strokeLinejoin="round" />
    </svg>
  )
}

function Descent() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M4 18h16L4 6z" strokeLinejoin="round" />
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
  unit = '',
  counted,
  decimals = 0,
  countMs,
}: {
  icon: ReactNode
  label: string
  value: number
  text?: string
  unit?: string
  /** Key of a counted phrase, for the one row whose unit declines: trka, trke. */
  counted?: string
  decimals?: number
  countMs?: number
}) {
  const { locale, t } = useI18n()
  const running = useCountUp(value, countMs)

  /* A row that shows no decimals must not count in them either (owner,
     31.07.2026). The number unrolling behind this is a fraction on every frame,
     and the races row hands it straight to the plural rules: Serbian picks a
     form per number, so a count of 812.4 chose the form for "other" and the word
     beside the number flickered between cases all the way up. Rounding here
     fixes the word as well as the digits, and the rows that do show decimals are
     untouched. */
  const shown = decimals === 0 ? Math.round(running) : running

  function reading(): string {
    if (text !== undefined) {
      return text
    }

    if (counted !== undefined) {
      return t(counted, { count: shown })
    }

    return `${formatNumber(shown, locale, decimals)}${unit}`
  }

  return (
    <div className="score">
      <span className="score__mark" aria-hidden="true">
        {icon}
      </span>
      <span className="score__pill">
        <span className="visually-hidden">{label}: </span>
        {reading()}
      </span>
    </div>
  )
}

export function Counters({
  totals,
  title,
  races = true,
  members,
  countMs,
}: {
  totals: Totals
  /**
   * How many members the league has in the season this widget counts, on top of
   * the widget (owner, 31.07.2026).
   *
   * Only the front page hands it in. On a team and on a profile the number of
   * people is either one or already the heading, and a row saying "1 član" over
   * somebody's own totals is a row wasted.
   */
  members?: number
  /**
   * Shown above the rows on the front page and on a team, where this widget
   * stands on its own and the heading says which season it is counting.
   *
   * The profile hands in nothing (owner, 31.07.2026). There the season is chosen
   * in the control above the whole row, so a heading reading "Zbirna statistika"
   * over what is visibly a set of totals was a line of furniture. The name is
   * kept where a screen reader can still find it.
   */
  title?: string
  /**
   * Whether the races are counted here.
   *
   * The profile says no: the ring standing beside this widget carries the number
   * of races in its middle, and the same number twice on one line is one of them
   * wasted. Its own switch and not a corollary of the heading, because they are
   * two decisions that only happen to be made together on one screen.
   */
  races?: boolean
  /** How long the numbers take to unroll. Only a test sets it, to nought;
   *  nothing in the application passes it, the same arrangement the turning
   *  chart on this page has. */
  countMs?: number
}) {
  const { t } = useI18n()

  return (
    <section
      className="scoreboard"
      aria-labelledby={title === undefined ? undefined : 'counters-heading'}
      aria-label={title === undefined ? t('profile.stats') : undefined}
    >
      {title !== undefined && (
        <h2 className="scoreboard__title" id="counters-heading">
          {title}
        </h2>
      )}

      {/* Every row carries its own unit, so a number never stands there
          meaning whatever the reader guesses (owner, 29.07.2026). */}
      {members !== undefined && (
        <Row
          countMs={countMs}
          icon={<Runner />}
          label={t('home.members')}
          value={members}
          counted="units.memberCount"
        />
      )}
      {/* What is counted here is results, not races: two members who ran the
          same race are two of these, and calling them races said the league had
          run a hundred and seventy events (owner, 31.07.2026). */}
      {races && (
        <Row
          countMs={countMs}
          icon={<Flag />}
          label={t('home.results')}
          value={totals.races}
          counted="units.resultCount"
        />
      )}
      <Row
        countMs={countMs}
        icon={<Road />}
        label={t('home.kilometers')}
        value={totals.kilometers}
        unit=" km"
        decimals={2}
      />
      <Row
        countMs={countMs}
        icon={<Ascent />}
        label={t('home.ascent')}
        value={totals.ascent}
        unit={t('home.ascentUnit')}
      />
      <Row
        countMs={countMs}
        icon={<Descent />}
        label={t('home.descent')}
        value={totals.descent}
        unit={t('home.descentUnit')}
      />
      <Row
        countMs={countMs}
        icon={<Clock />}
        label={t('home.onCourse')}
        value={totals.seconds}
        text={formatCourseTime(totals.seconds)}
      />
      <Row
        countMs={countMs}
        icon={<Star />}
        label={t('home.points')}
        value={totals.points}
        unit={t('home.pointsUnit')}
        decimals={2}
      />
    </section>
  )
}
