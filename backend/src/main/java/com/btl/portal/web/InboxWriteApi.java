package com.btl.portal.web;

import com.btl.portal.domain.inbox.WhoseMessageItIs;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Optional;

/**
 * A MEMBER WRITING TO ANOTHER MEMBER, WHICH IS THE FIRST THING ON THIS PORTAL THAT PUTS A
 * ROW INTO {@code message} AT ALL.
 *
 * <p>Owner, PDL P18: „Postoje privatne poruke izmedju clanova, plus blokiranje i prijava
 * neprikladnog ponasanja", and PDL P10 gives the reason the inbox exists in the first
 * place: „Ponuda i trazenje prevoza za trku ostaju. Zbog toga portal ima inboks i
 * dopisivanje medju clanovima." V13 built the table and {@link InboxApi} reads it; until
 * this class nothing wrote one, which is why {@code TeamWriteApi} and {@code PairWriteApi}
 * each had to write down, in as many words, that the member they refuse or accept is told
 * nothing. This is the writing half, and nothing else: those two boundaries are theirs to
 * close and are not touched here.
 *
 * <p><b>IT IS WRITTEN BY A MEMBER, SO IT CARRIES NO {@link RightIsNeeded}.</b> That
 * annotation names a box the superadmin ticks for a moderator, and there is no box anybody
 * could tick that would let one member write to another: it is a consequence of being a
 * member, the identical sentence {@code RightsAtTheDoorTest} already writes about
 * {@code /api/inbox} on the reading side. The path is on that file's
 * {@code ANSWERS_WITHOUT_A_RIGHT} snapshot because of the {@code GET}, and that snapshot is
 * compared by PATH, so this verb needs no name of its own there. It is absent from
 * {@link ApiSecurity#READ_BY_ANYBODY}, so a caller who is not signed in is answered 401 by
 * the chain before this class runs, and there is no condition here about whether anybody
 * is signed in - a branch nothing can reach is a branch nothing can measure.
 *
 * <p><b>AND THE MAPPING SAYS WHAT IT CONSUMES</b>, which {@link TeamWriteApi} measured off
 * a socket on 19.09.2026: without it, a {@code POST} arriving with no {@code Content-Type}
 * reaches the argument resolver and is answered 415, a number that says „this address is
 * here and wants a different type", while an address mapping nothing goes on saying 404.
 * Declared on the mapping, the request never matches, the dispatcher raises it from
 * {@code handleNoMatch}, and {@link NothingIsHereRatherThanAlmost} turns it into the 404
 * every unmapped address answers. Unlike {@code /api/teams} this path is NOT one a visitor
 * is invited to - it is not on the open list and {@code OPTIONS} under {@code /api} is
 * denied - so there is nothing else here saying out loud that a write lives at this
 * address, and this is the one door that would.
 *
 * <p><b>WHO MAY WRITE.</b> Whoever is signed in AND has a member behind the account. An
 * account naming no member - „a moderator who does not race, which is the ordinary case
 * and not a fault" (V23) - is told the address is not there, the same nothing
 * {@link InboxApi} and {@link NotificationApi} answer him, off the same
 * {@link MemberOfAccount} lookup. There is nobody to file the message under:
 * {@code message.from_id} points at {@code competitor} and never at {@code account}.
 *
 * <h2>WHO HE MAY WRITE TO, and every half of it names its source</h2>
 *
 * <p><b>One named member, and never the league.</b> V13 makes the league the ABSENCE of an
 * addressee, and the owner's word is „PRIVATNE poruke izmedju clanova" - a message every
 * member reads is not a private one. The broadcast is the portal's own voice and belongs to
 * the decisions that produce one: PDL P9, „Skrivena kopija svakog takvog obavestenja ide na
 * administrativnu adresu lige, i ista poruka ide u portalski inboks", and
 * {@code data/seedMessages.ts} says the same from the screen's side, „Both are the league
 * talking to everybody, which is what an empty {@code to} means". So {@code to_id} is
 * filled on every row this writes, and an empty {@code to} is a field nobody filled in
 * rather than a way of addressing everybody. That is not a stylistic choice: this
 * repository's journal carries a measured finding about this exact table, that a case could
 * not tell „he was told" from „everybody was told" because both satisfied one assertion,
 * and the cost named beside it is that every member of the portal reads somebody else's
 * private mail.
 *
 * <p><b>The addressee is named by his MEMBER NUMBER, which is the portal's public identity
 * for a member.</b> {@link CompetitorApi} answers with {@code memberNumber} and never with
 * the key, {@code session/context.ts} says a message's {@code to} is „the member number this
 * was written to, or empty for the whole league", and the profile address is built out of
 * it. A key would be a second identity, and one nothing serves - so a caller could only have
 * got it by guessing.
 *
 * <p><b>WHICH MEMBERS, AND IT IS THE PORTAL'S OWN RULE ABOUT WHOM IT SHOWS rather than a
 * new one.</b> {@code frontend/src/pages/profile/visible.ts}: a profile is there when
 * {@code competitor.active && !(competitor.profileHidden && reader === null)}. Whoever
 * reaches this line is signed in by construction, so the second half is satisfied and what
 * is left is {@code active} - which is also exactly the list {@link CompetitorApi} serves
 * („where c.active", the owner's choice of 13.09.2026: „a member whose fee has lapsed is not
 * on this list at all"). So a member whose profile is hidden from visitors MAY be written to
 * by another member, and one whose membership has lapsed may not. PDL P22: „Skriven profil,
 * jer clanstvo nije aktivno. Rezultati i istorijske tabele ostaju netaknuti, profil se ne
 * prikazuje."
 *
 * <p><b>And a lapsed member and a member who never existed are refused by ONE answer, which
 * is a decision and not a tidiness.</b> PDL P11: „Preusmerenje mora da se ponasa isto i za
 * profil koga nema. Ako skriven profil vodi na naslovnu a nepostojeci kaze „nije pronadjen",
 * posetilac po razlici saznaje koji brojevi pripadaju skrivenim clanovima, sto je upravo ono
 * sto se krije. Oba slucaja dobijaju isti ishod." Two reasons here would be that same leak
 * arriving through the one door that writes.
 *
 * <p><b>Naming it at all is not a leak, and that is measured rather than assumed.</b>
 * {@code /api/competitors} is on {@link ApiSecurity#READ_BY_ANYBODY}, so who is an active
 * member is a list this portal hands to anybody who asks, signed in or not. A refusal that
 * said nothing would only cost the member an unexplained silence.
 *
 * <p><b>THE SHAPE OF THE NUMBER IS NOT CHECKED HERE.</b> {@code competitor_member_number_shape}
 * is six digits and the lookup is an equality against that column, so anything that is not a
 * member number matches nothing and takes the one refusal above. A pattern written here
 * would be a second home for a rule the schema already holds, free to disagree with it.
 *
 * <h2>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED</h2>
 *
 * <ul>
 * <li><b>THE MAIL. NOTHING IS SENT, AND THAT IS A BOUNDARY AND NOT A DEFAULT SOMEBODY
 * CHOSE.</b> PDL P10 says the inbox comes „sa mejl notifikacijom i prosledjivanjem poruke na
 * mejl AKO KORISNIK TO IZABERE", and PDL P22 says what the choice is worth before it is
 * made: „Zvono uvek, mejl podrazumevano ISKLJUCEN, clan ga sam pali: sve drustveno i
 * sporedno (komentar, poziv u tim, zahtev za par, ponuda prevoza, osvojena znacka, PORUKA U
 * INBOKSU)", with the reason beside it - „mejl zamor ubija dostavljivost... Tisina na
 * sporednom je ono sto stiti vazno." The switch itself is {@code notification_setting}, which
 * V13 built in this same migration with {@code inbox_mail boolean not null default false},
 * and the increment that writes it is a separate item of the September block. So there is no
 * member on this portal who has chosen mail, this class reads no switch, and it invents no
 * default: the default is already written down, in the schema, by whoever decided it.
 * <li><b>WHICH KIND OF MESSAGE THIS IS BY A4c, ASKED BECAUSE THE ANSWER DECIDES WHEN IT
 * GOES.</b> ADL A4c divides what the portal SENDS into three - tied to an action (confirming
 * an address, a payment, a member number, a new password: „odmah, i nikad se ne odlaze"),
 * tied to a decision (a result, a comment, a team: as many as a moderator decides in a day),
 * and a reminder (a lapsed fee, an open registration, the end of a season: in series, out of
 * what is left of the daily quota). A message one member writes to another is NONE of the
 * three, and that is not a gap in the table: all three are about MAIL, and the whole section
 * they stand in is „Kako se ostaje ispod 300 na dan" - the hard limit of the free relay. What
 * this route makes is a row, not a mail, so it spends nothing of that quota and is written
 * the moment it is asked for. The day the switch above exists and somebody turns it on, the
 * mail it produces is „drustveno i sporedno" by P22, which is the side A4c's own point 6
 * protects the quota from: „Zvono je podrazumevano, mejl je izuzetak."
 * <li><b>A LENGTH.</b> V13 caps neither {@code subject} nor {@code body}, the portal has no
 * form for writing a message at all - there is no {@code *.form.json} for one and no screen
 * that sends - and no other writing route on this server invents a length either
 * ({@link TeamWriteApi}: „Left out here rather than invented, so that the day it is enforced
 * it is enforced in one place with a number somebody decided"). Said plainly because it is a
 * real hole: nothing stops a member sending a very long text.
 * <li><b>AN EMPTY TEXT IS ALLOWED AND AN EMPTY TITLE IS NOT, and V13 is what says so rather
 * than this class.</b> It writes {@code message_subject_not_blank} and
 * {@code message_from_name_not_blank} and deliberately writes no such check over
 * {@code body} - the same pair {@code competitor.bio} and {@code team_proposal.bio} carry,
 * „NOT NULL and may be empty". So a blank title is refused as a field nobody filled in, and a
 * message that is all title is a whole row. Refusing it here would be this class overruling
 * the schema in the one direction nothing could see.
 * <li><b>A QUESTION.</b> {@code team_invitation_id} and {@code pair_invite_id} are null on
 * every row this writes. They are what puts „Prihvati"/„Odbij" under a message
 * ({@code MessageDetail.tsx}), and the two things they point at are written by other
 * increments; a member writing to a member asks nothing the portal can answer for him.
 * <li><b>DELETING, EDITING AND MARKING READ.</b> Nothing here removes or changes a message:
 * PDL P13, 06.09.2026, „Poruka sa pozivom ostaje u sandusetu... Ne brise se: brisanje poruke
 * iz tudjeg sandučeta je brisanje istorije." Marking one read is {@code message_read}, which
 * {@link InboxApi} READS and nothing writes - so the portal's unread counter (PDL P32) can
 * never fall. It is left out of this increment for a reason that is about the repository
 * rather than about the feature: the smallest shape it can take is a route of its own, at a
 * path {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT} would have to name, and that
 * snapshot is a file two other branches in review already share.
 * <li><b>A REPLY, BLOCKING AND REPORTING.</b> PDL P18 puts „blokiranje i prijava
 * neprikladnog ponasanja" in the same sentence as private messages, and neither has a table,
 * a column or a screen. Until one exists, ANY active member may be written to by any member,
 * including one who would rather not be - that is the state of the portal and it is written
 * here rather than left to be found. A reply is not a route of its own: it is one of these,
 * addressed back.
 * <li><b>WRITING TO HIMSELF.</b> Nothing refuses it, because nothing decided that it should
 * be refused. V13 puts no check on it, the schema holds the row, and a refusal invented here
 * would afterwards read like a decision somebody took.
 * <li><b>{@link WhoseMessageItIs}.</b> That class answers „whose is a message that exists"
 * and „who may answer it", and the question here - to whom may one be written - is a third
 * one it does not hold. What ties them is {@code to_id}: filled, it is what makes
 * {@code whose()} answer {@code HIS_OWN} to the addressee and {@code SOMEBODY_ELSES} to
 * everybody else, which is the {@code where} clause {@link InboxApi} serves by. Adding a
 * method there for one caller would grow that class past the change that needed it.
 * </ul>
 *
 * <p><b>THE SENDER'S NAME IS READ OFF HIS ROW AND NEVER TAKEN FROM THE REQUEST.</b> V13
 * keeps {@code from_name} because „the member may ask to be deleted (PDL P23) and what he
 * wrote does not go with him. The pointer empties, the name does not." Taken off the request
 * it would be a name anybody could choose; taken off the ACCOUNT it would be the name on the
 * mailbox rather than the name the league knows him by, and those are two columns in two
 * tables that need not agree. It is {@code competitor.first_name} and
 * {@code competitor.last_name}, which is the name every screen draws him under and the one
 * {@link CompetitorApi} answers with.
 *
 * <p><b>THE MOMENT IS THE DATABASE'S.</b> {@code sent_at} is V13's {@code now()} and is not
 * written here, for the reason {@link EventWriteApi} and {@link TeamWriteApi} give about
 * every such column: a moment read off this server would be a second home for what time it
 * is. There is no field for it in what arrives, so nothing sent in can move it.
 *
 * <p><b>ONE STATEMENT, SO NO TRANSACTION IS WRITTEN BY HAND.</b> {@link TeamWriteApi} and
 * {@link EventWriteApi} each hold a {@code TransactionTemplate} because a proposal and its
 * queue row, or an event and its races, are one thing that must all happen or none of it.
 * Here there is a single {@code insert} and nothing to be half done, so a template would be
 * a claim about an atomicity that is already the statement's own.
 *
 * <p><b>AND THE ANSWER IS READ BACK OUT OF THE ROW.</b> The title is stripped on the way in,
 * so what was typed and what was stored are two values on purpose; handed back off the
 * request, this answer would agree with the table on every request that worked and would be
 * a claim about nothing. That is {@link RegistrationApi}'s own reason for reading the address
 * back off the account it has just written, and {@link TeamWriteApi}'s for the name.
 */
@RestController
class InboxWriteApi {

	/** A required field nobody filled in, which includes an empty addressee. */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/**
	 * The addressee is not a member this portal shows.
	 *
	 * <p>ONE reason for two states on purpose - a number nobody has, and a member whose
	 * membership has lapsed - because PDL P11 says the two get the same outcome, and a
	 * caller who could tell them apart would be reading which numbers belong to hidden
	 * members off the difference.
	 */
	static final String THE_MEMBER_IS_NOT_KNOWN = "theMemberIsNotKnown";

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	InboxWriteApi(JdbcClient db, MemberOfAccount memberOfAccount) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
	}

	/**
	 * WHAT ARRIVES, and the three names are {@code session/context.ts}'s own.
	 *
	 * <p>That file is where the portal already says what a message is, and the type it
	 * carries is the one the inbox screens read. There is no form definition to compare
	 * this against - the portal has no screen for writing a message yet - so this record
	 * has no derived floor under it and that is said out loud rather than papered over.
	 *
	 * <p>There is no {@code from}, no {@code date} and no {@code read}: each of the three
	 * is the server's or the database's, and a field for one of them would be a value the
	 * caller gets to choose.
	 *
	 * @param to      the addressee's MEMBER NUMBER. Empty is not the league here, it is a
	 *                field nobody filled in - see this class's note on why a member never
	 *                writes to everybody
	 * @param subject the title, which V13 refuses blank
	 * @param body    the text, which V13 allows to be empty
	 */
	record Written(String to, String subject, String body) {
	}

	/** Why a message could not be written. */
	record Refused(String reason) {
	}

	/**
	 * @param id      the message now standing in his inbox, which the caller cannot know
	 *                until it comes back
	 * @param subject the title AS IT WAS WRITTEN DOWN, read back off the row: it is
	 *                stripped on the way in, so this is not always what was sent
	 */
	record Sent(long id, String subject) {
	}

	/**
	 * @param response asked for so a refusal can go down the same road an address that is
	 *                 not there takes, exactly as {@link InboxApi#inbox} does on the other
	 *                 verb of this same path
	 */
	@PostMapping(path = "/api/inbox", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> write(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@RequestBody Written typed, HttpServletResponse response) throws IOException {

		Long me = memberOfAccount.competitorId(asking.account());

		/* AN ACCOUNT THAT NAMES NO MEMBER, which V23 says is the ordinary case for a
		   moderator who does not race. There is nobody to send a message FROM, and the
		   answer is the one InboxApi already gives him on the reading side. */
		if (me == null) {
			return away(response);
		}

		if (isNothing(typed.to()) || isNothing(typed.subject())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		Optional<Long> addressee = memberShown(typed.to());

		if (addressee.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_MEMBER_IS_NOT_KNOWN);
		}

		long written = db.sql("insert into message (to_id, from_id, from_name, subject, body)"
						+ " values (?, ?, ?, ?, ?) returning id")
				.params(addressee.orElseThrow(), me, nameTheLeagueKnowsHimBy(me),
						typed.subject().strip(), orEmpty(typed.body()))
				.query(Long.class)
				.single();

		return ResponseEntity.status(HttpStatus.CREATED)
				.body(new Sent(written, subjectWrittenDown(written)));
	}

	/**
	 * THE MEMBER THIS NUMBER NAMES, IF THE PORTAL SHOWS HIM TO WHOEVER IS ASKING.
	 *
	 * <p>{@code active} and nothing else, which is {@code pages/profile/visible.ts} read
	 * for a signed in reader and the same condition {@link CompetitorApi} serves its list
	 * by. {@code profile_hidden} is deliberately NOT asked about: it hides a member from a
	 * VISITOR, and the caller here is signed in by construction.
	 *
	 * <p>A row whose {@code member_number} is empty - somebody who registered and has not
	 * paid (V16) - cannot match an equality against it, so „is he a member at all" needs no
	 * condition of its own.
	 */
	private Optional<Long> memberShown(String memberNumber) {
		return db.sql("select id from competitor where member_number = ? and active")
				.param(memberNumber.strip())
				.query(Long.class)
				.optional();
	}

	/**
	 * The sender's name as the league holds it, which is what outlives him on the message.
	 *
	 * <p>Read here and not built into the {@code insert} as a sub-select, so that what this
	 * value IS has a name and one home; and read off {@code competitor} rather than off
	 * {@code account}, which carries a name of its own that need not agree.
	 */
	private String nameTheLeagueKnowsHimBy(long me) {
		return db.sql("select first_name || ' ' || last_name from competitor where id = ?")
				.param(me).query(String.class).single();
	}

	/** The title as the row holds it, which is the one thing this answer is a claim about. */
	private String subjectWrittenDown(long message) {
		return db.sql("select subject from message where id = ?").param(message)
				.query(String.class).single();
	}

	/**
	 * Whether a field was filled in at all.
	 *
	 * <p>Absent, empty and a run of spaces are one answer and not three, which is the list
	 * of shapes {@link TeamWriteApi} and {@link RegistrationApi} keep for the same reason:
	 * JSON has a null, a form has an empty box and a person has a space bar, and a guard
	 * written against one of the three lets the other two through to a column whose
	 * {@code btrim(...) <> ''} would then refuse them as an error.
	 */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	/** {@code body} is NOT NULL and may be empty (V13). */
	private static String orEmpty(String value) {
		return value == null ? "" : value.strip();
	}

	/**
	 * THE ANSWER FOR SOMEBODY THIS ADDRESS IS NOT FOR, which carries nothing at all.
	 *
	 * <p><b>It is {@code sendError} and not a {@link ResponseEntity}, which is the one place
	 * this class departs from {@link TeamWriteApi} on purpose.</b> That route answers a 404
	 * it builds itself, and its own note says why it may: {@code /api/teams} is open for
	 * reading, answers a visitor 200, and says through {@code OPTIONS} that a write lives
	 * there, so „there is nothing left for the shape of this 404 to hide." Here there is. A
	 * status on the response comes back with {@code Content-Length: 0} while an address
	 * mapping nothing comes back longer and chunked - and this path maps a {@code GET} that
	 * answers the identical account with {@code sendError}. Built any other way, a member-less
	 * account could tell the two verbs apart by the shape of the refusal and learn from the
	 * difference that writing lives at an address the portal never offered him.
	 *
	 * <p>Returning {@code null} afterwards is how {@link InboxApi} says the same thing: the
	 * error has been committed and there is no body left to write.
	 */
	private static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
