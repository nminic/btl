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

/** What the two messages say, and that the words behind them are all there. */
class WhatTheMessageSaysTest {

	private static final Portal PORTAL = new Portal("https://balkanskatrkackaliga.net");

	private static final String TOKEN = "AbCd-EfGh_1234";

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
		Said said = WhatTheMessageSays.about(message, PORTAL, TOKEN);

		assertThat(said.body())
				.as("%s did not carry the link it exists to carry", message)
				.contains(PORTAL.address() + message.path() + "?token=" + TOKEN);
		assertThat(said.subject()).isNotBlank();
	}

	/**
	 * AND THE TWO MESSAGES ARE NOT THE SAME MESSAGE.
	 *
	 * <p>Two kinds answered with one text would pass every case above, so the
	 * subjects and the paths are required to differ. The day a third message is
	 * added, this counts it in without being edited.
	 */
	@Test
	void noTwoMessagesSayTheSameThingOrPointAtTheSamePlace() {
		assertThat(Stream.of(Message.values())
				.map(one -> WhatTheMessageSays.about(one, PORTAL, TOKEN).subject())
				.collect(Collectors.toSet()))
				.as("two messages share a subject, so one of them is not being looked at")
				.hasSize(Message.values().length);

		assertThat(Stream.of(Message.values()).map(Message::path).collect(Collectors.toSet()))
				.as("two messages point at the same place")
				.hasSize(Message.values().length);
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

	/** And what the class works out is what the member reads. */
	@ParameterizedTest
	@EnumSource(Message.class)
	void howLongTheLinkLastsReachesTheMember(Message message) {
		assertThat(WhatTheMessageSays.about(message, PORTAL, TOKEN).body())
				.as("%s never told the member how long he has", message)
				.contains(WhatTheMessageSays.howLong(message.lasts()));
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

			assertThat(WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, PORTAL, secret).body())
					.as("a token the portal itself made was refused: %s", secret)
					.contains(secret);
		}

		assertThat(seen)
				.as("the draws did not cover the alphabet, so this proves less than it looks")
				.hasSizeGreaterThan(60);
	}

	@Test
	void nothingMissingIsQuietlyAccepted() {
		assertThatThrownBy(() -> new Portal(null))
				.isInstanceOf(NullPointerException.class).hasMessage("address");
		assertThatThrownBy(() -> WhatTheMessageSays.about(null, PORTAL, TOKEN))
				.isInstanceOf(NullPointerException.class).hasMessage("message");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, null, TOKEN))
				.isInstanceOf(NullPointerException.class).hasMessage("portal");
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, PORTAL, null))
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
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, PORTAL, nothing))
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
		assertThatThrownBy(() -> WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, PORTAL, broken))
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
	 */
	@Test
	void everyMessageHasItsWordsAndEveryWordHasItsMessage() {
		ResourceBundle words = ResourceBundle.getBundle("mail/sr", Locale.ROOT);

		Set<String> expected = Arrays.stream(Message.values())
				.flatMap(one -> Stream.of(one.key() + ".subject", one.key() + ".body"))
				.collect(Collectors.toSet());

		assertThat(words.keySet())
				.as("the words and the messages no longer name the same things")
				.isEqualTo(expected);

		for (Message message : Message.values()) {
			assertThat(words.getString(message.key() + ".body"))
					.as("%s has nowhere to put the link and how long it lasts", message)
					.contains("{0}")
					.contains("{1}");
		}
	}
}
