package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A LEAGUE SAVE THAT MEETS THE EVENT ANOTHER SAVE MADE TAKES THAT EVENT BEFORE ITS MEMBERS, as every other
 * road of the route does (review of PR 606, round 1, high).
 *
 * <p>{@link ResultsByTheLeagueApi} locks the members a request names ({@code for update}) before it judges
 * a row, and holds an event of the calendar ({@code for no key update}) before it locks them. A save whose
 * event does not exist yet has nothing to hold, so it locks its members, and if its insert then gives way
 * to an event another save made it used to go on to hold that event with the members in its hand. A second
 * save on that event holds it and waits for a member the first has: the first waits for the event, the
 * second for the member, and the database ends the pair with {@code deadlock detected} (the second save
 * answered 500). Now the first is rolled back, which lets its members go, and begun again from the top.
 *
 * <p><b>THE ORDER IS THE CASES' OWN, and none is a barrier.</b> Each holds a row of its own through
 * {@link AHeldTransaction}, so the save under test stands at the lock the case wants it at, the case does
 * the next thing, and only then lets the save on. The save has asked its first question (no event there)
 * and holds its first member before the event is made, which is the only order in which the two meet.
 *
 * <p><b>THE CASES.</b> The deadlock (two saves, a second one on the event the first meets). The hold (the
 * event the first meets is held by a writer of a race that has not committed, as the approval of a
 * member's run holds it, and the first must stand at the event and work its day out from what that writer
 * leaves). The bound (the address is taken again in the second pass too, which is a 500 and not a third
 * pass, forced by a trigger of the case's own that makes the insert give way every time). Not
 * {@code @Transactional}, because the writers are different connections;
 * {@link #andNothingOfItIsLeftBehind} takes the rows out.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TwoLeagueSavesOnANewEventTest {

	/** Distinct from every other fixture's, on purpose: these rows are committed. */
	private static final String THE_FIRST_NUMBER = "001020";

	private static final String THE_SECOND_NUMBER = "001021";

	private static final String THE_MODERATOR = "dva-upisa-na-nov-dogadjaj@primer.rs";

	private static final String THE_NAME = "Dva upisa na nov dogadjaj";

	private static final String THE_ADDRESS = "dva-upisa-na-nov-dogadjaj-2027";

	private static final LocalDate THE_REQUESTS_DAY = LocalDate.parse("2027-05-08");

	private static final LocalDate A_LATER_DAY = LocalDate.parse("2027-05-20");

	private static final LocalDate AN_EARLIER_DAY = LocalDate.parse("2027-05-02");

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		Clock aClockInOctober2027() {
			return Clock.fixed(Instant.parse("2027-10-15T10:00:00Z"), ZoneOffset.UTC);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private DataSource pool;

	/** What the requests threw, by message: an exception out of {@code perform} is the 500 it becomes. */
	private final List<String> thrown = new CopyOnWriteArrayList<>();

	private long first;

	private long second;

	private String cookie;

	@BeforeEach
	void twoMembersAndAModerator() {
		thrown.clear();
		first = member(THE_FIRST_NUMBER, "0011aabbccddee91");
		second = member(THE_SECOND_NUMBER, "0011aabbccddee92");

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Mod', 'Eratorka', ?,"
						+ " (select id from role where code = 'moderator'))")
				.param(THE_MODERATOR).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:results')")
				.param(THE_MODERATOR).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(THE_MODERATOR, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookie = session.secret();
	}

	private long member(String number, String referral) {
		long id = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, active, referral_code, bio,"
						+ " profile_hidden, birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at) values (?, 'Dva', 'Upisa', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, true, ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, referral).query(Long.class).single();

		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, 2027, 'feeExempt', 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.param(id).update();

		return id;
	}

	/** Real commits, so a real delete, children before parents; the trigger of the bound's case first. */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("drop trigger if exists the_address_always_gives_way on btl_event").update();
		db.sql("drop function if exists the_address_always_gives_way()").update();

		for (long member : List.of(first, second)) {
			db.sql("delete from message where to_id = ?").param(member).update();
			db.sql("delete from result where competitor_id = ?").param(member).update();
		}

		db.sql("delete from race where event_id in (select id from btl_event where slug like 'dva-upisa-na-nov-%')")
				.update();
		db.sql("delete from btl_event where slug like 'dva-upisa-na-nov-%'").update();

		for (long member : List.of(first, second)) {
			db.sql("delete from membership where competitor_id = ?").param(member).update();
			db.sql("delete from competitor where id = ?").param(member).update();
		}

		db.sql("delete from account_session where account_id = (select id from account where email = ?)")
				.param(THE_MODERATOR).update();
		db.sql("delete from account_admin_right where account_id = (select id from account where email = ?)")
				.param(THE_MODERATOR).update();
		db.sql("delete from account where email = ?").param(THE_MODERATOR).update();
	}

	/**
	 * A SAVE WHOSE NEW EVENT WAS MADE MEANWHILE, AND A SECOND SAVE ON THAT EVENT: both are written, neither
	 * is a deadlock. The first names two members and stands at the second, whose row the case holds, with
	 * the first in its hand; the event is made and committed meanwhile; the second save finds it at the
	 * top, holds it, and stands at the first's member; then the case lets go, and the first's insert gives
	 * way. If the first went on to hold the event it would wait for the second, which waits for it.
	 */
	@Test
	void aSaveThatMeetsTheEventAnotherSaveMadeDoesNotDeadlockWithASecondSaveOnThatEvent() throws Exception {
		ExecutorService requests = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();
		MockHttpServletResponse theFirstsAnswer;
		MockHttpServletResponse theSecondsAnswer;

		try (AHeldTransaction holdsTheSecondMember = new AHeldTransaction(pool);
				AHeldTransaction theOtherSave = new AHeldTransaction(pool)) {
			holdsTheSecondMember.db().sql("select 1 from competitor where id = ? for update").param(second)
					.query(Integer.class).single();

			assertThat(holdsTheSecondMember.behind()).as("nothing has been sent yet").isZero();

			submitted.add(requests.submit(() -> save("Desetka", "10.00", 3600, THE_FIRST_NUMBER, THE_SECOND_NUMBER)));
			holdsTheSecondMember.untilBehind(1, submitted);

			anEvent(theOtherSave.db(), THE_ADDRESS, THE_NAME, THE_REQUESTS_DAY, "race");
			theOtherSave.commit();

			submitted.add(requests.submit(() -> save("Polumaraton", "21.10", 7200, THE_FIRST_NUMBER)));
			holdsTheSecondMember.untilBehind(2, submitted);

			assertThat(submitted).as("a save was answered before the case let go").noneMatch(Future::isDone);

			holdsTheSecondMember.commit();

			theFirstsAnswer = submitted.get(0).get(60, TimeUnit.SECONDS);
			theSecondsAnswer = submitted.get(1).get(60, TimeUnit.SECONDS);
		} finally {
			requests.shutdownNow();
		}

		assertThat(thrown).as("the database ended a pair of saves").noneMatch(said -> said.contains("deadlock"));
		assertThat(theFirstsAnswer.getStatus()).as("the first save: " + thrown).isEqualTo(201);
		assertThat(theSecondsAnswer.getStatus()).as("the second save: " + thrown).isEqualTo(201);
		assertThat(eventsAt(THE_ADDRESS)).isEqualTo(1);
		assertThat(racesOn(THE_ADDRESS)).as("one race from each save").isEqualTo(2);
		assertThat(resultsOf(first)).as("the first's member is on both races").isEqualTo(2);
		assertThat(resultsOf(second)).isEqualTo(1);
	}

	/**
	 * THE EVENT THE SAVE MEETS IS HELD FOR IT, and what it reads is what another writer left. The event is in
	 * the calendar from before the request, on a day later than the request's, but the save has not asked
	 * yet: it stands at the member the case holds. Another writer then holds the event
	 * ({@code for no key update}) and puts a race a week before the request's day on it, and the case lets
	 * the member go. The save's insert gives way, and the save must stand at the event: only once the writer
	 * has moved the event's day back and committed does it go on, work its day out from the races that are
	 * there, the earlier one among them, and leave the event where it is. An event read plainly does not
	 * stop the save, which sets the request's day over the earlier one, and the schema refuses that (V29).
	 *
	 * <p>The writer moves the day only once the save stands behind it. Moved before, the writer's update of
	 * the row would be what the insert waits for, and the case would pass on the insert alone.
	 */
	@Test
	void theEventASaveMeetsIsHeldAgainstAnEarlierRaceBeingPutOnIt() throws Exception {
		ExecutorService requests = Executors.newFixedThreadPool(1);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();
		MockHttpServletResponse answer;

		try (AHeldTransaction holdsTheMember = new AHeldTransaction(pool);
				AHeldTransaction theApproval = new AHeldTransaction(pool)) {
			holdsTheMember.db().sql("select 1 from competitor where id = ? for update").param(first)
					.query(Integer.class).single();

			submitted.add(requests.submit(() -> save("Desetka", "10.00", 3600, THE_FIRST_NUMBER)));
			holdsTheMember.untilBehind(1, submitted);

			long event = anEvent(db, THE_ADDRESS, THE_NAME, A_LATER_DAY, "race");

			theApproval.db().sql("select 1 from btl_event where id = ? for no key update").param(event)
					.query(Integer.class).single();
			theApproval.db().sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
							+ " distance_km, ascent_m, descent_m) values (?, 'Ranija trka', false, ?,"
							+ " 'length', 0, 10, 0, 0)")
					.params(event, AN_EARLIER_DAY).update();

			assertThat(theApproval.behind()).as("the event is held and the save is not at it yet").isZero();

			holdsTheMember.commit();
			theApproval.untilBehind(1, submitted);

			assertThat(submitted).as("the save was answered before it reached the held event")
					.noneMatch(Future::isDone);

			theApproval.db().sql("update btl_event set date = ? where id = ?").params(AN_EARLIER_DAY, event).update();
			theApproval.commit();

			answer = submitted.get(0).get(60, TimeUnit.SECONDS);
		} finally {
			requests.shutdownNow();
		}

		assertThat(answer.getStatus()).as("what the database said otherwise: " + thrown).isEqualTo(201);
		assertThat(theDayOf(THE_ADDRESS)).as("the event keeps the earlier race's day").isEqualTo(AN_EARLIER_DAY);
		assertThat(racesOn(THE_ADDRESS)).as("the writer's race and the save's").isEqualTo(2);
		assertThat(resultsOf(first)).isEqualTo(1);
	}

	/**
	 * THE SAVE IS BEGUN AGAIN ONCE AND NOT TWICE. A trigger of the case's own makes the insert of an event at
	 * this address give way every time ({@code before insert ... return null}, which {@code on conflict do
	 * nothing} cannot tell from a conflict), so the first pass meets an address that is taken and the
	 * second, from the top, finds no event and meets it taken again. That is a 500 (an event gone under a
	 * save always was), after two passes: begun a third time, and a fourth, it would never answer. The
	 * request is waited for for a minute; nothing of it is left behind.
	 */
	@Test
	void anAddressTakenAgainInTheSecondPassIsAnErrorAndNotAThirdPass() throws Exception {
		db.sql("create function the_address_always_gives_way() returns trigger language plpgsql as $f$ begin"
				+ " if new.slug = '" + THE_ADDRESS + "' then return null; end if; return new; end $f$").update();
		db.sql("create trigger the_address_always_gives_way before insert on btl_event"
				+ " for each row execute function the_address_always_gives_way()").update();

		ExecutorService requests = Executors.newFixedThreadPool(1);
		MockHttpServletResponse answer;

		try {
			Future<MockHttpServletResponse> save = requests.submit(
					() -> save("Desetka", "10.00", 3600, THE_FIRST_NUMBER));

			try {
				answer = save.get(60, TimeUnit.SECONDS);
			} finally {
				/* The loop of a save that never stops ends here: with the trigger gone the insert succeeds. */
				db.sql("drop trigger if exists the_address_always_gives_way on btl_event").update();
			}
		} finally {
			requests.shutdownNow();
		}

		assertThat(answer.getStatus()).isEqualTo(500);
		assertThat(thrown).as("what the save threw").singleElement()
				.asString().contains("taken twice in one save");
		assertThat(eventsAt(THE_ADDRESS)).isZero();
		assertThat(resultsOf(first)).isZero();
	}

	/** The save, as a real server would answer it: an exception out of {@code perform} is the 500 it becomes. */
	private MockHttpServletResponse save(String raceName, String km, int seconds, String... members) {
		StringBuilder rows = new StringBuilder();

		for (String member : members) {
			rows.append(rows.isEmpty() ? "" : ",").append("{\"memberNumber\":\"").append(member)
					.append("\",\"seconds\":").append(seconds).append('}');
		}

		String body = "{\"event\":{\"name\":\"" + THE_NAME + "\",\"date\":\"" + THE_REQUESTS_DAY
				+ "\",\"city\":\"Ohrid\",\"country\":\"MK\"},\"race\":{\"name\":\"" + raceName + "\","
				+ "\"kind\":\"length\",\"distanceKm\":" + km + ",\"ascentM\":50,\"descentM\":40,"
				+ "\"limitSeconds\":null},\"rows\":[" + rows + "]}";

		try {
			return http.perform(post("/api/results/on-a-race-of-an-event").with(csrf())
							.contentType(MediaType.APPLICATION_JSON).content(body)
							.cookie(new Cookie(SessionCookie.NAME, cookie)))
					.andReturn().getResponse();
		} catch (Exception failure) {
			thrown.add(failure.toString());

			MockHttpServletResponse serverFault = new MockHttpServletResponse();

			serverFault.setStatus(500);

			return serverFault;
		}
	}

	private static long anEvent(JdbcClient by, String address, String name, LocalDate day, String kind) {
		return by.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values (?, ?, ?, (select id from place where rank = 1), ?, false, '', '')"
						+ " returning id")
				.params(address, name, day, kind).query(Long.class).single();
	}

	private LocalDate theDayOf(String address) {
		return db.sql("select date from btl_event where slug = ?").param(address)
				.query((row, one) -> row.getDate(1).toLocalDate()).single();
	}

	private int eventsAt(String address) {
		return db.sql("select count(*) from btl_event where slug = ?").param(address)
				.query(Integer.class).single();
	}

	private int racesOn(String address) {
		return db.sql("select count(*) from race where event_id = (select id from btl_event where slug = ?)")
				.param(address).query(Integer.class).single();
	}

	private int resultsOf(long member) {
		return db.sql("select count(*) from result where competitor_id = ?").param(member)
				.query(Integer.class).single();
	}
}
