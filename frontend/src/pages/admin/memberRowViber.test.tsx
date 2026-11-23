import { act, configure, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { clearResourceCache } from '../../data/client'
import sr from '../../i18n/sr.json'
import members from '../../test/mock/members.json'
import { memberRowOf as rowOf } from '../../test/memberRow'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

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

  /**
   * AND IT FOLLOWS THE BOX THE ADMINISTRATION TICKS ON THE CARD „PODACI" (owner, 23.11.2026, PDL „Tri brze izmene
   * administracije", the derived rule: „Oznaka „Viber <broj>” u Moderaciji članova prati isti podatak."). The list
   * of the members is kept for the whole visit (`data/client.ts`), so the row can draw the mark only by asking the
   * server again once the card has saved; the server is the only source of the new row, and a second read of the
   * list is counted, not assumed.
   */
  it('follows the box ticked on the card, by the list being read again', async () => {
    const user = setupUser()
    let ticked = false
    const { asked, stop } = serverThat((path, init) => {
      if (path === '/api/members' && (init?.method ?? 'GET') === 'GET') {
        return json(
          members.map((one) => (one.memberNumber === '000001' && ticked ? { ...one, viberPhone: '060111222' } : one)),
        )
      }

      if (path === '/api/members/000001/data') {
        if (init?.method === 'PUT') {
          ticked = true
        }

        return json({
          memberNumber: '000001', firstName: 'Vladan', lastName: 'Đurišić', fatherName: 'Petar', gender: 'M',
          birthDate: '1980-04-02', idNumber: 'AB12345', email: 'vladan@primer.rs', emailConfirmed: false,
          viberCommunity: ticked, address: 'Bulevar 1', phone: '060111222', placeId: null, city: 'Beograd',
          country: 'RS', shirtSize: 'L', bio: null, photo: null, crop: null,
        })
      }

      return null
    })

    clearResourceCache()
    const { router } = renderAt('/sr/administracija/clanovi', 'superadmin')

    expect(within(await rowOf('000001')).queryByText('Viber')).toBeNull()

    await user.click(within(await rowOf('000001')).getByRole('link', { name: 'Izmeni podatke: Vladan Đurišić' }))
    await user.click(await screen.findByRole('checkbox', { name: sr.registration.viberCommunity }))
    await user.click(screen.getByRole('button', { name: sr.account.save }))
    expect(await screen.findByText(sr.account.saved)).toBeVisible()

    await act(async () => {
      await router.navigate(-1)
    })

    expect(within(await rowOf('000001')).getByText('Viber').parentElement).toHaveTextContent(/^Viber 060111222$/)
    expect(asked.filter((one) => one.path === '/api/members' && (one.init?.method ?? 'GET') === 'GET')).toHaveLength(2)
    stop()
  }, SLOW)
})

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}
