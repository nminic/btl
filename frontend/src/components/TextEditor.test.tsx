import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithI18n } from '../test/render'

/* The wrapper as it is on the portal. Every other file is handed the editor itself in its place
   (`test/setup.ts` says why), so this is the one case that sees it load. */
const { TextEditor } = await vi.importActual<typeof import('./TextEditor')>('./TextEditor')

describe('the editor of a written text, as the portal loads it', () => {
  it('holds its place while it loads, takes no key there, and is the editor once it has', async () => {
    const { container } = renderWithI18n(
      <TextEditor
        id="opis"
        value="**Reči**"
        maxLength={100}
        leftId="opis-left"
        label="Opis"
        onChange={() => undefined}
        onLeave={() => undefined}
      />,
    )

    /* The place first: nothing that could be typed into, no button, and no words. */
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.textContent).toBe('')

    /* And then the editor, with the text it was handed. */
    const box = await screen.findByRole('textbox', { name: 'Opis' })

    expect(within(box).getByText('Reči').tagName).toBe('STRONG')
    expect(screen.getByRole('button', { name: 'Podebljano' })).toBeVisible()
  })
})
