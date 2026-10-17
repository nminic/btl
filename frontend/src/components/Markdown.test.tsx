import { screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { at, first } from '../test/at'
import { renderWithI18n } from '../test/render'
import { MISLEADING, STAYS_A_LINK } from '../test/misleadingAddresses'
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

  it('refuses another host written with a backslash, as it refuses two slashes', () => {
    /* A browser normalises `/\\` to `//` before it resolves anything, so
       `/\\primer.rs` is `https://primer.rs`. It was harmless while every path of
       ours went through the router; the day a path could be served as written it
       became a way for a page a moderator types to send a reader off the portal.
       Left as plain text, like every other address outside the closed list. */
    /* Written as an expression and not as a plain attribute: in JSX an attribute
       is literal, so a backslash typed twice stays two, and the test would then
       be about a shape nobody writes. */
    const said = 'Idi [ovde](/\\primer.rs) odmah.'
    const { container } = render(<Markdown text={said} />)

    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toBe(said)

    /* And the older, plainer form of the same attack, which was refused all
       along and measured by nothing: a security round replaced the guard with
       one that lets `//` through, and all 2039 tests stayed green while
       `//primer.rs` resolved to `https://primer.rs/`. The title of this test and
       two comments beside it already claimed both were held. */
    const plain = render(<Markdown text="Ili [ovde](//primer.rs) odmah." />)

    expect(plain.container.querySelector('a')).toBeNull()
    expect(plain.container.textContent).toBe('Ili [ovde](//primer.rs) odmah.')
  })

  it('carries a file with a fragment or a query as a file, not as a page', () => {
    /* The extension is read off the path and not off the whole address. Asked of
       the whole, `/BTL%20Statut.pdf#strana=3` stopped looking like a file and
       went back through the router, which hands the reader the application shell
       instead of the document. */
    render(<Markdown text="Vidi [treću stranu](/BTL%20Statut.pdf#strana=3) Statuta." />)
    render(<Markdown text="Ili [novu verziju](/BTL%20Statut.pdf?v=2) istog." />)

    expect(screen.getByRole('link', { name: 'treću stranu' })).toHaveAttribute(
      'href',
      '/BTL%20Statut.pdf#strana=3',
    )
    expect(screen.getByRole('link', { name: 'novu verziju' })).toHaveAttribute(
      'href',
      '/BTL%20Statut.pdf?v=2',
    )
  })

  it('reads the extension as at most four characters, digits among them', () => {
    /* The boundary itself, in both directions, because „two to four" was written
       down and nothing measured where four stops. Four is a file (`.jpeg`), five
       is a word (`.trkom`), and a digit counts: a season written `/liga/2027.5`
       is not a page of this portal but a file nobody has. */
    render(<Markdown text="Slika je [ovde](/slike/sat.jpeg), a liga [tu](/liga/sezona.trkom)." />)

    expect(screen.getByRole('link', { name: 'ovde' })).toHaveAttribute('href', '/slike/sat.jpeg')
    expect(screen.getByRole('link', { name: 'tu' })).toHaveAttribute(
      'href',
      '/sr/liga/sezona.trkom',
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

/* What the texts of the administration ask of it since 16.10.2026 (PDL, „Ispravke sa ekrana
   16.10.2026"): the description of an event, the terms and the prizes of a competition. */
describe('Markdown, for a text of the administration', () => {
  it('draws italic as italic, and bold inside it as bold', () => {
    render(<Markdown text="Trči se _po svakom **vremenu**_." />)

    const italic = screen.getByText(/po svakom/)

    expect(italic.tagName).toBe('EM')
    expect(within(italic).getByText('vremenu').tagName).toBe('STRONG')
  })

  it('starts its headings one below the heading it stands under', () => {
    /* Under the name of an event, an h1. */
    const event = render(<Markdown text={'## Staza\n\n#### Okrepa'} under={1} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Staza' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'Okrepa' })).toBeVisible()
    event.unmount()

    /* Under the heading of a box of a competition, an h3. */
    render(<Markdown text={'## Bodovanje\n\n#### Izuzeci\n\n###### Najdublje'} under={3} />)

    expect(screen.getByRole('heading', { level: 4, name: 'Bodovanje' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 5, name: 'Izuzeci' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 6, name: 'Najdublje' })).toBeVisible()
  })

  it('opens a link to another site in a window of its own where the text asks for it, and tells it nothing', () => {
    render(
      <Markdown text="Prijava je [ovde](https://primer.rs/prijava), a pravila [tu](/pravilnik)." outward />,
    )

    const out = screen.getByRole('link', { name: 'ovde' })

    expect(out).toHaveAttribute('href', 'https://primer.rs/prijava')
    expect(out).toHaveAttribute('target', '_blank')
    expect(out).toHaveAttribute('rel', 'noreferrer noopener')
    /* A page of this portal is still a page of it, in the same window. */
    expect(screen.getByRole('link', { name: 'tu' })).toHaveAttribute('href', '/sr/pravilnik')
    expect(screen.getByRole('link', { name: 'tu' })).not.toHaveAttribute('target')
  })

  it('opens a link to another site in the same window where the text does not ask, as a written page always has', () => {
    render(<Markdown text="Prijava je [ovde](https://primer.rs/prijava)." />)

    expect(screen.getByRole('link', { name: 'ovde' })).not.toHaveAttribute('target')
    expect(screen.getByRole('link', { name: 'ovde' })).not.toHaveAttribute('rel')
  })

  it('draws a bare address as a link where it is asked, left to right, in a window of its own (PDL P15)', () => {
    render(<Markdown text="Vreme meri **www.runtrace.net**." addresses outward />)

    const link = screen.getByRole('link', { name: 'www.runtrace.net' })

    expect(link).toHaveAttribute('href', 'https://www.runtrace.net')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer noopener')
    expect(link).toHaveAttribute('dir', 'ltr')
    expect(link.parentElement?.tagName).toBe('STRONG')
  })

  it('draws no bare address as a link where it is not asked', () => {
    render(<Markdown text="Vreme meri www.runtrace.net." outward />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  /* PDL „Ispravke sa ekrana 17.10.2026": a mailbox typed into the description of an event or into
     the terms and the prizes is a link to write to it, and a written page is drawn as it was. */
  it('draws a typed mailbox as a link to write to it in the description of an event, and no address of a site', () => {
    render(<Markdown text="Pišite na **info@primer.rs** ili liga@runtrace.net, www.runtrace.net." addresses="mail" outward />)

    const info = screen.getByRole('link', { name: 'info@primer.rs' })
    const liga = screen.getByRole('link', { name: 'liga@runtrace.net' })

    expect(info).toHaveAttribute('href', 'mailto:info@primer.rs')
    expect(liga).toHaveAttribute('href', 'mailto:liga@runtrace.net')
    expect(info.parentElement?.tagName).toBe('STRONG')

    for (const one of [info, liga]) {
      expect(one).toHaveAttribute('target', '_blank')
      expect(one).toHaveAttribute('rel', 'noreferrer noopener')
      expect(one).toHaveAttribute('dir', 'ltr')
    }

    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('draws a typed mailbox as a link in the terms and the prizes, beside the address of a site', () => {
    render(<Markdown text="Pišite na info@primer.rs, www.runtrace.net." addresses outward />)

    expect(screen.getByRole('link', { name: 'info@primer.rs' })).toHaveAttribute('href', 'mailto:info@primer.rs')
    expect(screen.getByRole('link', { name: 'www.runtrace.net' })).toHaveAttribute('href', 'https://www.runtrace.net')
  })

  it('draws no typed mailbox as a link in a written page, which asks for no addresses', () => {
    render(<Markdown text={'Pišite na info@primer.rs.\n\n- liga@runtrace.net\n\n## info@primer.rs'} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Pišite na info@primer.rs.')).toBeVisible()
  })

  /* PDL „Odgovori vlasnika 17.10.2026, jezik pošte (PR 545) i uređivač (PR 546)": the host of a link
     is asked in the description of an event as in the terms, in its sentences and in its tables. */
  it('draws a link of the description of an event whose address reads as one host and opens another as words, in a cell too', () => {
    const bad = '[x](https://www.runtrace.net@zlo.example)'

    render(<Markdown text={`${bad} [prava](https://primer.rs)\n\n| ${bad} | [druga](https://primer.rs/b) |\n|---|---|\n| a | b |`} addresses="mail" outward />)

    expect(screen.queryAllByRole('link', { name: 'x' })).toEqual([])
    /* The clean links on both sides of them, so what is measured is the refusal and not a text that
       links nothing. */
    expect(screen.getAllByRole('link').map((one) => one.textContent)).toEqual(['prava', 'druga'])
    expect(screen.getByRole('columnheader', { name: bad })).toBeVisible()
    expect(screen.getByRole('link', { name: 'prava' }).parentElement?.textContent).toBe(`${bad} prava`)
  })

  it('draws no typed mailbox as a link in a cell of a table, which draws no bare address of any kind', () => {
    render(<Markdown text={'| Pošta | info@primer.rs |\n|---|---|\n| a | b |'} addresses="mail" outward />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('makes nothing of a link to javascript: or of a script written in the text, in any of its readings', () => {
    const { container } = render(
      <Markdown
        text={'[klik](javascript:window.btlRanALink=1) <script>window.btlRanAScript = true</script>'}
        addresses
        outward
      />,
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toBe(
      '[klik](javascript:window.btlRanALink=1) <script>window.btlRanAScript = true</script>',
    )
    expect(Reflect.get(window, 'btlRanAScript')).toBeUndefined()
  })

  it('draws the place of a drawing as the words it is, outside a written page', () => {
    render(<Markdown text={'Prvo\n[[gallery]]'} />)

    expect(screen.getByText('[[gallery]]').tagName).toBe('P')
  })
})

/* PDL P15, 03.10.2026: „Adresa sa „@" ili sa slovima van latinice u hostu ne postaje veza nego ostaje
   običan tekst." The address under the words of a Markdown link is asked what a bare address is asked,
   in the texts that make bare addresses links (the terms and the prizes of a competition). */
describe('Markdown, a link whose address reads as one host and opens another', () => {
  const typed = MISLEADING.map((one) => one.typed)

  /** The address as a link would carry it: `www.` has no scheme in front of it in a link, so it is
   *  written the way a person who meant it would write it. */
  const address = (one: string) => (one.startsWith('www.') ? `https://${one}` : one)

  it('is the words it was typed as, every character of them, in the texts that ask for the addresses', () => {
    /* A floor under the table, since a table that lost its rows would pass every line below it. */
    expect(typed.length).toBeGreaterThan(20)

    for (const one of typed) {
      const text = `[x](${address(one)})`
      const { unmount } = render(<Markdown text={text} addresses outward />)

      expect(screen.queryAllByRole('link'), text).toEqual([])
      expect(screen.getByText(text, { exact: false }).textContent, text).toBe(text)
      unmount()
    }
  })

  it('is the words it was typed as in a cell of a table of those texts, which draws no bare address', () => {
    for (const one of typed) {
      const link = `[x](${address(one)})`
      const text = `| ${link} | b |\n|---|---|\n| ${link} | www.runtrace.net |`
      const { unmount } = render(<Markdown text={text} addresses outward />)

      expect(screen.queryAllByRole('link'), one).toEqual([])
      expect(screen.getByRole('columnheader', { name: link })).toBeVisible()
      expect(screen.getByRole('cell', { name: link })).toBeVisible()
      expect(screen.getByRole('cell', { name: 'www.runtrace.net' })).toBeVisible()
      unmount()
    }
  })

  it('is the link it has always been in a written page, which asks for no addresses', () => {
    const text = `[x](${address(MISLEADING[0]?.typed ?? '')})`

    render(<Markdown text={text} outward />)

    expect(screen.getByRole('link', { name: 'x' })).toHaveAttribute('href', 'https://www.runtrace.net@zlo.example')
  })

  it('is a link again once the address under it is an address that opens what it says', () => {
    for (const one of STAYS_A_LINK) {
      const target = address(one.typed)
      const { unmount } = render(<Markdown text={`[x](${target})`} addresses outward />)

      expect(screen.getByRole('link', { name: 'x' }), one.why).toHaveAttribute('href', target)
      unmount()
    }

    render(<Markdown text="[stara](http://primer.rs/a@b) [pravilnik](/pravilnik) [pošta](mailto:liga@primer.rs)" addresses outward />)

    expect(screen.getByRole('link', { name: 'stara' })).toHaveAttribute('href', 'http://primer.rs/a@b')
    expect(screen.getByRole('link', { name: 'pravilnik' })).toHaveAttribute('href', '/sr/pravilnik')
    expect(screen.getByRole('link', { name: 'pošta' })).toHaveAttribute('href', 'mailto:liga@primer.rs')
  })

  /* NOT DECIDED, and held as a case so that deciding is a decision and not a side effect: the words
     of a link may name one host while the address under them opens another that is nothing wrong
     with it. The owner has not been asked whether the words may differ from the domain. */
  it('is a link whose words name another domain than its address, until the owner says otherwise', () => {
    render(<Markdown text="[www.runtrace.net](https://zlo.example)" addresses outward />)

    expect(screen.getByRole('link', { name: 'www.runtrace.net' })).toHaveAttribute('href', 'https://zlo.example')
  })
})

/* A number somebody typed is the number that is drawn. */
describe('Markdown, the numbers of a numbered list', () => {
  it('draws a list that counts from one with nothing said about its numbers, as it always was', () => {
    render(<Markdown text={'1. prvo\n2. drugo\n3. treće'} />)

    const list = screen.getByRole('list')

    expect(list.tagName).toBe('OL')
    expect(list).not.toHaveAttribute('start')
    for (const item of screen.getAllByRole('listitem')) {
      expect(item).not.toHaveAttribute('value')
    }
  })

  it('draws a list that begins at three from three', () => {
    render(<Markdown text={'3. treće\n4. četvrto'} />)

    expect(screen.getByRole('list')).toHaveAttribute('start', '3')
    expect(screen.getAllByRole('listitem').map((item) => item.getAttribute('value'))).toEqual([null, null])
  })

  it('draws the number of an item that does not follow the one above it', () => {
    render(<Markdown text={'1. mesto\n2. mesto\n4. do 10. mesto'} />)

    expect(screen.getByRole('list')).not.toHaveAttribute('start')
    expect(screen.getAllByRole('listitem').map((item) => item.getAttribute('value'))).toEqual([null, null, '4'])
  })

  it('draws a line that begins with a year as the sentence it is, and not as an item of a list', () => {
    render(<Markdown text={'Prvi red\n2026. godine je liga počela.'} />)

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByText(/2026\. godine je liga počela\./)).toBeVisible()
  })

  it('draws a date at the start of a text as the number it was typed with', () => {
    render(<Markdown text={'15. oktobra se trči trka.'} />)

    expect(screen.getByRole('list')).toHaveAttribute('start', '15')
    expect(screen.getByRole('listitem')).toHaveTextContent('oktobra se trči trka.')
  })
})
