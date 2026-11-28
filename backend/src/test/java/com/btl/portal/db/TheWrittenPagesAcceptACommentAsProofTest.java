package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE RULEBOOK SAYS THAT A RESULT MAY BE PROVED BY A COMMENT ALONE, IN ARTICLES 33 AND 35, IN BOTH LANGUAGES, AND THE RULEBOOK, AND
 * ONLY THE RULEBOOK, IS SIGNED OFF ON 28.11.2026 (V118, owner, 28.11.2026: „Potvrđujem član 35 i 33.”, PDL, the entry „Pravilnik o
 * tekstu kao dokazu”; the Serbian words are the assistant's proposal approved without a change, the English is the assistant's).
 *
 * <p><b>What is held here, and what is held elsewhere.</b> {@code PageApiTest} compares the Serbian answer of this server with the
 * words of the sections and {@code writtenVerification.test.ts} holds {@code pages.json} to the snapshot. What those cannot say is
 * PLACE and COMPANY: that the new sentence is the THIRD of Article 35, between the one about the picture's reason and the one that
 * says the picture is deleted (and not first, last, or in Article 33), that Article 33 names the evidence in both languages and not
 * in one, that the words stand in the one section of each language that holds them, and that every other text is what it was.
 *
 * <p>What V118 does to a text that is already there is asked by {@link TheWrittenPagesAcceptACommentAsProofCarriedOverTest}.
 */
class TheWrittenPagesAcceptACommentAsProofTest extends DatabaseTest {

	static final String RULEBOOK = "pravilnik";
	static final String TERMS = "uslovi-koriscenja";
	static final String POLICY = "politika-privatnosti";

	/** Articles 33 and 35 are both in section 9 of the rulebook, and its sign-off is at the end of section 19. */
	static final int THE_ARTICLES = 9;
	static final int THE_SIGN_OFF = 19;

	static final String THE_OLD_PHRASE_IN_SERBIAN = "vreme i link ka zvaničnim rezultatima.";
	static final String THE_PHRASE_IN_SERBIAN = "vreme i dokaz: link ka zvaničnim rezultatima, sliku ili komentar.";
	static final String THE_OLD_PHRASE_IN_ENGLISH = "the time, and a link to the official results.";
	static final String THE_PHRASE_IN_ENGLISH = "the time, and the evidence: a link to the official results, a picture, or a comment.";

	/** The owner's sentence, exactly as he approved it. */
	static final String THE_THIRD_SENTENCE_IN_SERBIAN = "Ako nemaš ni link ni sliku, dovoljno je da u komentaru napišeš odakle je rezultat,"
			+ " na primer ko je merio i gde je objavljen.";
	static final String THE_THIRD_SENTENCE_IN_ENGLISH = "If you have neither a link nor a picture, it is enough to write in a comment"
			+ " where the result comes from, for example who timed it and where it was published.";

	/** Article 35 in full, as the portal serves it, the three sentences in their order. */
	static final String ARTICLE_35_IN_SERBIAN = "### Član 35. Dokazi\n\n"
			+ "Dovoljan je link ka zvaničnim rezultatima. Ako ga nemaš, pošalji sliku, na primer snimak sata ili diplomu, i kratko napiši"
			+ " zašto linka nema i šta se na slici vidi. " + THE_THIRD_SENTENCE_IN_SERBIAN + " Sliku brišemo čim proverimo rezultat.";
	static final String ARTICLE_35_IN_ENGLISH = "### Article 35. Evidence\n\n"
			+ "A link to the official results is enough. If you do not have one, send a picture, for example a watch screenshot or a"
			+ " certificate, and briefly say why there is no link and what the picture shows. " + THE_THIRD_SENTENCE_IN_ENGLISH
			+ " We delete the picture as soon as we have checked the result.";

	static final String SIGN_OFF_BEFORE_IN_SERBIAN = "Poslednja izmena: 21.11.2026.";
	static final String SIGN_OFF_BEFORE_IN_ENGLISH = "Last amended: 21.11.2026.";
	static final String SIGN_OFF_IN_SERBIAN = "Poslednja izmena: 28.11.2026.";
	static final String SIGN_OFF_IN_ENGLISH = "Last amended: 28.11.2026.";

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

	/** ARTICLE 35 ENDS WITH THE THREE SENTENCES IN THEIR ORDER, in each language, and the new one is the middle of the three. */
	@Test
	void articleThirtyFiveHasTheCommentSentenceBetweenThePictureAndItsDeletion() {
		assertThat(bodyOf(RULEBOOK, THE_ARTICLES, "sr")).endsWith(ARTICLE_35_IN_SERBIAN).containsOnlyOnce(THE_THIRD_SENTENCE_IN_SERBIAN);
		assertThat(bodyOf(RULEBOOK, THE_ARTICLES, "en")).endsWith(ARTICLE_35_IN_ENGLISH).containsOnlyOnce(THE_THIRD_SENTENCE_IN_ENGLISH);
	}

	/** ARTICLE 33 NAMES THE EVIDENCE, in both languages, and the phrase it replaces is gone; the rest of the article is the old one. */
	@Test
	void articleThirtyThreeNamesTheEvidenceInBothLanguages() {
		String serbian = bodyOf(RULEBOOK, THE_ARTICLES, "sr");
		String english = bodyOf(RULEBOOK, THE_ARTICLES, "en");

		assertThat(serbian).containsOnlyOnce(THE_PHRASE_IN_SERBIAN).doesNotContain(THE_OLD_PHRASE_IN_SERBIAN);
		assertThat(english).containsOnlyOnce(THE_PHRASE_IN_ENGLISH).doesNotContain(THE_OLD_PHRASE_IN_ENGLISH);
		assertThat(serbian).contains("Upisuješ događaj i trku, dužinu, uspon i spust, " + THE_PHRASE_IN_SERBIAN
				+ " Kad izabereš trku iz kalendara");
		assertThat(english).contains("You enter the event and the race, the length, the ascent and descent, " + THE_PHRASE_IN_ENGLISH
				+ " When you pick a race from the calendar");
	}

	/** THE WORDS STAND IN THAT ONE SECTION OF EACH LANGUAGE AND NOWHERE ELSE: the terms only point at the rulebook, and say none of it. */
	@Test
	void theCommentSentenceStandsInOneSectionOfEachLanguageAndNowhereElse() {
		List<String> places = db.sql("select place from (select p.slug || ' #' || s.position || ' sr' as place, s.body"
						+ " from static_page_section s join static_page p on p.id = s.page_id"
						+ " union all select p.slug || ' #' || s.position || ' ' || t.language, t.body"
						+ " from static_page_section_translation t join static_page_section s on s.id = t.section_id"
						+ " join static_page p on p.id = s.page_id) every_text"
						+ " where body like '%ko je merio%' or body like '%who timed it%' order by place")
				.query(String.class).list();

		assertThat(places).containsExactly(RULEBOOK + " #9 en", RULEBOOK + " #9 sr");
	}

	/** THE RULEBOOK IS SIGNED OFF ON THE DAY V118 GIVES IT, in both languages and once; the terms and the policy keep their days. */
	@Test
	void theRulebookAloneIsSignedOffOnTheTwentyEighthOfNovemberInBothLanguages() {
		assertThat(bodyOf(RULEBOOK, THE_SIGN_OFF, "sr")).endsWith(SIGN_OFF_IN_SERBIAN).containsOnlyOnce("Poslednja izmena: ")
				.doesNotContain("21.11.2026");
		assertThat(bodyOf(RULEBOOK, THE_SIGN_OFF, "en")).endsWith(SIGN_OFF_IN_ENGLISH).containsOnlyOnce("Last amended: ")
				.doesNotContain("21.11.2026");

		assertThat(bodyOf(TERMS, 11, "sr")).endsWith(SIGN_OFF_BEFORE_IN_SERBIAN);
		assertThat(bodyOf(TERMS, 11, "en")).endsWith(SIGN_OFF_BEFORE_IN_ENGLISH);
		assertThat(bodyOf(POLICY, 7, "sr")).endsWith("Poslednja izmena: 25.11.2026.");
		assertThat(bodyOf(POLICY, 7, "en")).endsWith("Last amended: 25.11.2026.");
	}

	/**
	 * V118 TOUCHES NOTHING ELSE, asked as behaviour: with V118 undone, every heading and body of both tables is what it is with it
	 * applied, except section 9 and section 19 of the rulebook in both languages, and those differ only by the three edits.
	 */
	@Test
	void everyOtherTextIsTheSameWithV118UndoneAsWithItApplied() {
		Map<String, String> applied = everyTextByPlace();

		TheWrittenPagesBeforeV71.undoBodyEdits(db, "118");

		Map<String, String> undone = everyTextByPlace();

		assertThat(undone).as("undoing V118 changed nothing, so this measures nothing").isNotEqualTo(applied);
		assertThat(undone.keySet()).isEqualTo(applied.keySet());

		List<String> changed = applied.keySet().stream().filter(key -> !applied.get(key).equals(undone.get(key))).toList();

		assertThat(changed).containsExactlyInAnyOrder(RULEBOOK + " #9 sr", RULEBOOK + " #9 en", RULEBOOK + " #19 sr", RULEBOOK + " #19 en");

		assertThat(undone.get(RULEBOOK + " #9 sr"))
				.isEqualTo(applied.get(RULEBOOK + " #9 sr").replace(THE_PHRASE_IN_SERBIAN, THE_OLD_PHRASE_IN_SERBIAN)
						.replace(" " + THE_THIRD_SENTENCE_IN_SERBIAN, ""));
		assertThat(undone.get(RULEBOOK + " #9 en"))
				.isEqualTo(applied.get(RULEBOOK + " #9 en").replace(THE_PHRASE_IN_ENGLISH, THE_OLD_PHRASE_IN_ENGLISH)
						.replace(" " + THE_THIRD_SENTENCE_IN_ENGLISH, ""));
		assertThat(undone.get(RULEBOOK + " #19 sr")).endsWith(SIGN_OFF_BEFORE_IN_SERBIAN)
				.isEqualTo(applied.get(RULEBOOK + " #19 sr").replace(SIGN_OFF_IN_SERBIAN, SIGN_OFF_BEFORE_IN_SERBIAN));
		assertThat(undone.get(RULEBOOK + " #19 en")).endsWith(SIGN_OFF_BEFORE_IN_ENGLISH)
				.isEqualTo(applied.get(RULEBOOK + " #19 en").replace(SIGN_OFF_IN_ENGLISH, SIGN_OFF_BEFORE_IN_ENGLISH));
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
