import { WHEN_MOVING_THE_CIRCLE_OF_A_PICTURE, WHEN_SENDING_A_PICTURE } from './photoWrites'

/**
 * WHERE A TEAM'S LOGO IS SENT, READ AND TAKEN DOWN (`TeamLogoApi`, owner, PDL 25.11.2026, „Urednik tima postavlja
 * znak tima slikom”, and the answers of the same day, „Logo tima, pitanja iz plana”).
 *
 * Two doors and two addresses: the team's editor sends a logo that waits for a moderator, reads both halves of it,
 * and takes the one that stands down, at `/api/teams/{id}/own-logo`; the administration sets one at once and takes
 * it down at `/api/teams/{id}/logo`. Its own module for the reason `member/photoWrites.ts` gives.
 */
export function ourLogoAt(team: number): string {
  return `/api/teams/${String(team)}/own-logo`
}

/** Where the logo that waits is served to the editor (`PhotoApi.teamLogoThatWaits`): under the digest alone. */
export const A_WAITING_LOGO_IS_NAMED_BY = '/api/teams/own-logo/'

/** The address of the logo that waits, out of the digest the route answered with. */
export function theWaitingLogoAddressIn(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const digest: unknown = Reflect.get(body, 'digest')

  return typeof digest === 'string' && digest !== '' ? A_WAITING_LOGO_IS_NAMED_BY + digest : null
}

/** The administration's door, at once (`TeamLogoApi.setTheLogo`, `TeamLogoApi.takeTheLogoDown`). */
export function theTeamsLogoAt(team: number): string {
  return `/api/teams/${String(team)}/logo`
}

/**
 * THE REASONS THE TWO DOORS CAN NAME, AND THE SENTENCE THAT MEETS EACH. `TeamLogoApi` declares no reason of its
 * own: it refuses a logo with the words a member's own picture is refused with (`MePhotoApi`), so the sentences are
 * that screen's, and `teamLogoWrites.test.ts` reads the Java file for which constants it names.
 */
export const WHEN_SENDING_A_TEAMS_LOGO: Record<string, string> = WHEN_MOVING_THE_CIRCLE_OF_A_PICTURE

export const WHEN_SETTING_A_TEAMS_LOGO: Record<string, string> = WHEN_SENDING_A_PICTURE
