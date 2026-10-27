package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PAGES A MEMBER READS NAME THE SAME DAY THE PRICE TABLE OPENS ON, IN BOTH LANGUAGES, AND NAME NO OTHER.
 *
 * <p><b>Why this exists, and it is the other half of V76 (it was the other half of V49).</b> V76 moves ten
 * sentences with {@code replace()} calls rather than retyping section bodies. A replace is exact and cannot
 * mistype a paragraph it does not touch - and it has one failure mode, which is to match NOTHING and report
 * success. Every case here is aimed at that failure mode, and at the other direction with it: a further home of
 * an old day appearing in a page tomorrow.
 *
 * <p><b>THE SWEEP IS OVER EVERY ROW, with no {@code where} clause at all</b>, so every section of every page in
 * every language is read, in whatever language somebody adds next. The shape is
 * {@link RulebookPenaltyIsGoneTest}'s and so is the reason: what is worth holding is not that one article is
 * right but that NO article is wrong.
 *
 * <p><b>THE DAY IS NOT WRITTEN IN THIS FILE. IT IS READ OUT OF THE PRICE TABLE.</b> The number the pages are held
 * to is the {@code day_from} of the row that opens the cycle ({@code early}), so the day the prose names and the
 * day the portal charges by cannot part company. Move the table alone and this fails; move the prose alone and
 * this fails (ADL, 29.09.2026, „Pod koji ponavlja USLOV iz fajla koji meri nije pod"). Until 27.10.2026 the day
 * was derived from the ranked periods; it cannot be any more, because 1 January to 31 March is now a ranked
 * period of the running season (see {@link TheSellingYearAndTheTransferWindowOpenOnOneDayTest}).
 *
 * <p><b>NO PAGE NAMES 15 OR 14 OCTOBER, AND NO PAGE NAMES AN EXCEPTION FOR 2026</b> (owner, 27.10.2026): „Po
 * preporuci treba da funkcionise, ali nigde se ne pominje na sajtu ni jedan datum oko ovoga pre 11.11." The first
 * year opens on 15 October in the clock and nowhere in the text.
 *
 * <p><b>And the phrases that must be GONE have a floor of their own</b>, which the day cannot give them:
 * {@link #everyPhraseThisExpectsToBeGoneWasReallyThere} runs them against the migrations that WROTE that text,
 * read out of the files Flyway resolved. Those files are immutable (ADL A2), so a phrase that matches nothing
 * there is decorative and fails.
 */
class TheWrittenPagesOpenOnTheElevenOfNovemberTest extends DatabaseTest {

	/**
	 * What the pages said before 27.10.2026, one phrase per sentence V76 replaces, and the days before it.
	 */
	private static final List<String> GONE_IN_SERBIAN = List.of(
			"od 1. oktobra",
			"do 30. septembra tekuća",
			"15. oktobra",
			"14. oktobra",
			"Cenovnik se ponavlja svake godine",
			"zaključno sa 31. decembrom 2026",
			"Ko se učlani tokom sezone",
			"Iz tima se izlazi u istom prozoru",
			"Van tog prozora izlazak nije moguć",
			"Sve promene moraju biti završene do 31. decembra");

	private static final List<String> GONE_IN_ENGLISH = List.of(
			"from 1 October",
			"to 30 September the current one is",
			"15 October",
			"14 October",
			"The price list repeats every year",
			"by a payment made by 31 December 2026",
			"Anyone who joins during the season",
			"A member leaves a team in the same window",
			"Outside that window leaving is not possible",
			"All changes must be completed by 31 December");

	private static final String[] MONTHS_IN_SERBIAN = {"januara", "februara", "marta", "aprila", "maja", "juna",
			"jula", "avgusta", "septembra", "oktobra", "novembra", "decembra"};

	private static final String[] MONTHS_IN_ENGLISH = {"January", "February", "March", "April", "May", "June",
			"July", "August", "September", "October", "November", "December"};

	private List<String> serbianBodies() {
		return db.sql("select body from static_page_section").query(String.class).list();
	}

	private List<String> englishBodies() {
		return db.sql("select body from static_page_section_translation").query(String.class).list();
	}

	private String dayOf(String key, String column) {
		String monthDay = db.sql("select " + column + " from price_row where kind = 'period' and key = ?")
				.param(key)
				.query(String.class)
				.optional()
				.orElse(null);

		assertThat(monthDay)
				.as("the price list has no period \"%s\", so the day below is read off nothing", key)
				.isNotNull();

		return monthDay;
	}

	private static int day(String monthDay) {
		return Integer.parseInt(monthDay.substring(3));
	}

	private static int month(String monthDay) {
		return Integer.parseInt(monthDay.substring(0, 2));
	}

	@Test
	void noSerbianSectionOfAnyPageStillSaysWhatItSaidBefore() {
		List<String> bodies = serbianBodies();

		assertThat(bodies).as("there is no page text at all, so this case measures nothing").isNotEmpty();

		for (String gone : GONE_IN_SERBIAN) {
			assertThat(bodies)
					.as("a section still carries \"%s\", so the portal tells a member something the owner"
							+ " has replaced", gone)
					.noneMatch(body -> body.contains(gone));
		}
	}

	@Test
	void noEnglishSectionOfAnyPageStillSaysItEither() {
		List<String> bodies = englishBodies();

		assertThat(bodies).as("there is no English page text at all, so this case measures nothing")
				.isNotEmpty();

		for (String gone : GONE_IN_ENGLISH) {
			assertThat(bodies)
					.as("an English section still carries \"%s\"", gone)
					.noneMatch(body -> body.contains(gone));
		}
	}

	/**
	 * AND THE DAY THEY DO NAME IS THE ONE THE TABLE HOLDS: the transfer window of the teams opens on the day the
	 * cycle opens. A migration that emptied the paragraph altogether would pass both cases above and fails here.
	 */
	@Test
	void theDayTheTeamsParagraphNamesIsTheDayThePriceTableOpensOn() {
		String opens = dayOf("early", "day_from");
		String sentence = "Prelazni rok za timove je od %d. %s do 31. decembra."
				.formatted(day(opens), MONTHS_IN_SERBIAN[month(opens) - 1]);

		assertThat(serbianBodies())
				.as("no section says \"%s\", which is the day price_row actually starts the cycle", sentence)
				.anyMatch(body -> body.contains(sentence));
		assertThat(serbianBodies())
				.as("the owner's second sentence about joining and leaving is gone")
				.anyMatch(body -> body.contains(
						"Ulazak ili izlazak iz tima su dozvoljeni samo tokom prelaznog roka."));
	}

	@Test
	void andTheEnglishPagesNameTheSameDay() {
		String opens = dayOf("early", "day_from");
		String sentence = "The transfer window for teams runs from %d %s to 31 December."
				.formatted(day(opens), MONTHS_IN_ENGLISH[month(opens) - 1]);

		assertThat(englishBodies())
				.as("no English section says \"%s\"", sentence)
				.anyMatch(body -> body.contains(sentence));
		assertThat(englishBodies())
				.as("the English of the owner's second sentence is gone")
				.anyMatch(body -> body.contains(
						"Joining or leaving a team is allowed only during the transfer window."));
	}

	/**
	 * THE RANKING DEADLINE AND THE FIRST DAY OF THE LATE MEMBER ARE THE DAYS THE TABLE HOLDS, which is what keeps
	 * Article 10 from becoming a second home for them: 31 March is the last day of the ranked months of the
	 * running season and 1 April is the first day of the period without the right to be ranked.
	 */
	@Test
	void theRankingDeadlineAndTheLateMembersFirstDayAreTheTablesDays() {
		assertThat(dayOf("late", "day_to")).as("the deadline in Article 10 is the last day of `late`")
				.isEqualTo("03-31");
		assertThat(dayOf("season", "day_from")).as("a late member begins the day `season` begins")
				.isEqualTo("04-01");

		assertThat(serbianBodies())
				.anyMatch(body -> body.contains("zaključno sa 31. martom 2027. godine"))
				.anyMatch(body -> body.contains("Ko se učlani od 1. aprila 2027, dobija profil"));
		assertThat(englishBodies())
				.anyMatch(body -> body.contains("by a payment made by 31 March 2027 at the latest"))
				.anyMatch(body -> body.contains("Anyone who joins from 1 April 2027 onward receives a profile"));
	}

	/**
	 * THE PRICE LIST SENTENCE SAYS ONLY THAT THE LIST REPEATS, which is the owner's wording, and repeats no day:
	 * the days are drawn from the table beside it.
	 */
	@Test
	void theSentenceAboutThePriceListRepeatingIsTheOwners() {
		assertThat(serbianBodies())
				.anyMatch(body -> body.contains("Cenovnik se sa istim rokovima ponavlja svake sezone."));
		assertThat(englishBodies())
				.anyMatch(body -> body.contains("The price list repeats every season with the same deadlines."));
	}

	/**
	 * THE PHRASES ABOVE REALLY WERE IN THE PAGES, asked of the migrations that wrote them.
	 *
	 * <p>Without this, the two cases about what is GONE are satisfied by any phrase nobody ever used, and
	 * narrowing them would look like tightening. All of these files are applied and immutable, so V76 cannot make
	 * this pass by editing them. The phrases are looked for across the files together rather than one by one,
	 * because which of them carries which sentence is the history's business and not this file's.
	 */
	@Test
	void everyPhraseThisExpectsToBeGoneWasReallyThere() {
		String serbian = migrationSql("24") + migrationSql("46") + migrationSql("49") + migrationSql("57")
				+ migrationSql("71");
		String english = migrationSql("43") + migrationSql("46") + migrationSql("49") + migrationSql("57")
				+ migrationSql("71");

		for (String gone : GONE_IN_SERBIAN) {
			assertThat(serbian)
					.as("\"%s\" is not in the migrations that wrote the Serbian pages, so holding"
							+ " that it is absent today measures nothing", gone)
					.contains(gone);
		}

		for (String gone : GONE_IN_ENGLISH) {
			assertThat(english)
					.as("\"%s\" is not in the migrations that wrote the English pages", gone)
					.contains(gone);
		}
	}
}
