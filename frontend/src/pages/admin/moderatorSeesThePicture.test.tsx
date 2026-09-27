import { fireEvent, screen, within } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
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
 */

const RATING = { organisation: 0, value: 0, ambience: 0 }

/** A row the schema really produces for an uploaded photograph: `MePhotoApi` fills
 *  `photo_id`, and `VerificationApi.Waiting.kind` reads that presence back as
 *  `'photo'` for the profiles tab. */
const aPhotoRow = {
  queue: 'profiles' as const,
  id: 21,
  date: '2026-09-20',
  memberNumber: '000011',
  who: 'Neda Nedić',
  subject: 'Neda Nedić',
  subjectId: '',
  body: 'nova-slika.jpg',
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
      expect(picture).toHaveAccessibleName('Slika koju je poslao Neda Nedić, sa uokvirenim delom koji će se videti')
      /* The file name stays too: it is what the queue is searched and talked about
         by, picture or not. */
      expect(cardOf('Neda Nedić').getByText('nova-slika.jpg')).toBeVisible()
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

  it('is hidden rather than left as a broken image icon once the address answers nothing usable', async () => {
    /* THE ONE OBSERVATION THAT STANDS FOR BOTH "no right over this row" and "the file
       is gone": `PhotoApi.waitingOn` answers both, and a row that was never given a
       picture, with the identical 404 (`nothingIsHere`), on purpose (ADL A8). An
       `<img>` cannot tell any of the three apart either, so one failed load is what
       proves all three are handled alike. */
    const { stop } = answering([aPhotoRow])

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      const picture = cardOf('Neda Nedić').getByRole('img', { name: /Slika koju je poslao/ })

      fireEvent.error(picture)

      expect(
        cardOf('Neda Nedić').queryByRole('img', { name: /Slika koju je poslao/ }),
      ).not.toBeInTheDocument()
      /* The card itself, and the file name on it, are untouched: a picture that
         cannot be shown is not a reason to lose the rest of the row. */
      expect(screen.getByRole('heading', { name: 'Neda Nedić' })).toBeVisible()
      expect(cardOf('Neda Nedić').getByText('nova-slika.jpg')).toBeVisible()
    } finally {
      stop()
    }
  })
})
