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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
	   WHAT PDL 21b AND 21c NEED READ BACK: THE ROW ITSELF, ITS PLACE, AND ITS PICTURE.
	   ------------------------------------------------------------------------------------ */

	/**
	 * The key of the queue row this member's picture is waiting in.
	 *
	 * <p>Read back so that „gazi trenutan red" can be measured as the owner wrote it: the row is
	 * REPOINTED, so this number must be the same before and after. A case that only counted rows
	 * would pass against a route that deleted one and opened another, which is the shape his
	 * boundary does not describe.
	 */
	private long theQueueRowOf(String memberNumber) {
		return db.sql("select v.id from verification v where v.state = 'waiting'"
						+ " and v.photo_id is not null and v.queue = ? and v.competitor_id ="
						+ " (select id from competitor where member_number = ?)"
						+ " order by v.raised_at, v.id")
				.params(THE_PROFILES_TAB, memberNumber).query(Long.class).single();
	}

	/** And where it stands in the queue, which V9 orders by and a repoint must not move. */
	private Instant theQueuePlaceOf(String memberNumber) {
		return db.sql("select v.raised_at from verification v where v.id = ?")
				.param(theQueueRowOf(memberNumber)).query(Instant.class).single();
	}

	/** The picture that row is about, which is what an overwrite takes away. */
	private long theWaitingPhotoOf(String memberNumber) {
		return db.sql("select v.photo_id from verification v where v.id = ?")
				.param(theQueueRowOf(memberNumber)).query(Long.class).single();
	}

	private long howManyPhotoRows() {
		return db.sql("select count(*) from photo").query(Long.class).single();
	}

	/**
	 * The three fractions on one picture, moved so that two pictures of one member differ.
	 *
	 * <p>Every row {@code picture()} writes carries the same crop, so a case that read the
	 * waiting circle out of an answer would be satisfied by the standing one. This is what
	 * separates the two axes.
	 */
	private void cropOf(long photo, String x, String y, String size) {
		db.sql("update photo set crop_x = cast(? as numeric), crop_y = cast(? as numeric),"
						+ " crop_diameter = cast(? as numeric) where id = ?")
				.params(x, y, size, photo).update();
	}

	/** A file for a fixture row, which the fixture does not write and two cases need. */
	private void aFileFor(long photo) throws Exception {
		Files.createDirectories(Path.of(folder));
		Files.write(fileOf(photo), aJpeg("fajl koji je fikstura izostavila"));
	}

	/**
	 * A send carrying the three fractions and NO FILE PART AT ALL, which is PDL 21c's second
	 * half: „ili da pomerim krug da gadja drugi deo slike".
	 */
	private MockHttpServletResponse sendingOnlyTheCircle(String memberNumber, String x, String y,
			String size) throws Exception {

		return http.perform(multipart("/api/me/photo").with(csrf())
						.param("cropX", x).param("cropY", y).param("cropSize", size)
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(memberNumber))))
				.andReturn().getResponse();
	}

	/** What PDL 21b's screen asks on load, which is the read that did not exist before. */
	private MockHttpServletResponse askingForMine(String memberNumber) throws Exception {
		return http.perform(get("/api/me/photo")
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(memberNumber))))
				.andReturn().getResponse();
	}

	/**
	 * A CIRCLE AS THE SERVER WROTE IT, read off the TEXT and never through a parser.
	 *
	 * <p><b>Measured rather than preferred, and {@code TeamApiTest} names the same trap for the
	 * same field.</b> The crop is {@code numeric(9,8)}, so what the server writes is
	 * {@code 0.12500000}; Jackson's reader turns a JSON number into a {@code double} unless it is
	 * told otherwise, and a {@code double} of that value comes back out of {@code asString} as
	 * {@code 0.125}. So an assertion made through the parsed tree measures the PARSER and would go
	 * on passing against a route that had dropped the scale the column is declared with - which is
	 * the whole of what V21 says the declared scale is for: „what the member chose is what is
	 * stored and what is read back, byte for byte".
	 */
	private static String theCircleWrittenIn(MockHttpServletResponse answer, String half)
			throws Exception {

		String whole = answer.getContentAsString();
		String from = "\"" + half + "\":{";
		int at = whole.indexOf(from);

		assertThat(at)
				.as("the answer carries no „%s\" half at all, so there is nothing here to read a"
						+ " circle out of: %s", half, whole)
				.isNotNegative();

		int crop = whole.indexOf("\"crop\":", at);

		return whole.substring(crop, whole.indexOf('}', crop) + 1);
	}

	/**
	 * A moderator taking V28's hold on one queue row, which is the fact the owner's boundary
	 * about „red mu se promeni pod rukom" is really about.
	 */
	private void aModeratorHolds(long queueRow) {
		db.sql("insert into verification_lock (verification_id, held_by, held_until) values"
						+ " (?, (select id from account where email = ?), now() + interval"
						+ " '15 minutes')")
				.params(queueRow, MODERATOR_WHO_DOES_NOT_RACE).update();
	}

	private long howManyHoldsOn(long queueRow) {
		return db.sql("select count(*) from verification_lock where verification_id = ?")
				.param(queueRow).query(Long.class).single();
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

	/* ------------------------------------------------------------------------------------
	   PDL 21c: SENDING AGAIN OVERWRITES THE ROW THAT WAITS.
	   ------------------------------------------------------------------------------------ */

	/**
	 * A SECOND PICTURE OVERWRITES THE ONE THAT WAITS, AND IS NOT REFUSED.
	 *
	 * <p><b>Owner, PDL 21c, 27.09.2026:</b> „Ako hocu da pregazim novom ili da pomerim krug da
	 * gadja drugi deo slike, opet se salje na verifikaciju i gazi trenutan red kod verifikatora."
	 * Until that day this route answered 409 {@code aPictureAlreadyWaits}, and the owner met it
	 * himself: he sent a picture twice and the second was refused.
	 *
	 * <p><b>THE DIGEST IS READ BACK RATHER THAN THE COUNT, because a count cannot tell an
	 * overwrite from a refusal.</b> One row waits before and one row waits after in both worlds;
	 * what separates them is WHICH picture that row is about. The fixture's picture and the one
	 * sent here have different digests by construction ({@code picture()} says why), so the
	 * assertion below fails against a route that left the first standing.
	 */
	@Test
	void aSecondPictureOverwritesTheOneThatWaits() throws Exception {
		String wasWaiting = theWaitingRowOf(WHOSE_PICTURE_WAITS).get(6);

		MockHttpServletResponse answer = sending(WHOSE_PICTURE_WAITS,
				aJpeg("druga slika, poslata dok prva ceka"));

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(howManyPicturesWaitFor(WHOSE_PICTURE_WAITS))
				.as("„Red ostaje jedan\", and a moderator now holds two pictures of one member")
				.isEqualTo(1);
		assertThat(theWaitingRowOf(WHOSE_PICTURE_WAITS).get(6))
				.as("the row still names the picture it named before, so nothing was overwritten")
				.isNotEqualTo(wasWaiting)
				.isEqualTo(answerIn(answer).path("digest").asString());
	}

	/**
	 * AND IT IS THE SAME ROW, IN THE SAME PLACE, WITH THE MODERATOR STILL HOLDING IT.
	 *
	 * <p><b>This is the case that says which of the two shapes „gazi" means</b>, and the owner's
	 * own boundary is what decides it (PDL 21c): „ako clan pregazi sliku dok je moderator gleda,
	 * RED MU SE PROMENI POD RUKOM. Po pravilu da red ostaje jedan to je prihvatljivo, ali se zna
	 * i zapisano je." A row that was deleted and opened again does not change under anybody's
	 * hand: it vanishes, and V28's {@code verification_lock_verification_fk} is ON DELETE CASCADE,
	 * so the hold goes with it. Measured on a real PostgreSQL before this was written, both ways:
	 * one hold before, one after a repoint, none after a delete.
	 *
	 * <p><b>And {@code raised_at} is the second half, which is not decoration.</b> V9 indexes the
	 * queue by {@code (queue, raised_at)} and every reader orders by it, so a row opened afresh
	 * would send a member who moves his circle to the BACK of the queue each time. Keeping the row
	 * keeps his place, and that follows from the choice rather than being a separate decision.
	 */
	@Test
	void theOverwrittenRowIsTheSameRowInTheSamePlaceAndStillHeld() throws Exception {
		long row = theQueueRowOf(WHOSE_PICTURE_WAITS);
		Instant place = theQueuePlaceOf(WHOSE_PICTURE_WAITS);

		aModeratorHolds(row);

		assertThat(sending(WHOSE_PICTURE_WAITS, aJpeg("nova slika preko stare")).getStatus())
				.isEqualTo(200);

		assertThat(theQueueRowOf(WHOSE_PICTURE_WAITS))
				.as("THE ROW WAS REPLACED RATHER THAN REPOINTED. The owner's boundary says the row"
						+ " changes under the moderator's hand, not that it disappears from under"
						+ " it.")
				.isEqualTo(row);
		assertThat(theQueuePlaceOf(WHOSE_PICTURE_WAITS))
				.as("the member lost his place in a queue V9 orders by raised_at, so moving a"
						+ " circle sends him to the back of it")
				.isEqualTo(place);
		assertThat(howManyHoldsOn(row))
				.as("the moderator's hold was thrown away by a member replacing his picture, which"
						+ " is what ON DELETE CASCADE does to it when the row is deleted")
				.isEqualTo(1);
	}

	/**
	 * AND THE PICTURE THAT WAS OVERWRITTEN GOES, ROW AND FILE BOTH.
	 *
	 * <p>The file has to be put there by the case, because the fixture writes {@code photo} rows
	 * and no files - so this is also the one case in which the file of an overwritten picture
	 * really exists, and its sibling below is the one in which it does not.
	 *
	 * <p><b>The row count is asserted as a NUMBER rather than „one fewer", because both halves
	 * happen at once:</b> one row is written for the new picture and one is taken away for the
	 * old, so a route that wrote the new one and kept the old would show the same count as a
	 * route that did neither. The digest assertion beside it is what tells those apart.
	 */
	@Test
	void theOverwrittenPicturesRowAndFileBothGo() throws Exception {
		long overwritten = theWaitingPhotoOf(WHOSE_PICTURE_WAITS);
		long rowsBefore = howManyPhotoRows();

		aFileFor(overwritten);

		assertThat(sending(WHOSE_PICTURE_WAITS, aJpeg("nova slika preko stare")).getStatus())
				.isEqualTo(200);

		assertThat(db.sql("select count(*) from photo where id = ?").param(overwritten)
						.query(Long.class).single())
				.as("the picture that was overwritten still has a row, which nothing points at and"
						+ " nothing will ever serve")
				.isZero();
		assertThat(fileOf(overwritten))
				.as("the file of the overwritten picture stayed on the disk for ever")
				.doesNotExist();
		assertThat(howManyPhotoRows())
				.as("one picture came in and one went out, so the table must be exactly as long")
				.isEqualTo(rowsBefore);
		assertThat(fileOf(theWaitingPhotoOf(WHOSE_PICTURE_WAITS)))
				.as("the new picture has no file, so the overwrite deleted the wrong one")
				.exists();
	}

	/**
	 * AND A FILE THAT HAD ALREADY GONE IS ONLY WRITTEN DOWN, NOT MADE INTO A REFUSAL.
	 *
	 * <p>{@code remove} has the identical half and gives the reason: a row whose file has already
	 * gone is a state {@link PhotoApi} names and serves nothing for, and refusing to finish an
	 * overwrite because of it would leave the member unable to replace a picture nobody can see.
	 * The fixture's rows carry no files at all, so this is the state by default and the case above
	 * is the one that has to arrange the other.
	 */
	@Test
	void anOverwriteWhoseOldFileWasAlreadyGoneStillSucceeds() throws Exception {
		long overwritten = theWaitingPhotoOf(WHOSE_PICTURE_WAITS);

		assertThat(fileOf(overwritten))
				.as("the fixture wrote a file, so this case no longer measures the missing one")
				.doesNotExist();

		assertThat(sending(WHOSE_PICTURE_WAITS, aJpeg("nova preko one bez fajla")).getStatus())
				.as("a picture whose file was already missing stopped its member from sending"
						+ " another")
				.isEqualTo(200);

		assertThat(howManyPicturesWaitFor(WHOSE_PICTURE_WAITS)).isEqualTo(1);
	}

	/**
	 * A ROW THAT HAS BEEN DECIDED IS NOT OVERWRITTEN: HE GETS A NEW ONE BESIDE IT.
	 *
	 * <p>PDL 21c is about the row that is WAITING - „gazi trenutan red" - and a decided row is
	 * not that. It also cannot be repointed at all: V9's
	 * {@code verification_decided_keeps_no_photo} refuses a picture on a row that is not waiting,
	 * which {@code theSchemaRefusesADecidedRowThatStillHoldsAPicture} pins from the other side.
	 *
	 * <p><b>{@link #WHOSE_PICTURE_WAS_REFUSED} carries a decided row and nothing waiting</b>, so
	 * the count going from nought to one is what says a row was opened rather than a decision
	 * overwritten, and the refused row is read back to show it was left exactly as it was (PDL,
	 * owner: a refused row stands for ever with its state and its reason).
	 */
	@Test
	void aDecidedRowIsLeftAloneAndANewOneIsOpenedBesideIt() throws Exception {
		long rowsBefore = howManyRowsInTheQueue();

		assertThat(sending(WHOSE_PICTURE_WAS_REFUSED, aJpeg("posle odbijanja saljem novu"))
				.getStatus()).isEqualTo(200);

		assertThat(howManyPicturesWaitFor(WHOSE_PICTURE_WAS_REFUSED))
				.as("nothing waits, so the send overwrote a decision instead of opening a row")
				.isEqualTo(1);
		assertThat(howManyRowsInTheQueue())
				.as("the refused row was taken away, and PDL says a refusal stands for ever")
				.isEqualTo(rowsBefore + 1);
		assertThat(db.sql("select count(*) from verification where state = 'rejected'"
						+ " and reason is not null and competitor_id ="
						+ " (select id from competitor where member_number = ?)")
						.param(WHOSE_PICTURE_WAS_REFUSED).query(Long.class).single())
				.as("the refusal lost its state or its reason")
				.isEqualTo(1);
	}

	/* ------------------------------------------------------------------------------------
	   PDL 21c, SECOND HALF: MOVING ONLY THE CIRCLE.
	   ------------------------------------------------------------------------------------ */

	/**
	 * MOVING THE CIRCLE ALONE IS SENT WITH NO FILE AT ALL, AND CHANGES THE CROP IN PLACE.
	 *
	 * <p>Owner, PDL 21c: „Ako hocu da pregazim novom ILI DA POMERIM KRUG da gadja drugi deo
	 * slike". Until this increment {@link MePhotoApi} answered
	 * {@link MePhotoApi#THE_FORM_IS_NOT_COMPLETE} to a request with no file, so sending only the
	 * circle was not possible at all.
	 *
	 * <p><b>The crop is moved to three numbers the fixture does not use anywhere</b>, so an answer
	 * that echoed what was sent rather than writing it, or a route that wrote one fraction and
	 * left two, comes back visibly wrong. The digest is asserted NOT to move: the same bytes under
	 * the same name are the whole point of doing this without a new file.
	 */
	@Test
	void movingOnlyTheCircleNeedsNoFileAndKeepsTheSamePicture() throws Exception {
		long picture = theWaitingPhotoOf(WHOSE_PICTURE_WAITS);
		long row = theQueueRowOf(WHOSE_PICTURE_WAITS);
		long rowsBefore = howManyPhotoRows();
		String digest = theWaitingRowOf(WHOSE_PICTURE_WAITS).get(6);

		MockHttpServletResponse answer =
				sendingOnlyTheCircle(WHOSE_PICTURE_WAITS, "0.125", "0.875", "0.625");

		assertThat(answer.getStatus())
				.as("a send carrying only the three fractions was refused, so PDL 21c's second"
						+ " half is not implemented")
				.isEqualTo(200);

		assertThat(theWaitingRowOf(WHOSE_PICTURE_WAITS).subList(7, 10))
				.as("the circle the member moved was not written to the picture that is waiting")
				.containsExactly("0.12500000", "0.87500000", "0.62500000");
		assertThat(theWaitingRowOf(WHOSE_PICTURE_WAITS).get(6))
				.as("a new picture was written for a request that carried no bytes at all")
				.isEqualTo(digest);
		assertThat(howManyPhotoRows())
				.as("moving a circle wrote a second photo row, so the same bytes are on the disk"
						+ " twice")
				.isEqualTo(rowsBefore);
		assertThat(theWaitingPhotoOf(WHOSE_PICTURE_WAITS)).isEqualTo(picture);
		assertThat(answerIn(answer).path("waiting").asLong())
				.as("the answer names a different queue row than the one that was there")
				.isEqualTo(row);
		assertThat(answerIn(answer).path("digest").asString()).isEqualTo(digest);
	}

	/**
	 * AND MOVING THE CIRCLE WITH NOTHING WAITING IS STILL THE FORM THAT IS NOT COMPLETE.
	 *
	 * <p>This is the boundary as it was settled: 21c's sentence presupposes a row to overwrite
	 * („gazi trenutan red"), so with nothing waiting there is no picture here to re-cut and the
	 * answer this class already had goes on being the right one. Whether a member may move the
	 * circle over a picture that has been APPROVED is a separate question that no decision
	 * answers, and nothing here invents one: that would mean copying a {@code photo} row and its
	 * file, which is a mechanism this portal does not have.
	 *
	 * <p><b>{@link #ME} has a picture ON the profile and nothing waiting</b>, so this is not the
	 * empty case: there is a portrait of his in the table, and the answer is still that there is
	 * nothing to re-cut.
	 */
	@Test
	void movingTheCircleWithNothingWaitingIsRefused() throws Exception {
		long rowsBefore = howManyPhotoRows();

		MockHttpServletResponse answer = sendingOnlyTheCircle(ME, "0.125", "0.875", "0.625");

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);

		assertThat(howManyPicturesWaitFor(ME))
				.as("a request with no bytes in it put something in front of a moderator")
				.isZero();
		assertThat(howManyPhotoRows()).isEqualTo(rowsBefore);
		assertThat(theWaitingRowOf(WHOSE_PICTURE_WAITS).subList(7, 10))
				.as("somebody else's waiting circle was moved by a member who has none")
				.containsExactly("0.30000000", "0.70000000", "0.45000000");
	}

	/**
	 * AND A CIRCLE THAT IS NOT THREE FRACTIONS IS REFUSED EVEN WHEN THERE IS A PICTURE TO MOVE
	 * IT OVER.
	 *
	 * <p>The order matters and this is what pins it: the crop is parsed AFTER it is known that
	 * there is something to re-cut, so a member with a waiting picture and a broken fraction is
	 * told which fault is his rather than being told the form is incomplete. Written the other way
	 * round, both members would get the same sentence and neither would be right.
	 */
	@Test
	void movingTheCircleToSomethingThatIsNotAFractionIsRefused() throws Exception {
		MockHttpServletResponse answer =
				sendingOnlyTheCircle(WHOSE_PICTURE_WAITS, "0.125", "ovo nije broj", "0.625");

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("a member who has a picture to re-cut was told his FORM was incomplete, which"
						+ " names the wrong fault")
				.isEqualTo(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);

		assertThat(theWaitingRowOf(WHOSE_PICTURE_WAITS).subList(7, 10))
				.as("one fraction was written before the broken one was noticed")
				.containsExactly("0.30000000", "0.70000000", "0.45000000");
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
			"blizu, 0.5, 0.5", "0.5, 0.5, 0.123456789",
			/* SENT AND EMPTY, which is not the same request as NOT SENT: a form posts an
			   untouched box as an empty value, and a condition written only for the absent
			   one would hand this to `new BigDecimal("")`. Added because the coverage gate
			   named the branch; kept because it is the shape a browser really sends. */
			"'', 0.5, 0.5", "0.5, '   ', 0.5" })
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

	/**
	 * AND A REQUEST CARRYING NO PICTURE IS TOLD THE FORM IS NOT COMPLETE, in both ways it can
	 * carry none.
	 *
	 * <p><b>Two rows and not one, and the second was added because the coverage gate asked
	 * for it rather than because it looked tidy.</b> A part that is THERE and empty and a
	 * part that was never sent AT ALL are two different requests: the first is a member who
	 * pressed send with nothing chosen, and the second is a form that posted its other fields
	 * and left the file out - which is what a browser does when the input has no file and the
	 * form is built by hand. {@code @RequestPart(required = false)} turns the second into a
	 * null, and a condition written for only one of them would answer 500 to the other.
	 *
	 * <p><b>SINCE PDL 21c THIS CASE ALSO DEPENDS ON WHO IS ASKING, and it is {@link #ME} on
	 * purpose.</b> A send with no file is how a moved circle is sent, so it is a legal request for
	 * a member who HAS something waiting - see
	 * {@link #movingOnlyTheCircleNeedsNoFileAndKeepsTheSamePicture}. {@link #ME} has a portrait on
	 * his profile and nothing in the queue, so for him both shapes above are still a form that is
	 * not complete, and that is what this case goes on measuring.
	 */
	@Test
	void aRequestWithNoFileIsToldTheFormIsNotComplete() throws Exception {
		MockHttpServletResponse empty = sending(ME, new byte[0], MediaType.IMAGE_JPEG_VALUE,
				"portret.jpg", "0.5", "0.5", "0.5");

		assertThat(empty.getStatus()).isEqualTo(400);
		assertThat(reasonIn(empty)).isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);

		MockHttpServletResponse none = http.perform(multipart("/api/me/photo").with(csrf())
						.param("cropX", "0.5").param("cropY", "0.5").param("cropSize", "0.5")
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(ME))))
				.andReturn().getResponse();

		assertThat(none.getStatus())
				.as("a multipart request that carried no picture part at all was not answered by"
						+ " this route, which is what a missing argument looks like")
				.isEqualTo(400);
		assertThat(reasonIn(none)).isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
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

	/**
	 * AND THE EDGE LETS THROUGH MORE THAN THE CONTAINER TAKES, the fourth floor and the
	 * one nothing named until a review of PR 381 (27.09.2026) measured it.
	 *
	 * <p>nginx sits in front of the two floors above and its own default, one megabyte,
	 * answered before either of them ever saw a request: measured before the line this
	 * reads existed, {@code grep -rn "client_max_body_size"} over the whole repository
	 * found nothing at all, so an ordinary photograph off a telephone never reached this
	 * class's own paragraph, and the member read nginx's plain 413 instead, with advice
	 * to retry an upload that could never succeed.
	 *
	 * <p>Read the file rather than trusted, the way
	 * {@link #theContainerLetsThroughMoreThanThePortalTakes} reads the settings rather
	 * than trusting the paragraph above it, and PARSED rather than searched, for the
	 * reason {@code WhatAPictureIsTest.theTypesItRecognisesAreExactlyTheOnesTheColumnHolds}
	 * gives for parsing the migration instead of grepping it: a search is satisfied by a
	 * line somebody commented out. nginx's own units - {@code k} and {@code m} - are not
	 * {@link org.springframework.util.unit.DataSize}'s {@code KB} and {@code MB}, so this
	 * converts them itself rather than reusing the read above.
	 */
	@Test
	void theEdgeLetsThroughMoreThanTheContainerTakes(
			@Autowired org.springframework.core.env.Environment settings) throws Exception {

		Path conf = Path.of("..", "frontend", "nginx-to-backend.conf");
		String written = Files.readString(conf);
		java.util.regex.Matcher directive = java.util.regex.Pattern
				.compile("client_max_body_size\\s+(\\d+)([a-zA-Z]?)\\s*;")
				.matcher(written);

		assertThat(directive.find())
				.as("%s sets no client_max_body_size nginx can read, so nginx's own default"
						+ " of one megabyte answers before either paragraph above ever sees a"
						+ " request", conf)
				.isTrue();

		long amount = Long.parseLong(directive.group(1));
		String unit = directive.group(2);
		long edge = unit.equalsIgnoreCase("k") ? amount * 1024
				: unit.equalsIgnoreCase("m") ? amount * 1024 * 1024
				: amount;

		long container = org.springframework.util.unit.DataSize
				.parse(settings.getProperty("spring.servlet.multipart.max-file-size", "1MB"))
				.toBytes();

		assertThat(edge)
				.as("nginx refuses a file the container would have taken, so neither the"
						+ " container's own limit nor the portal's sentence about it ever"
						+ " decides anything")
				.isGreaterThan(container);
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

	/**
	 * THE FLOOR UNDER A CONDITION THAT CANNOT BE MEASURED WHERE IT IS WRITTEN.
	 *
	 * <p><b>Found by a mutation rather than by reading.</b> Loosening
	 * {@code state = 'waiting'} to „any state at all" in {@link MePhotoApi}'s own query left
	 * this whole file green, 31 of 31. That is not a case missing: V9's
	 * {@code verification_decided_keeps_no_photo check (state = 'waiting' or photo_id is
	 * null)} means a row holding a picture is necessarily still waiting, so no fixture can
	 * separate the two conditions - the database refuses to hold the row that would.
	 *
	 * <p><b>So the measurement moves to where it can be made.</b> Instead of pretending a
	 * case measures that line, this asks the database for the row the whole arrangement rests
	 * on and requires it to be refused. The day somebody relaxes that constraint, this goes
	 * red and the note in {@link MePhotoApi} is where to come back to.
	 *
	 * <p><b>Both halves, because a case that only asserted the refusal would pass against a
	 * database that refused everything.</b> The same row with {@code photo_id} left empty is
	 * written without complaint.
	 *
	 * <p><b>AND THE ORDER OF THE TWO HALVES IS LOAD BEARING, WHICH COST A ROUND TO FIND.</b>
	 * Written the other way round - the refusal first - the second half failed too, and not
	 * because the row was wrong: PostgreSQL aborts the WHOLE transaction on any error at all
	 * ({@code RegistrationApi} writes that out at length as its reason for
	 * {@code on conflict do nothing}), and this case runs inside the test's transaction. So
	 * everything after the refused statement is refused with „current transaction is
	 * aborted", which says nothing about the constraint and reads exactly like the finding
	 * this case exists to report. The row that must be ACCEPTED therefore goes first.
	 */
	@Test
	void theSchemaRefusesADecidedRowThatStillHoldsAPicture() {
		long picture = picture();

		assertThat(db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " state, decided_at, decided_by_name, reason)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " 'Neko Nekic', '', 'rejected',"
						+ " timestamptz '2026-09-01 10:00:00+00', 'Moderator Bezimeni',"
						+ " 'Lice nije u fokusu.')")
				.params(THE_PROFILES_TAB, ME).update())
				.as("a decided row WITHOUT a picture is refused too, so what is measured below"
						+ " would be a database refusing everything rather than this one"
						+ " constraint")
				.isEqualTo(1);

		org.assertj.core.api.Assertions.assertThatThrownBy(() -> db.sql(
						"insert into verification (queue, competitor_id, subject, body, photo_id,"
								+ " state, decided_at, decided_by_name, reason)"
								+ " values (?, (select id from competitor where member_number = ?),"
								+ " 'Neko Nekic', '', ?, 'rejected',"
								+ " timestamptz '2026-09-01 10:00:00+00', 'Moderator Bezimeni',"
								+ " 'Lice nije u fokusu.')")
				.params(THE_PROFILES_TAB, ME, picture).update())
				.as("the database accepted a DECIDED row that still holds a picture, so"
						+ " `photo_id is not null` no longer implies `state = 'waiting'` and"
						+ " MePhotoApi.thePictureThatWaits is relying on something that is no"
						+ " longer true")
				.hasMessageContaining("verification_decided_keeps_no_photo");
	}

	/**
	 * THE TYPES THE RUNNING SCHEMA REALLY HOLDS, ASKED OF THE CATALOGUE AND NOT OF A FILE.
	 *
	 * <p><b>The other half of a floor that was one half, and a review on 25.09.2026 named
	 * what the first half could not see.</b> {@code WhatAPictureIsTest} reads the TEXT of V8,
	 * which is cheap and early and blind in one direction: a LATER migration altering
	 * {@code photo_media_type_known} would leave V8's text saying three types while the column
	 * held two or four, and the portal would go on accepting a type the database refuses - a
	 * member handing over a picture and being answered 500 by a constraint.
	 *
	 * <p><b>So this one asks the thing that actually decides.</b> {@code pg_constraint} is the
	 * running catalogue of the database Flyway has just migrated, so it answers for EVERY
	 * migration rather than for the one somebody remembered. Widening the file-reading half to
	 * every migration's text was the alternative and it is the bottomless question this
	 * codebase has refused before: the number of ways to write one constraint is not finite
	 * from where a reader of source stands.
	 *
	 * <p>Nothing is typed out here either: the names come off
	 * {@link WhatAPictureIs#THE_TYPES_THE_SCHEMA_ALLOWS} and the rest out of the catalogue.
	 */
	@Test
	void theTypesTheSchemaReallyHolds() {
		String definition = db.sql("select pg_get_constraintdef(oid) from pg_constraint"
						+ " where conname = 'photo_media_type_known'")
				.query(String.class)
				.single();

		List<String> inTheColumn = new java.util.ArrayList<>();
		java.util.regex.Matcher each = java.util.regex.Pattern.compile("'([^']+)'")
				.matcher(definition);

		while (each.find()) {
			inTheColumn.add(each.group(1));
		}

		assertThat(inTheColumn)
				.as("the running database's photo_media_type_known was read as an empty list, so"
						+ " this compares nothing: %s", definition)
				.isNotEmpty();

		assertThat(WhatAPictureIs.THE_TYPES_THE_SCHEMA_ALLOWS)
				.as("the portal recognises a type THE RUNNING DATABASE cannot hold, or the column"
						+ " holds one no route could ever write into it. A later migration has"
						+ " moved this constraint and V8's text no longer describes it.")
				.containsExactlyInAnyOrderElementsOf(inTheColumn);
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

	/* ------------------------------------------------------------------------------------
	   PDL 21b: WHAT THE SCREEN SEES WHEN IT IS OPENED AGAIN.
	   ------------------------------------------------------------------------------------ */

	/**
	 * THE WHOLE POINT OF THIS INCREMENT: THE WAITING PICTURE SURVIVES A RELOAD.
	 *
	 * <p><b>Owner, PDL 21b, 27.09.2026:</b> „ukoliko udjem da posaljem ponovo, vidim da je
	 * trenutno slika u statusu cekanja i tu vidim trenutno azuriranu sliku sa krugom." What was
	 * measured before this route existed is that the picture reached the screen ONLY in the visit
	 * that sent it: the bytes were in that browser and the mark beside them was an overlay in front
	 * of the session, so after a reload nothing answered either.
	 *
	 * <p><b>THE SEND AND THE READ ARE DELIBERATELY NOT THE SAME REQUEST, which is what makes this
	 * a case about a reload rather than about an echo.</b> The picture is sent, and then the state
	 * is asked for over a second request that carries nothing but the session cookie - no bytes, no
	 * crop, nothing the first request said. Everything asserted below therefore came out of the
	 * database.
	 *
	 * <p><b>And the circle is moved to numbers nothing else in the fixture uses</b>, so an answer
	 * reading the STANDING picture's crop instead of the waiting one's is visibly wrong rather
	 * than accidentally right.
	 */
	@Test
	void afterAReloadTheWaitingPictureIsAnsweredWithItsOwnCircle() throws Exception {
		MockHttpServletResponse sent = sending(ME, aJpeg("slika koja mora da prezivi reload"),
				MediaType.IMAGE_JPEG_VALUE, "portret.jpg", "0.125", "0.875", "0.625");

		assertThat(sent.getStatus()).isEqualTo(200);

		MockHttpServletResponse reload = askingForMine(ME);

		assertThat(answerIn(reload).path("waiting").path("photo").asString())
				.as("NOTHING ANSWERS THE MEMBER HIS OWN WAITING PICTURE AFTER A RELOAD, which is"
						+ " the state PDL 21b was written against")
				.isEqualTo("/api/me/photo/" + answerIn(sent).path("digest").asString());
		assertThat(theCircleWrittenIn(reload, "waiting"))
				.as("the circle answered beside the waiting picture is not the circle he set, or"
						+ " not at the scale V21 declares so that „what the member chose is what is"
						+ " stored and what is read back, byte for byte\"")
				.isEqualTo("\"crop\":{\"x\":0.12500000,\"y\":0.87500000,\"size\":0.62500000}");
	}

	/**
	 * AND THE TWO PICTURES ARE ANSWERED APART, AT TWO DIFFERENT ADDRESSES.
	 *
	 * <p>This is the axis the record exists for. PDL 21a keeps the waiting picture OFF the profile
	 * („Clan i ne treba da vidi svoju sliku dok nije odobrena") while 21b puts it ON the screen he
	 * sends from, so a screen has to be able to draw „this is what everybody sees" beside „this is
	 * what you sent" - which one field could not do.
	 *
	 * <p><b>The two addresses are not the same prefix and that is the assertion</b>: the standing
	 * picture is published and lives under {@code /api/photos/}, and the waiting one is not public
	 * at all (ADL A60) and lives under {@code /api/me/photo/}. A route that answered the public
	 * address for both would hand the member a link that {@link PhotoApi#photo} refuses.
	 *
	 * <p><b>And the two crops are moved apart before anything is asked</b>, so „the waiting crop"
	 * cannot be satisfied by the standing one: every row the fixture writes carries the same three
	 * fractions, which is exactly the two-sources-one-value trap.
	 */
	@Test
	void theWaitingAndTheStandingPictureAreAnsweredApart() throws Exception {
		cropOf(theWaitingPhotoOf(WHOSE_PICTURE_WAITS), "0.1", "0.2", "0.3");
		cropOf(db.sql("select photo_id from competitor where member_number = ?")
				.param(WHOSE_PICTURE_WAITS).query(Long.class).single(), "0.8", "0.9", "1");

		MockHttpServletResponse answer = askingForMine(WHOSE_PICTURE_WAITS);
		JsonNode mine = answerIn(answer);

		assertThat(mine.path("waiting").path("photo").asString())
				.as("the waiting picture was answered at the PUBLIC address, which refuses it")
				.isEqualTo("/api/me/photo/" + theWaitingRowOf(WHOSE_PICTURE_WAITS).get(6))
				.startsWith("/api/me/photo/");
		assertThat(mine.path("standing").path("photo").asString())
				.as("the picture on the profile was answered at the member's private address")
				.isEqualTo("/api/photos/" + digestStandingOn(WHOSE_PICTURE_WAITS));

		assertThat(theCircleWrittenIn(answer, "waiting"))
				.as("the crop of the STANDING picture was answered beside the waiting one")
				.isEqualTo("\"crop\":{\"x\":0.10000000,\"y\":0.20000000,\"size\":0.30000000}");
		assertThat(theCircleWrittenIn(answer, "standing"))
				.as("the crop of the WAITING picture was answered beside the standing one")
				.isEqualTo("\"crop\":{\"x\":0.80000000,\"y\":0.90000000,\"size\":1.00000000}");
	}

	/**
	 * AND EACH HALF IS NULL ON ITS OWN, WHICH IS THREE STATES AND NOT TWO.
	 *
	 * <p>PDL P28f fixed the shape for {@link CompetitorApi} - „oba `null` za clana bez slike" - and
	 * there is no reason for this answer to invent a second convention. The three rows are the
	 * three states a member can really be in, and each of them is somebody different in the
	 * fixture rather than the same member rearranged:
	 *
	 * <ul>
	 * <li>{@link #ME} has a portrait and nothing waiting.
	 * <li>{@link #HAS_NO_PICTURE} has neither, which is the only member in the fixture who has
	 * never had one.
	 * <li>{@link #WHOSE_TEXT_WAITS} has a portrait and a TEXT waiting in the same tab, which must
	 * not be read as a waiting picture: that is the half of the tab {@code MeWriteApi} owns.
	 * </ul>
	 */
	@ParameterizedTest
	@CsvSource({ ME + ",false,true", HAS_NO_PICTURE + ",false,false",
			WHOSE_TEXT_WAITS + ",false,true" })
	void whatIsAnsweredWhenOneHalfOrBothAreMissing(String memberNumber, boolean waiting,
			boolean standing) throws Exception {

		JsonNode mine = answerIn(askingForMine(memberNumber));

		assertThat(mine.path("waiting").isNull())
				.as("%s: the waiting half of the answer is wrong, and a text waiting in the same"
						+ " tab is not a picture waiting", memberNumber)
				.isEqualTo(!waiting);
		assertThat(mine.path("standing").isNull())
				.as("%s: the standing half of the answer is wrong", memberNumber)
				.isEqualTo(!standing);
	}

	/**
	 * AND AN ACCOUNT THAT RACES FOR NOBODY IS ANSWERED NOTHING AT ALL.
	 *
	 * <p>The same answer {@link MePhotoApi#send} and {@link MePhotoApi#remove} give such an
	 * account, for the same reason: V23 lets an account exist with no member behind it (owner,
	 * 14.09.2026), and these addresses are not for it. ADL A8 of 13.09.2026 asks for 404 rather
	 * than 403, „isti odgovor kao da adresa ne postoji".
	 */
	@Test
	void anAccountThatRacesForNobodyIsAnsweredNothing() throws Exception {
		MockHttpServletResponse answer = http.perform(get("/api/me/photo")
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret())))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(404);
	}

	/**
	 * AND IT IS THE SESSION'S OWN MEMBER AND NEVER THE FIRST ONE IN THE TABLE.
	 *
	 * <p><b>The mutation this is written against is a statement that read any member rather than
	 * the one the session names</b>, and the fixture is arranged so that neither „the first row"
	 * nor „the only one" could pass for it: {@link #SOMEONE_ELSE} is written SECOND and has a
	 * picture waiting, {@link #WHOSE_PICTURE_WAITS} is written FOURTH and has one too, and both
	 * have a portrait standing as well. So the answer has to name this member's two digests and
	 * not another member's.
	 */
	@Test
	void theAnswerIsTheSessionsOwnMemberAndNotTheFirstWithAPicture() throws Exception {
		JsonNode mine = answerIn(askingForMine(WHOSE_PICTURE_WAITS));

		assertThat(mine.path("waiting").path("photo").asString())
				.isEqualTo("/api/me/photo/" + theWaitingRowOf(WHOSE_PICTURE_WAITS).get(6));
		assertThat(mine.path("waiting").path("photo").asString())
				.as("the answer named SOMEONE ELSE's waiting picture, and he was written first")
				.isNotEqualTo("/api/me/photo/" + theWaitingRowOf(SOMEONE_ELSE).get(6));
		assertThat(mine.path("standing").path("photo").asString())
				.as("the answer named somebody else's portrait")
				.isEqualTo("/api/photos/" + digestStandingOn(WHOSE_PICTURE_WAITS))
				.isNotEqualTo("/api/photos/" + digestStandingOn(FIRST_WRITTEN));
	}
}
