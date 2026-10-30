package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * {@link MemberMembershipApi}: a season cancelled, or its basis changed, from the member's row.
 *
 * <p><b>THE SETUP SEPARATES EVERY SECOND SOURCE OF ONE VALUE</b>, and each is named so a case cannot
 * stand on two at once:
 * <ul>
 * <li><b>the season</b> is the clock's: the cases stand after 15 October (2028 on sale while 2027 is
 * run, and the member holds both), before it, at half past midnight of 1 January in Belgrade, which
 * is still 31 December in UTC, and in 2026; the season acted on is never the only one he holds;</li>
 * <li><b>{@code active}</b> is what the remaining rows say: a member who keeps the running season stays
 * active, one who keeps only an older one does not, and one who keeps nothing does not;</li>
 * <li><b>the book</b> is the season's: the member also holds a credit of 2027 and a reward of his own
 * for bringing somebody in, and neither is reversed; his referrer's book is not touched;</li>
 * <li><b>the promise</b> is the season's: one stands for 2027 as well, and stays;</li>
 * <li><b>the trail</b> is the account that asked: the member has an account of his own, under a name
 * that is not the moderator's;</li>
 * <li><b>the recipient</b> is the member: never the whole league, never the moderator (who is himself
 * a member), never the referrer, never a third member.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MemberMembershipApiTest {

	/** 2028 on sale while 2027 is run: 35 EUR plus the fee of 3. */
	private static final Instant AFTER_THE_FIFTEENTH = Instant.parse("2027-11-16T09:00:00Z");

	/** 2027 on sale and run. */
	private static final Instant BEFORE_THE_FIFTEENTH = Instant.parse("2027-09-10T09:00:00Z");

	/** 00:30 of 1 January 2028 in Belgrade, still 2027 in UTC: 2028 on sale and run. */
	private static final Instant HALF_PAST_MIDNIGHT = Instant.parse("2027-12-31T23:30:00Z");

	/** 2027 on sale, by the floor of the first season, while the calendar runs 2026. */
	private static final Instant IN_2026 = Instant.parse("2026-10-18T09:00:00Z");

	private static final String THE_SUPERADMIN = "superadmin-storno@primer.rs";

	private static final String OVER_THE_MEMBERS = "moderator-clanovi-storno@primer.rs";

	private static final String A_MODERATOR_WHO_IS_A_MEMBER = "moderator-clan-storno@primer.rs";

	private static final String OVER_THE_PAYMENTS_ONLY = "moderator-uplate-storno@primer.rs";

	private static final String THE_MEMBERS_OWN = "clan-sopstveni-storno@primer.rs";

	private static final String A_TOWN_ABROAD = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String CANCELLED = "Stornirano je vaše članstvo";

	private static final String CHANGED = "Promenjen je osnov vašeg članstva";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	/** Watched and never stubbed: the decision is „bez mejla". */
	@MockitoSpyBean
	private Postman postman;

	private final Map<String, String> cookies = new HashMap<>();

	private long referrer;

	private long theModeratorHimself;

	private long member;

	private long somebodyElse;

	@BeforeEach
	void membersAndTheAdministration() {
		clock.moveTo(AFTER_THE_FIFTEENTH);

		somebodyElse = competitor("000001", "b0", true, null);
		referrer = competitor("000002", "b1", true, null);
		theModeratorHimself = competitor("000003", "b2", true, null);
		member = competitor("000005", "b3", true, referrer);
		long broughtInByTheMember = competitor("000009", "b4", true, member);

		HeldOn.season(db, theModeratorHimself, 2027, "payment");
		HeldOn.season(db, theModeratorHimself, 2028, "payment");
		HeldOn.season(db, member, 2027, "payment");

		/* THE REFERRER'S REWARD FOR THE MEMBER, AND THE MEMBER'S OWN FOR THE MAN HE BROUGHT IN. Neither
		   names a season, so no reversal may reach either. */
		line(referrer, "5.00", "referral", member, null);
		line(member, "5.00", "referral", broughtInByTheMember, null);
		/* AND A CREDIT OF ANOTHER SEASON, which a reversal of 2028 must leave alone. */
		line(member, "4.00", "overpayment", null, 2027);

		promise(member, 2027);

		account(THE_SUPERADMIN, "superadmin", null, "Super", "Admin");
		account(OVER_THE_MEMBERS, "moderator", null, "Mira", "Clanovic");
		ticked(OVER_THE_MEMBERS, "entity:members");
		account(A_MODERATOR_WHO_IS_A_MEMBER, "moderator", theModeratorHimself, "Pera", "Sopstveni");
		ticked(A_MODERATOR_WHO_IS_A_MEMBER, "entity:members");
		account(OVER_THE_PAYMENTS_ONLY, "moderator", null, "Kasa", "Uplatic");
		ticked(OVER_THE_PAYMENTS_ONLY, "queue:payments");
		account(THE_MEMBERS_OWN, "competitor", member, "Sam", "Clan");

		assertThat(somebodyElse).isNotZero();
	}

	/* ------------------------------------------------------------------------------------
	   THE FIXTURE
	   ------------------------------------------------------------------------------------ */

	private long competitor(String number, String suffix, boolean active, Long referredBy) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Clan',"
						+ " 'M', date '1990-05-15', " + A_TOWN_ABROAD + ", null, null, 2027, false, ?, ?, ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, active, "0011aabbccddee" + suffix, referredBy)
				.query(Long.class).single();
	}

	private void line(long competitor, String amount, String reason, Long referred, Integer season) {
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, referred_competitor_id,"
						+ " season, occurred_at, recorded_by_name) values (?, ?::numeric, 'EUR', ?, ?, ?,"
						+ " timestamptz '2027-01-10 10:00:00+00', 'Blagajnik Probni')")
				.params(competitor, amount, reason, referred, season).update();
	}

	private void lineIn(long competitor, String amount, String currency, String reason, Integer season) {
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season, occurred_at,"
						+ " recorded_by_name) values (?, ?::numeric, ?, ?, ?,"
						+ " timestamptz '2027-01-10 10:00:00+00', 'Blagajnik Probni')")
				.params(competitor, amount, currency, reason, season).update();
	}

	private void promise(long competitor, int season) {
		db.sql("insert into balance_promise (competitor_id, season, amount, currency, promised_at)"
						+ " values (?, ?, 4.00, 'EUR', timestamptz '2027-01-10 10:00:00+00')")
				.params(competitor, season).update();
	}

	private void account(String email, String role, Long competitor, String first, String last) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values (?, ?, ?, (select id from role where code = ?), ?)")
				.params(first, last, email, role, competitor).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private long accountOf(String email) {
		return db.sql("select id from account where email = ?").param(email).query(Long.class).single();
	}

	private MockHttpServletResponse sent(MockHttpServletRequestBuilder asks, String json, String email)
			throws Exception {
		asks = asks.with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json);

		return http.perform(email == null ? asks : asks.cookie(new Cookie(SessionCookie.NAME, cookies.get(email))))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse cancelled(String number, String basis, String email) throws Exception {
		return sent(delete("/api/members/" + number + "/membership"), "{\"basis\": \"" + basis + "\"}", email);
	}

	private MockHttpServletResponse changed(String number, String json, String email) throws Exception {
		return sent(put("/api/members/" + number + "/membership"), json, email);
	}

	private MockHttpServletResponse granted(String number, String basis, String email) throws Exception {
		return sent(post("/api/members/" + number + "/membership"), "{\"basis\": \"" + basis + "\"}", email);
	}

	private JsonNode body(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	private long count(String sql, Object... params) {
		return db.sql(sql).params(params).query(Long.class).single();
	}

	private List<String> messages() {
		return db.sql("select coalesce(to_id::text, 'everybody') || ' ' || subject from message order by id")
				.query(String.class).list();
	}

	private List<String> trail() {
		return db.sql("select competitor_id || ' ' || season || ' ' || action || ' ' || basis_before || ' '"
						+ " || coalesce(basis_after, '-') || ' ' || decided_by || ' ' || decided_by_name"
						+ " from membership_change order by id")
				.query(String.class).list();
	}

	private List<String> seasonsOf(long competitor) {
		return db.sql("select m.season || ' ' || m.basis || ' ' || coalesce(p.season::text, '-')"
						+ " from membership m left join payment p on p.id = m.payment_id"
						+ " where m.competitor_id = ? order by m.season")
				.param(competitor).query(String.class).list();
	}

	private List<String> bookOf(long competitor) {
		return db.sql("select reason || ' ' || amount || ' ' || coalesce(season::text, '-')"
						+ " from balance_entry where competitor_id = ? order by id")
				.param(competitor).query(String.class).list();
	}

	private boolean active(long competitor) {
		return Boolean.TRUE.equals(db.sql("select active from competitor where id = ?")
				.param(competitor).query(Boolean.class).single());
	}

	/* ------------------------------------------------------------------------------------
	   WHO MAY
	   ------------------------------------------------------------------------------------ */

	@Test
	void aVisitorIsAskedToSignInAndNothingIsWritten() throws Exception {
		HeldOn.season(db, member, 2028, "payment");

		assertThat(cancelled("000005", "payment", null).getStatus()).isEqualTo(401);
		assertThat(changed("000005", "{\"from\": \"payment\", \"to\": \"feeExempt\"}", null).getStatus())
				.isEqualTo(401);
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 payment 2028");
	}

	@Test
	void anybodyWithoutTheRightOverTheMembersIsToldThereIsNothingHere() throws Exception {
		HeldOn.season(db, member, 2028, "payment");

		for (String refused : List.of(THE_MEMBERS_OWN, OVER_THE_PAYMENTS_ONLY)) {
			assertThat(cancelled("000005", "payment", refused).getStatus()).as(refused).isEqualTo(404);
			assertThat(changed("000005", "{\"from\": \"payment\", \"to\": \"feeExempt\"}", refused).getStatus())
					.as(refused).isEqualTo(404);
		}

		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 payment 2028");
		assertThat(trail()).isEmpty();
		assertThat(messages()).isEmpty();
	}

	@Test
	void aNumberNobodyHasIsAnAddressThatIsNotThere() throws Exception {
		MockHttpServletResponse answer = cancelled("009999", "payment", THE_SUPERADMIN);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString()).isEmpty();
		assertThat(changed("009999", "{\"from\": \"payment\", \"to\": \"feeExempt\"}", THE_SUPERADMIN).getStatus())
				.isEqualTo(404);
	}

	@ParameterizedTest
	@CsvSource(delimiter = '|', value = {
			"{}                                          | theFormIsNotComplete",
			"{\"basis\": \"\"}                          | theFormIsNotComplete",
			"{\"basis\": \"honorary\"}                  | theBasisIsNotKnown"})
	void aCancellationThatSaysNoBasisOrAnUnknownOneIsRefused(String json, String reason) throws Exception {
		HeldOn.season(db, member, 2028, "payment");

		MockHttpServletResponse answer = sent(delete("/api/members/000005/membership"), json.strip(), OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(body(answer).path("reason").asString()).isEqualTo(reason);
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 payment 2028");
	}

	/** The two changes the owner gave the row, and nothing else: not from a balance, not to one. */
	@ParameterizedTest
	@CsvSource(delimiter = '|', value = {
			"{\"to\": \"feeExempt\"}                          | theFormIsNotComplete",
			"{\"from\": \"payment\"}                          | theFormIsNotComplete",
			"{\"from\": \"\", \"to\": \"feeExempt\"}           | theFormIsNotComplete",
			"{\"from\": \"payment\", \"to\": \"\"}             | theFormIsNotComplete",
			"{\"from\": \"honorary\", \"to\": \"payment\"}   | theBasisIsNotKnown",
			"{\"from\": \"payment\", \"to\": \"honorary\"}    | theBasisIsNotKnown",
			"{\"from\": \"balance\", \"to\": \"payment\"}     | thisChangeIsNotOffered",
			"{\"from\": \"balance\", \"to\": \"feeExempt\"}   | thisChangeIsNotOffered",
			"{\"from\": \"payment\", \"to\": \"balance\"}     | thisChangeIsNotOffered",
			"{\"from\": \"feeExempt\", \"to\": \"balance\"}   | thisChangeIsNotOffered",
			"{\"from\": \"payment\", \"to\": \"payment\"}     | thisChangeIsNotOffered"})
	void aChangeTheRowWasNotGivenIsRefused(String json, String reason) throws Exception {
		HeldOn.season(db, member, 2028, "balance");

		MockHttpServletResponse answer = changed("000005", json.strip(), OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(body(answer).path("reason").asString()).isEqualTo(reason);
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 balance -");
		assertThat(trail()).isEmpty();
	}

	/* ------------------------------------------------------------------------------------
	   STORNO
	   ------------------------------------------------------------------------------------ */

	/**
	 * A PAYMENT CANCELLED AFTER 15 OCTOBER, part of which his balance paid: the season on sale goes and
	 * the running one stays, and so does everything that is not that season's.
	 */
	@Test
	void aPaymentCancelledTakesItsSeasonAndGivesBackWhatTheBalancePaid() throws Exception {
		HeldOn.season(db, member, 2028, "payment");
		line(member, "-10.00", "membership", null, 2028);
		promise(member, 2028);
		/* ANOTHER MEMBER'S PROMISE FOR THE SAME SEASON, which a cancellation of THIS member's season must
		   leave alone: the delete is by member and by season, and either half dropped takes it. */
		promise(somebodyElse, 2028);
		List<String> theReferrersBook = bookOf(referrer);

		MockHttpServletResponse answer = cancelled("000005", "payment", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(body(answer).path("season").asInt()).isEqualTo(2028);
		assertThat(body(answer).path("basis").isNull()).isTrue();

		/* „brišu se zapis o uplati i zapis o članstvu za tu sezonu", and only for that season. */
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027");
		assertThat(count("select count(*) from payment where competitor_id = ?", member)).isOne();

		/* THE BOOK: one new line, giving back the 10, and the reward and the credit of 2027 alone. */
		assertThat(bookOf(member)).containsExactly("referral 5.00 -", "overpayment 4.00 2027",
				"membership -10.00 2028", "reversal 10.00 2028");
		assertThat(bookOf(referrer)).as("the referrer's reward was touched").isEqualTo(theReferrersBook);

		/* THE PROMISE OF 2028 GOES, the one of 2027 stays. */
		assertThat(db.sql("select season from balance_promise where competitor_id = ? order by season")
				.param(member).query(Integer.class).list()).containsExactly(2027);
		assertThat(db.sql("select season from balance_promise where competitor_id = ? order by season")
				.param(somebodyElse).query(Integer.class).list())
				.as("a cancellation took another member's promise for the same season").containsExactly(2028);

		/* ACTIVE, because the season being run is still his; and his number is his. Nobody else's
		   `active` is recomputed: the two members below hold no season at all, so a recompute that
		   reached them would switch them off. */
		assertThat(active(member)).isTrue();
		assertThat(active(somebodyElse)).as("a cancellation recomputed another member's active").isTrue();
		assertThat(active(referrer)).as("a cancellation recomputed his referrer's active").isTrue();
		assertThat(db.sql("select member_number from competitor where id = ?").param(member)
				.query(String.class).single()).isEqualTo("000005");

		assertThat(trail()).containsExactly(member + " 2028 cancelled payment - " + accountOf(OVER_THE_MEMBERS)
				+ " Mira Clanovic");
		assertThat(messages()).containsExactly(member + " " + CANCELLED);
		assertThat(db.sql("select body from message").query(String.class).single())
				.isEqualTo("Za sezonu 2028 stornirano je vaše članstvo.\n\nZa sezonu 2028 više niste član lige.\n"
						+ "\nBalkanska trkačka liga");

		verifyNoInteractions(postman);
	}

	/** A CREDIT CANCELLED BEFORE 15 OCTOBER: the season on sale is the one run, and he keeps nothing. */
	@Test
	void beforeTheFifteenthTheRunningSeasonIsCancelledAndItsCreditTakenBack() throws Exception {
		clock.moveTo(BEFORE_THE_FIFTEENTH);
		long alone = competitor("000011", "c1", true, null);
		HeldOn.season(db, alone, 2027, "payment");
		line(alone, "3.00", "overpayment", null, 2027);

		assertThat(cancelled("000011", "payment", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);

		assertThat(seasonsOf(alone)).isEmpty();
		assertThat(bookOf(alone)).containsExactly("overpayment 3.00 2027", "reversal -3.00 2027");
		assertThat(active(alone)).as("he holds no season, so he is not active").isFalse();
		assertThat(messages()).containsExactly(alone + " " + CANCELLED);
	}

	/** AN EXEMPTION CANCELLED, held alone: nothing is written in the book, and he is inactive. */
	@Test
	void anExemptionCancelledWritesNoLineAndLeavesHimInactiveWhenNothingRemains() throws Exception {
		long exempt = competitor("000012", "c2", true, null);
		HeldOn.season(db, exempt, 2028, "feeExempt");

		assertThat(cancelled("000012", "feeExempt", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);

		assertThat(seasonsOf(exempt)).isEmpty();
		assertThat(bookOf(exempt)).isEmpty();
		assertThat(active(exempt)).isFalse();
		assertThat(trail()).containsExactly(exempt + " 2028 cancelled feeExempt - " + accountOf(OVER_THE_MEMBERS)
				+ " Mira Clanovic");
	}

	/**
	 * A BALANCE CANCELLED AT HALF PAST MIDNIGHT OF 1 JANUARY IN BELGRADE: 2028 is run and on sale, and
	 * the 2027 he keeps is an older season, so he is no longer active. Read in UTC it would still be
	 * 2027 with 2028 in the window, and he would stay active.
	 */
	@Test
	void onTheFirstOfJanuaryAnOlderSeasonDoesNotKeepHimActive() throws Exception {
		clock.moveTo(HALF_PAST_MIDNIGHT);
		HeldOn.season(db, member, 2028, "balance");

		assertThat(cancelled("000005", "balance", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);

		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027");
		assertThat(bookOf(member)).containsExactly("referral 5.00 -", "overpayment 4.00 2027",
				"membership -30.00 2028", "reversal 30.00 2028");
		assertThat(active(member)).isFalse();
	}

	/** In 2026 the season on sale is the first one, 2027, and the calendar's 2026 is no season. */
	@Test
	void in2026TheFirstSeasonIsTheOneCancelled() throws Exception {
		clock.moveTo(IN_2026);
		long first = competitor("000013", "c3", true, null);
		HeldOn.season(db, first, 2027, "feeExempt");

		MockHttpServletResponse answer = cancelled("000013", "feeExempt", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(body(answer).path("season").asInt()).isEqualTo(2027);
		assertThat(seasonsOf(first)).isEmpty();
		assertThat(active(first)).isFalse();
	}

	@Test
	void aBasisTheScreenDidNotShowIsRefusedAndNothingMoves() throws Exception {
		HeldOn.season(db, member, 2028, "payment");

		MockHttpServletResponse answer = cancelled("000005", "feeExempt", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(body(answer).path("reason").asString()).isEqualTo("theBasisHasChanged");
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 payment 2028");
		assertThat(trail()).isEmpty();
		assertThat(messages()).isEmpty();
	}

	/** Nothing to cancel is done already: nothing is written, nothing said, nobody made inactive. */
	@Test
	void aSeasonWithNothingToCancelIsAnsweredAsDoneAndNothingIsWritten() throws Exception {
		MockHttpServletResponse answer = cancelled("000005", "payment", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(body(answer).path("season").asInt()).isEqualTo(2028);
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027");
		assertThat(db.sql("select count(*) from balance_promise where competitor_id = ?").param(member)
				.query(Long.class).single()).isOne();
		assertThat(active(member)).isTrue();
		assertThat(trail()).isEmpty();
		assertThat(messages()).isEmpty();
	}

	/** On his own row, and the trail names him; the message goes to the member, who is him. */
	@Test
	void aModeratorCancelsOnHisOwnRowAndTheTrailNamesHim() throws Exception {
		assertThat(cancelled("000003", "payment", A_MODERATOR_WHO_IS_A_MEMBER).getStatus()).isEqualTo(200);

		assertThat(seasonsOf(theModeratorHimself)).containsExactly("2027 payment 2027");
		assertThat(trail()).containsExactly(theModeratorHimself + " 2028 cancelled payment - "
				+ accountOf(A_MODERATOR_WHO_IS_A_MEMBER) + " Pera Sopstveni");
		assertThat(messages()).containsExactly(theModeratorHimself + " " + CANCELLED);
	}

	@Test
	void theSuperadminCancelsWithoutATick() throws Exception {
		HeldOn.season(db, member, 2028, "feeExempt");

		assertThat(cancelled("000005", "feeExempt", THE_SUPERADMIN).getStatus()).isEqualTo(200);
		assertThat(trail()).containsExactly(member + " 2028 cancelled feeExempt - " + accountOf(THE_SUPERADMIN)
				+ " Super Admin");
	}

	/* ------------------------------------------------------------------------------------
	   A CHANGE OF BASIS
	   ------------------------------------------------------------------------------------ */

	/** „Uplata” to the exemption: the payment goes, the balance it used comes back, the exemption carries its trail. */
	@Test
	void aPaymentChangedToAnExemptionGivesBackWhatTheBalancePaidAndCarriesTheTrail() throws Exception {
		HeldOn.season(db, member, 2028, "payment");
		line(member, "-10.00", "membership", null, 2028);
		long seqBefore = count("select last_value from member_number_seq");

		MockHttpServletResponse answer = changed("000005", "{\"from\": \"payment\", \"to\": \"feeExempt\"}",
				OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(body(answer).path("basis").asString()).isEqualTo("feeExempt");

		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 feeExempt -");
		assertThat(count("select count(*) from payment where competitor_id = ? and season = 2028", member)).isZero();
		assertThat(db.sql("select decided_by || ' ' || decided_by_name || ' ' || (decided_at is not null)"
						+ " from membership where competitor_id = ? and season = 2028")
				.param(member).query(String.class).single())
				.isEqualTo(accountOf(OVER_THE_MEMBERS) + " Mira Clanovic true");
		assertThat(bookOf(member)).containsExactly("referral 5.00 -", "overpayment 4.00 2027",
				"membership -10.00 2028", "reversal 10.00 2028");
		assertThat(count("select count(*) from balance_entry where competitor_id = ?", referrer))
				.as("the referrer was rewarded a second time").isOne();

		assertThat(active(member)).isTrue();
		assertThat(count("select last_value from member_number_seq")).isEqualTo(seqBefore);
		assertThat(trail()).containsExactly(member + " 2028 basisChanged payment feeExempt "
				+ accountOf(OVER_THE_MEMBERS) + " Mira Clanovic");
		assertThat(messages()).containsExactly(member + " " + CHANGED);
		assertThat(db.sql("select body from message").query(String.class).single())
				.contains("osnov vašeg članstva je sada: oslobođenje od članarine.");
	}

	@Test
	void aPaymentThatCreditedASurplusHasItTakenBackWhenItBecomesAnExemption() throws Exception {
		HeldOn.season(db, member, 2028, "payment");
		line(member, "5.00", "overpayment", null, 2028);

		assertThat(changed("000005", "{\"from\": \"payment\", \"to\": \"feeExempt\"}", OVER_THE_MEMBERS)
				.getStatus()).isEqualTo(200);

		assertThat(bookOf(member)).containsExactly("referral 5.00 -", "overpayment 4.00 2027",
				"overpayment 5.00 2028", "reversal -5.00 2028");
	}

	/**
	 * A SURPLUS TAKEN BACK NEVER TAKES MORE THAN THE BALANCE HOLDS (PDL P8, 19.10.2026, my derivation,
	 * told to the owner: „Protivstavka viška pri stornu nikad ne skida više nego što je u tom
	 * trenutku na balansu člana").
	 *
	 * <p>A member in dinars is credited 100 dinars of surplus for 2028, moves abroad (100 dinars become
	 * 0.83 euro) and back (0.83 euro become 99.60 dinars: the rounding of each move is the portal's own,
	 * {@code Balance#translated}), and is then cancelled, or freed of the fee. The credit the season
	 * holds is 100, the balance is 99.60: taking back 100 would write a balance of -0.40, which
	 * {@code Balance.Money} refuses, and with it the whole members list and the payments list for every
	 * moderator. The line takes back 99.60 and the member keeps the 0.40 the rounding cost him.
	 *
	 * <p><b>The money is moved by his own record</b> ({@code PUT /api/me}) and not written into the
	 * book, so the 99.60 is what the portal's own conversion leaves and not a number this case chose.
	 */
	@ParameterizedTest
	@CsvSource({"cancelled", "madeAnExemption"})
	void aSurplusTakenBackAfterAnAbroadAndBackStopsAtWhatTheBalanceHolds(String door) throws Exception {
		String his = "clan-dinari-storno@primer.rs";
		long dinars = competitor("000014", "d1", true, null);
		db.sql("update competitor set place_id = (select id from place where country_id ="
						+ " (select id from country where code = 'RS') order by rank limit 1) where id = ?")
				.param(dinars).update();
		account(his, "competitor", dinars, "Dinar", "Clan");
		HeldOn.season(db, dinars, 2027, "feeExempt");
		HeldOn.season(db, dinars, 2028, "payment");
		lineIn(dinars, "100.00", "RSD", "overpayment", 2028);

		long abroad = count("select geonames_id from place where country_id <>"
				+ " (select id from country where code = 'RS') order by rank limit 1");
		long home = count("select geonames_id from place where country_id ="
				+ " (select id from country where code = 'RS') order by rank limit 1");

		assertThat(sent(put("/api/me"), "{\"placeId\": " + abroad + "}", his).getStatus()).isEqualTo(200);
		assertThat(sent(put("/api/me"), "{\"placeId\": " + home + "}", his).getStatus()).isEqualTo(200);

		assertThat(bookOf(dinars)).containsExactly("overpayment 100.00 2028", "conversion -100.00 -",
				"conversion 0.83 -", "conversion -0.83 -", "conversion 99.60 -");

		MockHttpServletResponse answer = "cancelled".equals(door)
				? cancelled("000014", "payment", OVER_THE_MEMBERS)
				: changed("000014", "{\"from\": \"payment\", \"to\": \"feeExempt\"}", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(bookOf(dinars)).as("the counter-entry took back more than the balance held")
				.endsWith("reversal -99.60 2028");
		assertThat(db.sql("select sum(amount) from balance_entry where competitor_id = ? and currency = 'RSD'")
				.param(dinars).query(BigDecimal.class).single()).isEqualByComparingTo("0.00");

		/* AND THE LISTS THAT READ EVERY BOOK STILL ANSWER, which is what a balance below nothing took away. */
		MockHttpServletResponse members = http.perform(get("/api/members")
				.cookie(new Cookie(SessionCookie.NAME, cookies.get(OVER_THE_MEMBERS)))).andReturn().getResponse();

		assertThat(members.getStatus()).isEqualTo(200);
		JsonNode hers = null;

		for (JsonNode one : body(members)) {
			if ("000014".equals(one.path("memberNumber").asString())) {
				hers = one;
			}
		}

		assertThat(hers).as("the member is not on the list").isNotNull();
		assertThat(hers.path("balance").decimalValue()).isEqualByComparingTo("0.00");
	}

	/**
	 * THE EXEMPTION TO „uplata”: booked through the one booking, the rest off his balance, and told
	 * once as a change, not also as a payment recorded.
	 */
	@Test
	void anExemptionChangedToAPaymentIsBookedWithTheRestOffTheBalance() throws Exception {
		HeldOn.season(db, member, 2028, "feeExempt");
		line(member, "16.00", "overpayment", null, 2027);

		MockHttpServletResponse answer = changed("000005",
				"{\"from\": \"feeExempt\", \"to\": \"payment\", \"received\": 18, \"method\": \"paypal\"}",
				OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(body(answer).path("basis").asString()).isEqualTo("payment");

		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 payment 2028");
		assertThat(db.sql("select received || ' ' || recorded_by_name from payment"
						+ " where competitor_id = ? and season = 2028")
				.param(member).query(String.class).single()).isEqualTo("18.00 Mira Clanovic");
		/* 38 expected, 18 arrived, his book of 25 pays the 20. */
		assertThat(bookOf(member)).containsExactly("referral 5.00 -", "overpayment 4.00 2027",
				"overpayment 16.00 2027", "membership -20.00 2028");

		assertThat(trail()).containsExactly(member + " 2028 basisChanged feeExempt payment "
				+ accountOf(OVER_THE_MEMBERS) + " Mira Clanovic");
		assertThat(messages()).containsExactly(member + " " + CHANGED);
		assertThat(db.sql("select body from message").query(String.class).single())
				.contains("osnov vašeg članstva je sada: uplata.");
	}

	/** What the payments screen refuses about a payment, refused here in its words, with nothing moved. */
	@ParameterizedTest
	@CsvSource(delimiter = '|', value = {
			"\"received\": 0, \"method\": \"paypal\"   | theAmountIsNotMoney",
			"\"received\": 18                         | theFormIsNotComplete",
			"\"received\": 18, \"method\": \"\"         | theFormIsNotComplete",
			"\"received\": 18, \"method\": \"card\"     | theMethodIsNotKnown"})
	void whatCannotBeBookedLeavesTheExemptionStanding(String money, String reason) throws Exception {
		HeldOn.season(db, member, 2028, "feeExempt");

		MockHttpServletResponse answer = changed("000005",
				"{\"from\": \"feeExempt\", \"to\": \"payment\", " + money.strip() + "}", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(body(answer).path("reason").asString()).isEqualTo(reason);
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 feeExempt -");
		assertThat(trail()).isEmpty();
		assertThat(messages()).isEmpty();
	}

	/**
	 * A BOOKING THE PRICE LIST REFUSES TAKES THE DELETION BACK: the exemption was deleted before the
	 * booking was asked, and a free price row refuses the booking, so the transaction rolls back.
	 */
	@Test
	void aBookingThatIsRefusedTakesTheDeletionOfTheExemptionBackWithIt() throws Exception {
		HeldOn.season(db, member, 2028, "feeExempt");
		db.sql("update price_row set eur = 0, rsd = 0 where kind = 'period'").update();

		MockHttpServletResponse answer = changed("000005",
				"{\"from\": \"feeExempt\", \"to\": \"payment\", \"received\": 18, \"method\": \"paypal\"}",
				OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(body(answer).path("reason").asString()).isEqualTo("theMembershipCostsNothing");
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 feeExempt -");
		assertThat(trail()).isEmpty();
		assertThat(messages()).isEmpty();
	}

	@Test
	void aSecondPressOfAChangeIsAnsweredAsDoneAndWritesNothing() throws Exception {
		HeldOn.season(db, member, 2028, "feeExempt");

		MockHttpServletResponse answer = changed("000005", "{\"from\": \"payment\", \"to\": \"feeExempt\"}",
				OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(body(answer).path("basis").asString()).isEqualTo("feeExempt");
		assertThat(trail()).isEmpty();
		assertThat(messages()).isEmpty();
	}

	@ParameterizedTest
	@CsvSource({"balance", "none"})
	void aChangeOverASeasonThatIsNotWhatTheScreenShowedIsRefused(String held) throws Exception {
		if (!"none".equals(held)) {
			HeldOn.season(db, member, 2028, held);
		}

		MockHttpServletResponse answer = changed("000005", "{\"from\": \"payment\", \"to\": \"feeExempt\"}",
				OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(body(answer).path("reason").asString()).isEqualTo("theBasisHasChanged");
		assertThat(trail()).isEmpty();
		assertThat(messages()).isEmpty();
	}

	/* ------------------------------------------------------------------------------------
	   AN EXEMPTION GRANTED ON A ROW THAT HOLDS NO SEASON ON SALE (20.10.2026)
	   ------------------------------------------------------------------------------------ */

	private static final String GRANTED = "Oslobođeni ste članarine";

	@Test
	void aGrantIsRefusedToAVisitorAndToAnybodyWithoutTheRight() throws Exception {
		assertThat(granted("000005", "feeExempt", null).getStatus()).isEqualTo(401);

		for (String refused : List.of(THE_MEMBERS_OWN, OVER_THE_PAYMENTS_ONLY)) {
			assertThat(granted("000005", "feeExempt", refused).getStatus()).as(refused).isEqualTo(404);
		}

		assertThat(granted("009999", "feeExempt", THE_SUPERADMIN).getStatus()).isEqualTo(404);
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027");
		assertThat(messages()).isEmpty();
	}

	/**
	 * THE EXEMPTION OF THE SEASON ON SALE, with the trail of who and when on the row, nothing off a book
	 * that would cover the whole fee, no second reward for his referrer, his number kept, and one message
	 * to him in the approved words. No row in the trail of changes: nothing stood to be changed.
	 */
	@Test
	void anExemptionIsGrantedForTheSeasonOnSaleWithItsTrailAndHeIsToldOnce() throws Exception {
		lineIn(member, "100.00", "EUR", "overpayment", 2027);
		List<String> hisBook = bookOf(member);
		long seqBefore = count("select last_value from member_number_seq");

		MockHttpServletResponse answer = granted("000005", "feeExempt", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(body(answer).path("season").asInt()).isEqualTo(2028);
		assertThat(body(answer).path("basis").asString()).isEqualTo("feeExempt");

		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 feeExempt -");
		assertThat(db.sql("select decided_by || ' ' || decided_by_name || ' ' || (decided_at is not null)"
						+ " from membership where competitor_id = ? and season = 2028")
				.param(member).query(String.class).single())
				.isEqualTo(accountOf(OVER_THE_MEMBERS) + " Mira Clanovic true");

		assertThat(bookOf(member)).as("the exemption spent his balance").isEqualTo(hisBook);
		assertThat(count("select count(*) from balance_entry where competitor_id = ?", referrer))
				.as("the referrer was rewarded a second time").isOne();
		assertThat(count("select last_value from member_number_seq")).isEqualTo(seqBefore);
		assertThat(db.sql("select member_number from competitor where id = ?").param(member)
				.query(String.class).single()).isEqualTo("000005");
		assertThat(active(member)).isTrue();

		assertThat(trail()).isEmpty();
		assertThat(messages()).containsExactly(member + " " + GRANTED);
		assertThat(db.sql("select body from message").query(String.class).single())
				.isEqualTo("Za sezonu 2028 oslobođeni ste plaćanja članarine i član ste lige.\n\nBalkanska trkačka liga");

		verifyNoInteractions(postman);
	}

	/** A lapsed member is made active again, and a referrer never rewarded for him is rewarded now. */
	@Test
	void aLapsedMemberIsMadeActiveAndHisReferrerRewardedTheFirstTime() throws Exception {
		long lapsed = competitor("000014", "c4", false, referrer);

		assertThat(granted("000014", "feeExempt", OVER_THE_MEMBERS).getStatus()).isEqualTo(201);

		assertThat(active(lapsed)).isTrue();
		assertThat(count("select count(*) from balance_entry where competitor_id = ? and reason = 'referral'"
				+ " and referred_competitor_id = ?", referrer, lapsed)).isOne();
		/* THE REFERRER IS THANKED FOR THE REWARD (owner, 29.10.2026), in the order the route writes: the
		   reward and its thanks inside the grant, then the notice to the member after it. The words
		   themselves are held by `TheReferrerIsThankedTest`. */
		assertThat(messages()).containsExactly(referrer + " Hvala na preporuci", lapsed + " " + GRANTED);
	}

	/** The season is the clock's: before 15 October the one run, at 00:30 of 1 January the new one, in 2026 the first. */
	@ParameterizedTest
	@CsvSource({"2027-09-10T09:00:00Z, 2027", "2027-12-31T23:30:00Z, 2028", "2026-10-18T09:00:00Z, 2027"})
	void theSeasonGrantedIsTheOneOnSaleThatDay(Instant when, int season) throws Exception {
		clock.moveTo(when);
		long fresh = competitor("000015", "c5", false, null);

		MockHttpServletResponse answer = granted("000015", "feeExempt", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(body(answer).path("season").asInt()).isEqualTo(season);
		assertThat(seasonsOf(fresh)).containsExactly(season + " feeExempt -");
	}

	@ParameterizedTest
	@CsvSource(delimiter = '|', value = {
			"{}                              | theFormIsNotComplete",
			"{\"basis\": \"\"}              | theFormIsNotComplete",
			"{\"basis\": \"honorary\"}      | theBasisIsNotKnown",
			"{\"basis\": \"payment\"}       | thisChangeIsNotOffered",
			"{\"basis\": \"balance\"}       | thisChangeIsNotOffered"})
	void aGrantOfAnythingButTheExemptionIsRefused(String json, String reason) throws Exception {
		MockHttpServletResponse answer = sent(post("/api/members/000005/membership"), json.strip(), OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(body(answer).path("reason").asString()).isEqualTo(reason);
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027");
		assertThat(messages()).isEmpty();
	}

	/** A season already free of the fee is the second press; one on another basis is what the screen did not show. */
	@ParameterizedTest
	@CsvSource({"feeExempt, 200", "payment, 409", "balance, 409"})
	void aSeasonThatStandsAlreadyIsNotGrantedAgain(String held, int status) throws Exception {
		HeldOn.season(db, member, 2028, held);

		MockHttpServletResponse answer = granted("000005", "feeExempt", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(status);
		if (status == 409) {
			assertThat(body(answer).path("reason").asString()).isEqualTo("theBasisHasChanged");
		}
		assertThat(seasonsOf(member)).containsExactly("2027 payment 2027", "2028 " + held + " "
				+ ("payment".equals(held) ? "2028" : "-"));
		assertThat(messages()).isEmpty();
	}

	/** On his own row, and the row names him; the message goes to the member, who is him. */
	@Test
	void aModeratorGrantsOnHisOwnRowAndTheRowNamesHim() throws Exception {
		db.sql("delete from payment where competitor_id = ? and season = 2028").param(theModeratorHimself).update();

		assertThat(granted("000003", "feeExempt", A_MODERATOR_WHO_IS_A_MEMBER).getStatus()).isEqualTo(201);

		assertThat(db.sql("select decided_by || ' ' || decided_by_name from membership"
						+ " where competitor_id = ? and season = 2028")
				.param(theModeratorHimself).query(String.class).single())
				.isEqualTo(accountOf(A_MODERATOR_WHO_IS_A_MEMBER) + " Pera Sopstveni");
		assertThat(messages()).containsExactly(theModeratorHimself + " " + GRANTED);
	}

	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		AClockTheCaseMoves(Instant now) {
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
			return new AClockTheCaseMoves(AFTER_THE_FIFTEENTH);
		}
	}
}
