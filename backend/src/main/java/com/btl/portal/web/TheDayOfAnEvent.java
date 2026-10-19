package com.btl.portal.web;

import com.btl.portal.domain.event.EventAddress;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Optional;

/**
 * THE EVENT'S DAY IS THE DAY OF ITS FIRST RACE, AND THE ADDRESS MOVES WITH THE YEAR OF THAT DAY.
 *
 * <p>Owner, 10.08.2026: „Datum dogadjaja nije zaseban podatak nego dan prve trke ... Trka uneta ili
 * pomerena na raniji dan ne pravi gresku: dogadjaj tog trenutka pocinje ranije i njegov datum je
 * taj dan", and, 19.10.2026, of the race a moderator adds to an event together with a member's
 * result (PDL P9, „Datum trke na događaju"): „ako pomerim datum trke unutar dogadjaja na ranije,
 * menja se i njemu datum. Ne moze poceti trka pre dogadjaja na kojem je".
 *
 * <p><b>Why this is a class of its own and not {@link RaceWriteApi}'s private methods, which is
 * what it was until 19.10.2026.</b> Two writers now put a race under an event that is already
 * there: the administration through {@code POST /api/races}, and the approval of a member's run
 * on a race the calendar does not hold, which since the owner's choice of 19.10.2026 puts its race
 * on an existing event instead of refusing (PDL P9, „Nova trka na postojećem događaju"). Both have
 * to ask the same three things in the same order - which day the event will begin on, which address
 * that day gives it, and writing the two down - and a second copy of them in
 * {@link VerificationWriteApi} would be a second home of one rule (ADL A31). So they moved here, word
 * for word, and both callers ask them of this class. Moved and not changed: the cases of
 * {@code RaceWriteApiTest} and {@code TheEventBeginsWithItsFirstRaceTest} hold what they did.
 *
 * <p>Static over a {@link JdbcClient} the caller hands in, the shape
 * {@link EventWriteApi#addressIsTakenBySomebodyElse} already has: every caller is inside a
 * transaction of its own, and a bean here would be a second object holding the same connection.
 */
final class TheDayOfAnEvent {

	/** The event a race hangs off, as it stands before the write decides its day. */
	record Standing(long id, String slug, String name, LocalDate date, String kind) {
	}

	private TheDayOfAnEvent() {
	}

	/**
	 * THE DAY THE EVENT WILL BEGIN ON ONCE THIS WRITE HAS LANDED.
	 *
	 * <p>Worked out BEFORE anything is written, which is the same order
	 * {@link EventWriteApi#change} keeps and for the same reason: the address is built out
	 * of this day and may be refused, and a refusal that had already written half of itself
	 * would answer 409 and leave the calendar changed.
	 *
	 * <p>{@code exceptRace} is the race this request is changing or taking away, so what is
	 * asked of the table is the races that will still be there. It is null for a race being
	 * entered, since there is nothing yet to leave out - asked as
	 * {@code id is distinct from null}, which every existing row satisfies, rather than
	 * through a key no row is supposed to hold.
	 *
	 * @param andThisRace the day the race will run on, or null where it is being deleted
	 */
	static LocalDate theDayItWillBeginOn(JdbcClient db, Standing event, Long exceptRace,
			LocalDate andThisRace) {
		/* The earliest morning as a ROW rather than as `min(date)`, so that "no race at
		   all" is no row instead of one row holding null: the two read alike through a
		   mapper and only one of them is a day. */
		Optional<LocalDate> others = db.sql("select date from race"
						+ " where event_id = ? and id is distinct from cast(? as bigint)"
						+ " order by date limit 1")
				.params(event.id(), exceptRace)
				.query((row, one) -> row.getDate(1).toLocalDate())
				.optional();

		/* THE LAST RACE TAKEN AWAY LEAVES THE DAY WHERE IT IS, for the reason the javadoc of
		   RaceWriteApi gives: „dan prve trke" has no answer where there is no race, the column
		   is NOT NULL, and an event with no race and a day of its own is the ordinary shape
		   a gathering already has. */
		if (andThisRace == null) {
			return others.orElse(event.date());
		}

		return others.filter(day -> day.isBefore(andThisRace)).orElse(andThisRace);
	}

	/**
	 * The address that event answers at once it begins on that day.
	 *
	 * <p>The SAME NAME on both sides, which is the whole of it: a race cannot rename an
	 * event, so the only thing that can move the address is the year. Asked this way the
	 * rule keeps an imported address carrying a month ({@code gradska-liga-usce-2017-05}),
	 * which no rule here could rebuild and everything joined to it is joined through.
	 */
	static String addressFor(Standing event, LocalDate beginning) {
		return EventAddress.keptOrRebuilt(event.name(), beginning,
				event.name(), event.date(), event.slug());
	}

	/** And writing that day and that address down, which is the one place either is set. */
	static void theEventNowBeginsOn(JdbcClient db, Standing event, LocalDate beginning,
			String address) {
		db.sql("update btl_event set date = ?, slug = ? where id = ?")
				.params(beginning, address, event.id())
				.update();
	}

	static Optional<Standing> theEvent(JdbcClient db, long id) {
		return db.sql("select id, slug, name, date, kind from btl_event where id = ?")
				.param(id).query(TheDayOfAnEvent::standing).optional();
	}

	static Optional<Standing> theEventOfTheRace(JdbcClient db, long race) {
		return db.sql("select e.id, e.slug, e.name, e.date, e.kind from race r"
						+ " join btl_event e on e.id = r.event_id where r.id = ?")
				.param(race).query(TheDayOfAnEvent::standing).optional();
	}

	/**
	 * THE EVENT, AND HELD FOR THIS WRITE UNTIL IT COMMITS ({@code for update}), for a writer that
	 * asked about the event before it began to write and must not write over a change made since.
	 *
	 * <p>Asked by {@link VerificationWriteApi} and not by {@link RaceWriteApi}, which reads the
	 * event plainly and writes in the same breath. The approval asks its questions before it
	 * claims the row and writes after, so between the two another writer can delete the event, or
	 * put a race on it that moves its day: held, the event is read again after that writer has
	 * committed, and what it reads is what the day and the address are worked out from. Unheld, a
	 * deleted event would reach the approval as {@code race_event_fk} and a 500, and two races put
	 * on one event at once would each set its day without seeing the other's.
	 */
	static Optional<Standing> theEventHeldForThisWrite(JdbcClient db, long id) {
		return db.sql("select id, slug, name, date, kind from btl_event where id = ? for update")
				.param(id).query(TheDayOfAnEvent::standing).optional();
	}

	/**
	 * THE EVENT THAT ANSWERS AT AN ADDRESS, which is how an approval finds the event a name and a
	 * year already belong to (PDL P9, owner, 19.10.2026, „Isti naziv ne pravi drugi događaj").
	 *
	 * <p>By the address and not by the name, because the address is what is unique
	 * ({@code btl_event_slug_unique}) and what the decision of 10.10.2026 already called the same
	 * event: the name and the year, so a name spelt with letters the address does not keep is the
	 * same event, and the same name in another year is another one.
	 */
	static Optional<Standing> theEventAt(JdbcClient db, String address) {
		return db.sql("select id, slug, name, date, kind from btl_event where slug = ?")
				.param(address).query(TheDayOfAnEvent::standing).optional();
	}

	/** One home for reading an event's standing, since three questions ask for it. */
	private static Standing standing(ResultSet row, int one) throws SQLException {
		return new Standing(row.getLong(1), row.getString(2), row.getString(3),
				row.getDate(4).toLocalDate(), row.getString(5));
	}
}
