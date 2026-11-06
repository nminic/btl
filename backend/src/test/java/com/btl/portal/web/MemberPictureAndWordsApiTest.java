package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
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
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE ADMINISTRATION SETTING A MEMBER'S PICTURE AND WORDS ABOUT HIMSELF ({@link MemberPictureAndWordsApi}).
 *
 * <p>Owner, 06.11.2026 (PDL „Boksovi „Profilna slika" i „Tekst o sebi" prelaze sa Podešavanja"):
 * „Administracija na tuđoj kartici Podaci sme i da menja članovu sliku i tekst o sebi", „Izmena
 * administracije stupa odmah na profil, bez reda za proveru, i član dobija poruku u sanduče".
 *
 * <p><b>THE AXES, each with both of its states in the fixture</b>:
 *
 * <ul>
 * <li>who asks: the superadmin, a moderator over the members, a moderator over the payments only, a
 * member, nobody signed in, and the moderator about the member his own account names;</li>
 * <li>whose: the member the address names, and a THIRD member with a picture and words of his own waiting,
 * so a route that touched every member's queue, or the first member's, is told from one that touched
 * his;</li>
 * <li>what of his waits: a picture and a text, each alone in the fixture of its own route, so the picture's
 * route is seen to leave his words alone and the other way round;</li>
 * <li>to whom the message goes: him, not nobody (the whole league) and not the administrator, who has a
 * member of his own;</li>
 * <li>what changes: something, and nothing.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MemberPictureAndWordsApiTest {

	private static final String THE_SUPERADMIN = "superadmin-slika@primer.rs";

	private static final String OVER_THE_MEMBERS = "moderator-clanovi-slika@primer.rs";

	private static final String OVER_THE_PAYMENTS_ONLY = "moderator-uplate-slika@primer.rs";

	private static final String A_MEMBER = "clan-slika@primer.rs";

	/** The member the administration changes; second in the table, so „the first member" is somebody else. */
	private static final String HIS_NUMBER = "000005";

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-members-");
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

	private long first;

	private long him;

	private long aThird;

	private long theModeratorHimself;

	private long theSuperadminHimself;

	private int issued;

	private int raised;

	@BeforeEach
	void membersAndTheAdministration() {
		first = competitor("000002", "Prvi");
		him = competitor(HIS_NUMBER, "Menjani");
		aThird = competitor("000006", "Treci");
		theModeratorHimself = competitor("000003", "Moderator");
		theSuperadminHimself = competitor("000009", "Super");

		account(THE_SUPERADMIN, "superadmin", theSuperadminHimself);
		account(OVER_THE_MEMBERS, "moderator", theModeratorHimself);
		ticked(OVER_THE_MEMBERS, "entity:members");
		account(OVER_THE_PAYMENTS_ONLY, "moderator", null);
		ticked(OVER_THE_PAYMENTS_ONLY, "queue:payments");
		account(A_MEMBER, "competitor", first);

		db.sql("update competitor set bio = 'Odobren tekst.', photo_id = ? where id = ?")
				.params(aPhotoRow(), him).update();
		db.sql("update competitor set bio = 'Tekst treceg.', photo_id = ? where id = ?")
				.params(aPhotoRow(), aThird).update();
		waitingPicture(aThird);
		waitingText(aThird);
	}

	private long competitor(String number, String name) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, phone, shirt_size, health_statement_at)"
						+ " values (?, ?, 'Clan', 'M', date '1980-01-01',"
						+ " (select id from place order by rank limit 1), 2027, ?, '', false, 'none',"
						+ " 'Otac', 'Ulica 1', '0601234567', 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, name, "0011aabbccddee" + number.substring(4))
				.query(Long.class).single();
	}

	private void account(String email, String role, Long competitor) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id, email_confirmed_at,"
						+ " password_hash) values ('Ime', 'Prezime', ?, (select id from role where code = ?), ?,"
						+ " timestamptz '2026-09-02 10:00:00+00', null)")
				.params(email, role, competitor).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private long aPhotoRow() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45) returning id")
				.param(String.format("%064x", ++issued)).query(Long.class).single();
	}

	/** A picture of his waiting, at a moment of its own (the reason is `MePhotoApiTest#waitingPicture`). */
	private void waitingPicture(long competitor) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, raised_at)"
						+ " values ('profiles', ?, 'Neko Nekic', '', ?, ?)")
				.params(competitor, aPhotoRow(), moment())
				.update();
	}

	private void waitingText(long competitor) {
		db.sql("insert into verification (queue, competitor_id, subject, body, raised_at)"
						+ " values ('profiles', ?, 'Neko Nekic', 'Tekst koji ceka.', ?)")
				.params(competitor, moment())
				.update();
	}

	private Timestamp moment() {
		return Timestamp.from(Instant.parse("2026-09-01T10:00:00Z").plus(Duration.ofMinutes(++raised)));
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

	private MockHttpServletResponse picture(String number, byte[] content, String size, String email)
			throws Exception {

		MockMultipartHttpServletRequestBuilder asking = multipart("/api/members/" + number + "/photo");

		if (content != null) {
			asking.file(new MockMultipartFile("picture", "portret.jpg", MediaType.IMAGE_JPEG_VALUE, content));
		}

		asking.param("cropX", "0.25").param("cropY", "0.75").param("cropSize", size);

		return sent(asking.with(csrf()), email);
	}

	private MockHttpServletResponse picture(String number, String email) throws Exception {
		return picture(number, aJpeg("nova slika " + number), "0.5", email);
	}

	private MockHttpServletResponse words(String number, String body, String email) throws Exception {
		return sent(put("/api/members/" + number + "/bio").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(body), email);
	}

	private JsonNode body(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	private long count(String sql, Object... params) {
		return db.sql(sql).params(params).query(Long.class).single();
	}

	/** Every message there is, as „to whom: subject", nobody's written as the whole league. */
	private List<String> messages() {
		return db.sql("select coalesce(to_id::text, 'everybody') || ': ' || subject from message order by id")
				.query(String.class).list();
	}

	private long picturesWaitingOf(long competitor) {
		return count("select count(*) from verification where competitor_id = ? and queue = 'profiles'"
				+ " and state = 'waiting' and photo_id is not null", competitor);
	}

	private long textsWaitingOf(long competitor) {
		return count("select count(*) from verification where competitor_id = ? and queue = 'profiles'"
				+ " and state = 'waiting' and photo_id is null", competitor);
	}

	private String bioOf(long competitor) {
		return db.sql("select bio from competitor where id = ?").param(competitor).query(String.class).single();
	}

	private String digestStandingOn(long competitor) {
		return db.sql("select p.digest from competitor c join photo p on p.id = c.photo_id where c.id = ?")
				.param(competitor).query(String.class).single();
	}

	// THE DOOR -----------------------------------------------------------------------------------------

	@Test
	void nobodySignedInIsAskedToSignInOnBoth() throws Exception {
		assertThat(picture(HIS_NUMBER, null).getStatus()).isEqualTo(401);
		assertThat(words(HIS_NUMBER, "{\"bio\":\"x\"}", null).getStatus()).isEqualTo(401);
	}

	@Test
	void whoeverLacksTheRightOverTheMembersIsAnsweredAsIfNothingWereThere() throws Exception {
		for (String email : List.of(OVER_THE_PAYMENTS_ONLY, A_MEMBER)) {
			assertThat(picture(HIS_NUMBER, email).getStatus()).as(email).isEqualTo(404);
			assertThat(words(HIS_NUMBER, "{\"bio\":\"x\"}", email).getStatus()).as(email).isEqualTo(404);
		}

		assertThat(digestStandingOn(him)).isEqualTo(String.format("%064x", 1));
		assertThat(bioOf(him)).isEqualTo("Odobren tekst.");
		assertThat(messages()).isEmpty();
	}

	@Test
	void aNumberNobodyHasIsNotFoundAndSoIsAModeratorAboutHimself() throws Exception {
		assertThat(picture("999999", OVER_THE_MEMBERS).getStatus()).isEqualTo(404);
		assertThat(words("999999", "{\"bio\":\"x\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(404);
		assertThat(picture("000003", OVER_THE_MEMBERS).getStatus()).isEqualTo(404);
		assertThat(words("000003", "{\"bio\":\"x\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(404);

		assertThat(count("select count(*) from competitor where id = ? and (photo_id is not null or bio <> '')",
				theModeratorHimself)).isZero();
		assertThat(messages()).isEmpty();
	}

	@Test
	void theSuperadminMayChangeHisOwnAsHeMayHisData() throws Exception {
		assertThat(words("000009", "{\"bio\":\"Moje reci.\"}", THE_SUPERADMIN).getStatus()).isEqualTo(200);
		assertThat(bioOf(theSuperadminHimself)).isEqualTo("Moje reci.");
	}

	@Test
	void aBodyNobodyCanReadSentToANumberNobodyHasIsStillNotFound() throws Exception {
		assertThat(words("999999", "nije json", OVER_THE_MEMBERS).getStatus()).isEqualTo(404);
	}

	// THE PICTURE ---------------------------------------------------------------------------------------

	@Test
	void aPictureStandsAtOnceTakesHisWaitingOneAwayAndTellsHimAlone() throws Exception {
		waitingPicture(him);
		waitingText(him);

		byte[] sent = aJpeg("slika koju je postavila administracija");
		MockHttpServletResponse answer = picture(HIS_NUMBER, sent, "0.5", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);

		String digest = digestStandingOn(him);

		assertThat(digest).as("a new picture stands, not the one that stood").isNotEqualTo(String.format("%064x", 1));
		assertThat(body(answer).get("photo").asString()).isEqualTo("/api/photos/" + digest);
		assertThat(body(answer).get("crop").get("size").decimalValue()).isEqualByComparingTo("0.5");
		assertThat(Files.readAllBytes(PHOTOS.resolve(String.valueOf(
				db.sql("select photo_id from competitor where id = ?").param(him).query(Long.class).single()))))
				.isEqualTo(sent);

		assertThat(picturesWaitingOf(him)).as("his waiting picture is taken away").isZero();
		assertThat(textsWaitingOf(him)).as("his waiting words are not the picture's business").isOne();
		assertThat(picturesWaitingOf(aThird)).as("nobody else's waiting picture goes").isOne();
		assertThat(textsWaitingOf(aThird)).isOne();
		assertThat(digestStandingOn(aThird)).isEqualTo(String.format("%064x", 2));

		assertThat(messages()).containsExactly(him + ": Promenjena je vaša profilna slika");
	}

	@Test
	void aPictureForAMemberWithNoneAndNothingWaitingStandsToo() throws Exception {
		assertThat(picture("000002", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(count("select count(*) from competitor where id = ? and photo_id is not null", first)).isOne();
		assertThat(messages()).containsExactly(first + ": Promenjena je vaša profilna slika");
	}

	@Test
	void aPictureIsRefusedForWhatAMembersOwnIsRefusedFor() throws Exception {
		assertThat(body(picture(HIS_NUMBER, null, "0.5", OVER_THE_MEMBERS)).get("reason").asString())
				.isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(body(picture(HIS_NUMBER, new byte[0], "0.5", OVER_THE_MEMBERS)).get("reason").asString())
				.isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(body(picture(HIS_NUMBER, aJpeg("x"), "0", OVER_THE_MEMBERS)).get("reason").asString())
				.isEqualTo(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		assertThat(body(picture(HIS_NUMBER, "nije slika".getBytes(StandardCharsets.UTF_8), "0.5",
				OVER_THE_MEMBERS)).get("reason").asString()).isEqualTo(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		assertThat(body(picture(HIS_NUMBER, aJpeg("x".repeat(com.btl.portal.domain.photo.WhatAPictureIs.AT_MOST_BYTES)),
				"0.5", OVER_THE_MEMBERS)).get("reason").asString()).isEqualTo(MePhotoApi.THE_PICTURE_IS_TOO_BIG);

		assertThat(digestStandingOn(him)).isEqualTo(String.format("%064x", 1));
		assertThat(messages()).isEmpty();
	}

	@Test
	void aCircleThatIsNotOneIsRefusedOnEachOfItsThreeFractions() throws Exception {
		for (String[] three : List.of(new String[] {"x", "0.5", "0.5"}, new String[] {"0.5", "x", "0.5"})) {
			MockMultipartHttpServletRequestBuilder asking = multipart("/api/members/" + HIS_NUMBER + "/photo");

			asking.file(new MockMultipartFile("picture", "p.jpg", MediaType.IMAGE_JPEG_VALUE, aJpeg("y")));
			asking.param("cropX", three[0]).param("cropY", three[1]).param("cropSize", three[2]);

			assertThat(body(sent(asking.with(csrf()), OVER_THE_MEMBERS)).get("reason").asString())
					.isEqualTo(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		}
	}

	// THE WORDS -----------------------------------------------------------------------------------------

	@Test
	void wordsStandAtOnceTakeHisWaitingOnesAwayAndTellHimAlone() throws Exception {
		waitingText(him);
		waitingPicture(him);

		MockHttpServletResponse answer = words(HIS_NUMBER, "{\"bio\":\"  Nov tekst administracije.  \"}",
				OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(body(answer).get("bio").asString()).isEqualTo("Nov tekst administracije.");
		assertThat(bioOf(him)).isEqualTo("Nov tekst administracije.");
		assertThat(textsWaitingOf(him)).as("his waiting words are taken away").isZero();
		assertThat(picturesWaitingOf(him)).as("his waiting picture is not the words' business").isOne();
		assertThat(textsWaitingOf(aThird)).as("nobody else's waiting words go").isOne();
		assertThat(bioOf(aThird)).isEqualTo("Tekst treceg.");

		assertThat(messages()).containsExactly(him + ": Promenjen je vaš tekst o sebi");
	}

	@Test
	void blankWordsAreARemoval() throws Exception {
		assertThat(words(HIS_NUMBER, "{\"bio\":\"   \"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(bioOf(him)).isEmpty();
		assertThat(messages()).containsExactly(him + ": Promenjen je vaš tekst o sebi");
	}

	@Test
	void theWordsThatAlreadyStandChangeNothingAndTellNobody() throws Exception {
		assertThat(words(HIS_NUMBER, "{\"bio\":\"Odobren tekst.\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(bioOf(him)).isEqualTo("Odobren tekst.");
		assertThat(messages()).isEmpty();
	}

	@Test
	void theWordsThatStandWhileHisWaitStillTakeHisAwayAndSaySo() throws Exception {
		waitingText(him);

		assertThat(words(HIS_NUMBER, "{\"bio\":\"Odobren tekst.\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(textsWaitingOf(him)).isZero();
		assertThat(messages()).containsExactly(him + ": Promenjen je vaš tekst o sebi");
	}

	@Test
	void wordsAreAsLongAsTheMembersOwnMayBe() throws Exception {
		String longest = "a".repeat(MeWriteApi.AS_LONG_AS_THE_FORM_ALLOWS);

		assertThat(words(HIS_NUMBER, "{\"bio\":\"" + longest + "a\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(400);
		assertThat(bioOf(him)).isEqualTo("Odobren tekst.");
		assertThat(words(HIS_NUMBER, "{\"bio\":\" " + longest + " \"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(bioOf(him)).isEqualTo(longest);
	}

	@Test
	void aBodyThatCarriesNoWordsIsNotComplete() throws Exception {
		/* The last is a text holding a zero character, which PostgreSQL cannot store: refused by the mapper
		   of the application (`NoTextHoldsAZero`), never carried into the statement. */
		for (String sent : List.of("", "nije json", "[]", "[{\"bio\":\"x\"}]", "{}", "{\"bio\":3}", "{\"bio\":null}", "null",
				"{\"bio\":\"a\\u0000b\"}")) {
			MockHttpServletResponse answer = words(HIS_NUMBER, sent, OVER_THE_MEMBERS);

			assertThat(answer.getStatus()).as(sent).isEqualTo(400);
			assertThat(body(answer).get("reason").asString()).as(sent).isEqualTo(MeWriteApi.THE_FORM_IS_NOT_COMPLETE);
		}

		assertThat(words(HIS_NUMBER, "{\"bio\":\"" + "a".repeat(MeWriteApi.AS_LONG_AS_THE_FORM_ALLOWS + 1) + "\"}",
				OVER_THE_MEMBERS).getContentAsString()).contains(MeWriteApi.THE_TEXT_IS_TOO_LONG);
		assertThat(messages()).isEmpty();
	}
}
