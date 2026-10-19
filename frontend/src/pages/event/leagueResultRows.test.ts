import { describe, expect, it } from 'vitest'
import {
  bodyOf,
  figuresAskedOn,
  newLeagueRow,
  rowOf,
  runnersToOffer,
  theOnlyRow,
  whatIsWrongWith,
  type LeagueRow,
} from './leagueResultRows'

/** A row with a member chosen and the boxes given, every other box empty. */
function filled(boxes: Partial<LeagueRow>): LeagueRow {
  return { ...newLeagueRow(), memberNumber: '000002', typed: 'Relja Momčilović (000002)', ...boxes }
}

describe('the boxes a row asks for', () => {
  it('are the owner’s sentence for each kind of race', () => {
    expect(figuresAskedOn('length')).toEqual(['hours', 'minutes', 'seconds'])
    expect(figuresAskedOn('time')).toEqual(['distanceKm', 'ascentM', 'descentM'])
    expect(figuresAskedOn('free')).toEqual(['distanceKm', 'ascentM', 'descentM', 'hours', 'minutes', 'seconds'])
  })
})

describe('what is wrong with a row before it is sent', () => {
  it('is the member first: a name typed and not chosen is nobody', () => {
    expect(whatIsWrongWith({ ...filled({ hours: '3' }), memberNumber: '' }, 'length')).toBe('chooseMember')
  })

  it('takes the clock as one figure: an empty box is nought, and nought in all three is no run', () => {
    expect(whatIsWrongWith(filled({ hours: '3' }), 'length')).toBeUndefined()
    expect(whatIsWrongWith(filled({ seconds: '59' }), 'length')).toBeUndefined()
    expect(whatIsWrongWith(filled({}), 'length')).toBe('figuresMissing')
    expect(whatIsWrongWith(filled({ hours: '0', minutes: '0', seconds: '0' }), 'length')).toBe('figuresMissing')
    expect(whatIsWrongWith(filled({ hours: '3', minutes: 'pola' }), 'length')).toBe('figuresMissing')
  })

  it('takes each box of the course as a figure of its own, and asks for all three', () => {
    expect(whatIsWrongWith(filled({ distanceKm: '61,25', ascentM: '0', descentM: '12' }), 'time')).toBeUndefined()
    expect(whatIsWrongWith(filled({ distanceKm: '61,25', ascentM: '0' }), 'time')).toBe('figuresMissing')
    expect(whatIsWrongWith(filled({ ascentM: '0', descentM: '12' }), 'time')).toBe('figuresMissing')
  })

  it('asks a free race for the course and for a time', () => {
    expect(whatIsWrongWith(filled({ distanceKm: '12', ascentM: '300', descentM: '250', hours: '1' }), 'free')).toBeUndefined()
    expect(whatIsWrongWith(filled({ distanceKm: '12', ascentM: '300', descentM: '250' }), 'free')).toBe('figuresMissing')
    expect(whatIsWrongWith(filled({ hours: '1' }), 'free')).toBe('figuresMissing')
  })
})

describe('what a row sends', () => {
  it('sends the figures its race asks for and nothing for the rest, whatever stands in the boxes', () => {
    const typed = filled({ distanceKm: '50', ascentM: '9', descentM: '9', hours: '1', minutes: '2', seconds: '3' })

    expect(bodyOf(typed, 'length')).toEqual({
      memberNumber: '000002',
      distanceKm: null,
      ascentM: null,
      descentM: null,
      seconds: 3723,
    })
    expect(bodyOf(typed, 'time')).toEqual({
      memberNumber: '000002',
      distanceKm: 50,
      ascentM: 9,
      descentM: 9,
      seconds: null,
    })
    expect(bodyOf(typed, 'free')).toEqual({ memberNumber: '000002', distanceKm: 50, ascentM: 9, descentM: 9, seconds: 3723 })
  })

  it('hands the pencil its one row, and an empty one where there is none', () => {
    const one = filled({ hours: '2' })

    expect(theOnlyRow([one, filled({ hours: '9' })])).toBe(one)
    expect(theOnlyRow([])).toEqual(newLeagueRow())
  })

  it('puts a counted result back into the boxes the pencil opens with', () => {
    expect(rowOf({ distanceKm: 21.1, ascentM: 40, descentM: 35, seconds: 5405 }, '000002', 'Relja')).toEqual({
      memberNumber: '000002',
      typed: 'Relja',
      distanceKm: '21.1',
      ascentM: '40',
      descentM: '35',
      hours: '1',
      minutes: '30',
      seconds: '5',
    })
  })
})

describe('the list of members', () => {
  it('reads every member by his two names and his number, which is what it is searched by', () => {
    expect(runnersToOffer([{ memberNumber: '000032', firstName: 'Vojislav', lastName: 'Antonijević' }])).toEqual([
      {
        id: '000032',
        value: 'Vojislav Antonijević (000032)',
        said: 'Vojislav Antonijević (000032)',
        fills: {},
      },
    ])
  })
})
