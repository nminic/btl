import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Competitor } from '../data/types'
import { Portrait } from './Portrait'
import './ColumnChart.css'

/* The bar chart from the old portal: faces on top, blue columns, the number in a
 * circle at the foot of each, and a gold band underneath naming what is being
 * counted.
 *
 * It was the front page's turning chart and nothing else until 04.08.2026, when
 * the owner asked for the Top liste to be drawn the same way: "poslednjih 5
 * vidžeta uradi grafikone kao sa naslovne strane". So it lives here, and the
 * front page is one caller of it (pages/home/TopByCategory.tsx).
 *
 * What a bar is measured by is the caller's business. This draws a share of the
 * tallest and writes what it is told inside it.
 */

export type ChartColumn = {
  competitor: Competitor
  /** How tall the bar stands, against the tallest column in the chart. */
  value: number
  /** What is written in the bar. */
  label: string
  /**
   * What that number is, read out after it and never drawn.
   *
   * A number in a bar under a caption that names the board says enough on its
   * own while there is one of them. Two of them in one bar do not: "26 12" is
   * not a fact anybody can use. Left out where the caption is the whole answer.
   */
  reading?: string
  /**
   * The lower, quieter level of a two-level bar, and what is written in it.
   *
   * One bar carries two numbers on the board of best progress (owner,
   * 04.08.2026): the season before at the foot, the gain on top of it. The whole
   * column is therefore this season, which is the only reading of it that makes
   * the two levels add up.
   */
  base?: { value: number; label: string; reading?: string }
  /**
   * Which place this is, in words, read out before the number and never drawn.
   *
   * A list of ten in an `ol` numbers itself 1 to 10, and the place is said in
   * words rather than left to that, because the chart may be cut short, filtered
   * or drawn from a board that starts elsewhere. The tables have a column for
   * it; a chart has nowhere to put it, so it is said. Left out on the front
   * page, where the chart is a widget and not a standing.
   *
   * Until 11.08.2026 the reason was a different one: a place nothing separated
   * was shared, so a board could read 1, 1, 3 (Član 50 of the rulebook). There
   * is no shared place any more (PDL P12), and the reading is still not the
   * row number.
   */
  place?: string
  /** Where the column leads. Missing where there is nothing to lead to: a member
   *  whose fee has run out has no visible profile (PDL P11), so their column
   *  stands in the chart with no link on it, the same as in the tables. */
  to?: string
}

/** The number in a level of a bar, with what it is read out after it. */
function Count({ label, reading, quiet }: { label: string; reading?: string; quiet?: boolean }) {
  return (
    <span className={quiet === true ? 'colchart__count colchart__count--quiet' : 'colchart__count'}>
      {label}
      {reading !== undefined && <span className="visually-hidden"> {reading}</span>}
    </span>
  )
}

/**
 * One column: a bar as tall as the share it stands for, carrying its number and,
 * out of sight until it is wanted, the name it belongs to.
 *
 * A link while there is a profile to link to, and a plain block otherwise.
 */
function Bar({ column, highest }: { column: ChartColumn; highest: number }) {
  const name = `${column.competitor.firstName} ${column.competitor.lastName}`
  const { base } = column
  /* What the two levels of a two-level bar are shares of, held at one the same
     way the chart holds its tallest column: a column of nought has no bar for
     the levels to divide up, and a floor here is cheaper than a division to
     defend against everywhere it is used. */
  const whole = Math.max(1, column.value)

  const inside = (
    <>
      {/* Said first, before the number, because that is the order a standing is
          read in. Never drawn: the bars are already in order and a chart with a
          rank written on every column is a table with pictures. */}
      {column.place !== undefined && <span className="visually-hidden">{column.place}</span>}

      {/* The face, the bar and the name all stand in the track, because all
          three are placed from the bar's own height: the face rides on top of
          it and the name is across the middle of the face. */}
      <span className="colchart__track">
        <Portrait competitor={column.competitor} />
        <span className="colchart__bar">
          {base === undefined ? (
            <Count label={column.label} reading={column.reading} />
          ) : (
            <>
              {/* Two levels in one bar. Each is a share of the bar rather than of
                  the track, so the two of them are exactly the bar between them
                  and the number in each sits in the middle of its own level
                  instead of in the middle of both.

                  The lower one first, which is also the order they are read in:
                  what was already there, then what was added to it. */}
              <span
                className="colchart__level colchart__level--base"
                style={{ '--level': share(base.value, whole) }}
              >
                <Count label={base.label} reading={base.reading} quiet />
              </span>
              <span
                className="colchart__level colchart__level--top"
                style={
                  { '--level': share(column.value - base.value, whole) }
                }
              >
                <Count label={column.label} reading={column.reading} />
              </span>
            </>
          )}
          {/* Seen on hover and on focus, read out always.
           *
           * Inside the bar, which is what it is measured from. The face rides on
           * top of the bar, so where the face is depends on how tall the bar came
           * out; the name used to be placed at a fixed distance from the top of
           * the column, which is right for the tallest column and for no other,
           * and on the shorter ones it hung as much as a hundred and fifty pixels
           * above the face it names (owner, 03.08.2026).
           *
           * The asked-for height cannot answer that either, because the bar does
           * not always get it: the tallest bar asks for the whole column and then
           * gives room back to the face above it, so the number in the style and
           * the number on the screen are fifty pixels apart. Only the bar knows
           * how tall the bar ended up, and inside it `100%` is that. */}
          <span className="colchart__who">{name}</span>
        </span>
      </span>
    </>
  )

  /** How tall this bar asks to be. */
  const height = { '--bar': share(column.value, highest) }

  if (column.to === undefined) {
    return (
      <span className="colchart__link" style={height} title={name}>
        {inside}
      </span>
    )
  }

  return (
    <Link className="colchart__link" style={height} title={name} to={column.to}>
      {inside}
    </Link>
  )
}

/** A part of a whole, as a percentage the stylesheet can use. The whole is
 *  always at least one, held that way where it is worked out, so there is no
 *  division by nought here to be guarded against. */
function share(part: number, whole: number): string {
  return `${(part / whole) * 100}%`
}

/**
 * A chart of up to ten columns, with a gold band naming what it counts.
 *
 * `control` is drawn in the top corner, over the bars. The front page puts the
 * button that stops the turning there; a chart that does not turn has nothing to
 * put there and passes nothing.
 */
export function ColumnChart({
  columns,
  caption,
  captionId,
  empty,
  label,
  control,
  swapping,
  onHeld,
}: {
  columns: ChartColumn[]
  /** The gold band under the bars. */
  caption: string
  /**
   * Makes the band a heading of the page rather than a caption of a widget.
   *
   * The Top liste are ten boards on one screen, and a reader moving by heading
   * has to be able to walk them; the front page has one chart among widgets that
   * name themselves, and its band says a different thing every six seconds,
   * which is not an outline anybody can navigate by. Given here, the band is the
   * name of the chart; left out, the chart is named by `label`.
   */
  captionId?: string
  /** What stands in place of the bars when there are none. */
  empty: ReactNode
  /** What the whole chart is called, for anybody who cannot see the band. */
  label: string
  control?: ReactNode
  /**
   * Halfway through a change of what the chart counts, when the words are out
   * and the new ones are not in yet.
   *
   * Only the turning chart on the front page passes it. The bars slide on their
   * own, because their height is a style and a style transitions; the initials,
   * the numbers and the band are text, and text has nothing to slide between,
   * so it is taken out and brought back (owner, 11.08.2026: „nazivi i kružići
   * takmičara fadeuju u nove").
   */
  swapping?: boolean
  /**
   * Handed the bars when the keyboard enters them, and nothing when it leaves.
   *
   * Only the turning chart passes it, and only for one reason: a column is a
   * link to one person's profile, and a turn changes which person each column
   * is while keeping the elements themselves (`swapping` above is what that is
   * for). A reader who tabs onto a column and reads it is holding a link that
   * becomes somebody else's under them, and Enter opens a profile they never
   * chose. The turn waits for them instead (WCAG 2.2 SC 3.2.5).
   *
   * The element and not a yes or a no, because a yes has to be taken back by
   * somebody and there is a case where nobody can: an element carrying the focus
   * that is taken out of the page sends no `focusout`, so the last word would be
   * „held" for ever and the chart would never turn again. Handed the element,
   * whoever asked can put the question to the page itself at the moment it
   * matters, and an element no longer in the page contains nothing.
   *
   * A chart that stands still has nothing to hold and passes nothing.
   */
  onHeld?: (bars: HTMLElement | null) => void
}) {
  const highest = Math.max(1, ...columns.map((one) => one.value))
  /* How wide the circle in a bar has to be, in characters, which is the longest
     number this chart draws (owner, 05.08.2026: it has to be a circle, and a
     circle wide enough for two decimals is wider than one holding a count of
     races). Counted here rather than guessed in the stylesheet, so a chart of
     single digits keeps the small disc and only the one that carries points
     grows. Both levels of a bar are counted, because both carry a number. */
  const digits = Math.max(
    1,
    ...columns.flatMap((one) => [one.label.length, one.base?.label.length ?? 0]),
  )

  return (
    <section
      /* The band at the top is room for the control, so it is only kept where
         there is one (owner, 04.08.2026: on the boards "gornji deo widgeta je
         neiskorišćen"). Fifty pixels of it, and on a board it went to nothing
         at all. Ten come back as the padding every chart keeps and twelve as the
         step under the bars, so the bars are drawn in a box 27,6px taller and
         share it out between them: measured on "Najviše dužih trka" at 360px,
         the tallest bar gains that whole 27,6px and the shortest 6,1px, because
         a bar is a share of the track and not a length of its own. */
      className={[
        'colchart',
        control === undefined ? '' : 'colchart--control',
        /* Whether this chart turns at all, which is a different question from
           whether it is turning right now: the bars are told to slide by the
           first and the words are taken out by the second. Asked of the prop
           being there rather than of its value, because only the chart that
           turns passes it. */
        swapping === undefined ? '' : 'colchart--turns',
        swapping === true ? 'colchart--swapping' : '',
      ]
        .filter((one) => one !== '')
        .join(' ')}
      style={{ '--count-chars': digits }}
      aria-label={captionId === undefined ? label : undefined}
      aria-labelledby={captionId}
    >
      {control}

      {/* First in the markup and last on the screen. The band is drawn under the
          bars, which is where the old portal had it, but a heading that comes
          after its own content is a heading nobody can jump to: a reader landing
          on "Najviše maratona" would find the next board's columns under it. The
          stylesheet puts it back at the foot (`order`), which is what that
          property is for. */}
      {captionId === undefined ? (
        <p className="colchart__caption">{caption}</p>
      ) : (
        <h2 className="colchart__caption" id={captionId}>
          {caption}
        </h2>
      )}

      {columns.length === 0 ? (
        <p className="card__empty">{empty}</p>
      ) : (
        <ol
          className="colchart__columns"
          /* The bars and not the whole chart, because it is the bars that
             change who they lead to. The control sits in the same section and
             is the one thing in it that means the same after a turn as before
             it; held from the section, pressing „Nastavi smenjivanje" would
             leave the chart standing until the reader tabbed away from the very
             button they had just pressed to start it. */
          onFocus={(event) => onHeld?.(event.currentTarget)}
          /* Moving from one column to the next does let go and take hold again:
             `onHeld` is called with the bars, then with nothing, then with the
             bars, which a review measured. Nothing gets through in that gap
             because there is no turn of the loop in it for a timer to fire in,
             and because what is handed over is the element rather than a verdict:
             asked again a moment later, the page gives the same answer.
           *
             A guard reading `event.relatedTarget` was written here and taken out.
             It changes nothing that any test can tell apart, and it would not
             have helped with the case that matters, which is an element taken out
             of the page while it holds the focus: `focusout` is not sent for that
             at all. */
          onBlur={() => onHeld?.(null)}
        >
          {columns.map((column, place) => (
            /* By the place and not by who holds it. The chart on the front
               page changes what it counts every few seconds, and a column
               keyed by member number is a different element every time: React
               would take the old one out and put a new one in, and there is
               nothing left to slide from the old height to the new one. Keyed
               by the place, the first column stays the first column and only
               its contents change, which is what the owner asked for on
               11.08.2026: „stupci prelaze iz jednog prikaza u stupce novog".

               Nothing else needed the other key. A board is a list of places,
               and two rows of one board are never the same place. */
            <li key={place} className="colchart__column">
              <Bar column={column} highest={highest} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
