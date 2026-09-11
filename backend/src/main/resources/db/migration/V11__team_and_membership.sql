/*
 * The team, who is in it, and what somebody proposed it should be. Step eight of the order of work.
 *
 * A TEAM IS NOT A CLUB, and the schema says so by carrying only one of them. PDL P13: a club is
 * where somebody runs in real life and it is one optional line on his profile with no standing, no
 * page and no rights. A team is a group of any name that runs together, and it is the only thing
 * besides a member that has a standing. So `competitor.club` is a column somewhere else's problem
 * and this file never mentions it again.
 *
 * THREE TABLES, AND WHY THE THIRD IS NOT THE FIRST. A team is proposed by a member and moderated
 * (P13, 11.08.2026: "Upis tima prolazi kroz moderaciju. Unosi ga bilo koji clan koji to zeli"), and
 * the moderator has three outcomes rather than two: approve, edit and approve, reject. That is the
 * same shape V10 met for a result, so it gets the same answer: what is waiting is its own table and
 * the queue points at it. A rejected proposal stays a proposal and never becomes a team.
 *
 * AND THE SAME TABLE CARRIES AN EDIT OF A TEAM THAT ALREADY EXISTS (owner, 04.09.2026: "Izmena tima
 * ide u isti red za verifikaciju kao i predlog novog tima, uz oznaku sta je sta"). The mark is not a
 * word in a column; it is `team_id`: empty means a new team, filled means this team should become
 * what the row says. Exactly the shape `result_submission` uses for `race_id`, and for the same
 * reason - one column that is present or absent says it without anything having to agree with it.
 */
create extension btree_gist;


/*
 * WHY AN EXTENSION, AND WHY THIS ONE. V1 said no extension is created there and that it was a
 * decision rather than an omission: one is made when the schema first needs it. This is that moment.
 *
 * "Clan sme da bude samo u jednom timu istovremeno" (P13) is a sentence about ranges, not about
 * rows. A unique key over the member says he was never in two teams at all; a partial unique key
 * over the rows that have not ended says only that he has at most one team TODAY, and leaves two
 * overlapping finished memberships perfectly writable. Neither is the sentence. An exclusion
 * constraint is, and `btree_gist` is what lets equality on a plain integer sit in the same index as
 * an overlapping range.
 */


create table team (
    id          bigserial not null,

    /* Looked up by its address, the same as an event (O7: "Adresa je jedinstvena, pravi se po istom
       pravilu kao za tim"). That sentence names the team as the thing the rule was taken FROM, so
       the shape here is `btl_event_slug_shape` word for word. */
    slug        text      not null,
    name        text      not null collate sr_latn,

    /* What the member who proposed it wrote: "naziv tima, opis (ogranicen unos) i neobavezni link".
       Both are always present and may be empty, as `btl_event.description` and `btl_event.link`
       are, and the link has the same shape when it is not. */
    bio         text      not null,
    link        text      not null,

    /* Where the team is, in the three columns O5 gives every town in this schema. */
    place_id    bigint,
    city        text      collate sr_latn,
    country_id  bigint,

    /* The mark drawn in a circle before the name in the table of teams (P13, 12.08.2026), which is
       a row in `photo` because it is cropped exactly as a profile picture is and `photo` already
       carries the crop. It may be absent: a team with no mark is drawn without one. */
    logo_id     bigint,

    /* The season from which the team collects points. Owner, 05.09.2026: "Obracun bodova tima
       pocinje 1. januara naredne sezone" - a team founded during a season does not compete in it,
       whether it stayed at one member or gathered more. It is a column and not a derivation because
       the derivation would be over the founder's membership, and a team may outlive its founder. */
    first_season integer  not null,

    /* Who administers it. The founder to begin with (owner, 04.09.2026), and a moderator may hand it
       to somebody else. It EMPTIES rather than blocking anything: when the seat is vacant the
       portal reads the member who has been in the team longest, and that is a query, not a column.
       So this says who was NAMED, and nothing here pretends it is always somebody. */
    admin_id    bigint,

    constraint team_pk primary key (id),
    constraint team_slug_unique unique (slug),

    constraint team_place_fk foreign key (place_id) references place (id) on delete restrict,
    constraint team_country_fk foreign key (country_id) references country (id) on delete restrict,
    constraint team_logo_fk foreign key (logo_id) references photo (id) on delete set null,

    /* The named administrator may have his account deleted like anybody else (PDL P23); the team
       does not go with him, it simply stops naming one. */
    constraint team_admin_fk foreign key (admin_id) references competitor (id) on delete set null,

    constraint team_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint team_name_not_blank check (btrim(name) <> ''),
    constraint team_link_shape check (link = '' or link ~ '^https?://[^[:space:]]+$'),

    constraint team_town_is_from_the_codebook_or_typed check ((place_id is null) <> (city is null)),
    constraint team_typed_town_names_its_country check ((city is null) = (country_id is null)),
    constraint team_city_not_blank check (city is null or btrim(city) <> ''),

    /* The league starts in 2027 and nothing is before it. `competitor.first_season` says the same
       thing about a member with the same number, and this is the same fact about a team. */
    constraint team_first_season_not_before_the_league check (first_season >= 2027)
);

create index team_place_idx on team (place_id);
create index team_country_idx on team (country_id);
create index team_logo_idx on team (logo_id);
create index team_admin_idx on team (admin_id);


/*
 * O3 word for word: "Tabela clanstva u timu sa redovima (clan, tim, sezona od, sezona do, razlog
 * izlaska)."
 *
 * SEASONS AND NOT DATES, because every rule written about this is written in seasons: membership
 * takes effect on 1 January, a team collects from the season it was founded plus one, and leaving
 * mid-year means the membership ends with that season. A date would have to be turned back into a
 * season by every reader of this table.
 */
create table team_membership (
    id            bigserial not null,
    competitor_id bigint    not null,
    team_id       bigint    not null,

    /* The last season he is in it, or empty while he still is. */
    season_from   integer   not null,
    season_to     integer,
    left_reason   text,

    constraint team_membership_pk primary key (id),

    constraint team_membership_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,
    /* A team that is deleted takes its membership rows with it. What survives a deleted team is the
       frozen season (A37), which is its own tables of hardcoded values, so nothing here is the
       history that P13 protects: "Brisanje tima ne dira istoriju." */
    constraint team_membership_team_fk foreign key (team_id) references team (id) on delete cascade,

    constraint team_membership_season_from_not_before_the_league check (season_from >= 2027),
    constraint team_membership_did_not_leave_before_joining
        check (season_to is null or season_to >= season_from),

    /* Leaving is a season and a reason together. One without the other is a row that says he left
       and will not say when, or that he is still in and left for a reason. */
    constraint team_membership_leaving_says_why check ((season_to is null) = (left_reason is null)),
    constraint team_membership_left_reason_not_blank
        check (left_reason is null or btrim(left_reason) <> ''),

    /* AND THE SENTENCE ITSELF: one team at a time, for every season and not only for today.
       `season_to` is the last season he is in, so the half open range ends one past it; an open
       membership runs to the largest integer there is, which is a season nobody will ever write. */
    constraint team_membership_one_team_at_a_time exclude using gist (
        competitor_id with =,
        int4range(season_from, coalesce(season_to + 1, 2147483647)) with &&
    )
);

create index team_membership_competitor_idx on team_membership (competitor_id);
create index team_membership_team_idx on team_membership (team_id);


/*
 * What a member sent to moderation, which is a team that does not exist yet or a team that should
 * change. It carries the same four things the form asks for and nothing else: a name, a description,
 * a link and a town, plus the mark if one was attached.
 *
 * IT IS NOT A COPY OF `team`. It has no `slug`, because the address is made when the team is made
 * and a proposal has no address; no `first_season`, because which season a team starts in is
 * decided by when it is APPROVED and not by when it was asked for; and no `admin_id`, because
 * approving it is what puts the member in it.
 */
create table team_proposal (
    id            bigserial not null,

    /* Who asked. Not nullable: only a member can propose a team. */
    competitor_id bigint    not null,

    /* Empty means a new team; filled means this team should become what this row says. */
    team_id       bigint,

    name          text      not null collate sr_latn,
    bio           text      not null,
    link          text      not null,
    place_id      bigint,
    city          text      collate sr_latn,
    country_id    bigint,
    logo_id       bigint,

    constraint team_proposal_pk primary key (id),

    constraint team_proposal_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,
    /* An edit of a team that is gone is an edit of nothing. */
    constraint team_proposal_team_fk foreign key (team_id) references team (id) on delete cascade,
    constraint team_proposal_place_fk foreign key (place_id) references place (id) on delete restrict,
    constraint team_proposal_country_fk foreign key (country_id) references country (id)
        on delete restrict,
    constraint team_proposal_logo_fk foreign key (logo_id) references photo (id) on delete set null,

    constraint team_proposal_name_not_blank check (btrim(name) <> ''),
    constraint team_proposal_link_shape check (link = '' or link ~ '^https?://[^[:space:]]+$'),

    /* The same three the team itself carries, so an approval can copy them across without deciding
       anything on the way. */
    constraint team_proposal_town_is_from_the_codebook_or_typed
        check ((place_id is null) <> (city is null)),
    constraint team_proposal_typed_town_names_its_country
        check ((city is null) = (country_id is null)),
    constraint team_proposal_city_not_blank check (city is null or btrim(city) <> '')
);

create index team_proposal_competitor_idx on team_proposal (competitor_id);
create index team_proposal_team_idx on team_proposal (team_id);
create index team_proposal_place_idx on team_proposal (place_id);
create index team_proposal_country_idx on team_proposal (country_id);
create index team_proposal_logo_idx on team_proposal (logo_id);


/* And the teams tab of the queue points at it, exactly as the results tab points at a run (V10).
 *
 * One proposal waits once, and it may only hang off the tab that judges teams. The check names
 * `teams` literally and that is safe rather than a list, for the reason V10 wrote out: the queue
 * points at `admin_right.code` with ON DELETE RESTRICT and no ON UPDATE, so that code cannot be
 * renamed underneath this while a row uses it. One-directional, because a teams row without a
 * proposal is a real thing - a moderator raising something about a team that already exists. */
alter table verification
    add column team_proposal_id bigint;

alter table verification
    add constraint verification_team_proposal_fk
        foreign key (team_proposal_id) references team_proposal (id) on delete cascade,
    add constraint verification_team_proposal_unique unique (team_proposal_id),
    add constraint verification_only_the_teams_queue_carries_a_proposal
        check (team_proposal_id is null or queue = 'teams');

/* AND A QUEUE ROW IS ABOUT ONE THING, which is worth saying and is NOT a constraint here, because
   the two checks above already say it. A row carrying a run must be on the `results` tab and a row
   carrying a proposal on the `teams` tab, and a row has one tab. A third check counting the
   pointers would therefore be unreachable: every row that broke it would break one of those two
   first, and PostgreSQL would report that one - so the case written for it would be measuring a
   different constraint while naming this one. Measured while writing that case, before review. */
