package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * WHAT THE BOOK ADDS UP TO FOR THE ASKER RIGHT NOW, in the money it is kept in, and nothing else.
 *
 * <p><b>Why it exists (22.10.2026).</b> The screen „Moja članarina" drew its balance as the amount of
 * a referral times {@code MeApi}'s {@code referredCount}, which is not a balance, and the owner read
 * „0 RSD" over a book that held 600. The balance is the book's, and the book had exactly one door:
 * {@link MyMembershipApi}. That door is the wrong one for this question twice over, and both are
 * measured rather than assumed. It answers 404 to a member the Managing Board freed of the season's
 * fee, and the owner is one, so the very member who reported the fault would have been shown
 * nothing. And it WRITES: the first look of a season records the promise a booking later takes off
 * the book (owner, 27.09.2026), so a line that merely shows a number would have recorded one every
 * time the screen was opened.
 *
 * <p><b>A ROUTE OF ITS OWN AND NOT A FIELD ON {@link MeApi}.</b> {@code MeApi} says in so many words
 * that the balance is not answered there, and why: {@code /api/me} is read by every request whether
 * the screen wants it or not, and reading the book there would cost every caller of it a query for a
 * question one screen asks ({@link MyApplicationsApi} gives the same reason). This is that one
 * screen's route, so the cost is paid by the screen that asks.
 *
 * <p><b>IT NAMES NO MEMBER AND THAT IS THE WHOLE OF ITS AUTHORISATION.</b> No id in the path and none
 * in a parameter, so there is no shape in which somebody else's book could be asked for. It is absent
 * from {@link ApiSecurity#READ_BY_ANYBODY}, so a visitor is refused 401 before this class runs, and
 * it carries no {@link RightIsNeeded}: reading your own balance is not a moderator's action and no
 * box anybody could tick would grant it.
 *
 * <p><b>An account that names no member is answered 404</b> (ADL A8), the shape
 * {@link MyMembershipApi} and {@link InboxApi} have for the identical case: a moderator who does not
 * race has no book.
 *
 * <p><b>IT ANSWERS EVERY MEMBER, the one the Managing Board freed of this season's fee included.</b>
 * Being freed of a fee is about a season ({@code membership.basis}); the book is about money earned,
 * and the owner decided that a referral is credited all the same when the member brought in is freed
 * (PDL P16, 13.08.2026). So nothing here asks for the basis.
 *
 * <p><b>IT WRITES NOTHING, and {@code MyBalanceApiTest} counts the rows of {@code balance_promise}
 * and {@code balance_entry} before and after.</b> It is the sum {@link MyMembershipApi} reports as
 * {@code balance} ({@link BalanceBook#of}, in {@link CurrencyOfMember}'s money), without the invoice
 * and without the promise: the two routes cannot disagree about what the book holds because it is the
 * one call.
 */
@RestController
class MyBalanceApi {

	private final MemberOfAccount memberOfAccount;

	private final CurrencyOfMember currencyOf;

	private final BalanceBook book;

	MyBalanceApi(MemberOfAccount memberOfAccount, CurrencyOfMember currencyOf, BalanceBook book) {
		this.memberOfAccount = memberOfAccount;
		this.currencyOf = currencyOf;
		this.book = book;
	}

	/**
	 * Answered as the money itself ({@code {amount, currency}}) and not wrapped, because it is the
	 * only fact this route has. A book of nothing is {@code 0} in his money, never an absence: a
	 * member who has brought in nobody has no rows at all, and that is the ordinary case.
	 */
	@GetMapping("/api/me/balance")
	ResponseEntity<Balance.Money> mine(@AuthenticationPrincipal WhoIsAsking.Member asking) {
		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return ResponseEntity.notFound().build();
		}

		return ResponseEntity.ok(book.of(me, currencyOf.of(me)));
	}
}
