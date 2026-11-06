package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V87, FROM THE TABLE'S SIDE: a reset link is spent once and is never given more time, whoever
 * writes the statement (ADL, technical decision, 06.11.2026).
 *
 * <p>Nothing here goes through the service. The route spends a link with one atomic statement, and
 * the point of the trigger is that the table says the same thing to a statement written by somebody
 * else, so every case writes the statement itself. Each refusal is its own case because PostgreSQL
 * ends the transaction at the first error.
 *
 * <p>The cases come in pairs on purpose: what is refused, and the nearest thing that is not. A
 * trigger that refused every update of this table would pass the first half of each pair and fail
 * the route the portal spends a link with.
 */
class AResetLinkIsSpentOnceTest extends DatabaseTest {

	private static final String A_DIGEST = "a".repeat(64);

	private long anAccount() {
		return db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', 'link-' || nextval('account_id_seq') || '@primer.rs',"
						+ " (select id from role where code = 'competitor'))"
						+ " returning id")
				.query(Long.class).single();
	}

	private long aLiveLink() {
		return db.sql("insert into password_reset_token (account_id, token_hash) values (?, ?)"
						+ " returning id")
				.params(anAccount(), A_DIGEST).query(Long.class).single();
	}

	private long aSpentLink() {
		return db.sql("insert into password_reset_token (account_id, token_hash, used_at)"
						+ " values (?, ?, now()) returning id")
				.params(anAccount(), A_DIGEST).query(Long.class).single();
	}

	/** Whether the link is spent, read back from the row and never from what was just written. */
	private boolean isSpent(long link) {
		return db.sql("select used_at is not null from password_reset_token where id = ?")
				.param(link).query(Boolean.class).single();
	}

	@Test
	void aLiveLinkIsSpentByTheStatementTheServiceWrites() {
		long link = aLiveLink();

		assertThat(db.sql("update password_reset_token set used_at = now()"
				+ " where id = ? and used_at is null").param(link).update())
				.as("the one spend the route is allowed to make was refused")
				.isEqualTo(1);
		assertThat(isSpent(link)).isTrue();
	}

	/** The route's own statement a second time finds nothing to change, and is not an error. */
	@Test
	void theServicesStatementAskedTwiceSpendsOnceAndRefusesNothing() {
		long link = aLiveLink();
		String spend = "update password_reset_token set used_at = now() where id = ? and used_at is null";

		assertThat(db.sql(spend).param(link).update()).isEqualTo(1);
		assertThat(db.sql(spend).param(link).update())
				.as("the second spend changed a row that was spent already")
				.isZero();
	}

	@Test
	void aSpentLinkCannotBeSpentAgain() {
		long link = aSpentLink();

		assertThatThrownBy(() -> db.sql("update password_reset_token set used_at = now() + interval '1 minute'"
				+ " where id = ?").param(link).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("was spent");
	}

	@Test
	void aSpentLinkCannotBeMadeLiveAgain() {
		long link = aSpentLink();

		assertThatThrownBy(() -> db.sql("update password_reset_token set used_at = null where id = ?")
				.param(link).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("was spent");
	}

	/** Not only the column that says spent: any change to a spent row is a change to a fact. */
	@Test
	void aSpentLinkCannotHaveAnythingElseChanged() {
		long link = aSpentLink();

		assertThatThrownBy(() -> db.sql("update password_reset_token"
				+ " set expires_at = expires_at - interval '1 minute' where id = ?").param(link).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("was spent");
	}

	@Test
	void aLiveLinkCannotBeGivenMoreTime() {
		long link = aLiveLink();

		assertThatThrownBy(() -> db.sql("update password_reset_token"
				+ " set expires_at = expires_at + interval '365 days' where id = ?").param(link).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("more time");
	}

	/** The smallest step forward is the same refusal as the largest, and standing still is not one. */
	@Test
	void evenAMicrosecondOfMoreTimeIsRefused() {
		long link = aLiveLink();

		assertThatThrownBy(() -> db.sql("update password_reset_token"
				+ " set expires_at = expires_at + interval '1 microsecond' where id = ?")
				.param(link).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("more time");
	}

	@Test
	void aLiveLinkMayStandStillOrBeEndedEarlier() {
		long link = aLiveLink();

		assertThat(db.sql("update password_reset_token set expires_at = expires_at where id = ?")
				.param(link).update()).isEqualTo(1);
		assertThat(db.sql("update password_reset_token"
				+ " set expires_at = created_at + interval '10 minutes' where id = ?")
				.param(link).update())
				.as("ending a link early only shortens what it allows, so it is not refused")
				.isEqualTo(1);
	}

	/** Minting is not an update: an invitation is written with seven days and a reset with an hour. */
	@Test
	void aLinkIsMintedWithWhateverLifeItsMinterGivesIt() {
		long account = anAccount();

		assertThat(db.sql("insert into password_reset_token (account_id, token_hash, expires_at)"
				+ " values (?, ?, now() + interval '168 hours')").params(account, A_DIGEST).update())
				.isEqualTo(1);
	}
}
