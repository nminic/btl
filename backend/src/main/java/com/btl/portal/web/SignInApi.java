package com.btl.portal.web;

import com.btl.portal.domain.account.SignIn;
import com.btl.portal.domain.token.SecretToken;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Optional;

/**
 * Signing in, which is the first thing on this server that writes anything.
 *
 * <p><b>Every no is the same no.</b> An address nobody has, a wrong password, an
 * account with no password, an account whose address nobody has confirmed, an
 * account that is shut: all five come back 401 with nothing in the body. Told apart,
 * this endpoint becomes a way of asking the portal who its members are, and it must
 * not answer that to somebody who is not one. {@link SignIn} keeps the difference
 * that matters - what the server does next - without ever putting it in the answer.
 *
 * <p><b>The fourth of those five arrived with B58</b>, which is the increment that
 * made it possible for an account to exist at all: registration writes one whose
 * address nobody has confirmed yet, and PDL, owner of 31.07.2026, says what that
 * account may do until he does - "Dok adresa nije potvrdjena, nema pristupa portalu
 * ni placanja." Until there was a registration path there was no such row, and the
 * rule had nothing to be true about.
 *
 * <p><b>The whole thing is one transaction.</b> Two people signing in at the same
 * address at the same moment must not both read nine misses and both write ten;
 * the row is read for update so the second waits for the first.
 */
@RestController
class SignInApi {

	private final JdbcClient db;

	SignInApi(JdbcClient db) {
		this.db = db;
	}

	/** What the form sends. Both are required, and a blank password is refused
	 *  before any comparison rather than compared against and found wanting. */
	record Typed(@NotBlank String email, @NotBlank String password) {
	}

	private record Found(long id, String passwordHash, int failedSignIns, Instant lockedUntil,
			Instant addressConfirmedAt) {
	}

	@PostMapping("/api/sign-in")
	@Transactional
	ResponseEntity<Void> signIn(@RequestBody Typed typed) {
		/* No check for the whole form being absent: `@RequestBody` is required, so a
		   request with no body is turned away with 400 before this method runs at all.
		   A check for it was written here and removed, because a branch nothing can
		   reach is a branch nothing can measure - `aRequestWithNoFormAtAllNeverReachesUs`
		   is what holds that guarantee instead. */
		if (typed.email() == null || typed.password() == null
				|| typed.email().isBlank() || typed.password().isBlank()) {
			return no();
		}

		/* FOR UPDATE, so two people typing at one address at one moment cannot both
		   read nine misses and both write ten. */
		/* `email_confirmed_at` IS READ HERE AND IS NOT A CONDITION OF THE QUERY, and the
		   difference is the whole of it. Written as `and email_confirmed_at is not null`
		   the row would simply not be found, an unconfirmed account would take the same
		   road as an address nobody has, and the FOR UPDATE above would stop locking the
		   row this request is about. Read as a column, `SignIn` decides - which is where
		   every other rule about getting in already lives, and the only place a case can
		   measure this one without a database. */
		Optional<Found> found = db.sql("select id, password_hash, failed_sign_ins, locked_until,"
						+ " email_confirmed_at"
						+ " from account where email = ? for update")
				.param(typed.email())
				.query((row, one) -> new Found(row.getLong(1), row.getString(2), row.getInt(3),
						row.getTimestamp(4) == null ? null : row.getTimestamp(4).toInstant(),
						row.getTimestamp(5) == null ? null : row.getTimestamp(5).toInstant()))
				.optional();

		Instant now = Instant.now();
		SignIn.Account account = found
				.map(one -> new SignIn.Account(one.passwordHash(), one.failedSignIns(),
						one.lockedUntil(), one.addressConfirmedAt()))
				.orElse(null);

		return switch (SignIn.decide(account, typed.password(), now)) {
			case WELCOME -> welcome(found.orElseThrow().id());
			case COUNT_THE_MISS -> countTheMiss(found.orElseThrow(), now);
			case DO_NOTHING -> no();
		};
	}

	private ResponseEntity<Void> welcome(long account) {
		SecretToken session = SecretToken.fresh();

		/* The misses are forgotten and the lock with them: they count guesses at an
		   account, and somebody who has just signed in was not guessing. */
		db.sql("update account set failed_sign_ins = 0, locked_until = null where id = ?")
				.param(account).update();

		db.sql("insert into account_session (account_id, token_hash) values (?, ?)")
				.params(account, session.hash()).update();

		return ResponseEntity.noContent()
				.header(HttpHeaders.SET_COOKIE, SessionCookie.carrying(session.secret()).toString())
				.build();
	}

	private ResponseEntity<Void> countTheMiss(Found account, Instant now) {
		int misses = SignIn.missesAfter(account.failedSignIns());

		db.sql("update account set failed_sign_ins = ?, locked_until = ? where id = ?")
				.params(misses,
						Optional.ofNullable(SignIn.lockedUntilAfter(misses, now))
								.map(java.sql.Timestamp::from).orElse(null),
						account.id())
				.update();

		return no();
	}

	/** The one answer to every way of not getting in. */
	private static ResponseEntity<Void> no() {
		return ResponseEntity.status(401).build();
	}
}
