import { Link } from 'react-router'
import { useGrowing } from '../../components/growing'
import { LoadMore } from '../../components/LoadMore'
import { Portrait } from '../../components/Portrait'
import { Stars } from '../../components/Stars'
import { RATING_MARKS } from '../../data/types'
import type { Competitor, EventComment } from '../../data/types'
import { editionsOf } from '../../data/editions'
import { overall, rated } from './overall'
import { combineResources, useComments, useCompetitors, useEvents } from '../../data/useResource'
import { Resource } from '../../components/Resource'
import { formatDate, formatNumber } from '../../i18n/format'
import { useToday } from '../../clock/useClock'
import { useI18n } from '../../i18n/useI18n'
import { useReadsComments } from './readsComments'
import './EventComments.css'

/**
 * What members thought of an event, under the event.
 *
 * Only what a moderator has approved (owner, 06.08.2026, and PDL P22 for every
 * queue): a comment goes out onto the portal or it does not.
 *
 * Two sources, one rule. What the record carries was approved before this visit;
 * what the queue carries is approved during it, and `useComments` is the one
 * place that decides which of the waiting ones count (data/useResource.ts). That
 * the rule is written down once rather than remembered at each screen is the
 * whole of the guard here, and it is held by a test that approves one comment
 * and looks for it under its event, and by another that deletes one and looks
 * for its absence.
 *
 * A comment shows who wrote it, so it carries their face and their name, and the
 * name leads to their profile the way every name on the portal does (PDL P11).
 *
 * **What is read is the race, not the running of it.** A comment is tied to the
 * exact event it was written under, and next season's event is a copy with an id
 * of its own, so a screen asking only its own event opened every new edition
 * with nothing said about a race that has been run for fifteen years (owner,
 * 11.08.2026). The chain of editions is walked backwards from this one
 * (data/editions.ts) and every comment along it is read.
 */
/** How many comments arrive with the page, before the first refill (owner,
 *  11.08.2026). */
const AT_FIRST = 10

export function EventComments({ eventId, date }: { eventId: string; date: string }) {
  const { t } = useI18n()
  const reads = useReadsComments()
  const today = useToday()
  const state = combineResources(useComments(), useCompetitors(), useEvents())

  /* Only members read them (owner, 11.08.2026). A visitor sees the races and the
     results and is told, in one line, that there is something here for members;
     the alternative is a section that silently is not there, which reads as an
     event nobody has said anything about. */
  if (!reads) {
    return (
      <>
        <h2 className="profile__section" id="comments">
          {t('event.comments')}
        </h2>
        <p className="profile__empty">{t('event.commentsForMembers')}</p>
      </>
    )
  }

  /* An event still to be run draws no section here at all, so while its data is
     on its way it must not hold a box open either: the reader would watch a
     space that resolves into nothing, and on a broken connection an alert about
     a section that was never going to be there. The results above say the same
     thing the same way (EventDetail.tsx). */
  if (date > today && state.status !== 'ready') {
    return null
  }

  return (
    /* Inline, like the races and the results above it: this is a part of a
       screen and not the screen, and a sheet over the page would hide the event
       while its comments were on their way.

       The heading is inside it because whether there is a section at all
       depends on what arrives. */
    <Resource state={state} inline label={t('event.comments')}>
      {([comments, competitors, events]) => {
        /* Every running this race has had, this one first, and every comment
           written under any of them. Each comment is paired with its running as
           the list is built rather than looked up afterwards: built the other
           way there is a lookup that cannot fail and a fallback nothing can
           reach, which is a line the next reader has to take on trust. */
        const chain = editionsOf(events, eventId)
        /* Newest first, which is the order anybody reads a list of comments in.
           Unsorted it was the order of the file, and once a moderator starts
           publishing during a visit that order is "whatever the file had, then
           whatever was approved just now". */
        const mine = chain
          .flatMap((edition) =>
            comments
              .filter((one) => one.eventId === edition.id)
              .map((comment) => ({
                comment,
                /* Which running it was written about, where that is not this
                   one. Without it the page of the 2027 race carries a
                   paragraph about the 2024 one with nothing saying so, and a
                   reader takes last year's startni paket for this year's
                   promise. */
                from: edition.id === eventId ? '' : edition.date.slice(0, 4),
              })),
          )
          .sort((left, right) => right.comment.date.localeCompare(left.comment.date))

        /* Nothing at all before the race, heading included: nobody can rate a
           race that has not been run (PDL P9), so the sentence saying there are
           none would stand on the whole of next season's calendar and would say
           only "not yet". The same answer the results above give, and the same
           shape: what is suppressed is the sentence, never a comment. An event
           moved onto a later date keeps everything already published under it,
           which is what the schedule queue does to events (types.ts,
           `subjectId`). */
        if (mine.length === 0 && date > today) {
          return null
        }

        return (
          <>
            <h2 className="profile__section" id="comments">
              {t('event.comments')}
            </h2>

            {mine.length === 0 ? (
              <p className="profile__empty">{t('event.noComments')}</p>
            ) : (
              /* Keyed by the event, so walking from one race to another starts
                 the list again. Without it React keeps the same component
                 across a change of address and the next race opens grown to
                 wherever the last one was left. */
              <CommentList key={eventId} written={mine} competitors={competitors} />
            )}
          </>
        )
      }}
    </Resource>
  )
}

/**
 * The comments themselves, with what they add up to over them.
 *
 * Its own component because the list grows as it is read and a hook cannot be
 * called inside the callback that draws it.
 *
 * The mark over the list is the first thing about an event a reader wants and
 * the last thing the page used to say (owner, 11.08.2026): what everybody
 * thought, before what one person wrote.
 */
function CommentList({
  written,
  competitors,
}: {
  /** Each comment beside the year of the running it was written about, empty
   *  where that is the one being read. */
  written: { comment: EventComment; from: string }[]
  competitors: Competitor[]
}) {
  const { t } = useI18n()
  const { shown, whole, asked, more } = useGrowing(written.length, AT_FIRST)

  return (
    <>
      {/* Named by the heading over it, so a reader moving by landmarks knows
          what the list is and does not have to have read the heading on the way
          past. */}
      <ol className="comments" aria-labelledby="comments">
        {written.slice(0, shown).map(({ comment, from }) => (
          <Comment
            key={comment.id}
            comment={comment}
            who={competitors.find((one) => one.memberNumber === comment.memberNumber)}
            from={from}
          />
        ))}
      </ol>

      <LoadMore
        whole={whole}
        asked={asked}
        onMore={more}
        words={{
          more: t('event.moreComments'),
          showing: t('event.showingComments', { shown, total: written.length }),
          whole: t('event.allComments', { count: written.length }),
        }}
      />
    </>
  )
}

function Comment({
  comment,
  who,
  from,
}: {
  comment: EventComment
  who: Competitor | undefined
  /** The year of the running it was written about, or empty where that is the
   *  one being read. */
  from: string
}) {
  const { locale, t } = useI18n()

  return (
    <li className="comments__one">
      <div className="comments__who">
        <Portrait competitor={who} />
        <div>
          {/* The name leads to the profile, unless there is nobody to lead to.
              A member whose fee has run out is still in the record and has no
              visible profile (PDL P11), so "is there a record" is the wrong
              question: it drew a link to a page that answers "Ovog takmičara
              nema". What is asked is whether the profile is there to be read,
              which is what every other list on the portal asks
              (CompetitorName.tsx, TopBoards.tsx, EventDetail.tsx).

              The name written on the day stands in its place, because there is
              no record left to read one off (owner, 06.08.2026). */}
          <p className="comments__name">
            {who === undefined || !who.active ? (
              comment.who
            ) : (
              <Link to={`/${locale}/takmicar/${who.memberNumber}`}>
                {who.firstName} {who.lastName}
              </Link>
            )}
          </p>
          <p className="comments__date">
            {formatDate(comment.date, locale)}
            {from !== '' && (
              <span className="comments__edition">{t('event.fromEdition', { year: from })}</span>
            )}
          </p>
        </div>

        {/* The figure, and the stars beside it drawn to the figure itself.
            They used to be drawn down to the whole below it, so 4,7 and 4,0
            were the same five stars and the picture said less than the number
            beside it; now the fifth star is filled seven tenths of the way
            across (owner, 11.08.2026).

            The stars are the picture and the figure is the fact, so only the
            figure is said: with both named a reader heard "Ukupna ocena: 4 od 5"
            and then "Ukupna ocena: 4,7" about one number. */}
        <p className="comments__overall">
          {/* No picture where there is no number: drawn from the average
              whatever the record carried, a rating missing one of its three
              showed three filled stars beside the words "Bez ocene", which is
              the same card answering one question two ways in the one place the
              answer is a drawing. */}
          {rated(comment.rating) && (
            <span aria-hidden="true">
              <Stars label={t('event.rating.overall')} value={overall(comment.rating)} />
            </span>
          )}
          <span className="comments__figure">
            {t('event.rating.overall')}:{' '}
            {/* Nought on all three is a comment written before the ratings
                existed, not a comment rated nothing (types.ts). The three marks
                beside it already say "Bez ocene", and an overall of 0,0 next to
                them is the card disagreeing with itself. */}
            {rated(comment.rating)
              ? formatNumber(overall(comment.rating), locale, 1)
              : t('event.rating.unrated')}
          </span>
        </p>
      </div>

      <dl className="comments__marks">
        {RATING_MARKS.map((mark) => (
          <div key={mark}>
            <dt>{t(`event.rating.${mark}`)}</dt>
            <dd>
              <Stars
                label={t(`event.rating.${mark}`)}
                value={comment.rating[mark]}
              />
            </dd>
          </div>
        ))}
      </dl>

      {comment.body !== '' && <p className="comments__text">{comment.body}</p>}
    </li>
  )
}
