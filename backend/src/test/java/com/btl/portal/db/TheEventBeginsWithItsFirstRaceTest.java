package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The rule V29 puts under the two tables: an event that has races begins on the first of
 * their days, and no statement may leave it saying anything else.
 *
 * <p><b>PDL P35, owner, 21.09.2026:</b> „Dogadjaj se zavodi kao PRVI od dana njegovih trka
 * ... To nije podatak nego IZVEDENA cinjenica. Ne moze da se razidje sa trkama." Both
 * writing routes already obeyed it and their own cases measure that they do; what is
 * measured here is the half no route can be asked about, which is what happens when
 * something else writes.
 *
 * <p><b>WHY THE FIXTURE ENDS BY SAYING {@code set constraints all immediate}, and it is not
 * ceremony.</b> The rule is DEFERRABLE INITIALLY DEFERRED, so it asks its question at
 * COMMIT; this class, like every {@link DatabaseTest}, runs in a transaction that is rolled
 * back and therefore never commits. Without that statement the rule would never speak here
 * and every case below would pass against a database with V29 deleted. Said once at the end
 * of the fixture, it also leaves the rule immediate for the rest of the case, so what
 * refuses a case is that case's own statement and the name in the message means something.
 *
 * <p><b>And the deferral itself is measured rather than assumed</b>, in
 * {@link #theDayAndTheRacesMayDisagreeBetweenTwoStatementsOfOneChange()}, which asks for it
 * back: the event route writes the new day and THEN moves the races, so a rule checked at
 * the end of each statement would refuse the portal's own behaviour.
 *
 * <p><b>The refusals are told apart by the day they name and not only by the trigger.</b>
 * Two of the cases below move a race between events and both are refused by the same
 * trigger, so the name alone would let either of them pass for the other; what separates
 * them is which event is reported as beginning on which morning.
 */
class TheEventBeginsWithItsFirstRaceTest extends DatabaseTest {

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String ON_RACE = "race_leaves_its_event_beginning_on_its_first_race";

	private static final String ON_EVENT = "btl_event_begins_with_its_first_race";

	/** Two mornings, so the first race is not the only one and moving it is a real move. */
	private static final String OVER_TWO_MORNINGS = "prvi-2027";

	/** Two races on the earliest morning and one after, which is the axis nothing else holds. */
	private static final String TWO_ON_THE_FIRST_MORNING = "blizanci-2027";

	/**
	 * An event that begins BEFORE every other, so a race moved into it moves nothing.
	 *
	 * <p>It exists for one case, and for the reason that case would otherwise measure two
	 * things at once: a race moved to an event that it would make begin earlier breaks the
	 * rule at BOTH ends, and a refusal then says nothing about which end was asked.
	 */
	private static final String EARLIEST_OF_ALL = "rano-2027";

	/** A race event with no race under it yet, which is what {@code EventWriteApi.add} writes. */
	private static final String NO_RACE_AT_ALL = "bez-trka-2027";

	@BeforeEach
	void aCalendarWithMoreThanOneShapeInIt() {
		event(OVER_TWO_MORNINGS, "2027-03-01");
		race(OVER_TWO_MORNINGS, "Prva jutarnja", "2027-03-01");
		race(OVER_TWO_MORNINGS, "Prva popodnevna", "2027-03-02");

		event(TWO_ON_THE_FIRST_MORNING, "2027-09-03");
		race(TWO_ON_THE_FIRST_MORNING, "Blizanka jedna", "2027-09-03");
		race(TWO_ON_THE_FIRST_MORNING, "Blizanka druga", "2027-09-03");
		race(TWO_ON_THE_FIRST_MORNING, "Sutradan", "2027-09-05");

		event(EARLIEST_OF_ALL, "2027-01-05");
		race(EARLIEST_OF_ALL, "Zimska", "2027-01-05");

		event(NO_RACE_AT_ALL, "2027-08-08");

		/* THE QUEUE IS DRAINED HERE AND NOT INSIDE EACH CASE, and it was written the other
		   way round first. `set constraints all immediate` fires every trigger event the
		   transaction has queued, and the writes above queue nine of them; asked after a
		   case's own statement, the first one to speak was one of THOSE, so a case about the
		   event's day was refused by the trigger on `race` and its name meant nothing.
		   Draining here empties that queue - which is also the only thing that says the
		   fixture itself agrees with the rule - and leaves the rule immediate, so what
		   refuses a case below is that case's own statement. */
		askNow();
	}

	/**
	 * THE CONTROL, AND IT COMES FIRST BECAUSE EVERY OTHER CASE LEANS ON IT.
	 *
	 * <p>A transaction that changes nothing, asked the question anyway. If this ever refused,
	 * every refusal below would be evidence of nothing but a rule that refuses everything,
	 * and the whole file would be green for the wrong reason.
	 */
	@Test
	void aChangeThatMovesNothingIsNotRefused() {
		db.sql("update btl_event set date = date where slug = ?").param(OVER_TWO_MORNINGS).update();

		askNow();

		assertThat(dayOf(OVER_TWO_MORNINGS)).isEqualTo("2027-03-01");
	}

	/**
	 * MOVING THE EVENT AND LEAVING ITS RACES WHERE THEY WERE IS REFUSED.
	 *
	 * <p>This is the statement {@code EventWriteApi.change} would be if the line that moves
	 * the races by the same number of days were taken out of it, and it is the reason this
	 * rule is in the schema rather than in that method: the route is not the only hand that
	 * can write this column.
	 */
	@Test
	void theDayMayNotMoveAwayFromTheRacesThatAreStillThere() {
		assertThatThrownBy(() -> db.sql("update btl_event set date = date '2027-03-08'"
						+ " where slug = ?").param(OVER_TWO_MORNINGS).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(ON_EVENT)
				.hasMessageContaining("begins on 2027-03-08")
				.hasMessageContaining("runs on 2027-03-01");
	}

	/**
	 * AND SO IS A RACE MOVED ONTO AN EARLIER MORNING WITHOUT THE EVENT FOLLOWING IT.
	 *
	 * <p>The other trigger and the other direction. Owner, 10.08.2026: „Trka uneta ili
	 * pomerena na raniji dan ne pravi gresku: dogadjaj tog trenutka pocinje ranije i njegov
	 * datum je taj dan."
	 */
	@Test
	void aRaceMayNotRunBeforeTheDayItsEventBeginsOn() {
		assertThatThrownBy(() -> db.sql("update race set date = date '2027-02-25'"
						+ " where name = 'Prva jutarnja'").update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(ON_RACE)
				.hasMessageContaining("runs on 2027-02-25");
	}

	/**
	 * AND A RACE WRITTEN, NOT MOVED, ON A MORNING BEFORE ITS EVENT BEGINS.
	 *
	 * <p><b>This is the arm of the rule the portal will meet most often, and it had no case
	 * until an independent review measured that taking {@code insert} out of the trigger left
	 * the whole suite green.</b> ADL A59 says the calendar's own rows arrive by a script
	 * writing against the live database, so a plain INSERT is how nearly every row of
	 * `btl_event` and `race` on QA was made; and the script that splits RijekaRun into three
	 * events writes two of them the same way. The hand the rule exists for is usually this
	 * one.
	 *
	 * <p>The later race is written FIRST and on purpose. It is the control inside the case: a
	 * trigger that refused every insert under an event would pass the second half on its own,
	 * and then this would say nothing about the direction.
	 */
	@Test
	void aRaceWrittenBeforeTheDayItsEventBeginsOnIsRefused() {
		race(OVER_TWO_MORNINGS, "Nova kasna", "2027-03-05");

		assertThat(daysOfRacesOn(OVER_TWO_MORNINGS))
				.as("a race written after the event began was refused, so what follows measures"
						+ " inserting rather than the day it was inserted on")
				.containsExactly("2027-03-01", "2027-03-02", "2027-03-05");

		assertThatThrownBy(() -> race(OVER_TWO_MORNINGS, "Nova rana", "2027-02-20"))
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(ON_RACE)
				.hasMessageContaining("begins on 2027-03-01")
				.hasMessageContaining("runs on 2027-02-20");
	}

	/**
	 * AND SO IS THE FIRST RACE MOVED AWAY WITHOUT THE EVENT FOLLOWING IT, which is the same
	 * sentence with no direction in it.
	 *
	 * <p>Separated from the case above because the two fail differently in a rule written
	 * with a comparison that has a side: „earlier than" catches one of them and „is not"
	 * catches both, and the owner's word is „uvek".
	 */
	@Test
	void theFirstRaceMayNotMoveAwayAndLeaveTheEventBehindIt() {
		assertThatThrownBy(() -> db.sql("update race set date = date '2027-03-03'"
						+ " where name = 'Prva jutarnja'").update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(ON_RACE)
				.hasMessageContaining("runs on 2027-03-02");
	}

	/**
	 * A RACE TAKEN AWAY THAT WAS THE ONLY ONE ON THE FIRST MORNING TAKES THE DAY WITH IT.
	 *
	 * <p>Which is the delete half, and the one {@code RaceWriteApi} answers with the day it
	 * works out. Here nothing works anything out, so the row is left disagreeing and the rule
	 * has to say so.
	 */
	@Test
	void deletingTheOnlyRaceOfTheFirstMorningLeavesTheEventNowhere() {
		assertThatThrownBy(() -> db.sql("delete from race where name = 'Prva jutarnja'").update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(ON_RACE)
				.hasMessageContaining("runs on 2027-03-02");
	}

	/**
	 * BUT TWO RACES ON THE FIRST MORNING AND ONE OF THEM TAKEN AWAY MOVE NOTHING.
	 *
	 * <p><b>This is the axis nothing in the portal measured before today.</b> The event runs
	 * two races on 03.09 and one on 05.09; taking one of the two away leaves 03.09 still the
	 * first morning, so the day must stay exactly where it is and the rule must not fire.
	 *
	 * <p><b>What breaks it, measured: a rule that makes the day MOVE whenever a race running
	 * on it is taken away</b> ({@code if tg_op = 'DELETE' and begun = old.date then raise}).
	 * That is the confusion this axis exists for - „the race on the event's day is gone" and
	 * „the event's first morning is gone" are the same sentence until two races share that
	 * morning - and it is a rule the fixture survives, so it reaches this case.
	 *
	 * <p><b>The one-token version does NOT reach it, and saying otherwise was wrong.</b>
	 * Turning {@code min} into {@code max} refuses the fixture itself, fourteen errors before
	 * any case runs, so it proves nothing about this one. The sentence that stood here
	 * claimed that mutation; an independent review measured it and it did not hold.
	 *
	 * <p>The other half is the case below, so that this one cannot pass by the rule being
	 * asleep.
	 */
	@Test
	void deletingOneOfTwoRacesOnTheFirstMorningLeavesTheDayAlone() {
		db.sql("delete from race where name = 'Blizanka jedna'").update();

		askNow();

		assertThat(dayOf(TWO_ON_THE_FIRST_MORNING))
				.as("the day moved although a race is still run on it")
				.isEqualTo("2027-09-03");
	}

	/** And taking BOTH of them away does move it, which is what says the case above measures. */
	@Test
	void deletingBothRacesOfTheFirstMorningLeavesTheEventNowhere() {
		assertThatThrownBy(() -> db.sql("delete from race"
						+ " where name in ('Blizanka jedna', 'Blizanka druga')").update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(ON_RACE)
				.hasMessageContaining("runs on 2027-09-05");
	}

	/**
	 * AN EVENT WITH NO RACE AT ALL MAY CARRY AND CHANGE ANY DAY, AND IT IS A RACE.
	 *
	 * <p>„Dan prve trke" has no answer where there is no race. The exemption is therefore the
	 * ABSENCE of races and not a kind of event, and the fixture is deliberately a
	 * {@code race}: read off {@code kind}, this row would be refused, and it is the ordinary
	 * shape {@code EventWriteApi.add} writes before the first race exists under it.
	 *
	 * <p><b>The mutation this is written against</b> is one operator wide: V29 asks
	 * {@code earliest <> begun} over a {@code min} that answers NULL where there is no race,
	 * and {@code is distinct from} in its place refuses this row. Dropping the
	 * {@code earliest is not null} guard instead changes nothing, and that is written down
	 * rather than left to be rediscovered: it is not what this case measures.
	 */
	@Test
	void anEventWithNoRaceAtAllMayCarryAnyDay() {
		db.sql("update btl_event set date = date '2027-08-09' where slug = ?")
				.param(NO_RACE_AT_ALL).update();

		askNow();

		assertThat(db.sql("select kind from btl_event where slug = ?").param(NO_RACE_AT_ALL)
				.query(String.class).single())
				.as("the fixture is not a race, so this says nothing about reading `kind`")
				.isEqualTo("race");
		assertThat(dayOf(NO_RACE_AT_ALL)).isEqualTo("2027-08-09");
	}

	/**
	 * AND AN EVENT LEFT WITH NO RACE KEEPS THE DAY IT HAS.
	 *
	 * <p>The same exemption from the other end, and the boundary {@code RaceWriteApi} already
	 * decided: the column is NOT NULL so nothing can be cleared, and today's date would file
	 * the event on a morning nothing has to do with it. Owner, 23.08.2026: „Skupovi ostaju
	 * jedini dogadjaji bez trka" - a row in that shape is an ordinary one.
	 */
	@Test
	void anEventWhoseLastRaceIsDeletedKeepsTheDayItHas() {
		db.sql("delete from race where event_id = (select id from btl_event where slug = ?)")
				.param(EARLIEST_OF_ALL).update();

		askNow();

		assertThat(dayOf(EARLIEST_OF_ALL))
				.as("an event with no race left was refused, or its day was moved by something")
				.isEqualTo("2027-01-05");
	}

	/**
	 * DELETING THE WHOLE EVENT TAKES ITS RACES AND SAYS NOTHING.
	 *
	 * <p>{@code race_event_fk} cascades, so this fires the rule once for every race of an
	 * event that is no longer there to be asked about, and the owner's one action -
	 * „Dogadjaj se brise, sa svim svojim trkama" (03.08.2026) - must not become a server
	 * fault.
	 *
	 * <p><b>WHAT BREAKS IT, measured, and it is one thing: a rule that treats an event it
	 * cannot find as a fault.</b> Written into V29 as {@code if begun is null then raise},
	 * this case is the only one of the fifteen that falls. That shape is not far-fetched -
	 * it is what V29's own first draft nearly was, and what anybody adding a branch „just in
	 * case the event is missing" would write. The rule says nothing instead, because by the
	 * time it is asked the races are gone too, so the earliest day is NULL and the exemption
	 * answers for both.
	 *
	 * <p><b>And three things that do NOT break it, each written down because each was claimed
	 * here before it was measured.</b> Removing the exemption leaves this green (it falls on
	 * the two cases about an event with no races). Taking the day off {@code OLD} rather than
	 * off the table leaves this green as well, and falls on the two about a race deleted off
	 * the first morning. And a rule asked BEFORE the delete cannot be written at all:
	 * {@code create constraint trigger ... before ...} is a syntax error in PostgreSQL 18.
	 * The sentence that stood here named all three and was wrong about all three.
	 */
	@Test
	void deletingTheEventWithItsRacesIsNotRefused() {
		db.sql("delete from btl_event where slug = ?").param(OVER_TWO_MORNINGS).update();

		askNow();

		assertThat(db.sql("select count(*) from btl_event where slug = ?").param(OVER_TWO_MORNINGS)
				.query(Long.class).single()).isZero();
	}

	/**
	 * A RACE MOVED TO ANOTHER EVENT IS ASKED ABOUT THE ONE IT LEFT.
	 *
	 * <p>Nothing in the portal moves a race between events and {@code RaceWriteApi} refuses
	 * it in as many words, so this is exactly the hand the rule exists for.
	 *
	 * <p><b>The event it arrives at is chosen so that it stays right</b>, which is what makes
	 * this case about the row that was abandoned rather than about the write in general:
	 * {@code rano-2027} begins on 05.01 and nothing moved into March makes it begin any
	 * earlier. What is refused is therefore the event whose only first-morning race left.
	 */
	@Test
	void aRaceThatLeavesAnEventIsMissedByTheEventItLeft() {
		assertThatThrownBy(() -> db.sql("update race set event_id ="
						+ " (select id from btl_event where slug = ?) where name = 'Prva jutarnja'")
				.param(EARLIEST_OF_ALL).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(ON_RACE)
				.hasMessageContaining("begins on 2027-03-01")
				.hasMessageContaining("runs on 2027-03-02");
	}

	/**
	 * AND ABOUT THE ONE IT ARRIVED AT.
	 *
	 * <p>The other half, separated the same way and in the other direction: the race that
	 * moves is NOT the first morning of the event it leaves, so that event stays right, and
	 * the only thing this can be refused for is the event it lands on. Without the two cases
	 * apart, a rule that asked about one of the two events would pass for both.
	 */
	@Test
	void aRaceThatArrivesAtAnEventIsMissedByTheEventItArrivedAt() {
		assertThatThrownBy(() -> db.sql("update race set event_id ="
						+ " (select id from btl_event where slug = ?) where name = 'Prva popodnevna'")
				.param(TWO_ON_THE_FIRST_MORNING).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(ON_RACE)
				.hasMessageContaining("begins on 2027-09-03")
				.hasMessageContaining("runs on 2027-03-02");
	}

	/**
	 * THE DAY AND THE RACES MAY DISAGREE BETWEEN TWO STATEMENTS OF ONE CHANGE.
	 *
	 * <p><b>This is why the rule is deferred, and it is the portal's own behaviour rather
	 * than a hypothetical.</b> {@code EventWriteApi.change} writes the event's new day first
	 * and moves the races by the same number of days second (owner, 10.08.2026), so after the
	 * first of those two statements the event and its races genuinely disagree. A rule asked
	 * at the end of each statement refuses that route; asked at the end of the change, it
	 * lets it through.
	 *
	 * <p><b>WHAT THIS CASE DOES NOT HOLD, and it was found by running the mutation rather
	 * than by reading it.</b> It asks for the deferral out loud, because the fixture above
	 * leaves the rule immediate; and {@code SET CONSTRAINTS ALL DEFERRED} defers a rule
	 * declared {@code INITIALLY IMMEDIATE} just as happily. So this measures that the rule is
	 * DEFERRABLE and says nothing about which way it is declared - V29 was run with
	 * {@code initially immediate} in it and this case passed. What the routes rely on is the
	 * DECLARATION, since neither of them says {@code SET CONSTRAINTS} at all, and that is
	 * held one case down, by asking the catalogue.
	 */
	@Test
	void theDayAndTheRacesMayDisagreeBetweenTwoStatementsOfOneChange() {
		db.sql("set constraints all deferred").update();

		db.sql("update btl_event set date = date '2027-03-08' where slug = ?")
				.param(OVER_TWO_MORNINGS).update();
		db.sql("update race set date = date + 7 where event_id ="
						+ " (select id from btl_event where slug = ?)")
				.param(OVER_TWO_MORNINGS).update();

		askNow();

		assertThat(daysOfRacesOn(OVER_TWO_MORNINGS)).containsExactly("2027-03-08", "2027-03-09");
		assertThat(dayOf(OVER_TWO_MORNINGS)).isEqualTo("2027-03-08");
	}

	/**
	 * AND BOTH TRIGGERS ARE DEFERRED BY DECLARATION, NOT BY WHOEVER WRITES.
	 *
	 * <p><b>This case exists because the one above turned out not to hold it.</b> Neither
	 * route says {@code SET CONSTRAINTS}: they simply write their two statements and commit,
	 * so what decides whether the portal works is the mode V29 DECLARES. A behaviour case
	 * cannot reach that, because to reproduce the route's window it has to ask for deferral
	 * itself, and asking defers an {@code INITIALLY IMMEDIATE} rule just the same.
	 *
	 * <p>So it is asked of the catalogue instead, which is the one place that knows what was
	 * declared rather than what this transaction has been told. {@code condeferrable} false
	 * fails here and so does {@code condeferred} false, and either of them refuses every
	 * change the portal makes to an event's day.
	 *
	 * <p>The names are written out rather than counted, and the floor under that list is
	 * {@code AxisConstraintsTest.everyConstraintOnTheSixTablesHasARowThatBreaksIt}: a third
	 * trigger added to either table fails there for want of a row that breaks it.
	 */
	@Test
	void bothTriggersAreDeferredByDeclarationAndNotByWhoeverAsks() {
		assertThat(db.sql("select con.conname || ' ' || con.condeferrable || ' ' || con.condeferred"
						+ " from pg_constraint con"
						+ " where con.conname in (?, ?) order by con.conname")
				.params(ON_EVENT, ON_RACE).query(String.class).list())
				.as("a rule the portal's own two-statement writes depend on is declared immediate,"
						+ " or is not deferrable at all, or is not there")
				.containsExactly(ON_EVENT + " true true", ON_RACE + " true true");
	}

	/**
	 * Ask the question now rather than at a commit this class never reaches.
	 *
	 * <p>Named for what it does to the reader: everything above writes first and asks after,
	 * which is the shape of the rule itself.
	 */
	private void askNow() {
		db.sql("set constraints all immediate").update();
	}

	private String dayOf(String slug) {
		return db.sql("select date::text from btl_event where slug = ?").param(slug)
				.query(String.class).single();
	}

	private List<String> daysOfRacesOn(String slug) {
		return db.sql("select r.date::text from race r join btl_event e on e.id = r.event_id"
						+ " where e.slug = ? order by r.date")
				.param(slug).query(String.class).list();
	}

	private void event(String slug, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', " + A_TOWN + ", null, null, 'race',"
						+ " false, '', '')")
				.params(slug, "Dogadjaj " + slug).update();
	}

	private void race(String eventSlug, String name, String day) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false, date '"
						+ day + "', 'length', 0, 10.00, 0, 0)")
				.params(eventSlug, name).update();
	}
}
