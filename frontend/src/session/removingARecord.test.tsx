import { render, screen } from '@testing-library/react'
import { setupUser } from '../test/user'
import { SessionProvider } from './SessionProvider'
import { useSession } from './useSession'

/**
 * A RECORD ENTERED IN THIS VISIT AND THEN REMOVED GOES ALTOGETHER, AND SO DO THE CHANGES KEPT AGAINST IT.
 *
 * <p>The overlay of changes is keyed by identity, and an identity is really freed by a deletion (PDL P23): a
 * record entered later under a freed identity must not inherit the edits of the one that is gone, and a
 * deletion entry must not swallow the next record entered under the same identity. Two records stand in
 * one entity here so that „this one is gone" and „the entity is empty" are told apart.
 */
function Probe() {
  const { create, creations, deletions, edit, edits, remove } = useSession()

  return (
    <>
      <span data-testid="made">{(creations.teams ?? []).map((one) => one.id).join(',')}</span>
      <span data-testid="removed">{(deletions.teams ?? []).join(',')}</span>
      <span data-testid="edited">{Object.keys(edits).join(',')}</span>
      <button
        type="button"
        onClick={() => {
          create('teams', '-1', { name: 'Prvi' })
          create('teams', '-2', { name: 'Drugi' })
          edit('-1', 'name', 'Izmenjen')
        }}
      >
        unesi
      </button>
      <button
        type="button"
        onClick={() => {
          remove('teams', '-1')
        }}
      >
        ukloni
      </button>
    </>
  )
}

describe('removing a record entered in this visit', () => {
  it('drops that record and the changes kept against it, and leaves the other one standing', async () => {
    const user = setupUser()

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'unesi' }))

    expect(screen.getByTestId('made')).toHaveTextContent('-2,-1')
    expect(screen.getByTestId('edited')).toHaveTextContent('-1')

    await user.click(screen.getByRole('button', { name: 'ukloni' }))

    expect(screen.getByTestId('made')).toHaveTextContent(/^-2$/)
    expect(screen.getByTestId('removed')).toHaveTextContent('-1')
    expect(screen.getByTestId('edited')).toBeEmptyDOMElement()
  })
})
