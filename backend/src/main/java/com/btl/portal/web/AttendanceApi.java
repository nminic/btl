package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

/**
 * WHO SAID THEY ARE COMING, closed in two steps: a visitor by the chain, and anybody signed
 * in who is neither an active member nor the administration by this class.
 *
 * <p><b>Read by active members and by the administration, and by nobody else, since
 * 03.10.2026.</b> The owner, 11.08.2026: „Tu listu ko je prijavljen takođe vide samo ulogovani
 * članovi" (PDL P6, „Spisak najavljenih vide samo prijavljeni"), narrowed on 03.10.2026 by his
 * choice between offered outcomes, which PDL records as „Najavu dolaska daju i spisak
 * najavljenih vide aktivni članovi (važeća članarina), a spisak vidi i administracija" (the
 * record's sentence, not his own words). A visitor sees the calendar and its
 * results; who plans to be at one of them he does not, and since that day neither does somebody
 * whose fee has lapsed, somebody who registered and never paid, or an account that races for
 * nobody unless it is the administration.
 *
 * <p><b>The visitor is still the chain's.</b> Everything under {@code /api} is shut and
 * {@link ApiSecurity#READ_BY_ANYBODY} opens a few things by name; this route is simply absent
 * from it, so the chain answers 401 before this class ever runs, which is how
 * {@link CommentApi} closes {@code /api/comments}. <b>The rest is asked here</b>, of
 * {@link ActiveMemberOrAdministration}, and the refusal is the 404 an address that maps
 * nothing answers, sent through {@code sendError} the way {@link InboxApi} refuses an account
 * that names no member: ADL A8, „prijavljen kome pravo nedostaje dobija 404".
 *
 * <p><b>And it needs no {@link RightIsNeeded}.</b> Reading who is going is not a moderator's
 * action and there is no box a superadmin ticks for it: it comes with being a member in good
 * standing, or with being the administration at all, so it is named in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT} rather than asking for a tick nobody was
 * ever going to be given.
 *
 * <p><b>The answer is the same list to everybody who may read it, the administration
 * included.</b> Who may read is the one thing that differs by reader; what they read does not,
 * so the paragraph below about a lapsed membership holds for a moderator too. That is this
 * class's reasoning and not a recorded decision: nothing the owner said gives the
 * administration a wider list, and a second shape of the same answer would be a second thing
 * to keep right.
 *
 * <p><b>ONLY A FUTURE EVENT, which is the noun the owner's decision is built on.</b>
 * „Prijavljen član najavljuje odlazak na BUDUĆI događaj" (PDL P6, 11.08.2026, „Prijavljen član
 * najavljuje odlazak na budući"), and PDL P10 has said from the start that saying so is „samo
 * iskazana namera, ne obaveza" - an intention, not a memory. PDL P5, „DNF i nedolazak se ne
 * evidentiraju" is the other half of the same sentence: „DNF i nedolazak se ne evidentiraju", so
 * the portal never turns an intention into a record of what really happened. A row in {@code
 * attending} does not delete itself the day its event is run, so without this filter every event
 * ever held would keep answering with whoever last said they meant to go to it.
 *
 * <p><b>The boundary is the database's schema and not `current_date`, and for the
 * reason {@code WhatTimeItIs} gives: a server kept in UTC is still living in yesterday
 * for the first hour of a Belgrade day.</b> The clock is a bean so the one day this
 * class is about - the day an event stops being future - can be measured on a chosen
 * date instead of waiting for the calendar to cross it, the same shape
 * {@code ResultApi} already reads the running season by.
 *
 * <p><b>ONE BOUNDARY FOR THE LIST AND FOR THE WRITE, AND IT IS {@link #STILL_AHEAD}.</b>
 * {@link AttendanceWriteApi} refuses to take or drop an announcement for an event this list
 * would no longer show, and it asks with the same words in the same zone rather than with a
 * comparison of its own: two spellings of one boundary are two boundaries the day one of them
 * is edited. {@code >=}, so an event running today is still ahead for this purpose - a member
 * can still say they are coming to something that has not finished being run.
 *
 * <p><b>THE SCREEN DRAWS THE SAME COMPARISON IN ANOTHER ZONE, AND THAT IS A BOUNDARY RATHER
 * THAN AN AGREEMENT.</b> This said until 03.10.2026 that the frontend „already draws this exact
 * boundary, one field away", and the field is right and the day is not: {@code GoingToEvent.tsx}
 * hides the section when {@code event.date < today}, and the screen's {@code today} is
 * {@code realToday()} in {@code clock/context.ts}, {@code new Date().toISOString().slice(0, 10)},
 * which is the day in UTC. At the instant {@code AttendanceApiTest} is fixed on,
 * 2026-09-14T22:30Z, that expression answers {@code 2026-09-14} while Belgrade is already on the
 * 15th. So for the first hour of a Belgrade day in winter, and the first two in summer, the
 * screen still offers the switch on the event of the day before, and this server refuses it with
 * {@link AttendanceWriteApi#THE_EVENT_HAS_BEEN_RUN}, which the screen says in words. The clock is
 * a part every screen shares, so moving it is not this increment's; the server is what decides.
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
 * <p><b>What the file the portal served until 21.09.2026 carries is not read as a
 * floor for this.</b> {@code mock/attendance.json} still names member {@code 000032}
 * (whose fee has lapsed) and {@code 999999} (no competitor by that number exists at
 * all) against the same event - prototype fixtures older than the decision above,
 * and never a requirement this class had to keep meeting. Mock data is temporary and
 * is never imported (`CLAUDE.md`); until that day the frontend read that file rather
 * than this endpoint (A50: the portal changes files once, together, when every
 * resource exists), so nothing wired then read what this class answers with. PR 340
 * was the day A50 named, and {@code attendance} is one of the fourteen names the
 * same commit carried to {@code /api}, so what is wired now does.
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
 * draws it sorts its own copy by surname), but a list with no settled order is a
 * list that can reshuffle between two readings of data nobody touched, and every other
 * resource in this package decides one.
 */
@RestController
class AttendanceApi {

	/**
	 * AN EVENT STILL AHEAD, as a condition over {@code btl_event e} with the day bound as
	 * {@code :today}: „Prijavljen član najavljuje odlazak na budući događaj" (PDL P6, 11.08.2026).
	 * {@link AttendanceWriteApi} asks it in these words as well; see the class note on why there
	 * is one spelling of it.
	 */
	static final String STILL_AHEAD = "e.date >= :today";

	private final JdbcClient db;

	private final Clock clock;

	private final ActiveMemberOrAdministration readers;

	AttendanceApi(JdbcClient db, Clock clock, ActiveMemberOrAdministration readers) {
		this.db = db;
		this.clock = clock;
		this.readers = readers;
	}

	record Attendance(long eventId, String memberNumber) {
	}

	/**
	 * The day {@link #STILL_AHEAD} is asked about: today in the league's own time, never in the
	 * machine's. One home for the reason the constant has one.
	 */
	static LocalDate today(Clock clock) {
		return LocalDate.now(clock.withZone(SeasonClock.ZONE));
	}

	/**
	 * @param asking   read off the session; whoever has none never reaches this, the chain
	 *                 answers him 401
	 * @param response asked for so a refusal goes down the road an address that is not there
	 *                 takes, exactly as {@link InboxApi#inbox} does
	 */
	@GetMapping("/api/attendance")
	List<Attendance> attendance(@AuthenticationPrincipal WhoIsAsking.Member asking,
			HttpServletResponse response) throws IOException {
		/* AN ACTIVE MEMBER OR THE ADMINISTRATION, and anybody else signed in is told the
		   address is not there (owner, 03.10.2026; ADL A8). */
		if (!readers.includes(asking)) {
			response.sendError(HttpStatus.NOT_FOUND.value());
			return null;
		}

		return db.sql("select a.event_id, c.member_number"
						+ " from attending a"
						/* INNER, safely: both of attending's foreign keys are `on delete
						   cascade`, so a row here always names an event and a competitor
						   that still exist. */
						+ " join btl_event e on e.id = a.event_id"
						+ " join competitor c on c.id = a.competitor_id"
						/* ONLY A FUTURE EVENT (PDL P6, 11.08.2026, „Prijavljen član najavljuje odlazak na budući",
						„budući događaj"), read in the
						   league's own time and not the server's. */
						+ " where " + STILL_AHEAD
						/* AND ONLY A MEMBERSHIP IN GOOD STANDING, for the reason PairApi
						   already refuses the same leak: a number that left here and not
						   /api/competitors would name, by subtraction, whoever has not
						   renewed. */
						+ " and c.active"
						+ " order by a.event_id, c.member_number")
				.param("today", today(clock))
				.query((row, one) -> new Attendance(row.getLong(1), row.getString(2)))
				.list();
	}
}
