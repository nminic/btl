import { methodFor, type PaymentMethod } from '../../data/paymentQr'

/**
 * WHICH OF THE OWNER'S SEVEN CASES ONE ROW OF THE PAYMENTS SCREEN IS IN, AND WHAT ONE PRESS
 * SENDS.
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
 * **WHAT THIS MODULE KNOWS SINCE 28.09.2026, AND THE SENTENCE THAT USED TO STAND HERE SAYING IT
 * DOES NOT IS REWRITTEN RATHER THAN LEFT.** It said „whether a case can be carried out" was the
 * screen's business, because „four of the seven have no route on the server today". All seven
 * have one now, so that sentence would be an instruction to the next reader to restore a
 * boundary that no longer exists. What this module answers is therefore two questions rather
 * than one: which of his cases the row is in ({@link whatToDo}), and what one press on it SENDS
 * ({@link sending}) - and the second belongs here for the reason the first does, that both are
 * decisions about his grid and neither needs React mounted to be asked.
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
 * ALL SEVEN OF THE OWNER'S CASES REACH A ROUTE SINCE 28.09.2026, AND WHAT STOOD HERE SAYING FOUR
 * OF THEM DO NOT IS DELETED RATHER THAN WIDENED.
 *
 * <p>`theServerCanDoIt` and `Actionable` stood here. Both were true when written and both were
 * overturned by `V42` and the route that came with it; the contradiction arrived by a MERGE -
 * neither parent disagreed with itself - which is the one way a false sentence gets in without
 * any round of review being able to see it (found by the independent review of PR 413, round 2).
 * What they said, against what `PaymentApi.java` declares:
 *
 * <ol>
 * <li>„<b>There is no amount on the wire.</b>" There is:
 * `record Confirm(Long competitorId, BigDecimal received, Boolean useTheBalance, String method,
 * String reference)`. `received` is „what actually arrived, as the moderator read it off the bank
 * statement and typed it into the field beside „Ocekivan iznos"" in the route's own words, while
 * `payment.amount` still carries what the PRICE LIST charged - which is how both facts are
 * recorded without either sentence about the books becoming false.
 * <li>„<b>The balance is spent by what the QR code promised, not by the tick box.</b>" It is spent
 * by the tick box: `useTheBalance` is on that record, is refused as `theFormIsNotComplete` when
 * absent, and `Balance.honouring` - the method that read the promise - was DELETED rather than
 * left uncalled. The route gives the owner's words for it (PDL 23a): „Na moderatorovom ekranu
 * odlucuje kucica i iznos u njenoj labeli, ne ono sto je QR kod obecao."
 * </ol>
 *
 * <p><b>WHY DELETED AND NOT WIDENED, WHICH IS THE PART WORTH KNOWING.</b> `Actionable` promised
 * exactly this event in its own words - „The day the amount arrives, widening this type is what
 * makes the screen fail to compile until the question is drawn". <b>The amount arrived and
 * nothing fell over.</b> A type can only hold a fact the compiler can check, and no line of the
 * frontend reads a Java record, so what it really held was prose. {@link Press} does the work it
 * was for and does it by construction - it CARRIES the request each case sends, so a question
 * with nowhere to go cannot be drawn because there would be no body on it - and
 * `pages/account/refusals.test.ts` is the floor for the half a type could never reach, since it
 * reads `PaymentApi.java` itself. Keeping a widened `Actionable` beside both would be a rule
 * nothing calls, which is what the route above says of `Balance.honouring` and for the same
 * reason.
 */

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
 * THE NINE REFUSALS `POST /api/payments` NAMES, and the sentence this screen turns each into.
 *
 * <p><b>ITS OWN MAP AND NOT AN ADDITION TO {@link WHEN_ACTIVATING}, because they are two routes
 * and `pages/account/refusals.test.ts` counts over the FILE.</b> That floor reads every
 * `static final String` one Java class declares and asks that the screens meeting it answer
 * exactly those, in both directions; a single map covering two classes would pass it while
 * leaving a reader unable to tell which name can arrive from which door. `TeamWriteApi` is the
 * precedent for the opposite arrangement - two acts of one class, two maps - and this is the same
 * question with the classes the other way round.
 *
 * <p><b>Four of the nine point at the sentences {@link WHEN_ACTIVATING} already uses, and that is
 * deliberate rather than lazy.</b> `theFormIsNotComplete`, `theCompetitorDoesNotExist`,
 * `theMembershipIsAlreadyHeld` and `thePaymentWasReversed` mean the same thing whichever door
 * refused them, and the moderator is looking at one row either way. A second Serbian sentence
 * saying the same thing would be a second place to change when the wording changes, and the two
 * would drift.
 *
 * <p><b>THE SCREEN CANNOT REACH FIVE OF THE NINE AND ANSWERS THEM ANYWAY</b>, which is the shape
 * `admin/priceWrites.ts` and {@link WHEN_ACTIVATING} both keep and the reason they give: the
 * screen is the floor and the route decides. Counted, because „cannot reach" is a claim:
 *
 * <ul>
 * <li><b>`theAmountIsNotMoney`</b> - {@link whatToDo} sends nought, blank and unreadable
 * elsewhere, so nothing below a para can be put on the wire from here.
 * <li><b>`theMethodIsNotKnown`</b> - {@link methodFor} answers one of the two the route knows or
 * else the row cannot act at all.
 * <li><b>`theReferenceIsNotShaped` and `theReferenceIsTaken`</b> - the owner's row carries three
 * things and a poziv na broj is not one of them (PDL section 19, „Sta stoji u redu"), so this
 * screen always sends none.
 * <li><b>`theAmountIsNotKeptExactly` is the one of the five that IS half reachable</b>, and so it
 * is not on this list: {@link AN_AMOUNT} refuses a third decimal but puts no ceiling on the
 * digits before the separator, and the route asks `MembershipPrice.amountIsKeptExactly`, which
 * knows what `numeric(10,2)` holds. So a moderator who types eleven digits is refused by the
 * server and reads a sentence.
 * </ul>
 */
export const WHEN_BOOKING_A_PAYMENT: Record<string, string> = {
  theFormIsNotComplete: 'verification.activationRefused.theFormIsNotComplete',
  theAmountIsNotMoney: 'verification.activationRefused.theAmountIsNotMoney',
  theAmountIsNotKeptExactly: 'verification.activationRefused.theAmountIsNotKeptExactly',
  theMethodIsNotKnown: 'verification.activationRefused.theMethodIsNotKnown',
  theReferenceIsNotShaped: 'verification.activationRefused.theReferenceIsNotShaped',
  theCompetitorDoesNotExist: 'verification.activationRefused.theCompetitorDoesNotExist',
  theReferenceIsTaken: 'verification.activationRefused.theReferenceIsTaken',
  thePaymentWasReversed: 'verification.activationRefused.thePaymentWasReversed',
  theMembershipIsAlreadyHeld: 'verification.activationRefused.theMembershipIsAlreadyHeld',
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

/** The two doors one row can knock on, named so a test cannot agree with a typo. */
export const PAYMENTS = '/api/payments'

export const MEMBERSHIPS = '/api/memberships'

/**
 * ONE REQUEST, WHOLE: the address and the body that goes to it.
 *
 * <p>The two are one value rather than two arguments because they are decided together and by the
 * same fact - whether money arrived - and a screen holding them apart is a screen that can send
 * one body to the other door.
 */
export type Sending =
  | { to: typeof PAYMENTS; body: Booking }
  | { to: typeof MEMBERSHIPS; body: Granting }

/**
 * `PaymentApi.Confirm`, field for field.
 *
 * <p><b>`reference` is null and is written out rather than left off.</b> The owner's row carries
 * three things and a poziv na broj is not one of them (PDL section 19); naming it null says that
 * on purpose, where an absent key would read as something forgotten. The route treats the two the
 * same - `isNothing` - so this costs nothing and tells the next reader which it is.
 */
type Booking = {
  competitorId: number
  received: number
  useTheBalance: boolean
  method: PaymentMethod
  reference: null
}

/** `MembershipWriteApi`'s, and no amount goes with it: the server works out what comes off. */
type Granting = {
  competitorId: number
  ground: string
}

/**
 * WHAT ONE ROW IS, AS {@link sending} NEEDS IT: the two fields a body carries and the two
 * {@link whatToDo} reads.
 *
 * <p><b>Four fields and not `MembershipDue`</b>, although every row that reaches this is one. The
 * names and the town are on that type and decide nothing here, and a function taking them would
 * be a function a test has to invent a name for before it can ask about money.
 */
type Whose = { competitorId: number; currency: string; expected: number; balance: number }

/**
 * WHAT PRESSING „AKTIVIRAJ" ON ONE ROW DOES, AND WITH WHAT BODY.
 *
 * <p><b>Every request that could leave the row is carried here, already built.</b> That is the
 * one thing this type is for: the screen picks which of them to send and never assembles one, so
 * „which number out of the row goes into which field of the request" is answered in a module a
 * test can ask without mounting anything. A body put together inside a click handler is a join
 * that only a rendered test can see, and then only if it reads the bytes that were sent.
 *
 * <p><b>Three of his seven send at once and four ask first, which is his table read literally.</b>
 * Cases 1, 2 and 7 say „aktivacija prolazi" with no question in the cell; 3, 3b, 4, 5 and 6 name
 * a prompt. So a question is drawn for exactly the rows whose cell holds one, and inventing one
 * for case 2 - „the balance is about to be spent, are you sure" - would be adding a decision he
 * did not ask for to a row he said just goes through.
 */
export type Press =
  /**
   * Nothing can be sent, and there are two ways to arrive here.
   *
   * <p>The field cannot be read ({@link WhatToDo} `'theFieldRefuses'`), which the row says in
   * words beside the field; or the money is one {@link methodFor} does not know, which it cannot
   * say anything about. <b>The second is a boundary and is named here rather than guarded:</b>
   * `Currency` holds `EUR` and `RSD` and `paymentQr.test.ts` reads that enum, so a third one
   * cannot arrive without somebody deciding how it is paid - but until they do, the row is
   * disabled with nothing to explain it, and that is better than booking into the wrong account.
   */
  | { press: 'nothing' }
  /** His 1, 2 and 7: „aktivacija prolazi", so the press books it and asks nothing. */
  | { press: 'sends'; sending: Sending }
  /**
   * His 3 and 3b: „Prihvatam umanjen ukupan iznos? Da / Ne".
   *
   * @param short what is still missing, for the question to name
   * @param sending what „Da" sends, which is the SAME body case 2 sends. That is not a shortcut:
   *                the route records what arrived and takes what the box allows either way, and
   *                the only difference between 2 and 3 is whether the two together reach the
   *                price. „Ne" sends nothing at all
   */
  | { press: 'asksAboutTheShortfall'; short: number; sending: Sending }
  /**
   * His 4 and 5: two grounds and one question.
   *
   * @param covers which of the two labels the second button carries, his 4 („Odobri iz balansa")
   *               against his 5 („Odobri umanjen iznos iz balansa")
   */
  | {
      press: 'asksAboutTheGround'
      covers: boolean
      onTheBalance: Sending
      freeOfTheFee: Sending
    }
  /** His 6, and the state his grid does not name: the box ticked over an empty book. */
  | { press: 'asksAboutTheExemption'; freeOfTheFee: Sending }

/**
 * THE PRESSES THAT PUT A QUESTION, as a type, so the sheet cannot be opened by one that does not.
 *
 * <p><b>This is what `Actionable` was for and it does the job the way a type can.</b> That one
 * narrowed a case by NAME and its promise rested on prose nothing checked; every member of this
 * one carries the {@link Sending} its answer sends, so a question with nowhere to go is not a
 * question this type can hold - there would be no body to put on it. The two it excludes are the
 * two with nothing to ask: `'nothing'`, which sends nothing at all, and `'sends'`, which is his
 * „aktivacija prolazi" and asks nobody.
 */
export type Question = Exclude<Press, { press: 'nothing' } | { press: 'sends' }>

/** One ground, built in one place so two callers cannot spell it two ways. */
function granting(whose: Whose, ground: string): Sending {
  return { to: MEMBERSHIPS, body: { competitorId: whose.competitorId, ground } }
}

/**
 * WHAT ONE PRESS ON A ROW DOES, decided once and read by both the button and the question.
 *
 * <p><b>IT ASKS {@link whatToDo} ITSELF RATHER THAN BEING HANDED THE ANSWER, and that is the one
 * decision in this function worth arguing about.</b> Taking a {@link WhatToDo} as an argument
 * beside the {@link Typed} would put ONE fact - what is in the field - behind two parameters, and
 * a caller handing over a case worked out from one amount and a {@link Typed} holding another
 * would be obeyed. The two cannot disagree if only one of them is asked for. That is the class
 * `CLAUDE.md` names as „dva izvora, jedna vrednost", asked of a signature instead of a fixture.
 *
 * <p><b>Which is also why the branching below reads the FIELD first and the case second.</b> A
 * body can only be built where an amount exists, so „is there an amount" is the question that
 * divides the two doors, and every branch under it is reachable: nothing typed goes to
 * `POST /api/memberships`, an amount goes to `POST /api/payments`, and a field that cannot be
 * read goes nowhere. Asking the case first and the field second would need a second test of
 * `typed.got` that nothing could ever make false - a branch the 100 per cent threshold would
 * find and nobody could cover.
 *
 * @param whose     the row: the two fields both bodies need, and the two {@link whatToDo} reads
 * @param typed     what is in the field, from {@link typedIn}. <b>The number on the wire can
 *                  only come from here</b>, and it is `received` and never `expected`: the route
 *                  records what the price list charged all by itself, so sending the expected
 *                  amount would book a man as having paid in full whatever he really sent
 * @param including whether the tick box is ticked, which is what `useTheBalance` carries.
 *                  <b>Never `covers` and never anything worked out from the balance</b>: the box
 *                  is what decides (PDL 23a), and the server is what works out how much comes off
 */
export function sending(whose: Whose, typed: Typed, including: boolean): Press {
  const what = whatToDo(typed, whose.expected, whose.balance, including)

  if (typed.got !== 'amount') {
    if (what.does === 'offersTheBalanceOrTheExemption') {
      return {
        press: 'asksAboutTheGround',
        covers: what.covers,
        onTheBalance: granting(whose, ON_THE_BALANCE),
        freeOfTheFee: granting(whose, FREE_OF_THE_FEE),
      }
    }

    if (what.does === 'asksAboutTheExemption') {
      return { press: 'asksAboutTheExemption', freeOfTheFee: granting(whose, FREE_OF_THE_FEE) }
    }

    /* `'theFieldRefuses'`, which is the only other answer `whatToDo` gives without an amount.
       The row says why in words beside the field; nothing leaves it. */
    return { press: 'nothing' }
  }

  const method = methodFor(whose.currency)

  if (method === null) {
    return { press: 'nothing' }
  }

  const sent: Sending = {
    to: PAYMENTS,
    body: {
      competitorId: whose.competitorId,
      received: typed.value,
      useTheBalance: including,
      method,
      reference: null,
    },
  }

  return what.does === 'asksAboutTheShortfall'
    ? { press: 'asksAboutTheShortfall', short: what.short, sending: sent }
    : { press: 'sends', sending: sent }
}
