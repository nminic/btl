import en from '../i18n/en.json'
import sr from '../i18n/sr.json'
import { translate } from '../i18n/translate'
import { sources } from '../test/sources'
import { AGE_BANDS, categoryCodeFor, categoryLabel, firstSeasonAllowed } from './categories'

/** The smallest number of drawn screens that can still be all of them. There are
 *  around a hundred and twenty today and the largest single folder holds under
 *  thirty, so this floor cannot be met by any one folder. */
const SCREENS = 90

describe('AGE_BANDS', () => {
  /* **What used to stand here, and where it went** (13.09.2026).
   *
   * Two cases held `ageBandFor(birthYear, season)`: that the age counted is the one
   * reached during the calendar year rather than the age on the day, so somebody
   * turning 40 in November 2027 is in the 40-54 band from 1 January; and the four
   * boundaries themselves, read off the rulebook.
   *
   * Both are still the rule (PDL P7) and neither is measured here any more, because
   * the function is gone: it took a year of birth, and the portal is not allowed one
   * (section 3 of the privacy policy, `data/types.ts`). The arithmetic belongs with whoever still has the
   * date, which is the backend and the tool that writes the served file.
   *
   * **This is written down rather than left to be noticed.** The bands are now data
   * that arrives already chosen, so what the portal can still hold is that the list
   * of them is closed and that nothing outside it is ever served. The first is here;
   * the second is `data/servedAge.test.ts`, over the file itself.
   */
  it('is the four the rulebook fixes and nothing else', () => {
    /* No band for under eighteen and none for over sixty five, and the owner has
       refused both (PDL P7). A fifth arriving here is a decision, so it is one that
       has to be made in the open rather than by adding a string. */
    expect([...AGE_BANDS]).toEqual(['24-', '25-39', '40-54', '55+'])
  })
})

describe('categoryCodeFor', () => {
  it('writes the band with the gender mark', () => {
    expect(categoryCodeFor('M', '40-54', false)).toBe('M40-54')
    expect(categoryCodeFor('F', '25-39', false)).toBe('Ž25-39')
  })

  it('puts a first season member in their own category instead of a band', () => {
    /* And the band they would otherwise have carried is not in the answer at all:
       a beginner is in one category and not in two (owner, 03.08.2026). Handed a
       band that differs between the two calls, so a code that leaked it would come
       out differently and not merely look the same. */
    expect(categoryCodeFor('M', '40-54', true)).toBe('M R')
    expect(categoryCodeFor('F', '24-', true)).toBe('Ž R')
  })
})

describe('categoryLabel', () => {
  /* The real dictionaries and not a stub of two words: the letter of a woman's
     category is the one thing that follows the language (owner, 18.10.2026), so a
     stub that answered it by hand would measure the stub. */
  const inSerbian = (key: string) => translate(sr, 'sr', key)
  const inEnglish = (key: string) => translate(en, 'en', key)

  it('names the beginners by the word that carries the gender', () => {
    /* Serbian says it in one word and needs no letter in front of it; English
       says `Rookies` for both (owner, 18.10.2026). So the label comes out of the
       dictionary and the code does not. */
    expect(categoryLabel('M R', inSerbian)).toBe('Početnici')
    expect(categoryLabel('Ž R', inSerbian)).toBe('Početnice')
    expect(categoryLabel('M R', inEnglish)).toBe('Rookies')
    expect(categoryLabel('Ž R', inEnglish)).toBe('Rookies')
  })

  it.each(AGE_BANDS)('writes the band %s with a space after the mark, in Serbian', (band) => {
    expect(categoryLabel(`M${band}`, inSerbian)).toBe(`M ${band}`)
    expect(categoryLabel(`Ž${band}`, inSerbian)).toBe(`Ž ${band}`)
  })

  it.each(AGE_BANDS)('writes the band %s with a space after the mark, in English', (band) => {
    /* The men keep `M` and the women are `F` in English, where Serbian keeps `Ž`
       (owner, 18.10.2026). Both sexes at once, so neither letter is the only
       thing the case holds. */
    expect(categoryLabel(`M${band}`, inEnglish)).toBe(`M ${band}`)
    expect(categoryLabel(`Ž${band}`, inEnglish)).toBe(`F ${band}`)
  })

  it('takes the letter from the dictionary and the band from the code', () => {
    /* A labeller that answers every key with its own name, so a label that was
       built from anything but `category.markMale` / `category.markFemale` and the
       band of the code comes out as something else. */
    const named = (key: string) => key

    expect(categoryLabel('M40-54', named)).toBe('category.markMale 40-54')
    expect(categoryLabel('Ž40-54', named)).toBe('category.markFemale 40-54')
  })

  it('is not fooled by a band that merely ends in the letter', () => {
    /* The whole word, not the last letter: a band called `MR` is not the
       beginners' category, and a test that passes on `endsWith('R')` alone
       would let it through. */
    expect(categoryLabel('MR', inSerbian)).toBe('MR')
  })

  it('leaves alone a code that is not a mark and an age band', () => {
    /* Neither a mark that is not one of the two, nor a mark in front of something
       that is not a band, is made into a label: the code is shown as it is, so a
       code the league has not met is visible rather than dressed up. */
    expect(categoryLabel('X40-54', inSerbian)).toBe('X40-54')
    expect(categoryLabel('M40-55', inSerbian)).toBe('M40-55')
    expect(categoryLabel('Ž', inSerbian)).toBe('Ž')
    expect(categoryLabel('', inSerbian)).toBe('')
  })
})

describe('firstSeasonAllowed', () => {
  it('closes at twelve points, and never opens again', () => {
    expect(firstSeasonAllowed(11.99)).toBe(true)
    expect(firstSeasonAllowed(12)).toBe(false)
    expect(firstSeasonAllowed(40)).toBe(false)
  })
})

describe('the category code never reaches the screen on its own', () => {
  /* Read over the source, because the alternative is a test per screen and the
     screens are six. The rule is one and the same everywhere: what the league
     keeps the category under (`M R`) is not what a visitor is shown
     („Početnici"), so every place that asks for the code has to put it through
     the dictionary (PDL P7, 11.08.2026).
   *
     Written this way after the code leaked twice: once onto the filter buttons
     of the standings, and once onto the row of honours, each time because the
     screen was translated and one call beside it was not. A test per screen
     would have caught the screen it was written for and no other. */
  /* Screens only. A `.ts` file is where the code is worked out and kept, and
     that is right: `pages/profile/awards.ts` files an honour under the code and
     the screen that draws it looks the word up. Widening this to `.ts` flagged
     four lines that are doing exactly what they should.
   *
     The sweep itself is the shared one (src/test/sources.ts), which excludes
     tests by file name and by folder rather than by the whole path. This file
     used to walk `src` on its own and skip a file whose *path* carried `.test.`,
     so a checkout into a folder named that way swept the portal away and left
     this guard reading nought files and passing. */
  const drawn = () => sources().filter((file) => file.path.endsWith('.tsx'))

  it('is a sweep over the screens rather than over nothing', () => {
    /* The floor. Without it the assertion below says „no screen out of none does
       this wrong", which reads exactly like „nothing is wrong". */
    expect(drawn().length).toBeGreaterThan(SCREENS)
  })

  it('puts every drawn category through the dictionary', () => {
    const loose: string[] = []

    for (const { path: file, code } of drawn()) {
      for (const line of code.split('\n')) {
        /* The code is asked for either straight from the member or out of a
           record that already holds it; both have to be wrapped. */
        const asked = line.includes('categoryOfMember(') || line.includes('award.category')

        if (asked && !line.includes('categoryLabel(')) {
          loose.push(`${file.slice(file.indexOf('src'))}: ${line.trim()}`)
        }
      }
    }

    expect(loose).toEqual([])
  })
})
