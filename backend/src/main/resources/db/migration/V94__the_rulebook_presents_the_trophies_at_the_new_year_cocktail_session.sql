/* THE RULEBOOK SAYS THE TROPHIES ARE PRESENTED AT THE ASSOCIATION'S NEW YEAR COCKTAIL SESSION, IN SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, "Flajer A6 (dve strane, i za Facebook)" (owner, 10.11.2026): "Ekskluzivni pehar i
   medalje na novogodišnjoj koktel sednici udruženja", chosen with the assistant's recommendation, and the rulebook's Article 56
   ("Pehari se uručuju na ceremoniji spojenoj sa BTL dezorijentiringom.") "se menja istog dana". The entry under "Preuzimanje i
   isporuka nagrada" repeats it, and the words are approved by the owner before the merge (P32).

   THE ONE SENTENCE. Article 56 (section 14) says, since V24 (V43 in English), and V71 only renumbered its heading,

     "Pehari se uručuju na ceremoniji spojenoj sa BTL dezorijentiringom."

   and it becomes, in the assistant's proposal as the owner approved it with one change ("po preporuci, Pehari i nagrade"),

     "Pehari i nagrade se uručuju na novogodišnjoj koktel sednici Udruženja."

   The English is the same change to the translation, in the tone of the rest of the article:
   "Trophies and prizes are presented at the Association's New Year cocktail session."

   THE MEDALS ARE LEFT OUT ON PURPOSE. Article 57 says the finisher's medal is sent by post ("Poštanske troškove slanja majice i
   medalje snosi član."), so the sentence names the trophies and the prizes and not the medals.

   WHAT THE PAGES DO NOT SAY. No other text of the pages says where the trophies are presented: the terms of use lost their
   section on awards in V77 and name the ceremony nowhere, and Article 57 says how a trophy is collected, not where it is
   handed over. The sign-off of the rulebook is NOT touched: V93 already moved it to 10.11.2026, the day this is written and
   the day it is expected on QA. If the file reaches QA on a later day, the sign-off is moved before the merge, by one more
   edit in this file, which ADL A2 allows because the file has not been applied anywhere.

   AN OPEN PULL REQUEST EDITS THE SAME SIGN-OFF. Pull request 707 (V92 there) moves the rulebook's sign-off to 09.11.2026 and
   is paused. This file is written against main as it stands (V93, c5e9052f) and does not touch the sign-off.

   HOW. The shape of V93, V90 and V80: every edit is asked how many times its old text stands in the text it is aimed at, and
   anything but exactly once is a problem. A section that already carries the new text is a problem too, asked of the section
   with the old text taken out first. The edits are all asked and not stopped at the first problem; if there is any, one error
   lists every edit and what it found, the statement is rolled back with nothing changed, and Flyway refuses to start the
   backend.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of two section texts
   of the rulebook (section 14, in both languages) and in them only the one sentence.

   WHY A NEW FILE AND NOT AN EDIT OF V24 OR V43: ADL A2. They have been applied, their checksums are in flyway_schema_history,
   and MigrationsAreImmutableTest holds Flyway to them.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian answer
   of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that
   fixture to in the other direction; and TheTrophiesAreHandedOutAtTheCocktailSessionCarriedOverTest, over the text that was
   already there. */

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

            ('TRO-01 Article 56', 'pravilnik', 14, 'sr',
             $old$Pehari se uručuju na ceremoniji spojenoj sa BTL dezorijentiringom.$old$,
             $new$Pehari i nagrade se uručuju na novogodišnjoj koktel sednici Udruženja.$new$),

            ('TRO-01 Article 56', 'pravilnik', 14, 'en',
             $old$Trophies are presented at a ceremony joined with the BTL dezorijentiring.$old$,
             $new$Trophies and prizes are presented at the Association's New Year cocktail session.$new$)

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
