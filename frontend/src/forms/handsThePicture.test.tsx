import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import sr from '../i18n/sr.json'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import { FormRenderer } from './FormRenderer'
import type { FormDef } from './types'

/**
 * A PICTURE FIELD HANDS THE SCREEN THE FILE IT HOLDS, and nothing once it holds none (`onPicture`).
 *
 * <p>The owner, 28.11.2026: „Odradi i sliku kao dokaz uz rezultat". The form's value keeps the file's name, which
 * is what its rules read; the bytes are the screen's to send, and this is the one way they reach it.
 *
 * <p><b>Two boxes that could be confused, and only one is a picture</b>: a text box beside it, so a handler that
 * handed over whatever field changed would be told apart.
 */
const twoBoxes: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'rec', type: 'text', labelKey: 'proba.rec' },
    { name: 'slika', type: 'photo', labelKey: 'proba.slika' },
  ],
}

describe('a picture field', () => {
  it('hands the file to the screen when it is chosen, and nothing once it is thrown away', async () => {
    const user = setupUser()
    const handed = vi.fn()
    const file = new File(['sat'], 'snimak-sata.png', { type: 'image/png' })

    renderWithI18n(<FormRenderer form={twoBoxes} onSubmit={() => undefined} onPicture={handed} />)

    await user.type(screen.getByLabelText(/proba.rec/), 'reci')
    expect(handed).not.toHaveBeenCalled()

    await user.upload(screen.getByLabelText(/proba.slika/), file)
    expect(handed).toHaveBeenLastCalledWith(file)

    await user.click(screen.getByRole('button', { name: sr.form.clearPhoto }))
    expect(handed).toHaveBeenLastCalledWith(null)
    expect(handed).toHaveBeenCalledTimes(2)
  })
})
