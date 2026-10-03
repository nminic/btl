package com.btl.portal.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.util.Optional;
import java.util.function.BiConsumer;

/**
 * A MEMBER SAYING HE IS GOING TO AN EVENT, OR THAT HE IS NOT ANY MORE, AND THE SERVER KEEPING
 * IT.
 *
 * <p><b>Why this exists, in the owner's words after testing on 03.10.2026:</b> „Prijavim se da
 * idem na ovaj događaj i kad osvežim stranu moja prijava nestane. Mora da se zapamti!" Until this
 * class the switch on the event's page wrote into the browser's session and nowhere else, so a
 * reload took it away. The decision that said it would wait until after launch (28.09.2026) is
 * overturned by that sentence, and the mechanics are the ones of 11.08.2026 (PDL P6): „Kad
 * kliknem na dugme da prijavljujem da idem na događaj, to dugme ostaje uključeno na nivou
 * događaja. Ako ponovo kliknem na njega i isključim ga, automatski treba i da se sklonim sa liste
 * posetioca događaja."
 *
 * <p><b>TWO VERBS ON ONE ADDRESS, AND BOTH ARE A STATE RATHER THAN AN ACT.</b> {@code PUT} says
 * „I am going", {@code DELETE} says „I am not", and each leaves the same row behind however
 * often it is sent: {@code attending_said_once} (V7) holds one row per member and event, the
 * {@code insert} steps aside from a row already there in the shape {@link InboxReadApi} marks a
 * message read, and a {@code delete} of nothing deletes nothing. A switch pressed twice from two
 * tabs therefore ends where the last press put it, never in a fault. 204 either way: a state
 * changed, and nothing new stands that the caller could not name himself (the shape
 * {@code askTheServer.ts} reads beside 200 and 201).
 *
 * <p><b>THE ADDRESS NAMES THE EVENT AND NOTHING NAMES THE MEMBER.</b> „Na nivou događaja" is the
 * owner's word, and {@code attending} is keyed by the event and not by a race. The member is read
 * off the session through {@link ActiveMemberOrAdministration#activeMember} and never off the
 * request, so „his own" is the only thing these two routes can express rather than a check that
 * could be forgotten - the reason {@code RightsAtTheDoorTest} gives for {@code GET
 * /api/me/membership}. The key is an {@link AKey}, so a word where it goes is the key no row has.
 *
 * <p><b>WHO MAY SAY IT: AN ACTIVE MEMBER, AND NOBODY ELSE.</b> The owner chose it on 03.10.2026:
 * „Najavu dolaska daju i spisak najavljenih vide aktivni članovi (važeća članarina), a spisak vidi
 * i administracija". The administration is in the second half and not the first, so a moderator
 * who races for nobody reads the list and says nothing on it, and one whose own fee has lapsed
 * reads it as the administration and is refused as a member. Anybody signed in who is not an
 * active member is answered 404, the answer an address that maps nothing gives (ADL A8,
 * „prijavljen kome pravo nedostaje dobija 404"), and a visitor is answered 401 by the chain before
 * this class runs: the address is not on {@link ApiSecurity#READ_BY_ANYBODY}.
 *
 * <p><b>ONLY AHEAD OF THE EVENT, BOTH WAYS.</b> „Na budući događaj" (PDL P6). Taking an
 * announcement back is held to the same day as giving one, and that half is not in the owner's
 * words: it was offered and confirmed before this class was written, for the reason that an event
 * {@link AttendanceApi} no longer shows has nothing left to switch, and one boundary is one thing
 * to keep right. The day is {@link AttendanceApi#STILL_AHEAD} in the
 * league's own time, the very words the list is filtered by, so a member can never take or drop
 * an announcement for an event the list would not show him. Refused by name,
 * {@link #THE_EVENT_HAS_BEEN_RUN}, as {@code CommentWriteApi} refuses a rating for an event not
 * yet run: the screen offers the switch by a day of its own in another zone (see
 * {@link AttendanceApi}), so this refusal is reachable from the screen and is said in words there.
 *
 * <p><b>THE ORDER OF THE QUESTIONS IS PART OF THE ANSWER.</b> The member first, so somebody this
 * address is not for learns nothing about any event from it; then whether the event exists, which
 * is the same 404 an address that maps nothing gives; then the day. Events are public
 * ({@code /api/events} is on the open list), so a 400 that says an event has been run tells an
 * active member nothing he could not read off the calendar.
 *
 * <p><b>NOTHING HERE IS TOLD TO ANYBODY.</b> No message and no mail: an intention is „samo
 * iskazana namera, ne obaveza" (PDL P10), and the way to reach somebody else who is going is the
 * envelope beside his name, which writes through {@link InboxWriteApi} and is not this class.
 */
@RestController
class AttendanceWriteApi {

	/**
	 * The event is not ahead any more: „najavljuje odlazak na budući događaj" (PDL P6, 11.08.2026),
	 * for both verbs (03.10.2026).
	 */
	static final String THE_EVENT_HAS_BEEN_RUN = "theEventHasBeenRun";

	private final JdbcClient db;

	private final Clock clock;

	private final ActiveMemberOrAdministration readers;

	AttendanceWriteApi(JdbcClient db, Clock clock, ActiveMemberOrAdministration readers) {
		this.db = db;
		this.clock = clock;
		this.readers = readers;
	}

	/** Why it could not be said. */
	record Refused(String reason) {
	}

	/**
	 * „I am going."
	 *
	 * @param id     {@code btl_event.id}
	 * @param asking read off the session, never off anything the caller sent
	 */
	@PutMapping("/api/attendance/{id}")
	ResponseEntity<?> going(@PathVariable AKey id, @AuthenticationPrincipal WhoIsAsking.Member asking) {
		return said(id, asking, (event, member) -> db.sql("insert into attending (event_id, competitor_id)"
						+ " values (?, ?) on conflict (event_id, competitor_id) do nothing")
				.params(event, member)
				.update());
	}

	/**
	 * „I am not going any more", which takes his name and nobody else's off the list.
	 *
	 * @param id     {@code btl_event.id}
	 * @param asking read off the session, never off anything the caller sent
	 */
	@DeleteMapping("/api/attendance/{id}")
	ResponseEntity<?> notGoing(@PathVariable AKey id,
			@AuthenticationPrincipal WhoIsAsking.Member asking) {
		return said(id, asking, (event, member) -> db.sql("delete from attending"
						+ " where event_id = ? and competitor_id = ?")
				.params(event, member)
				.update());
	}

	/**
	 * THE THREE QUESTIONS BOTH VERBS ASK, IN THE ORDER THE CLASS NOTE GIVES, AND THEN THE ONE
	 * STATEMENT THAT DIFFERS.
	 *
	 * <p>Written once so the two verbs cannot come to ask different things: a switch that may be
	 * turned on by somebody who may not turn it off, or the other way round, would be two rules
	 * where the owner gave one.
	 *
	 * @param writing the statement, handed the event and the member in that order
	 */
	private ResponseEntity<?> said(AKey id, WhoIsAsking.Member asking,
			BiConsumer<Long, Long> writing) {
		long member = readers.activeMember(asking).orElseThrow(AttendanceWriteApi::nothingIsHere);
		boolean ahead = stillAhead(id.value()).orElseThrow(AttendanceWriteApi::nothingIsHere);

		if (!ahead) {
			return no(THE_EVENT_HAS_BEEN_RUN);
		}

		writing.accept(id.value(), member);

		return ResponseEntity.noContent().build();
	}

	/**
	 * Whether this event is still ahead, or nothing where the key names no event at all.
	 *
	 * <p>Asked of the row and in the list's own words, {@link AttendanceApi#STILL_AHEAD} over
	 * {@code btl_event e}, so the day this refuses on is the day the list stops showing.
	 */
	private Optional<Boolean> stillAhead(long event) {
		return db.sql("select " + AttendanceApi.STILL_AHEAD + " from btl_event e where e.id = :id")
				.param("today", AttendanceApi.today(clock))
				.param("id", event)
				.query(Boolean.class)
				.optional();
	}

	/**
	 * THE ANSWER FOR SOMEBODY THIS ADDRESS IS NOT FOR, AND FOR AN EVENT THAT IS NOT THERE.
	 *
	 * <p>{@link ResponseStatusException} is answered through {@code sendError}, the road an
	 * address that maps nothing takes, so the two cannot be told apart by their bytes - the
	 * difference {@code CommentWriteApi}'s own note measured, a status written onto the
	 * response coming back shorter than the container's error document. Made here and thrown by
	 * the caller, so the line that makes it is a line that returns and the coverage report
	 * counts it as run.
	 */
	private static ResponseStatusException nothingIsHere() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND);
	}

	private static ResponseEntity<?> no(String reason) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new Refused(reason));
	}
}
