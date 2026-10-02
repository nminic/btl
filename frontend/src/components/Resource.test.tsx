import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, screen } from '@testing-library/react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import en from '../i18n/en.json'
import sr from '../i18n/sr.json'
import type { ResourceState } from '../data/useResource'
import { aFailedRead } from '../test/failedRead'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import { Resource } from './Resource'

describe('Resource', () => {
  /* A sheet over the whole page, not a word where the content will be (owner,
     31.07.2026): a line of text reads as the answer, and the page under it is
     still there to be clicked a moment before the data lands. */
  it('covers the page while it waits, and says so out loud', () => {
    const state: ResourceState<string> = { status: 'loading' }
    const { container } = renderWithI18n(
      <Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Učitavanje')
    // The word is for a screen reader alone; what is seen is the sheet.
    expect(screen.getByText('Učitavanje')).toHaveClass('visually-hidden')
    expect(container.querySelector('.loader')).toBeInTheDocument()
  })

  it('shows nothing of the screen underneath while it waits', () => {
    const state: ResourceState<string> = { status: 'loading' }

    renderWithI18n(
      <Resource<string> state={state}>{() => <a href="/sr/kalendar">Kalendar</a>}</Resource>,
    )

    /* The children are not rendered at all, so there is nothing to click and
       nothing to tab to even if the sheet were somehow not there. The child
       ignores the data on purpose: one that printed it would render nothing
       while loading anyway, and the assertion could not fail. By text and not by
       role, because a sheet drawn over the content rather than instead of it
       would mark the content aria-hidden, which takes it out of a role query
       while leaving every link under it focusable and clickable. */
    expect(screen.queryByText('Kalendar')).not.toBeInTheDocument()
  })

  it('stands where a part of a screen will be, without covering the page', () => {
    const state: ResourceState<string> = { status: 'loading' }
    const { container } = renderWithI18n(
      <Resource<string> state={state} inline label="Trke">
        {(data) => <span>{data}</span>}
      </Resource>,
    )

    /* A part of a screen waiting must not hide the parts that have arrived:
       that is the whole reason it loads separately. It still says what it is
       waiting for, and now says which part. */
    expect(container.querySelector('.loader--inline')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Učitavanje: Trke')
  })

  it('leaves a part waiting where it stands, with no sheet over the page', () => {
    /* jsdom applies no stylesheet, so the one thing that decides whether the
       page is covered is read off disk, the way the tokens are (ADL A7). Drop
       any of these three and the inline form becomes a sheet again. */
    const css = readFileSync(join(process.cwd(), 'src/components/Loader.css'), 'utf-8')
    const rule = css.slice(css.indexOf('.loader--inline {'))

    expect(rule).toMatch(/position:\s*static/)
    expect(rule).toMatch(/background:\s*none/)
    expect(rule).toMatch(/backdrop-filter:\s*none/)
  })

  it('announces an error', () => {
    const state: ResourceState<string> = aFailedRead()
    renderWithI18n(<Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders the data', () => {
    const state: ResourceState<string> = { status: 'ready', data: 'Fruškogorski maraton' }
    renderWithI18n(<Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>)

    expect(screen.getByText('Fruškogorski maraton')).toBeInTheDocument()
  })
})

/**
 * A READ THAT FAILED SAYS SO AND OFFERS TO ASK AGAIN (decision of 02.10.2026, PENDING stavka 368,
 * in the words of the PDL's record of it and not the owner's: „Spisak koji ne moze da se ucita KAZE
 * to, umesto da izgleda prazan, uz dugme „Pokusaj ponovo". Vazi za sve ekrane sa spiskom.").
 *
 * <p>This is the one place every screen that reads data goes through, so these are the cases that
 * hold the button for all of them at once; what a real screen does around it, and what asking
 * again reaches, is held where a server can answer (`data/askingAgain.test.tsx`,
 * `pages/resourceAsksAgain.test.tsx`).
 *
 * <p>The axes are the shape of the screen (a whole screen, a part that has a name, a part that has
 * none), the moment (failed, asking again, and every state in which there is nothing to ask) and
 * the language. The state is built by hand because that is the only way to hold it still: a failed
 * read that a real hook produces is already on its way to being something else.
 */
describe('Resource, when the read failed', () => {
  const showing = (state: ResourceState<string>, how: { inline?: boolean; label?: string } = {}) => {
    const drawn: string[] = []

    renderWithI18n(
      <Resource<string> state={state} {...how}>
        {(data) => {
          drawn.push(data)

          return <span>{data}</span>
        }}
      </Resource>,
    )

    return drawn
  }

  it('says so, and offers to ask again, where it owns the whole screen', () => {
    const drawn = showing(aFailedRead())

    expect(screen.getByRole('alert')).toHaveTextContent(sr.data.error)
    /* Named by its own word and nothing else: a whole screen has nothing to say which list it is
       about, and a name that carried an empty one („Pokušaj ponovo: ") would be worse than none. */
    expect(screen.getByRole('button', { name: sr.data.retry })).toBeVisible()
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-label')
    /* The screen underneath is not drawn over it and not drawn as if it had read nothing: it is
       not drawn, which is what a read that failed has to give. */
    expect(drawn).toEqual([])
    /* And no sheet over the page: a failure is something to read and to press, and a reader who
       cannot press anything under a sheet would be stuck with a button he cannot reach. */
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('names the button after the part where the part has a name', () => {
    showing(aFailedRead(), { inline: true, label: 'Trke' })

    expect(screen.getByRole('button', { name: `${sr.data.retry}: Trke` })).toHaveTextContent(
      sr.data.retry,
    )
  })

  it('names it by its own word where a part has no name', () => {
    showing(aFailedRead(), { inline: true })

    expect(screen.getByRole('button', { name: sr.data.retry })).not.toHaveAttribute('aria-label')
  })

  it('asks again, once, when the button is pressed', async () => {
    let asked = 0

    showing(
      aFailedRead({
        readAgain: () => {
          asked += 1
        },
      }),
    )

    await setupUser().click(screen.getByRole('button', { name: sr.data.retry }))

    expect(asked).toBe(1)
  })

  it('says it is asking while the request is out, and refuses a press without leaving the tab order', async () => {
    let asked = 0

    showing(
      aFailedRead({
        reading: true,
        readAgain: () => {
          asked += 1
        },
      }),
    )

    /* The sentence about the failure is gone and the loader's own word stands in its place, and it
       is a status and not an alert: asking again is not news of a fault. */
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(sr.data.loading)

    const button = screen.getByRole('button', { name: sr.data.retry })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()

    await setupUser().click(button)

    expect(asked, 'a press went through while the request was out').toBe(0)
  })

  it('draws no button where there is nothing to ask again', () => {
    for (const state of [
      { status: 'loading' } satisfies ResourceState<string>,
      { status: 'ready', data: 'Fruškogorski maraton' } satisfies ResourceState<string>,
    ]) {
      const { unmount } = renderWithI18n(
        <Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>,
      )

      expect(screen.queryByRole('button')).toBeNull()
      unmount()
    }
  })

  it('says the same in English', () => {
    renderWithI18n(
      <Resource<string> state={aFailedRead()} inline label="Races">
        {(data) => <span>{data}</span>}
      </Resource>,
      'en',
    )

    expect(screen.getByRole('alert')).toHaveTextContent(en.data.error)
    expect(screen.getByRole('button', { name: `${en.data.retry}: Races` })).toBeVisible()
  })
})

/**
 * A READ THAT FAILED IS READ AGAIN AND WORKS, AND THE KEYBOARD IS WHERE THE READER WAS (review of
 * PR 476, round 2: a press with Enter that worked left `document.activeElement` on `<body>`, on a
 * whole screen, on a part and in the panel under the envelope alike, 4 runs of 4; WCAG 2.2 SC 2.4.3).
 *
 * <p>The button is taken out of the document when what failed is replaced by what was read, and the
 * focus was on it. `Unreadable` says it left with the focus on it (`components/unreadable.test.tsx`);
 * what is held HERE is what `Resource` does with that: where the focus goes, for which shape of
 * screen, and when it does not go at all. The panel under the envelope is held where it is drawn
 * (`pages/resourceAsksAgain.test.tsx`), and the three shapes together on real screens.
 *
 * <p><b>The axes are the shape</b> (a whole screen, a part with a name, a part with none, a whole screen
 * with no `main` to go to), <b>whose the focus is when the answer arrives</b> (the button's, nobody's
 * because it was never there, somebody else's because the reader moved on, a field's because what
 * was drawn took it) <b>and what happens between</b> (nothing, a wait for another file, a second
 * failure).
 *
 * <p>The state is driven by hand, one step at a time, because that is the only way to hold the
 * moment still: the press is a real one (`userEvent`, which puts the focus on the button as a
 * browser does), and the answer is the harness handing the component the next state.
 */
describe('Resource, when what failed is read again and works', () => {
  let give: (next: ResourceState<string>) => void = () => undefined

  /** Holds the state `Resource` is given, and hands the next one over on request. */
  function Harness({
    first,
    inline = false,
    label,
    inMain = true,
    children = (data: string) => <p>{data}</p>,
  }: {
    first: ResourceState<string>
    inline?: boolean
    label?: string
    inMain?: boolean
    children?: (data: string) => ReactNode
  }) {
    const [state, setState] = useState(first)

    give = setState

    const part = (
      <Resource<string> state={state} inline={inline} label={label}>
        {children}
      </Resource>
    )

    return (
      <>
        {inMain ? <main tabIndex={-1}>{part}</main> : part}
        <button type="button">Drugo dugme</button>
      </>
    )
  }

  const READY: ResourceState<string> = { status: 'ready', data: 'Fruškogorski maraton' }
  const retry = () => screen.getByRole('button', { name: new RegExp(sr.data.retry) })

  /** The press, as a person makes it with the keyboard: the focus is on the button, and Enter. */
  async function pressWithTheKeyboard() {
    retry().focus()
    await setupUser().keyboard('{Enter}')
    expect(retry(), 'the press did not leave the focus on the button').toHaveFocus()
  }

  it('puts the keyboard on the main landmark of a whole screen', async () => {
    renderWithI18n(<Harness first={aFailedRead()} />)
    await pressWithTheKeyboard()

    act(() => {
      give(READY)
    })

    expect(screen.getByText('Fruškogorski maraton')).toBeVisible()
    expect(screen.getByRole('main'), 'the focus fell out of the screen').toHaveFocus()
  })

  it('does not scroll to where it puts the keyboard, which would undo the place the reader is at', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')

    try {
      renderWithI18n(<Harness first={aFailedRead()} />)
      await pressWithTheKeyboard()
      focus.mockClear()

      act(() => {
        give(READY)
      })

      const main = screen.getByRole('main')
      const onMain = focus.mock.calls.filter((_call, at) => focus.mock.contexts[at] === main)

      expect(onMain).toEqual([[{ preventScroll: true }]])
    } finally {
      focus.mockRestore()
    }
  })

  it('goes quietly where a whole screen has no main landmark to go to', async () => {
    renderWithI18n(<Harness first={aFailedRead()} inMain={false} />)
    await pressWithTheKeyboard()

    act(() => {
      give(READY)
    })

    expect(screen.getByText('Fruškogorski maraton')).toBeVisible()
    expect(document.body).toHaveFocus()
  })

  it('puts the keyboard on a node in front of a part, which says the name of the part', async () => {
    renderWithI18n(<Harness first={aFailedRead()} inline label="Trke" />)
    await pressWithTheKeyboard()

    act(() => {
      give(READY)
    })

    const drawn = screen.getByText('Fruškogorski maraton')
    const kept = document.activeElement

    expect(kept, 'the focus fell out of the part').not.toBe(document.body)
    expect(kept).toHaveTextContent('Trke')
    /* In front of what was drawn and in the same place, which is what keeps the reader where he
       was: the next thing read is the part, and the next Tab goes into it. */
    expect(kept?.nextElementSibling).toBe(drawn)
    expect(kept?.parentElement).toBe(drawn.parentElement)
  })

  it('puts it there for a part that has no name too, on a node that says nothing', async () => {
    renderWithI18n(<Harness first={aFailedRead()} inline />)
    await pressWithTheKeyboard()

    act(() => {
      give(READY)
    })

    const kept = document.activeElement

    expect(kept, 'the focus fell out of the part').not.toBe(document.body)
    expect(kept).toHaveTextContent('')
    expect(kept?.nextElementSibling).toBe(screen.getByText('Fruškogorski maraton'))
  })

  it('draws no such node for a part that never failed, which is the markup it always was', () => {
    renderWithI18n(<Harness first={READY} inline label="Trke" />)

    expect(screen.getByRole('main').children).toHaveLength(1)
  })

  it('does not draw what was drawn again when the part is read a second time', async () => {
    let drawn = 0

    function Counted() {
      const once = useRef(false)

      useLayoutEffect(() => {
        if (!once.current) {
          once.current = true
          drawn += 1
        }
      }, [])

      return <p>Fruškogorski maraton</p>
    }

    renderWithI18n(
      <Harness first={aFailedRead()} inline label="Trke">
        {() => <Counted />}
      </Harness>,
    )
    await pressWithTheKeyboard()

    act(() => {
      give(READY)
    })
    act(() => {
      give({ status: 'ready', data: 'drugi odgovor' })
    })

    expect(drawn, 'the node in front of the part made the part start again').toBe(1)
  })

  it('does not follow a reader who moved the focus while it asked', async () => {
    renderWithI18n(<Harness first={aFailedRead()} />)
    await pressWithTheKeyboard()

    screen.getByRole('button', { name: 'Drugo dugme' }).focus()
    act(() => {
      give(READY)
    })

    expect(screen.getByText('Fruškogorski maraton')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Drugo dugme' }), 'the focus was taken from where it was').toHaveFocus()
  })

  it('does not follow a press that did not have the focus on the button', () => {
    renderWithI18n(<Harness first={aFailedRead()} />)

    /* A press with a pointer in a browser that does not focus a button, or any press that the
       button never held the focus for: nobody was standing on anything. */
    fireEvent.click(retry())
    expect(document.body).toHaveFocus()

    act(() => {
      give(READY)
    })

    expect(screen.getByText('Fruškogorski maraton')).toBeVisible()
    expect(document.body, 'the focus was taken from nobody').toHaveFocus()
  })

  it('leaves the focus where what was drawn put it', async () => {
    function Field() {
      const box = useRef<HTMLInputElement>(null)

      useLayoutEffect(() => {
        box.current?.focus()
      }, [])

      return <input aria-label="Polje" ref={box} />
    }

    renderWithI18n(<Harness first={aFailedRead()}>{() => <Field />}</Harness>)
    await pressWithTheKeyboard()

    act(() => {
      give(READY)
    })

    expect(screen.getByRole('textbox', { name: 'Polje' }), 'a form that took the focus lost it').toHaveFocus()
  })

  it('waits for the last file when the one that failed is read while another is still on its way', async () => {
    renderWithI18n(<Harness first={aFailedRead()} />)
    await pressWithTheKeyboard()

    act(() => {
      give({ status: 'loading' })
    })
    expect(screen.getByRole('main'), 'the focus went to the page while it was still waiting').not.toHaveFocus()

    act(() => {
      give(READY)
    })

    expect(screen.getByText('Fruškogorski maraton')).toBeVisible()
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('lets go of the focus when what it waited for fails again, because that button is a new one', async () => {
    renderWithI18n(<Harness first={aFailedRead()} />)
    await pressWithTheKeyboard()

    act(() => {
      give({ status: 'loading' })
    })
    act(() => {
      give(aFailedRead())
    })
    /* The reader has not touched the new button. Whoever reads the page next, the focus is nobody's
       and it stays that way. */
    act(() => {
      give(READY)
    })

    expect(screen.getByText('Fruškogorski maraton')).toBeVisible()
    expect(document.body, 'a press on the first button moved the keyboard on the strength of the second').toHaveFocus()
  })

  it('draws nothing in front of a whole screen that was read again, because it goes to the landmark', async () => {
    renderWithI18n(<Harness first={aFailedRead()} />)
    await pressWithTheKeyboard()

    act(() => {
      give(READY)
    })

    expect(
      screen.getByRole('main').children,
      'a node for the keyboard was drawn on a screen that has the landmark to go to',
    ).toHaveLength(1)
  })

  it('puts it there once, and not again when what is drawn is drawn again', async () => {
    renderWithI18n(<Harness first={aFailedRead()} />)
    await pressWithTheKeyboard()

    act(() => {
      give(READY)
    })
    expect(screen.getByRole('main')).toHaveFocus()

    /* The reader lets go of it, with a click on nothing or with Escape: nobody is standing anywhere. */
    act(() => {
      screen.getByRole('main').blur()
    })
    expect(document.body).toHaveFocus()

    act(() => {
      give({ status: 'ready', data: 'drugi odgovor' })
    })

    expect(screen.getByText('drugi odgovor')).toBeVisible()
    expect(
      document.body,
      'a later drawing took the keyboard again, for a press that was answered long ago',
    ).toHaveFocus()
  })

  it('puts it in front of the part that was pressed, and not of one that came back before it', async () => {
    const giveToPart: Record<string, (next: ResourceState<string>) => void> = {}

    function Part({ label }: { label: string }) {
      const [state, setState] = useState<ResourceState<string>>(aFailedRead())

      giveToPart[label] = setState

      return (
        <Resource<string> state={state} inline label={label}>
          {(data) => <p>{`${label}: ${data}`}</p>}
        </Resource>
      )
    }

    renderWithI18n(
      <main tabIndex={-1}>
        <Part label="Trke" />
        <Part label="Rezultati" />
      </main>,
    )

    const user = setupUser()

    /* The second is the one that tells: the first part's node is already in the document by then. */
    for (const label of ['Trke', 'Rezultati']) {
      screen.getByRole('button', { name: `${sr.data.retry}: ${label}` }).focus()
      await user.keyboard('{Enter}')
      act(() => {
        giveToPart[label]?.(READY)
      })

      const kept = document.activeElement

      expect(kept, `the keyboard did not go to the part called ${label}`).toHaveTextContent(label)
      expect(kept?.nextElementSibling).toHaveTextContent(`${label}: Fruškogorski maraton`)
    }
  })
})
