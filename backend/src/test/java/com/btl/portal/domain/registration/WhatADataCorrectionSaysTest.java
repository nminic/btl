package com.btl.portal.domain.registration;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.registration.WhatADataCorrectionSays.Field;
import org.junit.jupiter.api.Test;

import java.text.MessageFormat;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WhatADataCorrectionSaysTest {

	@Test
	void theMessageAndEveryFieldHaveTheirWordsAndEveryWordHasOne() {
		Set<String> expected = Stream.concat(
				Stream.of(WhatADataCorrectionSays.CORRECTED + ".subject", WhatADataCorrectionSays.CORRECTED + ".body"),
				Arrays.stream(Field.values()).map(one -> WhatADataCorrectionSays.A_FIELD + one.word()))
				.collect(Collectors.toSet());

		assertThat(WhatADataCorrectionSays.words().keySet())
				.as("the words and the fields no longer name the same things")
				.isEqualTo(expected);
	}

	@Test
	void theBodyHasOneHoleAndTheSubjectNone() {
		assertThat(new MessageFormat(WhatADataCorrectionSays.words().getString("corrected.body"), Locale.ROOT)
				.getFormatsByArgumentIndex()).hasSize(1);
		assertThat(WhatADataCorrectionSays.words().getString("corrected.subject")).doesNotContain("{");
	}

	@Test
	void whatItSays() {
		Said said = WhatADataCorrectionSays.corrected(List.of(Field.BIRTH_DATE, Field.GENDER));

		assertThat(said.subject()).isEqualTo("Izmenjeni su vaši podaci");
		assertThat(said.body()).isEqualTo("Administracija lige je izmenila vaše podatke: pol, datum rođenja.\n"
				+ "\nBalkanska trkačka liga");
	}

	/** In the order the fields are declared and once each, whatever order and however often named. */
	@Test
	void theFieldsAreNamedOnceEachInTheOrderOfTheRegistration() {
		Said said = WhatADataCorrectionSays.corrected(
				List.of(Field.SHIRT_SIZE, Field.FIRST_NAME, Field.TOWN, Field.FIRST_NAME));

		assertThat(said.body()).startsWith("Administracija lige je izmenila vaše podatke: ime, mesto, veličina majice.");
	}

	@Test
	void everyFieldIsNamedInWords() {
		Said said = WhatADataCorrectionSays.corrected(List.of(Field.values()));

		assertThat(said.body()).contains("ime, prezime, ime oca, pol, datum rođenja, broj ličnog dokumenta,"
				+ " adresa elektronske pošte, adresa, telefon, mesto, veličina majice.");
	}

	@Test
	void itCarriesNoLink() {
		Said said = WhatADataCorrectionSays.corrected(List.of(Field.values()));

		assertThat(said.subject() + "\n" + said.body()).doesNotContain("://");
	}

	@Test
	void nothingCorrectedIsNotAMessage() {
		assertThatThrownBy(() -> WhatADataCorrectionSays.corrected(List.of()))
				.isInstanceOf(IllegalArgumentException.class);
	}
}
