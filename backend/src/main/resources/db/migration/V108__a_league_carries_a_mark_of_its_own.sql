/*
 * A LEAGUE CARRIES A MARK OF ITS OWN, A PICTURE IN A CIRCLE, AND THE PICTURE GOES WITH ITS LAST HOLDER.
 *
 * Owner, PDL 23.11.2026, „Pravi logo lige", chosen between offered outcomes:
 *   - „oblik: krug, seče se kao znak tima (uz moju preporuku): čuva se original, prikazuje se u krugu; bez
 *     loga ostaje krug sa inicijalima";
 *   - „ko postavlja: administracija (administrator ili moderator sa pravom nad ligama) u moderaciji lige, bez
 *     odobravanja, i odmah važi (uz moju preporuku)".
 *
 * So the column is the shape `team.logo_id` has had since V11, copied with its guards: a pointer into
 * `photo`, which holds the original's type, size, digest and circle (V8, V21), NULLABLE because a league
 * with no mark is an ordinary league and is drawn with its initials, `on delete set null` because the photo
 * row may go first (V54), and an index because the trigger below and `PhotoApi` both ask „who holds this
 * picture" by it.
 *
 * THE FIFTH HOLDER IS TAUGHT TO V54'S RULE IN THE SAME FILE, AND THAT IS THE WHOLE POINT OF THE RULE
 * LIVING IN THE DATABASE (ADL A68, owner 03.10.2026: „Sliku koju niko ne drži briše sama baza, na kraju
 * radnje ... i to važi i za svaku buduću radnju nad tim kolonama"). A column pointing at `photo` that the
 * rule does not know would leave the replaced and the removed mark of a league standing for ever. So:
 *   - `a_photo_is_held` asks a fifth question, `league.logo_id`;
 *   - `a_photo_nobody_holds_goes` reads `logo_id` on `league` as it does on `team` and `team_proposal`;
 *   - one more deferred constraint trigger, on UPDATE OF the pointer and on DELETE, exactly the four's shape.
 * Both functions are replaced whole, with the same names, arguments and return types, so every trigger
 * V54 made goes on calling them. APhotoNobodyHoldsGoesTest asks the catalogue that every column pointing at
 * `photo` has a trigger listening to it, and walks the five.
 *
 * THE LEAGUES ALREADY THERE ARE NOT TOUCHED (CLAUDE.md, section 11). The column comes in NULL on every row,
 * which the foreign key accepts whatever else the row holds; no `not null`, no `check`, no default. That a
 * league written as a database holds it before V108 goes through and then takes a mark is measured by
 * LeagueMarkCarriedOverTest, over rows written before this file runs.
 */
alter table league
    add column logo_id bigint,
    add constraint league_logo_fk foreign key (logo_id) references photo (id) on delete set null;

create index league_logo_idx on league (logo_id);


/*
 * Does any of the FIVE columns point at this photo. V54's function with `league.logo_id` added last; each
 * question is an index lookup (competitor_photo_idx, verification_photo_idx, team_logo_idx,
 * team_proposal_logo_idx, league_logo_idx).
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
$body$;


/*
 * The picture a row let go of, taken away if nobody holds it any more. V54's function, with `league` among
 * the tables whose pointer is called `logo_id`; the IF and not a CASE for the reason V54 gives (a CASE over
 * the fields of the row names a field the table does not have even in the branch not taken).
 */
create or replace function a_photo_nobody_holds_goes() returns trigger
    language plpgsql
as $body$
declare
    let_go bigint;
begin
    if tg_table_name in ('team', 'team_proposal', 'league') then
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


create constraint trigger league_leaves_a_photo_nobody_holds
    after update of logo_id or delete on league
    deferrable initially deferred
    for each row
    execute function a_photo_nobody_holds_goes();
