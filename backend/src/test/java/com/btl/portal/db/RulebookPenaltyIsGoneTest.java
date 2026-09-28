package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PENALTY THE OWNER ABOLISHED ON 24.09.2026 IS NOT IN ANY PAGE THIS SERVER SERVES.
 *
 * <p><b>What was abolished.</b> PDL.md, section "Kaznjeni izlazak iz tima usred godine je MRTAV"
 * (owner, UKINUTO 24.09.2026): leaving a team in the middle of the year used to cost the member a
 * three year ban from every team and the deletion of his whole contribution to that season, and the
 * portal was told to offer him both paths and ask him to confirm the expensive one. The owner's own
 * reason for striking it: "izlazak se od 24.09.2026 desava samo u prozoru 1.10-31.12, pa izlaska
 * usred godine nema, a time ni kazne. Ostaje jedan put, nekaznjen." V46 rewrites Article 56, in both
 * languages, so the served text stops claiming it.
 *
 * <p><b>Why a case and not just the rewrite.</b> The rewrite is one migration, and a later one could
 * put the paragraph back without a single existing case noticing: {@code PageApiTest} compares the
 * Serbian answer to {@code pages.json} field by field, so a change made in BOTH at once is green,
 * and no case at all reads the English body's prose. The mutation this file exists to fail is
 * exactly that: restore the abolished paragraph.
 *
 * <p><b>THE SWEEP IS OVER EVERY ROW, NOT OVER ARTICLE 56.</b> The rows come from
 * {@code static_page_section} and {@code static_page_section_translation} with no {@code where}
 * clause at all, so every section of every page in every language is read, in whatever language
 * somebody adds next. That is the floor under the marker list below, and it is the point: the
 * penalty was found in one article, and the thing worth holding is that it is in NO article. The
 * day somebody writes it into a second page, this falls there instead of here.
 *
 * <p><b>And the marker list has a floor of its own,</b> because a hand written list of phrases is
 * otherwise only as good as whoever wrote it:
 * {@link #everyMarkerReallyNamesSomethingThatWasThere} runs the same list against the migrations
 * that WROTE the abolished text, V24 for Serbian and V43 for English, read out of the files Flyway
 * resolved. A marker that matches nothing there is decorative and fails, so the list cannot quietly
 * drift into phrases that never existed.
 *
 * <p><b>Why these phrases and not the word "kazna".</b> The rewritten article says "ne nosi nikakvu
 * kaznu" - it names the penalty in order to deny it - so a marker on the root of that word would
 * fail on the correct text. Each marker below is instead a phrase that only the ABOLISHED claim
 * ever used, checked to appear exactly once in the text V46 replaces and not once in what it writes.
 *
 * <p><b>AND A SECOND CLAIM, WHICH IS NOT THE PENALTY.</b> V46 also corrects Article 9, the one other
 * place in the rulebook that speaks about this, where a single deadline was put on the team and the
 * pair together. That is a different mistake from the penalty and it gets its own marker list, its
 * own sweep and its own positive case, for the same reason the penalty does: left alone it would
 * have had the rulebook saying two different things about the pair, in two articles of one document,
 * on the day it launched. The sweeps below are over every row of both tables, so neither claim can
 * come back in an article nobody thought to look at.
 */
class RulebookPenaltyIsGoneTest extends DatabaseTest {

	/**
	 * The abolished claim in the Serbian the rulebook actually used, one phrase per half of it:
	 * the deletion of the contribution, the three year ban, and the instruction to the screen.
	 */
	private static final List<String> ABOLISHED_IN_SERBIAN = List.of(
			"iz timskog obračuna",
			"tri godine",
			"obe mogućnosti");

	/** The same three halves in the English V43 wrote for them. */
	private static final List<String> ABOLISHED_IN_ENGLISH = List.of(
			"from the team's tally",
			"three years",
			"both options");

	/**
	 * The OTHER thing V46 corrects, and it is a different claim from the penalty above.
	 *
	 * <p>Article 9 used to put a team and a racing pair under one deadline - "Sve promene tima i
	 * trkackog para moraju biti zavrsene do 31. decembra" - which is exactly what the owner's
	 * 24.09.2026 decision separates: a team moves only in the window, a pair may be broken by
	 * either side at any time. Left standing, the rulebook would have said two different things
	 * about the pair in two articles of the same document, on its launch day.
	 *
	 * <p>One phrase per language, and it is the SUBJECT of the sentence rather than the deadline
	 * itself: the 31 December deadline is still true of the team and still written in both
	 * articles, so a marker on the date would fail on the corrected text. What may not come back
	 * is the two of them sharing one subject.
	 */
	private static final List<String> ONE_DEADLINE_FOR_BOTH_IN_SERBIAN =
			List.of("Sve promene tima i trkačkog para");

	private static final List<String> ONE_DEADLINE_FOR_BOTH_IN_ENGLISH =
			List.of("All team and racing pair changes");

	private List<String> serbianBodies() {
		return db.sql("select body from static_page_section").query(String.class).list();
	}

	private List<String> englishBodies() {
		return db.sql("select body from static_page_section_translation").query(String.class).list();
	}

	@Test
	void noSerbianSectionOfAnyPageStillNamesTheAbolishedPenalty() {
		List<String> bodies = serbianBodies();

		assertThat(bodies).as("there is no page text at all, so this case measures nothing").isNotEmpty();

		for (String marker : ABOLISHED_IN_SERBIAN) {
			assertThat(bodies)
					.as("a section still carries \"%s\", which belongs to the penalty the owner"
							+ " abolished on 24.09.2026", marker)
					.noneMatch(body -> body.contains(marker));
		}
	}

	@Test
	void noEnglishSectionOfAnyPageStillNamesTheAbolishedPenalty() {
		List<String> bodies = englishBodies();

		assertThat(bodies).as("there is no translated text at all, so this case measures nothing").isNotEmpty();

		for (String marker : ABOLISHED_IN_ENGLISH) {
			assertThat(bodies)
					.as("a translated section still carries \"%s\", so the two languages disagree"
							+ " about a penalty that no longer exists", marker)
					.noneMatch(body -> body.contains(marker));
		}
	}

	@Test
	void noSectionOfAnyPageStillBindsTheTeamAndThePairToOneDeadline() {
		List<String> serbian = serbianBodies();
		List<String> english = englishBodies();

		assertThat(serbian).as("there is no page text at all, so this case measures nothing").isNotEmpty();
		assertThat(english).as("there is no translated text at all, so this case measures nothing").isNotEmpty();

		for (String marker : ONE_DEADLINE_FOR_BOTH_IN_SERBIAN) {
			assertThat(serbian)
					.as("a section still carries \"%s\", so one deadline is put on the team and the"
							+ " pair together, against the owner's decision of 24.09.2026", marker)
					.noneMatch(body -> body.contains(marker));
		}

		for (String marker : ONE_DEADLINE_FOR_BOTH_IN_ENGLISH) {
			assertThat(english)
					.as("a translated section still carries \"%s\", so the two languages disagree"
							+ " about whether a pair has a deadline", marker)
					.noneMatch(body -> body.contains(marker));
		}
	}

	/**
	 * The floor under every list above: each marker really did name a piece of the text V46 replaced.
	 *
	 * <p>Asked of the migrations that wrote it rather than of a second copy of the prose, and of
	 * those two specifically because they are the only ones that have ever written these sections -
	 * V24 for the Serbian bodies, V43 for the English ones.
	 */
	@Test
	void everyMarkerReallyNamesSomethingThatWasThere() {
		String serbianAsItWas = migrationSql("24");
		String englishAsItWas = migrationSql("43");

		for (String marker : concat(ABOLISHED_IN_SERBIAN, ONE_DEADLINE_FOR_BOTH_IN_SERBIAN)) {
			assertThat(serbianAsItWas)
					.as("\"%s\" is not in V24, so it names nothing and the sweep above is weaker"
							+ " than it looks", marker)
					.contains(marker);
		}

		for (String marker : concat(ABOLISHED_IN_ENGLISH, ONE_DEADLINE_FOR_BOTH_IN_ENGLISH)) {
			assertThat(englishAsItWas)
					.as("\"%s\" is not in V43, so it names nothing and the sweep above is weaker"
							+ " than it looks", marker)
					.contains(marker);
		}
	}

	private static List<String> concat(List<String> one, List<String> other) {
		return Stream.concat(one.stream(), other.stream()).toList();
	}

	/**
	 * And what stands in its place, so that DELETING Article 56 does not pass the cases above.
	 *
	 * <p>Three claims, one per decision the rewrite carries: the window (owner, 24.09.2026, "Iz tima
	 * se izlazi u istom prozoru u kom se i ulazi (1.10-31.12)"), that leaving costs nothing (owner,
	 * UKINUTO 24.09.2026, "Ostaje jedan put, nekaznjen"), and that the pair is no longer bound to the
	 * team's rule (owner, 24.09.2026, "Par sme da raskine svaka strana, bilo kad").
	 */
	/**
	 * And the same for Article 9, so that DELETING it does not pass the sweep above either.
	 *
	 * <p>Both halves are asserted because the correction has two: the deadline is still stated, and
	 * it is now the TEAM's; and the pair is said to have none. A change that dropped either half
	 * would leave the sweep green while the rulebook went quiet about one of them.
	 */
	@Test
	void articleNineGivesTheDeadlineToTheTeamAndFreesThePairOfIt() {
		String body = db
				.sql("select s.body from static_page_section s join static_page p on p.id = s.page_id"
						+ " where p.slug = 'pravilnik' and s.position = 2")
				.query(String.class)
				.single();

		assertThat(body)
				.as("Article 9 no longer states the 31 December deadline as the team's")
				.contains("Promene tima moraju biti završene do 31. decembra");
		assertThat(body)
				.as("Article 9 no longer says the pair is bound by no deadline")
				.contains("Trkački par nije vezan nijednim rokom");
	}

	@Test
	void articleFiftySixCarriesTheRuleThatReplacedIt() {
		String body = db
				.sql("select s.body from static_page_section s join static_page p on p.id = s.page_id"
						+ " where p.slug = 'pravilnik' and s.position = 12")
				.query(String.class)
				.single();

		assertThat(body)
				.as("Article 56 no longer says leaving happens in the same window joining does")
				.contains("Iz tima se izlazi u istom prozoru u kom se i ulazi, od 1. oktobra do 31. decembra.");
		assertThat(body)
				.as("Article 56 no longer says that leaving costs nothing")
				.contains("Izlazak je jedan i ne nosi nikakvu kaznu");
		assertThat(body)
				.as("Article 56 no longer separates the pair from the team's window")
				.contains("Trkački par raskida svaka strana, bilo kada");
	}
}
