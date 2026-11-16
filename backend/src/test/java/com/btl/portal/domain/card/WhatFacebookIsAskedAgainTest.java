package com.btl.portal.domain.card;

import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Asked;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Key;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Plan;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Row;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT FACEBOOK IS ASKED: EVERY ADDRESS IT READ THAT NO LONGER SERVES WHAT IT HOLDS, A ROW AT A TIME, UP TO THE LIMIT.
 *
 * <p><b>No row is the only one of its kind</b> (the rule in {@code CLAUDE.md} about two sources of one value): every
 * case holds a row that stands as it stood beside the row that moved, the row that moved is never the first in the
 * order, and a member with two addresses has them in one language, so a plan that asked about every row, or about
 * the first, or worked out what an address serves from the member instead of from the address, is another plan.
 */
class WhatFacebookIsAskedAgainTest {

	private static String card(String number, String language, String digest) {
		return "/api/cards/competitor/" + number + "-" + language + "1-" + digest + ".jpg";
	}

	private static final Row STILL = new Row("000001", "/sr/takmicar/000001-ana-prva", card("000001", "sr", "a".repeat(16)));

	private static final Key STILL_SHOWN = new Key("000001", "sr");

	private static Map<Key, String> shown(Object... keysAndCards) {
		Map<Key, String> shown = new HashMap<>();

		for (int at = 0; at < keysAndCards.length; at += 2) {
			shown.put((Key) keysAndCards[at], (String) keysAndCards[at + 1]);
		}

		return shown;
	}

	@Test
	void theRowsThatServeWhatFacebookHoldsAskNothing() {
		Row moved = new Row("000002", "/sr/takmicar/000002-nikola-minic", card("000002", "sr", "b".repeat(16)));

		Plan plan = WhatFacebookIsAskedAgain.plan(List.of(STILL, moved),
				shown(STILL_SHOWN, STILL.card(), new Key("000002", "sr"), moved.card()), 10);

		assertThat(plan.asked()).isEmpty();
		assertThat(plan.addresses()).isEmpty();
	}

	/** The card changed: the row's address is asked once, and the row is written with the card it serves now. */
	@Test
	void aChangedCardAsksTheAddressOnceAndWritesItsRow() {
		Row moved = new Row("000002", "/sr/takmicar/000002-nikola-minic", card("000002", "sr", "b".repeat(16)));
		String now = card("000002", "sr", "c".repeat(16));

		Plan plan = WhatFacebookIsAskedAgain.plan(List.of(STILL, moved),
				shown(STILL_SHOWN, STILL.card(), new Key("000002", "sr"), now), 10);

		assertThat(plan.addresses()).containsExactly("/sr/takmicar/000002-nikola-minic");
		assertThat(plan.asked()).map(Asked::refreshed).containsExactly(new Row("000002", "/sr/takmicar/000002-nikola-minic", now));
		assertThat(plan.asked()).as("the row as it stood, which the mark is written over only while it still stands")
				.map(Asked::row).containsExactly(moved);
	}

	/**
	 * A RENAMED MEMBER: the old address serves his card as it is today, because nginx reads the number and not the
	 * name, so it is asked; the new one is not, because Facebook never read it (owner, PDL P11, 16.11.2026, item 14:
	 * only what the crawler opened). A second row of his, at an address the crawler read after the rename, already
	 * serves what Facebook holds and asks nothing.
	 */
	@Test
	void aRenamedMemberAsksTheOldAddressFacebookReadAndNotTheNewOneItDidNot() {
		String before = card("000002", "sr", "b".repeat(16));
		String after = card("000002", "sr", "c".repeat(16));
		Row old = new Row("000002", "/sr/takmicar/000002-nikola-minic", before);
		Row readSince = new Row("000002", "/sr/takmicar/000002-petar-minic", after);

		Plan plan = WhatFacebookIsAskedAgain.plan(List.of(readSince, STILL, old),
				shown(STILL_SHOWN, STILL.card(), new Key("000002", "sr"), after), 10);

		assertThat(plan.asked()).map(Asked::refreshed).containsExactly(new Row("000002", "/sr/takmicar/000002-nikola-minic", after));
	}

	/**
	 * A profile no longer shown (hidden, lapsed, deleted): every address of it is asked once and written as the front
	 * page's, and nothing the next time, while it stays so; shown again, it is asked again.
	 */
	@Test
	void aProfileNoLongerShownIsAskedOnceAndThenWhenItIsShownAgain() {
		Row moved = new Row("000002", "/sr/takmicar/000002-nikola-minic", card("000002", "sr", "b".repeat(16)));

		Plan hidden = WhatFacebookIsAskedAgain.plan(List.of(STILL, moved), shown(STILL_SHOWN, STILL.card()), 10);

		assertThat(hidden.asked()).map(Asked::refreshed).containsExactly(new Row("000002", "/sr/takmicar/000002-nikola-minic", null));

		Plan staysHidden = WhatFacebookIsAskedAgain.plan(List.of(STILL, hidden.asked().get(0).refreshed()),
				shown(STILL_SHOWN, STILL.card()), 10);

		assertThat(staysHidden.asked()).as("an address that stays the front page's is asked again").isEmpty();

		Plan shownAgain = WhatFacebookIsAskedAgain.plan(List.of(STILL, hidden.asked().get(0).refreshed()),
				shown(STILL_SHOWN, STILL.card(), new Key("000002", "sr"), moved.card()), 10);

		assertThat(shownAgain.asked()).map(Asked::refreshed).containsExactly(moved);
	}

	/**
	 * WHAT AN ADDRESS SERVES IS READ OFF THE ADDRESS, not off the member: a member whose number moved keeps the row of
	 * the address Facebook read, with the old number in it, and that address now serves whoever is shown under that
	 * number, which here is nobody, so it is the front page's; his own card under his new number is not what it
	 * serves. And an address nginx writes no preview into serves the front page's.
	 */
	@Test
	void whatAnAddressServesIsReadOffTheAddressAndNotOffTheMember() {
		String his = card("000009", "sr", "b".repeat(16));
		Row moved = new Row("000009", "/sr/takmicar/000002-nikola-minic", card("000002", "sr", "b".repeat(16)));
		Row notAProfile = new Row("000009", "/sr/takmicar/000009/priznanja", his);

		Plan plan = WhatFacebookIsAskedAgain.plan(List.of(STILL, notAProfile, moved),
				shown(STILL_SHOWN, STILL.card(), new Key("000009", "sr"), his), 10);

		assertThat(plan.asked()).map(Asked::refreshed).containsExactly(new Row("000009", "/sr/takmicar/000002-nikola-minic", null),
				new Row("000009", "/sr/takmicar/000009/priznanja", null));
	}

	/** Two languages are two addresses and two cards, and each is asked for itself. */
	@Test
	void theTwoLanguagesAreAskedEachForItself() {
		Row serbian = new Row("000002", "/sr/takmicar/000002-nikola-minic", card("000002", "sr", "b".repeat(16)));
		Row english = new Row("000002", "/en/takmicar/000002-nikola-minic", card("000002", "en", "d".repeat(16)));
		String englishNow = card("000002", "en", "e".repeat(16));

		Plan plan = WhatFacebookIsAskedAgain.plan(List.of(STILL, serbian, english), shown(STILL_SHOWN, STILL.card(),
				new Key("000002", "sr"), serbian.card(), new Key("000002", "en"), englishNow), 10);

		assertThat(plan.asked()).map(Asked::refreshed).containsExactly(new Row("000002", "/en/takmicar/000002-nikola-minic", englishNow));
	}

	/**
	 * A PROFILE FACEBOOK HAS NEVER READ IS NEVER ASKED ABOUT (owner, PDL P11, 16.11.2026, item 14), however it changes:
	 * beside a row Facebook read that changed too. And with nothing read at all, nothing at all.
	 */
	@Test
	void aProfileFacebookHasNeverReadIsNeverAskedAbout() {
		String stillNow = card("000001", "sr", "f".repeat(16));
		Map<Key, String> now = shown(STILL_SHOWN, stillNow, new Key("000002", "sr"), card("000002", "sr", "b".repeat(16)));

		assertThat(WhatFacebookIsAskedAgain.plan(List.of(STILL), now, 10).asked()).map(Asked::refreshed)
				.containsExactly(new Row("000001", "/sr/takmicar/000001-ana-prva", stillNow));
		assertThat(WhatFacebookIsAskedAgain.plan(List.of(), now, 10).asked()).isEmpty();
	}

	/**
	 * THE LIMIT, A ROW AT A TIME AND IN ORDER. Five rows differ, two of them two addresses of one member in one
	 * language, and room for two: the first two in the order of the member and the address are asked, the rest are not
	 * written, so the next time they still differ and are asked then; and a limit of one walks them all, one a time.
	 */
	@Test
	void theLimitTakesRowsInOrderAndLeavesTheRestForTheNextTime() {
		List<Row> rows = new ArrayList<>();
		Map<Key, String> now = new HashMap<>();

		/* Written in the opposite order to the member numbers and the addresses, so an order that came from the list
		   is another order. */
		for (String number : List.of("000014", "000013", "000012", "000011")) {
			if (number.equals("000012")) {
				rows.add(new Row(number, "/sr/takmicar/000012-zoran", card(number, "sr", "1".repeat(16))));
			}

			rows.add(new Row(number, "/sr/takmicar/" + number + "-ime", card(number, "sr", "1".repeat(16))));
			now.put(new Key(number, "sr"), card(number, "sr", "2".repeat(16)));
		}

		Plan plan = WhatFacebookIsAskedAgain.plan(rows, now, 2);

		assertThat(plan.addresses()).containsExactly("/sr/takmicar/000011-ime", "/sr/takmicar/000012-ime");

		for (int atMost : List.of(1, 2, 3)) {
			List<Row> standing = new ArrayList<>(rows);
			List<String> asked = new ArrayList<>();

			for (int time = 0; time < 6; time++) {
				Plan once = WhatFacebookIsAskedAgain.plan(standing, now, atMost);

				assertThat(once.asked()).as("a time over its limit of %s", atMost).hasSizeLessThanOrEqualTo(atMost);
				asked.addAll(once.addresses());
				once.asked().stream().map(Asked::refreshed).forEach(row -> standing.replaceAll(
						one -> one.memberNumber().equals(row.memberNumber()) && one.address().equals(row.address())
								? row : one));
			}

			assertThat(asked).as("a limit of %s", atMost).containsExactly("/sr/takmicar/000011-ime",
					"/sr/takmicar/000012-ime", "/sr/takmicar/000012-zoran", "/sr/takmicar/000013-ime",
					"/sr/takmicar/000014-ime");
		}
	}

	/**
	 * A ROW ASKED ABOUT BEFORE GOES BEHIND EVERY ROW NEVER ASKED, AND THE ONE ASKED LONGEST AGO COMES FIRST AMONG THEM
	 * (V104). Five rows differ, and the order of the member and the address is the opposite of the order of the asking:
	 * the first two members were asked about, the second of them before the first, and the three after them never were.
	 * So the three never asked go first, in the order of the member, and then the one asked longest ago; and a row
	 * that does not differ is not asked whenever it was asked before.
	 */
	@Test
	void theRowsNeverAskedComeFirstAndThenTheOnesAskedLongestAgo() {
		Instant earlier = Instant.parse("2026-11-16T10:00:00Z");
		Instant later = Instant.parse("2026-11-16T10:05:00Z");
		List<Row> rows = new ArrayList<>();
		Map<Key, String> now = new HashMap<>();

		for (String number : List.of("000021", "000022", "000023", "000024", "000025")) {
			Instant asked = switch (number) {
				case "000021" -> later;
				case "000022" -> earlier;
				default -> null;
			};

			rows.add(new Row(number, "/sr/takmicar/" + number + "-ime", card(number, "sr", "1".repeat(16)), asked));
			now.put(new Key(number, "sr"), card(number, "sr", "2".repeat(16)));
		}

		rows.add(new Row("000020", "/sr/takmicar/000020-ime", card("000020", "sr", "3".repeat(16)), earlier));
		now.put(new Key("000020", "sr"), card("000020", "sr", "3".repeat(16)));

		assertThat(WhatFacebookIsAskedAgain.plan(rows, now, 10).addresses()).containsExactly("/sr/takmicar/000023-ime",
				"/sr/takmicar/000024-ime", "/sr/takmicar/000025-ime", "/sr/takmicar/000022-ime",
				"/sr/takmicar/000021-ime");
		assertThat(WhatFacebookIsAskedAgain.plan(rows, now, 4).addresses()).containsExactly("/sr/takmicar/000023-ime",
				"/sr/takmicar/000024-ime", "/sr/takmicar/000025-ime", "/sr/takmicar/000022-ime");
		assertThat(new Row("000001", "/sr/takmicar/000001", null).askedAt()).as("a row the crawler writes").isNull();
	}

	/** Two members' rows at one address (a number that moved to another) are one request, however many rows. */
	@Test
	void oneAddressIsSentOnceHoweverManyRowsNameIt() {
		Row his = new Row("000003", "/sr/takmicar/000002-nikola-minic", card("000002", "sr", "b".repeat(16)));
		Row theirs = new Row("000002", "/sr/takmicar/000002-nikola-minic", card("000002", "sr", "b".repeat(16)));

		Plan plan = WhatFacebookIsAskedAgain.plan(List.of(his, STILL, theirs), shown(STILL_SHOWN, STILL.card()), 10);

		assertThat(plan.asked()).hasSize(2);
		assertThat(plan.addresses()).containsExactly("/sr/takmicar/000002-nikola-minic");
	}

	/**
	 * THE PATTERN IS NGINX'S, which is the one home of what an address serves: the location in
	 * {@code frontend/nginx.conf} that writes the preview in, less its names for the two groups.
	 */
	@Test
	void thePatternIsTheOneNginxWritesThePreviewBy() throws IOException {
		String conf = Files.readString(Path.of("..", "frontend", "nginx.conf"), StandardCharsets.UTF_8);
		Matcher location = Pattern.compile("location ~ \"(\\^/\\(\\?<btl_preview_locale>[^\"]*)\" \\{").matcher(conf);

		assertThat(location.find()).as("nginx.conf has no location that writes the preview in").isTrue();
		assertThat(location.group(1).replaceAll("\\?<[a-z_]+>", "")).isEqualTo(WhatFacebookIsAskedAgain.A_PROFILE);
		assertThat(WhatFacebookIsAskedAgain.profileAt("/en/takmicar/000007-ana-prva"))
				.contains(new Key("000007", "en"));
		assertThat(WhatFacebookIsAskedAgain.profileAt("/sr/takmicar/000007")).contains(new Key("000007", "sr"));
		assertThat(WhatFacebookIsAskedAgain.profileAt("/de/takmicar/000007")).isEqualTo(Optional.empty());
	}

	@Test
	void noTimeAsksFewerThanOneAddress() {
		assertThatThrownBy(() -> WhatFacebookIsAskedAgain.plan(List.of(), Map.of(), 0))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not 0");
	}

	@Test
	void aKeyAndARowAreNeverHalfMade() {
		assertThatThrownBy(() -> new Key(null, "sr")).isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Key("000001", null)).isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Row(null, "/sr/takmicar/000001", null)).isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Row("000001", null, null)).isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Asked(null, null)).isInstanceOf(NullPointerException.class);
	}
}
