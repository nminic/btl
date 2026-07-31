import {
  formatDate,
  formatDistance,
  formatDuration,
  formatElevation,
  formatMonth,
  formatNumber,
  formatPoints,
  formatDayMonth,
  formatShortDate,
  wholePeriod,
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

/* The rule the owner gave on 30.07.2026 (PDL P28a, "Ispis vremenskog opsega").
 * A range that describes a whole period is written as that period, and only what
 * describes none is read out from one end to the other. */
describe('formatDayMonth', () => {
  /* The shape the owner asked for by name for the narrow column on the front
     page: day, month, full stop, and no year at any time of year. */
  it('writes the day and the month and nothing else', () => {
    expect(formatDayMonth('2027-01-16')).toBe('16.01.')
    expect(formatDayMonth('2026-12-05')).toBe('05.12.')
  })
})

describe('wholePeriod', () => {
  it('writes one day as that day', () => {
    expect(wholePeriod('2027-10-15', '2027-10-15', 'sr')).toBe('15. 10. 2027.')
  })

  it('writes the first to the last of a month as the month', () => {
    expect(wholePeriod('2027-07-01', '2027-07-31', 'sr')).toBe('jul 2027.')
    // Thirty days in one, twenty-eight in another, twenty-nine in a leap year,
    // and the rule is the same because the last day is counted, not assumed.
    expect(wholePeriod('2027-06-01', '2027-06-30', 'sr')).toBe('jun 2027.')
    expect(wholePeriod('2027-02-01', '2027-02-28', 'sr')).toBe('februar 2027.')
    expect(wholePeriod('2028-02-01', '2028-02-29', 'sr')).toBe('februar 2028.')
  })

  it('writes the first of January to the last of December as the year', () => {
    expect(wholePeriod('2027-01-01', '2027-12-31', 'sr')).toBe('2027.')
  })

  it('tries one day first, so the first to the first is a day and not a month', () => {
    /* The order is the rule rather than an implementation detail. Read as an
       attempt at a month, the first to the first of February would come back as
       "februar 2027", which is twenty-eight days instead of one. */
    expect(wholePeriod('2027-02-01', '2027-02-01', 'sr')).toBe('1. 2. 2027.')
  })

  it('gives back nothing for a range that describes no period', () => {
    // A month one day short of itself, and a stretch across two months.
    expect(wholePeriod('2027-07-01', '2027-07-30', 'sr')).toBeNull()
    expect(wholePeriod('2027-07-02', '2027-07-31', 'sr')).toBeNull()
    expect(wholePeriod('2027-01-01', '2027-11-30', 'sr')).toBeNull()
    expect(wholePeriod('2027-01-01', '2028-12-31', 'sr')).toBeNull()
  })

  it('follows the language, and never falls back to Cyrillic', () => {
    /* Intl reads a plain "sr" as Serbian in Cyrillic, which has been a fault on
       this portal once already, so every month and every year goes through
       intlTag (ADL A7). */
    expect(wholePeriod('2027-07-01', '2027-07-31', 'sr')).not.toMatch(/[Ѐ-ӿ]/)
    expect(wholePeriod('2027-07-01', '2027-07-31', 'en')).toBe('July 2027')
    // A year is a date rather than a number: Serbian writes the full stop.
    expect(wholePeriod('2027-01-01', '2027-12-31', 'en')).toBe('2027')
  })
})
