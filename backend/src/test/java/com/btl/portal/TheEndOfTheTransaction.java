package com.btl.portal;

import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * THE END OF A TRANSACTION, BROUGHT FORWARD, for the tests that never reach one.
 *
 * <p>A trigger that is {@code DEFERRABLE INITIALLY DEFERRED} asks its question when the
 * transaction commits: the two V29 puts on {@code race} and {@code btl_event}, and the four V54
 * puts on the tables that can hold a picture, which delete a {@code photo} row that nobody holds
 * any more. A test that is {@code @Transactional} is rolled back and never commits, so such a
 * trigger would never speak in it, and an assertion about what it does would pass against a
 * database with the trigger deleted. For a row that should STILL be there it is worse: the
 * assertion would pass against a trigger that deletes too much.
 *
 * <p>{@code set constraints all immediate} fires every event the transaction has queued, inside
 * the transaction, so what is refused or deleted is exactly what a commit would have refused or
 * deleted. It also leaves every deferred check immediate for the rest of the case, so it is said
 * once, after the door has been used and before the table is read.
 *
 * <p><b>It is not a substitute for a case that commits.</b> What a real commit leaves behind, and
 * what two transactions do to one another, is {@code APictureGoesWithItsLastHolderTest}'s trade,
 * which is not {@code @Transactional} for that reason.
 */
public final class TheEndOfTheTransaction {

	private TheEndOfTheTransaction() {
	}

	/** Fires every deferred trigger event this transaction has queued, now. */
	public static void broughtForward(JdbcClient db) {
		db.sql("set constraints all immediate").update();
	}
}
