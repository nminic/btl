/**
 * WHICH OF THE OWNER'S SEVEN CASES ONE ROW OF THE PAYMENTS SCREEN IS IN.
 *
 * Its own module rather than a function beside the screen, which is the arrangement
 * `admin/priceWrites.ts`, `admin/memberWrites.ts` and `admin/paymentSearch.ts` already have
 * and the reason they give: `react/only-export-components` asks for it, and a test that has
 * to mount React to ask which prompt a number leads to is a test measuring a render rather
 * than a decision.
 *
 * **The seven cases are the owner's own, dictated 27.09.2026 as the definitive specification
 * of this screen** (PDL section 19, „Sad cu ti detaljno otkucati definitivnu specifikaciju
 * kako ce ovo funkcionisati i zatvoricu sve slucajeve i logicke grupe"). They are named here
 * after what they DO rather than numbered, because a number in a branch tells the next reader
 * nothing, but the seven are listed against their numbers on {@link WhatToDo} so the grid can
 * be read back against his table.
 *
 * **WHAT THIS MODULE DELIBERATELY DOES NOT KNOW: whether a case can be carried out.** It
 * answers which case the row is in and stops there. Four of the seven have no route on the
 * server today and that is the screen's business to know, not this module's - see the note on
 * `admin/Payments.tsx`, which names what is missing and where it stands. Deciding both here
 * would mean a change of the server's shape editing a module about the owner's grid.
 */

/**
 * WHAT THE MODERATOR TYPED, READ BY VALUE AND NOT BY SPELLING.
 *
 * Three outcomes and not two, and the middle one is the whole reason this is a type rather
 * than `number | null`: a field that cannot be read is not the same as a field left alone,
 * and the owner's grid sends those two to opposite places.
 */
export type Typed =
  /**
   * Nothing was typed, or what was typed IS NOUGHT.
   *
   * **The two are one answer and that is the owner's decision rather than an economy here**
   * (PDL section 19, point 5, [ZATVORENO 27.09.2026, vlasnik]): „Prazno polje i ukucana nula
   * vode na **isti** prompt, onaj o oslobodjenju od clanarine." So `''`, `' '`, `'0'`,
   * `'0.00'` and `'0,00'` are one state, which is the axis a guard reading the SPELLING would
   * split into five.
   *
   * **Why nought is not „less than expected", which is where arithmetic alone would put it.**
   * `V16:105` holds `constraint payment_amount_positive check (amount > 0)`, so a payment row
   * of nought cannot exist; the path through the shortfall prompt would end in a refusal by
   * the database. The owner was offered writing it as a payment of nought and refused it,
   * because it would need a migration loosening that constraint and would leave a payment
   * that never happened standing in the books.
   */
  | { got: 'nothing' }
  /**
   * What is in the field is not an amount at all, so nothing is decided from it.
   *
   * **Refused at the field and never carried into a prompt**, for the same reason nought is
   * not a shortfall: `payment_amount_positive` (V16:105) refuses nought and anything below
   * it, so a negative number has no row it could ever become. Letting it reach a prompt would
   * offer the moderator a decision the database will not accept.
   *
   * **`4.800` IS REFUSED, AND THAT IS THE POINT OF COUNTING THE DECIMALS.** This is my own
   * reasoning rather than a decision of the owner's, and it earns its place by what the
   * alternative does: the portal WRITES amounts in Serbian („4.800", `i18n/format.ts`), so a
   * moderator reading the expected amount off this very screen and typing it back will type a
   * grouping dot. `Number('4.800')` is `4.8` - finite, positive, and quietly four thousand
   * seven hundred and ninety five too small. Refusing a third decimal digit turns that silent
   * misreading into a sentence asking him to type it again, which is the one outcome of the
   * three that cannot book the wrong money.
   */
  | { got: 'refused' }
  /** A positive amount. Never nought: that is {@link Typed} `'nothing'` by the decision above. */
  | { got: 'amount'; value: number }

/**
 * WHAT THE ROW LEADS TO, one name per row of the owner's table.
 *
 * `theFieldRefuses` is the eighth and is not his: it is what a field that cannot be read
 * leads to, which his grid does not cover because it is about amounts rather than about
 * typing.
 */
export type WhatToDo =
  /** Nothing, and the field says why. */
  | { does: 'theFieldRefuses' }
  /** Case 1: the amount is the expected one. He is booked and comes off the list. */
  | { does: 'booksThePayment' }
  /** Case 7: more than expected arrived, and the surplus becomes credit on his balance. */
  | { does: 'creditsTheSurplus' }
  /** Case 2: less arrived, the box is ticked, and the balance covers the difference. */
  | { does: 'spendsTheBalanceAndBooks' }
  /**
   * Cases 3 and 3b: less arrived and the whole of it together is still short.
   *
   * **One outcome for both, which is what the owner's own table says** by giving 3 and 3b the
   * same cell („isti prompt"). 3 is the box ticked and the balance spent to the last, 3b is
   * the box cleared; the question put to the moderator is the same either way, „Prihvatam
   * umanjen ukupan iznos? Da / Ne".
   *
   * **And it is the case a change of price arrives as**, in the owner's words: „i slucaj da se
   * u medjuvremenu zbog datuma promenila cena ocekivane registracije, a takmicar je uplatio
   * jos juce po starim uslovima ali nisam dobio obavestenje o tome na vreme". Nothing special
   * is read for it: `expected` is worked out for TODAY, yesterday's price is less than it, so
   * it arrives here by arithmetic rather than by a branch of its own.
   *
   * @param short how much is still missing after everything that is being counted. Carried
   *              because the question is about that number and the moderator should see it.
   */
  | { does: 'asksAboutTheShortfall'; short: number }
  /**
   * Cases 4 and 5: nothing was typed, the box is ticked, and there IS something on the book.
   *
   * Two labels and one question, which is how the owner wrote it and how the server takes it:
   * `POST /api/memberships` calls both of them the ground `balance` and says so
   * (`MembershipWriteApi`, „which are one ground and two labels").
   *
   * @param covers whether the balance reaches the expected amount, which is case 4 („Odobri iz
   *               balansa") as against case 5 („Odobri umanjen iznos iz balansa"). It changes
   *               the words on one button and nothing else: the ground sent is the same, and
   *               the server works the amount out for itself
   */
  | { does: 'offersTheBalanceOrTheExemption'; covers: boolean }
  /**
   * Case 6, and the state the owner's grid does not name.
   *
   * **His case 6 is „nije unet" with the box CLEARED.** The state reached with the box TICKED
   * and nothing at all on the book arrives here too, and that is derived rather than invented:
   * the box being ticked offers the balance as a way to pay, and a balance of nought is not
   * one. Both therefore leave exactly one ground a moderator could act on, so both ask his
   * question, „Odobri oslobodjenje od clanarine? Da / Ne".
   *
   * **Which is also the one place the screen and the server can disagree, and it is written
   * down rather than guarded.** The screen sees ONE amount - `GET /api/payments` picks the
   * column his country decides (`PaymentsDueApi`) - while the server decides by the PAIR:
   * `Balance.isMoneyInBothCurrencies` requires both halves strictly positive, because
   * `balance_entry_a_membership_takes` (V38) reads `eur < 0 and rsd < 0`. So a member whose
   * book is `0.00 EUR / 600.00 RSD` is served `balance: 600`, is offered the balance by the
   * case above, and is refused `nothingWouldComeOffTheBalance`. The screen cannot see that
   * from what it is served, so it says what the server answered instead of predicting it. PDL
   * section 25 („balans je uvek u valuti zavisno od drzave... nije ni bitno koliko je to u
   * drugoj valuti") closes it, and is not carried out yet: V38 still holds the two columns.
   */
  | { does: 'asksAboutTheExemption' }

/** The two words `membership.basis` spells, which is what `POST /api/memberships` takes. */
export const FREE_OF_THE_FEE = 'feeExempt'

export const ON_THE_BALANCE = 'balance'

/**
 * WHETHER THE PORTAL CAN CARRY THIS CASE OUT AT ALL TODAY.
 *
 * <p><b>FOUR OF THE SEVEN IT CANNOT, and this is the one place that says so</b> rather than the
 * screen deciding it again beside each control. Measured against `origin/main` on 28.09.2026,
 * and what is missing is TWO things rather than one:
 *
 * <ol>
 * <li><b>There is no amount on the wire.</b> `POST /api/payments` takes
 * `record Confirm(Long competitorId, String currency, String method, String reference)` -
 * `PaymentApi.java:296` - and writes `payment.amount` from the PRICE LIST instead
 * (`PaymentApi.java:456-457,478`, `price.amount()` and `price.fee()`). So „he sent less than
 * expected" and „he sent more" cannot be told to the server at all: both would be recorded as
 * having sent exactly the price.
 * <li><b>And the balance is spent by what the QR code promised, not by the tick box.</b>
 * `PaymentApi.java:496-505` reads `book.promised(competitor.id(), season)` and takes nothing
 * where there is no promise. The owner decided the opposite for THIS screen on 27.09.2026
 * (PDL 23a): „Na moderatorovom ekranu odlucuje kucica i iznos u njenoj labeli, ne ono sto je QR
 * kod obecao." Until that is written, clearing the box would change nothing and the commonest
 * member of all - the one nobody ever minted a code for - would be shown a balance in the label
 * and have none of it taken.
 * </ol>
 *
 * <p><b>A THIRD thing stood here until 28.09.2026 and is now SETTLED, so it is written down as
 * settled rather than left saying what is no longer true.</b> `POST /api/payments` requires
 * `method`, and the schema used to know only `('slip', 'card', 'paypal', 'sepa')` - not `ips`,
 * which is the only way somebody in Serbia pays, so the owner's deadline in PDL 20a („Rok:
 * postaje zivo onog dana kad prvi ekran pozove upisnu rutu... posle toga je svaki upis
 * netacan") would have been passed by the first call this screen ever made. PR 407 landed it:
 * `PaymentApi.METHODS` is now `Set.of("ips", "paypal")` and the migration replaces the
 * constraint with the same two. <b>The two above are unaffected and still block all four
 * cases on their own</b>, which is why nothing here changes: the amount is the blocker, and it
 * always was the larger half.
 *
 * <p><b>Why the button is therefore disabled rather than the prompt being drawn and refused.</b>
 * Three of the owner's cases end in a question, and two of those three can be acted on. The
 * third - „Prihvatam umanjen ukupan iznos? Da / Ne" - is reached only with an amount typed, so
 * its „Da" would have nowhere to go. A question asked with no way of honouring the answer is
 * worse than a control that is plainly not available: the moderator would believe the row had
 * been dealt with.
 */
export function theServerCanDoIt(what: WhatToDo): what is Actionable {
  return what.does === 'offersTheBalanceOrTheExemption' || what.does === 'asksAboutTheExemption'
}

/**
 * THE THREE CASES OF THE SEVEN THAT REACH A ROUTE, as a type.
 *
 * <p><b>A type and not a comment, so the screen cannot draw a question it has no way of
 * honouring.</b> {@link theServerCanDoIt} narrows to this, so the prompt for the shortfall -
 * „Prihvatam umanjen ukupan iznos? Da / Ne", which needs an amount on the wire - cannot be
 * built by mistake: the compiler refuses to hand it in. The day the amount arrives, widening
 * this type is what makes the screen fail to compile until the question is drawn, which is the
 * opposite of a boundary that has to be remembered.
 *
 * <p>Three of the owner's cases and two grounds: 4 and 5 are
 * {@code offersTheBalanceOrTheExemption} (one ground, two labels) and 6 is
 * {@code asksAboutTheExemption}, which also takes the state his grid does not name - the box
 * ticked over an empty book.
 */
export type Actionable = Extract<
  WhatToDo,
  { does: 'offersTheBalanceOrTheExemption' } | { does: 'asksAboutTheExemption' }
>

/**
 * THE SEVEN REFUSALS `POST /api/memberships` NAMES, and the sentence this screen turns each of
 * them into.
 *
 * <p><b>All seven are answered although this screen can only reach some of them, which is the
 * shape `admin/priceWrites.ts` and `admin/memberWrites.ts` both keep and give the reason for:
 * the screen is the floor and the route decides.</b> An unmapped reason falls through to
 * `ServerSaid`'s honest branch and is printed with its camel-case code in it, so a moderator
 * reading a refusal would be shown a word out of the Java source.
 *
 * <p><b>`nothingWouldComeOffTheBalance` is the one this screen CANNOT predict, and it is the
 * whole reason a map is needed rather than a guard.</b> The screen is served ONE balance, the
 * column the member's country names (`PaymentsDueApi`), and the server decides by the PAIR:
 * `Balance.isMoneyInBothCurrencies` wants both halves strictly positive because
 * `balance_entry_a_membership_takes` (V38) reads `eur < 0 and rsd < 0`. So a man whose book is
 * `0.00 EUR / 600.00 RSD` is shown „600 RSD" in the tick box, is offered his balance, and is
 * refused. Nothing the screen is served would let it know that in advance, so it says what the
 * server said. PDL section 25 („balans je uvek u valuti zavisno od drzave... nije ni bitno
 * koliko je to u drugoj valuti") closes the gap and is not carried out: V38 still holds the two
 * columns side by side.
 */
export const WHEN_ACTIVATING: Record<string, string> = {
  theFormIsNotComplete: 'verification.activationRefused.theFormIsNotComplete',
  theGroundIsNotKnown: 'verification.activationRefused.theGroundIsNotKnown',
  nothingWouldComeOffTheBalance: 'verification.activationRefused.nothingWouldComeOffTheBalance',
  theMembershipIsAlreadyHeld: 'verification.activationRefused.theMembershipIsAlreadyHeld',
  theCompetitorDoesNotExist: 'verification.activationRefused.theCompetitorDoesNotExist',
  theFeeIsAlreadyRecorded: 'verification.activationRefused.theFeeIsAlreadyRecorded',
  thePaymentWasReversed: 'verification.activationRefused.thePaymentWasReversed',
}

/**
 * Digits, and at most one separator with at most two digits after it.
 *
 * Both separators, because the portal writes the Serbian one and an administrator may type
 * either. No sign, no spaces inside, no grouping: see {@link Typed} `'refused'` for what
 * counting the decimals is really for.
 */
const AN_AMOUNT = /^\d+(?:[.,]\d{1,2})?$/

/**
 * WHAT IS IN THE FIELD, READ ONCE AND BY VALUE.
 *
 * **The shape is `admin/priceWrites.ts#amountsFrom`'s and is taken from it deliberately**: it
 * trims, treats the empty string as absent, and reads with `Number` rather than believing the
 * text. What is added here is the two things that module has no need of, because it sends what
 * it read to a server that judges it while this one has to decide for itself: nought folded
 * into absent, and anything unreadable refused rather than passed on as absent.
 */
export function typedIn(field: string): Typed {
  const said = field.trim()

  if (said === '') {
    return { got: 'nothing' }
  }

  if (!AN_AMOUNT.test(said)) {
    return { got: 'refused' }
  }

  const value = Number(said.replace(',', '.'))

  /* READ BY VALUE AND NOT BY SPELLING, which is the owner's decision of 27.09.2026 and the one
     line that makes „0", „0.00" and „0,00" one state. A comparison against the text would
     answer differently for each of the three, and the middle one is what somebody copying an
     amount off this screen types. */
  return value === 0 ? { got: 'nothing' } : { got: 'amount', value }
}

/**
 * MONEY COMPARED IN THE SMALLEST UNIT IT HAS, never as it arrives.
 *
 * **Measured rather than tidied up, and re-measured on review of PR 411 because the first pair
 * chosen here did not measure what it claimed to.** `43.29 + 0.01` is `43.299999999999997`,
 * which is the SAME double as `43.30` - so `43.29 + 0.01 >= 43.30` is `true` whether the sums
 * are rounded to whole paras first or simply added as they arrive. The comment that used to
 * stand here said the opposite, and `activation.test.ts` held that same pair as the one case
 * "whose answer depends on how the sum is compared" - it does not, and the mutation "compare
 * the sums as they come" survived it, 82 green.
 *
 * **The pair that actually depends on it, measured in Node:** `8.20 + 0.10` is
 * `8.299999999999999` and `8.30` is `8.300000000000001` - two DIFFERENT doubles, the first
 * strictly less than the second - so a comparison of the raw sums reports a shortfall of
 * `2.27e-15`, a number with no meaning at whole paras, while `Math.round(820) + Math.round(10)
 * >= Math.round(830)` is `830 >= 830`, true. Rounding to whole paras and comparing integers is
 * what turns that shortfall into "the balance covers it to the last para" - `activation.test.ts`
 * holds this with that pair now, so the mutation „compare the sums as they come" fails rather
 * than passing on every round number.
 */
function inMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}

/**
 * WHICH OF THE SEVEN, given everything the screen knows about one row.
 *
 * @param expected  what the portal expects him to SEND, which is the fee plus the processing
 *                  charge where one applies (owner, 27.09.2026: „„Ocekivan iznos" je ono sto
 *                  clan SALJE, dakle sa uracunatom taksom"). Served, never worked out here
 * @param balance   what his book adds up to today in HIS currency, served on the same row.
 *                  Never negative and never absent: `Balance.Money` refuses a negative amount
 *                  outright and `BalanceBook.forEveryOneOf` answers `NOTHING` for a member with
 *                  no entries at all, so „nought" is the only empty state there is
 * @param including whether the tick box is ticked. **It is what decides, and that is the
 *                  owner's decision of 27.09.2026** (PDL 23a): „Na moderatorovom ekranu
 *                  odlucuje kucica i iznos u njenoj labeli, ne ono sto je QR kod obecao."
 */
export function whatToDo(typed: Typed, expected: number, balance: number, including: boolean): WhatToDo {
  if (typed.got === 'refused') {
    return { does: 'theFieldRefuses' }
  }

  const owed = inMinorUnits(expected)
  /* THE BOX IS READ HERE AND ONCE, so every branch below is about an amount rather than about
     a control. Cleared, the balance is not merely unspent but INVISIBLE to the decision, which
     is what cases 3b and 6 ask for: both of them behave as though the man had no book at all. */
  const his = including ? inMinorUnits(balance) : 0

  if (typed.got === 'nothing') {
    if (his === 0) {
      return { does: 'asksAboutTheExemption' }
    }

    return { does: 'offersTheBalanceOrTheExemption', covers: his >= owed }
  }

  const sent = inMinorUnits(typed.value)

  if (sent === owed) {
    return { does: 'booksThePayment' }
  }

  if (sent > owed) {
    return { does: 'creditsTheSurplus' }
  }

  /* THE BALANCE IS SPENT TO THE LAST AND ONLY THEN IS THE REMAINDER ASKED ABOUT, which is the
     owner's own sentence for case 3: „ukljucen balans koji kad se iskoristi POTPUNO i dalje
     nije ukupan zbir jednak ocekivanog... zelim prompt". So the question is never „does the
     balance cover it" but „what is left when it cannot". */
  if (sent + his >= owed) {
    return { does: 'spendsTheBalanceAndBooks' }
  }

  return { does: 'asksAboutTheShortfall', short: (owed - sent - his) / 100 }
}
