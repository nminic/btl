import { SLOW } from '../../test/slow'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { livePage } from '../../data/pages'
import { I18nProvider } from '../../i18n/I18nProvider'
import { RoleProvider } from '../../roles/RoleProvider'
import { SessionProvider } from '../../session/SessionProvider'
import { first, must } from '../../test/at'
import { Decided } from '../../test/decided'
import { moderatorWith, expectFrontPage, renderAt } from '../../test/render'
import { did, serverThat } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { Entities } from './Entities'
import { TEAMS } from './entityForms'
import { RowActions } from './EntityEditor'
import { Verification } from './Verification'

/* Deleting a record, and the two things it must not quietly do: leave the
 * identity behind, and leave the record behind. */

/**
 * „A RECORD ENTERED UNDER AN IDENTITY A DELETION HAD JUST FREED" MOVED TO
 * `adminMemberWrites.test.tsx` ON 26.09.2026, AND BOTH OF ITS ENDS CHANGED ON THE WAY.
 *
 * <p>It deleted a member and then entered one on the member form, which was the second place
 * that handed member numbers out. That form is gone (PDL P8b, and the note on
 * `admin/AdminMembers.tsx`), so the case had no second end - but nothing it measures has gone
 * anywhere: the deletion is a real `DELETE /api/competitors/{memberNumber}` now, and numbers
 * are still handed out when a membership is activated (`admin/memberNumbers.ts:121`, ADL A4d).
 *
 * <p>So it lives there as „hands a number a deletion freed to an activation, without the old
 * row coming with it", walked across two screens in one visit. The fault underneath is
 * unchanged and is worth restating where somebody looking for it would come: deletions were
 * one flat list of identities and the list of records was filtered by it AFTER this visit's
 * entries had been merged in, so a member arriving on a freed number saved, confirmed, and was
 * then not in the list - and the overlay of changes being keyed by the identity, a record that
 * survived would have worn the deleted member's town and name.
 */


describe('a record entered during this visit and then deleted', () => {
  it('goes altogether, rather than being filtered out of a list it is still in', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    await screen.findByRole('table', { name: 'Timovi' })
    const table = () => within(screen.getByRole('table', { name: 'Timovi' }))
    const before = table().getAllByRole('row').length

    await user.click(screen.getByRole('button', { name: 'Novi tim' }))
    await user.type(screen.getByLabelText(/^Naziv tima/), 'Probni tim')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.selectOptions(screen.getByLabelText(/^Organizator tima/), '000001')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    await screen.findByText('Probni tim')
    expect(table().getAllByRole('row')).toHaveLength(before + 1)

    await user.click(table().getByRole('button', { name: 'Obriši: Probni tim' }))
    await user.click(table().getByRole('button', { name: 'Potvrdi brisanje: Probni tim' }))

    expect(table().queryByText('Probni tim')).not.toBeInTheDocument()
    expect(table().getAllByRole('row')).toHaveLength(before)
  })
})

describe('the focus after a row is deleted', () => {
  it('goes to the one control on the screen that cannot be the row just deleted', async () => {
    /**
     * A SERVER THAT CONFIRMS THE DELETION, WHICH THIS CASE NEEDS SINCE 26.09.2026 AND
     * WOULD HAVE BEEN GREEN WITHOUT.
     *
     * The row acted on here is the FIRST SERVED team, so its delete goes to
     * `DELETE /api/teams/{id}` (`admin/AdminTeams.tsx`). The disc reader behind these
     * cases answers by resource name and its pattern is `^\/api\/([a-z]+)$`
     * (`test/setup.ts`), which an address carrying an id does not match - so the request
     * came back 404 and the row STAYED, with a refusal drawn beside it.
     *
     * **And the assertion below would not have noticed.** `RowActions.deleteRow` moves the
     * focus before it asks anybody, so the focus lands on „Novi tim" whatever the server
     * says. The case would have gone on passing while measuring a refused deletion, which
     * is worse than a red one: the thing it is named after would be the only thing still
     * true about it.
     *
     * **Its own server rather than a branch in `test/setup.ts`**, deliberately: that file
     * is read by every case in the suite, and three other branches are writing to it this
     * week. What this case needs is one answer, so it holds one answer.
     */
    const server = serverThat((_, init) => ((init?.method ?? 'GET') === 'GET' ? null : did()))
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    const table = () => within(screen.getByRole('table', { name: 'Timovi' }))
    await screen.findByRole('table', { name: 'Timovi' })

    const remove = first(table().getAllByRole('button', { name: /^Obriši:/ }))
    const name = must(remove.getAttribute('aria-label'), 'a name on the delete control').replace('Obriši: ', '')

    await user.click(remove)
    await user.click(table().getByRole('button', { name: `Potvrdi brisanje: ${name}` }))

    /* Without this the focus is on a button that is no longer on the page and
       the next Tab starts from the top; the move is also the only word a screen
       reader gets that anything happened. */
    expect(screen.getByRole('button', { name: 'Novi tim' })).toHaveFocus()

    /* AND THE ROW REALLY WENT, which is what makes the sentence above about a row that is
       „no longer on the page" true rather than aspirational. Awaited, because the row
       leaves on the answer and the focus moved before it. */
    await waitFor(() => {
      expect(table().queryByText(name)).not.toBeInTheDocument()
    })

    server.stop()
  }, SLOW)

  it('does not go looking for it where there is none', async () => {
    /* RowActions drawn on its own, without the strip that carries the control.
       Nothing to move the focus to is not a reason to refuse to delete. */
    const user = setupUser()

    render(
      <I18nProvider locale="sr">
        <SessionProvider>
          <RowActions
            entity={TEAMS}
            record={{ id: 'tim-1', name: 'Probni' }}
            name="Probni"
            onOpen={vi.fn()}
          />
        </SessionProvider>
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Obriši: Probni' }))

    const sure = screen.getByRole('button', { name: 'Potvrdi brisanje: Probni' })
    await user.click(sure)

    /* Nothing here reads the list, so the row is still drawn; what matters is
       that asking for an anchor that is not on the page neither threw nor moved
       the focus anywhere unexpected. */
    expect(sure).toHaveFocus()
  })
})

describe('a deleted written page', () => {
  it('stops being served, rather than going off the list and answering as before', () => {
    const page = { slug: 'pravilnik', title: 'Pravilnik', sections: [] }

    expect(livePage([page], 'pravilnik', [])).toBe(page)
    expect(livePage([page], 'pravilnik', ['pravilnik'])).toBeUndefined()
  })
})

describe('a section with nothing in it', () => {
  /* Behind the door, which asks the same question first (needs.ts), so nobody
     reaches these through the route table. Here in case the door is ever
     loosened: a section that is empty must go to the front page and not draw
     itself with nothing in it. */
  const nobody = () => (
    <I18nProvider locale="sr">
      <SessionProvider>
        <RoleProvider initialRole="moderator" initialModerator={moderatorWith([])}>
          <MemoryRouter initialEntries={['/sr/administracija/entiteti']}>
            <Entities />
            <Verification />
          </MemoryRouter>
        </RoleProvider>
      </SessionProvider>
    </I18nProvider>
  )

  it('sends whoever reached it to the front page', () => {
    // Both render a redirect and nothing else, so nothing of either is drawn.
    const { container } = render(nobody())

    expect(container).toBeEmptyDOMElement()
  })
})

describe('the front page is where a closed door ends', () => {
  it('is reached from a section a moderator holds nothing in', async () => {
    renderAt('/sr/administracija/verifikacija', 'moderator', null, moderatorWith([]))

    await expectFrontPage()
  })
})

describe('one decision for a whole queue', () => {
  it('settles every waiting item at once, after asking', async () => {
    /* Owner, 01.08.2026. It asks first because there is nothing to undo:
       approving is what puts a thing on the portal, and a queue of forty
       approved by a misplaced click is forty things to find again by hand. */
    const user = setupUser()
    const asked: string[] = []
    const confirm = vi.spyOn(window, 'confirm').mockImplementation((message) => {
      asked.push(String(message))
      return true
    })

    try {
      renderAt('/sr/administracija/verifikacija/komentari', 'superadmin', null, undefined, null, <Decided />)

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const before = within(waiting).getAllByRole('listitem').length
      expect(before).toBeGreaterThan(1)

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(asked).toHaveLength(1)
      expect(first(asked)).toContain(String(before))
      expect(await screen.findByText('Nema nijedne stavke na čekanju.')).toBeVisible()
      /* Every one of them decided, read off the session rather than off a table
         of settled items: a queue shows what is waiting and nothing else since
         06.08.2026. */
      expect(
        within(screen.getByRole('list', { name: 'session decisions' })).getAllByRole('listitem'),
      ).toHaveLength(before)
    } finally {
      confirm.mockRestore()
    }
  })

  it('settles every waiting biography, and writes down no text for any of them', async () => {
    /* One decision for the whole queue has to write what one decision at a time
       writes, and since 06.08.2026 that is nothing about the text (PDL P22).

       It used to be the opposite. A biography was approved by publishing
       whatever the moderator had left in the box, so the settled row had to
       carry the text: without it, nothing would have said what actually went
       onto the profile. There is no box now, so an approval publishes what the
       card shows and the item is its own record. This is the same test turned
       around, and it is worth keeping in that shape: what it guards is that a
       sweep and a single press agree, whichever way the rule runs. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      renderAt(
        '/sr/administracija/verifikacija/trkacki-profil',
        'superadmin',
        null,
        undefined,
        null,
        <Decided />,
      )

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const cards = within(waiting)
        .getAllByRole('listitem')
        .filter((one) => within(one).queryByText('Tekst biografije') !== null)

      expect(cards.length).toBeGreaterThan(0)

      /* The text itself, read under the words that name it, and not the whole
         card: the card carries the member's name above it, and a word taken
         from there is a word the biography never had. */
      /* The id of each waiting biography, read off the queue before the sweep so
         the assertion below can name them rather than count them. */
      const queue = JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock/verification.json'), 'utf-8'))
      /* Both sorts, and not the biographies alone. Written for biographies only,
         this lost the cover the old counting assertion had for pictures by
         accident: a review made the sweep skip every photograph and all 1906
         tests passed. One decision for a whole queue means the whole queue. */
      const ids = queue
        .filter((one: { queue: string }) => one.queue === 'profiles')
        .map((one: { id: string }) => one.id)

      const texts = cards.map((one) =>
        must(
          must(
            within(one).getByText('Tekst biografije').nextElementSibling,
            'the biography under the words that name it',
          ).textContent,
          'a waiting biography',
        ),
      )

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      const decided = within(screen.getByRole('list', { name: 'session decisions' }))
      const settled = decided.getAllByRole('listitem').map((one) => String(one.textContent))

      /* Each of them settled, by its own id and not by counting. Written as a
         count it compared the settled items of the whole queue against the
         biographies alone, so two pictures satisfied it: a review made the sweep
         skip every biography and this assertion held (`Decided` writes the id at
         the head of each line, src/test/decided.tsx). */
      for (const id of ids) {
        expect(settled.some((line) => line.startsWith(`${id} | approved`)), id).toBe(true)
      }

      for (const text of texts) {
        const word = must(text.match(/[A-ZŠĐČĆŽ][a-zšđčćž]{4,}/), 'a word of the biography')

        expect(decided.queryAllByText(new RegExp(word[0]))).toEqual([])
      }
    } finally {
      confirm.mockRestore()
    }
  })

  /* THREE CASES ABOUT THE MONEY QUEUE'S SWEEP STOOD IN THIS DESCRIBE AND ARE GONE
   * (27.09.2026), because the sweep is gone: „Aktiviraj sve po osnovu uplate" is not on the
   * screen of payments any more. They held that every activated membership got its OWN number
   * rather than one number for all of them, that the line afterwards named the number really
   * settled, and that answering the question with no activated nobody.
   *
   * WHY THE CONTROL WENT, and it is a decision rather than a simplification. On a queue a row
   * meant „somebody says the money arrived", so one press was one decision taken many times.
   * The screen is a DERIVED list of whoever is not a member yet, so a row now means the
   * opposite - no money has arrived - and the same press would activate every debtor at once
   * and spend a member number on each. The sequence only counts up (V16), so a number spent in
   * error is spent for good, and the text of the question promised exactly that it could not be
   * undone.
   *
   * The ABSENCE is measured, in `pages/admin/adminPayments.test.tsx`: no control on that screen
   * activates anybody, one at a time or all at once. The sweep itself is still measured here on
   * the queues that still have one, which is what the remaining cases of this describe are.
   */
  it('says what it did and takes the focus, rather than leaving it nowhere', async () => {
    /* The button is drawn only while something is waiting, so the sweep takes it
       off the screen in the same render that empties the queue. Without an
       answer the focus falls to the document: the next Tab starts the page from
       the skip link, and for anybody being read to nothing happened at all,
       because the only sign was a table appearing further down. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const before = within(waiting).getAllByRole('listitem').length

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      /* One, two and five are three different sentences in Serbian, so what is
         matched is the shape rather than one of the three.
       *
         AWAITED since 26.09.2026, and it is the only assertion in this file that
         had to be: the sweep now asks the route about each card before it settles
         any (`admin/PendingQueue.tsx`, `approveAll`), so the number on this line
         is set a turn later than the press. The other thirteen cases here read
         things the overlay puts on screen and pass unchanged; this one reads the
         line the count itself creates, and read straight away it found nothing. */
      const said = await screen.findByText(new RegExp(`^Rešen.* ${before} stavk`))

      expect(said).toBeVisible()
      expect(said).toHaveFocus()
    } finally {
      confirm.mockRestore()
    }
  })

  it('settles nothing when the question is answered no', async () => {
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    try {
      renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const before = within(waiting).getAllByRole('listitem').length

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(within(await screen.findByRole('list', { name: /Čeka/ })).getAllByRole('listitem'))
        .toHaveLength(before)
    } finally {
      confirm.mockRestore()
    }
  })
})
