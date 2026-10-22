import { act, configure, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { answeringBook, bookAsServed, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { MyBalanceLine } from './MyBalanceLine'

/**
 * THE LINE „600 RSD na balansu" ON ITS OWN, without the screen around it.
 *
 * <p>What the whole screen does with it is `balanceFromTheBook.test.tsx`; this holds the line's own
 * three states (not read yet, read, not readable) and the two ways of writing the money, so a change
 * to the screen cannot be the only thing that says them.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

let stop: (() => void) | null = null

afterEach(() => {
  stop?.()
  stop = null
})

function drawn(locale: 'sr' | 'en' = 'sr') {
  return render(
    <I18nProvider locale={locale}>
      <MyBalanceLine asked={1} />
    </I18nProvider>,
  )
}

describe('the balance line', () => {
  it('writes the amount and the money beside the words, in Serbian', async () => {
    stop = bookAsServed({ amount: 1800, currency: 'RSD' }).stop
    drawn()

    expect(await screen.findByText('1.800 RSD')).toBeVisible()
    expect(screen.getByText('na balansu')).toBeVisible()
  })

  it('writes a euro balance with its cents when it has any, and in English', async () => {
    stop = bookAsServed({ amount: 2.5, currency: 'EUR' }).stop
    drawn('en')

    expect(await screen.findByText('2.50 EUR')).toBeVisible()
    expect(screen.getByText('on the balance')).toBeVisible()
  })

  it('draws a book of nought as nought, because that is what it read', async () => {
    stop = bookAsServed({ amount: 0, currency: 'RSD' }).stop
    drawn()

    expect(await screen.findByText('0 RSD')).toBeVisible()
  })

  it('draws nothing while the read is on its way, and then the line', async () => {
    let answer: (response: Response) => void = () => undefined
    const route = serverThat(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    )

    stop = route.stop
    const { container } = drawn()

    await waitFor(() => {
      expect(route.asked).toHaveLength(1)
    })
    expect(container).toBeEmptyDOMElement()

    await act(async () => {
      answer(answeringBook({ amount: 600, currency: 'RSD' }))
      await Promise.resolve()
    })

    expect(await screen.findByText('600 RSD')).toBeVisible()
  })

  it('draws nothing where the server would not say', async () => {
    const route = serverThat(() => new Response(null, { status: 404 }))

    stop = route.stop
    const { container } = drawn()

    await waitFor(() => {
      expect(route.asked).toHaveLength(1)
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(container).toBeEmptyDOMElement()
  })
})
