package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A MEMBER SENDING A PORTRAIT AND TAKING ONE DOWN: THE FIRST ROUTE IN THIS PORTAL THAT IS
 * HANDED A FILE.
 *
 * <p>Owner, PDL P11, 12.08.2026 and PDL P28b, 3, 24.09.2026. A picture WAITS for a moderator
 * and a removal takes effect AT ONCE, which is the same pair of roads {@link MeWriteApi}
 * carries for the biography, and it is the pair this file measures on every axis it can be
 * got wrong on.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND.</b>
 *
 * <ul>
 * <li><b>FIVE MEMBERS, AND THE ONE WHO ASKS IS WRITTEN THIRD.</b> „The member asking" and
 * „the first member by key" are then different rows.
 * <li><b>EVERY PICTURE IN THE FIXTURE IS A DIFFERENT PICTURE</b>, so every digest differs
 * and „his picture" is never „a picture".
 * <li><b>SOMEBODY ELSE'S PICTURE IS ALREADY WAITING, AND IT IS WRITTEN FIRST</b>, so „the
 * picture this member is waiting on" is never „the first row" and never „the only one".
 * <li><b>THE PROFILES TAB HOLDS FOUR STATES AT ONCE</b> - a waiting picture, a waiting TEXT,
 * a DECIDED picture, and nothing - carried by four different members, and a fifth row waits
 * in another tab entirely. So the guard that refuses a second picture has four separate
 * answers to get right, and the one that tells a picture from a text is asked both ways.
 * <li><b>ONE MEMBER ALREADY HAS A PICTURE ON HIS PROFILE AND ANOTHER HAS NONE</b>, so
 * „standing" and „waiting" are never one value, and a removal has both directions to answer.
 * <li><b>THE BYTES SENT ARE NEVER THE BYTES OF ANY FIXTURE ROW</b>, so a digest written from
 * the wrong place comes back visibly wrong.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MePhotoApiTest {

	/** Written first, never asks for anything, and must never move. */
	private static final String FIRST_WRITTEN = "000100";

	/** Somebody else, whose PICTURE is already waiting and was written FIRST into the queue. */
	private static final String SOMEONE_ELSE = "000200";

	/** The member most cases ask with, written third. He has a picture on his profile. */
	private static final String ME = "000300";

	/** His own picture is standing in the queue undecided, so a second one is refused. */
	private static final String WHOSE_PICTURE_WAITS = "000400";

	/** What is waiting on him is a TEXT, which is not a picture and stops nothing. */
	private static final String WHOSE_TEXT_WAITS = "000500";

	/** His picture was REFUSED, which must not stop him sending another. */
	private static final String WHOSE_PICTURE_WAS_REFUSED = "000600";

	/** He has no picture at all, which is what a removal has to answer for too. */
	private static final String HAS_NO_PICTURE = "000700";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	private static final String THE_PROFILES_TAB = "profiles";

	/** The member's own name, which is what a card about his profile must carry. */
	private static final String MY_NAME = "Milica";

	private static final String MY_SURNAME = "Mitrovic";

	/** The name on EVERY account, and it is on no member (PDL P21). */
	private static final String THE_NAME_ON_THE_ACCOUNT = "Roditelj";

	private static final String NOTHING_IS_THERE = "/api/nema-ovoga";

	/**
	 * A FOLDER OF THIS RUN'S OWN, AND IT IS NOT A TIDINESS MEASURE.
	 *
	 * <p>The setting's default is {@code ${java.io.tmpdir}/btl-photos}, one folder shared by
	 * every run on the machine - and a file here is named by a {@code bigserial} that starts
	 * again at one in every fresh Testcontainers database. So a second run, or a second agent
	 * working in another worktree at the same time, would meet a file of that name already on
	 * the disk; the route writes with {@code CREATE_NEW} and would fail on it, which reads as
	 * a broken route rather than as two runs sharing a directory.
	 *
	 * <p>It is the same class of fault {@code CLAUDE.md} records for a fixed PORT
	 * (18.09.2026): a shared resource that looks like neither a file of the branch nor a
	 * table of it, and whose failure looks exactly like a real one. A directory is that same
	 * thing, so it is made unique here rather than assumed to be free.
	 *
	 * <p>Built in a static initialiser rather than through {@code @TempDir}, because
	 * {@code @DynamicPropertySource} runs while the context is being built and must be able
	 * to answer with a path that already exists.
	 */
	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-me-");
		}
		catch (java.io.IOException noFolder) {
			throw new IllegalStateException("no temporary folder to keep pictures in", noFolder);
		}
	}

	@org.springframework.test.context.DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(
			org.springframework.test.context.DynamicPropertyRegistry registry) {

		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Value("${btl.photos.folder}")
	private String folder;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	@BeforeEach
	void sevenMembersInFiveDifferentStates() {
		competitor(FIRST_WRITTEN, "Prvi", "Prvic");
		competitor(SOMEONE_ELSE, "Sasa", "Sasic");
		competitor(ME, MY_NAME, MY_SURNAME);
		competitor(WHOSE_PICTURE_WAITS, "Vera", "Veric");
		competitor(WHOSE_TEXT_WAITS, "Tamara", "Tamic");
		competitor(WHOSE_PICTURE_WAS_REFUSED, "Ognjen", "Ognjenic");
		competitor(HAS_NO_PICTURE, "Pavle", "Pavlic");

		account("prvi@primer.rs", FIRST_WRITTEN);
		account("neko-drugi@primer.rs", SOMEONE_ELSE);
		account("ja@primer.rs", ME);
		account("slika-ceka@primer.rs", WHOSE_PICTURE_WAITS);
		account("tekst-ceka@primer.rs", WHOSE_TEXT_WAITS);
		account("odbijena@primer.rs", WHOSE_PICTURE_WAS_REFUSED);
		account("bez-slike@primer.rs", HAS_NO_PICTURE);

		moderatorWithNoCompetitor(MODERATOR_WHO_DOES_NOT_RACE);

		/* STANDING ON A PROFILE, which is a different fact from waiting in the queue: a case
		   that measures one against a fixture with only the other says nothing. Everybody but
		   HAS_NO_PICTURE carries one, so „no picture" is a state and not the whole fixture. */
		standingPicture(FIRST_WRITTEN);
		standingPicture(SOMEONE_ELSE);
		standingPicture(ME);
		standingPicture(WHOSE_PICTURE_WAITS);
		standingPicture(WHOSE_TEXT_WAITS);
		standingPicture(WHOSE_PICTURE_WAS_REFUSED);

		/* WRITTEN FIRST INTO THE QUEUE, so „the picture this member is waiting on" is never
		   „the first row" and never „the only one". */
		waitingPicture(SOMEONE_ELSE);
		waitingPicture(WHOSE_PICTURE_WAITS);

		/* THE THREE STATES THAT MUST NOT BE MISTAKEN FOR A WAITING PICTURE. */
		waitingText(WHOSE_TEXT_WAITS);
		refusedPicture(WHOSE_PICTURE_WAS_REFUSED);
		waitingInTeams(FIRST_WRITTEN);
	}

	private void competitor(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, first, last, String.format("%016x", ++issued))
				.update();
	}

	private void account(String email, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " (?, 'Roditeljevic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(THE_NAME_ON_THE_ACCOUNT, email, memberNumber)
				.update();

		openSession(email);
	}

	private void moderatorWithNoCompetitor(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?, (select id from role where code ="
						+ " 'moderator'))")
				.param(email).update();

		openSession(email);
	}

	private void openSession(String email) {
		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/**
	 * A picture row, with a digest of its own.
	 *
	 * <p>Every one in this fixture is different, which is what makes „his picture" measurable
	 * at all: sharing one, a route that read the wrong row would answer the right digest.
	 */
	private long picture() {
		String digest = String.format("%064x", ++issued);

		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)"
						+ " returning id")
				.param(digest).query(Long.class).single();
	}

	/** A picture ON the profile, which is what everybody but one member starts with. */
	private void standingPicture(String memberNumber) {
		db.sql("update competitor set photo_id = ? where member_number = ?")
				.params(picture(), memberNumber).update();
	}

	private void waitingPicture(String memberNumber) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " 'Neko Nekic', '', ?)")
				.params(THE_PROFILES_TAB, memberNumber, picture()).update();
	}

	/** A TEXT waiting in the same tab, which is the other half of it and stops nothing. */
	private void waitingText(String memberNumber) {
		db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " 'Neko Nekic', 'Tekst koji ceka odluku.')")
				.params(THE_PROFILES_TAB, memberNumber).update();
	}

	/**
	 * A picture that has been REFUSED, which V9 says stands in the table for ever - and with
	 * {@code photo_id} emptied, because {@code verification_decided_keeps_no_photo} allows a
	 * picture only on a row that is still waiting.
	 */
	private void refusedPicture(String memberNumber) {
		db.sql("insert into verification (queue, competitor_id, subject, body, state, decided_at,"
						+ " decided_by_name, reason)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " 'Neko Nekic', '', 'rejected', timestamptz '2026-09-01 10:00:00+00',"
						+ " 'Moderator Bezimeni', 'Lice nije u fokusu, isecak je preuzak.')")
				.params(THE_PROFILES_TAB, memberNumber).update();
	}

	private void waitingInTeams(String memberNumber) {
		db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('teams', (select id from competitor where member_number = ?),"
						+ " 'Timocka trkacka druzina', '')")
				.param(memberNumber).update();
	}

	private String cookieOf(String memberNumber) {
		return sessions.get(db.sql("select a.email from account a join competitor c"
						+ " on c.id = a.competitor_id where c.member_number = ?")
				.param(memberNumber).query(String.class).single()).secret();
	}

	/* ------------------------------------------------------------------------------------
	   THE FILES THE CASES SEND, AND NONE OF THEM IS ANY FIXTURE ROW'S PICTURE.
	   ------------------------------------------------------------------------------------ */

	private static byte[] bytesOf(int... values) {
		byte[] made = new byte[values.length];

		for (int i = 0; i < values.length; i++) {
			made[i] = (byte) values[i];
		}

		return made;
	}

	private static byte[] aJpeg(String tail) {
		byte[] head = bytesOf(0xFF, 0xD8, 0xFF);
		byte[] rest = tail.getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[head.length + rest.length];

		System.arraycopy(head, 0, whole, 0, head.length);
		System.arraycopy(rest, 0, whole, head.length, rest.length);

		return whole;
	}

	private static byte[] aPng(String tail) {
		byte[] head = bytesOf(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
		byte[] rest = tail.getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[head.length + rest.length];

		System.arraycopy(head, 0, whole, 0, head.length);
		System.arraycopy(rest, 0, whole, head.length, rest.length);

		return whole;
	}

	private MockHttpServletResponse sending(String memberNumber, byte[] content, String declared,
			String name, String x, String y, String size) throws Exception {

		MockMultipartHttpServletRequestBuilder asking = multipart("/api/me/photo");

		asking.file(new MockMultipartFile("picture", name, declared, content));

		if (x != null) {
			asking.param("cropX", x);
		}
		if (y != null) {
			asking.param("cropY", y);
		}
		if (size != null) {
			asking.param("cropSize", size);
		}

		return http.perform(asking.with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(memberNumber))))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse sending(String memberNumber, byte[] content) throws Exception {
		return sending(memberNumber, content, MediaType.IMAGE_JPEG_VALUE, "portret.jpg",
				"0.25", "0.75", "0.5");
	}

	private MockHttpServletResponse removing(String memberNumber) throws Exception {
		return http.perform(delete("/api/me/photo").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(memberNumber))))
				.andReturn().getResponse();
	}

	private JsonNode answerIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString());
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return answerIn(answer).path("reason").asString();
	}

	private long howManyPicturesWaitFor(String memberNumber) {
		return db.sql("select count(*) from verification where queue = ? and state = 'waiting'"
						+ " and photo_id is not null and competitor_id ="
						+ " (select id from competitor where member_number = ?)")
				.params(THE_PROFILES_TAB, memberNumber).query(Long.class).single();
	}

	private long howManyRowsInTheQueue() {
		return db.sql("select count(*) from verification").query(Long.class).single();
	}

	private String digestStandingOn(String memberNumber) {
		return db.sql("select p.digest from competitor c join photo p on p.id = c.photo_id"
						+ " where c.member_number = ?")
				.param(memberNumber).query(String.class).optional().orElse(null);
	}

	/** The row the queue is carrying for this member, read whole and in a fixed order. */
	private List<String> theWaitingRowOf(String memberNumber) {
		return db.sql("select v.queue, v.subject, v.body, v.state, p.media_type, p.byte_size,"
						+ " p.digest, p.crop_x, p.crop_y, p.crop_diameter"
						+ " from verification v join photo p on p.id = v.photo_id"
						+ " where v.state = 'waiting' and v.competitor_id ="
						+ " (select id from competitor where member_number = ?)"
						+ " order by v.raised_at, v.id")
				.param(memberNumber)
				.query((row, one) -> List.of(row.getString(1), row.getString(2), row.getString(3),
						row.getString(4), row.getString(5), String.valueOf(row.getInt(6)),
						row.getString(7), row.getBigDecimal(8).toPlainString(),
						row.getBigDecimal(9).toPlainString(),
						row.getBigDecimal(10).toPlainString()))
				.single();
	}

	private Path fileOf(long photo) {
		return Path.of(folder).resolve(String.valueOf(photo));
	}

	/* ------------------------------------------------------------------------------------
	   SENDING ONE.
	   ------------------------------------------------------------------------------------ */

	/**
	 * THE WHOLE ERRAND: a row, a file, a queue item, and a profile that has not changed.
	 *
	 * <p>The last of those four is the one PDL P11 is about: „Dok nova slika ceka, na profilu
	 * stoji ona koja je odobrena." So the picture that STANDS is read back afterwards and
	 * compared with what stood before.
	 */
	@Test
	void aPictureIsKeptWaitsForAModeratorAndDoesNotReachTheProfile() throws Exception {
		String wasStanding = digestStandingOn(ME);
		byte[] sent = aJpeg("ovo je slika koju saljem, i nije nicija iz fiksture");

		MockHttpServletResponse answer = sending(ME, sent);

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(theWaitingRowOf(ME))
				.as("the queue row, the picture row or the crop is not what was sent")
				.containsExactly(THE_PROFILES_TAB, MY_NAME + " " + MY_SURNAME, "", "waiting",
						"image/jpeg", String.valueOf(sent.length),
						WhatAPictureIs.digestOf(sent),
						"0.25000000", "0.75000000", "0.50000000");

		assertThat(digestStandingOn(ME))
				.as("the picture that stands on the profile changed, so an unapproved picture is"
						+ " being shown to everybody (PDL P11, 12.08.2026)")
				.isEqualTo(wasStanding);

		JsonNode said = answerIn(answer);

		assertThat(said.path("digest").asString())
				.as("the member is not told the digest of the picture he just sent, so no screen"
						+ " can show him that it arrived (PDL P28b, 3)")
				.isEqualTo(WhatAPictureIs.digestOf(sent));
		assertThat(said.path("standing").asString())
				.as("the answer does not carry the picture everybody else still sees, so a screen"
						+ " could not draw the two apart")
				.isEqualTo(wasStanding);
		assertThat(said.path("waiting").asLong()).isPositive();
	}

	/**
	 * AND THE FILE IS ON THE DISK, UNDER THE NAME THE DATABASE ISSUED, WITH THE BYTES THAT
	 * WERE SENT.
	 *
	 * <p>V8: „the file lives on the disk under a name the database issues... The name is this
	 * row's {@code id}." {@link PhotoApi} opens exactly that name, so this is the half that
	 * makes the picture reachable at all.
	 */
	@Test
	void theFileIsOnTheDiskUnderTheNameTheDatabaseIssued() throws Exception {
		byte[] sent = aPng("bajtovi koji nisu ni jedna slika iz fiksture");

		assertThat(sending(ME, sent, MediaType.IMAGE_PNG_VALUE, "portret.png", "0", "1", "1")
				.getStatus()).isEqualTo(200);

		long photo = db.sql("select photo_id from verification where state = 'waiting'"
						+ " and photo_id is not null and competitor_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(ME).query(Long.class).single();

		assertThat(Files.exists(fileOf(photo)))
				.as("nothing was written to the disk, so the row describes a picture nobody can"
						+ " ever be shown")
				.isTrue();
		assertThat(Files.readAllBytes(fileOf(photo)))
				.as("the bytes on the disk are not the bytes that were sent")
				.isEqualTo(sent);

		Files.deleteIfExists(fileOf(photo));
	}

	/**
	 * THE TYPE IS READ OFF THE BYTES AND NOT OFF ANYTHING THE BROWSER SAID.
	 *
	 * <p>ADL A12a, 1: „proveri tip po sadrzaju a ne po nazivu ni po {@code Content-Type}
	 * zaglavlju."
	 *
	 * <p><b>This is a REPLACEMENT OF THE SOURCE and not a removal of an assertion</b>, which
	 * is what {@code CLAUDE.md} of 06.09.2026 asks for: the same value could arrive from three
	 * places - the part's declared type, the name of the file, and the bytes - so the case
	 * makes all three DISAGREE. A route reading either of the first two answers
	 * {@code image/png} and this goes red.
	 */
	@Test
	void theTypeComesOffTheBytesAndNotOffTheNameOrTheHeader() throws Exception {
		byte[] reallyAJpeg = aJpeg("sadrzaj koji je zaista jpeg");

		assertThat(sending(ME, reallyAJpeg, MediaType.IMAGE_PNG_VALUE, "slika.png", "0.5", "0.5",
				"0.9").getStatus()).isEqualTo(200);

		assertThat(theWaitingRowOf(ME).get(4))
				.as("the portal stored the type the browser claimed rather than the type the"
						+ " bytes are, which is the whole of ADL A12a requirement 1")
				.isEqualTo("image/jpeg");
	}

	/**
	 * AND SOMETHING THAT IS NOT A PICTURE IS REFUSED HOWEVER IT IS DRESSED UP.
	 *
	 * <p>Three shapes: plain text under a picture's name and type, a GIF (a real picture
	 * format the schema does not hold), and a RIFF container that is not a WebP.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "Ovo je obican tekst, ne slika.", "GIF89a pa jos nesto",
			"RIFF____WAVEnesto" })
	void whatIsNotAPictureIsRefusedHoweverItIsNamed(String content) throws Exception {
		long before = howManyRowsInTheQueue();

		MockHttpServletResponse answer = sending(ME, content.getBytes(StandardCharsets.UTF_8),
				MediaType.IMAGE_JPEG_VALUE, "portret.jpg", "0.5", "0.5", "0.5");

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		assertThat(howManyRowsInTheQueue())
				.as("something that is not a picture reached a moderator's tab")
				.isEqualTo(before);
		assertThat(db.sql("select count(*) from photo").query(Long.class).single())
				.as("a row was written for a file that was refused")
				.isEqualTo(6 + 2);
	}

	/**
	 * A SECOND PICTURE WHILE ONE IS WAITING IS REFUSED, AND THE FIRST ONE STAYS UNTOUCHED.
	 *
	 * <p>Derived rather than quoted, and the head of {@link MePhotoApi} says so: it is the
	 * picture's half of the owner's decision of 19.09.2026 about the TEXT, and it is what
	 * {@code pages/member/ProfilePicture.tsx} already does - „a second ask gives a moderator
	 * two faces and no question to answer". His sentence of 24.09.2026 points the same way:
	 * the member is shown his waiting picture „da je ne salje tri puta".
	 */
	@Test
	void aSecondPictureIsRefusedWhileTheFirstStillWaits() throws Exception {
		String wasWaiting = theWaitingRowOf(WHOSE_PICTURE_WAITS).get(6);

		MockHttpServletResponse answer = sending(WHOSE_PICTURE_WAITS,
				aJpeg("druga slika, poslata dok prva ceka"));

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(MePhotoApi.A_PICTURE_ALREADY_WAITS);

		assertThat(howManyPicturesWaitFor(WHOSE_PICTURE_WAITS))
				.as("a moderator now holds two pictures of one member and no question to answer")
				.isEqualTo(1);
		assertThat(theWaitingRowOf(WHOSE_PICTURE_WAITS).get(6))
				.as("the picture already in the queue was replaced under the moderator's hand")
				.isEqualTo(wasWaiting);
	}

	/**
	 * AND THE THREE STATES THAT ARE NOT A WAITING PICTURE STOP NOTHING.
	 *
	 * <p>Each of them is a separate answer the guard has to get right, and each one is a way
	 * the guard could be written too widely: over the queue rather than over
	 * {@code state = 'waiting'}, over the tab rather than over {@code photo_id}, or over the
	 * table rather than over this member.
	 *
	 * <ul>
	 * <li><b>A TEXT waiting</b> is not a picture waiting, and the two share a tab (PDL P28a).
	 * <li><b>A picture already DECIDED</b> must not stop him - being refused and sending
	 * another is the whole errand (PDL P22, 15.08.2026).
	 * <li><b>SOMEBODY ELSE'S picture waiting</b> is somebody else's.
	 * </ul>
	 */
	@ParameterizedTest
	@ValueSource(strings = { WHOSE_TEXT_WAITS, WHOSE_PICTURE_WAS_REFUSED, ME })
	void whatIsNotThisMembersWaitingPictureStopsNothing(String memberNumber) throws Exception {
		assertThat(sending(memberNumber, aJpeg("slika " + memberNumber)).getStatus())
				.as("%s was refused although nothing of his is waiting in the profiles tab as a"
						+ " picture", memberNumber)
				.isEqualTo(200);

		assertThat(howManyPicturesWaitFor(memberNumber)).isEqualTo(1);
	}

	/**
	 * THE PICTURE IS THE ASKING MEMBER'S AND NOBODY ELSE'S.
	 *
	 * <p><b>The mutation this is written against:</b> reading the member off the request, or
	 * a statement that took the first competitor rather than the one the session names.
	 * {@link #ME} is written third, so neither would be caught by a fixture of one.
	 */
	@Test
	void thePictureIsQueuedAgainstTheMemberTheSessionNames() throws Exception {
		assertThat(sending(ME, aJpeg("slika koju saljem ja")).getStatus()).isEqualTo(200);

		assertThat(howManyPicturesWaitFor(ME)).isEqualTo(1);
		assertThat(howManyPicturesWaitFor(FIRST_WRITTEN))
				.as("the first member by key was given a picture somebody else sent")
				.isZero();
		assertThat(howManyPicturesWaitFor(SOMEONE_ELSE))
				.as("somebody else now has two pictures waiting")
				.isEqualTo(1);
	}

	/**
	 * AND THE CARD CARRIES THE MEMBER'S NAME, WHICH IS NOT THE NAME ON HIS ACCOUNT.
	 *
	 * <p>{@code MeWriteApi.queued} measured this for the text: PDL P21 gives a member under
	 * sixteen an account his parent holds, so {@code account.first_name} is the parent's and
	 * {@code competitor.first_name} is the child's. Every account in this fixture is named
	 * „Roditelj", so a route reading the account's name comes back visibly wrong.
	 */
	@Test
	void theCardCarriesTheMembersNameAndNotTheAccountsName() throws Exception {
		assertThat(sending(ME, aJpeg("slika")).getStatus()).isEqualTo(200);

		assertThat(theWaitingRowOf(ME).get(1))
				.as("the card a moderator reads carries the name on the account rather than the"
						+ " name of the member whose profile it is about")
				.isEqualTo(MY_NAME + " " + MY_SURNAME)
				.isNotEqualTo(THE_NAME_ON_THE_ACCOUNT + " Roditeljevic");
	}

	/**
	 * A CROP THAT IS NOT THREE FRACTIONS IS REFUSED BY THE PORTAL AND NOT BY A CONSTRAINT.
	 *
	 * <p>V21 bounds {@code crop_x} and {@code crop_y} {@code between 0 and 1} inclusive, and
	 * {@code crop_diameter} {@code > 0 and <= 1} - „a circle of no diameter is not a crop of
	 * a photograph, it is the absence of one". Left to the constraint, every one of these
	 * would abort the transaction and answer 500.
	 *
	 * <p><b>Nought is a legal POSITION and not a legal DIAMETER</b>, which is the one
	 * asymmetry in the three and is therefore a row of its own here.
	 */
	@ParameterizedTest
	@CsvSource({ "-0.1, 0.5, 0.5", "0.5, 1.1, 0.5", "0.5, 0.5, 0", "0.5, 0.5, 1.5",
			"blizu, 0.5, 0.5", "0.5, 0.5, 0.123456789" })
	void aCropThatIsNotThreeFractionsIsRefused(String x, String y, String size) throws Exception {
		long before = howManyRowsInTheQueue();

		MockHttpServletResponse answer = sending(ME, aJpeg("slika"), MediaType.IMAGE_JPEG_VALUE,
				"portret.jpg", x, y, size);

		assertThat(answer.getStatus())
				.as("the crop (%s, %s, %s) was taken, and V21 would have refused it at the"
						+ " constraint, which is a 500 where the member should be told something",
						x, y, size)
				.isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		assertThat(howManyRowsInTheQueue()).isEqualTo(before);
	}

	/** And nought IS a legal position, which is the other half of that boundary. */
	@Test
	void noughtIsALegalPositionEvenThoughItIsNotALegalDiameter() throws Exception {
		assertThat(sending(ME, aJpeg("slika"), MediaType.IMAGE_JPEG_VALUE, "portret.jpg",
				"0", "0", "1").getStatus())
				.as("a circle flush against the corner of the picture, as wide as the picture"
						+ " allows, was refused - and V21 says both ends are legal positions")
				.isEqualTo(200);
	}

	/** A crop left out altogether is the same answer as one that is not a number. */
	@Test
	void aCropThatWasNotSentAtAllIsRefused() throws Exception {
		MockHttpServletResponse answer = sending(ME, aJpeg("slika"), MediaType.IMAGE_JPEG_VALUE,
				"portret.jpg", null, null, null);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
	}

	/** And a request carrying no file at all is told the form is not complete. */
	@Test
	void aRequestWithNoFileIsToldTheFormIsNotComplete() throws Exception {
		MockHttpServletResponse answer = sending(ME, new byte[0], MediaType.IMAGE_JPEG_VALUE,
				"portret.jpg", "0.5", "0.5", "0.5");

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
	}

	/**
	 * A FILE BIGGER THAN THE PORTAL TAKES IS REFUSED BY THE PORTAL, WITH A SENTENCE.
	 *
	 * <p>Both directions on the boundary: exactly the limit is taken, one byte more is not.
	 * That is the difference between a limit and a number somebody wrote down.
	 */
	@Test
	void aFileOverTheLimitIsRefusedAndOneExactlyAtItIsTaken() throws Exception {
		byte[] justOver = new byte[WhatAPictureIs.AT_MOST_BYTES + 1];

		System.arraycopy(aJpeg(""), 0, justOver, 0, 3);

		MockHttpServletResponse over = sending(ME, justOver);

		assertThat(over.getStatus())
				.as("a file one byte over the portal's own limit was taken")
				.isEqualTo(400);
		assertThat(reasonIn(over)).isEqualTo(MePhotoApi.THE_PICTURE_IS_TOO_BIG);

		byte[] exactly = new byte[WhatAPictureIs.AT_MOST_BYTES];

		System.arraycopy(aJpeg(""), 0, exactly, 0, 3);

		MockHttpServletResponse taken = sending(ME, exactly);

		assertThat(taken.getStatus())
				.as("a file of exactly the limit was refused, so the boundary is in the wrong"
						+ " place")
				.isEqualTo(200);

		long photo = db.sql("select photo_id from verification where state = 'waiting'"
						+ " and photo_id is not null and competitor_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(ME).query(Long.class).single();

		Files.deleteIfExists(fileOf(photo));
	}

	/**
	 * AND THE CONTAINER'S OWN LIMIT IS ABOVE THE PORTAL'S, READ OFF THE SETTINGS.
	 *
	 * <p>The floor under the paragraph in {@code application.properties}: written the other
	 * way round, every refusal would come from the container and
	 * {@link WhatAPictureIs#AT_MOST_BYTES} would never decide anything - so the member would
	 * be answered by a layer that has no sentence to tell him.
	 */
	@Test
	void theContainerLetsThroughMoreThanThePortalTakes(
			@Autowired org.springframework.core.env.Environment settings) {

		long container = org.springframework.util.unit.DataSize
				.parse(settings.getProperty("spring.servlet.multipart.max-file-size", "1MB"))
				.toBytes();

		assertThat(container)
				.as("the container refuses a file the portal would have taken, so the portal's"
						+ " own limit and its own sentence never decide anything")
				.isGreaterThan(WhatAPictureIs.AT_MOST_BYTES);
	}

	/* ------------------------------------------------------------------------------------
	   TAKING ONE DOWN.
	   ------------------------------------------------------------------------------------ */

	/**
	 * A REMOVAL TAKES EFFECT AT ONCE AND NOTHING IS QUEUED FOR IT.
	 *
	 * <p>Owner, PDL P28b, 3, 24.09.2026: „Brisanje slike stupa odmah, bez moderacije...
	 * Uklanjanje ne moze da bude sporno."
	 */
	@Test
	void takingThePictureDownHappensAtOnceAndAsksNobody() throws Exception {
		long before = howManyRowsInTheQueue();
		long photo = db.sql("select photo_id from competitor where member_number = ?")
				.param(ME).query(Long.class).single();

		Files.createDirectories(Path.of(folder));
		Files.write(fileOf(photo), aJpeg("bajtovi slike koja stoji"));

		assertThat(removing(ME).getStatus()).isEqualTo(200);

		assertThat(digestStandingOn(ME))
				.as("the picture is still on the profile, so a removal the owner called"
						+ " immediate is waiting for somebody")
				.isNull();
		assertThat(howManyRowsInTheQueue())
				.as("a moderator was asked to approve a removal")
				.isEqualTo(before);
		assertThat(db.sql("select count(*) from photo where id = ?").param(photo)
				.query(Long.class).single())
				.as("the row of the removed picture is still in the table, so PhotoApi could"
						+ " still be asked for it by another holder")
				.isZero();
		assertThat(Files.exists(fileOf(photo)))
				.as("the file is still on the disk after its member took it down")
				.isFalse();
	}

	/**
	 * AND IT TAKES DOWN NOBODY ELSE'S.
	 *
	 * <p><b>The mutation this is written against:</b> a statement that lost its member. Six
	 * of the seven members start with a picture, so a delete without a condition is visible
	 * rather than lucky.
	 */
	@Test
	void takingOnesOwnPictureDownLeavesEverybodyElsesStanding() throws Exception {
		assertThat(removing(ME).getStatus()).isEqualTo(200);

		assertThat(digestStandingOn(FIRST_WRITTEN))
				.as("the first member by key lost his picture to somebody else's request")
				.isNotNull();
		assertThat(digestStandingOn(SOMEONE_ELSE)).isNotNull();
		assertThat(db.sql("select count(*) from photo").query(Long.class).single())
				.as("more than one picture row was deleted")
				.isEqualTo(6 + 2 - 1);
	}

	/**
	 * A MEMBER WITH NO PICTURE IS AGREED WITH RATHER THAN REFUSED.
	 *
	 * <p>„Take my picture down" asked by somebody who has none is a request that is already
	 * true, and a 404 would be the portal refusing to agree with itself. It is also what
	 * makes the control safe to press twice.
	 */
	@Test
	void takingDownAPictureThatIsNotThereIsAgreedWith() throws Exception {
		assertThat(removing(HAS_NO_PICTURE).getStatus()).isEqualTo(200);
		assertThat(digestStandingOn(HAS_NO_PICTURE)).isNull();

		assertThat(removing(HAS_NO_PICTURE).getStatus())
				.as("pressing the same control twice was refused the second time")
				.isEqualTo(200);
	}

	/**
	 * AND A REMOVAL DOES NOT WITHDRAW A PICTURE THAT IS WAITING, WHICH IS WRITTEN DOWN RATHER
	 * THAN PATCHED.
	 *
	 * <p>The same boundary {@link MeWriteApi#write} carries for the biography: removing what
	 * STANDS and taking back what a moderator is HOLDING are different things, and no
	 * decision covers the second. What keeps it from being a trap is the answer, which names
	 * the picture that is still waiting - so a screen can say so.
	 */
	@Test
	void takingTheStandingPictureDownLeavesTheWaitingOneWhereItIs() throws Exception {
		long waiting = howManyPicturesWaitFor(WHOSE_PICTURE_WAITS);

		MockHttpServletResponse answer = removing(WHOSE_PICTURE_WAITS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(digestStandingOn(WHOSE_PICTURE_WAITS)).isNull();

		assertThat(howManyPicturesWaitFor(WHOSE_PICTURE_WAITS))
				.as("a removal quietly withdrew what a moderator was already holding, which is a"
						+ " decision nobody has taken")
				.isEqualTo(waiting);

		assertThat(answerIn(answer).path("waiting").asLong())
				.as("the answer does not name the picture that is still waiting, so the member is"
						+ " left believing his profile is empty for good")
				.isPositive();
	}

	/** And a member with nothing waiting is told exactly that. */
	@Test
	void aRemovalWithNothingWaitingSaysSo() throws Exception {
		assertThat(answerIn(removing(ME)).path("waiting").isNull())
				.as("the answer names a waiting picture where there is none")
				.isTrue();
	}

	/* ------------------------------------------------------------------------------------
	   WHO MAY ASK AT ALL.
	   ------------------------------------------------------------------------------------ */

	@Test
	void somebodyWhoIsNotSignedInIsAskedToSignIn() throws Exception {
		long before = howManyRowsInTheQueue();

		assertThat(http.perform(multipart("/api/me/photo").with(csrf())
						.file(new MockMultipartFile("picture", "p.jpg", MediaType.IMAGE_JPEG_VALUE,
								aJpeg("slika bez naloga")))
						.param("cropX", "0.5").param("cropY", "0.5").param("cropSize", "0.5"))
				.andReturn().getResponse().getStatus())
				.isEqualTo(401);

		assertThat(http.perform(delete("/api/me/photo").with(csrf()))
				.andReturn().getResponse().getStatus())
				.isEqualTo(401);

		assertThat(howManyRowsInTheQueue()).isEqualTo(before);
	}

	/**
	 * AN ACCOUNT THAT NAMES NO MEMBER IS ANSWERED AS THOUGH THE ADDRESS WERE NOT THERE.
	 *
	 * <p>ADL A8, 13.09.2026, and the shape {@link MeWriteApi#away} measured: it is
	 * {@code sendError}, so the answer goes down the same road an address that is not there
	 * takes rather than merely carrying the same number. V23 calls such an account the
	 * ordinary case for a moderator who does not race.
	 */
	@Test
	void anAccountThatNamesNoMemberIsAnsweredLikeAnAddressThatIsNotThere() throws Exception {
		String cookie = sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret();
		long before = howManyRowsInTheQueue();

		MockHttpServletResponse sending = http.perform(multipart("/api/me/photo").with(csrf())
						.file(new MockMultipartFile("picture", "p.jpg", MediaType.IMAGE_JPEG_VALUE,
								aJpeg("slika moderatora")))
						.param("cropX", "0.5").param("cropY", "0.5").param("cropSize", "0.5")
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();

		MockHttpServletResponse removing = http.perform(delete("/api/me/photo").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();

		int nothingThere = http.perform(post(NOTHING_IS_THERE).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse().getStatus();

		assertThat(sending.getStatus()).isEqualTo(nothingThere);
		assertThat(removing.getStatus()).isEqualTo(nothingThere);
		assertThat(howManyRowsInTheQueue())
				.as("an account that races for nobody put a picture in front of a moderator")
				.isEqualTo(before);
	}

	/**
	 * AND A POST THAT NAMES THE WRONG TYPE IS AN ADDRESS THAT IS NOT THERE.
	 *
	 * <p>The mirror image of what {@link MeWriteApi} and {@link TeamWriteApi} measure for
	 * their own mappings: there a multipart body must not reach a JSON route, and here a JSON
	 * body must not reach the file route with a 415 that says „this address is here and wants
	 * something else".
	 */
	@Test
	void aJsonBodyPostedToThePictureAddressIsAnAddressThatIsNotThere() throws Exception {
		MockHttpServletResponse answer = http.perform(post("/api/me/photo").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content("{}")
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(ME))))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(404);

		assertThat(http.perform(post(NOTHING_IS_THERE).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(ME))))
				.andReturn().getResponse().getStatus())
				.as("an address that maps nothing no longer answers 404, so there is nothing"
						+ " being compared here")
				.isEqualTo(answer.getStatus());
	}
}
