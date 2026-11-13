package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * THE DUCATS ONE MEMBER HOLDS, as the server has awarded them ({@code ducat_award}).
 *
 * <p>Step five of seven of „Dukate dodeljuje verifikacija rezultata": the page „Priznanja i nagrade" reads
 * this record instead of working the ducats out again in the browser from {@code /api/results}. What is
 * held is decided where it is written ({@link AwardingDucats}); this only reads it.
 *
 * <p><b>WHO MAY READ IT IS THE PROFILE'S RULE, AND THE PROFILE READ THIS FROM {@code /api/results}.</b>
 * The owner, PDL, 08.11.2026: „Dukat se upisuje i članu kome je istekla članarina; ko ga vidi zavisi od
 * pravila profila." Until this route the page worked every ducat out of {@code /api/results}, so the rule
 * is copied from there and from nowhere else:
 *
 * <ul>
 * <li><b>Anybody, signed in or not, and the same answer to every reader.</b> {@code /api/results} is on
 * {@link ApiSecurity#READ_BY_ANYBODY} and takes no caller; section 3 of the privacy policy lists
 * „dukati i priznanja" among what a public competition publishes. So this takes no caller either, and
 * the screen decides who reaches the page ({@code pages/profile/visible.ts}), as it does for the results
 * the page is drawn beside.</li>
 * <li><b>Not a ducat whose race {@code /api/results} withholds.</b> That route withholds the running
 * season of a member whose fee has lapsed, and a ducat is placed in time by the day of the race that
 * carried him over ({@code won_on}, V91). One condition, asked of that day:
 * {@link ResultApi#aRunIsServed}. So a member whose fee has lapsed is answered his ducats of earlier
 * seasons and of all time won before this season, exactly what the browser worked out for him from the
 * results it was served, and nothing the results would not have told.</li>
 * <li><b>A number nobody holds, a deleted member and a member with nothing are one answer, an empty
 * list.</b> A deleted member takes his awards with him ({@code ducat_award_competitor_fk} is
 * {@code on delete cascade}, V15). A 404 for a number that is not there and a list for one that is would
 * let a visitor read off which numbers belong to members who are not on the public list, which
 * {@code pages/profile/visible.ts} is written to prevent on the page itself.</li>
 * </ul>
 *
 * <p><b>WHAT IS ANSWERED IS WHAT THE PAGE DRAWS, AND NO MORE.</b> The page draws a coin, its name, and
 * the month or the season beside it, from the family {@code /api/ducats} already serves and from where
 * this one ducat stands in it: which family ({@code ducat}, its code), at which threshold
 * ({@code value}), at which tier it was won ({@code tier}, the snapshot V91 keeps because a run's tier
 * rises part way), and in which season and month ({@code season}, {@code month}, empty for a ducat of
 * all time). Left out, each for a reason:
 *
 * <ul>
 * <li><b>{@code won_on}.</b> The owner, 08.11.2026: „Dukat pamti dan trke kojom je prag pređen, ali se
 * taj datum ne prikazuje nigde na portalu dok vlasnik ne odluči drugačije. ... Datum služi redosledu
 * (najnoviji prvi)." So it orders the answer and leaves the server in no field.</li>
 * <li><b>{@code reached}, {@code result_id}, {@code awarded_at} and the row's key.</b> No screen reads
 * them, and {@code result_id} would name another row of another table about him.</li>
 * <li><b>{@code kind} and {@code period}.</b> Both are the family's, which the page has; a second copy
 * here would be a second home for one fact.</li>
 * </ul>
 *
 * <p><b>NEWEST FIRST, by the day of the race that won it.</b> The owner, PDL P11, 11.08.2026: „Dukati na
 * profilu idu hronološki, od najnovijeg ka najstarijem". Several ducats one race carried him over stand
 * in the order of the catalogue ({@code ducat.id}, the order the rulebook lists them in, which is the
 * order the browser drew them in before this), and within one family the higher threshold first, since
 * within one race it is the later one to be crossed. <b>That tie is my derivation and not the owner's
 * word.</b> Not the row's key, which is the order the reconciliation happened to write them in.
 */
@RestController
class DucatAwardApi {

	private final JdbcClient db;

	private final Clock clock;

	DucatAwardApi(JdbcClient db, Clock clock) {
		this.db = db;
		this.clock = clock;
	}

	/**
	 * One ducat he holds.
	 *
	 * @param ducat  the code of the family, the one {@code /api/ducats} answers as {@code id}
	 * @param value  the threshold he crossed, as it was written when he won it
	 * @param tier   what it was worth when he won it, 1 to 5
	 * @param season the season of a ducat of a month or of a season, empty for one of all time
	 * @param month  the month, 1 to 12, of a ducat of a month, and empty for any other
	 */
	record HeldDucat(String ducat, BigDecimal value, int tier, Integer season, Integer month) {
	}

	@GetMapping("/api/ducat-awards/{memberNumber}")
	List<HeldDucat> heldBy(@PathVariable String memberNumber) {
		ZonedDateTime now = ZonedDateTime.now(clock);

		return db.sql("select d.code, a.threshold, a.tier, a.season, a.month"
						+ " from ducat_award a"
						+ " join ducat d on d.id = a.ducat_id"
						+ " join competitor c on c.id = a.competitor_id"
						+ " where c.member_number = ?"
						+ " and " + ResultApi.aRunIsServed("c.id", "a.won_on", now)
						+ " order by a.won_on desc, a.ducat_id, a.threshold desc")
				.param(memberNumber)
				.query((row, one) -> new HeldDucat(row.getString(1), row.getBigDecimal(2), row.getInt(3),
						row.getObject(4, Integer.class), row.getObject(5, Integer.class)))
				.list();
	}
}
