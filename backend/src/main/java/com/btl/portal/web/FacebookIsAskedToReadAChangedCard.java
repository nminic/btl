package com.btl.portal.web;

import com.btl.portal.domain.card.WhatACardSays;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Asked;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Key;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Plan;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Row;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * EVERY FIVE MINUTES, FACEBOOK IS ASKED TO READ AGAIN EVERY ADDRESS IT HAS READ THAT NO LONGER SERVES WHAT IT HOLDS.
 *
 * <p>Owner, PDL P11, 15.11.2026, item 10, chosen with the assistant's recommendation: „Facebook se osvežava sa
 * servera: posle svake promene koja menja karticu server traži od Facebooka da ponovo pročita profil." Facebook
 * keeps the preview of an address it has read, so without this a pasted profile shows the card of the day it was
 * first pasted, whatever has happened since; Viber and WhatsApp read the page each time and need nothing.
 *
 * <p><b>WHY A COMPARISON ON A CLOCK AND NOT A CALL FROM EVERY ROAD THAT CHANGES A CARD.</b> A card changes by a
 * dozen roads (a result approved or deleted, an unscored one, a race corrected and its runs recounted, a picture
 * approved or withdrawn or cut again, a name, a team joined or left, a category, a profile hidden or shown, a fee
 * paid) and by one that is not a road at all: a fee that lapses at midnight, which nobody does and no request
 * carries. A call from each road is a list, and a list misses the road written tomorrow and cannot see the one that
 * is only time. So nothing here is told what happened. It reads every card as a visitor would be shown it,
 * through the very reading the card and the preview are drawn from ({@link CompetitorCards#everyShown}), and
 * compares it with what Facebook was last given at every address it has read ({@link WhatFacebookIsAskedAgain},
 * which says what is asked and why).
 *
 * <p><b>WHAT IT CANNOT SLOW OR STOP, BY HOW IT RUNS.</b> It runs on its own, on the scheduler, and reads what has
 * been committed: a road that changes a card commits and answers and has nothing to do with Facebook at all, so a
 * Facebook that is slow, down or refusing cannot make a member or an administrator wait or fail. The requests are
 * sent without waiting ({@link FacebookGraph#readAgain}), so not even the scheduler's one thread, which the other
 * jobs share (see {@code WhatRunsWithoutBeingAsked}), waits on Facebook.
 *
 * <p><b>ONCE PER ADDRESS, HOWEVER MANY TIMES IT CHANGED.</b> Ten changes to one profile between two runs are one
 * difference and one request per address. <b>AND AGAIN UNTIL FACEBOOK ACCEPTS IT</b> (owner, PDL P11, 16.11.2026, item
 * 16, chosen with the assistant's recommendation): a row is written down as refreshed only from Facebook's answer,
 * when that answer is a success ({@link #refreshed}); a request that was refused, not answered in time or not
 * reached leaves the card as it was, so the next run asks it again; it is stamped as asked about all the same
 * ({@code asked_at}, V104), so the next run takes the rows never asked about and the ones asked longest ago first
 * ({@link #stamped}), and rows Facebook keeps refusing cannot hold the head of every run. The limit is what keeps a Facebook that keeps
 * refusing from being flooded: {@code btl.facebook.per-pass} rows a run, ten by default, so at most a hundred and
 * twenty an hour, retries included; a row is one address, so the limit holds without an exception.
 *
 * <p><b>WITHOUT FACEBOOK IT DOES NOTHING AT ALL</b> ({@link FacebookGraph#isOn}): no reading, no writing, no
 * request. That is QA, a developer's machine and the test suite.
 *
 * <p><b>ONLY WHAT FACEBOOK HAS READ, AND NOTHING OF IT IS EVER TAKEN OUT HERE.</b> Owner, PDL P11, 16.11.2026, item 14,
 * chosen with the assistant's recommendation: the server remembers the profiles Facebook's crawler has already opened
 * and asks Facebook to refresh only those. So {@code shared_card} (V103) gets a row when Facebook's crawler reads a
 * shown profile ({@link WhatFacebookHasRead#read}) and never from here: this run gives a row it asked about the card
 * Facebook will hold there, by the row's own key, and adds, moves or deletes none. A member who is deleted takes his
 * rows with him (the key to {@code competitor} cascades), and the deletion asks Facebook about them first, after its
 * commit ({@link WhatFacebookHasRead#forgetWhenGone}).
 */
@Component
class FacebookIsAskedToReadAChangedCard {

	private final CompetitorCards cards;
	private final JdbcClient db;
	private final FacebookGraph facebook;
	private final Portal portal;
	private final int atMost;

	/**
	 * @param portal the address the portal lives at, which is the host of every page Facebook is asked about
	 * @param atMost how many addresses one run may ask about
	 */
	FacebookIsAskedToReadAChangedCard(CompetitorCards cards, JdbcClient db, FacebookGraph facebook,
			@Value("${btl.portal.address}") String portal, @Value("${btl.facebook.per-pass:10}") int atMost) {
		if (atMost < 1) {
			throw new IllegalArgumentException("btl.facebook.per-pass must be at least one, not " + atMost);
		}

		this.cards = cards;
		this.db = db;
		this.facebook = facebook;
		this.portal = new Portal(portal);
		this.atMost = atMost;
	}

	/** Five minutes after the start and five after each run has finished. */
	@Scheduled(fixedDelay = 5, initialDelay = 5, timeUnit = TimeUnit.MINUTES)
	void pass() {
		askAgain();
	}

	/**
	 * ONE RUN: what every address serves compared with what Facebook holds there, and the requests sent. Returns the
	 * requests, each finished once Facebook has answered and, when it accepted, its rows are written down; a case waits
	 * on them and the scheduler does not.
	 */
	List<CompletableFuture<Void>> askAgain() {
		if (!facebook.isOn()) {
			return List.of();
		}

		Plan plan = WhatFacebookIsAskedAgain.plan(read(), shownNow(), atMost);
		List<Sent> sent = plan.asked().stream().flatMap(one -> stamped(one).stream()).toList();

		return sent.stream().map(one -> one.asked().row().address()).distinct()
				.map(address -> facebook.readAgain(portal.address() + address).thenAccept(accepted -> {
					if (accepted) {
						sent.stream().filter(one -> one.asked().row().address().equals(address))
								.forEach(this::refreshed);
					}
				}))
				.toList();
	}

	/**
	 * A ROW AS IT STOOD WHEN THE REQUEST ABOUT IT WENT: what was asked, and the version of the row the stamp below
	 * wrote, which is PostgreSQL's {@code xmin}, the transaction that wrote the row as it now stands.
	 */
	private record Sent(Asked asked, String version) {
	}

	/**
	 * THE ROW IS STAMPED AS ASKED ABOUT NOW, BEFORE THE REQUEST GOES, whatever Facebook answers (V104), so the next run
	 * takes first the rows asked about longest ago and a row Facebook keeps refusing goes behind them. And the stamp
	 * says which version of the row the request was sent about. Nothing for a row that is no longer there (its member
	 * was deleted since this run read it), which is then not asked about at all: the deletion asks Facebook itself,
	 * without naming the page ({@link WhatFacebookHasRead#forgetWhenGone}).
	 */
	private Optional<Sent> stamped(Asked one) {
		return db.sql("update shared_card set asked_at = now() where member_number = ? and address = ?"
						+ " returning xmin::text")
				.params(one.row().memberNumber(), one.row().address()).query(String.class).optional()
				.map(version -> new Sent(one, version));
	}

	/**
	 * THE ROW OF AN ADDRESS FACEBOOK HAS ACCEPTED TO READ AGAIN, written as Facebook now holds it, and only then
	 * (owner, PDL P11, 16.11.2026, item 16): a request refused or not answered leaves the card as it was, so the next
	 * pass asks it again. By the row's own key, and only while the row is still the very version the request was sent
	 * about. Any write since is newer than what this answer says, and the one that matters is the crawler's: Facebook
	 * reads the page to answer the request, and its reading writes the card it was given
	 * ({@link WhatFacebookHasRead#read}). That reading is not written over, EVEN WHEN IT WROTE THE SAME CARD THE ROW HELD
	 * BEFORE (a hidden profile shown again while the request was on its way, PR 744, fourth round): a comparison of the
	 * card could not tell that reading from none and would write the front page over the card Facebook holds, and then
	 * a deletion would not ask about that address. The version tells it, because every write of a row makes a new one,
	 * the same values or not. An update and never an insert: a row is Facebook having read the address, which only its
	 * crawler writes, and a member deleted in the meantime took his rows, so there is nothing to update.
	 */
	private void refreshed(Sent one) {
		db.sql("update shared_card set card = cast(? as text) where member_number = ? and address = ?"
						+ " and xmin = cast(? as xid)")
				.params(one.asked().serves(), one.asked().row().memberNumber(), one.asked().row().address(),
						one.version()).update();
	}

	private Map<Key, String> shownNow() {
		Map<Key, String> now = new HashMap<>();

		for (WhatACardSays language : WhatACardSays.values()) {
			for (CompetitorCards.Shown shown : cards.everyShown(language)) {
				now.put(new Key(shown.face().chip(), language.code()), shown.address());
			}
		}

		return now;
	}

	private List<Row> read() {
		return db.sql("select member_number, address, card, asked_at from shared_card")
				.query((row, at) -> new Row(row.getString(1), row.getString(2), row.getString(3),
						Optional.ofNullable(row.getObject(4, OffsetDateTime.class)).map(OffsetDateTime::toInstant)
								.orElse(null)))
				.list();
	}
}
