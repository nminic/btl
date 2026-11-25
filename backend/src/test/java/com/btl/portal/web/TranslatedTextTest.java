package com.btl.portal.web;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/** The rule of what a reader is shown, and the two readings it rests on, without a database. */
class TranslatedTextTest {

	/** Every language this portal reads as Serbian is Serbian; the rest are themselves, without their script. */
	@ParameterizedTest
	@CsvSource({"sr-Latn, sr", "sr-Cyrl, sr", "sr, sr", "hr, sr", "bs, sr", "cnr-Latn, sr", "sh, sr", "en, en",
			"EN, en", "en-GB, en", "de, de", "mk, mk", "zh-Hans, zh"})
	void whatTheServiceReadIsTheReadersLanguage(String heardAs, String reader) {
		assertThat(TranslatedText.portalLanguageOf(heardAs)).isEqualTo(reader);
	}

	/** Addresses and mailboxes, in order, the sentence's own punctuation after them left out. */
	@Test
	void theAddressesOfATextAreFound() {
		assertThat(TranslatedText.addressesIn("Pišite na Info@Primer.rs, ili vidite [stranicu](https://primer.rs/a)."
				+ " Ili www.primer.rs/b. Kraj"))
				.containsExactly("https://primer.rs/a", "info@primer.rs", "www.primer.rs/b");
	}

	/** A text that only moved its addresses carries the same ones; one that changed a letter of one does not. */
	@Test
	void movingAnAddressIsNotChangingIt() {
		String original = "Prijave na https://primer.rs/prijava, pitanja na info@primer.rs.";

		assertThat(TranslatedText.addressesIn("Questions to info@primer.rs; sign up at https://primer.rs/prijava."))
				.isEqualTo(TranslatedText.addressesIn(original));
		assertThat(TranslatedText.addressesIn("Sign up at https://primer.rs/signup, questions to info@primer.rs."))
				.isNotEqualTo(TranslatedText.addressesIn(original));
	}

	/** A reader whose language the original is in is shown the original, even where a translation exists. */
	@Test
	void theOriginalIsShownToAReaderOfItsLanguage() {
		assertThat(TranslatedText.shown("Kroz grad", "sr", "sr-Latn", "Kroz grad opet", true))
				.isEqualTo(new TranslatedText.Shown("Kroz grad", "sr", false));
	}

	/** Without a translation the original is shown, and what it is written in is said where it is known. */
	@Test
	void withoutATranslationTheOriginalIsShown() {
		assertThat(TranslatedText.shown("Kroz grad", "en", null, null, false))
				.isEqualTo(new TranslatedText.Shown("Kroz grad", null, false));
		assertThat(TranslatedText.shown("Kroz grad", "en", "hr", null, false))
				.isEqualTo(new TranslatedText.Shown("Kroz grad", "sr", false));
	}

	/** A translation is shown to another reader, in his language, marked as the machine's where it is. */
	@Test
	void aTranslationIsShownToAnotherReader() {
		assertThat(TranslatedText.shown("Kroz grad", "en", "sr-Latn", "Through the town", true))
				.isEqualTo(new TranslatedText.Shown("Through the town", "en", true));
	}

	/** No words are no words, in any language. */
	@Test
	void nothingIsShownAsNothing() {
		assertThat(TranslatedText.shown("", "en", "sr-Latn", "Nothing", true))
				.isEqualTo(new TranslatedText.Shown("", "sr", false));
	}
}
