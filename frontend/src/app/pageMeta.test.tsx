import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import sr from '../i18n/sr.json'
import { renderAt } from '../test/render'
import { SITE_ORIGIN } from './head'
import { PageMeta } from './PageMeta'

const LEAGUE = 'Balkanska trkačka liga'

function content(attribute: 'name' | 'property', key: string): string | null {
  const tag = document.head.querySelector(`meta[${attribute}="${key}"]`)

  return tag === null ? null : tag.getAttribute('content')
}

function href(rel: string, hreflang?: string): string | null {
  const selector =
    hreflang === undefined ? `link[rel="${rel}"]` : `link[rel="${rel}"][hreflang="${hreflang}"]`
  const tag = document.head.querySelector(selector)

  return tag === null ? null : tag.getAttribute('href')
}

describe('the name of a page', () => {
  it('gives the home page the league and its slogan, and never the word "Naslovna"', async () => {
    renderAt('/sr')

    await waitFor(() => expect(document.title).toBe(`Svaka trka se broji · ${LEAGUE}`))
    expect(document.title).not.toContain('Naslovna')
  })

  it('names a screen from the navigation more fully than the navigation does', async () => {
    renderAt('/sr/kalendar')

    // "Kalendar" alone is enough inside the navigation, where the rest of the
    // portal is the context. A browser tab and a search result have no context.
    await waitFor(() => expect(document.title).toBe(`${sr.seo.calendar.title} · ${LEAGUE}`))
    expect(sr.seo.calendar.title).not.toBe(sr.nav.calendar)
  })

  it('names the not found page as such', async () => {
    renderAt('/sr/ovoga-nema')

    await waitFor(() => expect(document.title).toBe(`Ove strane nema · ${LEAGUE}`))
  })

  it('carries the person on a competitor profile, not "Ove strane nema"', async () => {
    renderAt('/sr/takmicar/000007')

    await waitFor(() =>
      expect(document.title).toBe(`Strahinja Vukićević (000007) · ${LEAGUE}`),
    )
    expect(content('name', 'description')).toContain('Strahinja Vukićević')
  })

  it('carries the event and its date', async () => {
    renderAt('/sr/kalendar/podgoricka-desetka-2027-01-30')

    await waitFor(() =>
      expect(document.title).toBe(`Podgorička desetka, 30. januar 2027. · ${LEAGUE}`),
    )
    expect(content('name', 'description')).toContain('Podgorička desetka')
  })

  it('carries the team', async () => {
    renderAt('/sr/tim/dunavski-trkaci')

    await waitFor(() => expect(document.title).toBe(`Dunavski trkači, Novi Sad · ${LEAGUE}`))
  })

  it('carries the competition', async () => {
    renderAt('/sr/liga/runtrace-2027')

    await waitFor(() => expect(document.title).toBe(`RunTrace liga 2027 · ${LEAGUE}`))
  })

  it('keeps a record it cannot find out of the name', async () => {
    renderAt('/sr/tim/nepostojeci')

    // The address exists even when the record does not, so it keeps the name of
    // the address rather than falling back to "Ove strane nema".
    await waitFor(() => expect(document.title).toBe(`${sr.seo.team.title} · ${LEAGUE}`))
  })

  it('gives the page its own name back on the way out of a record', async () => {
    const user = userEvent.setup()
    renderAt('/sr/tim/dunavski-trkaci')

    await waitFor(() => expect(document.title).toContain('Dunavski trkači'))
    await user.click(screen.getByRole('link', { name: sr.teams.backToTeams }))

    await waitFor(() => expect(document.title).toBe(`${sr.seo.teams.title} · ${LEAGUE}`))
  })

  it('leaves the member area its own name where it shows somebody a profile', async () => {
    renderAt('/sr/moj-profil', 'competitor', '000007')

    // The same profile, on an address that belongs to the member area rather
    // than to the person.
    await screen.findByRole('heading', { level: 1, name: 'Strahinja Vukićević' })
    await waitFor(() => expect(document.title).toBe(`${sr.seo.myProfile.title} · ${LEAGUE}`))
  })

  it('never puts the subject or the body of a message in the name (PDL P23)', async () => {
    renderAt('/sr/poruke/msg-1', 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: 'Dobro došao u pripremu sezone 2027' })
    await waitFor(() => expect(document.title).toBe(`${sr.seo.message.title} · ${LEAGUE}`))
    expect(document.title).not.toContain('Dobro došao')
    expect(content('name', 'description')).not.toContain('Portal je otvoren')
  })
})

describe('the description of a page', () => {
  it('says what the screen is for, in words the title does not repeat', async () => {
    renderAt('/sr/kalendar')

    await waitFor(() => expect(content('name', 'description')).toBe(sr.seo.calendar.description))
    expect(content('name', 'description')).not.toBe(document.title)
  })

  it('follows the screen from one address to the next', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await waitFor(() => expect(content('name', 'description')).toBe(sr.seo.home.description))
    await user.click(screen.getByRole('link', { name: sr.nav.calendar }))

    await waitFor(() => expect(content('name', 'description')).toBe(sr.seo.calendar.description))
  })
})

describe('the address of a page', () => {
  it('declares itself canonical, and both languages as each other alternative', async () => {
    renderAt('/sr/kalendar')

    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr/kalendar`))
    expect(href('alternate', 'sr')).toBe(`${SITE_ORIGIN}/sr/kalendar`)
    expect(href('alternate', 'en')).toBe(`${SITE_ORIGIN}/en/kalendar`)
    expect(href('alternate', 'x-default')).toBe(`${SITE_ORIGIN}/sr/kalendar`)
  })

  it('moves the canonical address to the language being read', async () => {
    renderAt('/en/kalendar')

    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/en/kalendar`))
    expect(href('alternate', 'sr')).toBe(`${SITE_ORIGIN}/sr/kalendar`)
    expect(href('alternate', 'en')).toBe(`${SITE_ORIGIN}/en/kalendar`)
    // /en still shows Serbian words until an English dictionary exists (ADL A2),
    // so what the text is written in has not changed.
    expect(content('property', 'og:locale')).toBe('sr_RS')
  })

  it('follows the language switch', async () => {
    const user = userEvent.setup()
    renderAt('/sr/top-liste')

    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr/top-liste`))

    await user.click(screen.getByRole('button', { name: sr.language.label }))
    await user.click(screen.getByRole('option', { name: 'English' }))

    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/en/top-liste`))
  })

  it('leaves the home page without a path of its own', async () => {
    renderAt('/sr')

    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr`))
  })

  it('keeps a filter out of the canonical address', async () => {
    renderAt('/sr/takmicar/000007?sezona=2027')

    // A filtered profile is the same page as the unfiltered one; two addresses
    // for it would be one page competing with itself.
    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr/takmicar/000007`))
  })
})

describe('what a shared link shows', () => {
  it('carries the name, the sentence and the name of the site', async () => {
    renderAt('/sr/takmicar/000007')

    await waitFor(() => expect(content('property', 'og:title')).toBe(document.title))
    expect(content('property', 'og:description')).toBe(content('name', 'description'))
    expect(content('property', 'og:site_name')).toBe(LEAGUE)
    expect(content('property', 'og:url')).toBe(`${SITE_ORIGIN}/sr/takmicar/000007`)
    expect(content('name', 'twitter:title')).toBe(document.title)
    expect(content('name', 'twitter:description')).toBe(content('name', 'description'))
  })
})

describe('PageMeta', () => {
  it('refuses to work outside the shell that writes the head', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<PageMeta title="Naslov" description="Opis" />)).toThrow(
      'PageMeta must be used inside PageMetaContext',
    )

    logged.mockRestore()
  })
})
