import en from '../../i18n/en.json'
import sr from '../../i18n/sr.json'
import { translate } from '../../i18n/translate'
import { whatGoesWith } from './eventDeletionWords'

/**
 * THE SENTENCE OVER AN EVENT'S DELETION, IN EVERY FORM SERBIAN GIVES ITS TWO NOUNS.
 *
 * <p>Owner, 25.10.2026 (PDL, „Rečenica u prozoru brisanja događaja imenuje i trke i rezultate koji odlaze"): the
 * sentence names the races and the results that go. <b>No row gives the races and the results the same number</b>, so
 * a sentence that read one count into both places, or the two counts the wrong way round, says a different sentence
 * here: every row below holds which number stands beside which noun.
 */
const say = (locale: 'sr' | 'en') => (key: string, params?: Record<string, string | number>) =>
  translate(locale === 'sr' ? sr : en, locale, key, params)

describe('what the sheet over an event says goes with it', () => {
  it.each([
    [1, 0, 'Ovim brišeš i 1 trku i 0 rezultata.'],
    [2, 1, 'Ovim brišeš i 2 trke i 1 rezultat.'],
    /* The owner's own example of the form. */
    [2, 5, 'Ovim brišeš i 2 trke i 5 rezultata.'],
    [5, 2, 'Ovim brišeš i 5 trka i 2 rezultata.'],
    /* The forms are chosen by the rules of the language and not by the numbers 1 to 4: 21 is singular, 12 is not. */
    [21, 12, 'Ovim brišeš i 21 trku i 12 rezultata.'],
    [11, 21, 'Ovim brišeš i 11 trka i 21 rezultat.'],
  ])('names %i races and %i results', (races, results, said) => {
    expect(whatGoesWith(say('sr'), races, results)).toBe(said)
  })

  it('says an event with no race has nothing to take with it, in both states', () => {
    /* Owner, 25.10.2026: „Događaj nema trka ni rezultata." in place of „0 trka i 0 rezultata". A result hangs off a
       race, so the results not known yet change nothing about an event with none. */
    expect(whatGoesWith(say('sr'), 0, 0)).toBe('Događaj nema trka ni rezultata.')
    expect(whatGoesWith(say('sr'), 0, null)).toBe('Događaj nema trka ni rezultata.')
    expect(whatGoesWith(say('en'), 0, 0)).toBe('The event has no races and no results.')
  })

  it('names the races and says the results are not known yet, rather than inventing a number for them', () => {
    expect(whatGoesWith(say('sr'), 1, null)).toBe('Ovim brišeš i 1 trku, a broj rezultata koji odlaze još nije poznat.')
    expect(whatGoesWith(say('sr'), 3, null)).toBe('Ovim brišeš i 3 trke, a broj rezultata koji odlaze još nije poznat.')
  })

  it('says it in English with the same numbers in the same places', () => {
    expect(whatGoesWith(say('en'), 1, 5)).toBe('This deletes 1 race and 5 results as well.')
    expect(whatGoesWith(say('en'), 2, 1)).toBe('This deletes 2 races and 1 result as well.')
    expect(whatGoesWith(say('en'), 2, null)).toBe('This deletes 2 races as well; how many results go with it is not known yet.')
  })
})
