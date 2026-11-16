/* THE PRIVACY POLICY SAYS IN SECTION 3 WHAT A NETWORK SHOWS WHEN SOMEBODY SHARES THE LINK OF HIS PROFILE, AND ITS SIGN-OFF MOVES TO
   16.11.2026, IN SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry „Profil ima deljivu sliku za društvene mreže (OG sliku)", item 12 (owner,
   16.11.2026): „Rečenica za Politiku privatnosti, vlasnikov tekst doslovno (16.11.2026): „Kad podelite link svog profila, društvene
   mreže i aplikacije za poruke prikazuju njegov pregled sa vašim imenom, odobrenom slikom i brojem trka i kilometara.”" The owner
   took out of the assistant's proposal the part about networks keeping the preview after the profile changes or is hidden, so this
   file says nothing about it. It goes in Serbian and in English, with the third part of the shared card (the server asks Facebook to
   read a changed profile again, item 10).

   WHAT IT SAYS, AND WHERE. Section 3 is "Šta je javno, a šta nikada nije" (position 3). The sentence becomes a paragraph of its own
   right after the list under "### Javno se prikazuje", because what a preview carries is a part of what is public: the name, the
   approved picture and the number of races and kilometres are all on that list already, and the sentence says where else they are
   shown. THE PLACE IS THE ASSISTANT'S CHOICE: the owner named the document and not the section. Serbian is the owner's sentence word
   for word. THE ENGLISH IS THE ASSISTANT'S TRANSLATION, NOT THE OWNER'S WORDING: "When you share the link to your profile, social
   networks and messaging apps show its preview with your name, your approved picture, and the number of races and kilometres." It is
   not signed off until the owner reads it.

   THE SIGN-OFF OF THE POLICY MOVES, AND ONLY THE POLICY'S. PDL, "Datum Poslednja izmena na pravnom tekstu pomera se uvek kad se reči
   tog teksta promene" (owner, 07.11.2026), with the addition of 14.11.2026 that the day moves in both languages: the day is the day
   the change reaches QA. The words of the policy change here, so "Poslednja izmena: 11.11.2026." (V95) becomes "Poslednja izmena:
   16.11.2026." and "Last amended: 11.11.2026." becomes "Last amended: 16.11.2026." (section 7). The terms (11.11.2026, V95) and the
   rulebook (15.11.2026, V100) keep theirs.

   THE DAY IS WRITTEN AS THE DAY IT IS EXPECTED. 16.11.2026 is the day this file is written and expected on QA. If it reaches QA on
   another day, the date is moved before the merge, in this file and in every place that holds it, which ADL A2 allows because the
   file has not been applied anywhere.

   HOW. The shape of V93 to V100: every edit is asked how many times its old text stands in the text it is aimed at, and anything but
   exactly once is a problem. A section that already carries the new text is a problem too, asked of the section with the old text
   taken out first. The edits are all asked and not stopped at the first problem; if there is any, one error lists every edit and what
   it found, the statement is rolled back with nothing changed, and Flyway refuses to start the backend. A replace() that matched
   nothing would be recorded as a migration that succeeded while the old text went on being published (V57 has the whole argument).

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of two sections of the policy
   (section 3, and the sign-off in section 7) in two languages, and in them only the one paragraph added after the list of what is
   public and the date. The table of processors in section 5 is not touched: what the server sends Facebook is the public address of a
   page, and the owner decided this one sentence and no other (PDL, „Pravna dokumenta se ne diraju sama", 21.08.2026).

   WHY EACH OLD TEXT RUNS ON TO THE NEXT HEADING. The new text contains the end of the list that was there, so an old text of that
   end alone would still be found once in the finished text and the migration, run a second time, would add the paragraph a second
   time instead of refusing. With the heading after it in the old text, a section that already has the paragraph does not hold it,
   and the migration says so.

   WHY A NEW FILE AND NOT AN EDIT OF V95: ADL A2. It has been applied, its checksum is in flyway_schema_history, and
   MigrationsAreImmutableTest holds Flyway to it. V102 and not another number: main stood at V101 on 16.11.2026.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian answer of this
   server to, field by field; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that fixture to in
   the other direction; and TheWrittenPagesSayWhatASharedProfileShowsTest and its carried-over twin, for every edit. */

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

            ('SHARED-01 section 3', 'politika-privatnosti', 3, 'sr',
             $old$i linkovi koje sami dodate.

### Podaci koji nisu javni$old$,
             $new$i linkovi koje sami dodate.

Kad podelite link svog profila, društvene mreže i aplikacije za poruke prikazuju njegov pregled sa vašim imenom, odobrenom slikom i brojem trka i kilometara.

### Podaci koji nisu javni$new$),

            ('SHARED-01 section 3', 'politika-privatnosti', 3, 'en',
             $old$and links you add yourself.

### Data that is not public$old$,
             $new$and links you add yourself.

When you share the link to your profile, social networks and messaging apps show its preview with your name, your approved picture, and the number of races and kilometres.

### Data that is not public$new$),

            ('SHARED-02 sign-off', 'politika-privatnosti', 7, 'sr',
             $old$Poslednja izmena: 11.11.2026.$old$,
             $new$Poslednja izmena: 16.11.2026.$new$),

            ('SHARED-02 sign-off', 'politika-privatnosti', 7, 'en',
             $old$Last amended: 11.11.2026.$old$,
             $new$Last amended: 16.11.2026.$new$)

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
