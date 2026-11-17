import { render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { PHONE_HEADER } from '../app/phoneHeader'
import { ClockContext } from '../clock/context'
import { I18nProvider } from '../i18n/I18nProvider'
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
  /* Owner, 16.11.2026: „Timovi prelazi BTL tabele kao treća ravnopravna opcija koja se otvara klikom na
     Timovi (nakon dugmeta Žene, a pre izbora godine iz dropdown)", and answer 8: Muškarci on `/tabela`,
     Žene on `/tabela?pol=z`, Timovi on `/timovi`. With no season in the address, none is carried. */
  it('draws Muškarci, Žene and Timovi in that order, each a link to its card and to nothing more', () => {
    const cards = drawn('men')

    expect(cards.getAllByRole('link').map((one) => [one.textContent, one.getAttribute('href')])).toEqual([
      ['Muškarci', '/sr/tabela'],
      ['Žene', '/sr/tabela?pol=z'],
      ['Timovi', '/sr/timovi'],
    ])
    expect(cards.queryAllByRole('button')).toEqual([])
  })

  it('keeps the language in every address', () => {
    const cards = drawn('teams', 'en')

    expect(cards.getAllByRole('link').map((one) => one.getAttribute('href'))).toEqual([
      '/en/tabela',
      '/en/tabela?pol=z',
      '/en/timovi',
    ])
  })

  /* THE SEASON OF THE ADDRESS GOES WITH EVERY CARD, EXCEPT A FUTURE SEASON OF THE TEAMS TO THE MEN OR THE
     WOMEN (owner, 16.11.2026: „Moze svuda da se cuva sezona, osim kad se iz buduce sezone timova prelazi
     na M ili Z, onda se prebacuje na aktuelnu."). On 1 June 2027 the running season is 2027 and 2028 has
     not begun, and the tables do not offer it; on 1 December they do. The age category is never carried. */
  it.each([
    ['men', '/sr/tabela?sezona=2030&kategorija=M40-54', '2027-06-01', ['/sr/tabela?sezona=2030', '/sr/tabela?pol=z&sezona=2030', '/sr/timovi?sezona=2030']],
    ['women', '/sr/tabela?pol=z&sezona=2027', '2030-06-01', ['/sr/tabela?sezona=2027', '/sr/tabela?pol=z&sezona=2027', '/sr/timovi?sezona=2027']],
    ['teams', '/sr/timovi?sezona=2027', '2030-06-01', ['/sr/tabela?sezona=2027', '/sr/tabela?pol=z&sezona=2027', '/sr/timovi?sezona=2027']],
    ['teams', '/sr/timovi?sezona=2028', '2027-06-01', ['/sr/tabela', '/sr/tabela?pol=z', '/sr/timovi?sezona=2028']],
    ['teams', '/sr/timovi?sezona=2028', '2027-12-01', ['/sr/tabela?sezona=2028', '/sr/tabela?pol=z&sezona=2028', '/sr/timovi?sezona=2028']],
    ['teams', '/sr/timovi?sezona=2029', '2027-12-01', ['/sr/tabela', '/sr/tabela?pol=z', '/sr/timovi?sezona=2029']],
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

/* ON A TELEPHONE THE SEASON COMES FIRST, beside the heading, and the cards in the row under it (owner,
   17.11.2026: „u gornjem redu naslov BTL tabele levo i dropdown sezone desno, a u jednom redu ispod
   [...] Muskarci, Zene”), in the document as well, so the keyboard goes the way the eye does. The shape is
   asked of the same question the header asks, and told to the stylesheet by the class. And nothing but
   the cards and the season stands in the row: „Prijavi tim” is under the table of the teams. */
describe('the row of the heading of the tables', () => {
  it.each([
    ['a telephone', true],
    ['a desktop', false],
  ] as const)('puts the season where it stands on %s', (_where, phone) => {
    window.matchMedia = matchingMedia((query) => phone && query === PHONE_HEADER)

    render(
      <MemoryRouter initialEntries={['/']}>
        <ClockContext.Provider value={{ today: '2027-12-01', simulated: null, simulate: () => undefined }}>
          <I18nProvider locale="sr">
            <div>
              <TablesHead
                current="teams"
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

    const cards = screen.getByRole('group', { name: 'BTL tabele' })
    const season = must(screen.getByLabelText('Sezona').closest('label'), 'the season')

    expect([...must(cards.parentElement, 'the row').children]).toEqual(phone ? [season, cards] : [cards, season])
    expect(cards.classList.contains('rankings__tabs--phone')).toBe(phone)
    expect(screen.getAllByRole('link').map((one) => one.textContent)).toEqual(['Muškarci', 'Žene', 'Timovi'])
  })
})
