import { useEffect, useState } from 'react'
import { ColumnChart, type ChartColumn } from '../../components/ColumnChart'
import { topByCategory } from '../../data/derive'
import type { Competitor, RaceCategory, Result } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { FIRST, NEXT } from './rotation'

/** How long one category stays up before the next one comes round. */
const TURN_MS = 6000

const TOP = 10

/* Two bars and a triangle: the marks every player in the world uses, so the
 * button says what it does without a word on it (owner, 31.07.2026). The name
 * is still there for anyone who cannot see them, in `aria-label`. */
function PauseMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
      <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
    </svg>
  )
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8.5 5.4l10 6.6-10 6.6z" />
    </svg>
  )
}

/* The front page's chart: who has run the most races of one length this season,
 * one category after another, round and round.
 *
 * The chart itself is shared with the Top liste, where the same five lengths
 * stand still, one to a widget (src/components/ColumnChart.tsx). What is left
 * here is the turning and the control that stops it.
 *
 * It turned forever with nothing to stop it, which WCAG 2.2 SC 2.2.2 does not
 * allow: anything that moves by itself for more than five seconds beside other
 * content has to be stoppable. There is a button now, and anyone who has asked
 * their system for less motion gets it stopped to begin with, the same rule the
 * counters in this folder already follow.
 */
export function TopByCategory({
  competitors,
  results,
  season,
  turnMs = TURN_MS,
}: {
  competitors: Competitor[]
  results: Result[]
  season: number
  /** Only a test shortens this; nothing in the application passes it. */
  turnMs?: number
}) {
  const { locale, t } = useI18n()
  const [category, setCategory] = useState<RaceCategory>(FIRST)
  const [turning, setTurning] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (!turning) {
      return
    }

    const turn = setInterval(() => {
      setCategory((current) => NEXT[current])
    }, turnMs)

    return () => clearInterval(turn)
  }, [turnMs, turning])

  const columns: ChartColumn[] = topByCategory(competitors, results, season, category, TOP).map(
    (column) => ({
      key: column.competitor.memberNumber,
      competitor: column.competitor,
      value: column.races,
      label: String(column.races),
      /* The category is carried through to the profile, so it opens on the same
         thing that was pressed (owner, 01.08.2026): a bar under "Najviše
         polumaratona" led to the whole of somebody's running life, and the
         reader had to find the half marathons again by hand.

         The season is written out even though the chart is of the running one: a
         profile opens on all of them by default (owner, 31.07.2026), so leaving
         it out would widen the very thing the bar was showing. */
      to: column.competitor.active
        ? `/${locale}/takmicar/${column.competitor.memberNumber}?sezona=${season}&duzina=${category}`
        : undefined,
    }),
  )

  const name = turning ? t('home.pauseTurning') : t('home.resumeTurning')

  return (
    <ColumnChart
      columns={columns}
      caption={t(`home.mostOf.${category}`)}
      empty={t('home.noneYet')}
      label={t('home.turning')}
      control={
        /* A discreet gold disc in the corner rather than a labelled pill on the
           band below (owner, 31.07.2026). The name it carried is now the
           accessible name; an icon is not a name. It is the name and nothing
           else: a hidden label and a tooltip carrying the same words are read
           out one after the other.

           There is no `aria-pressed` beside it, and there was none before: the
           name says the whole state, and the two together contradicted each
           other. Stopped, the button read "Nastavi smenjivanje" and announced
           itself as pressed, which is heard as "resuming is on", the opposite of
           what is true. A button that renames itself is what the guidance for
           WCAG 2.2 SC 2.2.2 means by a pause control. */
        <button
          type="button"
          className="colchart__turn"
          aria-label={name}
          onClick={() => setTurning((on) => !on)}
        >
          {turning ? <PauseMark /> : <PlayMark />}
        </button>
      }
    />
  )
}
