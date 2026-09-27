package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHOSE MEMBERSHIP FOR THE SEASON IS NOT ACTIVE, AGAINST A REAL DATABASE.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND, on every axis an assertion below
 * reads a value along</b> (the rule of 06.09.2026 and its correction the same afternoon: the
 * axes are counted, not guessed). Each entry names the axis and both of its states, because a
 * fixture with one state of an axis cannot tell right from wrong along it:
 *
 * <ul>
 * <li><b>Why he is on the list.</b> Somebody with NO membership row at all
 * ({@link #NEVER_PAID}), somebody whose only row is for ANOTHER season
 * ({@link #PAID_AHEAD} and, from October of the next year, {@link #DID_NOT_RENEW}), and
 * somebody with a row for THIS one ({@link #PAID}), who must not appear. Without the middle
 * state a route that forgot the season passes, and from October 2027 that is most of the list.
 * <li><b>The basis it is held on.</b> {@code payment} ({@link #PAID}) and {@code feeExempt}
 * ({@link #FREE_OF_THE_FEE}), and BOTH take him off. With only the first, a route reading
 * recorded payments instead of memberships passes, and the man who owes nothing stays on the
 * screen for ever.
 * <li><b>The two homes of nearly one fact.</b> {@link #FLAG_SAYS_OTHERWISE} carries
 * {@code active = false} WITH a membership for the season, and {@link #PAID_AHEAD} carries
 * {@code active = true} WITHOUT one. The pair is deliberately inconsistent, because that is the
 * only shape in which „read the membership" and „read the flag" answer differently.
 * <li><b>The season.</b> Three moments and not one, because no single moment separates the
 * three methods of {@link SeasonClock} that answer with a year. See {@link #IN_OCTOBER_2026}.
 * <li><b>Whether the account names a member.</b> {@link #BOOKS} does not, which the owner
 * called the ordinary case on 14.09.2026, and he is also the one who READS the list.
 * <li><b>Whether the member has an account.</b> {@link #ONLY_IMPORTED} has none, and his row in
 * {@code competitor} is written FIRST, so „the first member by key" is somebody who must never
 * appear at all.
 * <li><b>The member number.</b> Three have none and five have one, and the one the search finds
 * by number ({@link #DID_NOT_RENEW}) is not the one the name searches find.
 * <li><b>Two people of one name.</b> {@link #NEVER_PAID} and {@link #NAMESAKE} share a first
 * and last name and neither has a number, which is the state the screen is most likely to meet
 * and the only one in which the key has to be what tells them apart.
 * <li><b>The town, held the two ways V7 allows.</b> Out of the codebook for everybody except
 * {@link #NAMESAKE}, who lives in one somebody typed - so a query reading only {@code
 * place.name} answers one of the two namesakes with nothing.
 * <li><b>The search term.</b> {@code Novak} is the GIVEN name of one man and the SURNAME of
 * another, so a search over one column alone finds one of them and passes.
 * <li><b>Whether the address is confirmed.</b> {@link #NOT_CONFIRMED} has not confirmed his,
 * and he is on the list, which is the owner's decision of 11.08.2026 and not an oversight.
 * <li><b>The reader is not the read.</b> Of the four accounts that ask, the one allowed to read
 * ({@link #BOOKS}) has no member of his own, so „the answer" and „every account there is" can
 * never be one list.
 * <li><b>The two readers' ticks OVERLAP on the decoy.</b> {@link #ANOTHER_QUEUE} says why, and it
 * is the one place this fixture deliberately does the opposite of {@code VerificationApiTest}:
 * without the overlap no case here can tell the right privilege code from a wrong one.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PaymentsDueApiTest {

	private static final String PATH = "/api/payments";

	/** An address of the same length that maps nothing, for the refusal to be compared with. */
	private static final String NOTHING_IS_THERE = "/api/zzzzzzzz";

	/**
	 * THE ONE WHO MAY READ IT, and he holds TWO queue ticks rather than one.
	 *
	 * <p>With a single tick „holds any queue" and „holds THIS queue" answer alike on every
	 * request here. He also has no member of his own, which is both the ordinary case for a
	 * moderator (owner, 14.09.2026) and what keeps the reader off the list he reads.
	 */
	private static final String BOOKS = "uplate@primer.rs";

	/**
	 * HOLDS TWO QUEUES, NEITHER OF THEM THIS ONE, AND ONE OF THEM IS ONE {@link #BOOKS} HOLDS
	 * TOO.
	 *
	 * <p>Two ticks so that a refusal cannot be read as being about an account with none. And the
	 * OVERLAP is deliberate, which is the opposite of what {@code VerificationApiTest} needs and
	 * is worth writing down for that reason: there the answer is filtered by queue, so overlapping
	 * ticks would let a filter that forgot the account pass. Nothing here is filtered by queue at
	 * all - one code on the route decides everything - so the only way a WRONG code can be caught
	 * is if some reader's verdict changes under it. With disjoint sets, putting
	 * {@code queue:comments} on the route leaves {@link #BOOKS} allowed and this account refused,
	 * exactly as the right code does, and the mutation passes. Sharing {@code queue:comments}
	 * makes that mutation open this account and the refusal below fail.
	 */
	private static final String ANOTHER_QUEUE = "drugi-red@primer.rs";

	/** Signed in and holding nothing whatever, which is every member of the league. */
	private static final String A_MEMBER = "takmicar@primer.rs";

	/** Every right with no tick anywhere (V5's {@code rights_mode = 'all'}). */
	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	/** Registered and never paid: no number, no membership row of any season. */
	private static final String NEVER_PAID = "marko@primer.rs";

	/** His namesake, first and last name alike, also with no number. */
	private static final String NAMESAKE = "marko.drugi@primer.rs";

	/**
	 * A MEMBER OF 2027 AND OF NOTHING SINCE, which is the renewal the screen exists for.
	 *
	 * <p>He is off the list while the season on sale is 2027 and back on it in October, when the
	 * season on sale becomes 2028. He is also the only person a search by member NUMBER finds.
	 */
	private static final String DID_NOT_RENEW = "jelena@primer.rs";

	/**
	 * A MEMBERSHIP FOR A SEASON THAT IS NOT THE ONE BEING ASKED ABOUT, and {@code active} true
	 * beside it.
	 *
	 * <p>Two axes in one person on purpose: he is why the default case measures the season at
	 * all (drop {@code m.season} and he vanishes), and he is the half of the flag axis that
	 * says a route reading {@code competitor.active} would leave him OUT when he belongs in.
	 */
	private static final String PAID_AHEAD = "ana@primer.rs";

	/** Freed from the fee by a decision, so his membership names no payment at all (ADL A12). */
	private static final String FREE_OF_THE_FEE = "petar@primer.rs";

	/** Paid for the season being asked about, with a recorded payment behind it. */
	private static final String PAID = "vera@primer.rs";

	/** A membership for the season, and {@code active = false} against it. */
	private static final String FLAG_SAYS_OTHERWISE = "zorica@primer.rs";

	/** Registered and has not confirmed his address, which does not keep him off the list. */
	private static final String NOT_CONFIRMED = "novak@primer.rs";

	/** Whose SURNAME is the given name of the account above, so one term reaches both. */
	private static final String SURNAMED_NOVAK = "dragan@primer.rs";

	/** A surname carrying Serbian diacritics, for the one case that measures how far the
	 *  case folding of the search reaches. */
	private static final String WITH_DIACRITICS = "mila@primer.rs";

	/** Somebody only the imported history knows: a member with no account anywhere. */
	private static final String ONLY_IMPORTED = "000270";

	/**
	 * THE DAY THE PORTAL OPENS, 1 October 2026 at nine in the morning in Belgrade.
	 *
	 * <p><b>Read on all three methods of {@link SeasonClock} that answer with a year, because
	 * which of them is right is the one thing this route could be wrong about invisibly:</b>
	 *
	 * <pre>
	 * 1 Oct 2026   seasonBeingPaidFor 2027   transfersTakeEffect 2027   seasonBeingRun 2026
	 * 1 Jun 2027   seasonBeingPaidFor 2027   transfersTakeEffect 2028   seasonBeingRun 2027
	 * 1 Oct 2027   seasonBeingPaidFor 2028   transfersTakeEffect 2028   seasonBeingRun 2027
	 * </pre>
	 *
	 * <b>So no single moment separates all three and three are needed.</b> June separates
	 * {@code transfersTakeEffect}; the following October separates {@code seasonBeingRun}; and
	 * this one separates {@code seasonBeingRun} a second way that is worth having on its own,
	 * because 2026 is a season the schema refuses to hold a membership in - so every account in
	 * the portal would surface at once on the day this shipped.
	 */
	private static final Instant IN_OCTOBER_2026 = Instant.parse("2026-10-01T07:00:00Z");

	/** Where {@code transfersTakeEffect} has moved on and the season on sale has not. */
	private static final Instant IN_JUNE_2027 = Instant.parse("2027-06-01T07:00:00Z");

	/** Where the season on sale has moved on and {@code seasonBeingRun} has not. */
	private static final Instant IN_OCTOBER_2027 = Instant.parse("2027-10-01T07:00:00Z");

	private static final String A_TOWN = "(select id from place where rank = 1)";

	/** And a town nobody found in the book, which is {@code competitor}'s other way of holding
	 *  one and the half a query reading only {@code place.name} would lose. */
	private static final String TYPED_TOWN = "Mostar";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	/** Feeds the sixteen lowercase hexadecimal characters {@code referral_code} needs. */
	private int issued;

	private String booksCookie;

	private String anotherQueueCookie;

	private String memberCookie;

	private String superadminCookie;

	private long neverPaid;

	private long namesake;

	private long didNotRenew;

	private long paidAhead;

	private long freeOfTheFee;

	private long paid;

	private long flagSaysOtherwise;

	private long notConfirmed;

	private long surnamedNovak;

	private long withDiacritics;

	private long aMembersOwnRecord;

	private long onlyImported;

	/**
	 * A CLOCK THE CASE MOVES, so that all three moments are one fixture.
	 *
	 * <p>It reports UTC as its zone on purpose, the shape every other case in this package
	 * uses: whoever works out a season has to re-read the instant in the league's own time, and
	 * a server that reads this zone instead answers with the wrong month on the one evening that
	 * matters.
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
			return new AClockTheCaseMoves(IN_OCTOBER_2026);
		}
	}

	/**
	 * FOUR ACCOUNTS THAT ASK, TEN PEOPLE, ELEVEN RECORDS AND FOUR MEMBERSHIPS.
	 *
	 * <p>The member of the imported history is written FIRST and on purpose: he has no account,
	 * so he must never appear, and being first by key means a route answering „the first member"
	 * or joining the two tables the wrong way round answers with the one person who cannot be
	 * on the list at all.
	 */
	@BeforeEach
	void fourReadersAndTenPeople() {
		clock.moveTo(IN_OCTOBER_2026);

		/* FIRST BY KEY, AND HE HAS NO ACCOUNT. */
		onlyImported = competitor(ONLY_IMPORTED, "Uvezeni", "Uvezenovic", true);

		booksCookie = account(BOOKS, "moderator", "Uros", "Uplatic", true);
		anotherQueueCookie = account(ANOTHER_QUEUE, "moderator", "Dragana", "Drugic", true);
		memberCookie = account(A_MEMBER, "competitor", "Tijana", "Takic", true);
		superadminCookie = account(THE_SUPERADMIN, "superadmin", "Sanja", "Simic", true);

		ticked(BOOKS, "queue:payments", "queue:comments");
		/* SHARES `queue:comments` ON PURPOSE. See the note on ANOTHER_QUEUE: without the overlap,
		   a wrong right code on the route is not caught by anything here. */
		ticked(ANOTHER_QUEUE, "queue:comments", "queue:teams");

		/* THE READER HOLDING THE TICK HAS NO MEMBER OF HIS OWN, which is left exactly as the
		   `account` helper made it: `competitor_id` stays empty. */
		aMembersOwnRecord = competitor(null, "Tijana", "Takic", false);
		belongsTo(A_MEMBER, aMembersOwnRecord);

		neverPaid = competitor(null, "Marko", "Markovic", false);
		namesake = competitor(null, "Marko", "Markovic", false);
		didNotRenew = competitor("000210", "Jelena", "Petrovic", true);
		paidAhead = competitor("000220", "Ana", "Nikolic", true);
		freeOfTheFee = competitor("000230", "Petar", "Ilic", true);
		paid = competitor("000240", "Vera", "Vukovic", true);
		flagSaysOtherwise = competitor("000260", "Zorica", "Zoric", false);
		notConfirmed = competitor(null, "Novak", "Jovanovic", false);
		surnamedNovak = competitor("000250", "Dragan", "Novak", true);
		withDiacritics = competitor(null, "Mila", "Čačić", false);

		account(NEVER_PAID, "competitor", "Marko", "Markovic", true, neverPaid);
		account(NAMESAKE, "competitor", "Marko", "Markovic", true, namesake);
		account(DID_NOT_RENEW, "competitor", "Jelena", "Petrovic", true, didNotRenew);
		account(PAID_AHEAD, "competitor", "Ana", "Nikolic", true, paidAhead);
		account(FREE_OF_THE_FEE, "competitor", "Petar", "Ilic", true, freeOfTheFee);
		account(PAID, "competitor", "Vera", "Vukovic", true, paid);
		account(FLAG_SAYS_OTHERWISE, "competitor", "Zorica", "Zoric", true, flagSaysOtherwise);
		account(SURNAMED_NOVAK, "competitor", "Dragan", "Novak", true, surnamedNovak);
		account(WITH_DIACRITICS, "competitor", "Mila", "Čačić", true, withDiacritics);

		/* THE ONE WHOSE ADDRESS IS NOT CONFIRMED. */
		account(NOT_CONFIRMED, "competitor", "Novak", "Jovanovic", false, notConfirmed);

		/* ONE OF THE TWO NAMESAKES LIVES IN A TOWN SOMEBODY TYPED, so the two rows differ along
		   the town axis as well and a query reading only `place.name` answers one of them
		   blank. */
		livesInATownSomebodyTyped(namesake, TYPED_TOWN, "BA");

		/* FOUR MEMBERSHIPS, ALONG EVERY AXIS THE ROUTE READS ONE.
		   2027 is the season on sale at `IN_OCTOBER_2026` and at `IN_JUNE_2027`; 2028 is the
		   season on sale at `IN_OCTOBER_2027`. */
		membershipOnAPayment(paid, 2027);
		membershipFreeOfTheFee(freeOfTheFee, 2027);
		membershipOnAPayment(flagSaysOtherwise, 2027);

		/* FOR 2027 ONLY, so he is off the list until the season on sale becomes 2028. */
		membershipOnAPayment(didNotRenew, 2027);

		/* AND ONE FOR A SEASON THAT IS NOT THE ONE ASKED ABOUT AT THE DEFAULT MOMENT, which is
		   what makes the default case measure `m.season` rather than only the October one. */
		membershipOnAPayment(paidAhead, 2028);
	}

	/**
	 * THE WHOLE ANSWER AT THE MOMENT THE PORTAL OPENS, named row by row.
	 *
	 * <p>Written as the exact list rather than as „contains" so that it says what is NOT there
	 * as well: the moderator who does not race, the member of the imported history, and the four
	 * people whose membership for this season stands.
	 */
	@Test
	void theListIsEveryAccountWhoseMembershipForTheSeasonIsMissingAndNobodyElse() throws Exception {
		JsonNode answer = read(booksCookie, null);

		assertThat(answer.get("season").asInt()).isEqualTo(2027);
		assertThat(keysIn(answer))
				.containsExactly(withDiacritics, notConfirmed, neverPaid, namesake, paidAhead,
						surnamedNovak, aMembersOwnRecord)
				.doesNotContain(onlyImported, paid, freeOfTheFee, flagSaysOtherwise, didNotRenew);
	}

	/**
	 * AND THE MODERATOR READING IT IS NOT ON IT, because he has no member of his own.
	 *
	 * <p>Asked as a count of the accounts rather than of the members: he is one of fourteen
	 * accounts and the only reader with a tick, so a route joining the two tables the other way
	 * round puts the administration on the screen as people who owe a fee.
	 */
	@Test
	void anAccountWithNoMemberOfItsOwnIsNotOnTheListAlthoughItHasNoMembershipEither() throws Exception {
		Long moderatorsMember = db.sql("select competitor_id from account where email = ?")
				.param(BOOKS).query(Long.class).optional().orElse(null);

		assertThat(moderatorsMember)
				.as("the fixture stopped saying what it is for: this reader must have no member")
				.isNull();

		assertThat(keysIn(read(booksCookie, null))).hasSize(7);
	}

	/**
	 * SOMEBODY ONLY THE IMPORT KNOWS IS NOT ON THE LIST, and he is the first member by key.
	 *
	 * <p>Owner, 27.09.2026: „NIKO SE NE DOVODI U PORTAL DOK SE SAM NE PRIJAVI KAD DODJE VREME."
	 * The import makes no accounts, so the list begins empty and fills; a route reading
	 * {@code competitor} instead of {@code account} would open on the first day with the whole
	 * imported history on it.
	 */
	@Test
	void aMemberWithNoAccountIsNotOnTheListAlthoughHeHasNoMembershipForTheSeason() throws Exception {
		assertThat(db.sql("select exists(select 1 from membership where competitor_id = ?)")
				.param(onlyImported).query(Boolean.class).single())
				.as("the fixture stopped saying what it is for")
				.isFalse();

		assertThat(keysIn(read(booksCookie, null))).doesNotContain(onlyImported);
	}

	/**
	 * THE SEASON IS THE ONE BEING PAID FOR AND NOT THE ONE TRANSFERS TAKE EFFECT IN.
	 *
	 * <p>In June the two part company: {@link SeasonClock#transfersTakeEffect} has moved to 2028
	 * while what is on sale is still 2027. A route reading the wrong one answers about a season
	 * nobody has paid for yet, so everybody who HAS paid for 2027 comes back onto the screen and
	 * the moderator books them twice.
	 */
	@Test
	void theSeasonIsTheOneOnSaleAndNotTheOneTransfersTakeEffectIn() throws Exception {
		clock.moveTo(IN_JUNE_2027);

		assertThat(SeasonClock.transfersTakeEffect(IN_JUNE_2027.atZone(SeasonClock.ZONE)))
				.as("the moment stopped separating the two methods, so this case measures nothing")
				.isNotEqualTo(SeasonClock.seasonBeingPaidFor(IN_JUNE_2027.atZone(SeasonClock.ZONE)));

		JsonNode answer = read(booksCookie, null);

		assertThat(answer.get("season").asInt()).isEqualTo(2027);
		assertThat(keysIn(answer)).doesNotContain(paid, freeOfTheFee, flagSaysOtherwise, didNotRenew);
	}

	/**
	 * AND IT IS NOT THE SEASON BEING RUN, measured where that one is a year the league does not
	 * have.
	 *
	 * <p>On the day the portal opens {@link SeasonClock#seasonBeingRun} answers 2026, and
	 * {@code membership_season_not_before_the_league} makes a membership of 2026 impossible - so
	 * a route reading it would find no membership for anybody and surface every account in the
	 * portal at once. The assertion is the season on the answer, because that is the value the
	 * whole list is worked out from.
	 */
	@Test
	void theSeasonIsNotTheOneBeingRunWhichOnTheOpeningDayIsNoSeasonAtAll() throws Exception {
		assertThat(SeasonClock.seasonBeingRun(IN_OCTOBER_2026.atZone(SeasonClock.ZONE)))
				.as("the moment stopped separating the two methods, so this case measures nothing")
				.isEqualTo(2026);

		assertThat(read(booksCookie, null).get("season").asInt()).isEqualTo(2027);
	}

	/**
	 * IN OCTOBER OF THE NEXT YEAR THE LIST IS ABOUT 2028, so last season's member is on it again.
	 *
	 * <p>This is the renewal the screen exists for, and the one moment that separates
	 * {@link SeasonClock#seasonBeingRun} from what is on sale while both are seasons the league
	 * has. {@link #PAID_AHEAD} goes the other way in the same breath: his row IS 2028, so he
	 * leaves the list on the same day the other four join it.
	 */
	@Test
	void inOctoberOfTheNextYearTheSeasonOnSaleMovesOnAndLastYearsMembersAreBackOnTheList()
			throws Exception {
		clock.moveTo(IN_OCTOBER_2027);

		JsonNode answer = read(booksCookie, null);

		assertThat(answer.get("season").asInt()).isEqualTo(2028);
		assertThat(keysIn(answer))
				.contains(didNotRenew, paid, freeOfTheFee, flagSaysOtherwise)
				.doesNotContain(paidAhead, onlyImported);
	}

	/**
	 * A MEMBERSHIP HELD FREE OF THE FEE TAKES HIM OFF THE LIST, although no payment exists.
	 *
	 * <p>ADL A12, widened by the owner on 26.09.2026: activation is a recorded payment, a board
	 * decision freeing him from the fee, or a balance. A route reading recorded payments rather
	 * than memberships keeps him on the screen for ever, and the moderator is booking money
	 * nobody owes.
	 */
	@Test
	void aMembershipHeldFreeOfTheFeeTakesHimOffTheListAlthoughNoPaymentStandsBehindIt()
			throws Exception {
		assertThat(db.sql("select exists(select 1 from payment where competitor_id = ?)")
				.param(freeOfTheFee).query(Boolean.class).single())
				.as("the fixture stopped saying what it is for: this membership names no payment")
				.isFalse();

		assertThat(keysIn(read(booksCookie, null))).doesNotContain(freeOfTheFee);
	}

	/**
	 * WHETHER HE IS ON THE LIST IS READ OFF THE MEMBERSHIP AND NEVER OFF THE FLAG.
	 *
	 * <p>{@code competitor.active} is the other home of nearly the same fact, it carries no
	 * season, and nothing in {@code src/main} ever sets it back to false. The two accounts here
	 * disagree in opposite directions, so a route reading the flag is wrong about both of them
	 * and a route reading the membership is right about both.
	 */
	@Test
	void theListIsReadOffTheMembershipAndNotOffTheFlagOnTheMember() throws Exception {
		assertThat(db.sql("select active from competitor where id = ?")
				.param(flagSaysOtherwise).query(Boolean.class).single())
				.as("the fixture stopped saying what it is for")
				.isFalse();
		assertThat(db.sql("select active from competitor where id = ?")
				.param(paidAhead).query(Boolean.class).single())
				.as("the fixture stopped saying what it is for")
				.isTrue();

		assertThat(keysIn(read(booksCookie, null)))
				.doesNotContain(flagSaysOtherwise)
				.contains(paidAhead);
	}

	/**
	 * AN ADDRESS NOT YET CONFIRMED DOES NOT KEEP HIM OFF THE LIST.
	 *
	 * <p>Owner, 11.08.2026, changing his own decision of 31.07.2026: „Clanstvo sme da se aktivira
	 * i pre nego sto je adresa potvrdjena", his word being „Sme". {@code POST /api/payments} reads
	 * that column nowhere either, so keeping him off here would make the man whose money has
	 * arrived the one man who cannot be booked.
	 */
	@Test
	void anAddressNotYetConfirmedIsOnTheListBecauseTheMoneyMayArriveBeforeTheClick()
			throws Exception {
		assertThat(db.sql("select email_confirmed_at from account where email = ?")
				.param(NOT_CONFIRMED).query(Timestamp.class).optional())
				.as("the fixture stopped saying what it is for")
				.isEmpty();

		assertThat(keysIn(read(booksCookie, null))).contains(notConfirmed);
	}

	/**
	 * THE KEY SERVED IS THE MEMBER'S OWN AND NOT HIS NUMBER, which is the whole purpose of the
	 * route.
	 *
	 * <p>{@code POST /api/payments} takes a {@code competitorId} and no other identity, and most
	 * of this list has no member number at all - so a route answering with the number leaves
	 * exactly the people it exists for unbookable. Asked against the keys in the database rather
	 * than against a literal, and over the two namesakes, because for them the number is blank on
	 * both rows and the key is the only thing that differs.
	 */
	@Test
	void theKeyServedIsTheMembersOwnAndTellsTwoPeopleOfOneNameApart() throws Exception {
		List<Long> both = keysIn(read(booksCookie, "Markovic"));

		assertThat(both).containsExactly(neverPaid, namesake);
		assertThat(neverPaid).isNotEqualTo(namesake);

		for (JsonNode row : read(booksCookie, "Markovic").get("accounts")) {
			assertThat(row.get("memberNumber").asString()).isEmpty();
			assertThat(row.get("firstName").asString()).isEqualTo("Marko");
			assertThat(row.get("lastName").asString()).isEqualTo("Markovic");
		}
	}

	/**
	 * AND THE TOWN IS WHAT A READER CAN TELL THEM APART BY, held the two ways V7 allows.
	 *
	 * <p>Its reason is new rather than inherited: the queue drew a town because PDL P8 hung the
	 * way somebody pays on it, and the owner's decision of 27.09.2026 took the amount, the
	 * currency and the method out of activation altogether. What is left is that nothing stops
	 * two people sharing a name, most of this list has no number, and a moderator picking the
	 * wrong row books one man's money to another.
	 */
	@Test
	void theTwoNamesakesAreToldApartByTheirTownWhicheverOfTheTwoWaysItIsHeld() throws Exception {
		List<String> towns = new ArrayList<>();

		for (JsonNode row : read(booksCookie, "Markovic").get("accounts")) {
			towns.add(row.get("city").asString());
		}

		String fromTheCodebook = db.sql("select name from place where rank = 1")
				.query(String.class).single();

		assertThat(towns).containsExactly(fromTheCodebook, TYPED_TOWN);
	}

	/**
	 * THE MEMBER NUMBER IS SERVED WHERE THERE IS ONE AND BLANK WHERE THERE IS NOT.
	 *
	 * <p>Asked of two people who are BOTH on the list at this moment, which is why it is not
	 * {@link #DID_NOT_RENEW}: he carries a number and his membership for 2027 stands, so at this
	 * moment he is correctly absent and a case asking him would measure the season instead.
	 */
	@Test
	void theMemberNumberIsServedWhereThereIsOneAndBlankWhereThereIsNot() throws Exception {
		assertThat(numberOf(read(booksCookie, "Nikolic"))).containsExactly("000220");

		JsonNode nameless = read(booksCookie, "Jovanovic").get("accounts").get(0);
		JsonNode number = nameless.path("memberNumber");

		/* BLANK AND NEVER ABSENT, ASKED AS TWO THINGS, and the first of them is here because
		   the second alone did not measure it. `asString()` answers an empty string for a null
		   node as readily as for an empty one, so „containsExactly("")" was satisfied by both
		   shapes and a mutation dropping the coalesce passed. This is the only reading that
		   tells the two apart. */
		assertThat(number.isNull() || number.isMissingNode())
				.as("the field must carry an empty string, so a screen draws an empty cell"
						+ " without having to ask whether it is there")
				.isFalse();
		assertThat(number.asString()).isEmpty();
	}

	/** AND HE IS FOUND BY IT, which is the first of the three keys the owner named. */
	@Test
	void theSearchFindsHimByHisMemberNumber() throws Exception {
		clock.moveTo(IN_OCTOBER_2027);

		assertThat(keysIn(read(booksCookie, "000210"))).containsExactly(didNotRenew);
	}

	/**
	 * ONE TERM FINDS THE MAN WHOSE GIVEN NAME IT IS AND THE MAN WHOSE SURNAME IT IS.
	 *
	 * <p>The two keys the owner named after the number are „ime" and „prezime", and a search
	 * written over one column answers one of these two men and looks right. {@code Novak} is a
	 * given name in Serbian and a surname in Serbian, which is what makes the pair possible.
	 *
	 * <p><b>And this is the case that holds both keys now that the route reads the two names
	 * JOINED rather than one at a time.</b> Separate per-column readings were removed as dead -
	 * every substring of either name is a substring of the pair, so deleting each of them passed a
	 * mutation - which means this pair of men is the whole of what says „ime" and „prezime" still
	 * work. Deleting the joined reading fails here, and nothing else would say so.
	 */
	@Test
	void oneTermFindsBothTheManWhoseGivenNameItIsAndTheManWhoseSurnameItIs() throws Exception {
		assertThat(keysIn(read(booksCookie, "Novak")))
				.containsExactly(notConfirmed, surnamedNovak);
	}

	/**
	 * A TERM TYPED AS A WHOLE NAME FINDS HIM, AND THAT IS MY REASONING RATHER THAN A DECISION.
	 *
	 * <p>The owner named three keys. His reason for wanting a search was that he reads a bank
	 * statement and looks for a named man, and on a statement the name is one string - so a term
	 * of „Marko Markovic" finding nothing would be a miss on the first day. Written down as mine
	 * so that nobody later reads it as his.
	 */
	@Test
	void aTermTypedAsAWholeNameFindsHimAlthoughNoColumnHoldsItThatWay() throws Exception {
		assertThat(keysIn(read(booksCookie, "Marko Markovic")))
				.containsExactly(neverPaid, namesake);
	}

	/**
	 * HOW FAR THE CASE FOLDING OF THE SEARCH REACHES, MEASURED AND NOT ASSUMED.
	 *
	 * <p>{@code ILIKE} folds case; it does not strip marks, and V1 creates no extension at all,
	 * so {@code unaccent} is not there to be reached for and a migration is not this route's to
	 * write. <b>So the boundary is written down rather than pretended away:</b> a term with the
	 * marks finds her in either case, and a term without them does not find her at all.
	 */
	@Test
	void theSearchFoldsCaseIncludingSerbianLettersAndDoesNotStripTheMarks() throws Exception {
		assertThat(keysIn(read(booksCookie, "čačić"))).containsExactly(withDiacritics);
		assertThat(keysIn(read(booksCookie, "ČAČIĆ"))).containsExactly(withDiacritics);
		assertThat(keysIn(read(booksCookie, "cacic"))).isEmpty();
	}

	/**
	 * AND IT FOLDS CASE ON PLAIN LETTERS TOO, asked separately so the case above is about the
	 * marks and this one about the folding.
	 */
	@Test
	void theSearchFindsHimWhateverCaseTheTermIsTypedIn() throws Exception {
		assertThat(keysIn(read(booksCookie, "NIKOLIC"))).isEqualTo(keysIn(read(booksCookie, "nikolic")));
		assertThat(keysIn(read(booksCookie, "nikolic"))).containsExactly(paidAhead);
	}

	/**
	 * A TERM NOBODY MATCHES IS AN EMPTY LIST AND NOT A REFUSAL, and the season still comes with
	 * it.
	 */
	@Test
	void aTermNobodyMatchesIsAnEmptyListUnderTheSeasonAndNotARefusal() throws Exception {
		JsonNode answer = read(booksCookie, "Nepostojeci");

		assertThat(answer.get("season").asInt()).isEqualTo(2027);
		assertThat(keysIn(answer)).isEmpty();
	}

	/**
	 * NOT SENT, EMPTY AND NOTHING BUT SPACES ARE ONE ANSWER: THE WHOLE LIST.
	 *
	 * <p>ADL A54 asks every route to say which of the two meanings an omitted field has. Here it
	 * means „do not narrow" and can never mean „match nothing", and no length of term is refused,
	 * because no decision sets one.
	 */
	@ParameterizedTest
	@NullSource
	@ValueSource(strings = { "", "   " })
	void anAbsentOrBlankTermMeansTheWholeListAndIsNeverRefused(String term) throws Exception {
		assertThat(keysIn(read(booksCookie, term))).hasSize(7);
	}

	/**
	 * THE ORDER IS BY SURNAME, THEN GIVEN NAME, THEN KEY, and the last of the three is what
	 * makes it total.
	 *
	 * <p>Two people of one name are in the fixture precisely so that the tie exists: without the
	 * key the two could swap places between two readings of data nobody has touched, and a
	 * moderator working down the screen would find it reshuffled.
	 */
	@Test
	void theOrderIsBySurnameThenGivenNameThenKey() throws Exception {
		List<String> surnames = new ArrayList<>();

		for (JsonNode row : read(booksCookie, null).get("accounts")) {
			surnames.add(row.get("lastName").asString());
		}

		assertThat(surnames)
				.containsExactly("Čačić", "Jovanovic", "Markovic", "Markovic", "Nikolic", "Novak",
						"Takic");

		assertThat(keysIn(read(booksCookie, "Markovic")))
				.as("two people of one name come back in the order of their keys")
				.containsExactly(Math.min(neverPaid, namesake), Math.max(neverPaid, namesake));
	}

	/**
	 * AN EMPTY LIST IS THE ORDINARY STATE OF THE DAY THE PORTAL OPENS, and not a refusal.
	 *
	 * <p>Owner, 27.09.2026: the list „pocinje PRAZAN i raste kako se ljudi sami prijavljuju".
	 * Measured by giving every account a membership for the season rather than by emptying the
	 * tables, so what is asserted is the route's own emptiness and not an empty database.
	 */
	@Test
	void whenEverybodyHasAMembershipForTheSeasonTheListIsEmptyAndStillAnAnswer() throws Exception {
		for (long member : keysIn(read(booksCookie, null))) {
			membershipFreeOfTheFee(member, 2027);
		}

		JsonNode answer = read(booksCookie, null);

		assertThat(answer.get("season").asInt()).isEqualTo(2027);
		assertThat(answer.get("accounts").isArray()).isTrue();
		assertThat(keysIn(answer)).isEmpty();
	}

	/** NOBODY SIGNED IN IS ASKED TO SIGN IN, which is the chain's answer and not this route's. */
	@Test
	void nobodySignedInIsAskedToSignInRatherThanRefused() throws Exception {
		assertThat(http.perform(get(PATH)).andReturn().getResponse().getStatus()).isEqualTo(401);
	}

	/**
	 * A MODERATOR HOLDING ANOTHER QUEUE IS ANSWERED WHAT AN ADDRESS THAT IS NOT THERE ANSWERS.
	 *
	 * <p>ADL A8, the owner on 13.09.2026 in one word: 404 and never 403, because the server has
	 * no business being the one place that says the address is there at all. He holds two queues,
	 * neither of them this one, so the refusal cannot be read as being about an account with no
	 * ticks. Compared against a missing address rather than against a number, so the day one of
	 * them moves the other has to move with it.
	 */
	@Test
	void aModeratorHoldingAnotherQueueIsToldNoMoreThanSomebodyAskingForNothing() throws Exception {
		int refused = http.perform(asking(anotherQueueCookie, get(PATH)))
				.andReturn().getResponse().getStatus();
		int missing = http.perform(asking(anotherQueueCookie, get(NOTHING_IS_THERE)))
				.andReturn().getResponse().getStatus();

		assertThat(refused).isEqualTo(missing).isEqualTo(404);
	}

	/** AND SO IS A PLAIN MEMBER, although he is signed in and has a record of his own. */
	@Test
	void aPlainMemberIsRefusedTheListAlthoughHeIsOnIt() throws Exception {
		assertThat(http.perform(asking(memberCookie, get(PATH))).andReturn().getResponse().getStatus())
				.isEqualTo(404);
	}

	/** THE SUPERADMIN READS IT WITH NO TICK ANYWHERE (V5's {@code rights_mode = 'all'}). */
	@Test
	void theSuperadminReadsItWithoutHoldingATick() throws Exception {
		assertThat(db.sql("select exists(select 1 from account_admin_right"
						+ " where account_id = (select id from account where email = ?))")
				.param(THE_SUPERADMIN).query(Boolean.class).single())
				.as("the fixture stopped saying what it is for: he holds no tick")
				.isFalse();

		assertThat(keysIn(read(superadminCookie, null))).hasSize(7);
	}

	private JsonNode read(String cookie, String term) throws Exception {
		MockHttpServletRequestBuilder asking = term == null ? get(PATH) : get(PATH).param("search", term);

		String served = http.perform(asking(cookie, asking)).andReturn()
				.getResponse().getContentAsString();

		return mapper.readTree(served);
	}

	private MockHttpServletRequestBuilder asking(String cookie, MockHttpServletRequestBuilder what) {
		return what.cookie(new Cookie(SessionCookie.NAME, cookie));
	}

	private List<Long> keysIn(JsonNode answer) {
		List<Long> keys = new ArrayList<>();

		for (JsonNode row : answer.get("accounts")) {
			keys.add(row.get("competitorId").asLong());
		}

		return keys;
	}

	private List<String> numberOf(JsonNode answer) {
		List<String> numbers = new ArrayList<>();

		for (JsonNode row : answer.get("accounts")) {
			numbers.add(row.get("memberNumber").asString());
		}

		return numbers;
	}

	private String account(String email, String role, String first, String last, boolean confirmed) {
		return account(email, role, first, last, confirmed, null);
	}

	private String account(String email, String role, String first, String last, boolean confirmed,
			Long member) {

		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at,"
						+ " competitor_id)"
						+ " values (?, ?, ?, (select id from role where code = ?), ?, ?)")
				.params(first, last, email, role,
						confirmed ? Timestamp.from(IN_OCTOBER_2026.minus(Duration.ofDays(2))) : null,
						member)
				.update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}

	private void belongsTo(String email, long member) {
		db.sql("update account set competitor_id = ? where email = ?").params(member, email).update();
	}

	private void ticked(String email, String... rights) {
		for (String right : rights) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, right).update();
		}
	}

	/** @param number null for somebody who has registered and never paid, which since V16 is an
	 *                ordinary state and not a broken row */
	private long competitor(String number, String first, String last, boolean active) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01', " + A_TOWN + ", 2027, false, ?,"
						+ " 'payment', ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, first, last, active, String.format("%016x", ++issued))
				.query(Long.class).single();
	}

	/**
	 * MOVES ONE PERSON OUT OF THE CODEBOOK AND INTO A TOWN SOMEBODY WROTE OUT.
	 *
	 * <p>Both columns at once, because {@code competitor_town_is_from_the_codebook_or_typed}
	 * refuses a row holding both and refuses one holding neither.
	 */
	private void livesInATownSomebodyTyped(long member, String town, String countryCode) {
		db.sql("update competitor set place_id = null, city = ?,"
						+ " country_id = (select id from country where code = ?) where id = ?")
				.params(town, countryCode, member).update();
	}

	/** A membership standing on a recorded payment, which is the ordinary way one is held. */
	private void membershipOnAPayment(long member, int season) {
		long payment = db.sql("insert into payment (competitor_id, season, price_row_id, amount,"
						+ " currency, fee, method, state, recorded_at, recorded_by_name)"
						+ " values (?, ?, (select id from price_row order by sort_order limit 1),"
						+ " 30.00, 'EUR', 3.00, 'slip', 'recorded', ?, 'Moderator Koji Je Proknjizio')"
						+ " returning id")
				.params(member, season, Timestamp.from(IN_OCTOBER_2026))
				.query(Long.class).single();

		db.sql("insert into membership (competitor_id, season, basis, payment_id)"
						+ " values (?, ?, 'payment', ?)")
				.params(member, season, payment).update();
	}

	/**
	 * And one held on a decision of the board, which names no payment at all (ADL A12).
	 *
	 * <p><b>It names who entered it and when, because V35 requires that of every exemption</b>
	 * ({@code membership_free_of_the_fee_says_who} and {@code ..._says_when}). Those two arrived
	 * on {@code main} while this branch was being measured: the branch touched none of their
	 * files and was green on its own, and the two rows this helper writes would have broken the
	 * gate the moment the two were in one schema. It is the intersection that is a TABLE rather
	 * than a file.
	 */
	private void membershipFreeOfTheFee(long member, int season) {
		db.sql("insert into membership (competitor_id, season, basis, payment_id,"
						+ " decided_by_name, decided_at)"
						+ " values (?, ?, 'feeExempt', null, 'Moderator Koji Je Oslobodio', ?)")
				.params(member, season, Timestamp.from(IN_OCTOBER_2026)).update();
	}
}
