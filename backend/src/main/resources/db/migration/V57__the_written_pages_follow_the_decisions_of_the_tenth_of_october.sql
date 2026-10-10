/* THE WRITTEN PAGES FOLLOW WHAT THE OWNER DECIDED ON 10 OCTOBER 2026: WHAT A MEMBER MAY SHOW OF HIS DATE OF
   BIRTH, WHO A HIDDEN PROFILE IS HIDDEN FROM, WHOSE NAME STAYS ON A MONEY TRAIL, THE LANGUAGE OF MAIL, AND
   THE SENTENCES THE PORTAL NO LONGER MATCHED.

   ONE MIGRATION, SERBIAN AND ENGLISH TOGETHER, BY DECISION. PDL, the entry "Izmena objavljenih pravnih
   tekstova ide jednom migracijom, srpski i engleski" (owner, 10.10.2026, who approved the words after being
   shown the old and the new text side by side). It is one file and not two because the edits overlap in the
   text they rewrite: one table of the policy is changed by two of them and one section of the terms by two, so
   two migrations would have rewritten the same sentences one over the other. Both languages are written here
   because PageApi serves English only when a whole page is translated, and V46 is the precedent for writing
   both in one file.

   WHAT IT EDITS: 39 edits, in the Serbian and the English text of 13 sections of the three legal
   documents, which is 26 section texts. The letters and numbers are the owner's: A to E, Q30 and JM are
   the headings of the two pages he approved, Z1 to Z6 are his answers to questions 2, 3 and 4.

     A                 policy 2      the row "Rođendan" becomes a row about the member's own choice of what to show
     JM                policy 2      a new row: the language of the member's mail
     B                 policy 3      the date of birth leaves the list "Nikada se ne prikazuje"
     C                 policy 3      the paragraph on the date of birth and on who a hidden profile is hidden from
     Q30               policy 5      the name of whoever forgave money stays on the money trails
     Z2                policy 6      the notifications are no longer switched on and off in the settings
     Z1, Z1 and        policy 7      two-factor sign-in is no longer claimed
     Z5 terms          terms 4       a member whose virtual balance covers the fee goes through without step 4
     Caveat terms      terms 5       what the administration may correct at verification now includes the
                                     length, the ascent and the descent
     Z3, Z3 count      terms 8       the button that authorizes another member to collect an award is gone, and
                                     the count above the list follows: two rules
     Z4                terms 12      a member whose status is not active still opens his own profile
     Z5 rulebook       rulebook 3    Article 10: the virtual balance is the third way status is activated
     Z6                rulebook 3    Article 11: the deadline is measured by the day the league booked the payment
     Caveat rulebook   rulebook 10   Article 44: the same widening of the same list
     D                 rulebook 17   Article 74: the date of birth is shown only where the member chose it
     E policy, E terms, E rulebook: policy 7, terms 12 and rulebook 19, the sign-off date of all three documents

   WHOSE WORDS THEY ARE, because the two must not be read as one.
     - A, B, C, D, E, Q30 and JM: the old and the new text of each is, character for character, what the two
       approval pages showed him as old and as new, minus the ellipsis Q30 is shown with. The one difference is
       E: the pages carried a placeholder for the date, and the date written here is 10.10.2026, the day he
       approved the words, as V41 wrote 28.09.2026 (PDL: "potpis je datum revizije skupa dokumenata, ne
       pojedinačnog dokumenta", so all three documents move together, the terms included).
     - Z1, Z2 and Z3 are deletions, and each takes out the least that removes the claim. In English the list in
       Z1 loses its last item, so the "and" that closed it moves to the item that now closes it (Z1 and); in
       Serbian that list never had a conjunction between its clauses and reads as before.
     - Z3 count: with the third rule of the awards section gone, the sentence above the list would count three
       over two. It was put to the owner as a question with three outcomes (the number changed, the sentence left
       alone, the number dropped) and he chose the first, on 10.10.2026, among the outcomes offered and on the
       assistant's recommendation. The words are the number and nothing else: "Tri pravila" becomes "Dva
       pravila", and "Three rules" becomes "Two rules".
     - Z4, Z5, Z6 and the caveat: the Serbian is the owner's own wording, transcribed from the journal. The
       English of these, and the "and" that moves in Z1, was not part of what he was first shown. It is the
       smallest change to the English around it, and on 10.10.2026 he read those sentences in the pull request
       and approved them as written.
     - Two placements are mine. Z5 in the terms adds its sentence at the end of step 5 (the journal says
       "dodaje se" and not where). The caveat edits the sentence that already stands in both documents by
       widening its list, because the journal says "Ograda ne dobija nov član: Član 44 Pravilnika je već nosi".

   HOW, AND WHY IT IS NOT JUST replace(). Each edit is an old text and a new text aimed at one section of one
   page in one language, and it is made with replace(). What replace() cannot do is notice that it matched
   nothing: V49 says so, and left it to a test over the migrated rows. That is not enough here, and the reason is
   about databases and not about tests. The tests replay every migration from an empty database, so they always
   hold the text the migrations wrote. A real database holds whatever is in it, and no route of the portal
   writes these two tables (PageApi only reads them), but a hand can. A replace() that matched nothing would be
   recorded by Flyway as a migration that succeeded, and the old sentence would go on being published.
   So every edit is first asked how many times its old text stands in the text it is aimed at, and anything but
   exactly once is a problem. The edits are all asked and not stopped at the first problem. If there is any, the
   migration raises one error that lists every edit and what it found, the statement is rolled back with
   nothing changed, and Flyway refuses to start the backend: the loud failure.
   TheWrittenPagesCarryTheEditsOfTheTenthOfOctoberTest runs this file again over the finished text to hold that
   it does fail, for zero, for two and for a missing section, and reads the edits back out of the error it raises.

   WHAT IS NOT HERE, ON PURPOSE. The four sentences about the proof that goes with a result: terms 5 (the
   introduction and point 3) and the rulebook, Articles 37 and 39. The owner approved their words too, but a
   guard in writtenPages.test.tsx ties the sentence of Article 37 to what the result form does with a picture,
   so those words move with the change of the form, in its own pull request. They stay what they were, in both
   languages, character for character.

   ORDER. Z4 says a member whose status is not active still opens his own profile. The portal does that once
   the pull request that makes GET /api/me carry the page the profile is drawn from (PR 515) is on main, so this
   migration must not reach a database before that change does. And the choice of showing the date of birth on a
   profile must not work before these words are published (PDL: "Izbor prikaza datuma rođenja (DR) ne radi pre
   objave"): this file does not wait for it, it is first.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the
   Serbian answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which
   writtenVerification.test.ts holds that fixture to in the other direction; the cases of writtenPages.test.tsx
   that name the sentences of Articles 10 and 11 and the sign-off; and, for both languages and for every edit, the
   test named above. WrittenPageTranslationAppliesTest now compares the table rows of the two languages on the
   rows as they stand, because it re-runs V43 and so could no longer agree with a Serbian text that gained the row
   JM adds.

   WHY A NEW FILE AND NOT AN EDIT OF V24, V26, V41, V43, V44, V46 OR V49: ADL A2. They have been applied, their
   checksums are in flyway_schema_history, and MigrationsAreImmutableTest holds Flyway to them.

   WHAT THIS DOES NOT TOUCH: no schema, no constraint, no key and no index; no row is added or removed, only the
   body of the 26 section texts above; and every other sentence of every page, which stays as it was even
   where this change leaves it less true than it was. The pull request lists those. */

do $edit$
declare
    edit         record;
    current_body text;
    seen         integer;
    total        integer := 0;
    problems     integer := 0;
    report       text := '';
begin
    for edit in
        select * from (values

            /* THE PRIVACY POLICY */
            ('A', 'politika-privatnosti', 2, 'sr',
             $old$| Rođendan, ako sami izaberete da ga objavite | Lista rođendana | Vaš pristanak, podrazumevano isključeno | Dok ga ne isključite |$old$,
             $new$| Datum rođenja na profilu (ceo datum ili samo godina), ako sami izaberete da ga objavite | Prikaz na vašem profilu | Vaš pristanak, podrazumevano isključeno | Dok ga ne isključite |$new$),
            ('A', 'politika-privatnosti', 2, 'en',
             $old$| Birthday, if you choose to publish it yourself | Birthday list | Your consent, off by default | Until you turn it off |$old$,
             $new$| Date of birth on your profile (full date or year only), if you choose to publish it yourself | Display on your profile | Your consent, off by default | Until you turn it off |$new$),
            ('JM', 'politika-privatnosti', 2, 'sr',
             $old$| Adresa elektronske pošte | Prijava i obavezna obaveštenja | Izvršenje ugovora | Sekcija 5 |$old$,
             $new$| Adresa elektronske pošte | Prijava i obavezna obaveštenja | Izvršenje ugovora | Sekcija 5 |
| Jezik pošte, srpski ili engleski | Da vam mejlovi stižu na jeziku koji ste izabrali; početni izbor je jezik strane na kojoj ste se učlanili | Izvršenje ugovora | Dok traje nalog |$new$),
            ('JM', 'politika-privatnosti', 2, 'en',
             $old$| E-mail address | Sign-in and mandatory notifications | Performance of contract | Section 5 |$old$,
             $new$| E-mail address | Sign-in and mandatory notifications | Performance of contract | Section 5 |
| Language of your e-mail, Serbian or English | So that e-mails reach you in the language you chose; the first choice is the language of the page on which you joined | Performance of contract | For as long as the account exists |$new$),
            ('B', 'politika-privatnosti', 3, 'sr',
             $old$Datum rođenja, adresa elektronske pošte, adresa za slanje, sve u vezi sa članarinom i plaćanjem, stanje virtuelnog balansa, veličina majice, ime oca, broj ličnog dokumenta, telefon, privatne poruke, interne beleške administracije, i sve u vezi sa roditeljskim potpisom: ime roditelja, srodstvo, datum, vreme i IP adresa.$old$,
             $new$Adresa elektronske pošte, adresa za slanje, sve u vezi sa članarinom i plaćanjem, stanje virtuelnog balansa, veličina majice, ime oca, broj ličnog dokumenta, telefon, privatne poruke, interne beleške administracije, i sve u vezi sa roditeljskim potpisom: ime roditelja, srodstvo, datum, vreme i IP adresa.$new$),
            ('B', 'politika-privatnosti', 3, 'en',
             $old$Date of birth, e-mail address, mailing address, everything related to the membership fee and payment, virtual balance, T-shirt size, father's name, ID document number, phone, private messages, internal administration notes, and everything related to the parental signature: the parent's name, relationship, date, time, and IP address.$old$,
             $new$E-mail address, mailing address, everything related to the membership fee and payment, virtual balance, T-shirt size, father's name, ID document number, phone, private messages, internal administration notes, and everything related to the parental signature: the parent's name, relationship, date, time, and IP address.$new$),
            ('C', 'politika-privatnosti', 3, 'sr',
             $old$Datum rođenja tražimo samo da bismo znali uzrasnu kategoriju i ne prikazujemo ga ni u punom ni u skraćenom obliku; javna je samo kategorija koja iz njega proizlazi. U podešavanjima možete sakriti profil od posetilaca koji nisu prijavljeni, ali ne i od ostalih članova, jer bi time nestao smisao zajedničkog rangiranja. Kad članarina istekne, profil se više ne prikazuje, a ime ostaje u istorijskim tabelama onih sezona u kojima ste bili član.$old$,
             $new$Datum rođenja tražimo da bismo znali uzrasnu kategoriju i ne prikazujemo ga ni u punom ni u skraćenom obliku, osim ako sami izaberete da se na vašem profilu vidi ceo datum ili samo godina; ako ne izaberete, ne vidi se ništa. Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor. U podešavanjima možete sakriti profil od svakoga ko nije aktivan član ni administracija, dakle od posetilaca koji nisu prijavljeni i od prijavljenih naloga bez aktivne članarine, ali ne i od ostalih aktivnih članova, jer bi time nestao smisao zajedničkog rangiranja. Kad članarina istekne, profil se više ne prikazuje, a ime ostaje u istorijskim tabelama onih sezona u kojima ste bili član.$new$),
            ('C', 'politika-privatnosti', 3, 'en',
             $old$We ask for the date of birth only so that we know the age category, and we do not display it in full or in shortened form; only the category that follows from it is public. In settings you can hide your profile from visitors who are not signed in, but not from other members, since that would remove the point of ranking together. When your membership fee expires, your profile is no longer displayed, and your name remains in the historical tables of the seasons in which you were a member.$old$,
             $new$We ask for the date of birth so that we know the age category, and we do not display it in full or in shortened form, unless you yourself choose to have the full date or only the year shown on your profile; if you choose nothing, nothing is shown. The category that follows from it is always public, whatever you choose. In settings you can hide your profile from anyone who is neither an active member nor the administration, that is, from visitors who are not signed in and from signed-in accounts without an active membership, but not from other active members, since that would remove the point of ranking together. When your membership fee expires, your profile is no longer displayed, and your name remains in the historical tables of the seasons in which you were a member.$new$),
            ('Q30', 'politika-privatnosti', 5, 'sr',
             $old$ime i članski broj nestaju, a gde god ste se pominjali ostaje anonimizovan zapis. Sam broj ostaje potrošen i ne dobija ga niko drugi.$old$,
             $new$ime i članski broj nestaju, a gde god ste se pominjali ostaje anonimizovan zapis. Izuzetak su novčani tragovi: ako ste u administraciji lige odobrili da neko plati manje ili da ne plati članarinu, vaše ime ostaje uz tu odluku u evidenciji uplata, članstava i virtuelnog balansa, jer je to zapis o novcu Udruženja. Sam broj ostaje potrošen i ne dobija ga niko drugi.$new$),
            ('Q30', 'politika-privatnosti', 5, 'en',
             $old$the name and member number disappear, and wherever you were mentioned an anonymized record remains. The number itself remains spent and is not given to anyone else.$old$,
             $new$the name and member number disappear, and wherever you were mentioned an anonymized record remains. The exception is the money trail: if, as part of the league's administration, you approved that someone pays less or pays no membership fee, your name stays with that decision in the records of payments, memberships, and the virtual balance, because that is a record of the Association's money. The number itself remains spent and is not given to anyone else.$new$),
            ('Z2', 'politika-privatnosti', 6, 'sr',
             $old$, a obaveštenja palite i gasite tamo$old$,
             $new$$new$),
            ('Z2', 'politika-privatnosti', 6, 'en',
             $old$, and you turn notifications on and off there$old$,
             $new$$new$),
            ('Z1 and', 'politika-privatnosti', 7, 'en',
             $old$cryptographic hash, a small number of people$old$,
             $new$cryptographic hash, and a small number of people$new$),
            ('Z1', 'politika-privatnosti', 7, 'sr',
             $old$, a nalog sa najširim pravima koristi dvofaktorsku prijavu$old$,
             $new$$new$),
            ('Z1', 'politika-privatnosti', 7, 'en',
             $old$, and the account with the broadest rights uses two-factor sign-in$old$,
             $new$$new$),
            ('E policy', 'politika-privatnosti', 7, 'sr',
             $old$Poslednja izmena: 28.09.2026.$old$,
             $new$Poslednja izmena: 10.10.2026.$new$),
            ('E policy', 'politika-privatnosti', 7, 'en',
             $old$Last amended: 28.09.2026.$old$,
             $new$Last amended: 10.10.2026.$new$),

            /* THE TERMS OF USE */
            ('Z5 terms', 'uslovi-koriscenja', 4, 'sr',
             $old$prava dobija u istom trenutku kao i svaki drugi član.$old$,
             $new$prava dobija u istom trenutku kao i svaki drugi član. Član čiji virtuelni balans pokriva celu članarinu prolazi bez koraka 4.$new$),
            ('Z5 terms', 'uslovi-koriscenja', 4, 'en',
             $old$at the same moment as any other member.$old$,
             $new$at the same moment as any other member. A member whose virtual balance covers the whole membership fee goes through without step 4.$new$),
            ('Caveat terms', 'uslovi-koriscenja', 5, 'sr',
             $old$naziv događaja, naziv trke, vrstu trke i vreme. Bodove$old$,
             $new$naziv događaja, naziv trke, vrstu trke, vreme, dužinu, uspon i spust. Bodove$new$),
            ('Caveat terms', 'uslovi-koriscenja', 5, 'en',
             $old$the event's name, the race's name, the type of race, and the time. It never$old$,
             $new$the event's name, the race's name, the type of race, the time, the length, the ascent, and the descent. It never$new$),
            ('Z3', 'uslovi-koriscenja', 8, 'sr',
             chr(10) || $old$3. Dugmetom na profilu možete ovlastiti drugog člana da vam preuzme nagradu.$old$,
             $new$$new$),
            ('Z3', 'uslovi-koriscenja', 8, 'en',
             chr(10) || $old$3. With a button on your profile you can authorize another member to collect your award for you.$old$,
             $new$$new$),
            ('Z3 count', 'uslovi-koriscenja', 8, 'sr',
             $old$Tri pravila vredi znati unapred:$old$,
             $new$Dva pravila vredi znati unapred:$new$),
            ('Z3 count', 'uslovi-koriscenja', 8, 'en',
             $old$Three rules are worth knowing in advance:$old$,
             $new$Two rules are worth knowing in advance:$new$),
            ('Z4', 'uslovi-koriscenja', 12, 'sr',
             $old$Kada takmičarski status nije aktivan, profil se ne prikazuje; to je namerno, jer je pristup sopstvenim trkačkim podacima jedna od stvari koje članstvo donosi.$old$,
             $new$Kada takmičarski status nije aktivan, profil se ne prikazuje drugima; svoj profil i dalje otvarate, dok ga administracija ne obriše.$new$),
            ('Z4', 'uslovi-koriscenja', 12, 'en',
             $old$When competitor status is not active, the profile is not displayed; this is deliberate, since access to your own racing data is one of the things membership brings.$old$,
             $new$When competitor status is not active, the profile is not displayed to others; you can still open your own profile, until the administration deletes it.$new$),
            ('E terms', 'uslovi-koriscenja', 12, 'sr',
             $old$Poslednja izmena: 28.09.2026.$old$,
             $new$Poslednja izmena: 10.10.2026.$new$),
            ('E terms', 'uslovi-koriscenja', 12, 'en',
             $old$Last amended: 28.09.2026.$old$,
             $new$Last amended: 10.10.2026.$new$),

            /* THE RULEBOOK */
            ('Z5 rulebook', 'pravilnik', 3, 'sr',
             $old$Status se aktivira po evidentiranoj uplati članarine ili po odluci Upravnog odbora kojom je član oslobođen plaćanja članarine.$old$,
             $new$Status se aktivira po evidentiranoj uplati članarine, po odluci Upravnog odbora kojom je član oslobođen plaćanja članarine, ili iz virtuelnog balansa člana.$new$),
            ('Z5 rulebook', 'pravilnik', 3, 'en',
             $old$Status is activated once the membership fee payment has been recorded, or by a decision of the Managing Board exempting the member from paying the fee.$old$,
             $new$Status is activated once the membership fee payment has been recorded, by a decision of the Managing Board exempting the member from paying the fee, or from the member's virtual balance.$new$),
            ('Z6', 'pravilnik', 3, 'sr',
             $old$Rok se meri po danu uplate, a ne po danu kada je liga uplatu evidentirala.$old$,
             $new$Rok se meri po danu kada je liga uplatu proknjižila.$new$),
            ('Z6', 'pravilnik', 3, 'en',
             $old$The deadline is measured by the day of payment, not by the day the league recorded it.$old$,
             $new$The deadline is measured by the day on which the league booked the payment.$new$),
            ('Caveat rulebook', 'pravilnik', 10, 'sr',
             $old$naziv događaja, naziv trke, vrstu trke i vreme. Takmičar$old$,
             $new$naziv događaja, naziv trke, vrstu trke, vreme, dužinu, uspon i spust. Takmičar$new$),
            ('Caveat rulebook', 'pravilnik', 10, 'en',
             $old$the event's name, the race's name, the type of race, and the time. A competitor$old$,
             $new$the event's name, the race's name, the type of race, the time, the length, the ascent, and the descent. A competitor$new$),
            ('D', 'pravilnik', 17, 'sr',
             $old$Datum rođenja se nikada ne prikazuje, ni u punom ni u skraćenom obliku. Javna je samo kategorija koja iz njega proizlazi. Isto važi za adresu elektronske pošte, adresu, sve u vezi sa članarinom i privatne poruke.$old$,
             $new$Datum rođenja se ne prikazuje ni u punom ni u skraćenom obliku, osim ako sami izaberete da se na vašem profilu vidi ceo datum ili samo godina; podrazumevano se ne prikazuje ništa. Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor. Adresa elektronske pošte, adresa, sve u vezi sa članarinom i privatne poruke nikada se ne prikazuju.$new$),
            ('D', 'pravilnik', 17, 'en',
             $old$The date of birth is never shown, either in full or in shortened form. Only the category that follows from it is public. The same applies to the e-mail address, the address, everything related to the membership fee, and private messages.$old$,
             $new$The date of birth is not shown, either in full or in shortened form, unless you yourself choose to have the full date or only the year shown on your profile; by default nothing is shown. The category that follows from it is always public, whatever you choose. The e-mail address, the address, everything related to the membership fee, and private messages are never shown.$new$),
            ('E rulebook', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 28.09.2026.$old$,
             $new$Poslednja izmena: 10.10.2026.$new$),
            ('E rulebook', 'pravilnik', 19, 'en',
             $old$Last amended: 28.09.2026.$old$,
             $new$Last amended: 10.10.2026.$new$)
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

        report := report || format(E'\n%s @ %s #%s %s: found %s',
            edit.label, edit.slug, edit.section_position, edit.in_language,
            case seen when 1 then 'once' else seen::text || ' times' end);

        if seen <> 1 then
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
