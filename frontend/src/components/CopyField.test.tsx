import { render, screen } from '@testing-library/react'
import { withClipboard } from '../test/clipboard'
import { expectSeen } from '../test/visibility'
import { setupUser } from '../test/user'
import { CopyField } from './CopyField'

/**
 * `CopyField` on its own, with no `I18nProvider` and no session around it: it reads no
 * dictionary and no server, so every word here is a plain string chosen for the test
 * rather than a sentence a member would read. The words a member actually reads are
 * held where they are written, in `pages/memberFlows.test.tsx` for the referral link
 * and the PayPal fields alike.
 */
describe('a value with a button that copies it', () => {
  it('shows the label and the value, and names the button after the field', () => {
    render(
      <CopyField
        label="Naslov polja"
        value="vrednost-za-kopiranje"
        copyButtonLabel="Kopiraj naslov polja"
        copiedMessage="Kopirano."
        failedMessage="Nije kopirano."
      />,
    )

    expect(screen.getByText('Naslov polja')).toBeInTheDocument()
    expect(screen.getByText('vrednost-za-kopiranje')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kopiraj naslov polja' })).toBeInTheDocument()
  })

  it('draws no label where the value already reads as itself', () => {
    /* The referral link's own case (Membership.tsx): the heading and the sentence
       above it already say what the box holds, so this component is not handed one. */
    render(
      <CopyField
        value="https://example.test/registracija?preporuka=abc"
        copyButtonLabel="Kopiraj link za preporuku"
        copiedMessage="Link je kopiran."
        failedMessage="Kopiranje nije uspelo."
      />,
    )

    const valueBox = screen.getByText(
      'https://example.test/registracija?preporuka=abc',
    ).closest('p')

    expect(valueBox?.previousElementSibling, 'no label paragraph before the value').toBeNull()
  })

  it('says nothing until the button is pressed', () => {
    render(
      <CopyField
        label="Naslov polja"
        value="vrednost"
        copyButtonLabel="Kopiraj"
        copiedMessage="Kopirano."
        failedMessage="Nije kopirano."
      />,
    )

    /* The live region is present from the first render and empty until pressed
       (Membership.tsx, the same shape), so a screen reader is already watching it
       when there is finally something to announce - proved here by neither message
       being on the screen yet, rather than by selecting an empty paragraph nothing
       names. */
    expect(screen.queryByText('Kopirano.')).not.toBeInTheDocument()
    expect(screen.queryByText('Nije kopirano.')).not.toBeInTheDocument()
  })

  it('copies the value, and says so where a sighted member can read it', async () => {
    const user = setupUser()
    const writeText = vi.fn().mockResolvedValue(undefined)

    await withClipboard({ writeText }, async () => {
      render(
        <CopyField
          label="Adresa naloga"
          value="info@example.test"
          copyButtonLabel="Kopiraj adresu"
          copiedMessage="Adresa je kopirana."
          failedMessage="Kopiranje nije uspelo."
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Kopiraj adresu' }))

      expect(writeText).toHaveBeenCalledWith('info@example.test')
      expectSeen(await screen.findByText('Adresa je kopirana.'))
    })
  })

  it('says copying failed when the clipboard refuses, rather than leaving the value unread', async () => {
    const user = setupUser()

    await withClipboard(
      { writeText: vi.fn().mockRejectedValue(new Error('permission denied')) },
      async () => {
        render(
          <CopyField
            label="Iznos"
            value="43,00"
            copyButtonLabel="Kopiraj iznos"
            copiedMessage="Iznos je kopiran."
            failedMessage="Kopiranje nije uspelo. Kopiraj iznos ručno."
          />,
        )

        await user.click(screen.getByRole('button', { name: 'Kopiraj iznos' }))

        expectSeen(await screen.findByText('Kopiranje nije uspelo. Kopiraj iznos ručno.'))
        expect(screen.queryByText('Iznos je kopiran.')).not.toBeInTheDocument()
      },
    )
  })

  it('says copying failed when there is no clipboard to copy through', async () => {
    const user = setupUser()

    await withClipboard(undefined, async () => {
      render(
        <CopyField
          label="Napomena"
          value="20271"
          copyButtonLabel="Kopiraj napomenu"
          copiedMessage="Napomena je kopirana."
          failedMessage="Kopiranje nije uspelo. Kopiraj napomenu ručno."
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Kopiraj napomenu' }))

      expectSeen(await screen.findByText('Kopiranje nije uspelo. Kopiraj napomenu ručno.'))
    })
  })
})
