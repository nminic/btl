/*
 * The league, which is a general thing and not the RunTrace one. Step eleven.
 *
 * PDL P15 in as many words: "Liga je ENTITET U SISTEMU, ne posebno napravljena funkcionalnost za
 * RunTrace", and "RunTrace liga je samo prva takva Liga. Sistem mora podneti vise Liga
 * istovremeno." So this is a table, and the RunTrace league is a row in it.
 *
 * WHAT A LEAGUE IS. It has an administrator of its own, a season, a page, and a LIST OF EVENTS that
 * enter it during the year - and that list "sme da se menja tokom godine", which is why it is its
 * own table rather than a column anywhere.
 *
 * WHAT A LEAGUE IS NOT, and both of these are columns somebody would expect and will not find:
 *
 *   - no scoring of its own. "Svaka Liga se boduje istim BTL bodovima. Ne postoji poseban sistem
 *     bodovanja po Ligi." A column for it would be a place to put a second answer.
 *   - no choice of how it groups. Until 31.08.2026 a league could be split by category; the owner
 *     removed it in one sentence - "Lige treba da imaju poredak samo po polu. Ne zelim dodatna
 *     pravila" - and `groupsByCategory` was deleted from the model, the form, the public list and
 *     the branch that split the table. One ordering everywhere, so there is nothing to store.
 *
 * AND NOBODY JOINS ONE. "Svi clanovi su u Ligi automatski, bez prijave." There is therefore no
 * membership table here and no application: who is in a league is every member, and what is in it
 * is the events below.
 */
create table league (
    id         bigserial not null,

    /* Looked up by its address, the same rule as an event and a team. */
    slug       text      not null,
    name       text      not null collate sr_latn,
    season     integer   not null,

    /* What it is about and what is won in it, both written by whoever runs it. "Sta se osvaja u
       Ligi zavisi od njenog organizatora. To NIJE pokriveno BTL pravilnikom ni softverom", so the
       portal keeps the words and makes no rule out of them. Always present, may be empty. */
    rules      text      not null,
    prizes     text      not null,

    /* "Svaka Liga ima svog administratora." It empties rather than blocking anything, exactly as a
       team's does: the administrator is a member and may ask to be deleted (PDL P23). */
    admin_id   bigint,

    constraint league_pk primary key (id),
    constraint league_slug_unique unique (slug),
    constraint league_admin_fk foreign key (admin_id) references competitor (id) on delete set null,

    constraint league_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint league_name_not_blank check (btrim(name) <> ''),
    constraint league_season_not_before_the_league check (season >= 2027)
);

create index league_admin_idx on league (admin_id);
create index league_season_idx on league (season);


/*
 * Which events enter which league, and the list may change during the year.
 *
 * THE PAIR IS THE KEY, which is what says an event enters a league once. Adding it twice is not a
 * second fact, and nothing here carries an order: which race counts more is the points, and they
 * are the same BTL points everywhere.
 *
 * WHY IT POINTS AT THE EVENT AND NOT AT THE RACE. A league takes a whole event in - the
 * manifestation, not one distance of it - and a member who ran any race under it has run in the
 * league. That is also how `attending` reads the calendar (V7, O5): the event is what people go to.
 */
create table league_event (
    league_id  bigint not null,
    event_id   bigint not null,

    constraint league_event_pk primary key (league_id, event_id),
    constraint league_event_league_fk foreign key (league_id) references league (id) on delete cascade,
    constraint league_event_event_fk foreign key (event_id) references btl_event (id) on delete cascade
);

create index league_event_event_idx on league_event (event_id);
