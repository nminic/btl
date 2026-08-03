import type { Race } from '../../data/types'

/**
 * The race that was chosen, or the one the form opened on.
 *
 * Its own file so the second half can be tested and so the screen beside it goes
 * on exporting a component and nothing else. The choice is drawn from this very
 * list and the field is required, so in the portal the fallback never runs; it is
 * here because a lookup that can miss must say what it does when it does, and
 * "score it against whichever race the form opened on" is a decision rather than
 * a shrug. Scoring against the wrong race is points against the wrong distance,
 * and the one thing worse than that is a page that throws while somebody is
 * sending in a result they have just run.
 */
export function raceFor(races: Race[], id: string, opened: Race): Race {
  return races.find((one) => one.id === id) ?? opened
}
