package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.domain.verification.HoldingAnItem;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A MODERATOR ANSWERING SOMETHING IN THE QUEUE, AND HOLDING IT WHILE HE READS IT.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND, on any axis an assertion
 * below reads a value along.</b> The axes were counted rather than felt, which is the rule
 * of 06.09.2026 and its correction the same afternoon:
 *
 * <ul>
 * <li><b>Every moderator holds exactly ONE queue, and they are DIFFERENT queues.</b> This
 * is the axis that matters most and the one a fixture normally misses: with a plain
 * competitor as the only refused case, „may he moderate THIS tab" and „does he hold ANY tab"
 * answer alike on every request. {@link #aModeratorIsToldNothingAboutAnItemInATabHeDoesNotHold}
 * asks a man who genuinely holds {@code queue:comments} about a {@code profiles} row.
 * <li><b>TWO moderators hold the profiles tab</b>, so „somebody else is reading it" is a
 * state two people who may both decide can be in, rather than a state only an outsider
 * reaches.
 * <li><b>The deciding moderator's ACCOUNT and his MEMBER row carry different names.</b> PDL
 * P21 puts a parent on the account of a competitor under sixteen, so the two really do
 * differ; with one name they are one value read twice and the assertion about who decided
 * measures nothing.
 * <li><b>Three items wait in the profiles tab and one has been answered</b>, so „this item"
 * is never „the first item" and „waiting" is never „every row in the tab".
 * <li><b>One waiting item carries a picture and the others do not</b>, which is the only way
 * {@code verification_decided_keeps_no_photo} is ever touched: nothing on this server writes
 * a picture into that tab yet, so a fixture made of what the portal writes never reaches it.
 * <li><b>One waiting item is about NOBODY.</b> V9 makes {@code competitor_id} nullable on
 * purpose and a decision must not fall over it.
 * <li><b>Three members plus the moderator's own child</b>, so „that member" is never „the
 * only member".
 * <li><b>THE CLOCK STANDS IN MARCH</b>, where {@link SeasonClock#transfersTakeEffect} answers
 * 2028 and {@link SeasonClock#seasonBeingPaidFor} answers 2027. Inside the transfer window
 * the two agree and a route reading the wrong one is right anyway - which is exactly how the
 * portal shipped this mistake once before (06.09.2026: „a team proposal sent in December and
 * approved on 5 January wrote the RUNNING season").
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class VerificationWriteApiTest {

	/**
	 * Noon in Belgrade on 15 March 2027, and both halves of that are chosen.
	 *
	 * <p>MARCH, because the two season functions differ there by a whole year; 2027, because
	 * the answer is then 2028 while the season that is RUNNING is 2027, so a team written
	 * with the wrong one is written into a season that is already under way.
	 */
	private static final Instant IN_MARCH = Instant.parse("2027-03-15T11:00:00Z");

	/** The season a team approved at {@link #IN_MARCH} starts collecting points in. */
	private static final int STARTS_IN = 2028;

	/** And the season that is running then, which is the wrong answer. */
	private static final int STILL_RUNNING = 2027;

	/** Holds {@code queue:profiles} and nothing else. His account is a parent's. */
	private static final String PROFILES_MODERATOR = "profili@primer.rs";

	/** Holds {@code queue:profiles} too, so „somebody else" is somebody who also may. */
	private static final String THE_OTHER_PROFILES_MODERATOR = "profili2@primer.rs";

	/** Holds {@code queue:comments} and nothing else, and is asked about a profiles row. */
	private static final String COMMENTS_MODERATOR = "komentari@primer.rs";

	/** Holds {@code queue:teams} and nothing else. */
	private static final String TEAMS_MODERATOR = "timovi@primer.rs";

	/** Every right, with no tick anywhere (V5's {@code rights_mode = 'all'}). */
	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	/** Signed in and holding nothing, which is every member of the league. */
	private static final String A_COMPETITOR = "takmicar@primer.rs";

	private static final String ANA = "000010";

	private static final String BOJAN = "000020";

	private static final String VERA = "000030";

	/** The moderator's child, whose profile his ACCOUNT is not named after. */
	private static final String DETE = "000040";

	/** The name on the deciding moderator's ACCOUNT, which is the parent's. */
	private static final String THE_PARENTS_NAME = "Roditelj Roditeljic";

	/** And the name on the member row behind that same account, which is the child's. */
	private static final String THE_CHILDS_FIRST_NAME = "Dete";

	private static final String THE_REASON = "Slika je mutna, posalji ostriju";

	private static final String THE_TEAM = "Timocka trkacka druzina";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/** The text item about Ana, which most cases below answer. */
	private long anasText;

	/** The item carrying a picture, which is the only one that ever clears a photo. */
	private long verasPicture;

	/** An item about nobody in the record at all. */
	private long aboutNobody;

	/** One already answered, so „already decided" is a real row and not a mutation. */
	private long alreadyAnswered;

	/** The team proposal Bojan sent. */
	private long bojansTeam;

	/**
	 * A CLOCK THE CASE MOVES, copied from {@code PairWriteApiTest} with its reason.
	 *
	 * <p>It reports UTC as its zone on purpose: whoever works out a season has to re-read the
	 * instant in the league's own time, and a server that reads this zone instead answers with
	 * the wrong year on the one night that matters.
	 */
	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		private AClockTheCaseMoves(Instant now) {
			this.now = now;
		}

		void moveTo(Instant when) {
			this.now = when;
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(IN_MARCH);
		}
	}

	@BeforeEach
	void sixAccountsFourMembersAndSixTabs() {
		clock.moveTo(IN_MARCH);

		member(ANA, "Ana", "Anic");
		member(BOJAN, "Bojan", "Bojic");
		member(VERA, "Vera", "Veric");
		member(DETE, THE_CHILDS_FIRST_NAME, "Detic");

		/* THE PARENT HOLDS THE CHILD'S ACCOUNT (PDL P21), which is what makes
		   `account.first_name` and `competitor.first_name` two values rather than one. */
		account(PROFILES_MODERATOR, "moderator", "Roditelj", "Roditeljic", DETE);
		account(THE_OTHER_PROFILES_MODERATOR, "moderator", "Druga", "Drugic", null);
		account(COMMENTS_MODERATOR, "moderator", "Komentar", "Komentaric", null);
		account(TEAMS_MODERATOR, "moderator", "Timo", "Timic", BOJAN);
		account(THE_SUPERADMIN, "superadmin", "Sanja", "Simic", null);
		account(A_COMPETITOR, "competitor", "Tijana", "Takic", ANA);

		ticked(PROFILES_MODERATOR, "queue:profiles");
		ticked(THE_OTHER_PROFILES_MODERATOR, "queue:profiles");
		ticked(COMMENTS_MODERATOR, "queue:comments");
		ticked(TEAMS_MODERATOR, "queue:teams");

		/* FOUR IN THE PROFILES TAB AND NOT ONE, so „this item" is never „the first item". */
		waiting("profiles", BOJAN, "Biografija Bojana", "Trcim od 2019.", null);
		anasText = waiting("profiles", ANA, "Biografija Ane", "Trcim od 2021. godine", null);
		verasPicture = waiting("profiles", VERA, "Slika Vere", "vera.jpg", photograph());
		aboutNobody = waitingAboutNobody("profiles", "Neko ko nije u evidenciji");
		alreadyAnswered = decided("profiles", BOJAN, "Vec odluceno", "approved", null);

		bojansTeam = teamProposalWaitingFor(BOJAN, THE_TEAM);

		/* AND ONE ROW IN EVERY OTHER TAB, which is what the floor over the six reads. */
		waiting("comments", ANA, "Komentar", "Odlicna staza", null);
		waiting("results", ANA, "Rezultat", "", null);
		waiting("payments", VERA, "Uplata", "", null);
		waiting("schedule", ANA, "Promena termina", "", null);
	}

	// ----- the doors -------------------------------------------------------------------

	@Test
	void somebodyNotSignedInIsRefusedBeforeAnyOfThisRuns() throws Exception {
		assertThat(http.perform(asking(null, post(hold(anasText))))
				.andReturn().getResponse().getStatus()).isEqualTo(401);
		assertThat(http.perform(asking(null, delete(hold(anasText))))
				.andReturn().getResponse().getStatus()).isEqualTo(401);
		assertThat(answer(null, anasText, true, null)).isEqualTo(401);
	}

	@Test
	void aPlainCompetitorIsToldTheAddressIsNotThere() throws Exception {
		assertThat(answer(A_COMPETITOR, anasText, true, null)).isEqualTo(404);
		assertThat(take(A_COMPETITOR, anasText)).isEqualTo(404);
	}

	/**
	 * THE AXIS THIS WHOLE FILE IS BUILT AROUND.
	 *
	 * <p>He is a real moderator with a real queue tick, and the row is in another tab. A
	 * route asking „does he hold any queue" would let him through, and every case written
	 * with a plain competitor would stay green while it did.
	 */
	@Test
	void aModeratorIsToldNothingAboutAnItemInATabHeDoesNotHold() throws Exception {
		assertThat(answer(COMMENTS_MODERATOR, anasText, true, null)).isEqualTo(404);
		assertThat(take(COMMENTS_MODERATOR, anasText)).isEqualTo(404);
		assertThat(letGo(COMMENTS_MODERATOR, anasText)).isEqualTo(404);

		/* AND THE ROW IS UNTOUCHED, which is the half a status alone does not say. */
		assertThat(stateOf(anasText)).isEqualTo("waiting");
	}

	/**
	 * An item he may not see and an item that is not there are one answer, so the key never
	 * becomes an oracle for what is standing in the queue.
	 */
	@Test
	void anItemHeMayNotSeeAnswersExactlyAsOneThatIsNotThere() throws Exception {
		var refused = http.perform(asking(COMMENTS_MODERATOR, post(hold(anasText))))
				.andReturn().getResponse();
		var missing = http.perform(asking(COMMENTS_MODERATOR, post(hold(9_999_999L))))
				.andReturn().getResponse();

		assertThat(refused.getStatus()).isEqualTo(missing.getStatus());
		assertThat(refused.getContentAsString()).isEqualTo(missing.getContentAsString());
	}

	// ----- holding ---------------------------------------------------------------------

	@Test
	void heTakesTheItemAndIsToldHowLongHeHasIt() throws Exception {
		var answer = http.perform(asking(PROFILES_MODERATOR, post(hold(anasText))))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(answer.getContentAsString())
				.contains("\"secondsLeft\":" + HoldingAnItem.QUIET.toSeconds());

		assertThat(heldBy(anasText)).isEqualTo(accountOf(PROFILES_MODERATOR));
	}

	@Test
	void anItemSomebodyElseIsReadingIsRefusedToEverybodyElse() throws Exception {
		assertThat(take(THE_OTHER_PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(409);
		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(409);

		/* AND IT IS STILL THE OTHER MAN'S, which „409" alone does not say. */
		assertThat(heldBy(anasText)).isEqualTo(accountOf(THE_OTHER_PROFILES_MODERATOR));
		assertThat(stateOf(anasText)).isEqualTo("waiting");
	}

	@Test
	void hisOwnHoldIsNeverInHisWay() throws Exception {
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);
		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(200);
	}

	/**
	 * THE OWNER'S FIFTEEN MINUTES, MEASURED ON BOTH SIDES OF ITSELF.
	 *
	 * <p>„Zakljucavanje ISTICE posle vremena mirovanja, i tada stavku uzima ko hoce" (owner,
	 * 18.09.2026), chosen against the cost he was shown: „pad pregledaca ili zatvoren laptop
	 * drzali bi stavku zauvek".
	 *
	 * <p><b>One fixture and two moments, which is the only shape that measures this.</b> A
	 * case that takes a hold and asks straight away is green whether the spell is fifteen
	 * minutes or a fortnight; what says which is asking again after it should have run out.
	 * The hold below is the SAME hold both times and only the clock moves.
	 */
	@Test
	void aHoldStandsInTheWayForFifteenMinutesAndNotAMinuteLonger() throws Exception {
		assertThat(take(THE_OTHER_PROFILES_MODERATOR, anasText)).isEqualTo(200);

		clock.moveTo(IN_MARCH.plus(Duration.ofMinutes(3)));
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(409);
		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(409);

		clock.moveTo(IN_MARCH.plus(Duration.ofMinutes(16)));
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);
		assertThat(heldBy(anasText)).isEqualTo(accountOf(PROFILES_MODERATOR));
	}

	@Test
	void heLetsGoOfHisOwnAndNothingIsLeftHolding() throws Exception {
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(letGo(PROFILES_MODERATOR, anasText)).isEqualTo(204);
		assertThat(holdsOn(anasText)).isZero();

		/* Letting go of nothing is not a fault: a screen closed twice has done nothing. */
		assertThat(letGo(PROFILES_MODERATOR, anasText)).isEqualTo(204);
	}

	@Test
	void aModeratorMayNotTakeAHoldOffAnother() throws Exception {
		assertThat(take(THE_OTHER_PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(letGo(PROFILES_MODERATOR, anasText)).isEqualTo(409);
		assertThat(heldBy(anasText)).isEqualTo(accountOf(THE_OTHER_PROFILES_MODERATOR));
	}

	/**
	 * „Superadmin SME da otme tudje zakljucavanje, I ONAJ KOME JE OTETO TO SAZNA" (owner,
	 * 18.09.2026), with the cost he accepted written beside it: „jedna ruta vise i jedna
	 * poruka u sanduce, da moderator ne otkrije tek kad mu odluka ne prodje."
	 */
	@Test
	void theSuperadminTakesAHoldAwayAndTheManWhoHeldItIsTold() throws Exception {
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(letGo(THE_SUPERADMIN, anasText)).isEqualTo(204);
		assertThat(holdsOn(anasText)).isZero();

		/* TO HIM AND NOT TO THE LEAGUE: an empty `to_id` is everybody (V13). */
		assertThat(db.sql("select count(*) from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(DETE).query(Integer.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(*) from message where to_id is null")
				.query(Integer.class).single()).isZero();
	}

	/**
	 * V23 says an account naming no member is the ordinary case for a moderator who does not
	 * race, so there may be no inbox to write to. The hold still goes.
	 */
	@Test
	void aHoldIsTakenAwayFromAModeratorWhoDoesNotRaceAndThereIsSimplyNobodyToTell()
			throws Exception {
		assertThat(take(THE_OTHER_PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(letGo(THE_SUPERADMIN, anasText)).isEqualTo(204);
		assertThat(holdsOn(anasText)).isZero();
		assertThat(db.sql("select count(*) from message").query(Integer.class).single()).isZero();
	}

	@Test
	void nothingIsHeldInOrderToBeReadOnceItHasBeenAnswered() throws Exception {
		assertThat(take(PROFILES_MODERATOR, alreadyAnswered)).isEqualTo(409);
		assertThat(holdsOn(alreadyAnswered)).isZero();
	}

	// ----- deciding --------------------------------------------------------------------

	@Test
	void approvingATextPutsItOnTheProfileAndTakesTheItemOutOfTheQueue() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(200);

		assertThat(stateOf(anasText)).isEqualTo("approved");
		assertThat(db.sql("select bio from competitor where member_number = ?")
				.param(ANA).query(String.class).single()).isEqualTo("Trcim od 2021. godine");

		/* AND IT IS GONE FOR EVERYBODY, which needs no mechanism of its own: the queue serves
		   `state = 'waiting'`, so one answer removes it from every screen at once. */
		assertThat(http.perform(asking(PROFILES_MODERATOR, get("/api/verification")))
				.andReturn().getResponse().getContentAsString())
				.doesNotContain("Biografija Ane");
	}

	/**
	 * „Poruka o odbijanju ide sa svih redova verifikacije... razlog stize u sanduce onome ko
	 * je stavku poslao" (owner, PDL P22, 15.08.2026).
	 *
	 * <p><b>TO HIM AND NEVER TO THE LEAGUE.</b> {@code message.to_id} left empty means
	 * everybody (V13), so the source this assertion reads is swapped deliberately: a refusal
	 * posted to the whole portal would satisfy „the member was told" just as well.
	 */
	@Test
	void aRefusalSaysWhyAndTheReasonReachesThatMemberAndNobodyElse() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, verasPicture, false, THE_REASON)).isEqualTo(200);

		assertThat(stateOf(verasPicture)).isEqualTo("rejected");
		assertThat(db.sql("select reason from verification where id = ?")
				.param(verasPicture).query(String.class).single()).isEqualTo(THE_REASON);

		assertThat(db.sql("select body from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(VERA).query(String.class).single()).isEqualTo(THE_REASON);

		assertThat(db.sql("select count(*) from message where to_id is null")
				.query(Integer.class).single()).isZero();
		assertThat(db.sql("select count(*) from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(ANA).query(Integer.class).single()).isZero();
	}

	/**
	 * „Uz odbijanje je komentar obavezan" (owner, 06.08.2026), and the schema says the same
	 * with {@code btrim}: a box holding spaces is a box nobody filled in.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "   "})
	void aRefusalWithNothingInTheBoxIsNotADecision(String typed) throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasText, false, typed)).isEqualTo(400);
		assertThat(stateOf(anasText)).isEqualTo("waiting");
	}

	@Test
	void aRefusalWithNoBoxAtAllIsNotADecisionEither() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasText, false, null)).isEqualTo(400);
		assertThat(stateOf(anasText)).isEqualTo("waiting");
	}

	/**
	 * V9's {@code verification_refusal_says_why} is a biconditional, so an approval must carry
	 * NO reason. A moderator who typed something and then pressed yes would otherwise have his
	 * note written beside an approval and the row thrown out.
	 */
	@Test
	void anApprovalCarriesNoReasonEvenWhenTheBoxWasFilledIn() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasText, true, THE_REASON)).isEqualTo(200);

		assertThat(db.sql("select reason from verification where id = ?")
				.param(anasText).query(String.class).optional()).isEmpty();
	}

	@Test
	void answeringSomethingSomebodyAnsweredAlreadyIsRefusedAndChangesNothing() throws Exception {
		String who = db.sql("select decided_by_name from verification where id = ?")
				.param(alreadyAnswered).query(String.class).single();

		assertThat(answer(PROFILES_MODERATOR, alreadyAnswered, false, THE_REASON)).isEqualTo(409);

		assertThat(stateOf(alreadyAnswered)).isEqualTo("approved");
		assertThat(db.sql("select decided_by_name from verification where id = ?")
				.param(alreadyAnswered).query(String.class).single()).isEqualTo(who);
	}

	/**
	 * THE PICTURE GOES THE MOMENT THE ROW IS ANSWERED, EITHER WAY.
	 *
	 * <p>{@code verification_decided_keeps_no_photo} is what insists, and this item is
	 * written by hand because nothing on this server writes a picture into that tab yet - so a
	 * fixture made of what the portal really writes never touches the constraint at all.
	 */
	@Test
	void decidingLetsGoOfThePictureAndApprovingOneMakesItHisPortrait() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, verasPicture, true, null)).isEqualTo(200);

		assertThat(db.sql("select photo_id from verification where id = ?")
				.param(verasPicture).query(Long.class).optional()).isEmpty();
		assertThat(db.sql("select photo_id from competitor where member_number = ?")
				.param(VERA).query(Long.class).optional()).isNotEmpty();
	}

	@Test
	void aRefusedPictureIsLetGoOfWithoutBecomingAnybodysPortrait() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, verasPicture, false, THE_REASON)).isEqualTo(200);

		assertThat(db.sql("select photo_id from verification where id = ?")
				.param(verasPicture).query(Long.class).optional()).isEmpty();
		assertThat(db.sql("select photo_id from competitor where member_number = ?")
				.param(VERA).query(Long.class).optional()).isEmpty();
	}

	/**
	 * V9 makes {@code competitor_id} nullable on purpose - „A payment waiting to be recognised
	 * may be about a person who is not one yet" - so a decision must not fall over a row that
	 * names nobody, and there is simply nobody to write to.
	 */
	@Test
	void anItemAboutNobodyIsAnsweredAndNobodyIsWrittenTo() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, aboutNobody, false, THE_REASON)).isEqualTo(200);

		assertThat(stateOf(aboutNobody)).isEqualTo("rejected");
		assertThat(db.sql("select count(*) from message").query(Integer.class).single()).isZero();
	}

	/**
	 * WHO DECIDED IS THE NAME ON THE ACCOUNT AND NOT THE NAME ON THE MEMBER ROW BEHIND IT.
	 *
	 * <p>Two different values rather than one read twice: PDL P21 puts a parent on the account
	 * of a competitor under sixteen, so this moderator signs in as {@code Roditelj Roditeljic}
	 * while the member his account names is {@code Dete Detic}.
	 */
	@Test
	void theDecisionKeepsTheNameOnTheAccountAndNotTheNameOnHisMemberRow() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(200);

		assertThat(db.sql("select decided_by_name from verification where id = ?")
				.param(anasText).query(String.class).single())
				.isEqualTo(THE_PARENTS_NAME)
				.doesNotContain(THE_CHILDS_FIRST_NAME);

		assertThat(db.sql("select decided_by from verification where id = ?")
				.param(anasText).query(Long.class).single())
				.isEqualTo(accountOf(PROFILES_MODERATOR));
	}

	@Test
	void answeringAnItemLetsGoOfWhateverWasHoldingIt() throws Exception {
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(200);
		assertThat(holdsOn(anasText)).isZero();
	}

	// ----- what an approval means ------------------------------------------------------

	/**
	 * „Odobrenje pravi tim... i od tog trenutka imaju Admin prava za svoj tim" (owner,
	 * 03.08.2026), and „Odobrenje novog tima upisuje osnivaca u taj tim" (05.09.2026), which a
	 * review of PR 186 found when approval wrote the team and left the founder out of it.
	 */
	@Test
	void approvingATeamMakesItPutsTheFounderInItAndTellsHim() throws Exception {
		assertThat(answer(TEAMS_MODERATOR, bojansTeam, true, null)).isEqualTo(200);

		assertThat(db.sql("select slug from team where name = ?")
				.param(THE_TEAM).query(String.class).single()).isEqualTo("timocka-trkacka-druzina");

		assertThat(db.sql("select admin_id from team where name = ?")
				.param(THE_TEAM).query(Long.class).single()).isEqualTo(memberId(BOJAN));

		assertThat(db.sql("select count(*) from team_membership m join team t on t.id = m.team_id"
						+ " where t.name = ? and m.competitor_id = ? and m.season_to is null")
				.params(THE_TEAM, memberId(BOJAN)).query(Integer.class).single()).isEqualTo(1);

		assertThat(db.sql("select count(*) from message where to_id = ?")
				.param(memberId(BOJAN)).query(Integer.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(*) from message where to_id is null")
				.query(Integer.class).single()).isZero();
	}

	/**
	 * THE SEASON IS THE ONE TRANSFERS TAKE EFFECT IN, AND THE PORTAL HAS ALREADY GOT THIS
	 * WRONG ONCE.
	 *
	 * <p>{@link SeasonClock#transfersTakeEffect} carries the measurement: „a team proposal
	 * sent in December and approved on 5 January wrote the RUNNING season, and the team
	 * counted that member's results from the middle of it" (06.09.2026). The clock stands in
	 * March precisely so the two answers differ, and both numbers are asserted rather than
	 * only the right one - otherwise this reads as „some season was written".
	 */
	@Test
	void theTeamAndItsFounderBothStartInTheSeasonTransfersTakeEffectIn() throws Exception {
		assertThat(SeasonClock.transfersTakeEffect(IN_MARCH.atZone(SeasonClock.ZONE)))
				.isEqualTo(STARTS_IN);
		assertThat(SeasonClock.seasonBeingPaidFor(IN_MARCH.atZone(SeasonClock.ZONE)))
				.isEqualTo(STILL_RUNNING);

		assertThat(answer(TEAMS_MODERATOR, bojansTeam, true, null)).isEqualTo(200);

		assertThat(db.sql("select first_season from team where name = ?")
				.param(THE_TEAM).query(Integer.class).single()).isEqualTo(STARTS_IN);

		assertThat(db.sql("select m.season_from from team_membership m join team t"
						+ " on t.id = m.team_id where t.name = ?")
				.param(THE_TEAM).query(Integer.class).single()).isEqualTo(STARTS_IN);
	}

	@Test
	void refusingATeamMakesNoTeamAndTellsTheMemberWhy() throws Exception {
		assertThat(answer(TEAMS_MODERATOR, bojansTeam, false, THE_REASON)).isEqualTo(200);

		assertThat(db.sql("select count(*) from team").query(Integer.class).single()).isZero();
		assertThat(db.sql("select count(*) from team_membership")
				.query(Integer.class).single()).isZero();
		assertThat(db.sql("select body from message where to_id = ?")
				.param(memberId(BOJAN)).query(String.class).single()).isEqualTo(THE_REASON);
	}

	/**
	 * „Naziv ne sme biti zauzet nekim vec odobrenim timom" (PDL P13), measured by the ADDRESS
	 * the name makes and not by its letters (ADL, 03.08.2026).
	 *
	 * <p><b>And the item stays in the queue.</b> An answer that cannot be carried out must not
	 * leave the row marked answered and the team unmade, which is the one outcome nobody could
	 * undo from a screen.
	 */
	@Test
	void aTeamWhoseAddressHasBeenTakenSinceIsRefusedAndItsItemStaysInTheQueue() throws Exception {
		db.sql("insert into team (slug, name, bio, link, place_id, first_season)"
						+ " values ('timocka-trkacka-druzina', 'Timocka Trkacka Druzina', '', '',"
						+ " (select id from place where rank = 1), ?)")
				.param(STARTS_IN).update();

		assertThat(answer(TEAMS_MODERATOR, bojansTeam, true, null)).isEqualTo(409);

		assertThat(stateOf(bojansTeam)).isEqualTo("waiting");
		assertThat(db.sql("select count(*) from team_membership")
				.query(Integer.class).single()).isZero();
	}

	@Test
	void aFounderWhoIsAlreadyInATeamIsRefusedAndHisItemStaysInTheQueue() throws Exception {
		long other = db.sql("insert into team (slug, name, bio, link, place_id, first_season)"
						+ " values ('neki-drugi-tim', 'Neki drugi tim', '', '',"
						+ " (select id from place where rank = 1), ?) returning id")
				.param(STARTS_IN).query(Long.class).single();

		db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, ?)")
				.params(memberId(BOJAN), other, STARTS_IN).update();

		assertThat(answer(TEAMS_MODERATOR, bojansTeam, true, null)).isEqualTo(409);

		assertThat(stateOf(bojansTeam)).isEqualTo("waiting");
		assertThat(db.sql("select count(*) from team where name = ?")
				.param(THE_TEAM).query(Integer.class).single()).isZero();
	}

	/**
	 * THE FLOOR UNDER THE LIST OF TABS THIS ROUTE CARRIES OUT.
	 *
	 * <p>It asks the DATABASE for every queue there is rather than repeating a list, so a
	 * seventh tab - or a sixth that grows a consequence - fails here until somebody decides
	 * what answering it means. Four of the six are refused today and one of those four,
	 * {@code results}, is refused because ADL A36 keeps its transactional boundary expressly
	 * undecided: „trece mesto, verifikacija rezultata, i dalje NIJE odluceno i ostaje
	 * otvoreno."
	 */
	@Test
	void everyTabIsEitherCarriedOutOrRefusedAndNoneIsQuietlyRecorded() throws Exception {
		List<String> tabs = db.sql("select target from admin_right where scope = 'queue'"
				+ " order by target").query(String.class).list();

		assertThat(tabs).hasSize(6);

		for (String tab : tabs) {
			Long item = db.sql("select id from verification where queue = ? and state = 'waiting'"
					+ " order by id limit 1").param(tab).query(Long.class).optional().orElse(null);

			assertThat(item).as("the fixture holds nothing waiting in " + tab).isNotNull();

			int status = answer(THE_SUPERADMIN, item, true, null);

			if (List.of("profiles", "teams").contains(tab)) {
				assertThat(status).as(tab + " is carried out").isEqualTo(200);
				assertThat(stateOf(item)).isEqualTo("approved");
			} else {
				assertThat(status).as(tab + " has no consequence written for it yet")
						.isEqualTo(409);
				assertThat(stateOf(item)).as(tab + " must not be quietly recorded")
						.isEqualTo("waiting");
			}
		}
	}

	// ----- the fixture -----------------------------------------------------------------

	private String hold(long id) {
		return "/api/verification/" + id + "/hold";
	}

	private String decision(long id) {
		return "/api/verification/" + id + "/decision";
	}

	/**
	 * <b>Every request here carries a CSRF token, including the ones made with no session at
	 * all.</b> Without it the chain answers 403 before authentication is ever reached, and a
	 * case asserting „somebody not signed in is refused" would be green while measuring the
	 * wrong refusal entirely - the same shape of false pass this project has written down
	 * elsewhere.
	 */
	private MockHttpServletRequestBuilder asking(String email, MockHttpServletRequestBuilder what) {
		what.with(csrf());

		return email == null ? what
				: what.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private int take(String email, long id) throws Exception {
		return http.perform(asking(email, post(hold(id)))).andReturn().getResponse().getStatus();
	}

	private int letGo(String email, long id) throws Exception {
		return http.perform(asking(email, delete(hold(id)))).andReturn().getResponse().getStatus();
	}

	private int answer(String email, long id, boolean approved, String reason) throws Exception {
		String body = reason == null
				? "{\"approved\":" + approved + "}"
				: "{\"approved\":" + approved + ",\"reason\":\"" + reason + "\"}";

		return http.perform(asking(email, post(decision(id)))
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andReturn().getResponse().getStatus();
	}

	private String stateOf(long id) {
		return db.sql("select state from verification where id = ?")
				.param(id).query(String.class).single();
	}

	private long heldBy(long id) {
		return db.sql("select held_by from verification_lock where verification_id = ?")
				.param(id).query(Long.class).single();
	}

	private int holdsOn(long id) {
		return db.sql("select count(*) from verification_lock where verification_id = ?")
				.param(id).query(Integer.class).single();
	}

	private long accountOf(String email) {
		return db.sql("select id from account where email = ?")
				.param(email).query(Long.class).single();
	}

	private long memberId(String number) {
		return db.sql("select id from competitor where member_number = ?")
				.param(number).query(Long.class).single();
	}

	private void account(String email, String role, String first, String last, String member) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values (?, ?, ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(first, last, email, role, member).update();

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

	private void member(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, String.format("%016x", ++issued))
				.update();
	}

	private long photograph() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)"
						+ " returning id")
				.param(String.format("%064x", ++issued))
				.query(Long.class).single();
	}

	private long waiting(String queue, String memberNumber, String subject, String body,
			Long photograph) {
		return db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values (?, (select id from competitor where member_number = ?), ?, ?, ?)"
						+ " returning id")
				.params(queue, memberNumber, subject, body, photograph)
				.query(Long.class).single();
	}

	private long waitingAboutNobody(String queue, String subject) {
		return db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values (?, null, ?, '') returning id")
				.params(queue, subject)
				.query(Long.class).single();
	}

	private long decided(String queue, String memberNumber, String subject, String state,
			String reason) {
		return db.sql("insert into verification (queue, competitor_id, subject, body, state,"
						+ " decided_at, decided_by_name, reason)"
						+ " values (?, (select id from competitor where member_number = ?), ?, '', ?,"
						+ " now(), 'Neko Drugi', ?) returning id")
				.params(queue, memberNumber, subject, state, reason)
				.query(Long.class).single();
	}

	private long teamProposalWaitingFor(String memberNumber, String name) {
		long proposal = db.sql("insert into team_proposal (competitor_id, name, bio, link, place_id)"
						+ " values ((select id from competitor where member_number = ?), ?,"
						+ " 'Devet ljudi iz Zajecara', '', (select id from place where rank = 1))"
						+ " returning id")
				.params(memberNumber, name)
				.query(Long.class).single();

		return db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " team_proposal_id) values ('teams',"
						+ " (select id from competitor where member_number = ?), ?, '', ?)"
						+ " returning id")
				.params(memberNumber, name, proposal)
				.query(Long.class).single();
	}
}
