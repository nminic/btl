import { act, fireEvent, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState } from 'react'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import { at } from '../../test/at'
import { renderWithI18n } from '../../test/render'
import { ruleFor } from '../../test/stylesheet'
import { setupUser } from '../../test/user'
import MarkdownEditor from './MarkdownEditor'
import type { EditorProps } from './props'

/* The editor on a screen: what a writer meets, presses and types. What the buttons do to a text is
   held without a screen (`commands.test.ts`); here, that the screen asks them, says what they did,
   and can be used from the keyboard alone. */

const TOOLBAR = ['Podebljano', 'Kurziv', 'Naslov', 'Spisak', 'Veza']
/* What each of them shows (owner, 17.10.2026: „simboli nalik Word paleti (B, I, U i sl)"): three
   letters, and a drawing for the list and for the link, which says no letters of its own. */
const SYMBOLS = ['B', 'I', 'H', '', '']

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
  it('is a box with a name, and five buttons that show symbols and are named by their words', async () => {
    draw({ value: 'Reči' })

    expect(box()).toHaveAttribute('aria-multiline', 'true')
    expect(box()).toHaveTextContent('Reči')

    const tools = within(screen.getByRole('group', { name: 'Oblikovanje teksta' })).getAllByRole('button')

    /* Five and in the owner's order, and no sixth for underlining (owner, 17.10.2026: „Ne treba"). */
    expect(tools).toHaveLength(TOOLBAR.length)
    expect(tools.map((one) => one.textContent)).toEqual(SYMBOLS)

    for (const [index, one] of tools.entries()) {
      /* A symbol is no name (WCAG 2.2 SC 1.1.1), so each is named by its word, and shows the same
         word where a pointer rests on it. */
      expect(one).toHaveAccessibleName(at(TOOLBAR, index))
      expect(one).toHaveAttribute('title', at(TOOLBAR, index))
      expect(one).not.toBeDisabled()
    }

    expect(tool('Veza')).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('meets every rule axe can ask of it, with the box for a link open', async () => {
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

  it('numbers an item made with Enter one more than the item above, and the items below keep their numbers', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: '1. mesto\n2. mesto\n4. do 10. mesto\n9. kraj', maxLength: 500 })

    after('do 10. mesto')
    await user.keyboard('{Enter}novo')

    expect(last(onChange)).toBe('1. mesto\n2. mesto\n4. do 10. mesto\n5. novo\n9. kraj')

    select('do 10. mesto', 2)
    await user.keyboard('{Enter}')

    expect(last(onChange)).toBe('1. mesto\n2. mesto\n4. do\n5. 10. mesto\n6. novo\n9. kraj')
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
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  /* The owner, 17.10.2026: „kad otkucam nešto nalik mail adresi, treba da ga pretvoriš automatski u
     link za slanje maila." The page makes the link; the box shows it as one the moment it is typed,
     and the stylesheet draws what the box marks the way a link is drawn. The two are held together
     here, since a class the sheet does not know is a mailbox drawn as words. */
  it('shows a typed mailbox as the link the page will make of it, and keeps it as typed', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Piši na' })

    after('Piši na')
    await user.keyboard(' info@primer.rs.')

    expect(last(onChange)).toBe('Piši na info@primer.rs.')
    expect(screen.getByText('info@primer.rs')).toHaveClass('md-editor__mail')

    const sheet = readFileSync(join(process.cwd(), 'src/components/markdownEditor/MarkdownEditor.css'), 'utf8')
    const drawn = ruleFor(sheet, '.md-editor__area.markdown .md-editor__mail', 'MarkdownEditor.css')

    expect(drawn.getPropertyValue('text-decoration')).toBe('underline')
    expect(drawn.getPropertyValue('color')).toBe('var(--accent)')
  })
})

/* The owner, 17.10.2026 (PDL „Ispravke sa ekrana 17.10.2026"): „Treba da izbaci boks u koji se upišu
   Ispis i Link. Ispis je ono što piše, a link ono gde zapravo vodi. https:// ne treba uopšte da
   popunjavam nego da se podrazumeva (dakle ti ga dodaj automatski)." What each address becomes is
   held without a screen (`commands.test.ts`, `hrefFor`); here, that the box asks it and says what it
   said. */
describe('a link, from the box for a link', () => {
  const sheet = () => screen.getByRole('dialog', { name: 'Veza' })
  const words = () => within(sheet()).getByRole('textbox', { name: 'Ispis' })
  const address = () => within(sheet()).getByRole('textbox', { name: 'Link' })
  const press = (name: string) => within(sheet()).getByRole('button', { name })

  it('is a sheet over the page with its name, its two fields and its buttons', async () => {
    const user = setupUser()

    draw({ value: 'Reči' })
    await user.click(box())
    await user.click(tool('Veza'))

    expect(sheet()).toHaveAttribute('aria-modal', 'true')
    expect(within(sheet()).getAllByRole('textbox')).toEqual([words(), address()])
    expect(within(sheet()).getAllByRole('button').map((one) => one.textContent)).toEqual(['Dodaj', 'Otkaži'])
  })

  it('starts Ispis with the selected words and the cursor in Link, and adds https:// itself', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Vidi sajt' })

    select('sajt', 0, 4)
    await user.click(tool('Veza'))

    expect(words()).toHaveValue('sajt')
    expect(address()).toHaveValue('')
    expect(address()).toHaveFocus()

    await user.keyboard('runtrace.net/lige{Enter}')

    expect(last(onChange)).toBe('Vidi [sajt](https://runtrace.net/lige)')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(box()).toHaveFocus()
  })

  it('takes the words typed into Ispis, and the cursor starts there when nothing is selected', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Pišite' })

    after('Pišite')
    await user.click(tool('Veza'))

    expect(words()).toHaveValue('')
    expect(words()).toHaveFocus()

    await user.keyboard(' nam')
    await user.type(address(), 'info@runtrace.net')
    await user.click(press('Dodaj'))

    expect(last(onChange)).toBe('Pišite[nam](mailto:info@runtrace.net)')
  })

  it('makes the address its words where Ispis is left empty, and a mailbox a link to write to it', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Reči' })

    after('Reči')
    await user.click(tool('Veza'))
    await user.type(address(), 'info@runtrace.net{Enter}')

    expect(last(onChange)).toBe('Reči[info@runtrace.net](mailto:info@runtrace.net)')
  })

  it('says where the link leads is missing, beside the field and with the cursor taken there', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Reči' })

    after('Reči')
    await user.click(tool('Veza'))
    await user.type(words(), 'BTL{Enter}')

    expect(address()).toHaveAttribute('aria-invalid', 'true')
    expect(address()).toHaveAccessibleDescription('Upiši gde veza vodi.')
    expect(address()).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses an address a page may not lead to, and one that reads as one host and opens another, and says why', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Vidi sajt' })

    select('sajt', 0, 4)
    await user.click(tool('Veza'))

    for (const typed of [
      'javascript:alert(1)',
      'www.runtrace.net@zlo.example',
      'https://www.runtrace.net@zlo.example',
      'http://www.runtrace.net@zlo.example',
      'info@rüntrace.net',
    ]) {
      await user.clear(address())

      expect(address(), typed).toHaveAttribute('aria-invalid', 'false')

      await user.type(address(), typed)
      await user.click(press('Dodaj'))

      expect(address(), typed).toHaveAttribute('aria-invalid', 'true')
      expect(address(), typed).toHaveAccessibleDescription(/Upiši adresu sajta .* ne sme da ima „@“/)
      expect(address(), typed).toHaveFocus()
      expect(onChange, typed).not.toHaveBeenCalled()
    }

    await user.clear(address())
    await user.type(address(), 'medium.com/@ime/post{Enter}')

    expect(last(onChange)).toBe('Vidi [sajt](https://medium.com/@ime/post)')
  })

  it('keeps the link with Enter in either field, and not by sending the form it stands in', async () => {
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
    await user.type(address(), '/pravilnik')
    await user.type(words(), 'pravilnik{Enter}')

    expect(sent).not.toHaveBeenCalled()
    expect(last(onChange)).toBe('Reči[pravilnik](/pravilnik)')
  })

  it('opens again over the link the cursor stands in with both fields filled, changes both, and takes it off', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'A [prva](https://a.example) b' })

    select('prva', 2)
    await user.click(tool('Veza'))

    expect(words()).toHaveValue('prva')
    expect(address()).toHaveValue('https://a.example')
    expect(words()).toHaveFocus()

    await user.clear(words())
    await user.type(words(), 'prvi sajt')
    await user.clear(address())
    await user.type(address(), 'c.example{Enter}')

    expect(last(onChange)).toBe('A [prvi sajt](https://c.example) b')

    select('prvi', 2)
    await user.click(tool('Veza'))
    await user.click(press('Ukloni vezu'))

    expect(last(onChange)).toBe('A prvi sajt b')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes with Escape or with Otkaži, changes nothing, and puts the cursor back into the text', async () => {
    const user = setupUser()
    const { onChange } = draw({ value: 'Reči' })
    /* Where the menus of the page wait for Escape (`app/Dropdown.tsx`): the press that closes the
       sheet must not reach them, or it shuts a menu left open behind it as well. */
    const heard: string[] = []
    const listen = (pressed: KeyboardEvent) => heard.push(pressed.key)

    document.addEventListener('keydown', listen)

    try {
      await user.click(box())
      await user.click(tool('Veza'))
      await user.type(address(), 'primer.rs')
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(box()).toHaveFocus()
      expect(heard).not.toContain('Escape')
      /* Heard at all, so what is measured is the stopping and not a listener that hears nothing. */
      expect(heard).toContain('p')

      await user.click(tool('Veza'))

      /* No link to take off where the cursor stands, so no button that would. */
      expect(within(sheet()).queryByRole('button', { name: 'Ukloni vezu' })).toBeNull()
      /* And what was typed before Escape is gone with the sheet. */
      expect(address()).toHaveValue('')

      await user.click(press('Otkaži'))

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(box()).toHaveFocus()
      expect(onChange).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', listen)
    }
  })

  it('holds Tab inside the sheet both ways, and a press outside it closes nothing', async () => {
    const user = setupUser()

    draw({ value: 'Reči' })
    await user.click(box())
    await user.click(tool('Veza'))

    expect(words()).toHaveFocus()

    await user.tab()
    expect(address()).toHaveFocus()
    await user.tab()
    expect(press('Dodaj')).toHaveFocus()
    await user.tab()
    expect(press('Otkaži')).toHaveFocus()
    await user.tab()
    expect(words()).toHaveFocus()
    await user.tab({ shift: true })
    expect(press('Otkaži')).toHaveFocus()
    await user.tab({ shift: true })
    expect(press('Dodaj')).toHaveFocus()

    /* The backdrop the sheet stands on. */
    await user.click(sheet().parentElement ?? document.body)

    expect(sheet()).toBeVisible()
  })

  it('does not leave the editor while the address is typed', async () => {
    const user = setupUser()
    const { onLeave } = draw({ value: 'Reči' })

    await user.click(box())
    await user.click(tool('Veza'))
    await user.type(address(), 'https://primer.rs')
    await user.type(words(), 'primer')

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
