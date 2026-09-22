/*
 * Two pointers the queue of V9 has never had, and the reason approving either of these two
 * tabs has quietly done nothing since the day they existed.
 *
 * MEASURED, NOT GUESSED, owner 22.09.2026 (ADL A64): the screen computes `eventId:
 * Number(item.subjectId)` for a comment and `Number('')` is nought, so an approved comment is
 * filed under an event that does not exist; and it moves nothing on a reported change of term
 * because `proposedDate` never arrives, so the branch that calls `moveEvent` is never taken.
 * Both are `verification` pointing at nothing, because V9 built it to point at neither: „What
 * this table is NOT. It does not model what each tab is about."
 *
 * FOUR DECISIONS, ALL THE OWNER'S, ALL 22.09.2026, ADL A64. Each lands where it is used; this
 * file carries the two that are shape.
 *
 *   A1. A waiting comment gets its OWN TABLE, `comment_submission`, the doslovni presedan V10
 *       and V11 already set: a table for the thing before it becomes the thing, and the queue
 *       points at it exactly as it points at `result_submission` and `team_proposal`.
 *
 *       Two other readings were measured and refused. A pointer straight to `event_comment`
 *       was refused because `CommentApi` reads `from event_comment` with no `where` at all - a
 *       comment waiting for a moderator would be PUBLIC the instant it was written, which is
 *       the shape of PDL P28a's „najteži curak projekta" all over again. A pointer to
 *       `btl_event` plus three rating columns on `verification` was refused because those three
 *       columns would serve one tab of six, which is exactly what V9 says this table is not:
 *       „a fourth mark inside rating" reasoning aside, it is a second home for a fact
 *       `comment_submission` already carries whole.
 *
 *   A2. A reported change of term carries the day the reporter SAW, `event_date`, but
 *       UNPINNED: an ordinary `date` column, no composite foreign key to
 *       `(btl_event.id, btl_event.date)`, no `on update cascade`, and `btl_event` gets no new
 *       key. V10's pinned form for `race_date` does not cross here on purpose - there, the two
 *       disagreeing is the fault a submission must never be allowed; here, a report EXISTS
 *       because the day is wrong, and pinning it would erase the very reason it was sent.
 *
 *   A3. The write side of this same increment starts CARRYING OUT both tabs rather than only
 *       serving their fields. That is `VerificationWriteApi`'s to say, not this file's.
 *
 *   A4. `verification_refusal_says_why` gets an exception for `queue = 'comments'`: PDL
 *       (3267, 4255) says a comment is not refused but deleted, and the note beside it - where
 *       there is one - is optional and a trace for moderators, never a reason handed to the
 *       member. The other five rows are untouched; this is the one row whose refusal looks
 *       different, and it is written here so it does not read as an oversight.
 *
 * WHAT ELSE WAS MEASURED WHILE PLANNING, NOT REMEMBERED. A column cannot be named
 * `current_date`: PostgreSQL reserves the word and `create table t (current_date date)` is a
 * syntax error, measured against this schema. `competitor_id` on `schedule_proposal` is
 * nullable although both V10 and V11 make the matching column NOT NULL, because PDL 1582 keeps
 * the button „Prijavi promenu termina" open to somebody with no account at all - the one place
 * this file steps away from either precedent's shape.
 *
 * WHAT NEITHER NEW TABLE DOES: nothing writes a row into either yet. `insert into verification`
 * exists today in exactly two places (`MeWriteApi`, `TeamWriteApi`), and this migration adds no
 * third. Both tables therefore wait for their own increment before a member can reach them, and
 * every row a test puts in them here is written by hand, the same way `result_submission` was
 * before anything wrote to it either.
 */


/*
 * WHAT A MEMBER WROTE ABOUT AN EVENT, BEFORE A MODERATOR HAS SAID YES.
 *
 * The doslovni presedan is V10's own sentence about itself, unchanged by the noun: „a table for
 * the thing before it becomes the thing, in the shape it will take." What `event_comment`
 * carries once a comment is real, this table carries before it is: the event, who sent it in
 * (nullable, the same tombstone axis `event_comment.competitor_id` already carries - V7), the
 * name to show either way, the three marks and the text.
 *
 * `who` IS NOT NULL HERE TOO, on purpose and not by habit: `event_comment.who` is „the name as
 * it was when the comment went out", so a straight copy on approval needs nothing looked up
 * again at that moment, and a submission with a blank name is not a shape this table accepts
 * any more than `event_comment` does.
 */
create table comment_submission (
    id                   bigserial not null,

    event_id             bigint    not null,
    /* Nullable: the same axis `event_comment.competitor_id` carries (V7), moved one table
       earlier. `on delete cascade` and not `set null`, unlike `event_comment`: this row is
       what a comment is BEFORE it exists, so nothing about it survives being decided at all,
       the same as a waiting result does not outlive its member (V10). There is no tombstone
       to protect here yet - that is `event_comment.who`'s day, once this row is copied into
       it. */
    competitor_id        bigint,
    who                  text      not null collate sr_latn,

    /* The same three marks, the same scale, the same names - PDL P6 fixes the list at three
       and V7 already chose the words. Copied rather than referenced so that this table reads
       on its own, exactly as `result_submission` repeats `result`'s four numbers instead of
       pointing at them. */
    rating_organisation  smallint  not null,
    rating_value         smallint  not null,
    rating_ambience      smallint  not null,
    body                 text      not null,

    constraint comment_submission_pk primary key (id),

    /* „A verification row whose subject is gone is a decision about nothing" (V10, word for
       word applied one table over). */
    constraint comment_submission_event_fk foreign key (event_id) references btl_event (id)
        on delete cascade,
    constraint comment_submission_competitor_fk foreign key (competitor_id)
        references competitor (id) on delete cascade,

    constraint comment_submission_who_not_blank check (btrim(who) <> ''),
    constraint comment_submission_organisation_in_scale
        check (rating_organisation between 0 and 5),
    constraint comment_submission_value_in_scale check (rating_value between 0 and 5),
    constraint comment_submission_ambience_in_scale check (rating_ambience between 0 and 5)
);

create index comment_submission_event_idx on comment_submission (event_id);
create index comment_submission_competitor_idx on comment_submission (competitor_id);


/* And the comments tab of the queue points at it, exactly the oblik V10 and V11 both use.
 *
 * `on delete cascade`, because a decision about a submission that is gone is a decision about
 * nothing. UNIQUE, because one submission waits once - without it the same comment could sit in
 * the queue twice and be approved twice, publishing it under two rows of `event_comment`. The
 * check names `comments` literally and that is safe rather than a list, for V10's own reason:
 * `verification.queue` points at `admin_right.code` with ON DELETE RESTRICT and no ON UPDATE,
 * so that code cannot be renamed underneath this while a row uses it. */
alter table verification
    add column comment_submission_id bigint;

alter table verification
    add constraint verification_comment_submission_fk
        foreign key (comment_submission_id) references comment_submission (id) on delete cascade,
    add constraint verification_comment_submission_unique unique (comment_submission_id),
    add constraint verification_only_the_comments_queue_carries_a_submission
        check (comment_submission_id is null or queue = 'comments');

create index verification_comment_submission_idx on verification (comment_submission_id);


/*
 * WHAT A MEMBER, OR NOBODY IN PARTICULAR, ASKED TO MOVE AN EVENT TO.
 *
 * The name follows `team_proposal` rather than `result_submission`: what this row produces is
 * a PROPOSAL over a record that already exists - the event - and not a thing-not-yet-real the
 * way a run or a comment is (PDL 1576: „ono što red proizvodi je predlog datuma, ne stanje").
 *
 * `event_date` IS THE DAY THE REPORTER SAW, CAPTURED AND NEVER RESYNCED (A2). It is not the
 * day the event stands on now - that is `btl_event.date`, read fresh at the moment a moderator
 * approves, in `VerificationWriteApi`, and never from this column. The two are allowed to
 * disagree on purpose: an administrator may move the event again after the report was sent,
 * and the whole point of the report surviving that is to still say what day the reporter was
 * looking at when they wrote it.
 */
create table schedule_proposal (
    id            bigserial not null,

    /* Nullable, and this is the one column where neither V10's nor V11's shape carries over:
       both make the matching column NOT NULL, „only a member can propose a team" and its own
       twin. Here the owner's decision runs the other way - PDL 1582: the button „Prijavi
       promenu termina" stays „otvoreno i za neregistrovane." */
    competitor_id bigint,

    /* NOT NULL, unlike `competitor_id` above: a proposal is always about an event that
       exists, so there is no „new event" case the way `team_proposal.team_id` has one for a
       new team. `on delete cascade`: an edit of an event that is gone is an edit of
       nothing (V11's own sentence about `team_proposal_team_fk`). */
    event_id      bigint    not null,

    /* NOT `current_date`: a reserved word, and `create table … (current_date date)` is a
       syntax error, measured against this schema rather than remembered. */
    event_date    date      not null,
    proposed_date date      not null,

    constraint schedule_proposal_pk primary key (id),

    constraint schedule_proposal_competitor_fk foreign key (competitor_id)
        references competitor (id) on delete cascade,
    constraint schedule_proposal_event_fk foreign key (event_id)
        references btl_event (id) on delete cascade,

    /* A report proposing the day the event is already on is a report about nothing, the same
       sentence `btl_event_not_copied_from_itself` (V7) makes about a copy. */
    constraint schedule_proposal_proposes_another_day
        check (proposed_date <> event_date)
);

create index schedule_proposal_competitor_idx on schedule_proposal (competitor_id);
create index schedule_proposal_event_idx on schedule_proposal (event_id);

/* And the schedule tab points at it, the same oblik once again. */
alter table verification
    add column schedule_proposal_id bigint;

alter table verification
    add constraint verification_schedule_proposal_fk
        foreign key (schedule_proposal_id) references schedule_proposal (id) on delete cascade,
    add constraint verification_schedule_proposal_unique unique (schedule_proposal_id),
    add constraint verification_only_the_schedule_queue_carries_a_proposal
        check (schedule_proposal_id is null or queue = 'schedule');

create index verification_schedule_proposal_idx on verification (schedule_proposal_id);


/*
 * A4: THE ONE ROW WHOSE REFUSAL LOOKS DIFFERENT, AND IT IS WRITTEN HERE SO IT DOES NOT READ AS
 * A MISTAKE.
 *
 * PDL 3267, word for word: „obavezan razlog stoji na svakom odbijanju, jer se sve odbijeno
 * vraća članu. Jedini red bez njega je red komentara, gde se ne odbija nego briše, a napomena
 * je neobavezna i namenjena moderatorima." PDL 4255 says the same the other place it is
 * written. The other five rows keep the biconditional exactly as V9 wrote it: a refusal there
 * still needs a reason and an approval still needs none. Only `queue = 'comments'` steps
 * outside it, in both directions at once, because the note beside a deleted comment is not an
 * answer to the member at all and this table has no way to ask "was this a refusal" of a tab
 * whose refusal is not one.
 *
 * DROPPED AND RECREATED, not altered: PostgreSQL has no `ALTER … ALTER CONSTRAINT` for the body
 * of a CHECK.
 */
alter table verification drop constraint verification_refusal_says_why;

alter table verification
    add constraint verification_refusal_says_why
        check (queue = 'comments'
            or (state = 'rejected') = (reason is not null and btrim(reason) <> ''));
