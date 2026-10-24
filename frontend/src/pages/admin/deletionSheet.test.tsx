import { act, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import ts from 'typescript'
import { join } from 'node:path'
import { must } from '../../test/at'
import { sayYes, theSheet } from '../../test/deleteSheet'
import { renderAt } from '../../test/render'
import { answeredWith, did, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { sources } from '../../test/sources'
import { setupUser } from '../../test/user'
import sr from '../../i18n/sr.json'

/* Every wait is given half of what a case is given, for the reason `rowMembership.test.tsx` gives: a
   mutation then fails on its assertion and not on the clock of the case. */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * EVERY ROW OF THE ADMINISTRATION THAT IS TAKEN AWAY ASKS IN A SHEET OVER THE PAGE, NOT WITH „SIGURNO?" IN
 * THE ROW (owner, 23.10.2026, PDL „Tri odgovora od 23.10.2026": „Svaki ekran administracije koji briše
 * dobija isti iskačući prozor kao red člana, sa rečima koje imenuju šta se briše (npr. „Obriši tim?"
 * [Obriši] [Odustani]), umesto potvrde „Sigurno?" u redu").
 *
 * <p><b>One table, four screens, the same cases.</b> The precedent is the member's row
 * (`adminMemberWrites.test.tsx`, „asks „Obriši člana?" in a sheet over the page"), and each case here is
 * one of the things it guards, asked of each screen that `RowActions` serves: the events, the
 * competitions, the moderators and the teams. The question the old row asked and the rule about a
 * deletion that is out (owner, 02.10.2026) were asked of these four in `deletionInFlight.test.tsx`; they
 * are asked here of the sheet.
 *
 * <p><b>THE RECORD ASKED ABOUT IS THE SECOND OF THE LIST, never the first</b>, because a sheet, a
 * deletion or a name that read the first row would be right on a list of one and on the first row of a
 * list of sixty (the axis `adminMemberWrites.test.tsx` names for the members). A case that needs to tell
 * the two apart holds the cross of the first row too and asks whether it is still on the page.
 *
 * <p><b>The floor is the last block:</b> every file that draws `RowActions` is found by the parser and
 * must be a row of the table, so a fifth list that asks the question is one of these on the day it is
 * written.
 */

type Screen = {
  /** What a failure calls it. */
  name: string
  /** The file that draws the rows, relative to `src/pages`. */
  source: string
  at: string
  /** The question, in the screen's words: it is the sheet's name. */
  asks: string
  /** What the screen says once the row is gone. */
  gone: string
}

const SCREENS: Screen[] = [
  {
    name: 'the events',
    source: 'admin/AdminEvents.tsx',
    at: '/sr/administracija/dogadjaji',
    asks: sr.admin.eventDeleteAsk,
    gone: sr.admin.eventGone,
  },
  {
    name: 'the competitions',
    source: 'admin/AdminLeagues.tsx',
    at: '/sr/administracija/lige',
    asks: sr.admin.leagueDeleteAsk,
    gone: sr.admin.leagueGone,
  },
  {
    name: 'the moderators',
    source: 'admin/AdminModerators.tsx',
    at: '/sr/administracija/moderatori',
    asks: sr.admin.moderatorDeleteAsk,
    gone: sr.admin.moderatorGone,
  },
  {
    name: 'the teams of the administration',
    source: 'admin/AdminTeams.tsx',
    at: '/sr/administracija/timovi',
    asks: sr.admin.teamDeleteAsk,
    gone: sr.admin.teamGone,
  },
]

/** The crosses on the page, one per row. */
const crosses = async (): Promise<HTMLElement[]> => screen.findAllByRole('button', { name: /^Obriši: / })

/** The cross of the SECOND row, and the first beside it so a case can tell the two apart. */
async function twoRows() {
  const all = await crosses()

  expect(all.length, 'one row cannot tell a row from the first row').toBeGreaterThan(1)

  const second = must(all[1], 'the cross of the second row')
  const first = must(all[0], 'the cross of the first row')
  const name = must(second.getAttribute('aria-label'), 'a name on the cross').replace('Obriši: ', '')
  const row = must(second.closest('tr'), 'the row of the second record')

  /* THE NAME COMES FROM A SECOND SOURCE: the cells of the row itself. Read only off the cross, a screen
     that named every row after the first would name the sheet after the first as well, and the sheet
     would agree with the cross it was opened from (the mutation „name from the first row" survived
     the first draft of this file for exactly that reason). */
  expect(
    (row.textContent ?? '').replace(/\s+/g, ''),
    'the cross is named after another row than the one it stands in',
  ).toContain(name.replace(/\s+/g, ''))

  return { first, second, name, row }
}

const deletions = (asked: Asked[]) => asked.filter((one) => one.init?.method === 'DELETE')

/**
 * A server whose answer to every `DELETE` is made when `settle` is called, so a case can look at the page
 * while the request is out. `settle` takes a FUNCTION that makes the answer, and not the answer: a
 * `Response` body can be read once.
 */
function holdingEveryDeletion() {
  let settle: (answer: () => Response) => void = () => {}
  const held = new Promise<() => Response>((resolve) => {
    settle = resolve
  })
  const server = serverThat((_, init) => (init?.method === 'DELETE' ? held.then((make) => make()) : null))

  return { server, settle }
}

/** The sentence that says a request is out, wherever on the page it was drawn. */
const sending = () => screen.queryAllByRole('status').filter((one) => one.textContent === sr.results.sending)

describe.each(SCREENS)('the sheet that asks before $name delete a row', (one) => {
  it('asks in a sheet over the page, with the name of the row, „Obriši" and „Odustani", and not „Sigurno?"', async () => {
    const server = serverThat(() => null)
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { second, name, row } = await twoRows()

    /* The word the cross shows on the pointer is „Obriši"; the name is the longer one. */
    expect(second).toHaveTextContent(/^Obriši/)

    await user.click(second)

    const sheet = await theSheet(one.asks)

    expect(sheet).toHaveAttribute('aria-modal', 'true')
    /* THE ROW IT IS ABOUT, by name: a sheet opened from the wrong row says so. */
    expect(within(sheet).getByText(name)).toBeInTheDocument()
    expect(within(sheet).getAllByRole('button').map((each) => each.textContent)).toEqual(['Obriši', 'Odustani'])

    /* AND NOTHING OF THE OLD QUESTION IS LEFT IN THE ROW. */
    expect(screen.queryByText(sr.admin.form.deleteSure)).toBeNull()
    expect(within(row).queryByRole('button', { name: /^Potvrdi brisanje:/ })).toBeNull()
    expect(within(row).queryByRole('button', { name: /^Odustani od brisanja:/ })).toBeNull()

    /* Asking is not doing. */
    expect(deletions(server.asked)).toEqual([])

    server.stop()
  }, SLOW)

  it('deletes the row that was pressed, the second, and leaves the first where it was', async () => {
    const server = serverThat((_, init) => (init?.method === 'DELETE' ? did() : null))
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { first, second, name } = await twoRows()

    await user.click(second)
    await sayYes(user, one.asks)

    await waitFor(() => expect(second).not.toBeInTheDocument())
    expect(first).toBeInTheDocument()
    expect(deletions(server.asked)).toHaveLength(1)

    /* AND THE SHEET SAID WHOM: what was sent is the address of the pressed row, which is not the address
       the first row would have been deleted at. Read off a second sheet, asked about the first row. */
    const sent = must(deletions(server.asked)[0], 'the deletion').path

    await user.click(first)
    await sayYes(user, one.asks)
    await waitFor(() => expect(deletions(server.asked)).toHaveLength(2))

    expect(must(deletions(server.asked)[1], 'the second deletion').path, name).not.toBe(sent)

    server.stop()
  }, SLOW)

  it('asked from the keyboard, takes the focus to the question, keeps it inside, and puts it back on the cross of that row', async () => {
    const server = serverThat(() => null)
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { second } = await twoRows()

    second.focus()
    await user.keyboard('{Enter}')

    const sheet = await theSheet(one.asks)

    /* The question is read first, and the buttons are one Tab away. */
    expect(within(sheet).getByRole('heading', { name: one.asks })).toHaveFocus()

    await user.tab()
    expect(within(sheet).getByRole('button', { name: 'Obriši' })).toHaveFocus()
    await user.tab()
    expect(within(sheet).getByRole('button', { name: 'Odustani' })).toHaveFocus()
    /* AND IT CANNOT LEAVE: the next Tab is the first button again, not the table behind. */
    await user.tab()
    expect(within(sheet).getByRole('button', { name: 'Obriši' })).toHaveFocus()

    /* ESCAPE IS „NO", AND IT SENDS NOTHING. The focus is on the cross of THIS row, the second. */
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deletions(server.asked)).toEqual([])
    expect(second).toHaveFocus()

    server.stop()
  }, SLOW)

  it('puts the sheet away with „Odustani", sends nothing, and gives the focus back to the cross', async () => {
    const server = serverThat(() => null)
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { second } = await twoRows()

    await user.click(second)
    await user.click(within(await theSheet(one.asks)).getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deletions(server.asked)).toEqual([])
    expect(second).toHaveFocus()

    server.stop()
  }, SLOW)

  it('does not take the second click of a double press for an answer, and opens one sheet', async () => {
    const server = serverThat((_, init) => (init?.method === 'DELETE' ? did() : null))
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { second } = await twoRows()

    /* TWO QUICK CLICKS ON THE CROSS: one sheet, and nothing sent. */
    await user.dblClick(second)

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(deletions(server.asked)).toEqual([])

    /* THE SECOND CLICK OF A DOUBLE PRESS ON „Obriši" carries `detail` 2 and answers nothing; the next
       single one does (`components/Prompt.tsx`). */
    const yes = within(await theSheet(one.asks)).getByRole('button', { name: 'Obriši' })

    fireEvent.click(yes, { detail: 2 })
    expect(deletions(server.asked)).toEqual([])

    fireEvent.click(yes, { detail: 1 })
    await waitFor(() => expect(deletions(server.asked)).toHaveLength(1))

    server.stop()
  }, SLOW)

  it('sends one deletion for two presses fired before the page has drawn the first', async () => {
    /* The sheet refuses a press off what it was last drawn with, and two clicks fired without waiting are
       what a double press is: only the guard that reads a ref sees the first of them. */
    const { server, settle } = holdingEveryDeletion()
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { second } = await twoRows()

    await user.click(second)

    const yes = within(await theSheet(one.asks)).getByRole('button', { name: 'Obriši' })

    act(() => {
      yes.click()
      yes.click()
    })

    await waitFor(() => expect(deletions(server.asked)).toHaveLength(1))

    settle(did)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(deletions(server.asked)).toHaveLength(1)

    server.stop()
  }, SLOW)

  it('while the deletion is out, puts nothing away and says that it is sending; the answer closes the sheet', async () => {
    const { server, settle } = holdingEveryDeletion()
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { second } = await twoRows()

    await user.click(second)

    const sheet = await sayYes(user, one.asks)

    await waitFor(() => expect(deletions(server.asked)).toHaveLength(1))

    /* SAID IN WORDS, in the sheet, only while it is true. */
    expect(within(sheet).getByRole('status')).toHaveTextContent(sr.results.sending)

    /* THE FOCUS IS STILL IN THE SHEET: it moves to the control that starts a new record when the answer is
       in, and a move ahead of it would leave a reader outside a question he has not finished answering. */
    expect(sheet.contains(document.activeElement)).toBe(true)

    /* TOLD OFF AND NOT SWITCHED OFF: the one that was pressed has the focus. */
    const keep = within(sheet).getByRole('button', { name: 'Odustani' })

    expect(keep).toHaveAttribute('aria-disabled', 'true')
    expect(keep).not.toBeDisabled()

    await user.click(keep)
    await user.keyboard('{Escape}')
    await user.click(within(sheet).getByRole('button', { name: 'Obriši' }))

    /* STILL THERE, STILL ONE REQUEST. */
    expect(screen.getByRole('dialog', { name: one.asks })).toBe(sheet)
    expect(deletions(server.asked)).toHaveLength(1)

    settle(did)

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sending()).toHaveLength(0)

    server.stop()
  }, SLOW)

  it('says the row is gone on the screen, takes the row away, and puts the focus on the control that starts a new record', async () => {
    const server = serverThat((_, init) => (init?.method === 'DELETE' ? did() : null))
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { first, second } = await twoRows()

    await user.click(second)
    await sayYes(user, one.asks)

    const said = await screen.findByText(one.gone)

    /* DRAWN, NOT ONLY SAID: in the portal's status region, which is not the clipped one. */
    expect(said).toHaveAttribute('role', 'status')
    expect(said.closest('.visually-hidden')).toBeNull()
    expect(screen.getAllByText(one.gone)).toHaveLength(1)

    expect(second).not.toBeInTheDocument()
    expect(first).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()

    /* Off the row that is gone and onto the one control that cannot be it, in the turn the sheet goes. */
    expect(must(document.getElementById('entity-new'), 'the control that starts a new record')).toHaveFocus()

    server.stop()
  }, SLOW)

  it('closes the sheet over a refusal, says why beside the row, and gives the focus back to the cross of that row', async () => {
    const { server, settle } = holdingEveryDeletion()
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { second, row } = await twoRows()

    await user.click(second)
    await sayYes(user, one.asks)
    await waitFor(() => expect(deletions(server.asked)).toHaveLength(1))

    settle(() => answeredWith(404))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    expect(await within(row).findByRole('alert')).toHaveTextContent('Server je odgovorio brojem 404')
    expect(second).toBeInTheDocument()
    expect(second).toHaveFocus()
    expect(screen.queryByText(one.gone)).toBeNull()
    expect(sending()).toHaveLength(0)

    server.stop()
  }, SLOW)

  it('can be asked again after a refusal, and the second asking is sent', async () => {
    /* The guard against a second press is a ref, and one left standing after the answer would answer
       every press with nothing beside a sheet that looks live. */
    let answers = 0
    const server = serverThat((_, init) => {
      if (init?.method !== 'DELETE') {
        return null
      }

      answers += 1

      return answers === 1 ? answeredWith(404) : did()
    })
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { second } = await twoRows()

    await user.click(second)
    await sayYes(user, one.asks)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await user.click(second)

    const again = within(await theSheet(one.asks))

    /* NOTHING OF THE FIRST ATTEMPT IS LEFT ON IT: not told off, and no sentence about sending. */
    expect(again.getByRole('button', { name: 'Obriši' })).not.toHaveAttribute('aria-disabled')
    expect(again.getByRole('button', { name: 'Odustani' })).not.toHaveAttribute('aria-disabled')
    expect(sending()).toHaveLength(0)

    await user.click(again.getByRole('button', { name: 'Obriši' }))

    await waitFor(() => expect(deletions(server.asked)).toHaveLength(2))
    await waitFor(() => expect(second).not.toBeInTheDocument())

    server.stop()
  }, SLOW)

  it('takes the sentence of a deletion back when the next one is refused, and when a form is opened', async () => {
    let answers = 0
    const server = serverThat((_, init) => {
      if (init?.method !== 'DELETE') {
        return null
      }

      answers += 1

      return answers === 1 ? did() : answeredWith(404)
    })
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const before = await twoRows()

    await user.click(before.second)
    await sayYes(user, one.asks)
    await screen.findByText(one.gone)

    /* A SECOND DELETION THAT THE SERVER REFUSES: „… je obrisan." is not about it, and stands beside a
       refusal that is. The first row is the one pressed, since the second has gone. */
    const [next] = await crosses()

    await user.click(must(next, 'a remaining row'))
    await sayYes(user, one.asks)
    await screen.findByRole('alert')

    expect(screen.queryByText(one.gone)).toBeNull()

    server.stop()
  }, SLOW)

  it('does not bring the sentence back when the list comes back after a form was open', async () => {
    const server = serverThat((_, init) => (init?.method === 'DELETE' ? did() : null))
    const user = setupUser()

    renderAt(one.at, 'superadmin')

    const { second } = await twoRows()

    await user.click(second)
    await sayYes(user, one.asks)
    await screen.findByText(one.gone)

    /* A FORM REPLACES THE LIST while it is open (`EntityEditor`), and the list is where the sentence is
       drawn: the words go with it and do not wait to come back with the list. */
    const [open] = await screen.findAllByRole('button', { name: /^Otvori: / })

    await user.click(must(open, 'a pencil'))
    await user.click(await screen.findByRole('button', { name: 'Nazad na spisak' }))
    await crosses()

    expect(screen.queryByText(one.gone)).toBeNull()

    server.stop()
  }, SLOW)
})

describe('the sheet that asks before an event is deleted', () => {
  it('says what goes with the event, under its name, where the reader who pressed once reads it', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const { second } = await twoRows()

    await user.click(second)

    const sheet = await theSheet(sr.admin.eventDeleteAsk)

    /* Either the number of results that go with it or the sentence that the number is not known yet:
       the two states of the same fact (`AdminEvents.tsx`, `goingWith`). */
    expect(within(sheet).getByText(/Ovim brišeš i \d+ rezultat|Broj rezultata koji odlaze još nije poznat/)).toBeInTheDocument()
  }, SLOW)
})

/**
 * THE FLOOR: NO SCREEN DRAWS `RowActions` WITHOUT BEING ON THE TABLE ABOVE.
 *
 * <p>Asked of the parser and not of the text, so a tag written over two lines, or imported under another
 * name, is still a tag. `EntityEditor.tsx` defines `RowActions` and is the one file left out.
 */
describe('the screens that delete a row of the administration', () => {
  it('have a row in the table above, each', () => {
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
          node.tagName.getText(file) === 'RowActions'
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
