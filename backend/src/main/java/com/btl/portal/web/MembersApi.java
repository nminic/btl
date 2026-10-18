package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.season.SeasonClock;
import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * THE MEMBERS AS THE MODERATION OF THE MEMBERS READS THEM: every one who was ever given a member
 * number, whether his fee stands or not, with every season he was a member of.
 *
 * <p><b>Why a route of its own and not a parameter on {@link CompetitorApi}.</b> The owner,
 * 18.10.2026 (PDL P8, „Osnov članstva ima jedan dom”): „Moderacija članova za administraciju
 * prikazuje i neaktivne članove, uz filter ... javni spisak ostaje samo aktivni.” The public list
 * ends {@code where c.active}, and the portal reads the PRESENCE of a row on it as „this member is
 * active" on twenty screens ({@code frontend/src/data/types.ts}, the note on {@code Competitor}). A
 * lapsed member put on that answer for the administration would be a member the administration's
 * own screens draw as present everywhere else. So he arrives here, on an answer only the moderation
 * reads, and {@link CompetitorApi} is not touched.
 *
 * <p><b>Who may read it</b> is the administration over the members, the same right the basis is
 * read under on the public list ({@link CompetitorApi#OVER_THE_MEMBERS}; PDL P8, „Ko sme:
 * superadmin i moderator sa pravom nad članovima”). A visitor is answered 401 by the chain, because
 * this address is not on {@code ApiSecurity.READ_BY_ANYBODY}, and anybody signed in without the right
 * is answered 404 by {@link RightIsNeeded} (ADL A8).
 *
 * <p><b>Who is on it</b> is the owner's decision of 21.09.2026 (PDL, „Spisak članova u
 * administraciji”): „„Svi" znači aktivni plus neaktivni, dakle svako ko je ikad dobio članski broj”,
 * and an account that registered and was never given a number is on none of the three values of the
 * filter, because the row „Uplate" is where that man is handled. The filter itself is the screen's;
 * this answers all of them once and says which are active.
 *
 * <p><b>Active is {@code competitor.active}</b>, the column every other door reads, so the
 * moderation's „Aktivni" is exactly the public list. A boundary rather than an oversight: nothing in
 * the portal writes {@code active = false} today, so „Neaktivni" stays empty on a real database until
 * the flag is derived from the rows of {@code membership}, which is its own increment (V22).
 */
@RestController
class MembersApi {

	private final JdbcClient db;

	private final Clock clock;

	MembersApi(JdbcClient db, Clock clock) {
		this.db = db;
		this.clock = clock;
	}

	/**
	 * One season a member was a member of, and on what basis.
	 *
	 * @param season the season, never before 2027, which {@code membership} cannot hold
	 * @param basis  that season's own basis, read off that season's row and not off the season on sale
	 */
	record Season(int season, String basis) {
	}

	/**
	 * @param active           whether his fee stands, as {@code competitor.active} says it
	 * @param membershipBasis  the basis of the season ON SALE ({@link SeasonClock#seasonBeingPaidFor}),
	 *                         absent for a member who holds no row of it: the same field, under the
	 *                         same name and the same rule, as {@link CompetitorApi.Competitor}
	 * @param membershipSeason the season {@code membershipBasis} is the basis of, present exactly when
	 *                         it is
	 * @param seasons          every season he holds a row of, oldest first, each with its own basis;
	 *                         empty and never absent for a member who holds none. The screen's column
	 *                         „Poslednja sezona" is the last of these, so the fact has this one home
	 *                         (PDL P8, „Kolona sa poslednjom sezonom u moderaciji broji svaki osnov”)
	 */
	record Member(String memberNumber, String firstName, String lastName, String gender,
			String city, String ageBand, boolean firstSeason2027, boolean active,
			@JsonInclude(JsonInclude.Include.NON_NULL) String membershipBasis,
			@JsonInclude(JsonInclude.Include.NON_NULL) Integer membershipSeason,
			List<Season> seasons) {
	}

	@GetMapping("/api/members")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	List<Member> members() {
		/* The clock is read ONCE for the whole answer, as `CompetitorApi` reads it: the band for the
		   season it is worked out for, and the basis for the season on sale, which from 15 October
		   is the next one. */
		ZonedDateTime now = ZonedDateTime.now(clock);
		int season = SeasonClock.seasonTheBandIsWorkedOutFor(now);
		int sold = SeasonClock.seasonBeingPaidFor(now);

		/* EVERY SEASON OF EVERY MEMBER ON THE LIST, read once and handed out by member. Oldest
		   first, which the screen relies on to name the last one. */
		Map<Long, List<Season>> held = new HashMap<>();

		db.sql("select m.competitor_id, m.season, m.basis from membership m"
						+ " order by m.competitor_id, m.season")
				.query((row, one) -> held.computeIfAbsent(row.getLong(1), any -> new ArrayList<>())
						.add(new Season(row.getInt(2), row.getString(3))))
				.list();

		return db.sql("select c.id, c.member_number, c.first_name, c.last_name, c.gender,"
						+ " coalesce(town.name, c.city) as city, c.first_season_2027, c.active,"
						+ " sold.basis, c.birth_year"
						+ " from competitor c"
						+ " left join place town on town.id = c.place_id"
						/* `membership_pk` is (competitor, season), so this joins at most one row. */
						+ " left join membership sold on sold.competitor_id = c.id"
						+ "  and sold.season = :sold"
						/* EVERYBODY WHO WAS EVER GIVEN A NUMBER, and nobody else (PDL, 21.09.2026). */
						+ " where c.member_number is not null"
						+ " order by c.member_number")
				.param("sold", sold)
				.query((row, one) -> {
					String basis = row.getString(9);

					return new Member(row.getString(2), row.getString(3), row.getString(4),
							row.getString(5), row.getString(6),
							Category.ageBandFor(row.getInt(10), season).code(),
							row.getBoolean(7), row.getBoolean(8),
							basis, basis == null ? null : sold,
							List.copyOf(held.getOrDefault(row.getLong(1), List.of())));
				})
				.list();
	}
}
