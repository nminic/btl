/* A CHANGE OF BASIS KEEPS THE DAY THE SEASON WAS FIRST ACTIVATED.
 *
 * The owner, 30.10.2026 (PDL, „„Bez prava rangiranja", odgovori na pitanja iz PR-a 664", chosen with
 * the recommendation): „Promena osnova članstva (uplata u oslobođenje i obrnuto) zadržava dan prve
 * aktivacije te sezone, pa sezona ne gubi pravo rangiranja samo zato što je članstvo ponovo upisano.
 * Promena osnova nije storno: storno pa nova aktivacija i dalje odlučuje po danu nove aktivacije".
 *
 * WHY THE DAY HAS TO BE CARRIED AND CANNOT BE READ. Since PR 664 the moment a season was activated is
 * read where the act that activated it wrote it (`WhenASeasonWasActivated`): `payment.recorded_at`,
 * the line of the book the membership names, or `membership.decided_at`. A change of basis on the
 * member's row DELETES that evidence - „Kad se osnov promeni iz „uplata” ili se uplata stornira, zapis
 * o uplati se BRIŠE” (18.10.2026) - and writes a new row whose own evidence is the day of the change.
 * Nothing left in the database says when the season was first activated, so the change route reads it
 * on the row it is about to delete and writes it here, on the row that replaces it.
 *
 * WHY HERE AND NOT ON THE TRAIL. `membership_change` is the owner's sentence column by column („Nosi
 * člana, sezonu, radnju, osnov pre i posle, ko i kada", 18.10.2026), and a day read off the trail would
 * have to tell a cancellation from a change by the order of its rows, which is the one confusion the
 * decision rules out. A cancellation deletes this row, so a season activated again after one starts
 * with nothing carried, and the decision's second half holds by construction.
 *
 * WHY TWO COLUMNS AND NOT ONE. The moment can be UNKNOWN and still have to be carried: the one
 * exemption written before V35 gave exemptions their trail has no moment at all (V35 adds its checks
 * `not valid` for exactly that row), and `WhenASeasonWasActivated` answers that it ranks. Changed after
 * 31 March, a single nullable column would have nowhere to say „carried, day unknown" that differs from
 * „nothing carried", the new row would answer the day of the change, and the season would lose the
 * right the decision says it keeps. Writing a moment for it instead (the day V35 merged, or
 * `-infinity`) would put a day in the schema that nothing happened on, which V35 refuses in so many
 * words. So the flag says WHETHER the day was carried and the moment says WHICH day, when it is known.
 *
 * THE ROWS THAT ARE ALREADY THERE carry nothing, and that is the truth rather than a default chosen for
 * them. A row changed before today has lost its first day with the payment it deleted, and every row
 * there is was activated from the autumn of 2026, before any 31 March, so its right does not move.
 * `db/TheFirstActivationArrivesOverMembershipsAlreadyThereTest` runs this file over one row of each
 * basis, the exemption with no moment included, and requires each to read the moment it read before.
 */

alter table membership
    add column first_activation_carried boolean not null default false;

alter table membership
    add column first_activated_at timestamptz;

/* A moment is carried only together with the flag: a row that names a first day and says it was not
   carried is a row nobody can read the same way twice. */
alter table membership
    add constraint membership_a_first_day_is_carried
        check (first_activated_at is null or first_activation_carried);

comment on column membership.first_activation_carried is
    'Whether this row was written by a change of basis on the member''s row and carries the moment the '
        'season was first activated (PDL, 30.10.2026, „Promena osnova članstva ... zadržava dan prve '
        'aktivacije te sezone"). False on every row an activation wrote.';

comment on column membership.first_activated_at is
    'The moment the season was first activated, carried over a change of basis; empty when the row '
        'carries nothing, and empty on a carried row whose first activation had no moment (the exemption '
        'written before V35), which ranks.';
