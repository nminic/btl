package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE ENGLISH OF THE FIFTEEN DUCATS, WRITTEN INTO V115 BY HAND (owner, PDL P18, 25.11.2026, „Ja ih prevedem ručno"),
 * measured against the Serbian they translate.
 *
 * <p><b>Floor, derived from the table and not a list.</b> Every text of a ducat that says something has an English
 * row, and no text that says nothing has one: an empty legend is empty in English as well (the arc the period takes),
 * and a translation is never blank. So a sixteenth ducat, or a legend filled in tomorrow, fails here until somebody
 * writes its English.
 *
 * <p><b>And a legend is set along an arc</b>, so an English legend that is much longer than its Serbian would be set
 * smaller or would not fit: no English legend (top or bottom) is longer than the Serbian by more than three
 * characters, and the ones that are longer at all are named below so that the next reader does not have to count.
 */
class DucatTranslationTest extends DatabaseTest {

	private static final List<String> FIELDS = List.of("name", "top", "top_female", "bottom", "counted");

	private String serbianOf(String code, String field) {
		return db.sql("select " + field + " from ducat where code = ?").param(code).query(String.class).single();
	}

	private List<String> codes() {
		return db.sql("select code from ducat order by id").query(String.class).list();
	}

	@Test
	void everyTextThatSaysSomethingHasItsEnglishAndNoTextThatSaysNothingHasOne() {
		assertThat(codes()).hasSize(15);

		List<String> wrong = new ArrayList<>();

		for (String code : codes()) {
			for (String field : FIELDS) {
				boolean says = !serbianOf(code, field).isBlank();
				int rows = db.sql("select count(*) from text_translation t join ducat d on d.id = t.ducat_id"
								+ " where d.code = ? and t.field = ? and t.language = 'en' and t.origin = 'manual'")
						.params(code, field).query(Integer.class).single();

				if (says != (rows == 1)) {
					wrong.add(code + "." + field + (says ? " has no English" : " has an English of nothing"));
				}
			}
		}

		assertThat(wrong).isEmpty();
	}

	/** An English made of an older Serbian is not shown, so each row must be made of the Serbian that stands now. */
	@Test
	void everyEnglishIsMadeOfTheSerbianThatStandsToday() {
		for (String field : FIELDS) {
			assertThat(db.sql("select count(*) from text_translation t join ducat d on d.id = t.ducat_id"
							+ " where t.field = ? and t.source_digest <> encode(sha256(convert_to(d." + field
							+ ", 'UTF8')), 'hex')").param(field).query(Integer.class).single())
					.as(field).isZero();
		}
	}

	/** English has no grammatical gender: the woman's legend, where there is one, says what the man's says. */
	@Test
	void theWomansEnglishLegendIsTheMansBecauseEnglishDoesNotInflect() {
		assertThat(db.sql("select count(*) from ducat d join text_translation w on w.ducat_id = d.id"
						+ " and w.field = 'top_female' and w.language = 'en'"
						+ " join text_translation m on m.ducat_id = d.id and m.field = 'top' and m.language = 'en'"
						+ " where w.body <> m.body").query(Integer.class).single()).isZero();
	}

	@Test
	void noEnglishLegendIsLongerThanTheSerbianByMoreThanThree() {
		Map<String, Integer> longer = new java.util.TreeMap<>();

		for (String code : codes()) {
			for (String field : List.of("top", "bottom")) {
				String serbian = serbianOf(code, field);
				String english = db.sql("select t.body from text_translation t join ducat d on d.id = t.ducat_id"
								+ " where d.code = ? and t.field = ? and t.language = 'en'")
						.params(code, field).query(String.class).optional().orElse("");

				if (english.length() > serbian.length()) {
					longer.put(code + "." + field + " (" + serbian + " -> " + english + ")",
							english.length() - serbian.length());
				}
			}
		}

		assertThat(longer.values()).allMatch(by -> by <= 3);
		assertThat(longer.keySet()).containsExactlyInAnyOrder(
				"duk-drzave.bottom (DRŽAVA -> COUNTRIES)",
				"duk-krace-trke.top (ČLAN KLUBA -> CLUB MEMBER)",
				"duk-maratoni.bottom (BTL MARATONA -> BTL MARATHONS)",
				"duk-polumaratoni.bottom (BTL POLUMARATONA -> BTL HALF MARATHONS)",
				"duk-duze-trke.top (ČLAN KLUBA -> CLUB MEMBER)",
				"duk-maratoni.top (ČLAN KLUBA -> CLUB MEMBER)",
				"duk-polumaratoni.top (ČLAN KLUBA -> CLUB MEMBER)",
				"duk-ultramaratoni.top (ČLAN KLUBA -> CLUB MEMBER)",
				"duk-ultramaratoni.bottom (BTL ULTRAMARATONA -> BTL ULTRAMARATHONS)",
				"duk-sve-trke.bottom (TRKA -> RACES)",
				"duk-obim-planete.bottom (OKO PLANETE -> AROUND EARTH)");
	}
}
