/* THE PRIVACY POLICY SAYS THAT THE PROFILE FIELDS, THE PICTURE AND THE TEXT ABOUT ONESELF ARE CHANGED AND DELETED ON THE
   CARD PODACI OF ONE'S OWN PROFILE, IN SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry "Politika privatnosti: rečenica „Deo možete i sami: polja
   profila menjate i brišete u podešavanjima." postaje …" (owner, 06.11.2026, chosen among the offered outcomes, with the
   assistant's recommendation). The sentence of section 6 ("6. Vaša prava")

     "Deo možete i sami: polja profila menjate i brišete u podešavanjima."

   becomes, in the owner's words,

     "Polja profila, sliku i tekst o sebi menjate i brišete na kartici Podaci svog profila."

   The rest of the policy stays, and so does "U podešavanjima možete sakriti profil" in section 3: that one is still true,
   because the privacy choice stays on Podešavanja (the same entry). The entry says the change goes in a migration after
   the picture and the text about oneself moved from Podešavanja to the card Podaci, which reached production with PR 688.

   THE ENGLISH is the translation of that sentence and the assistant's, not the owner's. The card is called "Details" in the
   English portal (`profile.parts.data`, the name V73 already uses for it in this policy), so
     English:  You change and delete profile fields, your picture and the text about yourself on the Details card of your own profile.
   It replaces "Some of it you can do yourself: you change and delete profile fields in settings." as the Serbian
   replaces the whole sentence including its lead-in, since the owner's sentence has none.

   THE SIGN-OFF DATE IS NOT MOVED HERE, and that is a question left to the owner and not an omission. The words of this
   page change, and the practice of V58, V60, V70, V73, V76, V77 and V80 is to move "Poslednja izmena" on a document whose
   text changes (PDL, "Datum Poslednja izmena se pomera", owner, 16.10.2026, about that one change), but the entry of
   06.11.2026 that decides this sentence says nothing about the date, and V73 states that moving it was the assistant's
   derivation and not the owner's decision. So "Poslednja izmena: 29.10.2026." and "Last amended: 29.10.2026." (V77) stand
   as they are. If the owner decides that the date moves, it is two more edits of this table, to the day this file
   reaches QA, and this file has not been applied anywhere until then.

   HOW. The shape of V73 and V80: every edit is asked how many times its old text stands in the text it is aimed at, and
   anything but exactly once is a problem. A section that already carries the new text is a problem too, asked of the
   section with the old text taken out first, as in V77 and V80. The edits are all asked and not stopped at the first
   problem; if there is any, one error lists every edit and what it found, the statement is rolled back with nothing
   changed, and Flyway refuses to start the backend. A replace() that matched nothing would be recorded as a migration that
   succeeded while the old text went on being published (V57 has the whole argument). The old text of each edit is the
   whole sentence, which stands once in section 6 of the policy in each language and nowhere else on the written pages.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of two section
   texts (section 6 of the policy, in both languages) and in them only the one sentence. Not the sentence after it
   about the consent for cookies, not the table of rights, not the date.

   WHY A NEW FILE AND NOT AN EDIT OF V24, V43 OR V57: ADL A2. They have been applied, their checksums are in
   flyway_schema_history, and MigrationsAreImmutableTest holds Flyway to them. V89 and not another number: main stood at V88
   on 07.11.2026 (b70d7dfe) and no open pull request held a migration.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which
   writtenVerification.test.ts holds that fixture to in the other direction; and
   TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest, for both languages and for every edit. */

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

            ('PROFILE-01 section 6', 'politika-privatnosti', 6, 'sr',
             $old$Deo možete i sami: polja profila menjate i brišete u podešavanjima.$old$,
             $new$Polja profila, sliku i tekst o sebi menjate i brišete na kartici Podaci svog profila.$new$),

            ('PROFILE-01 section 6', 'politika-privatnosti', 6, 'en',
             $old$Some of it you can do yourself: you change and delete profile fields in settings.$old$,
             $new$You change and delete profile fields, your picture and the text about yourself on the Details card of your own profile.$new$)

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
