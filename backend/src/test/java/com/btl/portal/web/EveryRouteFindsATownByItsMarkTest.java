package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A TOWN THAT ARRIVES OVER THE WIRE IS THE CODEBOOK'S MARK, AND EVERY ROUTE THAT TAKES ONE
 * RESOLVES IT.
 *
 * <p><b>The contract, and it is one sentence in two halves.</b> {@link PlaceApi} selects
 * {@code place.geonames_id}, so the number the field that offers towns hands back is
 * GeoNames' own; {@code place.id} is a bigserial the portal has never served and no caller
 * can have. {@link RegistrationApi} writes it out beside its own {@code placeId} in as many
 * words: the portal has never seen the latter and must not start to.
 *
 * <p><b>Why this is a class of fault and not one route's slip.</b> Measured over
 * {@code V3__place.sql} on 19.09.2026: the codebook ships 47,016 towns, so a key runs from 1
 * to 47,016 while a mark runs from 362 to 13,697,165. A route that looks the arriving number
 * up as a key is wrong in two different ways at once, and only one of them is audible. For
 * 46,989 towns the mark is nobody's key, so the caller is refused a town the codebook has.
 * For the other 27 the mark falls inside the keys, so a row IS found - a different town's -
 * and it is written down with nothing said: Shahrak-e Qods (mark 362) resolved to Kharkiv,
 * Lavāsān (490) to Bijie, Alvand (10570) to Ferencváros. {@code EventWriteApi} did exactly
 * that until 19.09.2026, and nothing saw it because its own cases sent the KEY - so the code
 * and the guard agreed with each other and neither agreed with the portal.
 *
 * <p><b>THE FLOOR UNDER THE LIST BELOW.</b> {@link #probes()} is written by hand, because
 * how a route is exercised cannot be derived from anything. What CAN be derived is which
 * routes have to be in it, and that is
 * {@link #everyRouteThatTakesATownIsOneThisFileSendsATownTo}: the dispatcher knows every
 * handler, each handler knows the type of its body, and a component called {@code placeId}
 * in that type is what counts. So a third route taking a town cannot quietly appear without
 * a probe beside it - it fails this file on the day it is written, which is the day somebody
 * can still decide what it should do.
 *
 * <p><b>What the floor does NOT see, written down rather than left to be found.</b> It asks
 * the components of the body type and of any record nested inside it, so it sees a town
 * however deeply a request wraps it; it does not see a town that arrives as a path variable,
 * as a query parameter, or under a different name. There is none today - {@code placeId} on
 * a request body is the only shape on the portal - and the day one of those is written this
 * floor will not say so.
 *
 * <p><b>And the setting is built so that being right and being wrong cannot write the same
 * number.</b> The two towns it uses are asserted to carry a mark and a key that differ, and
 * the second is asserted to be a town whose mark really is ANOTHER row's key. Neither is the
 * first town of the codebook. The answer of the route is not read at all; what is read is the
 * row.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class EveryRouteFindsATownByItsMarkTest {

	/**
	 * The one name written down here, and it has to be: it is the name the form, the request
	 * and the codebook all use, and nothing but agreement makes it the right one. That is
	 * the same single written name {@code PlaceIdentityTest} keeps for the column, and for
	 * the same reason.
	 */
	private static final String THE_TOWN = "placeId";

	private static final String MODERATOR = "sifarnik@primer.rs";

	/** Twelve characters and not on the shipped list, which is what the policy asks for. */
	private static final String PASSWORD = "trcim.kroz.sumu.2027";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/**
	 * The dispatcher, and the qualifier is not decoration: the actuator maps routes of its
	 * own through a second bean of this type, which is a different question altogether.
	 */
	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

	private String session;

	@BeforeEach
	void aModeratorWhoMayWriteTheCalendar() {
		session = account(MODERATOR);

		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'entity:events')")
				.param(MODERATOR).update();
	}

	/**
	 * EVERY ROUTE THAT TAKES A TOWN IS ONE THIS FILE SENDS A TOWN TO.
	 *
	 * <p>The derived half of this file. Nothing here names a route: the set on the left is
	 * what the dispatcher and the language answer between them, and the set on the right is
	 * the table below. A route added with a {@code placeId} and no probe fails here, and a
	 * probe left behind by a route that lost its town fails here too, which is why the two
	 * sets are compared rather than one being contained in the other.
	 */
	@Test
	void everyRouteThatTakesATownIsOneThisFileSendsATownTo() {
		assertThat(routesTakingATown())
				.as("no route on the portal takes a town over the wire at all, so every"
						+ " measurement in this file is about nothing")
				.isNotEmpty();

		assertThat(routesTakingATown())
				.as("a route takes a %s and this file does not send it one, or it sends one to a"
						+ " route that no longer takes it. Whichever it is, the question this file"
						+ " asks is no longer being asked of the whole portal", THE_TOWN)
				.containsExactlyInAnyOrderElementsOf(probes().keySet());
	}

	/**
	 * AND EACH OF THEM WRITES DOWN THE TOWN THAT WAS CHOSEN.
	 *
	 * <p>Both towns against every route, because the two readings tell the two towns apart
	 * in different ways: on the first, a route reading the mark as a key finds nothing and
	 * says so out loud; on the second it finds another town and says nothing at all. A guard
	 * that used only the first would pass a route that had learnt to invent a town rather
	 * than to resolve one.
	 */
	@Test
	void everyRouteThatTakesATownWritesDownTheOneThatWasChosen() throws Exception {
		for (Map.Entry<String, Probe> route : probes().entrySet()) {
			for (Town town : theTwoTownsThatTellTheTwoReadingsApart()) {
				assertThat(route.getValue().theKeyWrittenFor(town))
						.as("%s was sent %s by the mark %d, which is what /api/places serves, and"
										+ " the row it wrote does not name that town - whose key is %d",
								route.getKey(), town.name(), town.mark(), town.key())
						.isEqualTo(town.key());
			}
		}
	}

	/**
	 * One route, exercised with a town, answering with the key that ended up in the row.
	 *
	 * <p>It is handed the whole town and not only the mark, because a probe has a setting of
	 * its own to assert before it sends anything: {@link #anEventEdited} has to know that the
	 * row it starts from does NOT already stand on the town it is about to name.
	 */
	@FunctionalInterface
	private interface Probe {

		long theKeyWrittenFor(Town town) throws Exception;
	}

	/**
	 * HOW EACH ROUTE IS EXERCISED, and this is the hand written half.
	 *
	 * <p>It has to be: what a complete request to a route looks like is not something any
	 * tool answers, and a body assembled out of nulls would be refused for a reason that has
	 * nothing to do with a town. The floor above is what makes writing it by hand safe.
	 *
	 * <p>Every probe answers the same question - what key is in the row afterwards - and
	 * none of them reads the ANSWER of the route. A route that resolved nothing would return
	 * the same address and the same 201 either way; the row is where the two readings differ.
	 */
	private Map<String, Probe> probes() {
		Map<String, Probe> table = new LinkedHashMap<>();

		table.put("POST /api/events", this::anEventWritten);
		table.put("PUT /api/events/{id}", this::anEventEdited);
		table.put("POST /api/registration", this::aMemberRegistered);

		return table;
	}

	private long anEventWritten(Town town) throws Exception {
		MockHttpServletResponse answer = http.perform(post("/api/events").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(anEventNamed("Upisana " + town.mark(), town.mark())))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();

		assertThat(answer.getStatus())
				.as("an event naming %s by the mark /api/places serves was not written",
						town.name())
				.isEqualTo(201);

		return placeKeyOfEvent(writtenId(answer));
	}

	/**
	 * The edit is given an event that already stands on a THIRD town, and that the third is
	 * really a third is asserted rather than hoped for: started on the town it is about to be
	 * told, a route that wrote no town at all would answer this probe correctly.
	 */
	private long anEventEdited(Town town) throws Exception {
		long standing = writtenId(http.perform(post("/api/events").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(anEventNamed("Izmenjena " + town.mark(),
								aTownOtherThan(town.mark()))))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse());

		assertThat(placeKeyOfEvent(standing))
				.as("the event this edit starts from already stands on %s, so an edit that left"
						+ " the town alone would answer correctly", town.name())
				.isNotEqualTo(town.key());

		MockHttpServletResponse answer = http.perform(put("/api/events/" + standing).with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(anEventNamed("Izmenjena " + town.mark(), town.mark())))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();

		assertThat(answer.getStatus())
				.as("an edit naming %s by the mark /api/places serves was refused", town.name())
				.isEqualTo(200);

		return placeKeyOfEvent(standing);
	}

	private long aMemberRegistered(Town town) throws Exception {
		long mark = town.mark();
		String address = "clan" + mark + "@primer.rs";
		Map<String, Object> form = new LinkedHashMap<>();

		form.put("firstName", "Petar");
		form.put("lastName", "Petrovic");
		form.put("fatherName", "Milorad");
		form.put("birthDate", LocalDate.now(SeasonClock.ZONE).minusYears(30).toString());
		form.put("gender", "M");
		form.put("firstSeason2027", true);
		form.put("email", address);
		form.put("password", PASSWORD);
		form.put("passwordRepeat", PASSWORD);
		form.put("address", "Ulica slobode 15/4");
		form.put(THE_TOWN, mark);
		form.put("idNumber", "AB1234567");
		form.put("shirtSize", "L");
		form.put("healthStatement", true);

		MockHttpServletResponse answer = http.perform(post("/api/registration").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(json(form)))
				.andReturn().getResponse();

		assertThat(answer.getStatus())
				.as("a registration naming a town of the codebook by its mark was refused")
				.isEqualTo(204);

		return db.sql("select c.place_id from competitor c"
						+ " join account a on a.competitor_id = c.id where a.email = ?")
				.param(address).query(Long.class).single();
	}

	private Map<String, Object> anEventNamed(String name, long mark) {
		Map<String, Object> form = new LinkedHashMap<>();

		form.put("name", name);
		form.put("date", "2028-04-18");
		form.put(THE_TOWN, mark);
		form.put("kind", "race");
		form.put("featured", false);
		form.put("description", "");
		form.put("link", "");

		return form;
	}

	private String json(Map<String, Object> form) {
		return new ObjectMapper().writeValueAsString(form);
	}

	private long writtenId(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("id").asLong();
	}

	private long placeKeyOfEvent(long event) {
		return db.sql("select place_id from btl_event where id = ?").param(event)
				.query(Long.class).single();
	}

	/** A town as the portal sees it from both sides: the number that travels and the row. */
	private record Town(long mark, long key, String name) {
	}

	/**
	 * THE TWO TOWNS, AND WHAT THE SETTING ASSERTS ABOUT THEM BEFORE ANYTHING IS MEASURED.
	 *
	 * <p>The first carries a mark that is the key of no row at all, which is 46,989 of the
	 * codebook. The second carries a mark that IS another row's key, which is the other 27,
	 * and it is the one a wrong reading writes in silence.
	 *
	 * <p>Both are asserted here rather than assumed, because the codebook is regenerated and
	 * a rebuild that happened to line the two numbers up for the town this query picks would
	 * leave every case below green and measuring nothing at all.
	 */
	private List<Town> theTwoTownsThatTellTheTwoReadingsApart() {
		Town unmistakable = aTown("geonames_id > (select max(id) from place) and rank > 1"
				+ " order by rank limit 1");
		Town mistakable = aTown("geonames_id <= (select max(id) from place) and geonames_id <> id"
				+ " order by rank limit 1");
		Town mistakenFor = aTown("id = ?", mistakable.mark());

		assertThat(unmistakable.mark())
				.as("the town this file sends carries one number for both, so reading the mark and"
						+ " reading the key give the same row and nothing below is measured")
				.isNotEqualTo(unmistakable.key());
		assertThat(mistakenFor.key())
				.as("no town was found whose mark is another town's key, so the silent half of the"
						+ " fault cannot happen in this setting at all")
				.isEqualTo(mistakable.mark());
		assertThat(mistakenFor.key())
				.as("the town sent and the town its mark names are one row, so a route that is"
						+ " right and a route that is wrong write the same number")
				.isNotEqualTo(mistakable.key());

		return List.of(unmistakable, mistakable);
	}

	/** Some other town of the codebook, so an edit that kept its own town still fails. */
	private long aTownOtherThan(long mark) {
		return db.sql("select geonames_id from place where geonames_id <> ? order by rank limit 1")
				.param(mark).query(Long.class).single();
	}

	private Town aTown(String which, Object... params) {
		return db.sql("select geonames_id, id, name from place where " + which)
				.params(params)
				.query((row, one) -> new Town(row.getLong(1), row.getLong(2), row.getString(3)))
				.single();
	}

	/**
	 * THE ROUTES THAT TAKE A TOWN, asked of the dispatcher and of the language.
	 *
	 * <p>{@code getHandlerMethods()} is every route the portal maps, which is the same
	 * question {@code RightsAtTheDoorTest} and {@code ApiSecurityTest} ask of it, and
	 * {@link #namesOf} is their shape for saying which route that is. Nothing here reads the
	 * text of a controller and nothing here reads the text of a query: what a route takes is
	 * a type, and what a type has is its components.
	 */
	private List<String> routesTakingATown() {
		return mappings.getHandlerMethods().entrySet().stream()
				.filter(one -> takesATown(one.getValue()))
				.flatMap(one -> namesOf(one.getKey()))
				.distinct().sorted().toList();
	}

	/**
	 * WHETHER THIS HANDLER TAKES A TOWN, and it is the record that answers rather than a
	 * list of routes.
	 *
	 * <p>Nested records are followed, so a request that one day wraps its town in a type of
	 * its own is still seen; {@code seen} is what stops a record that holds one of its own
	 * kind from walking forever.
	 */
	private static boolean takesATown(HandlerMethod handler) {
		return Stream.of(handler.getMethodParameters())
				.filter(one -> one.hasParameterAnnotation(RequestBody.class))
				.map(MethodParameter::getParameterType)
				.anyMatch(one -> holdsATown(one, new HashSet<>()));
	}

	private static boolean holdsATown(Class<?> type, Set<Class<?>> seen) {
		if (!type.isRecord() || !seen.add(type)) {
			return false;
		}

		return Stream.of(type.getRecordComponents())
				.anyMatch(one -> one.getName().equals(THE_TOWN)
						|| holdsATown(one.getType(), seen));
	}

	/**
	 * A route as the METHOD it answers to and the address it answers at, which is how the
	 * two files that already walk the dispatcher name one.
	 *
	 * <p><b>A mapping that declares no method answers EVERY verb there is</b> - plain
	 * {@code @RequestMapping} writes that shape - and such a route is named {@code ANY} here
	 * rather than dropped. Dropped, it would leave the floor silent about exactly the widest
	 * route the portal could have; named, it does not match any row of the table and the
	 * floor asks for a decision. No route on the portal has that shape today.
	 */
	private static Stream<String> namesOf(RequestMappingInfo info) {
		Set<RequestMethod> declared = info.getMethodsCondition().getMethods();
		PathPatternsRequestCondition patterns = info.getPathPatternsCondition();
		Set<String> paths = patterns == null ? info.getDirectPaths() : patterns.getPatternValues();
		Stream<String> methods = declared.isEmpty() ? Stream.of("ANY")
				: declared.stream().map(RequestMethod::name);

		return methods.flatMap(method -> paths.stream().map(path -> method + " " + path));
	}

	private String account(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
						+ " 'Probic', ?, (select id from role where code = 'moderator'))")
				.param(email).update();

		SecretToken token = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, token.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return token.secret();
	}
}
