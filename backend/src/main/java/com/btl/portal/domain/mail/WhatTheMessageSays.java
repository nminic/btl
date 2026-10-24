package com.btl.portal.domain.mail;

import java.text.MessageFormat;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;
import java.util.ResourceBundle;
import java.util.regex.Pattern;

/**
 * THE MESSAGES THE PORTAL SENDS TO SOMEBODY WHO IS NOT SIGNED IN, and the
 * links in them.
 *
 * <p>Each carries a link and nothing else of value, and the link is the only
 * secret in the message: whoever holds one can confirm an address or set a
 * password. That is why the address they point at is built HERE, out of
 * {@link Portal}, and never out of anything that came in with a request.
 *
 * <p><b>A link built from the request is a way in, and it is worth naming.</b>
 * The obvious shortcut is to take the host off the incoming request and hang the
 * token on it. A request's host is written by whoever sent it, so somebody asking
 * the portal to reset a stranger's password, with a host of his own, would have
 * the portal mail that stranger a link to the attacker's machine. The stranger
 * clicks it, the token is his.
 *
 * <p><b>AND WHAT {@link Portal} ACTUALLY DOES ABOUT THAT IS LESS THAN THIS USED
 * TO CLAIM.</b> It said the type made it so an address "can only come from
 * configuration". A security round on 12.09.2026 put that sentence to the test
 * and it did not hold: {@code new Portal("https://zlo.rs")} is accepted, as is
 * {@code https://balkanskatrkackaliga.net@zlo.rs}, whose real host is the second
 * one. No type can know where a string came from, and a comment that says
 * otherwise is worse than no comment, because the next reader builds on a wall
 * that is not there.
 *
 * <p>So what it does is written plainly instead. {@link Portal} refuses
 * everything that is not the shape of a portal address, which is a narrow shape
 * and is swept rather than listed. What it does NOT do is know which portal;
 * that belongs to whoever reads the address out of configuration and hands it on.
 *
 * <p><b>AND SINCE B58 THAT PLACE EXISTS AND IS ONE.</b> This said "until that bean
 * exists this is a boundary rather than a guard", and the boundary is closed:
 * {@code btl.portal.address} in {@code application.properties} is the only source,
 * and every constructor that reads it builds a {@code Portal} out of it at start up -
 * so an installation configured with an address of the wrong shape does not come up
 * at all, rather than sending links nobody can use. Nothing that arrives over the
 * wire can reach any of those constructors, which is the whole of what the paragraph
 * above is about.
 *
 * <p><b>"The only line" stopped being literally one line on B66</b>, when
 * {@code EmailConfirmationApi} and {@code PasswordResetApi} each gained a constructor
 * doing exactly what {@code RegistrationApi}'s already did. What did not change is the
 * property that sentence actually stood for - one source, refused at start up rather
 * than at a member's expense - and that is what is asserted here rather than a count
 * of call sites, which is exactly the kind of number a fourth sender would make stale
 * again for no reason.
 *
 * <p>The type still earns its place: an address can only enter through one
 * constructor, so there is exactly one line in the portal to look at, and a
 * method that needs a {@code Portal} cannot be quietly handed a {@code String}
 * somebody sent in.
 *
 * <p><b>How long a link lasts is not typed into the message.</b> The text carries
 * a place for it and the number comes from {@link Message}, which
 * {@code HowLongALinkLastsMatchesTheSchemaTest} ties to the column default the
 * owner actually chose. So the message cannot come to say twenty four hours about
 * a link the schema ends in one.
 *
 * <p>The words themselves live in {@code mail/sr.properties} and {@code mail/en.properties}
 * rather than here, because they are edited by somebody reading them as prose, not as code.
 *
 * <p><b>IN THE LANGUAGE THE READER CHOSE, EXCEPT FOR THE TWO INVITATIONS.</b> The owner, PDL P18,
 * 03.10.2026: the member chooses the language of his mail, Serbian unless he chooses otherwise
 * ({@link MailLanguage}). And on 10.10.2026, Q4, „Pozivnice (moderator, grupni unos): uvek
 * srpski." So each {@link Message} says which of the two it is, and there is one way to ask for
 * each: {@link #about(Message, MailLanguage, Portal, String)} for a message that follows its
 * reader, {@link #about(Message, Portal, String)} for one that is always Serbian, and each refuses
 * the other kind. A call site cannot hand an invitation a language, and cannot forget to hand
 * one to a message that needs it.
 */
public final class WhatTheMessageSays {

	/** Where the words of one language are: {@code mail/sr}, {@code mail/en}. */
	private static final String WORDS = "mail/";

	/**
	 * {@code Locale.ROOT} and not a Serbian or an English one, deliberately.
	 *
	 * <p>The LANGUAGE is chosen by naming its file, {@code mail/sr} or {@code mail/en}, and never
	 * by asking {@link ResourceBundle} for a locale. Asked for a locale, the machine the server
	 * happens to run on would join in the choosing, and the day somebody adds
	 * {@code mail/sr_RS.properties} for a reason that looks good at the time, half the members
	 * would get one text and half the other with nothing to say why. Each file is named for the
	 * language it is in; the lookup is not a question.
	 */
	private static final Locale ONE_SET_OF_WORDS = Locale.ROOT;

	/**
	 * The alphabet base64 uses when it is meant for addresses, and nothing else.
	 *
	 * <p>Letters, digits, and the two characters that replace {@code +} and
	 * {@code /} precisely so that a value can sit in an address without being
	 * encoded. No padding, because the token is written without it.
	 */
	private static final Pattern A_SECRET = Pattern.compile("^[A-Za-z0-9_-]+$");

	private WhatTheMessageSays() {
	}

	/**
	 * WHERE THE PORTAL LIVES, in the shape a portal address has.
	 *
	 * <p>Held as its own type rather than as a {@code String} so that a method
	 * needing it cannot be quietly handed one, and so that there is a single
	 * constructor to look at rather than a habit to remember.
	 *
	 * <p><b>What it enforces is the shape, and the shape only.</b> Which portal is
	 * not its question and it does not pretend otherwise; see the class comment.
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

			/* PRINTABLE ASCII AND NOTHING ELSE, and it replaced a check for whitespace
			   that a security round on 12.09.2026 walked straight past. That check asked
			   `Character.isWhitespace`, which says NO to U+00A0, U+2007 and U+202F by
			   specification and has never heard of U+200B or U+0085, so every one of
			   those went through - as did a NUL byte, and as did an address whose domain
			   was written in Cyrillic letters that look exactly like ours.

			   Listing those would have been the fourth wrong list. A web address is ASCII
			   by the standard that defines it, and anything outside that range has to be
			   percent encoded before it travels, so a rule drawn at that line has no next
			   character to be surprised by.

			   IT IS NOT THE STANDARD'S OWN SET, and a round on 12.09.2026 measured the
			   difference rather than letting this sentence stand as though it were. RFC
			   3986 also refuses several characters that ARE printable ASCII, among them
			   the backslash, the backtick and the double quote, and all of those are
			   accepted here. So this is a superset of what is legal, drawn where it is
			   because everything outside it is certainly wrong and nothing inside it can
			   be invisible. Which portal the address names is the question that would
			   catch the rest, and that one belongs to the bean reading configuration. */
			if (address.chars().anyMatch(one -> one < '!' || one > '~')) {
				throw new IllegalArgumentException(
						"the portal's address holds something that is not printable ASCII");
			}

			/* AND NOTHING BEFORE AN @, which is the trick the round found and the one
			   that reads as safe. In `https://balkanskatrkackaliga.net@zlo.rs` everything
			   before the @ is the userinfo field and the host is `zlo.rs`; a member
			   glancing at the link sees his own league at the front of it. */
			if (address.indexOf('@') >= 0) {
				throw new IllegalArgumentException("the portal's address carries an @, so its host"
						+ " is not what it reads as: " + address);
			}
		}
	}

	/** What was said, ready to be handed to whatever sends it. */
	public record Said(String subject, String body) {
	}

	/**
	 * Each of them, with the path it points at and how long it is good for.
	 *
	 * <p>The durations are the owner's, taken from the schema and not invented
	 * here: seven days for confirming an address (owner, 23.10.2026, PDL „Poruka posle
	 * potvrde adrese i rok nedovršene registracije": „Link za potvrdu adrese važi 7 dana",
	 * which overturned the twenty four hours of 08.09.2026) and one hour for a password
	 * link, which is the shorter because it is the one that hands over an account.
	 *
	 * <p><b>TWO OF THEM NOW POINT AT THE SAME PLACE, AND THAT IS A DECISION RATHER
	 * THAN A COLLISION.</b> „Nov moderator dobija pozivnicu na mejl, a lozinku
	 * postavlja sam... istim mehanizmom koji obnova lozinke vec nosi" (owner, PDL
	 * P28a, 18.09.2026), and ADL A53 of the same day says what „istim mehanizmom"
	 * costs and buys: „Pozivnica je isti put sa drugim povodom, i pise se kao JEDAN
	 * POVOD VISE, ne kao druga tabela i drugi razred." The road is
	 * {@code password_reset_token}, {@code PasswordReset} and the one screen that
	 * takes a token and sets a password; what is new is the OCCASION, and an
	 * occasion is exactly what this enum holds. So the invitation is a constant
	 * here and not a second machinery, and it shares
	 * {@link #SET_A_NEW_PASSWORD}'s path because it is meant to land on the very
	 * same screen.
	 *
	 * <p><b>What it may NOT share is its words</b>, and that is where the two
	 * occasions really differ: {@code setANewPassword} tells its reader that a
	 * request arrived and that his password has not changed and is still the one he
	 * knows. Both halves are false for a man who never asked and has no password,
	 * and the last paragraph of that text tells him in as many words to do nothing -
	 * which, sent as an invitation, is the portal instructing its new moderator to
	 * ignore the only way he has of getting in.
	 */
	public enum Message {

		CONFIRM_THE_ADDRESS("confirmTheAddress", "/potvrda-adrese", Duration.ofDays(7), true),

		SET_A_NEW_PASSWORD("setANewPassword", "/nova-lozinka", Duration.ofHours(1), true),

		/**
		 * The superadmin has made somebody a moderator and the portal is handing him
		 * the account, which is the same link with the other reason behind it.
		 *
		 * <p>One hour, the same as the link it travels by, because it IS that link:
		 * the row it is minted into is a {@code password_reset_token} and the column's
		 * own default is what ends it. A number written here that the schema did not
		 * give would be a message promising what the table does not do, which is the
		 * one thing {@code HowLongALinkLastsMatchesTheSchemaTest} exists to refuse.
		 */
		INVITED_AS_A_MODERATOR("invitedAsAModerator", "/nova-lozinka", Duration.ofHours(1), false),

		/**
		 * The administration has entered somebody into the league on a paper consent and
		 * the portal is handing him the account he will set a password on.
		 *
		 * <p>The owner, PDL P8b, 25.09.2026: the button that enters a member into the
		 * administration is „grupni unos koji salje pozivnice", which carries out what
		 * PDL of 31.07.2026 already decided - „Grupni unos stvara pozivnice, ne naloge.
		 * Svakom unetom stize poruka sa vezom na kojoj sam postavlja lozinku i time
		 * preuzima nalog."
		 *
		 * <p><b>SEVEN DAYS, „kao link za potvrdu", AND STILL THE SAME ROW AS THE OTHER TWO.</b>
		 * The owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije"):
		 * „Link pozivnice člana kog je upisala administracija važi 7 dana, kao link za potvrdu
		 * (ranije 1 sat)", and after those seven days the entry is deleted unless he has a payment
		 * or a number. That overturns the one hour of 25.09.2026 and keeps what that decision
		 * kept: no table of its own (ADL A53, „ne kao druga tabela i drugi razred"), and the
		 * column default this row shares with a forgotten password stays one hour, which is the
		 * number the owner chose for a password on 11.09.2026.
		 *
		 * <p><b>So the seven days are written onto the row when it is minted</b>
		 * ({@code web.AnInvitationOfAMember}) rather than taken from the column's default, and
		 * this number is where they are read from. {@code HowLongALinkLastsMatchesTheSchemaTest}
		 * ties it to the default of the CONFIRMATION's column, because „kao link za potvrdu" is
		 * the owner's own measure of it, and {@code AnInvitationLastsWhatItSaysTest} measures
		 * that the row both routes mint really lasts it.
		 */
		INVITED_AS_A_MEMBER("invitedAsAMember", "/nova-lozinka", Duration.ofDays(7), false);

		private final String key;

		private final String path;

		private final Duration lasts;

		private final boolean followsTheReader;

		Message(String key, String path, Duration lasts, boolean followsTheReader) {
			this.key = key;
			this.path = path;
			this.lasts = lasts;
			this.followsTheReader = followsTheReader;
		}

		/**
		 * Whether it is written in the language its reader chose, or always in Serbian.
		 *
		 * <p>False for the two invitations and for nothing else, which is the owner's answer of
		 * 10.10.2026, Q4 (A), „Pozivnice (moderator, grupni unos): uvek srpski", chosen over a
		 * field for the language on both forms. A man being invited has chosen nothing yet, and
		 * the moderator made out of an existing member is invited in Serbian as well, whatever he
		 * chose for his own mail.
		 */
		public boolean followsTheReader() {
			return followsTheReader;
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
	 * A MESSAGE THAT IS ALWAYS SERBIAN, which is the two invitations ({@link Message#followsTheReader}).
	 *
	 * @param token the secret from the row, which is url safe by construction
	 *              ({@code SecretToken} writes base64 without padding)
	 * @throws IllegalArgumentException for a message that follows its reader, which has to be
	 *                                  told whose language to speak and is not told it here
	 */
	public static Said about(Message message, Portal portal, String token) {
		Objects.requireNonNull(message, "message");

		if (message.followsTheReader()) {
			throw new IllegalArgumentException(message + " is written in its reader's language,"
					+ " so it is asked for with one");
		}

		return written(message, MailLanguage.SERBIAN, portal, token);
	}

	/**
	 * A MESSAGE IN ITS READER'S LANGUAGE, with the link already in it and leading to the page in
	 * that language.
	 *
	 * @param reader the language the account it goes to holds, read off the same row as the
	 *               address it goes to - never the language of whoever set it off
	 * @throws IllegalArgumentException for an invitation, which is always Serbian (owner,
	 *                                  10.10.2026, Q4) and must not be given a language to ignore
	 */
	public static Said about(Message message, MailLanguage reader, Portal portal, String token) {
		Objects.requireNonNull(message, "message");
		Objects.requireNonNull(reader, "reader");

		if (!message.followsTheReader()) {
			throw new IllegalArgumentException(message + " is always written in Serbian (owner,"
					+ " 10.10.2026), so it is not asked for in a language");
		}

		return written(message, reader, portal, token);
	}

	private static Said written(Message message, MailLanguage in, Portal portal, String token) {
		Objects.requireNonNull(portal, "portal");
		Objects.requireNonNull(token, "token");

		/* THE TOKEN IS CHECKED AND NOT ASSUMED, and this too came out of the round on
		   12.09.2026. It used to be enough that it was not blank, on the reasoning that
		   `SecretToken` writes base64 without padding and is therefore safe in an
		   address. That reasoning is about a class this one does not call and cannot
		   see: a token carrying `&` hangs another parameter on the link, one carrying
		   `#` cuts everything after it into a fragment the server never receives, and
		   one carrying a space or a newline breaks the link where a mail client folds
		   it. None of those is an attack today and every one of them is a member
		   holding a link that does not work, with nothing having said a word.

		   `WhatTheMessageSaysTest.everySecretTheTokenMakerWritesIsOneThisAccepts` keeps
		   this from being a second guess at somebody else's rule: it makes real tokens
		   and requires every one of them to pass here, so the day the generator changes,
		   this fails rather than the member's link. */
		if (!A_SECRET.matcher(token).matches()) {
			throw new IllegalArgumentException(
					"a message with no usable token in it is a message with no link");
		}

		ResourceBundle words = words(in);
		/* THE LANGUAGE GOES IN FRONT OF THE PATH, and the path itself stays the Serbian word it
		   has always been: the frontend's slugs are Serbian in every language (PDL P18, „Adrese
		   nose jezički prefiks za sve jezike"), so the English page that sets a password is
		   `/en/nova-lozinka` and not a translated address `postedAddresses.json` has never heard
		   of. */
		String link = portal.address() + in.prefix() + message.path() + "?token=" + token;

		return new Said(words.getString(message.key() + ".subject"),
				new MessageFormat(words.getString(message.key() + ".body"), ONE_SET_OF_WORDS)
						.format(new Object[] {link, howLong(message.lasts(), in)}));
	}

	/**
	 * The words of one language, named by its file. Package visible so the floor over the
	 * dictionaries reads the bundle this class reads and not a copy of its name.
	 */
	static ResourceBundle words(MailLanguage in) {
		return ResourceBundle.getBundle(WORDS + in.code(), ONE_SET_OF_WORDS);
	}

	/** How long a link lasts, in the words of the language it is told in. */
	static String howLong(Duration lasts, MailLanguage in) {
		if (in == MailLanguage.ENGLISH) {
			if (inWholeDays(lasts)) {
				return DAYS_IN_ENGLISH.get((int) lasts.toDays() - FIRST_DAY_IN_WORDS);
			}

			long hours = lasts.toHours();

			return hours + (hours == 1 ? " hour" : " hours");
		}

		return howLong(lasts);
	}

	/**
	 * „SEDAM DANA", IN WORDS, AND NOT „168 SATI".
	 *
	 * <p>The owner's text for the confirmation (PDL 23.10.2026, example A) says „Link važi sedam
	 * dana" and „za sedam dana neće ostati ni traga od nje", and the invitation's sentence of
	 * 24.10.2026 says „Link važi sedam dana". The number still comes from {@link Message#lasts}
	 * and never from the dictionary, so a link the schema ends sooner cannot be promised for a
	 * week; only the way a whole number of days is said is written here.
	 *
	 * <p><b>From two days and no sooner</b>: a link of a day has always been said in hours, „24
	 * sata", and stays so. <b>And as far as a week and no further</b>, which is as far as any link of
	 * the portal lasts. A duration of whole days beyond that is refused rather than spoken in
	 * figures, and {@code WhatTheMessageSaysTest.howLongTheLinkLastsReachesTheMember} asks every
	 * {@link Message} in both languages, so a link that one day lasts eight days fails there and
	 * not in a member's mailbox.
	 */
	private static final java.util.List<String> DAYS_IN_SERBIAN = java.util.List.of("dva dana",
			"tri dana", "četiri dana", "pet dana", "šest dana", "sedam dana");

	private static final java.util.List<String> DAYS_IN_ENGLISH = java.util.List.of("two days",
			"three days", "four days", "five days", "six days", "seven days");

	/** The first number of days said in words, and the place of each in the two lists above. */
	private static final int FIRST_DAY_IN_WORDS = 2;

	private static boolean inWholeDays(Duration lasts) {
		if (lasts.toHours() < FIRST_DAY_IN_WORDS * 24 || lasts.toHours() % 24 != 0) {
			return false;
		}

		if (lasts.toDays() >= FIRST_DAY_IN_WORDS + DAYS_IN_SERBIAN.size()) {
			throw new IllegalArgumentException(lasts.toDays() + " days is longer than any link"
					+ " the portal has words for");
		}

		return true;
	}

	/**
	 * „1 sat", „2 sata", „5 sati", and a whole number of days in words: „sedam dana".
	 *
	 * <p>Serbian agrees the noun with the last digit, and the teens are the
	 * exception that a rule written on the last digit alone gets wrong: eleven
	 * takes the same form as five, not the same as one.
	 */
	static String howLong(Duration lasts) {
		if (inWholeDays(lasts)) {
			return DAYS_IN_SERBIAN.get((int) lasts.toDays() - FIRST_DAY_IN_WORDS);
		}

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
