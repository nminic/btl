/*
 * How somebody gets into a team, and how two people become a racing pair. Step nine.
 *
 * V11 built the team and the row that says who is in it. What it did not build is the ASKING, and
 * the asking goes both ways: "Ucanjenje ide u oba smera kroz portal: takmicar salje administratoru
 * tima zahtev na odobrenje, ili administrator salje takmicaru poziv" (PDL P13). Two tables and not
 * one, because they are not the same fact: an application is a member offering himself and is
 * answered by the team, an invitation is a team offering itself and is answered by the member. One
 * table with a direction column would need every reader to remember which way to look.
 *
 * AND THE RACING PAIR, WHICH IS NOT A TEAM OF TWO. PDL: it is formed by both sides confirming, it
 * must be mixed - one man and one woman - and it belongs to a season. It has its own awards.
 *
 * THE MIXED PAIR IS ENFORCED HERE AND NOT LEFT TO THE SERVICE, and that is the one thing in this
 * file worth reading twice. A CHECK cannot read another table, so "one man and one woman" looks
 * like a rule the schema cannot hold. It can, by the trick V7 already uses to tie a result to the
 * day of its race: the two columns below carry a CONSTANT gender, generated rather than written,
 * and the foreign key points at `competitor (id, gender)`. So `man_id` can only be a member whose
 * gender is 'M', because there is no row in `competitor` with that id and that gender otherwise.
 * The database refuses the pair, and nobody has to remember to check.
 */
alter table competitor
    add constraint competitor_id_gender_unique unique (id, gender);


/*
 * A member asking a team to take him, and a team asking a member to come.
 *
 * WHAT NEITHER OF THEM CARRIES IS A STATE. An answer is not a column here: accepting an application
 * writes a row in `team_membership` and removes this one, refusing removes it, and the message that
 * says so is the inbox's (V13). A state column would be a second answer to "is he in the team", and
 * `team_membership` already answers it.
 *
 * WHAT THEY DO CARRY IS A SEASON, and it is not decorative. Membership takes effect on 1 January
 * (P13), and a team founded during a season collects from the next one, so which season is being
 * asked about is decided when the asking starts and must not drift while it waits.
 */
create table team_application (
    id            bigserial   not null,
    competitor_id bigint      not null,
    team_id       bigint      not null,
    season        integer     not null,
    asked_at      timestamptz not null default now(),

    constraint team_application_pk primary key (id),
    constraint team_application_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,
    constraint team_application_team_fk foreign key (team_id) references team (id) on delete cascade,

    /* One member asks one team once for one season. Asking twice is the same question. */
    constraint team_application_asked_once unique (competitor_id, team_id, season),
    constraint team_application_season_not_before_the_league check (season >= 2027)
);

create index team_application_competitor_idx on team_application (competitor_id);
create index team_application_team_idx on team_application (team_id);


create table team_invitation (
    id            bigserial   not null,
    team_id       bigint      not null,
    competitor_id bigint      not null,
    season        integer     not null,
    sent_at       timestamptz not null default now(),

    constraint team_invitation_pk primary key (id),
    constraint team_invitation_team_fk foreign key (team_id) references team (id) on delete cascade,
    constraint team_invitation_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,

    constraint team_invitation_sent_once unique (team_id, competitor_id, season),
    constraint team_invitation_season_not_before_the_league check (season >= 2027)
);

create index team_invitation_team_idx on team_invitation (team_id);
create index team_invitation_competitor_idx on team_invitation (competitor_id);


/*
 * The racing pair, which exists for one season and is mixed.
 *
 * THE SEASON IS DECIDED ON THE DAY OF THE ANSWER, not on the day of the question, and that is a
 * decision of 07.09.2026 taken on a review finding: PDL says forming "mora biti zavrseno do 31.
 * decembra", and forming finishes when the second person confirms. An invitation sent on 31.12.2026
 * and accepted on 02.01.2027 makes a pair for 2028, because 2027 is already being run. That is why
 * `pair_invite` below carries no season at all, and this table does.
 */
create table racing_pair (
    id           bigserial   not null,
    season       integer     not null,

    man_id       bigint      not null,
    woman_id     bigint      not null,

    /* Constants, generated rather than written, and the whole of what makes the key below say
       "mixed". Nothing writes into them and nothing can disagree with them. */
    man_gender   text generated always as ('M') stored,
    woman_gender text generated always as ('F') stored,

    made_at      timestamptz not null default now(),

    constraint racing_pair_pk primary key (id),

    /* And here is the sentence: a member whose gender is not 'M' has no row in `competitor` with
       this id and this gender, so the key refuses him.

       NO ON UPDATE ACTION, and that is the database's rule rather than a choice: a foreign key
       containing a generated column may not cascade an update, because cascading would mean writing
       into a column that is generated. What is left is the default, which REFUSES. So a member who
       is in a pair cannot have his gender changed until the pair is gone, and that is the right
       answer anyway: a pair that is no longer mixed is not a pair, and somebody has to decide which
       of the two it stops being. ON DELETE CASCADE is allowed, because deleting a row writes into
       no column at all. */
    constraint racing_pair_man_fk foreign key (man_id, man_gender) references competitor (id, gender)
        on delete cascade,
    constraint racing_pair_woman_fk foreign key (woman_id, woman_gender)
        references competitor (id, gender) on delete cascade,

    /* One pair per person per season, from either side. */
    constraint racing_pair_one_man_a_season unique (season, man_id),
    constraint racing_pair_one_woman_a_season unique (season, woman_id),

    constraint racing_pair_season_not_before_the_league check (season >= 2027)
);

create index racing_pair_man_idx on racing_pair (man_id);
create index racing_pair_woman_idx on racing_pair (woman_id);


/*
 * The asking, which carries no season at all (07.09.2026, on a review finding: read off the day of
 * the question, the portal made a pair for a season already being run, with a green gate).
 *
 * IT ALSO CARRIES NO GENDER KEY, and that is deliberate rather than forgotten. The button that
 * sends it is only drawn to somebody of the other gender, but the RULE is about the pair and not
 * about the question: a question that turns out to be impossible is answered "no", it is not a row
 * the database refuses to store. The pair is where mixedness is held, one table up.
 */
create table pair_invite (
    id      bigserial   not null,
    from_id bigint      not null,
    to_id   bigint      not null,
    sent_at timestamptz not null default now(),

    constraint pair_invite_pk primary key (id),
    constraint pair_invite_from_fk foreign key (from_id) references competitor (id) on delete cascade,
    constraint pair_invite_to_fk foreign key (to_id) references competitor (id) on delete cascade,

    /* Nobody invites himself. */
    constraint pair_invite_two_people check (from_id <> to_id),
    /* And one open question between two people, in that direction. The other direction is a
       different row on purpose: the screen hides the button when a question stands either way, but
       that is the screen deciding, and two people may both have asked before either answered. */
    constraint pair_invite_asked_once unique (from_id, to_id)
);

create index pair_invite_from_idx on pair_invite (from_id);
create index pair_invite_to_idx on pair_invite (to_id);
