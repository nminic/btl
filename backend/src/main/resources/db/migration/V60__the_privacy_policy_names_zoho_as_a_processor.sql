/* THE PRIVACY POLICY NAMES ZOHO AS A PROCESSOR, IN SERBIAN AND IN ENGLISH, AND IS SIGNED OFF ON 18.10.2026.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry "Nove reči dopune politike za Zoho (američki region)"
   (owner, 17.10.2026, who answered "Odobravam" among the outcomes offered, on the assistant's recommendation). The
   mailbox info@ is a real mailbox at Zoho from 17.10.2026 (ADL, the entry on the mailbox info@, "SPROVEDENO
   17.10.2026": the MX records, the SPF record and the DKIM record are Zoho's), so a processor that receives the
   address and the content of the messages of whoever writes to the league is not named in the policy until this
   file runs. The account stays on Zoho's American server (ADL, the clarification of the same day), which is why the
   third column says the United States and not the Netherlands: the words the owner approved first, "Zoho
   Corporation B.V." and "Holandija", were struck out the same day for that reason and are NOT written here.

   THE WORDS ARE THE OWNER'S, character for character, and nothing else is written about Zoho.
     Serbian:  | Zoho Corporation | Prepiska sa adresom info@: vaša adresa i sadržaj poruka | SAD |
     English:  | Zoho Corporation | Correspondence with info@: your address and the content of the messages | USA |
   The English says "messages" and the row above it says "the message"; both are the owner's, and the one is not
   made to agree with the other.

   WHERE. One row, in section 5 of the privacy policy ("Koliko čuvamo i kome prosleđujemo" / "How long we keep it
   and who we pass it to"), in the table of processors, directly under the row for Brevo and above the row for the
   Association's bank. The sentence under the table that speaks of transfers outside the European Union is not
   touched; the owner's entry says it stays as it is.

   THE SIGN-OFF DATE. The same entry: "Datum Poslednja izmena se pomera na dan kad izmena stigne na QA". The
   privacy policy is the only document whose text changes here, so only its "Poslednja izmena: 16.10.2026." (V58
   wrote that date) becomes "Poslednja izmena: 18.10.2026." and "Last amended: 16.10.2026." becomes "Last amended:
   18.10.2026.". The terms of use keep 10.10.2026 and the rulebook keeps 16.10.2026, because their text does not
   change in this file (the reasoning of PDL, "Datum Poslednja izmena se pomera" of 16.10.2026, which did the same
   for the terms). 18.10.2026 is a day chosen by the person who asked for this file as the day it reaches QA; it is
   not the owner's own word, and it is moved before the merge if the file reaches QA on another day.

   ORDER. The row says that the correspondence of info@ goes to Zoho, which is true once the MX records point
   there. They do, since 17.10.2026 (ADL, as above), so this file does not publish a processor ahead of its use.
   The legal name is a thing the owner still checks in Zoho's data processing agreement (PDL, the same entry: "ako
   se razlikuje, upisuje se ono što tamo piše"); if it differs, that is another migration with its own words.

   HOW. The shape of V58 and for its reason: every edit is asked how many times its old text stands in the text it
   is aimed at, and anything but exactly once is a problem. One question is added to that, because the two row
   edits leave their old text standing (the row for Brevo is still there after the row is added): a section that
   already carries the new text is a problem too, otherwise a second run would find the row for Brevo once and put
   the row for Zoho in again. The edits are all asked and not stopped at the first problem; if there is any, one
   error lists every edit and what it found, the statement is rolled back with nothing changed, and Flyway refuses
   to start the backend. A replace() that matched nothing would be recorded as a migration that succeeded while the
   old text went on being published (V57 has the whole argument).

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of four
   section texts (two for the row, two for the date) and nothing else in them.

   WHY A NEW FILE AND NOT AN EDIT OF V24, V41, V43 OR V58: ADL A2. They have been applied, their checksums are in
   flyway_schema_history, and MigrationsAreImmutableTest holds Flyway to them.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the
   Serbian answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which
   writtenVerification.test.ts holds that fixture to in the other direction; the sign-off check of
   writtenPages.test.tsx, which names the day of each of the three documents; the two guards that name the policy's
   date, TheWrittenPagesCarryTheEditsOfTheTenthOfOctoberTest and
   TheWrittenPagesSayThatTheCategoryRevealsTheYearOfBirthTest, which now say 18.10.2026 for the policy; and, for
   both languages and for every edit, TheWrittenPagesNameZohoAsAProcessorTest. */

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

            ('Zoho', 'politika-privatnosti', 5, 'sr',
             $old$| Brevo (Sendinblue SAS) | Vaša adresa i sadržaj poruke | Francuska |$old$,
             $new$| Brevo (Sendinblue SAS) | Vaša adresa i sadržaj poruke | Francuska |
| Zoho Corporation | Prepiska sa adresom info@: vaša adresa i sadržaj poruka | SAD |$new$),
            ('Zoho', 'politika-privatnosti', 5, 'en',
             $old$| Brevo (Sendinblue SAS) | Your address and the content of the message | France |$old$,
             $new$| Brevo (Sendinblue SAS) | Your address and the content of the message | France |
| Zoho Corporation | Correspondence with info@: your address and the content of the messages | USA |$new$),

            ('Zoho date', 'politika-privatnosti', 7, 'sr',
             $old$Poslednja izmena: 16.10.2026.$old$,
             $new$Poslednja izmena: 18.10.2026.$new$),
            ('Zoho date', 'politika-privatnosti', 7, 'en',
             $old$Last amended: 16.10.2026.$old$,
             $new$Last amended: 18.10.2026.$new$)

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

        /* The two edits that ADD a row leave their old text standing once the edit has been made. That is what makes
           them unlike a replacement, which finds nothing the second time: run over a section that already carries the
           row they would find their anchor once and put the row in again. So the new text is asked about too, for
           every edit, and a section that already holds it is a problem. */
        already := strpos(current_body, edit.new_text) > 0;

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
