import type { PendingItem } from '../../data/types'
import { addressOf, refusal, teamFrom, type Proposed } from './teamProposal'

/* Turning a proposal into a team, as decisions rather than as a screen. One of
 * them has a case the screen cannot reach, which is why they are out here.
 */

const item = (over: Partial<PendingItem> = {}): PendingItem => ({
  id: 'prop-1',
  queue: 'teams',
  date: '2027-01-10',
  memberNumber: '000007',
  who: 'Strahinja Vukićević',
  subject: 'Trkači Morave',
  body: '',
  currentDate: '',
  proposedDate: '',
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
    expect(refusal(whole, [], item())).toBeNull()
  })

  it('is the missing field, where one is empty', () => {
    for (const gap of [{ name: '' }, { city: '' }, { country: '' }, { city: '   ' }]) {
      expect(refusal({ ...whole, ...gap }, [], item())).toBe('verification.teamIncomplete')
    }
  })

  it('is the address, where a team already answers at it', () => {
    expect(refusal(whole, [addressOf('trkaci morave')], item())).toBe('verification.teamTaken')
  })

  it('is the missing member, where nobody sent it', () => {
    /* An empty member number means the whole league as far as the inbox is
       concerned, so approving would announce somebody's team to everybody and
       leave the team without an organiser. Not reachable from the screen today,
       and guarded because the shape of the data allows it: the way back on the
       same card is guarded for the same reason. */
    expect(refusal(whole, [], item({ memberNumber: '' }))).toBe('verification.teamNoMember')
  })

  it('answers the emptiness before the collision, because that is the one to fix first', () => {
    expect(refusal({ ...whole, name: '' }, [''], item())).toBe('verification.teamIncomplete')
  })
})
