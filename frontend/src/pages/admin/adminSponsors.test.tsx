import { configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache, timesDropped } from '../../data/client'
import type { SponsorEntered } from '../../data/types'
import { must } from '../../test/at'
import { sayYes, theSheet } from '../../test/deleteSheet'
import { expectFrontPage, moderatorWith, renderAt } from '../../test/render'
import { did, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser, type Pressing } from '../../test/user'

/**
 * ADMINISTRATION → PODACI → SPONZORI (owner, PDL 24.11.2026: „Zelim da mogu da u sekciji Administracija >
 * Podaci odem na Sponzori, i da tu dodajem, menjam ili brisem sponzore.").
 *
 * <p>Each case answers `GET /api/sponsors/all` itself, out of a list the case changes when the server would
 * have: the screen reads the list again after every write (`AdminSponsors.tsx`), so a case that answered
 * the same list twice could not tell a screen that re-read from one that laid what was typed over its
 * first answer.
 *
 * <p><b>The served order is neither the order of the keys nor of the places</b>: the main sponsor is the
 * LAST by both (id 7, place 2), and the other two are 3 and 5 at places 0 and 1. So a list sorted again
 * on this side by either number draws a different first row.
 */

configure({ asyncUtilTimeout: SLOW / 2 })

it('waits less than a case has, so a miss is an assertion and never the clock', () => {
  expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
})

const VOLT: SponsorEntered = {
  id: 7,
  name: 'Volt',
  url: 'https://volt.primer.rs/',
  descriptionSr: 'Energetsko piće za duge treninge i noćne trke.',
  descriptionEn: 'An energy drink for long sessions and night races.',
  main: true,
  inRotation: true,
  inStrip: true,
  position: 2,
  logo: '/api/photos/5e1f0a9c',
}
const SOFRA: SponsorEntered = {
  id: 3,
  name: 'Sofra',
  url: 'https://sofra.primer.rs/',
  descriptionSr: 'Domaća kuhinja posle svake trke.',
  descriptionEn: null,
  main: false,
  inRotation: false,
  inStrip: true,
  position: 0,
  logo: '/api/photos/b07d42e1',
}
const PLANINAR: SponsorEntered = {
  id: 5,
  name: 'Planinar plus',
  url: 'http://planinar.primer.rs/oprema',
  descriptionSr: 'Oprema za staze, od patika do štapova.',
  descriptionEn: 'Trail gear, from shoes to poles.',
  main: false,
  inRotation: true,
  inStrip: false,
  position: 1,
  logo: null,
}

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * A server holding `list` as the sponsors, answering a write with `toAWrite` and then the list as the
 * write left it (`after`, the list the server would answer from then on).
 */
function serving(
  list: SponsorEntered[],
  toAWrite: (path: string, init: RequestInit | undefined) => Response = () => did(),
  after: (was: SponsorEntered[], path: string) => SponsorEntered[] = (was) => was,
): Asked[] {
  clearResourceCache()

  let now = list
  const { asked, stop } = serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (path === '/api/sponsors/all' && how === 'GET') {
      return json(now)
    }

    if (how === 'GET' || !path.startsWith('/api/sponsors')) {
      return null
    }

    const answer = toAWrite(path, init)

    if (answer.ok) {
      now = after(now, path)
    }

    return answer
  })

  stops.push(stop)

  return asked
}

function writes(asked: Asked[]): { path: string; how: string; body: unknown }[] {
  return asked
    .filter((one) => one.init?.method !== undefined && one.init.method !== 'GET' && one.path.startsWith('/api/sponsors'))
    .map((one) => ({
      path: one.path,
      how: String(one.init?.method),
      body: typeof one.init?.body === 'string' ? JSON.parse(one.init.body) : null,
    }))
}

function readsOfTheList(asked: Asked[]): number {
  return asked.filter((one) => one.path === '/api/sponsors/all' && one.init?.method === undefined).length
}

async function theList(): Promise<HTMLElement> {
  return screen.findByRole('table', { name: 'Sponzori' })
}

function rowOf(table: HTMLElement, name: string): HTMLElement {
  return must(
    within(table)
      .getAllByRole('row')
      .find((one) => within(one).queryByRole('cell', { name }) !== null),
    `the row of ${name}`,
  )
}

/** The cells of a row as read, the logo by the name of its picture or by what is said instead. */
function cellsOf(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('cell')
    .slice(0, 5)
    .map((cell) => within(cell).queryByRole('img')?.getAttribute('alt') ?? cell.textContent ?? '')
}

function drawn(as: 'superadmin' | 'moderator' = 'superadmin', rights = ['entity:sponsors']) {
  renderAt('/sr/administracija/sponzori', as, null, moderatorWith(rights))
}

async function openTheForm(user: Pressing, name: string): Promise<void> {
  await user.click(within(rowOf(await theList(), name)).getByRole('button', { name: `Otvori: ${name}` }))
  await screen.findByRole('heading', { name: 'Izmena sponzora' })
}

describe('the list of sponsors', () => {
  it('is drawn in the order the server gives, and says of each what the front page does with it', async () => {
    serving([VOLT, SOFRA, PLANINAR])
    drawn()

    const table = await theList()
    const names = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((one) => within(one).getAllByRole('cell')[0]?.textContent)

    expect(names).toEqual(['Volt', 'Sofra', 'Planinar plus'])
    expect(cellsOf(rowOf(table, 'Volt'))).toEqual(['Volt', 'Logo sponzora Volt', 'Da', 'Da', 'Da'])
    expect(cellsOf(rowOf(table, 'Sofra'))).toEqual(['Sofra', 'Logo sponzora Sofra', 'Ne', 'Ne', 'Da'])
    /* Derived and not the owner's sentence: a sponsor with no logo is on neither, and its row says so. */
    expect(cellsOf(rowOf(table, 'Planinar plus'))).toEqual(['Planinar plus', 'Nema logo, pa se ne prikazuje', 'Ne', 'Da', 'Ne'])
    expect(within(rowOf(table, 'Volt')).getByRole('img', { name: 'Logo sponzora Volt' })).toHaveAttribute(
      'src',
      '/api/photos/5e1f0a9c',
    )
  }, SLOW)

  it('offers the main sponsor no arrows, and holds the first one up and the last one down of the rest', async () => {
    serving([VOLT, SOFRA, PLANINAR])
    drawn()

    const table = await theList()

    expect(within(rowOf(table, 'Volt')).queryByRole('button', { name: /^Pomeri/ })).toBeNull()
    expect(within(rowOf(table, 'Volt')).getByText('Uvek prvi')).toBeVisible()
    expect(within(rowOf(table, 'Sofra')).getByRole('button', { name: 'Pomeri gore: Sofra' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(within(rowOf(table, 'Sofra')).getByRole('button', { name: 'Pomeri dole: Sofra' })).toHaveAttribute(
      'aria-disabled',
      'false',
    )
    expect(
      within(rowOf(table, 'Planinar plus')).getByRole('button', { name: 'Pomeri gore: Planinar plus' }),
    ).toHaveAttribute('aria-disabled', 'false')
    expect(
      within(rowOf(table, 'Planinar plus')).getByRole('button', { name: 'Pomeri dole: Planinar plus' }),
    ).toHaveAttribute('aria-disabled', 'true')
  }, SLOW)
})

describe('a sponsor moved in the manual order', () => {
  it('is sent one place down, the list is read again in its new order, and the focus stays on the arrow', async () => {
    const user = setupUser()
    const asked = serving([VOLT, SOFRA, PLANINAR], () => did(), () => [VOLT, PLANINAR, SOFRA])
    const strip = timesDropped('sponsors')

    drawn()

    await user.click(within(rowOf(await theList(), 'Sofra')).getByRole('button', { name: 'Pomeri dole: Sofra' }))

    await waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: 'Sponzori' }))
          .getAllByRole('row')
          .slice(1)
          .map((one) => within(one).getAllByRole('cell')[0]?.textContent),
      ).toEqual(['Volt', 'Planinar plus', 'Sofra']),
    )
    expect(writes(asked)).toEqual([{ path: '/api/sponsors/3/down', how: 'POST', body: {} }])
    expect(readsOfTheList(asked)).toBe(2)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pomeri dole: Sofra' })).toHaveFocus())
    /* The front page in both its languages reads the same rows, so both answers are dropped. */
    expect(timesDropped('sponsors')).toBe(strip + 2)
  }, SLOW)

  it('is sent one place up', async () => {
    const user = setupUser()
    const asked = serving([VOLT, SOFRA, PLANINAR], () => did(), () => [VOLT, PLANINAR, SOFRA])

    drawn()

    await user.click(
      within(rowOf(await theList(), 'Planinar plus')).getByRole('button', { name: 'Pomeri gore: Planinar plus' }),
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'Pomeri gore: Planinar plus' })).toHaveFocus())
    expect(writes(asked)).toEqual([{ path: '/api/sponsors/5/up', how: 'POST', body: {} }])
  }, SLOW)

  it('is not sent where the arrow is held', async () => {
    const user = setupUser()
    const asked = serving([VOLT, SOFRA, PLANINAR])

    drawn()

    await user.click(within(rowOf(await theList(), 'Sofra')).getByRole('button', { name: 'Pomeri gore: Sofra' }))
    await user.click(
      within(rowOf(await theList(), 'Planinar plus')).getByRole('button', { name: 'Pomeri dole: Planinar plus' }),
    )

    expect(writes(asked)).toEqual([])
  }, SLOW)

  it('says why, beside the row, when the server refuses it', async () => {
    const user = setupUser()

    serving([VOLT, SOFRA, PLANINAR], () => new Response(null, { status: 404 }))
    drawn()

    await user.click(within(rowOf(await theList(), 'Sofra')).getByRole('button', { name: 'Pomeri dole: Sofra' }))

    expect(await within(rowOf(await theList(), 'Sofra')).findByRole('alert')).toHaveTextContent('greška 404')
  }, SLOW)

  it('is sent once for two presses that come before the answer', async () => {
    const user = setupUser()
    let answer: (response: Response) => void = () => undefined
    const { asked, stop } = serverThat((path, init) => {
      if (path === '/api/sponsors/all' && init?.method === undefined) {
        return json([VOLT, SOFRA, PLANINAR])
      }

      return path === '/api/sponsors/3/down'
        ? new Promise<Response>((resolve) => {
            answer = resolve
          })
        : null
    })

    stops.push(stop)
    clearResourceCache()
    drawn()

    const arrow = within(rowOf(await theList(), 'Sofra')).getByRole('button', { name: 'Pomeri dole: Sofra' })

    await user.click(arrow)
    await user.click(arrow)
    answer(did())

    await waitFor(() => expect(asked.filter((one) => one.path === '/api/sponsors/3/down')).toHaveLength(1))
  }, SLOW)
})

describe('a sponsor entered', () => {
  it('sends what was typed, the boxes as booleans, and the list is read again', async () => {
    const user = setupUser()
    const made: SponsorEntered = { ...PLANINAR, id: 9, name: 'Novi', main: true, logo: null }
    const asked = serving(
      [VOLT, SOFRA],
      () => json({ id: 9 }, 201),
      () => [made, { ...VOLT, main: false }, SOFRA],
    )

    drawn()
    await user.click(await screen.findByRole('button', { name: 'Novi sponzor' }))

    /* A new sponsor is not the main one until somebody says so („default No"). */
    expect(screen.getByRole('checkbox', { name: 'Glavni sponzor' })).not.toBeChecked()

    await user.type(screen.getByLabelText(/^Naziv sponzora/), 'Novi')
    await user.type(screen.getByLabelText(/^Link ka strani sponzora/), 'https://novi.primer.rs/')
    await user.type(screen.getByLabelText(/^Opis na srpskom/), 'Kratak opis.')
    await user.click(screen.getByRole('checkbox', { name: 'Glavni sponzor' }))
    await user.click(screen.getByRole('checkbox', { name: 'Stoji u traci sponzora na dnu naslovne' }))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('heading', { name: 'Sačuvano' })).toBeVisible()
    expect(writes(asked)).toEqual([
      {
        path: '/api/sponsors',
        how: 'POST',
        body: {
          name: 'Novi',
          url: 'https://novi.primer.rs/',
          descriptionSr: 'Kratak opis.',
          descriptionEn: '',
          main: true,
          inRotation: false,
          inStrip: true,
        },
      },
    ])

    /* „Glavni sponzor je najviše jedan", and the new one takes the mark off the old in the same write:
       the list, read again, has it on the new one alone. */
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const table = await theList()

    await waitFor(() => expect(cellsOf(rowOf(table, 'Novi'))[2]).toBe('Da'))
    expect(cellsOf(rowOf(table, 'Volt'))[2]).toBe('Ne')
    expect(readsOfTheList(asked)).toBeGreaterThanOrEqual(2)
  }, SLOW)

  it('says that it was saved and cannot be drawn, where the answer names no id', async () => {
    const user = setupUser()

    serving([VOLT], () => json({}, 201))
    drawn()
    await user.click(await screen.findByRole('button', { name: 'Novi sponzor' }))
    await user.type(screen.getByLabelText(/^Naziv sponzora/), 'Novi')
    await user.type(screen.getByLabelText(/^Link ka strani sponzora/), 'https://novi.primer.rs/')
    await user.type(screen.getByLabelText(/^Opis na srpskom/), 'Kratak opis.')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sponzor je sačuvan. Osveži stranu.')
  }, SLOW)

  it.each([
    ['theFormIsNotComplete', 'Nedostaje naziv, link ili opis na srpskom.'],
    ['theNameIsTooLong', 'Naziv sme da ima najviše 80 karaktera.'],
    ['theLinkIsNotALink', 'Link nije ispravna veb adresa. Mora da počinje sa http:// ili https://.'],
    ['theDescriptionIsTooLong', 'Opis sme da ima najviše 80 karaktera.'],
  ])('says the server’s refusal %s in its own sentence', async (reason, sentence) => {
    const user = setupUser()

    serving([VOLT], () => refused(reason))
    drawn()
    await user.click(await screen.findByRole('button', { name: 'Novi sponzor' }))
    await user.type(screen.getByLabelText(/^Naziv sponzora/), 'Novi')
    await user.type(screen.getByLabelText(/^Link ka strani sponzora/), 'https://novi.primer.rs/')
    await user.type(screen.getByLabelText(/^Opis na srpskom/), 'Kratak opis.')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText(sentence)).toHaveAttribute('role', 'alert')
  }, SLOW)

  it('refuses before sending a link that is not one and a description over 80 characters', async () => {
    const user = setupUser()
    const asked = serving([VOLT])

    drawn()
    await user.click(await screen.findByRole('button', { name: 'Novi sponzor' }))
    await user.type(screen.getByLabelText(/^Naziv sponzora/), 'Novi')
    await user.type(screen.getByLabelText(/^Link ka strani sponzora/), 'novi.primer.rs')
    await user.type(screen.getByLabelText(/^Opis na srpskom/), 'a'.repeat(81))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText('Vrednost nije u očekivanom obliku.')).toBeVisible()
    expect(screen.getByText('Najviše 80 znakova.')).toBeVisible()
    expect(writes(asked)).toEqual([])
  }, SLOW)

  /* „Kako napiše neka napiše. Ovo uređuje osoba koja zna šta radi." (owner, 24.11.2026, overturning the
     rule of 18.11.2026): the portal does not check capitals, so a description in capitals is SENT. */
  it('sends a description written in capitals, which the portal does not check', async () => {
    const user = setupUser()
    const asked = serving([VOLT], () => json({ id: 9 }, 201))

    drawn()
    await user.click(await screen.findByRole('button', { name: 'Novi sponzor' }))
    await user.type(screen.getByLabelText(/^Naziv sponzora/), 'Novi')
    await user.type(screen.getByLabelText(/^Link ka strani sponzora/), 'https://novi.primer.rs/')
    await user.type(screen.getByLabelText(/^Opis na srpskom/), 'ENERGETSKO PIĆE')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('heading', { name: 'Sačuvano' })).toBeVisible()
    expect(writes(asked).map((one) => Reflect.get(Object(one.body), 'descriptionSr'))).toEqual(['ENERGETSKO PIĆE'])
  }, SLOW)
})

describe('a sponsor changed', () => {
  it('opens on what it is, and sends the change to its own address, marking it main', async () => {
    const user = setupUser()
    const asked = serving(
      [VOLT, SOFRA, PLANINAR],
      () => json({ id: 3 }),
      () => [{ ...SOFRA, main: true }, { ...VOLT, main: false }, PLANINAR],
    )

    drawn()
    await openTheForm(user, 'Sofra')

    expect(screen.getByLabelText(/^Naziv sponzora/)).toHaveValue('Sofra')
    expect(screen.getByLabelText(/^Link ka strani sponzora/)).toHaveValue('https://sofra.primer.rs/')
    expect(screen.getByLabelText(/^Opis na srpskom/)).toHaveValue('Domaća kuhinja posle svake trke.')
    expect(screen.getByLabelText(/^Opis na engleskom/)).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Glavni sponzor' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Smenjuje se u boksu "Sponzor dana"' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Stoji u traci sponzora na dnu naslovne' })).toBeChecked()

    await user.type(screen.getByLabelText(/^Opis na engleskom/), 'Home cooking after every race.')
    await user.click(screen.getByRole('checkbox', { name: 'Glavni sponzor' }))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('heading', { name: 'Sačuvano' })).toBeVisible()
    expect(writes(asked)).toEqual([
      {
        path: '/api/sponsors/3',
        how: 'PUT',
        body: {
          name: 'Sofra',
          url: 'https://sofra.primer.rs/',
          descriptionSr: 'Domaća kuhinja posle svake trke.',
          descriptionEn: 'Home cooking after every race.',
          main: true,
          inRotation: false,
          inStrip: true,
        },
      },
    ])

    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const table = await theList()

    await waitFor(() => expect(cellsOf(rowOf(table, 'Sofra'))[2]).toBe('Da'))
    expect(cellsOf(rowOf(table, 'Volt'))[2]).toBe('Ne')
  }, SLOW)

  it('opens the main one with its box ticked and its English description in it', async () => {
    const user = setupUser()

    serving([VOLT, SOFRA, PLANINAR])
    drawn()
    await openTheForm(user, 'Volt')

    expect(screen.getByRole('checkbox', { name: 'Glavni sponzor' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Smenjuje se u boksu "Sponzor dana"' })).toBeChecked()
    expect(screen.getByLabelText(/^Opis na engleskom/)).toHaveValue(VOLT.descriptionEn)
  }, SLOW)
})

describe('a sponsor deleted', () => {
  it('asks first, sends the deletion, says so, and reads the list again without it', async () => {
    const user = setupUser()
    const asked = serving([VOLT, SOFRA, PLANINAR], () => did(), (was) => was.filter((one) => one.id !== SOFRA.id))

    drawn()
    await user.click(within(rowOf(await theList(), 'Sofra')).getByRole('button', { name: 'Obriši: Sofra' }))

    expect(
      within(await theSheet('Obriši sponzora?')).getByText(
        'Sponzor nestaje sa naslovne strane, a zajedno sa njim briše se i njegov logo.',
      ),
    ).toBeVisible()
    await sayYes(user, 'Obriši sponzora?')

    expect(await screen.findByText('Sponzor je obrisan.')).toBeVisible()
    expect(writes(asked)).toEqual([{ path: '/api/sponsors/3', how: 'DELETE', body: {} }])
    await waitFor(() =>
      expect(within(screen.getByRole('table', { name: 'Sponzori' })).queryByRole('cell', { name: 'Sofra' })).toBeNull(),
    )
  }, SLOW)

  it('says why beside the row when the server refuses it, and the row stays', async () => {
    const user = setupUser()

    serving([VOLT, SOFRA], () => new Response(null, { status: 404 }))
    drawn()
    await user.click(within(rowOf(await theList(), 'Sofra')).getByRole('button', { name: 'Obriši: Sofra' }))
    await sayYes(user, 'Obriši sponzora?')

    expect(await within(rowOf(await theList(), 'Sofra')).findByRole('alert')).toHaveTextContent('greška 404')
    expect(screen.queryByText('Sponzor je obrisan.')).toBeNull()
  }, SLOW)
})

describe('who reaches the sponsors', () => {
  it('a moderator with the right „Sponzori" finds them in „Podaci" and opens the list', async () => {
    serving([VOLT])
    drawn('moderator', ['entity:sponsors'])

    expect(await theList()).toBeVisible()
    expect(screen.getByRole('link', { name: 'Sponzori' })).toHaveAttribute('href', '/sr/administracija/sponzori')
  }, SLOW)

  it('a moderator without it is not offered them, and the door takes him to the front page', async () => {
    const asked = serving([VOLT])

    drawn('moderator', ['entity:leagues'])

    await expectFrontPage()
    expect(screen.queryByRole('table', { name: 'Sponzori' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Sponzori' })).toBeNull()
    expect(readsOfTheList(asked)).toBe(0)
  }, SLOW)

  it('a moderator without it is not offered them in „Podaci" either, beside the entity he may open', async () => {
    serving([VOLT])
    renderAt('/sr/administracija/lige', 'moderator', null, moderatorWith(['entity:leagues']))

    expect(await screen.findByRole('table', { name: 'Lige' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Sponzori' })).toBeNull()
  }, SLOW)
})
