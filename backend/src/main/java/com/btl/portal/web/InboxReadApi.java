package com.btl.portal.web;

import com.btl.portal.domain.inbox.WhoseMessageItIs;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Optional;

/**
 * A MEMBER OPENS A MESSAGE, AND THAT IS THE ONLY THING THAT EVER WRITES {@code message_read}.
 *
 * <p>Owner, PDL section 27a, 27.09.2026, choosing the first of three offered outcomes and
 * narrowing it in his own words: „Ako pod 1 spada pokrivanje funkcionalnosti na pravi nacin
 * tako da kad clan otvori poruku ona stvarno postaje procitana, onda da. Ne treba mi dugme da
 * se nesto oznaci kao procitano ili neprocitano." So there is exactly one trigger - opening a
 * message - and exactly one verb here: no route to mark a message UNREAD exists on this
 * server, and none is added by this class.
 *
 * <p><b>ITS OWN ADDRESS, NOT A THIRD VERB ON {@code /api/inbox}.</b> {@link InboxWriteApi}'s
 * own note named this the day {@code message_read} was built but nothing wrote it: „Marking
 * one read is {@code message_read}... It is left out of this increment for a reason that is
 * about the repository rather than about the feature: the smallest shape it can take is a
 * route of its own, and since 19.09.2026 a new route owes its OWN VERB PATH entry in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}. Sharing this path with the two verbs
 * already named there buys it nothing, which is the whole point of the pair." This class is
 * that route, and {@code POST /api/inbox/{id}/read} is its own entry in that set rather than a
 * third verb borrowing {@code /api/inbox}.
 *
 * <p><b>WHOSE IT IS, ASKED OF THE CLASS ALREADY WRITTEN AND TESTED FOR EXACTLY THIS.</b>
 * {@link WhoseMessageItIs#mayRead} says in its own javadoc why reading and marking read are
 * one question: „Whether he may see it at all, which is reading it and marking it read. The
 * two go together on purpose: a member who may not read a message may not write a row saying
 * he has." So the identical split {@link InboxApi} filters its {@code where} clause by is
 * asked here as a function call rather than written a second time, and
 * {@code InboxRulesMatchTheSchemaTest} is what keeps this class, {@link InboxApi} and the
 * schema from drifting apart from one another.
 *
 * <p><b>A MESSAGE THAT DOES NOT EXIST AND ONE THAT IS SOMEBODY ELSE'S ARE REFUSED ALIKE, ONE
 * 404 SENT ONE WAY.</b> ADL A8: a signed in caller who lacks the right is told the identical
 * nothing an address that is not there tells him - not 403, so that a member walking message
 * ids learns nothing about which of them belong to somebody else. {@link #away} is
 * {@link InboxApi} and {@link InboxWriteApi}'s own {@code sendError}, copied rather than
 * reinvented, for the reason {@code RightsOverRealHttpTest} measured on this exact family:
 * swapping {@code sendError} for a status written onto the response is invisible to
 * {@code MockMvc} and a real difference in bytes over a real socket (262 against 412).
 *
 * <p><b>ABSENT FROM {@link ApiSecurity#READ_BY_ANYBODY}, SO A VISITOR IS ANSWERED 401 BEFORE
 * THIS CLASS EVER RUNS.</b> There is no condition in here about whether anybody is signed in,
 * for the reason every sibling in this package gives: a branch nothing can reach is a branch
 * nothing can measure.
 *
 * <p><b>AN ACCOUNT NAMING NO MEMBER IS TOLD THE SAME NOTHING {@link InboxApi} AND
 * {@link InboxWriteApi} TELL HIM</b> - „a moderator who does not race, which is the ordinary
 * case and not a fault" (V23) - off the identical {@link MemberOfAccount} lookup those two
 * classes already share, so the fact is asked once rather than copied a third time.
 *
 * <p><b>NEEDS NO {@link RightIsNeeded}, FOR THE SAME REASON {@code POST /api/inbox} DOES
 * NOT.</b> There is no box a superadmin could tick for reading your own mail; it is a
 * consequence of being a member, so this route is named in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT} rather than asking for a right nobody
 * was ever going to grant.
 *
 * <p><b>A SECOND CALL CHANGES NOTHING, AND THAT IS THE DATABASE'S DECISION RATHER THAN A CHECK
 * WRITTEN HERE.</b> {@code message_read_pk} is {@code (message_id, competitor_id)}, so
 * {@code on conflict do nothing} is what makes opening an already read message harmless
 * instead of a duplicate key error - the identical idiom {@code VerificationWriteApi#hold}
 * uses so a claim is one statement rather than a read followed by a write that could race it.
 * {@code read_at} of the FIRST call survives every call after it, which is the only sentence a
 * read receipt can honestly make: when it was first opened, not when it was opened last.
 *
 * <p><b>A BROADCAST IS MARKED READ PER READER, BECAUSE THE ROW NAMES THE READER AND NOT THE
 * MESSAGE ALONE.</b> V13's own comment on {@code message_read}: „Unread is the ABSENCE of a
 * row rather than a false in one, which is what lets an announcement reach two thousand
 * members without writing two thousand rows the moment it is sent." So one member opening the
 * league's announcement writes a row for himself alone, and must not mark it read for anybody
 * else - the exact confusion a review on 06.09.2026 found in a different table: „could not
 * tell 'he was told' from 'everybody was told' because both satisfied one assertion."
 *
 * <p><b>ONE STATEMENT TO CHECK AND ONE TO WRITE, AND NO TRANSACTION IS WRITTEN BY HAND.</b>
 * The write is a single idempotent {@code insert}, so there is nothing for a
 * {@code TransactionTemplate} to make atomic that the statement does not already make atomic
 * by itself - {@link InboxWriteApi}'s own reason for the identical shape.
 */
@RestController
class InboxReadApi {

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	InboxReadApi(JdbcClient db, MemberOfAccount memberOfAccount) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
	}

	/**
	 * @param id       {@code message.id}, never trusted to be his until {@link WhoseMessageItIs}
	 *                 says so
	 * @param member   read off the session, never off anything the caller sent
	 * @param response asked for so a refusal can go down the same road an address that is not
	 *                 there takes, exactly as {@link InboxApi#inbox} does on the other resource
	 *                 this class shares a table with
	 */
	@PostMapping("/api/inbox/{id}/read")
	ResponseEntity<?> read(@PathVariable long id,
			@AuthenticationPrincipal WhoIsAsking.Member member, HttpServletResponse response)
			throws IOException {

		Long me = memberOfAccount.competitorId(member.account());

		if (me == null) {
			return away(response);
		}

		Optional<WhoseMessageItIs.Message> message = messageById(id);

		if (message.isEmpty() || !WhoseMessageItIs.mayRead(message.get(), me)) {
			return away(response);
		}

		/* ON CONFLICT DO NOTHING, so a message already his to read that he has already opened
		   before is a no-op rather than a duplicate key error on message_read_pk - see the
		   class note on why a second call must change nothing. */
		db.sql("insert into message_read (message_id, competitor_id) values (?, ?)"
						+ " on conflict (message_id, competitor_id) do nothing")
				.params(id, me)
				.update();

		return ResponseEntity.noContent().build();
	}

	/**
	 * The one fact {@link WhoseMessageItIs} needs about a message, read off the row rather
	 * than assumed - {@code empty} means no such row, which this route answers exactly as it
	 * answers a row that is somebody else's.
	 */
	private Optional<WhoseMessageItIs.Message> messageById(long id) {
		return db.sql("select to_id, team_invitation_id is not null or pair_invite_id is not null"
						+ " from message where id = ?")
				.param(id)
				.query((row, one) -> new WhoseMessageItIs.Message(
						row.getObject(1, Long.class), row.getBoolean(2)))
				.optional();
	}

	/**
	 * THE ANSWER FOR A MESSAGE THAT IS NOT HIS TO MARK, WHICH CARRIES NOTHING AT ALL.
	 *
	 * <p>Copied from {@link InboxWriteApi#away}, not reinvented: {@code sendError} runs the
	 * container's ERROR dispatch and a status written onto the response does not, and that
	 * difference is only visible over a real socket. {@code MockMvc} cannot tell the two
	 * apart, so writing this a second time by hand would be exactly the imitation that finding
	 * is about.
	 */
	private static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}
}
