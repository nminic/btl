import { useSession } from '../session/useSession'

/**
 * What the session was told to save, as it was told it.
 *
 * For values a screen holds and no screen draws. The country of an event is the
 * one there is: it used to be a field on the form, it is now written by the
 * town beside it (forms/types.ts), and there is nothing on any screen that
 * shows it. Read through the table, an event entered with the wrong country
 * looks exactly like one entered with the right country, which is how a record
 * carrying the word "undefined" went in behind a green test suite.
 *
 * Written as one line per record, in a list, so a test asks for it by role and
 * by words like any other list on the portal rather than by reaching into
 * state. Both halves are here because the two paths fail differently: a new
 * record can carry a value nobody typed, and a changed one can quietly keep the
 * value it had.
 */
export function Saved() {
  const { creations, edits } = useSession()

  return (
    <ul aria-label="session records">
      {Object.entries(creations).flatMap(([entity, made]) =>
        made.map((one) => (
          <li key={`${entity}-${one.id}`}>{`new ${entity} ${one.id} | ${written(one.values)}`}</li>
        )),
      )}
      {Object.entries(edits).map(([id, values]) => (
        <li key={id}>{`edit ${id} | ${written(values)}`}</li>
      ))}
    </ul>
  )
}

/**
 * And what a member's report says about the run, for the same reason.
 *
 * The moderator's queue draws five of the six figures a report carries, but only
 * as cells of a row whose text a test can search: a number found there is a number
 * found somewhere, and „500" is as true of the fall as of the climb, so the two
 * could be swapped and the row would read the same. The sixth, the category, that
 * queue does not draw at all, and it is what decides the ring on a profile, the
 * board a result lands on and the award it counts towards.
 *
 * Which of the six come from the race and which from the member depends on what the
 * race fixes (`pages/event/reportedResult.ts`), so what is worked out and what is
 * sent are two different readings and either can be right while the other is not.
 * One line per report, each figure under its own name, so a test says which one it
 * means.
 */
export function Reported() {
  const { submissions } = useSession()

  return (
    <ul aria-label="reported figures">
      {submissions.map((one) => (
        <li key={one.id}>
          {`km=${one.distanceKm} up=${one.ascentM} down=${one.descentM} sec=${one.seconds} pts=${one.points} cat=${one.category}`}
        </li>
      ))}
    </ul>
  )
}

/**
 * And what the session was told to remove, for the same reason.
 *
 * A deletion that follows another deletion is the case with no screen of its
 * own: a race taken off the table of an event is gone from that table whether
 * or not its results went with it, and the results themselves are drawn on
 * other screens, under a name two races of one event share. Measured there, the
 * assertion is a count of look-alike rows; measured here, it is the record
 * itself, by the identity the deletion used.
 *
 * One line per record, listed by entity and identity, so a test says what went
 * and equally what stayed.
 */
export function Deleted() {
  const { deletions } = useSession()

  return (
    <ul aria-label="session deletions">
      {Object.entries(deletions).flatMap(([entity, ids]) =>
        ids.map((id) => <li key={`${entity}-${id}`}>{`gone ${entity} ${id}`}</li>),
      )}
    </ul>
  )
}

/**
 * Every application still open, and on whose behalf.
 *
 * An application is the one thing on the portal answered by somebody other than whoever
 * wrote it, so „whose is this" and „is it still open" are two questions and no screen
 * shows either. A team that has taken a member in draws nothing about the application it
 * answered, and the member's own page draws nothing either. Read only through a screen, an
 * answer that never closed the application looks exactly like one that did, until months
 * later the member cannot join anywhere and nobody knows why.
 *
 * One line per application, by the identity it carries, so a test can say which one went
 * and equally which one stayed. That second half is the point: closing takes an identity,
 * and an identity that reaches two records closes both.
 */
export function Asked() {
  const { applications } = useSession()

  return (
    <ul aria-label="open applications">
      {applications.map((one) => (
        <li key={one.id}>{`${one.id} | ${one.memberNumber} | ${one.teamId} | ${one.date}`}</li>
      ))}
    </ul>
  )
}

/**
 * And what the pigeonhole holds for whoever is reading, for the same reason.
 *
 * What the portal tells a member lands on „/poruke", which is a different screen from the
 * one that wrote it, so a test standing where an application is answered cannot see
 * whether anything reached anybody, or which of two opposite things it said. Read off
 * `inbox`, which is what that screen reads.
 */
export function Pigeonhole() {
  const { inbox } = useSession()

  return (
    <ul aria-label="inbox">
      {inbox.map((one) => (
        <li key={one.id}>{`${one.date} | ${one.subject} | ${one.body}`}</li>
      ))}
    </ul>
  )
}

/** The values in one line, in the order they were written, so a test can say
 *  what is there and equally what is not. */
function written(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join(' ')
}
