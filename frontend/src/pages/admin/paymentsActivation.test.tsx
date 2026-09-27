import { screen, waitFor, within } from '@testing-library/react'
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
 * <p><b>THREE OF THE SEVEN REACH A ROUTE TODAY AND FOUR DO NOT, and which four is measured
 * rather than asserted here.</b> `activation.test.ts` holds the whole grid without mounting
 * anything, and `activation.ts#theServerCanDoIt` names what is missing for the other four: no
 * amount on `POST /api/payments` at all, a balance spent by what a QR code promised rather than
 * by the tick box, and a `method` whose only correct value for Serbia the schema does not know.
 * What this file measures is the SCREEN: which control is drawn, which is disabled, what is sent,
 * and what is not sent.
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
  function serving(answer: Outstanding = OUTSTANDING, writeAnswers = () => new Response(null, { status: 201 })) {
    clearResourceCache()

    return serverThat((path, init) => {
      if (path === '/api/payments' && (init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify(answer), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (path === '/api/memberships' && init?.method === 'POST') {
        return writeAnswers()
      }

      return null
    })
  }

  /** What was sent to the write route, as the body the server actually received. */
  function grantsIn(asked: Asked[]): unknown[] {
    return asked
      .filter((one) => one.path === '/api/memberships' && one.init?.method === 'POST')
      .map((one) => JSON.parse(String(one.init?.body)))
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

      /* The field, found BY ITS LABEL and never by a class, and empty to begin with. */
      /* ASKED FOR BY THE NAME IT REALLY HAS, and the currency is part of that name: a reader
         who cannot see the mark beside the box would otherwise be typing an amount into a field
         whose currency nobody told him, on a screen where the other five rows may be in the
         other one. */
      /* ASKED FOR BY THE NAME IT REALLY HAS, and the currency is part of that name: a reader
         who cannot see the mark beside the box would otherwise be typing an amount into a field
         whose currency nobody told him, on a screen where the other five rows may be in the
         other one. */
      const field = within(row).getByLabelText('Uplaćeno (EUR)')

      expect(field).toHaveValue('')

      /* The tick box, found by the label that carries HIS balance, and ticked to begin with. */
      const box = within(row).getByLabelText('uključi balans (12,75 EUR)')

      expect(box).toBeChecked()
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

  describe('the four cases that need an amount on the wire', () => {
    /**
     * <p><b>THE BUTTON IS DISABLED FOR ALL FOUR, and the four are measured one by one rather than
     * as „an amount was typed".</b> Each is one of the owner's own cases and each would be a
     * different write: equal (his 1), more (7), less and covered (2), less and short (3).
     * `activation.ts#theServerCanDoIt` says what is missing for them.
     *
     * <p>Measured against PETAR, fourth row, in euro, so the amounts are his and not the first
     * row's.
     */
    it.each([
      ['the expected amount, which is his case 1', '43,50'],
      ['more than expected, his case 7', '50'],
      ['less, with a balance that covers the difference, his case 2', '35'],
      ['less, short even with the whole balance, his case 3', '20'],
    ])('will not activate on %s', async (_what, typed) => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), typed)

      expect(within(row).getByRole('button', { name: 'Aktiviraj' })).toBeDisabled()

      server.stop()
    })

    /**
     * <p><b>AND NOTHING IS SENT, which is the half a disabled attribute does not prove.</b> A
     * button drawn disabled but still wired would send on a press that arrived some other way.
     */
    it('sends nothing at all while an amount stands in the field', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Petar Marko')

      await user.type(within(row).getByLabelText('Uplaćeno (EUR)'), '43,50')
      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      expect(grantsIn(server.asked)).toEqual([])
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
      expect(sheet).toContainElement(document.activeElement as HTMLElement)
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
    it('keeps the keyboard inside it', async () => {
      const server = serving()
      const user = setupUser()
      renderAt(ADDRESS, 'superadmin')

      const row = await rowOf('Ana Ilić')

      await user.click(within(row).getByRole('button', { name: 'Aktiviraj' }))

      const sheet = await screen.findByRole('dialog')

      for (let step = 0; step < 8; step += 1) {
        await user.tab()
        expect(sheet).toContainElement(document.activeElement as HTMLElement)
      }

      /* And backwards, which is its own wrap and its own branch. */
      for (let step = 0; step < 8; step += 1) {
        await user.tab({ shift: true })
        expect(sheet).toContainElement(document.activeElement as HTMLElement)
      }

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
})
