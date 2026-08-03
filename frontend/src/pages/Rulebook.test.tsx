import { act, screen, waitFor, within } from '@testing-library/react'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

const TITLE = 'Pravilnik takmičenja BTL 2027'

async function openRulebook() {
  const view = renderAt('/sr/pravilnik')
  await screen.findByRole('heading', { level: 1, name: TITLE })

  return view
}

function sideNavigation(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Na ovoj strani' })
}

describe('the rulebook', () => {
  it('writes out the rulebook of the season, not an announcement of one', async () => {
    await openRulebook()

    expect(screen.getByRole('heading', { level: 2, name: '5. Šta se boduje' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: /Član 28. Bodovanje/ })).toBeVisible()
  })

  /* The formula is not published, and the rulebook is a public page, so it is
     not in the rulebook either (owner, 31.07.2026). What is left is what the
     scoring does, in words: longer and harder is worth more, faster is worth
     more, and a metre of climb is worth more than a metre of descent. */
  it('says what the scoring does without saying how, and without calling it a secret', async () => {
    /* The formula stays public and the rulebook neither hides it nor sets it
       out (owner, 03.08.2026, PDL P11). It cannot be hidden: the calculator on
       the front page has computed it in the browser since the day it arrived,
       so "the formula is not published" was a sentence the portal itself
       contradicted. What the rulebook owes a member is what is scored and that
       longer and harder races are worth more. */
    await openRulebook()

    const printed = document.body.textContent ?? ''

    expect(printed).not.toMatch(/ne objavljuje|tajn/i)
    expect(printed).toMatch(/nosi više bodova/)

    /* Not set out either. Not because it is a secret but because a rulebook is
       read by somebody asking what counts, and three exponents answer a question
       nobody asked. */
    expect(printed).not.toContain('3.257')
    expect(printed).not.toContain('2.137')
    expect(printed).not.toContain('1.25')
  })

  /* The example under the article used to give the effective length of a race
     and four pairs of time and points for one course, and that is the formula in
     another shape: the effective length against the raw length fixes the weights
     of climb and descent exactly, and any two pairs give both exponents. One
     pair leaves the system underdetermined, which is what an example is for.

     Kept after the formula stopped being called a secret, for a different
     reason: a rulebook that hands over enough to reconstruct the arithmetic is
     presenting it, and the owner asked that it not be presented. */
  it('gives an example that cannot be solved backwards', async () => {
    await openRulebook()

    const printed = document.body.textContent ?? ''

    // The effective length is the one number that hands over the weights.
    expect(printed).not.toContain('95,41875')
    // And one pair of time and points, not four.
    expect(printed).toContain('79,03')
    expect(printed).not.toContain('46,78')
    expect(printed).not.toContain('38,94')
  })

  it('lists every section beside the text', async () => {
    await openRulebook()

    const links = within(sideNavigation()).getAllByRole('link')
    const sections = screen.getAllByRole('heading', { level: 2 })

    expect(links).toHaveLength(sections.length)
    expect(links[0]).toHaveAccessibleName('1. Uvodne odredbe')
  })

  it('leads from a link to the section it names', async () => {
    await openRulebook()

    const link = within(sideNavigation()).getByRole('link', { name: '9. Takmičarske kategorije' })
    const target = document.getElementById('9-takmicarske-kategorije')

    expect(link).toHaveAttribute('href', '#9-takmicarske-kategorije')
    expect(target).not.toBeNull()
    expect(within(target as HTMLElement).getByRole('heading', { level: 2 })).toHaveTextContent(
      '9. Takmičarske kategorije',
    )
  })

  it('opens and closes the list of sections on a phone', async () => {
    const user = setupUser()
    await openRulebook()

    const button = screen.getByRole('button', { name: 'Sekcije pravilnika' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    // Following a section closes the list again, so the text is not left under
    // a panel the reader has to dismiss by hand.
    await user.click(within(sideNavigation()).getByRole('link', { name: '1. Uvodne odredbe' }))
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('marks the first section where the browser cannot say which one is on screen', async () => {
    await openRulebook()

    // The mark is set from an effect, one render after the text arrives.
    expect(await screen.findByRole('link', { current: 'location' })).toHaveAccessibleName(
      '1. Uvodne odredbe',
    )
  })
})

/* The reading position comes from an observer the browser provides and jsdom
 * does not, so it is stood in for here. */
describe('the section being read', () => {
  let watch: IntersectionObserverCallback | undefined
  let disconnected = false

  class FakeObserver {
    constructor(callback: IntersectionObserverCallback) {
      watch = callback
    }

    observe() {}

    disconnect() {
      disconnected = true
    }
  }

  /* The watching starts in an effect, which React runs a beat after the text
     appears, so every test waits for it before it says what is on screen. */
  async function announce(entries: { target: Element; isIntersecting: boolean }[]) {
    await waitFor(() => {
      expect(watch).toBeDefined()
    })

    act(() => {
      ;(watch as IntersectionObserverCallback)(
        entries as unknown as IntersectionObserverEntry[],
        null as never,
      )
    })
  }

  beforeEach(() => {
    disconnected = false
    watch = undefined
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: FakeObserver,
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'IntersectionObserver')
  })

  it('is marked in the side navigation, and not by colour alone', async () => {
    await openRulebook()

    const third = document.getElementById('3-ko-se-takmici') as HTMLElement
    const fourth = document.getElementById('4-clanarina') as HTMLElement

    await announce([
      { target: third, isIntersecting: true },
      { target: fourth, isIntersecting: true },
    ])

    // Two sections can share the screen; the higher one is the one being read.
    expect(screen.getByRole('link', { current: 'location' })).toHaveAccessibleName(
      '3. Ko se takmiči',
    )

    await announce([{ target: third, isIntersecting: false }])

    expect(screen.getByRole('link', { current: 'location' })).toHaveAccessibleName('4. Članarina')
  })

  it('stays where it was between two sections', async () => {
    await openRulebook()

    const second = document.getElementById('2-sezona-i-rokovi') as HTMLElement

    await announce([{ target: second, isIntersecting: true }])
    await announce([{ target: second, isIntersecting: false }])

    expect(screen.getByRole('link', { current: 'location' })).toHaveAccessibleName(
      '2. Sezona i rokovi',
    )
  })

  it('stops watching when the screen closes', async () => {
    const view = await openRulebook()
    await waitFor(() => {
      expect(watch).toBeDefined()
    })

    view.unmount()

    expect(disconnected).toBe(true)
  })
})

/* A written page may take in another one, and the rulebook is a written page:
 * an administrator who adds `includes` to it is told by the list of pages that
 * the text has been taken in (AdminPages), so the rulebook has to draw it. It
 * used to read its own sections and nothing else, so the two screens disagreed
 * about one record and neither said which was right. */
describe('the rulebook that takes in another page', () => {
  const original = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = original
  })

  /** The real files, except for the written pages, which this test writes. */
  function serve(pages: unknown) {
    globalThis.fetch = ((input: RequestInfo | URL) =>
      String(input).endsWith('pages.json')
        ? Promise.resolve(
            new Response(JSON.stringify(pages), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          )
        : original(input)) as typeof fetch
  }

  it('draws what it takes in above its own sections, and lists it too', async () => {
    serve({
      pravilnik: {
        title: TITLE,
        includes: ['rec-predsednika'],
        sections: [{ heading: '1. Uvodne odredbe', body: 'Sopstveni tekst.' }],
      },
      'rec-predsednika': {
        title: 'Reč predsednika',
        sections: [{ heading: 'Reč predsednika', body: 'Preuzeti tekst.' }],
      },
    })

    renderAt('/sr/pravilnik')
    await screen.findByRole('heading', { level: 1, name: TITLE })

    // What is taken in stands first, because a foreword is a foreword, and the
    // side navigation counts it like any other section.
    expect(screen.getByText('Preuzeti tekst.')).toBeVisible()
    expect(
      within(sideNavigation())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Reč predsednika', '1. Uvodne odredbe'])
  })

  it('says the page is not there when the text is missing', async () => {
    serve({})

    renderAt('/sr/pravilnik')

    expect(await screen.findByRole('heading', { name: 'Ove strane nema' })).toBeVisible()
  })

  it('says so when the text cannot be loaded', async () => {
    globalThis.fetch = (async () => new Response('nema', { status: 500 })) as typeof fetch

    renderAt('/sr/pravilnik')

    expect(await screen.findByRole('alert')).toBeVisible()
  })
})
