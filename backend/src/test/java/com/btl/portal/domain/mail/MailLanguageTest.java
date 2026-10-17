package com.btl.portal.domain.mail;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The two languages by their codes, and what happens to a code that is neither. */
class MailLanguageTest {

	@Test
	void eachLanguageIsFoundByItsOwnCodeAndByNoOther() {
		assertThat(MailLanguage.of("sr")).contains(MailLanguage.SERBIAN);
		assertThat(MailLanguage.of("en")).contains(MailLanguage.ENGLISH);
		assertThat(MailLanguage.of("EN")).as("a code is matched as it is written").isEmpty();
		assertThat(MailLanguage.of("de")).isEmpty();
		assertThat(MailLanguage.of("")).isEmpty();
	}

	@Test
	void onlyEnglishPutsAnythingInFrontOfThePath() {
		assertThat(MailLanguage.SERBIAN.prefix()).isEmpty();
		assertThat(MailLanguage.ENGLISH.prefix()).isEqualTo("/en");
	}

	@Test
	void aValueTheColumnHoldsThatIsNoLanguageIsAFaultAndNotAGuess() {
		assertThat(MailLanguage.ofTheColumn("en")).isEqualTo(MailLanguage.ENGLISH);

		assertThatThrownBy(() -> MailLanguage.ofTheColumn("de"))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("'de'");
		assertThatThrownBy(() -> MailLanguage.of(null)).isInstanceOf(NullPointerException.class);
	}
}
