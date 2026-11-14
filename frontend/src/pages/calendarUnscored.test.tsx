import { configure, screen, within } from '@testing-library/react'
import { loadResource } from '../data/client'
import type { BtlEvent, Race } from '../data/types'
import sr from '../i18n/sr.json'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'

/**
 * AN UNSCORED RACE IN THE CALENDAR AND ON ITS OWN PAGE (owner, 14.11.2026, PDL „Ostale discipline kao lična
 * evidencija").
 *
 * <p>„Nebodovana trka u kalendaru nema tačku dužine, samo oznaku na pločici", and „svuda „Nebodovane trke"
 * (kalendar, filter na profilu)". The colour of the tile is held in `styles/kindTiles.test.ts` and
 * `styles/featuredTile.test.ts`, and jsdom applies no sheet (ADL A18); what is held here is the half in the markup,
 * which is what makes the colour lawful: the tile says what it is in words, it carries the one class the sheet paints,
 * it carries no dot, and the legend names it.
 *
 * <p><b>The served race carries a dot all the same</b> (`test/mock/races.json`, race 1613 is `ultra` like any race of
 * a length, which is what `CalendarApi.DOTS` answers whichever event it stands under), so „no dot" is the screen's
 * decision and not the file's.
 */

/* A wait that never succeeds ends with the assertion's own words and not with the clock of the case
   (`adminEventKind.test.tsx` is the precedent). */
configure({ asyncUtilTimeout: SLOW / 4 })

const THE_EVENT = 'Palićki triatlon'

describe('an unscored race in the calendar', () => {
  it('is the sample the cases below are about: one unscored race that the file gives a dot', async () => {
    const events = await loadResource<BtlEvent[]>('events')
    const races = await loadResource<Race[]>('races')
    const mine = events.filter((one) => one.kind === 'unscored')

    expect(mine.map((one) => one.name)).toEqual([THE_EVENT])
    expect(races.filter((one) => one.eventId === mine[0]?.id).map((one) => one.dots)).toEqual([['ultra']])
  }, SLOW)

  it('is a tile of its own that says what it is, and carries no dot of a length', async () => {
    const { container } = renderAt('/sr/kalendar?mesec=2027-07')

    await screen.findByRole('heading', { level: 2, name: 'jul 2027.' })

    const tile = screen.getByRole('link', { name: new RegExp(THE_EVENT) })

    expect(tile.className).toBe('chip chip--unscored')
    /* The word beside the colour (WCAG 2.2 SC 1.4.1), spoken. */
    expect(tile).toHaveAccessibleName(new RegExp(sr.event.kind.unscored))
    /* And nothing of the five lengths, drawn or spoken, although the file carries `ultra` for this race. */
    expect(tile.querySelectorAll('.length-dot')).toHaveLength(0)
    expect(tile).not.toHaveTextContent(sr.category.ultra)
    expect(container.querySelectorAll('.chip--unscored')).toHaveLength(1)
  }, SLOW)

  it('is named in the legend, in the plural, beside the three kinds it joins', async () => {
    const { container } = renderAt('/sr/kalendar?mesec=2027-07')

    await screen.findByRole('heading', { level: 2, name: 'jul 2027.' })

    const legend = within(screen.getByRole('list', { name: 'Legenda:' }))

    expect(legend.getByText('Nebodovane trke')).toBeVisible()
    /* With a swatch of its own, which the sheet paints and the legend's reader skips. */
    expect(container.querySelector('.legend__tile--unscored')).toHaveAttribute('aria-hidden', 'true')
  }, SLOW)
})

describe('the page of an unscored race', () => {
  it('draws the table of its races, like the page of a scored one', async () => {
    renderAt('/sr/kalendar/palicki-triatlon-2027', 'visitor', null, undefined, '2026-12-01')

    await screen.findByRole('heading', { level: 1, name: THE_EVENT })

    const table = within(await screen.findByRole('table', { name: sr.event.races }))

    expect(table.getByRole('cell', { name: THE_EVENT })).toBeVisible()
    expect(table.getByRole('cell', { name: /51,50/ })).toBeVisible()
  }, SLOW)

  it('draws no table of races for a training or a gathering', async () => {
    const events = await loadResource<BtlEvent[]>('events')
    const gathering = events.find((one) => one.kind === 'gathering')

    expect(gathering, 'a gathering in the sample').toBeDefined()

    renderAt(`/sr/kalendar/${gathering?.slug ?? ''}`, 'visitor', null, undefined, '2026-12-01')
    await screen.findByRole('heading', { level: 1, name: gathering?.name })

    expect(screen.queryByRole('table', { name: sr.event.races })).toBeNull()
  }, SLOW)
})
