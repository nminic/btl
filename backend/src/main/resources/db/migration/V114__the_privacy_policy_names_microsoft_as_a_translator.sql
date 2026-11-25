/* THE PRIVACY POLICY NAMES MICROSOFT (AZURE TRANSLATOR) AS A PROCESSOR, IN SERBIAN AND IN ENGLISH, AND ITS SIGN-OFF MOVES TO 25.11.2026.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL P18, the entry „Red u Politici privatnosti, odeljak 5" (owner, 25.11.2026, approved the
   assistant's proposal without a change: „Upiši ovako"). THE WORDS ARE THE ASSISTANT'S AND THE OWNER APPROVED THEM; they are written
   here exactly as he approved them, with no word and no mark of punctuation changed. The entry reads:

     Serbian:  | Microsoft (usluga Azure Translator) | Tekst koji je odobren za objavu na portalu (tvoja biografija, opis tima, opis događaja, odobren komentar), da bi ga posetilac video i na drugom jeziku. Ne dobija tvoje ime, adresu ni članski broj, i ne čuva tekst posle prevoda | EU |
     English:  | Microsoft (Azure Translator service) | Text approved for publication on the portal (your biography, team description, event description, an approved comment), so that a visitor can also read it in another language. It does not receive your name, address or member number, and does not keep the text after translating it | EU |

   WHAT IT DOES. First, it adds ONE ROW to the table „Kome prosleđujemo" / „Who we pass it to" in section 5 of the policy, directly under
   the row for Zoho Corporation and directly above the row for the Association's bank, in each language. No word of any other row is
   touched. Second, the day of the policy's sign-off moves in both languages: „Poslednja izmena: 24.11.2026." (V110) becomes
   „Poslednja izmena: 25.11.2026.", and „Last amended: 24.11.2026." becomes „Last amended: 25.11.2026." (section 7). The terms and the
   rulebook keep 21.11.2026. The day moves by the recorded rule of the owner of 07.11.2026 („Datum Poslednja izmena na pravnom tekstu
   pomera se uvek kad se reči tog teksta promene, na dan kad izmena stiže na QA"), with the addition of 14.11.2026 that it moves in both
   languages; the precedent is V110.

   THE DAY IS WRITTEN AS THE DAY IT IS EXPECTED. 25.11.2026 is the day this file is written and expected on QA. If it reaches QA on
   another day, the date is moved before the merge, in this file and in every place that holds it, which ADL A2 allows because the file
   has not been applied anywhere.

   HOW. The shape of V110: every edit is asked how many times its old text stands in the text it is aimed at, and anything but exactly
   once is a problem. A section that already carries the new text is a problem too, asked of the section with the old text taken out
   first. The edits are all asked and not stopped at the first problem; if there is any, one error lists every edit and what it found,
   the statement is rolled back with nothing changed, and Flyway refuses to start the backend. A replace() that matched nothing would be
   recorded as a migration that succeeded while the old text went on being published (V57 has the whole argument), so a database that
   does not hold the row of Zoho, followed by the row of the bank, stops the migration; it does not skip the edit.

   WHY THE OLD TEXT IS TWO ROWS. The new row is added by replacing the row of Zoho together with the row of the bank by the same two
   rows with the new one between them. Were the old text the row of Zoho alone, the new text would contain it, the question „does the
   section already hold the new text" would be asked after the old text was taken out and could never be yes, and a second run would
   add the row a second time. With the pair as the old text, a section that already holds the row does not hold the pair, and a second
   run is refused by name.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row of a table added or removed; sections 5 and 7 of the
   policy in two languages, and in them only the one row of the table and the day. The terms, the rulebook and the president's word are
   not touched.

   WHY A NEW FILE AND NOT AN EDIT OF V60, V107 OR V110: ADL A2. They have been applied, their checksums are in flyway_schema_history,
   and MigrationsAreImmutableTest holds Flyway to it. V114 and not another number: main stood at V112 on 25.11.2026 and the pull request
   with the translation (835) takes V113. If that pull request is merged after this one, the number is changed then.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian answer of this
   server to, field by field; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that fixture to in the
   other direction; and TheWrittenPagesNameMicrosoftAsATranslatorTest and its carried-over twin, for every edit. */

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

            ('MICROSOFT-01 section 5', 'politika-privatnosti', 5, 'sr',
             $old$| Zoho Corporation | Prepiska sa adresom info@: tvoja adresa i sadržaj poruka | SAD |
| Poslovna banka Udruženja | Podaci sa naloga za uplatu | Srbija |$old$,
             $new$| Zoho Corporation | Prepiska sa adresom info@: tvoja adresa i sadržaj poruka | SAD |
| Microsoft (usluga Azure Translator) | Tekst koji je odobren za objavu na portalu (tvoja biografija, opis tima, opis događaja, odobren komentar), da bi ga posetilac video i na drugom jeziku. Ne dobija tvoje ime, adresu ni članski broj, i ne čuva tekst posle prevoda | EU |
| Poslovna banka Udruženja | Podaci sa naloga za uplatu | Srbija |$new$),

            ('MICROSOFT-01 section 5', 'politika-privatnosti', 5, 'en',
             $old$| Zoho Corporation | Correspondence with info@: your address and the content of the messages | USA |
| The Association's business bank | Data from the payment order | Serbia |$old$,
             $new$| Zoho Corporation | Correspondence with info@: your address and the content of the messages | USA |
| Microsoft (Azure Translator service) | Text approved for publication on the portal (your biography, team description, event description, an approved comment), so that a visitor can also read it in another language. It does not receive your name, address or member number, and does not keep the text after translating it | EU |
| The Association's business bank | Data from the payment order | Serbia |$new$),

            ('MICROSOFT-02 sign-off', 'politika-privatnosti', 7, 'sr',
             $old$Poslednja izmena: 24.11.2026.$old$,
             $new$Poslednja izmena: 25.11.2026.$new$),

            ('MICROSOFT-02 sign-off', 'politika-privatnosti', 7, 'en',
             $old$Last amended: 24.11.2026.$old$,
             $new$Last amended: 25.11.2026.$new$)

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
