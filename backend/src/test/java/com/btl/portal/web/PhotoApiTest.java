package com.btl.portal.web;

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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
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

	/**
	 * The pictures, written in an order that is nobody's answer.
	 *
	 * <p>The three that are read are written PNG, WEBP, JPEG, so the row a case is about is
	 * never the first row, never the last, and never the only one of its kind. The row with
	 * no file is written between them rather than at the end, so „the last row written" is
	 * not a way of finding it either.
	 */
	@BeforeEach
	void sixPicturesAndOneNameThatNamesNone() {
		write(PNG, true);
		write(WITH_NO_FILE, false);
		write(WEBP, true);
		write(JPEG, true);

		/* The same digest twice: the elder carries the file, the younger does not. Written
		   in this order so that „the newest row" answers 404 and „the oldest" answers the
		   bytes, which is how the tie-break is readable at all. */
		write(TWICE_OVER, true);
		writeAnotherRowFor(TWICE_OVER);

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
	private void writeAnotherRowFor(Written picture) {
		db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values (?, ?, ?, ?, ?, ?)")
				.params(picture.mediaType(), picture.bytes().length, picture.digest(),
						new BigDecimal("0.10"), new BigDecimal("0.20"), new BigDecimal("0.30"))
				.update();
	}

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
		MockHttpServletResponse itsFileHasGone = answerFor(WITH_NO_FILE.digest());
		MockHttpServletResponse nobodyWroteIt = answerFor(NOBODY_WROTE);

		assertThat(WITH_NO_FILE.digest())
				.as("the two names in this comparison are one name, so everything below is"
						+ " satisfied by an answer being equal to itself")
				.isNotEqualTo(NOBODY_WROTE);

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
	 * <p>That is the whole strength of it. Written over a digest nobody wrote, „capitals are
	 * refused" and „that digest is not in the database" would be the same answer and the case
	 * would measure the second while claiming the first. Here the row is there, the file is
	 * there, and the only thing wrong is the spelling - so a server that accepted a capital
	 * letter answers a picture and this falls.
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

		MockHttpServletResponse answer = answerFor(TWICE_OVER.digest());

		assertThat(answer.getStatus())
				.as("a digest standing on two rows was not answered at all")
				.isEqualTo(200);
		assertThat(answer.getContentAsByteArray())
				.as("the younger row decided, and it has no file")
				.isEqualTo(TWICE_OVER.bytes());
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
	 * first sent at {@code /api/me}, which is shut to everybody who is not signed in.
	 */
	@Test
	void whoIsAskingChangesNothing() throws Exception {
		assertThat(http.perform(get("/api/me")
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(A_MEMBER).secret())))
				.andReturn().getResponse().getStatus())
				.as("the cookie this case sends is not a session the server knows, so the two"
						+ " requests below are one request asked twice")
				.isNotEqualTo(401);

		MockHttpServletResponse toAVisitor = http.perform(asking(WEBP.digest(), null))
				.andReturn().getResponse();
		MockHttpServletResponse toAMember = http.perform(asking(WEBP.digest(), A_MEMBER))
				.andReturn().getResponse();

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
	 * A PICTURE MAY BE KEPT FOR A YEAR, BECAUSE ITS ADDRESS CANNOT COME TO MEAN ANYTHING
	 * ELSE.
	 *
	 * <p>The name is the digest of the content, so the bytes behind it are the same bytes
	 * for as long as the address exists. The three parts are asked for separately because
	 * they say three things - how long, who may keep it, and that there is no point ever
	 * asking again - and a header that lost one of them would still carry the other two.
	 *
	 * <p>{@code nosniff} is here for a different reason and is asked for in the same case
	 * because it rides on the same answer: the type is decided by the row (ADL A12a, 1) and
	 * this is what stops a browser deciding it from the bytes instead.
	 */
	@Test
	void aPictureMayBeKeptForAYearAndItsTypeMayNotBeGuessed() throws Exception {
		MockHttpServletResponse answer = answerFor(JPEG.digest());

		assertThat(answer.getHeader(HttpHeaders.CACHE_CONTROL))
				.as("the answer does not say how long a picture may be kept")
				.contains("max-age=31536000")
				.as("the answer does not say a shared cache may keep it")
				.contains("public")
				.as("the answer does not say the address can never come to mean anything else")
				.contains("immutable");

		assertThat(answer.getHeader("X-Content-Type-Options"))
				.as("nothing stops a browser working out the type from the bytes, and the type"
						+ " this portal answers with is the one on the row")
				.isEqualTo("nosniff");
	}
}
