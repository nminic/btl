import userEvent from '@testing-library/user-event'

/**
 * The keyboard and the mouse as a person uses them, with nothing between one key
 * and the next.
 *
 * userEvent waits zero milliseconds between two events by default, and zero is
 * not nothing: it is a turn of the event loop per key, which in jsdom costs
 * several times what the key itself does. Measured on the race form, typing
 * thirteen letters spent about a quarter of a second asleep and about eighty
 * milliseconds working, and whole files ran three to five times longer than the
 * work in them. The slowest of them came near enough to the limit for one test to
 * pass on this machine and time out on a loaded runner, which is where this
 * started (entityForms.test.tsx, GitHub run 30528720474).
 *
 * Nothing on this portal debounces or throttles what is typed, so there is no
 * behaviour behind that wait to lose. A test that needs time to actually pass
 * has to arrange it itself rather than lean on this.
 */
export function setupUser() {
  return userEvent.setup({ delay: null })
}
