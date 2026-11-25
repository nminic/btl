package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V112 DOES TO THE QUEUE THAT IS ALREADY THERE, run against a real database (CLAUDE.md, section 11).
 *
 * <p><b>The rows are the shapes both real databases hold</b>, read on 25.11.2026 with a SELECT over
 * {@code queue}, {@code state}, {@code photo_id} and {@code team_proposal_id}: an approved comment with neither,
 * approved profile rows with no picture, a profile row waiting with a picture and one waiting with a text, and
 * approved teams rows, each with a proposal and none with a picture. No teams row waits and none holds a picture.
 *
 * <p><b>What V112 is meant to do with them: nothing.</b> Every row comes out with no team, and the four rules and
 * the index accept each of those shapes, so that every one of them passes untouched IS the measurement. The second
 * half is that a logo can wait for a team that stood before the migration, and that a second one of the same team
 * is refused.
 *
 * <p><b>How the fixture is made</b>, the shape of {@code LeagueMarkCarriedOverTest}: what V112 adds is undone with one
 * statement ({@code drop column ... cascade} takes its key, its three checks and both indexes, which all name the
 * column), the rows are written as a database holds them before V112, and the migration is executed from the file
 * Flyway resolved ({@link DatabaseTest#migrationSql}), inside the test's transaction, which is rolled back.
 */
class TeamLogoCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_MEMBER = "(select id from competitor where member_number = '000960')";

	private static final String A_PHOTO = "(select id from photo where digest = '" + "e1".repeat(32) + "')";

	private void beforeV112() {
		jdbc.execute("alter table verification drop column team_id cascade");

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
				+ " first_season, referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
				+ " shirt_size, health_statement_at) values ('000960', 'Zateceni', 'Clan', 'M', date '1985-03-03', "
				+ A_TOWN + ", 2027, '00aa11bb22cc33dd', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Moderator', 'Zateceni',"
				+ " 'moderator-v112@primer.rs', (select id from role where code = 'moderator'))").update();
		db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter) values"
				+ " ('image/jpeg', 4096, ?, 0.5, 0.5, 1)").param("e1".repeat(32)).update();
		db.sql("insert into team (slug, name, bio, link, place_id, first_season) values ('zateceni-tim',"
				+ " 'Zateceni tim', '', '', " + A_TOWN + ", 2027)").update();

		decided("comments", "Komentar", null);
		decided("profiles", "Tekst 1", null);
		decided("profiles", "Tekst 2", null);
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id) values ('profiles', "
				+ A_MEMBER + ", 'Slika', '', " + A_PHOTO + ")").update();
		db.sql("insert into verification (queue, competitor_id, subject, body) values ('profiles', " + A_MEMBER
				+ ", 'Tekst', 'Tekst koji ceka')").update();

		for (String name : List.of("Prvi tim", "Drugi tim", "Treci tim")) {
			long proposal = db.sql("insert into team_proposal (competitor_id, name, bio, link, place_id) values ("
							+ A_MEMBER + ", ?, '', '', " + A_TOWN + ") returning id")
					.param(name).query(Long.class).single();

			decided("teams", name, proposal);
		}
	}

	/** An approved row of a tab, with no picture, pointing at the proposal given where there is one. */
	private void decided(String queue, String subject, Long proposal) {
		db.sql("insert into verification (queue, competitor_id, subject, body, state, decided_at, decided_by_name,"
						+ " team_proposal_id) values (?, " + A_MEMBER + ", ?, '', 'approved',"
						+ " timestamptz '2026-11-20 10:00:00+00', 'Moderator Zateceni', ?)")
				.params(queue, subject, proposal).update();
	}

	/** Every row of the queue as {@code queue | state | picture | proposal | team}, in the order written. */
	private List<String> theQueue() {
		return db.sql("select queue || ' | ' || state || ' | ' || (photo_id is not null) || ' | '"
						+ " || (team_proposal_id is not null) || ' | ' || coalesce(team_id::text, '-')"
						+ " from verification where competitor_id = " + A_MEMBER + " order by id")
				.query(String.class).list();
	}

	private String aLogo() {
		return "insert into verification (queue, competitor_id, subject, body, photo_id, team_id) values ('teams', "
				+ A_MEMBER + ", 'Logo', '', " + A_PHOTO + ", (select id from team where slug = 'zateceni-tim'))";
	}

	@Test
	void theRowsAlreadyThereComeThroughWithNoTeamAndALogoMayWaitAfterwards() {
		beforeV112();

		jdbc.execute(migrationSql("112"));

		assertThat(theQueue()).as("V112 touched a row that stood before it, or gave the team a default")
				.containsExactly(
						"comments | approved | false | false | -",
						"profiles | approved | false | false | -",
						"profiles | approved | false | false | -",
						"profiles | waiting | true | false | -",
						"profiles | waiting | false | false | -",
						"teams | approved | false | true | -",
						"teams | approved | false | true | -",
						"teams | approved | false | true | -");

		assertThat(db.sql(aLogo()).update()).as("a logo of a team that stood before V112 was refused").isOne();
		assertThatThrownBy(() -> db.sql(aLogo()).update()).hasMessageContaining("verification_one_logo_waits_per_team");
	}

	/** The fixture really takes V112 away: the column is not there to write. */
	@Test
	void beforeV112ThereIsNoTeamToWrite() {
		beforeV112();

		assertThatThrownBy(() -> db.sql("update verification set team_id = null").update())
				.hasMessageContaining("team_id");
	}
}
