package com.btl.portal.web;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.config.CronTask;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.scheduling.support.SimpleTriggerContext;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PASS AT NIGHT: every member is reconciled, one that fails stops nobody, the pass before the freeze says
 * when it could not, nothing of the history is told and a ducat of a result brought in since the start of
 * awarding is, and nothing of it runs at start.
 *
 * <p>PDL, owner, 08.11.2026: "Pozadinski posao koji ponovo računa dukate svih članova radi jednom noću (03:00)
 * i još jednom 1. januara u 15:00, pre zamrzavanja", and "prolaz kroz istoriju dodeljuje tiho."; and
 * 12.11.2026: "Tiho ostaje samo ono što dolazi iz rezultata odobrenih pre početka dodele."
 *
 * <p><b>Five members, committed</b>, because every member is reconciled in a transaction of his own
 * ({@link AwardingDucats#forMember}) and sees only what is committed: ANA has an account and a membership of
 * 2028, BOJAN has the same and <b>no account</b>, CELA has <b>no account and a membership that ended in
 * 2027</b>. Each has run 125 km in a February (the first two in 2028, the third in 2027), so each is owed the
 * monthly ducat, and a pass that skipped a member for either reason leaves that member without it. DANE has
 * <b>no membership row at all</b> and the same two runs in 2028, one of them a climb of 100000 m (PDL, owner,
 * 18.10.2026: "Dukati broje sve rezultate, i pre 2027 i iz godina bez članstva"): a ducat that stands for ever
 * is his, a ducat of a month is not (it is owed to a season he holds), so a pass that walked only the members of
 * a membership leaves him without {@code duk-uspon}. HOLDER holds the monthly ducat of February 2028 and has <b>no result at all</b>, so
 * a pass that walked only the members who have a result leaves him holding what is no longer his: the pass
 * takes it away, which is what the pass is for after a deletion.
 * {@link #everythingThisWroteGoes} takes it all away again, and the ducats the pass wrote to anybody else
 * committed in the shared database.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class DucatsAreReconciledAtNightTest {

	private static final String ANA = "000971";

	private static final String BOJAN = "000972";

	private static final String CELA = "000973";

	private static final String DANE = "000974";

	private static final String HOLDER = "000975";

	private static final Clock THE_NIGHT_OF_THE_PASS = Clock.fixed(LocalDateTime.of(2028, 3, 15, 3, 0)
			.atZone(SeasonClock.ZONE).toInstant(), ZoneOffset.UTC);

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate transactions;

	@Autowired
	private ObjectProvider<ScheduledTaskHolder> schedulers;

	private long awardsBefore;

	@BeforeEach
	void fiveMembersFourOwedTheMonthlyDucatAndOneHoldingAnUnearnedOne() {
		awardsBefore = db.sql("select coalesce(max(id), 0) from ducat_award").query(Long.class).single();

		transactions.executeWithoutResult(any -> {
			member(ANA);
			member(BOJAN);
			member(CELA);
			member(DANE);
			member(HOLDER);
			db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
							+ " values ('Probni', 'Probic', 'dukat-noc@primer.rs',"
							+ " (select id from role where code = 'competitor'), ?)")
					.param(id(ANA)).update();
			membership(ANA, 2028);
			membership(BOJAN, 2028);
			membership(CELA, 2027);
			race("dukat-noc-2028-prva", "2028-02-03");
			race("dukat-noc-2028-druga", "2028-02-10");
			race("dukat-noc-2027-prva", "2027-02-03");
			race("dukat-noc-2027-druga", "2027-02-10");

			for (String who : List.of(ANA, BOJAN)) {
				run(who, "dukat-noc-2028-prva", "60");
				run(who, "dukat-noc-2028-druga", "65");
			}

			run(CELA, "dukat-noc-2027-prva", "60");
			run(CELA, "dukat-noc-2027-druga", "65");

			run(DANE, "dukat-noc-2028-prva", "60", 100000);
			run(DANE, "dukat-noc-2028-druga", "65");

			db.sql("insert into ducat_award (competitor_id, ducat_id, kind, threshold, reached, period, season,"
							+ " month, tier, won_on) select ?, ducat.id, 'totalKm', 125, 125, 'month', 2028, 2, 1,"
							+ " date '2028-02-10' from ducat where ducat.code = 'duk-mesecni-km'")
					.param(id(HOLDER)).update();
		});
	}

	@AfterEach
	void everythingThisWroteGoes() {
		transactions.executeWithoutResult(any -> {
			db.sql("delete from ducat_award where id > ?").param(awardsBefore).update();
			db.sql("delete from membership where competitor_id in (select id from competitor where member_number"
					+ " in (?, ?, ?, ?, ?))").params(ANA, BOJAN, CELA, DANE, HOLDER).update();
			db.sql("delete from account where email = 'dukat-noc@primer.rs'").update();
			db.sql("delete from competitor where member_number in (?, ?, ?, ?, ?)")
					.params(ANA, BOJAN, CELA, DANE, HOLDER).update();
			db.sql("delete from btl_event where slug like 'dukat-noc-%'").update();
		});
	}

	@Test
	void everyMemberIsReconciledWhateverHisAccountAndHisMembership() {
		aPass().atNight();

		assertThat(codesOf(ANA)).as("a member with an account").containsExactly("duk-mesecni-km");
		assertThat(codesOf(BOJAN)).as("a member with no account").containsExactly("duk-mesecni-km");
		assertThat(codesOf(CELA)).as("a member whose membership ended in 2027").containsExactly("duk-mesecni-km");
		assertThat(db.sql("select season from ducat_award where competitor_id = ?").param(id(CELA))
				.query(Integer.class).single()).as("his ducat is the one of 2027").isEqualTo(2027);
		assertThat(codesOf(DANE)).as("a member with no membership row at all, his permanent ducat")
				.containsExactly("duk-uspon");
		assertThat(codesOf(HOLDER)).as("a member who holds a ducat and has no result any more").isEmpty();
	}

	@Test
	void thePassOfJanuaryOnePassesTheSameWay() {
		aPass().beforeTheFreeze();

		assertThat(codesOf(ANA)).containsExactly("duk-mesecni-km");
		assertThat(codesOf(BOJAN)).containsExactly("duk-mesecni-km");
		assertThat(codesOf(CELA)).containsExactly("duk-mesecni-km");
		assertThat(codesOf(DANE)).containsExactly("duk-uspon");
		assertThat(codesOf(HOLDER)).isEmpty();
	}

	@Test
	void aMemberWhoseReconciliationFailsStopsNobodyAndTheFaultIsLoggedUnderHisKey() {
		long failing = id(ANA);
		Heard heard = heardWhile(() -> aPassThatFailsFor(failing).atNight());

		assertThat(codesOf(ANA)).as("the one that failed").isEmpty();
		assertThat(codesOf(BOJAN)).as("a member after him in the pass").containsExactly("duk-mesecni-km");
		assertThat(codesOf(CELA)).as("another member after him").containsExactly("duk-mesecni-km");
		assertThat(heard.warnings()).as("only the member who failed is told").singleElement().satisfies(said -> {
			assertThat(said.getLevel()).isEqualTo(Level.WARN);
			assertThat(said.getFormattedMessage()).contains("member " + failing + " ")
					.contains("tried again tonight")
					.contains("ducat_award_result_fk")
					.doesNotContain("last pass");
		});
	}

	/**
	 * THE PASS CALLS THE SERVICE WITH NO TRANSACTION OF ITS OWN AROUND THE LOOP: a call nested in a transaction
	 * that holds the member's row waits for it for ever (REQUIRES_NEW, and PostgreSQL does not see it as a
	 * deadlock). Measured at the call site.
	 */
	@Test
	void theServiceIsCalledOutsideAnyTransactionForEveryMember() {
		aPassThatFailsFor(-1).atNight();

		assertThat(inATransaction).hasSize(5).containsOnly(false);
	}

	@Test
	void aFailureInTheLastMemberOfThePassIsLoggedAndTheOnesBeforeHimStand() {
		long failing = id(HOLDER);

		heardWhile(() -> aPassThatFailsFor(failing).atNight());

		assertThat(codesOf(ANA)).containsExactly("duk-mesecni-km");
		assertThat(codesOf(BOJAN)).containsExactly("duk-mesecni-km");
		assertThat(codesOf(CELA)).containsExactly("duk-mesecni-km");
		assertThat(codesOf(DANE)).containsExactly("duk-uspon");
		assertThat(codesOf(HOLDER)).as("the one that failed keeps what he held").containsExactly("duk-mesecni-km");
	}

	@Test
	void thePassBeforeTheFreezeSaysItWasTheLastOneAndWhy() {
		long failing = id(BOJAN);
		Heard heard = heardWhile(() -> aPassThatFailsFor(failing).beforeTheFreeze());

		assertThat(codesOf(ANA)).containsExactly("duk-mesecni-km");
		assertThat(codesOf(CELA)).containsExactly("duk-mesecni-km");
		assertThat(heard.warnings()).singleElement().satisfies(said -> {
			assertThat(said.getLevel()).isEqualTo(Level.WARN);
			assertThat(said.getFormattedMessage()).contains("member " + failing + " ")
					.contains("the last pass before the season freezes at 16:00")
					.contains("the freeze does not reconcile ducats")
					.doesNotContain("tried again tonight");
		});
	}

	@Test
	void aPassWithNoFailureSaysNothingAtWarn() {
		Heard atNight = heardWhile(() -> aPass().atNight());
		Heard beforeTheFreeze = heardWhile(() -> aPass().beforeTheFreeze());

		assertThat(atNight.warnings()).isEmpty();
		assertThat(beforeTheFreeze.warnings()).isEmpty();
	}

	/**
	 * WHAT THE PASS WRITES OF THE HISTORY IS SILENT („Tiho ostaje samo ono što dolazi iz rezultata odobrenih pre
	 * početka dodele”, owner, 12.11.2026): every run of this fixture was written with no moment, so the pass
	 * writes four ducats and sends nothing to anybody.
	 */
	@Test
	void thePassSendsNothingOfTheHistoryWhileItWritesDucats() {
		long messagesBefore = db.sql("select count(*) from message").query(Long.class).single();

		aPass().atNight();
		aPass().beforeTheFreeze();

		assertThat(db.sql("select count(*) from ducat_award where id > ?").param(awardsBefore)
				.query(Long.class).single()).as("the pass wrote, so nothing sent is not nothing done")
				.isGreaterThanOrEqualTo(4);
		assertThat(db.sql("select count(*) from message").query(Long.class).single()).isEqualTo(messagesBefore);
	}

	/**
	 * A DUCAT OF A RESULT APPROVED SINCE THE START, WHICH THE STEP AFTER ITS APPROVAL NEVER WROTE, IS WRITTEN BY
	 * THE PASS AND TOLD AS THAT STEP WOULD HAVE TOLD IT (owner, 12.11.2026: „Kad dukat koji donese rezultat
	 * odobren od sada upiše noćni prolaz (jer je korak posle odobrenja pao), član dobija poruku isto kao da ga
	 * je upisao korak posle odobrenja.”). Four members on the two sides of each axis:
	 * <ul>
	 * <li>BOJAN's run of 10 February, the one that reaches 125 km, was approved at the start of awarding to
	 * the instant: told, in the words of an approval.
	 * <li>ANA's run of 3 February was approved since the start, but it is her run of the 10th, history, that
	 * carried her over: silent. A message tied to any result of hers brought in since the start would tell.
	 * <li>CELA's run of 10 February 2027 carried her over and was approved a second BEFORE the start: silent.
	 * A rule that asked only whether the moment is there would tell.
	 * <li>DANE's climb of 3 February was entered by the league since the start and carried him over to
	 * „Karmanov uspon”: told, in the league's words.
	 * </ul>
	 * And only to them: no message to the whole league and none to anybody else.
	 */
	@Test
	void thePassTellsADucatOfAResultBroughtInSinceTheStartAsTheStepAfterTheApprovalWould() {
		Instant before = AwardingDucats.AWARDING_BEGAN.minusSeconds(1);

		transactions.executeWithoutResult(any -> {
			broughtIn(BOJAN, "dukat-noc-2028-druga", AwardingDucats.AWARDING_BEGAN, "approval");
			broughtIn(ANA, "dukat-noc-2028-prva", AwardingDucats.AWARDING_BEGAN.plusSeconds(60), "approval");
			broughtIn(CELA, "dukat-noc-2027-druga", before, "approval");
			broughtIn(DANE, "dukat-noc-2028-prva", AwardingDucats.AWARDING_BEGAN.plusSeconds(60), "league");
		});
		long lastMessage = db.sql("select coalesce(max(id), 0) from message").query(Long.class).single();

		aPass().atNight();

		assertThat(db.sql("select coalesce(to_id::text, 'the league') || ' | ' || from_name || ' | ' || subject"
						+ " || ' | ' || body from message where id > ? and (to_id is null or to_id in (select id from"
						+ " competitor where member_number in (?, ?, ?, ?, ?))) order by to_id, id")
				.params(lastMessage, ANA, BOJAN, CELA, DANE, HOLDER).query(String.class).list())
				.containsExactly(
						id(BOJAN) + " | Balkanska trkačka liga | Osvojili ste dukat | Odobren vam je rezultat sa trke"
								+ " dukat-noc-2028-druga od 10.02.2028, i njime ste osvojili dukat \"Mesečni"
								+ " kilometri\" za februar 2028. Dukat stoji na vašem profilu.",
						id(DANE) + " | Balkanska trkačka liga | Osvojili ste dukat | Liga vam je unela rezultat sa"
								+ " trke dukat-noc-2028-prva od 03.02.2028, i njime ste osvojili dukat \"Karmanov"
								+ " uspon\". Dukat stoji na vašem profilu.");
		assertThat(codesOf(ANA)).as("Ana was not written her ducat, so her silence says nothing")
				.contains("duk-mesecni-km");
		assertThat(codesOf(CELA)).as("Cela was not written her ducat, so her silence says nothing")
				.contains("duk-mesecni-km");
	}

	/**
	 * TWO CRON TASKS, AT 03:00 EVERY DAY AND AT 15:00 ON 1 JANUARY, BOTH BY THE LEAGUE'S CLOCK, and nothing that
	 * runs at start. Asked of the scheduler the context really built, the way {@code ASeasonFreezesTest} asks it,
	 * and of the trigger and not of its text, so the zone is measured: on a day of summer time 03:00 in Belgrade
	 * is 01:00 UTC.
	 */
	@Test
	void itIsScheduledAtThreeEveryNightAndAtThreeInTheAfternoonOnJanuaryOneAndNeverAtStart() {
		List<ScheduledTask> tasks = schedulers.stream()
				.flatMap(each -> each.getScheduledTasks().stream())
				.distinct()
				.filter(task -> task.getTask().getRunnable().toString()
						.startsWith(DucatsAreReconciledAtNight.class.getName() + "."))
				.toList();

		assertThat(tasks).as("two tasks, and a third would be one that runs at start").hasSize(2)
				.allSatisfy(task -> assertThat(task.getTask()).isInstanceOf(CronTask.class));

		CronTask night = cron(tasks, "atNight");
		CronTask beforeTheFreeze = cron(tasks, "beforeTheFreeze");
		Instant justBeforeThree = LocalDateTime.of(2028, 7, 10, 2, 59).atZone(SeasonClock.ZONE).toInstant();
		Instant justAfterThree = LocalDateTime.of(2028, 7, 10, 3, 1).atZone(SeasonClock.ZONE).toInstant();

		assertThat(night.getTrigger().nextExecution(new SimpleTriggerContext(null, null, justBeforeThree)))
				.isEqualTo(Instant.parse("2028-07-10T01:00:00Z"));
		assertThat(night.getTrigger().nextExecution(new SimpleTriggerContext(null, null, justAfterThree)))
				.isEqualTo(Instant.parse("2028-07-11T01:00:00Z"));

		Instant justBeforeThreePm = LocalDateTime.of(2028, 1, 1, 14, 59).atZone(SeasonClock.ZONE).toInstant();
		Instant justAfterThreePm = LocalDateTime.of(2028, 1, 1, 15, 1).atZone(SeasonClock.ZONE).toInstant();

		assertThat(beforeTheFreeze.getTrigger().nextExecution(new SimpleTriggerContext(null, null,
				justBeforeThreePm))).isEqualTo(Instant.parse("2028-01-01T14:00:00Z"));
		assertThat(beforeTheFreeze.getTrigger().nextExecution(new SimpleTriggerContext(null, null,
				justAfterThreePm))).isEqualTo(Instant.parse("2029-01-01T14:00:00Z"));
	}

	private static CronTask cron(List<ScheduledTask> tasks, String method) {
		String name = DucatsAreReconciledAtNight.class.getName() + "." + method;

		return tasks.stream().map(ScheduledTask::getTask).filter(task -> task.getRunnable().toString().equals(name))
				.map(CronTask.class::cast).findFirst().orElseThrow();
	}

	private DucatsAreReconciledAtNight aPass() {
		return new DucatsAreReconciledAtNight(db, new AwardingDucats(db, THE_NIGHT_OF_THE_PASS, transactions));
	}

	/** The real reconciliation for every member but one, who throws as a database that has gone away would. */
	private final java.util.List<Boolean> inATransaction = new java.util.concurrent.CopyOnWriteArrayList<>();

	private DucatsAreReconciledAtNight aPassThatFailsFor(long member) {
		return new DucatsAreReconciledAtNight(db, new AwardingDucats(db, THE_NIGHT_OF_THE_PASS, transactions) {
			@Override
			List<Won> forMember(long competitorId) {
				inATransaction.add(TransactionSynchronizationManager.isActualTransactionActive());

				if (competitorId == member) {
					throw new DataIntegrityViolationException("violates foreign key constraint ducat_award_result_fk");
				}

				return super.forMember(competitorId);
			}
		});
	}

	private record Heard(List<ILoggingEvent> events) {

		List<ILoggingEvent> warnings() {
			return events.stream().filter(one -> one.getLevel().isGreaterOrEqual(Level.WARN)).toList();
		}
	}

	private static Heard heardWhile(Runnable passing) {
		Logger speaking = (Logger) LoggerFactory.getLogger(DucatsAreReconciledAtNight.class);
		ListAppender<ILoggingEvent> heard = new ListAppender<>();

		heard.start();
		speaking.addAppender(heard);

		try {
			passing.run();

			return new Heard(List.copyOf(heard.list));
		}
		finally {
			speaking.detachAppender(heard);
			heard.stop();
		}
	}

	private List<String> codesOf(String number) {
		return db.sql("select d.code from ducat_award a join ducat d on d.id = a.ducat_id"
						+ " where a.competitor_id = ? order by a.id")
				.param(id(number)).query(String.class).list();
	}

	private long id(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number).query(Long.class).single();
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

	private void membership(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, ?, 'feeExempt', 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(id(number), season).update();
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

	/** The moment and the way his run on the race of {@code slug} came in. */
	private void broughtIn(String number, String slug, Instant at, String by) {
		assertThat(db.sql("update result set brought_at = ?, brought_by = ? where competitor_id = ?"
						+ " and race_id = (select id from race where name = ?)")
				.params(Timestamp.from(at), by, id(number), slug).update()).isEqualTo(1);
	}

	private void run(String number, String slug, String kilometres) {
		run(number, slug, kilometres, 0);
	}

	private void run(String number, String slug, String kilometres, int ascent) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds,"
						+ " points) select ?, race.id, race.date, " + kilometres + ", " + ascent + ", 0, 3000, 1 from race"
						+ " where race.name = ?")
				.params(id(number), slug).update();
	}
}
