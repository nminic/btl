package com.btl.portal.domain.mail;

import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.ResourceBundle;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** What the messages say, in each language they are written in, and that the words behind them
 *  are all there. */
class WhatTheMessageSaysTest {

	private static final Portal PORTAL = new Portal("https://balkanskatrkackaliga.net");

	private static final String TOKEN = "AbCd-EfGh_1234";

	/**
	 * One message in one language, asked for the only way the class lets it be asked for: a message
	 * that follows its reader with his language, an invitation without one, and then always in
	 * Serbian whatever {@code in} says.
	 */
	private static Said said(Message message, MailLanguage in) {
		if (message.saysWhenItEnds()) {
			return WhatTheMessageSays.about(message, in, PORTAL, TOKEN, THE_LINK_ENDS, Gender.MAN);
		}

		return message.followsTheReader() ? WhatTheMessageSays.about(message, in, PORTAL, TOKEN)
				: WhatTheMessageSays.about(message, PORTAL, TOKEN, Gender.MAN);
	}

	/** 12:00 UTC, which is 13:00 in Belgrade in December, on a day that is neither today nor any
	 *  day a case could mistake for it. */
	private static final Instant THE_LINK_ENDS = Instant.parse("2026-12-17T12:00:00Z");

	/** The languages a message is really written in: both for one that follows its reader,
	 *  Serbian alone for an invitation. */
	private static List<MailLanguage> languagesOf(Message message) {
		return message.followsTheReader() ? List.of(MailLanguage.values())
				: List.of(MailLanguage.SERBIAN);
	}

	/**
	 * THE LINK IS BUILT FROM THE PORTAL AND FROM NOTHING ELSE.
	 *
	 * <p>Asserted as a whole address rather than as "contains the token", because
	 * containing it is also true of an address pointing somewhere else entirely,
	 * which is the very thing this class exists to make impossible.
	 */
	@ParameterizedTest
	@EnumSource(Message.class)
	void everyMessageCarriesOneLinkAndItIsOurs(Message message) {
		for (MailLanguage in : languagesOf(message)) {
			Said said = said(message, in);

			assertThat(said.body())
					.as("%s in %s did not carry the link it exists to carry", message, in)
					.contains(PORTAL.address() + in.prefix() + message.path() + "?token=" + TOKEN);
			assertThat(said.subject()).isNotBlank();
		}
	}

	/**
	 * THE INVITATION OF A MEMBER SAYS WHAT HAPPENS AFTER A WEEK, IN THE OWNER'S SENTENCE.
	 *
	 * <p>PDL, 24.10.2026, „Pozivnica člana kog upiše administracija dobija rečenicu": it replaced
	 * the one that sent him to „Zaboravljena lozinka", because after seven days with no password his
	 * entry is deleted and a link from the sign-in page is no longer a way in. Asserted as the whole
	 * sentence the owner wrote, rendered: the seven days in it come from {@link Message#lasts}.
	 */
	@Test
	void theInvitationOfAMemberSaysWhatHappensAfterAWeekInTheOwnersSentence() {
		assertThat(WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, PORTAL, TOKEN, Gender.MAN).body())
				.contains("Link važi sedam dana i može da se upotrebi jednom. Ako ga za to vreme ne otvoriš,"
						+ " tvoj upis se briše, osim ako je članarina već evidentirana; u tom slučaju piši na"
						+ " info@balkanskatrkackaliga.net i poslaćemo ti novi.")
				.doesNotContain("Zaboravljena lozinka");
	}

	@Test
	void theMailsSayExactlyWhatTheyWereDecidedToSay() {
		String tail = "Balkanska trkačka liga";

		assertThat(WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.SERBIAN, PORTAL,
				TOKEN, THE_LINK_ENDS, Gender.MAN).body()).isEqualTo(String.join("\n",
				"Dobrodošao u Balkansku trkačku ligu.",
				"",
				"Adresu potvrđuješ otvaranjem ovog linka:",
				linkOf(Message.CONFIRM_THE_ADDRESS, MailLanguage.SERBIAN),
				"",
				"Link važi do 17.12.2026. 13:00. Posle toga se nepotvrđena prijava briše, a sa ove adrese možeš da se"
						+ " registruješ ponovo.",
				"",
				"Ako se nisi registrovao kod nas, zanemari ovu poruku.",
				"",
				tail));

		assertThat(WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, MailLanguage.SERBIAN, PORTAL,
				TOKEN).body()).isEqualTo(String.join("\n",
				"Stigao nam je zahtev da postaviš novu lozinku za svoj nalog.",
				"",
				"Otvori ovaj link i upiši je:",
				linkOf(Message.SET_A_NEW_PASSWORD, MailLanguage.SERBIAN),
				"",
				"Link važi 1 sat i može da se upotrebi jednom.",
				"",
				"Ako zahtev nije stigao od tebe, zanemari ovu poruku.",
				"",
				tail));

		assertThat(WhatTheMessageSays.about(Message.INVITED_AS_A_MODERATOR, PORTAL, TOKEN).body())
				.isEqualTo(String.join("\n",
				"Superadmin ti je otvorio nalog moderatora na portalu Balkanske trkačke lige.",
				"",
				"Nalog još nema lozinku. Otvori ovaj link i postavi je:",
				linkOf(Message.INVITED_AS_A_MODERATOR, MailLanguage.SERBIAN),
				"",
				"Link važi 1 sat i može da se upotrebi jednom.",
				"",
				"Ako link istekne, zatraži novi sa strane za prijavu.",
				"",
				tail));

		assertThat(WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, PORTAL, TOKEN, Gender.MAN).body())
				.isEqualTo(String.join("\n",
				"Upisali smo te u Balkansku trkačku ligu na osnovu saglasnosti koju si potpisao.",
				"",
				"Tvoj nalog postoji, ali još nema lozinku. Otvori ovaj link i postavi je sam:",
				linkOf(Message.INVITED_AS_A_MEMBER, MailLanguage.SERBIAN),
				"",
				"Link važi sedam dana i može da se upotrebi jednom. Ako ga za to vreme ne otvoriš, tvoj upis"
						+ " se briše, osim ako je članarina već evidentirana; u tom slučaju piši na"
						+ " info@balkanskatrkackaliga.net i poslaćemo ti novi.",
				"",
				tail));

		assertThat(WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.ENGLISH, PORTAL,
				TOKEN, THE_LINK_ENDS, Gender.MAN).body()).isEqualTo(String.join("\n",
				"Welcome to BTL.",
				"",
				"You confirm the address by opening this link:",
				linkOf(Message.CONFIRM_THE_ADDRESS, MailLanguage.ENGLISH),
				"",
				"The link is valid until 17 December 2026 at 13:00. After that the unconfirmed registration is deleted, and you"
						+ " can register again from this address.",
				"",
				"If you did not register with us, ignore this message.",
				"",
				tail));

		assertThat(WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, MailLanguage.ENGLISH, PORTAL,
				TOKEN).body()).isEqualTo(String.join("\n",
				"We have received a request to set a new password for your account.",
				"",
				"Open this link and enter it:",
				linkOf(Message.SET_A_NEW_PASSWORD, MailLanguage.ENGLISH),
				"",
				"The link is valid for 1 hour and can be used once.",
				"",
				"If you did not ask for a new password, ignore this message.",
				"",
				tail));
	}

	/** The address a mail carries, as the class builds it and as the case above fills it in. */
	private static String linkOf(Message message, MailLanguage in) {
		return PORTAL.address() + in.prefix() + message.path() + "?token=" + TOKEN;
	}

	/**
	 * A LETTER IN ENGLISH LEADS TO THE ENGLISH PAGE, AND A SERBIAN ONE TO THE ADDRESS IT HAS ALWAYS
	 * LED TO.
	 *
	 * <p>The owner's answer of 10.10.2026, Q2 (B), „Veza u engleskom mejlu … nosi {@code /en/}". Asked
	 * as the whole address on both sides, because „contains {@code /en}" is also true of a Serbian
	 * link that grew one, and the Serbian half is every link already in somebody's mailbox: it must
	 * not move. And in words, not only in the link: an English letter whose link was right and whose
	 * text was Serbian would pass the first assertion.
	 */
	@Test
	void anEnglishLetterLeadsToTheEnglishPageAndASerbianOneWhereItAlwaysLed() {
		Said english = WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, MailLanguage.ENGLISH,
				PORTAL, TOKEN);
		Said serbian = WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, MailLanguage.SERBIAN,
				PORTAL, TOKEN);

		assertThat(english.body())
				.contains("https://balkanskatrkackaliga.net/en/nova-lozinka?token=" + TOKEN)
				.contains("1 hour")
				.contains("Balkanska trkačka liga")
				.doesNotContain("lozinku");
		assertThat(serbian.body())
				.contains("https://balkanskatrkackaliga.net/nova-lozinka?token=" + TOKEN)
				.doesNotContain("/en/")
				.contains("1 sat");
		assertThat(english.subject()).isNotEqualTo(serbian.subject());
	}

	/**
	 * AN INVITATION IS ALWAYS SERBIAN AND CANNOT BE ASKED FOR IN A LANGUAGE, AND A MESSAGE THAT
	 * FOLLOWS ITS READER CANNOT BE ASKED FOR WITHOUT ONE.
	 *
	 * <p>The owner's answer of 10.10.2026, Q4 (A): „Pozivnice (moderator, grupni unos): uvek srpski."
	 * Refused rather than quietly answered in Serbian, so a call site that read somebody's language
	 * and handed it to an invitation fails where it is written rather than looking as if it worked.
	 * And the other way, so a letter that needs its reader's language cannot be sent in Serbian by a
	 * call site that forgot to read it.
	 */
	@Test
	void anInvitationIsAlwaysSerbianAndALetterThatFollowsItsReaderIsToldWhich() {
		assertThat(Arrays.stream(Message.values()).filter(one -> !one.followsTheReader()).toList())
				.as("the two invitations, and only they, are always Serbian")
				.containsExactlyInAnyOrder(Message.INVITED_AS_A_MODERATOR, Message.INVITED_AS_A_MEMBER);

		for (Message invitation : List.of(Message.INVITED_AS_A_MODERATOR, Message.INVITED_AS_A_MEMBER)) {
			for (MailLanguage in : MailLanguage.values()) {
				assertThatThrownBy(() -> WhatTheMessageSays.about(invitation, in, PORTAL, TOKEN))
						.as("%s was asked for in %s and not refused", invitation, in)
						.isInstanceOf(IllegalArgumentException.class)
						.hasMessageContaining("always written in Serbian");
			}

			assertThat(WhatTheMessageSays.about(invitation, PORTAL, TOKEN, Gender.MAN).body())
					.as("%s did not lead to the Serbian page", invitation)
					.contains(PORTAL.address() + invitation.path() + "?token=");
		}

		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, PORTAL, TOKEN))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("its reader's language");
	}

	/**
	 * AND NO TWO MESSAGES ARE THE SAME MESSAGE.
	 *
	 * <p>Two kinds answered with one text would pass every case above, so the
	 * subjects and the bodies are required to differ. The day a fourth message is
	 * added, this counts it in without being edited.
	 *
	 * <p><b>THE BODIES AND NOT ONLY THE SUBJECTS, which is the half that was missing
	 * and is now the whole of the claim.</b> Two messages can be given two headings
	 * over one text, and what a member acts on is the text; asked of subjects alone
	 * this passes while every reader of either message is being told the same thing.
	 *
	 * <p><b>AND THE PATHS ARE NO LONGER ASKED ABOUT HERE AT ALL, which is a move and not
	 * a rule given up - the first draft of this change got that wrong and said so.</b>
	 * „No two messages point at the same place" was true until 18.09.2026 and only because
	 * every message was its own road; „istim mehanizmom koji obnova lozinke vec nosi"
	 * (owner, PDL P28a, 18.09.2026) makes the invitation land on the reset's own screen ON
	 * PURPOSE, so that rule had become a rule against a decision.
	 *
	 * <p><b>But what it caught is real and had to go somewhere, and for one round it went
	 * nowhere.</b> Give {@link Message#SET_A_NEW_PASSWORD} the path {@code /potvrda-adrese}
	 * and every password link the portal mails lands on the screen that confirms an
	 * address; measured 19.09.2026, that passes the whole gate. The question now stands in
	 * {@code HowLongALinkLastsMatchesTheSchemaTest}, where the fact it needs already lives:
	 * two messages share a screen exactly when their links share a row, because a screen is
	 * the thing that spends a token.
	 *
	 * <p><b>What is left here about a path is a claim about the LINK BUILDER and nothing
	 * else</b>, and it is not a substitute for the sentence above: the path is appended to
	 * the portal's address and the token is hung on it as the first parameter, so a path
	 * that began without a slash would fuse with the host and one already carrying a
	 * {@code ?} would produce a link with two. It says nothing whatever about which screen
	 * a message is aimed at.
	 */
	@Test
	void noTwoMessagesSayTheSameThing() {
		for (MailLanguage in : MailLanguage.values()) {
			List<Message> written = Stream.of(Message.values())
					.filter(one -> languagesOf(one).contains(in)).toList();

			assertThat(written.stream().map(one -> said(one, in).subject())
					.collect(Collectors.toSet()))
					.as("two messages share a subject in %s, so one of them is not being looked at", in)
					.hasSize(written.size());

			assertThat(written.stream().map(one -> said(one, in).body())
					.collect(Collectors.toSet()))
					.as("two messages share their whole text in %s, so one of them is not being written",
							in)
					.hasSize(written.size());
		}

		for (Message message : Message.values()) {
			assertThat(message.path())
					.as("%s points at something that is not a path of this portal at all", message)
					.startsWith("/")
					.doesNotContain("?");
		}
	}

	/**
	 * HOW LONG IT LASTS IS SAID IN THE MESSAGE, in words that agree with the number.
	 *
	 * <p>Serbian agrees the noun with the last digit and the teens are the
	 * exception, so the cases are chosen at the places the rule turns: one, the
	 * twos through fours, the fives, and the teens that look like each of them.
	 */
	@Test
	void theHoursAreSpokenTheWaySerbianSpeaksThem() {
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(1))).isEqualTo("1 sat");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(2))).isEqualTo("2 sata");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(4))).isEqualTo("4 sata");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(5))).isEqualTo("5 sati");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(11)))
				.as("eleven took the form of one, which is the mistake a rule on the last digit makes")
				.isEqualTo("11 sati");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(12))).isEqualTo("12 sati");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(14))).isEqualTo("14 sati");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(21))).isEqualTo("21 sat");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(24))).isEqualTo("24 sata");
	}

	/**
	 * A WEEK IS „SEDAM DANA", IN WORDS, as the owner's texts of 23.10.2026 and 24.10.2026 say it; a
	 * day is still said in hours; and a link longer than any the portal has is refused rather than
	 * said in figures.
	 */
	@Test
	void wholeDaysFromTwoToSevenAreSpokenInWords() {
		assertThat(WhatTheMessageSays.howLong(Duration.ofDays(7))).isEqualTo("sedam dana");
		assertThat(WhatTheMessageSays.howLong(Duration.ofDays(7), MailLanguage.ENGLISH)).isEqualTo("seven days");
		assertThat(WhatTheMessageSays.howLong(Duration.ofDays(2))).isEqualTo("dva dana");
		assertThat(WhatTheMessageSays.howLong(Duration.ofDays(2), MailLanguage.ENGLISH)).isEqualTo("two days");
		assertThat(WhatTheMessageSays.howLong(Duration.ofDays(5))).isEqualTo("pet dana");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(36))).isEqualTo("36 sati");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(36), MailLanguage.ENGLISH)).isEqualTo("36 hours");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(50)))
				.as("fifty hours are not a whole number of days and are said in hours")
				.isEqualTo("50 sati");
		assertThatThrownBy(() -> WhatTheMessageSays.howLong(Duration.ofDays(8)))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> WhatTheMessageSays.howLong(Duration.ofDays(8), MailLanguage.ENGLISH))
				.isInstanceOf(IllegalArgumentException.class);
	}

	/** And in English, where one is singular and every other number is not. */
	@Test
	void theHoursAreSpokenTheWayEnglishSpeaksThem() {
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(1), MailLanguage.ENGLISH))
				.isEqualTo("1 hour");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(24), MailLanguage.ENGLISH))
				.isEqualTo("24 hours");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(21), MailLanguage.ENGLISH))
				.as("twenty one hours took the Serbian rule's singular")
				.isEqualTo("21 hours");
		assertThat(WhatTheMessageSays.howLong(Duration.ofHours(21), MailLanguage.SERBIAN))
				.isEqualTo("21 sat");
	}

	/** And what the class works out is what the member reads. */
	@ParameterizedTest
	@EnumSource(Message.class)
	void howLongTheLinkLastsReachesTheMember(Message message) {
		for (MailLanguage in : languagesOf(message)) {
			/* THE MESSAGE THAT SAYS WHEN ITS LINK ENDS says the moment it was handed, not a length. */
			String whatItSays = message.saysWhenItEnds()
					? WhatANoticeSays.moment(THE_LINK_ENDS, in)
					: WhatTheMessageSays.howLong(message.lasts(), in);

			assertThat(said(message, in).body())
					.as("%s in %s never told the member how long he has", message, in)
					.contains(whatItSays);
		}
	}

	/**
	 * AN ADDRESS THAT IS NOT THE SHAPE OF A PORTAL ADDRESS IS REFUSED WHERE IT IS
	 * TAKEN IN.
	 *
	 * <p>Plain http because the token travels in the address itself; a trailing
	 * slash because it would put two in the link; a space and a folded header
	 * because that is what a host taken off a request looks like when it arrives.
	 *
	 * <p><b>And the last two are the ones a security round on 12.09.2026 walked
	 * through.</b> A NUL byte and a zero width space both passed the check that
	 * used to be here, which asked {@code Character.isWhitespace} - a question that
	 * says no to U+00A0 by specification and has never heard of U+200B. The userinfo
	 * one is the one that reads as safe: in
	 * {@code https://balkanskatrkackaliga.net@zlo.rs} the real host is the second
	 * name, and a member glancing at the link sees his own league at the front.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"http://balkanskatrkackaliga.net", "balkanskatrkackaliga.net",
			"https://balkanskatrkackaliga.net/", "https://zlo.rs evil", "https://a.rs\nHost: zlo.rs",
			/* NUL, zero width space, no break space: all three written as escapes,
			   because typed in they are invisible and the next reader cannot tell
			   which is which. */
			"https://a.rs\u0000", "https://a.rs\u200B", "https://a.rs\u00A0",
			"https://balkanskatrkackaliga.net@zlo.rs", "https://\u0431alkanskatrkackaliga.net"})
	void anAddressThatIsNotThePortalIsRefused(String notThePortal) {
		assertThatThrownBy(() -> new Portal(notThePortal))
				.as("'%s' was taken for the portal's own address", notThePortal)
				.isInstanceOf(IllegalArgumentException.class);
	}

	/**
	 * AND THAT IS A SWEEP AND NOT A LIST, because the list was wrong four times.
	 *
	 * <p>The check that stood here asked {@code Character.isWhitespace} and let
	 * through U+00A0, U+2007, U+202F, U+200B, U+0085 and a NUL byte, none of which
	 * anybody had thought of. Adding the six would have been the fifth list. So
	 * every character the basic plane holds is put to it, and the rule the class
	 * settled on - printable ASCII, which is what the standard defining web
	 * addresses allows - has nothing left to be surprised by.
	 */
	@Test
	void nothingOutsidePrintableAsciiGetsIntoAPortalAddress() {
		List<String> accepted = new ArrayList<>();
		int asked = 0;

		for (int one = 0; one <= 0xFFFF; one++) {
			if (one >= '!' && one <= '~') {
				continue;
			}

			asked++;
			try {
				new Portal("https://a.rs/b" + new String(Character.toChars(one)));
				accepted.add(String.format("U+%04X", one));
			} catch (RuntimeException refused) {
				/* Which is the whole of what this case wants. */
			}
		}

		assertThat(asked)
				.as("hardly any character was put to it, so this sweep compares nothing")
				.isGreaterThan(60_000);
		assertThat(accepted)
				.as("these got into a portal address, and a member cannot see any of them")
				.isEmpty();
	}

	/**
	 * EVERY SECRET THE TOKEN MAKER WRITES IS ONE THIS ACCEPTS.
	 *
	 * <p>The class refuses a token that is not base64 for addresses, and that rule
	 * is a second copy of one {@code SecretToken} already keeps. Written as two
	 * patterns compared by eye they would drift; so real tokens are made and every
	 * one of them has to pass, which means the day the generator changes its
	 * alphabet this case fails rather than a member's link.
	 *
	 * <p>Enough of them that the alphabet is actually covered: thirty two bytes of
	 * randomness each, so a few hundred draws touch every character base64 has.
	 */
	@Test
	void everySecretTheTokenMakerWritesIsOneThisAccepts() {
		Set<Character> seen = new TreeSet<>();

		for (int draw = 0; draw < 500; draw++) {
			String secret = SecretToken.fresh().secret();
			secret.chars().forEach(one -> seen.add((char) one));

			assertThat(WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, MailLanguage.SERBIAN, PORTAL,
					secret).body())
					.as("a token the portal itself made was refused: %s", secret)
					.contains(secret);
		}

		/* THE WHOLE ALPHABET AND NOT NEARLY ALL OF IT. This said "more than sixty"
		   until a round on 12.09.2026 pointed out that sixty one passes it, so the
		   comment above promised every character while the assertion allowed three to
		   be missing - and three missing is exactly what a generator quietly narrowing
		   its alphabet would look like. Five hundred draws of forty three characters
		   each miss one of sixty four with a probability too small to write down. */
		assertThat(seen)
				.as("the draws did not cover the whole alphabet, so this proves less than it says")
				.hasSize(64);
	}

	@Test
	void aMessageThatSaysWhenItEndsIsNeverAskedForWithoutTheMomentAndTheOthersNeverWithOne() {
		/* THE CONFIRMATION IS THE ONE THAT SAYS A MOMENT (PDL 24.10.2026, „Rok nepotvrđene prijave"): asked
		   for with nothing, it would print a length that is true of the first letter and not of the
		   one asked for on the tenth day. */
		assertThat(Arrays.stream(Message.values()).filter(Message::saysWhenItEnds))
				.containsExactly(Message.CONFIRM_THE_ADDRESS);
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.SERBIAN,
				PORTAL, TOKEN)).isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("says the moment its link ends");

		/* AND A MESSAGE THAT SAYS A LENGTH IS NOT HANDED A MOMENT it would have no place for. */
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, MailLanguage.SERBIAN,
				PORTAL, TOKEN, THE_LINK_ENDS, Gender.MAN)).isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("says how long its link lasts");
	}

	@Test
	void nothingMissingIsQuietlyAccepted() {
		assertThatThrownBy(() -> new Portal(null))
				.isInstanceOf(NullPointerException.class).hasMessage("address");
		assertThatThrownBy(() -> WhatTheMessageSays.about(null, PORTAL, TOKEN))
				.isInstanceOf(NullPointerException.class).hasMessage("message");
		assertThatThrownBy(() -> WhatTheMessageSays.about(null, MailLanguage.SERBIAN, PORTAL, TOKEN))
				.isInstanceOf(NullPointerException.class).hasMessage("message");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, null, PORTAL,
				TOKEN)).isInstanceOf(NullPointerException.class).hasMessage("reader");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS,
				MailLanguage.SERBIAN, null, TOKEN, THE_LINK_ENDS, Gender.MAN))
				.isInstanceOf(NullPointerException.class).hasMessage("portal");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS,
				MailLanguage.SERBIAN, PORTAL, TOKEN, null, Gender.MAN))
				.isInstanceOf(NullPointerException.class).hasMessage("endsAt");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, null, TOKEN, Gender.MAN))
				.isInstanceOf(NullPointerException.class).hasMessage("portal");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS,
				MailLanguage.SERBIAN, PORTAL, null, THE_LINK_ENDS, Gender.MAN))
				.isInstanceOf(NullPointerException.class).hasMessage("token");
	}

	/**
	 * A MESSAGE WITH NO TOKEN IS A MESSAGE WITH NO LINK, and is refused rather
	 * than sent.
	 *
	 * <p>Blank as well as empty: whatever produced it, a member who gets an address
	 * ending in {@code ?token=} has been sent a dead end, and the only thing worse
	 * than not sending it is sending it.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "   "})
	void aMessageWithNoTokenIsNotSent(String nothing) {
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD,
				MailLanguage.SERBIAN, PORTAL, nothing))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("no link");
	}

	/**
	 * AND A TOKEN THAT WOULD BREAK THE LINK IS NOT SENT EITHER.
	 *
	 * <p>Each of these does something different and quiet to the address it lands
	 * in: {@code &} hangs another parameter on it, {@code #} cuts everything after
	 * it into a fragment the server never receives, {@code =} and a space and a
	 * newline break it where a mail client folds it, and {@code %} makes the rest
	 * an encoding the reader has to guess at. None of them is an attack and every
	 * one of them is a member holding a link that does not work.
	 *
	 * <p>Until 12.09.2026 the only question asked was whether the token was blank,
	 * on the reasoning that the maker writes base64 for addresses. That reasoning is
	 * about a class this one does not call and cannot see.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"abc&admin=true", "abc#vrh", "abc def", "abc\nx", "abc%20", "abc=", "abc/d"})
	void aTokenThatWouldBreakTheLinkIsNotSent(String broken) {
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD,
				MailLanguage.ENGLISH, PORTAL, broken))
				.as("'%s' was written into a link and sent to somebody", broken)
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("no link");
	}

	/**
	 * THE WORDS BEHIND EVERY MESSAGE ARE THERE, AND THERE ARE NO OTHERS.
	 *
	 * <p>Both directions, because they fail differently. A message with no words
	 * behind it throws when somebody tries to send it, which is the worst possible
	 * moment; a set of words nothing sends is a text somebody will edit believing
	 * a member reads it.
	 *
	 * <p>Neither side is typed out here: the keys come off the enum and the rest
	 * comes off the bundle itself.
	 *
	 * <p><b>ONE DICTIONARY PER LANGUAGE, EACH EXACT OVER ITS OWN SET.</b> Serbian holds every
	 * message; English holds exactly the ones that follow their reader, so an invitation written
	 * into it fails here (owner, 10.10.2026, Q4: always Serbian) and so does a message that follows
	 * its reader and has no English words. The languages come off {@link MailLanguage}, so a third
	 * one is a dictionary this asks for on the day it is named.
	 */
	@Test
	void everyMessageHasItsWordsAndEveryWordHasItsMessage() {
		for (MailLanguage in : MailLanguage.values()) {
			ResourceBundle words = WhatTheMessageSays.words(in);
			List<Message> writtenIn = Arrays.stream(Message.values())
					.filter(one -> languagesOf(one).contains(in)).toList();

			Set<String> expected = writtenIn.stream()
					.flatMap(one -> Stream.of(one.key() + ".subject", one.key() + ".body"))
					.collect(Collectors.toSet());

			assertThat(words.keySet())
					.as("the words in %s and the messages written in it no longer name the same things", in)
					.isEqualTo(expected);

			for (Message message : writtenIn) {
				assertThat(words.getString(message.key() + ".body"))
						.as("%s in %s has nowhere to put the link and how long it lasts", message, in)
						.contains("{0}")
						.contains("{1}");
			}
		}

		assertThat(WhatTheMessageSays.words(MailLanguage.SERBIAN).getString("confirmTheAddress.subject"))
				.as("the Serbian dictionary is not the one under mail/sr")
				.isEqualTo(ResourceBundle.getBundle("mail/sr", Locale.ROOT)
						.getString("confirmTheAddress.subject"));
	}

	/**
	 * THE SEX OF WHO READS PICKS THE PARTICIPLE (owner, 21.11.2026: „po polu primaoca"), and the dictionary
	 * of the words a woman reads is held from the other side too: it holds exactly the keys that carry a
	 * participle, every one a key of {@code mail/sr} with the same holes and other words.
	 */
	@Test
	void theWordsAWomanReadsAreThreeOfTheMasculineKeysWithTheSameHolesAndOtherWords() {
		ResourceBundle man = WhatTheMessageSays.words(MailLanguage.SERBIAN);
		ResourceBundle woman = WhatTheMessageSays.wordsForAWoman(MailLanguage.SERBIAN);

		assertThat(woman.keySet()).containsExactlyInAnyOrder("confirmTheAddress.body", "invitedAsAMember.subject",
				"invitedAsAMember.body");

		for (String key : woman.keySet()) {
			assertThat(man.containsKey(key)).as(key).isTrue();
			assertThat(woman.getString(key)).as(key).isNotEqualTo(man.getString(key));
			assertThat(new java.text.MessageFormat(woman.getString(key), java.util.Locale.ROOT)
					.getFormatsByArgumentIndex().length).as("holes of %s", key)
					.isEqualTo(new java.text.MessageFormat(man.getString(key), java.util.Locale.ROOT)
							.getFormatsByArgumentIndex().length);
		}

		assertThat(WhatTheMessageSays.wordsForAWoman(MailLanguage.ENGLISH)).isNull();
	}

	@Test
	void aWomanReadsTheFeminineAndAManTheMasculineInTheTwoMessagesThatHaveBoth() {
		String confirmedByHer = WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.SERBIAN, PORTAL,
				TOKEN, THE_LINK_ENDS, Gender.WOMAN).body();
		String confirmedByHim = WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.SERBIAN, PORTAL,
				TOKEN, THE_LINK_ENDS, Gender.MAN).body();

		assertThat(confirmedByHer).startsWith("Dobrodošla u Balkansku").contains("se nisi registrovala")
				.doesNotContain("registrovao").doesNotContain("Dobrodošao");
		assertThat(confirmedByHim).startsWith("Dobrodošao u Balkansku").contains("se nisi registrovao")
				.doesNotContain("registrovala").doesNotContain("Dobrodošla");

		Said invitedHer = WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, PORTAL, TOKEN, Gender.WOMAN);
		Said invitedHim = WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, PORTAL, TOKEN, Gender.MAN);

		assertThat(invitedHer.subject()).isEqualTo("Upisana si u Balkansku trkačku ligu");
		assertThat(invitedHer.body()).contains("koju si potpisala.").contains("postavi je sama:")
				.doesNotContain("potpisao").doesNotContain("sam:");
		assertThat(invitedHim.subject()).isEqualTo("Upisan si u Balkansku trkačku ligu");
		assertThat(invitedHim.body()).contains("koju si potpisao.").contains("postavi je sam:")
				.doesNotContain("potpisala").doesNotContain("sama:");

		assertThat(WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.ENGLISH, PORTAL, TOKEN,
				THE_LINK_ENDS, Gender.WOMAN))
				.isEqualTo(WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.ENGLISH, PORTAL,
						TOKEN, THE_LINK_ENDS, Gender.MAN));
		assertThat(WhatTheMessageSays.about(Message.INVITED_AS_A_MODERATOR, PORTAL, TOKEN, Gender.WOMAN))
				.as("a message with no feminine words is the same for both")
				.isEqualTo(WhatTheMessageSays.about(Message.INVITED_AS_A_MODERATOR, PORTAL, TOKEN, Gender.MAN));
	}

	@Test
	void aMessageWithWordsForAWomanIsNotAskedForWithoutAReaderAndNobodyIsAReaderByDefault() {
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, PORTAL, TOKEN))
				.isInstanceOf(IllegalStateException.class).hasMessageContaining("invitedAsAMember");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, PORTAL, TOKEN, null))
				.isInstanceOf(NullPointerException.class).hasMessage("reader");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.SERBIAN, PORTAL,
				TOKEN, THE_LINK_ENDS, null)).isInstanceOf(NullPointerException.class).hasMessage("sex");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, PORTAL, TOKEN, Gender.MAN))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("its reader's language");
	}

	/**
	 * AN ACCOUNT THAT NAMES NO MEMBER HAS NO SEX (V23), and what the portal says to him in „ti" is the owner's
	 * question (asked 21.11.2026). Until it is answered he is written the words he was always written, held
	 * whole here, and English, which has no participle, is the same as for everybody.
	 */
	@Test
	void anAccountThatNamesNoMemberIsWrittenTheWordsTheOwnerApprovedAsTheyWere() {
		Said serbian = WhatTheMessageSays.aboutToAnAccountThatNamesNoMember(Message.CONFIRM_THE_ADDRESS,
				MailLanguage.SERBIAN, PORTAL, TOKEN, THE_LINK_ENDS);

		assertThat(serbian.subject()).isEqualTo("Potvrdite svoju adresu");
		assertThat(serbian.body()).startsWith("Dobrodošli u Balkansku trkačku ligu.")
				.contains("Adresu potvrđujete otvaranjem ovog linka:")
				.contains("a sa ove adrese možete da se registrujete ponovo.")
				.contains("Ako se niste registrovali kod nas, zanemarite ovu poruku.")
				.contains(linkOf(Message.CONFIRM_THE_ADDRESS, MailLanguage.SERBIAN))
				.contains("do 17.12.2026. 13:00");
		assertThat(WhatTheMessageSays.aboutToAnAccountThatNamesNoMember(Message.CONFIRM_THE_ADDRESS,
				MailLanguage.ENGLISH, PORTAL, TOKEN, THE_LINK_ENDS))
				.isEqualTo(WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.ENGLISH, PORTAL, TOKEN,
						THE_LINK_ENDS, Gender.MAN));

		assertThatThrownBy(() -> WhatTheMessageSays.aboutToAnAccountThatNamesNoMember(Message.SET_A_NEW_PASSWORD,
				MailLanguage.SERBIAN, PORTAL, TOKEN, THE_LINK_ENDS)).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> WhatTheMessageSays.aboutToAnAccountThatNamesNoMember(null, MailLanguage.SERBIAN,
				PORTAL, TOKEN, THE_LINK_ENDS)).isInstanceOf(NullPointerException.class).hasMessage("message");
		assertThatThrownBy(() -> WhatTheMessageSays.aboutToAnAccountThatNamesNoMember(Message.CONFIRM_THE_ADDRESS,
				null, PORTAL, TOKEN, THE_LINK_ENDS)).isInstanceOf(NullPointerException.class).hasMessage("reader");
		assertThatThrownBy(() -> WhatTheMessageSays.aboutToAnAccountThatNamesNoMember(Message.CONFIRM_THE_ADDRESS,
				MailLanguage.SERBIAN, PORTAL, TOKEN, null)).isInstanceOf(NullPointerException.class)
				.hasMessage("endsAt");
	}

	/** The floor over that dictionary: the two keys of the confirmation, with the holes of the masculine one. */
	@Test
	void theWordsOfAnAccountThatNamesNoMemberAreTheTwoKeysOfTheConfirmationWithTheSameHoles() {
		ResourceBundle none = ResourceBundle.getBundle("mail/sr-no-member", java.util.Locale.ROOT);
		ResourceBundle man = WhatTheMessageSays.words(MailLanguage.SERBIAN);

		assertThat(none.keySet()).containsExactlyInAnyOrder("confirmTheAddress.subject", "confirmTheAddress.body");
		assertThat(new java.text.MessageFormat(none.getString("confirmTheAddress.body"), java.util.Locale.ROOT)
				.getFormatsByArgumentIndex().length)
				.isEqualTo(new java.text.MessageFormat(man.getString("confirmTheAddress.body"), java.util.Locale.ROOT)
						.getFormatsByArgumentIndex().length);
	}
}
