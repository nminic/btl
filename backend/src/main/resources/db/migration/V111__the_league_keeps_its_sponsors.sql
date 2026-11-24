/*
 * THE LEAGUE KEEPS ITS SPONSORS: A ROW PER SPONSOR, ITS LOGO AS A PICTURE, AND A RIGHT TO EDIT THEM.
 *
 * Owner, PDL 24.11.2026, „Strana za upravljanje sponzorima u Administraciji → Podaci → Sponzori”:
 * „Zelim da mogu da u sekciji Administracija > Podaci odem na Sponzori, i da tu dodajem, menjam ili brisem
 * sponzore.” With the answers of the same day, each of which is a column or a constraint here:
 *   - „Glavni sponzor je najviše jedan.” and „imam pravo na nivou sponzora da oznacavam da li je glavni,
 *     default No, i da ne oznacim nikom”: `main`, false by default, and a partial unique index that lets
 *     no row or one row hold it, never two;
 *   - „Dva prekidača po sponzoru: jedan za rotaciju u boksu „Sponzor dana”, drugi za traku na dnu.”:
 *     `in_rotation` and `in_strip`, each on its own;
 *   - „Opis ima srpsku i englesku verziju; ako engleska nije upisana, engleska naslovna pokazuje srpsku.
 *     … Ograničenje od 80 znakova … važe za obe.”: `description_sr`, required, and `description_en`,
 *     NULL where none is written, both at most 80 characters;
 *   - „Redosled u traci: glavni sponzor prvi, pa ručni redosled koji se podešava u administraciji.”:
 *     `position`, one per row, unique, and DEFERRABLE so that two rows can trade places in one transaction;
 *   - „Sponzore uređuje i moderator sa pravom (novo pravo „Sponzori”, kao ostala prava)”: the row
 *     ('entity', 'sponsors') in `admin_right`, which V5's generated column spells `entity:sponsors`.
 *
 * What is NOT here, named rather than left out silently:
 *   - the refusal of a description written in capitals only („zabrana pisanja svim velikim slovima”,
 *     18.11.2026). It lives in `SponsorWriteApi` and nowhere else, because `upper()` and `lower()` follow
 *     the database's collation, and a check that refused „ČEVAPI” on one server and let it through on
 *     another would be a second home of the rule that disagrees with the first;
 *   - the shape of the link beyond „http:// or https:// and no white space”, which is the route's
 *     refusal too; the check below is the floor under it, not a second sentence of it.
 *
 * THE LOGO IS A POINTER INTO `photo`, EXACTLY AS A LEAGUE'S MARK IS (V108), with its guards: NULLABLE,
 * because a sponsor is entered first and its logo sent after (the picture is multipart and the row is
 * not), `on delete set null`, and an index, because the trigger below and `PhotoApi` ask „who holds this
 * picture” by it. The crop columns of the photo row are written whole (0.5, 0.5, 1): a sponsor's logo is
 * never cut into a circle („Logo se ne seče u krug; čuva se ceo”), and nothing reads those three for it.
 *
 * THE SIXTH HOLDER IS TAUGHT TO V54'S RULE IN THE SAME FILE (ADL A68, owner 03.10.2026: „Sliku koju niko
 * ne drži briše sama baza, na kraju radnje ... i to važi i za svaku buduću radnju nad tim kolonama”), so
 * „brisanje sponzora briše i njegov logo” (the plan approved 24.11.2026) is the database's own rule: the
 * `photo` row goes at the end of the transaction that deleted the sponsor or replaced its logo, and the
 * FILE goes with the sweep (`ThePicturesFolderIsSwept`), as every other picture's does. Both functions
 * are replaced whole, with the names, arguments and return types V108 left them with.
 *
 * CLAUDE.md, section 11 (a constraint over rows that already stand) has nothing to measure here: the
 * table is new, so no row stood before this file runs and no `check`, `not null` or `unique` below can
 * meet one. The two functions replaced change no existing row either; they decide only what happens on
 * the next update or delete.
 */
create table sponsor (
    id             bigserial not null,
    name           text      not null,
    url            text      not null,
    logo_id        bigint,
    description_sr text      not null,
    description_en text,
    main           boolean   not null default false,
    in_rotation    boolean   not null default false,
    in_strip       boolean   not null default false,
    position       integer   not null,

    constraint sponsor_pk primary key (id),
    constraint sponsor_logo_fk foreign key (logo_id) references photo (id) on delete set null,

    constraint sponsor_name_shape check (btrim(name) <> '' and char_length(name) <= 80),
    constraint sponsor_url_shape check (url ~ '^https?://[^[:space:]]+$' and char_length(url) <= 2000),
    constraint sponsor_description_sr_shape
        check (btrim(description_sr) <> '' and char_length(description_sr) <= 80),
    /* NULL where no English is written, and never an empty string standing for it: two spellings of
       „none” would be two answers to „is there an English one”. */
    constraint sponsor_description_en_shape
        check (description_en is null or (btrim(description_en) <> '' and char_length(description_en) <= 80)),
    constraint sponsor_position_not_negative check (position >= 0),
    constraint sponsor_position_unique unique (position) deferrable initially deferred
);

/* „Glavni sponzor je najviše jedan.” A unique index over the rows that are main, so no row and one row are
   both a table the index accepts and two are not. */
create unique index sponsor_main_is_one on sponsor (main) where main;

/* The sponsor a logo belongs to, which is what the photo's last-holder trigger and the picture route ask by. */
create index sponsor_logo_idx on sponsor (logo_id);


/* The seventh entity a moderator may be given (PDL 24.11.2026, „novo pravo „Sponzori”, kao ostala prava”).
   The superadmin holds it without a tick, as he holds every row here (V5, `rights_mode = 'all'`). */
insert into admin_right (scope, target) values ('entity', 'sponsors');


/*
 * Does any of the SIX columns point at this photo. V108's function with `sponsor.logo_id` added last;
 * each question is an index lookup (competitor_photo_idx, verification_photo_idx, team_logo_idx,
 * team_proposal_logo_idx, league_logo_idx, sponsor_logo_idx).
 */
create or replace function a_photo_is_held(the_photo bigint) returns boolean
    language sql
    stable
as $body$
    select exists (select 1 from competitor where photo_id = the_photo)
        or exists (select 1 from verification where photo_id = the_photo)
        or exists (select 1 from team where logo_id = the_photo)
        or exists (select 1 from team_proposal where logo_id = the_photo)
        or exists (select 1 from league where logo_id = the_photo)
        or exists (select 1 from sponsor where logo_id = the_photo)
$body$;


/*
 * The picture a row let go of, taken away if nobody holds it any more. V108's function, with `sponsor`
 * among the tables whose pointer is called `logo_id`.
 */
create or replace function a_photo_nobody_holds_goes() returns trigger
    language plpgsql
as $body$
declare
    let_go bigint;
begin
    if tg_table_name in ('team', 'team_proposal', 'league', 'sponsor') then
        let_go := old.logo_id;
    else
        let_go := old.photo_id;
    end if;

    perform 1 from photo where id = let_go for update;

    if not a_photo_is_held(let_go) then
        delete from photo where id = let_go;
    end if;

    return null;
end;
$body$;


create constraint trigger sponsor_leaves_a_photo_nobody_holds
    after update of logo_id or delete on sponsor
    deferrable initially deferred
    for each row
    execute function a_photo_nobody_holds_goes();
