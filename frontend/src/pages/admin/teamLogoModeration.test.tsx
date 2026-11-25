import { configure, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { timesDropped } from '../../data/client'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/* Every wait of this file is given half of the time a case has (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * A TEAM'S LOGO, SET AND TAKEN DOWN BY THE ADMINISTRATION, AT ONCE, IN THE FORM OF THE TEAM (owner, PDL 25.11.2026,
 * „Urednik tima postavlja znak tima slikom”: „da moze i iz administracije”; derived the same day: „Znak koji
 * postavi administracija važi odmah, bez odobravanja”).
 *
 * The served file gives the first team (Dunavski trkači, id 1) a logo and the second (Nišavski maraton klub, id 2)
 * none, and every write is made from the SECOND, so an address built from the first team of the list is told apart.
 */
const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function aServerThatTakes(answer: (method: string) => Response | null = () => null): Asked[] {
  const { asked, stop } = serverThat((path, init) => {
    if (/^\/api\/teams\/\d+\/logo$/.test(path) && (init?.method === 'POST' || init?.method === 'DELETE')) {
      return (
        answer(init.method) ??
        new Response(JSON.stringify({ photo: '/api/photos/abc', crop: { x: 0.25, y: 0.75, size: 0.5 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    }

    return null
  })

  stops.push(stop)

  return asked
}

const writes = (asked: Asked[]) => asked.filter((one) => one.init?.method === 'POST' || one.init?.method === 'DELETE')

async function theBox(team: string) {
  const user = setupUser()

  renderAt('/sr/administracija/timovi', 'superadmin', null)

  const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
  const row = must(
    listed.getAllByRole('row').find((one) => one.textContent?.includes(team) === true),
    `the row of ${team}`,
  )

  await user.click(within(row).getByRole('button', { name: /^Otvori/ }))

  return { user, box: within(await screen.findByRole('region', { name: sr.teamLogo.title })) }
}

describe('the logo of a team, in the administration', () => {
  it('opens on the logo that stands, with the way to take it down, for a team that has one', async () => {
    const { box } = await theBox('Dunavski trkači')

    expect(box.getByText(sr.teamLogo.standingNote)).toBeVisible()
    expect(box.getByText(sr.teamLogo.atOnce)).toBeVisible()
    expect(box.getByRole('button', { name: sr.teamLogo.remove })).toBeVisible()
  }, SLOW)

  it('sets a picture at once at this team’s own address, then takes it down there', async () => {
    const asked = aServerThatTakes()
    const { user, box } = await theBox('Nišavski')
    const save = box.getByRole('button', { name: sr.teamLogo.save })

    expect(box.getByText(sr.teamLogo.none)).toBeVisible()
    expect(box.queryByRole('button', { name: sr.teamLogo.remove })).toBeNull()
    expect(save).toHaveAttribute('aria-disabled', 'true')
    await user.click(save)
    expect(writes(asked)).toHaveLength(0)

    await user.upload(await box.findByLabelText(sr.teamLogo.choose), new File(['logo'], 'logo.png', { type: 'image/png' }))
    await measurePicture()

    const dropped = timesDropped('teams')

    await user.click(save)

    expect(await box.findByText(sr.teamLogo.saved)).toHaveAttribute('role', 'status')
    expect(timesDropped('teams'), 'the list of teams was not dropped after the save').toBe(dropped + 1)

    const body = must(writes(asked)[0], 'the write').init?.body

    expect(body instanceof FormData ? body.get('picture') : null).toBeInstanceOf(File)

    await user.click(box.getByRole('button', { name: sr.teamLogo.remove }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: sr.admin.form.delete }))

    expect(await box.findByText(sr.teamLogo.removed)).toHaveAttribute('role', 'status')
    expect(timesDropped('teams')).toBe(dropped + 2)
    expect(writes(asked).map((one) => [one.path, one.init?.method])).toEqual([
      ['/api/teams/2/logo', 'POST'],
      ['/api/teams/2/logo', 'DELETE'],
    ])
  }, SLOW)

  it.each([
    ['a save', 'POST'],
    ['a removal', 'DELETE'],
  ])('says what the server refused for %s, in its own sentence', async (_, method) => {
    aServerThatTakes((asked) => (asked === method ? refused('thisIsNotAPicture') : null))

    const { user, box } = await theBox('Dunavski trkači')

    if (method === 'POST') {
      await user.upload(await box.findByLabelText(sr.teamLogo.choose), new File(['logo'], 'logo.png', { type: 'image/png' }))
      await measurePicture()
      await user.click(box.getByRole('button', { name: sr.teamLogo.save }))
    } else {
      await user.click(box.getByRole('button', { name: sr.teamLogo.remove }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: sr.admin.form.delete }))
    }

    expect(await box.findByText(sr.picture.sendRefused.thisIsNotAPicture)).toBeVisible()
    expect(box.getByText(sr.teamLogo.standingNote)).toBeVisible()
  }, SLOW)
})
