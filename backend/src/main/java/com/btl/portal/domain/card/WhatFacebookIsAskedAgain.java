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
 * WHICH PROFILES FACEBOOK IS ASKED TO READ AGAIN, worked out from what Facebook has read of each profile and what the
 * portal shows now, and nothing else.
 *
 * <p>Owner, PDL P11, 15.11.2026, item 10, chosen with the assistant's recommendation: „Facebook se osvežava sa
 * servera: posle svake promene koja menja karticu server traži od Facebooka da ponovo pročita profil." The
 * question „did the card change" is answered here by comparing two states and never by being told about an
 * event, so there is no list of the roads that change a card for a road to be missing from: a result approved,
 * a picture withdrawn, a team left, a fee that lapsed at midnight with nobody doing anything, a profile hidden,
 * all of them are a page whose card or address is not what Facebook holds.
 *
 * <p><b>ONLY A PAGE FACEBOOK HAS READ IS EVER ASKED ABOUT.</b> Owner, PDL P11, 16.11.2026, item 14, chosen between
 * the two ways offered, with the assistant's recommendation: the server remembers the profiles Facebook's crawler
 * has already opened and asks Facebook to refresh only those; a profile Facebook has never read is not asked about,
 * because Facebook reads it fresh the first time somebody pastes it. So the plan walks the pages of {@code read} and
 * nothing else: a page that is shown and that Facebook has never read is not in it and asks nothing, however much
 * it changes. That is also why there is no first time here: what Facebook has read is written down when it reads it
 * ({@code WhatFacebookHasRead}), never by this plan.
 *
 * <p><b>A PAGE IS ONE PROFILE IN ONE LANGUAGE</b> ({@link Key}), because the two languages are two addresses
 * ({@code /sr/takmicar/...} and {@code /en/takmicar/...}) and two pictures, and Facebook keeps each address on
 * its own. What is compared for a page is {@link Page}: the address of its card, which carries a digest of
 * everything the card draws, and the address of the profile, which carries the name. The two are everything
 * the preview of a pasted profile is made of (the title is the name, the picture is the card). A page written
 * down as {@linkplain Page#frontPage the front page's} is one where Facebook holds the front page's preview,
 * because the last it was given there was a profile a visitor is not shown.
 *
 * <p><b>WHAT IS ASKED, by the ways a page Facebook has read can stand:</b>
 * <ul>
 * <li>as Facebook holds it: nothing;</li>
 * <li>Facebook holds a card and the profile is no longer shown (hidden, lapsed): the address Facebook holds, once,
 * so that it reads the page a visitor now gets, which is the front page's preview, and stops showing the card;
 * the page is then written down as the front page's, and nothing is asked for as long as it stays so;</li>
 * <li>Facebook holds the front page's preview and the profile is shown again (a fee paid, out of hiding): its
 * address, and the one Facebook holds too when the name has moved it;</li>
 * <li>shown, and not the card Facebook holds: the address it has now, and, when the name changed and the address
 * with it, the old address too, because that is the one people pasted.</li>
 * </ul>
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

	/**
	 * What a page shows, or what Facebook holds of it: the address of its card and the address of the profile, both
	 * without the host. The card is {@code null} for {@linkplain #frontPage the front page's preview}.
	 */
	public record Page(String card, String address) {

		public Page {
			Objects.requireNonNull(address);
		}

		/** The front page's preview at this address, which is what Facebook reads at a profile nobody is shown. */
		public static Page frontPage(String address) {
			return new Page(null, address);
		}
	}

	/**
	 * What one time comes to: the addresses to ask about, in order and each once, and the pages to write down as
	 * Facebook will hold them once it has read them again.
	 */
	public record Plan(List<String> addresses, Map<Key, Page> written) {

		public Plan {
			addresses = List.copyOf(addresses);
			written = Map.copyOf(written);
		}
	}

	private static final Comparator<Key> IN_ORDER =
			Comparator.comparing(Key::memberNumber).thenComparing(Key::language);

	private WhatFacebookIsAskedAgain() {
	}

	/**
	 * @param read   every page Facebook has read, as it holds it
	 * @param now    every page a visitor is shown now
	 * @param atMost how many addresses may be asked about this time, at least one
	 */
	public static Plan plan(Map<Key, Page> read, Map<Key, Page> now, int atMost) {
		if (atMost < 1) {
			throw new IllegalArgumentException("at least one address must be asked at a time, not " + atMost);
		}

		Set<Key> every = new TreeSet<>(IN_ORDER);
		every.addAll(read.keySet());

		Set<String> addresses = new LinkedHashSet<>();
		Map<Key, Page> written = new LinkedHashMap<>();

		for (Key page : every) {
			Page before = read.get(page);
			Page after = now.get(page);
			Page becomes = after != null ? after : Page.frontPage(before.address());

			if (before.equals(becomes)) {
				continue;
			}

			List<String> these = new ArrayList<>(2);

			if (after != null) {
				these.add(after.address());
			}

			if (after == null || !before.address().equals(after.address())) {
				these.add(before.address());
			}

			if (addresses.size() + these.size() > atMost) {
				break;
			}

			addresses.addAll(these);
			written.put(page, becomes);
		}

		return new Plan(new ArrayList<>(addresses), written);
	}
}
