import { configure, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import members from '../../test/mock/members.json'
import { memberRowOf as rowOf } from '../../test/memberRow'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'

configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE MARK VIBER WITH HIS NUMBER ON THE ROW OF A MEMBER WHO ASKED TO JOIN THE LEAGUE'S COMMUNITY ON VIBER (owner,
 * PDL P36, 20.11.2026: „Ko je štiklirao, vidi se na ekranu Moderacija članova, oznakom Viber uz broj telefona, a
 * vlasnik ga ručno dodaje u zajednicu").
 *
 * <p>The sample's one member who asked is neither the first row nor the last, and the rows beside him are read
 * too, so a row that drew the mark on everybody, on nobody, or with another member's number is told apart.
 */
describe('the mark Viber on a member’s row', () => {
  const asked = members.filter((one) => 'viberPhone' in one)

  it('is drawn with his own number under his name, and on nobody else’s row', async () => {
    expect(asked.map((one) => one.memberNumber), 'the sample does not hold exactly one member who asked').toEqual([
      '000006',
    ])

    renderAt('/sr/administracija/clanovi', 'superadmin')

    const his = await rowOf('000006')

    expect(within(his).getByText('Viber').parentElement).toHaveTextContent(/^Viber \+381 64 123 4567$/)

    for (const number of ['000001', '000005', '000007']) {
      expect(within(await rowOf(number)).queryByText('Viber'), `the row of ${number} carries the mark`).toBeNull()
    }
  }, SLOW)
})
