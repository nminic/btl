package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SECTION 3 OF THE PRIVACY POLICY SAYS WHAT A NETWORK SHOWS WHEN SOMEBODY SHARES THE LINK OF HIS PROFILE (V102, owner,
 * 16.11.2026, PDL „Profil ima deljivu sliku za društvene mreže (OG sliku)", item 12), IN BOTH LANGUAGES, AND THE POLICY
 * IS SIGNED OFF ON THE DAY V102 GIVES IT.
 *
 * <p><b>Why this exists, and it is the other half of V102.</b> V102 adds one paragraph to section 3 in each language with
 * {@code replace()} calls. A replace is exact and has one failure mode, which is to match NOTHING and report success; the
 * migration itself refuses that, so what is held here is the other side: that the sentence the owner wrote is what the
 * portal serves in Serbian, word for word, that it stands as its own paragraph right after the list of what is public and
 * before the next heading, that it stands once on the three pages and nowhere else, and that V102 is what moves the day
 * of the policy and of no other page.
 *
 * <p><b>The English is the assistant's translation</b> and not the owner's wording, and the constant below says so. So is
 * the place in the section: the owner named the document and not the section.
 */
class TheWrittenPagesSayWhatASharedProfileShowsTest extends DatabaseTest {

	/**
	 * V107 (21.11.2026) later changed the pronoun of the sentences this file asks about, and moved the sign-off of the three
	 * documents, so what is asked here is asked of the text as V106 left it. The text the portal serves now is held by
	 * {@link TheWrittenPagesSpeakToTheReaderAsTiTest}.
	 */
	@BeforeEach
	void theTextAsV106LeftIt() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "118");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "114");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "110");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "107");
	}

	static final String POLICY = "politika-privatnosti";

	/** „Šta je javno, a šta nikada nije". */
	static final int WHAT_IS_PUBLIC = 3;

	/** The owner's sentence (PDL 16.11.2026), word for word. */
	static final String THE_SENTENCE_IN_SERBIAN =
			"Kad podelite link svog profila, društvene mreže i aplikacije za poruke prikazuju njegov pregled sa vašim imenom, odobrenom slikom i brojem trka i kilometara.";

	/** The assistant's translation, not the owner's wording. */
	static final String THE_SENTENCE_IN_ENGLISH =
			"When you share the link to your profile, social networks and messaging apps show its preview with your name, your approved picture, and the number of races and kilometres.";

	static final String THE_END_OF_THE_LIST_IN_SERBIAN = "i linkovi koje sami dodate.";
	static final String THE_END_OF_THE_LIST_IN_ENGLISH = "and links you add yourself.";

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

	/** The part of section 3 between the heading of what is public and the heading of what is not. */
	private String whatIsPublic(String language) {
		String body = bodyOf(POLICY, WHAT_IS_PUBLIC, language);
		String heading = language.equals("sr") ? "### Javno se prikazuje" : "### Publicly displayed";
		String next = language.equals("sr") ? "### Podaci koji nisu javni" : "### Data that is not public";

		assertThat(body).as("%s section 3 has not the two headings", language).containsOnlyOnce(heading).containsOnlyOnce(next);

		return body.substring(body.indexOf(heading) + heading.length(), body.indexOf(next));
	}

	/** The paragraphs under „Javno se prikazuje": the list as it was, and then the sentence, and nothing else. */
	@Test
	void theSentenceIsTheSecondParagraphOfWhatIsPublicInBothLanguages() {
		for (String language : List.of("sr", "en")) {
			boolean serbian = language.equals("sr");
			List<String> paragraphs = List.of(whatIsPublic(language).strip().split("\n\n"));

			assertThat(paragraphs).as("the %s part of what is public is not the list and the sentence", language).hasSize(2);
			assertThat(paragraphs.get(0)).as("the %s list moved or changed", language)
					.startsWith(serbian ? "Ime i prezime, članski broj," : "First and last name, member number,")
					.endsWith(serbian ? THE_END_OF_THE_LIST_IN_SERBIAN : THE_END_OF_THE_LIST_IN_ENGLISH);
			assertThat(paragraphs.get(1)).isEqualTo(serbian ? THE_SENTENCE_IN_SERBIAN : THE_SENTENCE_IN_ENGLISH);
		}
	}

	/** THE SENTENCE STANDS IN SECTION 3 OF THE POLICY AND NOWHERE ELSE, in either language: a second home would say it twice. */
	@Test
	void theSentenceStandsOnceOnTheThreePagesInEachLanguage() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				Pattern.compile(Pattern.quote(THE_SENTENCE_IN_SERBIAN))))
				.containsExactly(POLICY + " #" + WHAT_IS_PUBLIC);
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				Pattern.compile(Pattern.quote(THE_SENTENCE_IN_ENGLISH))))
				.containsExactly(POLICY + " #" + WHAT_IS_PUBLIC);
	}

	@Test
	void theTableNamesEveryEditV102Makes() {
		assertThat(migrationSql("102").split("\\$old\\$", -1).length - 1)
				.as("V102 carries an edit that this file does not name (or this file names one V102 lacks): one paragraph and one"
						+ " sign-off in each language, each written between two $old$ marks")
				.isEqualTo(4 * 2);
	}

	/**
	 * THE POLICY IS SIGNED OFF ON THE SIXTEENTH OF NOVEMBER, IN BOTH LANGUAGES, AND THE DAY IS MOVED BY V102 ITSELF: asked of
	 * the text the portal serves (a move in one language only, or to another day, fails it), and of V102, which must carry the
	 * move from the day V95 gave to the new one in each language. The rulebook and the terms keep theirs.
	 */
	@Test
	void thePolicyReadsTheSixteenthOfNovemberInBothLanguagesAndV102IsWhatMovesIt() {
		for (String language : List.of("sr", "en")) {
			boolean serbian = language.equals("sr");
			String mark = serbian ? "Poslednja izmena: " : "Last amended: ";

			assertThat(bodyOf(POLICY, 7, language)).as("the %s policy ends with its sign-off", language)
					.endsWith(mark + "16.11.2026.")
					.containsOnlyOnce(mark).doesNotContain("11.11.2026");
			assertThat(bodyOf("pravilnik", 19, language)).as("the %s rulebook keeps its day", language)
					.endsWith(mark + "15.11.2026.");
			assertThat(bodyOf("uslovi-koriscenja", 11, language)).as("the %s terms keep their day", language)
					.endsWith(mark + "11.11.2026.");
			assertThat(migrationSql("102")).as("V102 does not move the %s sign-off from the day V95 gave it", language)
					.contains("$old$" + mark + "11.11.2026.$old$")
					.contains("$new$" + mark + "16.11.2026.$new$");
		}
	}
}
