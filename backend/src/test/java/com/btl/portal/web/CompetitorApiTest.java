package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Who runs in the league, and the one thing that must never leave with them. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CompetitorApiTest {

	/** Named here with the reason, because a lost field and a withheld one look alike. */
	/*
	 * THE YEAR OF BIRTH IS NO LONGER NAMED HERE, because the portal no longer serves it
	 * (B52, 13.09.2026). `Answers` refuses a name the file does not carry, and rightly:
	 * leaving `birthYear` in this list would excuse nothing and quietly stand in for a
	 * field that went missing for some other reason. What the file carries in its place
	 * is the age band, below.
	 *
	 * The claim itself has not gone anywhere. The year cannot leave a server that is
	 * never asked for it, and `noYearOfBirthLeavesTheServer` asks the whole answer as
	 * text rather than by field name.
	 */
	/**
	 * SERVED BUT NOT ANSWERED YET, AND THAT IS A DEBT RATHER THAN A REFUSAL.
	 *
	 * <p>This is the one name in this list that is not withheld on purpose. The four
	 * below are fields Article 73 and Article 74 keep off a public answer for ever. The
	 * age band is the opposite: it is exactly what Article 74 says IS public („Javna je
	 * samo kategorija koja iz njega proizlazi"), the portal began serving it on
	 * 13.09.2026, and this resource owes it.
	 *
	 * <p>It is not here yet for the reason written on {@link com.btl.portal.web.CompetitorApi}:
	 * the band is worked out from the year and the season, a member in their first season
	 * carries that category instead, and which of the two applies depends on their whole
	 * history of points (PDL P7, owner 03.08. and 11.08.2026). That is its own increment
	 * on this server, the same way the points are.
	 *
	 * <p><b>The debt clears itself.</b> `Answers` asserts that a name in this list really
	 * is absent from the answer, so the day this resource starts answering with the band
	 * this case fails and the name has to come out. It cannot be forgotten here.
	 */
	private static final String THE_AGE_BAND_THIS_RESOURCE_STILL_OWES = "ageBand";
	private static final String THE_REFERRAL_CODE = "referralCode";
	private static final String WHO_HANDED_OUT_THE_CODE = "referredBy";
	private static final String HOW_THE_MEMBERSHIP_IS_HELD = "membershipBasis";
	private static final String WHETHER_THE_FEE_IS_STANDING = "active";

	/**
	 * WHAT {@code referredBy} IS ANSWERED AS, once the resource knows who is asking.
	 *
	 * <p>Not the column: PDL, 06.09.2026, „`referredBy` cita ekran Clanarine da
	 * prebroji koga je clan doveo, a to je upit nad SVIMA, ne nad sobom". A count is
	 * that query answered where the data is; the column answered to whoever signs in
	 * would be every member's referrer beside his name, and the referrer is a code.
	 *
	 * <p>It is a name the portal does not serve, so {@code Answers} refuses it unless
	 * it is named as something answered on purpose.
	 */
	private static final String THE_COUNT_SHE_BROUGHT_IN = "referredCount";

	/** The one asking, and on purpose NOT the first record of the answer. */
	private static final String HER_OWN_ACCOUNT = "milica@primer.rs";

	/** A second member, who brought in nobody and is in no team. */
	private static final String THE_OTHER_MEMBER = "strahinja@primer.rs";

	/**
	 * Signed in, no member behind the account at all, AND A MODERATOR WHO HOLDS
	 * NOTHING OVER THE MEMBERS.
	 *
	 * <p>He is the state of „who is asking" that is easiest to miss and the one the
	 * rule is really about: PDL P8 gives the basis to „Superadmin i moderatori sa
	 * pravom nad clanovima", so a moderator WITHOUT that tick is on the far side of
	 * the line while looking like somebody on the near one. He is deliberately ticked
	 * for something else, so what refuses him is the right this resource asks for and
	 * not the absence of any right at all - {@code AdminRights.mayDoAnything} would
	 * answer yes about him.
	 */
	private static final String RACES_FOR_NOBODY = "moderator@primer.rs";

	/**
	 * AND THE MODERATOR WHO DOES HOLD IT, who is also a member, and whose own
	 * membership is held on a basis the rows he looks at do not all share.
	 *
	 * <p><b>He is 000031, whose fee has lapsed, and that is the point of choosing
	 * him.</b> He is not on the list at all (the resource answers only the members
	 * whose fee is standing), so „his own row" and „a row he is looking at" are never
	 * the same record - which is what makes the substitution measurable: served his
	 * own basis instead of each row's, every record would read {@code payment} and
	 * 000012 is {@code feeExempt}. Served on the caller's own row the way the referral
	 * code is, he would be answered nothing at all.
	 */
	private static final String THE_MODERATOR_OVER_THE_MEMBERS = "clanovi@primer.rs";

	/** And the other half of „Superadmin i moderatori sa pravom", who races for nobody. */
	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	/**
	 * THE FIVE STATES OF „WHO IS ASKING", SPLIT BY THE ONE LINE PDL P8 DRAWS.
	 *
	 * <p>Written out rather than derived, because what each account IS is the thing the
	 * fixture decides and nothing can read back. What IS derived is that the split is
	 * complete: {@code everyAccountInTheFixtureIsOnOneSideOfTheLineOrTheOther} reads
	 * every address out of {@code account} and requires these two lists to be exactly
	 * that set, so a sixth account added tomorrow has to be put on a side rather than
	 * quietly measured by nothing. The visitor is the {@code null} below, which is the
	 * same request without the cookie and is not an account.
	 */
	private static final List<String> NOBODY_WHO_MAY_READ_THE_BASIS =
			java.util.Arrays.asList(null, HER_OWN_ACCOUNT, THE_OTHER_MEMBER, RACES_FOR_NOBODY);

	/** And the two PDL P8 names, „Superadmin i moderatori sa pravom nad clanovima". */
	private static final List<String> THE_ADMINISTRATION =
			List.of(THE_MODERATOR_OVER_THE_MEMBERS, THE_SUPERADMIN);

	private final Map<String, SecretToken> sessions = new HashMap<>();

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/**
	 * Three members, and no two of them alike in anything the answer carries.
	 *
	 * <p>One takes her town from the codebook and one has it typed, which are the two
	 * shapes V7 allows. One is in a team and two are not, one was brought in by
	 * another and two were not, one hides his profile, and all three answer the
	 * birthday question differently. A field that is the same in every record is a
	 * field the server could answer with a constant, and `Answers` refuses that.
	 *
	 * <p><b>AND NO TWO OF THEM SHARE AN ORDER OR A FLAG</b>, because a fixture where
	 * two behaviours give the same list measures neither of them. Every axis below is
	 * separated on purpose and each line says which wrong answer it refuses:
	 *
	 * <ul>
	 * <li><b>The order.</b> They are written 000012, 000045, 000007, so the row order
	 * is not the number order and neither is its reverse. Surname, given name, day of
	 * birth, first season and referral code each sort them differently again, so
	 * ordering by any of those is a different list.</li>
	 * <li><b>The three flags on the row.</b> Hidden is 000007, not active is 000012,
	 * first season 2027 is 000045. Each is exactly one member and never the same one,
	 * so answering with the wrong column answers with the wrong member.</li>
	 * <li><b>The team.</b> The member in a team is 000012, who is neither the hidden
	 * one nor the inactive one. He ran for one team in 2027, left it, and joined the
	 * other in 2028, and 000007 left a team in 2027 and is in none now. So dropping
	 * the condition that the membership has not ended does two visible things at once:
	 * it gives 000007 a team he left, and it gives 000012 a second row.</li>
	 * <li><b>The season the membership started in</b> is 2028, which is neither the
	 * season the team started in (2027) nor either end of the membership he left.</li>
	 * <li><b>Who brought whom in, on BOTH sides of „whose fee is standing".</b> 000012
	 * brought in two people and they are 000007, who is on the list, and 000031, whose
	 * fee has lapsed and who is not. So the count this resource answers him with is
	 * ONE, and every wrong way of arriving at it is a different number: counting
	 * everybody gives four, counting the members whose fee stands gives three,
	 * counting everybody with a referrer at all gives two, and counting nothing gives
	 * nought. 000045 brought in nobody, so the same field asked of him is nought and a
	 * constant cannot answer both.</li>
	 * </ul>
	 *
	 * <p>What is deliberately NOT separated: sex lines up with the inactive member.
	 * That is not a substitution a wrong query could make, and four members cannot
	 * keep every set of them distinct at once.
	 */
	@BeforeEach
	void fourMembers() {
		member("000012", "Milica", "Djurisic", "F", "1968-03-11",
				"(select id from place where rank = 1)", "null", "null",
				2014, false, true, "feeExempt", "Trcim od 2014.", "0a2b4c6d8e0f1102", "null",
				false, "none");
		member("000045", "Strahinja", "Vukicevic", "M", "2007-01-30",
				"(select id from place where rank = 2)", "null", "null",
				2027, true, true, "payment", "Prva sezona.", "5f4e3d2c1b0a9903", "null",
				false, "full");
		member("000007", "Milos", "Pavlovic", "M", "1991-07-02",
				"null", "'Krusevac'", "(select id from country where code = 'RS')",
				2020, false, true, "payment", "", "b7f3a1c2d4e50601",
				"(select id from competitor where member_number = '000012')", true, "year");

		/* AND THE FOURTH, WHOSE FEE HAS LAPSED. His number sorts BETWEEN two of the
		   three, so a list that lets him through is wrong in its order as well as in
		   its length, and everything else about him is ordinary: he is not hidden, he
		   is in no team, and he pays like two of the others. The only thing that keeps
		   him out is the one thing being measured. */
		/* AND 000012 BROUGHT HIM IN TOO, which is the second half of the referral
		   count: one of the two he brought is on the list and one is not, so the
		   count and the length of the list are different numbers. */
		member("000031", "Nenad", "Ilic", "M", "1979-05-20",
				"(select id from place where rank = 1)", "null", "null",
				2015, false, false, "payment", "Pauziram.", "c3d2e1f0a9b87704",
				"(select id from competitor where member_number = '000012')",
				false, "none");

		team("probni-tim", "Probni tim", "000012");
		team("drugi-tim", "Drugi tim", "000045");

		membership("000012", "drugi-tim", 2027, "2027", "'Presao u drugi tim'");
		membership("000012", "probni-tim", 2028, "null", "null");
		membership("000007", "probni-tim", 2027, "2027", "'Prestao da trci za tim'");

		/* AND THREE WAYS OF ASKING, because the answer now depends on who asks.
		   000012 is deliberately NOT the first record - the list comes back 000007,
		   000012, 000045 - so „his own row" and „the first row" are two different
		   places and a resource that answered the first would be caught. */
		account(HER_OWN_ACCOUNT, "competitor");
		belongsTo(HER_OWN_ACCOUNT, "000012");
		account(THE_OTHER_MEMBER, "competitor");
		belongsTo(THE_OTHER_MEMBER, "000045");
		/* Signed in and racing for nobody: V23 leaves `account.competitor_id` empty for
		   an account that does not race, which is the ordinary case for a moderator
		   (owner, 14.09.2026). He is the case that separates „signed in" from „is a
		   member". */
		account(RACES_FOR_NOBODY, "moderator");
		/* AND HE HOLDS A RIGHT, just not this one, so what refuses him is the right this
		   resource asks for rather than his holding nothing at all. */
		ticked(RACES_FOR_NOBODY, "entity:events");

		/* AND THE TWO WHO MAY, which is the whole of PDL P8's „Superadmin i moderatori
		   sa pravom nad clanovima" and no third kind.

		   ONE OF THEM RACES AND THE OTHER DOES NOT, on purpose. The superadmin is the
		   ordinary case V23 describes and the one that catches a condition written
		   against the caller's MEMBER: with no member at all he would be answered
		   nothing. The moderator is a member, so a resource serving him his own basis
		   instead of each row's has something wrong to serve. */
		account(THE_MODERATOR_OVER_THE_MEMBERS, "moderator");
		ticked(THE_MODERATOR_OVER_THE_MEMBERS, CompetitorApi.OVER_THE_MEMBERS);
		belongsTo(THE_MODERATOR_OVER_THE_MEMBERS, "000031");

		account(THE_SUPERADMIN, "superadmin");
	}

	/** One box of the matrix, ticked for one named account (V18). */
	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?))")
				.params(email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** The link V23 wrote down: this account IS that member. */
	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}

	private void member(String number, String first, String last, String gender, String born,
			String place, String city, String country, int firstSeason, boolean firstSeason2027,
			boolean active, String basis, String bio, String referralCode, String broughtBy,
			boolean hidden, String birthdayShown) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '" + born + "', " + place + ", " + city + ", "
						+ country + ", ?, ?, ?, ?, ?, " + broughtBy + ", ?, ?, ?, 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, firstSeason, firstSeason2027, active, basis,
						referralCode, bio, hidden, birthdayShown)
				.update();
	}

	/** Both teams start in 2027, so the season a membership starts in is never the team's. */
	private void team(String slug, String name, String adminNumber) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, first_season,"
						+ " admin_id) values (?, ?, '', '',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " (select id from competitor where member_number = ?))")
				.params(slug, name, adminNumber).update();
	}

	private void membership(String number, String slug, int from, String to, String leftReason) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to,"
						+ " left_reason) values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?, " + to + ", " + leftReason + ")")
				.params(number, slug, from).update();
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(
				http.perform(get("/api/competitors")).andReturn().getResponse().getContentAsString());
	}

	/** @param email null for the visitor, which is the same request without the cookie */
	private MockHttpServletRequestBuilder asking(String email) {
		MockHttpServletRequestBuilder asks = get("/api/competitors");
		return email == null ? asks
				: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private String whole(String email) throws Exception {
		return http.perform(asking(email)).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	private JsonNode answerFor(String email) throws Exception {
		return new ObjectMapper().readTree(whole(email));
	}

	/** The one record of the answer that is about this member, for a field of his own. */
	private JsonNode recordOf(String email, String memberNumber) throws Exception {
		return StreamSupport.stream(answerFor(email).spliterator(), false)
				.filter(one -> one.path("memberNumber").asString().equals(memberNumber))
				.findFirst().orElseThrow();
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ANSWERED, EXCEPT THE FOUR THAT ARE NOT ITS
	 * BUSINESS, and those are named here with the reason.
	 *
	 * <p><b>These four are the whole reason this resource exists.</b> PDL, 06.09.2026,
	 * measured and named exactly them as the fields that cannot leave the public file
	 * „dok portal nema bekend", because one file was serving the public side, the
	 * member's own screens and the administration at once. This is that backend.
	 *
	 * <ul>
	 * <li><b>How the membership is held</b>: Article 74 goes on „Isto vazi za adresu
	 * elektronske poste, adresu, sve u vezi sa clanarinom i privatne poruke", and the
	 * basis says who is exempt from paying. The year of birth stood beside it here until
	 * 13.09.2026, when the portal stopped serving it at all (B52); the constant at the
	 * head of this class says what happened to it.</li>
	 * <li><b>The age band</b>, and it is the odd one out: not withheld but owed. See the
	 * constant that names it.</li>
	 * <li><b>The referral code</b> and <b>who handed it out</b>: Article 73 lists what
	 * is public and neither is on it. The second one hides behind its name: the portal
	 * reads `referredBy` as the CODE, not as a member number, so answering with either
	 * is wrong in its own way.</li>
	 * </ul>
	 *
	 * <p>`Answers` checks each name against the file the portal serves, so a name left
	 * here after the portal stopped serving it cannot quietly excuse a field that went
	 * missing for another reason, and it checks the answer really does leave them out.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/competitors", answer(), "competitors.json",
				THE_AGE_BAND_THIS_RESOURCE_STILL_OWES, THE_REFERRAL_CODE, WHO_HANDED_OUT_THE_CODE,
				HOW_THE_MEMBERSHIP_IS_HELD, WHETHER_THE_FEE_IS_STANDING);
	}

	/**
	 * AND NOTHING IN THE ANSWER IS A REFERRAL CODE, whatever it is called.
	 *
	 * <p>Asked of the whole answer as TEXT and not of a field name, for the same reason
	 * the year of birth is: the review that found this measured that swapping the member
	 * number for the code under the name `referredBy` passed the whole suite, because the
	 * omission was guarded by that name alone. A code is sixteen hexadecimal characters
	 * and every member in the fixture carries a different one.
	 */
	@Test
	void noReferralCodeLeavesTheServer() throws Exception {
		String whole = http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString();

		assertThat(whole).as("the answer carries nothing at all, so it says nothing about what it"
				+ " leaves out").contains("000007", "000012", "000045");

		List<String> codes = db.sql("select referral_code from competitor").query(String.class).list();
		assertThat(codes).as("no code was read out of the database, so the loop below asserts nothing")
				.hasSize(4);

		for (String code : codes) {
			assertThat(whole).as("a referral code (%s) left the server, which Clan 73 does not make"
					+ " public: it is the member's to hand out, not the portal's to publish", code)
					.doesNotContain(code);
		}
	}

	/**
	 * AND NOTHING IN THE ANSWER SAYS WHO PAYS AND WHO DOES NOT, TO ANYBODY BUT THE
	 * ADMINISTRATION.
	 *
	 * <p>PDL P8, 28.07.2026: „Osnov clanstva se nikad ne prikazuje javno. Ni na
	 * profilu, ni u tabelama, nigde. Vide ga samo Superadmin i moderatori sa pravom nad
	 * clanovima." Sharpened on 20.09.2026: „Clan vidi SVOJ osnov clanstva; tudji ne vidi
	 * niko osim administracije" - and his own arrives through {@code /api/me}, not here,
	 * for the reason written on {@link CompetitorApi}.
	 *
	 * <p><b>Three callers and not one, because „javno" is not „bez prijave".</b> The
	 * visitor, the member (whose OWN record is in this answer, so this is the sharpened
	 * half as well), and a signed in moderator who holds a right but not this one. The
	 * third is the state that is easiest to write as covered and hardest to cover: he
	 * reaches every line of this resource that the administration reaches, and only the
	 * answer to „may he" differs.
	 *
	 * <p>Asked of the text and not of a field name, because the basis is a short word
	 * that could arrive under any name at all.
	 *
	 * <p><b>The words are read off the schema, not written here.</b> Which words exist
	 * is a CHECK on the column, so the day a third basis is added the rule grows and this
	 * case grows with it. A list written by hand would have stayed two words long and
	 * said nothing about the third.
	 *
	 * <p><b>The boundary, measured and written down rather than left to a review:</b> it
	 * refuses the WORDS. It does not refuse the same fact answered as a boolean under a
	 * neutral name, because a boolean carries no word to look for. What refuses that is
	 * `Answers`: a name the portal does not read cannot be in the answer at all, whatever
	 * type it carries.
	 */
	@Test
	void nothingAboutTheMembershipFeeLeavesTheServer() throws Exception {
		String rule = db.sql("select pg_get_constraintdef(oid) from pg_constraint"
						+ " where conname = ?").param("competitor_membership_basis_known")
				.query(String.class).single();
		List<String> everyBasis = Pattern.compile("'([a-zA-Z]+)'").matcher(rule).results()
				.map(one -> one.group(1)).toList();
		assertThat(everyBasis).as("the schema named no basis at all, so the loops below assert"
				+ " nothing; the rule it read was: %s", rule).hasSizeGreaterThan(1);

		for (String nobody : NOBODY_WHO_MAY_READ_THE_BASIS) {
			String whole = whole(nobody);

			assertThat(whole).as("the answer to %s carries nothing at all, so it says nothing"
					+ " about what it leaves out", nobody)
					.contains("000007", "000012", "000045");

			for (String basis : everyBasis) {
				assertThat(whole).as("the basis a membership is held on (%s) left the server to"
						+ " %s, who is not the administration; Clan 74 puts everything to do with"
						+ " the fee beside the date of birth, and PDL P8 names the two who may"
						+ " read it", basis, nobody)
						.doesNotContain(basis);
			}
		}
	}

	/**
	 * AND A MEMBER WHOSE FEE HAS LAPSED IS NOT ON THE LIST AT ALL.
	 *
	 * <p>PDL P11: „Status clanarine se ne prikazuje na profilu. Prisustvo clana na sajtu
	 * u tekucoj godini samo po sebi znaci da je clanarina aktivna; ko nije platio, ne vidi
	 * se nigde osim u istorijskim godinama." Asked on 13.09.2026 which of the two shapes
	 * that takes on the server, the owner chose this one over serving the flag: off the
	 * list, rather than on it with the flag withheld.
	 *
	 * <p>His number sorts BETWEEN two of the three who are on it, so letting him through
	 * is wrong in the order as well as in the length, and two cases go red instead of one.
	 * Nothing else about him is unusual: not hidden, in no team, paying like two others.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsNotOnTheList() throws Exception {
		assertThat(db.sql("select count(*) from competitor where not active")
				.query(Integer.class).single())
				.as("the fixture has nobody whose fee has lapsed, so this case asserts nothing")
				.isEqualTo(1);

		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a member whose fee has lapsed came back on the public list of members")
				.doesNotContain("000031");
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/competitors", answer());
	}

	/**
	 * AND NOTHING IN THE ANSWER IS A DATE OF BIRTH, in any spelling.
	 *
	 * <p>This is the case the resource exists for and the reason it was written before
	 * the easier ones. The portal served the year for all thirty two members until
	 * 13.09.2026, when B52 took it out of the file and put the age band there instead,
	 * ahead of the policy taking effect on 15.09.2026. That closed the public file; this
	 * closes the server, and the two are separate doors onto the same fact.
	 *
	 * <p>Asked of the whole answer as TEXT rather than of a field name, because a year
	 * is a year whatever it is called: a field renamed to `born`, or a year folded into
	 * the biography, would walk past a check that only reads names. The three years in
	 * the fixture are far apart and none of them is also a season in it, so finding one
	 * is finding a date of birth and not something else.
	 *
	 * <p><b>The boundary, written here rather than left for somebody to find:</b> this
	 * refuses the four digit year and the whole date. It does NOT refuse the age as a
	 * number, nor a two digit year, both of which name the year of birth to within a
	 * year. The next increment answers with the age CATEGORY, which is a band of fifteen
	 * years and is what Article 74 makes public in the same sentence; the difference
	 * between that band and an age is one character in a query, so whoever writes it
	 * must say which of the two they are writing.
	 */
	@Test
	void noYearOfBirthLeavesTheServer() throws Exception {
		String whole = http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString();

		assertThat(whole)
				.as("the answer carries nothing at all, so it says nothing about what it leaves out")
				.contains("000007", "000012", "000045");

		/* Read out of the database rather than written here, so that a member added to the
		   fixture tomorrow is measured without anybody remembering to add their year. */
		List<String> years = db.sql("select distinct to_char(birth_date, 'YYYY') from competitor")
				.query(String.class).list();
		List<String> days = db.sql("select distinct to_char(birth_date, '-MM-DD') from competitor")
				.query(String.class).list();
		assertThat(years).as("no year was read out of the database, so the loops below assert"
				+ " nothing").hasSize(4);
		assertThat(days).as("no day was read out of the database").hasSize(4);

		for (String year : years) {
			assertThat(whole)
					.as("a year of birth (%s) left the server, which Clan 74 and the privacy policy"
							+ " both forbid in full and in short", year)
					.doesNotContain(year);
		}

		for (String day : days) {
			assertThat(whole).as("a whole date of birth (%s) left the server", day)
					.doesNotContain(day);
		}
	}

	/** In member number order, which is the one order a member is spoken of in. */
	@Test
	void theListComesBackInMemberNumberOrder() throws Exception {
		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("the members came back in some order other than by their number")
				.containsExactly("000007", "000012", "000045");
	}

	/**
	 * A MEMBER WHO HIDES HIS PROFILE IS STILL ON THE LIST, because the list is not the
	 * page.
	 *
	 * <p>PDL P23 hides the profile PAGE from a visitor who is not signed in. The member
	 * number, the name and the standing stay public (Article 73), and the portal needs
	 * the flag in order to know what to draw. Taking him off here would empty a league
	 * table instead of hiding a page.
	 */
	@Test
	void hidingAProfileDoesNotTakeTheMemberOffTheList() throws Exception {
		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("profileHidden").asBoolean())
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("the member who hides his profile fell off the list of members")
				.containsExactly("000007");
	}

	/**
	 * AND THE TEAM COMES OFF THE MEMBERSHIP THAT HAS NOT ENDED.
	 *
	 * <p>A member is in one team at a time (V11) and the season it started in is what
	 * the portal draws beside the club. Both halves are here: the one who is in a team
	 * carries it with the season, and the two who are not carry neither.
	 *
	 * <p><b>A membership that ended is in the fixture on both sides</b>, which is what
	 * makes this measure the condition rather than the join. 000045 left one team and
	 * joined another, so ignoring the condition would give him two rows and the wrong
	 * season; 000007 left a team and joined none, so it would give him a club he is not
	 * in. The list of members in no team is checked as a whole for that second half.
	 */
	@Test
	void theTeamIsTheOneTheMembershipHasNotEnded() throws Exception {
		List<JsonNode> theOneInATeam = StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("memberNumber").asString().equals("000012")).toList();

		assertThat(theOneInATeam)
				.as("the member who left one team and joined another came back more than once")
				.hasSize(1);
		assertThat(theOneInATeam.getFirst().path("teamSince").asInt())
				.as("the answer names a season other than the one the standing membership began in")
				.isEqualTo(2028);
		assertThat(theOneInATeam.getFirst().path("teamId").isNull())
				.as("the member is in a team and the answer says nothing")
				.isFalse();

		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("teamId").isNull())
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a member who is in no team came back in one")
				.containsExactly("000007", "000045");
	}

	@Test
	void nobodyHasToSignInToSeeWhoRuns() throws Exception {
		assertThat(http.perform(get("/api/competitors")).andReturn().getResponse().getStatus())
				.as("/api/competitors asked a visitor to sign in")
				.isEqualTo(200);
	}

	/**
	 * THE VISITOR'S ANSWER HAS NOT MOVED, AND THAT IS THE FIRST THING THIS INCREMENT
	 * WAS MEASURED BY.
	 *
	 * <p>This resource began to answer two fields to whoever is asking on 20.09.2026,
	 * and the whole of what that may cost is here: the answer a visitor gets must be
	 * what it was, to the byte. It is asked in the two ways that fail differently.
	 *
	 * <ul>
	 * <li><b>Neither name is anywhere in the visitor's answer</b>, over EVERY record
	 * and not only the first. A key carrying null would pass a check that reads the
	 * first record and would still have changed every byte after it.</li>
	 * <li><b>And the visitor's answer is the member's answer with exactly those two
	 * keys taken out.</b> That is the half a name cannot measure: it holds the number
	 * of records, their order, and every value in them, so a condition written as a
	 * join - the one shape that can give a member two rows or drop one - fails here
	 * even though every name is still right.</li>
	 * </ul>
	 *
	 * <p><b>Why a golden file was measured and then not committed.</b> The answer was
	 * captured off `origin/main` before this change and again after it, and the two
	 * are the same SHA-256 on all four resources. It is not kept as a file because the
	 * keys in it are `bigserial` and a sequence does not roll back with a test, so the
	 * same fixture answers different numbers depending on what ran before it in the
	 * same container - which is a guard that fails for a reason that has nothing to do
	 * with what it is guarding.
	 *
	 * <p><b>The second half cuts the substring rather than parsing and writing back,
	 * and {@code TeamApiTest} says why it was measured that way.</b> What is cut is
	 * built out of the values the answer itself carries, so nothing in this case is a
	 * number somebody remembered.
	 */
	@Test
	void theVisitorsAnswerHasNotMoved() throws Exception {
		for (JsonNode one : answerFor(null)) {
			assertThat(Answers.fieldsOf(one))
					.as("a visitor was answered something only a signed in member may have,"
							+ " on the record of %s", one.path("memberNumber").asString())
					.doesNotContain(THE_REFERRAL_CODE, THE_COUNT_SHE_BROUGHT_IN);
		}

		JsonNode hers = recordOf(HER_OWN_ACCOUNT, "000012");
		String added = ",\"" + THE_REFERRAL_CODE + "\":\"" + hers.path(THE_REFERRAL_CODE).asString()
				+ "\",\"" + THE_COUNT_SHE_BROUGHT_IN + "\":"
				+ hers.path(THE_COUNT_SHE_BROUGHT_IN).asInt();

		assertThat(whole(HER_OWN_ACCOUNT).replace(added, ""))
				.as("signing in changed something other than the two fields it was allowed to:"
						+ " the visitor's answer is no longer the member's answer with those two"
						+ " taken out")
				.isEqualTo(whole(null));
	}

	/**
	 * AND THE MEMBER'S OWN RECORD CARRIES NOTHING NOBODY NAMED, which is the same
	 * floor the visitor's answer stands on, moved onto the record that differs.
	 *
	 * <p>It is the SAME check and not a second one: {@code Answers} is handed the
	 * caller's own record instead of the first, so what it compares against is the
	 * file the portal serves rather than a list written here. Three of the four
	 * omissions are still omissions for him - the age band because it is owed, the
	 * referrer's code because the count replaces it, the basis because PDL P8 gives it
	 * to the administration alone and the fee flag because he is on the list at all -
	 * and the one that is no longer an omission is the one field this increment hands
	 * back. The count is named as answered on purpose, and {@code Answers} checks that
	 * the portal really does NOT serve that name, so a name listed here after the
	 * portal starts serving it cannot quietly excuse anything.
	 */
	@Test
	void theMembersOwnRecordCarriesNothingNobodyNamed() throws Exception {
		assertThat(Answers.fieldsOf(recordOf(HER_OWN_ACCOUNT, "000012")))
				.as("the caller's own record is no longer the one that differs, so the floor"
						+ " below would be asked of the wrong record")
				.contains(THE_REFERRAL_CODE);

		Answers.everyFieldThePortalReadsIsAnswered("/api/competitors asked by the member himself",
				new ObjectMapper().createArrayNode().add(recordOf(HER_OWN_ACCOUNT, "000012")),
				"competitors.json", java.util.Set.of(THE_COUNT_SHE_BROUGHT_IN),
				THE_AGE_BAND_THIS_RESOURCE_STILL_OWES, WHO_HANDED_OUT_THE_CODE,
				HOW_THE_MEMBERSHIP_IS_HELD, WHETHER_THE_FEE_IS_STANDING);
	}

	/**
	 * A MEMBER IS HANDED HIS OWN REFERRAL LINK AND NOBODY ELSE'S.
	 *
	 * <p>PDL, 06.09.2026: „`referralCode` je clanov sopstveni link". ADL A8 names the
	 * road it may travel: „kod preporuke ... ide iskljucivo kroz endpoint koji trazi
	 * prijavu, i nikad u odgovor koji vidi posetilac."
	 *
	 * <p><b>Three things, and the second is the one a wrong resource passes.</b> The
	 * value on his record is HIS, read out of the database rather than written here.
	 * Every OTHER code in the database is absent from the whole answer as text, which
	 * is the check that refuses a resource answering the list of codes to anybody who
	 * signs in - the exact shape PDL measured as the reason one public file could not
	 * go on serving three audiences. And no other record carries the key at all, so a
	 * code cannot arrive as null beside a name and be filled in by the next change.
	 */
	@Test
	void aMemberIsHandedHisOwnCodeAndNobodyElses() throws Exception {
		String hers = db.sql("select referral_code from competitor where member_number = '000012'")
				.query(String.class).single();

		assertThat(recordOf(HER_OWN_ACCOUNT, "000012").path(THE_REFERRAL_CODE).asString())
				.as("the member was not handed her own referral link by a resource that knows"
						+ " who is asking")
				.isEqualTo(hers);

		List<String> everybodyElses = db.sql("select referral_code from competitor"
				+ " where member_number <> '000012'").query(String.class).list();
		assertThat(everybodyElses).as("no other code was read out of the database, so the loop"
				+ " below asserts nothing").hasSize(3);

		String whole = whole(HER_OWN_ACCOUNT);

		for (String code : everybodyElses) {
			assertThat(whole).as("somebody else's referral code (%s) was handed to a member who"
					+ " merely signed in; Clan 73 does not make it public and signing in is not"
					+ " what makes it his", code).doesNotContain(code);
		}

		assertThat(StreamSupport.stream(answerFor(HER_OWN_ACCOUNT).spliterator(), false)
				.filter(one -> Answers.fieldsOf(one).contains(THE_REFERRAL_CODE))
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a record other than the caller's own carries the referral code key, whatever"
						+ " value it holds")
				.containsExactly("000012");
	}

	/**
	 * AND HE IS TOLD HOW MANY HE BROUGHT IN, WHICH IS A COUNT AND NEVER THE COLUMN.
	 *
	 * <p>PDL, 06.09.2026, measured why this field could not stay in the public file:
	 * „`referredBy` cita ekran Clanarine da prebroji koga je clan doveo, a to je upit
	 * nad SVIMA, ne nad sobom." Answered as a count by a resource that knows who is
	 * asking, the query over everybody happens where the data is and nothing about
	 * anybody else leaves.
	 *
	 * <p><b>The number is one and every wrong way of getting it is a different
	 * number</b>, which is what the fixture is arranged for: she brought in two
	 * people and one of them has let his fee lapse, so the answer is ONE while four
	 * members exist, three are on the list and two have a referrer. And the same
	 * field asked of a member who brought in nobody is nought, so nothing constant
	 * answers both.
	 */
	@Test
	void aMemberIsToldHowManyHeBroughtInAndOnlyThoseWhoseFeeStands() throws Exception {
		assertThat(db.sql("select count(*) from competitor where referred_by ="
						+ " (select id from competitor where member_number = '000012')")
				.query(Integer.class).single())
				.as("nobody in the fixture was brought in by her, so this case asserts nothing")
				.isEqualTo(2);

		assertThat(recordOf(HER_OWN_ACCOUNT, "000012").path(THE_COUNT_SHE_BROUGHT_IN).asInt())
				.as("the count is not the members she brought in whose fee is standing; counting"
						+ " everybody she brought gives two and the list itself gives three")
				.isEqualTo(1);

		assertThat(recordOf(THE_OTHER_MEMBER, "000045").path(THE_COUNT_SHE_BROUGHT_IN).asInt())
				.as("a member who brought in nobody was told he brought in somebody, so the field"
						+ " is not his own")
				.isZero();

		assertThat(StreamSupport.stream(answerFor(HER_OWN_ACCOUNT).spliterator(), false)
				.filter(one -> Answers.fieldsOf(one).contains(THE_COUNT_SHE_BROUGHT_IN))
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a record other than the caller's own carries the count key")
				.containsExactly("000012");
	}

	/**
	 * AND AN ACCOUNT THAT RACES FOR NOBODY IS ANSWERED WHAT A VISITOR IS, TO THE BYTE.
	 *
	 * <p>V23 leaves {@code account.competitor_id} empty for an account that does not
	 * race, „Empty for a moderator who does not race, which is the ordinary case and
	 * not a fault" (owner, 14.09.2026). Being signed in is therefore not the same
	 * question as being a member, and this is the case that keeps the two apart: a
	 * resource that read the ACCOUNT where it means the MEMBER would answer this
	 * caller somebody's fields, and the somebody would be whoever holds that key.
	 */
	@Test
	void anAccountThatRacesForNobodyIsAnsweredWhatAVisitorIs() throws Exception {
		assertThat(db.sql("select competitor_id from account where email = ?")
				.param(RACES_FOR_NOBODY).query(Long.class).list().get(0))
				.as("the account names a member after all, so this case measures the wrong thing")
				.isNull();

		/* AND HE HOLDS NOTHING OVER THE MEMBERS, which this case has said since the
		   basis started leaving to the administration. Without the line, ticking that
		   box for him tomorrow would turn the sentence above into a different one and
		   nothing would say so. */
		assertThat(db.sql("select count(*) from account_admin_right"
						+ " where account_id = (select id from account where email = ?)"
						+ " and right_code = ?")
				.params(RACES_FOR_NOBODY, CompetitorApi.OVER_THE_MEMBERS)
				.query(Integer.class).single())
				.as("this moderator holds the right over the members after all, so he is no longer"
						+ " answered what a visitor is for a reason that has nothing to do with"
						+ " racing for nobody")
				.isZero();

		assertThat(whole(RACES_FOR_NOBODY))
				.as("an account with no member behind it was answered more than a visitor is")
				.isEqualTo(whole(null));
	}

	/**
	 * THE ADMINISTRATION IS THE ONLY ONE TOLD HOW A MEMBERSHIP IS HELD, AND EVERYBODY
	 * ELSE IS NOT TOLD ON ANY RECORD - THEIR OWN INCLUDED.
	 *
	 * <p>PDL P8, 28.07.2026: „Osnov clanstva se nikad ne prikazuje javno. Ni na
	 * profilu, ni u tabelama, nigde. Vide ga samo Superadmin i moderatori sa pravom nad
	 * clanovima." The owner's reason names the shape: „to je podatak o novcu, a ne o
	 * trcanju, i nikoga se ne tice ko je pocascen."
	 *
	 * <p><b>Five kinds of caller and not two, and the moderator WITHOUT the right is
	 * the one this case exists for.</b> He is signed in, he is a moderator, he holds a
	 * right - and he is on the far side of the line. A resource that asked „is he
	 * staff" instead of „may he" answers him, and nothing about that reads wrong.
	 *
	 * <p><b>Asked over EVERY record and by key rather than by value.</b> A key carrying
	 * null says „he is not exempt" to a screen that draws a tag off it, and it says it
	 * about the whole list rather than about one person; that is the difference between
	 * absent and empty, and it is the same one the referral code is held to above.
	 *
	 * <p><b>The sharpened half of P8 is the member's own record.</b> „Clan vidi SVOJ
	 * osnov clanstva" (20.09.2026) is true and is answered by {@code /api/me}: this
	 * list is the members whose fee is STANDING, so the man the sharpening was written
	 * about - the one who pays nothing - is not on it at all. Answering it here would
	 * reach everybody except him.
	 */
	@Test
	void theAdministrationIsTheOnlyOneToldHowAMembershipIsHeld() throws Exception {
		for (String nobody : NOBODY_WHO_MAY_READ_THE_BASIS) {
			for (JsonNode one : answerFor(nobody)) {
				assertThat(Answers.fieldsOf(one))
						.as("%s was answered how a membership is held, on the record of %s; PDL P8"
								+ " names the superadmin and a moderator with the right over the"
								+ " members, and nobody else", nobody,
								one.path("memberNumber").asString())
						.doesNotContain(HOW_THE_MEMBERSHIP_IS_HELD);
			}
		}

		for (String administration : THE_ADMINISTRATION) {
			JsonNode answer = answerFor(administration);

			assertThat(StreamSupport.stream(answer.spliterator(), false)
					.filter(one -> !Answers.fieldsOf(one).contains(HOW_THE_MEMBERSHIP_IS_HELD))
					.map(one -> one.path("memberNumber").asString()).toList())
					.as("%s is the administration and a record of his answer does not say how that"
							+ " membership is held", administration)
					.isEmpty();

			assertThat(answer).as("%s was answered an empty list, so the check above compared"
					+ " nothing", administration).isNotEmpty();
		}
	}

	/**
	 * AND THE WORD HE IS TOLD IS THE ONE ON THAT MEMBER'S ROW, NOT THE ONE ON HIS OWN.
	 *
	 * <p><b>This is the substitution the referral code's own shape invites.</b> The two
	 * fields above are answered {@code case when c.id = :me}, and the same line copied
	 * onto this field would hand a moderator his own basis and nothing else - or, worse,
	 * his own basis written across every record. Both are refused here, and the fixture
	 * is arranged so that they are refused by a value and not by a length: the moderator
	 * who holds the right is 000031, whose fee has lapsed, so he is not on the list at
	 * all; his basis is {@code payment} and 000012's is {@code feeExempt}.
	 *
	 * <p><b>What is compared is read out of the database</b>, so a fixture changed
	 * tomorrow is measured without anybody remembering this case - and the map is
	 * compared whole, which holds the pairing as well as the words. A resource
	 * answering the right words against the wrong members passes a check on the set and
	 * fails this one.
	 */
	@Test
	void aModeratorOverTheMembersIsToldHowEveryMembershipIsHeld() throws Exception {
		Map<String, String> onTheRows = new HashMap<>();

		for (Map.Entry<String, String> row : db.sql("select member_number, membership_basis"
						+ " from competitor where active")
				.query((one, number) -> Map.entry(one.getString(1), one.getString(2))).list()) {
			onTheRows.put(row.getKey(), row.getValue());
		}

		assertThat(onTheRows.values().stream().distinct().toList())
				.as("every member on the list is held on the same basis, so answering with a"
						+ " constant would satisfy this case")
				.hasSizeGreaterThan(1);

		String his = db.sql("select membership_basis from competitor where id ="
						+ " (select competitor_id from account where email = ?)")
				.param(THE_MODERATOR_OVER_THE_MEMBERS).query(String.class).single();

		assertThat(onTheRows.values().stream().filter(one -> !one.equals(his)).toList())
				.as("no row the moderator looks at is held on a basis other than his own (%s), so"
						+ " serving him his own across the whole answer would pass", his)
				.isNotEmpty();

		assertThat(onTheRows).as("the moderator's own basis stands on no row he looks at, so this"
						+ " case cannot tell his own from the row's").containsValue(his);

		for (String administration : THE_ADMINISTRATION) {
			Map<String, String> answered = new HashMap<>();

			for (JsonNode one : answerFor(administration)) {
				answered.put(one.path("memberNumber").asString(),
						one.path(HOW_THE_MEMBERSHIP_IS_HELD).asString());
			}

			assertThat(answered)
					.as("%s was told a basis that is not the one standing on that member's row;"
							+ " his own is %s", administration, his)
					.isEqualTo(onTheRows);
		}
	}

	/**
	 * AND THE ADMINISTRATION'S ANSWER IS THE VISITOR'S WITH ONE KEY ADDED PER RECORD,
	 * which is the half no check on a name can measure.
	 *
	 * <p>The same sentence {@code theVisitorsAnswerHasNotMoved} holds from the other
	 * end: it keeps the number of records, their order and every other value in them,
	 * so a condition written as a join - the one shape that can give a member two rows
	 * or drop one - fails here although every name is still right. It also refuses the
	 * key arriving empty rather than absent for everybody else, because what is cut out
	 * is built from the values the answer itself carries.
	 *
	 * <p>Both of the administration are asked, and neither of them races for anybody on
	 * the list, so neither carries the two fields a member is answered about himself.
	 */
	@Test
	void theAdministrationsAnswerIsTheVisitorsWithTheBasisAdded() throws Exception {
		for (String administration : THE_ADMINISTRATION) {
			String whole = whole(administration);

			for (JsonNode one : answerFor(administration)) {
				whole = whole.replace(",\"" + HOW_THE_MEMBERSHIP_IS_HELD + "\":\""
						+ one.path(HOW_THE_MEMBERSHIP_IS_HELD).asString() + "\"", "");
			}

			assertThat(whole)
					.as("%s was answered something other than the visitor's answer with the basis"
							+ " added: the list itself moved, or a key nobody named arrived with"
							+ " it", administration)
					.isEqualTo(whole(null));
		}
	}

	/**
	 * AND THE ADMINISTRATION'S RECORD CARRIES NOTHING NOBODY NAMED EITHER.
	 *
	 * <p>The same floor the visitor's answer and the member's own record stand on,
	 * moved onto the third audience. Three of the five names are still omissions for
	 * him - the age band because it is owed, the referrer's code because the count
	 * replaces it, the fee flag because he is on the list at all - and the referral
	 * code is one too, because this caller is not the member whose row it is.
	 */
	@Test
	void theAdministrationsRecordCarriesNothingNobodyNamed() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered(
				"/api/competitors asked by a moderator over the members",
				answerFor(THE_MODERATOR_OVER_THE_MEMBERS), "competitors.json",
				THE_AGE_BAND_THIS_RESOURCE_STILL_OWES, THE_REFERRAL_CODE,
				WHO_HANDED_OUT_THE_CODE, WHETHER_THE_FEE_IS_STANDING);
	}

	/**
	 * THE RIGHT THIS RESOURCE ASKS FOR IS ONE THE MATRIX REALLY HOLDS.
	 *
	 * <p><b>A floor and not a spelling check.</b> {@code RightIsNeeded} writes out what
	 * a misspelt right costs: every moderator is refused it and the SUPERADMIN is let
	 * through, because his mode answers yes to any string there is. So a typo here is a
	 * door that reads shut in every case written with a moderator and stands open for
	 * the one account that can do the most damage.
	 *
	 * <p><b>It is asked of {@code admin_right} because the annotations' own floor
	 * cannot see this one.</b> {@code everyRightARouteAsksForIsOneTheMatrixHolds} reads
	 * what the dispatcher declares; this route declares nothing, because it is open to
	 * everybody and only one field of its answer is guarded.
	 */
	@Test
	void theRightThisResourceAsksForIsOneTheMatrixHolds() {
		List<String> held = db.sql("select code from admin_right").query(String.class).list();

		assertThat(held).as("the matrix holds no rights at all, so anything would be in it")
				.isNotEmpty();

		assertThat(held)
				.as("this resource guards its field with a right the matrix does not hold; every"
						+ " moderator is refused it and the superadmin is let through, because his"
						+ " mode answers yes to any string there is")
				.contains(CompetitorApi.OVER_THE_MEMBERS);
	}

	/**
	 * AND EVERY ACCOUNT IN THE FIXTURE IS ON ONE SIDE OF THAT LINE OR THE OTHER.
	 *
	 * <p><b>The floor under the two lists at the head of this class</b>, and the reason
	 * they may be written by hand at all: what an account IS cannot be read back, but
	 * WHICH accounts exist can. A sixth added tomorrow has to be put on a side, and
	 * until it is, this case says so instead of the two lists quietly measuring four
	 * callers out of five.
	 */
	@Test
	void everyAccountInTheFixtureIsOnOneSideOfTheLineOrTheOther() {
		List<String> split = new java.util.ArrayList<>(THE_ADMINISTRATION);
		NOBODY_WHO_MAY_READ_THE_BASIS.stream().filter(one -> one != null).forEach(split::add);

		assertThat(db.sql("select email from account").query(String.class).list())
				.as("an account in the fixture is on neither side of the line PDL P8 draws, so"
						+ " nothing measures what this resource answers it")
				.containsExactlyInAnyOrderElementsOf(split);
	}

}
