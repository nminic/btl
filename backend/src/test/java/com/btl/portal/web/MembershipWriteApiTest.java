package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * THE ADMINISTRATION FREEING SOMEBODY OF THE FEE, END TO END.
 *
 * <p><b>THE FIXTURE IS BUILT SO THAT NO ASSERTION CAN BE SATISFIED BY THE WRONG SOURCE, and
 * every axis below was counted rather than felt.</b>
 *
 * <ul>
 * <li><b>Three competitors, and the one these cases are about is SECOND by id.</b> A route
 * that freed the first row it found, or every row, would pass against one man and against a
 * man created first. The other two are asserted untouched.
 * <li><b>Three accounts</b>: the superadmin, a moderator holding {@code queue:payments}, and a
 * moderator holding only a different tick. „Signed in" and „allowed" are therefore never the
 * same fact, and the trail is asserted to name the moderator who asked and not the only
 * account in the fixture.
 * <li><b>Three moments of the clock</b>, because the season is the axis with TWO divergences
 * and one moment closes only one of them. In June 2027 {@code seasonBeingPaidFor} is 2027
 * while {@code transfersTakeEffect} is 2028; in October 2027 it is 2028 while
 * {@code seasonBeingRun} is 2027; in October 2026 it is 2027 while {@code seasonBeingRun} is
 * 2026, a season {@code membership_season_not_before_the_league} refuses outright. A file
 * with one moment lets one of the two replacements pass.
 * <li><b>One man already free of the fee for ANOTHER season</b>, so „he has a membership" and
 * „he has one for THIS season" can never stand in for each other.
 * <li><b>One man who already carries a number</b>, so „drew a number" and „kept his number"
 * are two different people rather than one row read twice.
 * </ul>
 *
 * <p>Authorisation itself - a stranger, a plain competitor, every route the door decides - is
 * the generic floor {@code RightsAtTheDoorTest} derives from the dispatcher. What is here is
 * the pair that is this route's own: the tick that opens it, and one moderator holding a
 * different tick, for defence in depth.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MembershipWriteApiTest {

	/** 11:00 in Belgrade, mid season: {@code seasonBeingPaidFor} 2027, {@code transfersTakeEffect} 2028. */
	private static final Instant IN_JUNE_2027 = Instant.parse("2027-06-15T09:00:00Z");

	/** Inside the renewal window: what is on sale is 2028 while the season being RUN is 2027. */
	private static final Instant IN_OCTOBER_2027 = Instant.parse("2027-10-15T09:00:00Z");

	/**
	 * The fortnight before the portal opens, PDL:806: the owner opens the first profiles and
	 * frees them of the fee for 2027. The season being run is 2026, which is not a season.
	 */
	private static final Instant IN_OCTOBER_2026 = Instant.parse("2026-10-15T09:00:00Z");

	private static final String CASHIER = "blagajnik@primer.rs";

	private static final String OTHER_MODERATOR = "bez-prava@primer.rs";

	private static final String SUPERADMIN = "vlasnik@primer.rs";

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	/** The same shape {@code PricingWriteApiTest} uses, and it reports UTC for the same reason. */
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
			return new AClockTheCaseMoves(IN_JUNE_2027);
		}
	}

	private String cashierCookie;

	private String otherModeratorCookie;

	private String superadminCookie;

	/** The man these cases are about: no number, not active, created SECOND. */
	private long him;

	/** Created first, so nothing may pass by finding the earliest row. */
	private long whoPays;

	/** Already free of the fee, for ANOTHER season, and already carrying a number. */
	private long alreadyFreeElsewhere;

	@BeforeEach
	void threeCompetitorsAndThreeAccounts() {
		clock.moveTo(IN_JUNE_2027);

		cashierCookie = account(CASHIER, "moderator", "Blagajnik", "Probic");
		ticked(CASHIER, "queue:payments");

		otherModeratorCookie = account(OTHER_MODERATOR, "moderator", "Drugi", "Probic");
		ticked(OTHER_MODERATOR, "entity:events");

		superadminCookie = account(SUPERADMIN, "superadmin", "Vlasnik", "Probic");

		whoPays = competitor("c1", "009001", true, "payment");
		him = competitor("c2", null, false, "payment");
		alreadyFreeElsewhere = competitor("c3", "009003", true, "feeExempt");

		freeOfTheFee(alreadyFreeElsewhere, 2029);
	}

	private String account(String email, String role, String first, String last) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " (?, ?, ?, (select id from role where code = ?))")
				.params(first, last, email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private long competitor(String referralSuffix, String memberNumber, boolean active, String basis) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni',"
						+ " 'Takmicar', 'M', date '1990-05-15', " + A_TOWN + ", null, null, 2027,"
						+ " false, ?, ?, ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(memberNumber, active, basis, "00112233445566" + referralSuffix)
				.query(Long.class).single();
	}

	/** An exemption already standing, with the trail {@code V35} requires of one. */
	private void freeOfTheFee(long competitorId, int season) {
		db.sql("insert into membership (competitor_id, season, basis, payment_id,"
						+ " decided_by, decided_by_name, decided_at) values (?, ?, 'feeExempt', null,"
						+ " (select id from account where email = ?), 'Blagajnik Probic', ?)")
				.params(competitorId, season, CASHIER, Timestamp.from(IN_JUNE_2027)).update();
	}

	private MockHttpServletResponse grant(Long competitorId, String cookie) throws Exception {
		return http.perform(post("/api/memberships").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content(mapper.writeValueAsString(new MembershipWriteApi.Grant(competitorId))))
				.andReturn().getResponse();
	}

	private MembershipWriteApi.Granted granted(MockHttpServletResponse answer) throws Exception {
		return mapper.readValue(answer.getContentAsString(), MembershipWriteApi.Granted.class);
	}

	private String refusal(MockHttpServletResponse answer) throws Exception {
		return mapper.readValue(answer.getContentAsString(), MembershipWriteApi.Refused.class).reason();
	}

	private long membershipCount() {
		return db.sql("select count(*) from membership").query(Long.class).single();
	}

	private String competitorRow(long id) {
		return db.sql("select coalesce(member_number, 'none') || ' ' || active || ' ' || membership_basis"
						+ " from competitor where id = ?")
				.param(id).query(String.class).single();
	}

	/**
	 * A MEMBER IS FREED OF THE FEE, NUMBERED AND ACTIVATED, IN ONE ANSWER.
	 *
	 * <p>PDL:760: „Aktivacija clanstva - evidentirana uplata ili [oslobodjenje], cime clan
	 * dobija clanski broj i postaje punopravan." PDL:808 says the same of him in the other
	 * direction: „punopravan, ima clanski broj i pravo rangiranja, i razlikuje se u
	 * EVIDENCIJI, ne u pravima."
	 *
	 * <p><b>Both homes of the basis are read back, and the two OTHER competitors are read back
	 * too.</b> An update with no {@code where} would satisfy every assertion about him.
	 */
	@Test
	void aMemberIsFreedOfTheFeeNumberedAndActivated() throws Exception {
		MockHttpServletResponse answer = grant(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		MembershipWriteApi.Granted body = granted(answer);

		assertThat(body.competitorId()).isEqualTo(him);
		assertThat(body.season()).isEqualTo(2027);
		assertThat(body.memberNumber()).matches("^[0-9]{6}$");

		assertThat(competitorRow(him))
				.as("the per-person home of the basis, the number and the flag every public"
						+ " reader ends on, all three off the row itself")
				.isEqualTo(body.memberNumber() + " true feeExempt");

		assertThat(db.sql("select basis, payment_id, decided_by_name, decided_at from membership"
						+ " where competitor_id = ? and season = 2027").param(him)
						.query((row, i) -> row.getString(1) + " " + row.getObject(2) + " "
								+ row.getString(3) + " " + row.getTimestamp(4)).single())
				.as("the season home of the basis, with the trail V35 asks for")
				.isEqualTo("feeExempt null Blagajnik Probic " + Timestamp.from(IN_JUNE_2027));

		assertThat(db.sql("select decided_by = (select id from account where email = ?)"
						+ " from membership where competitor_id = ? and season = 2027")
						.params(CASHIER, him).query(Boolean.class).single())
				.as("the trail named an account other than the one that asked; three accounts"
						+ " exist here exactly so that it cannot be the only one")
				.isTrue();

		assertThat(competitorRow(whoPays)).as("somebody else was freed of the fee as well")
				.isEqualTo("009001 true payment");
		assertThat(competitorRow(alreadyFreeElsewhere)).as("somebody else was touched")
				.isEqualTo("009003 true feeExempt");
	}

	/**
	 * A MAN WHO ALREADY CARRIES A NUMBER KEEPS IT, AND ANOTHER SEASON DOES NOT BLOCK THIS ONE.
	 *
	 * <p>PDL, 11.08.2026: „Clanski broj ostaje zauvek vezan za tu osobu." And the second half
	 * is the replacement of a SOURCE: he holds an exemption for 2029 already, so a route that
	 * asked „does he hold one at all" rather than „for this season" answers 200 here and never
	 * writes the row this case reads.
	 */
	@Test
	void heKeepsTheNumberHeHasAndTheSeasonHeAlreadyHoldsDoesNotBlockThisOne() throws Exception {
		MockHttpServletResponse answer = grant(alreadyFreeElsewhere, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(granted(answer).memberNumber()).isEqualTo("009003");
		assertThat(granted(answer).season()).isEqualTo(2027);

		assertThat(db.sql("select season from membership where competitor_id = ? order by season")
						.param(alreadyFreeElsewhere).query(Integer.class).list())
				.as("the season he already held was overwritten instead of a second one added")
				.containsExactly(2027, 2029);
	}

	/**
	 * THE SEASON IS THE ONE ON SALE, AND IN THE RENEWAL WINDOW THAT IS NEXT YEAR.
	 *
	 * <p>This is the replacement that {@link com.btl.portal.domain.season.SeasonClock#seasonBeingRun}
	 * would survive in June and does not survive here: on 15 October 2027 what is on sale is
	 * 2028 while the season being run is 2027.
	 */
	@Test
	void insideTheRenewalWindowTheSeasonIsTheNextOne() throws Exception {
		clock.moveTo(IN_OCTOBER_2027);

		MockHttpServletResponse answer = grant(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(granted(answer).season()).isEqualTo(2028);

		assertThat(db.sql("select count(*) from membership where competitor_id = ? and season = 2028")
				.param(him).query(Long.class).single()).isEqualTo(1);
	}

	/**
	 * AND BEFORE THE LEAGUE HAS A SEASON AT ALL, IT IS THE FIRST ONE.
	 *
	 * <p>PDL:806, the fortnight before the portal opens: the owner frees the first profiles of
	 * the fee for 2027. {@code seasonBeingRun} answers 2026 on this day, and
	 * {@code membership_season_not_before_the_league} (V22) takes nothing before 2027 - so this
	 * case does not merely answer a different year under that replacement, it answers 500.
	 */
	@Test
	void beforeTheLeagueHasASeasonTheAnswerIsTheFirstOne() throws Exception {
		clock.moveTo(IN_OCTOBER_2026);

		MockHttpServletResponse answer = grant(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(granted(answer).season()).isEqualTo(2027);
	}

	/**
	 * FREEING THE SAME MAN TWICE IS HARMLESS AND DRAWS NO SECOND NUMBER.
	 *
	 * <p>The reason {@code RecordingAPayment} gives for its own repeat: „Recording the same
	 * payment twice must be harmless." Here the human shape of it is a moderator working down a
	 * list the owner is reading to him and clicking one row twice. The sequence only counts up,
	 * so a second draw would spend his first number for good.
	 */
	@Test
	void freeingHimTwiceIsHarmlessAndDrawsNoSecondNumber() throws Exception {
		MockHttpServletResponse first = grant(him, cashierCookie);
		String number = granted(first).memberNumber();

		long rowsAfterTheFirst = membershipCount();

		MockHttpServletResponse second = grant(him, cashierCookie);

		assertThat(second.getStatus()).as("the second click was not the harmless answer").isEqualTo(200);
		assertThat(granted(second).memberNumber()).isEqualTo(number);
		assertThat(granted(second).season()).isEqualTo(2027);

		assertThat(membershipCount()).as("a second row was written for one season")
				.isEqualTo(rowsAfterTheFirst);
		assertThat(competitorRow(him)).isEqualTo(number + " true feeExempt");
	}

	/**
	 * A FEE THAT HAS BEEN RECORDED IS NOT FORGIVEN QUIETLY.
	 *
	 * <p>He paid. Writing an exemption over that would replace a membership held on money with
	 * one held on a decision, and nothing would be left saying the money had arrived - the
	 * mirror of what {@code PaymentApi} refuses in the other direction. Between the two, the
	 * act that comes second is always refused and {@code membership_pk} is never met.
	 */
	@Test
	void aRecordedFeeIsNotForgivenQuietly() throws Exception {
		long paymentId = db.sql("insert into payment (competitor_id, season, reference, price_row_id,"
						+ " amount, currency, fee, method, state, recorded_at, recorded_by,"
						+ " recorded_by_name) values (?, 2027, '20270091',"
						+ " (select id from price_row where key = 'season'), 35.00, 'EUR', 3.00,"
						+ " 'card', 'recorded', ?, (select id from account where email = ?),"
						+ " 'Blagajnik Probic') returning id")
				.params(him, Timestamp.from(IN_JUNE_2027), CASHIER).query(Long.class).single();

		db.sql("insert into membership (competitor_id, season, basis, payment_id)"
				+ " values (?, 2027, 'payment', ?)").params(him, paymentId).update();

		MockHttpServletResponse answer = grant(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(refusal(answer)).isEqualTo(MembershipWriteApi.THE_FEE_IS_ALREADY_RECORDED);

		assertThat(db.sql("select basis from membership where competitor_id = ? and season = 2027")
						.param(him).query(String.class).single())
				.as("a recorded fee was quietly turned into an exemption").isEqualTo("payment");
		assertThat(competitorRow(him)).as("a refused grant changed the competitor anyway")
				.isEqualTo("none false payment");
	}

	/**
	 * AND A REVERSED PAYMENT IS NOT SETTLED HERE EITHER.
	 *
	 * <p>PDL, 11.08.2026: „Stornirana uplata: clanski broj propada, clan postaje neaktivan za
	 * tu sezonu." There is no membership row in this fixture - a reversal leaves none - so
	 * nothing but this guard stands between one click and a reversal that stops having
	 * happened.
	 */
	@Test
	void aReversedPaymentIsNotSettledHereEither() throws Exception {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount,"
						+ " currency, fee, method, state, recorded_at, recorded_by, recorded_by_name)"
						+ " values (?, 2027, '20270092',"
						+ " (select id from price_row where key = 'season'), 35.00, 'EUR', 3.00,"
						+ " 'card', 'reversed', ?, null, 'Blagajnik Probic')")
				.params(him, Timestamp.from(IN_JUNE_2027)).update();

		MockHttpServletResponse answer = grant(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(refusal(answer)).isEqualTo(MembershipWriteApi.THE_PAYMENT_WAS_REVERSED);

		assertThat(db.sql("select count(*) from membership where competitor_id = ?").param(him)
				.query(Long.class).single()).as("a reversal was settled by an exemption").isZero();
		assertThat(competitorRow(him)).isEqualTo("none false payment");
	}

	/**
	 * AND AN AWAITED PAYMENT IS NOT A REVERSAL, which is the replacement of the SOURCE for the
	 * case above.
	 *
	 * <p>A man sitting in the queue with nobody having said the money came is exactly the man
	 * this route exists for - {@code V16}'s {@code default 'awaited'} is that row. A guard
	 * written as „is there a payment" rather than „was one reversed" would refuse him, which is
	 * the whole population the screen is drawn for.
	 */
	@Test
	void anAwaitedPaymentIsNotAReversalAndDoesNotStandInTheWay() throws Exception {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount,"
						+ " currency, fee, method, state) values (?, 2027, '20270093',"
						+ " (select id from price_row where key = 'season'), 35.00, 'EUR', 3.00,"
						+ " 'card', 'awaited')")
				.param(him).update();

		MockHttpServletResponse answer = grant(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(granted(answer).season()).isEqualTo(2027);
	}

	/**
	 * THE ANSWER NEVER CARRIES THE BASIS, AND THAT IS A PRIVACY RULE RATHER THAN A PREFERENCE.
	 *
	 * <p>PDL:810, 28.07.2026: „Osnov clanstva se nikad ne prikazuje javno... Vide ga samo
	 * Superadmin i moderatori sa pravom nad clanovima." The tick that opens this route is
	 * {@code queue:payments}, which is NOT {@code entity:members} - so the moderator who
	 * creates the basis here may not read it, and the answer must not hand it to him.
	 *
	 * <p>Read over the whole body rather than field by field, so it refuses the word however it
	 * is spelt and whatever key it might arrive under.
	 */
	@Test
	void theAnswerNeverCarriesTheBasis() throws Exception {
		MockHttpServletResponse answer = grant(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(answer.getContentAsString())
				.as("the route handed back a fact read under entity:members to a caller holding"
						+ " only queue:payments")
				.doesNotContain("feeExempt").doesNotContain("basis");
	}

	/**
	 * THE MODERATOR'S ACCOUNT MAY GO AND THE EXEMPTION STAYS, WITH HIS NAME ON IT.
	 *
	 * <p><b>This case exists because a mutation survived without it, and the mutation was the
	 * one trap V9 had already paid for.</b> Written over {@code decided_by} instead of
	 * {@code decided_by_name}, {@code membership_free_of_the_fee_says_who} contradicts its own
	 * foreign key: {@code ON DELETE SET NULL} empties the pointer of every membership that
	 * account ever entered, and the check then refuses exactly that - so deleting the account
	 * would fail outright. The series found that swap passing, because nothing here had ever
	 * deleted such an account. V9's own comment records the same finding from 11.09.2026, and
	 * the schema half was copied correctly; what was missing was the case.
	 *
	 * <p>PDL P23 is what makes it a promise rather than a detail: a moderator has the same right
	 * to have his account deleted as anybody else. The exemption WAS given, it stays given, and
	 * it says by whom - which is the whole reason the name is a column beside the pointer.
	 */
	@Test
	void theAccountThatEnteredItMayGoAndTheExemptionKeepsHisName() throws Exception {
		assertThat(grant(him, cashierCookie).getStatus()).isEqualTo(201);

		db.sql("delete from account where email = ?").param(CASHIER).update();

		assertThat(db.sql("select decided_by, decided_by_name from membership"
						+ " where competitor_id = ? and season = 2027").param(him)
						.query((row, i) -> row.getObject(1) + " " + row.getString(2)).single())
				.as("the pointer was meant to empty and the name to stay")
				.isEqualTo("null Blagajnik Probic");

		assertThat(competitorRow(him)).as("deleting the moderator undid the exemption itself")
				.matches("^[0-9]{6} true feeExempt$");
	}

	/** The superadmin passes by holding every right there is (V5, {@code rights_mode = 'all'}). */
	@Test
	void theSuperadminMayFreeSomebodyToo() throws Exception {
		MockHttpServletResponse answer = grant(him, superadminCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(db.sql("select decided_by_name from membership where competitor_id = ?"
						+ " and season = 2027").param(him).query(String.class).single())
				.as("the trail named somebody other than whoever actually asked")
				.isEqualTo("Vlasnik Probic");
		assertThat(db.sql("select decided_by = (select id from account where email = ?)"
						+ " from membership where competitor_id = ? and season = 2027")
						.params(SUPERADMIN, him).query(Boolean.class).single())
				.as("the pointer named the account that asked, not the lowest id in the"
						+ " fixture (the cashier, created first in @BeforeEach)")
				.isTrue();
	}

	/**
	 * A MODERATOR HOLDING A DIFFERENT TICK IS REFUSED, AND THE NUMBER IS 404.
	 *
	 * <p>ADL A8 and the owner's one word answer of 13.09.2026: a moderator without the right
	 * gets the answer an address that is not there would give, because he must not learn the
	 * action exists. Defence in depth beside {@code RightsAtTheDoorTest}, which asks this of
	 * every guarded route rather than of the one somebody remembered.
	 */
	@Test
	void aModeratorHoldingADifferentTickIsRefused() throws Exception {
		MockHttpServletResponse answer = grant(him, otherModeratorCookie);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(membershipCount()).as("a refused moderator still wrote a membership").isEqualTo(1);
		assertThat(competitorRow(him)).isEqualTo("none false payment");
	}

	/** The form has one field and it is the whole of it. */
	@Test
	void theFormMustNameACompetitor() throws Exception {
		MockHttpServletResponse answer = grant(null, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(refusal(answer)).isEqualTo(MembershipWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(membershipCount()).isEqualTo(1);
	}

	/** And he has to exist, which is {@code competitor.id} and never a member number. */
	@Test
	void theCompetitorMustExist() throws Exception {
		MockHttpServletResponse answer = grant(999999L, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(refusal(answer)).isEqualTo(MembershipWriteApi.THE_COMPETITOR_DOES_NOT_EXIST);
		assertThat(membershipCount()).isEqualTo(1);
	}
}
