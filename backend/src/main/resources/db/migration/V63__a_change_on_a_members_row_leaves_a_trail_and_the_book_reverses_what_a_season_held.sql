/* A CHANGE ON A MEMBER'S ROW LEAVES A TRAIL, AND THE BOOK REVERSES WHAT A SEASON HELD.
 *
 * The owner, 18.10.2026 (PDL P8, the section „Osnov clanstva ima jedan dom, zapis po sezoni"): the
 * basis of a membership is changed, and a payment is cancelled, by options on the member's row in
 * the moderation of the members. This file is the schema those options stand on, and nothing else:
 * no route writes either of the two things below yet, and the seasons that may be acted on („do
 * 14.10. samo tekuca, od 15.10. samo naredna") are the route's to enforce, not the schema's.
 *
 * Two of his decisions of that day are carried out here, each in its own half.
 *
 *
 * ---------------------------------------------------------------------------------------------
 * ONE. THE BOOK GETS A FIFTH REASON, `reversal`
 * ---------------------------------------------------------------------------------------------
 *
 * „Knjiga balansa pri stornu i pri promeni "uplata" u oslobodjenje: protivstavka. Upisuje se nova
 * stavka koja vraca ono sto je bilo skinuto sa balansa, odnosno skida visak koji je otisao u
 * balans; nista se ne brise, knjiga ostaje knjiga koja se ne menja." (chosen with the
 * recommendation, 18.10.2026). And: „aktivacija iz balansa se moze stornirati, uz protivstavku u
 * knjizi."
 *
 * So what a season's membership held against the balance - what it took off it, or the surplus it
 * credited to it - is answered by a NEW line, and the lines that stand are not touched.
 * `a_balance_entry_is_written_once` (V38) is what makes that the only road, and it is unchanged.
 *
 * WHY ONE REASON AND NOT TWO. A reversal gives back what a membership took (the line is positive)
 * or takes back what an overpayment credited (negative), and which of the two is decided by what the
 * season holds in the book, not by the act on the row. A reason per direction would make the caller
 * choose one and the schema check the choice; one reason with the sign of the amount is the same
 * shape `conversion` (V42) already has for the same reason: „the one reason whose sign cannot be
 * fixed in advance". What is refused is nought, because a line that moves nothing is not a fact
 * about money, and a season that held nothing gets no line at all.
 *
 * IT NAMES ITS SEASON, both ways. A reversal is always about one season's membership, and the season
 * is the only thing that ties it to the lines it reverses - there is no key from a payment to the
 * lines it produced (`PaymentApi` says so), and there is none from a reversal either. So `reversal`
 * joins `membership` and `overpayment` on the season side of `balance_entry_what_names_the_season`.
 *
 * NOTHING HERE TOUCHES A REWARD. „Nagrada preporuciocu ostaje kad se clanstvo preporucenog
 * stornira" (18.10.2026): a reward is in the REFERRER'S book and names no season, so no reversal of
 * this member's season can reach it, and `balance_entry_one_a_referral` (V38) is what makes a second
 * payment of the same newcomer earn nothing a second time.
 *
 * THE ROWS THAT ARE ALREADY THERE. Both constraints are rewritten WIDER and nothing else: a row
 * that satisfied the narrower rule satisfies the wider one, and the new sign rule speaks only of
 * `reversal`, which no row anywhere can carry before this file. They are added valid.
 * `db/ReversalArrivesOverTheBookAlreadyThereTest` runs this file over one line of every reason
 * that exists and requires every line to come out as it went in and every constraint validated.
 */

alter table balance_entry
    drop constraint balance_entry_reason_known;

alter table balance_entry
    add constraint balance_entry_reason_known
        check (reason in ('referral', 'membership', 'overpayment', 'conversion', 'reversal'));

alter table balance_entry
    drop constraint balance_entry_what_names_the_season;

alter table balance_entry
    add constraint balance_entry_what_names_the_season
        check ((reason in ('membership', 'overpayment', 'reversal')) = (season is not null));

alter table balance_entry
    add constraint balance_entry_a_reversal_moves_something
        check (reason <> 'reversal' or amount <> 0);

comment on column balance_entry.reason is
    'Why the line moves the balance: a referral earned, a membership spent on, an overpayment '
        'credited, a conversion between currencies (V42), or a reversal of what one season''s '
        'membership held against the balance, written when that membership is cancelled or its basis '
        'changes from a payment (V63, PDL P8, 18.10.2026). A reversal is positive when it gives back '
        'what was taken and negative when it takes back a credit.';


/* ---------------------------------------------------------------------------------------------
 * TWO. THE TRAIL OF A CANCELLATION AND OF A CHANGE OF BASIS
 * ---------------------------------------------------------------------------------------------
 *
 * „Trag storna i promene osnova zivi u posebnom zapisu koji se ne menja, BEZ iznosa. Nosi clana,
 * sezonu, radnju, osnov pre i posle, ko i kada. Iznos se ne belezi, u skladu sa odlukom da se zapis
 * o uplati brise." (chosen with the recommendation, 18.10.2026). Refused, with it: a record with the
 * amount, and the trail kept only as a message in the inbox.
 *
 * So the columns below are that sentence, one for each word of it, and there is no column for an
 * amount. `db/MembershipChangeConstraintsTest` holds the set of columns exact, so one arriving
 * later fails a case and has to be argued with the decision.
 *
 * WHY A TABLE OF ITS OWN. A cancellation DELETES the payment and the membership of that season
 * („posle potvrde se brisu zapis o uplati i zapis o clanstvu za tu sezonu, uz trag ko i kada"), so
 * the trail cannot live on either of the rows it is about.
 *
 * TWO ACTIONS, the two the decision names: `cancelled` (the owner's „storno") and `basisChanged`.
 * Recording a payment for a member who had none is not here: the `payment` row it writes already
 * names who recognised it and when (V16).
 *
 * WHICH PAIRS OF BASES A CHANGE MAY JOIN IS NOT DECIDED HERE, and that is V35's own reason: a rule
 * over the pairs would decide ahead of the question for every basis nobody has asked about. The
 * decisions of 18.10.2026 name payment to exemption and exemption to payment; whether anything else
 * is offered is the route's, which is where the owner's sentences are carried out. What the schema
 * says is only what is true of every change: it has a basis before, a cancellation leaves none, and
 * a change leaves a different one.
 *
 * WHO MAY ACT ON HIS OWN ROW: anybody with the right. „Moderator i superadmin smeju da rade na
 * sopstvenom redu, uz trag koji ih imenuje" (18.10.2026), so nothing here compares the account with
 * the member.
 *
 * WRITTEN ONCE, by the shape and for the reasons of `a_balance_entry_is_written_once` (V38): the
 * whole row is compared through `to_jsonb`, so a column added tomorrow is guarded the day it
 * arrives; the one key the schema may forget, `decided_by`, may go to null and never be pointed at
 * somebody else; and DELETE is not refused, because the only deletion that reaches a row is the
 * cascade from a deleted member, which is the privacy promise of PDL P23.
 *
 * THE NAME OUTLIVES THE ACCOUNT, as on every money trail of the portal (V9, V16, V35, V38): the key
 * is ON DELETE SET NULL and the name frozen beside it is NOT NULL.
 */

create table membership_change (
    id              bigserial,

    /* WHOSE membership. The member's own row, and it goes with him (PDL P23), the direction
       `membership_competitor_fk` (V22) and `balance_entry_competitor_fk` (V38) take. */
    competitor_id   bigint      not null,

    /* WHICH SEASON, never before the league's first. */
    season          integer     not null,

    /* WHAT WAS DONE: the owner's „storno", or a change of basis. */
    action          text        not null,

    /* WHAT THE SEASON STOOD ON BEFORE, and AFTER: none after a cancellation. The words are the
       ones `membership_basis_known` (V38) holds. */
    basis_before    text        not null,
    basis_after     text,

    /* WHO, and his name frozen beside the key, for the reason V16 gives about `payment`. */
    decided_by      bigint,
    decided_by_name text        collate sr_latn not null,

    /* WHEN, from the portal's own clock and never from a form. */
    decided_at      timestamptz not null,

    constraint membership_change_pk primary key (id),

    constraint membership_change_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,

    constraint membership_change_decided_by_fk foreign key (decided_by) references account (id)
        on delete set null,

    constraint membership_change_season_not_before_the_league check (season >= 2027),

    constraint membership_change_action_known check (action in ('cancelled', 'basisChanged')),

    constraint membership_change_basis_before_known
        check (basis_before in ('payment', 'feeExempt', 'balance')),

    constraint membership_change_basis_after_known
        check (basis_after is null or basis_after in ('payment', 'feeExempt', 'balance')),

    /* A cancellation leaves the season standing on nothing, and only a cancellation does. */
    constraint membership_change_a_cancellation_leaves_no_basis
        check ((action = 'cancelled') = (basis_after is null)),

    /* And a change changes something: the same basis before and after is not a change. */
    constraint membership_change_a_change_changes_the_basis
        check (basis_after is distinct from basis_before),

    constraint membership_change_decided_by_name_not_blank check (btrim(decided_by_name) <> '')
);

comment on table membership_change is
    'The trail of a cancelled membership and of a change of basis on a member''s row (PDL P8, '
        '18.10.2026): the member, the season, the action, the basis before and after, who and when, '
        'and by the owner''s decision no amount. Written once and never changed.';

comment on column membership_change.decided_by is
    'The account that did it, empty once that account is gone (ON DELETE SET NULL, PDL P23); the '
        'name beside it stays.';

comment on column membership_change.decided_by_name is
    'The name it was done under, which outlives the account.';

create function a_membership_change_is_written_once() returns trigger
    language plpgsql
as $body$
begin
    /* Everything but the one forgettable key, compared as the whole row. */
    if (to_jsonb(new) - 'decided_by') is distinct from (to_jsonb(old) - 'decided_by') then
        raise exception using
            errcode = '23514',
            message = tg_name || ': membership change ' || old.id || ' cannot be changed once written',
            hint = 'PDL P8, 18.10.2026: the trail is a record that does not change.';
    end if;

    /* And that key may only ever be forgotten, never pointed somewhere else. */
    if new.decided_by is not null and new.decided_by is distinct from old.decided_by then
        raise exception using
            errcode = '23514',
            message = tg_name || ': membership change ' || old.id
                || ' cannot be made to name somebody else',
            hint = 'A key on a written line may be forgotten when an account goes, never re-pointed.';
    end if;

    return new;
end;
$body$;

create trigger membership_change_is_written_once
    before update on membership_change
    for each row
execute function a_membership_change_is_written_once();
