package com.btl.portal.domain.membership;

import java.util.ResourceBundle;
import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.mail.Gender;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.membership.WhatAMembershipChangeSays.Told;
import com.btl.portal.domain.pricing.Currency;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.math.BigDecimal;
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
 * THE WORDS OF THE LINES A MEMBER GETS ABOUT HIS MEMBERSHIP, AND WHAT EACH SAYS.
 *
 * <p>Every floor here sweeps {@link Told#values()}, {@link Basis#values()} or the dictionary's own key
 * set, so a fourth occasion, a fourth basis, or a set of words nothing sends fails the day it is
 * written. The season is 2028 throughout, never the year a case runs in, so a message that said the
 * year of today instead of the season it was given would not read the same.
 */
class WhatAMembershipChangeSaysTest {

	private static final int SEASON = 2028;

	private static final Balance.Money SOME_MONEY = new Balance.Money(new BigDecimal("600.00"), Currency.RSD);

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
	 * WHAT EACH OF THEM SAYS, word for word, so the texts the owner reviews are the texts held.
	 * The season is written as the year and never grouped („2,028"), which is what handing it to
	 * {@code MessageFormat} as a number would do.
	 */
	@Test
	void whatEachOfThemSays() {
		assertThat(WhatAMembershipChangeSays.paymentRecorded(SEASON)).isEqualTo(new Said(
				"Evidentirana je tvoja uplata članarine",
				"Za sezonu 2028 evidentirana je tvoja uplata članarine.\n\n"
						+ "Za sezonu 2028 si član lige.\n\n"
						+ "Balkanska trkačka liga"));

		assertThat(WhatAMembershipChangeSays.basisChanged(SEASON, Basis.FEE_EXEMPT)).isEqualTo(new Said(
				"Promenjen je osnov tvog članstva",
				"Za sezonu 2028 promenjen je osnov tvog članstva.\n\n"
						+ "Za sezonu 2028 si i dalje član lige, a osnov tvog članstva je sada:"
						+ " oslobođenje od članarine.\n\n"
						+ "Balkanska trkačka liga"));

		assertThat(WhatAMembershipChangeSays.cancelled(SEASON)).isEqualTo(new Said(
				"Stornirano je tvoje članstvo",
				"Za sezonu 2028 stornirano je tvoje članstvo.\n\n"
						+ "Za sezonu 2028 više nisi član lige.\n\n"
						+ "Balkanska trkačka liga"));

		assertThat(WhatAMembershipChangeSays.beginnersCategoryMoved(false, SEASON, 2029, Gender.MAN)).isEqualTo(new Said(
				"Početnička kategorija ti je zatvorena",
				"Početnička kategorija ti je zatvorena za sezonu 2029, jer si u sezoni 2028 prešao prag od 12"
						+ " bodova.\n\n"
						+ "Balkanska trkačka liga"));

		assertThat(WhatAMembershipChangeSays.beginnersCategoryMoved(true, SEASON, 2029, Gender.MAN)).isEqualTo(new Said(
				"Početnička kategorija ti je ponovo otvorena",
				"Početnička kategorija ti je ponovo otvorena za sezonu 2029, jer je članstvo za sezonu 2028"
						+ " poništeno.\n\n"
						+ "Balkanska trkačka liga"));

		assertThat(WhatAMembershipChangeSays.referralThanked("Ime Prezime", SEASON,
				new Balance.Money(new BigDecimal("4200.00"), Currency.RSD), Gender.MAN)).isEqualTo(new Said(
				"Hvala na preporuci",
				"Osoba koju si preporučio, Ime Prezime, postala je deo lige za sezonu 2028, pa smo ti na"
						+ " balans upisali 4.200,00 RSD. Hvala ti na preporuci.\n\n"
						+ "Balkanska trkačka liga"));
	}

	/**
	 * THE THREE FACTS OF THE THANKS ARE THREE FACTS, and each lands in its own place: the name where the
	 * person is named, the season where the season is, and the amount in the money it was written in,
	 * as the portal's letters write it. Three values no two of which are alike, in both moneys.
	 */
	@Test
	void theNameTheSeasonAndTheAmountOfTheThanksAreThreeFacts() {
		String dinars = WhatAMembershipChangeSays.referralThanked("Ana Anic", 2031,
				new Balance.Money(new BigDecimal("876.00"), Currency.RSD), Gender.MAN).body();
		String euro = WhatAMembershipChangeSays.referralThanked("Ana Anic", 2031,
				new Balance.Money(new BigDecimal("7.30"), Currency.EUR), Gender.MAN).body();

		assertThat(dinars).contains("preporučio, Ana Anic, postala").contains("za sezonu 2031, pa")
				.contains("upisali 876,00 RSD.").doesNotContain("2,031").doesNotContain("EUR");
		assertThat(euro).contains("upisali 7,30 EUR.").doesNotContain("RSD");
	}

	/**
	 * THE TWO SEASONS OF A LINE ABOUT THE CATEGORY ARE TWO FACTS, and each lands where it is said: the
	 * membership's season where the membership is named, the other where the category is. Given two
	 * years that are not one apart, so a line that worked the second out of the first, or swapped them,
	 * reads differently.
	 */
	@Test
	void theSeasonOfTheMembershipAndTheSeasonOfTheCategoryAreTwoFacts() {
		for (boolean open : new boolean[] {false, true}) {
			String body = WhatAMembershipChangeSays.beginnersCategoryMoved(open, 2031, 2035, Gender.MAN).body();

			assertThat(body).contains(open ? "članstvo za sezonu 2031 poništeno" : "u sezoni 2031 prešao")
					.contains("za sezonu 2035")
					.doesNotContain("sezonu 2032").doesNotContain("sezonu 2036").doesNotContain("2,03");
		}
	}

	/** The season given is the season said, in every one of them, and no other year. */
	@Test
	void theSeasonGivenIsTheSeasonSaid() {
		for (Said said : List.of(WhatAMembershipChangeSays.paymentRecorded(2031),
				WhatAMembershipChangeSays.basisChanged(2031, Basis.PAYMENT),
				WhatAMembershipChangeSays.cancelled(2031),
				WhatAMembershipChangeSays.referralThanked("Ana Anic", 2031, SOME_MONEY, Gender.MAN))) {
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
						WhatAMembershipChangeSays.cancelled(SEASON),
						WhatAMembershipChangeSays.referralThanked("Ana Anic", SEASON, SOME_MONEY, Gender.MAN),
						WhatAMembershipChangeSays.beginnersCategoryMoved(false, SEASON, SEASON + 1, Gender.MAN),
						WhatAMembershipChangeSays.beginnersCategoryMoved(true, SEASON, SEASON + 1, Gender.MAN)),
				Arrays.stream(Basis.values()).map(one -> WhatAMembershipChangeSays.basisChanged(SEASON, one)))
				.toList();
	}

	/**
	 * THE SEX OF WHO READS PICKS THE PARTICIPLE (owner, 21.11.2026: „po polu primaoca"), and the dictionary of
	 * the words a woman reads is held from this side: the four keys that carry a participle, each a key of
	 * {@code notices/membership} with the same holes and other words.
	 */
	@Test
	void theWordsAWomanReadsAreFourOfTheMasculineKeysWithTheSameHolesAndOtherWords() {
		ResourceBundle man = WhatAMembershipChangeSays.words();
		ResourceBundle woman = WhatAMembershipChangeSays.wordsForAWoman();

		assertThat(woman.keySet()).containsExactlyInAnyOrder("exemptionGranted.subject", "exemptionGranted.body",
				"beginnersCategoryClosed.body", "referralThanked.body");

		for (String key : woman.keySet()) {
			assertThat(man.containsKey(key)).as(key).isTrue();
			assertThat(woman.getString(key)).as(key).isNotEqualTo(man.getString(key));
			assertThat(new MessageFormat(woman.getString(key), Locale.ROOT).getFormatsByArgumentIndex().length)
					.as("holes of %s", key)
					.isEqualTo(new MessageFormat(man.getString(key), Locale.ROOT).getFormatsByArgumentIndex().length);
		}
	}

	@Test
	void aWomanReadsTheFeminineAndAManTheMasculineInTheThreeNoticesThatHaveBoth() {
		assertThat(WhatAMembershipChangeSays.exemptionGranted(SEASON, Gender.WOMAN)).isEqualTo(new Said(
				"Oslobođena si članarine",
				"Za sezonu 2028 oslobođena si plaćanja članarine i član si lige.\n\nBalkanska trkačka liga"));
		assertThat(WhatAMembershipChangeSays.exemptionGranted(SEASON, Gender.MAN)).isEqualTo(new Said(
				"Oslobođen si članarine",
				"Za sezonu 2028 oslobođen si plaćanja članarine i član si lige.\n\nBalkanska trkačka liga"));

		assertThat(WhatAMembershipChangeSays.beginnersCategoryMoved(false, SEASON, 2029, Gender.WOMAN).body())
				.contains("jer si u sezoni 2028 prešla prag").doesNotContain("prešao");
		assertThat(WhatAMembershipChangeSays.beginnersCategoryMoved(false, SEASON, 2029, Gender.MAN).body())
				.contains("jer si u sezoni 2028 prešao prag").doesNotContain("prešla");
		assertThat(WhatAMembershipChangeSays.beginnersCategoryMoved(true, SEASON, 2029, Gender.WOMAN))
				.as("the line that reopens it has no participle, so it is the same for both")
				.isEqualTo(WhatAMembershipChangeSays.beginnersCategoryMoved(true, SEASON, 2029, Gender.MAN));

		assertThat(WhatAMembershipChangeSays.referralThanked("Ime Prezime", SEASON, SOME_MONEY, Gender.WOMAN).body())
				.startsWith("Osoba koju si preporučila, Ime Prezime,").doesNotContain("preporučio");
		assertThat(WhatAMembershipChangeSays.referralThanked("Ime Prezime", SEASON, SOME_MONEY, Gender.MAN).body())
				.startsWith("Osoba koju si preporučio, Ime Prezime,").doesNotContain("preporučila");
	}

	@Test
	void aNoticeWithWordsForAWomanIsNotAskedForWithoutAReaderAndOneWithoutIsNot() {
		assertThatThrownBy(() -> WhatAMembershipChangeSays.said(Told.AN_EXEMPTION_WAS_GRANTED, "2028"))
				.isInstanceOf(IllegalStateException.class).hasMessageContaining("exemptionGranted");
		assertThat(WhatAMembershipChangeSays.said(Told.A_PAYMENT_WAS_RECORDED, "2028").subject())
				.isEqualTo("Evidentirana je tvoja uplata članarine");
	}
}
