/*
 * A TEXT A VISITOR READS IS TRANSLATED BY A MACHINE, and the portal remembers which version of the
 * original each translation was made of.
 *
 * Owner, PDL P18, 25.11.2026, „Automatski prevod sadržaja koji posetilac vidi, preko Microsoft Azure
 * Translator-a, objavljuje se sam, bez pregleda": „treba da ne postoji ni jedan deo portala koji posetilac
 * iz US recimo moze da vidi a da nema engleski prevod". And of when, chosen among the outcomes offered
 * („Plan prevoda, prvi krug pitanja"): „prevod nastaje najkasnije 5 minuta posle odobrenja ili čuvanja
 * teksta". The pass that does it is TextsAreTranslated; this file is only where it writes.
 *
 * TWO TABLES, and the second is not a detail.
 *
 *   text_translation holds a translation: one row per thing, field, language and origin. A row is made
 *   of ONE version of the original, named by its digest, so an original changed after it was translated
 *   leaves a row whose digest no longer matches, and that row is never shown (owner, „zastareo prevod
 *   (original izmenjen) se ne prikazuje"). Nothing has to remember to delete it for that to be true.
 *
 *   text_translation_asked holds when a text was last sent, so a text the service keeps failing on goes
 *   behind the others instead of holding the head of every pass, and a translation the portal threw away
 *   (it changed an address in the text) is not asked for again until the original changes: the same text
 *   gets the same translation, so asking again would only spend characters. The precedent is V104, the
 *   stamp of when Facebook was last asked about an address.
 *
 * ONE COLUMN PER KIND OF THING, AND EXACTLY ONE OF THEM IS SET, rather than a table name and an id in
 * two text columns. A key that names its table is what lets the database delete a translation together
 * with what it translates: a description goes with its event, and a member's biography will go with the
 * member, which is a promise of the privacy policy and not a tidiness. Today the only kind is the event;
 * every later kind is a column here, its key, and one more name in the two checks that say "exactly one".
 *
 * A MACHINE ROW AND A HAND ROW STAND SIDE BY SIDE, never one in place of the other. PDL P18: „Jednom unet
 * ljudski prevod uvek pobeđuje automatski i ne prepisuje se." Origin is part of what makes a row unique,
 * so the pass writing a machine translation cannot reach a hand one at all, and the reader prefers the
 * hand row wherever both were made of the same original. No screen writes a hand row (owner, „Ekran za
 * ručnu ispravku prevoda: ne pravi se za sada"); the schema keeps the mark so a screen can come later.
 *
 * NO COLLATION AND NO INDEX BEYOND THE KEYS, for the reasons V37 gives: nothing here is sorted as words,
 * and each foreign key leads the unique key of its own table.
 */
create table text_translation (
    id              bigserial   not null,
    event_id        bigint,
    field           text        not null,
    language        text        not null,
    origin          text        not null,
    source_digest   text        not null,
    source_language text,
    body            text        not null,
    made_at         timestamptz not null default now(),

    constraint text_translation_pk primary key (id),

    /* Cascaded: a translation of an event that is gone is a copy of words nobody can read any more. */
    constraint text_translation_event_fk foreign key (event_id)
        references btl_event (id) on delete cascade,

    /* A ROW TRANSLATES EXACTLY ONE THING. Written over the list of keys rather than as `event_id is not
       null`, so the next kind joins the list instead of turning this into a second rule. */
    constraint text_translation_of_one_thing check (num_nonnulls(event_id) = 1),

    /* And the field is one that thing has. An event is translated in its description and in nothing
       else: its name stays as it was written (owner, 25.11.2026, „nazivi trka, mesta i događaja i imena
       ljudi ostaju u originalu"). */
    constraint text_translation_field_of_its_thing check (event_id is null or field = 'description'),

    constraint text_translation_once unique nulls not distinct (event_id, field, language, origin),

    /* The portal's own tags, the shape V37 checks: `sr` and `en` today, and a third is a row, not a
       migration. What the service is asked for (`sr-Latn`) is the client's business, not this table's. */
    constraint text_translation_language_shape check (language ~ '^[a-z]{2,3}$'),

    constraint text_translation_origin_known check (origin in ('machine', 'manual')),

    /* sha256 of the original as it was sent, in hex: what PostgreSQL's own sha256 gives, so the digest has
       one home and it is the database (WhatIsTranslated.digestOf). */
    constraint text_translation_digest_shape check (source_digest ~ '^[0-9a-f]{64}$'),

    /* What the service recognised the original as, which is what decides whether a reader is shown the
       original or this row: a text written in English is shown as written on /en. A machine always says;
       a hand never has to. */
    constraint text_translation_a_machine_says_what_it_read
        check (origin <> 'machine' or source_language is not null),
    constraint text_translation_source_language_shape
        check (source_language is null or source_language ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),

    constraint text_translation_body_not_blank check (btrim(body) <> '')
);

create table text_translation_asked (
    id            bigserial   not null,
    event_id      bigint,
    field         text        not null,
    source_digest text        not null,
    asked_at      timestamptz not null,
    /* The service answered and the portal threw the answer away, because it changed an address or a link
       the original carries. Asked again only once the original changes, which gives it a new digest. */
    thrown_away   boolean     not null default false,

    constraint text_translation_asked_pk primary key (id),

    constraint text_translation_asked_event_fk foreign key (event_id)
        references btl_event (id) on delete cascade,

    constraint text_translation_asked_of_one_thing check (num_nonnulls(event_id) = 1),
    constraint text_translation_asked_field_of_its_thing check (event_id is null or field = 'description'),
    constraint text_translation_asked_once unique nulls not distinct (event_id, field),
    constraint text_translation_asked_digest_shape check (source_digest ~ '^[0-9a-f]{64}$')
);
