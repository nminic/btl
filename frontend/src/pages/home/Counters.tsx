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
 * The heading is handed in rather than being the season, and only the front
 * page hands one in. On a profile, and now on a team as well, the season is
 * chosen once above the widget and the one beside it, and repeating it inside
 * would be the same word twice on one screen (owner, 30.07.2026).
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
   so it is the one row a figure of a person belongs on.

   A runner, a simpler sketch of the one in the header at the top right of every page (owner,
   20.11.2026: „zasto ne nesto u smeru ovog gore desno na sajtu samo jednostavnija skica?"),
   as drawn in the plan he approved (`predlozi/plan-dodaci-naslovne.html`). A filled shape
   rather than a line: the champion with both arms up (31.07.2026) and the runner before it
   were lines, and at twenty pixels the limbs of a line figure are a blot. */
function Runner() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth=".5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.1 1.0 L18.4 2.2 L18.1 4.1 L17.0 4.6 L17.3 7.9 L20.1 6.9 L20.7 7.7 L16.8 9.4 L15.7 8.7 L14.4 10.5 L18.2 12.8 L15.5 17.4 L17.0 19.8 L14.9 20.2 L13.6 18.2 L15.9 13.6 L13.0 13.0 L5.1 20.1 L4.7 22.8 L3.9 23.0 L3.3 19.9 L8.7 15.1 L12.9 7.9 L13.5 5.5 L12.3 4.9 L10.0 8.5 L8.9 8.2 L11.4 3.9 L15.5 3.8 L15.6 2.3 L15.0 2.3 L16.3 1.2Z" />
    </svg>
  )
}

/* The place the members come from: a pin over a point, the shape every map gives a town
   (owner, 20.11.2026, the eighth tile). */
function Pin() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
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
  shortUnit,
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
  /**
   * The unit written short, for the one row whose figure is long and whose tile can be narrow: where the
   * tile is too narrow for the whole sentence, the figure is rounded to whole numbers and carries this
   * instead of `unit` (owner, 20.11.2026: „da piše XX.XXX p / pts (zaokruženo bez decimala i da se
   * skrati BTL poena u p ili pts)", and „Na velikom prikazu ovde treba da ostane BTL poena"). Which of the
   * two is drawn is the tile's own width and not the window's (`Home.css`, a container query).
   */
  shortUnit?: string
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
      /* `count` picks the form of the word, `number` is what is written: the figure goes through the
         formatter like every other tile's, so 2356 results are „2.356 rezultata" (owner, 20.11.2026). */
      return t(counted, { count: shown, number: formatNumber(shown, locale) })
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
        {shortUnit === undefined ? (
          reading()
        ) : (
          <>
            <span className="score__full">{reading()}</span>
            {/* The whole name is what a screen reader is given in both shapes; the short one is only
                for the eye (owner, 20.11.2026: „čitač ekrana i dalje čuje pun naziv"). */}
            <span className="score__short">
              <span aria-hidden="true">
                {formatNumber(Math.round(running), locale)}
                {shortUnit}
              </span>
              <span className="visually-hidden">
                {formatNumber(Math.round(running), locale)}
                {unit}
              </span>
            </span>
          </>
        )}
      </span>
    </div>
  )
}

export function Counters({
  totals,
  title,
  races = true,
  members,
  cities,
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
   * How many different places those members come from, the second tile after the members (owner,
   * 20.11.2026). Handed in by the front page with `members`, for the same reason: on a team and on
   * a profile it would count one or two places and say nothing.
   */
  cities?: number
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
  const { locale, t } = useI18n()

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
      {cities !== undefined && (
        <Row
          countMs={countMs}
          icon={<Pin />}
          label={t('home.cities')}
          value={cities}
          counted="units.cityCount"
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
        text={formatCourseTime(totals.seconds, locale)}
      />
      <Row
        countMs={countMs}
        icon={<Star />}
        label={t('home.points')}
        value={totals.points}
        unit={t('home.pointsUnit')}
        shortUnit={t('home.pointsUnitShort')}
        decimals={2}
      />
    </section>
  )
}
