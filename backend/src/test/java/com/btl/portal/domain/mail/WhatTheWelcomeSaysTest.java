package com.btl.portal.domain.mail;

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
			"Hvala što ste potvrdili svoju adresu, dobrodošli u Balkansku trkačku ligu.";

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
	void dAndFAreTheOwnersWordsDashAndAll() {
		Said d = WhatTheWelcomeSays.about(Letter.FREED_OF_THE_FEE, MailLanguage.SERBIAN, 2027, PORTAL);
		Said f = WhatTheWelcomeSays.about(Letter.PAID, MailLanguage.SERBIAN, 2027, PORTAL);

		assertThat(d.subject()).isEqualTo("Član ste lige za 2027. godinu");
		assertThat(d.body()).isEqualTo(String.join("\n", HELLO, "",
				"Za 2027. godinu oslobođeni ste plaćanja članarine - sve funkcionalnosti su vam dostupne.",
				"", TAIL));

		assertThat(f.subject()).isEqualTo("Član ste lige za 2027. godinu");
		assertThat(f.body()).isEqualTo(String.join("\n", HELLO, "",
				"Vaša članarina za 2027. godinu je plaćena - sve funkcionalnosti su vam dostupne.", "", TAIL));
	}

	@Test
	void eAndGAreTheOwnersWordsWithTheLinkToHisPage() {
		Said e = WhatTheWelcomeSays.about(Letter.PAID_FROM_THE_BALANCE, MailLanguage.SERBIAN, 2028, PORTAL);
		Said g = WhatTheWelcomeSays.about(Letter.THE_BALANCE_COVERS, MailLanguage.SERBIAN, 2027, PORTAL);

		assertThat(e.subject()).isEqualTo("Članarina za 2028. godinu je izmirena");
		assertThat(e.body()).isEqualTo(String.join("\n", HELLO, "",
				"Članarinu za 2028. godinu pokrio je vaš balans iz programa preporuke. Ono što je na balansu"
						+ " preostalo čeka sledeću sezonu, a stanje uvek vidite na strani Moja članarina:"
						+ " https://balkanskatrkackaliga.net/moja-clanarina",
				"", TAIL));

		assertThat(g.subject()).isEqualTo("Balans pokriva članarinu za 2027. godinu");
		assertThat(g.body()).isEqualTo(String.join("\n", HELLO, "",
				"Vaš balans iz programa preporuke pokriva članarinu za 2027. godinu. Aktivirajte članstvo"
						+ " jednim klikom na strani Moja članarina: https://balkanskatrkackaliga.net/moja-clanarina",
				"", TAIL));
	}

	@Test
	void bIsTheExampleWithItsFactsFilledIn() {
		Said b = WhatTheWelcomeSays.withASlip(MailLanguage.SERBIAN, 2027,
				"Sportsko udruženje BTL, Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd",
				"105-0000000003284-71", "3.600,00 RSD", "Članarina za 2027. godinu", PORTAL);

		assertThat(b.subject()).isEqualTo("Uplatnica za članarinu za 2027. godinu");
		assertThat(b.body()).isEqualTo(String.join("\n", HELLO, "",
				"Da biste postali član lige za 2027. godinu, ostalo je još samo da uplatite članarinu."
						+ " Najlakše je da u aplikaciji svoje banke skenirate QR kod iz priloga, pa se svi"
						+ " podaci popune sami. Ako vam je draže da ih unesete ručno, evo ih:",
				"",
				"Primalac: Sportsko udruženje BTL, Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd",
				"Račun: 105-0000000003284-71",
				"Iznos: 3.600,00 RSD",
				"Svrha uplate: Članarina za 2027. godinu",
				"",
				"Pošto još nemate članski broj, uplata nema poziv na broj. Prepoznaćemo je po vašem imenu,"
						+ " a čim stigne, moderator je potvrđuje i dobijate članski broj.",
				"",
				"Iste podatke uvek možete naći i na strani Moja članarina:"
						+ " https://balkanskatrkackaliga.net/moja-clanarina",
				"", TAIL));
	}

	@Test
	void cIsTheExampleWithItsFactsFilledIn() {
		Said c = WhatTheWelcomeSays.withPayPal(MailLanguage.SERBIAN, 2027, "info@balkanskatrkackaliga.net",
				"32,00 EUR", PORTAL);

		assertThat(c.subject()).isEqualTo("Podaci za uplatu članarine za 2027. godinu");
		assertThat(c.body()).isEqualTo(String.join("\n", HELLO, "",
				"Da biste postali član lige za 2027. godinu, ostalo je još samo da uplatite članarinu"
						+ " preko PayPal-a:",
				"",
				"Adresa naloga: info@balkanskatrkackaliga.net",
				"Iznos (sa uračunatom taksom): 32,00 EUR",
				"",
				"Taksa nije članarina nego trošak obrade plaćanja kod PayPal-a. Kursna razlika i naknada"
						+ " vaše banke ostaju na vama.",
				"",
				"Pošto još nemate članski broj, prepoznaćemo uplatu po vašem imenu, a čim stigne,"
						+ " moderator je potvrđuje i dobijate članski broj.",
				"",
				"Iste podatke uvek možete naći i na strani Moja članarina:"
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
			case WITH_A_SLIP -> WhatTheWelcomeSays.withASlip(MailLanguage.ENGLISH, 2027, "R", "A",
					"3,600.00 RSD", "Članarina za 2027. godinu", PORTAL);
			case WITH_PAYPAL -> WhatTheWelcomeSays.withPayPal(MailLanguage.ENGLISH, 2027, "P", "32.00 EUR",
					PORTAL);
			default -> WhatTheWelcomeSays.about(letter, MailLanguage.ENGLISH, 2027, PORTAL);
		};
		Said serbian = switch (letter) {
			case WITH_A_SLIP -> WhatTheWelcomeSays.withASlip(MailLanguage.SERBIAN, 2027, "R", "A",
					"3.600,00 RSD", "Članarina za 2027. godinu", PORTAL);
			case WITH_PAYPAL -> WhatTheWelcomeSays.withPayPal(MailLanguage.SERBIAN, 2027, "P", "32,00 EUR",
					PORTAL);
			default -> WhatTheWelcomeSays.about(letter, MailLanguage.SERBIAN, 2027, PORTAL);
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
		assertThatThrownBy(() -> WhatTheWelcomeSays.about(Letter.WITH_A_SLIP, MailLanguage.SERBIAN, 2027, PORTAL))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> WhatTheWelcomeSays.about(Letter.WITH_PAYPAL, MailLanguage.SERBIAN, 2027, PORTAL))
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
}
