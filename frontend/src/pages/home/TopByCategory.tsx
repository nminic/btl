import { useEffect, useState } from 'react'
import { ColumnChart, type ChartColumn } from '../../components/ColumnChart'
import { topByCategory } from '../../data/derive'
import type { Competitor, RaceCategory, Result } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { FIRST, NEXT } from './rotation'

/** How long one category stays up before the next one comes round. */
const TURN_MS = 6000

const TOP = 10

/** How long the words are out of sight while the chart changes what it counts.
 *  Half of what the bars take to travel (ColumnChart.css, `--turn`), so the new
 *  words arrive while the bars are still on their way and nothing lands at once. */
const FADE_MS = 210

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
  /* Two of them, and the difference between them is the whole of the change.
     `category` is where the chart is going; `shown` is what is on the screen
     while it gets there. They are apart only during the fade. */
  const [category, setCategory] = useState<RaceCategory>(FIRST)
  const [shown, setShown] = useState<RaceCategory>(FIRST)
  const [turning, setTurning] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  /* The bars, while somebody has one of them by the keyboard.
   *
   * The element and not a yes or a no, and that is the whole of what a review
   * found wrong with the first version of this. A remembered „held" has to be
   * unremembered by somebody, and there is a case where nobody can: the chart
   * redraws with fewer columns, the one holding the focus is taken out of the
   * page, and React sends no `focusout` for an element that is no longer there.
   * The chart then waited for a reader who had already gone, for ever, while the
   * button went on offering to stop something standing still. Measured: focus
   * fell to the body and no turn came in two thousand milliseconds.
   *
   * Kept apart from `turning` for a different reason, and that reason stands:
   * one is what the reader asked for with the button, which the button's name
   * has to go on saying; the other is a wait that ends by itself. Folded
   * together, tabbing through the chart would rename the button and leave it
   * renamed, so a reader would be told they had stopped something they never
   * touched. */
  const [bars, setBars] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!turning) {
      return
    }

    const turn = setInterval(() => {
      /* Asked of the page at the moment the turn is due, rather than of what was
         remembered when the focus arrived. An element taken out of the page
         contains nothing, so a reader who has gone stops holding anything
         without having to be noticed leaving. */
      if (bars !== null && bars.contains(document.activeElement)) {
        return
      }

      setCategory((current) => NEXT[current])
    }, turnMs)

    return () => clearInterval(turn)
  }, [turnMs, turning, bars])

  /* Taking hold of a column puts back a turn that had already set off.
   *
   * The turn is two steps: the words go out, and a third of a fade later what is
   * counted changes. Holding only the first left the second to finish under a
   * reader who arrived in between, which is a two hundred and ten millisecond
   * window in every six seconds, and inside it the very thing this is written to
   * stop still happened: the link under their finger became somebody else's.
   * Measured by a review, and worse than a smaller window, because the redraw
   * could take the focused column away with it.
   *
   * Put back rather than stopped halfway: `category` returns to what is on the
   * screen, the pending swap is cleared by its own effect, and the words fade
   * back in. The reader keeps the chart they tabbed into. */
  function hold(taken: HTMLElement | null): void {
    setBars(taken)

    if (taken !== null) {
      setCategory(shown)
    }
  }

  /* The words go out, then what is counted changes, then they come back. The
     bars need no such thing: their height is a style and a style slides, so they
     set off the moment the swap happens and arrive on their own (owner,
     11.08.2026).
   *
     Never longer than a third of a turn, so a chart hurried along by a test
     spends most of its time showing something rather than fading. */
  useEffect(() => {
    if (shown === category) {
      return
    }

    const swap = setTimeout(() => setShown(category), Math.min(FADE_MS, turnMs / 3))

    return () => clearTimeout(swap)
  }, [category, shown, turnMs])

  const columns: ChartColumn[] = topByCategory(competitors, results, season, shown, TOP).map(
    (column) => ({
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
        ? `/${locale}/takmicar/${column.competitor.memberNumber}?sezona=${season}&duzina=${shown}`
        : undefined,
    }),
  )

  const name = turning ? t('home.pauseTurning') : t('home.resumeTurning')

  return (
    <ColumnChart
      columns={columns}
      onHeld={hold}
      swapping={shown !== category}
      caption={t(`home.mostOf.${shown}`)}
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
