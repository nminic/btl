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

	/** The same write with no cookie at all, which is not the same as a cookie with nothing
	 *  in it: the second is a state no browser and no container can produce. */
	private MockHttpServletResponse addWithNobodyAsking(Form typed) throws Exception {
		return http.perform(post("/api/events").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(json(typed)))
				.andReturn().getResponse();
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

	private MockHttpServletResponse remove(long id, String cookie) throws Exception {
		return http.perform(delete("/api/events/" + id).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
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

	/**
	 * THE NUMBER THE FORM REALLY SENDS FOR A TOWN, which is the codebook's own mark.
	 *
	 * <p>{@code /api/places} serves {@code place.geonames_id} ({@link PlaceApi}), so what
	 * comes back over the wire is GeoNames' number and never {@code place.id} - the same
	 * sentence {@link RegistrationApi} writes beside its own {@code placeId}, and the same
	 * number {@code RegistrationApiTest} sends. Read out of a row rather than written down
	 * here, because 1 is not a mark any town has: the smallest in the codebook is 362.
	 */
	private long aKnownTown() {
		return db.sql("select geonames_id from place where rank = 1").query(Long.class).single();
	}

	/**
	 * A TOWN AS THE PORTAL SEES IT FROM BOTH SIDES: the number that travels and the row it
	 * means.
	 *
	 * <p>The two are kept as a pair rather than as two longs because every case below has
	 * to say which of them it is talking about, and a bare number called "the town" is
	 * exactly how the two came to be mistaken for each other.
	 */
	private record Town(long mark, long key, String name) {
	}

	private Town aTown(String which, Object... params) {
		return db.sql("select geonames_id, id, name from place where " + which)
				.params(params)
				.query((row, one) -> new Town(row.getLong(1), row.getLong(2), row.getString(3)))
				.single();
	}

	/**
	 * A TOWN WHOSE MARK IS THE KEY OF NO ROW AT ALL, which is all but twenty seven of them.
	 *
	 * <p>Measured over {@code V3__place.sql} on 19.09.2026: the codebook ships 47,016 towns,
	 * so a key runs from 1 to 47,016 while a mark runs from 362 to 13,697,165. For 46,989
	 * towns the mark falls outside the keys altogether, and a route reading the mark as a
	 * key finds nothing and says so.
	 *
	 * <p>Never the first town by rank, because the fixture's own events sit on the first
	 * two: "the town that was chosen" and "the town that was already there" have to be
	 * different rows or an edit that wrote neither would still look right.
	 */
	private Town aTownWhoseMarkIsNobodysKey() {
		return aTown("geonames_id > (select max(id) from place) and rank > 2 order by rank"
				+ " limit 1");
	}

	/**
	 * AND ONE WHOSE MARK IS ANOTHER TOWN'S KEY, which is the twenty seven.
	 *
	 * <p>This is the half that says nothing out loud: the route finds a row, writes it, and
	 * answers 201. Measured the same day, three of them by name: choosing Shahrak-e Qods
	 * (mark 362) wrote Kharkiv, Lavāsān (490) wrote Bijie, Alvand (10570) wrote Ferencváros.
	 */
	private Town aTownWhoseMarkIsSomebodyElsesKey() {
		return aTown("geonames_id <= (select max(id) from place) and geonames_id <> id"
				+ " order by rank limit 1");
	}

	/** The row a number names when it is read as a key, which is the wrong reading. */
	private Town theTownKeyedBy(long key) {
		return aTown("id = ?", key);
	}

	private long placeKeyOf(long event) {
		return db.sql("select place_id from btl_event where id = ?").param(event)
				.query(Long.class).single();
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
	 * A TOWN IS FOUND BY THE MARK THE PORTAL SERVES, AND NOT BY THE KEY IT NEVER SHOWS.
	 *
	 * <p><b>The contract, written down one class along:</b> {@code placeId} is the number
	 * {@code /api/places} serves, which is GeoNames' own and NOT {@code place.id} - the
	 * portal has never seen the latter and must not start to
	 * ({@link RegistrationApi}, beside its own {@code placeId}). {@link PlaceApi} is the
	 * other half of it: what that route selects is {@code place.geonames_id}, so the key is
	 * a number no caller can have.
	 *
	 * <p><b>This is the loud half of what a route reading it as a key does</b>, and it is
	 * almost all of the codebook: for 46,989 of 47,016 towns the mark is the key of no row,
	 * so an administrator choosing a town out of the list was told the town is not known.
	 *
	 * <p>The row is read out of the database rather than off the answer, because the answer
	 * carries the address and never the town: a route that resolved nothing would say 201
	 * and the same address either way.
	 */
	@Test
	void aTownIsFoundByTheMarkThePortalServesAndNotByTheKeyItNeverShows() throws Exception {
		Town chosen = aTownWhoseMarkIsNobodysKey();

		assertThat(chosen.mark())
				.as("the town this case picked carries one number for both, so reading the mark"
						+ " and reading the key give the same row and nothing is measured")
				.isNotEqualTo(chosen.key());

		MockHttpServletResponse answer = add(aForm().withPlace(chosen.mark()), session);

		assertThat(answer.getStatus())
				.as("%s is in the codebook and was refused, because the number the form sends"
						+ " was looked up as a key", chosen.name())
				.isEqualTo(201);

		assertThat(placeKeyOf(writtenId(answer)))
				.as("the event was written against a row other than the one %s is",
						chosen.name())
				.isEqualTo(chosen.key());
	}

	/**
	 * AND WHERE THE MARK HAPPENS TO BE ANOTHER TOWN'S KEY, THE TOWN THAT WAS CHOSEN IS THE
	 * ONE WRITTEN DOWN.
	 *
	 * <p><b>This is the half nothing says out loud, and it is the reason this pair is two
	 * cases rather than one.</b> Twenty seven of the codebook's marks fall inside the range
	 * the keys occupy, and for those a route reading the mark as a key finds a row, writes
	 * it, and answers 201. Measured on 19.09.2026: choosing Shahrak-e Qods wrote Kharkiv,
	 * Lavāsān wrote Bijie, Alvand wrote Ferencváros.
	 *
	 * <p>Both towns are named in the fixture and asserted to be different rows, because
	 * "the town that was chosen" and "the town a key of that number names" are the two
	 * sources this case exists to tell apart.
	 */
	@Test
	void aMarkThatIsAlsoAnotherTownsKeyStillWritesTheTownThatWasChosen() throws Exception {
		Town chosen = aTownWhoseMarkIsSomebodyElsesKey();
		Town mistaken = theTownKeyedBy(chosen.mark());

		assertThat(mistaken.key())
				.as("the fixture picked a town whose mark is nobody's key, so the silent half of"
						+ " the fault cannot happen in this setting at all")
				.isEqualTo(chosen.mark());
		assertThat(mistaken.key())
				.as("the town chosen and the town its mark names are one row, so being right and"
						+ " being wrong write the same number")
				.isNotEqualTo(chosen.key());

		MockHttpServletResponse answer = add(aForm().withPlace(chosen.mark()), session);

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(placeKeyOf(writtenId(answer)))
				.as("%s was chosen and %s was written down, and the administrator was told the"
						+ " event went in", chosen.name(), mistaken.name())
				.isEqualTo(chosen.key());
	}

	/**
	 * AND AN EDIT RESOLVES IT THE SAME WAY, which is the second door of the same action.
	 *
	 * <p>Asked of the town whose mark is somebody else's key, because that is the reading an
	 * edit can do in silence: the event already carries a town, so a route that wrote the
	 * wrong one leaves a row that looks filled in. The event being edited starts on the
	 * codebook's first town and neither of the two this case names, so a route that wrote
	 * nothing at all fails here too.
	 */
	@Test
	void anEditFindsTheTownByItsMarkAsAWriteDoes() throws Exception {
		Town chosen = aTownWhoseMarkIsSomebodyElsesKey();
		Town mistaken = theTownKeyedBy(chosen.mark());

		assertThat(mistaken.key())
				.as("the town chosen and the town its mark names are one row, so the edit has"
						+ " nothing to get wrong")
				.isNotEqualTo(chosen.key());
		assertThat(placeKeyOf(acted))
				.as("the event being edited already stands on %s, so an edit that left the town"
						+ " alone would pass this case", chosen.name())
				.isNotEqualTo(chosen.key());

		assertThat(change(acted, aForm().withPlace(chosen.mark()).withName("Trka drugi-2027")
				.withDay(ITS_DAY)).getStatus())
				.as("an edit naming %s was refused", chosen.name())
				.isEqualTo(200);

		assertThat(placeKeyOf(acted))
				.as("the edit was told %s and left %s in the row", chosen.name(), mistaken.name())
				.isEqualTo(chosen.key());
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
	 * A FORM THAT LEAVES OUT THE DESCRIPTION AND THE LINK IS WRITTEN, AND THEY LAND AS
	 * EMPTY RATHER THAN AS NOTHING.
	 *
	 * <p>V7 holds both columns NOT NULL and lets them be empty, so the two are not the same
	 * answer: left as null the insert would be refused by the database and reach an
	 * administrator as a 500 after he filled the form in, which is the fault the case below
	 * exists against one column along. Neither field is required of him - an event without
	 * a page of its own is ordinary - so the form arriving without them is the common road
	 * and not the odd one.
	 *
	 * <p>Both at once and not one at a time, because the code turns them over with one
	 * sentence each: a case that sent only one would leave the other's turn unmeasured.
	 */
	@Test
	void aFormWithoutADescriptionOrALinkIsWrittenWithBothEmpty() throws Exception {
		Form withoutEither = new Form("Trka bez strane", LocalDate.parse("2028-05-20"),
				aKnownTown(), null, null, "race", false, null, null);

		MockHttpServletResponse answer = add(withoutEither, session);

		assertThat(answer.getStatus())
				.as("an event with no description and no link of its own was refused")
				.isEqualTo(201);
		assertThat(db.sql("select description, link from btl_event where id = ?")
						.param(writtenId(answer))
						.query((row, one) -> List.of(row.getString(1), row.getString(2))).single())
				.as("a description and a link left out did not land as empty")
				.containsExactly("", "");
	}

	/**
	 * A DELETE FROM SOMEBODY WITHOUT THE RIGHT IS REFUSED, AND THE EVENT IS STILL THERE
	 * AFTERWARDS.
	 *
	 * <p>The second half is the whole case. This route answers 404 to a row that is not
	 * there AND to a caller who may not touch it - on purpose, ADL A8 applied to a row -
	 * so the number alone says nothing. The only guard that stood over this route before
	 * asked `DELETE /api/events/1` of a database holding no row with that id, so "refused"
	 * and "not there" were the same answer and the case could not tell them apart.
	 *
	 * <p>Measured rather than argued: knocking the door out FOR DELETE ALONE left the
	 * whole gate green, 1977 cases. The same mutation for PUT fell, so the measurement
	 * does separate the two and the hole was only here. What it costs in the field is an
	 * event gone with all of its races, results, intentions and comments, by the cascades
	 * V7 writes, at the hand of any signed-in member.
	 */
	@Test
	void aDeleteFromAModeratorWithoutTheRightLeavesTheEventStanding() throws Exception {
		long before = howManyEvents();

		MockHttpServletResponse answer = remove(acted, anotherSession);

		assertThat(answer.getStatus())
				.as("a moderator holding another tick deleted an event")
				.isEqualTo(404);
		assertThat(howManyEvents())
				.as("the delete was refused and an event disappeared anyway")
				.isEqualTo(before);
		assertThat(db.sql("select count(*) from btl_event where id = ?").param(acted)
						.query(Integer.class).single())
				.as("the very event the refused delete named is gone")
				.isOne();
	}

	/**
	 * NOBODY AT ALL IS ANSWERED 401, AND THAT IS WHAT HOLDS THE NARROWING IN
	 * {@code ApiSecurity}.
	 *
	 * <p>`/api/events` is the first path in this portal that ANYBODY may read and only
	 * somebody may write, and until this increment the open list carried no method at all -
	 * so a path on it was open to every verb there is. Nothing measured that, because no
	 * open path had ever mapped anything but a GET.
	 *
	 * <p>What the narrowing prevents is not a write. It is a 500: opened to POST, the
	 * request reaches {@code WhatHeMayDo}, which casts the principal to a member and says
	 * in its own javadoc why it does not check first - a route needing a right is a route
	 * this file has not opened. An anonymous caller is the string `anonymousUser`, the cast
	 * throws, and the answer becomes a THIRD reply on `/api` that tells a stranger this
	 * address exists and takes a POST, while an address mapping nothing goes on saying 404.
	 *
	 * <p>Measured before this case was written: reverting the narrowing left BOTH
	 * `EventWriteApiTest` and `OpenRoutesStayReadOnlyTest` green. The second cannot see it
	 * by construction - 500 is not 2xx and the database does not change, which is all it
	 * asks. So the narrowing had no guard anywhere, and this is it.
	 */
	@Test
	void aWriteFromNobodyIsAnsweredUnauthorisedAndNotAsAServerFault() throws Exception {
		long before = howManyEvents();

		MockHttpServletResponse answer = addWithNobodyAsking(aForm().withPlace(aKnownTown()));

		assertThat(answer.getStatus())
				.as("an anonymous write to an open path was not answered 401, and a 500 here tells"
						+ " a stranger the address exists and takes a POST")
				.isEqualTo(401);
		assertThat(howManyEvents())
				.as("nobody was refused and an event was written anyway")
				.isEqualTo(before);
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

	/**
	 * AND AN EDIT IS JUDGED BY THE SAME RULES AS A WRITE, row for row.
	 *
	 * <p>The same nine spoiled forms, sent to the other route. This is one case and not
	 * nine because the rule it holds is that there is ONE judgement and not two: a portal
	 * that grew a second, looser answer on the edit would let an administrator walk every
	 * rule above by writing a good event and then changing it into a bad one. Measured
	 * rather than assumed - before this case, both refusals on the edit route were lines no
	 * test ever reached, and a line nothing reaches is a line nothing holds.
	 *
	 * <p>The row is asked for afterwards, because a refusal that had already written half of
	 * itself would answer 400 and still leave the event changed.
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
	void anEditIsAnsweredWithWhatIsWrongWithItTheSameWay(String spoiled, String reason)
			throws Exception {

		String addressBefore = slugOf(acted);
		List<String> daysBefore = daysOfRacesOn(acted);
		long before = howManyEvents();

		MockHttpServletResponse answer = change(acted, spoiledIn(spoiled));

		assertThat(answer.getStatus())
				.as("%s was accepted on the edit route although the write route refuses it", spoiled)
				.isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("%s was refused on the edit route for a different reason than on the write"
						+ " route", spoiled)
				.isEqualTo(reason);
		assertThat(slugOf(acted))
				.as("%s was refused and the event was changed anyway", spoiled)
				.isEqualTo(addressBefore);
		assertThat(howManyEvents())
				.as("%s was refused on the edit route and an event appeared", spoiled)
				.isEqualTo(before);
		/* AND THE RACES ARE ASKED TOO, because the event row is not the whole of what an
		   edit touches: moving the day moves every race under it by the same number of
		   days. A refusal that had already done that half would answer 400, leave the
		   address alone, and change the calendar - measured before this line, a mutation
		   that shifted the race days inside the refusing branch took the whole gate
		   green, 1977 cases. */
		assertThat(daysOfRacesOn(acted))
				.as("%s was refused and the races under that event moved anyway", spoiled)
				.isEqualTo(daysBefore);
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

		/* AND THE SAME ASKED OF THE ROW, not only of the answer. The two can disagree, and
		   the answer is the half nobody would notice: a server that tells the administrator
		   the address was kept while writing a different one leaves every joined thing
		   pointing at nothing, and says it went well. Measured before this line existed -
		   passing the rebuilt address to the update while leaving the kept one in the answer
		   took the WHOLE gate green, 1977 cases. */
		assertThat(slugOf(acted))
				.as("the answer said the address was kept and the row says otherwise")
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
