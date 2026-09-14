package com.btl.portal.domain.account;

import com.btl.portal.domain.account.SignIn.Account;
import com.btl.portal.domain.account.SignIn.Outcome;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** What happens when somebody types an address and a password. */
class SignInTest {

	private static final Instant NOW = Instant.parse("2027-06-15T10:00:00Z");

	private static final String RIGHT = "dvanaest1234sasvim";

	private static final String HASH = new StoredPassword().of(RIGHT);

	/**
	 * WHEN THE MEMBER CONFIRMED HIS ADDRESS, and it is a moment of its own rather than
	 * {@link #NOW}.
	 *
	 * <p>Two different things, deliberately kept apart: the day somebody clicked the link
	 * out of the message, and the moment somebody is typing his password. Held at one
	 * value they would be one constant doing two jobs, and a rule that read the wrong one
	 * would give the same answer in every case in this file.
	 */
	private static final Instant CONFIRMED = NOW.minus(java.time.Duration.ofDays(30));

	private static Account open() {
		return new Account(HASH, 0, null, CONFIRMED);
	}

	/** The same account, at an address nobody has confirmed. */
	private static Account unconfirmed() {
		return new Account(HASH, 0, null, null);
	}

	@Test
	void theRightPasswordGetsIn() {
		assertThat(SignIn.decide(open(), RIGHT, NOW)).isEqualTo(Outcome.WELCOME);
	}

	@Test
	void aWrongPasswordIsCountedAgainstTheAccount() {
		assertThat(SignIn.decide(open(), "nesto drugo", NOW)).isEqualTo(Outcome.COUNT_THE_MISS);
	}

	/**
	 * AN ADDRESS NOBODY HAS COUNTS AGAINST NOTHING.
	 *
	 * <p>Not merely "no". The count lives on a row and there is none, and that is
	 * also what stops a stranger from shutting somebody out of an address he does
	 * not own by typing at it ten times: he cannot, because the row he would be
	 * counting against is the row that has to exist first.
	 */
	@Test
	void anAddressNobodyHasCountsAgainstNothing() {
		assertThat(SignIn.decide(null, RIGHT, NOW)).isEqualTo(Outcome.DO_NOTHING);
	}

	/**
	 * AN ACCOUNT WITH NO PASSWORD IS NOT A WAY IN, AND NOT A THING TO COUNT AT.
	 *
	 * <p>V18 says such an account is a real state: the owner opens them for
	 * honorary members and they set a password through the reset link. The second
	 * half is the one worth the case - a miss counted against an account nobody can
	 * yet sign in to would let anybody shut it for ever, before its owner had once
	 * used it.
	 */
	@Test
	void anAccountWithNoPasswordIsNotAWayIn() {
		assertThat(SignIn.decide(new Account(null, 0, null, CONFIRMED), RIGHT, NOW))
				.isEqualTo(Outcome.DO_NOTHING);
		assertThat(SignIn.decide(new Account(null, 9, null, CONFIRMED), "bilo sta", NOW))
				.as("a miss was counted at an account nobody can sign in to")
				.isEqualTo(Outcome.DO_NOTHING);
	}

	/**
	 * AN ADDRESS NOBODY HAS CONFIRMED IS NOT A WAY IN, AND NOT A THING TO COUNT AT
	 * EITHER.
	 *
	 * <p>The owner, 31.07.2026: „Potvrda adrese elektronske poste je prva, i uslov za sve
	 * ostalo. Dok adresa nije potvrdjena, nema pristupa portalu ni placanja." Registration
	 * writes exactly this account - V6 gives {@code email_confirmed_at} no default so that
	 * an account is born unconfirmed - so without this line every registration would be a
	 * way into the portal at an address nobody had shown he reads.
	 *
	 * <p><b>Both halves, and the second is the one a single assertion would miss.</b> The
	 * right password is refused, which is the rule; and a wrong one is not counted, for
	 * the reason written over the account with no password - a miss at an account nobody
	 * can yet sign in to would let a stranger shut it for ever before its owner had once
	 * used it. Counted, this would also be a way of asking whether an address is
	 * registered: ten wrong guesses at a confirmed account lock it and ten at an
	 * unconfirmed one would not.
	 */
	@Test
	void anAddressNobodyHasConfirmedIsNotAWayIn() {
		assertThat(SignIn.decide(unconfirmed(), RIGHT, NOW))
				.as("the right password opened an account at an address nobody has confirmed")
				.isEqualTo(Outcome.DO_NOTHING);
		assertThat(SignIn.decide(new Account(HASH, 9, null, null), "pogresna", NOW))
				.as("a miss was counted at an account nobody can sign in to")
				.isEqualTo(Outcome.DO_NOTHING);
	}

	/**
	 * AND CONFIRMING IT IS THE ONLY THING THAT CHANGES, which is what says this rule is
	 * about the address and not about anything else on the row.
	 *
	 * <p>Two accounts differing in one component and in nothing else: same hash, same
	 * count, same lock, same password typed at them. One gets in and one does not. Without
	 * this the case above would be just as green if the rule were written about something
	 * else that happens to be empty on a fresh registration.
	 */
	@Test
	void confirmingTheAddressIsTheOnlyDifference() {
		assertThat(SignIn.decide(new Account(HASH, 0, null, CONFIRMED), RIGHT, NOW))
				.isEqualTo(Outcome.WELCOME);
		assertThat(SignIn.decide(new Account(HASH, 0, null, null), RIGHT, NOW))
				.isEqualTo(Outcome.DO_NOTHING);
	}

	/**
	 * AND NOTHING HERE READS THE MEMBERSHIP, which is the one word away this rule could
	 * have gone wrong.
	 *
	 * <p>V6 keeps the two apart and quotes the owner of 11.08.2026 for the reason:
	 * „Clanstvo sme da se aktivira i pre nego sto je adresa potvrdjena." So a paid up
	 * member whose address is still unconfirmed does NOT get in, and that is not a fault -
	 * it is the sentence. This class cannot see a membership at all, which is what makes
	 * that true by construction: {@link Account} carries four things and none of them is
	 * the fee.
	 */
	@Test
	void theMembershipIsNotThisClassesBusiness() {
		assertThat(Account.class.getRecordComponents())
				.as("the account this class decides on grew a component; if it is anything about"
						+ " the membership, V6 and the owner of 11.08.2026 say the two must not"
						+ " be joined")
				.extracting(java.lang.reflect.RecordComponent::getName)
				.containsExactly("passwordHash", "failedSignIns", "lockedUntil", "addressConfirmedAt");
	}

	/**
	 * WHILE IT IS SHUT, NOT EVEN THE RIGHT PASSWORD OPENS IT.
	 *
	 * <p>Otherwise the lock is a suggestion: somebody guessing would simply keep
	 * guessing through it, and the ten misses would have bought nothing.
	 */
	@Test
	void whileItIsShutNotEvenTheRightPasswordOpensIt() {
		Account shut = new Account(HASH, SignIn.ENOUGH_MISSES_TO_LOCK, NOW.plusSeconds(60), CONFIRMED);

		assertThat(SignIn.decide(shut, RIGHT, NOW)).isEqualTo(Outcome.DO_NOTHING);
		assertThat(SignIn.decide(shut, "pogresna", NOW))
				.as("a miss was counted while the account was already shut")
				.isEqualTo(Outcome.DO_NOTHING);
	}

	/**
	 * And the moment it runs out, it is over.
	 *
	 * <p>The boundary belongs to the member: at the very instant the lock expires
	 * the right password works. A comparison written the other way round would hold
	 * him out for one more moment, which is not wrong by much and is wrong by
	 * exactly the amount that makes a boundary worth a case.
	 */
	@Test
	void theMomentTheLockRunsOutItIsOver() {
		assertThat(SignIn.decide(new Account(HASH, 10, NOW, CONFIRMED), RIGHT, NOW))
				.as("the lock held one moment past its own end")
				.isEqualTo(Outcome.WELCOME);
		assertThat(SignIn.decide(new Account(HASH, 10, NOW.plusMillis(1), CONFIRMED), RIGHT, NOW))
				.isEqualTo(Outcome.DO_NOTHING);
	}

	/** A lock that has run out does not stop a miss being counted either, or ten
	 *  more misses would cost nothing. */
	@Test
	void aLockThatHasRunOutStopsNothing() {
		assertThat(SignIn.decide(new Account(HASH, 10, NOW.minusSeconds(1), CONFIRMED), "pogresna", NOW))
				.isEqualTo(Outcome.COUNT_THE_MISS);
	}

	@ParameterizedTest(name = "{0} misses becomes {1}")
	@CsvSource({"0, 1", "1, 2", "8, 9", "9, 10", "10, 11"})
	void aMissIsOneMoreMiss(int before, int after) {
		assertThat(SignIn.missesAfter(before)).isEqualTo(after);
	}

	/**
	 * THE TENTH MISS SHUTS IT, AND THE NINTH DOES NOT.
	 *
	 * <p>Both sides, because "the tenth" is exactly the sort of thing that gets
	 * written as the ninth, and either version passes a case that only looks at one
	 * of them.
	 */
	@Test
	void theTenthMissShutsItAndTheNinthDoesNot() {
		assertThat(SignIn.lockedUntilAfter(SignIn.ENOUGH_MISSES_TO_LOCK - 1, NOW))
				.as("the account was shut one miss early")
				.isNull();
		assertThat(SignIn.lockedUntilAfter(SignIn.ENOUGH_MISSES_TO_LOCK, NOW))
				.isEqualTo(NOW.plus(SignIn.LOCKED_FOR));
	}

	/** And every miss after that shuts it again from the moment of the miss, so
	 *  guessing costs more the longer it goes on. */
	@Test
	void everyFurtherMissShutsItAgainFromThatMoment() {
		assertThat(SignIn.lockedUntilAfter(SignIn.ENOUGH_MISSES_TO_LOCK + 5, NOW.plusSeconds(600)))
				.isEqualTo(NOW.plusSeconds(600).plus(SignIn.LOCKED_FOR));
	}

	@ParameterizedTest
	@ValueSource(ints = {-1, Integer.MIN_VALUE})
	void missesCannotBeCountedBackwards(int misses) {
		assertThatThrownBy(() -> SignIn.missesAfter(misses))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("backwards");
		assertThatThrownBy(() -> new Account(HASH, misses, null, CONFIRMED))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("backwards");
	}

	/**
	 * A NO TAKES THE SAME WORK AS A YES.
	 *
	 * <p>Comparing a password takes bcrypt about a tenth of a second, and three of
	 * the four answers have nothing to compare. Left alone they would come back in a
	 * fraction of the time, and anybody could then ask "is there an account at this
	 * address" by measuring how long the no takes - which is the one question every
	 * other line here refuses to answer.
	 *
	 * <p><b>Counted rather than timed.</b> A case asserting that two paths take the
	 * same number of milliseconds is a coin toss on a loaded machine, and a case
	 * that flickers is worse than none. So this counts how many times the encoder is
	 * asked, which is the thing the time is made of, and asks for one on every path.
	 */
	@Test
	void aNoTakesTheSameWorkAsAYes() {
		java.util.concurrent.atomic.AtomicInteger asked = new java.util.concurrent.atomic.AtomicInteger();

		StoredPassword counting = new StoredPassword(new org.springframework.security.crypto.password.PasswordEncoder() {

			@Override
			public String encode(CharSequence raw) {
				return raw.toString();
			}

			@Override
			public boolean matches(CharSequence raw, String encoded) {
				asked.incrementAndGet();
				return raw.toString().equals(encoded);
			}
		});

		record Path(String named, Account account) {
		}

		List<Path> everyWay = List.of(
				new Path("no such address", null),
				new Path("no password on the account", new Account(null, 0, null, CONFIRMED)),
				/* AND THE ONE B58 ADDED, which is the timing oracle that would otherwise
				   have arrived with registration: an unconfirmed account answered in a
				   fraction of the time would say "somebody registered at this address and
				   has not confirmed it yet" to anybody with a stopwatch. */
				new Path("the address is not confirmed", new Account(HASH, 0, null, null)),
				new Path("the account is shut", new Account(HASH, 10, NOW.plusSeconds(60), CONFIRMED)),
				new Path("the password is wrong", new Account(HASH, 0, null, CONFIRMED)),
				new Path("the password is right", new Account(HASH, 0, null, CONFIRMED)));

		for (Path one : everyWay) {
			asked.set(0);
			SignIn.decide(one.account(), "bilo sta", NOW, counting);

			assertThat(asked.get())
					.as("'%s' asked the encoder %d times, so it can be told apart by how long it takes",
							one.named(), asked.get())
					.isOne();
		}
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> SignIn.decide(open(), null, NOW))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("typed");
		assertThatThrownBy(() -> SignIn.decide(open(), RIGHT, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("now");
		assertThatThrownBy(() -> SignIn.lockedUntilAfter(1, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("now");
	}

	/**
	 * THE ANSWER NEVER SAYS WHETHER THE ADDRESS EXISTS.
	 *
	 * <p>Five ways of not getting in, and four of them come back the same. The one
	 * that differs, COUNT_THE_MISS, differs only in what the SERVER does next and
	 * never in what the member is told; that this is so is the caller's to keep,
	 * and the case for it lives with the endpoint.
	 */
	@Test
	void nothingHereSaysWhetherTheAddressExists() {
		assertThat(SignIn.decide(null, RIGHT, NOW))
				.isEqualTo(SignIn.decide(new Account(null, 0, null, CONFIRMED), RIGHT, NOW))
				.isEqualTo(SignIn.decide(new Account(HASH, 0, null, null), RIGHT, NOW))
				.isEqualTo(SignIn.decide(new Account(HASH, 10, NOW.plusSeconds(60), CONFIRMED), RIGHT, NOW))
				.isEqualTo(Outcome.DO_NOTHING);
	}
}
