/* A payment's reference is exactly ten digits.
 *
 * Owner, PDL P8, 20.10.2026: the reference (poziv na broj) is YYYYNNNNNN, the season and then the
 * six digit member number with its leading noughts, for example 2027000027 ("neka sifra uplate bude
 * formata YYYYNNNNNN gde ne YYYY godina, a NNNNNN clanski broj"). Choosing among the outcomes offered
 * to him (one of them the recommended one), he decided that the server takes exactly ten digits, on the
 * route and in the database, and that a call with nine or eleven digits is refused.
 *
 * V16's rule said "digits and nothing else, seven or more", which was written for the shape the
 * decision of 31.07.2026 had (the season and the member number WITHOUT its noughts, so the length
 * moved with the number). That shape was overturned on 20.10.2026, and a rule that takes seven digits
 * and also seven hundred describes nothing the portal writes any more. PaymentApi's pattern is
 * changed in the same commit, so the two say one thing.
 *
 *
 * WHAT IT DOES TO THE ROWS THAT ARE ALREADY THERE, and why the constraint is `not valid`
 * ---------------------------------------------------------------------------------------
 * The rule is added `not valid`, the same form V35 gave its pair: it is enforced on every row written
 * from now on and it is not checked against the rows that stand. A payment recorded before the owner's
 * decision may hold a reference of the old shape (the eight digits of the 20271000 kind), and a plain
 * constraint would make this file fail on the first such row and stop Flyway, which is how V35 took
 * QA down on 27.09.2026.
 *
 * NO DATA IS INVENTED. An old reference is not rewritten, padded or cleared: nobody can say from the
 * digits alone which member it was meant to name, and a reference is what one line of a bank
 * statement is matched by, so a changed one is a payment nothing matches. The row stays as it is.
 * The consequence that is owned: an UPDATE of such a row would be refused by this rule, because
 * PostgreSQL checks a check constraint on every row it writes. The portal never updates a payment (it
 * inserts one and deletes one), so no code path meets it.
 *
 * db/PaymentReferenceCarriedOverTest runs this file over a database that holds a reference of the old
 * shape, and over a new row of nine and of eleven digits that the database must refuse.
 *
 *
 * THE UNIQUE KEY IS NOT TOUCHED. payment_reference_unique stands over the same column, and with the
 * shape exactly ten digits the index can no longer be handed a key it cannot hold: the length bound
 * PaymentApi kept for that (MOST_A_REFERENCE_CAN_BE) goes with this change, since the shape is the
 * bound now.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */
alter table payment
    drop constraint payment_reference_shape;

alter table payment
    add constraint payment_reference_shape
        check (reference is null or reference ~ '^[0-9]{10}$') not valid;
