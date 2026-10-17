import { describe, expect, it } from 'vitest'
import { fromPoint } from '../../test/misleadingAddresses'
import type { Piece } from './aroundAWord'
import { mailOf, mailsIn } from './mailsIn'

/**
 * Which words of a text are mailboxes, and where each of them begins and ends (owner, 17.10.2026,
 * PDL „Ispravke sa ekrana 17.10.2026": „kad otkucam nešto nalik mail adresi, treba da ga pretvoriš
 * automatski u link za slanje maila").
 *
 * Every case that reads an `href` carries two mailboxes with different names and hosts, so a link
 * built from the first mailbox of the text, or from a constant, is not a link built from the words.
 */
const words = (text: string): Piece => ({ text, href: null })
const mail = (text: string): Piece => ({ text, href: `mailto:${text}` })

describe('a mailbox in a text', () => {
  it('is a link to write to it, drawn as it was typed, each from its own words', () => {
    expect(mailsIn('Piši na info@primer.rs ili na liga@runtrace.net')).toEqual([
      words('Piši na '),
      mail('info@primer.rs'),
      words(' ili na '),
      mail('liga@runtrace.net'),
    ])
  })

  it('may stand at the start of a line, in brackets or quotation marks, and before the end of a sentence', () => {
    expect(mailsIn('info@primer.rs je adresa')).toEqual([mail('info@primer.rs'), words(' je adresa')])
    expect(mailsIn('Pišite (info@primer.rs).')).toEqual([words('Pišite ('), mail('info@primer.rs'), words(').')])
    expect(mailsIn('„liga@runtrace.net“, rekao je')).toEqual([
      words('„'),
      mail('liga@runtrace.net'),
      words('“, rekao je'),
    ])
    expect(mailsIn('Pišite na info@primer.rs.\nHvala.')).toEqual([
      words('Pišite na '),
      mail('info@primer.rs'),
      words('.\nHvala.'),
    ])
  })

  it('keeps the case and every character of its name and its host', () => {
    expect(mailsIn('Ime.Prezime+liga_2027@Mail.Primer-Lige.rs')).toEqual([
      mail('Ime.Prezime+liga_2027@Mail.Primer-Lige.rs'),
    ])
  })

  it('put back together is the text, character for character', () => {
    const text = '  (a@b.rs)  i\n„c@d.example“. '

    expect(
      mailsIn(text)
        .map((one) => one.text)
        .join(''),
    ).toBe(text)
  })
})

describe('what is not a mailbox, and stays words', () => {
  it.each([
    ['an @ with no full stop in the host', 'ime@primer'],
    ['an @ and nothing behind it', 'ime@'],
    ['an @ and nothing in front of it', '@primer.rs'],
    ['two of them', 'ime@a@primer.rs'],
    ['a host that ends in a digit', 'ime@primer.r5'],
    ['a host whose last label is one letter', 'ime@primer.r'],
    ['a label that begins with a hyphen', 'ime@-primer.rs'],
    ['a label that ends with a hyphen', 'ime@primer-.rs'],
    ['two full stops in the host', 'ime@primer..rs'],
    ['a full stop at the start of the name', '.ime@primer.rs'],
    ['two full stops in the name', 'ime..prezime@primer.rs'],
    ['a full stop at the end of the name', 'ime.@primer.rs'],
    ['a % escape', 'ime%40zlo.example@primer.rs'],
    ['a backslash', `www.zlo.example${'\\'}@www.runtrace.net`],
    ['a query behind it', 'ime@primer.rs?subject=x'],
    ['a path behind it', 'ime@primer.rs/x'],
    ['a scheme in front of it', 'mailto:ime@primer.rs'],
    ['inside the address of a site', 'https://a.example/x@y.example'],
    ['a word that begins with www., which PDL P15 keeps as words', 'www.runtrace.net@zlo.example'],
    ['www. in capitals', 'WWW.runtrace.net@zlo.example'],
    ['a Serbian letter in the host', `ime@ni${fromPoint(0x161)}.rs`],
    ['a Serbian letter in the name', `${fromPoint(0x161)}ef@primer.rs`],
    ['a Cyrillic letter that looks Latin', `ime@prim${fromPoint(0x435)}r.rs`],
    ['an invisible character', `ime@primer${fromPoint(0x200b)}.rs`],
    ['a word made of brackets alone', '(„)'],
  ])('%s: %s', (_why, word) => {
    expect(mailsIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
  })

  it('is no run at all when there is no text', () => {
    expect(mailsIn('')).toEqual([])
  })
})

describe('the link a typed mailbox becomes', () => {
  it('is mailto: and the mailbox, or nothing', () => {
    expect(mailOf('info@primer.rs')).toBe('mailto:info@primer.rs')
    expect(mailOf('liga@runtrace.net')).toBe('mailto:liga@runtrace.net')
    expect(mailOf('ime@primer')).toBeUndefined()
    expect(mailOf('www.runtrace.net@zlo.example')).toBeUndefined()
    expect(mailOf(' info@primer.rs')).toBeUndefined()
  })
})
