import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import { Stars } from './Stars'

function draw(ui: React.ReactNode) {
  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>,
  )
}

/* The stars, in the shape that reads rather than the one that asks. The asking
 * shape is driven through the screen that uses it (pages/event/rateEvent.test).
 * What is held here is that a reading is not a control and that it says its
 * number in words, including the number nobody gave.
 */
describe('a rating that is read rather than given', () => {
  it('is a picture with the number in its name, and nothing to press', () => {
    draw(<Stars name="x" label="Organizacija" value={4} />)

    expect(screen.getByRole('img', { name: 'Organizacija: 4 od 5' })).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('says so where nobody has rated it', () => {
    /* Nought is not "nought out of five": it is a comment that carries no
       rating at all, which the record allows for anything written before the
       ratings existed. */
    draw(<Stars name="x" label="Ambijent" value={0} />)

    expect(screen.getByRole('img', { name: 'Ambijent: Bez ocene' })).toBeInTheDocument()
  })
})
