/*
 * A FROZEN TEAM KEEPS HOW MANY RACES OF EACH LENGTH IT RAN, WRITTEN BY THE FREEZE AT 16:00 ON 1 JANUARY.
 *
 * PDL, owner, 06.11.2026, „Krug „Trke po distanci" na strani tima zamrznute sezone crta se iz snimka":
 * „posao zamrzavanja u 16:00 upisuje i broj trka tima po vrsti, pa trka upisana posle zamrzavanja ne
 * menja krug te sezone (odluka od 31.07.2026: naknadni rezultat se vidi samo na profilu)."
 *
 * A row is one length of one team's frozen row, and only a length the team ran: the ring draws a length
 * it has no races of as nothing, so a row of nought would be a second way of saying what an absent row
 * says. The races are the runs `season_team.races` counts (the runs the standings count, of the members
 * the team counted in the season), each under the length its result carries (`result.category`), so the
 * rows of one team add up to that column.
 *
 * Hung off the team's frozen row and not off `team`, the shape `season_team_member` has (V84): a team
 * deleted later empties `season_team.team_id` and leaves the frozen row (PDL, 04.09.2026, „Tim se briše
 * i kad je sezona zamrznuta, ali zamrznuta tabela ostaje"), so these rows stay with it, and the cascade
 * below reaches them only when the frozen row itself goes, which nothing does (ADL, O1, „tvrdo kaskadno
 * brisanje ne sme da dosegne zamrznut snimak"). No row names a member, so the job that deletes a member
 * after five years and the trigger that forgets a name have nothing here to do.
 *
 * Nothing stands in `season_team` today (V84 refuses by name the day it does), so nothing is owed a row
 * here either.
 */
create table season_team_length (
    season_team_id bigint  not null,
    length         text    not null,
    races          integer not null,

    constraint season_team_length_pk primary key (season_team_id, length),
    constraint season_team_length_team_fk foreign key (season_team_id) references season_team (id)
        on delete cascade,

    constraint season_team_length_known check (length in ('short', 'half', 'long', 'marathon', 'ultra')),
    constraint season_team_length_races_positive check (races > 0)
);
