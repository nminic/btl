import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../i18n/I18nProvider'
import type { RaceCategory } from '../data/types'
import { CategoryDonut } from './CategoryDonut'

function renderDonut(counts: Map<RaceCategory, number>) {
  render(
    <I18nProvider locale="sr">
      <CategoryDonut counts={counts} caption="Trke po dužini" />
    </I18nProvider>,
  )
}

describe('CategoryDonut', () => {
  it('puts the total in the middle and every length in the legend', () => {
    renderDonut(new Map<RaceCategory, number>([['short', 3], ['marathon', 1]]))

    expect(screen.getByText('4')).toBeVisible()
    // All five lengths appear, including the ones never run.
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(5)
    expect(screen.getByText('75%')).toBeVisible()
  })

  it('survives a runner with nothing at all', () => {
    renderDonut(new Map())

    // The total in the middle, and every length at nought per cent.
    expect(document.querySelector('.donut__center strong')).toHaveTextContent('0')
    expect(screen.getAllByText('0%')).toHaveLength(5)
  })

  it('dims the other lengths while one is pointed at', async () => {
    const user = userEvent.setup()
    renderDonut(new Map<RaceCategory, number>([['short', 2], ['half', 2]]))

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(document.querySelectorAll('.donut__seg--dim')).toHaveLength(0)

    await user.hover(rows[0])
    expect(document.querySelectorAll('.donut__seg--dim')).toHaveLength(4)

    await user.unhover(rows[0])
    expect(document.querySelectorAll('.donut__seg--dim')).toHaveLength(0)
  })
})
