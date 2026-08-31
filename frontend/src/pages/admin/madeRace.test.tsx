import { useEffect, useRef } from 'react'
import { screen, within } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { SLOW } from '../../test/slow'
import { useSession } from '../../session/useSession'

/* What approving a result for a race the calendar does not hold really leaves
 * behind, asked of the store itself.
 *
 * The queue has its own tests and they hand it a session of `vi.fn()`, which
 * answers „was this called" and nothing else. That is enough for most of what
 * happens there and it is not enough here: the three things one press does are
 * held together by the store's own rules, and the one that holds them is invisible
 * to a double.
 *
 * **`amend` refuses a submission that has been decided.** That is right, and it
 * means the order of the two calls carries the whole tie: `decide` moved ahead of
 * `amend` loses the race silently, leaving an event and a race in the calendar, a
 * result approved, and nothing joining them — the very thing this part exists to
 * prevent (PDL, 30.08.2026, point 6). Measured in review on 31.08.2026 with the
 * whole suite green, because every case that touched it was watching a double.
 */

const ME = '000007'

/** A member who reported a race the calendar does not hold: everything a
 *  submission carries except the one thing that says which race it was. */
function Typed() {
  const session = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      session.submit({
        memberNumber: ME,
        raceName: 'Trka koje nema',
        eventName: 'Trka koje nema',
        raceKind: 'length',
        city: 'Niš',
        country: 'RS',
        date: '2026-05-10',
        distanceKm: 21.1,
        ascentM: 540,
        descentM: 540,
        photo: '',
        seconds: 6730,
        points: 12.34,
        category: 'half',
        link: 'https://primer.rs/rezultati',
        comment: '',
      })
    }
  }, [session])

  return null
}

/** What the store holds afterwards, since no screen draws either of these. */
function Held() {
  const { submissions, creations } = useSession()

  return (
    <ul aria-label="store">
      {submissions.map((one) => (
        <li key={one.id}>{`${one.status} | ${String(one.raceId)}`}</li>
      ))}
      {Object.entries(creations).map(([entity, made]) => (
        <li key={entity}>{`${entity}: ${made.map((each) => each.id).join(',')}`}</li>
      ))}
    </ul>
  )
}

describe('a result approved for a race the calendar does not hold', () => {
  it('leaves an event, a race under it, and the result tied to that race', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/verifikacija/rezultati', 'superadmin', ME, undefined, null, (
      <>
        <Typed />
        <Held />
      </>
    ))

    await screen.findByRole('table', { name: 'Čeka proveru' })
    await user.click(screen.getByRole('button', { name: 'Odobri' }))

    const rows = within(screen.getByRole('list', { name: 'store' })).getAllByRole('listitem')
    const said = rows.map((one) => one.textContent ?? '')
    const race = must(
      said.find((one) => one.startsWith('races: '))?.slice('races: '.length),
      'the race that was made',
    )

    expect(said.some((one) => one.startsWith('events: '))).toBe(true)
    expect(race).not.toBe('')

    /* The submission itself, out of the store: approved **and** pointing at the
       race that was made for it. A double would have said the call was made; only
       the store says whether it took. */
    expect(said[0]).toBe(`approved | ${race}`)
  }, SLOW)
})
