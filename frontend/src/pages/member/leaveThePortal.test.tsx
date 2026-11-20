import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aNeverPaidRecord } from '../../test/neverPaid'
import { renderAt } from '../../test/render'
import { anInvoice, invoiceAsServed, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/**
 * „OBRIŠI NALOG" AT THE END OF „MOJA ČLANARINA" (owner, 20.11.2026): drawn on the server's yes and nowhere else,
 * a window „Obriši / Odustani" before anything is sent, one request however it is pressed, and the front page with
 * „Vaš nalog je obrisan." once he is gone.
 *
 * <p><b>THE AXES.</b> The server's answer, yes and no, and the same record under both, so that only `mayLeave` can be
 * what draws the button. The three ways out of the window that send nothing (Odustani, Escape) beside the one that
 * sends. One press and two presses. And what the server answers to the request: gone, or refused.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

const IN_THE_WINDOW = '2026-11-01'

type Deletion = { status: number } | 'hangs'

/**
 * HIS SERVER: `GET /api/me` answers his record with `mayLeave` as the case says, and `DELETE /api/me` answers as the
 * case says. Once he is gone the next `GET /api/me` is 401, which is what the server answers a cookie it has put out.
 */
function hisServer(mayLeave: boolean, deletion: Deletion = { status: 204 }): { asked: Asked[] } {
  let gone = false
  const server = serverThat((path, init) => {
    if (path !== '/api/me') {
      return null
    }

    if (init?.method === 'DELETE') {
      if (deletion === 'hangs') {
        return new Promise<Response>(() => undefined)
      }

      gone = deletion.status === 204

      return new Response(null, { status: deletion.status })
    }

    return gone
      ? new Response(null, { status: 401 })
      : new Response(
          JSON.stringify({
            role: 'competitor',
            account: 1,
            member: aNeverPaidRecord,
            mailLanguage: 'sr',
            seasonsOpenForAReport: [2027],
            mayLeave,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
  })

  stops.push(server.stop)

  const invoice = invoiceAsServed(anInvoice(2027, 'RSD'))

  stops.push(invoice.stop)

  renderAt('/sr/moja-clanarina', 'visitor', null, undefined, IN_THE_WINDOW)

  return server
}

const deletions = (asked: Asked[]): Asked[] =>
  asked.filter((one) => one.path === '/api/me' && one.init?.method === 'DELETE')

describe('the button', () => {
  it('stands at the end of the page when the server says he may', async () => {
    hisServer(true)

    const button = await screen.findByRole('button', { name: 'Obriši nalog' })
    const referral = await screen.findByRole('heading', { name: 'Program preporuke' })

    /* AFTER THE LAST PANEL AND NOT INSIDE IT: `FOLLOWING` is set for a descendant too, so containment is asked
       apart (CLAUDE.md, 04.09.2026). */
    const panel = referral.closest('section')

    expect(panel).not.toBeNull()
    expect(panel?.contains(button)).toBe(false)
    expect(Boolean(referral.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(document.querySelectorAll('section.member__panel ~ .member__leave')).toHaveLength(1)
  })

  it('is not drawn when the server says he may not, over the same record', async () => {
    hisServer(false)

    await screen.findByRole('heading', { name: 'Program preporuke' })
    /* The answer has arrived, so its absence is the no and not a page still waiting for it. */
    await waitFor(() => expect(document.querySelector('.member__leave')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Obriši nalog' })).toBeNull()
  })
})

describe('the window', () => {
  it('asks before anything is sent, and Odustani sends nothing', async () => {
    const user = setupUser()
    const { asked } = hisServer(true)

    await user.click(await screen.findByRole('button', { name: 'Obriši nalog' }))

    const dialog = await screen.findByRole('dialog', { name: 'Obriši nalog?' })

    expect(within(dialog).getByText('Ovo ne može da se vrati.')).toBeInTheDocument()
    expect(deletions(asked)).toHaveLength(0)

    await user.click(within(dialog).getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deletions(asked)).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Obriši nalog' })).toBeInTheDocument()
  })

  it('is closed by Escape, and Escape sends nothing', async () => {
    const user = setupUser()
    const { asked } = hisServer(true)

    await user.click(await screen.findByRole('button', { name: 'Obriši nalog' }))
    await screen.findByRole('dialog', { name: 'Obriši nalog?' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deletions(asked)).toHaveLength(0)
  })
})

describe('deleting', () => {
  it('sends one request and opens the front page with the sentence, signed out', async () => {
    const user = setupUser()
    const { asked } = hisServer(true)

    await user.click(await screen.findByRole('button', { name: 'Obriši nalog' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Obriši nalog?' })).getByRole('button', {
        name: 'Obriši nalog',
      }),
    )

    expect(await screen.findByText('Vaš nalog je obrisan.')).toHaveAttribute('role', 'status')
    expect(screen.getByRole('heading', { level: 1, name: 'Balkanska trkačka liga' })).toBeInTheDocument()
    expect(deletions(asked)).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Moja članarina' })).toBeNull()
    /* AND THE PORTAL HAS FORGOTTEN HIM: the header offers the way in again, which it draws only to nobody. */
    expect(await screen.findByRole('link', { name: 'Prijavi se' })).toBeInTheDocument()
  })

  it('sends one request for two presses while the first is out, and for a double press', async () => {
    const user = setupUser()
    const { asked } = hisServer(true, 'hangs')

    await user.click(await screen.findByRole('button', { name: 'Obriši nalog' }))

    const yes = within(await screen.findByRole('dialog', { name: 'Obriši nalog?' })).getByRole('button', {
      name: 'Obriši nalog',
    })

    fireEvent.click(yes, { detail: 2 })
    expect(deletions(asked)).toHaveLength(0)

    await user.click(yes)
    await user.click(yes)
    await user.keyboard('{Escape}')

    await waitFor(() => expect(deletions(asked)).toHaveLength(1))
    expect(screen.getByRole('dialog', { name: 'Obriši nalog?' })).toBeInTheDocument()
  })

  it('stays on his page and says so when the server refuses', async () => {
    const user = setupUser()
    const { asked } = hisServer(true, { status: 404 })

    await user.click(await screen.findByRole('button', { name: 'Obriši nalog' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Obriši nalog?' })).getByRole('button', {
        name: 'Obriši nalog',
      }),
    )

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Moja članarina' })).toBeInTheDocument()
    expect(deletions(asked)).toHaveLength(1)
  })
})
