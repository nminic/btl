import { screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { at, first } from '../test/at'
import { renderWithI18n } from '../test/render'
import { Markdown } from './Markdown'

/* Written pages carry links now, and a link is a router element, so the
   component needs both the dictionary and a router around it. */
function render(ui: ReactNode) {
  return renderWithI18n(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('Markdown', () => {
  it('renders sub-headings under the heading of the section', () => {
    render(<Markdown text={'## Dva\n\n### Tri\n\n#### Četiri'} />)

    // A section already carries an h2, so nothing in a body may go above h3.
    expect(screen.getByRole('heading', { level: 3, name: 'Dva' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'Tri' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 4, name: 'Četiri' })).toBeVisible()
  })

  it('draws the two deepest headings, and nothing below them', () => {
    render(<Markdown text={'##### Pet\n\n###### Šest\n\n####### Sedam'} />)

    expect(screen.getByRole('heading', { level: 5, name: 'Pet' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 6, name: 'Šest' })).toBeVisible()
    /* Seven hashes are not a heading at all: the shape takes two to six, so the
       line is a paragraph and reads as one. Held here because the tags are now
       a written-out list of four (`headingTag`), and that list is only right for
       as long as the shape above it cannot produce a fifth. */
    expect(screen.queryByRole('heading', { name: /Sedam/ })).not.toBeInTheDocument()
    expect(screen.getByText('####### Sedam')).toBeVisible()
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

  it('tells an example apart from a blank still to be filled in', () => {
    /* Both are written the same way in the source, and since the examples gave
       up their box (owner, 03.08.2026) the difference has to be made here: a
       note to ourselves standing on a public page must not read as prose. */
    render(<Markdown text={'Broj je `000001`, a adresa `[TREBA POPUNITI: adresa prostorija]`.'} />)

    expect(screen.getByText('000001')).not.toHaveClass('markdown__todo')
    expect(screen.getByText(/^\[TREBA POPUNITI/)).toHaveClass('markdown__todo')
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
    const bullets = first(lists)
    const numbered = at(lists, 1)

    expect(lists).toHaveLength(2)
    expect(within(bullets).getAllByRole('listitem')).toHaveLength(2)
    expect(at(within(numbered).getAllByRole('listitem'), 1)).toHaveTextContent('korak dva')
    expect(bullets.tagName).toBe('UL')
    expect(numbered.tagName).toBe('OL')
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

  /* Links inside prose (owner, 31.07.2026). A written page is read in every
   * language, so an address inside one is written without the language and gets
   * it here; anything pointing off the portal is left exactly as written. */
  it('carries a link to another page of the portal, in the language being read', () => {
    render(<Markdown text="Kompletan [pravilnik](/pravilnik) stoji na portalu." />)

    expect(screen.getByRole('link', { name: 'pravilnik' })).toHaveAttribute('href', '/sr/pravilnik')
  })

  it('carries a file served beside the portal as a file, not as a page of it', () => {
    /* A file is not a route. The statute is linked from the first section of the
       terms as `/BTL%20Statut.pdf` (owner, 22.08.2026), and read as a page it
       became `/sr/BTL%20Statut.pdf`, which `nginx` answers with the application
       shell: the reader would open the portal again instead of the document, and
       nothing on the screen would say why.

       Told apart by the extension at the end, which is the whole of what makes a
       path a file here. It is still this host: two slashes are refused above. */
    render(<Markdown text="Primenjuje se [Statut](/BTL%20Statut.pdf) udruženja." />)

    expect(screen.getByRole('link', { name: 'Statut' })).toHaveAttribute(
      'href',
      '/BTL%20Statut.pdf',
    )
  })

  it('still reads a page whose name merely has a dot in it as a page', () => {
    /* The other side of the rule, so „ends in a dot and letters" does not eat a
       page. Two to four letters after the last dot is a file extension; a
       longer tail is a word. */
    render(<Markdown text="Vidi [ligu](/liga/beograd.trka.velika)." />)

    expect(screen.getByRole('link', { name: 'ligu' })).toHaveAttribute(
      'href',
      '/sr/liga/beograd.trka.velika',
    )
  })

  it('carries an address of electronic mail as something to write to', () => {
    render(<Markdown text="Pišite nam na [info@primer.rs](mailto:info@primer.rs)." />)

    expect(screen.getByRole('link', { name: 'info@primer.rs' })).toHaveAttribute(
      'href',
      'mailto:info@primer.rs',
    )
  })

  it('carries a link out of the portal as it was written', () => {
    render(<Markdown text="Prijava je [ovde](https://primer.rs/prijava)." />)

    expect(screen.getByRole('link', { name: 'ovde' })).toHaveAttribute(
      'href',
      'https://primer.rs/prijava',
    )
  })

  /* The one shape of markup that can hand the browser an instruction. A page is
     edited by a moderator, so what it may point at is a closed list and not a
     matter of trust. */
  it('leaves an address it does not allow as the text it is, and makes no link of it', () => {
    const { container } = render(<Markdown text="Klikni [ovde](javascript:alert(1)) za nagradu." />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    // Nothing is swallowed either: what was written is what stands there.
    expect(container.textContent).toBe('Klikni [ovde](javascript:alert(1)) za nagradu.')
  })

  it('carries a link inside a table as well as inside a sentence', () => {
    render(<Markdown text={'| Strana | Gde |\n|---|---|\n| Pravilnik | [otvori](/pravilnik) |'} />)

    expect(screen.getByRole('link', { name: 'otvori' })).toHaveAttribute('href', '/sr/pravilnik')
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
    expect(Reflect.get(window, 'btlRanAScript')).toBeUndefined()
    expect(screen.getByText(/<b>ne podebljano<\/b>/)).toBeVisible()
  })
})
