import type { EventComment, PendingItem } from './types'

/**
 * A waiting comment as the record it becomes once somebody lets it out.
 *
 * The queue keeps the name the member had on the day, which is what a comment
 * carries after they leave the league (PDL P11), so the name travels with the
 * record rather than being looked up again later.
 *
 * It lives in its own file because both sides of the act need it and neither
 * side may import the other: the administration turns an approval into this,
 * and the event page reads what came out. Between them stands the session,
 * which is the only thing that knows both.
 *
 * **Without the identity**, which the session hands out (`SessionProvider`,
 * `publish`). A published comment is identified by a number since 20.09.2026,
 * because that is what `/api/comments` answers with, and the identity a queue
 * item carries is not one.
 */
export function commentFrom(item: PendingItem): Omit<EventComment, 'id'> {
  return {
    eventId: Number(item.subjectId),
    memberNumber: item.memberNumber,
    who: item.who,
    date: item.date,
    rating: item.rating,
    body: item.body,
  }
}
