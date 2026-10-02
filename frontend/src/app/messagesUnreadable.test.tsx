import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { answeredWith, serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

/**
 * THE INBOX IN THE HEADER, WHEN THE SERVER CANNOT BE ASKED FOR IT (owner, 02.10.2026, PENDING
 * stavka 368: „Spisak koji ne moze da se ucita KAZE to, umesto da izgleda prazan, uz dugme
 * „Pokusaj ponovo". Vazi za sve ekrane sa spiskom.").
 *
 * <p><b>The one screen the compiler found besides the team's page</b>
 * (`data/aFailedReadIsSaid.test.ts` is the same question asked of the whole portal): the panel
 * under the envelope read `dataOr(useInbox(mine), [])`, so a server that did not answer drew
 * „Nema poruka." - the sentence an inbox with nothing in it gets. Its own comment said that was
 * deliberate, and what it was written against is true and stays: the panel stands over every
 * screen, so it may not draw a loading sheet or an error over the portal around it. What it says
 * now is said INSIDE the panel, which is shut until somebody opens it, and nothing is drawn over
 * the rest of the page.
 *
 * <p>The axes are the answer (a failure by a number, a server that cannot be reached, a read that
 * comes back with nothing in it), the moment (opened while it is unreadable, asked again, read
 * again) and whose mail it is (the member signed in; the number in the button is held across).
 */

let server: { asked: { path: string }[]; stop: () => void } | null = null

/** What `GET /api/inbox` answers right now, which a case may change while it runs. */
let inbox: () => Response | Promise<Response> = () => answeredWith(500)

afterEach(() => {
  server?.stop()
  server = null
})

function theInboxAnswers(how: () => Response | Promise<Response>) {
  inbox = how
  server = serverThat((path) => (path === '/api/inbox' ? inbox() : null))
}

const MAIL = [
  {
    id: 601,
    from: 'Balkanska trkačka liga',
    subject: 'Prevoz do Jadovnika',
    body: 'Idem kolima u subotu.',
    date: '2026-09-20',
    read: false,
    teamInvitationId: null,
    pairInviteId: null,
  },
]

const mailAsServed = () =>
  new Response(JSON.stringify(MAIL), { status: 200, headers: { 'content-type': 'application/json' } })

async function openThePanel(user: ReturnType<typeof setupUser>) {
  renderAt('/sr', 'competitor', '000007')

  const button = await screen.findByRole('button', { name: /Otvori poruke/ })

  await user.click(button)

  /* The panel the button controls, found through the button's own `aria-controls` and not through
     a selector: that is the one thing that ties the two together for a reader who cannot see them. */
  return within(
    must(
      document.getElementById(must(button.getAttribute('aria-controls'), 'what the button controls')),
      'the panel the button controls',
    ),
  )
}

describe('the inbox in the header when it could not be read', () => {
  it.each([
    ['a 500', () => answeredWith(500)],
    ['a 401', () => answeredWith(401)],
    ['a server that cannot be reached', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('says it cannot be read, and not that there is nothing, on %s', async (_how, how) => {
    theInboxAnswers(how)

    const user = setupUser()
    const panel = await openThePanel(user)

    expect(await panel.findByText(sr.shell.messagesUnreadable)).toBeVisible()
    expect(panel.queryByText(sr.shell.noMessages), 'an unread inbox looks like an empty one').toBeNull()
    expect(panel.getByRole('button', { name: `${sr.data.retry}: ${sr.shell.messages}` })).toBeVisible()
    /* The way on to the whole inbox stays: it is a link to a screen that says what it can. */
    expect(panel.getByRole('link', { name: sr.shell.allMessages })).toBeVisible()
  }, SLOW)

  it('says there is nothing, and not that it cannot be read, when the read came back empty', async () => {
    theInboxAnswers(() => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }))

    const user = setupUser()
    const panel = await openThePanel(user)

    expect(await panel.findByText(sr.shell.noMessages)).toBeVisible()
    expect(panel.queryByText(sr.shell.messagesUnreadable)).toBeNull()
    expect(panel.queryByRole('button', { name: new RegExp(sr.data.retry) })).toBeNull()
  }, SLOW)

  it('draws what arrives when it is asked again and the server answers', async () => {
    theInboxAnswers(() => answeredWith(500))

    const user = setupUser()
    const panel = await openThePanel(user)

    await panel.findByText(sr.shell.messagesUnreadable)

    inbox = mailAsServed
    await user.click(panel.getByRole('button', { name: `${sr.data.retry}: ${sr.shell.messages}` }))

    expect(await panel.findByRole('link', { name: /Prevoz do Jadovnika/ })).toBeVisible()
    expect(panel.queryByText(sr.shell.messagesUnreadable)).toBeNull()
    /* And the number in the name of the button follows the read, which it could not while the
       read had not come back. */
    expect(await screen.findByRole('button', { name: 'Otvori poruke, 1 nepročitana' })).toBeVisible()
  }, SLOW)

  it('says it is asking while the request is out, and says it cannot be read again if it still cannot', async () => {
    theInboxAnswers(() => answeredWith(500))

    const user = setupUser()
    const panel = await openThePanel(user)

    await panel.findByText(sr.shell.messagesUnreadable)

    let letGo: () => void = () => undefined

    inbox = () =>
      new Promise<Response>((resolve) => {
        letGo = () => {
          resolve(answeredWith(500))
        }
      })

    const retry = () => panel.getByRole('button', { name: `${sr.data.retry}: ${sr.shell.messages}` })

    await user.click(retry())

    expect(await panel.findByText(sr.data.loading)).toBeVisible()
    expect(panel.queryByText(sr.shell.messagesUnreadable)).toBeNull()
    expect(retry()).toHaveAttribute('aria-disabled', 'true')

    const asked = must(server, 'the server').asked.filter((one) => one.path === '/api/inbox').length

    await user.click(retry())

    expect(
      must(server, 'the server').asked.filter((one) => one.path === '/api/inbox').length,
      'a press went through while the request was out',
    ).toBe(asked)

    letGo()

    expect(await panel.findByText(sr.shell.messagesUnreadable)).toBeVisible()
    expect(panel.queryByText(sr.data.loading)).toBeNull()
    expect(retry()).not.toHaveAttribute('aria-disabled', 'true')
  }, SLOW)
})
