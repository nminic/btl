package com.btl.portal.domain.balance;

import com.btl.portal.domain.pricing.Currency;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Objects;

/**
 * ONE LINE OF THE BOOK OF BALANCE AS IT STANDS, with the sign it was written with.
 *
 * <p>{@link Balance.Money} is never negative, by its own rule, so a line of the book - where a spend
 * moves down - is not one. This is the line as {@code balance_entry} holds it: the amount with its
 * sign, the money it was written in, why it moves, and the season it names when its reason names one
 * ({@code balance_entry_what_names_the_season}, V42 and V63).
 *
 * @param id     the key the book gave it, which is also the order the lines were written in: a
 *               {@code bigserial}, never moved ({@code a_balance_entry_is_written_once}, V38)
 * @param season the season it names, or {@code null} for a reason that names none
 */
public record BookLine(long id, Reason reason, Integer season, BigDecimal amount, Currency currency) {

	public BookLine {
		Objects.requireNonNull(reason, "reason");
		Objects.requireNonNull(amount, "amount");
		Objects.requireNonNull(currency, "currency");
	}

	/**
	 * WHY A LINE MOVES THE BALANCE, in the words {@code balance_entry_reason_known} holds.
	 *
	 * <p>{@code BalanceReasonsMatchTheSchemaTest} compares these words with that rule in both
	 * directions, so a reason added to the schema without being added here, or the other way round,
	 * fails on the day it is written.
	 */
	public enum Reason {

		/** A reward for a member brought in, in the referrer's book (V38). Names no season. */
		REFERRAL("referral"),

		/** What a season's membership took off the balance (V38). */
		MEMBERSHIP("membership"),

		/** The surplus of a payment, credited while that season was paid for (V42). */
		OVERPAYMENT("overpayment"),

		/** A change of country restating the balance in the other money (V42). Names no season. */
		CONVERSION("conversion"),

		/** What a season's membership held, given back or taken back when it is cancelled or its
		 *  basis changes from a payment (V63, PDL P8, 18.10.2026). */
		REVERSAL("reversal");

		private final String word;

		Reason(String word) {
			this.word = word;
		}

		/** The word the schema holds. */
		public String word() {
			return word;
		}

		/** The reason a word of the schema names. */
		public static Reason of(String word) {
			return Arrays.stream(values())
					.filter(one -> one.word.equals(word))
					.findFirst()
					.orElseThrow(() -> new IllegalArgumentException("no reason is called " + word));
		}
	}
}
