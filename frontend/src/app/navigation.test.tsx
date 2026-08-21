import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import { expectFrontPage, renderAt } from '../test/render'
import { setupUser } from '../test/user'

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

  it('publishes the statute as the document it is, and the document is there', async () => {
    /* Član 34 stav 6 of the statute adopted on 17.08.2026 puts the statute on the
       internet page of the association, and član 39 stav 2 gives three days from the day
       it was adopted. It was a page of twenty sections until 20.08.2026; the owner asked
       that it not be pushed at anybody, and then that the document itself be published,
       under that name. A link in the footer is both: published, and out of the way.
       The file is checked to exist, because a link to a missing document reads as
       published while publishing nothing, and that is worse than no link at all: the
       obligation would look met. */
    renderAt('/sr')

    const link = await screen.findByRole('link', { name: 'Statut' })

    expect(link).toHaveAttribute('href', '/BTL%20Statut.pdf')

    const served = join(process.cwd(), 'public', decodeURIComponent('BTL%20Statut.pdf'))

    expect(existsSync(served), `${served} is linked and is not there`).toBe(true)

    const carried = readFileSync(served)

    expect(carried.subarray(0, 5).toString('latin1'), 'what is served is not a PDF').toBe('%PDF-')

    /* Three questions and not one of them instead of another, which is the mistake this
       guard has already made twice. „Over a kilobyte" let a photograph through with five
       bytes written over it. „Says it is the statute" was then put in its place rather
       than beside it, and a document cut short at a kilobyte still carries both the
       header and the title, which sits on byte 928 of 184715: an interrupted copy or a
       one-page export publishes a stump and the gate stays green. So: a PDF, the size of
       this document, and calling itself by its name. */
    expect(carried.length, 'what is served is too small to be the statute').toBeGreaterThan(
      100 * 1024,
    )

    /* The name in both alphabets a word processor writes. Word keeps a title of plain
       letters as it is and writes one with any letter outside them as UTF-16, which this
       very file already does for `/Creator` because of a ®. The document is transliterated
       today; the day its diacritics are put back and it is exported again, a guard that
       knows only the first form fails on a statute that is perfectly correct. */
    const named = 'Statut Sportskog udruzenja BTL'
    const asWritten = carried.toString('latin1').includes(`/Title(${named}`)
    const asWide = carried.includes(Buffer.from(`﻿Statut Sportskog udru`, 'utf16le').swap16())

    expect(
      asWritten || asWide,
      'what is served does not call itself the statute, in either alphabet',
    ).toBe(true)
  })

  it('offers the skip link as the first thing in the page', async () => {
    renderAt('/sr')

    const skip = await screen.findByRole('link', { name: 'Preskoči na sadržaj' })
    expect(skip).toHaveAttribute('href', '#content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content')
  })
})
