/*
 * A team's logo, sent by the member who runs the team, waits in the teams queue until a moderator decides it.
 *
 * Owner, PDL 25.11.2026, „Urednik tima postavlja znak tima slikom”: „da li timovi mogu da podignu sliku kao
 * svoj znak? TJ da urednik tima uredi znak tima? Ako ne, molim te napravi tu funkcionalnost. Isti oblik secenja
 * krugom i da moze i iz administracije”. Derived the same day from the decision of 12.08.2026, „Prolazi kroz isto
 * odobravanje kao profilna slika, u redu za proveru timova koji već postoji”: the logo the team's editor sends
 * waits for a moderator and is not seen until it is approved.
 *
 * THE SHAPE IS THE PROFILE PICTURE'S, ONE TAB OVER. A member's picture waits as a row of `verification` on the
 * profiles tab, holding the picture in `photo_id` (V9) and naming whose it is in `competitor_id`. A team's logo
 * waits as a row on the teams tab, holding the picture in the same `photo_id`, naming who sent it in the same
 * `competitor_id`, and naming the TEAM in the column this file adds. `photo_id` is already one of the columns
 * a picture is held by (V54, `a_photo_is_held`), so the trigger that deletes a picture nobody holds needs no
 * change: a logo let go by a decision, by a second send or by the team going is deleted at the end of the
 * transaction, as every other picture is.
 *
 * WHY NOT `team_proposal.logo_id`, which V11 already has. A proposal carries the team's whole name, town and
 * words, and approving a change writes all of them into the team. A logo sent on its own would have to copy
 * the team's words into a proposal, and approving it would then write back words the administration may have
 * changed in the meantime. The logo is its own item, so it is its own row.
 *
 * WHAT THE FOUR RULES BELOW SAY
 * -----------------------------
 *   verification_team_fk                  the row goes with its team. A logo waiting for a team that has been
 *                                         deleted is a decision about nothing, and the picture it holds then
 *                                         goes by V54's rule.
 *   verification_only_the_teams_queue_carries_a_team
 *                                         the shape V11 gave the proposal: a team is named on the teams tab only.
 *   verification_a_team_or_a_proposal     a row on the teams tab is about a proposal OR about a team's logo,
 *                                         never both. Unlike the count V11 declined to write, this one is
 *                                         reachable: both pointers belong to the same tab.
 *   verification_a_picture_of_the_teams_tab_names_its_team
 *                                         a picture waiting on the teams tab is a team's logo, so it names the
 *                                         team. Decided rows hold no picture (V9), so this binds waiting rows only.
 *
 * And one index, verification_one_logo_waits_per_team: one logo of one team waits at a time, the owner's
 * „Ponovno slanje pregazi red koji čeka, ne pravi drugi” (27.09.2026) carried from the profile picture to the
 * logo, with V55's reason for an index rather than a constraint (a unique constraint takes no WHERE).
 *
 *
 * WHAT IT DOES TO THE ROWS THAT ARE ALREADY THERE
 * -----------------------------------------------
 * Measured on 25.11.2026, read only, on production and QA: the queue holds approved comments, approved and
 * waiting profile rows (one of them with a picture), and three approved teams rows, each with a proposal and
 * none with a picture. No teams row waits and none holds a picture. Every row comes out of this file with
 * `team_id` null, which the four rules accept for each of those shapes, and TeamLogoCarriedOverTest runs this
 * file over exactly those shapes.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */
alter table verification
    add column team_id bigint;

alter table verification
    add constraint verification_team_fk foreign key (team_id) references team (id) on delete cascade,
    add constraint verification_only_the_teams_queue_carries_a_team
        check (team_id is null or queue = 'teams'),
    add constraint verification_a_team_or_a_proposal
        check (team_id is null or team_proposal_id is null),
    add constraint verification_a_picture_of_the_teams_tab_names_its_team
        check (queue <> 'teams' or photo_id is null or team_id is not null);

/* The team a logo waits for, which the send, the editor's own reading and the deletion of a team ask by. */
create index verification_team_idx on verification (team_id);

create unique index verification_one_logo_waits_per_team on verification (team_id)
    where queue = 'teams' and state = 'waiting' and photo_id is not null;
