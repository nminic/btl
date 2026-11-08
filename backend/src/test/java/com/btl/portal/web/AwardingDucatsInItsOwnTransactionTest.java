package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT A RECONCILIATION DOES BESIDE ITS OWN WORK: it runs in a transaction of its own, two of one member
 * take turns, a row written past the turn is met without a fault, and a deletion of the member is waited
 * for rather than deadlocked with.
 *
 * <p>Committed, not rolled back, because a transaction of its own sees only what is committed and a turn
 * is only a turn between two connections; {@link #everythingThisWroteGoes} takes it all away again.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AwardingDucatsInItsOwnTransactionTest {

	private static final String ANA = "000961";

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate transactions;

	@Autowired
	private DataSource pool;

	private AwardingDucats ducats;

	@BeforeEach
	void anaHasRunOneHundredAndTwentyFiveKilometresInFebruary2028() {
		ducats = new AwardingDucats(db, Clock.fixed(LocalDateTime.of(2028, 3, 15, 12, 0).atZone(SeasonClock.ZONE)
				.toInstant(), ZoneOffset.UTC), transactions);

		transactions.executeWithoutResult(any -> {
			db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
							+ " place_id, city, country_id, first_season,"
							+ " referral_code, referred_by, bio, profile_hidden,"
							+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
							+ " values (?, 'Ime', 'Prezime', 'F', date '1990-05-05',"
							+ " (select id from place where rank = 1), null, null, 2027,"
							+ " '0011223340000961', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
							+ " timestamptz '2026-09-01 10:00:00+00')")
					.param(ANA).update();
			db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
							+ " values (?, 2028, 'feeExempt', 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
					.param(ana()).update();
			race("dukat-sopstvena-prva", "2028-02-03");
			race("dukat-sopstvena-druga", "2028-02-10");
			run("dukat-sopstvena-prva", "60");
			run("dukat-sopstvena-druga", "65");
		});
	}

	@AfterEach
	void everythingThisWroteGoes() {
		transactions.executeWithoutResult(any -> {
			db.sql("delete from competitor where member_number = ?").param(ANA).update();
			db.sql("delete from btl_event where slug like 'dukat-sopstvena-%'").update();
		});
	}

	@Test
	void itSeesWhatIsCommittedAndNothingTheTransactionItIsCalledFromHasNot() {
		transactions.executeWithoutResult(any -> db.sql("delete from result where competitor_id = ? and race_id ="
						+ " (select id from race where name = 'dukat-sopstvena-druga')").param(ana()).update());

		transactions.executeWithoutResult(outer -> {
			run("dukat-sopstvena-druga", "65");

			assertThat(ducats.forMember(ana()))
					.as("the 65 km the caller has not committed were counted: it ran in the caller's transaction")
					.isEmpty();

			outer.setRollbackOnly();
		});
	}

	@Test
	void whatItWritesStandsWhenTheTransactionItIsCalledFromRollsBack() {
		transactions.executeWithoutResult(outer -> {
			assertThat(ducats.forMember(ana())).extracting(AwardingDucats.Won::code).containsExactly("duk-mesecni-km");

			outer.setRollbackOnly();
		});

		assertThat(db.sql("select count(*) from ducat_award where competitor_id = ?").param(ana())
				.query(Long.class).single())
				.as("the ducat went with the caller's rollback: it was written in the caller's transaction")
				.isEqualTo(1);
	}

	@Test
	void aSecondReconciliationOfTheSameMemberWaitsForTheFirst() throws Exception {
		ExecutorService two = Executors.newSingleThreadExecutor();

		try (AHeldTransaction first = new AHeldTransaction(pool)) {
			first.db().sql("select pg_advisory_xact_lock(hashtextextended(?, 0))::text").param("ducats:" + ana())
					.query(String.class).single();

			Future<List<AwardingDucats.Won>> second = two.submit(() -> ducats.forMember(ana()));

			first.untilBehind(1, List.of(second));

			assertThat(second).as("it went ahead while another held the member's turn").isNotDone();

			first.commit();

			assertThat(second.get(30, TimeUnit.SECONDS)).hasSize(1);
		}
		finally {
			two.shutdownNow();
		}
	}

	@Test
	void aRowWrittenPastTheTurnIsMetWithoutAFaultAndIsNotAnsweredAsWrittenHere() throws Exception {
		ExecutorService two = Executors.newSingleThreadExecutor();

		try (AHeldTransaction another = new AHeldTransaction(pool)) {
			another.db().sql("insert into ducat_award (competitor_id, ducat_id, awarded_at, kind, threshold, reached,"
							+ " period, season, month, tier, won_on, result_id)"
							+ " select ?, d.id, now(), d.kind, d.threshold, 125, d.period, 2028, 2, d.tier,"
							+ " date '2028-02-10', null from ducat d where d.code = 'duk-mesecni-km'")
					.param(ana()).update();

			Future<List<AwardingDucats.Won>> reconciling = two.submit(() -> ducats.forMember(ana()));

			another.untilBehind(1, List.of(reconciling));
			another.commit();

			assertThat(reconciling).succeedsWithin(Duration.ofSeconds(30))
					.as("somebody else wrote it, so it is not this one's to announce")
					.satisfies(written -> assertThat(written).isEmpty());
		}
		finally {
			two.shutdownNow();
		}

		assertThat(db.sql("select count(*) from ducat_award where competitor_id = ?").param(ana())
				.query(Long.class).single()).isEqualTo(1);
	}

	@Test
	void aDeletionOfTheMemberIsWaitedForAndLeavesNothingToReconcile() throws Exception {
		ExecutorService two = Executors.newSingleThreadExecutor();

		try (AHeldTransaction deleting = new AHeldTransaction(pool)) {
			deleting.db().sql("delete from competitor where id = ?").param(ana()).update();

			Future<List<AwardingDucats.Won>> reconciling = two.submit(() -> ducats.forMember(ana()));

			deleting.untilBehind(1, List.of(reconciling));
			deleting.commit();

			assertThat(reconciling).succeedsWithin(Duration.ofSeconds(30))
					.as("a member deleted while his ducats were being reconciled")
					.satisfies(written -> assertThat(written).isEmpty());
		}
		finally {
			two.shutdownNow();
		}
	}

	private long ana() {
		return db.sql("select id from competitor where member_number = ?").param(ANA).query(Long.class).single();
	}

	private void race(String slug, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description,"
						+ " link) values (?, ?, date '" + day + "', null, 'Grad',"
						+ " (select id from country where code = 'RS'), 'race', false, '', '')")
				.params(slug, slug).update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
						+ " descent_m) values ((select id from btl_event where slug = ?), ?, false, date '" + day
						+ "', 'length', 0, 10, 0, 0)")
				.params(slug, slug).update();
	}

	private void run(String slug, String kilometres) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds,"
						+ " points) select ?, race.id, race.date, " + kilometres + ", 0, 0, 3000, 1 from race"
						+ " where race.name = ?")
				.params(ana(), slug).update();
	}
}
