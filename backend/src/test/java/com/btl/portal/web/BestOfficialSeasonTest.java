package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE BEST SINGLE SEASON OF A MEMBER COUNTS ONLY THE SEASONS HE WAS A MEMBER OF.
 *
 * <p>PDL P9, the owner's choice of 18.10.2026: a result „za godinu kad čovek nije bio član ... ne
 * ulazi ni u jednu sezonsku tabelu, Top listu ni nagradu", read for the beginners' category as
 * {@link BestOfficialSeason} says: a year he ran in without being a member is no official season
 * of his.
 *
 * <p><b>Two members and two years, and every wrong reading has a number it gives.</b> Both run the
 * same points in 2027 and in 2028; the first is a member of 2028 alone and the second of 2027 alone.
 * Asked for 2029, so both years are before the season asked about. A query that ignored the
 * membership answers 20 for each; one that took any membership of the member answers 20 for the
 * first; one that took anybody's membership of the year answers 20 for both; the right one answers
 * 15 for the first (his 2028) and 20 for the second (his 2027), which no wrong reading gives both of.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class BestOfficialSeasonTest {

	@Autowired
	private JdbcClient db;

	@Autowired
	private BestOfficialSeason best;

	@BeforeEach
	void twoMembersOfOneSeasonEach() {
		member("000101", "00112233440101aa");
		member("000102", "00112233440102aa");

		event("prva-2027", "2027-05-01");
		event("druga-2028", "2028-05-01");
		race("prva-2027", "Prva", "2027-05-01");
		race("druga-2028", "Druga", "2028-05-01");

		for (String number : new String[] {"000101", "000102"}) {
			run(number, "Prva", "2027-05-01", 20.00);
			run(number, "Druga", "2028-05-01", 15.00);
		}

		memberOf("000101", 2028);
		memberOf("000102", 2027);
	}

	@Test
	void aYearHeWasNoMemberOfIsNoSeasonOfHis() {
		assertThat(best.pointsFor(idOf("000101"), 2029))
				.as("the member of 2028 alone was counted by a year he was no member of, or not by his own")
				.isEqualByComparingTo(new BigDecimal("15.00"));
		assertThat(best.pointsFor(idOf("000102"), 2029))
				.as("the member of 2027 alone was counted by a year he was no member of, or not by his own")
				.isEqualByComparingTo(new BigDecimal("20.00"));
	}

	@Test
	void andASeasonIsStillNeverBeforeItself() {
		/* The bound that was already there, asked again with the join in place: the first member's
		   2028 is his own season and still does not decide 2028. */
		assertThat(best.pointsFor(idOf("000101"), 2028)).isEqualByComparingTo(BigDecimal.ZERO);
	}

	private long idOf(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number)
				.query(Long.class).single();
	}

	private void member(String number, String referral) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Ime', 'Prezime', 'M', date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027, false, true,"
						+ " 'payment', ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, referral).update();
	}

	private void event(String slug, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', null, 'Kraljevo',"
						+ " (select id from country where code = 'RS'), 'race', false, '', '')")
				.params(slug, slug).update();
	}

	private void race(String eventSlug, String name, String day) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " date '" + day + "', 'length', 0, 10, 0, 0)")
				.params(eventSlug, name).update();
	}

	private void run(String member, String raceName, String day, double points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from race where name = ?), date '" + day + "', 10, 0, 0, 3000, ?)")
				.params(member, raceName, points).update();
	}

	private void memberOf(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}
}
