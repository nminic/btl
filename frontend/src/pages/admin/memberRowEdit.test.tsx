import { configure, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { memberRowOf as rowOf } from '../../test/memberRow'
import { renderAt } from '../../test/render'
import { membersAsServed } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

/**
 * „IZMENI PODATKE" ON A MEMBER'S ROW (owner, 22.10.2026: „Dugme Edit otvara popunjenu formu sa svim
 * podacima kao registracionu, samo bez lozinke"), and where it leads: the card „Podaci" of that member's
 * profile, at the address his profile has, and by the number alone where the public list does not carry
 * him (`MemberRow.tsx`). Two rows, so the address of one cannot pass for the other's.
 */
describe('the pencil on a member’s row', () => {
  it('leads to the card „Podaci" at the address of his profile, named for him', async () => {
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf('000001')
    const other = await rowOf('000007')
    const edit = within(row).getByRole('link', { name: 'Izmeni podatke: Vladan Đurišić' })

    expect(edit).toHaveAttribute('href', '/sr/takmicar/000001-vladan-durisic/podaci')
    expect(within(other).getByRole('link', { name: /^Izmeni podatke: / })).toHaveAttribute(
      'href',
      '/sr/takmicar/000007-strahinja-vukicevic/podaci',
    )
  }, SLOW)

  it('leads by the number alone for a member the public list does not carry', async () => {
    const user = setupUser()

    stops.push(membersAsServed().stop)
    renderAt('/sr/administracija/clanovi', 'superadmin')

    await screen.findByRole('table', { name: 'Članovi' })
    await user.selectOptions(screen.getByLabelText('Članstvo'), 'Neaktivni')

    const row = await rowOf('000032')

    expect(within(row).getByRole('link', { name: /^Izmeni podatke: / })).toHaveAttribute(
      'href',
      '/sr/takmicar/000032/podaci',
    )
  }, SLOW)
})
