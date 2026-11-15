/* THE RULEBOOK SAYS IN ARTICLE 15 THAT AN UNSCORED RACE IS KEPT ON THE PORTAL AS A PERSONAL RECORD AND DOES NOT COUNT, AND ITS SIGN-OFF MOVES TO
   15.11.2026, IN SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry of 14.11.2026 (owner, "drugi krug pitanja o planu", item 7, chosen
   with the assistant's recommendation): "Rečenica u Članu 15 Pravilnika glasi: „Nebodovane trke (plivanje, biciklizam,
   duatlon, triatlon, akvatlon i slično) vode se na portalu samo kao lična evidencija i ne boduju se.”" It replaces the
   sentence of the entry of the same day, "Ostale discipline se vode samo kao lična evidencija i ne boduju se.", which no
   text of the portal ever carried (searched in migrations, dictionaries and fixtures), so there is nothing to take out.

   WHAT IT SAYS, AND WHERE. Article 15 is "Šta se ne boduje" (V71 renumbered it from 19; it stands in section position 5 of the
   rulebook, under Article 14). The sentence becomes its last item, after "Planinarske akcije bez zvaničnog merenja vremena.",
   as one more line of the list that article is made of. Serbian is the owner's sentence word for word. THE ENGLISH IS THE
   ASSISTANT'S TRANSLATION, NOT THE OWNER'S WORDING: "Unscored races (swimming, cycling, duathlon, triathlon, aquathlon and the
   like) are kept on the portal as a personal record only and do not count toward points." The verb follows the heading of the
   same article in English ("What does not count toward points"). It is not signed off until the owner reads it.

   THE SIGN-OFF OF THE RULEBOOK MOVES, AND ONLY THE RULEBOOK'S. PDL, "Datum Poslednja izmena na pravnom tekstu pomera se
   uvek kad se reči tog teksta promene" (owner, 07.11.2026), with the addition of 14.11.2026 that the day moves in both
   languages: the day is the day the change reaches QA. The words of the rulebook change here, so "Poslednja izmena:
   14.11.2026." (V98) becomes "Poslednja izmena: 15.11.2026." and "Last amended: 14.11.2026." becomes "Last amended:
   15.11.2026." (section 19), as V98 did it. The terms and the policy (11.11.2026 since V95) keep theirs.

   THE DAY IS WRITTEN AS THE DAY IT IS EXPECTED. 15.11.2026 is the day this file is merged and lifted to QA, last of the
   increment (plan of 14.11.2026). If it reaches QA on another day, the date is moved before the merge, in this file and
   in every place that holds it, which ADL A2 allows because the file has not been applied anywhere (QA stood at V98 when
   this was written, read from flyway_schema_history).

   HOW. The shape of V93 to V98: every edit is asked how many times its old text stands in the text it is aimed at, and
   anything but exactly once is a problem. A section that already carries the new text is a problem too, asked of the section with
   the old text taken out first. The edits are all asked and not stopped at the first problem; if there is any, one error lists
   every edit and what it found, the statement is rolled back with nothing changed, and Flyway refuses to start the backend. A
   replace() that matched nothing would be recorded as a migration that succeeded while the old text went on being published
   (V57 has the whole argument).

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of two sections of the
   rulebook (section 5, and the sign-off in section 19) in two languages, and in them only the one line added after the last
   item of Article 15 and the date.

   WHY EACH OLD TEXT RUNS ON TO THE HEADING OF ARTICLE 16. The new text contains the last item that was there, so an old text of
   that item alone would still be found once in the finished text and the migration, run a second time, would add the line a second
   time instead of refusing. With the heading of the next article in the old text, a section that already has the line does not
   hold it, and the migration says so.

   WHY A NEW FILE AND NOT AN EDIT OF V71 OR V98: ADL A2. They have been applied, their checksums are in flyway_schema_history, and
   MigrationsAreImmutableTest holds Flyway to them. V100 and not V99: V99 belongs to step 1 of the same increment, and this file
   is merged after it (V101 comes after, so it is the last of the three).

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts
   holds that fixture to in the other direction; and TheWrittenPagesSayThatAnUnscoredRaceIsAPersonalRecordTest and its
   carried-over twin, for every edit. */

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

            ('UNSCORED-01 article 15', 'pravilnik', 5, 'sr',
             $old$- Planinarske akcije bez zvaničnog merenja vremena.

### Član 16. Štafete$old$,
             $new$- Planinarske akcije bez zvaničnog merenja vremena.
- Nebodovane trke (plivanje, biciklizam, duatlon, triatlon, akvatlon i slično) vode se na portalu samo kao lična evidencija i ne boduju se.

### Član 16. Štafete$new$),

            ('UNSCORED-01 article 15', 'pravilnik', 5, 'en',
             $old$- Hiking outings with no official timing.

### Article 16. Relays$old$,
             $new$- Hiking outings with no official timing.
- Unscored races (swimming, cycling, duathlon, triathlon, aquathlon and the like) are kept on the portal as a personal record only and do not count toward points.

### Article 16. Relays$new$),

            ('UNSCORED-02 sign-off', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 14.11.2026.$old$,
             $new$Poslednja izmena: 15.11.2026.$new$),

            ('UNSCORED-02 sign-off', 'pravilnik', 19, 'en',
             $old$Last amended: 14.11.2026.$old$,
             $new$Last amended: 15.11.2026.$new$)

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
