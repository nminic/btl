import { screen, within } from '@testing-library/react'
import { htmlElement, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { useSession } from '../../session/useSession'

/**
 * „TRKAČKI PAR: [IME I PREZIME]" AT THE END OF THE LINE UNDER THE NAME, OR NOTHING.
 *
 * <p>PDL P11, owner, 18.10.2026: „Na profilnoj strani ne treba da piše Nije u trkačkom paru. Ukoliko
 * nije, ništa se ne prikazuje, ukoliko jeste, prikazuje se u gornjoj opisnoj liniji nakon tima", the
 * shape he chose with the recommendation, „Trkački par: [ime i prezime]", the name a link to the
 * PARTNER's profile, and, the same evening, „Samo tekući": only the pair of the season shown as the
 * running one, with no season written.
 *
 * <p>The pairs are made in the visit (`makePair`), because every pair the served file carries is of
 * 2019 and would be measuring nothing. Read off `test/mock/competitors.json`: 000001 Vladan Đurišić
 * and 000002 Relja Momčilović are men, the first in Dunavski trkači and the second in no team;
 * 000015 Katarina Novaković and 000006 Ivona Stamenkovska are women.
 */

function Pair({ a, b, season }: { a: string; b: string; season: number }) {
  const { makePair } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        makePair({ season, memberNumbers: [a, b] })
      }}
    >
      upari {a} i {b} za {season}
    </button>
  )
}

const line = (): string => must(document.querySelector('.profile__meta'), 'the line under the name').textContent ?? ''

describe('the racing pair in the line under the name', () => {
  it('comes after the team, names the partner and leads to the partner’s page', async () => {
    const user = setupUser()

    renderAt('/sr/takmicar/000001', 'visitor', null, undefined, '2026-10-20', <Pair a="000001" b="000015" season={2027} />)

    await screen.findByRole('heading', { level: 1, name: /Vladan/ })
    expect(line()).not.toContain('Trkački par')

    await user.click(screen.getByRole('button', { name: 'upari 000001 i 000015 za 2027' }))

    expect(line()).toMatch(/· U timu Dunavski trkači od \d{4}\. · Trkački par: Katarina Novaković$/)

    const pair = htmlElement(must(screen.getByText(/Trkački par:/).closest('.profile__meta'), 'the line'))
    const link = within(pair).getByRole('link', { name: 'Katarina Novaković' })

    /* Hers and not his own, which a line reading the pair off the page's member would draw. */
    expect(link.getAttribute('href')).toMatch(/\/sr\/takmicar\/000015/)
    expect(line()).not.toMatch(/\d{4}\.?$|sezon/i)
  }, SLOW)

  it('comes after „Bez tima" too, for a member in no team', async () => {
    const user = setupUser()

    renderAt('/sr/takmicar/000002', 'visitor', null, undefined, '2026-10-20', <Pair a="000002" b="000006" season={2027} />)

    await screen.findByRole('heading', { level: 1, name: /Relja/ })
    await user.click(screen.getByRole('button', { name: 'upari 000002 i 000006 za 2027' }))

    expect(line()).toMatch(/· Bez tima · Trkački par: Ivona Stamenkovska$/)
  }, SLOW)

  it('is the running season’s alone, and a pair made for the season after is not in it', async () => {
    const user = setupUser()

    renderAt(
      '/sr/takmicar/000002',
      'visitor',
      null,
      undefined,
      '2027-11-01',
      <>
        <Pair a="000002" b="000006" season={2028} />
        <Pair a="000002" b="000015" season={2027} />
      </>,
    )

    await screen.findByRole('heading', { level: 1, name: /Relja/ })
    await user.click(screen.getByRole('button', { name: 'upari 000002 i 000006 za 2028' }))

    /* Only next season's: nothing in the line. */
    expect(line()).not.toContain('Trkački par')

    await user.click(screen.getByRole('button', { name: 'upari 000002 i 000015 za 2027' }))

    expect(line()).toMatch(/Trkački par: Katarina Novaković$/)
    expect(line()).not.toContain('Ivona')
  }, SLOW)

  it('is the same on the page of the awards, which draws the same head', async () => {
    const user = setupUser()

    renderAt(
      '/sr/takmicar/000001/priznanja',
      'visitor',
      null,
      undefined,
      '2026-10-20',
      <Pair a="000001" b="000015" season={2027} />,
    )

    await screen.findByRole('heading', { level: 1, name: /Vladan/ })
    await user.click(screen.getByRole('button', { name: 'upari 000001 i 000015 za 2027' }))

    expect(line()).toMatch(/Trkački par: Katarina Novaković$/)
  }, SLOW)
})
