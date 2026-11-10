/* THE WRITTEN PAGES STATE THE FACT AND DO NOT EXPLAIN ITS CONSEQUENCES: EIGHT SENTENCES OF THE POLICY, THE TERMS, THE RULEBOOK AND
   THE PRESIDENT'S WORD, IN SERBIAN, AND THE SIGN-OFFS OF THE POLICY, THE TERMS AND THE RULEBOOK, IN SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, "Ton ekrana bez objašnjavanja posledica (10.11.2026)", the entry "[ODLUKE
   10.11.2026, vlasnik, rečenicu po rečenicu]": of 216 proposals the owner accepted 199 as they were put and wrote his own words
   for 17, and refused none; his words, sentence by sentence, are primeri/ton/odluke-vlasnika.json, field "tekst". Eight of the 216
   are sentences of the written pages. The same entry says that the English was not reviewed and goes into a round of its own, so
   no English sentence is touched here.

   THE EIGHT SENTENCES (position is the section's place on its page). Each is replaced by the owner's words, letter for letter.

     privacy policy, 4. Kolačići i lokalno skladište (position 4), two edits:
       "Postavlja se tek kad temu sami izaberete, ostaje u vašem pregledaču i nikada ne stiže do nas: ne šalje se ni sa jednim
        zahtevom, pa ga naš server ne vidi. Čita ga samo sama strana, u vašem pregledaču, da bi znala u kojoj temi da se iscrta."
         becomes "Postavlja se tek kad temu sami izaberete."
       "Drugog skladišta nema. Nema analitike, ni naše ni tuđe, pa nema ni trake za pristanak."
         becomes "Drugog skladišta, niti analitike, nema."
     privacy policy, 3. Šta je javno, a šta nikada nije (position 3):
       "To je suština usluge koju vam pružamo i na to pristajete učlanjenjem." becomes "Na to pristajete učlanjenjem."
     terms of use, 4. Registracija, uplata i aktivacija (position 4), step 1: the sentence "Uz svako polje koje ima pravilo stoji
       objašnjenje tog pravila." goes out whole, with the space before it.
     rulebook, Article 33 (section 9): "Dužinu, uspon i spust upisujete sami, jer portal ne učitava zapis staze sa sata." becomes
       "Dužinu, uspon i spust upisujete sami."
     rulebook, Article 51 (section 13): "Posebnog prikaza za višestruke polumaratone i maratone nema." goes out whole, with the
       space before it.
     rulebook, Article 57 (section 14): "Ličnu predaju uvek možete dogovoriti, i kasnije." goes out whole, with the paragraph
       break before it.
     the president's word (the only section of its page, position 1): "za dodatne informacije nas slobodno kontaktirajte na
       zvaničnu adresu" becomes "za dodatne informacije pišite nam na", and the address and the full stop after it stay.

   WHERE A SENTENCE GOES OUT, the old text of the edit carries the words next to it that the removal leaves standing ("1. Popunite
   formu.", "prati se ukupna kilometraža i ukupno vreme.", "snosi član."), and the new text is those same words and nothing else.
   An edit whose new text were empty could not be undone by the guards that read these edits back out of the file, which look
   for the new text exactly once.

   THE SIGN-OFFS. PDL, "Datum Poslednja izmena na pravnom tekstu pomera se uvek kad se reči tog teksta promene" (owner,
   07.11.2026): the date moves whenever the words of a legal text change, to the day the change reaches QA, for every page whose
   words change. Three pages change here, so three sign-offs move to 11.11.2026, in both languages: the policy's "Poslednja
   izmena: 08.11.2026." (V90) and "Last amended: 08.11.2026."; the terms' "Poslednja izmena: 29.10.2026." (V77) and "Last
   amended: 29.10.2026."; the rulebook's "Poslednja izmena: 10.11.2026." (V93) and "Last amended: 10.11.2026." Only the day
   moves in English, and not one of its sentences. The president's word carries no sign-off. 11.11.2026 is the day this was
   written and the day it is expected on QA; if the file reaches QA on a later day, the date is moved before the merge, in this
   file and in every place that holds it, which ADL A2 allows because the file has not been applied anywhere.

   HOW. The shape of V94, V93 and V80: every edit is asked how many times its old text stands in the text it is aimed at, and
   anything but exactly once is a problem. A section that already carries the new text is a problem too, asked of the section
   with the old text taken out first. The edits are all asked and not stopped at the first problem; if there is any, one error
   lists every edit and what it found, the statement is rolled back with nothing changed, and Flyway refuses to start the
   backend.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; the body of ten section texts in
   Serbian (the policy's sections 3, 4 and 7, the terms' sections 4 and 11, the rulebook's sections 9, 13, 14 and 19, and the
   president's section 1) and the body of three in English (the three sign-offs), and in them only the sentences and the dates
   named above: fourteen edits, eight of words and six of dates.

   WHY A NEW FILE AND NOT AN EDIT OF V24 OR V26: ADL A2. They have been applied, their checksums are in flyway_schema_history,
   and MigrationsAreImmutableTest holds Flyway to them.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian answer
   of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that
   fixture to in the other direction; and TheWrittenPagesStateTheFactCarriedOverTest, over the text that was already there, which
   compares the whole of every page before and after and allows only the replacements this file makes. */

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

            ('TON-01 privacy 4, the theme', 'politika-privatnosti', 4, 'sr',
             $old$Postavlja se tek kad temu sami izaberete, ostaje u vašem pregledaču i nikada ne stiže do nas: ne šalje se ni sa jednim zahtevom, pa ga naš server ne vidi. Čita ga samo sama strana, u vašem pregledaču, da bi znala u kojoj temi da se iscrta.$old$,
             $new$Postavlja se tek kad temu sami izaberete.$new$),

            ('TON-02 privacy 4, no other storage', 'politika-privatnosti', 4, 'sr',
             $old$Drugog skladišta nema. Nema analitike, ni naše ni tuđe, pa nema ni trake za pristanak.$old$,
             $new$Drugog skladišta, niti analitike, nema.$new$),

            ('TON-03 privacy 3, the essence', 'politika-privatnosti', 3, 'sr',
             $old$To je suština usluge koju vam pružamo i na to pristajete učlanjenjem.$old$,
             $new$Na to pristajete učlanjenjem.$new$),

            ('TON-04 terms 4, step 1', 'uslovi-koriscenja', 4, 'sr',
             $old$1. Popunite formu. Uz svako polje koje ima pravilo stoji objašnjenje tog pravila.$old$,
             $new$1. Popunite formu.$new$),

            ('TON-05 rulebook, Article 33', 'pravilnik', 9, 'sr',
             $old$Dužinu, uspon i spust upisujete sami, jer portal ne učitava zapis staze sa sata.$old$,
             $new$Dužinu, uspon i spust upisujete sami.$new$),

            ('TON-06 rulebook, Article 51', 'pravilnik', 13, 'sr',
             $old$prati se ukupna kilometraža i ukupno vreme. Posebnog prikaza za višestruke polumaratone i maratone nema.$old$,
             $new$prati se ukupna kilometraža i ukupno vreme.$new$),

            ('TON-07 rulebook, Article 57', 'pravilnik', 14, 'sr',
             $old$Poštanske troškove slanja majice i medalje snosi član.

Ličnu predaju uvek možete dogovoriti, i kasnije.$old$,
             $new$Poštanske troškove slanja majice i medalje snosi član.$new$),

            ('TON-08 the president''s word', 'rec-predsednika', 1, 'sr',
             $old$za dodatne informacije nas slobodno kontaktirajte na zvaničnu adresu$old$,
             $new$za dodatne informacije pišite nam na$new$),

            ('TON-09 sign-off, privacy', 'politika-privatnosti', 7, 'sr',
             $old$Poslednja izmena: 08.11.2026.$old$,
             $new$Poslednja izmena: 11.11.2026.$new$),

            ('TON-09 sign-off, privacy', 'politika-privatnosti', 7, 'en',
             $old$Last amended: 08.11.2026.$old$,
             $new$Last amended: 11.11.2026.$new$),

            ('TON-10 sign-off, terms', 'uslovi-koriscenja', 11, 'sr',
             $old$Poslednja izmena: 29.10.2026.$old$,
             $new$Poslednja izmena: 11.11.2026.$new$),

            ('TON-10 sign-off, terms', 'uslovi-koriscenja', 11, 'en',
             $old$Last amended: 29.10.2026.$old$,
             $new$Last amended: 11.11.2026.$new$),

            ('TON-11 sign-off, rulebook', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 10.11.2026.$old$,
             $new$Poslednja izmena: 11.11.2026.$new$),

            ('TON-11 sign-off, rulebook', 'pravilnik', 19, 'en',
             $old$Last amended: 10.11.2026.$old$,
             $new$Last amended: 11.11.2026.$new$)

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
