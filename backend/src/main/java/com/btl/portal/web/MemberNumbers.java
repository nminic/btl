package com.btl.portal.web;

import com.btl.portal.domain.member.MemberNumber;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * THE ONE PLACE A MEMBER NUMBER IS EVER DRAWN, and it is a sequence and never a query.
 *
 * <p><b>This sentence used to live in {@link PaymentApi} and was true there</b>, because
 * recognising a payment was the only way to become a member. The owner's decision of 26.09.2026
 * added a second way in - a membership activated out of the member's own balance - so the sentence
 * had to move rather than be repeated: a rule about a number handed out ONCE cannot have two
 * implementations, and the day it did, the second one would be the one nobody remembered to change.
 *
 * <p>{@code member_number_seq} (V16) is what makes two simultaneous activations of two different
 * people safe without a lock anywhere: PostgreSQL hands out each value from it exactly once,
 * whichever transaction asks first, and never the same value to both. {@code max(...) + 1} would
 * read what is there, which a concurrent second reader could read identically before either has
 * written anything back - the exact race this must not have. V16 gives the other half of the
 * reason: a query reads what is there, and what is there is missing exactly the people who left.
 *
 * <p><b>A drawn number is spent whether or not the transaction that drew it commits</b>, which is
 * what a sequence is for and is the reason nothing here tries to give one back. {@link PaymentApi}
 * already names that cost in its own javadoc for the case of two moderators confirming one payment
 * at the same instant.
 */
@Component
class MemberNumbers {

	private final JdbcClient db;

	MemberNumbers(JdbcClient db) {
		this.db = db;
	}

	/** The next one, as {@link MemberNumber} writes it. */
	String draw() {
		long value = db.sql("select nextval('member_number_seq')").query(Long.class).single();

		return MemberNumber.of((int) value).written();
	}
}
