package com.btl.portal.web;

/**
 * WHY A PAYMENT ON A BANK STATEMENT WAS NOT BOOKED BY ITSELF, in the words the screen is told.
 *
 * <p>Owner, 24.10.2026 (PDL „Učitavanje izvoda iz banke na ekranu Uplate"): „Kad poziv na broj imenuje
 * člana i sezonu (YYYYNNNNNN) i iznos je tačno očekivani, uplata se evidentira sama. Sve ostalo (manji
 * ili veći iznos, nepoznat broj) ide na ručnu potvrdu." Each of these is one way of „everything else",
 * as {@link StatementApi} meets it, in the order it asks.
 *
 * <p><b>Two homes, and both have a floor.</b> V74's {@code bank_statement_line_waits_for_a_known_reason}
 * holds the same words ({@code WhyALineWaitsMatchesTheSchemaTest}), and the Payments screen answers each
 * with a sentence ({@code frontend/src/pages/admin/statement.test.ts} reads this file). They are a class
 * of their own and not on {@link StatementApi} because none of them is a refusal: the route answers 200
 * with them, and {@code refusals.test.ts} reads every constant of a route as one.
 */
final class WhyALineWaits {

	/** The payment carries no poziv na broj. */
	static final String NO_REFERENCE = "noReference";

	/** It carries one that is not ten digits, or names no member. */
	static final String UNKNOWN_REFERENCE = "unknownReference";

	/** Ten digits whose year is not the season being paid for. */
	static final String ANOTHER_SEASON = "anotherSeason";

	/** The member it names pays in euro, and this account holds dinars. */
	static final String NOT_IN_DINARS = "notInDinars";

	/** Less or more than the label „Očekivan iznos" says he sends. */
	static final String NOT_THE_EXPECTED_AMOUNT = "notTheExpectedAmount";

	/**
	 * The booking itself said no (the season already held, the reference already on another payment),
	 * or the payment it booked has since been cancelled.
	 */
	static final String NOT_BOOKED = "notBooked";

	private WhyALineWaits() {
	}
}
