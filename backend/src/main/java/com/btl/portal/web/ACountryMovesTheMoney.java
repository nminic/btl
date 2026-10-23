package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.pricing.Currency;
import org.springframework.stereotype.Component;

/**
 * IF THE MONEY A MEMBER IS BILLED IN HAS CHANGED, HIS BALANCE IS RESTATED IN THE NEW ONE.
 *
 * <p>Owner, 27.09.2026 (PDL, section 26), chosen between three outcomes: „Dvojka, 120 je kurs i tako
 * ostaje do daljnjeg." And PDL 25 is why it has to happen at all: a balance is „uvek u valuti zavisno
 * od drzave", so a member billed in euro from now on cannot go on holding dinars. And the owner again,
 * 22.10.2026, for the row of a member that the administration edits: „promena mesta u drugu državu
 * menja i valutu."
 *
 * <p><b>THE MOMENT IS THE CHANGE OF COUNTRY ON THE MEMBER'S ROW AND NOT ANY OTHER, WHICH IS HIS
 * SENTENCE AND NOT A CHOICE MADE HERE:</b> „Trenutak je promena zemlje na zapisu clana, ne prijava i
 * ne pocetak sezone." <b>TWO ROUTES WRITE {@code competitor.country_id}, and both call this.</b>
 * Until 22.10.2026 {@link MeWriteApi} was the only one, and its comment said so in as many words
 * („This is the only route in the portal that writes competitor.country_id"); that stopped being
 * true the day {@link MemberDataWriteApi} let the administration over the members correct a town,
 * so the sentence moved here with the code and now names both. Written twice, the second copy
 * would be the one that forgot the promise.
 *
 * <p><b>THREE STATES AND ONLY ONE OF THEM MOVES ANY MONEY</b>, and the two that do not are the
 * ordinary ones: no town was named at all, so his country cannot have moved; a town was named and
 * the MONEY did not change, which is Belgrade to Novi Sad and equally Germany to France; or the money
 * changed, and then his whole book is restated.
 *
 * <p><b>AND AN EMPTY BOOK WRITES NO LINES EITHER</b>, which is not an optimisation:
 * {@code balance_entry_a_conversion_moves_something} (V42) refuses a line of nought, and rightly - a
 * member with no balance has nothing to restate.
 *
 * <p><b>THE PROMISE GOES EVEN WHEN THE BOOK IS EMPTY</b>, and that is the one place these two
 * conditions come apart rather than being one. A member whose book was empty was still minted a
 * code, for the whole fee, and {@code balance_promise} records that nought; that slip is in the old
 * money and is not payable, so it goes with every other ({@link BalanceBook#forgetEveryPromise}).
 *
 * <p><b>WHO THE BOOK SAYS DID IT IS WHOEVER ASKED</b>: the member himself on his own form, the
 * moderator or the superadmin on the administration's. {@code balance_entry.recorded_by_name} is
 * {@code not null} and ADL asks for „ko", so the account that sent the request is threaded down
 * here by both routes.
 */
@Component
class ACountryMovesTheMoney {

	private final BalanceBook book;

	private final CurrencyOfMember currencyOf;

	private final MemberOfAccount memberOfAccount;

	ACountryMovesTheMoney(BalanceBook book, CurrencyOfMember currencyOf, MemberOfAccount memberOfAccount) {
		this.book = book;
		this.currencyOf = currencyOf;
		this.memberOfAccount = memberOfAccount;
	}

	/**
	 * Which money he is billed in BEFORE the row moves, because afterwards there is nothing left to
	 * compare with. Asked only by a request that names a town: one that merely renames him cannot
	 * change his country.
	 */
	Currency before(long member) {
		return currencyOf.of(member);
	}

	/** After the row has moved: restates the book and forgets the promises if the money changed. */
	void after(long member, Currency was, long account) {
		Currency now = currencyOf.of(member);

		if (was == now) {
			return;
		}

		book.forgetEveryPromise(member);

		Balance.Money had = book.of(member, was);

		if (had.isMoney()) {
			book.translated(member, had, Balance.translated(had, now), account,
					memberOfAccount.nameOf(account));
		}
	}
}
