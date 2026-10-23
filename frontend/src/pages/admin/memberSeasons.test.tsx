import { fireEvent, screen, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import type { Member } from '../../data/types'
import { must } from '../../test/at'
import { asMember, person } from '../../test/plate'
import { renderAt } from '../../test/render'
import { seasonsOf } from '../../test/memberRow'
import { serverThat } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { addressOf } from '../profileAddress'

/**
 * THE MODERATION OF THE MEMBERS SHOWS THE INACTIVE ONES BEHIND A FILTER, AND EVERY SEASON OF EACH
 * (owner, 18.10.2026, PDL P8; the three values of the filter, 21.09.2026).
 *
 * **NOTHING IN THE FIXTURE IS THE ONLY ONE OF ITS KIND, AND EVERY SECOND SOURCE IS SEPARATED:**
 *
 * - **The season on sale is not the last season he holds, nor the first.** Since 22.10.2026 the column
 *   „Osnov" is the basis of the season on sale and the closed list of seasons shows that season with
 *   its box (owner, „Osnov je osnov sezone prikazane u koloni Sezone"; the coordinator's answer, P6).
 *   2028 is on sale for everybody here: Ana holds it on her balance and 2027 on a payment, so a word
 *   read off her first season says „Uplata"; Bora holds 2027 only, so a word read off his last season
 *   says „Uplata" where he holds nothing of 2028, and a box read off it is ticked.
 * - **Active is not „holds a season".** Ceca holds one and her fee has lapsed; Dule holds none and
 *   his has lapsed too.
 * - **The link to a profile comes from the public list, which is served in another order**: Bora
 *   stands first there and Ana first here, so a link taken off the wrong record goes to Bora.
 * - **Served neither by number nor by name**, so a screen that sorted its own copy would show it.
 */
describe('the moderation of the members', () => {
  const ana = person('000009', 'Ana', 'Aktivna', {
    membershipBasis: 'balance',
    membershipSeason: 2028,
  })
  const bora = person('000003', 'Bora', 'Bezobnove', {
    membershipBasis: undefined,
    membershipSeason: undefined,
  })
  const ceca = person('000006', 'Ceca', 'Celić', {
    membershipBasis: undefined,
    membershipSeason: undefined,
  })
  const dule = person('000012', 'Dule', 'Džonić', {
    membershipBasis: undefined,
    membershipSeason: undefined,
  })

  const MEMBERS: Member[] = [
    asMember(ana, {
      seasonOnSale: 2028,
      seasons: [
        { season: 2027, basis: 'payment' },
        { season: 2028, basis: 'balance' },
      ],
    }),
    asMember({ ...ceca, gender: 'F' }, { active: false, seasonOnSale: 2028, seasons: [{ season: 2027, basis: 'feeExempt' }] }),
    asMember(bora, { seasonOnSale: 2028, seasons: [{ season: 2027, basis: 'payment' }] }),
    asMember(dule, { active: false, seasonOnSale: 2028 }),
  ]

  /** The public list holds the two whose fee stands, and Bora first. */
  const PUBLIC = [bora, ana]

  function serving() {
    clearResourceCache()

    return serverThat((path, init) => {
      if ((init?.method ?? 'GET') !== 'GET') {
        return null
      }

      const body = path === '/api/members' ? MEMBERS : path === '/api/competitors' ? PUBLIC : null

      return body === null
        ? null
        : new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
    })
  }

  async function table() {
    return screen.findByRole('table', { name: 'Članovi' })
  }

  /** The member numbers of the rows drawn, in the order they are drawn. */
  function numbers(drawn: HTMLElement): string[] {
    return within(drawn)
      .getAllByRole('row')
      .slice(1)
      .map((row) => must(within(row).getByText(/^\d{6}$/).textContent, 'a number'))
  }

  /** One cell of the row of a member, found by the header of its column. */
  function cell(drawn: HTMLElement, memberNumber: string, header: string): HTMLElement {
    const column = within(drawn)
      .getAllByRole('columnheader')
      .findIndex((one) => one.textContent === header)

    expect(column, `a column called ${header}`).toBeGreaterThan(-1)

    const row = must(
      within(drawn).getByText(memberNumber).closest('tr'),
      `the row of ${memberNumber}`,
    )

    return must(row.querySelectorAll('td')[column], `the cell ${header} of ${memberNumber}`)
  }

  it('opens on the active members, which are exactly the public list', async () => {
    const server = serving()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const drawn = await table()

    expect(screen.getByLabelText('Članstvo')).toHaveValue('active')
    expect(numbers(drawn)).toEqual(['000009', '000003'])

    server.stop()
  })

  it('shows the inactive ones alone, or everybody, when that is chosen', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const drawn = await table()

    await user.selectOptions(screen.getByLabelText('Članstvo'), 'Neaktivni')
    expect(numbers(drawn)).toEqual(['000006', '000012'])
    /* The sentence with the count follows the filter rather than the whole answer. */
    expect(screen.getByText('2 takmičara')).toBeVisible()

    await user.selectOptions(screen.getByLabelText('Članstvo'), 'Svi')
    expect(numbers(drawn)).toEqual(['000009', '000006', '000003', '000012'])
    expect(screen.getByText('4 takmičara')).toBeVisible()

    server.stop()
  })

  it('keeps the filter it holds when the control hands back a word it does not offer', async () => {
    /* A select set to an option it does not have reports nothing chosen, so what the handler reads
       is not a filter; it is looked for among the three rather than declared one (ADL A14), the
       same as `RoleSwitch` (`roles/roles.test.tsx`). */
    const server = serving()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const drawn = await table()

    fireEvent.change(screen.getByLabelText('Članstvo'), { target: { value: 'bivsi' } })

    expect(numbers(drawn)).toEqual(['000009', '000003'])

    server.stop()
  })

  it('narrows the chosen filter by the search, and never widens it', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const drawn = await table()

    await user.selectOptions(screen.getByLabelText('Članstvo'), 'Neaktivni')
    await user.type(screen.getByLabelText('Pretraga'), 'Ana')

    expect(within(drawn).getAllByRole('row')).toHaveLength(1)

    server.stop()
  })

  it('ticks every season of a member he holds, from the first of the league to the one on sale', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const drawn = await table()
    await user.selectOptions(screen.getByLabelText('Članstvo'), 'Svi')

    const ticked = async (memberNumber: string) => {
      const list = await seasonsOf(user, cell(drawn, memberNumber, 'Sezone'))

      return within(list)
        .getAllByRole('checkbox')
        .map((box) => `${box.closest('label')?.textContent ?? ''} ${box instanceof HTMLInputElement && box.checked ? 'da' : 'ne'}`)
    }

    expect(await ticked('000009')).toEqual(['2027 da', '2028 da'])
    expect(await ticked('000006')).toEqual(['2027 da', '2028 ne'])
    expect(await ticked('000003')).toEqual(['2027 da', '2028 ne'])
    expect(await ticked('000012')).toEqual(['2027 ne', '2028 ne'])

    server.stop()
  })

  it('says the basis of the season on sale, and shows that season with its box, not the last he holds', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const drawn = await table()
    await user.selectOptions(screen.getByLabelText('Članstvo'), 'Svi')

    const basis = (memberNumber: string) => cell(drawn, memberNumber, 'Osnov').textContent
    const shown = (memberNumber: string) =>
      within(cell(drawn, memberNumber, 'Sezone')).getByRole('button', { name: /^Sezone, / }).textContent

    expect(basis('000009')).toBe('Balans')
    expect(shown('000009')).toBe('☑ 2028')
    /* A dash for the eye and words for a reader who does not see it. */
    expect(basis('000003')).toBe('–Bez članstva u ovoj sezoni')
    expect(shown('000003')).toBe('☐ 2028')
    expect(basis('000006')).toBe('–Bez članstva u ovoj sezoni')
    expect(basis('000012')).toBe('–Bez članstva u ovoj sezoni')

    server.stop()
  })

  it('lets only the season on sale be changed, and draws the earlier ones as they stand', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const drawn = await table()
    await user.selectOptions(screen.getByLabelText('Članstvo'), 'Svi')

    const list = await seasonsOf(user, cell(drawn, '000003', 'Sezone'))

    expect(within(list).getByRole('checkbox', { name: '2027' })).toBeDisabled()
    expect(within(list).getByRole('checkbox', { name: '2028' })).toBeEnabled()

    server.stop()
  })

  it('links a name to its own profile only where the public list has him', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const drawn = await table()
    await user.selectOptions(screen.getByLabelText('Članstvo'), 'Svi')

    expect(within(drawn).getByRole('link', { name: 'Ana Aktivna' })).toHaveAttribute(
      'href',
      `/sr/takmicar/${addressOf(ana)}`,
    )
    expect(within(drawn).getByRole('link', { name: 'Bora Bezobnove' })).toHaveAttribute(
      'href',
      `/sr/takmicar/${addressOf(bora)}`,
    )

    /* A lapsed member's name is written, and is no link: his profile is shown to nobody. */
    for (const name of ['Ceca Celić', 'Dule Džonić']) {
      expect(within(drawn).getByText(name)).toBeVisible()
      expect(within(drawn).queryByRole('link', { name })).not.toBeInTheDocument()
    }

    server.stop()
  })
})
