package com.btl.portal.domain.card;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * WHICH ADDRESSES FACEBOOK IS ASKED TO READ AGAIN, worked out from what Facebook was last given at each address its
 * crawler has read and what that address serves now, and nothing else.
 *
 * <p>Owner, PDL P11, 15.11.2026, item 10, chosen with the assistant's recommendation: „Facebook se osvežava sa
 * servera: posle svake promene koja menja karticu server traži od Facebooka da ponovo pročita profil." The
 * question „did the card change" is answered here by comparing two states and never by being told about an
 * event, so there is no list of the roads that change a card for a road to be missing from: a result approved,
 * a picture withdrawn, a team left, a fee that lapsed at midnight with nobody doing anything, a profile hidden, a
 * name changed, all of them are an address that no longer serves what Facebook was given there.
 *
 * <p><b>ONLY AN ADDRESS FACEBOOK HAS READ IS EVER ASKED ABOUT.</b> Owner, PDL P11, 16.11.2026, item 14, chosen between
 * the two ways offered, with the assistant's recommendation: the server remembers the profiles Facebook's crawler
 * has already opened and asks Facebook to refresh only those. So the plan walks the {@link Row rows} it is handed,
 * which are the addresses the crawler read, and nothing else: a profile shown at an address Facebook never read asks
 * nothing, however much it changes, and that includes the new address of a renamed member until the crawler reads
 * it. What Facebook has read is written down when it reads it ({@code WhatFacebookHasRead}), never by this plan.
 *
 * <p><b>ONE ROW IS ONE ADDRESS, AND THAT IS THE WHOLE SHAPE.</b> A row is an address the crawler read the profile of
 * a member at, and the card Facebook was last given there ({@code null} for the front page's preview). Nothing in a
 * row is ever another address, so nothing that is done to a row can lose an address: the crawler adds a row or gives
 * one a new card, this plan gives one a new card, and a row goes only with its member. Three readings of PR 744 lost
 * an address because one record held two (an address the crawler overwrote; an address kept on the side that the
 * plan took out without asking); there is no second address to lose here.
 *
 * <p><b>WHAT AN ADDRESS SERVES IS A QUESTION OF THE ADDRESS ALONE</b> ({@link #profileAt}), because that is how nginx
 * answers it: {@code frontend/nginx.conf} matches the language and the member number in the address and ignores the
 * name after them, so an old address of a renamed member serves his card as it is today, and an address whose number
 * nobody shows (a hidden profile, a lapsed fee, a number that moved, a deleted member) serves the front page's
 * preview. {@code WhatFacebookIsAskedAgainTest} holds the pattern here to the one in {@code nginx.conf}. The card's
 * address carries a digest of everything the preview is made of (the name, which is the title, among it), so two
 * equal card addresses are two equal previews.
 *
 * <p><b>WHAT IS ASKED:</b> every row whose card is not what its address serves now, once a time. The row is written
 * as Facebook will hold it after reading the address again ({@link Asked#refreshed}: the card it serves, or the front
 * page's preview) only once Facebook has accepted the request, which is not this plan's to know: owner, PDL P11,
 * 16.11.2026, item 16, chosen with the assistant's recommendation, when Facebook refuses or does not answer the server
 * tries again, so an address is marked as refreshed only when Facebook accepts. A row that was not is still different
 * the next time, and is asked then, within the limit like any other.
 *
 * <p><b>AT MOST {@code atMost} ROWS A TIME</b>, in the order of the member number and then the address. A row that
 * does not fit is not asked and not written, so the next time it is still different and is asked then: a day the whole portal
 * changes (a new drawing of the card changes every digest) is spread over as many times as it takes, in a fixed
 * order, and none is lost. A row is one address, so there is nothing to split and nothing that may go past the limit.
 */
public final class WhatFacebookIsAskedAgain {

	/**
	 * THE ADDRESS OF A PROFILE AS NGINX MATCHES IT, the location of {@code frontend/nginx.conf} that writes the
	 * preview in, without its names for the two groups (Java allows no underscore in a group's name):
	 * the language, the member number, and anything after a dash, which is the name and which nothing reads.
	 */
	public static final String A_PROFILE = "^/(sr|en)/takmicar/([0-9]{6})(?:-[^/]*)?/?$";

	private static final Pattern A_PROFILE_SPELT = Pattern.compile(A_PROFILE);

	/** One profile in one language, which is what a card is drawn for. */
	public record Key(String memberNumber, String language) {

		public Key {
			Objects.requireNonNull(memberNumber);
			Objects.requireNonNull(language);
		}
	}

	/**
	 * One address Facebook's crawler has read the profile of a member at, without the host, and the card Facebook was
	 * last given there, which is {@code null} for the front page's preview.
	 */
	public record Row(String memberNumber, String address, String card) {

		public Row {
			Objects.requireNonNull(memberNumber);
			Objects.requireNonNull(address);
		}
	}

	/**
	 * One row to ask about: the row as it stands, and the card its address serves now, which is what Facebook will
	 * hold there once it has read the address again ({@code null} for the front page's preview).
	 */
	public record Asked(Row row, String serves) {

		public Asked {
			Objects.requireNonNull(row);
		}

		/** The row as it is written once Facebook has accepted the request. */
		public Row refreshed() {
			return new Row(row.memberNumber(), row.address(), serves);
		}
	}

	/** What one time comes to: the rows to ask about, in order. */
	public record Plan(List<Asked> asked) {

		public Plan {
			asked = List.copyOf(asked);
		}

		/** The addresses to send, in order and each once, however many members' rows name one. */
		public List<String> addresses() {
			return asked.stream().map(one -> one.row().address()).distinct().toList();
		}
	}

	private static final Comparator<Row> IN_ORDER =
			Comparator.comparing(Row::memberNumber).thenComparing(Row::address);

	private WhatFacebookIsAskedAgain() {
	}

	/**
	 * The profile an address shows, by the language and the number in it, as nginx reads them; nothing for an address
	 * nginx does not write a preview into.
	 */
	public static Optional<Key> profileAt(String address) {
		Matcher spelt = A_PROFILE_SPELT.matcher(address);

		return spelt.matches() ? Optional.of(new Key(spelt.group(2), spelt.group(1))) : Optional.empty();
	}

	/**
	 * @param read   every row: an address Facebook has read and the card it was last given there
	 * @param shown  the address of the card of every profile a visitor is shown now
	 * @param atMost how many rows may be asked about this time, at least one
	 */
	public static Plan plan(List<Row> read, Map<Key, String> shown, int atMost) {
		if (atMost < 1) {
			throw new IllegalArgumentException("at least one address must be asked at a time, not " + atMost);
		}

		List<Asked> asked = new ArrayList<>();

		for (Row row : read.stream().sorted(IN_ORDER).toList()) {
			String serves = profileAt(row.address()).map(shown::get).orElse(null);

			if (Objects.equals(row.card(), serves)) {
				continue;
			}

			if (asked.size() == atMost) {
				break;
			}

			asked.add(new Asked(row, serves));
		}

		return new Plan(asked);
	}
}
