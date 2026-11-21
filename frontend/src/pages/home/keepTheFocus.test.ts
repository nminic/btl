import { putBack, whereIs } from './keepTheFocus'

/**
 * WHAT `keepTheFocus.ts` REMEMBERS AND WHERE IT PUTS THE FOCUS (owner, 21.11.2026; reviews of the front page).
 *
 * The cases that go through the whole page are in `pages/frontPageOrder.test.tsx`. These are the ones of the
 * module on its own, which the page cannot ask for: a box with no labelled section, a box that is gone, and a
 * focus that was never lost.
 */

function page(html: string): void {
  document.body.innerHTML = html
}

function the(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector)

  if (found === null) {
    throw new Error(`no ${selector}`)
  }

  return found
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('whereIs', () => {
  it('says nothing for a thing outside every box that is written again', () => {
    page('<div class="home__calc"><input id="a"></div><button id="b">x</button>')

    expect(whereIs(the('#a'))).toBeNull()
    expect(whereIs(the('#b'))).toBeNull()
  })

  it('says the box, the heading of the section it stood in, and what the thing was', () => {
    page(
      '<div class="home__next"><section aria-labelledby="h"><h2 id="h">Naslov</h2><a href="/x" aria-label="Ime">tekst</a></section></div>',
    )

    expect(whereIs(the('a'))).toEqual({ box: 'next', heading: 'h', identity: 'A|/x|Ime|tekst' })
  })

  it('has no heading where the box has no labelled section', () => {
    page('<div class="home__address"><button>Reč</button></div>')

    expect(whereIs(the('button'))).toEqual({ box: 'address', heading: null, identity: 'BUTTON|||Reč' })
  })
})

describe('putBack', () => {
  const was = { box: 'next', heading: 'h', identity: 'BUTTON|||Ultra' }
  const widget = (buttons: string) =>
    `<div class="home__next"><section aria-labelledby="h"><h2 id="h">Naslov</h2>${buttons}</section></div>`

  it('does nothing when there was nowhere to put it back', () => {
    page(widget('<button>Ultra</button>'))

    putBack(document, null)

    expect(document.body).toHaveFocus()
  })

  it('does not take the focus from where somebody has put it since', () => {
    page(`${widget('<button>Ultra</button>')}<button id="other">drugo</button>`)
    the('#other').focus()

    putBack(document, was)

    expect(the('#other')).toHaveFocus()
  })

  it('puts it on the same thing, not on the one at the same place', () => {
    page(widget('<button>Sve</button><button>Ultra</button><button>Duge</button>'))

    putBack(document, was)

    expect(document.activeElement?.textContent).toBe('Ultra')
  })

  it('puts it on the heading of the widget where the thing is not there, and no other', () => {
    page(widget('<button>Sve</button><button>Duge</button>'))

    putBack(document, was)

    expect(the('h2')).toHaveFocus()
    expect(the('h2')).toHaveAttribute('tabindex', '-1')
  })

  it('looks for the thing in the box where the section has no heading', () => {
    page('<div class="home__address"><a href="/p">pravilnik</a></div>')

    putBack(document, { box: 'address', heading: null, identity: 'A|/p||pravilnik' })

    expect(the('a')).toHaveFocus()
  })

  it('puts it on the box itself where the widget has no heading and the thing is gone', () => {
    page('<div class="home__chart"><a href="/q">drugi</a></div>')

    putBack(document, { box: 'chart', heading: null, identity: 'A|/p||pravilnik' })

    expect(the('.home__chart')).toHaveFocus()
  })

  it('does nothing when the box itself is not on the page', () => {
    page('<button>x</button>')

    putBack(document, { box: 'sponsor', heading: null, identity: 'A|/p||s' })

    expect(document.body).toHaveFocus()
  })

  it('falls back to the box when the heading it remembers is gone', () => {
    page('<div class="home__next"><button>Duge</button></div>')

    putBack(document, was)

    expect(the('.home__next')).toHaveFocus()
  })
})
