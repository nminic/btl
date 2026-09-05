import { first } from '../../test/at'
import type { Competitor, PendingItem, Team } from '../../data/types'
import { NO_RATING } from '../../data/types'
import {
  addressOf,
  nameError,
  nameFault,
  organisers,
  refusal,
  teamFrom,
  type Proposed,
} from './teamProposal'

/* Turning a proposal into a team, as decisions rather than as a screen. One of
 * them has a case the screen cannot reach, which is why they are out here.
 */

const item = (over: Partial<PendingItem> = {}): PendingItem => ({
  id: 'prop-1',
  queue: 'teams',
    kind: '',
  date: '2027-01-10',
  memberNumber: '000007',
  who: 'Strahinja Vukićević',
  subject: 'Trkači Morave',
  subjectId: '',
  body: '',
  picture: '',
  crop: { x: 0.5, y: 0.5, size: 1 },
  currentDate: '',
  proposedDate: '',
  rating: NO_RATING,
  email: '',
  city: 'Čačak',
  country: 'RS',
  ...over,
})

/** The teams the league has while these are decided. Written out rather than empty,
 *  because a change is filed under one of them and „the team is gone" is one of the
 *  answers this function gives. */
const TEAMS: Team[] = [
  {
    id: 'team-dunav',
    slug: 'dunavski-trkaci',
    name: 'Dunavski trkači',
    city: 'Novi Sad',
    country: 'RS',
    organizerMemberNumber: '000001',
    bio: '',
    logo: null,
    crop: { x: 0.5, y: 0.5, size: 1 },
  },
]

/** The roster these are decided against. One member, who administers Dunav: the
 *  change of a team may only be taken on the word of whoever runs it today. */
const MEMBERS: Competitor[] = [
  {
    memberNumber: '000001',
    firstName: 'Vladan',
    lastName: 'Đurišić',
    gender: 'M',
    city: 'Novi Sad',
    country: 'RS',
    birthYear: 1988,
    firstSeason2027: false,
    firstSeason: 2019,
    active: true,
    membershipBasis: 'payment',
    referralCode: '',
    referredBy: null,
    teamId: 'team-dunav',
    teamSince: 2019,
    bio: '',
  },
]

const whole: Proposed = { name: 'Trkači Morave', city: 'Čačak', country: 'RS' }

describe('the address a team of a given name answers at', () => {
  it('is the same for two names that differ only in the way they are written', () => {
    /* Which is the whole reason a name is not what is compared: `slugify` drops
       case and turns č into c, so these are two names and one address. */
    expect(addressOf('Dunavski trkači')).toBe(addressOf('Dunavski Trkaci'))
  })

  it('is different for two teams that really are different', () => {
    expect(addressOf('Dunavski trkači')).not.toBe(addressOf('Dunavski trkači Novi Sad'))
  })

  it('is the same for one name written in the two scripts of the league', () => {
    /* The league is Balkan and both are written across it, so this is one team
       and not two, and one address says exactly that. Written the other way it
       was no address at all: the team answered at `/tim/`. */
    expect(addressOf('Дунавски тркачи')).toBe(addressOf('Dunavski trkači'))
    expect(addressOf('Вардарски круг')).toBe('vardarski-krug')
  })

  it('is nothing at all where the name holds nothing an address can carry', () => {
    expect(addressOf('!!!')).toBe('')
    expect(addressOf('Δρομείς')).toBe('')
  })
})

describe('what is wrong with a name', () => {
  it('is nothing, where it makes an address nobody holds', () => {
    expect(nameFault('Trkači Morave', [])).toBeNull()
    expect(nameError('Trkači Morave', [])).toEqual({})
  })

  it('is that it makes no address, where it makes none', () => {
    /* Left alone, the first such team answers at `/tim/` and every one after it
       is refused as taken though the two share nothing but the emptiness. */
    expect(nameFault('???', [])).toBe('noAddress')
    expect(nameError('???', [])).toEqual({ name: { key: 'teams.proposeNoAddress' } })
  })

  it('is that the address is taken, where it is', () => {
    expect(nameFault('Trkači Morave', ['trkaci-morave'])).toBe('taken')
    expect(nameError('Trkači Morave', ['trkaci-morave'])).toEqual({
      name: { key: 'teams.proposeTaken' },
    })
  })

  it('is the emptiness before the collision, since an empty address is nobody else', () => {
    expect(nameFault('???', [''])).toBe('noAddress')
  })
})

describe('what a team would be made of', () => {
  it('is what arrived, where nobody has touched it', () => {
    expect(teamFrom(item(), {})).toEqual(whole)
  })

  it('is what the moderator left, where they have', () => {
    expect(
      teamFrom(item(), { 'prop-1': { name: 'Trkači Zapadne Morave', city: 'Kraljevo' } }),
    ).toEqual({ name: 'Trkači Zapadne Morave', city: 'Kraljevo', country: 'RS' })
  })
})

describe('who the league counts as running a team', () => {
  /* The third of the three doors that ask „does this member have a team", and the one a
     member never sees: it is what refuses a second proposal in the queue. All three read
     `teamOf` since 05.09.2026, and this one had no case of its own — put back on its own
     comparison, the whole gate stayed green (review, 05.09.2026).

     **The empty string is the whole of it.** Taking somebody out of a team is written as
     an empty string over `teamId`, because the session keeps values as text and cannot
     hold a `null`. Counted as a team, the founder of a team they had just deleted would
     have their next proposal refused with `verification.teamMemberHasTeam`, which is
     exactly what the owner allowed on 05.09.2026: „ne brani mu se da napravi novi tim." */
  it('does not count somebody whose team was written away as an empty string', () => {
    const gone: Competitor[] = [{ ...first(MEMBERS), teamId: '' }]

    expect(organisers(gone, [])).toEqual([])
    /* And the same for nothing written at all, which is what a member who has never been
       in a team carries. */
    const never: Competitor[] = [{ ...first(MEMBERS), teamId: null }]

    expect(organisers(never, [])).toEqual([])
  })

  it('counts somebody who really is in a team, and whoever a team names as its organiser', () => {
    /* The other direction, so the reading above cannot be satisfied by answering nothing
       to everything. */
    expect(organisers(MEMBERS, [])).toEqual(['000001'])
    expect(organisers([], TEAMS)).toEqual(['000001'])
  })
})

describe('why a proposal cannot be taken', () => {
  it('is nothing, where it can', () => {
    expect(refusal(whole, [], item(), [], TEAMS, MEMBERS)).toBeNull()
  })

  it('is the missing field, where one is empty', () => {
    for (const gap of [{ name: '' }, { city: '' }, { country: '' }, { city: '   ' }]) {
      expect(refusal({ ...whole, ...gap }, [], item(), [], TEAMS, MEMBERS)).toBe('verification.teamIncomplete')
    }
  })

  it('is the address, where a team already answers at it', () => {
    expect(refusal(whole, [addressOf('trkaci morave')], item(), [], TEAMS, MEMBERS)).toBe('verification.teamTaken')
  })

  it('is the address again, where the name makes none', () => {
    expect(refusal({ ...whole, name: '???' }, [], item(), [], TEAMS, MEMBERS)).toBe('verification.teamNoAddress')
  })

  it("is the member's own team, where the one who sent it already has one", () => {
    /* A member is in one team at a time (PDL P13), and approving makes whoever sent
       the proposal the organiser of the team it makes. Two proposals from one member
       waiting together are the case this exists for: the first approval puts them on
       this list and the second is refused by it (review, 05.09.2026). */
    expect(refusal(whole, [], item(), ['000007'], TEAMS, MEMBERS)).toBe('verification.teamMemberHasTeam')
    expect(refusal(whole, [], item(), ['000009'], TEAMS, MEMBERS)).toBeNull()

    /* And not of a change: that is sent by the team's own administrator, who has a
       team by definition — the one being changed. Read over a change, this rule
       refuses every change there will ever be. */
    expect(
      refusal(
        whole,
        [],
        /* Sent by the member who administers that team, which is who a change comes
           from; sent by anybody else it is refused for that reason instead. */
        item({ kind: 'teamEdit', subjectId: 'team-dunav', memberNumber: '000001' }),
        ['000001'],
        TEAMS,
        MEMBERS,
      ),
    ).toBeNull()
  })

  it('is the seat, where the one who sent a change no longer administers that team', () => {
    /* A change is the administrator's act (PDL, 04.09.2026), and the seat can be
       handed to somebody else while the change waits. Taken then, the portal writes
       into a team on the word of a member who no longer runs it, and tells them it was
       done. Read at the moment of the decision, because that is when the writing
       happens. */
    expect(
      refusal(
        whole,
        [],
        item({ kind: 'teamEdit', subjectId: 'team-dunav', memberNumber: '000007' }),
        [],
        TEAMS,
        MEMBERS,
      ),
    ).toBe('verification.teamNotYours')
  })

  it('is the team itself, where a change names one that has been deleted', () => {
    /* A change is filed under the team it is about, and that team can be gone by the
       time anybody decides. Approved anyway it wrote into an identity nothing answers
       to, settled the item, and told the member their team had been changed (review,
       05.09.2026). A proposal names no team, so this cannot touch one. */
    expect(refusal(whole, [], item({ kind: 'teamEdit', subjectId: 'team-nema' }), [], TEAMS, MEMBERS)).toBe(
      'verification.teamGone',
    )
    expect(refusal(whole, [], item(), [], TEAMS, MEMBERS)).toBeNull()
  })

  it('is the missing member, where nobody sent it', () => {
    /* An empty member number means the whole league as far as the inbox is
       concerned, so approving would announce somebody's team to everybody and
       leave the team without an organiser. Not reachable from the screen today,
       and guarded because the shape of the data allows it: the way back on the
       same card is guarded for the same reason. */
    expect(refusal(whole, [], item({ memberNumber: '' }), [], TEAMS, MEMBERS)).toBe('verification.teamNoMember')
  })

  it('answers the emptiness before the collision, because that is the one to fix first', () => {
    expect(refusal({ ...whole, name: '' }, [''], item(), [], TEAMS, MEMBERS)).toBe('verification.teamIncomplete')
  })
})
