package com.btl.portal.domain.membership;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;

import java.text.MessageFormat;
import java.util.Locale;
import java.util.Objects;
import java.util.ResourceBundle;

/**
 * THE THREE LINES A MEMBER GETS IN HIS INBOX WHEN HIS MEMBERSHIP IS CHANGED ON HIS ROW.
 *
 * <p><b>The decision.</b> The owner, 18.10.2026 (PDL P8, the section „Osnov clanstva ima jedan dom,
 * zapis po sezoni"), chosen with the recommendation: „Upis uplate, promena osnova i storno stizu
 * clanu kao poruka u portalskom sanducetu, sa sezonom i novim stanjem, bez mejla." So there are three
 * occasions, each says the season and what the season stands on now, and none is a letter.
 *
 * <p><b>IN SERBIAN ONLY, and that is a decision, not a gap.</b> The owner, 10.10.2026 (PDL, „Jezik
 * mejlova (JM)"): „u sanducetu kopija rezultatskih poruka prati jezik mejla, ostalo srpsko (potpuno
 * pracenje kasnije)". These are not copies of a letter, so they are the „ostalo", and there is one
 * dictionary, {@code notices/membership.properties}.
 *
 * <p><b>NOT IN {@code domain/mail}, and the reason is a floor there.</b>
 * {@code EveryMailIsAMandatoryOneTest} walks that package, asks each class for the dictionaries it
 * loads through {@code words(MailLanguage)}, and requires every occasion found to be one of the
 * mandatory mails of PDL P22. These three are, by the decision above, not mails at all; written there
 * they would fail that floor, and rightly. So they live with the membership they are about, read one
 * dictionary through {@link #words()}, and hand over the same {@link Said} pair the inbox writers
 * take.
 *
 * <p><b>The shape is {@code WhatAResultChangeSays}'s</b>: an enum of occasions, each declaring how
 * many facts its words take, and floors in {@code WhatAMembershipChangeSaysTest} that sweep
 * {@link Told#values()}, {@link Basis#values()} and the dictionary's own key set, so no list is typed
 * anywhere. No message carries a link.
 */
public final class WhatAMembershipChangeSays {

	/** Its own dictionary, for the reason {@code notices/results} has its own: each dictionary is held
	 *  to exactly its occasions, in both directions, by a floor of its own. */
	private static final String WORDS = "notices/membership";

	/** {@code Locale.ROOT}: the words are chosen by naming their file, never by the server's locale. */
	private static final Locale ONE_SET_OF_WORDS = Locale.ROOT;

	/** The key under which each basis is written out in words, followed by its schema word. */
	static final String A_BASIS = "basis.";

	private WhatAMembershipChangeSays() {
	}

	/**
	 * THE THREE OCCASIONS, and each says how many facts its words take, because {@code MessageFormat}
	 * renders a hole nobody fills as the literal „{1}" and drops a value nobody asked for without a
	 * word.
	 */
	public enum Told {

		/** A payment recorded for a season on the member's row: the season. */
		A_PAYMENT_WAS_RECORDED("paymentRecorded", 1),

		/** The basis of a season changed: the season, and the basis it stands on now. */
		THE_BASIS_WAS_CHANGED("basisChanged", 2),

		/** A season's membership cancelled, the owner's „storno": the season. */
		THE_MEMBERSHIP_WAS_CANCELLED("membershipCancelled", 1);

		private final String key;

		private final int facts;

		Told(String key, int facts) {
			this.key = key;
			this.facts = facts;
		}

		/** What the words are filed under. */
		public String key() {
			return key;
		}

		/** How many values its words take. */
		public int facts() {
			return facts;
		}
	}

	/** A payment was recorded for this season, and he is a member of it on a payment. */
	public static Said paymentRecorded(int season) {
		return said(Told.A_PAYMENT_WAS_RECORDED, aSeason(season));
	}

	/**
	 * The basis of this season changed, and the message names the basis it stands on NOW: „sa sezonom
	 * i novim stanjem". What it stood on before is in the trail ({@code membership_change}, V63), not
	 * in his inbox.
	 */
	public static Said basisChanged(int season, Basis now) {
		Objects.requireNonNull(now, "now");

		return said(Told.THE_BASIS_WAS_CHANGED, aSeason(season), inWords(now));
	}

	/** His membership of this season was cancelled, and he is no member of it now. */
	public static Said cancelled(int season) {
		return said(Told.THE_MEMBERSHIP_WAS_CANCELLED, aSeason(season));
	}

	/** One basis in the words a member reads. */
	public static String inWords(Basis basis) {
		return words().getString(A_BASIS + basis.word());
	}

	/** The words of one occasion, filled in. Package visible so the floor can ask for every one. */
	static Said said(Told told, Object... values) {
		ResourceBundle words = words();

		return new Said(words.getString(told.key() + ".subject"),
				new MessageFormat(words.getString(told.key() + ".body"), ONE_SET_OF_WORDS)
						.format(values));
	}

	/** The one dictionary, which the floor over it reads too. */
	static ResourceBundle words() {
		return ResourceBundle.getBundle(WORDS, ONE_SET_OF_WORDS);
	}

	/**
	 * A season as a finished string. Handed to {@code MessageFormat} as a number it would be grouped,
	 * „2,028", because the format is built for {@code Locale.ROOT}.
	 */
	private static String aSeason(int season) {
		return Integer.toString(season);
	}
}
