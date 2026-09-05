import type { Ask } from '../session/context'
import type { Competitor, Team } from './types'
import { joinRefusal } from './teamJoin'

/* Why an application to join a team cannot be taken, asked at the moment somebody answers
 * it rather than at the moment it was sent.
 *
 * Every one of these four was live before the function existed (review, 05.09.2026), and
 * the first of them is the reason it is a function and not four conditions on a screen: an
 * application waits in an inbox, and the portal moves underneath it while it waits.
 */

const DAY = '2026-10-15'
const SHUT = '2026-06-15'

const TEAM: Team = {
  id: 'team-dunav',
  slug: 'dunavski-trkaci',
  name: 'Dunavski trkači',
  city: 'Novi Sad',
  country: 'RS',
  organizerMemberNumber: '000001',
  bio: '',
  logo: null,
  crop: { x: 0.5, y: 0.5, size: 1 },
}

const member = (over: Partial<Competitor>): Competitor => ({
  memberNumber: '000002',
  firstName: 'Relja',
  lastName: 'Momčilović',
  gender: 'M',
  city: 'Novi Sad',
  country: 'RS',
  birthYear: 1990,
  firstSeason2027: false,
  firstSeason: 2019,
  active: true,
  membershipBasis: 'payment',
  referralCode: '',
  referredBy: null,
  teamId: null,
  teamSince: null,
  bio: '',
  ...over,
})

/** Who runs the team, and who is asking to be let in. */
const RUNS = member({ memberNumber: '000001', teamId: 'team-dunav', teamSince: 2019 })
const ASKING = member({})
const ASK: Ask = {
  kind: 'teamJoin',
  teamId: 'team-dunav',
  teamName: 'Dunavski trkači',
  memberNumber: '000002',
}

describe('why an application to join a team cannot be taken', () => {
  it('is nothing at all when everything still stands as it did', () => {
    expect(joinRefusal(ASK, [TEAM], [RUNS, ASKING], '000001', DAY)).toBe(null)
  })

  it('is that the team is gone, when somebody deleted it while the letter waited', () => {
    /* Deleting a team is free until the end of the year (owner, 05.09.2026), so this is
       not a rare accident: the administrator can delete the team and then open the
       application. Written without it, the answer put a member into an identity nothing
       answers to, and that member could then neither join another team nor found one. */
    expect(joinRefusal(ASK, [], [RUNS, ASKING], '000001', DAY)).toBe('teams.joinTeamGone')
  })

  it('is that the team is no longer theirs, when the one answering has been replaced', () => {
    /* A moderator may hand a team to somebody else (PDL, 04.09.2026), and the letter went
       to whoever ran it when it was sent. „Who may decide" is asked at the moment of the
       decision, because that is when it is written; the queue of the moderators answers
       the same question the same way (`admin/teamProposal.ts`). */
    const handed: Team = { ...TEAM, organizerMemberNumber: '000009' }
    const other = member({ memberNumber: '000009', teamId: 'team-dunav', teamSince: 2018 })

    expect(joinRefusal(ASK, [handed], [other, ASKING], '000001', DAY)).toBe(
      'teams.joinNotYours',
    )
  })

  it('is that the member has a team now, which they did not have when they asked', () => {
    /* PDL P13: a member is in one team. Two applications could not be sent at once since
       05.09.2026, but one can be sent, answered elsewhere, and this one opened after. */
    const joined = member({ teamId: 'team-vardar', teamSince: 2027 })

    expect(joinRefusal(ASK, [TEAM], [RUNS, joined], '000001', DAY)).toBe('teams.joinHasTeam')
  })

  it('is that the window has shut, because the answer is what writes the season', () => {
    /* `seasonOnSale` answers the next season only inside the window. Answered in June, the
       same expression writes the running one, which puts the member into this year's team
       with every result they have already run this year. A team changes in one window and
       in no other (owner, 05.09.2026). */
    expect(joinRefusal(ASK, [TEAM], [RUNS, ASKING], '000001', SHUT)).toBe('teams.joinShut')
  })

  it('asks them in the order that makes each answer true', () => {
    /* All four wrong at once: the team is gone, so nothing else can be asked about it, and
       that is the answer given. Asked in another order, „this team is not yours" would be
       said about a team that does not exist. */
    expect(joinRefusal(ASK, [], [ASKING], '000009', SHUT)).toBe('teams.joinTeamGone')
  })
})
