package com.btl.portal.domain.membership;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;

import java.text.MessageFormat;
import java.util.Locale;
import java.util.Objects;
import java.util.ResourceBundle;

/**
 * THE LINES A MEMBER GETS IN HIS INBOX WHEN HIS MEMBERSHIP IS CHANGED: THE FOUR ABOUT HIS ROW, AND THE
 * TWO ABOUT THE BEGINNERS' CATEGORY THAT A MEMBERSHIP CAN CLOSE OR OPEN AGAIN.
 *
 * <p><b>The decision.</b> The owner, 18.10.2026 (PDL P8, the section „Osnov clanstva ima jedan dom,
 * zapis po sezoni"), chosen with the recommendation: „Upis uplate, promena osnova i storno stizu
 * clanu kao poruka u portalskom sanducetu, sa sezonom i novim stanjem, bez mejla." So there are three
 * occasions, each says the season and what the season stands on now, and none is a letter. A fourth
 * since 20.10.2026: an exemption granted on the row to a member who held no season on sale, in the
 * words the owner approved on 18.10.2026 („Može ovako”), „Oslobođeni ste članarine” / „Za sezonu
 * {sezona} oslobođeni ste plaćanja članarine i član ste lige.”
 *
 * <p><b>IN SERBIAN ONLY, and that is a decision, not a gap.</b> The owner, 10.10.2026 (PDL, „Jezik
 * mejlova (JM)"): „u sanducetu kopija rezultatskih poruka prati jezik mejla, ostalo srpsko (potpuno
 * pracenje kasnije)". These are not copies of a letter, so they are the „ostalo", and there is one
 * dictionary, {@code notices/membership.properties}.
 *
 * <p><b>NOT IN {@code domain/mail}, and the reason is a floor there.</b>
 * {@code EveryMailIsAMandatoryOneTest} walks that package, asks each class for the dictionaries it
 * loads through {@code words(MailLanguage)}, and requires every occasion found to be one of the
 * mandatory mails of PDL P22. None of these is a mail, by the decision above; written there
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
	 * THE OCCASIONS, and each says how many facts its words take, because {@code MessageFormat}
	 * renders a hole nobody fills as the literal „{1}" and drops a value nobody asked for without a
	 * word.
	 */
	public enum Told {

		/** A payment recorded for a season on the member's row: the season. */
		A_PAYMENT_WAS_RECORDED("paymentRecorded", 1),

		/** The basis of a season changed: the season, and the basis it stands on now. */
		THE_BASIS_WAS_CHANGED("basisChanged", 2),

		/** A season's membership cancelled, the owner's „storno": the season. */
		THE_MEMBERSHIP_WAS_CANCELLED("membershipCancelled", 1),

		/** A season granted free of the fee on the row, where none stood: the season. */
		AN_EXEMPTION_WAS_GRANTED("exemptionGranted", 1),

		/**
		 * A membership written for a season closed his beginners' category for the season after it:
		 * the season of the membership, the threshold, and the season the category is closed for.
		 */
		THE_BEGINNERS_CATEGORY_WAS_CLOSED("beginnersCategoryClosed", 3),

		/** A membership cancelled opened it again: the same three facts. */
		THE_BEGINNERS_CATEGORY_WAS_REOPENED("beginnersCategoryReopened", 3);

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

	/** He was freed of the fee for this season, and is a member of it. */
	public static Said exemptionGranted(int season) {
		return said(Told.AN_EXEMPTION_WAS_GRANTED, aSeason(season));
	}

	/**
	 * A MEMBERSHIP WRITTEN OR CANCELLED MOVED HIS BEGINNERS' CATEGORY, and the line says which way, what
	 * moved it, the threshold and which season (PDL P7, 27.09.2026, the member is told „sa razlogom").
	 * Both ways, the shape PDL P4 gave the line a correction of a race writes (10.10.2026, „u oba
	 * smera"): a cancellation can open what a membership closed. The words are the owner's choice of
	 * 19.10.2026 among the ones put to him.
	 *
	 * <p><b>Two seasons and never one</b>, because they are two facts: the season whose membership was
	 * written or cancelled, and the season whose category that closes or opens, which is always a later
	 * one ({@code BestOfficialSeason} counts a season only toward the seasons after it). Both are handed
	 * in by the one caller that worked them out, so the season the right was asked for and the season
	 * the line names are one number.
	 *
	 * <p>The threshold is {@link Category#FIRST_SEASON_POINTS}, written as the whole number it is, the
	 * way every other line about the category writes it.
	 *
	 * @param open          whether the category is open to him now
	 * @param season        the season of the membership
	 * @param theSeasonAfter the season the category is closed or opened for
	 */
	public static Said beginnersCategoryMoved(boolean open, int season, int theSeasonAfter) {
		return said(open ? Told.THE_BEGINNERS_CATEGORY_WAS_REOPENED : Told.THE_BEGINNERS_CATEGORY_WAS_CLOSED,
				aSeason(season), Integer.toString(Category.FIRST_SEASON_POINTS), aSeason(theSeasonAfter));
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
