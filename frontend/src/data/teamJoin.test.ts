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

  it('is that nobody runs the team, when the last member of it has gone', () => {
    /* `teamAdminOf` answers nobody for a team nobody is in, and a reader told „this is no
       longer yours" would look for whoever it is now. Nobody is (review, 05.09.2026). */
    expect(joinRefusal(ASK, [TEAM], [ASKING], '000001', DAY)).toBe('teams.joinNobodyRuns')
  })

  it('is that the member is gone, when administration has deleted them', () => {
    /* Nothing stops a member being deleted while a letter about them waits. Taken then,
       the answer wrote a team onto a record that is gone and brought back the very edits
       the deletion had thrown away (review, 05.09.2026). */
    expect(joinRefusal(ASK, [TEAM], [RUNS], '000001', DAY)).toBe('teams.joinMemberGone')
  })

  it('follows the roster and not the field, so a founder who has left stops deciding', () => {
    /* Who runs a team is worked out from the roster: the founder while they are still in
       it, and otherwise whoever has been in it longest (`data/teamAdmin.ts`, PDL
       04.09.2026). Read off `organizerMemberNumber` instead, the whole gate stayed green
       while a founder who had left went on answering (review, 05.09.2026). */
    const left = member({ memberNumber: '000001', teamId: 'team-vardar', teamSince: 2020 })
    const longest = member({ memberNumber: '000008', teamId: 'team-dunav', teamSince: 2015 })

    expect(joinRefusal(ASK, [TEAM], [left, longest, ASKING], '000001', DAY)).toBe(
      'teams.joinNotYours',
    )
    /* And the one the roster names does decide, which is the other half of the same
       answer and what keeps this from being met by refusing everybody. */
    expect(joinRefusal(ASK, [TEAM], [left, longest, ASKING], '000008', DAY)).toBe(null)
  })

  it('asks them in an order where each answer is true when it is given', () => {
    /* Everything wrong at once: no team, nobody running it, the member gone, and the
       window shut. „The team is gone" is the answer, because nothing else can be said
       about a team that does not exist. */
    expect(joinRefusal(ASK, [], [], '000009', SHUT)).toBe('teams.joinTeamGone')

    /* And the next boundary down, so the order is tied at every step rather than at the
       first: with the team there and nobody running it, that is the answer even though
       the member is gone and the window is shut too. */
    expect(joinRefusal(ASK, [TEAM], [], '000009', SHUT)).toBe('teams.joinNobodyRuns')

    /* Then: somebody runs it, but not the one answering. */
    expect(joinRefusal(ASK, [TEAM], [RUNS], '000009', SHUT)).toBe('teams.joinNotYours')

    /* Then: the right one is answering, and the member is gone. */
    expect(joinRefusal(ASK, [TEAM], [RUNS], '000001', SHUT)).toBe('teams.joinMemberGone')

    /* Then: the member is there and already has a team, which is said before the window,
       because „come back on 1 October" would promise something that will never happen. */
    const joined = member({ teamId: 'team-vardar', teamSince: 2027 })

    expect(joinRefusal(ASK, [TEAM], [RUNS, joined], '000001', SHUT)).toBe('teams.joinHasTeam')
  })
})
