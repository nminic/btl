/*
 * The thirteen things registration collects that no record could hold, step five of the order of
 * work in PRED-BAZU-ANALIZA.
 *
 * Measured before this was written, by comparing `registracija.form.json` with what V6 and V7
 * already carry: the form has nineteen fields, six of them overlap by name with `competitor`
 * (first_name, last_name, gender, first_season_2027, city, bio), two live on `account` since V6
 * (email, password), and one is not data at all (passwordRepeat, which the form checks against its
 * neighbour). What is left is what this migration is for.
 *
 * Each of them carries a `policyRow` and a `policyBasis` in the form definition, which is to say
 * the published privacy policy already promises a member that we hold it and says on what legal
 * ground. The document has been standing in front of a schema that could not keep the promise.
 *
 * WHAT THIS DOES NOT DO, said here rather than left to be found: the photograph of a watch that
 * proves a result is not this table. It belongs to the verification queue, step six, and PDL says
 * it is deleted the moment a result is verified, which is a rule about a different lifetime
 * entirely. This is the profile photograph, which lives as long as the profile.
 */

/*
 * THE DAY SOMEBODY WAS BORN, AND WHY THE YEAR STOPS BEING A COLUMN OF ITS OWN.
 *
 * V7 wrote `birth_year integer not null`, and registration collects the whole date. The published
 * privacy policy says why it is collected: to know the age category, and it is never shown. If both
 * stood as columns of their own, one fact would have two homes and they could drift - a member's
 * year saying one thing and his date another, with nothing in the schema to say which is true.
 *
 * So the date is the fact and the year is a way of saying it, exactly as V7 already treats the
 * length of a race and the category it falls in. Whoever writes a member writes a date; the year
 * answers by itself and cannot disagree.
 *
 * The column is dropped and made again rather than altered in place, because PostgreSQL has no way
 * to turn an ordinary column into a generated one. That moves it to the end of the table, which is
 * visible in a dump and is the whole of the cost. Measured before writing this: `competitor` holds
 * zero rows on QA and no other database of this schema exists, so nothing is being converted and
 * nothing can be lost. That is also why the columns below arrive NOT NULL in one step instead of
 * three.
 */
alter table competitor drop column birth_year;

alter table competitor
    add column birth_date          date        not null,
    add column father_name         text        not null collate sr_latn,
    add column address             text        not null collate sr_latn,
    add column phone               text,
    add column shirt_size          text        not null,
    add column health_statement_at timestamptz not null,
    add column photo_id            bigint;

alter table competitor
    add column birth_year integer generated always as (extract(year from birth_date)::integer) stored;

/*
 * The father's name is in the register of members that the law on sport prescribes (PDL P32), and
 * it is one of the two fields added to registration on 20.08.2026 for that reason alone. It is
 * never drawn on any screen. It stays on `competitor` rather than moving out with the document
 * number below, and the difference is deliberate: ADL A12 calls the document number the most
 * sensitive item in the whole set and asks for it to leave the table the portal's screens read. It
 * asks that of nothing else.
 */
alter table competitor
    add constraint competitor_father_name_not_blank check (btrim(father_name) <> ''),
    /* The address is where a shirt and a medal are sent, and it is also the address of residence in
       the register of members - the owner settled that both readings are the same field on
       11.08.2026. */
    add constraint competitor_address_not_blank check (btrim(address) <> ''),
    /* Optional, and the only optional field of the thirteen, so an empty string would be a second
       way of saying the same absence. There is one way: no phone is NULL. */
    add constraint competitor_phone_not_blank check (phone is null or btrim(phone) <> ''),
    /* The seven the form offers, and no eighth: a size nobody can choose is a size nobody can be
       sent. */
    add constraint competitor_shirt_size_known
        check (shirt_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'));

/*
 * THE NUMBER OF THE IDENTITY DOCUMENT, IN ITS OWN TABLE.
 *
 * ADL A12 (03.08.2026, extended 20.08.2026) and A41 (09.09.2026): the same database, a separate
 * table, its own right of access and its own retention. It is the most sensitive item in the
 * register and the competition needs it for nothing at all, so it must not sit in the table the
 * portal's screens read. The published privacy policy was corrected on 10.09.2026 to say exactly
 * this, in PR 214, after it had promised a separate database for a while.
 *
 * A row here is a member's, one to one, and it goes when he goes. It carries the moment it was
 * written because its retention is counted from the register and not from the profile, even though
 * both are five years today.
 *
 * The number is text and not a number: an identity card number is a string of characters that may
 * carry letters and may not lose a leading zero, and nothing is ever counted with it.
 */
create table competitor_document (
    competitor_id   bigint      not null,
    document_number text        not null,
    written_at      timestamptz not null default now(),

    constraint competitor_document_pk primary key (competitor_id),
    constraint competitor_document_competitor_fk foreign key (competitor_id)
        references competitor (id) on delete cascade,

    constraint competitor_document_number_not_blank check (btrim(document_number) <> ''),
    /* Letters and digits, at most twenty, which is what the form accepts. Not a pattern for one
       country's card, because the league runs across the Balkans and a member may carry any of
       them. */
    constraint competitor_document_number_shape check (document_number ~ '^[0-9A-Za-z]{1,20}$')
);

/*
 * THE PARENT'S CONSENT, AND IT IS FOUR THINGS.
 *
 * PDL 2637, repeated word for word in the published privacy policy: the name and surname, the
 * relation from a fixed list, the date and time, and the address it was given from. Not one of the
 * four is decoration - together they are the evidence that it was given, which is what the policy
 * promises to keep.
 *
 * A row exists only for a member who was under sixteen when he registered, which is what the form
 * already does with `showWhenYoungerThan`. The schema does not repeat that condition, and the
 * reason is written here rather than left as an omission: the age it would have to compare against
 * is the age ON THE DAY OF REGISTRATION, and a member turns sixteen while the row stands. A check
 * over `birth_date` would begin to refuse rows that were right when they were written.
 */
create table parental_consent (
    competitor_id bigint      not null,
    guardian_name text        not null collate sr_latn,
    relation      text        not null,
    given_at      timestamptz not null,
    given_from    inet        not null,

    constraint parental_consent_pk primary key (competitor_id),
    constraint parental_consent_competitor_fk foreign key (competitor_id)
        references competitor (id) on delete cascade,

    constraint parental_consent_guardian_name_not_blank check (btrim(guardian_name) <> ''),
    /* The three the form offers. A fourth would be a relation nobody could have chosen. */
    constraint parental_consent_relation_known check (relation in ('mother', 'father', 'guardian'))
);

/*
 * THE PHOTOGRAPH: A ROW HERE, THE FILE ON THE SERVER'S DISK.
 *
 * ADL A36 O8: the file lives on the disk under a name the database issues, and the database keeps
 * the type, the size, the digest of the content and the crop. The name is this row's `id`, which is
 * what makes A12a's first rule keepable - the server never uses the name a member's browser sent as
 * a path, because it never uses it at all.
 *
 * The digest is what says two members uploaded the same picture, and what says a file on disk is
 * still the file this row describes. The crop is kept beside the picture and never burnt into it
 * (ADL A17), so the original can be cropped again when the frame it is drawn in changes.
 */
create table photo (
    id          bigserial   not null,
    media_type  text        not null,
    byte_size   integer     not null,
    digest      text        not null,
    crop_x      integer     not null,
    crop_y      integer     not null,
    crop_side   integer     not null,
    uploaded_at timestamptz not null default now(),

    constraint photo_pk primary key (id),

    /* The three a browser can produce and a server can verify by content. Not by the name of the
       file, which is a member's to choose (ADL A12a, 1). */
    constraint photo_media_type_known check (media_type in ('image/jpeg', 'image/png', 'image/webp')),
    constraint photo_byte_size_positive check (byte_size > 0),
    /* SHA-256, sixty four lowercase hexadecimal characters, spelt out rather than trusted to be
       whatever the caller passed. */
    constraint photo_digest_shape check (digest ~ '^[0-9a-f]{64}$'),
    /* A square, because that is the shape every frame in the portal draws a member in, and one
       whose sides are inside the picture: an offset may be zero but never negative, and a side is
       never nothing. */
    constraint photo_crop_inside check (crop_x >= 0 and crop_y >= 0 and crop_side > 0)
);

/* And the member's side of it, written here and not thirty lines up, because a foreign key cannot
   name a table that does not exist yet. ON DELETE SET NULL: a photograph may be taken away without
   taking the member with it, which is what moderation does when a picture is refused. */
alter table competitor
    add constraint competitor_photo_fk foreign key (photo_id) references photo (id)
        on delete set null;

create index competitor_photo_idx on competitor (photo_id);
