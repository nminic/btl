package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A {@code photo} ROW GOES WITH ITS LAST HOLDER, WHICHEVER DOOR TOOK THE HOLDER AWAY.
 *
 * <p><b>WHAT THE FIRST THIRTEEN CASES HOLD IS AN OUTCOME AND NOT A MECHANISM.</b> Every case does
 * one thing to the portal through the door a person would use, lets it commit, and then asks the
 * database one question: is there still a {@code photo} row that no column points at? A column that
 * may point at a picture is {@code competitor.photo_id}, {@code verification.photo_id},
 * {@code team.logo_id} and {@code team_proposal.logo_id} (V8, V9, V11), and {@link PhotoApi} serves
 * a picture only through the first and the third (ADL A60). Until V54 a row that none of the four
 * held was a row nothing would ever read and nothing deleted: {@link ThePicturesFolderIsSwept}
 * reads FILES and never rows, and a file whose row stands is a file it keeps. Since V54 the
 * database deletes it (ADL A68, 03.10.2026, „Na kraju svake transakcije baza brise zapis slike koji
 * vise ne drzi nijedna od cetiri kolone"), and these cases say the doors see to it.
 *
 * <p><b>THE THREE DOORS THESE CASES REACH</b>, each of which left the row of a picture with
 * nobody pointing at it, until V54:
 *
 * <ul>
 * <li><b>A member is deleted</b> ({@link CompetitorWriteApi#remove}). The route reads the picture
 * standing on his profile and deletes its file, and a picture of his that WAITS in the queue
 * stands in a {@code verification} row that goes with him by {@code verification_competitor_fk}
 * ({@code on delete cascade}, V9), which empties no pointer and deletes no {@code photo} row.
 * <li><b>A moderator refuses a picture</b> ({@link VerificationWriteApi}). The decision empties
 * {@code verification.photo_id}, which {@code verification_decided_keeps_no_photo} (V9) requires,
 * and a refused picture is not moved onto anybody.
 * <li><b>A moderator approves a picture over one that already stands.</b> The new picture is
 * written onto {@code competitor.photo_id}, and the portrait it replaces loses its only holder.
 * </ul>
 *
 * <p><b>WHICH SENTENCES THIS READS, AND WHICH PART OF EACH IS THE OWNER'S.</b> PDL P21: „Ako je
 * član predmet slike (portret, slika potpisana njegovim imenom), slika se uklanja." That a picture
 * still WAITING for a moderator is the member's portrait for this sentence, and that a replaced
 * portrait is „removed" by the replacement, are MY readings of it and not the owner's words about
 * either. PDL P23 („obrisan zauvek sa svim svojim profilom") is the owner's for the member who goes.
 * ADL A66, reading 2, which says that a row nobody holds keeps its file, was itself a reading by
 * the author of the sweep and not a decision; what is left of it is that the file of a row that
 * is gone is the sweep's.
 *
 * <p><b>THE FILE IS HERE ONLY IN THE LAST CASES.</b> The sweep ({@link ThePicturesFolderIsSwept})
 * deletes a file that no row names once it is older than ten minutes (the owner's choice of
 * 02.10.2026), so the first thirteen write no file at all. {@link
 * #theFileOfAPictureThatWentIsSweptAndTheFileOfOneThatStaysIsKept} is the joint between the two
 * halves of ADL A68, the row that the database takes and the file that the sweep takes: a picture
 * is sent through the real route, a door takes it away, and the sweep is run over the file the
 * route wrote. Nothing else asks whether the file the writer names is the file the sweep reads.
 *
 * <p><b>TWO KINDS OF CASE, TOLD APART BY WHAT THEY DID BEFORE V54.</b> The cases that say a row
 * GOES failed on a portal that left it (four of the first thirteen). The cases that say a row
 * STAYS - another member's pictures, a portrait the refused picture is also standing as, a
 * picture a second holder still points at - passed on a portal that deleted nothing, and are here
 * for the day a fix is wider than it should be: the fix that answers „delete every picture of the
 * member", or „delete the picture this row held" without asking whether anything else holds it,
 * is the one they fail. <b>A picture with TWO holders is a state the schema allows</b> (none of
 * the four columns is unique, V8, V9, V11) <b>and no door writes</b>: a decided row cannot hold
 * one (V9), so it exists only while the queue row WAITS, and these cases build it by hand. „Delete
 * every picture nobody holds right now" is NOT held here, because no case leaves a picture that
 * nobody ever held in the way; {@code APhotoNobodyHoldsGoesTest} holds it.
 *
 * <p><b>NOT {@code @Transactional}</b>, for the reason {@link ThePictureAndItsFileAreOneThingTest}
 * and {@link TheRemovalStandsEvenWhenTheFileWontGoTest} give: a test-managed transaction is rolled
 * back at the end of the case, so anything that happens when a transaction COMMITS - and this
 * question is about what is left AFTER one has - would never be seen. What each case wrote is
 * taken away again in {@link #takeBackWhatWasReallyCommitted}.
 *
 * <p><b>THE LAST CASE IS ABOUT TWO TRANSACTIONS</b> and cannot be asked of one: one lets go of a
 * picture while another writes it onto a holder. See {@link
 * #aPictureAnotherTransactionIsWritingOntoAHolderIsNotTakenAwayFromUnderIt}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class APictureGoesWithItsLastHolderTest {

	/** The member the door acts on. */
	private static final String HIS = "000931";

	/** A member nothing may happen to, who stands and waits with pictures of his own. */
	private static final String ANOTHER = "000932";

	private static final String THE_MODERATOR = "slika-bez-nosioca@primer.rs";

	private static final String THE_REASON = "Slika je mutna.";

	/**
	 * A FOLDER OF THIS RUN'S OWN, for the reason {@code MePhotoApiTest} measured for its own. The
	 * first thirteen cases write nothing into it, and the route that deletes a standing portrait asks
	 * the folder for a file and says it was already gone. The joint with the sweep writes real files
	 * into it and the sweep reads this same folder, so what it finds is what this run put there and
	 * nothing of anybody else's; {@link #takeBackWhatWasReallyCommitted} empties it again.
	 */
	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-last-holder-");
		}
		catch (IOException noFolder) {
			throw new IllegalStateException("no temporary folder to keep pictures in", noFolder);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	@AfterAll
	static void theFolderGoesToo() throws IOException {
		Files.deleteIfExists(PHOTOS);
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/** The sweep itself, so that a case runs it when it wants to and not an hour after the start. */
	@Autowired
	private ThePicturesFolderIsSwept sweeping;

	/**
	 * A transaction this thread holds open while another connection does something, the way
	 * {@code VerificationDecisionConcurrencyTest} holds a row.
	 */
	@Autowired
	private TransactionTemplate holdingOpenATransaction;

	private SecretToken session;

	/** The accounts of the members a case let sign in, which go before the members do. */
	private final List<String> accounts = new ArrayList<>();

	/** Where the picture table stood before this case, so the clean up takes only what it wrote. */
	private long picturesBefore;

	private long digests;

	private long his;

	private long another;

	/**
	 * THE KEYS OF THE PICTURES ARE NOT THE KEYS OF THE ROWS THAT HOLD THEM. A fresh database hands
	 * every {@code bigserial} the number one, so the first picture and the first member and the first
	 * queue row would all be 1, and a trigger that let go of the holder's own {@code id} instead of
	 * its pointer would pass. The sequence is moved on before each case; it is not rolled back by
	 * anything, so it only ever moves on.
	 */
	@BeforeEach
	void aModeratorWhoMayDecideAndDeleteAndTwoMembersWithNothingYet() {
		db.sql("select setval(pg_get_serial_sequence('photo', 'id'),"
						+ " nextval(pg_get_serial_sequence('photo', 'id')) + 1000)")
				.query(Long.class).single();

		picturesBefore = db.sql("select coalesce(max(id), 0) from photo").query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Slike', ?, (select id from role where code = 'moderator'))")
				.param(THE_MODERATOR).update();

		for (String right : List.of("queue:profiles", CompetitorApi.OVER_THE_MEMBERS)) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(THE_MODERATOR, right).update();
		}

		session = SecretToken.fresh();

		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(THE_MODERATOR, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		his = aMember(HIS, "00000000000b2061");
		another = aMember(ANOTHER, "00000000000b2062");
	}

	/**
	 * Everything a case wrote goes again, because nothing here is inside a transaction. The queue
	 * rows go first: they name the member and the picture, and the picture cannot go while one
	 * points at it without emptying that pointer on the way. The accounts of the members a case let
	 * sign in go before the members, because {@code account_competitor_fk} is {@code on delete
	 * restrict} (V23), and the files the joint with the sweep wrote go last, so that the folder is
	 * empty when it is taken away.
	 */
	@AfterEach
	void takeBackWhatWasReallyCommitted() throws IOException {
		db.sql("delete from verification where competitor_id in"
						+ " (select id from competitor where member_number in (?, ?))")
				.params(HIS, ANOTHER).update();

		for (String email : accounts) {
			db.sql("delete from account where email = ?").param(email).update();
		}

		db.sql("delete from photo where id > ?").param(picturesBefore).update();
		db.sql("delete from competitor where member_number in (?, ?)").params(HIS, ANOTHER).update();
		db.sql("delete from account where email = ?").param(THE_MODERATOR).update();

		try (Stream<Path> everything = Files.walk(PHOTOS)) {
			for (Path one : everything.sorted(Comparator.reverseOrder()).toList()) {
				if (!one.equals(PHOTOS)) {
					Files.delete(one);
				}
			}
		}
	}

	// ---------------------------------------------------------------- a member is deleted

	/**
	 * EVERY PICTURE OF A MEMBER GOES WITH HIM: THE ONE ON HIS PROFILE AND THE ONE IN THE QUEUE.
	 *
	 * <p>Over the four states of the member - nothing, a portrait, a picture waiting, both - because
	 * the route reads and deletes the portrait and does nothing for a picture that waits, so a case
	 * over the portrait alone passes on the code as it is. <b>Another member stands and waits with a
	 * picture each throughout</b>, so „every picture there is" is not what the row is asked to
	 * be, and what is read AFTER them is that his pictures are still there.
	 *
	 * <p>Measured on 02.10.2026 against 6ab38139: the two states with a picture waiting fail on the
	 * first assertion, the two without pass.
	 */
	@ParameterizedTest(name = "standing: {0}, waiting: {1}")
	@CsvSource({"false,false", "true,false", "false,true", "true,true"})
	void everyPictureOfAMemberGoesWithHim(boolean standing, boolean waiting) throws Exception {
		List<Long> hisPictures = new ArrayList<>();

		if (standing) {
			hisPictures.add(standingOn(his));
		}

		if (waiting) {
			hisPictures.add(waitingFor(his).picture());
		}

		long anothersStanding = standingOn(another);
		long anothersWaiting = waitingFor(another).picture();

		assertThat(deletingTheMember(HIS).getStatus())
				.as("the member was not deleted, so this case measures nothing about his pictures")
				.isEqualTo(204);

		assertThat(hisPictures.stream().filter(this::theRowStands).toList())
				.as("a photo row of the member who was deleted is still there, and no column of any"
						+ " table points at it")
				.isEmpty();

		assertThat(theRowStands(anothersStanding) && theRowStands(anothersWaiting))
				.as("a picture of a member nobody touched went with the one who was deleted")
				.isTrue();
		assertThat(standingPicturesOf(ANOTHER)).containsExactly(anothersStanding);
		assertThat(waitingPicturesOf(another)).containsExactly(anothersWaiting);
	}

	/**
	 * A PICTURE THAT WAITS FOR HIM AND THAT SOMEBODY ELSE STANDS ON OUTLIVES HIM.
	 *
	 * <p>Two holders of one row, which no door writes and the schema allows: his queue row goes with
	 * him by cascade and the other member still points at the picture. A fix that deleted „the
	 * pictures his queue rows held" without asking whether anything else holds them would take
	 * the other member's portrait away from under him, through
	 * {@code competitor_photo_fk}'s {@code on delete set null}.
	 */
	@Test
	void aWaitingPictureAnotherMemberStandsOnOutlivesTheMemberItWaitedFor() throws Exception {
		long shared = aPicture();

		waitingWith(his, shared);
		standingOn(another, shared);

		assertThat(deletingTheMember(HIS).getStatus())
				.as("the member was not deleted, so this case measures nothing")
				.isEqualTo(204);

		assertThat(theRowStands(shared))
				.as("the row went with the member whose queue row held it, though another member"
						+ " still stands on it")
				.isTrue();
		assertThat(standingPicturesOf(ANOTHER))
				.as("the other member lost the portrait he stands on")
				.containsExactly(shared);
	}

	// ---------------------------------------------------------------- a moderator refuses

	/**
	 * A REFUSED PICTURE'S ROW GOES WITH ITS REFUSAL.
	 *
	 * <p>The member has a portrait standing and a picture waiting, so the row that has to go is the
	 * waiting one and the other is the one it must not be mistaken for. Measured on 02.10.2026
	 * against 6ab38139: the row survives.
	 */
	@Test
	void aRefusedPicturesRowGoesWithItsRefusal() throws Exception {
		standingOn(his);

		Waiting refused = waitingFor(his);

		assertThat(deciding(refused.item(), false, THE_REASON).getStatus())
				.as("the refusal was not carried out, so this case measures nothing")
				.isEqualTo(200);

		assertThat(theRowStands(refused.picture()))
				.as("the refused picture's photo row is still there, and the queue row that held it"
						+ " has let go of it for good")
				.isFalse();
	}

	/**
	 * AND WHAT IS NOT THE REFUSED PICTURE STAYS: HIS PORTRAIT, AND EVERYBODY ELSE'S PICTURES.
	 *
	 * <p>The member keeps the portrait he stands on, still pointed at by his profile, and another
	 * member's two pictures are both still there. Passes on a portal that deletes nothing; what it is
	 * written against is a fix that reads the wrong picture, the member's portrait where the queue
	 * row's picture was meant, or deletes every row nobody holds at the moment it runs.
	 */
	@Test
	void aRefusalLeavesTheStandingPortraitAndEverybodyElsesPicturesAlone() throws Exception {
		long portrait = standingOn(his);
		long anothersStanding = standingOn(another);
		long anothersWaiting = waitingFor(another).picture();
		Waiting refused = waitingFor(his);

		assertThat(deciding(refused.item(), false, THE_REASON).getStatus())
				.as("the refusal was not carried out, so this case measures nothing")
				.isEqualTo(200);

		assertThat(standingPicturesOf(HIS))
				.as("the portrait he stands on was taken away by the refusal of another picture")
				.containsExactly(portrait);
		assertThat(theRowStands(portrait))
				.as("the row of the portrait he stands on was deleted by the refusal of another")
				.isTrue();
		assertThat(theRowStands(anothersStanding) && theRowStands(anothersWaiting))
				.as("a picture of another member was deleted by a refusal that was not his")
				.isTrue();
		assertThat(standingPicturesOf(ANOTHER)).containsExactly(anothersStanding);
		assertThat(waitingPicturesOf(another)).containsExactly(anothersWaiting);
	}

	/**
	 * A REFUSED PICTURE THE MEMBER ALSO STANDS ON IS STILL HELD, SO IT STAYS.
	 *
	 * <p>The queue row and the member's profile point at the same row, which no door writes and the
	 * schema allows while the queue row waits. Refusing the queue row lets go of ONE of the two
	 * holders.
	 */
	@Test
	void aRefusedPictureTheMemberAlsoStandsOnStaysBecauseHeStillHoldsIt() throws Exception {
		long shared = standingOn(his);
		long item = waitingWith(his, shared);

		assertThat(deciding(item, false, THE_REASON).getStatus())
				.as("the refusal was not carried out, so this case measures nothing")
				.isEqualTo(200);

		assertThat(theRowStands(shared))
				.as("the row was deleted though the member's profile still points at it")
				.isTrue();
		assertThat(standingPicturesOf(HIS)).containsExactly(shared);
	}

	/**
	 * REFUSING A TEXT LETS NO PICTURE GO.
	 *
	 * <p>A biography waits in the same tab as a picture, told apart by {@code photo_id} being empty
	 * (V9, PDL P28a). The row that is refused holds no picture, so the picture the member stands on
	 * is not what it let go of - the source of the picture to release is the queue row and not the
	 * member.
	 */
	@Test
	void refusingATextReleasesNoPicture() throws Exception {
		long portrait = standingOn(his);
		long item = aTextWaitingFor(his);

		assertThat(deciding(item, false, THE_REASON).getStatus())
				.as("the refusal was not carried out, so this case measures nothing")
				.isEqualTo(200);

		assertThat(theRowStands(portrait))
				.as("refusing a text deleted the portrait the member stands on")
				.isTrue();
		assertThat(standingPicturesOf(HIS)).containsExactly(portrait);
	}

	// ---------------------------------------------------------------- a moderator approves

	/**
	 * APPROVING A PICTURE OVER ONE THAT STANDS LETS THE OLD ROW GO.
	 *
	 * <p>The portrait the new picture replaces loses its only holder, and nothing else in the portal
	 * will ever look at it again. Measured on 02.10.2026 against 6ab38139: the row survives.
	 */
	@Test
	void approvingOverAStandingPortraitLetsTheOldRowGo() throws Exception {
		long old = standingOn(his);
		Waiting replacement = waitingFor(his);

		assertThat(deciding(replacement.item(), true, null).getStatus())
				.as("the approval was not carried out, so this case measures nothing")
				.isEqualTo(200);

		assertThat(theRowStands(old))
				.as("the portrait that was replaced still has a photo row, and no column points at it")
				.isFalse();
	}

	/**
	 * AND THE PICTURE THAT WAS APPROVED IS HIS, WHETHER OR NOT HE HAD ANOTHER.
	 *
	 * <p>Both states of the member, because the route does one thing when there is nothing to
	 * replace and a second when there is. The approved row stands and the member holds it; another
	 * member's pictures are untouched. Passes on a portal that deletes nothing; what it is written
	 * against is a fix that lets go of the picture the queue row held on the way, which is the
	 * picture the member now stands on.
	 */
	@ParameterizedTest(name = "he had a portrait: {0}")
	@ValueSource(booleans = {false, true})
	void approvingGivesTheMemberThePictureThatWaitedWhetherOrNotHeHadAnother(boolean hadOne)
			throws Exception {

		if (hadOne) {
			standingOn(his);
		}

		long anothersStanding = standingOn(another);
		long anothersWaiting = waitingFor(another).picture();
		long approved = aPicture();
		long item = waitingWith(his, approved);

		assertThat(deciding(item, true, null).getStatus())
				.as("the approval was not carried out, so this case measures nothing")
				.isEqualTo(200);

		assertThat(standingPicturesOf(HIS))
				.as("the member does not stand on the picture that was approved")
				.containsExactly(approved);
		assertThat(theRowStands(approved))
				.as("the row of the picture that was approved was deleted by its approval")
				.isTrue();
		assertThat(theRowStands(anothersStanding) && theRowStands(anothersWaiting))
				.as("a picture of another member was deleted by an approval that was not his")
				.isTrue();
	}

	/**
	 * A PORTRAIT THAT IS REPLACED AND THAT SOMEBODY ELSE STILL HOLDS STAYS.
	 *
	 * <p>Two holders of the old row: the member, who is about to be given another picture, and
	 * another member's queue row, which waits with the same row. Replacing lets go of one of them.
	 */
	@Test
	void anOldPortraitSomebodyElseAlsoHoldsSurvivesBeingReplaced() throws Exception {
		long old = standingOn(his);

		waitingWith(another, old);

		Waiting replacement = waitingFor(his);

		assertThat(deciding(replacement.item(), true, null).getStatus())
				.as("the approval was not carried out, so this case measures nothing")
				.isEqualTo(200);

		assertThat(theRowStands(old))
				.as("the row was deleted though another member's queue row still points at it")
				.isTrue();
		assertThat(waitingPicturesOf(another)).containsExactly(old);
	}

	// ---------------------------------------------------------------- the file

	private static final String THE_MEMBER_IS_DELETED = "the member is deleted";

	private static final String THE_PICTURE_IS_REFUSED = "the picture is refused";

	private static final String THE_PICTURE_REPLACES_A_PORTRAIT = "the picture replaces a portrait";

	/**
	 * THE FILE OF A PICTURE THAT WENT IS SWEPT, AND THE FILE OF ONE THAT STAYS IS KEPT, over each of
	 * the three doors.
	 *
	 * <p><b>This is the joint between the two halves of one sentence of ADL A68.</b> The database
	 * takes the row and the sweep ({@link ThePicturesFolderIsSwept}) takes the file: „Fajl zatim
	 * pokupi cistac, pri sledecem satnom prolazu". ADL A12a, 1, „obrise fajl posle odluke", is
	 * kept by the two together, and no case asks either half about the other. The cases that hold
	 * the row know nothing of a file, and the cases of the sweep arrange a row by hand and a file by
	 * hand. A writer that named the file by something other than the picture's key would leave
	 * both classes green and the sweep would quietly never find it (a finding of the review of
	 * PR 468, left standing until here).
	 *
	 * <p><b>The picture is sent through the real route</b>, so the file under test is the one
	 * {@code MePhotoApi} writes and under the name it writes it, and a door takes it away. Its file
	 * is then made older than the sweep waits and the sweep is run over the folder.
	 *
	 * <p><b>Two controls in every case</b>: the file of a portrait another member stands on, as old
	 * as the other, which is kept because its row stands; and, for the door that replaces a
	 * portrait, the file of the picture that was approved, which the member now stands on and
	 * which is kept for the same reason. A sweep that took every old file would pass the first
	 * assertion and fail those.
	 */
	@ParameterizedTest(name = "{0}")
	@ValueSource(strings = {THE_MEMBER_IS_DELETED, THE_PICTURE_IS_REFUSED,
			THE_PICTURE_REPLACES_A_PORTRAIT})
	void theFileOfAPictureThatWentIsSweptAndTheFileOfOneThatStaysIsKept(String door) throws Exception {
		String hisSession = signedInAs(his);

		long anothersPortrait = standingOn(another);
		Path anothersFile = aFileFor(anothersPortrait);

		long goes;
		long stays = 0;

		switch (door) {
			case THE_MEMBER_IS_DELETED -> {
				goes = sendsAPicture(hisSession);

				assertThat(deletingTheMember(HIS).getStatus())
						.as("the member was not deleted, so this case measures nothing")
						.isEqualTo(204);
			}
			case THE_PICTURE_IS_REFUSED -> {
				goes = sendsAPicture(hisSession);

				assertThat(deciding(theItemThatWaitsFor(his), false, THE_REASON).getStatus())
						.as("the refusal was not carried out, so this case measures nothing")
						.isEqualTo(200);
			}
			default -> {
				goes = sendsAPicture(hisSession);

				assertThat(deciding(theItemThatWaitsFor(his), true, null).getStatus())
						.as("the first approval was not carried out, so there is no portrait to replace")
						.isEqualTo(200);

				stays = sendsAPicture(hisSession);

				assertThat(deciding(theItemThatWaitsFor(his), true, null).getStatus())
						.as("the second approval was not carried out, so nothing was replaced")
						.isEqualTo(200);
			}
		}

		assertThat(theFileOf(goes))
				.as("the route wrote the file of the picture under a name other than its key, so"
						+ " nothing that reads the key will ever find it")
				.exists();
		assertThat(theRowStands(goes))
				.as("the door did not take the row of the picture away, so this case measures"
						+ " nothing about its file")
				.isFalse();

		agedBeyondWhatTheSweepWaitsFor(theFileOf(goes));
		agedBeyondWhatTheSweepWaitsFor(anothersFile);

		if (stays != 0) {
			agedBeyondWhatTheSweepWaitsFor(theFileOf(stays));
		}

		sweeping.sweep();

		assertThat(theFileOf(goes))
				.as("the row of the picture is gone, and its file, older than the sweep waits, is"
						+ " still on the disk")
				.doesNotExist();
		assertThat(anothersFile)
				.as("the sweep took the file of a picture another member stands on")
				.exists();

		if (stays != 0) {
			assertThat(theFileOf(stays))
					.as("the sweep took the file of the picture the member stands on")
					.exists();
		}
	}

	/**
	 * A PICTURE THAT ANOTHER TRANSACTION IS WRITING ONTO A HOLDER IS NOT TAKEN AWAY FROM UNDER IT.
	 *
	 * <p>Two transactions meet over one picture: one lets go of it, the other writes it onto a
	 * holder and has not committed. The trigger that asked „does anybody hold it" and then deleted
	 * would be told „nobody", because the other holder is not committed, would wait for the
	 * foreign key's lock on the photo row, and would go through the moment the other transaction
	 * committed - and {@code on delete set null} would empty the pointer it had just written.
	 * Measured on a real PostgreSQL on 03.10.2026: the commit waited three seconds and then both the
	 * picture and the new holder's pointer were gone. V54's trigger takes the lock on the photo
	 * row FIRST and asks in a new statement, so it sees what the other transaction committed.
	 *
	 * <p>No door does this today, which is the reason it needs a case: ADL A68, „Vazi i za svaku
	 * buducu radnju nad tim kolonama", and V53 names what the other outcome is - a queue row that
	 * holds a picture whose photograph is deleted while it waits is a TEXT to its index.
	 *
	 * <p><b>Forced the way {@code VerificationDecisionConcurrencyTest} forces its cases</b>: this
	 * thread writes the picture onto another member's profile and keeps its transaction open, a
	 * second connection lets go of the picture from the queue row that holds it, and the lock
	 * manager is asked whether that connection is stopped behind this one before this one commits
	 * ({@link BlockedBehindThisHold}). Neither ordering is left to the scheduler, and the case
	 * asserts that the second connection was NOT finished while it was stopped.
	 */
	@Test
	void aPictureAnotherTransactionIsWritingOntoAHolderIsNotTakenAwayFromUnderIt() throws Exception {
		long picture = aPicture();
		long item = waitingWith(his, picture);
		ExecutorService pool = Executors.newSingleThreadExecutor();

		try {
			Future<Integer> lettingGo = holdingOpenATransaction.execute(writing -> {
				db.sql("update competitor set photo_id = ? where id = ?")
						.params(picture, another).update();

				assertThat(BlockedBehindThisHold.count(db))
						.as("nothing has been submitted yet, so a count of backends held up by this"
								+ " connection that is not nought is counting something else")
						.isZero();

				Future<Integer> submitted = pool.submit(
						() -> db.sql("delete from verification where id = ?").param(item).update());

				Instant deadline = Instant.now().plusSeconds(10);

				while (BlockedBehindThisHold.count(db) < 1) {
					if (Instant.now().isAfter(deadline)) {
						throw new IllegalStateException("the connection that lets go of the picture"
								+ " was never stopped behind the one that is writing it onto a"
								+ " holder, so the trigger does not wait for it. Done: "
								+ submitted.isDone());
					}

					try {
						Thread.sleep(20);
					}
					catch (InterruptedException interrupted) {
						throw new RuntimeException(interrupted);
					}
				}

				assertThat(submitted.isDone())
						.as("the connection that lets go was finished while the other still holds the"
								+ " picture, so it did not wait for it")
						.isFalse();

				return submitted;
			});

			assertThat(lettingGo.get(30, TimeUnit.SECONDS)).isEqualTo(1);

			assertThat(theRowStands(picture))
					.as("the picture was taken away from under the transaction that wrote it onto a"
							+ " holder")
					.isTrue();
			assertThat(standingPicturesOf(ANOTHER))
					.as("the member lost the portrait he had just been given")
					.containsExactly(picture);

			/* AND THE CONTROL, in the same body: the picture that stood while the member held it
			   goes the moment he lets go. Without it „it stood" would be true of a database with
			   no trigger at all, which deletes nothing. */
			db.sql("update competitor set photo_id = null where id = ?").param(another).update();

			assertThat(theRowStands(picture))
					.as("the member let go of the picture and its row is still there, so the trigger"
							+ " never fired and the statement above that it stood says nothing")
					.isFalse();
		}
		finally {
			pool.shutdownNow();
		}
	}

	// ---------------------------------------------------------------- the doors

	private MockHttpServletResponse deletingTheMember(String memberNumber) throws Exception {
		return http.perform(asModerator(delete("/api/competitors/" + memberNumber)
						.param("account", CompetitorWriteApi.DELETE_THE_ACCOUNT)))
				.andReturn().getResponse();
	}

	/**
	 * A MODERATOR DECIDING THE PICTURE THE ROW HOLDS WHEN THE CASE PRESSES, which is the only
	 * sense in which this file decides anything.
	 *
	 * <p>A decision about a picture names the picture the moderator saw (PDL, 10.10.2026), and the
	 * key AND THE CIRCLE are read off the row here, at the moment of the call. That is the one place
	 * in the suite where they are allowed to be, and the reason is that no case in this file is about
	 * WHICH picture he saw: each is about where a file goes when a row is decided or deleted, and
	 * each presses on the row it has just made. The cases that ARE about the key and the circle name
	 * them from outside the row, in {@code VerificationWriteApiTest}.
	 */
	private MockHttpServletResponse deciding(long item, boolean approved, String reason)
			throws Exception {

		Long held = db.sql("select photo_id from verification where id = ?").param(item)
				.query(Long.class).optional().orElse(null);
		String circle = db.sql("select '{\"x\":' || trim_scale(p.crop_x) || ',\"y\":' ||"
						+ " trim_scale(p.crop_y) || ',\"size\":' || trim_scale(p.crop_diameter) || '}'"
						+ " from verification v join photo p on p.id = v.photo_id where v.id = ?")
				.param(item).query(String.class).optional().orElse(null);
		String body = "{\"approved\":" + approved
				+ (reason == null ? "" : ",\"reason\":\"" + reason + "\"")
				+ (held == null ? "" : ",\"seenPhotoId\":" + held + ",\"seenCrop\":" + circle) + "}";

		return http.perform(asModerator(post("/api/verification/" + item + "/decision"))
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andReturn().getResponse();
	}

	/**
	 * A member sends his picture through the route he would use, which writes the row and the file,
	 * and what comes back is the key of the picture that now waits for a moderator.
	 */
	private long sendsAPicture(String hisSession) throws Exception {
		MockMultipartHttpServletRequestBuilder sending = multipart("/api/me/photo");

		sending.file(new MockMultipartFile("picture", "portret.jpg", MediaType.IMAGE_JPEG_VALUE,
				aJpeg("slika " + ++digests)));
		sending.param("cropX", "0.25").param("cropY", "0.75").param("cropSize", "0.5");

		assertThat(http.perform(sending.with(csrf()).cookie(new Cookie(SessionCookie.NAME, hisSession)))
				.andReturn().getResponse().getStatus())
				.as("the picture was not taken, so this case measures nothing about its file")
				.isEqualTo(200);

		return db.sql("select photo_id from verification where competitor_id = ? and queue = 'profiles'"
						+ " and state = 'waiting' and photo_id is not null")
				.param(his).query(Long.class).single();
	}

	/** The three bytes every JPEG begins with, and a tail that makes this one its own picture. */
	private static byte[] aJpeg(String tail) {
		byte[] head = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
		byte[] rest = tail.getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[head.length + rest.length];

		System.arraycopy(head, 0, whole, 0, head.length);
		System.arraycopy(rest, 0, whole, head.length, rest.length);

		return whole;
	}

	/** The queue row this member's picture waits in. */
	private long theItemThatWaitsFor(long member) {
		return db.sql("select id from verification where competitor_id = ? and queue = 'profiles'"
						+ " and state = 'waiting' and photo_id is not null")
				.param(member).query(Long.class).single();
	}

	/** Where the portal keeps a picture: under the key of its row and under no other name. */
	private static Path theFileOf(long picture) {
		return PHOTOS.resolve(String.valueOf(picture));
	}

	/** A file for a picture a case arranged by hand, as old as nothing yet. */
	private static Path aFileFor(long picture) throws IOException {
		Path file = theFileOf(picture);

		Files.write(file, aJpeg("fajl slike " + picture));

		return file;
	}

	/** Older than the ten minutes the sweep waits, by the file's own time of last modification. */
	private static void agedBeyondWhatTheSweepWaitsFor(Path file) throws IOException {
		Files.setLastModifiedTime(file, FileTime.from(Instant.now().minus(Duration.ofMinutes(30))));
	}

	/** Every request carries a CSRF token, or the chain answers 403 before it looks at who asks. */
	private MockHttpServletRequestBuilder asModerator(MockHttpServletRequestBuilder what) {
		return what.with(csrf()).cookie(new Cookie(SessionCookie.NAME, session.secret()));
	}

	// ---------------------------------------------------------------- the arrangement

	private long aMember(String number, String referralCode) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Slika', 'Bez Nosioca', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00') returning id")
				.params(number, referralCode).query(Long.class).single();
	}

	/**
	 * A session of an account that is this member's, so that he can use the portal as he would, and
	 * the secret his browser would send. The account goes before the member does.
	 */
	private String signedInAs(long member) {
		String email = "slika-bez-nosioca-" + member + "@primer.rs";

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Clan', 'Slike', ?, (select id from role where code = 'competitor'), ?)")
				.params(email, member).update();
		accounts.add(email);

		SecretToken secret = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, secret.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return secret.secret();
	}

	/** One picture row that nothing points at yet, with a digest of its own. */
	private long aPicture() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)"
						+ " returning id")
				.param(String.format("%064x", 0xb2060000L + ++digests)).query(Long.class).single();
	}

	/** A new picture standing on the member's profile, which is handed back. */
	private long standingOn(long member) {
		long picture = aPicture();

		standingOn(member, picture);

		return picture;
	}

	private void standingOn(long member, long picture) {
		assertThat(picture)
				.as("the picture's key is the key of the member who stands on it, so a trigger that"
						+ " let go of the holder's own id could not be told from one that let go of"
						+ " its pointer")
				.isNotEqualTo(member);

		db.sql("update competitor set photo_id = ? where id = ?").params(picture, member).update();
	}

	/** The queue row and the picture it holds, which are two different numbers. */
	private record Waiting(long item, long picture) {
	}

	/** A new picture waiting for a moderator in the member's name. */
	private Waiting waitingFor(long member) {
		long picture = aPicture();

		return new Waiting(waitingWith(member, picture), picture);
	}

	/** A queue row that holds this picture, which may be a picture something else holds too. */
	private long waitingWith(long member, long picture) {
		long item = db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values ('profiles', ?, 'Slika bez nosioca', '', ?) returning id")
				.params(member, picture).query(Long.class).single();

		assertThat(item)
				.as("the queue row's key is the key of the picture it holds, so a trigger that let go"
						+ " of the holder's own id could not be told from one that let go of its"
						+ " pointer")
				.isNotEqualTo(picture);

		return item;
	}

	/** A biography waiting in the same tab, which holds no picture. */
	private long aTextWaitingFor(long member) {
		return db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('profiles', ?, 'Tekst bez slike', 'Trcim deset godina')"
						+ " returning id")
				.param(member).query(Long.class).single();
	}

	private boolean theRowStands(long picture) {
		return db.sql("select exists (select 1 from photo where id = ?)").param(picture)
				.query(Boolean.class).single();
	}

	private List<Long> standingPicturesOf(String memberNumber) {
		return db.sql("select photo_id from competitor where member_number = ?"
						+ " and photo_id is not null")
				.param(memberNumber).query(Long.class).list();
	}

	private List<Long> waitingPicturesOf(long member) {
		return db.sql("select photo_id from verification where competitor_id = ?"
						+ " and queue = 'profiles' and state = 'waiting' and photo_id is not null"
						+ " order by id")
				.param(member).query(Long.class).list();
	}
}
