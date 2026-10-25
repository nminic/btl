import { configure, screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import type { Competitor, Member } from '../../data/types'
import { asMember, person } from '../../test/plate'
import { renderAt } from '../../test/render'
import { memberRowOf as rowOf } from '../../test/memberRow'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'
import { addressIn } from './memberInvitation'

/**
 * „POŠALJI NOVU POZIVNICU" ON THE MEMBER'S ROW (owner, 25.10.2026, PDL „Nova pozivnica od administracije i
 * rečenica o trkama: odgovori od 25.10.2026"): an envelope on every row, switched off where no invitation is
 * due with the box „Član je već postavio lozinku.", sent at once with no sheet, and afterwards „Nova pozivnica
 * je poslata na {adresa}. Prethodni link više ne važi."
 *
 * **THE ROWS SEPARATE THE SECOND SOURCE OF EVERY VALUE**: the first row has a password, so „the first row" is
 * never the one invited; two rows are due, so „the first row that is due" is not the one pressed; the address
 * said afterwards is the server's answer and stands nowhere else on the page; and a member with no account is
 * a third state, not a variant of the password.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

const HAS_A_PASSWORD = '000002'
const DUE_FIRST = '000004'
const PRESSED = '000006'
const NO_ACCOUNT = '000008'

const COMPETITORS: Competitor[] = [
  person(HAS_A_PASSWORD, 'Ana', 'Držić'),
  person(DUE_FIRST, 'Zoran', 'Vuković'),
  person(PRESSED, 'Mila', 'Tomić'),
  person(NO_ACCOUNT, 'Ivan', 'Jović'),
]

const ROWS: Member[] = [
  asMember(must(COMPETITORS[0], 'Ana'), { invitation: 'passwordSet' }),
  asMember(must(COMPETITORS[1], 'Zoran'), { invitation: 'due' }),
  asMember(must(COMPETITORS[2], 'Mila'), { invitation: 'due' }),
  asMember(must(COMPETITORS[3], 'Ivan'), { invitation: 'noAccount' }),
]

/** An address that is nowhere in the rows, so the sentence can only have it from the answer. */
const WHERE_IT_WENT = 'mila.tomic@primer.rs'

type Answering = (path: string) => Response | Promise<Response>

function serving(toTheRoute: Answering = () => Response.json({ email: WHERE_IT_WENT })) {
  clearResourceCache()

  return serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (path === '/api/competitors' && how === 'GET') {
      return Response.json(COMPETITORS)
    }

    if (path === '/api/members' && how === 'GET') {
      return Response.json(ROWS)
    }

    if (path.startsWith('/api/members/') && how !== 'GET') {
      return toTheRoute(path)
    }

    return null
  })
}

/** Every write the screen sent to a member's address, with its verb and its body. */
function sent(asked: Asked[]): string[] {
  return asked
    .filter((one) => (one.init?.method ?? 'GET') !== 'GET' && one.path.startsWith('/api/members/'))
    .map((one) => `${String(one.init?.method)} ${one.path} ${String(one.init?.body)}`)
}

const envelope = (row: HTMLElement) => within(row).getByRole('button', { name: 'Pošalji novu pozivnicu' })

describe('a new invitation from the member’s row', () => {
  it('stands on every row and can be pressed only where the account has no password', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    expect(envelope(await rowOf(DUE_FIRST))).toBeEnabled()
    expect(envelope(await rowOf(PRESSED))).toBeEnabled()

    for (const [number, why] of [
      [HAS_A_PASSWORD, 'Član je već postavio lozinku.'],
      [NO_ACCOUNT, 'Član nema nalog na portalu, pa pozivnica nema kome da ode.'],
    ] as const) {
      const off = envelope(await rowOf(number))

      /* SWITCHED OFF FOR REAL, as „Upiši uplatu" is, and its box says why to the pointer. */
      expect(off, number).toBeDisabled()

      await user.hover(off)

      expect(await screen.findByText(why), number).toBeInTheDocument()

      await user.click(off)
      await user.unhover(off)
    }

    expect(sent(server.asked)).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()

    server.stop()
  }, SLOW)

  it('sends at once, for that member, and says on the screen where it went and that the earlier link is gone', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    await user.click(envelope(await rowOf(PRESSED)))

    /* DRAWN, in the screen's status that a reader sees, and not only in the live region kept for a reader who
       does not look: that one is clipped to a pixel and carries no role, so it is not among these. */
    await waitFor(() => {
      expect(screen.getAllByRole('status').map((one) => one.textContent)).toContain(
        `Nova pozivnica je poslata na ${WHERE_IT_WENT}. Prethodni link više ne važi.`,
      )
    })
    /* No sheet stood between the press and the letter (owner, 25.10.2026, „šalje se bez prozora potvrde"). */
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(server.asked)).toEqual([`POST /api/members/${PRESSED}/invitation {}`])

    server.stop()
  }, SLOW)

  it('sends one request for two presses while the first is out', async () => {
    let answer: (said: Response) => void = () => undefined
    const server = serving(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    )
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const pressed = envelope(await rowOf(PRESSED))

    await user.click(pressed)
    await user.click(pressed)

    await waitFor(() => {
      expect(sent(server.asked)).toHaveLength(1)
    })

    answer(Response.json({ email: WHERE_IT_WENT }))

    expect(await screen.findByText(new RegExp(`poslata na ${WHERE_IT_WENT}`))).toBeVisible()
    expect(sent(server.asked)).toHaveLength(1)

    server.stop()
  }, SLOW)

  it.each([
    ['a password set since the list was read', () => refused('thePasswordIsSet', 409), 'Član je već postavio lozinku.'],
    [
      'a relay that does not take the letter',
      () => refused('thePostDidNotTakeIt', 503),
      'Pošta trenutno ne prima poruke, pa pozivnica nije poslata. Pokušaj ponovo za koji minut.',
    ],
  ])('says beside the row what the server said of %s', async (_what, answering, words) => {
    const server = serving(answering)
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(PRESSED)

    await user.click(envelope(row))

    expect(await within(row).findByText(words)).toBeInTheDocument()
    expect(screen.queryByText(/Nova pozivnica je poslata/)).toBeNull()

    server.stop()
  }, SLOW)
})

describe('what the envelope’s words are made of', () => {
  it('reads the address only off an answer that names one', () => {
    expect(addressIn({ email: WHERE_IT_WENT })).toBe(WHERE_IT_WENT)
    expect(addressIn({ email: 7 })).toBeNull()
    expect(addressIn(null)).toBeNull()
    expect(addressIn('text')).toBeNull()
  })

  it('says it was sent without an address where the answer names none', async () => {
    const server = serving(() => Response.json({}))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    await user.click(envelope(await rowOf(PRESSED)))

    expect(await screen.findByText('Nova pozivnica je poslata. Prethodni link više ne važi.')).toBeVisible()

    server.stop()
  }, SLOW)
})
