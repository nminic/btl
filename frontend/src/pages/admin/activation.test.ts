import { typedIn, whatToDo, type Typed } from './activation'

/**
 * THE OWNER'S SEVEN CASES, MEASURED WITHOUT MOUNTING ANYTHING.
 *
 * <p><b>NO CONSTANT HERE STANDS FOR TWO THINGS, AND THE AXES ARE COUNTED RATHER THAN FELT.</b>
 * The rule this follows is the one written on 06.09.2026: a case whose value could arrive from
 * two places measures nothing, so each number below differs from every other number that could
 * be mistaken for it.
 *
 * <ul>
 * <li><b>`EXPECTED` and `BALANCE` are never equal and neither is a multiple of the other</b>, so
 * „the expected amount" can never stand in for „the balance" and a decision reading the wrong
 * one of the two answers differently.
 * <li><b>Nothing is a round number where round would do</b>: 43.50 and 4800 rather than 40 and
 * 400, so an arithmetic that survives only on whole units cannot pass.
 * <li><b>The pair 43.29 / 0.01 is in the file on purpose</b> and is the only pair there whose
 * answer depends on how the sum is compared. It is the case that fails the moment the
 * comparison stops rounding to whole paras.
 * <li><b>Every state of the tick box is measured against BOTH a balance that covers and one
 * that does not</b>, because the box and the size of the balance are two axes and a case using
 * one for the other would pass on half the grid.
 * </ul>
 */
describe('which of the seven cases a row is in', () => {
  /** With the processing charge in it, which is what the owner decided „Ocekivan iznos" means. */
  const EXPECTED = 43.5

  /** Enough to cover the whole of it, and not a round number. */
  const COVERS = 71.25

  /** Something, but not enough. Distinct from every other number in the file. */
  const SHORT = 12.75

  const TICKED = true

  const CLEARED = false

  /** So a case never has to build one of these by hand and never accidentally builds a nought. */
  const amount = (value: number): Typed => ({ got: 'amount', value })

  describe('reading what is in the field', () => {
    /**
     * THE OWNER'S DECISION OF 27.09.2026, POINT 5 OF SECTION 19, AND THE ONE THING IT TURNS ON.
     *
     * <p>„Prazno polje i ukucana nula vode na ISTI prompt, onaj o oslobodjenju od clanarine."
     * Five spellings, one state. <b>The mutation this exists for is reading the SPELLING</b>: a
     * guard written as `said === '0'` passes the first of these and fails the other two, and
     * `'0,00'` is the one a moderator copying the amount off this very screen would type,
     * because the portal writes Serbian.
     */
    it.each([
      ['empty', ''],
      ['a space', ' '],
      ['nought', '0'],
      ['nought written out', '0.00'],
      ['nought written the Serbian way', '0,00'],
    ])('treats %s as nothing typed', (_what, said) => {
      expect(typedIn(said)).toEqual({ got: 'nothing' })
    })

    it('reads an amount, either separator', () => {
      expect(typedIn('43.50')).toEqual({ got: 'amount', value: 43.5 })
      expect(typedIn('43,50')).toEqual({ got: 'amount', value: 43.5 })
      expect(typedIn(' 4800 ')).toEqual({ got: 'amount', value: 4800 })
    })

    /**
     * <p><b>`4.800` IS THE CASE THIS TEST IS REALLY FOR.</b> `Number('4.800')` is `4.8` -
     * finite, positive, and four thousand seven hundred and ninety five too small - so a guard
     * that only asks `Number.isFinite` accepts it and books the wrong money in silence. The
     * portal writes „4.800" itself (`i18n/format.ts` writes Serbian), so this is what somebody
     * reading the expected amount off the screen and typing it back produces.
     *
     * <p>Negative and unreadable are here for a different reason:
     * `payment_amount_positive` (V16:105) refuses nought and below, so neither has a row it
     * could ever become.
     */
    it.each([
      ['a grouped thousand, which would read four point eight', '4.800'],
      ['three decimals', '43.500'],
      ['a negative amount', '-5'],
      ['a negative nought', '-0'],
      ['words', 'nesto'],
      ['an amount with a word after it', '43.50 RSD'],
      ['two separators', '4.800,50'],
      ['a separator and nothing after it', '43.'],
      ['an exponent', '4e3'],
      ['a plus sign', '+43.50'],
    ])('refuses %s', (_what, said) => {
      expect(typedIn(said)).toEqual({ got: 'refused' })
    })
  })

  describe('with nothing typed', () => {
    /**
     * CASE 4: the balance reaches the expected amount, so the two buttons are „Odobri
     * oslobodjenje od clanarine" and „Odobri iz balansa".
     */
    it('offers the balance or the exemption, and says the balance covers it', () => {
      expect(whatToDo({ got: 'nothing' }, EXPECTED, COVERS, TICKED)).toEqual({
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
      expect(whatToDo({ got: 'nothing' }, EXPECTED, SHORT, TICKED)).toEqual({
        does: 'offersTheBalanceOrTheExemption',
        covers: false,
      })
    })

    /**
     * <p><b>THE BOUNDARY BETWEEN 4 AND 5 IS MEASURED FROM BOTH SIDES AND ONE PARA APART.</b>
     * Equal counts as covering - he owes exactly what he has - and one para less does not. A
     * comparison written `>` rather than `>=` passes every other case in this file and fails
     * only this pair.
     */
    it('counts a balance equal to the expected amount as covering it', () => {
      expect(whatToDo({ got: 'nothing' }, EXPECTED, EXPECTED, TICKED)).toEqual({
        does: 'offersTheBalanceOrTheExemption',
        covers: true,
      })

      expect(whatToDo({ got: 'nothing' }, EXPECTED, 43.49, TICKED)).toEqual({
        does: 'offersTheBalanceOrTheExemption',
        covers: false,
      })
    })

    /** CASE 6: the box is cleared, so the balance is not a way to pay and only the exemption is
     *  left. <b>Measured with a balance that WOULD cover</b>, so clearing the box is what
     *  decides rather than there being nothing to spend. */
    it('asks only about the exemption when the box is cleared, however big the balance', () => {
      expect(whatToDo({ got: 'nothing' }, EXPECTED, COVERS, CLEARED)).toEqual({
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
      expect(whatToDo({ got: 'nothing' }, EXPECTED, 0, TICKED)).toEqual({
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
      expect(whatToDo(amount(EXPECTED), EXPECTED, COVERS, box)).toEqual({
        does: 'booksThePayment',
      })
    })

    /** CASE 7, „svejedno" again and so measured both ways. */
    it.each([
      ['ticked', TICKED],
      ['cleared', CLEARED],
    ])('credits the surplus when more than expected arrived, box %s', (_what, box) => {
      expect(whatToDo(amount(50), EXPECTED, COVERS, box)).toEqual({
        does: 'creditsTheSurplus',
      })
    })

    /** <p>One para either way of the expected amount, so „equal" and „more" are told apart at
     *  the boundary rather than only in the middle. */
    it('tells equal from more one para apart', () => {
      expect(whatToDo(amount(43.51), EXPECTED, 0, CLEARED)).toEqual({
        does: 'creditsTheSurplus',
      })

      expect(whatToDo(amount(43.49), EXPECTED, 0, CLEARED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 0.01,
      })
    })

    /** CASE 2: less arrived, the box is ticked, and the balance covers the difference. */
    it('spends the balance and books when the balance covers the difference', () => {
      expect(whatToDo(amount(35), EXPECTED, SHORT, TICKED)).toEqual({
        does: 'spendsTheBalanceAndBooks',
      })
    })

    /**
     * CASE 3, in the owner's own words: „ukljucen balans koji kad se iskoristi POTPUNO i dalje
     * nije ukupan zbir jednak ocekivanog... zelim prompt". <b>So the balance is spent to the
     * last and the question is about what is left</b>, which is why the shortfall is carried
     * and is 43.50 - 20 - 12.75.
     */
    it('asks about the shortfall left after the whole balance is spent', () => {
      expect(whatToDo(amount(20), EXPECTED, SHORT, TICKED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 10.75,
      })
    })

    /**
     * CASE 3b: the same question with the box cleared, and <b>measured against a balance that
     * WOULD have covered the difference</b>. That is the whole of what clearing the box means
     * (PDL 23a): a case using an empty book here would pass whether the box were read or not.
     */
    it('asks about the whole shortfall when the box is cleared, ignoring a balance that would cover it', () => {
      expect(whatToDo(amount(35), EXPECTED, COVERS, CLEARED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 8.5,
      })
    })

    /** <p>And the boundary of case 2 against case 3, one para apart on the SUM rather than on
     *  either number, so an arithmetic that reads only one of the two cannot pass. */
    it('tells covered from short one para apart on the sum', () => {
      expect(whatToDo(amount(30.75), EXPECTED, 12.75, TICKED)).toEqual({
        does: 'spendsTheBalanceAndBooks',
      })

      expect(whatToDo(amount(30.74), EXPECTED, 12.75, TICKED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 0.01,
      })
    })

    /**
     * <p><b>THE ONE CASE IN THIS FILE WHOSE ANSWER DEPENDS ON HOW THE SUM IS COMPARED.</b>
     * `43.29 + 0.01` is `43.299999999999996` in binary, which is less than `43.30`, so a
     * comparison of the sums as they arrive reports this as short by nothing at all and asks the
     * moderator to accept a reduced total that is not reduced. Rounded to whole paras there is
     * no such state. Every other case in this file passes either way; this one does not.
     */
    it('counts a balance that covers the difference to the last para', () => {
      expect(whatToDo(amount(43.29), 43.3, 0.01, TICKED)).toEqual({
        does: 'spendsTheBalanceAndBooks',
      })
    })

    /** <p>And the same hazard in the other direction: a shortfall that must come out as a clean
     *  number rather than as a tail of nines. */
    it('says the shortfall in whole paras', () => {
      expect(whatToDo(amount(0.07), 0.3, 0.1, TICKED)).toEqual({
        does: 'asksAboutTheShortfall',
        short: 0.13,
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
    expect(whatToDo({ got: 'refused' }, EXPECTED, balance, box)).toEqual({
      does: 'theFieldRefuses',
    })
  })
})
