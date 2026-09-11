/*
 * The badges, and who has won which. Step twelve.
 *
 * THE WORD. The portal calls them "dukati" and they are a recognition and nothing more: PDL says
 * "Znacke su SAMO priznanje, ne nose bodove", so nothing here touches scoring and nothing joins to
 * `result` except by being computed from it.
 *
 * WHO DEFINES THEM. Nobody, any more. Until 06.08.2026 a badge was going to be an entity a
 * superadmin managed from a screen; the owner cancelled that in one sentence - "nece biti definisane
 * ipak custom od strane admina" - and the screen left the administration on 10.08.2026. What stayed
 * on its feet is the other half of that decision: "uslov je i dalje PODATAK koji se tumaci, nikad
 * kod" (ADL A12). So the fifteen live here as rows and the server reads them, rather than fifteen
 * `if` statements somebody has to find.
 *
 * WHAT IS DELIBERATELY NOT HERE. How a badge is DRAWN - its mark, its artwork, the words above and
 * below the number - is the portal's and stays in the portal, keyed by the code below. The schema
 * decides who gets what; it does not decide what that looks like. Writing both here would make the
 * appearance of a badge a migration, and a migration is the one thing that cannot be changed after
 * it has run.
 */


/*
 * The eleven quantities a condition can be written over, as a codebook rather than as a list inside
 * a CHECK.
 *
 * This is V9's answer to the same question, and the reason is the same. A CHECK naming eleven words
 * is a hand written list with nothing under it: a twelfth quantity is then a migration that edits a
 * constraint, and eleven words can drift from the eleven things the server actually computes. A
 * foreign key makes "which quantities exist" a thing you can read, and a badge over a quantity that
 * does not exist is refused by the key rather than by somebody remembering.
 *
 * Measured out of `frontend/public/mock/ducats.json` on 11.09.2026: eleven kinds across fifteen
 * badges, and every one of them is a number the portal already computes for a member.
 */
create table ducat_kind (
    code text not null,

    constraint ducat_kind_pk primary key (code),
    constraint ducat_kind_code_shape check (code ~ '^[a-zA-Z]+$')
);

insert into ducat_kind (code) values
    ('totalKm'), ('totalTime'), ('totalAscent'), ('points'),
    ('raceCount'), ('shortCount'), ('halfCount'), ('longCount'),
    ('marathonCount'), ('ultraCount'), ('countryCount');


/*
 * The fifteen badges.
 *
 * A SERIES IS THREE COLUMNS AND NOT FIFTEEN ROWS. Two of the fifteen are not one threshold but a
 * run of them: countries every ten up to a hundred, races every hundred up to a thousand. Writing
 * them out would be ninety rows that all say the same sentence, and the sentence is what a reader
 * needs. So `step` and `last` carry the run, and `step = 0` means there is only the one threshold.
 *
 * AND THE TIER RISES PART WAY THROUGH A SERIES, which is the owner's own correction of 10.08.2026:
 * the proposal was that only the last piece counted as higher, and he moved the line to the middle
 * of the run, "jer razlika izmedju sto i hiljadu trka nije razlika koju treba priznati tek na
 * kraju". `tier_up_from` is where it moves.
 */
create table ducat (
    id           bigserial    not null,

    /* What the portal knows it by, and what its drawing is keyed on. */
    code         text         not null,
    name         text         not null collate sr_latn,

    /* The condition: this much of this quantity, within this period. */
    kind         text         not null,
    threshold    numeric(12,2) not null,
    period       text         not null,

    /* What it is worth, and where a run of thresholds turns into a higher one. */
    tier         smallint     not null,

    /* A run of thresholds, or none: `step` of nought means the one above and nothing after it. */
    step         numeric(12,2) not null,
    last         numeric(12,2) not null,
    tier_up_from numeric(12,2) not null,

    constraint ducat_pk primary key (id),
    constraint ducat_code_unique unique (code),
    constraint ducat_kind_fk foreign key (kind) references ducat_kind (code) on delete restrict,

    constraint ducat_code_shape check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint ducat_name_not_blank check (btrim(name) <> ''),

    /* Three periods and no more, and this one IS a list on purpose: a period is a shape of time
       the server knows how to close, not a value somebody adds. A fourth would be code. */
    constraint ducat_period_known check (period in ('month', 'season', 'always')),

    constraint ducat_threshold_positive check (threshold > 0),
    constraint ducat_tier_in_range check (tier between 1 and 5),

    /* A run, or nothing at all, and never half of one. */
    constraint ducat_step_not_negative check (step >= 0),
    constraint ducat_a_run_has_an_end check ((step = 0) = (last = 0)),
    constraint ducat_a_run_is_a_whole_number_of_steps
        check (step = 0 or mod(last - threshold, step) = 0),

    /* And the tier rises inside the run or not at all.

       THIS ALSO SAYS THE RUN ENDS ABOVE WHERE IT STARTS, and a separate check saying so was
       written here and then removed: `tier_up_from > threshold and tier_up_from <= last` cannot
       hold when `last <= threshold`, so a row with a run that ends below its start breaks this
       one and no row could ever break that one alone. The case written for it would have been
       measuring this constraint while naming that one. Found while writing that case. */
    constraint ducat_tier_rises_inside_the_run
        check (case when step = 0 then tier_up_from = 0
                    else tier_up_from > threshold and tier_up_from <= last end)
);

create index ducat_kind_idx on ducat (kind);


/*
 * The fifteen, exactly as the portal draws them today.
 *
 * Written out rather than generated, unlike `country` and `place`: fifteen rows fit on a screen and
 * a reader can check them against what he sees on the portal. A generator earns its keep at two
 * hundred and forty six rows, not at fifteen (A36 O18 is about codebooks that are handed over as
 * files; this one is written by hand in both places).
 */
insert into ducat (code, name, kind, threshold, period, tier, step, last, tier_up_from) values
    ('duk-mesecni-km',      'Mesečni kilometri',  'totalKm',       125,   'month',  1, 0,   0,    0),
    ('duk-mesecni-sati',    'Mesečni sati',       'totalTime',     20,    'month',  1, 0,   0,    0),
    ('duk-sezonski-km',     'Sezonski kilometri', 'totalKm',       1000,  'season', 2, 0,   0,    0),
    ('duk-sezonski-bodovi', 'Sezonski bodovi',    'points',        1000,  'season', 2, 0,   0,    0),
    ('duk-sezonski-sati',   'Sezonski sati',      'totalTime',     200,   'season', 2, 0,   0,    0),
    ('duk-sezonske-trke',   'Sezonske trke',      'raceCount',     50,    'season', 2, 0,   0,    0),
    ('duk-drzave',          'Države',             'countryCount',  10,    'always', 3, 10,  100,  50),
    ('duk-sve-trke',        'Sve trke',           'raceCount',     100,   'always', 3, 100, 1000, 500),
    ('duk-krace-trke',      'Kraće trke',         'shortCount',    100,   'always', 3, 0,   0,    0),
    ('duk-polumaratoni',    'Polumaratoni',       'halfCount',     100,   'always', 3, 0,   0,    0),
    ('duk-duze-trke',       'Duže trke',          'longCount',     100,   'always', 4, 0,   0,    0),
    ('duk-maratoni',        'Maratoni',           'marathonCount', 100,   'always', 4, 0,   0,    0),
    ('duk-uspon',           'Uspon',              'totalAscent',   100000,'always', 4, 0,   0,    0),
    ('duk-ultramaratoni',   'Ultramaratoni',      'ultraCount',    100,   'always', 4, 0,   0,    0),
    ('duk-obim-planete',    'Obim planete',       'totalKm',       40075, 'always', 5, 0,   0,    0);


/*
 * Who has won which, and what he had when he won it.
 *
 * A36 O13 word for word: "Snimak je tri vrednosti: vrsta velicine, prag i vrednost dukata." All
 * three are copied onto the row rather than joined to the definition, and the reason is V7's: a
 * badge won for a hundred races must go on saying a hundred races even if the badge is later
 * rewritten. A join would rewrite history quietly, which is the one thing A37 spends five tables
 * refusing to do.
 *
 * WHICH PERIOD IT WAS WON IN is the other half of that snapshot, and it is here rather than derived
 * because a period ducat is won again every period: `season` and `month` say which one, and they
 * are governed by `period`, which is copied for exactly that reason - a CHECK cannot read the
 * definition table.
 */
create table ducat_award (
    id            bigserial     not null,
    competitor_id bigint        not null,
    ducat_id      bigint        not null,
    awarded_at    timestamptz   not null default now(),

    /* O13's three, copied at the moment it was won. */
    kind          text          not null,
    threshold     numeric(12,2) not null,
    reached       numeric(12,2) not null,

    /* And which period that was. */
    period        text          not null,
    season        integer,
    month         smallint,

    constraint ducat_award_pk primary key (id),
    constraint ducat_award_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,
    /* The definition does not go while somebody has won it. A badge is a recognition and PDL P13's
       sentence about history applies here too: what was won stays won. */
    constraint ducat_award_ducat_fk foreign key (ducat_id) references ducat (id) on delete restrict,
    constraint ducat_award_kind_fk foreign key (kind) references ducat_kind (code) on delete restrict,

    constraint ducat_award_threshold_positive check (threshold > 0),
    constraint ducat_award_reached_meets_the_threshold check (reached >= threshold),

    constraint ducat_award_period_known check (period in ('month', 'season', 'always')),
    /* A badge that stands for ever belongs to no season, and one that does not, does. */
    constraint ducat_award_a_period_says_its_season check ((period = 'always') = (season is null)),
    constraint ducat_award_only_a_month_says_its_month check ((period = 'month') = (month is not null)),
    constraint ducat_award_season_not_before_the_league check (season is null or season >= 2027),
    constraint ducat_award_month_in_the_year check (month is null or month between 1 and 12),

    /* ONE BADGE PER THRESHOLD PER PERIOD, and NULLS NOT DISTINCT is what makes that true of the
       badges that stand for ever: without it two rows with a null season do not collide at all,
       and "Sve trke, 100" could be awarded twice. */
    constraint ducat_award_won_once unique nulls not distinct (competitor_id, ducat_id, threshold, season, month)
);

create index ducat_award_competitor_idx on ducat_award (competitor_id);
create index ducat_award_ducat_idx on ducat_award (ducat_id);
create index ducat_award_kind_idx on ducat_award (kind);
