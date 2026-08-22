import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import { expectFrontPage, renderAt } from '../test/render'
import { setupUser } from '../test/user'
import WRITTEN from '../../public/mock/pages.json'
import sr from '../i18n/sr.json'

describe('navigation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('sends the bare address to the default language', async () => {
    renderAt('/')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Balkanska trkačka liga',
    )
    expect(document.documentElement.lang).toBe('sr')
  })

  it('treats an unknown language as a path in the default language', async () => {
    renderAt('/de/kalendar')

    await expectFrontPage()
  })

  it('sends an address the portal does not have to the front page', async () => {
    /* Owner, 30.07.2026. It used to be a screen saying the address is not here,
       with a link back. A mistyped address is almost always a typed or a copied
       one, and a page that says "this is not here" leaves somebody at a dead end
       deciding what to do; the front page is what they would have chosen. */
    renderAt('/sr/ovoga-nema')

    await expectFrontPage()
    expect(screen.queryByRole('heading', { name: 'Ove strane nema' })).not.toBeInTheDocument()
  })

  it('opens a public screen straight from the navigation', async () => {
    const user = setupUser()
    renderAt('/sr')

    // The calendar is the one entry that is a link rather than a group.
    await user.click(await screen.findByRole('link', { name: 'Kalendar' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Kalendar' })).toBeVisible()
  })

  it('opens every one of the seven from the header, in one click each', async () => {
    /* Owner, 04.08.2026. The groups are gone, so nothing in the navigation is
       two clicks away and nothing opens onto a panel. Walked end to end rather
       than sampled: the point of the change is that all seven behave alike. */
    const user = setupUser()
    renderAt('/sr')

    const wanted: [string, string][] = [
      ['Pravilnik', 'Opšti pravilnik Balkanske trkačke lige za sezonu 2027'],
      ['Takmičari', 'Takmičari'],
      ['BTL tabele', 'BTL tabele'],
      ['Top liste', 'Top liste'],
      ['Timovi', 'Timovi'],
      ['Lige', 'Lige'],
      ['Kalendar', 'Kalendar'],
    ]

    const menu = within(await screen.findByRole('navigation', { name: 'Glavna navigacija' }))

    expect(menu.queryAllByRole('button')).toEqual([])

    for (const [entry, heading] of wanted) {
      await user.click(menu.getByRole('link', { name: entry }))
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeVisible()
    }
  })

  /* Every address in the navigation has a screen of its own since the ducats
     arrived (PDL P28a, 30.07.2026), so nothing here answers with a placeholder
     any more. What an address answers with before its screen exists is held in
     src/app/screenFor.test.tsx, address by address being pointless there. */

  /* The three that went with the group they stood in (owner, 04.08.2026): the
     story of the league and the page of prices are deleted, and the ducats are a
     section of the rulebook. An address that still answered would be a page
     nothing links to, which is what put those three into a group in the first
     place. */
  it.each([['/sr/o-ligi'], ['/sr/clanarina'], ['/sr/znacke']])(
    'no longer serves %s, and sends it to the front page',
    async (path) => {
      renderAt(path)

      await expectFrontPage()
    },
  )

  it('keeps the current screen when the language changes', async () => {
    const user = setupUser()
    renderAt('/sr/top-liste')

    await user.click(screen.getByRole('button', { name: 'Jezik' }))
    await user.click(screen.getByRole('option', { name: 'English' }))

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Top liste' })).toBeVisible()
  })

  it('declares the language the text is actually written in', async () => {
    const user = setupUser()
    renderAt('/sr')

    await user.click(await screen.findByRole('button', { name: 'Jezik' }))
    await user.click(screen.getByRole('option', { name: 'English' }))

    // /en still shows Serbian words until an English dictionary exists, and
    // lang="en" over Serbian text is read out with English phonetics.
    await waitFor(() => expect(document.documentElement.lang).toBe('sr'))
  })

  /* What each screen is called in the browser tab, what it says about itself to
     a search engine and what a shared link to it shows are all in
     src/app/pageMeta.test.tsx, address by address. */

  it('says out loud which screen opened', async () => {
    renderAt('/sr/timovi')

    expect(await screen.findByRole('status')).toHaveTextContent('Timovi')
  })

  it('offers a visitor the way in, and nothing that belongs to a member', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('link', { name: 'Prijavi se' })).toHaveAttribute(
      'href',
      '/sr/prijava',
    )
    expect(screen.queryByRole('button', { name: 'Otvori nalog' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Otvori poruke' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Podešavanja' })).not.toBeInTheDocument()
  })

  it('gives a signed-in member the account menu in place of the sign-in symbol', async () => {
    renderAt('/sr', 'competitor', '000007')

    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Prijavi se' })).not.toBeInTheDocument()
  })

  it.each([['visitor'], ['competitor']] as const)(
    'hides administration from a %s',
    async (role) => {
      renderAt('/sr', role, '000007')

      await screen.findByRole('link', { name: 'Kalendar' })
      expect(screen.queryByRole('link', { name: /Administracija/ })).not.toBeInTheDocument()
    },
  )

  it('shows the account screens to a member', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))

    expect(screen.getByRole('link', { name: 'Moj profil' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Moja članarina' })).toBeVisible()
  })

  it('shows administration to staff, as one link carrying what is waiting', async () => {
    const user = setupUser()
    renderAt('/sr', 'moderator', '000007')

    /* The entry carries the sum of everything waiting in its name, not only in
       the counter (PDL P28a), and something is always waiting, so the number is
       part of what a screen reader hears here. It stood on Verification while
       the header had groups; it is on the word that is left. */
    const entry = await screen.findByRole('link', { name: /^Administracija, \d+ na čekanju$/ })

    await user.click(entry)

    // And it opens administration, whose navigation carries the two sectors.
    expect(await screen.findByRole('button', { name: 'Verifikacija' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Podaci' })).toBeVisible()
  })

  it('opens and closes the mobile menu', async () => {
    const user = setupUser()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Otvori meni' })
    await user.click(button)

    const close = screen.getByRole('button', { name: 'Zatvori meni' })
    expect(close).toHaveAttribute('aria-expanded', 'true')

    await user.click(close)
    expect(screen.getByRole('button', { name: 'Otvori meni' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('closes the menu after following a link out of it', async () => {
    const user = setupUser()
    renderAt('/sr')

    await user.click(await screen.findByRole('button', { name: 'Otvori meni' }))
    await user.click(screen.getByRole('link', { name: 'Kalendar' }))

    expect(screen.getByRole('button', { name: 'Otvori meni' })).toBeInTheDocument()
  })

  it('no longer switches the theme from the header, and sends the cog to settings', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    // The switch moved to the settings screen (PDL P28a); the header only leads
    // there now, from behind the account picture.
    await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))
    expect(screen.getByRole('link', { name: 'Podešavanja' })).toHaveAttribute(
      'href',
      '/sr/podesavanja',
    )
    expect(screen.queryByRole('button', { name: 'Uključi tamnu temu' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Uključi svetlu temu' })).not.toBeInTheDocument()
  })

  it('offers contact as an address rather than as a screen', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('link', { name: 'Kontakt' })).toHaveAttribute(
      'href',
      'mailto:info@balkanskatrkackaliga.net',
    )
  })

/** The address the statute is served at, written once here so the guard below
 *  and the page it reads answer to the same string. */
const STATUTE = '/BTL%20Statut.pdf'

  it('publishes the statute as the document it is, and the document is there', async () => {
    /* Član 34 stav 6 of the statute adopted on 17.08.2026 puts the statute on the
       internet page of the association, and član 39 stav 2 gives three days from the day
       it was adopted. It was a page of twenty sections until 20.08.2026; the owner asked
       that it not be pushed at anybody, and then that the document itself be published,
       under that name, linked from the footer. On 22.08.2026 that button went too,
       and the link moved into the first section of the terms of use, which is
       where it is read from below.
       The file is checked to exist, because a link to a missing document reads as
       published while publishing nothing, and that is worse than no link at all: the
       obligation would look met. */
    /* Read off the terms of use and not off the footer. The button in the footer
       is gone (owner, 22.08.2026: „izbaci i dugme Statut iz footera sajta, ne
       želim ga tu"), and the same owner asked in the same breath that the name
       of the statute in the first section of the terms be the link. So the
       document has one home now, and this is it. */
    renderAt('/sr/uslovi-koriscenja')

    const link = await screen.findByRole('link', { name: 'Statut Sportskog udruženja BTL' })

    expect(link).toHaveAttribute('href', '/BTL%20Statut.pdf')
    /* And nowhere else, because the obligation is met by one published copy and
       two of them are two things to keep true.
     *
       Counted in the content rather than looked for by name on one screen. Asked
       as „no link called exactly Statut is on this render", a second one written
       into the rulebook as „Preuzmite [Statut](/BTL%20Statut.pdf)." passed
       without a word: wrong screen, and a name that is not exactly that. */
    const linking = Object.entries(WRITTEN).flatMap(([slug, page]) =>
      page.sections
        .filter((section) => section.body.includes(STATUTE))
        .map((section) => `${slug} / ${section.heading}`),
    )

    expect(linking).toEqual(['uslovi-koriscenja / 1. Ko smo i šta ovi uslovi uređuju'])

    const served = join(process.cwd(), 'public', decodeURIComponent('BTL%20Statut.pdf'))

    expect(existsSync(served), `${served} is linked and is not there`).toBe(true)

    const carried = readFileSync(served)

    expect(carried.subarray(0, 5).toString('latin1'), 'what is served is not a PDF').toBe('%PDF-')

    /* Three questions and not one of them instead of another, which is the mistake this
       guard has already made twice. „Over a kilobyte" let a photograph through with five
       bytes written over it. „Says it is the statute" was then put in its place rather
       than beside it, and a document cut short at a kilobyte still carries both the
       header and the title, which sat on byte 928 of the 184715 the file had then: an
       interrupted copy or a one-page export publishes a stump and the gate stays green.
       So: a PDF, the size of this document, and calling itself by its name. */
    expect(carried.length, 'what is served is too small to be the statute').toBeGreaterThan(
      100 * 1024,
    )

    /* And carrying nobody's confidentiality label. The published file arrived with
       `MSIP_Label_..._Name`, naming one company's internal classification, the Microsoft
       tenant it belongs to and the moment it was applied — on a document Član 34 stav 6
       requires to be public. It is off since 22.08.2026, and nothing noticed it was ever
       on: a security round put the key back and the whole gate stayed green.

       The way it arrived is the way it comes back. A tenant policy stamps the label on
       export, so the next time this document is exported from Word it is stamped again,
       and the only thing between that and the public site is this line.

       One mark, and neither the company's name nor the exact spelling of the key. The
       name was here and caught nothing this does not, while writing a third party's name
       and the story of their leak into a public repository. `MSIP_Label` was here too and
       is one capital away from passing: `Msip_Label` walked past it, measured.

       The answer is a boolean and not the text, so a failure says which mark it found
       instead of printing a quarter of a megabyte of compressed streams. */
    const looked = carried.toString('latin1').toLowerCase()

    expect(
      looked.includes('msip'),
      "the published statute carries an MSIP label, which is somebody's internal classification",
    ).toBe(false)

    /* And whole, which a size cannot say. A copy cut off at any length under the whole
       one is over that threshold and still unreadable: a PDF ends with its own mark, and
       a stump does not have it. */
    expect(
      carried.subarray(-1024).toString('latin1'),
      'what is served is not a whole PDF',
    ).toContain('%%EOF')

    /* And readable, which `%%EOF` does not say either, and this is the newest of the
       lessons this guard is made of.
     *
       On 22.08.2026 a line was taken out of the header to keep the name of a tool off a
       public file. Twenty-six bytes shorter, every offset in the cross-reference table
       pointed twenty-six bytes past its object, and two independent readers refused the
       document outright: `pdftotext` exited non-zero having written nothing, and `pypdf`
       could not find the root. The four questions above all passed, and so did the proof
       written for that change — pages, text and pixels compared through a library that
       silently repairs a broken table before it reads it. A guard that reads through a
       repair cannot see a break.
     *
       So the table is followed the way a reader follows it: `startxref` names a byte, and
       at that byte a PDF has either the word `xref` or the head of the object holding the
       table. Anything else means the offsets no longer describe this file.
     *
       **The head and not the tail of it.** Written without the line break in front, the
       pattern matched the end of a number: the table points at `640 0 obj`, and a file
       one byte shorter puts `40 0 obj` on that spot, which read as a head is a head. One
       and two bytes therefore passed while `pypdf` and `pdftotext` both refused the
       document — the same fault as before, one twenty-sixth its size, and the likeliest
       size of it, since the fix that caused it was a hand count of twenty-six bytes.
     *
       A file **longer** by a byte fails here too, and that is meant. Readers cope with
       it, but an offset that does not land exactly on the head of an object is a table
       that no longer describes the file, and the next hand to touch these bytes should
       hear about it rather than inherit it. */
    const startxref = carried.lastIndexOf(Buffer.from('startxref', 'latin1'))

    expect(startxref, 'what is served has no startxref').toBeGreaterThan(-1)

    const at = Number(
      /startxref\s+(\d+)/.exec(carried.subarray(startxref, startxref + 64).toString('latin1'))?.[1],
    )

    expect(at, 'the offset of the cross-reference table is past the end of the file').toBeLessThan(
      carried.length,
    )
    expect(at, 'the cross-reference table of the statute starts at the very first byte')
      .toBeGreaterThan(0)
    expect(
      carried.subarray(at - 1, at + 24).toString('latin1'),
      'the cross-reference table of the statute does not describe this file',
    ).toMatch(/^[\r\n](xref|\d+\s+0\s+obj)/)

    /* The name in both alphabets a word processor writes. Word keeps a title of plain
       letters as it is and writes one with any letter outside them as UTF-16, which this
       very file already does for `/Creator` because of a ®. The document is transliterated
       today; the day its diacritics are put back and it is exported again, a guard that
       knows only the first form fails on a statute that is perfectly correct. */
    const named = 'Statut Sportskog udru'
    const plain = Buffer.from(`/Title(${named}`, 'latin1')
    /* Anchored to `/Title(` in this alphabet too. Looked for as bare bytes, the name
       counted wherever it stood, so a document whose title says it is the minutes and
       whose `/Subject` happens to carry the name of the statute passed all three
       questions: measured. The mark before it is the byte order mark Word writes at the
       front of such a string, and it is why the wide form is recognisable at all.
       Written as an escape and not as the character itself: as a character it is
       invisible in the source and in a diff, it sits on a branch that does not run while
       the document has no diacritics, and deleting it turns the guard loose without a
       single test going red. Measured. */
    const wide = Buffer.concat([
      Buffer.from('/Title(', 'latin1'),
      Buffer.from(`\uFEFF${named}`, 'utf16le').swap16(),
    ])

    expect(
      carried.includes(plain) || carried.includes(wide),
      'what is served does not call itself the statute, in either alphabet',
    ).toBe(true)
  })

  it('offers the skip link as the first thing in the page', async () => {
    renderAt('/sr')

    const skip = await screen.findByRole('link', { name: 'Preskoči na sadržaj' })
    expect(skip).toHaveAttribute('href', '#content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content')
  })

  it('carries three links in the footer and nothing else', async () => {
    /* „Portal je u izradi. Sve što ovde vidiš su probni podaci." stood under
       them until 22.08.2026. Owner: „Ovo obriši da se više ne prikazuje, znam do
       kada su podaci probni a kad će postati stvarni."
     *
       Found by its landmark and not by its class. Asked as `.shell__footer`, the
       footer answered to a `div` with that class and no `contentinfo` role, and
       the navigation inside it answered with no accessible name: the class is
       still there, so the guard sees a footer while a screen reader has lost
       both. Measured, and the whole suite stayed green.
     *
       „And nothing else" is measured too, since the name says it. The note is
       held as an absence in both homes — the markup and the dictionary — because
       a sentence deleted from one and left in the other comes back the first time
       somebody reaches for a note to put there. And the footer is held to having
       nothing but that navigation in it: a line of small print added under the
       links passed everything this test had before. */
    renderAt('/sr')

    const footer = await screen.findByRole('contentinfo')
    const nav = within(footer).getByRole('navigation', { name: 'Uslovi i pravila' })
    const links = within(nav)
      .getAllByRole('link')
      .map((one) => one.textContent?.trim())

    expect(links).toEqual(['Politika privatnosti', 'Uslovi korišćenja', 'Kontakt'])
    /* „Nothing else" counted in elements and not only in text, which catches what
       is put beside the navigation rather than inside it: a link carrying an icon
       and an `aria-label`, a sponsor's image, a rule, an ornamental div, a second
       navigation. Every one of those passed everything this test had before and
       fails now.
     *
       A fourth link inside the navigation was caught before this line and still
       is, by the three names above; a bare line of text anywhere in the footer is
       caught by the line under this one. Said plainly because the comment here
       claimed the fourth link, which was the one case that needed nothing new.
     *
       The count is one level deep, and that is where it stops: an image or a rule
       put inside the navigation carries no text and leaves the footer with the one
       child it had, so it goes past all three lines. Measured both ways. */
    expect([...footer.children].map((one) => one.tagName)).toEqual(['NAV'])
    expect(footer.textContent?.trim()).toBe(links.join(''))
    expect(JSON.stringify(sr)).not.toContain('Portal je u izradi')
  })
})
