/* The axis of the portal: a member, an event, a race, and a result.
 *
 * PRED-BAZU-ANALIZA section 6 puts this fourth, after the codebooks and after
 * accounts and roles, and says why it is the one part that may be written with
 * confidence: it is the only part of the model that has been through every
 * screen of the prototype. Everything else hangs off it.
 *
 * The decisions this file puts into effect are ADL A36, and each is named at
 * the table it lands on rather than only here:
 *
 *   O1  bigserial for a key, and where a thing already has a mark people speak
 *       out loud it stands beside the key as its own unique column: a member
 *       number on a member, an address on an event. The second half of O1 is
 *       about deletion and has its own section below.
 *
 *   O2  The day a race is run is a DATE with no zone; every technical instant
 *       is a timestamptz in UTC. That is the whole difference between
 *       race.date and event_comment.published_at.
 *
 *   O5  A town is a table and a foreign key, and a town somebody typed because
 *       the codebook does not have it stays as text with an empty key.
 *
 *   O6  Two runnings of one race share an explicit link and nothing else.
 *       Nothing is worked out from the name.
 *
 *   O7  The address of an event is unique.
 *
 *   O10 The country a result was run in is a join through the race, the event,
 *       the town and the country, and not a column.
 *
 *   O11 A refused report of a result leaves a row with its state and its
 *       reason - in the verification queue, which is not this migration.
 *
 *   O21 Names sort by the Serbian Latin alphabet, through the sr_latn
 *       collation V1 creates. On the columns holding names, and on no others:
 *       a biography and a comment are prose nobody sorts, and an address is
 *       ASCII.
 *
 *
 * WHAT IS DELIBERATELY ABSENT, EACH ONE A DECISION
 * ------------------------------------------------
 *   - No points worked out here. BtlScoreCalculator already holds the formula
 *     and its golden set, and a second copy of it in a file that cannot be
 *     edited after it is merged would be the worst of the two homes ADL A31
 *     warns about. What is here is the column the number lands in, typed to
 *     match the BigDecimal that calculator returns: two decimal places.
 *
 *   - No state and no reason on a result, which is how O11 lands here. A
 *     refused report never becomes a result; the row that keeps the state and
 *     the reason is the queue's, and the queue is step 6 of the order of work.
 *     A status column here would be a second answer to "was this accepted",
 *     and the first one would be "it exists".
 *
 *   - No team on a member. Team membership through the seasons is O3, a table
 *     of its own with a season from and a season to, and it is step 8. A
 *     team_id here would be the shape O3 rejected, written into a file that
 *     cannot be edited.
 *
 *   - No season anywhere. O2 says a season is worked out in Europe/Belgrade
 *     and that this is the backend's job; nothing in this schema stores a
 *     season boundary. The frozen snapshot of a season is O4 and A37 and is
 *     step 9.
 *
 *   - No list of races on an event. It existed, as raceIds, and the same link
 *     was written a second time on the race; the two drifted apart on every
 *     race entered by hand and the field was deleted on 06.08.2026 (ADL A7).
 *     ADL A36 O1's own analysis records that the entry asking for both to be
 *     written is still open in ADL and would be read by whoever writes the
 *     first migration, which is this one. The race says which event it belongs
 *     to and that is the whole of it.
 *
 *   - No unique key over a member and a race. Whether one member may hold two
 *     results in one race is not written down anywhere, and the shipped data
 *     has one hundred and sixty five pairs that occur twice, so a unique key
 *     would be a rule invented here against measured data.
 *
 *   - No bound on a year of birth and none on a first season. Nothing written
 *     says what the earliest or the latest may be, and a number chosen here
 *     would be an assumption in the one place that cannot hold one.
 *
 *
 * TOMBSTONES, WHICH IS THE SECOND HALF OF O1
 * ------------------------------------------
 * The analysis states the two requirements that meet here: a disqualified
 * member goes together with his results, and a frozen season stays untouched.
 * Together they mean a hard cascade must never reach a frozen snapshot.
 *
 * PDL says it in the owner's own words, 11.08.2026, and gives two outcomes and
 * no third: either the profile is hidden because the membership is not active,
 * and the results and the historical tables are untouched; or the member is
 * deleted for good, with his profile and his results, and wherever his name
 * stood there is an anonymised record. And, in the same paragraph: "Zamrznute
 * sezone se time ne dovode u pitanje: brisanjem odlaze i rezultati, pa u
 * snimku sezone stoji anonimizovan zapis umesto imena."
 *
 * So, in this schema:
 *
 *   - A result does not outlive its member. ON DELETE CASCADE from competitor,
 *     which is the sentence "brisanjem odlaze i rezultati" and nothing more.
 *
 *   - A comment does. event_comment.who is the tombstone: the name as it was
 *     when the comment went out, kept for a comment whose author has since
 *     left the league and has no profile to read it off (data/types.ts). So
 *     competitor_id is nullable and the reference is ON DELETE SET NULL, and
 *     what a deletion writes over who - the name, or the replacement text of
 *     A37 - is the backend's, decided while the member's row is still there to
 *     read a gender off. The comment does not carry a gender of its own for
 *     that reason: unlike a snapshot row, which decides its wording when it is
 *     READ and so must keep a gender for ever (A37), this text is written once,
 *     at the moment of deletion.
 *
 *   - A referral does. competitor.referred_by is ON DELETE SET NULL: the credit
 *     falls when the referred member's own fee is first activated and is
 *     already paid, while a pointer to a deleted person is exactly what PDL P23
 *     forbids ("obrisati vezu broj naspram osobe").
 *
 *   - The frozen snapshot is not here yet, so the rule that guards it is a
 *     measurement rather than a sentence: CompetitorEventRaceAndResultTest reads
 *     every ON DELETE rule in the whole schema out of pg_constraint and names it. The
 *     day a snapshot table arrives with a cascade from a member on it, that
 *     fails and the decision is taken once, out loud, instead of being found
 *     after the first deletion.
 */


/* One row per member of the league.
 *
 * `member_number` is the mark people speak out loud (O1): six digits, handed
 * out when a payment is recorded, never given out twice, and the address of a
 * profile is built from it (PDL P8, PDL "Adresa profila"). The shape is pinned
 * because the address is: a number of another length is a profile address that
 * does not sort beside the others.
 *
 * A MEMBER IS NOT AN ACCOUNT, and V6 says the same thing from the other side.
 * An account exists before any of this and carries an address of electronic
 * mail, a role and whether that address is confirmed; a member is what a
 * recorded payment creates. How many accounts a member may have is still not
 * decided anywhere, so there is no column joining the two in either direction
 * here either, exactly as V6 leaves it.
 *
 * THE TOWN, AND WHY IT IS TWO COLUMNS AND NOT ONE (O5). A town from the
 * codebook is `place_id` and nothing else: its name and its country are the
 * codebook's, and reading them from there is what keeps one fact in one home
 * (A31) and what makes the English name work at all - Beograd is Belgrade on
 * the English portal and Novi Sad is Novi Sad on both (A16). A town the
 * codebook does not have is typed, and then the name is `city` and the country
 * is whoever typed it (A16: "biranje mesta iz sifarnika upisuje i drzavu, a
 * rucno upisano mesto ostavlja drzavu onome ko upisuje"). Exactly one of the
 * two answers, which is what the pair of checks says; the country of a member
 * is therefore coalesce(his own, his town's) and never two disagreeing values.
 *
 * AND THE FOREIGN KEY NAMES `place.id`, NOT `place.geonames_id`. Both would be
 * accepted - the mark is unique and its key is plain, on purpose, so that a town
 * can be pointed at at all (V3, PlaceIdentityTest) - so this is a decision and it
 * is written down rather than left to be inferred from the line below. Three
 * reasons, and the first is the one that would have decided it the other way if
 * it had come out differently:
 *
 *   - `place.id` DOES NOT MOVE. That was the whole question until 08.09.2026,
 *     and the answer was that it did: with no mark on a town, a delta lined the
 *     two states of the codebook up by `rank`, a position in a file, and taking
 *     one town out of the top rewrote 46,877 rows, so the row that held Shanghai
 *     ended up holding Chongqing under the same `id`. The mark ended that. A
 *     delta now lines the two states up by `geonames_id`, and a town that is
 *     renamed, moved in the order or given a different country is one UPDATE of
 *     one row that keeps its `id` (generate_reference_migrations.py, and
 *     DeltaMigrationAppliesTest measures it by renaming a town and moving it in
 *     the same delta). So the surrogate is stable, and pointing at the mark buys
 *     nothing that pointing at the key does not already have.
 *
 *   - THE PRECEDENT IS ONE TABLE OVER, and it is the same shape. `place` names
 *     its country as `country_id` referencing `country (id)`, not as the country
 *     code, although `country.code` is unique, plain and equally pointable at.
 *     ADL A36 O1 is that pattern: the key is the bigserial and the mark people
 *     speak out loud stands beside it. A different answer here would be the same
 *     schema saying two things about the same question two tables apart.
 *
 *   - THE MARK IS SOMEBODY ELSE'S NUMBER. GeoNames issues it and GeoNames may
 *     retire or merge one, and the codebook is cut from an export that can be
 *     recut from another source. Carried into `competitor` and `btl_event`, the
 *     mark would be that third party's identifier written across the portal's own
 *     rows; carried as `place.id` it stays inside the one table whose job is to
 *     know what a town is, and a town that changes its mark is one row of the
 *     codebook rather than every row that ever named it.
 *
 * What the same argument does NOT say: that the mark is unnecessary. It is what
 * makes `place.id` stable in the first place, which is the first reason above,
 * and it is what a delta lines the codebook up by. It is an identity for the
 * codebook's own maintenance, and the key is the identity for everything else.
 *
 * `referred_by` is the member who brought this one, as a key and not as the
 * referral code the link carries. The code is the public half and lives in its
 * own column; who it belongs to is a row, and a row is what a foreign key
 * points at. A member cannot have brought himself, which is not a joke: a
 * self-reference here would make "the other half of the pair" style arithmetic
 * come out empty, and the portal has already once been through what an empty
 * value means when it is read as "everybody".
 *
 * `birthday_shown` carries the only default in this file, and it is a default
 * because O17 wrote one: none unless the member chooses otherwise, which is
 * what the privacy policy and article 74 of the rulebook already say. Nothing
 * else here gets one - an unwritten default is a decision taken quietly.
 *
 * `bio` is NOT NULL and may be empty, and that is the difference between it and
 * a name: twenty of the thirty two members in the shipped data have written
 * none, and an empty biography is a state the profile has to look right in. */
create table competitor (
    id                bigserial not null,
    member_number     text      not null,
    first_name        text      not null collate sr_latn,
    last_name         text      not null collate sr_latn,
    gender            text      not null,
    birth_year        integer   not null,
    place_id          bigint,
    city              text      collate sr_latn,
    country_id        bigint,
    first_season      integer   not null,
    first_season_2027 boolean   not null,
    active            boolean   not null,
    membership_basis  text      not null,
    referral_code     text      not null,
    referred_by       bigint,
    bio               text      not null,
    profile_hidden    boolean   not null,
    birthday_shown    text      not null default 'none',

    constraint competitor_pk primary key (id),
    constraint competitor_member_number_unique unique (member_number),
    constraint competitor_referral_code_unique unique (referral_code),

    constraint competitor_place_fk foreign key (place_id) references place (id),
    constraint competitor_country_fk foreign key (country_id) references country (id),
    constraint competitor_referred_by_fk foreign key (referred_by) references competitor (id)
        on delete set null,

    constraint competitor_member_number_shape check (member_number ~ '^[0-9]{6}$'),
    constraint competitor_first_name_not_blank check (btrim(first_name) <> ''),
    constraint competitor_last_name_not_blank check (btrim(last_name) <> ''),
    constraint competitor_gender_known check (gender in ('M', 'F')),
    constraint competitor_membership_basis_known check (membership_basis in ('payment', 'feeExempt')),
    constraint competitor_birthday_shown_known check (birthday_shown in ('none', 'year', 'full')),

    /* Sixteen lowercase hexadecimal characters, which is what the portal issues
       and what every one of the shipped members carries. Not the member number,
       which is public and consecutive: anybody could have assembled somebody
       else's link out of one (data/types.ts). */
    constraint competitor_referral_code_shape check (referral_code ~ '^[0-9a-f]{16}$'),

    constraint competitor_town_is_from_the_codebook_or_typed check ((place_id is null) <> (city is null)),
    constraint competitor_typed_town_names_its_country check ((city is null) = (country_id is null)),
    constraint competitor_city_not_blank check (city is null or btrim(city) <> ''),

    constraint competitor_not_referred_by_itself check (referred_by is null or referred_by <> id)
);

create index competitor_place_idx on competitor (place_id);
create index competitor_country_idx on competitor (country_id);
create index competitor_referred_by_idx on competitor (referred_by);


/* One row per event in the calendar: a race meeting, a training session or a
 * gathering (owner, 10.08.2026). An event holds one or more races, and that
 * word is fixed by ADL A2; "distance" is never an entity here, because a timed
 * and a free race fix no length at all.
 *
 * `slug` is the mark people speak out loud, and O7 makes it UNIQUE. PDL, in the
 * decision of 10.08.2026: the address is the name and the year, without the
 * day - `beogradski-maraton-2027` - so an event moved within its season keeps
 * its address and everything hanging off it, and the same name twice in one
 * year is a collision the portal refuses in as many words. The historical data
 * carries fourteen groups where that happened and their addresses carry the
 * month as well; the shape below takes both, and the uniqueness is what makes
 * the collision a refusal rather than a silent second event.
 *
 * `date` is the day the event begins, which is the day of its first race
 * (PDL, 10.08.2026: "Datum dogadjaja uvek postaje datum prve od trka"). It is a
 * column and not a query over the races because an event is entered before its
 * races are - a fortnight before its distances are known, in the owner's
 * words - and the calendar draws it from the name, the day and the town. THE
 * BOUNDARY, said here rather than left to be found: keeping it equal to the
 * first race's day is the backend's, and no constraint here can say it, because
 * a CHECK cannot look at another table.
 *
 * `copied_from` is O6 and the whole of it. The link between two runnings of one
 * race is explicit and nothing is worked out from the name, because the name
 * changes - "Beogradski maraton" becomes "Wizz Air Beogradski maraton" and is
 * the same race - while two unrelated "Novogodisnja trka" in two towns are not
 * one race. What the link carries is the comments. Deleting the parent sets it
 * to NULL rather than leaving a reference into nothing, which the analysis asks
 * for in as many words, and an event cannot be a copy of itself.
 *
 * `featured` and, on the race below, `renamed` are booleans here although the
 * prototype keeps them as the words yes and no. That is not a disagreement: the
 * prototype's store keeps every value as text and a boolean written into it
 * comes back as the string "false", which is true (data/types.ts). A database
 * has a boolean and does not have that problem, so the fact is stored as what
 * it is.
 *
 * `description` and `link` are NOT NULL and may be empty. Neither is asked for
 * (owner, 23.08.2026), both are carried onto a copy, and the shape of the link
 * is the shape the form asks for, which is the same shape the link to official
 * results is refused by.
 *
 * The town is `place_id` or `city`, exactly as on the member, and `place_id`
 * names `place.id` and not `place.geonames_id` for the three reasons written out
 * over `competitor`. This is the reference ADL A36 O5 asks for and it is here
 * rather than there, so the sentence is worth pointing at twice: an event holds
 * the portal's own key to a town, and the town holds GeoNames' number. */
create table btl_event (
    id          bigserial not null,
    slug        text      not null,
    name        text      not null collate sr_latn,
    date        date      not null,
    place_id    bigint,
    city        text      collate sr_latn,
    country_id  bigint,
    kind        text      not null,
    featured    boolean   not null,
    description text      not null,
    link        text      not null,
    copied_from bigint,

    constraint btl_event_pk primary key (id),
    constraint btl_event_slug_unique unique (slug),

    constraint btl_event_place_fk foreign key (place_id) references place (id),
    constraint btl_event_country_fk foreign key (country_id) references country (id),
    constraint btl_event_copied_from_fk foreign key (copied_from) references btl_event (id)
        on delete set null,

    constraint btl_event_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint btl_event_name_not_blank check (btrim(name) <> ''),
    constraint btl_event_kind_known check (kind in ('race', 'training', 'gathering')),
    constraint btl_event_link_shape check (link = '' or link ~ '^https?://[^[:space:]]+$'),

    constraint btl_event_town_is_from_the_codebook_or_typed check ((place_id is null) <> (city is null)),
    constraint btl_event_typed_town_names_its_country check ((city is null) = (country_id is null)),
    constraint btl_event_city_not_blank check (city is null or btrim(city) <> ''),

    constraint btl_event_not_copied_from_itself check (copied_from is null or copied_from <> id)
);

create index btl_event_place_idx on btl_event (place_id);
create index btl_event_country_idx on btl_event (country_id);
create index btl_event_copied_from_idx on btl_event (copied_from);
create index btl_event_date_idx on btl_event (date);


/* One row per race, and a race belongs to exactly one event.
 *
 * `name`: every race has one and it starts out as the name of its event (owner,
 * 23.08.2026), which is why every race in the shipped file carries its event's
 * name. Never empty: it is what a member is offered when reporting a result and
 * what his own list shows him afterwards, so a race with no name is a row
 * nobody can pick out. `renamed` says the name was given by hand, and it is
 * written down rather than worked out by comparing the two names, because
 * comparing gets it wrong for the race somebody deliberately typed the event's
 * name into.
 *
 * `date` is the day this race is run on, which is not always the day of its
 * event: one event may run over more than one morning, and two races on the
 * Saturday and one on the Sunday are one event with three races (owner,
 * 10.08.2026). A DATE and not an instant, which is O2's whole first half: a day
 * is a day, and a race in Tokyo on the first of January is run on the first of
 * January.
 *
 * WHAT THE RACE FIXES AND WHAT IT LEAVES TO THE RUNNER, as three kinds and two
 * biconditionals. A race of a LENGTH fixes the distance and the runner brings
 * the time. A TIMED race fixes the time - its own limit, the same for everyone
 * who finished, which is what the formula scores against (owner, 29.08.2026) -
 * and the runner brings the distance. A FREE race fixes neither. So a limit
 * belongs to a timed race and to no other, and a distance to a race of a length
 * and to no other, and both are written as biconditionals because half of one
 * is a different fault from the other half: a length race with a limit and a
 * timed race without one are two separate ways to be wrong, and an implication
 * would catch only one. That is the same reading V4 gives the price list.
 *
 * `distance_km` is NUMERIC and not a floating point number, and that is load
 * bearing rather than tidy: PDL P5 recognises a marathon by the exact value
 * 42.2 and a half by the exact 21.1, with no tolerance, and 42.19 is a long
 * race. Exact decimal arithmetic is the only kind in which that sentence is
 * true.
 *
 * `category` is GENERATED and is the one place where a rule of the portal is
 * written into the schema, because it is a rule about one row and about one
 * column of it. It is data/raceCategory.ts, letter for letter, and generating
 * it is what makes A31 hold: the length is the fact, the category is a way of
 * saying it, and two columns that could disagree would be two facts the day one
 * of them was edited. A race that fixes no length carries a distance of zero
 * and so carries the shortest category, which is exactly what the portal
 * already computes for it (pages/admin/raceRows.ts); the coloured dot that says
 * such a race is unmeasured is drawn from the KIND and is not a sixth category
 * (data/types.ts, DOTS).
 *
 * `race_day_unique` over (id, date) exists for one reason and it is not
 * uniqueness: it is the target the result's composite key needs. See below. */
create table race (
    id            bigserial    not null,
    event_id      bigint       not null,
    name          text         not null collate sr_latn,
    renamed       boolean      not null,
    date          date         not null,
    kind          text         not null,
    limit_seconds integer      not null,
    distance_km   numeric(6,2) not null,
    ascent_m      integer      not null,
    descent_m     integer      not null,
    category      text generated always as (
        case
            when distance_km = 42.2 then 'marathon'
            when distance_km = 21.1 then 'half'
            when distance_km > 42.2 then 'ultra'
            when distance_km > 21.1 then 'long'
            else 'short'
        end
    ) stored,

    constraint race_pk primary key (id),
    constraint race_event_fk foreign key (event_id) references btl_event (id) on delete cascade,
    constraint race_day_unique unique (id, date),

    constraint race_name_not_blank check (btrim(name) <> ''),
    constraint race_kind_known check (kind in ('length', 'time', 'free')),

    constraint race_limit_seconds_not_negative check (limit_seconds >= 0),
    constraint race_only_a_timed_race_has_a_limit check ((kind = 'time') = (limit_seconds > 0)),

    constraint race_distance_not_negative check (distance_km >= 0),
    constraint race_only_a_length_race_fixes_a_distance check ((kind = 'length') = (distance_km > 0)),

    constraint race_ascent_not_negative check (ascent_m >= 0),
    constraint race_descent_not_negative check (descent_m >= 0)
);

create index race_event_idx on race (event_id);
create index race_date_idx on race (date);


/* One row per run: a member, a race, and what the formula was fed.
 *
 * WHAT IS NOT HERE, AND WHY IT IS THE POINT. The prototype's result carries the
 * name of its race, the name of its event, the address of its event and the day
 * it was run, because a screen with no database has to. Measured on the shipped
 * data, those copies have drifted in two hundred and twenty three places out of
 * seventeen thousand six hundred and forty compared values, of which one
 * hundred and sixty one are the day alone (NESLAGANJA-MOCK). The analysis says
 * that whole class disappears the moment the database ties a result to its race
 * and a race to its event, and here it does: a name and an address are one join
 * away and are not stored twice.
 *
 * THE DAY IS THE EXCEPTION, AND IT IS NOT A COPY. ADL A12, point 2c: "Merodavan
 * je datum trke, ne datum unosa rezultata. Indeks nad (clan, datum trke) je time
 * obavezan, jer se po njemu vrti svaka provera znacke." An index over two
 * tables does not exist, so the day has to be on this row for that sentence to
 * be true. What keeps it from being the hundred and sixty first drift is that
 * it is not written independently: the reference is COMPOSITE, (race_id,
 * race_date) against (id, date) on the race, so the database itself refuses a
 * day that is not that race's, and ON UPDATE CASCADE rewrites every result the
 * moment a race is moved to another morning. One fact, one home, and a machine
 * holding the copy equal to it - which is the only honest form of a copy.
 *
 * WHAT THE MEMBER'S OWN FIGURES ARE. The distance, the climb, the fall and the
 * time are on the result and not read off the race, and that is not a copy
 * either: on a race of a length they are the race's, but on a timed and on a
 * free race they are what THIS runner covered, and pages/event/reportedResult.ts
 * is the function that decides which. The points are worked out from these four
 * and from nothing else, so a result whose figures were read off a race that has
 * since been edited would no longer be the result that was scored.
 *
 * `points` is the column ADL A12 asks for and BtlScoreCalculator fills: NUMERIC
 * with two decimal places, which is the scale that calculator rounds to. Not
 * negative rather than positive, and that is measured rather than tidy: five
 * kilometres run out over a full twenty four hours scores four ten-thousandths
 * of a point, which rounds to zero, and a check demanding more than zero would
 * refuse a result that really happened.
 *
 * `category` is generated from THIS row's distance, by the same expression the
 * race carries, because the same sentence of PDL P5 decides both and
 * reportedResult.ts reads it off the distance that was actually covered.
 *
 * O10 IS THE ABSENCE OF A COLUMN. Which country a result was run in is a join:
 * result to race to event to town to country. The alternative was a country
 * column here, which is the fourth copy on a row that already had three and
 * that is where the drift above came from. The index below is A12's, and the
 * join has the keys it needs at every step. */
create table result (
    id            bigserial    not null,
    competitor_id bigint       not null,
    race_id       bigint       not null,
    race_date     date         not null,
    distance_km   numeric(6,2) not null,
    ascent_m      integer      not null,
    descent_m     integer      not null,
    seconds       integer      not null,
    points        numeric(8,2) not null,
    category      text generated always as (
        case
            when distance_km = 42.2 then 'marathon'
            when distance_km = 21.1 then 'half'
            when distance_km > 42.2 then 'ultra'
            when distance_km > 21.1 then 'long'
            else 'short'
        end
    ) stored,

    constraint result_pk primary key (id),

    /* A result does not outlive its member (PDL P21, deletion takes the results
       with it) and does not outlive its race. */
    constraint result_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,
    constraint result_race_fk foreign key (race_id, race_date) references race (id, date)
        on update cascade on delete cascade,

    constraint result_distance_positive check (distance_km > 0),
    constraint result_ascent_not_negative check (ascent_m >= 0),
    constraint result_descent_not_negative check (descent_m >= 0),
    constraint result_seconds_positive check (seconds > 0),
    constraint result_points_not_negative check (points >= 0)
);

/* ADL A12, 2c, in as many words: the index over (member, day of the race). */
create index result_competitor_race_date_idx on result (competitor_id, race_date);
create index result_race_idx on result (race_id, race_date);


/* One member saying they are going to one event (owner, 11.08.2026).
 *
 * A stated intention and nothing more: PDL P10 has said from the beginning that
 * signing up through the portal is "samo iskazana namera, ne obaveza". So the
 * row carries no date, no state and no answer - there is nothing to say about
 * an intention except whose it is and what it is about - and saying it twice is
 * the same intention, which is what the unique key says.
 *
 * Both references cascade, and both directions are the same sentence: an
 * intention about an event that no longer exists is nothing, and so is an
 * intention of a member who no longer exists. Nothing about it is worth
 * keeping after either end is gone, which is exactly what makes it not a
 * tombstone. */
create table attending (
    id            bigserial not null,
    event_id      bigint    not null,
    competitor_id bigint    not null,

    constraint attending_pk primary key (id),
    constraint attending_event_fk foreign key (event_id) references btl_event (id) on delete cascade,
    constraint attending_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,
    constraint attending_said_once unique (event_id, competitor_id)
);

create index attending_competitor_idx on attending (competitor_id);


/* What a member wrote about an event, once it is out on the portal.
 *
 * The queue item it came from stays in the queue: this is the record of what
 * was published and what every public screen reads (data/types.ts). The queue
 * is step 6 and is not this migration, which is the same line O11 draws for a
 * result.
 *
 * `who` is the tombstone. The name as it was when the comment went out, for a
 * comment whose author has since left the league and has no profile to read it
 * off - so competitor_id may be null and the reference sets it to null rather
 * than taking the comment with it. Everything else about a deletion is written
 * over this column by the backend, at the moment of the deletion, while the
 * member's row is still there.
 *
 * `published_at` is a timestamptz and not a DATE, and the difference from
 * race.date is exactly O2: the day a race is run is a day, and a comment going
 * out is a technical instant. Held in UTC; which day that is in Belgrade is the
 * backend's arithmetic.
 *
 * THE THREE MARKS ARE THREE COLUMNS. PDL P6 fixes the list at three -
 * organisation, value, ambience, the last renamed from "okruzenje" to
 * "ambijent" on 07.08.2026 - and a fixed list of three is three columns rather
 * than a table of marks, which would let a fourth mark in without a decision.
 * Zero is a mark nobody gave and is what a comment written before the ratings
 * existed carries (data/types.ts, NO_RATING); five is the whole of the scale
 * the form draws (components/Stars.tsx).
 *
 * `body` is NOT NULL and may be empty, because the form allows a member to rate
 * an event and say nothing (pages/RateEvent). No collation on it and none on a
 * biography: O21 asks for the Serbian alphabet on columns holding names, and
 * prose nobody sorts is not one. */
create table event_comment (
    id                  bigserial   not null,
    event_id            bigint      not null,
    competitor_id       bigint,
    who                 text        not null collate sr_latn,
    published_at        timestamptz not null,
    rating_organisation smallint    not null,
    rating_value        smallint    not null,
    rating_ambience     smallint    not null,
    body                text        not null,

    constraint event_comment_pk primary key (id),
    constraint event_comment_event_fk foreign key (event_id) references btl_event (id) on delete cascade,
    constraint event_comment_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete set null,

    constraint event_comment_who_not_blank check (btrim(who) <> ''),
    constraint event_comment_organisation_in_scale check (rating_organisation between 0 and 5),
    constraint event_comment_value_in_scale check (rating_value between 0 and 5),
    constraint event_comment_ambience_in_scale check (rating_ambience between 0 and 5)
);

create index event_comment_event_idx on event_comment (event_id);
create index event_comment_competitor_idx on event_comment (competitor_id);
