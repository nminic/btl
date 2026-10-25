import { clearResourceCache } from '../../data/client'
import { askTheServer, type Answer } from '../account/askTheServer'
import { MY_MEMBERSHIP } from './myMembership'

/**
 * A MEMBER LETTING HIMSELF IN ON HIS OWN BALANCE, which is `POST /api/me/membership`
 * (`MyMembershipWriteApi`) and this module is its only caller on this side.
 *
 * <p><b>Owner, 26.09.2026:</b> „Balans veći ili jednak članarini aktivira članstvo bez uplate." The route
 * has stood since that decision and nothing on the portal sent it; letter G (owner, 24.10.2026) tells the
 * member to „Aktivirajte članstvo jednim klikom na strani Moja članarina", and the owner's answers of
 * 25.10.2026 (PDL, „Dugme „Aktiviraj članstvo" na „Mojoj članarini"") put the button there: „Aktiviraj
 * članstvo", with no window asking him to confirm it.
 *
 * <p><b>The same address as the read beside it, `MY_MEMBERSHIP`, and only the verb differs</b>, so the
 * two cannot part: the route that says what he owes and the route that lets him in are one resource.
 *
 * <p><b>IT SENDS NOTHING, AND THAT IS THE ROUTE'S AUTHORISATION RATHER THAN AN OMISSION.</b> No member,
 * no season and no amount: the route names nobody but the caller and reads the season off its own clock
 * (`SeasonClock.seasonBeingPaidFor`), so there is no shape of this request in which one member could
 * spend another's balance or buy a year the day does not sell.
 *
 * <p><b>`competitors` IS DROPPED WHERE THE SERVER LET HIM IN</b>, the rule `member/teamExit.ts` keeps for
 * its own write: the public list answers `where c.active`, and this write is what makes him active, so a
 * list held from before would go on leaving him out of it. A refusal leaves everything as it was.
 */
export async function theServerWasAskedToLetMeIn(): Promise<Answer> {
  const answer = await askTheServer(MY_MEMBERSHIP, {})

  if (answer.got === 'done') {
    clearResourceCache('competitors')
  }

  return answer
}

/** What the route says it did: the season he is now a member of and his number, old or newly drawn. */
export type LetIn = { season: number; memberNumber: string }

/**
 * What the route says it did, narrowed by looking at the answer (ADL A14), or nothing.
 *
 * <p>`MyMembershipWriteApi.Activated` carries a third component, `fromTheBalance`; the screen does not
 * say it (owner, 25.10.2026: the sentence beside the button names no amount), so it is not narrowed.
 */
export function letInBy(body: unknown): LetIn | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const season: unknown = Reflect.get(body, 'season')
  const memberNumber: unknown = Reflect.get(body, 'memberNumber')

  if (typeof season !== 'number' || !Number.isInteger(season) || typeof memberNumber !== 'string') {
    return null
  }

  return { season, memberNumber }
}

/**
 * `MyMembershipWriteApi`, which names three, each answered in its own words (PDL, 25.10.2026, „Odbijanja
 * servera dobijaju svaka svoju rečenicu").
 *
 * <p>The three are what can change between the read the button was drawn from and the press: another tab
 * or a moderator let him in first, the administration freed him of the season or made it free, or his
 * balance no longer reaches the fee. The screen asks the server again after each of them, so what is
 * drawn under the sentence is what now stands.
 */
export const WHEN_LETTING_MYSELF_IN: Record<string, string> = {
  alreadyAMemberOfThisSeason: 'membership.letInAlready',
  thereIsNoFeeToPay: 'membership.letInNothingToPay',
  theBalanceDoesNotCoverTheFee: 'membership.letInNotEnough',
}
