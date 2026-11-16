package com.btl.portal.web;

import com.btl.portal.domain.card.WhatACardSays;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Key;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Page;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Plan;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * EVERY FIVE MINUTES, FACEBOOK IS ASKED TO READ AGAIN EVERY PROFILE IT HAS READ WHOSE CARD IS NOT THE ONE IT HOLDS.
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
 * compares it with what Facebook holds of the profiles it has read ({@link WhatFacebookIsAskedAgain}, which says
 * what is asked and why). The address of a card carries a digest of everything the card draws, so a change that leaves the
 * card as it is asks nothing, and one that changes anything on it asks.
 *
 * <p><b>WHAT IT CANNOT SLOW OR STOP, BY HOW IT RUNS.</b> It runs on its own, on the scheduler, and reads what has
 * been committed: a road that changes a card commits and answers and has nothing to do with Facebook at all, so a
 * Facebook that is slow, down or refusing cannot make a member or an administrator wait or fail. The requests are
 * sent without waiting ({@link FacebookGraph#readAgain}), so not even the scheduler's one thread, which the other
 * jobs share (see {@code WhatRunsWithoutBeingAsked}), waits on Facebook.
 *
 * <p><b>ONCE PER PROFILE, HOWEVER MANY TIMES IT CHANGED.</b> Ten changes to one profile between two runs are one
 * difference and one request. A page is written down as asked the moment its request is sent, whatever Facebook
 * answers: a request that failed is logged and not repeated, because one repeated every five minutes against a
 * Facebook that keeps refusing it would be the very flood the limit is for. The limit is {@code btl.facebook.per-pass}
 * addresses a run, ten by default, so at most a hundred and twenty an hour.
 *
 * <p><b>WITHOUT FACEBOOK IT DOES NOTHING AT ALL</b> ({@link FacebookGraph#isOn}): no reading, no writing, no
 * request. That is QA, a developer's machine and the test suite.
 *
 * <p><b>ONLY WHAT FACEBOOK HAS READ.</b> Owner, PDL P11, 16.11.2026, item 14, chosen with the assistant's
 * recommendation: the server remembers the profiles Facebook's crawler has already opened and asks Facebook to
 * refresh only those. So {@code shared_card} (V103) gets a row when Facebook's crawler reads a shown profile
 * ({@link WhatFacebookHasRead#read}) and never from here: this run only UPDATES the rows it finds, to what Facebook
 * will hold once it has read them again, and a profile Facebook has never read asks nothing, however it changes. A
 * profile that stops being shown keeps its row, written down as the front page's preview, so that it is asked again
 * when it is shown again. A member who is deleted takes his rows with him (the key to {@code competitor} cascades),
 * and the deletion asks Facebook about them first, after its commit ({@link WhatFacebookHasRead#forgetWhenGone}).
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
	 * ONE RUN: what is shown compared with what Facebook holds, the pages written down as it will hold them, and the
	 * requests sent. Returns the requests, which a case waits on and the scheduler does not.
	 */
	List<CompletableFuture<Void>> askAgain() {
		if (!facebook.isOn()) {
			return List.of();
		}

		Plan plan = WhatFacebookIsAskedAgain.plan(read(), shownNow(), atMost);

		/* An update and never an insert: a row is Facebook having read the page, which only its crawler writes, and a
		   member deleted since the reading took his rows, so there is nothing to update and nothing comes back. */
		plan.written().forEach((page, now) -> db.sql("update shared_card set card = ?, address = ?"
						+ " where member_number = ? and language = ?")
				.params(now.card(), now.address(), page.memberNumber(), page.language()).update());

		return plan.addresses().stream().map(address -> facebook.readAgain(portal.address() + address)).toList();
	}

	private Map<Key, Page> shownNow() {
		Map<Key, Page> now = new HashMap<>();

		for (WhatACardSays language : WhatACardSays.values()) {
			CompetitorPreviewApi.Words words = CompetitorPreviewApi.Words.of(language);

			for (CompetitorCards.Shown shown : cards.everyShown(language)) {
				String number = shown.face().chip();

				now.put(new Key(number, language.code()), WhatFacebookHasRead.pageOf(number, words, shown));
			}
		}

		return now;
	}

	private Map<Key, Page> read() {
		Map<Key, Page> read = new HashMap<>();

		db.sql("select member_number, language, card, address from shared_card")
				.query(row -> {
					read.put(new Key(row.getString(1), row.getString(2)), new Page(row.getString(3), row.getString(4)));
				});

		return read;
	}
}
