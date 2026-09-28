import type { Asked } from './serverAnswers'

/**
 * WHAT THE ROUTES WERE TOLD, in the shape `test/saved.tsx` showed the session in.
 *
 * <p><b>Why a second probe rather than a change to the first.</b> `Saved` exists for values
 * a screen holds and no screen draws - the country of an event is the whole of that case,
 * since it stopped being a field and is written by the town beside it (`forms/types.ts`) -
 * and it read them out of the session overlay, because that is where a prototype without a
 * database kept them. Since 28.09.2026 the calendar's screens send instead
 * (`admin/AdminEvents.tsx`, `event/EventActions.tsx`), so the same fact lives on the wire
 * and `Saved` has nothing to show about an event. The six entities that still write into
 * the session go on using it.
 *
 * <p><b>The line is written the same way on purpose</b>, `name=value` joined by spaces, so
 * a case that moved from one to the other keeps the words it was asking about and only
 * changes where it looks. A different shape here would have meant rewriting every
 * assertion as well as every lookup, and then nothing would have been holding the two
 * against each other.
 *
 * <p>A GET is not a telling, and neither is a write with no body: `DELETE` carries none,
 * and what it means is the ADDRESS rather than anything inside it. Both are left out so a
 * case that filters for a field name is never answered by a request that has no fields.
 */
export function whatWasSent(asked: Asked[]): string[] {
  return asked
    .filter((one) => (one.init?.method ?? 'GET') !== 'GET' && one.init?.body !== undefined)
    .map((one) => {
      const body: unknown = JSON.parse(String(one.init?.body))
      const fields =
        typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}

      return `${one.init?.method ?? 'GET'} ${one.path} | ${written(fields)}`
    })
}

/**
 * And the addresses that were written to, for a case about WHICH record was reached rather
 * than about what it was told.
 *
 * <p>Carries the verb, because one address answers three of them and „deleted" and „changed"
 * are not the same news about a race.
 */
export function whereItWrote(asked: Asked[]): string[] {
  return asked
    .filter((one) => (one.init?.method ?? 'GET') !== 'GET')
    .map((one) => `${one.init?.method ?? 'GET'} ${one.path}`)
}

/** One record as one line, which is `test/saved.tsx`'s own shape. */
function written(values: Record<string, unknown>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}=${String(value)}`)
    .join(' ')
}
