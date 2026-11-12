/* THE RULEBOOK SAYS THE TRANSFER WINDOW FOR TEAMS OPENS ON 21 NOVEMBER, AND ITS SIGN-OFF MOVES TO 10.11.2026, IN SERBIAN AND
   IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, "Ciklus od 21. novembra (10.11.2026)": "Pomeri period prvog uclanjenja i
   starta portala zvanicno sa 11.11. na 21.11.", and, chosen with the assistant's recommendation, "Sve što se otvaralo 11.11.
   pomera se na 21.11.", the transfer window for teams and pairs among it ("21. novembar do 31. decembar"). The entry also says
   that the rulebook, the terms and the screens carry dates in their public text and change by migration, in words the owner
   approves before the merge (P32).

   THE ONE SENTENCE. Article 49 (section 12) says, since V76, in the owner's own words of 27.10.2026,

     "Prelazni rok za timove je od 11. novembra do 31. decembra."

   and it becomes, with the day and nothing else changed (the assistant's proposal, put to the owner before the merge),

     "Prelazni rok za timove je od 21. novembra do 31. decembra."

   The English is the same change to the translation: "The transfer window for teams runs from 21 November to 31 December."
   The sentence after it ("Ulazak ili izlazak iz tima su dozvoljeni samo tokom prelaznog roka.") does not name a day and is not
   touched.

   WHAT THE PAGES DO NOT SAY. The days of the price periods are drawn on the page from the price table (V92), so Article 11
   ("Cenovnik se sa istim rokovima ponavlja svake sezone.") does not repeat them and is not touched. No page names 11
   November after this file, and none names a day before 21 November or the exception of 2026 (owner, 10.11.2026: "nigde na
   sajtu se ne pominje nijedan datum pre 21.11."). The terms of use and the privacy policy name none of the cycle's days (read
   out of the text the portal serves) and are not touched.

   THE SIGN-OFF OF THE RULEBOOK MOVES, AND ONLY THE RULEBOOK'S. PDL, "Datum Poslednja izmena na pravnom tekstu pomera se uvek
   kad se reči tog teksta promene" (owner, 07.11.2026): the date moves whenever the words of a legal text change, to the day the
   change reaches QA. "Poslednja izmena: 30.10.2026." (V80) becomes "Poslednja izmena: 10.11.2026." and "Last amended:
   30.10.2026." becomes "Last amended: 10.11.2026." (section 19). 10.11.2026 is the day this was written and the day it is
   expected; if the file reaches QA on another day, the date is moved before the merge, in this file and in every place that
   holds it, which ADL A2 allows because the file has not been applied anywhere.

   AN OPEN PULL REQUEST EDITS THE SAME SIGN-OFF. Pull request 707 (V92 there) moves the rulebook's sign-off from 30.10.2026 to
   09.11.2026. Whichever of the two is merged second has to take the other's date as its old text and its own next number;
   this file is written against main as it stands (V91, 47bb2d28).

   HOW. The shape of V90, V89 and V80: every edit is asked how many times its old text stands in the text it is aimed at, and
   anything but exactly once is a problem. A section that already carries the new text is a problem too, asked of the section
   with the old text taken out first. The edits are all asked and not stopped at the first problem; if there is any, one error
   lists every edit and what it found, the statement is rolled back with nothing changed, and Flyway refuses to start the
   backend.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of four section texts
   of the rulebook (sections 12 and 19, in both languages) and in them only the one sentence and the date.

   WHY A NEW FILE AND NOT AN EDIT OF V76 OR V80: ADL A2. They have been applied, their checksums are in flyway_schema_history,
   and MigrationsAreImmutableTest holds Flyway to them.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian answer
   of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that
   fixture to in the other direction; TheWrittenPagesOpenOnTheElevenOfNovemberTest, which holds the day of the sentence to the
   day price_row opens the cycle on, in both languages; and TheCycleOf21NovemberCarriedOverTest, over the text that was already
   there. */

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

            ('CYC-01 Article 49', 'pravilnik', 12, 'sr',
             $old$Prelazni rok za timove je od 11. novembra do 31. decembra.$old$,
             $new$Prelazni rok za timove je od 21. novembra do 31. decembra.$new$),

            ('CYC-01 Article 49', 'pravilnik', 12, 'en',
             $old$The transfer window for teams runs from 11 November to 31 December.$old$,
             $new$The transfer window for teams runs from 21 November to 31 December.$new$),

            ('CYC-02 sign-off', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 30.10.2026.$old$,
             $new$Poslednja izmena: 10.11.2026.$new$),

            ('CYC-02 sign-off', 'pravilnik', 19, 'en',
             $old$Last amended: 30.10.2026.$old$,
             $new$Last amended: 10.11.2026.$new$)

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
