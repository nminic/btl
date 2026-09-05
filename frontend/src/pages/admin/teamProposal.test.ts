import type { PendingItem } from '../../data/types'
import { NO_RATING } from '../../data/types'
import { addressOf, nameError, nameFault, refusal, teamFrom, type Proposed } from './teamProposal'

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

describe('why a proposal cannot be taken', () => {
  it('is nothing, where it can', () => {
    expect(refusal(whole, [], item(), [])).toBeNull()
  })

  it('is the missing field, where one is empty', () => {
    for (const gap of [{ name: '' }, { city: '' }, { country: '' }, { city: '   ' }]) {
      expect(refusal({ ...whole, ...gap }, [], item(), [])).toBe('verification.teamIncomplete')
    }
  })

  it('is the address, where a team already answers at it', () => {
    expect(refusal(whole, [addressOf('trkaci morave')], item(), [])).toBe('verification.teamTaken')
  })

  it('is the address again, where the name makes none', () => {
    expect(refusal({ ...whole, name: '???' }, [], item(), [])).toBe('verification.teamNoAddress')
  })

  it("is the member's own team, where the one who sent it already has one", () => {
    /* A member is in one team at a time (PDL P13), and approving makes whoever sent
       the proposal the organiser of the team it makes. Two proposals from one member
       waiting together are the case this exists for: the first approval puts them on
       this list and the second is refused by it (review, 05.09.2026). */
    expect(refusal(whole, [], item(), ['000007'])).toBe('verification.teamMemberHasTeam')
    expect(refusal(whole, [], item(), ['000009'])).toBeNull()
  })

  it('is the missing member, where nobody sent it', () => {
    /* An empty member number means the whole league as far as the inbox is
       concerned, so approving would announce somebody's team to everybody and
       leave the team without an organiser. Not reachable from the screen today,
       and guarded because the shape of the data allows it: the way back on the
       same card is guarded for the same reason. */
    expect(refusal(whole, [], item({ memberNumber: '' }), [])).toBe('verification.teamNoMember')
  })

  it('answers the emptiness before the collision, because that is the one to fix first', () => {
    expect(refusal({ ...whole, name: '' }, [''], item(), [])).toBe('verification.teamIncomplete')
  })
})
