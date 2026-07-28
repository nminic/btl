import {
  formatDate,
  formatDistance,
  formatDuration,
  formatElevation,
  formatMonth,
  formatNumber,
  formatPoints,
  formatShortDate,
} from './format'
import { intlTag } from './intlTag'

describe('format', () => {
  it('formats numbers in the Serbian locale', () => {
    expect(formatNumber(1234, 'sr')).toBe('1.234')
  })

  it('shows BTL points with two decimals', () => {
    expect(formatPoints(42.2, 'sr')).toBe('42,20')
  })

  it('formats distance and elevation with their units', () => {
    expect(formatDistance(21.1, 'sr')).toBe('21,1 km')
    expect(formatElevation(1180, 'sr')).toBe('1.180 m')
  })

  it('hides the hour for a race shorter than an hour', () => {
    expect(formatDuration(1598)).toBe('26:38')
  })

  it('shows the hour for a long race', () => {
    expect(formatDuration(49702)).toBe('13:48:22')
    expect(formatDuration(3600)).toBe('1:00:00')
  })

  it('never returns a negative time', () => {
    expect(formatDuration(-5)).toBe('00:00')
  })

  it('rounds fractional seconds', () => {
    expect(formatDuration(59.6)).toBe('01:00')
  })

  it('formats dates', () => {
    expect(formatShortDate('2027-04-10', 'sr')).toContain('2027')
    expect(formatDate('2027-04-10', 'en')).toContain('April')
  })

  it('never writes a Serbian date in Cyrillic', () => {
    const written = formatDate('2027-04-10', 'sr')

    expect(written).toBe('10. april 2027.')
    expect(written).not.toMatch(/[Ѐ-ӿ]/)
  })

  it('names a month for the calendar heading', () => {
    expect(formatMonth('2027-05', 'sr')).toBe('maj 2027.')
  })

  it('leaves an unknown locale to Intl', () => {
    expect(intlTag('en')).toBe('en')
    expect(intlTag('sr')).toBe('sr-Latn')
    expect(intlTag('de')).toBe('de')
  })
})
