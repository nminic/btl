package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
 * <p><b>No revision history, and that is a boundary rather than a gap</b> (ADL A12,
 * „Revizioni trag, da se ne traži tamo gde ga nema").
 * The schema carries exactly three things standing in for a trail nobody keeps: a
 * result's own last-edit stamp, the balance ledger's immutable rows, and mail as the
 * log. A written page is none of the three, so editing one overwrites its text and
 * nothing here remembers what stood there before.
 */
@RestController
class PageApi {

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
	 *                rather than as a field here
	 */
	record Section(String heading, String body, String gallery) {
	}

	/**
	 * One written page: its own address, its own text, and the pages it takes in.
	 *
	 * @param slug     the address a human typed, and the one identity this schema still
	 *                 checks for being taken (ADL A4d, „identitet i dalje kuca čovek:
	 *                 adresa statične strane") - every other identity in this portal
	 *                 is constructed and this one is not
	 * @param sections this page's own blocks, in the order they are read; empty on a
	 *                 page that has none yet
	 * @param includes the addresses of other pages whose sections are read above this
	 *                 one's own, in that order (ADL A7, 30.07.2026, „Pisana strana sme
	 *                 da preuzme drugu pisanu stranu"); empty where this page takes
	 *                 nothing in, which is every page today
	 */
	record Page(String slug, String title, List<Section> sections, List<String> includes) {
	}

	private record PageRow(String slug, String title) {
	}

	private record SectionLine(String slug, String heading, String body, String gallery) {
	}

	private record IncludeLine(String slug, String included) {
	}

	@GetMapping("/api/pages")
	List<Page> pages() {
		List<PageRow> rows = db.sql("select slug, title from static_page order by id")
				.query((row, one) -> new PageRow(row.getString(1), row.getString(2)))
				.list();

		Map<String, List<Section>> sections = sectionsByPage();
		Map<String, List<String>> includes = includesByPage();

		List<Page> pages = new ArrayList<>();

		for (PageRow row : rows) {
			pages.add(new Page(row.slug(), row.title(),
					sections.getOrDefault(row.slug(), List.of()),
					includes.getOrDefault(row.slug(), List.of())));
		}

		return pages;
	}

	/** Every page's own blocks, gathered in one query and grouped by the page they
	 *  belong to - the shape {@link VerificationApi} already reads a queue of waiting
	 *  items by. */
	private Map<String, List<Section>> sectionsByPage() {
		List<SectionLine> lines = db.sql("select p.slug, s.heading, s.body, s.gallery"
						+ " from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						/* BY POSITION, AND POSITION IS A COLUMN, NOT THE ORDER ROWS WERE
						   WRITTEN IN. A PostgreSQL UPDATE writes a new version of a row at
						   the end of the table, so dropping this clause would still read
						   today's rows back in the order they were inserted - which is this
						   same order - and only show itself the day somebody reorders a
						   page's sections without this line reading the reorder back. */
						+ " order by s.page_id, s.position")
				.query((row, one) -> new SectionLine(row.getString(1), row.getString(2),
						row.getString(3), row.getString(4)))
				.list();

		Map<String, List<Section>> byPage = new LinkedHashMap<>();

		for (SectionLine line : lines) {
			byPage.computeIfAbsent(line.slug(), any -> new ArrayList<>())
					.add(new Section(line.heading(), line.body(), line.gallery()));
		}

		return byPage;
	}

	/** Every page this table says a page takes in, by the address of the page doing the
	 *  taking in and the address of the one taken in - so the answer never has to carry
	 *  an internal id nobody outside this class reads. */
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
