import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Competitor } from '../../data/types'
import { clearResourceCache } from '../../data/client'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { aCompetitor } from '../../test/theAnswer'
import sr from '../../i18n/sr.json'
import { translate } from '../../i18n/translate'
import { SLOW } from '../../test/slow'
import { inside, SEP, sources, WHOLE_PORTAL } from '../../test/sources'
import { setupUser } from '../../test/user'
import { useSession } from '../../session/useSession'

/* Changing what a member wrote about themselves, after joining.
 *
 * Owner, 15.08.2026, asked what should happen to somebody whose biography was
 * refused: „Panel u Podešavanjima, kao za sliku." Until then a refusal reached
 * the member with a reason they had nowhere to act on, and the screen said so.
 *
 * These follow the shape of the picture panel's tests, and for the same reason
 * they were written that way: what has to be proved is the errand, not the
 * markup. Nothing here navigates in order to prove that the queue is read
 * afresh, because in this suite `router.navigate` does not unmount the screen,
 * so a component holding its own state passes such a test (profilePicture.test).
 *
 * **AND SINCE 28.09.2026 THE ERRAND REALLY LEAVES THE BROWSER.** `send` called `propose`,
 * which writes into the session overlay, so the text died with the tab and the moderator's
 * card was the browser's own making. It goes to `PUT /api/me` now, so every assertion about
 * the SENDING is read off a recording server rather than off the panel: the panel looked
 * exactly the same before the change as it does after - „čeka odobrenje", focus moved, the
 * words shown back - which is `profilePicture.test.tsx`'s own reason for reading the request.
 */

const members: Competitor[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)

/** Somebody who has written one, and somebody who has not, taken out of the
 *  file rather than named here: if the seed changes, this says so instead of
 *  passing.
 *
 *  Whether the fee is standing is not asked any more, because there is nothing
 *  left to ask it of: `/api/competitors` answers only for members whose fee is
 *  (owner, 13.09.2026), so being in the list IS the condition this used to spell
 *  out as `one.active`.
 *
 *  **NEITHER IS THE FIRST ROW OF THE FILE, AND THAT IS A MEASUREMENT RATHER THAN A
 *  PREFERENCE.** `find` alone answered `000001` for the member with a biography, which IS
 *  `members[0]`, so „the panel drew MY record" and „the panel drew the first record it could
 *  find" were the same assertion and a swap between them was invisible. Measured on the seed:
 *  twelve members carry one and twenty do not, so skipping the head costs nothing. */
const notTheFirstRow = (one: Competitor) => one.memberNumber !== members[0]?.memberNumber

const withOne = must(
  members.find((one) => (one.bio ?? '').trim() !== '' && notTheFirstRow(one)),
  'a member whose profile carries a biography and is not the first row',
)
const withNone = must(
  members.find((one) => (one.bio ?? '').trim() === '' && notTheFirstRow(one)),
  'a member whose profile carries none and is not the first row',
)

/** A THIRD MEMBER WHO HAS NOTHING TO DO WITH EITHER, for the one axis a case with two people
 *  in it cannot measure: a mark that cleared on anybody's decision, or was shown to whoever
 *  happened to be signed in, passes every case that only ever has the sender in it. */
const somebodyElse = must(
  members.find((one) => one !== withOne && one !== withNone && notTheFirstRow(one)),
  'a third member',
)

/** The key the route answers with for the row it filed. A number, because
 *  `MeWriteApi.Changed.waiting` is a `Long` and `myAccount.ts#waitingIn` refuses anything
 *  else; not 1, so that a screen reading „the first row" rather than „the row named" is told
 *  apart. */
const THE_ROW = 7

/**
 * What `PUT /api/me` answers, in the names it answers them under.
 *
 * <p>`bio` is the text STANDING ON THE PROFILE and is deliberately NOT what was sent
 * (`MeWriteApi.Changed`), so a case handing in the old text is describing the ordinary
 * outcome rather than a curiosity.
 */
const answering = (body: { bio: string | null; waiting: number | null }): Response =>
  new Response(JSON.stringify({ ...body, profileHidden: false }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

/** Only what this panel sent, so a count is a count of writes and not of the reads the shell
 *  makes while a screen is mounted. */
const writes = (asked: Asked[]): Asked[] =>
  asked.filter((one) => one.path === '/api/me' && one.init?.method === 'PUT')

/** What the body of one of those really carried, read rather than assumed. */
const sentIn = (one: Asked): unknown => JSON.parse(String(one.init?.body))

const panelFor = async () => within(await screen.findByRole('region', { name: 'Tekst o sebi' }))

const box = async () => (await panelFor()).getByLabelText(/Svojim rečima|Tekst o sebi/)

/**
 * SOMEBODY ELSE SIGNING IN DURING THE SAME VISIT, through the portal's own live writer.
 *
 * <p>Copied from `pictureIsOneRow.test.tsx`, which gives the reason: `theServerSignedMeIn` is
 * the very call `member/SignIn.tsx` makes with the answer to `GET /api/me`, and a test that
 * built a session object by hand would be measuring its own object. Reachable without a
 * reload, because `SessionProvider` is mounted above the router and never comes down.
 */
function SignInAs({ memberNumber }: { memberNumber: string }) {
  const { theServerSignedMeIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
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
      prijavi drugog
    </button>
  )
}

describe('the words a member wrote about themselves, changed later', () => {
  it('opens on what stands on the profile, and refuses to send it back unchanged', async () => {
    /* A box that opened empty would read as „write one" to somebody who has
       written one, and what they are usually here to do is mend a sentence. The
       button is told off rather than switched off, so it stays reachable and
       says why it will not act. */
    const user = setupUser()
    const { asked, stop } = serverThat(() => null)

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      const panel = await panelFor()

      expect(await box()).toHaveValue(withOne.bio)
      expect(panel.getByText(sr.bio.standing)).toBeVisible()

      const send = panel.getByRole('button', { name: 'Pošalji na odobrenje' })

      expect(send).toHaveAttribute('aria-disabled', 'true')
      expect(send).not.toBeDisabled()
      expect(send).toHaveAccessibleDescription('Izmeni tekst da bi imao šta da pošalješ.')

      /* Pressed anyway, because reachable means pressable: the refusal lives in
         the handler as well as in the attribute. */
      await user.click(send)

      expect((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
      /* And nothing left the browser over a press the screen itself refused. */
      expect(writes(asked)).toEqual([])
    } finally {
      stop()
    }
  })

  it('says the limit on the way into the box, not by stopping the typing', async () => {
    /* The box cuts at 360 characters, and until 16.08.2026 that number lived
       only in a counter drawn `aria-hidden`, with nothing pointing at it. A
       member who cannot see the screen met the limit as a wall: the keys simply
       stopped working. `LongBox` says in its own comment that pointing at the
       count is the caller's business (forms/LongBox.tsx), and the comment box on
       an event does it (pages/event/RateEvent.tsx); this panel did not.
     *
       The rule beside the box said the number in words and it went out on
       31.08.2026 with the last three of its kind, so what carries it now is the
       count alone. **And the count says what is left, not what the whole is**,
       which is the same thing only for an empty box: somebody with a biography
       already written hears „Još 123 znaka" and hears 360 nowhere on this screen.
       That is still an instruction on the way in rather than a wall met in silence
       (WCAG 2.2 SC 3.3.2, and the wall itself is named by `registration.bioFull`),
       but it is less than the rule said, so it is measured both ways rather than
       described from the empty one. A first draft of this comment claimed the
       number was still said, and only the empty box was drawn (review, 31.08.2026).

       One id, and it is the whole of what the description may say: a second one
       here would point at an element that no longer exists, which is read as
       nothing at all and which no assertion about text can see. */
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const field = await box()

    expect(field).toHaveAttribute('aria-describedby', 'settings-bio-left')
    expect(field).toHaveAccessibleDescription(/Još 360 znak/)

    /* Every id in the list points at something. Asked of the document rather than
       of the attribute, because an attribute naming a ghost reads the same. */
    for (const id of must(field.getAttribute('aria-describedby'), 'what describes the box').split(' ')) {
      expect(document.getElementById(id), id).not.toBeNull()
    }
  })

  it('says what is left of the limit to somebody who has already written', async () => {
    /* The other half of the sentence above, and the half that changed: what this
       member used to hear was the rule, which carried 360 whatever they had
       written. Now the description carries the remainder **and no longer carries the
       rule**, and that is what this freezes so the difference is a decision rather
       than a thing nobody wrote down.

       Two things, not one. „The remainder and nothing else" is what an earlier
       version of this line promised, and it is not what the two assertions below say:
       they say the remainder is there and that 360 is not. Whether anything else
       stands beside them is unmeasured, and saying so is cheaper than a sentence that
       has to be believed (review, 31.08.2026). */
    renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

    const field = await box()

    expect(field).toHaveAccessibleDescription(/Još \d+ znak/)
    expect(field).not.toHaveAccessibleDescription(/360/)
  })

  it('asks somebody with nothing on their profile to write rather than to change', async () => {
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()

    expect(await box()).toHaveValue('')
    expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toHaveAccessibleDescription(
      'Napiši nešto da bi mogao da pošalješ.',
    )
    /* And the sentence above the box says there is nothing yet, rather than
       „this is what stands on your profile" over an empty box. Both sentences
       ran and neither was read, so a review swapped one for the other and the
       whole suite stayed green. */
    expect(panel.getByText(sr.bio.none)).toBeVisible()
    expect(panel.queryByText(sr.bio.standing)).not.toBeInTheDocument()
  })

  /**
   * AND A `null` BIOGRAPHY OPENS THE SAME WAY, WHICH IS A ROW THE SERVER NEVER ACTUALLY
   * HANDS A MEMBER ABOUT HIMSELF.
   *
   * **Why this case builds a row the server would never really answer.** `CompetitorApi`'s
   * condition on `bio` asks only whether the CALLER is signed in, never whether the row is
   * his own, so a member's own row never comes back null: he must be signed in to have a
   * "my own row" at all. Built here anyway, because `ProfileBio`'s `me.bio ?? ''` is a guard
   * against that condition and `profile/visible.ts`'s ever drifting apart, and a guard
   * nothing exercises is a branch nothing checks (rule of 14.09.2026).
   */
  it('reads a null biography the same as an empty one, in case the two guards ever disagree', async () => {
    clearResourceCache()

    const { stop } = serverThat((path) =>
      path === '/api/competitors'
        ? new Response(
            JSON.stringify([{ ...aCompetitor, memberNumber: withNone.memberNumber, bio: null }]),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

      const panel = await panelFor()

      expect(await box()).toHaveValue('')
      expect(panel.getByText(sr.bio.none)).toBeVisible()
      expect(panel.queryByText(sr.bio.standing)).not.toBeInTheDocument()
    } finally {
      stop()
      clearResourceCache()
    }
  })

  it('sends the words to the route as a biography and sends nothing else with them', async () => {
    /* THE CASE THIS BRANCH EXISTS FOR, and the one thing it must not do is read the panel
       for its answer: „čeka odobrenje" and the words shown back looked identical while this
       screen sent nothing at all. So the request is read off the recording server.
     *
       `bio` ALONE, and the other eight fields `MeWriteApi.Change` takes are absent on
       purpose: a field left out means „do not touch it" on this route (ADL A54, and the
       class says so in as many words), so a panel that sent the whole record would rewrite
       a member's name and his town every time he mended a sentence. */
    const user = setupUser()
    const { asked, stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT'
        ? answering({ bio: withOne.bio, waiting: THE_ROW })
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      await panelFor()
      await user.clear(await box())
      await user.type(await box(), 'Trčim od 2015, najviše po Fruškoj gori.')
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

      await waitFor(() => {
        expect(writes(asked)).toHaveLength(1)
      })

      /* The words that were TYPED, and never the ones that were standing: read off
         `standing` this would send the member's old biography back for approval and the box
         would still look right. */
      expect(sentIn(must(writes(asked)[0], 'the one write'))).toEqual({
        bio: 'Trčim od 2015, najviše po Fruškoj gori.',
      })
    } finally {
      stop()
    }
  }, SLOW)

  it('goes on saying the profile carries nothing while the new words wait for a moderator', async () => {
    /* PDL P11, 12.08.2026: what a member proposes is not his profile until somebody says so,
       and `MeWriteApi.Changed` answers the text STANDING rather than the one just sent.
     *
       Measured on a member whose profile carries NOTHING, which is the one setting in which
       the two readings differ on the screen: fold in what was sent and the panel says „ovo
       sada stoji na tvom profilu" over words nobody has approved; read the answer and it
       goes on saying there is nothing there. On a member who already had one, both readings
       draw the same sentence and the case would measure nothing. */
    const user = setupUser()
    const { stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT'
        ? answering({ bio: '', waiting: THE_ROW })
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber, undefined, undefined, (
        <Decide row={String(THE_ROW)} />
      ))

      await panelFor()
      await user.type(await box(), 'Prvi put pišem nešto o sebi.')
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

      expect((await panelFor()).getByText(sr.bio.waitingNote)).toBeVisible()

      /* Decided in this same visit, so the box comes back and the sentence above it can be
         read: while the text waits there is no sentence at all, and a case that stopped at
         the waiting note could not tell the two readings apart. */
      await user.click(screen.getByRole('button', { name: 'odluči' }))

      const panel = await panelFor()

      expect(panel.getByText(sr.bio.none)).toBeVisible()
      expect(panel.queryByText(sr.bio.standing)).not.toBeInTheDocument()
    } finally {
      stop()
    }
  }, SLOW)

  it('takes the standing words down at once when the box is emptied, and says so', async () => {
    /* PDL, owner 19.09.2026 on three offered outcomes: „Prazan tekst znaci BRISANJE
       biografije, i stupa odmah, bez moderacije. „Skloni moju biografiju" je pravo clana nad
       sopstvenim podatkom, ne predlog." So this road ends in „Sačuvano." and NOT in „čeka
       odobrenje", and the sentence above the box flips to „there is nothing there".
     *
       Both halves are asserted, because a panel that simply failed to draw the waiting note
       would satisfy the first on its own. */
    const user = setupUser()
    const { asked, stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT' ? answering({ bio: '', waiting: null }) : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      await panelFor()
      await user.clear(await box())
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

      const told = await screen.findByText(sr.account.saved)

      expect(told).toBeVisible()
      /* The reader is taken to the sentence that answered the press, rather than left on a
         control whose meaning has changed under them (WCAG 2.2 SC 4.1.3, 2.4.3). */
      expect(told).toHaveFocus()

      const panel = await panelFor()

      expect(panel.queryByText(sr.bio.waitingNote)).not.toBeInTheDocument()
      expect(panel.getByText(sr.bio.none)).toBeVisible()
      expect(panel.queryByText(sr.bio.standing)).not.toBeInTheDocument()

      /* An EMPTY string and not an absent field: `MeWriteApi` reads a `bio` left out as „do
         not touch it" and a blank one as the removal, so the two are opposite instructions
         and only one of them is what the member asked for. */
      expect(sentIn(must(writes(asked)[0], 'the one write'))).toEqual({ bio: '' })
    } finally {
      stop()
    }
  }, SLOW)

  it('says nothing new about the profile when the answer names no text at all', async () => {
    /* A 200 this screen cannot read the standing text out of, which is a portal one release
       behind its server. What it must NOT do is fall back on what was sent: that is the one
       reading `MeWriteApi.Changed` exists to prevent, and it would put a member's unapproved
       words on his own profile page through the screen instead of through the table. So the
       sentence above the box goes on saying exactly what it said before he pressed. */
    const user = setupUser()
    const { stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT'
        ? new Response(JSON.stringify({ profileHidden: false, waiting: THE_ROW }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber, undefined, undefined, (
        <Decide row={String(THE_ROW)} />
      ))

      await panelFor()
      await user.type(await box(), 'Nešto o sebi, prvi put.')
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

      expect((await panelFor()).getByText(sr.bio.waitingNote)).toBeVisible()

      await user.click(screen.getByRole('button', { name: 'odluči' }))

      const panel = await panelFor()

      expect(panel.getByText(sr.bio.none)).toBeVisible()
      expect(panel.queryByText(sr.bio.standing)).not.toBeInTheDocument()
    } finally {
      stop()
    }
  }, SLOW)

  it('tells him a text of his still waits after a removal, without inventing its words', async () => {
    /* THE ONE PLACE THE TWO ROADS MEET, and it is reachable rather than a curiosity: after a
       reload this panel cannot know a text of his is with a moderator (nothing serves that),
       so he is met by the box, empties it, and the removal takes effect while the older
       proposal is still undecided. `MeWriteApi.Changed` answers the key of whatever of his is
       standing in the queue, „read the same way whether or not THIS request put it there".
     *
       So the wait is said, and the words are NOT drawn: this visit never carried them, and an
       empty paragraph would say the text had been lost rather than that it was never here. */
    const user = setupUser()
    const { stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT'
        ? answering({ bio: '', waiting: THE_ROW })
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      await panelFor()
      await user.clear(await box())
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

      const panel = await panelFor()

      expect(await panel.findByText(sr.bio.waitingNote)).toBeVisible()
      expect(panel.queryByText(must(withOne.bio, 'his standing words'))).not.toBeInTheDocument()
      expect(panel.queryByText(sr.account.saved)).not.toBeInTheDocument()

      /* NO PARAGRAPH AT ALL UNDER THE SENTENCE, and that is the half a question about TEXT
         cannot ask. Measured: with the guard removed the panel draws the paragraph with
         nothing in it, and every assertion above goes on passing - „his old words are not
         there" is exactly what an EMPTY paragraph says too. An empty frame reads as „the
         text was lost" rather than „it was never here", which is `ProfilePicture.tsx`'s own
         reason for the same guard over the picture.
       *
         Counted by role rather than by class, which the portal already does in two places
         (`i18n/Sentence.test.tsx`, `pages/details.test.tsx`): the waiting sentence carries
         `role="status"`, so an explicit role takes it out of this count and what is left is
         the body paragraph and nothing else. */
      expect(panel.queryAllByRole('paragraph')).toEqual([])
    } finally {
      stop()
    }
  }, SLOW)

  it('says what the server refused, keeps the words, and puts nothing in front of a moderator', async () => {
    /* The route refuses a second text while one of his waits (PDL, owner 19.09.2026: „Nov
       tekst o sebi se ODBIJA dok prethodni ceka odluku moderatora. Odgovor je 409"), and
       after a reload this panel cannot know one waits - so this is the road a real member
       takes, not a curiosity. The reason is said in its own words rather than folded into
       „nešto je puklo", and the words stay in the box, because clearing them would take away
       the thing he is being told about. */
    const user = setupUser()
    const { stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT'
        ? refused('aTextAlreadyWaits', 409)
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      await panelFor()
      await user.clear(await box())
      await user.type(await box(), 'Drugi pokušaj istog dana.')
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

      expect(await screen.findByText(sr.account.textAlreadyWaits)).toBeVisible()

      const panel = await panelFor()

      expect(await box()).toHaveValue('Drugi pokušaj istog dana.')
      expect(panel.queryByText(sr.bio.waitingNote)).not.toBeInTheDocument()
      expect(panel.queryByText(sr.account.saved)).not.toBeInTheDocument()
    } finally {
      stop()
    }
  }, SLOW)

  it('sends one request for two presses while the first is still out', async () => {
    /* `aria-disabled` is a thing said to a reader and not a thing the browser enforces, so
       without the ref in the handler a member who presses twice puts two texts in front of a
       moderator and the route answers the second 409. Held open until both presses are in,
       because an answer that had already landed would make the two presses two errands. */
    const user = setupUser()
    /* The shape `profilePicture.test.tsx` already has for the same question: a promise the
       case releases, so both presses are in before anything comes back. Written with a
       harmless default rather than `null`, because the compiler cannot see that the executor
       runs at once and would refuse the call below (`noUncheckedIndexedAccess` and strict
       null checks are on). */
    let release: (answer: Response) => void = () => undefined
    const onItsWay = new Promise<Response>((resolve) => {
      release = resolve
    })
    const { asked, stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT' ? onItsWay : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      await panelFor()
      await user.clear(await box())
      await user.type(await box(), 'Nešto novo o sebi.')

      const send = (await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' })

      await user.click(send)
      await user.click(send)

      expect(writes(asked)).toHaveLength(1)

      release(answering({ bio: withOne.bio, waiting: THE_ROW }))

      await waitFor(() => {
        expect(screen.getByText(sr.bio.waitingNote)).toBeVisible()
      })

      expect(writes(asked)).toHaveLength(1)
    } finally {
      stop()
    }
  }, SLOW)

  it('offers nothing more while one is waiting, and says what was sent', async () => {
    const user = setupUser()
    const { stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT'
        ? answering({ bio: withOne.bio, waiting: THE_ROW })
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      await panelFor()
      await user.clear(await box())
      await user.type(await box(), 'Nešto sasvim drugo o sebi.')
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

      const panel = await panelFor()
      const told = await panel.findByText(sr.bio.waitingNote)

      expect(told).toBeVisible()
      /* The reader is taken to what replaced the control they pressed, rather than
         dropped on the body with nothing announced (WCAG 2.2 SC 4.1.3, 2.4.3). */
      expect(told).toHaveFocus()
      expect(panel.queryByRole('button', { name: 'Pošalji na odobrenje' })).not.toBeInTheDocument()
      /* And what was sent is on screen, so somebody who cannot remember what they
         wrote does not have to guess while it is out of their hands. */
      expect(panel.getByText('Nešto sasvim drugo o sebi.')).toBeVisible()
    } finally {
      stop()
    }
  }, SLOW)

  it('hands the box straight back once THAT text is decided, and not when another is', async () => {
    /* The panel reads decisions as well as the key the route answered with, so somebody whose
       text is decided while they are still on the portal is not left told to wait. That was
       written down in a comment and nothing measured it: a review made the filter ignore
       decisions altogether and all 1935 tests stayed green.
     *
       **AND THE DECISION HAS TO BE ON HIS OWN ROW.** A panel that cleared on any decision at
       all passes a case with one row in it, which is why somebody else's is decided first and
       the wait is asserted to be still standing. The key is the SERVER'S: `settle` files a
       decision under the id of the row the server made, and this panel reads that same id.
       Under a key of the browser's own the two never met. */
    const user = setupUser()
    const { stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT'
        ? answering({ bio: withOne.bio, waiting: THE_ROW })
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber, undefined, undefined, (
        <>
          <Decide row={String(THE_ROW + 1)} label="odluči tuđe" />
          <Decide row={String(THE_ROW)} />
        </>
      ))

      await panelFor()
      await user.clear(await box())
      await user.type(await box(), 'Trčim jer volim šumu.')
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

      expect((await panelFor()).getByText(sr.bio.waitingNote)).toBeVisible()

      await user.click(screen.getByRole('button', { name: 'odluči tuđe' }))

      expect((await panelFor()).getByText(sr.bio.waitingNote)).toBeVisible()

      await user.click(screen.getByRole('button', { name: 'odluči' }))

      const panel = await panelFor()

      expect(panel.queryByText(sr.bio.waitingNote)).not.toBeInTheDocument()
      expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
    } finally {
      stop()
    }
  }, SLOW)

  it('does not tell the next member to sign in that a text of his is waiting', async () => {
    /* A VISIT IS NOT A MEMBER. `SessionProvider` sits above the router so it never comes
       down, and the sign in screen is walkable while somebody is signed in, so one visit can
       hold two people - a shared laptop at a race is the ordinary case. The identical fault
       was measured on the picture panel and cost it a round of review: the second man was
       told a picture of his was waiting and was shown the first man's photograph. */
    const user = setupUser()
    const { stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT'
        ? answering({ bio: withOne.bio, waiting: THE_ROW })
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber, undefined, undefined, (
        <SignInAs memberNumber={somebodyElse.memberNumber} />
      ))

      await panelFor()
      await user.clear(await box())
      await user.type(await box(), 'Ovo je moj tekst i ničiji drugi.')
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

      expect((await panelFor()).getByText(sr.bio.waitingNote)).toBeVisible()

      await user.click(screen.getByRole('button', { name: 'prijavi drugog' }))

      const panel = await panelFor()

      expect(panel.queryByText(sr.bio.waitingNote)).not.toBeInTheDocument()
      expect(panel.queryByText('Ovo je moj tekst i ničiji drugi.')).not.toBeInTheDocument()
      expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
    } finally {
      stop()
    }
  }, SLOW)

  it('is not held up by a picture the same member is waiting on', async () => {
    /* Two sorts on one queue, and one waiting does not silence the other: they
       are separate errands about one profile (owner, 15.08.2026). */
    const user = setupUser()
    const { stop } = serverThat((path, init) =>
      path === '/api/me/photo' && init?.method === 'POST'
        ? new Response(JSON.stringify({ waiting: 2, digest: 'abc', standing: null }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      const picture = within(await screen.findByRole('region', { name: 'Profilna slika' }))

      await user.upload(
        await picture.findByLabelText(/Izaberi novu sliku/),
        new File(['slika'], 'nova.jpg', { type: 'image/jpeg' }),
      )
      await measurePicture()
      await picture.findByLabelText('Veličina isečka')
      await user.click(picture.getByRole('button', { name: 'Pošalji na odobrenje' }))

      await waitFor(() => {
        expect(picture.getByText(sr.picture.waitingNote)).toBeVisible()
      })

      expect((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
    } finally {
      stop()
    }
  }, SLOW)

  it('drops the queue after a text and the member list after a removal, and never the other way', async () => {
    /* WHICH RESOURCE EACH ROAD SPOILS, and they are different ones. A new text writes a row
       into `verification` (`MeWriteApi.queued`), so a moderator who had already opened the
       queue this visit would never see it; a removal writes `competitor.bio`, which
       `/api/competitors` carries on every row, so the profile this visit is holding would go
       on drawing words the member has taken down. `data/client.ts` fetches a resource once per
       visit, so neither corrects itself.
     *
       **Both roads in one case and both names counted, because the two are one ternary in the
       code**: measured on one road only, swapping the two arms would pass. Counted rather than
       compared against a number written here, since the shell asks for the list on its own. */
    const user = setupUser()
    let standing: string | null = withOne.bio
    const { asked, stop } = serverThat((path, init) => {
      if (path === '/api/me' && init?.method === 'PUT') {
        const removing = String(init.body).includes('"bio":""')

        standing = removing ? '' : standing

        return answering({ bio: standing, waiting: removing ? null : THE_ROW })
      }

      return null
    })
    const counted = (name: string) => asked.filter((one) => one.path === `/api/${name}`).length

    try {
      /* As a member who may also moderate, which is what the owner is and the one session in
         which both halves of this walk are reachable (`pictureIsOneRow.test.tsx` says the
         same of its own). */
      const { router } = renderAt(
        '/sr/podesavanja',
        'superadmin',
        withOne.memberNumber,
        undefined,
        undefined,
        <Decide row={String(THE_ROW)} />,
      )

      await panelFor()

      const queueBefore = counted('verification')
      const listBefore = counted('competitors')

      await user.clear(await box())
      await user.type(await box(), 'Nova rečenica o sebi.')
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))
      await (await panelFor()).findByText(sr.bio.waitingNote)

      /* Read by walking to the queue, because dropping a name is only half of it: what the
         name is FOR is that somebody asks again. */
      await user.click(screen.getByRole('button', { name: 'odluči' }))
      await router.navigate('/sr/administracija/verifikacija/trkacki-profil')
      await screen.findByRole('list', { name: /Čeka/ })

      await waitFor(() => {
        expect(counted('verification')).toBeGreaterThan(queueBefore)
      })

      expect(counted('competitors')).toBe(listBefore)

      await router.navigate('/sr/podesavanja')
      await panelFor()

      const listBeforeRemoval = counted('competitors')

      await user.clear(await box())
      await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))
      await (await panelFor()).findByText(sr.account.saved)

      await router.navigate('/sr/takmicari')
      await screen.findByRole('heading', { level: 1, name: 'Takmičari' })

      await waitFor(() => {
        expect(counted('competitors')).toBeGreaterThan(listBeforeRemoval)
      })
    } finally {
      stop()
    }
  }, SLOW)

  it('downloads nothing about anybody else to say what is waiting', async () => {
    /* The same limit the picture panel carries, and for the same reason: the
       only place an earlier visit is written is the whole verification queue,
       which holds names and postal addresses of people who are not members yet.
       Reading it here would download all of that into a member`s browser
       (pages/publicData.test.tsx refuses it by name). */
    const asked: string[] = []
    const real = globalThis.fetch

    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      asked.push(String(input))

      return real(input, init)
    }

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      await panelFor()

      expect(asked.filter((one) => one.includes('verification'))).toEqual([])
    } finally {
      globalThis.fetch = real
    }
  })
})

/**
 * A DECISION ON ONE ROW OF THE QUEUE, without walking the moderator's screen.
 *
 * <p>What it writes is exactly what the queue writes (`admin/PendingQueue.tsx`, `settle`):
 * the same store, under the key of the row the SERVER made. What it saves is the walk - the
 * queue has to be reached as a moderator, the card found by a heading, and a reason typed -
 * and the cases here are about the member's panel rather than about that screen. The walk
 * itself lives where it belongs, in `pictureIsOneRow.test.tsx`, which decides through the
 * real queue.
 */
function Decide({ row, label = 'odluči' }: { row: string; label?: string }) {
  const { settle } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        settle(row, { status: 'approved', note: '', basis: '', memberNumber: '' })
      }}
    >
      {label}
    </button>
  )
}

describe('where a biography can be sent for review at all', () => {
  it('is this screen and nowhere else, and the net says so by reading the sources', () => {
    /* MOVED HERE ON 28.09.2026 from `pages/Registration.test.tsx`, where it stood beside
       the registration's own biography box. The box left the registration that day, so a
       net about „which screen can send a biography for review" no longer has anything to
       do with that file, and what it names is this one.
     *
       ~~It had a second half, which spelt out the words of the rule beside the field:
       `sr.registration.bioHint`.~~ That rule was one of the seven the owner kept on
       31.08.2026 („Registracija → Svojim rečima"), and it was kept ON THE REGISTRATION -
       the same day he deleted the identical sentence from THIS panel, by name, with two
       others. So when the field moved here it moved to the one screen whose rule he had
       already struck, and the sentence has no home left. The key is gone from both
       dictionaries with it. What a member sees instead is the count in the box, which is
       what that deletion left standing and what the two cases above measure.
     *
       Four attempts at mechanising this, and the fourth is the reason there is no fifth.
       „These five words are not on the screen" was beaten by a review putting the same
       promise back in different words. „One form definition has a box for a biography"
       was beaten because the panel the owner decided on uses no form definition. „No
       source file contains `kind: 'bio'`" was beaten by `const kind = SORT`, and by
       double quotes: a guard that reads source text guards the spelling. Counting the
       controls on Settings was beaten twice over.
     *
       **THE MARKER MOVED ON 28.09.2026, BECAUSE THE ACT MOVED, AND THIS IS NOT A FIFTH
       ATTEMPT AT MECHANISING IT.** Until that day this panel minted the queue row itself
       (`propose({ kind: 'bio', … })`) and the net read that sort. It sends
       `PUT /api/me` now and the SERVER files the row (`MeWriteApi.queued`), so
       `kind: 'bio'` is in no production file at all - measured, nought hits - and a net
       still reading it would have gone green over a portal where a second screen could
       send a biography tomorrow. So the marker is the body this screen sends: the account
       route named beside a `bio`.
     *
       **It is the same KIND of guard as the one it replaces, and its blind spots are named
       rather than mended.** A module that builds the body in a variable, that puts the two
       arguments on two lines, or that reaches the same route under an address of its own
       walks past. What it does catch is the plain one, which is how this panel is written,
       and the one thing it now catches that the old marker could not is a SECOND screen
       written the same plain way. Measured on the day it was written: of the four
       production modules that name `THE_ACCOUNT_GOES_TO`, two also carry the word `bio`
       and exactly one carries the two together. */
    /* And the net is asked whether it caught anything at all before it is asked what it
       caught. Narrowed to one folder by accident, it would go on passing over a panel
       written in plain sight: measured, with the root cut to `src/clock`, the guard
       stayed green while the panel stood there. */
    const swept = sources()

    expect(swept.length).toBeGreaterThan(WHOLE_PORTAL)
    expect(swept.some(({ path }) => path.endsWith(inside('member', 'ProfileBio.tsx')))).toBe(true)
    /* And it holds no helper. Nothing under `src/test/` ships, so a sentence written in
       one of them is not something the portal does; read as though it were, a plain line
       in a comment there failed a guard about screens. */
    expect(swept.filter(({ path }) => path.includes(inside('src', 'test', '')))).toEqual([])

    const sending = swept
      .filter(({ code }) => code.includes('THE_ACCOUNT_GOES_TO, { bio:'))
      /* Named from `src` down, and cut at the **last** `src` rather than the first: a
         checkout into a folder that itself carries `src` would otherwise make every path
         unrecognisable and this list impossible to read. */
      .map(({ path }) => path.slice(path.lastIndexOf(inside('src', ''))).split(SEP).join('/'))

    expect(sending).toEqual(['src/pages/member/ProfileBio.tsx'])
  })
})

/**
 * THE BOX ITSELF, WHICH MOVED HERE ON 28.09.2026 RATHER THAN BEING DELETED.
 *
 * These eight stood in `pages/Registration.test.tsx` and measured `forms/LongBox.tsx`
 * through the registration's own biography field. The owner took that field off the
 * registration that day („Profilna sekcija se sa slikom i svojim recima izbacuje iz
 * registracione forme - to ce clan popunjavati naknadno kad bude odobren"), so the box
 * they are about is THIS one: the only place on the portal a member writes about himself.
 *
 * **Moved and not rewritten from memory.** What each of them measures is unchanged, and so
 * is the number, because the number moved with the box (`profil.form.json`). The old copy
 * is gone rather than left standing: a case measuring a field no screen draws reads as
 * cover, and `CLAUDE.md` names moving logic as the commonest way a dead copy is born.
 */
describe('the box a member writes about themselves in', () => {
  it('counts down what is left and refuses more than the limit', async () => {
    /* Owner, 01.08.2026. Three hundred and sixty is the limit the box has always
       carried; what it did with it was mark the field wrong after the fact. It refuses
       at the door now, and says how much room is left before anybody runs out of it. */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = await box()

    expect(panel.getByText('Još 360 znakova')).toBeVisible()

    await user.type(field, 'Trčim zbog druženja.')
    expect(panel.getByText('Još 340 znakova')).toBeVisible()

    /* Tall enough for the whole of it from the start, so nothing that fits has to be
       read through a scrollbar. */
    expect(field).toHaveAttribute('rows', '6')
    expect(field).toHaveAttribute('maxlength', '360')
  })

  it('tells whoever cannot see the count that it is there', async () => {
    /* The count was printed under the box and described by nothing, so a screen reader
       read the label on arrival and never the one number that says how much of the box
       is already spent. */
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const field = await box()
    const described = (field.getAttribute('aria-describedby') ?? '').split(' ')
    const counter = must(document.getElementById(described[described.length - 1] ?? ''), 'brojač')

    expect(counter).toHaveTextContent('Još 360 znakova')
  })

  it('counts in Serbian, which has three forms and not one', () => {
    /* „Još 1 znakova" is not a sentence anybody writes. The engine has had plural forms
       since it was written and this key was a single string.
     *
       The key is still called `registration.bioLeft` although the box is no longer on the
       registration: `LongBox` draws it for every long box the portal has, so the prefix
       names where it was first needed and not where it may be used. Said here so the next
       reader does not take that prefix for a claim. */
    expect(translate(sr, 'sr', 'registration.bioLeft', { count: 1 })).toBe('Još 1 znak')
    expect(translate(sr, 'sr', 'registration.bioLeft', { count: 3 })).toBe('Još 3 znaka')
    expect(translate(sr, 'sr', 'registration.bioLeft', { count: 7 })).toBe('Još 7 znakova')
  })

  it('says so when there is no room left, rather than counting nought', async () => {
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = await box()

    await user.click(field)
    /* Exactly the limit, so the box is full and nothing was lost filling it. */
    await user.paste('x'.repeat(360))

    expect(field).toHaveValue('x'.repeat(360))
    /* Twice in the markup and once to a reader: the line under the box, hidden from the
       reader because the same words reach it through `aria-describedby`, and the region
       that says it. The region is on the page from the start and empty until now, because
       one that is added together with its text is one a screen reader often misses. */
    expect(panel.getAllByText('Dosta je, granica je 360 znakova.')).toHaveLength(2)
    expect(panel.getByRole('status')).toHaveTextContent('Dosta je, granica je 360 znakova.')
  })

  it('keeps the region quiet while there is still room', async () => {
    /* It used to hold the count and change on every keystroke, which is three hundred and
       fifty-nine announcements of a number nobody was waiting to hear, each one to be got
       through before anything else could be said.

       **Asked of EVERY region and not of „the" one, which is what moving this case here
       cost and what it bought.** On the registration the box was the only thing on the
       screen that spoke, so `getByRole('status')` meant the box's region. This panel has
       another: the one that says the text has not changed, drawn exactly while the box is
       untouched, which is the state this case is about. `getByRole` therefore found two
       and threw - measured, not foreseen.

       So what is held is the thing that actually matters, and it is the stronger of the
       two: NOTHING on this panel announces the wall or a lost paste while there is still
       room. Written as „the region is empty" it was also a claim about which region that
       is, and that claim was the half that did not survive the move. */
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()

    expect(panel.getAllByRole('status').length).toBeGreaterThan(0)
    expect(
      panel
        .getAllByRole('status')
        .map((one) => one.textContent ?? '')
        .filter((said) => /Dosta je|Nalepljeni tekst/.test(said)),
    ).toEqual([])
  })

  it('says how much of a paste was thrown away, rather than throwing it away in silence', async () => {
    /* The limit is refused at the door, and the browser refuses in silence: 400
       characters into a box that holds 360 keeps 360 and drops 40 without a word. The
       counter then reads „the box is full", which is read as „I filled it". */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = await box()

    await user.click(field)
    await user.paste('x'.repeat(400))

    const said =
      'Nalepljeni tekst je bio 40 znakova duži nego što staje, pa taj višak nije primljen.'

    /* On the screen once and to a reader once: the visible sentence is hidden from the
       reader, and the region that was there all along says it. */
    expect(panel.getAllByText(said)).toHaveLength(2)
    expect(panel.getByRole('status')).toHaveTextContent(said)

    /* And it goes the moment the writer does anything themselves. Not when the box drops
       below its limit, which was the first rule and left the message standing through
       every edit that kept the length: typing over a selected character is an edit the
       writer made and the length does not move. */
    await user.type(field, '{Backspace}x')
    expect(panel.queryByText(/Nalepljeni tekst/)).toBeNull()
  })

  it('counts what a paste over a selection really loses, not what it brought', async () => {
    /* Pasting over the whole box is not an overflow: what the selection gives back is
       room. Without this the rule is arithmetic no test touches, so taking the two the
       wrong way round would go green.

       The event is dispatched rather than performed, because neither Ctrl+A nor a
       selection set on the element moves the selection userEvent pastes against, and a
       paste into a box that is full is the other case, not this one. What is being checked
       is the arithmetic the handler does with the selection it is given, and that is
       exactly what this hands it. */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    /* Typed through the query rather than by an assertion, which ADL A14 bans and which
       the lint enforces: `getByLabelText` takes the element type as a parameter, so the
       selection below is reached by asking for the right thing and not by telling the
       compiler it already is. */
    const field = panel.getByLabelText<HTMLTextAreaElement>(/Svojim rečima|Tekst o sebi/)

    await user.click(field)
    await user.paste('x'.repeat(360))

    field.setSelectionRange(0, 360)
    fireEvent.paste(field, { clipboardData: { getData: () => 'y'.repeat(380) } })

    expect(panel.getByRole('status')).toHaveTextContent(
      'Nalepljeni tekst je bio 20 znakova duži nego što staje, pa taj višak nije primljen.',
    )
  })

  it('does not charge a Windows clipboard for its line endings', async () => {
    /* The clipboard carries CR LF and a textarea keeps LF, so counting the clipboard as it
       comes charges the writer one character per line for something the box never held.
       Ten lines of thirty-six, which is 360 in the box and 369 on the clipboard: it all
       fits, and nothing is lost. */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = await box()

    await user.click(field)
    await user.paste(Array.from({ length: 10 }, () => 'x'.repeat(35)).join('\r\n'))

    expect(panel.queryByText(/Nalepljeni tekst/)).toBeNull()
  })

  it('says nothing when the paste fits', async () => {
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = await box()

    await user.click(field)
    await user.paste('x'.repeat(40))

    expect(panel.queryByText(/Nalepljeni tekst/)).toBeNull()
    expect(panel.getByText('Još 320 znakova')).toBeVisible()
  })
})
