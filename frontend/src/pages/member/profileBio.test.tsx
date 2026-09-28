import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import type { Competitor } from '../../data/types'
import { clearResourceCache } from '../../data/client'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { aCompetitor } from '../../test/theAnswer'
import sr from '../../i18n/sr.json'
import { SLOW } from '../../test/slow'
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
      /* Nothing at all under the sentence, which is what „no words of his are drawn" means
         here: the paragraph that carries them is the panel's only other text. */
      expect(panel.queryByText(must(withOne.bio, 'his standing words'))).not.toBeInTheDocument()
      expect(panel.queryByText(sr.account.saved)).not.toBeInTheDocument()
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
