import { render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { must } from '../test/at'
import { unconditionalRules } from '../test/stylesheet'
import { TableCards, type TableCard } from './TableCards'

function drawn(current: TableCard, locale: 'sr' | 'en' = 'sr') {
  render(
    <MemoryRouter>
      <I18nProvider locale={locale}>
        <TableCards current={current} />
      </I18nProvider>
    </MemoryRouter>,
  )

  return within(screen.getByRole('group', { name: locale === 'sr' ? 'BTL tabele' : 'BTL tables' }))
}

describe('the three cards of the tables', () => {
  /* Owner, 16.11.2026: „Timovi prelazi BTL tabele kao treća ravnopravna opcija koja se otvara klikom na
     Timovi (nakon dugmeta Žene, a pre izbora godine iz dropdown)", and answer 8: Muškarci on `/tabela`,
     Žene on `/tabela?pol=z`, Timovi on `/timovi`. No address carries a season (answer 10). */
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
