package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

/**
 * WHAT THIS MEMBER OWES FOR THE SEASON ON SALE, once his balance has been counted against it.
 *
 * <p><b>Owner, 26.09.2026:</b> „QR se kuje na iznos minus balans." The code itself is drawn in the
 * browser, but the NUMBER on it is money and money is decided on the server. The measurement that
 * produced that decision is the reason: {@code frontend/src/data/paymentQr.ts} was handed an
 * {@code amountRsd} and the screen never subtracted anything, so the portal's own page promised
 * „Balansom se placaju buduce clanarine" while the slip underneath it asked for the full fee.
 * Serving the subtracted number from here is what stops that being two numbers again.
 *
 * <p><b>WHY A ROUTE OF ITS OWN AND NOT A FIELD ON {@link MeApi}.</b> The reason
 * {@link MyApplicationsApi} gives in its own words: {@code /api/me} is read by every request
 * whether the screen wants it or not, and this answer costs the price list, the book and a
 * membership lookup for a question one screen asks.
 *
 * <p><b>IT NAMES NO MEMBER AND THAT IS THE WHOLE OF ITS AUTHORISATION.</b> There is no id in the
 * path and none in a parameter, so there is no shape in which somebody else's invoice could be
 * asked for - the same construction {@link MeWriteApi} chose, where „his own" is not a check that
 * could be forgotten but the only thing the route can express. A visitor never reaches it: it is
 * absent from {@link ApiSecurity#READ_BY_ANYBODY}, so the chain answers 401 before this class runs.
 * And it carries no {@link RightIsNeeded}, because buying your own membership is not a moderator's
 * action and there is no box anybody could tick for it - the sentence
 * {@code /api/me/applications} and {@code /api/inbox} are already on that list with.
 *
 * <p><b>An account that names no member is answered 404</b>, the identical shape
 * {@link InboxWriteApi} and {@link InboxApi} have for the identical case: a moderator who does
 * not race has no membership to buy, and 404 rather than an empty answer because there is no
 * resource here to describe.
 *
 * <p><b>AND SO IS A MEMBER THE MANAGING BOARD FREED OF THIS SEASON'S FEE, for that same sentence
 * rather than by analogy: he has no membership to buy either.</b> {@code MembershipInvoice} computes
 * {@code exemptFromTheFee} and both writing routes turn on it, so this one reading it is what stops
 * one fact having two homes that disagree - and they did disagree, measurably: the route served such
 * a member a slip for the whole membership, wrote a promise against it, and let a booking take his
 * balance off him for a season he had been given. {@link MyMembershipWriteApi} refuses him 409
 * {@code thereIsNoFeeToPay} „and HIS BALANCE IS NOT TOUCHED"; this is the same refusal said in the
 * only way a GET can say it.
 *
 * <p><b>„FREED OF THE FEE" IS ALWAYS ABOUT THE SEASON ON SALE AND NEVER ABOUT THE MAN.</b> The
 * owner, 27.09.2026: „BESPLATNI CLANOVI NISU BESPLATNI DOZIVOTNO. Admin moze da odobri (jednu po
 * jednu) godinu clanarine, ne postaju ljudi besplatni zauvek!" So the 404 below turns on the
 * {@code membership} row for THIS season standing on {@code feeExempt}, and a member freed of an
 * earlier season is served the invoice for this one like anybody else. What this was before is in
 * {@link MembershipInvoice}, with what it cost.
 *
 * <p><b>THE SEASON IS THE ONE ON SALE TODAY AND IS NOT ASKED FOR</b>
 * ({@link SeasonClock#seasonBeingPaidFor}, through {@link MembershipInvoice}), the same call
 * {@link PaymentApi} makes for the reason its javadoc gives: which season money buys is fixed by
 * the day, and a season in a query string would let one keystroke buy the wrong year.
 */
@RestController
class MyMembershipApi {

	private final MemberOfAccount memberOfAccount;

	private final MembershipInvoice invoice;

	private final BalanceBook book;

	MyMembershipApi(MemberOfAccount memberOfAccount, MembershipInvoice invoice, BalanceBook book) {
		this.memberOfAccount = memberOfAccount;
		this.invoice = invoice;
		this.book = book;
	}

	/**
	 * <p><b>Deliberately narrower than {@link MembershipInvoice.Invoice}.</b> That record carries
	 * two more facts, because the route that spends the balance turns on them: whether he is exempt
	 * from the fee, and the number he already has. Neither is any part of what he owes, so neither
	 * leaves here - his basis already reaches him through {@code /api/me} (owner, 20.09.2026) and
	 * his number through the same, and a second home for either on this answer would be a second
	 * place they could disagree.
	 *
	 * @param season              the one on sale today, never one that was asked for
	 * @param alreadyAMember      a {@code membership} row already stands for him and this season,
	 *                            on any basis - in which case there is nothing to pay
	 * @param priceKey            which row of the price list applies, so the screen can name the
	 *                            period without deciding it a second time
	 * @param fee                 the membership itself, both currencies
	 * @param balance             what the book adds up to RIGHT NOW, which after his code has been
	 *                            minted is not what {@code fromTheBalance} is worked out of
	 * @param fromTheBalance      how much of it this membership would use, <b>as the code already
	 *                            minted for this season says</b> and not as today's book would have
	 *                            it - the first look of a season fixes this number
	 *                            ({@link Balance#asThePromiseStands})
	 * @param toTransfer          what is left for him to send, and what the code is minted on. The
	 *                            fee less {@code fromTheBalance}, so the two always add back up to
	 *                            it whichever slip he is holding
	 * @param processingFeeEur    charged on a euro transfer only (V16
	 *                            {@code payment_only_euro_carries_a_fee}), and nothing at all when
	 *                            there is no transfer to process - asked of {@code toTransfer} and
	 *                            therefore of the code, not of today's balance
	 * @param coveredByTheBalance the owner's „veci ili jednak", asked of TODAY: when true
	 *                            {@code POST /api/me/membership} is a way in, because that route
	 *                            mints no code and so is bound by no promise. It may therefore be
	 *                            true beside a {@code toTransfer} that is not nothing, which is a
	 *                            member whose balance grew after his slip was printed: both roads
	 *                            are open to him and both come out right
	 */
	record MyMembership(int season, boolean alreadyAMember, String priceKey, Balance.Money fee,
			Balance.Money balance, Balance.Money fromTheBalance, Balance.Money toTransfer,
			BigDecimal processingFeeEur, boolean coveredByTheBalance) {
	}

	@GetMapping("/api/me/membership")
	ResponseEntity<?> mine(@AuthenticationPrincipal WhoIsAsking.Member asking) {
		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return ResponseEntity.notFound().build();
		}

		MembershipInvoice.Invoice owed = invoice.forMember(me);

		/* A MEMBER THE MANAGING BOARD FREED OF THIS SEASON'S FEE HAS NO MEMBERSHIP TO BUY, so there
		   is no invoice here to describe and the answer is the one this route already gives for that
		   sentence - the 404 an account naming no member gets, for the identical reason.

		   IT IS A REFUSAL RATHER THAN AN INVOICE OF NOUGHT, and that is chosen. `MyMembership`
		   cannot say „he owes nothing": every field on it is about an amount, and the one field a
		   screen would act on, `coveredByTheBalance`, means „`POST /api/me/membership` is the way
		   in" - which for this member is false, because that route answers him 409
		   `thereIsNoFeeToPay` with his balance untouched. Serving nought in every column would
		   therefore put a false value in the one field that drives a button. His basis already
		   reaches his own screen through `/api/me` (owner, 20.09.2026), so nothing he needs is lost.

		   WHAT THIS WAS BEFORE, said out loud because it was money: until this was written the route
		   read `exemptFromTheFee` not at all, while `MembershipInvoice` computed it and both writing
		   routes turned on it. A member freed of the fee was therefore served a slip for the WHOLE
		   membership, had a promise recorded against it, and had his balance taken off him when
		   somebody booked that transfer - the portal charging him for a season the Managing Board had
		   given him. One fact, one branch, two homes that disagreed.

		   AND ONE ROUND LATER THE FACT ITSELF MOVED, which is a second thing and not the same one:
		   the branch was right and what it asked was wrong. It asked `competitor.membership_basis`,
		   a column written once per PERSON and never taken back, so one granted season answered this
		   404 for every season after it and the portal could no longer bill a man it had freed once.
		   It now asks the `membership` row for the season on sale.

		   THE OPEN PART, named rather than settled: what his own screen should show him instead. A
		   field on this answer would be the cheap way and it is deliberately not invented here. */
		if (owed.exemptFromTheFee()) {
			return ResponseEntity.notFound().build();
		}

		/* THIS READ WRITES ONE ROW, AND THAT IS THE OWNER'S DECISION OF 27.09.2026 RATHER THAN A
		   CONVENIENCE. He chose that a booking takes „ono sto je kod obecao, ne ono sto balans stoji
		   na dan knjizenja", so the promise has to be recorded at the moment the amount is put in
		   front of the member - and this is that moment. It is the ONLY place a reduced amount is
		   ever computed, so it is the only place that can record one; a separate call the browser
		   would have to remember to make would leave a window in which the member is shown a
		   discount that nothing ever takes off his book, and he would keep getting it season after
		   season.

		   IT WRITES ONLY THE FIRST TIME, AND EVERY LOOK AFTER THAT IS SERVED WHAT ALREADY STANDS.
		   This is the whole of the owner's decision and an earlier draft of this branch broke it: the
		   write was an upsert, so a refresh after a referral landed moved the promise from 600 to
		   1.200 while the member still held a slip for 3.600, and booking that slip took 1.200 off
		   his book for a discount of 600. The owner refused exactly that, with exactly that cost
		   („the association's liability would fall by 1.200 against a discount of 600"). The rule
		   that comes out of it is one sentence: THE FIRST LOOK OF A SEASON FIXES WHAT THAT SEASON'S
		   CODE PROMISES, so every slip he can be holding for it says the same number.

		   WHAT IT COSTS, said out loud because a GET that writes is a thing a reader should be told
		   about rather than discover: this route is not safe to serve from a read replica and not
		   safe to prefetch. And a member whose balance GROWS after his first look is not offered the
		   bigger discount until the next season - his balance keeps („Balans ne propada nikad i
		   prenosi se iz sezone u sezonu", PDL 11.08.2026), and if it grows past the whole fee he can
		   still let himself in through `POST /api/me/membership`, which mints no code and reads no
		   promise. That is why `coveredByTheBalance` below is today's answer and not the promise's.

		   AND NO ROW AT ALL WHEN THE BALANCE COVERS THE WHOLE FEE, because then there is no code to
		   promise anything ABOUT. A row is written exactly when one is minted, so its presence says
		   „this season's code stands at this number" and nothing else - which is what
		   `BalanceBook.promised` is read for. „Covered" and „no code" are one state and not two:
		   `Balance.against` leaves `toTransfer` at nothing precisely when the balance reaches the fee
		   in both currencies, so there is no covered member holding a slip for anything.

		   WHAT IT WAS BEFORE AND WHY IT HAD TO CHANGE, said out loud because it was money. A nought
		   WAS written for him, and a nought is also what a member with an empty book is promised - so
		   one row meant two different things and carried nothing to tell them apart. The second look
		   could only read it one way: `Balance.asThePromiseStands` settles nought against the fee and
		   gets „the code promised nothing", which is right for the empty book and wrong for the
		   covered man. Measured on one member looked at TWICE, nothing else moving: `toTransfer` went
		   from nothing to the whole 4.200 and 35, the processing fee appeared beside it, and
		   `coveredByTheBalance` stayed true - the portal billing in full, plus a bank charge, a man
		   whose balance had already paid. The nought that pins a member is the one minted on an empty
		   book, and that one is still written: an empty book is not covered, so it takes the branch
		   below. */
		Balance.Settlement settled = book.promised(me, owed.season())
				.map(standing -> Balance.asThePromiseStands(owed.settled(), standing))
				.orElseGet(() -> {
					if (!owed.settled().coveredByTheBalance()) {
						book.promise(me, owed.season(), owed.settled().fromTheBalance());
					}

					return owed.settled();
				});

		/* NO TRANSFER, NOTHING TO PROCESS: reasoning rather than a written decision, and V16's own
		   words carry it - the fee „is NOT membership and is shown as its own line". Asked of the
		   transfer THIS ANSWER SERVES and not of today's arithmetic, because the two part company for
		   a member whose balance grew past his fee after his code was minted: `coveredByTheBalance`
		   is true for him (he may let himself in) while the slip in his hand still asks for a
		   transfer, and a transfer that is asked for is a transfer somebody's bank will charge for. */
		BigDecimal processing = settled.toTransfer().isNothing()
				? BigDecimal.ZERO
				: owed.processingFeeEurIfHeTransfers();

		return ResponseEntity.ok(new MyMembership(owed.season(), owed.alreadyAMember(), owed.priceKey(),
				settled.fee(), settled.balance(), settled.fromTheBalance(), settled.toTransfer(),
				processing, settled.coveredByTheBalance()));
	}
}
