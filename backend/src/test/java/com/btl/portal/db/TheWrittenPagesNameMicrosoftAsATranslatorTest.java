package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PRIVACY POLICY NAMES MICROSOFT (AZURE TRANSLATOR) AS A PROCESSOR, IN BOTH LANGUAGES, IN SECTION 5, AND THE POLICY, AND ONLY
 * THE POLICY, IS SIGNED OFF ON 25.11.2026 (V114, owner, 25.11.2026, PDL P18, anchor „Red u Politici privatnosti, odeljak 5”; he
 * approved the assistant's proposal without a change, with the words „Upiši ovako”).
 *
 * <p><b>What is held here, and what is held elsewhere.</b> {@code PageApiTest} compares the Serbian and English answer of this
 * server with the words of the row and the day; {@code writtenVerification.test.ts} holds {@code pages.json} to the snapshot. What
 * those cannot say is PLACE and COMPANY: that the row stands in that one section of each language, directly under Zoho and directly
 * above the bank (and not above Zoho, below the bank, or in a neighbouring section), that it stands in both languages and not in one,
 * that no other section of any page names Microsoft, and that every other text is what it was. That is what is asked here, on the
 * words as the owner approved them, written out in full: one line of one table, so a changed letter is a failure.
 *
 * <p>What V114 does to a text that is already there is asked by {@link TheWrittenPagesNameMicrosoftAsATranslatorCarriedOverTest}.
 */
class TheWrittenPagesNameMicrosoftAsATranslatorTest extends DatabaseTest {

	static final String POLICY = "politika-privatnosti";
	static final String TERMS = "uslovi-koriscenja";
	static final String RULEBOOK = "pravilnik";

	/** The table „Kome prosleđujemo" / „Who we pass it to" is in section 5, and the sign-off is at the end of section 7. */
	static final int THE_TABLE_OF_PROCESSORS = 5;
	static final int THE_SIGN_OFF = 7;

	static final String ZOHO_IN_SERBIAN = "| Zoho Corporation | Prepiska sa adresom info@: tvoja adresa i sadržaj poruka | SAD |";
	static final String ZOHO_IN_ENGLISH =
			"| Zoho Corporation | Correspondence with info@: your address and the content of the messages | USA |";
	static final String BANK_IN_SERBIAN = "| Poslovna banka Udruženja | Podaci sa naloga za uplatu | Srbija |";
	static final String BANK_IN_ENGLISH = "| The Association's business bank | Data from the payment order | Serbia |";

	/** The owner's words, exactly as he approved them. */
	static final String THE_ROW_IN_SERBIAN =
			"| Microsoft (usluga Azure Translator) | Tekst koji je odobren za objavu na portalu (tvoja biografija, opis tima, opis događaja, odobren komentar), da bi ga posetilac video i na drugom jeziku. Ne dobija tvoje ime, adresu ni članski broj, i ne čuva tekst posle prevoda | EU |";
	static final String THE_ROW_IN_ENGLISH =
			"| Microsoft (Azure Translator service) | Text approved for publication on the portal (your biography, team description, event description, an approved comment), so that a visitor can also read it in another language. It does not receive your name, address or member number, and does not keep the text after translating it | EU |";

	static final String SIGN_OFF_BEFORE_IN_SERBIAN = "Poslednja izmena: 24.11.2026.";
	static final String SIGN_OFF_BEFORE_IN_ENGLISH = "Last amended: 24.11.2026.";
	static final String SIGN_OFF_IN_SERBIAN = "Poslednja izmena: 25.11.2026.";
	static final String SIGN_OFF_IN_ENGLISH = "Last amended: 25.11.2026.";

	private String bodyOf(String slug, int position, String language) {
		return language.equals("sr")
				? db.sql("select s.body from static_page_section s join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position")
						.param("slug", slug).param("position", position).query(String.class).single()
				: db.sql("select t.body from static_page_section_translation t"
								+ " join static_page_section s on s.id = t.section_id join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position and t.language = :language")
						.param("slug", slug).param("position", position).param("language", language)
						.query(String.class).single();
	}

	private static String row(String language) {
		return language.equals("sr") ? THE_ROW_IN_SERBIAN : THE_ROW_IN_ENGLISH;
	}

	/**
	 * THE ROW STANDS DIRECTLY UNDER ZOHO AND DIRECTLY ABOVE THE BANK, once, in each language, and in the table of its own section:
	 * the three lines in that order are the only place Microsoft is in, and the rows around it are what they were word for word.
	 */
	@Test
	void theRowStandsBetweenZohoAndTheBankInBothLanguages() {
		String serbian = bodyOf(POLICY, THE_TABLE_OF_PROCESSORS, "sr");
		String english = bodyOf(POLICY, THE_TABLE_OF_PROCESSORS, "en");

		assertThat(serbian).containsOnlyOnce(ZOHO_IN_SERBIAN + "\n" + THE_ROW_IN_SERBIAN + "\n" + BANK_IN_SERBIAN);
		assertThat(english).containsOnlyOnce(ZOHO_IN_ENGLISH + "\n" + THE_ROW_IN_ENGLISH + "\n" + BANK_IN_ENGLISH);
		assertThat(serbian).containsOnlyOnce("### Kome prosleđujemo");
		assertThat(english).containsOnlyOnce("### Who we pass it to");

		for (String language : List.of("sr", "en")) {
			String body = bodyOf(POLICY, THE_TABLE_OF_PROCESSORS, language);
			List<String> rows = body.substring(body.indexOf(language.equals("sr") ? "### Kome prosleđujemo" : "### Who we pass it to"))
					.lines().filter(line -> line.startsWith("| ")).toList();

			assertThat(rows).as("the table of processors in %s", language).hasSize(8);
			assertThat(rows.get(6)).as("the seventh line of the table in %s is the new row, under Zoho", language).isEqualTo(row(language));
		}
	}

	/** NO OTHER SECTION OF ANY PAGE, IN EITHER LANGUAGE, NAMES MICROSOFT OR THE SERVICE, and each language's row is in its own language only. */
	@Test
	void microsoftIsNamedInThatOneSectionOfEachLanguageAndNowhereElse() {
		List<String> places = db.sql("select place from (select p.slug || ' #' || s.position || ' sr' as place, s.body"
						+ " from static_page_section s join static_page p on p.id = s.page_id"
						+ " union all select p.slug || ' #' || s.position || ' ' || t.language, t.body"
						+ " from static_page_section_translation t join static_page_section s on s.id = t.section_id"
						+ " join static_page p on p.id = s.page_id) every_text where body like '%Microsoft%' or body like '%Azure%'"
						+ " order by place")
				.query(String.class).list();

		assertThat(places).containsExactly(POLICY + " #5 en", POLICY + " #5 sr");

		assertThat(bodyOf(POLICY, THE_TABLE_OF_PROCESSORS, "sr")).doesNotContain("Azure Translator service")
				.doesNotContain("Text approved for publication");
		assertThat(bodyOf(POLICY, THE_TABLE_OF_PROCESSORS, "en")).doesNotContain("usluga Azure Translator")
				.doesNotContain("Tekst koji je odobren");
	}

	/**
	 * THE POLICY IS SIGNED OFF ON THE DAY V114 GIVES IT, in both languages and once, and the terms and the rulebook keep the day V107
	 * gave them; the policy's old day is not served in either language.
	 */
	@Test
	void thePolicyAloneIsSignedOffOnTheTwentyFifthOfNovemberInBothLanguages() {
		assertThat(bodyOf(POLICY, THE_SIGN_OFF, "sr")).endsWith(SIGN_OFF_IN_SERBIAN).containsOnlyOnce("Poslednja izmena: ")
				.doesNotContain("24.11.2026");
		assertThat(bodyOf(POLICY, THE_SIGN_OFF, "en")).endsWith(SIGN_OFF_IN_ENGLISH).containsOnlyOnce("Last amended: ")
				.doesNotContain("24.11.2026");

		for (String language : List.of("sr", "en")) {
			String signed = language.equals("sr") ? "Poslednja izmena: 21.11.2026." : "Last amended: 21.11.2026.";

			assertThat(bodyOf(TERMS, 11, language)).as("the terms in %s", language).endsWith(signed);
			assertThat(bodyOf(RULEBOOK, 19, language)).as("the rulebook in %s", language).endsWith(signed);
		}
	}

	/**
	 * V114 TOUCHES NOTHING ELSE, asked as behaviour: with V114 undone, every heading and body of both tables is what it is with it
	 * applied, except sections 5 and 7 of the policy in both languages, and those differ only by the row and the day.
	 */
	@Test
	void everyOtherTextIsTheSameWithV114UndoneAsWithItApplied() {
		Map<String, String> applied = everyTextByPlace();

		TheWrittenPagesBeforeV71.undoBodyEdits(db, "114");

		Map<String, String> undone = everyTextByPlace();

		assertThat(undone).as("undoing V114 changed nothing, so this measures nothing").isNotEqualTo(applied);
		assertThat(undone.keySet()).isEqualTo(applied.keySet());

		List<String> changed = applied.keySet().stream().filter(key -> !applied.get(key).equals(undone.get(key))).toList();

		assertThat(changed).containsExactlyInAnyOrder(POLICY + " #5 sr", POLICY + " #5 en", POLICY + " #7 sr", POLICY + " #7 en");

		assertThat(undone.get(POLICY + " #5 sr")).doesNotContain("Microsoft")
				.isEqualTo(applied.get(POLICY + " #5 sr").replace(THE_ROW_IN_SERBIAN + "\n", ""));
		assertThat(undone.get(POLICY + " #5 en")).doesNotContain("Microsoft")
				.isEqualTo(applied.get(POLICY + " #5 en").replace(THE_ROW_IN_ENGLISH + "\n", ""));
		assertThat(undone.get(POLICY + " #7 sr")).endsWith(SIGN_OFF_BEFORE_IN_SERBIAN)
				.isEqualTo(applied.get(POLICY + " #7 sr").replace(SIGN_OFF_IN_SERBIAN, SIGN_OFF_BEFORE_IN_SERBIAN));
		assertThat(undone.get(POLICY + " #7 en")).endsWith(SIGN_OFF_BEFORE_IN_ENGLISH)
				.isEqualTo(applied.get(POLICY + " #7 en").replace(SIGN_OFF_IN_ENGLISH, SIGN_OFF_BEFORE_IN_ENGLISH));
	}

	/** Every heading and body of both tables, by page, place and language, so two readings compare row by row. */
	private Map<String, String> everyTextByPlace() {
		Map<String, String> texts = new TreeMap<>();

		db.sql("select p.slug || ' #' || s.position || ' sr' as key, s.heading || E'\\n' || s.body from static_page_section s"
						+ " join static_page p on p.id = s.page_id")
				.query((row, number) -> Map.entry(row.getString(1), row.getString(2)))
				.list().forEach(each -> texts.put(each.getKey(), each.getValue()));
		db.sql("select p.slug || ' #' || s.position || ' ' || t.language, t.heading || E'\\n' || t.body"
						+ " from static_page_section_translation t join static_page_section s on s.id = t.section_id"
						+ " join static_page p on p.id = s.page_id")
				.query((row, number) -> Map.entry(row.getString(1), row.getString(2)))
				.list().forEach(each -> texts.put(each.getKey(), each.getValue()));

		assertThat(texts).as("there is no page text at all, so this case measures nothing").isNotEmpty();

		return texts;
	}
}
