package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.TheEndOfTheTransaction;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.photo.PicturesThatCarryMetadata;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.photo.WithoutMetadata;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * THE ADMINISTRATION SETTING AND TAKING DOWN A LEAGUE'S MARK ({@link LeagueMarkApi}).
 *
 * <p>Owner, PDL 23.11.2026, „Pravi logo lige": „ko postavlja: administracija (administrator ili moderator sa
 * pravom nad ligama) u moderaciji lige, bez odobravanja, i odmah važi", and „krug, seče se kao znak tima ...
 * čuva se original, prikazuje se u krugu".
 *
 * <p><b>THE AXES, each with both of its states in the fixture</b>:
 *
 * <ul>
 * <li>who asks: the superadmin, a moderator over the leagues, a moderator over the TEAMS (the right beside
 * it, so a door that asked for the wrong one is told apart), a member, and nobody signed in;</li>
 * <li>which league: the one the address names, and ANOTHER league with a mark of its own, written FIRST, so a
 * route that wrote the first league's row, or every league's, is told from one that wrote this one's;</li>
 * <li>with a mark and without: the league under the address starts with one, and is then left without;</li>
 * <li>the picture: one of each type the portal takes, one it does not take (a GIF), one that is no picture,
 * one too big, an empty file and none, a circle that is not one;</li>
 * <li>replacing against taking down, and what goes with each: the {@code photo} row of the mark that stood;</li>
 * <li>the season: running, and frozen (PDL 22.09.2026, „Izmena lige čija je sezona zamrznuta se odbija").</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, LeagueMarkApiTest.MarchOf2028.class })
@Transactional
class LeagueMarkApiTest {

	/** 2027 has frozen (1 January 2028 at 16:00) and 2028 runs, so both states are one fixture. */
	private static final Instant IN_MARCH = Instant.parse("2028-03-15T10:00:00Z");

	@TestConfiguration(proxyBeanMethods = false)
	static class MarchOf2028 {

		@Bean
		@Primary
		Clock inMarchOf2028() {
			return Clock.fixed(IN_MARCH, ZoneOffset.UTC);
		}
	}

	private static final String THE_SUPERADMIN = "superadmin-liga-znak@primer.rs";

	private static final String OVER_THE_LEAGUES = "moderator-lige-znak@primer.rs";

	private static final String OVER_THE_TEAMS = "moderator-timovi-znak@primer.rs";

	private static final String A_MEMBER = "clan-liga-znak@primer.rs";

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-leagues-");
		}
		catch (IOException noFolder) {
			throw new IllegalStateException("no temporary folder to keep pictures in", noFolder);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	private final Map<String, String> cookies = new HashMap<>();

	/** Another league of the same season, with a mark of its own, written first. */
	private long theFirst;

	/** The league the address names, written second. */
	private long this1;

	/** A league whose season has frozen, with a mark. */
	private long frozen;

	private long theFirstsMark;

	private long thisOnesMark;

	private long theFrozenOnesMark;

	private int issued;

	@BeforeEach
	void threeLeaguesEachWithAMarkAndTheAdministration() {
		assertThat(SeasonClock.isFrozen(2027, IN_MARCH.atZone(SeasonClock.ZONE))).isTrue();
		assertThat(SeasonClock.isFrozen(2028, IN_MARCH.atZone(SeasonClock.ZONE))).isFalse();

		theFirstsMark = aPhotoRow();
		thisOnesMark = aPhotoRow();
		theFrozenOnesMark = aPhotoRow();
		theFirst = league("prva-2028", 2028, theFirstsMark);
		this1 = league("ova-2028", 2028, thisOnesMark);
		frozen = league("zamrznuta-2027", 2027, theFrozenOnesMark);

		account(THE_SUPERADMIN, "superadmin");
		account(OVER_THE_LEAGUES, "moderator");
		ticked(OVER_THE_LEAGUES, "entity:leagues");
		account(OVER_THE_TEAMS, "moderator");
		ticked(OVER_THE_TEAMS, TeamApi.OVER_THE_TEAMS);
		account(A_MEMBER, "competitor");
	}

	private long league(String slug, int season, long mark) {
		return db.sql("insert into league (slug, name, season, rules, prizes, logo_id) values (?, ?, ?, '', '', ?)"
						+ " returning id")
				.params(slug, "Liga " + slug, season, mark).query(Long.class).single();
	}

	private long aPhotoRow() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/png', 4096, ?, 0.3, 0.7, 0.45) returning id")
				.param(String.format("%064x", 0x1e600 + ++issued)).query(Long.class).single();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at, password_hash)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?),"
						+ " timestamptz '2026-09-02 10:00:00+00', null)")
				.params(email, role).update();

		SecretToken session = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(IN_MARCH.minus(Duration.ofDays(1))),
						Timestamp.from(IN_MARCH), Timestamp.from(IN_MARCH.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private static byte[] aJpeg(String tail) {
		byte[] rest = tail.getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[3 + rest.length];

		whole[0] = (byte) 0xFF;
		whole[1] = (byte) 0xD8;
		whole[2] = (byte) 0xFF;
		System.arraycopy(rest, 0, whole, 3, rest.length);

		return whole;
	}

	private MockHttpServletResponse sent(AbstractMockHttpServletRequestBuilder<?> asks, String email) throws Exception {
		return http.perform(email == null ? asks : asks.cookie(new Cookie(SessionCookie.NAME, cookies.get(email))))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse mark(long league, byte[] content, String size, String email) throws Exception {
		MockMultipartHttpServletRequestBuilder asking = multipart("/api/leagues/" + league + "/logo");

		if (content != null) {
			asking.file(new MockMultipartFile("picture", "znak.jpg", MediaType.IMAGE_JPEG_VALUE, content));
		}

		asking.param("cropX", "0.25").param("cropY", "0.75").param("cropSize", size);

		return sent(asking.with(csrf()), email);
	}

	private MockHttpServletResponse mark(long league, String email) throws Exception {
		return mark(league, aJpeg("znak lige " + league), "0.5", email);
	}

	private MockHttpServletResponse takenDown(long league, String email) throws Exception {
		return sent(delete("/api/leagues/" + league + "/logo").with(csrf()), email);
	}

	private JsonNode body(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	private Long markOf(long league) {
		return db.sql("select logo_id from league where id = ?").param(league).query(Long.class).optional()
				.orElse(null);
	}

	private boolean stands(long photo) {
		return db.sql("select exists (select 1 from photo where id = ?)").param(photo).query(Boolean.class).single();
	}

	/** Every league's mark as it stands, which is what a refused request must leave as it found it. */
	private List<String> everyMark() {
		return db.sql("select slug || ' ' || coalesce(logo_id::text, '-') from league order by id")
				.query(String.class).list();
	}

	private List<String> asItWas() {
		return List.of("prva-2028 " + theFirstsMark, "ova-2028 " + thisOnesMark,
				"zamrznuta-2027 " + theFrozenOnesMark);
	}

	// THE DOOR -----------------------------------------------------------------------------------------

	@Test
	void nobodySignedInIsAskedToSignInOnBoth() throws Exception {
		assertThat(mark(this1, null).getStatus()).isEqualTo(401);
		assertThat(takenDown(this1, null).getStatus()).isEqualTo(401);
		assertThat(everyMark()).containsExactlyElementsOf(asItWas());
	}

	/**
	 * WHOEVER LACKS THE RIGHT OVER THE LEAGUES IS ANSWERED AS IF NOTHING WERE THERE (ADL A8), and that includes
	 * a moderator who holds the right over the TEAMS: a door asking for the right beside the one it needs is
	 * the mutation this case is written against.
	 */
	@Test
	void whoeverLacksTheRightOverTheLeaguesIsAnsweredAsIfNothingWereThere() throws Exception {
		for (String email : List.of(OVER_THE_TEAMS, A_MEMBER)) {
			assertThat(mark(this1, email).getStatus()).as(email).isEqualTo(404);
			assertThat(takenDown(this1, email).getStatus()).as(email).isEqualTo(404);
		}

		assertThat(everyMark()).containsExactlyElementsOf(asItWas());
	}

	@Test
	void aLeagueNobodyHasIsNotFoundOnBoth() throws Exception {
		long nobodys = db.sql("select max(id) + 1000 from league").query(Long.class).single();

		assertThat(mark(nobodys, OVER_THE_LEAGUES).getStatus()).isEqualTo(404);
		assertThat(takenDown(nobodys, OVER_THE_LEAGUES).getStatus()).isEqualTo(404);
		assertThat(everyMark()).containsExactlyElementsOf(asItWas());
	}

	// SETTING ------------------------------------------------------------------------------------------

	/**
	 * A MARK STANDS AT ONCE, ON THIS LEAGUE AND NO OTHER, AND THE ONE IT REPLACED GOES.
	 *
	 * <p>Read three ways: off the table (the pointer and the row of the replaced picture, once the end of the
	 * transaction is brought forward), off the disk (the file under the key the database issued is the bytes
	 * that were sent) and off the public list ({@code GET /api/leagues}, where this league now answers with the
	 * new digest and the league beside it with its own).
	 */
	@Test
	void aMarkStandsAtOnceOnThisLeagueAloneAndTheOneItReplacedGoes() throws Exception {
		byte[] sent = aJpeg("znak koji je postavila administracija");
		MockHttpServletResponse answer = mark(this1, sent, "0.5", OVER_THE_LEAGUES);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);

		Long now = markOf(this1);

		assertThat(now).as("the mark that stood still stands").isNotNull().isNotEqualTo(thisOnesMark);
		assertThat(Files.readAllBytes(PHOTOS.resolve(String.valueOf(now)))).isEqualTo(sent);

		String digest = WhatAPictureIs.digestOf(sent);

		assertThat(db.sql("select digest from photo where id = ?").param(now).query(String.class).single())
				.isEqualTo(digest);
		/* THE CIRCLE IS WRITTEN AS IT WAS SENT (review of PR 806, medium 1): the answer below is built from the numbers
		   the route was given and not from the row, so a row written with the two of them swapped answers the same
		   and is read back wrong by every page that draws the league (`LeagueMarkApi`, the insert of `photo`). */
		for (String[] column : new String[][] {{"crop_x", "0.25"}, {"crop_y", "0.75"}, {"crop_diameter", "0.5"}}) {
			assertThat(db.sql("select " + column[0] + " from photo where id = ?").param(now)
					.query(java.math.BigDecimal.class).single()).as(column[0]).isEqualByComparingTo(column[1]);
		}
		assertThat(body(answer).get("photo").asString()).isEqualTo("/api/photos/" + digest);
		assertThat(body(answer).get("crop").get("x").decimalValue()).isEqualByComparingTo("0.25");
		assertThat(body(answer).get("crop").get("y").decimalValue()).isEqualByComparingTo("0.75");
		assertThat(body(answer).get("crop").get("size").decimalValue()).isEqualByComparingTo("0.5");

		assertThat(everyMark()).as("another league's mark moved")
				.containsExactly("prva-2028 " + theFirstsMark, "ova-2028 " + now, "zamrznuta-2027 " + theFrozenOnesMark);

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(thisOnesMark)).as("the replaced mark's row is still there").isFalse();
		assertThat(stands(now)).isTrue();
		assertThat(stands(theFirstsMark)).as("the mark of the league beside it went").isTrue();

		JsonNode leagues = mapper.readTree(http.perform(get("/api/leagues")).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8));

		assertThat(StreamSupport.stream(leagues.spliterator(), false)
				.filter(one -> one.path("slug").asString().endsWith("-2028"))
				.map(one -> one.path("slug").asString() + " " + one.path("logo").asString()).toList())
				.containsExactlyInAnyOrder("ova-2028 /api/photos/" + digest, "prva-2028 /api/photos/"
						+ db.sql("select digest from photo where id = ?").param(theFirstsMark).query(String.class)
								.single());
	}

	@Test
	void theSuperadminMaySetOneToo() throws Exception {
		assertThat(mark(this1, THE_SUPERADMIN).getStatus()).isEqualTo(200);
		assertThat(markOf(this1)).isNotEqualTo(thisOnesMark);
	}

	/** A mark on a league that had none, which is every league on the day V108 lands. */
	@Test
	void aLeagueWithNoMarkTakesOne() throws Exception {
		db.sql("update league set logo_id = null where id = ?").param(this1).update();

		assertThat(mark(this1, OVER_THE_LEAGUES).getStatus()).isEqualTo(200);
		assertThat(markOf(this1)).isNotNull();
	}

	/**
	 * THE THREE TYPES THE PORTAL TAKES ARE TAKEN HERE, decided by the bytes and not by the name or the header,
	 * which every case here sends as {@code image/jpeg} and {@code znak.jpg}.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "image/jpeg", "image/png", "image/webp" })
	void eachOfTheThreeTypesIsTakenByItsBytesAndWhatTheCameraWroteIsTakenOff(String type) throws Exception {
		byte[] sent = switch (type) {
			case "image/jpeg" -> PicturesThatCarryMetadata.aTelephoneJpeg(6);
			case "image/png" -> PicturesThatCarryMetadata.aPngThatSaysEverything(6);
			default -> PicturesThatCarryMetadata.aTelephoneWebp(6);
		};

		MockHttpServletResponse answer = mark(this1, sent, "0.5", OVER_THE_LEAGUES);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);

		long photo = markOf(this1);
		byte[] stored = Files.readAllBytes(PHOTOS.resolve(String.valueOf(photo)));

		assertThat(db.sql("select media_type from photo where id = ?").param(photo).query(String.class).single())
				.isEqualTo(type).isEqualTo(WhatAPictureIs.sniff(sent));
		assertThat(PicturesThatCarryMetadata.says(stored, PicturesThatCarryMetadata.WHERE_AND_WITH_WHAT))
				.as("the %s set as the mark of a league still says where, when and with what it was taken", type)
				.isFalse();
		assertThat(stored).isEqualTo(WithoutMetadata.of(sent, type));
		assertThat(db.sql("select byte_size || ' ' || digest from photo where id = ?").param(photo)
				.query(String.class).single())
				.as("the size or the digest of the mark describe the file that was sent, not the one stored")
				.isEqualTo(stored.length + " " + WhatAPictureIs.digestOf(stored));
		assertThat(body(answer).get("photo").asString()).isEqualTo("/api/photos/" + WhatAPictureIs.digestOf(stored));
	}

	@Test
	void aMarkIsRefusedForWhatAMembersPictureIsRefusedFor() throws Exception {
		assertThat(body(mark(this1, null, "0.5", OVER_THE_LEAGUES)).path("reason").asString())
				.isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(body(mark(this1, new byte[0], "0.5", OVER_THE_LEAGUES)).path("reason").asString())
				.isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(body(mark(this1, aJpeg("x"), "0", OVER_THE_LEAGUES)).path("reason").asString())
				.isEqualTo(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		assertThat(body(mark(this1, "nije slika".getBytes(StandardCharsets.UTF_8), "0.5", OVER_THE_LEAGUES))
				.path("reason").asString()).isEqualTo(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		/* A GIF is a picture, and not one the portal takes (V8: JPEG, PNG, WebP). */
		assertThat(body(mark(this1, "GIF89a\u0001\u0000".getBytes(StandardCharsets.ISO_8859_1), "0.5",
				OVER_THE_LEAGUES)).path("reason").asString()).isEqualTo(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		assertThat(body(mark(this1, aJpeg("x".repeat(WhatAPictureIs.AT_MOST_BYTES)), "0.5", OVER_THE_LEAGUES))
				.path("reason").asString()).isEqualTo(MePhotoApi.THE_PICTURE_IS_TOO_BIG);

		assertThat(mark(this1, aJpeg("x"), "0", OVER_THE_LEAGUES).getStatus()).isEqualTo(400);
		assertThat(everyMark()).containsExactlyElementsOf(asItWas());
	}

	/** The largest picture there may be is taken, and one byte more is not: the boundary from both sides. */
	@Test
	void theLargestPictureIsTakenAndOneByteMoreIsNot() throws Exception {
		byte[] largest = aJpeg("x".repeat(WhatAPictureIs.AT_MOST_BYTES - 3));

		assertThat(largest).hasSize(WhatAPictureIs.AT_MOST_BYTES);
		assertThat(mark(this1, largest, "0.5", OVER_THE_LEAGUES).getStatus()).isEqualTo(200);
		assertThat(body(mark(theFirst, aJpeg("x".repeat(WhatAPictureIs.AT_MOST_BYTES - 2)), "0.5",
				OVER_THE_LEAGUES)).path("reason").asString()).isEqualTo(MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		assertThat(markOf(theFirst)).isEqualTo(theFirstsMark);
	}

	@Test
	void aCircleThatIsNotOneIsRefusedOnEachOfItsThreeFractions() throws Exception {
		for (String[] three : List.of(new String[] {"x", "0.5", "0.5"}, new String[] {"0.5", "x", "0.5"},
				new String[] {"0.5", "0.5", "x"})) {
			MockMultipartHttpServletRequestBuilder asking = multipart("/api/leagues/" + this1 + "/logo");

			asking.file(new MockMultipartFile("picture", "p.jpg", MediaType.IMAGE_JPEG_VALUE, aJpeg("y")));
			asking.param("cropX", three[0]).param("cropY", three[1]).param("cropSize", three[2]);

			assertThat(body(sent(asking.with(csrf()), OVER_THE_LEAGUES)).path("reason").asString())
					.isEqualTo(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		}

		assertThat(everyMark()).containsExactlyElementsOf(asItWas());
	}

	// TAKING DOWN ---------------------------------------------------------------------------------------

	@Test
	void aMarkTakenDownGoesAtOnceFromThisLeagueAlone() throws Exception {
		assertThat(takenDown(this1, OVER_THE_LEAGUES).getStatus()).isEqualTo(200);

		assertThat(everyMark()).containsExactly("prva-2028 " + theFirstsMark, "ova-2028 -",
				"zamrznuta-2027 " + theFrozenOnesMark);

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(thisOnesMark)).as("the mark taken down left its row behind").isFalse();
		assertThat(stands(theFirstsMark)).isTrue();
	}

	@Test
	void takingDownWhatIsNotThereIsNotAnError() throws Exception {
		db.sql("update league set logo_id = null where id = ?").param(this1).update();

		assertThat(takenDown(this1, OVER_THE_LEAGUES).getStatus()).isEqualTo(200);
		assertThat(markOf(this1)).isNull();
		assertThat(markOf(theFirst)).isEqualTo(theFirstsMark);
	}

	// THE FROZEN SEASON --------------------------------------------------------------------------------

	/**
	 * A FROZEN LEAGUE'S MARK IS NEITHER REPLACED NOR TAKEN DOWN, and the refusal is said (PDL 22.09.2026, „se
	 * odbija, i kaže se zašto"). Asked of the season the ROW carries, so the running league beside it is not
	 * refused by the same request shape.
	 */
	@Test
	void aFrozenLeaguesMarkIsNeitherReplacedNorTakenDown() throws Exception {
		MockHttpServletResponse set = mark(frozen, OVER_THE_LEAGUES);
		MockHttpServletResponse down = takenDown(frozen, OVER_THE_LEAGUES);

		assertThat(set.getStatus()).isEqualTo(409);
		assertThat(body(set).path("reason").asString()).isEqualTo(LeagueWriteApi.THE_SEASON_IS_FROZEN);
		assertThat(down.getStatus()).isEqualTo(409);
		assertThat(body(down).path("reason").asString()).isEqualTo(LeagueWriteApi.THE_SEASON_IS_FROZEN);
		assertThat(everyMark()).containsExactlyElementsOf(asItWas());
	}
}
