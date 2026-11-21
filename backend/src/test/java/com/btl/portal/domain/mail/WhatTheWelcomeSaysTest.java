package com.btl.portal.domain.mail;

import java.util.ResourceBundle;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.mail.WhatTheWelcomeSays.Letter;
import com.btl.portal.domain.membership.Basis;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE SIX LETTERS AFTER A CONFIRMED ADDRESS: WHICH ONE GOES, AND THAT EACH SAYS WHAT WAS DECIDED.
 *
 * <p>D and E are the owner's own words (PDL 23.10.2026, „Poruke D i E glase doslovno"), F and G his
 * choice of 24.10.2026, B and C his example A to E of 23.10.2026 with the amounts filled in. Each is
 * held whole, as a snapshot: proza portala se drži snimkom celog teksta.
 */
class WhatTheWelcomeSaysTest {

	private static final Portal PORTAL = new Portal("https://balkanskatrkackaliga.net");

	private static final String TAIL = "Balkanska trkačka liga";

	private static final String HELLO =
			"Hvala što si potvrdio svoju adresu, dobrodošao u Balkansku trkačku ligu.";

	private static Optional<Letter> nothingOwedYet(boolean euro) {
		return WhatTheWelcomeSays.which(null, false, false, false, euro);
	}

	@Test
	void aSeasonHeAlreadyHoldsIsToldByHowHeHoldsIt() {
		assertThat(WhatTheWelcomeSays.which(Basis.FEE_EXEMPT, false, true, false, false))
				.contains(Letter.FREED_OF_THE_FEE);
		assertThat(WhatTheWelcomeSays.which(Basis.BALANCE, false, true, true, true))
				.contains(Letter.PAID_FROM_THE_BALANCE);
		assertThat(WhatTheWelcomeSays.which(Basis.PAYMENT, false, true, false, false))
				.contains(Letter.PAID);
	}

	/**
	 * A HELD SEASON IS SAID EVEN WHERE EVERYTHING ELSE WOULD SAY NOTHING: a fee of nought and a number
	 * are reasons to say nothing about money, and a member who holds the season is told no money.
	 */
	@Test
	void aHeldSeasonIsToldWhateverTheFeeAndTheNumberSay() {
		assertThat(WhatTheWelcomeSays.which(Basis.PAYMENT, true, true, true, false)).contains(Letter.PAID);
	}

	@Test
	void serbiaIsSentTheSlipAndAbroadIsSentPayPal() {
		assertThat(nothingOwedYet(false)).contains(Letter.WITH_A_SLIP);
		assertThat(nothingOwedYet(true)).contains(Letter.WITH_PAYPAL);
	}

	@Test
	void aBalanceThatReachesTheWholeFeeIsToldSoInEitherMoney() {
		assertThat(WhatTheWelcomeSays.which(null, false, false, true, false)).contains(Letter.THE_BALANCE_COVERS);
		assertThat(WhatTheWelcomeSays.which(null, false, false, true, true)).contains(Letter.THE_BALANCE_COVERS);
	}

	/** The owner, 24.10.2026: nothing for a fee of nought, nothing for a member with a number. */
	@Test
	void aFeeOfNoughtAndANumberWithNoSeasonAreToldNothing() {
		assertThat(WhatTheWelcomeSays.which(null, true, false, false, false)).isEmpty();
		assertThat(WhatTheWelcomeSays.which(null, true, false, true, true)).isEmpty();
		assertThat(WhatTheWelcomeSays.which(null, false, true, false, false)).isEmpty();
		assertThat(WhatTheWelcomeSays.which(null, false, true, true, true)).isEmpty();
	}

	@Test
	void dAndFAreTheOwnersWordsAndPromiseNothingMore() {
		Said d = WhatTheWelcomeSays.about(Letter.FREED_OF_THE_FEE, MailLanguage.SERBIAN, 2027, PORTAL, Gender.MAN);
		Said f = WhatTheWelcomeSays.about(Letter.PAID, MailLanguage.SERBIAN, 2027, PORTAL, Gender.MAN);

		assertThat(d.subject()).isEqualTo("Član si lige za 2027. godinu");
		assertThat(d.body()).isEqualTo(String.join("\n", HELLO, "",
				"Članarina za 2027. godinu je izmirena.",
				"", TAIL));

		assertThat(f.subject()).isEqualTo("Član si lige za 2027. godinu");
		assertThat(f.body()).isEqualTo(String.join("\n", HELLO, "",
				"Tvoja članarina za 2027. godinu je plaćena.", "", TAIL));
	}

	@Test
	void eAndGAreTheOwnersWordsWithTheLinkToHisPage() {
		Said e = WhatTheWelcomeSays.about(Letter.PAID_FROM_THE_BALANCE, MailLanguage.SERBIAN, 2028, PORTAL, Gender.MAN);
		Said g = WhatTheWelcomeSays.about(Letter.THE_BALANCE_COVERS, MailLanguage.SERBIAN, 2027, PORTAL, Gender.MAN);

		assertThat(e.subject()).isEqualTo("Članarina za 2028. godinu je izmirena");
		assertThat(e.body()).isEqualTo(String.join("\n", HELLO, "",
				"Članarinu za 2028. godinu pokrio je tvoj balans iz programa preporuke. Stanje balansa je na"
						+ " strani Moja članarina: https://balkanskatrkackaliga.net/moja-clanarina",
				"", TAIL));

		assertThat(g.subject()).isEqualTo("Balans pokriva članarinu za 2027. godinu");
		assertThat(g.body()).isEqualTo(String.join("\n", HELLO, "",
				"Tvoj balans iz programa preporuke pokriva članarinu za 2027. godinu. Aktiviraj članstvo"
						+ " jednim klikom na strani Moja članarina: https://balkanskatrkackaliga.net/moja-clanarina",
				"", TAIL));
	}

	@Test
	void bIsTheExampleWithItsFactsFilledIn() {
		Said b = WhatTheWelcomeSays.withASlip(MailLanguage.SERBIAN, Gender.MAN, 2027,
				"Sportsko udruženje BTL, Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd",
				"105-0000000003284-71", "3.600,00 RSD", "Članarina za 2027. godinu", PORTAL);

		assertThat(b.subject()).isEqualTo("Uplatnica za članarinu za 2027. godinu");
		assertThat(b.body()).isEqualTo(String.join("\n", HELLO, "",
				"Članarinu za 2027. godinu možeš da uplatiš skeniranjem QR koda iz priloga u aplikaciji"
						+ " svoje banke, ili ručno, sa ovim podacima:",
				"",
				"Primalac: Sportsko udruženje BTL, Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd",
				"Račun: 105-0000000003284-71",
				"Iznos: 3.600,00 RSD",
				"Svrha uplate: Članarina za 2027. godinu",
				"",
				"Uplata nema poziv na broj, jer članski broj još nemaš. Članski broj dobijaš kad uplata"
						+ " bude evidentirana.",
				"",
				"Iste podatke uvek možeš naći i na strani Moja članarina:"
						+ " https://balkanskatrkackaliga.net/moja-clanarina",
				"", TAIL));
	}

	@Test
	void cIsTheExampleWithItsFactsFilledIn() {
		Said c = WhatTheWelcomeSays.withPayPal(MailLanguage.SERBIAN, Gender.MAN, 2027, "info@balkanskatrkackaliga.net",
				"32,00 EUR", "Sportsko udruženje BTL", PORTAL);

		assertThat(c.subject()).isEqualTo("Podaci za uplatu članarine za 2027. godinu");
		assertThat(c.body()).isEqualTo(String.join("\n", HELLO, "",
				"Članarinu za 2027. godinu uplaćuješ preko PayPal-a:",
				"",
				"PayPal adresa: info@balkanskatrkackaliga.net",
				"Iznos (sa uračunatom taksom): 32,00 EUR",
				"",
				"PayPal adresa je poslovna, na Sportsko udruženje BTL. Kursnu razliku i naknadu banke plaća"
						+ " uplatilac.",
				"",
				"Uplatu ćemo prepoznati po tvom imenu. Članski broj dobijaš kad uplata bude evidentirana.",
				"",
				"Iste podatke uvek možeš naći i na strani Moja članarina:"
						+ " https://balkanskatrkackaliga.net/moja-clanarina",
				"", TAIL));
	}

	/**
	 * THE ENGLISH LETTER LEADS TO THE ENGLISH PAGE, names the season and keeps the Serbian signature,
	 * for every one of the six (PDL P18; „Jezik mejlova", 10.10.2026).
	 */
	@ParameterizedTest
	@EnumSource(Letter.class)
	void everyLetterIsWrittenInEnglishTooAndLeadsToTheEnglishPage(Letter letter) {
		Said english = switch (letter) {
			case WITH_A_SLIP -> WhatTheWelcomeSays.withASlip(MailLanguage.ENGLISH, Gender.MAN, 2027, "R", "A",
					"3,600.00 RSD", "Članarina za 2027. godinu", PORTAL);
			case WITH_PAYPAL -> WhatTheWelcomeSays.withPayPal(MailLanguage.ENGLISH, Gender.MAN, 2027, "P", "32.00 EUR",
					"U", PORTAL);
			default -> WhatTheWelcomeSays.about(letter, MailLanguage.ENGLISH, 2027, PORTAL, Gender.MAN);
		};
		Said serbian = switch (letter) {
			case WITH_A_SLIP -> WhatTheWelcomeSays.withASlip(MailLanguage.SERBIAN, Gender.MAN, 2027, "R", "A",
					"3.600,00 RSD", "Članarina za 2027. godinu", PORTAL);
			case WITH_PAYPAL -> WhatTheWelcomeSays.withPayPal(MailLanguage.SERBIAN, Gender.MAN, 2027, "P", "32,00 EUR",
					"U", PORTAL);
			default -> WhatTheWelcomeSays.about(letter, MailLanguage.SERBIAN, 2027, PORTAL, Gender.MAN);
		};

		assertThat(english.subject()).contains("2027").isNotEqualTo(serbian.subject());
		assertThat(english.body())
				.startsWith("Thank you for confirming your address, and welcome to BTL.")
				.contains("2027")
				.endsWith("\n\n" + TAIL)
				.doesNotContain("https://balkanskatrkackaliga.net/moja-clanarina");

		if (letter != Letter.FREED_OF_THE_FEE && letter != Letter.PAID) {
			assertThat(english.body()).contains("https://balkanskatrkackaliga.net/en/moja-clanarina");
		}
	}

	@Test
	void anAmountIsWrittenAsItsReaderWritesOne() {
		assertThat(WhatTheWelcomeSays.amount(new BigDecimal("3600"), "RSD", MailLanguage.SERBIAN))
				.isEqualTo("3.600,00 RSD");
		assertThat(WhatTheWelcomeSays.amount(new BigDecimal("1234567.5"), "RSD", MailLanguage.SERBIAN))
				.isEqualTo("1.234.567,50 RSD");
		assertThat(WhatTheWelcomeSays.amount(new BigDecimal("3600"), "RSD", MailLanguage.ENGLISH))
				.isEqualTo("3,600.00 RSD");
		assertThat(WhatTheWelcomeSays.amount(new BigDecimal("32"), "EUR", MailLanguage.SERBIAN))
				.isEqualTo("32,00 EUR");
	}

	@Test
	void theLineOverTheCodeIsInTheReadersLanguage() {
		assertThat(WhatTheWelcomeSays.caption(MailLanguage.SERBIAN)).isEqualTo("IPS QR kod za uplatu");
		assertThat(WhatTheWelcomeSays.caption(MailLanguage.ENGLISH)).isEqualTo("IPS QR code for the payment");
	}

	@Test
	void aLetterThatCarriesAPaymentIsNotAskedForWithoutIt() {
		assertThatThrownBy(() -> WhatTheWelcomeSays.about(Letter.WITH_A_SLIP, MailLanguage.SERBIAN, 2027, PORTAL, Gender.MAN))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> WhatTheWelcomeSays.about(Letter.WITH_PAYPAL, MailLanguage.SERBIAN, 2027, PORTAL, Gender.MAN))
				.isInstanceOf(IllegalArgumentException.class);
	}

	/**
	 * THE WORDS BEHIND EVERY LETTER ARE THERE, IN BOTH LANGUAGES, AND THERE ARE NO OTHERS: the shape
	 * {@code WhatTheMessageSaysTest} holds its own dictionary to, read off the enum and the bundle.
	 */
	@Test
	void everyLetterHasItsWordsInBothLanguagesAndThereAreNoOthers() {
		for (MailLanguage in : MailLanguage.values()) {
			Set<String> expected = Arrays.stream(Letter.values())
					.flatMap(one -> Stream.of(one.key() + ".subject", one.key() + ".body"))
					.collect(Collectors.toSet());

			expected.add(Letter.WITH_A_SLIP.key() + ".caption");

			assertThat(WhatTheWelcomeSays.words(in).keySet())
					.as("the words in %s and the six letters no longer name the same things", in)
					.isEqualTo(expected);
		}
	}

	/**
	 * THE SEX OF WHO READS PICKS THE PARTICIPLE (owner, 21.11.2026: „po polu primaoca"). The dictionary of
	 * the words a woman reads is held here: exactly the six bodies, every one with the holes of the
	 * masculine one and other words, and no subject, because none of the six carries a participle.
	 */
	@Test
	void theWordsAWomanReadsAreTheSixBodiesWithTheSameHolesAndOtherWords() {
		ResourceBundle man = WhatTheWelcomeSays.words(MailLanguage.SERBIAN);
		ResourceBundle woman = WhatTheWelcomeSays.wordsForAWoman(MailLanguage.SERBIAN);

		assertThat(woman.keySet()).containsExactlyInAnyOrderElementsOf(
				Arrays.stream(Letter.values()).map(one -> one.key() + ".body").toList());

		for (String key : woman.keySet()) {
			assertThat(woman.getString(key)).as(key).isNotEqualTo(man.getString(key));
			assertThat(new java.text.MessageFormat(woman.getString(key), java.util.Locale.ROOT)
					.getFormatsByArgumentIndex().length).as("holes of %s", key)
					.isEqualTo(new java.text.MessageFormat(man.getString(key), java.util.Locale.ROOT)
							.getFormatsByArgumentIndex().length);
		}

		assertThat(WhatTheWelcomeSays.wordsForAWoman(MailLanguage.ENGLISH)).isNull();
	}

	@Test
	void aWomanIsGreetedInTheFeminineAndAManInTheMasculineInEveryOneOfTheSixLetters() {
		for (Said her : new Said[] {
				WhatTheWelcomeSays.about(Letter.FREED_OF_THE_FEE, MailLanguage.SERBIAN, 2027, PORTAL, Gender.WOMAN),
				WhatTheWelcomeSays.about(Letter.PAID, MailLanguage.SERBIAN, 2027, PORTAL, Gender.WOMAN),
				WhatTheWelcomeSays.about(Letter.PAID_FROM_THE_BALANCE, MailLanguage.SERBIAN, 2027, PORTAL, Gender.WOMAN),
				WhatTheWelcomeSays.about(Letter.THE_BALANCE_COVERS, MailLanguage.SERBIAN, 2027, PORTAL, Gender.WOMAN),
				WhatTheWelcomeSays.withASlip(MailLanguage.SERBIAN, Gender.WOMAN, 2027, "R", "A", "1,00 RSD", "P", PORTAL),
				WhatTheWelcomeSays.withPayPal(MailLanguage.SERBIAN, Gender.WOMAN, 2027, "P", "1,00 EUR", "R", PORTAL)}) {
			assertThat(her.body()).startsWith("Hvala što si potvrdila svoju adresu, dobrodošla u Balkansku")
					.doesNotContain("potvrdio").doesNotContain("dobrodošao");
		}

		for (Said him : new Said[] {
				WhatTheWelcomeSays.about(Letter.FREED_OF_THE_FEE, MailLanguage.SERBIAN, 2027, PORTAL, Gender.MAN),
				WhatTheWelcomeSays.about(Letter.PAID, MailLanguage.SERBIAN, 2027, PORTAL, Gender.MAN),
				WhatTheWelcomeSays.about(Letter.PAID_FROM_THE_BALANCE, MailLanguage.SERBIAN, 2027, PORTAL, Gender.MAN),
				WhatTheWelcomeSays.about(Letter.THE_BALANCE_COVERS, MailLanguage.SERBIAN, 2027, PORTAL, Gender.MAN),
				WhatTheWelcomeSays.withASlip(MailLanguage.SERBIAN, Gender.MAN, 2027, "R", "A", "1,00 RSD", "P", PORTAL),
				WhatTheWelcomeSays.withPayPal(MailLanguage.SERBIAN, Gender.MAN, 2027, "P", "1,00 EUR", "R", PORTAL)}) {
			assertThat(him.body()).startsWith("Hvala što si potvrdio svoju adresu, dobrodošao u Balkansku")
					.doesNotContain("potvrdila").doesNotContain("dobrodošla");
		}

		assertThat(WhatTheWelcomeSays.about(Letter.PAID, MailLanguage.ENGLISH, 2027, PORTAL, Gender.WOMAN))
				.isEqualTo(WhatTheWelcomeSays.about(Letter.PAID, MailLanguage.ENGLISH, 2027, PORTAL, Gender.MAN));
		assertThatThrownBy(() -> WhatTheWelcomeSays.about(Letter.PAID, MailLanguage.SERBIAN, 2027, PORTAL, null))
				.isInstanceOf(NullPointerException.class).hasMessage("reader");
	}
}
