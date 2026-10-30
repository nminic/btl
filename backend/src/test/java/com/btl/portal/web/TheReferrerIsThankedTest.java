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
 * THE MAN WHO BROUGHT A MEMBER IN IS THANKED IN HIS INBOX WHEN THAT MEMBER IS ACTIVATED, through each
 * of the three doors an activation comes through.
 *
 * <p>The owner, 29.10.2026 (PDL, „Preostala pitanja posle provere pravnih strana prema kodu"): the
 * referrer gets a message in the portal, „Hvala na preporuci", when the membership of the member he
 * brought in is activated (PDL P16, 12.08.2026). The words are the owner's, and they are held word
 * for word below.
 *
 * <p><b>THE FIXTURE IS BUILT SO THAT NO ASSERTION CAN BE SATISFIED BY THE WRONG SOURCE.</b> Every axis
 * was counted, and each says which mutation it closes:
 *
 * <ul>
 * <li><b>Four people with four different names.</b> The referrer, the newcomer, a third member nobody
 * brought in and a second newcomer of the same referrer who is NOT activated. A message addressed to
 * the newcomer, to the third member, to the whole league (an empty address), or naming the referrer
 * where the newcomer belongs reads differently from the right one. The second newcomer is created
 * BEFORE the first, so a name read off the earliest member brought in by the referrer is another name.
 * <li><b>The season of the activation is 2028 and the clock stands in 2027.</b> A message that said the
 * year of today reads „2027".
 * <li><b>The reward is worth a figure no other row of the price list has</b>, in either money, and the
 * set-up asserts it: 7,30 EUR and 876,00 RSD. A message that took the amount off another row (the fee,
 * the processing charge, the junior level) reads differently.
 * <li><b>The referrer and the newcomer live in different countries</b>, so the money of the message is
 * the REFERRER's and a line read off the newcomer's currency is told apart: the payment door and the
 * balance door thank a referrer in Serbia for a newcomer abroad, the grant door the other way round.
 * <li><b>A second activation of the same member</b>, in the next season, says nothing: that is
 * {@code on conflict (referred_competitor_id) do nothing} answering nought rows, and the message is
 * conditional on a line having been written and not on an activation having happened.
 * </ul>
 *
 * <p>Each case counts the WHOLE table of messages, so one extra line to anybody is found, and asks the
 * three people who must not be told by name.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TheReferrerIsThankedTest {

	/** 11:00 in Belgrade in November 2027: the season on sale is 2028, the year of the clock 2027. */
	private static final Instant IN_NOVEMBER_2027 = Instant.parse("2027-11-16T09:00:00Z");

	/** A year later: the next season is on sale, and the newcomer is activated for it a second time. */
	private static final Instant IN_NOVEMBER_2028 = Instant.parse("2028-11-16T09:00:00Z");

	private static final int THE_NEXT_SEASON = 2029;

	private static final String THE_SUBJECT = "Hvala na preporuci";

	private static final String CASHIER = "blagajnik@primer.rs";

	private static final String THE_NEWCOMERS_ACCOUNT = "novajlija@primer.rs";

	/** {@code rank = 1} is Shanghai, so a member put here is billed in EURO. */
	private static final String ABROAD = "(select id from place where rank = 1)";

	/** The first town of the codebook in Serbia, so a member put here is billed in DINARS. */
	private static final String IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	/** What a euro member sends in the season on sale, fee included (the figure PaymentApiTest holds). */
	private static final BigDecimal WHAT_A_EURO_MEMBER_SENDS = new BigDecimal("38.00");

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	/** The shape the other files that move time use, reporting UTC. */
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
			return new AClockTheCaseMoves(IN_NOVEMBER_2027);
		}
	}

	private int issued;

	private String cashierCookie;

	private String newcomersCookie;

	/** The man whose message these cases are about. Created AFTER both of the people he brought in. */
	private long referrer;

	/** The member brought in whom the cases activate. */
	private long newcomer;

	/** Brought in by the same referrer, never activated, and created BEFORE the newcomer. */
	private long anotherNewcomer;

	/** Nobody brought him in and he brought nobody in. */
	private long aThirdMember;

	@BeforeEach
	void fourPeopleAndARewardNoOtherRowHas() {
		clock.moveTo(IN_NOVEMBER_2027);

		/* A REWARD OF A FIGURE NO OTHER ROW OF THE LIST HAS, in either money. */
		db.sql("update price_row set eur = 7.30, rsd = 876.00 where key = 'referral'").update();

		assertThat(db.sql("select count(*) from price_row where key <> 'referral'"
						+ " and (eur = 7.30 or rsd = 876.00)").query(Long.class).single())
				.as("another row of the price list is worth what the reward is worth, so a message that"
						+ " read its amount off that row would read the same")
				.isZero();

		cashierCookie = account(CASHIER, "moderator");
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:payments')")
				.param(CASHIER).update();

		aThirdMember = competitor("Tamara", "Treca", "009003", true, IN_SERBIA, null);
		anotherNewcomer = competitor("Nikola", "Drugi", null, false, ABROAD, null);
	}

	/** Made per case, because the country of the referrer is the axis that differs between the doors. */
	private void thePeople(String referrerTown, String newcomerTown) {
		referrer = competitor("Ruzica", "Preporucilac", "009001", true, referrerTown, null);
		newcomer = competitor("Nenad", "Novajlija", null, false, newcomerTown, referrer);

		db.sql("update competitor set referred_by = ? where id = ?").params(referrer, anotherNewcomer).update();
	}

	private long competitor(String first, String last, String memberNumber, boolean active, String town,
			Long broughtInBy) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, ?, ?, 'M',"
						+ " date '1990-05-15', " + town + ", null, null, 2027, ?, ?, ?, '', false,"
						+ " 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(memberNumber, first, last, active, String.format("%016x", ++issued), broughtInBy)
				.query(Long.class).single();
	}

	private String account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

		return sessionOf(email);
	}

	private String sessionOf(String email) {
		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}

	private long messages() {
		return db.sql("select count(*) from message").query(Long.class).single();
	}

	private long messagesTo(long member) {
		return db.sql("select count(*) from message where to_id = ?").param(member).query(Long.class).single();
	}

	/** The one line the thanks reads as, or the words for none, so a case reads what was written. */
	private String thanksTo(long member) {
		return db.sql("select coalesce(string_agg(from_name || ' | ' || subject || ' | ' || body, ' || '), 'none')"
						+ " from message where to_id = ? and from_id is null")
				.param(member).query(String.class).single();
	}

	private static String theThanks(String amount) {
		return "Balkanska trkačka liga | " + THE_SUBJECT + " | Osoba koju ste preporučili, Nenad Novajlija,"
				+ " postala je deo lige za sezonu 2028, pa smo vam na balans upisali " + amount
				+ ". Hvala vam na preporuci.\n\nBalkanska trkačka liga";
	}

	/** Nobody but the referrer was told anything, and the table holds exactly the messages counted. */
	private void onlyTheReferrerIsTold(long before) {
		assertThat(messages()).as("not exactly one message was written for one activation").isEqualTo(before + 1);
		assertThat(messagesTo(newcomer)).as("the newcomer was told").isZero();
		assertThat(messagesTo(aThirdMember)).as("a member with no part in it was told").isZero();
		assertThat(messagesTo(anotherNewcomer)).as("the other member brought in was told").isZero();
		assertThat(db.sql("select count(*) from message where to_id is null").query(Long.class).single())
				.as("the thanks went to the whole league").isZero();
	}

	// ---------------------------------------------------------------- the payments screen

	private MockHttpServletResponse confirmForTheNewcomer() throws Exception {
		return http.perform(post("/api/payments").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cashierCookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content(mapper.writeValueAsString(new PaymentApi.Confirm(newcomer,
								WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null))))
				.andReturn().getResponse();
	}

	/**
	 * A BOOKED PAYMENT THANKS HIM, in his money - dinars for a referrer in Serbia whose newcomer pays in
	 * euro - and a second season of the same member says nothing.
	 */
	@Test
	void aBookedPaymentThanksTheReferrerAndASecondSeasonDoesNot() throws Exception {
		thePeople(IN_SERBIA, ABROAD);

		long before = messages();

		assertThat(confirmForTheNewcomer().getStatus()).isEqualTo(201);

		assertThat(thanksTo(referrer)).isEqualTo(theThanks("876,00 RSD"));
		onlyTheReferrerIsTold(before);

		clock.moveTo(IN_NOVEMBER_2028);
		long afterTheFirst = messages();

		assertThat(confirmForTheNewcomer().getStatus())
				.as("the next season was not booked, so this case is not about a second activation")
				.isEqualTo(201);
		assertThat(db.sql("select count(*) from membership where competitor_id = ? and season = ?")
						.params(newcomer, THE_NEXT_SEASON).query(Long.class).single())
				.as("the next season was not booked").isOne();

		assertThat(messages()).as("the same member thanked his referrer twice").isEqualTo(afterTheFirst);
		assertThat(thanksTo(referrer)).isEqualTo(theThanks("876,00 RSD"));
	}

	// ---------------------------------------------------------------- the administration frees him

	private MockHttpServletResponse freeTheNewcomer() throws Exception {
		return http.perform(post("/api/memberships").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cashierCookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content(mapper.writeValueAsString(new MembershipWriteApi.Grant(newcomer, "feeExempt"))))
				.andReturn().getResponse();
	}

	/**
	 * A SEASON GRANTED FREE OF THE FEE THANKS HIM TOO (owner, 13.08.2026: the reward is the same for a
	 * member freed of the fee), in euro for a referrer abroad whose newcomer lives in Serbia.
	 */
	@Test
	void aSeasonGrantedFreeOfTheFeeThanksTheReferrerAndASecondSeasonDoesNot() throws Exception {
		thePeople(ABROAD, IN_SERBIA);

		long before = messages();

		assertThat(freeTheNewcomer().getStatus()).isEqualTo(201);

		assertThat(thanksTo(referrer)).isEqualTo(theThanks("7,30 EUR"));
		onlyTheReferrerIsTold(before);

		clock.moveTo(IN_NOVEMBER_2028);
		long afterTheFirst = messages();

		assertThat(freeTheNewcomer().getStatus()).isEqualTo(201);
		assertThat(db.sql("select count(*) from membership where competitor_id = ? and season = ?")
						.params(newcomer, THE_NEXT_SEASON).query(Long.class).single())
				.as("the next season was not granted").isOne();

		assertThat(messages()).as("the same member thanked his referrer twice").isEqualTo(afterTheFirst);
		assertThat(thanksTo(referrer)).isEqualTo(theThanks("7,30 EUR"));
	}

	// ---------------------------------------------------------------- the member lets himself in

	private MockHttpServletResponse letHimselfIn() throws Exception {
		return http.perform(post("/api/me/membership").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, newcomersCookie)))
				.andReturn().getResponse();
	}

	/** A surplus he sent once, in his own money, so his balance covers the fee of the season it names. */
	private void aBalanceOf(long member, String euro, int season) {
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season, occurred_at,"
						+ " recorded_by_name) values (?, ?::numeric, 'EUR', 'overpayment', ?, ?, 'Blagajnik')")
				.params(member, euro, season, Timestamp.from(IN_NOVEMBER_2027)).update();
	}

	/**
	 * A MEMBER ACTIVATED OUT OF HIS OWN BALANCE THANKS HIS REFERRER, in dinars for a referrer in Serbia
	 * whose newcomer is billed in euro.
	 */
	@Test
	void anActivationOutOfTheBalanceThanksTheReferrerAndASecondSeasonDoesNot() throws Exception {
		thePeople(IN_SERBIA, ABROAD);

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Nenad', 'Novajlija', ?, (select id from role where code = 'competitor'), ?)")
				.params(THE_NEWCOMERS_ACCOUNT, newcomer).update();
		newcomersCookie = sessionOf(THE_NEWCOMERS_ACCOUNT);

		aBalanceOf(newcomer, "100.00", 2027);

		long before = messages();

		assertThat(letHimselfIn().getStatus()).isEqualTo(201);

		assertThat(thanksTo(referrer)).isEqualTo(theThanks("876,00 RSD"));
		onlyTheReferrerIsTold(before);

		clock.moveTo(IN_NOVEMBER_2028);
		aBalanceOf(newcomer, "100.00", 2028);
		long afterTheFirst = messages();

		assertThat(letHimselfIn().getStatus()).isEqualTo(201);
		assertThat(db.sql("select count(*) from membership where competitor_id = ? and season = ?")
						.params(newcomer, THE_NEXT_SEASON).query(Long.class).single())
				.as("the next season was not activated").isOne();

		assertThat(messages()).as("the same member thanked his referrer twice").isEqualTo(afterTheFirst);
		assertThat(thanksTo(referrer)).isEqualTo(theThanks("876,00 RSD"));
	}

	// ---------------------------------------------------------------- nobody brought him in

	/** A MEMBER NOBODY BROUGHT IN ACTIVATES AND NOBODY IS THANKED. */
	@Test
	void aMemberNobodyBroughtInThanksNobody() throws Exception {
		thePeople(IN_SERBIA, ABROAD);
		db.sql("update competitor set referred_by = null where id = ?").param(newcomer).update();

		long before = messages();

		assertThat(freeTheNewcomer().getStatus()).isEqualTo(201);

		assertThat(messages()).as("somebody was thanked for a member nobody brought in").isEqualTo(before);
	}
}
