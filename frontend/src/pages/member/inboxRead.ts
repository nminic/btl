import { askTheServer } from '../account/askTheServer'
import { theInboxHasChanged } from '../../data/useResource'

/**
 * OPENING A MESSAGE IS WHAT MARKS IT READ, AND THIS IS THE PORTAL SAYING SO TO THE SERVER.
 *
 * <p>Owner, PDL 27a, 27.09.2026, narrowing the outcome he chose in his own words: „Ako pod 1
 * spada pokrivanje funkcionalnosti na pravi nacin tako da kad clan otvori poruku ona stvarno
 * postaje procitana, onda da. Ne treba mi dugme da se nesto oznaci kao procitano ili
 * neprocitano." So there is one trigger and it is not a control: nothing on the portal calls
 * this from a click, and `member/MessageDetail.tsx` is its one caller.
 *
 * <p><b>A module of its own rather than a function inside the screen, which is the shape
 * `member/myCategory.ts` already has for the same reason:</b> `askTheServer` lives under
 * `pages/account` and `data/` does not import from `pages/` anywhere in this repo, so the one
 * place that may hold both this write and the cache it invalidates is a module on this side of
 * that line.
 */

/**
 * Marks a served message read.
 *
 * <p><b>The cache is dropped only where the server agreed</b>, and that is the axis this
 * function cannot get wrong: a refusal must leave the count exactly as the server last said it
 * was. Bumping the revision on the asking rather than on the answering would have the envelope
 * fall for a write that never happened, which is the portal lying about the one number PDL 27a
 * exists to make true.
 *
 * <p><b>AND THERE IS NO „HAVE I ASKED ALREADY" GUARD IN HERE, WHICH IS A MEASUREMENT AND NOT AN
 * OVERSIGHT.</b> One was written first, as a module-level set of keys, against a loop that looked
 * obvious: a successful write makes the caller's screen read the inbox again, so the effect that
 * asked runs a second time. It cannot loop, and the reason is the effect's own dependencies
 * (`member/MessageDetail.tsx`):
 *
 * <ul>
 * <li><b>The write worked.</b> The line comes back read, `unread` turns false, the effect re-runs
 * once on a changed dependency and does nothing.</li>
 * <li><b>The write was refused.</b> Nothing is dropped and nothing is bumped, so no re-read
 * happens at all and the dependencies do not move - React does not re-run an effect whose
 * dependencies are unchanged, however often the component renders.</li>
 * </ul>
 *
 * <p><b>It was removed rather than kept as insurance, because it was measured to carry
 * nothing:</b> disabled outright, all 26 cases of `member/openingMarksItRead.test.tsx` and
 * `member/inboxFromTheServer.test.tsx` stayed green, the two written specifically to count the
 * requests included. A branch nothing can reach is a branch that hides what it would have done,
 * and the coverage floor of 100 per cent on branches is what says so out loud. It also cost
 * something real: resetting module state between cases meant `test/setup.ts` importing this file,
 * which dragged `askTheServer` into the module graph of every test on the portal and broke
 * `data/useResource.test.tsx`, whose `vi.mock` of `data/client.ts` answers three names.
 *
 * <p><b>What the absence does allow, and it is harmless:</b> `StrictMode` runs an effect twice on
 * mount in development (`main.tsx`), so a development build sends this twice. The route is a
 * single `insert ... on conflict do nothing` keyed on `(message_id, competitor_id)`, and
 * `read_at` of the FIRST call survives every call after it (`InboxReadApi`), so the second
 * request changes nothing at all - which is the property that makes a guard here unnecessary
 * rather than merely unmeasured.
 *
 * @param id `message.id` as text, which is what the address of a message is
 */
export async function theServerHasSeenThisOpened(id: string): Promise<void> {
  const answer = await askTheServer(`/api/inbox/${id}/read`, {})

  /* **A refusal is drawn nowhere, which is a boundary rather than an omission.** Nothing in PDL
     says what a member should be told when a read receipt does not land, and the honest answer on
     this screen is nothing: he is looking at the message he asked for, it is in front of him, and
     an error box over it would describe a failure that costs him a number in a corner. What the
     portal must not do is claim the write happened, and it does not - the line stays unread and
     the envelope goes on counting it. */
  if (answer.got === 'done') {
    theInboxHasChanged()
  }
}
