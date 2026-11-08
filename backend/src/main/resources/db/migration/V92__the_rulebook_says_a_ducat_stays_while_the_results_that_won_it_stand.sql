/* THE RULEBOOK SAYS THAT A DUCAT STAYS FOR AS LONG AS THE RESULTS THAT WON IT STAND, AND ITS SIGN-OFF MOVES TO 09.11.2026, IN
   SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry "Pravilnik, odeljak 18, dobija rečenicu" (owner, 08.11.2026,
   chosen with the assistant's recommendation). Section 18 of the rulebook (Dukati) says, since V78,

     "Osvojeni dukati ostaju u trajnom vlasništvu profila, osim u slučaju brisanja istog."

   and it becomes, in the words the assistant wrote and the owner approved,

     "Dukat ostaje dok stoje rezultati koji su ga doneli. Mesečni i sezonski dukat zamrznute sezone ostaje trajno."

   The English is the translation of those two sentences and is the assistant's, in the style V78 gave the sentence it
   replaces ("Won ducats remain in the permanent ownership of the profile, except in the case of its deletion."):

     "A ducat stays for as long as the results that won it stand. A monthly and a seasonal ducat of a frozen season stays
      for good."

   THE SIGN-OFF OF THE RULEBOOK MOVES, AND ONLY THE RULEBOOK'S. PDL, "Datum Poslednja izmena na pravnom tekstu pomera se
   uvek kad se reči tog teksta promene" (owner, 07.11.2026): the date moves whenever the words of a legal text change, to the
   day the change reaches QA, and does not move when the words do not change. The words of the rulebook change here, so its
   "Poslednja izmena: 30.10.2026." (V80) becomes "Poslednja izmena: 09.11.2026." and "Last amended: 30.10.2026." becomes
   "Last amended: 09.11.2026." (section 19). The terms (29.10.2026) and the policy (08.11.2026, V90) are not touched and keep
   theirs.

   THE DAY IS NOT KNOWN YET, AND IS WRITTEN AS THE DAY IT IS EXPECTED. This pull request goes to QA on the day the pull request
   that starts taking ducats away goes, and that day was not fixed when this was written. 09.11.2026 is the day expected. If
   the file reaches QA on another day, the date is moved before the merge, in this file and in every place that holds it,
   which ADL A2 allows because the file has not been applied anywhere.

   WHEN IT MUST REACH QA. The same decision of 08.11.2026 says it goes with a migration on the same day the portal starts
   taking ducats away.

   HOW. The shape of V78, V80 and V89: every edit is asked how many times its old text stands in the text it is aimed at, and
   anything but exactly once is a problem. A section that already carries the new text is a problem too, asked of the
   section with the old text taken out first, as in V77 and V89. The edits are all asked and not stopped at the first
   problem; if there is any, one error lists every edit and what it found, the statement is rolled back with nothing
   changed, and Flyway refuses to start the backend. A replace() that matched nothing would be recorded as a migration that
   succeeded while the old text went on being published (V57 has the whole argument).

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of two section texts
   of the rulebook (sections 18 and 19, in both languages) and in them only the one sentence and the date. Not the paragraphs
   before and after the ducat sentence, not the gallery after them.

   WHY A NEW FILE AND NOT AN EDIT OF V78 OR V80: ADL A2. They have been applied, their checksums are in
   flyway_schema_history, and MigrationsAreImmutableTest holds Flyway to them. V92 and not another number: main stood at V90 on
   08.11.2026 (1eea9c16) and V91 was taken by an open pull request.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which
   writtenVerification.test.ts holds that fixture to in the other direction; and
   TheWrittenPagesSayThatADucatStaysWhileItsResultsStandTest and its carried-over twin, for both languages and for every
   edit. */

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

            ('DUCAT-01 section 18', 'pravilnik', 18, 'sr',
             $old$Osvojeni dukati ostaju u trajnom vlasništvu profila, osim u slučaju brisanja istog.$old$,
             $new$Dukat ostaje dok stoje rezultati koji su ga doneli. Mesečni i sezonski dukat zamrznute sezone ostaje trajno.$new$),

            ('DUCAT-01 section 18', 'pravilnik', 18, 'en',
             $old$Won ducats remain in the permanent ownership of the profile, except in the case of its deletion.$old$,
             $new$A ducat stays for as long as the results that won it stand. A monthly and a seasonal ducat of a frozen season stays for good.$new$),

            ('DUCAT-02 sign-off', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 30.10.2026.$old$,
             $new$Poslednja izmena: 09.11.2026.$new$),

            ('DUCAT-02 sign-off', 'pravilnik', 19, 'en',
             $old$Last amended: 30.10.2026.$old$,
             $new$Last amended: 09.11.2026.$new$)

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
