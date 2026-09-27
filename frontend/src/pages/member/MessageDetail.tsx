import { useEffect } from 'react'
import { useParams } from 'react-router'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { combineResources, useCompetitors, useInbox, usePairs, useTeams } from '../../data/useResource'
import type { InboxLine } from '../../data/types'
import { MEMBERS, TEAMS, recordsOf } from '../admin/entityForms'
import { pairsNow } from '../../data/derive'
import { useOverlay } from '../admin/overlay'
import { InvitationAnswer } from './InvitationAnswer'
import { PairInviteAnswer } from './PairInviteAnswer'
import { NotFound } from '../NotFound'
import { Resource } from '../../components/Resource'
import { useMemberScreen } from './memberScreen'
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
  const who = useMemberScreen()

  /* The gate before the asking, for the reason written over `Messages.tsx`: an account that
     races for nobody is told `/api/inbox` is not there, so asking first would spend a refused
     request and hand this screen an error to draw over a sentence that is already right. */
  return who.memberNumber === null ? who.instead : <TheMessageAsked />
}

/**
 * The inbox, waited for.
 *
 * **Waited for and not read through `dataOr`, which is the opposite of what the panel in the
 * header does and for a reason that is this screen's alone:** an address that names no message
 * of this member's answers with the not found page, and „it has not arrived yet" looks exactly
 * like „there is no such message" to anything reading the list. Read with a fallback, every
 * visit to a real message would show the not found page first and correct itself after.
 */
function TheMessageAsked() {
  return <Resource state={useInbox()}>{(lines) => <TheMessage lines={lines} />}</Resource>
}

function TheMessage({ lines }: { lines: InboxLine[] }) {
  const { locale } = useI18n()
  const { id } = useParams()
  const { markRead, pairsMade, pairsBroken } = useSession()
  const state = combineResources(useCompetitors(), useTeams(), usePairs())
  const overlay = useOverlay()
  /* Out of the inbox rather than out of the store, so an address that names
   * somebody else's message answers with the not found page instead of showing
   * it. Whose a message is was decided before it got here: by the route's own
   * `where` clause for a served line (`InboxApi`: „his own, or everybody's"),
   * and by the provider's filter for one the browser is holding. */
  const message = lines.find((one) => one.id === id)
  /* Read out once, so the block below asks about a value rather than about a
     property: written as `message.invitation ?? ''` inside it, the fallback is a
     branch nothing can reach, and a branch nothing reaches is a branch that hides
     what it would have done. */
  const invitation = message?.invitation
  /* The same, for the one that asks about a racing pair. Two fields rather than one with a kind
     beside it, so the compiler keeps the two answers apart (`session/context.ts`). */
  const pairInvite = message?.pairInvite
  /* **AND ONLY WHERE SAYING SO REACHES ANYTHING, since 27.09.2026.** Opening a message is what
     marks it read, and for a line that came off the server there is nothing for that to write
     to: `message_read` is in the schema and no route on the portal writes it (measured over the
     whole of `backend/src/main`). So a served line is left as the server has it rather than
     marked in a store the next visit will not read (`data/types.ts`, `canBeMarkedRead`). */
  const unread = message !== undefined && !message.read && message.canBeMarkedRead

  useEffect(() => {
    if (unread && id !== undefined) {
      markRead(id)
    }
  }, [unread, id, markRead])

  if (message === undefined) {
    return <NotFound />
  }

  return (
    <div className="member">
      <h1>{message.subject}</h1>

      <p className="messages__from">
        {message.from} · {formatShortDate(message.date, locale)}
      </p>

      <p className="messages__body">{message.body}</p>

      {/* The one message that asks. Everything the answer depends on is read
          when it is drawn rather than remembered on the message, so the two
          resources are loaded only for the message that has an invitation on it
          (member/InvitationAnswer.tsx). */}
      {invitation !== undefined && (
        <Resource state={state}>
          {([everybody, allTeams]) => (
            <InvitationAnswer
              invitation={invitation}
              /* Through the overlay, because the answer is held against where the
                 member is **now**: pressing „Prihvati" writes the team on their
                 record, and read off the file this screen would go on offering the
                 same button to somebody who has just used it. The two profile pages
                 read the same records for the same reason (PR 199). */
              competitors={recordsOf(MEMBERS, everybody, overlay)}
              /* And the teams through it too: a team deleted during this visit is
                 gone from the records and still in the file, and the invitation it
                 sent is answered by asking which team it was. */
              teams={recordsOf(TEAMS, allTeams, overlay)}
            />
          )}
        </Resource>
      )}

      {/* And the message that asks about a racing pair, answered the same way and from the same
          resources. The pairs are read through what this visit has made and broken, so the answer
          is held against where the two of them stand **now**: accepted once, the button is gone
          rather than offered again (`data/derive.ts`, `pairsNow`). */}
      {pairInvite !== undefined && (
        <Resource state={state}>
          {([everybody, , fromFile]) => (
            <PairInviteAnswer
              pairInvite={pairInvite}
              competitors={recordsOf(MEMBERS, everybody, overlay)}
              pairs={pairsNow(fromFile, pairsMade, pairsBroken)}
            />
          )}
        </Resource>
      )}
    </div>
  )
}
