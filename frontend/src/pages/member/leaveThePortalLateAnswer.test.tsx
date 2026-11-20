import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ClockProvider } from '../../clock/ClockProvider'
import { I18nProvider } from '../../i18n/I18nProvider'
import { RoleProvider } from '../../roles/RoleProvider'
import { SessionProvider } from '../../session/SessionProvider'
import { LeaveThePortal } from './LeaveThePortal'

/**
 * AN ANSWER THAT ARRIVES FOR SOMEBODY WHO IS NO LONGER READING DRAWS NOTHING.
 *
 * <p>`LeaveThePortal` asks the server whether he may leave, and the answer is keyed to the account it was asked for. The
 * road that makes an answer late is a real one: a second person signs in on the same laptop while the first person's
 * question is still on its way, so the screen asks again for the second account. The answers are let go by hand here, in
 * the order that hurts: the second account's yes first, then the first account's no. A screen that took the late no would
 * drop the button the second account was given.
 *
 * <p>Its own file because the reader of `mayLeave` is replaced by one whose answers the case releases, which no other case
 * of the screen wants.
 */
const released: ((may: boolean) => void)[] = []

vi.mock('../../session/theServer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../session/theServer')>()),
  whatTheServerSaysOfMyLeaving: () =>
    new Promise<boolean>((resolve) => {
      released.push(resolve)
    }),
}))

function TwoReadersOneLaptop() {
  const [account, setAccount] = useState(1)

  return (
    <>
      <button type="button" onClick={() => setAccount(2)}>
        Drugi nalog
      </button>
      <LeaveThePortal account={account} />
    </>
  )
}

describe('a late answer', () => {
  it('about the first account does not overwrite the second account’s yes', async () => {
    render(
      <ClockProvider simulatedDay={null}>
        <RoleProvider initialRole="visitor" initialModerator={null}>
          <SessionProvider initialMemberNumber={null}>
            <I18nProvider locale="sr">
              <MemoryRouter>
                <TwoReadersOneLaptop />
              </MemoryRouter>
            </I18nProvider>
          </SessionProvider>
        </RoleProvider>
      </ClockProvider>,
    )

    /* The first account's question is out, and nothing is drawn while it is. */
    expect(released).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Obriši nalog' })).toBeNull()

    /* The second person signs in before the first answer arrives, and the screen asks again. */
    act(() => screen.getByRole('button', { name: 'Drugi nalog' }).click())
    expect(released).toHaveLength(2)

    await act(async () => {
      released[1]?.(true)
    })

    expect(screen.getByRole('button', { name: 'Obriši nalog' })).toBeInTheDocument()

    /* And now the first account's answer, late, and a no. */
    await act(async () => {
      released[0]?.(false)
    })

    expect(screen.getByRole('button', { name: 'Obriši nalog' })).toBeInTheDocument()
  })
})
