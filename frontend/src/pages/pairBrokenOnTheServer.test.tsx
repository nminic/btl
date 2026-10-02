import type { ReactNode } from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { at, must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { answeredWith, did, forgetEveryCookie, serverThat, type Asked } from '../test/serverAnswers'
import { clearResourceCache } from '../data/client'
import { useSession } from '../session/useSession'
import sr from '../i18n/sr.json'

/**
 * „RASKINI" REACHES THE SERVER, AND THE PAIR IS STILL GONE AFTER A RELOAD.
 *
 * <p><b>Owner, PDL, 24.09.2026:</b> „Par sme da raskine <b>svaka strana, bilo kad</b>."
 * `DELETE /api/pairs/{id}` was written for that sentence the same day and nothing called it:
 * `profile/RacingPairLine.tsx` wrote `breakPair` into `session/SessionProvider.tsx`, which is a
 * `useState` in the browser. So the pair came back on the next reload, and the other half was
 * told inside the presser's own tab.
 *
 * <p><b>WHAT THIS FILE DOES NOT MEASURE, said here so that the absence is a decision.</b> The
 * half of „Raskini" that ends a pair this visit made lives in `pages/racingPair.test.tsx` and is
 * untouched: that pair has no row on any server, so there is nothing to send. The two halves are
 * one button choosing its store, and each is measured where its store is.
 *
 * <p><b>WHY THE FIXTURE IS THREE PAIRS AND NOT ONE.</b> Every value an assertion here reads could
 * arrive from somewhere else if the screen were wrong, so each is given somewhere else to arrive
 * from:
 *
 * <ul>
 * <li><b>she holds TWO</b>, which is PDL's own state of 07.09.2026 („Od 1. januara član sme da
 * drži dva... svaki sa svojim „Raskini""), so „this pair" and „the first pair she holds" are two
 * different keys and a screen sending `held[0].id` cannot pass by pressing the second;
 * <li><b>a THIRD pair belongs to two members who are neither of them</b>, and it is FIRST in what
 * the server answers, so „her pair" and „the first row of `/api/pairs`" are two different keys as
 * well;
 * <li><b>no key is any other number in the fixture</b>. The pairs are 43, 57 and 61, the seasons
 * 2027 and 2028 and the members are numbered in the hundreds, so a screen sending a season, an
 * index or a member number cannot land on the right address by luck.
 * </ul>
 */

/* Read off `src/test/mock/competitors.json` rather than remembered, which is the same reading
   `pages/racingPair.test.tsx` states: 000015 Katarina Novaković is a woman, 000002 Relja
   Momčilović and 000004 Časlav Radenković are men, and 000005 and 000006 are two more members who
   have nothing to do with either. */
const HER = '/sr/takmicar/000015-katarina-novakovic'
const HIS = '/sr/takmicar/000002-relja-momcilovic'

/** A day on which both of the seasons below are still ahead, so `pairsFrom` draws both of her
 *  pairs and neither is history. */
const TODAY = '2026-10-15'

/**
 * THE ADDRESSES, WRITTEN OUT RATHER THAN BUILT.
 *
 * <p><b>A guard may not be written in terms of the thing it guards.</b> The screen builds its
 * address with `member/pairWrites.ts#theBreakingGoesTo`, so a case asking for
 * `theBreakingGoesTo(THE_LATER_PAIR)` would move BOTH the address sent and the address expected
 * whenever that function changed, and would stay green over a screen ending the wrong pair. That
 * is the trap `member/pairInviteAnswered.test.tsx` names about its own address and this is the
 * same trap one verb along.
 *
 * <p>Spelt out, they also say what the route really is: `DELETE /api/pairs/{id}` takes a
 * `racing_pair.id`, while the `PUT` at that same template takes a `pair_invite.id` (ADL A55).
 */
const THE_LATER_PAIR = '/api/pairs/61'

const THE_EARLIER_PAIR = '/api/pairs/57'

const SOMEBODY_ELSES_PAIR = '/api/pairs/43'

/** What the server answers for `/api/pairs`: somebody else's first, then hers, earliest last so
 *  that the order she is drawn in is the screen's doing and not the file's. */
const THREE_PAIRS = [
  { id: 43, season: 2027, memberNumbers: ['000005', '000006'] },
  { id: 61, season: 2028, memberNumbers: ['000015', '000004'] },
  { id: 57, season: 2027, memberNumbers: ['000015', '000002'] },
]

let server: { asked: Asked[]; stop: () => void } | null = null

/** Which pairs this fake server has already been told to end, so that a second read of
 *  `/api/pairs` answers what a real server would rather than the same body for ever. */
let gone = new Set<number>()

/**
 * A server that answers `/api/pairs` and the one write, and lets every other address fall through
 * to the mock on the disc.
 *
 * <p><b>The list is rebuilt on every ask rather than handed back as a fixture</b>, for the reason
 * `member/pairInviteAnswered.test.tsx` gives about the inbox: a server that answered the same
 * body for ever could not tell „the screen read the server again" from „the screen took the row
 * off by itself".
 *
 * @param answering what `DELETE /api/pairs/{id}` answers
 */
function aServerWhere(
  answering: (path: string, init: RequestInit | undefined) => Response | Promise<Response> | null =
    () => did(),
): void {
  gone = new Set()

  server = serverThat((path, init) => {
    if (path === '/api/pairs') {
      return new Response(JSON.stringify(THREE_PAIRS.filter((one) => !gone.has(one.id))), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (/^\/api\/pairs\/\d+$/.test(path)) {
      const said = answering(path, init)

      if (said instanceof Response && said.status < 400) {
        gone.add(Number(path.slice('/api/pairs/'.length)))
      }

      return said
    }

    return null
  })
}

/** Every address this case has asked for, in order. */
const asked = (): string[] => (server?.asked ?? []).map((one) => one.path)

/** Every address a given verb was sent to, which is how „the screen wrote" is told apart from
 *  „the screen read". Both halves matter: `/api/pairs/61` read would be a different fault from
 *  `/api/pairs/61` deleted. */
const sentBy = (how: string): string[] =>
  (server?.asked ?? []).filter((one) => one.init?.method === how).map((one) => one.path)

/** Each line the profile draws about pairs, in the order it draws them, kept apart rather than
 *  joined: a portal that wrote each row's season beside the OTHER row's name says „both are on the
 *  page" just as loudly as one that is right (`pages/racingPair.test.tsx` states the same). */
const pairRows = (): string[] =>
  [...document.querySelectorAll('.profile__pair')].map((one) => one.textContent ?? '')

const breakButtons = () => screen.queryAllByRole('button', { name: sr.pair.breakUp })

/**
 * THE READER BECOMES SOMEBODY ELSE INSIDE ONE VISIT, which is `pages/racingPair.test.tsx`'s own
 * probe and is here for one reason: a message is addressed, and the one place it can be read is
 * the inbox of whoever it was addressed TO.
 */
function Become({ who }: { who: string }) {
  const { signIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        signIn(who)
      }}
    >
      postani {who}
    </button>
  )
}

/** The two members a notice about this break could reach: the half whose pair ended, and a third
 *  member who has nothing to do with either of them. */
const THE_OTHERS = (
  <>
    <Become who="000004" />
    <Become who="000005" />
  </>
)

/** Her own page, drawn and waited for. */
async function herProfile(probe: ReactNode = null): Promise<void> {
  renderAt(HER, 'competitor', '000015', undefined, TODAY, probe)

  await screen.findByRole('heading', { level: 1, name: /Katarina/ })
  await waitFor(() => {
    expect(breakButtons().length).toBe(2)
  })
}

/** Every message in the panel in the header, the way the panel draws them. The trailing slash is
 *  what keeps „Sve poruke" out: that link is `/sr/poruke` and names no message. */
async function panel(user: ReturnType<typeof setupUser>) {
  await user.click(await screen.findByRole('button', { name: /Otvori poruke/ }))

  return screen
    .queryAllByRole('link')
    .filter((one) => /\/poruke\/./.test(one.getAttribute('href') ?? ''))
}

beforeEach(() => {
  clearResourceCache()
  forgetEveryCookie()
})

afterEach(() => {
  server?.stop()
  server = null
  clearResourceCache()
})

describe('„Raskini" on a pair the server is keeping', () => {
  it(
    'sends that pair’s key, and never the first one she holds nor the first one served',
    async () => {
      const user = setupUser()

      aServerWhere()
      await herProfile()

      const before = pairRows()

      expect(at(before, 0)).toContain('Relja Momčilović')
      expect(at(before, 0)).toContain('Za sezonu 2027')
      expect(at(before, 1)).toContain('Časlav Radenković')
      expect(at(before, 1)).toContain('Za sezonu 2028')

      /* **THE SECOND OF THE TWO, AND THAT IS THE WHOLE POINT OF PRESSING IT.** A screen reading
         `held[0].id` ends the earliest pair whichever button is pressed, and pressed first it
         draws exactly the screen the right code draws. Pressed second it does not. */
      await user.click(at(breakButtons(), 1))

      await waitFor(() => {
        expect(sentBy('DELETE')).toEqual([THE_LATER_PAIR])
      })

      /* And the row it named is the row that went, while the other stands. */
      await waitFor(() => {
        expect(breakButtons().length).toBe(1)
      })

      const after = pairRows().join(' ')

      expect(after).toContain('Relja Momčilović')
      expect(after).toContain('Za sezonu 2027')
      expect(after).not.toContain('Časlav Radenković')

      /* **AND THE PAIR THAT IS NOBODY’S BUSINESS IS NEVER NAMED**, at either verb. It stands
         first in what the server answered, so a screen reaching for the first row it was given
         would have sent this address instead. */
      expect(asked()).not.toContain(SOMEBODY_ELSES_PAIR)
    },
    SLOW,
  )

  it(
    'is sent from the other half’s page too, naming the same pair',
    async () => {
      const user = setupUser()

      /* **„Svaka strana", which is one word in the owner’s decision and two columns in the
         schema** (`racing_pair.man_id` and `woman_id`). Measured from his side as well as hers,
         because a fixture that always presses from one of the two passes over a screen - and over
         a route - written for that one alone. */
      aServerWhere()
      renderAt(HIS, 'competitor', '000002', undefined, TODAY)

      await screen.findByRole('heading', { level: 1, name: /Relja/ })
      await waitFor(() => {
        expect(breakButtons().length).toBe(1)
      })

      expect(must(pairRows()[0], 'his row')).toContain('Katarina Novaković')

      await user.click(at(breakButtons(), 0))

      await waitFor(() => {
        expect(sentBy('DELETE')).toEqual([THE_EARLIER_PAIR])
      })

      await waitFor(() => {
        expect(pairRows().join(' ')).toContain(sr.pair.none)
      })
    },
    SLOW,
  )

  it(
    'leaves the pair where it is when the server did not agree, and says what it answered',
    async () => {
      const user = setupUser()

      /* **404 IS FOUR CALLERS AT ONCE AND `PairWriteApi` MEANS IT TO BE:** a pair that is not
         there, one that is not his, one of a season that is over, and one whose half has stopped
         paying. Told apart, the numbers would answer which pairs exist and who is in them to
         anybody walking the keys. The member’s own truth is the same in all four. */
      aServerWhere(() => answeredWith(404))
      await herProfile()

      await user.click(at(breakButtons(), 1))

      /* **The sentence is the ROUTE’S OWN for its one number, and not the portal’s general one**,
         because that route names no refusal at all (`PairWriteApi.end` reaches for `away()` and
         never for `no(...)`) and the general sentence for a 404 tells her to try again in a few
         minutes, which is wrong for three of the four callers this 404 stands for (PENDING
         stavka 316). Its text is a PROPOSAL and not the owner’s words. */
      expect(await screen.findByText(sr.pair.breakRefused.notHeld)).toBeVisible()
      expect(
        screen.queryByText(sr.server.wrong.replace('{status}', '404')),
        'the general sentence for a 404 is not said as well',
      ).not.toBeInTheDocument()

      /* **AND THE PAIR IS STILL DRAWN, WITH ITS BUTTON.** A break the server refused has not
         happened, so a screen that removed the row anyway would tell her the opposite of what the
         server holds, and leave her nothing to press again. */
      expect(breakButtons().length).toBe(2)
      expect(pairRows().join(' ')).toContain('Časlav Radenković')
    },
    SLOW,
  )

  it(
    'says what the server answered under the row it is about, and under no other',
    async () => {
      const user = setupUser()

      aServerWhere(() => answeredWith(500))
      await herProfile()

      await user.click(at(breakButtons(), 1))

      /* **ONE alert and not two.** Held without the key of the row it belongs to, a refusal about
         the pair for 2028 prints itself under the pair for 2027 as well, and she reads that both
         of her pairs failed to end. */
      const alerts = await screen.findAllByRole('alert')

      expect(alerts.length).toBe(1)
      expect(must(alerts[0], 'the alert').textContent).toBe(
        sr.server.wrong.replace('{status}', '500'),
      )

      /* **AND IT STANDS DIRECTLY UNDER THE ROW SHE PRESSED**, which a count of alerts cannot say:
         one alert drawn under the OTHER pair is still one alert, and she would read that the
         pair for 2027 failed to end when it was the pair for 2028 she pressed. The sentence
         cannot live inside the row (`ServerSaid` draws a `<p>`, and a `<p>` inside a `<p>` is
         closed by the parser), so where it stands is the only way the row owns it. Found by a
         mutation that put it under the other row and left the whole file green (02.10.2026). */
      const pressed = must(at(breakButtons(), 1).closest('p'), 'the row she pressed')

      expect(pressed.nextElementSibling).toBe(alerts[0])
    },
    SLOW,
  )

  it(
    'writes nothing into the browser’s own inbox, because the route writes the message itself',
    async () => {
      const user = setupUser()

      aServerWhere()
      await herProfile(THE_OTHERS)

      await user.click(at(breakButtons(), 1))

      await waitFor(() => {
        expect(sentBy('DELETE')).toEqual([THE_LATER_PAIR])
      })

      /* **PDL, 07.09.2026: „„Raskini" obaveštava drugu polovinu."** `PairWriteApi.end` pays that
         itself, in the same transaction as the delete, with the portal’s own `pair.endedBody`
         (`theBrokenPairReads`). A `notify` beside the send would be the same fact in two homes -
         one durable row and one copy that dies with the tab - and the member on the far side
         would be told twice, or, worse, only inside the presser’s own browser.
       *
         **READ IN THE INBOX OF THE MEMBER IT WOULD BE ADDRESSED TO, AND THAT IS THE WHOLE
         CORRECTION.** The first draft of this case read HER panel, and it could not have caught
         anything: `session/SessionProvider.tsx` filters the held inbox with
         `one.to === '' || one.to === memberNumber`, and such a notice is addressed to the
         PARTNER. So the assertion was satisfied by a message it is unable to see, which is „two
         sources for one value" in the fixture rather than in the code - and the mutation that
         restores `notify` sailed through it. Measured: with her panel it passed, with his it
         fails. */
      await user.click(screen.getByRole('button', { name: 'postani 000004' }))

      const his = await panel(user)

      /* **The panel is really open, and that is asserted rather than assumed.** „He was told
         nothing" is a claim about absence, and a panel that never opened answers it exactly as
         well as a portal that wrote nothing. The served inbox carries rows for every member, so
         the same read witnesses itself. */
      expect(his.length).toBeGreaterThan(0)
      expect(his.filter((one) => new RegExp(sr.pair.brokenSubject).test(one.textContent ?? ''))
        .length).toBe(0)

      /* **And a third member who is in neither half of that pair**, which is the axis that
         catches a notice written to the whole league: `to: ''` passes the filter above for
         EVERYBODY, so a mutation that addressed it that way would still be absent from one named
         inbox and present in every one. */
      await user.click(screen.getByRole('button', { name: 'postani 000005' }))

      const anybody = await panel(user)

      expect(anybody.length).toBeGreaterThan(0)
      expect(
        anybody.filter((one) => new RegExp(sr.pair.brokenSubject).test(one.textContent ?? ''))
          .length,
      ).toBe(0)
    },
    SLOW,
  )

  it(
    'lets the next mount read the server again, so the pair is gone after a reload',
    async () => {
      const user = setupUser()

      aServerWhere()
      await herProfile()

      await user.click(at(breakButtons(), 1))

      await waitFor(() => {
        expect(sentBy('DELETE')).toEqual([THE_LATER_PAIR])
      })

      /* **THE DROP IS FOR THE NEXT MOUNT AND THE VISIT’S OWN RECORD IS FOR THIS ONE**, which is
         `data/useResource.ts`’s own sentence: „dropped without the bump, nothing re-reads". So
         the cache line alone would leave the row on the screen she is looking at, and the visit’s
         record alone would bring the pair back the moment she walked away and came back. Both are
         needed and this is the half a reload measures. */
      const readsBefore = asked().filter((one) => one === '/api/pairs').length

      await user.click(at(screen.getAllByRole('link', { name: 'Takmičari' }), 0))
      await screen.findByRole('heading', { level: 1, name: /Takmičari/ })
      await user.click(await screen.findByRole('link', { name: /Katarina Novaković/ }))
      await screen.findByRole('heading', { level: 1, name: /Katarina/ })

      await waitFor(() => {
        expect(asked().filter((one) => one === '/api/pairs').length).toBeGreaterThan(readsBefore)
      })

      /* And what came back no longer holds it, so only the pair that was not ended is drawn. */
      await waitFor(() => {
        expect(breakButtons().length).toBe(1)
      })

      expect(pairRows().join(' ')).not.toContain('Časlav Radenković')
    },
    SLOW,
  )

  it(
    'sends one request for two presses inside one task, and tells the buttons off while it waits',
    async () => {
      /* **No `setupUser` here, and that is the case rather than an omission.** Every other case in
         this file presses with `user.click`, which awaits between events and lets React render.
         This one must dispatch both presses inside ONE task to tell a ref from the state beside
         it, so it uses `fireEvent` inside `act` and has nothing to ask a user-event instance for.
       *
         A request that never comes back, which is the only way to look at the screen WHILE it is
         waiting. `serverThat` takes a promise for exactly this. */
      let release = (): void => {}

      aServerWhere(
        () =>
          new Promise<Response>((settle) => {
            release = () => {
              settle(did())
            }
          }),
      )

      await herProfile()

      const second = at(breakButtons(), 1)

      /* **THE GUARD IS A REF AND NOT THE STATE BESIDE IT**, so the case may not press with
         `user.click` twice: Testing Library awaits between clicks, which lets React render, and a
         screen guarded only by state would turn the second press away and look sound while being
         unguarded. Both events are dispatched inside one `act`, so the second handler runs before
         any render and reads what the first wrote synchronously. */
      await act(async () => {
        fireEvent.click(second)
        fireEvent.click(second)
      })

      await waitFor(() => {
        expect(sentBy('DELETE')).toEqual([THE_LATER_PAIR])
      })

      /* **TOLD OFF RATHER THAN SWITCHED OFF, AND ON EVERY ROW.** `disabled` would take the button
         out of the tab order under the fingers of the one member who cannot see where he landed,
         and the guard above refuses a press on ANY row while one is out - so a button that will
         refuse says so beforehand rather than after. */
      for (const one of breakButtons()) {
        expect(one.getAttribute('aria-disabled')).toBe('true')
      }

      release()

      await waitFor(() => {
        expect(breakButtons().length).toBe(1)
      })

      expect(at(breakButtons(), 0).getAttribute('aria-disabled')).toBe('false')
    },
    SLOW,
  )

  it(
    'does not leave a refusal glued to the reader when they follow the partner’s own link',
    async () => {
      const user = setupUser()

      aServerWhere(() => answeredWith(404))
      await herProfile()

      await user.click(at(breakButtons(), 1))

      expect(await screen.findByText(sr.pair.breakRefused.notHeld)).toBeVisible()

      /* **SHE LEAVES BY THE PARTNER’S OWN NAME, THE LINK INSIDE THE VERY ROW SHE JUST PRESSED
         „RASKINI" ON.** `RacingPairLine` is mounted once, at a fixed spot in
         `pages/CompetitorProfile.tsx`, and the route it sits under carries no `key`
         (`app/routeObjects.tsx`), so React keeps this same instance mounted across the
         navigation and its `refused` state survives with it. */
      await user.click(await screen.findByRole('link', { name: /Časlav Radenković/ }))

      await screen.findByRole('heading', { level: 1, name: /Časlav/ })

      /* **HIS PAGE HAS NO „RASKINI" AT ALL.** Ending a pair is only ever the reader’s own act,
         and she is reading somebody else’s page now. */
      expect(breakButtons().length).toBe(0)

      /* **AND NO ALERT EITHER, THOUGH `refused` STILL NAMES THAT SAME PAIR.** The questions
         still standing are the reader’s own, and only on their own page (odluka 07.09.2026); a
         `role="alert"` a screen reader would read out on arrival, about a press that happened on
         a different page, says something happened here that did not. */
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText(sr.pair.breakRefused.notHeld)).not.toBeInTheDocument()
    },
    SLOW,
  )

  it(
    'frees the row it refused for a second try, and a later success elsewhere clears it',
    async () => {
      const user = setupUser()

      aServerWhere((path) => (path === THE_LATER_PAIR ? answeredWith(404) : did()))
      await herProfile()

      await user.click(at(breakButtons(), 1))

      expect(await screen.findByText(sr.pair.breakRefused.notHeld)).toBeVisible()

      /* **TOLD OFF ONLY WHILE IT IS OUT, NOT FOR EVER AFTER A REFUSAL.** `endIt` releases both
         the ref and the state on the branch that answers with a refusal; a screen that freed the
         ref but left the state saying „busy" would tell her, wrongly, that a row nobody is
         touching is still sending. */
      await waitFor(() => {
        expect(at(breakButtons(), 1).getAttribute('aria-disabled')).toBe('false')
      })

      /* **AND THE REF ITSELF WAS RELEASED, PROVED BY A SECOND REQUEST ACTUALLY LEAVING.** A
         screen that left `outstanding.current` on would answer this second press by returning
         before ever asking the server, and no second `DELETE` would be sent. */
      await user.click(at(breakButtons(), 1))

      await waitFor(() => {
        expect(sentBy('DELETE')).toEqual([THE_LATER_PAIR, THE_LATER_PAIR])
      })

      /* **A DIFFERENT ROW, ENDED WITH THE SERVER’S AGREEMENT.** */
      await user.click(at(breakButtons(), 0))

      await waitFor(() => {
        expect(sentBy('DELETE')).toEqual([THE_LATER_PAIR, THE_LATER_PAIR, THE_EARLIER_PAIR])
      })

      await waitFor(() => {
        expect(breakButtons().length).toBe(1)
      })

      /* **AND THE STALE REFUSAL ABOUT THE OTHER PAIR IS GONE, TOO.** `setRefused(null)` runs at
         the top of `endIt` for whichever row is pressed, not only the one the refusal was about,
         so starting this attempt clears the earlier one before this attempt even reaches the
         server. */
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    },
    SLOW,
  )
})
