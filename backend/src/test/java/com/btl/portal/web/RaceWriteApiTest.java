package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.event.WhatARaceCarries;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * PUTTING A RACE UNDER AN EVENT, CHANGING IT AND TAKING IT OUT, END TO END.
 *
 * <p><b>Authorisation itself is not measured here.</b> {@code RightsAtTheDoorTest} asks it
 * of EVERY route carrying {@link RightIsNeeded}, by its own METHOD, which is what makes it
 * reach a {@code POST} sharing a path with the open calendar. One case here holds the same
 * thing for defence in depth, and the rest of this file measures what is this resource's
 * own.
 *
 * <p><b>Nor is the cascade.</b> V7, V10 and V19 carry it and
 * {@code CompetitorEventRaceAndResultTest} measures the chain against the schema. What is
 * measured here is that the ROUTE deleted the race it was asked about and not another,
 * which is a different sentence and one the schema cannot make.
 *
 * <p><b>THE FIXTURE IS BUILT AROUND ONE TRAP, and it is the trap this whole increment
 * lives in: {@code btl_event.date} and {@code min(race.date)} are two homes of one
 * fact.</b> A case that lets them hold the same value measures nothing, because a server
 * answering with the race's own day and one working out the earliest of all of them are
 * then the same server. So:
 *
 * <ul>
 * <li><b>The event acted on has THREE races</b>, on three different mornings, and the one
 * acted on by default is the MIDDLE one - so "this race", "the first race" and "the last
 * race" are three different answers.
 * <li><b>Its stored address is {@code drugi-2027} and its name is „Drugi maraton"</b>,
 * which do not build each other. A server that rebuilt the address whenever anything moved
 * would answer {@code drugi-maraton-2027} and fail, and the owner's rule that an event
 * moved inside its season keeps its address would be broken without a single value looking
 * wrong.
 * <li><b>One event's stored day deliberately disagrees with its only race</b>
 * ({@code cetvrti-2027}, filed on 01.10 and running on 20.10), which is a row from before
 * this route existed. It is the only shape in which "the event keeps the day it has" and
 * "the event takes the day of the race just deleted" are different answers.
 * <li><b>Two events are never acted on at all</b>, one of them written FIRST, so "the
 * event it was given" and "the first event" differ; and a race of another event never
 * moves, so "its races" and "the races" differ.
 * <li><b>A result on the acted event's race and one on another event's</b>, so a move that
 * carried the wrong ones shows.
 * <li><b>Two moderators</b>, each holding the tick the other is refused.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class RaceWriteApiTest {

	private static final String MODERATOR = "kalendar@primer.rs";

	private static final String ANOTHER_MODERATOR = "timovi@primer.rs";

	private static final String A_TOWN = "(select id from place where rank = 1)";

	/** The day the event every case acts on begins on, which is the day of its first race. */
	private static final LocalDate ITS_DAY = LocalDate.parse("2027-06-02");

	/** Its middle race, so "this race" is neither the first nor the last of them. */
	private static final LocalDate THE_MIDDLE_DAY = ITS_DAY.plusDays(1);

	private static final LocalDate THE_LAST_DAY = ITS_DAY.plusDays(2);

	/** The address it answers at, which no rule here would build out of its name. */
	private static final String ITS_ADDRESS = "drugi-2027";

	/**
	 * A name no event and no race in the fixture carries.
	 *
	 * <p>So that an edit which does not say what the race is called cannot read the same as
	 * one that left the name alone, nor as one that took its event's.
	 */
	private static final String A_NAME_OF_ITS_OWN = "Trka pod svojim imenom";

	/**
	 * THE THREE FIELDS AN EDIT MAY LEAVE OUT, and every other component of
	 * {@link RaceWriteApi.Upsert} is one it must send.
	 *
	 * <p>Written as the exceptions rather than as the list of what is required, which is
	 * what lets {@link #everyFieldAnEditMustSend} derive the rest off the record: a field
	 * added to the form tomorrow is required the day it is added instead of being the one
	 * nobody remembered.
	 *
	 * <p><b>Each of the three is an older decision and not an exception to A54.</b>
	 * {@code eventId} is not asked for by this form at all - the event is the page the form
	 * opens under (owner, 11.08.2026) - and naming a DIFFERENT one has its own refusal.
	 * {@code limitSeconds} and {@code distanceKm} are tied to the kind by a biconditional
	 * in V7, so each is sent exactly when its kind calls for it and refused when it is not;
	 * demanding them here would refuse every race of a length for carrying no time limit.
	 */
	private static final Set<String> AN_EDIT_NEED_NOT_SEND =
			Set.of("eventId", "limitSeconds", "distanceKm");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private String session;

	/** A moderator who holds a tick, just not this one. */
	private String anotherSession;

	private long acted;

	private long another;

	/** The row whose stored day does not agree with its races, from before this route. */
	private long adrift;

	private long theMiddleRace;

	/**
	 * FOUR EVENTS, SEVEN RACES OVER ALL OF THEM, AND TWO MODERATORS.
	 *
	 * <p>The event every case acts on is written SECOND, so a route reading the first row
	 * it finds, or the lowest key, answers differently from one reading the key it was
	 * given.
	 */
	@BeforeEach
	void aCalendarWithMoreThanOneOfEverything() {
		event("prvi-2027", "Prvi maraton", "2027-03-01");
		acted = event(ITS_ADDRESS, "Drugi maraton", ITS_DAY.toString());
		another = event("treci-2027", "Treci maraton", "2027-09-03");
		adrift = event("cetvrti-2027", "Cetvrti maraton", "2027-10-01");

		race("prvi-2027", "Prva jutarnja", "2027-03-01");
		race("prvi-2027", "Prva popodnevna", "2027-03-02");

		race(ITS_ADDRESS, "Duga", ITS_DAY.toString());
		race(ITS_ADDRESS, "Srednja", THE_MIDDLE_DAY.toString());
		race(ITS_ADDRESS, "Kratka", THE_LAST_DAY.toString());

		race("treci-2027", "Tudja", "2027-09-03");
		race("cetvrti-2027", "Usamljena", "2027-10-20");

		theMiddleRace = raceCalled("Srednja");

		long runner = competitor("000901", "0011223344556601");
		result(runner, raceCalled("Duga"));
		result(runner, raceCalled("Tudja"));

		session = account(MODERATOR, "moderator");
		anotherSession = account(ANOTHER_MODERATOR, "moderator");

		ticked(MODERATOR, "entity:events");
		ticked(ANOTHER_MODERATOR, "entity:teams");
	}

	private long event(String slug, String name, String day) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, date '" + day + "', " + A_TOWN
						+ ", null, null, 'race', false, '', '') returning id")
				.params(slug, name).query(Long.class).single();
	}

	private void race(String eventSlug, String name, String day) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false, date '"
						+ day + "', 'length', 0, 10.00, 0, 0)")
				.params(eventSlug, name).update();
	}

	private long raceCalled(String name) {
		return db.sql("select id from race where name = ?").param(name).query(Long.class).single();
	}

	private long competitor(String number, String referral) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Trkac', 'M', date '1990-01-01', " + A_TOWN
						+ ", 2027, false, true, 'payment', ?, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, referral).query(Long.class).single();
	}

	/** The day comes off the race, which is what the composite key demands. */
	private void result(long competitor, long race) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " select ?, id, date, 10.00, 100, 100, 3600, 12.34 from race where id = ?")
				.params(competitor, race).update();
	}

	/** A league of 2027 counting one race, which is what V19's composite key is about. */
	private void countedByALeagueOf(int season, long race) {
		long league = db.sql("insert into league (slug, name, season, rules, prizes)"
						+ " values ('liga-" + season + "', 'Liga', " + season + ", '', '')"
						+ " returning id")
				.query(Long.class).single();

		db.sql("insert into league_race (league_id, season, race_id) values (?, " + season + ", ?)")
				.params(league, race).update();
	}

	private String account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
						+ " 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

		SecretToken token = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, token.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return token.secret();
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	/** The same write with no cookie at all, which is not the same as a cookie with nothing
	 *  in it: the second is a state no browser and no container can produce. */
	private MockHttpServletResponse addWithNobodyAsking(Form typed) throws Exception {
		return http.perform(post("/api/races").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(json(typed)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse add(Form typed, String cookie) throws Exception {
		return http.perform(post("/api/races").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(json(typed))
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse add(Form typed) throws Exception {
		return add(typed, session);
	}

	private MockHttpServletResponse change(long id, Form typed) throws Exception {
		return http.perform(put("/api/races/" + id).with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(json(typed))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse remove(long id, String cookie) throws Exception {
		return http.perform(delete("/api/races/" + id).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse remove(long id) throws Exception {
		return remove(id, session);
	}

	private String json(Form typed) {
		return new ObjectMapper().writeValueAsString(typed);
	}

	/**
	 * A FORM UNDER CONSTRUCTION, and it lives here rather than on
	 * {@link RaceWriteApi.Upsert} on purpose - the same choice {@code EventWriteApiTest}
	 * made and for the same reason. The withers exist so a case can say what it changes and
	 * stay silent about the eight fields it does not; nothing in production ever calls one,
	 * and put on the request record itself they would be methods the portal never uses,
	 * sitting in the class a reader opens to learn what a race carries.
	 */
	private record Form(Long eventId, String name, Boolean renamed, LocalDate date, String kind,
			Integer limitSeconds, BigDecimal distanceKm, Integer ascentM, Integer descentM) {

		Form under(Long event) {
			return new Form(event, name, renamed, date, kind, limitSeconds, distanceKm, ascentM,
					descentM);
		}

		Form called(String what, Boolean byHand) {
			return new Form(eventId, what, byHand, date, kind, limitSeconds, distanceKm, ascentM,
					descentM);
		}

		Form on(LocalDate day) {
			return new Form(eventId, name, renamed, day, kind, limitSeconds, distanceKm, ascentM,
					descentM);
		}

		/** The kind and the two measures together, because which one belongs is the kind's
		 *  to say: set apart, every case would have to unset the other by hand. */
		Form ofKind(String asked, Integer seconds, String km) {
			return new Form(eventId, name, renamed, date, asked, seconds,
					km == null ? null : new BigDecimal(km), ascentM, descentM);
		}

		Form withProfile(Integer climb, Integer fall) {
			return new Form(eventId, name, renamed, date, kind, limitSeconds, distanceKm, climb,
					fall);
		}

		/**
		 * THE SAME FORM WITH ONE FIELD EMPTIED, named as the JSON names it.
		 *
		 * <p>Not "sent empty" in the sense of blank text: the component is null, and
		 * {@code null} is what {@link RaceWriteApi.Upsert} then holds, which is the state
		 * ADL A54 is about.
		 *
		 * <p><b>What this actually puts on the wire is a key with a null value, and that
		 * is worth saying because this javadoc said the opposite until 19.09.2026.</b> A
		 * record with a null component serialises to {@code "date": null}, NOT to an
		 * object without the key: Jackson's default inclusion is ALWAYS. The two bodies
		 * are different bytes that the route today reads the same way, and
		 * {@link #anEditThatOmitsTheKeyEntirelyIsRefusedTheSameWay} is what holds them
		 * equal - without it a {@code Nulls.SKIP} or a default on the record would part
		 * them without a single case failing.
		 *
		 * <p><b>The default is the floor's teeth.</b> The names come from
		 * {@link #everyFieldAnEditMustSend}, which reads them off
		 * {@link RaceWriteApi.Upsert}; a field added to that record and not added here
		 * stops the case rather than passing it quietly.
		 */
		Form without(String field) {
			return switch (field) {
				case "name" -> new Form(eventId, null, renamed, date, kind, limitSeconds,
						distanceKm, ascentM, descentM);
				case "renamed" -> new Form(eventId, name, null, date, kind, limitSeconds,
						distanceKm, ascentM, descentM);
				case "date" -> new Form(eventId, name, renamed, null, kind, limitSeconds,
						distanceKm, ascentM, descentM);
				case "kind" -> new Form(eventId, name, renamed, date, null, limitSeconds,
						distanceKm, ascentM, descentM);
				case "ascentM" -> new Form(eventId, name, renamed, date, kind, limitSeconds,
						distanceKm, null, descentM);
				case "descentM" -> new Form(eventId, name, renamed, date, kind, limitSeconds,
						distanceKm, ascentM, null);
				default -> throw new IllegalArgumentException(
						"the form has a field this case cannot leave out: " + field);
			};
		}
	}

	/** A race of a length under the event every case acts on, which each case then spoils. */
	private Form aForm() {
		return new Form(acted, null, null, null, null, null, new BigDecimal("10.00"), null, null);
	}

	/**
	 * WHAT AN EDIT SENDS, WHICH IS EVERY FIELD THE FORM HAS.
	 *
	 * <p>Since ADL A54 (owner, 19.09.2026) a {@code PUT} that leaves a field out is refused
	 * rather than filled in with an entry default, so an edit that means to change one
	 * thing still carries the other eight. A case then says the one field it is about and
	 * stays silent about the rest, exactly as {@link #aForm} lets a write do.
	 *
	 * <p><b>The name and the day are not the event's, and that is the whole reason they are
	 * written out here.</b> The event „Drugi maraton" begins on {@link #ITS_DAY} and the
	 * defaults this route used to apply were the event's name and the event's day. A case
	 * built on a race that already carried those two could not tell "the field was
	 * required" from "the field was filled in with the default", because both leave the
	 * same row behind. {@link #theMiddleRace} runs on {@link #THE_MIDDLE_DAY} and is called
	 * „Srednja", and this form carries a third name again, so the three answers stay apart.
	 */
	private Form anEdit() {
		return new Form(acted, A_NAME_OF_ITS_OWN, true, THE_MIDDLE_DAY,
				WhatARaceCarries.OF_A_LENGTH, null, new BigDecimal("10.00"), 0, 0);
	}

	private String slugOf(long event) {
		return db.sql("select slug from btl_event where id = ?").param(event)
				.query(String.class).single();
	}

	private String dayOf(long event) {
		return db.sql("select to_char(date, 'YYYY-MM-DD') from btl_event where id = ?")
				.param(event).query(String.class).single();
	}

	private List<String> daysOfRacesOn(long event) {
		return db.sql("select to_char(date, 'YYYY-MM-DD') from race where event_id = ?"
				+ " order by date, id").param(event).query(String.class).list();
	}

	private List<String> namesOfRacesOn(long event) {
		return db.sql("select name from race where event_id = ? order by date, id").param(event)
				.query(String.class).list();
	}

	private String dayOfResultOn(String raceName) {
		return db.sql("select to_char(r.race_date, 'YYYY-MM-DD') from result r"
						+ " join race ra on ra.id = r.race_id where ra.name = ?")
				.param(raceName).query(String.class).single();
	}

	private long howManyRaces() {
		return db.sql("select count(*) from race").query(Long.class).single();
	}

	private long howManyResults() {
		return db.sql("select count(*) from result").query(Long.class).single();
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("reason").asString();
	}

	/** The fields the refusal says were missing, which is A54's „kaze se sta fali". */
	private List<String> missingIn(MockHttpServletResponse answer) throws Exception {
		List<String> named = new ArrayList<>();

		for (JsonNode field : new ObjectMapper().readTree(answer.getContentAsString())
				.path("missing")) {
			named.add(field.asString());
		}

		return named;
	}

	private long writtenId(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("id").asLong();
	}

	private String answeredDay(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("eventDate")
				.asString();
	}

	private String answeredAddress(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("eventSlug")
				.asString();
	}

	/**
	 * A RACE IS WRITTEN UNDER THE EVENT IT WAS AIMED AT, WITH EVERY DEFAULT THE OWNER
	 * DECIDED.
	 *
	 * <p>Three defaults in one row, each the owner's own: the name is the EVENT'S (owner,
	 * 23.08.2026, „po default-u naziv dogadjaja"), the day is the event's („svaka trka nosi
	 * svoj dan, koji podrazumevano ostaje dan dogadjaja", 10.08.2026) and the kind is a
	 * race of a length, which is what the table that enters one opens on.
	 *
	 * <p>The name is asked for as a whole word rather than as "not empty": the event acted
	 * on is not the first written and its races are called something else entirely, so a
	 * server naming a race after the wrong event, or after the race beside it, answers
	 * differently.
	 */
	@Test
	void aRaceTakesItsEventsNameAndDayAndIsARaceOfALength() throws Exception {
		MockHttpServletResponse answer = add(aForm());

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(db.sql("select name, to_char(date, 'YYYY-MM-DD'), kind, renamed from race"
						+ " where id = ?").param(writtenId(answer))
				.query((row, one) -> List.of(row.getString(1), row.getString(2), row.getString(3),
						String.valueOf(row.getBoolean(4)))).single())
				.as("a race entered with nothing but a length did not take its event's name, its"
						+ " event's day, or the kind the portal enters one as")
				.containsExactly("Drugi maraton", ITS_DAY.toString(), "length", "false");
	}

	/**
	 * AND A NAME GIVEN BY HAND IS KEPT, AS IS THE FACT THAT IT WAS.
	 *
	 * <p>Owner, 23.08.2026: a race that still carries the default name follows its event
	 * when the event is renamed, one renamed by hand keeps what it was given, „a ne poredi
	 * se sa nazivom dogadjaja: poredjenje pogresi za trku u koju je neko namerno otkucao
	 * isti naziv". So the two are separate facts and the second row here is exactly the
	 * case that sentence is about: the name typed IS the event's, and {@code renamed} still
	 * has to come back true.
	 */
	@ParameterizedTest
	@CsvSource({"Duga staza, true", "Duga staza, false", "Drugi maraton, true"})
	void aNameGivenByHandIsKeptAndSoIsTheFactThatItWas(String typed, boolean byHand)
			throws Exception {

		MockHttpServletResponse answer = add(aForm().called(typed, byHand));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(db.sql("select name, renamed from race where id = ?").param(writtenId(answer))
				.query((row, one) -> List.of(row.getString(1), String.valueOf(row.getBoolean(2))))
				.single())
				.as("the race was written with a name or a renaming other than the one sent")
				.containsExactly(typed, String.valueOf(byHand));
	}

	/**
	 * A RACE ENTERED ON AN EARLIER MORNING MOVES THE DAY ITS EVENT BEGINS ON.
	 *
	 * <p>Owner, 10.08.2026: „Trka uneta ili pomerena na raniji dan ne pravi gresku:
	 * dogadjaj tog trenutka pocinje ranije i njegov datum je taj dan."
	 *
	 * <p>Asked of the ROW and not only of the answer, which are two places a wrong answer
	 * could come from: a server that tells the administrator the event moved while writing
	 * something else leaves every screen reading the old day and says it went well.
	 */
	@Test
	void aRaceEnteredOnAnEarlierMorningMovesTheDayItsEventBeginsOn() throws Exception {
		LocalDate earlier = ITS_DAY.minusDays(5);

		MockHttpServletResponse answer = add(aForm().on(earlier));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(answeredDay(answer)).isEqualTo(earlier.toString());
		assertThat(dayOf(acted))
				.as("the event was told it now begins earlier and the row says otherwise")
				.isEqualTo(earlier.toString());
	}

	/**
	 * AND ONE ENTERED ON A LATER MORNING LEAVES IT WHERE IT IS.
	 *
	 * <p>The other direction of the same rule, and the half that separates "the earliest of
	 * them" from "the day of the race that was just written": the event goes on beginning
	 * on the day of a race this request never touched.
	 */
	@Test
	void aRaceEnteredOnALaterMorningLeavesTheEventWhereItBegan() throws Exception {
		LocalDate later = THE_LAST_DAY.plusDays(4);

		MockHttpServletResponse answer = add(aForm().on(later));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(answeredDay(answer))
				.as("the event was moved onto the day of the race just entered")
				.isEqualTo(ITS_DAY.toString());
		assertThat(dayOf(acted)).isEqualTo(ITS_DAY.toString());
	}

	/**
	 * AND ONE ENTERED UNDER AN EVENT THAT HAS NO RACE YET SETTLES THE DAY ON ITS OWN.
	 *
	 * <p>The branch where there is no earliest race to be earlier than. The event used is
	 * the one whose stored day does not agree with anything, so „the event's own day" and
	 * „the day of the race just entered" are two different answers - and the race is
	 * entered on a THIRD day again, so neither of them can pass by accident.
	 */
	@Test
	void aRaceUnderAnEventWithNoRaceYetSettlesTheDayOnItsOwn() throws Exception {
		assertThat(remove(raceCalled("Usamljena")).getStatus()).isEqualTo(204);

		LocalDate itsOwn = LocalDate.parse("2027-11-11");
		MockHttpServletResponse answer = add(aForm().under(adrift).on(itsOwn));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(answeredDay(answer)).isEqualTo(itsOwn.toString());
		assertThat(dayOf(adrift))
				.as("an event with no race until now did not take the day of the first one")
				.isEqualTo(itsOwn.toString());
	}

	/**
	 * MOVING THE FIRST RACE AWAY MOVES THE EVENT ONTO THE ONE THAT IS NOW FIRST.
	 *
	 * <p>This is the case the whole increment turns on, and the one an event with a single
	 * race could not make: the race is moved to 10.06 and the event must land on 03.06,
	 * which is the day of a race this request never touched. Three answers are separated at
	 * once - the day sent (10.06), the day the event had (02.06) and the right one (03.06).
	 *
	 * <p>The other event's races are asked for too, because a server that recomputed every
	 * event would satisfy the first half on its own.
	 */
	@Test
	void movingTheFirstRaceAwayMovesTheEventOntoTheOneThatIsNowFirst() throws Exception {
		MockHttpServletResponse answer =
				change(raceCalled("Duga"), anEdit().on(THE_LAST_DAY.plusDays(6)));

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(answeredDay(answer))
				.as("the event was left on a morning nothing runs on, or moved onto the day the"
						+ " request sent")
				.isEqualTo(THE_MIDDLE_DAY.toString());
		assertThat(dayOf(acted)).isEqualTo(THE_MIDDLE_DAY.toString());

		assertThat(daysOfRacesOn(acted))
				.as("the race did not move, or another one moved with it")
				.containsExactly("2027-06-03", "2027-06-04", "2027-06-10");

		assertThat(dayOf(another))
				.as("another event's day moved as well, so what was recomputed was every event")
				.isEqualTo("2027-09-03");
		assertThat(daysOfRacesOn(another)).containsExactly("2027-09-03");
	}

	/** AND MOVING ONE ONTO AN EARLIER MORNING MOVES THE EVENT BACK WITH IT. */
	@Test
	void movingARaceOntoAnEarlierMorningMovesTheEventBackWithIt() throws Exception {
		LocalDate earlier = ITS_DAY.minusDays(9);

		assertThat(change(theMiddleRace, anEdit().on(earlier)).getStatus()).isEqualTo(200);

		assertThat(dayOf(acted))
				.as("a race moved before every other one left its event beginning after it")
				.isEqualTo(earlier.toString());
	}

	/**
	 * AND MOVING ONE THAT IS NEITHER FIRST NOR LAST WITHIN THE EVENT MOVES NOTHING ELSE.
	 *
	 * <p>The branch nothing else reaches: there is an earliest race, it is not this one,
	 * and it does not change. A server that wrote the day it was sent would move the event
	 * to 05.06 here.
	 */
	@Test
	void movingAMiddleRaceInsideTheEventLeavesTheDayAlone() throws Exception {
		assertThat(change(theMiddleRace, anEdit().on(THE_LAST_DAY.plusDays(1))).getStatus())
				.isEqualTo(200);

		assertThat(dayOf(acted))
				.as("the event followed a race that was never its first")
				.isEqualTo(ITS_DAY.toString());
	}

	/**
	 * A RACE CHANGED IS WRITTEN AS IT WAS SENT, ALL OF IT.
	 *
	 * <p>Every column the route writes, in one case, because they are written by one
	 * statement: a case that changed one field would leave the other seven unmeasured, and
	 * the kind decides which of the two measures is even allowed. The race is turned from
	 * one of a length into a timed one, which is the change that moves the most at once.
	 */
	@Test
	void aRaceChangedIsWrittenAsItWasSent() throws Exception {
		MockHttpServletResponse answer = change(theMiddleRace, anEdit()
				.called("Sest sati", true)
				.on(THE_MIDDLE_DAY)
				.ofKind("time", 21600, null)
				.withProfile(350, 410));

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(db.sql("select name, renamed, kind, limit_seconds, distance_km, ascent_m,"
						+ " descent_m, category from race where id = ?").param(theMiddleRace)
				.query((row, one) -> List.of(row.getString(1), String.valueOf(row.getBoolean(2)),
						row.getString(3), String.valueOf(row.getInt(4)),
						row.getBigDecimal(5).toPlainString(), String.valueOf(row.getInt(6)),
						String.valueOf(row.getInt(7)), row.getString(8))).single())
				.as("a race turned into a timed one did not come back one, or kept the length it"
						+ " no longer runs to")
				/* Nought at the column's own scale, four decimals since V25. */
				.containsExactly("Sest sati", "true", "time", "21600", "0.0000", "350", "410",
						"short");
	}

	/**
	 * AND THE RESULTS TRAVEL WITH THE RACE THEY WERE RUN AT.
	 *
	 * <p>{@code result_race_fk} is {@code on update cascade} over
	 * {@code (race_id, race_date)}, so the database rewrites the day on every result the
	 * moment a race moves. Measured because the alternative is not a wrong day but a
	 * refused update: the reference would be violated and an administrator would meet a
	 * 500.
	 *
	 * <p>The result on the OTHER event's race is read too, and it is the half that makes
	 * this about the right rows: a cascade that moved every result would satisfy the first
	 * assertion on its own.
	 */
	@Test
	void theResultsTravelWithTheRaceTheyWereRunAt() throws Exception {
		assertThat(change(raceCalled("Duga"),
				anEdit().called("Duga", true).on(ITS_DAY.plusDays(20))).getStatus())
				.isEqualTo(200);

		assertThat(dayOfResultOn("Duga"))
				.as("a result stayed on the morning its race no longer runs on")
				.isEqualTo("2027-06-22");

		assertThat(dayOfResultOn("Tudja"))
				.as("a result on another event's race moved as well")
				.isEqualTo("2027-09-03");
	}

	/**
	 * A RACE THAT MOVES ITS EVENT INTO ANOTHER YEAR MOVES THE EVENT'S ADDRESS WITH IT.
	 *
	 * <p>Owner, 10.08.2026: „Adresa dogadjaja je naziv i godina." The portal's own screen
	 * measured this on 23.08.2026 and the words there are the reason it is here: an event
	 * filed through a race onto 30.12.2026 went on answering at an address saying 2027, and
	 * „a copy made from it would have gone on carrying it".
	 *
	 * <p>The event's stored address is {@code drugi-2027} and its name is „Drugi maraton",
	 * which do not build each other - so the address that comes back is the one the RULE
	 * built out of the new year and cannot be the old one with a digit changed.
	 */
	@Test
	void aRaceThatTakesItsEventIntoAnotherYearTakesTheAddressToo() throws Exception {
		MockHttpServletResponse answer =
				change(raceCalled("Duga"), anEdit().on(LocalDate.parse("2026-12-30")));

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(answeredAddress(answer))
				.as("the event began in 2026 and went on answering at an address saying otherwise")
				.isEqualTo("drugi-maraton-2026");
		assertThat(slugOf(acted))
				.as("the answer said the address moved and the row says otherwise")
				.isEqualTo("drugi-maraton-2026");
	}

	/**
	 * AND ONE THAT MOVES IT INSIDE ITS YEAR LEAVES THE ADDRESS EXACTLY AS IT WAS.
	 *
	 * <p>Owner, 10.08.2026: an event moved inside its season keeps its address and with it
	 * everything joined to it. The address it keeps is {@code drugi-2027}, which is NOT
	 * what the rule would build from „Drugi maraton" - so a server that rebuilt the address
	 * on every write would answer {@code drugi-maraton-2027} and be caught, and the
	 * imported addresses carrying a month would be rewritten the same way.
	 */
	@Test
	void aRaceMovedInsideTheYearLeavesTheEventsAddressAlone() throws Exception {
		MockHttpServletResponse answer =
				change(raceCalled("Duga"), anEdit().on(LocalDate.parse("2027-01-20")));

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(answeredAddress(answer)).isEqualTo(ITS_ADDRESS);
		assertThat(slugOf(acted))
				.as("an event moved inside its season was given a new address, and everything"
						+ " joined to the old one is now joined to nothing")
				.isEqualTo(ITS_ADDRESS);
		assertThat(dayOf(acted)).isEqualTo("2027-01-20");
	}

	/**
	 * AND AN ADDRESS ANOTHER EVENT ALREADY ANSWERS AT REFUSES THE WRITE, WHICH IS NOT
	 * WRITTEN AT ALL.
	 *
	 * <p>The portal's own screen measured the same thing on 23.08.2026, „refuses the
	 * address it would write, not the one on the form": an event of 2027 moved through a
	 * race onto 2025 was filed at an address the event of 2025 already answered at, and „a
	 * result finds its event by the address".
	 *
	 * <p>Asked of all three routes, because each builds the address in its own line and a
	 * hole in one of them is a hole. The race day, the event day and the address are all
	 * read back afterwards: a refusal that had already written half of itself would answer
	 * 409 and leave the calendar changed.
	 */
	@ParameterizedTest
	@CsvSource({"add", "change"})
	void anEventMovedOntoATakenAddressIsRefusedAndNothingIsWritten(String how) throws Exception {
		event("drugi-maraton-2026", "Vec zauzeto", "2026-05-05");

		List<String> daysBefore = daysOfRacesOn(acted);
		long racesBefore = howManyRaces();

		MockHttpServletResponse answer = how.equals("add")
				? add(aForm().on(LocalDate.parse("2026-12-30")))
				: change(raceCalled("Duga"), anEdit().on(LocalDate.parse("2026-12-30")));

		assertThat(answer.getStatus())
				.as("%s moved an event onto an address another event already answers at", how)
				.isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(RaceWriteApi.THE_ADDRESS_IS_TAKEN);

		assertThat(slugOf(acted))
				.as("%s was refused and the address changed anyway", how)
				.isEqualTo(ITS_ADDRESS);
		assertThat(dayOf(acted))
				.as("%s was refused and the event moved anyway", how)
				.isEqualTo(ITS_DAY.toString());
		assertThat(daysOfRacesOn(acted))
				.as("%s was refused and the calendar changed anyway", how)
				.isEqualTo(daysBefore);
		assertThat(howManyRaces())
				.as("%s was refused and a race appeared or disappeared", how)
				.isEqualTo(racesBefore);
	}

	/**
	 * AND SO IS A DELETE, which reaches that refusal from the other end.
	 *
	 * <p>Its own case because the state it needs is the mirror image: the event has to be
	 * standing in 2026 already, so that taking away the race that holds it there is what
	 * pushes its address into 2027. The event is put there THROUGH THIS ROUTE rather than
	 * by a fixture, so the starting state is one the portal itself can reach.
	 *
	 * <p>Without this case the delete could build the address any way at all, or not at
	 * all, and nothing would say so: it is the only one of the three routes whose answer
	 * carries neither a day nor an address.
	 */
	@Test
	void aDeleteThatWouldMoveTheEventOntoATakenAddressIsRefusedToo() throws Exception {
		assertThat(add(aForm().called("Zimska", true).on(LocalDate.parse("2026-12-30")))
				.getStatus()).isEqualTo(201);
		assertThat(dayOf(acted)).isEqualTo("2026-12-30");
		assertThat(slugOf(acted))
				.as("the walk starts from an address that is not the one the collision is about")
				.isEqualTo("drugi-maraton-2026");

		event("drugi-maraton-2027", "Vec zauzeto", "2027-05-05");

		long racesBefore = howManyRaces();
		MockHttpServletResponse answer = remove(raceCalled("Zimska"));

		assertThat(answer.getStatus())
				.as("deleting a race moved its event onto an address another event answers at")
				.isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(RaceWriteApi.THE_ADDRESS_IS_TAKEN);
		assertThat(howManyRaces())
				.as("the delete was refused and the race disappeared anyway")
				.isEqualTo(racesBefore);
		assertThat(dayOf(acted))
				.as("the delete was refused and the event moved anyway")
				.isEqualTo("2026-12-30");
		assertThat(slugOf(acted))
				.as("the delete was refused and the address changed anyway")
				.isEqualTo("drugi-maraton-2026");
	}

	/**
	 * DELETING A RACE TAKES ITS RESULTS AND LEAVES EVERY OTHER RACE ALONE.
	 *
	 * <p>Owner, 24.08.2026, in as many words: „Brisanje trke treba da pobrise i njene
	 * rezultate." The cascade itself is the schema's and is measured against it elsewhere;
	 * what is asked here is the route's own sentence, that it deleted the race it was
	 * given. The race deleted is the first of three on its event and there are seven in the
	 * calendar, so a statement deleting the lowest key, every race of that event, or every
	 * race at all answers differently.
	 */
	@Test
	void deletingARaceTakesItsOwnResultsAndNobodyElses() throws Exception {
		assertThat(remove(raceCalled("Duga")).getStatus()).isEqualTo(204);

		assertThat(namesOfRacesOn(acted))
				.as("the delete took more than the race it was given, or nothing at all")
				.containsExactly("Srednja", "Kratka");

		assertThat(howManyRaces())
				.as("deleting one race took a race off another event")
				.isEqualTo(6);

		assertThat(howManyResults())
				.as("the result run at the deleted race outlived it, or another one went with it")
				.isEqualTo(1);
		assertThat(dayOfResultOn("Tudja"))
				.as("the result on another event's race went with the delete")
				.isEqualTo("2027-09-03");
	}

	/**
	 * AND DELETING THE FIRST OF THEM MOVES THE EVENT ONTO THE ONE THAT IS NOW FIRST.
	 *
	 * <p>The forward direction of the owner's rule, which only a delete and a move away can
	 * reach. „Uvek" is his word and has no direction in it.
	 */
	@Test
	void deletingTheFirstRaceMovesTheEventOntoTheOneThatIsNowFirst() throws Exception {
		assertThat(remove(raceCalled("Duga")).getStatus()).isEqualTo(204);

		assertThat(dayOf(acted))
				.as("the event stayed on a morning nothing runs on any more")
				.isEqualTo(THE_MIDDLE_DAY.toString());
	}

	/** AND DELETING ONE THAT WAS NEVER FIRST LEAVES THE DAY WHERE IT IS. */
	@Test
	void deletingARaceThatWasNeverFirstLeavesTheDayWhereItIs() throws Exception {
		assertThat(remove(raceCalled("Kratka")).getStatus()).isEqualTo(204);

		assertThat(dayOf(acted))
				.as("the event moved although the race it begins on is still there")
				.isEqualTo(ITS_DAY.toString());
	}

	/**
	 * AND DELETING THE LAST RACE THERE IS LEAVES THE EVENT STANDING ON THE DAY IT HAS.
	 *
	 * <p>The decision this route had to take rather than find: „dan prve trke" has no
	 * answer where there is no race, {@code btl_event.date} is NOT NULL, and an event with
	 * no race and a day of its own is the ordinary shape a gathering already has (owner,
	 * 23.08.2026: „Skupovi ostaju jedini dogadjaji bez trka").
	 *
	 * <p><b>The event used is the one whose stored day does NOT agree with its only
	 * race</b>, and that is the whole reason it is in the fixture: filed on 01.10 and
	 * running on 20.10, so „keep the day it has", „take the day of the race just deleted"
	 * and „take today" are three different answers. On any other event they would be one.
	 */
	@Test
	void deletingTheLastRaceLeavesTheEventOnTheDayItHas() throws Exception {
		assertThat(remove(raceCalled("Usamljena")).getStatus()).isEqualTo(204);

		assertThat(daysOfRacesOn(adrift))
				.as("the race that was deleted is still there")
				.isEmpty();
		assertThat(dayOf(adrift))
				.as("an event left with no race was moved onto the day of the race it lost, or"
						+ " onto the day the delete happened to run on")
				.isEqualTo("2027-10-01");
		assertThat(slugOf(adrift))
				.as("an event left with no race lost the address everything is joined to it by")
				.isEqualTo("cetvrti-2027");
	}

	/**
	 * A RACE MAY NOT LEAVE THE SEASON OF A LEAGUE THAT COUNTS IT, AND MAY MOVE INSIDE IT.
	 *
	 * <p>Both halves, because a server refusing every move of a counted race would pass the
	 * first on its own. {@code league_race} carries the season in both of its foreign keys
	 * (V19) and {@code league_race_race_fk} is {@code on delete cascade} and NOT
	 * {@code on update cascade}, so without this the administrator meets a 500 and not a
	 * sentence - measured against a real PostgreSQL before the refusal was written.
	 *
	 * <p>The race counted is the MIDDLE one, so "this race" and "the first race of the
	 * event" are different rows, and the refusal cannot be about the event's own year.
	 */
	@Test
	void aRaceCountedByALeagueMayNotLeaveItsSeasonAndMayMoveInsideIt() throws Exception {
		countedByALeagueOf(2027, theMiddleRace);

		MockHttpServletResponse out = change(theMiddleRace, anEdit().on(LocalDate.parse("2028-02-02")));

		assertThat(out.getStatus())
				.as("a race counted by a league of 2027 was moved into 2028")
				.isEqualTo(409);
		assertThat(reasonIn(out))
				.isEqualTo(RaceWriteApi.THE_RACE_COUNTS_IN_A_LEAGUE_OF_ITS_SEASON);
		assertThat(daysOfRacesOn(acted))
				.as("the move was refused and the race moved anyway")
				.containsExactly("2027-06-02", "2027-06-03", "2027-06-04");

		assertThat(change(theMiddleRace, anEdit().on(LocalDate.parse("2027-02-02"))).getStatus())
				.as("a race counted by a league could not be moved inside its own season")
				.isEqualTo(200);
	}

	/** AND ONE NO LEAGUE COUNTS MAY LEAVE THE YEAR ALTOGETHER. */
	@Test
	void aRaceNoLeagueCountsMayLeaveTheYearAltogether() throws Exception {
		countedByALeagueOf(2027, theMiddleRace);

		assertThat(change(raceCalled("Kratka"), anEdit().on(LocalDate.parse("2028-02-02")))
				.getStatus())
				.as("a race no league counts was refused because another race is in one")
				.isEqualTo(200);
	}

	/**
	 * A RACE CANNOT BE MOVED TO ANOTHER EVENT, AND SAYING ITS OWN IS NOT MOVING IT.
	 *
	 * <p>Owner, 11.08.2026: „Forma trke se otvara pod tek napravljenim dogadjajem, bez
	 * pitanja kom dogadjaju trka pripada: odgovor je na strani iznad nje, a pitanje ciji
	 * odgovor stoji iznad njega je pitanje sa dostupnim pogresnim odgovorom." Refused
	 * rather than dropped, the same choice {@code EventWriteApi} makes for a country sent
	 * beside a codebook town.
	 *
	 * <p>The other two halves are one line away in the code and are what keep a race from
	 * being impossible to save at all: naming its own event is not moving it, and NOT
	 * naming one is the ordinary shape, since the event a race is under is not a question
	 * the form asks.
	 */
	@Test
	void aRaceCannotBeMovedToAnotherEventAndNamingItsOwnIsNotMovingIt() throws Exception {
		MockHttpServletResponse away = change(theMiddleRace, anEdit().under(another));

		assertThat(away.getStatus())
				.as("a race was moved onto another event")
				.isEqualTo(400);
		assertThat(reasonIn(away)).isEqualTo(RaceWriteApi.THE_RACE_CANNOT_CHANGE_EVENTS);
		assertThat(namesOfRacesOn(another))
				.as("the move was refused and the race arrived anyway")
				.containsExactly("Tudja");

		assertThat(change(theMiddleRace, anEdit().under(acted)).getStatus())
				.as("a race could not be saved under the event it is already on")
				.isEqualTo(200);

		assertThat(change(theMiddleRace, anEdit().under(null).called("Bez dogadjaja", true))
				.getStatus())
				.as("an edit that does not name an event at all was read as one moving the race")
				.isEqualTo(200);
		assertThat(namesOfRacesOn(acted))
				.as("an edit that named no event wrote the race under another one")
				.containsExactly("Duga", "Bez dogadjaja", "Kratka");
	}

	/**
	 * AN EVENT THAT IS NOT A RACE HOLDS NO RACES.
	 *
	 * <p>Owner, 23.08.2026: „Kad se za Vrstu dogadjaja izabere Skup ili Trening, donja
	 * sekcija „Trke na dogadjaju" ne postoji i trke se ne mogu dodavati", and „Skupovi
	 * ostaju jedini dogadjaji bez trka". Both kinds, because the sentence names both and a
	 * server that knew one of them would pass a case that asked about the other.
	 *
	 * <p>Asked of the edit as well, since a race already standing under an event that is
	 * then turned into a gathering is a row this route must not go on writing.
	 */
	@ParameterizedTest
	@CsvSource({"gathering, add", "training, add", "gathering, change", "training, change"})
	void anEventThatIsNotARaceHoldsNoRaces(String kind, String how) throws Exception {
		db.sql("update btl_event set kind = ? where id = ?").params(kind, another).update();

		long before = howManyRaces();

		MockHttpServletResponse answer = how.equals("add")
				? add(aForm().under(another))
				: change(raceCalled("Tudja"), anEdit().under(another));

		assertThat(answer.getStatus())
				.as("a race was %sed under a %s", how, kind)
				.isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(RaceWriteApi.THE_EVENT_HOLDS_NO_RACES);
		assertThat(howManyRaces())
				.as("the write was refused and a race appeared anyway")
				.isEqualTo(before);
	}

	/**
	 * EVERY WAY A FORM CAN BE WRONG IS ANSWERED AS A SENTENCE, NEVER AS A SERVER FAULT.
	 *
	 * <p>Each row here is a rule V7 also holds, bar one. Left to the database every one of
	 * them would reach an administrator as a 500 after he had filled the form in, which is
	 * the fault {@code LinkShapeMatchesTheSchemaTest} exists against one column along.
	 *
	 * <p>The one that is not a constraint is {@code aDistanceNothingCanKeep}: a distance
	 * with more decimals than the column keeps is not refused by PostgreSQL, it is silently
	 * ROUNDED, and the generated {@code race.category} is then worked out of a number
	 * nobody typed. Since V25 the column keeps four decimals, so the row that measures this
	 * sends five. {@code RaceShapesMatchTheSchemaTest} holds the rule against the column
	 * itself, so the two move together the next time a migration widens it.
	 */
	@ParameterizedTest
	@CsvSource(nullValues = "-", value = {
			"noEvent, theFormIsNotComplete",
			"anEventNobodyHas, theEventIsNotKnown",
			"aNameEmptied, theFormIsNotComplete",
			"aKindNobodyHas, theKindIsNotKnown",
			"aTimedRaceWithNoLimit, theLimitBelongsToATimedRace",
			"aTimedRaceWithNoTime, theLimitBelongsToATimedRace",
			"aLimitOnARaceOfALength, theLimitBelongsToATimedRace",
			"aRaceOfALengthWithNoLength, theDistanceBelongsToARaceOfALength",
			"aRaceOfALengthOfNought, theDistanceBelongsToARaceOfALength",
			"aLengthOnAFreeRace, theDistanceBelongsToARaceOfALength",
			"aDistanceNothingCanKeep, theDistanceIsNotKeptExactly",
			"aDistanceOverTheCeiling, theDistanceIsNotKeptExactly",
			"aClimbBelowNought, theClimbOrTheFallIsNegative",
			"aFallBelowNought, theClimbOrTheFallIsNegative",
	})
	void aFormThatCannotBeWrittenIsAnsweredWithWhatIsWrongWithIt(String spoiled, String reason)
			throws Exception {

		long before = howManyRaces();
		MockHttpServletResponse answer = add(spoiledIn(spoiled));

		assertThat(answer.getStatus())
				.as("%s was not answered as something wrong with the form", spoiled)
				.isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("%s was refused for the wrong reason", spoiled)
				.isEqualTo(reason);
		assertThat(howManyRaces())
				.as("%s was refused and a race was written anyway", spoiled)
				.isEqualTo(before);
	}

	/**
	 * AND AN EDIT IS JUDGED BY THE SAME RULES AS A WRITE, row for row.
	 *
	 * <p>The same spoiled forms, sent to the other route. This is one case and not fourteen
	 * because the rule it holds is that there is ONE judgement and not two: a portal that
	 * grew a second, looser answer on the edit would let an administrator walk every rule
	 * above by writing a good race and then changing it into a bad one.
	 *
	 * <p>{@code noEvent} and {@code anEventNobodyHas} are not here, and that is the one
	 * place the two routes really do differ: the edit knows which event the race is under
	 * and refuses a DIFFERENT one by its own rule, which the case above this measures.
	 *
	 * <p>The race, the event's day and the event's address are all read afterwards, because
	 * a refusal that had already written half of itself would answer 400 and leave the
	 * calendar changed.
	 */
	@ParameterizedTest
	@CsvSource(nullValues = "-", value = {
			"aNameEmptied, theFormIsNotComplete",
			"aKindNobodyHas, theKindIsNotKnown",
			"aTimedRaceWithNoLimit, theLimitBelongsToATimedRace",
			"aTimedRaceWithNoTime, theLimitBelongsToATimedRace",
			"aLimitOnARaceOfALength, theLimitBelongsToATimedRace",
			"aRaceOfALengthWithNoLength, theDistanceBelongsToARaceOfALength",
			"aRaceOfALengthOfNought, theDistanceBelongsToARaceOfALength",
			"aLengthOnAFreeRace, theDistanceBelongsToARaceOfALength",
			"aDistanceNothingCanKeep, theDistanceIsNotKeptExactly",
			"aDistanceOverTheCeiling, theDistanceIsNotKeptExactly",
			"aClimbBelowNought, theClimbOrTheFallIsNegative",
			"aFallBelowNought, theClimbOrTheFallIsNegative",
	})
	void anEditIsAnsweredWithWhatIsWrongWithItTheSameWay(String spoiled, String reason)
			throws Exception {

		List<String> daysBefore = daysOfRacesOn(acted);
		List<String> namesBefore = namesOfRacesOn(acted);

		MockHttpServletResponse answer = change(theMiddleRace, spoiledIn(spoiled));

		assertThat(answer.getStatus())
				.as("%s was accepted on the edit route although the write route refuses it", spoiled)
				.isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("%s was refused on the edit route for a different reason than on the write"
						+ " route", spoiled)
				.isEqualTo(reason);
		assertThat(daysOfRacesOn(acted))
				.as("%s was refused and the calendar changed anyway", spoiled)
				.isEqualTo(daysBefore);
		assertThat(namesOfRacesOn(acted))
				.as("%s was refused and the race was renamed anyway", spoiled)
				.isEqualTo(namesBefore);
		assertThat(dayOf(acted))
				.as("%s was refused and the event moved anyway", spoiled)
				.isEqualTo(ITS_DAY.toString());
		assertThat(slugOf(acted))
				.as("%s was refused and the event's address changed anyway", spoiled)
				.isEqualTo(ITS_ADDRESS);
	}

	/**
	 * AN EDIT THAT LEAVES A FIELD OUT IS REFUSED, THE FIELD IS NAMED, AND NOTHING MOVES.
	 *
	 * <p><b>Owner, ADL A54, 19.09.2026, on three offered outcomes:</b> „`PUT` koji ne
	 * posalje neko polje odbija se sa 400, i kaze se sta fali."
	 *
	 * <p><b>The clause that followed it here, „Isto na svakoj upisnoj ruti portala, bez
	 * izuzetka", was never his.</b> An independent review of PR 309 found it in his voice
	 * on 19.09.2026 and traced it to this codebase's own extension of a choice made for the
	 * race edit into a rule for every route. What he decided instead, the same day and also
	 * on three offered outcomes, is narrower and leaves the choice to the route:
	 * „izostavljeno polje nikad ne sme tiho da promeni vrednost; sme da znaci 'ne diraj',
	 * nikad 'vrati na podrazumevano'." {@link RaceWriteApi#change} picks refusal, which is
	 * what this case measures.
	 *
	 * <p><b>The fields are not typed out here.</b> They are the components of
	 * {@link RaceWriteApi.Upsert} less {@link #AN_EDIT_NEED_NOT_SEND}, read off the record
	 * itself, so a tenth field added to the form arrives in this case on the day it is
	 * added. {@code Form#without} throws on a name it does not know, which is what stops
	 * the derived list and the hand written switch from drifting apart in silence.
	 *
	 * <p><b>What each row proves is not the 400 but the row that did not change.</b> Until
	 * this decision an edit with no {@code date} took the event's day and answered 200, and
	 * {@code result_race_fk} being {@code on update cascade} over
	 * {@code (race_id, race_date)} rewrote the day of every result of that race with it.
	 * So a result is put on the race first and its day is read afterwards: the race runs on
	 * {@link #THE_MIDDLE_DAY} and its event begins on {@link #ITS_DAY}, which are different
	 * mornings, so "the day was kept" and "the day was taken from the event" cannot come
	 * back as the same date.
	 *
	 * <p>The name is read for the same reason and it is the same trap one field along: the
	 * race is „Srednja", its event is „Drugi maraton", and the form carries a third name
	 * again, so none of the three answers can stand in for another.
	 */
	@ParameterizedTest
	@MethodSource("everyFieldAnEditMustSend")
	void anEditThatLeavesAFieldOutIsRefusedAndNothingIsWritten(String field) throws Exception {
		result(competitor("000902", "0011223344556602"), theMiddleRace);

		MockHttpServletResponse answer = change(theMiddleRace, anEdit().without(field));

		assertThat(answer.getStatus())
				.as("an edit with no %s was accepted", field)
				.isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("an edit with no %s was refused for some other reason", field)
				.isEqualTo(RaceWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(missingIn(answer))
				.as("the refusal did not say that %s was what was missing", field)
				.containsExactly(field);

		assertThat(namesOfRacesOn(acted))
				.as("an edit with no %s was refused and the race was renamed anyway", field)
				.containsExactly("Duga", "Srednja", "Kratka");
		assertThat(daysOfRacesOn(acted))
				.as("an edit with no %s was refused and the race moved anyway", field)
				.containsExactly(ITS_DAY.toString(), THE_MIDDLE_DAY.toString(),
						THE_LAST_DAY.toString());
		assertThat(dayOfResultOn("Srednja"))
				.as("an edit with no %s was refused and the cascade rewrote a result's day"
						+ " anyway", field)
				.isEqualTo(THE_MIDDLE_DAY.toString());
	}

	/**
	 * AND A BODY THAT DOES NOT CARRY THE KEY AT ALL IS REFUSED IN EXACTLY THE SAME WORDS.
	 *
	 * <p><b>Two different bodies, and until 19.09.2026 this file thought they were one.</b>
	 * {@code Form#without} nulls a component, and a record with a null component
	 * serialises to {@code "date": null} - Jackson includes the key. A screen that simply
	 * never wrote the field sends an object with no {@code date} in it. Those are
	 * different bytes, and every case above sends only the first of them.
	 *
	 * <p><b>The route reads them the same, which is right, and nothing held it.</b> That
	 * is the whole reason for this case: a {@code @JsonSetter(nulls = Nulls.SKIP)} or a
	 * default filled in by a compact constructor would part the two shapes, and the suite
	 * would stay green while a form that omitted a field silently took a default again -
	 * which is the exact fault ADL A54 was written about.
	 *
	 * <p>The second body is DERIVED from the first rather than typed out, so the one key
	 * is the only difference between them, and the removal is checked to have actually
	 * happened: a key that was not there to remove would send the same bytes twice and
	 * make the comparison below true about nothing.
	 */
	@ParameterizedTest
	@MethodSource("everyFieldAnEditMustSend")
	void anEditThatOmitsTheKeyEntirelyIsRefusedTheSameWay(String field) throws Exception {
		MockHttpServletResponse nulled = change(theMiddleRace, anEdit().without(field));
		MockHttpServletResponse absent = changeSending(theMiddleRace, aBodyWithNo(field));

		assertThat(absent.getStatus())
				.as("a body carrying no %s key at all was not refused", field)
				.isEqualTo(400);
		assertThat(missingIn(absent))
				.as("a body carrying no %s key at all did not say that is what was missing",
						field)
				.containsExactly(field);

		assertThat(List.of(absent.getStatus(), absent.getContentAsString()))
				.as("`\"%s\": null` and a body with no `%s` at all are answered differently, so"
						+ " the two shapes have parted and only one of them is measured", field,
						field)
				.isEqualTo(List.of(nulled.getStatus(), nulled.getContentAsString()));
	}

	/**
	 * A complete edit's body with one KEY taken out of it, rather than set to null.
	 *
	 * <p>Built by serialising {@link #anEdit} and removing the key, so the body is byte for
	 * byte what the route is sent everywhere else less exactly one key.
	 */
	private String aBodyWithNo(String field) throws Exception {
		ObjectNode body = (ObjectNode) new ObjectMapper().readTree(json(anEdit()));

		assertThat(body.remove(field))
				.as("the body carries no key called %s to begin with, so this would send the"
						+ " same bytes twice and compare nothing", field)
				.isNotNull();

		return body.toString();
	}

	/** The same edit request, with a body handed over as it stands rather than as a form. */
	private MockHttpServletResponse changeSending(long id, String body) throws Exception {
		return http.perform(put("/api/races/" + id).with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(body)
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	/**
	 * The fields an edit must send, taken off {@link RaceWriteApi.Upsert} rather than
	 * listed.
	 */
	private static List<String> everyFieldAnEditMustSend() {
		return Arrays.stream(RaceWriteApi.Upsert.class.getRecordComponents())
				.map(RecordComponent::getName)
				.filter(field -> !AN_EDIT_NEED_NOT_SEND.contains(field))
				.toList();
	}

	/**
	 * THE EXACT LENGTH IS WHAT IS KEPT, AND THE CATEGORY IS WORKED OUT OF THAT.
	 *
	 * <p><b>Owner, PDL, 19.09.2026, in his own words:</b> „Hocu da mogu da unosim tacnu
	 * duzinu, ali se prikazuje zaokruzeno na dve ili manje decimala. Dakle 42.203 treba da
	 * zaokruzi na 42.2, ali da vodi kao ultramaraton."
	 *
	 * <p><b>The first three rows are the whole decision and they are three rows on
	 * purpose.</b> 42.203, 42.2 and 42.195 all SHOW as „42,2 km" - the rounding is the
	 * browser's and is not on this server at all - and they are an ultramarathon, a
	 * marathon and a „duza trka". A portal that kept two decimals would store one number
	 * for all three and call all three a marathon, which is what V25 was written to end.
	 * The last two are the same turn one category down, where the owner's own example is
	 * the true half marathon: „21.0975 nije polumaraton nego „krace trke"".
	 *
	 * <p><b>Read out of the ROW and never off the answer.</b> What comes back in the
	 * response is what the caller handed in; the question here is what the DATABASE made of
	 * it, and the category is a generated column that only the database can answer for.
	 */
	@ParameterizedTest
	@CsvSource({
			"42.203,   42.2030,   ultra",
			"42.2,     42.2000,   marathon",
			"42.195,   42.1950,   long",
			"21.1,     21.1000,   half",
			"21.0975,  21.0975,   short",
			/* And the ceiling the widened column carries, which is a length and not a
			   boundary of the rule: four digits before the point, exactly as before V25. */
			"9999.9999, 9999.9999, ultra",
	})
	void theExactLengthIsKeptAndTheCategoryIsWorkedOutOfIt(String typed, String kept,
			String category) throws Exception {

		MockHttpServletResponse answer = change(theMiddleRace,
				anEdit().ofKind(WhatARaceCarries.OF_A_LENGTH, null, typed));

		assertThat(answer.getStatus())
				.as("%s was refused, although the owner decided an exact length is kept", typed)
				.isEqualTo(200);

		assertThat(lengthAndCategoryOf(theMiddleRace))
				.as("%s was not kept as it was typed, or was put in the wrong category", typed)
				.containsExactly(kept, category);
	}

	/** What the row really holds, both halves of it, as the database answers them. */
	private List<String> lengthAndCategoryOf(long race) {
		return db.sql("select distance_km, category from race where id = ?").param(race)
				.query((row, one) -> List.of(row.getBigDecimal(1).toPlainString(),
						row.getString(2)))
				.single();
	}

	/**
	 * A form with one thing wrong with it and nothing else.
	 *
	 * <p>Built on {@link #anEdit} rather than on {@link #aForm} since ADL A54, and that is
	 * the difference between measuring what each row says it measures and measuring the
	 * same refusal fourteen times: a sparse form is now refused for being incomplete BEFORE
	 * anything else is looked at, so every row below would have come back
	 * {@code theFormIsNotComplete} and twelve of them would have stopped saying anything at
	 * all. Complete but for the one spoiled field, each row reaches the rule it names.
	 */
	private Form spoiledIn(String how) {
		Form good = anEdit();

		return switch (how) {
			case "noEvent" -> good.under(null);
			case "anEventNobodyHas" -> good.under(-1L);
			case "aNameEmptied" -> good.called("   ", true);
			case "aKindNobodyHas" -> good.ofKind("distance", null, "10.00");
			case "aTimedRaceWithNoLimit" -> good.ofKind("time", null, null);
			case "aTimedRaceWithNoTime" -> good.ofKind("time", 0, null);
			case "aLimitOnARaceOfALength" -> good.ofKind("length", 21600, "10.00");
			case "aRaceOfALengthWithNoLength" -> good.ofKind("length", null, null);
			case "aRaceOfALengthOfNought" -> good.ofKind("length", null, "0.00");
			case "aLengthOnAFreeRace" -> good.ofKind("free", null, "10.00");
			/* A FIFTH decimal, because since V25 the column keeps four. This was „42.195"
			   until 19.09.2026, when the owner decided that value is to be KEPT and led as
			   „duze trke" rather than refused; the rule did not move, the column did. */
			case "aDistanceNothingCanKeep" -> good.ofKind("length", null, "42.19512");
			case "aDistanceOverTheCeiling" -> good.ofKind("length", null, "10000.00");
			case "aClimbBelowNought" -> good.withProfile(-500, 0);
			default -> good.withProfile(0, -900);
		};
	}

	/**
	 * A FREE RACE FIXES NEITHER MEASURE AND IS WRITTEN ALL THE SAME, AS NOUGHT AND NOUGHT.
	 *
	 * <p>Owner, PDL: a free race is „trci se koliko se moze dok se ispunjava cilj", and one
	 * with no word about its climb „se boduje, vodi se kao 0/0". The pair of checks in V7
	 * says the same in the other direction, and without this the third kind would be one
	 * the schema holds and no form can produce.
	 */
	@Test
	void aFreeRaceFixesNeitherMeasureAndIsWrittenAsNoughtAndNought() throws Exception {
		MockHttpServletResponse answer = add(aForm().ofKind("free", null, null));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(db.sql("select kind, limit_seconds, distance_km, ascent_m, descent_m from race"
						+ " where id = ?").param(writtenId(answer))
				.query((row, one) -> List.of(row.getString(1), String.valueOf(row.getInt(2)),
						row.getBigDecimal(3).toPlainString(), String.valueOf(row.getInt(4)),
						String.valueOf(row.getInt(5)))).single())
				.as("a free race was written with a limit, a length, or a profile of its own")
				/* Nought at the column's own scale, which V25 took from two decimals to
				   four. The number did not change and the text it is stored as did. */
				.containsExactly("free", "0", "0.0000", "0", "0");
	}

	/**
	 * A RACE THAT IS NOT THERE READS EXACTLY LIKE ONE SOMEBODY MAY NOT TOUCH.
	 *
	 * <p>Both routes that take a key, because the lookup is written once in each. 404 and
	 * no body is the same answer {@code RightsAtTheDoor} gives a refused moderator, which
	 * is ADL A8 applied to a row: a body of any kind is something an address that does not
	 * exist would not have.
	 */
	@Test
	void changingOrDeletingSomethingThatIsNotThereSaysNothingAboutIt() throws Exception {
		MockHttpServletResponse changed = change(-1, anEdit());

		assertThat(changed.getStatus()).isEqualTo(404);
		assertThat(changed.getContentAsString())
				.as("a key that is not there was answered with a reason, which is a sentence about"
						+ " something that does not exist")
				.isEmpty();

		MockHttpServletResponse removed = remove(-1);

		assertThat(removed.getStatus()).isEqualTo(404);
		assertThat(removed.getContentAsString()).isEmpty();
	}

	/**
	 * A DELETE FROM SOMEBODY WITHOUT THE RIGHT IS REFUSED, AND THE RACE IS STILL THERE
	 * AFTERWARDS.
	 *
	 * <p>The second half is the whole case. This route answers 404 to a row that is not
	 * there AND to a caller who may not touch it - on purpose, ADL A8 applied to a row - so
	 * the number alone says nothing. What it costs in the field is a race gone with every
	 * result run at it, by the cascades V7 writes, at the hand of any signed-in member.
	 */
	@Test
	void aDeleteFromAModeratorWithoutTheRightLeavesTheRaceStanding() throws Exception {
		long before = howManyRaces();

		MockHttpServletResponse answer = remove(theMiddleRace, anotherSession);

		assertThat(answer.getStatus())
				.as("a moderator holding another tick deleted a race")
				.isEqualTo(404);
		assertThat(howManyRaces())
				.as("the delete was refused and a race disappeared anyway")
				.isEqualTo(before);
		assertThat(db.sql("select count(*) from race where id = ?").param(theMiddleRace)
						.query(Integer.class).single())
				.as("the very race the refused delete named is gone")
				.isOne();
	}

	/** AND A MODERATOR WITHOUT THE TICK IS REFUSED ON THE WRITE HERE AS EVERYWHERE ELSE. */
	@Test
	void aModeratorHoldingAnotherTickIsRefused() throws Exception {
		long before = howManyRaces();

		MockHttpServletResponse answer = add(aForm(), anotherSession);

		assertThat(answer.getStatus())
				.as("a moderator without entity:events wrote a race")
				.isEqualTo(404);
		assertThat(howManyRaces()).isEqualTo(before);
	}

	/**
	 * NOBODY AT ALL IS ANSWERED 401, AND THAT IS WHAT HOLDS THE NARROWING IN
	 * {@code ApiSecurity}.
	 *
	 * <p>{@code /api/races} is read by anybody and, since this increment, written by
	 * somebody. What the narrowing prevents is not a write but a 500: opened to POST, the
	 * request reaches {@code WhatHeMayDo}, which casts the principal to a member, and an
	 * anonymous caller is the string {@code anonymousUser}. The answer would become a third
	 * reply on {@code /api} that tells a stranger this address exists and takes a POST,
	 * while an address mapping nothing goes on saying 404.
	 *
	 * <p>The narrowing itself already shipped with {@code /api/events} and is measured
	 * there; this is the same question asked of the second path to need it, since
	 * {@code OpenRoutesStayReadOnlyTest} cannot tell a 401 from a 500 by construction.
	 */
	@Test
	void aWriteFromNobodyIsAnsweredUnauthorisedAndNotAsAServerFault() throws Exception {
		long before = howManyRaces();

		MockHttpServletResponse answer = addWithNobodyAsking(aForm());

		assertThat(answer.getStatus())
				.as("an anonymous write to an open path was not answered 401, and a 500 here tells"
						+ " a stranger the address exists and takes a POST")
				.isEqualTo(401);
		assertThat(howManyRaces())
				.as("nobody was refused and a race was written anyway")
				.isEqualTo(before);
	}

	/**
	 * THE CALENDAR MAY BE WRITTEN AND CHANGED BACKWARDS.
	 *
	 * <p>Owner, 31.07.2026, of the calendar: it may be changed backwards. Both routes are
	 * asked, since a rule refusing the past would be written in one of them and copied to
	 * the other, and the day is years before the day the case runs rather than yesterday -
	 * so a server comparing against today and one comparing against nothing cannot agree by
	 * accident.
	 *
	 * <p>The event moved back with it is asked for too, because the day a past race lands
	 * on is the day the whole event now begins on.
	 */
	@Test
	void aRaceLongPastIsWrittenAndChangedLikeAnyOther() throws Exception {
		assertThat(add(aForm().under(another).on(LocalDate.parse("2019-04-06"))).getStatus())
				.as("a race that was run years ago could not be entered")
				.isEqualTo(201);
		assertThat(dayOf(another)).isEqualTo("2019-04-06");

		assertThat(change(theMiddleRace, anEdit().on(LocalDate.parse("2018-05-05"))).getStatus())
				.as("a race could not be moved into the past")
				.isEqualTo(200);
		assertThat(dayOf(acted)).isEqualTo("2018-05-05");
	}
}
