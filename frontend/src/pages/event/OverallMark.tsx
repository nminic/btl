import { Stars } from '../../components/Stars'
import { editionsOf } from '../../data/editions'
import type { EventComment } from '../../data/types'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useReadsComments } from './readsComments'
import { combinePair, useComments, useEvents } from '../../data/useResource'
import { overall, rated } from './overall'
import './EventComments.css'

/**
 * What everybody thought of this race, beside its name (owner, 11.08.2026).
 *
 * Beside the name and nowhere else: it stood over the list of comments as well,
 * and the owner asked for one place. „Može ocena samo gore uz naslov događaja,
 * dovoljno je na tom jednom mestu."
 *
 * Over every running of the race and not only this one, the same as the
 * comments underneath (data/editions.ts): a race that has been rated for
 * fifteen years does not start from nothing because this year's edition is a
 * copy with an id of its own.
 *
 * Out of the comments that carry a rating. A comment written before the ratings
 * existed has none (types.ts), and counting it as nought would drag the average
 * of a race down for a reason nobody chose; a race whose every comment is like
 * that shows no mark rather than a mark of nought.
 *
 * The count beside the figure is what turns a mark into something a reader can
 * judge: 5,0 from one person and 4,2 from forty are not the same claim.
 *
 * It draws nothing at all until it has something to say, and never a box
 * waiting to be filled: it stands in the head of the page, where a box that
 * resolves into nothing moves the name of the race under the reader's eye.
 */
export function OverallMark({ eventId }: { eventId: string }) {
  const { locale, t } = useI18n()
  const reads = useReadsComments()
  const state = combinePair(useComments(), useEvents())

  /* Read out of the comments, so it goes where they go: only members see them
     (owner, 11.08.2026), and a mark is what the comments add up to. A screen
     and not a lock, for the reason written out under the comments themselves
     (EventComments.tsx): the file is already in the browser, and the endpoint
     that replaces it has to be the one that refuses. */
  if (!reads) {
    return null
  }

  /* Nothing is drawn while it is on its way, and nothing is said if it never
     arrives. This stands in the head of the page: a box that resolves into
     nothing moves the name of the race under the reader's eye, and an alert
     about a mark is noise about a figure nobody asked for. Every other part of
     the page keeps its own loading state; this one has nothing to hold open. */
  if (state.status !== 'ready') {
    return null
  }

  const [comments, events] = state.data
  const editions = new Set(editionsOf(events, eventId).map((one) => one.id))
  const marked = comments.filter((one) => editions.has(one.eventId) && rated(one.rating))

  if (marked.length === 0) {
    return null
  }

  const mark = markOf(marked)

  return (
    <p className="comments__mark">
      <span aria-hidden="true">
        <Stars label={t('event.rating.overall')} value={mark} />
      </span>
      <span className="comments__mark-figure">{formatNumber(mark, locale, 1)}</span>
      <span className="comments__mark-count">{t('event.ratedBy', { count: marked.length })}</span>
    </p>
  )
}

/** The average of what was given. Its own function so the empty case is a guard
 *  above rather than a division that has to be defended. */
function markOf(marked: EventComment[]): number {
  return marked.reduce((so, one) => so + overall(one.rating), 0) / marked.length
}
