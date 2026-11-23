import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Suggestion } from '../../forms/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { setupUser } from '../../test/user'
import { MemberChoice } from './MemberChoice'
import { keptInView, roomFor } from './memberList'

/**
 * THE BOX OF A MEMBER ON A ROW OF RESULTS IS A COMBOBOX (owner, 23.11.2026, PDL „Tri brze izmene administracije":
 * „polje za člana postaje padajući izbor u koji se kuca"), held to the pattern the portal already keeps for the
 * town (`forms/PlaceField.tsx`, WAI-ARIA 1.2), by role and by key.
 *
 * <p><b>A dropdown and not a box that waits for two letters</b> (owner, 23.11.2026, after PR 800: „Ovde nema
 * dropdown-a, gde si ti zapravo uradio izmenu????”; recorded under the decision: „klik ili strelica dole otvaraju
 * spisak SVIH članova koji se mogu izabrati, spisak se skroluje unutar sebe, a kucanje slova sužava spisak.”).
 *
 * <p><b>The axes:</b> the list shut and open; opened by a press and by Down, shut by a second press; the box empty,
 * holding letters, holding letters nobody's name holds, and holding a member chosen; one letter and two; a list
 * longer than eight; nothing highlighted, the first, the last, and walking past either end; chosen by Enter, by
 * the pointer (a row that is not the first), and not chosen; closed by Escape, by leaving, by choosing; Enter with
 * nothing highlighted, which is the form's and not the list's; and the list opened under the box, in the room the
 * window has there, with the row walked to kept in sight.
 */

const MEMBERS: Suggestion[] = [
  { id: '000002', value: 'Relja Momčilović (000002)', said: 'Relja Momčilović (000002)', fills: {} },
  { id: '000003', value: 'Anđelija Vukotić (000003)', said: 'Anđelija Vukotić (000003)', fills: {} },
  { id: '000004', value: 'Relja Petrović (000004)', said: 'Relja Petrović (000004)', fills: {} },
]

/** Twelve members, more than the eight the box once stopped at, each holding the letter „a” and only the
 *  last holding „zz”: a box that still stopped at eight, or still waited for a second letter, offers otherwise. */
const MANY: Suggestion[] = Array.from({ length: 12 }, (_, index) => {
  const label = `Član broj ${String(index + 1)}${index === 11 ? ' Zzzić' : ''} (0001${String(index + 10)})`

  return { id: `0001${String(index + 10)}`, value: label, said: label, fills: {} }
})

function Harness({
  onChoose,
  onSubmit,
  members = MEMBERS,
  fitted = false,
}: {
  onChoose: (one: Suggestion) => void
  onSubmit: () => void
  members?: Suggestion[]
  fitted?: boolean
}) {
  const [value, setValue] = useState('')

  return (
    <I18nProvider locale="sr">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onSubmit()
          }
        }}
      >
        <label htmlFor="member">Član</label>
        <MemberChoice
          id="member"
          name="member"
          value={value}
          suggestions={members}
          invalid={false}
          describedBy={undefined}
          fitted={fitted}
          onType={setValue}
          onChoose={(one) => {
            setValue(one.value)
            onChoose(one)
          }}
        />
        <label htmlFor="after">Sati</label>
        <input id="after" />
        <button type="submit">Sačuvaj</button>
      </form>
    </I18nProvider>
  )
}

function drawn(members = MEMBERS) {
  const onChoose = vi.fn<(one: Suggestion) => void>()
  const onSubmit = vi.fn<() => void>()

  render(<Harness onChoose={onChoose} onSubmit={onSubmit} members={members} />)

  return { box: screen.getByRole('combobox', { name: 'Član' }), onChoose, onSubmit }
}

const names = () => screen.getAllByRole('option').map((one) => one.textContent)

describe('the box of a member', () => {
  it('is shut at first, and a press on it opens a listbox of every member, which a second press shuts', async () => {
    const user = setupUser()
    const { box } = drawn()

    expect(box).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).toBeNull()

    await user.click(box)
    expect(box).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox', { name: 'Ponuđeni članovi' })).toHaveAttribute('id', box.getAttribute('aria-controls'))
    expect(names()).toEqual(['Relja Momčilović (000002)', 'Anđelija Vukotić (000003)', 'Relja Petrović (000004)'])
    expect(box).not.toHaveAttribute('aria-activedescendant')
    expect(box, 'the press took the cursor somewhere else').toHaveFocus()

    await user.click(box)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens every member on Down in an empty box, with nothing highlighted', async () => {
    const user = setupUser()
    const { box } = drawn()

    await user.tab()
    expect(box).toHaveFocus()
    await user.keyboard('{ArrowDown}')

    expect(names()).toHaveLength(3)
    expect(box).toHaveAttribute('aria-expanded', 'true')
    expect(box).not.toHaveAttribute('aria-activedescendant')
  })

  it('narrows the list from the first letter typed, to every member whose name holds it', async () => {
    const user = setupUser()
    const { box } = drawn()

    await user.type(box, 'p')

    expect(box).toHaveAttribute('aria-expanded', 'true')
    expect(names()).toEqual(['Relja Petrović (000004)'])

    await user.clear(box)
    expect(names(), 'an emptied box offers every member again').toHaveLength(3)
  })

  it('offers every one of more than eight members, and narrows them with no upper bound', async () => {
    const user = setupUser()
    const { box } = drawn(MANY)

    await user.click(box)
    expect(names()).toEqual(MANY.map((one) => one.said))

    await user.type(box, 'a')
    expect(names(), 'one letter held by all twelve').toEqual(MANY.map((one) => one.said))

    await user.clear(box)
    await user.type(box, 'broj 1')
    expect(names()).toEqual([MANY[0], MANY[9], MANY[10], MANY[11]].map((one) => one?.said))
  })

  it('says it is shut while letters nobody holds draw no list, and open again once letters somebody holds do', async () => {
    const user = setupUser()
    const { box } = drawn()

    await user.type(box, 'Rx')

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box, 'a box that draws no list said it was expanded').toHaveAttribute('aria-expanded', 'false')
    expect(box).not.toHaveAttribute('aria-activedescendant')

    await user.keyboard('{Backspace}')
    expect(box).toHaveAttribute('aria-expanded', 'true')
    expect(names()).toHaveLength(2)
  })

  it('offers every member again when a box holding a chosen member is opened, for another one to be chosen', async () => {
    const user = setupUser()
    const { box, onChoose } = drawn()

    await user.click(box)
    await user.click(screen.getByRole('option', { name: 'Anđelija Vukotić (000003)' }))
    expect(box).toHaveValue('Anđelija Vukotić (000003)')

    await user.click(box)
    expect(names()).toHaveLength(3)

    await user.click(screen.getByRole('option', { name: 'Relja Petrović (000004)' }))
    expect(onChoose).toHaveBeenLastCalledWith(MEMBERS[2])
    expect(box).toHaveValue('Relja Petrović (000004)')
  })

  it('walks the list with Down and Up, both wrapping, naming the row it stands on', async () => {
    const user = setupUser()
    const { box } = drawn()

    await user.type(box, 'Relja')
    await user.keyboard('{ArrowDown}')

    const [first, last] = screen.getAllByRole('option')

    expect(box).toHaveAttribute('aria-activedescendant', first?.id)
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(last).toHaveAttribute('aria-selected', 'false')

    await user.keyboard('{ArrowDown}')
    expect(box).toHaveAttribute('aria-activedescendant', last?.id)

    await user.keyboard('{ArrowDown}')
    expect(box, 'Down past the last row went nowhere').toHaveAttribute('aria-activedescendant', first?.id)

    await user.keyboard('{ArrowUp}')
    expect(box, 'Up past the first row went nowhere').toHaveAttribute('aria-activedescendant', last?.id)

    await user.keyboard('{ArrowUp}')
    expect(box).toHaveAttribute('aria-activedescendant', first?.id)
    expect(box, 'the arrows moved the cursor out of the box').toHaveFocus()
  })

  it('goes to the last row on Up from nothing highlighted', async () => {
    const user = setupUser()
    const { box } = drawn()

    await user.type(box, 'Relja')
    await user.keyboard('{ArrowUp}')

    expect(box).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option').at(-1)?.id)
  })

  it('chooses the highlighted row on Enter, closes, and does not save the form', async () => {
    const user = setupUser()
    const { box, onChoose, onSubmit } = drawn()

    await user.type(box, 'Relja')
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onChoose).toHaveBeenCalledWith(MEMBERS[2])
    expect(box).toHaveValue('Relja Petrović (000004)')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box).toHaveAttribute('aria-expanded', 'false')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('leaves Enter to the form while nothing is highlighted', async () => {
    const user = setupUser()
    const { box, onChoose, onSubmit } = drawn()

    await user.type(box, 'Relja{Enter}')

    expect(onChoose).not.toHaveBeenCalled()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('chooses a row pressed with the pointer and keeps the cursor in the box', async () => {
    const user = setupUser()
    const { box, onChoose } = drawn()

    await user.type(box, 'Relja')
    /* The row pressed is the SECOND of the two offered, never the first hit: a box that chose the first row
       whatever was pressed would still give the first member of this list. */
    await user.click(screen.getByRole('option', { name: 'Relja Petrović (000004)' }))

    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onChoose).toHaveBeenCalledWith(MEMBERS[2])
    expect(box).toHaveValue('Relja Petrović (000004)')
    expect(box).toHaveFocus()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes on Escape and the press goes no further, and Down opens it again on the same letters', async () => {
    const user = setupUser()
    const { box, onSubmit } = drawn()

    await user.type(box, 'Relja')
    await user.keyboard('{ArrowDown}{Escape}')

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box).not.toHaveAttribute('aria-activedescendant')
    expect(onSubmit, 'Escape reached the form around the box').not.toHaveBeenCalled()

    await user.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(box, 'Down opened the list with a row already highlighted').not.toHaveAttribute('aria-activedescendant')
  })

  it('opens nothing on Down while letters nobody holds are typed, and a key that is no arrow does nothing to the list', async () => {
    const user = setupUser()
    const { box } = drawn()

    await user.type(box, 'Rx')
    await user.keyboard('{ArrowDown}')
    expect(screen.queryByRole('listbox')).toBeNull()

    await user.clear(box)
    await user.type(box, 'Relja')
    await user.keyboard('{ArrowDown}{Home}')
    expect(box).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[0]?.id)
  })

  it('closes when the cursor leaves the box, so nothing stands over the box it went to', async () => {
    const user = setupUser()
    const { box } = drawn()

    await user.type(box, 'Relja')
    await user.keyboard('{ArrowDown}')
    await user.tab()

    expect(screen.getByRole('textbox', { name: 'Sati' })).toHaveFocus()
    expect(screen.queryByRole('listbox')).toBeNull()

    /* The press opens the list again, and on no row. */
    await user.click(box)
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(box, 'the row highlighted before the cursor left was still highlighted').not.toHaveAttribute(
      'aria-activedescendant',
    )
  })

  it('lets go of the highlighted row when a letter is typed, since the list is then another list', async () => {
    const user = setupUser()
    const { box } = drawn()

    await user.type(box, 'Relja')
    await user.keyboard('{ArrowDown}')
    await user.type(box, ' ')

    expect(box).not.toHaveAttribute('aria-activedescendant')
  })
})

describe('the width of the box', () => {
  it('is the whole width it is given, unless the box is fitted to the longest name it offers', () => {
    render(<Harness onChoose={vi.fn()} onSubmit={vi.fn()} />)

    expect(screen.getByRole('combobox').closest('.member-choice')).not.toHaveClass('member-choice--fitted')
    expect(screen.getByRole('combobox').closest('.member-choice')).not.toHaveAttribute('style')
  })

  it('counts the longest label it offers, in characters, when it is fitted', () => {
    render(<Harness onChoose={vi.fn()} onSubmit={vi.fn()} fitted />)

    const wrapper = screen.getByRole('combobox').closest('.member-choice')

    expect(wrapper).toHaveClass('member-choice--fitted')
    expect(wrapper).toHaveStyle({ '--member-choice-widest': String('Anđelija Vukotić (000003)'.length) })
  })

  it('counts nothing for a list that offers nobody', () => {
    render(<Harness onChoose={vi.fn()} onSubmit={vi.fn()} members={[]} fitted />)

    expect(screen.getByRole('combobox').closest('.member-choice')).toHaveStyle({ '--member-choice-widest': '0' })
  })
})

describe('where the list of members stands', () => {
  it('opens under the box, no taller than the room under it, while there is room for a few rows there', async () => {
    const user = setupUser()
    const { box } = drawn()

    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 100, width: 300, height: 48 })
    await user.click(box)

    const list = screen.getByRole('listbox')

    expect(list.style.getPropertyValue('--member-choice-room')).toBe(`${String(window.innerHeight - 148 - 12)}px`)
  })

  it('is given its room and its place when it is opened by typing, as when it is opened by a press', async () => {
    /* Review of PR 803, low 3: the road by typing to the room was held by Chrome only (`memberChoice.geometry.ts`). */
    const user = setupUser()
    const { box } = drawn()

    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 40, y: 100, width: 300, height: 48 })
    await user.type(box, 'Rel')

    const list = screen.getByRole('listbox')

    expect(list.style.getPropertyValue('--member-choice-room')).toBe(`${String(window.innerHeight - 148 - 12)}px`)
    expect(list.style.getPropertyValue('--member-choice-bottom')).toBe('148px')
    expect(list.style.getPropertyValue('--member-choice-left')).toBe('40px')
    expect(list.style.getPropertyValue('--member-choice-width')).toBe('300px')
  })

  it('is worked out again where the box stands when it opens the next time', async () => {
    const user = setupUser()
    const { box } = drawn()

    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 100, width: 300, height: 48 })
    await user.click(box)
    await user.click(box)
    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 300, width: 300, height: 48 })
    await user.keyboard('{ArrowDown}')

    expect(screen.getByRole('listbox').style.getPropertyValue('--member-choice-room')).toBe(
      `${String(window.innerHeight - 348 - 12)}px`,
    )
  })

  it('stands where the box stands, in the window and not in the box (a table that clips cannot cut it)', async () => {
    const user = setupUser()
    const { box } = drawn()

    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 40, y: 100, width: 300, height: 48 })
    await user.click(box)

    const list = screen.getByRole('listbox')

    expect(list.style.getPropertyValue('--member-choice-bottom')).toBe('148px')
    expect(list.style.getPropertyValue('--member-choice-left')).toBe('40px')
    expect(list.style.getPropertyValue('--member-choice-width')).toBe('300px')
  })

  it('stands at the place of the box in the DOCUMENT, so a page scrolled down and to the side has the list under the box', async () => {
    const user = setupUser()
    const { box } = drawn()

    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(300)
    vi.spyOn(window, 'scrollX', 'get').mockReturnValue(20)
    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 40, y: 100, width: 300, height: 48 })
    await user.click(box)

    const list = screen.getByRole('listbox')

    expect(list.style.getPropertyValue('--member-choice-bottom')).toBe('448px')
    expect(list.style.getPropertyValue('--member-choice-left')).toBe('60px')
    vi.restoreAllMocks()
  })

  it('goes with the box when the page or a table scrolls, or the window changes size, while it is open', async () => {
    const user = setupUser()
    const { box } = drawn()

    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 40, y: 100, width: 300, height: 48 })
    await user.click(box)
    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 40, y: 60, width: 300, height: 48 })
    act(() => {
      box.closest('.member-choice')?.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))
    })

    expect(screen.getByRole('listbox').style.getPropertyValue('--member-choice-bottom')).toBe('108px')

    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 10, y: 60, width: 200, height: 48 })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.getByRole('listbox').style.getPropertyValue('--member-choice-left')).toBe('10px')
    expect(screen.getByRole('listbox').style.getPropertyValue('--member-choice-width')).toBe('200px')
  })

  it('does not draw again for a scroll that did not move the box, and stops listening once shut', async () => {
    const user = setupUser()
    const { box } = drawn()
    const listened = vi.spyOn(window, 'removeEventListener')

    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 40, y: 100, width: 300, height: 48 })
    await user.click(box)

    const before = screen.getByRole('listbox')

    act(() => {
      before.dispatchEvent(new Event('scroll'))
    })

    expect(screen.getByRole('listbox').style.getPropertyValue('--member-choice-bottom')).toBe('148px')

    await user.keyboard('{Escape}')

    expect(listened).toHaveBeenCalledWith('scroll', expect.any(Function), true)
    expect(listened).toHaveBeenCalledWith('resize', expect.any(Function))
    listened.mockRestore()
  })

  it('scrolls itself to keep the row walked to with the keys in sight', async () => {
    const user = setupUser()
    const { box } = drawn(MANY)

    await user.click(box)

    const list = screen.getByRole('listbox')

    /* Each row 30 high, eight of them in sight: the ninth is under the edge. jsdom lays nothing out, so the
       numbers a browser would give are given here. */
    screen.getAllByRole('option').forEach((row, index) => {
      Object.defineProperty(row, 'offsetTop', { configurable: true, value: index * 30 })
      Object.defineProperty(row, 'offsetHeight', { configurable: true, value: 30 })
    })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 240 })

    await user.keyboard('{ArrowDown}'.repeat(9))
    expect(box).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[8]?.id)
    expect(list.scrollTop, 'the ninth row was left under the edge').toBe(30)
  })

  it('is not drawn again, and so not put back on the row walked to, by a scroll of its own that moved nothing', async () => {
    const user = setupUser()
    const { box } = drawn(MANY)

    await user.click(box)

    const list = screen.getByRole('listbox')

    screen.getAllByRole('option').forEach((row, index) => {
      Object.defineProperty(row, 'offsetTop', { configurable: true, value: index * 30 })
      Object.defineProperty(row, 'offsetHeight', { configurable: true, value: 30 })
    })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 240 })
    await user.keyboard('{ArrowDown}'.repeat(9))

    /* The reader turns the wheel over the list and takes it to the top, away from the row walked to. A list that
       was drawn again by that scroll would put itself back on the ninth row under his hand. */
    list.scrollTop = 0
    act(() => {
      list.dispatchEvent(new Event('scroll'))
    })

    expect(list.scrollTop).toBe(0)
  })
})

describe('roomFor', () => {
  it('gives the list the room under the box, less the gap kept from the edge of the window', () => {
    expect(roomFor(748, 1000)).toBe(240)
  })

  it('gives it no less than about three rows where the box stands near the bottom of the window', () => {
    expect(roomFor(900, 1000)).toBe(144)
    expect(roomFor(844, 1000)).toBe(144)
    expect(roomFor(843, 1000)).toBe(145)
  })
})

describe('keptInView', () => {
  it('scrolls back to a row above what is seen', () => {
    expect(keptInView(30, 30, 90, 240)).toBe(30)
  })

  it('scrolls on just far enough for a row under what is seen to stand whole at the bottom', () => {
    expect(keptInView(240, 30, 0, 240)).toBe(30)
  })

  it('leaves the list where it is for a row already seen whole', () => {
    expect(keptInView(210, 30, 0, 240)).toBe(0)
  })
})
