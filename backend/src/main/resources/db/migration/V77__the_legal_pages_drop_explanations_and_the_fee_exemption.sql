/* THE LEGAL PAGES DROP THEIR EXPLANATIONS AND THE FAMILIAR PHRASES, NO LONGER OFFER THE FEE EXEMPTION AS AN OPTION, AND
   NAME THE ONE EXCEPTION TO "NO REFUND", IN SERBIAN AND IN ENGLISH.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, "Urednička revizija Pravilnika, Uslova i Politike privatnosti
   (29.10.2026)", and under it the item "Odgovori na nacrt redakcije". The owner decided on 29.10.2026 that explanations,
   the history of changes and promotional sentences that carry no right, duty, deadline or criterion are struck; that
   rewordings are written in the warm tone of the decision of 22.10.2026; that the whole family of familiar phrases goes and
   not only "samo nam se javite"; that "League as a concept" (Article 50) becomes "Prateće lige"; and, in his own capitals,
   that nowhere in any text may the exemption from the membership fee be mentioned as an option. The authority of the
   Managing Board and its carrying out on the portal stay (the decision of 03.08.2026); only the text no longer offers it.
   The draft of the words is btl-produkt/primeri/redakcija/nacrt.md; the owner approved it with these differences, which
   win over the draft:
     1. The draft's PRAV-04 is NOT applied. Its alternative PRAV-04b is, with the owner's own sentence in place of the old
        paragraph: "Takmičarski status u nekoj sezoni zavisi od aktiviranog statusa na portalu, dok je rok plaćanja za
        preduslov rangiranja regulisan Članom 10." The dinar sentence before it stays.
     2. Terms of use, section 3 (USL-03): the sentence that explained the no-refund rule is replaced by his, quoted: "Uplaćene
        članarine se ne vraćaju, osim u izuzetnim slučajevima odluke Upravnog odbora." The sentence about the season's
        period before it stays.
     3. A block the draft did not have: Rulebook Article 12 (PRAV-31) takes the same exception, "osim u izuzetnim slučajevima
        odluke Upravnog odbora". The list of consequences of a disqualification in Article 63 ("Članarina se ne vraća.") is
        NOT touched, and neither is its English pair; the owner turned down the exception there.
     4. Privacy policy, section 5 (POL-11): "ako ste u administraciji lige doneli odluku o članarini nekog člana, vaše ime
        ostaje uz tu odluku".
     5. The three sign-off dates become 29.10.2026 (the day of this revision).
     6. Everything else is the draft word for word, PRAV-08 included: it says "12 ili više", which is what Category.java
        measures.
   The English is the translation of the same sentences and is the assistant's. The owner's two sentences and the draft's
   Serbian are his and not touched here.

   THE SIGN-OFF DATE MOVES ON ALL THREE PAGES. PDL, "Datum Poslednja izmena se pomera" (owner, 16.10.2026): the date moves on
   the documents whose text changes, and here all three change. "Poslednja izmena: 27.10.2026." (rulebook, V76),
   "Poslednja izmena: 22.10.2026." (terms, V71) and "Poslednja izmena: 24.10.2026." (policy) become "Poslednja izmena:
   29.10.2026." and the English "Last amended: ..." the same.

   HOW. The shape of V71, V73 and V76, and for its reason: every edit is asked how many times its old text stands in the text
   it is aimed at, and anything but exactly once is a problem. A section that already carries the new text is a problem
   too, and ONE THING IS DIFFERENT HERE: a strike leaves the sentence before it, so the new text is often a piece of the old
   one ("Tabele se osvežavaju odmah posle svakog verifikovanog rezultata." stands inside the sentence that adds "Periodičnog
   obračuna nema."). Asking whether the new text stands in the section would call every such strike an application already
   made, so the old text is taken out first and the question is asked of what is left. The edits are all asked and not
   stopped at the first problem; if there is any, one error lists every edit and what it found, the statement is rolled
   back with nothing changed, and Flyway refuses to start the backend.

   WHAT IT DOES NOT TOUCH: no schema, no key, no row added or removed; only the bodies of the sections the edits below name,
   and in them only the sentences named. The heading column of a section (static_page_section.heading) is not edited at
   all: the headings of Article 11 and Article 50 are lines INSIDE the body of a section, in Markdown. The administration
   screens that approve the exemption and the messages to the exempted member stay (PDL, same section).

   WHY A NEW FILE: ADL A2. The text was written by V24 and rewritten by V43, V46, V49, V71, V73 and V76, all applied.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that
   fixture to in the other direction; and TheWrittenPagesDropTheirExplanationsTest, which holds every edit in both
   languages and two floors over every section of the three pages: none of them names an exemption from the fee, and none
   says "samo nam se javite". */

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

            ('PRAV-01 Article 8', 'pravilnik', 2, 'sr',
             $old$Ako vam posle toga neki rezultat nedostaje, samo nam se javite: upisaćemo ga da vam profil bude potpun, s tim što on više ne ulazi u tabele, rang liste ni priznanja.$old$,
             $new$Ako vam posle toga neki rezultat nedostaje, obratite nam se i upisaćemo ga na vaš profil, s tim što on više ne ulazi u tabele, rang liste ni priznanja.$new$),

            ('PRAV-01 Article 8', 'pravilnik', 2, 'en',
             $old$If a result is still missing after that, just get in touch: we will enter it so that your profile is complete, but it no longer enters the tables, rankings, or awards.$old$,
             $new$If a result is still missing after that, contact us and we will enter it on your profile, but it no longer enters the tables, rankings, or awards.$new$),

            ('PRAV-02 Article 10', 'pravilnik', 3, 'sr',
             $old$po uplati izvršenoj zaključno sa 31. martom 2027. godine ili po odluci Upravnog odbora o oslobađanju od članarine donetoj do istog dana.$old$,
             $new$po uplati izvršenoj zaključno sa 31. martom 2027. godine.$new$),

            ('PRAV-02 Article 10', 'pravilnik', 3, 'en',
             $old$by a payment made by 31 March 2027 at the latest, or by a decision of the Managing Board exempting the member from the fee, adopted by that same day.$old$,
             $new$by a payment made by 31 March 2027 at the latest.$new$),

            ('PRAV-03 Article 11 heading', 'pravilnik', 4, 'sr',
             $old$### Član 11. Cena, rokovi i oslobađanje od članarine$old$,
             $new$### Član 11. Cena i rokovi$new$),

            ('PRAV-03 Article 11 heading', 'pravilnik', 4, 'en',
             $old$### Article 11. Price, deadlines, and exemption from the membership fee$old$,
             $new$### Article 11. Price and deadlines$new$),

            ('PRAV-04b Article 11', 'pravilnik', 4, 'sr',
             $old$Uplata u dinarima tu taksu nema.

Upravni odbor sme odlukom da redovnog člana oslobodi plaćanja članarine. Član oslobođen članarine ima ista prava kao svaki drugi: aktiviran takmičarski status, članski broj i pravo rangiranja pod uslovima iz Člana 10. Da li neko ima takmičarski status u nekoj sezoni meri se aktiviranim statusom na portalu. Do kada se plaća da bi se steklo pravo rangiranja govori Član 10.$old$,
             $new$Uplata u dinarima tu taksu nema.

Takmičarski status u nekoj sezoni zavisi od aktiviranog statusa na portalu, dok je rok plaćanja za preduslov rangiranja regulisan Članom 10.$new$),

            ('PRAV-04b Article 11', 'pravilnik', 4, 'en',
             $old$Payment in dinars carries no such fee.

The Managing Board may, by decision, exempt a regular member from paying the membership fee. A member exempted from the fee has the same rights as any other: activated competitor status, a member number, and the right to be ranked under the conditions of Article 10. Whether someone has competitor status in a given season is measured by the activated status on the portal. Article 10 states by when payment must be made to acquire the right to be ranked.$old$,
             $new$Payment in dinars carries no such fee.

Competitor status in a given season depends on the status activated on the portal, while the payment deadline for the precondition of ranking is governed by Article 10.$new$),

            ('PRAV-31 Article 12', 'pravilnik', 4, 'sr',
             $old$Uplaćena članarina se ne vraća, ni pri odjavi, ni pri prestanku članstva, ni pri diskvalifikaciji.$old$,
             $new$Uplaćena članarina se ne vraća, ni pri odjavi, ni pri prestanku članstva, ni pri diskvalifikaciji, osim u izuzetnim slučajevima odluke Upravnog odbora.$new$),

            ('PRAV-31 Article 12', 'pravilnik', 4, 'en',
             $old$A paid membership fee is not refunded, whether on cancellation, on termination of membership, or on disqualification.$old$,
             $new$A paid membership fee is not refunded, whether on cancellation, on termination of membership, or on disqualification, except in exceptional cases by decision of the Managing Board.$new$),

            ('PRAV-05 Article 22', 'pravilnik', 6, 'sr',
             $old$a uspon se u obračunu vrednuje više od spusta, jer je i teži.$old$,
             $new$a uspon se u obračunu vrednuje više od spusta.$new$),

            ('PRAV-05 Article 22', 'pravilnik', 6, 'en',
             $old$and ascent is weighted more heavily than descent in the calculation, since it is also harder.$old$,
             $new$and ascent is weighted more heavily than descent in the calculation.$new$),

            ('PRAV-06 Article 31', 'pravilnik', 8, 'sr',
             $old$i važi od 1. januara te godine. Prelazak na dan rođendana više ne postoji; to je izmena u odnosu na ranije pravilnike.$old$,
             $new$i važi od 1. januara te godine.$new$),

            ('PRAV-06 Article 31', 'pravilnik', 8, 'en',
             $old$and it applies from 1 January of that year. Moving up on your birthday no longer exists; this is a change from earlier rulebooks.$old$,
             $new$and it applies from 1 January of that year.$new$),

            ('PRAV-07 Article 32', 'pravilnik', 8, 'sr',
             $old$ili u svojoj uzrasnoj. Naziv govori o tome koliko ste dugo u ligi, a ne o tome koliko brzo trčite. Izbor za narednu sezonu$old$,
             $new$ili u svojoj uzrasnoj. Izbor za narednu sezonu$new$),

            ('PRAV-07 Article 32', 'pravilnik', 8, 'en',
             $old$or in your own age category. The name speaks of how long you have been in the league, not of how fast you run. You can change$old$,
             $new$or in your own age category. You can change$new$),

            ('PRAV-08 Article 32', 'pravilnik', 8, 'sr',
             $old$Čim u nekoj sezoni pređete tu granicu, od sledeće sezone prelazite u svoju uzrasnu kategoriju i tu ostajete.$old$,
             $new$Čim u nekoj sezoni skupite 12 ili više BTL bodova, od sledeće sezone prelazite u svoju uzrasnu kategoriju i tu ostajete.$new$),

            ('PRAV-08 Article 32', 'pravilnik', 8, 'en',
             $old$As soon as you cross that threshold in a season, you move into your age category from the next season and stay there.$old$,
             $new$As soon as you collect 12 or more BTL points in a season, you move into your age category from the next season and stay there.$new$),

            ('PRAV-09 Article 33', 'pravilnik', 9, 'sr',
             $old$portal sam popuni ono što ta trka zadaje, pa vam ostaje manje kucanja.$old$,
             $new$portal sam popuni ono što ta trka zadaje.$new$),

            ('PRAV-09 Article 33', 'pravilnik', 9, 'en',
             $old$the portal fills in whatever that race specifies by itself, so there is less for you to type.$old$,
             $new$the portal fills in whatever that race specifies by itself.$new$),

            ('PRAV-10 Article 33', 'pravilnik', 9, 'sr',
             $old$Ako trke nema u kalendaru, prijavite je svejedno: uz vaš rezultat napravićemo i događaj i trku.$old$,
             $new$Ako trke nema u kalendaru, rezultat možete da prijavite i tada, a uz njega ćemo napraviti i događaj i trku.$new$),

            ('PRAV-10 Article 33', 'pravilnik', 9, 'en',
             $old$If the race is not in the calendar, submit it anyway: we will create both the event and the race along with your result.$old$,
             $new$If the race is not in the calendar, you can still submit the result, and we will create both the event and the race along with it.$new$),

            ('PRAV-11 Article 35', 'pravilnik', 9, 'sr',
             $old$Link ka zvaničnim rezultatima je sasvim dovoljan. Ako ga nemate, pošaljite sliku, recimo snimak sata ili diplomu, i u par reči napišite zašto linka nema i šta se na slici vidi.$old$,
             $new$Dovoljan je link ka zvaničnim rezultatima. Ako ga nemate, pošaljite sliku, na primer snimak sata ili diplomu, i kratko napišite zašto linka nema i šta se na slici vidi.$new$),

            ('PRAV-11 Article 35', 'pravilnik', 9, 'en',
             $old$A link to the official results is quite enough. If you do not have one, send a picture, for example a watch screenshot or a certificate, and say in a few words why there is no link and what is seen in the picture.$old$,
             $new$A link to the official results is enough. If you do not have one, send a picture, for example a watch screenshot or a certificate, and briefly say why there is no link and what the picture shows.$new$),

            ('PRAV-12 Article 39', 'pravilnik', 11, 'sr',
             $old$Generalni plasman računa se iz svih trka u sezoni, a ne iz najboljeg izabranog broja rezultata. Svaka bodovana trka ulazi u zbir.$old$,
             $new$Generalni plasman računa se iz svih trka u sezoni. Svaka bodovana trka ulazi u zbir.$new$),

            ('PRAV-12 Article 39', 'pravilnik', 11, 'en',
             $old$The overall placing is calculated from all races in the season, not from the best selected number of results. Every scored race enters the total.$old$,
             $new$The overall placing is calculated from all races in the season. Every scored race enters the total.$new$),

            ('PRAV-13 Article 40', 'pravilnik', 11, 'sr',
             $old$Tabele se osvežavaju odmah posle svakog verifikovanog rezultata. Periodičnog obračuna nema.$old$,
             $new$Tabele se osvežavaju odmah posle svakog verifikovanog rezultata.$new$),

            ('PRAV-13 Article 40', 'pravilnik', 11, 'en',
             $old$The tables are refreshed immediately after every verified result. There is no periodic calculation.$old$,
             $new$The tables are refreshed immediately after every verified result.$new$),

            ('PRAV-14 Article 41', 'pravilnik', 11, 'sr',
             $old$Na listi je samo onaj ko je trčao i prethodne sezone, jer prva sezona nema na šta da naraste, i samo onaj čiji je prirast pozitivan, jer nazadovanje nije napredak.$old$,
             $new$Na listi je samo onaj ko je trčao i prethodne sezone, i samo onaj čiji je prirast pozitivan.$new$),

            ('PRAV-14 Article 41', 'pravilnik', 11, 'en',
             $old$The list includes only someone who also ran in the previous season, since a first season has nothing to grow from, and only someone whose increase is positive, since a decline is not progress.$old$,
             $new$The list includes only someone who also ran in the previous season, and only someone whose increase is positive.$new$),

            ('PRAV-15 Article 42', 'pravilnik', 11, 'sr',
             $old$Načelo je jedno: nagrađuje se veći obim, nikad efikasnost. Manji broj trka se ne nagrađuje ni u jednom poretku. Efikasnost nikad ne obara obim, ali sme da razreši potpuno izjednačenje.

Redosled merila, dok se izjednačenje ne razreši:$old$,
             $new$Redosled merila, dok se izjednačenje ne razreši:$new$),

            ('PRAV-15 Article 42', 'pravilnik', 11, 'en',
             $old$There is one principle: greater volume is rewarded, never efficiency. A smaller number of races is never rewarded in any ranking. Efficiency never outweighs volume, but it may break a complete tie.

The order of criteria, until the tie is broken:$old$,
             $new$The order of criteria, until the tie is broken:$new$),

            ('PRAV-16 Article 42', 'pravilnik', 11, 'sr',
             $old$Kod najbolje trke raniji datum se namerno ne koristi kao merilo, jer je u najčešćem slučaju izjednačenja reč o istoj trci istog dana.

### Član 43. Deljenog mesta nema$old$,
             $new$### Član 43. Deljenog mesta nema$new$),

            ('PRAV-16 Article 42', 'pravilnik', 11, 'en',
             $old$For the best race, an earlier date is deliberately not used as a criterion, since in the most common case of a tie it is the same race on the same day.

### Article 43. There is no shared placing$old$,
             $new$### Article 43. There is no shared placing$new$),

            ('PRAV-17 Article 43', 'pravilnik', 11, 'sr',
             $old$Kod timova to je stalan redosled koji liga vodi, jer tim nema članski broj; on ne znači ništa i postoji samo zato da tabela ne bi skakala pri svakom preračunu.$old$,
             $new$Kod timova to je stalan redosled koji liga vodi.$new$),

            ('PRAV-17 Article 43', 'pravilnik', 11, 'en',
             $old$For teams that is a fixed order the league keeps, since a team has no member number; it means nothing and exists only so that the table does not jump with every recalculation.$old$,
             $new$For teams that is a fixed order the league keeps.$new$),

            ('PRAV-18 Article 43', 'pravilnik', 11, 'sr',
             $old$3. Nagrada se ne duplira. Jedno mesto, jedan takmičar, jedan pehar.$old$,
             $new$3. Nagrada se ne duplira, pa za jedno mesto postoji jedan takmičar i jedan pehar.$new$),

            ('PRAV-18 Article 43', 'pravilnik', 11, 'en',
             $old$3. An award is never duplicated. One place, one competitor, one trophy.$old$,
             $new$3. An award is never duplicated, so each place has one competitor and one trophy.$new$),

            ('PRAV-19 Article 45', 'pravilnik', 12, 'sr',
             $old$Klub je organizacija za koju nastupate u stvarnom životu.$old$,
             $new$Klub je organizacija za koju nastupate van lige.$new$),

            ('PRAV-19 Article 45', 'pravilnik', 12, 'en',
             $old$A club is the organization you compete for in real life.$old$,
             $new$A club is the organization you compete for outside the league.$new$),

            ('PRAV-20 Article 47', 'pravilnik', 12, 'sr',
             $old$bez normalizacije po broju članova. Svaki bod i svaki dodatni član donose timu prednost, i to je namerno.$old$,
             $new$bez normalizacije po broju članova.$new$),

            ('PRAV-20 Article 47', 'pravilnik', 12, 'en',
             $old$with no normalization for the number of members. Every point and every additional member gives the team an advantage, and that is deliberate.$old$,
             $new$with no normalization for the number of members.$new$),

            ('PRAV-21 Article 50 heading', 'pravilnik', 13, 'sr',
             $old$### Član 50. Liga kao pojam$old$,
             $new$### Član 50. Prateće lige$new$),

            ('PRAV-21 Article 50 heading', 'pravilnik', 13, 'en',
             $old$### Article 50. League as a concept$old$,
             $new$### Article 50. Accompanying leagues$new$),

            ('PRAV-22 Article 51', 'pravilnik', 13, 'sr',
             $old$nije ničim ograničen. Daje sjajnu šansu svima da izvuku iz sebe svoj realan maksimum, i pobednik možda neće biti onaj ko pretrči najviše ili bude najbrži.$old$,
             $new$nije ničim ograničen.$new$),

            ('PRAV-22 Article 51', 'pravilnik', 13, 'en',
             $old$is not limited in any way. It gives everyone a great chance to draw out their real maximum, and the winner may not be the one who covers the most distance or is the fastest.$old$,
             $new$is not limited in any way.$new$),

            ('PRAV-23 Article 52', 'pravilnik', 13, 'sr',
             $old$Nije cilj stići prvi, cilj je tokom sat vremena sakupiti što više BTL bodova.$old$,
             $new$Cilj je da se tokom sat vremena sakupi što više BTL bodova.$new$),

            ('PRAV-23 Article 52', 'pravilnik', 13, 'en',
             $old$The goal is not to arrive first; the goal is to collect as many BTL points as possible within one hour.$old$,
             $new$The goal is to collect as many BTL points as possible within one hour.$new$),

            ('PRAV-24 Article 54', 'pravilnik', 14, 'sr',
             $old$Priznanje za koje se nije trkalo nije priznanje.

### Član 55. Posebna priznanja$old$,
             $new$### Član 55. Posebna priznanja$new$),

            ('PRAV-24 Article 54', 'pravilnik', 14, 'en',
             $old$An honour nobody raced for is not an honour.

### Article 55. Special honours$old$,
             $new$### Article 55. Special honours$new$),

            ('PRAV-25 Article 57', 'pravilnik', 14, 'sr',
             $old$Rok postoji da se preuzimanje ne razvlači u nedogled, a ne da bi neko ostao bez nagrade. Ličnu predaju$old$,
             $new$Ličnu predaju$new$),

            ('PRAV-25 Article 57', 'pravilnik', 14, 'en',
             $old$The deadline exists so that collection is not dragged out indefinitely, not so that someone is left without an award. You can always$old$,
             $new$You can always$new$),

            ('PRAV-26 Article 63', 'pravilnik', 16, 'sr',
             $old$ostaje anonimizovan zapis. Oznake "arhiviran takmičar" nema, jer takvo stanje ne postoji.$old$,
             $new$ostaje anonimizovan zapis.$new$),

            ('PRAV-26 Article 63', 'pravilnik', 16, 'en',
             $old$an anonymized record remains. There is no "archived competitor" marker, because no such state exists.$old$,
             $new$an anonymized record remains.$new$),

            ('PRAV-27 section 18', 'pravilnik', 18, 'sr',
             $old$Nisu svi jednake težine, i to se na njima vidi: od bronzanih, koje mnogi osvoje već u prvoj sezoni, preko srebrnih, do zlatnih, koji se skupljaju godinama.$old$,
             $new$Dukati su bronzani, srebrni i zlatni, po rastućoj težini.$new$),

            ('PRAV-27 section 18', 'pravilnik', 18, 'en',
             $old$Not all of them carry the same weight, and that shows on them: from bronze ones, which many win already in their first season, through silver, to gold ones, which are gathered over years.$old$,
             $new$Ducats are bronze, silver, and gold, in order of increasing difficulty.$new$),

            ('PRAV-28 Article 67', 'pravilnik', 19, 'sr',
             $old$Pravilnik se piše iznova za svaku sezonu i objavljuje se pre početka te sezone. Verzija koja je važila u jednoj sezoni ostaje objavljena, jer je zvanični rezultat te sezone donet po njoj.$old$,
             $new$Pravilnik se donosi iznova za svaku sezonu i objavljuje se pre početka te sezone. Verzija koja je važila u jednoj sezoni ostaje objavljena.$new$),

            ('PRAV-28 Article 67', 'pravilnik', 19, 'en',
             $old$The Rulebook is written anew for every season and published before that season begins. The version that applied in a given season remains published, since that season's official result was reached under it.$old$,
             $new$The Rulebook is adopted anew for every season and published before that season begins. The version that applied in a given season remains published.$new$),

            ('PRAV-29 Article 68', 'pravilnik', 19, 'sr',
             $old$upisuje u narednu verziju pravilnika, da se isto pitanje ne bi rešavalo dvaput različito.$old$,
             $new$upisuje u narednu verziju pravilnika.$new$),

            ('PRAV-29 Article 68', 'pravilnik', 19, 'en',
             $old$is written into the next version of the Rulebook, so that the same question is not resolved differently twice.$old$,
             $new$is written into the next version of the Rulebook.$new$),

            ('PRAV-30 sign-off', 'pravilnik', 19, 'sr',
             $old$Poslednja izmena: 27.10.2026.$old$,
             $new$Poslednja izmena: 29.10.2026.$new$),

            ('PRAV-30 sign-off', 'pravilnik', 19, 'en',
             $old$Last amended: 27.10.2026.$old$,
             $new$Last amended: 29.10.2026.$new$),

            ('USL-01 section 2', 'uslovi-koriscenja', 2, 'sr',
             $old$a profil se ne prikazuje. Članarina se, dakle, ne plaća za pristup sajtu nego za članstvo u ligi.$old$,
             $new$a profil se ne prikazuje.$new$),

            ('USL-01 section 2', 'uslovi-koriscenja', 2, 'en',
             $old$and the profile is not displayed. The membership fee is therefore not paid for access to the site but for membership in the league.$old$,
             $new$and the profile is not displayed.$new$),

            ('USL-02 section 3', 'uslovi-koriscenja', 3, 'sr',
             $old$Koliko košta članarina, do kada se plaća i ko može biti oslobođen plaćanja, naći ćete u cenovniku$old$,
             $new$Koliko košta članarina i do kada se plaća, naći ćete u cenovniku$new$),

            ('USL-02 section 3', 'uslovi-koriscenja', 3, 'en',
             $old$How much the membership fee costs, by when it is paid, and who can be exempted from paying it, you will find in the price list$old$,
             $new$How much the membership fee costs and by when it is paid, you will find in the price list$new$),

            ('USL-03 section 3', 'uslovi-koriscenja', 3, 'sr',
             $old$Pošto je to usluga slobodnog vremena za tačno određen period, uplaćenu članarinu ne vraćamo, ni kada se odjavite pre kraja sezone.$old$,
             $new$Uplaćene članarine se ne vraćaju, osim u izuzetnim slučajevima odluke Upravnog odbora.$new$),

            ('USL-03 section 3', 'uslovi-koriscenja', 3, 'en',
             $old$Since it is a leisure-time service for a precisely defined period, we do not refund a paid membership fee, even if you cancel before the end of the season.$old$,
             $new$Paid membership fees are not refunded, except in exceptional cases by decision of the Managing Board.$new$),

            ('USL-04 section 4', 'uslovi-koriscenja', 4, 'sr',
             $old$i tada dobijate članski broj. Član koga je Upravni odbor oslobodio plaćanja članarine prolazi bez koraka 4; članski broj i sva prava dobija u istom trenutku kao i svaki drugi član. Član čiji virtuelni balans$old$,
             $new$i tada dobijate članski broj. Član čiji virtuelni balans$new$),

            ('USL-04 section 4', 'uslovi-koriscenja', 4, 'en',
             $old$and that is when you receive your member number. A member exempted from the fee by the Managing Board goes through without step 4; they receive their member number and all rights at the same moment as any other member. A member whose virtual balance$old$,
             $new$and that is when you receive your member number. A member whose virtual balance$new$),

            ('USL-05 section 4', 'uslovi-koriscenja', 4, 'sr',
             $old$Članovima iz Srbije PayPal se ne prikazuje, i to nije stvar izbora nego propisa.$old$,
             $new$Članovima iz Srbije PayPal se ne prikazuje.$new$),

            ('USL-05 section 4', 'uslovi-koriscenja', 4, 'en',
             $old$PayPal is not shown to members from Serbia, and that is not a matter of choice but of regulation.$old$,
             $new$PayPal is not shown to members from Serbia.$new$),

            ('USL-06 section 5', 'uslovi-koriscenja', 5, 'sr',
             $old$Rezultati su srce lige i tu zaista računamo na vaše poštenje: prijavljujte samo trke koje ste sami istrčali. Sve o tome$old$,
             $new$Prijavljujte samo trke koje ste sami istrčali. Sve o tome$new$),

            ('USL-06 section 5', 'uslovi-koriscenja', 5, 'en',
             $old$Results are the heart of the league, and here we truly rely on your honesty: submit only races you ran yourself. Everything about$old$,
             $new$Submit only races you ran yourself. Everything about$new$),

            ('USL-07 section 6', 'uslovi-koriscenja', 6, 'sr',
             $old$a koji vam stoji ispisan na vašoj strani "Moja članarina", uz sam link. Iznos leže na vaš balans u trenutku aktivacije, ne u trenutku prijave, i o tome vas obaveštavamo porukom.$old$,
             $new$a koji je prikazan na vašoj strani "Moja članarina", uz sam link. Iznos se upisuje na vaš balans u trenutku aktivacije, a ne u trenutku prijave, i o tome vas obaveštavamo porukom.$new$),

            ('USL-07 section 6', 'uslovi-koriscenja', 6, 'en',
             $old$shown to you on your "My fee" page, next to the link itself. The amount lands on your balance at the moment of activation, not at the moment of application, and we notify you of this by message.$old$,
             $new$shown on your "My fee" page, next to the link itself. The amount is credited to your balance at the moment of activation, not at the moment of application, and we notify you of this by message.$new$),

            ('USL-08 section 9', 'uslovi-koriscenja', 9, 'sr',
             $old$Ovo je najvažnija sekcija ovih uslova, pa je izdvojena.

### BTL nije organizator tuđih trka$old$,
             $new$### BTL nije organizator tuđih trka$new$),

            ('USL-08 section 9', 'uslovi-koriscenja', 9, 'en',
             $old$This is the most important section of these terms, so it stands on its own.

### BTL is not the organizer of other people's races$old$,
             $new$### BTL is not the organizer of other people's races$new$),

            ('USL-09 section 9', 'uslovi-koriscenja', 9, 'sr',
             $old$za njih je liga organizator sa svime što uz to ide.$old$,
             $new$za njih je liga organizator, sa svim obavezama koje to nosi.$new$),

            ('USL-09 section 9', 'uslovi-koriscenja', 9, 'en',
             $old$for these the league is the organizer, with everything that comes with it.$old$,
             $new$for these the league is the organizer, with all the obligations that role carries.$new$),

            ('USL-10 section 9', 'uslovi-koriscenja', 9, 'sr',
             $old$Zahtev izvršavamo u najkraćem roku, bez rasprave i bez traženja obrazloženja.$old$,
             $new$Zahtev izvršavamo u najkraćem roku i bez traženja obrazloženja.$new$),

            ('USL-10 section 9', 'uslovi-koriscenja', 9, 'en',
             $old$We carry out the request as soon as possible, without argument and without asking for a justification.$old$,
             $new$We carry out the request as soon as possible and without asking for a justification.$new$),

            ('USL-11 sign-off', 'uslovi-koriscenja', 11, 'sr',
             $old$Poslednja izmena: 22.10.2026.$old$,
             $new$Poslednja izmena: 29.10.2026.$new$),

            ('USL-11 sign-off', 'uslovi-koriscenja', 11, 'en',
             $old$Last amended: 22.10.2026.$old$,
             $new$Last amended: 29.10.2026.$new$),

            ('POL-01 section 2', 'politika-privatnosti', 2, 'sr',
             $old$se traži ali nije obavezan, jer lična karta se izdaje sa 16. Vidi ga$old$,
             $new$se traži, ali nije obavezan. Vidi ga$new$),

            ('POL-01 section 2', 'politika-privatnosti', 2, 'en',
             $old$is requested from a member younger than 16 but is not mandatory, since an ID card is issued at 16. Only the administration and you see it$old$,
             $new$is requested from a member younger than 16, but is not mandatory. Only the administration and you see it$new$),

            ('POL-02 section 2', 'politika-privatnosti', 2, 'sr',
             $old$drugima se ne prikazuje nigde i stoji odvojeno od podataka koje čitaju ekrani portala, u sopstvenoj tabeli sa sopstvenim pravom pristupa$old$,
             $new$drugima se ne prikazuje nigde$new$),

            ('POL-02 section 2', 'politika-privatnosti', 2, 'en',
             $old$it is not displayed to others anywhere and stands apart from the data the portal's screens read, in its own table with its own access rights$old$,
             $new$it is not displayed to others anywhere$new$),

            ('POL-03 section 3 heading', 'politika-privatnosti', 3, 'sr',
             $old$### Nikada se ne prikazuje$old$,
             $new$### Podaci koji nisu javni$new$),

            ('POL-03 section 3 heading', 'politika-privatnosti', 3, 'en',
             $old$### Never displayed$old$,
             $new$### Data that is not public$new$),

            ('POL-04 section 3', 'politika-privatnosti', 3, 'sr',
             $old$ali ne i od ostalih aktivnih članova, jer bi time nestao smisao zajedničkog rangiranja.$old$,
             $new$ali ne i od ostalih aktivnih članova.$new$),

            ('POL-04 section 3', 'politika-privatnosti', 3, 'en',
             $old$but not from other active members, since that would remove the point of ranking together.$old$,
             $new$but not from other active members.$new$),

            ('POL-05 section 3', 'politika-privatnosti', 3, 'sr',
             $old$Ako tražite uklanjanje, postupamo srazmerno: sliku na kojoj ste vi predmet uklanjamo, a sa grupne uklanjamo ono što vas identifikuje.$old$,
             $new$Ako tražite uklanjanje, sliku na kojoj ste vi predmet uklanjamo, a sa grupne uklanjamo ono što vas identifikuje.$new$),

            ('POL-05 section 3', 'politika-privatnosti', 3, 'en',
             $old$If you request removal, we act proportionately: we remove a picture in which you are the subject, and from a group picture we remove whatever identifies you.$old$,
             $new$If you request removal, we remove a picture in which you are the subject, and from a group picture we remove whatever identifies you.$new$),

            ('POL-06 section 3', 'politika-privatnosti', 3, 'sr',
             $old$i datum, vreme i IP adresu sa koje je dat, jer je to ono što potpis čini dokazivim. Roditelj vodi$old$,
             $new$i datum, vreme i IP adresu sa koje je dat. Roditelj vodi$new$),

            ('POL-06 section 3', 'politika-privatnosti', 3, 'en',
             $old$and the date, time, and IP address it was given from, since that is what makes the signature provable. The parent maintains$old$,
             $new$and the date, time, and IP address it was given from. The parent maintains$new$),

            ('POL-07 section 4', 'politika-privatnosti', 4, 'sr',
             $old$u lokalnom skladištu. Pravno je to isto što i kolačić, pa piše ovde iako se tako ne zove. Postavlja se tek$old$,
             $new$u lokalnom skladištu. Postavlja se tek$new$),

            ('POL-07 section 4', 'politika-privatnosti', 4, 'en',
             $old$in local storage. Legally that is the same as a cookie, so it is listed here even though it is not called one. It is set only once$old$,
             $new$in local storage. It is set only once$new$),

            ('POL-08 section 4', 'politika-privatnosti', 4, 'sr',
             $old$trake za pristanak: pristanak se traži za ono što nije nužno, a ovde ničega takvog nema$old$,
             $new$trake za pristanak$new$),

            ('POL-08 section 4', 'politika-privatnosti', 4, 'en',
             $old$consent banner either: consent is asked for whatever is not necessary, and there is nothing of the kind here$old$,
             $new$consent banner either$new$),

            ('POL-09 section 4', 'politika-privatnosti', 4, 'sr',
             $old$. Ako to jednog dana uvedemo, ova strana će to reći pre nego što se uvede.

Oglasnih$old$,
             $new$.

Oglasnih$new$),

            ('POL-09 section 4', 'politika-privatnosti', 4, 'en',
             $old$. If we ever introduce that, this page will say so before it is introduced.

There are no advertising$old$,
             $new$.

There are no advertising$new$),

            ('POL-10 section 5', 'politika-privatnosti', 5, 'sr',
             $old$Dalje, dva načina se namerno razlikuju. Po isteku pet godina$old$,
             $new$Po isteku pet godina$new$),

            ('POL-10 section 5', 'politika-privatnosti', 5, 'en',
             $old$Beyond that, the two paths deliberately differ. Once the five years expire$old$,
             $new$Once the five years expire$new$),

            ('POL-11 section 5', 'politika-privatnosti', 5, 'sr',
             $old$ako ste u administraciji lige odobrili da neko plati manje ili da ne plati članarinu, vaše ime ostaje uz tu odluku$old$,
             $new$ako ste u administraciji lige doneli odluku o članarini nekog člana, vaše ime ostaje uz tu odluku$new$),

            ('POL-11 section 5', 'politika-privatnosti', 5, 'en',
             $old$you approved that someone pays less or pays no membership fee, your name stays with that decision$old$,
             $new$you made a decision about a member's membership fee, your name stays with that decision$new$),

            ('POL-12 section 6', 'politika-privatnosti', 6, 'sr',
             $old$Bez obrasca, bez obrazloženja i besplatno. Rok je bez odlaganja,$old$,
             $new$Ne tražimo obrazac ni obrazloženje, a ostvarivanje prava je besplatno. Rok je bez odlaganja,$new$),

            ('POL-12 section 6', 'politika-privatnosti', 6, 'en',
             $old$No form, no justification, and free of charge. The deadline is without undue delay,$old$,
             $new$We do not ask for a form or a justification, and exercising your rights is free of charge. The deadline is without undue delay,$new$),

            ('POL-13 section 6', 'politika-privatnosti', 6, 'sr',
             $old$Pre nego što bilo šta pošaljemo proveravamo da ste to zaista vi, jer su podaci poslati pogrešnoj osobi gori od podataka koji kasne.$old$,
             $new$Pre nego što bilo šta pošaljemo, proveravamo da ste to zaista vi.$new$),

            ('POL-13 section 6', 'politika-privatnosti', 6, 'en',
             $old$Before we send anything, we verify that it is really you, because data sent to the wrong person is worse than data that is late.$old$,
             $new$Before we send anything, we verify that it is really you.$new$),

            ('POL-14 section 6', 'politika-privatnosti', 6, 'sr',
             $old$Saglasnost za kolačiće se ne povlači jer se ne daje: portal postavlja samo dva kolačića, bezbednosni i kolačić sesije, bez kojih slanje obrasca i prijava ne mogu bezbedno da rade, a jedino što još čuva u vašem pregledaču je izbor teme, koji ste sami zatražili; ni za jedno se pristanak ne traži (sekcija 4).$old$,
             $new$Saglasnost za kolačiće se ne povlači jer se ne daje (sekcija 4).$new$),

            ('POL-14 section 6', 'politika-privatnosti', 6, 'en',
             $old$Consent for cookies is not withdrawn because it is not given: the portal sets only two cookies, the security cookie and the session cookie, without which submitting a form and signing in cannot work safely, and the only other thing it keeps in your browser is the choice of theme, which you requested yourself; consent is not asked for either one (section 4).$old$,
             $new$Consent for cookies is not withdrawn because it is not given (section 4).$new$),

            ('POL-15 section 6', 'politika-privatnosti', 6, 'sr',
             $old$Dugmeta koje jednim klikom preuzima sve podatke nema; kopiju pripremamo ručno, u CSV ili JSON obliku ako to tražite.$old$,
             $new$Kopiju podataka pripremamo ručno, u CSV ili JSON obliku, kad to tražite.$new$),

            ('POL-15 section 6', 'politika-privatnosti', 6, 'en',
             $old$There is no button that fetches all your data in one click; we prepare a copy by hand, in CSV or JSON form, if you request it.$old$,
             $new$We prepare a copy of your data by hand, in CSV or JSON form, when you request it.$new$),

            ('POL-16 section 6', 'politika-privatnosti', 6, 'sr',
             $old$Prvo nam pišite, jer se većina stvari reši u jednoj poruci.$old$,
             $new$Prvo nam pišite na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$new$),

            ('POL-16 section 6', 'politika-privatnosti', 6, 'en',
             $old$Write to us first, since most things are resolved in a single message.$old$,
             $new$Write to us first at [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$new$),

            ('POL-17 section 7', 'politika-privatnosti', 7, 'sr',
             $old$Nijedan sistem nije potpuno bezbedan; ako dođe do povrede podataka koja može da vam naškodi, obaveštavamo vas$old$,
             $new$Ako dođe do povrede podataka koja može da vam naškodi, obaveštavamo vas$new$),

            ('POL-17 section 7', 'politika-privatnosti', 7, 'en',
             $old$No system is completely secure; if a data breach occurs that could harm you, we notify you$old$,
             $new$If a data breach occurs that could harm you, we notify you$new$),

            ('POL-18 section 7', 'politika-privatnosti', 7, 'sr',
             $old$Portal automatski računa bodove, plasman i dukate, što je matematika po javno poznatim pravilima.$old$,
             $new$Portal bodove, plasman i dukate računa automatski, po pravilima lige.$new$),

            ('POL-18 section 7', 'politika-privatnosti', 7, 'en',
             $old$The portal automatically calculates points, placing, and ducats, which is arithmetic under publicly known rules.$old$,
             $new$The portal calculates points, placing, and ducats automatically, under the league's rules.$new$),

            ('POL-19 sign-off', 'politika-privatnosti', 7, 'sr',
             $old$Poslednja izmena: 24.10.2026.$old$,
             $new$Poslednja izmena: 29.10.2026.$new$),

            ('POL-19 sign-off', 'politika-privatnosti', 7, 'en',
             $old$Last amended: 24.10.2026.$old$,
             $new$Last amended: 29.10.2026.$new$)

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
