package com.btl.portal.domain.mail;

import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.membership.Basis;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.text.MessageFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.ResourceBundle;

/**
 * THE LETTER A MEMBER IS SENT THE MOMENT HIS ADDRESS IS CONFIRMED, AND WHICH OF SIX IT IS.
 *
 * <p>The owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije"):
 * „Posle potvrđene adrese portal šalje poruku o članarini: član iz Srbije dobija podatke za uplatu i
 * IPS QR kod u prilogu, član iz inostranstva PayPal podatke (bez QR koda), a vlasnikovim rečima
 * „oslobođen ili pokriven balansom dobija poruku na koji je način njegova članarina izmirena"". On
 * 24.10.2026 he added F, for a member whose payment was recorded before he confirmed, and G, for a
 * balance that covers the whole fee while the membership has not been taken out of it yet; and he
 * chose that nothing is sent for a fee of nought, nor to a member who already has a number and no
 * membership of the season on sale.
 *
 * <p>The words live in {@code mail/welcome.properties} and {@code mail/welcome-en.properties}, and
 * follow the language of the account they go to (PDL P18, 03.10.2026).
 */
public final class WhatTheWelcomeSays {

	/**
	 * Where „Moja članarina" is, after the language. The page is {@code MEMBERSHIP_ADDRESS} in
	 * {@code frontend/src/app/routes.ts}, and {@code postedAddresses.json} promises it is served.
	 *
	 * <p><b>Not the „/sr/clanarina" of the owner's example</b>, which is an address no screen
	 * answers: the example names the page by its title, and the link has to be the page's own.
	 */
	public static final String MEMBERSHIP_PAGE = "/moja-clanarina";

	private WhatTheWelcomeSays() {
	}

	/** The six, by the letter of the example each one is. */
	public enum Letter {

		/** B: from Serbia, the slip and the code in the attachment. */
		WITH_A_SLIP("welcomeWithASlip"),

		/** C: from abroad, PayPal and no code. */
		WITH_PAYPAL("welcomeWithPayPal"),

		/** D: the Managing Board freed him of the fee for the season on sale. */
		FREED_OF_THE_FEE("welcomeFreedOfTheFee"),

		/** E: the season on sale is already his, taken out of his balance. */
		PAID_FROM_THE_BALANCE("welcomePaidFromTheBalance"),

		/** F: the season on sale is already his, on a payment recorded before he confirmed. */
		PAID("welcomePaid"),

		/** G: his balance covers the whole fee, and the membership has not been taken out of it. */
		THE_BALANCE_COVERS("welcomeTheBalanceCovers");

		private final String key;

		Letter(String key) {
			this.key = key;
		}

		public String key() {
			return key;
		}
	}

	/**
	 * WHICH LETTER, OR NONE, and the order of the questions is the order of the decisions.
	 *
	 * <ol>
	 * <li><b>A season he already holds is said by how he holds it</b>: freed (D), on his balance (E),
	 * on a payment (F). Nothing about money is asked of him then, because there is none to pay.
	 * <li><b>A fee of nought is said by nothing</b> (owner, 24.10.2026): a slip for 0,00 is not a slip.
	 * <li><b>Nor is anything said to a member who already has a number</b> (owner, 24.10.2026): every
	 * one of the letters that ask for money tells him he has none.
	 * <li><b>A balance that reaches the whole fee</b> is G, whatever his money: he lets himself in with
	 * one press and sends nothing.
	 * <li><b>And the rest is told how to pay, by his money</b>: dinars are Serbia and the slip (B), euro
	 * is everywhere else and PayPal (C), the pairing the page makes ({@code methodsFor}).
	 * </ol>
	 *
	 * @param holds               the basis of his membership of the season on sale, or {@code null}
	 *                            when he holds none
	 * @param feeIsNothing        the fee that applies to him is nought
	 * @param hasANumber          he already carries a member number
	 * @param coveredByTheBalance his balance reaches the whole fee today
	 * @param paysInEuro          his money is the euro, which is his country's answer
	 */
	public static Optional<Letter> which(Basis holds, boolean feeIsNothing, boolean hasANumber,
			boolean coveredByTheBalance, boolean paysInEuro) {

		if (holds != null) {
			return Optional.of(switch (holds) {
				case FEE_EXEMPT -> Letter.FREED_OF_THE_FEE;
				case BALANCE -> Letter.PAID_FROM_THE_BALANCE;
				case PAYMENT -> Letter.PAID;
			});
		}

		if (feeIsNothing || hasANumber) {
			return Optional.empty();
		}

		if (coveredByTheBalance) {
			return Optional.of(Letter.THE_BALANCE_COVERS);
		}

		return Optional.of(paysInEuro ? Letter.WITH_PAYPAL : Letter.WITH_A_SLIP);
	}

	/** The address of „Moja članarina" in the reader's language, built like every other link. */
	public static String membershipPage(Portal portal, MailLanguage in) {
		return portal.address() + in.prefix() + MEMBERSHIP_PAGE;
	}

	/**
	 * A LETTER THAT NAMES NOTHING BUT THE SEASON AND THE PAGE: D, E, F and G.
	 *
	 * @throws IllegalArgumentException for B and C, which carry the slip and are asked for by
	 *                                  {@link #withASlip} and {@link #withPayPal}
	 */
	public static Said about(Letter letter, MailLanguage in, int season, Portal portal) {
		if (letter == Letter.WITH_A_SLIP || letter == Letter.WITH_PAYPAL) {
			throw new IllegalArgumentException(letter + " carries a payment and is asked for with it");
		}

		return written(letter, in, String.valueOf(season), membershipPage(portal, in));
	}

	/** B, with the payee and the amount written out beside the code in the attachment. */
	public static Said withASlip(MailLanguage in, int season, String recipient, String account,
			String amount, String purpose, Portal portal) {
		return written(Letter.WITH_A_SLIP, in, String.valueOf(season), recipient, account, amount,
				purpose, membershipPage(portal, in));
	}

	/**
	 * C, with the PayPal address, the amount with the processing fee already in it, and whose the
	 * address is: „PayPal adresa je poslovna, na Sportsko udruženje BTL." (owner, 24.10.2026, PDL).
	 * The word for an account is in none of it, which is derived from his sentence of 22.10.2026.
	 */
	public static Said withPayPal(MailLanguage in, int season, String paypal, String amount,
			String recipient, Portal portal) {
		return written(Letter.WITH_PAYPAL, in, String.valueOf(season), paypal, amount,
				membershipPage(portal, in), recipient);
	}

	/** The first of the three lines under the code, „IPS QR kod za uplatu". */
	public static String caption(MailLanguage in) {
		return words(in).getString(Letter.WITH_A_SLIP.key() + ".caption");
	}

	/**
	 * AN AMOUNT AS A READER OF THAT LANGUAGE WRITES IT: „3.600,00 RSD" and „3,600.00 RSD".
	 *
	 * <p>Written here and not left to a {@link Locale}, for the reason {@code WhatTheMessageSays}
	 * gives about its own words: the machine the server runs on must not join in deciding what a
	 * member reads.
	 */
	public static String amount(BigDecimal amount, String currency, MailLanguage in) {
		DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.ROOT);
		boolean serbian = in == MailLanguage.SERBIAN;

		symbols.setGroupingSeparator(serbian ? '.' : ',');
		symbols.setDecimalSeparator(serbian ? ',' : '.');

		return new DecimalFormat("#,##0.00", symbols).format(amount.setScale(2, RoundingMode.UNNECESSARY))
				+ " " + currency;
	}

	private static Said written(Letter letter, MailLanguage in, Object... values) {
		ResourceBundle words = words(in);

		return new Said(
				new MessageFormat(words.getString(letter.key() + ".subject"), Locale.ROOT).format(values),
				new MessageFormat(words.getString(letter.key() + ".body"), Locale.ROOT).format(values));
	}

	/**
	 * THE WORDS OF ONE LANGUAGE, IN A DICTIONARY OF THEIR OWN: {@code mail/welcome} and
	 * {@code mail/welcome-en}, the shape {@code WhatAResultChangeSays} gives its own.
	 *
	 * <p>Not {@code mail/sr}: the floor over that one requires it to hold exactly the messages that
	 * carry a link, and the floor over this one requires exactly these six. One dictionary per floor.
	 * Package visible, and by this name, because {@code EveryMailIsAMandatoryOneTest} asks every class
	 * here for {@code words} and reads what comes back.
	 */
	static ResourceBundle words(MailLanguage in) {
		return ResourceBundle.getBundle(in == MailLanguage.ENGLISH ? "mail/welcome-en" : "mail/welcome",
				Locale.ROOT);
	}
}
