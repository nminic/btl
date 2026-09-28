package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE WRITTEN PAGES AS THE PORTAL ANSWERS THEM, AGAINST THE FILE THEY WERE SEEDED FROM.
 *
 * <p><b>Why this compares against the mock file directly, and not through
 * {@code Answers}.</b> {@code Answers.servedRecord} takes element zero and asks about
 * one record; what is asked here is every page, in order, field for field, so this
 * file walks {@code pages.json} itself. The same decision {@code PricingApiTest} took
 * for its own reason (no served file at all) and documented rather than forced through
 * the shared helper.
 *
 * <p><b>The file was an OBJECT keyed by slug until 20.09.2026</b> and is a LIST whose
 * rows carry their own address since, which is the shape this resource has always
 * answered with; the two now agree and the comparison below no longer has to go
 * through a map key.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PageApiTest {

	private static final Path MOCK = Path.of("..", "frontend", "src", "test", "mock", "pages.json");

	/** V24's four rows, in the order {@code pages.json} itself holds them - the order
	 *  the generator that wrote V24 read the file in, and so the order {@code static_page.id}
	 *  puts them in. */
	private static final List<String> SLUGS =
			List.of("politika-privatnosti", "uslovi-koriscenja", "rec-predsednika", "pravilnik");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/**
	 * THE WORDS THIS FILE WRITES AS A TRANSLATION, and they cannot coincide with what they
	 * are compared against.
	 *
	 * <p>Every case below asks whether the ENGLISH words came back where English was
	 * asked for. A fixture spelling a heading the way the Serbian spells it would answer
	 * that question the same whether the route read the translation or ignored it, which is
	 * „dva izvora, jedna vrednost": the value has to be one the other source cannot
	 * produce.
	 */
	private static final String ENGLISH_HEADING = "English heading ";
	private static final String ENGLISH_BODY = "English body ";
	private static final String ENGLISH_TITLE = "English title of ";

	/** Where a drawing stands inside a block's words
	 *  ({@code frontend/src/components/PageSectionBody.tsx}). */
	private static final String MARK = "[[gallery]]";

	/**
	 * THE LANGUAGE TAG THESE FIXTURES WRITE THEIR OWN WORDS UNDER, and it is deliberately
	 * NOT {@code "en"}.
	 *
	 * <p>V43 seeds REAL English translations for the four written pages this class shares
	 * with the database, one page and one commit at a time. A fixture that wrote under
	 * {@code 'en'} would collide with whichever of those V43 has already shipped -
	 * {@code static_page_translation_once_per_language} and
	 * {@code static_page_section_translation_once_per_language} both key on
	 * {@code (page_id, language)} / {@code (section_id, language)}, and Testcontainers
	 * applies the full migration history before any test method runs, so "not translated
	 * yet" is not a state this suite can keep assuming about any of the four slugs.
	 *
	 * <p><b>Measured, not guessed:</b> the moment V43 gave {@code rec-predsednika} a real
	 * English title and section,
	 * {@code aPageAnswersInEnglishOnlyWhenItIsWholeInEnglish} started failing on ITS OWN
	 * hard-coded expectation that {@code rec-predsednika} answers {@code "sr"} - a page this
	 * method never touches. So the fix has to be the TAG these fixtures use, not a
	 * case-by-case exclusion of whichever slug V43 has reached.
	 *
	 * <p>This tag is still shaped like a language ({@link PageApi} checks the shape, not a
	 * list of the ones that exist), but the portal never seeds it for anything, so every
	 * case below stays true regardless of how much of V43 has landed. {@code "de"},
	 * {@code "fr"} and {@code "cnr"} elsewhere in this file are the same idea for a
	 * different purpose (a second real-looking language, or one the portal has no words in
	 * at all) and are left alone.
	 */
	private static final String A_LANGUAGE_THESE_FIXTURES_OWN = "xx";

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(http.perform(get("/api/pages"))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
	}

	/** The same resource asked for in one language, which is a query and not a path - see
	 *  {@link PageApi}'s own heading for why it cannot be a path. */
	private JsonNode answerIn(String lang) throws Exception {
		return new ObjectMapper().readTree(reply(lang).getContentAsString(StandardCharsets.UTF_8));
	}

	private MockHttpServletResponse reply(String lang) throws Exception {
		return http.perform(get("/api/pages").param(PageApi.THE_LANGUAGE_ASKED_FOR, lang))
				.andReturn().getResponse();
	}

	/** Which language each page says its own words are really in, in the order the pages
	 *  came back. */
	private Map<String, String> languagesOf(JsonNode pages) {
		Map<String, String> byPage = new LinkedHashMap<>();

		for (JsonNode page : pages) {
			byPage.put(page.path("slug").asString(), page.path("language").asString());
		}

		return byPage;
	}

	private List<String> fieldOf(JsonNode pages, String slug, String field) {
		List<String> values = new ArrayList<>();

		for (JsonNode section : pageNamed(pages, slug).path("sections")) {
			values.add(section.path(field).asString());
		}

		return values;
	}

	/** What the fixture expects a whole page's blocks to read, built from the count rather
	 *  than written out, so a page that gains a block cannot quietly stop being compared. */
	private static List<String> expected(String prefix, int blocks) {
		List<String> words = new ArrayList<>();

		for (int position = 1; position <= blocks; position++) {
			words.add(prefix + position);
		}

		return words;
	}

	/** One page's title, written under {@link #A_LANGUAGE_THESE_FIXTURES_OWN} rather than
	 *  under {@code "en"} - see that constant for why - and still called "english" because
	 *  the VALUE it writes is what a translation would read, {@link #ENGLISH_TITLE}. */
	private void englishTitleFor(String slug) {
		assertThat(db.sql("insert into static_page_translation (page_id, language, title)"
						+ " select id, '" + A_LANGUAGE_THESE_FIXTURES_OWN + "', '" + ENGLISH_TITLE
						+ "' || slug from static_page"
						+ " where slug = :slug")
				.param("slug", slug).update())
				.as("there is no page at %s to write an English title for", slug)
				.isOne();
	}

	/**
	 * The first {@code blocks} blocks of one page, in English.
	 *
	 * <p><b>The mark that places a drawing is reproduced where, and only where, the block
	 * carries one</b>, which is read off the {@code gallery} column rather than off a list
	 * of positions. That is what a real translation has to do (V37's header) and it is what
	 * {@link #everyTranslatedBlockThatCarriesADrawingStillCarriesTheMarkThatPlacesIt()}
	 * measures.
	 */
	private int englishBlocksFor(String slug, int blocks) {
		return db.sql("insert into static_page_section_translation"
						+ " (section_id, language, heading, body)"
						+ " select s.id, '" + A_LANGUAGE_THESE_FIXTURES_OWN + "', '" + ENGLISH_HEADING
						+ "' || s.position,"
						+ "   '" + ENGLISH_BODY + "' || s.position"
						+ "   || case when s.gallery is null then ''"
						+ "           else E'\\n\\n" + MARK + "\\n' end"
						+ " from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " where p.slug = :slug and s.position <= :blocks")
				.param("slug", slug).param("blocks", blocks).update();
	}

	private static JsonNode mock() throws Exception {
		return new ObjectMapper().readTree(Files.readString(MOCK, StandardCharsets.UTF_8));
	}

	private JsonNode pageNamed(JsonNode pages, String slug) {
		for (JsonNode page : pages) {
			if (page.path("slug").asString().equals(slug)) {
				return page;
			}
		}
		return null;
	}

	/**
	 * THE ANSWER IS EXACTLY WHAT frontend/src/test/mock/pages.json HOLDS: the same
	 * four pages, in the same order, each with the same title, the same sections in the
	 * same order, and the same gallery on each.
	 *
	 * <p>V24 was seeded from this file (task instruction, section 4: „Pocetne redove
	 * uzmi iz frontend/src/test/mock/pages.json"). This is the strong, field-by-field
	 * comparison {@code CountryApiTest} and {@code DucatApiTest} make against their own
	 * fixtures, and it is what catches a column read for another one - a heading served
	 * as a body, a body served as a heading - without either being named in advance:
	 * both sides come from the same source and a swap is a mismatch on both fields at
	 * once.
	 *
	 * <p><b>Gallery is compared by field PRESENCE and not just by value</b>, because the
	 * mock file OMITS the key rather than writing {@code "gallery": null} on the
	 * thirty-seven sections that carry none, while the answer serves an explicit
	 * {@code null} for the same field (no {@code spring.jackson} setting in
	 * {@code application.properties} suppresses it, and {@code PricingApiTest} already
	 * relies on the same thing for {@code ranking}). Comparing text values alone would
	 * read both as "no gallery" and never notice one of them saying so a different way;
	 * {@code Answers.fieldsOf} is asked instead of the field's own value.
	 */
	@Test
	void theAnswerIsExactlyWhatTheMockFileHoldsToday() throws Exception {
		JsonNode ours = answer();
		JsonNode theirs = mock();

		assertThat(ours.size())
				.as("the mock file holds four written pages and the answer does not")
				.isEqualTo(SLUGS.size());

		List<String> slugs = new ArrayList<>();
		for (JsonNode page : ours) {
			slugs.add(page.path("slug").asString());
		}
		assertThat(slugs)
				.as("the answer does not carry the same four pages in the same order")
				.isEqualTo(SLUGS);

		int sectionsCompared = 0;

		for (String slug : SLUGS) {
			JsonNode page = pageNamed(ours, slug);
			JsonNode expectedPage = pageNamed(theirs, slug);

			assertThat(expectedPage)
					.as("the mock file no longer holds a page at %s", slug)
					.isNotNull();

			assertThat(page.path("title").asString())
					.as("%s's title does not match the mock file", slug)
					.isEqualTo(expectedPage.path("title").asString());
			assertThat(page.path("includes").size())
					.as("%s answers with an include the mock file does not carry", slug)
					.isEqualTo(0);

			JsonNode expectedSections = expectedPage.path("sections");
			JsonNode sections = page.path("sections");

			assertThat(sections.size())
					.as("%s does not carry the same number of sections as the mock file", slug)
					.isEqualTo(expectedSections.size());

			for (int i = 0; i < expectedSections.size(); i++) {
				JsonNode section = sections.get(i);
				JsonNode expectedSection = expectedSections.get(i);

				assertThat(section.path("heading").asString())
						.as("%s section %d heading does not match the mock file", slug, i)
						.isEqualTo(expectedSection.path("heading").asString());
				assertThat(section.path("body").asString())
						.as("%s section %d body does not match the mock file", slug, i)
						.isEqualTo(expectedSection.path("body").asString());

				boolean expectsGallery = Answers.fieldsOf(expectedSection).contains("gallery");
				String expectedGallery = expectsGallery ? expectedSection.path("gallery").asString() : null;
				String gallery = section.path("gallery").isNull() ? null : section.path("gallery").asString();

				assertThat(gallery)
						.as("%s section %d gallery does not match the mock file", slug, i)
						.isEqualTo(expectedGallery);
				sectionsCompared++;
			}
		}

		assertThat(sectionsCompared)
				.as("the thirty-nine sections of the four pages were not all compared, so this case"
						+ " measures less than it says")
				.isEqualTo(39);
	}

	/**
	 * ASKED IN REAL {@code "en"}, WITH NO FIXTURE OF ITS OWN, THE PAGES V43 HAS ALREADY
	 * TRANSLATED COME BACK IN ENGLISH.
	 *
	 * <p><b>Why this case writes nothing.</b> Every other case in this file that reaches
	 * {@code "en"} goes through {@link #A_LANGUAGE_THESE_FIXTURES_OWN} precisely because a
	 * literal {@code "en"} fixture would collide with V43's real seed - see that constant.
	 * This is the one case that deliberately asks for the real tag against the real data
	 * V43 shipped, with no insert of its own, because that is the only way to measure the
	 * thing the task instruction asks for: "ruta koja servira strane mora sada za engleski
	 * da vrati language:en i engleski tekst ... to je prva prilika da se ta grana koda
	 * izvrsi" - the branch of {@code PageApi} that serves a real translation has, until
	 * V43, only ever been exercised by fixtures it wrote and rolled back itself.
	 *
	 * <p><b>Only asserts what is true regardless of which page V43 reaches next.</b> The
	 * exact English wording is not repeated here - that duplication is exactly what
	 * {@link WrittenPageTranslationAppliesTest} exists to avoid, and what it already checks
	 * structurally, section by section, against the real migration. What is worth a
	 * MockMvc case is the one thing that file cannot see: that the HTTP route itself,
	 * asked in the language a real visitor's browser sends, reports {@code "en"} rather than
	 * silently falling back to {@code "sr"} the way it would for a page V43 has not
	 * reached yet.
	 */
	@Test
	void pagesV43HasAlreadyTranslatedAnswerInRealEnglishWithNoFixtureOfItsOwn() throws Exception {
		JsonNode ours = answerIn("en");

		/* All four, now that politika-privatnosti and uslovi-koriscenja have landed in V43 too,
		   translated against the text V41 (branch b143, merged as 5f464318) left behind rather
		   than the stale text this branch's own tree held while it waited. */
		assertThat(languagesOf(ours))
				.as("all four written pages are in V43 now, and each must answer in real English"
						+ " rather than silently falling back to the original")
				.containsExactly(entry("politika-privatnosti", "en"),
						entry("uslovi-koriscenja", "en"),
						entry("rec-predsednika", "en"),
						entry("pravilnik", "en"));

		assertThat(pageNamed(ours, "rec-predsednika").path("title").asString())
				.as("rec-predsednika's real English title did not reach the route")
				.isEqualTo("President's word");
		assertThat(fieldOf(ours, "rec-predsednika", "body"))
				.as("rec-predsednika does not have real English words in its one section")
				.hasSize(1)
				.first().asString().contains("Balkanska trkačka liga");

		assertThat(pageNamed(ours, "pravilnik").path("title").asString())
				.as("pravilnik's real English title did not reach the route")
				.contains("2027 season");
		assertThat(fieldOf(ours, "pravilnik", "heading"))
				.as("the rulebook did not come back whole - nineteen real English headings, in"
						+ " order - which is the exact condition PageApi.pagesIn requires before it"
						+ " will call a page English at all")
				.containsExactly("1. Introductory provisions", "2. Season and deadlines",
						"3. Who competes", "4. Membership fee", "5. What counts toward points",
						"6. How points are calculated", "7. Categories by race length",
						"8. Competitor categories", "9. Submitting results",
						"10. Verification of results", "11. Rankings and placing",
						"12. Teams, racing pairs, and clubs", "13. Accompanying competitions and leagues",
						"14. Awards and honours", "15. Code of ethics", "16. Sanctions and disqualification",
						"17. Publishing data and photographs", "18. Ducats",
						"19. Amendments to the Rulebook and final provisions");

		assertThat(pageNamed(ours, "politika-privatnosti").path("title").asString())
				.as("politika-privatnosti's real English title did not reach the route")
				.isEqualTo("Privacy policy");
		assertThat(fieldOf(ours, "politika-privatnosti", "heading"))
				.as("the privacy policy did not come back whole - seven real English headings")
				.hasSize(7);

		/* V44 moved "Profile picture" out of "Data you enter when you join" and into "Data
		   generated while you are a member", in both languages - WrittenPageTranslationAppliesTest
		   re-runs V43 in isolation and cannot see anything a later migration does to V43's own
		   text, so it is this real, fully migrated answer that has to carry the correction. Read
		   off section 2 alone (index 1, the same section fieldOf("heading") already sized above)
		   rather than the whole page, so the three indexOf positions below are all offsets into
		   the one string that actually holds both tables and stay comparable to one another. */
		String whatDataIsProcessed = fieldOf(ours, "politika-privatnosti", "body").get(1);
		int joinTableAt = whatDataIsProcessed.indexOf("### Data you enter when you join");
		int memberTableAt = whatDataIsProcessed.indexOf("### Data generated while you are a member");
		int pictureRowAt = whatDataIsProcessed.indexOf("Profile picture");

		assertThat(joinTableAt)
				.as("the English section no longer has the \"data you enter when you join\" table")
				.isGreaterThanOrEqualTo(0);
		assertThat(memberTableAt)
				.as("the English section no longer has the \"data generated while you are a"
						+ " member\" table, or it no longer follows the first one")
				.isGreaterThan(joinTableAt);
		assertThat(whatDataIsProcessed).containsOnlyOnce("Profile picture");
		assertThat(pictureRowAt)
				.as("the real English answer still lists the profile picture among what a member"
						+ " enters when joining, not among what membership itself produces")
				.isGreaterThan(memberTableAt);

		assertThat(pageNamed(ours, "uslovi-koriscenja").path("title").asString())
				.as("uslovi-koriscenja's real English title did not reach the route")
				.isEqualTo("Terms of use");
		assertThat(fieldOf(ours, "uslovi-koriscenja", "heading"))
				.as("the terms of use did not come back whole - twelve real English headings")
				.hasSize(12);
	}

	/**
	 * SECTION ORDER IS THE {@code position} COLUMN, AND NOT THE ORDER ROWS WERE WRITTEN IN.
	 *
	 * <p>Task instruction, section 5: dropping the {@code order by} on
	 * {@code static_page_section} must fail this case, and the case must move a section
	 * to the START and not the end, „jer PostgreSQL pri UPDATE pise novu verziju reda na
	 * kraj tabele pa neuredjeno citanje ionako vraca taj red poslednji". Moved to the end,
	 * a plain scan with no {@code order by} would already agree with {@code position} by
	 * accident and this case would say nothing; moved to the front, the two can only
	 * agree if {@code position} is actually read.
	 *
	 * <p>The rulebook's nineteen sections are shifted out of the way first, mirroring
	 * {@code PricingApiTest}'s {@code sort_order + 10}: the moved row needs a free
	 * position at the front, and {@code static_page_section_position_unique} is checked
	 * exactly where it is written (deferrable, initially immediate).
	 */
	@Test
	void sectionOrderIsThePositionColumnAndNotTheOrderRowsWereWrittenIn() throws Exception {
		List<String> before = headingsOf("pravilnik");

		assertThat(before)
				.as("the last section of the rulebook is not the one this case expects, so moving it"
						+ " to the front would measure something else")
				.last().isEqualTo("19. Izmene pravilnika i završne odredbe");

		int shifted = db.sql("update static_page_section set position = position + 100"
						+ " where page_id = (select id from static_page where slug = 'pravilnik')")
				.update();
		assertThat(shifted)
				.as("the shift that frees a place at the front did not touch every section of the"
						+ " rulebook")
				.isEqualTo(19);

		int moved = db.sql("update static_page_section set position = 1"
						+ " where page_id = (select id from static_page where slug = 'pravilnik')"
						+ "   and heading = '19. Izmene pravilnika i završne odredbe'")
				.update();
		assertThat(moved).as("the section this case moves was not found by its heading").isOne();

		List<String> after = headingsOf("pravilnik");

		assertThat(after)
				.as("the last section was moved to the front of the order and the answer did not move"
						+ " with it, so sections are not read in position order")
				.first().isEqualTo("19. Izmene pravilnika i završne odredbe");
		assertThat(after)
				.as("moving one section changed how many sections came back")
				.hasSameSizeAs(before);
		/* AND THE REST KEPT THEIR ORDER, which is what tells a move from a reshuffle. */
		assertThat(after.subList(1, after.size()))
				.as("the other eighteen sections changed order too, so what moved was not one section")
				.isEqualTo(before.subList(0, before.size() - 1));
	}

	private List<String> headingsOf(String slug) throws Exception {
		List<String> headings = new ArrayList<>();

		for (JsonNode section : pageNamed(answer(), slug).path("sections")) {
			headings.add(section.path("heading").asString());
		}

		return headings;
	}

	/**
	 * A PAGE CAN TAKE IN ANOTHER, IN THE ORDER THE INCLUDES ARE WRITTEN, AND A PAGE WITH
	 * NO SECTION YET ANSWERS WITH AN EMPTY LIST RATHER THAN NOTHING AT ALL.
	 *
	 * <p>No page V24 seeds uses {@code includes} today. ADL A7, 30.07.2026, „Pisana strana
	 * sme da preuzme drugu pisanu stranu" is the only decision that asks for the field,
	 * and the one page it names, the president's address, is
	 * taken in by the FRONT PAGE component directly rather than by another written
	 * page's {@code includes} (`frontend/src/data/pages.ts`, {@code DRAWN_BY_A_SCREEN}).
	 * Left untested, {@code includesByPage}'s loop body and a page's own
	 * {@code getOrDefault} onto an empty section list would never run against seeded
	 * data - a line JaCoCo counts and a mechanism nothing would have proved.
	 *
	 * <p>Two temporary pages are written here, in this transaction alone, so neither
	 * touches the seed the case above compares against the mock file byte for byte. The
	 * page with the LOWER id is included SECOND (position 2) and the one with the HIGHER
	 * id FIRST (position 1) - deliberately disagreeing sources, the same guard `dva
	 * izvora, jedna vrednost` asks for elsewhere: were {@code included_page_id} read in
	 * numeric or insertion order instead of {@code position}, this case would still see
	 * two includes and could not tell the fault from success.
	 *
	 * <p><b>And the names disagree with the positions too, which is the fourth source of
	 * the same order.</b> The draft before this one called them „included first" and
	 * „included second", so their slugs and their titles both sorted into exactly the
	 * order their positions gave: a query ordering by the included page's SLUG, or by its
	 * title, answered the expected list and this case could not tell it from the right
	 * one. Measured on review, both green. The names now sort the other way round, so
	 * alphabet and position disagree and only one of them can be what the answer follows.
	 *
	 * <p><b>And the rows are written in the order that disagrees with their positions,
	 * while a SECOND page takes in a different list.</b> The first draft of this case had
	 * neither: the two rows went in position order, so ordering by {@code id} or by
	 * nothing answered the same list, and only one page had includes at all, so a server
	 * handing every page whichever list it had answered identically. Measured on review -
	 * three mutations, all green.
	 */
	@Test
	void aPageCanTakeInAnotherInOrderAndAPageWithNoSectionAnswersWithAnEmptyList() throws Exception {
		db.sql("insert into static_page (slug, title) values"
				+ " ('temp-prva-po-azbuci-druga-po-poziciji', 'Prva po azbuci'),"
				+ " ('temp-zadnja-po-azbuci-prva-po-poziciji', 'Zadnja po azbuci')")
				.update();
		db.sql("insert into static_page_section (page_id, position, heading, body) values"
				+ " ((select id from static_page where slug = 'temp-zadnja-po-azbuci-prva-po-poziciji'),"
				+ "  1, 'Only section', 'Text')")
				.update();
		/* WRITTEN IN THE ORDER THAT DISAGREES WITH THE POSITIONS. The row carrying
		   position 2 goes in FIRST, so it takes the lower `id` of the two. A query
		   ordering by `id`, or by nothing at all, then answers them the other way round
		   and this case says so. Written the tidy way - position 1 first - insertion
		   order and position order are the same list and neither one is being measured.

		   AND A SECOND PAGE TAKES IN SOMETHING ELSE. With includes on one page only, a
		   server handing every page whichever list it happens to have answers identically,
		   which is what „dva izvora, jedna vrednost" is about: the terms of use take in
		   one page and the rulebook takes in two, so a list attached to the wrong page is
		   the wrong list and not the same one. */
		db.sql("insert into static_page_include (page_id, position, included_page_id) values"
				+ " ((select id from static_page where slug = 'pravilnik'), 2,"
				+ "  (select id from static_page where slug = 'temp-prva-po-azbuci-druga-po-poziciji')),"
				+ " ((select id from static_page where slug = 'pravilnik'), 1,"
				+ "  (select id from static_page where slug = 'temp-zadnja-po-azbuci-prva-po-poziciji')),"
				+ " ((select id from static_page where slug = 'uslovi-koriscenja'), 1,"
				+ "  (select id from static_page where slug = 'temp-prva-po-azbuci-druga-po-poziciji'))")
				.update();

		JsonNode ours = answer();
		JsonNode emptyPage = pageNamed(ours, "temp-prva-po-azbuci-druga-po-poziciji");
		JsonNode rulebook = pageNamed(ours, "pravilnik");

		assertThat(emptyPage).as("the freshly made page with no section did not come back at all")
				.isNotNull();
		assertThat(emptyPage.path("sections").size())
				.as("a page with no section yet answered with something other than an empty list")
				.isEqualTo(0);

		assertThat(rulebook).as("the rulebook did not come back at all").isNotNull();

		List<String> includes = new ArrayList<>();
		for (JsonNode one : rulebook.path("includes")) {
			includes.add(one.asString());
		}
		assertThat(includes)
				.as("the rulebook's includes are not the two just written, in the order their"
						+ " positions give rather than the order the rows were written in")
				.containsExactly("temp-zadnja-po-azbuci-prva-po-poziciji", "temp-prva-po-azbuci-druga-po-poziciji");

		assertThat(slugsIncludedBy(ours, "uslovi-koriscenja"))
				.as("the terms of use came back with somebody else's includes, so a list attached"
						+ " to the wrong page would read the same as one attached to the right one")
				.containsExactly("temp-prva-po-azbuci-druga-po-poziciji");

		assertThat(slugsIncludedBy(ours, "politika-privatnosti"))
				.as("a page that takes in nothing came back with includes anyway")
				.isEmpty();
	}

	/** The addresses one page takes in, in the order it answers them. */
	private List<String> slugsIncludedBy(JsonNode ours, String slug) {
		List<String> out = new ArrayList<>();
		for (JsonNode one : pageNamed(ours, slug).path("includes")) {
			out.add(one.asString());
		}
		return out;
	}

	/**
	 * AND IT IS READABLE WITHOUT SIGNING IN.
	 *
	 * <p>The privacy policy and the terms of use must be readable before anybody accepts
	 * them by registering (PDL.md ("moraju postojati pre lansiranja")), and the
	 * terms themselves point a prospective member at the rulebook for the price of
	 * joining. {@code ApiSecurityTest} holds the sub-paths, the spellings and the
	 * writing for every route already on {@code ApiSecurity.READ_BY_ANYBODY}; what it
	 * cannot say is that a route MISSING from that list should have been on it, which is
	 * the one thing removing {@code "/api/pages"} from it would not otherwise turn red
	 * anywhere in this file.
	 */
	@Test
	void writtenPagesAreReadableWithoutSigningIn() throws Exception {
		assertThat(http.perform(get("/api/pages")).andReturn().getResponse().getStatus())
				.as("a visitor was asked to sign in before reading the rulebook or the privacy policy")
				.isEqualTo(200);
		/* AND IN THE OTHER LANGUAGE TOO, which is a different request and therefore a
		   different sentence. The chain matches on the PATH, so a query cannot close a route
		   that is open - but that is the thing being said here rather than assumed, and it is
		   also the whole reason the language is a query: `noOpenRouteOpensAnythingBesideIt`
		   requires everything beside an open path to answer 401, so `/api/pages/en` is a
		   spelling a visitor could never have been allowed to read. */
		assertThat(reply("en").getStatus())
				.as("a visitor was asked to sign in before reading the legal pages in English")
				.isEqualTo(200);
		assertThat(ApiSecurity.READ_BY_ANYBODY)
				.as("/api/pages answers 200 without a session and is not on the open list, so"
						+ " something else is opening it")
				.contains("/api/pages");
	}

	/**
	 * A PAGE COMES BACK IN ENGLISH WHEN IT IS WHOLE IN ENGLISH, AND EVERY OTHER PAGE OF THE
	 * SAME ANSWER COMES BACK IN THE ORIGINAL.
	 *
	 * <p><b>The one page written in English is the terms of use, and which page that is was
	 * chosen rather than taken.</b> It is neither the first by {@code id} nor the last,
	 * neither the page with the most blocks (the rulebook, nineteen) nor the one with the
	 * fewest (the president's address, one), and it carries no drawing. So a server handing
	 * the translation to „the first page", „the last page", „the biggest page" or „the page
	 * with a drawing" answers something this case can tell apart, which a fixture that
	 * translated only the rulebook could not.
	 *
	 * <p><b>And the {@code language} field has to VARY inside one answer</b>, which is why
	 * the map below is compared whole instead of one page being looked at. {@code Answers}
	 * says why in its own heading: a field the fixture never varies is a field the server
	 * could answer with a constant, and the two read alike in every case above it. Here
	 * {@code "sr"} written as a literal for every page passes nothing.
	 */
	@Test
	void aPageAnswersInEnglishOnlyWhenItIsWholeInEnglish() throws Exception {
		englishTitleFor("uslovi-koriscenja");
		assertThat(englishBlocksFor("uslovi-koriscenja", 12))
				.as("the terms of use no longer hold twelve blocks, so this fixture translated"
						+ " something other than a whole page and the case below says nothing")
				.isEqualTo(12);

		JsonNode ours = answerIn(A_LANGUAGE_THESE_FIXTURES_OWN);

		/* Asked in the FIXTURES' OWN tag rather than in real "en": V43 gives some of these
		   four pages real English before it gives all four, and this case's whole point is
		   that the OTHER pages stay in the original - a literal "en" here would start
		   failing on whichever page V43 reaches next, exactly as it did the day V43 gave
		   rec-predsednika real words and this assertion, still written against "en", called
		   that a bug. See A_LANGUAGE_THESE_FIXTURES_OWN. */
		assertThat(languagesOf(ours))
				.as("asked in the fixtures' own tag, exactly the page that has been written in"
						+ " it should say its words are in it, and every other page should say"
						+ " its words are still the original")
				.containsExactly(entry("politika-privatnosti", "sr"),
						entry("uslovi-koriscenja", A_LANGUAGE_THESE_FIXTURES_OWN),
						entry("rec-predsednika", "sr"),
						entry("pravilnik", "sr"));

		assertThat(pageNamed(ours, "uslovi-koriscenja").path("title").asString())
				.as("the page that is whole in English came back with its Serbian title")
				.isEqualTo(ENGLISH_TITLE + "uslovi-koriscenja");
		assertThat(fieldOf(ours, "uslovi-koriscenja", "heading"))
				.as("the English page came back with Serbian headings, or with them out of order")
				.isEqualTo(expected(ENGLISH_HEADING, 12));
		assertThat(fieldOf(ours, "uslovi-koriscenja", "body"))
				.as("the English page came back with Serbian bodies")
				.isEqualTo(expected(ENGLISH_BODY, 12));

		/* AND THE THREE PAGES NOBODY TRANSLATED ARE WORD FOR WORD WHAT THEY ARE WITHOUT THE
		   PARAMETER. Compared as whole records and not title by title: a server that served
		   the English title to the right page and English BLOCKS to a wrong one would still
		   pass a check that only looked at what it expected to have changed. */
		JsonNode original = answer();

		for (String untouched : List.of("politika-privatnosti", "rec-predsednika", "pravilnik")) {
			assertThat(pageNamed(ours, untouched))
					.as("%s has no English words and came back different from the answer in the"
							+ " original", untouched)
					.isEqualTo(pageNamed(original, untouched));
		}
	}

	/**
	 * THE ORIGINAL IS WHAT COMES BACK WHEN NOTHING IS ASKED FOR, AND WHEN IT IS ASKED FOR BY
	 * NAME, AND THE TWO ARE NOT THE SAME REQUEST.
	 *
	 * <p>Written with a translation already in the database on purpose. Without one, „the
	 * answer is Serbian" is true because there is nothing else it could be, and the case
	 * would go on passing over a route that had stopped reading the parameter at all.
	 *
	 * <p><b>Absent and {@code sr} are asked separately because they are two states of one
	 * axis</b>, not one. The portal will send the tag explicitly on every address
	 * (PDL P18 puts the language in the address for Serbian too), while every reader
	 * written before today sends nothing; a route that defaulted the absent case to English
	 * would break the first and not the second, and only one of these two cases would see it.
	 */
	@Test
	void theOriginalComesBackWhenNoLanguageIsAskedForAndWhenItIsAskedForByName() throws Exception {
		englishTitleFor("uslovi-koriscenja");
		assertThat(englishBlocksFor("uslovi-koriscenja", 12)).isEqualTo(12);

		String serbianTitle = pageNamed(mock(), "uslovi-koriscenja").path("title").asString();

		for (JsonNode ours : List.of(answer(), answerIn(PageApi.THE_ORIGINAL))) {
			assertThat(languagesOf(ours).values())
					.as("an English translation exists and an answer in the original carried some"
							+ " of it")
					.containsOnly(PageApi.THE_ORIGINAL);
			assertThat(pageNamed(ours, "uslovi-koriscenja").path("title").asString())
					.as("the English title reached an answer that asked for the original")
					.isEqualTo(serbianTitle);
			assertThat(fieldOf(ours, "uslovi-koriscenja", "heading"))
					.as("the English headings reached an answer that asked for the original")
					.doesNotContain(ENGLISH_HEADING + "1");
		}
	}

	/**
	 * A TAG THIS PORTAL HAS NO WORDS IN IS SERVED THE ORIGINAL AND SAYS SO, RATHER THAN
	 * BEING REFUSED.
	 *
	 * <p><b>This is deliberately the SAME mechanism as a translation that has not been
	 * written yet, and that is the decision this case records.</b> „A language the portal
	 * does not have" and „a language whose text has not arrived" are one state - no rows -
	 * so they get one rule and one field. The alternative was a list of the tags the portal
	 * has, which would have to be kept in step with
	 * {@code frontend/src/i18n/config.ts} across the two halves of the repository and would
	 * answer 400 for {@code cnr} on the day that tag is entered as data, which PDL P18
	 * („kao unos a ne kao razvoj") exists to prevent.
	 *
	 * <p>{@code cnr} is asked alongside {@code de} because it is three letters and because
	 * PDL P18 names it as the next tag: „Ako se jednog dana doda crnogorski, oznaka je
	 * {@code cnr}."
	 */
	@ParameterizedTest
	@ValueSource(strings = { "de", "cnr" })
	void aTagThisPortalHasNoWordsInIsServedTheOriginalRatherThanRefused(String tag) throws Exception {
		englishTitleFor("uslovi-koriscenja");
		assertThat(englishBlocksFor("uslovi-koriscenja", 12)).isEqualTo(12);

		assertThat(reply(tag).getStatus())
				.as("%s is shaped like a language tag and was refused rather than served the"
						+ " original", tag)
				.isEqualTo(200);

		JsonNode ours = answerIn(tag);

		assertThat(languagesOf(ours).values())
				.as("asked in %s the answer claimed to be in a language it holds no words in", tag)
				.containsOnly(PageApi.THE_ORIGINAL);
		assertThat(fieldOf(ours, "uslovi-koriscenja", "heading"))
				.as("asked in %s the answer handed over the English words, which belong to"
						+ " another tag", tag)
				.doesNotContain(ENGLISH_HEADING + "1");
	}

	/**
	 * A PAGE WITH ONE BLOCK STILL UNTRANSLATED COMES BACK WHOLE IN THE ORIGINAL, AND TURNS
	 * ON THE BLOCK THAT COMPLETES IT.
	 *
	 * <p><b>Both directions of the boundary, with a concrete case on each side</b>, which is
	 * what a decision about the meaning of a word owes (`CLAUDE.md`, 28.08.2026). Eleven of
	 * the twelve blocks written in English is Serbian; the twelfth makes it English. Nothing
	 * in between.
	 *
	 * <p><b>Why the rule is the page and not the block.</b> Eighteen articles of the
	 * rulebook in English and the nineteenth in Serbian is not a contract anybody could rely
	 * on, and PDL P18 refuses the same thing one level up, where the owner was offered
	 * English on the public pages only: „{@code /en} bi postao <b>delimično srpski</b>, što
	 * izgleda kao kvar a ne kao odluka." What it buys is that the translation may arrive a
	 * block and a commit at a time with no reader ever seeing half of a legal text.
	 *
	 * <p><b>The page's TITLE is written in English from the start of this case</b>, so what
	 * is being measured is the blocks and not the title: were the rule „a title in this
	 * language is enough", the first half of this case would already answer English.
	 */
	@Test
	void aPageWithOneBlockStillUntranslatedComesBackWholeInTheOriginal() throws Exception {
		englishTitleFor("uslovi-koriscenja");
		assertThat(englishBlocksFor("uslovi-koriscenja", 11))
				.as("eleven of the twelve blocks were not written, so neither side of this"
						+ " boundary is where the case says it is")
				.isEqualTo(11);

		JsonNode shortOfOne = answerIn(A_LANGUAGE_THESE_FIXTURES_OWN);

		assertThat(languagesOf(shortOfOne))
				.as("a page missing the words of one block answered in its language anyway, so a"
						+ " reader can be handed a legal text that is part one language and part"
						+ " another")
				.containsEntry("uslovi-koriscenja", PageApi.THE_ORIGINAL);
		assertThat(fieldOf(shortOfOne, "uslovi-koriscenja", "heading"))
				.as("the eleven blocks that DO have words in it were served in it while the page"
						+ " as a whole could not be")
				.doesNotContain(ENGLISH_HEADING + "1");

		/* AND THE TWELFTH TURNS IT. Written by position rather than by „the rest", so what
		   completes the page is one named row and not a repeat of the insert above. Written
		   under A_LANGUAGE_THESE_FIXTURES_OWN directly, like englishBlocksFor itself, rather
		   than through real "en" - see that constant for why. */
		assertThat(db.sql("insert into static_page_section_translation"
						+ " (section_id, language, heading, body)"
						+ " select s.id, '" + A_LANGUAGE_THESE_FIXTURES_OWN + "', '" + ENGLISH_HEADING
						+ "' || s.position,"
						+ "   '" + ENGLISH_BODY + "' || s.position"
						+ " from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " where p.slug = 'uslovi-koriscenja' and s.position = 12")
				.update())
				.as("the twelfth block of the terms of use was not found by its position")
				.isOne();

		assertThat(languagesOf(answerIn(A_LANGUAGE_THESE_FIXTURES_OWN)))
				.as("every block of the page now has words in it and the page still answers in"
						+ " the original, so nothing can ever complete a translation")
				.containsEntry("uslovi-koriscenja", A_LANGUAGE_THESE_FIXTURES_OWN);
		assertThat(fieldOf(answerIn(A_LANGUAGE_THESE_FIXTURES_OWN), "uslovi-koriscenja", "heading"))
				.isEqualTo(expected(ENGLISH_HEADING, 12));
	}

	/**
	 * A VALUE THAT IS NOT SHAPED LIKE A LANGUAGE TAG IS REFUSED, AND WITH NO BODY.
	 *
	 * <p>The shape is PDL P18's: „Oznake jezika: {@code sr} i {@code en}. Ako se jednog
	 * dana doda crnogorski, oznaka je {@code cnr}." Two or three lower-case letters, which
	 * is a question about the value itself and so cannot be incomplete in any direction -
	 * unlike „is this one of ours", which would have to be kept in step with a list living
	 * on the other side of the repository.
	 *
	 * <p><b>No body, and that is a decision rather than a shortcut.</b> Every other refusal
	 * on this portal names a reason, and a reason here is a dictionary key
	 * ({@code frontend/src/pages/account/refusals.test.ts} holds each one to a sentence on a
	 * screen). There is no screen to put a sentence on: {@code LocaleLayout.tsx} sends an
	 * unknown locale to the default language before anything is fetched, so nothing this
	 * portal draws can produce one of these values. A key with no reader is worth less than
	 * the status. The bodyless form is {@code EventWriteApi}'s.
	 *
	 * <p><b>The last row is the one worth reading twice.</b> {@code en-GB} is a real BCP-47
	 * tag and a plausible thing to send; it is refused because this portal's tags are the
	 * three PDL P18 names and nothing about a region has been decided. The empty value
	 * is what a switch sends when it has nothing selected, and it is not the same request as
	 * sending no parameter at all - {@code theOriginalComesBackWhenNoLanguageIsAskedFor...}
	 * holds that one to 200.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "", "e", "engl", "EN", "en-GB", "sr_latn", "1" })
	void aValueThatIsNotShapedLikeALanguageTagIsRefusedWithNoBody(String notATag) throws Exception {
		MockHttpServletResponse refusal = reply(notATag);

		assertThat(refusal.getStatus())
				.as("[%s] is not shaped like a language tag and was answered anyway", notATag)
				.isEqualTo(400);
		assertThat(refusal.getContentAsString())
				.as("[%s] was refused with a body, which is a sentence no screen of this portal"
						+ " can be shown", notATag)
				.isEmpty();
		/* AND A TAG THAT IS SHAPED LIKE ONE IS NOT REFUSED, in the same case, because
		   „everything is 400" satisfies every line above it. */
		assertThat(reply("en").getStatus())
				.as("a well shaped tag was refused too, so the rows above measure a route that"
						+ " refuses everything")
				.isEqualTo(200);
	}

	/**
	 * TWO TRANSLATIONS OF ONE PAGE DO NOT ANSWER FOR EACH OTHER, AND A THIRD THAT IS ONLY A
	 * TITLE ANSWERS FOR NOBODY.
	 *
	 * <p><b>This case was written from a hole, not from a failure.</b> Every case above it
	 * writes exactly one language, and with one language written there are three separate
	 * places where the route could stop asking WHICH language and no case could tell:
	 *
	 * <ol>
	 * <li>the page's own join. Unfiltered, asking for a tag finds another tag's title.</li>
	 * <li>the block join. Unfiltered, a block comes back once per language that has it.</li>
	 * <li>the join inside the completeness test. Unfiltered, „every block has words" is
	 * satisfied by words in SOME OTHER language, and the page is then served as whole with
	 * nothing to serve.</li>
	 * </ol>
	 *
	 * <p>Each of the three survives every other case in this file, because with only English
	 * written there is no second language for an unfiltered join to reach. All three stop
	 * surviving here.
	 *
	 * <p><b>Latent today and not tomorrow</b>, which is why it is worth a case rather than a
	 * note: PDL P18 plans the third language as an ENTRY („kao unos a ne kao razvoj"), so
	 * the day somebody types one is the day an unfiltered join starts handing one language's
	 * words to another's reader - on a legal text.
	 *
	 * <p><b>The three tags are deliberately in three different states.</b> English and German
	 * are both whole and must answer their own words; French is a title with no blocks behind
	 * it and must answer in the original, which is the state that catches the third join. The
	 * count of pages is asserted for each, because an unfiltered join duplicates a ROW rather
	 * than changing a value, and a map keyed by address would quietly collapse the duplicate.
	 */
	@Test
	void twoTranslationsOfOnePageDoNotAnswerForEachOther() throws Exception {
		englishTitleFor("uslovi-koriscenja");
		assertThat(englishBlocksFor("uslovi-koriscenja", 12)).isEqualTo(12);

		/* A SECOND LANGUAGE, WHOLE, with words of its own. */
		assertThat(db.sql("insert into static_page_translation (page_id, language, title)"
						+ " select id, 'de', 'Deutscher Titel' from static_page"
						+ " where slug = 'uslovi-koriscenja'")
				.update()).isOne();
		assertThat(db.sql("insert into static_page_section_translation"
						+ " (section_id, language, heading, body)"
						+ " select s.id, 'de', 'Deutsche Ueberschrift ' || s.position,"
						+ "   'Deutscher Text ' || s.position"
						+ " from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " where p.slug = 'uslovi-koriscenja'")
				.update()).isEqualTo(12);

		/* A THIRD LANGUAGE THAT IS A TITLE AND NOTHING ELSE. */
		assertThat(db.sql("insert into static_page_translation (page_id, language, title)"
						+ " select id, 'fr', 'Titre francais' from static_page"
						+ " where slug = 'uslovi-koriscenja'")
				.update()).isOne();

		JsonNode english = answerIn(A_LANGUAGE_THESE_FIXTURES_OWN);
		JsonNode german = answerIn("de");
		JsonNode french = answerIn("fr");

		for (JsonNode ours : List.of(english, german, french)) {
			assertThat(ours.size())
					.as("a page came back more than once, which is what a join that stopped"
							+ " asking which language would do")
					.isEqualTo(SLUGS.size());
			assertThat(fieldOf(ours, "uslovi-koriscenja", "heading"))
					.as("the page came back with more blocks than it has, so its blocks arrived"
							+ " once per language rather than once")
					.hasSize(12);
		}

		assertThat(pageNamed(english, "uslovi-koriscenja").path("title").asString())
				.isEqualTo(ENGLISH_TITLE + "uslovi-koriscenja");
		assertThat(fieldOf(english, "uslovi-koriscenja", "heading"))
				.as("asked in English the page answered with another language's blocks")
				.isEqualTo(expected(ENGLISH_HEADING, 12));

		assertThat(pageNamed(german, "uslovi-koriscenja").path("title").asString())
				.as("asked in German the page answered with the English title")
				.isEqualTo("Deutscher Titel");
		assertThat(fieldOf(german, "uslovi-koriscenja", "heading"))
				.as("asked in German the page answered with the English blocks")
				.isEqualTo(expected("Deutsche Ueberschrift ", 12));

		/* AND THE TAG THAT HAS ONLY A TITLE FALLS BACK WHOLE, rather than being called
		   complete because some OTHER language has the blocks. */
		assertThat(languagesOf(french))
				.as("a tag with a title and no blocks was served as though it were whole, so its"
						+ " reader is handed a legal text with nothing in it or somebody else's"
						+ " words in it")
				.containsEntry("uslovi-koriscenja", PageApi.THE_ORIGINAL);
		assertThat(pageNamed(french, "uslovi-koriscenja").path("title").asString())
				.as("the French title reached a page that could not be served in French")
				.isEqualTo(pageNamed(mock(), "uslovi-koriscenja").path("title").asString());
		assertThat(fieldOf(french, "uslovi-koriscenja", "heading"))
				.as("asked in French the page handed over another language's blocks")
				.doesNotContain(ENGLISH_HEADING + "1", "Deutsche Ueberschrift 1");

		assertThat(languagesOf(english)).containsEntry("uslovi-koriscenja", A_LANGUAGE_THESE_FIXTURES_OWN);
		assertThat(languagesOf(german)).containsEntry("uslovi-koriscenja", "de");
	}

	/**
	 * EVERY TRANSLATED BLOCK THAT CARRIES A DRAWING STILL CARRIES THE MARK THAT PLACES IT,
	 * AND THE NAME OF THE DRAWING IS NOT TRANSLATED.
	 *
	 * <p><b>This is the one thing in a sixty-one kilobyte translation that breaks silently.</b>
	 * The name of the drawing is a column of its own and V37 gives the translation no place
	 * to hold it, so it cannot be got wrong. Where the drawing STANDS is a line inside the
	 * words, holding nothing but the mark (ADL A7, 21.08.2026), so it travels through the
	 * translation like any other text.
	 *
	 * <p><b>And what goes wrong if it is dropped is not what it looks like</b>, which is worth
	 * naming because the wrong version of this sentence makes the guard look cosmetic. The
	 * same decision says it outright: „Bez tog reda crtež <b>nije izgubljen nego stoji ispod
	 * celog teksta</b>, dakle tačno tamo odakle ga je vlasnik pomerio." The drawing does not
	 * disappear; the English page silently goes back to the arrangement the owner moved it
	 * away from. Translated instead of copied, the reader is shown the literal characters,
	 * which {@code PageSectionBody.tsx} calls „the one thing the mark must never do".
	 *
	 * <p><b>The third way to lose it is not to delete it</b>, and this case refuses that too.
	 * ADL A7 again: the mark counts only while it is a whole line, so `[[gallery]]` behind a
	 * zero width character „izgleda u uređivaču i u diffu isto kao ispravan red, a portal ga
	 * čita kao običan tekst". What is asserted below is a line that EQUALS the mark once
	 * stripped, and {@link String#strip()} does not remove a zero width space, so such a line
	 * fails here rather than reaching a reader.
	 *
	 * <p><b>Which blocks are asked about is read off the {@code gallery} column, not off a
	 * list of positions.</b> That is the floor this guard stands on: the rulebook carries two
	 * drawings today, at positions 4 and 18, and a third added tomorrow is covered by this
	 * case without anybody naming it. The count is asserted not to be zero first, because a
	 * query that matched nothing would let every line below it pass over an empty loop.
	 */
	@Test
	void everyTranslatedBlockThatCarriesADrawingStillCarriesTheMarkThatPlacesIt() throws Exception {
		englishTitleFor("pravilnik");
		assertThat(englishBlocksFor("pravilnik", 19))
				.as("the rulebook no longer holds nineteen blocks, so this fixture did not"
						+ " translate the whole of the one page that carries a drawing")
				.isEqualTo(19);

		List<String> drawings = db
				.sql("select s.gallery from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " where p.slug = 'pravilnik' and s.gallery is not null"
						+ " order by s.position")
				.query(String.class).list();

		assertThat(drawings)
				.as("no block of the rulebook carries a drawing, so this case walks an empty list"
						+ " and asserts nothing")
				.isNotEmpty();

		JsonNode rulebook = pageNamed(answerIn(A_LANGUAGE_THESE_FIXTURES_OWN), "pravilnik");

		assertThat(rulebook.path("language").asString())
				.as("the rulebook was written whole in the fixtures' own tag and did not come back"
						+ " in it")
				.isEqualTo(A_LANGUAGE_THESE_FIXTURES_OWN);

		List<String> served = new ArrayList<>();
		int markedBlocks = 0;

		for (JsonNode section : rulebook.path("sections")) {
			if (!section.path("gallery").isNull()) {
				served.add(section.path("gallery").asString());

				assertThat(section.path("body").asString())
						.as("the block that carries the %s drawing came back in Serbian, not in"
								+ " the English this page was asked for - the mark surviving that"
								+ " swap is not evidence the translation ran, only that Serbian"
								+ " happens to carry the same line", section.path("gallery").asString())
						.startsWith(ENGLISH_BODY);

				assertThat(section.path("body").asString().lines().map(String::strip).toList())
						.as("the English words of the block that carries the %s drawing hold no"
								+ " line that is only the mark, so the drawing has nowhere to"
								+ " stand and leaves the page", section.path("gallery").asString())
						.contains(MARK);
				markedBlocks++;
			}
		}

		assertThat(served)
				.as("the English answer does not name the same drawings, in the same order, as"
						+ " the rows behind it - a name is not translated and has no column in"
						+ " V37 to be translated in")
				.isEqualTo(drawings);
		assertThat(markedBlocks)
				.as("the answer carried no block with a drawing at all, so the mark was never"
						+ " looked for")
				.isEqualTo(drawings.size());
	}
}
