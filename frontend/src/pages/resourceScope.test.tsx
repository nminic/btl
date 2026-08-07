import { screen } from '@testing-library/react'
import type { ResourceName } from '../data/client'
import { renderAt } from '../test/render'

/* A screen must wait only on the data it actually shows.
 *
 * Three screens have shipped combining a resource that no row on them ever
 * read. Because an error wins over loading in combineResources, on purpose, one
 * failed file turned a whole working page into an error message. Every one of
 * the three was found by eye, twice by review, which is not a method.
 *
 * These cases are the method: break a resource the screen never displays, and
 * the screen must still render. They fail the moment somebody widens one of
 * these screens back onto data it does not use. */

/** Serves every resource off disk as usual, except the one named, which fails. */
function breakResource(name: ResourceName) {
  const real = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).endsWith(`/${name}.json`)
      ? new Response('greska', { status: 500 })
      : real(input)) as typeof fetch

  return () => {
    globalThis.fetch = real
  }
}

/** Serves every resource as usual, except the one named, which never arrives. */
function stallResource(name: ResourceName) {
  const real = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).endsWith(`/${name}.json`)
      ? new Promise<Response>(() => {})
      : real(input)) as typeof fetch

  return () => {
    globalThis.fetch = real
  }
}

/* The other half of the same idea, from the other end: a screen that loads a
 * part separately must not be covered while it waits for it.
 *
 * The sheet over the page is right for a screen that is waiting as a whole
 * (owner, 31.07.2026). Three screens open a second Resource inside their own,
 * and there the sheet undid the very thing the split was for: the name of the
 * record arrives first and is useful, and a sheet hid it until the heaviest half
 * landed. Two stacked sheets on one screen also took the page
 * to about 95% opaque and said "Učitavanje" twice. */
describe('a part of a screen waits without covering the page', () => {
  let restore = () => {}

  afterEach(() => {
    restore()
  })

  it('keeps the event readable while its races are still on their way', async () => {
    restore = stallResource('races')
    renderAt('/sr/kalendar/jadovnicki-ultramaraton-2026-07-11')

    expect(await screen.findByRole('heading', { level: 1, name: /Jadovnički/ })).toBeVisible()
    // A sheet is a `.loader` that is not the inline one. There must be none.
    expect(document.querySelector('.loader:not(.loader--inline)')).toBeNull()
  })

  it('names each part it is waiting for rather than saying the same thing twice', async () => {
    restore = stallResource('results')
    renderAt('/sr/kalendar/jadovnicki-ultramaraton-2026-07-11')

    await screen.findByRole('heading', { level: 1, name: /Jadovnički/ })
    const said = screen.getAllByRole('status').map((one) => one.textContent)

    /* Two parts of this screen wait on results, and the shell announces the
       page title, so three regions speak. Every one of them has to say
       something different, which is what the name is for. */
    expect(new Set(said).size).toBe(said.length)
    expect(said).toContain('Učitavanje: Rezultati članova')
  })

  it('keeps the front page readable while the president is still on his way', async () => {
    restore = stallResource('pages')
    renderAt('/sr')

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
    expect(document.querySelector('.loader:not(.loader--inline)')).toBeNull()
  })
})

describe('a screen waits only on the data it shows', () => {
  let restore = () => {}

  afterEach(() => {
    restore()
  })

  it('draws the standing when the events cannot be loaded', async () => {
    restore = breakResource('events')
    renderAt('/sr/tabela?sezona=2020')

    expect(await screen.findByRole('table')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('draws the competitor cards when the teams cannot be loaded', async () => {
    restore = breakResource('teams')
    renderAt('/sr/takmicari')

    expect(await screen.findByRole('list')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('draws a league when the races cannot be loaded', async () => {
    restore = breakResource('races')
    renderAt('/sr/liga/runtrace-2027')

    expect(await screen.findByRole('heading', { level: 1, name: /RunTrace liga/ })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /* The other half of the same rule: a screen must still fail on data it does
   * show, so the cases above cannot be satisfied by swallowing every error. */
  it('still says so when the data a screen does show cannot be loaded', async () => {
    restore = breakResource('leagues')
    renderAt('/sr/liga/runtrace-2027')

    expect(await screen.findByRole('alert')).toHaveTextContent('Podaci se ne mogu učitati.')
  })
})
