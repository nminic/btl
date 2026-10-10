import {
  FREE_OF_THE_FEE,
  MEMBERSHIPS,
  ON_THE_BALANCE,
  PAYMENTS,
  sending,
  typedIn,
  whatToDo,
  type Typed,
} from './activation'

/**
 * THE OWNER'S SEVEN CASES, MEASURED WITHOUT MOUNTING ANYTHING.
 *
 * <p><b>NO CONSTANT HERE STANDS FOR TWO THINGS, AND THE AXES ARE COUNTED RATHER THAN FELT.</b>
 * The rule this follows is the one written on 06.09.2026: a case whose value could arrive from
 * two places measures nothing, so each number below differs from every other number that could
 * be mistaken for it.
 *
 * <ul>
 * <li><b>`EXPECTED`, `PRICE` and the balances are never equal and none is a multiple of another</b>
 * (except where a case says it is on purpose), so „the expected amount" can never stand in for
 * „the price" and neither for „the balance", and a decision reading the wrong one of the three
 * answers differently. `EXPECTED` is what he SENDS, 43, and `PRICE` is the fee without the
 * processing charge, 40: the two are a position apart in `whatToDo`'s signature, and a call that
 * swaps them is told apart because they are different numbers.
 * <li><b>An amount that is typed and the expected amount are whole numbers, and the balance is
 * the one number that is not</b> (PDL, ODLUKA 02.10.2026, „Iznosi se unose kao celi brojevi", and
 * for what is typed 10.10.2026: „balans sme decimale"). So the non-round numbers of this file are
 * balances: 12.75, 41.5, 71.25, and the pair 4.35 / 0.07 that no whole number can stand in for.
 * <li><b>`4.35` and `0.07` are in the file on purpose</b>: `4.35 * 100` is `434.99999999999994` and
 * `0.07 * 100` is `7.000000000000001`, so a shortfall worked out from them without rounding to
 * whole paras comes out as a tail of nines, and one rounded the wrong way is a para out. Until
 * 10.10.2026 the pair here was `8.20 + 0.10` against `8.30`, which needs a typed amount with a
 * fraction in it and a typed amount has none now.
 * <li><b>Every state of the tick box is measured against BOTH a balance that covers and one
 * that does not</b>, because the box and the size of the balance are two axes and a case using
 * one for the other would pass on half the grid.
 * </ul>
 */
describe('which of the seven cases a row is in', () => {
  /** With the processing charge in it, which is what the owner decided „Ocekivan iznos" means:
   *  a fee of forty and a charge of three. Whole, as every expected amount is since 10.10.2026. */
  const EXPECTED = 43

  /** The fee WITHOUT the charge, the one number a balance is measured against when nothing is
   *  typed (PDL, [IZVEDENO 02.10.2026] „Članarina plaćena iz balansa ne nosi taksu"). */
  const PRICE = 40

  /** Enough to cover the whole of it, and not a round number. */
  const COVERS = 71.25

  /** Something, but not enough: below the price as well as below the expected amount. Distinct
   *  from every other number in the file. */
  const SHORT = 12.75

  /** BETWEEN THE PRICE AND THE EXPECTED AMOUNT, which is the band the owner's change is about: it
   *  covers the fee to the last para and does not reach what he would send. Not a round number. */
  const IN_THE_BAND = 41.5

  const TICKED = true

  const CLEARED = false

  /** So a case never has to build one of these by hand and never accidentally builds a nought. */
  const amount = (value: number): Typed => ({ got: 'amount', value })

  describe('reading what is in the field', () => {
    /**
     * THE OWNER'S DECISION OF 27.09.2026, POINT 5 OF SECTION 19, AND THE ONE THING IT TURNS ON.
     *
     * <p>„Prazno polje i ukucana nula vode na ISTI prompt, onaj o oslobodjenju od clanarine."
     * Four spellings, one state. <b>The mutation this exists for is reading the SPELLING</b>: a
     * guard written as `said === '0'` passes the first of these and fails the last. `'0.00'` and
     * `'0,00'` were two more of the five until 10.10.2026 and are not: an amount is typed without a
     * dot or a comma (PDL, ODLUKA 02.10.2026, „Iznosi se unose kao celi brojevi"), so a nought
     * written with one is refused, DERIVED from that decision and told to the owner in one sentence
     * among the derived items of 10.10.2026 (point 15, K). Both are rows of the table of refusals
     * below.
     */
    it.each([
      ['empty', ''],
      ['a space', ' '],
      ['nought', '0'],
      ['nought written with more zeros', '00'],
    ])('treats %s as nothing typed', (_what, said) => {
      expect(typedIn(said)).toEqual({ got: 'nothing' })
    })

    /**
     * <p><b>Whole numbers, read by value, with the spaces around them taken off.</b> `'007'` is seven
     * and not a refusal (a leading zero is a spelling, and the value is what is decided), and a
     * number as long as the column will not keep is still a number here and is refused by the
     * route, which knows what `numeric(10,2)` holds (`theAmountIsNotKeptExactly`).
     */
    it('reads a whole amount', () => {
      expect(typedIn('43')).toEqual({ got: 'amount', value: 43 })
      expect(typedIn(' 4800 ')).toEqual({ got: 'amount', value: 4800 })
      expect(typedIn('007')).toEqual({ got: 'amount', value: 7 })
    })

    /**
     * <p><b>`4.800` IS THE CASE THIS TEST IS REALLY FOR, AND SO IS EVERY WRITING WITH A DOT OR A
     * COMMA IN IT.</b> `Number('4.800')` is `4.8` - finite, positive, and four thousand seven
     * hundred and ninety five too small - so a guard that only asks `Number.isFinite` accepts it
     * and books the wrong money in silence. The portal writes „4.800" itself (`i18n/format.ts`
     * writes Serbian), so this is what somebody reading the expected amount off the screen and
     * typing it back produces. It is no longer the only one refused: an amount is typed as a whole
     * number, without a dot or a comma (PDL, ODLUKA 02.10.2026, recorded as the owner's own words:
     * „Iznosi se unose bez tačaka i zareza!"), so one decimal, two of them with either separator,
     * and a nought written with a separator are refused as well. Until 10.10.2026 only a third
     * decimal digit was (and with it the grouped thousand).
     *
     * <p>Negative and unreadable are here for a different reason:
     * `payment_amount_positive` (V16:105) refuses nought and below, so neither has a row it
     * could ever become.
     */
    it.each([
      ['a grouped thousand, which would read four point eight', '4.800'],
      ['a grouped thousand written the other way', '4,800'],
      ['one decimal', '43.5'],
      ['two decimals with a dot', '43.50'],
      ['two decimals with a comma', '43,50'],
      ['three decimals', '43.500'],
      ['a nought written out with a dot', '0.00'],
      ['a nought written the Serbian way', '0,00'],
      ['a negative amount', '-5'],
      ['a negative nought', '-0'],
      ['words', 'nesto'],
      ['an amount with a word after it', '43 RSD'],
      ['two separators', '4.800,50'],
      ['a separator and nothing after it', '43.'],
      ['a space inside', '4 800'],
      ['an exponent', '4e3'],
      ['a plus sign', '+43'],
    ])('refuses %s', (_what, said) => {
      expect(typedIn(said)).toEqual({ got: 'refused' })
    })
  })

  describe('with nothing typed', () => {
    /**
     * CASE 4: the balance reaches the price, so the two buttons are „Odobri
     * oslobodjenje od clanarine" and „Odobri iz balansa".
     */
    it('offers the balance or the exemption, and says the balance covers it', () => {
      expect(whatToDo({ got: 'nothing' }, EXPECTED, PRICE, COVERS, TICKED)).toEqual({
        does: 'offersTheBalanceOrTheExemption',
        covers: true,
      })
    })

    /**
     * CASE 5: there is something on the book but not enough, so the second button becomes
     * „Odobri umanjen iznos iz balansa". <b>One ground and two labels</b>, which is what the
     * server calls it too.
     */
    it('offers the same two and says the balance does not cover it', () => {
      expect(whatToDo({ got: 'nothing' }, EXPECTED, PRICE, SHORT, TICKED)).toEqual({
        does: 'offersTheBalanceOrTheExemption',
        covers: false,
      })
    })

    /**
     * <p><b>THE BOUNDARY BETWEEN 4 AND 5 IS MEASURED FROM BOTH SIDES AND ONE PARA APART, AND IT IS
     * THE PRICE'S.</b> Equal counts as covering - he owes exactly what he has - and one para less
     * does not. A comparison written `>` rather than `>=` passes every other case in this file and
     * fails only this pair.
     */
    it('counts a balance equal to the price as covering it', () => {
      expect(whatToDo({ got: 'nothing' }, EXPECTED, PRICE, PRICE, TICKED)).toEqual({
        does: 'offersTheBalanceOrTheExemption',
        covers: true,
      })

      expect(whatToDo({ got: 'nothing' }, EXPECTED, PRICE, 39.99, TICKED)).toEqual({
        does: 'offersTheBalanceOrTheExemption',
        covers: false,
      })
    })

    /**
     * <p><b>THE BAND, WHICH IS THE WHOLE OF THE OWNER'S CHANGE OF 10.10.2026.</b> A fee paid out of
     * a balance carries no processing charge (PDL, [IZVEDENO 02.10.2026] „Članarina plaćena iz
     * balansa ne nosi taksu"), and the server takes `min(balance, price)` off the book. A member
     * abroad whose balance stands between the fee and the fee plus the charge - 41.50 against 40
     * and 43 - is therefore covered to the last para, and the second button is „Odobri iz balansa".
     * Measured against the expected amount it was „Odobri umanjen iznos iz balansa" over a book the
     * server spends as a whole fee, which told a moderator one thing on an act that cannot be
     * undone and did another.
     *
     * <p><b>Three balances, all inside the band and at both ends of it:</b> the middle, exactly
     * what he would send, and one para under it. A comparison against the expected amount answers
     * the first and the third as „does not cover", which is the mutation this holds shut; the
     * middle one alone would pass a comparison against the price plus a fraction of the charge.
     */
    it('says a balance in the band between the price and what he sends covers the fee', () => {
      for (const balance of [IN_THE_BAND, EXPECTED, 42.99]) {
        expect(whatToDo({ got: 'nothing' }, EXPECTED, PRICE, balance, TICKED)).toEqual({
          does: 'offersTheBalanceOrTheExemption',
          covers: true,
        })
      }
    })

    /** CASE 6: the box is cleared, so the balance is not a way to pay and only the exemption is
     *  left. <b>Measured with a balance that WOULD cover</b>, so clearing the box is what
     *  decides rather than there being nothing to spend. */
    it('asks only about the exemption when the box is cleared, however big the balance', () => {
      expect(whatToDo({ got: 'nothing' }, EXPECTED, PRICE, COVERS, CLEARED)).toEqual({
        does: 'asksAboutTheExemption',
      })
    })

    /**
     * <p><b>THE STATE THE OWNER'S GRID DOES NOT NAME, and it is the commonest one on the
     * screen.</b> Box ticked, nothing at all on the book: the box offers the balance as a way
     * to pay and nought is not one, so the only ground left is the exemption. Most of this list
     * is in exactly this state, since `BalanceBook.forEveryOneOf` answers `NOTHING` for
     * everybody who has no entry.
     */
    it('asks only about the exemption when the box is ticked over an empty book', () => {
      expect(whatToDo({ got: 'nothing' }, EXPECTED, PRICE, 0, TICKED)).toEqual({
        does: 'asksAboutTheExemption',
      })
    })
  })

  describe('with an amount typed', () => {
    /** CASE 1, and the tick box says „svejedno" in the owner's table, so both states of it are
     *  measured rather than one being assumed not to matter. */
    it.each([
      ['ticked', TICKED],
      ['cleared', CLEARED],
    ])('books the payment when the amount is the expected one, box %s', (_what, box) => {
      expect(whatToDo(amount(EXPECTED), EXPECTED, PRICE, COVERS, box)).toEqual({
        does: 'booksThePayment',
      })
    })

    /** CASE 7, „svejedno" again and so measured both ways. */
    it.each([
      ['ticked', TICKED],
      ['cleared', CLEARED],
    ])('credits the surplus when more than expected arrived, box %s', (_what, box) => {
      expect(whatToDo(amount(50), EXPECTED, PRICE, COVERS, box)).toEqual({
        does: 'creditsTheSurplus',
      })
    })

    /** <p>One unit either way of the expected amount, so „equal" and „more" are told apart at the
     *  boundary rather than only in the middle. One unit and not one para, since an amount that is
     *  typed is a whole number: there is nothing between 43 and 44 that anybody can type. */
    it('tells equal from more one unit apart', () => {
      expect(whatToDo(amount(EXPECTED + 1), EXPECTED, PRICE, 0, CLEARED)).toEqual({
        does: 'creditsTheSurplus',
      })

      expect(whatToDo(amount(EXPECTED - 1), EXPECTED, PRICE, 0, CLEARED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 1,
      })
    })

    /**
     * <p><b>AN AMOUNT THAT WAS TYPED IS MEASURED AGAINST WHAT HE SENDS AND NEVER AGAINST THE
     * PRICE</b>, which is the other half of the owner's change of 10.10.2026 and the half that must
     * NOT move. The price is the number a BALANCE is measured against when nothing is typed (a fee
     * paid out of a balance carries no processing charge); money that arrived is compared with the
     * sum, because what he sends is what pays, and the route measures the shortfall against the
     * same total (`PaymentApi`, `theshortfallIsMeasuredAgainstTheSameTotalSoAbalanceMayPayAprocessingFee`).
     *
     * <p>40 is the price and is three short of 43, so an amount equal to the PRICE is a shortfall and
     * not his case 1; and 30 with a balance of 10 reaches exactly the price and not what he sends,
     * so that pair is a question and not his case 2. A comparison that read the price where it
     * reads the expected amount answers both of them the other way and passes everything else.
     */
    it('measures an amount that arrived against what he sends and never against the price', () => {
      expect(whatToDo(amount(PRICE), EXPECTED, PRICE, 0, CLEARED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 3,
      })

      expect(whatToDo(amount(30), EXPECTED, PRICE, 10, TICKED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 3,
      })
    })

    /** CASE 2: less arrived, the box is ticked, and the balance covers the difference. */
    it('spends the balance and books when the balance covers the difference', () => {
      expect(whatToDo(amount(35), EXPECTED, PRICE, SHORT, TICKED)).toEqual({
        does: 'spendsTheBalanceAndBooks',
      })
    })

    /**
     * CASE 3, in the owner's own words: „ukljucen balans koji kad se iskoristi POTPUNO i dalje
     * nije ukupan zbir jednak ocekivanog... zelim prompt". <b>So the balance is spent to the
     * last and the question is about what is left</b>, which is why the shortfall is carried
     * and is 43 - 20 - 12.75.
     */
    it('asks about the shortfall left after the whole balance is spent', () => {
      expect(whatToDo(amount(20), EXPECTED, PRICE, SHORT, TICKED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 10.25,
      })
    })

    /**
     * CASE 3b: the same question with the box cleared, and <b>measured against a balance that
     * WOULD have covered the difference</b>. That is the whole of what clearing the box means
     * (PDL 23a): a case using an empty book here would pass whether the box were read or not.
     */
    it('asks about the whole shortfall when the box is cleared, ignoring a balance that would cover it', () => {
      expect(whatToDo(amount(35), EXPECTED, PRICE, COVERS, CLEARED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 8,
      })
    })

    /** <p>And the boundary of case 2 against case 3, one para apart on the SUM rather than on
     *  either number, so an arithmetic that reads only one of the two cannot pass. The amount is
     *  whole and the para is the balance's: 30 and 13 reach 43 exactly, and 30 and 12.99 are a
     *  para short of it. */
    it('tells covered from short one para apart on the sum', () => {
      expect(whatToDo(amount(30), EXPECTED, PRICE, 13, TICKED)).toEqual({
        does: 'spendsTheBalanceAndBooks',
      })

      expect(whatToDo(amount(30), EXPECTED, PRICE, 12.99, TICKED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 0.01,
      })
    })

    /**
     * <p><b>THE SHORTFALL IS WORKED OUT IN WHOLE PARAS AND COMES OUT AS A CLEAN NUMBER, which is
     * what is left of the case this file held for the rounding until 10.10.2026.</b> That case was
     * `8.20 + 0.10` against `8.30` (measured on review of PR 411: in binary the first is
     * `8.299999999999999` and the second `8.300000000000001`, so comparing the raw sums reported a
     * shortfall of `2.27e-15`). It needs a TYPED amount with a fraction in it, and a typed amount
     * is a whole number now (PDL, ODLUKA 02.10.2026, „Iznosi se unose kao celi brojevi"), as is the
     * expected amount; with both whole the sum of the two cannot miss its target by a hair, so the
     * pair has no input left that the field or the server can produce. The balance still has
     * decimals, though, and the shortfall that is SHOWN is where they surface.
     *
     * <p><b>`4.35 * 100` is `434.99999999999994` and `0.07 * 100` is `7.000000000000001`</b>, so a
     * balance of either, taken off a whole difference without rounding to whole paras, comes out as
     * `0.6500000000000004` and `0.9299999999999999` where the moderator is shown „0,65" and „0,93";
     * truncated rather than rounded it is a para out in one direction (434) and rounded up it is a
     * para out in the other (8). One row for each, so the mutations „no rounding", „round down" and
     * „round up" all fall on this table.
     */
    it.each([
      ['4.35, which a truncation takes a para off', 38, 4.35, 0.65],
      ['0.07, which a rounding up adds a para to', 42, 0.07, 0.93],
    ])('says the shortfall in whole paras: a balance of %s', (_what, typed, balance, short) => {
      expect(whatToDo(amount(typed), EXPECTED, PRICE, balance, TICKED)).toEqual({
        does: 'asksAboutTheShortfall',
        short,
      })
    })
  })

  /**
   * <p><b>Measured for every state of the other two axes</b>, because a field that cannot be
   * read decides the whole row and must not be overtaken by anything else on it.
   */
  it.each([
    ['ticked, balance covers', COVERS, TICKED],
    ['ticked, balance short', SHORT, TICKED],
    ['ticked, no balance', 0, TICKED],
    ['cleared, balance covers', COVERS, CLEARED],
  ])('refuses at the field whatever else the row is in (%s)', (_what, balance, box) => {
    expect(whatToDo({ got: 'refused' }, EXPECTED, PRICE, balance, box)).toEqual({
      does: 'theFieldRefuses',
    })
  })
})

/**
 * WHAT ONE PRESS SENDS, AND TO WHICH OF THE TWO DOORS.
 *
 * <p><b>THE JOIN IS WHAT THIS FILE IS FOR, and it is a different question from „which case is
 * this".</b> That one is answered above and `whatToDo` carries no amount at all; this one is
 * „which number out of the row goes into which field of the request", and it is the sort of thing
 * that used to be settled inside a click handler where only a rendered test reading the bytes
 * could see it. A guard split in two - one half asserting the case, the other asserting that a
 * request went out - would assert both halves and never the join between them.
 *
 * <p><b>NO NUMBER HERE CAN STAND FOR ANOTHER, which is the rule of 06.09.2026 applied to a body
 * rather than to a screen.</b> For every value the assertions read, the question asked was „where
 * else could this same number have come from if the code were wrong":
 *
 * <ul>
 * <li><b>`received` against `expected`.</b> Every case that asserts what goes on the wire types an
 * amount UNLIKE the expected one, so sending the expected amount instead - which is the mistake
 * that books a man as having paid in full whatever he really sent - changes the number. His case 1
 * cannot measure this at all: the two are equal by definition there, so the value has two sources
 * and the assertion would hold either way.
 * <li><b>`useTheBalance` against „does the balance cover it".</b> Measured with the box TICKED over
 * a balance that does NOT cover, so the two disagree and reading the wrong one shows.
 * <li><b>`method` against a constant.</b> Both currencies are measured, and they answer differently.
 * <li><b>`competitorId` against every other number on the row.</b> 58 and 23 are neither of them
 * an amount, a balance or a shortfall anywhere in this file.
 * </ul>
 */
describe('what one press on a row sends', () => {
  /**
   * PETAR, in euro, with a balance that is real and SHORT of what is expected.
   *
   * <p>Short on purpose: it is what makes „the box is ticked" and „the balance covers it" two
   * different answers, so `useTheBalance` cannot be satisfied by the wrong one of the two. His
   * fee is 40 and the processing charge 3, so what he sends is 43: the two numbers differ, and
   * the cases that read the wrong one of them are told apart by it.
   */
  const HIM = { competitorId: 58, currency: 'EUR', expected: 43, price: 40, balance: 12.75 }

  /** And one in the other money, so the way to pay is measured rather than assumed. There is no
   *  processing charge in dinars, so for her the price and the expected amount are one number. */
  const HER = { competitorId: 23, currency: 'RSD', expected: 4800, price: 4800, balance: 6000 }

  const TICKED = true

  const CLEARED = false

  const amount = (value: number): Typed => ({ got: 'amount', value })

  /** What the route calls a first payment with no slip number to write on it. */
  const NO_REFERENCE = null

  describe('his cases 1, 2 and 7, which his table says just go through', () => {
    /**
     * CASE 1: the amount is the expected one, so nothing is asked and the payment is booked.
     *
     * <p><b>This case deliberately does NOT assert the join</b>, because it cannot: `received` and
     * `expected` are the same number here, so both a right and a wrong reading give 43. What it
     * is for is the door and the shape - `POST /api/payments` with five fields and no question.
     */
    it('books the payment with no question at all', () => {
      expect(sending(HIM, amount(43), TICKED)).toEqual({
        press: 'sends',
        sending: {
          to: PAYMENTS,
          body: {
            competitorId: 58,
            received: 43,
            useTheBalance: true,
            method: 'paypal',
            reference: NO_REFERENCE,
          },
        },
      })
    })

    /**
     * <p><b>AND THE BODY CARRIES EXACTLY THE FIELDS `PaymentApi.Confirm` DECLARES, counted.</b> A
     * field dropped is a request the route answers `theFormIsNotComplete` to; a field added is a
     * name nothing reads, and both are invisible to an assertion that only looks for the ones it
     * expects to find.
     */
    it('names every field the route takes and none besides', () => {
      const press = sending(HIM, amount(43), TICKED)

      if (press.press !== 'sends' || press.sending.to !== PAYMENTS) {
        throw new Error(`the expected amount does not book a payment: ${press.press}`)
      }

      expect(Object.keys(press.sending.body).sort()).toEqual([
        'competitorId',
        'method',
        'received',
        'reference',
        'useTheBalance',
      ])
    })

    /**
     * CASE 7, and <b>the first case that measures the join</b>: 50 is neither the expected amount
     * nor the balance nor any shortfall, so the number on the wire can only have come from the
     * field.
     */
    it('sends what really arrived when more than expected did, not what was expected', () => {
      expect(sending(HIM, amount(50), TICKED)).toEqual({
        press: 'sends',
        sending: {
          to: PAYMENTS,
          body: {
            competitorId: 58,
            received: 50,
            useTheBalance: true,
            method: 'paypal',
            reference: NO_REFERENCE,
          },
        },
      })
    })

    /**
     * CASE 2: less arrived and the balance covers the difference, so it goes through as well.
     *
     * <p><b>Measured on HER row and in dinars</b>, so the same case also says the way to pay is
     * read off the money: 3600 against an expected 4800 with 6000 on the book, which covers it.
     */
    it('spends the balance and books, in dinars and by the dinar way of paying', () => {
      expect(sending(HER, amount(3600), TICKED)).toEqual({
        press: 'sends',
        sending: {
          to: PAYMENTS,
          body: {
            competitorId: 23,
            received: 3600,
            useTheBalance: true,
            method: 'ips',
            reference: NO_REFERENCE,
          },
        },
      })
    })

    /**
     * <p><b>THE TICK BOX IS WHAT `useTheBalance` CARRIES AND NOTHING ELSE IS, measured where the
     * box and the balance disagree.</b> Petar's book is short of his fee, so „is it ticked" is
     * true while „does it cover" is false; a body built from the second would send `false` here
     * and would send `true` on the case above, which is why both are in the file.
     */
    it('carries the box as it stands, over a balance that does not cover the fee', () => {
      expect(sending(HIM, amount(50), TICKED)).toMatchObject({
        sending: { body: { useTheBalance: true } },
      })

      expect(sending(HIM, amount(50), CLEARED)).toMatchObject({
        sending: { body: { useTheBalance: false } },
      })
    })
  })

  describe('his cases 3 and 3b, which ask before anything is sent', () => {
    /**
     * CASE 3: the box is ticked, the balance is spent to the last, and the sum is still short.
     *
     * <p><b>„Da" sends exactly what case 2 would have sent</b>, which is the route's own doing
     * rather than a shortcut here: it records what arrived and takes what the box allows either
     * way, and the only difference between the two cases is whether the two together reach the
     * price. So the shortfall is carried for the question to NAME and never for the wire.
     */
    it('names what is missing and carries the same body case 2 sends', () => {
      expect(sending(HIM, amount(20), TICKED)).toEqual({
        press: 'asksAboutTheShortfall',
        short: 10.25,
        sending: {
          to: PAYMENTS,
          body: {
            competitorId: 58,
            received: 20,
            useTheBalance: true,
            method: 'paypal',
            reference: NO_REFERENCE,
          },
        },
      })
    })

    /**
     * CASE 3b: the same question with the box cleared, and <b>measured against a balance that
     * WOULD have covered the difference</b>. 35 with 12.75 on the book reaches 47.75, past the
     * 43 expected - so a body that ignored the cleared box would make this his case 2 and no
     * question would be put at all.
     */
    it('asks about the whole shortfall when the box is cleared over a balance that would cover it', () => {
      expect(sending(HIM, amount(35), CLEARED)).toEqual({
        press: 'asksAboutTheShortfall',
        short: 8,
        sending: {
          to: PAYMENTS,
          body: {
            competitorId: 58,
            received: 35,
            useTheBalance: false,
            method: 'paypal',
            reference: NO_REFERENCE,
          },
        },
      })
    })
  })

  describe('his cases 4, 5 and 6, where nothing was typed', () => {
    /**
     * CASES 4 AND 5: two grounds and one question, and <b>the two bodies are asserted as two</b>.
     * A press handing back one of them under both labels is the mistake this shape exists to make
     * impossible, and an assertion reading only one of the two would not see it.
     */
    it.each([
      ['covers the price, his case 4', 71.25, true],
      ['stands between the price and what he sends, his case 4 as well', 41.5, true],
      ['does not reach the price, his case 5', 12.75, false],
    ])('offers the balance or the exemption when the balance %s', (_what, balance, covers) => {
      expect(sending({ ...HIM, balance }, { got: 'nothing' }, TICKED)).toEqual({
        press: 'asksAboutTheGround',
        covers,
        onTheBalance: { to: MEMBERSHIPS, body: { competitorId: 58, ground: ON_THE_BALANCE } },
        freeOfTheFee: { to: MEMBERSHIPS, body: { competitorId: 58, ground: FREE_OF_THE_FEE } },
      })
    })

    /** And the two grounds really are two, so neither line above is satisfied by one answer. */
    it('sends two different grounds under the two labels', () => {
      expect(ON_THE_BALANCE).not.toBe(FREE_OF_THE_FEE)
    })

    /**
     * CASE 6, and with it the state his grid does not name.
     *
     * <p><b>Both are measured</b>: the box cleared over a balance that would cover, which is his
     * own case, and the box ticked over an empty book, which is the commonest row on the screen.
     */
    it.each([
      ['the box is cleared over a balance that would cover it', 71.25, CLEARED],
      ['the box is ticked over an empty book', 0, TICKED],
    ])('asks only about the exemption when %s', (_what, balance, box) => {
      expect(sending({ ...HIM, balance }, { got: 'nothing' }, box)).toEqual({
        press: 'asksAboutTheExemption',
        freeOfTheFee: { to: MEMBERSHIPS, body: { competitorId: 58, ground: FREE_OF_THE_FEE } },
      })
    })

    /** <p>And no amount goes with a ground: the server works out what comes off the book. */
    it('sends no amount with a ground, whichever of the two it is', () => {
      const press = sending(HIM, { got: 'nothing' }, TICKED)

      if (press.press !== 'asksAboutTheGround') {
        throw new Error(`nothing typed over a balance does not offer a ground: ${press.press}`)
      }

      expect(Object.keys(press.onTheBalance.body).sort()).toEqual(['competitorId', 'ground'])
      expect(Object.keys(press.freeOfTheFee.body).sort()).toEqual(['competitorId', 'ground'])
    })
  })

  describe('what sends nothing at all', () => {
    /**
     * <p><b>Measured for every state of the other two axes</b>, the same way the case above about
     * `whatToDo` is: a field that cannot be read decides the whole row and must not be overtaken
     * by anything else on it.
     */
    it.each([
      ['ticked, balance covers', 71.25, TICKED],
      ['ticked, balance short', 12.75, TICKED],
      ['ticked, no balance', 0, TICKED],
      ['cleared, balance covers', 71.25, CLEARED],
    ])('a field that cannot be read (%s)', (_what, balance, box) => {
      expect(sending({ ...HIM, balance }, { got: 'refused' }, box)).toEqual({ press: 'nothing' })
    })

    /**
     * <p><b>AND MONEY THE PORTAL CANNOT NAME A WAY TO PAY FOR, which is the boundary written on
     * `Press` rather than guarded.</b> `Currency` holds two and `data/paymentQr.test.ts` reads
     * that enum, so a third cannot arrive without somebody deciding how it is paid - but until
     * they do, this is what the row does, and it is better than booking into the euro account on
     * the strength of not recognising the money.
     *
     * <p><b>The amount is a perfectly good one</b>, so what is being measured is the currency and
     * nothing else: the same press in either real money books a payment.
     */
    it('an amount in money that names no way to pay', () => {
      expect(sending({ ...HIM, currency: 'CHF' }, amount(43), TICKED)).toEqual({
        press: 'nothing',
      })
    })

    /** <p>And the tick box does not rescue it either, since no body could be built to spend on. */
    it('the same money with the box cleared', () => {
      expect(sending({ ...HIM, currency: 'CHF' }, amount(20), CLEARED)).toEqual({
        press: 'nothing',
      })
    })

    /**
     * <p><b>BUT MONEY IT DOES NOT KNOW STILL ASKS ABOUT A GROUND, and that is not an oversight.</b>
     * `POST /api/memberships` takes a competitor and a ground and no money at all, so nothing about
     * a currency it cannot name can stop it. A guard written over the whole row rather than over
     * the door would take his case 6 away from a member for a reason that has nothing to do with
     * it.
     */
    it('but a row in that money can still be granted a ground, which needs no money named', () => {
      expect(sending({ ...HIM, currency: 'CHF', balance: 0 }, { got: 'nothing' }, TICKED)).toEqual({
        press: 'asksAboutTheExemption',
        freeOfTheFee: { to: MEMBERSHIPS, body: { competitorId: 58, ground: FREE_OF_THE_FEE } },
      })
    })
  })

  /**
   * THE TWO ADDRESSES, WRITTEN OUT ONCE HERE SO EVERY CASE ABOVE CAN NAME THEM BY CONSTANT.
   *
   * <p>Without this, a constant misspelt in `activation.ts` would be misspelt in every assertion
   * that reads it and the whole file would agree with itself about an address the server does not
   * serve.
   */
  it('knocks on the two addresses the server really answers', () => {
    expect(PAYMENTS).toBe('/api/payments')
    expect(MEMBERSHIPS).toBe('/api/memberships')
  })
})
