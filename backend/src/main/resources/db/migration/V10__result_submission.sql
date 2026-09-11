/*
 * Where a result waits, which is the one thing the queue of V9 could point at and could not.
 *
 * WHY THIS TABLE EXISTS AT ALL. Two independent readings on 11.09.2026 found the same hole. O11 says
 * a refused report never becomes a result, so `result` carries no state and a waiting run cannot be
 * written there. `verification` carries `subject` and `body`, two pieces of prose, and points at what
 * each tab is about - `event_comment` for a comment, `photo` for a photograph. The results tab had
 * nothing to point at, and points cannot be computed out of prose. Everything the formula is fed
 * therefore lives here, in the shape `result` will take, and the queue points at it like the rest.
 *
 * WHAT THE TWO FORMS ACTUALLY ASK, MEASURED AND NOT REMEMBERED. The portal has two ways in, and they
 * differ in exactly one thing, the race:
 *
 *   `prijava-sa-trke.form.json`  hours, minutes, seconds, link, photo, comment. The race is already
 *                               in the calendar and the screen knows which one.
 *   `unos-rezultata.form.json`   the same, and before it raceName, date, raceKind (length / time /
 *                               free), city (the codebook-or-typed widget), distanceKm, ascentM,
 *                               descentM. The race is not in the calendar, so the member describes
 *                               it.
 *
 * So one table with the race identified in one of two ways, held apart by a biconditional. That is
 * not invented here either: `competitor` and `btl_event` already hold a town in exactly this shape,
 * `(place_id is null) <> (city is null)`, and this file copies the form of it and its guards.
 *
 * WHAT AN APPROVAL DOES, AND WHY THAT SHAPES THIS TABLE. The owner decided on 11.09.2026 that an
 * approved report of a race that is not in the calendar PUTS THAT RACE IN THE CALENDAR, publicly, so
 * the second member who ran it reports from the calendar instead of describing it again. Duplicates
 * are not prevented, which is his decision of 30.08.2026 in as many words: "Nista, ti pazis". That is
 * why the described race carries a name, a day, a kind and a town: those are what `btl_event` and
 * `race` need in order to exist, and they are collected here at the moment somebody knows them.
 *
 * WHY THE NUMBERS ARE HERE EVEN WHEN THE RACE IS IN THE CALENDAR. Because `result` carries its own
 * `distance_km`, `ascent_m` and `descent_m` rather than reading the race's, on purpose (V7): a race
 * edited afterwards must not silently rescore what was already run. A submission is the result before
 * it is one, so it carries them the same way. It also has to: a race of kind `time` or `free` has
 * `distance_km = 0` by `race_only_a_length_race_fixes_a_distance`, and every runner in it covers a
 * different distance.
 *
 * WHAT IS DELIBERATELY NOT HERE:
 *
 *   - no state column. The state is the verification row's, and there is exactly one of those per
 *     submission. Two states would be two answers to one question.
 *   - no photograph. `verification.photo_id` already holds it and `verification_decided_keeps_no_photo`
 *     already deletes it on decision, which is PDL 900. A second pointer would survive that.
 *   - no points. They are computed on approval by `BtlScoreCalculator`, on the server, out of the
 *     four numbers below. Storing them twice would let them disagree.
 */
create table result_submission (
    id            bigserial    not null,

    /* Whose run it is. Not nullable, unlike `verification.competitor_id`: a payment can be about
       somebody who is not a member yet, a result cannot. */
    competitor_id bigint       not null,

    /* THE RACE, EITHER WAY. `race_id` when it is in the calendar, the four columns after it when the
       member describes it. The day is asked for in both cases and is therefore always here, which is
       also what lets the foreign key below be the composite one `result` already uses. */
    race_id       bigint,
    race_date     date         not null,
    race_name     text         collate sr_latn,
    race_kind     text,
    place_id      bigint,
    city          text         collate sr_latn,
    country_id    bigint,

    /* What the formula will be fed, in the same types and the same order `result` holds them. */
    distance_km   numeric(6,2) not null,
    ascent_m      integer      not null,
    descent_m     integer      not null,
    seconds       integer      not null,

    /* The proof, and the member's own note. Both are text that is always present and may be empty,
       the shape `btl_event.link` and `btl_event.description` already have.

       WHAT THE RULE ACTUALLY IS, measured in both form definitions and in PDL: the link is
       required, a photograph makes it optional (`optionalWhenFilled: photo`), and a photograph
       makes the COMMENT required in its place (`requiredWhenFilled: photo`) - "slika nikad ne
       stoji sama". So it is one rule with three legs over two tables: the link and the comment are
       here, the photograph hangs on the verification row and is deleted there on decision. A
       single-table check cannot say it and none is pretended here. It is written down as a
       boundary and belongs to whoever writes the row. */
    link          text         not null,
    comment       text         not null,

    constraint result_submission_pk primary key (id),

    /* A waiting result does not outlive its member, exactly as a finished one does not (PDL P21). */
    constraint result_submission_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,

    /* The same composite key `result` uses, against `race_day_unique`, so a submission can never
       disagree with the calendar about which day the race was. With `race_id` null the key is not
       checked at all, which is what MATCH SIMPLE means and exactly what a described race wants. */
    constraint result_submission_race_fk foreign key (race_id, race_date) references race (id, date)
        on update cascade on delete cascade,

    /* Codebook rows are not deleted out from under a row that names them, as in V7. */
    constraint result_submission_place_fk foreign key (place_id) references place (id)
        on delete restrict,
    constraint result_submission_country_fk foreign key (country_id) references country (id)
        on delete restrict,

    /* One way or the other, never both and never neither. */
    constraint result_submission_race_is_from_the_calendar_or_described
        check ((race_id is null) <> (race_name is null)),
    constraint result_submission_described_race_says_its_kind
        check ((race_name is null) = (race_kind is null)),
    constraint result_submission_race_kind_known
        check (race_kind is null or race_kind in ('length', 'time', 'free')),
    constraint result_submission_race_name_not_blank
        check (race_name is null or btrim(race_name) <> ''),

    /* The town, in three parts, and only for a described race: a race from the calendar already has
       one and copying it here would be a second answer. The first says a described race names a town
       and a calendar one does not; the second that it is the codebook or typed, never both; the
       third is `competitor_typed_town_names_its_country` word for word. */
    constraint result_submission_described_race_names_its_town
        check ((race_name is not null) = ((place_id is not null) or (city is not null))),
    constraint result_submission_town_is_from_the_codebook_or_typed
        check (place_id is null or city is null),
    constraint result_submission_typed_town_names_its_country
        check ((city is null) = (country_id is null)),
    constraint result_submission_city_not_blank
        check (city is null or btrim(city) <> ''),

    /* The four numbers, guarded exactly as `result` guards them. */
    constraint result_submission_distance_positive check (distance_km > 0),
    constraint result_submission_ascent_not_negative check (ascent_m >= 0),
    constraint result_submission_descent_not_negative check (descent_m >= 0),
    constraint result_submission_seconds_positive check (seconds > 0),

    constraint result_submission_link_shape
        check (link = '' or link ~ '^https?://[^[:space:]]+$')
);

create index result_submission_competitor_idx on result_submission (competitor_id);
create index result_submission_race_idx on result_submission (race_id, race_date);
create index result_submission_place_idx on result_submission (place_id);
create index result_submission_country_idx on result_submission (country_id);


/* And the queue points at it, which is the whole reason it exists.
 *
 * `on delete cascade`, because a verification row whose subject is gone is a decision about nothing.
 * That is reachable: deleting a member takes his submissions, and it already took his verification
 * rows through `verification_competitor_fk`.
 *
 * UNIQUE, because one submission waits once. Without it the same run could sit in the queue twice and
 * be approved twice, and `result` would carry it twice with no way to tell which was meant.
 *
 * The check names `results` literally, and that is safe rather than a list: `verification.queue`
 * points at `admin_right.code` with ON DELETE RESTRICT and no ON UPDATE, so that code cannot be
 * renamed underneath this while any row uses it. It is deliberately one-directional. A results row
 * without a submission is a real thing - a member correcting a result he already has is moderated in
 * the same tab - so the other direction would be false. */
alter table verification
    add column result_submission_id bigint;

alter table verification
    add constraint verification_result_submission_fk
        foreign key (result_submission_id) references result_submission (id) on delete cascade,
    add constraint verification_result_submission_unique unique (result_submission_id),
    add constraint verification_only_the_results_queue_carries_a_submission
        check (result_submission_id is null or queue = 'results');
