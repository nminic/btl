package com.btl.portal.db;

import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE THREE LEGAL PAGES PUT BACK TO THE TEXT V71 FOUND, IN BOTH LANGUAGES, READ OUT OF V71 ITSELF.
 *
 * <p><b>Why this exists.</b> The guards of the migrations before V71 (V41, V43, V46, V57, V58, V60, V61, V70) each
 * put the text back to how it stood before their own migration and run it again. They were written against a page
 * whose sections and articles V71 has since moved, removed and renumbered, so each of them first needs the pages as
 * V70 left them. Writing those pages out a second time here would be a fourth copy of a legal text that already lives
 * in the migrations, the fixture and the snapshot; reading them out of V71 is not a copy, since V71 names every old
 * text it replaces.
 *
 * <p><b>How.</b> The section of the terms of use V71 removes comes back at position 8, word for word as V71's own
 * removal asks for it, and the four sections after it move down by one. Then every edit of V71 is undone, last first:
 * the new text, which stands exactly once, becomes the old text again, and an edit that took text out puts it back at
 * the end of its section, where every such edit of V71 took it from. Each step asks what V71 asks: exactly once.
 *
 * <p><b>What holds this honest</b> is {@link TheWrittenPagesSayEachThingInOnePlaceTest}: V71 run over what this puts
 * back gives the text the portal serves, character for character, and V71 fails loudly over anything else, so a put
 * back that missed one edit would make that case red.
 */
final class TheWrittenPagesBeforeV71 {

	private TheWrittenPagesBeforeV71() {
	}

	/** One edit of V71, as its table of values names it. */
	record Edit(String label, String slug, int position, String language, String field, String oldText,
			String newText) {
	}

	private static final Pattern AN_EDIT = Pattern.compile(
			"\\(\\s*'((?:[^']|'')*)',\\s*'([^']*)',\\s*(\\d+),\\s*'(\\w+)',\\s*'(\\w+)',\\s*"
					+ "\\$old\\$(.*?)\\$old\\$,\\s*\\$new\\$(.*?)\\$new\\$\\)",
			Pattern.DOTALL);

	private static final Pattern THE_REMOVED_SECTION = Pattern.compile(
			"and s\\.heading = '((?:[^']|'')*)'\\s*and s\\.body = \\$body\\$(.*?)\\$body\\$.*?"
					+ "and t\\.heading = '((?:[^']|'')*)'\\s*and t\\.body = \\$body\\$(.*?)\\$body\\$",
			Pattern.DOTALL);

	/** Every edit V71 makes, in the order it makes them. */
	static List<Edit> editsOf(String v71) {
		List<Edit> edits = new ArrayList<>();
		Matcher each = AN_EDIT.matcher(v71);

		while (each.find()) {
			edits.add(new Edit(each.group(1).replace("''", "'"), each.group(2), Integer.parseInt(each.group(3)),
					each.group(4), each.group(5), each.group(6), each.group(7)));
		}

		assertThat(edits).as("no edit could be read out of V71, so nothing would be put back").isNotEmpty();
		assertThat(edits.size() * 2)
				.as("V71 carries an old text that this reading did not pair with its edit")
				.isEqualTo(v71.split("\\$old\\$", -1).length - 1);

		return edits;
	}

	/** One edit of V73: its table has no field column, the body is always the one. */
	private static final Pattern A_BODY_EDIT = Pattern.compile(
			"\\(\\s*'((?:[^']|'')*)',\\s*'([^']*)',\\s*(\\d+),\\s*'(\\w+)',\\s*"
					+ "\\$old\\$(.*?)\\$old\\$,\\s*\\$new\\$(.*?)\\$new\\$\\)",
			Pattern.DOTALL);

	/**
	 * A MIGRATION AFTER V71 UNDONE, so that what is put back is the text V71 left, whatever the later ones have written
	 * since: V73 (24.10.2026), V76 (27.10.2026), V77 and V78 (both 29.10.2026), the latest first.
	 *
	 * <p>Every guard that calls {@link #putBack(JdbcClient, String)} puts the pages back to how they stood before an older
	 * migration and runs it again, and each of them is written against the text V71 left. V73 added the word "drugima"
	 * in three places and moved the sign-off of the policy; V76 moved the dates of the cycle and the sign-off of the
	 * rulebook; V77 struck explanations and familiar phrases from all three pages and moved all three sign-offs; V78 put the ducats
	 * in one sentence and took the map of countries visited out of the policy. None of
	 * that is what those migrations found. Read out of the later migration itself, the way this file reads V71: the new
	 * text of each edit stands exactly once and becomes the old text again.
	 */
	static void undoBodyEdits(JdbcClient db, String version) {
		String v73 = theSqlOf(version);
		List<Edit> edits = new ArrayList<>();
		Matcher each = A_BODY_EDIT.matcher(v73);

		while (each.find()) {
			edits.add(new Edit(each.group(1).replace("''", "'"), each.group(2), Integer.parseInt(each.group(3)),
					each.group(4), "body", each.group(5), each.group(6)));
		}

		assertThat(edits).as("no edit could be read out of V%s, so nothing would be put back", version).isNotEmpty();
		assertThat(edits.size() * 2)
				.as("V%s carries an old text that this reading did not pair with its edit", version)
				.isEqualTo(v73.split("\\$old\\$", -1).length - 1);

		for (int index = edits.size() - 1; index >= 0; index--) {
			Edit edit = edits.get(index);
			String now = textOf(db, edit);

			assertThat(now).as("%s: the text V%s put in must stand exactly once to be taken out", edit.label(), version)
					.containsOnlyOnce(edit.newText());
			write(db, edit, now.replace(edit.newText(), edit.oldText()));
		}
	}

	private static String theSqlOf(String version) {
		try {
			Resource[] found = new PathMatchingResourcePatternResolver()
					.getResources("classpath:db/migration/V" + version + "__*.sql");

			assertThat(found).as("V%s is not on the class path", version).hasSize(1);

			return new String(found[0].getInputStream().readAllBytes(), StandardCharsets.UTF_8);
		} catch (IOException failed) {
			throw new UncheckedIOException(failed);
		}
	}

	static void putBack(JdbcClient db, String v71) {
		undoBodyEdits(db, "78");
		undoBodyEdits(db, "77");
		undoBodyEdits(db, "76");
		undoBodyEdits(db, "73");

		Matcher removed = THE_REMOVED_SECTION.matcher(v71);

		assertThat(removed.find()).as("V71 no longer names the section of the terms of use it removes").isTrue();

		assertThat(db.sql("select count(*) from static_page_section s join static_page p on p.id = s.page_id"
						+ " where p.slug = 'uslovi-koriscenja'")
				.query(Integer.class).single())
				.as("the terms of use do not have the eleven sections V71 leaves, so this is not the text after V71")
				.isEqualTo(11);

		db.sql("update static_page_section s set position = s.position + 1 from static_page p"
						+ " where p.id = s.page_id and p.slug = 'uslovi-koriscenja' and s.position >= 8")
				.update();

		long section = db.sql("insert into static_page_section (page_id, position, heading, body)"
						+ " select id, 8, :heading, :body from static_page where slug = 'uslovi-koriscenja' returning id")
				.param("heading", removed.group(1).replace("''", "'"))
				.param("body", removed.group(2))
				.query(Long.class).single();

		db.sql("insert into static_page_section_translation (section_id, language, heading, body)"
						+ " values (:section, 'en', :heading, :body)")
				.param("section", section)
				.param("heading", removed.group(3).replace("''", "'"))
				.param("body", removed.group(4))
				.update();

		List<Edit> edits = editsOf(v71);

		for (int index = edits.size() - 1; index >= 0; index--) {
			Edit edit = edits.get(index);
			String now = textOf(db, edit);

			if (edit.newText().isEmpty()) {
				assertThat(now).as("%s: the text V71 took out is already back", edit.label())
						.doesNotContain(edit.oldText());
				write(db, edit, now + edit.oldText());
			} else {
				assertThat(now).as("%s: the text V71 put in must stand exactly once to be taken out", edit.label())
						.containsOnlyOnce(edit.newText());
				write(db, edit, now.replace(edit.newText(), edit.oldText()));
			}
		}
	}

	private static String column(Edit edit) {
		assertThat(edit.field()).isIn("body", "heading");

		return edit.field();
	}

	private static String textOf(JdbcClient db, Edit edit) {
		String column = column(edit);

		return edit.language().equals("sr")
				? db.sql("select s." + column + " from static_page_section s join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position")
						.param("slug", edit.slug()).param("position", edit.position())
						.query(String.class).single()
				: db.sql("select t." + column + " from static_page_section_translation t"
								+ " join static_page_section s on s.id = t.section_id"
								+ " join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position and t.language = :language")
						.param("slug", edit.slug()).param("position", edit.position())
						.param("language", edit.language()).query(String.class).single();
	}

	private static void write(JdbcClient db, Edit edit, String text) {
		String column = column(edit);
		int changed = edit.language().equals("sr")
				? db.sql("update static_page_section s set " + column + " = :text from static_page p"
								+ " where p.id = s.page_id and p.slug = :slug and s.position = :position")
						.param("text", text).param("slug", edit.slug()).param("position", edit.position()).update()
				: db.sql("update static_page_section_translation t set " + column + " = :text"
								+ " from static_page_section s, static_page p"
								+ " where s.id = t.section_id and p.id = s.page_id and p.slug = :slug"
								+ " and s.position = :position and t.language = :language")
						.param("text", text).param("slug", edit.slug()).param("position", edit.position())
						.param("language", edit.language()).update();

		assertThat(changed).as("%s: there is no such text to put back", edit.label()).isOne();
	}
}
