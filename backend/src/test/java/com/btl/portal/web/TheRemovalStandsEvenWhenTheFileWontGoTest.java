package com.btl.portal.web;

import ch.qos.logback.classic.Level;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * A PICTURE'S FILE THAT WILL NOT LEAVE THE DISK IS NEVER THE MEMBER'S ERROR: THE ROW AND THE
 * POINTER STILL GO, HE IS ANSWERED AS IF NOTHING WERE WRONG, AND THE FAULT GOES TO THE LOG.
 *
 * <p><b>NOT {@code @Transactional}, for the same reason {@code ThePictureAndItsFileAreOneThingTest}
 * gives for standing apart from {@code MePhotoApiTest}:</b> a test-managed transaction always
 * unwinds at the end of the case regardless of what the route decided inside it, so with
 * {@code rollbackFor} right and with it wrong the table looks the same when the case itself
 * never really commits anything. Only a real commit tells them apart, and this class exists so
 * one happens.
 *
 * <p><b>HERE THAT IS NOT A THEORY EITHER.</b> A security review on 25.09.2026 found
 * {@code MePhotoApi.remove} carrying {@code rollbackFor = IOException.class}, the same
 * attribute {@code send} needs, copied onto a method the owner's decision reads the opposite
 * way: PDL P28b, 3, 24.09.2026, „Brisanje slike stupa odmah, bez moderacije... Uklanjanje ne
 * moze da bude sporno." On {@code send} a rollback keeps that promise - a row survives only
 * with its file. On {@code remove} the SAME rollback breaks it: the row and the pointer that
 * were about to make the removal true are undone by nothing worse than a file that refused to
 * leave the disk, and the picture stays exactly as published as it was before the member asked.
 *
 * <p><b>WHAT THIS CLASS HELD WRONG UNTIL PDL P28e, AND WHAT IT HOLDS NOW.</b> The same day the
 * owner chose, among the outcomes offered and with my recommendation beside the one he took,
 * that a row which goes while its file cannot be deleted is answered NORMALLY and the fault
 * goes to the log (PDL P28e, 25.09.2026). Until then this class asserted the opposite half of
 * it: that the request THROWS, so a member whose picture had in fact come down was told it
 * had not. The commit was right and the answer was not, and the case that held the commit
 * also held the answer in place. So the class now holds three things, each by its own case: the
 * row and the pointer still go, the member is answered exactly as he is when the file leaves,
 * and the fault is in the log - which the second half of the decision asks for and which no
 * case beside this one measures, because the two precedents that swallow the same fault
 * ({@code CompetitorWriteApi} and {@code ATeamGoesWithItsLastMember}) are measured by
 * their status and their rows alone.
 *
 * <p><b>THE SECOND PLACE A PICTURE'S ROW GOES, AND THAT IS MY READING OF THE DECISION AND NOT
 * HIS WORD ABOUT IT.</b> Sending a picture while one waits overwrites the waiting one: its row is
 * deleted and so is its file ({@code MePhotoApi.send}). PDL P28e speaks of a removal, but the
 * condition it states - the row goes and the file cannot be deleted - is true of an overwrite
 * exactly as it is of a removal, and answering the member with an error for the file of a
 * picture he has just REPLACED is the same mistake one road over, and a costlier one: the
 * overwrite had already written the new file, so the error rolled the new row back and left
 * that file on the disk with nothing pointing at it. The owner said nothing about replacing; this
 * is derived from what he said about removing, it is marked as derived in the route and in the
 * pull request, and the cases for it stand beside the removal's so that it is one sentence
 * measured twice rather than two.
 *
 * <p><b>HOW THE DELETE IS MADE TO FAIL, with no line of production code knowing about this
 * case.</b> The picture's file is not a file at all but a directory with something inside it,
 * which is a property of a file system rather than of anything stubbed:
 * {@code Files.deleteIfExists} on a non-empty directory throws
 * {@link java.nio.file.DirectoryNotEmptyException}, a checked {@link IOException} and exactly
 * the class {@code rollbackFor} used to name. That the fault REALLY happened is no longer read
 * off a thrown exception, which does not leave the route any more: it is the exception the
 * log event carries, so a case that forced nothing fails on its own floor instead of passing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TheRemovalStandsEvenWhenTheFileWontGoTest {

	private static final String ME = "000901";

	private static final String MY_ADDRESS = "uklanjanje-i-fajl@primer.rs";

	/**
	 * A FOLDER OF THIS RUN'S OWN, for the reason {@code MePhotoApiTest} measured for its own: a
	 * folder shared with another run, or another worktree, could collide on the same name.
	 */
	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-removal-");
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

	private SecretToken session;

	/** Where the picture table stood before this case, so the clean up takes only what it wrote. */
	private long picturesBefore;

	/** The picture standing on this member's profile, made undeletable before each case. */
	private long photo;

	/** The member's own key, which {@link #photo} must NOT equal: see the arrangement. */
	private long member;

	/** The queue row a picture waits in, or zero in the cases where nothing waits. */
	private long theQueueRow;

	/** The picture that row holds, or zero where nothing waits. */
	private long theWaitingPhoto;

	@BeforeEach
	void oneMemberWithAPictureStandingBehindAFileThatCannotLeave() throws IOException {
		theQueueRow = 0;
		theWaitingPhoto = 0;
		picturesBefore = db.sql("select coalesce(max(id), 0) from photo").query(Long.class).single();

		member = db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Uklonjen', 'Uklonjenovic', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " '00000000000009fd', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00') returning id")
				.param(ME).query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Roditelj', 'Roditeljevic', ?,"
						+ " (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(MY_ADDRESS, ME).update();

		session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(MY_ADDRESS, session.hash(),
						Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		/* A PICTURE KEY AND A MEMBER KEY THAT ARE TWO DIFFERENT NUMBERS, which a fresh database
		   does not give by itself: both tables count from one, so the first member and his
		   first picture are both 1 and a log line naming the member where it should name the
		   picture would read exactly as the right one. A picture made and thrown away first
		   moves the picture sequence on by one before the real one is made, in every case, so
		   the picture's key runs ahead of the member's from the first case on. */
		long thrownAway = aPicture(0);

		db.sql("delete from photo where id = ?").param(thrownAway).update();

		photo = aPicture(1);

		db.sql("update competitor set photo_id = ? where member_number = ?")
				.params(photo, ME).update();

		assertThat(photo)
				.as("the picture's key and the member's key are the same number, so a log line"
						+ " that names the one where it should name the other cannot be told apart"
						+ " and the case measures nothing about it")
				.isNotEqualTo(member);

		blockTheFileOf(photo);
	}

	/**
	 * A NON-EMPTY DIRECTORY WHERE THE FILE SHOULD BE. {@code Files.deleteIfExists} refuses a
	 * directory that still holds something, which is a real filesystem property rather than a
	 * mock standing in for one.
	 */
	private static void blockTheFileOf(long picture) throws IOException {
		Path wherePictureShouldBe = PHOTOS.resolve(String.valueOf(picture));

		Files.createDirectory(wherePictureShouldBe);
		Files.writeString(wherePictureShouldBe.resolve("nemoguce-obrisati.txt"), "x");
	}

	/** One picture row, distinguished by the digest the schema keeps unique. */
	private long aPicture(int which) {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)"
						+ " returning id")
				.param(String.format("%064x", which + 1)).query(Long.class).single();
	}

	/**
	 * Everything this case wrote goes again, because nothing here is inside a transaction, and
	 * the folder is emptied of everything the route and the arrangement put in it - the files
	 * under their names and the directories that stood where files should have been.
	 */
	@AfterEach
	void takeBackWhatWasReallyCommitted() throws IOException {
		/* THE QUEUE ROW FIRST: it names the member and the waiting picture, and the picture
		   cannot go while it stands. */
		db.sql("delete from verification where competitor_id = ?").param(member).update();
		db.sql("delete from photo where id > ?").param(picturesBefore).update();
		db.sql("delete from account where email = ?").param(MY_ADDRESS).update();
		db.sql("delete from competitor where member_number = ?").param(ME).update();

		try (Stream<Path> everything = Files.walk(PHOTOS)) {
			for (Path one : everything.sorted(Comparator.reverseOrder()).toList()) {
				if (!one.equals(PHOTOS)) {
					Files.delete(one);
				}
			}
		}
	}

	/** A picture of his own in front of a moderator, which a removal must leave where it is. */
	private void aPictureWaits() {
		theWaitingPhoto = aPicture(2);

		theQueueRow = db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " photo_id, raised_at) values ('profiles', ?, 'Uklonjen Uklonjenovic', '',"
						+ " ?, ?) returning id")
				.params(member, theWaitingPhoto, Timestamp.from(Instant.parse("2026-09-01T10:00:00Z")))
				.query(Long.class).single();
	}

	/** What the request got back and everything the route said to the log while it ran. */
	private record Heard(MockHttpServletResponse answer, List<ILoggingEvent> events) {
	}

	@FunctionalInterface
	private interface Asking {
		MockHttpServletResponse go() throws Exception;
	}

	/**
	 * THE REQUEST, WITH THE ROUTE'S OWN LOGGER LISTENED TO.
	 *
	 * <p>The logger is asked rather than the text of a log file read, which is the difference
	 * {@code PhotoApiTest.aRowWhoseFileIsGoneCostsTheLogOneLineAndNotAStack} draws between
	 * measuring the answer and measuring a spelling: logback keeps the level, the message and
	 * the throwable as three fields of the event, so each is a question the tool answers
	 * exactly.
	 *
	 * @return the answer, which is a value and not a throw: since PDL P28e no exception leaves
	 *         the route for a file that would not go, so a request that still ends in one fails
	 *         the case at this line rather than being caught and described
	 */
	private Heard heardWhile(Asking asking) throws Exception {
		Logger speaking = (Logger) LoggerFactory.getLogger(MePhotoApi.class);
		ListAppender<ILoggingEvent> heard = new ListAppender<>();

		heard.start();
		speaking.addAppender(heard);

		try {
			return new Heard(asking.go(), List.copyOf(heard.list));
		}
		finally {
			speaking.detachAppender(heard);
			heard.stop();
		}
	}

	private Heard removingMyPicture() throws Exception {
		return heardWhile(() -> http.perform(delete("/api/me/photo").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse());
	}

	private Heard sendingANewPicture() throws Exception {
		return heardWhile(() -> http.perform(multipart("/api/me/photo").with(csrf())
						.file(new MockMultipartFile("picture", "portret.jpg",
								MediaType.IMAGE_JPEG_VALUE, aJpeg()))
						.param("cropX", "0.25").param("cropY", "0.75").param("cropSize", "0.5")
						.cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse());
	}

	private static byte[] aJpeg() {
		byte[] head = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };
		byte[] tail = "ostatak slike".getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[head.length + tail.length];

		System.arraycopy(head, 0, whole, 0, head.length);
		System.arraycopy(tail, 0, whole, head.length, tail.length);

		return whole;
	}

	/**
	 * THE ONE EVENT THE ROUTE MAY SAY FOR A FILE THAT WOULD NOT GO, asked the same way for the
	 * two places that can say it so that neither is measured more loosely than the other.
	 *
	 * <p>Four things are asked of it, each against its own mutation:
	 * <ul>
	 * <li>there is ONE, so a route that logged the fault and then also the „already gone" line,
	 * or logged it twice, is heard - and one that logged nothing, which is the fault swallowed
	 * in silence, is heard first;
	 * <li>it is at WARN or above, so the fault is not demoted to a level the server does not
	 * print;
	 * <li>it carries the key of the picture whose file stayed, and not the member's, nor the
	 * queue row's, nor the new picture's - they are different numbers by construction, see the
	 * arrangement - which is what an operator needs to find the stray file;
	 * <li>it carries the exception itself, of the class this case forces, which is both what
	 * tells the operator WHY the file stayed and the proof that the fault this case forces is
	 * the one that was logged.
	 * </ul>
	 *
	 * @param whose the picture whose file will not go
	 * @param when  what the member did, which the line must say, so that the two roads are not
	 *              told apart only by the member's key
	 */
	private static void theFaultIsInTheLogAsTheOnlyEvent(List<ILoggingEvent> heard, long whose,
			String when) {
		assertThat(heard)
				.as("the route said nothing, or more than one thing, to the log about a file that"
						+ " would not go - and nothing else was entitled to speak here, so a"
						+ " silence is the fault swallowed")
				.hasSize(1);

		ILoggingEvent said = heard.get(0);

		assertThat(said.getLevel().isGreaterOrEqual(Level.WARN))
				.as("the fault was logged at %s, a level the server does not print", said.getLevel())
				.isTrue();
		assertThat(said.getFormattedMessage())
				.as("the line does not name the picture whose file stayed, which is the one thing"
						+ " the operator needs to find it - or it names another key instead")
				.contains("could not be removed")
				.contains("photo " + whose + " ")
				.contains(when);
		assertThat(said.getThrowableProxy())
				.as("the fault carries no exception, so the log says that a file stayed and not why")
				.isNotNull();
		assertThat(said.getThrowableProxy().getClassName())
				.as("the exception in the log is not the one this case forced, so what it forced"
						+ " is not what it measured")
				.isEqualTo("java.nio.file.DirectoryNotEmptyException");
	}

	/**
	 * A REMOVAL THE OWNER CALLED IMMEDIATE STAYS IMMEDIATE EVEN WHEN THE FILE WILL NOT GO.
	 *
	 * <p><b>The mutation this is written against is one token:</b> putting
	 * {@code rollbackFor = IOException.class} back on {@code remove} while the fault still
	 * leaves it. The {@link java.nio.file.DirectoryNotEmptyException} this case forces then
	 * rolls the two statements above it back too, and a removal that was supposed to happen at
	 * once leaves the picture exactly as published as it was before the request. Written as a
	 * parameter over whether a picture waits as well, so the rows are asserted in both states
	 * of that axis and not in the one that happens to be easy to arrange.
	 */
	@ParameterizedTest
	@ValueSource(booleans = {false, true})
	void theRowAndThePointerStillGoWhenTheFileWillNot(boolean aPictureWaits) throws Exception {
		if (aPictureWaits) {
			aPictureWaits();
		}

		removingMyPicture();

		assertThat(db.sql("select photo_id from competitor where member_number = ?").param(ME)
						.query(Long.class).optional())
				.as("the pointer survived a removal the owner called immediate, so the member's"
						+ " old picture is still exactly as published as before the request")
				.isEmpty();

		assertThat(db.sql("select count(*) from photo where id = ?").param(photo)
						.query(Long.class).single())
				.as("the photo row survived a removal the owner called immediate")
				.isZero();
	}

	/**
	 * THE MEMBER IS ANSWERED EXACTLY AS HE IS WHEN THE FILE LEAVES, AND THE ANSWER STILL NAMES
	 * WHAT WAITS.
	 *
	 * <p>PDL P28e, 25.09.2026: the owner chose, among the outcomes offered, that he gets a
	 * normal answer. <b>Normal is the whole answer and not only its number</b>: this route's
	 * answer carries the key of the picture still in front of a moderator, which is how a
	 * screen says „your profile is empty but a picture of yours is waiting" instead of
	 * pretending the profile is empty for good, so a fix that caught the fault and then
	 * returned a bare 200 with that field left out would pass a case that read only the status.
	 * The second state of the parameter is what catches it: with a picture waiting, the answer
	 * must carry that row's key, which is a number no early return can have guessed.
	 *
	 * <p><b>The mutations:</b> the fault leaves the route again (a thrown exception is no
	 * answer at all, so the case fails on the line that makes the request); the route answers
	 * the fault with a status of its own; the route catches it and answers with the field
	 * empty.
	 */
	@ParameterizedTest
	@ValueSource(booleans = {false, true})
	void theMemberIsAnsweredAsHeIsWhenTheFileLeavesAndTheAnswerStillNamesWhatWaits(
			boolean aPictureWaits) throws Exception {
		if (aPictureWaits) {
			aPictureWaits();
		}

		MockHttpServletResponse answer = removingMyPicture().answer();

		assertThat(answer.getStatus())
				.as("the member was told something went wrong with a removal that had happened")
				.isEqualTo(200);

		JsonNode said = mapper.readTree(answer.getContentAsString());

		assertThat(said.path("waiting").isNull())
				.as("the answer names a waiting picture exactly where one does not wait, or"
						+ " leaves it out where one does")
				.isEqualTo(!aPictureWaits);

		if (aPictureWaits) {
			assertThat(said.path("waiting").asLong())
					.as("the answer does not name the picture that is still waiting, so the member"
							+ " is left believing his profile is empty for good")
					.isEqualTo(theQueueRow);
		}
	}

	/**
	 * AND THE FAULT IS IN THE LOG, WHICH IS THE OTHER HALF OF THE DECISION AND THE HALF A CASE
	 * OVER STATUS AND ROWS CANNOT SEE.
	 *
	 * <p><b>Measured rather than argued:</b> {@code CompetitorWriteApiTest} holds the same
	 * fault for a deleted member by its 204 and its rows, and replacing its
	 * {@code LOG.warn} by nothing leaves every one of its cases green, because nothing there
	 * reads the log. A removal that swallowed the fault in silence would be the one thing the
	 * decision does not allow: the member told all is well and the operator told nothing, with
	 * a directory sitting on the disk where a picture's file should have gone.
	 */
	@ParameterizedTest
	@ValueSource(booleans = {false, true})
	void theFaultIsInTheLogAndNamesThePictureAndCarriesItsCause(boolean aPictureWaits)
			throws Exception {
		if (aPictureWaits) {
			aPictureWaits();
		}

		theFaultIsInTheLogAsTheOnlyEvent(removingMyPicture().events(), photo, "took it down");
	}

	/**
	 * A PICTURE THAT IS REPLACED WHILE ITS FILE WILL NOT GO IS A SEND THAT SUCCEEDED, AND THE
	 * MEMBER IS ANSWERED AS ONE.
	 *
	 * <p>This is my reading of PDL P28e carried onto the overwrite and not the owner's word about
	 * replacing, and it is set out in the class note. <b>What the case holds, each half against
	 * its own mutation:</b>
	 * <ul>
	 * <li>the request is ANSWERED, 200, and the answer names the queue row that was repointed,
	 * which is the row the member already had - „the POINTER MOVES and the row does not" - and
	 * not a new one, so a route that failed the whole send and then opened a fresh row beside
	 * the old is heard;
	 * <li>the card now holds the NEW picture and the old picture's row is gone, so the replaced
	 * one is not merely hidden; and the new picture's bytes are on the disk under the new key,
	 * which is what makes the send a success rather than an acknowledgement of one - the
	 * overwrite writes the new file BEFORE it takes the old one away, and a rollback leaves that
	 * file behind with nothing pointing at it;
	 * <li>the log carries the OLD picture's key and the word „overwrote", so the line cannot be
	 * the removal's, and not the new picture's, the card's or the member's: the old picture's
	 * key is asserted to be neither of the last two, and the new one's cannot be the same as the
	 * old one's.
	 * </ul>
	 */
	@Test
	void aReplacedPicturesFileThatWillNotGoIsLoggedAndTheSendStands() throws Exception {
		aPictureWaits();
		blockTheFileOf(theWaitingPhoto);

		assertThat(theWaitingPhoto)
				.as("the replaced picture's key is the member's key or the card's, so a line that"
						+ " names either of them where it should name the picture reads as the right"
						+ " one and the case measures nothing about it")
				.isNotIn(member, theQueueRow);

		Heard sent = sendingANewPicture();

		assertThat(sent.answer().getStatus())
				.as("the member was told his send failed, though the picture he sent is stored")
				.isEqualTo(200);

		JsonNode said = mapper.readTree(sent.answer().getContentAsString());

		assertThat(said.path("waiting").asLong())
				.as("the answer names another queue row than the one that waited, so the send"
						+ " opened a second card beside the first instead of repointing it")
				.isEqualTo(theQueueRow);

		long nowHeld = db.sql("select photo_id from verification where id = ?").param(theQueueRow)
				.query(Long.class).single();

		assertThat(nowHeld)
				.as("the card still holds the picture that was replaced")
				.isNotEqualTo(theWaitingPhoto);
		assertThat(db.sql("select count(*) from photo where id = ?").param(theWaitingPhoto)
						.query(Long.class).single())
				.as("the replaced picture's row survived its replacement")
				.isZero();
		assertThat(Files.readAllBytes(PHOTOS.resolve(String.valueOf(nowHeld))))
				.as("the new picture's bytes are not on the disk under the key the card now holds")
				.isEqualTo(aJpeg());

		theFaultIsInTheLogAsTheOnlyEvent(sent.events(), theWaitingPhoto, "overwrote");
	}
}
