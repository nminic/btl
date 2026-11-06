package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.team.Membership;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A SEASON BEGINS: WHO DID NOT RENEW BY 16:00 ON 1 JANUARY 2028 IS OUT OF HIS TEAM AND HIS PAIR.
 *
 * <p>PDL „Članovi koji ne produže članarinu", the owner's decisions of 19.09.2026 and 05.11.2026, which
 * {@link ASeasonBegins} quotes. One league is built in which every axis the plan of 05.11.2026 named has both
 * of its states side by side, so no case passes because nothing moved:
 * <ul>
 * <li><b>Prvi tim</b>: the founder and administrator Aca did not renew; Eva, the longest after him, did not
 * either; Ceca and Boban joined in the same season and both renewed, Ceca with the smaller number; Dule has
 * the smallest number of all and joined a season later. So the seat goes to Ceca, and neither „the smallest
 * number" nor „the longest, dropped ones included" names her. The three who stay hold three bases.</li>
 * <li><b>Drugi tim</b>: everybody in it dropped, so it goes and nobody is told anything.</li>
 * <li><b>Treci tim</b>: the administrator renewed, so the seat does not move and nobody is told; Kuma was
 * booked at 15:30 and stays, Raka at 16:30 and drops; Sava's row carries a first day with no moment, which
 * is in time.</li>
 * <li><b>Cetvrti tim</b>: one member is left and becomes its administrator; Mira joined it from Treci tim in
 * the window and renewed, so she moves.</li>
 * <li><b>Peti tim</b>: its only member walked out in the window, and it goes at the turn.</li>
 * <li><b>Sedmi tim</b>: Mile walked out of Treci tim in the window into it and did not renew, so his row in
 * it had not begun, it is deleted, and the team goes.</li>
 * <li>Pairs of 2028 in all three states (one renewed, both renewed, neither), a lapsed man and a lapsed
 * woman, a lapsed member who is in no team at all, and a pair of 2027, which froze and stays.</li>
 * <li><b>Deveti tim</b>: its seat names Tara, whose flag went off before the turn, so the seat is Uros's
 * already; it does not move and nobody is told, and the column stops naming her.</li>
 * <li>Zora, who has nothing to do with any of it and must hear nothing.</li>
 * </ul>
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class ASeasonBeginsTest {

	private static final int SEASON = 2028;

	/** 15:30 and 16:30 of 1 January 2028 in Belgrade. */
	private static final Instant HALF_AN_HOUR_BEFORE = Instant.parse("2028-01-01T14:30:00Z");

	private static final Instant HALF_AN_HOUR_AFTER = Instant.parse("2028-01-01T15:30:00Z");

	@Autowired
	private JdbcClient db;

	@Autowired
	private ASeasonBegins begins;

	private long aca;

	private long eva;

	private long ceca;

	private long boban;

	private long dule;

	private long fica;

	private long gaga;

	private long hana;

	private long ivan;

	private long jova;

	private long kosta;

	private long lela;

	private long mile;

	private long mira;

	private long kuma;

	private long raka;

	private long sava;

	private long vesna;

	private long vlada;

	private long yoca;

	private long wanda;

	private long zora;

	private long tara;

	private long uros;

	private long pera;

	private long nena;

	@BeforeEach
	void aLeagueOnTheLastDayOf2027() {
		dule = member("000300", "Dule", "Duletic", "M");
		aca = member("000301", "Aca", "Acic", "M");
		eva = member("000302", "Eva", "Evic", "F");
		ceca = member("000303", "Ceca", "Cecic", "F");
		boban = member("000304", "Boban", "Bobic", "M");
		fica = member("000310", "Fica", "Ficic", "M");
		gaga = member("000311", "Gaga", "Gagic", "F");
		hana = member("000320", "Hana", "Hanic", "F");
		ivan = member("000321", "Ivan", "Ivic", "M");
		kuma = member("000322", "Kuma", "Kumic", "F");
		raka = member("000323", "Raka", "Rakic", "M");
		sava = member("000324", "Sava", "Savic", "M");
		jova = member("000330", "Jova", "Jovic", "M");
		kosta = member("000331", "Kosta", "Kostic", "M");
		lela = member("000340", "Lela", "Lelic", "F");
		mile = member("000350", "Mile", "Milic", "M");
		mira = member("000352", "Mira", "Miric", "F");
		vesna = member("000370", "Vesna", "Vesnic", "F");
		vlada = member("000371", "Vlada", "Vladic", "M");
		yoca = member("000373", "Joca", "Jocic", "M");
		wanda = member("000374", "Vanda", "Vandic", "F");
		zora = member("000390", "Zora", "Zoric", "F");
		tara = member("000380", "Tara", "Taric", "F");
		uros = member("000381", "Uros", "Urosic", "M");
		pera = member("000391", "Pera", "Peric", "M");
		nena = member("000392", "Nena", "Nenic", "F");

		for (long each : List.of(dule, aca, eva, ceca, boban, fica, gaga, hana, ivan, kuma, raka, sava, jova,
				kosta, lela, mile, mira, vesna, vlada, yoca, wanda, zora, tara, uros, pera, nena)) {
			HeldOn.season(db, each, 2027, "feeExempt");
		}

		/* WHO RENEWED, on all three bases, and the two moments either side of 16:00. */
		HeldOn.season(db, ceca, SEASON, "payment");
		HeldOn.season(db, boban, SEASON, "feeExempt");
		HeldOn.season(db, dule, SEASON, "balance");
		HeldOn.season(db, hana, SEASON, "payment");
		HeldOn.season(db, ivan, SEASON, "payment");
		HeldOn.season(db, kosta, SEASON, "payment");
		HeldOn.season(db, lela, SEASON, "payment");
		HeldOn.season(db, mira, SEASON, "payment");
		HeldOn.season(db, vesna, SEASON, "payment");
		HeldOn.season(db, vlada, SEASON, "payment");
		HeldOn.season(db, wanda, SEASON, "payment");
		HeldOn.season(db, zora, SEASON, "payment");
		HeldOn.season(db, uros, SEASON, "payment");
		HeldOn.season(db, pera, SEASON, "payment");
		HeldOn.season(db, kuma, SEASON, "payment", HALF_AN_HOUR_BEFORE);
		HeldOn.season(db, raka, SEASON, "payment", HALF_AN_HOUR_AFTER);
		HeldOn.season(db, sava, SEASON, "payment", HALF_AN_HOUR_AFTER);
		db.sql("update membership set first_activation_carried = true, first_activated_at = null"
						+ " where competitor_id = ? and season = ?")
				.params(sava, SEASON).update();

		long prvi = team("prvi-tim", "Prvi tim", aca);
		in(aca, prvi, 2027, null);
		in(eva, prvi, 2027, null);
		in(ceca, prvi, 2027, null);
		in(boban, prvi, 2027, null);
		in(dule, prvi, 2028, null);

		long drugi = team("drugi-tim", "Drugi tim", fica);
		in(fica, drugi, 2027, null);
		in(gaga, drugi, 2027, null);

		long treci = team("treci-tim", "Treci tim", hana);
		in(hana, treci, 2027, null);
		in(ivan, treci, 2027, null);
		in(kuma, treci, 2027, null);
		in(raka, treci, 2027, null);
		in(sava, treci, 2027, null);
		in(mile, treci, 2027, 2027);
		in(mira, treci, 2027, 2027);

		long cetvrti = team("cetvrti-tim", "Cetvrti tim", jova);
		in(jova, cetvrti, 2027, null);
		in(kosta, cetvrti, 2027, null);
		in(mira, cetvrti, 2028, null);

		long peti = team("peti-tim", "Peti tim", lela);
		in(lela, peti, 2027, 2027);

		long sedmi = team("sedmi-tim", "Sedmi tim", mile);
		in(mile, sedmi, 2028, null);

		/* A SEAT NAMING A MEMBER WHO NO LONGER STANDS IN IT: Tara's flag went off before the turn, so the
		   seat is Uros's already and does not move, and the column must stop naming her all the same. */
		long deveti = team("deveti-tim", "Deveti tim", tara);
		in(tara, deveti, 2027, null);
		in(uros, deveti, 2027, null);
		db.sql("update competitor set active = false where id = ?").param(tara).update();

		pair(SEASON, aca, vesna);
		pair(SEASON, vlada, eva);
		pair(SEASON, fica, gaga);
		pair(SEASON, boban, ceca);
		pair(SEASON, yoca, wanda);
		pair(2027, aca, hana);

		/* A LAPSED WOMAN WHO IS IN NO TEAM AT ALL, in a pair with a man who renewed: only the pair can name
		   her, so a lapsed-member query that looks at the man's side of a pair alone does not find her. */
		pair(SEASON, pera, nena);
	}

	/**
	 * EVERY AXIS AT ONCE, read off the whole of the three tables the turn writes and the inbox, so a row
	 * that moved where it should not have is as visible as one that did not move.
	 */
	@Test
	void whoDidNotRenewIsOutOfHisTeamAndHisPairAndTheRestStands() {
		begins.begin(SEASON);

		String lapsed = " 2027 2027 " + Membership.THE_FEE_LAPSED;

		assertThat(memberships()).containsExactlyInAnyOrder(
				"Aca Prvi tim" + lapsed,
				"Eva Prvi tim" + lapsed,
				"Ceca Prvi tim 2027 -",
				"Boban Prvi tim 2027 -",
				"Dule Prvi tim 2028 -",
				"Hana Treci tim 2027 -",
				"Ivan Treci tim 2027 -",
				"Kuma Treci tim 2027 -",
				"Raka Treci tim" + lapsed,
				"Sava Treci tim 2027 -",
				"Mile Treci tim 2027 2027 " + Membership.LEFT_ON_HIS_OWN,
				"Mira Treci tim 2027 2027 " + Membership.LEFT_ON_HIS_OWN,
				"Jova Cetvrti tim" + lapsed,
				"Kosta Cetvrti tim 2027 -",
				"Mira Cetvrti tim 2028 -",
				"Tara Deveti tim" + lapsed,
				"Uros Deveti tim 2027 -");

		assertThat(teams()).as("Drugi tim had nobody who renewed, Peti tim nobody after the window, and Mile's"
						+ " row in Sedmi tim had not begun")
				.containsExactly("Cetvrti tim Kosta", "Deveti tim -", "Prvi tim Ceca", "Treci tim Hana");

		assertThat(pairs()).containsExactly("2027 Aca Hana", "2028 Boban Ceca");

		assertThat(messages()).containsExactlyInAnyOrder(
				ceca + " Vi ste administrator tima Prvi tim | Od 1. januara 2028 vi ste administrator tima Prvi tim,"
						+ " jer je dosadašnjem administratoru istekla članarina, a vi ste član koji je najduže u timu."
						+ " Ako ne želite ovu ulogu, javite se ligi.",
				kosta + " Vi ste administrator tima Cetvrti tim | Od 1. januara 2028 vi ste administrator tima"
						+ " Cetvrti tim, jer je dosadašnjem administratoru istekla članarina, a vi ste član koji je"
						+ " najduže u timu. Ako ne želite ovu ulogu, javite se ligi.",
				pera + " " + PairWriteApi.THE_PAIR_IS_BROKEN + " | Nena Nenic nije produžila članarinu za sezonu"
						+ " 2028, pa je vaš trkački par raskinut.",
				vesna + " " + PairWriteApi.THE_PAIR_IS_BROKEN + " | Aca Acic nije produžio članarinu za sezonu 2028,"
						+ " pa je vaš trkački par raskinut.",
				vlada + " " + PairWriteApi.THE_PAIR_IS_BROKEN + " | Eva Evic nije produžila članarinu za sezonu 2028,"
						+ " pa je vaš trkački par raskinut.",
				wanda + " " + PairWriteApi.THE_PAIR_IS_BROKEN + " | Joca Jocic nije produžio članarinu za sezonu"
						+ " 2028, pa je vaš trkački par raskinut.");
		assertThat(messages()).hasSize(6);
		assertThat(messages()).noneMatch(one -> one.startsWith(zora + " "));
		assertThat(db.sql("select count(*) from message where from_name <> ?").param(PairWriteApi.THE_LEAGUE)
				.query(Long.class).single()).isZero();
	}

	/**
	 * A SECOND RUN WRITES NOTHING, and a fee booked after the cut does not bring anybody back: „ne vraća se
	 * iako plati do 31. marta".
	 */
	@Test
	void aSecondRunWritesNothingAndALatePaymentBringsNobodyBack() {
		begins.begin(SEASON);

		List<String> memberships = memberships();
		List<String> teams = teams();
		List<String> pairs = pairs();
		List<String> messages = messages();

		HeldOn.season(db, aca, SEASON, "payment", Instant.parse("2028-01-05T10:00:00Z"));
		HeldOn.season(db, eva, SEASON, "payment", Instant.parse("2028-01-05T10:00:00Z"));

		begins.begin(SEASON);

		assertThat(memberships()).isEqualTo(memberships);
		assertThat(teams()).isEqualTo(teams);
		assertThat(pairs()).isEqualTo(pairs);
		assertThat(messages()).isEqualTo(messages);
	}

	/**
	 * THE SEAT IS NAMED AND NOT LEFT TO BE WORKED OUT: the column says Ceca, which is what „imenuje" asks
	 * and what {@link TeamApi} reads for the one who administers, and a seat that named a dropped member
	 * does not go on naming him.
	 */
	@Test
	void theNewAdministratorIsNamedInTheTeamAndTheOldOneIsNot() {
		begins.begin(SEASON);

		assertThat(adminOf("prvi-tim")).isEqualTo(ceca);
		assertThat(adminOf("cetvrti-tim")).isEqualTo(kosta);
		assertThat(adminOf("treci-tim")).isEqualTo(hana);
	}

	/**
	 * A SEASON CANCELLED AFTER IT BEGAN, IN FEBRUARY: out at once, with the same messages, and a team he
	 * was alone in goes. Before the season before it froze, nothing happens here, because the turn itself
	 * will drop him at 16:00.
	 */
	@Test
	void aSeasonCancelledAfterTheTurnTakesHimOutAtOnceAndNotBefore() {
		begins.begin(SEASON);

		long osmi = team("osmi-tim", "Osmi tim", zora);
		in(zora, osmi, 2027, null);

		begins.cancelled(zora, SEASON, at(2028, 1, 1, 15, 59), begins.before(zora, SEASON, at(2028, 1, 1, 15, 59)));

		assertThat(memberships()).contains("Zora Osmi tim 2027 -");
		assertThat(teams()).contains("Osmi tim Zora");

		begins.cancelled(ceca, SEASON, at(2028, 2, 10, 9, 0), begins.before(ceca, SEASON, at(2028, 2, 10, 9, 0)));
		begins.cancelled(zora, SEASON, at(2028, 2, 10, 9, 0), begins.before(zora, SEASON, at(2028, 2, 10, 9, 0)));

		assertThat(memberships()).contains("Ceca Prvi tim" + " 2027 2027 " + Membership.THE_FEE_LAPSED,
				"Boban Prvi tim 2027 -");
		assertThat(teams()).as("Osmi tim had only Zora, Prvi tim still has Boban and Dule")
				.containsExactly("Cetvrti tim Kosta", "Deveti tim -", "Prvi tim Boban", "Treci tim Hana");
		assertThat(pairs()).containsExactly("2027 Aca Hana");
		assertThat(messages()).contains(
				boban + " Vi ste administrator tima Prvi tim | Od danas vi ste administrator tima Prvi tim, jer je"
						+ " dosadašnjem administratoru istekla članarina, a vi ste član koji je najduže u timu. Ako ne"
						+ " želite ovu ulogu, javite se ligi.",
				boban + " " + PairWriteApi.THE_PAIR_IS_BROKEN + " | Ceca Cecic nije produžila članarinu za sezonu"
						+ " 2028, pa je vaš trkački par raskinut.");
	}

	/**
	 * A SEASON CANCELLED FOR 2027 MOVES NOBODY, in February 2027 or at any other time (PDL 05.11.2026, „Storno
	 * sezone 2027 ne izbacuje iz tima ni para"), though the member stands in a team he administers and in a pair
	 * of 2027: the first season the rule works is 2028, which the case above holds from the other side.
	 */
	@Test
	void aSeasonCancelledFor2027MovesNobodyOutOfHisTeamOrHisPair() {
		List<String> memberships = memberships();
		List<String> teams = teams();
		List<String> pairs = pairs();
		List<String> messages = messages();

		begins.cancelled(aca, 2027, at(2027, 2, 10, 9, 0), begins.before(aca, 2027, at(2027, 2, 10, 9, 0)));
		begins.cancelled(aca, 2027, at(2028, 2, 10, 9, 0), begins.before(aca, 2027, at(2028, 2, 10, 9, 0)));

		assertThat(memberships()).isEqualTo(memberships);
		assertThat(teams()).isEqualTo(teams);
		assertThat(adminOf("prvi-tim")).isEqualTo(aca);
		assertThat(pairs()).isEqualTo(pairs).contains("2027 Aca Hana");
		assertThat(messages()).isEqualTo(messages).isEmpty();
	}

	/* ------------------------------------------------------------------------------------
	   THE FIXTURE
	   ------------------------------------------------------------------------------------ */

	private static ZonedDateTime at(int year, int month, int day, int hour, int minute) {
		return LocalDateTime.of(year, month, day, hour, minute).atZone(SeasonClock.ZONE);
	}

	private long member(String number, String first, String last, String gender) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, active,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027, true,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, first, last, gender, "0011223344" + number)
				.query(Long.class).single();
	}

	private long team(String slug, String name, long admin) {
		return db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values (?, ?, '', '', (select id from place where rank = 1),"
						+ " null, null, null, 2027, ?) returning id")
				.params(slug, name, admin)
				.query(Long.class).single();
	}

	private void in(long member, long team, int from, Integer to) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
						+ " values (?, ?, ?, ?, ?)")
				.params(member, team, from, to, to == null ? null : Membership.LEFT_ON_HIS_OWN)
				.update();
	}

	private void pair(int season, long man, long woman) {
		db.sql("insert into racing_pair (season, man_id, woman_id) values (?, ?, ?)")
				.params(season, man, woman).update();
	}

	private long adminOf(String slug) {
		return db.sql("select coalesce(admin_id, 0) from team where slug = ?").param(slug).query(Long.class).single();
	}

	private List<String> memberships() {
		return db.sql("select c.first_name || ' ' || t.name || ' ' || m.season_from || ' '"
						+ " || coalesce(m.season_to::text, '-') || coalesce(' ' || m.left_reason, '')"
						+ " from team_membership m join competitor c on c.id = m.competitor_id"
						+ " join team t on t.id = m.team_id order by m.id")
				.query(String.class).list();
	}

	private List<String> teams() {
		return db.sql("select t.name || ' ' || coalesce(c.first_name, '-') from team t"
						+ " left join competitor c on c.id = t.admin_id order by t.name")
				.query(String.class).list();
	}

	private List<String> pairs() {
		return db.sql("select p.season || ' ' || man.first_name || ' ' || woman.first_name from racing_pair p"
						+ " join competitor man on man.id = p.man_id join competitor woman on woman.id = p.woman_id"
						+ " order by p.season, man.first_name")
				.query(String.class).list();
	}

	private List<String> messages() {
		return db.sql("select coalesce(to_id::text, 'everybody') || ' ' || subject || ' | ' || body from message"
						+ " order by id")
				.query(String.class).list();
	}
}
