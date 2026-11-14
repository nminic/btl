/* THE RULEBOOK NAMES THE ROOKIE CATEGORY IN ENGLISH WITH THE LETTER OF THE GENDER IN FRONT, AND ITS SIGN-OFF MOVES TO 14.11.2026, IN
   SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, section "Početnička kategorija", the entry of 13.11.2026 (owner, chosen among
   the ones offered, with the assistant's recommendation): "Na engleskom početnička kategorija se zove „M Rookies” i „F
   Rookies”, na svim tabelama i listama i u engleskom Članu 36: pun naziv, kao „Početnici” i „Početnice” na srpskom, uz slovo
   pola ispred, jer `rookie` ne razlikuje rod." It overturns the entry of 07.11.2026 ("M R" and "F R").

   WHAT THE TEXT SAID, AND WHAT IT SAYS. Article 36 in English (section position 8, since V71) says "When you join, you choose
   whether to compete in the rookie category (Rookies) or in your own age category." The Serbian of the same sentence names
   both words: "(Početnici, Početnice)". The English becomes "(M Rookies, F Rookies)", the two names the tables carry. The
   Serbian text is not touched: it already says it as the decision asks. The later sentence "Rookies have their own rankings"
   speaks of the people and not of a category's name, and it stays.

   THE SIGN-OFF OF THE RULEBOOK MOVES, AND ONLY THE RULEBOOK'S. PDL, "Datum Poslednja izmena na pravnom tekstu pomera se
   uvek kad se reči tog teksta promene" (owner, 07.11.2026): the date moves whenever the words of a legal text change, to the
   day the change reaches QA. The words of the rulebook change here, so "Poslednja izmena: 12.11.2026." (V96) becomes
   "Poslednja izmena: 14.11.2026." and "Last amended: 12.11.2026." becomes "Last amended: 14.11.2026." (section 19). Both
   languages move, as in V93 and V96: the sign-off is the rulebook's, not a language's. The terms and the policy (11.11.2026
   since V95) keep theirs.

   THE DAY IS WRITTEN AS THE DAY IT IS EXPECTED. 14.11.2026 is the day this file is expected to reach QA. If it reaches QA on
   another day, the date is moved before the merge, in this file and in every place that holds it, which ADL A2 allows
   because the file has not been applied anywhere.

   HOW. The shape of V93, V94, V95 and V96: every edit is asked how many times its old text stands in the text it is aimed
   at, and anything but exactly once is a problem. A section that already carries the new text is a problem too, asked of
   the section with the old text taken out first. The edits are all asked and not stopped at the first problem; if there is
   any, one error lists every edit and what it found, the statement is rolled back with nothing changed, and Flyway refuses
   to start the backend. A replace() that matched nothing would be recorded as a migration that succeeded while the old text
   went on being published (V57 has the whole argument).

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of two section texts
   of the rulebook (Article 36 in English, and the sign-off in both languages) and in them only the one phrase and the date.

   WHY A NEW FILE AND NOT AN EDIT OF V71 OR V96: ADL A2. They have been applied, their checksums are in
   flyway_schema_history, and MigrationsAreImmutableTest holds Flyway to them. V98 and not another number: V97 is taken.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which
   writtenVerification.test.ts holds that fixture to in the other direction; and
   TheWrittenPagesNameTheRookiesWithTheLetterOfTheGenderTest and its carried-over twin, for every edit. */

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

            ('ROOKIE-01 article 36', 'pravilnik', 8, 'en',
             $old$the rookie category (Rookies) or in your own age category$old$,
             $new$the rookie category (M Rookies, F Rookies) or in your own age category$new$),

            ('ROOKIE-02 sign-off', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 12.11.2026.$old$,
             $new$Poslednja izmena: 14.11.2026.$new$),

            ('ROOKIE-02 sign-off', 'pravilnik', 19, 'en',
             $old$Last amended: 12.11.2026.$old$,
             $new$Last amended: 14.11.2026.$new$)

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
