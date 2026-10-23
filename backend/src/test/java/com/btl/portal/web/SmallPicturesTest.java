package com.btl.portal.web;

import com.btl.portal.domain.photo.SmallPicture;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT IS KEPT, WHAT IS CUT AGAIN, HOW MANY TIMES ONE CIRCLE IS CUT WHEN TWO ASK AT ONCE, AND HOW
 * LONG ANYBODY WAITS.
 *
 * <p>Each case counts the calls to the thing that cuts, because that count is the whole of
 * what keeping is for: a kept cut is one the server does not decode again.
 */
class SmallPicturesTest {

	private static final SmallPictures.Key ONE = new SmallPictures.Key("a".repeat(64),
			"0.50000000-0.50000000-1.00000000");

	private static final SmallPictures.Key ANOTHER = new SmallPictures.Key("b".repeat(64),
			"0.50000000-0.50000000-1.00000000");

	/** Long enough that nothing in a case that is not about the term ever reaches it. */
	private static final long NO_HURRY = 10_000;

	/** Short, for the cases that are about the term. */
	private static final long A_SHORT_TERM = 200;

	private static SmallPicture.Cut cutOf(int bytes) {
		return new SmallPicture.Cut(new byte[bytes], "image/jpeg");
	}

	/** A cutter that counts and always answers with a cut of this many bytes. */
	private static SmallPictures.Cutter counting(AtomicInteger calls, int bytes) {
		return () -> {
			calls.incrementAndGet();
			return Optional.of(cutOf(bytes));
		};
	}

	@Test
	void aCutIsMadeOnceAndThenKept() {
		SmallPictures small = new SmallPictures(1_000, NO_HURRY);
		AtomicInteger calls = new AtomicInteger();

		SmallPictures.Answer first = small.of(ONE, counting(calls, 10));
		SmallPictures.Answer second = small.of(ONE, counting(calls, 10));

		assertThat(calls).as("the second ask cut it again").hasValue(1);
		assertThat(second.cut()).containsSame(first.cut().orElseThrow());
		assertThat(second.busy()).isFalse();
	}

	/** A file that is not there is the disk and not the picture: the next reader tries again. */
	@Test
	void aMissingFileIsTriedAgain() {
		SmallPictures small = new SmallPictures(1_000, NO_HURRY);
		AtomicInteger calls = new AtomicInteger();

		assertThat(small.of(ONE, () -> {
			calls.incrementAndGet();
			return Optional.empty();
		})).isEqualTo(SmallPictures.Answer.NOTHING);
		assertThat(small.of(ONE, counting(calls, 10)).cut()).isPresent();
		assertThat(calls).hasValue(2);
	}

	/**
	 * A PICTURE THAT CANNOT BE CUT IS NOT CUT AGAIN, whatever it threw - a file that is no picture,
	 * a picture over the ceiling, an unchecked fault, and a decoder that ran out of memory, which is
	 * caught rather than left to take the request with it (review of PR 639, round 1, S1: the same
	 * file failed the same way on every request).
	 */
	@Test
	void aPictureThatCannotBeCutIsNotCutAgain() {
		for (Throwable thrown : List.of(new IOException("not a picture"),
				new IllegalStateException("a reader fault"), new OutOfMemoryError("Java heap space"))) {
			SmallPictures small = new SmallPictures(1_000, NO_HURRY);
			AtomicInteger calls = new AtomicInteger();
			SmallPictures.Cutter failing = () -> {
				calls.incrementAndGet();
				throw sneaky(thrown);
			};

			/* Asked through `assertThatCode`, so that a throw which escapes is a failed case and not
			   an error that takes the whole test run with it: an OutOfMemoryError left loose here
			   ends the forked JVM, which is exactly what it would do to a request thread. */
			SmallPictures.Answer[] answered = new SmallPictures.Answer[1];
			assertThatCode(() -> answered[0] = small.of(ONE, failing)).as("%s escaped", thrown)
					.doesNotThrowAnyException();
			assertThat(answered[0]).as("%s", thrown).isEqualTo(SmallPictures.Answer.NOTHING);
			assertThat(small.of(ONE, counting(calls, 10))).as("%s", thrown)
					.isEqualTo(SmallPictures.Answer.NOTHING);
			assertThat(calls).as("%s was cut again", thrown).hasValue(1);
		}
	}

	/** And that memory is bounded too: past its size the oldest such key is tried again. */
	@Test
	void theKeysThatCannotBeCutAreBounded() {
		SmallPictures small = new SmallPictures(1_000, NO_HURRY);
		SmallPictures.Cutter failing = () -> {
			throw new IOException("not a picture");
		};

		small.of(ONE, failing);
		for (int one = 0; one < SmallPictures.NEVER_AT_MOST; one++) {
			small.of(new SmallPictures.Key(String.format("%064d", one), "x"), failing);
		}

		AtomicInteger calls = new AtomicInteger();
		assertThat(small.of(ONE, counting(calls, 10)).cut()).isPresent();
		assertThat(calls).hasValue(1);
	}

	/**
	 * THE BUDGET IS IN BYTES AND THE OLDEST READ GOES FIRST. Two cuts of six bytes do not fit in
	 * ten, so keeping the second lets the first go - and the first is cut again when asked, while
	 * the second is not.
	 */
	@Test
	void overTheBudgetTheOldestReadGoes() {
		SmallPictures small = new SmallPictures(10, NO_HURRY);
		AtomicInteger calls = new AtomicInteger();

		small.of(ONE, counting(calls, 6));
		small.of(ANOTHER, counting(calls, 6));
		small.of(ANOTHER, counting(calls, 6));
		assertThat(calls).as("the second was not kept").hasValue(2);

		small.of(ONE, counting(calls, 6));
		assertThat(calls).as("the first was still kept although the budget had no room").hasValue(3);
		assertThat(small.held()).isEqualTo(small.reallyHeld()).isEqualTo(6);
	}

	/**
	 * ONE KEY KEPT TWICE IS COUNTED ONCE (review of PR 639, round 1, S3). Counted twice, the count
	 * outgrew what was kept, the loop asked an empty map for one more and threw, and every cut
	 * after that was a 500 until a restart. And a budget nothing fits in empties the map without
	 * throwing.
	 */
	@Test
	void oneKeyKeptTwiceIsCountedOnce() {
		SmallPictures small = new SmallPictures(1_000, NO_HURRY);

		small.keep(ONE, cutOf(300));
		small.keep(ONE, cutOf(400));
		small.keep(ONE, cutOf(400));

		assertThat(small.held()).isEqualTo(small.reallyHeld()).isEqualTo(400);

		SmallPictures nothingFits = new SmallPictures(-1, NO_HURRY);
		nothingFits.keep(ONE, cutOf(10));
		assertThat(nothingFits.held()).isEqualTo(nothingFits.reallyHeld()).isZero();
	}

	/**
	 * TWO READERS OF ONE CIRCLE AT ONE INSTANT START ONE CUT. The first reader's cut is held open
	 * on a latch; the second reader is started only once the first is inside the cutter, and the
	 * first is let go only once the second is parked waiting - so the two really do overlap, and
	 * a second cut would be counted.
	 */
	@Test
	void twoReadersOfOneCircleAtOnceStartOneCut() throws Exception {
		SmallPictures small = new SmallPictures(1_000, NO_HURRY);
		AtomicInteger calls = new AtomicInteger();
		CountDownLatch inside = new CountDownLatch(1);
		CountDownLatch letGo = new CountDownLatch(1);
		SmallPicture.Cut made = cutOf(10);

		CompletableFuture<SmallPictures.Answer> first = CompletableFuture.supplyAsync(
				() -> small.of(ONE, () -> {
					calls.incrementAndGet();
					inside.countDown();
					await(letGo);
					return Optional.of(made);
				}));
		assertThat(inside.await(10, TimeUnit.SECONDS)).isTrue();

		CompletableFuture<SmallPictures.Answer> secondsAnswer = new CompletableFuture<>();
		Thread second = new Thread(() -> secondsAnswer.complete(small.of(ONE, counting(calls, 99))));
		second.start();
		waitUntilParked(second);
		letGo.countDown();

		assertThat(first.get(10, TimeUnit.SECONDS).cut()).containsSame(made);
		assertThat(secondsAnswer.get(10, TimeUnit.SECONDS).cut()).containsSame(made);
		assertThat(calls).as("the second reader cut the same circle again").hasValue(1);
	}

	/**
	 * CUTS OF TWO DIFFERENT CIRCLES TAKE TURNS, AND THE TURN HAS A TERM (review of PR 639, round 1,
	 * S2). While the first is cutting, the second is not let into its own cutter at all; when its
	 * term runs out it is answered „not now" - in about the term, not after the first cut - and
	 * once the first has finished the same circle is cut.
	 */
	@Test
	void cutsOfTwoCirclesTakeTurnsAndTheWaitHasATerm() throws Exception {
		SmallPictures small = new SmallPictures(1_000, A_SHORT_TERM);
		CountDownLatch inside = new CountDownLatch(1);
		CountDownLatch letGo = new CountDownLatch(1);
		AtomicBoolean anotherWasLetIn = new AtomicBoolean();

		CompletableFuture<SmallPictures.Answer> first = CompletableFuture.supplyAsync(
				() -> small.of(ONE, () -> {
					inside.countDown();
					await(letGo);
					return Optional.of(cutOf(10));
				}));
		assertThat(inside.await(10, TimeUnit.SECONDS)).isTrue();

		Instant asked = Instant.now();
		SmallPictures.Answer meanwhile = small.of(ANOTHER, () -> {
			anotherWasLetIn.set(true);
			return Optional.of(cutOf(10));
		});
		Duration waited = Duration.between(asked, Instant.now());

		assertThat(anotherWasLetIn).as("a second circle was cut while the first was").isFalse();
		assertThat(meanwhile).isEqualTo(SmallPictures.Answer.BUSY);
		assertThat(waited).as("it did not wait for its turn at all")
				.isGreaterThanOrEqualTo(Duration.ofMillis(A_SHORT_TERM - 20));

		letGo.countDown();
		assertThat(first.get(10, TimeUnit.SECONDS).cut()).isPresent();
		assertThat(small.of(ANOTHER, () -> Optional.of(cutOf(10))).cut())
				.as("„not now” was remembered as „never”").isPresent();
	}

	/** And a reader of the SAME circle waits on the cutter only as long as his term, too. */
	@Test
	void waitingOnAnotherReadersCutOfTheSameCircleHasATerm() throws Exception {
		SmallPictures small = new SmallPictures(1_000, A_SHORT_TERM);
		CountDownLatch inside = new CountDownLatch(1);
		CountDownLatch letGo = new CountDownLatch(1);

		CompletableFuture<SmallPictures.Answer> first = CompletableFuture.supplyAsync(
				() -> small.of(ONE, () -> {
					inside.countDown();
					await(letGo);
					return Optional.of(cutOf(10));
				}));
		assertThat(inside.await(10, TimeUnit.SECONDS)).isTrue();

		Instant asked = Instant.now();
		assertThat(small.of(ONE, () -> Optional.of(cutOf(99)))).isEqualTo(SmallPictures.Answer.BUSY);
		assertThat(Duration.between(asked, Instant.now()))
				.as("the reader waited on the cutter past his own term")
				.isLessThan(Duration.ofMillis(A_SHORT_TERM + 3_000));

		letGo.countDown();
		assertThat(first.get(10, TimeUnit.SECONDS).cut()).isPresent();
	}

	/** A reader interrupted while waiting for his turn is „not now", and keeps his interrupt. */
	@Test
	void aReaderInterruptedWhileWaitingIsNotNow() throws Exception {
		SmallPictures small = new SmallPictures(1_000, NO_HURRY);
		CountDownLatch inside = new CountDownLatch(1);
		CountDownLatch letGo = new CountDownLatch(1);

		CompletableFuture<SmallPictures.Answer> first = CompletableFuture.supplyAsync(
				() -> small.of(ONE, () -> {
					inside.countDown();
					await(letGo);
					return Optional.of(cutOf(10));
				}));
		assertThat(inside.await(10, TimeUnit.SECONDS)).isTrue();

		CompletableFuture<SmallPictures.Answer> answered = new CompletableFuture<>();
		AtomicBoolean stillInterrupted = new AtomicBoolean();
		Thread second = new Thread(() -> {
			answered.complete(small.of(ANOTHER, () -> Optional.of(cutOf(10))));
			stillInterrupted.set(Thread.currentThread().isInterrupted());
		});
		second.start();
		waitUntilParked(second);
		second.interrupt();
		second.join(10_000);

		assertThat(answered.get(10, TimeUnit.SECONDS)).isEqualTo(SmallPictures.Answer.BUSY);
		assertThat(stillInterrupted).isTrue();

		letGo.countDown();
		first.get(10, TimeUnit.SECONDS);
	}

	/**
	 * AND A CUT THAT THROWS SOMETHING NOBODY CATCHES LETS ITS WAITERS GO, with „not now", rather
	 * than holding them until their term ends.
	 */
	@Test
	void aCutThatThrowsLetsItsWaitersGo() throws Exception {
		SmallPictures small = new SmallPictures(1_000, NO_HURRY);
		CountDownLatch inside = new CountDownLatch(1);
		CountDownLatch letGo = new CountDownLatch(1);

		CompletableFuture<SmallPictures.Answer> first = CompletableFuture.supplyAsync(
				() -> small.of(ONE, () -> {
					inside.countDown();
					await(letGo);
					throw new AssertionError("the decoder fell over");
				}));
		assertThat(inside.await(10, TimeUnit.SECONDS)).isTrue();

		CompletableFuture<SmallPictures.Answer> waiting = new CompletableFuture<>();
		Thread second = new Thread(() -> waiting.complete(small.of(ONE, () -> Optional.of(cutOf(1)))));
		second.start();
		waitUntilParked(second);
		Instant released = Instant.now();
		letGo.countDown();

		assertThat(waiting.get(5, TimeUnit.SECONDS)).isEqualTo(SmallPictures.Answer.BUSY);
		assertThat(Duration.between(released, Instant.now()))
				.as("the waiter was held until its own term").isLessThan(Duration.ofSeconds(5));
		assertThatThrownBy(() -> first.get(10, TimeUnit.SECONDS))
				.hasRootCauseMessage("the decoder fell over");
	}

	@SuppressWarnings("unchecked")
	private static <T extends Throwable> RuntimeException sneaky(Throwable thrown) throws T {
		throw (T) thrown;
	}

	private static void await(CountDownLatch latch) {
		try {
			assertThat(latch.await(10, TimeUnit.SECONDS)).isTrue();
		} catch (InterruptedException stopped) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException(stopped);
		}
	}

	/** Until the thread is parked on something, which here can only be the first reader. */
	private static void waitUntilParked(Thread thread) throws InterruptedException {
		Instant until = Instant.now().plus(Duration.ofSeconds(10));

		while (thread.getState() != Thread.State.WAITING
				&& thread.getState() != Thread.State.TIMED_WAITING && Instant.now().isBefore(until)) {
			Thread.sleep(5);
		}

		assertThat(thread.getState()).as("the second reader never waited")
				.isIn(Thread.State.WAITING, Thread.State.TIMED_WAITING);
	}
}
