import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { htmlElement } from '../test/at'
import { matchingMedia } from '../test/media'
import { neverPaidAsServed } from '../test/neverPaid'
import { moderatorWith, renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { NAV_SYMBOL, type NavSymbol } from './navSymbol'
import { PHONE_HEADER } from './phoneHeader'

/**
 * THE HEADER OF A TELEPHONE, AND THE DESKTOP THAT STAYS AS IT WAS (owner, 16.11.2026, PDL „Pravilnik
 * prelazi u podnožje, a Timovi postaju treća kartica BTL tabela”): „Na desktopu može da ostane koncept
 * kao do sada, ali na mobilnom želim da u prvom redu ide logo BTL sa tekstom i motoom, a pored izbor
 * jezika, a onda u donjem redu 7 ili 8 jednakih dugmića po širini ekrana gde se prikazuju simboli za
 * svaku od stavki (poslednja stavka je sličica ulogovanog korisnika, ukoliko postoji).”
 *
 * What is asked here is what jsdom can answer: the order the header is read and tabbed through at each
 * width, the names, the symbols, and the count the row is laid out by. Where the cells stand, how wide
 * they are and whether the first row breaks is asked of Chrome (`geometry/phoneHeader.geometry.ts`).
 *
 * The order is asked by TAB, which is the order a keyboard meets the header in and so the very thing
 * the two orders of the document are for (`app/phoneHeader.ts`): on a telephone the envelope and the
 * picture come after the words, on a desktop after the language.
 *
 * Drawn as the production bundle draws it, without the two development controls of QA, so that the order
 * is the header's and not the tools'. Where those two stand on a telephone is asked with them drawn, in
 * `app/phoneHeaderOnQa.test.tsx`.
 */

vi.mock('../dev/tools', () => ({
  devToolsEnabled: () => false,
  DEV_TOOLS_IN_THIS_BUILD: false,
  loadTheDevControls: null,
}))

const realMatchMedia = window.matchMedia

/** Draws the header of a telephone: the shell's question answers yes, every other question no. */
function onATelephone(): void {
  window.matchMedia = matchingMedia((query) => query === PHONE_HEADER)
}

beforeEach(() => {
  window.matchMedia = realMatchMedia
})

const stops: (() => void)[] = []

afterEach(() => {
  window.matchMedia = realMatchMedia

  for (const stop of stops.splice(0)) {
    stop()
  }
})

/** The administration, signed in: an account the league keeps no record of. */
function asTheAdministration(): void {
  stops.push(
    serverThat((path) =>
      path === '/api/me'
        ? new Response(JSON.stringify({ role: 'superadmin', account: 41, mailLanguage: 'sr' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : null,
    ).stop,
  )
}

/** What a reader hears a control called: its label where it has one, its words where it does not. */
function nameOf(element: Element): string {
  return element.getAttribute('aria-label') ?? element.textContent ?? ''
}

/**
 * Every control of the header in the order Tab reaches it, from the first one in the page to the last
 * one inside the banner. The skip link comes first and is left out, because it is not the header's.
 */
async function tabbedThrough(): Promise<string[]> {
  const user = setupUser()
  const banner = screen.getByRole('banner')
  const names: string[] = []

  htmlElement(document.body).focus()

  for (let step = 0; step < 30; step += 1) {
    await user.tab()

    const at = document.activeElement

    if (at === null || at === document.body) {
      break
    }

    if (banner.contains(at)) {
      names.push(nameOf(at))
    } else if (names.length > 0) {
      break
    }
  }

  return names
}

const WORDS = ['Takmičari', 'BTL tabele', 'Top liste', 'Lige', 'Kalendar']

describe('the order the header of a telephone is read in', () => {
  it('is the mark, the language, the five words and then the two links of a visitor', async () => {
    onATelephone()
    renderAt('/sr')

    /* Offered only once the server has said nobody is signed in (PDL P26), and not before. */
    await screen.findByRole('link', { name: 'Učlani se' })

    expect(await tabbedThrough()).toEqual(['Naslovna strana', 'Jezik, SR', ...WORDS, 'Prijavi se', 'Učlani se'])
  }, SLOW)

  it('ends with the picture of a signed in member, after the words and the envelope', async () => {
    onATelephone()
    renderAt('/sr', 'competitor', '000007')

    await screen.findByRole('button', { name: 'Otvori nalog' })

    const order = await tabbedThrough()

    expect(order.slice(0, -2)).toEqual(['Naslovna strana', 'Jezik, SR', ...WORDS])
    expect(order.at(-2)).toMatch(/^Otvori poruke/)
    expect(order.at(-1)).toBe('Otvori nalog')
  }, SLOW)

  it('draws no envelope to somebody who has not paid, so his picture follows the words', async () => {
    onATelephone()
    stops.push(neverPaidAsServed().stop)
    renderAt('/sr', 'visitor', null)

    await screen.findByRole('button', { name: 'Otvori moj meni' })

    expect(await tabbedThrough()).toEqual(['Naslovna strana', 'Jezik, SR', ...WORDS, 'Otvori moj meni'])
    expect(screen.queryByRole('button', { name: /Otvori poruke/ })).not.toBeInTheDocument()
  }, SLOW)

  it('gives the administration its eighth entry before the envelope and the picture', async () => {
    onATelephone()
    asTheAdministration()
    renderAt('/sr', 'superadmin', null)

    await screen.findByRole('button', { name: 'Otvori nalog' })

    const order = await tabbedThrough()

    expect(order.slice(0, 7)).toEqual(['Naslovna strana', 'Jezik, SR', ...WORDS])
    expect(order[7]).toMatch(/^Administracija/)
    expect(order[8]).toMatch(/^Otvori poruke/)
    expect(order[9]).toBe('Otvori nalog')
    expect(order).toHaveLength(10)
  }, SLOW)
})

describe('the header of a desktop, which stays as it was', () => {
  it('reads the envelope and the picture after the language and before the words', async () => {
    renderAt('/sr', 'competitor', '000007')

    await screen.findByRole('button', { name: 'Otvori nalog' })

    const order = await tabbedThrough()

    expect(order.slice(0, 2)).toEqual(['Naslovna strana', 'Jezik, SR'])
    expect(order[2]).toMatch(/^Otvori poruke/)
    expect(order.slice(3)).toEqual(['Otvori nalog', ...WORDS])
  }, SLOW)

  it('shows the words and draws no symbol beside any of them, and gives the row no count', async () => {
    renderAt('/sr')

    const navigation = await screen.findByRole('navigation', { name: 'Glavna navigacija' })
    const links = within(navigation).getAllByRole('link')

    expect(links.map((link) => link.textContent)).toEqual(WORDS)
    /* A symbol inside a link of the desktop would be the row of the telephone leaking upwards. */
    expect(links.flatMap((link) => [...link.querySelectorAll('svg')])).toEqual([])
    expect(navigation.style.getPropertyValue('--cells')).toBe('')

    await screen.findByRole('link', { name: 'Učlani se' })

    /* „Učlani se" stays a word, gold. „Prijavi se" is the one link of a desktop that is drawn, and since
       21.11.2026 (owner, PDL „Zaglavlje za posetioca") it is drawn as a person, which is not one of the
       telephone's symbols: the arrow into the door must not leak upwards either. */
    expect(screen.getByRole('link', { name: 'Učlani se' }).querySelector('svg')).toBeNull()

    const signIn = screen.getByRole('link', { name: 'Prijavi se' })

    expect(signIn.querySelector('svg')).not.toBeNull()
    expect(signIn.querySelector('[data-symbol]')).toBeNull()
  }, SLOW)
})

/**
 * THE SYMBOL OF EACH ENTRY, as the owner chose them (answer 6). Written by hand, because it is the
 * owner's map and nothing in the code can say it; held from below by what is drawn, so an entry or a
 * link of a visitor that comes without a row here fails, and so does a row nothing draws any more.
 */
const SYMBOL_OF: ReadonlyMap<string, NavSymbol> = new Map([
  ['Takmičari', NAV_SYMBOL.people],
  ['BTL tabele', NAV_SYMBOL.ranking],
  ['Top liste', NAV_SYMBOL.steps],
  ['Lige', NAV_SYMBOL.trophy],
  ['Kalendar', NAV_SYMBOL.calendar],
  ['Administracija', NAV_SYMBOL.sliders],
  ['Prijavi se', NAV_SYMBOL.signIn],
  ['Učlani se', NAV_SYMBOL.join],
])

/** The word of a cell, which is its name less the count administration carries. */
const wordOf = (link: HTMLElement) => nameOf(link).replace(/, \d+ na čekanju$/, '')

describe('a cell of the telephone', () => {
  it('carries the symbol the owner chose for its word, and the word as its name', async () => {
    const seen = new Set<string>()

    for (const signIn of [asTheAdministration, () => {}]) {
      onATelephone()
      signIn()

      const { unmount } = renderAt('/sr', signIn === asTheAdministration ? 'superadmin' : 'visitor', null)
      const navigation = await screen.findByRole('navigation', { name: 'Glavna navigacija' })

      await (signIn === asTheAdministration
        ? screen.findByRole('link', { name: /^Administracija/ })
        : screen.findByRole('link', { name: 'Učlani se' }))

      const cells = [
        ...within(navigation).getAllByRole('link'),
        ...['Prijavi se', 'Učlani se'].flatMap((name) => screen.queryAllByRole('link', { name })),
      ]

      for (const cell of cells) {
        const word = wordOf(cell)
        const drawings = [...cell.querySelectorAll('svg')]

        seen.add(word)
        expect(drawings, `the cell „${word}" draws one symbol`).toHaveLength(1)
        /* The symbol carries no name: the word does (answer 5). */
        expect(drawings[0]).toHaveAttribute('aria-hidden', 'true')
        expect(drawings[0]?.getAttribute('data-symbol'), `the symbol of „${word}"`).toBe(SYMBOL_OF.get(word))
        /* And the word is in the cell, as text a reader is given, not only in a label. */
        expect(cell).toHaveTextContent(word)
      }

      unmount()
      for (const stop of stops.splice(0)) {
        stop()
      }
    }

    expect([...seen].sort()).toEqual([...SYMBOL_OF.keys()].sort())
  }, SLOW)

  it('names the language by its code as well, which the telephone no longer shows', async () => {
    onATelephone()
    renderAt('/sr')

    expect(await screen.findByRole('button', { name: 'Jezik, SR' })).toBeVisible()
  }, SLOW)

  it('names the language by its code in English too', async () => {
    renderAt('/en')

    expect(await screen.findByRole('button', { name: 'Language, EN' })).toBeVisible()
  }, SLOW)
})

/**
 * THE COUNT THE ROW IS LAID OUT BY, AND THE LINKS IT COUNTS. The stylesheet gives the navigation as
 * many of the row's equal columns as `--cells` says (`app/Shell.css`, `.shell__cells`), and the shell
 * writes it from the list it draws. Asked of a moderator who holds no right: the navigation of his role
 * has six entries and he may open five, so a count read off the role and not off what is drawn says
 * six over five links and leaves a hole in the row.
 */
describe('the count of the cells of the navigation', () => {
  it('is the number of links it draws, and not the number its role would have', async () => {
    onATelephone()
    renderAt('/sr', 'moderator', '000007', moderatorWith([]))

    const navigation = await screen.findByRole('navigation', { name: 'Glavna navigacija' })

    await screen.findByRole('button', { name: 'Otvori nalog' })

    expect(within(navigation).getAllByRole('link').map(wordOf)).toEqual(WORDS)
    expect(navigation.style.getPropertyValue('--cells')).toBe('5')
  }, SLOW)

  it('counts the eighth cell of the administration', async () => {
    onATelephone()
    asTheAdministration()
    renderAt('/sr', 'superadmin', null)

    const navigation = await screen.findByRole('navigation', { name: 'Glavna navigacija' })

    await screen.findByRole('link', { name: /^Administracija/ })

    expect(navigation.style.getPropertyValue('--cells')).toBe(String(within(navigation).getAllByRole('link').length))
    expect(navigation.style.getPropertyValue('--cells')).toBe('6')
  }, SLOW)
})

describe('the shape of the header, as the window changes', () => {
  it('follows a window that crosses the width, and stops listening when it is gone', async () => {
    const listening = new Set<() => void>()
    let phone = false

    window.matchMedia = (query: string) => ({
      matches: query === PHONE_HEADER && phone,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function' && query === PHONE_HEADER) {
          listening.add(() => listener(new Event('change')))
        }
      },
      removeEventListener: () => {
        listening.clear()
      },
      dispatchEvent: () => true,
    })

    const { unmount } = renderAt('/sr', 'competitor', '000007')

    await screen.findByRole('button', { name: 'Otvori nalog' })

    const navigation = () => screen.getByRole('navigation', { name: 'Glavna navigacija' })

    expect(within(navigation()).getAllByRole('link')[0]?.querySelector('svg')).toBeNull()
    expect(listening.size).toBeGreaterThan(0)

    phone = true
    act(() => {
      for (const changed of listening) {
        changed()
      }
    })

    await waitFor(() => {
      expect(within(navigation()).getAllByRole('link')[0]?.querySelector('svg')).not.toBeNull()
    })
    /* And the picture has gone down into the row, after the words: the document followed the window. */
    expect((await tabbedThrough()).at(-1)).toBe('Otvori nalog')

    unmount()

    expect(listening.size).toBe(0)
  }, SLOW)
})
