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

/** The values in one line, in the order they were written, so a test can say
 *  what is there and equally what is not. */
function written(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join(' ')
}
