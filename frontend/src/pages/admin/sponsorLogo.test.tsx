import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache, timesDropped } from '../../data/client'
import type { SponsorEntered } from '../../data/types'
import { must } from '../../test/at'
import { sayYes } from '../../test/deleteSheet'
import { renderAt } from '../../test/render'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser, type Pressing } from '../../test/user'

/**
 * THE LOGO OF A SPONSOR, IN ITS FORM (owner, PDL 24.11.2026: „... da se ucitava znak sponzora (njegov
 * logo) koji se automatski prikazuje kako treba i u boksu sa desne strane, i u donjoj liniji."; „Logo se
 * otprema kao PNG, WebP ili JPEG, ne SVG."; „Logo stoji providno na tamnoj pozadini, bez svetle
 * pločice.").
 *
 * <p>Two sponsors, one with a logo and one without, and the first is never the one the box is opened
 * on in the cases that send: an address built off the wrong row sends to `/api/sponsors/7/logo`.
 */

configure({ asyncUtilTimeout: SLOW / 2 })

const VOLT: SponsorEntered = {
  id: 7,
  name: 'Volt',
  url: 'https://volt.primer.rs/',
  descriptionSr: 'Energetsko piće za duge treninge i noćne trke.',
  descriptionEn: null,
  main: true,
  inRotation: true,
  inStrip: true,
  position: 1,
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
  logo: null,
}
const MINT: SponsorEntered = { ...SOFRA, id: 4, name: 'Mint', position: 2, logo: '/api/photos/77aa01bc' }

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function serving(
  toALogo: (init: RequestInit | undefined) => Response = () => json({ logo: '/api/photos/ab12' }),
  sponsors: SponsorEntered[] = [VOLT, SOFRA, MINT],
): Asked[] {
  clearResourceCache()

  const { asked, stop } = serverThat((path, init) => {
    if (path === '/api/sponsors/all' && init?.method === undefined) {
      return json(sponsors)
    }

    return /^\/api\/sponsors\/\d+\/logo$/.test(path) ? toALogo(init) : null
  })

  stops.push(stop)

  return asked
}

const toTheLogo = (asked: Asked[]) => asked.filter((one) => one.path.endsWith('/logo'))

async function theBoxOf(user: Pressing, name: string) {
  renderAt('/sr/administracija/sponzori', 'superadmin')

  const table = await screen.findByRole('table', { name: 'Sponzori' })
  const row = must(
    within(table)
      .getAllByRole('row')
      .find((one) => within(one).queryByRole('cell', { name }) !== null),
    `the row of ${name}`,
  )

  await user.click(within(row).getByRole('button', { name: `Otvori: ${name}` }))

  return within(await screen.findByRole('region', { name: 'Logo sponzora' }))
}

async function choose(user: Pressing, box: ReturnType<typeof within>, file: File): Promise<void> {
  await user.upload(box.getByLabelText('Izaberi logo'), file)
  await box.findByText('Ovako će izabrani logo stajati na naslovnoj strani kad ga sačuvaš.')
}

const A_PNG = new File(['logo'], 'mint.png', { type: 'image/png' })

describe('the logo of a sponsor, in its form', () => {
  it('opens on the logo that stands, in the box of the day and in a tile of the strip, named once', async () => {
    serving()

    const box = await theBoxOf(setupUser(), 'Mint')

    expect(box.getByText('Ovako logo sada stoji na naslovnoj strani, u boksu "Sponzor dana" i u traci.')).toBeVisible()
    /* Two frames of one picture: named in the first, and decoration in the second. */
    expect(box.getByRole('img', { name: 'Logo sponzora Mint' })).toHaveAttribute('src', '/api/photos/77aa01bc')
    expect(box.getAllByRole('presentation').map((one) => one.getAttribute('src'))).toEqual(['/api/photos/77aa01bc'])
    expect(box.getByRole('button', { name: 'Ukloni logo' })).toBeVisible()
  }, SLOW)

  it.each([
    ['in the box only', true, false, true],
    ['in the strip only', false, true, true],
    ['in both', true, true, true],
    ['in neither', false, false, false],
  ])(
    'says where the logo stands for a sponsor %s only when it stands somewhere, and always draws it',
    async (_where, inRotation, inStrip, said) => {
      serving(undefined, [{ ...MINT, inRotation, inStrip }])

      const box = await theBoxOf(setupUser(), 'Mint')

      expect(
        box.queryByText('Ovako logo sada stoji na naslovnoj strani, u boksu "Sponzor dana" i u traci.') !== null,
      ).toBe(said)
      expect(box.getByRole('img', { name: 'Logo sponzora Mint' })).toHaveAttribute('src', '/api/photos/77aa01bc')
      expect(box.getByRole('button', { name: 'Ukloni logo' })).toBeVisible()
    },
    SLOW,
  )

  it('says that a sponsor with no logo is on neither, and offers nothing to take down', async () => {
    serving()

    const box = await theBoxOf(setupUser(), 'Sofra')

    expect(
      box.getByText('Sponzor još nema logo, pa se ne prikazuje ni u boksu "Sponzor dana" ni u traci na dnu naslovne.'),
    ).toBeVisible()
    expect(box.queryByRole('img')).toBeNull()
    expect(box.queryByRole('button', { name: 'Ukloni logo' })).toBeNull()
  }, SLOW)

  it('offers to pick a PNG, a WebP or a JPEG, and no SVG', async () => {
    serving()

    const box = await theBoxOf(setupUser(), 'Sofra')

    expect(box.getByLabelText('Izaberi logo')).toHaveAttribute('accept', 'image/png,image/webp,image/jpeg')
  }, SLOW)

  it('sends nothing while nothing is chosen, then the file alone to this sponsor’s address, once', async () => {
    const user = setupUser()
    const asked = serving()
    const box = await theBoxOf(user, 'Sofra')
    const save = box.getByRole('button', { name: 'Sačuvaj logo' })

    expect(save).toHaveAttribute('aria-disabled', 'true')
    await user.click(save)
    expect(toTheLogo(asked)).toHaveLength(0)

    await choose(user, box, A_PNG)

    /* What will be on the front page, drawn before the press: the chosen picture and not the one that stands. */
    expect(must(box.getByRole('img', { name: 'Logo sponzora Sofra' }).getAttribute('src'), 'a picture').startsWith('data:image/png')).toBe(true)

    const strip = timesDropped('sponsors')
    const list = timesDropped('sponsors/all')

    await user.click(save)

    expect(await box.findByText('Logo je sačuvan.')).toHaveAttribute('role', 'status')
    expect(box.getByText('Logo je sačuvan.')).toHaveFocus()

    const sent = toTheLogo(asked)

    expect(sent.map((one) => [one.path, one.init?.method])).toEqual([['/api/sponsors/3/logo', 'POST']])

    const body = must(sent[0], 'the write').init?.body

    expect(body).toBeInstanceOf(FormData)
    /* The whole picture and no cut: „Logo se ne seče u krug". */
    expect(body instanceof FormData ? [...body.keys()] : []).toEqual(['picture'])
    expect(body instanceof FormData ? body.get('picture') : null).toBe(A_PNG)

    /* The front page in both its languages and the list are answers that are now wrong. */
    expect(timesDropped('sponsors')).toBe(strip + 2)
    expect(timesDropped('sponsors/all')).toBe(list + 1)
    /* And the one that stands now can be taken down. */
    expect(box.getByRole('button', { name: 'Ukloni logo' })).toBeVisible()
    expect(box.getByText('Ovako logo sada stoji na naslovnoj strani, u boksu "Sponzor dana" i u traci.')).toBeVisible()
  }, SLOW)

  it('sends once for two presses that come before the answer', async () => {
    const user = setupUser()
    let answer: (response: Response) => void = () => undefined
    const { asked, stop } = serverThat((path, init) => {
      if (path === '/api/sponsors/all' && init?.method === undefined) {
        return json([VOLT, SOFRA, MINT])
      }

      return path.endsWith('/logo')
        ? new Promise<Response>((resolve) => {
            answer = resolve
          })
        : null
    })

    stops.push(stop)
    clearResourceCache()

    const box = await theBoxOf(user, 'Sofra')

    await choose(user, box, A_PNG)
    await user.click(box.getByRole('button', { name: 'Sačuvaj logo' }))
    await user.click(box.getByRole('button', { name: 'Sačuvaj logo' }))
    answer(json({ logo: '/api/photos/ab12' }))

    expect(await box.findByText('Logo je sačuvan.')).toBeVisible()
    expect(toTheLogo(asked)).toHaveLength(1)
  }, SLOW)

  it.each([
    ['thisIsNotAPicture', 'Ovaj fajl nije slika. Pošalji fotografiju, na primer u JPG ili PNG obliku.'],
    ['thePictureIsTooBig', 'Slika je prevelika za portal. Izaberi manju ili je smanji pre slanja.'],
    ['theFormIsNotComplete', 'Slika nije stigla do servera. Izaberi je ponovo i pošalji.'],
  ])('says the refusal %s in the sentence every picture of the portal is refused with', async (reason, sentence) => {
    const user = setupUser()

    serving(() => refused(reason))

    const box = await theBoxOf(user, 'Sofra')

    /* An SVG, chosen past what the picker offers (a reader can always ask it for every file): the screen
       sends it and the route, which knows a picture by its bytes, is the one that refuses. */
    fireEvent.change(box.getByLabelText('Izaberi logo'), {
      target: { files: [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })] },
    })
    await box.findByText('Ovako će izabrani logo stajati na naslovnoj strani kad ga sačuvaš.')
    await user.click(box.getByRole('button', { name: 'Sačuvaj logo' }))

    expect(await box.findByText(sentence)).toHaveAttribute('role', 'alert')
    expect(box.queryByText('Logo je sačuvan.')).toBeNull()
  }, SLOW)

  it('forgets the chosen file when the choice is emptied, and draws the logo that stands again', async () => {
    const user = setupUser()

    serving()

    const box = await theBoxOf(user, 'Mint')

    await choose(user, box, A_PNG)
    /* A sponsor WITH a logo, so the chosen picture is drawn in the place of one that stands, and not merely where
       there was none: the picture drawn is the chosen one. */
    expect(must(box.getByRole('img', { name: 'Logo sponzora Mint' }).getAttribute('src'), 'a picture').startsWith('data:image/png')).toBe(true)
    fireEvent.change(box.getByLabelText('Izaberi logo'), { target: { files: [] } })

    expect(await box.findByText('Ovako logo sada stoji na naslovnoj strani, u boksu "Sponzor dana" i u traci.')).toBeVisible()
    expect(box.getByRole('img', { name: 'Logo sponzora Mint' })).toHaveAttribute('src', '/api/photos/77aa01bc')
    expect(box.getByRole('button', { name: 'Sačuvaj logo' })).toHaveAttribute('aria-disabled', 'true')
  }, SLOW)

  it('takes the logo down behind a question, says so, and drops the front page', async () => {
    const user = setupUser()
    const asked = serving(() => new Response(null, { status: 204 }))
    const box = await theBoxOf(user, 'Mint')
    const strip = timesDropped('sponsors')

    await user.click(box.getByRole('button', { name: 'Ukloni logo' }))
    await sayYes(user, 'Ukloni logo sponzora? Dok ne dobije nov, sponzor se ne prikazuje na naslovnoj strani.')

    expect(await box.findByText('Logo je uklonjen, pa se sponzor više ne prikazuje na naslovnoj strani.')).toHaveAttribute(
      'role',
      'status',
    )
    expect(toTheLogo(asked).map((one) => [one.path, one.init?.method])).toEqual([['/api/sponsors/4/logo', 'DELETE']])
    expect(timesDropped('sponsors')).toBe(strip + 2)
    expect(box.queryByRole('img')).toBeNull()
    expect(box.queryByRole('button', { name: 'Ukloni logo' })).toBeNull()
  }, SLOW)

  it('says why the logo did not go down, and keeps it', async () => {
    const user = setupUser()

    serving(() => new Response(null, { status: 404 }))

    const box = await theBoxOf(user, 'Mint')

    await user.click(box.getByRole('button', { name: 'Ukloni logo' }))
    await sayYes(user, 'Ukloni logo sponzora? Dok ne dobije nov, sponzor se ne prikazuje na naslovnoj strani.')

    expect(await box.findByRole('alert')).toHaveTextContent('greška 404')
    await waitFor(() => expect(box.getByRole('img', { name: 'Logo sponzora Mint' })).toBeVisible())
  }, SLOW)

  it('is not in the form of a new sponsor, which has no address to send a logo to yet', async () => {
    const user = setupUser()

    serving()
    renderAt('/sr/administracija/sponzori', 'superadmin')
    await user.click(await screen.findByRole('button', { name: 'Novi sponzor' }))

    expect(await screen.findByRole('heading', { name: 'Novi sponzor' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Logo sponzora' })).toBeNull()
  }, SLOW)
})
