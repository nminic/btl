import type { ReactNode } from 'react'
import type { Moderator } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import type { Rights } from '../../session/context'
import { allowed, grantedCount, GROUP_STARTS, RIGHT_GROUPS, RIGHTS } from './rights'
import './Rights.css'

/**
 * What each moderator may do, a box at a time (PDL P28a, 30.07.2026).
 *
 * A row is a moderator and a column is a right, in two groups: editing an entity
 * and deciding in a queue. The superadmin is not a row. He may everything,
 * always, so a row for him would be sixteen boxes that cannot be unticked and
 * a lie about where the limit is (PDL P21).
 *
 * **SINCE B106 THIS COMPONENT WRITES NOTHING ITSELF.** It used to read and write
 * `useSession()` directly - the one home for a tick before there was a server for one.
 * `AdminModerators.tsx` now owns the write, `PUT /api/moderators/{id}`, so this stays
 * what it draws: `rights` is the confirmed overlay the screen hands in (the same shape
 * the session used to keep, now sourced from a server answer rather than from a click),
 * `busy` says which rows have a request still out, and `onToggle` is asked rather than
 * told.
 *
 * Two things are worth knowing before changing any of this.
 *
 * The first is the name of a box. A screen reader does not read the column
 * heading and the row heading for you when you land on a checkbox, so a box
 * called "Događaji" is sixteen boxes called "Događaji" and the person hearing
 * it cannot tell whose. Every box therefore carries its own name, whole:
 * "Ana Jovanović, uređivanje događaja". The row and column headings are real
 * `th` elements with `scope` all the same, because that is what makes the table
 * readable cell by cell for anybody who does navigate it as a table.
 *
 * The second is the shape on a telephone. Sixteen columns do not fit in 360
 * pixels and never will, so below 56.25em the same markup is laid out as one
 * block per moderator with the boxes under each other (PDL P24: no table on this
 * portal scrolls sideways). That width is 900 pixels for a reader who has not
 * touched the text size and 1800 for one who has doubled it, which is the point
 * of writing it in em: what the query is really asking is whether sixteen
 * columns of boxes fit beside a twelve rem column of names, and every one of
 * those widths grows with the text. Nothing is drawn twice for that: a second copy of
 * every box in the page would be a second copy in the accessibility tree as
 * well. The words beside each box on a telephone are the same words as in its
 * name, which is what makes the layout swap free of charge.
 *
 * Which leaves the width where the table shape is drawn. Sixteen columns of
 * boxes beside a twelve rem column of names are as wide as the text is big, and
 * the screen is not: with the query in pixels, at 1280 with the text at 200 per
 * cent, the matrix wanted 214 pixels more than the page had and took them from
 * the page, which then scrolled sideways as a whole. That is the one thing this
 * portal does not do (PDL P24).
 *
 * Both halves of that are fixed, and both are worth keeping. The query is in em
 * now, so at that size the card layout is what gets drawn and there is nothing
 * to scroll; and the table still sits in the same `.table-scroll` box as every
 * other table, for the sizes in between and the screens wider than this one. A
 * reader at 125 per cent on 1280, or at 200 on a 1900 screen, is over the
 * threshold and under the width the table wants, and the box is what stands
 * between them and a page that scrolls sideways.
 */
export function RightsMatrix({
  moderators,
  rights,
  busy,
  onToggle,
  refusal,
}: {
  moderators: Moderator[]
  /**
   * What this visit has had CONFIRMED by the server, on top of what each moderator's
   * own record already carries - the same shape and the same `allowed()`/
   * `grantedCount()` the session used to feed, just no longer sourced from a click.
   */
  rights: Rights
  /**
   * Which moderators have a `PUT` still out, by id.
   *
   * Every box of that row is disabled while its own request is in flight, because
   * there is no save button here: a second box pressed before the first answer comes
   * back would compute its own next set off the same not-yet-confirmed row, and
   * whichever answer lands last would silently undo the other (there is no diff on
   * this side, only on the route's).
   */
  busy: ReadonlySet<number>
  onToggle: (moderator: Moderator, right: string, granted: boolean) => void
  /**
   * Why one moderator's last tick did not save, beside his own row, or `null`
   * where nothing is refused. Required rather than defaulted: this component
   * has one caller, which always has one of the two to hand, and a default
   * value is a branch nothing here would ever take.
   */
  refusal: { id: number; node: ReactNode } | null
}) {
  const { t } = useI18n()

  return (
    <div className="rights-wrap table-scroll">
      <table className="rights">
        <caption className="visually-hidden">{t('rights.title')}</caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="rights__corner">
              {t('rights.moderator')}
            </th>
            {RIGHT_GROUPS.map((group) => (
              <th
                key={group.id}
                scope="colgroup"
                colSpan={group.rights.length}
                className="rights__group"
              >
                {t(group.headingKey)}
              </th>
            ))}
          </tr>
          <tr>
            {RIGHTS.map((right) => (
              <th key={right.key} scope="col" className="rights__column">
                <span className="rights__column-text">{t(right.nameKey)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {moderators.map((one) => {
            const who = `${one.firstName} ${one.lastName}`
            const granted = grantedCount(one, rights)
            const isBusy = busy.has(one.id)

            return (
              <tr key={one.id} className="rights__row">
                <th scope="row" className="rights__who">
                  <span className="rights__name">{who}</span>
                  {/* A moderator with nothing ticked is the ordinary state of one
                      just entered, not a row that failed to load. It says so, in
                      the row itself, rather than leaving sixteen empty boxes to
                      be read as a fault. */}
                  <span className="rights__count">
                    {granted === 0 ? t('rights.none') : t('rights.granted', { count: granted })}
                  </span>
                  {refusal !== null && refusal.id === one.id && refusal.node}
                </th>

                {RIGHTS.map((right) => (
                  <td
                    key={right.key}
                    className={
                      GROUP_STARTS.has(right.key) ? 'rights__cell rights__cell--group' : 'rights__cell'
                    }
                  >
                    <label className="rights__box">
                      <input
                        type="checkbox"
                        className="rights__input"
                        checked={allowed(one, right.key, rights)}
                        disabled={isBusy}
                        aria-label={t('rights.box', { who, action: t(right.actionKey) })}
                        onChange={(event) => onToggle(one, right.key, event.target.checked)}
                      />
                      {/* The words a telephone shows beside the box, where there
                          is no column heading over it. Hidden from a screen
                          reader because the box's own name already says this and
                          contains it word for word (WCAG 2.5.3). */}
                      <span className="rights__inline" aria-hidden="true">
                        {t(right.actionKey)}
                      </span>
                    </label>
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
