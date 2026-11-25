package com.btl.portal.web;

/**
 * EVERY TEXT THE PORTAL TRANSLATES BY MACHINE, one entry each, and the SQL both the pass and the routes read
 * them by.
 *
 * <p>Owner, PDL P18, 25.11.2026: everything a visitor can see is translated, the biography, the description of
 * a team and of an event, „i svaki drugi slobodan tekst koji portal servira posetiocu, a koji nije u rečniku",
 * and the names stay as they were written. Today it is the description of an event and nothing else; the
 * rest arrive one entry at a time, each with the route that serves it. Which column of the schema is which
 * kind of text, translated here or later, by hand, a name, or nothing a visitor reads, is the table
 * {@code EveryTextColumnIsClassifiedTest} holds against the catalogue, so a new column of text cannot arrive
 * without somebody saying which.
 *
 * <p><b>What is translated is exactly what the route serves</b>, because what the pass reads is the same
 * column the route reads, under the same condition ({@link #servedWhere}). A text that waits for a moderator
 * is never in one of these columns at all: a member's biography reaches {@code competitor.bio} only once it
 * is approved (VerificationWriteApi), and the administration's text the moment it is saved. So the moment a
 * text is here is the moment it became valid, whichever road brought it, and that is why one pass on a clock
 * is the whole trigger (owner, „Plan prevoda, prvi krug pitanja”: „Jedan prolaz na 5 minuta nalazi svaki nov
 * ili izmenjen tekst, bez obzira kojim putem je postao validan").
 */
enum WhatIsTranslated {

	/** The description of an event, written by the administration (EventWriteApi) and served by /api/events. */
	EVENT_DESCRIPTION("btl_event", "description", "event_id", "true");

	/** The table the text lives in. */
	final String table;
	/** Its column, which is also what {@code text_translation.field} calls it. */
	final String column;
	/** The column of {@code text_translation} and {@code text_translation_asked} that names the row. */
	final String key;
	/** Which rows of {@link #table} a visitor is served, over the alias {@code x}. */
	final String servedWhere;

	WhatIsTranslated(String table, String column, String key, String servedWhere) {
		this.table = table;
		this.column = column;
		this.key = key;
		this.servedWhere = servedWhere;
	}

	/**
	 * THE DIGEST OF THE TEXT UNDER AN ALIAS, as PostgreSQL computes it: sha256 of its UTF-8 bytes, in hex. Its one
	 * home is the database, so the pass that writes a digest and the route that compares one cannot compute two.
	 */
	String digestOf(String alias) {
		return "encode(sha256(convert_to(" + alias + "." + column + ", 'UTF8')), 'hex')";
	}

	/**
	 * WHAT A ROUTE JOINS TO SHOW THE TEXT IN THE LANGUAGE {@code :language}: the translation made of the text AS IT
	 * NOW STANDS (a hand one before a machine one), and what the service recognised that same version as. Columns
	 * {@code <column>_shown.body}, {@code <column>_shown.machine} and {@code <column>_heard.source_language}, each
	 * null where there is nothing.
	 */
	String joinedOver(String alias) {
		String same = "t." + key + " = " + alias + ".id and t.field = '" + column + "'"
				+ " and t.source_digest = " + digestOf(alias);

		return " left join lateral (select t.body, t.origin = 'machine' from text_translation t where " + same
				+ " and t.language = :language order by t.origin = 'manual' desc limit 1)"
				+ " as " + column + "_shown (body, machine) on true"
				+ " left join lateral (select t.source_language from text_translation t where " + same
				+ " and t.origin = 'machine' limit 1) as " + column + "_heard (source_language) on true";
	}

	/** The three columns {@link #joinedOver} adds, in the order {@link TranslatedText#shown} takes them. */
	String joinedColumns() {
		return column + "_heard.source_language, " + column + "_shown.body, coalesce(" + column + "_shown.machine,"
				+ " false)";
	}

	/**
	 * EVERY SERVED TEXT THAT HAS NO MACHINE TRANSLATION OF ITS PRESENT VERSION, with its digest and when it was last
	 * sent. In no order: the pass puts the texts of every kind in one order ({@code TextsAreTranslated#chosen}), so an
	 * order here would be a second one, and measured it was (a mutation of it survived). A version the portal threw a
	 * translation of away is not here; the same words would come back the same (V112, {@code thrown_away}).
	 */
	String waiting() {
		return "select x.id, x." + column + ", " + digestOf("x") + ", a.asked_at"
				+ " from " + table + " x"
				+ " left join text_translation_asked a on a." + key + " = x.id and a.field = '" + column + "'"
				+ " where " + servedWhere + " and btrim(x." + column + ") <> ''"
				+ " and not exists (select 1 from text_translation t where t." + key + " = x.id"
				+ " and t.field = '" + column + "' and t.origin = 'machine' and t.source_digest = " + digestOf("x") + ")"
				+ " and not coalesce(a.thrown_away and a.source_digest = " + digestOf("x") + ", false)";
	}

	/**
	 * THE MACHINE'S TRANSLATIONS OF TEXTS THAT ARE NO LONGER SERVED OR NO LONGER SAY ANYTHING, which go: a
	 * description emptied by the administration is words nobody wrote any more, and a translation of them is a
	 * copy of something that was taken down. Hand rows stay, for the reason V112 gives.
	 */
	String forgetting() {
		return "delete from text_translation t using " + table + " x where t." + key + " = x.id"
				+ " and t.field = '" + column + "' and t.origin = 'machine'"
				+ " and (btrim(x." + column + ") = '' or not (" + servedWhere + "))";
	}
}
