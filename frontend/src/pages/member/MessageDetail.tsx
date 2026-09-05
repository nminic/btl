import { useEffect } from 'react'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { combinePair, useCompetitors, useTeams } from '../../data/useResource'
import { joinRefusal } from '../../data/teamJoin'
import { MEMBERS, recordsOf, TEAMS } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { seasonOnSale } from '../../data/season'
import type { Ask } from '../../session/context'
import { Link, useParams } from 'react-router'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { NotFound } from '../NotFound'
import { SignedOut } from './SignedOut'
import './Member.css'

/* Where a subject in the header panel leads: the message, opened out, on its
 * own address that can be kept and shared (PDL P28a). Opening it is what marks
 * it read; asking someone to press a button to say they have read what is on
 * the screen in front of them is asking for nothing.
 *
 * This is the one detail screen that deliberately does NOT name the page after
 * the record it shows, so there is no <PageMeta> here. The subject of a message
 * is personal data (PDL P23), and a document title is the least private thing
 * on a computer: it goes into the browser tab, into history, into a bookmark and
 * into whatever a shared screen shows. The generic name for this address is set
 * once, in EXTRA_ADDRESSES in src/app/routes.ts. */
export function MessageDetail() {
  const { locale, t } = useI18n()
  const { id } = useParams()
  const { memberNumber, inbox, markRead, decisions, settle, editRecord, notify } = useSession()
  const today = useToday()
  const overlay = useOverlay()
  const state = combinePair(useTeams(), useCompetitors())
  /* Out of the inbox rather than out of the store, so an address that names
   * somebody else's message answers with the not found page instead of showing
   * it (Message.to). */
  const message = inbox.find((one) => one.id === id)
  const unread = message !== undefined && !message.read

  useEffect(() => {
    if (unread && id !== undefined) {
      markRead(id)
    }
  }, [unread, id, markRead])

  if (memberNumber === null) {
    return <SignedOut />
  }

  if (message === undefined) {
    return <NotFound />
  }

  /* Taken off the message once, so the two controls below and the question they answer are
     about the same thing rather than about three reads of it. */
  const { asks } = message
  const said = message.id
  const mine = memberNumber

  /* Taking somebody in writes what an approval in the moderator's queue writes, because it
     is the same fact arriving by another road: the team on the member's record, and the
     season from which they run for it, which is the next one (PDL, 05.09.2026: „obračun
     poena tima počinje tek od 1.1. naredne sezone"). */
  const take = (ask: Ask): void => {
    editRecord(ask.memberNumber, { teamId: ask.teamId, teamSince: String(seasonOnSale(today)) })
    settle(said, { status: 'approved', note: '', basis: '', memberNumber: '' })
    notify({
      from: t('app.name'),
      to: ask.memberNumber,
      subject: t('teams.joinDoneSubject', { team: ask.teamName }),
      body: t('teams.joinDoneBody', { team: ask.teamName }),
      date: today,
    })
  }

  const refuse = (ask: Ask): void => {
    settle(said, { status: 'rejected', note: '', basis: '', memberNumber: '' })
    notify({
      from: t('app.name'),
      to: ask.memberNumber,
      subject: t('teams.joinNoSubject', { team: ask.teamName }),
      body: t('teams.joinNoBody', { team: ask.teamName }),
      date: today,
    })
  }

  return (
    <div className="member">
      <h1>{message.subject}</h1>

      <p className="messages__from">
        {message.from} · {formatShortDate(message.date, locale)}
      </p>

      {/* The way back, under the heading and not over it: the page began with a
          link rather than with its own heading, so a reader listing the headings met
          a control before learning which page they were on (WCAG 2.2, 1.3.1 and
          2.4.6; owner, 04.09.2026). Kept a link and not dressed as a button, because
          it is a way out and not an action.

          **After the line of provenance, not between it and the subject, and not
          under the message.** Who is telling the member and when belongs to the
          subject, and `adminFlows.test.tsx:3536` reads it as the element after the
          heading, so nothing may stand between those two. Put under the message
          instead, it left a member on a telephone scrolling a long letter to get back
          to the pigeonhole, where the way out had been the first thing on the screen
          (review, 04.09.2026). So it follows the heading and the line that belongs to
          it, and precedes what the member came to read. */}
      <Link className="member__back" to={`/${locale}/poruke`}>
        {t('shell.allMessages')}
      </Link>

      <p className="messages__body">{message.body}</p>

      {/* And the answer, on the one kind of message that asks for one. Most messages tell;
          an application to a team is decided by whoever runs that team and by nobody else
          (owner, 05.09.2026: the moderator's queue is for what the league decides, and who
          is in whose team is not that).

          Answered once. The answer is a `Decision` under this message's own id, the same
          way everything else on this portal that somebody decides is kept, so „has this
          been answered" has one home and cannot be asked twice.

          **The wait is inline**, because the message itself is already drawn above it: a
          loader without that lies over the whole page, dims what is there and lets nothing
          be pressed, which is meant for a page that has nothing on it yet (`Loader.css`,
          and the eight other places that hold part of a screen). */}
      {asks !== undefined &&
        (decisions[said] !== undefined ? (
          <p className="messages__answer">{t('teams.joinSettled')}</p>
        ) : (
          <Resource state={state} inline>
            {([teams, competitors]) => {
              /* **Asked here and not when the letter was written.** Between the asking
                 and the answering the portal can change underneath the question: the
                 team can be deleted, whoever answers can stop administering it, the
                 member can join another team, and the window can close. All four were
                 live before this was written, and the worst of them pulled a member out
                 of a team that had never been asked (review, 05.09.2026). The queue of
                 the moderators asks the same four in the same place, at the moment it
                 writes (`admin/teamProposal.ts`). */
              const listed = recordsOf(MEMBERS, competitors, overlay)
              const why = joinRefusal(
                asks,
                recordsOf(TEAMS, teams, overlay),
                listed,
                mine,
                today,
              )

              return why === null ? (
                <p className="messages__answer">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      take(asks)
                    }}
                  >
                    {t('teams.joinTaken')}
                  </button>{' '}
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      refuse(asks)
                    }}
                  >
                    {t('teams.joinRefused')}
                  </button>
                </p>
              ) : (
                <p className="messages__answer">
                  {t(why)}{' '}
                  {/* **And a way to end it, because a question with no answer never
                      ends.** „Waiting" is read off the decisions, so an application that
                      cannot be taken went on counting for ever, and the member who sent it
                      was refused the way in on every team on the portal (review,
                      05.09.2026). Closing it is a refusal like any other: the member is
                      told, and is free to ask again. */}
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      refuse(asks)
                    }}
                  >
                    {t('teams.joinClose')}
                  </button>
                </p>
              )
            }}
          </Resource>
        ))}
    </div>
  )
}
