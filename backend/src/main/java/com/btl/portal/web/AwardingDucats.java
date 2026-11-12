package com.btl.portal.web;

import com.btl.portal.domain.award.DucatInstances.Family;
import com.btl.portal.domain.award.DucatInstances.Period;
import com.btl.portal.domain.award.DucatKind;
import com.btl.portal.domain.award.DucatReconciliation;
import com.btl.portal.domain.award.DucatReconciliation.Award;
import com.btl.portal.domain.award.DucatReconciliation.Held;
import com.btl.portal.domain.award.DucatReconciliation.Plan;
import com.btl.portal.domain.award.DucatReconciliation.Rewrite;
import com.btl.portal.domain.award.DucatReconciliation.Run;
import com.btl.portal.domain.award.RaceDone;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * BRINGS ONE MEMBER'S DUCATS INTO LINE WITH HIS RESULTS: writes the ones he meets and does not hold,
 * takes away the ones he no longer meets, and tells a row that stays which race carried it over.
 *
 * <p>Step two of seven of „Dukate dodeljuje verifikacija rezultata”, and nothing calls it yet: steps three
 * and four do (after a verification, a correction or a deletion, and in the job at night). What is
 * decided is {@link DucatReconciliation}'s, in the domain; this reads what that needs and writes what it
 * asks for.
 *
 * <p><b>In a transaction of its own, always.</b> ADL, 21.09.2026, the owner: „Verifikacija rezultata:
 * rezultat i rang liste su unutar transakcije; dukati i pošta idu posle nje.” So {@link #forMember}
 * opens a new one even when it is called from inside another, and then it sees what that other has
 * committed and nothing it has not.
 *
 * <p><b>THE FROZEN SEASON IS ASKED BY THE STATEMENT THAT WRITES, and nowhere else.</b> The owner,
 * 08.11.2026: „Rezultat unet ili ispravljen posle zamrzavanja svoje sezone donosi samo trajne dukate”,
 * and a ducat of a month or a season of a frozen season is not taken away either, „jer zamrznuta tabela
 * taj rezultat i dalje pokazuje”. Whether a season has frozen is a row of {@code season_frozen} and never
 * the clock (ADL 08.11.2026), so the insert, the delete and the rewrite below each carry
 * {@link #A_PERIOD_STILL_OPEN} over the season the row names, and a frozen row is not touched in any way,
 * its pointer and its day included (a pointer whose result was deleted stays empty, from
 * {@code on delete set null (result_id)} in V91).
 *
 * <p><b>Two reconciliations of one member take turns.</b> A verification of his and the job at night can
 * run at once, and each decides from what it read: one that read his results before the other's
 * deletion would write back what the other has just taken away. The turn is
 * {@code pg_advisory_xact_lock} keyed by the member, the shape {@link MePhotoApi#oneSendOfAMemberAtATime}
 * set, and not {@code for update} on his row, which the approvals and the league already take
 * ({@link VerificationWriteApi}). It is the first statement, so a reconciliation waits for it while
 * holding nothing.
 *
 * <p><b>Then his row, for key share, before anything is written.</b> An insert here checks
 * {@code ducat_award_competitor_fk} after it has put its row in the index, and a deletion of the member
 * cascades into {@code ducat_award} rows this may have updated, so the two could each wait on the other.
 * Taken first, the share makes a deletion wait for the reconciliation to finish, or the reconciliation
 * wait for the deletion and then find nobody, which answers nothing written. The shape is
 * {@link VerificationWriteApi}'s, for the same reason.
 *
 * <p><b>A row written past the turn is met by {@code on conflict do nothing}</b>, and is not reported:
 * what this answers is only what it wrote, because a message is sent on each (step four), and a ducat
 * somebody else wrote is that writer's to announce.
 */
@Component
class AwardingDucats {

	/** True of a row of {@code ducat_award} under the alias {@code a} whose season has not frozen. */
	private static final String A_PERIOD_STILL_OPEN = " (a.period = 'always' or not exists"
			+ " (select 1 from season_frozen f where f.season = a.season))";

	private final JdbcClient db;

	private final Clock clock;

	private final TransactionTemplate inItsOwnTransaction;

	AwardingDucats(JdbcClient db, Clock clock, TransactionTemplate transactions) {
		this.db = db;
		this.clock = clock;
		this.inItsOwnTransaction = new TransactionTemplate(transactions.getTransactionManager());
		this.inItsOwnTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
	}

	/**
	 * One ducat this reconciliation wrote.
	 *
	 * @param id      the row in {@code ducat_award}
	 * @param code    the family's code, {@code duk-sve-trke}
	 * @param season  empty for a ducat that stands for ever
	 * @param month   1 to 12, and empty unless the family repeats by month
	 */
	record Won(long id, String code, BigDecimal threshold, Integer season, Integer month, int tier) {
	}

	/** Reconciles one member in a transaction of its own, and answers only what it wrote. */
	List<Won> forMember(long competitorId) {
		return inItsOwnTransaction.execute(any -> reconcile(competitorId));
	}

	/** The same in the transaction it is called in, which is what {@link #forMember} opens. */
	List<Won> reconcile(long competitorId) {
		db.sql("select pg_advisory_xact_lock(hashtextextended(?, 0))::text")
				.param("ducats:" + competitorId)
				.query(String.class)
				.single();

		boolean there = db.sql("select 1 from competitor where id = ? for key share")
				.param(competitorId).query(Integer.class).optional().isPresent();

		if (!there) {
			return List.of();
		}

		Instant now = clock.instant();
		Plan plan = DucatReconciliation.of(families(), held(competitorId), runs(competitorId),
				seasonsHeld(competitorId), now.atZone(SeasonClock.ZONE).toLocalDate());

		for (long id : plan.toTakeAway()) {
			db.sql("delete from ducat_award a where a.id = ? and" + A_PERIOD_STILL_OPEN).param(id).update();
		}

		for (Rewrite one : plan.toRewrite()) {
			db.sql("update ducat_award a set result_id = ?, won_on = ?, reached = ? where a.id = ? and"
							+ A_PERIOD_STILL_OPEN)
					.params(one.crossing().resultId(), Date.valueOf(one.crossing().on()), one.crossing().reached(),
							one.id())
					.update();
		}

		List<Won> written = new ArrayList<>();

		for (Award one : plan.toWrite()) {
			db.sql("insert into ducat_award (competitor_id, ducat_id, awarded_at, kind, threshold, reached,"
							+ " period, season, month, tier, won_on, result_id)"
							+ " select :competitor, :ducat, :at, :kind, :threshold, :reached, :period,"
							+ " cast(:season as integer), cast(:month as smallint), :tier, :wonOn, :result"
							+ " where :period = 'always' or not exists"
							+ " (select 1 from season_frozen f where f.season = cast(:season as integer))"
							+ " on conflict do nothing"
							+ " returning id")
					.param("competitor", competitorId)
					.param("ducat", one.instance().ducatId())
					.param("at", Timestamp.from(now))
					.param("kind", one.instance().kind().code())
					.param("threshold", one.instance().threshold())
					.param("reached", one.crossing().reached())
					.param("period", one.instance().period().code())
					.param("season", one.instance().season())
					.param("month", one.instance().month())
					.param("tier", one.instance().tier())
					.param("wonOn", Date.valueOf(one.crossing().on()))
					.param("result", one.crossing().resultId())
					.query(Long.class)
					.optional()
					.ifPresent(id -> written.add(new Won(id, one.instance().code(), one.instance().threshold(),
							one.instance().season(), one.instance().month(), one.instance().tier())));
		}

		return List.copyOf(written);
	}

	private List<Family> families() {
		return db.sql("select id, code, kind, threshold, period, tier, step, last, tier_up_from from ducat order by id")
				.query((row, one) -> new Family(row.getLong(1), row.getString(2), DucatKind.named(row.getString(3)),
						row.getBigDecimal(4), Period.named(row.getString(5)), row.getInt(6), row.getBigDecimal(7),
						row.getBigDecimal(8), row.getBigDecimal(9)))
				.list();
	}

	private List<Held> held(long competitorId) {
		return db.sql("select id, ducat_id, kind, threshold, period, season, month, result_id, won_on, reached"
						+ " from ducat_award where competitor_id = ?")
				.param(competitorId)
				.query((row, one) -> new Held(row.getLong(1), row.getLong(2), DucatKind.named(row.getString(3)),
						row.getBigDecimal(4), Period.named(row.getString(5)), row.getObject(6, Integer.class),
						row.getObject(7, Integer.class), row.getObject(8, Long.class),
						row.getDate(9).toLocalDate(), row.getBigDecimal(10)))
				.list();
	}

	/**
	 * Every result of his, with the country its event was run in: through the codebook's town or the
	 * country typed beside a town that is not in it, the join {@link CalendarApi} reads it by. The schema
	 * names a country for every event (V7, the pair of checks on {@code btl_event}), so the case
	 * {@link DucatKind#COUNTRY_COUNT} refuses to count is not one this can produce.
	 */
	private List<Run> runs(long competitorId) {
		return db.sql("select r.id, r.race_date, r.category, coalesce(town_country.code, typed_country.code),"
						+ " r.distance_km, r.ascent_m, r.seconds, r.points"
						+ " from result r"
						+ " join race on race.id = r.race_id"
						+ " join btl_event e on e.id = race.event_id"
						+ " left join place town on town.id = e.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = e.country_id"
						+ " where r.competitor_id = ?")
				.param(competitorId)
				.query((row, one) -> new Run(row.getLong(1), new RaceDone(row.getDate(2).toLocalDate(),
						row.getString(3), row.getString(4), row.getBigDecimal(5), row.getInt(6), row.getLong(7),
						row.getBigDecimal(8))))
				.list();
	}

	private Set<Integer> seasonsHeld(long competitorId) {
		return new HashSet<>(db.sql("select season from membership where competitor_id = ?")
				.param(competitorId).query(Integer.class).list());
	}
}
