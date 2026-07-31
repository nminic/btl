import { ALL_SEASONS, seasonOptions } from './season'

/* The two rules the comments in season.ts claim and nothing was holding them to:
 * that a year is four digits and not merely digits, and that the running season
 * is on the list whether or not this person raced in it. Both survived being
 * removed, which is another way of saying neither was tested. */
describe('seasonOptions', () => {
  it('offers the running season even when this person has nothing in it', () => {
    /* The select opens on the running season by default, and a select cannot
       open on an option it does not have. Somebody who last raced in 2019 would
       otherwise land on a control showing a year that is not in its own list. */
    expect(seasonOptions([2019, 2018], '2027', '2027-04-01')).toEqual([2027, 2019, 2018])
  })

  it('offers a season a shared link named, so the link shows what it was sent to show', () => {
    expect(seasonOptions([2019], '2010', '2027-04-01')).toEqual([2027, 2019, 2010])
  })

  it('adds nothing for all of them at once', () => {
    expect(seasonOptions([2019], ALL_SEASONS, '2027-04-01')).toEqual([2027, 2019])
  })

  it('never offers the same year twice', () => {
    expect(seasonOptions([2027, 2019], '2027', '2027-04-01')).toEqual([2027, 2019])
  })
})
