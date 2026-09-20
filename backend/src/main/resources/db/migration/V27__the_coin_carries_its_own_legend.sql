/*
 * THE LEGEND ON THE COIN IS THE SCHEMA'S AFTER ALL, AND V15 SAID THE OPPOSITE.
 *
 * V15 wrote, in as many words: "How a badge is DRAWN - its mark, its artwork, the words above and
 * below the number - is the portal's and stays in the portal, keyed by the code below. The schema
 * decides who gets what; it does not decide what that looks like." That sentence is overturned by
 * this migration and cannot be struck out where it stands, because a migration is immutable from
 * the day it merges (ADL A2, and MigrationsAreImmutableTest says so with the numbers). So the
 * reversal is written HERE, where the next reader of V15 will be sent by the constraint names.
 *
 * WHAT WAS WRONG WITH IT. The sentence names a danger that is real for a picture and unreal for
 * this: "writing both here would make the appearance of a badge a migration". But nothing here is
 * a picture. `DucatArt.tsx` strikes the coin out of seven MARKS it draws itself, three artworks it
 * draws itself, and three lines of text. What crosses over is not an appearance but a CODEBOOK -
 * which of the seven marks, which of the three artworks, and the words - and a codebook is the one
 * thing ADL A59 lets a migration seed: "Sifarnik sme, domenska tabela ne sme." `ducat` is one by
 * the owner's own decision of 10.08.2026 (PDL.md:2857): "Spisak dukata je zatvoren i ugradjen.
 * Dodatni dukati se ne mogu definisati na nivou administratora ni moderatora." V15 already seeds
 * all fifteen rows for exactly that reason.
 *
 * AND THE CONSEQUENCE OF LEAVING IT THERE WAS MEASURED, not feared: `/api/ducats` answered nine of
 * the sixteen names the screen reads by, so the portal could not be moved off its own file onto
 * the server at all. DucatApi's own javadoc called that "the one thing whoever switches the portal
 * over has to know". This is that switch being made possible, and nothing else moves with it.
 *
 * WHOSE DECISION EACH COLUMN IS.
 *
 *   - `top`, `bottom`, `period_at`: PDL.md:2922, 10.08.2026, the owner's words - "Ceo tekst dukata
 *     stoji na samom novcicu. Gore i dole su polukruzni natpisi uz ivicu, kao na kovanom novcu, a
 *     prag je u sredini." The period takes one of the two arcs, and the same decision says which
 *     family takes which: "kod 1 i 3 period je dole, kod 2, 4, 5 i 6 gore". Six of the fifteen,
 *     and the arc the period takes is empty, which is the check below.
 *   - `top_female`: PDL.md:2935, 11.08.2026 - "Rod ima osam porodica, ne tri. Uz 7, 14 i 15, i pet
 *     klubova od sto trka: gornji natpis je CLAN KLUBA ili CLANICA KLUBA, po clanu koji dukat
 *     gleda." Exactly eight rows below carry one.
 *   - `mark`: the seven the portal draws and no eighth. Named one by one rather than left open,
 *     for V15's own reason about periods: an eighth mark is not a value somebody adds, it is a
 *     path somebody has to draw, so it is code and a check should say so.
 *   - `art`: three, and two rows have one that is not `none` - the two whose threshold is a place
 *     rather than a score (PDL P16, and PDL.md:2922 calls them out: "Dve porodice, 7 i 15, u
 *     sredini nose crtez umesto broja").
 *   - `counted`: what a step of a run is counted in, which only a run has. Two rows have one, and
 *     they are the two rows V15 gave a `step` to.
 *
 * WHAT THIS DOES NOT DO, said here so nobody reads it into the columns. ADL.md:3496 (18.09.2026)
 * asks for "imena i opisi dukata" to be translated. There is no mechanism for a translation yet
 * and `ducat.name` has not got one either; these columns are in the same position as `name` and
 * will follow it whenever it moves. Nothing here names a language and nothing here is a second
 * home for one.
 *
 * AND WHERE THE VALUES CAME FROM. Out of `frontend/public/mock/ducats.json` on 20.09.2026, read
 * rather than retyped: the legends carry diacritics and a legend typed from memory is a legend
 * that goes into a codebook wrong. Two cases hold the two copies together from then on -
 * `DucatConstraintsTest.theFifteenAreTheFifteenThePortalDraws` over the rows, and
 * `DucatApiTest.theAnswerIsTheFifteenThePortalDraws` over the answer - and a third,
 * `everyStateOfTheDrawingIsHeldByTheRowsNamedHere`, names which rows are in which state, because
 * two copies edited together agree with each other and with nothing else.
 */


/*
 * Nullable first, and every rule stated before a value is written, so that the UPDATE below is
 * the thing that has to satisfy them. Written the other way round - values first, checks after -
 * a rule that was wrong about the fifteen would fail at ADD CONSTRAINT, which says the same thing
 * one step further from the row that broke it.
 *
 * All seven are text and none of them is nullable in the end. There is no "this ducat has no
 * bottom legend": it has an empty one, and empty means something here, which is what the two
 * biconditionals below are about. A null would be a third state nobody decided.
 */
alter table ducat
    add column top         text,
    add column top_female  text,
    add column bottom      text,
    add column period_at   text,
    add column mark        text,
    add column art         text,
    add column counted     text;

alter table ducat
    /* Which arc the period takes, or neither. V15's own reason for writing `period` out as a list
       applies word for word: a fourth place for the period is not a value, it is a lay-out. */
    add constraint ducat_period_at_known check (period_at in ('top', 'bottom', 'none')),

    /* The seven marks `DucatArt.tsx` has a path for, in the alphabet so that the list and the
       record it mirrors can be read against each other. An eighth is a drawing somebody has to
       make, so it is a migration on purpose. */
    add constraint ducat_mark_known check (mark in ('club', 'countries', 'distance', 'points',
                                                    'races', 'time', 'vertical')),

    /* And what stands in the middle when a number would say less: nothing, a galaxy, a globe. */
    add constraint ducat_art_known check (art in ('none', 'galaxy', 'globe')),

    /* THE ARC THE PERIOD TAKES IS THE ARC THAT IS EMPTY, both ways round and once per arc.
       Written as two constraints rather than one with an `and`, so that a row which empties the
       wrong arc names the arc it emptied. Measured over all fifteen: the six whose period stands
       on an arc have exactly that arc empty, and the nine whose period stands nowhere have both
       arcs full. An empty arc with the period elsewhere would be a coin with a blank rim; a full
       arc under the period would be two sentences written over each other. */
    add constraint ducat_top_is_empty_exactly_when_the_period_is_there
        check ((period_at = 'top') = (top = '')),
    add constraint ducat_bottom_is_empty_exactly_when_the_period_is_there
        check ((period_at = 'bottom') = (bottom = '')),

    /* A UNIT BELONGS TO A RUN AND TO NOTHING ELSE, which is the one rule here that ties a new
       column to an OLD one. `counted` is what the pieces of a series are counted in - "na svakih
       100 trka", "na svakih 10 drzava" - and a family that is one ducat counts no pieces. So a
       unit without a run is a word with nowhere to go, and a run without a unit is half a Serbian
       sentence. V15's `step` decides which it is, and this cannot be satisfied by the seven new
       columns agreeing among themselves. */
    add constraint ducat_a_run_says_what_it_counts check ((step = 0) = (counted = '')),

    /* AND A WOMAN'S LEGEND SAYS SOMETHING ELSE, or there is not one. Eight of the fifteen change
       wording and seven do not; a ninth that repeated the man's word for word would draw the same
       coin twice and read as a decision rather than as the copy-and-paste it is. */
    add constraint ducat_a_womans_legend_says_something_else
        check (top_female = '' or top_female <> top);


/*
 * The fifteen, as the portal draws them today, and in the order V15 wrote them.
 *
 * Read out of `frontend/public/mock/ducats.json` rather than retyped, for the reason in the
 * header. Joined by `code` rather than written as fifteen statements: the fifteen then stand as a
 * table a reader can check against the screen, which is the same thing V15 said about its own
 * list, and a `code` that matched nothing leaves that row null and is caught one statement below
 * by SET NOT NULL rather than passing quietly.
 */
update ducat as d
set top        = drawn.top,
    top_female = drawn.top_female,
    bottom     = drawn.bottom,
    period_at  = drawn.period_at,
    mark       = drawn.mark,
    art        = drawn.art,
    counted    = drawn.counted
from (values
    ('duk-mesecni-km'     , 'ISTRČANIH' , ''             , ''                 , 'bottom', 'distance' , 'none'  , ''      ),
    ('duk-mesecni-sati'   , ''          , ''             , 'NA STAZI'         , 'top'   , 'time'     , 'none'  , ''      ),
    ('duk-sezonski-km'    , 'ISTRČANIH' , ''             , ''                 , 'bottom', 'distance' , 'none'  , ''      ),
    ('duk-sezonski-bodovi', ''          , ''             , 'BTL BODOVA'       , 'top'   , 'points'   , 'none'  , ''      ),
    ('duk-sezonski-sati'  , ''          , ''             , 'NA STAZI'         , 'top'   , 'time'     , 'none'  , ''      ),
    ('duk-sezonske-trke'  , ''          , ''             , 'ISTRČANIH TRKA'   , 'top'   , 'races'    , 'none'  , ''      ),
    ('duk-drzave'         , 'TRČAO U'   , 'TRČALA U'     , 'DRŽAVA'           , 'none'  , 'countries', 'none'  , 'država'),
    ('duk-sve-trke'       , 'ISTRČANIH' , ''             , 'TRKA'             , 'none'  , 'races'    , 'none'  , 'trka'  ),
    ('duk-krace-trke'     , 'ČLAN KLUBA', 'ČLANICA KLUBA', 'BTL KRAĆIH TRKA'  , 'none'  , 'club'     , 'none'  , ''      ),
    ('duk-polumaratoni'   , 'ČLAN KLUBA', 'ČLANICA KLUBA', 'BTL POLUMARATONA' , 'none'  , 'club'     , 'none'  , ''      ),
    ('duk-duze-trke'      , 'ČLAN KLUBA', 'ČLANICA KLUBA', 'BTL DUŽIH TRKA'   , 'none'  , 'club'     , 'none'  , ''      ),
    ('duk-maratoni'       , 'ČLAN KLUBA', 'ČLANICA KLUBA', 'BTL MARATONA'     , 'none'  , 'club'     , 'none'  , ''      ),
    ('duk-uspon'          , 'POPEO SE'  , 'POPELA SE'    , 'DO SVEMIRA'       , 'none'  , 'vertical' , 'galaxy', ''      ),
    ('duk-ultramaratoni'  , 'ČLAN KLUBA', 'ČLANICA KLUBA', 'BTL ULTRAMARATONA', 'none'  , 'club'     , 'none'  , ''      ),
    ('duk-obim-planete'   , 'ISTRČAO'   , 'ISTRČALA'     , 'OKO PLANETE'      , 'none'  , 'distance' , 'globe' , ''      )
) as drawn (code, top, top_female, bottom, period_at, mark, art, counted)
where d.code = drawn.code;


/*
 * And now they are facts about every ducat there is, and about every ducat there will be.
 *
 * This is also the floor under the statement above: a sixteenth row nobody listed, or a `code`
 * spelled one way here and another way in V15, leaves nulls behind and stops the migration where
 * it stands rather than shipping a coin with no legend on it.
 */
alter table ducat
    alter column top        set not null,
    alter column top_female set not null,
    alter column bottom     set not null,
    alter column period_at  set not null,
    alter column mark       set not null,
    alter column art        set not null,
    alter column counted    set not null;
