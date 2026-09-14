package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHAT IS WAITING FOR A MODERATOR, AND ONLY IN THE QUEUES THIS ONE MAY WORK IN.
 *
 * <p>This is the resource that has already caused the worst leak of the project - a public
 * page read the queue to find approved comments and handed every visitor „adrese
 * neaktiviranih članova i tekstove neodobrenih komentara" (owner, 07.08.2026,
 * {@code PDL.md:3815}) - so most of this file is about who does NOT get what.
 *
 * <p><b>NOBODY HERE IS THE ONLY ONE OF HIS KIND, on any axis an assertion below reads a
 * value along</b> (the rule of 06.09.2026 and its correction the same afternoon, that the
 * axes are counted rather than guessed):
 *
 * <ul>
 * <li><b>Two queue ticks each, never one.</b> With a single tick apiece „holds any queue"
 * and „holds THIS queue" answer alike on every request here.
 * <li><b>The two moderators' queues are DISJOINT.</b> Overlapping, a filter that forgot to
 * name the account would hand each of them a set that happens to contain what he expected.
 * <li><b>A moderator holding only ENTITY rights.</b> Without him „holds a queue" and „holds
 * anything at all" are one sentence, and a refusal written the second way passes.
 * <li><b>A moderator holding nothing beside him</b>, so the refusal above is not about the
 * one account that was made and never given a tick.
 * <li><b>Two empty queues, and they are empty in the two different ways.</b> One has been
 * worked to the bottom (every row decided) and one never held anything, which are the two
 * shapes „Prazan red ostaje i piše 0" (owner, 29.08.2026) has to survive.
 * <li><b>Two items in a queue, never one</b>, so „this item" and „the first item" are
 * different, and their days differ so the ordering measures an {@code order by}.
 * <li><b>A queue with a decided row beside its waiting ones</b>, so „what is waiting" and
 * „what is in this tab" are different sets.
 * <li><b>Members, a lapsed member, and somebody with no number at all</b>, so the field
 * that names whose item it is has three sources and not one.
 * <li><b>The reader is not one of the read.</b> Every moderator below is refused the
 * queues of the other, so „the answer" and „the whole table" can never be the same list.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class VerificationApiTest {

	private static final String PATH = "/api/verification";

	/** An address of the same length that maps nothing, for the refusal to be compared with. */
	private static final String NOTHING_IS_THERE = "/api/zzzzzzzzzzzz";

	/** Two queues, and neither of them is one the moderator below holds. */
	private static final String TWO_QUEUES = "vesna@primer.rs";

	/** And two others, so no fixed set of codes satisfies both. */
	private static final String OTHER_QUEUES = "bojan@primer.rs";

	/** Rights, and not one of them a queue: the case „holds a queue" must not read as
	 *  „holds anything". */
	private static final String ONLY_ENTITIES = "milica@primer.rs";

	/** Just made, and may do nothing yet. */
	private static final String NO_TICKS = "novi@primer.rs";

	/** Signed in and holding nothing whatever, which is every member of the league. */
	private static final String A_COMPETITOR = "takmicar@primer.rs";

	/** Every queue, with no tick anywhere (V5's {@code rights_mode = 'all'}). */
	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	private static final String COMMENTS = "comments";

	private static final String RESULTS = "results";

	private static final String TEAMS = "teams";

	private static final String PROFILES = "profiles";

	private static final String PAYMENTS = "payments";

	private static final String SCHEDULE = "schedule";

	private static final String MEMBER_ONE = "000010";

	private static final String MEMBER_TWO = "000020";

	/** The one member of the fixture whose fee has lapsed, and who stays in the queue. */
	private static final String LAPSED = "000030";

	/**
	 * HALF PAST TEN AT NIGHT IN UTC ON 14 SEPTEMBER, which is already the 15th in Belgrade
	 * and still the 14th in London and in plain UTC.
	 *
	 * <p>The same instant {@code AttendanceApiTest} chose and for the reason measured there:
	 * 23:30 could not tell Belgrade from London, because both are ahead of UTC in September
	 * and both had already crossed midnight. One hour earlier, only the league's own zone
	 * crosses. What it still cannot separate is a zone that shares Belgrade's offset on this
	 * date - Paris, Berlin, Budapest - because no fixed instant can separate two zones that
	 * never disagree.
	 */
	private static final String RAISED_LATE_IN_UTC = "2026-09-14 22:30:00+00";

	/** Which day that instant is in the league's own time. */
	private static final String BELGRADE_NEXT_DAY = "2026-09-15";

	/** And the day it is on a machine kept in UTC, or in London. */
	private static final String THE_MACHINES_DAY = "2026-09-14";

	private static final String THE_REASON = "Uplatnica nije citljiva";

	private static final String THE_DECIDER = "Moderator Koji Je Odlucio";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/** Feeds the sixteen lowercase hexadecimal characters {@code referral_code} needs. */
	private int issued;

	private long photo;

	/**
	 * SIX ACCOUNTS, FOUR PEOPLE IN THE RECORD, SIX TABS AND EIGHT ROWS, OF WHICH SIX WAIT.
	 *
	 * <p>The tabs are laid out so that every sentence the owner wrote about this screen has
	 * a row that would break if it stopped being true:
	 *
	 * <ul>
	 * <li>{@code comments} waits twice and has been answered once, so „only what waits"
	 * is a subtraction and not the whole tab.
	 * <li>{@code results} has been worked to the bottom - one approved, one refused - which
	 * is the tab „Neka ipak ne nestaju stavke iz Verifikacije kad se odobre" is about.
	 * <li>{@code schedule} never held anything, which is the same nought arrived at the
	 * other way.
	 * <li>{@code profiles} waits twice and one of the two carries a photograph.
	 * <li>{@code teams} waits once, so a tab with a single item is in the fixture too.
	 * <li>{@code payments} waits once, about somebody who has registered and has no number,
	 * which V16 made an ordinary state rather than a broken row.
	 * </ul>
	 */
	@BeforeEach
	void sixAccountsAndSixTabs() {
		account(TWO_QUEUES, "moderator", "Vesna", "Vasic");
		account(OTHER_QUEUES, "moderator", "Bojan", "Peric");
		account(ONLY_ENTITIES, "moderator", "Milica", "Ilic");
		account(NO_TICKS, "moderator", "Novak", "Nedic");
		account(A_COMPETITOR, "competitor", "Tijana", "Takic");
		account(THE_SUPERADMIN, "superadmin", "Sanja", "Simic");

		ticked(TWO_QUEUES, "queue:" + COMMENTS, "queue:" + RESULTS);
		ticked(OTHER_QUEUES, "queue:" + TEAMS, "queue:" + PROFILES);
		ticked(ONLY_ENTITIES, "entity:members", "entity:events");

		member(MEMBER_ONE, "Ana", "Anic", true);
		member(MEMBER_TWO, "Bojan", "Bojic", true);
		member(LAPSED, "Vera", "Veric", false);
		registered("Gordana", "Goric");

		photo = photograph();

		waiting(COMMENTS, MEMBER_ONE, "Beogradski maraton 2027", "Odlicna organizacija i staza",
				"2026-09-10 08:00:00+00", null);
		waiting(COMMENTS, LAPSED, "Fruskogorski maraton 2027", "Staza je bila mokra ali obelezena",
				RAISED_LATE_IN_UTC, null);
		decided(COMMENTS, MEMBER_TWO, "Vec odluceni komentar", "Tekst koji je moderator pustio",
				"approved", null);

		decided(RESULTS, MEMBER_ONE, "Vec odluceni rezultat", "", "approved", null);
		decided(RESULTS, MEMBER_TWO, "Odbijeni rezultat", "", "rejected", THE_REASON);

		waiting(PROFILES, MEMBER_TWO, "Profilna slika Bojana Bojica", "bojan.jpg",
				"2026-09-05 09:00:00+00", photo);
		waiting(PROFILES, MEMBER_ONE, "Biografija Ane Anic", "Trcim od 2019. godine",
				"2026-09-06 09:00:00+00", null);

		waiting(TEAMS, MEMBER_ONE, "Timocka trkacka druzina", "Devet ljudi iz Zajecara",
				"2026-07-01 07:00:00+00", null);

		waitingAboutNobodyInParticular(PAYMENTS, "Gordana Goric", "", "2026-08-20 06:00:00+00");
	}

	private void account(String email, String role, String first, String last) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values (?, ?, ?, (select id from role where code = ?))")
				.params(first, last, email, role).update();

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

	/**
	 * @param feeStanding whether the membership is currently renewed. Read by
	 *                    {@code /api/competitors}, {@code /api/attendance} and
	 *                    {@code /api/pairs}, and deliberately NOT read by this resource.
	 */
	private void member(String number, String first, String last, boolean feeStanding) {
		competitor(number, first, last, feeStanding);
	}

	/** Somebody who has registered and whose fee is not recorded, so he has no number
	 *  (V16: „A MEMBER is a row whose member_number is there"). */
	private void registered(String first, String last) {
		competitor(null, first, last, false);
	}

	private void competitor(String number, String first, String last, boolean feeStanding) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, feeStanding, String.format("%016x", ++issued))
				.update();
	}

	private long photograph() {
		db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)")
				.param("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
				.update();

		return db.sql("select id from photo where digest = ?")
				.param("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
				.query(Long.class).single();
	}

	private void waiting(String queue, String memberNumber, String subject, String body,
			String raisedAt, Long photograph) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, raised_at,"
						+ " state) values (?, (select id from competitor where member_number = ?),"
						+ " ?, ?, ?, timestamptz '" + raisedAt + "', 'waiting')")
				.params(queue, memberNumber, subject, body, photograph).update();
	}

	/** A row about somebody who is in the record and has no member number of his own. */
	private void waitingAboutNobodyInParticular(String queue, String subject, String body,
			String raisedAt) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, raised_at,"
						+ " state) values (?, (select id from competitor where member_number is null),"
						+ " ?, ?, null, timestamptz '" + raisedAt + "', 'waiting')")
				.params(queue, subject, body).update();
	}

	private void decided(String queue, String memberNumber, String subject, String body,
			String state, String reason) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, raised_at,"
						+ " state, decided_at, decided_by, decided_by_name, reason)"
						+ " values (?, (select id from competitor where member_number = ?), ?, ?, null,"
						+ " timestamptz '2026-08-01 06:00:00+00', ?,"
						+ " timestamptz '2026-08-02 06:00:00+00',"
						+ " (select id from account where email = ?), ?, ?)")
				.params(queue, memberNumber, subject, body, state, THE_SUPERADMIN, THE_DECIDER, reason)
				.update();
	}

	private MockHttpServletRequestBuilder asking(String email) {
		MockHttpServletRequestBuilder asks = get(PATH);
		return email == null ? asks
				: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private int statusOf(String email) throws Exception {
		return http.perform(asking(email)).andReturn().getResponse().getStatus();
	}

	private String whole(String email) throws Exception {
		return http.perform(asking(email)).andReturn().getResponse().getContentAsString();
	}

	private JsonNode answer(String email) throws Exception {
		return new ObjectMapper().readTree(whole(email));
	}

	/** The tabs one person is served, in the order they came back. */
	private List<String> tabsServedTo(String email) throws Exception {
		List<String> out = new ArrayList<>();
		for (JsonNode tab : answer(email)) {
			out.add(tab.path("queue").asString());
		}
		return out;
	}

	/** One tab of somebody's answer, found by its name and never by position. */
	private JsonNode tab(String email, String queue) throws Exception {
		for (JsonNode one : answer(email)) {
			if (queue.equals(one.path("queue").asString())) {
				return one;
			}
		}
		throw new AssertionError(PATH + " did not answer " + email + " with the tab " + queue);
	}

	/** What one tab holds, as the subjects of its items, which is what a moderator reads. */
	private List<String> waitingIn(String email, String queue) throws Exception {
		List<String> out = new ArrayList<>();
		for (JsonNode item : tab(email, queue).path("waiting")) {
			out.add(item.path("subject").asString());
		}
		return out;
	}

	/**
	 * EVERY ITEM OF EVERYBODY'S TAB IN ONE LIST, which is what the two floors of
	 * {@link Answers} read.
	 *
	 * <p>They compare the names of one RECORD and the values across records, and the record
	 * this resource is read for is the item and not the tab it stands in. Flattened here
	 * rather than by asking for one tab, because a single tab's items share a field or two
	 * by construction - both comments carry no photograph - and a floor that says „no field
	 * is the same in every record" would then be asking about a sample chosen to make it
	 * fail.
	 */
	private JsonNode everyItemServedTo(String email) throws Exception {
		ArrayNode all = new ObjectMapper().createArrayNode();

		for (JsonNode one : answer(email)) {
			for (JsonNode item : one.path("waiting")) {
				all.add(item);
			}
		}

		return all;
	}

	/** What the TABLE holds in one tab, which is the floor under every „is not served". */
	private List<String> reallyInTheQueue(String queue, String state) {
		return db.sql("select subject from verification where queue = ? and state = ?"
						+ " order by raised_at, id")
				.params(queue, state).query(String.class).list();
	}

	private int ticksOf(String email) {
		return db.sql("select count(*) from account_admin_right where account_id ="
						+ " (select id from account where email = ?)")
				.param(email).query(Integer.class).single();
	}

	/** Every queue the rights matrix holds, read off the schema rather than written here. */
	private List<String> everyQueueThereIs() {
		return db.sql("select target from admin_right where scope = 'queue' order by target")
				.query(String.class).list();
	}

	/**
	 * A VISITOR WHO IS NOT SIGNED IN IS NOT SERVED THE QUEUE.
	 *
	 * <p>ADL P-javno, the owner on 13.09.2026: „javno je ono što Član 73 nabraja, i ništa
	 * više", and it names verification among the seven resources that rule covers. Article
	 * 73 lists nothing about a queue, so nothing here is public and the route is absent from
	 * {@code ApiSecurity.READ_BY_ANYBODY}. This case is why that absence is measured at all
	 * - nothing else would catch the route moving onto the open list.
	 *
	 * <p><b>401 and not 404, and that boundary is measured in both directions.</b> „Zatvorena
	 * vrata ne kažu ništa" made the refusal for a missing right 404 (owner, 13.09.2026,
	 * {@code ADL.md:783}), and the same decision keeps 401 where it is: „401 ne govori ništa
	 * o tome šta iza adrese stoji, nego kaže da se treba prijaviti". The case below is the
	 * other direction.
	 *
	 * <p><b>Both halves.</b> Without the 200, a resource refusing everybody would satisfy the
	 * refusal and say the rule held.
	 */
	@Test
	void aVisitorWhoIsNotSignedInIsAskedToSignInRatherThanToldThereIsNothingHere() throws Exception {
		assertThat(statusOf(null))
				.as("a visitor was served the verification queue, which is where the worst leak of"
						+ " this project came from (owner, 07.08.2026)")
				.isEqualTo(401);

		assertThat(statusOf(TWO_QUEUES))
				.as("a moderator holding two queue ticks was refused, so the refusal above is not"
						+ " about who is asking")
				.isEqualTo(200);
	}

	/**
	 * AND SOMEBODY SIGNED IN WITH NO QUEUE OF HIS OWN IS TOLD THE ADDRESS IS NOT THERE.
	 *
	 * <p>The owner, 13.09.2026 ({@code ADL.md:783}): „Server odbija moderatora bez
	 * privilegije sa 404, ne sa 403", because the administration draws no screen he may open
	 * and the server must not be the one place that says the address exists.
	 * {@code PDL.md:4379} says it for this section: its address opens „prvi red... koji ta
	 * osoba sme, a naslovnu kad ne sme nijedan".
	 *
	 * <p><b>Three people, and each of them is a different thing.</b> A plain competitor is
	 * the ordinary case and is most of the portal. A moderator holding only ENTITY rights is
	 * the one that separates „holds a queue" from „holds anything at all" - a refusal written
	 * the second way lets him in, and he would then be served every queue he may not open. A
	 * moderator with no tick at all is what keeps the second from reading as „a moderator who
	 * was never given anything".
	 *
	 * <p><b>The number is not named on its own but compared with an address that maps
	 * nothing</b>, the shape {@code RightsAtTheDoorTest} uses for the same decision, so the
	 * day one of the two moves the other has to move with it. What the number cannot say is
	 * whether the two answers are alike on the wire; that is
	 * {@code RightsOverRealHttpTest.theQueueSaysNothingToSomebodyWithNoQueueOfHisOwn}, and it
	 * has to be there because MockMvc does not run the container's ERROR dispatch.
	 */
	@ParameterizedTest
	@ValueSource(strings = {A_COMPETITOR, ONLY_ENTITIES, NO_TICKS})
	void somebodyWithNoQueueOfHisOwnIsToldNoMoreThanSomebodyAskingForNothing(String asking)
			throws Exception {
		assertThat(ticksOf(ONLY_ENTITIES))
				.as("the moderator who is meant to hold rights that are not queues holds none at"
						+ " all, so his refusal says nothing about entity rights")
				.isEqualTo(2);
		assertThat(ticksOf(NO_TICKS))
				.as("the moderator who is meant to hold nothing holds something, so he is not the"
						+ " case this asks about")
				.isZero();

		assertThat(statusOf(asking))
				.as("%s was served the verification queue, or told it is there", asking)
				.isEqualTo(http.perform(get(NOTHING_IS_THERE)
								.cookie(new Cookie(SessionCookie.NAME, sessions.get(asking).secret())))
						.andReturn().getResponse().getStatus());

		assertThat(whole(asking))
				.as("the refusal carried a body, which an address that is not there would not have")
				.isEmpty();
	}

	/**
	 * EACH MODERATOR IS SERVED HIS OWN QUEUES AND NOT THE OTHER'S.
	 *
	 * <p>The owner, 30.07.2026 ({@code PDL.md:4308}): „Moderator vidi samo redove i entitete
	 * za koje ima pravo... Ne skriva se samo ekran nego i saznanje da ekran postoji."
	 *
	 * <p><b>The two sets are disjoint, which is what makes this measure the filter rather
	 * than the fixture.</b> Overlapping, a query that forgot to name the account would hand
	 * each of them a list containing what he expected and this would pass. Crossed, the same
	 * query hands each of them the other's tabs as well and both halves fail.
	 *
	 * <p><b>And neither of them is served the two tabs NOBODY in this fixture holds</b>
	 * ({@code payments}, {@code schedule}), which is the half a mutation swapping one
	 * moderator's rights for the other's would still satisfy.
	 */
	@Test
	void eachModeratorIsServedTheQueuesHisOwnTicksOpenAndNoOthers() throws Exception {
		assertThat(tabsServedTo(TWO_QUEUES))
				.as("a moderator was served a tab he has no tick for, or lost one he has")
				.containsExactly(COMMENTS, RESULTS);

		assertThat(tabsServedTo(OTHER_QUEUES))
				.as("the other moderator's tabs are not his own, so the two answers are not being"
						+ " told apart by the ticks")
				.containsExactly(PROFILES, TEAMS);

		assertThat(tabsServedTo(TWO_QUEUES))
				.as("the two moderators were served an overlapping set of tabs, so this case cannot"
						+ " tell a filter that names the account from one that does not")
				.doesNotContainAnyElementsOf(tabsServedTo(OTHER_QUEUES));
	}

	/**
	 * AND WHAT IS IN A TAB HE MAY NOT OPEN NEVER REACHES HIM IN ANY SHAPE.
	 *
	 * <p>The tabs are one thing and their contents another, and this is the half the leak of
	 * 07.08.2026 was about: „svaki posetilac dobijao u pregledač adrese neaktiviranih članova
	 * i tekstove neodobrenih komentara, uključujući i onaj sa reklamom za tuđi link".
	 *
	 * <p>Measured over the whole answer as text rather than over a field, because a body that
	 * leaked into a field nobody thought to read is exactly the shape that leak had.
	 */
	@Test
	void theBodyOfAnItemInSomebodyElsesQueueIsNowhereInHisAnswer() throws Exception {
		assertThat(reallyInTheQueue(TEAMS, "waiting"))
				.as("the tab this case says is somebody else's holds nothing, so its absence from"
						+ " the answer measures nothing")
				.isNotEmpty();

		assertThat(whole(TWO_QUEUES))
				.as("the subject of an item in a tab this moderator may not open was in his answer")
				.doesNotContain("Timocka trkacka druzina")
				.doesNotContain("Devet ljudi iz Zajecara")
				.doesNotContain("Biografija Ane Anic")
				.doesNotContain("Trcim od 2019. godine");

		assertThat(whole(OTHER_QUEUES))
				.as("the subject of an item in the other moderator's tab was in this one's answer")
				.doesNotContain("Beogradski maraton 2027")
				.doesNotContain("Odlicna organizacija i staza");
	}

	/**
	 * AND NEITHER DOES THE PHOTOGRAPH.
	 *
	 * <p>A picture is the one thing on this queue that is a person rather than a sentence
	 * about one, and it hangs off exactly one item in this fixture. The moderator whose tab
	 * that item is in gets its id; the other one must not, and neither must the two who are
	 * refused the resource outright.
	 */
	@Test
	void thePictureLeavesOnlyWithTheQueueItHangsOff() throws Exception {
		assertThat(tab(OTHER_QUEUES, PROFILES).path("waiting").get(0).path("photoId").asLong())
				.as("the item that carries the photograph did not answer with it, so its absence"
						+ " from every other answer says nothing")
				.isEqualTo(photo);

		/* Asked of the FIELD and not of the text of the answer. An id is a small number and
		   it is a substring of half the other ids in the document, so a search over the text
		   is red whatever the code does - measured, on the first draft of this case. */
		for (JsonNode item : everyItemServedTo(TWO_QUEUES)) {
			assertThat(item.path("photoId").isNull())
					.as("an item served to a moderator whose tabs carry no photograph came back"
							+ " with one: %s", item)
					.isTrue();
		}
	}

	/**
	 * A TAB WORKED TO THE BOTTOM IS A TAB WITH NOTHING IN IT, NOT A TAB THAT HAS GONE.
	 *
	 * <p>The owner, 29.08.2026 ({@code PDL.md:3960}): „Prazan red ostaje u navigaciji i
	 * pokazuje nulu. Neka ipak ne nestaju stavke iz Verifikacije kad se odobre. Neka ostane
	 * vidljiva i neka piše 0."
	 *
	 * <p><b>Both ways of being empty, because they break differently.</b> The results tab has
	 * been answered to the bottom - every row in it is decided - and an INNER join from the
	 * rows loses it, as does moving the state from the join condition into the where clause.
	 * The schedule tab never held anything at all, and only the first of those two mistakes
	 * loses it. A fixture with one of the two in it would pass half the mutations.
	 *
	 * <p><b>With the floor that says the rows really are there</b>, because „the tab is empty"
	 * and „the tab was never written" look the same from the answer, and only this file knows
	 * which of the two it meant.
	 */
	@Test
	void aTabWithNothingWaitingIsAnsweredWithAnEmptyListAndNotLeftOut() throws Exception {
		assertThat(reallyInTheQueue(RESULTS, "waiting"))
				.as("the tab this case calls worked to the bottom still has something waiting in it")
				.isEmpty();
		assertThat(reallyInTheQueue(RESULTS, "approved"))
				.as("the tab this case calls worked to the bottom holds no decided row either, so"
						+ " it is the other kind of empty and measures the other mutation")
				.isNotEmpty();

		assertThat(tabsServedTo(TWO_QUEUES))
				.as("a tab whose every item has been decided fell out of the answer, and the owner"
						+ " decided on 29.08.2026 that it stays and shows a nought")
				.contains(RESULTS);
		assertThat(tab(TWO_QUEUES, RESULTS).path("waiting"))
				.as("the tab worked to the bottom answered with something waiting in it")
				.isEmpty();

		assertThat(reallyInTheQueue(SCHEDULE, "waiting").size()
						+ reallyInTheQueue(SCHEDULE, "approved").size()
						+ reallyInTheQueue(SCHEDULE, "rejected").size())
				.as("the tab this case calls untouched holds rows, so it is not the second kind of"
						+ " empty and this measures the first one twice")
				.isZero();

		assertThat(tabsServedTo(THE_SUPERADMIN))
				.as("a tab that has never held anything fell out of the answer")
				.contains(SCHEDULE);
		assertThat(tab(THE_SUPERADMIN, SCHEDULE).path("waiting"))
				.as("a tab that has never held anything answered with something in it")
				.isEmpty();
	}

	/**
	 * WHAT HAS BEEN DECIDED IS NOT IN THE ANSWER, IN ANY SHAPE.
	 *
	 * <p>The owner, 06.08.2026 ({@code PDL.md:3983}): „Sekcija „Rešeno" se ukida. Red pokazuje
	 * samo ono što čeka; šta je rešeno nije posao koji stoji pred moderatorom."
	 *
	 * <p><b>Asked of a tab that also holds waiting rows</b>, so „only what waits" is a
	 * subtraction rather than a whole tab that happens to be missing - which is what the
	 * results tab would have measured on its own.
	 *
	 * <p><b>And of the whole text, not of the list of subjects.</b> The decision carries three
	 * things the moderator who made it wrote or is named by - the reason a refusal must have
	 * (V9's {@code verification_refusal_says_why}), the name it was made under, and the state
	 * - and a resource that answered with any of them would be putting one moderator's
	 * judgment of a member in front of another moderator with nothing to do about it.
	 */
	@Test
	void whatHasAlreadyBeenDecidedIsNotServedAtAll() throws Exception {
		assertThat(reallyInTheQueue(COMMENTS, "approved"))
				.as("the tab this case reads holds no decided row, so its absence measures nothing")
				.containsExactly("Vec odluceni komentar");
		assertThat(reallyInTheQueue(COMMENTS, "waiting"))
				.as("the tab this case reads holds nothing waiting, so serving only what waits"
						+ " would be satisfied by an empty answer")
				.isNotEmpty();

		assertThat(waitingIn(TWO_QUEUES, COMMENTS))
				.as("an item somebody has already answered was served as work still waiting")
				.doesNotContain("Vec odluceni komentar");

		assertThat(whole(TWO_QUEUES))
				.as("the answer carried the reason, the name or the state of a decision, and none"
						+ " of the three is work standing in front of a moderator")
				.doesNotContain(THE_REASON)
				.doesNotContain(THE_DECIDER)
				.doesNotContain("approved")
				.doesNotContain("rejected");
	}

	/**
	 * AND A DECIDED ROW CANNOT BE CARRYING A PHOTOGRAPH TO BEGIN WITH.
	 *
	 * <p>This resource leans on V9's {@code verification_decided_keeps_no_photo} - „state =
	 * 'waiting' or photo_id is null" - and the lean is worth saying out loud: it is the reason
	 * the mutation that lets decided rows into this answer cannot carry a picture out with
	 * them. PDL 900 („dokaz se briše posle verifikacije") and ADL A36 O11 are where it comes
	 * from, and the constraint is the one thing that makes it true of every writer rather than
	 * of the ones somebody remembered.
	 *
	 * <p><b>Measured against the fixture's own decided row rather than a fresh bad one</b>,
	 * which is what keeps this from being a second copy of
	 * {@code VerificationConstraintsTest}'s violations: those ask whether the rule exists, and
	 * this asks whether the rows THIS resource might have leaked a picture from can hold one.
	 */
	@Test
	void aRowThatHasBeenDecidedCannotHoldAPhotographForThisToServe() {
		assertThat(reallyInTheQueue(COMMENTS, "approved"))
				.as("there is no decided row to try this against")
				.isNotEmpty();

		assertThatThrownBy(() -> db.sql("update verification set photo_id = ?"
						+ " where queue = ? and state = 'approved'")
				.params(photo, COMMENTS).update())
				.as("a decided row took a photograph, so the schema no longer guarantees that"
						+ " serving a decided row would serve no picture")
				.hasMessageContaining("verification_decided_keeps_no_photo");
	}

	/**
	 * THE SUPERADMIN IS SERVED EVERY TAB THERE IS, WITH NO TICK ANYWHERE.
	 *
	 * <p>V5 gives his role {@code rights_mode = 'all'} and PDL P28a says he „ne pojavljuje se
	 * u ovoj tabeli kao neko kome se prava dodeljuju" ({@code PDL.md:4422}). Read as the ticks
	 * alone - which is what a condition written into the SQL of this resource would be - he is
	 * served nothing at all, and the administration is shut to the one account that may do
	 * everything.
	 *
	 * <p><b>The tabs are compared with the rights matrix and not with a list written here</b>,
	 * so a seventh queue granted tomorrow is in this answer on the day it is inserted. That is
	 * the same floor {@code VerificationConstraintsTest.theTabsOfTheQueueAreExactlyTheQueueRights}
	 * puts under the schema, asked one layer up.
	 */
	@Test
	void theSuperadminIsServedEveryQueueTheMatrixHoldsWithoutASingleTick() throws Exception {
		assertThat(ticksOf(THE_SUPERADMIN))
				.as("the superadmin of this fixture holds ticks, so passing says nothing about a"
						+ " role that holds everything without any")
				.isZero();

		assertThat(everyQueueThereIs())
				.as("the rights matrix holds no queue at all, so the comparison below is between"
						+ " two empty lists")
				.isNotEmpty();

		assertThat(tabsServedTo(THE_SUPERADMIN))
				.as("the tabs served are not the queues the rights matrix holds")
				.isEqualTo(everyQueueThereIs());
	}

	/**
	 * IN TAB ORDER, AND OLDEST FIRST INSIDE A TAB.
	 *
	 * <p>V9: „The queue is drawn by tab, oldest first, and that is the only way it is ever
	 * read", which is why its index is on {@code (queue, raised_at)}.
	 *
	 * <p>The days differ across the items of one tab, so this measures an {@code order by} and
	 * not the order the rows were written in - and they were written in the opposite order to
	 * the one expected here, on both tabs.
	 */
	@Test
	void theTabsAreInTheirOwnOrderAndTheItemsInEachAreOldestFirst() throws Exception {
		assertThat(tabsServedTo(THE_SUPERADMIN))
				.as("the tabs came back in an order nobody decided")
				.containsExactly(COMMENTS, PAYMENTS, PROFILES, RESULTS, SCHEDULE, TEAMS);

		assertThat(waitingIn(THE_SUPERADMIN, COMMENTS))
				.as("the items of a tab are not oldest first")
				.containsExactly("Beogradski maraton 2027", "Fruskogorski maraton 2027");

		assertThat(waitingIn(THE_SUPERADMIN, PROFILES))
				.as("the items of the other tab are not oldest first either, so the order above is"
						+ " not the order the rows happened to be written in")
				.containsExactly("Profilna slika Bojana Bojica", "Biografija Ane Anic");
	}

	/**
	 * THE DAY IS THE DAY IN BELGRADE AND NOT THE MACHINE'S.
	 *
	 * <p>V9 holds {@code raised_at} as a {@code timestamptz} because arriving in a queue is an
	 * instant; the portal draws a day. The instant this asks about is half past ten at night
	 * in UTC, which is already the next day in the league's own zone and still the same day in
	 * UTC and in London - so a query reading the machine's zone answers a different day, and
	 * so does one reading any zone that is not Belgrade's on that date.
	 */
	@Test
	void theDayAnItemArrivedIsTheDayItWasInBelgrade() throws Exception {
		JsonNode late = tab(THE_SUPERADMIN, COMMENTS).path("waiting").get(1);

		assertThat(late.path("subject").asString())
				.as("the item this case is about is not where it is being read from")
				.isEqualTo("Fruskogorski maraton 2027");

		assertThat(late.path("date").asString())
				.as("an item raised at %s was dated %s, which is the day on a machine kept in UTC"
						+ " rather than the day in the league's own time", RAISED_LATE_IN_UTC,
						THE_MACHINES_DAY)
				.isEqualTo(BELGRADE_NEXT_DAY);
	}

	/**
	 * WHOSE ITEM IT IS, AND THE TWO ORDINARY WAYS OF THERE BEING NO NUMBER TO GIVE.
	 *
	 * <p>V9 makes {@code competitor_id} nullable on purpose - „A payment waiting to be
	 * recognised may be about a person who is not one yet" - and V16 added the second way:
	 * somebody who has registered and whose fee is not recorded IS a row in
	 * {@code competitor} and has no number, because „A MEMBER is a row whose member_number is
	 * there". Both answer with nothing, and the subject carries the name in either case.
	 */
	@Test
	void anItemAboutSomebodyWithNoMemberNumberAnswersWithNoneAndKeepsItsSubject() throws Exception {
		JsonNode nameless = tab(THE_SUPERADMIN, PAYMENTS).path("waiting").get(0);

		assertThat(nameless.path("subject").asString())
				.as("the item about somebody with no number is not where it is being read from")
				.isEqualTo("Gordana Goric");

		assertThat(nameless.path("memberNumber").isNull())
				.as("an item about somebody who has registered and has no number answered with one")
				.isTrue();

		assertThat(tab(THE_SUPERADMIN, TEAMS).path("waiting").get(0).path("memberNumber").asString())
				.as("an item about a member did not answer with HIS number, so the nothing above is"
						+ " not being told apart from a number")
				.isEqualTo(MEMBER_ONE);
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED IS STILL IN THE QUEUE, AND THAT IS THE ONE PLACE THIS
	 * RESOURCE PARTS COMPANY WITH THE PUBLIC ONES ON PURPOSE.
	 *
	 * <p>{@code /api/pairs}, {@code /api/attendance}, {@code /api/comments} and
	 * {@code /api/competitors} all drop him, and the reason written beside each of them is the
	 * same: a number that leaves a PUBLIC answer and does not leave {@code /api/competitors}
	 * names, by the difference between two answers, „sve u vezi sa članarinom", which Article
	 * 74 puts beside the date of birth.
	 *
	 * <p><b>There is no such subtraction here.</b> Nothing in this answer is public - the only
	 * reader is the moderator holding that tab's tick - and the queue exists in order to be
	 * worked: filtering on {@code competitor.active} would hide from a moderator exactly the
	 * work a lapsed membership creates, and would empty the payments tab, which is about
	 * people whose fee is not recorded ({@code PDL.md:3906}, „Uplate i aktivacija članova").
	 *
	 * <p>Written as a case rather than as a comment, because this is the fifth time the
	 * question has been asked and the first time the answer is the other way round, so
	 * somebody carrying the habit over would otherwise change it and stay green.
	 */
	@Test
	void anItemFromAMemberWhoseFeeHasLapsedIsServedLikeAnyOther() throws Exception {
		assertThat(db.sql("select active from competitor where member_number = ?")
						.param(LAPSED).query(Boolean.class).single())
				.as("the member this case calls lapsed has a membership in good standing, so his"
						+ " item being served says nothing")
				.isFalse();

		assertThat(waitingIn(TWO_QUEUES, COMMENTS))
				.as("an item sent in by a member whose fee has lapsed was dropped, and the work it"
						+ " makes is exactly what a moderator opens this screen for")
				.contains("Fruskogorski maraton 2027");
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ONE THE SERVER ANSWERS WITH, EXCEPT THE TWELVE THE
	 * SCHEMA HAS NOWHERE TO HOLD, AND THOSE ARE NAMED HERE WITH THE REASON.
	 *
	 * <p>V9 says what it is and is not, in as many words: „What this table is NOT. It does not
	 * model what each tab is about. A comment is a row in {@code event_comment}, a photograph
	 * is a row in {@code photo}, a result will be a row in {@code result}, and this table
	 * points at them rather than copying them. What it holds is the part every tab shares: who
	 * it is about, what was proposed, and what a moderator decided." Twelve of the seventeen
	 * fields of the served file are the part it does NOT hold:
	 *
	 * <ul>
	 * <li>{@code queue} is not missing: it is on the TAB, which is the row this item stands
	 * in. Written on both it would be one fact in two places, which is the rule
	 * {@code PDL.md:4314} states about numbers and this resource follows about its tabs.
	 * <li>{@code kind} - which sort of thing an item is, where one tab holds two (a biography
	 * against a picture, a new team against a change to one). No column, and the distinction
	 * is the screen's.
	 * <li>{@code who} - the prototype keeps the sender beside the subject; V9 keeps one text
	 * and says it „carries the name in every case".
	 * <li>{@code subjectId} - what an approval writes a record about. V10 and V11 added the
	 * two pointers that exist ({@code result_submission_id}, {@code team_proposal_id}) and
	 * they are for what a WRITE does; this increment writes nothing (ADL A8: the layer of
	 * 13.09.2026 „ne uvodi nijedan upis"), so serving them would be „za svaki slučaj", which
	 * ADL P-javno refuses.
	 * <li>{@code picture} and {@code crop} - the picture as text, which the prototype carries
	 * because until F5 there is nowhere to put a file. The schema has a row in {@code photo}
	 * and this answers its id.
	 * <li>{@code currentDate}, {@code proposedDate} - the two days a reported change of term
	 * carries. No columns.
	 * <li>{@code rating} - the three marks of a comment. They live on {@code event_comment}
	 * once the comment is out, and the queue row points rather than copies.
	 * <li>{@code email}, {@code city}, {@code country} - what a registration waiting for its
	 * fee is known by. On {@code competitor}, not on the queue.
	 * </ul>
	 *
	 * <p><b>And one name is answered that the portal does not read yet</b>, {@code photoId},
	 * which is V9's own column and the only way a moderator can be shown the picture he is
	 * deciding about once there is a file behind it.
	 *
	 * <p><b>{@code Answers} checks both halves of every name</b> - that the file really serves
	 * it, so a stale name cannot excuse a field that went missing for another reason, and that
	 * the answer really leaves it out, so each of the twelve is a claim rather than a wish.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered(PATH, everyItemServedTo(THE_SUPERADMIN),
				"verification.json", Set.of("photoId"),
				"queue", "kind", "who", "subjectId", "picture", "crop", "currentDate",
				"proposedDate", "rating", "email", "city", "country");
	}

	/**
	 * AND NO FIELD OF AN ITEM IS THE SAME IN EVERY ONE OF THEM.
	 *
	 * <p>A field the fixture never varies is a field a constant would answer, and the two read
	 * alike in every case above. It is also what keeps {@code state} out of the answer by
	 * measurement rather than by memory: „Sekcija „Rešeno" se ukida" means only waiting rows
	 * come out, so a {@code state} field would be the string {@code waiting} in every record
	 * and this floor would refuse it.
	 */
	@Test
	void noFieldOfAnItemIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord(PATH, everyItemServedTo(THE_SUPERADMIN));
	}

	/**
	 * AND NEITHER IS A FIELD OF A TAB.
	 *
	 * <p>The tab carries two things and the second is the one worth measuring: a resource that
	 * handed every tab the same list - the first tab's items, or one list of everything - is a
	 * resource where the tab means nothing, and it would satisfy every case above that reads
	 * one tab by name as long as the tab it reads is the one the list came from.
	 */
	@Test
	void noFieldOfATabIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord(PATH, answer(THE_SUPERADMIN));
	}
}
