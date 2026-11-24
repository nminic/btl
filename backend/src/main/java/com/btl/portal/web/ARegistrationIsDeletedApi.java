package com.btl.portal.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.util.Optional;

/**
 * THE ADMINISTRATION DELETES A REGISTRATION THAT NEVER BECAME A MEMBER, from its row on the screen Uplate.
 *
 * <p>The owner, 23.11.2026: „Kako da obrišem prijavu? Imam dva Borka Olara, želim jednog da obrišem za stalno.
 * Dodaj mi dugme za brisanje prijavljenih članova u listi uplata. Tom akcijom svi njegovi podaci nestaju sa
 * portala.” And, chosen between offered outcomes with my recommendation: „Dugme je samo za prijavu koja nikad
 * nije postala član, isti skup kao kod dugmeta „Obriši nalog” od 20.11.2026 [...] Briše se sve, kao da se
 * nikad nije prijavio.” So who may be deleted is {@link LeavingBeforeBecomingAMember}, the one home of that
 * set, and this asks it and nothing else; the screen draws the button off the same question
 * ({@code mayBeDeleted}, {@link PaymentsDueApi}).
 *
 * <p><b>THE ADDRESS IS {@link MemberDataApi#UNNUMBERED}'s, WITHOUT ITS LAST SEGMENT, and the key is that
 * route's.</b> A registration has no member number, which is what {@code DELETE /api/competitors/{number}}
 * is keyed by, and {@code competitor.id} is the key the screen Uplate already holds for every row and already
 * hands to {@code /api/members/unnumbered/{competitorId}/data} for the pencil beside it. So this route learns
 * nothing about anybody that the screen did not have, and the registration's one address in the portal is
 * the one it is deleted at. My reasoning, not the owner's.
 *
 * <p><b>WHO MAY IS WHO MAY DELETE A MEMBER ON HIS ROW OF THE TABLE OF MEMBERS</b> (derived 23.11.2026 from
 * that precedent, written into the PDL as mine): {@link CompetitorApi#OVER_THE_MEMBERS}, the right of
 * {@code DELETE /api/competitors/{memberNumber}}. A moderator who holds only the payments works on the screen
 * this button stands on and is answered 404 here (ADL A8), as he is at the pencil's address.
 *
 * <p><b>EVERY REFUSAL IS ONE ANSWER, 404 WITH NOTHING IN IT</b>, the shape of {@link MeLeavingApi}: a key
 * nobody has, a key spelt any other way than a key, a member with a number, a registration with something of
 * the league behind it, and one whose account administers the portal. The screen draws the button only where
 * none of that holds, so the one way to reach a refusal from it is that something changed in between (a
 * payment booked a moment ago, a second press in another tab), and then the row is no longer what the
 * button was drawn for.
 *
 * <p><b>THE ORDER OF THE HOLDS IS {@link MeLeavingApi}'s, AND FOR ITS REASON</b>: the account first, then his
 * row, and the question asked under both and not before them, so a payment written for him at the same
 * instant either commits before the holds and is found, or waits on his row and finds him gone. Taken in the
 * same order as that route, the two can never wait on each other.
 *
 * <p><b>THE DELETING IS {@link CompetitorWriteApi#takeAway(long)}</b>, the one act every deletion of a member
 * is, so his account, his sessions, his picture and his rows in the queue of verification go as they go
 * everywhere else. No mail is sent (the owner, 20.11.2026, „Mejl posle brisanja se ne šalje.”, and the
 * derivation of 23.11.2026 that it holds here too).
 *
 * <p><b>AND ONE LINE IN THE LOG, WITH THE NUMBER OF THE ACCOUNT AND THE TIME AND NOTHING ELSE</b>, written
 * once the transaction has committed so that it never names a deletion that rolled back. The owner,
 * 20.11.2026, chosen with my recommendation: „Brisanje naloga ostavlja jedan red u logu servera, samo sa
 * brojem naloga i vremenom, bez imena i adrese. Važi za dugme „Obriši nalog” i za administrativno brisanje.”
 */
@RestController
class ARegistrationIsDeletedApi {

	private static final Logger LOG = LoggerFactory.getLogger(ARegistrationIsDeletedApi.class);

	/** The address, which {@code ARegistrationIsDeletedApiTest} and the screen's own address both spell. */
	static final String A_REGISTRATION = "/api/members/unnumbered/{competitorId}";

	private final JdbcClient db;

	private final MemberDataApi registrations;

	private final LeavingBeforeBecomingAMember whoMay;

	private final CompetitorWriteApi members;

	private final TransactionTemplate inOneTransaction;

	private final Clock clock;

	ARegistrationIsDeletedApi(JdbcClient db, MemberDataApi registrations, LeavingBeforeBecomingAMember whoMay,
			CompetitorWriteApi members, TransactionTemplate inOneTransaction, Clock clock) {
		this.db = db;
		this.registrations = registrations;
		this.whoMay = whoMay;
		this.members = members;
		this.inOneTransaction = inOneTransaction;
		this.clock = clock;
	}

	@DeleteMapping(A_REGISTRATION)
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<Void> delete(@PathVariable String competitorId) {
		Optional<Long> gone = registrations.unnumbered(competitorId)
				.flatMap(registration -> inOneTransaction.execute(deciding -> deleted(registration)));

		if (gone.isEmpty()) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}

		LOG.info("the registration of account {} was deleted by the administration at {}", gone.orElseThrow(),
				clock.instant());

		return ResponseEntity.noContent().build();
	}

	/**
	 * Whether this registration goes, decided under the holds on its account and on its row, and its deletion
	 * if it does.
	 *
	 * @return the key of the account that went with it, which is all the log may say of it; empty when
	 *         nothing was deleted
	 */
	private Optional<Long> deleted(long registration) {
		/* HIS ACCOUNT HELD FIRST. It was there a moment ago, when the key was read; a press in another tab
		   that deleted him since leaves no row here, and then there is nobody to delete, the same answer as
		   a key nobody has. */
		Optional<Long> account = db.sql("select id from account where competitor_id = ? for update")
				.param(registration)
				.query(Long.class)
				.optional();

		db.sql("select id from competitor where id = ? for update")
				.param(registration).query(Long.class).list();

		return account.filter(his -> whoMay.may(registration)).map(his -> {
			members.takeAway(registration);

			return his;
		});
	}
}
