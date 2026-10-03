import { vi } from 'vitest'
import { addressesIn, type Piece } from './addressesIn'

/**
 * What `addressesIn` decides on its own, under a gate that says yes to everything.
 *
 * **Why this is a file of its own.** The gate beneath it (`data/outsideLink.ts`) is a different rule
 * held by a different file, and some of what the owner decided about the two forms of address
 * (03.10.2026, PDL P15) is today also the gate's doing: its pattern is written in lower case, so it
 * refuses `HTTPS://primer.rs` whether or not anything above it does. A rule that is held twice is
 * held by whichever copy is asked first, and a case that runs against the real gate cannot tell
 * which of the two refused. Measured with a mutation on 03.10.2026: `https://` made case-insensitive
 * in `addressesIn` survived all 115 cases of `addressesIn.test.ts`, because the gate refused the
 * upper-case word for it.
 *
 * So the gate is replaced here by one that hands every address back, and what stays words below is
 * the doing of `addressesIn` and of nothing beneath it. The day the gate changes (it is shared with
 * the page of an event, and that page is changed by another job), the two forms stay the two forms.
 */
vi.mock('../../data/outsideLink', () => ({ outsideLink: (said: string): string => said }))

const words = (text: string): Piece => ({ text, href: null })
const link = (text: string, href: string): Piece => ({ text, href })

describe('under a gate that accepts everything', () => {
  it.each(['HTTPS://primer.rs', 'Https://primer.rs', 'hTTps://primer.rs/lige'])(
    'https:// in any case but lower stays words: %s',
    (word) => {
      expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
    },
  )

  it.each(['http://primer.rs', 'http://www.primer.rs', 'ftp://primer.rs', 'javascript:alert(1)'])(
    'what is not one of the two forms stays words: %s',
    (word) => {
      expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
    },
  )

  it.each(['www.', 'www..', 'www.,', 'https://', 'https://.', '(www.)', '„https://“'])(
    'a prefix with nothing behind it stays words: %s',
    (word) => {
      expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
    },
  )

  it.each(['ime@www.primer.rs', 'xwww.primer.rs', 'a(www.primer.rs)', 'ahttps://primer.rs'])(
    'an address that begins in the middle of a word stays words: %s',
    (word) => {
      expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
    },
  )

  it('hands the gate the address and nothing else: no bracket, no quotation mark, no full stop', () => {
    /* The gate here answers with what it was given, so the `href` is exactly what was asked of it. */
    expect(addressesIn('Vidi („www.primer.rs/lige“), pa https://btl.example/nagrade.')).toEqual([
      words('Vidi („'),
      link('www.primer.rs/lige', 'https://www.primer.rs/lige'),
      words('“), pa '),
      link('https://btl.example/nagrade', 'https://btl.example/nagrade'),
      words('.'),
    ])
  })

  it('takes the answer of the gate for the address, and does not judge a browser’s address itself', () => {
    /* `https://[::1` is what a browser refuses and what the real gate refuses. A gate that accepts it
       gets it linked: the judgement of what a browser may be given is the gate's and nothing above it
       repeats it. */
    expect(addressesIn('https://[::1')).toEqual([link('https://[::1', 'https://[::1')])
  })
})
