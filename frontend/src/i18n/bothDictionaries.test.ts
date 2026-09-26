import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dictionaryFor, dictionaryLocale, type Locale } from './config'
import sr from './sr.json'
import { translate, type Dictionary } from './translate'

/**
 * That the two dictionaries carry the same names, and that there really are two.
 *
 * `translate` answers a name it does not know with the name itself, so a key
 * written on one side and forgotten on the other is not an error anywhere: the
 * screen renders `membership.noRecordTitle` as a heading and every other test
 * stays green. Serbian is the language the portal is written in and English is the
 * one translated from it, so the gap opens on the English side by default, one key
 * at a time, and is seen first by a reader on /en.
 *
 * **Written before the translation, on purpose.** The English dictionary is written
 * once the Serbian content is locked (`config.ts`, ADL A2), and the Serbian content
 * is not locked: keys are still being added. So this file is here first, holding the
 * state the portal is in today, and it starts holding the two dictionaries against
 * each other the moment `en.json` is put beside it. Nothing has to be remembered on
 * that day.
 *
 * **It does not skip itself while `en.json` is absent**, and that distinction is the
 * whole design. Absence is a state the portal declares in two places — the dictionary
 * it hands out for English and the language it says those pages are written in — and
 * while `en.json` is not there, what is held is that both of them say so. A flip of
 * either one on its own fails here. A guard that answered „nothing to measure" would
 * let exactly that through.
 *
 * **Names and not values.** Whether the English is good English cannot be read off a
 * file, and nothing here pretends to: what is held is that the two agree on what
 * there is to say, on the gaps each sentence leaves for a value, and on which
 * language the sentences are in. The words themselves are held by whoever reads them.
 */

/**
 * **The measurement this file exists because of, kept because it cost a round.**
 *
 * The floor first asked for was „exactly the same set of keys, both ways". That is
 * **satisfied by a byte copy of the Serbian dictionary**: measured on this branch
 * with `en.json` copied from `sr.json` and `config.ts` pointing at it, every case
 * about names and gaps passed — 6 of 6, exit code nought. Identical names and
 * identical gaps are precisely what a copy has, so the floor would have been green
 * over a branch that had translated nothing at all.
 *
 * What closed it is a question asked of the **alphabet** rather than of the keys, and
 * it is the case `says nothing in Serbian` below.
 */

/**
 * **The decisions this file is waiting for the translation to follow** (owner,
 * 26.09.2026). Written down here rather than left in a pull request, because this is
 * the file somebody opens on the day the translation starts.
 *
 * 1. **The league keeps its Serbian name.** `app.name` and `seo.home.title` stay
 *    „Balkanska trkačka liga" and English prose calls it **BTL**. The abbreviation is
 *    load-bearing in six places, the domain among them, and a translated name would
 *    part from it. Those two keys are the whole of `KEEPS_THE_NAME` below.
 * 2. **Two words where Serbian has two things.** **League** is the BTL itself,
 *    **Competition** is a competition running alongside it (`PDL.md:7370`, where the
 *    two are not even stored the same way). Key by key: `leagues.title` is „Lige" and
 *    `leagues.standing` is „Poredak takmičenja". And the one collision of names found
 *    while measuring: `nav.rules` is the **Rulebook**, `leagues.rules` is the
 *    **Terms** of one competition, and they share a key name today.
 * 3. **The four declarations a registrant affirms are translated**, and a note saying
 *    the Serbian version is the binding one goes beside them
 *    (`registration.healthStatement`, `healthStatementLink`, `parentConsent`,
 *    `parentConsentHint`). The note is a new key and its Serbian half goes in with it.
 *    The written legal pages themselves are not translated at all and are not in any
 *    dictionary: they are served by the backend, they need a paid human translation,
 *    and the Serbian text is what binds (`PDL.md:3174`).
 *
 * **And five things measured on the way, so nobody pays for them twice.**
 *
 * - `data/categories.ts` writes „Ž" into the category code and **stays that way**. It
 *   is not a label but the key the standing groups rows by (`leagueTable.ts`,
 *   `LeagueResults.tsx`), so making it follow the language would make the order of a
 *   competition follow the language. `F` is a separate piece of work with a guard of
 *   its own over the standing.
 * - `format.ts`, `formatDayInSentence` needs a second answer for English and has none
 *   yet: it adds the Serbian genitive to whatever `Intl` returns, so with English
 *   wired it answers **„Octobera 1, 2026"**, measured, not guessed.
 * - `formatDayMonth` and `formatNumericDate` take no language at all and answer
 *   „12.09." everywhere. That is the shape the owner asked for by name, twice
 *   (31.07.2026); a reader outside the region cannot tell it from the ninth of
 *   December, and that is a written boundary rather than a task.
 * - English has `one` and `other` where Serbian also has `few`, so the **32** plural
 *   groups get an English `few` as well, to keep the sets of names equal. It is a form
 *   `Intl.PluralRules` never selects in English; what keeps it from hiding a wrong
 *   plural is the case `answers for one, two and five` below.
 * - The thing the ducats used to be called has **no English word**, because the old
 *   name is retired in every language (`PDL.md:1843`, owner 06.08.2026) and
 *   `data/contract.test.ts` refuses both the Serbian word and its English twin in
 *   every file it sweeps. `en.json` is swept, and so is this file: writing either word
 *   out here to explain the rule failed that guard, which is why this paragraph names
 *   neither. The thing is a **Ducat**.
 */

/** Every leaf of a dictionary, by its dotted name. Groups are not names: nothing asks
 *  for `nav`, and a group present on one side with different children shows up as the
 *  children that differ. */
function names(node: Dictionary, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const name = prefix === '' ? key : `${prefix}.${key}`

    return typeof value === 'string' ? [name] : names(value, name)
  })
}

/** The same walk, keeping the sentence beside its name. */
function sentences(node: Dictionary, prefix = ''): [string, string][] {
  return Object.entries(node).flatMap(([key, value]): [string, string][] => {
    const name = prefix === '' ? key : `${prefix}.${key}`

    return typeof value === 'string' ? [[name, value]] : sentences(value, name)
  })
}

/** What a sentence leaves for a value to fill, read with the expression the engine
 *  interpolates with (`translate.ts`), so this can neither recognise a gap the engine
 *  would not fill nor miss one it would. Sorted, because the order the words come in is
 *  the translator's business and the set of them is not.
 *
 *  Taken whole, braces and all, rather than as the name inside them: the whole match is
 *  the one part of a match TypeScript knows is there, and it reads better in a failure. */
function gaps(text: string): string[] {
  return [...text.matchAll(/\{\w+\}/g)].map((one) => one[0]).sort()
}

/** The categories a language can ask a plural for, which is what tells a group of
 *  plural forms from an ordinary group of names. Unicode's list, and the only one
 *  `Intl.PluralRules` ever answers with. */
const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other']

/** The names of the groups that hold plural forms rather than names, collected on the
 *  way down rather than resolved back out of a dotted name afterwards. */
function counting(node: Dictionary, prefix = ''): string[] {
  const values = Object.values(node)

  if (values.length > 0 && values.every((one) => typeof one === 'string')) {
    return Object.keys(node).every((one) => CATEGORIES.includes(one)) && prefix !== ''
      ? [prefix]
      : []
  }

  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'string' ? [] : counting(value, prefix === '' ? key : `${prefix}.${key}`),
  )
}

/**
 * The five letters Serbian Latin has and English does not.
 *
 * Asked of the alphabet rather than of a list of keys, which is what gives it a
 * bottom: there is no next letter to be found next round. **What it does not hold**,
 * said rather than pretended: a sentence left in Serbian that happens to use none of
 * the five („Kontakt", „Maraton") walks past it. That is a question about which
 * language a sentence is in, it cannot be read off the sentence, and a guard that
 * must follow a value through the code has no bottom (`CLAUDE.md`). What is bought is
 * the whole class of untranslated prose, since prose of any length in this language
 * reaches for one of them.
 */
const SERBIAN_ONLY = /[čćšžđČĆŠŽĐ]/

/**
 * The two sentences that keep a Serbian letter on purpose: the league's own name
 * (owner, 26.09.2026, decision 1 above).
 *
 * Named one by one rather than caught by a pattern, the way `data/contract.test.ts`
 * names the three files allowed the retired word, and for the same reason: a pattern
 * would let the next sentence that stays Serbian in past it.
 *
 * **Naming a key here is not, on its own, the exception.** The case right below reads
 * the *Serbian* sentence at the named key, and almost every Serbian sentence has a
 * letter to give it: measured, 575 of 1200. A key added here for a sentence that keeps
 * none of the league's name would still pass that case, and an untranslated copy of it
 * sitting in English would pass `says nothing in Serbian, letter by letter` too, since
 * that case skips whatever is named here by construction. What actually stops the list
 * from being padded to leave a key untranslated is `carries the league's name and
 * nothing else in Serbian`, in the English dictionary's own describe block below: it
 * reads the *English* sentence and asks for the league's own name inside it.
 */
const KEEPS_THE_NAME = ['app.name', 'seo.home.title']

/** Where the English dictionary will be, asked of the file system rather than of an
 *  import, because an import of a file that is not there is not a state a test can be
 *  in. */
const AT = join(process.cwd(), 'src', 'i18n', 'en.json')

function isDictionary(value: unknown): value is Dictionary {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (one: unknown) => typeof one === 'string' || isDictionary(one),
    )
  )
}

function englishDictionary(): Dictionary | null {
  if (!existsSync(AT)) {
    return null
  }

  const read: unknown = JSON.parse(readFileSync(AT, 'utf-8'))

  /* A file that is there and is not a dictionary is a fault of its own, and is said
     out loud rather than read as an absence, which would silence everything below. */
  if (!isDictionary(read)) {
    throw new Error(`${AT} is not a dictionary of sentences`)
  }

  return read
}

const english = englishDictionary()
const serbian = names(sr)

describe('the Serbian dictionary', () => {
  it('is read at all, so nothing below is a check over an empty list', () => {
    /* Two witnesses, the second four levels deep. A walk that stops recursing answers
       with the shallow names and nothing else, which is the shape a rewrite of `names`
       would most easily take, and the first witness alone would not see it. */
    for (const witness of ['app.name', 'profile.categoryWord.short.one']) {
      expect(serbian, witness).toContain(witness)
    }

    /* And that it went deeper than the top level, measured rather than assumed: a name
       with a dot in it is a name the walk had to recurse for, and there are more of
       those than there are groups to recurse into. */
    expect(serbian.filter((one) => one.includes('.')).length).toBeGreaterThan(
      Object.keys(sr).length,
    )
  })

  it('is full of the letters English does not have, which is what makes that test work', () => {
    /* The floor under `says nothing in Serbian`. Without it that case would pass just
       as well on a dictionary that had lost every sentence, and on a pattern that had
       stopped matching anything. Measured today: 575 of 1200. */
    const carrying = sentences(sr).filter(([, text]) => SERBIAN_ONLY.test(text))

    expect(carrying.length).toBeGreaterThan(sentences(sr).length / 4)
  })

  it('needs the exception for every sentence that is allowed one, and for no other', () => {
    const written = new Map(sentences(sr))
    const idle = KEEPS_THE_NAME.filter((name) => {
      const text = written.get(name)

      return text === undefined || !SERBIAN_ONLY.test(text)
    })

    expect(idle, 'allowed a Serbian letter and not using one').toEqual([])
  })

  it('has sentences with gaps in them, so the gap test reads something', () => {
    expect(sentences(sr).filter(([, text]) => gaps(text).length > 0).length).toBeGreaterThan(0)
  })

  it('still counts things, so the plural test reads something', () => {
    expect(counting(sr).length).toBeGreaterThan(0)
  })
})

if (english === null) {
  describe('while there is no English dictionary', () => {
    it('says so in both of the places that can say it', () => {
      /* Not a skip. Absence is a state the portal declares twice — the dictionary it
         hands out for English, and the language it tells a browser and a search engine
         those pages are written in — and the two have to agree. Half of the flip is the
         fault this holds: `lang="en"` over Serbian text is read out with English
         phonetics, which is unintelligible, and a dictionary wired without the file
         behind it does not build at all.

         `i18n.test.tsx` holds these two tables to each other and passes whichever way
         both of them point. What it cannot say is which way that is, and on a branch
         where the file is not there, only one way is true. */
      expect(dictionaryFor('en')).toBe(dictionaryFor('sr'))
      expect(dictionaryLocale('en')).toBe('sr')
      expect(dictionaryLocale('sr')).toBe('sr')
    })
  })
} else {
  const book = english
  const translated = names(book)

  describe('the English dictionary and the Serbian one', () => {
    it('carries exactly the same names, in both directions', () => {
      const missing = serbian.filter((one) => !translated.includes(one))
      const extra = translated.filter((one) => !serbian.includes(one))

      expect(missing, 'said in Serbian and not in English').toEqual([])
      expect(extra, 'said in English and not in Serbian').toEqual([])
    })

    it('leaves the same gaps in every sentence, in both directions', () => {
      /* A translation that drops `{name}` prints a sentence with a hole in it, and one
         that invents `{naziv}` prints the braces to the reader: `translate` leaves an
         unknown placeholder written as it stands, on purpose. Neither fails anything
         else, and both are visible only on /en. */
      const there = new Map(sentences(book))
      const differing = sentences(sr).flatMap(([name, text]) => {
        const other = there.get(name)

        if (other === undefined) {
          return []
        }

        const here = gaps(text).join(' ')
        const across = gaps(other).join(' ')

        return here === across ? [] : [`${name}: sr [${here}] en [${across}]`]
      })

      expect(differing).toEqual([])
    })

    it('answers for one, two and five, in both languages', () => {
      /* A plural name is a group rather than a sentence, so the cases above see its
         forms and say nothing about whether a form is one the language ever asks for.
         Serbian picks a different form at 1, at 2 and at 5; English picks at 1 and at
         everything else, and `translate` falls back on `other` for a category the file
         has no form of. What this asks is that neither language answers a count with
         the name of the key, which is what it does when the form it selected is the one
         that was left out. */
      const books: [Locale, Dictionary][] = [
        ['sr', sr],
        ['en', book],
      ]

      const silent = counting(sr).flatMap((key) =>
        [1, 2, 5].flatMap((count) =>
          books
            .filter(([locale, one]) => translate(one, locale, key, { count }) === key)
            .map(([locale]) => `${key} @ ${locale} ${String(count)}`),
        ),
      )

      expect(silent).toEqual([])
    })

    it('says nothing in Serbian, letter by letter', () => {
      const left = sentences(book)
        .filter(([name]) => !KEEPS_THE_NAME.includes(name))
        .filter(([, text]) => SERBIAN_ONLY.test(text))

      expect(left.map(([name]) => name), 'left in Serbian').toEqual([])
    })

    it('carries the league name and nothing else in Serbian, for every exception', () => {
      /* The case above skips `KEEPS_THE_NAME` entirely, and the Serbian-side case in
         `the Serbian dictionary` block does not read English at all, so neither holds
         what is actually exempted: the league's own name, and nothing beside it
         (decision 1 above). This asks the *English* sentence directly, for every name
         the list holds.

         Proven against the two mutations a review found the rest of this file green
         on: a key added to the list with its Serbian sentence copied verbatim into
         English carries no trace of the league's name, so it fails the first half; and
         `en.json`'s `review.waiting` set back to its own Serbian text and added to the
         list fails the same way. Neither can be satisfied by padding the list, because
         padding does not, by itself, put the league's name in the sentence. */
      const leagueName = new Map(sentences(sr)).get('app.name')

      if (leagueName === undefined) {
        throw new Error('app.name is missing from the Serbian dictionary')
      }

      const there = new Map(sentences(book))
      const failing = KEEPS_THE_NAME.filter((name) => {
        const text = there.get(name)

        return (
          text === undefined ||
          !text.includes(leagueName) ||
          SERBIAN_ONLY.test(text.replaceAll(leagueName, ''))
        )
      })

      expect(failing, 'missing the league name, or carrying more Serbian than it').toEqual([])
    })

    it('is a second dictionary and not the Serbian one under another name', () => {
      /* The case the three above cannot fail on their own. A dictionary held against
         itself agrees with itself about every name and every gap, so all of them stay
         green while `config.ts` still hands the Serbian book out for English — which is
         exactly what it did before the translation, deliberately and with a comment
         saying so. Object identity is what tells the two apart, because that is what
         the mapping in `config.ts` is: one of two values. */
      expect(dictionaryFor('en')).not.toBe(dictionaryFor('sr'))
      expect(dictionaryLocale('en')).toBe('en')
      expect(dictionaryLocale('sr')).toBe('sr')
    })
  })
}
