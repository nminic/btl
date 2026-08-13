import { screen, within } from '@testing-library/react'
import { ROUTES } from '../../app/routes'
import sr from '../../i18n/sr.json'
import { translate } from '../../i18n/translate'
import { expectFrontPage, moderatorWith, renderAt } from '../../test/render'
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

const dictionary = sr

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
    expect(needFor('dukati')).toBeUndefined()
  })

  it('leaves no box in the matrix that no screen ever asks for', () => {
    /* Turned round. It used to check that every need names a right the matrix
       carries, and after the rights of the queues and the entities came to be
       built by one pair of functions that both sides call, that could no longer
       go red: the two cannot disagree by construction.
    
       The risk that is left runs the other way. A right can be given to a
       moderator, and ticked, and mean nothing, because no screen asks for it.
       Unticked and unasked-for look the same from the outside, which is what
       made the old direction worth testing and makes this one worth testing
       now. */
    const asked = new Set(
      Object.values(NEEDS)
        .filter((need) => need.of === 'right')
        .map((need) => need.right.key),
    )
    const orphans = RIGHTS.map((right) => right.key).filter((key) => !asked.has(key))

    expect(orphans).toEqual([])
  })

  it('names a right that exists, wherever it names one', () => {
    /* A need pointing at a key no box in the matrix carries would be a screen
       nobody could ever be given, and it would fail silently: unticked is the
       same shape as unknown.

       Narrower than it was, and the reason is worth knowing. The rights of the
       eight queues and the nine entities are now built by one pair of functions
       that both the matrix and the needs call, so for those the two sides can no
       longer disagree and this cannot go red. What it still catches is a need
       written by hand, and an entity whose right is filtered out of the matrix
       by `superadminOnly` while the need still asks for it, which is a real
       shape and the one that made this test worth writing. */
    const keys = new Set(RIGHTS.map((right) => right.key))
    const wrong = Object.values(NEEDS).filter(
      (need) => need.of === 'right' && !keys.has(need.right.key),
    )

    expect(wrong).toEqual([])
  })
})

describe('a moderator without the right for a screen', () => {
  it('is sent to the front page, and told nothing at all', async () => {
    /* It used to be a sentence naming the right to go and ask for. That was the
       right answer while the navigation named every screen whether or not you
       could open it; it names only the ones you can now, so the sentence would
       be the only thing on the portal telling a moderator that a room exists he
       was never given (owner, 30.07.2026). */
    renderAt('/sr/administracija/cenovnik', 'moderator', null, moderatorWith(['queue:results']))

    await expectFrontPage()
    expect(screen.queryByRole('table', { name: t('admin.pricing') })).not.toBeInTheDocument()
  })

  it('is never offered it in the navigation either, which is the point', async () => {
    /* The door and the navigation ask the same question of the same table
       (needs.ts), so a screen cannot be named in one and refused by the other. */
    renderAt(
      '/sr/administracija/verifikacija/komentari',
      'moderator',
      null,
      moderatorWith(['queue:comments']),
    )

    const nav = within(await screen.findByRole('navigation', { name: 'Odeljak Verifikacija' }))

    expect(nav.getByRole('link', { name: /Komentari/ })).toBeVisible()
    expect(nav.queryByRole('link', { name: /Profilne slike/ })).not.toBeInTheDocument()
    expect(nav.queryByRole('link', { name: /Uplate/ })).not.toBeInTheDocument()
  })

  it('is turned away from a queue it may not decide, by the same door', async () => {
    renderAt(
      '/sr/administracija/verifikacija/slike',
      'moderator',
      null,
      moderatorWith(['queue:comments']),
    )

    await expectFrontPage()
  })

  it('goes to the front page rather than an empty section, holding no queue at all', async () => {
    /* The way into the section opens the first queue he may work in. Somebody
       who may work in none has no business being told the section is there
       (owner, 30.07.2026). */
    renderAt('/sr/administracija/verifikacija', 'moderator', null, moderatorWith(['entity:teams']))

    await expectFrontPage()
  })

  it('gets in where the right is his', async () => {
    renderAt('/sr/administracija/cenovnik', 'moderator', null, moderatorWith(['entity:pricing']))

    expect(
      await screen.findByRole('heading', { level: 1, name: t('admin.pricing') }),
    ).toBeVisible()
  })

  it('is kept out of moderators even holding every right there is', async () => {
    renderAt(
      '/sr/administracija/moderatori',
      'moderator',
      null,
      moderatorWith(RIGHTS.map((r) => r.key)),
    )

    /* Holding every right there is changes nothing here. Assigning rights is not
       a right, it is the one thing the two roles do not share (PDL P21), which
       is why there is no box for it to hold. */
    await expectFrontPage()
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
  it('is sent to the front page, with no sign that administration is there', async () => {
    renderAt('/sr/administracija/cenovnik', 'competitor')

    await expectFrontPage()
    expect(screen.queryByRole('navigation', { name: 'Odeljak Podaci' })).not.toBeInTheDocument()
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
    // By initials, so the widest choice does not push the rest of the header
    // onto a second line (owner, 30.07.2026).
    expect(within(chooser).getByRole('option', { name: 'N. V.' })).toBeInTheDocument()

    // Nenad may decide results and nothing else, so the price list closes.
    await user.selectOptions(chooser, 'moderator:mod-vujacic')

    await expectFrontPage()
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

    /* The screen she was standing on is the one entity no moderator ever opens,
       so becoming her takes her off it and onto the front page. In through the
       menu again, the way the owner walks it. */
    await expectFrontPage()
    await user.click(screen.getByRole('link', { name: new RegExp(`^${t('nav.admin')}`) }))

    /* And the price list has left the sector beside her. Before the matrix was
       enforced the box was remembered and read by nothing at all; before this it
       was read by the door alone, so the screen was named and then refused. */
    const nav = within(await screen.findByRole('navigation', { name: 'Odeljak Podaci' }))

    expect(nav.queryByRole('link', { name: t('admin.pricing') })).not.toBeInTheDocument()
    expect(nav.getByRole('link', { name: t('admin.members') })).toBeVisible()
  })
})
