/* THE WRITTEN PAGES USE THE ENGLISH QUOTATION MARK, "...", IN SERBIAN AND IN ENGLISH, AND NOT THE LOW SERBIAN ONE.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, P18, the section "Navodnici" (owner, 18.10.2026): the text the portal
   writes uses the English quotation marks, not the Serbian ones, across the whole portal (screens, mail, inbox, written
   pages), for the text a member or a visitor reads, in both languages. Two entries of the same section decide what
   happens to the written pages in particular (owner, 18.10.2026, who chose among the outcomes offered, on the
   assistant's recommendation): the change of the quotation marks goes to QA without waiting for his review of the pages,
   and the date "Poslednja izmena" is NOT moved, because no word is changed. The list of the sentences that change is
   given to him in the report of the pull request that carries this file, not before it is merged.

   WHAT WAS MEASURED, on the database these migrations (V1 to V60) build, over every text column of the written pages
   (the title and the translated title of a page, the heading and the body of a section, in Serbian and in English):
     - U+201E, the low double quotation mark, stands 10 times, once in each of 10 texts: the body of six Serbian
       sections and of four English ones (the list is below);
     - U+201C and U+201D, the two high ones, stand NOWHERE, and neither do the single marks (U+201A, U+2018, U+2019)
       and the angle marks (U+00AB, U+00BB) anywhere;
     - the mark that closes a quotation is already the plain ASCII " in every one of the 10 places. The Serbian text was
       written as low-open and ASCII-close, so nothing closes with a high mark, and that is why this file changes ONE
       character in each of ten places and not a pair;
     - the English text of the president's address and of the terms of use already writes its quotations with the plain
       ASCII mark ("BTL," and "My fee"). Four sections of the English rulebook carried the Serbian opening mark in
       English prose, and they are changed with the rest.
   The apostrophe is not a quotation mark and is not touched (98 of them stand in the text of the pages, as in
   "member's"). Neither is the grave accent, which the Markdown of these pages uses for code.

   THE TEN PLACES (the old text, for the reader who looks for it; the finished sentences are in the guard,
   TheWrittenPagesUseTheEnglishQuotationMarkTest, written out in full):
     Serbian: uslovi-koriscenja #6 ("Moja članarina"), rec-predsednika #1 ("BTL"), pravilnik #5 ("Beogradski maraton,
              štafeta 1"), pravilnik #9 ("Unesi rezultat"), pravilnik #12 ("Zajednička trka"), pravilnik #16 ("arhiviran
              takmičar").
     English: pravilnik #5 ("Beogradski maraton, relay leg 1"), #9 ("Submit result"), #12 ("shared race"), #16
              ("archived competitor").

   WHAT IT CHANGES, AND WHAT IT DOES NOT. It replaces U+201E, U+201C and U+201D with the plain ASCII " in the text of
   the written pages, and nothing else: no word, no space, no line break, no date. The three marks are all named, not
   only the one that is found, because the decision is about the marks and not about the ten places: a high mark that
   stood in a text on some other database would be the same kind of mark. The sign-offs stay as they are: the rulebook
   16.10.2026 (V58), the terms of use 10.10.2026 (V57), the privacy policy 18.10.2026 (V60), in both languages.

   HOW. The shape of V58 and V60, for the same reason: a replacement that matched nothing would be recorded as a
   migration that succeeded while the old marks went on being published (V57 has the whole argument). So the file first
   ASKS how many marks stand in each text column of each page and section in each language, and compares the answer with
   the ten places above and nothing else; a place that carries more or fewer marks than measured, a mark in a place that
   is not on the list (in a title, in a heading, in a text added since), and a listed place that carries none are all
   problems. The questions are all asked and not stopped at the first problem; if there is any, one error lists every
   place and what it found, the statement is rolled back with nothing changed, and Flyway refuses to start the backend.
   Only then are the marks replaced, in the body of the sections, which is the one column the answer can have found
   them in.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the text of ten sections
   (the body of each, the old mark replaced by the new one) and nothing else in them.

   WHY A NEW FILE AND NOT AN EDIT OF V24, V43, V46 OR V58: ADL A2. They have been applied, their checksums are in
   flyway_schema_history, and MigrationsAreImmutableTest holds Flyway to them.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the
   Serbian answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which
   writtenVerification.test.ts holds that fixture to in the other direction (and which, with the fixture, is held to carry
   no Serbian quotation mark at all); and, for both languages, for every one of the ten places and for the sentences
   around them, TheWrittenPagesUseTheEnglishQuotationMarkTest. */

do $edit$
declare
    /* The three marks, named by code point so that no editor and no encoding can change what this file means:
       U+201E the low double quotation mark, U+201C and U+201D the two high ones. */
    serbian_marks constant text := U&'\201E\201C\201D';

    found_place  record;
    total        integer := 0;
    problems     integer := 0;
    report       text := '';
begin
    /* Every text column of the written pages, and how many marks of the three stand in each, against the ten places the
       marks were measured at. The kind is the column (title, heading, body), the place is the position of the section (0
       for a title), and Serbian is the base table while every other language is its translation (V37). The gallery name
       is a closed list of two words (V24) and carries no prose, so it is not asked. A place that carries marks and is not
       on the list is a row with a measured count of 0, and a listed place that carries none is a row with a found count
       of 0, so both come out of the one comparison. */
    for found_place in
        select coalesce(f.kind, e.kind) as kind, coalesce(f.slug, e.slug) as slug,
               coalesce(f.place, e.place) as place, coalesce(f.language, e.language) as language,
               coalesce(e.marks, 0) as expected, coalesce(f.marks, 0) as found
        from (
            select * from (
                select 'title' as kind, p.slug as slug, 0 as place, 'sr' as language,
                       length(p.title) - length(translate(p.title, serbian_marks, '')) as marks
                from static_page p
                union all
                select 'title', p.slug, 0, t.language,
                       length(t.title) - length(translate(t.title, serbian_marks, ''))
                from static_page_translation t join static_page p on p.id = t.page_id
                union all
                select 'heading', p.slug, s.position, 'sr',
                       length(s.heading) - length(translate(s.heading, serbian_marks, ''))
                from static_page_section s join static_page p on p.id = s.page_id
                union all
                select 'body', p.slug, s.position, 'sr',
                       length(s.body) - length(translate(s.body, serbian_marks, ''))
                from static_page_section s join static_page p on p.id = s.page_id
                union all
                select 'heading', p.slug, s.position, t.language,
                       length(t.heading) - length(translate(t.heading, serbian_marks, ''))
                from static_page_section_translation t
                join static_page_section s on s.id = t.section_id join static_page p on p.id = s.page_id
                union all
                select 'body', p.slug, s.position, t.language,
                       length(t.body) - length(translate(t.body, serbian_marks, ''))
                from static_page_section_translation t
                join static_page_section s on s.id = t.section_id join static_page p on p.id = s.page_id
            ) every_place
            where every_place.marks > 0
        ) f
        full outer join (values
            ('body', 'uslovi-koriscenja', 6, 'sr', 1),
            ('body', 'rec-predsednika',   1, 'sr', 1),
            ('body', 'pravilnik',         5, 'sr', 1),
            ('body', 'pravilnik',         9, 'sr', 1),
            ('body', 'pravilnik',        12, 'sr', 1),
            ('body', 'pravilnik',        16, 'sr', 1),
            ('body', 'pravilnik',         5, 'en', 1),
            ('body', 'pravilnik',         9, 'en', 1),
            ('body', 'pravilnik',        12, 'en', 1),
            ('body', 'pravilnik',        16, 'en', 1)
        ) as e (kind, slug, place, language, marks)
          on e.kind = f.kind and e.slug = f.slug and e.place = f.place and e.language = f.language
        order by 2, 3, 4, 1
    loop
        total := total + 1;

        report := report || format(E'\n%s @ %s #%s %s: measured %s, found %s',
            found_place.kind, found_place.slug, found_place.place, found_place.language,
            found_place.expected, found_place.found);

        if found_place.expected <> found_place.found then
            problems := problems + 1;
        end if;
    end loop;

    if problems > 0 then
        raise exception using
            message = format('the quotation marks of the written pages were not changed: %s of %s places do not carry the marks they were measured to carry',
                problems, total),
            detail = ltrim(report, E'\n'),
            hint = 'The text this migration was written against is not the text this database holds. Nothing was changed. Compare each place above whose measured count is not its found count with the text it names, and the list in the header of this file with the pages.';
    end if;

    /* Replaced where the marks were measured to stand, the body of a section, in Serbian and in every translation.
       The title and the heading columns are not replaced in: the question above has refused a database in which a
       mark stands in one of them, so on a database that got this far there is nothing for such a statement to find. */
    update static_page_section
    set body = translate(body, serbian_marks, '"""')
    where translate(body, serbian_marks, '') <> body;

    update static_page_section_translation
    set body = translate(body, serbian_marks, '"""')
    where translate(body, serbian_marks, '') <> body;
end
$edit$;
