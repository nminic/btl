import { describe, expect, it } from 'vitest'
import { WHOLE } from '../components/crop'
import type { Competitor, Team } from './types'
import { teamAdminOf } from './teamAdmin'

/* Who may change a team and who may delete it, asked of the records alone.
 *
 * The rule is the owner's, 04.09.2026: the founder, and when that seat is empty
 * whoever has been in the team longest, the smaller number breaking a tie. Asked
 * here rather than only through the screen that draws the two buttons, because
 * the same answer decides what a moderator sees on the queue and what a deletion
 * is allowed to take with it (ADL A31: a fact with one home gets a guard beside
 * that home).
 */

/* Written out whole rather than cast from a fragment: a cast would keep passing
   after a field is added to the record, and the whole question here is which fields
   the answer is read off. */
const team = (fields: Partial<Team> = {}): Team => ({
  id: 'team-dunav',
  slug: 'dunav',
  name: 'Dunav',
  city: 'Novi Sad',
  country: 'RS',
  organizerMemberNumber: '000001',
  bio: '',
  logo: null,
  crop: WHOLE,
  ...fields,
})

const member = (
  memberNumber: string,
  teamId: string | null,
  teamSince: number | null,
): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: 'Prezime',
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
  teamId,
  teamSince,
  bio: '',
})

describe('who administers a team', () => {
  it('is the member who founded it, while they are still in it', () => {
    expect(
      teamAdminOf(team(), [member('000001', 'team-dunav', 2019), member('000002', 'team-dunav', 2017)]),
    ).toBe('000001')
  })

  it('is the one who has been in it longest once the founder has left', () => {
    /* The founder is still named on the record — that is who founded it and it does
       not change — but they are in another team now, so the seat is empty and this
       says who is in it without anybody being asked. Measured with the founder still
       on the portal rather than gone from it, which is the state a moderator moving
       somebody actually leaves behind. */
    expect(
      teamAdminOf(team(), [
        member('000001', 'team-sava', 2019),
        member('000005', 'team-dunav', 2021),
        member('000002', 'team-dunav', 2017),
      ]),
    ).toBe('000002')
  })

  it('takes the smaller number where two arrived in the same year', () => {
    expect(
      teamAdminOf(team(), [member('000009', 'team-dunav', 2017), member('000004', 'team-dunav', 2017)]),
    ).toBe('000004')
  })

  it('puts a member with no year at all last, rather than first', () => {
    /* A team and a year travel together on a record (`teamSince`), so a member in a
       team with no year is a record that has lost something. Read as the earliest of
       all — which is what the arithmetic does on its own, since nought is smaller
       than any year — the team would be handed to whoever is most broken. */
    expect(
      teamAdminOf(team(), [member('000003', 'team-dunav', null), member('000008', 'team-dunav', 2024)]),
    ).toBe('000008')
  })

  it('says the same whichever order the roster arrives in', () => {
    /* The missing year is read on both sides of the comparison, and a sort hands the
       two members over in whichever order it likes. Written once, the case only ever
       exercised the side the engine happened to pass it on. */
    expect(
      teamAdminOf(team(), [member('000008', 'team-dunav', 2024), member('000003', 'team-dunav', null)]),
    ).toBe('000008')
  })

  it('answers nobody for a team that has nobody in it', () => {
    /* Which is a team whose members have all left, and the answer has to be a word
       the screen can act on rather than an exception: nobody sees the two buttons. */
    expect(teamAdminOf(team(), [member('000001', 'team-sava', 2019)])).toBeNull()
  })

  it('reads the team it was asked about and not another one', () => {
    /* The founder of Dunav standing in Sava's roster does not administer Sava, and
       the longest-serving member of Dunav does not either. */
    expect(
      teamAdminOf(team({ id: 'team-sava', organizerMemberNumber: '000001' }), [
        member('000001', 'team-dunav', 2015),
        member('000006', 'team-sava', 2022),
      ]),
    ).toBe('000006')
  })
})
