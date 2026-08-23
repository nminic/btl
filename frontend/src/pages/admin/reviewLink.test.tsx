import { cleanup, screen, within } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { OFFICIAL_RESULTS, officialResultsLink } from '../../data/officialResults'
import fromEvent from '../../forms/definitions/prijava-sa-trke.form.json'
import newResult from '../../forms/definitions/unos-rezultata.form.json'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { useSession } from '../../session/useSession'

/**
 * The one address a member types that the portal hands to a browser.
 *
 * A result carries a link to the official results, and the moderator's queue draws
 * it as a link. That is the only `href` on the portal whose value somebody outside
 * it chose, so it is the only one worth this file.
 *
 * Two readers ask the same question and neither is trusted to have asked it: the
 * forms refuse a bad address before it is stored, and the screen refuses it again
 * before it is drawn. Until 23.08.2026 the first was written and unmeasured, the
 * second did not exist at all, and deleting the pattern from either form left the
 * whole suite green.
 */

const ME = '000007'

describe('the shape an address of official results must have', () => {
  it('is one shape, and both forms carry it', async () => {
    /* Written once in `data/officialResults.ts` and copied into the two form
       definitions, because a definition is data and cannot import. Held so the
       copies cannot drift, and so that deleting one is not silent: measured on
       23.08.2026, taking the rule off either form broke nothing at all. */
    for (const [what, form] of [
      ['the result form', newResult],
      ['the form on the event', fromEvent],
    ] as const) {
      const link = must(
        form.fields.find((one) => one.name === 'link'),
        `the link field of ${what}`,
      )

      expect(link.pattern, `${what} does not ask for the shape of an address`).toBe(
        OFFICIAL_RESULTS.source,
      )
      /* And a ceiling, because a field with none is a column with none the day the
         store arrives. Measured: two million characters passed both forms. */
      expect(link.maxLength, `${what} takes an address of any length`).toBeGreaterThan(0)
    }
  })

  it('refuses everything a browser would read as an instruction', () => {
    /* The shapes that matter, each one an address bar would act on. `javascript:`
       in an `href` is a script running on the portal with the moderator's session
       around it; React 19 happens to refuse that one itself, which is a second
       lock on a door this portal is meant to lock for itself. */
    for (const said of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      '//zlo.example/rezultati',
      '/administracija/moderatori',
      'https:/primer.rs/ok',
      /* And the one an anchored pattern is for: read to the first line break this
         is `primer.rs`, and a browser resolves the whole of it to `zlo.example`. */
      'https://primer.rs\n@zlo.example/p',
    ]) {
      expect(officialResultsLink(said), `${said} was accepted as an address`).toBeUndefined()
    }

    expect(officialResultsLink('https://primer.rs/rezultati/2026')).toBe(
      'https://primer.rs/rezultati/2026',
    )
    expect(officialResultsLink('HTTPS://primer.rs/ok'), 'the scheme is read as written')
      .toBeUndefined()
  })
})

/**
 * Puts one result into the store before the queue is looked at, with whatever
 * address is handed here.
 *
 * Written straight into the session rather than through the form, which is the
 * whole point: the form refuses these, and what is being asked is what the screen
 * does with a value that reached the store by another road.
 */
function Sends({ link }: { link: string }) {
  const session = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      session.submit({
        memberNumber: ME,
        eventName: 'Probna trka',
        date: '2026-05-10',
        distanceKm: 21.1,
        ascentM: 540,
        descentM: 540,
        photo: '',
        seconds: 6730,
        points: 12.34,
        category: 'half',
        link,
        comment: '',
      })
    }
  }, [link, session])

  return null
}

describe('the queue the moderator decides in', () => {
  /** The queue, with one result already in it. */
  async function queueWith(link: string) {
    renderAt('/sr/administracija/verifikacija/rezultati', 'superadmin', ME, undefined, null, (
      <Sends link={link} />
    ))

    return within(await screen.findByRole('table', { name: 'Čeka proveru' }))
  }

  it('opens the address the member sent, and says nothing of this screen on the way', async () => {
    const table = await queueWith('https://primer.rs/rezultati')
    const link = table.getByRole('link', { name: 'Probna trka' })

    expect(link).toHaveAttribute('href', 'https://primer.rs/rezultati')
    /* `noreferrer`, because the host on the other end is one the member chose and
       the address of an administrative screen is not theirs to be told. Held as
       the whole value, so dropping either word fails here. */
    expect(link).toHaveAttribute('rel', 'noreferrer noopener')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('draws a name and no link at all where what was stored is not an address', async () => {
    /* Every shape a browser would act on, each one reaching the store past the
       form. The name of the event is still drawn, because the moderator still has
       a result to decide about; what is not drawn is a way to press it. */
    for (const said of ['javascript:alert(1)', 'data:text/html,<b>x</b>', '//zlo.example/p']) {
      const table = await queueWith(said)

      expect(
        table.queryByRole('link', { name: 'Probna trka' }),
        `${said} was drawn as a link`,
      ).toBeNull()
      expect(table.getByText(/Probna trka/)).toBeVisible()

      cleanup()
    }
  })
})
