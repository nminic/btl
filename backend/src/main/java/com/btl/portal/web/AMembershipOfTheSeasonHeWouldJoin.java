package com.btl.portal.web;

import com.btl.portal.domain.team.JoiningATeam;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;

/**
 * WHETHER A MEMBER HOLDS THE SEASON A TEAM WOULD TAKE HIM IN FOR: THE ONE PLACE THAT ASKS IT.
 *
 * <p>PDL, ODLUKA 30.10.2026, „U prelaznom roku svaki ulaz u tim traži plaćenu narednu sezonu":
 * „Prijava u tim, prihvatanje poziva i predlog novog tima traže članstvo za sezonu za koju se
 * plaća (naredna, u prelaznom roku). Poziv sme da se pošalje i članu koji narednu nije platio,
 * ali on ga prihvata tek kad plati. Izlazak iz tima ne traži ništa." It carries out article 49 of
 * the rulebook, „Promena tima stupa na snagu 1. januara naredne sezone, i to samo ako je članstvo
 * aktivno za tu sezonu". Until this class every door into a team asked {@code competitor.active},
 * which is one boolean with no season in it, so a member who had paid only the season being run
 * could enter a team for the next one.
 *
 * <p><b>THE SEASON IS {@link JoiningATeam#seasonHeWouldJoin}, READ ONCE FROM THE MOMENT THE DOOR
 * WAS KNOCKED ON AND NEVER SPELT HERE.</b> That is {@code SeasonClock.seasonBeingPaidFor}: the
 * next season inside the transfer window, which is what the decision means by „sezona za koju se
 * plaća", and the season being run outside it. Outside the window every door but one is shut
 * before this is asked, and the one that is not (a moderator approving a team proposed in the
 * window) is then asking whether the founder holds the season on sale, which every member whose
 * fee stands holds. So the same question serves all six doors without a branch on the window.
 *
 * <p><b>THE QUESTION IS THE KEY AND NOT THE BASIS.</b> {@code membership_one_a_season} is
 * {@code (competitor_id, season)}, so a row of any basis (paid, freed of the fee by the Managing
 * Board, granted) is a membership of that season. It is the question
 * {@code BookingAPayment#theSeasonIsAlreadyHeld} asks of the same table, for the same reason.
 *
 * <p><b>IT IS NOT {@code competitor.active}, AND TODAY THE TWO GIVE THE SAME ANSWER.</b> Until
 * 11 November 2027 the only season on sale is 2027 and {@code active} is exactly „holds a row of
 * 2027 or of the season being run", so no case written on today's clock can tell them apart. They
 * come apart the day a member holds only the season being run, and every case of this feature
 * moves the clock into the window of 2027 for that reason.
 *
 * <p><b>THE SQL IS ALSO HANDED OUT AS A FRAGMENT</b> ({@link #heHoldsIt}), because two readers
 * ask it inside a statement that already joins {@code competitor} (the application a team may
 * decide, and the team's list of applications), and a second spelling of the {@code exists}
 * would be this fact with two homes.
 */
@Component
class AMembershipOfTheSeasonHeWouldJoin {

	private final JdbcClient db;

	AMembershipOfTheSeasonHeWouldJoin(JdbcClient db) {
		this.db = db;
	}

	/** Whether he holds a row of that season, asked at that moment. */
	boolean holds(long competitor, ZonedDateTime at) {
		return db.sql("select " + heHoldsIt("?"))
				.params(competitor, JoiningATeam.seasonHeWouldJoin(at))
				.query(Boolean.class)
				.single();
	}

	/**
	 * The condition as a piece of a statement, with ONE placeholder after the competitor's
	 * column: the season, which the caller binds from {@link #season}.
	 *
	 * @param competitorColumn the column or placeholder holding {@code competitor.id}
	 */
	static String heHoldsIt(String competitorColumn) {
		return "exists(select 1 from membership held where held.competitor_id = " + competitorColumn
				+ " and held.season = ?)";
	}

	/** The number to bind to the placeholder of {@link #heHoldsIt}. */
	static int season(ZonedDateTime at) {
		return JoiningATeam.seasonHeWouldJoin(at);
	}
}
