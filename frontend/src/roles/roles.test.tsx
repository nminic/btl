import { fireEvent, render, screen } from '@testing-library/react'
import { setupUser } from '../test/user'
import { I18nProvider } from '../i18n/I18nProvider'
import { SessionProvider } from '../session/SessionProvider'
import { isMember, isStaff } from './context'
import { RoleProvider } from './RoleProvider'
import { RoleSwitch } from './RoleSwitch'
import { useRole } from './useRole'

function CurrentRole() {
  const { role, moderator } = useRole()

  return (
    <>
      <span data-testid="uloga">{role}</span>
      <span data-testid="ko">{moderator === null ? 'niko' : moderator.id}</span>
    </>
  )
}

function renderSwitch(initial?: 'visitor' | 'competitor' | 'moderator' | 'superadmin') {
  return render(
    <I18nProvider locale="sr">
      {/* The switch reads what administration has deleted, so a moderator who
          has been removed stops being somebody it can become. */}
      <SessionProvider>
        <RoleProvider initialRole={initial}>
          <RoleSwitch />
          <CurrentRole />
        </RoleProvider>
      </SessionProvider>
    </I18nProvider>,
  )
}

describe('role helpers', () => {
  it('treats everyone but a visitor as a member', () => {
    expect(isMember('visitor')).toBe(false)
    expect(isMember('competitor')).toBe(true)
    expect(isMember('superadmin')).toBe(true)
  })

  it('treats moderators and the superadmin as staff', () => {
    expect(isStaff('visitor')).toBe(false)
    expect(isStaff('competitor')).toBe(false)
    expect(isStaff('moderator')).toBe(true)
    expect(isStaff('superadmin')).toBe(true)
  })
})

describe('RoleProvider', () => {
  it('starts as a visitor when nothing is given', () => {
    renderSwitch()
    expect(screen.getByTestId('uloga')).toHaveTextContent('visitor')
  })

  it('accepts a starting role', () => {
    renderSwitch('moderator')
    expect(screen.getByTestId('uloga')).toHaveTextContent('moderator')
  })
})

describe('useRole', () => {
  it('refuses to work outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<CurrentRole />)).toThrow('useRole must be used inside RoleProvider')

    spy.mockRestore()
  })
})

describe('RoleSwitch', () => {
  it('changes the role', async () => {
    const user = setupUser()
    renderSwitch()

    await user.selectOptions(screen.getByLabelText('Uloga'), 'superadmin')

    expect(screen.getByTestId('uloga')).toHaveTextContent('superadmin')
  })

  it('offers the moderators one by one, because a moderator is not a role', async () => {
    const user = setupUser()
    renderSwitch()

    /* What a moderator may do is granular by entity and by action, and every one
       of them holds a different set (PDL P21), so becoming "a moderator" is not
       something anybody can do: the choice is which one. Until this was here,
       nothing connected the person at the keyboard to a row in the matrix of
       rights, and sixteen ticked boxes changed nothing on any screen.

       By initials rather than by name (owner, 30.07.2026): a select is as wide
       as its widest choice, and Aleksandra Milovanović-Stefanović was pushing
       the rest of the header onto a second line. Every part of a double surname
       keeps its letter, so nobody becomes anybody else. */
    const chooser = screen.getByLabelText('Uloga')
    const named = await screen.findByRole('option', { name: 'M. Š.' })

    expect(named).toBeInTheDocument()
    expect(named).toHaveAttribute('title', 'Milena Šarić')
    expect(screen.getByRole('option', { name: 'A. M.-S.' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Moderator' })).not.toBeInTheDocument()

    await user.selectOptions(chooser, 'moderator:mod-saric')

    expect(screen.getByTestId('uloga')).toHaveTextContent('moderator')
    expect(screen.getByTestId('ko')).toHaveTextContent('mod-saric')
  })

  it('lets go of the moderator when the choice is not one', async () => {
    const user = setupUser()
    renderSwitch()

    await user.selectOptions(await screen.findByLabelText('Uloga'), 'moderator:mod-saric')
    await user.selectOptions(screen.getByLabelText('Uloga'), 'superadmin')

    /* A role and a moderator that could drift apart would be a superadmin
       carrying somebody else's rights, so they are set together and never
       separately. */
    expect(screen.getByTestId('ko')).toHaveTextContent('niko')
  })

  it('becomes nothing at all when the answer is neither a role nor a moderator', async () => {
    const user = setupUser()
    renderSwitch()

    await user.selectOptions(await screen.findByLabelText('Uloga'), 'superadmin')

    /* The control offers no such choice, so the only road here is from outside
       it. The word used to be taken for a role and passed straight on
       (`event.target.value as Role`), which is the assertion ADL A14 bans: it
       says a thing is a role instead of looking, so anything at all became one
       and every check of rights after it was answering about a role that does
       not exist. Now a word that is not a role is not one, and the person at
       the keyboard stays who they were. */
    fireEvent.change(screen.getByLabelText('Uloga'), { target: { value: 'predsednik' } })

    expect(screen.getByTestId('uloga')).toHaveTextContent('superadmin')
  })

  it('does not exist in a production build', () => {
    vi.stubEnv('DEV', false)

    renderSwitch()
    expect(screen.queryByLabelText('Uloga')).not.toBeInTheDocument()

    vi.unstubAllEnvs()
  })

  it('exists in the QA build, which is a production build with the flag set', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEV_TOOLS', '1')

    renderSwitch()
    expect(screen.getByLabelText('Uloga')).toBeVisible()

    vi.unstubAllEnvs()
  })

  it('carries no word beside it, only the name it answers to', () => {
    /* The dashed frame and the word ULOGA are gone (owner, 30.07.2026): the
       header names places, and a development control that announced itself made
       a finished header look unfinished on the one environment the owner walks
       the portal through. The name has to stay for anyone who cannot see which
       control it is. */
    renderSwitch()

    expect(screen.getByLabelText('Uloga')).toBeVisible()
    expect(screen.queryByText('Uloga')).not.toBeInTheDocument()
  })
})
