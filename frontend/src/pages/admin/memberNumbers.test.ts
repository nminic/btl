import type { Competitor } from '../../data/types'
import type { Decision } from '../../session/context'
import { handOutMemberNumber, takenMemberNumbers, type NumberSources } from './memberNumbers'

/* The three sources, named once here as well, because the fault this module was
 * written for was one caller knowing about two of them and the other about three.
 * A source that quietly stops being read is a member number handed out twice. */

const NOTHING: NumberSources = { edits: {}, creations: {}, decisions: {} }

const member = (memberNumber: string) => ({ memberNumber }) as Competitor

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
