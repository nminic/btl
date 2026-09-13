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
   * (Član 74, `data/types.ts`). The arithmetic belongs with whoever still has the
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
  /* A dictionary of two words, which is all this needs: the labeller is asked
     for one key and hands back what it is given. */
  const t = (key: string) =>
    key === 'category.rookieMale' ? 'Početnici' : key === 'category.rookieFemale' ? 'Početnice' : key

  it('names the beginners by the word that carries the gender', () => {
    /* Serbian says it in one word and needs no letter in front of it; English
       says `M R` and `F R`, because rookie does not carry the gender (owner,
       11.08.2026). So the label comes out of the dictionary and the code does
       not. */
    expect(categoryLabel('M R', t)).toBe('Početnici')
    expect(categoryLabel('Ž R', t)).toBe('Početnice')
  })

  it('leaves an age band exactly as it is', () => {
    /* The bands are the same in every language, so nothing looks them up. A
       label that went through the dictionary here would need forty keys saying
       what they already say. */
    expect(categoryLabel('M40-54', t)).toBe('M40-54')
    expect(categoryLabel('Ž25-39', t)).toBe('Ž25-39')
  })

  it('is not fooled by a band that merely ends in the letter', () => {
    /* The whole word, not the last letter: a band called `MR` is not the
       beginners' category, and a test that passes on `endsWith('R')` alone
       would let it through. */
    expect(categoryLabel('MR', t)).toBe('MR')
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
