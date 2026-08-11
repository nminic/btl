import type { CSSProperties, ReactNode } from 'react'
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
  /** Unique within one chart, which a member number is not everywhere: the same
   *  runner can hold two places on a board of single races. */
  key: string
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
   * was shared, so a board could read 1, 1, 3 (Član 57 of the rulebook). There
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
                style={{ '--level': share(base.value, whole) } as CSSProperties}
              >
                <Count label={base.label} reading={base.reading} quiet />
              </span>
              <span
                className="colchart__level colchart__level--top"
                style={
                  { '--level': share(column.value - base.value, whole) } as CSSProperties
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
  const height = { '--bar': share(column.value, highest) } as CSSProperties

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
      className={control === undefined ? 'colchart' : 'colchart colchart--control'}
      style={{ '--count-chars': digits } as CSSProperties}
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
        <ol className="colchart__columns">
          {columns.map((column) => (
            <li key={column.key} className="colchart__column">
              <Bar column={column} highest={highest} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
