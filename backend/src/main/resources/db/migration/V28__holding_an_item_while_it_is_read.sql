/*
 * THE HOLD A MODERATOR TAKES ON ONE ITEM WHILE HE READS IT.
 *
 * The owner, 18.09.2026 (PDL P9, „Red za proveru je JEDAN i zajednicki"): „Ukoliko moderator udje da
 * analizira nesto, odluka se zakljucava drugima tako da ne mogu da joj pristupe ili da rade nista sa
 * njom." And the three answers he gave the same day when the cost of each was put to him:
 *
 *   - „Zakljucavanje ISTICE posle vremena mirovanja, i tada stavku uzima ko hoce." He refused „samo
 *     izricito otpustanje ili odjava", with the cost said out loud: a browser that crashes or a
 *     laptop that shuts would hold an item for ever and nobody could free it except through the
 *     database.
 *   - „Mirovanje traje 15 minuta", chosen against a stated cost on both sides: a short spell takes
 *     the item from a moderator who is still reading, a long one hides it when his browser falls
 *     over. The NUMBER is not here; it is `HoldingAnItem.QUIET`, which is the one place that says
 *     how long, and this table stores the moment the spell ends rather than the moment it began, so
 *     nothing reading a row has to know the length in order to know whether it is still running.
 *   - „Superadmin SME da otme tudje zakljucavanje, i onaj kome je oteto to sazna."
 *
 * A HOLD IS THE PRESENCE OF A ROW, not a pair of columns on `verification` that could disagree.
 * This is the shape V13 chose for the same reason - „Unread is the ABSENCE of a row rather than a
 * false in one" - and here it buys three things a pair of nullable columns would each have needed a
 * constraint for. A hold always has a holder and always has an end, because both are NOT NULL in a
 * row that is either there or is not. An account that goes takes its holds with it, by the key
 * rather than by anything remembering to. And `verification` gains no column at all, so the
 * twenty-three places in `src/test` that write a queue row by naming its columns are untouched.
 *
 * WHAT THIS TABLE DOES NOT SAY, named rather than left to be found.
 *
 *   - It does not refuse a hold on a row that has already been DECIDED. A check cannot read another
 *     table, and the alternative - a trigger - would be a second home for a rule the deciding route
 *     already enforces before it writes. What that route does is delete the hold in the same
 *     transaction as the decision, so a decided row carries none.
 *   - It does not say the holder may moderate that queue. `verification.right_code` says which
 *     privilege opens the row and `account_admin_right` says who holds it; joining the two in a
 *     constraint would be „may he" answered in a second place, which ADL A8 („Odgovara jedno
 *     mesto") refuses. `WhatHeMayDo` answers it, once, before this row is written.
 */
create table verification_lock (
    /* The item, and it is the KEY: one hold at a time or the whole thing means nothing. A surrogate
       key beside a unique constraint would say the same and let a second row be written first. */
    verification_id bigint      not null,

    /* THE ACCOUNT AND NOT THE MEMBER, which is the same choice V9 made one column over for
       `decided_by`: moderating is done by somebody signed in, and V23 says an account naming no
       member is the ordinary case for a moderator who does not race. Read as a member, a hold could
       not be taken by half the people entitled to take one. */
    held_by         bigint      not null,

    /* WHEN THE SPELL ENDS, and never when it began. Both are one fact and this is the half every
       reader actually asks for: „is it still held" is `held_until > now()` and needs nothing else.
       Stored the other way round, every reader would have to add the fifteen minutes itself, which
       is the length of the spell living in as many places as there are readers - and a spell whose
       length the owner changes would silently re-open holds taken under the old one. */
    held_until      timestamptz not null,

    constraint verification_lock_pk primary key (verification_id),

    /* The hold goes with the item. A queue row deleted with its member (V9's
       `verification_competitor_fk`, ADL A42) must not leave a hold pointing at nothing. */
    constraint verification_lock_verification_fk foreign key (verification_id)
        references verification (id) on delete cascade,

    /* AND IT GOES WITH THE ACCOUNT, which is the one place this differs from `verification` itself
       and differs on purpose. V9 keeps a DECISION when its moderator's account is deleted, and
       keeps the name it was made under, because „a decision is the same shape of fact: it was made,
       it stays made, and it says by whom". A hold is the opposite kind of fact: it is somebody
       READING something right now, it is worth nothing once he is gone, and an item nobody can free
       is the exact failure the owner refused when he chose expiry over explicit release. So this
       cascades, and no name is kept beside it - there is nothing here that outlives its holder. */
    constraint verification_lock_account_fk foreign key (held_by)
        references account (id) on delete cascade
);

/* WHOSE HOLDS THESE ARE, which is the side the superadmin's taking one away is asked from and the
   side the cascade above has to find when an account goes. A foreign key builds no index on the
   referencing side, and the key of this table is the item, so this one is not already there. */
create index verification_lock_held_by_idx on verification_lock (held_by);
