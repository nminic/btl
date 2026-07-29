import { render, screen, within } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renders sub-headings under the heading of the section', () => {
    render(<Markdown text={'## Dva\n\n### Tri\n\n#### Četiri'} />)

    // A section already carries an h2, so nothing in a body may go above h3.
    expect(screen.getByRole('heading', { level: 3, name: 'Dva' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'Tri' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 4, name: 'Četiri' })).toBeVisible()
  })

  it('keeps the line breaks inside one paragraph', () => {
    render(<Markdown text={'Poverenik za informacije\nBulevar kralja Aleksandra 15\n\nDrugi pasus'} />)

    expect(screen.getByText(/Poverenik za informacije/)).toHaveTextContent(
      'Poverenik za informacije Bulevar kralja Aleksandra 15',
    )
    expect(screen.getByText('Drugi pasus')).toBeVisible()
  })

  it('marks what is bold and what is written as a value', () => {
    render(<Markdown text="Unosi se **tačno** kao `42.2`, bez tolerancije." />)

    expect(screen.getByText('tačno').tagName).toBe('STRONG')
    expect(screen.getByText('42.2').tagName).toBe('CODE')
  })

  it('renders a list of bullets and a numbered list', () => {
    render(<Markdown text={'- prvo\n- drugo\n\n1. korak\n2. korak dva'} />)

    const lists = screen.getAllByRole('list')

    expect(lists).toHaveLength(2)
    expect(within(lists[0]).getAllByRole('listitem')).toHaveLength(2)
    expect(within(lists[1]).getAllByRole('listitem')[1]).toHaveTextContent('korak dva')
    expect(lists[0].tagName).toBe('UL')
    expect(lists[1].tagName).toBe('OL')
  })

  it('renders a table with a head', () => {
    render(<Markdown text={'| Period | Cena |\n|---|---|\n| Oktobar | 35 EUR |'} />)

    expect(screen.getByRole('columnheader', { name: 'Period' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Oktobar' })).toBeVisible()
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('leaves out the head when the table has none', () => {
    render(<Markdown text={'| | |\n|---|---|\n| PIB | 123 |\n| Telefon | 456 |'} />)

    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('renders nothing for a table that holds only its dashed line', () => {
    render(<Markdown text={'|---|---|'} />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders a rule', () => {
    render(<Markdown text={'Iznad\n\n---\n\nIspod'} />)

    expect(screen.getByRole('separator')).toBeVisible()
  })

  it('renders nothing at all for an empty body', () => {
    const { container } = render(<Markdown text="" />)

    expect(container.textContent).toBe('')
  })
})
