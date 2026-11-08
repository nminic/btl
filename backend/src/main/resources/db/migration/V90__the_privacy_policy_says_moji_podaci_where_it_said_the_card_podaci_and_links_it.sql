/* THE PRIVACY POLICY SAYS "MOJI PODACI" WHERE IT SAID "THE CARD PODACI", LINKS THE SENTENCE OF SECTION 6 TO THAT PAGE, AND IS
   SIGNED 08.11.2026, IN SERBIAN AND IN ENGLISH.

   WHOSE DECISIONS, AND WHERE THEY ARE WRITTEN.

   1. PDL, the entry "Politika privatnosti odmah dobija rečenicu koja postaje tačna kad stigne meni" (owner, 07.11.2026,
      chosen with the assistant's recommendation): V89 wrote the sentence of section 6, "Polja profila, sliku i tekst o
      sebi menjate i brišete na strani Moji podaci.", before the menu that makes it true, and "Veza na „Moji podaci”
      stiže uz meni, kao izmena koja ne menja reči ni datum." The menu arrives with this file, so the words "Moji podaci"
      ("My details" in English) of that sentence become a link to /moji-podaci. A page is written once and read in every
      language, so the address is written without the language and the portal puts it in front
      (frontend/src/components/Markdown.tsx), the shape of "[opšti pravilnik lige](/pravilnik)" in the terms (V24); the
      slug is Serbian in every language (PDL P18). One slash and no extension is what the portal draws as a link of its
      own (frontend/src/components/markdownText.ts, addressOf).

   2. PDL, the entry "Uz meni „Moji podaci” u politici se menjaju i dva mesta sa „karticom Podaci”" (owner, 08.11.2026,
      the assistant's words, approved by the owner): section 2, in the row of the document number, "Vidi ga samo
      administracija i vi, na strani Moji podaci; drugima se ne prikazuje nigde" (English "Only the administration and you
      see it, on your My details page; it is not displayed to others anywhere"), the rest of the sentence unchanged; and
      section 3, "... ime oca i broj ličnog dokumenta, osim vama, na strani Moji podaci, ..." (English "... except to you,
      on your My details page, ..."). They said "na svojoj kartici Podaci", "na vašoj kartici Podaci" and "on your own
      Details card" (V73), which stops being true with the menu: a member reaches his data from the menu and not from a
      card of his profile (PDL, "Član svojim podacima pristupa iz glavnog menija", 07.11.2026). These two carry no link:
      no decision asks for one there, and the one link the owner decided stands in section 6.

   THE SIGN-OFF DATE MOVES, ON THE POLICY ONLY. PDL, "Datum Poslednja izmena na pravnom tekstu pomera se uvek kad se reči
   tog teksta promene" (owner, 07.11.2026): the date moves whenever the words of a legal text change, to the day the change
   reaches QA. The words of sections 2 and 3 change, so "Poslednja izmena: 07.11.2026." becomes "Poslednja izmena:
   08.11.2026." and "Last amended: 07.11.2026." becomes "Last amended: 08.11.2026." (section 7). The link alone would not
   have moved it, by the decision quoted under 1. If this file reaches QA on another day, the date is moved before the
   merge, in place, which ADL A2 allows while it has been applied nowhere. The rulebook (30.10.2026) and the terms of use
   (29.10.2026) are not touched and keep theirs.

   HOW. The shape of V89, V80 and V73: every edit is asked how many times its old text stands in the text it is aimed at,
   and anything but exactly once is a problem. A section that already carries the new text is a problem too, asked of the
   section with the old text taken out first. The edits are all asked and not stopped at the first problem; if there is
   any, one error lists every edit and what it found, the statement is rolled back with nothing changed, and Flyway
   refuses to start the backend. The old text of each edit is a whole clause that stands once in its section in each
   language.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of eight section
   texts (sections 2, 3, 6 and 7 of the policy, in both languages) and in them only the clauses below and the date.

   WHY A NEW FILE AND NOT AN EDIT OF V73 OR V89: ADL A2. They have been applied (V89 reached QA and production on
   07.11.2026), their checksums are in flyway_schema_history, and MigrationsAreImmutableTest holds Flyway to them. V90 and
   not another number: main stood at V89 on 08.11.2026 (c898e39d).

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which
   writtenVerification.test.ts holds that fixture to in the other direction; and
   TheWrittenPagesSayMojiPodaciWhereTheySaidTheCardTest, for both languages and for every edit. */

do $edit$
declare
    edit         record;
    current_body text;
    seen         integer;
    already      boolean;
    total        integer := 0;
    problems     integer := 0;
    report       text := '';
begin
    for edit in
        select * from (values

            ('MENU-01 document row', 'politika-privatnosti', 2, 'sr',
             $old$Vidi ga samo administracija i vi, na svojoj kartici Podaci; drugima se ne prikazuje nigde$old$,
             $new$Vidi ga samo administracija i vi, na strani Moji podaci; drugima se ne prikazuje nigde$new$),

            ('MENU-01 document row', 'politika-privatnosti', 2, 'en',
             $old$Only the administration and you see it, on your own Details card; it is not displayed to others anywhere$old$,
             $new$Only the administration and you see it, on your My details page; it is not displayed to others anywhere$new$),

            ('MENU-02 not public', 'politika-privatnosti', 3, 'sr',
             $old$ime oca i broj ličnog dokumenta, osim vama, na vašoj kartici Podaci,$old$,
             $new$ime oca i broj ličnog dokumenta, osim vama, na strani Moji podaci,$new$),

            ('MENU-02 not public', 'politika-privatnosti', 3, 'en',
             $old$father's name and ID document number, except to you, on your own Details card,$old$,
             $new$father's name and ID document number, except to you, on your My details page,$new$),

            ('MENU-03 the link', 'politika-privatnosti', 6, 'sr',
             $old$Polja profila, sliku i tekst o sebi menjate i brišete na strani Moji podaci.$old$,
             $new$Polja profila, sliku i tekst o sebi menjate i brišete na strani [Moji podaci](/moji-podaci).$new$),

            ('MENU-03 the link', 'politika-privatnosti', 6, 'en',
             $old$You change and delete profile fields, your picture and the text about yourself on the My details page.$old$,
             $new$You change and delete profile fields, your picture and the text about yourself on the [My details](/moji-podaci) page.$new$),

            ('MENU-04 sign-off', 'politika-privatnosti', 7, 'sr',
             $old$Poslednja izmena: 07.11.2026.$old$,
             $new$Poslednja izmena: 08.11.2026.$new$),

            ('MENU-04 sign-off', 'politika-privatnosti', 7, 'en',
             $old$Last amended: 07.11.2026.$old$,
             $new$Last amended: 08.11.2026.$new$)

        ) as edits (label, slug, section_position, in_language, old_text, new_text)
    loop
        total := total + 1;

        if edit.in_language = 'sr' then
            select s.body into current_body
            from static_page_section s
            join static_page p on p.id = s.page_id
            where p.slug = edit.slug and s.position = edit.section_position;
        else
            select t.body into current_body
            from static_page_section_translation t
            join static_page_section s on s.id = t.section_id
            join static_page p on p.id = s.page_id
            where p.slug = edit.slug and s.position = edit.section_position
              and t.language = edit.in_language;
        end if;

        if not found then
            problems := problems + 1;
            report := report || format(E'\n%s @ %s #%s %s: there is no such text',
                edit.label, edit.slug, edit.section_position, edit.in_language);
            continue;
        end if;

        /* How many times the old text stands in the text it is aimed at, counted by what taking it out takes away. */
        seen := (length(current_body) - length(replace(current_body, edit.old_text, '')))
                / length(edit.old_text);

        /* The new text is asked about too, for every edit, and a section that already holds it is a problem. It is asked of
           the section WITHOUT the old text, which is replaced by a character no page contains. */
        already := strpos(replace(current_body, edit.old_text, chr(1)), edit.new_text) > 0;

        report := report || format(E'\n%s @ %s #%s %s: found %s%s',
            edit.label, edit.slug, edit.section_position, edit.in_language,
            case seen when 1 then 'once' else seen::text || ' times' end,
            case when already then ', and its new text is already there' else '' end);

        if seen <> 1 or already then
            problems := problems + 1;
            continue;
        end if;

        if edit.in_language = 'sr' then
            update static_page_section s
            set body = replace(s.body, edit.old_text, edit.new_text)
            from static_page p
            where p.id = s.page_id and p.slug = edit.slug and s.position = edit.section_position;
        else
            update static_page_section_translation t
            set body = replace(t.body, edit.old_text, edit.new_text)
            from static_page_section s, static_page p
            where s.id = t.section_id and p.id = s.page_id
              and p.slug = edit.slug and s.position = edit.section_position
              and t.language = edit.in_language;
        end if;
    end loop;

    if problems > 0 then
        raise exception using
            message = format('the written pages were not edited: %s of %s edits did not find their old text exactly once where it is written',
                problems, total),
            detail = ltrim(report, E'\n'),
            hint = 'The text this migration was written against is not the text this database holds. Nothing was changed. Compare the old text of each edit above that was not found once with the section it names.';
    end if;
end
$edit$;
