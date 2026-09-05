import {
  DATE_SHAPE_OPTIONS,
  formatDate,
  formatDayInSentence,
  formatDistance,
  formatDuration,
  formatElevation,
  formatLimit,
  formatMonth,
  formatNumber,
  formatPoints,
  formatDayMonth,
  formatShortDate,
  wholePeriod,
} from './format'
import { DEFAULT_LOCALE } from './config'
import { intlTag } from './intlTag'

/**
 * A race is run on the fourteenth, not at an instant. The days arrive as
 * „2019-01-05", which the browser reads as midnight UTC, and a formatter left on
 * the reader's own zone writes whatever day that instant fell on there: west of
 * Greenwich, the day before, every time and not on an edge.
 *
 * Measured by a review on 29.08.2026 in Chrome with the zone forced to
 * `America/New_York`: the league grid wrote „2018." over races of 2019, all
 * fourteen columns of one competition, while the same element's title said „4. 1.
 * 2019." over a race run on the fifth.
 *
 * **Two cases, and the first of them is the one that measures anything.** This
 * used to be asked of `DATE_SHAPE_OPTIONS` alone, on the reasoning that the output
 * cannot answer it on a machine already in UTC. The reasoning was sound and the
 * guard was not: it read the table of options rather than the formatter built out
 * of it, so the production path could walk around the table it was checked
 * against. A review measured exactly that on 29.08.2026: `dateFormat` written as
 * `new Intl.DateTimeFormat(tag, { ...DATE_SHAPES[shape], timeZone: undefined })`
 * left 2297 tests green while Chrome in `America/New_York` headed a race of
 * 2019-01-05 „Mrazijada 2018. (6,4 km)".
 *
 * So the zone is moved instead, and the four writers are asked what they write
 * from there.
 */
describe('what a date is on this portal', () => {
  const ZONE = 'America/New_York'
  /** What `TZ` said before any of this, so the variable is left as it was found. */
  const SET = process.env.TZ
  /** And the zone the machine is actually in, which is not the same question: on a
   *  machine that never set `TZ` the variable is empty and the zone is still
   *  something. Naming it is what makes the zone restorable at all. */
  const HERE = SET ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  afterEach(() => {
    /* Assigned rather than deleted, because only an assignment resets the zone Node
       has cached: measured on 29.08.2026, `delete process.env.TZ` left the process in
       `America/New_York` and eight cases further down this file then read July as
       June. The variable is put back to nothing afterwards, which is safe for the
       same reason: deleting it changes nothing. */
    process.env.TZ = HERE

    if (SET === undefined) {
      delete process.env.TZ
    }
  })

  it('is a calendar day, so a reader west of Greenwich is told the same one', async () => {
    process.env.TZ = ZONE
    /* That the zone really moved, measured and not assumed. Node resets its cached
       zone when `TZ` is assigned, but a machine where it does not would let every
       expectation below pass without measuring anything, and a guard that cannot
       fail is worse than none. Asked of the calendar rather than of a formatted
       string, so it answers the question and not the day ICU happens to zero-pad:
       midnight UTC on the fifth is the evening of the fourth in New York. */
    expect(
      new Date('2019-01-05').getDate(),
      'the zone did not move on this machine, so this case measures nothing',
    ).toBe(4)

    /* A fresh copy of the module, because the formatters are built once and kept
       (`format.ts`), and one built before the zone moved would answer for the zone
       it was built in. */
    vi.resetModules()

    const format = await import('./format')

    /* All four shapes, each on a day where the reader's zone would change the
       answer: the fifth becomes the fourth, and the first of January becomes the
       thirty first of December, which moves the month and the year with it. */
    expect(format.formatShortDate('2019-01-05', 'sr'), 'the short date').toBe('5. 1. 2019.')
    expect(format.formatDate('2019-01-05', 'sr'), 'the long date').toBe('5. januar 2019.')
    expect(format.formatMonth('2019-01', 'sr'), 'the month').toBe('januar 2019.')
    expect(format.formatYear('2019-01-01', 'sr'), 'the year').toBe('2019.')
  })

  it('has four shapes, so a fifth cannot be added past the case above', () => {
    /* What the case above cannot say: it names the four writers there are, so a
       fifth shape added tomorrow would be measured by nobody. This one fails the
       day the table grows, and whoever grows it has to give the new shape a case
       of its own. The option is read here as well, because a shape with no writer
       yet has nothing else to be read by. */
    const shapes = Object.entries(DATE_SHAPE_OPTIONS)

    expect(shapes.length, 'the portal no longer has four shapes of date').toBe(4)

    for (const [name, options] of shapes) {
      expect(options.timeZone, `the ${name} date reads in the browser's own zone`).toBe('UTC')
    }
  })
})

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
describe('a day inside a sentence', () => {
  /* All twelve, because the genitive is made by a rule over two endings rather than read
     off a list, and a rule has to be right about every month rather than about the one
     the portal happens to need. Four end in „bar" and become „bra"; the other eight take
     an „a". Written out here, so the day somebody rewrites the rule this says which
     answers it has to keep. */
  it('is the same day in the case a Serbian sentence takes', () => {
    const said = (month: string) => formatDayInSentence(`2026-${month}-01`, DEFAULT_LOCALE)

    expect(said('01')).toBe('1. januara 2026.')
    expect(said('02')).toBe('1. februara 2026.')
    expect(said('03')).toBe('1. marta 2026.')
    expect(said('04')).toBe('1. aprila 2026.')
    expect(said('05')).toBe('1. maja 2026.')
    expect(said('06')).toBe('1. juna 2026.')
    expect(said('07')).toBe('1. jula 2026.')
    expect(said('08')).toBe('1. avgusta 2026.')
    expect(said('09')).toBe('1. septembra 2026.')
    expect(said('10')).toBe('1. oktobra 2026.')
    expect(said('11')).toBe('1. novembra 2026.')
    expect(said('12')).toBe('1. decembra 2026.')
  })

  it('differs from the day standing on its own by the case of the month and nothing else', () => {
    /* The two are the same string but for the one word, which is what makes the rule
       safe to write over the formatted date: the day, the full stops and the year all
       come from the formatter both times, and only the month is touched. */
    expect(formatDate('2026-10-01', DEFAULT_LOCALE)).toBe('1. oktobar 2026.')
    expect(formatDayInSentence('2026-10-01', DEFAULT_LOCALE)).toBe('1. oktobra 2026.')
    /* And a two-digit day keeps its two digits, which a rule written over the wrong part
       of the string would lose. */
    expect(formatDayInSentence('2026-09-15', DEFAULT_LOCALE)).toBe('15. septembra 2026.')
  })
})

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

/* How long a timed race lasts, which is what its name is written with since the
   owner's word of 29.08.2026: „kad je trka vremenska, prikazuje se trajanje u
   zagradi. Npr. Šri Činmoj ultramaraton 2026. (24 h)".

   Asked here rather than through `raceLabel`, which reads it: the label has one
   case per kind and would carry one limit through, so the shape of every other
   limit would be unguarded. */
describe('a race limit written out', () => {
  it('writes whole hours as hours and nothing else', () => {
    /* His own example, and the one PDL wrote before it („(6 h)"). This is what a
       timed race almost always is, and it is the whole reason the empty parts are
       dropped: „24 h 00' 00''" in the name of a race is three parts of which two
       say nothing. */
    expect(formatLimit(86_400)).toBe('24 h')
    expect(formatLimit(21_600)).toBe('6 h')
  })

  it('keeps the minutes where there are any, on either side of the hours', () => {
    expect(formatLimit(23_400)).toBe("6 h 30'")
    expect(formatLimit(1_800)).toBe("30'")
  })

  it('counts one whole minute as a minute, on the edge itself', () => {
    /* The edge and not near it. „At least a minute" written as „more than a
       minute" loses exactly these two: an hour and one minute would read „1 h",
       and a limit of one minute would read „0 h", which is a length of time the
       race has not got. Neither is caught by a case a second either side. */
    expect(formatLimit(3_660)).toBe("1 h 01'")
    expect(formatLimit(60)).toBe("01'")
  })

  it('never drops a part between two that are kept', () => {
    /* An hour and thirty seconds. Dropping the empty minutes would leave „1 h
       30''", which anybody skimming reads as an hour and a half, so only the ends
       are dropped and never the middle. */
    expect(formatLimit(3_630)).toBe("1 h 00' 30''")
  })

  it('rounds nothing away, so no limit is written as a length of time it is not', () => {
    /* Ninety seconds is a minute and a half and says so. A limit written to the
       nearest minute would call this „2'". */
    expect(formatLimit(90)).toBe("01' 30''")
  })

  it('answers for a limit of nothing rather than writing an empty name', () => {
    /* No timed race has one, since a race that lasts no time is not a race. It is
       still answered, because a limit left empty in administration reaches this,
       and „0 h" says the limit is missing where „" would make the race read as a
       free one, which is the kind that carries no brackets. */
    expect(formatLimit(0)).toBe('0 h')
  })
})
