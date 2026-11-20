package com.btl.portal.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;
import java.util.Optional;

/**
 * A MEMBER WHO NEVER BECAME ONE DELETES HIS OWN ACCOUNT, „kao da nikad nije ni registrovan" (the owner,
 * 20.11.2026). Who may is {@link LeavingBeforeBecomingAMember}, and this asks it and nothing else.
 *
 * <p><b>THE ANSWERS ARE ADL A8's.</b> Nobody signed in is answered 401 by the chain, before this runs. An
 * account that names no member, a member who does not meet the condition and an account that
 * administers the portal are all answered 404 with nothing in it, the same answer as an address that is
 * not there: a member with a number must not learn from the answer that the act exists for somebody
 * else. 204 when he is gone, with the cookie replaced by one already over, as {@link SignOutApi} replaces
 * it: his session rows went with his account, and a browser that kept the cookie would go on sending
 * something nothing answers. The route takes no body, and CSRF stays on, as on every write.
 *
 * <p><b>THE ORDER IS THE ONE EVERY DELETION OF A MEMBER KEEPS</b> ({@link UnconfirmedAccountsAreSwept},
 * {@link ProfilesPastTheirKeepingAreDeleted}): his account held first, then his row, and the condition
 * asked under both holds and not before them. A payment, a season or a team written for him in the same
 * instant either commits before the hold and the question finds it, or waits on his row (a row that
 * points at his takes a share of its lock) and finds him gone. Asked before the holds, it would delete a
 * member whose payment had just been booked, and the payment would stay without his name (V79). The
 * same holds for two tabs pressing at once: the second waits on the account, then finds none.
 *
 * <p><b>THE DELETING IS {@link CompetitorWriteApi#takeAway(long)}, NEVER A COPY OF IT</b>, so his
 * account, sessions, pictures and everything else go as they go for every other deletion. A partner of a
 * pair is told by it, which cannot happen here (see {@link LeavingBeforeBecomingAMember}), and no mail
 * is sent (the owner, 20.11.2026, chosen with my recommendation: no mail after the deletion).
 */
@RestController
class MeLeavingApi {

	private final JdbcClient db;

	private final LeavingBeforeBecomingAMember whoMay;

	private final CompetitorWriteApi members;

	private final TransactionTemplate inOneTransaction;

	MeLeavingApi(JdbcClient db, LeavingBeforeBecomingAMember whoMay, CompetitorWriteApi members,
			TransactionTemplate inOneTransaction) {
		this.db = db;
		this.whoMay = whoMay;
		this.members = members;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * @param asking never null here: the chain answers 401 before this method runs
	 */
	@DeleteMapping("/api/me")
	ResponseEntity<Void> leave(@AuthenticationPrincipal WhoIsAsking.Member asking) {
		if (!Boolean.TRUE.equals(inOneTransaction.execute(deciding -> leaves(asking.account())))) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}

		return ResponseEntity.noContent()
				.header(HttpHeaders.SET_COOKIE, SessionCookie.gone().toString())
				.build();
	}

	/**
	 * Whether this account's member goes, decided under the holds on the account and on his row, and his
	 * deletion if he does. {@code ALeavingAsSomethingIsWrittenForHimTest} holds the order, with a second
	 * transaction, because one thread cannot reach it.
	 *
	 * <p>The account is read under its own hold, so an account deleted by a second press a moment ago
	 * answers no row and an account that races for nobody answers a row with no member, and both are
	 * nobody to delete.
	 */
	private boolean leaves(long account) {
		Optional<Long> his = db.sql("select competitor_id from account where id = ? for update")
				.param(account)
				.query((row, one) -> row.getObject(1, Long.class))
				.list().stream().filter(Objects::nonNull).findFirst();

		if (his.isEmpty()) {
			return false;
		}

		long member = his.orElseThrow();

		db.sql("select id from competitor where id = ? for update")
				.param(member).query(Long.class).list();

		if (!whoMay.may(member)) {
			return false;
		}

		members.takeAway(member);

		return true;
	}
}
