package com.btl.portal.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * THE SUPERADMIN TICKING ONE MODERATOR'S BOXES, AND TAKING A MODERATOR OUT.
 *
 * <p>The writing half of {@link ModeratorApi}, in a file of its own the way
 * {@link EventWriteApi} stands beside {@link CalendarApi}. It is the one resource on this
 * portal that is not about what a moderator may do to the league but about what he may do
 * at all: PDL P21, „Superadmin kreira moderatore i uređuje im prava pojedinačno, kao i što
 * ih menja i briše. Van toga, Superadmin i Moderator mogu isto" - so this is the whole of
 * „van toga", and every other route of the portal is the „isto".
 *
 * <p><b>{@link OnlyTheSuperadmin} and never {@link RightIsNeeded}, and that annotation's
 * own javadoc carries the reason at length.</b> The short of it: there is no box that
 * opens this, because the owner refused to create one - „Ne treba ni da postoji kolona
 * moderatori jer samo superadmin ima ta prava" (PDL P28a, 13.08.2026, „Moderatori nemaju
 * kolonu"), which is also why {@code admin_right} holds twelve codes and none of them is
 * {@code entity:moderators}. A moderator holding every one of the twelve is refused here
 * exactly as one holding none is, and that is the point rather than an edge of it: „Bez te
 * granice moderator bi sam sebi mogao da dodeli prava, pa granularna prava ne bi značila
 * ništa" (PDL P28a, 30.07.2026). The refusal is 404 and not 403 (ADL A8, owner
 * 13.09.2026), and it is not written here - it goes down the one road
 * {@link RightsAtTheDoor} takes.
 *
 * <p><b>THE ROW EITHER ROUTE ACTS ON IS A MODERATOR, AND THAT ONE CONDITION IS ALSO THE
 * WHOLE OF PDL P28a's TWO PROHIBITIONS.</b> Both statements below join {@code role} and
 * ask for {@code moderator}, which is the same condition {@link ModeratorApi} serves the
 * list by, so what may be written is exactly what may be read. The owner's sentence of
 * 11.08.2026 - „Superadmin ne sme da oduzme prava sebi ni poslednjem preostalom
 * Superadminu" - has two halves and they are not the same claim, so each is taken on its
 * own:
 *
 * <ul>
 * <li><b>„sebi".</b> A superadmin is not a moderator, so his own key finds no row here and
 * both routes answer 404 to it. He cannot be stripped because he holds nothing that is
 * kept in a table: „Superadmin nema kućice. On sme sve, uvek, i ne pojavljuje se u ovoj
 * tabeli kao neko kome se prava dodeljuju" (PDL P28a, 30.07.2026), and
 * {@link com.btl.portal.domain.rights.AdminRights} answers him yes off
 * {@code role.rights_mode} without reading a tick at all. A row written into
 * {@code account_admin_right} for him would change nothing he may do and would still be a
 * row in the table he is not in, so it is refused rather than ignored.
 * <li><b>„ni poslednjem preostalom Superadminu".</b> The same condition answers it, and
 * it answers it for a reason that does not count anything. Superadmin accounts may be
 * several - „superadminskih naloga sme da bude vise" (ADL A40, 14.09.2026), which
 * {@code role_only_one_holds_every_right} does not forbid because that index is over the
 * ROLE - so „the last one" is a question about a number of rows. This resource never asks
 * it, because the owner closed the question on the same day from a different side:
 * „posto uloga ne stoji kao zapis koji se dodeljuje, nego se izvodi iz podesavanja,
 * superadmin ne moze da se obrise ni razvlasti kroz portal uopste ... Zabrana ... postaje
 * nepotrebna po konstrukciji: nema radnje koja bi je prekrsila" (PDL P21, 14.09.2026,
 * „Superadmin se ne pravi kroz portal"). So a superadmin is refused here whether he is the
 * only one or one of several, and the answer does not move when a second one is written.
 * </ul>
 *
 * <p><b>The boundary in the other direction, said out loud because a route that refused
 * everybody would satisfy both bullets above.</b> A moderator IS re-ticked and IS deleted,
 * and that is the ordinary use of this screen; what is refused is an account that is not
 * one.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>Making a moderator.</b> There is no {@code POST}, and since 18.09.2026 that is a
 * place in the queue rather than an open question. „Nov moderator dobija pozivnicu na mejl,
 * a lozinku postavlja sam" (PDL P28a, 18.09.2026): the superadmin writes a name and an
 * address, the portal sends a link that sets a password through the machinery
 * {@link PasswordResetApi} already carries, and until he follows it the account has no
 * password and cannot sign in. The same decision says in as many words that making a
 * moderator is a SEPARATE increment from writing his rights, and that the two do not depend
 * on each other - which is why this file carries the second and not the first.
 * <li><b>His name and his address.</b> PDL P21 says the superadmin „menja" moderators as
 * well as their rights, and the screen edits both; this route carries the row of boxes and
 * nothing else, so the day those are written they belong in this same method rather than
 * in a second one. Until then a request naming them is refused by the shape of
 * {@link Ticks}, which has no field for either.
 * <li><b>The count of superadmins.</b> Named above: the owner closed it by construction on
 * 14.09.2026, and the place it would have lived is a resource over ACCOUNTS AND ROLES,
 * which this is not.
 * <li><b>Any say over who may read this.</b> {@link ModeratorApi} is where the list is
 * served and this file adds no condition of its own about who is asking; both routes ask
 * the door and the door answers for both.
 * </ul>
 *
 * <p><b>Deleting is ONE statement, and that is a decision rather than an omission</b> -
 * the same sentence {@link EventWriteApi} writes for an event and its races. What hangs
 * off an account is already answered by the schema, in three different ways, so a second
 * answer written here would be a second home for a fact and the day the two disagreed the
 * schema would win silently:
 *
 * <ul>
 * <li>his ticks go with him - {@code account_admin_right_account_fk} is
 * {@code on delete cascade} (V18) - which is what makes the table have no row pointing at
 * nobody;
 * <li>so does his way in: {@code account_session_account_fk} and
 * {@code password_reset_token_account_fk} cascade too (V18), and
 * {@code email_verification_token_account_fk} does (V6), so a cookie he holds stops
 * working at the next request rather than at its own expiry;
 * <li>but the DECISIONS HE MADE STAY, with the name he made them under.
 * {@code verification_decided_by} and {@code payment_recorded_by} are
 * {@code on delete set null} beside a {@code decided_by_name} and a
 * {@code recorded_by_name} that are plain text (V9, V16), which V9 states as the rule it
 * copied from {@code event_comment}: a decision was made, it stays made, and it says by
 * whom;
 * <li>and HIS MEMBER RECORD IS NOT HIS ACCOUNT. {@code account_competitor_fk} points the
 * other way and is {@code on delete restrict} - the one such key in this schema that
 * guards a PERSON rather than a codebook, which is V23's own wording (owner, 14.09.2026).
 * It is deliberately not „the only restrict there is": the schema has plenty, over price
 * rows, queues and codebooks, and a number written here would be one more comment to keep
 * equal to a thing nobody checks. So deleting the account of a moderator who also races
 * leaves the competitor, his results and his membership exactly where they were: deleting
 * a moderator is not deleting a member, and a member who asks to go is still two steps
 * (PDL P23).
 * </ul>
 */
@RestController
class ModeratorWriteApi {

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	static final String A_RIGHT_THE_MATRIX_DOES_NOT_HOLD = "aRightTheMatrixDoesNotHold";

	private final JdbcClient db;

	/**
	 * Written by hand rather than left on the method, the same choice {@link PaymentApi}
	 * and {@link EventWriteApi} made and for the same reason: a row of boxes is saved as
	 * one thing, so the ticks taken away and the ticks given must all happen or none of
	 * them. Half of it written down is a moderator holding a set the superadmin never
	 * ticked.
	 */
	private final TransactionTemplate inOneTransaction;

	ModeratorWriteApi(JdbcClient db, TransactionTemplate inOneTransaction) {
		this.db = db;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * ONE ROW OF THE MATRIX, WHOLE.
	 *
	 * <p>„Prava se zadaju kućicama u tabeli: red je moderator, kolone su prava" (PDL P28a,
	 * 30.07.2026), and what a row of boxes sends when it is saved is the boxes that are
	 * on - not one box and which way it moved. That is what makes this a {@code PUT}: sent
	 * twice it says the same thing, and two superadmins saving the same row cannot leave it
	 * holding the union of what each of them saw.
	 *
	 * @param rights codes as {@code admin_right.code} generates them, {@code entity:events}
	 *               or {@code queue:payments}; an empty list is a moderator who may do
	 *               nothing, which is a real state and the one this screen exists to end
	 */
	record Ticks(List<String> rights) {
	}

	/** Why a row of boxes could not be written. */
	record Refused(String reason) {
	}

	/**
	 * @param rights what the TABLE holds afterwards, read back rather than echoed, so an
	 *               answer cannot agree with a request the database refused
	 */
	record Ticked(long id, List<String> rights) {
	}

	/**
	 * CHANGING WHAT ONE MODERATOR MAY DO.
	 *
	 * <p><b>A box already ticked is not ticked again, and that is the schema's sentence
	 * rather than an optimisation.</b> V18: „THE PAIR IS THE KEY, so a right is granted
	 * once. Ticking a box that is already ticked is not a second fact." Emptying the row
	 * and writing it back would move {@code granted_at} on every box that did not change,
	 * so the day somebody asks when a moderator was given something the answer would be the
	 * last time anybody pressed Save. What is written is therefore the difference: the
	 * boxes that went off are deleted, the boxes that came on are inserted, and the ones
	 * that stayed on are not touched at all.
	 *
	 * <p><b>A code the matrix does not hold is refused as a SENTENCE and never as a server
	 * fault</b>, which is the shape {@link EventWriteApi} uses one resource along.
	 * {@code account_admin_right_right_fk} would refuse it anyway (V18), but as a
	 * constraint violation - a 500 reaching the superadmin after he had filled the screen
	 * in. And the codes it refuses are not a curiosity: {@code entity:moderators} is
	 * precisely the code that does not exist, by the owner's decision of 13.08.2026, so
	 * this line is where „moderators have no column" stops being a comment.
	 *
	 * <p><b>What it is compared against is read out of {@code admin_right}</b> and is not a
	 * list of twelve written here. A list would go on saying „the matrix" while meaning
	 * „the twelve I knew about", and the thirteenth right added tomorrow would be refused
	 * by a file nobody thought to open.
	 */
	@PutMapping("/api/moderators/{id}")
	@OnlyTheSuperadmin
	ResponseEntity<?> change(@PathVariable long id, @RequestBody Ticks typed) {
		/* A REQUEST THAT NAMES NO LIST AT ALL IS NOT A MODERATOR WHO MAY DO NOTHING. The
		   two are one field apart in the body and opposite in meaning, and read as the
		   second a request that lost its field on the way would quietly strip somebody of
		   everything. An empty list says that in as many words and is accepted. */
		if (typed.rights() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		Set<String> asked = new HashSet<>(typed.rights());

		return inOneTransaction.execute(committing -> {
			Optional<Long> moderator = moderatorNamed(id);

			/* THE SAME ANSWER SOMEBODY WHO MAY NOT ASK GETS, and that is deliberate: an
			   account that is not a moderator - a competitor, a superadmin, a key nobody
			   holds - and a row the door would have refused read the same. It is ADL A8
			   applied to a row rather than to a route, and it is also both halves of
			   PDL P28a's „ne sme da oduzme prava sebi ni poslednjem preostalom Superadminu",
			   for the reason the header gives. */
			if (moderator.isEmpty()) {
				return no(HttpStatus.NOT_FOUND, null);
			}

			if (!theMatrixHolds().containsAll(asked)) {
				return no(HttpStatus.BAD_REQUEST, A_RIGHT_THE_MATRIX_DOES_NOT_HOLD);
			}

			Set<String> held = new HashSet<>(ticksOf(moderator.get()));

			for (String gone : minus(held, asked)) {
				db.sql("delete from account_admin_right where account_id = ? and right_code = ?")
						.params(moderator.get(), gone).update();
			}

			for (String given : minus(asked, held)) {
				db.sql("insert into account_admin_right (account_id, right_code) values (?, ?)")
						.params(moderator.get(), given).update();
			}

			/* READ BACK OUT OF THE TABLE AND NOT HANDED BACK OFF THE REQUEST. The two agree
			   whenever the write worked, which is what makes echoing it look right; the
			   screen redraws itself from this answer, so a resource that echoed would draw
			   a row of boxes nobody had written. */
			return ResponseEntity.ok(new Ticked(moderator.get(), ticksOf(moderator.get())));
		});
	}

	/**
	 * AND TAKING A MODERATOR OUT, WITH EVERYTHING THAT IS ONLY HIS.
	 *
	 * <p>One statement, for the reason written at the top of this class: what goes with him
	 * and what outlives him are both already said by the schema, in three different ways.
	 *
	 * <p><b>Nobody is told, and that is named rather than left silent.</b> Nothing here
	 * writes a row into {@code message}. No decision asks for one; the nearest thing
	 * recorded to „is somebody told when something of his disappears" is the owner's answer
	 * of 11.08.2026 about a member whose result goes with a deleted race, in one word:
	 * „Ne". Reading that across to a moderator's own account is reasoning and not his
	 * sentence, so it is written here as the reason the route stays silent rather than as a
	 * decision it enforces.
	 */
	@DeleteMapping("/api/moderators/{id}")
	@OnlyTheSuperadmin
	ResponseEntity<?> remove(@PathVariable long id) {
		/* THE ROLE IS IN THE STATEMENT AND NOT IN A READING BEFORE IT. Asked as a select
		   and then a delete, the two would be two moments, and the condition that keeps a
		   superadmin out of this would be standing in the first of them. */
		int gone = db.sql("delete from account a using role r"
						+ " where r.id = a.role_id and a.id = ? and r.code = 'moderator'")
				.param(id).update();

		return gone == 0 ? no(HttpStatus.NOT_FOUND, null) : ResponseEntity.noContent().build();
	}

	/**
	 * This key, if it belongs to a moderator.
	 *
	 * <p>The condition is {@link ModeratorApi}'s own, so the set that may be written is the
	 * set that is served. Read as „an account" it would reach a competitor and a
	 * superadmin; read as „an account with administrative standing" it would still reach
	 * the superadmin, who is the one this must not reach.
	 */
	private Optional<Long> moderatorNamed(long id) {
		return db.sql("select a.id from account a join role r on r.id = a.role_id"
						+ " where a.id = ? and r.code = 'moderator'")
				.param(id).query(Long.class).optional();
	}

	/** Every box the matrix holds, off the table that holds them. */
	private Set<String> theMatrixHolds() {
		return new HashSet<>(db.sql("select code from admin_right").query(String.class).list());
	}

	/**
	 * What one account holds, in the order {@link ModeratorApi} answers the list in, so the
	 * row this hands back and the row the screen reloads cannot come out differently
	 * ordered.
	 */
	private List<String> ticksOf(long account) {
		return db.sql("select right_code from account_admin_right where account_id = ?"
				+ " order by right_code").param(account).query(String.class).list();
	}

	/**
	 * Everything in the first that is not in the second, in an order that does not depend
	 * on how a hash fell.
	 *
	 * <p>Sorted because the rows it names are then locked in the same order by every
	 * request there is. Two superadmins saving two rows that overlap would otherwise take
	 * their locks in whatever order two hash sets happened to iterate in, which is the
	 * shape a deadlock has; it costs one word and removes a failure nobody could reproduce.
	 */
	private static List<String> minus(Set<String> these, Set<String> those) {
		return these.stream().filter(one -> !those.contains(one)).sorted().toList();
	}

	/**
	 * A refusal, with a reason where there is one to give.
	 *
	 * <p>404 carries no body, which is the shape {@link RightsAtTheDoor} answers a refused
	 * moderator with: an account this may not touch and one that is not there have to read
	 * the same, and a reason is something only one of them could have.
	 */
	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return reason == null ? ResponseEntity.status(status).build()
				: ResponseEntity.status(status).body(new Refused(reason));
	}
}
