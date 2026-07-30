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

  it('fills a hole rather than carrying on past the highest', () => {
    /* Deleting a member on request removes the link between the number and the
       person, which frees the number (PDL P23). One past the highest would leave
       every freed number unused for good, and would eventually run out of six
       digits with most of them spent on nobody. */
    expect(nextMemberNumber(['000001', '000003', '000004'])).toBe('000002')
    expect(nextMemberNumber(['000002', '000003'])).toBe('000001')
  })

  it('skips a number taken by a record entered during this visit', () => {
    /* The caller hands in the list the screen is showing, not the file it read, so
       whatever was entered a moment ago is already spoken for. Without it, two
       members entered one after the other both got 000032. */
    const inTheFile = Array.from({ length: 31 }, (_, index) => formatMemberNumber(index + 1))

    expect(nextMemberNumber(inTheFile)).toBe('000032')
    expect(nextMemberNumber([...inTheFile, '000032'])).toBe('000033')
  })

  it('does not care what order it is given them in, or what else is in the list', () => {
    // It is a set of what is gone, not a sequence to be continued.
    expect(nextMemberNumber(['000004', '000001', '000002'])).toBe('000003')
    expect(nextMemberNumber(['000001', '000001', '000002'])).toBe('000003')
    // A registration waiting to be activated carries no number at all, and an
    // empty string is not a number that blocks anything.
    expect(nextMemberNumber(['', '000001'])).toBe('000002')
  })
})
