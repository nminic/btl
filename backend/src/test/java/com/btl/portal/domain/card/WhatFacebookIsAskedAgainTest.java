package com.btl.portal.domain.card;

import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Key;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Page;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Plan;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT FACEBOOK IS ASKED, BY THE FOUR WAYS A PAGE CAN STAND AND THE LIMIT.
 *
 * <p><b>No page is the only one of its kind</b> (the rule in {@code CLAUDE.md} about two sources of one value): every
 * case holds a page that stands as it stood beside the page that moved, and the page that moved is never the first
 * in the order, so a plan that asked about every page, or about the first, or about the old address instead of the
 * new, is another list of addresses.
 */
class WhatFacebookIsAskedAgainTest {

	private static final Key STILL = new Key("000001", "sr");
	private static final Key MOVED = new Key("000002", "sr");
	private static final Key MOVED_IN_ENGLISH = new Key("000002", "en");

	private static Page page(String number, String language, String digest, String slug) {
		return new Page("/api/cards/competitor/" + number + "-" + language + "1-" + digest + ".jpg",
				"/" + language + "/takmicar/" + number + "-" + slug);
	}

	private static final Page STILL_PAGE = page("000001", "sr", "aaaaaaaaaaaaaaaa", "ana-prva");

	private static Map<Key, Page> pages(Object... keysAndPages) {
		Map<Key, Page> pages = new LinkedHashMap<>();

		for (int at = 0; at < keysAndPages.length; at += 2) {
			pages.put((Key) keysAndPages[at], (Page) keysAndPages[at + 1]);
		}

		return pages;
	}

	@Test
	void thePagesThatStandAsTheyStoodAskNothingAndAreNotWrittenAgain() {
		Map<Key, Page> both = pages(STILL, STILL_PAGE, MOVED, page("000002", "sr", "bbbbbbbbbbbbbbbb", "nikola-minic"));

		Plan plan = WhatFacebookIsAskedAgain.plan(both, both, 10);

		assertThat(plan.addresses()).isEmpty();
		assertThat(plan.written()).isEmpty();
	}

	/** The card changed and the name did not: its one address is asked, and the page is written as it stands now. */
	@Test
	void aChangedCardAsksItsAddressOnce() {
		Page before = page("000002", "sr", "bbbbbbbbbbbbbbbb", "nikola-minic");
		Page after = page("000002", "sr", "cccccccccccccccc", "nikola-minic");

		Plan plan = WhatFacebookIsAskedAgain.plan(pages(STILL, STILL_PAGE, MOVED, before),
				pages(STILL, STILL_PAGE, MOVED, after), 10);

		assertThat(plan.addresses()).containsExactly("/sr/takmicar/000002-nikola-minic");
		assertThat(plan.written()).containsExactly(Map.entry(MOVED, after));
	}

	/** A renamed member: the new address, which the preview now names, and the old one, which people pasted. */
	@Test
	void aRenamedMemberAsksTheNewAddressAndTheOldOne() {
		Page before = page("000002", "sr", "bbbbbbbbbbbbbbbb", "nikola-minic");
		Page after = page("000002", "sr", "cccccccccccccccc", "nikola-petrovic");

		Plan plan = WhatFacebookIsAskedAgain.plan(pages(STILL, STILL_PAGE, MOVED, before),
				pages(STILL, STILL_PAGE, MOVED, after), 10);

		assertThat(plan.addresses()).containsExactly("/sr/takmicar/000002-nikola-petrovic",
				"/sr/takmicar/000002-nikola-minic");
		assertThat(plan.written()).containsExactly(Map.entry(MOVED, after));
	}

	/**
	 * A page no longer shown (hidden, lapsed): the address Facebook holds, so that it reads the front page's preview
	 * there, and the page is written down as the front page's; and nothing the next time, while it stays so.
	 */
	@Test
	void aPageNoLongerShownIsAskedOnceAndWrittenAsTheFrontPage() {
		Page before = page("000002", "sr", "bbbbbbbbbbbbbbbb", "nikola-minic");

		Plan plan = WhatFacebookIsAskedAgain.plan(pages(STILL, STILL_PAGE, MOVED, before),
				pages(STILL, STILL_PAGE), 10);

		assertThat(plan.addresses()).containsExactly("/sr/takmicar/000002-nikola-minic");
		assertThat(plan.written()).containsExactly(Map.entry(MOVED, Page.frontPage("/sr/takmicar/000002-nikola-minic")));

		Plan after = WhatFacebookIsAskedAgain.plan(pages(STILL, STILL_PAGE, MOVED, plan.written().get(MOVED)),
				pages(STILL, STILL_PAGE), 10);

		assertThat(after.addresses()).as("a page that stays hidden is asked about again").isEmpty();
		assertThat(after.written()).isEmpty();
	}

	/**
	 * A page Facebook holds as the front page's and shown again (a fee paid, a profile out of hiding): its address,
	 * and when the name moved it while it was hidden, the address Facebook holds too.
	 */
	@Test
	void aPageShownAgainIsAsked() {
		Page hidden = Page.frontPage("/sr/takmicar/000002-nikola-minic");
		Page same = page("000002", "sr", "bbbbbbbbbbbbbbbb", "nikola-minic");
		Page renamed = page("000002", "sr", "bbbbbbbbbbbbbbbb", "nikola-petrovic");

		Plan plan = WhatFacebookIsAskedAgain.plan(pages(STILL, STILL_PAGE, MOVED, hidden),
				pages(STILL, STILL_PAGE, MOVED, same), 10);

		assertThat(plan.addresses()).containsExactly("/sr/takmicar/000002-nikola-minic");
		assertThat(plan.written()).containsExactly(Map.entry(MOVED, same));

		Plan moved = WhatFacebookIsAskedAgain.plan(pages(STILL, STILL_PAGE, MOVED, hidden),
				pages(STILL, STILL_PAGE, MOVED, renamed), 10);

		assertThat(moved.addresses()).containsExactly("/sr/takmicar/000002-nikola-petrovic",
				"/sr/takmicar/000002-nikola-minic");
		assertThat(moved.written()).containsExactly(Map.entry(MOVED, renamed));
	}

	/** Two languages are two pages, two addresses and two pictures, and each is asked on its own. */
	@Test
	void theTwoLanguagesAreAskedEachForItself() {
		Page serbian = page("000002", "sr", "bbbbbbbbbbbbbbbb", "nikola-minic");
		Page english = page("000002", "en", "dddddddddddddddd", "nikola-minic");
		Page englishAfter = page("000002", "en", "eeeeeeeeeeeeeeee", "nikola-minic");

		Plan plan = WhatFacebookIsAskedAgain.plan(pages(STILL, STILL_PAGE, MOVED, serbian, MOVED_IN_ENGLISH, english),
				pages(STILL, STILL_PAGE, MOVED, serbian, MOVED_IN_ENGLISH, englishAfter), 10);

		assertThat(plan.addresses()).containsExactly("/en/takmicar/000002-nikola-minic");
		assertThat(plan.written()).containsExactly(Map.entry(MOVED_IN_ENGLISH, englishAfter));
	}

	/**
	 * A PAGE FACEBOOK HAS NEVER READ IS NEVER ASKED ABOUT AND NEVER WRITTEN DOWN (owner, PDL P11, 16.11.2026, item 14),
	 * however it changes, shown or hidden: beside a page Facebook has read and that changed too, so a plan that asked
	 * about every changed page asks two addresses and not one. And with nothing read at all, nothing at all.
	 */
	@Test
	void aPageFacebookHasNeverReadIsNeverAskedAbout() {
		Page stillAfter = page("000001", "sr", "ffffffffffffffff", "ana-prva");
		Page neverRead = page("000002", "sr", "bbbbbbbbbbbbbbbb", "nikola-minic");

		Plan plan = WhatFacebookIsAskedAgain.plan(pages(STILL, STILL_PAGE),
				pages(STILL, stillAfter, MOVED, neverRead, MOVED_IN_ENGLISH, page("000002", "en", "c", "x")), 10);

		assertThat(plan.addresses()).containsExactly("/sr/takmicar/000001-ana-prva");
		assertThat(plan.written()).containsExactly(Map.entry(STILL, stillAfter));

		Plan nothingRead = WhatFacebookIsAskedAgain.plan(Map.of(), pages(STILL, stillAfter, MOVED, neverRead), 10);

		assertThat(nothingRead.addresses()).isEmpty();
		assertThat(nothingRead.written()).isEmpty();
	}

	/**
	 * THE LIMIT, IN ORDER AND WITHOUT SPLITTING A PAGE. Four pages changed, the second renamed (two addresses), and
	 * room for three: the first and the second are asked, the third and fourth are not, and are not written down, so
	 * the next time they are still different and are asked then.
	 */
	@Test
	void theLimitTakesPagesInOrderWholeAndLeavesTheRestForTheNextTime() {
		Map<Key, Page> before = new LinkedHashMap<>();
		Map<Key, Page> after = new LinkedHashMap<>();

		/* Written in the opposite order to the member numbers, so an order that came from the map is another order. */
		for (String number : List.of("000014", "000013", "000012", "000011")) {
			before.put(new Key(number, "sr"), page(number, "sr", "1111111111111111", "ime-" + number));
			after.put(new Key(number, "sr"), page(number, "sr", "2222222222222222",
					number.equals("000012") ? "drugo-ime" : "ime-" + number));
		}

		Plan plan = WhatFacebookIsAskedAgain.plan(before, after, 3);

		assertThat(plan.addresses()).containsExactly("/sr/takmicar/000011-ime-000011",
				"/sr/takmicar/000012-drugo-ime", "/sr/takmicar/000012-ime-000012");
		assertThat(plan.written().keySet()).containsExactlyInAnyOrder(new Key("000011", "sr"), new Key("000012", "sr"));

		Map<Key, Page> asked = new LinkedHashMap<>(before);
		asked.putAll(plan.written());

		Plan next = WhatFacebookIsAskedAgain.plan(asked, after, 3);

		assertThat(next.addresses()).containsExactly("/sr/takmicar/000013-ime-000013", "/sr/takmicar/000014-ime-000014");
	}

	/** A renamed page that does not fit whole waits, and a page after it does not jump the queue. */
	@Test
	void aPageThatDoesNotFitWholeWaitsAndNothingAfterItIsAsked() {
		Map<Key, Page> before = pages(new Key("000011", "sr"), page("000011", "sr", "1111111111111111", "staro"),
				new Key("000012", "sr"), page("000012", "sr", "1111111111111111", "ime"));
		Map<Key, Page> after = pages(new Key("000011", "sr"), page("000011", "sr", "2222222222222222", "novo"),
				new Key("000012", "sr"), page("000012", "sr", "2222222222222222", "ime"));

		Plan plan = WhatFacebookIsAskedAgain.plan(before, after, 1);

		assertThat(plan.addresses()).isEmpty();
		assertThat(plan.written()).isEmpty();
	}

	@Test
	void noRunAsksFewerThanOneAddress() {
		assertThatThrownBy(() -> WhatFacebookIsAskedAgain.plan(Map.of(), Map.of(), 0))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not 0");
	}

	@Test
	void aKeyAndAPageAreNeverHalfMade() {
		assertThatThrownBy(() -> new Key(null, "sr")).isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Key("000001", null)).isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Page("/api/cards/competitor/x.jpg", null)).isInstanceOf(NullPointerException.class);
		assertThat(Page.frontPage("/sr/takmicar/000001")).isEqualTo(new Page(null, "/sr/takmicar/000001"));
	}
}
