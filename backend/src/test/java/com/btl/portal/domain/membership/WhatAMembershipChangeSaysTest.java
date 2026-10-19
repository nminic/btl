package com.btl.portal.domain.membership;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.membership.WhatAMembershipChangeSays.Told;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.text.MessageFormat;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE WORDS OF THE THREE LINES A MEMBER GETS ABOUT HIS MEMBERSHIP, AND WHAT EACH SAYS.
 *
 * <p>Every floor here sweeps {@link Told#values()}, {@link Basis#values()} or the dictionary's own key
 * set, so a fourth occasion, a fourth basis, or a set of words nothing sends fails the day it is
 * written. The season is 2028 throughout, never the year a case runs in, so a message that said the
 * year of today instead of the season it was given would not read the same.
 */
class WhatAMembershipChangeSaysTest {

	private static final int SEASON = 2028;

	/** Every occasion and every basis has its words, and every word has its occasion or its basis. */
	@Test
	void everyOccasionAndEveryBasisHasItsWordsAndEveryWordHasOne() {
		Set<String> expected = Stream.concat(
				Arrays.stream(Told.values()).flatMap(one -> Stream.of(one.key() + ".subject", one.key() + ".body")),
				Arrays.stream(Basis.values()).map(one -> WhatAMembershipChangeSays.A_BASIS + one.word()))
				.collect(Collectors.toSet());

		assertThat(WhatAMembershipChangeSays.words().keySet())
				.as("the words and the occasions and bases no longer name the same things")
				.isEqualTo(expected);
	}

	/** And each body has as many holes as its occasion says it takes facts. */
	@ParameterizedTest
	@EnumSource(Told.class)
	void everyOccasionTakesAsManyFactsAsItsWordsHaveHolesFor(Told told) {
		int holes = new MessageFormat(WhatAMembershipChangeSays.words().getString(told.key() + ".body"),
				Locale.ROOT).getFormatsByArgumentIndex().length;

		assertThat(holes).as("%s takes %d facts and its words have %d holes", told, told.facts(), holes)
				.isEqualTo(told.facts());
	}

	/** The holes in a subject are not filled at all, so a subject has none. */
	@ParameterizedTest
	@EnumSource(Told.class)
	void noSubjectHasAHole(Told told) {
		assertThat(WhatAMembershipChangeSays.words().getString(told.key() + ".subject")).doesNotContain("{");
	}

	/**
	 * WHAT EACH OF THE THREE SAYS, word for word, so the texts the owner reviews are the texts held.
	 * The season is written as the year and never grouped („2,028"), which is what handing it to
	 * {@code MessageFormat} as a number would do.
	 */
	@Test
	void whatEachOfThemSays() {
		assertThat(WhatAMembershipChangeSays.paymentRecorded(SEASON)).isEqualTo(new Said(
				"Evidentirana je vaša uplata članarine",
				"Za sezonu 2028 evidentirana je vaša uplata članarine.\n\n"
						+ "Za sezonu 2028 ste član lige, a osnov vašeg članstva je uplata.\n\n"
						+ "Balkanska trkačka liga"));

		assertThat(WhatAMembershipChangeSays.basisChanged(SEASON, Basis.FEE_EXEMPT)).isEqualTo(new Said(
				"Promenjen je osnov vašeg članstva",
				"Za sezonu 2028 promenjen je osnov vašeg članstva.\n\n"
						+ "Za sezonu 2028 ste i dalje član lige, a osnov vašeg članstva je sada:"
						+ " oslobođenje od članarine.\n\n"
						+ "Balkanska trkačka liga"));

		assertThat(WhatAMembershipChangeSays.cancelled(SEASON)).isEqualTo(new Said(
				"Stornirano je vaše članstvo",
				"Za sezonu 2028 stornirano je vaše članstvo.\n\n"
						+ "Za sezonu 2028 više niste član lige.\n\n"
						+ "Balkanska trkačka liga"));
	}

	/** The season given is the season said, in every one of them, and no other year. */
	@Test
	void theSeasonGivenIsTheSeasonSaid() {
		for (Said said : List.of(WhatAMembershipChangeSays.paymentRecorded(2031),
				WhatAMembershipChangeSays.basisChanged(2031, Basis.PAYMENT),
				WhatAMembershipChangeSays.cancelled(2031))) {
			assertThat(said.body()).contains("sezonu 2031").doesNotContain("2028").doesNotContain("2,031");
		}
	}

	/**
	 * A CHANGE NAMES THE BASIS IT STANDS ON NOW, and only that one: „sa sezonom i novim stanjem". Asked
	 * for every basis, with every other basis's words required absent, so a message that named the
	 * basis before, or a fixed one, reads differently.
	 */
	@ParameterizedTest
	@EnumSource(Basis.class)
	void aChangeNamesTheBasisItStandsOnNow(Basis now) {
		String body = WhatAMembershipChangeSays.basisChanged(SEASON, now).body();

		assertThat(body).contains("je sada: " + WhatAMembershipChangeSays.inWords(now) + ".");

		for (Basis other : Basis.values()) {
			if (other != now) {
				assertThat(body).doesNotContain(": " + WhatAMembershipChangeSays.inWords(other));
			}
		}
	}

	@Test
	void everyBasisInWords() {
		assertThat(WhatAMembershipChangeSays.inWords(Basis.PAYMENT)).isEqualTo("uplata");
		assertThat(WhatAMembershipChangeSays.inWords(Basis.FEE_EXEMPT)).isEqualTo("oslobođenje od članarine");
		assertThat(WhatAMembershipChangeSays.inWords(Basis.BALANCE)).isEqualTo("balans");
	}

	/** No line carries a link, over the whole formatted text. */
	@Test
	void notOneOfThemCarriesALink() {
		for (Said said : everyOneOfThem()) {
			assertThat(said.subject() + "\n" + said.body()).doesNotContain("://");
		}
	}

	@Test
	void aChangeIsToSomeBasis() {
		assertThatThrownBy(() -> WhatAMembershipChangeSays.basisChanged(SEASON, null))
				.isInstanceOf(NullPointerException.class);
	}

	@ParameterizedTest
	@EnumSource(Basis.class)
	void everyBasisIsReadBackFromItsWord(Basis basis) {
		assertThat(Basis.of(basis.word())).isEqualTo(basis);
	}

	@Test
	void aWordNoBasisHasIsRefused() {
		assertThatThrownBy(() -> Basis.of("honorary")).isInstanceOf(IllegalArgumentException.class);
	}

	private static List<Said> everyOneOfThem() {
		return Stream.concat(
				Stream.of(WhatAMembershipChangeSays.paymentRecorded(SEASON),
						WhatAMembershipChangeSays.cancelled(SEASON)),
				Arrays.stream(Basis.values()).map(one -> WhatAMembershipChangeSays.basisChanged(SEASON, one)))
				.toList();
	}
}
