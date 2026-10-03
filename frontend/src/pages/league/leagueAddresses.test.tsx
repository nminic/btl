import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, onTestFinished, vi } from 'vitest'
import type { League } from '../../data/types'
import { at, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { everyRule } from '../../test/stylesheet'
import { setupUser } from '../../test/user'

/**
 * An address in the terms or in the prizes of a competition, on the list of competitions.
 *
 * The owner, 03.10.2026 (PDL P15, chosen among the options offered): „Adresa u Propozicijama i
 * Nagradama svake lige postaje veza. Svaka adresa koja počinje sa `www.` ili `https://` otvara se u
 * novom prozoru, sa vidljivim domenom, isto kao veza uz opis događaja (27.08.2026)." Which words are
 * addresses is held beside the function that says so (`addressesIn.test.ts`); what is held here is
 * what the screen does with the answer.
 *
 * **Served rather than read from the generated files.** Nothing in `leagues.json` carries an
 * address, so every question about one read off the file would have the same answer whether the
 * screen draws links or not. The three competitions below are served in front of the disc reader
 * (`test/serverAnswers.ts`), and each box of each holds something that no other box holds: a link
 * that comes out of the wrong box, the wrong competition or the wrong text has an `href` that does
 * not belong to the words beside it.
 */
const RUNTRACE_RULES = 'Vreme na svim trkama meri portal www.runtrace.net i na kojima se boduje.'
const RUNTRACE_PRIZES = 'Detalji: https://nagrade.example/runtrace.'
/* In brackets, and between blanks that are part of what was typed: the terms of a competition are
   typed into a box that keeps what is put in it, and what is drawn must not be a trimmed copy. */
const PLANINSKA_PRIZES = '  (www.planina.example/nagrade)\n'
/* Words that look like addresses to somebody in a hurry and are none of them: `http://` is not one
   of the two forms, a bracket nobody closed is an address a browser refuses, and `javascript:` is
   what the gate exists to keep off an `href`. */
const BRDSKA_RULES = 'Vidi http://stara.example/pravila i https://[::1 i javascript:alert(1) dalje.'
/* And text that looks like markup, which is text. */
const BRDSKA_PRIZES =
  '<b>Medalje</b> [tekst](https://x.example) <https://y.example> <a href="https://z.example">z</a>'

const league = (id: number, name: string, rules: string, prizes: string): League => ({
  id,
  slug: `proba-${id}`,
  name,
  season: 2027,
  raceIds: [],
  eventIds: [],
  rules,
  prizes,
})

const LEAGUES = [
  league(1, 'Proba RunTrace', RUNTRACE_RULES, RUNTRACE_PRIZES),
  league(2, 'Proba Planinska', '', PLANINSKA_PRIZES),
  league(3, 'Proba Brdska', BRDSKA_RULES, BRDSKA_PRIZES),
]

/**
 * WHAT REACT SAYS ABOUT THE KEYS OF WHAT WAS DRAWN, heard in every case of this file and not in one
 * of them.
 *
 * **Measured with a mutation on 03.10.2026, and it is why this is not inside the case about the
 * same address twice.** React gives the warning „Each child in a list should have a unique "key"
 * prop" once for a component and then goes quiet about it for the rest of the file, so a watch put
 * in a case that comes late hears nothing: the links of the cases before it had used the warning
 * up. With the key taken off the link every case stayed green. Heard from the first case on, the
 * first link that is drawn is where it is said.
 */
const SAID_BY_REACT: unknown[][] = []

beforeEach(() => {
  SAID_BY_REACT.length = 0
  vi.spyOn(console, 'error').mockImplementation((...said: unknown[]) => {
    SAID_BY_REACT.push(said)
  })
})

afterEach(() => {
  vi.mocked(console.error).mockRestore()

  /* `soft`, because with a plain `expect` here the case after a failing one ran out of its twenty
     seconds: measured with the mutation that takes the key off the link, 24 seconds and two failures
     against 4 seconds and one. The likely reason, not measured, is that a hook that throws stops the
     hooks after it, and the clean-up of the screen is one of them. */
  expect
    .soft(
      SAID_BY_REACT.filter(([first]) => String(first).includes('key')),
      'React spoke about the keys of what was drawn',
    )
    .toEqual([])
})

/**
 * A server in front of the disc reader that answers `GET /api/leagues` with the competitions it is
 * given, and the write of one box with what it is told to, for the length of one case.
 */
function serving(leagues: League[], toTheWrite: () => Response = () => answeredWith(200)) {
  const server = serverThat((path, init) => {
    const method = init?.method ?? 'GET'

    if (path === '/api/leagues' && method === 'GET') {
      return new Response(JSON.stringify(leagues), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    return method === 'PUT' && path.startsWith('/api/leagues/') ? toTheWrite() : null
  })

  onTestFinished(server.stop)

  return server
}

/** The box of one competition: the list draws several, and a question put to the screen would be
 *  answered by whichever one came first. */
const boxOf = async (name: RegExp): Promise<HTMLElement> =>
  must(
    (await screen.findByRole('heading', { level: 2, name })).closest('li'),
    'the box of the competition',
  )

/** One of the two sections of a box, by the heading it is read under. */
const sectionOf = (box: HTMLElement, heading: 'Propozicije' | 'Nagrade') =>
  within(must(within(box).getByRole('heading', { name: heading }).closest('section'), 'the section'))

describe('an address in the terms or in the prizes of a competition', () => {
  it.each(['visitor', 'superadmin'] as const)(
    'is a link in the box of the competition it was written in, drawn as it was typed, for a %s',
    async (role) => {
      serving(LEAGUES)
      renderAt('/sr/lige?sezona=2027', role)

      const runtrace = await boxOf(/Proba RunTrace/)
      const rules = sectionOf(runtrace, 'Propozicije')
      const prizes = sectionOf(runtrace, 'Nagrade')

      /* `www.` is drawn as typed and leads to the same address under https. */
      expect(rules.getAllByRole('link')).toHaveLength(1)
      expect(rules.getByRole('link')).toHaveAccessibleName('www.runtrace.net')
      expect(rules.getByRole('link')).toHaveAttribute('href', 'https://www.runtrace.net')
      /* And the words around it are the words that were written, down to the full stop. */
      expect(rules.getByRole('paragraph').textContent).toBe(RUNTRACE_RULES)

      /* `https://` leads to itself, and the full stop of the sentence is not in the address. */
      expect(prizes.getAllByRole('link')).toHaveLength(1)
      expect(prizes.getByRole('link')).toHaveAccessibleName('https://nagrade.example/runtrace')
      expect(prizes.getByRole('link')).toHaveAttribute('href', 'https://nagrade.example/runtrace')
      expect(prizes.getByRole('paragraph').textContent).toBe(RUNTRACE_PRIZES)

      /* The second competition, whose terms are empty and whose prizes sit in brackets and blanks. */
      const planinska = await boxOf(/Proba Planinska/)
      const bracketed = sectionOf(planinska, 'Nagrade')

      expect(bracketed.getAllByRole('link')).toHaveLength(1)
      expect(bracketed.getByRole('link')).toHaveAccessibleName('www.planina.example/nagrade')
      expect(bracketed.getByRole('link')).toHaveAttribute(
        'href',
        'https://www.planina.example/nagrade',
      )
      expect(bracketed.getByRole('paragraph').textContent).toBe(PLANINSKA_PRIZES)

      /* Nothing written in the terms is a link in neither of the two, and to somebody who may write
         it the box is still there, and so is the control that opens it, beside a link that was
         drawn all the same. */
      if (role === 'superadmin') {
        expect(sectionOf(planinska, 'Propozicije').queryAllByRole('link')).toEqual([])
        expect(sectionOf(planinska, 'Propozicije').getByText('Još nije napisano.')).toBeVisible()
        expect(rules.getByRole('button', { name: 'Izmeni' })).toBeVisible()
      } else {
        expect(within(planinska).queryByRole('heading', { name: 'Propozicije' })).toBeNull()
      }
    },
    SLOW,
  )

  it('opens in a window of its own and tells the other end nothing about where it came from', async () => {
    serving(LEAGUES)
    renderAt('/sr/lige?sezona=2027')

    const runtrace = await boxOf(/Proba RunTrace/)
    const found = [
      sectionOf(runtrace, 'Propozicije'),
      sectionOf(runtrace, 'Nagrade'),
      sectionOf(await boxOf(/Proba Planinska/), 'Nagrade'),
    ].flatMap((section) => section.getAllByRole('link'))

    /* Three boxes, three addresses: a sweep that found nothing would pass every line below it. */
    expect(found).toHaveLength(3)

    for (const one of found) {
      /* `noreferrer` so the address of this page does not travel to a host somebody else chose,
         `noopener` for `window.opener`. Written out rather than left to what browsers do for
         `target="_blank"`, because a rule that depends on a default is a rule nobody can read; the
         event's page holds the same two (`pages/details.test.tsx`). */
      expect(one).toHaveAttribute('target', '_blank')
      expect(one).toHaveAttribute('rel', 'noreferrer noopener')
    }
  }, SLOW)

  it('is not made of words that only look like one, and the text stays as it was written', async () => {
    serving(LEAGUES)
    renderAt('/sr/lige?sezona=2027')

    const brdska = await boxOf(/Proba Brdska/)

    for (const [heading, written] of [
      ['Propozicije', BRDSKA_RULES],
      ['Nagrade', BRDSKA_PRIZES],
    ] as const) {
      const section = sectionOf(brdska, heading)
      const paragraph = section.getByRole('paragraph')

      /* No link, and the words are on the page: what is measured is the link being refused, and not
         the whole of the text going with it (`pages/details.test.tsx`, the organiser's page). */
      expect(section.queryAllByRole('link'), heading).toEqual([])
      expect(paragraph.textContent, heading).toBe(written)
      /* One text node and no element at all: `<b>` and `<a href>` typed into a box are letters on the
         screen, and a text with no address is drawn as the one text node it always was. */
      expect(paragraph.children, heading).toHaveLength(0)
      expect(paragraph.childNodes, heading).toHaveLength(1)
      expect(at(Array.from(paragraph.childNodes), 0).nodeType, heading).toBe(Node.TEXT_NODE)
    }
  }, SLOW)

  it('draws the same address twice as two links', async () => {
    serving([league(1, 'Proba Dupla', 'www.runtrace.net pa opet www.runtrace.net', 'Nista.')])
    renderAt('/sr/lige?sezona=2027')

    const rules = sectionOf(await boxOf(/Proba Dupla/), 'Propozicije')

    /* Two links with the same words and the same `href`. A key taken from the address would be the
       same twice, and React says so in the warning that is heard after every case above. */
    expect(rules.getAllByRole('link')).toHaveLength(2)
    expect(rules.getAllByRole('link', { name: 'www.runtrace.net' })).toHaveLength(2)
  }, SLOW)

  it('is drawn from what stands in the box and not from what was served, and the box being written holds the typed words', async () => {
    const user = setupUser()
    const server = serving(LEAGUES)

    renderAt('/sr/lige?sezona=2027', 'superadmin')

    const rules = sectionOf(await boxOf(/Proba RunTrace/), 'Propozicije')

    await user.click(rules.getByRole('button', { name: 'Izmeni' }))

    /* The words as they were typed and stored, `www.` and all: what the box is changed through is
       never the drawn text. */
    const typing = rules.getByRole('textbox', { name: 'Propozicije' })

    expect(typing).toHaveValue(RUNTRACE_RULES)
    expect(rules.queryAllByRole('link')).toEqual([])

    await user.clear(typing)
    await user.type(typing, 'Sad pogledajte www.nova.example.')
    await user.tab()

    /* Waited for the thing that says the write is over, and not for the link itself: a link that
       never comes would be waited for until the case ran out of time, and a case that ends by
       running out of time says nothing about what was wrong. With the box drawn from what was
       served and not from what stands in it, the note arrives all the same and the link below is
       asked for at once, and not there. */
    await rules.findByRole('status')

    /* Another address, so that "the link it was served with" and "the link it now has" are two
       different answers, and the old one is gone. */
    const now = rules.getByRole('link', { name: 'www.nova.example' })

    expect(now).toHaveAttribute('href', 'https://www.nova.example')
    expect(rules.queryByRole('link', { name: 'www.runtrace.net' })).toBeNull()
    expect(rules.getByRole('paragraph').textContent).toBe('Sad pogledajte www.nova.example.')

    /* And what went to the server is the typed text, not the address it was made into. */
    const sent = must(
      server.asked.find((one) => one.init?.method === 'PUT'),
      'the change the screen sent',
    )

    expect(JSON.parse(String(sent.init?.body))).toMatchObject({
      rules: 'Sad pogledajte www.nova.example.',
      prizes: RUNTRACE_PRIZES,
    })
  }, SLOW)

  it('draws no link in the sentence the portal says for a box with nothing written in it', async () => {
    serving(LEAGUES)
    renderAt('/sr/lige?sezona=2027', 'superadmin')

    const empty = sectionOf(await boxOf(/Proba Planinska/), 'Propozicije')
    const paragraph = empty.getByRole('paragraph')

    expect(paragraph).toHaveTextContent('Još nije napisano.')
    expect(paragraph.children).toHaveLength(0)
    expect(empty.queryAllByRole('link')).toEqual([])
  }, SLOW)
})

/**
 * Where a link in these two boxes keeps its underline.
 *
 * **Measured on 03.10.2026, and it is why this is held at all.** The words of these boxes are the
 * muted grey of `.profile__text` and a link is `--accent`: the two differ by 1,16:1 on the light
 * palette and 1,40:1 on the dark one (computed from `tokens.css`), against the 3:1 that WCAG 2.2
 * SC 1.4.1 asks of a distinction made by colour alone. The accent against the card is 8,97:1 and
 * 5,65:1, so the link can be read; it cannot be told from the words around it except by the line
 * under it, which nothing here writes and the browser draws by default. So a rule anywhere in the
 * portal that takes it away from a link in this box takes the only thing that tells it from the
 * words.
 *
 * **Asked of the real element and of every sheet the portal has.** One bundle carries every sheet
 * to every screen, so a rule written for another screen reaches this one if its selector does.
 * jsdom computes no cascade (ADL A18), but it does answer `matches`, and that is the question that
 * matters: whether the selector of a rule that says something other than „underline" about the
 * decoration of text reaches the link this screen drew.
 */
describe('a link in the words of an organiser', () => {
  const SRC = join(process.cwd(), 'src')

  /** Every stylesheet the portal has, found rather than listed. */
  function everySheet(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? everySheet(join(dir, entry.name))
        : entry.name.endsWith('.css')
          ? [join(dir, entry.name)]
          : [],
    )
  }

  /** The rules of one sheet that say something about the decoration of text other than that it is
   *  underlined, and whose selector reaches this element. */
  function takingTheLineAway(link: Element, css: string, named: string): string[] {
    return everyRule(css, named)
      .filter((rule) => {
        const said = rule.style.getPropertyValue('text-decoration')

        return said !== '' && !said.includes('underline')
      })
      .filter((rule) => link.matches(rule.selectorText))
      .map((rule) => `${named}: ${rule.selectorText}`)
  }

  async function aLinkOfTheTerms(): Promise<HTMLElement> {
    serving(LEAGUES)
    renderAt('/sr/lige?sezona=2027')

    return must(
      (await sectionOf(await boxOf(/Proba RunTrace/), 'Propozicije').findAllByRole('link'))[0],
      'the link in the terms of the first competition',
    )
  }

  it('keeps its underline, since no sheet of the portal reaches it with a rule that takes it away', async () => {
    const link = await aLinkOfTheTerms()
    const found = everySheet(SRC).map((path) => ({ path, css: readFileSync(path, 'utf-8') }))

    /* A floor under the sweep: the portal says something about the decoration of text in more than
       ten places, and a sweep that found none of them has looked at nothing. */
    expect(found.length).toBeGreaterThan(20)
    expect(
      found.flatMap(({ path, css }) =>
        everyRule(css, path).filter((rule) => rule.style.getPropertyValue('text-decoration') !== ''),
      ).length,
    ).toBeGreaterThan(10)

    expect(found.flatMap(({ path, css }) => takingTheLineAway(link, css, path))).toEqual([])
  }, SLOW)

  it('is a question that can be answered yes: a rule that takes the line off these links is found', async () => {
    const link = await aLinkOfTheTerms()

    /* Found for the rule written for exactly these links and for the one written for every link;
       and not for a rule about a link elsewhere, nor for one that keeps the line. */
    expect(
      takingTheLineAway(link, '.leagues__item .profile__text a { text-decoration: none; }', 'one'),
    ).toHaveLength(1)
    expect(takingTheLineAway(link, 'a { text-decoration: none; }', 'one')).toHaveLength(1)
    expect(takingTheLineAway(link, '.shell__link { text-decoration: none; }', 'one')).toEqual([])
    expect(
      takingTheLineAway(link, '.leagues__item .profile__text a { text-decoration: underline; }', 'one'),
    ).toEqual([])
  }, SLOW)
})
