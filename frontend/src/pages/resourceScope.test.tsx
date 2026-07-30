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
