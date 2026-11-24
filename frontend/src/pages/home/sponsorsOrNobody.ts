import type { FrontPageSponsors } from '../../data/types'
import type { ResourceState } from '../../data/useResource'

/** The front page of a league with no sponsor: no box and no strip (PDL P24, owner 20.11.2026). */
const NOBODY: FrontPageSponsors = { ofTheDay: null, strip: [] }

/**
 * THE SPONSORS AS THE FRONT PAGE WAITS FOR THEM: WHILE THEY ARE COMING, AS THE REST OF THE PAGE IS, AND
 * WHEN THEY CANNOT BE READ, AS NOBODY.
 *
 * <p><b>Waited for with the four lists of the page, and not drawn into a page that is already
 * standing.</b> The answer moves the layout: with a sponsor of the day the grid is variant A with the
 * box, the calendar is its four rows and the strip stands under both columns; without one the calendar
 * runs to the bottom (`home__split--sponsored`, `Home.css`). A page drawn first without and then with
 * would jump under the reader's eyes, the calendar shrinking and a box appearing where races stood. The
 * answer is a few sponsors, asked for in the same breath as the results, which are a million and a half
 * bytes, so waiting for it costs nothing anybody can see.
 *
 * <p><b>A failure is the page without a sponsor, and never the page's failure.</b> Read through the
 * same `Resource` as the four lists, a sponsor that could not be read would have taken the boards, the
 * figures, the calendar and the calculator down with it and drawn „cannot be read" over the whole front
 * page. The sponsors are the one thing on it a visitor does not come for, so they go quietly, and the
 * page is then exactly the page of a league that has none, which is what it was until 24.11.2026. Not
 * said aloud: a sentence about a box that is not there is a sentence about nothing on the screen. The
 * next visit asks again, because a failed read is not kept (`data/client.ts`).
 */
export function sponsorsOrNobody(state: ResourceState<FrontPageSponsors>): ResourceState<FrontPageSponsors> {
  return state.status === 'error' ? { status: 'ready', data: NOBODY } : state
}
