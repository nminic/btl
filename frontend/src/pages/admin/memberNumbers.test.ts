
import type { Decision } from '../../session/context'
import { first } from '../../test/at'
import {
  handOutMemberNumber,
  handOutMemberNumbersFor,
  takenMemberNumbers,
  type NumberSources,
  type Numbered,
} from './memberNumbers'

/* The three sources, named once here as well, because the fault this module was
 * written for was one caller knowing about two of them and the other about three.
 * A source that quietly stops being read is a member number handed out twice. */

const NOTHING: NumberSources = { edits: {}, creations: {}, decisions: {}, deletions: {} }

const member = (memberNumber: string): Numbered => ({ memberNumber })

const activation = (memberNumber: string): Decision => ({
  status: 'approved',
  note: '',
  basis: 'payment',
  memberNumber,
})

describe('takenMemberNumbers', () => {
  it('reads the member list', () => {
    expect(takenMemberNumbers([member('000001'), member('000002')], NOTHING)).toEqual([
      '000001',
      '000002',
    ])
  })

  it('reads the members entered during this visit', () => {
    /* A record created a moment ago holds its number already, even though nothing
       has been written down anywhere yet. */
    const creations = {
      members: [{ id: '000005', values: { firstName: 'Milica', lastName: 'Pavlović' } }],
    }

    expect(takenMemberNumbers([member('000001')], { ...NOTHING, creations })).toContain('000005')
  })

  it('reads the numbers the activations of this visit handed out', () => {
    /* Activation writes a decision and not a member, so without this the member
       form cannot see a number the payments queue has just given away. */
    const decisions = { 'ver-upl-1': activation('000032') }

    expect(takenMemberNumbers([member('000001')], { ...NOTHING, decisions })).toContain('000032')
  })

  it('leaves out a decision that handed nothing out', () => {
    /* A refusal keeps the registration waiting for a fee, and the other seven
       queues have no numbers at all. A number nobody holds must not be skipped. */
    const decisions: Record<string, Decision> = {
      refused: { status: 'rejected', note: 'Nema uplate.', basis: '', memberNumber: '' },
      approvedBio: { status: 'approved', note: '', basis: '', memberNumber: '' },
    }

    expect(takenMemberNumbers([member('000001')], { ...NOTHING, decisions })).toEqual(['000001'])
  })
})

describe('handOutMemberNumber', () => {
  it('gives the first number no source is holding', () => {
    expect(handOutMemberNumber([], NOTHING)).toBe('000001')
    expect(handOutMemberNumber([member('000001')], NOTHING)).toBe('000002')

    // The whole of the fault in one line: 000002 is gone because an activation
    // gave it away, so the next member gets 000003 rather than 000002 again.
    expect(
      handOutMemberNumber([member('000001')], {
        ...NOTHING,
        decisions: { 'ver-upl-1': activation('000002') },
      }),
    ).toBe('000003')
  })
})

/* A number is never handed out twice (PDL P8, owner 31.07.2026). Deleting a
 * member takes them off every screen, and it used to take their number back into
 * circulation with them, because the list this reads is the list the screen
 * shows and a deleted member is not on it. */
describe('a member number that has been handed out', () => {
  it('stays spent after the member holding it is deleted', () => {
    const members = [member('000001'), member('000002'), member('000003')]
    const sources = { ...NOTHING, deletions: { members: ['000003'] } }

    expect(takenMemberNumbers(members, sources)).toContain('000003')
    expect(handOutMemberNumber(members, sources)).toBe('000004')
  })

  it('stays spent even when it is the only member there ever was', () => {
    const sources = { ...NOTHING, deletions: { members: ['000001'] } }

    expect(handOutMemberNumber([member('000001')], sources)).toBe('000002')
  })
})

describe('numbers handed out several at a time', () => {
  /* The whole reason the function exists: what is spoken for is read off the
     session as the caller's render sees it, and the session does not change
     while a loop runs, so a loop around the singular hands out one number as
     many times as it runs. */
  it('gives each one a number of its own, counting up from the highest gone', () => {
    const given = handOutMemberNumbersFor(
      [member('000004'), member('000009')],
      NOTHING,
      ['a', 'b', 'c'],
    )

    /* Each answer beside the thing it was asked about, so the screen does not
       have to pair them back up by their place in two lists. */
    expect(given).toEqual([
      { item: 'a', memberNumber: '000010' },
      { item: 'b', memberNumber: '000011' },
      { item: 'c', memberNumber: '000012' },
    ])
  })

  it('asks for none and gets none, without touching anything', () => {
    expect(handOutMemberNumbersFor([member('000004')], NOTHING, [])).toEqual([])
  })

  it('agrees with the singular on the first one it hands out', () => {
    const listed = [member('000004'), member('000009')]

    expect(first(handOutMemberNumbersFor(listed, NOTHING, ['a'])).memberNumber).toBe(
      handOutMemberNumber(listed, NOTHING),
    )
  })
})
