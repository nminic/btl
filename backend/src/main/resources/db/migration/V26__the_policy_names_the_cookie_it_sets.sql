/* THE POLICY SAYS WHAT THE PORTAL REALLY DOES WITH A COOKIE.
 *
 * Owner, 20.09.2026, shown the conflict by the independent review of PR 317 and asked
 * which way to settle it: rewrite the sentence so that it is true. This is that, and
 * nothing else moves with it.
 *
 * WHAT WAS WRONG. Section 4 of the published privacy policy opened with "Portal danas ne
 * postavlja nijedan kolacic. Kad prijava proradi, postavljace..." and closed with a
 * promise that this page would say so BEFORE any such thing was introduced. Both
 * sentences stopped being true the day /nova-lozinka and /potvrda-adrese were written:
 * askTheServer.ts reads an open route to be handed a token, ApiSecurity answers it with
 * csrf.spa(), and an anonymous visitor who has opened a link out of a message is holding
 * a security cookie. A published legal text describing a portal that does not exist is
 * the fault PR 99 was opened for, turned round.
 *
 * ALL THREE HOMES OF IT, NOT THE ONE THE REVIEW NAMED. The claim stood in three places,
 * and a fix in one of them would have left the document disagreeing with itself:
 *
 *   - section 2, the row of "Podaci koji nastaju samim posecivanjem", which put every
 *     cookie in the future ("kad prijava proradi");
 *   - section 4, the two opening sentences and the "i sada" that followed from them;
 *   - section 6, "portal ih danas ne postavlja nijedan", said again among the rights.
 *
 * WHAT THE LEGAL CONCLUSION IS, AND IT DOES NOT CHANGE. There is still no consent bar and
 * ADL.md A9 is still right: consent is asked for what is not necessary, and a cookie
 * without which a form cannot safely be sent is necessary. What changes is that the
 * reader is now told the cookie exists, which is what he was owed and was not given.
 *
 * THE ONE FIGURE IN IT WAS MEASURED, NOT ASSUMED. "Do kraja posete" in the table of
 * section 2 is what CookieCsrfTokenRepository writes: its constructor sets cookieMaxAge
 * to -1, which is a cookie that goes when the browser does. Read out of
 * spring-security-web 7.1.0 rather than remembered.
 *
 * WHY A NEW MIGRATION AND NOT AN EDIT OF V24. ADL.md A2: a migration is immutable from the
 * day it merges, and Flyway refuses to start against a database whose stored checksum and
 * the file no longer agree (MigrationsAreImmutableTest says so with the numbers). V24
 * seeded these rows; this updates three of them.
 *
 * WHAT HOLDS THE COPIES OF THIS TEXT TOGETHER. The same words stand in
 * frontend/public/mock/pages.json, which is what the portal draws today, and in
 * frontend/src/test/writtenPages.snapshot.json, which is a copy of the record held as it
 * stands (pages/writtenVerification.test.ts). PageApiTest compares what this server
 * answers against the mock file field by field, so an update that matched no row, or
 * matched one and left the file behind, is a red gate rather than a document quietly
 * disagreeing with the screen. These three bodies were written out of that file rather
 * than retyped, for the reason V24's own header gives.
 *
 * NO SCHEMA CHANGE. Three bodies, by slug and position, and nothing else. */

update static_page_section
set body = '### Podaci koje unosite pri učlanjenju

| Podatak | Zašto | Pravni osnov | Koliko čuvamo |
|---|---|---|---|
| Ime i prezime | Identifikacija, profil, tabele | Izvršenje ugovora | Sekcija 5 |
| Datum rođenja | Uzrasna kategorija i primena pravila za maloletne članove | Izvršenje ugovora | Sekcija 5 |
| Pol | Muška i ženska rang lista | Izvršenje ugovora | Sekcija 5 |
| Izbor kategorije, početnička ili starosna | Razvrstavanje u rang liste | Izvršenje ugovora | Sekcija 5 |
| Mesto i zemlja | Profil, mapa posećenih zemalja, način plaćanja, i državljanstvo u evidenciji članova | Izvršenje ugovora i pravna obaveza | Sekcija 5 |
| Adresa elektronske pošte | Prijava i obavezna obaveštenja | Izvršenje ugovora | Sekcija 5 |
| Lozinka | Zaštita naloga, čuva se samo kao kriptografski otisak | Izvršenje ugovora | Dok traje nalog |
| Profilna fotografija | Prikaz na javnom profilu | Izvršenje ugovora | Sekcija 5 |
| Veličina majice | Izrada i isporuka majice | Izvršenje ugovora | Do isporuke |
| Adresa | Slanje majice i medalje, i adresa prebivališta i boravišta u evidenciji članova | Izvršenje ugovora i pravna obaveza | Sekcija 5 |
| Ime oca | Evidencija članova koju udruženje vodi po zakonu | Pravna obaveza | Sekcija 5 |
| Broj ličnog dokumenta | Evidencija članova koju udruženje vodi po zakonu. Od člana mlađeg od 16 godina se traži ali nije obavezan, jer lična karta se izdaje sa 16. Vidi ga samo administracija, ne prikazuje se nigde i stoji odvojeno od podataka koje čitaju ekrani portala, u sopstvenoj tabeli sa sopstvenim pravom pristupa | Pravna obaveza | Sekcija 5 |
| Telefon, neobavezno | Da vas brzo dobijemo oko uplate, nagrade ili nejasnog rezultata | Vaš pristanak | Sekcija 5 |
| Izjava da ste upoznati sa pravilnikom i zdravstveno sposobni | Uslov za učlanjenje, potvrđujete je u prijavi | Izvršenje ugovora | Sekcija 5 |
| Za maloletne: ime i prezime roditelja ili staratelja, srodstvo, i datum, vreme i IP adresa sa koje je saglasnost data | Saglasnost roditelja za člana mlađeg od 14 godina i održavanje naloga člana mlađeg od 16 godina, i dokaz da je data | Izvršenje ugovora | Sekcija 5 |

### Podaci koji nastaju dok ste član

| Podatak | Zašto | Pravni osnov | Koliko čuvamo |
|---|---|---|---|
| Rezultati trka i sve što se iz njih računa: bodovi, plasman, dukati, priznanja | Suština usluge | Izvršenje ugovora | Sekcija 5 |
| Fotografija sata ili ekrana kao dokaz | Provera spornog rezultata | Izvršenje ugovora | Briše se odmah po verifikaciji |
| Biografija, tekst o sebi, linkovi na Stravu i Instagram | Predstavljanje, dobrovoljno | Vaš pristanak | Sekcija 5 |
| Ocene i komentari na događaje | Vodič ostalim članovima | Izvršenje ugovora | Sekcija 5 |
| Tim, trkački par, klub | Poredak timova i parova | Izvršenje ugovora | Sekcija 5 |
| Privatne poruke među članovima | Dogovor oko prevoza i smeštaja | Izvršenje ugovora | Sekcija 5 |
| Rođendan, ako sami izaberete da ga objavite | Lista rođendana | Vaš pristanak, podrazumevano isključeno | Dok ga ne isključite |
| Interne beleške administracije | Evidencija spornih slučajeva | Legitimni interes | Sekcija 5 |

### Članarina

| Podatak | Zašto | Pravni osnov | Koliko čuvamo |
|---|---|---|---|
| Iznos, datum, način i status uplate | Aktivacija članstva | Izvršenje ugovora | Sekcija 5 |
| Stanje virtuelnog balansa i knjiga njegovih promena | Program preporuke i plaćanje budućih članarina | Izvršenje ugovora | Sekcija 5 |
| Potvrda uplate | Knjigovodstvo | Pravna obaveza | Sekcija 5 |

Podatke o platnoj kartici nikada ne vidimo, ne primamo i ne čuvamo. Broj kartice unosite direktno kod platnog provajdera, a nama se vraća samo podatak da li je plaćanje uspelo.

### Podaci koji nastaju samim posećivanjem

| Podatak | Zašto | Pravni osnov | Koliko čuvamo |
|---|---|---|---|
| Izbor svetle ili tamne teme (`btl-theme`, lokalno skladište) | Da vas portal otvori u temi koju ste izabrali | Neophodno za pruženu uslugu, jer ga sami izaberete | Dok ga sami ne obrišete |
| Bezbednosni kolačić, i kolačić sesije kad prijava proradi | Bez njih slanje obrasca i prijava ne mogu bezbedno da rade | Neophodno za pruženu uslugu | Do kraja posete, odnosno do odjave |
| Zapisi servera | Bezbednost i otkrivanje zloupotreba | Legitimni interes | 30 dana |'
where page_id = (select id from static_page where slug = 'politika-privatnosti')
  and position = 2;

update static_page_section
set body = 'Portal postavlja jedan jedini kolačić, i to bezbednosni. Služi samo tome da obrazac koji pošaljete zaista bude poslat sa ove strane, a ne podmetnut sa tuđe. Ne prati vaše ponašanje, ne pravi profil posetioca, ne govori ko ste i ne deli se ni sa kim. Za njega se pristanak ne traži, jer je nužan: bez njega slanje obrasca ne može bezbedno da radi.

Kad prijava proradi, uz njega će stajati i kolačić sesije, bez kog prijava ne može da radi. I za njega važi isto: ne prati vaše ponašanje, ne pravi profil posetioca i ne deli se ni sa kim.

Pored kolačića, u vašem pregledaču se čuva i još nešto: izbor svetle ili tamne teme, pod imenom `btl-theme`, u lokalnom skladištu. Pravno je to isto što i kolačić, pa piše ovde iako se tako ne zove. Postavlja se tek kad temu sami izaberete, ostaje u vašem pregledaču i nikada ne stiže do nas: ne šalje se ni sa jednim zahtevom, pa ga naš server ne vidi. Čita ga samo sama strana, u vašem pregledaču, da bi znala u kojoj temi da se iscrta. Za njega se pristanak ne traži, jer je to podešavanje prikaza koje ste sami zatražili. Brišete ga brisanjem podataka sajta u pregledaču, a portal će vas onda otvoriti u tamnoj temi, koja je podrazumevana.

Drugog skladišta nema. Nema analitike, ni naše ni tuđe, pa nema ni trake za pristanak: pristanak se traži za ono što nije nužno, a ovde ničega takvog nema. Ako to jednog dana uvedemo, ova strana će to reći pre nego što se uvede.

Oglasnih mreža, piksela društvenih mreža i kolačića za oglašavanje na portalu nema. Vaše podatke ne prodajemo i ne ustupamo oglašivačima.'
where page_id = (select id from static_page where slug = 'politika-privatnosti')
  and position = 4;

update static_page_section
set body = 'Imate pravo na: pristup podacima i kopiju; ispravku i dopunu; brisanje; ograničenje obrade; prenosivost; prigovor na obradu po legitimnom interesu; i povlačenje pristanka.

Sva prava ostvarujete pisanjem na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net). Bez obrasca, bez obrazloženja i besplatno. Rok je bez odlaganja, a najkasnije 30 dana od prijema zahteva; ako je zahtev složen, produžetak i razlog javljamo unutar tih 30 dana. Pre nego što bilo šta pošaljemo proveravamo da ste to zaista vi, jer su podaci poslati pogrešnoj osobi gori od podataka koji kasne.

Deo možete i sami: polja profila menjate i brišete u podešavanjima, a obaveštenja palite i gasite tamo. Saglasnost za kolačiće se ne povlači jer se ne daje: portal postavlja samo jedan bezbednosni kolačić, bez kog slanje obrasca ne može bezbedno da radi, a jedino što još čuva u vašem pregledaču je izbor teme, koji ste sami zatražili; ni za jedno se pristanak ne traži (sekcija 4). Dugmeta koje jednim klikom preuzima sve podatke nema; kopiju pripremamo ručno, u CSV ili JSON obliku ako to tražite.

### Ako niste zadovoljni

Prvo nam pišite, jer se većina stvari reši u jednoj poruci.'
where page_id = (select id from static_page where slug = 'politika-privatnosti')
  and position = 6;
