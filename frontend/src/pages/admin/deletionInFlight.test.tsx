import { join } from 'node:path'
import { configure, screen, waitFor, within } from '@testing-library/react'
import ts from 'typescript'
import type { Role } from '../../roles/context'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, did, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { theSheet } from '../../test/deleteSheet'
import { sources } from '../../test/sources'
import sr from '../../i18n/sr.json'

/* Every wait is given half of what a case is given, for the reason `rowMembership.test.tsx` gives: a
   mutation then fails on its assertion and not on the clock of the case. */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE SHEET THAT ASKS „OBRIŠI X?" OUTSIDE THE ADMINISTRATION, ASKED THE SAME THINGS ABOUT THE MOMENT THE DELETION
 * IS OUT (owner, 24.10.2026, PDL „Odgovori od 24.10.2026 (popodne)": the window is given to the four places
 * outside the administration - the team's own page, a result on the page of its event, a member's own result and
 * his own rating - and „Stari „Sigurno?" u redu time nestaje iz portala"; and the rule of 02.10.2026, PDL „Odluke
 * iz ciscenja nalaza", first item: „Ne", „Odustani" and Escape are onemoguceni while the request travels, with the
 * state said in words, and the question is closed by whoever asked it when the answer arrives).
 *
 * <p><b>Why a table and not a case in each screen's own file.</b> `DeleteSheet.test.tsx` asks the component alone,
 * and that cannot see the half that lives in the screens: the sheet knows a deletion is out only if the handler it
 * is given RETURNS the promise of it, and a screen that wrote `() => void deleteOne(one)` instead draws a sheet whose
 * „Odustani" works while the request goes on. So the same question is asked of each screen, with the answer to its
 * `DELETE` held, and the screens are listed here once. (The four lists of the administration are asked in
 * `deletionSheet.test.tsx`, and the members' row in `adminMemberWrites.test.tsx`.)
 *
 * <p><b>The list has a floor of its own</b> (the last block): every file that draws `DeleteSheet` is found by
 * asking the parser for the JSX tag, and each one must be a row of this table. A list kept by hand is the list that
 * goes short the day somebody draws a fifth, so the fifth fails here before it fails anywhere a reader would see it.
 *
 * <p><b>The record asked about is the SECOND where there is a list of them</b> - a member's second counted result, for
 * the reason `member/resultToTheServer.test.tsx` gives. The sentence a refusal is drawn as belongs to each screen and
 * is measured in its own file; here a refusal is the answer that closes the sheet (owner, 02.10.2026, the second half
 * of the same rule) and leaves the sentence and the focus with the cross that asked.
 */

type Screen = {
  /** What a failure calls it. */
  name: string
  /** The file that draws the sheet, relative to `src/pages`. */
  source: string
  /** The question, in the screen's words: it is the sheet's name. */
  asks: string
  /** Where it is drawn, as whom, and on which day. */
  at: string
  role: Role
  member?: string
  day?: string
  /** The cross that asks the question about the record to be deleted. */
  ask: () => Promise<HTMLElement>
  /**
   * What the cross is called, where the screen does not call it by a record's name: a member's own rating,
   * „Obriši svoju ocenu". Left out, it is the portal's own „Obriši: {name}", and the sheet names the record.
   */
  words?: { open: string; asks: string }
  /**
   * The number a refusal is answered with here, where a 404 is not a refusal on this screen: the event
   * page reads a 404 to a member's deletion of his rating as „no longer there" and says nothing (the
   * coordinator's decision of 20.10.2026, `event/commentWrites.ts`). Left out, 404.
   */
  refusal?: number
}

const SCREENS: Screen[] = [
  {
    name: 'a team on its own page',
    asks: sr.admin.teamDeleteAsk,
    source: 'TeamDetail.tsx',
    at: '/sr/tim/dunavski-trkaci',
    role: 'competitor',
    member: '000001',
    day: '2026-10-15',
    ask: async () => screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }),
  },
  {
    /* THE X ON A RESULT OF AN EVENT, since 19.10.2026: the league deletes a member's result from
       the page of its event (PDL P9, 18.10.2026), through the same question. The second row of the
       table and not the first, for the reason the member's own list below gives. */
    name: 'a result on the page of its event',
    asks: sr.results.deleteAsk,
    source: 'EventDetail.tsx',
    at: '/sr/kalendar/mrazijada-2020',
    role: 'superadmin',
    ask: async () => {
      const table = within(await screen.findByRole('table', { name: 'Rezultati članova' }))
      const rows = table.getAllByRole('row').slice(1)

      expect(rows.length, 'one row cannot tell a row from the first row').toBeGreaterThan(1)

      return within(must(rows[1], 'the second result')).getByRole('button', { name: /^Obriši: / })
    },
  },
  {
    /* A MEMBER'S OWN RATING ON THE PAGE OF ITS EVENT, since 20.10.2026 (PDL P6, „Član uvek sme da
       obriše svoju ocenu ili da je izmeni"), in the owner's words for the question. */
    name: 'a member\'s own rating on the page of its event',
    asks: sr.event.deleteOwnRatingAsk,
    source: 'event/EventComments.tsx',
    at: '/sr/kalendar/fruskogorski-maraton-2010',
    role: 'competitor',
    member: '000021',
    ask: async () => screen.findByRole('button', { name: sr.event.deleteOwnRating }),
    words: { open: sr.event.deleteOwnRating, asks: sr.event.deleteOwnRatingAsk },
    refusal: 500,
  },
  {
    name: 'a member\'s own counted result',
    asks: sr.results.deleteAsk,
    source: 'member/MyResults.tsx',
    at: '/sr/moji-rezultati',
    role: 'competitor',
    member: '000001',
    ask: async () => {
      const table = within(await screen.findByRole('table', { name: 'Uračunato' }))
      const rows = table.getAllByRole('row').slice(1)

      expect(rows.length, 'one row cannot tell a row from the first row').toBeGreaterThan(1)

      return within(must(rows[1], 'the second counted result')).getByRole('button', {
        name: /^Obriši: /,
      })
    },
  },
]

/**
 * A server whose answer to every `DELETE` is held until `settle` is called.
 *
 * <p>`settle` takes a FUNCTION that makes the answer, and not the answer: a `Response` body can be
 * read once, so one handed to two requests would be spent by the first, and a case that asks the
 * question a second time would meet a body that is already gone - which reads exactly like a server
 * that never answered.
 */
function holdingEveryDeletion() {
  let settle: (answer: () => Response) => void = () => {}
  const held = new Promise<() => Response>((resolve) => {
    settle = resolve
  })
  const server = serverThat((_, init) =>
    init?.method === 'DELETE' ? held.then((make) => make()) : null,
  )

  return { server, settle }
}

/** The sentence that says a request is out, wherever on the page it was drawn. */
const sending = () =>
  screen.queryAllByRole('status').filter((one) => one.textContent === sr.results.sending)

describe('a deletion that is out with the server', () => {
  describe.each(SCREENS)('on $name', (one) => {
    /**
     * Asks the question and answers it, leaving the deletion out, and hands back what a reader is left looking at:
     * the cross, the sheet, and the name of the record.
     *
     * <p><b>Everything is asked of the sheet and of the cross, never of the whole screen</b>, because a name is not an
     * identity: a member's counted results carry the same race twice, so „Obriši: Iločki polumaraton" is two buttons
     * on the page and one in a row.
     */
    async function leaveItOut() {
      const held = holdingEveryDeletion()
      const user = setupUser()

      renderAt(one.at, one.role, one.member ?? null, undefined, one.day ?? null)

      const ask = await one.ask()

      await user.click(ask)

      const sheet = within(await theSheet(one.asks))

      await user.click(sheet.getByRole('button', { name: 'Obriši' }))

      return { ...held, user, ask, sheet, refusal: one.refusal ?? 404 }
    }

    it('names the record in the sheet, and the cross after the words of the screen', async () => {
      const user = setupUser()

      renderAt(one.at, one.role, one.member ?? null, undefined, one.day ?? null)

      const ask = await one.ask()

      expect(ask).toHaveAccessibleName(one.words?.open ?? /^Obriši: /)

      /* READ BEFORE THE SHEET IS OPENED, because the sheet stands inside the row and would bring its own name
         into the row's text. */
      const holder = (ask.closest('tr') ?? document.querySelector('h1'))?.textContent ?? ''

      await user.click(ask)

      const sheet = await theSheet(one.asks)

      expect(screen.queryByText('Sigurno?')).toBeNull()
      expect(within(sheet).getAllByRole('button').map((each) => each.textContent)).toEqual(['Obriši', 'Odustani'])

      /* A sheet that names a record names the one whose cross was pressed; the rating has none to name.
         THE NAME COMES FROM TWO SOURCES: the cross, and the row (or the heading of the page) the cross stands
         in. Read off the cross alone, a screen that named the sheet and the cross after a constant would agree
         with itself (the mutations „name is a constant" survived the first draft of this case). */
      if (one.words === undefined) {
        const name = must(ask.getAttribute('aria-label'), 'a name').replace('Obriši: ', '')

        expect(holder, 'the cross is named after another record than the one it stands in').toContain(name)
        expect(within(sheet).getByText(name)).toBeInTheDocument()
      } else {
        expect(sheet.querySelectorAll('.prompt__body p')).toHaveLength(0)
      }
    }, SLOW)

    it('tells „Odustani" off, says that it is sending, and keeps the sheet when it is pressed', async () => {
      const { server, settle, user, sheet } = await leaveItOut()

      const keep = sheet.getByRole('button', { name: 'Odustani' })

      /* TOLD OFF AND NOT SWITCHED OFF: the portal's own answer. */
      expect(keep).toHaveAttribute('aria-disabled', 'true')
      expect(keep).not.toBeDisabled()
      expect(sending()).toHaveLength(1)

      await user.click(keep)
      await user.keyboard('{Escape}')

      /* THE SHEET IS STILL THERE, which is what putting it away would have undone. */
      expect(screen.getByRole('dialog', { name: one.asks })).toBeInTheDocument()

      /* AND WHEN THE ANSWER COMES IT GOES, which is the owner's „list se zatvara sam kad stigne odgovor":
         nothing was pressed to close it. */
      settle(did)
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(sending()).toHaveLength(0)

      server.stop()
    }, SLOW)

    it('closes the sheet by itself when a refusal is in, and leaves the sentence and the focus with the cross that asked', async () => {
      /* THE OWNER'S RULE OF 02.10.2026 (PDL, „Odbijanje zatvara pitanje kao i uspeh"): „na svaki odgovor
         servera pitanje se zatvara, a razlog odbijanja stoji uz dugme". The sentence is the screen's own and is
         said in an alert, and the focus goes back to the cross that asked, because the sheet that had it is gone. */
      const { server, settle, ask, refusal } = await leaveItOut()

      settle(() => answeredWith(refusal))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      expect(ask).toHaveFocus()
      expect(sending()).toHaveLength(0)
      expect(await screen.findByText(new RegExp(`Server je odgovorio brojem ${String(refusal)}`))).toBeInTheDocument()

      server.stop()
    }, SLOW)

    it('can be asked again after a refusal, and the second asking is sent', async () => {
      /* The guard that refuses a second press while one is out is a ref, and one left standing after the answer
         would answer every press with nothing beside a sheet that looks live. */
      const { server, settle, user, ask, refusal } = await leaveItOut()

      settle(() => answeredWith(refusal))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      await user.click(ask)

      const again = within(await theSheet(one.asks))

      /* AND NOTHING OF THE FIRST ATTEMPT IS LEFT ON IT: not told off, and no sentence about sending. */
      expect(again.getByRole('button', { name: 'Obriši' })).not.toHaveAttribute('aria-disabled')
      expect(again.getByRole('button', { name: 'Odustani' })).not.toHaveAttribute('aria-disabled')
      expect(sending()).toHaveLength(0)

      await user.click(again.getByRole('button', { name: 'Obriši' }))

      await waitFor(() => {
        expect(server.asked.filter((each) => each.init?.method === 'DELETE')).toHaveLength(2)
      })

      /* AND THE SECOND REFUSAL BRINGS THE FOCUS BACK AS WELL. */
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(ask).toHaveFocus()

      server.stop()
    }, SLOW)

    it('puts a sheet asked again after a refusal away', async () => {
      const { server, settle, user, ask, refusal } = await leaveItOut()

      settle(() => answeredWith(refusal))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      await user.click(ask)
      await user.click(within(await theSheet(one.asks)).getByRole('button', { name: 'Odustani' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(ask).toHaveFocus()

      server.stop()
    }, SLOW)
  })

  /**
   * THE FLOOR: NO SCREEN DRAWS THE SHEET WITHOUT BEING ON THE LIST ABOVE.
   *
   * <p>Asked of the parser and not of the text, so a tag written over two lines, or imported under another name, is
   * still a tag. `EntityEditor.tsx` itself is the one file left out: it draws the sheet inside `RowActions`, whose
   * four callers are on the table of `deletionSheet.test.tsx`.
   */
  it('has a row for every screen that draws the sheet', () => {
    const pages = join(process.cwd(), 'src', 'pages')
    const found: string[] = []

    for (const { path, code } of sources()) {
      if (!path.startsWith(pages) || path.endsWith('EntityEditor.tsx')) {
        continue
      }

      const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      let draws = false

      const visit = (node: ts.Node): void => {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          node.tagName.getText(file) === 'DeleteSheet'
        ) {
          draws = true
        }

        ts.forEachChild(node, visit)
      }

      visit(file)

      if (draws) {
        found.push(path.slice(pages.length + 1).split('\\').join('/'))
      }
    }

    expect(found.sort()).toEqual(SCREENS.map((each) => each.source).sort())
  })
})
