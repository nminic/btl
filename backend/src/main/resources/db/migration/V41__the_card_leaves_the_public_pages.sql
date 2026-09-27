/* THE CARD LEAVES BOTH PUBLIC PAGES, BECAUSE THE PORTAL NO LONGER TAKES ONE.
 *
 * Owner, 26.09.2026: "Nece biti moguce placanje karticama do daljnjeg." Card payment
 * is withdrawn. Shown four outcomes on 28.09.2026 for what the two public pages
 * should say about it, the owner chose the first, on the assistant's recommendation:
 * the card comes off BOTH places, rather than being marked "privremeno nedostupno"
 * or left standing in the privacy policy alone. The reasoning put to him and
 * accepted: a page that lists what you CAN do reads better than one that lists what
 * you cannot, and "privremeno nedostupno" invites the question "do kad", which
 * nobody can answer today. Rejected: leaving the sentence in the privacy policy;
 * adding that it is temporarily unavailable; leaving it standing until after
 * 1.10.2026.
 *
 * TWO HOMES, BOTH V24'S, ONE OF THEM ALREADY REWRITTEN ONCE BY V26 - so the two
 * statements below are not both against V24's original wording.
 *
 *   - uslovi-koriscenja, position 4, "4. Registracija, uplata i aktivacija": the
 *     payment methods table drops "ili karticom" from both of its rows, and the
 *     paragraph opening "Kada plaćate karticom..." is removed whole. Searched across
 *     every migration for `update static_page_section`: nothing has touched this
 *     section since V24 wrote it, so V24's own wording is what the database holds
 *     today and what this statement is written against. The sentence "Portal ne
 *     izdaje račun..." that follows is untouched, and so is everything before
 *     "### Načini plaćanja".
 *   - politika-privatnosti, position 2, "2. Koje podatke obrađujemo, zašto i po kom
 *     osnovu": the sentence "Podatke o platnoj kartici..." is removed whole, and the
 *     "Potvrda uplate" row of the "Članarina" table just above it is untouched - it
 *     is about proof of payment in general, not about the card. THIS section was
 *     already rewritten once, by V26 (20.09.2026, the cookie policy correction), so
 *     the body this migration writes over is V26's text, not V24's: V24's own copy
 *     of this section has stood stale in that file since the day V26 replaced it,
 *     which is what a migration being immutable (ADL A2) means. Writing this update
 *     against V24's wording instead would have silently undone every other
 *     correction V26 made to the same section.
 *
 * WHY A NEW MIGRATION AND NOT AN EDIT OF V24 OR V26. Both are immutable from the day
 * they merged (ADL A2), and Flyway refuses to start against a database whose stored
 * checksum and the file no longer agree (MigrationsAreImmutableTest says so with the
 * numbers). V24 seeded these rows and V26 already corrected one of them; this
 * corrects both again, the same way V26 corrected V24.
 *
 * NO SCHEMA CHANGE, and no row of static_page_translation or
 * static_page_section_translation is touched. V37's own header says both tables
 * arrive and stay EMPTY until a translation migration of their own populates them,
 * and searching every migration for an insert into either table finds none: there is
 * no English copy of either sentence yet for this correction to reach.
 *
 * WHAT HOLDS THE COPIES OF THIS TEXT TOGETHER, the same pair V26 names for the same
 * reason: frontend/src/test/mock/pages.json, which PageApiTest compares this
 * server's answer against field by field, and
 * frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts
 * holds that mock file to in the other direction. Both are rewritten out of this
 * same text, not retyped by hand a second time.
 *
 * TWO ROWS, BY SLUG AND POSITION, AND NOTHING ELSE. */

update static_page_section
set body = 'Prijava za članstvo podnosi se prvenstveno putem portala.

1. Popunite formu. Uz svako polje koje ima pravilo stoji objašnjenje tog pravila.
2. Potvrdite adresu elektronske pošte. Bez potvrde nalog se ne aktivira.
3. Nalog je otvoren, ali takmičarski status još nije aktivan. Dok nije, niste vidljivi na portalu i ne možete ništa da radite. Vidite samo ono što vidi i svaki posetilac: kalendar, rang liste i profile drugih takmičara.
4. Platite članarinu.
5. Mi evidentiramo uplatu i aktiviramo vam takmičarski status. Status vidite u roku od dva dana, i tada dobijate članski broj. Član koga je Upravni odbor oslobodio plaćanja članarine prolazi bez koraka 4; članski broj i sva prava dobija u istom trenutku kao i svaki drugi član.

Uredna prijava podneta kroz portal prihvata se automatski, u skladu sa aktima Udruženja.

Članski broj ima oblik `000001`, šestocifren je i jedinstven za oba pola, ostaje isti kroz sve sezone i prikazuje se javno pored imena. Ako napravite pauzu, broj vam je ostao rezervisan. Jedan broj se nikad ne dodeljuje dvaput, pa ostaje potrošen i kad zatražite brisanje podataka.

### Načini plaćanja

| Odakle ste | Kako plaćate |
|---|---|
| Srbija | Uplatnicom, za koju portal generiše QR kod |
| Sve ostale zemlje | PayPalom |

Članovima iz Srbije PayPal se ne prikazuje, i to nije stvar izbora nego propisa.

Portal ne izdaje račun ni potvrdu o uplati. Dokaz je potvrda vaše banke ili platnog sistema, uz obaveštenje koje šaljemo kada članarinu aktiviramo.'
where page_id = (select id from static_page where slug = 'uslovi-koriscenja')
  and position = 4;

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

### Podaci koji nastaju samim posećivanjem

| Podatak | Zašto | Pravni osnov | Koliko čuvamo |
|---|---|---|---|
| Izbor svetle ili tamne teme (`btl-theme`, lokalno skladište) | Da vas portal otvori u temi koju ste izabrali | Neophodno za pruženu uslugu, jer ga sami izaberete | Dok ga sami ne obrišete |
| Bezbednosni kolačić, i kolačić sesije kad prijava proradi | Bez njih slanje obrasca i prijava ne mogu bezbedno da rade | Neophodno za pruženu uslugu | Do kraja posete, odnosno do odjave |
| Zapisi servera | Bezbednost i otkrivanje zloupotreba | Legitimni interes | 30 dana |'
where page_id = (select id from static_page where slug = 'politika-privatnosti')
  and position = 2;
