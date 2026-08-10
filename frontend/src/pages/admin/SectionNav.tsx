import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { dataOr, failed } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { usePermittedEntities, usePermittedQueues } from './mayOpen'
import { usePending } from './pending'
import { countFor } from './queues'
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
 * not be able to arrive without it. The guard stays outside it, so a refusal
 * never comes with a working navigation.
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
  /** Stands over the list and names the button that opens it. */
  title,
  id,
  items,
  /** Said out loud beside the numbers when they cannot be trusted, and nothing
   *  where the section has no numbers. */
  alarm,
}: {
  title: string
  /** Names the panel the button opens, and nothing else. The section itself has
   *  no entry: it has no screen any more, only the work in it (owner,
   *  30.07.2026). */
  id: string
  items: SectionItem[]
  alarm?: ReactNode
}) {
  const { locale, t } = useI18n()
  const { pathname } = useLocation()
  /* Which address the folded list was opened on, rather than whether it is
     open. Going anywhere closes it, and without an effect that has to remember
     to: leaving the section by the header menu or by the browser's back button
     used to leave the panel standing over whatever came next, because following
     an entry was the only thing that closed it. */
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === pathname
  const panelId = `section-${id}`

  return (
    /* The landmark is named apart from the entry that leads to the section, so
       somebody moving landmark by landmark does not hear the same word three
       times over. */
    <nav aria-label={t('admin.sectionNav', { name: title })}>
      {/* On a telephone the list would push the work off the first screen, so
          there it sits behind a button. From tablet up the button goes away
          and the list stands beside the work and follows it down. */}
      <button
        type="button"
        className="adminsection__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenAt(open ? null : pathname)}
      >
        {title}
      </button>

      <div
        id={panelId}
        className={open ? 'adminsection__panel adminsection__panel--open' : 'adminsection__panel'}
      >
        <ul className="adminsection__list">
          {items.map((entry) => (
            <li key={entry.path}>
              <NavLink
                /* `end` so the section itself is not marked as the screen in
                   view whenever one of its screens is. */
                end
                to={`/${locale}/${entry.path}`}
                className="adminsection__link"
                /* The number is said in words or not at all. An aria-label
                   replaces everything inside the element, so the digit is
                   hidden and the name carries it: a bare "0" read out after a
                   name is a number with no unit. */
                aria-label={
                  entry.count === undefined
                    ? undefined
                    : `${entry.label}, ${t('shell.waiting', { count: entry.count })}`
                }
              >
                <span className="adminsection__name">{entry.label}</span>
                {entry.count !== undefined && (
                  /* Shown at nought as well, unlike the counter in the header.
                     There it is a counter and nothing is what nought looks like;
                     here it is the answer to "is there anything left", and the
                     moderator is watching it come down as they work. */
                  <span
                    aria-hidden="true"
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

        {alarm}
      </div>
    </nav>
  )
}

/**
 * The frame the whole of administration is drawn in: the navigation of two
 * sectors on the left, and whatever screen is open beside it (owner,
 * 06.08.2026).
 *
 * It draws nothing of its own, because the landing page has nothing of its own:
 * what used to stand on it is either in the navigation or on the screen the
 * navigation opens.
 */
export function AdminSections({ children }: { children: ReactNode }) {
  return (
    <div className="adminsection">
      <div className="adminsection__sectors">
        {/* A sector nobody may open is not drawn at all. A moderator is not to
            be aware that there are actions nobody gave him (owner, 30.07.2026):
            naming a sector to somebody who holds nothing in it is telling him
            about a room he may not enter, and the button opened an empty list,
            which is a control that answers nothing. */}
        <QueuesSector />
        <RecordsSector />
      </div>

      {/* Keyed by the address, so moving from one screen to the next builds it
          again instead of handing the next one whatever the last one was in the
          middle of. React Router does not key what it renders, and these screens
          are now the same element type in the same place in the tree: without
          this, opening the box for a reason on one queue and leaving without
          cancelling reopened it on the queue arrived at next, and took the focus
          with it. */}
      <div className="adminsection__body" key={usePathname()}>
        {children}
      </div>
    </div>
  )
}

/** The address in view, which is what keys the work beside the navigation. */
function usePathname(): string {
  return useLocation().pathname
}

/**
 * The queues this moderator may work in, each with what is waiting in it.
 *
 * Only the ones he may open (owner, 30.07.2026). A moderator is not to be aware
 * that there are actions nobody gave him: naming eight queues to somebody who
 * may work in one is telling him about seven doors, and every one of them is an
 * invitation to ask what is behind it. The superadmin sees all eight, because he
 * may open all eight.
 *
 * Counted through countsFor, which is what the number in the header counts
 * through as well, so the two cannot disagree. A decision taken on the right is
 * a decision written into the session, and the number beside the queue on the
 * left comes down with it.
 */
function QueuesSector() {
  const { t } = useI18n()
  const { submissions, decisions } = useSession()
  const items = usePending()
  const queues = usePermittedQueues()

  if (queues.length === 0) {
    return null
  }

  /* Read for what it is worth rather than waited for, exactly as the header
     reads it: a section that waited for the file would hold up the screen behind
     it, which is the work itself. */
  const waiting = {
    pendingResults: submissions.filter((one) => one.status === 'pending').length,
    items: dataOr(items, []),
    decisions,
  }

  return (
    <Section
      title={t('verification.title')}
      id="verifikacija"
      items={queues.map((queue) => ({
        path: queue.path,
        label: t(queue.labelKey),
        /* Counted for this queue rather than looked up in a record of counts.
           The lookup answered `number | undefined`, and the prop takes an
           optional number, so a queue missing from the record drew no counter at
           all, which is the one thing the note below says must not happen. */
        count: countFor(waiting, queue),
      }))}
      /* Beside the numbers, because that is where the numbers are now. A file
         that failed counts every queue it feeds as nought, and eight quiet
         noughts read as an afternoon's work already done. This used to be said
         on the hub, which was the only screen the numbers were on; the hub draws
         nothing of its own now (owner, 06.08.2026), so the numbers stand in the
         navigation, on every screen, and an alarm on one of them is an alarm
         nobody sees. */
      alarm={
        failed(items) ? (
          <p className="adminsection__alarm" role="alert">
            {t('verification.shortCount')}
          </p>
        ) : undefined
      }
    />
  )
}

/**
 * The records this person may open: all seven for the superadmin, and for a
 * moderator only those he has been given.
 *
 * Moderators are the entity no moderator ever sees, and not because a tick is
 * missing: assigning rights is the single thing the superadmin cannot hand over
 * (PDL P21). The other six come and go with the boxes in the matrix.
 *
 * No numbers. How many members there are is not a thing waiting to be dealt
 * with, and a count beside every entity would mean loading all seven files to
 * draw a navigation.
 */
function RecordsSector() {
  const { t } = useI18n()
  const entities = usePermittedEntities()

  if (entities.length === 0) {
    return null
  }

  return (
    <Section
      title={t('entities.title')}
      id="entiteti"
      items={entities.map((entity) => ({
        path: entity.path,
        label: t(entity.labelKey),
      }))}
    />
  )
}
