import { screen, within } from '@testing-library/react'
import { ROUTES } from '../../app/routes'
import sr from '../../i18n/sr.json'
import { translate, type Dictionary } from '../../i18n/translate'
import { moderatorWith, renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { needFor, NEEDS } from './needs'
import { QUEUES } from './queues'
import { RIGHTS } from './rights'

/* What a moderator may actually do, as opposed to what the matrix says he may.
 *
 * The two used to be different things. Every administrative screen was guarded
 * by "is this staff", nothing anywhere read the matrix, and a superadmin could
 * untick all sixteen boxes of a moderator who would then open the price list and
 * change what a membership costs (PDL P21, ADL A8).
 */

const dictionary = sr as Dictionary

function t(key: string, params?: Record<string, string | number>): string {
  return translate(dictionary, 'sr', key, params)
}

/** Every address the router serves under administration, screens and queues
 *  alike. */
const ADMIN_PATHS = [
  ...ROUTES.map((route) => route.path),
  ...QUEUES.map((queue) => queue.path),
].filter((path) => path.startsWith('administracija'))

describe('every administrative address', () => {
  it('says what it asks of whoever opens it', () => {
    /* The reason the door is fitted by the route table and not by the screens:
       fourteen screens each writing their own check is fourteen chances to write
       isStaff and stop there, which is exactly what had happened. A fifteenth
       screen added without an entry here fails this. */
    const unguarded = ADMIN_PATHS.filter((path) => needFor(path) === undefined)

    expect(unguarded).toEqual([])
    expect(ADMIN_PATHS.length).toBeGreaterThan(13)
  })

  it('asks for nothing outside administration, so nothing else is wrapped', () => {
    expect(needFor('kalendar')).toBeUndefined()
    expect(needFor('znacke')).toBeUndefined()
  })

  it('names a right that exists, wherever it names one', () => {
    /* A need pointing at a key no box in the matrix carries would be a screen
       nobody could ever be given, and it would fail silently: unticked is the
       same shape as unknown. */
    const keys = new Set(RIGHTS.map((right) => right.key))
    const wrong = Object.values(NEEDS).filter(
      (need) => need.of === 'right' && !keys.has(need.right.key),
    )

    expect(wrong).toEqual([])
  })
})

describe('a moderator without the right for a screen', () => {
  it('is turned away from it', async () => {
    renderAt('/sr/administracija/cenovnik', 'moderator', null, moderatorWith(['queue:results']))

    expect(
      await screen.findByRole('heading', { level: 1, name: t('admin.rightMissing') }),
    ).toBeVisible()
    expect(screen.queryByRole('table', { name: t('admin.pricing') })).not.toBeInTheDocument()
  })

  it('is told which right it is, and not that this is not for him', async () => {
    renderAt('/sr/administracija/cenovnik', 'moderator', null, moderatorWith([]))

    /* The words of the box in the matrix, so the sentence names the thing the
       superadmin has to tick. "Ovo nije za tebe" is what a competitor sees, and
       a moderator reading it would go and report a fault. */
    expect(
      await screen.findByText(
        t('admin.rightMissingText', { action: t('rights.action.entity.pricing') }),
      ),
    ).toBeVisible()
    expect(screen.queryByText(t('admin.notAllowedText'))).not.toBeInTheDocument()
  })

  it('is turned away from a queue it may not decide, by the same door', async () => {
    renderAt(
      '/sr/administracija/verifikacija/slike',
      'moderator',
      null,
      moderatorWith(['queue:comments']),
    )

    expect(
      await screen.findByText(
        t('admin.rightMissingText', { action: t('rights.action.queue.photos') }),
      ),
    ).toBeVisible()
  })

  it('gets in where the right is his', async () => {
    renderAt('/sr/administracija/cenovnik', 'moderator', null, moderatorWith(['entity:pricing']))

    expect(
      await screen.findByRole('heading', { level: 1, name: t('admin.pricing') }),
    ).toBeVisible()
  })

  it('is kept out of moderators for a different reason, and told that one', async () => {
    renderAt('/sr/administracija/moderatori', 'moderator', null, moderatorWith(RIGHTS.map((r) => r.key)))

    /* Holding every right there is changes nothing here. Assigning rights is not
       a right, it is the one thing the two roles do not share (PDL P21), which
       is why there is no box for it to hold. */
    expect(await screen.findByText(t('admin.moderatorsClosed'))).toBeVisible()
  })
})

describe('the superadmin', () => {
  it('opens every administrative address without holding a single box', async () => {
    for (const path of ['administracija/cenovnik', 'administracija/moderatori']) {
      const view = renderAt(`/sr/${path}`, 'superadmin')

      expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent(
        t('admin.rightMissing'),
      )

      view.unmount()
    }
  })
})

describe('a competitor', () => {
  it('is turned away from administration without being told about rights', async () => {
    renderAt('/sr/administracija/cenovnik', 'competitor')

    expect(
      await screen.findByRole('heading', { level: 1, name: t('admin.notAllowed') }),
    ).toBeVisible()
    expect(screen.getByText(t('admin.notAllowedText'))).toBeVisible()
  })
})

describe('the role switch', () => {
  it('becomes one named moderator rather than the word moderator', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/cenovnik', 'superadmin')

    /* Four moderators, each with a different set, so the only way to see what a
       limited one runs into is to become one of them. Until this existed, the
       matrix had nobody to belong to. */
    const chooser = await screen.findByLabelText(t('role.label'))
    expect(within(chooser).getByRole('option', { name: 'Nenad Vujačić' })).toBeInTheDocument()

    // Nenad may decide results and nothing else, so the price list closes.
    await user.selectOptions(chooser, 'moderator:mod-vujacic')

    expect(
      await screen.findByRole('heading', { level: 1, name: t('admin.rightMissing') }),
    ).toBeVisible()

    // And the moderator who holds everything opens it again.
    await user.selectOptions(chooser, 'moderator:mod-radulovic')

    expect(
      await screen.findByRole('heading', { level: 1, name: t('admin.pricing') }),
    ).toBeVisible()
  })

  it('carries a tick taken away in the matrix through to the screen behind it', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/moderatori', 'superadmin')

    /* The whole of B1 in one walk: the superadmin unticks a box, becomes that
       moderator, and finds the screen shut. Before, the box was remembered and
       read by nothing at all. */
    const matrix = within(await screen.findByRole('table', { name: t('rights.title') }))
    await user.click(
      matrix.getByRole('checkbox', { name: 'Jelena Radulović, uređivanje cenovnika' }),
    )

    await user.selectOptions(screen.getByLabelText(t('role.label')), 'moderator:mod-radulovic')

    // In through the front, the way the owner walks it: the menu, the list of
    // entities, and the tile that used to open regardless.
    await user.click(screen.getByRole('button', { name: t('nav.admin') }))
    await user.click(screen.getByRole('link', { name: t('nav.entities') }))
    await user.click(await screen.findByRole('link', { name: t('admin.pricing') }))

    expect(
      await screen.findByRole('heading', { level: 1, name: t('admin.rightMissing') }),
    ).toBeVisible()
  })
})
