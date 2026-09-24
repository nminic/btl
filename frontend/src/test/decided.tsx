import { useSession } from '../session/useSession'

/**
 * What the session was told about the items that have been decided.
 *
 * The queues used to draw a table of them, and every test about a decision read
 * it there. That table is gone (owner, 06.08.2026): a queue shows what is
 * waiting, and what is settled is not work standing before a moderator. The
 * decision is still the thing worth holding, so it is read where it lives.
 *
 * Written as one line per decision, in a list, so a test asks for it by role and
 * by words like any other list on the portal rather than by reaching into state.
 * The submissions are here too, because the results are the one queue whose
 * items are entered during the visit and are therefore not in `decisions`.
 */
export function Decided() {
  const { decisions, submissions } = useSession()

  return (
    <ul aria-label="session decisions">
      {Object.entries(decisions).map(([id, decision]) => (
        <li key={id}>
          {`${id} | ${decision.status} | ${decision.note} | ${decision.basis} | ${decision.memberNumber}`}
        </li>
      ))}
      {submissions
        .filter((one) => one.status !== 'pending')
        .map((one) => (
          <li key={one.id}>{`${one.id} | ${one.status} | ${one.note}`}</li>
        ))}
    </ul>
  )
}

/**
 * What has been let out onto an event's own page during this visit, the queue
 * item beside the event it landed on.
 *
 * `published` is written down at the moment a comment is let out precisely so
 * the event page never has to read the queue to find out
 * (`session/context.ts`, `SessionProvider`). A case that only asked whether
 * ANYTHING had been published could not tell a comment let out from the right
 * queue item apart from one let out from any other item on any other queue;
 * this reads the pair the session itself carries, the queue item's own id
 * beside the event id the comment was filed under, so a decision on one item
 * publishing under a different item's name - or under a queue that should
 * never publish at all - is visible here too, and an empty list is the claim
 * that nothing was.
 */
export function Published() {
  const { published } = useSession()

  return (
    <ul aria-label="session published">
      {published.map(({ from, comment }) => (
        <li key={from}>{`${from} | ${comment.eventId}`}</li>
      ))}
    </ul>
  )
}

/**
 * What is in the inbox of whoever the session is, subject by subject.
 *
 * The one thing about a message that no administrative screen shows, and the
 * only way to say „nothing was written" rather than „the screen did not draw
 * it". It reads `inbox` and not the whole store on purpose: `inbox` is what a
 * member is allowed to see, and it carries what was written to the whole league
 * as well as what was written to them (SessionProvider). A refusal sent to the
 * empty string is therefore visible here, which is exactly the mistake worth
 * catching (Message.to).
 */
export function Inbox() {
  const { inbox } = useSession()

  return (
    <ul aria-label="session inbox">
      {inbox.map((one) => (
        <li key={one.id}>{`${one.to} | ${one.subject}`}</li>
      ))}
    </ul>
  )
}
