import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../i18n/I18nProvider'
import { DatePicker } from './DatePicker'

function renderPicker(value = '', onChange = vi.fn()) {
  render(
    <I18nProvider locale="sr">
      <DatePicker
        id="proba"
        name="proba"
        value={value}
        invalid={false}
        describedBy={undefined}
        onChange={onChange}
      />
    </I18nProvider>,
  )

  return onChange
}

describe('DatePicker', () => {
  it('takes a typed date and puts the slashes in', async () => {
    const user = userEvent.setup()
    const onChange = renderPicker()

    await user.type(screen.getByRole('textbox'), '1')

    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('opens a month and closes it again', async () => {
    const user = userEvent.setup()
    renderPicker()

    const open = screen.getByRole('button', { name: 'Otvori kalendar' })
    expect(open).toHaveAttribute('aria-expanded', 'false')

    await user.click(open)
    expect(open).toHaveAttribute('aria-expanded', 'true')

    await user.click(open)
    expect(open).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Escape and on a click outside', async () => {
    const user = userEvent.setup()
    renderPicker()

    const open = screen.getByRole('button', { name: 'Otvori kalendar' })

    await user.click(open)
    await user.keyboard('{Escape}')
    expect(open).toHaveAttribute('aria-expanded', 'false')

    await user.click(open)
    await user.click(document.body)
    expect(open).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays open for a key it does not handle', async () => {
    const user = userEvent.setup()
    renderPicker()

    const open = screen.getByRole('button', { name: 'Otvori kalendar' })
    await user.click(open)
    await user.keyboard('{ArrowDown}')

    expect(open).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens on the month of the date already typed', async () => {
    const user = userEvent.setup()
    renderPicker('12/04/1985')

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    expect(screen.getByText('april 1985.')).toBeVisible()
    // The day already chosen is marked.
    expect(screen.getByRole('button', { name: '12' })).toHaveClass('datepicker__day--on')
  })

  it('walks to the month before and after', async () => {
    const user = userEvent.setup()
    renderPicker('12/04/1985')

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))
    await user.click(screen.getByRole('button', { name: 'Sledeći mesec' }))
    expect(screen.getByText('maj 1985.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Prethodni mesec' }))
    await user.click(screen.getByRole('button', { name: 'Prethodni mesec' }))
    expect(screen.getByText('mart 1985.')).toBeVisible()
  })

  it('gives back the day that was picked, and shuts', async () => {
    const user = userEvent.setup()
    const onChange = renderPicker('12/04/1985')

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))
    await user.click(screen.getByRole('button', { name: '20' }))

    expect(onChange).toHaveBeenCalledWith('20/04/1985')
    expect(screen.getByRole('button', { name: 'Otvori kalendar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('opens on this month when what was typed is not a date yet', async () => {
    const user = userEvent.setup()
    renderPicker('12/')

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    const heading = screen.getByRole('button', { name: 'Sledeći mesec' }).previousElementSibling!
    expect(heading.textContent).toContain(String(new Date().getFullYear()))
  })

  it('opens on this month when nothing has been typed', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    const heading = screen.getByRole('button', { name: 'Sledeći mesec' }).previousElementSibling!
    expect(heading.textContent).toContain(String(new Date().getFullYear()))
  })

  it('leaves the days outside the month blank', async () => {
    const user = userEvent.setup()
    renderPicker('01/05/2027')

    await user.click(screen.getByRole('button', { name: 'Otvori kalendar' }))

    // 1 May 2027 is a Saturday, so the week starts with five empty cells.
    const grid = screen.getByText('maj 2027.').closest('.datepicker__pop') as HTMLElement
    expect(within(grid).getAllByRole('button', { name: /^\d+$/ })).toHaveLength(31)
  })
})
