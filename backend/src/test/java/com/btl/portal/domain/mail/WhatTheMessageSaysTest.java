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
		return message.followsTheReader() ? WhatTheMessageSays.about(message, in, PORTAL, TOKEN)
				: WhatTheMessageSays.about(message, PORTAL, TOKEN);
	}

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
	 * THE NAME OF THE LINK TO ASK FOR A NEW ONE IS BETWEEN ENGLISH QUOTES (PDL P18, 18.10.2026).
	 *
	 * <p>The owner: "Neka navodnici budu engleski", for the whole portal and every mail. The
	 * member who reads this invitation is told which link on the sign-in page to press, and the
	 * words of that link are the only thing in any mail the portal sends that sits between
	 * quotes. Asserted as the whole sentence, with the quotes on both sides, because the old
	 * opening mark and the plain closing one were two different marks in one sentence.
	 */
	@Test
	void theLinkToAskForANewOneIsNamedBetweenEnglishQuotes() {
		assertThat(WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, PORTAL, TOKEN).body())
				.contains("Ako link istekne, zatražite novi sa strane za prijavu, na"
						+ " \"Zaboravljena lozinka\".\n");
	}

	/**
	 * WHAT EACH OF THE FOUR MAILS SAYS, WORD FOR WORD, AND THAT NONE OF THEM CALLS THE ADDRESS IT
	 * CARRIES "VEZA" (PDL P18, 18.10.2026, "Tekst mejlova, posle pregleda svih osam").
	 *
	 * <p>The owner: "U mejlovima svuda umesto veza koristi link." The Serbian mails are held as a
	 * snapshot of the whole text, with the address and the lifetime filled in as the class writes
	 * them, because a pattern over a word has to be right about every case and gender the
	 * word can stand in, and the whole text is not asked to. The English mails, which are my
	 * translation of the same meaning and not his words, are held the same way.
	 */
	@Test
	void theMailsSayExactlyWhatTheyWereDecidedToSay() {
		String tail = "Balkanska trkačka liga";

		assertThat(WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.SERBIAN, PORTAL,
				TOKEN).body()).isEqualTo(String.join("\n",
				"Dobrodošli u Balkansku trkačku ligu.",
				"",
				"Da bismo znali da je ova adresa zaista vaša, otvorite ovaj link:",
				linkOf(Message.CONFIRM_THE_ADDRESS, MailLanguage.SERBIAN),
				"",
				"Link važi 24 sata. Ako istekne, zatražite novi sa strane za prijavu.",
				"",
				"Ako se niste registrovali kod nas, ovu poruku slobodno zanemarite.",
				"",
				tail));

		assertThat(WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, MailLanguage.SERBIAN, PORTAL,
				TOKEN).body()).isEqualTo(String.join("\n",
				"Stigao nam je zahtev da postavite novu lozinku za svoj nalog.",
				"",
				"Otvorite ovaj link i upišite je:",
				linkOf(Message.SET_A_NEW_PASSWORD, MailLanguage.SERBIAN),
				"",
				"Link važi 1 sat i može da se upotrebi jednom.",
				"",
				"Ako niste inicirali promenu lozinke, ovu poruku slobodno zanemarite.",
				"",
				tail));

		assertThat(WhatTheMessageSays.about(Message.INVITED_AS_A_MODERATOR, PORTAL, TOKEN).body())
				.isEqualTo(String.join("\n",
				"Superadmin vam je otvorio nalog moderatora na portalu Balkanske trkačke lige.",
				"",
				"Nalog još nema lozinku. Otvorite ovaj link i postavite je sami:",
				linkOf(Message.INVITED_AS_A_MODERATOR, MailLanguage.SERBIAN),
				"",
				"Link važi 1 sat i može da se upotrebi jednom. Dok ga ne upotrebite, na nalog ne može da"
						+ " se prijavi niko, pa ni vi.",
				"",
				"Ako link istekne, zatražite novi sa strane za prijavu.",
				"",
				tail));

		assertThat(WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, PORTAL, TOKEN).body())
				.isEqualTo(String.join("\n",
				"Upisani smo vas u Balkansku trkačku ligu na osnovu saglasnosti koju ste potpisali.",
				"",
				"Vaš nalog postoji, ali još nema lozinku. Otvorite ovaj link i postavite je sami:",
				linkOf(Message.INVITED_AS_A_MEMBER, MailLanguage.SERBIAN),
				"",
				"Link važi 1 sat i može da se upotrebi jednom. Dok ga ne upotrebite, na nalog ne može da"
						+ " se prijavi niko, pa ni vi.",
				"",
				"Ako link istekne, zatražite novi sa strane za prijavu, na \"Zaboravljena lozinka\".",
				"",
				tail));

		assertThat(WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, MailLanguage.ENGLISH, PORTAL,
				TOKEN).body()).isEqualTo(String.join("\n",
				"Welcome to BTL.",
				"",
				"So that we know this address really is yours, open this link:",
				linkOf(Message.CONFIRM_THE_ADDRESS, MailLanguage.ENGLISH),
				"",
				"The link is valid for 24 hours. If it expires, ask for a new one on the sign-in page.",
				"",
				"If you did not register with us, you can safely ignore this message.",
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
				"If you did not request a password change, you can safely ignore this message.",
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

			assertThat(WhatTheMessageSays.about(invitation, PORTAL, TOKEN).body())
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
			assertThat(said(message, in).body())
					.as("%s in %s never told the member how long he has", message, in)
					.contains(WhatTheMessageSays.howLong(message.lasts(), in));
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
				MailLanguage.SERBIAN, null, TOKEN))
				.isInstanceOf(NullPointerException.class).hasMessage("portal");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, null, TOKEN))
				.isInstanceOf(NullPointerException.class).hasMessage("portal");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS,
				MailLanguage.SERBIAN, PORTAL, null))
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
}
