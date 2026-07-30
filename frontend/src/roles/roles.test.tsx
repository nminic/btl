import { render, screen } from '@testing-library/react'
import { setupUser } from '../test/user'
import { I18nProvider } from '../i18n/I18nProvider'
import { isMember, isStaff } from './context'
import { roleSwitchEnabled } from './devTools'
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
      <RoleProvider initialRole={initial}>
        <RoleSwitch />
        <CurrentRole />
      </RoleProvider>
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

  it('offers the moderators by name, because a moderator is not a role', async () => {
    const user = setupUser()
    renderSwitch()

    /* What a moderator may do is granular by entity and by action, and every one
       of them holds a different set (PDL P21), so becoming "a moderator" is not
       something anybody can do: the choice is which one. Until this was here,
       nothing connected the person at the keyboard to a row in the matrix of
       rights, and sixteen ticked boxes changed nothing on any screen. */
    const chooser = screen.getByLabelText('Uloga')
    const named = await screen.findByRole('option', { name: 'Milena Šarić' })

    expect(named).toBeInTheDocument()
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

  it('does not exist in a production build', () => {
    vi.stubEnv('DEV', false)

    renderSwitch()
    expect(screen.queryByLabelText('Uloga')).not.toBeInTheDocument()

    vi.unstubAllEnvs()
  })

  it('exists in the QA build, which is a production build with the flag set', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ROLE_SWITCH', '1')

    renderSwitch()
    expect(screen.getByLabelText('Uloga')).toBeVisible()

    vi.unstubAllEnvs()
  })
})

describe('roleSwitchEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is on in development', () => {
    vi.stubEnv('DEV', true)
    expect(roleSwitchEnabled()).toBe(true)
  })

  it('is on when the build asked for it', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ROLE_SWITCH', '1')
    expect(roleSwitchEnabled()).toBe(true)
  })

  it('is off in a production build that did not ask for it', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ROLE_SWITCH', '')
    expect(roleSwitchEnabled()).toBe(false)
  })
})
