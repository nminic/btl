import { Link } from 'react-router'
import { Portrait } from '../../components/Portrait'
import { Stars } from '../../components/Stars'
import type { Competitor, EventComment } from '../../data/types'
import { overall } from './overall'
import { combinePair, useComments, useCompetitors } from '../../data/useResource'
import { Resource } from '../../components/Resource'
import { formatDate, formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import './EventComments.css'

/** The three marks, in the order they were asked for. */
const MARKS = ['organisation', 'value', 'ambience'] as const

/**
 * What members thought of an event, under the event.
 *
 * Only what a moderator has approved (owner, 06.08.2026, and PDL P22 for every
 * queue): a comment goes out onto the portal or it does not, and until it does
 * it exists only in the queue. So the list is drawn from the record of published
 * comments and never from the queue, which is what keeps an unapproved comment
 * off the page by construction rather than by remembering to filter.
 *
 * A comment shows who wrote it, so it carries their face and their name, and the
 * name leads to their profile the way every name on the portal does (PDL P11).
 */
export function EventComments({ eventId }: { eventId: string }) {
  const { t } = useI18n()
  const state = combinePair(useComments(), useCompetitors())

  return (
    <>
      <h2 className="profile__section">{t('event.comments')}</h2>

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
            <ol className="comments">
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
          {/* The name leads to the profile, unless there is nobody to lead to:
              a member whose fee has run out has no visible profile (PDL P11),
              and their comment stays where it was published. */}
          <p className="comments__name">
            {who === undefined ? (
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
            Rounded to the nearest, 4,7 was five filled stars and a reader heard
            "5 od 5" beside a printed 4,7; drawn down, the stars never overstate
            what was given and the figure carries the rest. The stars are the
            picture and the figure is the fact, so only the figure is named. */}
        <p className="comments__overall">
          <Stars
            name={`overall-${comment.id}`}
            label={t('event.rating.overall')}
            value={Math.floor(overall(comment.rating))}
          />
          <span className="comments__figure">
            {t('event.rating.overall')}: {formatNumber(overall(comment.rating), locale, 1)}
          </span>
        </p>
      </div>

      <dl className="comments__marks">
        {MARKS.map((mark) => (
          <div key={mark}>
            <dt>{t(`event.rating.${mark}`)}</dt>
            <dd>
              <Stars
                name={`${mark}-${comment.id}`}
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
