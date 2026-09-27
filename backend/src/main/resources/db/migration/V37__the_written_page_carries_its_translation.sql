/* THE WRITTEN PAGES GET A SECOND LANGUAGE, AND THE SERBIAN STAYS WHERE IT IS.
 *
 * PDL.md, section "Pravni tekstovi se prevode na engleski do 30.09.2026, i prevodim ih JA",
 * owner, 26.09.2026, chosen from four outcomes he was shown: "sema dobija jezik, tekst se
 * prevodi, i sve ide do lansiranja". His own words on the same day: "HOCES PREVESTI SAM JER
 * JA TAKO KAZEM". English is a condition of launch (owner, 11.08.2026, PDL P18) and
 * 30.09.2026 is the date.
 *
 * DECISIONS ARE CITED BY THEIR MARK AND THEIR SENTENCE HERE, NOT BY A LINE NUMBER, and that
 * is measured rather than stylistic: the journals grow, so the numbers move. V24 cites
 * ADL A4d for a sentence that is at 404 today and PDL P28a for one that is at 4720,
 * and both were right when they were written. A mark (P18, A7, A4d) and the words themselves
 * are what stay findable.
 *
 * THIS MIGRATION CARRIES NO TEXT. The two tables below arrive empty and the translation
 * itself is a migration of its own. That is not tidiness: it is what lets this one merge
 * and deploy today, with the prose arriving later, and it changes nothing for any visitor
 * in the meantime - /api/pages asked the way it is asked today answers exactly what it
 * answered yesterday. The precedent for a table shipped with no row is in the file this
 * one extends: static_page_include (V24) has had zero rows since the day it was written,
 * with the reason recorded there rather than in a generator.
 *
 * WHY A ROW PER LANGUAGE AND NOT A COLUMN PER LANGUAGE, and this is decided rather than
 * preferred. PDL P18: "Sistem mora da podnese dodavanje treceg jezika kad god
 * zatreba, kao unos a ne kao razvoj." A title_en beside title makes Montenegrin a
 * MIGRATION, which is development, and the decision refuses that in as many words. With a
 * row per language the third tag is an insert, and this file never has to be followed by
 * another of its kind.
 *
 * WHY NOT A language COLUMN ON THE TWO TABLES V24 ALREADY HAS, which is the other way to
 * hold a row per language and is the one this file refuses. Two reasons, both measured:
 *
 *   1. A page would exist twice, so static_page_slug_unique (V24) would have to go - and
 *      ADL A4d names it as the one uniqueness left in this portal that a human still
 *      types: "Provera jedinstvenosti ostaje samo tamo gde identitet i dalje kuca covek:
 *      adresa staticne strane."
 *   2. Worse, position and gallery would then be written once per language and could
 *      DISAGREE between them. Article 4 of the rulebook is article 4 in English, and the
 *      name of a drawing is the same name. Two homes for one fact is the shape V24's own
 *      header refuses when it explains why includes is a table and not a text[].
 *
 * SO EXACTLY THREE THINGS ARE TRANSLATED - static_page.title,
 * static_page_section.heading and static_page_section.body - and everything else about a
 * page is language-independent, each for a reason with a source:
 *
 *   - slug is NOT translated. PDL P18 gives the addresses as /sr/kalendar and
 *     /en/kalendar: the language is a PREFIX and the path itself stays Serbian, which is
 *     what frontend/src/app/routeObjects.tsx already does.
 *   - position is the order a document is read in, which belongs to the document and not
 *     to the language.
 *   - gallery is the NAME of a drawing from a list closed at two (V24,
 *     static_page_section_gallery_known, and ADL A7). It is an identifier the frontend
 *     resolves to a component (DucatGallery, PriceTable), so it has no column here and is
 *     never translated. WHAT DOES HAVE TO SURVIVE TRANSLATION is the line inside body
 *     holding nothing but the gallery mark, which is where the drawing stands (ADL A7,
 *     frontend/src/components/PageSectionBody.tsx). WHAT GOES WRONG IF IT IS LOST IS NOT
 *     WHAT IT LOOKS LIKE. ADL A7, 21.08.2026, says it in as many words: "Bez tog reda crtez
 *     nije izgubljen nego stoji ispod celog teksta, dakle tacno tamo odakle ga je vlasnik
 *     pomerio." So the English page would quietly go back to the layout the owner moved the
 *     drawing away from - a silent return to the old arrangement, not a blank space, and
 *     that is the reason a guard is worth having. Translated instead of copied, the reader
 *     is shown the literal characters, which PageSectionBody calls "the one thing the mark
 *     must never do". The same decision names a third way to lose it without deleting it:
 *     the mark counts only as a WHOLE line, so anything before it on that line, a zero
 *     width character included, looks right in a diff and reads as ordinary text. A case in
 *     PageApiTest holds every translation of every section that carries a drawing to
 *     carrying a line that is exactly the mark once stripped, which refuses that third way
 *     too, and it reads the gallery column rather than a list of positions, so a third
 *     drawing added tomorrow is covered without being named.
 *   - includes is a list of addresses, so it needs no translation of its own. The boundary
 *     it leaves is written at the foot of this file.
 *
 * THE SERBIAN IS NOT MOVED, and that is the whole reason these are called translations.
 * PDL P18: "Kod pravnih tekstova mora biti izricito navedeno koja je jezicka verzija
 * merodavna, i to je srpska." The base tables hold the ORIGINAL and these two hold
 * translations OF it, so the authoritative text is the one the schema cannot let go
 * missing - V24's not null on title, heading and body all stand untouched. It is also what
 * keeps PageApiTest.theAnswerIsExactlyWhatTheMockFileHoldsToday comparing the Serbian
 * answer to frontend/public/mock/pages.json field for field through all thirty-nine
 * sections, which is the guard that this change moved no Serbian character.
 */
create table static_page_translation (
    id       bigserial not null,
    page_id  bigint    not null,
    language text      not null,
    title    text      not null,

    constraint static_page_translation_pk primary key (id),

    /* Cascaded rather than restricted, the same direction static_page_section_page_fk
       takes: an administrator may delete a written page (PDL P28a), and a translation
       of a page that is gone is not a record that stops anybody. */
    constraint static_page_translation_page_fk foreign key (page_id)
        references static_page (id) on delete cascade,

    constraint static_page_translation_once_per_language unique (page_id, language),

    /* ONE ORIGINAL, AND THE REST ARE TRANSLATIONS. Serbian lives in static_page.title
       (PDL P18 makes it the authoritative version), so a row here spelling sr would be
       a second home for it, which is the fault this whole shape exists to avoid. */
    constraint static_page_translation_not_serbian check (language <> 'sr'),

    /* THE SHAPE OF A LANGUAGE TAG HAS A SOURCE, so it is checked rather than guessed - the
       opposite of slug, which V24 deliberately left unchecked because no decision named a
       shape for it. PDL P18: "Oznake jezika: sr i en. Ako se jednog dana doda
       crnogorski, oznaka je cnr." Two or three lower-case letters. Deliberately NOT a
       closed list of the tags that exist today: in ('en') would send the third language
       back through a migration and break PDL P18.

       NO COLLATE ON THE RANGE, AND THAT IS A MEASUREMENT RATHER THAN AN OMISSION. A range
       inside a bracket expression can be resolved by the collation, so the first draft of
       this check forced it to "C" against the possibility that a tailored default would
       admit the five letters Serbian Latin has and English does not. It does not: under
       sr_latn, the tailoring V1 installs, a tag made of those letters does not match this
       expression either, and taking the clause off left the whole of
       StaticPageConstraintsTest green. A clause whose removal no case can tell is a clause
       defending nothing, so it is gone; this paragraph stands in its place so the next
       reader does not put it back for the reason the first one did. The row that measures
       what the range really refuses is in StaticPageConstraintsTest, under this
       constraint's own name. */
    constraint static_page_translation_language_shape
        check (language ~ '^[a-z]{2,3}$'),

    constraint static_page_translation_title_not_blank check (btrim(title) <> '')

    /* No index beyond the keys above, and that is the reason V24 gives for page_id on
       static_page_section: this column LEADS static_page_translation_once_per_language, so
       it is already indexed. static_page_include_included_idx exists only because that
       table has a SECOND foreign key with nothing leading it; this one has one. */
);

/* The words of one block of a page, in one language. Split from the table above rather
   than folded into it because these are two subjects - a page has a title, a block has a
   heading and a body - the same split V24 already makes between static_page and
   static_page_section. */
create table static_page_section_translation (
    id         bigserial not null,
    section_id bigint    not null,
    language   text      not null,
    heading    text      not null,
    body       text      not null,

    constraint static_page_section_translation_pk primary key (id),

    constraint static_page_section_translation_section_fk foreign key (section_id)
        references static_page_section (id) on delete cascade,

    constraint static_page_section_translation_once_per_language unique (section_id, language),

    constraint static_page_section_translation_not_serbian check (language <> 'sr'),

    constraint static_page_section_translation_language_shape
        check (language ~ '^[a-z]{2,3}$'),

    constraint static_page_section_translation_heading_not_blank check (btrim(heading) <> ''),
    constraint static_page_section_translation_body_not_blank check (btrim(body) <> '')
);

/* NO COLLATION ON ANY OF THE FIVE TEXT COLUMNS ABOVE, which is what V24 does too and is a
   measurement rather than an oversight. collate sr_latn (V1, O21) is on the columns this
   schema SORTS Serbian words by - country.name, place.name, team.name, league.name,
   ducat.name, and price_row.name since V34. Nothing orders a written page by its title
   (order by id) or a block by its heading (order by position), and an English title sorted
   by the Serbian alphabet would be the wrong answer if anything ever did.

   WHAT THIS MIGRATION LEAVES OPEN, written down rather than left for a reviewer to find.

   A PAGE THAT TAKES IN ANOTHER (static_page_include) can be translated while the page it
   takes in is not, and the reader would then get English blocks followed by Serbian ones
   in one article. That is the outcome the owner REFUSED on 26.09.2026 when he was offered
   "samo javne strane na engleskom": PDL P18, "/en bi postao delimicno srpski, sto
   izgleda kao kvar a ne kao odluka." It is left open rather than solved because no page
   uses includes today - the table has no rows, and the one page it was written for is
   drawn by the front page component directly (V24's header) - so there is no behaviour
   here to guard and nothing to measure a guard against. The day a page takes another in is
   the day this needs a decision, and the completeness rule PageApi already applies within
   one page is the shape it would take.

   THE NAME OF A PRICE LIST ROW HAS THE SAME PROBLEM AND IS NOT FIXED HERE. V34 gave
   price_row a name column, one Serbian text with collate sr_latn and no English twin, and
   the price list is public by PDL P8. That is a different resource with a different
   route and belongs to whoever writes it. */
