package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.TheEndOfTheTransaction;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.photo.PicturesThatCarryMetadata;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.photo.WithoutMetadata;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
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
import java.math.BigDecimal;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A TEAM'S LOGO, SENT BY ITS EDITOR FOR APPROVAL AND SET BY THE ADMINISTRATION AT ONCE ({@link TeamLogoApi}), the
 * editor's own view of it ({@link PhotoApi#teamLogoThatWaits}), and the moderator's decision about it
 * ({@link VerificationApi}, {@link VerificationWriteApi}).
 *
 * <p>Owner, PDL 25.11.2026, „Urednik tima postavlja znak tima slikom”, the two derivations recorded beside it, and
 * the owner's answers of the same day („Logo tima, pitanja iz plana”).
 *
 * <p><b>THE AXES, each with both of its states in the fixture</b>:
 *
 * <ul>
 * <li>who asks at the editor's door: the editor (the member who has stood longest, because the SEAT names a member
 * whose fee has lapsed, so a door asking the seat alone is told apart), a plain member of the team, the editor of
 * ANOTHER team, a member with no team, the lapsed seat holder, the administration, nobody signed in;</li>
 * <li>who asks at the administration's door: the right over the teams, the superadmin, a moderator over the teams'
 * QUEUE, a moderator over the leagues, the editor, nobody signed in;</li>
 * <li>which team: the one the address names, and another with a logo of its own, written FIRST;</li>
 * <li>which row: the team's logo that waits, beside the editor's OWN portrait that waits on the profiles tab, so a
 * door that read the member's row instead of the team's is told apart;</li>
 * <li>a new picture against the circle moved over the one that waits, and the circle drawn over the logo that
 * STANDS, whose digest differs;</li>
 * <li>the state of the row: nothing waits, one waits, decided;</li>
 * <li>the seat passing while the logo waits, and the sender leaving the team for another while it waits.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, TeamLogoApiTest.InJune.class })
@Transactional
class TeamLogoApiTest {

	/** Season 2027 runs and its window is shut, so nothing here is about joining. */
	private static final Instant IN_JUNE = Instant.parse("2027-06-15T10:00:00Z");

	@TestConfiguration(proxyBeanMethods = false)
	static class InJune {

		@Bean
		@Primary
		Clock inJuneOf2027() {
			return Clock.fixed(IN_JUNE, ZoneOffset.UTC);
		}
	}

	private static final String THE_LAPSED_SEAT = "000811";

	private static final String THE_EDITOR = "000812";

	private static final String A_PLAIN_MEMBER = "000813";

	private static final String THE_OTHER_EDITOR = "000814";

	private static final String WITH_NO_TEAM = "000815";

	private static final String THE_SUPERADMIN = "superadmin-logo-tima@primer.rs";

	private static final String OVER_THE_TEAMS = "moderator-entitet-timovi-logo@primer.rs";

	private static final String OVER_THE_TEAMS_QUEUE = "moderator-red-timovi-logo@primer.rs";

	private static final String OVER_THE_PROFILES_QUEUE = "moderator-red-profili-logo@primer.rs";

	private static final String OVER_THE_LEAGUES = "moderator-lige-logo@primer.rs";

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-team-logos-");
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

	/** Another team, with a logo of its own, written first. */
	private long theOther;

	/** The team the address names. */
	private long ours;

	private long theOthersLogo;

	private long ourLogo;

	/** The editor's own portrait, waiting on the profiles tab. */
	private long hisPortraitRow;

	private long hisPortrait;

	private int issued;

	@BeforeEach
	void twoTeamsEachWithALogoTheirMembersAndTheAdministration() {
		theOthersLogo = aPhotoRow();
		ourLogo = aPhotoRow();
		theOther = team("zeleni-trkaci", "Zeleni trkači", theOthersLogo);
		ours = team("plavi-trkaci", "Plavi trkači", ourLogo);

		member(THE_LAPSED_SEAT, false);
		member(THE_EDITOR, true);
		member(A_PLAIN_MEMBER, true);
		member(THE_OTHER_EDITOR, true);
		member(WITH_NO_TEAM, true);

		in(THE_LAPSED_SEAT, ours, 2027);
		in(THE_EDITOR, ours, 2027);
		in(A_PLAIN_MEMBER, ours, 2027);
		in(THE_OTHER_EDITOR, theOther, 2027);
		seat(ours, THE_LAPSED_SEAT);
		seat(theOther, THE_OTHER_EDITOR);

		hisPortrait = aPhotoRow();
		hisPortraitRow = db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values ('profiles', ?, 'Probni Probic', '', ?) returning id")
				.params(idOf(THE_EDITOR), hisPortrait).query(Long.class).single();

		staff(THE_SUPERADMIN, "superadmin");
		staff(OVER_THE_TEAMS, "moderator");
		ticked(OVER_THE_TEAMS, TeamApi.OVER_THE_TEAMS);
		staff(OVER_THE_TEAMS_QUEUE, "moderator");
		ticked(OVER_THE_TEAMS_QUEUE, "queue:teams");
		staff(OVER_THE_PROFILES_QUEUE, "moderator");
		ticked(OVER_THE_PROFILES_QUEUE, "queue:profiles");
		staff(OVER_THE_LEAGUES, "moderator");
		ticked(OVER_THE_LEAGUES, "entity:leagues");
	}

	// FIXTURE --------------------------------------------------------------------------------------------

	private long team(String slug, String name, long logo) {
		return db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season)"
						+ " values (?, ?, '', '', (select id from place where rank = 1), null, null, ?, 2027)"
						+ " returning id")
				.params(slug, name, logo).query(Long.class).single();
	}

	private long aPhotoRow() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/png', 4096, ?, 0.3, 0.7, 0.45) returning id")
				.param(String.format("%064x", 0x7ea0 + ++issued)).query(Long.class).single();
	}

	/** A member with an account; {@code active} decides whether his fee stands for 2027 and 2028. */
	private void member(String number, boolean active) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
						+ " first_season, referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'M', date '1990-01-01', (select id from place where rank = 1),"
						+ " 2027, ?, '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-01-01 10:00:00+00')")
				.params(number, String.format("%016x", 0x7ea0 + ++issued)).update();

		if (active) {
			db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
							+ " select c.id, s.season, 'feeExempt', 'Probni Probic', timestamptz '2026-09-01 10:00:00+00'"
							+ " from competitor c cross join (values (2027), (2028)) as s (season)"
							+ " where c.member_number = ?")
					.param(number).update();
		}

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(number + "@primer.rs", number).update();

		session(number + "@primer.rs");
	}

	private void in(String number, long team, int from) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, ?)")
				.params(idOf(number), team, from).update();
	}

	private void seat(long team, String number) {
		db.sql("update team set admin_id = ? where id = ?").params(idOf(number), team).update();
	}

	private long idOf(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number).query(Long.class).single();
	}

	private void staff(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at, password_hash)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?),"
						+ " timestamptz '2026-09-02 10:00:00+00', null)")
				.params(email, role).update();

		session(email);
	}

	private void session(String email) {
		SecretToken session = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(IN_JUNE.minus(Duration.ofDays(1))),
						Timestamp.from(IN_JUNE), Timestamp.from(IN_JUNE.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private static String as(String number) {
		return number + "@primer.rs";
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

	// REQUESTS -------------------------------------------------------------------------------------------

	private MockHttpServletResponse sent(AbstractMockHttpServletRequestBuilder<?> asks, String email) throws Exception {
		return http.perform(email == null ? asks : asks.cookie(new Cookie(SessionCookie.NAME, cookies.get(email))))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse send(String key, byte[] content, String size, String over, String email)
			throws Exception {
		MockMultipartHttpServletRequestBuilder asking = multipart("/api/teams/" + key + "/own-logo");

		if (content != null) {
			asking.file(new MockMultipartFile("picture", "logo.jpg", MediaType.IMAGE_JPEG_VALUE, content));
		}

		asking.param("cropX", "0.25").param("cropY", "0.75").param("cropSize", size);

		if (over != null) {
			asking.param("over", over);
		}

		return sent(asking.with(csrf()), email);
	}

	private MockHttpServletResponse send(long team, byte[] content, String email) throws Exception {
		return send(String.valueOf(team), content, "0.5", null, email);
	}

	private MockHttpServletResponse ourLogoReadBy(String key, String email) throws Exception {
		return sent(get("/api/teams/" + key + "/own-logo"), email);
	}

	private MockHttpServletResponse takenDownByTheEditor(String key, String email) throws Exception {
		return sent(delete("/api/teams/" + key + "/own-logo").with(csrf()), email);
	}

	private MockHttpServletResponse set(long team, byte[] content, String size, String email) throws Exception {
		MockMultipartHttpServletRequestBuilder asking = multipart("/api/teams/" + team + "/logo");

		if (content != null) {
			asking.file(new MockMultipartFile("picture", "logo.jpg", MediaType.IMAGE_JPEG_VALUE, content));
		}

		asking.param("cropX", "0.25").param("cropY", "0.75").param("cropSize", size);

		return sent(asking.with(csrf()), email);
	}

	private MockHttpServletResponse takenDownByTheAdministration(long team, String email) throws Exception {
		return sent(delete("/api/teams/" + team + "/logo").with(csrf()), email);
	}

	private MockHttpServletResponse decide(long row, String body, String email) throws Exception {
		return sent(post("/api/verification/" + row + "/decision").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(body), email);
	}

	private String seen(long row) {
		return db.sql("select '\"seenPhotoId\":' || p.id || ',\"seenCrop\":{\"x\":' || p.crop_x || ',\"y\":' || p.crop_y"
						+ " || ',\"size\":' || p.crop_diameter || '}' from verification v join photo p on p.id = v.photo_id"
						+ " where v.id = ?")
				.param(row).query(String.class).single();
	}

	private JsonNode body(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	// READING THE STATE ----------------------------------------------------------------------------------

	private Long logoOf(long team) {
		return db.sql("select logo_id from team where id = ?").param(team).query(Long.class).optional().orElse(null);
	}

	/** Every team's logo, which a refused request must leave as it found it. */
	private List<String> everyLogo() {
		return db.sql("select slug || ' ' || coalesce(logo_id::text, '-') from team order by id")
				.query(String.class).list();
	}

	private List<String> asTheyWere() {
		return List.of("zeleni-trkaci " + theOthersLogo, "plavi-trkaci " + ourLogo);
	}

	/** Every row on the teams tab, as {@code team | sender | state | photo}. */
	private List<String> theTeamsTab() {
		return db.sql("select coalesce(v.team_id::text, '-') || ' | ' || coalesce(c.member_number, '-') || ' | '"
						+ " || v.state || ' | ' || coalesce(v.photo_id::text, '-')"
						+ " from verification v left join competitor c on c.id = v.competitor_id"
						+ " where v.queue = 'teams' order by v.id")
				.query(String.class).list();
	}

	private long theRowThatWaits() {
		return db.sql("select id from verification where team_id = ? and state = 'waiting'").param(ours)
				.query(Long.class).single();
	}

	private long thePictureThatWaits() {
		return db.sql("select photo_id from verification where team_id = ? and state = 'waiting'").param(ours)
				.query(Long.class).single();
	}

	private String digestOf(long photo) {
		return db.sql("select digest from photo where id = ?").param(photo).query(String.class).single();
	}

	private boolean stands(long photo) {
		return db.sql("select exists (select 1 from photo where id = ?)").param(photo).query(Boolean.class).single();
	}

	private String circleOf(long photo) {
		return db.sql("select crop_x::float8 || ' ' || crop_y::float8 || ' ' || crop_diameter::float8 from photo"
						+ " where id = ?")
				.param(photo).query(String.class).single();
	}

	private List<String> inboxOf(String number) {
		return db.sql("select subject || ' | ' || body from message where to_id = ? order by id").param(idOf(number))
				.query(String.class).list();
	}

	/** What the public list of teams answers for each team: its slug and the logo's address. */
	private List<String> thePublicList() throws Exception {
		JsonNode teams = mapper.readTree(http.perform(get("/api/teams")).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8));

		return StreamSupport.stream(teams.spliterator(), false)
				.map(one -> one.path("slug").asString() + " " + one.path("logo").asString())
				.toList();
	}

	/** The editor's own portrait is untouched by everything that happens to the team's logo. */
	private void hisPortraitIsWhereItWas() {
		assertThat(db.sql("select state || ' ' || coalesce(photo_id::text, '-') from verification where id = ?")
				.param(hisPortraitRow).query(String.class).single())
				.as("the editor's own portrait was taken for the team's logo").isEqualTo("waiting " + hisPortrait);
		assertThat(db.sql("select photo_id from competitor where member_number = ?").param(THE_EDITOR)
				.query(Long.class).optional()).as("the editor's profile took the team's logo").isEmpty();
	}

	// THE EDITOR'S DOOR ----------------------------------------------------------------------------------

	@Test
	void nobodySignedInIsAskedToSignInOnEveryDoor() throws Exception {
		assertThat(send(ours, aJpeg("a"), null).getStatus()).isEqualTo(401);
		assertThat(ourLogoReadBy(String.valueOf(ours), null).getStatus()).isEqualTo(401);
		assertThat(takenDownByTheEditor(String.valueOf(ours), null).getStatus()).isEqualTo(401);
		assertThat(sent(get("/api/teams/own-logo/" + "a".repeat(64)), null).getStatus()).isEqualTo(401);
		assertThat(set(ours, aJpeg("a"), "0.5", null).getStatus()).isEqualTo(401);
		assertThat(takenDownByTheAdministration(ours, null).getStatus()).isEqualTo(401);
		assertThat(everyLogo()).containsExactlyElementsOf(asTheyWere());
		assertThat(theTeamsTab()).isEmpty();
	}

	/**
	 * EVERYBODY BUT THE EDITOR IS ANSWERED AS IF NOTHING WERE THERE (ADL A8), and nothing is written: a plain member
	 * of the team, the editor of the team beside it, a member with no team, the member the SEAT names whose fee has
	 * lapsed, and the administration, whose right opens nothing on this door.
	 */
	@Test
	void everybodyButTheEditorIsAnsweredAsIfNothingWereThere() throws Exception {
		for (String email : List.of(as(A_PLAIN_MEMBER), as(THE_OTHER_EDITOR), as(WITH_NO_TEAM), as(THE_LAPSED_SEAT),
				OVER_THE_TEAMS, THE_SUPERADMIN)) {
			assertThat(send(ours, aJpeg("tudji " + email), email).getStatus()).as(email).isEqualTo(404);
			assertThat(ourLogoReadBy(String.valueOf(ours), email).getStatus()).as(email).isEqualTo(404);
			assertThat(takenDownByTheEditor(String.valueOf(ours), email).getStatus()).as(email).isEqualTo(404);
		}

		assertThat(everyLogo()).containsExactlyElementsOf(asTheyWere());
		assertThat(theTeamsTab()).isEmpty();
	}

	/** A team nobody has and a word where the key stands are one answer with a team that is not his. */
	@Test
	void aTeamNobodyHasAndAWordInTheKeyAreNotFound() throws Exception {
		String nobodys = String.valueOf(db.sql("select max(id) + 1000 from team").query(Long.class).single());

		for (String key : List.of(nobodys, "plavi")) {
			assertThat(send(key, aJpeg("x"), "0.5", null, as(THE_EDITOR)).getStatus()).as(key).isEqualTo(404);
			assertThat(ourLogoReadBy(key, as(THE_EDITOR)).getStatus()).as(key).isEqualTo(404);
			assertThat(takenDownByTheEditor(key, as(THE_EDITOR)).getStatus()).as(key).isEqualTo(404);
		}

		assertThat(theTeamsTab()).isEmpty();
	}

	/**
	 * THE EDITOR'S LOGO WAITS, IS NOT SEEN, AND IS HIS TO LOOK AT.
	 *
	 * <p>The row is the teams tab's, names this team and him, and holds the bytes he sent; the team still answers
	 * with the logo that stood, on the public list and on the public address of the new picture (404); his own
	 * reading answers both, each at its own address; the bytes are served to him and to nobody else.
	 */
	@Test
	void theEditorsLogoWaitsIsNotSeenAndIsHisToLookAt() throws Exception {
		byte[] sentBytes = aJpeg("logo plavih trkača");
		MockHttpServletResponse answer = send(ours, sentBytes, as(THE_EDITOR));

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);

		long picture = thePictureThatWaits();
		String digest = WhatAPictureIs.digestOf(sentBytes);

		assertThat(theTeamsTab()).containsExactly(ours + " | " + THE_EDITOR + " | waiting | " + picture);
		assertThat(Files.readAllBytes(PHOTOS.resolve(String.valueOf(picture)))).isEqualTo(sentBytes);
		assertThat(digestOf(picture)).isEqualTo(digest);
		assertThat(circleOf(picture)).isEqualTo("0.25 0.75 0.5");
		assertThat(body(answer).get("waiting").asLong()).isEqualTo(theRowThatWaits());
		assertThat(body(answer).get("digest").asString()).isEqualTo(digest);
		assertThat(body(answer).get("standing").asString()).isEqualTo(digestOf(ourLogo));
		assertThat(db.sql("select subject from verification where id = ?").param(theRowThatWaits()).query(String.class)
				.single()).isEqualTo("Plavi trkači");

		assertThat(everyLogo()).as("a logo that waits stands on a team").containsExactlyElementsOf(asTheyWere());
		assertThat(thePublicList()).containsExactlyInAnyOrder("zeleni-trkaci /api/photos/" + digestOf(theOthersLogo),
				"plavi-trkaci /api/photos/" + digestOf(ourLogo));
		assertThat(sent(get("/api/photos/" + digest), null).getStatus()).isEqualTo(404);
		assertThat(sent(get("/api/photos/" + digest), as(A_PLAIN_MEMBER)).getStatus()).isEqualTo(404);
		hisPortraitIsWhereItWas();

		JsonNode read = body(ourLogoReadBy(String.valueOf(ours), as(THE_EDITOR)));

		assertThat(read.get("waiting").get("photo").asString()).isEqualTo("/api/teams/own-logo/" + digest);
		assertThat(read.get("waiting").get("crop").get("x").decimalValue()).isEqualByComparingTo("0.25");
		assertThat(read.get("waiting").get("crop").get("y").decimalValue()).isEqualByComparingTo("0.75");
		assertThat(read.get("waiting").get("crop").get("size").decimalValue()).isEqualByComparingTo("0.5");
		assertThat(read.get("standing").get("photo").asString()).isEqualTo("/api/photos/" + digestOf(ourLogo));
		assertThat(read.get("standing").get("crop").get("size").decimalValue()).isEqualByComparingTo("0.45");

		MockHttpServletResponse bytes = sent(get("/api/teams/own-logo/" + digest), as(THE_EDITOR));

		assertThat(bytes.getStatus()).isEqualTo(200);
		assertThat(bytes.getContentAsByteArray()).isEqualTo(sentBytes);
		assertThat(bytes.getHeader("Cache-Control")).contains("private");

		for (String email : List.of(as(A_PLAIN_MEMBER), as(THE_OTHER_EDITOR), OVER_THE_TEAMS_QUEUE)) {
			assertThat(sent(get("/api/teams/own-logo/" + digest), email).getStatus()).as(email).isEqualTo(404);
		}

		/* AND THE DIGEST OF A PICTURE THAT IS NOT A TEAM'S LOGO THAT WAITS: his own portrait, the logo that stands,
		   and a digest that is no digest. */
		for (String other : List.of(digestOf(hisPortrait), digestOf(ourLogo), "nije-otisak")) {
			assertThat(sent(get("/api/teams/own-logo/" + other), as(THE_EDITOR)).getStatus()).as(other).isEqualTo(404);
		}
	}

	/** With nothing waiting and nothing standing his reading answers neither, and never the empty path. */
	@Test
	void aTeamWithNoLogoAndNothingWaitingIsReadAsNeither() throws Exception {
		db.sql("update team set logo_id = null where id = ?").param(ours).update();

		JsonNode read = body(ourLogoReadBy(String.valueOf(ours), as(THE_EDITOR)));

		assertThat(read.get("waiting").isNull()).isTrue();
		assertThat(read.get("standing").isNull()).isTrue();
	}

	/** And a file whose bytes have gone from the disk is not served: the editor is told nothing is here. */
	@Test
	void aLogoThatWaitsWithItsFileGoneIsNotServed() throws Exception {
		byte[] sentBytes = aJpeg("logo bez fajla");

		send(ours, sentBytes, as(THE_EDITOR));
		Files.delete(PHOTOS.resolve(String.valueOf(thePictureThatWaits())));

		assertThat(sent(get("/api/teams/own-logo/" + WhatAPictureIs.digestOf(sentBytes)), as(THE_EDITOR)).getStatus())
				.isEqualTo(404);
	}

	/**
	 * A SECOND SEND OVERWRITES THE ROW THAT WAITS AND KEEPS ITS PLACE (owner, 27.09.2026, „Ponovno slanje pregazi red
	 * koji čeka, ne pravi drugi”): one row, the same key and the same moment, the second picture in it, and the first
	 * picture's row gone at the end of the transaction.
	 */
	@Test
	void aSecondSendOverwritesTheRowThatWaitsAndKeepsItsPlace() throws Exception {
		/* AND THE TEAM BESIDE IT HAS A LOGO WAITING TOO, written first, so a send that overwrote any team's row is
		   told from one that overwrote this team's. */
		send(theOther, aJpeg("zeleni"), as(THE_OTHER_EDITOR));

		String theOthersRow = theTeamsTab().get(0);

		send(ours, aJpeg("prvi"), as(THE_EDITOR));

		long row = theRowThatWaits();
		long first = thePictureThatWaits();
		Timestamp raised = db.sql("select raised_at from verification where id = ?").param(row)
				.query(Timestamp.class).single();

		assertThat(send(ours, aJpeg("drugi"), as(THE_EDITOR)).getStatus()).isEqualTo(200);

		long second = thePictureThatWaits();

		assertThat(theRowThatWaits()).isEqualTo(row);
		assertThat(second).isNotEqualTo(first);
		assertThat(theTeamsTab()).containsExactly(theOthersRow, ours + " | " + THE_EDITOR + " | waiting | " + second);
		assertThat(db.sql("select raised_at from verification where id = ?").param(row).query(Timestamp.class)
				.single()).isEqualTo(raised);

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(first)).as("the overwritten logo's row is still there").isFalse();
		assertThat(stands(second)).isTrue();
		hisPortraitIsWhereItWas();
	}

	/**
	 * THE CIRCLE MOVES OVER THE LOGO THAT WAITS, ON ITS OWN ROW, naming the picture it was drawn over: the same
	 * picture with a new circle; over the logo that STANDS, over nothing waiting, and naming no picture, nothing is
	 * written.
	 */
	@Test
	void theCircleMovesOverTheLogoThatWaitsAndOnlyOverIt() throws Exception {
		assertThat(body(send(String.valueOf(ours), null, "0.5", null, as(THE_EDITOR))).path("reason").asString())
				.isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(body(send(String.valueOf(ours), null, "0.5", "/api/photos/" + digestOf(ourLogo), as(THE_EDITOR)))
				.path("reason").asString()).as("a circle over nothing waiting").isEqualTo(MePhotoApi.THE_PICTURE_HAS_CHANGED);

		byte[] sentBytes = aJpeg("logo za krug");

		send(ours, sentBytes, as(THE_EDITOR));

		long picture = thePictureThatWaits();
		String waitingAt = "/api/teams/own-logo/" + WhatAPictureIs.digestOf(sentBytes);

		MockHttpServletResponse overTheStanding = send(String.valueOf(ours), null, "0.3",
				"/api/photos/" + digestOf(ourLogo), as(THE_EDITOR));

		assertThat(overTheStanding.getStatus()).isEqualTo(409);
		assertThat(body(overTheStanding).path("reason").asString()).isEqualTo(MePhotoApi.THE_PICTURE_HAS_CHANGED);
		assertThat(circleOf(picture)).isEqualTo("0.25 0.75 0.5");
		assertThat(circleOf(ourLogo)).as("the circle went onto the logo that stands").isEqualTo("0.3 0.7 0.45");

		MockHttpServletResponse moved = send(String.valueOf(ours), null, "0.3", waitingAt, as(THE_EDITOR));

		assertThat(moved.getStatus()).as(moved.getContentAsString()).isEqualTo(200);
		assertThat(thePictureThatWaits()).isEqualTo(picture);
		assertThat(circleOf(picture)).isEqualTo("0.25 0.75 0.3");
		assertThat(circleOf(ourLogo)).isEqualTo("0.3 0.7 0.45");
		assertThat(body(moved).get("digest").asString()).isEqualTo(WhatAPictureIs.digestOf(sentBytes));
		assertThat(body(moved).get("standing").asString()).isEqualTo(digestOf(ourLogo));
		assertThat(body(send(String.valueOf(ours), null, "0", waitingAt, as(THE_EDITOR))).path("reason").asString())
				.isEqualTo(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		hisPortraitIsWhereItWas();
	}

	/**
	 * THE SEAT PASSES WHILE THE LOGO WAITS, AND THE ROW SPEAKS FOR THE NEW EDITOR: a circle he moves and a picture he
	 * sends write over the same row and name him, so a refusal's reason reaches the one who sent what it is about.
	 */
	@Test
	void theSeatPassesWhileTheLogoWaitsAndTheRowNamesTheNewEditor() throws Exception {
		byte[] sentBytes = aJpeg("logo starog urednika");

		send(ours, sentBytes, as(THE_EDITOR));

		long row = theRowThatWaits();

		seat(ours, A_PLAIN_MEMBER);

		assertThat(send(ours, aJpeg("staro"), as(THE_EDITOR)).getStatus()).as("the old editor still sends").isEqualTo(404);
		assertThat(send(String.valueOf(ours), null, "0.4", "/api/teams/own-logo/" + WhatAPictureIs.digestOf(sentBytes),
				as(A_PLAIN_MEMBER)).getStatus()).isEqualTo(200);
		assertThat(theTeamsTab()).containsExactly(ours + " | " + A_PLAIN_MEMBER + " | waiting | " + thePictureThatWaits());

		seat(ours, THE_EDITOR);
		send(ours, aJpeg("opet stari"), as(THE_EDITOR));
		assertThat(theRowThatWaits()).isEqualTo(row);
		assertThat(theTeamsTab()).containsExactly(ours + " | " + THE_EDITOR + " | waiting | " + thePictureThatWaits());
	}

	/** The refusals of a member's own picture, by the same constants, and nothing written for any of them. */
	@Test
	void aLogoIsRefusedForWhatAMembersPictureIsRefusedFor() throws Exception {
		assertThat(body(send(String.valueOf(ours), new byte[0], "0.5", null, as(THE_EDITOR))).path("reason").asString())
				.isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(body(send(String.valueOf(ours), aJpeg("x"), "0", null, as(THE_EDITOR))).path("reason").asString())
				.isEqualTo(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		assertThat(body(send(ours, "nije slika".getBytes(StandardCharsets.UTF_8), as(THE_EDITOR))).path("reason")
				.asString()).isEqualTo(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		assertThat(body(send(ours, aJpeg("x".repeat(WhatAPictureIs.AT_MOST_BYTES)), as(THE_EDITOR))).path("reason")
				.asString()).isEqualTo(MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		assertThat(body(send(ours, com.btl.portal.domain.photo.PicturesOfASize.png(5_000, 5_001), as(THE_EDITOR)))
				.path("reason").asString()).isEqualTo(MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		assertThat(send(ours, aJpeg("x"), as(THE_EDITOR)).getStatus()).isEqualTo(200);

		assertThat(theTeamsTab()).hasSize(1);
	}

	/** What the camera wrote is taken off before anything is counted, hashed or written. */
	@Test
	void whatTheCameraWroteIsTakenOffTheLogoThatWaits() throws Exception {
		byte[] telephone = PicturesThatCarryMetadata.aTelephoneJpeg(6);

		assertThat(send(ours, telephone, as(THE_EDITOR)).getStatus()).isEqualTo(200);

		byte[] stored = Files.readAllBytes(PHOTOS.resolve(String.valueOf(thePictureThatWaits())));

		assertThat(stored).isEqualTo(WithoutMetadata.of(telephone, "image/jpeg"));
		assertThat(digestOf(thePictureThatWaits())).isEqualTo(WhatAPictureIs.digestOf(stored));
	}

	/**
	 * THE EDITOR TAKES THE LOGO DOWN AT ONCE, from this team alone, and what waits stays (owner, 25.11.2026, „i
	 * urednik tima sme da ukloni logo, i to važi odmah, bez odobrenja”; what becomes of the waiting one was not
	 * decided). Taking down what is not there is not an error.
	 */
	@Test
	void theEditorTakesTheLogoDownAtOnceAndWhatWaitsStays() throws Exception {
		send(ours, aJpeg("ceka dok se uklanja"), as(THE_EDITOR));

		long waiting = thePictureThatWaits();

		assertThat(takenDownByTheEditor(String.valueOf(ours), as(THE_EDITOR)).getStatus()).isEqualTo(200);
		assertThat(everyLogo()).containsExactly("zeleni-trkaci " + theOthersLogo, "plavi-trkaci -");
		assertThat(theTeamsTab()).containsExactly(ours + " | " + THE_EDITOR + " | waiting | " + waiting);

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(ourLogo)).as("the logo taken down left its row behind").isFalse();
		assertThat(stands(waiting)).isTrue();
		assertThat(takenDownByTheEditor(String.valueOf(ours), as(THE_EDITOR)).getStatus()).isEqualTo(200);
	}

	// THE ADMINISTRATION'S DOOR --------------------------------------------------------------------------

	@Test
	void whoeverLacksTheRightOverTheTeamsIsAnsweredAsIfNothingWereThere() throws Exception {
		for (String email : List.of(OVER_THE_TEAMS_QUEUE, OVER_THE_LEAGUES, as(THE_EDITOR))) {
			assertThat(set(ours, aJpeg("a"), "0.5", email).getStatus()).as(email).isEqualTo(404);
			assertThat(takenDownByTheAdministration(ours, email).getStatus()).as(email).isEqualTo(404);
		}

		long nobodys = db.sql("select max(id) + 1000 from team").query(Long.class).single();

		assertThat(set(nobodys, aJpeg("a"), "0.5", OVER_THE_TEAMS).getStatus()).isEqualTo(404);
		assertThat(takenDownByTheAdministration(nobodys, OVER_THE_TEAMS).getStatus()).isEqualTo(404);
		assertThat(everyLogo()).containsExactlyElementsOf(asTheyWere());
	}

	/**
	 * THE ADMINISTRATION'S LOGO STANDS AT ONCE, ON THIS TEAM ALONE, AND THE EDITOR'S THAT WAITS STAYS IN THE QUEUE
	 * (owner, 25.11.2026: „logo koji čeka OSTAJE u redu, pa ga moderator kasnije može odobriti i time pregaziti logo
	 * administracije”).
	 */
	@Test
	void theAdministrationsLogoStandsAtOnceAndTheEditorsThatWaitsStays() throws Exception {
		send(ours, aJpeg("urednikov"), as(THE_EDITOR));

		long waiting = thePictureThatWaits();
		byte[] sentBytes = aJpeg("logo administracije");
		MockHttpServletResponse answer = set(ours, sentBytes, "0.5", OVER_THE_TEAMS);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);

		long now = logoOf(ours);

		assertThat(now).isNotEqualTo(ourLogo).isNotEqualTo(waiting);
		assertThat(Files.readAllBytes(PHOTOS.resolve(String.valueOf(now)))).isEqualTo(sentBytes);
		assertThat(circleOf(now)).isEqualTo("0.25 0.75 0.5");
		assertThat(body(answer).get("photo").asString()).isEqualTo("/api/photos/" + WhatAPictureIs.digestOf(sentBytes));
		assertThat(body(answer).get("crop").get("x").decimalValue()).isEqualByComparingTo("0.25");
		assertThat(everyLogo()).containsExactly("zeleni-trkaci " + theOthersLogo, "plavi-trkaci " + now);
		assertThat(theTeamsTab()).as("the administration's logo took the editor's out of the queue")
				.containsExactly(ours + " | " + THE_EDITOR + " | waiting | " + waiting);

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(ourLogo)).isFalse();
		assertThat(stands(theOthersLogo)).isTrue();

		assertThat(set(ours, aJpeg("superadmin"), "0.5", THE_SUPERADMIN).getStatus()).isEqualTo(200);
		assertThat(logoOf(ours)).isNotEqualTo(now);
	}

	@Test
	void theAdministrationsLogoIsRefusedForWhatAMembersPictureIsRefusedFor() throws Exception {
		assertThat(body(set(ours, null, "0.5", OVER_THE_TEAMS)).path("reason").asString())
				.isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(body(set(ours, aJpeg("x"), "0", OVER_THE_TEAMS)).path("reason").asString())
				.isEqualTo(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		assertThat(body(set(ours, "nije slika".getBytes(StandardCharsets.UTF_8), "0.5", OVER_THE_TEAMS)).path("reason")
				.asString()).isEqualTo(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		assertThat(everyLogo()).containsExactlyElementsOf(asTheyWere());
	}

	@Test
	void theAdministrationTakesTheLogoDownAtOnceAndWhatWaitsStays() throws Exception {
		send(ours, aJpeg("ceka"), as(THE_EDITOR));

		assertThat(takenDownByTheAdministration(ours, OVER_THE_TEAMS).getStatus()).isEqualTo(200);
		assertThat(everyLogo()).containsExactly("zeleni-trkaci " + theOthersLogo, "plavi-trkaci -");
		assertThat(theTeamsTab()).hasSize(1);
		assertThat(takenDownByTheAdministration(ours, OVER_THE_TEAMS).getStatus()).isEqualTo(200);
	}

	// THE MODERATOR --------------------------------------------------------------------------------------

	/**
	 * THE QUEUE NAMES A TEAM'S LOGO AS ONE: its own kind, the team by its key, the team's name as it is NOW, and
	 * the picture with its circle; and it is the teams tab's, so a moderator over the profiles is not shown it.
	 */
	@Test
	void theQueueNamesATeamsLogoAsOne() throws Exception {
		send(ours, aJpeg("u redu"), as(THE_EDITOR));
		db.sql("update team set name = 'Plavi trkači Beograd' where id = ?").param(ours).update();

		JsonNode queue = body(sent(get("/api/verification"), OVER_THE_TEAMS_QUEUE));
		List<JsonNode> logos = StreamSupport.stream(queue.spliterator(), false)
				.filter(one -> one.path("kind").asString().equals("teamLogo")).toList();

		assertThat(logos).hasSize(1);
		assertThat(logos.get(0).path("queue").asString()).isEqualTo("teams");
		assertThat(logos.get(0).path("subject").asString()).isEqualTo("Plavi trkači Beograd");
		assertThat(logos.get(0).path("subjectId").asString()).isEqualTo(String.valueOf(ours));
		assertThat(logos.get(0).path("memberNumber").asString()).isEqualTo(THE_EDITOR);
		assertThat(logos.get(0).path("photoId").asLong()).isEqualTo(thePictureThatWaits());
		assertThat(logos.get(0).path("crop").path("size").decimalValue()).isEqualByComparingTo("0.5");

		JsonNode profiles = body(sent(get("/api/verification"), OVER_THE_PROFILES_QUEUE));

		assertThat(StreamSupport.stream(profiles.spliterator(), false).map(one -> one.path("kind").asString()))
				.doesNotContain("teamLogo");
		assertThat(sent(get("/api/verification/" + theRowThatWaits() + "/photo"), OVER_THE_PROFILES_QUEUE).getStatus())
				.isEqualTo(404);
		assertThat(sent(get("/api/verification/" + theRowThatWaits() + "/photo"), OVER_THE_TEAMS_QUEUE).getStatus())
				.isEqualTo(200);
	}

	/**
	 * APPROVED, THE PICTURE BECOMES THIS TEAM'S LOGO, WITH THE CIRCLE THE MODERATOR LEFT, AND NOBODY IS TOLD.
	 *
	 * <p>The team is the one the ROW names, and the sender has since left it for the team beside it, so an approval
	 * that wrote into the sender's team is told apart; the sender's own portrait is not touched, so an approval that
	 * fell through to the profile is told apart too.
	 */
	@Test
	void anApprovedLogoStandsOnTheTeamTheRowNamesWithTheModeratorsCircle() throws Exception {
		send(ours, aJpeg("za odobrenje"), as(THE_EDITOR));

		long row = theRowThatWaits();
		long picture = thePictureThatWaits();

		db.sql("update team_membership set season_to = 2027, left_reason = 'left' where competitor_id = ?")
				.param(idOf(THE_EDITOR)).update();
		in(THE_EDITOR, theOther, 2028);

		MockHttpServletResponse answer = decide(row, "{\"approved\":true," + seen(row)
				+ ",\"crop\":{\"x\":0.4,\"y\":0.6,\"size\":0.35}}", OVER_THE_TEAMS_QUEUE);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);
		assertThat(everyLogo()).containsExactly("zeleni-trkaci " + theOthersLogo, "plavi-trkaci " + picture);
		assertThat(circleOf(picture)).isEqualTo("0.4 0.6 0.35");
		assertThat(theTeamsTab()).containsExactly(ours + " | " + THE_EDITOR + " | approved | -");
		assertThat(inboxOf(THE_EDITOR)).as("an approved logo sent a message").isEmpty();
		hisPortraitIsWhereItWas();

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(ourLogo)).as("the logo the approval replaced is still there").isFalse();
		assertThat(stands(picture)).isTrue();
	}

	/** An approval with no circle of the moderator's publishes the editor's circle as it was sent. */
	@Test
	void anApprovalWithNoCircleOfItsOwnKeepsTheEditors() throws Exception {
		send(ours, aJpeg("bez kruga moderatora"), as(THE_EDITOR));

		long row = theRowThatWaits();
		long picture = thePictureThatWaits();

		assertThat(decide(row, "{\"approved\":true," + seen(row) + "}", OVER_THE_TEAMS_QUEUE).getStatus()).isEqualTo(200);
		assertThat(logoOf(ours)).isEqualTo(picture);
		assertThat(circleOf(picture)).isEqualTo("0.25 0.75 0.5");
	}

	/** Refused, the logo goes, the team keeps the one it had, and the sender is told why. */
	@Test
	void aRefusedLogoGoesAndTheSenderIsToldWhy() throws Exception {
		send(ours, aJpeg("za odbijanje"), as(THE_EDITOR));

		long row = theRowThatWaits();
		long picture = thePictureThatWaits();

		assertThat(decide(row, "{\"approved\":false,\"reason\":\"Logo je mutan.\"," + seen(row) + "}",
				OVER_THE_TEAMS_QUEUE).getStatus()).isEqualTo(200);
		assertThat(everyLogo()).containsExactlyElementsOf(asTheyWere());
		assertThat(inboxOf(THE_EDITOR)).containsExactly("Stavka je odbijena | Logo je mutan.");
		assertThat(inboxOf(A_PLAIN_MEMBER)).isEmpty();

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(picture)).isFalse();
	}

	/** A decision about a logo names the picture the moderator saw; one naming another circle is refused. */
	@Test
	void aDecisionAboutALogoNamesThePictureTheModeratorSaw() throws Exception {
		send(ours, aJpeg("vidjena"), as(THE_EDITOR));

		long row = theRowThatWaits();

		assertThat(decide(row, "{\"approved\":true}", OVER_THE_TEAMS_QUEUE).getStatus()).isEqualTo(400);
		assertThat(decide(row, "{\"approved\":true,\"seenPhotoId\":" + thePictureThatWaits()
				+ ",\"seenCrop\":{\"x\":0.1,\"y\":0.1,\"size\":0.1}}", OVER_THE_TEAMS_QUEUE).getStatus()).isEqualTo(409);
		assertThat(decide(row, "{\"approved\":true," + seen(row) + "}", OVER_THE_PROFILES_QUEUE).getStatus())
				.isEqualTo(404);
		assertThat(everyLogo()).containsExactlyElementsOf(asTheyWere());
	}

	/** A logo the moderator approves after the administration set one overwrites the administration's. */
	@Test
	void aLogoApprovedAfterTheAdministrationsOverwritesIt() throws Exception {
		send(ours, aJpeg("urednikov kasnije odobren"), as(THE_EDITOR));

		long row = theRowThatWaits();
		long picture = thePictureThatWaits();

		set(ours, aJpeg("administracijin"), "0.5", OVER_THE_TEAMS);
		assertThat(decide(row, "{\"approved\":true," + seen(row) + "}", OVER_THE_TEAMS_QUEUE).getStatus()).isEqualTo(200);
		assertThat(logoOf(ours)).isEqualTo(picture);
	}

	// THE TEAM GOING -------------------------------------------------------------------------------------

	/** A team that goes takes the logo that waits for it out of the queue, and the picture's row with it. */
	@Test
	void aTeamThatGoesTakesItsWaitingLogoWithIt() throws Exception {
		send(ours, aJpeg("tim odlazi"), as(THE_EDITOR));

		long picture = thePictureThatWaits();

		db.sql("delete from team where id = ?").param(ours).update();

		assertThat(theTeamsTab()).isEmpty();

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(picture)).isFalse();
		assertThat(stands(theOthersLogo)).isTrue();
		hisPortraitIsWhereItWas();
	}

	/** And the circle is held as V21 holds it: what the route was given is what the row reads. */
	@Test
	void theCircleIsWrittenAsItWasSent() throws Exception {
		send(String.valueOf(ours), aJpeg("krug"), "0.125", null, as(THE_EDITOR));

		assertThat(db.sql("select crop_diameter from photo where id = ?").param(thePictureThatWaits())
				.query(BigDecimal.class).single()).isEqualByComparingTo("0.125");
	}
}
