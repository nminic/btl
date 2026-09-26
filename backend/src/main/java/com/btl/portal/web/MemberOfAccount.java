package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * THE MEMBER A SIGNED IN ACCOUNT BELONGS TO, IF IT BELONGS TO ONE AT ALL.
 *
 * <p>V23 gives {@code account} a {@code competitor_id}, nullable on purpose - „Empty for
 * a moderator who does not race, which is the ordinary case and not a fault" (owner,
 * 14.09.2026). Until this class nothing asked for it: {@link MeApi} says so in as many
 * words, „What keeps the number out of here is therefore no longer that it cannot be
 * found but that nothing has asked for it." This is the first thing that asks, because
 * the inbox and the notification switches are not facts about an account, they are facts
 * about the member the account happens to belong to, and {@code message.to_id} and
 * {@code notification_setting.competitor_id} both point at {@code competitor} and never at
 * {@code account}.
 *
 * <p><b>Why this does not live on {@link WhoIsAsking.Member}.</b> That record is handed
 * to every controller on every request whether the route wants it or not, and its own
 * javadoc gives the reason a member number is not on it: a moderator who does not race
 * would carry a null field every reader has to branch around. Reading it here instead,
 * on the one or two routes that actually need it, is the shape that javadoc invites: „a
 * resource that needs the member reads him by the account it already has."
 *
 * <p><b>Why this lives in {@code web} and not in {@code domain.account}.</b> Nothing under
 * {@code domain} touches {@link JdbcClient} anywhere in this codebase; the database is
 * read from this layer alone. This is a lookup and not a rule, so there is nothing for
 * {@code domain} to hold.
 *
 * <p><b>A shared home rather than one query written twice.</b> {@link InboxApi} and
 * {@link NotificationApi} both need exactly this fact and nothing more, so it is asked
 * once here (ADL A8's own reasoning about „Odgovara jedno mesto", applied to a lookup
 * instead of a right) rather than as the same one-column {@code select} sitting in two
 * controllers, free to drift apart the day one of them is edited and the other is not.
 */
@Component
class MemberOfAccount {

	private final JdbcClient db;

	MemberOfAccount(JdbcClient db) {
		this.db = db;
	}

	/**
	 * @param account {@code account.id}, read off {@link WhoIsAsking.Member} - never a
	 *                value the caller supplies, for the same reason {@link WhatHeMayDo}
	 *                reads the session and not the request
	 * @return {@code account.competitor_id}, or {@code null} exactly when that column is
	 *         null: an account that names no member. The row itself always exists - it is
	 *         the account of whoever is asking, already resolved once by
	 *         {@link WhoIsAsking} to get this far - so there is no case here for zero rows,
	 *         only for the one column that may or may not be there.
	 *
	 *         <p>Read through {@code .list().get(0)} rather than {@code .single()}: measured
	 *         on 17.09.2026, {@code JdbcClient}'s {@code single()} refuses a null result
	 *         outright ({@code DataAccessUtils.requiredSingleResult}, „Result value is null
	 *         but no null value expected") even though exactly one row came back, which is
	 *         precisely the ordinary case this method exists for. {@code list()} carries no
	 *         such rule, and the one row this query can ever return is already guaranteed by
	 *         {@code account}'s own primary key.
	 */
	Long competitorId(long account) {
		return db.sql("select competitor_id from account where id = ?")
				.param(account)
				.query(Long.class)
				.list()
				.get(0);
	}

	/**
	 * THE NAME TO FREEZE BESIDE A RECORD OF WHO DID SOMETHING, and it is here rather than in each
	 * caller for the reason this class's own note gives about one lookup in one place.
	 *
	 * <p><b>Why a name is ever copied out of {@code account} at all.</b> V16 keeps
	 * {@code payment.recorded_by_name} beside {@code payment.recorded_by} because the key is
	 * {@code on delete set null} and the record must still say who wrote it once the account is
	 * gone; V36 keeps {@code balance_entry.recorded_by_name} for the identical reason, and ADL asks
	 * for „ko" in the book in those words. So the same one-column {@code select} was needed in two
	 * controllers, which is exactly what this class exists to prevent.
	 *
	 * @param account {@code account.id}, read off {@link WhoIsAsking.Member} and never from a
	 *                request
	 * @return first and last name with one space between them. Never blank, which
	 *         {@code account_first_name_not_blank} and {@code account_last_name_not_blank} (V6, and
	 *         the columns B56 made NOT NULL) are what guarantee rather than anything here.
	 */
	String nameOf(long account) {
		return db.sql("select first_name || ' ' || last_name from account where id = ?")
				.param(account)
				.query(String.class)
				.single();
	}
}
