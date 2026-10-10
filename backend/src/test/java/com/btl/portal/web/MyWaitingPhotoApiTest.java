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
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
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
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE PICTURE A MEMBER HIMSELF IS WAITING ON, AND THE SIX WAYS OF BEING TOLD THERE IS NONE.
 *
 * <p><b>Owner, PDL 21b, 27.09.2026:</b> „Neka ta recenica stoji u segmentu da se salje slika.
 * Tako da ukoliko udjem da posaljem ponovo, vidim da je trenutno slika u statusu cekanja i tu
 * vidim trenutno azuriranu sliku sa krugom." What was measured before this address existed is
 * that the picture reached the screen only in the visit that SENT it: the bytes were in that
 * browser, and after a reload nothing answered them again.
 *
 * <p><b>WHAT THIS FILE MUST NOT LET SLIP, and it is the reason the route is a narrow one.</b>
 * ADL A60 of 20.09.2026 still stands word for word: a picture held only by something that waits
 * for a moderator „nije javna" and „odgovara tacno isto kao slika koje nema". So
 * {@link #onePictureAndTwoAddressesThatDisagreeAboutIt} measures the SAME picture at both
 * addresses and requires them to disagree - answered here, refused at {@code /api/photos}. Either
 * half alone can be made true by breaking the other, so both are in one case.
 *
 * <p><b>WHY THIS IS A FILE OF ITS OWN.</b> {@code MePhotoApiTest} is the file about the resource
 * {@code /api/me/photo}, and it is where {@link MePhotoApi#mine} is measured - the field that says
 * WHERE the bytes are. This file is about the bytes themselves, and it needs what that class has
 * never needed: files on a disk, decoys beside them, and a folder of its own.
 * {@code VerificationPhotoApiTest} is its twin for the moderator's address and this file copies
 * its discipline rather than reinventing it.
 *
 * <p><b>THE GUARD HERE IS THE SESSION AND NOTHING FINER, so the fixture is built out of people
 * whose pictures are NOT the caller's.</b> Four states have to be told apart and three of them
 * would pass a route that only asked „is this digest a waiting picture":
 *
 * <ul>
 * <li>{@link #MINE} is the caller's own, waiting.
 * <li>{@link #SOMEBODY_ELSES} is another member's, waiting in the same queue, and written FIRST -
 * so „the first waiting picture" is never the right answer.
 * <li>{@link #ON_MY_OWN_PROFILE} is the caller's and APPROVED, which this address must refuse
 * because it is served by the public one: a route that forgot the join to {@code verification}
 * would answer it.
 * <li>{@link #WITHOUT_ITS_FILE} is a FOURTH member's own, waiting, and its file is gone - the
 * state {@code deploy/README.md} produces every morning QA is refreshed. It is his and not the
 * caller's of the other three cases since V55: a member has one picture waiting at a time, and the
 * database refuses the second (the fixture used to give the caller two).
 * </ul>
 *
 * <p><b>AND A MODERATOR WHO HOLDS THE PROFILES QUEUE IS ASKED HERE TOO</b>, because this route and
 * {@code GET /api/verification/{id}/photo} are the two named exceptions to A60 and they must not
 * become one: he may see the picture at HIS address and is nobody at this one.
 *
 * <p><b>EVERY PICTURE KEEPS A DECOY IN THE FOLDER</b>, which is the twin file's discipline: beside
 * the file named after the row's {@code id} there is a second named after its DIGEST, holding
 * different bytes of the same length. Without it, „the path is built from the row" and „the path is
 * built from what the caller said" answer the same 200 - and here the caller says the digest, so
 * that is not a theoretical confusion but the obvious way to write the route wrongly.
 *
 * <p><b>AND NO TWO PICTURES SHARE A DIGEST, deliberately.</b> The digest is the content, so a
 * waiting picture carrying an approved picture's digest would be served by {@code /api/photos}
 * through the approved row, and the case above would pass while measuring the wrong row entirely.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MyWaitingPhotoApiTest {

	/** One picture as it was written: what it is, what is in it, and what it is called. */
	private record Written(String digest, String mediaType, byte[] bytes) {
	}

	/** THE ONE PDL 21b IS ABOUT: the caller's own, waiting for a moderator. */
	private static final Written MINE = new Written("a1".repeat(32), "image/jpeg",
			new byte[] {(byte) 0xFF, (byte) 0xD8, 'm', 'i', 'n', 'e'});

	/** Another member's, waiting in the SAME queue, and written into the table FIRST. */
	private static final Written SOMEBODY_ELSES = new Written("b2".repeat(32), "image/png",
			new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x00, 'h', 'i', 's'});

	/**
	 * The caller's own portrait, APPROVED and standing on his profile.
	 *
	 * <p>Refused here on purpose: it is public and {@code /api/photos} serves it, so this address
	 * answering it would be a second home for a picture that already has one. A route written
	 * without the join to {@code verification} would hand it over.
	 */
	private static final Written ON_MY_OWN_PROFILE = new Written("c3".repeat(32), "image/webp",
			new byte[] {'R', 'I', 'F', 'F', 0x00, 'o', 'n'});

	/**
	 * AND ONE OF A FOURTH MEMBER'S WHOSE ROW IS THERE AND WHOSE FILE IS NOT.
	 *
	 * <p>{@code deploy/README.md} says QA is refreshed by throwing the volume away while the rows
	 * stay, so every picture on the portal is one of these the morning after. Its decoy IS written,
	 * so a route resolving anything the caller said would find something to answer and the case
	 * about it would go green for the wrong reason.
	 */
	private static final Written WITHOUT_ITS_FILE = new Written("d4".repeat(32), "image/png",
			new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x00, 'g', 'o', 'n', 'e'});

	/** Whose picture {@link #MINE} is, and who asks in nearly every case here. */
	private static final String ME = "ja@primer.rs";

	/** Whose picture {@link #SOMEBODY_ELSES} is. */
	private static final String SOMEBODY_ELSE = "neko-drugi@primer.rs";

	/** Whose picture {@link #WITHOUT_ITS_FILE} is, and who asks in the one case about a lost file. */
	private static final String WHOSE_FILE_IS_GONE = "bez-fajla@primer.rs";

	/** Holds the profiles queue, so he may see these pictures at his OWN address and not here. */
	private static final String MAY_THE_PROFILES = "profili@primer.rs";

	/** An account with no member behind it at all, which V23 allows (owner, 14.09.2026). */
	private static final String RACES_FOR_NOBODY = "bez-takmicara@primer.rs";

	private static final Path FOLDER = aFolderOfItsOwn();

	@DynamicPropertySource
	static void whereThePicturesAre(DynamicPropertyRegistry settings) {
		settings.add("btl.photos.folder", FOLDER::toString);
	}

	private static Path aFolderOfItsOwn() {
		try {
			return Files.createTempDirectory("btl-my-waiting-photo-case");
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
	private final Map<String, Long> photos = new HashMap<>();

	private int issued;

	@BeforeEach
	void fourPeopleAndFourPictures() {
		member("000801", "Moja");
		member("000802", "Tudja");
		member("000803", "Moderator");
		member("000804", "Bez fajla");

		account(ME, "competitor", "000801");
		account(SOMEBODY_ELSE, "competitor", "000802");
		account(MAY_THE_PROFILES, "moderator", "000803");
		account(WHOSE_FILE_IS_GONE, "competitor", "000804");
		ticked(MAY_THE_PROFILES, "queue:profiles");

		accountWithNoMember(RACES_FOR_NOBODY);

		write(SOMEBODY_ELSES, WITH_ITS_FILE);
		write(MINE, WITH_ITS_FILE);
		write(ON_MY_OWN_PROFILE, WITH_ITS_FILE);
		write(WITHOUT_ITS_FILE, AND_ITS_FILE_IS_GONE);

		/* SOMEBODY ELSE'S IS WRITTEN FIRST, so „the first waiting picture in the queue" is never
		   the answer this route is meant to give. */
		waitingRow("000802", SOMEBODY_ELSES);
		waitingRow("000801", MINE);
		waitingRow("000804", WITHOUT_ITS_FILE);

		/* AND THE APPROVED ONE IS ON THE PROFILE RATHER THAN IN THE QUEUE, which is what an
		   approval leaves behind: `competitor.photo_id` set and the queue row's pointer emptied. */
		db.sql("update competitor set photo_id = ? where member_number = '000801'")
				.param(photos.get(ON_MY_OWN_PROFILE.digest())).update();
	}

	@AfterEach
	void theFolderIsLeftEmpty() throws IOException {
		try (Stream<Path> left = Files.list(FOLDER)) {
			for (Path file : left.toList()) {
				Files.deleteIfExists(file);
			}
		}
	}

	/**
	 * WHAT PDL 21b ASKED FOR: the member is given the bytes of his own waiting picture.
	 *
	 * <p><b>Four things are asserted and each would be wrong on its own.</b> The bytes say the file
	 * was read by the ROW'S key and not by the digest the caller handed over - the decoy is what
	 * makes that measurable. The type says it came off the row and was not guessed. The status says
	 * the address exists for him, which every refusal below denies. And the cache says a private
	 * day, which is argued on {@code PhotoApi.FOR_A_DAY_PRIVATELY} and is sound HERE for the reason
	 * it is not sound on the moderator's address: this one carries the digest, so an overwrite
	 * gives him a new address rather than new bytes behind an old one.
	 */
	@Test
	void theMemberIsGivenTheBytesOfHisOwnWaitingPicture() throws Exception {
		MockHttpServletResponse answer = asked(MINE.digest(), ME);

		assertThat(answer.getStatus())
				.as("the member was refused his own waiting picture, which is the state PDL 21b was"
						+ " written against: after a reload nothing answered it at all")
				.isEqualTo(200);
		assertThat(answer.getContentAsByteArray())
				.as("these are not the bytes of the file the ROW names. A file named after the"
						+ " digest sits in the same folder holding the same number of different"
						+ " bytes, which is what a server resolving what the caller said would"
						+ " answer - and here the caller says the digest")
				.isEqualTo(MINE.bytes());
		assertThat(answer.getContentType())
				.as("the type was not taken off the row, so a picture is being served under a type"
						+ " somebody guessed")
				.isEqualTo(MINE.mediaType());
		assertThat(answer.getHeader(HttpHeaders.CACHE_CONTROL))
				.as("the term is not a private day. This address carries the digest, so the bytes"
						+ " behind it cannot change and the argument for a day holds; shared, an"
						+ " intermediary would hand one caller's answer to another")
				.isEqualTo("max-age=86400, private");
	}

	/**
	 * ONE PICTURE, TWO ADDRESSES, AND THEY MUST DISAGREE - WHICH IS THE WHOLE OF ADL A60.
	 *
	 * <p>The decision of 20.09.2026 stands: a picture only a queue row holds „odgovara tacno isto
	 * kao slika koje nema". The second amendment of 27.09.2026 narrows it to one more named
	 * exception and does not overturn it, and A60 says so in as many words: „Dve uske rute, svaka
	 * sa svojim pravom, nisu isto sto i treca grana u javnoj ruti."
	 *
	 * <p><b>The public address is asked BY THE MEMBER HIMSELF</b>, which is the harder of the two
	 * questions: he is exactly the caller somebody would be tempted to let through there, and
	 * letting him would make the picture public to anybody the digest reached - the digest being
	 * the whole permission on that route, as its own note says.
	 */
	@Test
	void onePictureAndTwoAddressesThatDisagreeAboutIt() throws Exception {
		assertThat(asked(MINE.digest(), ME).getStatus())
				.as("his own address does not answer the picture, so the half of this case that"
						+ " proves the other half is a refusal of everything")
				.isEqualTo(200);

		MockHttpServletResponse byItsDigest = http
				.perform(get("/api/photos/{name}", MINE.digest())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(ME).secret())))
				.andReturn().getResponse();

		assertThat(byItsDigest.getStatus())
				.as("a picture only a queue row holds was served by the PUBLIC address. ADL A60:"
						+ " „javan nosilac" + '"' + " means exactly competitor.photo_id and"
						+ " team.logo_id, and the address is derived from the content so it cannot"
						+ " be revoked")
				.isEqualTo(404);
	}

	/**
	 * AND EVERY WAY OF IT NOT BEING HIS WAITING PICTURE IS ONE ANSWER, TOLD APART FROM NOTHING.
	 *
	 * <p>Five states, one answer, and they arrive by three different roads inside the route: a
	 * digest of the wrong shape is refused before the database is asked at all; a digest that names
	 * a picture no row of his is waiting on finds no row; and a caller whose account has no member
	 * finds none either. Each is compared WHOLE against a digest nobody wrote - status, type and
	 * body - because a status that matched while the body did not would still be an oracle
	 * (measured 13.09.2026).
	 *
	 * <p><b>The row that matters most is the third:</b> {@link #ON_MY_OWN_PROFILE} is the caller's
	 * own picture and he is perfectly entitled to see it - at {@code /api/photos}, which serves it.
	 * Answered HERE it would mean this route had stopped asking whether a queue row is waiting on
	 * the picture, which is the condition that keeps it narrow.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "somebody else's waiting picture", "his own approved portrait",
			"a digest nobody wrote", "a digest spelt in capitals", "a name of the wrong shape" })
	void whatIsNotHisWaitingPictureIsAnsweredExactlyAsADigestNobodyWrote(String what)
			throws Exception {

		String nothing = whatCameBack(asked("f0".repeat(32), ME));

		MockHttpServletResponse refused = asked(switch (what) {
			case "somebody else's waiting picture" -> SOMEBODY_ELSES.digest();
			case "his own approved portrait" -> ON_MY_OWN_PROFILE.digest();
			case "a digest nobody wrote" -> "f1".repeat(32);
			case "a digest spelt in capitals" -> MINE.digest().toUpperCase(java.util.Locale.ROOT);
			default -> "ovo-nije-otisak";
		}, ME);

		assertThat(refused.getStatus())
				.as("%s was not answered 404", what)
				.isEqualTo(404);
		assertThat(whatCameBack(refused))
				.as("%s is told apart from a digest nobody wrote, so the difference between two"
						+ " answers says something the caller was not to be told", what)
				.isEqualTo(nothing);
	}

	/**
	 * AND AN ACCOUNT THAT RACES FOR NOBODY IS ANSWERED NOTHING, ASKING FOR A REAL PICTURE.
	 *
	 * <p>V23 lets an account exist with no member behind it (owner, 14.09.2026), and the route asks
	 * about the ACCOUNT rather than about the member for the reason {@code PhotoApi.photo} writes
	 * out: a route that asked {@code MemberOfAccount} first would answer nothing for a caller who
	 * is perfectly well signed in. Here that outcome is right rather than wrong - an account with no
	 * member has no picture waiting - and this case is what says the road out is the same one.
	 */
	@Test
	void anAccountThatRacesForNobodyIsAnsweredNothing() throws Exception {
		MockHttpServletResponse refused = asked(MINE.digest(), RACES_FOR_NOBODY);

		assertThat(refused.getStatus()).isEqualTo(404);
		assertThat(whatCameBack(refused))
				.isEqualTo(whatCameBack(asked("f2".repeat(32), RACES_FOR_NOBODY)));
	}

	/**
	 * AND THE MODERATOR OF THAT QUEUE IS NOBODY AT THIS ADDRESS, THOUGH HE MAY SEE THE PICTURE.
	 *
	 * <p><b>This is the case that keeps the two named exceptions from becoming one.</b> ADL A60
	 * grants two narrow routes, each with its own right: the moderator's is keyed to a
	 * {@code verification.id} and shut by a right over that queue, and this one is keyed to the
	 * caller's own session. A route that answered „any signed in caller who may moderate profiles"
	 * would pass every other case in this file and would be a third branch in the public rule
	 * wearing a narrow route's clothes.
	 *
	 * <p>Both halves are asserted, because the first alone would pass against a route that refused
	 * everybody: he is refused HERE and served at his own address.
	 */
	@Test
	void theModeratorOfTheQueueIsNobodyAtThisAddressAlthoughHeMaySeeThePicture() throws Exception {
		assertThat(asked(MINE.digest(), MAY_THE_PROFILES).getStatus())
				.as("the moderator was served a picture at an address whose whole guard is that the"
						+ " picture is the CALLER'S OWN, so the two named exceptions of ADL A60 have"
						+ " become one wide one")
				.isEqualTo(404);

		assertThat(http.perform(get("/api/verification/{id}/photo", theRowWaitingOn(MINE))
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(MAY_THE_PROFILES).secret())))
				.andReturn().getResponse().getStatus())
				.as("he cannot see it at his own address either, so the refusal above is a refusal"
						+ " of everything rather than a rule about whose picture it is")
				.isEqualTo(200);
	}

	/**
	 * A ROW WHOSE FILE IS GONE IS ANSWERED AS NOTHING, AND THIS ONE DOES SPEAK TO THE OPERATOR.
	 *
	 * <p>The mirror of every silent refusal above, and the pair is the point. Having no picture to
	 * show is an ordinary state and says nothing; a row that NAMES a picture whose file cannot be
	 * read is a backup that did not cover the volume (ADL A43, 2), and that is worth a line. The
	 * caller is told what a caller of a digest nobody wrote is told, so a row and its absence cannot
	 * be told apart from outside.
	 */
	@Test
	void aRowWhoseFileIsGoneIsAnsweredAsNothingAndIsReportedOnce() throws Exception {
		Logger speaking = (Logger) LoggerFactory.getLogger(PhotoApi.class);
		ListAppender<ILoggingEvent> heard = new ListAppender<>();

		heard.start();
		speaking.addAppender(heard);

		try {
			MockHttpServletResponse answer = asked(WITHOUT_ITS_FILE.digest(), WHOSE_FILE_IS_GONE);

			assertThat(answer.getStatus())
					.as("a row naming a picture whose file cannot be read was not answered 404, so"
							+ " a missing file has become a sentence about the database")
					.isEqualTo(404);
			assertThat(whatCameBack(answer))
					.as("a row whose file is gone is told apart from a digest nobody wrote")
					.isEqualTo(whatCameBack(asked("f3".repeat(32), WHOSE_FILE_IS_GONE)));

			assertThat(heard.list)
					.as("nothing was said to whoever runs the server about a row that names a file"
							+ " which is not there, so a lost volume looks like an empty queue")
					.hasSize(1);

			ILoggingEvent said = heard.list.get(0);

			assertThat(said.getThrowableProxy())
					.as("the exception was handed to the logger, so every one of these answers"
							+ " prints its whole stack into a log nothing rotates")
					.isNull();
			assertThat(said.getFormattedMessage())
					.as("the line names neither the picture nor the folder, which is what an"
							+ " operator needs")
					.contains(String.valueOf(photos.get(WITHOUT_ITS_FILE.digest())))
					.contains(FOLDER.toString());
		} finally {
			speaking.detachAppender(heard);
			heard.stop();
		}
	}

	/**
	 * AND NOBODY WHO IS NOT SIGNED IN GETS AS FAR AS THE ROUTE.
	 *
	 * <p>The 401 is the chain's and not this route's: the address is on no open list, so
	 * {@code anyRequest().authenticated()} answers it, and
	 * {@code ApiSecurityTest.everyRouteNobodyOpenedIsARouteNobodyCanRead} derives that from the
	 * dispatcher and therefore covers this route by existing. It is asserted here because the
	 * number is the one thing about this address a reader of ADL A8 will want to find in the file
	 * about the address, and because it is what falls if somebody ever opens the route by name -
	 * which for THIS route would publish every waiting picture on the portal to anybody holding a
	 * digest.
	 */
	@Test
	void withoutASessionItIsFourHundredAndOneAndNotFourHundredAndFour() throws Exception {
		assertThat(http.perform(get("/api/me/photo/{digest}", MINE.digest()))
						.andReturn().getResponse().getStatus())
				.as("an unauthenticated caller was not answered 401, so either the address has been"
						+ " opened by name or the route is deciding something the chain decides"
						+ " first (ADL A8: neprijavljen dobija 401)")
				.isEqualTo(401);
	}

	/**
	 * THE FOLDER HOLDS BOTH THE FILE AND ITS DECOY, which is what every assertion about bytes here
	 * rests on.
	 *
	 * <p>Written as a case rather than trusted: a fixture that quietly stopped writing the decoy
	 * would leave every assertion about bytes passing while measuring nothing, because „read by the
	 * row's key" and „read by the digest the caller sent" would land on the same file.
	 *
	 * <p><b>And ONE picture has only its decoy</b>, which is named here rather than left looking
	 * like a gap: {@link #WITHOUT_ITS_FILE} is the row whose file is gone, and its decoy is present
	 * on purpose, so a route that resolved the address would find that file and answer 200 while
	 * the case about a missing file passed for the opposite reason.
	 */
	@Test
	void everyPictureHasItsDecoyAndOnlyOneOfThemHasLostItsFile() throws Exception {
		List<String> expected = new ArrayList<>();

		for (Written picture : List.of(MINE, SOMEBODY_ELSES, ON_MY_OWN_PROFILE, WITHOUT_ITS_FILE)) {
			expected.add(picture.digest());
		}

		for (Written picture : List.of(MINE, SOMEBODY_ELSES, ON_MY_OWN_PROFILE)) {
			expected.add(String.valueOf(photos.get(picture.digest())));
		}

		try (Stream<Path> there = Files.list(FOLDER)) {
			assertThat(there.map(one -> one.getFileName().toString())
					.sorted(Comparator.naturalOrder()).toList())
					.as("the folder does not hold a decoy for every picture, a real file for the"
							+ " three that have one, and NOTHING named after the row whose file is"
							+ " gone - so either the assertions about which bytes came back are"
							+ " measuring a folder nobody set up, or the missing file is not missing")
					.containsExactlyInAnyOrderElementsOf(expected);
		}
	}

	private MockHttpServletResponse asked(String digest, String who) throws Exception {
		return http.perform(get("/api/me/photo/{digest}", digest)
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(who).secret())))
				.andReturn().getResponse();
	}

	/**
	 * The status, the body and the type together, which is what „exactly the same" has to mean.
	 *
	 * <p>The status alone was measured on 13.09.2026 to be the weaker half: two answers carrying
	 * one number and nothing else alike are still an oracle.
	 */
	private static String whatCameBack(MockHttpServletResponse answer) throws Exception {
		return answer.getStatus() + "|" + answer.getContentType() + "|"
				+ answer.getContentAsString();
	}

	private long theRowWaitingOn(Written picture) {
		return db.sql("select id from verification where photo_id = ?")
				.param(photos.get(picture.digest())).query(Long.class).single();
	}

	/** What {@link #write} does about the file, named so the call sites read as sentences. */
	private static final boolean WITH_ITS_FILE = true;

	private static final boolean AND_ITS_FILE_IS_GONE = false;

	private void write(Written picture, boolean withItsFile) {
		long id = db
				.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values (?, ?, ?, 0.25, 0.75, 0.40) returning id")
				.params(picture.mediaType(), picture.bytes().length, picture.digest())
				.query(Long.class).single();

		photos.put(picture.digest(), id);

		if (withItsFile) {
			onDisk(String.valueOf(id), picture.bytes());
		}

		/* THE DECOY. A file named after the DIGEST, which is the one string a server building its
		   path out of what the caller said would land on - and on this route the caller says
		   exactly that. Its bytes are this picture's read backwards, so they are the same length: a
		   case that fell on the length alone would not be saying which file was served. */
		onDisk(picture.digest(), backwards(picture.bytes()));
	}

	private void waitingRow(String number, Written picture) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, state)"
						+ " values ('profiles', (select id from competitor where member_number = ?),"
						+ " 'Nova slika', '', ?, 'waiting')")
				.params(number, photos.get(picture.digest()))
				.update();
	}

	private void member(String number, String first) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, 'Prezime', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, String.format("%016x", ++issued))
				.update();
	}

	private void account(String email, String role, String member) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, role, member).update();

		openSession(email);
	}

	private void accountWithNoMember(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Ime',"
						+ " 'Prezime', ?, (select id from role where code = 'competitor'))")
				.param(email).update();

		openSession(email);
	}

	private void openSession(String email) {
		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private void ticked(String email, String... rights) {
		for (String right : rights) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, right).update();
		}
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
}
