import { WHEN_SENDING_A_PICTURE } from '../member/photoWrites'

/**
 * WHERE THE ADMINISTRATION SENDS A LEAGUE'S MARK, AND TAKES IT DOWN (`LeagueMarkApi`, owner, PDL 23.11.2026,
 * „Pravi logo lige": „administracija ... u moderaciji lige, bez odobravanja, i odmah važi").
 *
 * Its own module rather than a constant beside the panel, the arrangement `member/photoWrites.ts` gives its
 * reason for: `react/only-export-components`, and a test asking a question about an object does not have to
 * mount React to ask it.
 */
export function theMarkOf(league: number): string {
  return `/api/leagues/${String(league)}/logo`
}

/**
 * THE REASONS THE TWO DOORS CAN NAME, AND THE SENTENCE THAT MEETS EACH.
 *
 * `LeagueMarkApi` declares no reason of its own: it refuses a picture with the words a member's own picture
 * is refused with (`MePhotoApi`, the four of `WHEN_SENDING_A_PICTURE`), and a frozen league with the words
 * the league's own form is refused with (`LeagueWriteApi.THE_SEASON_IS_FROZEN`). So the sentences are those
 * screens' too, and `leagueMarkWrites.test.ts` reads the Java file for which constants it names.
 */
export const WHEN_SETTING_A_LEAGUES_MARK: Record<string, string> = {
  ...WHEN_SENDING_A_PICTURE,
  theSeasonIsFrozen: 'admin.leagueSaveRefused.theSeasonIsFrozen',
}
