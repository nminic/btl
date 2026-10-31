package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.config.CronTask;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.scheduling.support.SimpleTriggerContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE THRESHOLD OF TWELVE COUNTS A SEASON AT ITS FREEZE, AND NOTHING WRITTEN INTO IT AFTERWARDS.
 *
 * <p>PDL, owner, 30.10.2026, „Prag od 12 bodova koji zatvara početničku broji bodove sezone u trenutku
 * njenog zamrzavanja", on his own example: Ana has 10 points in 2027 and a moderator enters a forgotten
 * race of 3 points on 15.2.2028 - „Ana ni 2029 u ovom slucaju nece biti u starosnoj ako 2028 ne bude imala
 * 12 ili vise bodova."
 *
 * <p><b>Two members stand in every case and the two move in opposite directions</b>: Ana at 10 at the
 * freeze, whose category must stay open, and Bojan at 13, whose category must stay closed. So „nothing
 * moved" can never be why a case passes, and a reader that answers live and one that answers the freeze
 * give different answers for each of them.
 *
 * <p><b>The reader is asked through both of its doors</b>, {@link BestOfficialSeason#pointsFor} for one
 * member and the {@link CategoryOfASeason} book every list reads, because the snapshot is written by one
 * class and read by another, and the join between them is the table and the season the two name.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class ASeasonFreezesTest {

	private static final ZoneId BELGRADE = SeasonClock.ZONE;

	@Autowired
	private JdbcClient db;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private CategoryOfASeason categories;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private ObjectProvider<ScheduledTaskHolder> schedulers;

	@BeforeEach
	void anaAtTenAndBojanAtThirteenIn2027() {
		member("000201", "00112233440201aa");
		member("000202", "00112233440202aa");
		memberOf("000201", 2027);
		memberOf("000202", 2027);

		for (String name : new String[] {"Prva", "Druga"}) {
			race(name, "2027-05-01");
		}

		race("Cetvrta", "2028-05-01");

		run("000201", "Prva", "2027-05-01", 10.00);
		run("000202", "Prva", "2027-05-01", 13.00);
	}

	/**
	 * THE OWNER'S OWN EXAMPLE: a race of 2027 entered after the freeze closes nothing, and neither does
	 * anything else for Bojan open.
	 */
	@Test
	void aRaceEnteredAfterTheFreezeClosesNothingAndTheThresholdReachedBeforeItStays() {
		freezeAt(2028, 1, 1, 16, 0);

		run("000201", "Druga", "2027-05-01", 3.00);

		assertThat(best.pointsFor(ana(), 2029))
				.as("the run entered on 15.2.2028 counted in 2027, which froze without it")
				.isEqualByComparingTo("10.00");
		assertThat(best.pointsFor(bojan(), 2029)).isEqualByComparingTo("13.00");

		CategoryOfASeason.Book book = categories.everybody();

		assertThat(book.allowed(ana(), 2028)).as("2028, the season after the frozen one, closed on her").isTrue();
		assertThat(book.allowed(ana(), 2029)).as("„Ana ni 2029 ... nece biti u starosnoj“").isTrue();
		assertThat(book.allowed(bojan(), 2029)).as("Bojan had twelve at the freeze and is past it for good").isFalse();
	}

	/**
	 * THE SAME RUN BEFORE THE SNAPSHOT EXISTS IS COUNTED, which is the decision of 26.09.2026 for every
	 * season not frozen yet and the reason the snapshot, and nothing else, is what holds it afterwards.
	 */
	@Test
	void aSeasonNotFrozenYetIsCountedLiveAndClosesTheNextOneAtOnce() {
		run("000201", "Druga", "2027-05-01", 3.00);

		freezeAt(2028, 1, 1, 15, 59);

		assertThat(frozenSeasons()).as("a season froze a minute early").isEmpty();
		assertThat(best.pointsFor(ana(), 2028)).isEqualByComparingTo("13.00");
		assertThat(categories.everybody().allowed(ana(), 2028)).isFalse();
	}

	/**
	 * 15:59 AND 16:00 BY THE LEAGUE'S CLOCK, the one boundary the decision names: a run approved in the
	 * last minute before the freeze is in the snapshot, the season freezes at 16:00 exactly, and the season
	 * after it does not freeze with it.
	 */
	@Test
	void theSeasonFreezesAtSixteenAndNotAMinuteBeforeAndNotTheNextOne() {
		freezeAt(2028, 1, 1, 15, 59);
		run("000201", "Druga", "2027-05-01", 2.00);
		freezeAt(2028, 1, 1, 16, 0);

		assertThat(frozenSeasons()).containsExactly(2027);
		assertThat(best.pointsFor(ana(), 2029))
				.as("the run written at 15:59 is missing from the snapshot taken at 16:00")
				.isEqualByComparingTo("12.00");
		assertThat(db.sql("select frozen_at from season_frozen where season = 2027").query(Timestamp.class).single().toInstant())
				.isEqualTo(LocalDateTime.of(2028, 1, 1, 16, 0).atZone(BELGRADE).toInstant());

		/* And a job that runs late writes the moment it ran, which is the moment the snapshot is of
		   (the boundary `ASeasonFreezes` names), never 16:00 written as if it had run then. */
		freezeAt(2029, 1, 2, 9, 30);

		assertThat(frozenSeasons()).containsExactly(2027, 2028);
		assertThat(db.sql("select frozen_at from season_frozen where season = 2028").query(Timestamp.class).single().toInstant())
				.isEqualTo(LocalDateTime.of(2029, 1, 2, 9, 30).atZone(BELGRADE).toInstant());
	}

	/**
	 * A CORRECTION AFTER THE FREEZE, BOTH WAYS: downward does not open Bojan's category again, upward does
	 * not close Ana's.
	 */
	@Test
	void aCorrectionAfterTheFreezeMovesTheRightNeitherWay() {
		freezeAt(2028, 1, 1, 16, 0);

		db.sql("update result set points = 5 where competitor_id = ?").param(bojan()).update();
		db.sql("update result set points = 14 where competitor_id = ?").param(ana()).update();

		CategoryOfASeason.Book book = categories.everybody();

		assertThat(book.allowed(bojan(), 2029)).as("a correction downward opened it again").isFalse();
		assertThat(book.allowed(ana(), 2029)).as("a correction upward closed it").isTrue();
	}

	/**
	 * A DELETION AFTER THE FREEZE, of the only run Bojan has anywhere, so nothing live is left of him and
	 * the right is read off the snapshot alone.
	 */
	@Test
	void aDeletionAfterTheFreezeLeavesTheRightAsTheFreezeFoundIt() {
		freezeAt(2028, 1, 1, 16, 0);

		db.sql("delete from result where competitor_id = ?").param(bojan()).update();

		assertThat(best.pointsFor(bojan(), 2029)).isEqualByComparingTo("13.00");
		assertThat(categories.everybody().allowed(bojan(), 2029)).isFalse();
	}

	/**
	 * A MEMBER WITH NO POINTS AT THE FREEZE HAS NO ROW, AND NO ROW IS ZERO, never the live rows: his first
	 * run of 2027 arrives after the freeze.
	 */
	@Test
	void aMemberWithNoPointsAtTheFreezeHasNoneInThatSeasonWhateverArrivesLater() {
		member("000203", "00112233440203aa");
		memberOf("000203", 2027);

		freezeAt(2028, 1, 1, 16, 0);

		run("000203", "Druga", "2027-05-01", 15.00);

		assertThat(best.pointsFor(idOf("000203"), 2029)).isEqualByComparingTo(BigDecimal.ZERO);
		assertThat(categories.everybody().allowed(idOf("000203"), 2029)).isTrue();
	}

	/**
	 * THE SEASON AFTER THE FROZEN ONE IS STILL LIVE: Ana takes twelve in 2028 before it freezes, and 2029
	 * closes on her at once (PDL, 26.09.2026), while the frozen 2027 still says ten.
	 */
	@Test
	void theRunningSeasonBesideAFrozenOneIsStillCountedLive() {
		memberOf("000201", 2028);
		freezeAt(2028, 1, 1, 16, 0);

		run("000201", "Cetvrta", "2028-05-01", 12.00);

		assertThat(best.pointsFor(ana(), 2029)).isEqualByComparingTo("12.00");
		assertThat(categories.everybody().allowed(ana(), 2029)).isFalse();
		assertThat(categories.everybody().allowed(ana(), 2028)).as("2027 at its freeze says ten").isTrue();
	}

	/**
	 * A SECOND RUN WRITES NOTHING, even after the season has changed under it: „trajno".
	 */
	@Test
	void aSecondRunNeverRewritesTheSnapshot() {
		freezeAt(2028, 1, 1, 16, 0);

		db.sql("update result set points = 5 where competitor_id = ?").param(bojan()).update();
		run("000201", "Druga", "2027-05-01", 3.00);

		freezeAt(2028, 1, 1, 17, 0);

		assertThat(best.pointsFor(bojan(), 2029)).isEqualByComparingTo("13.00");
		assertThat(best.pointsFor(ana(), 2029)).isEqualByComparingTo("10.00");
		assertThat(db.sql("select frozen_at from season_frozen where season = 2027").query(Timestamp.class).single().toInstant())
				.isEqualTo(LocalDateTime.of(2028, 1, 1, 16, 0).atZone(BELGRADE).toInstant());
	}

	/**
	 * IT IS SCHEDULED AT 16:00 ON 1 JANUARY BY THE LEAGUE'S CLOCK, AND EVERY HOUR, THE FIRST AN HOUR AFTER
	 * START. Asked of the scheduler the context really built, the way {@code ThePicturesFolderIsSweptTest}
	 * asks it.
	 */
	@Test
	void itIsScheduledAtTheFreezeAndEveryHourAfterStart() {
		List<ScheduledTask> tasks = theTasksOfTheFreeze();

		assertThat(tasks).hasSize(2);

		CronTask atTheFreeze = tasks.stream().map(ScheduledTask::getTask).filter(CronTask.class::isInstance)
				.map(CronTask.class::cast).findFirst().orElseThrow();
		FixedDelayTask hourly = tasks.stream().map(ScheduledTask::getTask).filter(FixedDelayTask.class::isInstance)
				.map(FixedDelayTask.class::cast).findFirst().orElseThrow();

		/* Asked of the trigger and not of its text, so the zone is measured too: from the minute before
		   16:00 on 1.1.2028 in Belgrade (15:00 UTC in winter) the next run is that 16:00, and from the
		   minute after it the next is a year later. */
		Instant theFreeze = LocalDateTime.of(2028, 1, 1, 16, 0).atZone(BELGRADE).toInstant();

		assertThat(atTheFreeze.getTrigger().nextExecution(new SimpleTriggerContext(null, null,
				theFreeze.minusSeconds(60)))).isEqualTo(theFreeze);
		assertThat(atTheFreeze.getTrigger().nextExecution(new SimpleTriggerContext(null, null,
				theFreeze.plusSeconds(60)))).isEqualTo(LocalDateTime.of(2029, 1, 1, 16, 0).atZone(BELGRADE).toInstant());
		assertThat(hourly.getIntervalDuration()).isEqualTo(Duration.ofHours(1));
		assertThat(hourly.getInitialDelayDuration()).isEqualTo(Duration.ofHours(1));
	}

	private List<ScheduledTask> theTasksOfTheFreeze() {
		String theFreeze = ASeasonFreezes.class.getName() + ".freeze";

		return schedulers.stream()
				.flatMap(each -> each.getScheduledTasks().stream())
				.distinct()
				.filter(task -> task.getTask().getRunnable().toString().equals(theFreeze))
				.toList();
	}

	private void freezeAt(int year, int month, int day, int hour, int minute) {
		Instant at = LocalDateTime.of(year, month, day, hour, minute).atZone(BELGRADE).toInstant();

		new ASeasonFreezes(db, Clock.fixed(at, ZoneOffset.UTC), inOneTransaction, best).freeze();
	}

	private List<Integer> frozenSeasons() {
		return db.sql("select season from season_frozen order by season").query(Integer.class).list();
	}

	private long ana() {
		return idOf("000201");
	}

	private long bojan() {
		return idOf("000202");
	}

	private long idOf(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number)
				.query(Long.class).single();
	}

	private void member(String number, String referral) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, active,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Ime', 'Prezime', 'F', date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027, true,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, referral).update();
	}

	private void race(String name, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', null, 'Kraljevo',"
						+ " (select id from country where code = 'RS'), 'race', false, '', '')")
				.params("dogadjaj-" + name.toLowerCase(), name).update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " date '" + day + "', 'length', 0, 10, 0, 0)")
				.params("dogadjaj-" + name.toLowerCase(), name).update();
	}

	private void run(String member, String raceName, String day, double points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from race where name = ?), date '" + day + "', 10, 0, 0, 3000, ?)")
				.params(member, raceName, points).update();
	}

	private void memberOf(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}
}
