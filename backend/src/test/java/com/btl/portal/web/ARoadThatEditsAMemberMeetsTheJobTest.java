package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A ROAD THAT EDITS A MEMBER AND TAKES NO LOCK DOES NOT BREAK THE JOB OF 1 JANUARY, and that is measured here and
 * not assumed (PENDING, review of PR 701, 07.11.2026, „zapažanje, van PR-a"; closed on 08.11.2026 as not
 * confirmed for the routes it names).
 *
 * <p><b>The claim.</b> {@code MeWriteApi}, {@code MemberPictureAndWordsApi} and {@code VerificationWriteApi} change
 * the row of {@code competitor} without {@link ASeasonBegins#holdTheFreezeStill}, so one of them committing after
 * the snapshot of the job and before the job's first lock on that row (the foreign key of the message the job
 * writes to the other half of a pair takes one, {@code FOR KEY SHARE}) would make the job fail with „could not
 * serialize access", and it would be tried again an hour later.
 *
 * <p><b>What the database does instead.</b> Measured 08.11.2026 on {@code postgres:18}, with a repeatable read
 * transaction that took its snapshot, a second connection that committed the edit, and then the insert of a
 * message to that member: every edit of a column that is not part of a key (names, address, shirt size, phone,
 * town, photo, biography, the switch that hides the profile) leaves the job untouched, because
 * {@code FOR KEY SHARE} does not conflict with the {@code FOR NO KEY UPDATE} such an edit takes. What fails is a
 * change of a column of a unique index: the member number, the gender, and the deletion of the row.
 * <ul>
 * <li>{@link #aProfileEditCommittedAfterTheSnapshotOfTheJobStopsNothing}: the route itself, sent while the job
 * stands between its snapshot and its first lock on her row. The job finishes, the road is answered at once
 * and nothing stood behind either of them.</li>
 * <li>{@link #aChangeOfTheMemberNumberInTheSameWindowWouldStopIt}: the control, the same window with the one
 * change that does conflict. Without it the case above could pass because the window never reaches her row.
 * (The roads that write a member number already hold the lock: {@code BookingAPayment},
 * {@code GrantingASeason}, {@code MyMembershipWriteApi}.)</li>
 * <li>{@link #theColumnsOfAKeyAreTheOnesThisWasMeasuredFor}: the floor, read off the catalog. What is said above
 * holds for a column that is in no unique index, so a unique index added tomorrow over a column a profile route
 * writes is a new question, and this fails until somebody asks it.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ARoadThatEditsAMemberMeetsTheJobTest {

	private static final ZoneId BELGRADE = SeasonClock.ZONE;

	private static final Instant BEFORE_THE_CUT = LocalDateTime.of(2028, 1, 1, 15, 59, 59, 900_000_000)
			.atZone(BELGRADE).toInstant();

	private static final Instant THE_JOB_RUNS_AT = LocalDateTime.of(2028, 1, 1, 16, 0, 0)
			.atZone(BELGRADE).toInstant();

	/** The same shape the other cases of the job use, and it reports UTC for the same reason. */
	static final class AClockTheCaseMoves extends Clock {

		private volatile Instant now;

		private AClockTheCaseMoves(Instant now) {
			this.now = now;
		}

		void moveTo(Instant when) {
			this.now = when;
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		AClockTheCaseMoves aClockForTheEditingRoads() {
			return new AClockTheCaseMoves(BEFORE_THE_CUT);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private DataSource pool;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private TheTablesOfASeason tables;

	@Autowired
	private ASeasonBegins begins;

	@Autowired
	private AClockTheCaseMoves clock;

	private long him;

	private long her;

	private long herAccount;

	private String herCookie;

	/**
	 * HE HOLDS 2027 AND NOTHING OF 2028; SHE HOLDS ONLY 2028, so the snapshot of 2027 writes no row that names her
	 * and the job takes no lock on her row until it tells her that her pair is broken. That first lock is the
	 * moment the case is about.
	 */
	@BeforeEach
	void aPairWhoseSecondHalfHoldsOnlyTheSeasonThatBegins() {
		clock.moveTo(BEFORE_THE_CUT);

		him = competitor("000981", "Aca", "M", "0011223344000981");
		her = competitor("000982", "Bora", "F", "0011223344000982");

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Bora', 'Uletic', ?, (select id from role where code = 'competitor'), ?)")
				.params("bora-u-poslu@primer.rs", her).update();

		herAccount = db.sql("select id from account where email = ?").param("bora-u-poslu@primer.rs")
				.query(Long.class).single();
		herCookie = session(herAccount);

		HeldOn.season(db, him, 2027, "feeExempt");
		HeldOn.season(db, her, 2028, "feeExempt");

		db.sql("insert into racing_pair (season, man_id, woman_id) values (2028, ?, ?)").params(him, her).update();
	}

	/** Real commits, children before parents; the job wrote the snapshot of 2027 into tables nobody else uses. */
	@AfterEach
	void nothingIsLeftBehind() {
		inOneTransaction.executeWithoutResult(any -> {
			for (String table : List.of("season_award", "season_board", "season_pair", "season_league_standing",
					"season_league_column", "season_team", "season_competitor", "season_points_at_freeze",
					"season_frozen")) {
				db.sql("delete from " + table + " where season = 2027").update();
			}

			db.sql("delete from racing_pair where season = 2028").update();

			for (long each : new long[] {him, her}) {
				db.sql("delete from message where to_id = ? or from_id = ?").params(each, each).update();
				db.sql("delete from membership where competitor_id = ?").param(each).update();
			}

			db.sql("delete from account_session where account_id = ?").param(herAccount).update();
			db.sql("delete from account where id = ?").param(herAccount).update();

			for (long each : new long[] {him, her}) {
				db.sql("delete from competitor where id = ?").param(each).update();
			}
		});
	}

	@Test
	void aProfileEditCommittedAfterTheSnapshotOfTheJobStopsNothing() throws Exception {
		ExecutorService roads = Executors.newSingleThreadExecutor();
		List<Future<MockHttpServletResponse>> request = new CopyOnWriteArrayList<>();
		AtomicInteger stoppedWhenTheJobWentOn = new AtomicInteger(-1);

		/* THE JOB STANDS WHERE THE OWNER'S SECONDS ARE: its snapshot is taken and nothing of hers was read yet.
		   The road is sent from here and the job goes on when the road is answered or when the lock manager says
		   it is stopped behind the job, and the second would be the fault. */
		WhatFollowsTheFreeze interleaved = season -> {
			request.add(roads.submit(() -> sent(put("/api/me"),
					"{\"firstName\": \"Borka\", \"address\": \"Ulica 2\", \"profileHidden\": true}",
					herCookie)));

			Instant deadline = Instant.now().plusSeconds(15);

			while (BlockedBehindThisHold.count(db) < 1 && Instant.now().isBefore(deadline)
					&& request.stream().noneMatch(Future::isDone)) {
				sleep();
			}

			stoppedWhenTheJobWentOn.set(BlockedBehindThisHold.count(db));
			begins.followTheFreezeOf(season);
		};

		try {
			CompletableFuture.runAsync(() -> theJobWith(interleaved)).get(60, TimeUnit.SECONDS);

			assertThat(request.get(0).get(30, TimeUnit.SECONDS).getStatus()).as("the edit was answered")
					.isEqualTo(200);
		} finally {
			roads.shutdownNow();
		}

		assertThat(stoppedWhenTheJobWentOn.get()).as("the edit was not stopped behind the job").isZero();
		assertThat(db.sql("select first_name || '|' || address || '|' || profile_hidden from competitor where id = ?")
				.param(her).query(String.class).single()).as("and it is written")
				.isEqualTo("Borka|Ulica 2|true");
		assertThat(db.sql("select count(*) from season_frozen where season = 2027").query(Long.class).single())
				.as("the job froze 2027").isOne();
		assertThat(db.sql("select count(*) from racing_pair where season = 2028").query(Long.class).single())
				.as("it broke the pair of the member who did not renew").isZero();
		assertThat(db.sql("select count(*) from message where to_id = ?").param(her).query(Long.class).single())
				.as("and told her, which is the first lock on her row, taken after the edit committed").isOne();
	}

	@Test
	void aChangeOfTheMemberNumberInTheSameWindowWouldStopIt() {
		WhatFollowsTheFreeze interleaved = season -> {
			try (Connection another = pool.getConnection()) {
				another.setAutoCommit(true);

				try (PreparedStatement edit = another.prepareStatement(
						"update competitor set member_number = '000977' where id = ?")) {
					edit.setLong(1, her);
					edit.executeUpdate();
				}
			} catch (SQLException e) {
				throw new IllegalStateException(e);
			}

			begins.followTheFreezeOf(season);
		};

		assertThatThrownBy(() -> CompletableFuture.runAsync(() -> theJobWith(interleaved)).get(60, TimeUnit.SECONDS))
				.hasStackTraceContaining("could not serialize access");

		assertThat(db.sql("select count(*) from season_frozen where season = 2027").query(Long.class).single())
				.as("and the job wrote nothing, to be tried again").isZero();
		assertThat(db.sql("select count(*) from racing_pair where season = 2028").query(Long.class).single())
				.as("so the pair stands until it is").isOne();
	}

	@Test
	void theColumnsOfAKeyAreTheOnesThisWasMeasuredFor() {
		/* A column is part of a key for the lock when it is in a unique index that has no expression and no
		   predicate, which is what the foreign keys of the other tables can point at. */
		assertThat(db.sql("select distinct a.attname from pg_index i"
						+ " join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)"
						+ " where i.indrelid = 'competitor'::regclass and i.indisunique"
						+ " and i.indexprs is null and i.indpred is null order by a.attname")
				.query(String.class).list())
				.as("the columns of competitor whose change takes a lock that conflicts with the job's")
				.containsExactly("gender", "id", "member_number", "referral_code");
	}

	private MockHttpServletResponse sent(MockHttpServletRequestBuilder asks, String json, String secret)
			throws Exception {
		return http.perform(asks.with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json)
						.cookie(new Cookie(SessionCookie.NAME, secret)))
				.andReturn().getResponse();
	}

	private void theJobWith(WhatFollowsTheFreeze follower) {
		new ASeasonFreezes(db, Clock.fixed(THE_JOB_RUNS_AT, ZoneOffset.UTC), inOneTransaction, best, tables,
				new ObjectProvider<>() {
					@Override
					public Stream<WhatFollowsTheFreeze> orderedStream() {
						return Stream.of(follower);
					}
				}).freeze();
	}

	private String session(long account) {
		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values (?, ?, ?, ?, ?)")
				.params(account, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}

	private long competitor(String number, String first, String gender, String referral) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, 'Uletic', ?, date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, first, gender, referral)
				.query(Long.class).single();
	}

	private static void sleep() {
		try {
			Thread.sleep(20);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException(e);
		}
	}
}
