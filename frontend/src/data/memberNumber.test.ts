import { formatMemberNumber, MEMBER_NUMBER_WIDTH, nextMemberNumber } from './memberNumber'

describe('formatMemberNumber', () => {
  it('writes six digits, whatever the number', () => {
    expect(formatMemberNumber(1)).toBe('000001')
    expect(formatMemberNumber(127)).toBe('000127')
    expect(formatMemberNumber(999999)).toBe('999999')
    expect(MEMBER_NUMBER_WIDTH).toBe(6)
  })
})

describe('nextMemberNumber', () => {
  it('starts the numbering at the first number there is', () => {
    // The numbering starts from scratch on the new portal (PDL P8).
    expect(nextMemberNumber([])).toBe('000001')
  })

  it('hands out the first free number, in order', () => {
    expect(nextMemberNumber(['000001', '000002'])).toBe('000003')
  })

  it('carries on past the highest rather than filling a hole', () => {
    /* A number is never handed out twice (owner, 31.07.2026). Deleting a member
       on request takes the link between the number and the person away (PDL
       P23); it used to take the number back into circulation with it, so the
       next person to join inherited a number that appears in old results, old
       tables and somebody's printed card. */
    expect(nextMemberNumber(['000001', '000003', '000004'])).toBe('000005')
    expect(nextMemberNumber(['000002', '000003'])).toBe('000004')
  })

  it('skips a number taken by a record entered during this visit', () => {
    /* The caller hands in the list the screen is showing, not the file it read, so
       whatever was entered a moment ago is already spoken for. Without it, two
       members entered one after the other both got 000032. */
    const inTheFile = Array.from({ length: 31 }, (_, index) => formatMemberNumber(index + 1))

    expect(nextMemberNumber(inTheFile)).toBe('000032')
    expect(nextMemberNumber([...inTheFile, '000032'])).toBe('000033')
  })

  it('says so rather than handing out a seventh digit', () => {
    /* With 999999 handed out it used to return '1000000', seven digits out of
       the function whose whole subject is that a member number has six, and on
       to a row key, a profile address and a printed card without a word. Six
       digits were chosen to outlive the league (PDL P8), so nobody is expected
       to reach this; running past it in silence is what must not happen. */
    expect(() => nextMemberNumber(['999999'])).toThrow(/999999/)

    // A hole below the highest changes nothing: the numbering only counts up.
    expect(nextMemberNumber(['999998'])).toBe('999999')
  })

  it('does not care what order it is given them in, or what else is in the list', () => {
    // What it wants is the highest one ever handed out, wherever it stands.
    expect(nextMemberNumber(['000004', '000001', '000002'])).toBe('000005')
    expect(nextMemberNumber(['000001', '000001', '000002'])).toBe('000003')
    // A registration waiting to be activated carries no number at all, and an
    // empty string is not a number that raises the highest.
    expect(nextMemberNumber(['', '000001'])).toBe('000002')
  })
})
