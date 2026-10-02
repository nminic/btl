package com.btl.portal.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * THE WRITTEN PAGES THE PORTAL PUBLISHES: THE RULEBOOK, THE TWO LEGAL TEXTS, AND THE
 * PRESIDENT'S OWN WORD.
 *
 * <p><b>It is public, and that is not a convenience.</b> A privacy policy and terms of
 * use that only a member could read would ask somebody to accept them before they can
 * be read, and PDL P23, „Politika privatnosti i uslovi korišćenja moraju postojati pre
 * lansiranja", says so in as many words - before there is anybody signed in to read them
 * any other way.
 * The rulebook is what the terms of use themselves point a prospective member at for
 * the price of joining ({@code uslovi-koriscenja}, section 3), and the president's
 * address is drawn on the front page, which is the first thing a visitor sees.
 *
 * <p><b>Nine settings split into two homes, the same way {@link DucatApi} splits
 * sixteen.</b> Four are this table's: the address, the title, the text, and which other
 * pages are read above it. What is NOT here is how a page is laid out beyond the order
 * of its own blocks - there is one column and one renderer for it
 * ({@code Markdown.tsx}), so there is nothing else to serve.
 *
 * <p><b>SINCE 26.09.2026 A PAGE IS ASKED FOR IN A LANGUAGE</b> (owner, PDL P18,
 * chosen from four outcomes: „sema dobija jezik, tekst se prevodi, i sve ide do
 * lansiranja"). What that changed here is one parameter and one field; the Serbian answer
 * is byte for byte the answer this route gave before, which is what
 * {@code PageApiTest.theAnswerIsExactlyWhatTheMockFileHoldsToday} holds it to.
 *
 * <p><b>The language travels in the QUERY and not in the path, and that is measured
 * rather than chosen.</b> {@code ApiSecurityTest.noOpenRouteOpensAnythingBesideIt}
 * requires every path beside an entry of {@link ApiSecurity#READ_BY_ANYBODY} to answer
 * 401, so {@code /api/pages/en} is a path a visitor could not be allowed to read;
 * moving this route to {@code READ_BY_ANYBODY_UNDER_A_NAME} instead would require
 * {@code /api/pages} itself to shut, which PDL P23 forbids. A header would work and is
 * refused for the reason PDL P18 gives for putting the language in the address
 * rather than in a cookie: anything outside the address has to be varied on at the edge,
 * „što ruši keširanje na ivici (ADL.md, A6)". A query string is part of the address, so
 * the edge holds the two languages as two resources.
 *
 * <p><b>It is spelt {@code lang} while the column is spelt {@code language}, on
 * purpose.</b> The parameter is what the frontend turns into the {@code lang} attribute
 * of the element the words are drawn in, so it is named for what a screen reader reads;
 * the column names the thing it holds.
 *
 * <p><b>No revision history, and that is a boundary rather than a gap</b> (ADL A12,
 * „Revizioni trag, da se ne traži tamo gde ga nema").
 * The schema carries exactly three things standing in for a trail nobody keeps: a
 * result's own last-edit stamp, the balance ledger's immutable rows, and mail as the
 * log. A written page is none of the three, so editing one overwrites its text and
 * nothing here remembers what stood there before.
 */
@RestController
class PageApi {

	/**
	 * THE LANGUAGE THE ORIGINAL IS IN, and the answer to everything this route cannot
	 * answer in the language it was asked for.
	 *
	 * <p>PDL P18: „Kod pravnih tekstova mora biti izričito navedeno koja je jezička
	 * verzija merodavna, i to je <b>srpska</b>." So the Serbian is not a fallback in the
	 * sense of a second best: it is the version that binds, it lives in the base tables
	 * where the schema cannot let it go missing, and V37's
	 * {@code static_page_translation_not_serbian} refuses to hold a second copy of it.
	 */
	static final String THE_ORIGINAL = "sr";

	/** The name of the parameter, held here so the route and every case that asks it are
	 *  one text rather than two that have to be kept equal. */
	static final String THE_LANGUAGE_ASKED_FOR = "lang";

	/**
	 * WHAT A LANGUAGE TAG LOOKS LIKE, which is the only question this route asks about the
	 * value it was handed.
	 *
	 * <p>PDL P18: „Oznake jezika: {@code sr} i {@code en}. Ako se jednog dana doda
	 * crnogorski, oznaka je {@code cnr}." Two or three lower-case letters, the same
	 * sentence V37 checks in the column.
	 *
	 * <p><b>Deliberately not a list of the languages the portal has.</b> A list would
	 * have to be kept equal to {@code frontend/src/i18n/config.ts}'s {@code LOCALES}
	 * across the boundary between the two halves of the repository, and it would answer
	 * 400 for {@code cnr} on the day that tag is entered as data, which PDL P18
	 * („kao unos a ne kao razvoj") is written to prevent. Asking about the SHAPE is
	 * complete by construction - it is answered by looking at the value - where asking
	 * „is this one of ours" has to be kept in step with something else.
	 *
	 * <p><b>And a tag this portal has no words in is not an error.</b> It is served the
	 * original, and the answer says so, which is the same mechanism and the same field as
	 * a translation that has not been written yet. One rule covers both, so both are
	 * measured by the same cases.
	 */
	private static final Pattern A_LANGUAGE_TAG = Pattern.compile("^[a-z]{2,3}$");

	private final JdbcClient db;

	PageApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * One block of a page's own text, in the order it is read.
	 *
	 * @param gallery the named drawing this block carries, {@code ducats} or
	 *                {@code prices}; null on a block that carries none (ADL A7,
	 *                04.08.2026, „Pisana strana sme da nosi imenovan crtež"). Where the
	 *                drawing stands within {@code body} is a line holding nothing but
	 *                {@code [[gallery]]} (ADL A7, 21.08.2026, „Sekcija kaže i gde crtež
	 *                stoji") - the frontend's own concern, so it travels inside the text
	 *                rather than as a field here. It is therefore INSIDE the text a
	 *                translator rewrites, and it has to come out the other side spelt the
	 *                same; the name of the drawing itself is not translated and has no
	 *                column in V37
	 */
	record Section(String heading, String body, String gallery) {
	}

	/**
	 * One written page: its own address, its own text, and the pages it takes in.
	 *
	 * @param slug     the address this page is served under. It is written by hand, in the
	 *                 migration that inserts the page, and the schema alone holds it unique
	 *                 ({@code static_page_slug_unique}, V24): no route writes a written page,
	 *                 and none will, because the owner chose on 18.09.2026, among three
	 *                 outcomes offered, that no written page is edited in the portal (ADL, the
	 *                 entry on static pages). So no form asks a person to type an address
	 *                 and none checks that one is taken. ADL A4d used to name this address as
	 *                 the one identity a person still types, and the one place such a check
	 *                 was kept; that sentence was struck out on 27.09.2026 and is not the
	 *                 rule. NOT translated: PDL P18
	 *                 gives the addresses as {@code /sr/kalendar} and {@code /en/kalendar},
	 *                 so the language is a prefix and the path itself stays Serbian
	 * @param language the language the words of THIS page are really in, which is not
	 *                 always the language they were asked for. Where a translation exists
	 *                 and is whole it is the tag that was asked for; everywhere else it is
	 *                 {@link #THE_ORIGINAL}.
	 *                 <p><b>Why the answer says this rather than leaving the caller to
	 *                 assume.</b> {@code frontend/src/i18n/config.ts} keeps a table of
	 *                 which address is written in which language for one measured reason:
	 *                 {@code lang="en"} over Serbian text makes a screen reader read
	 *                 Serbian with English phonetics, „which is unintelligible". That
	 *                 table knows the language of a SWITCH; this field knows the language
	 *                 of a PAGE, which is the finer and the true fact, so nothing has to
	 *                 be guessed while a translation is on its way
	 * @param sections this page's own blocks, in the order they are read; empty on a
	 *                 page that has none yet
	 * @param includes the addresses of other pages whose sections are read above this
	 *                 one's own, in that order (ADL A7, 30.07.2026, „Pisana strana sme
	 *                 da preuzme drugu pisanu stranu"); empty where this page takes
	 *                 nothing in, which is every page today
	 */
	record Page(String slug, String title, String language, List<Section> sections,
			List<String> includes) {
	}

	/**
	 * @param translated whether this page is whole in the language that was asked for:
	 *                   its title AND every one of its blocks. See
	 *                   {@link #pagesIn(String)} for why it is all or nothing
	 */
	private record PageRow(String slug, String title, String translatedTitle, boolean translated) {
	}

	private record SectionLine(String slug, String heading, String body, String gallery,
			String translatedHeading, String translatedBody) {
	}

	private record IncludeLine(String slug, String included) {
	}

	/**
	 * @param lang the language to read these pages in, absent for {@link #THE_ORIGINAL}.
	 *             A value that is not shaped like a language tag is refused with 400 and
	 *             no body - there is no sentence to put in one, because no screen of this
	 *             portal can send such a value: {@code LocaleLayout.tsx} sends an unknown
	 *             locale to the default language before anything is fetched. Written as an
	 *             explicit check returning an explicit status because that is what every
	 *             other refusal on this portal is; there is no {@code @Valid} and no
	 *             {@code @ControllerAdvice} anywhere in {@code src/main/java}, and
	 *             {@link NothingIsHereRatherThanAlmost} says why an advice is the wrong
	 *             place for this kind of answer. The bodyless form is
	 *             {@code EventWriteApi}'s
	 */
	@GetMapping("/api/pages")
	ResponseEntity<?> pages(@RequestParam(name = THE_LANGUAGE_ASKED_FOR, required = false) String lang) {
		if (lang != null && !A_LANGUAGE_TAG.matcher(lang).matches()) {
			return ResponseEntity.badRequest().build();
		}

		return ResponseEntity.ok(pagesIn(lang == null ? THE_ORIGINAL : lang));
	}

	/**
	 * EVERY WRITTEN PAGE, IN ONE LANGUAGE, WITH EACH PAGE SAYING WHICH LANGUAGE IT REALLY
	 * CAME BACK IN.
	 *
	 * <p><b>A page is translated WHOLE or not at all, and that is a decision and not an
	 * implementation.</b> Asked for a language, a page answers in it only when its title
	 * and every one of its blocks have been written in it; otherwise the whole page
	 * answers in {@link #THE_ORIGINAL}. Eighteen articles of the rulebook in English and
	 * the nineteenth in Serbian is not a contract anybody could rely on, and PDL P18
	 * refuses the same thing one level up, where the owner was offered English on the
	 * public pages only: „{@code /en} bi postao <b>delimično srpski</b>, što izgleda kao
	 * kvar a ne kao odluka."
	 *
	 * <p>The useful half of that is what it does for the weeks a translation is being
	 * written: it can arrive a block at a time, in as many commits as it takes, and no
	 * reader ever sees a half-translated legal text. The page turns English on the commit
	 * that brings the last block, and not before.
	 *
	 * <p><b>Serbian needs no branch of its own anywhere below, which is why there isn't
	 * one.</b> V37 refuses to hold a row spelling {@code sr}
	 * ({@code static_page_translation_not_serbian}), so asked for the original every join
	 * below finds nothing, every page is „not translated", and the original is what comes
	 * back. The same is true of a tag the portal has no words in. One path, three
	 * questions answered.
	 */
	private List<Page> pagesIn(String language) {
		List<PageRow> rows = db.sql("select p.slug, p.title, t.title,"
						/* WHOLE OR NOT AT ALL: a title in this language, and not one block
						   of this page left without one. Written as NOT EXISTS over the
						   blocks rather than as two counts compared, because it is the
						   sentence itself - „is there a block that has not been written" -
						   and it stops at the first one. */
						+ " (t.id is not null and not exists ("
						+ "   select 1 from static_page_section s"
						+ "   left join static_page_section_translation st"
						+ "     on st.section_id = s.id and st.language = :language"
						+ "   where s.page_id = p.id and st.id is null))"
						+ " from static_page p"
						+ " left join static_page_translation t"
						+ "   on t.page_id = p.id and t.language = :language"
						+ " order by p.id")
				.param("language", language)
				.query((row, one) -> new PageRow(row.getString(1), row.getString(2),
						row.getString(3), row.getBoolean(4)))
				.list();

		Map<String, List<SectionLine>> sections = sectionsByPage(language);
		Map<String, List<String>> includes = includesByPage();

		List<Page> pages = new ArrayList<>();

		for (PageRow row : rows) {
			pages.add(new Page(row.slug(),
					row.translated() ? row.translatedTitle() : row.title(),
					row.translated() ? language : THE_ORIGINAL,
					wordsOf(sections.getOrDefault(row.slug(), List.of()), row.translated()),
					includes.getOrDefault(row.slug(), List.of())));
		}

		return pages;
	}

	/**
	 * One page's blocks in the language that page came back in.
	 *
	 * <p>There is no per-block fallback here, and its absence is the invariant above being
	 * relied on rather than an omission: {@code translated} is only true when NO block of
	 * this page is missing its words, so the translated heading and body cannot be null
	 * where they are read. A defensive {@code translatedHeading != null ? ... : heading}
	 * would be a branch nothing could ever take, which is exactly what the 100 per cent
	 * branch floor exists to catch.
	 */
	private static List<Section> wordsOf(List<SectionLine> lines, boolean translated) {
		List<Section> sections = new ArrayList<>();

		for (SectionLine line : lines) {
			sections.add(translated
					? new Section(line.translatedHeading(), line.translatedBody(), line.gallery())
					: new Section(line.heading(), line.body(), line.gallery()));
		}

		return sections;
	}

	/** Every page's own blocks, gathered in one query and grouped by the page they
	 *  belong to - the shape {@link VerificationApi} already reads a queue of waiting
	 *  items by. Each line carries both languages, because which of the two is served is
	 *  a fact about the PAGE and is not known until the page is assembled. */
	private Map<String, List<SectionLine>> sectionsByPage(String language) {
		List<SectionLine> lines = db.sql("select p.slug, s.heading, s.body, s.gallery,"
						+ " st.heading, st.body"
						+ " from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						/* The drawing is NOT joined in from the translation: it has no
						   column there, because the name of a drawing is the same name in
						   every language (V37's header). */
						+ " left join static_page_section_translation st"
						+ "   on st.section_id = s.id and st.language = :language"
						/* BY POSITION, AND POSITION IS A COLUMN, NOT THE ORDER ROWS WERE
						   WRITTEN IN. A PostgreSQL UPDATE writes a new version of a row at
						   the end of the table, so dropping this clause would still read
						   today's rows back in the order they were inserted - which is this
						   same order - and only show itself the day somebody reorders a
						   page's sections without this line reading the reorder back. */
						+ " order by s.page_id, s.position")
				.param("language", language)
				.query((row, one) -> new SectionLine(row.getString(1), row.getString(2),
						row.getString(3), row.getString(4), row.getString(5), row.getString(6)))
				.list();

		Map<String, List<SectionLine>> byPage = new LinkedHashMap<>();

		for (SectionLine line : lines) {
			byPage.computeIfAbsent(line.slug(), any -> new ArrayList<>()).add(line);
		}

		return byPage;
	}

	/** Every page this table says a page takes in, by the address of the page doing the
	 *  taking in and the address of the one taken in - so the answer never has to carry
	 *  an internal id nobody outside this class reads. Not asked in a language: an address
	 *  is not translated (PDL P18). */
	private Map<String, List<String>> includesByPage() {
		List<IncludeLine> lines = db.sql("select p.slug, included.slug"
						+ " from static_page_include i"
						+ " join static_page p on p.id = i.page_id"
						+ " join static_page included on included.id = i.included_page_id"
						+ " order by i.page_id, i.position")
				.query((row, one) -> new IncludeLine(row.getString(1), row.getString(2)))
				.list();

		Map<String, List<String>> byPage = new LinkedHashMap<>();

		for (IncludeLine line : lines) {
			byPage.computeIfAbsent(line.slug(), any -> new ArrayList<>()).add(line.included());
		}

		return byPage;
	}
}
