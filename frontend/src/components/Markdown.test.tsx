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

  it('leaves an unclosed marker as the text it is', () => {
    render(<Markdown text={'**Važno: ovo nije kraj\n\nCena je `35 EUR bez zatvaranja'} />)

    // Nothing may be cut off: slicing the markers off a segment that never
    // closed ate the last two characters of the sentence.
    expect(screen.getByText('**Važno: ovo nije kraj')).toBeVisible()
    expect(screen.getByText('Cena je `35 EUR bez zatvaranja')).toBeVisible()
    expect(document.querySelector('strong')).toBeNull()
    expect(document.querySelector('code')).toBeNull()
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

  /* The central promise of this component. The written pages are content, and
   * tomorrow an administrator edits them through the database, so a body of text
   * must never be able to put an element of its own on the page. */
  it('keeps raw HTML in the body as text, and runs nothing that is in it', () => {
    const { container } = render(
      <Markdown
        text={
          '<script>window.btlRanAScript = true</script>\n\n' +
          '<b>ne podebljano</b> <img src="x" onerror="window.btlRanAScript = true">'
        }
      />,
    )

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    // React escaped it instead of parsing it, so there was never anything to run.
    expect(container.innerHTML).toContain('&lt;script&gt;')
    expect((window as unknown as { btlRanAScript?: boolean }).btlRanAScript).toBeUndefined()
    expect(screen.getByText(/<b>ne podebljano<\/b>/)).toBeVisible()
  })
})
