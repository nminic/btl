package com.btl.portal.web;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;

/**
 * THE PICTURE A NAME NAMES, AND THE FOUR WAYS OF BEING TOLD THERE IS NONE.
 *
 * <p><b>Every case here keeps a DECOY in the folder.</b> Beside each row's real file -
 * which is named after the row's {@code id}, as V8 decided - there is a second file named
 * after the row's DIGEST, holding different bytes. Without it, „the path is built from the
 * row" and „the path is built from the address" answer the same 200 on every case, and
 * nothing here would measure which of the two the server did. With it, a server that
 * resolved the name it was given serves the decoy and every case about bytes falls. It is
 * the same discipline as the one about two sources of one value: an assertion that cannot
 * tell right from wrong is not an assertion.
 *
 * <p><b>The bytes are not pictures and that is deliberate.</b> Nothing in {@link PhotoApi}
 * looks at them, so a real JPEG would measure nothing a byte array does not - while
 * {@code 0xFF} and {@code 0x00} inside them measure something a picture would not: that
 * nothing on the way out treats the body as text. What says an answer is a JPEG is its
 * row, which is the whole subject of this file.
 *
 * <p><b>The folder is this class's own and the setting points at it.</b> A folder shared
 * with a developer's own uploads would let a leftover file answer a case, and files are
 * not rolled back the way {@code @Transactional} rolls the rows back - so the folder is
 * emptied after every case and the names on disk are the ids the sequence really handed
 * out, not numbers written here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PhotoApiTest {

	/** One picture as it was written: what it is, what is in it, and what it is called. */
	private record Written(String digest, String mediaType, byte[] bytes) {
	}

	/**
	 * THREE PICTURES, NO TWO ALIKE IN ANYTHING THIS RESOURCE ANSWERS.
	 *
	 * <p>Three types, because „the type comes off the row" cannot be measured over one
	 * type: a server answering a fixed {@code image/jpeg} is right about a third of the
	 * fixture. Three different bodies, of three different lengths, because a server
	 * answering the wrong row would otherwise be answering the same bytes. And every digest
	 * is a different string, so no case can be satisfied by a lookup that ignores what it
	 * was asked for.
	 */
	private static final Written JPEG =
			new Written("a1".repeat(32), "image/jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8, 'j'});

	private static final Written PNG = new Written("b2".repeat(32), "image/png",
			new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x00});

	private static final Written WEBP = new Written("c3".repeat(32), "image/webp",
			new byte[] {'R', 'I', 'F', 'F', 0x00, (byte) 0xFF, 'W'});

	/**
	 * A ROW WHOSE FILE IS NOT THERE, which is its own state and not a way of being absent.
	 *
	 * <p>Its type is one of the three the others use rather than a fourth, so that „there
	 * is no file" and „it is some other kind of picture" cannot be confused for one another
	 * by a case reading the answer.
	 */
	private static final Written WITH_NO_FILE = new Written("d4".repeat(32), "image/png",
			new byte[] {'n', 'o', 't', ' ', 'w', 'r', 'i', 't', 't', 'e', 'n'});

	/**
	 * THE SAME PICTURE UPLOADED TWICE, which V8 allows on purpose: „The digest is what says
	 * two members uploaded the same picture." Two rows, one digest, and only the OLDER of
	 * them has a file - so which row decided is readable off the answer.
	 */
	private static final Written TWICE_OVER = new Written("e5".repeat(32), "image/jpeg",
			new byte[] {'t', 'h', 'e', ' ', 'e', 'l', 'd', 'e', 'r', (byte) 0xFF});

	/**
	 * A PICTURE WAITING FOR A MODERATOR, which is a row and a file and NOT a public picture.
	 *
	 * <p>Its whole point is that every other reason for a 404 is absent: the row is there,
	 * the file is on disk, the digest is the shape V8 gives one, and the only thing wrong
	 * with it is whose it is. {@code verification.photo_id} points at it and nothing else
	 * does.
	 */
	private static final Written WAITING = new Written("07".repeat(32), "image/png",
			new byte[] {'w', 'a', 'i', 't', 'i', 'n', 'g', (byte) 0x89});

	/**
	 * AND THE MARK OF A TEAM SOMEBODY HAS PROPOSED, which is the fourth holder and the
	 * second that is not public.
	 *
	 * <p>Written as its own picture rather than as a second use of the one above, because
	 * „a picture nobody published" and „a picture in the verification queue" are two
	 * sentences and a case satisfied by one of them must not pass on the other.
	 */
	private static final Written PROPOSED = new Written("18".repeat(32), "image/webp",
			new byte[] {'p', 'r', 'o', 'p', 'o', 's', 'e', 'd', 'R', 'I', 'F', 'F'});

	/** The shape of a digest, belonging to no row at all. */
	private static final String NOBODY_WROTE = "f6".repeat(32);

	/** Signed in, so that „who is asking" has two states and not one. */
	private static final String A_MEMBER = "clan@primer.rs";

	private static final Path FOLDER = aFolderOfItsOwn();

	@DynamicPropertySource
	static void whereThePicturesAre(DynamicPropertyRegistry settings) {
		settings.add("btl.photos.folder", FOLDER::toString);
	}

	private static Path aFolderOfItsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-case");
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/** The key the sequence handed each picture, which is what its file is called. */
	private final Map<String, Long> ids = new HashMap<>();

	/** The younger of the two rows one digest stands on, kept because a case asks about it. */
	private long theYoungerOfTheTwo;

	/**
	 * The pictures, written in an order that is nobody's answer, and then GIVEN TO SOMEBODY.
	 *
	 * <p>The three that are read are written PNG, WEBP, JPEG, so the row a case is about is
	 * never the first row, never the last, and never the only one of its kind. The row with
	 * no file is written between them rather than at the end, so „the last row written" is
	 * not a way of finding it either.
	 *
	 * <p><b>AND EVERY PICTURE HAS A HOLDER SINCE 20.09.2026, which is what the route now
	 * asks about.</b> Before that every row here was an orphan and the route answered them
	 * all, so „this picture is public" and „this picture exists" were the same fact and no
	 * case could tell them apart. The two pictures that must NOT be answered are held by the
	 * two holders that wait for a moderator, and they carry a row, a file and a digest of the
	 * right shape so that the only thing wrong with them is whose they are.
	 *
	 * <p><b>Four competitors and one team rather than one of each</b>, so that „the member
	 * who holds this picture" is never „the only member there is" and a lookup that forgot to
	 * name the row would be answering by accident.
	 */
	@BeforeEach
	void eightPicturesAndOneNameThatNamesNone() {
		write(PNG, true);
		write(WITH_NO_FILE, false);
		write(WEBP, true);
		write(JPEG, true);
		write(WAITING, true);
		write(PROPOSED, true);

		/* The same digest twice: the elder carries the file, the younger does not. Written
		   in this order so that „the newest row" answers 404 and „the oldest" answers the
		   bytes, which is how the tie-break is readable at all. */
		write(TWICE_OVER, true);
		theYoungerOfTheTwo = writeAnotherRowFor(TWICE_OVER);

		/* AND THE ELDER IS TOUCHED AFTERWARDS, WHICH IS THE WHOLE OF WHAT MAKES THE ORDER
		   MEASURABLE. Until 20.09.2026 the elder was simply written first, so the heap held
		   it first and an unordered `limit 1` picked it by accident: taking `order by id`
		   out of PhotoApi left this class green, and only reversing the order to `desc`
		   fell. Two sources of one value - „the older row" and „the row this database
		   happens to return first" were the same row.

		   An UPDATE moves a row: PostgreSQL writes a new version of it at the end of the
		   page and leaves a redirect behind, which a sequential scan skips. So the younger
		   row is now the one an unordered read sees first, the two sources are separated,
		   and `twoRowsWithOneDigestAreDecidedByTheOlder` pins that arrangement before it
		   asserts anything. What is changed is the crop, which is a real thing that happens
		   to a picture (PDL, 12.08.2026, the crop is remembered beside it) and which nothing
		   this route answers ever reads. */
		db.sql("update photo set crop_x = 0.33 where id = ?")
				.param(ids.get(TWICE_OVER.digest())).update();

		competitorHolding("000901", PNG);
		competitorHolding("000902", WITH_NO_FILE);
		competitorHolding("000903", JPEG);
		competitorHolding("000904", ids.get(TWICE_OVER.digest()));
		competitorHolding("000905", theYoungerOfTheTwo);
		teamHolding(WEBP);
		waitingOn(WAITING);
		proposalHolding(PROPOSED);

		account(A_MEMBER);
	}

	/** Files outlive a rolled back transaction, so they are taken away by hand. */
	@AfterEach
	void theFolderIsLeftEmpty() throws IOException {
		try (Stream<Path> left = Files.walk(FOLDER)) {
			for (Path one : left.sorted(Comparator.reverseOrder()).toList()) {
				if (!one.equals(FOLDER)) {
					Files.delete(one);
				}
			}
		}
	}

	private void write(Written picture, boolean withItsFile) {
		long id = db
				.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values (?, ?, ?, ?, ?, ?) returning id")
				.params(picture.mediaType(), picture.bytes().length, picture.digest(),
						new BigDecimal("0.25"), new BigDecimal("0.75"), new BigDecimal("0.40"))
				.query(Long.class).single();

		ids.put(picture.digest(), id);

		if (withItsFile) {
			onDisk(String.valueOf(id), picture.bytes());
		}

		/* THE DECOY, and the note at the head of this class says what it is for: a file
		   named after the DIGEST, which is the one string a server building its path out of
		   the address would land on. Its bytes are this picture's read backwards, so they
		   are the same length - a case that fell on the length alone would not be saying
		   which file was served. */
		onDisk(picture.digest(), backwards(picture.bytes()));
	}

	/** A second row for one digest, and no file of its own. */
	private long writeAnotherRowFor(Written picture) {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values (?, ?, ?, ?, ?, ?) returning id")
				.params(picture.mediaType(), picture.bytes().length, picture.digest(),
						new BigDecimal("0.10"), new BigDecimal("0.20"), new BigDecimal("0.30"))
				.query(Long.class).single();
	}

	/**
	 * A MEMBER WHOSE PORTRAIT THIS IS, which is one of the two holders the portal publishes.
	 *
	 * <p>A whole member rather than an update of one, because the picture's holder is the
	 * thing the route asks about and a member who exists only as a name in an update is not a
	 * holder of anything.
	 */
	private void competitorHolding(String number, Written picture) {
		competitorHolding(number, ids.get(picture.digest()));
	}

	/** The same, by the key of ONE row, for the digest that stands on two of them. */
	private void competitorHolding(String number, long photo) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at, photo_id)"
						+ " values (?, 'Ime', 'Prezime', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00', ?)")
				.params(number, String.format("%016x", ++issued), photo)
				.update();
	}

	/** A team whose mark this is, which is the other holder the portal publishes. */
	private void teamHolding(Written picture) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values ('tim-sa-znakom', 'Tim sa znakom', '',"
						+ " '', (select id from place where rank = 1), null, null, ?, 2027, null)")
				.param(ids.get(picture.digest()))
				.update();
	}

	/**
	 * A PICTURE IN THE QUEUE, held by a row that is WAITING and by nothing else.
	 *
	 * <p>The state is written out rather than defaulted, because it is the half of this
	 * fixture that carries the meaning: V9's {@code verification_decided_keeps_no_photo}
	 * refuses a decided row that still holds a photograph, so „waiting" is the only state
	 * this picture could be in and the case about it says so.
	 */
	private void waitingOn(Written picture) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, state)"
						+ " values ('profiles', (select id from competitor"
						+ " where member_number = '000901'), 'Nova slika', '', ?, 'waiting')")
				.param(ids.get(picture.digest()))
				.update();
	}

	/** And a team somebody has PROPOSED, which is the fourth holder and is not a team yet. */
	private void proposalHolding(Written picture) {
		db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link, place_id,"
						+ " city, country_id, logo_id) values ((select id from competitor"
						+ " where member_number = '000902'), null, 'Predlozen tim', '', '',"
						+ " (select id from place where rank = 1), null, null, ?)")
				.param(ids.get(picture.digest()))
				.update();
	}

	/** So that no two members share a referral code, which the schema requires to be unique. */
	private int issued;

	private static void onDisk(String name, byte[] bytes) {
		try {
			Files.write(FOLDER.resolve(name), bytes);
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	private static byte[] backwards(byte[] bytes) {
		byte[] other = new byte[bytes.length];

		for (int at = 0; at < bytes.length; at++) {
			other[at] = bytes[bytes.length - 1 - at];
		}

		return other;
	}

	private void account(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = 'competitor'))")
				.param(email).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** @param email null for the visitor, which is the same request without the cookie */
	private MockHttpServletRequestBuilder asking(String name, String email) {
		MockHttpServletRequestBuilder asks = get("/api/photos/{name}", name);

		return email == null ? asks
				: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private MockHttpServletResponse answerFor(String name) throws Exception {
		return http.perform(asking(name, null)).andReturn().getResponse();
	}

	private static Stream<Written> theThreeKinds() {
		return Stream.of(JPEG, PNG, WEBP);
	}

	/**
	 * A PICTURE COMES BACK AS THE BYTES OF ITS OWN FILE, UNDER THE TYPE ON ITS OWN ROW.
	 *
	 * <p><b>Both halves are read off the record the case itself wrote</b>, and not out of a
	 * constant standing beside it. A constant would make this a case about {@code image/jpeg}
	 * that happens to be run three times; read off the fixture, an answer that carried any
	 * fixed type is wrong on two of the three runs and an answer built from any other row is
	 * wrong on all three.
	 *
	 * <p><b>The bytes are compared whole.</b> The length alone would be satisfied by the
	 * decoy, which is this picture's own bytes turned round.
	 */
	@ParameterizedTest
	@MethodSource("theThreeKinds")
	void aPictureIsTheBytesOfItsFileUnderTheTypeOfItsRow(Written picture) throws Exception {
		MockHttpServletResponse answer = answerFor(picture.digest());

		assertThat(answer.getStatus())
				.as("a picture whose row and whose file are both there was not answered")
				.isEqualTo(200);
		assertThat(answer.getContentType())
				.as("the type answered is not the one this picture's row carries")
				.isEqualTo(picture.mediaType());
		assertThat(answer.getContentAsByteArray())
				.as("the bytes answered are not the ones in this picture's own file; the decoy"
						+ " named after the digest holds the same bytes turned round, and that is"
						+ " what a server resolving the address as a path would have served")
				.isEqualTo(picture.bytes());
	}

	/**
	 * AND THE FILE IS FOUND BY THE ROW'S KEY, WHICH IS A NUMBER AND NOT THE NAME THAT WAS
	 * ASKED FOR.
	 *
	 * <p>The case above already falls if the address is resolved as a path. This one says
	 * the same thing from the other side and is worth its three lines: it names what is in
	 * the folder, so whoever reads a failure of the case above can see that there really
	 * are two files and which of them is which. Without it, „the decoy" is a claim in a
	 * comment.
	 */
	@Test
	void theFolderHoldsBothTheFileAndTheDecoyThatSeparatesTheTwoSources() {
		assertThat(FOLDER.resolve(String.valueOf(ids.get(JPEG.digest()))))
				.as("the file named after the row's key is not there, so the case about bytes"
						+ " could only ever have been answered by the decoy")
				.exists();
		assertThat(FOLDER.resolve(JPEG.digest()))
				.as("nothing in the folder is named after the digest, so a server resolving the"
						+ " address as a path would answer 404 and every case would pass without"
						+ " saying which of the two names was used")
				.exists();
	}

	/**
	 * THE THREE WAYS OF BEING TOLD THERE IS NO PICTURE ARE ONE ANSWER.
	 *
	 * <p>PDL:6165, the owner's decision of 13.09.2026 arriving here: „Preusmerenje mora da
	 * se ponasa isto i za profil koga nema... Oba slucaja dobijaju isti ishod." A row whose
	 * file has gone must not be told apart from a digest nobody ever wrote, or a caller with
	 * no session learns which digests name rows, one request at a time.
	 *
	 * <p><b>What this compares, exactly, and what it cannot.</b> MockMvc does not run the
	 * container's ERROR dispatch, so the document a 404 carries is written by neither answer
	 * here and both bodies are empty whatever the code does - the same boundary
	 * {@code RightsAtTheDoor} names in its own words and {@code RightsOverRealHttpTest} goes
	 * down to a socket for. So this compares everything the HANDLER decides: the status, the
	 * type, the names of the headers and the body. What keeps the shape of the refusal equal
	 * is that all three leave through one method - a status written onto the response rather
	 * than sent as an error is a different answer on the wire, measured on 13.09.2026 - and
	 * that is held by there being one method rather than by this case.
	 */
	@Test
	void aRowWithNoFileIsAnsweredExactlyAsADigestNobodyWrote() throws Exception {
		/* THE TWO NAMES ARE HELD HERE AND THE FLOOR IS OVER THESE VERY STRINGS. Written
		   against the two constants instead, the floor stays true while a request quietly
		   moves onto the other name - measured, and it passed. The same fault as a floor
		   built beside the requests it is meant to hold rather than over them. */
		String itsFileHasGoneName = WITH_NO_FILE.digest();
		String nobodyWroteName = NOBODY_WROTE;

		assertThat(itsFileHasGoneName)
				.as("the two names in this comparison are one name, so everything below is"
						+ " satisfied by an answer being equal to itself")
				.isNotEqualTo(nobodyWroteName);

		MockHttpServletResponse itsFileHasGone = answerFor(itsFileHasGoneName);
		MockHttpServletResponse nobodyWroteIt = answerFor(nobodyWroteName);

		assertThat(itsFileHasGone.getStatus())
				.as("a row whose file is not on disk was answered something other than 404, so a"
						+ " caller can tell it apart from a digest nobody wrote")
				.isEqualTo(404);
		assertThat(nobodyWroteIt.getStatus())
				.as("a digest belonging to no row was answered something other than 404")
				.isEqualTo(404);

		assertThat(itsFileHasGone.getContentAsByteArray())
				.as("the two refusals do not carry the same body")
				.isEqualTo(nobodyWroteIt.getContentAsByteArray());
		assertThat(itsFileHasGone.getContentType())
				.as("the two refusals do not carry the same type")
				.isEqualTo(nobodyWroteIt.getContentType());
		assertThat(itsFileHasGone.getHeaderNames())
				.as("one refusal carries a header the other does not, which is the difference"
						+ " that says a row is there")
				.containsExactlyInAnyOrderElementsOf(nobodyWroteIt.getHeaderNames());
	}

	/**
	 * A DIGEST SPELT IN CAPITALS IS NOBODY, and the case is written over a picture that is
	 * REALLY THERE.
	 *
	 * <p>The row is there and the file is there, and the only thing wrong is the spelling,
	 * which is why the lower case spelling is asked for first: without that line the case
	 * would be satisfied by a picture that is not in the database at all.
	 *
	 * <p><b>WHAT HOLDS IT IS THE SCHEMA AND NOT THE PATTERN IN {@link PhotoApi}, and this
	 * case does not claim otherwise.</b> Measured by widening that pattern to accept
	 * capitals: this stayed green, because {@code photo_digest_shape} (V8) refuses an
	 * uppercase digest in the column, so there is no row any other spelling could find. The
	 * sentence being kept here is the one a reader of the portal cares about - a digest spelt
	 * in capitals is not a picture - and it is true of the server whichever of the two
	 * refuses it. The note on {@code PhotoApi.A_DIGEST} says what the pattern is kept for.
	 */
	@Test
	void aDigestSpeltInCapitalsIsNobody() throws Exception {
		String shouting = JPEG.digest().toUpperCase(Locale.ROOT);

		assertThat(answerFor(JPEG.digest()).getStatus())
				.as("this picture is not there in lower case either, so the case below compares"
						+ " nothing")
				.isEqualTo(200);

		assertThat(answerFor(shouting).getStatus())
				.as("a digest spelt in capitals was served, and V8 spells a digest in lower case"
						+ " (`photo_digest_shape`)")
				.isEqualTo(404);
	}

	/**
	 * AND NEITHER IS A NAME THAT IS NOT THE SHAPE OF A DIGEST AT ALL.
	 *
	 * <p>One short, one long, one carrying a letter that is not hexadecimal, one carrying a
	 * dot and one carrying two - the last two being what a caller asking for a file outside
	 * the folder would write. None of them can be any row's digest, which is why none of
	 * them is looked for.
	 *
	 * <p><b>It is not the dots that make this safe and the case must not be read as saying
	 * so.</b> What makes a path out of this folder unsayable is that the path is built from
	 * the row's key, which the case about bytes measures. This says the shorter thing: a
	 * name of the wrong shape is answered before anything is asked of anything.
	 */
	@ParameterizedTest
	@ValueSource(strings = {
			"a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a",
			"a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a",
			"g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1g1",
			"a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a.png",
			"...."})
	void aNameThatIsNotTheShapeOfADigestIsNothing(String name) throws Exception {
		assertThat(answerFor(name).getStatus())
				.as("%s is not the shape V8 gives a digest and it was not refused", name)
				.isEqualTo(404);
	}

	/**
	 * AND A NAME THAT CLIMBS IS REFUSED BEFORE IT IS A NAME AT ALL.
	 *
	 * <p>Its own case because the answer is 400 and not 404, and because the thing that
	 * gives it is not this route: a request carrying a {@code ..} segment is refused by the
	 * firewall in front of the chain, before any rule about pictures is consulted. Folded
	 * into the list above it would have read as „and this one is 404 too", which is not what
	 * was measured - exactly the reason
	 * {@code ApiSecurityTest.aPathThatClimbsOutOfTheCatalogueIsRefusedOutright} stands
	 * apart from its own neighbours.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"/api/photos/..", "/api/photos/../places"})
	void aNameThatClimbsOutOfTheFolderIsRefusedOutright(String path) throws Exception {
		assertThat(http.perform(get(path)).andReturn().getResponse().getStatus())
				.as("%s carries a climbing segment and was not refused outright", path)
				.isEqualTo(400);
	}

	/**
	 * AND A NAME WITH A SEPARATOR IN IT IS NOT THIS ROUTE'S ADDRESS AT ALL.
	 *
	 * <p>Its own case because the number is different and the reason is different. A second
	 * segment is not a name of the wrong shape that this route refuses - it is a path this
	 * route does not map and {@link ApiSecurity} does not open, so the chain answers the
	 * visitor 401 before anything here is reached. The same goes for the folder itself, which
	 * maps nothing: {@code /api/photos} is not on either open list, and a route that listed
	 * every picture is exactly what a digest for an address exists to prevent.
	 *
	 * <p>{@code ApiSecurityTest.nothingUnderTheApiIsOpenByAccident} holds the same sentence
	 * for the codebook of towns; this is that sentence for the one address of the portal that
	 * carries a name a stranger chooses.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"/api/photos", "/api/photos/",
			"/api/photos/a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1/a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1"})
	void aNameWithASeparatorInItIsNotThisRoutesAddress(String path) throws Exception {
		assertThat(http.perform(get(path)).andReturn().getResponse().getStatus())
				.as("%s was not refused by the chain, and only /api/photos/{name} is open", path)
				.isEqualTo(401);
	}

	/**
	 * TWO ROWS MAY CARRY ONE DIGEST, AND THE OLDER OF THEM DECIDES.
	 *
	 * <p>V8 puts no unique constraint on the column and says why: two members uploading the
	 * same picture is a thing that happens. Without an order and a limit the query would have
	 * two answers and {@code .optional()} would make that a 500 - an address that says „this
	 * digest is a popular picture", which is a sentence about the database answered to
	 * anybody. Only the elder has a file here, so which row was read is visible in the answer
	 * rather than argued: reading the younger is a 404.
	 */
	@Test
	void twoRowsWithOneDigestAreDecidedByTheOlder() throws Exception {
		List<Long> both = db.sql("select id from photo where digest = ? order by id")
				.param(TWICE_OVER.digest()).query(Long.class).list();

		assertThat(both)
				.as("one digest does not stand on two rows here, so this case measures nothing")
				.hasSize(2);

		/* AND THE DATABASE REALLY DOES OFFER THE YOUNGER ONE FIRST, which is what makes the
		   two lines below a sentence about `order by id` and not about luck. Measured
		   20.09.2026: without this arrangement the elder was written first and an unordered
		   `limit 1` picked it, so taking the order out of PhotoApi left this class green and
		   only reversing it to `desc` fell - which is to say the assertion had two sources
		   for one value. The setup touches the elder row afterwards to separate them, and
		   this line is where that separation is asserted rather than hoped for: if a future
		   PostgreSQL stops answering in heap order, this falls and says the case has stopped
		   measuring what it claims, instead of passing on for years. */
		assertThat(db.sql("select id from photo where digest = ? limit 1")
						.param(TWICE_OVER.digest()).query(Long.class).single())
				.as("an unordered read of these two rows answers the ELDER, so `order by id` in"
						+ " PhotoApi decides nothing here and both lines below would pass with"
						+ " it deleted")
				.isEqualTo(theYoungerOfTheTwo);

		MockHttpServletResponse answer = answerFor(TWICE_OVER.digest());

		assertThat(answer.getStatus())
				.as("a digest standing on two rows was not answered at all")
				.isEqualTo(200);
		assertThat(answer.getContentAsByteArray())
				.as("the younger row decided, and it has no file")
				.isEqualTo(TWICE_OVER.bytes());
	}

	/** One picture, who holds it, and whether that holder is something the portal publishes. */
	private record Held(String holder, Written picture, int answered) {

		@Override
		public String toString() {
			return holder + " -> " + answered;
		}
	}

	/**
	 * THE FOUR COLUMNS THAT POINT AT A PICTURE, AND WHAT EACH OF THEM MEANS.
	 *
	 * <p>Written out as four rather than two, because this is a fact with FOUR states: a
	 * case listing only the two that are answered would pass on a route that answered
	 * everything, and one listing only the two that are refused would pass on a route that
	 * answered nothing. The floor under this list is
	 * {@link #everyColumnPointingAtAPictureIsNamedHereAsPublicOrNot()}, which asks the
	 * schema.
	 */
	private static Stream<Held> everyHolderThereIs() {
		return Stream.of(
				new Held("competitor.photo_id", JPEG, 200),
				new Held("team.logo_id", WEBP, 200),
				new Held("verification.photo_id", WAITING, 404),
				new Held("team_proposal.logo_id", PROPOSED, 404));
	}

	/**
	 * A PICTURE IS ANSWERED IF SOMETHING PUBLIC HOLDS IT, AND NOT BECAUSE IT EXISTS.
	 *
	 * <p>ADL A36 P-javno, owner, 13.09.2026: „javno je ono sto Clan 73 nabraja, i nista
	 * vise. Sve ostalo ceka resurs koji zna ko pita." A review on 20.09.2026 measured what
	 * the route did instead: a row nothing public pointed at - only a {@code verification}
	 * row in state {@code waiting} - came back whole to a visitor, {@code status=200
	 * type=image/jpeg}. Nothing hands that address out today, so it was a rule that did not
	 * exist rather than a leak that was happening; this is the rule.
	 *
	 * <p><b>Every one of the four pictures here carries a ROW, a FILE and a digest of the
	 * right shape</b>, which is the whole of what makes the two refusals mean anything. A
	 * picture with no file, a digest nobody wrote and a name of the wrong shape are each
	 * refused for reasons of their own and each has its own case; take any of those three
	 * away from these two and the 404 would be true for a reason that is not this one. The
	 * floors below assert exactly that before the answer is read.
	 */
	@ParameterizedTest
	@MethodSource("everyHolderThereIs")
	void whatHoldsAPictureDecidesWhetherItIsAnswered(Held held) throws Exception {
		assertThat(db.sql("select count(*) from photo where digest = ?")
						.param(held.picture().digest()).query(Long.class).single())
				.as("%s: the digest this case asks for stands on no row, so a 404 would be the"
						+ " answer to a picture that is not there", held)
				.isEqualTo(1L);
		assertThat(FOLDER.resolve(String.valueOf(ids.get(held.picture().digest()))))
				.as("%s: this picture's file is not on disk, so a 404 would be the answer to a"
						+ " row whose file has gone", held)
				.exists();

		MockHttpServletResponse answer = answerFor(held.picture().digest());

		assertThat(answer.getStatus())
				.as("%s holds this picture and the route answered %d. A holder that waits for a"
						+ " moderator has published nothing (PDL, „Profilnu sliku administrator"
						+ " odobrava pre objave\"), and a holder the portal draws has", held,
						answer.getStatus())
				.isEqualTo(held.answered());

		if (held.answered() == 200) {
			assertThat(answer.getContentAsByteArray())
					.as("%s was answered with bytes that are not this picture's own", held)
					.isEqualTo(held.picture().bytes());
		}
	}

	/**
	 * AND A PICTURE THAT IS NOT PUBLIC IS ANSWERED EXACTLY WHAT A DIGEST NOBODY WROTE IS.
	 *
	 * <p>PDL:6165, the owner: „Oba slucaja dobijaju isti ishod." Told apart by anything at
	 * all, the refusal would say „this digest names a picture somebody is having moderated",
	 * which is the very sentence being withheld - and at an address nobody hands out, the
	 * only way to learn a digest is to be the person whose picture it is or to have taken it
	 * from somewhere, which is exactly the caller this is about.
	 *
	 * <p><b>The two names are held in variables and the floor is over those very strings</b>,
	 * the same shape {@link #aRowWithNoFileIsAnsweredExactlyAsADigestNobodyWrote} uses and
	 * for the same reason: swapping the waiting picture's digest for {@code NOBODY_WROTE}
	 * would otherwise leave this comparing one answer with itself, and every line would pass.
	 */
	@Test
	void aPictureWaitingForAModeratorIsAnsweredExactlyAsADigestNobodyWrote() throws Exception {
		String waitingName = WAITING.digest();
		String nobodyWroteName = NOBODY_WROTE;

		assertThat(waitingName)
				.as("the two names in this comparison are one name, so everything below is"
						+ " satisfied by an answer being equal to itself")
				.isNotEqualTo(nobodyWroteName);
		assertThat(db.sql("select count(*) from verification where photo_id ="
						+ " (select id from photo where digest = ?) and state = 'waiting'")
						.param(waitingName).query(Long.class).single())
				.as("no row in the queue holds this picture, so the refusal below is about"
						+ " something other than waiting for a moderator")
				.isEqualTo(1L);

		MockHttpServletResponse waiting = answerFor(waitingName);
		MockHttpServletResponse nobodyWroteIt = answerFor(nobodyWroteName);

		assertThat(waiting.getStatus())
				.as("a picture waiting for a moderator was answered something other than 404")
				.isEqualTo(404);
		assertThat(nobodyWroteIt.getStatus())
				.as("a digest belonging to no row was answered something other than 404")
				.isEqualTo(404);

		assertThat(waiting.getContentAsByteArray())
				.as("the two refusals do not carry the same body")
				.isEqualTo(nobodyWroteIt.getContentAsByteArray());
		assertThat(waiting.getContentType())
				.as("the two refusals do not carry the same type")
				.isEqualTo(nobodyWroteIt.getContentType());
		assertThat(waiting.getHeaderNames())
				.as("one refusal carries a header the other does not, which is the difference"
						+ " that says a picture is waiting to be looked at")
				.containsExactlyInAnyOrderElementsOf(nobodyWroteIt.getHeaderNames());
	}

	/**
	 * AND THE SCHEMA IS ASKED WHETHER THERE ARE STILL FOUR, WHICH IS THE FLOOR UNDER THE LIST
	 * ABOVE.
	 *
	 * <p><b>The list of holders is written by hand and this is what keeps it honest.</b> The
	 * portal cannot derive which holder is PUBLIC - that is a decision and it lives in a
	 * sentence - but it can derive which holders EXIST, and a fifth column pointing at
	 * {@code photo} is exactly the thing that would otherwise arrive unnoticed: whichever
	 * side it belongs on, {@link PhotoApi} would go on answering by the two it names, and
	 * nothing would say so. Asked of {@code pg_constraint}, so it is the database answering
	 * and not a reader of the migrations.
	 *
	 * <p><b>Compared exactly, both ways.</b> A column the schema has and this list does not
	 * fails, and so does a name here for a column that has gone - the second being how a list
	 * quietly stops describing anything.
	 *
	 * <p><b>What holds the OTHER half - that each of the four really behaves as it is called
	 * here - is not this case but {@link #whatHoldsAPictureDecidesWhetherItIsAnswered}</b>,
	 * which asks the route. A line here comparing this list with the text of
	 * {@link PhotoApi}'s query was written and thrown away: both refused holders share a
	 * column name with a published one ({@code photo_id} with {@code competitor},
	 * {@code logo_id} with {@code team}), so reading the query as text answered „public" for
	 * the queue. Behaviour has no such spelling.
	 */
	@Test
	void everyColumnPointingAtAPictureIsNamedHereAsPublicOrNot() {
		List<String> pointingAtAPicture = db.sql(
						"select c.conrelid::regclass::text || '.' || a.attname"
						+ " from pg_constraint c"
						+ " cross join lateral unnest(c.conkey) as k(attnum)"
						+ " join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum"
						+ " where c.contype = 'f' and c.confrelid = 'photo'::regclass"
						+ " order by 1")
				.query(String.class).list();

		assertThat(pointingAtAPicture)
				.as("nothing in the schema points at a picture at all, so the route has nothing"
						+ " to decide by and this floor is comparing two empty lists")
				.isNotEmpty();

		assertThat(pointingAtAPicture)
				.as("the schema has a column pointing at `photo` that nobody has decided about,"
						+ " or this file names one the schema no longer has. PhotoApi answers a"
						+ " picture only for the holders it calls public, so a fifth column"
						+ " arrives either as a picture silently withheld or as one silently"
						+ " published, and it has to be said out loud which")
				.containsExactlyInAnyOrderElementsOf(
						everyHolderThereIs().map(Held::holder).toList());

		/* AND THE LIST REALLY HOLDS BOTH ANSWERS, which is what keeps the case above from
		   being satisfied by a route that answers everything or one that answers nothing. */
		assertThat(everyHolderThereIs().map(Held::answered).distinct().toList())
				.as("every holder named here expects the same answer, so the case that walks"
						+ " them is asking one question four times")
				.containsExactlyInAnyOrder(200, 404);
	}

	/**
	 * A ROW WHOSE FILE IS GONE COSTS THE LOG ONE LINE AND NOT A STACK.
	 *
	 * <p><b>Measured over a real socket on 20.09.2026, and it was a finding rather than an
	 * untidiness.</b> The warning was written with the exception as its last argument, so
	 * every one of these answers printed some sixty frames of filter chain: fifty requests of
	 * about 190 bytes each made the server write 1.002.600 bytes, 20.052 per request. Three
	 * things make that a hole. Neither deploy stack sets a {@code logging:} block, so Docker
	 * keeps it all with no rotation; {@code frontend/nginx.conf} rate-limits signing in and
	 * registering and not this; and „the row is there and the file is not" is a state this
	 * portal EXPECTS, because {@code deploy/README.md} says QA is refreshed by throwing the
	 * volume away while the rows stay.
	 *
	 * <p><b>The logger is asked rather than the text read</b>, which is the difference
	 * between measuring the answer and measuring a spelling: logback keeps the throwable as
	 * its own field on the event, so „was an exception handed to this call" is a question the
	 * tool answers exactly. Putting {@code noFile} back as the last argument fills that field
	 * and this falls.
	 *
	 * <p>And the two things the message must still carry are asserted beside it, because a
	 * warning that named neither the picture nor the folder would be cheap and useless.
	 */
	@Test
	void aRowWhoseFileIsGoneCostsTheLogOneLineAndNotAStack() throws Exception {
		Logger speaking = (Logger) LoggerFactory.getLogger(PhotoApi.class);
		ListAppender<ILoggingEvent> heard = new ListAppender<>();

		heard.start();
		speaking.addAppender(heard);

		try {
			assertThat(answerFor(WITH_NO_FILE.digest()).getStatus())
					.as("this picture's file is on disk after all, so nothing was warned about"
							+ " and every line below would pass over an empty list")
					.isEqualTo(404);

			assertThat(heard.list)
					.as("a row whose file could not be read was answered and nothing was said to"
							+ " whoever runs the server, so the one place this fault exists no"
							+ " longer reports it")
					.hasSize(1);

			ILoggingEvent said = heard.list.get(0);

			assertThat(said.getThrowableProxy())
					.as("the exception was handed to the logger, so every one of these answers"
							+ " prints its whole stack - about twenty kilobytes for a request of"
							+ " under two hundred bytes, into a log nothing rotates")
					.isNull();
			assertThat(said.getFormattedMessage())
					.as("the warning names neither the picture nor the folder, which is what an"
							+ " operator needs and the only thing the stack was carrying that"
							+ " this line does not")
					.contains(WITH_NO_FILE.digest())
					.contains(FOLDER.toString());
		} finally {
			speaking.detachAppender(heard);
			heard.stop();
		}
	}

	/**
	 * WHO IS ASKING CHANGES NOTHING, WHICH IS WHAT „OPEN" MEANS HERE.
	 *
	 * <p>Both halves matter. A visitor must be answered, because a picture is drawn on pages
	 * anybody may read; and a member must be answered the SAME, because a resource that
	 * quietly served more to a session would be a second set of rules nobody wrote down. The
	 * two requests differ in exactly one thing - the cookie - and the answer is compared
	 * whole.
	 *
	 * <p><b>And the cookie is proved to be a live session before anything is compared.</b>
	 * Without that this case has a silent way of saying nothing: a session row written
	 * wrongly makes the second request an anonymous one carrying a string nobody knows, the
	 * two answers agree because they are the same request twice, and „a member is answered
	 * as a visitor" passes while never having had a member in it. So the same cookie is
	 * first sent at {@code /api/me}, which is shut to everybody who is not signed in - and
	 * the request this case calls a member's is asked whether it carries a cookie at all,
	 * which is the other half of the same hole: a case comparing two answers passes when one
	 * side quietly becomes the other, and neither the assertion below nor any answer would
	 * say so.
	 */
	@Test
	void whoIsAskingChangesNothing() throws Exception {
		MockHttpServletRequestBuilder asAVisitor = asking(WEBP.digest(), null);
		MockHttpServletRequestBuilder asAMember = asking(WEBP.digest(), A_MEMBER);

		/* ASKED OF THE VERY REQUESTS THAT ARE SENT, and not of a second pair built beside
		   them: a floor over `asking(digest, A_MEMBER)` written here would go on passing
		   while the line below sent the visitor's request twice. */
		assertThat(asAMember.buildRequest(new MockServletContext()).getCookies())
				.as("the request this case calls a member's carries no cookie, so both halves"
						+ " below are the same visitor asked twice")
				.isNotEmpty();
		assertThat(asAVisitor.buildRequest(new MockServletContext()).getCookies())
				.as("the request this case calls a visitor's carries a cookie, so both halves"
						+ " below are the same member asked twice")
				.isNullOrEmpty();

		assertThat(http.perform(get("/api/me")
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(A_MEMBER).secret())))
				.andReturn().getResponse().getStatus())
				.as("the cookie this case sends is not a session the server knows, so the two"
						+ " requests below are one request asked twice")
				.isNotEqualTo(401);

		MockHttpServletResponse toAVisitor = http.perform(asAVisitor).andReturn().getResponse();
		MockHttpServletResponse toAMember = http.perform(asAMember).andReturn().getResponse();

		assertThat(toAVisitor.getStatus())
				.as("a visitor was not answered a picture, and this route is open")
				.isEqualTo(200);
		assertThat(toAMember.getStatus())
				.as("a signed in member was answered something else than a visitor")
				.isEqualTo(toAVisitor.getStatus());
		assertThat(toAMember.getContentType())
				.as("a signed in member was answered another type than a visitor")
				.isEqualTo(toAVisitor.getContentType());
		assertThat(toAMember.getContentAsByteArray())
				.as("a signed in member was answered other bytes than a visitor")
				.isEqualTo(toAVisitor.getContentAsByteArray());
	}

	/**
	 * AND THE SAME READ WITHOUT A BODY IS ANSWERED TOO.
	 *
	 * <p>{@link ApiSecurity#READ_BY_ANYBODY_UNDER_A_NAME} grants {@code HEAD} beside
	 * {@code GET} deliberately, so this says what that grant is worth: a caller asking
	 * whether a picture is there gets the type and the cache rule and no bytes. Left out of
	 * the chain it would be a 401, which is the one answer that would say something a
	 * {@code GET} does not.
	 */
	@Test
	void theSameReadWithoutABodyIsAnsweredToo() throws Exception {
		MockHttpServletResponse answer = http.perform(head("/api/photos/{name}", PNG.digest()))
				.andReturn().getResponse();

		assertThat(answer.getStatus())
				.as("a HEAD of a picture that is there was refused")
				.isEqualTo(200);
		assertThat(answer.getContentType())
				.as("a HEAD does not carry the type the row gives its GET")
				.isEqualTo(PNG.mediaType());
	}

	/**
	 * A PICTURE MAY BE KEPT FOR A DAY, BY THE BROWSER THAT ASKED AND BY NOBODY IN BETWEEN.
	 *
	 * <p>The name is the digest of the content, so the bytes behind it are the same bytes
	 * for as long as the address exists - and that is the whole of what the old header rested
	 * on. Two things measured on 20.09.2026 say it was not enough, and both halves of this
	 * assertion are those two things.
	 *
	 * <ul>
	 * <li><b>It said {@code public}, and this is also the ONE answer in the portal that sets
	 * a cookie.</b> Everything else answers {@code no-store}; this one invited a shared cache
	 * to keep an answer that {@code csrf.spa()} has put {@code Set-Cookie: XSRF-TOKEN} on.
	 * The second line below is the one that says so: it does not demand the cookie and it
	 * does not forbid it, it asks that a cacheable answer carrying one may never be kept by
	 * anything but the browser it was sent to - so putting {@code public} back falls, and so
	 * does making this route cacheable by a shared cache some other way.
	 * <li><b>It said {@code immutable} for a year, and ADL A12a, 1 requires the file to be
	 * deleted after a moderator's decision.</b> A withdrawal reaches nothing that already
	 * holds a copy - the address is derived from the content, so there is no new address to
	 * move to - and {@code immutable} forbids the one request that could learn the picture
	 * has gone.
	 * </ul>
	 *
	 * <p><b>{@code nosniff} is here for a different reason and NOTHING IN {@link PhotoApi}
	 * PUTS IT THERE.</b> It rides on the same answer and it is what stops a browser working
	 * the type out from the bytes instead of reading it off the row (ADL A12a, 1). This
	 * class wrote it explicitly until a mutation measured that taking the line out changed
	 * no answer: Spring Security's own header writer sets it on everything the chain
	 * answers. So the line went and the assertion stayed, which is what „pinning" is for
	 * here - this route is the only one in the portal that answers with bytes somebody else
	 * chose, so it is the only place where that default going away would matter, and
	 * nothing else would go red.
	 */
	@Test
	void aPictureMayBeKeptForADayAndItsTypeMayNotBeGuessed() throws Exception {
		MockHttpServletResponse answer = answerFor(JPEG.digest());

		assertThat(answer.getHeader(HttpHeaders.CACHE_CONTROL))
				.as("the answer does not say a picture may be kept for a day, which is how long"
						+ " a withdrawn one may still be shown (ADL A12a, 1)")
				.contains("max-age=86400")
				.as("the answer lets a cache keep the address without ever asking again, so a"
						+ " picture a moderator refused goes on being drawn with nothing able to"
						+ " say otherwise")
				.doesNotContain("immutable");

		/* AND A CACHEABLE ANSWER CARRYING A COOKIE MAY NOT BE KEPT BY ANYTHING IN BETWEEN.
		   Asked of the answer itself rather than written as „this says private", because what
		   makes `public` wrong here is not a preference: this is the only answer in the
		   portal that is cacheable at all, `ApiSecurity.csrf.spa()` puts an XSRF-TOKEN cookie
		   on everything this chain answers, and an intermediary that kept such an answer
		   would hand one visitor's token to every later one. Measured 20.09.2026: the two
		   headers really do arrive together. The day the cookie stops riding on this answer,
		   the first line here goes false, this asks nothing, and whoever took it off may open
		   `public` again with that in front of them. */
		boolean handsOutACookie = answer.getHeader(HttpHeaders.SET_COOKIE) != null;

		assertThat(handsOutACookie)
				.as("this answer no longer carries a cookie, so the line below is asking about"
						+ " nothing - which is a change worth knowing about rather than one to"
						+ " pass over, because `public` was refused on exactly this ground")
				.isTrue();
		assertThat(answer.getHeader(HttpHeaders.CACHE_CONTROL))
				.as("an answer that sets a cookie is offered to shared caches, so one"
						+ " intermediary copy would hand a single XSRF-TOKEN to every visitor"
						+ " behind it and the double submit check would stop being a second"
						+ " guard")
				.contains("private")
				.doesNotContain("public");

		assertThat(answer.getHeader("X-Content-Type-Options"))
				.as("nothing stops a browser working out the type from the bytes, and the type"
						+ " this portal answers with is the one on the row")
				.isEqualTo("nosniff");
	}
}
