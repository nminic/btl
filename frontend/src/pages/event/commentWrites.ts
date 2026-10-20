import { clearResourceCache } from '../../data/client'
import { theCommentsHaveChanged } from '../../data/useResource'
import { askTheServer, type Answer } from '../account/askTheServer'

/**
 * A MEMBER DELETING HIS OWN RATING OF AN EVENT, and what that changes on the screen (`CommentWriteApi`,
 * `DELETE /api/comments/{id}`; owner, PDL P6, 20.10.2026: „zelim funkcionalnost da clan moze uvek da
 * obrise svoj komentar").
 *
 * <p>The id is the published rating the event page shows him. The server takes every published rating
 * of his of that event and his one that waits, and after its 204 nothing of his about the event is
 * published. It names no refusal: anything that is not his is 404, the answer of an address that maps
 * nothing (ADL A8), so `refusals.test.ts` has nothing of this route to hold.
 *
 * <p><b>A 404 is read as „what the screen showed is no longer there"</b> (the coordinator's decision of
 * 20.10.2026): the rating was replaced or deleted in another window, or his fee lapsed since the page
 * was drawn. No sentence is said; the comments are read again and the page draws what the server has,
 * which is the true answer. Every other answer is said in the portal's own words beside the rating.
 */
export async function theRatingDeleted(comment: number): Promise<Answer> {
  const answer = await askTheServer(`/api/comments/${String(comment)}`, {}, 'DELETE')

  if (saysNothing(answer)) {
    whatADeletionChanges()
  }

  return answer
}

/**
 * WHAT IS NO LONGER TRUE ONCE HIS RATING IS GONE, OR WAS ALREADY GONE: the comments, read again at once
 * by both their readers on the page (the list under the event and the mark beside its name,
 * `theCommentsHaveChanged`), and the moderator's queue, dropped for its next read, because the deletion
 * took his rating that waited as well and the header counts it.
 */
function whatADeletionChanges(): void {
  clearResourceCache('verification')
  theCommentsHaveChanged()
}

/** Whether an answer to a deletion is one the screen says nothing about: done, or no longer there. */
export function saysNothing(answer: Answer): boolean {
  return answer.got === 'done' || (answer.got === 'wrong' && answer.status === 404)
}
