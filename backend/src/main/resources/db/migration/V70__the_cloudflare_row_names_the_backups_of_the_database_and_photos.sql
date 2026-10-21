/* THE ROW OF THE PRIVACY POLICY THAT NAMES CLOUDFLARE ALSO NAMES THE STORAGE OF THE ENCRYPTED BACKUPS, IN SERBIAN AND IN
   ENGLISH, AND THE POLICY IS SIGNED OFF ON 22.10.2026.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry "Red o Cloudflare-u u politici privatnosti postaje" (owner,
   20.10.2026, who chose among the outcomes offered, on the assistant's recommendation, and approved the words). The
   words are a proposal of the assistant that the owner approved by choosing it, not a sentence of his own, and so is the
   English: "Engleski red, odobren istog dana izborom mog prevoda". The quotation marks in the entry carry the words the
   policy is to say.

   THE WORDS, character for character, and nothing else is written about Cloudflare.
     Serbian:  | Cloudflare | Saobraćaj i IP adrese, zaštita i domen; čuvanje šifrovanih rezervnih kopija baze i slika | SAD i EU |
     English:  | Cloudflare | Traffic and IP addresses, protection, and the domain; storage of encrypted backups of the database and photos | USA and EU |
   Only the second cell of the row changes. The first cell (the name) and the third (where) are what they were, and the
   pipe that separates the cells is the table's, so the migration writes the whole row and asks for the whole row.

   ORDER. The entry says the row is published together with the first backup, not before (the precedent of V60, Zoho).
   That condition is met: the first backup reached the bucket under daily/ on 21.10.2026 and was proved to restore (the
   request that asked for this file says so; the backup itself is not a thing this file can measure). So this file does
   not publish a processor of data ahead of its use.

   THE SIGN-OFF DATE. The entry is silent about it. It is derived, not decided anew: PDL, the entry "Datum Poslednja
   izmena se pomera" (owner, 16.10.2026) moves the date on the documents whose text changes and leaves it on those
   whose text does not. V57 moved all three because the text of all three changed, V58 and V60 moved only the documents
   whose text they changed, and V61, which changed no word, moved nothing. The privacy policy is the
   only document whose text changes here, so only its "Poslednja izmena: 18.10.2026." (V60 wrote that date) becomes
   "Poslednja izmena: 22.10.2026." and "Last amended: 18.10.2026." becomes "Last amended: 22.10.2026.". The terms of
   use keep 10.10.2026 and the rulebook keeps 16.10.2026. 22.10.2026 is a day chosen by the person who asked for this
   file as the day it reaches QA, as in V60; it is not the owner's own word, and it is moved before the merge if the
   file reaches QA on another day. Both languages carry their own date, and both are moved.

   HOW. The shape of V60 and for its reason: every edit is asked how many times its old text stands in the text it is
   aimed at, and anything but exactly once is a problem. A section that already carries the new text is a problem too.
   The edits are all asked and not stopped at the first problem; if there is any, one error lists every edit and what
   it found, the statement is rolled back with nothing changed, and Flyway refuses to start the backend. A replace()
   that matched nothing would be recorded as a migration that succeeded while the old text went on being published (V57
   has the whole argument). Here the old text of a row edit is the whole row, which stands once in the table of
   processors and nowhere else on the written pages (checked in every migration before this one), so the edit cannot
   land on another row, and the row for Zoho, whose cells are not Cloudflare's, is not a place it can land.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of four section
   texts (two for the row, two for the date) and nothing else in them. The sentence under the table about transfers
   outside the European Union is not touched.

   WHY A NEW FILE AND NOT AN EDIT OF V24, V41, V43 OR V60: ADL A2. They have been applied, their checksums are in
   flyway_schema_history, and MigrationsAreImmutableTest holds Flyway to them.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the
   Serbian answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which
   writtenVerification.test.ts holds that fixture to in the other direction; the sign-off check of
   writtenPages.test.tsx, which names the day of each of the three documents; the guards that name the policy's date,
   TheWrittenPagesCarryTheEditsOfTheTenthOfOctoberTest, TheWrittenPagesSayThatTheCategoryRevealsTheYearOfBirthTest,
   TheWrittenPagesNameZohoAsAProcessorTest and TheWrittenPagesUseTheEnglishQuotationMarkTest, which now say 22.10.2026
   for the policy; and, for both languages and for every edit, TheWrittenPagesTheCloudflareRowNamesTheBackupsTest. */

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

            ('Cloudflare', 'politika-privatnosti', 5, 'sr',
             $old$| Cloudflare | Saobraćaj i IP adrese, zaštita i domen | SAD i EU |$old$,
             $new$| Cloudflare | Saobraćaj i IP adrese, zaštita i domen; čuvanje šifrovanih rezervnih kopija baze i slika | SAD i EU |$new$),
            ('Cloudflare', 'politika-privatnosti', 5, 'en',
             $old$| Cloudflare | Traffic and IP addresses, protection, and the domain | USA and EU |$old$,
             $new$| Cloudflare | Traffic and IP addresses, protection, and the domain; storage of encrypted backups of the database and photos | USA and EU |$new$),

            ('Cloudflare date', 'politika-privatnosti', 7, 'sr',
             $old$Poslednja izmena: 18.10.2026.$old$,
             $new$Poslednja izmena: 22.10.2026.$new$),
            ('Cloudflare date', 'politika-privatnosti', 7, 'en',
             $old$Last amended: 18.10.2026.$old$,
             $new$Last amended: 22.10.2026.$new$)

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

        /* The new text is asked about too, for every edit, and a section that already holds it is a problem. */
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
