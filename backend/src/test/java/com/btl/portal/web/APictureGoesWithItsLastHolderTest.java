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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A {@code photo} ROW GOES WITH ITS LAST HOLDER, WHICHEVER DOOR TOOK THE HOLDER AWAY.
 *
 * <p><b>WHAT THIS CLASS HOLDS IS AN OUTCOME AND NOT A MECHANISM.</b> Every case does one thing to
 * the portal through the door a person would use, lets it commit, and then asks the database one
 * question: is there still a {@code photo} row that no column points at? A column that may point at
 * a picture is {@code competitor.photo_id}, {@code verification.photo_id}, {@code team.logo_id}
 * and {@code team_proposal.logo_id} (V8, V9, V11), and {@link PhotoApi} serves a picture only
 * through the first and the third (ADL A60), so a row that none of the four holds is a row
 * nothing will ever read and nothing deletes: {@link ThePicturesFolderIsSwept} reads FILES and
 * never rows, and a file whose row stands is a file it keeps.
 *
 * <p><b>THE THREE DOORS THIS CLASS REACHES</b>, each of which leaves the row of a picture with
 * nobody pointing at it today:
 *
 * <ul>
 * <li><b>A member is deleted</b> ({@link CompetitorWriteApi#remove}). The route reads and deletes
 * the picture standing on his profile, and a picture of his that WAITS in the queue stands in a
 * {@code verification} row that goes with him by {@code verification_competitor_fk}
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
 * ADL A66, reading 2, which says that a row nobody holds keeps its file, is itself a reading by the
 * author of the sweep and not a decision.
 *
 * <p><b>THE FILE IS NOT HERE.</b> The sweep ({@link ThePicturesFolderIsSwept}) deletes a file that no
 * row names once it is older than ten minutes (the owner's choice of 02.10.2026), so whether a
 * door ALSO deletes the file at once is not what these cases ask. They write no file at all.
 *
 * <p><b>TWO KINDS OF CASE, TOLD APART BY WHAT THEY DO TODAY.</b> The cases that say a row GOES are
 * the ones that fail on a portal that leaks it. The cases that say a row STAYS - another member's
 * pictures, a portrait the refused picture is also standing as, a picture a second holder
 * still points at - pass on a portal that deletes nothing, and are here for the day a fix is wider
 * than it should be: the fix that answers „delete every picture of the member", or „delete every
 * picture nobody holds right now", or „delete the picture this row held" without asking whether
 * anything else holds it, is the one they fail. <b>A picture with TWO holders is a state the
 * schema allows</b> (none of the four columns is unique, V8, V9, V11) <b>and no door writes
 * today</b>: a decided row cannot hold one (V9), so it exists only while the queue row WAITS, and
 * these cases build it by hand.
 *
 * <p><b>NOT {@code @Transactional}</b>, for the reason {@link ThePictureAndItsFileAreOneThingTest}
 * and {@link TheRemovalStandsEvenWhenTheFileWontGoTest} give: a test-managed transaction is rolled
 * back at the end of the case, so anything that happens when a transaction COMMITS - and this
 * question is about what is left AFTER one has - would never be seen. What each case wrote is
 * taken away again in {@link #takeBackWhatWasReallyCommitted}.
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
	 * A FOLDER OF THIS RUN'S OWN, for the reason {@code MePhotoApiTest} measured for its own. No
	 * case here writes into it; the route that deletes a standing portrait asks the folder for a
	 * file and says it was already gone.
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

	private SecretToken session;

	/** Where the picture table stood before this case, so the clean up takes only what it wrote. */
	private long picturesBefore;

	private long digests;

	private long his;

	private long another;

	@BeforeEach
	void aModeratorWhoMayDecideAndDeleteAndTwoMembersWithNothingYet() {
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
	 * points at it without emptying that pointer on the way.
	 */
	@AfterEach
	void takeBackWhatWasReallyCommitted() {
		db.sql("delete from verification where competitor_id in"
						+ " (select id from competitor where member_number in (?, ?))")
				.params(HIS, ANOTHER).update();
		db.sql("delete from photo where id > ?").param(picturesBefore).update();
		db.sql("delete from competitor where member_number in (?, ?)").params(HIS, ANOTHER).update();
		db.sql("delete from account where email = ?").param(THE_MODERATOR).update();
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

	// ---------------------------------------------------------------- the doors

	private MockHttpServletResponse deletingTheMember(String memberNumber) throws Exception {
		return http.perform(asModerator(delete("/api/competitors/" + memberNumber)
						.param("account", CompetitorWriteApi.DELETE_THE_ACCOUNT)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse deciding(long item, boolean approved, String reason)
			throws Exception {

		String body = reason == null
				? "{\"approved\":" + approved + "}"
				: "{\"approved\":" + approved + ",\"reason\":\"" + reason + "\"}";

		return http.perform(asModerator(post("/api/verification/" + item + "/decision"))
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andReturn().getResponse();
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
		return db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values ('profiles', ?, 'Slika bez nosioca', '', ?) returning id")
				.params(member, picture).query(Long.class).single();
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
