/* THE RULEBOOK SAYS IN THE OWNER'S TWO SENTENCES WHO PAYS IN WHICH CURRENCY (ARTICLE 11), AND ITS SIGN-OFF MOVES TO
   30.10.2026, IN SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, "Urednička revizija Pravilnika, Uslova i Politike privatnosti
   (29.10.2026)", the item "Član 11, konačan oblik (30.10.2026, ..." The sentence of Article 11
     "Član sa adresom u Srbiji plaća dinarski iznos, a član iz inostranstva iznos u evrima, uz koji se naplaćuje i taksa za
      obradu plaćanja od 3 EUR, kao odvojena stavka a ne kao veća članarina."
   becomes
     "Članovi iz Srbije plaćaju dinarski iznos, a članovi iz inostranstva iznos u evrima. Uz iznos u evrima naplaćuje se i
      taksa za obradu plaćanja od 3 EUR."
   (the owner's words: "bez , kao odvojena stavka a ne kao veća članarina"). The first sentence is the owner's own,
   quoted in the answers of 30.10.2026 in the same section of the PDL; the second is the old sentence's own fee clause cut
   at the point he named. The English is the translation of those two sentences and is the assistant's.

   THE SIGN-OFF OF THE RULEBOOK MOVES. PDL, "Datum Poslednja izmena se pomera" (owner, 16.10.2026): the date moves on the
   documents whose text changes, to the day the change reaches QA. The owner named the day, 30.10.2026, so
   "Poslednja izmena: 29.10.2026." (V77) becomes "Poslednja izmena: 30.10.2026." and the English "Last amended: ..." the
   same. The terms and the policy do not change in this migration and keep the day V77 gave them. If this migration reaches
   QA on a later day, the date is a decision for that day and is not made here.

   HOW. The shape of V77 and V78: every edit is asked how many times its old text stands in the text it is aimed at, and
   anything but exactly once is a problem. A section that already carries the new text is a problem too, and it is asked of
   the section with the old text taken out first, as in V77 and V78, so that one shape serves every migration of these
   pages. The edits are all asked and not stopped at the first problem; if there is any, one error lists every edit and what
   it found, the statement is rolled back with nothing changed, and Flyway refuses to start the backend.

   WHAT IT DOES NOT TOUCH: no schema, no key, no row added or removed; only the body of Article 11's section of the
   rulebook (position 4) and the body of its last section (position 19), and in them only the sentence and the date named.
   The sentence after the changed one ("Taksa nije deo članarine nego trošak obrade uplate kod platnog posrednika ...")
   is not edited. No heading is edited.

   WHY A NEW FILE: ADL A2. The text was written by V24 and rewritten by V43, V44, V46, V49, V71, V73, V76, V77 and V78, all
   applied.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that
   fixture to in the other direction; and TheWrittenPagesSayWhoPaysInWhichCurrencyTest, which holds every edit in both
   languages. */

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

            ('CUR-01 Article 11', 'pravilnik', 4, 'sr',
             $old$Član sa adresom u Srbiji plaća dinarski iznos, a član iz inostranstva iznos u evrima, uz koji se naplaćuje i taksa za obradu plaćanja od 3 EUR, kao odvojena stavka a ne kao veća članarina.$old$,
             $new$Članovi iz Srbije plaćaju dinarski iznos, a članovi iz inostranstva iznos u evrima. Uz iznos u evrima naplaćuje se i taksa za obradu plaćanja od 3 EUR.$new$),

            ('CUR-01 Article 11', 'pravilnik', 4, 'en',
             $old$A member with an address in Serbia pays the dinar amount, and a member from abroad pays the amount in euros, on which a payment processing fee of 3 EUR is also charged, as a separate line item rather than as a higher membership fee.$old$,
             $new$Members from Serbia pay the dinar amount, and members from abroad pay the amount in euros. A payment processing fee of 3 EUR is also charged on the amount in euros.$new$),

            ('CUR-02 sign-off', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 29.10.2026.$old$,
             $new$Poslednja izmena: 30.10.2026.$new$),

            ('CUR-02 sign-off', 'pravilnik', 19, 'en',
             $old$Last amended: 29.10.2026.$old$,
             $new$Last amended: 30.10.2026.$new$)

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
