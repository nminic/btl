import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderAt } from '../../test/render'
import { answeredWith, did, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
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

/** Obviously a test and not anybody's password. */
const TYPED_PASSWORD = 'ovo-je-probna-lozinka-123'

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
          ? { ...row, read: marks.has(`${serving}:${String(Reflect.get(row, 'id'))}`) }
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

/** The envelope above every screen, by the name a screen reader is given. The count is IN the
 *  name and not beside it (`app/MessagesMenu.tsx` says why), so this is the one query that
 *  reads it. */
function theEnvelope(count: number): Promise<HTMLElement> {
  return screen.findByRole('button', {
    name: `${sr.shell.openMessages}, ${String(count)} ${count === 1 ? 'nepročitana' : 'nepročitane'}`,
  })
}

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
    expect(await theEnvelope(1)).toBeVisible()
  })

  it('is asked about once even though the answer makes this screen read the inbox again', async () => {
    aServerKeepingMarks({ [HIS_ADDRESS]: [NEVER_OPENED, OPENED] })

    renderAt(`/sr/poruke/${String(OPENED.id)}`, 'competitor', '000007')

    await theEnvelope(1)

    /* **A floor under the mechanism rather than a tidiness check.** A successful write drops
       the cached inbox and bumps the revision on purpose, so this screen reads the server
       again and sees the mark it has just written - that is what stops its own effect. Held
       for a beat after the count has already fallen, because a second ask would land in the
       tick after the re-read. */
    await new Promise((settle) => setTimeout(settle, 0))

    expect(whatWasMarked()).toHaveLength(1)
  })

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
       server last said it was.** Both unread, still. A portal that dropped its cache on the
       asking rather than on the answering would draw „1" here and be lying about the one
       number PDL 27a exists to make true. */
    expect(await theEnvelope(2)).toBeVisible()

    /* And it does not hammer the route it was refused by. */
    await new Promise((settle) => setTimeout(settle, 0))

    expect(whatWasMarked()).toHaveLength(1)
  })

  it('asks nothing at all when the server already had it read', async () => {
    aServerKeepingMarks({ [HIS_ADDRESS]: [NEVER_OPENED, ALREADY_READ] })

    renderAt(`/sr/poruke/${String(ALREADY_READ.id)}`, 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: ALREADY_READ.subject })

    /* One unread arrived and one was already read, so the count is the floor under this: it
       says the inbox really landed before the absence below was asserted. */
    expect(await theEnvelope(1)).toBeVisible()

    expect(whatWasMarked()).toEqual([])
  })
})

describe('a message the browser is holding', () => {
  it('is marked in the visit and the server is not asked about it', async () => {
    /* NOTHING SERVED AT ALL, so the only unread line on this screen is the one
       `data/seedMessages.ts` addresses to the whole league - a held line, whose key is text
       and names no row on any server. */
    aServerKeepingMarks({ [HIS_ADDRESS]: [] })

    const seeded = 'msg-1'

    renderAt(`/sr/poruke/${seeded}`, 'competitor', '000007')

    await screen.findByRole('heading', {
      level: 1,
      name: /Dobro došao u pripremu sezone/,
    })

    /* **The count falling is what says the mark landed**, and it landed in the session:
       nothing was sent. A screen that sent `POST /api/inbox/msg-1/read` would be asking the
       server about a key it has never heard of, and one that sent nothing AND marked nothing
       would leave this at one. */
    expect(await theEnvelope(0)).toBeVisible()

    expect(whatWasMarked()).toEqual([])
  })
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

    /* **Read off the dictionary rather than by the words**, so that the sentence being gone
       from `sr.json` cannot make this case vacuous: `messages.markRead` no longer exists, and
       a query for a literal „Označi kao pročitano" would go on passing for ever whatever the
       screen drew. What is asked instead is that the list offers NO button at all - the only
       controls on this screen are links to the messages. */
    expect(screen.queryAllByRole('button', { name: /pročitan/i })).toEqual([])

    const onTheList = screen
      .getAllByRole('button')
      .map((one) => one.getAttribute('aria-label') ?? one.textContent)

    /* And the buttons that ARE on the page are the header's, every one of them: the envelope,
       the account menu, the language and the day switch. None belongs to a row. */
    expect(onTheList.filter((one) => one !== null && /poruk/i.test(one))).toEqual([
      `${sr.shell.openMessages}, 2 nepročitane`,
    ])
  })
})

describe('an announcement two members are both served', () => {
  it('is read by the one who opened it and unread for the other', async () => {
    const user = setupUser()

    aServerKeepingMarks({
      [HIS_ADDRESS]: [NEVER_OPENED, TO_EVERYBODY],
      [HER_ADDRESS]: [TO_EVERYBODY],
    })

    renderAt(`/sr/poruke/${String(TO_EVERYBODY.id)}`, 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: TO_EVERYBODY.subject })

    /* He has read it: two arrived, one is left. */
    expect(await theEnvelope(1)).toBeVisible()

    /* **AND NOW HER, through the portal's own sign in rather than a fake session**, because
       the fact being measured is what the SERVER keeps: a row in `message_read` names the
       reader, so his reading marks nothing for her. A portal that kept read marks by message
       alone would show her nought here, and every case above it would still be green. */
    await user.click(screen.getByRole('button', { name: sr.shell.openAccount }))
    await user.click(screen.getByRole('link', { name: sr.shell.signOut }))

    await screen.findByRole('link', { name: sr.shell.signIn })

    await user.click(screen.getByRole('link', { name: sr.shell.signIn }))
    await user.type(await screen.findByLabelText(sr.signIn.email), HER_ADDRESS)
    await user.type(screen.getByLabelText(sr.signIn.password), TYPED_PASSWORD)
    await user.click(screen.getByRole('button', { name: sr.signIn.submit }))

    /* Hers is the one announcement and it is still unread, plus the seeded broadcast the
       browser holds for her too. */
    expect(await theEnvelope(2)).toBeVisible()
  })
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
  })
})
