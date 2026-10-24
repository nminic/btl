/* THE PRIVACY POLICY SAYS THE DATE OF BIRTH, THE FATHER'S NAME AND THE NUMBER OF THE DOCUMENT ARE NOT SHOWN TO OTHERS, IN
   SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry "Politika privatnosti, odeljak 3" (owner, 24.10.2026): "nikada
   ne prikazuje drugima, dakle dodaj rec "drugima"". The sentence about the date of birth gains the word "drugima", because
   since 24.10.2026 a member sees his own date on his own card as a locked box (PDL, the entry of the same day, "clan ga
   vidi ali je disabled za menjanje"), and a policy that said the date is shown to nobody would be false of his own page.
   The English is the translation of the same change. The owner's words are the word to add; the sentence it goes into is
   the one the policy already has.

   THE WORDS, character for character, and nothing else in the sentence moves.
     Serbian:  ... i ne prikazujemo ga drugima ni u punom ni u skraćenom obliku, osim ako sami izaberete ...
     English:  ... and we do not display it to others in full or in shortened form, unless you yourself choose ...
   THE TWO MORE PLACES, the same day, the same reason, the owner's choice among the places offered (the words are the
   assistant's and so is the English): the row of the table in section 2 for the number of the identity document, which
   said "Vidi ga samo administracija, ne prikazuje se nigde", now says "Vidi ga samo administracija i vi, na svojoj kartici
   Podaci; drugima se ne prikazuje nigde" (the rest of the cell is as it was), because a member sees the number on his own
   card; and the heading over the list in section 3, "Nikada se ne prikazuje", becomes "Nikada se ne prikazuje drugima",
   because the list holds the father's name and the number of the document, both of which the member sees on his own card.
   The heading and not the two names alone, because the list is one list and the member sees on his own card, and has always
   seen on his own page, more than those two (his address, his telephone, his shirt size).
   English: "Only the administration and you see it, on your own Details card; it is not displayed to others anywhere"
   (the English card is called "Details", `profile.parts.data`), and "### Never displayed to others".

   WHERE THE WORD GOES. After "ga" and before "ni u punom", and after "it" and before "in full": the word is about who
   the date is not shown to, so it stands beside the verb it limits and not at the end of the sentence, where it would
   limit "ako sami izaberete".

   WHAT THE OWNER'S QUOTATION IS AND THE SENTENCE IS NOT. The entry quotes the sentence as "Datum rođenja se nikada ne
   prikazuje drugima, ...". That is the sentence as V24 wrote it ("Datum rođenja se nikada ne prikazuje, ni u punom ni u
   skraćenom obliku"), which V57 replaced on 10.10.2026 when the owner decided a member may choose to show his date or his
   year (V57, "osim ako sami izaberete da se na vašem profilu vidi ceo datum ili samo godina"). The sentence the policy
   carries now is V57's, and it has no "nikada": a "nikada" put back in front of an exception would say the opposite of
   the exception. So this file adds the word the owner asked for and leaves the rest as it is. The same sentence is not
   written in the rulebook or in the terms of use (read out of the text the portal serves, the rulebook's old Article 74
   having gone into the privacy policy in V71).

   THE SIGN-OFF DATE IS NOT MOVED HERE. PDL, "Datum Poslednja izmena se pomera" (owner, 16.10.2026), moves the date on a
   document whose text changes. The request that asked for this file named the word and nothing else ("ništa drugo u
   pravnim tekstovima ne diraš"), so the policy still says "Poslednja izmena: 22.10.2026." and the question of moving it
   is put to the owner with this file, not decided by it.

   HOW. The shape of V70 and for its reason: every edit is asked how many times its old text stands in the text it is
   aimed at, and anything but exactly once is a problem. A section that already carries the new text is a problem too.
   The edits are all asked and not stopped at the first problem; if there is any, one error lists every edit and what
   it found, the statement is rolled back with nothing changed, and Flyway refuses to start the backend. A replace()
   that matched nothing would be recorded as a migration that succeeded while the old text went on being published (V57
   has the whole argument). The old text of each edit is the start of the sentence up to the exception, which stands once
   in section 3 of the policy in each language and nowhere else on the written pages.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of four section
   texts (sections 2 and 3 of the policy, in both languages) and nothing else in them: not the other sentences of section
   3, not the list of what is never shown but for its heading, and not the other rows of the table.

   WHY A NEW FILE AND NOT AN EDIT OF V57: ADL A2. V57 has been applied, its checksum is in flyway_schema_history, and
   MigrationsAreImmutableTest holds Flyway to it. V73 and not V72, because V72 belongs to the pull request that is
   merged before this one.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which
   writtenVerification.test.ts holds that fixture to in the other direction; and TheWrittenPagesSayTheDateOfBirthIsNotShownToOthersTest,
   for both languages and for every edit. */

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

            ('Date of birth', 'politika-privatnosti', 3, 'sr',
             $old$Datum rođenja tražimo da bismo znali uzrasnu kategoriju i ne prikazujemo ga ni u punom ni u skraćenom obliku, osim ako$old$,
             $new$Datum rođenja tražimo da bismo znali uzrasnu kategoriju i ne prikazujemo ga drugima ni u punom ni u skraćenom obliku, osim ako$new$),
            ('Date of birth', 'politika-privatnosti', 3, 'en',
             $old$We ask for the date of birth so that we know the age category, and we do not display it in full or in shortened form, unless$old$,
             $new$We ask for the date of birth so that we know the age category, and we do not display it to others in full or in shortened form, unless$new$),

            ('Document row', 'politika-privatnosti', 2, 'sr',
             $old$Vidi ga samo administracija, ne prikazuje se nigde i stoji odvojeno od podataka$old$,
             $new$Vidi ga samo administracija i vi, na svojoj kartici Podaci; drugima se ne prikazuje nigde i stoji odvojeno od podataka$new$),
            ('Document row', 'politika-privatnosti', 2, 'en',
             $old$Only the administration sees it; it is not displayed anywhere and stands apart from the data$old$,
             $new$Only the administration and you see it, on your own Details card; it is not displayed to others anywhere and stands apart from the data$new$),

            ('Never shown, heading', 'politika-privatnosti', 3, 'sr',
             $old$### Nikada se ne prikazuje

Adresa elektronske pošte$old$,
             $new$### Nikada se ne prikazuje drugima

Adresa elektronske pošte$new$),
            ('Never shown, heading', 'politika-privatnosti', 3, 'en',
             $old$### Never displayed

E-mail address$old$,
             $new$### Never displayed to others

E-mail address$new$)

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
