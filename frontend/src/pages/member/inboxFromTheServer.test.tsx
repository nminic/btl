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
import { useSession } from '../../session/useSession'
import type { Message } from '../../session/context'

/**
 * THE INBOX AS THE SERVER REALLY KEEPS IT.
 *
 * <p><b>Why this file exists, and it is the owner's own afternoon rather than a class of
 * fault somebody imagined.</b> On 27.09.2026 he refused a profile photograph with a reason,
 * read the message it produced, signed out, signed back in, and <b>the message was gone</b>.
 * Nothing was broken on the server: seven places in six classes under `backend/src/main`
 * write into `message` and the decision he took is one of them (`VerificationWriteApi.tell`).
 * The row was kept and never read. What the three screens drew was a copy held in
 * `session/SessionProvider.tsx`'s `useState`, and a copy in a component dies with it.
 *
 * <p><b>So every case here is written so that it cannot be satisfied by the browser's own
 * half.</b> The session in these cases holds nothing at all, and since 28.09.2026 that is
 * literally true rather than nearly: `renderAt` used to start a `SessionProvider` carrying the
 * two broadcasts of `data/seedMessages.ts`, and PDL 34 („NECU MOCK PODATKE NIGDE", owner) took
 * that file out of the shipped bundle, so the browser's half is empty unless a case fills it
 * (`WritesIntoTheVisit` below, which the four cases about the two halves TOGETHER use). Every
 * subject asserted below is one only this file's server says. Put the server read back out of
 * any of the three screens and these go red; leave the read in and take the SESSION half out,
 * and they stay green, which is the direction that tells this file from the flow cases in
 * `memberFlows.test.tsx`.
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

/** And one that asks about a racing pair, which is answered by a different screen and is
 *  therefore its own state rather than a variant of the one above. */
const A_PAIR_QUESTION = {
  ...FORGED,
  id: 505,
  subject: 'Poziv u par',
  body: 'Milica te poziva u trkački par.',
  pairInviteId: 9,
}

/**
 * EVERY SENTENCE AND EVERY BUTTON AN ANSWER TO AN INVITATION COULD PUT ON THIS SCREEN, taken
 * off the dictionary itself.
 *
 * **Written as a derivation because the hand-written version of it let a mutation through.**
 * The first draft of the case below named three sentences - „Ovaj poziv više ne stoji.", „Tim
 * koji te je pozvao više ne postoji." and the accept button - and a mutation that handed a
 * served key straight to `InvitationAnswer` SURVIVED it, because what that screen actually
 * drew was a fourth sentence („U međuvremenu si ušao/la u tim …", the member of this fixture
 * having a team already). A list of sentences cannot be finished by thinking about the list.
 *
 * **And the derivation is not a scan of the component either**, which would have gone short
 * in the same place: `grep` over `t('…')` in `InvitationAnswer.tsx` finds seven keys and
 * misses exactly the two that are chosen by a ternary, which are the two that were missed.
 * The dictionary is the thing that names them all.
 *
 * The longest literal run between the placeholders rather than the text up to the first one,
 * because three of these sentences BEGIN with a placeholder and would otherwise contribute an
 * empty string and quietly drop out.
 */
/*
 * **AND THE SENTENCES NESTED UNDER A REFUSAL COUNT TOO, WHICH IS A THIRD WAY THIS LIST WENT
 * SHORT.** `sr.pair` gained `answerRefused` on 28.09.2026 with the screen that answers a served
 * invitation (PDL 27b), and its two sentences are the ones a member reads when the ROUTE turns
 * an answer back - exactly the sort of thing the case below asks a served team question not to
 * claim. Read one level deep only, `Object.entries` would have handed this
 * `['answerRefused', {…}]`, `String` of it is `"[object Object]"`, and the list would have
 * carried that instead of the two sentences: longer by one, poorer by two, and passing the
 * count below either way.
 */
const WHAT_AN_ANSWER_WOULD_SAY = [
  ...Object.entries(sr.teams).filter(([key]) => key.startsWith('invite')),
  ...Object.entries(sr.pair),
]
  .flatMap(([, said]) =>
    typeof said === 'object' && said !== null ? Object.values(said).map(String) : [String(said)],
  )
  .map((said) => longestLiteralIn(said))
  .filter((one) => one.length > 3)

function longestLiteralIn(said: string): string {
  return (
    said
      .split(/\{[^}]*\}/)
      .map((one) => one.trim())
      .sort((left, right) => right.length - left.length)[0] ?? ''
  )
}

/** What a served question must not have put on the screen, said as one list rather than as
 *  one assertion per sentence. */
/**
 * WHETHER ANYTHING ON THIS SCREEN IS STILL WAITING FOR AN ANSWER, and this is the half of
 * the two cases below that actually bites.
 *
 * **Measured, and it is why the derived list above was not enough on its own.** With the
 * list alone, a mutation that handed a served key to `InvitationAnswer` STILL survived: the
 * block that opens is wrapped in a `Resource` over three further resources, so at the moment
 * the message is drawn that block is a LOADER rather than a sentence, and an absence
 * asserted then is the absence of something that had not had time to appear.
 *
 * A screen drawing a message the portal can say nothing further about has nothing left to
 * wait for, so „no loader" is true of the right code and false the instant that block is
 * opened.
 *
 * **Found by its words and not by its role**, and both halves of that are measured. `role`
 * alone is no use: `app/Shell.tsx` keeps a permanent `role="status"` for announcing a change
 * of screen, so „is there a status" is true on every page of the portal. And the role WITH a
 * name is no use either: `status` is not a role that takes its name from its contents, so the
 * loader has no accessible name at all. Its words are what the portal already reads it by
 * (`app/newScreen.test.tsx`), and the cases below give this a floor by asking for it while the
 * screen really is waiting.
 */
function theLoader(): HTMLElement | null {
  return screen.queryByText(sr.data.loading)
}

function whatTheScreenClaimsAboutAnAnswer(): string[] {
  const said = screen.getByRole('main').textContent ?? ''

  return WHAT_AN_ANSWER_WOULD_SAY.filter((one) => said.includes(one))
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
  readBy = new Set()

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
      /* **AND WHAT HAS BEEN READ IS APPLIED ON THE WAY OUT, since PDL 27a (27.09.2026).** This
         used to hand the fixture straight back, which was enough while nothing could change a
         read mark; `POST /api/inbox/{id}/read` can, so a fixture returned unchanged would make
         „the portal read the server's answer" indistinguishable from „the portal decided on its
         own". Keyed by address AND message, because a row in `message_read` names the reader
         (V13), so one broadcast served to two people carries a different mark for each. */
      const rows = (mail[whoseMailIsBeingServed] ?? []).map((row) =>
        typeof row === 'object' && row !== null
          ? {
              ...row,
              read:
                Reflect.get(row, 'read') === true ||
                readBy.has(`${whoseMailIsBeingServed}:${String(Reflect.get(row, 'id'))}`),
            }
          : row,
      )

      return new Response(JSON.stringify(rows), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const reading = /^\/api\/inbox\/(\d+)\/read$/.exec(path)

    if (reading !== null) {
      readBy.add(`${whoseMailIsBeingServed}:${String(reading[1])}`)

      return did()
    }

    /* **WHAT THE ONE ASKING IS WAITING ON, since 28.09.2026 and only because a served TEAM
       question now has a screen.** `member/ServedTeamInvite.tsx` reads this to learn the team
       half of `PUT /api/teams/{id}/invitations/{invitation}`, which `GET /api/inbox` cannot
       say. It is answered here rather than left to the mock on the disc for the reason the whole
       of this file exists: this answer, like the inbox, is different for every caller, and the
       served fixture holds one member's. Only the invitation of `A_QUESTION` is in it, because
       the one case below that opens a team question is about the buttons being there at all;
       what each of them sends is measured where the mechanism lives
       (`member/teamInviteAnswered.test.tsx`). */
    if (path === '/api/me/applications') {
      return new Response(
        JSON.stringify({
          teamApplications: [],
          teamInvitations: [{ id: A_QUESTION.teamInvitationId, teamId: 4, date: '2026-10-06' }],
          teamProposals: [],
          pairInvites: [],
          alreadyInATeam: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    return null
  })
}

/** Who has read which message, as the server keeps it: a row is its presence. Cleared with
 *  every fresh server, so one case cannot decide what the next one measures. */
let readBy = new Set<string>()

/** Whose mail the fake server is holding out, which only signing in changes. */
let whoseMailIsBeingServed = HIS_ADDRESS

/** Him, as `GET /api/me` answers him. */
function him(): { role: string; account: number; member: { memberNumber: string } } {
  return { role: 'competitor', account: 1, member: { memberNumber: '000007' } }
}

/**
 * SOMEBODY ELSE SIGNING IN WITHOUT SIGNING OUT FIRST, through the portal's own live writer
 * and not a fake session object.
 *
 * The shape is `pages/member/pictureIsOneRow.test.tsx`'s `SignInAs`, copied rather than
 * reinvented, for the same reason that file gives: `theServerSignedMeIn` is the very call
 * `member/SignIn.tsx` makes with the answer to `GET /api/me`, `SessionProvider` sits above
 * the router so it never comes down, and the sign in screen can be walked to while somebody
 * is signed in. A shared laptop at a race is the ordinary case.
 *
 * What this probe does beyond that one, and why: it also moves `whoseMailIsBeingServed`,
 * because unlike the picture queue that file measures, this file's whole point is that
 * `GET /api/inbox` answers a DIFFERENT body per caller, and the fake server above keys that
 * answer on this module variable rather than on a cookie. A real sign in changes both in one
 * request; this button changes both in one click, so a case built on it measures whether the
 * SCREEN reacts to the switch, not whether the fake server can.
 */
function SignInAsWithoutSigningOut({
  memberNumber,
  address,
}: {
  memberNumber: string
  address: string
}) {
  const { theServerSignedMeIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        whoseMailIsBeingServed = address
        theServerSignedMeIn({
          account: 2,
          memberNumber,
          country: null,
          firstSeason: null,
          teamId: null,
          membershipBasis: null,
          referralCode: null,
          referredCount: null,
        })
      }}
    >
      sign in as somebody else, in place
    </button>
  )
}

function theEnvelope(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: /Otvori poruke/ })
}

/**
 * WHAT THIS VISIT WRITES INTO THE BROWSER'S OWN HALF OF THE INBOX.
 *
 * <p><b>Four cases here are about the two halves TOGETHER, and until 28.09.2026 the second half
 * arrived for nothing.</b> `data/seedMessages.ts` put two broadcasts into every session before
 * anything happened, so a count, an order or „a row of each kind" could be asserted without the
 * case doing anything. The owner found those two on QA - „Zasto su ove testne poruke i dalje
 * tu?????? NECU MOCK PODATKE NIGDE" - and PDL 34 took them out of the shipped bundle, so a
 * session now begins holding nothing at all.
 *
 * <p><b>Which makes the rest of this file STRICTER rather than weaker</b>, and the header above
 * says why: every other case is written so that it cannot be satisfied by the browser's half,
 * and that half is now empty unless the case in front of you filled it.
 *
 * <p>What fills it is `notify`, the road nine screens really use. Addressed to this member and
 * never to the league, so nothing below can be satisfied by a message everybody would have been
 * sent.
 */
function WritesIntoTheVisit({ these }: { these: Omit<Message, 'id' | 'read'>[] }) {
  const { notify } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        for (const one of these) {
          notify(one)
        }
      }}
    >
      napisi u posetu
    </button>
  )
}

/** One message the browser holds, unread, dated between the two served rows every case that
 *  uses it also serves. */
const HELD = {
  from: 'Balkanska trkačka liga',
  to: '000007',
  subject: 'Predlog tima čeka odgovor',
  body: 'Dunavski trkači te pozivaju u tim.',
  date: '2026-07-20',
}

/** And a second one, for the case about order: two held lines and three served ones, dated so
 *  that the right answer interleaves the halves rather than keeping either of them together. */
const HELD_OLDER = {
  ...HELD,
  subject: 'Prijava za trku je zabeležena',
  date: '2026-07-12',
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

/**
 * REQUIRES SOMETHING TO BE TRUE NOW AND TO GO ON BEING TRUE, which `waitFor` cannot say.
 *
 * <p><b>`waitFor` answers „has this BECOME true" and can answer nothing else.</b> Measured: a
 * heading that is absent at the start and appended after 300 ms satisfies it. So a `waitFor`
 * written to hold a screen still - „it did not react" - is satisfied by a screen that reacted and
 * then put itself back, and equally by one that had not reacted YET when the first poll ran.
 *
 * <p><b>Read now and then again for as long as the window being guarded</b>, 300 ms in thirty
 * turns. Now, so that something that arrives late fails on the first reading rather than being
 * waited for; again, so that something that leaves inside the window fails on a later one.
 */
async function itStays(check: () => void): Promise<void> {
  check()

  for (let turn = 0; turn < 30; turn += 1) {
    await new Promise((settle) => setTimeout(settle, 10))
    check()
  }
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
       trkačka liga" is already on this page before the inbox is drawn at all - it is the name in
       the mark at the top of every screen - so a case reading it off the page would pass with
       the served row carrying nobody's name at all, or the wrong one. (It was on the page more
       often still while the bundle seeded two broadcasts from the league; PDL 34 took those out
       on 28.09.2026, and the mark alone is enough for the collision this is written against.) */
    expect(within(rowOf(FORGED.subject)).getByText(FORGED.body)).toBeVisible()
    expect(within(rowOf(FORGED.subject)).getByText(FORGED.from)).toBeVisible()
    /* And the second state of the same field: a person's name, where the one above is the
       league's (owner, 19.09.2026). Two different strings on two different rows, because one
       row alone is satisfied by a screen that draws the same sender on every line. */
    expect(within(rowOf(WRITTEN.subject)).getByText(WRITTEN.from)).toBeVisible()
  })

  it('counts the unread among them and leaves the read alone', async () => {
    const user = setupUser()

    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED, WRITTEN] })

    renderAt('/sr/poruke', 'competitor', '000007', undefined, null, (
      <WritesIntoTheVisit these={[HELD]} />
    ))

    await screen.findByRole('link', { name: FORGED.subject })
    await user.click(screen.getByRole('button', { name: 'napisi u posetu' }))

    /* One of the two served rows is unread and one is read, and the visit wrote one more
       unread line of its own. So the number is the sum and not either half: served alone it
       would be one, held alone it would be one, and a screen reading only one of the two
       sources would pass a case that asserted „1". (The held half arrived from the bundle
       until 28.09.2026 and this case wrote none of it; PDL 34 took that out, and what the
       number has to be a sum OF did not change.) */
    expect(await screen.findByText('2 nepročitane')).toBeVisible()
  })

  it('says there is nothing when the server answers nothing, and asks nobody else', async () => {
    const user = setupUser()

    aServerWhere(him(), { [HIS_ADDRESS]: [] })

    renderAt('/sr/poruke', 'competitor', '000007', undefined, null, (
      <WritesIntoTheVisit these={[HELD]} />
    ))

    /* **The visit writes one line, so this is NOT an empty inbox on the screen** - and that is
       the honest thing to assert: the empty answer took nothing away that the browser was
       holding. What it says is that an empty answer is a state the screen survives, which is
       the half `header.test.tsx` measures on a session holding nothing at all.

       Written here since 28.09.2026. Two seeded broadcasts stood in for it until then and the
       case wrote nothing; PDL 34 („NECU MOCK PODATKE NIGDE", owner) took them out of the
       bundle, and the state being measured - a served half that answered nothing beside a held
       half that has something - is the same one. */
    await user.click(screen.getByRole('button', { name: 'napisi u posetu' }))

    expect(await screen.findByRole('link', { name: new RegExp(HELD.subject) })).toBeVisible()
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
    /* Four served rows and two the visit writes, dated so that the right answer INTERLEAVES
       them: 27.09. and twice 20.09. served, 20.07. and 12.07. held, and 11.07. served last.
       Any order that keeps one side together - served first, or held first, which is what
       dropping the sort gives - fails here, and so does one that sorts the wrong way round.
       (The two held ones were records the bundle seeded until 28.09.2026; PDL 34 took those
       out, so this case writes its own and the dates are chosen for the same reason.)

       **And the day is the only thing sorted on, deliberately.** What leaves the server is the
       calendar day and not the instant (`InboxApi` converts in the league's own zone), so two
       messages of one day can only keep the order they arrived in; the sort is stable for
       exactly that reason and this case does not ask it for more than it can say. */
    aServerWhere(him(), {
      [HIS_ADDRESS]: [
        FORGED,
        WRITTEN,
        /* **The SAME DAY as the row above it, which is the third thing this case measures.**
           What leaves the server is the calendar day, so two messages of one day carry the
           same value to sort on and the only order there is for them is the one the server
           sent them in (`sent_at desc, id desc`). A sort that is not stable, or one that
           compares something else when the days are equal, swaps these two. */
        { ...WRITTEN, id: 499, subject: 'Majica je poslata', date: '2026-09-20' },
        { ...WRITTEN, id: 504, subject: 'Rezultat je primljen', date: '2026-07-11' },
      ],
    })

    const user = setupUser()

    renderAt('/sr/poruke', 'competitor', '000007', undefined, null, (
      <WritesIntoTheVisit these={[HELD, HELD_OLDER]} />
    ))

    await screen.findByRole('link', { name: FORGED.subject })
    await user.click(screen.getByRole('button', { name: 'napisi u posetu' }))

    await screen.findByRole('link', { name: new RegExp(HELD.subject) })

    expect(
      screen.getAllByRole('link', { name: /Fotografija|Prevoz|Majica|Predlog|Prijava|Rezultat/ }).map(
        (one) => one.textContent,
      ),
    ).toEqual([
      FORGED.subject,
      WRITTEN.subject,
      'Majica je poslata',
      HELD.subject,
      HELD_OLDER.subject,
      'Rezultat je primljen',
    ])
  })
})

describe('what the portal may not claim about a message the server keeps', () => {
  it('offers no way to mark a message read by hand, on either half of the list', async () => {
    const user = setupUser()

    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED] })

    renderAt('/sr/poruke', 'competitor', '000007', undefined, null, (
      <WritesIntoTheVisit these={[HELD]} />
    ))

    await screen.findByRole('link', { name: FORGED.subject })
    await user.click(screen.getByRole('button', { name: 'napisi u posetu' }))

    /* **BOTH HALVES ARE DRAWN HERE AND NEITHER CARRIES A CONTROL, since PDL 27a
       (27.09.2026).** There was one button on this list until that day, on whichever row the
       browser was the store of. The owner refused it in one sentence covering both - „Ne treba
       mi dugme da se nesto oznaci kao procitano ili neprocitano", „ni za posluzenu poruku ni za
       onu koja zivi u poseti" - so a screen that kept it for the held half fails here exactly
       as one that kept it for the served half does.

       The floor under the absence is the row below: the line this visit wrote really is on this
       screen, so „no button" is measured where both states of „where does the mark live" are
       present rather than over an empty list. What replaced the button is on
       `member/MessageDetail.tsx`, and `member/openingMarksItRead.test.tsx` measures it. */
    expect(within(rowOf(FORGED.subject)).queryAllByRole('button')).toEqual([])

    const held = await screen.findByRole('link', { name: new RegExp(HELD.subject) })

    expect(held).toBeVisible()
    expect(within(rowOf(held.textContent ?? '')).queryAllByRole('button')).toEqual([])
  })

  it('marks a served message read once it has been opened, and the count falls', async () => {
    /* **TWO UNREAD ROWS AND NOT ONE, AND THAT IS A MEASUREMENT RATHER THAN CAUTION
       (28.09.2026).** The second unread line was a seeded broadcast until PDL 34 took the seed
       out of the bundle. Written with the seed simply gone and one served row left, this case
       PASSED WITHOUT MEASURING ANYTHING: the envelope says „1 nepročitana" from the first paint,
       before the mark is written, so `waitFor` was satisfied by the state the case exists to
       see the portal leave. A second unread row puts the starting number at two, so „one" can
       only be reached by the mark landing. */
    aServerWhere(him(), {
      [HIS_ADDRESS]: [FORGED, { ...FORGED, id: 598, subject: 'Prijava za trku je primljena' }],
    })

    renderAt(`/sr/poruke/${String(FORGED.id)}`, 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: FORGED.subject })

    /* **THE OTHER HALF OF PDL 27a, AND THIS CASE USED TO SAY THE OPPOSITE.** Until 27.09.2026
       there was no route that wrote `message_read`, so a served line was left as the server had
       it and this case asserted „2 nepročitane" after opening one of them. `InboxReadApi` is
       that route, so opening is now the trigger and the count falls by itself - which is the
       consequence the journal names in as many words: „brojac nad svakim ekranom od tada pada
       sam, bez ijedne radnje clana osim citanja."

       **The count is the measurement and not the request**, because the envelope is what the
       member actually sees and it stands above every screen (`app/Shell.tsx`). The row that is
       never opened keeps the one that is left, so this number distinguishes „the served row was
       marked" (one) from „everything was marked" (nought) and from „nothing was" (two). The request itself, the
       key it carried and what happens when it is refused are measured where the mechanism
       lives (`member/openingMarksItRead.test.tsx`); this file's question is only that the
       screen reading the server does it at all. */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Otvori poruke, 1 nepročitana' })).toBeVisible()
    })
  })

  it('does offer an answer to a question about a team, and claims nothing it cannot keep', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [A_QUESTION] })

    renderAt(`/sr/poruke/${String(A_QUESTION.id)}`, 'competitor', '000007')

    /* THE FLOOR UNDER `theLoader`: before the inbox lands this screen really is waiting, so
       the query below is looking for something that exists on this portal. Without this, a
       query that matched nothing at all would make the assertion after it vacuous. */
    expect(theLoader()).not.toBeNull()

    await screen.findByRole('heading', { level: 1, name: A_QUESTION.subject })

    /* **THIS CASE SAID THE OPPOSITE UNTIL 28.09.2026, AND THE BOUNDARY IT HELD WAS REAL.** It
       read „says nothing at all about an answer to a question the server keeps", because
       `PUT /api/teams/{id}/invitations/{invitation}` needs a TEAM and no field of
       `GET /api/inbox` carries one, so the only screen that could have been handed the key was
       `InvitationAnswer` - which looks an invitation up in the session's own list and treats one
       it cannot find as OVER. That closed boundary is now open from the other end:
       `GET /api/me/applications` answers the team, `member/ServedTeamInvite.tsx` is the screen it
       is owed, and the fake server above answers it.

       **What is asked here is only that the answer ARRIVES**, because this file's question is
       whether the screen reading the server offers one at all. Which keys reached which address,
       what each button sends, and what stands where „Prihvati" is held back are measured where
       the mechanism lives (`member/teamInviteAnswered.test.tsx`).

       **„Odbij" and never „Prihvati", and that is this file's own clock rather than caution.**
       The gate reads this suite twice, as two days a season and a year apart
       (`test/theDay.ts`), and this case names no day; „Prihvati" is held back outside 1 October
       to 31 December (PDL, 06.09.2026), so a case asserting it would agree with itself in one
       pass and not the other. „Odbij" is bound by nothing, which is the other half of that same
       decision, so it is the one button true on every day of the year. */
    /* **THE BUTTON IS WAITED FOR AND THE LOADER IS READ AFTER IT, WHICH IS A CHANGE OF ORDER
       THIS INCREMENT FORCED AND IS WORTH THE SENTENCE.** Until 28.09.2026 the loader was gone by
       the time the heading arrived, because everything this screen drew came off one read. It now
       draws a part that waits for a SECOND read (`GET /api/me/applications`), and that part waits
       INLINE with no label - so `theLoader()`, which asks for the portal's plain „Učitavanje",
       matches the inline one as well as the sheet. Read before the buttons, it would be reading a
       part that is honestly still waiting and calling it a screen that never finished. */
    expect(await screen.findByRole('button', { name: sr.teams.inviteRefuse })).toBeVisible()
    expect(theLoader()).toBeNull()

    /* **AND THE SENTENCE OF THE OTHER SCREEN IS NOT HERE, which is the half that bites.** A
       mutation handing this served key to `InvitationAnswer` draws „Ovaj poziv više ne stoji." -
       that screen finds nothing under it in the session's own list - and it would satisfy
       „something about an answer is on the screen" while saying the one false thing this
       arrangement exists to refuse. The same sentence is what `ServedTeamInvite` itself draws for
       a key the server does not say he is waiting on, so its absence is also the assertion that
       the two reads were joined rather than merely both made. */
    /* **THE THREE SENTENCES ARE NAMED RATHER THAN SWEPT FOR, AND THAT IS A MEASUREMENT OF
       28.09.2026 RATHER THAN A STEP BACK FROM THE DERIVED LIST.** A first draft asked the
       derived list for „nothing about a PAIR is claimed", which reads as the stronger form and
       is not: the two dictionaries SHARE their two button words. `teams.inviteAccept` and
       `pair.accept` are both „Prihvati", `teams.inviteRefuse` and `pair.refuse` are both
       „Odbij", so a sweep for the pair's words matches the team screen's own buttons, and the
       substring it was narrowed to („par") misses the one sentence that matters - „Ovaj poziv
       više nije otvoren." carries no such run. Measured: the derived list holds 33 sentences, 12
       of them carry „par", and `pair.inviteClosed` is not one of the 12.

       So each of the three is here by name, with what it would mean:
       - `teams.inviteClosed` is what `InvitationAnswer` draws for a key it cannot find in the
         SESSION's list, and what `ServedTeamInvite` draws for one the server does not say he is
         waiting on. Either way it is the sentence a member reads about a question
         `team_invitation` still holds open;
       - `teams.inviteGone` is that screen's other ending, a team that no longer exists;
       - `pair.inviteClosed` is `PairInviteAnswer`'s, for a served key handed to the wrong twin
         entirely. */
    for (const wrong of [sr.teams.inviteClosed, sr.teams.inviteGone, sr.pair.inviteClosed]) {
      expect(screen.queryByText(wrong), wrong).toBeNull()
    }

    /* **AND THE DERIVED LIST KEEPS A JOB IT CAN REALLY DO.** It is the dictionary's own, so a
       sentence written tomorrow is already on it; what it says here is that the screen claims
       SOMETHING an answer would say, which is the other half of „no wrong sentence is on it" -
       both are true of a screen that drew nothing at all, and only one of them is true of this
       one. „Odbij" is the word asked for because it is the only one true on both of the days
       this suite is read as (`test/theDay.ts`: 2026-09-30, outside the window, and 2027-11-01,
       inside it). */
    expect(WHAT_AN_ANSWER_WOULD_SAY.length).toBeGreaterThan(20)
    expect(whatTheScreenClaimsAboutAnAnswer()).toContain(sr.teams.inviteRefuse)
  })

  it('does offer an answer to a question about a racing pair, and says nothing about one', async () => {
    aServerWhere(him(), { [HIS_ADDRESS]: [A_PAIR_QUESTION] })

    renderAt(`/sr/poruke/${String(A_PAIR_QUESTION.id)}`, 'competitor', '000007')

    expect(theLoader()).not.toBeNull()

    await screen.findByRole('heading', { level: 1, name: A_PAIR_QUESTION.subject })

    /* **THIS CASE SAID THE OPPOSITE UNTIL 28.09.2026, AND THE DIFFERENCE IS PDL 27b.** It read
       „says nothing about an answer to a question about a racing pair either", and the boundary
       it held was real: `PUT /api/pairs/{id}` existed and nothing called it, so a served key
       given to `PairInviteAnswer` would have told a member his question was closed while the
       server held it open. The owner closed that boundary with a question -„Pod 1 ako to
       podrazumeva da clan moze klikom na dugme da prihvati ili odbije poziv?" - and
       `member/ServedPairInvite.tsx` is the screen it is owed. The case for the TEAM half above
       is untouched, and that is the measurement that matters: the two halves are answered by
       two different screens, and the team's route still needs a team no field here carries.

       **What is asked here is only that the buttons arrive**, because this file's question is
       whether the screen reading the server offers an answer at all. Which key reached which
       address, what each button sends, and what the member reads when the route turns him back
       are measured where the mechanism lives (`member/pairInviteAnswered.test.tsx`). */
    expect(theLoader()).toBeNull()
    expect(screen.getByRole('button', { name: sr.pair.accept })).toBeVisible()
    expect(screen.getByRole('button', { name: sr.pair.refuse })).toBeVisible()

    /* **AND THE SENTENCE OF THE OTHER SCREEN IS NOT HERE, which is the half that bites.** A
       mutation handing this served key to `PairInviteAnswer` draws „Ovaj poziv više nije
       otvoren." - that screen looks the key up in the session's own list and finds nothing -
       and it would satisfy „something about an answer is on the screen" while saying the one
       false thing this arrangement exists to refuse. So the closed sentence is asked for by
       name and its absence is the assertion. */
    expect(screen.queryByText(sr.pair.inviteClosed)).toBeNull()
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
       This case draws no `WritesIntoTheVisit`, so nothing calls `notify` in it, and since
       28.09.2026 the provider seeds nothing at all (PDL 34): `GET /api/inbox` is the one place
       this subject can have come from at any point in the walk. Take the server read out of
       either screen and this goes red at the first assertion, before the walk even starts.

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

describe('the inbox when somebody else signs in without signing out first', () => {
  /* VISOK, review of PR 406. `app/Shell.tsx` draws `<MessagesMenu />` for every non-empty
     `signedIn`, and `member/SignIn.tsx` carries no guard of its own against being reached
     while somebody is already signed in - so one visit can hold two members without the
     header ever unmounting. `data/useResource.ts` reads its cached answer once, in
     `useState(() => atHand(name))`, and never again while the SAME component instance stays
     mounted: `theInboxNowBelongsTo` clears the cache the moment the caller changes, but
     nothing told the already mounted panel to read it again. Measured on the head of this
     branch before the fix below: the panel went on naming HIS message after SHE had signed
     in, `GET /api/inbox` was asked once and only for him, and the envelope counted his
     unread mail as hers. */
  it('the panel above every screen answers for whoever is signed in now, not whoever it was drawn for first', async () => {
    const user = setupUser()

    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED], [HER_ADDRESS]: [HERS] })

    renderAt('/sr', 'competitor', '000007', undefined, null, (
      <SignInAsWithoutSigningOut memberNumber="000009" address={HER_ADDRESS} />
    ))

    await user.click(await theEnvelope())
    expect(await screen.findByRole('link', { name: new RegExp(FORGED.subject) })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'sign in as somebody else, in place' }))

    /* Checked before the panel is reopened, so a stale instance that never remounted cannot
       hide behind the dropdown's own `hidden` and still pass this: the span is either gone
       because a fresh mount never drew it, or it is sitting there whether the panel is open
       or not. */
    expect(screen.queryByText(FORGED.subject)).not.toBeInTheDocument()

    await user.click(await theEnvelope())

    expect(await screen.findByRole('link', { name: new RegExp(HERS.subject) })).toBeVisible()
    expect(asksFor('/api/inbox')).toBeGreaterThan(1)
  }, SLOW * 2)

  /* The same fault, on the screen rather than the panel: `Messages.tsx`'s `TheWholeInbox`
     calls `useInbox(mine)` once and, without the fix, holds the same `useResource` instance
     across a caller switch that never routes it away. Reached on `/sr/poruke` and never
     navigated off it, so the remount routing would otherwise give this screen for free
     cannot be the reason this one passes.
   *
     **Read through `main` and not through the whole document, and that is measured rather
     than tidiness.** `MessagesMenu` sits above every screen and carries its own span of the
     same subject text; a case that reverted only this screen's key still failed here until
     the query was scoped, because `queryByText` found the panel's stale span instead of
     saying anything about this screen at all. */
  it('the inbox screen does not go on showing what was fetched for the person before', async () => {
    const user = setupUser()

    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED], [HER_ADDRESS]: [HERS] })

    renderAt('/sr/poruke', 'competitor', '000007', undefined, null, (
      <SignInAsWithoutSigningOut memberNumber="000009" address={HER_ADDRESS} />
    ))

    const main = () => within(screen.getByRole('main'))

    expect(await main().findByRole('link', { name: FORGED.subject })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'sign in as somebody else, in place' }))

    expect(main().queryByText(FORGED.subject)).not.toBeInTheDocument()
    expect(await main().findByRole('link', { name: HERS.subject })).toBeVisible()
  }, SLOW * 2)

  /* And the third door, `MessageDetail.tsx`'s `TheMessageAsked`: measured to reach the exact
     same place as the two above it - a fresh read, and `NotFound` once the message stops
     being this caller's - and then reverted, because `NotFound`'s own redirect went on to
     race a navigation `teamInvite.test.tsx` had already started on this very screen, and won
     it three times over (twenty second timeouts, `TeamDetail` never even called). `useInbox`
     here is called `{ reactive: false }` on purpose (review of PR 406, second round; the doc
     on `TheMessageAsked` carries the measurement in full), and this case is what keeps that
     boundary from drifting back without the same measurement being repeated.

     **WHAT THIS CASE CLAIMS IS NARROWER THAN ITS OLD NAME SAID, and the difference is measured
     rather than cautious (28.09.2026).** It used to be called „does not react to a caller
     switch", under a sentence saying production has no road to this switch on this screen AT
     ALL. The second half of that is still the honest state of a search - no production road was
     found, and `data/useResource.ts` names above `useInbox` exactly what was searched - but the
     first half is not a property of this screen. `{ reactive: false }` holds the OWNER and
     nothing else, and `useInbox` hands `revision` to every caller whatever `reactive` is: with
     the cache already dropped by the switch, the next bump of that number re-reads and is
     answered with the NEW caller's mail, so this screen does reach `NotFound` and its redirect.
     What bumps it here is this screen's own read receipt (`member/inboxRead.ts`), so the window
     is the gap between the switch and the moment that receipt settles. Measured with the receipt
     held open until after the click: the message goes within twenty five milliseconds and the
     router lands on „/".

     So what is really being held here is „once its own receipt has settled, a caller switch
     alone does not move it", which is the half `{ reactive: false }` is responsible for, and it
     was measured on its own: with a row that arrives already read, so nothing is ever written
     and the revision never moves, this screen did not move either. */
  it('holds its message through a caller switch once its own read receipt has settled', async () => {
    const user = setupUser()

    aServerWhere(him(), { [HIS_ADDRESS]: [FORGED], [HER_ADDRESS]: [HERS] })

    renderAt(`/sr/poruke/${String(FORGED.id)}`, 'competitor', '000007', undefined, null, (
      <SignInAsWithoutSigningOut memberNumber="000009" address={HER_ADDRESS} />
    ))

    expect(await screen.findByRole('heading', { level: 1, name: FORGED.subject })).toBeVisible()
    expect(screen.getByText(FORGED.body)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'sign in as somebody else, in place' }))

    /* **Held rather than waited for, and that is a measurement rather than a stronger word for
       the same thing.** What stood here was `waitFor`, under a comment saying it would catch a
       screen that reacted and corrected itself a tick later. It would not: `waitFor` answers „has
       this BECOME true" and nothing else, so it is satisfied by a heading that was absent when it
       started and arrived 300 ms later. Measured both ways on 28.09.2026 - a late arrival PASSES
       `waitFor` and FAILS this; and with the read receipt of this screen's own effect released a
       tick after the click, `waitFor` PASSED while the router had already been sent to „/".

       The window that receipt opens is named over this case rather than repeated here, and it is
       why this reads „once its own read receipt has settled": on a quiet machine it settles long
       before this click and nothing moves, which is why this is green. */
    await itStays(() => {
      expect(screen.getByRole('heading', { level: 1, name: FORGED.subject })).toBeVisible()
      expect(screen.getByText(FORGED.body)).toBeVisible()
    })
  }, SLOW * 2)
})

describe('an account the league has given no number', () => {
  /* **Two cases here and not one, and the second exists because a mutation survived the
     first.** The gate stands on both screens and each has its own; taking only the detail
     screen's out left every case green, because the case below it walks the LIST. A gate
     measured on one of two screens is a gate measured on one of two screens. */
  it('opening one message is told this part is for competitors, and asks for no inbox', async () => {
    aServerWhere({ role: 'moderator', account: 4 }, { [HIS_ADDRESS]: [FORGED] })

    renderAt(`/sr/poruke/${String(FORGED.id)}`, 'moderator', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: sr.signIn.noRecord }),
    ).toBeVisible()
    expect((server?.asked ?? []).map((one) => one.path)).not.toContain('/api/inbox')
  })

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
