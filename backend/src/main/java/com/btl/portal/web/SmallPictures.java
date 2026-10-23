package com.btl.portal.web;

import com.btl.portal.domain.photo.SmallPicture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * THE SMALL PICTURES ALREADY CUT, KEPT IN MEMORY, AND CUT ONCE EACH NO MATTER WHO ASKS.
 *
 * <p><b>Cut when first asked for and not when the picture is sent, and the pictures already on
 * the production server are the reason.</b> A cut made at sending would leave every picture
 * sent before this class existed with no small one, and would need a second pass written to
 * fill them in; a cut made when first asked for covers both with one road. The price is the
 * first reader after each start of the server waiting for a decode, a few tens of milliseconds
 * a circle. My technical decision, written to ADL, not the owner's.
 *
 * <p><b>In memory and not on the disk, and that is a decision about the members' data and not
 * about speed.</b> The pictures folder is swept of every file no row names
 * ({@link ThePicturesFolderIsSwept}) and copied off the server encrypted (ADL O19), and a
 * cut face is a member's face: a second file of it would have to be found and deleted every
 * time the first one is, by the sweep and by every road that deletes a picture. Kept here it
 * leaves with the process, is never in a backup, and is never served without the question
 * {@link PhotoApi#small} asks first - so a cut whose picture is gone is a few kilobytes no
 * request can reach, until the memory is wanted for something else.
 *
 * <p><b>Bounded by bytes, oldest read first out.</b> {@code deploy/compose.prod.yml} gives the
 * whole backend 640 MB, so the budget is small and named: a cut of 240 pixels is ten to twenty
 * kilobytes, so the default holds several hundred of them, which is more members than have a
 * picture.
 *
 * <p><b>Two readers asking for one circle at one instant start one cut, not two</b>: the
 * second waits on the first's {@link CompletableFuture} and gets its bytes. And cuts of
 * DIFFERENT circles take turns, one at a time across the whole server, because each decodes a
 * photograph and the heap is the thing that runs out first.
 *
 * <p><b>AND NOBODY WAITS LONGER THAN {@code btl.photos.small-wait-millis}</b> (review of PR 639,
 * round 1: one lock and a wait with no end held request threads, so many uncut circles asked at
 * once could stall every route of the portal). A reader who cannot get the turn, or whose
 * circle somebody else is still cutting, in that time is answered {@link Answer#BUSY}, and the
 * route turns that into a refusal the circle on the screen answers by drawing the original
 * ({@code frontend/src/components/Portrait.tsx}). Nothing about a busy answer is remembered, so
 * the next reader tries again.
 *
 * <p><b>A picture that cannot be cut is remembered as such and is not cut again</b> - a file
 * that is not a picture, one over the ceiling of pixels, and one whose decoder ran out of
 * memory, which is caught here rather than left to take the request thread with it. The
 * address names the content and the circle, so the same key would fail the same way every
 * time; deciding it again on every request is the „ponavlja se pri svakom zahtevu" the review
 * measured. A file that is missing is NOT remembered: that is the disk, and a restored volume
 * brings it back.
 */
@Component
class SmallPictures {

	private static final Logger LOG = LoggerFactory.getLogger(SmallPictures.class);

	/** How many keys that could not be cut are remembered, oldest first out. */
	static final int NEVER_AT_MOST = 1024;

	/** Which picture, cut to which circle: the digest and the crop exactly as the address spells them. */
	record Key(String digest, String crop) {
	}

	/** What makes a cut: nothing when the file is not there, and a throw when it cannot be cut. */
	interface Cutter {
		Optional<SmallPicture.Cut> cut() throws IOException;
	}

	/**
	 * The cut, or nothing, or „not now".
	 *
	 * @param cut  the cut, empty for a picture with no file and for one that cannot be cut
	 * @param busy true when the reader waited his whole term for the turn or for another reader's
	 *             cut of the same circle; the cut is then empty and nothing is remembered
	 */
	record Answer(Optional<SmallPicture.Cut> cut, boolean busy) {

		static final Answer NOTHING = new Answer(Optional.empty(), false);

		static final Answer BUSY = new Answer(Optional.empty(), true);
	}

	private final long budget;

	private final long waitMillis;

	private final Map<Key, SmallPicture.Cut> kept = new LinkedHashMap<>(16, 0.75f, true);

	private long held;

	private final Map<Key, Boolean> never = new LinkedHashMap<>(16, 0.75f, true) {
		@Override
		protected boolean removeEldestEntry(Map.Entry<Key, Boolean> eldest) {
			return size() > NEVER_AT_MOST;
		}
	};

	private final Map<Key, CompletableFuture<Answer>> cutting = new ConcurrentHashMap<>();

	private final ReentrantLock oneAtATime = new ReentrantLock();

	SmallPictures(@Value("${btl.photos.small-kept-bytes:8388608}") long budget,
			@Value("${btl.photos.small-wait-millis:3000}") long waitMillis) {
		this.budget = budget;
		this.waitMillis = waitMillis;
	}

	/**
	 * The cut for this key: kept, or known not to be cuttable, or being cut by somebody else and
	 * waited for, or cut here.
	 */
	Answer of(Key key, Cutter cutter) {
		Optional<SmallPicture.Cut> already = keptFor(key);

		if (already.isPresent()) {
			return new Answer(already, false);
		}

		if (cannotBeCut(key)) {
			return Answer.NOTHING;
		}

		CompletableFuture<Answer> mine = new CompletableFuture<>();
		CompletableFuture<Answer> theirs = cutting.putIfAbsent(key, mine);

		if (theirs != null) {
			/* A copy, so that the term set here is this reader's and does not complete the
			   cutter's own future for every other reader waiting on it. */
			return theirs.copy().completeOnTimeout(Answer.BUSY, waitMillis, TimeUnit.MILLISECONDS)
					.join();
		}

		Answer made = Answer.BUSY;

		try {
			made = inTurn(key, cutter);
			return made;
		} finally {
			/* In `finally`, so that a cut which throws still lets everyone waiting on it go,
			   with „not now", instead of holding them until their own term ends. */
			cutting.remove(key, mine);
			mine.complete(made);
		}
	}

	private Answer inTurn(Key key, Cutter cutter) {
		boolean mine;

		try {
			mine = oneAtATime.tryLock(waitMillis, TimeUnit.MILLISECONDS);
		} catch (InterruptedException stopped) {
			Thread.currentThread().interrupt();
			return Answer.BUSY;
		}

		if (!mine) {
			return Answer.BUSY;
		}

		try {
			Optional<SmallPicture.Cut> cut = cutter.cut();
			cut.ifPresent(one -> keep(key, one));
			return new Answer(cut, false);
		} catch (IOException | RuntimeException | OutOfMemoryError cannot) {
			LOG.warn("picture {} could not be cut to {}: {}", key.digest(), key.crop(),
					cannot.toString());
			neverAgain(key);
			return Answer.NOTHING;
		} finally {
			oneAtATime.unlock();
		}
	}

	private synchronized Optional<SmallPicture.Cut> keptFor(Key key) {
		return Optional.ofNullable(kept.get(key));
	}

	private synchronized boolean cannotBeCut(Key key) {
		return never.containsKey(key);
	}

	private synchronized void neverAgain(Key key) {
		never.put(key, Boolean.TRUE);
	}

	/**
	 * Keeps a cut and lets the oldest read go while the budget is over.
	 *
	 * <p><b>A key kept again REPLACES its bytes in the count</b>, which is the correction of the
	 * review of PR 639: counted twice, the phantom bytes outgrew the budget, the loop emptied the
	 * map and asked it for one more, and every cut after that was a 500 until the server was
	 * started again. Package-private, with {@link #held()}, so that the count is measured against
	 * what is really kept.
	 */
	synchronized void keep(Key key, SmallPicture.Cut cut) {
		SmallPicture.Cut before = kept.put(key, cut);
		held += cut.bytes().length - (before == null ? 0 : before.bytes().length);

		Iterator<SmallPicture.Cut> oldestFirst = kept.values().iterator();

		while (held > budget && oldestFirst.hasNext()) {
			held -= oldestFirst.next().bytes().length;
			oldestFirst.remove();
		}
	}

	/** The bytes the count says are kept. */
	synchronized long held() {
		return held;
	}

	/** The bytes really kept, added up. */
	synchronized long reallyHeld() {
		return kept.values().stream().mapToLong(one -> one.bytes().length).sum();
	}
}
