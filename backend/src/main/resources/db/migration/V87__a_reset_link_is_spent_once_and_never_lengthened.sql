/*
 * A RESET LINK IS SPENT ONCE AND IS NEVER GIVEN MORE TIME, AND THE DATABASE IS WHAT ENFORCES IT.
 *
 * ADL, owner, 06.11.2026: „Link za oporavak lozinke se troši jednom i ne produžava se, i to sprovodi
 * baza, ne servis. Okidač odbija izmenu reda tokena kad `used_at` nije null i brani pomeranje
 * `expires_at`; servis i dalje troši atomskim upitom." The precedent for a trigger that says what a
 * row may no longer become is V38 (`a_balance_entry_is_written_once`), the shape this follows.
 *
 * WHAT WAS MISSING, measured in the review that wrote it down: nothing in the schema stopped
 * `used_at` from being written a second time, or `expires_at` from being moved forward on a token
 * that lives an hour (an hour made into 365 days). The service spends a link with one statement
 * (`update ... where account_id = ? and used_at is null`), which is why two parallel requests with the
 * same link do not both win today; this file is what makes that a property of the table and not of
 * whoever writes the next statement against it.
 *
 * TWO REFUSALS, BOTH ON UPDATE, BOTH WITH THE SAME ERROR CODE A CHECK WOULD RAISE (23514):
 *
 *   - a row whose `used_at` is already set cannot be updated at all. A spent link is a fact, and
 *     "spent again" and "un-spent" are both an update of such a row, so one refusal says both;
 *   - the end of a link cannot be moved LATER. Moving it earlier is allowed, and that is a choice and
 *     not an oversight: it can only shorten what the link allows, never lengthen it, and a test of the
 *     portal already ends a link early the way a clock would. The decision's words „brani pomeranje"
 *     are read as „brani produžavanje", the thing the finding measured, and the earlier direction is
 *     named here so the next reader finds a boundary and not a gap.
 *
 * Under concurrency the second of two spenders meets the first one's committed row: PostgreSQL waits
 * for the row lock and re-reads the row, so the trigger sees `used_at` set and refuses, and the
 * service's own `where used_at is null` finds nothing to change. Either way exactly one wins.
 *
 * THE ROWS ALREADY STANDING ARE NOT JUDGED. A trigger on UPDATE does not look at rows nobody
 * updates, so a token that already breaks the rule (a spent one, one given more time) does not stop
 * this migration or the deployment; the rule holds from the next update on. That is measured, not
 * assumed: `AResetLinkIsSpentOnceCarriedOverTest` takes the trigger away, writes both shapes of
 * offender the way a database already in use holds them, runs THIS FILE, and requires it not to fail.
 *
 * INSERT is not touched: a link is minted with whatever life its minter gives it, an hour for a
 * forgotten password and seven days for an invitation (AnInvitationOfAMember), and V72 keeps the two
 * apart for exactly that reason.
 */
create function a_reset_link_is_spent_once_and_never_lengthened() returns trigger
    language plpgsql
as $body$
begin
    if old.used_at is not null then
        raise exception using
            errcode = '23514',
            message = tg_name || ': reset link ' || old.id || ' was spent and cannot be changed',
            hint = 'ADL 06.11.2026: a spent link is a fact. Mint a new link instead.';
    end if;

    if new.expires_at > old.expires_at then
        raise exception using
            errcode = '23514',
            message = tg_name || ': reset link ' || old.id || ' cannot be given more time',
            hint = 'ADL 06.11.2026: a link is never lengthened. Mint a new link instead.';
    end if;

    return new;
end;
$body$;

create trigger password_reset_token_is_spent_once_and_never_lengthened
    before update on password_reset_token
    for each row
execute function a_reset_link_is_spent_once_and_never_lengthened();
