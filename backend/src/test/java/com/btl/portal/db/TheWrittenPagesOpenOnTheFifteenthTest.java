package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PAGES A MEMBER READS NAME THE SAME DAY THE PRICE TABLE OPENS ON, IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists, and it is the other half of V49.</b> That migration moves five
 * sentences with two {@code replace()} calls per language rather than retyping three section
 * bodies. A replace is exact and cannot mistype a paragraph it does not touch - and it has one
 * failure mode, which is to match NOTHING and report success. Every case here is aimed at that
 * failure mode, and at the other direction with it: a further home of the old day appearing in
 * a page tomorrow.
 *
 * <p><b>THE SWEEP IS OVER EVERY ROW, with no {@code where} clause at all</b>, so every section
 * of every page in every language is read, in whatever language somebody adds next. The shape
 * is {@link RulebookPenaltyIsGoneTest}'s and so is the reason: what is worth holding is not
 * that one article is right but that NO article is wrong.
 *
 * <p><b>THE DAY IS NOT WRITTEN IN THIS FILE. IT IS READ OUT OF THE PRICE TABLE.</b> That is
 * what makes this a floor rather than a second copy of the migration: the number the pages are
 * held to is {@code min(day_from)} over the periods that sell a season not yet begun, so the
 * day the prose names and the day the portal charges by cannot part company. Move the table
 * alone and this fails; move the prose alone and this fails. A literal 15 here would move with
 * whoever edited it and hold nothing (ADL, 29.09.2026, „Pod koji ponavlja USLOV iz fajla koji
 * meri nije pod").
 *
 * <p><b>And the phrases that must be GONE have a floor of their own</b>, which the day cannot
 * give them: {@link #everyPhraseThisExpectsToBeGoneWasReallyThere} runs them against the
 * migrations that WROTE that text - V24 and V46 for Serbian, V43 for English - read out of the
 * files Flyway resolved. Those files are immutable (ADL A2) and V49 cannot reach them, so a
 * phrase that matches nothing there is decorative and fails. Without it this file could be
 * quietly narrowed to phrases the pages never used and stay green.
 */
class TheWrittenPagesOpenOnTheFifteenthTest extends DatabaseTest {

	/**
	 * What the pages said while the selling year began on 1 October.
	 *
	 * <p>Five sentences use these, across the terms of use and two sections of the rulebook,
	 * and all five contain the first phrase - which is why one replacement reaches them all.
	 * The second is the other end of the same sentence, the day the running season stops being
	 * on sale.
	 */
	private static final List<String> THE_OLD_DAY_IN_SERBIAN =
			List.of("od 1. oktobra", "do 30. septembra tekuća");

	private static final List<String> THE_OLD_DAY_IN_ENGLISH =
			List.of("from 1 October", "to 30 September the current one is");

	private List<String> serbianBodies() {
		return db.sql("select body from static_page_section").query(String.class).list();
	}

	private List<String> englishBodies() {
		return db.sql("select body from static_page_section_translation").query(String.class).list();
	}

	/** The day of the month the price list starts selling a season that has not begun. */
	private int theSellingYearOpensOn() {
		return dayOfMonth(db
				.sql("select min(day_from) from price_row where kind = 'period' and ranking")
				.query(String.class)
				.single());
	}

	/** And the day the one period that is not ranked - the running season - stops. */
	private int theRunningSeasonIsSoldUntil() {
		return dayOfMonth(db
				.sql("select day_to from price_row where kind = 'period' and not ranking")
				.query(String.class)
				.single());
	}

	private static int dayOfMonth(String monthDay) {
		assertThat(monthDay)
				.as("the price list has no such period, so the day below is read off nothing")
				.isNotNull();

		return Integer.parseInt(monthDay.substring(3));
	}

	@Test
	void noSerbianSectionOfAnyPageStillNamesTheDayTheSellingYearUsedToOpenOn() {
		List<String> bodies = serbianBodies();

		assertThat(bodies).as("there is no page text at all, so this case measures nothing").isNotEmpty();

		for (String gone : THE_OLD_DAY_IN_SERBIAN) {
			assertThat(bodies)
					.as("a section still carries \"%s\", so the portal tells a member the selling"
							+ " year opens on a day it no longer opens on", gone)
					.noneMatch(body -> body.contains(gone));
		}
	}

	@Test
	void noEnglishSectionOfAnyPageStillNamesItEither() {
		List<String> bodies = englishBodies();

		assertThat(bodies).as("there is no English page text at all, so this case measures nothing")
				.isNotEmpty();

		for (String gone : THE_OLD_DAY_IN_ENGLISH) {
			assertThat(bodies)
					.as("an English section still carries \"%s\"", gone)
					.noneMatch(body -> body.contains(gone));
		}
	}

	/**
	 * AND THE DAY THEY DO NAME IS THE ONE THE TABLE HOLDS.
	 *
	 * <p>Asked in both directions of one sentence: the day the next season goes on sale, and
	 * the day the running one stops being sold. A migration that emptied the paragraphs
	 * altogether would pass both cases above and fails here.
	 */
	@Test
	void theDayThePagesNameIsTheDayThePriceTableOpensOn() {
		String opens = "od %d. oktobra".formatted(theSellingYearOpensOn());
		String until = "do %d. oktobra tekuća".formatted(theRunningSeasonIsSoldUntil());

		assertThat(serbianBodies())
				.as("no section says the selling year opens with \"%s\", which is the day"
						+ " price_row actually starts selling next season", opens)
				.anyMatch(body -> body.contains(opens));
		assertThat(serbianBodies())
				.as("no section says the running season is on sale \"%s\"", until)
				.anyMatch(body -> body.contains(until));
	}

	@Test
	void andTheEnglishPagesNameTheSameDay() {
		String opens = "from %d October".formatted(theSellingYearOpensOn());
		String until = "to %d October the current one is".formatted(theRunningSeasonIsSoldUntil());

		assertThat(englishBodies())
				.as("no English section says \"%s\"", opens)
				.anyMatch(body -> body.contains(opens));
		assertThat(englishBodies())
				.as("no English section says \"%s\"", until)
				.anyMatch(body -> body.contains(until));
	}

	/**
	 * THE PHRASES ABOVE REALLY WERE IN THE PAGES, asked of the migrations that wrote them.
	 *
	 * <p>Without this, the two cases about what is GONE are satisfied by any phrase nobody
	 * ever used, and narrowing them would look like tightening. V24 and V46 wrote the Serbian
	 * text and V43 the English; all three are applied and immutable, so V49 cannot make this
	 * pass by editing them.
	 *
	 * <p>The phrases are looked for across those files together rather than one by one,
	 * because which of the three carries which sentence is V46's business and not this file's:
	 * it rewrote Article 56 after V24 first wrote it, and pinning a phrase to a version would
	 * be a claim about that history rather than about the pages.
	 */
	@Test
	void everyPhraseThisExpectsToBeGoneWasReallyThere() {
		String serbian = migrationSql("24") + migrationSql("46");
		String english = migrationSql("43") + migrationSql("46");

		for (String gone : THE_OLD_DAY_IN_SERBIAN) {
			assertThat(serbian)
					.as("\"%s\" is not in the migrations that wrote the Serbian pages, so holding"
							+ " that it is absent today measures nothing", gone)
					.contains(gone);
		}

		for (String gone : THE_OLD_DAY_IN_ENGLISH) {
			assertThat(english)
					.as("\"%s\" is not in the migrations that wrote the English pages", gone)
					.contains(gone);
		}
	}
}
