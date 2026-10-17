/* THE WRITTEN PAGES SAY THAT MOVING TO AN OLDER AGE CATEGORY BETWEEN TWO SEASONS REVEALS THE EXACT YEAR OF
   BIRTH (item BR), AND THE TWO DOCUMENTS THAT SAY IT ARE SIGNED OFF ON 16.10.2026.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry "Reči za BR" (owner, 16.10.2026, who chose between
   two proposed wordings, the shorter; the assistant's recommendation had been the longer one, which names where
   it can be seen). The cost it answers is the one the entry above it records: a category is the season minus the
   year of birth, so a member who crosses 25, 40 or 55 between two seasons he ran in gives away his exact year of
   birth, and the same is had from the list of competitors read before and after a New Year and from the frozen
   tables. The owner chose to keep the category of the season and to say so in the published text before
   1 January 2028 (PDL, "Odaje se TAČNA, ne približna godina rođenja").

   THE WORDS ARE THE OWNER'S, character for character, and nothing else is written here.
     Serbian:  Iz prelaska u stariju uzrasnu kategoriju između dve sezone vidi se tačna godina rođenja, i kad datum
               rođenja nije prikazan.
     English:  Moving to an older age category between two seasons reveals the exact year of birth, even when the
               date of birth is not displayed.

   WHERE. One sentence, in two documents and in both languages, which is four edits, each placed directly after the
   sentence the owner named as its anchor: "Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš
   izbor." and "The category that follows from it is always public, whatever you choose."
     BR   politika-privatnosti   section 3   the privacy policy, "3. Šta je javno, a šta nikada nije"
     BR   pravilnik              section 17  the rulebook, Article 74, "17. Objavljivanje podataka i fotografije"
   Both anchors were written by V57 (its edits C and D), so this file must run after V57, and the old text of each
   edit below is the text V57 LEFT, not the text V24 or V43 wrote before it.

   THE SIGN-OFF DATE, four more edits. PDL, the entry "Datum „Poslednja izmena" se pomera" (owner, 16.10.2026,
   who chose it among the outcomes offered and on the assistant's recommendation): the privacy policy and the
   rulebook change their text here, so their "Poslednja izmena: 10.10.2026." becomes "Poslednja izmena:
   16.10.2026." and "Last amended: 10.10.2026." becomes "Last amended: 16.10.2026.". The date is the day this
   change reaches QA (the assistant's derivation, recorded in that entry: production goes only on the owner's word).
     BR date   politika-privatnosti   section 7    the sign-off of the privacy policy
     BR date   pravilnik              section 19   the sign-off of the rulebook
   THE TERMS OF USE ARE NOT EDITED and keep 10.10.2026, because their text does not change in this file; V57 wrote
   that date and it stands. The anchors of these edits are the dates V57 wrote (its edits E policy and E rulebook).

   HOW. The shape of V57 and for its reason: every edit is asked how many times its anchor stands in the text it is
   aimed at, and anything but exactly once is a problem. One question is added, because this edit, unlike most of
   V57's, leaves its anchor standing: a section that already carries the sentence is a problem too, otherwise a
   second run would find its anchor once and put the sentence in again. The edits are all asked and not stopped at
   the first problem; if there is any, one error lists every edit and what it found, the statement is rolled back with
   nothing changed, and Flyway refuses to start the backend. A replace() that matched nothing would be recorded as
   a migration that succeeded while the old text went on being published (V57 has the whole argument).

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of eight
   section texts (four for the sentence, four for the date) and nothing else in them. The sign-off of the terms of
   use stays 10.10.2026, in both languages.

   WHY A NEW FILE AND NOT AN EDIT OF V57: ADL A2. V57 has been applied, its checksum is in flyway_schema_history,
   and MigrationsAreImmutableTest holds Flyway to it.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the
   Serbian answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which
   writtenVerification.test.ts holds that fixture to in the other direction; the sign-off check of
   writtenPages.test.tsx, which names the day of each of the three documents; and, for both languages and for
   every edit, TheWrittenPagesSayThatTheCategoryRevealsTheYearOfBirthTest. */

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

            ('BR', 'politika-privatnosti', 3, 'sr',
             $old$Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor.$old$,
             $new$Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor. Iz prelaska u stariju uzrasnu kategoriju između dve sezone vidi se tačna godina rođenja, i kad datum rođenja nije prikazan.$new$),
            ('BR', 'politika-privatnosti', 3, 'en',
             $old$The category that follows from it is always public, whatever you choose.$old$,
             $new$The category that follows from it is always public, whatever you choose. Moving to an older age category between two seasons reveals the exact year of birth, even when the date of birth is not displayed.$new$),
            ('BR', 'pravilnik', 17, 'sr',
             $old$Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor.$old$,
             $new$Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor. Iz prelaska u stariju uzrasnu kategoriju između dve sezone vidi se tačna godina rođenja, i kad datum rođenja nije prikazan.$new$),
            ('BR', 'pravilnik', 17, 'en',
             $old$The category that follows from it is always public, whatever you choose.$old$,
             $new$The category that follows from it is always public, whatever you choose. Moving to an older age category between two seasons reveals the exact year of birth, even when the date of birth is not displayed.$new$),

            ('BR date', 'politika-privatnosti', 7, 'sr',
             $old$Poslednja izmena: 10.10.2026.$old$,
             $new$Poslednja izmena: 16.10.2026.$new$),
            ('BR date', 'politika-privatnosti', 7, 'en',
             $old$Last amended: 10.10.2026.$old$,
             $new$Last amended: 16.10.2026.$new$),
            ('BR date', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 10.10.2026.$old$,
             $new$Poslednja izmena: 16.10.2026.$new$),
            ('BR date', 'pravilnik', 19, 'en',
             $old$Last amended: 10.10.2026.$old$,
             $new$Last amended: 16.10.2026.$new$)

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

        /* The four edits that ADD a sentence leave their old text standing once the edit has been made. That is what
           makes them unlike a replacement, which finds nothing the second time: run over a section that already
           carries the sentence they would find their anchor once and put the sentence in again. So the new text is
           asked about too, for every edit, and a section that already holds it is a problem. */
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
