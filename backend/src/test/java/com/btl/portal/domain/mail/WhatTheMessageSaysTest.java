package com.btl.portal.domain.mail;

import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;
import java.util.Arrays;
import java.util.Locale;
import java.util.ResourceBundle;
import java.util.Set;
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
	 * AN ADDRESS THAT IS NOT THE PORTAL IS REFUSED WHERE IT IS TAKEN IN.
	 *
	 * <p>Plain http because the token travels in the address itself; a trailing
	 * slash because it would put two in the link; a space because that is what a
	 * host folded out of a header looks like when it arrives.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"http://balkanskatrkackaliga.net", "balkanskatrkackaliga.net",
			"https://balkanskatrkackaliga.net/", "https://zlo.rs evil", "https://a.rs\nHost: zlo.rs"})
	void anAddressThatIsNotThePortalIsRefused(String notThePortal) {
		assertThatThrownBy(() -> new Portal(notThePortal))
				.as("'%s' was taken for the portal's own address", notThePortal)
				.isInstanceOf(IllegalArgumentException.class);
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
