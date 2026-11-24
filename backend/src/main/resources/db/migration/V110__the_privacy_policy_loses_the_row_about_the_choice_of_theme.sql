/* THE PRIVACY POLICY LOSES THE ROW ABOUT THE CHOICE OF THEME, IN SERBIAN AND IN ENGLISH, AND ITS SIGN-OFF MOVES TO 24.11.2026.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry „Tema" (owner, 24.11.2026, chose between the offered, with the assistant's
   recommendation): „Red o izboru teme (`btl-theme`, lokalno skladište) se briše iz Politike privatnosti, srpske i engleske, bez ikakvog
   novog teksta." Offered and not chosen: leave it as it is. The portal has had one theme since PR 817 (PDL „Portal ima samo tamnu temu;
   svetla se izbacuje", 24.11.2026): the choice is not made and not kept any more, and a choice a browser kept from before is taken out
   of it when the portal starts (`frontend/src/app/forgetTheTheme.ts`).

   WHAT IT DOES. It takes ONE ROW out of the table in section 2 of the policy, „Podaci koji nastaju samim posećivanjem" in Serbian and
   its English twin, the row that begins „Izbor svetle ili tamne teme (`btl-theme`, lokalno skladište)" and „Choice of light or dark
   theme (`btl-theme`, local storage)". No word is added and no word of any other row is touched.

   WHAT IT DOES NOT DO, AND THIS IS THE OPEN PART. Section 4 of the policy, „Kolačići i lokalno skladište", has a paragraph of its own that
   says the same thing in a sentence: „Pored kolačića, u tvom pregledaču se čuva i još nešto: izbor svetle ili tamne teme, pod imenom
   `btl-theme`, u lokalnom skladištu. [...]" (and its English twin „Besides the cookie, something else is kept in your browser: [...]").
   The decision names a ROW, and a paragraph is not a row, so it is left exactly as it is, and after this file the policy no longer lists
   the choice of theme in section 2 while section 4 still says it is kept. That is the owner's to decide and it is written to him in the
   description of the pull request; nothing here guesses it.

   THE SIGN-OFF MOVES, AND ONLY THE POLICY'S. PDL, „Datum Poslednja izmena na pravnom tekstu pomera se uvek kad se reči tog teksta
   promene, na dan kad izmena stiže na QA" (owner, 07.11.2026), with the addition of 14.11.2026 that the day moves in both languages.
   The words of the policy change here (a row goes), so „Poslednja izmena: 21.11.2026." (V107) becomes „Poslednja izmena: 24.11.2026."
   and „Last amended: 21.11.2026." becomes „Last amended: 24.11.2026." (section 7). The terms and the rulebook keep 21.11.2026. THIS IS
   DERIVED FROM THAT RECORDED RULE, not from a word of the owner about this change.

   THE DAY IS WRITTEN AS THE DAY IT IS EXPECTED. 24.11.2026 is the day this file is written and expected on QA. If it reaches QA on
   another day, the date is moved before the merge, in this file and in every place that holds it, which ADL A2 allows because the file
   has not been applied anywhere.

   HOW. The shape of V102: every edit is asked how many times its old text stands in the text it is aimed at, and anything but exactly
   once is a problem. A section that already carries the new text is a problem too, asked of the section with the old text taken out
   first. The edits are all asked and not stopped at the first problem; if there is any, one error lists every edit and what it found,
   the statement is rolled back with nothing changed, and Flyway refuses to start the backend. A replace() that matched nothing would be
   recorded as a migration that succeeded while the old text went on being published (V57 has the whole argument).

   WHY EACH OLD TEXT RUNS ON TO THE NEXT ROW. A row that goes would have an empty new text, and the question „does the section already
   hold the new text" asked of an empty text is always yes, so every run would be a problem. The old text is the row that goes together
   with the row after it, and the new text is that next row alone: it is asked of the section with the pair taken out, where it is not,
   and a section that already lost the row does not hold the pair, so a second run is refused by name and not reported as a success.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row of a table added or removed; section 2 and section 7 of the
   policy in two languages, and in them only the one row of the table and the date. The terms, the rulebook and the president's word are
   not touched, and the terms and the rulebook keep their sign-off of 21.11.2026.

   WHY A NEW FILE AND NOT AN EDIT OF V44 OR V107: ADL A2. They have been applied, their checksums are in flyway_schema_history, and
   MigrationsAreImmutableTest holds Flyway to it. V110 and not another number: main stood at V109 on 24.11.2026 and no open pull request
   carries a migration.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian answer of this
   server to, field by field; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that fixture to in the
   other direction; and TheWrittenPagesLoseTheRowAboutTheThemeTest and its carried-over twin, for every edit. */

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

            ('THEME-01 section 2', 'politika-privatnosti', 2, 'sr',
             $old$| Izbor svetle ili tamne teme (`btl-theme`, lokalno skladište) | Da te portal otvori u temi koju izabereš | Neophodno za pruženu uslugu, jer ga izabereš | Dok ga ne obrišeš |
| Bezbednosni kolačić | Bez njega slanje obrasca ne može bezbedno da radi | Neophodno za pruženu uslugu | Do kraja posete |$old$,
             $new$| Bezbednosni kolačić | Bez njega slanje obrasca ne može bezbedno da radi | Neophodno za pruženu uslugu | Do kraja posete |$new$),

            ('THEME-01 section 2', 'politika-privatnosti', 2, 'en',
             $old$| Choice of light or dark theme (`btl-theme`, local storage) | So the portal opens in the theme you chose | Necessary for the service provided, since you choose it yourself | Until you delete it yourself |
| Security cookie | Without it, submitting a form cannot work safely | Necessary for the service provided | Until the end of the visit |$old$,
             $new$| Security cookie | Without it, submitting a form cannot work safely | Necessary for the service provided | Until the end of the visit |$new$),

            ('THEME-02 sign-off', 'politika-privatnosti', 7, 'sr',
             $old$Poslednja izmena: 21.11.2026.$old$,
             $new$Poslednja izmena: 24.11.2026.$new$),

            ('THEME-02 sign-off', 'politika-privatnosti', 7, 'en',
             $old$Last amended: 21.11.2026.$old$,
             $new$Last amended: 24.11.2026.$new$)

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
