/*
 * The inbox, and the six switches a member may turn on. Step ten.
 *
 * WHY THE INBOX IS A TABLE AND NOT AN EMAIL LOG. P22 draws a hard line and the schema follows it:
 * six messages are EMAIL and cannot be switched off (account and address, password, a result
 * entered, a result changed, a request for more proof, a major change to the portal), and
 * everything else is the BELL - a comment, an invitation to a team, a request to pair, an offer of
 * a lift, a badge won, a message in the inbox. Those six are sent and forgotten; everything here is
 * kept, because the member comes back to it. A refusal from any queue arrives here with its reason
 * (owner, 15.08.2026), and that reason is what he rewrites his biography or changes his photograph
 * by, so it cannot be a mail he may have deleted.
 *
 * AND WHY READING IS ITS OWN TABLE. A message may be addressed to one member or to the whole
 * league, and the second kind is read by different people at different times. One `read` flag on
 * the message would then be a single answer to a question that has as many answers as there are
 * members - and it is not a hypothetical: the portal already sends to everybody, and a review on
 * 06.09.2026 found a case that could not tell "he was told" from "everybody was told" because both
 * satisfied the same assertion.
 */
create table message (
    id            bigserial   not null,

    /* Who it is for, and EMPTY MEANS EVERYBODY. Not a second table and not a flag: the league is
       the absence of an addressee, which is the same shape `race_id` has in V10 and `team_id` in
       V11 - one column that is there or is not, rather than two that must agree. */
    to_id         bigint,

    /* Who it is from, as a name that stays. A message outlives its sender for the same reason a
       decision outlives the moderator who made it (V9) and a comment outlives its author (V7):
       the member may ask to be deleted (PDL P23) and what he wrote does not go with him. The
       pointer empties, the name does not. The portal itself is a sender too, and it has no row in
       `competitor` at all - that is a message with a name and no pointer. */
    from_id       bigint,
    from_name     text        not null collate sr_latn,

    subject       text        not null collate sr_latn,
    body          text        not null,
    sent_at       timestamptz not null default now(),

    /* And the two things a message can ask a question about, which is what puts two buttons under
       it instead of none. Both may be absent, and a message may not carry both: an inbox row that
       asked two different questions would have one pair of buttons and two answers. */
    team_invitation_id bigint,
    pair_invite_id     bigint,

    constraint message_pk primary key (id),

    constraint message_to_fk foreign key (to_id) references competitor (id) on delete cascade,
    constraint message_from_fk foreign key (from_id) references competitor (id) on delete set null,

    /* The question goes when the thing it asks about goes: an invitation that has been answered or
       withdrawn leaves a message that is no longer a question, and the row would offer a button
       that does nothing. */
    constraint message_team_invitation_fk foreign key (team_invitation_id)
        references team_invitation (id) on delete cascade,
    constraint message_pair_invite_fk foreign key (pair_invite_id)
        references pair_invite (id) on delete cascade,

    constraint message_from_name_not_blank check (btrim(from_name) <> ''),
    constraint message_subject_not_blank check (btrim(subject) <> ''),

    constraint message_asks_at_most_one_question
        check (team_invitation_id is null or pair_invite_id is null),

    /* A question is asked of somebody, never of the whole league. */
    constraint message_a_question_has_an_addressee
        check (to_id is not null or (team_invitation_id is null and pair_invite_id is null))
);

create index message_to_sent_idx on message (to_id, sent_at);
create index message_from_idx on message (from_id);
create index message_team_invitation_idx on message (team_invitation_id);
create index message_pair_invite_idx on message (pair_invite_id);


/*
 * Who has read what, one row per pair and only once it has been read.
 *
 * Unread is the ABSENCE of a row rather than a false in one, which is what makes a message to the
 * whole league work without writing a row per member at the moment it is sent.
 */
create table message_read (
    message_id    bigint      not null,
    competitor_id bigint      not null,
    read_at       timestamptz not null default now(),

    constraint message_read_pk primary key (message_id, competitor_id),
    constraint message_read_message_fk foreign key (message_id) references message (id)
        on delete cascade,
    constraint message_read_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade
);

create index message_read_competitor_idx on message_read (competitor_id);


/*
 * The six switches, and they are six COLUMNS rather than six rows.
 *
 * A36 O16: "Tabela nosi tacno sest sporednih prekidaca." Six rows with a `key` column would need a
 * check naming the six, which is a hand written list with nothing under it; six columns are the
 * list, and a seventh switch is a migration rather than a row somebody typed. What they are is
 * decided in P22 and not here: the bell always rings, the mail is OFF until the member turns it on,
 * and the reason is written down there - "mejl zamor ubija dostavljivost", and a member who marks
 * the league as junk stops receiving the six that matter.
 *
 * The six mandatory mails have no switch and therefore no column. That is the point: a column for
 * them would be a promise the portal must refuse to keep.
 */
create table notification_setting (
    competitor_id  bigint  not null,

    comment_mail   boolean not null default false,
    team_mail      boolean not null default false,
    pair_mail      boolean not null default false,
    lift_mail      boolean not null default false,
    badge_mail     boolean not null default false,
    inbox_mail     boolean not null default false,

    constraint notification_setting_pk primary key (competitor_id),
    constraint notification_setting_competitor_fk foreign key (competitor_id)
        references competitor (id) on delete cascade
);
