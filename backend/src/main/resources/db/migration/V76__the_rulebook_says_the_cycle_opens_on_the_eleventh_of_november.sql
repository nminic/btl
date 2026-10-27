/* THE RULEBOOK SAYS THE CYCLE OPENS ON 11 NOVEMBER, THE RANKING DEADLINE IS 31 MARCH AND THE TRANSFER WINDOW OPENS ON 11 NOVEMBER,
   IN SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, "Novi godišnji ciklus od 11. novembra (27.10.2026)" and, under it, "Reči
   Pravilnika za novi ciklus". The prices and the days are the owner's (V75). The WORDS of the rulebook were put to him as a
   draft and he approved and corrected them on 27.10.2026; the sentences below are the ones he fixed, and two of them are
   his own words, quoted:
     Article 11, the whole sentence about the repeating price list is replaced by his: "Cenovnik se sa istim rokovima
     ponavlja svake sezone."
     Article 49 (teams), the first paragraph is replaced by two sentences of his: "Prelazni rok za timove je od 11. novembra do
     31. decembra. Ulazak ili izlazak iz tima su dozvoljeni samo tokom prelaznog roka." (the sentences about the single exit,
     the contribution that stays and leaving outside the window go with it). And in the paragraph after it the sentence "Sve
     promene moraju biti završene do 31. decembra." is struck, the rest of that paragraph standing. The strike is written
     with the end of the paragraph as an anchor, so that its new text is not a piece of its old one (the loop below asks
     whether the new text is already there) and so that it can be undone where it was made.
   The other two are the draft as he left it, with his one correction to the second: Article 10 says the right to be ranked
   is held by a payment made by 31 March 2027, and "Ko se učlani od 1. aprila 2027, dobija profil..." (he struck "tokom
   sezone, dakle"). The English is the translation of the same sentences and is the assistant's.

   WHAT THE PAGES NO LONGER SAY. No sentence on any page names 15 October or 14 October any more, and none names an exception
   for 2026: in 2026 the portal sells from 15 October as it does now, and the pages say nothing about it (owner, 27.10.2026:
   "nigde se ne pominje na sajtu ni jedan datum oko ovoga pre 11.11."). The day the price list opens and the dates of the
   periods are drawn from the price table on the page (V75), so the sentence in Article 11 does not repeat them.

   THE SIGN-OFF DATE MOVES, AND ONLY ON THE RULEBOOK. PDL, "Datum Poslednja izmena se pomera" (owner, 16.10.2026): the date
   moves on the documents whose text changes. The rulebook's text changes here, so its "Poslednja izmena: 22.10.2026." becomes
   "Poslednja izmena: 27.10.2026." and "Last amended: 22.10.2026." becomes "Last amended: 27.10.2026." (the day of this
   revision, 27.10.2026). The terms of use and the privacy policy are not touched. The terms of use say nothing about the
   cycle's days any more (read out of the text the portal serves).

   HOW. The shape of V73 and for its reason: every edit is asked how many times its old text stands in the text it is aimed
   at, and anything but exactly once is a problem. A section that already carries the new text is a problem too. The edits are
   all asked and not stopped at the first problem; if there is any, one error lists every edit and what it found, the
   statement is rolled back with nothing changed, and Flyway refuses to start the backend.

   WHAT IT DOES NOT TOUCH: no schema, no key, no row added or removed; the bodies of four sections of the rulebook in each
   language (Article 10, Article 11, Article 49 and the sign-off) and nothing else in them.

   WHY A NEW FILE: ADL A2. The text was written by V24 and rewritten by V43, V46, V49 and V71, all applied.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that
   fixture to in the other direction; and TheWrittenPagesOpenOnTheElevenOfNovemberTest, for both languages. */

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

            ('Article 10 deadline', 'pravilnik', 3, 'sr',
             $old$zaključno sa 31. decembrom 2026. godine$old$,
             $new$zaključno sa 31. martom 2027. godine$new$),

            ('Article 10 deadline', 'pravilnik', 3, 'en',
             $old$by a payment made by 31 December 2026 at the latest$old$,
             $new$by a payment made by 31 March 2027 at the latest$new$),

            ('Article 10 late member', 'pravilnik', 3, 'sr',
             $old$Ko se učlani tokom sezone, dakle od 1. januara 2027, dobija profil$old$,
             $new$Ko se učlani od 1. aprila 2027, dobija profil$new$),

            ('Article 10 late member', 'pravilnik', 3, 'en',
             $old$Anyone who joins during the season, that is from 1 January 2027 onward, receives a profile$old$,
             $new$Anyone who joins from 1 April 2027 onward receives a profile$new$),

            ('Article 11 price list', 'pravilnik', 4, 'sr',
             $old$Cenovnik se ponavlja svake godine: od 15. oktobra se prodaje naredna sezona, a od 1. januara do 14. oktobra tekuća, bez prava na rangiranje.$old$,
             $new$Cenovnik se sa istim rokovima ponavlja svake sezone.$new$),

            ('Article 11 price list', 'pravilnik', 4, 'en',
             $old$The price list repeats every year: from 15 October the following season is sold, and from 1 January to 14 October the current one is, without the right to be ranked.$old$,
             $new$The price list repeats every season with the same deadlines.$new$),

            ('Article 49 teams', 'pravilnik', 12, 'sr',
             $old$Iz tima se izlazi u istom prozoru u kom se i ulazi, od 15. oktobra do 31. decembra. Izlazak je jedan i ne nosi nikakvu kaznu: doprinos koji je član dao timu u toj sezoni ostaje, i član sme odmah da se prijavi drugom timu u istom prozoru. Van tog prozora izlazak nije moguć.$old$,
             $new$Prelazni rok za timove je od 11. novembra do 31. decembra. Ulazak ili izlazak iz tima su dozvoljeni samo tokom prelaznog roka.$new$),

            ('Article 49 teams', 'pravilnik', 12, 'en',
             $old$A member leaves a team in the same window in which they join one, from 15 October to 31 December. There is one exit and it carries no penalty: the contribution they have made to the team in that season stays, and they may apply to another team immediately, within the same window. Outside that window leaving is not possible.$old$,
             $new$The transfer window for teams runs from 11 November to 31 December. Joining or leaving a team is allowed only during the transfer window.$new$),

            ('Article 49 deadline sentence', 'pravilnik', 12, 'sr',
             $old$aktivno za tu sezonu. Sve promene moraju biti završene do 31. decembra.

Trkački par$old$,
             $new$aktivno za tu sezonu.

Trkački par$new$),

            ('Article 49 deadline sentence', 'pravilnik', 12, 'en',
             $old$active for that season. All changes must be completed by 31 December.

A racing pair$old$,
             $new$active for that season.

A racing pair$new$),

            ('Sign-off', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 22.10.2026.$old$,
             $new$Poslednja izmena: 27.10.2026.$new$),

            ('Sign-off', 'pravilnik', 19, 'en',
             $old$Last amended: 22.10.2026.$old$,
             $new$Last amended: 27.10.2026.$new$)

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
