package com.btl.portal.web;

import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Key;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Page;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Locale;

/**
 * WHAT FACEBOOK HAS READ OF THE PROFILES, written down when its crawler reads one, and the one thing a deletion owes
 * it.
 *
 * <p>Owner, PDL P11, 16.11.2026, item 14, two decisions, each chosen between the ways offered with the assistant's
 * recommendation:
 * <ol>
 * <li>the server remembers the profiles Facebook's crawler has already opened and asks Facebook to refresh only those;
 * a profile Facebook has never read is not asked about, because Facebook reads it fresh the first time somebody
 * pastes it ({@link #read});</li>
 * <li>when a member whose profile is shown is deleted, by his asking or by the
 * administration, the server asks Facebook AT ONCE, at the moment of the deletion, to read his address again (both
 * languages), so that Facebook gets the front page's preview; the name is not kept a minute after the deletion
 * ({@link #forgetWhenGone}). It holds for a profile Facebook has read, by the first: at an address Facebook never
 * read there is nothing for it to forget.</li>
 * </ol>
 *
 * <p><b>HOW THE SERVER KNOWS FACEBOOK HAS READ A PROFILE.</b> Facebook runs no JavaScript and reads the profile as
 * nginx sends it, with the block of {@link CompetitorPreviewApi} written in through an SSI subrequest, and that
 * subrequest reaches the backend with the reader's own {@code User-Agent}: measured on 16.11.2026 on nginx 1.29 with
 * {@code frontend/nginx.conf} as it stands, a request for {@code /sr/takmicar/000001-nikola-minic} carrying
 * {@code facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)} arrived at
 * {@code /api/previews/competitor/000001-sr} with that header unchanged and with the cookie emptied. Meta's page on
 * its crawlers names {@code facebookexternalhit} as the one that reads a page when its link is shared on Facebook,
 * Instagram or Messenger and keeps its title and picture, in two spellings that both begin with that word; its other
 * crawlers (for search, advertising and training) keep no preview, so they are not what this is about. So a reader
 * whose {@code User-Agent} carries that word, in any case, is Facebook ({@link #isFacebook}).
 *
 * <p><b>WHAT IS WRITTEN DOWN IS WHAT THE JOB NEEDS AND NOTHING MORE</b>: the page's two addresses, of the profile and
 * of the card Facebook was given ({@code shared_card}, V103). The card is what tells the job that Facebook holds
 * something that has since changed; no moment is kept, because nothing reads one.
 *
 * <p><b>WRITING IT DOWN CANNOT COST THE PAGE.</b> It happens only for Facebook's crawler, never for a person; in a
 * transaction of its own with a term of {@value #AT_MOST}, so a write held up behind a lock gives up long before the
 * two seconds nginx waits for the block; and whatever goes wrong is logged and goes no further, so the block is
 * served all the same. A write that failed is a profile the job does not know Facebook has read, which costs at most
 * a refresh until the crawler reads it again.
 */
@Component
class WhatFacebookHasRead {

	private static final Logger LOG = LoggerFactory.getLogger(WhatFacebookHasRead.class);

	/** The word every spelling of Facebook's sharing crawler begins with, in Meta's page on its crawlers. */
	static final String THE_CRAWLER = "facebookexternalhit";

	/** How long writing down what Facebook read may take, which is MY REASONING and not an owner decision. */
	static final String AT_MOST = "500ms";

	private final JdbcClient db;
	private final TransactionTemplate inOneTransaction;
	private final FacebookGraph facebook;
	private final Portal portal;

	WhatFacebookHasRead(JdbcClient db, TransactionTemplate inOneTransaction, FacebookGraph facebook,
			@Value("${btl.portal.address}") String portal) {
		this.db = db;
		this.inOneTransaction = inOneTransaction;
		this.facebook = facebook;
		this.portal = new Portal(portal);
	}

	/** Whether the reader of a page is Facebook's sharing crawler, by its {@code User-Agent}. */
	static boolean isFacebook(String reader) {
		return reader != null && reader.toLowerCase(Locale.ROOT).contains(THE_CRAWLER);
	}

	/**
	 * THE PAGE AS A VISITOR IS SHOWN IT, which is what the preview gives a reader and what the job compares with: the
	 * address of the card and of the profile. One home, so that what is written down and what is compared with it
	 * cannot be two spellings of one page.
	 */
	static Page pageOf(String number, CompetitorPreviewApi.Words words, CompetitorCards.Shown shown) {
		return new Page(shown.address(), CompetitorPreviewApi.profilePath(number, shown.face().name(), words));
	}

	/**
	 * Writes the page down as Facebook has just been given it, when the reader is Facebook and Facebook is on at
	 * all; otherwise nothing.
	 */
	void read(String reader, Key key, Page page) {
		if (!facebook.isOn() || !isFacebook(reader)) {
			return;
		}

		try {
			inOneTransaction.executeWithoutResult(writing -> {
				db.sql("set local statement_timeout = '" + AT_MOST + "'").update();
				db.sql("insert into shared_card (member_number, language, card, address) values (?, ?, ?, ?)"
								+ " on conflict (member_number, language)"
								+ " do update set card = excluded.card, address = excluded.address")
						.params(key.memberNumber(), key.language(), page.card(), page.address()).update();
			});
		} catch (RuntimeException failed) {
			/* Neither the number nor the address, which carries the name: what went wrong, and that it went no further. */
			LOG.warn("What Facebook read was not written down: {}", failed.getClass().getSimpleName());
		}
	}

	/**
	 * THE DELETION OF A MEMBER, called in its transaction BEFORE he is deleted, because his rows go with him: the
	 * addresses at which Facebook holds his card are read now and handed to Facebook AFTER THE COMMIT, without waiting
	 * for it, so that a deletion that rolls back asks nothing and a Facebook that is slow or refusing cannot hold up or
	 * fail a deletion that has already happened. An address where Facebook holds the front page's preview already is
	 * not asked again, and a profile Facebook never read has no address here at all. Nothing of it is written
	 * anywhere: the addresses live in this transaction's memory until the requests are sent, and the log does not
	 * name them ({@link FacebookGraph#readAgainUnnamed}).
	 *
	 * @param member the {@code competitor.id} of the member about to be deleted
	 */
	void forgetWhenGone(long member) {
		if (!facebook.isOn()) {
			return;
		}

		List<String> addresses = db.sql("select s.address from shared_card s join competitor c"
						+ " on c.member_number = s.member_number where c.id = ? and s.card is not null order by s.language")
				.param(member).query(String.class).list();

		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {

			@Override
			public void afterCommit() {
				addresses.forEach(address -> facebook.readAgainUnnamed(portal.address() + address));
			}
		});
	}
}
