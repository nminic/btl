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
 * PDL P28a, 07.08.2026, „Javne strane ne smeju da preuzimaju red") - so most of this file is
 * about who does NOT get what.
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

	/** A moderator who may work in two tabs and has nothing to do in either of them. */
	private static final String EMPTY_QUEUES = "jelena@primer.rs";

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

	/**
	 * A TOWN OUT OF THE CODEBOOK, named by its country and not by its rank.
	 *
	 * <p>Written as a sub-select rather than a number because the codebook is reference
	 * data this file does not own: {@code rank} is a position among 1200 rows and the row
	 * holding it can move, while „the first Serbian town in the book" is a sentence that
	 * stays true. What matters here is only that its country is NOT the one the typed
	 * town below names, so „the country of this proposal" and „the country of any
	 * proposal" cannot answer alike.
	 */
	private static final String A_TOWN_IN_THE_CODEBOOK =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	/** And a town nobody found in the book, which is V11's other way of holding one. */
	private static final String TYPED_TOWN = "Podgorica";

	/** In another country, so the two teams rows differ along that axis too. */
	private static final String TYPED_COUNTRY = "ME";

	/**
	 * THE TOWN EVERY PERSON IN THIS FIXTURE LIVES IN, out of the codebook.
	 *
	 * <p>Named here because the payments tab answers with the town of the PERSON rather
	 * than with a proposal's, so it is a fact of the fixture and no longer an unread column
	 * of {@code competitor}. It is neither of the two towns a proposal carries, which is
	 * what lets „the town of this row" be told apart from „the town of any row".
	 */
	private static final String EVERYBODYS_TOWN = "(select id from place where rank = 1)";

	/** And one person written into a town nobody found in the book, which is
	 *  {@code competitor}'s other way of holding one and the half a query reading only
	 *  {@code place.name} would lose. */
	private static final String HER_TYPED_TOWN = "Mostar";

	/** In a fourth country, so no two towns in this fixture share one and a query that
	 *  found any country cannot pass for one that found hers. */
	private static final String HER_TYPED_COUNTRY = "BA";

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
	 * SIX ACCOUNTS, FOUR PEOPLE IN THE RECORD, SIX TABS AND TWELVE ROWS, OF WHICH NINE WAIT.
	 *
	 * <p>The tabs are laid out so that every sentence the owner wrote about this screen has
	 * a row that would break if it stopped being true:
	 *
	 * <ul>
	 * <li>{@code comments} waits twice and has been answered once, so „only what waits"
	 * is a subtraction and not the whole tab. One of the two waiting is rated and one is
	 * not, and each is about a different event, neither of them the first one made
	 * (ADL A64 A1).
	 * <li>{@code results} has been worked to the bottom - one approved, one refused - which
	 * is the tab „Neka ipak ne nestaju stavke iz Verifikacije kad se odobre" is about.
	 * <li>{@code schedule} waits once, off a third event again, carrying both the day
	 * reported and the day proposed (ADL A64 A2). It held nothing at all until 22.09.2026,
	 * and the one case that still needs that other kind of empty makes it so again for
	 * itself, in {@code aTabHeMayWorkInWithNothingInItIsAnEmptyAnswerAndNotARefusal}.
	 * <li>{@code profiles} waits twice and one of the two carries a photograph.
	 * <li>{@code teams} waits once, so a tab with a single item is in the fixture too.
	 * <li>{@code payments} waits twice, along the two axes that tab is read along. Whose it
	 * is: somebody who has registered and has no number, which V16 made an ordinary state
	 * rather than a broken row, and a member whose fee has run out and who therefore has
	 * one. And where they live: one town out of the codebook and one somebody typed, which
	 * is {@code competitor}'s „one way or the other" and the reason a single row here could
	 * not tell a query reading {@code place.name} from one reading {@code competitor.city}.
	 * </ul>
	 */
	@BeforeEach
	void sixAccountsAndSixTabs() {
		account(TWO_QUEUES, "moderator", "Vesna", "Vasic");
		account(OTHER_QUEUES, "moderator", "Bojan", "Peric");
		account(ONLY_ENTITIES, "moderator", "Milica", "Ilic");
		account(NO_TICKS, "moderator", "Novak", "Nedic");
		account(EMPTY_QUEUES, "moderator", "Jelena", "Jovic");
		account(A_COMPETITOR, "competitor", "Tijana", "Takic");
		account(THE_SUPERADMIN, "superadmin", "Sanja", "Simic");

		ticked(TWO_QUEUES, "queue:" + COMMENTS, "queue:" + RESULTS);
		ticked(OTHER_QUEUES, "queue:" + TEAMS, "queue:" + PROFILES);
		ticked(ONLY_ENTITIES, "entity:members", "entity:events");
		/* TWO TICKS, AND BOTH TABS EMPTY, in the two different ways a tab can be: one
		   worked to the bottom and one that never held anything. He is the only person in
		   this fixture for whom „may he" and „is there anything for him" part company, and
		   without him a server that decided the refusal off the ROWS instead of the rights
		   would answer every case in this file exactly as the right one does. */
		ticked(EMPTY_QUEUES, "queue:" + RESULTS, "queue:" + SCHEDULE);

		member(MEMBER_ONE, "Ana", "Anic", true);
		member(MEMBER_TWO, "Bojan", "Bojic", true);
		member(LAPSED, "Vera", "Veric", false);
		registered("Gordana", "Goric");

		photo = photograph();

		/* THREE EVENTS, NOT ONE, and neither comment below is about the first of them
		   (`decoyEvent`, made and never pointed at). `Number('')` is nought and a query
		   that coalesced the wrong column would default to the first row it joined - both
		   are exactly the failure ADL A64 measured, and a fixture with one event or with
		   the comment about the first one could not catch either. */
		long decoyEvent = event("prvi-dogadjaj-ver", "Prvi dogadjaj", "2027-03-01");
		long ratedEvent = event("beogradski-maraton-2027", "Beogradski maraton 2027", "2027-04-18");
		long unratedEvent = event("fruskogorski-maraton-2027", "Fruskogorski maraton 2027",
				"2027-05-09");

		assertThat(decoyEvent).isNotEqualTo(ratedEvent).isNotEqualTo(unratedEvent);

		waiting(COMMENTS, MEMBER_ONE, "Beogradski maraton 2027", "Odlicna organizacija i staza",
				"2026-09-10 08:00:00+00", null);
		/* RATED, on the higher of the two events used - the axis „ocenjeno" of the pair
		   below. */
		commentOn("Beogradski maraton 2027", ratedEvent, 5, 4, 5);

		waiting(COMMENTS, LAPSED, "Fruskogorski maraton 2027", "Staza je bila mokra ali obelezena",
				RAISED_LATE_IN_UTC, null);
		/* UNRATED - „bez ocene", a comment nobody has marked yet, which is nought on all
		   three the same as `NO_RATING` and not a state this table refuses. Read beside the
		   rated row above, the pair is also what keeps `rating` and `subjectId` from being
		   the same value in every record (`noFieldOfAnItemIsTheSameInEveryRecord`). */
		commentOn("Fruskogorski maraton 2027", unratedEvent, 0, 0, 0);

		decided(COMMENTS, MEMBER_TWO, "Vec odluceni komentar", "Tekst koji je moderator pustio",
				"approved", null);

		decided(RESULTS, MEMBER_ONE, "Vec odluceni rezultat", "", "approved", null);
		decided(RESULTS, MEMBER_TWO, "Odbijeni rezultat", "", "rejected", THE_REASON);

		waiting(PROFILES, MEMBER_TWO, "Profilna slika Bojana Bojica", "bojan.jpg",
				"2026-09-05 09:00:00+00", photo);
		waiting(PROFILES, MEMBER_ONE, "Biografija Ane Anic", "Trcim od 2019. godine",
				"2026-09-06 09:00:00+00", null);

		/* TWO TEAMS ROWS AND NOT ONE, and they differ along every axis this tab is read
		   along (the rule of 06.09.2026, „ose se prebrajaju, ne pogadjaju"). With one row
		   apiece, `city`, `country`, `subjectId` and `kind` would each hold one value
		   across the whole answer, and a server answering any of them with a constant -
		   or reading the wrong column for it - would pass every case below AND the floor
		   `noFieldOfAnItemIsTheSameInEveryRecord`, which is the one that exists to refuse
		   exactly that.

		   The axes, counted:

		   - A NEW TEAM against a CHANGE to one that exists. That is `kind`, and it is
		     also `subjectId`: a proposal naming no team answers blank, and a change
		     answers the key of the team it is about. One of each, so „is it a change"
		     cannot be answered by a constant either way.
		   - A TOWN FROM THE CODEBOOK against a TOWN SOMEBODY TYPED. V11 lets a proposal
		     hold its town the one way or the other and never both, so a server reading
		     only `tp.city` would serve the typed one and lose the other, and a server
		     reading only `place.name` would do the reverse. Each mistake is green
		     against a fixture that has only one of the two.
		   - TWO DIFFERENT COUNTRIES, and neither is the country of the place every other
		     row in this fixture sits in. Both rows in Serbia, „the country of this
		     proposal" and „the country of the league" answer alike, and a query that
		     joined the wrong table would be indistinguishable from one that joined the
		     right one. */
		waiting(TEAMS, MEMBER_ONE, "Timocka trkacka druzina", "Devet ljudi iz Zajecara",
				"2026-07-01 07:00:00+00", null);
		proposalOn("Timocka trkacka druzina", MEMBER_ONE, null, TYPED_TOWN, TYPED_COUNTRY);

		waiting(TEAMS, MEMBER_TWO, "Dunavski trkaci", "Ime tima se menja",
				"2026-07-02 07:00:00+00", null);
		proposalOn("Dunavski trkaci", MEMBER_TWO, aTeamThatExists(), null, null);

		waitingAboutNobodyInParticular(PAYMENTS, "Gordana Goric", "", "2026-08-20 06:00:00+00");

		/* AND A SECOND PAYMENTS ROW, because this tab is read along two axes and one row
		   holds one value on each of them. Whose it is: the row above is about somebody with
		   no member number, so without this one „nothing" and „his number" cannot be told
		   apart on the tab where the difference lives. And where he lives: the row above
		   takes its town out of the codebook, so a query reading only `competitor.city`
		   would answer it blank and a query reading only `place.name` would answer this one
		   blank, and each of those mistakes is green against a fixture holding one of the
		   two. */
		livesInATownSomebodyTyped(LAPSED, HER_TYPED_TOWN, HER_TYPED_COUNTRY);
		waiting(PAYMENTS, LAPSED, "Vera Veric", "", "2026-08-21 06:00:00+00", null);

		/* AND ONE ROW ON THE SCHEDULE TAB, since 22.09.2026 (ADL A64 A2): V30 gave this tab
		   a pointer, and `currentDate`/`proposedDate` now answer for real on every record of
		   this whole resource, which means they need a record where they are not blank to
		   vary against - `noFieldOfAnItemIsTheSameInEveryRecord` refuses a field that is the
		   same in every record, and blank on six records out of six is exactly that. Until
		   this row existed the tab was empty on purpose, to hold the OTHER flavour of empty
		   a moderator's screen has to survive; that flavour moved to its own smaller case,
		   {@link #aTabHeMayWorkInWithNothingInItIsAnEmptyAnswerAndNotARefusal}, because no
		   tab in this fixture can be both „holds nothing at all, ever" and „holds what its
		   own cases need" once this one does either.

		   THE EVENT WAS MOVED SINCE THE REPORT WAS SENT, on purpose: `scheduleChangeOn`'s
		   `eventDate` is `2027-07-25`, what the reporter SAW, and the event's own live day
		   is `2027-08-08`, set an administrator's edit later. `currentDate` has to answer
		   the second and never the first - the label it is drawn under is present tense
		   (`i18n/sr.json`, „Datum u kalendaru") - so a fixture where the two agree could
		   not tell a query reading the live day from one reading the stale column. */
		long scheduleEvent = event("dogadjaj-za-izmenu-termina-ver", "Dogadjaj za izmenu termina",
				"2027-08-08");
		waiting(SCHEDULE, MEMBER_ONE, "Dogadjaj za izmenu termina", "",
				"2026-09-12 09:00:00+00", null);
		scheduleChangeOn("Dogadjaj za izmenu termina", scheduleEvent, "2027-07-25", "2027-08-22");
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
						+ " " + EVERYBODYS_TOWN + ", 2027, false, ?, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, feeStanding, String.format("%016x", ++issued))
				.update();
	}

	/**
	 * MOVES ONE PERSON OUT OF THE CODEBOOK AND INTO A TOWN SOMEBODY WROTE OUT.
	 *
	 * <p>Both columns at once, because {@code competitor_town_is_from_the_codebook_or_typed}
	 * refuses a row holding both and refuses one holding neither, exactly as V11 does for a
	 * proposal. Written as an update rather than as a second insert helper so that every
	 * person in this fixture is still made the one way, and only this axis differs.
	 */
	private void livesInATownSomebodyTyped(String number, String town, String countryCode) {
		db.sql("update competitor set place_id = null, city = ?,"
						+ " country_id = (select id from country where code = ?)"
						+ " where member_number = ?")
				.params(town, countryCode, number).update();
	}

	/**
	 * A TEAM THAT ALREADY EXISTS, for a proposal that asks to change one.
	 *
	 * <p>Its town comes out of the codebook, which is the half of V11's „one way or the
	 * other" that a typed town cannot stand in for.
	 */
	private long aTeamThatExists() {
		db.sql("insert into team (slug, name, bio, link, place_id, first_season)"
						+ " values ('dunavski-trkaci', 'Dunavski trkaci', '', '',"
						+ " " + A_TOWN_IN_THE_CODEBOOK + ", 2027)")
				.update();

		return db.sql("select id from team where slug = 'dunavski-trkaci'")
				.query(Long.class).single();
	}

	/**
	 * THE PROPOSAL A TEAMS ROW POINTS AT, hung on the row that carries the same subject.
	 *
	 * @param teamId     the team this asks to change, or null for a team that does not
	 *                   exist yet. It is the whole of the difference between the two
	 *                   kinds of teams row, and the schema is where {@code kind} is read
	 *                   from
	 * @param typedTown  a town somebody wrote out, or null to take one from the codebook.
	 *                   V11 refuses both at once and refuses neither, so exactly one of
	 *                   this and the codebook is used
	 * @param typedCountry the code of that town's country, which V11 ties to the typed
	 *                   town and to nothing else
	 */
	private void proposalOn(String subject, String memberNumber, Long teamId, String typedTown,
			String typedCountry) {
		/* WHICH OF THE TWO TOWNS IS CHOSEN HERE AND NOT IN THE STATEMENT. Written as
		   `case when ? is null` it was PostgreSQL that had to decide what sort of thing
		   the placeholder was, and it refuses to: a parameter compared only against null
		   has no type to infer from anything. Measured, and it read as eighteen errors
		   against eighteen tests - the shape the rules call infrastructure and not a
		   finding. */
		String fromTheCodebook = typedTown == null ? A_TOWN_IN_THE_CODEBOOK : "null";

		db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link, place_id,"
						+ " city, country_id) values ("
						+ " (select id from competitor where member_number = ?), ?, ?, '', '',"
						+ " " + fromTheCodebook + ", ?,"
						+ " (select id from country where code = ?))")
				.params(memberNumber, teamId, subject, typedTown, typedCountry)
				.update();

		db.sql("update verification set team_proposal_id ="
						+ " (select id from team_proposal where name = ?) where subject = ?")
				.params(subject, subject).update();
	}

	/** A minimal event in the calendar, for a comment or a reported change of term to point
	 *  at. No race under it: nothing this file measures reads one. */
	private long event(String slug, String name, String date) {
		return db.sql("insert into btl_event (slug, name, date, place_id, kind, featured,"
						+ " description, link) values (?, ?, date '" + date + "',"
						+ " " + EVERYBODYS_TOWN + ", 'race', false, '', '') returning id")
				.params(slug, name)
				.query(Long.class).single();
	}

	/**
	 * THE SUBMISSION A COMMENTS ROW POINTS AT, hung on the row that already carries the
	 * same subject - the shape {@link #proposalOn} already uses for the teams tab, moved
	 * one table over (ADL A64 A1).
	 *
	 * <p>Whose it is and what name to publish it under are read off the VERIFICATION row's
	 * own {@code competitor_id} rather than asked for again, so the two can never name two
	 * different members by a slip in a second parameter.
	 */
	private void commentOn(String subject, long eventId, int organisation, int value, int ambience) {
		long submission = db
				.sql("insert into comment_submission (event_id, competitor_id, who,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " select ?, v.competitor_id,"
						+ " coalesce(c.first_name || ' ' || c.last_name, 'Nepoznat Posiljalac'),"
						+ " ?, ?, ?, ''"
						+ " from verification v left join competitor c on c.id = v.competitor_id"
						+ " where v.subject = ? returning id")
				.params(eventId, organisation, value, ambience, subject)
				.query(Long.class).single();

		db.sql("update verification set comment_submission_id = ? where subject = ?")
				.params(submission, subject)
				.update();
	}

	/**
	 * THE PROPOSAL A SCHEDULE ROW POINTS AT, the same shape as {@link #commentOn} one table
	 * over (ADL A64 A2).
	 *
	 * @param eventDate    the day the reporter SAW, captured and never resynced
	 * @param proposedDate the day they are asking the event to move to
	 */
	private void scheduleChangeOn(String subject, long eventId, String eventDate, String proposedDate) {
		long proposal = db
				.sql("insert into schedule_proposal (competitor_id, event_id, event_date,"
						+ " proposed_date)"
						+ " select v.competitor_id, ?, date '" + eventDate + "', date '" + proposedDate
						+ "' from verification v where v.subject = ? returning id")
				.params(eventId, subject)
				.query(Long.class).single();

		db.sql("update verification set schedule_proposal_id = ? where subject = ?")
				.params(proposal, subject)
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

	/**
	 * THE TABS ONE PERSON IS SERVED, once each and in the order they came back.
	 *
	 * <p>Read off the ITEMS since 22.09.2026, because that is all the answer holds now: a
	 * tab reaches this list by having something waiting in it, which is the same sentence
	 * as „a moderator is served the tabs he may work in" only for the tabs that are not
	 * empty. {@link #aTabHeMayWorkInWithNothingInItIsAnEmptyAnswerAndNotARefusal} is the
	 * other half and says so out loud.
	 */
	private List<String> tabsServedTo(String email) throws Exception {
		List<String> out = new ArrayList<>();
		for (JsonNode item : answer(email)) {
			String queue = item.path("queue").asString();
			if (!out.contains(queue)) {
				out.add(queue);
			}
		}
		return out;
	}

	/**
	 * ONE ITEM OF ONE TAB, by its place in that tab and never by its place in the answer.
	 *
	 * <p>The answer is one list of every tab's items since 22.09.2026, so „the second
	 * item" means nothing without saying second of WHAT. Counted inside the tab, which is
	 * the order a moderator works down and the order {@code order by r.target,
	 * v.raised_at, v.id} produces.
	 */
	private JsonNode itemIn(String email, String queue, int nth) throws Exception {
		List<JsonNode> out = new ArrayList<>();
		for (JsonNode item : answer(email)) {
			if (queue.equals(item.path("queue").asString())) {
				out.add(item);
			}
		}

		assertThat(out.size())
				.as("%s answered %s with fewer than %d items in the %s tab, so the item this case"
						+ " reads is not there at all", PATH, email, nth + 1, queue)
				.isGreaterThan(nth);

		return out.get(nth);
	}

	/** What one tab holds, as the subjects of its items, which is what a moderator reads. */
	private List<String> waitingIn(String email, String queue) throws Exception {
		List<String> out = new ArrayList<>();
		for (JsonNode item : answer(email)) {
			if (queue.equals(item.path("queue").asString())) {
				out.add(item.path("subject").asString());
			}
		}
		return out;
	}

	/**
	 * EVERY ITEM SERVED TO SOMEBODY, which is the answer itself and NOT A FLATTENING OF
	 * IT.
	 *
	 * <p><b>This method used to walk into a {@code waiting} array and build a list out of
	 * it, and that is precisely why the floors below could not see what broke the
	 * portal.</b> The answer was grouped by tab; the portal asked for a flat list of
	 * items; and this method quietly did the ungrouping that the portal did not, so every
	 * field-level floor compared items the server never handed anybody in that shape. A
	 * guard that has to reshape its subject before it can pass is measuring the shape it
	 * made itself.
	 *
	 * <p>It stays as a name rather than being inlined so the sentence above has somewhere
	 * to live, and {@link #theAnswerIsAFlatListOfItemsAndNeverAListOfTabs} is what holds
	 * it: if the answer is ever grouped again, that case fails before any floor here gets
	 * the chance to hide it.
	 */
	private JsonNode everyItemServedTo(String email) throws Exception {
		return answer(email);
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
	 * ADL A8, 13.09.2026, „Server odbija moderatora bez privilegije sa 404"), and the same decision
	 * keeps 401 where it is: „401 ne govori ništa o tome šta iza adrese stoji, nego kaže da se treba
	 * prijaviti". The case below is the other direction.
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
	 * <p>The owner (ADL A8, 13.09.2026, „Server odbija moderatora bez privilegije sa
	 * 404"): „Server odbija moderatora bez privilegije sa 404, ne sa 403", because the
	 * administration draws no screen he may open and the server must not be the one place that says
	 * the address exists. PDL P28a, 30.07.2026, „Odeljci Verifikacija i Entiteti nemaju sopstvenu"
	 * says it for this section: its address opens „prvi red... koji ta osoba sme, a naslovnu kad ne
	 * sme nijedan".
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
	 * <p>The owner (PDL P28a, 30.07.2026, „Moderator vidi samo redove i entitete"):
	 * „Moderator vidi samo redove i entitete za koje ima pravo... Ne skriva se samo ekran nego i
	 * saznanje da ekran postoji."
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
		/* HIS TWO TICKS, AND ONLY ONE OF THEM CAN SHOW HERE, which is said out loud rather
		   than quietly expected: the answer carries items since 22.09.2026, so a tab he may
		   work in and has nothing to do in contributes nothing to it. His other tab is
		   `results`, and it is empty on purpose - that is what
		   `aTabHeMayWorkInWithNothingInItIsAnEmptyAnswerAndNotARefusal` is about. Both
		   halves of the premise are floored below, so „it is not here" cannot come to mean
		   „the filter dropped it". */
		assertThat(ticksOf(TWO_QUEUES))
				.as("this moderator holds one tick rather than two, so holding any queue and"
						+ " holding THIS queue answer alike for him and neither half below"
						+ " measures the filter")
				.isEqualTo(2);
		assertThat(reallyInTheQueue(RESULTS, "waiting"))
				.as("his other tab holds something waiting, so its absence from his answer is a"
						+ " finding and not the premise of this case")
				.isEmpty();

		assertThat(tabsServedTo(TWO_QUEUES))
				.as("a moderator was served a tab he has no tick for, or lost the one he has"
						+ " something waiting in")
				.containsExactly(COMMENTS);

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
		assertThat(itemIn(OTHER_QUEUES, PROFILES, 0).path("photoId").asLong())
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
	 * THE ANSWER IS A FLAT LIST OF ITEMS, AND NEVER A LIST OF TABS.
	 *
	 * <p><b>This is the case the portal did not have on 22.09.2026, and its absence is the
	 * whole of the fault the owner met on QA.</b> The answer was grouped - a row per tab,
	 * each carrying a {@code waiting} array - and the portal asks for this resource as a
	 * flat {@code PendingItem[]} like the other thirteen. Every wrapper then passed the
	 * screen's own filter for an item, because a wrapper HAS a {@code queue} field and
	 * {@code decisions[undefined]} is undefined, so „Administracija → Verifikacija →
	 * Timovi" drew a wrapper as an item and threw on {@code undefined.trim()}.
	 *
	 * <p><b>Written over the SHAPE and not over a field</b>, because that is the mutation
	 * it has to catch: a record carrying {@code queue} and {@code waiting} satisfies „the
	 * answer names its tabs" perfectly well, and it is exactly what broke. So this asks
	 * what a record IS - it carries a subject and no nested list - rather than what it is
	 * called.
	 *
	 * <p><b>And it stands before every floor in this file rather than beside them</b>: the
	 * two {@link Answers} floors read one record's field names, and grouped, that record
	 * is a tab. {@code everyItemServedTo} used to do the ungrouping for them, which is how
	 * a resource whose shape no screen could read passed every case here for a day.
	 */
	@Test
	void theAnswerIsAFlatListOfItemsAndNeverAListOfTabs() throws Exception {
		assertThat(answer(THE_SUPERADMIN).isArray())
				.as("%s did not answer with a list at all", PATH)
				.isTrue();

		for (JsonNode record : answer(THE_SUPERADMIN)) {
			assertThat(record.has("waiting"))
					.as("a record of this answer carries a nested list of items, so the answer is"
							+ " grouped and the portal reads a wrapper as an item: %s", record)
					.isFalse();
			assertThat(record.has("subject") && record.has("queue"))
					.as("a record of this answer is not an item: an item carries what the decision"
							+ " is about and the tab it stands in, on itself: %s", record)
					.isTrue();
		}
	}

	/**
	 * A TAB HE MAY WORK IN WITH NOTHING IN IT IS AN EMPTY ANSWER, AND NEVER A REFUSAL.
	 *
	 * <p>The owner (PDL P28a, 29.08.2026, „Prazan red ostaje u navigaciji"): „Prazan red
	 * ostaje u navigaciji i pokazuje nulu. Neka ipak ne nestaju stavke iz Verifikacije kad se
	 * odobre. Neka ostane vidljiva i neka piše 0."
	 *
	 * <p><b>What this case measured until 22.09.2026, and why it measures something else
	 * now.</b> The answer used to carry a row per TAB, so the decision had a shape on this
	 * side: an empty tab was a row with an empty list, held here by an OUTER join. The
	 * answer carries items now and an item is what a moderator works on, so a tab with
	 * nothing waiting contributes nothing - which is what „nothing is waiting" means. The
	 * nought the owner asked for is drawn where it always was drawn: the screen names its
	 * tabs off the RIGHTS ({@code usePermittedQueues}) and counts the items it was handed
	 * ({@code countFor}), and neither of those ever read this answer for the list of tabs.
	 *
	 * <p><b>So what is left of the decision on this side is the half that can still be
	 * got wrong, and it is the half that matters:</b> a moderator whose tabs happen to be
	 * empty must be answered 200 and an empty list, NOT the 404 that says the section is
	 * not there. Answering him 404 would shut the section on a man who may open it, which
	 * is the same screen the owner refused.
	 *
	 * <p><b>Both ways of being empty, because they are different rows in the table.</b>
	 * One tab has been worked to the bottom - every row in it decided - and one never held
	 * anything; {@code state = 'waiting'} has to subtract the first without the second
	 * having to exist. With the floor that says the rows really are in the table, because
	 * „the tab is empty" and „the tab was never written" look the same from the answer.
	 *
	 * <p><b>{@code schedule} carries the row {@link #sixAccountsAndSixTabs} needs since
	 * 22.09.2026</b> - {@code currentDate} and {@code proposedDate} answer for real now
	 * (ADL A64 A2), and a field blank on every other record needs one record where it is
	 * not, or {@code noFieldOfAnItemIsTheSameInEveryRecord} refuses it. So THIS case, and
	 * only this one, deletes that one row first: the „never held anything" flavour is still
	 * worth its own measurement, and the row it needs gone belongs to no other case here.
	 */
	@Test
	void aTabHeMayWorkInWithNothingInItIsAnEmptyAnswerAndNotARefusal() throws Exception {
		assertThat(db.sql("delete from verification where queue = ?").param(SCHEDULE).update())
				.as("the fixture no longer has exactly the one schedule row this case removes to"
						+ " get back to a tab that has never held anything")
				.isOne();

		assertThat(reallyInTheQueue(RESULTS, "waiting"))
				.as("the tab this case calls worked to the bottom still has something waiting in it")
				.isEmpty();
		assertThat(reallyInTheQueue(RESULTS, "approved"))
				.as("the tab this case calls worked to the bottom holds no decided row either, so"
						+ " it is the other kind of empty and measures the other mutation")
				.isNotEmpty();
		assertThat(reallyInTheQueue(SCHEDULE, "waiting").size()
						+ reallyInTheQueue(SCHEDULE, "approved").size()
						+ reallyInTheQueue(SCHEDULE, "rejected").size())
				.as("the tab this case calls untouched holds rows, so it is not the other kind of"
						+ " empty")
				.isZero();

		assertThat(waitingIn(TWO_QUEUES, RESULTS))
				.as("a tab worked to the bottom answered with something waiting in it")
				.isEmpty();
		assertThat(waitingIn(THE_SUPERADMIN, SCHEDULE))
				.as("a tab that has never held anything answered with something in it")
				.isEmpty();

		/* AND THE HALF THAT WOULD SHUT THE SECTION, asked of the ONE person for whom „may
		   he" and „is there anything for him" answer differently. Asked of anybody else in
		   this fixture it would be carried by a tab that happens to hold something, and a
		   server that refused on an empty answer would pass. */
		assertThat(ticksOf(EMPTY_QUEUES))
				.as("this case is about a man who MAY work somewhere, so his ticks are the"
						+ " premise and not a detail")
				.isEqualTo(2);
		assertThat(statusOf(EMPTY_QUEUES))
				.as("a moderator was refused because the tabs he may work in are empty, which"
						+ " shuts a section he may open (owner, 29.08.2026) and tells him the"
						+ " address is not there (ADL A8)")
				.isEqualTo(200);
		assertThat(answer(EMPTY_QUEUES))
				.as("a moderator with nothing to do was served something")
				.isEmpty();
	}

	/**
	 * WHAT HAS BEEN DECIDED IS NOT IN THE ANSWER, IN ANY SHAPE.
	 *
	 * <p>The owner (PDL P28a, 06.08.2026, „Red pokazuje samo ono što čeka"): „Sekcija
	 * „Rešeno" se ukida. Red pokazuje samo ono što čeka; šta je rešeno nije posao koji stoji pred
	 * moderatorom."
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
	 * them. PDL P9, „briše sa portala posle verifikacije" („dokaz se briše posle verifikacije") and
	 * ADL A36 O11 are where it comes from, and the constraint is the one thing that makes it true of
	 * every writer rather than of the ones somebody remembered.
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
	 * u ovoj tabeli kao neko kome se prava dodeljuju" (PDL P28a, 30.07.2026, „Superadmin nema
	 * kućice"). Read as the ticks alone - which is what a condition written into the SQL of this
	 * resource would be - he is served nothing at all, and the administration is shut to the one
	 * account that may do everything.
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

		/* EVERY QUEUE THE MATRIX HOLDS, LESS THE ONE THAT HAS NOTHING WAITING (`results`,
		   decided down to the bottom), and the subtraction is MEASURED here rather than
		   written into the expectation. Listing the five by name would be a list that
		   agrees with the code by hand; taken away from the matrix's own list, a seventh
		   queue added tomorrow joins this case on the day it is inserted, exactly as it
		   did before the answer went flat. */
		List<String> withSomethingWaiting = new ArrayList<>(everyQueueThereIs());
		withSomethingWaiting.removeIf(queue -> reallyInTheQueue(queue, "waiting").isEmpty());

		assertThat(withSomethingWaiting)
				.as("every queue of the matrix is empty, so the comparison below says nothing")
				.hasSizeLessThan(everyQueueThereIs().size());

		assertThat(tabsServedTo(THE_SUPERADMIN))
				.as("the tabs served are not the queues the rights matrix holds something waiting"
						+ " in")
				.isEqualTo(withSomethingWaiting);
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
		/* The five that hold something, in `admin_right.target` order and not in the order
		   their rows were written: `teams` was written last and comes last by name too, so
		   `payments`, `profiles` and `schedule` are what separate the two - all three were
		   written after the comments and all three sort before `teams` would have them.
		   `schedule` waits once since 22.09.2026 (ADL A64 A2), so this floor now names five
		   tabs rather than the four it named while that one was still empty on purpose. */
		assertThat(tabsServedTo(THE_SUPERADMIN))
				.as("the tabs came back in an order nobody decided")
				.containsExactly(COMMENTS, PAYMENTS, PROFILES, SCHEDULE, TEAMS);

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
		JsonNode late = itemIn(THE_SUPERADMIN, COMMENTS, 1);

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
	 * WHICH SORT OF THING AN ITEM IS, ON THE TWO TABS THAT HOLD MORE THAN ONE.
	 *
	 * <p>Read off the schema rather than stored: a teams row whose proposal names a team is
	 * a change to that team, and a profiles row is a picture exactly while it still holds
	 * one. A third column saying the same thing could disagree with both.
	 */
	@Test
	void whatTheTeamsAndProfilesTabsSayAnItemIsComesOffTheSchemaAndNotOffAGuess()
			throws Exception {
		/* WRITTEN BECAUSE A MUTATION PASSED. Before this case existed, killing the
		   `teamEdit` branch outright - `case when false then 'teamEdit'` - left the whole
		   package green: the two floors ask whether `kind` is ANSWERED and whether it
		   VARIES, and it went on varying across `bio`, `photo` and the empty one. So
		   „which sort of thing is this" had a name and no meaning, on the one tab this
		   increment is about. */
		assertThat(itemIn(THE_SUPERADMIN, TEAMS, 0).path("kind").asString())
				.as("a proposal that names no team is a NEW team, and the empty sort is what"
						+ " every tab holding one sort of thing carries")
				.isEqualTo("");
		assertThat(itemIn(THE_SUPERADMIN, TEAMS, 1).path("kind").asString())
				.as("a proposal that names the team it is about is a CHANGE to that team"
						+ " (owner, 04.09.2026), and the screen refuses a change whose team is"
						+ " gone by reading exactly this")
				.isEqualTo("teamEdit");

		/* AND THE OTHER TAB THAT HOLDS TWO SORTS, so „read off the schema" is not one
		   column answered twice. A profiles row is a picture exactly while it still holds
		   one; the two rows below are one of each and are the two halves of PDL P28a,
		   06.08.2026, „Biografije i profilne slike postaju jedan red". */
		assertThat(itemIn(OTHER_QUEUES, PROFILES, 0).path("kind").asString())
				.as("a profiles row carrying a photograph is not answered as a picture, so the"
						+ " moderator is asked to write the wrong kind of refusal")
				.isEqualTo("photo");
		assertThat(itemIn(OTHER_QUEUES, PROFILES, 1).path("kind").asString())
				.as("a profiles row carrying no photograph is not answered as a biography, so"
						+ " the answer above is not being told apart from a constant")
				.isEqualTo("bio");
	}

	/**
	 * AND THE TOWN OF A PROPOSED TEAM COMES OUT WHICHEVER WAY V11 LETS IT BE HELD.
	 *
	 * <p>A proposal carries a town from the codebook or one somebody typed, never both and
	 * never neither ({@code team_proposal_town_is_from_the_codebook_or_typed}). One of each
	 * here, because a query reading only {@code tp.city} serves the typed one and loses the
	 * other, and a query reading only {@code place.name} does the reverse - and each of
	 * those mistakes is green against a fixture holding one of the two.
	 *
	 * <p><b>The country is the CODE and never the name</b>, which is what {@link TeamApi}
	 * and {@link CompetitorApi} answer and what {@code countryName} on the portal expects.
	 * Two different countries, so „the country of this proposal" cannot be satisfied by a
	 * query that found the league's own.
	 */
	@Test
	void aProposedTeamAnswersWithItsTownAndItsCountryCode() throws Exception {
		JsonNode typed = itemIn(THE_SUPERADMIN, TEAMS, 0);

		assertThat(typed.path("city").asString())
				.as("a proposal whose town was TYPED did not answer with it")
				.isEqualTo(TYPED_TOWN);
		assertThat(typed.path("country").asString())
				.as("a proposal whose town was typed did not answer with that town's country,"
						+ " as the two-letter code")
				.isEqualTo(TYPED_COUNTRY);

		JsonNode fromTheBook = itemIn(THE_SUPERADMIN, TEAMS, 1);

		assertThat(fromTheBook.path("city").asString())
				.as("a proposal whose town came out of the CODEBOOK answered with nothing, so"
						+ " only one of V11's two ways of holding a town reaches the screen")
				.isEqualTo(db.sql("select name from place where id = "
						+ A_TOWN_IN_THE_CODEBOOK).query(String.class).single());
		assertThat(fromTheBook.path("country").asString())
				.as("a codebook town did not answer with its own country's code")
				.isEqualTo("RS");

		assertThat(typed.path("country").asString())
				.as("both proposals are in one country, so this case cannot tell a query that"
						+ " read the right country from one that read any country")
				.isNotEqualTo(fromTheBook.path("country").asString());
	}

	/**
	 * AND THE PAYMENTS TAB ANSWERS WITH THE TOWN THE PERSON HIMSELF LIVES IN.
	 *
	 * <p><b>Two tabs draw a town and until 22.09.2026 only one of them was answered one.</b>
	 * The portal says which two and why in as many words ({@code PendingItem.city}): the
	 * teams tab because approving a proposal is what makes the team out of them (PDL P13),
	 * and the payments tab because how a member pays follows the country he lives in (PDL
	 * P8). The query read {@code team_proposal} alone, so the „Mesto" column the payments
	 * screen draws ({@code pages/admin/Payments.tsx}) was empty on every row while the
	 * columns to fill it sat on {@code competitor} (V7).
	 *
	 * <p><b>Both of {@code competitor}'s two ways of holding a town</b>, which is the same
	 * axis the proposals above are read along and for the same reason: a query reading only
	 * {@code place.name} and a query reading only {@code competitor.city} each answer one of
	 * these two rows and lose the other, and each is green against a fixture with one row.
	 *
	 * <p><b>And the four tabs that carry no town are asked too, which is the half that makes
	 * this about the TAB rather than about the join.</b> Written as one {@code coalesce}
	 * falling from the proposal through to the sender - the shortest way to make the two
	 * assertions above pass - a comment and a racing profile would answer with their
	 * author's town, and a moderator deciding about a text would be shown where its writer
	 * lives. Everybody in this fixture lives somewhere, so those rows are blank only if the
	 * tab decides it.
	 */
	@Test
	void aRegistrationAnswersWithTheTownItsSenderLivesInAndTheOtherTabsWithNone()
			throws Exception {
		JsonNode fromTheBook = itemIn(THE_SUPERADMIN, PAYMENTS, 0);

		assertThat(fromTheBook.path("city").asString())
				.as("a registration whose sender's town came out of the CODEBOOK answered with"
						+ " nothing, so the payments screen draws its own column empty")
				.isEqualTo(db.sql("select name from place where rank = 1")
						.query(String.class).single());
		assertThat(fromTheBook.path("country").asString())
				.as("a codebook town did not answer with its own country's code, which is what"
						+ " PDL P8 hangs the way a member pays on")
				.isEqualTo(db.sql("select c.code from country c join place p on p.country_id = c.id"
						+ " where p.rank = 1").query(String.class).single());

		JsonNode typed = itemIn(THE_SUPERADMIN, PAYMENTS, 1);

		assertThat(typed.path("city").asString())
				.as("a registration whose sender TYPED his town answered with nothing, so only one"
						+ " of the two ways `competitor` holds a town reaches the screen")
				.isEqualTo(HER_TYPED_TOWN);
		assertThat(typed.path("country").asString())
				.as("a typed town did not answer with the country typed beside it")
				.isEqualTo(HER_TYPED_COUNTRY);

		assertThat(typed.path("country").asString())
				.as("both payments rows are in one country, so this case cannot tell a query that"
						+ " read the right country from one that read any country")
				.isNotEqualTo(fromTheBook.path("country").asString());

		assertThat(itemIn(THE_SUPERADMIN, COMMENTS, 0).path("city").asString())
				.as("a comment answered with a town, and the only town anywhere near it is where"
						+ " its AUTHOR lives - which is not this tab's to show")
				.isEmpty();
		assertThat(itemIn(OTHER_QUEUES, PROFILES, 0).path("city").asString())
				.as("a racing profile answered with a town, which the portal says that tab has"
						+ " not got")
				.isEmpty();
		assertThat(itemIn(THE_SUPERADMIN, COMMENTS, 0).path("country").asString())
				.as("a comment answered with a country, so the country is falling through where"
						+ " the town is not and the two halves of one fact have parted")
				.isEmpty();
	}

	/**
	 * AND THE TEAM A CHANGE IS ABOUT IS ANSWERED BY ITS KEY, blank where there is none.
	 *
	 * <p>The screen finds the team by {@code String(team.id) === item.subjectId} and refuses
	 * a change whose team has been deleted meanwhile (review, 05.09.2026). Read off
	 * {@code team_proposal.team_id} and never off the subject, because two teams may carry
	 * one name and a change matched by name would be filed against whichever came first.
	 */
	@Test
	void aChangeAnswersWithTheKeyOfTheTeamItIsAboutAndAProposalWithNone() throws Exception {
		assertThat(itemIn(THE_SUPERADMIN, TEAMS, 1).path("subjectId").asString())
				.as("a change did not answer with the key of the team it is about, so the screen"
						+ " cannot find it and refuses every change as though the team were gone")
				.isEqualTo(String.valueOf(db.sql("select id from team where slug ="
						+ " 'dunavski-trkaci'").query(Long.class).single()));

		assertThat(itemIn(THE_SUPERADMIN, TEAMS, 0).path("subjectId").asString())
				.as("a proposal for a team that does not exist yet answered with a key, so the"
						+ " screen would look for a team nobody has made")
				.isEqualTo("");
	}

	/**
	 * AND A WAITING COMMENT ANSWERS WITH THE KEY OF THE EVENT IT IS ABOUT, since V30 gave
	 * this tab a pointer of its own (ADL A64 A1).
	 *
	 * <p>„Beogradski maraton 2027" is deliberately not the first event the fixture makes
	 * (`decoyEvent` is), so a query that coalesced the wrong join or read
	 * {@code Number('')} on the portal's own side would answer with a DIFFERENT event's key
	 * or with nought, and either is caught here.
	 */
	@Test
	void aWaitingCommentAnswersWithTheKeyOfTheEventItIsAbout() throws Exception {
		assertThat(itemIn(THE_SUPERADMIN, COMMENTS, 0).path("subjectId").asString())
				.as("a waiting comment did not answer with the key of the event it is about")
				.isEqualTo(String.valueOf(db.sql("select id from btl_event where slug ="
						+ " 'beogradski-maraton-2027'").query(Long.class).single()));

		assertThat(itemIn(THE_SUPERADMIN, COMMENTS, 1).path("subjectId").asString())
				.as("two comments about two different events answered with the same key")
				.isNotEqualTo(itemIn(THE_SUPERADMIN, COMMENTS, 0).path("subjectId").asString())
				.isEqualTo(String.valueOf(db.sql("select id from btl_event where slug ="
						+ " 'fruskogorski-maraton-2027'").query(Long.class).single()));
	}

	/**
	 * AND THE THREE MARKS ANSWER TOO, off the same table (ADL A64 A1).
	 *
	 * <p>One comment rated and one not, read side by side: {@code NO_RATING} - nought on
	 * all three - is the ordinary state of a comment nobody has marked yet and not a state
	 * this floor may refuse, so the case has to show both rather than only the marked one.
	 */
	@Test
	void aWaitingCommentAnswersWithWhatItWasRatedAndAnUnratedOneAnswersWithNought() throws Exception {
		JsonNode rated = itemIn(THE_SUPERADMIN, COMMENTS, 0);

		assertThat(rated.path("rating").path("organisation").asInt()).isEqualTo(5);
		assertThat(rated.path("rating").path("value").asInt()).isEqualTo(4);
		assertThat(rated.path("rating").path("ambience").asInt()).isEqualTo(5);

		JsonNode unrated = itemIn(THE_SUPERADMIN, COMMENTS, 1);

		assertThat(unrated.path("rating").path("organisation").asInt()).isZero();
		assertThat(unrated.path("rating").path("value").asInt()).isZero();
		assertThat(unrated.path("rating").path("ambience").asInt()).isZero();
	}

	/**
	 * AND A REPORTED CHANGE OF TERM ANSWERS WITH BOTH ITS DAYS.
	 *
	 * <p><b>Four different days, the axis „dva izvora, jedna vrednost" warns against</b>:
	 * the event's LIVE day ({@code 2027-08-08}), the day the reporter SAW before an
	 * administrator corrected it ({@code 2027-07-25}, stored on {@code schedule_proposal}
	 * but read by nothing here), the day proposed ({@code 2027-08-22}) and the day the
	 * item was raised ({@code 2026-09-12}). {@code currentDate} must answer the FIRST of
	 * these and none of the other three.
	 */
	@Test
	void aReportedChangeOfTermAnswersWithTheDayReportedAndTheDayProposed() throws Exception {
		JsonNode item = itemIn(THE_SUPERADMIN, SCHEDULE, 0);

		assertThat(item.path("currentDate").asString())
				.as("currentDate did not answer with the event's own LIVE day - it answered with"
						+ " the stale day the reporter saw, with raised_at, or with today, and all"
						+ " three are the wrong source for a label that reads \"Datum u kalendaru\"")
				.isEqualTo("2027-08-08");
		assertThat(item.path("proposedDate").asString()).isEqualTo("2027-08-22");
	}

	/**
	 * AND WHO SENT IT IN IS ANSWERED BESIDE WHAT IT IS ABOUT, never instead of it.
	 *
	 * <p>On the payments tab the two are the same person and everywhere else they are not,
	 * so a resource answering the subject twice would satisfy every payments case and lose
	 * the name on the other five.
	 */
	@Test
	void whoSentAnItemInIsAnsweredBesideWhatItIsAbout() throws Exception {
		JsonNode comment = itemIn(THE_SUPERADMIN, COMMENTS, 0);

		assertThat(comment.path("who").asString())
				.as("the name of whoever sent an item in is not answered, so the card cannot"
						+ " name the sender at all")
				.isEqualTo("Ana Anic");
		assertThat(comment.path("who").asString())
				.as("the sender is being answered out of the subject, which is the event on this"
						+ " tab and not a person at all")
				.isNotEqualTo(comment.path("subject").asString());
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
		JsonNode nameless = itemIn(THE_SUPERADMIN, PAYMENTS, 0);

		assertThat(nameless.path("subject").asString())
				.as("the item about somebody with no number is not where it is being read from")
				.isEqualTo("Gordana Goric");

		assertThat(nameless.path("memberNumber").isNull())
				.as("an item about somebody who has registered and has no number answered with one")
				.isTrue();

		assertThat(itemIn(THE_SUPERADMIN, TEAMS, 0).path("memberNumber").asString())
				.as("an item about a member did not answer with HIS number, so the nothing above is"
						+ " not being told apart from a number")
				.isEqualTo(MEMBER_ONE);

		/* AND THE SAME TWO STATES ON ONE TAB, which is what makes the nothing a property of
		   the ROW rather than of the queue it is standing in. A server answering every
		   payments row with nothing - filtering the join, or reading the column off the
		   wrong side - passes the two assertions above and fails this one. */
		assertThat(itemIn(THE_SUPERADMIN, PAYMENTS, 1).path("memberNumber").asString())
				.as("a payments row about a member whose fee has run out answered with no number,"
						+ " so nothing is being answered for the whole tab rather than for the"
						+ " row that has none")
				.isEqualTo(LAPSED);
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
	 * people whose fee is not recorded (PDL P28a, 24.08.2026, „Verifikacija ima šest redova",
	 * „Uplate i aktivacija članova").
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
	 * EVERY FIELD THE PORTAL READS IS ONE THE SERVER ANSWERS WITH, EXCEPT THE THREE THE
	 * SCHEMA HAS NOWHERE TO HOLD (OR NOWHERE IT MAY BE READ FROM), AND THOSE ARE NAMED HERE
	 * EACH WITH ITS OWN REASON.
	 *
	 * <p>V9 says what it is and is not, in as many words: „What this table is NOT. It does not
	 * model what each tab is about. A comment is a row in {@code event_comment}, a photograph
	 * is a row in {@code photo}, a result will be a row in {@code result}, and this table
	 * points at them rather than copying them. What it holds is the part every tab shares: who
	 * it is about, what was proposed, and what a moderator decided."
	 *
	 * <p><b>TWELVE NAMES STOOD HERE UNTIL 22.09.2026, UNDER ONE REASON, AND NINE OF THEM
	 * NOW HAVE A COLUMN.</b> The reason was „there is no column for any of them", and it was
	 * true of V9 alone. V11 had already given the teams tab a row of its own, and a
	 * {@code team_proposal} carries the town, the country and the team a change is about;
	 * {@code competitor} carries the sender's name; which SORT of thing a row is can be read
	 * off the schema twice over; and V30 gave the comments and the schedule tabs a row of
	 * their own too, closing the last three of the nine (ADL A64). The screen that read six
	 * of the twelve as always blank threw in front of the owner on QA before any of this.
	 *
	 * <p><b>That is the cost of one reason covering a list.</b> A name on a list with a true
	 * reason is a boundary; a name on a list with somebody else's reason is a field nobody
	 * will look at again. So each of the three below carries the reason that is true of IT.
	 *
	 * <ul>
	 * <li>{@code email} - the address a registration waiting for its fee is known by. It is on
	 * {@code account} and reachable, so this one is a decision about what the payments tab may
	 * say rather than a missing column, and it is in {@code PENDING.md} as that.
	 * <li>{@code picture}, {@code crop} - NOT a missing column. ADL A60, 20.09.2026: „Slika
	 * koju drzi samo nesto sto ceka odluku moderatora nije javna: ni verification.photo_id...
	 * Takva slika odgovara tacno isto kao slika koje nema", and {@link PhotoApi} enforces it by
	 * serving only what {@code competitor.photo_id} or {@code team.logo_id} holds. An address
	 * answered here would be asked for and refused, so the card would draw a broken frame -
	 * worse than drawing none. Letting a moderator see what he is deciding about is a new
	 * decision about who may see a picture, and it belongs to the owner.
	 * </ul>
	 *
	 * <p><b>{@code rating}, {@code currentDate} and {@code proposedDate} left this list on
	 * 22.09.2026</b> (ADL A64 A1, A2), off {@code comment_submission} and
	 * {@code schedule_proposal}; {@link #aWaitingCommentAnswersWithWhatItWasRatedAndAnUnratedOneAnswersWithNought}
	 * and {@link #aReportedChangeOfTermAnswersWithTheDayReportedAndTheDayProposed} are the
	 * cases that hold them now rather than this one holding their absence.
	 *
	 * <p><b>And one name is answered that the portal does not read</b>, {@code photoId}, which
	 * is V9's own column. It is the one thing there will be to revisit the day A60 is.
	 *
	 * <p><b>{@code Answers} checks both halves of every name</b> - that the file really serves
	 * it, so a stale name cannot excuse a field that went missing for another reason, and that
	 * the answer really leaves it out, so each of the three is a claim rather than a wish.
	 *
	 * <p><b>It reads the ANSWER and no longer a flattening of it</b>, which is what made this
	 * floor blind: see {@code everyItemServedTo} and
	 * {@link #theAnswerIsAFlatListOfItemsAndNeverAListOfTabs}.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered(PATH, everyItemServedTo(THE_SUPERADMIN),
				"verification.json", Set.of("photoId"),
				"picture", "crop", "email");
	}

	/**
	 * AND NO FIELD OF AN ITEM IS THE SAME IN EVERY ONE OF THEM.
	 *
	 * <p>A field the fixture never varies is a field a constant would answer, and the two read
	 * alike in every case above. It is also what keeps {@code state} out of the answer by
	 * measurement rather than by memory: „Sekcija „Rešeno" se ukida" means only waiting rows
	 * come out, so a {@code state} field would be the string {@code waiting} in every record
	 * and this floor would refuse it.
	 *
	 * <p><b>IT ABSORBED A SECOND FLOOR ON 22.09.2026, AND THAT IS SAID HERE RATHER THAN
	 * LEFT AS A CASE THAT WENT AWAY.</b> Beside it stood
	 * {@code noFieldOfATabIsTheSameInEveryRecord}, over the TAB records, and its claim was
	 * that „a resource that handed every tab the same list is a resource where the tab means
	 * nothing". There are no tab records any longer, and the claim is not lost: {@code queue}
	 * is a field of the ITEM now, so a server answering every item with one tab - or reading
	 * the tab off anything but the row - is refused by THIS floor, which is the same mutation
	 * arriving at the same place by a shorter road.
	 *
	 * <p><b>Measured before the old case was removed, and not assumed:</b> with
	 * {@code r.target} replaced by a literal in the query, this floor fails on {@code queue}.
	 * That is the rule of 05.09.2026 - a guard is not taken away until its mutations fall on
	 * whatever replaces it.
	 */
	@Test
	void noFieldOfAnItemIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord(PATH, everyItemServedTo(THE_SUPERADMIN));
	}
}
