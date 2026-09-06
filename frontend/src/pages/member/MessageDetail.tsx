import { useEffect } from 'react'
import { useParams } from 'react-router'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { combinePair, useCompetitors, useTeams } from '../../data/useResource'
import { MEMBERS, TEAMS, recordsOf } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { InvitationAnswer } from './InvitationAnswer'
import { NotFound } from '../NotFound'
import { Resource } from '../../components/Resource'
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
  const { locale } = useI18n()
  const { id } = useParams()
  const { memberNumber, inbox, markRead } = useSession()
  const state = combinePair(useCompetitors(), useTeams())
  const overlay = useOverlay()
  /* Out of the inbox rather than out of the store, so an address that names
   * somebody else's message answers with the not found page instead of showing
   * it (Message.to). */
  const message = inbox.find((one) => one.id === id)
  /* Read out once, so the block below asks about a value rather than about a
     property: written as `message.invitation ?? ''` inside it, the fallback is a
     branch nothing can reach, and a branch nothing reaches is a branch that hides
     what it would have done. */
  const invitation = message?.invitation
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
    </div>
  )
}
