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
 * {@code /api/me/applications} and {@code /api/me/notifications} are already on that list with.
 *
 * <p><b>An account that names no member is answered 404</b>, the identical shape
 * {@link NotificationApi} and {@link InboxApi} have for the identical case: a moderator who does
 * not race has no membership to buy, and 404 rather than an empty answer because there is no
 * resource here to describe.
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
	 * @param balance             what the book adds up to
	 * @param fromTheBalance      how much of it this membership would use
	 * @param toTransfer          what is left for him to send, and what the code is minted on
	 * @param processingFeeEur    charged on a euro transfer only (V16
	 *                            {@code payment_only_euro_carries_a_fee}), and nothing at all when
	 *                            there is no transfer to process
	 * @param coveredByTheBalance the owner's „veci ili jednak": when true there is no code to mint
	 *                            and {@code POST /api/me/membership} is the way in
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
		Balance.Settlement settled = owed.settled();

		/* THIS READ WRITES ONE ROW, AND THAT IS THE OWNER'S DECISION OF 27.09.2026 RATHER THAN A
		   CONVENIENCE. He chose that a booking takes „ono sto je kod obecao, ne ono sto balans stoji
		   na dan knjizenja", so the promise has to be recorded at the moment the amount is put in
		   front of the member - and this is that moment. It is the ONLY place a reduced amount is
		   ever computed, so it is the only place that can record one; a separate call the browser
		   would have to remember to make would leave a window in which the member is shown a
		   discount that nothing ever takes off his book, and he would keep getting it season after
		   season.

		   WHAT IT COSTS, said out loud because a GET that writes is a thing a reader should be told
		   about rather than discover: this route is not safe to serve from a read replica and not
		   safe to prefetch. It is idempotent - an upsert of the same amount - and it is one statement
		   on one row keyed by (member, season), so a member refreshing the page ten times leaves one
		   row saying the same thing.

		   NOTHING IS PROMISED WHEN THE BALANCE COVERS THE WHOLE FEE, because then there is no code:
		   the way in is `POST /api/me/membership`, which spends the fee out of the book itself. Were
		   a promise written here anyway, a stray transfer arriving for a member who did not need to
		   pay would both record a payment of the full fee AND take the fee off his balance, charging
		   him twice for one season. */
		book.promise(me, owed.season(),
				settled.coveredByTheBalance() ? Balance.Money.NOTHING : settled.fromTheBalance());

		return ResponseEntity.ok(new MyMembership(owed.season(), owed.alreadyAMember(), owed.priceKey(),
				settled.fee(), settled.balance(), settled.fromTheBalance(), settled.toTransfer(),
				owed.processingFeeEur(), settled.coveredByTheBalance()));
	}
}
