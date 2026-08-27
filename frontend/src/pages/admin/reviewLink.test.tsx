import { cleanup, screen, within } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import {
  OUTSIDE_ADDRESS,
  outsideHost,
  outsideLink,
} from '../../data/outsideLink'
import adminEvent from '../../forms/definitions/admin-dogadjaj.form.json'
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

describe('the shape an address of somebody else’s page must have', () => {
  it('is one shape, and every form that asks for one carries it', async () => {
    /* Written once in `data/outsideLink.ts` and copied into the form definitions,
       because a definition is data and cannot import. Held so the copies cannot
       drift, and so that deleting one is not silent: measured on 23.08.2026,
       taking the rule off either form broke nothing at all.

       Three forms and not two since 27.08.2026. The admin form of an event has
       asked for an organiser's address since 23.08.2026, with this very pattern
       written into it, and this loop went on naming two: the fact had three homes
       and its guard knew of two, so the one it did not know of was free to drift.
       Found by counting the homes before drawing the link, not by a round. */
    for (const [what, form] of [
      ['the result form', newResult],
      ['the form on the event', fromEvent],
      ['the admin form of an event', adminEvent],
    ] as const) {
      const link = must(
        form.fields.find((one) => one.name === 'link'),
        `the link field of ${what}`,
      )

      expect(link.pattern, `${what} does not ask for the shape of an address`).toBe(
        OUTSIDE_ADDRESS.source,
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
      /* The same trick with something that is not a blank at all. `\s` does not
         cover these, and every one of them splits a host exactly as a line break
         does: measured with `new URL`, each resolves to `zlo.example`. Built rather
         than written out, because a control character in a source file is a
         character nobody reading it can see.

         The last seven were found by a round on 23.08.2026, over a rule that named
         six by hand and called them „the characters that split a host". They are
         here so the next hand-written list fails rather than passes: measured, each
         of the seven was accepted while the six were refused. */
      `https://primer.rs${String.fromCharCode(0)}@zlo.example/p`,
      `https://primer.rs${String.fromCharCode(1)}@zlo.example/p`,
      `https://primer.rs${String.fromCharCode(31)}@zlo.example/p`,
      `https://primer.rs${String.fromCharCode(127)}@zlo.example/p`,
      'https://primer.rs\u200b@zlo.example/p',
      'https://primer.rs\u2060@zlo.example/p',
      `https://primer.rs${String.fromCharCode(133)}@zlo.example/p`,
      'https://primer.rs\u00ad@zlo.example/p',
      'https://primer.rs\u180e@zlo.example/p',
      'https://primer.rs\u200c@zlo.example/p',
      'https://primer.rs\u200e@zlo.example/p',
      'https://primer.rs\u202e@zlo.example/p',
      'https://primer.rs\u2066@zlo.example/p',
      /* And the one the anchor is for, which nothing else here refuses. U+00A0 is a
         blank as far as `\s` is concerned, so `[^\s]+` stops in front of it and the
         address ends there; it is **not** `Cc` or `Cf`, so `INVISIBLE` never sees
         it. Without `$` the shape would match the part in front of the blank and the
         whole value would be handed to a browser, which resolves it to
         `zlo.example`. Measured on 23.08.2026: the case the comment above names, a
         line break, is refused by `INVISIBLE` rather than by the anchor, so the
         anchor was written and measured by nothing. */
      'https://primer.rs\u00a0@zlo.example/p',
    ]) {
      expect(outsideLink(said), `${said} was accepted as an address`).toBeUndefined()
    }

    expect(outsideLink('https://primer.rs/rezultati/2026')).toBe(
      'https://primer.rs/rezultati/2026',
    )
    expect(outsideLink('HTTPS://primer.rs/ok'), 'the scheme is read as written')
      .toBeUndefined()
  })

  it('names the host a browser would open, and nothing where there is none', () => {
    /* What the moderator's queue draws beside the name. Read through `new URL`
       rather than off the text, because `@` ends the user part of an address and a
       host read by eye is the trick this is drawn against. */
    expect(outsideHost('https://primer.rs@zlo.example/p')).toBe('zlo.example')
    expect(outsideHost('https://primer.rs:8443/rezultati')).toBe('primer.rs:8443')
    /* Not an address at all, so there is nothing to name. */
    expect(outsideHost('javascript:alert(1)')).toBeUndefined()
    /* And a shape this pattern lets through which a browser still refuses: an
       unclosed IPv6 authority. Nothing to draw, and nothing to say beyond that. */
    expect(outsideHost('https://[::1')).toBeUndefined()
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
        raceName: 'Probna trka',
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
    const link = table.getByRole('link', { name: /Probna trka/ })

    expect(link).toHaveAttribute('href', 'https://primer.rs/rezultati')
    /* `noreferrer`, because the host on the other end is one the member chose and
       the address of an administrative screen is not theirs to be told. Held as
       the whole value, so dropping either word fails here. */
    expect(link).toHaveAttribute('rel', 'noreferrer noopener')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('says where the press leads, because the words of the link are not the address', async () => {
    /* The words of this link are the name of the event, and the member who sent the
       result wrote them. Measured on 23.08.2026, before: a result named „Zvanicni
       rezultati BTL 2026" pointing at `btl-rezultati.zlo.example` put the host
       **nowhere** in the page, not in the text, not in `title`, not in an
       `aria-label`, so a moderator reading with a screen reader heard only the name.

       `rel="noreferrer noopener"` keeps the attacker's page from learning anything,
       and it is held above; what it cannot do is tell the moderator where the press
       leads. This does.

       The host and not the whole address, and read through `new URL` rather than off
       the text, because `@` ends the user part of an address and a host read by eye
       is exactly the trick this is drawn against. */
    const table = await queueWith('https://primer.rs@zlo.example/rezultati')
    const link = table.getByRole('link', { name: /Probna trka/ })

    expect(link).toHaveTextContent('zlo.example')
    expect(link, 'the name the member wrote is still what is read first')
      .toHaveTextContent(/^Probna trka/)
  })

  it('draws a name and no link at all where what was stored is not an address', async () => {
    /* Every shape a browser would act on, each one reaching the store past the
       form. The name of the event is still drawn, because the moderator still has
       a result to decide about; what is not drawn is a way to press it. */
    for (const said of ['javascript:alert(1)', 'data:text/html,<b>x</b>', '//zlo.example/p']) {
      const table = await queueWith(said)

      expect(
        table.queryByRole('link', { name: /Probna trka/ }),
        `${said} was drawn as a link`,
      ).toBeNull()
      expect(table.getByText(/Probna trka/)).toBeVisible()

      cleanup()
    }
  })
})
