package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE FREEZE OF 2027 IS THE BEGINNING OF 2028, AND THE ORDER IS "ZAMRZAVANJE PA ISPADANJE".
 *
 * <p>PDL, derived 19.09.2026: "Redosled je zamrzavanje pa ispadanje, i ne bira se: zamrznut snimak mora da
 * zapise sezonu onakvu kakva je prozivljena." The case runs the act of {@link ASeasonFreezes} at 16:00 on
 * 1 January 2028 with the followers Spring wires, so the one thing that makes {@link ASeasonBegins} follow the
 * freeze is the {@link WhatFollowsTheFreeze} it implements, and nothing is handed to the act by the case.
 *
 * <p><b>Two teams and two pairs stand in it, one of each that must move and one that must not.</b> Aca did
 * not renew and is alone in Prvi tim and in a pair of 2028; Bela renewed and is alone in Drugi tim. Aca is
 * also in a pair of 2027, which froze and stays. The snapshot of 2027 must carry Prvi tim with Aca in it and
 * the pair of 2027, though by the end of the act Prvi tim does not exist any more: a team that goes with its
 * last member is deleted, so a beginning that ran BEFORE the snapshot would leave the snapshot without it.
 *
 * <p>The clock of the act is fixed and handed to an {@link ASeasonFreezes} built here, so the Spring context
 * of the case does not freeze anything of its own at start (its clock is the default one).
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class ASeasonBeginsThroughTheFreezeTest {

	@Autowired
	private JdbcClient db;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private TheTablesOfASeason tables;

	@Autowired
	private ObjectProvider<WhatFollowsTheFreeze> followers;

	@Autowired
	private ASeasonBegins begins;

	private long aca;

	private long bela;

	private long vesna;

	@BeforeEach
	void aLeagueOnTheLastDayOf2027() {
		aca = member("000941", "Aca", "Acic", "M");
		bela = member("000942", "Bela", "Belic", "M");
		vesna = member("000943", "Vesna", "Vesnic", "F");

		for (long each : List.of(aca, bela, vesna)) {
			HeldOn.season(db, each, 2027, "feeExempt");
		}

		HeldOn.season(db, bela, 2028, "payment");
		HeldOn.season(db, vesna, 2028, "payment");

		in(aca, team("prvi-tim", "Prvi tim", aca));
		in(bela, team("drugi-tim", "Drugi tim", bela));

		pair(2027, aca, vesna);
		pair(2028, aca, vesna);

		/* A pair stands on the board of pairs only with a race the two of them ran. */
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
				+ " featured, description, link) values ('zajednicka-trka', 'Zajednicka', date '2027-05-01', null,"
				+ " 'Kraljevo', (select id from country where code = 'RS'), 'race', false, '', '')").update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
				+ " descent_m) values ((select id from btl_event where slug = 'zajednicka-trka'), 'Zajednicka',"
				+ " false, date '2027-05-01', 'length', 0, 10, 0, 0)").update();

		for (long each : List.of(aca, vesna)) {
			db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
					+ " seconds, points) values (?, (select id from race where name = 'Zajednicka'),"
					+ " date '2027-05-01', 10, 0, 0, 3000, 10.00)").param(each).update();
		}
	}

	@Test
	void theFreezeOf2027TakesTheLapsedOutAfterTheSnapshotHasWrittenThemIn() {
		freezeAt2028();

		assertThat(db.sql("select name from season_team where season = 2027 order by name").query(String.class).list())
				.as("the snapshot of 2027 carries both teams, though one of them is gone by now")
				.containsExactly("Drugi tim", "Prvi tim");
		assertThat(db.sql("select m.competitor_id from season_team_member m join season_team t"
						+ " on t.id = m.season_team_id where t.season = 2027 and t.name = 'Prvi tim'")
				.query(Long.class).list()).as("and Aca in the roster of the team he was alone in")
				.containsExactly(aca);
		assertThat(db.sql("select h.competitor_id from season_pair_half h join season_pair p"
						+ " on p.id = h.season_pair_id where p.season = 2027 order by h.half")
				.query(Long.class).list()).as("and the pair of 2027 on the board of pairs")
				.containsExactly(aca, vesna);

		assertThat(db.sql("select name from team order by name").query(String.class).list())
				.as("Prvi tim went with its last member and Drugi tim, whose member renewed, stands")
				.containsExactly("Drugi tim");
		assertThat(db.sql("select season from racing_pair order by season").query(Integer.class).list())
				.as("the pair of 2028 is broken and the pair of 2027 stays")
				.containsExactly(2027);
		assertThat(db.sql("select count(*) from team_membership where competitor_id = ? and season_to is null")
				.param(bela).query(Long.class).single()).isEqualTo(1);
		assertThat(db.sql("select season from season_frozen order by season").query(Integer.class).list())
				.containsExactly(2027);
	}

	/**
	 * PDL, owner, 05.11.2026, "Ispadanje iz timova i parova prvi put radi 1.1.2028": the freeze of 2026
	 * would begin 2027 and moves nobody, though Aca holds no membership of 2027 and the beginning of 2027
	 * would drop him. The freeze of 2027, handed over the same way, does.
	 */
	@Test
	void theFreezeOf2026BeginsNothingAndTheFreezeOf2027DoesBegin() {
		db.sql("delete from membership where competitor_id = ?").param(aca).update();

		List<String> before = standing();

		begins.followTheFreezeOf(2026);

		assertThat(standing()).as("2027 is the first season of the league and does not drop anybody")
				.isEqualTo(before);

		begins.followTheFreezeOf(2027);

		assertThat(standing()).as("2028 does drop the member who did not renew it").isNotEqualTo(before);
		assertThat(db.sql("select name from team order by name").query(String.class).list())
				.as("Prvi tim went with the member who did not renew").containsExactly("Drugi tim");
		assertThat(db.sql("select season from racing_pair order by season").query(Integer.class).list())
				.containsExactly(2027);
	}

	private List<String> standing() {
		return db.sql("select 'team ' || name from team union all select 'membership ' || competitor_id || ' '"
						+ " || season_from || ' ' || coalesce(season_to::text, '-') from team_membership"
						+ " union all select 'pair ' || season || ' ' || man_id from racing_pair order by 1")
				.query(String.class).list();
	}

	private void freezeAt2028() {
		Instant at = LocalDateTime.of(2028, 1, 1, 16, 0).atZone(SeasonClock.ZONE).toInstant();

		new ASeasonFreezes(db, Clock.fixed(at, ZoneOffset.UTC), inOneTransaction, best, tables, followers).freeze();
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

	private void in(long member, long team) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
						+ " values (?, ?, 2027, null, null)")
				.params(member, team)
				.update();
	}

	private void pair(int season, long man, long woman) {
		db.sql("insert into racing_pair (season, man_id, woman_id) values (?, ?, ?)")
				.params(season, man, woman).update();
	}
}
