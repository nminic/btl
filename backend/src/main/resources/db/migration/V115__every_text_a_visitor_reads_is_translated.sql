/*
 * THE REST OF WHAT A VISITOR READS IS TRANSLATED TOO, and the ducats are translated by hand.
 *
 * Owner, PDL P18, 25.11.2026, „Automatski prevod sadržaja koji posetilac vidi" („Plan prevoda, prvi krug
 * pitanja" and „drugi krug"): after the description of an event (V113) come the rules and the prizes of a league,
 * the name of a row of the price list, the biography of a member and of a team, and a comment under an event.
 * Each is one more kind of thing a translation can belong to, which is what V113 said it would be: „every later
 * kind is a column here, its key, and one more name in the two checks that say exactly one".
 *
 * THE KEYS. One column per kind, each `on delete cascade`, for the reason V113 gives: a translation is a copy of
 * words, and the copy goes with them. For the biography it is a promise of the privacy policy and not a tidiness:
 * a member who is deleted leaves no translation of what he wrote about himself.
 *
 * `text_translation_asked` gets the same columns except the ducat's, because only a machine is ever asked and
 * nothing asks about a ducat.
 *
 * WHAT EACH KIND IS TRANSLATED IN is stated by the second check, as V113 did for the event: a league in its rules
 * and its prizes and in nothing else (its name stays as written, owner, 25.11.2026), a price row in its label, a
 * member and a team in the biography, a comment in its body, a ducat in the five words its coin and its caption
 * are made of.
 *
 * THE DUCATS ARE WRITTEN HERE, BY HAND, AND NEVER SENT (owner, 25.11.2026, „Ja ih prevedem ručno"). Fifteen
 * ducats, `origin = 'manual'`, language `en`, each made of the version of the Serbian text that stands today
 * (its digest, taken from the column itself), so that a ducat whose Serbian is rewritten later stops showing an
 * English that is no longer its translation, exactly as every other text does. The English is short, as a legend
 * on a medal is: a legend on the rim of a coin is set along an arc, and one that is much longer than the Serbian
 * would be set smaller or would not fit. The only places where it is longer are named in
 * `DucatTranslationTest.noEnglishLegendIsLongerThanTheSerbianByMoreThanThree`.
 *
 * English has no grammatical gender, so the woman's legend (`top_female`) of a ducat that has one in Serbian is
 * the same words as the man's: the portal reads „a woman's legend" as „the one a woman is shown", and what she is
 * shown in English is `CLUB MEMBER`, as he is.
 *
 * Written over rows that already stand (CLAUDE.md, section 11): the translations of the events V113 allows are
 * untouched, and the checks are made again over them before the migration ends, so one that a standing row
 * breaks stops it here.
 */
alter table text_translation
    add column league_id        bigint,
    add column price_row_id     bigint,
    add column competitor_id    bigint,
    add column team_id          bigint,
    add column event_comment_id bigint,
    add column ducat_id         bigint;

alter table text_translation
    add constraint text_translation_league_fk foreign key (league_id)
        references league (id) on delete cascade,
    add constraint text_translation_price_row_fk foreign key (price_row_id)
        references price_row (id) on delete cascade,
    add constraint text_translation_competitor_fk foreign key (competitor_id)
        references competitor (id) on delete cascade,
    add constraint text_translation_team_fk foreign key (team_id)
        references team (id) on delete cascade,
    add constraint text_translation_event_comment_fk foreign key (event_comment_id)
        references event_comment (id) on delete cascade,
    add constraint text_translation_ducat_fk foreign key (ducat_id)
        references ducat (id) on delete cascade;

alter table text_translation
    drop constraint text_translation_of_one_thing,
    drop constraint text_translation_field_of_its_thing,
    drop constraint text_translation_once;

alter table text_translation
    add constraint text_translation_of_one_thing check (num_nonnulls(event_id, league_id, price_row_id,
        competitor_id, team_id, event_comment_id, ducat_id) = 1),

    add constraint text_translation_field_of_its_thing check (
        (event_id is null or field = 'description')
        and (league_id is null or field in ('rules', 'prizes'))
        and (price_row_id is null or field = 'label')
        and (competitor_id is null or field = 'bio')
        and (team_id is null or field = 'bio')
        and (event_comment_id is null or field = 'body')
        and (ducat_id is null or field in ('name', 'top', 'top_female', 'bottom', 'counted'))),

    add constraint text_translation_once unique nulls not distinct (event_id, league_id, price_row_id,
        competitor_id, team_id, event_comment_id, ducat_id, field, language, origin);

alter table text_translation_asked
    add column league_id        bigint,
    add column price_row_id     bigint,
    add column competitor_id    bigint,
    add column team_id          bigint,
    add column event_comment_id bigint;

alter table text_translation_asked
    add constraint text_translation_asked_league_fk foreign key (league_id)
        references league (id) on delete cascade,
    add constraint text_translation_asked_price_row_fk foreign key (price_row_id)
        references price_row (id) on delete cascade,
    add constraint text_translation_asked_competitor_fk foreign key (competitor_id)
        references competitor (id) on delete cascade,
    add constraint text_translation_asked_team_fk foreign key (team_id)
        references team (id) on delete cascade,
    add constraint text_translation_asked_event_comment_fk foreign key (event_comment_id)
        references event_comment (id) on delete cascade;

alter table text_translation_asked
    drop constraint text_translation_asked_of_one_thing,
    drop constraint text_translation_asked_field_of_its_thing,
    drop constraint text_translation_asked_once;

alter table text_translation_asked
    add constraint text_translation_asked_of_one_thing check (num_nonnulls(event_id, league_id, price_row_id,
        competitor_id, team_id, event_comment_id) = 1),

    add constraint text_translation_asked_field_of_its_thing check (
        (event_id is null or field = 'description')
        and (league_id is null or field in ('rules', 'prizes'))
        and (price_row_id is null or field = 'label')
        and (competitor_id is null or field = 'bio')
        and (team_id is null or field = 'bio')
        and (event_comment_id is null or field = 'body')),

    add constraint text_translation_asked_once unique nulls not distinct (event_id, league_id, price_row_id,
        competitor_id, team_id, event_comment_id, field);

/*
 * THE FIFTEEN DUCATS, IN ENGLISH. One row per (ducat, field) where the Serbian says something: an empty legend is
 * empty in English as well and has no row (a translation is never blank, `text_translation_body_not_blank`).
 */
insert into text_translation (ducat_id, field, language, origin, source_digest, body)
select d.id, said.field, 'en', 'manual',
       encode(sha256(convert_to(case said.field
                                    when 'name' then d.name
                                    when 'top' then d.top
                                    when 'top_female' then d.top_female
                                    when 'bottom' then d.bottom
                                    else d.counted end, 'UTF8')), 'hex'),
       said.body
from (values
    ('duk-mesecni-km'     , 'name'      , 'Monthly distance'),
    ('duk-mesecni-km'     , 'top'       , 'RAN'),
    ('duk-mesecni-sati'   , 'name'      , 'Monthly hours'),
    ('duk-mesecni-sati'   , 'bottom'    , 'RUN TIME'),
    ('duk-sezonski-km'    , 'name'      , 'Season distance'),
    ('duk-sezonski-km'    , 'top'       , 'RAN'),
    ('duk-sezonski-bodovi', 'name'      , 'Season points'),
    ('duk-sezonski-bodovi', 'bottom'    , 'BTL POINTS'),
    ('duk-sezonski-sati'  , 'name'      , 'Season hours'),
    ('duk-sezonski-sati'  , 'bottom'    , 'RUN TIME'),
    ('duk-sezonske-trke'  , 'name'      , 'Season races'),
    ('duk-sezonske-trke'  , 'bottom'    , 'RACES RUN'),
    ('duk-drzave'         , 'name'      , 'Countries'),
    ('duk-drzave'         , 'top'       , 'RAN IN'),
    ('duk-drzave'         , 'top_female', 'RAN IN'),
    ('duk-drzave'         , 'bottom'    , 'COUNTRIES'),
    ('duk-drzave'         , 'counted'   , 'countries'),
    ('duk-sve-trke'       , 'name'      , 'All races'),
    ('duk-sve-trke'       , 'top'       , 'RAN'),
    ('duk-sve-trke'       , 'bottom'    , 'RACES'),
    ('duk-sve-trke'       , 'counted'   , 'races'),
    ('duk-krace-trke'     , 'name'      , 'Shorter races'),
    ('duk-krace-trke'     , 'top'       , 'CLUB MEMBER'),
    ('duk-krace-trke'     , 'top_female', 'CLUB MEMBER'),
    ('duk-krace-trke'     , 'bottom'    , 'BTL SHORT RACES'),
    ('duk-polumaratoni'   , 'name'      , 'Half marathons'),
    ('duk-polumaratoni'   , 'top'       , 'CLUB MEMBER'),
    ('duk-polumaratoni'   , 'top_female', 'CLUB MEMBER'),
    ('duk-polumaratoni'   , 'bottom'    , 'BTL HALF MARATHONS'),
    ('duk-duze-trke'      , 'name'      , 'Longer races'),
    ('duk-duze-trke'      , 'top'       , 'CLUB MEMBER'),
    ('duk-duze-trke'      , 'top_female', 'CLUB MEMBER'),
    ('duk-duze-trke'      , 'bottom'    , 'BTL LONG RACES'),
    ('duk-maratoni'       , 'name'      , 'Marathons'),
    ('duk-maratoni'       , 'top'       , 'CLUB MEMBER'),
    ('duk-maratoni'       , 'top_female', 'CLUB MEMBER'),
    ('duk-maratoni'       , 'bottom'    , 'BTL MARATHONS'),
    ('duk-uspon'          , 'name'      , 'Kármán climb'),
    ('duk-uspon'          , 'top'       , 'CLIMBED'),
    ('duk-uspon'          , 'top_female', 'CLIMBED'),
    ('duk-uspon'          , 'bottom'    , 'TO SPACE'),
    ('duk-ultramaratoni'  , 'name'      , 'Ultramarathons'),
    ('duk-ultramaratoni'  , 'top'       , 'CLUB MEMBER'),
    ('duk-ultramaratoni'  , 'top_female', 'CLUB MEMBER'),
    ('duk-ultramaratoni'  , 'bottom'    , 'BTL ULTRAMARATHONS'),
    ('duk-obim-planete'   , 'name'      , 'Around the planet'),
    ('duk-obim-planete'   , 'top'       , 'RAN'),
    ('duk-obim-planete'   , 'top_female', 'RAN'),
    ('duk-obim-planete'   , 'bottom'    , 'AROUND EARTH')
) as said (code, field, body)
join ducat d on d.code = said.code;
