import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { RESOURCE_NAMES } from './client'
import { plainly, type Place } from './places'
import { bare, sources, WHOLE_PORTAL } from '../test/sources'

/* Two rules that say something the code cannot say for itself, and that have
 * each been broken once without anything noticing.
 */

const SRC = join(process.cwd(), 'src')

describe('the list of resources', () => {
  it('is the fourteen names the backend has to answer for', () => {
    /* ADL A7 calls this a contract: whoever adds a twelfth resource adds it to
       the contract on the same day. Nothing was holding it, so the list could
       have grown or shrunk in silence, and the sentence in the log that says it
       is closed would have gone on saying so.

       Ten until 07.08.2026, when comments a moderator has published became a
       record of their own (owner, 06.08.2026). They arrive through the queue and
       do not live in it: the queue holds what is waiting, and a screen reading a
       published comment out of it would have to decide all over again what
       counts as decided.

       Eleven until 10.08.2026, when the codebook of the world's towns arrived:
       the event form offers a town from the second letter typed, and the
       codebook is 1200 KB that no screen but that one asks for (owner,
       10.08.2026).

       Thirteen since 11.08.2026, when a member could say they are going to a
       race: who is going is written by members and read by members, and an
       event is written by administration, so it is not a list on the event. */
    expect([...RESOURCE_NAMES]).toEqual([
      'attendance',
      'ducats',
      'comments',
      'competitors',
      'events',
      'leagues',
      'moderators',
      'pages',
      'pairs',
      'places',
      'races',
      'results',
      'teams',
      'verification',
    ])
  })

  it('is matched by a file under public/mock for every one of them', () => {
    /* The other half: a name in the contract with no file behind it is a screen
       that fails on a request nobody can answer. */
    const served = readdirSync(join(process.cwd(), 'public', 'mock'))

    expect(RESOURCE_NAMES.filter((name) => !served.includes(`${name}.json`))).toEqual([])
  })
})

describe('the screens that draw a section of a written page', () => {
  /* Three of them: the rulebook, the written pages, and the card on the front
   * page that carries the address of the president. What a record shows is its
   * own sections and the ones it takes in, and that is `sectionsOf`; reading
   * `page.sections` instead draws one record two ways depending on which screen
   * is drawing it.
   *
   * It has been broken quietly once already: the front page went on reading
   * `page.sections` while the comment that said why it should not was deleted in
   * the same change. A comment is not a guard, so this is one. Read off the
   * source, the same shape as the guard on the clock (src/clock/oneClock.test.ts)
   * and the one on the writing of a filter (src/app/filterParams.test.ts).
   *
   * It has to be read off the source, because no screen test can ever catch it:
   * no record in `public/mock/pages.json` takes another one in today, so the two
   * ways of reading a record draw the same thing. The day one does, the screen
   * that reads it the wrong way draws less, and nothing says so.
   */
  /* The sweep every guard of this kind uses (`test/sources.ts`), and not a copy
     of it written here. The copy is what this is about: it read the whole of
     `src` including the helpers the tests are written with, and its floor was the
     number 80 typed in by hand. Measured on 23.08.2026: narrowing that copy to
     three folders left a violator in `components/` unseen while 80 still passed,
     so the guard reported „nothing is wrong" where it meant „nothing was looked
     at". The shared sweep carries its own floor, so the two move together. */
  const files = sources()

  /* The two files that reach for the field itself, each for a reason that is not
     drawing a page: one says what a page shows, the other lists the pages for the
     administrator and counts the sections of each. */
  const ALLOWED = [join('data', 'pages.ts'), join('pages', 'admin', 'AdminPages.tsx')]

  it('reads the whole application, and finds both files that are allowed it', () => {
    expect(files.length).toBeGreaterThan(WHOLE_PORTAL)
    expect(files.filter(({ path }) => ALLOWED.some((one) => path.endsWith(one)))).toHaveLength(2)
  })

  it('reaches a record through sectionsOf, never through its own sections', () => {
    /* The field itself, both ways it can be spelt: read off the record, and
       pulled out of it into a name of its own. The first version of this forbade
       `page.sections.map(` and held nothing, because the most ordinary rewrite
       there is walks straight past it; the second forbade `.sections` and was
       walked past by `const { sections } = page`.

       A name that merely reads `sections` is left alone: what comes back from
       `sectionsOf` is called that in the rulebook, and rightly. */
    const READ_OFF_THE_RECORD = /\.sections\b|\{[^}]*\bsections\b[^}]*\}\s*=/

    /* Comments blanked with the one blanker (`test/sources.ts`), which this file
       used to keep a copy of. The copy blanked from the first `//` to the end of
       the line, so an address blanked everything written after it: measured in
       `src/app/head.ts`, a violation on the same line as an address went unseen
       and the identical violation on the next line was found. */
    const straight = files.filter(
      ({ path, code }) =>
        !ALLOWED.some((one) => path.endsWith(one)) && READ_OFF_THE_RECORD.test(bare(code)),
    )

    expect(straight.map(({ path }) => path.slice(SRC.length + 1))).toEqual([])
  })
})

/**
 * One name for one thing, after the rename of 06.08.2026.
 *
 * The owner asked for the badges to become Dukati and, asked whether that
 * reached the code and the addresses too, answered that it did (PDL P11). A
 * rename of five hundred occurrences across forty-five files is exactly the kind
 * that half happens: one file keeps the old word, and the portal has two
 * names for one thing again with nothing saying so.
 *
 * Two things keep the old word on purpose and are named here, so that "no
 * exceptions" does not have to mean "no old address":
 *
 * The public page that no longer exists. It was folded into the rulebook on
 * 04.08.2026, and two tests say so by name; an address that stopped being
 * served has to go on being written down somewhere or nothing holds that it
 * stopped.
 *
 * And this file, whose own prose is about the rename.
 */
describe('what the ducats are called', () => {
  /**
   * The three files that keep the old word on purpose.
   *
   * Named one by one rather than caught by a pattern: a pattern would let the
   * next file that keeps the old word in past it. And the list is held to
   * exactly these three below, because a list nothing bounds is a line anybody
   * can add to silence a file.
   */
  const ALLOWED = ['app/navigation.test.tsx', 'app/routes.test.ts', 'data/contract.test.ts']

  it('is nowhere still the old word, in any language', () => {
    const said: string[] = []

    for (const { path, code } of everything()) {
      if (ALLOWED.includes(path)) {
        continue
      }

      /* Without regard to case, because the first pass asked for `[Bb]adge` and
         a constant written `BADGES` walked past it, as did every capitalised
         `Značke`: a guard that sees two of the three ways a word is written is
         one that lets the third through. */
      /* Without regard to case, because the first pass asked for `[Bb]adge` and
         a constant written `BADGES` walked past it, as did every capitalised
         `Značke`.

         And with the vowel between, because the genitive plural of the old word
         is `značaka`: the pattern asked for `k` straight after `č`, so the one
         inflected form the dictionary actually used was the one form it could
         not see. */
      for (const match of code.matchAll(/[A-Za-z]*badge[A-Za-z_]*|zna[čc]a?k[a-zčćšđž]*/gi)) {
        said.push(`${path}: ${match[0]}`)
      }
    }

    expect(said).toEqual([])
  })

  it('holds the list of exceptions to exactly those three', () => {
    /* Otherwise the list is a place to put whatever fails: adding a path to it
       and the old word to that file passed everything, which is a guard that
       can be switched off from inside. */
    expect(ALLOWED).toHaveLength(3)
    expect(ALLOWED.filter((one) => one !== 'data/contract.test.ts')).toEqual([
      'app/navigation.test.tsx',
      'app/routes.test.ts',
    ])
  })

  it('keeps the dead public address written down, which is what those two hold', () => {
    const holding = ['app/navigation.test.tsx', 'app/routes.test.ts']
    const kept = everything().filter((one) => holding.includes(one.path))

    expect(kept.map((one) => one.path).sort()).toEqual([...holding].sort())
    expect(kept.every((one) => one.code.includes('znacke'))).toBe(true)
  })

  it('reads the words a visitor sees, and not only the code', () => {
    /* The dictionary and the generated records were outside the sweep, and that
       is where the old word actually survived: a heading that said Dukati over a
       paragraph whose first word was Značka, and a ducat whose own name began
       with it. Neither is code, and both are on a public page. */
    const read = everything().map((one) => one.path)

    expect(read).toContain('i18n/sr.json')
    expect(read).toContain('mock/pages.json')
    expect(read).toContain('mock/ducats.json')
    /* And the stylesheets, which were the one kind nothing pinned: dropping
       '.css' from the list of what is read switched thirty-six files out of the
       sweep in silence. */
    expect(read).toContain('components/DucatArt.css')
    /* And the page the browser is handed, which carries words of its own. */
    expect(read).toContain('index.html')
    /* And not the codebook of towns, for the reason written where it is
       dropped. Held here so that dropping it stays a decision rather than
       something that quietly grows to cover whatever fails next. */
    expect(read).not.toContain('mock/places.json')
  })

  it('reads every file, so the sweep above is looking at something', () => {
    /* Read rather than written down. The number here happened to equal the floor
       every other sweep uses and was not taken from it, so the two could drift
       apart without a word. This sweep reads more than that one does, the words a
       visitor sees and the records the portal is generated from among them, so
       the shared floor is a floor for it too. */
    expect(everything().length).toBeGreaterThan(WHOLE_PORTAL)
    expect(everything().some((one) => one.path.endsWith('DucatGallery.tsx'))).toBe(true)
  })
})

/**
 * Every number the portal writes down about the codebook of towns, against the
 * codebook.
 *
 * **Why this exists.** A number measured once and written into a sentence goes
 * stale the next time the codebook is rebuilt, and it goes stale one home at a
 * time. Counted on 09.09.2026: the size of the codebook is written in six
 * sentences across the portal, three of them still said „nine hundred
 * kilobytes" over a file of 1247, and the review that found it had named two of
 * those three. The third turned up only by sweeping for the fact rather than
 * working through the list. The two counts of shared names and the count of
 * curly apostrophes had drifted the same way, in one home each.
 *
 * **What holds it.** Not a list of files: the facts below are read out of every
 * file the sweep opens, so a home written tomorrow is held the day it is
 * written. The expected side is derived from the shipped codebook every time
 * this runs, and the folding is `plainly` itself rather than a copy of it, so a
 * name is counted the way the portal counts it.
 *
 * **And what it does not hold, measured rather than assumed.** The „written down
 * somewhere" line is per fact and not per home. It fails when the last home of a
 * fact stops matching the pattern, and says nothing while any other home still
 * matches. Measured on 09.09.2026: the size of the codebook has six homes, and
 * one of them reworded out of the pattern altogether left the whole suite green.
 * Nothing here can close that. Naming which files ought to carry a fact is the
 * list this deliberately does not keep, and no derived question answers „was
 * this sentence here yesterday" over a working tree. So it is written down as a
 * boundary instead: a fact that every home drops is caught, a home that goes
 * quiet on its own is not.
 *
 * **Where it stops, said rather than left to be found.** Two more numbers about
 * the same codebook are not held here: how many towns there are, and how many
 * carry an English name. Neither is written exactly in anything this sweep
 * opens, which is `frontend/` and nothing else. How many towns there are appears
 * inside it only rounded, a claim about a property that stays true as the
 * codebook grows; how many carry an English name does not appear at all. Both
 * are written out exactly in `V3__place.sql` and in the template in
 * `backend/tools/generate_reference_migrations.py` it came out of. The migration
 * is the home that needs no guard, because Flyway remembers its checksum
 * (ADL A2) and `MigrationsAreImmutableTest` pins the number it computed: that
 * prose is a snapshot of the day it was written and must not be rewritten, so a
 * guard expecting it to keep up would be asking for the one thing that must not
 * happen. The template is a copy of that snapshot, and the generator refuses to
 * write a migration `main` already carries, so nothing it says about today's
 * codebook is ever read.
 *
 * **What this paragraph used to say, and what that cost.** It excused a third
 * number the same way, how many name-and-country pairs repeat, on the grounds
 * that its home was that migration. That number had four homes, and two of them
 * are edited as freely as any other line: `places.ts`, which this very sweep
 * opens, and `PlaceIdentityTest`. Measured on 09.09.2026, a wrong number written
 * into `places.ts` left the whole suite green, so the sentence excusing it was
 * telling the next reader not to look at the one home that had gone stale. It is
 * held below now, and `PlaceIdentityTest`, which this sweep cannot reach, says
 * that pairs repeat without saying how many.
 */
describe('what the portal writes down about the codebook of towns', () => {
  /** The shipped file, which `everything()` deliberately drops and which is the
   *  source of truth for every number below. */
  const CODEBOOK = join(process.cwd(), 'public', 'mock', 'places.json')

  const towns: Place[] = JSON.parse(readFileSync(CODEBOOK, 'utf-8'))

  /** Both names a town is written under, which is what the portal folds and
   *  searches: the local one always, the English one where the town has one. */
  const written = (town: Place) => (town[3] === undefined ? [town[1]] : [town[1], town[3]])

  /** How many names stand in more than one country, counted over whichever
   *  spelling of a town's names is handed in. */
  function inMoreThanOneCountry(spelling: (town: Place) => string[]): number {
    const countries = new Map<string, Set<string>>()

    for (const town of towns) {
      for (const name of spelling(town)) {
        const already = countries.get(name)

        if (already === undefined) {
          countries.set(name, new Set([town[2]]))
        } else {
          already.add(town[2])
        }
      }
    }

    return [...countries.values()].filter((held) => held.size > 1).length
  }

  /** How many name-and-country pairs more than one town carries, spelt the way
   *  the codebook spells them. This is the number that says a town's identity
   *  cannot be what it is called and where it is, which is why the mark exists
   *  (owner, 08.09.2026, ADL A16), so it is asked of the codebook rather than
   *  remembered. */
  function pairsMoreThanOneTownCarries(): number {
    const carried = new Map<string, number>()

    for (const town of towns) {
      /* Written as JSON rather than joined by a separator, because a name
         may carry any character a separator could be. */
      const pair = JSON.stringify([town[1], town[2]])

      carried.set(pair, (carried.get(pair) ?? 0) + 1)
    }

    return [...carried.values()].filter((many) => many > 1).length
  }

  /**
   * The marks `plainly` folds onto a straight apostrophe, asked of `plainly`
   * rather than written out here.
   *
   * A list here would be a second copy of the one in `places.ts`, which is the
   * very thing the sentence being held is about. Every letter the codebook
   * actually carries is offered to the fold, and the ones that come back an
   * apostrophe are the marks that sentence means.
   */
  function marksThatFoldOntoAnApostrophe(): Set<string> {
    const every = new Set<string>()

    for (const town of towns) {
      for (const name of written(town)) {
        for (const letter of name) {
          every.add(letter)
        }
      }
    }

    return new Set([...every].filter((letter) => letter !== "'" && plainly(letter) === "'"))
  }

  const curly = marksThatFoldOntoAnApostrophe()

  /**
   * One fact: what it is, the shape the portal writes it in, and what the
   * codebook says it is.
   *
   * `says` carries exactly one group, the number, and is read against a file
   * whose comment stars have been taken off and whose whitespace has been
   * collapsed, so a sentence that wraps over three lines is still one sentence.
   */
  const FACTS: { what: string; says: RegExp; is: number }[] = [
    {
      what: 'how big it is, in kilobytes rounded to the nearest hundred',
      says: /codebook is (\d+) KB/g,
      is: Math.round(statSync(CODEBOOK).size / 1024 / 100) * 100,
    },
    {
      what: 'names in more than one country, folded the way the field folds them',
      says: /(\d+) names in it stand in more than one country/g,
      is: inMoreThanOneCountry((town) => written(town).map(plainly)),
    },
    {
      what: 'names in more than one country, spelt the way the codebook spells them',
      says: /(\d+) names in the codebook stand in more than one country/g,
      is: inMoreThanOneCountry((town) => [town[1]]),
    },
    {
      what: 'towns carrying a mark that folds onto an apostrophe',
      says: /which (\d+) towns carry/g,
      is: towns.filter((town) =>
        written(town).some((name) => [...name].some((letter) => curly.has(letter))),
      ).length,
    },
    {
      what: 'name and country pairs more than one town carries',
      says: /(\d+) name and country pairs in the codebook are carried by more than one town/g,
      is: pairsMoreThanOneTownCarries(),
    },
  ]

  /** A file as one long sentence: the star a block comment puts at the head of
   *  each of its lines taken off, and every run of whitespace collapsed, so a
   *  phrase that wraps is still that phrase. The star that closes a comment
   *  keeps its slash and is left alone. */
  const flat = (code: string) => code.replace(/^[ \t]*\*(?![/*])/gm, ' ').replace(/\s+/g, ' ')

  const swept = everything().filter((one) => one.path.endsWith('.ts') || one.path.endsWith('.tsx'))

  it('reads the whole portal, tests and all', () => {
    /* The floor under everything below, and asked of the list these tests really
       read rather than of the sweep it was filtered from: a narrowing slipped in
       between would leave the count answering for what was offered while the
       facts were measured over less. Tests are in it on purpose. Three of the
       six homes of the size are test files, and a sweep of production code alone
       would have held half of them. */
    expect(swept.length).toBeGreaterThan(WHOLE_PORTAL)
    expect(swept.filter((one) => one.path.includes('.test.')).length).toBeGreaterThan(0)
  })

  it.each(FACTS)('agrees with the codebook about $what', ({ says, is }) => {
    const said: string[] = []

    for (const { path, code } of swept) {
      for (const found of flat(code).matchAll(says)) {
        said.push(`${path}: ${found[1] ?? ''}`)
      }
    }

    /* Written down somewhere, or the pattern has stopped recognising the
       sentence it was written for and the line below is measuring nothing. */
    expect(said).not.toEqual([])
    expect(said.filter((one) => !one.endsWith(`: ${String(is)}`))).toEqual([])
  })
})

/**
 * Everything the rename had to reach: the code, the words a visitor reads, and
 * the records the portal is generated from.
 *
 * Two roots rather than one, because the old word survived in neither of the
 * places `src/**` alone could see it. Paths under `public/mock` are given
 * without that prefix, so a file reads as `mock/pages.json`.
 */
function everything(): { path: string; code: string }[] {
  return [
    ...under(join(process.cwd(), 'src'), '', ['.ts', '.tsx', '.css', '.json']),
    ...under(join(process.cwd(), 'public'), '', ['.json']),
    /* The codebook of the world's towns is not among them, and is dropped
       below: it is forty seven thousand place names nobody here wrote, and one
       of them is a town in Alaska called Badger. Reading it for the words the
       portal uses would be reading somebody else's atlas for our own prose. */
    /* The page the browser is handed before any of that. It carries a title and
       a description of its own, which is words a visitor reads. */
    { path: 'index.html', code: readFileSync(join(process.cwd(), 'index.html'), 'utf-8') },
  ].filter((one) => one.path !== 'mock/places.json')
}

function under(dir: string, prefix: string, kinds: string[]): { path: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return under(at, name, kinds)
    }

    return kinds.some((kind) => entry.name.endsWith(kind))
      ? [{ path: name, code: readFileSync(at, 'utf-8') }]
      : []
  })
}
