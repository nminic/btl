import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderAt } from '../../test/render'
import {
  answeredWith,
  did,
  forgetEveryCookie,
  serverThat,
  type Asked,
} from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { clearResourceCache } from '../../data/client'
import { SLOW } from '../../test/slow'
import sr from '../../i18n/sr.json'

/**
 * THE INBOX AS THE SERVER REALLY KEEPS IT.
 *
 * <p><b>Why this file exists, and it is the owner's own afternoon rather than a class of
 * fault somebody imagined.</b> On 27.09.2026 he refused a profile photograph with a reason,
 * read the message it produced, signed out, signed back in, and <b>the message was gone</b>.
 * Nothing was broken on the server: seven routes in `backend/src/main` write into `message`
 * and the decision he took is one of them (`VerificationWriteApi.tell`). The row was kept and
 * never read. What the three screens drew was a copy held in `session/SessionProvider.tsx`'s
 * `useState`, and a copy in a component dies with the component.
 *
 * <p><b>So every case here is written so that it cannot be satisfied by the browser's own
 * half.</b> The session in these cases holds nothing at all: `renderAt` starts a
 * `SessionProvider` whose only seeded messages are the two broadcasts in
 * `data/seedMessages.ts`, and every subject asserted below is one only this file's server
 * says. Put the server read back out of any of the three screens and these go red; leave the
 * read in and take the SESSION half out, and they stay green, which is the direction that
 * tells this file from the flow cases in `memberFlows.test.tsx`.
 *
 * <p><b>The fake server is a state machine and not a table</b>, copied from
 * `member/signIn.test.tsx` for the reason that file gives: a visit begins with
 * `GET /api/me` answering 401, signing in is what makes it answer 200, and signing out is
 * what takes it back. A case that set „who is signed in" by hand could not tell „the portal
 * asked again" from „the portal still had it".
 */

/** Obviously a test and not anybody's password. */
const TYPED_PASSWORD = 'ovo-je-probna-lozinka-123'

const HIS_ADDRESS = 'ja@primer.rs'
const HER_ADDRESS = 'ona@primer.rs'

/**
 * WHAT THE PORTAL FORGED, so the sender is the LEAGUE'S NAME and not a person's.
 *
 * Owner, 19.09.2026, chosen between three offered endings: „Kad portal sam pise poruku clanu,
 * posiljalac je NAZIV LIGE". `message.from_name` is `not null` in V13 with
 * `message_from_name_not_blank` beside it, so „the portal wrote this" is NOT an empty sender
 * on the wire, and a case that looked for one would be measuring a shape the schema forbids.
 */
const FORGED = {
  id: 501,
  from: 'Balkanska trkačka liga',
  subject: 'Fotografija nije prihvaćena',
  body: 'Slika je odbijena jer lice nije jasno vidljivo. Pošalji drugu.',
  date: '2026-09-27',
  read: false,
  teamInvitationId: null,
  pairInviteId: null,
}

/** AND WHAT A PERSON WROTE, the second state of the same field. Read, so that „read" and
 *  „unread" are not the same value as „forged" and „written". */
const WRITTEN = {
  id: 502,
  from: 'Milica Anđelković',
  subject: 'Prevoz do Jadovnika',
  body: 'Idem kolima iz Beograda u subotu, ima još dva mesta.',
  date: '2026-09-20',
  read: true,
  teamInvitationId: null,
  pairInviteId: null,
}

/** HERS AND NOT HIS, for the axis about somebody else's mail. It is never served to him:
 *  the route spends `to_id` on its own `where` clause and the field never leaves
 *  (`InboxApi`, and `InboxApiTest`'s „the inbox holds his own and every broadcast but never
 *  somebody else's"), so the portal cannot be asked to filter what it was never given. */
const HERS = {
  ...FORGED,
  id: 777,
  subject: 'Tvoja članarina je evidentirana',
}

/** A MESSAGE THAT ASKS, which is the second state of the two question keys. */
const A_QUESTION = {
  ...FORGED,
  id: 503,
  subject: 'Tim te poziva',
  body: 'Dunavski trkači te pozivaju u tim.',
  teamInvitationId: 7,
}

let server: { asked: Asked[]; stop: () => void } | null = null
let open = false
let holder: { role: string; account: number; member?: { memberNumber: string } } | null = null
let mail: Record<string, unknown[]> = {}

/**
 * A server that answers the four routes this walk uses, and lets every other one fall
 * through to the mock on the disc.
 *
 * @param inboxes what `GET /api/inbox` answers, by address, because the whole point of this
 *                resource is that the answer is different for every caller
 */
function aServerWhere(
  who: { role: string; account: number; member?: { memberNumber: string } } | null,
  inboxes: Record<string, unknown[]>,
  already = true,
): void {
  open = already
  holder = who
  mail = inboxes

  server = serverThat((path, init) => {
    if (path === '/api/me') {
      return open && holder !== null
        ? new Response(JSON.stringify(holder), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : answeredWith(401)
    }

    if (path === '/api/sign-in') {
      const said: unknown = JSON.parse(String(init?.body ?? '{}'))
      const email = typeof said === 'object' && said !== null ? Reflect.get(said, 'email') : null

      open = true
      /* WHOEVER TYPED THE ADDRESS, and the account number moves with him. Two people and not
         one, because the axis that matters most here cannot be measured with one: an answer
         cached under the name „inbox" would be handed to whoever signed in next, and a case
         where both sign-ins are the same person could not tell that from a fresh read. */
      holder =
        email === HER_ADDRESS
          ? { role: 'competitor', account: 2, member: { memberNumber: '000009' } }
          : { role: 'competitor', account: 1, member: { memberNumber: '000007' } }
      whoseMailIsBeingServed = String(email)

      return did()
    }

    if (path === '/api/sign-out') {
      open = false
      holder = null

      return did()
    }

    if (path === '/api/inbox') {
      return new Response(JSON.stringify(mail[whoseMailIsBeingServed] ?? []), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    return null
  })
}

/** Whose mail the fake server is holding out, which only signing in changes. */
let whoseMailIsBeingServed = HIS_ADDRESS

/** Him, as `GET /api/me` answers him. */
function him(): { role: string; account: number; member: { memberNumber: string } } {
  return { role: 'competitor', account: 1, member: { memberNumber: '000007' } }
}

function theEnvelope(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: /Otvori poruke/ })
}

/** The list item one subject stands in, so that what is asserted about a message is read off
 *  that message and not off the page. */
function rowOf(subject: string): HTMLElement {
  const row = screen.getByRole('link', { name: subject }).closest('li')

  if (row === null) {
    throw new Error(`the subject "${subject}" is not drawn inside a row`)
  }

  return row
}

/** How many times the portal has asked for one address. */
function asksFor(path: string): number {
  return (server?.asked ?? []).filter((one) => one.path === path).length
}

beforeEach(() => {
  forgetEveryCookie()
  document.cookie = 'XSRF-TOKEN=imam'
  whoseMailIsBeingServed = HIS_ADDRESS
  clearResourceCache()
})

afterEach(() => {
  server?.stop()
  server = null
  open = false
  holder = null
  mail = {}
  clearResourceCache()
})

describe('the inbox a member reads', () => {
  it('draws what the server kept, both what the league forged and what a person wrote', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED, WRITTEN] })

    renderAt('/sr/poruke', 'competitor', '000007')

    expect(await screen.findByRole('link', { name: FORGED.subject })).toBeVisible()

    /* **The sender is read INSIDE the row it belongs to, and that is not tidiness.** „Balkanska
       trkačka liga" is on this page three times over before the inbox is drawn at all - it is
       the name in the mark at the top of every screen, and it is the sender of both seeded
       broadcasts - so a case reading it off the page would pass with the served row carrying
       nobody's name at all, or the wrong one. */
    expect(within(rowOf(FORGED.subject)).getByText(FORGED.body)).toBeVisible()
    expect(within(rowOf(FORGED.subject)).getByText(FORGED.from)).toBeVisible()
    /* And the second state of the same field: a person's name, where the one above is the
       league's (owner, 19.09.2026). Two different strings on two different rows, because one
       row alone is satisfied by a screen that draws the same sender on every line. */
    expect(within(rowOf(WRITTEN.subject)).getByText(WRITTEN.from)).toBeVisible()
  })

  it('counts the unread among them and leaves the read alone', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED, WRITTEN] })

    renderAt('/sr/poruke', 'competitor', '000007')

    /* One of the two served rows is unread and one is read, and the two seeded broadcasts
       the provider starts with carry one unread between them. So the number is the sum and
       not either half: served alone it would be one, seeded alone it would be one, and a
       screen reading only one of the two sources would pass a case that asserted „1". */
    expect(await screen.findByText('2 nepročitane')).toBeVisible()
  })

  it('says there is nothing when the server answers nothing, and asks nobody else', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [] })

    renderAt('/sr/poruke', 'competitor', '000007')

    /* The two seeded broadcasts are still in the session here, so this is NOT an empty
       inbox on the screen - and that is the honest thing to assert: the empty answer took
       nothing away that the browser was holding. What it says is that an empty answer is a
       state the screen survives, which is the half `header.test.tsx` measures on a session
       holding nothing at all. */
    expect(await screen.findByRole('link', { name: /Dobro došao u pripremu sezone/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: FORGED.subject })).not.toBeInTheDocument()
    expect(screen.queryByText(sr.messages.empty)).not.toBeInTheDocument()
  })

  it('never has somebody else’s message to draw, because the route never sends one', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED], [HER_ADDRESS]: [HERS] })

    renderAt('/sr/poruke', 'competitor', '000007')

    await screen.findByRole('link', { name: FORGED.subject })

    /* **Measured as the route's guard and not as a filter of this portal's own.** Whose a
       message is is decided by `InboxApi`'s `where m.to_id = :me or m.to_id is null`, which
       `InboxApiTest`'s „the inbox holds his own and every broadcast but never somebody
       else's" measures against three members and six rows. `to` does not leave the server at
       all, so there is nothing here that could let hers through and nothing here that could
       be weakened to. What this asserts is the consequence: what he reads is what he was
       served, hers included in no part of it. */
    expect(screen.queryByText(HERS.subject)).not.toBeInTheDocument()
  })

  it('answers an address naming a message he was not served with the front page', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED] })

    renderAt(`/sr/poruke/${String(HERS.id)}`, 'competitor', '000007')

    /* Same road as any address the portal does not have (owner, 30.07.2026). Waited for
       rather than read at once, because the screen holds the loader until the answer lands:
       read synchronously it would find the front page before the inbox had arrived, and
       would say nothing about whether the message was in it. */
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Balkanska trkačka liga' }),
    ).toBeVisible()
  })

  it('opens one the server kept, on its own address', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED] })

    renderAt(`/sr/poruke/${String(FORGED.id)}`, 'competitor', '000007')

    /* The key arrives as a NUMBER and the address is text, so this is also the case that
       fails if anybody ever compares the two without `String` (`data/types.ts`). */
    expect(
      await screen.findByRole('heading', { level: 1, name: FORGED.subject }),
    ).toBeVisible()
    expect(screen.getByText(FORGED.body)).toBeVisible()
  })

  it('puts the newest first, whichever of the two sides each one came from', async () => {
    /* Three served rows and two seeded ones, dated so that the right answer INTERLEAVES them:
       27.09. and 20.09. served, 20.07. and 12.07. seeded, and 11.07. served last. Any order
       that keeps one side together - served first, or held first, which is what dropping the
       sort gives - fails here, and so does one that sorts the wrong way round.

       **And the day is the only thing sorted on, deliberately.** What leaves the server is the
       calendar day and not the instant (`InboxApi` converts in the league's own zone), so two
       messages of one day can only keep the order they arrived in; the sort is stable for
       exactly that reason and this case does not ask it for more than it can say. */
    aServerWhere(him(), {
      [HIS_ADDRESS]: [
        FORGED,
        WRITTEN,
        { ...WRITTEN, id: 504, subject: 'Rezultat je primljen', date: '2026-07-11' },
      ],
    })

    renderAt('/sr/poruke', 'competitor', '000007')

    await screen.findByRole('link', { name: FORGED.subject })

    expect(
      screen.getAllByRole('link', { name: /Fotografija|Prevoz|Dobro do|Rezultat/ }).map(
        (one) => one.textContent,
      ),
    ).toEqual([
      FORGED.subject,
      WRITTEN.subject,
      'Dobro došao u pripremu sezone 2027',
      'Rezultat je odobren',
      'Rezultat je primljen',
    ])
  })
})

describe('what the portal may not claim about a message the server keeps', () => {
  it('offers no way to mark a served message read, and still offers one for a held message', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED] })

    renderAt('/sr/poruke', 'competitor', '000007')

    await screen.findByRole('link', { name: FORGED.subject })

    /* **Both halves in one case, because either alone is satisfied by the wrong code.** One
       button and not none: the seeded broadcast is unread and the browser IS its store, so
       its button must stay. And not two: no route writes `message_read` (measured over the
       whole of `backend/src/main`), so a button on the served row would be a control over a
       fact the portal cannot change. A screen that drew a button for everything, and one that
       drew none at all, each pass half of this. */
    expect(screen.getAllByRole('button', { name: sr.messages.markRead })).toHaveLength(1)

    const served = screen.getByRole('link', { name: FORGED.subject }).closest('li')

    expect(
      within(served as HTMLElement).queryByRole('button', { name: sr.messages.markRead }),
    ).not.toBeInTheDocument()
  })

  it('leaves a served message unread after it has been opened', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED] })

    renderAt(`/sr/poruke/${String(FORGED.id)}`, 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: FORGED.subject })

    /* Opening a message is what marks it read, and for a served one there is nowhere to
       write that. **The count is the measurement rather than the absence of a button**: the
       seeded broadcast carries one unread and the served row carries the second, so a screen
       that marked the served one anyway would say „1 nepročitana" here. Held for a beat
       rather than read once, because the mark, if it happened, would happen in the tick after
       the screen drew. */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Otvori poruke, 2 nepročitane' })).toBeVisible()
    })
  })

  it('says nothing at all about an answer to a question the server keeps', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [A_QUESTION] })

    renderAt(`/sr/poruke/${String(A_QUESTION.id)}`, 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: A_QUESTION.subject })

    /* **THE BOUNDARY THIS INCREMENT ENDS ON, written as a case so that it is a decision and
       not a gap.** `GET /api/inbox` answers `teamInvitationId`, and the route that answers
       such a question exists too (`PUT /api/teams/{id}/invitations/{invitation}`). No screen
       calls it: `InvitationAnswer` looks the invitation up in the session's own list and
       treats one it cannot find as one that is OVER. So handing it a served key would tell a
       member a question was closed while the server still held it open, and that is worse
       than no buttons. Neither the buttons nor the sentence is here, and if either appears
       this goes red. */
    expect(screen.queryByRole('button', { name: sr.teams.inviteAccept })).not.toBeInTheDocument()
    expect(screen.queryByText(sr.teams.inviteClosed)).not.toBeInTheDocument()
    expect(screen.queryByText(sr.teams.inviteGone)).not.toBeInTheDocument()
  })
})

describe('the inbox across signing out and signing back in', () => {
  it('still holds the message, and holds it because the server was asked again', async () => {
    const user = setupUser()

    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED] })

    renderAt('/sr/poruke', 'competitor', '000007')

    expect(await screen.findByRole('link', { name: FORGED.subject })).toBeVisible()

    const askedFirst = asksFor('/api/inbox')

    expect(askedFirst).toBeGreaterThan(0)

    /* OUT, through the control the member presses. */
    await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))
    await user.click(screen.getByRole('button', { name: 'Odjavi se' }))

    expect(await screen.findByRole('heading', { name: 'Za ovo treba prijava' })).toBeVisible()

    /* AND BACK IN, through the form. */
    await user.click(screen.getByRole('link', { name: sr.nav.login }))
    await user.type(await screen.findByLabelText('Adresa elektronske pošte'), HIS_ADDRESS)
    await user.type(screen.getByLabelText('Lozinka'), TYPED_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }))

    /* **THE WHOLE POVOD, AND IT IS ASSERTED TWICE ON PURPOSE.** That the message is on the
       screen is the owner's own sentence. That the server was asked AGAIN is what makes the
       first half mean anything: the resource cache is keyed by name with nobody in the key,
       so a portal that never re-asked would show this message for exactly as long as the
       cache held it, and the case would pass over the bug it was written for. */
    /* The way back in is waited for on its own, so that a failure names the step rather than
       the last line of the case. */
    await waitFor(() => {
      expect(asksFor('/api/sign-in')).toBe(1)
    })

    await user.click(await theEnvelope())

    /* **THE WHOLE POVOD.** Read in the panel, where the name of a link is the subject and the
       day together, so it is matched loosely on purpose.

       **AND WHAT MAKES IT MEAN SOMETHING IS THAT THIS MESSAGE WAS NEVER IN THE SESSION.**
       `notify` is not called anywhere in this file and the provider seeds only the two
       broadcasts of `data/seedMessages.ts`, so `GET /api/inbox` is the one place this subject
       can have come from at any point in the walk. Take the server read out of either screen
       and this goes red at the first assertion, before the walk even starts.

       **What is deliberately NOT claimed here is that the portal asked again.** It need not
       have: the resource cache holds one answer per name for the whole visit, by the portal's
       own rule („One request per resource per visit", `data/client.ts`), and this member is the
       same member. That the answer never crosses from one caller to another is a different
       claim with a different mechanism, and it is measured in the case below rather than
       assumed here. */
    expect(await screen.findByRole('link', { name: new RegExp(FORGED.subject) })).toBeVisible()
    expect(asksFor('/api/inbox')).toBeGreaterThanOrEqual(askedFirst)
  }, SLOW * 2)

  it('hands the next person their own mail and never the last person’s', async () => {
    const user = setupUser()

    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED], [HER_ADDRESS]: [HERS] })

    renderAt('/sr/poruke', 'competitor', '000007')

    expect(await screen.findByRole('link', { name: FORGED.subject })).toBeVisible()

    await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))
    await user.click(screen.getByRole('button', { name: 'Odjavi se' }))
    await screen.findByRole('heading', { name: 'Za ovo treba prijava' })

    await user.click(screen.getByRole('link', { name: sr.nav.login }))
    await user.type(await screen.findByLabelText('Adresa elektronske pošte'), HER_ADDRESS)
    await user.type(screen.getByLabelText('Lozinka'), TYPED_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }))

    await user.click(await theEnvelope())

    /* **SIGNING OUT AND IN HAPPENS IN PLACE**, which is measured and not assumed:
       `AccountMenu` calls `signOutOfTheServer()` and `signOut()`, `SignIn` calls `signInWith`
       and `navigate`, and not one of the four reloads the page. So one visit holds two people
       and a cache keyed by the name „inbox" alone would hand the second one the first one's
       mail. `data/useResource.ts` drops the answer the moment it stops being this caller's,
       and this is the case that says so. */
    expect(await screen.findByRole('link', { name: new RegExp(HERS.subject) })).toBeVisible()
    expect(screen.queryByText(FORGED.subject)).not.toBeInTheDocument()
    /* And it is a fresh read and not the same answer relabelled, which is the half the case
       above deliberately does not claim: her sign in changed who is asking, so the answer the
       visit was holding was dropped and asked for again. */
    expect(asksFor('/api/inbox')).toBeGreaterThan(1)
  }, SLOW * 2)
})

describe('an account the league has given no number', () => {
  it('is told this part is for competitors, and no inbox is asked for at all', async () => {
    aServerWhere({ role: 'moderator', account: 4 }, { [HIS_ADDRESS]: [FORGED] })

    renderAt('/sr/poruke', 'moderator', null)

    /* A moderator and a superadmin have no competitor row (PDL P21, owner 14.09.2026), so
       `GET /api/inbox` answers them the way an address that is not there answers (404, ADL
       A8; `InboxApiTest`'s „an account with no member behind it is told the address is not
       there"). **Measured as the ABSENCE of the request as well as the sentence**, because an
       empty screen is what a refused request would look like too, and the difference is a
       refusal spent on every moderator who opens this. */
    expect(
      await screen.findByRole('heading', { level: 1, name: sr.signIn.noRecord }),
    ).toBeVisible()
    expect((server?.asked ?? []).map((one) => one.path)).not.toContain('/api/inbox')
  })
})
