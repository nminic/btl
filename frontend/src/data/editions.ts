import type { BtlEvent } from './types'

/**
 * One race through the years, from the edition being read backwards.
 *
 * An event copied for the next season carries the id of the one it came out of
 * (`copiedFrom`, written once at the moment of copying), so a chain of editions
 * is a chain of those, and this walks it: the 2027 running, the 2026 one it was
 * made from, the 2025 one before that, as far back as the copying goes.
 *
 * What it is for is the comments. What was said about last year's running is
 * said about this race, and a comment is tied to the exact event it was written
 * under (owner, 11.08.2026), so a screen that asked only its own event started
 * every edition with nothing.
 *
 * Newest first, which is the order they were built in and the order they are
 * read in.
 *
 * **The loop is real, not defensive.** The link is a value in a record, and
 * records are written by people and by imports as well as by the copy button:
 * an event pointing at itself, or two pointing at each other, is a page that
 * never finishes drawing. Every id is met once.
 */
export function editionsOf(events: BtlEvent[], eventId: string): BtlEvent[] {
  const byId = new Map(events.map((event) => [event.id, event]))
  const chain: BtlEvent[] = []
  const met = new Set<string>()

  let at = eventId

  while (at !== '' && !met.has(at)) {
    met.add(at)

    const event = byId.get(at)

    if (event === undefined) {
      /* A parent that is not there: an event deleted while its copy lives on,
         which deletion allows and nothing forbids. The chain stops where the
         record stops rather than the screen stopping. */
      return chain
    }

    chain.push(event)
    at = event.copiedFrom
  }

  return chain
}
