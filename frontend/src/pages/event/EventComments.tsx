import { Link } from 'react-router'
import { Portrait } from '../../components/Portrait'
import { Stars } from '../../components/Stars'
import type { Competitor, EventComment } from '../../data/types'
import { overall, rated } from './overall'
import { combinePair, useComments, useCompetitors } from '../../data/useResource'
import { Resource } from '../../components/Resource'
import { formatDate, formatNumber } from '../../i18n/format'
import { useToday } from '../../clock/useClock'
import { useI18n } from '../../i18n/useI18n'
import './EventComments.css'

/** The three marks, in the order they were asked for. */
const MARKS = ['organisation', 'value', 'ambience'] as const

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
 */
export function EventComments({ eventId, date }: { eventId: string; date: string }) {
  const { t } = useI18n()
  const today = useToday()
  const state = combinePair(useComments(), useCompetitors())

  /* Nothing before the race, heading included. Nobody can rate a race that has
     not been run (PDL P9), so the sentence saying there are no comments would
     stand on the whole of next season's calendar and would say only "not yet",
     which is what the results above already decided (EventDetail.tsx). */
  if (date > today) {
    return null
  }

  return (
    <>
      <h2 className="profile__section" id="comments">
        {t('event.comments')}
      </h2>

      {/* Inline, like the races and the results above it: this is a part of a
          screen and not the screen, and a sheet over the page would hide the
          event while its comments were on their way. */}
      <Resource state={state} inline label={t('event.comments')}>
        {([comments, competitors]) => {
          /* Newest first, which is the order anybody reads a list of comments
             in. Unsorted it was the order of the file, and once a moderator
             starts publishing during a visit that order is "whatever the file
             had, then whatever was approved just now". */
          const mine = comments
            .filter((one) => one.eventId === eventId)
            .sort((left, right) => right.date.localeCompare(left.date))

          if (mine.length === 0) {
            return <p className="profile__empty">{t('event.noComments')}</p>
          }

          return (
            /* Named by the heading over it, so a reader moving by landmarks
               knows what the list is and does not have to have read the heading
               on the way past. */
            <ol className="comments" aria-labelledby="comments">
              {mine.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  who={competitors.find((one) => one.memberNumber === comment.memberNumber)}
                />
              ))}
            </ol>
          )
        }}
      </Resource>
    </>
  )
}

function Comment({ comment, who }: { comment: EventComment; who: Competitor | undefined }) {
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
          <p className="comments__date">{formatDate(comment.date, locale)}</p>
        </div>

        {/* The figure, and the stars beside it drawn to the whole below it.
            Rounded to the nearest, 4,7 was five filled stars; drawn down, the
            stars never overstate what was given and the figure carries the rest.

            The stars are the picture and the figure is the fact, so only the
            figure is said: with both named a reader heard "Ukupna ocena: 4 od 5"
            and then "Ukupna ocena: 4,7" about one number. */}
        <p className="comments__overall">
          <span aria-hidden="true">
            <Stars label={t('event.rating.overall')} value={Math.floor(overall(comment.rating))} />
          </span>
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
        {MARKS.map((mark) => (
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
