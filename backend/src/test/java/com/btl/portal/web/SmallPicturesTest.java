package com.btl.portal.web;

import com.btl.portal.domain.photo.SmallPicture;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT IS KEPT, WHAT IS CUT AGAIN, AND HOW MANY TIMES ONE CIRCLE IS CUT WHEN TWO ASK AT ONCE.
 *
 * <p>Each case counts the calls to the thing that cuts, because that count is the whole of
 * what keeping is for: a kept cut is one the server does not decode again.
 */
class SmallPicturesTest {

	private static final SmallPictures.Key ONE = new SmallPictures.Key("a".repeat(64),
			"0.50000000-0.50000000-1.00000000");

	private static final SmallPictures.Key ANOTHER = new SmallPictures.Key("b".repeat(64),
			"0.50000000-0.50000000-1.00000000");

	private static SmallPicture.Cut cutOf(int bytes) {
		return new SmallPicture.Cut(new byte[bytes], "image/jpeg");
	}

	/** A cutter that counts and always answers with a cut of this many bytes. */
	private static Supplier<Optional<SmallPicture.Cut>> counting(AtomicInteger calls, int bytes) {
		return () -> {
			calls.incrementAndGet();
			return Optional.of(cutOf(bytes));
		};
	}

	@Test
	void aCutIsMadeOnceAndThenKept() {
		SmallPictures small = new SmallPictures(1_000);
		AtomicInteger calls = new AtomicInteger();

		Optional<SmallPicture.Cut> first = small.of(ONE, counting(calls, 10));
		Optional<SmallPicture.Cut> second = small.of(ONE, counting(calls, 10));

		assertThat(calls).as("the second ask cut it again").hasValue(1);
		assertThat(second).containsSame(first.orElseThrow());
	}

	/** A cut that could not be made is not remembered as nothing: the next reader tries again. */
	@Test
	void aCutThatFailedIsTriedAgain() {
		SmallPictures small = new SmallPictures(1_000);
		AtomicInteger calls = new AtomicInteger();

		assertThat(small.of(ONE, () -> {
			calls.incrementAndGet();
			return Optional.empty();
		})).isEmpty();
		assertThat(small.of(ONE, counting(calls, 10))).isPresent();
		assertThat(calls).hasValue(2);
	}

	/**
	 * THE BUDGET IS IN BYTES AND THE OLDEST READ GOES FIRST. Two cuts of six bytes do not fit in
	 * ten, so keeping the second lets the first go - and the first is cut again when asked, while
	 * the second is not.
	 */
	@Test
	void overTheBudgetTheOldestReadGoes() {
		SmallPictures small = new SmallPictures(10);
		AtomicInteger calls = new AtomicInteger();

		small.of(ONE, counting(calls, 6));
		small.of(ANOTHER, counting(calls, 6));
		small.of(ANOTHER, counting(calls, 6));
		assertThat(calls).as("the second was not kept").hasValue(2);

		small.of(ONE, counting(calls, 6));
		assertThat(calls).as("the first was still kept although the budget had no room").hasValue(3);
	}

	/**
	 * TWO READERS OF ONE CIRCLE AT ONE INSTANT START ONE CUT. The first reader's cut is held open
	 * on a latch; the second reader is started only once the first is inside the cutter, and the
	 * first is let go only once the second is parked waiting - so the two really do overlap, and
	 * a second cut would be counted.
	 */
	@Test
	void twoReadersOfOneCircleAtOnceStartOneCut() throws Exception {
		SmallPictures small = new SmallPictures(1_000);
		AtomicInteger calls = new AtomicInteger();
		CountDownLatch inside = new CountDownLatch(1);
		CountDownLatch letGo = new CountDownLatch(1);
		SmallPicture.Cut made = cutOf(10);

		CompletableFuture<Optional<SmallPicture.Cut>> first = CompletableFuture.supplyAsync(
				() -> small.of(ONE, () -> {
					calls.incrementAndGet();
					inside.countDown();
					await(letGo);
					return Optional.of(made);
				}));
		assertThat(inside.await(10, TimeUnit.SECONDS)).isTrue();

		Thread second = new Thread(() -> small.of(ONE, counting(calls, 99)));
		second.start();
		waitUntilParked(second);
		letGo.countDown();
		second.join(10_000);

		assertThat(first.get(10, TimeUnit.SECONDS)).containsSame(made);
		assertThat(calls).as("the second reader cut the same circle again").hasValue(1);
		assertThat(second.isAlive()).isFalse();
	}

	/**
	 * AND A CUT THAT THROWS LETS ITS WAITERS GO, with nothing, rather than holding them for ever.
	 */
	@Test
	void aCutThatThrowsLetsItsWaitersGo() throws Exception {
		SmallPictures small = new SmallPictures(1_000);
		CountDownLatch inside = new CountDownLatch(1);
		CountDownLatch letGo = new CountDownLatch(1);

		CompletableFuture<Optional<SmallPicture.Cut>> first = CompletableFuture.supplyAsync(
				() -> small.of(ONE, () -> {
					inside.countDown();
					await(letGo);
					throw new IllegalStateException("the decoder fell over");
				}));
		assertThat(inside.await(10, TimeUnit.SECONDS)).isTrue();

		CompletableFuture<Optional<SmallPicture.Cut>> waiting = new CompletableFuture<>();
		Thread second = new Thread(() -> waiting.complete(small.of(ONE, () -> Optional.of(cutOf(1)))));
		second.start();
		waitUntilParked(second);
		letGo.countDown();

		assertThat(waiting.get(10, TimeUnit.SECONDS)).isEmpty();
		assertThatThrownBy(() -> first.get(10, TimeUnit.SECONDS))
				.hasRootCauseMessage("the decoder fell over");
	}

	private static void await(CountDownLatch latch) {
		try {
			assertThat(latch.await(10, TimeUnit.SECONDS)).isTrue();
		} catch (InterruptedException stopped) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException(stopped);
		}
	}

	/** Until the thread is parked on something, which here can only be the first reader's cut. */
	private static void waitUntilParked(Thread thread) throws InterruptedException {
		Instant until = Instant.now().plus(Duration.ofSeconds(10));

		while (thread.getState() != Thread.State.WAITING && Instant.now().isBefore(until)) {
			Thread.sleep(5);
		}

		assertThat(thread.getState()).as("the second reader never waited").isEqualTo(Thread.State.WAITING);
	}
}
