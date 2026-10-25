/**
 * THE WORD A TEAM'S OWN PAGE LEAVES FOR THE LIST OF TEAMS WITH, once it has deleted the team (PDL, 24.10.2026, „Posle
 * brisanja na četiri mesta van administracije stoji vidljiva poruka": „strana tima posle brisanja vodi na spisak timova sa
 * „Tim je obrisan."").
 *
 * <p>Carried in the state of the navigation and not in a query or in the session: it belongs to that one arrival at the
 * list, and a reader who comes to the list any other way (a link, the menu) arrives with none and is told nothing. It is
 * asked of by shape, because `location.state` is `unknown` and any other screen may have put anything in it.
 */
export const TEAM_DELETED = { teamDeleted: true } as const

export function teamWasDeleted(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'teamDeleted' in state && state.teamDeleted === true
}
