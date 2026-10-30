/*
 * THE MONEY OF A DELETED MEMBER STAYS, AND HIS NAME DOES NOT.
 *
 * PDL, owner, 29.10.2026, in the editorial review of the Rulebook, the Terms and the Privacy Policy:
 * „Brisanje profila više ne sme da briše uplate, članstva ni balans: ostaju bez imena, jer Politika
 * obećava čuvanje knjigovodstvene dokumentacije najmanje pet godina. Popravlja se kod, ne tekst."
 *
 * WHAT THE TEXT ON PRODUCTION PROMISES, and what this file makes true. The Privacy Policy, section 5:
 * a member who asks to be deleted loses his profile and his results, „ime i članski broj nestaju, a
 * gde god ste se pominjali ostaje anonimizovan zapis", and its table keeps „Knjigovodstvena
 * dokumentacija o uplatama" for „Najmanje pet godina". Until today the schema did the opposite of
 * the second sentence: `payment_competitor_fk` (V16), `membership_competitor_fk` (V22),
 * `balance_entry_competitor_fk` (V38) and `membership_change_competitor_fk` (V63) were all ON DELETE
 * CASCADE, so a deletion took the bookkeeping with it.
 *
 * THE SENTENCES THAT SAID SO STAND IN THOSE FILES AND ARE NO LONGER TRUE. V22: „The membership goes
 * with the person". V38: „The balance belongs to the person and dies with him", and „The only
 * deletion that can reach a row here is the cascade from a deleted member". V63: „The member's own
 * row, and it goes with him (PDL P23)". A merged migration is never edited (ADL A2), so they are
 * named here, where the next reader meets the correction beside the keys it changes.
 *
 * WHAT STAYS, AND WHAT IT KEEPS. Four tables, each a record of money or of a decision about money:
 *
 *   - `payment`            the amount, the currency, the fee, the season, the method, what arrived,
 *                          and who recognised it and when;
 *   - `membership`         the season and its basis, the receipt or the book line behind it, and who
 *                          freed the member of the fee and when;
 *   - `balance_entry`      every movement of the book, with its reason, season and author;
 *   - `membership_change`  the trail of a cancellation or a change of basis, with its author.
 *
 * Each loses the pointer at the member and nothing else, by the shape `balance_entry_referred_fk`
 * (V38) already has: the key is ON DELETE SET NULL and the column it sits on may be null.
 *
 * WHAT DOES NOT STAY, said so that it reads as a decision and not as an omission:
 *
 *   - `balance_promise` keeps its cascade. It records what a payment code PROMISED, which V38 calls
 *     „not money moving" and keeps out of the book for exactly that reason; it is a fact about a
 *     live code of a member who is no longer there, and no bookkeeping is lost with it.
 *   - Results, the profile, ducats, messages addressed to him, pairs and teams go as before. That is
 *     P21: „obriši profil" deletes every result.
 */


/* ---------------------------------------------------------------------------------------------
 * THE FOUR KEYS, AND THE COLUMNS THEY SIT ON
 * ------------------------------------------------------------------------------------------ */

alter table payment alter column competitor_id drop not null;
alter table payment drop constraint payment_competitor_fk;
alter table payment add constraint payment_competitor_fk
    foreign key (competitor_id) references competitor (id) on delete set null;

alter table balance_entry alter column competitor_id drop not null;
alter table balance_entry drop constraint balance_entry_competitor_fk;
alter table balance_entry add constraint balance_entry_competitor_fk
    foreign key (competitor_id) references competitor (id) on delete set null;

alter table membership_change alter column competitor_id drop not null;
alter table membership_change drop constraint membership_change_competitor_fk;
alter table membership_change add constraint membership_change_competitor_fk
    foreign key (competitor_id) references competitor (id) on delete set null;


/*
 * THE MEMBERSHIP NEEDS ONE MORE STEP, because its member was its primary key and a primary key
 * cannot hold a null. V22 chose the pair as the key on purpose - „there is nothing else the row could
 * be identified by" - and that stopped being true the day a row has to outlive its member.
 *
 * The shape is `payment`'s, which already answered the same question: a surrogate `payment_pk` and,
 * beside it, `payment_one_a_season (competitor_id, season)`. So the pair becomes
 * `membership_one_a_season` and keeps saying everything V22 had it say about a living member - one
 * answer per person per season, and the target of every `where competitor_id = ? and season = ?` -
 * while two deleted members who each held 2027 are two rows, because PostgreSQL lets nulls through a
 * unique constraint.
 *
 * `bigserial` and not `bigint not null`, because the table already holds rows on every database this
 * runs on: the sequence is what gives each of them its number as the column arrives.
 */
alter table membership drop constraint membership_pk;
alter table membership add column id bigserial;
alter table membership add constraint membership_pk primary key (id);
alter table membership add constraint membership_one_a_season unique (competitor_id, season);

alter table membership alter column competitor_id drop not null;
alter table membership drop constraint membership_competitor_fk;
alter table membership add constraint membership_competitor_fk
    foreign key (competitor_id) references competitor (id) on delete set null;

/*
 * AND THE RECEIPT STAYS NAMED WHEN THE MEMBER IS NOT. `membership_payment_fk` (V22) is the triple
 * (payment_id, competitor_id, season), and a foreign key with a null in it is not checked at all
 * (MATCH SIMPLE), so the moment `competitor_id` empties, nothing would stop the membership naming a
 * payment that no longer exists - the one shape `membership_basis_says_whether_a_payment_is_named`
 * exists to forbid. This key holds the half that survives: the receipt itself, with V22's CASCADE.
 */
alter table membership add constraint membership_payment_id_fk
    foreign key (payment_id) references payment (id) on delete cascade;


/* ---------------------------------------------------------------------------------------------
 * BUT A ROW IS NEVER WRITTEN WITHOUT ONE
 * ------------------------------------------------------------------------------------------ */

/*
 * THE NOT NULL THAT WENT HELD TWO THINGS, AND ONLY ONE OF THEM STOPPED BEING TRUE. „A row may lose
 * its member" is new; „a row is written about somebody" is not, and dropping the constraint dropped
 * both. The half about writing is held where writing happens, which is V38's own answer to the same
 * split: `balance_entry_only_a_referral_names_a_member` is one direction because the other stops
 * being true after a deletion, and `balance_entry_says_who_earned_it` holds that other direction on
 * INSERT alone. One function for the four tables, because the sentence is the same in each.
 */
create function a_new_row_names_its_member() returns trigger
    language plpgsql
as $body$
begin
    if new.competitor_id is null then
        raise exception using
            errcode = '23502',
            message = tg_name || ': a row of ' || tg_table_name || ' is written about a member',
            hint = 'Only a deleted member''s rows are without one (PDL, 29.10.2026), never a new row.';
    end if;

    return new;
end;
$body$;

create trigger payment_names_its_member_when_written
    before insert on payment
    for each row
execute function a_new_row_names_its_member();

create trigger membership_names_its_member_when_written
    before insert on membership
    for each row
execute function a_new_row_names_its_member();

create trigger balance_entry_names_its_member_when_written
    before insert on balance_entry
    for each row
execute function a_new_row_names_its_member();

create trigger membership_change_names_its_member_when_written
    before insert on membership_change
    for each row
execute function a_new_row_names_its_member();


/* ---------------------------------------------------------------------------------------------
 * A WRITTEN LINE MAY FORGET ITS MEMBER, AND NOTHING ELSE MAY MOVE
 * ------------------------------------------------------------------------------------------ */

/*
 * V38's own reasoning, one column further. A key set to null by a referential action arrives at the
 * trigger as an UPDATE, so a book that refuses every update refuses the deletion of a member - which
 * V38 measured for `referred_competitor_id` and `recorded_by` and answered by letting those two be
 * forgotten. `competitor_id` joins them.
 *
 * AND ONE NAME MAY BE REWRITTEN, ONLY TO THE OWNER'S WORD AND ONLY TOGETHER WITH ITS KEY. The line a
 * member wrote himself - a spend of his own balance, a change of his own country, the reward his own
 * activation paid the man who brought him in - carries HIS name in `recorded_by_name`. When his
 * account goes, `a_deleted_account_forgets_his_own_lines` below replaces it with <Obrisani član> or
 * <Obrisana članica> (ADL A37), in the same statement that empties `recorded_by`. The trigger lets
 * exactly that through: the name may change only when the key goes from somebody to nobody in the
 * same update, and only to one of those two words. Anything else is the rewrite ADL forbids.
 *
 * The whole row is still compared through `to_jsonb`, so a column added tomorrow is guarded the day
 * it arrives.
 */
create or replace function a_balance_entry_is_written_once() returns trigger
    language plpgsql
as $body$
begin
    /* Everything but the forgettable keys and the name beside one of them, compared as the whole
       row. */
    if (to_jsonb(new) - 'referred_competitor_id' - 'recorded_by' - 'competitor_id' - 'recorded_by_name')
        is distinct from
        (to_jsonb(old) - 'referred_competitor_id' - 'recorded_by' - 'competitor_id' - 'recorded_by_name') then
        raise exception using
            errcode = '23514',
            message = tg_name || ': balance entry ' || old.id || ' cannot be changed once written',
            hint = 'ADL, virtuelni balans: nepromenljive stavke. Write a new entry instead.';
    end if;

    /* And those keys may only ever be forgotten, never pointed somewhere else. */
    if (new.referred_competitor_id is not null
            and new.referred_competitor_id is distinct from old.referred_competitor_id)
        or (new.recorded_by is not null and new.recorded_by is distinct from old.recorded_by)
        or (new.competitor_id is not null and new.competitor_id is distinct from old.competitor_id) then
        raise exception using
            errcode = '23514',
            message = tg_name || ': balance entry ' || old.id
                || ' cannot be made to name somebody else',
            hint = 'A key on a written line may be forgotten when a row goes, never re-pointed.';
    end if;

    /* And the name moves only to the word for a deleted member, in the update that forgets whose
       account wrote it. */
    if new.recorded_by_name is distinct from old.recorded_by_name
        and not (new.recorded_by_name in ('<Obrisani član>', '<Obrisana članica>')
                 and old.recorded_by is not null and new.recorded_by is null) then
        raise exception using
            errcode = '23514',
            message = tg_name || ': balance entry ' || old.id || ' cannot be signed by somebody else',
            hint = 'Only a deleted member''s own line loses his name, and only as his account goes.';
    end if;

    return new;
end;
$body$;

/*
 * The same for the trail of a membership (V63), which forgot only `decided_by` until today.
 * `decided_by_name` is never rewritten: a change of a membership is made by the administration, and
 * the administration's name staying beside its decision is what the Privacy Policy says in as many
 * words („vaše ime ostaje uz tu odluku u evidenciji uplata, članstava i virtuelnog balansa").
 */
create or replace function a_membership_change_is_written_once() returns trigger
    language plpgsql
as $body$
begin
    /* Everything but the forgettable keys, compared as the whole row. */
    if (to_jsonb(new) - 'decided_by' - 'competitor_id')
        is distinct from (to_jsonb(old) - 'decided_by' - 'competitor_id') then
        raise exception using
            errcode = '23514',
            message = tg_name || ': membership change ' || old.id || ' cannot be changed once written',
            hint = 'PDL P8, 18.10.2026: the trail is a record that does not change.';
    end if;

    /* And those keys may only ever be forgotten, never pointed somewhere else. */
    if (new.decided_by is not null and new.decided_by is distinct from old.decided_by)
        or (new.competitor_id is not null and new.competitor_id is distinct from old.competitor_id) then
        raise exception using
            errcode = '23514',
            message = tg_name || ': membership change ' || old.id
                || ' cannot be made to name somebody else',
            hint = 'A key on a written line may be forgotten when a row goes, never re-pointed.';
    end if;

    return new;
end;
$body$;


/* ---------------------------------------------------------------------------------------------
 * THE DELETION ITSELF: POINTERS, THE NUMBER, AND THE NAME HE WROTE
 * ------------------------------------------------------------------------------------------ */

/*
 * V33's trigger, with every statement it held kept word for word, and four more in its own shape:
 * the pointer and what identifies the member are emptied TOGETHER, in one statement, BEFORE the row
 * goes, so the referential actions that follow find nothing left pointing at him and the order of
 * the keys never matters.
 *
 * THE ORDER INSIDE IS NOT FREE, and it is the one thing here that is. `membership_payment_fk` names
 * (payment_id, competitor_id, season) in `payment`, so emptying `payment.competitor_id` first would
 * leave a membership pointing at a triple that no longer exists. The membership forgets him first;
 * a key with a null in it is no longer checked, and the payment may then follow.
 *
 * THE MEMBER NUMBER IS IN THE REFERENCE, and that is why `reference` empties with the pointer. V16
 * builds it as the season and the member number run together (`2027000127`), and the Privacy Policy
 * says „ime i članski broj nestaju". What links a recognised payment to its bank line after that is
 * `bank_statement_line.payment_id` (V74), which this file leaves alone.
 */
create or replace function forget_the_name_of_a_deleted_member() returns trigger
    language plpgsql
as $body$
declare
    /* The word the owner chose, picked by the one column that can still answer. `gender` is
       `M` or `F` and nothing else (`competitor_gender_known`, V7), so there is no third branch
       to get wrong and no `else` to hide one. */
    gone text := case old.gender when 'M' then '<Obrisani član>' else '<Obrisana članica>' end;
begin
    update season_competitor set who = null where competitor_id = old.id;
    update season_league_standing set who = null where competitor_id = old.id;

    update message set from_id = null, from_name = gone where from_id = old.id;
    update event_comment set competitor_id = null, who = gone where competitor_id = old.id;

    update membership set competitor_id = null where competitor_id = old.id;
    update membership_change set competitor_id = null where competitor_id = old.id;
    update payment set competitor_id = null, reference = null where competitor_id = old.id;
    update balance_entry set competitor_id = null where competitor_id = old.id;

    return old;
end;
$body$;


/*
 * THE LINES HE WROTE HIMSELF LOSE HIS NAME WHEN HIS ACCOUNT GOES, and it has to be the account and
 * not the member, because of the order a deletion runs in. `account_competitor_fk` (V23) is ON DELETE
 * RESTRICT, so `CompetitorWriteApi.takeAway` deletes the account first; by the time the member's
 * own trigger runs, `recorded_by` is already null on every line, and „this line was written by him"
 * can no longer be told apart from „this line was written by an administrator whose account went
 * long ago".
 *
 * WHICH LINES, by two facts the row holds at this moment: the account that wrote it is this one, and
 * the line is ABOUT his own member - his own book (`competitor_id`), or the reward his own activation
 * paid somebody else (`referred_competitor_id`). An administrator's line about another member keeps
 * the administrator's name, which is the exception the Privacy Policy names.
 *
 * Emptied together with its key, for V33's reason, and that is also the one update
 * `a_balance_entry_is_written_once` lets rewrite a name.
 */
create function a_deleted_account_forgets_his_own_lines() returns trigger
    language plpgsql
as $body$
declare
    gone text := (select case gender when 'M' then '<Obrisani član>' else '<Obrisana članica>' end
                  from competitor where id = old.competitor_id);
begin
    update balance_entry set recorded_by = null, recorded_by_name = gone
     where recorded_by = old.id
       and (competitor_id = old.competitor_id or referred_competitor_id = old.competitor_id);

    return old;
end;
$body$;

create trigger account_deletion_forgets_his_own_lines
    before delete on account
    for each row
execute function a_deleted_account_forgets_his_own_lines();
