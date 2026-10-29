/* THE RULEBOOK SAYS IN ONE SENTENCE WHO KEEPS THE DUCATS, AND THE PRIVACY POLICY NO LONGER MENTIONS A MAP OF COUNTRIES
   VISITED, IN SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, "Urednička revizija Pravilnika, Uslova i Politike privatnosti
   (29.10.2026)", and under it the item "Preostala pitanja posle provere pravnih strana prema kodu". The owner decided on
   29.10.2026:
     1. Rulebook, section 18 (Dukati): the paragraph "Osvojen dukat ostaje trajno. Ne skida se kad dođe slabija godina, ni kad
        se uslovi kasnije promene, ni kad prestanete da se takmičite, i stoji na profilu kao zapis o onome što je istrčano." is
        replaced by his sentence, quoted: "Osvojeni dukati ostaju u trajnom vlasništvu profila, osim u slučaju brisanja istog."
        (his words: "Umesto svih ovih laprdanja treba da stoji samo").
     2. Privacy policy, section 2, the row "Mesto i zemlja": "mapa posećenih zemalja" leaves it (chosen among the offered
        outcomes, with the assistant's recommendation; the map does not exist and there is no decision about it).
   The English is the translation of the same sentences and is the assistant's. The owner's sentence and the Serbian of the
   row are his and are not touched here.

   THE SIGN-OFF DATE DOES NOT MOVE, and that is a decision of the shape and not an omission. PDL, "Datum Poslednja izmena se
   pomera" (owner, 16.10.2026, chosen with the assistant's recommendation): the date moves on the documents whose text changes,
   to the day the change reaches QA. V77 moved all three pages to "Poslednja izmena: 29.10.2026." on the day of the same
   revision, and this migration is written on that day as well, so the date of the rulebook and of the policy is already the
   day of this change and moving it would write the same text over itself. The terms are not touched by this migration at
   all. If this migration reaches QA on a later day, the two dates are a decision for that day and are not made here.

   HOW. The shape of V77 (and V71, V73, V76 before it): every edit is asked how many times its old text stands in the text it
   is aimed at, and anything but exactly once is a problem. A section that already carries the new text is a problem too, and it
   is asked of the section with the old text taken out first, as in V77: there the new text of a strike is a piece of its own
   old text, so asking the section as it stands would call every strike an application already made. Here no new text is a piece
   of an old one, but the question is asked the same way, so that one shape serves every migration of these pages. The edits
   are all asked and not stopped at the first problem; if there is any, one error lists every edit and what it found, the
   statement is rolled back with nothing changed, and Flyway refuses to start the backend.

   WHAT IT DOES NOT TOUCH: no schema, no key, no row added or removed; only the body of section 18 of the rulebook and of
   section 2 of the policy, and in them only the sentence and the words named. No heading is edited.

   WHY A NEW FILE: ADL A2. The text was written by V24 and rewritten by V43, V44, V46, V49, V71, V73, V76 and V77, all
   applied.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that
   fixture to in the other direction; and TheWrittenPagesKeepTheDucatsAndLoseTheMapTest, which holds every edit in both
   languages. The sweep of TheWrittenPagesDropTheirExplanationsTest that keeps the exemption from the fee out of every
   section now also keeps out the sentence that does it without the word. */

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

            ('DUK-01 section 18', 'pravilnik', 18, 'sr',
             $old$Osvojen dukat ostaje trajno. Ne skida se kad dođe slabija godina, ni kad se uslovi kasnije promene, ni kad prestanete da se takmičite, i stoji na profilu kao zapis o onome što je istrčano.$old$,
             $new$Osvojeni dukati ostaju u trajnom vlasništvu profila, osim u slučaju brisanja istog.$new$),

            ('DUK-01 section 18', 'pravilnik', 18, 'en',
             $old$A won ducat stays forever. It is not taken away when a weaker year comes, nor when the conditions later change, nor when you stop competing, and it stands on your profile as a record of what was run.$old$,
             $new$Won ducats remain in the permanent ownership of the profile, except in the case of its deletion.$new$),

            ('POL-20 section 2', 'politika-privatnosti', 2, 'sr',
             $old$Profil, mapa posećenih zemalja, način plaćanja, i državljanstvo u evidenciji članova$old$,
             $new$Profil, način plaćanja, i državljanstvo u evidenciji članova$new$),

            ('POL-20 section 2', 'politika-privatnosti', 2, 'en',
             $old$Profile, map of countries visited, payment method, and citizenship in the membership records$old$,
             $new$Profile, payment method, and citizenship in the membership records$new$)

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
           the section WITHOUT the old text, which is replaced by a character no page contains: a strike leaves the sentence
           before it, so the new text of a strike is a piece of its own old text and would otherwise always be "already
           there". */
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
