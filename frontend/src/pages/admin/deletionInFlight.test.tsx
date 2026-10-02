import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import ts from 'typescript'
import type { Role } from '../../roles/context'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, did, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { sources } from '../../test/sources'
import sr from '../../i18n/sr.json'

/**
 * EVERY SCREEN THAT ASKS „OBRISI?" BEFORE IT SENDS A DELETION, ASKED THE SAME THING ABOUT THE
 * MOMENT THE DELETION IS OUT (owner, 02.10.2026, choosing between three outcomes he was priced;
 * PDL, „Odluke iz ciscenja nalaza", first item: „Ne", „Odustani" and Escape are onemoguceni while
 * the request travels, with the state said in words, and the question is closed by whoever asked
 * it when the answer arrives. It holds for ALL the screens with a confirmation, not only for the
 * activation).
 *
 * <p><b>Why a table and not a case in each screen's own file.</b> `deleteRecord.test.tsx` asks
 * the component alone, and that cannot see the half that lives in the screens: `DeleteRecord`
 * knows a deletion is out only if the handler it is given RETURNS the promise of it, and a screen
 * that wrote `() => void deleteOne(one)` instead - which is the line every one of these used to
 * have - draws a question whose „Odustani" works while the request goes on. So the same question
 * is asked of each screen, with the answer to its `DELETE` held, and the screens are listed here
 * once.
 *
 * <p><b>The list has a floor of its own</b> (the last block): every file that draws the question
 * is found by asking the parser for the JSX tags `DeleteRecord` and `RowActions`, and each one
 * must be a row of this table. A list kept by hand is the list that goes short the day somebody
 * draws a ninth, so the ninth fails here before it fails anywhere a reader would see it.
 *
 * <p><b>What each row does, and what it does not claim.</b> The first record on the screen is the
 * one asked about - and the member's second counted result, for the reason
 * `member/resultToTheServer.test.tsx` gives (with the first, replacing the result the screen
 * deletes with `counted[0]` changes nothing). The sentence a refusal is drawn as belongs to each
 * screen and is measured in its own file; here a refusal is only the answer that leaves the
 * question standing.
 */

type Screen = {
  /** What a failure calls it. */
  name: string
  /** The file that draws the question, relative to `src/pages`. */
  source: string
  /** Where it is drawn, as whom, and on which day. */
  at: string
  role: Role
  member?: string
  day?: string
  /** The button that asks the question about the record to be deleted. */
  ask: () => Promise<HTMLElement>
}

/** The first record on the screen: the first button that offers to delete one. */
const first = async (): Promise<HTMLElement> =>
  must((await screen.findAllByRole('button', { name: /^Obriši: / }))[0], 'a record to delete')

const SCREENS: Screen[] = [
  {
    name: 'the events',
    source: 'admin/AdminEvents.tsx',
    at: '/sr/administracija/dogadjaji',
    role: 'superadmin',
    ask: first,
  },
  {
    name: 'the competitions',
    source: 'admin/AdminLeagues.tsx',
    at: '/sr/administracija/lige',
    role: 'superadmin',
    ask: first,
  },
  {
    name: 'the moderators',
    source: 'admin/AdminModerators.tsx',
    at: '/sr/administracija/moderatori',
    role: 'superadmin',
    ask: first,
  },
  {
    name: 'the teams of the administration',
    source: 'admin/AdminTeams.tsx',
    at: '/sr/administracija/timovi',
    role: 'superadmin',
    ask: first,
  },
  {
    name: 'the members of the administration',
    source: 'admin/AdminMembers.tsx',
    at: '/sr/administracija/clanovi',
    role: 'superadmin',
    ask: first,
  },
  {
    name: 'a team on its own page',
    source: 'TeamDetail.tsx',
    at: '/sr/tim/dunavski-trkaci',
    role: 'competitor',
    member: '000001',
    day: '2026-10-15',
    ask: async () => screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }),
  },
  {
    name: 'a member\'s own counted result',
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
     * Asks the question and answers it, leaving the deletion out, and hands back what a reader is
     * left looking at: the place the three buttons are drawn in, and the name of the record.
     *
     * <p><b>Everything is asked of that place and never of the whole screen</b>, because a name is
     * not an identity: a member's counted results carry the same race twice, so „Obriši: Iločki
     * polumaraton" is two buttons on the page and one in a row.
     */
    async function leaveItOut() {
      const held = holdingEveryDeletion()
      const user = setupUser()

      renderAt(one.at, one.role, one.member ?? null, undefined, one.day ?? null)

      const ask = await one.ask()
      const name = must(ask.getAttribute('aria-label'), 'a name on the delete control').replace(
        'Obriši: ',
        '',
      )
      const here = within(must(ask.parentElement, 'a place the buttons are drawn in'))

      await user.click(ask)
      await user.click(await here.findByRole('button', { name: `Potvrdi brisanje: ${name}` }))

      return { ...held, user, name, here }
    }

    it('tells „Odustani" off, and keeps the question when it is pressed', async () => {
      const { server, settle, user, name, here } = await leaveItOut()

      const keep = here.getByRole('button', { name: `Odustani od brisanja: ${name}` })

      /* TOLD OFF AND NOT SWITCHED OFF: the portal's own answer, and the one `Potvrdi brisanje`
         beside it gives too. */
      expect(keep).toHaveAttribute('aria-disabled', 'true')
      expect(keep).not.toBeDisabled()

      await user.click(keep)

      /* THE QUESTION IS STILL ASKED, which is what putting it away would have undone. */
      expect(here.getByRole('button', { name: `Potvrdi brisanje: ${name}` })).toBeInTheDocument()
      expect(here.queryByRole('button', { name: `Obriši: ${name}` })).not.toBeInTheDocument()

      /* AND WHEN THE ANSWER COMES THE QUESTION GOES WITH THE RECORD, which is the owner's „list se
         zatvara sam kad stigne odgovor": nothing was pressed to close it, and nothing is left
         asking about a record that is gone. */
      settle(did)
      await waitFor(() => {
        expect(
          here.queryByRole('button', { name: `Potvrdi brisanje: ${name}` }),
        ).not.toBeInTheDocument()
      })

      server.stop()
    }, SLOW)

    it('says that it is sending, only while it is', async () => {
      const { server, settle } = await leaveItOut()

      expect(sending()).toHaveLength(1)

      settle(did)
      await waitFor(() => {
        expect(sending()).toHaveLength(0)
      })

      server.stop()
    }, SLOW)

    it('closes the question by itself when a refusal is in, and leaves the sentence and the focus with the button that asked', async () => {
      /* THE OWNER'S RULE OF 02.10.2026 (PDL, „Odbijanje zatvara pitanje kao i uspeh"): „na svaki
         odgovor servera pitanje se zatvara, a razlog odbijanja stoji uz dugme". Nobody pressed
         „Odustani" here, so a question that is gone is one the ANSWER closed; the sentence is the
         screen's own and is said in an alert, and the focus goes where the activation puts it after
         a 409 - to the button of the row (`admin/Payments.tsx`), because the one that had it left
         with the question. */
      const { server, settle, user, name, here } = await leaveItOut()

      /* THE FOCUS IS MOVED ON BEFORE THE ANSWER, and on four of the screens it had been already
         (`RowActions` and the members' list move it ahead of the answer). React gives the button that
         asks the element „Potvrdi brisanje" had, so a focus left where it was would be on it whatever
         the code does about it - which is how an `autoFocus` that does nothing read as working. */
      await user.tab()

      settle(() => answeredWith(404))

      await waitFor(() => {
        expect(
          here.queryByRole('button', { name: `Potvrdi brisanje: ${name}` }),
        ).not.toBeInTheDocument()
      })

      expect(
        here.queryByRole('button', { name: `Odustani od brisanja: ${name}` }),
      ).not.toBeInTheDocument()
      expect(here.getByRole('button', { name: `Obriši: ${name}` })).toHaveFocus()
      expect(sending()).toHaveLength(0)
      expect(await screen.findByText(/Server je odgovorio brojem 404/)).toBeInTheDocument()

      server.stop()
    }, SLOW)

    it('can be asked again after a refusal, and the second asking is sent', async () => {
      /* The guard that refuses a second press while one is out is a ref, and one left standing after
         the answer would answer every press with nothing beside a question that looks live. */
      const { server, settle, user, name, here } = await leaveItOut()

      settle(() => answeredWith(404))

      await waitFor(() => {
        expect(
          here.queryByRole('button', { name: `Potvrdi brisanje: ${name}` }),
        ).not.toBeInTheDocument()
      })

      await user.click(here.getByRole('button', { name: `Obriši: ${name}` }))

      const again = await here.findByRole('button', { name: `Potvrdi brisanje: ${name}` })

      /* AND NOTHING OF THE FIRST ATTEMPT IS LEFT ON IT: not told off, and no sentence about sending. */
      expect(again).not.toHaveAttribute('aria-disabled')
      expect(
        here.getByRole('button', { name: `Odustani od brisanja: ${name}` }),
      ).not.toHaveAttribute('aria-disabled')
      expect(sending()).toHaveLength(0)

      await user.click(again)

      await waitFor(() => {
        expect(server.asked.filter((each) => each.init?.method === 'DELETE')).toHaveLength(2)
      })

      server.stop()
    }, SLOW)

    it('puts a question asked again after a refusal away', async () => {
      /* The half the old case of „lets the reader put the question away once a refusal is in"
         measured: whatever the first attempt raised is let go of, so the way out of the second
         question is open. */
      const { server, settle, user, name, here } = await leaveItOut()

      settle(() => answeredWith(404))

      await waitFor(() => {
        expect(
          here.queryByRole('button', { name: `Potvrdi brisanje: ${name}` }),
        ).not.toBeInTheDocument()
      })

      await user.click(here.getByRole('button', { name: `Obriši: ${name}` }))
      await user.click(here.getByRole('button', { name: `Odustani od brisanja: ${name}` }))

      expect(here.getByRole('button', { name: `Obriši: ${name}` })).toBeInTheDocument()
      expect(
        here.queryByRole('button', { name: `Potvrdi brisanje: ${name}` }),
      ).not.toBeInTheDocument()

      server.stop()
    }, SLOW)

    it('lets the reader put the question away once a refusal is in', async () => {
      /* A refusal is the answer that leaves the question standing, so it is the one that shows
         whether the state ends with the answer: a flag that stayed raised would leave two buttons
         that do nothing and a sentence about why the deletion did not happen. */
      const { server, settle, user, name, here } = await leaveItOut()

      settle(() => answeredWith(404))
      await waitFor(() => {
        expect(sending()).toHaveLength(0)
      })

      const keep = here.getByRole('button', { name: `Odustani od brisanja: ${name}` })

      expect(keep).not.toHaveAttribute('aria-disabled')

      await user.click(keep)

      expect(here.getByRole('button', { name: `Obriši: ${name}` })).toBeInTheDocument()

      server.stop()
    }, SLOW)
  })

  /**
   * THE FLOOR: NO SCREEN DRAWS THE QUESTION WITHOUT BEING ON THE LIST ABOVE.
   *
   * <p>Asked of the parser and not of the text, so a tag written over two lines, or imported under
   * another name, is still a tag. `EntityEditor.tsx` itself is the one file left out: it defines
   * the question and draws it inside `RowActions`, which is why `RowActions` is on the list of
   * tags and its four callers are on the table.
   */
  it('has a row for every screen that draws the question', () => {
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
          ['DeleteRecord', 'RowActions'].includes(node.tagName.getText(file))
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

    expect(found.sort()).toEqual(SCREENS.map((one) => one.source).sort())
  })
})
