import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import { NO_RATING, type Race, type ServedPendingItem } from '../../data/types'
import sr from '../../i18n/sr.json'
import { at, must } from '../../test/at'
import { moderatorWith, renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { everyRule } from '../../test/stylesheet'
import { QUEUE } from './queues'

/**
 * FIVE SMALL FAULTS OF THE ADMINISTRATION, FOUND BY THE UX SURVEY OF 28.11.2026 over the screens as they
 * stand, each held here at the two places it can come apart: the RULE of the stylesheet (read as text, because
 * jsdom lays nothing out and draws no sheet) and the ELEMENT the screen really draws, which has to wear what
 * the rule names. A rule nobody wears and a class nobody writes a rule for pass every case that asks only
 * one of the two, which is why each block below asks both. What Chrome says about where things stand is
 * `geometry/adminFlaws.geometry.ts`.
 *
 * 1. The names of the moderators are never broken inside a word (PDL, 20.10.2026: „Imena i nazivi trka se
 *    nikad ne lome usred reči"); the address may be.
 * 2. The description of a proposed team is dressed as the boxes beside it.
 * 3. The member number on the screen of payments stands under the name.
 * 4. The screen of the moderator's entry of results keeps its name for a reader and draws none (PDL P21,
 *    30.07.2026: „Nijedan administrativni ekran nema vidljiv naslov ni objašnjenje iznad posla").
 * 5. The column of the member in the queue of results holds the name and the number (owner, 28.11.2026, O6:
 *    „kolona Član nosi ime i broj; ime se ne skraćuje").
 *
 * **The axes of every case are not one value:** the moderators are served with a surname that is one word
 * and a double barrelled one; the queue of results with three members, one of them unknown to every list
 * the portal holds and one that names nobody; the signed in reader is a number none of the runs has.
 */

const read = (path: string): string => readFileSync(join(process.cwd(), 'src', path), 'utf-8')

/** The last compound of each selector of a rule: the part that names the element it styles. */
const subjectsOf = (selectors: string): string[] =>
  selectors.split(',').map((one) => must(one.trim().split(/\s*[\s>+~]\s*/).pop(), 'a selector'))

describe('the names of the moderators', () => {
  const css = read('pages/admin/Rights.css')

  it('are broken inside a word by no rule of the sheet of the list, and only the address is, by a rule that names it', () => {
    const breaking = everyRule(css, 'Rights.css').filter(
      (rule) =>
        rule.selectorText.includes('.moderators') &&
        (/overflow-wrap\s*:\s*(anywhere|break-word)/.test(rule.cssText) || /word-break\s*:\s*(break-all|break-word)/.test(rule.cssText)),
    )

    expect(breaking.length, 'a rule that lets the address break, which is the one cell that must').toBeGreaterThan(0)

    for (const rule of breaking) {
      expect(subjectsOf(rule.selectorText), `${rule.selectorText} breaks more than the address`).toEqual([
        '.moderators__email',
      ])
    }
  })

  it('stand in cells that wear no class of the address, and the address stands in the one that does', async () => {
    clearResourceCache()
    renderAt('/sr/administracija/moderatori', 'superadmin')

    const table = await screen.findByRole('table', { name: sr.admin.moderators })
    const rows = within(table).getAllByRole('row').slice(1)

    expect(rows.length).toBeGreaterThan(2)

    for (const row of rows) {
      const [first, last, address] = within(row).getAllByRole('cell')

      expect(must(first, 'the given name').className).toBe('')
      expect(must(last, 'the surname').className).toBe('')
      expect(must(address, 'the address').classList.contains('moderators__email')).toBe(true)
      expect(must(address, 'the address').textContent).toContain('@')
    }
  }, SLOW)
})

describe('the description of a proposed team', () => {
  const css = read('pages/Rankings.css')

  it('is dressed by the rule that dresses the input and the select of a field of the portal, in the tokens of a control', () => {
    const dressing = everyRule(css, 'Rankings.css').filter((rule) =>
      subjectsOf(rule.selectorText).includes('input') && rule.selectorText.includes('.rankings__field input'),
    )

    expect(dressing.length, 'the rule that dresses a control of a field').toBe(1)

    const rule = must(dressing[0], 'the rule')
    const selectors = rule.selectorText.split(',').map((one) => one.trim())

    expect(selectors).toContain('.rankings__field textarea')
    expect(selectors).toContain('.rankings__field select')
    /* The edge of a CONTROL and the ground of a SURFACE: the two tokens the boxes beside it wear
       (`styles/tokens.css`), and not the edge of a card (`--border`). */
    expect(rule.style.getPropertyValue('border')).toContain('var(--control-border)')
    expect(rule.style.getPropertyValue('background')).toBe('var(--surface)')
    expect(rule.style.getPropertyValue('font')).toBe('inherit')
  })

  it('stands in a field of the portal beside the boxes it is dressed like, on every proposal of the queue', async () => {
    clearResourceCache()
    renderAt(`/sr/${QUEUE.teams.path}`, 'superadmin')

    const boxes = await screen.findAllByLabelText(/^Opis tima/)

    expect(boxes.length).toBeGreaterThan(1)

    for (const box of boxes) {
      expect(box.tagName).toBe('TEXTAREA')

      const field = must(box.closest('.rankings__field'), 'the field the description stands in')
      const name = must(field.parentElement?.querySelector('input[type="text"]'), 'the box of the name')

      expect(name.closest('.rankings__field')).not.toBeNull()
    }
  }, SLOW)
})

describe('the member number on the screen of payments', () => {
  const css = read('pages/admin/Activation.css')

  it('stands in a block of its own, by a rule written for the table of this screen', () => {
    const rules = everyRule(css, 'Activation.css').filter((rule) => rule.selectorText === '.activate .table__member-number')

    expect(rules.length, 'the rule that puts the number under the name').toBe(1)
    expect(must(rules[0], 'the rule').style.getPropertyValue('display')).toBe('block')
  })

  it('is the span the rule names, inside the table the rule names, after the name and never in its place', async () => {
    clearResourceCache()
    renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

    const table = await screen.findByRole('table', { name: sr.verification.payments })
    const numbered = within(table).getAllByText(/^0000\d\d$/)

    expect(numbered.length).toBeGreaterThan(0)

    for (const number of numbered) {
      expect(number.className).toContain('table__member-number')
      expect(number.closest('table')?.classList.contains('activate')).toBe(true)

      const cell = must(number.closest('td'), 'the cell')

      expect(cell.firstChild).not.toBe(number)
      expect(cell.lastChild).toBe(number)
    }
  }, SLOW)
})

describe('the entry of results of the moderator', () => {
  const EVENT = 'maraton-maratona-2015'
  const racesOfEvent = (): number[] => {
    const events: { id: number; slug: string }[] = JSON.parse(read('test/mock/events.json'))
    const races: Race[] = JSON.parse(read('test/mock/races.json'))
    const id = must(events.find((one) => one.slug === EVENT)?.id, 'the event')

    return races.filter((one) => one.eventId === id).map((one) => one.id)
  }

  it('keeps its name for a reader of the screen and draws none', async () => {
    renderAt('/sr/administracija/unos-rezultata', 'moderator', null, moderatorWith(['queue:results']))

    const heading = await screen.findByRole('heading', { level: 1, name: sr.leagueResults.forAnEvent })

    expect(heading.classList.contains('visually-hidden')).toBe(true)
  }, SLOW)

  it('and the entry on the page of an event, which is no screen of the administration, draws its title', async () => {
    renderAt(
      `/sr/kalendar/${EVENT}/rezultati?trka=${String(at(racesOfEvent(), 3))}`,
      'moderator',
      null,
      moderatorWith(['queue:results']),
    )

    const heading = await screen.findByRole('heading', { level: 1, name: /^Unos rezultata: / })

    expect(heading.classList.contains('visually-hidden')).toBe(false)
  }, SLOW)
})

describe('the member of a run in the queue of results', () => {
  const css = read('pages/admin/Verification.css')

  const A_RUN = {
    queue: 'results' as const,
    subjectId: '',
    city: '',
    country: '',
    photoId: null,
    crop: null,
    rating: NO_RATING,
    kind: '' as const,
    date: '2027-03-08',
    body: '',
    raceId: 11,
    raceDate: '2027-03-06',
    raceKind: 'length' as const,
    distanceKm: 10,
    ascentM: 50,
    descentM: 40,
    seconds: 3300,
    link: '',
    eventId: null,
    eventName: null,
    eventKind: null,
  }

  /** Three members, none of them the one signed in (000001), and none of them in any list of the portal. */
  const RUNS: ServedPendingItem[] = [
    { ...A_RUN, id: 801, memberNumber: '000701', who: 'Zvezdana Zvezdić', subject: 'Beogradska desetka' },
    { ...A_RUN, id: 802, memberNumber: '000702', who: 'Konstantin Karađorđević-Obrenović', subject: 'Šestočasovna' },
    { ...A_RUN, id: 803, memberNumber: '000703', who: '', subject: 'Brdska trka' },
  ]

  it('is a name over a number, each in a block of its own, by two rules written for this column', () => {
    const rules = everyRule(css, 'Verification.css').filter((rule) => subjectsOf(rule.selectorText).includes('.review__who'))

    expect(rules.length).toBe(1)

    const rule = must(rules[0], 'the rule')

    expect(rule.selectorText.split(',').map((one) => one.trim())).toContain('.review__member .table__member-number')
    expect(rule.style.getPropertyValue('display')).toBe('block')
    /* NEVER CUT: „ime se ne skraćuje". No rule of the sheet clips, hides or dots the name. */
    for (const one of everyRule(css, 'Verification.css').filter((each) => each.selectorText.includes('.review__who'))) {
      expect(one.cssText).not.toMatch(/text-overflow|overflow\s*:\s*hidden|-webkit-line-clamp|white-space\s*:\s*nowrap/)
    }
  })

  it('holds the name the row carries and the number, the name from the ROW and never from a list of members', async () => {
    clearResourceCache()

    const server = serverThat((path, init) =>
      path === '/api/verification' && (init?.method ?? 'GET') === 'GET'
        ? new Response(JSON.stringify(RUNS), { status: 200, headers: { 'content-type': 'application/json' } })
        : null,
    )

    try {
      renderAt(`/sr/${QUEUE.results.path}`, 'superadmin', '000001')

      const table = await screen.findByRole('table', { name: sr.review.waiting })
      const column = within(table)
        .getAllByRole('columnheader')
        .findIndex((one) => one.textContent === sr.competitors.columns.member)

      expect(column).toBeGreaterThanOrEqual(0)

      const cells = within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => at(within(row).getAllByRole('cell'), column))

      expect(cells).toHaveLength(3)

      const [first, second, nobody] = cells

      expect(must(first, 'the first member').querySelector('.review__who')?.textContent).toBe('Zvezdana Zvezdić')
      expect(must(first, 'the first member').querySelector('.table__member-number')?.textContent).toBe('000701')
      expect(must(second, 'the second member').querySelector('.review__who')?.textContent).toBe(
        'Konstantin Karađorđević-Obrenović',
      )
      expect(must(second, 'the second member').querySelector('.table__member-number')?.textContent).toBe('000702')

      /* A row naming nobody has the number alone, and no empty block where a name would stand. */
      expect(must(nobody, 'the row of nobody').querySelector('.review__who')).toBeNull()
      expect(must(nobody, 'the row of nobody').querySelector('.table__member-number')?.textContent).toBe('000703')

      for (const cell of cells) {
        expect(must(cell, 'a cell').classList.contains('review__member')).toBe(true)
      }
    } finally {
      server.stop()
    }

  }, SLOW)
})
