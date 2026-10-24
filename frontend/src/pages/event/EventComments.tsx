import { useEffect, useState } from 'react'
import { ProfileLink } from '../profile/ProfileLink'
import { useGrowing } from '../../components/growing'
import { LoadMore } from '../../components/LoadMore'
import { Portrait } from '../../components/Portrait'
import { Stars } from '../../components/Stars'
import { RATING_MARKS } from '../../data/types'
import type { Competitor, EventComment } from '../../data/types'
import { editionsOf } from '../../data/editions'
import { overall, rated } from './overall'
import { combineResources, useComments, useCompetitors, useEvents } from '../../data/useResource'
import { Loader } from '../../components/Loader'
import { Resource } from '../../components/Resource'
import { formatDate, formatNumber } from '../../i18n/format'
import { useToday } from '../../clock/useClock'
import { useI18n } from '../../i18n/useI18n'
import { useServerIsStillBeingAsked } from '../../session/useServerIsStillBeingAsked'
import { useReadsComments } from './readsComments'
import { useSession } from '../../session/useSession'
import { isActiveMember } from '../../roles/activeMemberOrAdministration'
import { SYMBOL } from '../../app/actionSymbol'
import { ActionLink } from '../../components/ActionButton'
import { DeleteSheet } from '../admin/DeleteSheet'
import { ServerSaid } from '../account/ServerSaid'
import type { Answer } from '../account/askTheServer'
import { saysNothing, theRatingDeleted } from './commentWrites'
import './EventComments.css'

/**
 * What members thought of an event, under the event.
 *
 * Only what a moderator has approved (owner, 06.08.2026, and PDL P22 for every
 * queue): a comment goes out onto the portal or it does not.
 *
 * One source: what the server holds (`useComments`, data/useResource.ts). An
 * approval on the queue drops the answer this visit holds, so the next read is the
 * server's, with the rating published and the member's older one of that event gone
 * (PDL, 19.10.2026). That is held by the cases that approve one comment and look for
 * it under its event, with one rating per member per event and the overall mark worked
 * out over that, and by the one that deletes one and looks for its absence.
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

export function EventComments({ eventId, date }: { eventId: number; date: string }) {
  const { t } = useI18n()
  const reads = useReadsComments()
  const asking = useServerIsStillBeingAsked()
  const today = useToday()

  /* **Active members and the administration read them (owner, 03.10.2026), and the question is
     asked HERE, in front of everything that reads a comment.**
   *
     Asked inside, it was never reached: `Resource` answers a fetch that failed with
     `role="alert"` BEFORE it calls its children at all (components/Resource.tsx), so the guard
     sat behind the very state it had to decide. That is not a hypothetical since the portal
     moved to `/api`: `/api/comments` is not in `ApiSecurity.READ_BY_ANYBODY`, so an
     unauthenticated caller is answered 401, and since 03.10.2026 anybody else signed in who is
     not an active member or the administration is answered 404 (`CommentApi`). `data/client.ts`
     throws on anything that is not `ok`, so the resource is in error for EVERY one of them on
     EVERY event. What a reader met under a race they had just read about was a red alarm, on the
     one screen that had already decided to tell them nothing.
   *
     So the comments are not even asked for here until the answer is yes, and that is what the
     split below is for: `TheComments` holds the three reads, and it is only mounted for somebody
     who reads. `GoingToEvent.tsx` asks the same question the same way and for the same reason
     („nothing is asked that nobody draws"), and the question itself is the one it asks
     (`useReadsComments`).
   *
     **The answer is the session's and needs no request of its own** (ADL, 16.10.2026): this used
     to wait for the list of members to say whether the reader's fee stands, and held a box open
     for as long as that took. What the session has not been told yet it reads as nobody, so a
     reader is told the sentence below in the first paint and the comments replace it once
     `GET /api/me` has said who he is, exactly as a visitor was always answered at once.
   *
     **This is a screen and not a lock, and it must not be mistaken for one.** The server is what
     refuses. What this keeps is the page from promising what it will not deliver, and from
     reporting that refusal as a fault. */
  if (!reads) {
    /* Nothing at all before the race, not even that the comments are for
       members. Said on a future event, the line appeared on exactly those whose
       earlier editions carry something and was missing from the rest: the
       sentence meant to hide what was said would have said which race there is
       something to read about.

       **The same sentence for everybody who does not read them**, a visitor and
       an account whose fee is not standing alike. That is this screen's reasoning
       and not a recorded decision: PDL says only that an account without a
       standing fee does not see them, and the hidden profile, which the same
       line names as the model, answers such an account as it answers a visitor.
       A screen that told the two apart would be saying, to a reader who is shown
       nothing, which of the two he is. */
    return date > today ? null : (
      <>
        <h2 className="profile__section" id="comments">
          {t('event.comments')}
        </h2>
        {/* UNTIL THE SERVER HAS SAID WHO IS READING, THE SENTENCE IS NOT SAID (owner, 10.10.2026,
            PDL P26: „rečenica o komentarima ide u isti posao"). It tells somebody his fee does
            not stand, and a member whose cookie nobody has asked about yet is not that
            reader. A small indicator stands where it will be, so the heading does not move;
            the wait ends on every outcome of the request, and a reader a failed request
            leaves is told the sentence a visitor always was. */}
        {asking ? (
          <Loader inline label={t('event.comments')} />
        ) : (
          <p className="profile__empty">{t('event.commentsForMembers')}</p>
        )}
      </>
    )
  }

  return <TheComments eventId={eventId} date={date} />
}

/**
 * The comments of an event, for somebody who reads them.
 *
 * Its own component so that nothing here is asked of the server for a reader who is not drawn
 * the part: a hook cannot be called conditionally, and these three are the reads.
 */
function TheComments({ eventId, date }: { eventId: number; date: string }) {
  const { t } = useI18n()
  const today = useToday()
  /* Read again, here and beside the name of the event alike, when his deletion is answered
     (`theCommentsHaveChanged`, `commentWrites.ts`). */
  const state = combineResources(useComments(), useCompetitors(), useEvents())

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
                /* The address of the running it was written under, which is where his pencil
                   leads: a rating belongs to the event it was given for, and that is where he
                   has the result the form asks about (owner, 11.08.2026). */
                slug: edition.slug,
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
           tied to the event's own id rather than to the date it falls on (the
           same linking `subjectId` in types.ts describes).

           Only the half that needs the list is left here. The other half of this
           condition - that a visitor is told nothing either way before the race -
           is answered above, in front of the `Resource`, because the answer to a
           visitor never depended on what arrived. */
        if (date > today && mine.length === 0) {
          return null
        }

        return (
          <>
            {/* Focusable by the page and not a stop on the way through: it is where the focus goes when
                the reader's own rating, and the button he pressed with it, leave the list. */}
            <h2 className="profile__section" id="comments" tabIndex={-1}>
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
  written: { comment: EventComment; slug: string; from: string }[]
  competitors: Competitor[]
}) {
  const { t } = useI18n()
  const { shown, whole, asked, more } = useGrowing(written.length, AT_FIRST)
  /* WHOSE RATINGS ARE HIS (owner, PDL P6, 20.10.2026: „uz svoju ocenu na strani događaja član vidi
     Izmeni i Obriši"). His number, and only while his fee stands: the server deletes for an active
     member alone and answers anybody else 404 (`CommentWriteApi`, derived from PDL P8). The served
     list carries an author's number only while that author is active, so the two halves agree; asked
     here as well because a screen must not offer what the server refuses, whatever a file says. */
  const { memberNumber, signedIn } = useSession()
  const me = isActiveMember(signedIn) ? memberNumber : null
  /* THE RATING HE HAS JUST DELETED, until it has left the list: the button that had the focus goes with
     its card, so the focus is put on the heading of the comments rather than dropped on the document
     (WCAG 2.2 SC 2.4.3). Asked of the list as drawn, so it moves when the card is really gone. */
  const [gone, setGone] = useState<number | null>(null)

  useEffect(() => {
    if (gone !== null && !written.some(({ comment }) => comment.id === gone)) {
      document.getElementById('comments')?.focus()
      setGone(null)
    }
  }, [gone, written])

  return (
    <>
      {/* Named by the heading over it, so a reader moving by landmarks knows
          what the list is and does not have to have read the heading on the way
          past. */}
      <ol className="comments" aria-labelledby="comments">
        {written.slice(0, shown).map(({ comment, slug, from }) => (
          <Comment
            key={comment.id}
            comment={comment}
            who={competitors.find((one) => one.memberNumber === comment.memberNumber)}
            from={from}
            his={me !== null && comment.memberNumber === me ? slug : null}
            onGone={setGone}
          />
        ))}
      </ol>

      {/* NOTHING SEEN AT THE FOOT OF THEM (owner, PDL P6, 20.10.2026: „Treba da bude infinite scroll.
          Dakle brise se sve to na dnu"), and nothing counted out loud either („Čitač ekrana ne čuje
          brojanje"). The list grows as it is scrolled; the button stays for the keyboard and a screen
          reader and is seen only with the focus on it, and the end is said and not drawn, as on the
          results and the ducats (`endShown`). */}
      <LoadMore
        whole={whole}
        asked={asked}
        onMore={more}
        endShown={false}
        buttonOnFocusOnly
        words={{
          more: t('event.moreComments'),
          showing: t('event.moreCommentsLoaded'),
          whole: t('event.noMoreComments'),
        }}
      />
    </>
  )
}

function Comment({
  comment,
  who,
  from,
  his,
  onGone,
}: {
  comment: EventComment
  who: Competitor | undefined
  /** The year of the running it was written about, or empty where that is the
   *  one being read. */
  from: string
  /** Where this is the reader's own rating, the address of the event it was given for; nothing
   *  where it is somebody else's. */
  his: string | null
  /** Told the id of a rating the server no longer holds, once his deletion is answered. */
  onGone: (id: number) => void
}) {
  const { locale, t } = useI18n()
  /* What the server said to his deletion where it is something the page has words for: neither done
     nor „no longer there" (`commentWrites.ts`). */
  const [refused, setRefused] = useState<Exclude<Answer, { got: 'done' }> | null>(null)

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

              **AND SINCE 21.09.2026 THOSE TWO ARE ONE QUESTION, which is the
              switch to `/api` rather than a simplification.** A member whose fee
              has run out is not in the list the portal is answered with (owner,
              13.09.2026), so there is no record to find and `who === undefined`
              is the whole of it. The sentence above stands because it is still
              why the question is asked this way round.

              The name written on the day stands in its place, because there is
              no record left to read one off (owner, 06.08.2026). */}
          <p className="comments__name">
            {who === undefined ? (
              comment.who
            ) : (
              <ProfileLink competitor={who}>
                {who.firstName} {who.lastName}
              </ProfileLink>
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

      {his !== null && (
        <div className="comments__his">
          <div className="entity-row-actions">
            {/* The pencil: the rating form of the event it was given for, filled in with what he gave
                (`RateEvent.tsx`). Sent again, it replaces this one (owner, 19.10.2026), at once without
                words and after a moderator with them, and this one stands until then (20.10.2026). */}
            <ActionLink
              symbol={SYMBOL.pencil}
              word={t('event.editOwnRating')}
              className="button button--secondary button--compact"
              to={`/${locale}/kalendar/${his}/ocena`}
            />
            {/* The x, asked in a sheet as every deletion on the portal is (PDL, 24.10.2026), in the owner's words
                („Obriši svoju ocenu?"). */}
            <DeleteSheet
              name={t('event.deleteOwnRating')}
              asks={t('event.deleteOwnRatingAsk')}
              opener={t('event.deleteOwnRating')}
              look="button button--secondary button--compact"
              onKeep={() => {
                setRefused(null)
              }}
              onDelete={() =>
                theRatingDeleted(comment.id).then((answer) => {
                  if (answer.got !== 'done' && !saysNothing(answer)) {
                    setRefused(answer)

                    return
                  }

                  setRefused(null)
                  onGone(comment.id)
                })
              }
            />
          </div>
          {refused !== null && <ServerSaid answer={refused} refusals={{}} />}
        </div>
      )}
    </li>
  )
}
