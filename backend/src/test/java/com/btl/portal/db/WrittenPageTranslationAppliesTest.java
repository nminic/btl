package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V43's OWN SQL, run against the Serbian rows it translates - {@link StaticPageSectionTextCarriedOverTest}'s
 * shape (run the migration Flyway resolved, not a copy of its statements, inside the test's own
 * transaction), adapted for a migration whose data half is INSERT rather than UPDATE.
 *
 * <p><b>Why there is no "before" fixture here, unlike that file's.</b> V41 updates rows that
 * already carried text; V43 fills two tables V37 shipped and left EMPTY (its own header: "THIS
 * MIGRATION CARRIES NO TEXT"). So the state immediately before V43 runs is simply nothing, and
 * reproducing it is one DELETE rather than a hand written BEFORE string.
 *
 * <p><b>Why this exists alongside {@code PageApiTest}.</b> Every language case there writes its
 * OWN synthetic rows, under a tag V43 never uses (see {@code PageApiTest.A_LANGUAGE_THESE_FIXTURES_OWN}),
 * and rolls them back - none of those cases has ever run against what V43 actually ships. This
 * file is the first thing that does: it re-executes V43's real statements, read out of the file by
 * {@link DatabaseTest#migrationSql}, over the exact Serbian rows V24 (and, where V26 rewrote a
 * section, V26) already seeded, which is the task instruction's own phrase for why it is needed -
 * "prva prilika da se ta grana koda izvrsi" against real content rather than a fixture.
 *
 * <p><b>What is asserted is STRUCTURE derived from the Serbian row standing next to it, never a
 * second copy of the English prose.</b> A hand written expected string for a legal text is a
 * second home for the translation, going stale the moment either copy is touched - the same
 * reason {@code PageApiTest}'s own header gives for comparing the Serbian answer to
 * {@code pages.json} field by field instead of literal by literal, and the reason V26's header
 * gives for transcribing rather than retyping. So each case reads the SERBIAN section that is
 * already the schema's source of truth and checks that the ENGLISH row next to it keeps the same
 * shape it had: one row per Serbian section, the same count of markdown table rows, the gallery
 * mark surviving as a whole line wherever the Serbian carries one.
 */
class WrittenPageTranslationAppliesTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/**
	 * Every slug V43 has translated to English AS OF THIS COMMIT to this file.
	 *
	 * <p>Extended by hand, one entry per commit to V43 - there is no table this could be derived
	 * from that is not itself V43 in the middle of being written. Now equal to the four slugs
	 * {@code static_page} carries, since politika-privatnosti and uslovi-koriscenja landed once
	 * V41 (branch b143, merged as 5f464318) settled which Serbian text they translate.
	 */
	private static final List<String> TRANSLATED_SO_FAR =
			List.of("rec-predsednika", "pravilnik", "politika-privatnosti", "uslovi-koriscenja");

	private static final Pattern TABLE_ROW = Pattern.compile("(?m)^\\|.*\\|\\s*$");
	private static final String MARK = "[[gallery]]";

	/**
	 * Re-runs V43's OWN file over the empty state its two tables are in immediately before it.
	 *
	 * <p>Not asserted to clear any particular number of rows: a later commit to this same file
	 * may run this method against a database where an earlier page's rows already stand, and all
	 * that matters here is that the two tables are empty before {@code migrationSql} runs, exactly
	 * as they are the moment before V43 first applies.
	 */
	private void reapply() {
		db.sql("delete from static_page_section_translation").update();
		db.sql("delete from static_page_translation").update();

		jdbc.execute(migrationSql("43"));
	}

	@ParameterizedTest
	@ValueSource(strings = { "rec-predsednika", "pravilnik", "politika-privatnosti", "uslovi-koriscenja" })
	void everySerbianSectionOfATranslatedPageHasExactlyOneEnglishCounterpart(String slug) {
		reapply();

		List<Integer> serbianPositions = db
				.sql("select s.position from static_page_section s join static_page p on p.id = s.page_id"
						+ " where p.slug = :slug order by s.position")
				.param("slug", slug)
				.query(Integer.class)
				.list();

		List<Integer> englishPositions = db
				.sql("select s.position from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " join static_page_section_translation st on st.section_id = s.id"
						+ " where p.slug = :slug and st.language = 'en' order by s.position")
				.param("slug", slug)
				.query(Integer.class)
				.list();

		/* Named by POSITION, not just counted, so a failure over the rulebook's nineteen sections
		   says which one is missing rather than "the two lists disagree" - the task's own mutation
		   1 asks for the missing section to be named, not just a mismatched count. */
		List<Integer> missing = serbianPositions.stream().filter(p -> !englishPositions.contains(p)).toList();
		List<Integer> extra = englishPositions.stream().filter(p -> !serbianPositions.contains(p)).toList();

		assertThat(missing)
				.as("%s section(s) at position(s) %s have no English row, so PageApi serves the whole"
						+ " page in Serbian (\"whole or nothing\")", slug, missing)
				.isEmpty();
		assertThat(extra)
				.as("%s carries English row(s) at position(s) %s that name no Serbian section", slug, extra)
				.isEmpty();
		assertThat(englishPositions)
				.as("%s's English sections are not in the same order as the Serbian ones", slug)
				.isEqualTo(serbianPositions);

		Long titles = db
				.sql("select count(*) from static_page_translation t join static_page p on p.id = t.page_id"
						+ " where p.slug = :slug and t.language = 'en'")
				.param("slug", slug)
				.query(Long.class)
				.single();

		assertThat(titles).as("%s has no English title row, or more than one", slug).isEqualTo(1L);
	}

	@ParameterizedTest
	@ValueSource(strings = { "rec-predsednika", "pravilnik", "politika-privatnosti", "uslovi-koriscenja" })
	void aTranslatedSectionKeepsTheSameNumberOfMarkdownTableRowsAsTheSerbianOriginal(String slug) {
		/* NOT reapply(), AND THAT IS ON PURPOSE (V57, 10.10.2026). This case sets the Serbian text as it stands
		   today against the English beside it. Run over V43's own English it compared today's Serbian with the
		   English of 28.09.2026, which agreed only while every migration after V43 kept the number of table
		   rows: V57 adds one row to the privacy policy's table of what a member enters, in both languages, and
		   V43's English cannot have it. Asked of the rows as they stand, the question is the one this case is
		   named for, and a later migration that adds a row to one language only fails here. What V43 itself
		   wrote is still held by every other case of this class, which re-runs it. */

		record Bodies(String serbian, String english) {
		}

		List<Bodies> pairs = db
				.sql("select s.body, st.body from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " join static_page_section_translation st on st.section_id = s.id"
						+ " where p.slug = :slug and st.language = 'en' order by s.position")
				.param("slug", slug)
				.query((row, i) -> new Bodies(row.getString(1), row.getString(2)))
				.list();

		assertThat(pairs).as("%s has no translated section to compare table rows on", slug).isNotEmpty();

		for (Bodies pair : pairs) {
			long serbianRows = TABLE_ROW.matcher(pair.serbian()).results().count();
			long englishRows = TABLE_ROW.matcher(pair.english()).results().count();

			assertThat(englishRows)
					.as("a markdown table in %s gained or lost a row in translation", slug)
					.isEqualTo(serbianRows);
		}
	}

	@ParameterizedTest
	@ValueSource(strings = { "rec-predsednika", "pravilnik", "politika-privatnosti", "uslovi-koriscenja" })
	void aTranslatedSectionThatCarriesADrawingKeepsTheMarkAsAWholeLine(String slug) {
		reapply();

		List<String> englishBodiesWithADrawing = db
				.sql("select st.body from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " join static_page_section_translation st on st.section_id = s.id"
						+ " where p.slug = :slug and st.language = 'en' and s.gallery is not null")
				.param("slug", slug)
				.query(String.class)
				.list();

		for (String body : englishBodiesWithADrawing) {
			assertThat(body.lines().map(String::strip).toList())
					.as("%s carries a drawing but its translation lost the [[gallery]] line", slug)
					.contains(MARK);
		}
	}

	/**
	 * Every slug this migration has reached so far is one {@link #TRANSLATED_SO_FAR} names, and
	 * every one it names is really whole - the floor under the three cases above, which only run
	 * over the slugs somebody remembered to list.
	 */
	@Test
	void everyPageV43HasReachedIsListedAndEveryListedPageIsWhole() {
		reapply();

		List<String> reallyTranslated = db
				.sql("select p.slug from static_page p"
						+ " join static_page_translation t on t.page_id = p.id and t.language = 'en'")
				.query(String.class)
				.list();

		assertThat(reallyTranslated)
				.as("V43 gave a page an English title that TRANSLATED_SO_FAR does not list, so the"
						+ " cases above never look at it")
				.containsExactlyInAnyOrderElementsOf(TRANSLATED_SO_FAR);
	}

	/**
	 * The literal tokens task rule 5 forbids translating, still present byte for byte after V43
	 * runs. Named for {@code rec-predsednika} specifically rather than swept generically: the
	 * tokens differ page by page and section by section, and a generic sweep would need the
	 * Serbian value written down a second time to compare against - the exact duplication the
	 * class header explains this file exists to avoid.
	 */
	@Test
	void theUntranslatableTokensOfRecPredsednikaSurvive() {
		reapply();

		String english = db
				.sql("select st.body from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " join static_page_section_translation st on st.section_id = s.id"
						+ " where p.slug = 'rec-predsednika' and st.language = 'en'")
				.query(String.class)
				.single();

		assertThat(english)
				.as("the association's e-mail address must survive translation unchanged (task rule 5)")
				.contains("[info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net)");
		assertThat(english)
				.as("the link to the rulebook must keep its Serbian slug (PDL P18: the path is never"
						+ " translated, only the language prefix)")
				.contains("(/pravilnik)");
		assertThat(english)
				.as("the president's own name is a person's name, and task rule 5 forbids translating"
						+ " a name")
				.contains("Nikola Minić");
	}

	/**
	 * The rulebook's own untranslatable tokens: three competition names PDL P18 forbids
	 * translating ("Nazivi trka i mesta ostaju u originalu, bez prevoda, na svim jezicima"), the
	 * one race name used as an illustrative example in Article 20, and the two internal links
	 * Article 76 points at, whose slugs stay Serbian by the same rule that keeps this page's own
	 * address as {@code /pravilnik} in English.
	 */
	@Test
	void theUntranslatableTokensOfThePravilnikSurvive() {
		reapply();

		String whole = String.join("\n", db
				.sql("select st.body from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " join static_page_section_translation st on st.section_id = s.id"
						+ " where p.slug = 'pravilnik' and st.language = 'en' order by s.position")
				.query(String.class)
				.list());

		assertThat(whole)
				.as("BTL's own competition names are proper names and PDL P18 forbids translating"
						+ " them on any language")
				.contains("Round 'n' Around", "BTL dezorijentiring", "BTL sreda");
		assertThat(whole)
				.as("the illustrative relay example names a real race, which rule 5 forbids"
						+ " translating even though the words around it are translated")
				.contains("Beogradski maraton");
		assertThat(whole)
				.as("Article 76 links to the privacy policy and the terms of use by their Serbian"
						+ " slugs, which the language prefix and not the path carries (PDL P18)")
				.contains("(/politika-privatnosti)")
				.contains("(/uslovi-koriscenja)");
	}

	/** The whole English text of one page, sections in position order, for cases that ask about
	 *  the page rather than about one section. */
	private String wholeEnglishBodyOf(String slug) {
		return String.join("\n", db
				.sql("select st.body from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " join static_page_section_translation st on st.section_id = s.id"
						+ " where p.slug = :slug and st.language = 'en' order by s.position")
				.param("slug", slug)
				.query(String.class)
				.list());
	}

	/**
	 * THE AUTHORITATIVE-VERSION SENTENCE (PDL.md, "Odredbu o merodavnosti nose SAMO engleske
	 * strane", 27.09.2026) IS ON EXACTLY THE THREE NAMED PAGES, NEVER ON rec-predsednika.
	 *
	 * <p>Pravilnik carries it as its own Article 4, translated with the rest of the article - not
	 * added beside it, so this asks for it once rather than twice. politika-privatnosti and
	 * uslovi-koriscenja carry no such sentence in Serbian at all (measured: neither page's current
	 * text, read from frontend/src/test/mock/pages.json after this branch merged V41 forward,
	 * contains "merodavna" anywhere), so English adds it - the two-state axis this task's own
	 * decision turns on: a page either already states which version binds (pravilnik) or it does
	 * not (the other two), and either way the ENGLISH answer must state it exactly once.
	 */
	@Test
	void theAuthoritativeVersionSentenceIsOnExactlyTheThreeNamedPagesAndNeverOnRecPredsednika() {
		reapply();

		String sentence = "the Serbian version is authoritative";

		for (String namedByPdl : List.of("pravilnik", "politika-privatnosti", "uslovi-koriscenja")) {
			String english = wholeEnglishBodyOf(namedByPdl);

			assertThat(countOccurrences(english, sentence))
					.as("%s's English translation must state exactly once that the Serbian version"
							+ " is authoritative (PDL.md names this page: \"politike privatnosti,"
							+ " uslova korišćenja i pravilnika\")", namedByPdl)
					.isEqualTo(1);
		}

		assertThat(wholeEnglishBodyOf("rec-predsednika"))
				.as("rec-predsednika is not one of the three pages PDL.md names (\"politike"
						+ " privatnosti, uslova korišćenja i pravilnika\"), so it must not carry"
						+ " the authoritative-version sentence")
				.doesNotContain(sentence);
	}

	private static int countOccurrences(String haystack, String needle) {
		int count = 0;
		int at = 0;

		while ((at = haystack.indexOf(needle, at)) != -1) {
			count++;
			at += needle.length();
		}

		return count;
	}

	/**
	 * ZERO MENTIONS OF A PAYMENT CARD IN EITHER PAGE V41 REMOVED THEM FROM, IN ENGLISH EITHER -
	 * AND THIS IS A NARROWER QUESTION THAN "ZERO MENTIONS OF THE WORD card".
	 *
	 * <p>V41's own {@code StaticPageSectionTextCarriedOverTest} enforces the Serbian half of this
	 * on the real migrated database, by searching the root "karti" rather than "kartic" - the
	 * word removed was "kartično", with č, and a search for the plain root would have missed it
	 * exactly as review's first pass did. Translated to English, "kartica" (payment card) and
	 * "lična karta" (ID card, a different Serbian word) both surface the English word "card", and
	 * the ID card is NOT one of the three sentences V41 removed - politika-privatnosti's own
	 * section 2 keeps "since an ID card is issued at 16" from V24's untouched wording. A first
	 * draft of this case asked {@code doesNotContainIgnoringCase("card")} and failed on exactly
	 * that correct sentence, which is the measurement that narrowed the question: not "does the
	 * word card appear" but "does the word card appear anywhere OTHER than in ID card".
	 */
	@Test
	void neitherPageV41ClearedOfAPaymentCardMentionsOneInEnglishEitherOutsideAnIdCard() {
		reapply();

		Pattern cardNotPartOfIdCard = Pattern.compile("(?<!ID )(?i:card)");

		for (String slug : List.of("politika-privatnosti", "uslovi-koriscenja")) {
			String english = wholeEnglishBodyOf(slug);
			List<String> matches = cardNotPartOfIdCard.matcher(english).results().map(m -> m.group()).toList();

			assertThat(matches)
					.as("%s's English translation mentions a card outside of \"ID card\", so it"
							+ " disagrees with the Serbian original V41 cleared of every payment-card"
							+ " mention", slug)
					.isEmpty();
		}

		/* THE POSITIVE CONTROL, on the one page that has it: without this, an exception written
		   too broadly (for example excluding the word "card" outright) would pass the loop above
		   for a reason that has nothing to do with matching ID card correctly - it would pass
		   because it excluded every card, the mistake the header above already measured once. */
		assertThat(wholeEnglishBodyOf("politika-privatnosti"))
				.as("politika-privatnosti no longer has the ID card sentence (V24's own wording,"
						+ " untouched by V41) at all, so the exception above is not proven to admit"
						+ " exactly ID card rather than every card")
				.contains("ID card");
	}

	/**
	 * ALL THREE LEGAL PAGES' ENGLISH SIGN-OFFS CARRY V41's DATE, 28.09.2026, AND NONE STILL CARRIES
	 * THE STALE 15.09.2026 V41 OVERWROTE IN SERBIAN.
	 *
	 * <p>Measured rather than assumed: pravilnik's English translation was written and committed
	 * BEFORE this branch merged V41 forward, against Article 4's own then-current sign-off date,
	 * and carried the stale date until this very check was added and failed against it once.
	 * politika-privatnosti and uslovi-koriscenja are written after the merge and so are checked
	 * for the same regression from the start rather than after the fact.
	 */
	private static final Pattern LEADING_NUMBER = Pattern.compile("^(\\d+)\\.");

	/**
	 * THE LEADING NUMBER OF AN ENGLISH HEADING EQUALS THE LEADING NUMBER OF THE SERBIAN HEADING
	 * PAIRED WITH IT BY (slug, position) - asked of the PAIR itself, never of a list, so it
	 * catches a swapped position on every page today and on any page this migration reaches
	 * tomorrow.
	 *
	 * <p><b>Why a list could not have caught this.</b> Independent review of PR 414 swapped only
	 * two literal position numbers in two of V43's subqueries (uslovi-koriscenja and
	 * politika-privatnosti, no other byte touched) and the full narrow gate over three test
	 * classes stayed green - because {@link #everySerbianSectionOfATranslatedPageHasExactlyOneEnglishCounterpart}
	 * only compares the SET of positions, and {@code PageApiTest} asked only
	 * {@code hasSize(7)}/{@code hasSize(12)} for those two pages rather than the pravilnik case's
	 * own {@code containsExactly} of all nineteen headings in order. A swap that keeps the same
	 * seven, or twelve, headings, only reattached to the wrong position, is invisible to a case
	 * that counts or that orders without naming.
	 *
	 * <p><b>The exception for rec-predsednika's one section is DERIVED, not named.</b> Its
	 * heading carries no number in either language ("Reč predsednika" / "President's word"), so
	 * the pair is skipped by asking the same question a numbered pair answers - does the Serbian
	 * heading carry a leading number at all - rather than by naming the slug. A future page whose
	 * heading also carries no number is covered by the same line; a hand written "except
	 * rec-predsednika" would not have been, and would itself be a list with one entry.
	 */
	@Test
	void theLeadingNumberOfAnEnglishHeadingMatchesTheSerbianHeadingItIsPairedWith() {
		reapply();

		record HeadingPair(String slug, int position, String serbian, String english) {
		}

		List<HeadingPair> pairs = db
				.sql("select p.slug, s.position, s.heading, st.heading"
						+ " from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " join static_page_section_translation st on st.section_id = s.id"
						+ " where st.language = 'en' order by p.slug, s.position")
				.query((row, i) -> new HeadingPair(row.getString(1), row.getInt(2), row.getString(3),
						row.getString(4)))
				.list();

		assertThat(pairs).as("no translated section was found to check heading numbers on").isNotEmpty();

		int numberedPairsChecked = 0;

		for (HeadingPair pair : pairs) {
			Matcher serbianNumber = LEADING_NUMBER.matcher(pair.serbian());
			Matcher englishNumber = LEADING_NUMBER.matcher(pair.english());

			if (!serbianNumber.find()) {
				assertThat(englishNumber.find())
						.as("%s position %d: the Serbian heading \"%s\" carries no leading number,"
								+ " but the English heading \"%s\" does", pair.slug(), pair.position(),
								pair.serbian(), pair.english())
						.isFalse();
				continue;
			}

			assertThat(englishNumber.find())
					.as("%s position %d: the Serbian heading \"%s\" carries a leading number, but"
							+ " the English heading \"%s\" does not", pair.slug(), pair.position(),
							pair.serbian(), pair.english())
					.isTrue();
			assertThat(englishNumber.group(1))
					.as("%s position %d: the English heading's leading number does not match the"
							+ " Serbian one it is paired with - Serbian \"%s\", English \"%s\"",
							pair.slug(), pair.position(), pair.serbian(), pair.english())
					.isEqualTo(serbianNumber.group(1));
			numberedPairsChecked++;
		}

		assertThat(numberedPairsChecked)
				.as("thirty-eight of the thirty-nine sections carry a number in their heading (every"
						+ " one except rec-predsednika's single section); this case checked fewer than"
						+ " that, so the derived exception is swallowing more pairs than it should")
				.isEqualTo(38);
	}

	@Test
	void allThreeLegalPagesSignOffWithV41sDateAndNoneKeepsTheStaleOne() {
		reapply();

		for (String slug : List.of("pravilnik", "politika-privatnosti", "uslovi-koriscenja")) {
			String english = wholeEnglishBodyOf(slug);

			assertThat(english)
					.as("%s's English sign-off does not carry V41's date, 28.09.2026", slug)
					.contains("Last amended: 28.09.2026.");
			assertThat(english)
					.as("%s's English sign-off still carries the date V41 overwrote in Serbian,"
							+ " 15.09.2026", slug)
					.doesNotContain("15.09.2026");
		}
	}

	/**
	 * PRAVILNIK'S ENGLISH ARTICLE 36 NAMES THE ROOKIE CATEGORY THE WAY frontend/src/i18n/en.json
	 * ACTUALLY NAMES IT ON SCREEN - READ FROM THE DICTIONARY PAIR ITSELF, NEVER TYPED AS A LITERAL.
	 *
	 * <p>Measured in three steps, none of them this task's to resolve: {@code data/categories.ts}
	 * translates no category except by printing its raw code for everything but the first-season
	 * band; the first-season CODE cannot read "F R" in English because {@code genderMark} is not
	 * language aware and returns "M"/"Ž" on every language, so the code is "M R" / "Ž R" and never
	 * "F R" anywhere; and {@code en.json}'s own {@code category.rookieMale} /
	 * {@code category.rookieFemale} already both read "Rookies". So the owner's decision of
	 * 11.08.2026 ("Na engleskom će se zvati M R i F R") is undelivered on the actual screen today,
	 * and fixing that is a shared-function increment of its own (both {@code en.json} and
	 * {@code genderMark} would have to change together). Until then this document follows the
	 * screen: a reader must be able to find, on the English screen, the exact label the English
	 * Rulebook names.
	 *
	 * <p><b>The two values compared are read from the dictionaries, not hand typed</b> - the same
	 * discipline {@link #theLeadingNumberOfAnEnglishHeadingMatchesTheSerbianHeadingItIsPairedWith}
	 * keeps for headings: its foundation is a LIST of thirty-nine pairs read from the schema; this
	 * one's foundation is a DICTIONARY of two keys read from the two JSON files the portal itself
	 * ships as the source of what a screen prints. A hard-coded {@code "Rookies"} here would drift
	 * silently the day either file's wording changes; asking the file instead cannot.
	 */
	@Test
	void article36NamesTheRookieCategoryExactlyAsEnJsonDoes() throws Exception {
		reapply();

		JsonNode enCategory = new ObjectMapper()
				.readTree(repositoryRoot().resolve("frontend/src/i18n/en.json")).path("category");
		JsonNode srCategory = new ObjectMapper()
				.readTree(repositoryRoot().resolve("frontend/src/i18n/sr.json")).path("category");

		String englishRookieMale = enCategory.path("rookieMale").asString();
		String englishRookieFemale = enCategory.path("rookieFemale").asString();
		String serbianRookieMale = srCategory.path("rookieMale").asString();
		String serbianRookieFemale = srCategory.path("rookieFemale").asString();

		assertThat(englishRookieMale)
				.as("en.json's own two keys must still read the same word, or this case is not"
						+ " measuring the fact it claims to")
				.isEqualTo(englishRookieFemale);

		String article36 = wholeEnglishBodyOf("pravilnik");

		assertThat(article36)
				.as("Article 36 does not name the rookie category the way en.json actually does"
						+ " (\"%s\")", englishRookieMale)
				.contains(englishRookieMale);
		assertThat(article36)
				.as("Article 36 still carries the untranslated Serbian dictionary value for the"
						+ " men's rookie label (\"%s\")", serbianRookieMale)
				.doesNotContain(serbianRookieMale);
		assertThat(article36)
				.as("Article 36 still carries the untranslated Serbian dictionary value for the"
						+ " women's rookie label (\"%s\")", serbianRookieFemale)
				.doesNotContain(serbianRookieFemale);
	}
}
