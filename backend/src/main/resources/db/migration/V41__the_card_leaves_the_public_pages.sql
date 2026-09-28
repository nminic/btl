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
 * THREE HOMES, NOT TWO. The independent review of PR 410 found the third after the
 * two statements below had already merged into this branch's own history, and it is
 * a mechanical miss worth naming rather than quietly repaired. politika-privatnosti,
 * position 5 ("5. Koliko čuvamo i kome prosleđujemo"), carries "Kad kartično
 * plaćanje bude uvedeno, obrađivač tih plaćanja se upisuje u ovu tabelu." The word is
 * "kartično", with č - both the guard in StaticPageSectionTextCarriedOverTest and the
 * search run over the live server before this correction looked for the root
 * "kartic", with a plain c. The two strings never meet, and AssertJ's
 * ignoringCase/doesNotContainIgnoringCase only case-folds; it does not transliterate
 * č to c. A search for the shorter root "karti" catches every inflection this
 * repository actually uses for the card (kartica, karticom, karticama, kartično) and
 * nothing else - checked across every migration and both frontend fixtures for a
 * stray hit, and the only word it ever matches is the card, never the dative of
 * "karta" ("na karti") or any other unrelated word. Shown the choice on 28.09.2026
 * between leaving this sentence standing (it is not untrue, and the section it sits
 * in answers "to whom do we pass your data", not "how do you pay") and dropping it
 * for the same reason as the other two, the owner chose to drop it, against the
 * assistant's recommendation, for one plain reason: zero mentions of the card
 * anywhere on the portal while the card does not exist. The cost he accepted in
 * exchange: this sentence returns, in a migration of its own, the day card payment
 * does.
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
 *   - politika-privatnosti, position 5, "5. Koliko čuvamo i kome prosleđujemo": the
 *     one sentence named above is removed whole. The row just above it in the
 *     retention table ("Arhiva odlaznih mejlova | ...") and the "### Dva načina na
 *     koja podaci nestaju" heading just below it are untouched - the sentence sits
 *     alone between them, its own paragraph. Nothing has touched this section since
 *     V24 wrote it, so V24's own wording is what this statement is written against.
 *
 * A FOURTH STATEMENT, ADDED THE SAME DAY, FOR A REASON THAT HAS NOTHING TO DO WITH
 * THE CARD. All three public legal documents close with the same sign-off, by a
 * decision of 22.08.2026 that the three be held to the SAME date on purpose (the
 * owner's own words: "potpis je isti na sva tri dokumenta... cuvar drzi sva tri
 * zajedno, jer je trazeno bas da se poklapaju") - "Sportsko udruženje BTL" and
 * "Poslednja izmena: 15.09.2026.", written once by V24 and never touched since on
 * any of the three. This migration's own first statement above edits
 * uslovi-koriscenja for the first time since that date, which makes ITS sign-off
 * false the moment this migration runs; V26 already made politika-privatnosti's
 * false eight days ago, on 20.09.2026, and nothing was watching for it then. Shown
 * three outcomes on 28.09.2026 - a date of its own per document (truer per document,
 * but reopens the 22.08.2026 decision that the three are read as one set, and a
 * visitor comparing three different dates reads three unrelated documents rather
 * than one relationship kept current); leaving 15.09.2026 stand (no work, but two
 * legal documents would tell a visitor on launch day that they were last revised on
 * a date that is not true of either); or moving all three to today - the owner chose
 * the third, on the assistant's recommendation. The sign-off is read from today
 * onward as the revision date of the DOCUMENT SET, not of one document by itself:
 * they are maintained together, so they are signed together, which applies the
 * 22.08.2026 decision rather than relaxing it. The cost accepted: pravilnik's own
 * date will say it was revised today, though not one word of its text moved.
 *
 * WHY ONE STATEMENT FOR ALL THREE, AND WHY replace() RATHER THAN THREE FULL BODIES.
 * The edit is the same fourteen characters in three otherwise-unrelated documents,
 * and the surest proof that nothing else in any of them moved is to never restate
 * them: `replace(body, 'Poslednja izmena: 15.09.2026.', 'Poslednja izmena:
 * 28.09.2026.')` touches exactly that substring and nothing else, in whichever of
 * the three rows it runs against. Each of the three bodies was checked for a second
 * occurrence of "15.09.2026" before this was written: there is none, in any of them,
 * so the substring is unique within each body and this statement cannot reach past
 * the one date it is aimed at.
 *
 * WHY A NEW MIGRATION AND NOT AN EDIT OF V24 OR V26. Both are immutable from the day
 * they merged (ADL A2), and Flyway refuses to start against a database whose stored
 * checksum and the file no longer agree (MigrationsAreImmutableTest says so with the
 * numbers). V24 seeded all six rows this migration now touches, and V26 already
 * corrected one of them (position 2, above); this corrects all six, five of them for
 * the first time since V24 wrote them and position 2 for the second time.
 *
 * WHY THIS IS STILL ONE MIGRATION FILE, CHANGED IN PLACE, RATHER THAN A SECOND ONE
 * NEXT TO IT. Unlike V24 and V26, V41 had not merged to main when the third home and
 * the stale sign-off were found: checked directly rather than assumed, with
 * `git ls-tree origin/main -- backend/src/main/resources/db/migration`, which stops
 * at V40, and `git merge-base` against this branch, which lands exactly on
 * origin/main's own tip. So V41 has never been part of a merged commit and could not
 * have reached QA or production, which only ever run what main has merged; ADL A2's
 * protection for migrations that have already run does not cover it yet, and this
 * file may still change. A fifth statement arriving as V42 the same week would claim,
 * falsely, that some database once ran the two-statement version of V41 - none ever
 * did.
 *
 * NO SCHEMA CHANGE, and no row of static_page_translation or
 * static_page_section_translation is touched. V37's own header says both tables
 * arrive and stay EMPTY until a translation migration of their own populates them,
 * and searching every migration for an insert into either table finds none: there is
 * no English copy of any of this text yet for this correction to reach.
 *
 * WHAT HOLDS THE COPIES OF THIS TEXT TOGETHER, the same pair V26 names for the same
 * reason, plus a third that pins the date rather than the prose:
 * frontend/src/test/mock/pages.json, which PageApiTest compares this server's answer
 * against field by field; frontend/src/test/writtenPages.snapshot.json, which
 * writtenVerification.test.ts holds that mock file to in the other direction; and
 * frontend/src/pages/writtenPages.test.tsx, whose "signs all three documents the same
 * way" case holds one pinned date against all three sign-offs at once, on purpose,
 * so that moving the date here and not there is a red test rather than a silent
 * drift. All three are rewritten out of this same text, not retyped by hand a second
 * time.
 *
 * SIX ROWS ACROSS THREE PAGES: THE FIRST THREE STATEMENTS EACH BY ITS OWN SLUG AND
 * POSITION, THE FOURTH BY THREE PAIRS OF THEM AT ONCE, AND NOTHING ELSE. */

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

update static_page_section
set body = '| Situacija | Šta se dešava |
|---|---|
| Dok ste član | Čuvamo dok traje članstvo |
| Prestanete da budete član | Pet godina od poslednje sezone, pa se profil trajno briše |
| Broj ličnog dokumenta i ime oca | Pet godina od poslednje sezone, kao i ostatak profila. Evidencija članova se vodi po Zakonu o sportu i ne prestaje da postoji istog dana kad i članstvo |
| Nalog nikad nije aktiviran | 12 meseci od otvaranja naloga, ako u međuvremenu nije aktiviran |
| Knjigovodstvena dokumentacija o uplatama | Najmanje pet godina od poslednjeg dana poslovne godine na koju se dokument odnosi, odnosno duže ako to zahteva drugi primenljivi propis |
| Interne beleške administracije | 5 godina od poslednje sezone članstva, osim ako su ranije prestale da budu potrebne |
| Arhiva odlaznih mejlova | 2 godine od slanja, osim poruka koje čine deo dokumentacije za koju važi duži zakonski rok |

### Dva načina na koja podaci nestaju

Na zahtev za brisanje uklanjamo podatke koje više nemamo pravni osnov ili obavezu da čuvamo. Podatke koje smo dužni da čuvamo ili koji su nam potrebni radi zaštite pravnih zahteva čuvamo do isteka odgovarajućeg roka. Brisanje profila na portalu i obavezne evidencije Udruženja su dve različite stvari.

Dalje, dva načina se namerno razlikuju. Po isteku pet godina, ako niste tražili ništa, u istorijskim tabelama ostaje samo ime i prezime kao običan tekst bez linka: zvanični rezultat sezone je zapis takmičenja koji liga ima legitiman interes da sačuva celovit. Ako sami tražite brisanje, ili ste diskvalifikovani, brišu se i profil i rezultati, ime i članski broj nestaju, a gde god ste se pominjali ostaje anonimizovan zapis. Sam broj ostaje potrošen i ne dobija ga niko drugi.

### Kome prosleđujemo

Podatke ne prodajemo i ne dajemo trećima za njihove svrhe. Delimo ih samo sa onima bez kojih portal ne može da radi, i u najmanjoj mogućoj meri.

| Ko | Šta dobija | Gde je |
|---|---|---|
| Hetzner Online GmbH | Smeštaj portala | Nemačka |
| Cloudflare | Saobraćaj i IP adrese, zaštita i domen | SAD i EU |
| PayPal (Europe) S.à r.l. et Cie, S.C.A. | Ime, adresa elektronske pošte i iznos, za članove iz inostranstva | Luksemburg |
| Brevo (Sendinblue SAS) | Vaša adresa i sadržaj poruke | Francuska |
| Poslovna banka Udruženja | Podaci sa naloga za uplatu | Srbija |

Sa svakim od njih imamo uređen odnos po kome podatke smeju da koriste isključivo za posao koji rade za nas. Državnom organu podatke dajemo samo po zahtevu zasnovanom na zakonu, koji pre toga proveravamo.

Server je u Nemačkoj, dakle u Evropskoj uniji. Za prenos van Evropske unije koristimo propisane mehanizme zaštite.'
where page_id = (select id from static_page where slug = 'politika-privatnosti')
  and position = 5;

update static_page_section
set body = replace(body, 'Poslednja izmena: 15.09.2026.', 'Poslednja izmena: 28.09.2026.')
from static_page
where static_page_section.page_id = static_page.id
  and (static_page.slug, static_page_section.position) in (
        ('politika-privatnosti', 7),
        ('uslovi-koriscenja', 12),
        ('pravilnik', 19)
      );
