package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.TheEndOfTheTransaction;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE ADMINISTRATION'S SPONSORS ({@link SponsorWriteApi}): who may, what is refused, the one main sponsor and the
 * manual order.
 *
 * <p>The postavka keeps apart what could otherwise give the same answer: four sponsors whose identities, places and
 * the main mark disagree (the main one has neither the smallest identity nor the first place, and the places are not
 * in the order of the identities), and three people besides the superadmin: a moderator with the right over the
 * sponsors, one with the right over the LEAGUES, which is the right a door copied from {@link LeagueMarkApi} would
 * ask, and a member.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class SponsorWriteApiTest {

	private static final Instant NOW = Instant.now();

	private static final String THE_SUPERADMIN = "superadmin-sponzori@primer.rs";

	private static final String OVER_THE_SPONSORS = "moderator-sponzori@primer.rs";

	private static final String OVER_THE_LEAGUES = "moderator-lige-sponzori@primer.rs";

	private static final String A_MEMBER = "clan-sponzori@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	private final Map<String, String> cookies = new HashMap<>();

	private long volt;

	private long sofra;

	private long main;

	private long planinar;

	private int issued;

	@BeforeEach
	void fourSponsorsAndThePeople() {
		/* Places 3, 0, 2, 1 for the identities in the order they are written, and the main one third. */
		volt = sponsor("Volt", 3, false, null);
		sofra = sponsor("Sofra", 0, false, null);
		main = sponsor("Glavni", 2, true, aPhotoRow());
		planinar = sponsor("Planinar", 1, false, null);

		account(THE_SUPERADMIN, "superadmin");
		account(OVER_THE_SPONSORS, "moderator");
		ticked(OVER_THE_SPONSORS, "entity:sponsors");
		account(OVER_THE_LEAGUES, "moderator");
		ticked(OVER_THE_LEAGUES, "entity:leagues");
		account(A_MEMBER, "competitor");
	}

	private long sponsor(String name, int position, boolean isMain, Long logo) {
		return db.sql("insert into sponsor (name, url, logo_id, description_sr, main, position)"
						+ " values (?, ?, ?, ?, ?, ?) returning id")
				.params(name, "https://" + name.toLowerCase() + ".primer.rs/", logo, "Opis za " + name, isMain, position)
				.query(Long.class).single();
	}

	private long aPhotoRow() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/png', 4096, ?, 0.5, 0.5, 1) returning id")
				.param(String.format("%064x", 0x5c0000 + ++issued)).query(Long.class).single();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at, password_hash)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?),"
						+ " timestamptz '2026-09-02 10:00:00+00', null)")
				.params(email, role).update();

		SecretToken session = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(NOW.minus(Duration.ofDays(1))),
						Timestamp.from(NOW), Timestamp.from(NOW.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private MockHttpServletResponse sent(AbstractMockHttpServletRequestBuilder<?> asks, String email) throws Exception {
		return http.perform(email == null ? asks : asks.cookie(new Cookie(SessionCookie.NAME, cookies.get(email))))
				.andReturn().getResponse();
	}

	private static Map<String, Object> form(String name, String url, String sr, String en, boolean isMain,
			boolean inRotation, boolean inStrip) {
		Map<String, Object> body = new LinkedHashMap<>();

		body.put("name", name);
		body.put("url", url);
		body.put("descriptionSr", sr);
		body.put("descriptionEn", en);
		body.put("main", isMain);
		body.put("inRotation", inRotation);
		body.put("inStrip", inStrip);

		return body;
	}

	private static Map<String, Object> aForm() {
		return form("Novi", "https://novi.primer.rs/", "Kratak opis", null, false, true, true);
	}

	private MockHttpServletResponse added(Map<String, Object> body, String email) throws Exception {
		return sent(post("/api/sponsors").with(csrf()).contentType(MediaType.APPLICATION_JSON)
				.content(mapper.writeValueAsString(body)), email);
	}

	private MockHttpServletResponse changed(long id, Map<String, Object> body, String email) throws Exception {
		return sent(put("/api/sponsors/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON)
				.content(mapper.writeValueAsString(body)), email);
	}

	private MockHttpServletResponse removed(long id, String email) throws Exception {
		return sent(delete("/api/sponsors/" + id).with(csrf()), email);
	}

	private MockHttpServletResponse moved(long id, String way, String email) throws Exception {
		return sent(post("/api/sponsors/" + id + "/" + way).with(csrf()), email);
	}

	private MockHttpServletResponse all(String email) throws Exception {
		return sent(get("/api/sponsors/all"), email);
	}

	private JsonNode body(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	/** Every sponsor as it stands, by identity: its name, place and whether it is main. */
	private List<String> everySponsor() {
		return db.sql("select name || ' ' || position || ' ' || main from sponsor order by id").query(String.class).list();
	}

	private List<String> asItWas() {
		return List.of("Volt 3 false", "Sofra 0 false", "Glavni 2 true", "Planinar 1 false");
	}

	/** The names in the order the administration's list draws them. */
	private List<String> theList(String email) throws Exception {
		return StreamSupport.stream(body(all(email)).spliterator(), false).map(one -> one.path("name").asString())
				.toList();
	}

	// THE DOOR -----------------------------------------------------------------------------------------

	@Test
	void nobodySignedInIsAskedToSignInAtEveryDoor() throws Exception {
		assertThat(all(null).getStatus()).isEqualTo(401);
		assertThat(added(aForm(), null).getStatus()).isEqualTo(401);
		assertThat(changed(volt, aForm(), null).getStatus()).isEqualTo(401);
		assertThat(removed(volt, null).getStatus()).isEqualTo(401);
		assertThat(moved(volt, "up", null).getStatus()).isEqualTo(401);
		assertThat(moved(volt, "down", null).getStatus()).isEqualTo(401);
		assertThat(everySponsor()).containsExactlyElementsOf(asItWas());
	}

	@Test
	void whoeverLacksTheRightOverTheSponsorsIsAnsweredAsIfNothingWereThere() throws Exception {
		for (String email : List.of(OVER_THE_LEAGUES, A_MEMBER)) {
			assertThat(all(email).getStatus()).as(email).isEqualTo(404);
			assertThat(added(aForm(), email).getStatus()).as(email).isEqualTo(404);
			assertThat(changed(volt, aForm(), email).getStatus()).as(email).isEqualTo(404);
			assertThat(removed(volt, email).getStatus()).as(email).isEqualTo(404);
			assertThat(moved(volt, "up", email).getStatus()).as(email).isEqualTo(404);
			assertThat(moved(volt, "down", email).getStatus()).as(email).isEqualTo(404);
		}

		assertThat(everySponsor()).containsExactlyElementsOf(asItWas());
	}

	@Test
	void theModeratorWithTheRightAndTheSuperadminMayBoth() throws Exception {
		assertThat(all(OVER_THE_SPONSORS).getStatus()).isEqualTo(200);
		assertThat(all(THE_SUPERADMIN).getStatus()).isEqualTo(200);
		assertThat(added(aForm(), OVER_THE_SPONSORS).getStatus()).isEqualTo(201);
		assertThat(added(form("Drugi", "https://drugi.primer.rs/", "Opis", null, false, false, false), THE_SUPERADMIN)
				.getStatus()).isEqualTo(201);
	}

	@Test
	void aSponsorNobodyHasIsNotFoundAtEveryDoorThatNamesOne() throws Exception {
		long nobodys = db.sql("select max(id) + 1000 from sponsor").query(Long.class).single();

		assertThat(changed(nobodys, aForm(), OVER_THE_SPONSORS).getStatus()).isEqualTo(404);
		assertThat(removed(nobodys, OVER_THE_SPONSORS).getStatus()).isEqualTo(404);
		assertThat(moved(nobodys, "up", OVER_THE_SPONSORS).getStatus()).isEqualTo(404);
		assertThat(moved(nobodys, "down", OVER_THE_SPONSORS).getStatus()).isEqualTo(404);
		assertThat(everySponsor()).containsExactlyElementsOf(asItWas());
	}

	// THE LIST -----------------------------------------------------------------------------------------

	@Test
	void theListIsTheMainSponsorFirstAndThenTheManualOrder() throws Exception {
		assertThat(theList(OVER_THE_SPONSORS)).containsExactly("Glavni", "Sofra", "Planinar", "Volt");
	}

	@Test
	void eachSponsorIsListedWithEveryFieldTheScreenReadsAndTheMockCarriesTheSame() throws Exception {
		db.sql("update sponsor set description_en = 'In English', in_rotation = true where id = ?").param(main)
				.update();
		db.sql("update sponsor set in_strip = true where id = ?").param(sofra).update();

		JsonNode list = body(all(OVER_THE_SPONSORS));
		JsonNode first = list.get(0);
		String digest = db.sql("select digest from photo where id = (select logo_id from sponsor where id = ?)")
				.param(main).query(String.class).single();

		assertThat(first.path("id").asLong()).isEqualTo(main);
		assertThat(first.path("name").asString()).isEqualTo("Glavni");
		assertThat(first.path("url").asString()).isEqualTo("https://glavni.primer.rs/");
		assertThat(first.path("descriptionSr").asString()).isEqualTo("Opis za Glavni");
		assertThat(first.path("descriptionEn").asString()).isEqualTo("In English");
		assertThat(first.path("main").asBoolean()).isTrue();
		assertThat(first.path("inRotation").asBoolean()).isTrue();
		assertThat(first.path("inStrip").asBoolean()).isFalse();
		assertThat(first.path("position").asInt()).isEqualTo(2);
		assertThat(first.path("logo").asString()).isEqualTo("/api/photos/" + digest);

		JsonNode second = list.get(1);

		assertThat(second.path("id").asLong()).isEqualTo(sofra);
		assertThat(second.get("descriptionEn").isNull()).isTrue();
		assertThat(second.get("logo").isNull()).isTrue();
		assertThat(second.path("inStrip").asBoolean()).isTrue();
		assertThat(second.path("inRotation").asBoolean()).isFalse();

		assertThat(Answers.fieldsOf(first)).isEqualTo(Answers.servedFields("sponsors/all.json"));
	}

	// ADDING -------------------------------------------------------------------------------------------

	@Test
	void aNewSponsorStandsLastInTheManualOrderWithWhatWasSent() throws Exception {
		MockHttpServletResponse answer = added(form("  Novi  ", " https://novi.primer.rs/ ", " Kratak opis ",
				" In English ", false, true, false), OVER_THE_SPONSORS);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(201);

		long id = body(answer).path("id").asLong();

		assertThat(db.sql("select name || '|' || url || '|' || description_sr || '|' || description_en || '|'"
						+ " || main || '|' || in_rotation || '|' || in_strip || '|' || position || '|'"
						+ " || coalesce(logo_id::text, '-') from sponsor where id = ?")
				.param(id).query(String.class).single())
				.isEqualTo("Novi|https://novi.primer.rs/|Kratak opis|In English|false|true|false|4|-");
		assertThat(theList(OVER_THE_SPONSORS)).containsExactly("Glavni", "Sofra", "Planinar", "Volt", "Novi");
	}

	@Test
	void theFirstSponsorOfAnEmptyTableStandsAtTheFirstPlace() throws Exception {
		db.sql("delete from sponsor").update();

		long id = body(added(aForm(), OVER_THE_SPONSORS)).path("id").asLong();

		assertThat(db.sql("select position from sponsor where id = ?").param(id).query(Integer.class).single())
				.isZero();
	}

	@Test
	void theBoxesLeftOutOfTheRequestAreNotTickedAndAnEnglishOfWhiteSpaceIsNone() throws Exception {
		Map<String, Object> bare = new LinkedHashMap<>();

		bare.put("name", "Goli");
		bare.put("url", "http://goli.primer.rs");
		bare.put("descriptionSr", "Opis");
		bare.put("descriptionEn", "   ");

		long id = body(added(bare, OVER_THE_SPONSORS)).path("id").asLong();

		assertThat(db.sql("select main::text || in_rotation::text || in_strip::text || coalesce(description_en, '-')"
						+ " from sponsor where id = ?")
				.param(id).query(String.class).single()).isEqualTo("falsefalsefalse-");
		assertThat(everySponsor()).contains("Glavni 2 true");
	}

	@Test
	void aNewMainSponsorTakesTheMarkOffTheOldOneInTheSameWrite() throws Exception {
		long id = body(added(form("Novi", "https://novi.primer.rs/", "Opis", null, true, true, true),
				OVER_THE_SPONSORS)).path("id").asLong();

		assertThat(db.sql("select id from sponsor where main").query(Long.class).list()).containsExactly(id);
		assertThat(theList(OVER_THE_SPONSORS)).containsExactly("Novi", "Sofra", "Planinar", "Glavni", "Volt");
	}

	// REFUSING -----------------------------------------------------------------------------------------

	private String refused(Map<String, Object> body) throws Exception {
		MockHttpServletResponse answer = added(body, OVER_THE_SPONSORS);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(400);

		return body(answer).path("reason").asString();
	}

	@Test
	void aSponsorWithNoNameLinkOrSerbianDescriptionIsNotComplete() throws Exception {
		assertThat(refused(form(null, "https://a.rs", "Opis", null, false, false, false)))
				.isEqualTo(SponsorWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(refused(form("  ", "https://a.rs", "Opis", null, false, false, false)))
				.isEqualTo(SponsorWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(refused(form("Ime", null, "Opis", null, false, false, false)))
				.isEqualTo(SponsorWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(refused(form("Ime", "https://a.rs", "", "In English", false, false, false)))
				.isEqualTo(SponsorWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(everySponsor()).containsExactlyElementsOf(asItWas());
	}

	@Test
	void eightyLettersAreTakenAndEightyOneAreNotInTheNameAndInBothDescriptions() throws Exception {
		String eighty = "č".repeat(80);
		String eightyOne = "č".repeat(81);

		assertThat(refused(form(eightyOne, "https://a.rs", "Opis", null, false, false, false)))
				.isEqualTo(SponsorWriteApi.THE_NAME_IS_TOO_LONG);
		assertThat(refused(form("Ime", "https://a.rs", eightyOne, null, false, false, false)))
				.isEqualTo(SponsorWriteApi.THE_DESCRIPTION_IS_TOO_LONG);
		assertThat(refused(form("Ime", "https://a.rs", "Opis", eightyOne, false, false, false)))
				.isEqualTo(SponsorWriteApi.THE_DESCRIPTION_IS_TOO_LONG);
		/* Counted after the white space at either end is taken off, as it is stored. */
		assertThat(added(form(" " + eighty + " ", "https://a.rs", " " + eighty + " ", eighty, false, false, false),
				OVER_THE_SPONSORS).getStatus()).isEqualTo(201);
		/* And by letters, not by what the letters take in UTF-16: a letter outside the first plane is one. */
		assertThat(added(form("Ime", "https://a.rs", "🏃".repeat(80), null, false, false, false),
				OVER_THE_SPONSORS).getStatus()).isEqualTo(201);
	}

	@Test
	void aDescriptionWrittenInCapitalsIsTaken() throws Exception {
		/* „Kako napiše neka napiše. Ovo uređuje osoba koja zna šta radi.” (owner, PDL 24.11.2026). */
		assertThat(added(form("VOLT", "https://a.rs", "ENERGETSKO PIĆE", "ENERGY DRINK", false, false, false),
				OVER_THE_SPONSORS).getStatus()).isEqualTo(201);
	}

	@ParameterizedTest
	@ValueSource(strings = {"primer.rs", "www.primer.rs", "ftp://primer.rs", "javascript:alert(1)", "https://",
			"https://primer .rs", "mailto:info@primer.rs", "//primer.rs"})
	void aLinkThatIsNotAWebAddressIsRefused(String url) throws Exception {
		assertThat(refused(form("Ime", url, "Opis", null, false, false, false)))
				.isEqualTo(SponsorWriteApi.THE_LINK_IS_NOT_A_LINK);
	}

	@Test
	void aLinkLongerThanTheCeilingIsRefusedAndOneOnItIsTaken() throws Exception {
		String on = "https://" + "a".repeat(SponsorWriteApi.A_LINK_AT_MOST - 8);

		assertThat(refused(form("Ime", on + "a", "Opis", null, false, false, false)))
				.isEqualTo(SponsorWriteApi.THE_LINK_IS_NOT_A_LINK);
		assertThat(added(form("Ime", on, "Opis", null, false, false, false), OVER_THE_SPONSORS).getStatus())
				.isEqualTo(201);
	}

	@Test
	void aChangeIsRefusedForWhatAnAdditionIsRefusedForAndChangesNothing() throws Exception {
		MockHttpServletResponse answer = changed(volt, form("Volt", "primer.rs", "Opis", null, true, true, true),
				OVER_THE_SPONSORS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(body(answer).path("reason").asString()).isEqualTo(SponsorWriteApi.THE_LINK_IS_NOT_A_LINK);
		assertThat(everySponsor()).containsExactlyElementsOf(asItWas());
	}

	// CHANGING -----------------------------------------------------------------------------------------

	@Test
	void aChangeWritesTheFormAndLeavesThePlaceAndTheLogoWhereTheyWere() throws Exception {
		MockHttpServletResponse answer = changed(main, form("Preimenovan", "https://novo.primer.rs/", "Nov opis",
				"New", true, false, true), OVER_THE_SPONSORS);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);
		assertThat(body(answer).path("id").asLong()).isEqualTo(main);
		assertThat(db.sql("select name || '|' || url || '|' || description_sr || '|' || description_en || '|'"
						+ " || main || '|' || in_rotation || '|' || in_strip || '|' || position from sponsor where id = ?")
				.param(main).query(String.class).single())
				.isEqualTo("Preimenovan|https://novo.primer.rs/|Nov opis|New|true|false|true|2");
		assertThat(db.sql("select logo_id is not null from sponsor where id = ?").param(main).query(Boolean.class)
				.single()).isTrue();
		assertThat(everySponsor()).containsExactly("Volt 3 false", "Sofra 0 false", "Preimenovan 2 true",
				"Planinar 1 false");
	}

	@Test
	void anEnglishDescriptionTakenOutOfTheFormIsNoneAgain() throws Exception {
		db.sql("update sponsor set description_en = 'In English' where id = ?").param(volt).update();

		changed(volt, form("Volt", "https://volt.primer.rs/", "Opis", "", false, false, false), OVER_THE_SPONSORS);

		assertThat(db.sql("select description_en from sponsor where id = ?").param(volt).query(String.class)
				.optional()).isEmpty();
	}

	@Test
	void markingAnotherSponsorMainTakesTheMarkOffTheOldOneInTheSameWrite() throws Exception {
		assertThat(changed(volt, form("Volt", "https://volt.primer.rs/", "Opis", null, true, false, false),
				OVER_THE_SPONSORS).getStatus()).isEqualTo(200);

		assertThat(db.sql("select id from sponsor where main").query(Long.class).list()).containsExactly(volt);
		assertThat(theList(OVER_THE_SPONSORS)).containsExactly("Volt", "Sofra", "Planinar", "Glavni");
	}

	@Test
	void theMainSponsorChangedAndStillMainStaysTheOneMainSponsor() throws Exception {
		assertThat(changed(main, form("Glavni", "https://glavni.primer.rs/", "Opis", null, true, true, true),
				OVER_THE_SPONSORS).getStatus()).isEqualTo(200);

		assertThat(db.sql("select id from sponsor where main").query(Long.class).list()).containsExactly(main);
	}

	@Test
	void theMarkTakenOffTheMainSponsorLeavesNoMainSponsor() throws Exception {
		changed(main, form("Glavni", "https://glavni.primer.rs/", "Opis", null, false, true, true), OVER_THE_SPONSORS);

		assertThat(db.sql("select count(*) from sponsor where main").query(Integer.class).single()).isZero();
		/* And the strip is then the manual order alone, the old main one at its own place. */
		assertThat(theList(OVER_THE_SPONSORS)).containsExactly("Sofra", "Planinar", "Glavni", "Volt");
	}

	// DELETING -----------------------------------------------------------------------------------------

	@Test
	void aSponsorDeletedTakesItsLogoWithItAndNobodyElse() throws Exception {
		long itsLogo = db.sql("select logo_id from sponsor where id = ?").param(main).query(Long.class).single();
		long anotherLogo = aPhotoRow();

		db.sql("update sponsor set logo_id = ? where id = ?").params(anotherLogo, volt).update();

		assertThat(removed(main, OVER_THE_SPONSORS).getStatus()).isEqualTo(204);
		assertThat(everySponsor()).containsExactly("Volt 3 false", "Sofra 0 false", "Planinar 1 false");

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(db.sql("select count(*) from photo where id = ?").param(itsLogo).query(Integer.class).single())
				.as("the deleted sponsor's logo is still there").isZero();
		assertThat(db.sql("select count(*) from photo where id = ?").param(anotherLogo).query(Integer.class).single())
				.as("another sponsor's logo went with it").isOne();
	}

	// MOVING -------------------------------------------------------------------------------------------

	@Test
	void upSwapsThePlaceWithTheOneBeforeAmongTheSponsorsThatAreNotMain() throws Exception {
		/* Manual order Sofra 0, Planinar 1, (Glavni 2), Volt 3: Volt's neighbour before it is Planinar, not Glavni. */
		assertThat(moved(volt, "up", OVER_THE_SPONSORS).getStatus()).isEqualTo(204);

		assertThat(everySponsor()).containsExactly("Volt 1 false", "Sofra 0 false", "Glavni 2 true", "Planinar 3 false");
		assertThat(theList(OVER_THE_SPONSORS)).containsExactly("Glavni", "Sofra", "Volt", "Planinar");
	}

	@Test
	void downSwapsThePlaceWithTheOneAfterAmongTheSponsorsThatAreNotMain() throws Exception {
		assertThat(moved(planinar, "down", OVER_THE_SPONSORS).getStatus()).isEqualTo(204);

		assertThat(everySponsor()).containsExactly("Volt 1 false", "Sofra 0 false", "Glavni 2 true", "Planinar 3 false");
	}

	@Test
	void theFirstUpAndTheLastDownChangeNothingAndAreNotAnError() throws Exception {
		assertThat(moved(sofra, "up", OVER_THE_SPONSORS).getStatus()).isEqualTo(204);
		assertThat(moved(volt, "down", OVER_THE_SPONSORS).getStatus()).isEqualTo(204);
		assertThat(everySponsor()).containsExactlyElementsOf(asItWas());
	}

	@Test
	void theMainSponsorIsNotMovedBecauseTheStripDrawsItFirstWhereverItStands() throws Exception {
		/* Asked after each press and not after both: an „up” and a „down” that both moved it would put it back. */
		assertThat(moved(main, "up", OVER_THE_SPONSORS).getStatus()).isEqualTo(204);
		assertThat(everySponsor()).containsExactlyElementsOf(asItWas());
		assertThat(moved(main, "down", OVER_THE_SPONSORS).getStatus()).isEqualTo(204);
		assertThat(everySponsor()).containsExactlyElementsOf(asItWas());
	}

	@Test
	void movingTwiceTakesTwoPlaces() throws Exception {
		moved(volt, "up", OVER_THE_SPONSORS);
		moved(volt, "up", OVER_THE_SPONSORS);

		assertThat(theList(OVER_THE_SPONSORS)).containsExactly("Glavni", "Volt", "Sofra", "Planinar");
	}
}
