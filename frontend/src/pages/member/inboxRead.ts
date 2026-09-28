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
 * EVERY KEY THIS VISIT HAS ALREADY ASKED ABOUT, whether the asking worked or not.
 *
 * <p><b>This is a guard against a loop and not an optimisation, and the loop is real rather
 * than imagined.</b> The screen asks from an effect over „is this unread", and a successful
 * write bumps the inbox revision, which makes the screen read the server again - on purpose,
 * so that the answer it holds carries the mark it has just written. If the route FAILS, the
 * line comes back unread, the effect fires again, and without this set the portal would ask
 * for ever over a route that is answering 404.
 *
 * <p><b>Keys and not a count, because the member opens many messages in one visit</b> and
 * each one is its own question. Module scope for the reason `data/useResource.ts` gives about
 * its own two facts: the screen unmounts on every navigation and a `useRef` would forget
 * between two openings of the same message.
 *
 * <p><b>What this deliberately does NOT do is keep a read mark of its own.</b> Whether a
 * message is read is the server's answer and is read off the line; this holds only „have I
 * already asked", which is a fact about this visit's requests and about nothing else. Two
 * stores for one fact is what `asServed` and `asALine` exist to prevent.
 */
const alreadyAsked = new Set<string>()

/**
 * Marks a served message read, once per key per visit.
 *
 * <p><b>The cache is dropped only where the server agreed</b>, and that is the axis this
 * function cannot get wrong: a refusal must leave the count exactly as the server last said
 * it was. Bumping the revision on the asking rather than on the answering would have the
 * envelope fall for a write that never happened, which is the portal lying about the one
 * number PDL 27a exists to make true.
 *
 * <p><b>And a refusal is not drawn anywhere, which is a boundary rather than an omission.</b>
 * Nothing in PDL says what a member should be told when a read receipt does not land, and the
 * honest answer on this screen is nothing: he is looking at the message he asked for, it is
 * on the screen in front of him, and an error box over it would describe a failure that costs
 * him a number in a corner. What the portal must not do is claim the write happened, and it
 * does not - the line stays unread and the envelope goes on counting it.
 *
 * @param id `message.id` as text, which is what the address of a message is
 */
export async function theServerHasSeenThisOpened(id: string): Promise<void> {
  if (alreadyAsked.has(id)) {
    return
  }

  alreadyAsked.add(id)

  const answer = await askTheServer(`/api/inbox/${id}/read`, {})

  if (answer.got === 'done') {
    theInboxHasChanged()
  }
}

/**
 * Forgets which keys this visit has asked about, for the test setup and for nothing else.
 *
 * <p>`test/setup.ts` clears the resource cache between cases for the identical reason: module
 * state outlives a render tree, so a case that opened message 501 would otherwise leave the
 * next case unable to open it at all - and that next case would go green while measuring
 * nothing, which is the failure shape this repo refuses hardest.
 */
export function forgetWhatHasBeenOpened(): void {
  alreadyAsked.clear()
}
