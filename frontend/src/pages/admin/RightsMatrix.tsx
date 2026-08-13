import type { Moderator } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
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
 * pixels and never will, so below 900 pixels the same markup is laid out as one
 * block per moderator with the boxes under each other (PDL P24: no table on this
 * portal scrolls sideways). Nothing is drawn twice for that: a second copy of
 * every box in the page would be a second copy in the accessibility tree as
 * well. The words beside each box on a telephone are the same words as in its
 * name, which is what makes the layout swap free of charge.
 *
 * Which leaves the width where the table shape is drawn. Sixteen columns of
 * boxes beside a twelve rem column of names are as wide as the text is big, and
 * the screen is not: at 1280 with the text at 200 per cent the matrix wanted 214
 * pixels more than the page had, and took them from the page, which then
 * scrolled sideways as a whole. That is the one thing this portal does not do
 * (PDL P24), so the table sits in the same `.table-scroll` box as the other
 * twenty-three and scrolls inside it.
 */
export function RightsMatrix({ moderators }: { moderators: Moderator[] }) {
  const { t } = useI18n()
  const { rights, setRight } = useSession()

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
                        aria-label={t('rights.box', { who, action: t(right.actionKey) })}
                        onChange={(event) => setRight(one.id, right.key, event.target.checked)}
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
