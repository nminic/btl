package com.btl.portal.domain.mail;

import java.text.MessageFormat;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;
import java.util.ResourceBundle;

/**
 * THE TWO MESSAGES THE PORTAL SENDS TO SOMEBODY WHO IS NOT SIGNED IN, and the
 * links in them.
 *
 * <p>Both carry a link and nothing else of value, and both links are the only
 * secret in the message: whoever holds one can confirm an address or set a
 * password. That is why the address they point at is built HERE, out of
 * {@link Portal}, and never out of anything that came in with a request.
 *
 * <p><b>A link built from the request is a way in, and it is worth naming.</b>
 * The obvious shortcut is to take the host off the incoming request and hang the
 * token on it. A request's host is written by whoever sent it, so somebody asking
 * the portal to reset a stranger's password, with a host of his own, would have
 * the portal mail that stranger a link to the attacker's machine. The stranger
 * clicks it, the token is his. {@link Portal} exists so that the address can only
 * come from configuration, and the one rule about it is written where it cannot
 * be missed rather than in a comment on a caller.
 *
 * <p><b>How long a link lasts is not typed into the message.</b> The text carries
 * a place for it and the number comes from {@link Message}, which
 * {@code HowLongALinkLastsMatchesTheSchemaTest} ties to the column default the
 * owner actually chose. So the message cannot come to say twenty four hours about
 * a link the schema ends in one.
 *
 * <p>The words themselves live in {@code mail/sr.properties} rather than here,
 * because they are the only Serbian the server says out loud and they are edited
 * by somebody reading them as prose, not as code.
 */
public final class WhatTheMessageSays {

	private static final String WORDS = "mail/sr";

	/**
	 * {@code Locale.ROOT} and not a Serbian one, deliberately.
	 *
	 * <p>There is one set of words and {@code mail/sr.properties} is it. Asking for
	 * a language would let the machine the server happens to run on pick, and the
	 * day somebody adds {@code mail/sr_RS.properties} for a reason that looks good
	 * at the time, half the members would get one text and half the other with
	 * nothing to say why. The file is named for the language it is in; the lookup
	 * is not a question.
	 */
	private static final Locale ONE_SET_OF_WORDS = Locale.ROOT;

	private WhatTheMessageSays() {
	}

	/**
	 * WHERE THE PORTAL LIVES, and the only place a link may be built from.
	 *
	 * <p>Held as its own type rather than as a {@code String} so that a method
	 * needing it cannot be handed a host somebody sent in. Whoever builds one of
	 * these is holding configuration, and that is a thing a reviewer can see at the
	 * one place it is constructed.
	 *
	 * @param address the portal's own address, with no trailing slash
	 */
	public record Portal(String address) {

		public Portal {
			Objects.requireNonNull(address, "address");

			/* https and nothing else: a link in a message is clicked out of a mail
			   client, so there is nobody to notice a downgrade, and the token is in
			   the address itself. */
			if (!address.startsWith("https://")) {
				throw new IllegalArgumentException("the portal is reached over https, and '"
						+ address + "' is not");
			}

			/* A trailing slash is not a style question here: it would make the link
			   carry two, and a mail client that shortens what it shows would hide
			   which of the two the path hangs off. */
			if (address.endsWith("/")) {
				throw new IllegalArgumentException("the portal's address ends in a slash: " + address);
			}

			if (address.chars().anyMatch(Character::isWhitespace)) {
				throw new IllegalArgumentException("the portal's address has a space in it: " + address);
			}
		}
	}

	/** What was said, ready to be handed to whatever sends it. */
	public record Said(String subject, String body) {
	}

	/**
	 * The two of them, each with the path it points at and how long it is good for.
	 *
	 * <p>The durations are the owner's, taken from the schema and not invented
	 * here: twenty four hours for confirming an address ([ODLUKA 08.09.2026], long
	 * enough that somebody opening his mail next morning still gets in) and one
	 * hour for a password link, which is the shorter because it is the one that
	 * hands over an account.
	 */
	public enum Message {

		CONFIRM_THE_ADDRESS("confirmTheAddress", "/potvrda-adrese", Duration.ofHours(24)),

		SET_A_NEW_PASSWORD("setANewPassword", "/nova-lozinka", Duration.ofHours(1));

		private final String key;

		private final String path;

		private final Duration lasts;

		Message(String key, String path, Duration lasts) {
			this.key = key;
			this.path = path;
			this.lasts = lasts;
		}

		/** What the words are filed under, and the floor over the bundle reads this. */
		public String key() {
			return key;
		}

		public String path() {
			return path;
		}

		/** How long the link is good for, and the schema is asked whether it agrees. */
		public Duration lasts() {
			return lasts;
		}
	}

	/**
	 * The message, with the link already in it.
	 *
	 * @param token the secret from the row, which is url safe by construction
	 *              ({@code SecretToken} writes base64 without padding)
	 */
	public static Said about(Message message, Portal portal, String token) {
		Objects.requireNonNull(message, "message");
		Objects.requireNonNull(portal, "portal");
		Objects.requireNonNull(token, "token");

		if (token.isBlank()) {
			throw new IllegalArgumentException("a message with no token in it is a message with no link");
		}

		ResourceBundle words = ResourceBundle.getBundle(WORDS, ONE_SET_OF_WORDS);
		String link = portal.address() + message.path() + "?token=" + token;

		return new Said(words.getString(message.key() + ".subject"),
				new MessageFormat(words.getString(message.key() + ".body"), ONE_SET_OF_WORDS)
						.format(new Object[] {link, howLong(message.lasts())}));
	}

	/**
	 * „1 sat", „2 sata", „24 sata", „5 sati".
	 *
	 * <p>Serbian agrees the noun with the last digit, and the teens are the
	 * exception that a rule written on the last digit alone gets wrong: eleven
	 * takes the same form as five, not the same as one.
	 */
	static String howLong(Duration lasts) {
		long hours = lasts.toHours();
		long last = hours % 10;
		long teens = hours % 100;

		if (last == 1 && teens != 11) {
			return hours + " sat";
		}

		if (last >= 2 && last <= 4 && (teens < 12 || teens > 14)) {
			return hours + " sata";
		}

		return hours + " sati";
	}
}
