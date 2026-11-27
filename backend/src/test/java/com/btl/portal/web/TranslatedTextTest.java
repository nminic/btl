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

	/**
	 * THE TARGET OF A LINK INSIDE THE PORTAL IS AN ADDRESS (PENDING, PR 835 S2, 27.11.2026): {@code (/kalendar)} turned
	 * into {@code (/calendar)} is a link to a page that is not there, and a {@code [prijava](/admin)} the original
	 * did not carry is a link to somewhere the author never sent a reader. A target that is a full address is
	 * counted once, not as itself and again as a target.
	 */
	@Test
	void theTargetOfALinkInsideThePortalIsAnAddressAndAFullOneIsNotCountedTwice() {
		String original = "Vidi [kalendar](/kalendar) i [prijavu](https://primer.rs/prijava) ili [mail](mailto:info@primer.rs).";

		assertThat(TranslatedText.addressesIn(original))
				.containsExactly("/kalendar", "https://primer.rs/prijava", "mailto:info@primer.rs");
		assertThat(TranslatedText.addressesIn("See [the calendar](/kalendar), [sign up](https://primer.rs/prijava)"
				+ " or [write](mailto:info@primer.rs)."))
				.isEqualTo(TranslatedText.addressesIn(original));
		assertThat(TranslatedText.addressesIn("See [the calendar](/calendar), [sign up](https://primer.rs/prijava)"
				+ " or [write](mailto:info@primer.rs).")).isNotEqualTo(TranslatedText.addressesIn(original));
		assertThat(TranslatedText.addressesIn("See [the calendar](/kalendar), [sign up](https://primer.rs/prijava)"
				+ " or [write](mailto:info@primer.rs) and [log in](/admin).")).isNotEqualTo(TranslatedText.addressesIn(original));
		assertThat(TranslatedText.addressesIn("A [link]( /kalendar ) with a space is no target, and so is [x]."))
				.isEmpty();
	}

	/**
	 * ONLY WHAT HAS NO CASE OF ITS OWN IS LOWERED (PENDING, PR 835 N1, 27.11.2026): the scheme and the domain of a
	 * site and a whole mailbox. A letter whose case changed in the path, the query or the fragment is a different
	 * address, and a domain written in capitals is the same one.
	 */
	@Test
	void theCaseOfTheDomainAndOfAMailboxIsNotTheCaseOfThePath() {
		String original = "Vidi https://primer.rs/Prijava?Ko=1#Gore ili www.primer.rs/Staza, pisi na info@primer.rs.";

		assertThat(TranslatedText.addressesIn("See HTTPS://PRIMER.RS/Prijava?Ko=1#Gore or WWW.PRIMER.RS/Staza, write to"
				+ " INFO@Primer.rs.")).isEqualTo(TranslatedText.addressesIn(original));
		assertThat(TranslatedText.addressesIn("See https://primer.rs/prijava?Ko=1#Gore or www.primer.rs/Staza, write to"
				+ " info@primer.rs.")).isNotEqualTo(TranslatedText.addressesIn(original));
		assertThat(TranslatedText.addressesIn("See https://primer.rs/Prijava?ko=1#Gore or www.primer.rs/Staza, write to"
				+ " info@primer.rs.")).isNotEqualTo(TranslatedText.addressesIn(original));
		assertThat(TranslatedText.addressesIn("See https://primer.rs/Prijava?Ko=1#gore or www.primer.rs/Staza, write to"
				+ " info@primer.rs.")).isNotEqualTo(TranslatedText.addressesIn(original));
		assertThat(TranslatedText.addressesIn("See https://primer.rs/Prijava?Ko=1#Gore or www.primer.rs/staza, write to"
				+ " info@primer.rs.")).isNotEqualTo(TranslatedText.addressesIn(original));
		assertThat(TranslatedText.addressesIn("[x](/Kalendar)")).containsExactly("/Kalendar");
		/* A target of the portal that carries an @ is not a mailbox, and keeps its case; a site with no path at all
		   ends where the text ends, and one whose path starts with a query or a fragment ends at that. */
		assertThat(TranslatedText.addressesIn("[x](/Ko@Primer/Staza)")).containsExactly("/Ko@Primer/Staza");
		assertThat(TranslatedText.addressesIn("Vidi HTTPS://Primer.RS")).containsExactly("https://primer.rs");
		assertThat(TranslatedText.addressesIn("Vidi www.Primer.RS?Ko=1 i www.Drugi.RS#Gore"))
				.containsExactly("www.drugi.rs#Gore", "www.primer.rs?Ko=1");
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
