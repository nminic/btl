package com.btl.portal.web;

import com.btl.portal.domain.photo.SmallPicture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

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
 * photograph and the heap is the thing that runs out first. A cut that fails is not kept, so
 * the next reader tries again, and both readers of a failed cut get the same nothing.
 */
@Component
class SmallPictures {

	private static final Logger LOG = LoggerFactory.getLogger(SmallPictures.class);

	/** Which picture, cut to which circle: the digest and the crop exactly as the address spells them. */
	record Key(String digest, String crop) {
	}

	private final long budget;

	private final Map<Key, SmallPicture.Cut> kept = new LinkedHashMap<>(16, 0.75f, true);

	private long held;

	private final Map<Key, CompletableFuture<Optional<SmallPicture.Cut>>> cutting =
			new ConcurrentHashMap<>();

	private final ReentrantLock oneAtATime = new ReentrantLock();

	SmallPictures(@Value("${btl.photos.small-kept-bytes:8388608}") long budget) {
		this.budget = budget;
	}

	/**
	 * The cut for this key: kept, or being cut by somebody else and waited for, or cut here.
	 *
	 * @param cut what makes it, asked only when nobody has it and nobody is making it; empty
	 *            when it could not be made, which is then not kept
	 */
	Optional<SmallPicture.Cut> of(Key key, Supplier<Optional<SmallPicture.Cut>> cut) {
		Optional<SmallPicture.Cut> already = keptFor(key);

		if (already.isPresent()) {
			return already;
		}

		CompletableFuture<Optional<SmallPicture.Cut>> mine = new CompletableFuture<>();
		CompletableFuture<Optional<SmallPicture.Cut>> theirs = cutting.putIfAbsent(key, mine);

		if (theirs != null) {
			return theirs.join();
		}

		Optional<SmallPicture.Cut> made = Optional.empty();

		try {
			oneAtATime.lock();

			try {
				made = cut.get();
			} finally {
				oneAtATime.unlock();
			}

			made.ifPresent(one -> keep(key, one));
			return made;
		} finally {
			/* In `finally`, so that a cut which throws still lets everyone waiting on it go,
			   with nothing, instead of holding them for ever. */
			cutting.remove(key, mine);
			mine.complete(made);
		}
	}

	private synchronized Optional<SmallPicture.Cut> keptFor(Key key) {
		return Optional.ofNullable(kept.get(key));
	}

	private synchronized void keep(Key key, SmallPicture.Cut cut) {
		kept.put(key, cut);
		held += cut.bytes().length;

		Iterator<SmallPicture.Cut> oldestFirst = kept.values().iterator();

		while (held > budget) {
			held -= oldestFirst.next().bytes().length;
			oldestFirst.remove();
		}

		LOG.debug("{} small pictures kept, {} bytes", kept.size(), held);
	}
}
