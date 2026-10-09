package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
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
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
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
 * <li><b>The account that belongs to the MEMBER himself is made by the cases that need it</b>,
 * and it is never a moderator's unless the case is the one about a moderator approving
 * himself. So „who pressed" and „whose membership it is" are two different people, with two
 * different names, in every case but that one - which says so in its name.
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

	/** {@code rank = 1} is Shanghai, so the default member of this file is billed in EURO. */
	private static final String A_TOWN = "(select id from place where rank = 1)";

	/**
	 * THE FIRST SERBIAN TOWN THE CODEBOOK OFFERS, so the currency axis has both its states.
	 *
	 * <p>Since V42 a member's country picks the column of the price list his fee is read from AND the
	 * lines of the book that are his balance (owner, 27.09.2026, PDL 25), so a file in which everybody
	 * lives abroad measures one state of a fact this route turns on. Asked as a query rather than by rank
	 * number for the reason V3 gives: {@code rank} is „a position in a file and not a fact about a town".
	 */
	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

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

	/**
	 * THE SAME MEMBER IN A NAMED TOWN, for the cases that are about the money his country decides.
	 *
	 * <p>A second helper rather than a parameter on the first, so that the twenty cases which have
	 * nothing to do with a currency stay exactly the shape they were.
	 */
	private long competitorIn(String town, String memberNumber) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni',"
						+ " 'Takmicar', 'M', date '1990-05-15', " + town + ", null, null, 2027,"
						+ " false, false, 'payment', ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(memberNumber, "0011223344" + memberNumber)
				.query(Long.class).single();
	}

	/** An exemption already standing, with the trail {@code V35} requires of one. */
	private void freeOfTheFee(long competitorId, int season) {
		db.sql("insert into membership (competitor_id, season, basis, payment_id,"
						+ " decided_by, decided_by_name, decided_at) values (?, ?, 'feeExempt', null,"
						+ " (select id from account where email = ?), 'Blagajnik Probic', ?)")
				.params(competitorId, season, CASHIER, Timestamp.from(IN_JUNE_2027)).update();
	}

	/**
	 * THE TWO GROUNDS ARE NAMED AT EVERY CALL SITE AND NEITHER IS A DEFAULT, which is the point of
	 * there being two named helpers over one builder rather than one helper with a fallback.
	 *
	 * <p>A helper that filled the ground in when a case did not say it would make the ground
	 * INVISIBLE along its own axis: every case here would read as though it were about the
	 * exemption, and a route that ignored the field and always granted one would pass all of them.
	 */
	private static final String FREE_OF_THE_FEE = "feeExempt";

	private static final String FROM_THE_BALANCE = "balance";

	private MockHttpServletResponse freeHim(Long competitorId, String cookie) throws Exception {
		return onTheGroundOf(competitorId, FREE_OF_THE_FEE, cookie);
	}

	private MockHttpServletResponse fromHisBalance(Long competitorId, String cookie) throws Exception {
		return onTheGroundOf(competitorId, FROM_THE_BALANCE, cookie);
	}

	private MockHttpServletResponse onTheGroundOf(Long competitorId, String ground, String cookie)
			throws Exception {
		return http.perform(post("/api/memberships").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content(mapper.writeValueAsString(
								new MembershipWriteApi.Grant(competitorId, ground))))
				.andReturn().getResponse();
	}

	/**
	 * ONE REFERRAL EARNED, so the member has a book to spend.
	 *
	 * <p><b>It is written as a REFERRAL and not as a bare credit</b>, because
	 * {@code balance_entry_reason_known} (V38) knows two reasons and
	 * {@code balance_entry_a_referral_adds} demands both currencies be money - so this is the only
	 * shape in which a balance can come to exist at all, which is worth meeting here rather than
	 * inventing a row the portal could never write.
	 *
	 * @param amount   how much, and it is written here rather than read off the price list so that a
	 *                 case can compose a book on either side of the fee
	 * @param currency the money the REFERRER is billed in, because since V42 a line in any other money
	 *                 is not his balance at all. It is a parameter rather than a constant because this
	 *                 file measures both sides of the country axis
	 */
	private void earnedAReferral(long competitorId, long broughtIn, String amount, String currency) {
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
						+ " referred_competitor_id, occurred_at, recorded_by_name)"
						+ " values (?, ?::numeric, ?, 'referral', ?, ?, 'Neko Ko Je Knjizio')")
				.params(competitorId, amount, currency, broughtIn, Timestamp.from(IN_JUNE_2027))
				.update();
	}

	/*
	 * A HELPER THAT COMPOSED A BOOK OUT OF TWO LEGAL ROWS STOOD HERE, `spentOnAnEarlierMembership`,
	 * and it goes with V42 rather than being left unused.
	 *
	 * It existed for exactly one state and that state no longer exists. While a balance was a PAIR,
	 * `balance_entry_a_referral_adds` demanded BOTH currencies of a referral be strictly positive, so
	 * 15.00 EUR / 0.00 RSD was not a row this table could hold - it could only be a SUM, of a referral
	 * and a spend that did not share the referral row's ratio. Two cases below used it, and both are
	 * gone for the same reason: the owner decided on 27.09.2026 (PDL 25) that a balance is one amount
	 * in one money, so there is no second currency left to be nothing while the first is not.
	 */

	private MembershipWriteApi.Granted granted(MockHttpServletResponse answer) throws Exception {
		return mapper.readValue(answer.getContentAsString(), MembershipWriteApi.Granted.class);
	}

	private String refusal(MockHttpServletResponse answer) throws Exception {
		return mapper.readValue(answer.getContentAsString(), MembershipWriteApi.Refused.class).reason();
	}

	private long membershipCount() {
		return db.sql("select count(*) from membership").query(Long.class).single();
	}

	/**
	 * ONE PRICE OF THE LIST, asked of the list and never written here, for the reason ADL A12 gives:
	 * a case that repeated a price would be a second home for it.
	 */
	private BigDecimal priceOf(String key, String column) {
		return db.sql("select " + column + " from price_row where key = ?")
				.param(key).query(BigDecimal.class).single();
	}

	private long accountId(String email) {
		return db.sql("select id from account where email = ?").param(email).query(Long.class).single();
	}

	/**
	 * AN ACCOUNT THAT BELONGS TO A MEMBER, as against the moderators and the superadmin above, none
	 * of which is anybody's.
	 *
	 * @return its session cookie, so a case can press the button AS that member when it needs to
	 */
	private String anAccountOf(long competitorId, String email, String role, String first, String last) {
		String cookie = account(email, role, first, last);

		db.sql("update account set competitor_id = ? where email = ?").params(competitorId, email).update();

		return cookie;
	}

	/**
	 * THE TRAIL AS ONE VALUE, so a case asserts who, under what name and when together, and a row
	 * that answers right about two of the three cannot pass half of a case.
	 *
	 * @param by   the account that pressed the button, or {@code null} once that account is gone
	 * @param name the name it carried, which outlives the account
	 * @param at   the moment, off the clock these cases move
	 */
	private record Trail(Long by, String name, Timestamp at) {
	}

	/** Nobody forgave anything, so all three columns are empty. */
	private static final Trail NO_TRAIL = new Trail(null, null, null);

	private Trail trailOf(long competitorId, int season) {
		return db.sql("select decided_by, decided_by_name, decided_at from membership"
						+ " where competitor_id = ? and season = ?")
				.params(competitorId, season)
				.query((row, i) -> new Trail((Long) row.getObject(1), row.getString(2), row.getTimestamp(3)))
				.single();
	}

	/** The trail the CASHIER leaves when he presses a button in June 2027: his account, his name, the minute. */
	private Trail theCashiersTrail() {
		return new Trail(accountId(CASHIER), "Blagajnik Probic", Timestamp.from(IN_JUNE_2027));
	}

	/** A body written out by hand, for the cases that send more than {@link MembershipWriteApi.Grant} knows. */
	private MockHttpServletResponse withThisBody(String json, String cookie) throws Exception {
		return http.perform(post("/api/memberships").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json))
				.andReturn().getResponse();
	}

	/**
	 * One member's book as readable lines, or the words for none.
	 *
	 * <p>Read back with the REASON and the MEMBER BROUGHT IN in the string rather than as a sum: a sum
	 * is satisfied by a line of the right size written for the wrong person, and who a reward names is
	 * the whole of {@code balance_entry_one_a_referral}.
	 */
	private String bookOf(long competitorId) {
		return db.sql("select coalesce(string_agg(reason || ' ' || amount || ' ' || currency"
						+ " || ' for ' || coalesce(referred_competitor_id::text, 'nobody'), ', '),"
						+ " 'no lines') from balance_entry where competitor_id = ?")
				.param(competitorId).query(String.class).single();
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
		MockHttpServletResponse answer = freeHim(him, cashierCookie);

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
	 * WHOEVER BROUGHT HIM IN IS PAID WHEN THE ADMINISTRATION FREES HIM OF THE FEE, which is the
	 * third of the three doors onto this portal and the one that was not paying.
	 *
	 * <p><b>Owner, 13.08.2026, in as many words:</b> „OK je da se za preporuku dobije balans cak
	 * i ako je preporucen clan dobio pocasnu aktivaciju." PDL ties the reward to ACTIVATION -
	 * „Iznos leze na balans automatski, u trenutku kad se novom clanu aktivira clanarina" - and it
	 * says nothing at all about how the season was paid for.
	 *
	 * <p><b>WHAT WAS MEASURED BEFORE THIS CASE EXISTED.</b> {@code insert into membership} stood in
	 * THREE places and {@code aReferralWasActivated} was called from two. The grant answered 201,
	 * the referrer's book stayed empty, and the same man through the payments door answered 409 - so
	 * the reward was not merely late but <b>lost for good</b>, because nothing may settle one season
	 * twice. Two sentences in this branch claimed otherwise: {@code BalanceBook} said it was called
	 * from „every place a membership is activated", and V38's carry said such a referral would be
	 * rewarded by this route „the day it exists" - and the route existed already.
	 *
	 * <p><b>THE REFERRER IS NEITHER THE SUBJECT NOR THE FIRST ROW.</b> He is created LAST, and the
	 * first competitor's book is asserted empty beside him, so a route crediting a fixed or earliest
	 * competitor fails here instead of coinciding. The whole table is counted too, so one activation
	 * writing more than one line is caught.
	 */
	@Test
	void whoeverBroughtHimInIsPaidWhenTheAdministrationFreesHimOfTheFee() throws Exception {
		/* Created LAST, so nothing may pass by crediting the earliest competitor - `whoPays` is the
		   first row and his book is asserted empty below for exactly that reason. */
		long whoBroughtHimIn = competitor("c4", "009004", true, "payment");
		db.sql("update competitor set referred_by = ? where id = ?").params(whoBroughtHimIn, him).update();

		assertThat(bookOf(whoBroughtHimIn))
				.as("a line stood before the grant, so nothing below is about the grant")
				.isEqualTo("no lines");

		assertThat(freeHim(him, cashierCookie).getStatus()).isEqualTo(201);

		assertThat(bookOf(whoBroughtHimIn))
				.as("the reward for bringing in a member freed of the fee was lost, and lost for good:"
						+ " the paying door refuses a man who already holds the season")
				.isEqualTo("referral 5.00 EUR for " + him);

		assertThat(bookOf(whoPays))
				.as("the reward went to the first competitor in the table rather than to the man who"
						+ " actually brought him in")
				.isEqualTo("no lines");

		assertThat(db.sql("select count(*) from balance_entry").query(Long.class).single())
				.as("more than one line was written for one activation")
				.isOne();
	}

	/**
	 * AND THE MAN NOBODY BROUGHT IN EARNS NOBODY ANYTHING, which is most of them.
	 *
	 * <p>The pair to the case above and not a repetition of it: that one proves a reward IS written,
	 * this one proves the writing is conditional on somebody having brought him in rather than
	 * happening to every grant. Without it, a route that credited a fixed competitor - or every
	 * competitor - would pass the case above.
	 */
	@Test
	void amemberNobodyBroughtInEarnsNobodyAnythingWhenHeIsFreed() throws Exception {
		assertThat(freeHim(him, cashierCookie).getStatus()).isEqualTo(201);

		assertThat(db.sql("select count(*) from balance_entry").query(Long.class).single())
				.as("a reward was written for an activation nobody had referred")
				.isZero();
	}

	/**
	 * AND A SECOND SEASON FREE OF THE FEE EARNS HIS REFERRER NOTHING FURTHER, which is
	 * {@code balance_entry_one_a_referral} (V38) holding rather than a question this route asks.
	 *
	 * <p>PDL ties the reward to bringing somebody in, once, however many seasons he goes on to hold.
	 * The second grant is for a DIFFERENT season, because the same one answers 200 and writes nothing
	 * at all - which would make this case measure that instead.
	 */
	@Test
	void asecondSeasonFreeOfTheFeeEarnsTheReferrerNothingFurther() throws Exception {
		long whoBroughtHimIn = competitor("c4", "009004", true, "payment");
		db.sql("update competitor set referred_by = ? where id = ?").params(whoBroughtHimIn, him).update();

		assertThat(freeHim(him, cashierCookie).getStatus()).isEqualTo(201);

		clock.moveTo(IN_OCTOBER_2027);

		assertThat(freeHim(him, cashierCookie).getStatus())
				.as("the next season was not a fresh grant, so this case is not about a second one")
				.isEqualTo(201);

		assertThat(bookOf(whoBroughtHimIn))
				.as("the referrer was paid twice for one member brought in")
				.isEqualTo("referral 5.00 EUR for " + him);
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
		MockHttpServletResponse answer = freeHim(alreadyFreeElsewhere, cashierCookie);

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

		MockHttpServletResponse answer = freeHim(him, cashierCookie);

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

		MockHttpServletResponse answer = freeHim(him, cashierCookie);

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
		MockHttpServletResponse first = freeHim(him, cashierCookie);
		String number = granted(first).memberNumber();

		long rowsAfterTheFirst = membershipCount();

		MockHttpServletResponse second = freeHim(him, cashierCookie);

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
						+ " recorded_by_name, received) values (?, 2027, '20270091',"
						+ " (select id from price_row where key = 'season'), 35.00, 'EUR', 3.00,"
						+ " 'paypal', 'recorded', ?, (select id from account where email = ?),"
						+ " 'Blagajnik Probic', 38.00) returning id")
				.params(him, Timestamp.from(IN_JUNE_2027), CASHIER).query(Long.class).single();

		db.sql("insert into membership (competitor_id, season, basis, payment_id)"
				+ " values (?, 2027, 'payment', ?)").params(him, paymentId).update();

		MockHttpServletResponse answer = freeHim(him, cashierCookie);

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
						+ " currency, fee, method, state, recorded_at, recorded_by, recorded_by_name,"
						+ " received)"
						+ " values (?, 2027, '20270092',"
						+ " (select id from price_row where key = 'season'), 35.00, 'EUR', 3.00,"
						/* A REVERSAL KEEPS WHAT ARRIVED, for the reason it keeps its day: the money did
						   arrive, and then it went back. */
						+ " 'paypal', 'reversed', ?, null, 'Blagajnik Probic', 38.00)")
				.params(him, Timestamp.from(IN_JUNE_2027)).update();

		MockHttpServletResponse answer = freeHim(him, cashierCookie);

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
						+ " 'paypal', 'awaited')")
				.param(him).update();

		MockHttpServletResponse answer = freeHim(him, cashierCookie);

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
		MockHttpServletResponse answer = freeHim(him, cashierCookie);

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
		assertThat(freeHim(him, cashierCookie).getStatus()).isEqualTo(201);

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
		MockHttpServletResponse answer = freeHim(him, superadminCookie);

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
		MockHttpServletResponse answer = freeHim(him, otherModeratorCookie);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(membershipCount()).as("a refused moderator still wrote a membership").isEqualTo(1);
		assertThat(competitorRow(him)).isEqualTo("none false payment");
	}

	/**
	 * The form has TWO fields since 27.09.2026 and both are required.
	 *
	 * <p>The sentence here said „one field and it is the whole of it", which section 19 overturned:
	 * the prompt has two buttons on it, so the request has to say which was pressed.
	 */
	@Test
	void theFormMustNameACompetitor() throws Exception {
		MockHttpServletResponse answer = freeHim(null, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(refusal(answer)).isEqualTo(MembershipWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(membershipCount()).isEqualTo(1);
	}

	/**
	 * AND IT MUST NAME A GROUND, WITH NO DEFAULT, which is the half that would be expensive to get
	 * wrong.
	 *
	 * <p>A route defaulting to the exemption would hand out a season free of the fee because a field
	 * was misspelled - and the owner's rule over the whole of section 19 is that an exemption is a
	 * deliberate act, „Admin moze da odobri (jednu po jednu) godinu clanarine". Blank and absent are
	 * ONE answer here and both are refused, which is the other half of ADL A54.
	 */
	@ParameterizedTest
	@NullSource
	@ValueSource(strings = { "", "   " })
	void theFormMustNameAGround(String nothing) throws Exception {
		MockHttpServletResponse answer = onTheGroundOf(him, nothing, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(refusal(answer)).isEqualTo(MembershipWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(membershipCount()).isEqualTo(1);
		assertThat(competitorRow(him)).isEqualTo("none false payment");
	}

	/**
	 * AND A GROUND THIS ROUTE DOES NOT GRANT IS REFUSED RATHER THAN FALLING THROUGH TO ONE IT DOES.
	 *
	 * <p><b>{@code payment} is in the list on purpose and it is the valuable one.</b> It is a word
	 * {@code membership_basis_known} really knows, so a route checking „is this one of the schema's
	 * three" instead of „is this one of my two" would let a moderator write a membership standing on
	 * a FEE with no payment row behind it - which {@code membership_basis_says_whether_a_payment_is_named}
	 * (V22) would then refuse with a 500, and which no amount of money having arrived would justify.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "payment", "feeexempt", "FEEEXEMPT", "Balance", "honorary", "pocasni" })
	void agroundThisRouteDoesNotGrantIsRefused(String wrong) throws Exception {
		MockHttpServletResponse answer = onTheGroundOf(him, wrong, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(refusal(answer)).isEqualTo(MembershipWriteApi.THE_GROUND_IS_NOT_KNOWN);
		assertThat(membershipCount()).isEqualTo(1);
		assertThat(competitorRow(him)).isEqualTo("none false payment");
		assertThat(bookOf(him)).isEqualTo("no lines");
	}

	/** And he has to exist, which is {@code competitor.id} and never a member number. */
	@Test
	void theCompetitorMustExist() throws Exception {
		MockHttpServletResponse answer = freeHim(999999L, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(refusal(answer)).isEqualTo(MembershipWriteApi.THE_COMPETITOR_DOES_NOT_EXIST);
		assertThat(membershipCount()).isEqualTo(1);
	}

	/**
	 * CASE 4: HIS BALANCE COVERS THE FEE, SO EXACTLY THE FEE COMES OFF IT.
	 *
	 * <p>Owner, 27.09.2026 (PDL, section 19): with no amount typed, the moderator is offered
	 * „Odobri oslobodjenje od clanarine" / „Odobri iz balansa", and this is the second button.
	 *
	 * <p><b>The book is read back as LINES and not as a sum</b>, for the reason {@link #bookOf}
	 * gives: a sum of the right size is satisfied by a line written for the wrong person or under
	 * the wrong reason. In June 2027 the row that applies is {@code season}, 40 euro, and his referral
	 * was worth more than that - so what is left over stays his, „visak ostaje za sledecu godinu".
	 *
	 * <p><b>He is billed in EURO because this fixture's town is Shanghai</b>, and since V42 that is
	 * what decides the money every number here is in. The dinar side of the same rule has its own case.
	 */
	@Test
	void abalanceThatCoversTheFeeActivatesHimAndTakesExactlyTheFee() throws Exception {
		earnedAReferral(him, whoPays, "50", "EUR");

		MockHttpServletResponse answer = fromHisBalance(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(granted(answer).season()).isEqualTo(2027);
		assertThat(granted(answer).memberNumber()).isNotBlank();

		assertThat(bookOf(him))
				.as("the fee and not the whole book, and the surplus stays his")
				.isEqualTo("referral 50.00 EUR for " + whoPays
						+ ", membership -40.00 EUR for nobody");

		assertThat(membershipOf(him, 2027)).isEqualTo("balance names an entry, no trail");
	}

	/**
	 * CASE 5: HIS BALANCE IS SHORT OF THE FEE AND THE MODERATOR APPROVES IT ANYWAY, so the WHOLE book
	 * comes off.
	 *
	 * <p>Owner, section 19: „Odobri <b>umanjen iznos</b> iz balansa". <b>This is the case that makes
	 * this route's decision a different one from the member's own door</b>, where the identical state
	 * is refused outright ({@code ActivatingFromBalance.THE_BALANCE_IS_NOT_ENOUGH}) because a member
	 * may not hand himself a discount.
	 *
	 * <p><b>AND SINCE V42 THIS IS THE ORDINARY RULE RATHER THAN A SPECIAL ONE, which is worth writing
	 * down because it used to take twenty lines of reasoning to justify.</b> While a balance was a
	 * PAIR, {@code min(balance, fee)} per currency could answer „40 EUR and 600 RSD" for a book of
	 * 50/600 - taking every dinar while leaving ten euro standing, at an implied rate of fifteen to one
	 * that ADL forbids - so this door needed a rule of its own, {@code whatComesOffTheBook}, which was
	 * binary: covered in both, take the fee; otherwise take the whole book. One amount cannot land in
	 * that state, so {@code min} IS „the whole book when it is short", the extra rule is gone, and both
	 * doors now read {@code Balance.Settlement.fromTheBalance()}.
	 */
	@Test
	void abalanceShortOfTheFeeIsApprovedByTheModeratorAndTheWholeBookComesOff() throws Exception {
		earnedAReferral(him, whoPays, "5", "EUR");

		MockHttpServletResponse answer = fromHisBalance(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(bookOf(him))
				.as("all of it, so the book is emptied rather than driven negative")
				.isEqualTo("referral 5.00 EUR for " + whoPays
						+ ", membership -5.00 EUR for nobody");
		assertThat(membershipOf(him, 2027))
				.as("a reduced amount forgives money, so the membership carries the trail (owner,"
						+ " 03.10.2026)")
				.isEqualTo("balance names an entry, trail by Blagajnik Probic");
	}

	/**
	 * A REDUCED AMOUNT LEAVES THE TRAIL OF WHO APPROVED IT, which is the short side of the boundary
	 * the owner's decision draws and the half this route did not carry out until 09.10.2026.
	 *
	 * <p>The owner's decision of 03.10.2026, chosen among the options put to him (PDL P8, the entry
	 * „Trag (ko je odobrio i kada) ide uz svaku radnju koja prasta novac"), names two acts: the
	 * exemption and „Odobri umanjen iznos iz balansa". A balance of 25 against a fee of 40 is the
	 * second: all of it is spent, fifteen is forgiven, and the row says who pressed the button and
	 * when.
	 *
	 * <p><b>The three columns are read as ONE value</b> ({@link Trail}) and the account is the
	 * CASHIER's: three accounts stand in every case of this file, and a fourth in the ones that are
	 * about the member's own, so a trail that named the first account the database holds, the
	 * superadmin or the member would be a different value and not a coincidence. The moment is the
	 * clock these cases move and never the day they happen to run on.
	 *
	 * <p><b>The premise is asserted and not assumed.</b> The fee is the price list's, and a case about
	 * „25 against 40" that went on passing after the list moved would be measuring something else.
	 */
	@Test
	void aReducedAmountFromTheBalanceLeavesTheTrailOfWhoApprovedIt() throws Exception {
		assertThat(priceOf("season", "eur"))
				.as("this case is about 25 against a fee of 40, and the fee is the price list's")
				.isEqualByComparingTo("40");

		earnedAReferral(him, whoPays, "25", "EUR");

		MockHttpServletResponse answer = fromHisBalance(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(bookOf(him))
				.as("every para he had, and not the fee")
				.isEqualTo("referral 25.00 EUR for " + whoPays
						+ ", membership -25.00 EUR for nobody");
		assertThat(trailOf(him, 2027)).isEqualTo(theCashiersTrail());
	}

	/**
	 * A BALANCE ABOVE THE FEE BUT BELOW THE FEE AND THE TAX TOGETHER IS A WHOLE FEE, AND THE ROW HAS NO
	 * TRAIL: the long side of the boundary, where what a member SENDS and what a balance PAYS part.
	 *
	 * <p>41 is above the fee (40) and below the fee plus the processing tax (43), which is the band in
	 * which what a member SENDS and what a balance PAYS come apart. A membership paid out of a balance
	 * moves no money through an intermediary and so carries no tax (PDL, „Clanarina placena iz balansa
	 * ne nosi taksu"): 40 comes off, one stays his, nothing is forgiven and nothing is written. A route
	 * that measured the balance against the fee plus the tax would call this a reduced amount and put a
	 * trail on a membership that cost what it costs.
	 *
	 * <p>The book is asserted as well, because „no trail" is a claim about a press that otherwise did
	 * what a whole fee does: the fee came off and the surplus stayed.
	 */
	@Test
	void aBalanceAboveTheFeeAndBelowTheFeeAndTheTaxIsAWholeFeeAndLeavesNoTrail() throws Exception {
		assertThat(priceOf("season", "eur"))
				.as("this case is about 41 against a fee of 40, and the fee is the price list's")
				.isEqualByComparingTo("40");
		assertThat(priceOf("processing", "eur"))
				.as("and against a tax of 3, which is what puts 41 below the 43 a member sends")
				.isEqualByComparingTo("3");

		earnedAReferral(him, whoPays, "41", "EUR");

		MockHttpServletResponse answer = fromHisBalance(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(bookOf(him))
				.as("the fee and not the balance, and the rest stays his")
				.isEqualTo("referral 41.00 EUR for " + whoPays
						+ ", membership -40.00 EUR for nobody");
		assertThat(trailOf(him, 2027)).isEqualTo(NO_TRAIL);
	}

	/**
	 * Where a balance can stand against the fee and against the fee plus the tax, on both sides of
	 * both and exactly on each, which is the whole of the axis the two cases above name two points of.
	 *
	 * <p>Each position says whether it falls short of THE FEE, and the case below checks that claim
	 * against the price list before it asserts anything else, so a position labelled wrongly cannot
	 * turn the case into a statement about nothing.
	 */
	enum WhereTheBalanceStands {

		ONE_PARA(true, (fee, tax) -> new BigDecimal("0.01")),
		HALF_THE_FEE(true, (fee, tax) -> fee.divide(new BigDecimal("2"))),
		ONE_PARA_UNDER_THE_FEE(true, (fee, tax) -> fee.subtract(new BigDecimal("0.01"))),
		EXACTLY_THE_FEE(false, (fee, tax) -> fee),
		ONE_PARA_OVER_THE_FEE(false, (fee, tax) -> fee.add(new BigDecimal("0.01"))),
		ONE_PARA_UNDER_THE_FEE_AND_THE_TAX(false,
				(fee, tax) -> fee.add(tax).subtract(new BigDecimal("0.01"))),
		EXACTLY_THE_FEE_AND_THE_TAX(false, (fee, tax) -> fee.add(tax)),
		WELL_OVER_BOTH(false, (fee, tax) -> fee.add(tax).add(new BigDecimal("10")));

		final boolean fallsShortOfTheFee;

		private final java.util.function.BinaryOperator<BigDecimal> worked;

		WhereTheBalanceStands(boolean fallsShortOfTheFee,
				java.util.function.BinaryOperator<BigDecimal> worked) {
			this.fallsShortOfTheFee = fallsShortOfTheFee;
			this.worked = worked;
		}

		BigDecimal balance(BigDecimal fee, BigDecimal tax) {
			return worked.apply(fee, tax);
		}
	}

	/**
	 * THE TRAIL IS WRITTEN EXACTLY WHEN THE BALANCE FALLS SHORT OF THE FEE, at every position the
	 * balance can stand in, and what comes off the book is the smaller of the two at every one of them.
	 *
	 * <p><b>One invocation per position and not a loop in one case</b>, for the reason
	 * {@code PaymentApiTest} measured: a loop under a mutation stops at the first position it fails and
	 * the later ones are never measured at all.
	 *
	 * <p><b>Exactly the fee is a whole fee</b> ({@code Balance} says why: a man whose balance is the
	 * fee owes nothing more), and one para under it is not. A comparison written the other way round
	 * passes every position but these two.
	 */
	@ParameterizedTest
	@EnumSource(WhereTheBalanceStands.class)
	void theTrailIsWrittenExactlyWhenTheBalanceFallsShortOfTheFee(WhereTheBalanceStands standing)
			throws Exception {
		BigDecimal fee = priceOf("season", "eur");
		BigDecimal balance = standing.balance(fee, priceOf("processing", "eur"));

		assertThat(balance.compareTo(fee) < 0)
				.as("%s is labelled wrongly against the price list, so this case would assert nothing", standing)
				.isEqualTo(standing.fallsShortOfTheFee);

		earnedAReferral(him, whoPays, balance.toPlainString(), "EUR");

		assertThat(fromHisBalance(him, cashierCookie).getStatus()).isEqualTo(201);

		assertThat(db.sql("select amount from balance_entry where competitor_id = ? and reason = 'membership'")
						.param(him).query(BigDecimal.class).single())
				.as("the book gave up something other than the smaller of the balance and the fee")
				.isEqualByComparingTo(balance.min(fee).negate());

		assertThat(trailOf(him, 2027))
				.isEqualTo(standing.fallsShortOfTheFee ? theCashiersTrail() : NO_TRAIL);
	}

	/**
	 * THE TRAIL NAMES WHOEVER PRESSED THE BUTTON, AND NOT THE MEMBER OR THE ACCOUNT THAT IS HIS.
	 *
	 * <p>The decision's words are „ko je odobrio", and the one who approved is the moderator whose
	 * session the request arrived in. Three other candidates are in reach of the route and each is a
	 * way to be wrong that the fixture makes DIFFERENT from the right answer: the member's own row
	 * (name „Probni Takmicar"), the account that belongs to him ({@code anAccountOf}, „Clan
	 * Nalogovic"), and the lowest account in the database. None of the three is the cashier.
	 */
	@Test
	void theTrailNamesWhoPressedTheButtonAndNotTheMemberOrTheAccountThatIsHis() throws Exception {
		anAccountOf(him, "clan@primer.rs", "competitor", "Clan", "Nalogovic");
		earnedAReferral(him, whoPays, "5", "EUR");

		assertThat(fromHisBalance(him, cashierCookie).getStatus()).isEqualTo(201);

		assertThat(trailOf(him, 2027))
				.as("the trail named somebody other than the moderator who pressed")
				.isEqualTo(theCashiersTrail());
	}

	/**
	 * A MODERATOR WHO IS ALSO THE MEMBER IS NAMED WHEN HE APPROVES HIMSELF. This is the one case in which
	 * „who pressed" and „whose membership it is" are the same man, so the two sources of the name give
	 * the same string and no assertion here can tell them apart.
	 *
	 * <p><b>It records what the route does and is NOT a decision.</b> No entry of PDL or ADL says
	 * whether a moderator may approve his own membership or forgive himself a fee; nothing in the code
	 * stops him, and the trail is what makes it visible afterwards. If the owner decides otherwise this
	 * case is the one that changes.
	 */
	@Test
	void aModeratorWhoIsAlsoTheMemberIsNamedWhenHeApprovesHimself() throws Exception {
		String hisCookie = anAccountOf(him, "sam@primer.rs", "moderator", "Probni", "Takmicar");
		ticked("sam@primer.rs", "queue:payments");
		earnedAReferral(him, whoPays, "5", "EUR");

		MockHttpServletResponse answer = fromHisBalance(him, hisCookie);

		assertThat(answer.getStatus()).as("approving himself was refused, which no decision says").isEqualTo(201);
		assertThat(trailOf(him, 2027))
				.isEqualTo(new Trail(accountId("sam@primer.rs"), "Probni Takmicar", Timestamp.from(IN_JUNE_2027)));
	}

	/**
	 * A BODY THAT NAMES WHO DECIDED IS NOT BELIEVED.
	 *
	 * <p>The request carries a competitor and a ground and nothing else, and the trail is the
	 * principal's. This sends the three fields a trail is made of in a body that has no place for them
	 * (Jackson drops unknown fields, which is what {@code @RequestBody} does here) and asserts that
	 * not one of them reaches the row. It protects the day somebody gives {@code Grant} a fourth
	 * field.
	 */
	@Test
	void aBodyThatNamesWhoDecidedIsNotBelieved() throws Exception {
		earnedAReferral(him, whoPays, "5", "EUR");

		MockHttpServletResponse answer = withThisBody("{\"competitorId\":" + him
				+ ",\"ground\":\"balance\",\"decidedBy\":" + accountId(SUPERADMIN)
				+ ",\"decidedByName\":\"Neko Drugi\",\"decidedAt\":\"2020-01-01T00:00:00Z\"}", cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(trailOf(him, 2027))
				.as("a field of the body reached the trail")
				.isEqualTo(theCashiersTrail());
	}

	/**
	 * THE TRAIL ON THE ROW IS THE TRAIL IN THE BOOK. A short balance records who pressed and when in two
	 * places, on purpose (ADL, the entry of 09.10.2026), and this is the case that keeps them one
	 * answer.
	 *
	 * <p>Read through the key that joins them: the membership NAMES its book entry
	 * ({@code balance_entry_id}), so the line compared is the line that paid for this very row and not
	 * the first one the member happens to have. The moment is equal because the clock these cases move
	 * is one instant; in production the two readings of the clock are microseconds apart.
	 *
	 * <p>Both sides are required to be PRESENT as well as equal: two nulls are equal, and a pair of
	 * empty homes would otherwise pass.
	 */
	@Test
	void theTrailOnTheRowIsTheTrailInTheBook() throws Exception {
		earnedAReferral(him, whoPays, "5", "EUR");

		assertThat(fromHisBalance(him, cashierCookie).getStatus()).isEqualTo(201);

		record BothHomes(Long rowBy, Long bookBy, String rowName, String bookName, Timestamp rowAt,
				Timestamp bookAt) {
		}

		BothHomes homes = db.sql("select m.decided_by, e.recorded_by, m.decided_by_name,"
						+ " e.recorded_by_name, m.decided_at, e.occurred_at from membership m"
						+ " join balance_entry e on e.id = m.balance_entry_id"
						+ " where m.competitor_id = ? and m.season = 2027")
				.param(him)
				.query((row, i) -> new BothHomes((Long) row.getObject(1), (Long) row.getObject(2),
						row.getString(3), row.getString(4), row.getTimestamp(5), row.getTimestamp(6)))
				.single();

		assertThat(homes.rowBy()).as("the membership names no account").isNotNull();
		assertThat(homes.rowBy()).as("the membership and the book name two accounts").isEqualTo(homes.bookBy());
		assertThat(homes.rowName()).as("the membership names nobody").isNotBlank();
		assertThat(homes.rowName()).as("the membership and the book name two people").isEqualTo(homes.bookName());
		assertThat(homes.rowAt()).as("the membership names no moment").isNotNull();
		assertThat(homes.rowAt()).as("the membership and the book give two moments").isEqualTo(homes.bookAt());
	}

	/**
	 * THE ACCOUNT THAT APPROVED A REDUCED AMOUNT MAY GO AND THE TRAIL KEEPS HIS NAME.
	 *
	 * <p>The exemption's case of the same shape exists because a mutation survived without it, and the
	 * mutation was the trap V9 paid for: a rule written over the POINTER contradicts its own foreign key,
	 * because {@code ON DELETE SET NULL} empties the pointer of everything that account ever entered.
	 * {@code membership_on_a_balance_carries_its_trail_whole_or_not_at_all} (V56) is written over the
	 * NAME and the pair, so what is left after the delete - no pointer, a name and a moment - is a trail
	 * that is still whole.
	 */
	@Test
	void theAccountThatApprovedAReducedAmountMayGoAndTheTrailKeepsHisName() throws Exception {
		earnedAReferral(him, whoPays, "5", "EUR");

		assertThat(fromHisBalance(him, cashierCookie).getStatus()).isEqualTo(201);

		db.sql("delete from account where email = ?").param(CASHIER).update();

		assertThat(trailOf(him, 2027))
				.as("the pointer was meant to empty and the name and the moment to stay")
				.isEqualTo(new Trail(null, "Blagajnik Probic", Timestamp.from(IN_JUNE_2027)));
	}

	/**
	 * A SECOND PRESS OF A REDUCED AMOUNT, BY ANOTHER MODERATOR, KEEPS THE FIRST TRAIL AND SPENDS
	 * NOTHING FURTHER.
	 *
	 * <p>The harmless repeat of {@link #asecondPressOfTheBalanceButtonDrawsNoSecondNumberAndSpendsNothingFurther}
	 * for the short side, with the second press made by somebody else on purpose: a repeat that wrote
	 * the trail again would replace the cashier with the superadmin, and a repeat by the same man
	 * could not tell that from nothing.
	 */
	@Test
	void aSecondPressOfAReducedAmountByAnotherModeratorKeepsTheFirstTrail() throws Exception {
		earnedAReferral(him, whoPays, "5", "EUR");

		MockHttpServletResponse first = fromHisBalance(him, cashierCookie);
		MockHttpServletResponse second = fromHisBalance(him, superadminCookie);

		assertThat(first.getStatus()).isEqualTo(201);
		assertThat(second.getStatus()).as("a repeat is harmless and not a refusal").isEqualTo(200);
		assertThat(granted(second).memberNumber()).isEqualTo(granted(first).memberNumber());
		assertThat(bookOf(him))
				.as("the balance was spent once")
				.isEqualTo("referral 5.00 EUR for " + whoPays + ", membership -5.00 EUR for nobody");
		assertThat(trailOf(him, 2027))
				.as("the second press replaced the trail of the first")
				.isEqualTo(theCashiersTrail());
	}

	/**
	 * AND THE SAME TWO CASES ON THE DINAR SIDE, because the money is a fact about his COUNTRY and a
	 * file in which everybody lives abroad measures one state of it.
	 *
	 * <p><b>This is the axis V42 opened and nothing else in this file covers.</b> Until then an invoice
	 * carried both columns and a route took the one it wanted, so where a member lived changed nothing
	 * about which numbers were right. Now his country picks the column of the price list AND the lines
	 * of the book that are his, and the two have to be the same column or the comparison is wrong by
	 * the rate. In June 2027 the {@code season} row is 4.800 dinars, so a book of 6.000 covers it and a
	 * book of 600 does not.
	 *
	 * <p>A member of his own rather than {@code him}, because {@code him} lives in Shanghai and moving
	 * him would take every other case in this file with him.
	 */
	@Test
	void thesameTwoOutcomesOnTheDinarSide() throws Exception {
		long coversIt = competitorIn(A_TOWN_IN_SERBIA, "003701");
		long shortOfIt = competitorIn(A_TOWN_IN_SERBIA, "003702");

		earnedAReferral(coversIt, whoPays, "6000", "RSD");
		earnedAReferral(shortOfIt, him, "600", "RSD");

		assertThat(fromHisBalance(coversIt, cashierCookie).getStatus()).isEqualTo(201);
		assertThat(bookOf(coversIt))
				.as("a dinar book was measured against the euro column of the price list")
				.isEqualTo("referral 6000.00 RSD for " + whoPays
						+ ", membership -4800.00 RSD for nobody");
		assertThat(trailOf(coversIt, 2027))
				.as("a dinar balance that covers the fee forgave nothing, and left a trail")
				.isEqualTo(NO_TRAIL);

		assertThat(fromHisBalance(shortOfIt, cashierCookie).getStatus()).isEqualTo(201);
		assertThat(bookOf(shortOfIt))
				.as("a short dinar book did not give up all of itself")
				.isEqualTo("referral 600.00 RSD for " + him
						+ ", membership -600.00 RSD for nobody");
		assertThat(trailOf(shortOfIt, 2027))
				.as("a short dinar balance forgave money, and the trail is written for euro alone")
				.isEqualTo(theCashiersTrail());
	}

	/**
	 * AN EMPTY BOOK IS REFUSED, and the refusal is owed here rather than met in the database.
	 *
	 * <p>{@code balance_entry_a_membership_takes} (V38) refuses an entry that moves nothing - „an
	 * entry that moves nothing is not a fact about money" - so without the guard this answers 500.
	 * An empty book is the ORDINARY state of a member, not an edge: most of them have brought in
	 * nobody.
	 *
	 * <p><b>Nothing at all is written, on any of the three tables</b>, which is the owner's rule over
	 * every case of section 19: „Odluka NE... ne brise red iz tabele za aktivaciju, samo odlaze
	 * odluku." A refusal leaves him exactly where he was, and the row he is on is DERIVED from that.
	 */
	@Test
	void anEmptyBookIsRefusedRatherThanWritingALineThatMovesNothing() throws Exception {
		MockHttpServletResponse answer = fromHisBalance(him, cashierCookie);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(refusal(answer))
				.isEqualTo(MembershipWriteApi.NOTHING_WOULD_COME_OFF_THE_BOOK);
		assertThat(membershipCount()).isEqualTo(1);
		assertThat(bookOf(him)).isEqualTo("no lines");
		assertThat(competitorRow(him))
				.as("no number was drawn and he was not activated")
				.isEqualTo("none false payment");
	}

	/*
	 * A CASE CALLED `abookWithMoneyInOnlyOneCurrencyIsRefusedTooAndNotOnlyTheWhollyEmptyOne` STOOD
	 * HERE, and it goes with the pair rather than being weakened.
	 *
	 * It was found on review of PR 403 and it was a real finding: the guard asked
	 * `offTheBook.isNothing()`, true only when BOTH halves were nothing, while
	 * `balance_entry_a_membership_takes` refused a spend whenever EITHER half was not strictly
	 * negative - so a book of 15.00 EUR / 0.00 RSD met the constraint and answered 500 instead of this
	 * route's own 409. `Balance.Money.isMoneyInBothCurrencies` was written for it.
	 *
	 * ONE AMOUNT HAS NO SUCH STATE. The owner decided on 27.09.2026 (PDL 25) that a balance is one
	 * amount in one money, so „money in only one currency" is not a book any more - it is simply a
	 * book. What remains of the finding is the case above it, an EMPTY book refused rather than met in
	 * the database, and `isMoneyInBothCurrencies` collapsed into `isMoney`, one `signum() > 0`.
	 *
	 * V38 predicted this in as many words, in its own note on that refusal: „Once the book is one
	 * amount in one currency rather than a pair, there is no second currency left to be nothing while
	 * the first is not, and this road closes with the pair it depends on."
	 */

	/**
	 * THE PER-PERSON BASIS IS LEFT ALONE ON THIS GROUND, AND THAT IS THE SCHEMA'S DOING.
	 *
	 * <p>V38 widened {@code membership_basis_known} to three words and left V7:281's
	 * {@code competitor_membership_basis_known check (membership_basis in ('payment', 'feeExempt'))}
	 * exactly where it was. So {@code 'balance'} has no second home, and this reads the column back
	 * to prove the route does not try - a route that did would answer 500 rather than 201, which is
	 * the mutation this case is really about.
	 *
	 * <p><b>What is given up, asserted rather than only written down:</b> he goes on being called a
	 * payer by every screen that reads that column, exactly as he already is when he lets himself in
	 * through his own door. {@code active} is what changes, and it is what ten public readers end on.
	 */
	@Test
	void thebalanceGroundActivatesHimWithoutTouchingThePerPersonBasis() throws Exception {
		earnedAReferral(him, whoPays, "50", "EUR");

		assertThat(fromHisBalance(him, cashierCookie).getStatus()).isEqualTo(201);

		assertThat(competitorRow(him))
				.as("numbered and active, and the per-person basis is untouched")
				.matches("\\d{6} true payment");
	}

	/**
	 * WHERE THE TRAIL OF EACH ACT STANDS: ON THE MEMBERSHIP FOR EVERY ACT THAT FORGIVES MONEY, AND IN
	 * THE BOOK FOR EVERY SPEND OF A BALANCE.
	 *
	 * <p>This case was called {@code eachGroundKeepsItsTrailInExactlyOnePlace} until 09.10.2026 and
	 * claimed that a ground has ONE home for who and when - the exemption's on the membership, the
	 * balance's in the book, never both, because filling both in „would make 'who did this' answerable
	 * from two tables with nothing saying which is right". The owner's decision of 03.10.2026
	 * overturned that premise: the trail goes with every act that forgives money, and a balance that
	 * falls short of the fee forgives some. So a reduced amount is recorded in BOTH places, on
	 * purpose, and {@link #theTrailOnTheRowIsTheTrailInTheBook} is what says which of the two is
	 * right: they are the same.
	 *
	 * <p><b>Three acts on three members, each read in both homes</b>, so each of the six cells below
	 * is a claim and not a coincidence:
	 *
	 * <ul>
	 * <li>a whole fee from the balance: the book names the cashier and the membership nobody;
	 * <li>an exemption: the membership names the cashier and the book holds no line at all;
	 * <li>a reduced amount: the membership names the cashier, and so does the book.
	 * </ul>
	 */
	@Test
	void theTrailIsOnTheMembershipOfEveryActThatForgivesMoneyAndInTheBookOfEverySpend() throws Exception {
		earnedAReferral(him, whoPays, "50", "EUR");
		earnedAReferral(alreadyFreeElsewhere, him, "5", "EUR");

		assertThat(fromHisBalance(him, cashierCookie).getStatus()).isEqualTo(201);
		assertThat(membershipOf(him, 2027)).isEqualTo("balance names an entry, no trail");
		assertThat(whoWroteTheSpend(him)).isEqualTo("Blagajnik Probic");

		assertThat(freeHim(whoPays, cashierCookie).getStatus()).isEqualTo(201);
		assertThat(membershipOf(whoPays, 2027))
				.isEqualTo("feeExempt names nothing, trail by Blagajnik Probic");
		assertThat(bookOf(whoPays))
				.as("an exemption takes nothing off anybody")
				.isEqualTo("no lines");

		assertThat(fromHisBalance(alreadyFreeElsewhere, cashierCookie).getStatus()).isEqualTo(201);
		assertThat(membershipOf(alreadyFreeElsewhere, 2027))
				.isEqualTo("balance names an entry, trail by Blagajnik Probic");
		assertThat(whoWroteTheSpend(alreadyFreeElsewhere)).isEqualTo("Blagajnik Probic");
	}

	/**
	 * A SECOND PRESS OF THE SAME BUTTON IS HARMLESS: no second number, no second line.
	 *
	 * <p>The reason {@code RecordingAPayment} gives about its own repeat, and here it costs money to
	 * get wrong in two ways at once: the member-number sequence only counts up, so a second draw
	 * spends a number for good, and a second spend would take the fee off his book twice.
	 */
	@Test
	void asecondPressOfTheBalanceButtonDrawsNoSecondNumberAndSpendsNothingFurther() throws Exception {
		earnedAReferral(him, whoPays, "50", "EUR");

		MockHttpServletResponse first = fromHisBalance(him, cashierCookie);
		String number = granted(first).memberNumber();

		MockHttpServletResponse second = fromHisBalance(him, cashierCookie);

		assertThat(first.getStatus()).isEqualTo(201);
		assertThat(second.getStatus()).as("a repeat is harmless and not a refusal").isEqualTo(200);
		assertThat(granted(second).memberNumber()).isEqualTo(number);
		assertThat(bookOf(him))
				.as("the fee came off once")
				.isEqualTo("referral 50.00 EUR for " + whoPays
						+ ", membership -40.00 EUR for nobody");
	}

	/**
	 * AND A SEASON HELD ON THE OTHER GROUND IS REFUSED WITHOUT SAYING WHICH GROUND IT IS.
	 *
	 * <p>PDL, 28.07.2026: „Osnov clanstva se nikad ne prikazuje javno... Vide ga samo Superadmin i
	 * moderatori sa pravom nad clanovima." That right is {@code entity:members} and the tick opening
	 * this route is {@code queue:payments}, so the refusal names the fact and not the ground.
	 *
	 * <p><b>Both directions, because one of them alone would let a route that always reports the same
	 * thing pass.</b> And the WHOLE body is read rather than one field, the shape
	 * {@link #theAnswerNeverCarriesTheBasis} already uses: a reason that does not name the ground is
	 * no use if the body carries it in a second field.
	 */
	@Test
	void aseasonHeldOnTheOtherGroundIsRefusedWithoutNamingIt() throws Exception {
		earnedAReferral(him, whoPays, "50", "EUR");
		earnedAReferral(alreadyFreeElsewhere, him, "50", "EUR");

		assertThat(fromHisBalance(him, cashierCookie).getStatus()).isEqualTo(201);

		MockHttpServletResponse onTheOther = freeHim(him, cashierCookie);

		assertThat(onTheOther.getStatus()).isEqualTo(409);
		assertThat(refusal(onTheOther)).isEqualTo(MembershipWriteApi.THE_MEMBERSHIP_IS_ALREADY_HELD);
		assertThat(onTheOther.getContentAsString())
				.as("the body must not carry the ground in any field")
				.doesNotContain("balance").doesNotContain("feeExempt");

		freeOfTheFee(whoPays, 2027);
		MockHttpServletResponse theOtherWay = fromHisBalance(whoPays, cashierCookie);

		assertThat(theOtherWay.getStatus()).isEqualTo(409);
		assertThat(refusal(theOtherWay)).isEqualTo(MembershipWriteApi.THE_MEMBERSHIP_IS_ALREADY_HELD);
		assertThat(theOtherWay.getContentAsString())
				.doesNotContain("balance").doesNotContain("feeExempt");
	}

	/**
	 * ONE MEMBERSHIP ROW AS READABLE WORDS: which ground, whether it names a book entry, and whose
	 * trail is on it.
	 *
	 * <p>Read as one string rather than three assertions so that a row answering right about the
	 * ground and wrong about the rest cannot pass half of a case.
	 */
	private String membershipOf(long competitorId, int season) {
		return db.sql("select basis || ' '"
						+ " || case when balance_entry_id is null then 'names nothing'"
						+ "         else 'names an entry' end"
						+ " || ', ' || coalesce('trail by ' || decided_by_name, 'no trail')"
						+ " from membership where competitor_id = ? and season = ?")
				.params(competitorId, season).query(String.class).single();
	}

	/** Who the BOOK says spent it, which is where this ground's trail lives. */
	private String whoWroteTheSpend(long competitorId) {
		return db.sql("select recorded_by_name from balance_entry"
						+ " where competitor_id = ? and reason = 'membership'")
				.param(competitorId).query(String.class).single();
	}
}
