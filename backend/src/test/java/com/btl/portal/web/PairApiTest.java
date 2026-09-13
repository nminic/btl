package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** The racing pairs, and the day of forming that does not leave with them. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PairApiTest {

	/** Named here with the reason, because a lost field and a withheld one look alike. */
	private static final String THE_DAY_THE_PAIR_WAS_MADE = "since";

	/**
	 * EVERY RULE THE DATABASE HOLDS OVER A PAIR AND OVER AN INVITATION, each with a
	 * case below that breaks it against a real PostgreSQL.
	 *
	 * <p>They are here because the resource leans on two of them in its own words - the
	 * man's column can only hold a man, and one person holds one pair a season - and a
	 * claim that rests on a rule nobody measures rests on nothing. The list is written
	 * by hand and the floor under it is not: {@code everyRuleTheSchemaHoldsOverAPairIsBrokenHere}
	 * reads the names out of the catalogue, so a rule added to either table tomorrow
	 * either gets a case or turns that one red.
	 *
	 * <p>What the floor deliberately does not cover, and it is a filter rather than an
	 * omission: the two primary keys, which the database fills in itself, and the
	 * not-null markers, which since PostgreSQL 17 also live in this catalogue. A column
	 * that stops being NOT NULL is a migration and a question for whoever writes it.
	 */
	private static final Set<String> BROKEN_BY_A_CASE = Set.of(
			"racing_pair_man_fk", "racing_pair_woman_fk",
			"racing_pair_one_man_a_season", "racing_pair_one_woman_a_season",
			"racing_pair_season_not_before_the_league",
			"pair_invite_from_fk", "pair_invite_to_fk",
			"pair_invite_two_people", "pair_invite_asked_once");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private int issued;

	/**
	 * FIVE PAIRS, WHICH IS MORE THAN THE PORTAL SERVES, and every axis separated on
	 * purpose.
	 *
	 * <p>The file the portal serves today carries two pairs (owner, 07.09.2026: „neka
	 * dva para"), and two records cannot say much: a field that never varies is a field
	 * a constant would answer, and an order that holds for two holds for half the orders
	 * there are. Each list below says which wrong answer it refuses:
	 *
	 * <ul>
	 * <li><b>The order of the list.</b> Written 2028, 2027, 2029, 2027, 2029, so the key
	 * ascending, the key descending, the season alone, the season with the key, the day
	 * they were made, and the woman's number each give a different list, and only one of
	 * them is the answer.</li>
	 * <li><b>The order inside a pair.</b> Two pairs have the man's number BELOW the
	 * woman's and two have it above, so „the man first" and „the lower number first" are
	 * two different lists. With every man below, a resource sorting the two of them by
	 * number would have passed.</li>
	 * <li><b>The season.</b> Four of the five hold for the year after they were made,
	 * which is what the rulebook's 31 December produces. The fifth is an imported pair,
	 * which is what the two on the portal are: made in 2026 and holding for 2029. So the
	 * column and „the year it was made, plus one" are two different numbers, and a
	 * resource reading the day instead of the column fails on exactly the row it would
	 * fail on in the history being imported.</li>
	 * <li><b>Who is in more than one.</b> One man holds a pair in two seasons and one
	 * woman does, so „one pair per person" and „one pair per person PER SEASON" are two
	 * different answers, and the second is the one the schema holds.</li>
	 * <li><b>The unanswered invitations.</b> Two of them, which is not the number of
	 * pairs, so an answer built from the wrong table is the wrong length. One is between
	 * two members who are in no pair at all, so their numbers reaching the answer can
	 * only have come through the invitation.</li>
	 * <li><b>The half without a member number.</b> One woman registered and has no
	 * number yet, which since V16 is a row {@code competitor} really holds.</li>
	 * </ul>
	 */
	@BeforeEach
	void fivePairsAndTwoQuestionsNobodyAnswered() {
		member("'000010'", "Nikola", "Jovic", "M");
		member("'000060'", "Marko", "Simic", "M");
		member("'000075'", "Petar", "Ilic", "M");
		member("'000050'", "Stefan", "Kovac", "M");
		member("'000099'", "Vuk", "Maric", "M");

		member("'000030'", "Ana", "Peric", "F");
		member("'000020'", "Sofija", "Lukic", "F");
		member("'000090'", "Jelena", "Nikolic", "F");
		member("'000003'", "Iva", "Bogdanovic", "F");

		/* AND ONE WHO REGISTERED AND HAS NO MEMBER NUMBER YET. V16 made the number
		   nullable in as many words - „a row in `competitor` is a PERSON WHO REGISTERED.
		   A MEMBER is a row whose `member_number` is there" - so a reader that gathers the
		   two halves of a pair with `List.of` answers an exception instead of a list. */
		member("null", "Teodora", "Vasic", "F");

		pair(2028, "Jovic", "Nikolic", "2027-12-31");
		pair(2027, "Simic", "Lukic", "2026-11-05");
		pair(2029, "Ilic", "Lukic", "2026-10-02");
		pair(2027, "Jovic", "Peric", "2026-12-30");
		pair(2029, "Kovac", "Vasic", "2028-12-02");

		invite("Maric", "Bogdanovic");
		invite("Maric", "Lukic");
	}

	/**
	 * @param number a fragment rather than a parameter, because one of them has none and
	 *               a missing member number is the thing being written
	 */
	private void member(String number, String first, String last, String gender) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (" + number + ", ?, ?, ?, date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(first, last, gender, String.format("%016x", ++issued))
				.update();
	}

	/** By surname and not by member number, because one of the ten has no number. */
	private void pair(int season, String man, String woman, String madeOn) {
		db.sql("insert into racing_pair (season, man_id, woman_id, made_at) values (?,"
						+ " (select id from competitor where last_name = ?),"
						+ " (select id from competitor where last_name = ?),"
						+ " timestamptz '" + madeOn + " 12:00:00+00')")
				.params(season, man, woman).update();
	}

	private void invite(String from, String to) {
		db.sql("insert into pair_invite (from_id, to_id) values ("
						+ " (select id from competitor where last_name = ?),"
						+ " (select id from competitor where last_name = ?))")
				.params(from, to).update();
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(
				http.perform(get("/api/pairs")).andReturn().getResponse().getContentAsString());
	}

	private String whole() throws Exception {
		return http.perform(get("/api/pairs")).andReturn().getResponse().getContentAsString();
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ANSWERED, EXCEPT THE DAY THE PAIR WAS MADE, and
	 * that one is named here with the reason.
	 *
	 * <p>Article 73 lists what is public and names a day exactly once, for a verified
	 * result: „Svi verifikovani rezultati sa duzinom, usponom, spustom, vremenom i
	 * datumom." The day two people became a pair is not on that list. It is also the day
	 * the second of them ANSWERED an invitation ({@code data/types.ts}), and Article 74
	 * puts private messages among the things that are never public. The owner's rule of
	 * 13.09.2026 settles what to do when the two readings might have disagreed: „Kad je
	 * sporno, polje se IZOSTAVLJA, izostavljanje se imenuje sa razlogom."
	 *
	 * <p>`Answers` checks the name against the file the portal serves, so a name left
	 * here after the portal stopped serving it cannot quietly excuse a field that went
	 * missing for another reason, and it checks the answer really does leave it out. It
	 * also refuses a name the answer carries that no screen reads, which is the other
	 * way the same day could leave.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/pairs", answer(), "pairs.json",
				THE_DAY_THE_PAIR_WAS_MADE);
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/pairs", answer());
	}

	/**
	 * AND NO DAY A PAIR WAS MADE LEAVES THE SERVER, in either spelling.
	 *
	 * <p>Asked of the whole answer as TEXT rather than of a field name, for the reason
	 * the competitors' resource asks its own omissions that way: a field renamed to
	 * something no screen reads walks past a check that only reads names. Both spellings
	 * a timestamp arrives in are refused - the day, which is what a configured Jackson
	 * writes, and the seconds since the epoch, which is what an unconfigured one writes -
	 * and both are read out of the database rather than written here.
	 *
	 * <p><b>The boundary, written here rather than left for somebody to find:</b> this
	 * refuses the whole day and the instant. It does not refuse the YEAR on its own,
	 * because a season is a year and three of them are in the answer by right. What
	 * refuses a year arriving as a field is `Answers`: a name no screen reads cannot be
	 * in the answer at all, whatever it carries.
	 */
	@Test
	void noDayAPairWasMadeLeavesTheServer() throws Exception {
		String whole = whole();

		assertThat(whole).as("the answer carries nothing at all, so it says nothing about what it"
				+ " leaves out").contains("000010", "000060", "000075");

		List<String> days = db.sql("select distinct to_char(made_at at time zone 'UTC',"
				+ " 'YYYY-MM-DD') from racing_pair").query(String.class).list();
		List<String> instants = db.sql("select distinct extract(epoch from made_at)::bigint::text"
				+ " from racing_pair").query(String.class).list();

		assertThat(days).as("no day was read out of the database, so the loops below assert nothing")
				.hasSize(5);
		assertThat(instants).as("no instant was read out of the database").hasSize(5);

		for (String day : days) {
			assertThat(whole).as("the day a pair was made (%s) left the server, and Clan 73 names a"
					+ " day only for a verified result", day).doesNotContain(day);
		}

		for (String instant : instants) {
			assertThat(whole).as("the day a pair was made left the server as an instant (%s), which"
					+ " is what a timestamp answers with when nobody asks it for a shape", instant)
					.doesNotContain(instant);
		}
	}

	/**
	 * THE MAN COMES FIRST IN EVERY PAIR, and the genders are read off the database.
	 *
	 * <p>V12 stores the two of them in two named columns with a constant gender generated
	 * beside each, so „the man first" is an order the schema can vouch for and „whatever
	 * came back" is not. The board of best pairs breaks its last tie on the first of the
	 * two and keeps the written order when the halves scored level
	 * ({@code data/derive.ts}), so an unsettled order reshuffles a board nobody touched.
	 *
	 * <p><b>Two floors, and they point in opposite directions.</b> With every man's number
	 * below his partner's, „the man first" and „the lower number first" are the same list
	 * and a resource sorting the two by number passes; with every man's above, the higher
	 * number first passes. The fixture has both, so neither reading survives.
	 */
	@Test
	void theManComesFirstInEveryPair() throws Exception {
		Map<String, String> gender = db.sql("select member_number, gender from competitor"
						+ " where member_number is not null")
				.query((row, one) -> Map.entry(row.getString(1), row.getString(2)))
				.list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

		assertThat(gender).as("no gender was read out of the database, so the loop below asserts"
				+ " nothing").isNotEmpty();
		assertThat(manAgainstWoman(">")).as("no pair has the man's number above the woman's, so"
				+ " 'the man first' and 'the lower number first' are one list here").isEqualTo(2);
		assertThat(manAgainstWoman("<")).as("no pair has the man's number below the woman's, so"
				+ " 'the man first' and 'the higher number first' are one list here").isEqualTo(2);

		for (JsonNode one : answer()) {
			JsonNode both = one.path("memberNumbers");

			assertThat(both.size()).as("a racing pair came back as something other than two people")
					.isEqualTo(2);
			assertThat(gender.get(both.get(0).asString()))
					.as("the first of the two is not the man, and the man is the half the schema"
							+ " can vouch for")
					.isEqualTo("M");

			if (!both.get(1).isNull()) {
				assertThat(gender.get(both.get(1).asString()))
						.as("the second of the two is not the woman").isEqualTo("F");
			}
		}
	}

	private int manAgainstWoman(String how) {
		return db.sql("select count(*) from racing_pair p"
						+ " join competitor m on m.id = p.man_id"
						+ " join competitor w on w.id = p.woman_id"
						+ " where m.member_number " + how + " w.member_number")
				.query(Integer.class).single();
	}

	/**
	 * IN SEASON ORDER, AND WITHIN A SEASON BY THE MAN'S NUMBER, which is the number
	 * printed on a card and the one thing about him that never changes.
	 *
	 * <p>Sorted by the key the list comes back in whatever order the rows were written,
	 * which for an imported history is no order at all.
	 */
	@Test
	void theListComesBackBySeasonAndThenByTheMansNumber() throws Exception {
		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("season").asString() + " "
						+ one.path("memberNumbers").get(0).asString()).toList())
				.as("the pairs came back in some order other than by season and then by the man's"
						+ " number")
				.containsExactly("2027 000010", "2027 000060", "2028 000010", "2029 000050",
						"2029 000075");
	}

	/**
	 * AND THE SEASON IS THE PAIR'S OWN COLUMN, not the year it was made plus one.
	 *
	 * <p>The two are the same number for every pair the portal itself forms, because
	 * forming has to be finished by 31 December to count for the season that follows. So
	 * a fixture of pairs made through the portal cannot tell the two apart at all, and a
	 * resource reading the day would pass it. What tells them apart is an IMPORTED pair,
	 * which is what both of the ones on the portal are: a row whose {@code made_at} is
	 * whatever the old system recorded, tied to the season by nothing in the schema.
	 *
	 * <p>Why it matters that the column wins: read off the day of the question rather
	 * than the day of the answer, the portal made a pair for a season already being run,
	 * with a green gate (PDL, 07.09.2026). That is the whole reason {@code pair_invite}
	 * carries no season and {@code racing_pair} does.
	 */
	@Test
	void theSeasonIsThePairsOwnColumnAndNotTheYearItWasMade() throws Exception {
		assertThat(db.sql("select count(*) from racing_pair"
						+ " where season <> extract(year from made_at)::int + 1")
				.query(Integer.class).single())
				.as("every pair in the fixture holds for the year after it was made, so the column"
						+ " and the day are two names for one number and this case measures neither")
				.isEqualTo(1);

		assertThat(recordOf("000075").path("season").asInt())
				.as("the season came off the day the pair was made rather than off the pair")
				.isEqualTo(2029);
	}

	/**
	 * AN INVITATION NOBODY ANSWERED IS NOT A PUBLIC PAIR.
	 *
	 * <p>A pair is formed by both sides confirming (PDL); until the second one answers
	 * there is a question and no pair. An invitation carries no season either (V12), so
	 * one answered here would be a pair with an invented season, public before anybody
	 * agreed to it. Who asked whom is their own business besides: the portal does not
	 * draw an invitation on anybody else's profile (PDL, 07.09.2026).
	 *
	 * <p><b>Both halves, because each catches the opposite failure.</b> The length says
	 * an invitation did not become a record; the two names say the record, if one came,
	 * is not somebody else's. The pair of members in the first invitation is in NO pair
	 * anywhere, so their numbers can only reach the answer through the question they
	 * asked - and the two counts are deliberately different, so an answer built entirely
	 * from the wrong table is the wrong length rather than the right one.
	 */
	@Test
	void anInvitationNobodyAnsweredIsNotAPair() throws Exception {
		int invitations = db.sql("select count(*) from pair_invite").query(Integer.class).single();
		int pairs = db.sql("select count(*) from racing_pair").query(Integer.class).single();

		assertThat(invitations).as("no unanswered invitation in the fixture, so this case has"
				+ " nothing to keep out").isGreaterThan(0);
		assertThat(invitations).as("as many invitations as pairs, so an answer built from the wrong"
				+ " table would be the right length and the count below would say nothing")
				.isNotEqualTo(pairs);

		assertThat(answer().size()).as("the answer is not as long as the pairs the database holds,"
				+ " which is what an invitation coming through looks like").isEqualTo(pairs);

		List<String> onlyAsking = db.sql("select c.member_number from competitor c"
						+ " where exists (select 1 from pair_invite i"
						+ "   where i.from_id = c.id or i.to_id = c.id)"
						+ " and not exists (select 1 from racing_pair p"
						+ "   where p.man_id = c.id or p.woman_id = c.id)"
						+ " order by c.member_number")
				.query(String.class).list();

		assertThat(onlyAsking).as("nobody in the fixture asked without being in a pair already, so"
				+ " the loop below asserts nothing").hasSize(2);

		String whole = whole();

		for (String who : onlyAsking) {
			assertThat(whole).as("%s asked somebody and was never answered, and came back as half"
					+ " of a public pair", who).doesNotContain(who);
		}
	}

	/**
	 * AND A PAIR WHOSE HALF HAS NO MEMBER NUMBER YET STILL COMES BACK, with a missing
	 * number where the number would be.
	 *
	 * <p>Since V16 a row in {@code competitor} is a person who REGISTERED and a member is
	 * a row whose number is there, so the number is nullable and a pair may hold such a
	 * row. Whether it SHOULD is a question for the increment that makes pairs; what a
	 * reader must not do is answer with an exception, which is what gathering the two of
	 * them with {@code List.of} does.
	 */
	@Test
	void aPairWithSomebodyWhoHasNoMemberNumberYetStillComesBack() throws Exception {
		assertThat(db.sql("select count(*) from racing_pair p"
						+ " join competitor w on w.id = p.woman_id"
						+ " where w.member_number is null").query(Integer.class).single())
				.as("nobody in a pair in the fixture is still without a member number, so this case"
						+ " measures nothing at all").isEqualTo(1);

		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("memberNumbers"))
				.filter(both -> both.get(1).isNull())
				.map(both -> both.get(0).asString()).toList())
				.as("the pair whose second half has no member number yet did not come back, or came"
						+ " back as something other than a missing number")
				.containsExactly("000050");
	}

	/**
	 * EVERY RULE THE SCHEMA HOLDS OVER A PAIR IS BROKEN BY A CASE HERE, and the list of
	 * them is not written from memory.
	 *
	 * <p>The floor under {@code BROKEN_BY_A_CASE}: the names are read out of the
	 * catalogue of the two tables, so a rule added to either of them either arrives with
	 * a case that breaks it or turns this red. A list of rules cannot be finished by
	 * thinking about the list.
	 */
	@Test
	void everyRuleTheSchemaHoldsOverAPairIsBrokenHere() {
		List<String> inTheSchema = db.sql("select conname from pg_constraint"
						+ " where conrelid in ('racing_pair'::regclass, 'pair_invite'::regclass)"
						+ " and contype in ('c', 'u', 'f')")
				.query(String.class).list();

		assertThat(inTheSchema).as("the catalogue named no rule over the two tables at all, so the"
				+ " comparison below compares nothing").hasSizeGreaterThan(1);
		assertThat(BROKEN_BY_A_CASE)
				.as("a rule the database holds over a pair or over an invitation has no case that"
						+ " breaks it, or a case names a rule that is no longer there")
				.containsExactlyInAnyOrderElementsOf(inTheSchema);
	}

	/**
	 * A PAIR IS MIXED, AND THE DATABASE IS WHAT REFUSES THE REST.
	 *
	 * <p>This is the rule the resource leans on when it answers with the man first. A
	 * CHECK cannot read another table, so V12 holds it with a constant gender generated
	 * beside each column and a foreign key into {@code competitor (id, gender)}: there is
	 * no row in {@code competitor} with this id and that gender, so the key refuses.
	 */
	@Test
	void theDatabaseRefusesAWomanInTheMansColumn() {
		pairIsRefused(2030, "Lukic", "Peric", "racing_pair_man_fk",
				"a pair whose man is a woman was stored, and the answer orders the two of them by"
						+ " a column that no longer means what it is called");
	}

	@Test
	void theDatabaseRefusesAManInTheWomansColumn() {
		pairIsRefused(2030, "Jovic", "Simic", "racing_pair_woman_fk",
				"a pair whose woman is a man was stored, so a pair need not be mixed after all");
	}

	/**
	 * ONE PAIR PER PERSON PER SEASON, which is the other half of „a pair belongs to one
	 * season" and is structural rather than a check on a form (PDL, 07.09.2026).
	 */
	@Test
	void theDatabaseRefusesASecondPairForTheSameManInOneSeason() {
		pairIsRefused(2027, "Jovic", "Nikolic", "racing_pair_one_man_a_season",
				"one man held two pairs in one season, so 'the pair of a member in a season' is not"
						+ " a question with one answer");
	}

	@Test
	void theDatabaseRefusesASecondPairForTheSameWomanInOneSeason() {
		pairIsRefused(2027, "Ilic", "Peric", "racing_pair_one_woman_a_season",
				"one woman held two pairs in one season, and the rule is per person from either"
						+ " side");
	}

	/** And no pair holds for a season the league never ran. */
	@Test
	void theDatabaseRefusesASeasonBeforeTheLeague() {
		pairIsRefused(2026, "Maric", "Bogdanovic", "racing_pair_season_not_before_the_league",
				"a pair was stored for a season before the league existed");
	}

	/** Nobody invites himself, which is the one shape an invitation cannot take. */
	@Test
	void theDatabaseRefusesAnInvitationToOneself() {
		inviteIsRefused("Maric", "Maric", "pair_invite_two_people",
				"somebody invited himself into a racing pair");
	}

	/**
	 * And one open question between two people in one direction: asking twice is the same
	 * question. The other direction is a row of its own on purpose (V12).
	 */
	@Test
	void theDatabaseRefusesTheSameInvitationTwice() {
		inviteIsRefused("Maric", "Bogdanovic", "pair_invite_asked_once",
				"the same question was asked twice and stored as two");
	}

	@Test
	void theDatabaseRefusesAnInvitationFromSomebodyItDoesNotHave() {
		assertThatThrownBy(() -> db.sql("insert into pair_invite (from_id, to_id) values ("
						+ " (select max(id) + 1 from competitor),"
						+ " (select id from competitor where last_name = ?))")
				.params("Bogdanovic").update())
				.as("an invitation came from somebody the portal does not have")
				.hasMessageContaining("pair_invite_from_fk");
	}

	@Test
	void theDatabaseRefusesAnInvitationToSomebodyItDoesNotHave() {
		assertThatThrownBy(() -> db.sql("insert into pair_invite (from_id, to_id) values ("
						+ " (select id from competitor where last_name = ?),"
						+ " (select max(id) + 1 from competitor))")
				.params("Bogdanovic").update())
				.as("an invitation went to somebody the portal does not have")
				.hasMessageContaining("pair_invite_to_fk");
	}

	@Test
	void nobodyHasToSignInToSeeTheRacingPairs() throws Exception {
		assertThat(http.perform(get("/api/pairs")).andReturn().getResponse().getStatus())
				.as("/api/pairs asked a visitor to sign in")
				.isEqualTo(200);
	}

	/** The one record the given member is in, which is one because the fixture says so. */
	private JsonNode recordOf(String memberNumber) throws Exception {
		List<JsonNode> found = StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> StreamSupport.stream(one.path("memberNumbers").spliterator(), false)
						.anyMatch(who -> !who.isNull() && who.asString().equals(memberNumber)))
				.toList();

		assertThat(found).as("%s is in some number of pairs other than one, so nothing below is"
				+ " about the record it says it is about", memberNumber).hasSize(1);
		return found.getFirst();
	}

	private void pairIsRefused(int season, String man, String woman, String rule, String because) {
		assertThatThrownBy(() -> pair(season, man, woman, "2026-06-01")).as(because)
				.hasMessageContaining(rule);
	}

	private void inviteIsRefused(String from, String to, String rule, String because) {
		assertThatThrownBy(() -> invite(from, to)).as(because).hasMessageContaining(rule);
	}
}
