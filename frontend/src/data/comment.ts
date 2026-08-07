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
 */
export function commentFrom(item: PendingItem): EventComment {
  return {
    id: item.id,
    eventId: item.subjectId,
    memberNumber: item.memberNumber,
    who: item.who,
    date: item.date,
    rating: item.rating,
    body: item.body,
  }
}
