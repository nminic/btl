package com.btl.portal.web;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * WHAT A READER IS SHOWN OF A TEXT THAT MAY HAVE BEEN TRANSLATED, and the one place that decides it.
 *
 * <p>Owner, PDL P18, 25.11.2026, „Automatski prevod sadržaja koji posetilac vidi”: „treba da ne postoji ni
 * jedan deo portala koji posetilac iz US recimo moze da vidi a da nema engleski prevod”, and the plan he
 * accepted the same day: when there is no translation, or the service did not answer, the original is shown;
 * a translation of an original that has changed since is not shown at all. Every route that serves a
 * translated text asks this class and nothing else, so the rule cannot be told two ways by two routes.
 *
 * <p><b>A text is shown as written to a reader of its own language.</b> A description written in English is
 * English on {@code /en} whatever the service made of it, and Serbian written by a member is Serbian on
 * {@code /sr}. What the language of the original is comes from the service ({@code source_language}, V113),
 * because nobody on the portal says it: the owner, „Servis sam prepoznaje jezik originala".
 */
final class TranslatedText {

	/** The shape of a tag a route accepts in {@code ?lang=}, the shape {@code PageApi} and {@code SponsorApi} check. */
	static final Pattern A_LANGUAGE_TAG = Pattern.compile("^[a-z]{2,3}$");

	/** What the query parameter is called, the name {@code PageApi.THE_LANGUAGE_ASKED_FOR} gives it. */
	static final String THE_LANGUAGE_ASKED_FOR = PageApi.THE_LANGUAGE_ASKED_FOR;

	/**
	 * THE LANGUAGES THE SERVICE MAY CALL SERBIAN, which on this portal are one reader.
	 *
	 * <p>The service tells Serbian, Croatian, Bosnian and Montenegrin apart, and the portal does not: PDL P18,
	 * „Hrvatski, bosanski, makedonski i crnogorski se ne uvode, jer su prva tri iz te grupe međusobno razumljiva sa
	 * srpskim". A short Serbian text is easily heard as Croatian, and a reader of {@code /sr} must be shown it as
	 * written and not a translation of it into the language it already is in. Macedonian is not here: the same
	 * sentence makes it a language of its own.
	 */
	private static final Set<String> HEARD_AS_SERBIAN = Set.of("sr", "hr", "bs", "cnr", "sh");

	/**
	 * WHAT A TEXT TRANSLATED BY A MACHINE MUST CARRY UNCHANGED: every address of a site and every mailbox in it.
	 * A description holds the organiser's site and the address to write to (EventDetail draws a mailbox as a
	 * link), and a translation that moved a letter of one of them is a link to somewhere else, published without
	 * anybody having read it. So it is thrown away and the original is shown.
	 */
	private static final Pattern AN_ADDRESS = Pattern.compile(
			"(?i)(?:https?://|mailto:|www\\.)[^\\s<>()\\[\\]\"']+|[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}");

	private TranslatedText() {
	}

	/** Whether a {@code ?lang=} is there and is not shaped like a language tag, which a route refuses with 400. */
	static boolean isMalformed(String lang) {
		return lang != null && !A_LANGUAGE_TAG.matcher(lang).matches();
	}

	/**
	 * WHAT A ROUTE ANSWERS FOR ONE TEXT, off the three columns {@link WhatIsTranslated#joinedColumns} added at
	 * {@code firstColumn}, or null where it was asked in no language or there is no text to show (a biography the
	 * reader may not read is null in the answer, and so is what is shown of it).
	 */
	static Shown read(java.sql.ResultSet row, int firstColumn, String original, String asked)
			throws java.sql.SQLException {
		return asked == null ? null : readWrittenIn(row, firstColumn, original, asked, row.getString(firstColumn));
	}

	/**
	 * THE SAME FOR A TEXT WHOSE LANGUAGE IS KNOWN, not read off a machine row: a ducat is written in Serbian and its
	 * English by a person, so there is no row of the service's to say what it read.
	 */
	static Shown readWrittenIn(java.sql.ResultSet row, int firstColumn, String original, String asked,
			String writtenIn) throws java.sql.SQLException {
		if (asked == null || original == null) {
			return null;
		}

		return shown(original, asked, writtenIn, row.getString(firstColumn + 1), row.getBoolean(firstColumn + 2));
	}

	/**
	 * WHAT A READER IS SHOWN OF ONE TEXT.
	 *
	 * @param text     the words
	 * @param language the portal's tag of the language they are in, or null where nobody knows yet: an original
	 *                 the service has not read. A screen marks the words with it ({@code lang}), so that a
	 *                 screen reader does not read Serbian with English phonetics (ADL A7)
	 * @param machine  whether a machine wrote them, which the screen says beside them (owner, 25.11.2026,
	 *                 „uz mašinski preveden tekst stoji kratka oznaka")
	 */
	record Shown(String text, String language, boolean machine) {
	}

	/**
	 * THE RULE.
	 *
	 * @param original    the text as it stands
	 * @param asked       the reader's language, a portal tag
	 * @param heardAs     what the service recognised the original as, read off a translation made of THIS
	 *                    version of it; null where there is none
	 * @param translation the translation into {@code asked} made of this version of the original, the hand one
	 *                    where there is one; null where there is none
	 * @param machine     whether {@code translation} was made by a machine
	 */
	static Shown shown(String original, String asked, String heardAs, String translation, boolean machine) {
		String originalIn = heardAs == null ? null : portalLanguageOf(heardAs);

		if (original.isBlank() || translation == null || asked.equals(originalIn)) {
			return new Shown(original, originalIn, false);
		}

		return new Shown(translation, asked, machine);
	}

	/**
	 * THE PORTAL'S TAG FOR WHAT THE SERVICE SAYS A TEXT IS WRITTEN IN: {@code sr} for every language this portal
	 * reads as Serbian, and otherwise the language without its script ({@code en}, {@code de}), which is what a
	 * {@code lang} attribute wants.
	 */
	static String portalLanguageOf(String heardAs) {
		String language = heardAs.toLowerCase(Locale.ROOT).split("-", 2)[0];

		return HEARD_AS_SERBIAN.contains(language) ? "sr" : language;
	}

	/**
	 * Every address of a site and every mailbox in a text, in order, without the sentence's own full stop or
	 * comma after it, so that a translation that only moved one of them is told apart from one that changed it.
	 */
	static List<String> addressesIn(String text) {
		List<String> found = new ArrayList<>();
		Matcher at = AN_ADDRESS.matcher(text);

		while (at.find()) {
			found.add(at.group().replaceAll("[.,;:!?]+$", "").toLowerCase(Locale.ROOT));
		}

		found.sort(null);

		return found;
	}
}
