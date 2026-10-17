import { act, fireEvent, screen, within } from '@testing-library/react'
import { useState } from 'react'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import { renderWithI18n } from '../../test/render'
import { setupUser } from '../../test/user'
import MarkdownEditor from './MarkdownEditor'
import type { EditorProps } from './props'

/* The editor on a screen: what a writer meets, presses and types. What the buttons do to a text is
   held without a screen (`commands.test.ts`); here, that the screen asks them, says what they did,
   and can be used from the keyboard alone. */

const TOOLBAR = ['Podebljano', 'Kurziv', 'Naslov', 'Spisak', 'Veza']

function draw(props: Partial<EditorProps> = {}) {
  const onChange = vi.fn<(text: string) => void>()
  const onLeave = vi.fn<(text: string) => void>()
  const all: EditorProps = {
    id: 'opis',
    value: '',
    maxLength: 200,
    leftId: 'opis-left',
    label: 'Opis',
    onChange,
    onLeave,
    ...props,
  }
  const drawn = renderWithI18n(
    <>
      <MarkdownEditor {...all} />
      <button type="button">Posle</button>
    </>,
  )

  return { ...drawn, onChange, onLeave, all }
}

const box = () => screen.getByRole('textbox', { name: 'Opis' })

/**
 * The cursor put among the words of the box, from `at` characters into `words` and over `length` of
 * them. A press of the mouse in jsdom lands nowhere in particular and the keys that move a cursor
 * are not drawn, so the selection is put where a writer would put it and the editor is told, the way
 * a browser tells it: `selectionchange`.
 */
function select(words: string, at: number, length = 0): void {
  const walker = document.createTreeWalker(box(), NodeFilter.SHOW_TEXT)
  let found: Node | null = walker.nextNode()

  while (found !== null && !(found.textContent ?? '').includes(words)) {
    found = walker.nextNode()
  }

  if (found === null) {
    throw new Error(`no words ${words} in the box`)
  }

  const start = (found.textContent ?? '').indexOf(words) + at
  const range = document.createRange()

  range.setStart(found, start)
  range.setEnd(found, start + length)

  act(() => {
    box().focus()
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
}

/** The cursor after the last of `words`. */
const after = (words: string) => select(words, words.length)
const tool = (name: string) => screen.getByRole('button', { name })
const last = (spy: { mock: { calls: string[][] } }) => spy.mock.calls.at(-1)?.[0]

describe('the editor of a written text', () => {
  it('is a box with a name, and five buttons each named by its words', async () => {
    draw({ value: 'Reči' })

    expect(box()).toHaveAttribute('aria-multiline', 'true')
    expect(box()).toHaveTextContent('Reči')

    const tools = within(screen.getByRole('group', { name: 'Oblikovanje teksta' })).getAllByRole('button')

    expect(tools.map((one) => one.textContent)).toEqual(TOOLBAR)

    for (const one of tools) {
      /* A name, and the name is the words on it (WCAG 2.2 SC 2.5.3). */
      expect(one).toHaveAccessibleName(one.textContent ?? '')
      expect(one.textContent).not.toBe('')
      expect(one).not.toBeDisabled()
    }
  })

  it('meets every rule axe can ask of it, with the row for an address open', async () => {
    const user = setupUser()
    const { container } = draw({ value: 'Reči' })

    await user.click(box())
    await user.click(tool('Veza'))

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })

    expect(results.passes.length).toBeGreaterThan(0)
    expect(results.violations.map((one) => one.id)).toEqual([])
  })

  it('writes Markdown as it is typed, and makes the selection bold with a press that keeps the cursor', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Prvo' })

    after('Prvo')
    await user.keyboard(' drugo')

    expect(last(onChange)).toBe('Prvo drugo')

    await user.click(tool('Podebljano'))

    expect(tool('Podebljano')).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard('X')

    expect(last(onChange)).toBe('Prvo drugo**X**')
    /* And the cursor never left the box for the button. */
    expect(box()).toHaveFocus()
  })

  it('is used from the keyboard alone: back to the buttons, a press, and Tab out of it', async () => {
    const user = setupUser()
    const { onChange, onLeave } = draw({ value: 'Reči' })

    await user.click(box())
    await user.keyboard('{Control>}a{/Control}')
    await user.tab({ shift: true })

    expect(tool('Veza')).toHaveFocus()

    await user.tab({ shift: true })
    await user.tab({ shift: true })
    await user.tab({ shift: true })
    await user.tab({ shift: true })

    expect(tool('Podebljano')).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(last(onChange)).toBe('**Reči**')
    expect(onLeave).not.toHaveBeenCalled()

    /* Tab leaves the editor as it leaves every field, so nobody is held in it. */
    await user.click(box())
    await user.tab()

    expect(screen.getByRole('button', { name: 'Posle' })).toHaveFocus()
    expect(onLeave).toHaveBeenCalledWith('**Reči**')
  })

  it('takes the keys every editor has: bold, italic, a line break, a new paragraph, undo and redo', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Reč' })

    after('Reč')
    await user.keyboard('{Control>}b{/Control}A{Control>}b{/Control}{Control>}i{/Control}B{Control>}i{/Control}')

    expect(last(onChange)).toBe('Reč**A**_B_')

    await user.keyboard('{Shift>}{Enter}{/Shift}C{Enter}D')

    expect(last(onChange)).toBe('Reč**A**_B_\nC\n\nD')

    await user.keyboard('{Control>}z{/Control}')

    expect(last(onChange)).not.toBe('Reč**A**_B_\nC\n\nD')

    await user.keyboard('{Control>}y{/Control}')

    expect(last(onChange)).toBe('Reč**A**_B_\nC\n\nD')
  })

  it('says which of the four is on where the cursor stands', () => {
    draw({ value: '## Naslov\n\n- stavka\n\n_koso_' })

    select('Naslov', 2)

    expect(tool('Naslov')).toHaveAttribute('aria-pressed', 'true')
    expect(tool('Spisak')).toHaveAttribute('aria-pressed', 'false')

    select('stavka', 2)

    expect(tool('Spisak')).toHaveAttribute('aria-pressed', 'true')
    /* And a heading cannot be made inside a list: the button says so and stays reachable. */
    expect(tool('Naslov')).toHaveAttribute('aria-disabled', 'true')
  })

  it('makes a heading and a list of a paragraph, and back', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Reči' })

    await user.click(box())
    await user.click(tool('Naslov'))

    expect(last(onChange)).toBe('## Reči')

    await user.click(tool('Naslov'))
    await user.click(tool('Spisak'))

    expect(last(onChange)).toBe('- Reči')

    await user.click(tool('Spisak'))

    expect(last(onChange)).toBe('Reči')
  })

  it('refuses a press of a button that cannot act there, and says so', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: '| a | b |' })

    await user.click(box())

    expect(tool('Podebljano')).toHaveAttribute('aria-disabled', 'true')
    expect(tool('Veza')).toHaveAttribute('aria-disabled', 'true')

    await user.click(tool('Podebljano'))
    await user.click(tool('Veza'))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: 'Adresa veze' })).toBeNull()
  })
})

describe('a link, from the button', () => {
  it('asks for an address, refuses one a page may not lead to, and keeps one it may', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Vidi sajt' })

    select('sajt', 0, 4)
    await user.click(tool('Veza'))

    expect(tool('Veza')).toHaveAttribute('aria-expanded', 'true')

    const address = screen.getByRole('textbox', { name: 'Adresa veze' })

    expect(address).toHaveFocus()

    await user.type(address, 'javascript:alert(1){Enter}')

    expect(address).toHaveAttribute('aria-invalid', 'true')
    expect(address).toHaveAccessibleDescription(/počinje sa https:\/\//)
    expect(onChange).not.toHaveBeenCalled()

    await user.clear(address)

    expect(address).toHaveAttribute('aria-invalid', 'false')

    await user.type(address, ' https://primer.rs ')
    await user.click(screen.getByRole('button', { name: 'Postavi vezu' }))

    expect(last(onChange)).toBe('Vidi [sajt](https://primer.rs)')
    expect(screen.queryByRole('textbox', { name: 'Adresa veze' })).toBeNull()
    expect(box()).toHaveFocus()
  })

  it('refuses an address that reads as one host and opens another, and says what is wrong with it', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Vidi sajt' })

    select('sajt', 0, 4)
    await user.click(tool('Veza'))

    const address = screen.getByRole('textbox', { name: 'Adresa veze' })

    for (const typed of ['https://www.runtrace.net@zlo.example', 'http://www.runtrace.net@zlo.example']) {
      await user.clear(address)
      await user.type(address, `${typed}{Enter}`)

      expect(address, typed).toHaveAttribute('aria-invalid', 'true')
      expect(address, typed).toHaveAccessibleDescription(/ne sme da ima „@“/)
      expect(onChange, typed).not.toHaveBeenCalled()
    }

    await user.clear(address)
    await user.type(address, 'https://medium.com/@ime/post{Enter}')

    expect(last(onChange)).toBe('Vidi [sajt](https://medium.com/@ime/post)')
  })

  it('keeps the address with Enter, and not by sending the form it stands in', async () => {
    const user = setupUser()
    const sent = vi.fn((event: SubmitEvent) => event.preventDefault())
    const onChange = vi.fn()

    renderWithI18n(
      <form onSubmit={(event) => sent(event.nativeEvent)}>
        <MarkdownEditor id="opis" value="Reči" maxLength={200} leftId="l" label="Opis" onChange={onChange} onLeave={() => undefined} />
      </form>,
    )

    after('Reči')
    await user.click(tool('Veza'))
    await user.type(screen.getByRole('textbox', { name: 'Adresa veze' }), '/pravilnik{Enter}')

    expect(sent).not.toHaveBeenCalled()
    expect(last(onChange)).toBe('Reči[/pravilnik](/pravilnik)')
  })

  it('shows the address of the link the cursor stands in, changes it, and takes it off', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'A [prva](https://a.example) b' })

    select('prva', 2)
    await user.click(tool('Veza'))

    const address = screen.getByRole('textbox', { name: 'Adresa veze' })

    expect(address).toHaveValue('https://a.example')

    await user.clear(address)
    await user.type(address, 'https://c.example{Enter}')

    expect(last(onChange)).toBe('A [prva](https://c.example) b')

    select('prva', 2)
    await user.click(tool('Veza'))
    await user.click(screen.getByRole('button', { name: 'Ukloni vezu' }))

    expect(last(onChange)).toBe('A prva b')
  })

  it('puts the row away with Escape, with the second press of the button, or with the button that declines', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Reči' })

    await user.click(box())
    await user.click(tool('Veza'))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('textbox', { name: 'Adresa veze' })).toBeNull()
    expect(box()).toHaveFocus()

    await user.click(tool('Veza'))
    await user.click(tool('Veza'))

    expect(screen.queryByRole('textbox', { name: 'Adresa veze' })).toBeNull()

    await user.click(tool('Veza'))
    /* No link to take off where the cursor stands, so no button that would. */
    expect(screen.queryByRole('button', { name: 'Ukloni vezu' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByRole('textbox', { name: 'Adresa veze' })).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not leave the editor while the address is typed', async () => {
    const user = setupUser()
    const { onLeave } = draw({ value: 'Reči' })

    await user.click(box())
    await user.click(tool('Veza'))
    await user.type(screen.getByRole('textbox', { name: 'Adresa veze' }), 'https://primer.rs')

    expect(onLeave).not.toHaveBeenCalled()
  })
})

describe('the limit of the editor', () => {
  it('counts the room down in the Markdown it will be kept as, and the box says it on arrival', async () => {
    draw({ value: '**jako**', maxLength: 10 })

    expect(screen.getByText('Još 2 znaka')).toBeVisible()
  })

  it('takes no key past it', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Pun', maxLength: 4 })

    after('Pun')
    await user.keyboard('ab')

    expect(last(onChange)).toBe('Pun' + 'a')
    expect(screen.getByRole('status')).toHaveTextContent('Dosta je')
  })

  it('cuts a paste where the limit is and says what it lost, and the next key clears that', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Pre', maxLength: 10 })

    after('Pre')
    await user.paste('abcdefghij')

    expect(last(onChange)).toBe('Preabcdefg')
    expect(screen.getByRole('status')).toHaveTextContent(/3/)

    await user.keyboard('{Backspace}')

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('reads a paste with its marks, and leaves a paste that carries no words to the editor itself', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: '' })

    await user.click(box())
    await user.paste('**jako**')

    expect(last(onChange)).toBe('**jako**')

    /* A paste with no clipboard at all is not one this editor reads, and it changes nothing. */
    fireEvent.paste(box())

    expect(last(onChange)).toBe('**jako**')
  })

  it('puts on the clipboard the text with its shape', async () => {
    const user = setupUser()

    draw({ value: '**jako** i _koso_' })

    await user.click(box())
    await user.keyboard('{Control>}a{/Control}')

    /* jsdom has no `DataTransfer`, so the clipboard is the three things the editor asks of one. */
    const held = new Map<string, string>()
    const clipboardData = {
      clearData: () => held.clear(),
      setData: (type: string, value: string) => held.set(type, value),
      getData: (type: string) => held.get(type) ?? '',
    }

    fireEvent.copy(box(), { clipboardData })

    expect(held.get('text/plain')).toBe('**jako** i _koso_')
  })
})

describe('the editor as a field of a form', () => {
  it('is named by what names it on the screen, and says what describes it, that it is asked and that it is wrong', () => {
    renderWithI18n(
      <>
        <span id="ime">Opis događaja</span>
        <p id="pravilo">Pravilo polja</p>
        <MarkdownEditor
          id="field-description"
          value=""
          maxLength={600}
          leftId="field-description-left"
          labelledBy="ime"
          describedBy="pravilo field-description-left"
          required
          invalid
          onChange={() => undefined}
          onLeave={() => undefined}
        />
      </>,
    )

    const field = screen.getByRole('textbox', { name: 'Opis događaja' })

    expect(field).toHaveAttribute('id', 'field-description')
    expect(field).toHaveAttribute('aria-required', 'true')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Pravilo polja Još 600 znakova')
  })

  it('is held where the form holds it: reachable, read out, and not changed by a key or a button', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Reči', locked: true })

    expect(box()).toHaveAttribute('aria-disabled', 'true')
    expect(box()).toHaveAttribute('aria-readonly', 'true')
    expect(box()).toHaveAttribute('contenteditable', 'false')
    expect(box()).toHaveClass('field__control--held')

    for (const name of TOOLBAR) {
      expect(tool(name)).toHaveAttribute('aria-disabled', 'true')
    }

    await user.click(tool('Podebljano'))
    await user.click(tool('Veza'))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: 'Adresa veze' })).toBeNull()
  })

  it('takes a text handed in after it is drawn, and not its own text handed back', async () => {
    const user = setupUser()
    const onChange = vi.fn()
    let hand: (value: string) => void = () => undefined

    /* A screen that holds the text and can hand in another, as a form does. */
    function Holding() {
      const [value, setValue] = useState('Prvo')

      hand = setValue

      return (
        <MarkdownEditor
          id="opis"
          value={value}
          maxLength={200}
          leftId="l"
          label="Opis"
          onChange={(text) => {
            onChange(text)
            setValue(text)
          }}
          onLeave={() => undefined}
        />
      )
    }

    renderWithI18n(<Holding />)

    after('Prvo')
    await user.keyboard('!')

    /* Its own text came back as the value, and the box kept its cursor and its words. */
    expect(last(onChange)).toBe('Prvo!')
    expect(box()).toHaveTextContent('Prvo!')
    expect(box()).toHaveFocus()

    /* And somebody else's: a form put back. */
    act(() => hand('**Drugo**'))

    expect(within(box()).getByText('Drugo').tagName).toBe('STRONG')

    /* And the text handed in is written to as the one it replaced was, under the same limit. */
    after('Drugo')
    await user.keyboard('?')

    expect(last(onChange)).toBe('**Drugo?**')
  })

  it('shows every shape a written text has as the page shows it, and keeps a link while its words are typed into', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: '1. jedan\n2. dva\n\nVrednost `42` i [prva](https://a.example)' })

    expect(within(box()).getAllByRole('listitem').map((one) => one.textContent)).toEqual(['jedan', 'dva'])
    expect(within(box()).getByText('42').tagName).toBe('CODE')
    expect(within(box()).getByText('prva').closest('a')).toHaveAttribute('href', 'https://a.example')

    select('prva', 2)
    await user.keyboard('X')

    expect(last(onChange)).toBe('1. jedan\n2. dva\n\nVrednost `42` i [prXva](https://a.example)')
  })

  it('takes the cursor where it is asked to, and nowhere else', () => {
    draw({ value: 'Reči', autoFocus: true })

    expect(box()).toHaveFocus()
  })

  it('leaves with the text as it stands when the cursor goes to nothing at all', async () => {
    const { onLeave } = draw({ value: 'Reči' })

    act(() => box().focus())
    act(() => box().blur())

    expect(onLeave).toHaveBeenCalledWith('Reči')
  })
})
