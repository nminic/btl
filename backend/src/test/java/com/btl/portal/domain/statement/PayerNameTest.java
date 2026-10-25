package com.btl.portal.domain.statement;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A PAYER AS THE BANK PRINTS HIM AGAINST A MEMBER AS HE TYPED HIMSELF IN: only ever a suggestion a person
 * confirms (PDL 24.10.2026), so the letters a bank drops do not keep it from being made.
 */
class PayerNameTest {

	@Test
	void theNameIsWhatStandsBeforeTheAddress() {
		assertThat(PayerName.of("DUŠKO KUNIĆ, KRALJEVAČKIH ŽRTAVA 53, BEOGRAD")).isEqualTo("DUŠKO KUNIĆ");
		assertThat(PayerName.of("  DUŠKO KUNIĆ  ")).isEqualTo("DUŠKO KUNIĆ");
	}

	@Test
	void caseMarksAndTheOrderOfTheTwoNamesDoNotKeepAMemberFromBeingNamed() {
		assertThat(PayerName.names("DUSKO KUNIC", "Duško", "Kunić")).isTrue();
		assertThat(PayerName.names("KUNIĆ DUŠKO", "Duško", "Kunić")).isTrue();
		assertThat(PayerName.names("DJORDJE COLIC", "Đorđe", "Čolić")).isTrue();
		assertThat(PayerName.names("MARKO PETROVIĆ-JOVIĆ", "Marko", "Petrović Jović")).isTrue();
	}

	@Test
	void anotherNameOrNoNameAtAllNamesNobody() {
		assertThat(PayerName.names("SUPRUGA KUNIĆ", "Duško", "Kunić")).isFalse();
		assertThat(PayerName.names("DUŠKO", "Duško", "Kunić")).isFalse();
		assertThat(PayerName.names("", "", "")).isFalse();
		assertThat(PayerName.names("-", "", "")).isFalse();
	}
}
