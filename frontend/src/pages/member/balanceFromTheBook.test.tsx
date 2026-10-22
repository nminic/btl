import { act, configure, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { neverPaidAsServed } from '../../test/neverPaid'
import { renderAt } from '../../test/render'
import {
  answeringBook,
  answeredWith,
  bookAsServed,
  membersAsServed,
  serverThat,
  type BookAnswered,
} from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'

/**
 * „MOJA ČLANARINA": THE BALANCE UNDER THE REFERRAL PROGRAMME IS THE BOOK'S (22.10.2026).
 *
 * <p>The owner activated a member he had brought in. The book held 600 RSD and the line said
 * „0 RSD", because the screen did not read the book: it multiplied the amount of a referral by
 * `referredCount` from `GET /api/me`. That is not a balance (it knows nothing of what was spent, it
 * moves with the price list, it falls to nought when a member he brought lapses), and it was
 * replaced by `balance` of `GET /api/me/balance`.
 *
 * <p><b>THE AXES, and each is stood on both sides of its edge.</b> Every case that could pass with
 * the old sum in the code hands the screen two numbers that DISAGREE, because with one number both
 * sources draw the same line and the case measures nothing.
 *
 * <ul>
 *   <li><b>source of the figure:</b> a head count of four against a book of nought, and a head count
 *       of nought against a book of six hundred (the incident). `000001` has four counted in
 *       `GET /api/me` and `000032` none.</li>
 *   <li><b>currency:</b> the server's, with the amount. A member in Serbia whose book is in euro is
 *       drawn in euro, and the one from abroad in dinars if the server said dinars.</li>
 *   <li><b>no figure:</b> 404 (an account that races for nobody), 401 (a visitor), a broken
 *       server, and the moment before the answer comes. In every one the line is not drawn, and
 *       above all not drawn as nought. A member freed of the fee is NOT here: the route answers
 *       him his book, and the case below holds that the screen draws it beside the sentence that
 *       says he owes nothing.</li>
 *   <li><b>who is asking:</b> a member, and somebody who registered and has not paid.</li>
 * </ul>
 */
configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function stand<T extends { stop: () => void }>(server: T): T {
  stops.push(server.stop)

  return server
}

const THE_NOTE = /Balansom se plaćaju buduće članarine/

/** The screen of `member`, with the head count the server gives him and the book as given. */
function openHisPage(member: string, book: BookAnswered | null) {
  stand(membersAsServed(member))
  const route = stand(bookAsServed(book))

  renderAt('/sr/moja-clanarina', 'competitor', member)

  return route
}

/** Lets the read that has been asked finish, so an ABSENCE read after it is an absence and not a
 *  line that has not been drawn yet. */
async function untilTheBookHasAnswered(asked: { path: string }[]): Promise<void> {
  await waitFor(() => {
    expect(asked.some((one) => one.path === '/api/me/balance')).toBe(true)
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('the balance on „Moja članarina"', { timeout: SLOW }, () => {
  it('is the book, and not the head count, where the two part company', async () => {
    /* Four counted by `/api/me` and nought in the book: a reward that was spent. The count times
       the reward is 2.400. */
    openHisPage('000001', { amount: 0, currency: 'RSD' })

    expect(await screen.findByText('0 RSD')).toBeVisible()
    expect(screen.getByText('na balansu')).toBeVisible()
    expect(screen.queryByText('2.400 RSD')).not.toBeInTheDocument()
  })

  it('is the book where nobody he brought in is counted, which is the incident', async () => {
    /* 000032 has brought nobody in whose fee stands; the book holds a reward all the same. The
       head count times the reward is nought, and that was the line. */
    openHisPage('000032', { amount: 600, currency: 'RSD' })

    expect(await screen.findByText('600 RSD')).toBeVisible()
    expect(screen.queryByText('0 RSD')).not.toBeInTheDocument()
  })

  it('is in the money the server keeps it in, whatever the profile says', async () => {
    /* 000001 lives in Serbia, so the screen's own rule says dinars. The book says euro (a member
       who changed his country keeps the balance he has), and the book is right. */
    openHisPage('000001', { amount: 5, currency: 'EUR' })

    expect(await screen.findByText('5 EUR')).toBeVisible()
    expect(screen.queryByText('5 RSD')).not.toBeInTheDocument()
    expect(screen.queryByText('20 EUR')).not.toBeInTheDocument()
  })

  it('is drawn to a member the Managing Board freed of the fee, beside the sentence that says so', async () => {
    /* The owner is one, and the route that used to report the book turned him away with 404. The
       screen draws what the route serves, and the sentence about being freed stays where it was. */
    stand(
      serverThat((path) =>
        path === '/api/me'
          ? new Response(
              JSON.stringify({
                role: 'competitor',
                account: 1,
                member: {
                  memberNumber: '000032',
                  country: 'RS',
                  firstSeason: 2016,
                  membershipBasis: 'feeExempt',
                  membershipSeason: 2028,
                },
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          : null,
      ),
    )
    stand(bookAsServed({ amount: 600, currency: 'RSD' }))

    renderAt('/sr/moja-clanarina', 'competitor', '000032', undefined, '2027-11-01')

    expect(await screen.findByText(/Oslobođen si plaćanja članarine za sezonu 2028, odlukom/)).toBeVisible()
    expect(await screen.findByText('600 RSD')).toBeVisible()
  })

  it('is drawn to somebody who registered and has not paid, on his account', async () => {
    stand(neverPaidAsServed())
    stand(bookAsServed({ amount: 600, currency: 'RSD' }))

    renderAt('/sr/moja-clanarina', 'visitor', null)

    expect(await screen.findByText('600 RSD')).toBeVisible()
  })

  it('asks the book once for a visit', async () => {
    /* The route writes the promise the first time a season is looked at, so a screen that asked it
       twice (a key that moved when the session answered) would be the first look made twice. */
    const route = openHisPage('000001', { amount: 600, currency: 'RSD' })

    await screen.findByText('600 RSD')

    expect(route.asked.filter((one) => one.path === '/api/me/balance')).toHaveLength(1)
  })

  it('is read again on the next visit, so what moved the book in between is what is drawn', async () => {
    /* The stale figure of 22.10.2026: an administrator activated a member he had brought in, and
       „Moja članarina" went on drawing what the SESSION held from before. The screen reads the book
       on every visit and keeps nothing of the last, so the only thing that has to be true here is
       that leaving the screen and coming back asks again. The book is changed on the server in
       between, which is what an activation does. */
    let book: BookAnswered = { amount: 0, currency: 'RSD' }

    stand(membersAsServed('000001'))
    const route = stand(
      serverThat((path) => (path === '/api/me/balance' ? answeringBook(book) : null)),
    )

    const { router } = renderAt('/sr/moja-clanarina', 'competitor', '000001')

    expect(await screen.findByText('0 RSD')).toBeVisible()

    await act(async () => {
      await router.navigate('/sr')
    })
    expect(screen.queryByText('na balansu')).not.toBeInTheDocument()

    book = { amount: 600, currency: 'RSD' }

    await act(async () => {
      await router.navigate('/sr/moja-clanarina')
    })

    expect(await screen.findByText('600 RSD')).toBeVisible()
    expect(screen.queryByText('0 RSD')).not.toBeInTheDocument()
    expect(route.asked.filter((one) => one.path === '/api/me/balance')).toHaveLength(2)
  })

  it.each([
    ['an account the league keeps no member for', 404],
    ['a server that is broken', 500],
    ['a visitor', 401],
  ])('draws no figure for %s, and above all not a nought', async (_who, status) => {
    stand(membersAsServed('000001'))
    const route = stand(serverThat((path) => (path === '/api/me/balance' ? answeredWith(status) : null)))

    renderAt('/sr/moja-clanarina', 'competitor', '000001')

    expect(await screen.findByText(THE_NOTE)).toBeVisible()
    await untilTheBookHasAnswered(route.asked)

    expect(screen.queryByText('na balansu')).not.toBeInTheDocument()
    expect(screen.queryByText(/^0 (RSD|EUR)$/)).not.toBeInTheDocument()
    /* The sum that used to stand in for it is not a fallback either. */
    expect(screen.queryByText('2.400 RSD')).not.toBeInTheDocument()
  })

  it('draws nothing until the book has been read, and then the line', async () => {
    let answer: (response: Response) => void = () => undefined

    stand(membersAsServed('000001'))
    const route = stand(
      serverThat((path) =>
        path === '/api/me/balance'
          ? new Promise<Response>((resolve) => {
              answer = resolve
            })
          : null,
      ),
    )

    renderAt('/sr/moja-clanarina', 'competitor', '000001')

    expect(await screen.findByText(THE_NOTE)).toBeVisible()
    await waitFor(() => {
      expect(route.asked.some((one) => one.path === '/api/me/balance')).toBe(true)
    })

    expect(screen.queryByText('na balansu')).not.toBeInTheDocument()

    await act(async () => {
      answer(answeringBook({ amount: 600, currency: 'RSD' }))
      await Promise.resolve()
    })

    expect(await screen.findByText('600 RSD')).toBeVisible()
  })
})
