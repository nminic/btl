import { act, configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clearResourceCache } from '../../data/client'
import type { MembershipDue, Outstanding } from '../../data/types'
import sr from '../../i18n/sr.json'
import { moderatorWith, renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { OVER_THE_MEMBERS } from '../profile/whoReadsTheData'
import { QUEUE } from './queues'

/* Every wait of this file is given half of the time a case has (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * „OBRIŠI" ON THE ROW OF THE SCREEN UPLATE (owner, 23.11.2026: „Imam dva Borka Olara, želim jednog da obrišem
 * za stalno. Dodaj mi dugme za brisanje prijavljenih članova u listi uplata."), with the sheet, the sentence
 * and the guard against a second press derived the same day from „Obriši nalog" and „Obriši člana?".
 *
 * <p><b>THE AXES, EACH WITH BOTH STATES, and no row the only one of its kind.</b> Two Borkos of one name,
 * both offered, the one deleted brought in SECOND, so a request aimed at „the first" or at „the one with
 * this name" lands on the other; a registration with no number that the server does NOT offer (he has a
 * balance), so a blank number is never mistaken for the condition; a member with a number. The key of a row
 * is never its position, and no key spells another. The readers are the superadmin, a moderator over the
 * members and the payments, and a moderator over the payments alone.
 */

const ADDRESS = `/sr/${QUEUE.payments.path}`

const due = (
  competitorId: number,
  memberNumber: string,
  firstName: string,
  lastName: string,
  mayBeDeleted: boolean,
  balance = 0,
): MembershipDue => ({
  competitorId,
  memberNumber,
  firstName,
  lastName,
  city: 'Beograd',
  currency: 'RSD',
  expected: 4800,
  price: 4800,
  balance,
  mayBeDeleted,
})

/** The namesake, registered first: he stays. */
const THE_FIRST_BORKO = due(64, '', 'Borko', 'Olar', true)

/** The one deleted, registered second with the same name. */
const THE_SECOND_BORKO = due(59, '', 'Borko', 'Olar', true)

/** No number, and not offered: a balance stands behind him. */
const PETAR = due(58, '', 'Petar', 'Marko', false, 1200)

const JOVANA = due(23, '000031', 'Jovana', 'Ilić', false)

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * The list, and the route that deletes from it. The list is answered as it stands at the moment it is
 * asked, so a list read again after a deletion no longer holds the man the deletion took.
 *
 * @param deleting what the route answers, and whether it really deletes; `held` keeps a deletion out until
 *                 the case lets it go, so a second press can be made while the first is in the air
 */
function serving(deleting: { status: number; held?: Promise<void> } = { status: 204 }): {
  asked: Asked[]
  deletions: () => string[]
} {
  clearResourceCache()

  let accounts = [THE_FIRST_BORKO, JOVANA, THE_SECOND_BORKO, PETAR]
  /* SYNCHRONOUS FOR EVERY ADDRESS BUT THE DELETION: `null` hands an address back to the shared server, and
     a promise of `null` would not. */
  const { asked, stop } = serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (path === '/api/payments' && how === 'GET') {
      const answer: Outstanding = { season: 2031, accounts }

      return json(answer)
    }

    const key = /^\/api\/members\/unnumbered\/(\d+)$/.exec(path)

    if (key === null || how !== 'DELETE') {
      return null
    }

    return (async () => {
      await deleting.held

      if (deleting.status === 204) {
        accounts = accounts.filter((one) => one.competitorId !== Number(key[1]))
      }

      return new Response(null, { status: deleting.status })
    })()
  })

  stops.push(stop)

  return {
    asked,
    deletions: () =>
      asked.filter((one) => (one.init?.method ?? 'GET') === 'DELETE').map((one) => one.path),
  }
}

/** The rows of the list that carry this name, in the order the screen draws them. */
async function rowsOf(name: string): Promise<HTMLElement[]> {
  const cells = await screen.findAllByText(name)

  return cells.map((cell) => {
    const row = cell.closest('tr')

    if (row === null) {
      throw new Error(`no row holds ${name}`)
    }

    return row
  })
}

/** The row at this place among those carrying the name, or the case stops here. */
async function rowAt(name: string, at: number): Promise<HTMLElement> {
  const row = (await rowsOf(name))[at]

  if (row === undefined) {
    throw new Error(`no row ${at} holds ${name}`)
  }

  return row
}

function deleteOn(row: HTMLElement, name: string): HTMLElement {
  return within(row).getByRole('button', { name: `Obriši: ${name}` })
}

describe('„Obriši" on the screen Uplate', () => {
  it('stands only where the server offers it, after the tick and held apart from it', async () => {
    serving()
    renderAt(ADDRESS, 'superadmin')

    const [first, second] = await rowsOf('Borko Olar')

    if (first === undefined || second === undefined) {
      throw new Error('two Borkos are not on the list')
    }

    for (const row of [first, second]) {
      const button = deleteOn(row, 'Borko Olar')
      const tick = within(row).getByRole('button', { name: sr.verification.activate })

      /* AFTER THE TICK, in the same cell, neither holding the other, and marked as the one held apart. */
      expect(button.closest('td')).toBe(tick.closest('td'))
      expect(button.contains(tick) || tick.contains(button)).toBe(false)
      expect(tick.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(button).toHaveClass('activate__delete')
    }

    /* NOT WHERE THE SERVER SAYS NO: a registration with no number and a balance, and a member with one. */
    const petar = await rowAt('Petar Marko', 0)
    const jovana = await rowAt('Jovana Ilić', 0)

    expect(within(petar).queryByRole('button', { name: /^Obriši/ })).toBeNull()
    expect(within(jovana).queryByRole('button', { name: /^Obriši/ })).toBeNull()
  }, SLOW)

  it('is drawn for whoever holds the right over the members, and not for the payments alone', async () => {
    serving()

    const members = renderAt(ADDRESS, 'moderator', null, moderatorWith(['queue:payments', OVER_THE_MEMBERS]))

    expect(await screen.findAllByRole('button', { name: 'Obriši: Borko Olar' })).toHaveLength(2)
    members.unmount()

    serving()
    renderAt(ADDRESS, 'moderator', null, moderatorWith(['queue:payments']))

    const first = await rowAt('Borko Olar', 0)

    /* The row is there and can be booked; only the deletion is not offered. */
    expect(within(first).getByRole('button', { name: sr.verification.activate })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^Obriši/ })).toHaveLength(0)
  }, SLOW)

  it('asks first, in the owner\'s words, and „Odustani" sends nothing', async () => {
    const { deletions } = serving()
    const user = setupUser()

    renderAt(ADDRESS, 'superadmin')

    const second = await rowAt('Borko Olar', 1)

    await user.click(deleteOn(second, 'Borko Olar'))

    const sheet = await screen.findByRole('dialog', { name: sr.admin.registrationDeleteAsk })

    expect(within(sheet).getByText(sr.admin.registrationDeleteFinal)).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: sr.admin.form.delete })).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: sr.admin.form.keep }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deletions()).toEqual([])
    expect(await rowsOf('Borko Olar')).toHaveLength(2)
  }, SLOW)

  it('deletes the Borko whose row it was pressed on, says so, and the other Borko stays offered', async () => {
    const { deletions } = serving()
    const user = setupUser()

    renderAt(ADDRESS, 'superadmin')

    const second = await rowAt('Borko Olar', 1)

    await user.click(deleteOn(second, 'Borko Olar'))
    await user.click(
      within(await screen.findByRole('dialog', { name: sr.admin.registrationDeleteAsk })).getByRole('button', {
        name: sr.admin.form.delete,
      }),
    )

    /* SAID, in the region that outlives the list, and the list read again holds one Borko. */
    await waitFor(() => expect(screen.getByText(sr.admin.registrationGone)).toBeInTheDocument())
    expect(screen.getByText(sr.admin.registrationGone)).toHaveAttribute('role', 'status')
    await waitFor(() => expect(screen.getAllByText('Borko Olar')).toHaveLength(1))

    /* BY HIS KEY, the second row's and not the first's, and once. */
    expect(deletions()).toEqual([`/api/members/unnumbered/${THE_SECOND_BORKO.competitorId}`])

    /* THE OTHER BORKO IS STILL OFFERED, and the keyboard is on the search, the row it was on being gone. */
    const left = await rowAt('Borko Olar', 0)

    expect(deleteOn(left, 'Borko Olar')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveFocus()
  }, SLOW)

  it('sends one request for two presses of „Obriši" made while the first is out', async () => {
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const { deletions } = serving({ status: 204, held })
    const user = setupUser()

    renderAt(ADDRESS, 'superadmin')

    const second = await rowAt('Borko Olar', 1)

    await user.click(deleteOn(second, 'Borko Olar'))

    const sheet = await screen.findByRole('dialog', { name: sr.admin.registrationDeleteAsk })
    const yes = within(sheet).getByRole('button', { name: sr.admin.form.delete })

    /* TWO PRESSES IN ONE TURN, before the render the first would cause: the sheet's own refusal is state and
       does not see the second yet, so only the row's ref can. */
    act(() => {
      yes.click()
      yes.click()
    })

    await waitFor(() => expect(deletions()).toHaveLength(1))

    /* AND „ODUSTANI" DOES NOTHING WHILE IT IS OUT: the sheet stays until the answer comes. */
    await user.click(within(sheet).getByRole('button', { name: sr.admin.form.keep }))
    expect(screen.getByRole('dialog', { name: sr.admin.registrationDeleteAsk })).toBeInTheDocument()

    await act(async () => {
      release()
      await held
    })

    await waitFor(() => expect(screen.getAllByText('Borko Olar')).toHaveLength(1))
    expect(deletions()).toHaveLength(1)
  }, SLOW)

  it('does not open while an activation of the same row is out, though the same press opens it before', async () => {
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const booked: string[] = []

    clearResourceCache()

    const { stop } = serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (path === '/api/payments' && how === 'GET') {
        const answer: Outstanding = { season: 2031, accounts: [THE_FIRST_BORKO, JOVANA, THE_SECOND_BORKO, PETAR] }

        return json(answer)
      }

      if (path !== '/api/payments' || how !== 'POST') {
        return null
      }

      booked.push(path)

      return (async () => {
        await held

        return json({})
      })()
    })

    stops.push(stop)

    const user = setupUser()

    renderAt(ADDRESS, 'superadmin')

    const second = await rowAt('Borko Olar', 1)

    /* NOT VACUOUS: before anything is sent, the same press opens the sheet, and „Odustani" puts it away. */
    await user.click(deleteOn(second, 'Borko Olar'))
    await user.click(
      within(await screen.findByRole('dialog', { name: sr.admin.registrationDeleteAsk })).getByRole('button', {
        name: sr.admin.form.keep,
      }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    /* HIS AMOUNT IN FULL, which books at once with no question (his case 1), and the booking is held. */
    await user.type(within(second).getByRole('textbox', { name: 'Uplaćeno (RSD)' }), '4800')
    await user.click(within(second).getByRole('button', { name: sr.verification.activate }))
    await waitFor(() => expect(booked).toHaveLength(1))

    /* TOLD OFF, NOT SWITCHED OFF, so the press reaches the handler, and the handler is what refuses it. */
    const cross = deleteOn(second, 'Borko Olar')

    expect(cross).toHaveAttribute('aria-disabled', 'true')
    await user.click(cross)
    expect(screen.queryByRole('dialog')).toBeNull()

    await act(async () => {
      release()
      await held
    })
  }, SLOW)

  it('says the server\'s refusal beside the row and deletes nothing it was not told it deleted', async () => {
    const { deletions } = serving({ status: 404 })
    const user = setupUser()

    renderAt(ADDRESS, 'superadmin')

    const second = await rowAt('Borko Olar', 1)

    await user.click(deleteOn(second, 'Borko Olar'))
    await user.click(
      within(await screen.findByRole('dialog', { name: sr.admin.registrationDeleteAsk })).getByRole('button', {
        name: sr.admin.form.delete,
      }),
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(deletions()).toHaveLength(1)
    expect(screen.queryByText(sr.admin.registrationGone)).toBeNull()

    const stillSecond = await rowAt('Borko Olar', 1)
    const said = stillSecond.querySelector('.activate__said')

    expect(said?.textContent).not.toBe('')
    expect(await rowsOf('Borko Olar')).toHaveLength(2)
  }, SLOW)
})
