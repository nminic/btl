/*
 * The queue everything waits in, step six of the order of work.
 *
 * One table and not six, because it is one screen with six tabs and one right per tab, and because
 * verification is the single action that touches everything else: a result becomes a result here, a
 * photograph becomes a profile here, a team gets its name here. Anything written before this exists
 * would have to be refreshed onto it afterwards.
 *
 * WHICH SIX, AND WHY IT IS NOT A LIST WRITTEN HERE. V5 already carries the rights matrix, and six of
 * its twelve rows are queues: `queue:comments`, `queue:payments`, `queue:profiles`, `queue:results`,
 * `queue:schedule`, `queue:teams`. So this table does not name them. It carries the tab, generates
 * the right's code out of it exactly as `admin_right` generates its own, and points a foreign key at
 * it. A seventh tab must first be a right somebody decided to grant, which is the only way a tab can
 * be moderated at all - and a tab whose right is taken away cannot be left behind, because the key
 * refuses it.
 *
 * WHAT THIS TABLE IS NOT. It does not model what each tab is about. A comment is a row in
 * `event_comment`, a photograph is a row in `photo`, a result will be a row in `result`, and this
 * table points at them rather than copying them. What it holds is the part every tab shares: who it
 * is about, what was proposed, and what a moderator decided.
 */
create table verification (
    id            bigserial   not null,
    queue         text        not null,
    /* The same shape `admin_right.code` is generated with, so the key below compares a value neither
       side typed by hand. */
    right_code    text generated always as ('queue:' || queue) stored,

    raised_at     timestamptz not null default now(),

    /* Who it is about, when it is about somebody who is already a member. A payment waiting to be
       recognised may be about a person who is not one yet - that is what a payment queue is for -
       so this is not NOT NULL, and `subject` carries the name in every case. */
    competitor_id bigint,
    subject       text        not null,
    /* What was written or proposed: the text of a biography, the name a team asks for, the day a
       race is asked to move to. Empty for a tab that proposes nothing, which is why it is NOT NULL
       and may be blank - the same shape `competitor.bio` already has. */
    body          text        not null,

    /* The picture, while there still is one. */
    photo_id      bigint,

    state         text        not null default 'waiting',
    decided_at    timestamptz,
    /* The account that decided, not the member: moderation is done by somebody signed in, and V6
       already knows what that is. It may go: a moderator has the same right to have his account
       deleted as anybody else (PDL P23). */
    decided_by      bigint,
    /* And the name it was decided under, which stays when the account does not.
       PREPISANO IZ V7, gde je isto pitanje vec reseno: `event_comment` drzi `competitor_id` koji
       sme da nestane i `who text not null` koji ostaje, pa komentar prezivi svog autora. A decision
       is the same shape of fact: it was made, it stays made, and it says by whom. */
    decided_by_name text        collate sr_latn,
    reason          text,

    constraint verification_pk primary key (id),

    /* The six, derived. */
    constraint verification_queue_fk foreign key (right_code) references admin_right (code)
        on delete restrict,
    /* The owner decided on 11.09.2026 (ADL A42): a member's rows go with him, as his results do
       (PDL P21). The cost he accepted is written down there rather than discovered later - the
       count of how often he broke the two day rule goes with them, and cannot be taken afterwards.
       The alternative was to keep the row and empty the pointer, and that was refused because a row
       about a deleted member is a record about somebody who asked not to be one. */
    constraint verification_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,
    constraint verification_photo_fk foreign key (photo_id) references photo (id)
        on delete set null,
    /* And now this really is reachable: the account goes, the pointer empties, and the decision
       keeps its name. */
    constraint verification_decided_by_fk foreign key (decided_by) references account (id)
        on delete set null,

    constraint verification_subject_not_blank check (btrim(subject) <> ''),
    constraint verification_state_known check (state in ('waiting', 'approved', 'rejected')),

    /* ADL A36 O11, the owner's decision of 06.09.2026: a refused row STAYS, with its state and its
       reason. Two things follow and both are here rather than in whatever writes them.
       First: a row that has been decided says when and by whom, and a row still waiting says
       neither. Written as a biconditional in both directions, because half of it lets a decision
       exist with nobody's name on it. */
    constraint verification_decided_says_when check ((state = 'waiting') = (decided_at is null)),
    /* Over the NAME and not over the account, and that is the whole of what a round on 11.09.2026
       found. Written over `decided_by`, this constraint and the foreign key above contradicted each
       other: deleting an account made PostgreSQL write NULL into `decided_by` of every row that
       account had decided, and this check refused exactly that - so deleting the account of a
       moderator who had ever decided anything failed outright, which is not what `on delete set
       null` says and not what P23 allows. Measured: the delete came back naming this constraint.
       The name cannot be taken away by deleting anything, so the two no longer disagree. */
    constraint verification_decided_says_who check ((state = 'waiting') = (decided_by_name is null)),
    constraint verification_decided_by_name_not_blank
        check (decided_by_name is null or btrim(decided_by_name) <> ''),

    /* Second: a refusal carries its reason, because the member is told why (PDL 2593) and because a
       refusal with no reason is a decision nobody can answer. An approval carries none: there is
       nothing to explain about a yes, and a reason beside one would be a note nobody reads. */
    constraint verification_refusal_says_why
        check ((state = 'rejected') = (reason is not null and btrim(reason) <> '')),

    /* And the picture goes the moment the row is decided, either way. PDL 900 says the proof of a
       result is deleted after verification, and O11 says the same for a refusal - immediately. One
       rule says both: only a row that is still waiting may hold a photograph. This is what the
       schema can say; that the FILE leaves the disk with it is the deleting code's to do, and it is
       written down here so nobody reads this constraint as the whole of it. */
    constraint verification_decided_keeps_no_photo check (state = 'waiting' or photo_id is null)
);

/*
 * HOW LONG A DECIDED ROW STANDS: for ever, approved and refused alike (owner, 11.09.2026, ADL A42).
 * Nothing here is deleted on a schedule, and the portal has no scheduled work at all.
 *
 * The cost is written down where it will be looked for: the published privacy policy says „Sekcija
 * 5" - five years - for very nearly everything else, and this is an exception that the policy does
 * not yet mention. Either the policy gains a line before 15.09 or a retention is introduced. That
 * is the owner's to settle and it is in A42.
 */

/* The queue is drawn by tab, oldest first, and that is the only way it is ever read. */
create index verification_queue_raised_idx on verification (queue, raised_at);
/* And what is waiting on one member, which is what his own screen asks. */
create index verification_competitor_idx on verification (competitor_id);
create index verification_photo_idx on verification (photo_id);
create index verification_decided_by_idx on verification (decided_by);
