package com.btl.portal.domain.card;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

/**
 * WHICH PROFILES FACEBOOK IS ASKED TO READ AGAIN, worked out from what it was last asked about and what the
 * portal shows now, and nothing else.
 *
 * <p>Owner, PDL P11, 15.11.2026, item 10, chosen with the assistant's recommendation: „Facebook se osvežava sa
 * servera: posle svake promene koja menja karticu server traži od Facebooka da ponovo pročita profil." The
 * question „did the card change" is answered here by comparing two states and never by being told about an
 * event, so there is no list of the roads that change a card for a road to be missing from: a result approved,
 * a picture withdrawn, a team left, a fee that lapsed at midnight with nobody doing anything, a profile hidden,
 * all of them are a page whose card or address is not what Facebook was last asked about.
 *
 * <p><b>A PAGE IS ONE PROFILE IN ONE LANGUAGE</b> ({@link Key}), because the two languages are two addresses
 * ({@code /sr/takmicar/...} and {@code /en/takmicar/...}) and two pictures, and Facebook keeps each address on
 * its own. What is compared for a page is {@link Page}: the address of its card, which carries a digest of
 * everything the card draws, and the address of the profile, which carries the name. The two are everything
 * the preview of a pasted profile is made of (the title is the name, the picture is the card).
 *
 * <p><b>WHAT IS ASKED, by the four ways a page can stand:</b>
 * <ul>
 * <li>the same as last time: nothing;</li>
 * <li>shown now and not last time, which is a member whose fee was paid or whose profile came out of hiding:
 * its address, because Facebook may hold the preview of the front page for it from the time it was not shown;</li>
 * <li>shown last time and not now (hidden, lapsed): the address Facebook was last asked about, once, so that it
 * reads the page a visitor now gets, which is the front page's preview, and stops showing the card; and after
 * that nothing, for as long as it stays that way;</li>
 * <li>shown both times and different: the address it has now, and, when the name changed and the address with
 * it, the old address too, because that is the one people pasted.</li>
 * </ul>
 *
 * <p><b>THE FIRST TIME, NOTHING IS ASKED</b> and everything is written down: with nothing written down yet there
 * is no way to tell a card that changed from a card Facebook has never been asked about, and asking about every
 * profile at once is what the limit below is there to prevent.
 *
 * <p><b>AT MOST {@code atMost} ADDRESSES A TIME</b>, pages in the order of their member number and then the
 * language. A page that does not fit is not written down, so the next time it is still different and is asked
 * then: a day the whole portal changes (a new drawing of the card changes every digest) is spread over as many
 * times as it takes, in a fixed order, and none is lost. A page is never split, so a renamed one asks its two
 * addresses together or waits.
 */
public final class WhatFacebookIsAskedAgain {

	/** One profile in one language. */
	public record Key(String memberNumber, String language) {

		public Key {
			Objects.requireNonNull(memberNumber);
			Objects.requireNonNull(language);
		}
	}

	/** What a page shows: the address of its card and the address of the profile, both without the host. */
	public record Page(String card, String address) {

		public Page {
			Objects.requireNonNull(card);
			Objects.requireNonNull(address);
		}
	}

	/**
	 * What one time comes to: the addresses to ask about, in order and each once, the pages to write down as
	 * they stand now, and the pages to forget because they are no longer shown.
	 */
	public record Plan(List<String> addresses, Map<Key, Page> written, Set<Key> forgotten) {

		public Plan {
			addresses = List.copyOf(addresses);
			written = Map.copyOf(written);
			forgotten = Set.copyOf(forgotten);
		}
	}

	private static final Comparator<Key> IN_ORDER =
			Comparator.comparing(Key::memberNumber).thenComparing(Key::language);

	private WhatFacebookIsAskedAgain() {
	}

	/**
	 * @param asked  every page as Facebook was last asked about it
	 * @param now    every page a visitor is shown now
	 * @param atMost how many addresses may be asked about this time, at least one
	 */
	public static Plan plan(Map<Key, Page> asked, Map<Key, Page> now, int atMost) {
		if (atMost < 1) {
			throw new IllegalArgumentException("at least one address must be asked at a time, not " + atMost);
		}

		if (asked.isEmpty()) {
			return new Plan(List.of(), now, Set.of());
		}

		Set<Key> every = new TreeSet<>(IN_ORDER);
		every.addAll(asked.keySet());
		every.addAll(now.keySet());

		Set<String> addresses = new LinkedHashSet<>();
		Map<Key, Page> written = new LinkedHashMap<>();
		Set<Key> forgotten = new LinkedHashSet<>();

		for (Key page : every) {
			Page before = asked.get(page);
			Page after = now.get(page);

			if (Objects.equals(before, after)) {
				continue;
			}

			List<String> these = new ArrayList<>(2);

			if (after != null) {
				these.add(after.address());
			}

			if (before != null && (after == null || !before.address().equals(after.address()))) {
				these.add(before.address());
			}

			if (addresses.size() + these.size() > atMost) {
				break;
			}

			addresses.addAll(these);

			if (after == null) {
				forgotten.add(page);
			} else {
				written.put(page, after);
			}
		}

		return new Plan(new ArrayList<>(addresses), written, forgotten);
	}
}
