/**
 * THE WORD HIS OWN DELETION LEAVES FOR THE FRONT PAGE WITH: „Tvoj nalog je obrisan." (the owner, 20.11.2026, „Obriši
 * nalog" at the end of „Moja članarina").
 *
 * <p>Carried in the state of the navigation, the shape `teamDeleted.ts` keeps for the same reason: it belongs to that one
 * arrival, so a reader who comes to the front page any other way is told nothing, and it is asked of by shape because
 * `location.state` is `unknown`.
 */
export const ACCOUNT_DELETED = { accountDeleted: true } as const

export function accountWasDeleted(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'accountDeleted' in state && state.accountDeleted === true
}
