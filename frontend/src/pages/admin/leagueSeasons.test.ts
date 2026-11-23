import { describe, expect, it } from 'vitest'
import { seasonChoices, seasonsALeagueMayBeMadeFor } from './leagueSeasons'

/**
 * THE SEASONS A COMPETITION MAY BE MADE FOR (owner, 23.11.2026, PDL „Tri brze izmene administracije": „Zato
 * 23.11.2026 izbor nudi samo 2027, a od 1.1.2027. nudi 2027 i 2028, i dalje se pomera sam svake godine.").
 *
 * <p><b>The axes:</b> a year below the first season and one past it; the last day of 2026 and the first of
 * 2027, which is where the pair widens; a later year, where it keeps moving; and a competition whose own season
 * is among the choices, is not, or is not there at all (a new one).
 */
describe('the seasons a competition may be made for', () => {
  it.each([
    ['2026-09-30', [2027]],
    ['2026-11-23', [2027]],
    ['2026-12-31', [2027]],
    ['2027-01-01', [2027, 2028]],
    ['2027-11-22', [2027, 2028]],
    ['2031-06-15', [2031, 2032]],
  ])('on %s are %j', (today, seasons) => {
    expect(seasonsALeagueMayBeMadeFor(today)).toEqual(seasons)
  })
})

describe('the choices of the box', () => {
  it('are the seasons a new competition may be made for, each its own number', () => {
    expect(seasonChoices('2027-11-22', '')).toEqual([
      { value: '2027', labelKey: '2027' },
      { value: '2028', labelKey: '2028' },
    ])
  })

  it('carry the competition’s own season once where it is among them', () => {
    expect(seasonChoices('2027-11-22', '2028').map((one) => one.value)).toEqual(['2027', '2028'])
  })

  it('carry the competition’s own season, in its order, where it is not among them', () => {
    expect(seasonChoices('2027-11-22', '2019').map((one) => one.value)).toEqual(['2019', '2027', '2028'])
    expect(seasonChoices('2026-11-23', '2030').map((one) => one.value)).toEqual(['2027', '2030'])
  })
})
