package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * PUTTING AN EVENT INTO THE CALENDAR, CHANGING IT AND TAKING IT OUT, END TO END.
 *
 * <p><b>Authorisation itself is not measured here.</b> {@code RightsAtTheDoorTest} asks it
 * of EVERY route carrying {@link RightIsNeeded} - a stranger, a plain member, a moderator
 * holding somebody else's tick - and since 18.09.2026 it asks each route by its own
 * METHOD, which is what makes it reach a {@code POST} sharing a path with the open
 * calendar. One case here holds the same thing for defence in depth, and the rest of this
 * file measures what is this resource's own.
 *
 * <p><b>Nor is the cascade.</b> V7 carries it four times over and
 * {@code CompetitorEventRaceAndResultTest.deletingAnEventTakesItsRacesResultsIntentionsAndComments}
 * already measures the whole chain against the schema. What is measured here is that the
 * ROUTE deletes the event it was asked about and not another, which is a different
 * sentence and one the schema cannot make.
 *
 * <p><b>NOTHING IN THE FIXTURE IS THE ONLY ONE OF ITS KIND.</b> Three events and never one;
 * the one being acted on is never the first written, so "the right row" and "the first row"
 * give different answers; two races on the event acted on and one on another, so "its
 * races" and "the races" differ; a result on each, so a move that carried the wrong ones
 * shows; and two moderators, each holding the tick the other is refused.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class EventWriteApiTest {

	private static final String MODERATOR = "kalendar@primer.rs";

	private static final String ANOTHER_MODERATOR = "timovi@primer.rs";

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String ANOTHER_TOWN = "(select id from place where rank = 2)";

	/** The day the event being acted on is run on, which is never the day of the edit. */
	private static final LocalDate ITS_DAY = LocalDate.parse("2027-06-02");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private String session;

	/** A moderator who holds a tick, just not this one. */
	private String anotherSession;

	private long acted;

	private long another;

	/**
	 * THREE EVENTS, FOUR RACES OVER TWO OF THEM, AND TWO MODERATORS.
	 *
	 * <p>The event every case acts on is written SECOND, so a route reading the first row
	 * it finds, or the lowest key, answers differently from one reading the key it was
	 * given. Its two races sit on two different mornings, which is the shape the owner
	 * describes - two races on the Saturday and one on the Sunday are one event - so a
	 * move that flattened them to one day would show.
	 */
	@BeforeEach
	void aCalendarWithMoreThanOneOfEverything() {
		event("prvi-2027", "2027-03-01", A_TOWN);
		acted = event("drugi-2027", ITS_DAY.toString(), A_TOWN);
		another = event("treci-2027", "2027-09-03", ANOTHER_TOWN);

		race(acted, "Duga", ITS_DAY.toString());
		race(acted, "Kratka", ITS_DAY.plusDays(1).toString());
		race(another, "Tudja", "2027-09-03");

		long runner = competitor("000901", "0011223344556601");
		result(runner, raceCalled("Duga"));
		result(runner, raceCalled("Tudja"));

		session = account(MODERATOR, "moderator");
		anotherSession = account(ANOTHER_MODERATOR, "moderator");

		ticked(MODERATOR, "entity:events");
		ticked(ANOTHER_MODERATOR, "entity:teams");
	}

	private long event(String slug, String day, String town) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, date '" + day + "', " + town
						+ ", null, null, 'race', false, '', '') returning id")
				.params(slug, "Trka " + slug).query(Long.class).single();
	}

	private void race(long event, String name, String day) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values (?, ?, false, date '" + day
						+ "', 'length', 0, 10.00, 0, 0)")
				.params(event, name).update();
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

	private MockHttpServletResponse add(Form typed, String cookie) throws Exception {
		return http.perform(post("/api/events").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(json(typed))
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse change(long id, Form typed) throws Exception {
		return http.perform(put("/api/events/" + id).with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(json(typed))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse remove(long id) throws Exception {
		return http.perform(delete("/api/events/" + id).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	private String json(Form typed) {
		return new ObjectMapper().writeValueAsString(typed);
	}

	/** A complete form, out of the codebook, which every case then spoils in one way. */
	/**
	 * A FORM UNDER CONSTRUCTION, and it lives here rather than on
	 * {@link EventWriteApi.Upsert} on purpose. The six withers below exist so a case can
	 * say what it changes and stay silent about the eight fields it does not; nothing in
	 * production ever calls one. Put on the request record itself they would be six methods
	 * the portal never uses, sitting in the class a reader opens to learn what an event
	 * carries.
	 *
	 * <p>{@link #withPlace} and {@link #withTypedTown} each clear the other's fields,
	 * because a town comes from the codebook or is typed and never both - that is the rule
	 * the schema itself holds. A case that wants the forbidden combination therefore cannot
	 * reach it by chaining, and says so by building the record whole, which is what
	 * {@code bothTowns} does below.
	 */
	private record Form(String name, LocalDate date, Long placeId, String city, String country,
			String kind, Boolean featured, String description, String link) {

		EventWriteApi.Upsert typed() {
			return new EventWriteApi.Upsert(name, date, placeId, city, country, kind, featured,
					description, link);
		}

		Form withPlace(long fromTheCodebook) {
			return new Form(name, date, fromTheCodebook, null, null, kind, featured, description,
					link);
		}

		Form withTypedTown(String typedCity, String itsCountry) {
			return new Form(name, date, null, typedCity, itsCountry, kind, featured, description,
					link);
		}

		Form withName(String called) {
			return new Form(called, date, placeId, city, country, kind, featured, description, link);
		}

		Form withDay(LocalDate held) {
			return new Form(name, held, placeId, city, country, kind, featured, description, link);
		}

		Form withKind(String asked) {
			return new Form(name, date, placeId, city, country, asked, featured, description, link);
		}

		Form withLink(String at) {
			return new Form(name, date, placeId, city, country, kind, featured, description, at);
		}
	}

	private static Form aForm() {
		return new Form("Novi maraton", LocalDate.parse("2028-04-18"), 1L, null,
				null, "race", false, "", "");
	}

	/** The key of a town that really is in the codebook, since 1 need not be. */
	private long aKnownTown() {
		return db.sql("select id from place where rank = 1").query(Long.class).single();
	}

	private String slugOf(long id) {
		return db.sql("select slug from btl_event where id = ?").param(id)
				.query(String.class).single();
	}

	private List<String> daysOfRacesOn(long event) {
		return db.sql("select to_char(date, 'YYYY-MM-DD') from race where event_id = ?"
				+ " order by date").param(event).query(String.class).list();
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("reason").asString();
	}

	private long writtenId(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("id").asLong();
	}

	private String writtenSlug(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("slug").asString();
	}

	/**
	 * AN EVENT IS WRITTEN AND ANSWERS AT THE ADDRESS THE SERVER WORKED OUT.
	 *
	 * <p>The address is the one thing the caller cannot know, because he never sends it:
	 * {@code slug} is not a field of the form and the rule that builds it is the owner's
	 * of 10.08.2026. So it is asserted off the answer AND off the row, which are two
	 * different places a wrong answer could come from.
	 */
	@Test
	void anEventIsWrittenAndAnswersAtTheAddressTheServerWorkedOut() throws Exception {
		MockHttpServletResponse answer = add(aForm().withPlace(aKnownTown()), session);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(writtenSlug(answer))
				.as("the address is not the name and the year the owner decided on")
				.isEqualTo("novi-maraton-2028");

		assertThat(slugOf(writtenId(answer)))
				.as("the row answers at an address different from the one the caller was told")
				.isEqualTo("novi-maraton-2028");
	}

	/**
	 * AND A NAME WHOSE LETTERS AN ADDRESS CANNOT CARRY IS STILL GIVEN ONE.
	 *
	 * <p>Separate from the case above because it is the half a server that simply lowercased
	 * the name would get wrong, and because 430 of the events the portal ships carry one of
	 * these five letters.
	 */
	@Test
	void aNameWithOurOwnLettersIsGivenAnAddressThatCanCarryThem() throws Exception {
		MockHttpServletResponse answer =
				add(aForm().withPlace(aKnownTown()).withName("Đerdapska čarolija"), session);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(writtenSlug(answer)).isEqualTo("derdapska-carolija-2028");
	}

	/**
	 * A TOWN OUT OF THE CODEBOOK CARRIES ITS OWN COUNTRY, AND THE ROW SAYS SO.
	 *
	 * <p>Owner, 11.08.2026: the town chosen from the world codebook brings its country and
	 * that country does not change. V7 says the same in two checks, and what is asserted
	 * here is the row those checks are about: {@code place_id} set, and both halves of the
	 * typed pair empty.
	 */
	@Test
	void aTownOutOfTheCodebookLeavesTheTypedPairEmpty() throws Exception {
		long written = writtenId(add(aForm().withPlace(aKnownTown()), session));

		assertThat(db.sql("select place_id is not null and city is null and country_id is null"
						+ " from btl_event where id = ?").param(written)
				.query(Boolean.class).single())
				.as("an event out of the codebook also carries a typed town or a typed country")
				.isTrue();
	}

	/** AND A TOWN TYPED BY HAND NAMES ITS OWN COUNTRY, which is the other half. */
	@Test
	void aTownTypedByHandKeepsTheCountryItNamed() throws Exception {
		long written = writtenId(add(aForm().withTypedTown("Kruševac", "HR"), session));

		assertThat(db.sql("select c.code from btl_event e join country c on c.id = e.country_id"
						+ " where e.id = ?").param(written).query(String.class).single())
				.as("the country beside a typed town is not the one that was typed")
				.isEqualTo("HR");
	}

	/**
	 * AN EVENT THAT SAYS NO KIND IS A RACE, and one that says a kind nobody knows is
	 * refused.
	 *
	 * <p>Owner, 10.08.2026: „Dogadjaj ima vrstu: Trka, Trening ili Skup", and the default
	 * is a race. A gathering is written exactly like a race, which is the owner's decision
	 * that the calendar covers an association's events that are not races.
	 */
	@ParameterizedTest
	@CsvSource(nullValues = "-", value = {"-, 201, race", ", 201, race", "gathering, 201, gathering",
			"training, 201, training", "race, 201, race", "marathon, 400, -", "Race, 400, -"})
	void theKindIsOneOfThreeAndLeftOutItIsARace(String asked, int answered, String written)
			throws Exception {

		MockHttpServletResponse answer = add(aForm().withPlace(aKnownTown()).withKind(asked), session);

		assertThat(answer.getStatus()).isEqualTo(answered);

		if (written == null) {
			assertThat(reasonIn(answer)).isEqualTo(EventWriteApi.THE_KIND_IS_NOT_KNOWN);
			return;
		}

		assertThat(db.sql("select kind from btl_event where id = ?").param(writtenId(answer))
				.query(String.class).single())
				.as("the kind written down is not the one asked for")
				.isEqualTo(written);
	}

	/**
	 * A SECOND EVENT OF THE SAME NAME IN THE SAME YEAR IS REFUSED, AND THE SAME NAME IN
	 * ANOTHER YEAR IS NOT.
	 *
	 * <p>Owner, 10.08.2026, in as many words: „Isti naziv dvaput u istoj godini je sudar
	 * adresa i portal ga odbija uz poruku koja to kaze." Both halves in one case, because
	 * a server that refused every repeated NAME would pass the first on its own - and the
	 * same race is run every year, which is the whole reason the year is in the address.
	 *
	 * <p>The refusal is asked of a SECOND event and not of the fixture's own, so it cannot
	 * be an event colliding with itself.
	 */
	@Test
	void aSecondEventAtOneAddressIsRefusedAndTheSameNameNextYearIsNot() throws Exception {
		assertThat(add(aForm().withPlace(aKnownTown()), session).getStatus()).isEqualTo(201);

		MockHttpServletResponse again = add(aForm().withPlace(aKnownTown()), session);

		assertThat(again.getStatus())
				.as("two events answer at one address, and everything joined to it means both")
				.isEqualTo(409);
		assertThat(reasonIn(again)).isEqualTo(EventWriteApi.THE_ADDRESS_IS_TAKEN);

		assertThat(add(aForm().withPlace(aKnownTown())
				.withDay(LocalDate.parse("2029-04-18")), session).getStatus())
				.as("the same race run the following year was refused as a duplicate")
				.isEqualTo(201);
	}

	/**
	 * EVERY WAY A FORM CAN BE WRONG IS ANSWERED AS A SENTENCE, NEVER AS A SERVER FAULT.
	 *
	 * <p>Each row here is a rule V7 also holds. Left to the database every one of them
	 * would reach an administrator as a 500 after he had filled the form in, which is the
	 * fault {@code LinkShapeMatchesTheSchemaTest} exists against one column along.
	 */
	@ParameterizedTest
	@CsvSource(nullValues = "-", value = {
			"noName, theFormIsNotComplete",
			"noDay, theFormIsNotComplete",
			"noTown, theTownIsNotSaidOnce",
			"bothTowns, theTownIsNotSaidOnce",
			"countryBesideACodebookTown, theCountryBelongsToATypedTown",
			"typedTownWithNoCountry, aTypedTownNamesItsCountry",
			"aTownNobodyHas, theTownIsNotKnown",
			"aCountryNobodyHas, theCountryIsNotKnown",
			"aLinkThatIsNotOne, theLinkIsNotShaped",
	})
	void aFormThatCannotBeWrittenIsAnsweredWithWhatIsWrongWithIt(String spoiled, String reason)
			throws Exception {

		long before = howManyEvents();
		MockHttpServletResponse answer = add(spoiledIn(spoiled), session);

		assertThat(answer.getStatus())
				.as("%s was not answered as something wrong with the form", spoiled)
				.isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("%s was refused for the wrong reason", spoiled)
				.isEqualTo(reason);
		assertThat(howManyEvents())
				.as("%s was refused and an event was written anyway", spoiled)
				.isEqualTo(before);
	}

	private Form spoiledIn(String how) {
		Form good = aForm().withPlace(aKnownTown());

		return switch (how) {
			case "noName" -> good.withName("   ");
			case "noDay" -> good.withDay(null);
			case "noTown" -> new Form(good.name(), good.date(), null, null, null,
					"race", false, "", "");
			case "bothTowns" -> new Form(good.name(), good.date(), aKnownTown(),
					"Kruševac", "RS", "race", false, "", "");
			case "countryBesideACodebookTown" -> new Form(good.name(), good.date(),
					aKnownTown(), null, "RS", "race", false, "", "");
			case "typedTownWithNoCountry" -> good.withTypedTown("Kruševac", null);
			case "aTownNobodyHas" -> good.withPlace(-1L);
			case "aCountryNobodyHas" -> good.withTypedTown("Kruševac", "ZZ");
			default -> good.withLink("btl.rs/trka");
		};
	}

	private long howManyEvents() {
		return db.sql("select count(*) from btl_event").query(Long.class).single();
	}

	/**
	 * THE CALENDAR MAY BE WRITTEN AND CHANGED BACKWARDS.
	 *
	 * <p>Owner, 31.07.2026, of the calendar: it may be changed backwards. Both routes are
	 * asked, since a rule refusing the past would be written in one of them and copied to
	 * the other, and the day is years before the day the case runs rather than yesterday -
	 * so a server comparing against today and one comparing against nothing cannot agree
	 * by accident.
	 */
	@Test
	void anEventLongPastIsWrittenAndChangedLikeAnyOther() throws Exception {
		MockHttpServletResponse written = add(aForm().withPlace(aKnownTown())
				.withDay(LocalDate.parse("2019-04-06")), session);

		assertThat(written.getStatus())
				.as("an event that was run years ago could not be entered")
				.isEqualTo(201);

		assertThat(change(acted, aForm().withPlace(aKnownTown())
				.withDay(LocalDate.parse("2018-05-05"))).getStatus())
				.as("an event could not be moved into the past")
				.isEqualTo(200);
	}

	/**
	 * AN EDIT THAT MOVES NEITHER THE NAME NOR THE YEAR LEAVES THE ADDRESS ALONE.
	 *
	 * <p>Owner, 10.08.2026: an event moved inside its season keeps its address and with it
	 * everything joined to it. The edit here moves the day by three months and changes the
	 * town, which are the two things an address is NOT made of.
	 */
	@Test
	void anEventMovedInsideItsYearKeepsItsAddress() throws Exception {
		MockHttpServletResponse answer = change(acted, new Form("Trka drugi-2027",
				LocalDate.parse("2027-09-15"), null, "Kruševac", "RS", "race", false, "", ""));

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(writtenSlug(answer))
				.as("an event put off three months was given a new address, and everything joined"
						+ " to the old one is now joined to nothing")
				.isEqualTo("drugi-2027");
	}

	/** AND ONE WHOSE NAME MOVED ANSWERS SOMEWHERE ELSE, which is the other direction. */
	@Test
	void anEventGivenAnotherNameAnswersSomewhereElse() throws Exception {
		MockHttpServletResponse answer =
				change(acted, aForm().withPlace(aKnownTown()).withName("Sasvim druga trka")
						.withDay(ITS_DAY));

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(writtenSlug(answer)).isEqualTo("sasvim-druga-trka-2027");
		assertThat(slugOf(acted)).isEqualTo("sasvim-druga-trka-2027");
	}

	/**
	 * MOVING THE DAY MOVES THAT EVENT'S RACES BY THE SAME NUMBER OF DAYS, AND NOBODY
	 * ELSE'S.
	 *
	 * <p>Owner, 10.08.2026: „Kad se datum dogadjaja pomeri, trke se pomeraju sa njim, za
	 * isti broj dana ... Isto vazi i za obicnu ispravku datuma, ne samo za kopiju." The two
	 * races sit on two different mornings, so a server that set them all to the event's new
	 * day passes nothing here; and the third race belongs to another event, so a server
	 * that moved every race passes nothing either.
	 */
	@Test
	void movingTheDayMovesThatEventsRacesByTheSameNumberOfDays() throws Exception {
		assertThat(change(acted, aForm().withPlace(aKnownTown()).withName("Trka drugi-2027")
				.withDay(ITS_DAY.plusDays(7))).getStatus()).isEqualTo(200);

		assertThat(daysOfRacesOn(acted))
				.as("the races did not travel with their event, or they were flattened onto one"
						+ " morning")
				.containsExactly("2027-06-09", "2027-06-10");

		assertThat(daysOfRacesOn(another))
				.as("another event's race moved too, so what moved was every race rather than"
						+ " this event's")
				.containsExactly("2027-09-03");
	}

	/**
	 * AND THE RESULTS TRAVEL WITH THE RACES, which nothing in the route says.
	 *
	 * <p>{@code result_race_fk} is {@code on update cascade} over {@code (race_id,
	 * race_date)}, so the database rewrites the day on every result the moment a race
	 * moves. Measured because the alternative is not a wrong day but a refused update: the
	 * reference would be violated and an administrator would meet a 500.
	 *
	 * <p>The result on the OTHER event's race is read too, and it is the half that makes
	 * this about the right rows: a cascade that moved every result would satisfy the first
	 * assertion on its own.
	 */
	@Test
	void theResultsTravelWithTheRacesTheyWereRunAt() throws Exception {
		assertThat(change(acted, aForm().withPlace(aKnownTown()).withName("Trka drugi-2027")
				.withDay(ITS_DAY.plusDays(7))).getStatus()).isEqualTo(200);

		assertThat(dayOfResultOn("Duga"))
				.as("a result stayed on the morning its race no longer runs on")
				.isEqualTo("2027-06-09");

		assertThat(dayOfResultOn("Tudja"))
				.as("a result on another event's race moved as well")
				.isEqualTo("2027-09-03");
	}

	private String dayOfResultOn(String raceName) {
		return db.sql("select to_char(r.race_date, 'YYYY-MM-DD') from result r"
						+ " join race ra on ra.id = r.race_id where ra.name = ?")
				.param(raceName).query(String.class).single();
	}

	/**
	 * AN EDIT ONTO AN ADDRESS ANOTHER EVENT HOLDS IS REFUSED, AND AN EDIT THAT CHANGES
	 * NOTHING IS NOT.
	 *
	 * <p>Both halves, because they are one line apart in the code: the question asked is
	 * "does another row hold this address", and dropping the "another" makes every event
	 * impossible to save a second time. The fixture has three events, so the address being
	 * collided with belongs to a real third party rather than to the row being edited.
	 */
	@Test
	void anEditOntoATakenAddressIsRefusedAndOneThatChangesNothingIsNot() throws Exception {
		MockHttpServletResponse onto = change(acted, aForm().withPlace(aKnownTown())
				.withName("Treci").withDay(LocalDate.parse("2027-09-03")));

		assertThat(onto.getStatus())
				.as("an event was moved onto an address another event already answers at")
				.isEqualTo(409);
		assertThat(reasonIn(onto)).isEqualTo(EventWriteApi.THE_ADDRESS_IS_TAKEN);
		assertThat(slugOf(acted))
				.as("the edit was refused and the row changed anyway")
				.isEqualTo("drugi-2027");

		assertThat(change(acted, aForm().withPlace(aKnownTown()).withName("Trka drugi-2027")
				.withDay(ITS_DAY)).getStatus())
				.as("an event could not be saved again at the address it already has")
				.isEqualTo(200);
	}

	/**
	 * DELETING AN EVENT TAKES ITS RACES AND LEAVES EVERY OTHER EVENT'S ALONE.
	 *
	 * <p><b>The cascade itself is measured against the schema</b>, in
	 * {@code CompetitorEventRaceAndResultTest}, and is not repeated here. What this asks is
	 * the route's own sentence: that it deleted the event it was given. The fixture has
	 * three, and the one deleted is not the first written, so a statement deleting the
	 * lowest key or every row answers differently.
	 */
	@Test
	void deletingAnEventTakesItsOwnRacesAndNobodyElses() throws Exception {
		assertThat(remove(acted).getStatus()).isEqualTo(204);

		assertThat(daysOfRacesOn(acted))
				.as("the races of a deleted event outlived it")
				.isEmpty();

		assertThat(daysOfRacesOn(another))
				.as("deleting one event took another event's races with it")
				.containsExactly("2027-09-03");

		assertThat(howManyEvents())
				.as("deleting one event took more than one event")
				.isEqualTo(2);
	}

	/**
	 * AND NOBODY IS TOLD THAT A RESULT DISAPPEARED WITH IT.
	 *
	 * <p>Owner, 11.08.2026, asked outright whether a member hears about it, answering in
	 * one word: „Ne." The inbox is read before and after so the assertion is about this
	 * delete rather than about an inbox that happens to be empty.
	 */
	@Test
	void nobodyIsToldWhenAResultDisappearsWithTheEvent() throws Exception {
		long before = db.sql("select count(*) from message").query(Long.class).single();

		assertThat(remove(acted).getStatus()).isEqualTo(204);

		assertThat(db.sql("select count(*) from message").query(Long.class).single())
				.as("deleting an event wrote somebody a message, which the owner refused")
				.isEqualTo(before);
	}

	/**
	 * AN EVENT THAT IS NOT THERE READS EXACTLY LIKE ONE SOMEBODY MAY NOT TOUCH.
	 *
	 * <p>Both routes that take a key, because the lookup is written once in each. 404 and
	 * no body is the same answer {@code RightsAtTheDoor} gives a refused moderator, which
	 * is ADL A8 applied to a row: a body of any kind is something an address that does not
	 * exist would not have.
	 */
	@Test
	void changingOrDeletingSomethingThatIsNotThereSaysNothingAboutIt() throws Exception {
		MockHttpServletResponse changed = change(-1, aForm().withPlace(aKnownTown()));

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
	 * AND A MODERATOR WITHOUT THE TICK IS REFUSED HERE AS EVERYWHERE ELSE.
	 *
	 * <p>Defence in depth: {@code RightsAtTheDoorTest} asks this of every guarded route and
	 * by each route's own method. The moderator used here holds a tick, just not this one,
	 * so "holds any right" and "holds THIS right" give different answers.
	 */
	@Test
	void aModeratorHoldingAnotherTickIsRefused() throws Exception {
		long before = howManyEvents();

		MockHttpServletResponse answer = add(aForm().withPlace(aKnownTown()), anotherSession);

		assertThat(answer.getStatus())
				.as("a moderator without entity:events wrote an event")
				.isEqualTo(404);
		assertThat(howManyEvents()).isEqualTo(before);
	}

}
