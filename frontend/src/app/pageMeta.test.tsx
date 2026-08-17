import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { applyHead, SITE_ORIGIN } from './head'
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

    await waitFor(() => expect(document.title).toBe('Balkanska trkačka liga - svaka trka se broji!'))
    expect(document.title).not.toContain('Naslovna')
  })

  it('names a screen from the navigation more fully than the navigation does', async () => {
    renderAt('/sr/kalendar')

    // "Kalendar" alone is enough inside the navigation, where the rest of the
    // portal is the context. A browser tab and a search result have no context.
    await waitFor(() => expect(document.title).toBe(`${sr.seo.calendar.title} · ${LEAGUE}`))
    expect(sr.seo.calendar.title).not.toBe(sr.nav.calendar)
  })

  it('lands on the front page when the address is not one, and says so in the tab', async () => {
    // The address is gone rather than named (owner, 30.07.2026), so the tab ends
    // up saying what the front page says.
    renderAt('/sr/ovoga-nema')

    await waitFor(() => expect(document.title).toBe('Balkanska trkačka liga - svaka trka se broji!'))
  })

  it('carries the person on a competitor profile, not "Ove strane nema"', async () => {
    renderAt('/sr/takmicar/000007')

    await waitFor(() =>
      expect(document.title).toBe(`Strahinja Vukićević, Banja Luka · ${LEAGUE}`),
    )
    expect(content('name', 'description')).toContain('Strahinja Vukićević')
  })

  it('carries the event and its date', async () => {
    renderAt('/sr/kalendar/podgoricka-desetka-2027')

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
    const user = setupUser()
    renderAt('/sr/tim/dunavski-trkaci')

    await waitFor(() => expect(document.title).toContain('Dunavski trkači'))
    await user.click(screen.getByRole('link', { name: sr.teams.backToTeams }))

    await waitFor(() => expect(document.title).toBe(`${sr.seo.teams.title} · ${LEAGUE}`))
  })

  it('leaves the member area its own name where it shows somebody a profile', async () => {
    renderAt('/sr/moj-profil', 'competitor', '000007')

    // The same profile, on an address that belongs to the member area rather
    // than to the person.
    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })
    await waitFor(() => expect(document.title).toBe(`${sr.seo.myProfile.title} · ${LEAGUE}`))

    /* And it stays that, which is the half `waitFor` cannot say on its own: it
       settles on the first tick where the title is right, and the title is right
       before the profile has declared anything at all. A review took the guard
       off the declaration and this test passed while the tab read „Strahinja
       Vukićević, Banja Luka". Given a turn of the loop, the wrong name has
       arrived if it is coming. */
    await act(async () => {
      await new Promise((settled) => {
        setTimeout(settled, 0)
      })
    })

    expect(document.title).toBe(`${sr.seo.myProfile.title} · ${LEAGUE}`)
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
    const user = setupUser()
    renderAt('/sr')

    await waitFor(() => expect(content('name', 'description')).toBe(sr.seo.home.description))
    await user.click(screen.getByRole('link', { name: sr.nav.calendar }))

    await waitFor(() => expect(content('name', 'description')).toBe(sr.seo.calendar.description))
  })
})

describe('the address of a page', () => {
  it('declares itself canonical, and offers the languages that have words', async () => {
    renderAt('/sr/kalendar')

    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr/kalendar`))
    expect(href('alternate', 'sr')).toBe(`${SITE_ORIGIN}/sr/kalendar`)
    expect(href('alternate', 'x-default')).toBe(`${SITE_ORIGIN}/sr/kalendar`)

    /* No alternative for English while /en serves the Serbian words letter for
       letter (src/i18n/config.ts). Announcing it hands a search engine the same
       text under two sets of addresses, and hands an English reader a page they
       cannot read either way. To be undone with the English dictionary, together
       with the canonical below. */
    expect(href('alternate', 'en')).toBeNull()
  })

  it('moves a profile opened by number alone to the one address, and names it', async () => {
    /* The centre of PDL P11, and nothing measured it: a review replaced the
       condition on the profile's redirect with `if (false)` and all 1912 tests
       stayed green.
     *
       Both halves are here, because they are one promise. The reader is moved,
       so what they share afterwards is the canonical address; and the canonical
       link says the same thing to a search engine. What the query carries is
       left alone by both: it never was part of the address. */
    const { router } = renderAt('/sr/takmicar/000007?sezona=2019')

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    expect(router.state.location.pathname).toBe('/sr/takmicar/000007-strahinja-vukicevic')
    expect(router.state.location.search).toBe('?sezona=2019')

    await waitFor(() =>
      expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr/takmicar/000007-strahinja-vukicevic`),
    )
  })

  it('replaces the address rather than stacking one on top of it', async () => {
    /* PDL P11: the reader is moved „u mestu". Without `replace` the old address
       stays in the history, so Back returns to it and it redirects again at
       once: a loop the reader cannot get out of by going back. Nothing held it;
       taking `replace` off either screen passed the whole suite. */
    const { router } = renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    /* One entry, not two: the address arrived at replaced the one typed. */
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('moves the trophies of one person the same way, keeping the tail', async () => {
    const { router } = renderAt('/sr/takmicar/000007/priznanja')

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    expect(router.state.location.pathname).toBe(
      '/sr/takmicar/000007-strahinja-vukicevic/priznanja',
    )

    await waitFor(() =>
      expect(href('canonical')).toBe(
        `${SITE_ORIGIN}/sr/takmicar/000007-strahinja-vukicevic/priznanja`,
      ),
    )
  })

  it.each([
    ['/sr/kalendar/', 'a slash on the end'],
    ['/sr/KALENDAR', 'the section in capitals'],
    ['/sr/Kalendar/', 'both at once'],
  ])('names one canonical address for %s, %s', async (address) => {
    /* A path is case sensitive and a trailing slash is a different path, so these
       are three addresses for one page. Left alone, each of them told a search
       engine „I am the original", which is the one thing a canonical link exists
       to prevent (owner, 16.08.2026: do what everybody else does).
     *
       The reader is not moved: they typed it, they get the page they asked for at
       the address they asked for. Only the link that names the original is
       tidied, and it is tidied for every screen at once (app/head.ts), not for
       the two that used to do it for themselves. */
    renderAt(address)

    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr/kalendar`))

    /* And the same address under the same name everywhere else on the page. The
       router matches without regard to case, so this really is the calendar and
       not a miss; while only the canonical link was tidied, the page named
       /sr/kalendar as the original and then titled itself „Ove strane nema". */
    expect(document.title).toBe(`${sr.seo.calendar.title} · ${LEAGUE}`)
    expect(content('name', 'description')).toBe(sr.seo.calendar.description)
    await screen.findByRole('heading', { level: 1, name: sr.nav.calendar })
  })

  it('canonicalises the English branch onto the Serbian one', async () => {
    renderAt('/en/kalendar')

    // The address of the language the text is written in, not the address being
    // read: two addresses over one text is one page competing with itself.
    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr/kalendar`))
    expect(href('alternate', 'sr')).toBe(`${SITE_ORIGIN}/sr/kalendar`)
    expect(href('alternate', 'en')).toBeNull()
    // A link shared off /en gathers its shares on the same one address.
    expect(content('property', 'og:url')).toBe(`${SITE_ORIGIN}/sr/kalendar`)
    // /en still shows Serbian words until an English dictionary exists (ADL A2),
    // so what the text is written in has not changed.
    expect(content('property', 'og:locale')).toBe('sr_RS')
  })

  it('follows the language switch', async () => {
    const user = setupUser()
    renderAt('/sr/top-liste')

    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr/top-liste`))

    await user.click(screen.getByRole('button', { name: sr.language.label }))
    await user.click(screen.getByRole('option', { name: 'English' }))

    /* The address changed and the canonical did not, which is the point: the
       English address is the Serbian page until there are English words. */
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr/top-liste`)
  })

  it('leaves the home page without a path of its own', async () => {
    renderAt('/sr')

    await waitFor(() => expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr`))
  })

  it('keeps a filter out of the canonical address, and carries the name', async () => {
    renderAt('/sr/takmicar/000007?sezona=2027')

    /* Waited on the record rather than on the address. The profile declares its
       own canonical once it knows whose it is (PDL P11: one address, and it
       carries the name), and until then the head holds the address being read.
       Asked without waiting, `waitFor` catches that first state and passes: the
       old form of this test passed against both answers, which is the same as
       passing against none. */
    await screen.findByRole('heading', { level: 1, name: 'Strahinja Vukićević' })

    // A filtered profile is the same page as the unfiltered one; two addresses
    // for it would be one page competing with itself.
    await waitFor(() =>
      expect(href('canonical')).toBe(`${SITE_ORIGIN}/sr/takmicar/000007-strahinja-vukicevic`),
    )
  })
})

describe('what a shared link shows', () => {
  it('carries the name, the sentence and the name of the site', async () => {
    renderAt('/sr/takmicar/000007')

    /* The record first, for the same reason as above: the address a link shares
       is the one the profile declares once it knows whose it is. */
    await screen.findByRole('heading', { level: 1, name: 'Strahinja Vukićević' })

    await waitFor(() => expect(content('property', 'og:title')).toBe(document.title))
    expect(content('property', 'og:description')).toBe(content('name', 'description'))
    expect(content('property', 'og:site_name')).toBe(LEAGUE)
    /* Waited on, like the canonical it mirrors: the address a profile shares is
       declared when the record arrives, one render after the title. */
    await waitFor(() =>
      expect(content('property', 'og:url')).toBe(
        `${SITE_ORIGIN}/sr/takmicar/000007-strahinja-vukicevic`,
      ),
    )
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

describe('the two parts of a competition', () => {
  const meta = () => document.querySelector('meta[name="description"]')?.getAttribute('content')

  it('name themselves apart, so no two addresses share a title', async () => {
    /* Both parts are indexable and both carried the same title and the same
       description. The profile has named its awards apart from itself since
       30.07.2026; this is the same rule on the competition.

       Waited for rather than read straight away: until the record arrives the
       address shows its own generic name, and the generic names do differ, so
       reading too early would pass on a page that never names the record at
       all. */
    renderAt('/sr/liga/brdska-2019')
    await waitFor(() => expect(document.title).toContain('Brdska liga 2019'))
    const standing = { title: document.title, description: meta() }

    cleanup()

    renderAt('/sr/liga/brdska-2019/rezultati')
    await waitFor(() => expect(document.title).toContain('Brdska liga 2019'))

    expect(document.title).not.toBe(standing.title)
    expect(document.title).toContain('poredak')
    expect(meta()).not.toBe(standing.description)
  })
})

/** Every text under `seo` whose name says it is a description, wherever it sits:
 *  `description` on a screen, `recordDescription` and its like on the screens
 *  named after one record. Paired with the path it was found at, so a failure
 *  says which one. */
function descriptions(): [string, string][] {
  return Object.entries(sr.seo).flatMap(([screen, entry]) =>
    Object.entries(entry)
      .filter(([key, text]) => key.toLowerCase().includes('description') && typeof text === 'string')
      .map(([key, text]): [string, string] => [`${screen}.${key}`, String(text)]),
  )
}

describe('the titles as a set, rather than one at a time', () => {
  /* Every screen is named in one dictionary and each name was chosen against
     the screen it belongs to. What nobody checks that way is the set: two
     screens can be given the same name months apart and each reads fine on its
     own, while a search engine is handed two pages that claim to be the same
     one and keeps whichever it likes. */
  it('gives no two screens the same name', () => {
    const titles = Object.entries(sr.seo).map(([key, entry]) => [key, entry.title] as const)
    const seen = new Map<string, string>()
    const clashes: string[] = []

    for (const [key, title] of titles) {
      const first = seen.get(title)

      if (first === undefined) {
        seen.set(title, key)
      } else {
        clashes.push(`${first} i ${key}: "${title}"`)
      }
    }

    expect(clashes).toEqual([])
  })

  it('gives no two screens the same description either', () => {
    const seen = new Set<string>()
    const clashes: string[] = []

    for (const [key, entry] of Object.entries(sr.seo)) {
      if (seen.has(entry.description)) {
        clashes.push(key)
      }

      seen.add(entry.description)
    }

    expect(clashes).toEqual([])
  })

  it('keeps every description short enough to be shown whole', () => {
    /* A search result shows about a hundred and sixty characters and cuts the
       rest mid-word. The limit is written in the type of PageHead; nothing had
       ever measured against it.

       Every description under `seo`, not only the ones called `description`. The
       screens that are named after a record carry `recordDescription`, and those
       are the ones a long name is interpolated into, so they are the ones nearest
       the limit rather than the ones furthest from it. */
    /* Measured with something in the gaps. A description with `{name}` in it is
       shortest exactly where nothing has been put in it yet, and the screens
       that are named after a record are the ones a long name is interpolated
       into. Forty characters is longer than any name in the data and shorter
       than a name nobody would enter. */
    const long = 'x'.repeat(40)
    const tooLong = descriptions()
      .map(([where, text]): [string, string] => [where, text.replace(/\{\w+\}/g, long)])
      .filter(([, text]) => text.length > 160)

    expect(tooLong).toEqual([])
  })

  it('has descriptions under every one of those names, so the sweep is not empty', () => {
    expect(descriptions().length).toBeGreaterThan(Object.keys(sr.seo).length)
  })
})

describe('the title in index.html', () => {
  /* The one title that is not applied by applyHead. It is what a search engine
     and a link preview see before any script has run, and what somebody with
     scripting off sees for good, so it has to be the front page's own title
     word for word. Nothing held it there: sr.json could be edited and the file
     would go on claiming last month's title, on the one page the portal most
     wants found. */
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf-8')

  const held = (pattern: RegExp, what: string) =>
    must(pattern.exec(html), `${what} u index.html`)[1]

  it('is the front page title as the portal itself writes it', () => {
    /* Measured through applyHead rather than against the dictionary entry.
       applyHead adds the name of the league unless the title already begins
       with it, and today the front page title does, so the two happen to be the
       same string. Comparing against the entry would let somebody rename the
       front page to "Početna", copy that into this file, and go green while the
       browser shows "Početna" before the scripts run and "Početna · Balkanska
       trkačka liga" after. */
    applyHead({
      title: sr.seo.home.title,
      description: sr.seo.home.description,
      siteName: sr.app.name,
      path: '',
      textLocale: 'sr',
    })

    const written = document.title

    expect(held(/<title>([^<]*)<\/title>/, 'naslov')).toBe(written)
    expect(held(/<meta\s+property="og:title"\s+content="([^"]*)"/, 'og:title')).toBe(written)
    expect(held(/<meta\s+name="twitter:title"\s+content="([^"]*)"/, 'twitter:title')).toBe(written)
  })

  it('carries the front page description, the same three times over', () => {
    expect(held(/<meta\s+name="description"\s+content="([^"]*)"/, 'opis')).toBe(
      sr.seo.home.description,
    )
    expect(held(/<meta\s+property="og:description"\s+content="([^"]*)"/, 'og:description')).toBe(
      sr.seo.home.description,
    )
    expect(held(/<meta\s+name="twitter:description"\s+content="([^"]*)"/, 'twitter:description')).toBe(
      sr.seo.home.description,
    )
  })
})
