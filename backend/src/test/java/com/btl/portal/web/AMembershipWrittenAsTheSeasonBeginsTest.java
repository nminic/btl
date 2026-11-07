package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.pricing.Currency;
import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.statement.ASyntheticStatement;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A MEMBERSHIP WRITTEN BEFORE 16:00 ON 1 JANUARY KEEPS HIS TEAM AND HIS PAIR WHICHEVER OF THE TWO REACHES THE
 * DATABASE FIRST, because the owner's rule is about the moment and not about the order of two commits:
 * „Član koji nije platio do 1. januara u 16h ispada iz tima i para tog trenutka, i ne vraća se iako plati do
 * 31. marta." (PDL 05.11.2026). Whoever paid at 15:59:59 did not fail to pay by 16:00.
 *
 * <p><b>The finding this closes</b> (PENDING, review of PR 699, 07.11.2026): every road that writes a
 * membership reads the clock for the moment of the activation ({@code payment.recorded_at},
 * {@code balance_entry.occurred_at}, {@code membership.decided_at}) and commits some milliseconds later,
 * and the job reads through a REPEATABLE READ snapshot it has already taken. A membership stamped 15:59:59,9
 * and committed after the snapshot is invisible to the job, which drops the member from his team and his pair
 * although he paid in time. The reviewer measured {@code openTeamRows=0, pairs2028=0}.
 *
 * <p><b>The lock is the same one the cancellation takes</b> ({@link ACancellationAsTheSeasonBeginsTest}):
 * {@code SHARE} on {@code season_frozen} as the first statement of every road
 * ({@link ASeasonBegins#holdTheFreezeStill}), against the job's {@code SHARE ROW EXCLUSIVE} as the first
 * statement of its own. The order is forced in both directions, on every road, by holding the member's row
 * from outside and asking the lock manager who stands behind whom ({@link BlockedBehindThisHold}):
 * <ul>
 * <li>{@link #aMembershipStampedBeforeTheCutIsInTheSnapshotOfTheJob}: the road is stopped on his row, the job
 * is started after it and must stop behind it before it takes any snapshot. Released, the job reads the
 * membership and he stays.</li>
 * <li>{@link #aRoadThatMeetsTheJobWaitsForItAndIsStampedAfterTheCut}: the job stops after its snapshot, the road
 * is sent and must stop behind the job; he is dropped (he had not paid) and the road writes afterwards, with
 * a clock that has moved past the cut, and does not bring him back.</li>
 * <li>{@link #aMembershipStampedAfterTheCutDoesNotKeepHimEvenWhenItCommitsFirst}: the same order as the first,
 * with a stamp after 16:00. It is the case that fails if the lock is made to favour the payer, or if the
 * moment is read from anywhere but the row: committing first is not paying in time.</li>
 * </ul>
 *
 * <p><b>THE LOCK COSTS THE OTHER ROADS NOTHING</b> ({@link #roadsDoNotWaitForEachOther}): {@code SHARE} does not
 * conflict with itself, so two roads for two members run side by side and only the job waits.
 *
 * <p><b>THE CHANGE OF BASIS TAKES NO LOCK, and that is measured and not assumed</b>
 * ({@link #aChangeOfBasisInFlightWhenTheJobTakesItsSnapshotKeepsHim}): it deletes the row of the season and
 * writes it again carrying the first day ({@code first_activation_carried}, V82), so the snapshot sees either
 * the old row or the new one, and both answer the same moment.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AMembershipWrittenAsTheSeasonBeginsTest {

	private static final ZoneId BELGRADE = SeasonClock.ZONE;

	/** 15:59:59,9: the membership is stamped a tenth of a second before the cut. */
	private static final Instant BEFORE_THE_CUT = LocalDateTime.of(2028, 1, 1, 15, 59, 59, 900_000_000)
			.atZone(BELGRADE).toInstant();

	/** 16:00:00,4: the job has started (its own clock reads 16:00:00) and the stamp is after the cut. */
	private static final Instant AFTER_THE_CUT = LocalDateTime.of(2028, 1, 1, 16, 0, 0, 400_000_000)
			.atZone(BELGRADE).toInstant();

	private static final Instant THE_JOB_RUNS_AT = LocalDateTime.of(2028, 1, 1, 16, 0, 0)
			.atZone(BELGRADE).toInstant();

	private static final String THE_SUPERADMIN = "superadmin-u-sekundi@primer.rs";

	private static final String HIS_NUMBER = "000991";

	private static final String HERS_NUMBER = "000992";

	private static final String ANOTHERS_NUMBER = "000993";

	private static final AtomicInteger STATEMENTS = new AtomicInteger(7000);

	/** Every road that writes a season for a member, each the way its screen sends it. */
	enum Road {
		THE_PAYMENTS_SCREEN, A_PAYMENT_ON_HIS_ROW, FREE_OF_THE_FEE, FROM_HIS_BALANCE, HIS_OWN_ACTIVATION,
		AN_EXEMPTION_ON_HIS_ROW, A_BANK_STATEMENT
	}

	/** The same shape {@code ABeginnersCategoryAMembershipMovesTest} uses, and it reports UTC for the same reason. */
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
		AClockTheCaseMoves aClockTheCaseMoves() {
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
	private PriceRows priceRows;

	@Autowired
	private AClockTheCaseMoves clock;

	private String cookie;

	private long superadmin;

	private long him;

	private long her;

	private long another;

	private long hisAccount;

	private String hisCookie;

	@BeforeEach
	void aMemberOfAFullTeamAndAPairWhoseSeasonIsNotWrittenYet() {
		clock.moveTo(BEFORE_THE_CUT);

		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Mira', 'Usekundi', ?, (select id from role where code = 'superadmin'))")
				.param(THE_SUPERADMIN).update();

		superadmin = db.sql("select id from account where email = ?").param(THE_SUPERADMIN)
				.query(Long.class).single();
		cookie = session(superadmin);

		him = competitor(HIS_NUMBER, "Aca", "M", "0011223344000991");
		her = competitor(HERS_NUMBER, "Bora", "F", "0011223344000992");
		another = competitor(ANOTHERS_NUMBER, "Cana", "F", "0011223344000993");

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Aca', 'Uletic', ?, (select id from role where code = 'competitor'), ?)")
				.params("aca-u-sekundi@primer.rs", him).update();

		hisAccount = db.sql("select id from account where email = ?").param("aca-u-sekundi@primer.rs")
				.query(Long.class).single();
		hisCookie = session(hisAccount);

		/* ENOUGH IN HIS BOOK FOR ANY FEE, so the balance and his own activation can spend it. */
		for (long each : new long[] {him, another}) {
			db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season, occurred_at,"
							+ " recorded_by_name) values (?, 100.00, 'EUR', 'overpayment', 2027,"
							+ " timestamptz '2027-01-10 10:00:00+00', 'Blagajnik Probni')")
					.param(each).update();
		}

		/* HE HOLDS 2027 AND NOTHING OF 2028; SHE HOLDS BOTH. The job takes locks on his row through the foreign
		   keys of the snapshot of 2027, which is what stops it, after its snapshot, when the case holds the row. */
		HeldOn.season(db, him, 2027, "feeExempt");
		HeldOn.season(db, her, 2027, "feeExempt");
		HeldOn.season(db, her, 2028, "feeExempt");

		long team = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values ('upisano-u-sekundi-tim', 'Upisano u sekundi', '', '',"
						+ " (select id from place where rank = 1), null, null, null, 2027, ?) returning id")
				.param(her).query(Long.class).single();

		for (long each : new long[] {him, her}) {
			db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
					+ " values (?, ?, 2027, null, null)").params(each, team).update();
		}

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

			long[] all = {him, her, another};

			for (long each : all) {
				db.sql("delete from bank_statement_line where payment_id in"
						+ " (select id from payment where competitor_id = ?)").param(each).update();
			}

			db.sql("delete from bank_statement where loaded_by = ?").param(superadmin).update();
			db.sql("delete from racing_pair where season = 2028").update();
			db.sql("delete from team where slug = 'upisano-u-sekundi-tim'").update();

			for (long each : all) {
				db.sql("delete from membership_change where competitor_id = ?").param(each).update();
				db.sql("delete from message where to_id = ? or from_id = ?").params(each, each).update();
				db.sql("delete from membership where competitor_id = ?").param(each).update();
				db.sql("delete from payment where competitor_id = ?").param(each).update();
				db.sql("delete from balance_entry where competitor_id = ?").param(each).update();
			}

			db.sql("delete from account_session where account_id in (?, ?)").params(superadmin, hisAccount).update();
			db.sql("delete from account where id in (?, ?)").params(superadmin, hisAccount).update();

			for (long each : all) {
				db.sql("delete from competitor where id = ?").param(each).update();
			}
		});
	}

	/* ------------------------------------------------------------------------------------
	   THE ROAD IS FIRST AND THE JOB MEETS IT
	   ------------------------------------------------------------------------------------ */

	@ParameterizedTest
	@EnumSource(Road.class)
	void aMembershipStampedBeforeTheCutIsInTheSnapshotOfTheJob(Road road) throws Exception {
		clock.moveTo(BEFORE_THE_CUT);

		theRoadIsFirstAndTheJobMeetsIt(prepared(road));

		assertThat(heldIn2028(him)).as("his membership of 2028 is written").isOne();
		assertHeStaysInHisTeamAndHisPair();
	}

	@ParameterizedTest
	@EnumSource(Road.class)
	void aMembershipStampedAfterTheCutDoesNotKeepHimEvenWhenItCommitsFirst(Road road) throws Exception {
		clock.moveTo(AFTER_THE_CUT);

		theRoadIsFirstAndTheJobMeetsIt(prepared(road));

		assertThat(heldIn2028(him)).as("his membership of 2028 is written").isOne();
		assertHeIsOutOfTheTeamAndThePairAndSheIsNot();
	}

	/**
	 * <b>A change of basis takes no lock.</b> His exemption of 2028 was decided in December 2027; the change
	 * to a payment is stopped on his row while the job takes its snapshot, and he stays.
	 */
	@Test
	void aChangeOfBasisInFlightWhenTheJobTakesItsSnapshotKeepsHim() throws Exception {
		HeldOn.season(db, him, 2028, "feeExempt", Instant.parse("2027-12-01T10:00:00Z"));
		clock.moveTo(BEFORE_THE_CUT);

		theRoadIsFirstAndTheJobMeetsIt(() -> sent(put("/api/members/" + HIS_NUMBER + "/membership"),
				"{\"from\": \"feeExempt\", \"to\": \"payment\", \"received\": 38.00, \"method\": \"paypal\"}",
				cookie));

		assertThat(db.sql("select basis from membership where competitor_id = ? and season = 2028")
				.param(him).query(String.class).single()).as("the change was written").isEqualTo("payment");
		assertHeStaysInHisTeamAndHisPair();
	}

	/**
	 * The member's row is held from outside, the road is stopped on it, and the job, started after the road,
	 * must stop behind the road's lock before it has taken a snapshot. Both are released together.
	 */
	private void theRoadIsFirstAndTheJobMeetsIt(Callable<MockHttpServletResponse> road) throws Exception {
		ExecutorService both = Executors.newFixedThreadPool(2);

		try (AHeldTransaction holdingHisRow = new AHeldTransaction(pool)) {
			holdingHisRow.db().sql("select 1 from competitor where id = ? for update")
					.param(him).query(Integer.class).single();

			assertThat(holdingHisRow.behind()).as("his row is held and nothing was sent yet").isZero();

			Future<MockHttpServletResponse> request = both.submit(road);

			holdingHisRow.untilBehind(1, List.of(request));

			Future<?> job = both.submit(() -> theJobWith(season -> begins.followTheFreezeOf(season)));

			holdingHisRow.untilBehind(2, List.of(request, job));

			assertThat(request.isDone() || job.isDone()).as("both are stopped inside the database").isFalse();

			holdingHisRow.commit();

			assertThat(request.get(30, TimeUnit.SECONDS).getStatus()).as("the road was answered").isIn(200, 201);
			job.get(60, TimeUnit.SECONDS);
		} finally {
			both.shutdownNow();
		}

		assertThat(db.sql("select count(*) from season_frozen where season = 2027").query(Long.class).single())
				.as("the job froze 2027").isOne();
	}

	/* ------------------------------------------------------------------------------------
	   THE JOB IS FIRST AND THE ROAD MEETS IT
	   ------------------------------------------------------------------------------------ */

	@ParameterizedTest
	@EnumSource(Road.class)
	void aRoadThatMeetsTheJobWaitsForItAndIsStampedAfterTheCut(Road road) throws Exception {
		clock.moveTo(BEFORE_THE_CUT);

		Callable<MockHttpServletResponse> sending = prepared(road);

		CountDownLatch jobHoldsItsRow = new CountDownLatch(1);
		AtomicInteger stoppedBeforeTheRequest = new AtomicInteger(-1);
		AtomicInteger stoppedWhenTheJobWentOn = new AtomicInteger(-1);
		List<Future<MockHttpServletResponse>> request = new CopyOnWriteArrayList<>();
		ExecutorService requests = Executors.newSingleThreadExecutor();

		/* THE JOB STOPS WHERE THE OWNER'S SECONDS ARE: its snapshot is taken and its row of season_frozen is
		   written, and the beginning of the season has not read a membership yet. It goes on when the lock
		   manager says the road is stopped behind it, or when the road is answered (which is the fault: nothing
		   stopped it). THE CLOCK MOVES PAST THE CUT as it goes on, because a road that waited for the job reads
		   it after the job, and that is the whole of why it is stamped after the cut. */
		WhatFollowsTheFreeze stoppedInFlight = season -> {
			stoppedBeforeTheRequest.set(BlockedBehindThisHold.count(db));
			jobHoldsItsRow.countDown();

			Instant deadline = Instant.now().plusSeconds(15);

			while (BlockedBehindThisHold.count(db) < 1 && Instant.now().isBefore(deadline)
					&& request.stream().noneMatch(Future::isDone)) {
				sleep();
			}

			stoppedWhenTheJobWentOn.set(BlockedBehindThisHold.count(db));
			clock.moveTo(AFTER_THE_CUT);
			begins.followTheFreezeOf(season);
		};

		try {
			CompletableFuture<Void> job = CompletableFuture.runAsync(() -> theJobWith(stoppedInFlight));

			assertThat(jobHoldsItsRow.await(60, TimeUnit.SECONDS)).as("the job reached its beginning").isTrue();

			request.add(requests.submit(sending));

			job.get(60, TimeUnit.SECONDS);

			assertThat(request.get(0).get(30, TimeUnit.SECONDS).getStatus())
					.as("the road was answered with a fault").isIn(200, 201);
		} finally {
			requests.shutdownNow();
		}

		assertThat(stoppedBeforeTheRequest.get()).as("nothing stood behind the job before the road").isZero();
		assertThat(stoppedWhenTheJobWentOn.get())
				.as("the road was stopped behind the job inside the database, not answered past it")
				.isOne();

		assertThat(db.sql("select count(*) from season_frozen where season = 2027").query(Long.class).single())
				.as("the job froze 2027").isOne();
		assertThat(heldIn2028(him)).as("the road wrote his season after the job").isOne();
		assertHeIsOutOfTheTeamAndThePairAndSheIsNot();
	}

	/* ------------------------------------------------------------------------------------
	   THE LOCK COSTS THE OTHER ROADS NOTHING
	   ------------------------------------------------------------------------------------ */

	/**
	 * A road stopped on one member's row does not stop a road for another member: {@code SHARE} does not
	 * conflict with {@code SHARE}. A lock that did (the job's own {@code SHARE ROW EXCLUSIVE}, say) would hold
	 * the second road behind the first for as long as the first is stopped.
	 */
	@Test
	void roadsDoNotWaitForEachOther() throws Exception {
		ExecutorService both = Executors.newFixedThreadPool(2);

		try (AHeldTransaction holdingHisRow = new AHeldTransaction(pool)) {
			holdingHisRow.db().sql("select 1 from competitor where id = ? for update")
					.param(him).query(Integer.class).single();

			Future<MockHttpServletResponse> stopped = both.submit(prepared(Road.A_PAYMENT_ON_HIS_ROW));

			holdingHisRow.untilBehind(1, List.of(stopped));

			Future<MockHttpServletResponse> another = both.submit(() -> sent(post("/api/members/"
					+ ANOTHERS_NUMBER + "/payment"), "{\"received\": 38.00, \"method\": \"paypal\"}", cookie));

			assertThat(another.get(30, TimeUnit.SECONDS).getStatus())
					.as("the road for another member was answered while the first stood stopped").isEqualTo(201);
			assertThat(stopped.isDone()).as("the first road is still stopped on his row").isFalse();
			assertThat(holdingHisRow.behind()).as("only the first road stands behind his row").isOne();

			holdingHisRow.commit();

			assertThat(stopped.get(30, TimeUnit.SECONDS).getStatus()).isEqualTo(201);
		} finally {
			both.shutdownNow();
		}
	}

	/* ------------------------------------------------------------------------------------
	   WHAT IS READ BACK
	   ------------------------------------------------------------------------------------ */

	private long heldIn2028(long member) {
		return db.sql("select count(*) from membership where competitor_id = ? and season = 2028")
				.param(member).query(Long.class).single();
	}

	private void assertHeStaysInHisTeamAndHisPair() {
		assertThat(db.sql("select count(*) from team_membership where competitor_id = ? and season_to is null")
				.param(him).query(Long.class).single())
				.as("he paid before 16:00 and stays in his team (PDL 05.11.2026)").isOne();
		assertThat(db.sql("select count(*) from racing_pair where season = 2028").query(Long.class).single())
				.as("and in his pair").isOne();
		assertSheStays();
	}

	private void assertHeIsOutOfTheTeamAndThePairAndSheIsNot() {
		assertThat(db.sql("select count(*) from team_membership where competitor_id = ? and season_to is null")
				.param(him).query(Long.class).single())
				.as("he had not paid by 16:00, so he is out of his team, and the payment does not bring him back")
				.isZero();
		assertThat(db.sql("select count(*) from racing_pair where season = 2028").query(Long.class).single())
				.as("and his pair of 2028 is broken").isZero();
		assertSheStays();
	}

	private void assertSheStays() {
		assertThat(db.sql("select count(*) from team_membership where competitor_id = ? and season_to is null")
				.param(her).query(Long.class).single())
				.as("she renewed, and stays in the team").isOne();
	}

	/* ------------------------------------------------------------------------------------
	   THE ROADS
	   ------------------------------------------------------------------------------------ */

	/**
	 * What the road needs before it is sent is done here, on this thread, so that the request itself is the
	 * first thing that touches his row: a statement pays into the dinar account, so he is moved to Serbia
	 * first, and the amount it carries is the one the label expects of him.
	 */
	private Callable<MockHttpServletResponse> prepared(Road road) throws Exception {
		return switch (road) {
			case THE_PAYMENTS_SCREEN -> () -> sent(post("/api/payments"), "{\"competitorId\": " + him
					+ ", \"received\": 38.00, \"useTheBalance\": false, \"method\": \"paypal\"}", cookie);
			case A_PAYMENT_ON_HIS_ROW -> () -> sent(post("/api/members/" + HIS_NUMBER + "/payment"),
					"{\"received\": 38.00, \"method\": \"paypal\"}", cookie);
			case FREE_OF_THE_FEE -> () -> sent(post("/api/memberships"),
					"{\"competitorId\": " + him + ", \"ground\": \"feeExempt\"}", cookie);
			case FROM_HIS_BALANCE -> () -> sent(post("/api/memberships"),
					"{\"competitorId\": " + him + ", \"ground\": \"balance\"}", cookie);
			case HIS_OWN_ACTIVATION -> () -> sent(post("/api/me/membership"), "{}", hisCookie);
			case AN_EXEMPTION_ON_HIS_ROW -> () -> sent(post("/api/members/" + HIS_NUMBER + "/membership"),
					"{\"basis\": \"feeExempt\"}", cookie);
			case A_BANK_STATEMENT -> aStatementPaying();
		};
	}

	private Callable<MockHttpServletResponse> aStatementPaying() {
		db.sql("update competitor set place_id = (select id from place where country_id ="
						+ " (select id from country where code = 'RS') order by rank limit 1) where id = ?")
				.param(him).update();

		int season = SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock));
		BigDecimal expected = MembershipPrice.on(priceRows.all(),
				LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE), 1990, season, Currency.RSD).expected();
		int number = STATEMENTS.incrementAndGet();

		byte[] statement = ASyntheticStatement.number(number)
				.credit("PROBNI CLAN", expected.toPlainString(), season + HIS_NUMBER,
						String.format("59%014d (19%014d-1)", number, number))
				.bytes();

		return () -> {
			MockHttpServletResponse answer = http.perform(multipart("/api/statements")
							.file(new MockMultipartFile("statement", "izvod.pdf", "application/pdf", statement))
							.with(csrf())
							.cookie(new Cookie(SessionCookie.NAME, cookie)))
					.andReturn().getResponse();

			assertThat(answer.getContentAsString(StandardCharsets.UTF_8))
					.as("the statement booked his payment").contains("\"bookedNow\":1");

			return answer;
		};
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
