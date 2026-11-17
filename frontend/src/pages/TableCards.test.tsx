import { cleanup, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { ClockContext } from '../clock/context'
import { I18nProvider } from '../i18n/I18nProvider'
import { PHONE_HEADER } from '../app/phoneHeader'
import { must } from '../test/at'
import { matchingMedia } from '../test/media'
import { unconditionalRules } from '../test/stylesheet'
import { TableCards, TablesHead, type TableCard } from './TableCards'

function drawn(current: TableCard, locale: 'sr' | 'en' = 'sr', at = '/', today = '2027-06-01') {
  render(
    <MemoryRouter initialEntries={[at]}>
      <ClockContext.Provider value={{ today, simulated: null, simulate: () => undefined }}>
        <I18nProvider locale={locale}>
          <TableCards current={current} />
        </I18nProvider>
      </ClockContext.Provider>
    </MemoryRouter>,
  )

  return within(screen.getByRole('group', { name: locale === 'sr' ? 'BTL tabele' : 'BTL tables' }))
}

const hrefs = (cards: ReturnType<typeof drawn>) => cards.getAllByRole('link').map((one) => one.getAttribute('href'))

describe('the three cards of the tables', () => {
  /* Owner, 17.11.2026: „Zelim da se zameni redosled dugmica na BTL tabele tako da uvek idu Predlozi tim
     (ako postoji), pa Timovi (default), pa Muskarci, pa Zene, pa drop down godine.", and answer 8 of
     16.11.2026: Timovi on `/timovi`, Muškarci on `/tabela`, Žene on `/tabela?pol=z`. With no season in
     the address, none is carried. Asked from every card, because each screen draws its own row. */
  it.each(['men', 'women', 'teams'] as const)(
    'draws Timovi, Muškarci and Žene in that order on the card %s, each a link to its card and to nothing more',
    (current) => {
      const cards = drawn(current)

      expect(cards.getAllByRole('link').map((one) => [one.textContent, one.getAttribute('href')])).toEqual([
        ['Timovi', '/sr/timovi'],
        ['Muškarci', '/sr/tabela'],
        ['Žene', '/sr/tabela?pol=z'],
      ])
      expect(cards.queryAllByRole('button')).toEqual([])
    },
  )

  it('keeps the language in every address', () => {
    const cards = drawn('teams', 'en')

    expect(cards.getAllByRole('link').map((one) => one.getAttribute('href'))).toEqual([
      '/en/timovi',
      '/en/tabela',
      '/en/tabela?pol=z',
    ])
  })

  /* THE SEASON OF THE ADDRESS GOES WITH EVERY CARD, EXCEPT A FUTURE SEASON OF THE TEAMS TO THE MEN OR THE
     WOMEN (owner, 16.11.2026: „Moze svuda da se cuva sezona, osim kad se iz buduce sezone timova prelazi
     na M ili Z, onda se prebacuje na aktuelnu."). On 1 June 2027 the running season is 2027 and 2028 has
     not begun, and the tables do not offer it; on 1 December they do. The age category is never carried. */
  it.each([
    ['men', '/sr/tabela?sezona=2030&kategorija=M40-54', '2027-06-01', ['/sr/timovi?sezona=2030', '/sr/tabela?sezona=2030', '/sr/tabela?pol=z&sezona=2030']],
    ['women', '/sr/tabela?pol=z&sezona=2027', '2030-06-01', ['/sr/timovi?sezona=2027', '/sr/tabela?sezona=2027', '/sr/tabela?pol=z&sezona=2027']],
    ['teams', '/sr/timovi?sezona=2027', '2030-06-01', ['/sr/timovi?sezona=2027', '/sr/tabela?sezona=2027', '/sr/tabela?pol=z&sezona=2027']],
    ['teams', '/sr/timovi?sezona=2028', '2027-06-01', ['/sr/timovi?sezona=2028', '/sr/tabela', '/sr/tabela?pol=z']],
    ['teams', '/sr/timovi?sezona=2028', '2027-12-01', ['/sr/timovi?sezona=2028', '/sr/tabela?sezona=2028', '/sr/tabela?pol=z&sezona=2028']],
    ['teams', '/sr/timovi?sezona=2029', '2027-12-01', ['/sr/timovi?sezona=2029', '/sr/tabela', '/sr/tabela?pol=z']],
  ] as const)('carries the season of the address from the card %s at %s on %s', (current, at, today, wanted) => {
    expect(hrefs(drawn(current, 'sr', at, today))).toEqual(wanted)
  })

  /* One card marked, the one the screen says it is, and every one of the three can be it. */
  it.each([
    ['men', 'Muškarci'],
    ['women', 'Žene'],
    ['teams', 'Timovi'],
  ] as const)('marks only the card it is told is being read: %s', (current, name) => {
    const cards = drawn(current)

    expect(cards.getAllByRole('link', { current: 'page' }).map((one) => one.textContent)).toEqual([name])
  })

  /* PAINTED AS THE ONE BEING READ, by the same rule that paints a pressed button of a single league, so
     the row beside the heading looks the same on both screens. Asked of the stylesheet because jsdom
     paints nothing: the marked link must be named in the rule that fills the card, and the links must
     be named in the rule that gives the row its face. */
  it('is painted by the rules that paint the buttons of a single league', () => {
    const css = readFileSync(join(process.cwd(), 'src/pages/Rankings.css'), 'utf8')
    const selectorsOf = (rule: CSSStyleRule) => rule.selectorText.split(',').map((one) => one.trim().replace(/"/g, "'"))
    const rules = unconditionalRules(css, 'Rankings.css')
    const face = must(
      rules.find((rule) => selectorsOf(rule).includes('.rankings__tabs button')),
      'the face of the row',
    )
    const marked = must(
      rules.find((rule) => selectorsOf(rule).includes(".rankings__tabs button[aria-pressed='true']")),
      'the face of the one being read',
    )

    expect(selectorsOf(face)).toEqual(['.rankings__tabs button', '.rankings__tabs a'])
    expect(face.style.textDecoration).toBe('none')
    expect(selectorsOf(marked)).toEqual([
      ".rankings__tabs button[aria-pressed='true']",
      ".rankings__tabs a[aria-current='page']",
    ])
    expect(marked.style.background).toBe('var(--accent)')
  })

  /* THE ROW WRAPS, FROM THE RIGHT. Measured in a browser at 360px with the text at 200% (WCAG 2.2 SC
     1.4.4): on one line the three cards ask about 490px, and the row, pushed to the right, sent
     „Muškarci" 160px off the left edge of the screen. jsdom lays nothing out, so what is held is the
     rule that cures it. */
  it('lets the row of cards wrap, from the right, so text at twice its size keeps every card on screen', () => {
    const css = readFileSync(join(process.cwd(), 'src/pages/Rankings.css'), 'utf8')
    const row = must(
      unconditionalRules(css, 'Rankings.css').find((rule) => rule.selectorText === '.rankings__tabs'),
      'the row of cards',
    )

    expect(row.style.flexWrap).toBe('wrap')
    expect(row.style.justifyContent).toBe('flex-end')
  })
})

const realMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = realMatchMedia
})

/** The row of the heading of the tables, with a season control that stands in for the screen's own. */
function head(current: TableCard, offered: boolean, locale: 'sr' | 'en' = 'sr') {
  render(
    <MemoryRouter initialEntries={['/']}>
      <ClockContext.Provider value={{ today: '2027-12-01', simulated: null, simulate: () => undefined }}>
        <I18nProvider locale={locale}>
          <div>
            <TablesHead
              current={current}
              offered={offered}
              seasonPicker={
                <label>
                  Sezona
                  <select defaultValue="2027">
                    <option value="2027">2027</option>
                  </select>
                </label>
              }
            />
          </div>
        </I18nProvider>
      </ClockContext.Provider>
    </MemoryRouter>,
  )

  return {
    cards: screen.getByRole('group', { name: locale === 'sr' ? 'BTL tabele' : 'BTL tables' }),
    season: must(screen.getByLabelText('Sezona').closest('label'), 'the season'),
  }
}

const WORDS = { sr: 'Prijavi tim', en: 'Register a team' } as const

describe('the row of the heading of the tables', () => {
  /* Owner, 17.11.2026, answer 1: „Samo na timovima i treba da se zove dugme zapravo Prijavi tim". First
     in the row, right before Timovi, and the season after the cards. */
  it.each(['sr', 'en'] as const)('offers the button on the teams, first, as a link to the form (%s)', (locale) => {
    const { cards, season } = head('teams', true, locale)
    const button = screen.getByRole('link', { name: WORDS[locale] })

    expect(button).toHaveAttribute('href', `/${locale}/novi-tim`)
    expect(button.nextElementSibling).toBe(cards)
    expect(must(cards.parentElement, 'the row of the cards').nextElementSibling).toBe(season)
    /* And no place held beside it: the words are drawn once, and they are the link. */
    expect(screen.getAllByText(WORDS[locale])).toEqual([button])
  })

  /* ANSWER 3: on the men and the women an invisible place of the same width. Its width is the button's
     because it is the button's own words in the button's own box, so what is held here is exactly that,
     read off the button the teams draw in the same language: the same text and the same classes, plus
     the one that hides it. And it is nothing anybody can reach: no link, out of the reader's tree, inert,
     and it takes no focus. */
  it.each([
    ['men', 'sr'],
    ['women', 'sr'],
    ['men', 'en'],
    ['women', 'en'],
  ] as const)('holds the place of the button on the card %s with its words in its box, out of reach (%s)', (current, locale) => {
    head('teams', true, locale)

    const button = screen.getByRole('link', { name: WORDS[locale] })
    const words = button.textContent
    const box = button.className

    cleanup()

    const { cards } = head(current, true, locale)
    const held = screen.getByText(WORDS[locale])

    expect(screen.queryByRole('link', { name: WORDS[locale] })).toBeNull()
    expect(held.textContent).toBe(words)
    expect(held.className).toBe(`${box} rankings__held`)
    expect(held.nextElementSibling).toBe(cards)
    expect(held).toHaveAttribute('aria-hidden', 'true')
    expect(held).toHaveAttribute('inert')
    expect(held).not.toHaveAttribute('href')
    expect(held).not.toHaveAttribute('tabindex')
    held.focus()
    expect(document.activeElement).not.toBe(held)
  })

  it('hides the place by visibility and nothing else, so it keeps the width of the box', () => {
    const css = readFileSync(join(process.cwd(), 'src/pages/Rankings.css'), 'utf8')
    const held = unconditionalRules(css, 'Rankings.css').filter((rule) => rule.selectorText === '.rankings__held')

    expect(held.map((rule) => [rule.style.length, rule.style.visibility])).toEqual([[1, 'hidden']])
  })

  /* „Predlozi tim (ako postoji)": whoever the teams offer no button has none on any card, and no place
     for one either. */
  it.each(['men', 'women', 'teams'] as const)('draws neither for whoever the teams offer nothing, on %s', (current) => {
    head(current, false)

    expect(screen.queryByText(WORDS.sr)).toBeNull()
    expect(screen.getAllByRole('link').map((one) => one.textContent)).toEqual(['Timovi', 'Muškarci', 'Žene'])
  })

  /* ON A TELEPHONE THE SEASON COMES FIRST, beside the heading, and the button and the cards in the row
     under it (owner, 17.11.2026), in the document as well, so the keyboard goes the way the eye does. The
     shape is asked of the same question the header asks, and told to the stylesheet by the class. */
  it.each([
    ['a telephone', true],
    ['a desktop', false],
  ] as const)('puts the season where it stands on %s', (_where, phone) => {
    window.matchMedia = matchingMedia((query) => phone && query === PHONE_HEADER)

    const { cards, season } = head('teams', true)
    const row = must(cards.parentElement, 'the row of the cards')
    const button = screen.getByRole('link', { name: WORDS.sr })

    expect(row.contains(button)).toBe(true)
    expect(row.contains(season)).toBe(false)
    expect(phone ? row.previousElementSibling : row.nextElementSibling).toBe(season)
    expect(row.classList.contains('rankings__cards--phone')).toBe(phone)
  })
})
