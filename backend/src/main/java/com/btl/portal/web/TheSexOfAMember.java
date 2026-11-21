package com.btl.portal.web;

import com.btl.portal.domain.mail.Gender;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.Optional;

/**
 * THE SEX THE MEMBER GAVE WHEN HE REGISTERED, which decides the participle in the words that carry one
 * (owner, 21.11.2026: „po polu primaoca ... jer pol znamo iz registracije"). One question asked of
 * {@code competitor.gender} in one place, so that every notice that has words for a woman reads it the
 * same way and from the same row: the row of the one who READS, never of the one the message is about.
 */
final class TheSexOfAMember {

	private TheSexOfAMember() {
	}

	/**
	 * The sex of the member an account belongs to, and EMPTY for an account that names no member (a
	 * moderator who does not race, V23): that account has no sex anywhere in the portal, and what is
	 * written to it then is the owner's to decide, not this method's to guess.
	 */
	static Optional<Gender> ofTheAccount(JdbcClient db, long account) {
		return db.sql("select c.gender from account a join competitor c on c.id = a.competitor_id"
				+ " where a.id = ?").param(account).query(String.class).optional().map(Gender::ofTheColumn);
	}

	/** The reader's sex, by the member's id; a member who does not exist has no sex and the question throws. */
	static Gender of(JdbcClient db, long member) {
		return Gender.ofTheColumn(db.sql("select gender from competitor where id = ?")
				.param(member).query(String.class).single());
	}
}
