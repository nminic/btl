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
    expect(screen.getByRole('heading', { level: 3, name: /Član 28. Formula/ })).toBeVisible()
    // The formula is the one thing in here that may not be paraphrased.
    expect(screen.getByText('BTL = (40 × Le)^3.257 / (2 × Tsec^2.137)')).toBeVisible()
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
