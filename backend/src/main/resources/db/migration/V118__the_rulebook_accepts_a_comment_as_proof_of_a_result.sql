/* THE RULEBOOK SAYS THAT A RESULT MAY BE PROVED BY A COMMENT ALONE, IN ARTICLES 33 AND 35, IN SERBIAN AND IN ENGLISH, AND ITS
   SIGN-OFF MOVES TO 28.11.2026.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry of 28.11.2026 „Pravilnik o tekstu kao dokazu" (owner, 28.11.2026: „Potvrđujem
   član 35 i 33."; THE WORDS ARE THE ASSISTANT'S PROPOSAL AND THE OWNER APPROVED THEM WITHOUT A CHANGE, and they are written here exactly
   as he approved them, with no word and no mark of punctuation changed). The entry reads:

     Article 35 („Dokazi") gets a THIRD sentence, between the second one and „Sliku brišemo čim proverimo rezultat.":
       „Ako nemaš ni link ni sliku, dovoljno je da u komentaru napišeš odakle je rezultat, na primer ko je merio i gde je objavljen."
     Article 33 („Kako se prijavljuje rezultat"): „…vreme i link ka zvaničnim rezultatima." becomes
       „…vreme i dokaz: link ka zvaničnim rezultatima, sliku ili komentar."
     The terms of use (section 5) only point to the rulebook and are not changed.

   THE ENGLISH IS THE ASSISTANT'S, in the same sense and in the register of the English that stands (Article 35, since V77: „A link to the
   official results is enough. If you do not have one, send a picture, ..."; Article 33, since V71, names „a link to the official results"):

     Article 35, third sentence: „If you have neither a link nor a picture, it is enough to write in a comment where the result comes
       from, for example who timed it and where it was published."
     Article 33: „the time, and the evidence: a link to the official results, a picture, or a comment."
     („dokaz" is „evidence", the word the English heading of Article 35 has had since V71.)

   THE SIGN-OFF OF THE RULEBOOK MOVES, AND ONLY THE RULEBOOK'S. PDL, „Datum Poslednja izmena na pravnom tekstu pomera se uvek kad se
   reči tog teksta promene" (owner, 07.11.2026): the date moves whenever the words of a legal text change, to the day the change reaches
   QA, in both languages (owner, 14.11.2026). The words of the rulebook change here, so „Poslednja izmena: 21.11.2026." (V93, V80, V77
   before it) becomes „Poslednja izmena: 28.11.2026." and „Last amended: 21.11.2026." becomes „Last amended: 28.11.2026." (section 19).
   The owner's entry names the two articles and says nothing of the day; the move is the recorded rule's and the precedent's (V96, V98,
   V114), and it is the one thing this migration does that the entry does not spell out. The terms (21.11.2026) and the policy
   (25.11.2026) are not touched and keep theirs.

   THE DAY IS WRITTEN AS THE DAY IT IS EXPECTED. 28.11.2026 is the day this file is written and expected on QA. If it reaches QA on
   another day, the date is moved before the merge, in this file and in every place that holds it, which ADL A2 allows because the file
   has not been applied anywhere.

   HOW. The shape of V114: every edit is asked how many times its old text stands in the text it is aimed at, and anything but exactly
   once is a problem. A section that already carries the new text is a problem too, asked of the section with the old text taken out
   first. The edits are all asked and not stopped at the first problem; if there is any, one error lists every edit and what it found,
   the statement is rolled back with nothing changed, and Flyway refuses to start the backend. A replace() that matched nothing would be
   recorded as a migration that succeeded while the old text went on being published (V57 has the whole argument). THE STATIC PAGES
   ARE NOT EDITED THROUGH ANY SCREEN: the only door to static_page_section is a migration and PageApi only reads (GET /api/pages), so
   no text can have been changed by hand since V114; a database whose text is not the text this was written against stops the
   migration, it does not skip the edit.

   WHY THE OLD TEXT OF ARTICLE 35 IS TWO SENTENCES. The third sentence goes BETWEEN the second and the sentence about the picture, so the
   old text is the end of the second sentence followed by the last one, and the new text is the same two with the new sentence between.
   The new text does not contain the old text, so the question "does the section already hold the new text" can be answered yes, and a
   second run is refused by name.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of two section texts of the
   rulebook (section 9 and the sign-off in section 19, in both languages) and in them only the one phrase, the one sentence and the day.
   Not the terms, not the policy, not the rest of Article 33 or 35.

   WHY A NEW FILE AND NOT AN EDIT OF V71, V77 OR V107: ADL A2. They have been applied, their checksums are in flyway_schema_history, and
   MigrationsAreImmutableTest holds Flyway to them. V118 and not another number: main stood at V117 on 28.11.2026.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian answer of this
   server to, field by field; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that fixture to in
   the other direction; and TheWrittenPagesAcceptACommentAsProofTest and its carried-over twin, for every edit. */

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

            ('PROOF-01 Article 33', 'pravilnik', 9, 'sr',
             $old$vreme i link ka zvaničnim rezultatima.$old$,
             $new$vreme i dokaz: link ka zvaničnim rezultatima, sliku ili komentar.$new$),

            ('PROOF-01 Article 33', 'pravilnik', 9, 'en',
             $old$the time, and a link to the official results.$old$,
             $new$the time, and the evidence: a link to the official results, a picture, or a comment.$new$),

            ('PROOF-02 Article 35', 'pravilnik', 9, 'sr',
             $old$šta se na slici vidi. Sliku brišemo čim proverimo rezultat.$old$,
             $new$šta se na slici vidi. Ako nemaš ni link ni sliku, dovoljno je da u komentaru napišeš odakle je rezultat, na primer ko je merio i gde je objavljen. Sliku brišemo čim proverimo rezultat.$new$),

            ('PROOF-02 Article 35', 'pravilnik', 9, 'en',
             $old$what the picture shows. We delete the picture as soon as we have checked the result.$old$,
             $new$what the picture shows. If you have neither a link nor a picture, it is enough to write in a comment where the result comes from, for example who timed it and where it was published. We delete the picture as soon as we have checked the result.$new$),

            ('PROOF-03 sign-off', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 21.11.2026.$old$,
             $new$Poslednja izmena: 28.11.2026.$new$),

            ('PROOF-03 sign-off', 'pravilnik', 19, 'en',
             $old$Last amended: 21.11.2026.$old$,
             $new$Last amended: 28.11.2026.$new$)

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
