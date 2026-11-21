package com.btl.portal.web;

import com.btl.portal.domain.account.WhatAnAddressLooksLike;
import com.btl.portal.domain.attempts.AttemptsPerHour;
import com.btl.portal.domain.attempts.TheNetworkAsking;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.Optional;

/**
 * THE THREE DOORS THAT MAKE THE PORTAL SEND A LETTER TO AN ADDRESS THE CALLER NAMES, AND HOW OFTEN
 * EACH OPENS.
 *
 * <p>Owner, 21.11.2026 (ADL): „Ograničenje broja pokušaja: najviše 5 registracija sa jedne IP adrese
 * na sat, i najviše 3 ponovna slanja poruke za potvrdu po jednoj adresi na sat." The same day, the
 * same three an hour for {@code POST /api/password-reset/request}, by the address too, with the answer
 * still saying nothing about whether the address belongs to anybody.
 *
 * <p><b>Three separate counts.</b> Registering does not spend the allowance of the letter of
 * confirmation and neither spends that of the new password: they are three different things somebody
 * does, and one bucket for all would let a run of one shut the other two.
 *
 * <p><b>Every attempt counts, whatever comes of it</b> (owner, through the coordinator, 21.11.2026:
 * the decision is about „broja pokušaja"). A registration refused for a field left empty or for an
 * address already taken spends the allowance exactly as one that is written does; a request for a
 * letter to an address nobody holds spends it exactly as one that sends. That second half is what
 * keeps the answer silent: the fourth request for any address is refused with the same 429 whether
 * there is an account behind it or not, so the refusal says nothing that 204 did not.
 *
 * <p><b>The numbers are settings, so QA meets what production meets</b> (owner, 21.11.2026: on QA the
 * same limit, through the settings). Neither stack overrides them, so both run with
 * {@code application.properties}.
 *
 * <p><b>The counts live in memory, and a restart of the backend forgets them</b> - see
 * {@link AttemptsPerHour}, which says what that costs and why it was chosen.
 */
@Component
class AttemptsAtTheDoor {

	/**
	 * THE HEADER THE PORTAL'S OWN NGINX WRITES, and the only place this server learns who is asking.
	 *
	 * <p>{@code frontend/nginx.conf} works it out: {@code CF-Connecting-IP} when the request reached
	 * the edge proxy from one of Cloudflare's own addresses, and otherwise the address the edge proxy
	 * saw. {@code frontend/nginx-to-backend.conf} then SETS it on every request it passes on, which
	 * replaces whatever a caller sent under the same name. Nothing else reaches this server: neither
	 * stack publishes the backend's port except QA's, on loopback, for an SSH tunnel.
	 *
	 * <p>Absent, which is a request that did not come through nginx (a test, the tunnel), the address
	 * of the connection itself is counted instead.
	 */
	static final String THE_CALLERS_ADDRESS = "X-Btl-Client-Address";

	/** How many keys each count keeps at once; {@link AttemptsPerHour} says why there is a ceiling. */
	static final int MOST_REMEMBERED = 100_000;

	private static final long A_SECOND = Duration.ofSeconds(1).toNanos();

	private final Clock clock;

	private final AttemptsPerHour registrations;

	private final AttemptsPerHour confirmationLetters;

	private final AttemptsPerHour newPasswordLetters;

	AttemptsAtTheDoor(Clock clock,
			@Value("${btl.attempts.registrations-per-hour}") int registrations,
			@Value("${btl.attempts.confirmation-letters-per-hour}") int confirmationLetters,
			@Value("${btl.attempts.new-password-letters-per-hour}") int newPasswordLetters) {

		this.clock = clock;
		this.registrations = new AttemptsPerHour(registrations, MOST_REMEMBERED);
		this.confirmationLetters = new AttemptsPerHour(confirmationLetters, MOST_REMEMBERED);
		this.newPasswordLetters = new AttemptsPerHour(newPasswordLetters, MOST_REMEMBERED);
	}

	/** A registration, counted by the network it comes from; empty when it is let in. */
	<T> Optional<ResponseEntity<T>> aRegistration(HttpServletRequest asking, T refused) {
		String written = Optional.ofNullable(asking.getHeader(THE_CALLERS_ADDRESS)).orElse(asking.getRemoteAddr());

		/* AN ADDRESS THAT IS NOT ONE IS COUNTED AS WHAT IT SAYS, rather than let through uncounted.
		   nginx never writes such a thing - Cloudflare's header is an address and so is the edge
		   proxy's - so this is a request that came some other way, and an uncounted one is exactly
		   what a script would arrange. */
		String key = TheNetworkAsking.of(written).orElse(written);

		return refusedIf(registrations.knock(key, clock.instant()), refused);
	}

	/** A request for the letter that confirms an address, counted by that address; empty when let in. */
	<T> Optional<ResponseEntity<T>> aConfirmationLetter(String typed, T refused) {
		return refusedIf(confirmationLetters.knock(WhatAnAddressLooksLike.asItIsStored(typed), clock.instant()),
				refused);
	}

	/** A request for the letter with a new password's link, counted by that address; empty when let in. */
	<T> Optional<ResponseEntity<T>> aNewPasswordLetter(String typed, T refused) {
		return refusedIf(newPasswordLetters.knock(WhatAnAddressLooksLike.asItIsStored(typed), clock.instant()),
				refused);
	}

	/**
	 * 429 with the reason and {@code Retry-After}, the seconds until the oldest attempt still counting
	 * runs out, rounded up so that a client which waits exactly that long is let in.
	 */
	private static <T> Optional<ResponseEntity<T>> refusedIf(Optional<Duration> wait, T refused) {
		return wait.map(left -> ResponseEntity.status(429)
				.header(HttpHeaders.RETRY_AFTER, Long.toString(Math.ceilDiv(left.toNanos(), A_SECOND)))
				.body(refused));
	}

}
