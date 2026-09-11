/*
 * Authentication, which A36 O9 always said would be a migration of its own: "Nalozi i uloge idu u
 * prvu migraciju, AUTENTIKACIJA U DRUGU."
 *
 * So V6 built the account - who it is, what it may do, and whether its address has been confirmed -
 * and left out everything about PROVING it is him. This is that.
 *
 * FOUR NUMBERS, AND THE OWNER CHOSE ALL FOUR ON 11.09.2026. They are written into this file as
 * defaults rather than kept in the service, for the reason V6 already set: a column that says
 * `now() + interval '24 hours'` tells the next reader how long a token lives without him having to
 * find the class that writes it.
 *
 *   - a password is at least twelve characters, checked before it gets here (B1);
 *   - a session lasts THIRTY DAYS and renews on use;
 *   - a password reset token lasts ONE HOUR;
 *   - ten failed sign ins lock an account for FIFTEEN MINUTES.
 *
 * WHAT IS NEVER HERE. Not the password, and not a session token either: both are kept as what they
 * hash to, which is why the two shapes below are hex and fixed width. A stolen copy of this database
 * lets nobody sign in as anybody.
 */


/*
 * The password, and what a run of wrong guesses does.
 *
 * `password_hash` IS NULLABLE, AND THAT IS A STATE RATHER THAN A CONCESSION. An account with no
 * password is one nobody can sign into with one, and the portal has a real reason to make them: the
 * owner opens accounts for honorary members himself (P8, "pocasno clanstvo"), and for the profiles
 * of earlier years he fills in during the fortnight before launch. Those people never registered,
 * so nobody ever typed a password for them; they set one through the reset link, which is exactly
 * what the table below is for.
 *
 * The alternative was NOT NULL, which would have refused to run against a database with accounts in
 * it at all - and would have had this migration invent a password for anybody already there. There
 * is nobody there today (measured on QA before writing this: `account` holds nought rows), but a
 * column whose rule only works on an empty table is a rule that expires.
 *
 * WHAT THE SERVICE MUST DO WITH IT, because the schema cannot: an empty password is never compared.
 * `StoredPassword.matches` takes what the database holds, and a null is not "no match" to it, it is
 * a fall over. The sign-in path asks whether there is one before it asks whether it fits.
 *
 * The shape is `{algorithm}rest`, which is what Spring's delegating encoder writes (B2). It is
 * checked rather than trusted because the whole point of that encoder is that the algorithm can be
 * replaced later, and a row that lost its prefix would be unreadable by every algorithm at once.
 */
alter table account
    add column password_hash    text,
    add column failed_sign_ins  smallint    not null default 0,
    add column locked_until     timestamptz;

alter table account
    add constraint account_password_hash_shape
        check (password_hash is null or password_hash ~ '^\{[a-z0-9]+\}.+'),
    add constraint account_failed_sign_ins_not_negative check (failed_sign_ins >= 0),

    /* AND THE LOCK IS ONLY EVER SET WITH A REASON BEHIND IT. Ten is the owner's number; a lock
       written with fewer failures behind it is somebody locking an account by hand, which is not
       what this column is for and is not a thing the portal has. */
    add constraint account_locked_only_after_enough_failures
        check (locked_until is null or failed_sign_ins >= 10);


/*
 * A session, which is a row rather than a signed token.
 *
 * WHY A ROW. `btl/CLAUDE.md`: "Tokeni: httpOnly kolacici, nikad localStorage." A cookie carrying a
 * self contained token cannot be taken back - it is valid until it expires, whatever happens in
 * between - and this portal has to be able to end a session: a member changes his password, an
 * account is deleted on request (PDL P23), somebody signs out on a borrowed computer. A row can be
 * deleted; a signature cannot.
 *
 * THIRTY DAYS, AND IT RENEWS. The owner chose the renewing form over a fixed one: somebody who uses
 * the portal every week is never signed out, and somebody who does not is signed out a month after
 * he stopped. `expires_at` moves forward on use, and `last_used_at` is what says when that was.
 */
create table account_session (
    id           bigserial   not null,
    account_id   bigint      not null,

    /* What the cookie carries, hashed. The same shape and the same reason as V6's token. */
    token_hash   text        not null,

    created_at   timestamptz not null default now(),
    last_used_at timestamptz not null default now(),
    expires_at   timestamptz not null default now() + interval '30 days',

    constraint account_session_pk primary key (id),
    constraint account_session_account_fk foreign key (account_id) references account (id)
        on delete cascade,
    constraint account_session_token_hash_unique unique (token_hash),

    constraint account_session_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
    constraint account_session_used_after_it_began check (last_used_at >= created_at),
    constraint account_session_ends_after_it_began check (expires_at > created_at)
);

create index account_session_account_idx on account_session (account_id);
create index account_session_expires_idx on account_session (expires_at);


/*
 * And the one hour a reset link lives.
 *
 * The same shape as every other token here, and one extra column: `used_at`. A reset link is used
 * ONCE, and the row stays afterwards rather than being deleted, because "this link has already been
 * used" and "this link never existed" are different things to say to somebody - and the second one,
 * said to a person who clicked twice, reads as an attack he has to worry about.
 */
create table password_reset_token (
    id         bigserial   not null,
    account_id bigint      not null,
    token_hash text        not null,

    created_at timestamptz not null default now(),
    expires_at timestamptz not null default now() + interval '1 hour',
    used_at    timestamptz,

    constraint password_reset_token_pk primary key (id),
    constraint password_reset_token_account_fk foreign key (account_id) references account (id)
        on delete cascade,
    constraint password_reset_token_hash_unique unique (token_hash),

    constraint password_reset_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
    constraint password_reset_token_ends_after_it_began check (expires_at > created_at),
    constraint password_reset_token_used_after_it_began check (used_at is null or used_at >= created_at)
);

create index password_reset_token_account_idx on password_reset_token (account_id);

/*
 * AND WHICH RIGHTS A MODERATOR HAS ACTUALLY BEEN GIVEN, which nothing in this schema held.
 *
 * V5 wrote `role.rights_mode` and gave the moderator the value `granted`, which the migration
 * itself explains as "Holds what has been ticked for him, one box at a time". Nothing anywhere
 * held the ticks. So the model could answer "may he" for a superadmin (everything) and for a
 * member (nothing), and for the one role the whole matrix exists for it had to be handed a set
 * that came from nowhere.
 *
 * Found on 11.09.2026 while writing `AdminRights`, and it belongs here rather than in V5's
 * neighbourhood because it is the same question authentication asks: who is this, and what may he
 * do.
 *
 * THE PAIR IS THE KEY, so a right is granted once. Ticking a box that is already ticked is not a
 * second fact, and there is no order in which somebody was given things.
 */
create table account_admin_right (
    account_id bigint      not null,
    right_code text        not null,
    granted_at timestamptz not null default now(),

    constraint account_admin_right_pk primary key (account_id, right_code),
    constraint account_admin_right_account_fk foreign key (account_id) references account (id)
        on delete cascade,
    /* A right cannot be taken out of the matrix while somebody has been given it. The same
       RESTRICT `verification_queue_fk` uses on the same table, and for the same reason: a tick
       pointing at a right that no longer exists is a permission nobody can reason about. */
    constraint account_admin_right_right_fk foreign key (right_code) references admin_right (code)
        on delete restrict
);

create index account_admin_right_right_idx on account_admin_right (right_code);
