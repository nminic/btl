package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ONE MEMBER'S DUCATS BROUGHT INTO LINE WITH HIS RESULTS, against the real schema.
 *
 * <p>Every case reconciles inside the transaction of the case ({@link AwardingDucats#reconcile}), so what
 * it writes goes with the rollback; that the work runs in a transaction of its own, takes turns per
 * member and meets a row written past the turn is {@code AwardingDucatsInItsOwnTransactionTest}.
 *
 * <p><b>Two members run the same races on the same days, and the other one's results are always written
 * FIRST</b>, so they have the smaller keys and would be the first on any list that forgot whose results
 * it was reading. A pointer that ever named his result is a pointer that crossed to somebody else.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class AwardingDucatsTest {

	private static final String ANA = "000951";

	private static final String OTHER = "000952";

	private static final String NO_MEMBER = "000953";

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate transactions;

	@Test
	void aMonthlyDucatIsWrittenAtTheThresholdWithTheRaceThatCarriedHimOverAndNotAnotherMembersRace() {
		member(OTHER);
		member(ANA);
		memberOf(ANA, 2028);
		memberOf(OTHER, 2028);
		race("Prva", "2028-02-03", "RS");
		race("Druga", "2028-02-10", "RS");
		race("Treca", "2028-02-20", "RS");

		for (String who : List.of(OTHER, ANA)) {
			run(who, "Prva", "60");
			run(who, "Druga", "65");
			run(who, "Treca", "30");
		}

		List<AwardingDucats.Won> written = at(2028, 3, 15).reconcile(id(ANA));

		assertThat(written).singleElement().satisfies(one -> {
			assertThat(one.code()).isEqualTo("duk-mesecni-km");
			assertThat(one.threshold()).isEqualByComparingTo("125");
			assertThat(one.season()).isEqualTo(2028);
			assertThat(one.month()).isEqualTo(2);
			assertThat(one.tier()).isEqualTo(1);
		});

		Map<String, Object> row = db.sql("select competitor_id, result_id, won_on, reached, tier, kind, period,"
						+ " awarded_at from ducat_award where id = ?")
				.param(written.get(0).id()).query().singleRow();

		assertThat(row.get("competitor_id")).isEqualTo(id(ANA));
		assertThat(row.get("result_id")).as("the pointer names her result of 10 February, not his")
				.isEqualTo(resultOf(ANA, "Druga"));
		assertThat(row.get("won_on")).hasToString("2028-02-10");
		assertThat((BigDecimal) row.get("reached")).isEqualByComparingTo("125.00");
		assertThat(((Number) row.get("tier")).intValue()).isEqualTo(1);
		assertThat(row.get("kind")).isEqualTo("totalKm");
		assertThat(row.get("period")).isEqualTo("month");
		assertThat(((Timestamp) row.get("awarded_at")).toInstant())
				.as("the moment is Java's clock and never the database's")
				.isEqualTo(momentOf(2028, 3, 15));
	}

	@Test
	void aHundredthOfAKilometreShortIsNotTheThreshold() {
		member(ANA);
		memberOf(ANA, 2028);
		race("Prva", "2028-02-03", "RS");
		race("Druga", "2028-02-10", "RS");
		run(ANA, "Prva", "60");
		run(ANA, "Druga", "64.99");

		assertThat(at(2028, 3, 15).reconcile(id(ANA))).isEmpty();
		assertThat(awardsOf(ANA)).isZero();
	}

	@Test
	void aSecondReconciliationWithNothingChangedWritesAndAnswersNothing() {
		anaWithFebruaryOf("60", "65", "70");

		assertThat(at(2028, 3, 15).reconcile(id(ANA))).hasSize(1);
		assertThat(at(2028, 3, 15).reconcile(id(ANA))).as("only what was written is answered").isEmpty();
		assertThat(awardsOf(ANA)).isEqualTo(1);
	}

	@Test
	void theYearHeWasNoMemberGivesOnlyTheDucatsOfAllTimeAndTheYearHeWasGivesBoth() {
		marathonsCountFrom(2);
		member(NO_MEMBER);
		member(ANA);
		memberOf(ANA, 2028);
		race("Prvi", "2028-02-03", "RS", "42.2");
		race("Drugi", "2028-02-10", "RS", "42.2");
		race("Treci", "2028-02-20", "RS", "42.2");

		for (String who : List.of(NO_MEMBER, ANA)) {
			for (String name : List.of("Prvi", "Drugi", "Treci")) {
				run(who, name, "42.2");
			}
		}

		assertThat(at(2028, 3, 15).reconcile(id(NO_MEMBER))).extracting(AwardingDucats.Won::code)
				.containsExactly("duk-maratoni");
		assertThat(at(2028, 3, 15).reconcile(id(ANA))).extracting(AwardingDucats.Won::code)
				.containsExactlyInAnyOrder("duk-mesecni-km", "duk-maratoni");
	}

	@Test
	void aMemberWithoutTheRightToRankGetsTheMonthlyDucatAsWell() {
		member(ANA);
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, 2028, 'feeExempt', 'Probni Probic', ?)")
				.params(id(ANA), Timestamp.from(LocalDateTime.of(2028, 4, 2, 10, 0).atZone(SeasonClock.ZONE)
						.toInstant()))
				.update();
		race("Prva", "2028-04-03", "RS");
		race("Druga", "2028-04-10", "RS");
		run(ANA, "Prva", "60");
		run(ANA, "Druga", "65");

		assertThat(db.sql("select " + WhenASeasonWasActivated.of("m") + " from membership m where m.competitor_id = ?")
				.param(id(ANA)).query((row, one) -> WhenASeasonWasActivated.ranks(2028, row.getTimestamp(1)))
				.single())
				.as("the postavka is a membership the portal's own rule says does not rank")
				.isFalse();
		assertThat(at(2028, 5, 15).reconcile(id(ANA))).extracting(AwardingDucats.Won::code)
				.containsExactly("duk-mesecni-km");
	}

	@Test
	void theRacesBeforeTheLeagueCountForAllTimeAndTheDayIsTheRaceThatCarriedHimOver() {
		marathonsCountFrom(2);
		member(ANA);
		race("Stari", "2025-05-01", "RS", "42.2");
		race("Stariji", "2025-09-01", "RS", "42.2");
		race("Novi", "2028-02-03", "RS", "42.2");
		run(ANA, "Novi", "42.2");
		run(ANA, "Stariji", "42.2");
		run(ANA, "Stari", "42.2");

		assertThat(at(2028, 3, 15).reconcile(id(ANA))).extracting(AwardingDucats.Won::code)
				.containsExactly("duk-maratoni");
		assertThat(db.sql("select won_on from ducat_award where competitor_id = ?").param(id(ANA))
				.query(LocalDate.class).single())
				.as("the second marathon he ever ran, in 2025")
				.isEqualTo(LocalDate.of(2025, 9, 1));
	}

	@Test
	void theResultThatCarriedHimOverGoesAndTheLaterOnesHoldItSoTheRowStaysAndIsToldWhichRaceDoes() {
		anaWithFebruaryOf("60", "65", "70");
		AwardingDucats ducats = at(2028, 3, 15);
		long award = ducats.reconcile(id(ANA)).get(0).id();

		db.sql("delete from result where id = ?").param(resultOf(ANA, "Druga")).update();

		assertThat(ducats.reconcile(id(ANA))).as("nothing new was written").isEmpty();

		Map<String, Object> row = db.sql("select id, result_id, won_on, reached from ducat_award where competitor_id = ?")
				.param(id(ANA)).query().singleRow();

		assertThat(row.get("id")).as("the same row, not one taken away and written again").isEqualTo(award);
		assertThat(row.get("result_id")).isEqualTo(resultOf(ANA, "Treca"));
		assertThat(row.get("won_on")).hasToString("2028-02-20");
		assertThat((BigDecimal) row.get("reached")).isEqualByComparingTo("130.00");
	}

	@Test
	void anotherResultGoesAndTheRowStaysAsItWas() {
		anaWithFebruaryOf("60", "65", "70");
		AwardingDucats ducats = at(2028, 3, 15);
		ducats.reconcile(id(ANA));
		long carried = resultOf(ANA, "Druga");

		db.sql("delete from result where id = ?").param(resultOf(ANA, "Treca")).update();
		ducats.reconcile(id(ANA));

		assertThat(db.sql("select result_id from ducat_award where competitor_id = ?").param(id(ANA))
				.query(Long.class).single()).isEqualTo(carried);
	}

	@Test
	void aDeletionThatLeavesTheConditionUnmetInASeasonStillOpenTakesTheDucatAway() {
		anaWithFebruaryOf("60", "65", "70");
		AwardingDucats ducats = at(2028, 3, 15);
		ducats.reconcile(id(ANA));

		db.sql("delete from result where id in (?, ?)").params(resultOf(ANA, "Prva"), resultOf(ANA, "Druga"))
				.update();

		assertThat(ducats.reconcile(id(ANA))).isEmpty();
		assertThat(awardsOf(ANA)).as("70 km is not 125").isZero();
	}

	@Test
	void aCorrectionBelowTheConditionTakesTheDucatAwayAlthoughItsResultIsStillThere() {
		anaWithFebruaryOf("60", "65");
		AwardingDucats ducats = at(2028, 3, 15);
		ducats.reconcile(id(ANA));

		db.sql("update result set distance_km = 64 where id = ?").param(resultOf(ANA, "Druga")).update();
		ducats.reconcile(id(ANA));

		assertThat(awardsOf(ANA)).isZero();
	}

	@Test
	void aCancelledMembershipOfASeasonStillOpenTakesItsMonthlyDucatAway() {
		anaWithFebruaryOf("60", "65");
		AwardingDucats ducats = at(2028, 3, 15);
		ducats.reconcile(id(ANA));

		db.sql("delete from membership where competitor_id = ? and season = 2028").param(id(ANA)).update();
		ducats.reconcile(id(ANA));

		assertThat(awardsOf(ANA)).isZero();
	}

	@Test
	void aResultOfAFrozenSeasonEnteredAfterTheFreezeGivesOnlyTheDucatsOfAllTime() {
		marathonsCountFrom(2);
		member(ANA);
		memberOf(ANA, 2027);
		frozen(2027);
		race("Prvi", "2027-07-03", "RS", "42.2");
		race("Drugi", "2027-07-10", "RS", "42.2");
		race("Treci", "2027-07-20", "RS", "42.2");

		for (String name : List.of("Prvi", "Drugi", "Treci")) {
			run(ANA, name, "42.2");
		}

		assertThat(at(2028, 3, 15).reconcile(id(ANA))).extracting(AwardingDucats.Won::code)
				.as("not July's kilometres of a frozen 2027")
				.containsExactly("duk-maratoni");
	}

	@Test
	void aSeasonIsFrozenByItsRowAndNotByTheClock() {
		member(ANA);
		memberOf(ANA, 2027);
		race("Prva", "2027-07-03", "RS");
		race("Druga", "2027-07-10", "RS");
		run(ANA, "Prva", "60");
		run(ANA, "Druga", "65");

		assertThat(at(2028, 3, 15).reconcile(id(ANA))).as("the clock is past the freeze and no row says so")
				.extracting(AwardingDucats.Won::code).containsExactly("duk-mesecni-km");

		db.sql("delete from ducat_award where competitor_id = ?").param(id(ANA)).update();
		frozen(2027);

		assertThat(at(2027, 8, 15).reconcile(id(ANA))).as("the clock is before the freeze and the row says it froze")
				.isEmpty();
	}

	@Test
	void aMonthlyDucatOfAFrozenSeasonIsNotTouchedWhileOneOfAllTimeFromTheSameRacesIs() {
		marathonsCountFrom(2);
		member(ANA);
		memberOf(ANA, 2027);
		List<String> names = List.of("Prvi", "Drugi", "Treci", "Cetvrti");
		List<String> days = List.of("2027-07-03", "2027-07-10", "2027-07-20", "2027-07-25");

		for (int which = 0; which < names.size(); which++) {
			race(names.get(which), days.get(which), "RS", "42.2");
			run(ANA, names.get(which), "42.2");
		}

		AwardingDucats ducats = at(2028, 3, 15);

		assertThat(ducats.reconcile(id(ANA))).extracting(AwardingDucats.Won::code)
				.as("written while 2027 had no row in season_frozen")
				.containsExactlyInAnyOrder("duk-mesecni-km", "duk-maratoni");
		frozen(2027);

		db.sql("delete from result where id = ?").param(resultOf(ANA, "Treci")).update();
		ducats.reconcile(id(ANA));

		assertThat(db.sql("select result_id from ducat_award where competitor_id = ? and period = 'month'")
				.param(id(ANA)).query(Long.class).optional())
				.as("the race that carried July is gone and the fourth would carry it now, and a frozen row is"
						+ " not told so")
				.isEmpty();
		assertThat(db.sql("select won_on from ducat_award where competitor_id = ? and period = 'month'")
				.param(id(ANA)).query(LocalDate.class).single()).isEqualTo(LocalDate.of(2027, 7, 20));

		db.sql("delete from result where id = ?").param(resultOf(ANA, "Drugi")).update();
		ducats.reconcile(id(ANA));

		assertThat(db.sql("select result_id from ducat_award where competitor_id = ? and period = 'always'")
				.param(id(ANA)).query(Long.class).single())
				.as("a ducat of all time is told its race even when that race is in a frozen season")
				.isEqualTo(resultOf(ANA, "Cetvrti"));

		db.sql("delete from result where id = ?").param(resultOf(ANA, "Prvi")).update();
		ducats.reconcile(id(ANA));

		assertThat(db.sql("select period from ducat_award where competitor_id = ?").param(id(ANA))
				.query(String.class).list())
				.as("42.2 km in a frozen July keeps the ducat of the month; one marathon takes away the one of all"
						+ " time")
				.containsExactly("month");
	}

	@Test
	void aDucatIsMeasuredByTheThresholdItWasWonAtAndNotByTheDefinitionAsItIsToday() {
		marathonsCountFrom(2);
		member(ANA);
		race("Prvi", "2028-02-03", "RS", "42.2");
		race("Drugi", "2028-02-10", "RS", "42.2");
		run(ANA, "Prvi", "42.2");
		run(ANA, "Drugi", "42.2");
		AwardingDucats ducats = at(2028, 3, 15);
		ducats.reconcile(id(ANA));

		marathonsCountFrom(3);

		assertThat(ducats.reconcile(id(ANA))).as("three marathons are not met").isEmpty();
		assertThat(db.sql("select threshold from ducat_award where competitor_id = ?").param(id(ANA))
				.query(BigDecimal.class).single())
				.as("the ducat won at two stays while two stand, whatever the definition says now")
				.isEqualByComparingTo("2");

		marathonsCountFrom(1);
		db.sql("delete from result where id = ?").param(resultOf(ANA, "Drugi")).update();

		assertThat(ducats.reconcile(id(ANA))).extracting(AwardingDucats.Won::threshold)
				.as("one marathon meets the definition of today")
				.singleElement().satisfies(one -> assertThat(one).isEqualByComparingTo("1"));
		assertThat(db.sql("select threshold from ducat_award where competitor_id = ?").param(id(ANA))
				.query(BigDecimal.class).list())
				.as("and not the two the old one was won at, which is taken away")
				.singleElement().satisfies(one -> assertThat(one).isEqualByComparingTo("1"));
	}

	@Test
	void countriesAreCountedThroughTheTownOfTheCodebookAndTheTownTypedAndARunRisesATierPartWay() {
		db.sql("update ducat set threshold = 2, step = 1, last = 3, tier_up_from = 3 where code = 'duk-drzave'")
				.update();
		member(ANA);
		raceInACodebookTown("Prva", "2028-02-03", "RS");
		race("Druga", "2028-02-10", "HR");
		run(ANA, "Prva", "10");
		run(ANA, "Druga", "10");

		assertThat(at(2028, 3, 15).reconcile(id(ANA)))
				.as("Serbia through the codebook's town and Croatia typed by hand are two countries")
				.singleElement().satisfies(one -> {
					assertThat(one.code()).isEqualTo("duk-drzave");
					assertThat(one.threshold()).isEqualByComparingTo("2");
					assertThat(one.tier()).isEqualTo(3);
				});

		raceInACodebookTown("Cetvrta", "2028-02-25", "ME");
		run(ANA, "Cetvrta", "10");

		assertThat(at(2028, 3, 15).reconcile(id(ANA))).as("the third country, through the codebook's town")
				.singleElement().satisfies(one -> {
					assertThat(one.threshold()).isEqualByComparingTo("3");
					assertThat(one.tier()).as("the run is one tier higher from three").isEqualTo(4);
				});
		assertThat(db.sql("select threshold::int || ':' || tier from ducat_award where competitor_id = ? order by threshold")
				.param(id(ANA)).query(String.class).list())
				.as("the value the row keeps is the value of its own threshold, as the column says it")
				.containsExactly("2:3", "3:4");
	}

	@Test
	void aMemberWhoIsNotThereHasNothingReconciled() {
		assertThat(at(2028, 3, 15).reconcile(-1)).isEmpty();
	}

	private AwardingDucats at(int year, int month, int day) {
		return new AwardingDucats(db, Clock.fixed(momentOf(year, month, day), ZoneOffset.UTC), transactions);
	}

	private static Instant momentOf(int year, int month, int day) {
		return LocalDateTime.of(year, month, day, 12, 0).atZone(SeasonClock.ZONE).toInstant();
	}

	private void anaWithFebruaryOf(String... kilometres) {
		member(ANA);
		memberOf(ANA, 2028);
		String[] names = {"Prva", "Druga", "Treca"};
		String[] days = {"2028-02-03", "2028-02-10", "2028-02-20"};

		for (int which = 0; which < kilometres.length; which++) {
			race(names[which], days[which], "RS");
			run(ANA, names[which], kilometres[which]);
		}
	}

	private void marathonsCountFrom(int howMany) {
		db.sql("update ducat set threshold = ? where code = 'duk-maratoni'").param(howMany).update();
	}

	private void frozen(int season) {
		db.sql("insert into season_frozen (season, frozen_at) values (?, ?)")
				.params(season, Timestamp.from(LocalDateTime.of(season + 1, 1, 1, 16, 0).atZone(SeasonClock.ZONE)
						.toInstant()))
				.update();
	}

	private long id(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number).query(Long.class).single();
	}

	private long resultOf(String number, String raceName) {
		return db.sql("select r.id from result r join race on race.id = r.race_id"
						+ " where r.competitor_id = ? and race.name = ?")
				.params(id(number), raceName).query(Long.class).single();
	}

	private long awardsOf(String number) {
		return db.sql("select count(*) from ducat_award where competitor_id = ?").param(id(number))
				.query(Long.class).single();
	}

	private void member(String number) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Ime', 'Prezime', 'F', date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, "001122334" + number + "a").update();
	}

	private void memberOf(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}

	private void race(String name, String day, String country) {
		race(name, day, country, "10");
	}

	/** An event in a town typed by hand, with its country beside it. */
	private void race(String name, String day, String country, String kilometres) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', null, 'Grad',"
						+ " (select id from country where code = ?), 'race', false, '', '')")
				.params("dukat-" + name.toLowerCase(), name, country).update();
		raceOf(name, day, kilometres);
	}

	/** An event in a town of the codebook, which carries the country itself. */
	private void raceInACodebookTown(String name, String day, String country) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "',"
						+ " (select p.id from place p join country c on c.id = p.country_id where c.code = ?"
						+ " order by p.rank, p.id limit 1), null, null, 'race', false, '', '')")
				.params("dukat-" + name.toLowerCase(), name, country).update();
		raceOf(name, day, "10");
	}

	private void raceOf(String name, String day, String kilometres) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " date '" + day + "', 'length', 0, " + kilometres + ", 0, 0)")
				.params("dukat-" + name.toLowerCase(), name).update();
	}

	private void run(String member, String raceName, String kilometres) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " select (select id from competitor where member_number = ?), race.id, race.date, "
						+ kilometres + ", 0, 0, 3000, 1 from race where race.name = ?")
				.params(member, raceName).update();
	}
}
