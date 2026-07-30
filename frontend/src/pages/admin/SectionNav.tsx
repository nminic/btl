import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import { dataOr } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { entitiesForRole } from './entityList'
import { usePending } from './pending'
import { countsFor, QUEUES } from './queues'
import './SectionNav.css'

/* The two administrative sections are worked through rather than visited: the
 * moderator opens a queue, settles what is in it, and goes to the next one.
 * Until this, every one of those steps went back through a list, and the list
 * was the only place that said how much was left anywhere else (owner,
 * 30.07.2026).
 *
 * The section now stands beside the work, the same shape the rulebook uses for
 * its articles: a column that stays put on a wide screen and folds behind a
 * button on a telephone.
 *
 * It is applied by the route table and not by the screens (routeObjects.tsx),
 * for the same reason the guard is: the eighteenth administrative screen must
 * not be able to arrive without it.
 */

export type SectionItem = {
  /** The address below the language. */
  path: string
  label: string
  /** How many things are waiting behind it, where that is a question worth
   *  asking. The entities have no such number; the queues are made of it. */
  count?: number
}

function Section({
  /** Names the navigation landmark, and stands over the list. */
  title,
  hub,
  items,
  children,
}: {
  title: string
  /** The address of the section itself, which is the first entry: from inside a
   *  queue there is otherwise no way back to what the section is. */
  hub: string
  items: SectionItem[]
  children: ReactNode
}) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const panelId = `section-${hub.replace(/\//g, '-')}`

  const entries: SectionItem[] = [{ path: hub, label: title }, ...items]

  return (
    <div className="adminsection">
      <nav className="adminsection__nav" aria-label={title}>
        {/* On a telephone the list would push the work off the first screen, so
            there it sits behind a button. From tablet up the button goes away
            and the list stands beside the work and follows it down. */}
        <button
          type="button"
          className="adminsection__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          {title}
        </button>

        <div
          id={panelId}
          className={open ? 'adminsection__panel adminsection__panel--open' : 'adminsection__panel'}
        >
          <ul className="adminsection__list">
            {entries.map((entry) => (
              <li key={entry.path}>
                <NavLink
                  /* `end` so the section itself is not marked as the screen in
                     view whenever one of its screens is. */
                  end
                  to={`/${locale}/${entry.path}`}
                  className="adminsection__link"
                  /* An aria-label replaces everything inside the element, so a
                     number described by nothing is a number a screen reader
                     never reads out. The header does the same for the one
                     counter it carries (src/app/Shell.tsx). */
                  aria-label={
                    entry.count === undefined || entry.count === 0
                      ? undefined
                      : `${entry.label}, ${t('shell.waiting', { count: entry.count })}`
                  }
                  onClick={() => setOpen(false)}
                >
                  <span className="adminsection__name">{entry.label}</span>
                  {entry.count !== undefined && (
                    /* Shown at nought as well, unlike the counter in the header.
                       There it is a badge and nothing is what nought looks like;
                       here it is the answer to "is there anything left", and the
                       moderator is watching it come down as they work. */
                    <span
                      className={
                        entry.count > 0
                          ? 'adminsection__count adminsection__count--waiting'
                          : 'adminsection__count'
                      }
                    >
                      {formatNumber(entry.count, locale)}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="adminsection__body">{children}</div>
    </div>
  )
}

/**
 * The eight queues, each with what is waiting in it right now.
 *
 * Counted through countsFor, which is what the list of queues and the number in
 * the header count through as well, so the three cannot disagree. A decision
 * taken on the right is a decision written into the session, and the number
 * beside the queue on the left comes down with it.
 */
export function VerificationSection({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { submissions, decisions } = useSession()
  const items = usePending()

  /* Read for what it is worth rather than waited for, exactly as the header and
     the list of queues read it: a section that waited for the file would hold up
     the screen behind it, which is the work itself. */
  const counts = countsFor({
    pendingResults: submissions.filter((one) => one.status === 'pending').length,
    items: dataOr(items, []),
    decisions,
  })

  return (
    <Section
      title={t('verification.title')}
      hub="administracija/verifikacija"
      items={QUEUES.map((queue) => ({
        path: queue.path,
        label: t(queue.labelKey),
        count: counts[queue.id],
      }))}
    >
      {children}
    </Section>
  )
}

/**
 * The nine entities, or eight for a moderator.
 *
 * The same list the screen of entities was drawn from, and filtered the same
 * way: assigning rights is the one thing a moderator may not do (PDL P21), and
 * an entry that answers "this is not for you" is worse than no entry.
 *
 * No numbers. How many members there are is not a thing waiting to be dealt
 * with, and a count beside every entity would mean loading all nine files to
 * draw a navigation.
 */
export function EntitiesSection({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { role } = useRole()

  return (
    <Section
      title={t('entities.title')}
      hub="administracija/entiteti"
      items={entitiesForRole(role).map((entity) => ({
        path: entity.path,
        label: t(entity.labelKey),
      }))}
    >
      {children}
    </Section>
  )
}
