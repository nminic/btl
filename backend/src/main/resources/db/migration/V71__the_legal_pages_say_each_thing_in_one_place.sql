/* THE THREE LEGAL PAGES SAY EACH THING IN ONE PLACE, IN SERBIAN AND IN ENGLISH: THE RULEBOOK KEEPS THE COMPETITION AND
   THE FEE, THE TERMS OF USE KEEP THE ACCOUNT AND CONDUCT, THE PRIVACY POLICY KEEPS THE DATA, AND ALL THREE ARE SIGNED OFF
   ON 22.10.2026.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry "Uprošćavanje pravnih tekstova (22.10.2026)". The owner, on
   22.10.2026, approving the proposal he was shown: "OK su pravni tekstovi. Izmeni sva dokumenta po predlogu, ali dobro
   obrati pažnju da je sve lepo numerisano i da radi kako je predviđeno. Onda prevedi i sve na engleski tako da bude
   ažurno." Every sentence of the proposal is the assistant's wording that the owner approved, not the owner's own, and so
   is the English. Three corrections were added to the proposal before it was carried out, each derived from what was
   already written rather than decided anew: "Ako ne obnovite takmičarski status" (the terms themselves tell membership
   from competitor status, section 2), "Pravilnik uređuje takmičenje i članarinu" (the price list has lived in the
   rulebook since 22.08.2026), and the session cookie's 30 days (SessionLife.LASTS, owner 11.09.2026). The same entry
   records, in the owner's words, that the tone of these pages is "prirodan i topao, a ne suvoparan pravni".

   WHAT CHANGES, BY DOCUMENT.
     Rulebook. Article 3 says it governs the competition and the fee, and that it prevails on either. Article 8 says a
     member submits last season's results until 1 January at 10:00 and asks the league after that. Articles 9, 12 and 13
     go (Article 56, the terms and the policy carry them). Article 10 points to the terms. Articles 14 and 15 become one,
     without "Uplate se primaju od 15. oktobra 2026.", which the sentence on selling from 15 October already says.
     Article 36 says the rookie category is chosen. Articles 37, 40, 41 and 42 become one article on how a result is
     submitted, and the 48 hours move into the article on verification. Article 39 says a link is enough and a picture
     needs a few words. Article 64 keeps the cups and who pays the post. The second paragraph of Article 72, which
     repeated Article 71, goes. Articles 73 to 76 become one article that points to the privacy policy and keeps the
     consent to photographs. The articles are renumbered; 78 become 68.
     Terms of use. Section 1 says what the rulebook governs, when it prevails, and that awards are in it. Section 2 takes
     the one sentence of the rulebook's Article 12 nothing else carried ("Obe granice se mere na dan popunjavanja
     prijave"). Sections 3, 5 and 7 point to the rulebook. Step 3 of section 4 is one sentence. Section 8 (awards) goes and
     sections 9 to 12 become 8 to 11. Section 9 writes "Round 'n' Around" as the rulebook does. Section 12 says in prose
     what its table said, adds that cancelling a season is not leaving the Association (owner, 22.10.2026, "Može,
     dodaj.") and leaves keeping and deleting data to the privacy policy.
     Privacy policy. Two cookies, in sections 2, 4 and 6, the session cookie living until sign-out and at most 30 days
     from the last use. The security cookie lives until the end of the visit: CookieCsrfTokenRepository of
     spring-security-web 7.1.0 sets cookieMaxAge to -1 in its constructor and ApiSecurity's csrf.spa() gives it no
     customizer, read out of the jar on 22.10.2026, as V26 read it before. Section 3 adds "statistika" to what is public,
     so that nothing the rulebook's old Article 73 made public is left without a home now that the policy is the one list
     (PDL, the decision of 13.09.2026 "Javno je ono što Član 73 nabraja", amended 22.10.2026).

   THE NUMBERS. Rulebook, old to new: 1-8 stay; 10 to 9; 11 to 10; 14 and 15 to 11; 16 to 12; 17 to 13; 18-36 to 14-32;
   37 (with 40, 41, 42) to 33; 38 to 34; 39 to 35; 43-72 to 36-65; 73 (with 74, 75, 76) to 66; 77 to 67; 78 to 68. Every
   reference inside the three pages that names an article or a section is rewritten to the number it now points at, in
   both languages, and the edits below name each one. Sections of the rulebook and of the policy keep their numbers.

   THE SIGN-OFF DATE. PDL, "Datum Poslednja izmena se pomera" (owner, 16.10.2026): the date moves on the documents whose
   text changes. All three change. The rulebook's 16.10.2026 and the terms' 10.10.2026 become 22.10.2026, in both
   languages; the policy already says 22.10.2026 (V70). 22.10.2026 is a day chosen by the person who asked for this file
   as the day it reaches QA, not the owner's own word, and it is moved before the merge if the file reaches QA on another
   day.

   HOW. The shape of V70, and for its reason: every edit is asked how many times its old text stands in the text it is
   aimed at, and anything but exactly once is a problem, as is a text that already holds the new one. All edits are asked
   before anything stops; if there is any problem, one error lists every edit and what it found, the statement is rolled
   back, and Flyway refuses to start the backend. Two things are new to this shape. An edit may be aimed at a heading
   rather than a body (the four sections of the terms that move up). And an edit may take text out, with an empty new
   text, for which there is nothing to ask about already being there. Each heading of an article is edited as its whole
   line ("### Član 18. Trke koje ulaze u bodovanje"), so a renumbering cannot land on another article whose number it
   shares. Removing section 8 of the terms is its own block below: it asks for the section word for word in both
   languages, removes exactly one, and moves exactly four.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no page, no title; the president's word; the
   formula, the categories, the deadlines, the 50 participants, the threshold of 12 points, teams, pairs, ties, awards,
   measures and their procedure (but for the repeated paragraph), the price list and its amounts, ducats, the table of
   processors and the periods of keeping.

   WHY A NEW FILE: ADL A2. V24 to V70 have been applied, their checksums are in flyway_schema_history, and
   MigrationsAreImmutableTest holds Flyway to them.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian
   answer of this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts
   holds that fixture to in the other direction; writtenPages.test.tsx, whose reference check fails on any number that
   points at no article; WrittenPageTranslationAppliesTest, which pairs every English heading with its Serbian one; and,
   for this file's own claims in both languages, TheWrittenPagesSayEachThingInOnePlaceTest. */

do $edit$
declare
    edit         record;
    current_text text;
    seen         integer;
    already      boolean;
    total        integer := 0;
    problems     integer := 0;
    report       text := '';
begin
    for edit in
        select * from (values

            ('Article 3', 'pravilnik', 1, 'sr', 'body',
             $old$- Pravilnik uređuje isključivo takmičenje.
- Uslovi korišćenja uređuju odnos između vas i udruženja: nalog, članarinu i obaveze pri korišćenju portala.
- Ako se pravilnik i uslovi korišćenja razilaze u nečemu što se tiče takmičenja, važi pravilnik.$old$,
             $new$- Pravilnik uređuje takmičenje i članarinu.
- Uslovi korišćenja uređuju odnos između vas i udruženja: nalog i obaveze pri korišćenju portala.
- Ako se pravilnik i uslovi korišćenja razilaze u nečemu što se tiče takmičenja ili članarine, važi pravilnik.$new$),

            ('Article 3', 'pravilnik', 1, 'en', 'body',
             $old$- The Rulebook governs the competition exclusively.
- The terms of use govern the relationship between you and the association: your account, the membership fee, and your obligations when using the portal.
- If the Rulebook and the terms of use differ on anything concerning the competition, the Rulebook prevails.$old$,
             $new$- The Rulebook governs the competition and the membership fee.
- The terms of use govern the relationship between you and the association: your account and your obligations when using the portal.
- If the Rulebook and the terms of use differ on anything concerning the competition or the membership fee, the Rulebook prevails.$new$),

            ('Article 8', 'pravilnik', 2, 'sr', 'body',
             $old$Zamrznuti snimak tabela čuva se kao zvanični rezultat sezone i više se ne menja.

Rezultate sa te sezone i posle zamrzavanja smete unositi, da bi vaš profil bio potpun, ali oni ne ulaze ni u jednu tabelu, rang listu ni priznanje.$old$,
             $new$Kad se tabele zamrznu, one postaju zvanični rezultat sezone i više se ne menjaju. Rezultate prethodne sezone možete da prijavite sami do 1. januara u 10:00. Ako vam posle toga neki rezultat nedostaje, samo nam se javite: upisaćemo ga da vam profil bude potpun, s tim što on više ne ulazi u tabele, rang liste ni priznanja.$new$),

            ('Article 8', 'pravilnik', 2, 'en', 'body',
             $old$The frozen snapshot of the tables is kept as the season's official result and is no longer changed.

You may still submit results from that season after freezing, so that your profile is complete, but they do not enter any table, ranking, or award.$old$,
             $new$When the tables are frozen, they become the season's official result and no longer change. You can submit results from the previous season yourself until 1 January at 10:00. If a result is still missing after that, just get in touch: we will enter it so that your profile is complete, but it no longer enters the tables, rankings, or awards.$new$),

            ('Article 9 removed', 'pravilnik', 2, 'sr', 'body',
             $old$

### Član 9. Rokovi za promene tima i trkačkog para

Promene tima moraju biti završene do 31. decembra, da bi važile u narednoj sezoni. Trkački par nije vezan nijednim rokom: raskida ga svaka strana, bilo kada, i raskid važi odmah. Detalji su u sekciji 12.$old$,
             $new$$new$),

            ('Article 9 removed', 'pravilnik', 2, 'en', 'body',
             $old$

### Article 9. Deadlines for team and racing pair changes

Team changes must be completed by 31 December to take effect in the following season. A racing pair is bound by no deadline: it may be ended by either side, at any time, and the ending takes effect immediately. Details are in section 12.$old$,
             $new$$new$),

            ('Article 10', 'pravilnik', 3, 'sr', 'body',
             $old$Član lige je takmičar koji je primljen u članstvo Udruženja i kome je aktiviran takmičarski status za sezonu. Status se aktivira po evidentiranoj uplati članarine, po odluci Upravnog odbora kojom je član oslobođen plaćanja članarine, ili iz virtuelnog balansa člana. Aktivacijom dobijate članski broj oblika `000001`, šestocifren i jedinstven, istog formata za oba pola. Broj ostaje isti kroz sve sezone i prikazuje se javno pored vašeg imena.

Dok takmičarski status nije aktivan, nalog postoji, ali takmičar nije vidljiv na portalu i ne može da prijavljuje rezultate.$old$,
             $new$Član lige je takmičar primljen u Udruženje kome je za sezonu aktiviran takmičarski status. Kako se postaje član i sve o članskom broju objašnjavaju [uslovi korišćenja](/uslovi-koriscenja).$new$),

            ('Article 10', 'pravilnik', 3, 'en', 'body',
             $old$A member of the league is a competitor who has been admitted to membership of the Association and whose competitor status has been activated for the season. Status is activated once the membership fee payment has been recorded, by a decision of the Managing Board exempting the member from paying the fee, or from the member's virtual balance. Upon activation you receive a member number in the form `000001`, six digits, unique, in the same format for both sexes. The number stays the same through every season and is displayed publicly next to your name.

While competitor status is not active, the account exists, but the competitor is not visible on the portal and cannot submit results.$old$,
             $new$A member of the league is a competitor admitted to the Association whose competitor status has been activated for the season. How to become a member, and everything about the member number, is explained in the [terms of use](/uslovi-koriscenja).$new$),

            ('Articles 12 and 13 removed', 'pravilnik', 3, 'sr', 'body',
             $old$

### Član 12. Uzrast

Donja granica uzrasta za članstvo ne postoji.

Za člana mlađeg od 14 godina potrebna je prethodna saglasnost roditelja ili staratelja. Za članove mlađe od 16 godina nalog na portalu održava roditelj ili staratelj. Ko ima 14 ili 15 godina sam prihvata članstvo, a nalog mu i dalje održava roditelj ili staratelj.

Obe granice se mere na dan popunjavanja prijave, a ne kroz sezonu.

### Član 13. Odgovornost i zdravstvena sposobnost

Balkanska trkačka liga po pravilu ne organizuje trke: ne postavlja staze, ne meri vreme i ne prima prijave, nego vodi rangiranje na osnovu rezultata koje su izmerili organizatori. Izuzetak su sopstvena takmičenja lige iz sekcije 13, pre svega Round 'n' Around ultramaraton i BTL dezorijentiring, koja liga organizuje sama.

Za sve na trci, uključujući stazu i njenu bezbednost, odgovoran je organizator tog događaja. Za sopstveno zdravlje i za procenu da li ste za neku trku spremni odgovarate sami, i to potvrđujete izjavom o zdravstvenoj sposobnosti pri registraciji.$old$,
             $new$$new$),

            ('Articles 12 and 13 removed', 'pravilnik', 3, 'en', 'body',
             $old$

### Article 12. Age

There is no minimum age for membership.

For a member younger than 14, the prior consent of a parent or guardian is required. For members younger than 16, the account on the portal is maintained by a parent or guardian. Anyone who is 14 or 15 accepts membership themselves, while their account is still maintained by a parent or guardian.

Both thresholds are measured on the day the application is submitted, not throughout the season.

### Article 13. Liability and fitness to compete

As a rule, the Balkanska trkačka liga does not organize races: it does not lay out courses, does not time them, and does not accept entries, but keeps rankings based on results measured by the organizers. The exception is the league's own competitions from section 13, chiefly the Round 'n' Around ultramarathon and the BTL dezorijentiring, which the league organizes itself.

For everything at the race, including the course and its safety, the organizer of that event is responsible. You are responsible for your own health and for judging whether you are fit for a given race, which you confirm with a statement of fitness to compete at registration.$old$,
             $new$$new$),

            ('Articles 14 and 15 merged', 'pravilnik', 4, 'sr', 'body',
             $old$### Član 14. Cena i rokovi

Visinu članarine i rokove plaćanja utvrđuje Upravni odbor posebnom odlukom.

[[gallery]]

Članarina se plaća za celu sezonu, a cena zavisi od datuma uplate.

Uz uplatu u evrima naplaćuje se taksa za obradu plaćanja od 3 EUR. To nije deo članarine nego trošak obrade uplate kod platnog posrednika, i ne donosi nikakvo pravo iz Člana 17. Uplata u dinarima tu taksu nema.

Cenovnik se ponavlja svake godine: od 15. oktobra se prodaje naredna sezona, a od 1. januara do 14. oktobra tekuća, bez prava na rangiranje.

Juniorska cena se meri kroz celu sezonu, ne na jedan dan. Ko u sezoni za koju se prijavljuje bar jedan dan ima 14 godina ili manje, plaća juniorsku cenu. Onaj ko puni 15 u toku te sezone, još plaća juniorsku.

Uplate se primaju od 15. oktobra 2026.

### Član 15. Dinarska cena i oslobađanje od članarine

Dinarska cena je fiksirana za celu sezonu i ne menja se sa kursom. Član sa adresom u Srbiji plaća dinarski iznos, član iz inostranstva iznos u evrima, uz koji ide i taksa za obradu plaćanja iz Člana 14, kao odvojena stavka a ne kao veća članarina.

Upravni odbor sme odlukom da redovnog člana oslobodi plaćanja članarine. Član oslobođen članarine ima ista prava kao svaki drugi: aktiviran takmičarski status, članski broj i pravo rangiranja pod uslovima iz Člana 11. Da li neko ima takmičarski status u nekoj sezoni meri se aktiviranim statusom na portalu. Do kada se plaća da bi se steklo pravo rangiranja govori Član 11.

$old$,
             $new$### Član 11. Cena, rokovi i oslobađanje od članarine

Visinu članarine i rokove plaćanja utvrđuje Upravni odbor posebnom odlukom.

[[gallery]]

Članarina se plaća za celu sezonu, a cena zavisi od datuma uplate.

Cenovnik se ponavlja svake godine: od 15. oktobra se prodaje naredna sezona, a od 1. januara do 14. oktobra tekuća, bez prava na rangiranje.

Juniorska cena se meri kroz celu sezonu, ne na jedan dan. Ko u sezoni za koju se prijavljuje bar jedan dan ima 14 godina ili manje, plaća juniorsku cenu. Onaj ko puni 15 u toku te sezone, još plaća juniorsku.

Dinarska cena je fiksirana za celu sezonu i ne menja se sa kursom. Član sa adresom u Srbiji plaća dinarski iznos, a član iz inostranstva iznos u evrima, uz koji se naplaćuje i taksa za obradu plaćanja od 3 EUR, kao odvojena stavka a ne kao veća članarina. Taksa nije deo članarine nego trošak obrade uplate kod platnog posrednika, i ne donosi nikakvo pravo iz Člana 13. Uplata u dinarima tu taksu nema.

Upravni odbor sme odlukom da redovnog člana oslobodi plaćanja članarine. Član oslobođen članarine ima ista prava kao svaki drugi: aktiviran takmičarski status, članski broj i pravo rangiranja pod uslovima iz Člana 10. Da li neko ima takmičarski status u nekoj sezoni meri se aktiviranim statusom na portalu. Do kada se plaća da bi se steklo pravo rangiranja govori Član 10.

$new$),

            ('Articles 14 and 15 merged', 'pravilnik', 4, 'en', 'body',
             $old$### Article 14. Price and deadlines

The amount of the membership fee and the payment deadlines are set by the Managing Board through a separate decision.

[[gallery]]

The membership fee is paid for the whole season, and the price depends on the date of payment.

A payment processing fee of 3 EUR is charged on payment in euros. This is not part of the membership fee but the cost of processing the payment with the payment intermediary, and it confers none of the rights under Article 17. Payment in dinars carries no such fee.

The price list repeats every year: from 15 October the following season is sold, and from 1 January to 14 October the current one is, without the right to be ranked.

The junior price is measured across the whole season, not on a single day. Anyone who is 14 years old or younger on at least one day of the season they are registering for pays the junior price. Someone who turns 15 during that season still pays the junior price.

Payments are accepted from 15 October 2026.

### Article 15. Dinar price and exemption from the membership fee

The dinar price is fixed for the whole season and does not change with the exchange rate. A member with an address in Serbia pays the dinar amount; a member from abroad pays the amount in euros, together with the payment processing fee from Article 14, as a separate line item rather than as a higher membership fee.

The Managing Board may, by decision, exempt a regular member from paying the membership fee. A member exempted from the fee has the same rights as any other: activated competitor status, a member number, and the right to be ranked under the conditions of Article 11. Whether someone has competitor status in a given season is measured by the activated status on the portal. Article 11 states by when payment must be made to acquire the right to be ranked.

$old$,
             $new$### Article 11. Price, deadlines, and exemption from the membership fee

The amount of the membership fee and the payment deadlines are set by the Managing Board through a separate decision.

[[gallery]]

The membership fee is paid for the whole season, and the price depends on the date of payment.

The price list repeats every year: from 15 October the following season is sold, and from 1 January to 14 October the current one is, without the right to be ranked.

The junior price is measured across the whole season, not on a single day. Anyone who is 14 years old or younger on at least one day of the season they are registering for pays the junior price. Someone who turns 15 during that season still pays the junior price.

The dinar price is fixed for the whole season and does not change with the exchange rate. A member with an address in Serbia pays the dinar amount, and a member from abroad pays the amount in euros, on which a payment processing fee of 3 EUR is also charged, as a separate line item rather than as a higher membership fee. The processing fee is not part of the membership fee but the cost of processing the payment with the payment intermediary, and it confers none of the rights under Article 13. Payment in dinars carries no such fee.

The Managing Board may, by decision, exempt a regular member from paying the membership fee. A member exempted from the fee has the same rights as any other: activated competitor status, a member number, and the right to be ranked under the conditions of Article 10. Whether someone has competitor status in a given season is measured by the activated status on the portal. Article 10 states by when payment must be made to acquire the right to be ranked.

$new$),

            ('Article 17', 'pravilnik', 4, 'sr', 'body',
             $old$- Majicu sezone i finišersku medalju, koje stižu zajedno poštom čim skupite 12 BTL bodova u sezoni,$old$,
             $new$- Majicu sezone i finišersku medalju, pod uslovima iz Člana 54,$new$),

            ('Article 17', 'pravilnik', 4, 'en', 'body',
             $old$- The season's T-shirt and finisher's medal, which are sent together by post as soon as you collect 12 BTL points in the season,$old$,
             $new$- The season's T-shirt and finisher's medal, under the conditions of Article 54,$new$),

            ('Article 36', 'pravilnik', 8, 'sr', 'body',
             $old$Ko je nov u ligi takmiči se u početničkoj kategoriji, koja se zove `Početnici` za muškarce i `Početnice` za žene. Naziv opisuje vreme provedeno u ligi, a ne sposobnost.

- Iz početničke kategorije izlazi se kada se jedna zvanična sezona, počev od sezone 2027, završi sa 12 i više BTL bodova, a promena stupa na snagu od naredne sezone. Kategorija se ne menja usred sezone, kao ni uzrasna.
- Izlazak je trajan i nepovratan.
- Početnik ne konkuriše u uzrasnoj kategoriji. Ima sopstvenu rang listu i sopstvene nagrade.
- Nastupa u dve kategorije istovremeno nema. Član je u sezoni ili u početničkoj kategoriji ili u svojoj uzrasnoj kategoriji.$old$,
             $new$Kad se učlanite, birate da li ćete se takmičiti u početničkoj kategoriji (Početnici, Početnice) ili u svojoj uzrasnoj. Naziv govori o tome koliko ste dugo u ligi, a ne o tome koliko brzo trčite. Izbor za narednu sezonu možete da menjate koliko god puta želite, sve do 1. januara u 10:00, kada postaje konačan.

Početnička kategorija je otvorena za svakoga ko ni u jednoj sezoni lige, počev od 2027, nije skupio 12 ili više BTL bodova. Čim u nekoj sezoni pređete tu granicu, od sledeće sezone prelazite u svoju uzrasnu kategoriju i tu ostajete.

Tokom sezone ste u jednoj kategoriji i ona se ne menja do kraja godine. Početnici imaju svoju rang listu i svoje nagrade, a kao i svi ostali ulaze i u generalni plasman.$new$),

            ('Article 36', 'pravilnik', 8, 'en', 'body',
             $old$Anyone who is new to the league competes in the rookie category, called `Rookies` for men and `Rookies` for women. The name describes time spent in the league, not ability.

- You leave the rookie category when one official season, starting from the 2027 season, ends with 12 or more BTL points, and the change takes effect from the following season. The category does not change mid-season, any more than the age category does.
- Leaving is permanent and irreversible.
- A rookie does not compete in the age category. They have their own rankings and their own awards.
- There is no competing in two categories at once. In a given season a member is either in the rookie category or in their age category.$old$,
             $new$When you join, you choose whether to compete in the rookie category (Rookies) or in your own age category. The name speaks of how long you have been in the league, not of how fast you run. You can change your choice for the next season as many times as you like, right up to 1 January at 10:00, when it becomes final.

The rookie category is open to anyone who, in no season of the league starting from 2027, has collected 12 or more BTL points. As soon as you cross that threshold in a season, you move into your age category from the next season and stay there.

During a season you are in one category, and it does not change until the end of the year. Rookies have their own rankings and their own awards, and like everyone else they also enter the overall placing.$new$),

            ('Articles 37, 40, 41 and 42 merged', 'pravilnik', 9, 'sr', 'body',
             $old$### Član 37. Ko prijavljuje i šta

Rezultat prijavljujete sami, kroz formu na svom profilu. Unosite:

- Naziv trke i datum trke,
- Vrstu trke i mesto,
- Dužinu trke,
- Ukupan uspon i ukupan spust,
- Vreme prelaska,
- Link ka zvaničnim rezultatima,
- Sliku, neobavezno: snimak sa sata, diplomu ili nešto treće,
- Komentar, neobavezno, za sve što uz rezultat treba reći.

Ukoliko podignete sliku, link ka zvaničnim rezultatima postaje neobavezan, ali polje Komentar postaje obavezno.

Rezultat sa trke koja je u kalendaru prijavljujete i sa strane samog događaja, dugmetom "Unesi rezultat" u redu te trke. Trka je time već poznata, pa portal preuzima sa nje ono što ta trka zadaje, a vi unosite ostalo, uz link ka zvaničnim rezultatima i po želji sliku i komentar, sa istim pravilom obaveznosti kao sa profila.

Na formi sa profila portal vam pomaže da nađete istu trku: kad počnete da kucate naziv trke, posle dva slova nudi trke iz kalendara, od poslednje ka ranijim. Ako izaberete jednu, portal popunjava i zaključava ono što ta trka zadaje. Izmenite li naziv posle toga, veza se prekida, ta polja se prazne i unosite ih sami.

Administracija sme i sama da dođe do zvaničnih rezultata i unese ih takmičarima.

$old$,
             $new$### Član 33. Kako se prijavljuje rezultat

Rezultat prijavljujete sami, sa svog profila ili sa strane događaja, dugmetom uz trku. Upisujete događaj i trku, dužinu, uspon i spust, vreme i link ka zvaničnim rezultatima. Kad izaberete trku iz kalendara, portal sam popuni ono što ta trka zadaje, pa vam ostaje manje kucanja. Ako trke nema u kalendaru, prijavite je svejedno: uz vaš rezultat napravićemo i događaj i trku. Dužinu, uspon i spust upisujete sami, jer portal ne učitava zapis staze sa sata. Administracija može i sama da unese rezultate sa zvaničnih lista.

$new$),

            ('Articles 37, 40, 41 and 42 merged', 'pravilnik', 9, 'en', 'body',
             $old$### Article 37. Who submits and what

You submit the result yourself, through the form on your profile. You enter:

- The race's name and the date of the race,
- The type of race and the location,
- The length of the race,
- The total ascent and total descent,
- The finishing time,
- A link to the official results,
- A picture, optional: a watch screenshot, a certificate, or something else,
- A comment, optional, for anything that needs to be said about the result.

If you upload a picture, the link to the official results becomes optional, but the Comment field becomes mandatory.

A result from a race that is in the calendar can also be submitted from the event's own page, with the "Submit result" button on that race's row. The race is then already known, so the portal takes from it whatever that race specifies, and you enter the rest, along with the link to the official results and, if you wish, a picture and a comment, under the same requirement rules as from the profile.

On the form from your profile, the portal helps you find the same race: once you start typing the race's name, after two letters it offers races from the calendar, from the most recent backward. If you pick one, the portal fills in and locks whatever that race specifies. If you then change the name, the link is broken, those fields are cleared, and you enter them yourself.

The administration may also obtain the official results itself and enter them for competitors.

$old$,
             $new$### Article 33. How a result is submitted

You submit the result yourself, from your profile or from the event's page, with the button next to the race. You enter the event and the race, the length, the ascent and descent, the time, and a link to the official results. When you pick a race from the calendar, the portal fills in whatever that race specifies by itself, so there is less for you to type. If the race is not in the calendar, submit it anyway: we will create both the event and the race along with your result. You enter the length, ascent, and descent yourself, because the portal does not read a course recording from a watch. The administration may also enter results from the official lists itself.

$new$),

            ('Article 39', 'pravilnik', 9, 'sr', 'body',
             $old$- Link ka zvaničnim rezultatima je dokaz koji tražimo i sam po sebi je dovoljan. Obavezan je na obe prijave, i sa profila i sa strane događaja.
- Slika je drugi dokaz i sme da stane umesto linka, ali nikad sama: uz nju je komentar obavezan i u njemu se kaže šta se na slici vidi. Slika bez reči ne dokazuje ništa.
- Svaku priloženu sliku brišemo sa portala odmah posle verifikacije, bez obzira na to da li ste je priložili sami ili na naš zahtev.$old$,
             $new$Link ka zvaničnim rezultatima je sasvim dovoljan. Ako ga nemate, pošaljite sliku, recimo snimak sata ili diplomu, i u par reči napišite zašto linka nema i šta se na slici vidi. Sliku brišemo čim proverimo rezultat.$new$),

            ('Article 39', 'pravilnik', 9, 'en', 'body',
             $old$- A link to the official results is the evidence we ask for, and it is sufficient on its own. It is mandatory on both kinds of submission, from the profile and from the event's page.
- A picture is a second kind of evidence and may stand in for the link, but never alone: a comment is mandatory alongside it, stating what is seen in the picture. A picture with no words proves nothing.
- We delete every submitted picture from the portal immediately after verification, whether you submitted it yourself or at our request.$old$,
             $new$A link to the official results is quite enough. If you do not have one, send a picture, for example a watch screenshot or a certificate, and say in a few words why there is no link and what is seen in the picture. We delete the picture as soon as we have checked the result.$new$),

            ('Articles 40 to 42 removed', 'pravilnik', 9, 'sr', 'body',
             $old$

### Član 40. Trka koje nema u kalendaru

Ako trke nema u kalendaru portala, svejedno je prijavite. Administracija će uz vaš rezultat kreirati i događaj i trku.

### Član 41. Dužina i nagib

Dužinu, uspon i spust unosite ručno, osim kada ih portal uzme sa same trke, što se dešava kada ih ta trka zadaje: pri prijavi sa strane događaja, i kada na profilu izaberete trku iz ponuđenog spiska (Član 37). Portal ne prima zapis staze u obliku GPX, FIT ili TCX i ne izvodi te vrednosti iz njega.

Ako se vaše merenje razlikuje od onoga što je objavio organizator, prednost ima podatak organizatora (Član 29).

### Član 42. Objava

Verifikovan rezultat objavljuje se i ulazi u tabele u roku od 48 časova od prijave.$old$,
             $new$$new$),

            ('Articles 40 to 42 removed', 'pravilnik', 9, 'en', 'body',
             $old$

### Article 40. A race not in the calendar

If the race is not in the portal's calendar, submit it anyway. The administration will create both the event and the race along with your result.

### Article 41. Length and gradient

You enter the length, ascent, and descent by hand, except when the portal takes them from the race itself, which happens when that race specifies them: when submitting from the event's page, and when you pick the race from the offered list on your profile (Article 37). The portal does not accept a course file in GPX, FIT, or TCX form and does not derive these values from one.

If your own measurement differs from what the organizer published, the organizer's figure takes precedence (Article 29).

### Article 42. Publication

A verified result is published and enters the tables within 48 hours of submission.$old$,
             $new$$new$),

            ('Article 43', 'pravilnik', 10, 'sr', 'body',
             $old$Neverifikovan rezultat se nigde javno ne prikazuje.$old$,
             $new$Neverifikovan rezultat se nigde javno ne prikazuje.

Verifikovan rezultat objavljuje se i ulazi u tabele u roku od 48 časova od prijave.$new$),

            ('Article 43', 'pravilnik', 10, 'en', 'body',
             $old$An unverified result is not shown publicly anywhere.$old$,
             $new$An unverified result is not shown publicly anywhere.

A verified result is published and enters the tables within 48 hours of submission.$new$),

            ('Article 64', 'pravilnik', 14, 'sr', 'body',
             $old$ Poštom se šalju samo majica sezone i finišerska medalja, i to zajedno, čim član skupi 12 BTL bodova. Poštanske troškove snosi Član.$old$,
             $new$ Poštanske troškove slanja majice i medalje snosi član.$new$),

            ('Article 64', 'pravilnik', 14, 'en', 'body',
             $old$ Only the season's T-shirt and the finisher's medal are sent by post, and together, as soon as a member collects 12 BTL points. Postal costs are borne by the member.$old$,
             $new$ Postal costs for sending the T-shirt and the medal are borne by the member.$new$),

            ('Article 72', 'pravilnik', 16, 'sr', 'body',
             $old$

O disciplinskoj meri u prvom stepenu odlučuje Upravni odbor. Protiv odluke član može podneti žalbu Skupštini u roku od 15 dana od uručenja.$old$,
             $new$$new$),

            ('Article 72', 'pravilnik', 16, 'en', 'body',
             $old$

The first-instance decision on the disciplinary measure is made by the Managing Board. The member may appeal the decision to the General Assembly within 15 days of delivery.$old$,
             $new$$new$),

            ('Articles 73 to 76 merged', 'pravilnik', 17, 'sr', 'body',
             $old$### Član 73. Šta je javno

Liga je javno takmičenje, pa su javni:

- Ime i prezime, članski broj i kategorija,
- Mesto i zemlja,
- Profilna fotografija,
- Svi verifikovani rezultati sa dužinom, usponom, spustom, vremenom i datumom,
- Bodovi, plasman, statistika, dukati i priznanja,
- Tim, trkački par i klub.

### Član 74. Šta nikada nije javno

Datum rođenja se ne prikazuje ni u punom ni u skraćenom obliku, osim ako sami izaberete da se na vašem profilu vidi ceo datum ili samo godina; podrazumevano se ne prikazuje ništa. Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor. Iz prelaska u stariju uzrasnu kategoriju između dve sezone vidi se tačna godina rođenja, i kad datum rođenja nije prikazan. Adresa elektronske pošte, adresa, sve u vezi sa članarinom i privatne poruke nikada se ne prikazuju.

### Član 75. Fotografije

Saglasnost za objavu fotografija sa okupljanja i takmičenja lige dajete unapred, prihvatanjem ovog pravilnika. Objavljuju se fotografije koje napravi osoblje lige i fotografije koje sami pošaljete i odobrite.

Galerije fotografija sa trka i označavanja ljudi na fotografijama na portalu nema.

### Član 76. Ostalo

Sve ostalo o vašim podacima uređuje [politika privatnosti](/politika-privatnosti) portala, koja je uz ovaj pravilnik i [uslove korišćenja](/uslovi-koriscenja) treći obavezan dokument.$old$,
             $new$### Član 66. Podaci i fotografije

Šta je na portalu javno, šta nikada ne prikazujemo i kako možete da sakrijete svoj profil, objašnjava [politika privatnosti](/politika-privatnosti). Prihvatanjem pravilnika dajete saglasnost da liga objavljuje fotografije koje njeno osoblje napravi na okupljanjima i takmičenjima.$new$),

            ('Articles 73 to 76 merged', 'pravilnik', 17, 'en', 'body',
             $old$### Article 73. What is public

The league is a public competition, so the following are public:

- First and last name, member number, and category,
- Place and country,
- Profile picture,
- Every verified result with its length, ascent, descent, time, and date,
- Points, placing, statistics, ducats, and honours,
- Team, racing pair, and club.

### Article 74. What is never public

The date of birth is not shown, either in full or in shortened form, unless you yourself choose to have the full date or only the year shown on your profile; by default nothing is shown. The category that follows from it is always public, whatever you choose. Moving to an older age category between two seasons reveals the exact year of birth, even when the date of birth is not displayed. The e-mail address, the address, everything related to the membership fee, and private messages are never shown.

### Article 75. Photographs

You give your consent to the publication of photographs from the league's gatherings and competitions in advance, by accepting this Rulebook. Photographs taken by the league's staff are published, as are photographs you send and approve yourself.

There are no photo galleries from races and no tagging of people in photographs on the portal.

### Article 76. Everything else

Everything else about your data is governed by the portal's [privacy policy](/politika-privatnosti), which, alongside this Rulebook and the [terms of use](/uslovi-koriscenja), is the third mandatory document.$old$,
             $new$### Article 66. Data and photographs

What is public on the portal, what we never show, and how you can hide your profile is explained in the [privacy policy](/politika-privatnosti). By accepting the Rulebook, you consent to the league publishing photographs that its staff take at gatherings and competitions.$new$),

            ('rulebook date', 'pravilnik', 19, 'sr', 'body',
             $old$Poslednja izmena: 16.10.2026.$old$,
             $new$Poslednja izmena: 22.10.2026.$new$),

            ('rulebook date', 'pravilnik', 19, 'en', 'body',
             $old$Last amended: 16.10.2026.$old$,
             $new$Last amended: 22.10.2026.$new$),

            ('Article 10 becomes 9', 'pravilnik', 3, 'sr', 'body',
             $old$### Član 10. Član lige$old$,
             $new$### Član 9. Član lige$new$),

            ('Article 11 becomes 10', 'pravilnik', 3, 'sr', 'body',
             $old$### Član 11. Pravo rangiranja$old$,
             $new$### Član 10. Pravo rangiranja$new$),

            ('Article 16 becomes 12', 'pravilnik', 4, 'sr', 'body',
             $old$### Član 16. Povraćaj$old$,
             $new$### Član 12. Povraćaj$new$),

            ('Article 17 becomes 13', 'pravilnik', 4, 'sr', 'body',
             $old$### Član 17. Šta članstvo donosi$old$,
             $new$### Član 13. Šta članstvo donosi$new$),

            ('Article 18 becomes 14', 'pravilnik', 5, 'sr', 'body',
             $old$### Član 18. Trke koje ulaze u bodovanje$old$,
             $new$### Član 14. Trke koje ulaze u bodovanje$new$),

            ('Article 19 becomes 15', 'pravilnik', 5, 'sr', 'body',
             $old$### Član 19. Šta se ne boduje$old$,
             $new$### Član 15. Šta se ne boduje$new$),

            ('Article 20 becomes 16', 'pravilnik', 5, 'sr', 'body',
             $old$### Član 20. Štafete$old$,
             $new$### Član 16. Štafete$new$),

            ('Article 21 becomes 17', 'pravilnik', 5, 'sr', 'body',
             $old$### Član 21. Virtuelne trke$old$,
             $new$### Član 17. Virtuelne trke$new$),

            ('Article 22 becomes 18', 'pravilnik', 5, 'sr', 'body',
             $old$### Član 22. Više trka na istom događaju$old$,
             $new$### Član 18. Više trka na istom događaju$new$),

            ('Article 23 becomes 19', 'pravilnik', 5, 'sr', 'body',
             $old$### Član 23. Nezavršena trka$old$,
             $new$### Član 19. Nezavršena trka$new$),

            ('Article 24 becomes 20', 'pravilnik', 5, 'sr', 'body',
             $old$### Član 24. Uslovi na trci$old$,
             $new$### Član 20. Uslovi na trci$new$),

            ('Article 25 becomes 21', 'pravilnik', 5, 'sr', 'body',
             $old$### Član 25. Zvaničan događaj$old$,
             $new$### Član 21. Zvaničan događaj$new$),

            ('Article 26 becomes 22', 'pravilnik', 6, 'sr', 'body',
             $old$### Član 26. Bodovanje$old$,
             $new$### Član 22. Bodovanje$new$),

            ('Article 27 becomes 23', 'pravilnik', 6, 'sr', 'body',
             $old$### Član 27. Prikaz i zaokruživanje$old$,
             $new$### Član 23. Prikaz i zaokruživanje$new$),

            ('Article 28 becomes 24', 'pravilnik', 6, 'sr', 'body',
             $old$### Član 28. Vreme$old$,
             $new$### Član 24. Vreme$new$),

            ('Article 29 becomes 25', 'pravilnik', 6, 'sr', 'body',
             $old$### Član 29. Uspon i spust$old$,
             $new$### Član 25. Uspon i spust$new$),

            ('Article 30 becomes 26', 'pravilnik', 6, 'sr', 'body',
             $old$### Član 30. Granice bodovanja$old$,
             $new$### Član 26. Granice bodovanja$new$),

            ('Article 31 becomes 27', 'pravilnik', 7, 'sr', 'body',
             $old$### Član 31. Pet kategorija$old$,
             $new$### Član 27. Pet kategorija$new$),

            ('Article 32 becomes 28', 'pravilnik', 7, 'sr', 'body',
             $old$### Član 32. Bez tolerancije$old$,
             $new$### Član 28. Bez tolerancije$new$),

            ('Article 33 becomes 29', 'pravilnik', 8, 'sr', 'body',
             $old$### Član 33. Podela po polu$old$,
             $new$### Član 29. Podela po polu$new$),

            ('Article 34 becomes 30', 'pravilnik', 8, 'sr', 'body',
             $old$### Član 34. Uzrasne kategorije$old$,
             $new$### Član 30. Uzrasne kategorije$new$),

            ('Article 35 becomes 31', 'pravilnik', 8, 'sr', 'body',
             $old$### Član 35. Prelazak u stariju kategoriju$old$,
             $new$### Član 31. Prelazak u stariju kategoriju$new$),

            ('Article 36 becomes 32', 'pravilnik', 8, 'sr', 'body',
             $old$### Član 36. Početnička kategorija$old$,
             $new$### Član 32. Početnička kategorija$new$),

            ('Article 38 becomes 34', 'pravilnik', 9, 'sr', 'body',
             $old$### Član 38. Rok$old$,
             $new$### Član 34. Rok$new$),

            ('Article 39 becomes 35', 'pravilnik', 9, 'sr', 'body',
             $old$### Član 39. Dokazi$old$,
             $new$### Član 35. Dokazi$new$),

            ('Article 43 becomes 36', 'pravilnik', 10, 'sr', 'body',
             $old$### Član 43. Rezultat ulazi tek posle odobrenja$old$,
             $new$### Član 36. Rezultat ulazi tek posle odobrenja$new$),

            ('Article 44 becomes 37', 'pravilnik', 10, 'sr', 'body',
             $old$### Član 44. Ispravke$old$,
             $new$### Član 37. Ispravke$new$),

            ('Article 45 becomes 38', 'pravilnik', 11, 'sr', 'body',
             $old$### Član 45. Koje liste postoje$old$,
             $new$### Član 38. Koje liste postoje$new$),

            ('Article 46 becomes 39', 'pravilnik', 11, 'sr', 'body',
             $old$### Član 46. Kako se računa generalni plasman$old$,
             $new$### Član 39. Kako se računa generalni plasman$new$),

            ('Article 47 becomes 40', 'pravilnik', 11, 'sr', 'body',
             $old$### Član 47. Osvežavanje$old$,
             $new$### Član 40. Osvežavanje$new$),

            ('Article 48 becomes 41', 'pravilnik', 11, 'sr', 'body',
             $old$### Član 48. Top liste$old$,
             $new$### Član 41. Top liste$new$),

            ('Article 49 becomes 42', 'pravilnik', 11, 'sr', 'body',
             $old$### Član 49. Izjednačenje$old$,
             $new$### Član 42. Izjednačenje$new$),

            ('Article 50 becomes 43', 'pravilnik', 11, 'sr', 'body',
             $old$### Član 50. Deljenog mesta nema$old$,
             $new$### Član 43. Deljenog mesta nema$new$),

            ('Article 51 becomes 44', 'pravilnik', 11, 'sr', 'body',
             $old$### Član 51. Arhiva$old$,
             $new$### Član 44. Arhiva$new$),

            ('Article 52 becomes 45', 'pravilnik', 12, 'sr', 'body',
             $old$### Član 52. Tim i klub nisu isto$old$,
             $new$### Član 45. Tim i klub nisu isto$new$),

            ('Article 53 becomes 46', 'pravilnik', 12, 'sr', 'body',
             $old$### Član 53. Osnivanje tima$old$,
             $new$### Član 46. Osnivanje tima$new$),

            ('Article 54 becomes 47', 'pravilnik', 12, 'sr', 'body',
             $old$### Član 54. Poredak timova$old$,
             $new$### Član 47. Poredak timova$new$),

            ('Article 55 becomes 48', 'pravilnik', 12, 'sr', 'body',
             $old$### Član 55. Trkački par$old$,
             $new$### Član 48. Trkački par$new$),

            ('Article 56 becomes 49', 'pravilnik', 12, 'sr', 'body',
             $old$### Član 56. Promene tima i trkačkog para$old$,
             $new$### Član 49. Promene tima i trkačkog para$new$),

            ('Article 57 becomes 50', 'pravilnik', 13, 'sr', 'body',
             $old$### Član 57. Liga kao pojam$old$,
             $new$### Član 50. Liga kao pojam$new$),

            ('Article 58 becomes 51', 'pravilnik', 13, 'sr', 'body',
             $old$### Član 58. BTL Round 'n' Around$old$,
             $new$### Član 51. BTL Round 'n' Around$new$),

            ('Article 59 becomes 52', 'pravilnik', 13, 'sr', 'body',
             $old$### Član 59. BTL dezorijentiring$old$,
             $new$### Član 52. BTL dezorijentiring$new$),

            ('Article 60 becomes 53', 'pravilnik', 13, 'sr', 'body',
             $old$### Član 60. BTL sreda$old$,
             $new$### Član 53. BTL sreda$new$),

            ('Article 61 becomes 54', 'pravilnik', 14, 'sr', 'body',
             $old$### Član 61. Šta se osvaja$old$,
             $new$### Član 54. Šta se osvaja$new$),

            ('Article 62 becomes 55', 'pravilnik', 14, 'sr', 'body',
             $old$### Član 62. Posebna priznanja$old$,
             $new$### Član 55. Posebna priznanja$new$),

            ('Article 63 becomes 56', 'pravilnik', 14, 'sr', 'body',
             $old$### Član 63. Dodela$old$,
             $new$### Član 56. Dodela$new$),

            ('Article 64 becomes 57', 'pravilnik', 14, 'sr', 'body',
             $old$### Član 64. Preuzimanje fizičkih nagrada$old$,
             $new$### Član 57. Preuzimanje fizičkih nagrada$new$),

            ('Article 65 becomes 58', 'pravilnik', 14, 'sr', 'body',
             $old$### Član 65. Sponzorske nagrade$old$,
             $new$### Član 58. Sponzorske nagrade$new$),

            ('Article 66 becomes 59', 'pravilnik', 15, 'sr', 'body',
             $old$### Član 66. Osnovno pravilo$old$,
             $new$### Član 59. Osnovno pravilo$new$),

            ('Article 67 becomes 60', 'pravilnik', 15, 'sr', 'body',
             $old$### Član 67. Šta nije dozvoljeno$old$,
             $new$### Član 60. Šta nije dozvoljeno$new$),

            ('Article 68 becomes 61', 'pravilnik', 15, 'sr', 'body',
             $old$### Član 68. Šta se od člana očekuje$old$,
             $new$### Član 61. Šta se od člana očekuje$new$),

            ('Article 69 becomes 62', 'pravilnik', 16, 'sr', 'body',
             $old$### Član 69. Mere$old$,
             $new$### Član 62. Mere$new$),

            ('Article 70 becomes 63', 'pravilnik', 16, 'sr', 'body',
             $old$### Član 70. Šta diskvalifikacija znači$old$,
             $new$### Član 63. Šta diskvalifikacija znači$new$),

            ('Article 71 becomes 64', 'pravilnik', 16, 'sr', 'body',
             $old$### Član 71. Postupak$old$,
             $new$### Član 64. Postupak$new$),

            ('Article 72 becomes 65', 'pravilnik', 16, 'sr', 'body',
             $old$### Član 72. Lakša kršenja$old$,
             $new$### Član 65. Lakša kršenja$new$),

            ('Article 77 becomes 67', 'pravilnik', 19, 'sr', 'body',
             $old$### Član 77. Nova verzija svake sezone$old$,
             $new$### Član 67. Nova verzija svake sezone$new$),

            ('Article 78 becomes 68', 'pravilnik', 19, 'sr', 'body',
             $old$### Član 78. Tumačenje$old$,
             $new$### Član 68. Tumačenje$new$),

            ('Article 10 becomes 9', 'pravilnik', 3, 'en', 'body',
             $old$### Article 10. Member of the league$old$,
             $new$### Article 9. Member of the league$new$),

            ('Article 11 becomes 10', 'pravilnik', 3, 'en', 'body',
             $old$### Article 11. Right to be ranked$old$,
             $new$### Article 10. Right to be ranked$new$),

            ('Article 16 becomes 12', 'pravilnik', 4, 'en', 'body',
             $old$### Article 16. Refunds$old$,
             $new$### Article 12. Refunds$new$),

            ('Article 17 becomes 13', 'pravilnik', 4, 'en', 'body',
             $old$### Article 17. What membership brings$old$,
             $new$### Article 13. What membership brings$new$),

            ('Article 18 becomes 14', 'pravilnik', 5, 'en', 'body',
             $old$### Article 18. Races that count toward points$old$,
             $new$### Article 14. Races that count toward points$new$),

            ('Article 19 becomes 15', 'pravilnik', 5, 'en', 'body',
             $old$### Article 19. What does not count toward points$old$,
             $new$### Article 15. What does not count toward points$new$),

            ('Article 20 becomes 16', 'pravilnik', 5, 'en', 'body',
             $old$### Article 20. Relays$old$,
             $new$### Article 16. Relays$new$),

            ('Article 21 becomes 17', 'pravilnik', 5, 'en', 'body',
             $old$### Article 21. Virtual races$old$,
             $new$### Article 17. Virtual races$new$),

            ('Article 22 becomes 18', 'pravilnik', 5, 'en', 'body',
             $old$### Article 22. Multiple races at the same event$old$,
             $new$### Article 18. Multiple races at the same event$new$),

            ('Article 23 becomes 19', 'pravilnik', 5, 'en', 'body',
             $old$### Article 23. Unfinished race$old$,
             $new$### Article 19. Unfinished race$new$),

            ('Article 24 becomes 20', 'pravilnik', 5, 'en', 'body',
             $old$### Article 24. Conditions at the race$old$,
             $new$### Article 20. Conditions at the race$new$),

            ('Article 25 becomes 21', 'pravilnik', 5, 'en', 'body',
             $old$### Article 25. Official event$old$,
             $new$### Article 21. Official event$new$),

            ('Article 26 becomes 22', 'pravilnik', 6, 'en', 'body',
             $old$### Article 26. Scoring$old$,
             $new$### Article 22. Scoring$new$),

            ('Article 27 becomes 23', 'pravilnik', 6, 'en', 'body',
             $old$### Article 27. Display and rounding$old$,
             $new$### Article 23. Display and rounding$new$),

            ('Article 28 becomes 24', 'pravilnik', 6, 'en', 'body',
             $old$### Article 28. Time$old$,
             $new$### Article 24. Time$new$),

            ('Article 29 becomes 25', 'pravilnik', 6, 'en', 'body',
             $old$### Article 29. Ascent and descent$old$,
             $new$### Article 25. Ascent and descent$new$),

            ('Article 30 becomes 26', 'pravilnik', 6, 'en', 'body',
             $old$### Article 30. Scoring limits$old$,
             $new$### Article 26. Scoring limits$new$),

            ('Article 31 becomes 27', 'pravilnik', 7, 'en', 'body',
             $old$### Article 31. Five categories$old$,
             $new$### Article 27. Five categories$new$),

            ('Article 32 becomes 28', 'pravilnik', 7, 'en', 'body',
             $old$### Article 32. No tolerance$old$,
             $new$### Article 28. No tolerance$new$),

            ('Article 33 becomes 29', 'pravilnik', 8, 'en', 'body',
             $old$### Article 33. Division by sex$old$,
             $new$### Article 29. Division by sex$new$),

            ('Article 34 becomes 30', 'pravilnik', 8, 'en', 'body',
             $old$### Article 34. Age categories$old$,
             $new$### Article 30. Age categories$new$),

            ('Article 35 becomes 31', 'pravilnik', 8, 'en', 'body',
             $old$### Article 35. Moving to an older category$old$,
             $new$### Article 31. Moving to an older category$new$),

            ('Article 36 becomes 32', 'pravilnik', 8, 'en', 'body',
             $old$### Article 36. Rookie category$old$,
             $new$### Article 32. Rookie category$new$),

            ('Article 38 becomes 34', 'pravilnik', 9, 'en', 'body',
             $old$### Article 38. Deadline$old$,
             $new$### Article 34. Deadline$new$),

            ('Article 39 becomes 35', 'pravilnik', 9, 'en', 'body',
             $old$### Article 39. Evidence$old$,
             $new$### Article 35. Evidence$new$),

            ('Article 43 becomes 36', 'pravilnik', 10, 'en', 'body',
             $old$### Article 43. A result counts only after approval$old$,
             $new$### Article 36. A result counts only after approval$new$),

            ('Article 44 becomes 37', 'pravilnik', 10, 'en', 'body',
             $old$### Article 44. Corrections$old$,
             $new$### Article 37. Corrections$new$),

            ('Article 45 becomes 38', 'pravilnik', 11, 'en', 'body',
             $old$### Article 45. Which lists exist$old$,
             $new$### Article 38. Which lists exist$new$),

            ('Article 46 becomes 39', 'pravilnik', 11, 'en', 'body',
             $old$### Article 46. How the overall placing is calculated$old$,
             $new$### Article 39. How the overall placing is calculated$new$),

            ('Article 47 becomes 40', 'pravilnik', 11, 'en', 'body',
             $old$### Article 47. Refreshing$old$,
             $new$### Article 40. Refreshing$new$),

            ('Article 48 becomes 41', 'pravilnik', 11, 'en', 'body',
             $old$### Article 48. Top lists$old$,
             $new$### Article 41. Top lists$new$),

            ('Article 49 becomes 42', 'pravilnik', 11, 'en', 'body',
             $old$### Article 49. Ties$old$,
             $new$### Article 42. Ties$new$),

            ('Article 50 becomes 43', 'pravilnik', 11, 'en', 'body',
             $old$### Article 50. There is no shared placing$old$,
             $new$### Article 43. There is no shared placing$new$),

            ('Article 51 becomes 44', 'pravilnik', 11, 'en', 'body',
             $old$### Article 51. Archive$old$,
             $new$### Article 44. Archive$new$),

            ('Article 52 becomes 45', 'pravilnik', 12, 'en', 'body',
             $old$### Article 52. A team and a club are not the same$old$,
             $new$### Article 45. A team and a club are not the same$new$),

            ('Article 53 becomes 46', 'pravilnik', 12, 'en', 'body',
             $old$### Article 53. Founding a team$old$,
             $new$### Article 46. Founding a team$new$),

            ('Article 54 becomes 47', 'pravilnik', 12, 'en', 'body',
             $old$### Article 54. Team standings$old$,
             $new$### Article 47. Team standings$new$),

            ('Article 55 becomes 48', 'pravilnik', 12, 'en', 'body',
             $old$### Article 55. Racing pair$old$,
             $new$### Article 48. Racing pair$new$),

            ('Article 56 becomes 49', 'pravilnik', 12, 'en', 'body',
             $old$### Article 56. Team and racing pair changes$old$,
             $new$### Article 49. Team and racing pair changes$new$),

            ('Article 57 becomes 50', 'pravilnik', 13, 'en', 'body',
             $old$### Article 57. League as a concept$old$,
             $new$### Article 50. League as a concept$new$),

            ('Article 58 becomes 51', 'pravilnik', 13, 'en', 'body',
             $old$### Article 58. BTL Round 'n' Around$old$,
             $new$### Article 51. BTL Round 'n' Around$new$),

            ('Article 59 becomes 52', 'pravilnik', 13, 'en', 'body',
             $old$### Article 59. BTL dezorijentiring$old$,
             $new$### Article 52. BTL dezorijentiring$new$),

            ('Article 60 becomes 53', 'pravilnik', 13, 'en', 'body',
             $old$### Article 60. BTL sreda$old$,
             $new$### Article 53. BTL sreda$new$),

            ('Article 61 becomes 54', 'pravilnik', 14, 'en', 'body',
             $old$### Article 61. What can be won$old$,
             $new$### Article 54. What can be won$new$),

            ('Article 62 becomes 55', 'pravilnik', 14, 'en', 'body',
             $old$### Article 62. Special honours$old$,
             $new$### Article 55. Special honours$new$),

            ('Article 63 becomes 56', 'pravilnik', 14, 'en', 'body',
             $old$### Article 63. Presentation$old$,
             $new$### Article 56. Presentation$new$),

            ('Article 64 becomes 57', 'pravilnik', 14, 'en', 'body',
             $old$### Article 64. Collecting physical awards$old$,
             $new$### Article 57. Collecting physical awards$new$),

            ('Article 65 becomes 58', 'pravilnik', 14, 'en', 'body',
             $old$### Article 65. Sponsor awards$old$,
             $new$### Article 58. Sponsor awards$new$),

            ('Article 66 becomes 59', 'pravilnik', 15, 'en', 'body',
             $old$### Article 66. Basic rule$old$,
             $new$### Article 59. Basic rule$new$),

            ('Article 67 becomes 60', 'pravilnik', 15, 'en', 'body',
             $old$### Article 67. What is not allowed$old$,
             $new$### Article 60. What is not allowed$new$),

            ('Article 68 becomes 61', 'pravilnik', 15, 'en', 'body',
             $old$### Article 68. What is expected of a member$old$,
             $new$### Article 61. What is expected of a member$new$),

            ('Article 69 becomes 62', 'pravilnik', 16, 'en', 'body',
             $old$### Article 69. Measures$old$,
             $new$### Article 62. Measures$new$),

            ('Article 70 becomes 63', 'pravilnik', 16, 'en', 'body',
             $old$### Article 70. What disqualification means$old$,
             $new$### Article 63. What disqualification means$new$),

            ('Article 71 becomes 64', 'pravilnik', 16, 'en', 'body',
             $old$### Article 71. Procedure$old$,
             $new$### Article 64. Procedure$new$),

            ('Article 72 becomes 65', 'pravilnik', 16, 'en', 'body',
             $old$### Article 72. Minor breaches$old$,
             $new$### Article 65. Minor breaches$new$),

            ('Article 77 becomes 67', 'pravilnik', 19, 'en', 'body',
             $old$### Article 77. A new version every season$old$,
             $new$### Article 67. A new version every season$new$),

            ('Article 78 becomes 68', 'pravilnik', 19, 'en', 'body',
             $old$### Article 78. Interpretation$old$,
             $new$### Article 68. Interpretation$new$),

            ('reference', 'pravilnik', 14, 'sr', 'body',
             $old$posebna priznanja iz Člana 62,$old$,
             $new$posebna priznanja iz Člana 55,$new$),

            ('reference', 'pravilnik', 14, 'en', 'body',
             $old$the special honours from Article 62,$old$,
             $new$the special honours from Article 55,$new$),

            ('reference', 'pravilnik', 15, 'sr', 'body',
             $old$uslove iz Člana 25,$old$,
             $new$uslove iz Člana 21,$new$),

            ('reference', 'pravilnik', 15, 'en', 'body',
             $old$the conditions of Article 25,$old$,
             $new$the conditions of Article 21,$new$),

            ('reference', 'pravilnik', 16, 'sr', 'body',
             $old$posle roka iz Člana 38.$old$,
             $new$posle roka iz Člana 34.$new$),

            ('reference', 'pravilnik', 16, 'en', 'body',
             $old$the deadline in Article 38$old$,
             $new$the deadline in Article 34$new$),

            ('reference', 'pravilnik', 16, 'sr', 'body',
             $old$postupak iz Člana 71.$old$,
             $new$postupak iz Člana 64.$new$),

            ('reference', 'pravilnik', 16, 'en', 'body',
             $old$the procedure from Article 71.$old$,
             $new$the procedure from Article 64.$new$),

            ('reference', 'pravilnik', 4, 'sr', 'body',
             $old$- Pravo rangiranja pod uslovima iz Člana 11,$old$,
             $new$- Pravo rangiranja pod uslovima iz Člana 10,$new$),

            ('reference', 'pravilnik', 4, 'en', 'body',
             $old$- The right to be ranked under the conditions of Article 11,$old$,
             $new$- The right to be ranked under the conditions of Article 10,$new$),

            ('reference', 'pravilnik', 19, 'sr', 'body',
             $old$osim člana 65 koji$old$,
             $new$osim člana 58 koji$new$),

            ('reference', 'pravilnik', 19, 'en', 'body',
             $old$except for article 65,$old$,
             $new$except for article 58,$new$),

            ('terms 1, what the rulebook governs', 'uslovi-koriscenja', 1, 'sr', 'body',
             $old$koji uređuje samo takmičenje i donosi se za svaku sezonu$old$,
             $new$koji uređuje takmičenje i članarinu i donosi se za svaku sezonu$new$),

            ('terms 1, what the rulebook governs', 'uslovi-koriscenja', 1, 'en', 'body',
             $old$which governs only the competition and is adopted for each season$old$,
             $new$which governs the competition and the membership fee and is adopted for each season$new$),

            ('terms 1, precedence and awards', 'uslovi-koriscenja', 1, 'sr', 'body',
             $old$Ako se uslovi i pravilnik razlikuju u nečemu što se tiče takmičenja, važi pravilnik.$old$,
             $new$Ako se uslovi i pravilnik razlikuju u nečemu što se tiče takmičenja ili članarine, važi pravilnik.

O nagradama, priznanjima i njihovom preuzimanju sve piše u pravilniku.$new$),

            ('terms 1, precedence and awards', 'uslovi-koriscenja', 1, 'en', 'body',
             $old$If these terms and the Rulebook differ on anything concerning the competition, the Rulebook prevails.$old$,
             $new$If these terms and the Rulebook differ on anything concerning the competition or the membership fee, the Rulebook prevails.

Everything about awards, honours, and collecting them is set out in the Rulebook.$new$),

            ('terms 2, the age thresholds', 'uslovi-koriscenja', 2, 'sr', 'body',
             $old$Ko ima 14 ili 15 godina sam prihvata članstvo, a nalog mu i dalje održava roditelj ili staratelj.$old$,
             $new$Ko ima 14 ili 15 godina sam prihvata članstvo, a nalog mu i dalje održava roditelj ili staratelj. Obe granice se mere na dan popunjavanja prijave, a ne kroz sezonu.$new$),

            ('terms 2, the age thresholds', 'uslovi-koriscenja', 2, 'en', 'body',
             $old$Anyone who is 14 or 15 accepts membership themselves, while their account is still maintained by a parent or guardian.$old$,
             $new$Anyone who is 14 or 15 accepts membership themselves, while their account is still maintained by a parent or guardian. Both thresholds are measured on the day the application is submitted, not throughout the season.$new$),

            ('terms 3', 'uslovi-koriscenja', 3, 'sr', 'body',
             $old$Visinu članarine i rokove plaćanja utvrđuje Upravni odbor posebnom odlukom. Važeći cenovnik objavljuje se u [opštem pravilniku lige](/pravilnik), uz član o članarini.

Članarina se plaća za sezonu, koja traje od 1. januara do 31. decembra. Cenovnik se ponavlja svake godine: od 15. oktobra se prodaje naredna sezona, a od 1. januara do 14. oktobra tekuća, bez prava na rangiranje. Uplate primamo od 15. oktobra. Dinarska cena je fiksirana za celu sezonu i ne menja se sa kursom.

Ko se učlani tokom sezone dobija profil i unosi svoje rezultate, ali ne konkuriše za mesta i ne pojavljuje se u rang listama te sezone.

Povlašćenih cena nema, ali Upravni odbor sme odlukom da redovnog člana oslobodi plaćanja članarine, sa istim pravima; za pravo rangiranja u nekoj sezoni ta odluka mora biti doneta do 31. decembra prethodne godine.

Članarina se ne vraća. Članstvo je usluga vezana za slobodno vreme, sa unapred određenim periodom pružanja: sezona za koju je članarina uplaćena, od 1. januara do 31. decembra te kalendarske godine. Možete se odjaviti u svakom trenutku, ali uplaćena članarina se ne vraća.$old$,
             $new$Koliko košta članarina, do kada se plaća i ko može biti oslobođen plaćanja, naći ćete u cenovniku u [opštem pravilniku lige](/pravilnik). Članarina važi za celu sezonu, od 1. januara do 31. decembra. Pošto je to usluga slobodnog vremena za tačno određen period, uplaćenu članarinu ne vraćamo, ni kada se odjavite pre kraja sezone.$new$),

            ('terms 3', 'uslovi-koriscenja', 3, 'en', 'body',
             $old$The amount of the membership fee and the payment deadlines are set by the Managing Board through a separate decision. The current price list is published in the [league's general Rulebook](/pravilnik), alongside the article on the membership fee.

The membership fee is paid for a season, which runs from 1 January to 31 December. The price list repeats every year: from 15 October the following season is sold, and from 1 January to 14 October the current one is, without the right to be ranked. We accept payments from 15 October. The dinar price is fixed for the whole season and does not change with the exchange rate.

Anyone who joins during the season receives a profile and submits their own results, but does not compete for placings and does not appear in that season's rankings.

There are no discounted prices, but the Managing Board may, by decision, exempt a regular member from paying the membership fee, with the same rights; for the right to be ranked in a given season, that decision must be made by 31 December of the previous year.

The membership fee is not refunded. Membership is a leisure-time service with a predetermined period of provision: the season for which the fee was paid, from 1 January to 31 December of that calendar year. You may cancel at any time, but a paid membership fee is not refunded.$old$,
             $new$How much the membership fee costs, by when it is paid, and who can be exempted from paying it, you will find in the price list in the [league's general Rulebook](/pravilnik). The membership fee applies to the whole season, from 1 January to 31 December. Since it is a leisure-time service for a precisely defined period, we do not refund a paid membership fee, even if you cancel before the end of the season.$new$),

            ('terms 4, step 3', 'uslovi-koriscenja', 4, 'sr', 'body',
             $old$3. Nalog je otvoren, ali takmičarski status još nije aktivan. Dok nije, niste vidljivi na portalu i ne možete ništa da radite. Vidite samo ono što vidi i svaki posetilac: kalendar, rang liste i profile drugih takmičara.$old$,
             $new$3. Nalog je otvoren, a takmičarski status još nije aktivan.$new$),

            ('terms 4, step 3', 'uslovi-koriscenja', 4, 'en', 'body',
             $old$3. The account is open, but competitor status is not active yet. Until it is, you are not visible on the portal and cannot do anything. You see only what every visitor sees: the calendar, the rankings, and other competitors' profiles.$old$,
             $new$3. The account is open, and competitor status is not active yet.$new$),

            ('terms 5', 'uslovi-koriscenja', 5, 'sr', 'body',
             $old$Rezultati su srce lige i ovo je jedini deo ovih uslova gde ozbiljno računamo na vaše poštenje. Rezultat prijavljujete na dva načina: kroz formu na svom profilu, gde unosite naziv trke, datum, vrstu trke, mesto, dužinu, uspon, spust, vreme i link ka zvaničnim rezultatima; ili dugmetom u redu trke na strani samog događaja, gde portal sa te trke preuzima ono što ona zadaje. Link je obavezan osim ako priložite sliku; tada je obavezan komentar uz nju.

1. Prijavljujete samo trke koje ste sami istrčali.
2. Rok za prijavu je dva dana od dana trke. Kasniju prijavu i dalje unosimo, ali je kršenje ovog pravila razlog za meru iz sekcije 7.
3. Link ka zvaničnim rezultatima je obavezan osim ako priložite sliku. Slika, diploma ili snimak ekrana sata, prihvata se kao dokaz samo uz komentar u kom kažete zbog čega izostaje link ka zvaničnim rezultatima, šta se na slici vidi, i brišemo je odmah posle provere.
4. Boduje se samo trka na kojoj je zvanično mereno vreme.
5. Unosi se neto vreme, u obliku `hh:mm:ss`, bez desetinki.
6. Za maraton i polumaraton dužina se unosi tačno kao `42.2` i `21.1`, bez tolerancije; svaka druga vrednost svrstava trku u drugu kategoriju po dužini.
7. Ako trke nema u kalendaru, prijavite je svejedno; administrator će uz vaš rezultat napraviti i događaj i trku.
8. Isti rezultat se prijavljuje jednom. Sa jednog događaja možete imati više rezultata ako ste trčali više trka, ali ne dva sa iste trke.
9. Ako trku niste završili, rezultata nema. Odustajanje i nedolazak ne evidentiramo.
10. Ako ste prešli na kraću trku, rezultat priznajemo samo ako ste u zvaničnim rezultatima te kraće trke.

### Verifikacija rezultata

Nijedan rezultat ne ulazi u rang liste dok ga ne odobrimo. Neverifikovan rezultat se nigde javno ne prikazuje. Administracija sme da ispravi činjenične podatke rezultata pri verifikaciji: naziv događaja, naziv trke, vrstu trke, vreme, dužinu, uspon i spust. Bodove ne dira nikada, jer su izračunata vrednost. Takmičar koji smatra da je ispravka greška obraća se ligi.$old$,
             $new$Rezultati su srce lige i tu zaista računamo na vaše poštenje: prijavljujte samo trke koje ste sami istrčali. Sve o tome kako se rezultat prijavljuje, šta služi kao dokaz, koji su rokovi i kako ga proveravamo, naći ćete u [pravilniku](/pravilnik).$new$),

            ('terms 5', 'uslovi-koriscenja', 5, 'en', 'body',
             $old$Results are the heart of the league, and this is the only part of these terms where we seriously rely on your honesty. You submit a result in two ways: through the form on your profile, where you enter the race's name, date, type of race, location, length, ascent, descent, time, and a link to the official results; or with the button in the race's row on the event's own page, where the portal takes from that race whatever it specifies. The link is mandatory unless you attach a picture; then a comment alongside it is mandatory.

1. You submit only races you ran yourself.
2. The deadline for submission is two days from the day of the race. We still enter a later submission, but breaching this rule is grounds for the measure in section 7.
3. A link to the official results is mandatory unless you attach a picture. A picture, certificate, or watch screenshot is accepted as evidence only together with a comment stating why the link to the official results is missing, what is seen in the picture, and we delete it immediately after checking.
4. Only a race with an officially measured time counts toward points.
5. The net time is entered, in the form `hh:mm:ss`, without tenths of a second.
6. For a marathon and a half marathon, the length is entered exactly as `42.2` and `21.1`, with no tolerance; any other value places the race in another category by length.
7. If the race is not in the calendar, submit it anyway; the administrator will create both the event and the race along with your result.
8. The same result is submitted once. From one event you may have more than one result if you ran more than one race, but not two from the same race.
9. If you did not finish the race, there is no result. We do not record a withdrawal or a no-show.
10. If you switched to a shorter race, we recognize the result only if you are in that shorter race's official results.

### Verification of results

No result enters the rankings until we approve it. An unverified result is not shown publicly anywhere. The administration may correct the factual data of a result during verification: the event's name, the race's name, the type of race, the time, the length, the ascent, and the descent. It never touches the points, since they are a calculated value. A competitor who believes a correction is a mistake contacts the league.$old$,
             $new$Results are the heart of the league, and here we truly rely on your honesty: submit only races you ran yourself. Everything about how a result is submitted, what serves as evidence, what the deadlines are, and how we check it, you will find in the [Rulebook](/pravilnik).$new$),

            ('terms 7', 'uslovi-koriscenja', 7, 'sr', 'body',
             $old$Nisu dozvoljeni: prijava rezultata koji niste istrčali ili sa netačnim podacima; vređanje, pretnje i uznemiravanje drugih članova; postavljanje sadržaja na koji nemate pravo; otvaranje izmišljenih naloga; i pokušaj da se zaobiđu pravila bodovanja ili verifikacije.

Komentari se objavljuju tek posle odobrenja.

### Mere za kršenje pravila

Mere za kršenje pravila i postupak u kom se izriču uređuje [opšti pravilnik lige](/pravilnik). Ukratko: mere idu od opomene, preko diskvalifikacije iz tekuće sezone, a za najteže ili ponovljene prekršaje i do isključenja iz Udruženja. Mera se bira srazmerno težini povrede, posledicama, ponavljanju i nameri.

O meri u prvom stepenu odlučuje Upravni odbor, pisanom i obrazloženom odlukom, pošto vam je omogućio da se izjasnite. Protiv odluke možete podneti žalbu Skupštini u roku od 15 dana od uručenja.

Članarina se ne vraća.$old$,
             $new$Komentari se objavljuju tek posle odobrenja.

Koje mere postoje i kako se izriču, uređuje [pravilnik](/pravilnik).$new$),

            ('terms 7', 'uslovi-koriscenja', 7, 'en', 'body',
             $old$Not allowed: submitting a result you did not run, or with inaccurate data; insulting, threatening, and harassing other members; posting content you have no right to; opening fabricated accounts; and attempting to circumvent the scoring or verification rules.

Comments are published only after approval.

### Measures for breaching the rules

The measures for breaching the rules and the procedure in which they are imposed are governed by the [league's general Rulebook](/pravilnik). In short: measures range from a warning, through disqualification from the current season, to expulsion from the Association for the most serious or repeated breaches. The measure is chosen in proportion to the severity of the breach, its consequences, repetition, and intent.

The first-instance decision on the measure is made by the Managing Board, by a written and reasoned decision, after giving you the opportunity to respond. You may appeal the decision to the General Assembly within 15 days of delivery.

The membership fee is not refunded.$old$,
             $new$Comments are published only after approval.

Which measures exist and how they are imposed is governed by the [Rulebook](/pravilnik).$new$),

            ('terms 10, the name of the race', 'uslovi-koriscenja', 10, 'sr', 'body',
             $old$Round n Around$old$,
             $new$Round 'n' Around$new$),

            ('terms 10, the name of the race', 'uslovi-koriscenja', 10, 'en', 'body',
             $old$Round n Around$old$,
             $new$Round 'n' Around$new$),

            ('terms 12', 'uslovi-koriscenja', 12, 'sr', 'body',
             $old$| Šta želite | Šta se dešava |
|---|---|
| Odjava za tekuću sezonu | Prestajete da unosite rezultate te godine, ostajete u istorijskim tabelama, članarina se ne vraća |
| Da ne produžite takmičarski status za narednu sezonu | Profil se više ne prikazuje, ime ostaje u istorijskim tabelama, podatke čuvamo pet godina |
| Brisanje podataka | Uklanjamo ime, prezime i članski broj sa svih mesta, zajedno sa rezultatima; gde ste se pominjali ostaje anonimizovan zapis |

Mere prema članu izriču se po postupku iz sekcije 7. Dok takmičarski status za sezonu nije aktiviran, član se ne pojavljuje u rang listama te sezone i profil mu se ne prikazuje. Kada ga aktivira, prikazuje se ponovo. Kada takmičarski status nije aktivan, profil se ne prikazuje drugima; svoj profil i dalje otvarate, dok ga administracija ne obriše. Dukati i priznanja ostaju zauvek zabeleženi i vraćaju se sa vama kada produžite.

$old$,
             $new$Iz tekuće sezone možete da se odjavite kad god želite. Od tada više ne unosite rezultate za tu godinu, ali ostajete u istorijskim tabelama.

Odjava iz sezone ne znači i istupanje iz Udruženja. Ako želite da istupite, postupak opisuje [Statut](/BTL%20Statut.pdf).

Ako ne obnovite takmičarski status za narednu sezonu, vaš profil se više ne prikazuje, a vaše ime ostaje u tabelama sezona u kojima ste trčali. Koliko dugo čuvamo podatke i kada ih brišemo objašnjava [politika privatnosti](/politika-privatnosti).

Vi svoj profil i dalje vidite, a dukati i priznanja ostaju zabeleženi i vraćaju se sa vama kad ponovo obnovite status.

Ako zatražite brisanje, uklanjamo vaše ime, prezime i članski broj sa svih mesta, zajedno sa rezultatima. Ostaje samo ono što smo po zakonu dužni da čuvamo, o čemu više piše u politici privatnosti, a tamo gde ste se pominjali ostaje zapis bez imena.

$new$),

            ('terms 12', 'uslovi-koriscenja', 12, 'en', 'body',
             $old$| What you want | What happens |
|---|---|
| Cancel for the current season | You stop entering results for that year, you remain in the historical tables, the membership fee is not refunded |
| Not renewing competitor status for the next season | The profile is no longer displayed, the name remains in the historical tables, we keep the data for five years |
| Deleting your data | We remove your first name, last name, and member number from everywhere, together with the results; wherever you were mentioned, an anonymized record remains |

Measures against a member are imposed under the procedure in section 7. While competitor status for a season is not activated, the member does not appear in that season's rankings and their profile is not displayed. Once they activate it, it is displayed again. When competitor status is not active, the profile is not displayed to others; you can still open your own profile, until the administration deletes it. Ducats and honours remain recorded forever and come back with you when you renew.

$old$,
             $new$You can cancel for the current season whenever you like. From then on you no longer enter results for that year, but you remain in the historical tables.

Cancelling for a season does not mean leaving the Association. If you wish to leave, the procedure is described in the [Statute](/BTL%20Statut.pdf).

If you do not renew your competitor status for the next season, your profile is no longer displayed, and your name remains in the tables of the seasons in which you ran. How long we keep data and when we delete it is explained in the [privacy policy](/politika-privatnosti).

You can still see your own profile, and your ducats and honours stay on record and come back with you when you renew your status.

If you request deletion, we remove your first name, last name, and member number from everywhere, together with the results. Only what we are required by law to keep remains, which the privacy policy describes in more detail, and wherever you were mentioned, a record without a name remains.

$new$),

            ('terms date', 'uslovi-koriscenja', 12, 'sr', 'body',
             $old$Poslednja izmena: 10.10.2026.$old$,
             $new$Poslednja izmena: 22.10.2026.$new$),

            ('terms date', 'uslovi-koriscenja', 12, 'en', 'body',
             $old$Last amended: 10.10.2026.$old$,
             $new$Last amended: 22.10.2026.$new$),

            ('terms 9 becomes 8', 'uslovi-koriscenja', 9, 'sr', 'heading',
             $old$9. Sadržaj koji postavljate$old$,
             $new$8. Sadržaj koji postavljate$new$),

            ('terms 9 becomes 8', 'uslovi-koriscenja', 9, 'en', 'heading',
             $old$9. Content you post$old$,
             $new$8. Content you post$new$),

            ('terms 10 becomes 9', 'uslovi-koriscenja', 10, 'sr', 'heading',
             $old$10. Šta portal jeste i šta nije$old$,
             $new$9. Šta portal jeste i šta nije$new$),

            ('terms 10 becomes 9', 'uslovi-koriscenja', 10, 'en', 'heading',
             $old$10. What the portal is and what it is not$old$,
             $new$9. What the portal is and what it is not$new$),

            ('terms 11 becomes 10', 'uslovi-koriscenja', 11, 'sr', 'heading',
             $old$11. Tehnički partneri$old$,
             $new$10. Tehnički partneri$new$),

            ('terms 11 becomes 10', 'uslovi-koriscenja', 11, 'en', 'heading',
             $old$11. Technical partners$old$,
             $new$10. Technical partners$new$),

            ('terms 12 becomes 11', 'uslovi-koriscenja', 12, 'sr', 'heading',
             $old$12. Odjava, brisanje, izmene i sporovi$old$,
             $new$11. Odjava, brisanje, izmene i sporovi$new$),

            ('terms 12 becomes 11', 'uslovi-koriscenja', 12, 'en', 'heading',
             $old$12. Cancellation, deletion, changes, and disputes$old$,
             $new$11. Cancellation, deletion, changes, and disputes$new$),

            ('policy 2, the cookie rows', 'politika-privatnosti', 2, 'sr', 'body',
             $old$| Bezbednosni kolačić, i kolačić sesije kad prijava proradi | Bez njih slanje obrasca i prijava ne mogu bezbedno da rade | Neophodno za pruženu uslugu | Do kraja posete, odnosno do odjave |$old$,
             $new$| Bezbednosni kolačić | Bez njega slanje obrasca ne može bezbedno da radi | Neophodno za pruženu uslugu | Do kraja posete |
| Kolačić sesije | Bez njega prijava ne može da radi | Neophodno za pruženu uslugu | Do odjave, a najduže 30 dana od poslednjeg korišćenja portala |$new$),

            ('policy 2, the cookie rows', 'politika-privatnosti', 2, 'en', 'body',
             $old$| Security cookie, and a session cookie once sign-in is working | Without them, submitting a form and signing in cannot work safely | Necessary for the service provided | Until the end of the visit, or until sign-out |$old$,
             $new$| Security cookie | Without it, submitting a form cannot work safely | Necessary for the service provided | Until the end of the visit |
| Session cookie | Without it, signing in cannot work | Necessary for the service provided | Until sign-out, and at most 30 days from the last use of the portal |$new$),

            ('policy 3, statistics', 'politika-privatnosti', 3, 'sr', 'body',
             $old$bodovi i plasman, dukati i priznanja$old$,
             $new$bodovi, plasman i statistika, dukati i priznanja$new$),

            ('policy 3, statistics', 'politika-privatnosti', 3, 'en', 'body',
             $old$points and placing, ducats and honours$old$,
             $new$points, placing, and statistics, ducats and honours$new$),

            ('policy 4, the cookies', 'politika-privatnosti', 4, 'sr', 'body',
             $old$Portal postavlja jedan jedini kolačić, i to bezbednosni. Služi samo tome da obrazac koji pošaljete zaista bude poslat sa ove strane, a ne podmetnut sa tuđe. Ne prati vaše ponašanje, ne pravi profil posetioca, ne govori ko ste i ne deli se ni sa kim. Za njega se pristanak ne traži, jer je nužan: bez njega slanje obrasca ne može bezbedno da radi.

Kad prijava proradi, uz njega će stajati i kolačić sesije, bez kog prijava ne može da radi. I za njega važi isto: ne prati vaše ponašanje, ne pravi profil posetioca i ne deli se ni sa kim.

$old$,
             $new$Portal postavlja dva kolačića i oba su nužna za njegov rad. Prvi je bezbednosni: brine o tome da obrazac koji pošaljete zaista stigne sa ove strane, a ne podmetnut sa tuđe. Drugi je kolačić sesije, koji vas drži prijavljenim dok se ne odjavite, a najduže 30 dana od kada ste poslednji put koristili portal. Nijedan od njih ne prati šta radite, ne pravi vaš profil i ne deli se ni sa kim, pa za njih ne tražimo pristanak.

$new$),

            ('policy 4, the cookies', 'politika-privatnosti', 4, 'en', 'body',
             $old$The portal sets exactly one cookie, and it is a security cookie. It serves only to ensure that a form you submit was really sent from this site, and not planted from somewhere else. It does not track your behaviour, does not build a visitor profile, does not say who you are, and is not shared with anyone. No consent is asked for it, because it is necessary: without it, submitting a form cannot work safely.

Once sign-in is working, a session cookie will stand alongside it, without which sign-in cannot work. The same applies to it too: it does not track your behaviour, does not build a visitor profile, and is not shared with anyone.

$old$,
             $new$The portal sets two cookies, and both are necessary for it to work. The first is the security cookie: it makes sure that a form you submit really comes from this site, and is not planted from somewhere else. The second is the session cookie, which keeps you signed in until you sign out, and at most 30 days from the last time you used the portal. Neither of them tracks what you do, builds a profile of you, or is shared with anyone, so we do not ask for your consent to them.

$new$),

            ('policy 4, two cookies', 'politika-privatnosti', 4, 'en', 'body',
             $old$Besides the cookie,$old$,
             $new$Besides the cookies,$new$),

            ('policy 6, the cookies', 'politika-privatnosti', 6, 'sr', 'body',
             $old$portal postavlja samo jedan bezbednosni kolačić, bez kog slanje obrasca ne može bezbedno da radi,$old$,
             $new$portal postavlja samo dva kolačića, bezbednosni i kolačić sesije, bez kojih slanje obrasca i prijava ne mogu bezbedno da rade,$new$),

            ('policy 6, the cookies', 'politika-privatnosti', 6, 'en', 'body',
             $old$the portal sets only one security cookie, without which submitting a form cannot work safely,$old$,
             $new$the portal sets only two cookies, the security cookie and the session cookie, without which submitting a form and signing in cannot work safely,$new$)

        ) as edits (label, slug, section_position, in_language, field, old_text, new_text)
    loop
        total := total + 1;

        if edit.in_language = 'sr' then
            select case edit.field when 'heading' then s.heading else s.body end into current_text
            from static_page_section s
            join static_page p on p.id = s.page_id
            where p.slug = edit.slug and s.position = edit.section_position;
        else
            select case edit.field when 'heading' then t.heading else t.body end into current_text
            from static_page_section_translation t
            join static_page_section s on s.id = t.section_id
            join static_page p on p.id = s.page_id
            where p.slug = edit.slug and s.position = edit.section_position
              and t.language = edit.in_language;
        end if;

        if not found then
            problems := problems + 1;
            report := report || format(E'\n%s @ %s #%s %s %s: there is no such text',
                edit.label, edit.slug, edit.section_position, edit.in_language, edit.field);
            continue;
        end if;

        /* How many times the old text stands in the text it is aimed at, counted by what taking it out takes away. */
        seen := (length(current_text) - length(replace(current_text, edit.old_text, '')))
                / length(edit.old_text);

        /* The new text is asked about too, and a text that already holds it is a problem. An edit whose new text is
           empty takes something out; strpos of an empty string is 1 everywhere, so for it there is nothing to ask. */
        already := edit.new_text <> '' and strpos(current_text, edit.new_text) > 0;

        report := report || format(E'\n%s @ %s #%s %s %s: found %s%s',
            edit.label, edit.slug, edit.section_position, edit.in_language, edit.field,
            case seen when 1 then 'once' else seen::text || ' times' end,
            case when already then ', and its new text is already there' else '' end);

        if seen <> 1 or already then
            problems := problems + 1;
            continue;
        end if;

        if edit.in_language = 'sr' then
            update static_page_section s
            set body    = case edit.field when 'body'    then replace(s.body, edit.old_text, edit.new_text)    else s.body end,
                heading = case edit.field when 'heading' then replace(s.heading, edit.old_text, edit.new_text) else s.heading end
            from static_page p
            where p.id = s.page_id and p.slug = edit.slug and s.position = edit.section_position;
        else
            update static_page_section_translation t
            set body    = case edit.field when 'body'    then replace(t.body, edit.old_text, edit.new_text)    else t.body end,
                heading = case edit.field when 'heading' then replace(t.heading, edit.old_text, edit.new_text) else t.heading end
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

/* SECTION 8 OF THE TERMS OF USE GOES, and only if it is still the section this file was written against, word for word
   in both languages. Its English translation goes with it through static_page_section_translation_section_fk, which is
   ON DELETE CASCADE. Anything but exactly one such row stops the migration with nothing changed. */
do $gone$
declare
    taken integer;
    moved integer;
begin
    delete from static_page_section s
    using static_page p
    where p.id = s.page_id and p.slug = 'uslovi-koriscenja' and s.position = 8
      and s.heading = '8. Nagrade'
      and s.body = $body$Nagrade i priznanja uređuje pravilnik za tekuću sezonu, na strani [pravilnik lige](/pravilnik). Dva pravila vredi znati unapred:

1. Digitalne nagrade i diplome dodeljuju se automatski pri zamrzavanju tabela, svima u istom trenutku, gde god da živite.
2. Rok za preuzimanje fizičkih nagrada je mesec dana, po prethodnom dogovoru sa Udruženjem. Pehare ne šaljemo poštom; majica sezone i finišerska medalja se šalju, i to zajedno, čim član skupi 12 BTL bodova. Poštanske troškove snosi Član. Rok postoji da se preuzimanje ne razvlači u nedogled, a ne da bi neko ostao bez nagrade: ličnu predaju uvek možete dogovoriti.

Pehari se uručuju na ceremoniji spojenoj sa BTL dezorijentiringom.$body$
      and exists (select 1 from static_page_section_translation t
                  where t.section_id = s.id and t.language = 'en'
                    and t.heading = '8. Awards'
                    and t.body = $body$Awards and honours are governed by the Rulebook for the current season, on the [league rulebook](/pravilnik) page. Two rules are worth knowing in advance:

1. Digital awards and certificates are given out automatically when the tables are frozen, to everyone at the same moment, regardless of where you live.
2. The deadline for collecting physical awards is one month, by prior arrangement with the Association. We do not send trophies by post; the season's T-shirt and the finisher's medal are sent, and together, as soon as a member collects 12 BTL points. Postal costs are borne by the member. The deadline exists so that collection is not dragged out indefinitely, not so that someone is left without an award: you can always arrange an in-person handover.

Trophies are presented at a ceremony joined with the BTL dezorijentiring.$body$);
    get diagnostics taken = row_count;

    if taken <> 1 then
        raise exception using
            message = format('section 8 of the terms of use was not removed: %s rows matched, and exactly one was expected', taken),
            hint = 'The section this migration was written against is not the section this database holds. Nothing was changed.';
    end if;

    /* The four sections after it move up by one. static_page_section_position_unique is DEFERRABLE, so it is asked at the
       end of the statement and not row by row, which is what lets 9 become 8 while 10 still stands. */
    update static_page_section s
    set position = s.position - 1
    from static_page p
    where p.id = s.page_id and p.slug = 'uslovi-koriscenja' and s.position > 8;
    get diagnostics moved = row_count;

    if moved <> 4 then
        raise exception using
            message = format('the terms of use did not close the gap section 8 left: %s sections moved, and four were expected', moved);
    end if;
end
$gone$;
