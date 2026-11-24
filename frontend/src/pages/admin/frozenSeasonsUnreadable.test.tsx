import { cleanup, waitFor, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import type { Competitor, Member } from '../../data/types'
import sr from '../../i18n/sr.json'
import en from '../../i18n/en.json'
import { must } from '../../test/at'
import { memberRowOf as rowOf, seasonBox, seasonsOf } from '../../test/memberRow'
import { asMember, person } from '../../test/plate'
import { renderAt } from '../../test/render'
import { answeredWith, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/**
 * THE LIST OF SEASONS OF A MEMBER'S ROW SAYS WHEN THE FREEZE COULD NOT BE READ (owner, 24.11.2026, PDL:
 * „Kad ekran ne uspe da pročita koje su sezone zamrznute, ispod spiska sezona piše rečenica." — „Prošle
 * sezone se trenutno ne mogu menjati. Pokušaj ponovo za koji minut.").
 *
 * Three states of the read, each with its own answer, and the boxes are asked in all of them, because the
 * sentence is only the telling: what a failed read does to the boxes (the past seasons stay switched off)
 * is the older half and it is held here too, so the sentence cannot come back while the boxes act.
 *
 * - **Read:** no sentence, and the box of a frozen season acts.
 * - **Failed:** the sentence is under the list, the box of a past season is switched off, and the box of
 *   the season on sale still acts.
 * - **Failed and then read:** on the next visit there is no sentence and the box acts, because a failure
 *   is not kept and the screen asks again.
 *
 * **The second source of the sentence's condition** is the state of the read against the answer of the
 * server: a read that is still on its way (the answer held back) must say nothing, or the sentence would
 * be the loading state and not the failure.
 */
describe('the list of seasons when the frozen seasons could not be read', () => {
  const THE_MEMBER = '000002'
  const COMPETITORS: Competitor[] = [person(THE_MEMBER, 'Ana', 'Držić')]
  const ROWS: Member[] = [
    asMember(must(COMPETITORS[0], 'Ana'), {
      seasonOnSale: 2028,
      membershipSeason: 2028,
      active: true,
      membershipBasis: 'payment',
      seasons: [
        { season: 2027, basis: 'feeExempt', ranked: true },
        { season: 2028, basis: 'payment', ranked: true },
      ],
    }),
  ]

  /** What `/api/frozen-seasons` answers, by the case: a promise is an answer that has not come back. */
  function serving(frozen: () => Response | Promise<Response>) {
    clearResourceCache()

    return serverThat((path, init) => {
      if ((init?.method ?? 'GET') !== 'GET') {
        return null
      }

      if (path === '/api/frozen-seasons') {
        return frozen()
      }

      if (path === '/api/competitors') {
        return Response.json(COMPETITORS)
      }

      if (path === '/api/members') {
        return Response.json(ROWS)
      }

      return null
    })
  }

  const SENTENCE = sr.admin.pastSeasonsCannotBeChanged

  it('says nothing where the freeze was read, and the box of a frozen season acts', async () => {
    const server = serving(() => Response.json([{ season: 2027 }]))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(THE_MEMBER)
    const box = await seasonBox(user, row, 2027)

    await waitFor(() => expect(box).toBeEnabled())
    expect(within(row).queryAllByText(SENTENCE)).toHaveLength(0)

    server.stop()
  }, SLOW)

  it('says nothing while the read is still on its way', async () => {
    const server = serving(() => new Promise<Response>(() => undefined))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(THE_MEMBER)

    expect(await seasonBox(user, row, 2027)).toBeDisabled()
    expect(within(row).queryAllByText(SENTENCE)).toHaveLength(0)

    server.stop()
  }, SLOW)

  it('says it under the opened list when the read failed, with the past season switched off and the season on sale acting', async () => {
    const server = serving(() => answeredWith(500))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(THE_MEMBER)
    const list = await seasonsOf(user, row)

    /* UNDER THE LIST, which is to say the very next thing after it, and not in it or above it. The row draws
       its list twice (`test/memberRow.ts`), so the sentence is looked for by its place and not by its words. */
    await waitFor(() => expect(list.nextElementSibling).toHaveTextContent(SENTENCE))
    expect(list.nextElementSibling).toBeVisible()
    expect(await seasonBox(user, row, 2027)).toBeDisabled()
    expect(await seasonBox(user, row, 2028)).toBeEnabled()

    server.stop()
  }, SLOW)

  it('goes on the next visit, when the freeze is read after a failure, and the box of the frozen season acts', async () => {
    let healthy = false
    const server = serving(() => (healthy ? Response.json([{ season: 2027 }]) : answeredWith(500)))
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await rowOf(THE_MEMBER)

    const list = await seasonsOf(user, row)

    await waitFor(() => expect(list.nextElementSibling).toHaveTextContent(SENTENCE))

    /* THE NEXT VISIT: a failure is not kept (`data/client.ts`, „A failure is not cached"), so the screen
       opened again asks again, and this time the server answers. */
    healthy = true
    cleanup()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const again = await rowOf(THE_MEMBER)
    const box = await seasonBox(user, again, 2027)

    await waitFor(() => expect(box).toBeEnabled())
    expect(within(again).queryAllByText(SENTENCE)).toHaveLength(0)

    server.stop()
  }, SLOW)

  it('has the sentence in both languages, in the owner’s words', () => {
    expect(sr.admin.pastSeasonsCannotBeChanged).toBe(
      'Prošle sezone se trenutno ne mogu menjati. Pokušaj ponovo za koji minut.',
    )
    expect(en.admin.pastSeasonsCannotBeChanged).toBe("Past seasons can't be changed right now. Try again in a minute.")
  })
})
