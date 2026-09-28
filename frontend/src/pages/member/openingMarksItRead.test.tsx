import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderAt } from '../../test/render'
import {
  answeredWith,
  did,
  forgetEveryCookie,
  serverThat,
  type Asked,
} from '../../test/serverAnswers'
import { FIRST_MESSAGES } from '../../data/seedMessages'
import { SLOW } from '../../test/slow'
import { translate } from '../../i18n/translate'
import sr from '../../i18n/sr.json'

/**
 * OPENING A MESSAGE IS WHAT MARKS IT READ, AND NOTHING ELSE IS.
 *
 * <p><b>Owner, PDL 27a, 27.09.2026, narrowing the outcome he chose in his own words:</b> „Ako
 * pod 1 spada pokrivanje funkcionalnosti na pravi nacin tako da kad clan otvori poruku ona
 * stvarno postaje procitana, onda da. Ne treba mi dugme da se nesto oznaci kao procitano ili
 * neprocitano." Two things, and the second is a refusal of what the portal HAD: there is one
 * trigger, and there is no control for it anywhere - „ni za posluzenu poruku ni za onu koja
 * zivi u poseti".
 *
 * <p><b>THE SERVER HERE IS A STATE MACHINE OVER READ MARKS, and that is the whole reason this
 * file can say anything.</b> `POST /api/inbox/{id}/read` writes a row and the NEXT
 * `GET /api/inbox` answers `read: true` because of it. A fake server that answered a fixed
 * body could not tell „the portal asked the server and read the answer" from „the portal
 * decided on its own that this is read now", which are exactly the two things 27a is about -
 * the whole point of the decision is that the mark survives signing out, and a mark the
 * browser invented does not.
 *
 * <p><b>And the marks are kept PER READER, keyed by address and message.</b> V13's own comment
 * on `message_read`: unread is the absence of a row, so an announcement reaches the whole
 * league without writing a row per member. One member opening the league's announcement must
 * not mark it read for anybody else, and a store keyed by message alone would pass every case
 * here while getting that exactly wrong.
 */

const HIS_ADDRESS = 'ja@primer.rs'
const HER_ADDRESS = 'ona@primer.rs'

const HIM = { role: 'competitor', account: 1, member: { memberNumber: '000007' } }

/**
 * THE ONE HE OPENS, and it is deliberately NOT FIRST in any list this file serves.
 *
 * <p><b>Because „the message this screen is showing" and „the first message in the inbox" are
 * two different values that a fixture of one message makes identical.</b> A screen that posted
 * `lines[0].id` instead of the key in the address would pass every case built on a single
 * message, and would mark the wrong message read the moment a member had two. The source-swap
 * mutation is exactly that - `id` for `lines[0].id` - and it has to have somewhere to land.
 */
const OPENED = {
  id: 612,
  from: 'Balkanska trkačka liga',
  subject: 'Fotografija nije prihvaćena',
  body: 'Slika je odbijena jer lice nije jasno vidljivo. Pošalji drugu.',
  date: '2026-09-20',
  read: false,
  teamInvitationId: null,
  pairInviteId: null,
}

/**
 * THE ONE THAT SITS ABOVE IT AND IS NEVER OPENED. Newer, so `newestFirst` really does put it
 * first, and unread, so it goes on carrying one of the two the envelope counts.
 */
const NEVER_OPENED = {
  ...OPENED,
  id: 611,
  subject: 'Prijava za trku je primljena',
  date: '2026-09-27',
}

/** ALREADY READ WHEN IT ARRIVES, which is the second state of the axis „what was it before".
 *  Opening this one must ask the server for nothing at all. */
const ALREADY_READ = {
  ...OPENED,
  id: 613,
  subject: 'Članarina je evidentirana',
  date: '2026-09-19',
  read: true,
}

/**
 * ADDRESSED TO THE WHOLE LEAGUE, which on the wire is indistinguishable from one addressed to
 * him - `to_id` never leaves the server (`InboxApi`) - and is therefore a fact only the fake
 * server below can hold. It is served to both of them, and reading it is per reader.
 */
const TO_EVERYBODY = {
  ...OPENED,
  id: 614,
  subject: 'Raspored sezone je objavljen',
  date: '2026-09-18',
}

let server: { asked: Asked[]; stop: () => void } | null = null

/** Which reader has read which message, as the server keeps it: a row is its presence.
 *  Keyed by address AND message, for the reason written at the top of this file. */
let marks = new Set<string>()

/** Whose mail is being served, which only signing in changes. */
let serving = HIS_ADDRESS

/** Which of the two the route is willing to write for. `null` is „every one of them", and a
 *  set is how the case about a message that is not his says so without touching the reader. */
let theRouteRefuses: number[] = []

/**
 * A server that keeps read marks.
 *
 * @param inboxes what `GET /api/inbox` answers, by address. The `read` field of each row is
 *                OVERWRITTEN from `marks` on the way out, which is what makes the second read
 *                of the same inbox a different answer from the first.
 */
function aServerKeepingMarks(inboxes: Record<string, unknown[]>): void {
  marks = new Set()
  serving = HIS_ADDRESS
  theRouteRefuses = []

  let open = true
  let holder: unknown = HIM

  server = serverThat((path, init) => {
    if (path === '/api/me') {
      return open
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
      serving = String(email)
      holder =
        email === HER_ADDRESS
          ? { role: 'competitor', account: 2, member: { memberNumber: '000009' } }
          : HIM

      return did()
    }

    if (path === '/api/sign-out') {
      open = false

      return did()
    }

    if (path === '/api/inbox') {
      /* **The mark is applied on the way out rather than stored on the row**, so that one
         announcement served to two readers carries a different `read` for each of them off
         ONE fixture. Written into the fixture instead, the broadcast case would be measuring
         a copy per reader, which is the very thing V13 refuses to keep. */
      const rows = (inboxes[serving] ?? []).map((row) =>
        typeof row === 'object' && row !== null
          ? {
              ...row,
              /* **THE FIXTURE'S OWN MARK IS KEPT AND THIS ONE IS ADDED TO IT, not substituted
                 for it.** Written as a plain `marks.has(...)`, this overwrote a row that arrives
                 ALREADY READ - and the case about such a row caught it: the screen posted for a
                 message the server had had read all along, because the server had stopped saying
                 so. A row already read is one of the two states of „what was it before opening",
                 so a harness that cannot express it takes half this file's subject away. */
              read:
                Reflect.get(row, 'read') === true ||
                marks.has(`${serving}:${String(Reflect.get(row, 'id'))}`),
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
      const id = Number(reading[1])

      /* **404 AND NOT 403, which is the route's own answer and ADL A8's**: a message that is
         somebody else's and one that does not exist are told the identical nothing, so a
         member walking keys learns nothing about which of them belong to anybody. */
      if (theRouteRefuses.includes(id)) {
        return answeredWith(404)
      }

      marks.add(`${serving}:${String(id)}`)

      return did()
    }

    return null
  })
}

/** What the route was asked to mark, in order. Read off the requests rather than off the
 *  marks, because „it asked and was refused" and „it never asked" are two different things
 *  and the marks cannot tell them apart. */
function whatWasMarked(): string[] {
  return (server?.asked ?? [])
    .filter((one) => /^\/api\/inbox\/\d+\/read$/.test(one.path))
    .map((one) => one.path)
}

/**
 * HOW MANY TIMES THE INBOX ITSELF WAS READ, which is the only thing that can tell a refused
 * write from an accepted one.
 *
 * <p><b>Written because a mutation survived without it, and the mutation was the one this file
 * cares most about.</b> Claiming the read mark on the ASKING rather than on the ANSWERING -
 * `if (answer.got === 'done')` turned into `if (true)` - left all eight cases green. The reason
 * is a fault in the setting rather than in the assertion: after a refusal the server's answer is
 * unchanged, so „2 unread" is what the envelope says whether the portal dropped its cache or
 * not. The number the assertion read could have come from either behaviour, so it distinguished
 * neither.
 *
 * <p>What the two behaviours really differ by is a REQUEST: dropping the cache and bumping the
 * revision sends this screen back to the server, and a refusal must not. So the pair of cases
 * below states this number exactly - one read where the write was refused, two where it was
 * accepted - and each of them is the floor under the other.
 */
function inboxReads(): number {
  return (server?.asked ?? []).filter((one) => one.path === '/api/inbox').length
}

/**
 * THE ENVELOPE ABOVE EVERY SCREEN, AND WHAT IT SAYS, as a screen reader is given it.
 *
 * <p><b>Found by the words it always carries and then asked what its whole name is, rather than
 * queried by the whole name at once.</b> Two measurements put it this way round. A query for the
 * finished sentence answers „unable to find" for every wrong count alike, and the DOM it prints
 * is truncated well before the header - so a count that was one out looked exactly like an
 * envelope that was not drawn at all. And the count is IN the accessible name rather than beside
 * it, on purpose (`app/MessagesMenu.tsx`: an `aria-label` replaces everything inside the
 * button), so there is no separate node to read it off.
 *
 * <p><b>And the sentence is built by the portal's own `translate` rather than written out here</b>,
 * because Serbian picks a different form at 0, 1 and 2 and this file asserts all three.
 * „nepročitana", „nepročitane" and „nepročitanih" written by hand is a fourth home for the
 * plural rule, and the first draft of this helper got 0 wrong.
 */
function theEnvelope(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: new RegExp(sr.shell.openMessages) })
}

/**
 * WHAT THE ENVELOPE SAYS WHEN THIS MANY SERVED MESSAGES ARE UNREAD.
 *
 * <p><b>The held half is added in here rather than into each number, and it is READ OFF THE SEED
 * rather than remembered.</b> Every screen of this file draws both halves of the inbox: what the
 * server answered, and what `data/seedMessages.ts` addresses to the whole league. One of those
 * seeded records is unread, so every count in this file is „the served ones, plus that". Written
 * as a bare number per case, each of them would be an unexplained arithmetic that the next reader
 * has to rediscover - and the first draft of this file got all five wrong in the same direction.
 *
 * <p><b>Derived, so that the day somebody marks that seeded record read or adds a second, this
 * file moves with it</b> instead of going red five times over something that is not its subject.
 * A broadcast (`to: ''`) is counted for every member; anything addressed to one member is not
 * this reader's business, which is the provider's own filter (`session/SessionProvider.tsx`).
 */
function saysUnread(served: number): string {
  const held = FIRST_MESSAGES.filter((one) => one.to === '' && !one.read).length

  return `${sr.shell.openMessages}, ${translate(sr, 'sr', 'shell.unread', { count: served + held })}`
}

/** The list item one subject stands in, so that what is asserted about a message is read off
 *  that message and not off the page. Copied from `member/inboxFromTheServer.test.tsx` rather
 *  than reinvented, and it exists because the header is a button too: „Otvori poruke, 2
 *  nepročitane" carries the word this file would otherwise have queried by, on every screen. */
function rowOf(subject: string | RegExp): HTMLElement {
  const row = screen.getByRole('link', { name: subject }).closest('li')

  if (row === null) {
    throw new Error(`the subject "${String(subject)}" is not drawn inside a row`)
  }

  return row
}

beforeEach(() => {
  /* THE TOKEN, because `askTheServer` asks for one before every write and jsdom keeps cookies
     for the whole file. Without it the write still goes out - the file says so in its own words
     - but it spends a read on the way, which would make „how many requests did this cost"
     unreadable in the cases below. The sibling file sets it for the same reason. */
  forgetEveryCookie()
  document.cookie = 'XSRF-TOKEN=imam'
})

afterEach(() => {
  server?.stop()
  server = null
})

describe('a served message the member opens', () => {
  it('is marked read on the server, and the envelope above every screen falls by one', async () => {
    aServerKeepingMarks({ [HIS_ADDRESS]: [NEVER_OPENED, OPENED] })

    renderAt(`/sr/poruke/${String(OPENED.id)}`, 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: OPENED.subject })

    /* **THE KEY IN THE ADDRESS AND NOT THE FIRST ROW OF THE INBOX**, which is why the fixture
       serves two and the opened one is second. `lines[0].id` here is 611. */
    await waitFor(() => {
      expect(whatWasMarked()).toEqual([`/api/inbox/${String(OPENED.id)}/read`])
    })

    /* And the count really falls, which is the half no assertion about the request can make:
       two unread arrived, one was opened, and the number the header draws comes from the
       server's own second answer. */
    expect(await theEnvelope()).toHaveAccessibleName(saysUnread(1))

    /* **AND IT WENT BACK TO THE SERVER TO LEARN THAT, which is the half the count cannot say.**
       Two reads: the one every screen of this portal makes at mount, and the one the accepted
       write asked for by dropping the cache. The refusal case below states the same number as
       ONE, and that pair is what makes „claimed on the answering and not on the asking"
       measurable at all - see `inboxReads`. */
    expect(inboxReads()).toBe(2)
  }, SLOW * 2)

  it('is asked about once even though the answer makes this screen read the inbox again', async () => {
    aServerKeepingMarks({ [HIS_ADDRESS]: [NEVER_OPENED, OPENED] })

    renderAt(`/sr/poruke/${String(OPENED.id)}`, 'competitor', '000007')

    await waitFor(() =>
      expect(screen.getByRole('button', { name: new RegExp(sr.shell.openMessages) })).toHaveAccessibleName(
        saysUnread(1),
      ),
    )

    /* **A floor under the mechanism rather than a tidiness check.** A successful write drops
       the cached inbox and bumps the revision on purpose, so this screen reads the server
       again and sees the mark it has just written - that is what stops its own effect. Held
       for a beat after the count has already fallen, because a second ask would land in the
       tick after the re-read. */
    await new Promise((settle) => setTimeout(settle, 0))

    expect(whatWasMarked()).toHaveLength(1)
  }, SLOW * 2)

  it('is left alone where the route refuses it, and the envelope goes on counting it', async () => {
    aServerKeepingMarks({ [HIS_ADDRESS]: [NEVER_OPENED, OPENED] })
    /* SOMEBODY ELSE'S MESSAGE, as the route answers one: 404, the same nothing an address
       that is not there gives. The screen still drew it because this fake inbox served it;
       what is being measured is what the portal does when the WRITE is refused. */
    theRouteRefuses = [OPENED.id]

    renderAt(`/sr/poruke/${String(OPENED.id)}`, 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: OPENED.subject })

    await waitFor(() => {
      expect(whatWasMarked()).toHaveLength(1)
    })

    /* **THE AXIS THIS FILE CANNOT GET WRONG: a refusal must leave the count exactly as the
       server last said it was.** Both unread, still. */
    expect(await theEnvelope()).toHaveAccessibleName(saysUnread(2))

    /* Settled, so that a read arriving a tick late is inside this case rather than after it. */
    await new Promise((settle) => setTimeout(settle, 0))

    /* And it does not hammer the route it was refused by. */
    expect(whatWasMarked()).toHaveLength(1)

    /* **AND THIS IS WHAT THE COUNT ABOVE CANNOT SAY, measured because a mutation proved it.**
       Turning „the server agreed" into „always" left every case here green: after a refusal the
       server's answer has not changed, so the envelope reads „2 unread" whether the portal threw
       its cache away or not. The two behaviours differ by a REQUEST and by nothing else - ONE
       read here against TWO in the accepted case above - so this is the assertion that tells them
       apart, and `inboxReads` says why it had to be written. */
    expect(inboxReads()).toBe(1)
  }, SLOW * 2)

  it('asks nothing at all when the server already had it read', async () => {
    aServerKeepingMarks({ [HIS_ADDRESS]: [NEVER_OPENED, ALREADY_READ] })

    renderAt(`/sr/poruke/${String(ALREADY_READ.id)}`, 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: ALREADY_READ.subject })

    /* One unread arrived and one was already read, so the count is the floor under this: it
       says the inbox really landed before the absence below was asserted. */
    expect(await theEnvelope()).toHaveAccessibleName(saysUnread(1))

    expect(whatWasMarked()).toEqual([])
  }, SLOW * 2)
})

describe('a message the browser is holding', () => {
  it('is marked in the visit and the server is not asked about it', async () => {
    /* **ONE SERVED ROW, ALREADY READ AND DATED AFTER THE HELD ONE**, so that the key this
       screen opens is not also `lines[0]` once the two halves are sorted together - the
       collision a mutation found (review of PR 415). Nothing served at all left the held
       line named in the address as the only unread line on the whole screen, so it was
       also the newest, so `lines[0].id` and the key in the address were one and the same
       value: `markRead(id)` written as `markRead(lines[0].id)` had nowhere to be wrong.
       This row is what `OPENED` is for the served half above (line 55) - it exists so the
       message being opened is not first.

       Already read, and dated after the seed rather than before it, so nothing here moves
       the count this case ends on: it arrives read, stays read, and is never opened, same
       as `ALREADY_READ` behaves in the served cases above. A row still unread when the
       case ends would change what „nought" below has to mean; this one does not. */
    aServerKeepingMarks({ [HIS_ADDRESS]: [ALREADY_READ] })

    const seeded = 'msg-1'

    renderAt(`/sr/poruke/${seeded}`, 'competitor', '000007')

    await screen.findByRole('heading', {
      level: 1,
      name: /Dobro došao u pripremu sezone/,
    })

    /* **The count falling to NOUGHT is what says the mark landed**, and it landed in the
       session: nothing was sent. A screen that sent `POST /api/inbox/msg-1/read` would be asking
       the server about a key it has never heard of, and one that sent nothing AND marked nothing
       would leave this at one.

       Written out rather than through `saysUnread`, and that is the difference this case turns
       on: every other count in this file is „served, plus the held one that is always there",
       while here the held one is the very message being opened. So nought is nought on both
       halves, and a helper that added the seed back in would be asserting the opposite of the
       point. */
    expect(await theEnvelope()).toHaveAccessibleName(
      `${sr.shell.openMessages}, ${translate(sr, 'sr', 'shell.unread', { count: 0 })}`,
    )

    expect(whatWasMarked()).toEqual([])
  }, SLOW * 2)
})

describe('what the portal offers for saying so by hand', () => {
  it('offers nothing, on either half of the list', async () => {
    /* **Both halves in one case, because the owner refused it for both in one sentence.** The
       served row is unread and so is the seeded broadcast the browser holds, so a screen that
       kept the old button for „whichever one the portal is the store of" still fails here. */
    aServerKeepingMarks({ [HIS_ADDRESS]: [OPENED] })

    renderAt('/sr/poruke', 'competitor', '000007')

    await screen.findByRole('link', { name: OPENED.subject })

    /* A floor under the absence: the seeded held line is on this screen too, so both states of
       „where does the mark live" are really drawn here. */
    expect(screen.getByRole('link', { name: /Dobro došao u pripremu sezone/ })).toBeVisible()

    /* **ASKED OF THE LIST ITSELF AND NOT OF THE DOCUMENT, which is a measurement rather than
       caution.** A first draft asked the whole page for a button named `/pročitan/i` and it
       FAILED on the right code: the envelope in the header is a button whose accessible name is
       „Otvori poruke, 2 nepročitane", so a query by that word finds the header on every screen
       of the portal. The count in that name is exactly why `app/MessagesMenu.tsx` puts it
       there, so the collision is permanent and not a fixture's fault.

       **And it is asked as „no buttons at all" rather than „no button called X".** The name is
       gone from the dictionary in this very commit, so a query for the literal „Označi kao
       pročitano" would go on passing for ever whatever the screen drew - a case that cannot
       fail. What a row of this list may carry is a link to the message and nothing else. */
    expect(within(rowOf(OPENED.subject)).queryAllByRole('button')).toEqual([])
    expect(within(rowOf(/Dobro došao u pripremu sezone/)).queryAllByRole('button')).toEqual([])
  }, SLOW * 2)
})

describe('an announcement two members are both served', () => {
  it('is read by the one who opened it and still unread for the other', async () => {
    aServerKeepingMarks({
      [HIS_ADDRESS]: [NEVER_OPENED, TO_EVERYBODY],
      [HER_ADDRESS]: [TO_EVERYBODY],
    })

    renderAt(`/sr/poruke/${String(TO_EVERYBODY.id)}`, 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: TO_EVERYBODY.subject })

    /* He has read it: two arrived and one is left. */
    expect(await theEnvelope()).toHaveAccessibleName(saysUnread(1))

    expect(whatWasMarked()).toEqual([`/api/inbox/${String(TO_EVERYBODY.id)}/read`])

    /* **AND NOW HER, AS A SECOND VISIT TO THE SAME SERVER**, which is what makes this a
       question about what the SERVER kept rather than about what a screen redrew. A row in
       `message_read` names the reader (V13), so his reading marks nothing for her; a server
       - or a portal - that kept read marks by message alone would answer hers read here and
       every case above this one would still be green.

       Torn down and rendered again rather than switched in place: switching identity without
       signing out is its own mechanism with its own race, and
       `member/inboxFromTheServer.test.tsx` owns that walk. What is wanted here is a fresh
       reader asking the same server, which is what signing in on another machine is. */
    cleanup()
    serving = HER_ADDRESS

    renderAt('/sr/poruke', 'competitor', '000009')

    await screen.findByRole('link', { name: TO_EVERYBODY.subject })

    /* **Hers is the one announcement and it is STILL UNREAD**, which is the whole case: his
       reading of it wrote a row naming him, and a row naming him says nothing about her. One
       served, unread, plus the seeded broadcast she is served too. */
    expect(await theEnvelope()).toHaveAccessibleName(saysUnread(1))
  }, SLOW * 2)
})

describe('an account the league has given no number', () => {
  it('is asked about no message at all', async () => {
    /* A moderator with no competitor row behind him, „which is the ordinary case and not a
       fault" (V23, quoted by `InboxReadApi`). `GET /api/inbox` tells him the address is not
       there, so `app/MessagesMenu.tsx` draws the empty panel and no screen of his ever holds
       a line to open. */
    aServerKeepingMarks({})

    renderAt('/sr/poruke', 'moderator', null)

    await screen.findByRole('heading', { level: 1 })

    expect(whatWasMarked()).toEqual([])
  }, SLOW * 2)
})
