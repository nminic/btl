package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

/**
 * WHO SAID THEY ARE COMING, closed the way this portal closes a resource that members
 * read and a visitor does not: absence from {@link ApiSecurity#READ_BY_ANYBODY} rather
 * than a condition written into the handler. {@link CommentApi} closes
 * {@code /api/comments} the identical way, for the identical reason, about a
 * different resource.
 *
 * <p><b>Read by members and by nobody else.</b> The owner, 11.08.2026: „Tu listu ko je
 * prijavljen takođe vide samo ulogovani članovi" ({@code PDL.md:294}). A visitor sees
 * the calendar and its results; who plans to be at one of them he does not.
 *
 * <p><b>Enforced by NOT being enforced here.</b> Everything under {@code /api} is shut
 * and {@link ApiSecurity#READ_BY_ANYBODY} opens a few things by name; this route is
 * simply absent from it, so the chain answers 401 before this class ever runs. There is
 * no condition in here about who is asking.
 *
 * <p><b>And it needs no {@link RightIsNeeded}, the same decision and for the same
 * reason.</b> Reading who is going is not a moderator's action - every signed in
 * account reads this, a plain competitor included - so it is named in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT} rather than asking for a tick
 * nobody was ever going to be given.
 *
 * <p><b>ONLY A FUTURE EVENT, which is the noun the owner's decision is built on.</b>
 * „Prijavljen član najavljuje odlazak na BUDUĆI događaj" ({@code PDL.md:288}), and PDL
 * P10 has said from the start that saying so is „samo iskazana namera, ne obaveza" -
 * an intention, not a memory. {@code PDL.md:153} is the other half of the same sentence:
 * „DNF i nedolazak se ne evidentiraju", so the portal never turns an intention into a
 * record of what really happened. A row in {@code attending} does not delete itself the
 * day its event is run, so without this filter every event ever held would keep
 * answering with whoever last said they meant to go to it.
 *
 * <p><b>The boundary is the database's schema and not `current_date`, and for the
 * reason {@code WhatTimeItIs} gives: a server kept in UTC is still living in yesterday
 * for the first hour of a Belgrade day.</b> The clock is a bean so the one day this
 * class is about - the day an event stops being future - can be measured on a chosen
 * date instead of waiting for the calendar to cross it, the same shape
 * {@code ResultApi} already reads the running season by.
 *
 * <p><b>The frontend already draws this exact boundary, one field away.</b>
 * {@code GoingToEvent.tsx}: „if (event.date &lt; today) return null" - hides the whole
 * section, switch and list together, the moment an event is no longer future. This
 * query answers the same question so that a caller which is not that screen gets the
 * same list a member would see drawn. Both read `>=`, so an event running today is
 * still future for this purpose - a member can still say they are coming to something
 * that has not finished being run.
 *
 * <p><b>AND WITHOUT A MEMBERSHIP IN GOOD STANDING, AN INTENTION DOES NOT COME OUT OF
 * HERE EITHER - the fourth time this exact class of leak has been named, after pairs,
 * results and comments, all on 13.09.2026.</b> {@code PairApi}: „Ne postoji par onda,
 * raskida se" excludes both halves of a pair the same way; {@code CommentApi}
 * ({@code b53-komentari}, PR 278) withholds only the number, because a comment carries
 * a name to keep beside it ({@code who}, V7's tombstone). {@code attending} carries no
 * such second field -
 * {@code ADL.md} measured it directly: „attendance.json | 28 | 2 | nema ključ | tabela
 * attending; samo par (eventId, memberNumber)" - so there is nothing here for a lapsed
 * member's row to survive as. Leaving the bare number in would do exactly what
 * {@code PairApi} already refuses: a number that leaves THIS answer and not
 * {@code /api/competitors} names, through the DIFFERENCE between the two rather than
 * through any field in either, the one thing Article 74 puts beside the date of birth -
 * „sve u vezi sa članarinom" ({@code ADL.md} P-javno, 13.09.2026, naming „prisustvo"
 * among the seven resources that rule covers by name). So the row is left out whole,
 * not half-answered: there is no partial shape between "in" and "out" for a pair this
 * bare.
 *
 * <p><b>What the file the portal serves TODAY carries is not read as a floor for
 * this.</b> {@code mock/attendance.json} still names member {@code 000032} (whose fee
 * has lapsed) and {@code 999999} (no competitor by that number exists at all) against
 * the same event - prototype fixtures older than the decision above, not a
 * requirement it has to keep meeting. Mock data is temporary and is never imported
 * (`CLAUDE.md`); the frontend that reads that file is not switched to this endpoint by
 * this increment (A50: the portal changes files once, together, when every resource
 * exists), so nothing wired today reads what this class answers with.
 *
 * <p><b>Nor does a departed member need a tombstone the way a comment does.</b> Both
 * of {@code attending}'s foreign keys are {@code on delete cascade} - an intention
 * about a member who no longer exists in the record is nothing, and the row is gone
 * with him. A member whose fee merely lapsed is not this case: his row in
 * {@code competitor} stays, and the paragraph above is what keeps his intention from
 * answering.
 *
 * <p><b>And the name is never a question this class can get wrong, because
 * {@code attending} does not carry one.</b> Unlike {@code event_comment.who}, there is
 * no column here to read a name off besides the join to {@code competitor} - the only
 * source {@code memberNumber} could come from is {@code competitor.member_number},
 * because no second source exists to disagree with it.
 *
 * <p><b>The shapes are the schema's, not the file's</b> - the same decision
 * {@code CalendarApi} already took on 12.09.2026: {@code eventId} answers with
 * {@code btl_event.id}, a {@code bigserial}, and not with the text slugs
 * ({@code evt-beogradski-maraton-2027-04-03}) the prototype file used before a
 * schema existed to answer from.
 *
 * <p><b>In event order, and within an event by member number</b> - the last tie-break
 * so the order is total, the same shape {@code PairApi} orders by season and then by
 * the man's number. Nothing downstream depends on this order today (the screen that
 * will draw it sorts its own copy by surname), but a list with no settled order is a
 * list that can reshuffle between two readings of data nobody touched, and every other
 * resource in this package decides one.
 */
@RestController
class AttendanceApi {

	private final JdbcClient db;

	private final Clock clock;

	AttendanceApi(JdbcClient db, Clock clock) {
		this.db = db;
		this.clock = clock;
	}

	record Attendance(long eventId, String memberNumber) {
	}

	@GetMapping("/api/attendance")
	List<Attendance> attendance() {
		return db.sql("select a.event_id, c.member_number"
						+ " from attending a"
						/* INNER, safely: both of attending's foreign keys are `on delete
						   cascade`, so a row here always names an event and a competitor
						   that still exist. */
						+ " join btl_event e on e.id = a.event_id"
						+ " join competitor c on c.id = a.competitor_id"
						/* ONLY A FUTURE EVENT (PDL.md:288, „budući događaj"), read in the
						   league's own time and not the server's. */
						+ " where e.date >= :today"
						/* AND ONLY A MEMBERSHIP IN GOOD STANDING, for the reason PairApi
						   already refuses the same leak: a number that left here and not
						   /api/competitors would name, by subtraction, whoever has not
						   renewed. */
						+ " and c.active"
						+ " order by a.event_id, c.member_number")
				.param("today", LocalDate.now(clock.withZone(SeasonClock.ZONE)))
				.query((row, one) -> new Attendance(row.getLong(1), row.getString(2)))
				.list();
	}
}
