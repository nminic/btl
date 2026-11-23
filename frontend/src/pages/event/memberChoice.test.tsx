import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Suggestion } from '../../forms/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { setupUser } from '../../test/user'
import { MemberChoice } from './MemberChoice'

/**
 * THE BOX OF A MEMBER ON A ROW OF RESULTS IS A COMBOBOX (owner, 23.11.2026, PDL „Tri brze izmene administracije":
 * „polje za člana postaje padajući izbor u koji se kuca"), held to the pattern the portal already keeps for the
 * town (`forms/PlaceField.tsx`, WAI-ARIA 1.2), by role and by key.
 *
 * <p><b>The axes:</b> the list shut and open; nothing highlighted, the first, the last, and walking past either
 * end; chosen by Enter, by the pointer, and not chosen; closed by Escape, by leaving, by choosing; and Enter with
 * nothing highlighted, which is the form's and not the list's.
 */

const MEMBERS: Suggestion[] = [
  { id: '000002', value: 'Relja Momčilović (000002)', said: 'Relja Momčilović (000002)', fills: {} },
  { id: '000003', value: 'Anđelija Vukotić (000003)', said: 'Anđelija Vukotić (000003)', fills: {} },
  { id: '000004', value: 'Relja Petrović (000004)', said: 'Relja Petrović (000004)', fills: {} },
]

function Harness({ onChoose, onSubmit }: { onChoose: (one: Suggestion) => void; onSubmit: () => void }) {
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
          suggestions={MEMBERS}
          invalid={false}
          describedBy={undefined}
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

function drawn() {
  const onChoose = vi.fn<(one: Suggestion) => void>()
  const onSubmit = vi.fn<() => void>()

  render(<Harness onChoose={onChoose} onSubmit={onSubmit} />)

  return { box: screen.getByRole('combobox', { name: 'Član' }), onChoose, onSubmit }
}

describe('the box of a member', () => {
  it('is shut until something is typed, and opens a listbox of the members it names from the second letter', async () => {
    const user = setupUser()
    const { box } = drawn()

    expect(box).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).toBeNull()

    await user.type(box, 'R')
    expect(screen.queryByRole('listbox')).toBeNull()

    await user.type(box, 'e')
    expect(box).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox', { name: 'Ponuđeni članovi' })).toHaveAttribute('id', box.getAttribute('aria-controls'))
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual([
      'Relja Momčilović (000002)',
      'Relja Petrović (000004)',
    ])
    expect(box).not.toHaveAttribute('aria-activedescendant')
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

  it('opens nothing on Down while nothing it names is typed, and a key that is no arrow does nothing to the list', async () => {
    const user = setupUser()
    const { box } = drawn()

    await user.click(box)
    await user.keyboard('{ArrowDown}')
    expect(screen.queryByRole('listbox')).toBeNull()

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

    await user.click(box)
    await user.keyboard('{ArrowDown}')
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
