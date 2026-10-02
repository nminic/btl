import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import type { MembershipDue, Outstanding } from '../../data/types'
import { renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { QUEUE } from './queues'

/**
 * ACTIVATING A MEMBERSHIP FROM THE PAYMENTS SCREEN (B141).
 *
 * <p>Its own file rather than more cases in `adminPayments.test.tsx`, which measures the derived
 * list and the search and holds a fixture of four people shaped for those two questions. This
 * one needs a fixture shaped for MONEY, and the two sets of axes do not overlap: a row that
 * tells two namesakes apart says nothing about a balance that covers a fee.
 *
 * <p><b>WHAT THE OWNER DICTATED, and it is the definitive specification of this screen</b> (PDL
 * section 19, 27.09.2026): beside the competitor's data and an „Aktiviraj" button, a row carries
 * a label „Ocekivan iznos: IZNOS", an empty field with the currency marked beside it, and a tick
 * box „ukljuci balans (iznos balansa)" which is ticked to begin with and carries the amount in
 * its own label. Seven cases of what is typed, and two rules over all of them.
 *
 * <p><b>ALL SEVEN REACH A ROUTE SINCE 28.09.2026, AND WHAT STOOD HERE SAYING FOUR OF THEM DO NOT
 * IS REWRITTEN RATHER THAN LEFT.</b> It named what was missing for those four - no amount on
 * `POST /api/payments`, a balance spent by what a QR code promised, a `method` the schema did not
 * know - and `V42` and PR 407 overturned all three. The row knocks on TWO doors now: anything with
 * an amount typed goes to `POST /api/payments`, and his 4, 5 and 6 go to `POST /api/memberships`
 * on a ground.
 *
 * <p><b>Which means „nothing was sent" is now a claim about TWO addresses</b>, and a case counting
 * one of them says nothing about the other. That is not theoretical: the case this file used to
 * hold for „sends nothing at all while an amount stands in the field" went on passing once the
 * screen began booking payments, because it filtered for the membership door. Every case whose
 * point is that nothing left the screen uses {@link everythingWritten}.
 *
 * <p>`activation.test.ts` holds the whole grid and every request body without mounting anything.
 * What this file measures is the SCREEN: which control is drawn, which is disabled, which question
 * is put, what is sent, and what is not sent.
 *
 * <p><b>NOTHING IN THE FIXTURE IS THE ONLY ONE OF ITS KIND, AND THE AXES ARE COUNTED</b>, the way
 * `adminMemberWrites.test.tsx` counts its own. Every number below differs from every other number
 * it could be confused with:
 *
 * <ul>
 * <li><b>Six rows, and the row these cases work on is NEVER the first and never the only one.</b>
 * Petar is fourth. So a screen reading `accounts[0]` for anything - the currency, the expected
 * amount, the balance, the competitor it sends - fails rather than passes by luck.
 * <li><b>Three currencies' worth of states in two words:</b> four rows in dinars and two in euro,
 * so „RSD" can never stand in for „the currency of this row". Petar's is EUR while the first
 * row's is RSD, which is the replacement of a source that a screen reading the list's first
 * currency would survive.
 * <li><b>Every expected amount differs</b>, so „the expected amount" cannot be read off another
 * row and give the same answer.
 * <li><b>Balance in all three of its states:</b> nought (Ana, and it is the commonest state on a
 * real list), short of the fee (Petar, Marko), and covering it (Jovana, Nikola). Each against
 * BOTH currencies, because the box and the size of the balance are two axes.
 * <li><b>Two share a surname and two share a town</b>, so neither is an identity.
 * <li><b>The season served is 2031</b>, which no clock in this portal would produce.
 * </ul>
 */
describe('activating a membership from the payments screen', () => {
  const ADDRESS = `/sr/${QUEUE.payments.path}`

  const ACCOUNTS: MembershipDue[] = [
    /* FIRST, and deliberately the one with no balance at all: a screen reading `accounts[0]` for
       a balance would then read nought and the prompts about a balance would never be offered. */
    {
      competitorId: 41,
      memberNumber: '',
      firstName: 'Ana',
      lastName: 'Ilić',
      city: 'Novi Sad',
      currency: 'RSD',
      expected: 4800,
      balance: 0,
    },
    {
      competitorId: 23,
      memberNumber: '000031',
      firstName: 'Jovana',
      lastName: 'Ilić',
      city: 'Beograd',
      currency: 'RSD',
      expected: 4500,
      balance: 6000,
    },
    {
      competitorId: 12,
      memberNumber: '000004',
      firstName: 'Marko',
      lastName: 'Perić',
      city: 'Beograd',
      currency: 'RSD',
      expected: 4200,
      balance: 1500,
    },
    /* THE ONE MOST OF THESE CASES WORK ON: fourth of six, in the other currency, with a balance
       that is real and short of the fee. Every one of those three facts differs from the first
       row's, which is what makes a replacement of the source fail. */
    {
      competitorId: 58,
      memberNumber: '',
      firstName: 'Petar',
      lastName: 'Marko',
      city: 'Ljubljana',
      currency: 'EUR',
      expected: 43.5,
      balance: 12.75,
    },
    {
      competitorId: 77,
      memberNumber: '000019',
      firstName: 'Nikola',
      lastName: 'Zorić',
      city: 'Bar',
      currency: 'EUR',
      expected: 40,
      balance: 71.25,
    },
    {
      competitorId: 91,
      memberNumber: '',
      firstName: 'Sanja',
      lastName: 'Perić',
      city: 'Niš',
      currency: 'RSD',
      expected: 4000,
      balance: 0,
    },
  ]

  const OUTSTANDING: Outstanding = { season: 2031, accounts: ACCOUNTS }

  /** What the row of one person is, so a case never reaches for a cell by number. */
  async function rowOf(whose: string): Promise<HTMLElement> {
    const cell = await screen.findByText(whose)
    const row = cell.closest('tr')

    if (row === null) {
      throw new Error(`${whose} is not in a row`)
    }

    return row
  }

  /**
   * The six served above, and whatever the write route is told to answer.
   *
   * <p>Its own server rather than the shared one, for the reason `adminPayments.test.tsx` gives
   * about its own: a case that has to know WHAT WAS SENT has to record the requests.
   */
  function serving(
    answer: Outstanding = OUTSTANDING,
    /* `Response | Promise<Response>`, widened for the one caller that needs the second half
       (`servingSlowly` below): a promise that has not come back yet is the only way to measure
       what the row does while its own request is still out (`test/serverAnswers.ts`). */
    writeAnswers: () => Response | Promise<Response> = () => new Response(null, { status: 201 }),
  ) {
    clearResourceCache()

    return serverThat((path, init) => {
      if (path === '/api/payments' && (init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify(answer), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      /* BOTH WRITE DOORS ANSWER THE SAME WAY, and the `POST` is what tells the second of them from
         the read above. The row knocks on one or the other depending on whether an amount was
         typed (`activation.ts#sending`), and a harness answering only one of the two would make
         „nothing was sent" true of the other by construction - which is exactly what happened to
         the case this block replaces: it filtered for the membership door alone, so it went on
         passing once the same press began booking a payment. */
      if (
        (path === '/api/memberships' || path === '/api/payments') &&
        init?.method === 'POST'
      ) {
        return writeAnswers()
      }

      return null
    })
  }

  /** What was sent to one write door, as the body the server actually received. */
  function sentTo(asked: Asked[], door: string): unknown[] {
    return asked
      .filter((one) => one.path === door && one.init?.method === 'POST')
      .map((one) => JSON.parse(String(one.init?.body)))
  }

  /** The membership door, which takes a ground and no money. */
  function grantsIn(asked: Asked[]): unknown[] {
    return sentTo(asked, '/api/memberships')
  }

  /** The payment door, which takes what arrived and the tick box. */
  function paymentsIn(asked: Asked[]): unknown[] {
    return sentTo(asked, '/api/payments')
  }

  /**
   * EVERYTHING THAT LEFT THE SCREEN THROUGH EITHER WRITE DOOR, for the cases whose whole assertion
   * is that NOTHING did.
   *
   * <p><b>Both doors and not one, which is the measurement this file lost once and must not lose
   * again.</b> „Ne" and a disabled button have to send nothing ANYWHERE; a count over one address
   * is satisfied by a request to the other.
   */
  function everythingWritten(asked: Asked[]): unknown[] {
    return [...paymentsIn(asked), ...grantsIn(asked)]
  }

  /**
   * A server whose write route answers only when `settle` is called, so a case can press more
   * than once, and press the controls that put the question away, before it says anything.
   *
   * <p>Outside the block that first needed it (`a second press while the first is out`) because
   * a second block does: what the sheet lets a moderator do while its own request is out is the
   * same question asked of other controls.
   */
  function servingSlowly() {
    let settle: ((response: Response) => void) | undefined
    const answered = new Promise<Response>((resolve) => {
      settle = resolve
    })

    const server = serving(OUTSTANDING, () => answered)

    if (settle === undefined) {
      throw new Error('the executor above runs synchronously')
    }

    return { server, settle }
  }

  /**
   * A server whose list loses one person once a write has gone through, which is what the real
   * one derives: a row is on the list because no membership exists for that person and season.
   *
   * <p>The write answers 201 at once. `reads` says how many times the list was asked for, so a
   * case can tell the first drawing of the screen from the one after an activation.
   */
  function servingTheListWithout(gone: number) {
    const reads = { count: 0 }

    clearResourceCache()

    const server = serverThat((path, init) => {
      if (path === '/api/payments' && (init?.method ?? 'GET') === 'GET') {
        reads.count += 1

        return new Response(
          JSON.stringify(
            reads.count === 1
              ? OUTSTANDING
              : { season: 2031, accounts: ACCOUNTS.filter((one) => one.competitorId !== gone) },
          ),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }

      if (
        (path === '/api/memberships' || path === '/api/payments') &&
        init?.method === 'POST'
      ) {
        return new Response(null, { status: 201 })
      }

      return null
    })

    return { server, reads }
  }

  describe('what stands in the row', () => {
    /**
     * THE OWNER'S THREE THINGS, ALL IN HIS CURRENCY AND NONE IN ANYBODY ELSE'S.
     *
     * <p><b>Read off PETAR'S row and asserted against PETAR'S numbers</b>, which is the whole
     * point: he is fourth, in euro, and every one of his three numbers differs from the first
     * row's. A screen reading the currency or the amounts off `accounts[0]` would draw „4.800
     * RSD" here and fail, which is the replacement of a source this case exists for.
     */
    it('carries the expected amount, a field marked with his currency, and the balance in the box', async () => {
      const server = serving()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      /* „Ocekivan iznos: IZNOS". In a table the column heading IS the label, and a screen reader
         reads the pair together, which is what `getByRole('cell')` under the heading measures.
         43,50 rather than 43.5: the portal writes Serbian. */
      expect(within(row).getByText('43,50 EUR')).toBeVisible()

      /* THE FIELD, FOUND BY ITS LABEL AND NEVER BY A CLASS, and empty to begin with. The
         currency is part of the name it really has: a reader who cannot see the mark beside the
         box would otherwise be typing an amount into a field whose currency nobody told him, on
         a screen where the other five rows may be in the other one. */
      const field = within(row).getByLabelText('Uplaćeno (EUR)')

      expect(field).toHaveValue('')

      /* The tick box, found by the label that carries HIS balance, and ticked to begin with. */
      const box = within(row).getByLabelText('uključi balans (12,75 EUR)')

      expect(box).toBeChecked()

      server.stop()
    })

    /**
     * <p><b>The second half of the axis, and it is not the same case twice.</b> The dinar side
     * has to draw the dinar mark and the dinar amounts, and a screen that wrote one currency for
     * everybody would pass the case above and fail this one.
     */
    it('draws the dinar row in dinars, amounts and all', async () => {
      const server = serving()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Jovana Ilić')

      expect(within(row).getByText('4.500 RSD')).toBeVisible()
      expect(within(row).getByLabelText('uključi balans (6.000 RSD)')).toBeChecked()

      server.stop()
    })

    /**
     * <p><b>NOUGHT IS SAID OUT LOUD AND IS NOT AN EMPTY LABEL</b>, which is the commonest state
     * on a real list: `BalanceBook.forEveryOneOf` answers `NOTHING` for everybody with no entry.
     * A box whose label lost its amount when there was nothing on the book would tell the
     * moderator nothing about why the balance cannot be used.
     */
    it('says nought in the box for a man with no balance at all', async () => {
      const server = serving()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      expect(within(row).getByLabelText('uključi balans (0 RSD)')).toBeChecked()

      server.stop()
    })

    /**
     * <p><b>ONE ROW'S TYPING NEVER REACHES ANOTHER'S.</b> Six rows and a moderator working down a
     * bank statement is exactly where a number appearing under the wrong name books one man's
     * money to another. Measured on the FIELD and on the BOX both, because they are two pieces of
     * state and one could be shared while the other is not.
     */
    it('keeps what is typed and what is ticked to the row it was done in', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const mine = await rowOf('Petar Marko')
      const other = await rowOf('Jovana Ilić')

      await user.type(within(mine).getByLabelText('Uplaćeno (EUR)'), '40')
      await user.click(within(mine).getByLabelText('uključi balans (12,75 EUR)'))

      /* AND THE OTHER ROW'S FIELD IS ASKED FOR BY ITS OWN NAME, which is „Uplaćeno (RSD)"
         because Jovana is billed in dinars. So this case also holds the currency being per ROW: a
         screen writing one currency into every label would have only one name here and this line
         would find the wrong field or none. */
      expect(within(other).getByLabelText('Uplaćeno (RSD)')).toHaveValue('')
      expect(within(other).getByLabelText('uključi balans (6.000 RSD)')).toBeChecked()

      server.stop()
    })
  })

  describe('the field that cannot be read', () => {
    /**
     * WCAG 2.2 AA, 3.3.1: AN INPUT ERROR IS DESCRIBED IN TEXT AND NOT ONLY IN COLOUR.
     *
     * <p><b>`4.800` is the input this exists for</b>, and it is not a contrived one: the portal
     * WRITES „4.800" itself, so a moderator reading the expected amount off this screen and
     * typing it back produces exactly that. `Number('4.800')` is `4.8`, so a field that only
     * asked whether the text was finite would accept it and book four thousand seven hundred and
     * ninety five dinars too little.
     */
    it('says so in words, names the field, and refuses to activate', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '4.800')

      const said = within(row).getByText(
        'Iznos unesi ciframa, sa najviše dve decimale i bez razdvajanja hiljada.',
      )

      expect(said).toBeVisible()

      /* THE SENTENCE IS TIED TO THE FIELD AND NOT MERELY NEAR IT. Without that a screen reader
         announces a field with no hint of why it was refused. */
      expect(within(row).getByLabelText('Uplaćeno (EUR)')).toHaveAccessibleDescription(said.textContent ?? '')
      expect(within(row).getByLabelText('Uplaćeno (EUR)')).toBeInvalid()
      expect(within(row).getByRole('button', { name: 'Aktiviraj' })).toBeDisabled()

      server.stop()
    })

    it('takes the sentence away again when the field can be read', async () => {
      /* The other half, and it is not decoration: a message that stays after the fault is put
         right is a message that stops being read. */
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')
      const field = within(row).getByLabelText('Uplaćeno (EUR)')

      await user.type(field, 'nesto')
      expect(
        within(row).getByText(
          'Iznos unesi ciframa, sa najviše dve decimale i bez razdvajanja hiljada.',
        ),
      ).toBeVisible()

      await user.clear(field)
      expect(
        within(row).queryByText(
          'Iznos unesi ciframa, sa najviše dve decimale i bez razdvajanja hiljada.',
        ),
      ).toBeNull()
      expect(field).not.toBeInvalid()

      server.stop()
    })
  })

  /**
   * THE FIVE ROWS OF HIS TABLE THAT HAVE AN AMOUNT IN THEM, AND THEY REACH THE SERVER SINCE
   * 28.09.2026.
   *
   * <p><b>What stood here was a block called „the four cases that need an amount on the wire" and
   * every case in it asserted the button was DISABLED.</b> That was true of `origin/main` when it
   * was written and `V42` overturned it; the sentences on `admin/activation.ts` explaining WHY it
   * was disabled survived a merge that made them false, which is what the independent review of
   * PR 413 found.
   *
   * <p><b>And one case in it went on PASSING after the screen started booking payments, which is
   * the part worth keeping in mind.</b> „sends nothing at all while an amount stands in the field"
   * read `grantsIn`, which filters for `POST /api/memberships` - so a press that sent a perfectly
   * good `POST /api/payments` satisfied it. A count over one door says nothing about the other,
   * and {@link everythingWritten} is what this file uses now wherever the assertion is that
   * nothing was sent.
   *
   * <p><b>Measured against PETAR throughout</b>, fourth of six and in euro, whose expected amount,
   * balance and id all differ from the first row's - so a screen reading any of the three off
   * `accounts[0]` fails rather than passes.
   */
  describe('the five rows of his table with an amount typed', () => {
    /**
     * HIS CASES 1, 2 AND 7: „aktivacija prolazi", so one press books it and asks nothing.
     *
     * <p><b>What was typed is asserted on the wire and it is never the expected amount</b>, except
     * for his case 1 where the two are the same number by definition - which is why 50 and 35 are
     * in this table as well. A screen sending `expected` instead of what was read would book Petar
     * as having paid 43.50 when he sent 20.
     *
     * <p><b>AND NO QUESTION IS PUT, which is his table read literally:</b> the cell for these three
     * holds no prompt, and one invented for case 2 would be a decision he did not ask for.
     */
    it.each([
      ['the expected amount, his case 1', '43,50', 43.5],
      ['more than expected, his case 7', '50', 50],
      ['less, with a balance that covers the difference, his case 2', '35', 35],
    ])('books what arrived with no question on %s', async (_what, typed, received) => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), typed)
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      await waitFor(() => {
        expect(paymentsIn(server.asked)).toEqual([
          {
            competitorId: 58,
            received,
            useTheBalance: true,
            method: 'paypal',
            reference: null,
          },
        ])
      })

      /* AND NOTHING WENT TO THE OTHER DOOR, so „a payment was booked" is not being satisfied by a
         grant that happens to have been sent as well. */
      expect(grantsIn(server.asked)).toEqual([])
      expect(screen.queryByRole('dialog')).toBeNull()

      server.stop()
    })

    /**
     * <p><b>THE TICK BOX IS WHAT GOES ON THE WIRE, and it is measured over a balance that does NOT
     * cover the fee.</b> Petar has 12.75 against 43.50 expected, so „is it ticked" and „does it
     * cover" are two different answers here and a screen sending the wrong one shows. The amount
     * is 50, which covers it on its own, so the box is the only thing that moves.
     */
    it('sends the tick box as the moderator left it, cleared', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '50')
      await user.click(within(row).getByLabelText(/uključi balans/))
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      await waitFor(() => {
        expect(paymentsIn(server.asked)).toEqual([
          {
            competitorId: 58,
            received: 50,
            useTheBalance: false,
            method: 'paypal',
            reference: null,
          },
        ])
      })

      server.stop()
    })

    /**
     * <p><b>AND THE DINAR ROW PAYS THE DINAR WAY</b>, which is the whole of what
     * `paymentQr.ts#methodFor` decides. Jovana is second, in dinars, with an expected 4.500 and
     * 6.000 on her book - none of those three numbers Petar's - so a screen naming the way to pay
     * off a constant rather than off her money sends `paypal` here.
     */
    it('names the dinar way of paying for a row billed in dinars', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Jovana Ilić')

      await user.type(within(row).getByLabelText('Uplaćeno (RSD)'), '4500')
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      await waitFor(() => {
        expect(paymentsIn(server.asked)).toEqual([
          {
            competitorId: 23,
            received: 4500,
            useTheBalance: true,
            method: 'ips',
            reference: null,
          },
        ])
      })

      server.stop()
    })

    /**
     * HIS CASES 3 AND 3b: „Prihvatam umanjen ukupan iznos? Da / Ne", which is the question this
     * screen was written around the absence of.
     *
     * <p><b>The question NAMES what is missing</b>, and the number is his own: 43.50 expected, 20
     * sent, 12.75 on the book, so 10.75 short. That figure appears nowhere else on the row, so a
     * question drawing the expected amount or the balance in its place fails.
     */
    it('asks about the shortfall, names it, and books on „Da" (his case 3)', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '20')
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      expect(within(sheet).getByText(/Prihvatam umanjen ukupan iznos/)).toBeVisible()
      expect(within(sheet).getByText('Nedostaje: 10,75 EUR')).toBeVisible()

      /* NOTHING HAS BEEN SENT YET, which is what makes this a question rather than a notice. */
      expect(everythingWritten(server.asked)).toEqual([])

      await user.click(within(sheet).getByRole('button', { name: 'Da' }))

      await waitFor(() => {
        expect(paymentsIn(server.asked)).toEqual([
          {
            competitorId: 58,
            received: 20,
            useTheBalance: true,
            method: 'paypal',
            reference: null,
          },
        ])
      })

      server.stop()
    })

    /**
     * HIS CASE 3b: the same question with the box cleared, and <b>over a balance that WOULD have
     * covered the difference</b>. 35 with 12.75 reaches 47.75, past the 43.50 expected, so a screen
     * that ignored the cleared box would make this his case 2 and put no question at all. The
     * shortfall named is the whole 8.50 rather than nothing.
     */
    it('asks the same question with the box cleared over a balance that would cover (his 3b)', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '35')
      await user.click(within(row).getByLabelText(/uključi balans/))
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      expect(within(sheet).getByText('Nedostaje: 8,50 EUR')).toBeVisible()

      await user.click(within(sheet).getByRole('button', { name: 'Da' }))

      await waitFor(() => {
        expect(paymentsIn(server.asked)).toEqual([
          {
            competitorId: 58,
            received: 35,
            useTheBalance: false,
            method: 'paypal',
            reference: null,
          },
        ])
      })

      server.stop()
    })

    /**
     * <p><b>AND „NE" ON THAT QUESTION WRITES NOTHING AND KEEPS THE ROW</b>, which is the owner's
     * rule over the whole of his specification: „Odluka NE ni ovde niti u ostatku opisa
     * funkcionalnosti ne brise red iz tabele za aktivaciju, samo odlaze odluku dok se stvari ne
     * rese van portala." <b>Both doors are counted</b>, not the one this question would have used.
     */
    it('writes nothing and keeps the row when the shortfall question is declined', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '20')
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ne' }),
      )

      expect(everythingWritten(server.asked)).toEqual([])
      expect(await rowOf('Petar Marko')).toBeVisible()
      /* And the amount he typed is still there, so „Ne" put the decision off rather than undoing
         his reading of the statement. */
      expect(within(await rowOf('Petar Marko')).getByLabelText('Uplaćeno (EUR)')).toHaveValue('20')

      server.stop()
    })

    /**
     * <p><b>AND THE ONE CASE THE BUTTON IS STILL DISABLED FOR SENDS NOTHING THROUGH EITHER DOOR.</b>
     * A field that cannot be read is the eighth case and is not one of his; the assertion that no
     * request leaves is over both addresses, which is the mistake this block was rewritten to stop
     * repeating.
     */
    it('sends nothing at all while the field cannot be read', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '4.800')
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      expect(within(row).getByRole('button', { name: 'Aktiviraj' })).toBeDisabled()
      expect(everythingWritten(server.asked)).toEqual([])
      expect(screen.queryByRole('dialog')).toBeNull()

      server.stop()
    })

    /**
     * <p><b>AND NOUGHT IS NOT ONE OF THEM, which is the owner's decision of 27.09.2026</b> (PDL
     * section 19, point 5): „Prazno polje i ukucana nula vode na ISTI prompt, onaj o oslobodjenju
     * od clanarine." So the button stays available and the question asked is the one about the
     * exemption. Three spellings, because a guard reading the text rather than the value answers
     * differently for each, and „0,00" is what somebody copying an amount off this screen types.
     */
    it.each([['0'], ['0.00'], ['0,00']])(
      'treats a typed nought (%s) as nothing typed and still activates',
      async (typed) => {
        const server = serving()
        const user = setupUser()
        renderAt(ADDRESS, 'superadmin')

        const row = await rowOf('Petar Marko')

        await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), typed)
        await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

        /* Petar's balance is short of his fee, so this is the owner's case 5 and the second
           button says „umanjen". That it is THIS question and not the one about a shortfall is
           the whole of what a typed nought decides. */
        expect(
          await screen.findByRole('button', { name: 'Odobri umanjen iznos iz balansa' }),
        ).toBeVisible()

        server.stop()
      },
    )
  })

  describe('the question about the ground, his cases 4 and 5', () => {
    /**
     * CASE 5: something on the book, not enough, so the second button says „umanjen".
     *
     * <p><b>The ground sent is `balance` and no amount goes with it</b>, which is the server's own
     * arrangement: `MembershipWriteApi` calls „Odobri iz balansa" and „Odobri umanjen iznos iz
     * balansa" one ground and two labels, and works out how much comes off the book itself.
     */
    it('sends the balance ground for a balance that does not cover the fee', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      /* THE SHEET NAMES THE MAN AND THE SEASON, and the season is the one off the ANSWER. Found
         by a mutation and not by reading: fixing this title's season to a year of its own left
         all thirty cases green, because the two amounts below were asserted and the heading was
         not. It matters for the same reason it matters on the other question - one of these two
         buttons grants a season free of the fee, and the owner's rule is that an exemption is
         for ONE season („BESPLATNI CLANOVI NISU BESPLATNI DOZIVOTNO"), so the year has to be in
         front of whoever presses it. 2031 is a year no clock here would produce. */
      expect(sheet).toHaveAccessibleName('Aktivacija članstva: Petar Marko, sezona 2031.')

      /* BOTH AMOUNTS ARE IN THE SHEET AND IN HIS CURRENCY, so the moderator decides with the
         numbers in front of him rather than from the row behind the sheet. */
      expect(within(sheet).getByText('Očekivan iznos: 43,50 EUR')).toBeVisible()
      expect(within(sheet).getByText('Balans: 12,75 EUR')).toBeVisible()

      await user.click(within(sheet).getByRole('button', { name: 'Odobri umanjen iznos iz balansa' }))

      expect(grantsIn(server.asked)).toEqual([{ competitorId: 58, ground: 'balance' }])

      server.stop()
    })

    /**
     * CASE 4: the balance reaches the fee, so the same ground under the other label.
     *
     * <p><b>Nikola and not Petar</b>, so the two labels are measured on two different people and
     * a screen writing one label for both fails here rather than passing on the row above.
     */
    it('sends the same ground under the other label when the balance covers the fee', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Nikola Zorić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      expect(within(sheet).getByRole('button', { name: 'Odobri iz balansa' })).toBeVisible()
      expect(
        within(sheet).queryByRole('button', { name: 'Odobri umanjen iznos iz balansa' }),
      ).toBeNull()

      await user.click(within(sheet).getByRole('button', { name: 'Odobri iz balansa' }))

      expect(grantsIn(server.asked)).toEqual([{ competitorId: 77, ground: 'balance' }])

      server.stop()
    })

    /**
     * <p><b>THE EXEMPTION IS OFFERED BESIDE THE BALANCE AND SENDS THE OTHER WORD.</b> Two grounds
     * out of one question, and the word is what tells the server which button was pressed -
     * `MembershipWriteApi` refuses anything else by name rather than defaulting, „a default would
     * mean a misspelled field handing out a season free of the fee".
     */
    it('sends the exemption ground from the same question', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      await user.click(
        within(sheet).getByRole('button', { name: 'Odobri oslobođenje od članarine' }),
      )

      expect(grantsIn(server.asked)).toEqual([{ competitorId: 58, ground: 'feeExempt' }])

      server.stop()
    })

    /**
     * <p><b>CLEARING THE BOX TAKES THE BALANCE OUT OF THE QUESTION ENTIRELY, which is the owner's
     * decision of 27.09.2026</b> (PDL 23a): „Na moderatorovom ekranu odlucuje kucica i iznos u
     * njenoj labeli, ne ono sto je QR kod obecao." <b>Measured on NIKOLA, whose balance COVERS
     * the fee</b>, so the balance disappearing from the question can only be the box being read.
     * On a man with nothing on the book this case would pass whether the box were read or not.
     */
    it('asks only about the exemption when the box is cleared over a balance that would cover it', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Nikola Zorić')

      await user.click(within(row).getByLabelText('uključi balans (71,25 EUR)'))
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      expect(within(sheet).getByRole('heading', { name: 'Odobri oslobođenje od članarine?' })).toBeVisible()
      expect(within(sheet).queryByRole('button', { name: 'Odobri iz balansa' })).toBeNull()
      expect(
        within(sheet).queryByRole('button', { name: 'Odobri umanjen iznos iz balansa' }),
      ).toBeNull()

      server.stop()
    })
  })

  describe('the question about the exemption, his case 6', () => {
    /**
     * <p><b>THE BOX TICKED OVER AN EMPTY BOOK, which his grid does not name and which is the
     * commonest row on the screen.</b> The box offers the balance as a way to pay and nought is
     * not one, so the only ground left is the exemption. Ana, first row, balance nought.
     */
    it('asks only about the exemption when the box is ticked over an empty book', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      expect(within(row).getByLabelText('uključi balans (0 RSD)')).toBeChecked()

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      expect(within(sheet).getByRole('heading', { name: 'Odobri oslobođenje od članarine?' })).toBeVisible()
      expect(within(sheet).getByText('Ana Ilić, sezona 2031.')).toBeVisible()

      await user.click(within(sheet).getByRole('button', { name: 'Da' }))

      expect(grantsIn(server.asked)).toEqual([{ competitorId: 41, ground: 'feeExempt' }])

      server.stop()
    })

    /**
     * <p><b>THE SEASON IN THE QUESTION COMES OFF THE ANSWER AND NEVER OFF A CLOCK.</b> 2031 is a
     * year `data/season.ts` would not produce for any day this can run on, and the sheet names it
     * because an exemption is FOR ONE SEASON - the owner, in capitals: „BESPLATNI CLANOVI NISU
     * BESPLATNI DOZIVOTNO." A moderator granting one has to see which year he is granting.
     *
     * <p><b>And the year is NOT sent</b>, which is the other half: the route reads the season off
     * the day, so a screen sending one could buy the wrong year with one keystroke.
     */
    it('names the season in the question and never sends it', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Sanja Perić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      expect(within(sheet).getByText('Sanja Perić, sezona 2031.')).toBeVisible()

      await user.click(within(sheet).getByRole('button', { name: 'Da' }))

      expect(grantsIn(server.asked)).toEqual([{ competitorId: 91, ground: 'feeExempt' }])

      server.stop()
    })
  })

  describe('„NE" never takes a row off the list', () => {
    /**
     * THE OWNER'S RULE OVER THE WHOLE SPECIFICATION, in his own words: „Odluka NE ni ovde niti u
     * ostatku opisa funkcionalnosti ne brise red iz tabele za aktivaciju, samo odlaze odluku dok
     * se stvari ne rese van portala."
     *
     * <p><b>So declining is measured as THREE things and not one:</b> no request leaves the
     * screen, the row is still there, and the list was not read again either. The third is not
     * pedantry - a screen that re-read the list on a decline would be saying „something may have
     * changed", and nothing did.
     */
    it('sends nothing, keeps the row, and does not even re-read the list', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Odustani' }),
      )

      expect(grantsIn(server.asked)).toEqual([])
      expect(await rowOf('Petar Marko')).toBeVisible()
      expect(server.asked.filter((one) => one.path === '/api/payments')).toHaveLength(1)
      expect(screen.queryByRole('dialog')).toBeNull()

      server.stop()
    })

    /** And the same through the other question, which has „Ne" rather than „Odustani" on it: two
     *  doors of one rule, and a rule sprung on one door only is the fault this measures. */
    it('sends nothing from the question about the exemption either', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ne' }))

      expect(grantsIn(server.asked)).toEqual([])
      expect(await rowOf('Ana Ilić')).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()

      server.stop()
    })

    /** ESCAPE IS „NE", and it changes nothing for the same reason. WCAG 2.2 AA 2.1.2 asks that a
     *  dialog can be left by the keyboard, and the owner's rule is what makes it safe. */
    it('treats Escape as „Ne" and writes nothing', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await screen.findByRole('dialog')
      await user.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      expect(grantsIn(server.asked)).toEqual([])
      expect(await rowOf('Ana Ilić')).toBeVisible()

      server.stop()
    })
  })

  describe('the sheet as a dialog', () => {
    /**
     * WCAG 2.2 AA: A DIALOG WITH A NAME, A MODE, AND THE FOCUS INSIDE IT.
     *
     * <p>The portal's first `aria-modal`, so every part of this is new rather than copied, and
     * each piece is asserted separately because each could be absent on its own.
     */
    it('has a name, says it is modal, and takes the focus', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      expect(sheet).toHaveAttribute('aria-modal', 'true')
      expect(sheet).toHaveAccessibleName('Odobri oslobođenje od članarine?')

      /* THE FOCUS IS ON THE QUESTION AND NOT ON A BUTTON. Landing on „Da" means a reader who
         presses space before reading has agreed to something. */
      /* ASKED OF THE DOM AND NOT THROUGH `toContainElement`, because that matcher wants an
         `HTMLElement` and `document.activeElement` is an `Element` - so the obvious line needs a
         type assertion, and this portal forbids `as` (the lint rule is `consistent-type-assertions`
         and it refused it). `contains` answers the same question without claiming anything about a
         type, and it is true of the element itself as well, which is what the heading needs. */
      expect(sheet.contains(document.activeElement)).toBe(true)
      expect(document.activeElement).toHaveTextContent('Odobri oslobođenje od članarine?')

      server.stop()
    })

    /**
     * <p><b>THE FOCUS GOES BACK TO THE BUTTON THAT OPENED IT</b> (WCAG 2.2 AA, 2.4.3). Without
     * it a keyboard reader is put back at the top of a table of six rows and has to count down
     * to the one he was working on. <b>Measured on the FOURTH row</b>, so „the focus is somewhere
     * on the screen" cannot pass for „the focus is where it was".
     */
    it('puts the focus back on the button it was opened from', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')
      const opener = within(row).getByRole('button', { name: 'Aktiviraj' })

      await user.click(opener)
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Odustani' }),
      )

      await waitFor(() => expect(document.activeElement).toBe(opener))

      server.stop()
    })

    /**
     * <p><b>TAB CANNOT LEAVE THE SHEET, which is what „modal" means for somebody not using a
     * mouse.</b> Without it Tab walks out into the table behind and the reader answers a question
     * while standing somewhere the question is not. Walked far enough to come round twice, so a
     * ring that merely happens to be long does not pass.
     */
    it('keeps the keyboard inside it, and the ring runs in the right order', async () => {
      /* <p><b>THE ORDER IS ASSERTED AND NOT MERELY THE CONTAINMENT, and the first draft of this
         case is why.</b> It tabbed sixteen times and asked only „is the focus still inside the
         sheet". With three buttons in a ring, a wrap that lands on the WRONG end is still inside
         the sheet, so that question was satisfied by every arrangement - and three mutations
         proved it: making the backward edge the same as the forward one, swapping the two ends,
         and dropping the heading from the backward edge all survived. Naming the element after
         every press is what tells a ring from a heap.

         MEASURED ON THE QUESTION WITH THREE BUTTONS rather than the one with two, because a ring
         of two cannot tell „the next one" from „the other end". */
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')
      const [exempt, balance, stop] = within(sheet).getAllByRole('button')

      /* The sheet opens with the question itself holding the focus, not a button. */
      expect(document.activeElement).toHaveTextContent('Aktivacija članstva')

      /* SHIFT+TAB AS THE VERY FIRST PRESS goes to the last button and not out of the sheet.
         There is nothing before the heading inside the sheet, so this is the wrap that only the
         heading's own edge can serve. */
      await user.tab({ shift: true })
      expect(document.activeElement).toBe(stop)

      /* Forward from the last one wraps to the first. */
      await user.tab()
      expect(document.activeElement).toBe(exempt)

      await user.tab()
      expect(document.activeElement).toBe(balance)

      await user.tab()
      expect(document.activeElement).toBe(stop)

      await user.tab()
      expect(document.activeElement).toBe(exempt)

      /* And backwards off the first button, which is the other wrap. */
      await user.tab({ shift: true })
      expect(document.activeElement).toBe(stop)

      await user.tab({ shift: true })
      expect(document.activeElement).toBe(balance)

      server.stop()
    })

    /**
     * <p><b>AND IT DOES NOT THROW WHEN THERE IS NOTHING TO WRAP TO.</b> A sheet with no buttons
     * in it is not a state this screen can draw - every question has at least an answer and a way
     * out - but the handler asks the DOM rather than the props, so the DOM is where the answer
     * comes from and the DOM can be changed by anything. The case is here because the 100 per
     * cent threshold reported the guard as a branch nothing reaches, and a guard nothing reaches
     * is either dead code or an untested one; this makes it the second.
     */
    it('does nothing rather than throwing when the sheet holds no buttons', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      within(sheet)
        .getAllByRole('button')
        .forEach((one) => one.remove())

      await user.tab({ shift: true })

      /* The sheet is still standing and nothing was written: the press found nothing to move
         the focus to and let it alone. */
      expect(screen.getByRole('dialog')).toBeVisible()
      expect(grantsIn(server.asked)).toEqual([])

      server.stop()
    })

    /**
     * <p><b>ESCAPE IN THE SHEET DOES NOT SHUT THE MENUS BEHIND IT.</b> `app/LanguageMenu.tsx`
     * listens for Escape on the DOCUMENT in the bubble phase and is in `app/Shell.tsx`, so it is
     * on the same page as this sheet always. Without the press being stopped, one Escape
     * answering this question would also shut a menu the reader had left open, and he would have
     * to find it again to see why.
     *
     * <p><b>What this deliberately does not measure, and it is written down rather than left to be
     * found:</b> `forms/FieldHint.tsx` listens in the CAPTURE phase on the document, which by
     * construction runs before anything inside the sheet, so nothing in the sheet can stop it.
     * That costs nothing today because `FieldHint` is drawn only by `forms/FormRenderer` and
     * `pages/account/NewPassword`, and neither stands on this screen - so there is no hint here
     * for a press to reach. Both halves are set out on `components/Prompt.tsx`.
     */
    it('stops Escape from reaching a bubble-phase listener on the document', async () => {
      /* WHAT THIS PROTECTS, NAMED: `app/LanguageMenu.tsx`, `app/Dropdown.tsx` (which is the
         account and the messages menus) and `forms/DatePicker.tsx` all listen for Escape on the
         DOCUMENT in the BUBBLE phase, and every one of them treats it as „close me". The language
         menu is in `app/Shell.tsx`, so it is on the same page as this sheet always. Without the
         press being stopped, one Escape answering this question would also shut a menu the reader
         had left open behind it, and he would have to find it again to see why.

         MEASURED ON THE MECHANISM AND NOT ON THE MENU, and the first draft of this case is why.
         It opened the language menu, then clicked „Aktiviraj" - and that click is itself a press
         OUTSIDE the menu, which the menu closes on. So the menu was already shut before Escape
         was ever pressed, and the case passed or failed on something it was not about. A listener
         of this test's own, registered exactly as the menus register theirs, cannot be closed by
         anything else on the way.

         AND THE OTHER HALF IS THE MEASURED BOUNDARY: a CAPTURE-phase listener on the document
         DOES hear it, because by construction it runs before anything inside the sheet. That is
         `forms/FieldHint.tsx`, and it costs nothing today - `FieldHint` is drawn only by
         `forms/FormRenderer` and `pages/account/NewPassword`, neither of which stands on this
         screen. Asserted rather than merely written down, so the day somebody makes the sheet
         stop the press in the capture phase, this says where the reason went. */
      const bubbled: string[] = []
      const captured: string[] = []
      const onBubble = (pressed: KeyboardEvent) => bubbled.push(pressed.key)
      const onCapture = (pressed: KeyboardEvent) => captured.push(pressed.key)

      document.addEventListener('keydown', onBubble)
      document.addEventListener('keydown', onCapture, true)

      const server = serving()
      const user = setupUser()

      try {
        renderAt(ADDRESS, 'superadmin')

        const row = await rowOf('Ana Ilić')

        await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
        await screen.findByRole('dialog')
        await user.keyboard('{Escape}')

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

        expect(bubbled).toEqual([])
        expect(captured).toEqual(['Escape'])
      } finally {
        document.removeEventListener('keydown', onBubble)
        document.removeEventListener('keydown', onCapture, true)
        server.stop()
      }
    })
  })

  describe('when the server refuses', () => {
    /**
     * THE ONE REFUSAL THE SCREEN CANNOT SEE COMING, and the reason a map of sentences exists at
     * all rather than a guard.
     *
     * <p>The screen is served ONE balance, the column his country names, and the server decides by
     * the PAIR: `Balance.isMoneyInBothCurrencies` wants both halves strictly positive because
     * `balance_entry_a_membership_takes` (V38) reads `eur < 0 and rsd < 0`. So a man whose book is
     * `0.00 EUR / 600.00 RSD` is shown „600 RSD", is offered his balance, and is refused. Nothing
     * served would let the screen know that in advance, so it says what the server said. PDL
     * section 25 closes the gap and is not carried out: V38 still holds the two columns.
     */
    it('says what it said, and keeps the row exactly where it was', async () => {
      const server = serving(OUTSTANDING, () =>
        new Response(JSON.stringify({ reason: 'nothingWouldComeOffTheBalance' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      )
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Nikola Zorić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Odobri iz balansa' }),
      )

      expect(
        await within(await rowOf('Nikola Zorić')).findByText(/Sa balansa ovog člana/),
      ).toBeVisible()

      /* AND THE ROW IS STILL THERE, which is the owner's rule holding for a refusal as much as
         for „Ne": nothing was written, so nothing about the row has changed. */
      expect(await rowOf('Nikola Zorić')).toBeVisible()

      server.stop()
    })

    /**
     * <p><b>A reason the map does not know is said out loud, code and all.</b> That is
     * `ServerSaid`'s own arrangement and the reason it gives: a screen one release behind its
     * server must not choose the nearest sentence it does have, because the nearest sentence
     * tells the reader to fix something that is not wrong.
     */
    it('says a refusal it has no sentence for rather than choosing the nearest one', async () => {
      const server = serving(OUTSTANDING, () =>
        new Response(JSON.stringify({ reason: 'somethingNobodyHasWrittenYet' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      )
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }),
      )

      expect(
        await within(await rowOf('Ana Ilić')).findByText(/somethingNobodyHasWrittenYet/),
      ).toBeVisible()

      server.stop()
    })

    /**
     * AND A REASON ONLY THE PAYMENT DOOR CAN NAME, WHICH IS WHAT SAYS THE RIGHT MAP WAS READ.
     *
     * <p><b>`theAmountIsNotKeptExactly` is on `PaymentApi` and NOT on `MembershipWriteApi`</b>, so
     * a row that kept reading `WHEN_ACTIVATING` after it began booking payments would fall through
     * to `ServerSaid`'s honest branch and print the camel-case code at the moderator instead of a
     * sentence. Measured by the SENTENCE being there and the CODE not being, because the honest
     * branch draws a sentence of its own around the code and a case looking only for Serbian words
     * would pass on it.
     *
     * <p><b>It is also the one of the five new reasons a moderator can really provoke:</b> the
     * field refuses a third decimal but puts no ceiling on the digits before the separator, and
     * `numeric(10,2)` has one - so eleven digits is a typing mistake that reaches the server.
     */
    it('reads the payment door’s own sentences, not the membership door’s', async () => {
      const server = serving(OUTSTANDING, () =>
        new Response(JSON.stringify({ reason: 'theAmountIsNotKeptExactly' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      )
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '99999999999')
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const said = await within(await rowOf('Petar Marko')).findByText(
        /Iznos je veći nego što portal može da zapiše/,
      )

      expect(said).toBeVisible()
      expect(said).not.toHaveTextContent('theAmountIsNotKeptExactly')

      /* AND THE ROW IS STILL THERE with what he typed, so he can correct it rather than start
         again. */
      expect(within(await rowOf('Petar Marko')).getByLabelText('Uplaćeno (EUR)')).toHaveValue(
        '99999999999',
      )

      server.stop()
    })
  })

  describe('when it goes through', () => {
    /**
     * <p><b>THE LIST IS READ AGAIN, AND THAT IS THE ONLY WAY A ROW LEAVES.</b> The answer is
     * DERIVED - a row is on it because no `membership` row exists for that person and that season
     * - so there is nothing about it the screen could hold that would still be true.
     * `usePaymentsDue` says as much: „The screen writes to the route, clears this name, and reads
     * the derived answer again."
     *
     * <p><b>Measured by the SECOND answer being a shorter list</b>, and by the row being gone from
     * the screen. A count of reads alone would pass a screen that re-read and then drew the first
     * answer.
     */
    it('reads the derived list again and the row is gone', async () => {
      let read = 0

      clearResourceCache()

      const server = serverThat((path, init) => {
        if (path === '/api/payments' && (init?.method ?? 'GET') === 'GET') {
          read += 1

          /* THE SECOND READING IS THE LIST WITHOUT ANA, which is what the server would derive
             once her membership exists. */
          return new Response(
            JSON.stringify(
              read === 1
                ? OUTSTANDING
                : { season: 2031, accounts: ACCOUNTS.filter((one) => one.competitorId !== 41) },
            ),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }

        if (path === '/api/memberships' && init?.method === 'POST') {
          return new Response(null, { status: 201 })
        }

        return null
      })

      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }),
      )

      await waitFor(() => expect(screen.queryByText('Ana Ilić')).toBeNull())

      expect(read).toBe(2)

      /* AND THE OTHERS ARE STILL THERE, which is what keeps this from passing on a screen that
         emptied the table. */
      expect(await rowOf('Petar Marko')).toBeVisible()

      server.stop()
    })
  })

  /**
   * A SECOND PRESS BEFORE THE FIRST HAS ANSWERED (VISOK 1, review of PR 411).
   *
   * <p><b>What a sonde holding the server's answer unresolved found.</b> The sheet used to
   * close the instant „Da" was pressed, before the server had said anything, and the row's own
   * „Aktiviraj" was not disabled either - so a second press reopened the very question the
   * first was still answering, and a second „Da" sent a second, identical body. Both requests
   * pass „is there a membership already", both draw a member number, and the loser fails on
   * `membership_pk` - so the number it drew is gone for nothing, because
   * `nextval('member_number_seq')` never gives one back (PDL section 19, „Aktivacija trosi
   * clanski broj nepovratno").
   *
   * <p><b>The mock answer is a promise that has not come back yet</b> (`test/serverAnswers.ts`
   * says why: it is the only way to measure what a screen does while it is waiting), so every
   * case below can press twice and inspect the row before ever letting the server speak.
   */
  describe('a second press while the first is out', () => {
    /**
     * <p><b>THE ASSERTION IS ON THE BODY THE SERVER RECEIVED, NOT ON HOW MANY TIMES ANYTHING
     * WAS CLICKED.</b> Three presses land on this row - the button that opened the sheet, and
     * the sheet's own „Da" pressed a second time on the very same still-open sheet - and the
     * mutation this exists for is deleting the guard that stands between either of them and a
     * second `askTheServer`: with it gone, `grantsIn` would carry two identical grants rather
     * than one.
     *
     * <p>Ana, first row, his case 6 (the box ticked over an empty book): one choice, „Da", so
     * a second press on it is a press on the very button the first press already used.
     */
    it('sends only one body no matter which door the second press comes through', async () => {
      const { server, settle } = servingSlowly()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')
      const aktiviraj = within(row).getByRole('button', { name: 'Aktiviraj' })

      await user.click(aktiviraj)
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

      /* A SECOND PRESS ON THE BUTTON THAT OPENED THIS, while the first request is still out.
         Fired with `fireEvent` and not through `user`, the same reason
         `verificationDecision.test.tsx` gives for its own double press: `user.click` awaits its
         own click through to completion, so two of those could never land while a walk of this
         row's own is still out. */
      fireEvent.click(aktiviraj)

      /* AND A SECOND „DA" ON THE SAME STILL-OPEN SHEET. The sheet no longer closes the moment
         it is answered (`activate`'s own comment says why), so a genuine double press lands on
         the very button the first one used rather than on a freshly opened one. */
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Da' }))

      settle(new Response(null, { status: 201 }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      expect(grantsIn(server.asked)).toEqual([{ competitorId: 41, ground: 'feeExempt' }])

      server.stop()
    })

    /**
     * TWO PRESSES ON „DA" WITH NOTHING AWAITED BETWEEN THEM (VISOK, review of PR 411, round 2).
     *
     * <p><b>The case above does not measure a genuine double press, and that is exactly why a
     * mutation swapping the guard for the state beside it survived it.</b> Its second press on
     * „Da" comes only after the first has been carried all the way through `user.click`, so
     * `activating` is already `true` before either door is tried again - `if (outstanding.current)`
     * and a mutated `if (activating)` then agree, because both values have caught up by then.
     *
     * <p><b>A genuine double press agrees with neither, because nothing has been awaited for
     * either to catch up.</b> `user.click` cannot produce that by construction - it awaits its
     * own click through to completion - so this fires two raw clicks on the very same button with
     * nothing between them, the way `verificationDecision.test.tsx` fires its own second press
     * with `fireEvent` rather than `user` for the same reason. Both are grouped inside one `act`,
     * the way `clock.test.tsx` groups two synchronous steps into one, so nothing commits between
     * them: the second dispatch is handled by the very closure the first one was, from before
     * `setActivating` had been seen anywhere. `outstanding.current` is not fooled by this, because
     * a ref is read fresh no matter which closure asks; a state check in its place is fooled by
     * exactly this, because the closure it reads `activating` from is the stale one.
     *
     * <p>Ana, first row, his case 6 again, for the same reason the case above uses her: one
     * choice, „Da", so a second press on it is a press on the very button the first already used.
     */
    it('sends only one grant for two presses on „Da" with nothing awaited between them', async () => {
      const { server, settle } = servingSlowly()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const da = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' })

      /* THE RACE ITSELF: two clicks with nothing awaited between them, grouped in one `act` so
         neither can commit before the other is dispatched. */
      act(() => {
        da.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        da.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      settle(new Response(null, { status: 201 }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      expect(grantsIn(server.asked)).toEqual([{ competitorId: 41, ground: 'feeExempt' }])

      server.stop()
    })

    /**
     * AND THE SAME RACE ON THE PATH THAT HAS NO SHEET AT ALL, WHICH IS NEW ON 28.09.2026.
     *
     * <p><b>Both cases above press „Da" on a sheet, and his cases 1, 2 and 7 never open one.</b>
     * „Aktivacija prolazi" means one press on „Aktiviraj" goes straight to
     * `POST /api/payments` - so the button itself became a door that starts a request, where before
     * it only ever opened a question. Neither case above reaches that door, so without this one the
     * guard on it would be unmeasured on the very path that is easiest to double-press: there is no
     * sheet in the way and nothing moves on the screen to tell the moderator his press landed.
     *
     * <p><b>And it is the path where the stake is highest.</b> A grant and a booking both draw a
     * member number and `nextval('member_number_seq')` never gives one back (PDL section 19,
     * „Aktivacija trosi clanski broj nepovratno"); the loser of two requests in the air fails on
     * `membership_pk` with the number it drew already spent.
     *
     * <p><b>Two raw clicks in one `act`</b>, for the reason the case above gives: `user.click`
     * awaits its own click through, so `activating` would have caught up and a mutation swapping
     * the ref for that state would survive. A ref is read fresh whichever closure asks.
     */
    it('sends only one payment for two presses on „Aktiviraj" with nothing awaited between', async () => {
      const { server, settle } = servingSlowly()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      /* His case 1, so the press books it and opens nothing. */
      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '43,50')

      const aktiviraj = within(row).getByRole('button', { name: 'Aktiviraj' })

      act(() => {
        aktiviraj.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        aktiviraj.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      settle(new Response(null, { status: 201 }))

      await waitFor(() => {
        expect(paymentsIn(server.asked)).toEqual([
          {
            competitorId: 58,
            received: 43.5,
            useTheBalance: true,
            method: 'paypal',
            reference: null,
          },
        ])
      })

      /* AND NO SHEET WAS EVER PUT UP, so this really did measure the path without one. */
      expect(screen.queryByRole('dialog')).toBeNull()

      server.stop()
    })

    /**
     * WCAG 2.2 AA 4.1.2: A CONTROL SAYS ITS OWN STATE, AND „AKTIVIRAJ" HAS TWO OF THEM NOW.
     *
     * <p><b>`aria-disabled` and not `disabled`</b> - measured rather than assumed, because the
     * two read differently to a test as well as to a screen reader: `disabled` takes the
     * control out of the tab order, and the one case that can send nothing at all
     * (`activation.ts#Press`, `'nothing'`) still uses exactly that. This is the second,
     * independent reason the same row can give, the shape `PendingQueue.tsx`'s own „Odobri"
     * already carries for the same reason: a control that leaves the row takes the keyboard with
     * it.
     */
    it('says it cannot act while its own request is out, without leaving the tab order', async () => {
      const { server, settle } = servingSlowly()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')
      const aktiviraj = within(row).getByRole('button', { name: 'Aktiviraj' })

      expect(aktiviraj).not.toHaveAttribute('aria-disabled')

      await user.click(aktiviraj)
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

      expect(aktiviraj).toHaveAttribute('aria-disabled', 'true')
      expect(aktiviraj).not.toBeDisabled()

      settle(new Response(null, { status: 201 }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      server.stop()
    })

    /**
     * <p><b>WITHOUT THIS, THE GUARD ABOVE COULD LOCK THE ROW SHUT FOREVER AND NO CASE WOULD SAY
     * SO.</b> Reset in `finally`, so a refusal lets the next press in exactly as an outright
     * rejection would - `PendingQueue.tsx#approveAll` keeps the same shape and gives the same
     * reason. Measured on a REFUSAL rather than on success, because success remounts the whole
     * list (`Payments`'s own `onActivated`) and takes this row with it; a refusal is the one
     * answer that leaves the row standing to be pressed again.
     */
    it('lets the row try again once the server has refused it', async () => {
      const server = serving(OUTSTANDING, () =>
        new Response(JSON.stringify({ reason: 'nothingWouldComeOffTheBalance' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      )
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Nikola Zorić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Odobri iz balansa' }),
      )

      await within(await rowOf('Nikola Zorić')).findByText(/Sa balansa ovog člana/)

      const aktivirajAgain = within(await rowOf('Nikola Zorić')).getByRole('button', {
        name: 'Aktiviraj',
      })

      expect(aktivirajAgain).not.toHaveAttribute('aria-disabled')

      await user.click(aktivirajAgain)

      expect(await screen.findByRole('dialog')).toBeVisible()

      server.stop()
    })

    /**
     * <p><b>„NE" NEVER RAISES THE FLAG IN THE FIRST PLACE</b>, because declining never calls
     * `activate` at all - so there is nothing for the row to hold onto and nothing that needs
     * to be let go. Measured all the same, because a mutation that raised it on decline too
     * would otherwise stand uncaught: the row would look identical until the moment it refused
     * to open again.
     */
    it('does not leave the row stuck after „Ne"', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')
      const aktiviraj = within(row).getByRole('button', { name: 'Aktiviraj' })

      await user.click(aktiviraj)
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Odustani' }))

      expect(aktiviraj).not.toHaveAttribute('aria-disabled')

      await user.click(aktiviraj)
      expect(await screen.findByRole('dialog')).toBeVisible()
      expect(grantsIn(server.asked)).toEqual([])

      server.stop()
    })
  })

  /**
   * „NE", „ODUSTANI" AND ESCAPE DO NOTHING WHILE THE SHEET'S OWN REQUEST IS OUT (owner,
   * 02.10.2026, choosing between three outcomes he was priced; PDL, „Odluke iz ciscenja nalaza",
   * and the registry's items 259, 352 and 354).
   *
   * <p><b>What the sheet did until then.</b> „Da" sent the request and the sheet stayed up for
   * exactly as long as the row's own button was told off - but „Ne", „Odustani" and Escape were
   * all still live, and each of them put the sheet away. The moderator read that as „I took it
   * back" while the request went on to the server and drew a member number that cannot be given
   * back (PDL section 19, „Aktivacija trosi clanski broj nepovratno"). A refusal arriving
   * afterwards was then drawn under a question that was no longer there.
   *
   * <p><b>The press is measured by what the SHEET does and by what the SERVER received</b>, and
   * the three questions are three cases because they are three different `Prompt` calls: his 6
   * and his 3 say „Ne", his 4 and 5 say „Odustani", and only the second of those two shapes has
   * two ways of saying yes.
   */
  describe('while its request is out, the question cannot be put away', () => {
    /**
     * <p>Ana, first row, his case 6: one way of saying yes, and „Ne" beside it. A press on „Ne"
     * after „Da" must leave the sheet exactly where it was, and the request that was already on
     * its way must still be the only one.
     */
    it('keeps the sheet up when „Ne" is pressed after „Da", and the grant still goes once', async () => {
      const { server, settle } = servingSlowly()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

      const ne = within(screen.getByRole('dialog')).getByRole('button', { name: 'Ne' })

      /* TOLD OFF AND NOT SWITCHED OFF, which is the portal's own answer and the one the row's
         „Aktiviraj" already gives: `disabled` would take the control out of the tab order, and
         the button that was just pressed has the focus. */
      expect(ne).toHaveAttribute('aria-disabled', 'true')
      expect(ne).not.toBeDisabled()

      await user.click(ne)

      expect(screen.getByRole('dialog')).toBeVisible()

      settle(new Response(null, { status: 201 }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      expect(grantsIn(server.asked)).toEqual([{ competitorId: 41, ground: 'feeExempt' }])

      server.stop()
    })

    /**
     * <p>Nikola, his case 4: two ways of saying yes, and „Odustani" is the way out. Both of the
     * ways of saying yes are told off too, because a second one pressed while the first is out
     * would be an answer to a question that has already been answered.
     */
    it('keeps the sheet up when „Odustani" is pressed, and tells off every button on it', async () => {
      const { server, settle } = servingSlowly()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Nikola Zorić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Odobri iz balansa' }),
      )

      const sheet = within(screen.getByRole('dialog'))

      for (const name of ['Odobri oslobođenje od članarine', 'Odobri iz balansa', 'Odustani']) {
        expect(sheet.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true')
      }

      await user.click(sheet.getByRole('button', { name: 'Odustani' }))

      expect(screen.getByRole('dialog')).toBeVisible()

      settle(new Response(null, { status: 201 }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      expect(grantsIn(server.asked)).toEqual([{ competitorId: 77, ground: 'balance' }])

      server.stop()
    })

    /**
     * <p>Petar, fourth row and in euro, his case 3: thirty typed over a balance that does not
     * reach the rest. The question carries the body of the PAYMENT door, so this is also the one
     * that says the sheet is as inert in front of that door as in front of the other.
     */
    it('keeps the shortfall question up when „Ne" is pressed, and the payment goes once', async () => {
      const { server, settle } = servingSlowly()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '30')
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ne' }))

      expect(screen.getByRole('dialog')).toBeVisible()

      settle(new Response(null, { status: 201 }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      expect(paymentsIn(server.asked)).toEqual([
        { competitorId: 58, received: 30, useTheBalance: true, method: 'paypal', reference: null },
      ])
      expect(grantsIn(server.asked)).toEqual([])

      server.stop()
    })

    /**
     * ESCAPE IS NOT „NE" WHILE THE REQUEST IS OUT, AND IT IS STILL STOPPED.
     *
     * <p><b>Two things are asserted and they are not the same thing.</b> The sheet stays up, which
     * is the rule. And the press still does not reach a bubble-phase listener on the document,
     * which is what `components/Prompt.tsx` writes down for the menus behind it: a press that
     * answers nothing is still a press the sheet took, and one that leaked to the language menu
     * would shut a menu the reader left open while doing nothing to the question.
     */
    it('ignores Escape, and does not let it through to the document either', async () => {
      const bubbled: string[] = []
      const onBubble = (pressed: KeyboardEvent) => bubbled.push(pressed.key)

      document.addEventListener('keydown', onBubble)

      const { server, settle } = servingSlowly()
      const user = setupUser()

      try {
        renderAt(ADDRESS, 'superadmin')

        const row = await rowOf('Ana Ilić')

        await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
        await user.click(
          within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }),
        )

        /* The focus is on the „Da" that was just pressed, which is inside the sheet, so the press
           goes through the sheet's own handler exactly as a reader's would. */
        const before = bubbled.length

        await user.keyboard('{Escape}')

        expect(screen.getByRole('dialog')).toBeVisible()
        expect(bubbled.slice(before)).toEqual([])

        settle(new Response(null, { status: 201 }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

        expect(grantsIn(server.asked)).toEqual([{ competitorId: 41, ground: 'feeExempt' }])
      } finally {
        document.removeEventListener('keydown', onBubble)
        server.stop()
      }
    })

    /**
     * THE STATE IS SAID IN WORDS, AND ONLY WHILE IT IS TRUE (WCAG 2.2 AA, 4.1.3).
     *
     * <p>„Šalje se" is the portal's own sentence for a request that is out (`results.sending`
     * and four others of the same words), so no sentence was invented for this. The region is on
     * the sheet from the moment it opens and EMPTY until a request is out, which is the shape
     * `activate__said` beside it already has: a region added to the page together with its text
     * is one a screen reader often misses.
     */
    it('says that it is sending, only while the request is out', async () => {
      const { server, settle } = servingSlowly()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const status = within(await screen.findByRole('dialog')).getByRole('status')

      expect(status).toBeEmptyDOMElement()

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Da' }))

      expect(status).toHaveTextContent('Šalje se')

      settle(new Response(null, { status: 201 }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      server.stop()
    })

    /**
     * THE SHEET CLOSES ITSELF WHEN A REFUSAL ARRIVES, AND THE NEXT QUESTION IS A FRESH ONE.
     *
     * <p>The other end of the same sentence of the owner's: „List se zatvara sam kad stigne
     * odgovor", and an answer is not only a 201. A press on „Ne" made while the request was out
     * must not have left anything behind that stops the refusal from closing the sheet or the
     * row from being pressed again.
     */
    it('closes itself on a refusal, says why, and asks again from the start', async () => {
      const { server, settle } = servingSlowly()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Nikola Zorić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Odobri iz balansa' }),
      )
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Odustani' }))

      settle(
        new Response(JSON.stringify({ reason: 'nothingWouldComeOffTheBalance' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      )

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(
        await within(await rowOf('Nikola Zorić')).findByText(/Sa balansa ovog člana/),
      ).toBeVisible()

      await user.click(within(await rowOf('Nikola Zorić')).getByRole('button', { name: 'Aktiviraj' }))

      const fresh = within(await screen.findByRole('dialog'))

      expect(fresh.getByRole('button', { name: 'Odustani' })).not.toHaveAttribute('aria-disabled')
      expect(fresh.getByRole('status')).toBeEmptyDOMElement()

      server.stop()
    })
  })

  /**
   * WHERE THE FOCUS GOES WHEN THE ROW IT WAS ON HAS LEFT THE LIST (WCAG 2.2 AA, 2.4.3; registry
   * item 255).
   *
   * <p><b>`Payments` reads the list again by remounting it</b> (`key={readAgain}`), so an
   * activation that goes through takes every row with it, the „Aktiviraj" the focus had been put
   * back on included. For a refusal nothing is remounted and the sheet's own cleanup puts the
   * focus back on that button; for a success there was nothing to put it back on, and it fell to
   * the document.
   *
   * <p><b>The precedent is `admin/AdminMembers.tsx`</b> (and `RowActions.deleteRow` in
   * `admin/EntityEditor.tsx`): when a row is deleted the focus goes to a control that is on the
   * screen whatever happens to the row - there the search box - so the keyboard is left where the
   * work is rather than at the top of the document. The search box is the same one here. It is
   * moved to AFTER the list has been read again, because the box that is on the screen when the
   * answer arrives is the old one and the remount destroys it too.
   */
  describe('where the focus goes once the row is gone', () => {
    const SEARCH = 'Pretraga po članskom broju, imenu ili prezimenu'

    /**
     * <p>His case 1, no sheet at all: the press books at once, so the focus is on „Aktiviraj"
     * itself when the answer comes and that button is gone with the row. Petar, fourth of six.
     */
    it('goes to the search box when a payment booked at once has taken its row off the list', async () => {
      const { server, reads } = servingTheListWithout(58)
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '43,50')
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      await waitFor(() => expect(screen.queryByText('Petar Marko')).toBeNull())

      expect(reads.count).toBe(2)
      await waitFor(() => expect(screen.getByRole('searchbox', { name: SEARCH })).toHaveFocus())

      server.stop()
    })

    /** <p>And through a question, where the sheet's own cleanup has already put the focus back on
     *  the button that opened it, one step before that button goes. Ana, first row, his case 6. */
    it('goes to the search box when an answered question has taken its row off the list', async () => {
      const { server } = servingTheListWithout(41)
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Da' }))

      await waitFor(() => expect(screen.queryByText('Ana Ilić')).toBeNull())
      await waitFor(() => expect(screen.getByRole('searchbox', { name: SEARCH })).toHaveFocus())

      server.stop()
    })

    /**
     * <p><b>NOT ON THE FIRST DRAWING OF THE SCREEN.</b> The search box takes the focus because a
     * row left, and arriving on the screen is not that: a moderator who has just opened it has
     * the focus where the page put it, and a box that grabbed it on every mount would be the
     * first thing every keyboard reader here had to get away from.
     */
    it('is not taken by the search box when the screen is first drawn', async () => {
      const server = serving()
      renderAt(ADDRESS, 'superadmin')

      await rowOf('Ana Ilić')

      expect(screen.getByRole('searchbox', { name: SEARCH })).not.toHaveFocus()

      server.stop()
    })

    /**
     * <p><b>AND NOT AFTER A REFUSAL</b>, where nothing left the list and the row is still there to
     * go back to. The focus is on the button that opened the question, which is what the sheet's
     * own cleanup does and what a keyboard reader pressing it again expects.
     */
    it('stays on the button that opened the question when the server refuses', async () => {
      const server = serving(OUTSTANDING, () =>
        new Response(JSON.stringify({ reason: 'nothingWouldComeOffTheBalance' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      )
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const opener = within(await rowOf('Nikola Zorić')).getByRole('button', { name: 'Aktiviraj' })

      await user.click(opener)
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Odobri iz balansa' }),
      )

      await within(await rowOf('Nikola Zorić')).findByText(/Sa balansa ovog člana/)

      expect(opener).toHaveFocus()
      expect(screen.getByRole('searchbox', { name: SEARCH })).not.toHaveFocus()

      server.stop()
    })
  })
})
