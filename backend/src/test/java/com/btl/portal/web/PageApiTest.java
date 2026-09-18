package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE WRITTEN PAGES AS THE PORTAL ANSWERS THEM, AGAINST THE FILE THEY WERE SEEDED FROM.
 *
 * <p><b>Why this compares against the mock file directly, and not through
 * {@code Answers}.</b> {@code Answers.servedRecord} requires the file to be a JSON
 * ARRAY (it takes element zero); {@code frontend/public/mock/pages.json} is an OBJECT
 * keyed by slug, which is exactly why the resource below answers with an explicit
 * {@code slug} field instead of making a caller pull it out of a map key. So this file
 * walks {@code pages.json} itself, the same decision {@code PricingApiTest} took for
 * its own reason (no served file at all) and documented rather than forced through the
 * shared helper.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PageApiTest {

	private static final Path MOCK = Path.of("..", "frontend", "public", "mock", "pages.json");

	/** V24's four rows, in the order {@code pages.json} itself holds them - the order
	 *  the generator that wrote V24 read the file in, and so the order {@code static_page.id}
	 *  puts them in. */
	private static final List<String> SLUGS =
			List.of("politika-privatnosti", "uslovi-koriscenja", "rec-predsednika", "pravilnik");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(http.perform(get("/api/pages"))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
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
	 * THE ANSWER IS EXACTLY WHAT frontend/public/mock/pages.json HOLDS TODAY: the same
	 * four pages, in the same order, each with the same title, the same sections in the
	 * same order, and the same gallery on each.
	 *
	 * <p>V24 was seeded from this file (task instruction, section 4: „Pocetne redove
	 * uzmi iz frontend/public/mock/pages.json"). This is the strong, field-by-field
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
			JsonNode expectedPage = theirs.path(slug);

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
	 * them by registering (`PDL.md`:3094, „moraju postojati pre lansiranja"), and the
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
		assertThat(ApiSecurity.READ_BY_ANYBODY)
				.as("/api/pages answers 200 without a session and is not on the open list, so"
						+ " something else is opening it")
				.contains("/api/pages");
	}
}
