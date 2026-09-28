import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { did, refused, serverThat } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { decisionPath } from './verificationWrites'
import { QUEUE } from './queues'

/**
 * THE MODERATOR SEES THE PHOTOGRAPH HE IS DECIDING ABOUT, PAID BACK FROM PENDING.md'S
 * "DUG KOJI SE MORA VRATITI".
 *
 * <p><b>Why this file exists rather than adding to `theRealAnswer.test.tsx`.</b> That
 * file's own case ("draws no frame where the answer carries no picture") holds the
 * negative half and says plainly why it cannot hold the rest: it is tied to the alt
 * text alone, and a frame fed an `alt` read off the row instead of through
 * `t('verification.pictureAlt', ...)` survives it. What is missing there is the
 * positive half - a real `photoId` actually drawing something - and the axis that
 * matters most on a shared tab: a photo row and a bio row side by side, where only
 * one may show a picture and the other must not, for a reason that lives in the
 * BACKEND (`MeWriteApi` inserts a biography's row with no `photo_id` at all) rather
 * than in anything this file could fake by leaving a field out.
 *
 * <p><b>The owner's own words, PENDING.md, 27.09.2026:</b> "kad neko posalje sliku na
 * odobrenje, zelim da dobijem jedan jedini red na strani verifikacije gde cu videti tu
 * sliku i odobriti njeno takvo postavljanje na profil clana."
 *
 * <p><b>Since 28.09.2026 this file also holds PDL.md's "29. Slika koja ne moze da se
 * ucita"</b> (owner, 27.09.2026): a picture that fails to load draws a sentence rather
 * than nothing, Odobri is disabled beside it, and Odbij still reaches the route. Kept
 * here rather than in a file of its own, because it is the same axis the cases above
 * already walk - a row with `photoId` and one without - with one more state added to
 * it: `photoId` present but the load itself failed.
 */

const RATING = { organisation: 0, value: 0, ambience: 0 }

/** A row the schema really produces for an uploaded photograph: `MePhotoApi` fills
 *  `photo_id`, and `VerificationApi.Waiting.kind` reads that presence back as
 *  `'photo'` for the profiles tab. `body` is `''` for the same reason and not a
 *  guess: `MePhotoApi.java` inserts `body: ''` on every row it gives a `photo_id`
 *  (`insert into verification (... body ...) select ?, ..., '', ?`), so there is no
 *  file name in this row for a moderator to read back - only the empty field this
 *  fixture used to fake one in. */
const aPhotoRow = {
  queue: 'profiles' as const,
  id: 21,
  date: '2026-09-20',
  memberNumber: '000011',
  who: 'Neda Nedić',
  subject: 'Neda Nedić',
  subjectId: '',
  body: '',
  kind: 'photo' as const,
  city: '',
  country: '',
  photoId: 9,
  rating: RATING,
}

/** THE OTHER STATE OF THE SAME TAB, and the one the debt names by file and line:
 *  `MeWriteApi.java` inserts a biography's row as `insert into verification (queue,
 *  competitor_id, subject, body)` - no `photo_id` column in the statement at all, so
 *  the schema's own default leaves it null and `kind` reads back as `'bio'`. */
const aBioRow = {
  ...aPhotoRow,
  id: 22,
  memberNumber: '000012',
  who: 'Petar Petrović',
  subject: 'Petar Petrović',
  body: 'Trčim od malena, najviše volim brdske staze.',
  kind: 'bio' as const,
  photoId: null,
}

function answering(rows: unknown[]) {
  return serverThat((path) =>
    path === '/api/verification'
      ? new Response(JSON.stringify(rows), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      : null,
  )
}

const cardOf = (name: string) =>
  within(must(screen.getByRole('heading', { name }).closest('li'), `the card of ${name}`))

const openQueue = () => renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin')

describe('the picture on a card the moderator is deciding about', () => {
  it('is drawn from the address the row itself names, not from anything carried on the item', async () => {
    const { stop } = answering([aPhotoRow])

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      const picture = cardOf('Neda Nedić').getByRole('img', { name: /Slika koju je poslao/ })

      expect(picture).toBeVisible()
      /* The attribute and not `.src`: jsdom resolves the latter to an absolute
         `http://localhost/...`, and the one thing worth pinning here is that the
         portal asked a relative `/api` address rather than one it built a host into. */
      expect(picture.getAttribute('src')).toBe('/api/verification/21/photo')
      /* The dictionary's own sentence, naming who sent it - never the file name or
         the subject read straight off the row, which is exactly the mutation
         `theRealAnswer.test.tsx` already measured this alt text against. */
      expect(picture).toHaveAccessibleName('Slika koju je poslao Neda Nedić')
      /* The row's own „Datoteka" field stays too, picture or not - empty here
         because it always is for a photo row (`MePhotoApi.java` inserts `body: ''`
         for every one it gives a `photo_id`), never a name to read. */
      expect(cardOf('Neda Nedić').getByText('Datoteka')).toBeVisible()
      /* THE OTHER STATE OF THE AXIS PDL.md "29." ADDS: a picture that DID load.
         Asserted here and not only where loading fails, or a mutation that disabled
         Odobri unconditionally - or read the wrong fact, `photoId === null` instead
         of "this row's own load failed" - would pass every case below and be
         invisible from the failing side alone. */
      expect(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' })).toHaveAttribute(
        'aria-disabled',
        'false',
      )
    } finally {
      stop()
    }
  })

  it('is absent from a biography beside a photograph on the very same tab', async () => {
    /* BOTH STATES OF THE AXIS IN ONE RENDER, so a gate that answered every card the
       same way - always or never - fails here rather than in two separate files that
       could each be satisfied by a different bug. */
    const { stop } = answering([aPhotoRow, aBioRow])

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      expect(
        cardOf('Neda Nedić').getByRole('img', { name: /Slika koju je poslao/ }),
      ).toBeVisible()
      expect(
        cardOf('Petar Petrović').queryByRole('img', { name: /Slika koju je poslao/ }),
      ).not.toBeInTheDocument()
      /* A biography never had a picture to fail, so PDL.md "29." does not reach it:
         Odobri stays enabled. This is what tells "this row's load failed" apart
         from "this row's photoId is null" - a card gated on the second instead of
         the first would disable Odobri here too, where PDL P22 asks nothing of a
         picture at all. */
      expect(cardOf('Petar Petrović').getByRole('button', { name: 'Odobri' })).toHaveAttribute(
        'aria-disabled',
        'false',
      )
    } finally {
      stop()
    }
  })

  it('draws nothing at all under the harness most cases still read, which carries no photoId key', async () => {
    /* NO SERVER INSTALLED HERE ON PURPOSE. `test/setup.ts` answers `/api/verification`
       straight off `src/test/mock/verification.json`, a file with no `photoId` key on
       any of its fourteen rows - not even on the two `kind: 'photo'` ones. Without
       `served.photoId ?? null` in `admin/pending.ts#itemFrom`, `undefined !== null` is
       true and every card on this default screen would try the address. */
    openQueue()

    const waiting = await screen.findByRole('list', { name: /Čeka/ })

    expect(
      within(waiting).queryByRole('img', { name: /Slika koju je poslao/ }),
    ).not.toBeInTheDocument()
    /* And the screen still drew something: an empty query passing because nothing
       rendered at all would say nothing about the gate. */
    expect(within(waiting).getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('says the picture is unavailable and disables Odobri, rather than leaving a broken image icon, once the address answers nothing usable', async () => {
    /* THE ONE OBSERVATION THAT STANDS FOR BOTH "no right over this row" and "the file
       is gone": `PhotoApi.waitingOn` answers both, and a row that was never given a
       picture, with the identical 404 (`nothingIsHere`), on purpose (ADL A8). An
       `<img>` cannot tell any of the three apart either, so one failed load is what
       proves all three are handled alike.

       PDL.md "29. Slika koja ne moze da se ucita" (owner, 27.09.2026): the sentence
       replaces the picture, Odobri is disabled beside it, and both are read off the
       identical fact - `PendingQueue`'s own `brokenPictures` - rather than guessed
       twice. */
    const { stop } = answering([aPhotoRow])

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      const picture = cardOf('Neda Nedić').getByRole('img', { name: /Slika koju je poslao/ })

      fireEvent.error(picture)

      expect(
        cardOf('Neda Nedić').queryByRole('img', { name: /Slika koju je poslao/ }),
      ).not.toBeInTheDocument()
      /* The dictionary's own sentence, not a broken image icon and not silence:
         `sr.json`'s `verification.pictureUnavailable`. */
      expect(
        cardOf('Neda Nedić').getByText(
          'Slika nije dostupna: fajl se ne može učitati, pa se ovaj red ne može odobriti dok se slika ne vidi. Odbijanje i dalje radi.',
        ),
      ).toBeVisible()
      /* Told off, not switched off, the same shape every other reason this button
         cannot act is in (PendingQueue.tsx, `why !== null`, `decisionUnknown`): the
         control stays reachable so a screen reader lands on the sentence that says
         why, rather than being skipped as `disabled` would skip it. */
      const approve = cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' })

      expect(approve).toHaveAttribute('aria-disabled', 'true')
      expect(approve).not.toBeDisabled()
      expect(approve).toHaveAccessibleDescription(
        'Slika nije dostupna: fajl se ne može učitati, pa se ovaj red ne može odobriti dok se slika ne vidi. Odbijanje i dalje radi.',
      )
      /* The card itself, and the row's own fields on it, are untouched: a picture
         that cannot be shown is not a reason to lose the rest of the row. */
      expect(screen.getByRole('heading', { name: 'Neda Nedić' })).toBeVisible()
      expect(cardOf('Neda Nedić').getByText('Datoteka')).toBeVisible()
    } finally {
      stop()
    }
  })

  it('lets neither press reach the wrong outcome once the picture has failed to load: Odobri does nothing, Odbij still works', async () => {
    /* PDL.md "29.": approving is refused because a moderator who cannot see the
       picture has nothing to approve, and that reasoning says nothing about
       refusing it - a picture an instruction is written against is exactly a
       picture nobody has to see first.

       BOTH HALVES IN ONE CASE, and neither would be measured by the other:
       `aria-disabled` alone does not stop a press from reaching the handler
       (PendingQueue.tsx says so of `why`/`decisionUnknown` already, and
       `pictureUnavailable` is written the identical way), so a `!pictureUnavailable`
       quietly dropped from the `onClick` guard would leave this card's
       `aria-disabled="true"` and its Odobri fully working - measured, not assumed,
       by pressing it rather than only reading its attribute. And a fix that
       swept too wide - disabling the CARD rather than the one button - would take
       Odbij with it, which is exactly what PDL.md's four rejected outcomes warn
       against ("krije posao iz reda"). */
    const { asked, stop } = answering([aPhotoRow])

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      fireEvent.error(cardOf('Neda Nedić').getByRole('img', { name: /Slika koju je poslao/ }))

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      expect(
        asked.find((one) => one.path === decisionPath('21')),
        'Odobri must not reach the decision route while the picture is unavailable',
      ).toBeUndefined()

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odbij' }))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Slika je nejasna.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      const sent = asked.find((one) => one.path === decisionPath('21'))

      expect(sent, 'a request to the decision route').toBeDefined()
      expect(JSON.parse(String(sent?.init?.body))).toEqual({
        approved: false,
        reason: 'Slika je nejasna.',
      })
    } finally {
      stop()
    }
  })

  it('lets a sweep skip a row whose picture has not loaded, counts only the rest, and leaves that row waiting', async () => {
    /* PDL.md "29.": „gledanje je uslov odobravanja" names a condition on the ACT
       of approving, not on one button, so a sweep over many rows is not a second
       door around it - the same reasoning `approveAll`'s own doc already applies
       to a team it cannot decide (`refusal`, `continue`, no `done`).

       BOTH HALVES IN ONE CASE, because either alone is satisfied by a wrong
       answer: "Rešena je 1 stavka" alone would also be true of a sweep that
       silently approved the picture too and only the biography's count survived
       by accident, and "the picture row still waits" alone would also be true of
       a sweep that stopped there instead of reaching the row after it - which is
       PDL.md's own rejected outcome, a sweep that "krije posao iz reda" by never
       reaching what follows a row it cannot decide. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { asked, stop } = answering([aPhotoRow, aBioRow])

    try {
      const user = setupUser()

      openQueue()
      const waiting = await screen.findByRole('list', { name: /Čeka/ })

      fireEvent.error(cardOf('Neda Nedić').getByRole('img', { name: /Slika koju je poslao/ }))

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(
        asked.find((one) => one.path === decisionPath('21')),
        'the row with the unavailable picture must not be decided by the sweep',
      ).toBeUndefined()

      const settled = asked.find((one) => one.path === decisionPath('22'))

      expect(settled, 'the row after it must still be decided').toBeDefined()
      expect(JSON.parse(String(settled?.init?.body))).toEqual({ approved: true, reason: '' })

      /* The count the sweep actually settled - one, not two and not nought - is
         the one number that tells "skipped and moved on" apart from either
         "silently approved both" or "stopped at the first". */
      expect(screen.getByText(/^Rešen.* 1 stavk/)).toBeVisible()

      /* And the skipped row is still in the list waiting, not swept away with
         nothing decided about it. */
      expect(within(waiting).getByRole('heading', { name: 'Neda Nedić' })).toBeVisible()
    } finally {
      confirm.mockRestore()
      stop()
    }
  })

  it('reads the freshest broken picture during a walk already under way, not the one the walk started with', async () => {
    /* Review's own measurement, reproduced exactly: two rows, biography FIRST
       and photograph second; the biography's decision held open so the walk is
       PARKED on it; the photograph's picture fails DURING that wait, never
       before the walk started and never after it finished. A closure over
       `brokenPictures` taken when the walk began cannot see this - only a live
       read can (`brokenPicturesRef`'s own doc in PendingQueue.tsx). */
    let releaseBio = (): void => {}
    const bioHeld = new Promise<Response>((resolve) => {
      releaseBio = () => resolve(did())
    })
    const { asked, stop } = serverThat((path) => {
      if (path === '/api/verification') {
        return new Response(JSON.stringify([aBioRow, aPhotoRow]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return path === decisionPath('22') ? bioHeld : null
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      /* Starts the walk. It reaches the biography first, asks the route, and
         parks on `bioHeld` - not yet resolved - before it has looked at the
         photograph at all. */
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      /* The picture fails WHILE the walk is parked there. Proven by the
         sentence actually reaching the screen before the walk is let through,
         not assumed from the order these two lines are written in. */
      fireEvent.error(cardOf('Neda Nedić').getByRole('img', { name: /Slika koju je poslao/ }))
      expect(
        cardOf('Neda Nedić').getByText(
          'Slika nije dostupna: fajl se ne može učitati, pa se ovaj red ne može odobriti dok se slika ne vidi. Odbijanje i dalje radi.',
        ),
      ).toBeVisible()

      /* Only now does the walk move past the biography. */
      releaseBio()

      await waitFor(() => {
        expect(screen.getByText(/^Rešen/)).toBeVisible()
      })

      expect(
        asked.find((one) => one.path === decisionPath('21')),
        'the photograph must not be decided: its picture had already failed by the time the walk reached it',
      ).toBeUndefined()
    } finally {
      confirm.mockRestore()
      stop()
    }
  })

  it("does not clear another card's refusal when Odobri is pressed on a row whose picture has failed to load", async () => {
    /* PDL.md "29." is answered by refusing to START a walk over this row at
       all (`brokenPicturesRef` read in the button's own `onClick`), not by
       starting one `approveAll` would then skip: `approveAll` reports what it
       settled through `sayIt` UNCONDITIONALLY, so a walk that settles NOTHING
       because its one row was skipped still calls `sayIt(null)` and clears
       whatever OTHER card's refusal was on screen. Measured in both
       directions: with the `onClick` guard reading `pictureUnavailable` (a
       render-time value) simply removed rather than replaced by the live ref,
       this case fails; with the ref there, it passes. */
    const { stop } = serverThat((path) => {
      if (path === '/api/verification') {
        return new Response(JSON.stringify([aBioRow, aPhotoRow]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return path === decisionPath('22') ? refused('O stavci je već odlučeno.') : null
    })

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Petar Petrović').getByRole('button', { name: 'Odobri' }))

      const said = await screen.findByRole('alert')

      expect(said).toHaveTextContent('O stavci je već odlučeno.')

      fireEvent.error(cardOf('Neda Nedić').getByRole('img', { name: /Slika koju je poslao/ }))
      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      expect(
        screen.getByRole('alert'),
        "Petar Petrović's refusal must survive a press on a different card that decided nothing",
      ).toHaveTextContent('O stavci je već odlučeno.')
    } finally {
      stop()
    }
  })

  it("checks a row's own picture before asking for its own approval, and cannot check it again once that request is already out", async () => {
    /* THE NARROWER RACE, named apart from "reads the freshest..." above: not a
       LATER row breaking while an EARLIER row's own request is out, but THIS
       SAME row's own picture breaking while THIS SAME row's own single-card
       `approveAll([one], teams)` is awaiting THIS SAME row's own
       `askTheServer`. Written because the question deserved a measurement,
       not my own reasoning about whether `onClick` reading `brokenPicturesRef`
       instead of `pictureUnavailable` would still matter here.

       MEASURED, NOT ASSUMED: the request already stands in `asked` the instant
       `user.click` resolves, before this test's next line can even fire the
       picture's own `error` event. `onClick`'s guard and the loop's own skip
       both run synchronously and must both already have passed - failing
       either is the only way `askTheServer` is never reached - so by the time
       a picture could fail "during" that one call, this row's request has
       already left for the server. The mutation below (`onClick` reading
       `pictureUnavailable` instead of the ref) is measured to leave this
       assertion standing, because the swap only touches a check that has
       already run by the time there is anything left to race against. */
    let releaseOwn = (): void => {}
    const ownHeld = new Promise<Response>((resolve) => {
      releaseOwn = () => resolve(did())
    })
    const { asked, stop } = serverThat((path) => {
      if (path === '/api/verification') {
        return new Response(JSON.stringify([aPhotoRow]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return path === decisionPath('21') ? ownHeld : null
    })

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      /* Already true before the picture fails at all - the proof that there
         is no later point left at which anything inside `onClick` could still
         intervene. */
      expect(
        asked.find((one) => one.path === decisionPath('21')),
        "this row's own decision, already asked for before its own picture could fail",
      ).toBeDefined()

      fireEvent.error(cardOf('Neda Nedić').getByRole('img', { name: /Slika koju je poslao/ }))
      releaseOwn()

      /* And the server's own "done" is honoured once it answers, per PDL P28f
         ("po odobravanju slika se tog trenutka pocinje da se vidi"): a
         decision the server has already recorded is not one this screen
         un-asks for by noticing, only after the fact, that the picture
         failed. */
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Neda Nedić' })).toBeNull()
      })
    } finally {
      stop()
    }
  })
})
