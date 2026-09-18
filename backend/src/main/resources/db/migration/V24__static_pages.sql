/* THE WRITTEN PAGES: THE RULEBOOK, THE TWO LEGAL TEXTS, AND THE PRESIDENT'S OWN WORD.
 *
 * PDL.md:4376, owner, 06.08.2026: "Podaci drze sedam stavki: Clanovi, Dogadjaji, Timovi,
 * Lige, Staticne strane, Moderatori i Cenovnik." Confirmed 11.08.2026 (PDL.md:4441). The
 * list is not closed: an administrator creates, edits and deletes a written page, which is
 * why this migration carries none of the "GENERATED FILE, immutable" banner V2 and V4
 * carry. Those two are closed codebooks kept equal forever to a frontend file by
 * backend/tools/generate_reference_migrations.py; a written page has no such file to stay
 * equal to after today. V5 (role_and_admin_right.sql) is the nearer precedent: a table
 * written by hand, once, with the reason recorded here instead of in a generator.
 *
 * SLUG IS THE ONLY IDENTITY THIS SCHEMA STILL CHECKS FOR BEING TAKEN. ADL.md:359:
 * "Provera jedinstvenosti ostaje samo tamo gde identitet i dalje kuca covek: adresa
 * staticne strane." Every other identity in this portal is constructed (a member number,
 * a generated key); this one is still typed by a human, so it is the one uniqueness this
 * migration still has to enforce itself.
 *
 * INCLUDES. ADL.md:595: "Zapis pisane strane nosi neobavezno polje `includes`, spisak
 * adresa drugih zapisa cije se sekcije crtaju iznad njegovih." No seeded page uses it
 * today - the one page it was written for, the president's own address, is drawn by the
 * FRONT PAGE component directly and carries no address of its own at all (PDL.md:4517-4524;
 * frontend/src/data/pages.ts, DRAWN_BY_A_SCREEN) - but the field is part of the record's
 * shape (frontend/src/data/types.ts, StaticPage.includes) and the schema has to hold it
 * whether or not a row uses it today. Held as a table and not as an array column: nothing
 * in this schema is an array column (league_race, V19, is the nearest relation of this
 * shape and it is a join table with a composite key), and an array of slugs could point
 * at a page that does not exist where a foreign key cannot.
 *
 * GALLERY IS A CLOSED LIST OF TWO. ADL.md:558: "PageSection.gallery je neobavezno polje sa
 * DVE dozvoljene vrednosti, `ducats` ... i `prices`." A third value, `statute`, existed for
 * one day (22.08.2026) and left with its own drawing and its own branch; nothing here
 * should make room for a value the product does not have today.
 *
 * WHAT THIS MIGRATION DELIBERATELY DOES NOT CARRY. ADL.md:957, and this is a boundary
 * rather than an omission: "Revizioni trag, da se ne trazi tamo gde ga nema... Ono sto
 * postoji je tacno troje i sve troje mora u semu... Ko projektuje semu ne sme da doda
 * cetvrto ni da izostavi jedno od ovo troje." A written page is none of the three (a
 * result's last-edit stamp, the balance ledger's immutable rows, mail as the log); it gets
 * no history, no version, no "last edited by" here. Editing a page overwrites its text and
 * nothing remembers what stood there before.
 *
 * SEEDED FROM frontend/public/mock/pages.json, which is real content and not a placeholder:
 * the privacy policy and the terms of use are the actual legal text the portal has to
 * publish before it can register anyone (PDL.md:3094), and the rulebook and the
 * president's address are the actual copy the owner approved. The rows below are that
 * file, transcribed by a generator script run once for this migration (kept outside the
 * repository, not backend/tools/generate_reference_migrations.py - see above) rather than
 * retyped by hand, so the seed cannot silently drift from the file a reviewer would
 * otherwise have to diff by eye. PageApiTest compares the two directly for that reason.
 */
create table static_page (
    id    bigserial not null,
    slug  text      not null,
    title text      not null,

    constraint static_page_pk primary key (id),

    /* ADL.md:359: the one identity in this portal still typed by a human, and so the
       one this schema still checks for being taken. */
    constraint static_page_slug_unique unique (slug),

    constraint static_page_slug_not_blank check (btrim(slug) <> ''),
    constraint static_page_title_not_blank check (btrim(title) <> '')

    /* No shape check on `slug` (contrast `role_code_shape`, V5): no decision fixes one,
       and the screen that will type it does not exist yet. Whoever writes the form that
       creates a page decides the shape then; a regex guessed here ahead of it is a rule
       with no source, and neither PDL.md nor ADL.md names one. */
);

/* One block of a page's own text, in the order it is read. ADL.md:558, 559, 566, 567: a
   heading, a body, an optional named drawing, and a `[[gallery]]` line inside the body that
   says where the drawing stands - the marker is the frontend's concern
   (PageSectionBody.tsx) and lives inside `body` like any other text; this schema only
   carries the name. */
create table static_page_section (
    id       bigserial not null,
    page_id  bigint    not null,
    position integer   not null,
    heading  text      not null,
    body     text      not null,
    gallery  text,

    constraint static_page_section_pk primary key (id),
    constraint static_page_section_page_fk foreign key (page_id)
        references static_page (id) on delete cascade,

    /* Deferrable for the reason V4's price_row_sort_order_unique is: this column is an
       order maintained by moving a range of it, and the day a page gets an editor that
       reorders its sections it will need exactly the "shift, then move" PricingApiTest
       already demonstrates. Initially immediate, so an ordinary insert is still checked
       exactly where it is written. */
    constraint static_page_section_position_unique unique (page_id, position)
        deferrable initially immediate,

    constraint static_page_section_position_positive check (position > 0),
    constraint static_page_section_heading_not_blank check (btrim(heading) <> ''),

    /* ADL.md:558: the list is closed at two, and a third value (`statute`) that existed
       for one day left with its own branch rather than widening this one. */
    constraint static_page_section_gallery_known
        check (gallery is null or gallery in ('ducats', 'prices'))
);

/* Which pages a page takes in, and in what order. ADL.md:595: "spisak adresa drugih zapisa
   cije se sekcije crtaju iznad njegovih". Held as a table rather than as a `text[]` column
   on `static_page`, the shape every other relation of this kind takes in this schema
   (league_race, V19, is the nearest one: a join table with a composite key and `on delete
   cascade` on both sides) and the only shape that can refuse an address that does not
   exist, which an array of slugs cannot. No row uses this table today; see the header of
   this file for why it is here anyway. */
create table static_page_include (
    id                bigserial not null,
    page_id           bigint    not null,
    position          integer   not null,
    included_page_id  bigint    not null,

    constraint static_page_include_pk primary key (id),
    constraint static_page_include_page_fk foreign key (page_id)
        references static_page (id) on delete cascade,
    /* Cascaded rather than restricted: deleting a page this schema already lets an
       administrator delete (PDL.md:4376) is not blocked by another page merely quoting
       it, the same direction PDL.md already takes when a team is deleted (its points
       leave the table it stood in rather than blocking the deletion). Nothing writes to
       this table yet, so the choice has no observable effect today; it is made now
       because a foreign key cannot be silent about it, and no decision names this case,
       so this is my own reasoning and not a cited one. */
    constraint static_page_include_included_fk foreign key (included_page_id)
        references static_page (id) on delete cascade,

    /* NOT deferred, unlike static_page_section_position_unique, and the difference is
       measured rather than stylistic: no row of this table exists today (see the
       header of this file), so there is no range of six or more to shift, and
       KeysAndIndexesTest's own floor (aRangeOfTheOrderMovesInOneStatement) needs real
       rows to move. This column is an order in the same sense a page's own sections
       are (ADL.md:595), and the day an admin screen reorders what a page takes in,
       that migration is what turns this deferrable, against data that can prove it. */
    constraint static_page_include_position_unique unique (page_id, position),

    constraint static_page_include_position_positive check (position > 0),
    constraint static_page_include_not_self check (page_id <> included_page_id),
    constraint static_page_include_once_per_page unique (page_id, included_page_id)
);

/* The other side of the relation, the same way league_race_race_idx serves the race
   side of league_race_pk. `page_id` needs no index of its own: it already leads
   static_page_include_position_unique, the same way it leads static_page_include_pk
   in every row this table has. */
create index static_page_include_included_idx on static_page_include (included_page_id);

insert into static_page (slug, title) values
    ('politika-privatnosti', 'Politika privatnosti'),
    ('uslovi-koriscenja', 'Uslovi korišćenja'),
    ('rec-predsednika', 'Reč predsednika'),
    ('pravilnik', 'Opšti pravilnik Balkanske trkačke lige za sezonu 2027');

insert into static_page_section (page_id, position, heading, body, gallery) values
    ((select id from static_page where slug = 'politika-privatnosti'), 1, '1. Ko smo i koji propisi važe', 'Vašim podacima rukuje Sportsko udruženje BTL, koje vodi Balkansku trkačku ligu i portal [balkanskatrkackaliga.net](https://balkanskatrkackaliga.net).

| | |
|---|---|
| Sedište | Beograd |
| Adresa sedišta | Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd |
| Matični broj | 28815158 |
| PIB | 109089912 |
| Sva pitanja o privatnosti | [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net) |
| Lice za zaštitu podataka | Nikola Minić |

Podatke obrađujemo u skladu sa Zakonom o zaštiti podataka o ličnosti Republike Srbije i, kada je primenljiv, Opštom uredbom EU o zaštiti podataka (GDPR).', null),
    ((select id from static_page where slug = 'politika-privatnosti'), 2, '2. Koje podatke obrađujemo, zašto i po kom osnovu', '### Podaci koje unosite pri učlanjenju

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
| Kolačić sesije i bezbednosni kolačići, kad prijava proradi | Bez njih prijava ne može da radi | Neophodno za pruženu uslugu | Do odjave |
| Zapisi servera | Bezbednost i otkrivanje zloupotreba | Legitimni interes | 30 dana |', null),
    ((select id from static_page where slug = 'politika-privatnosti'), 3, '3. Šta je javno, a šta nikada nije', 'Liga je javno takmičenje i vaš profil je javna strana. To je suština usluge koju vam pružamo i na to pristajete učlanjenjem.

### Javno se prikazuje

Ime i prezime, članski broj, uzrasna i polna kategorija, mesto i zemlja, profilna fotografija, svi verifikovani rezultati sa datumima i merama, bodovi i plasman, dukati i priznanja, tim, trkački par i klub, biografija, ocene i komentari na događaje, i linkovi koje sami dodate.

### Nikada se ne prikazuje

Datum rođenja, adresa elektronske pošte, adresa za slanje, sve u vezi sa članarinom i plaćanjem, stanje virtuelnog balansa, veličina majice, ime oca, broj ličnog dokumenta, telefon, privatne poruke, interne beleške administracije, i sve u vezi sa roditeljskim potpisom: ime roditelja, srodstvo, datum, vreme i IP adresa.

Datum rođenja tražimo samo da bismo znali uzrasnu kategoriju i ne prikazujemo ga ni u punom ni u skraćenom obliku; javna je samo kategorija koja iz njega proizlazi. U podešavanjima možete sakriti profil od posetilaca koji nisu prijavljeni, ali ne i od ostalih članova, jer bi time nestao smisao zajedničkog rangiranja. Kad članarina istekne, profil se više ne prikazuje, a ime ostaje u istorijskim tabelama onih sezona u kojima ste bili član.

### Fotografije

Galerije sa trka nema i nema označavanja ljudi na fotografijama. Jedina vaša fotografija je profilna, koju administrator odobrava pre objave. Za slike koje BTL osoblje napravi na okupljanjima udruženja saglasnost dajete prihvatanjem pravilnika. Ako tražite uklanjanje, postupamo srazmerno: sliku na kojoj ste vi predmet uklanjamo, a sa grupne uklanjamo ono što vas identifikuje.

### Maloletni članovi

Donje granice uzrasta za članstvo nema. Za člana mlađeg od 14 godina potrebna je prethodna saglasnost roditelja ili staratelja. Za članove mlađe od 16 godina nalog na portalu održava roditelj ili staratelj, uz elektronski potpis u formi za registraciju, bez kog se registracija ne može završiti. Uz potpis čuvamo ime i prezime roditelja, srodstvo (majka, otac ili staratelj), i datum, vreme i IP adresu sa koje je dat, jer je to ono što potpis čini dokazivim. Roditelj vodi nalog dok dete ne napuni 16 godina, a posle toga nalog vodi sam član. Granicu od 16 godina primenjujemo jednako u svim zemljama.', null),
    ((select id from static_page where slug = 'politika-privatnosti'), 4, '4. Kolačići i lokalno skladište', 'Portal danas ne postavlja nijedan kolačić. Kad prijava proradi, postavljaće kolačić sesije i bezbednosne kolačiće, bez kojih prijava ne može da radi; oni ne prate vaše ponašanje, ne prave profil posetioca i ne dele se ni sa kim.

Jedno jedino nešto se čuva u vašem pregledaču i sada: izbor svetle ili tamne teme, pod imenom `btl-theme`, u lokalnom skladištu. Pravno je to isto što i kolačić, pa piše ovde iako se tako ne zove. Postavlja se tek kad temu sami izaberete, ostaje u vašem pregledaču i nikada ne stiže do nas: ne šalje se ni sa jednim zahtevom, pa ga naš server ne vidi. Čita ga samo sama strana, u vašem pregledaču, da bi znala u kojoj temi da se iscrta. Za njega se pristanak ne traži, jer je to podešavanje prikaza koje ste sami zatražili. Brišete ga brisanjem podataka sajta u pregledaču, a portal će vas onda otvoriti u tamnoj temi, koja je podrazumevana.

Drugog skladišta nema. Nema analitike, ni naše ni tuđe, pa nema ni trake za pristanak: pristanak se traži za ono što nije nužno, a ovde ničega takvog nema. Ako to jednog dana uvedemo, ova strana će to reći pre nego što se uvede.

Oglasnih mreža, piksela društvenih mreža i kolačića za oglašavanje na portalu nema. Vaše podatke ne prodajemo i ne ustupamo oglašivačima.', null),
    ((select id from static_page where slug = 'politika-privatnosti'), 5, '5. Koliko čuvamo i kome prosleđujemo', '| Situacija | Šta se dešava |
|---|---|
| Dok ste član | Čuvamo dok traje članstvo |
| Prestanete da budete član | Pet godina od poslednje sezone, pa se profil trajno briše |
| Broj ličnog dokumenta i ime oca | Pet godina od poslednje sezone, kao i ostatak profila. Evidencija članova se vodi po Zakonu o sportu i ne prestaje da postoji istog dana kad i članstvo |
| Nalog nikad nije aktiviran | 12 meseci od otvaranja naloga, ako u međuvremenu nije aktiviran |
| Knjigovodstvena dokumentacija o uplatama | Najmanje pet godina od poslednjeg dana poslovne godine na koju se dokument odnosi, odnosno duže ako to zahteva drugi primenljivi propis |
| Interne beleške administracije | 5 godina od poslednje sezone članstva, osim ako su ranije prestale da budu potrebne |
| Arhiva odlaznih mejlova | 2 godine od slanja, osim poruka koje čine deo dokumentacije za koju važi duži zakonski rok |

Kad kartično plaćanje bude uvedeno, obrađivač tih plaćanja se upisuje u ovu tabelu.

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

Server je u Nemačkoj, dakle u Evropskoj uniji. Za prenos van Evropske unije koristimo propisane mehanizme zaštite.', null),
    ((select id from static_page where slug = 'politika-privatnosti'), 6, '6. Vaša prava', 'Imate pravo na: pristup podacima i kopiju; ispravku i dopunu; brisanje; ograničenje obrade; prenosivost; prigovor na obradu po legitimnom interesu; i povlačenje pristanka.

Sva prava ostvarujete pisanjem na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net). Bez obrasca, bez obrazloženja i besplatno. Rok je bez odlaganja, a najkasnije 30 dana od prijema zahteva; ako je zahtev složen, produžetak i razlog javljamo unutar tih 30 dana. Pre nego što bilo šta pošaljemo proveravamo da ste to zaista vi, jer su podaci poslati pogrešnoj osobi gori od podataka koji kasne.

Deo možete i sami: polja profila menjate i brišete u podešavanjima, a obaveštenja palite i gasite tamo. Saglasnost za kolačiće se ne povlači jer se ne daje: portal ih danas ne postavlja nijedan, a jedino što čuva u vašem pregledaču je izbor teme, za koji se pristanak ne traži (sekcija 4). Dugmeta koje jednim klikom preuzima sve podatke nema; kopiju pripremamo ručno, u CSV ili JSON obliku ako to tražite.

### Ako niste zadovoljni

Prvo nam pišite, jer se većina stvari reši u jednoj poruci.', null),
    ((select id from static_page where slug = 'politika-privatnosti'), 7, '7. Bezbednost, automatika i izmene', 'Sav saobraćaj ide preko šifrovane veze, lozinke se čuvaju samo kao kriptografski otisak, pristup podacima ima mali broj ljudi sa tačno određenim pravima, a nalog sa najširim pravima koristi dvofaktorsku prijavu. Nijedan sistem nije potpuno bezbedan; ako dođe do povrede podataka koja može da vam naškodi, obaveštavamo vas i nadzorni organ u propisanim rokovima.

Portal automatski računa bodove, plasman i dukate, što je matematika po javno poznatim pravilima. Nijednu odluku sa pravnim posledicama po vas ne donosi automat: verifikaciju rezultata, odobravanje profila i sve mere prema članovima donosi čovek.

Politiku menjamo kada se promeni ono što radimo. Ako izmena bitno utiče na vaša prava, javljamo vam elektronskom poštom pre nego što stupi na snagu.

---

Sportsko udruženje BTL
Poslednja izmena: 15.09.2026.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 1, '1. Ko smo i šta ovi uslovi uređuju', 'Portal [balkanskatrkackaliga.net](https://balkanskatrkackaliga.net) vodi Sportsko udruženje BTL, registrovano u Agenciji za privredne registre Republike Srbije, matični broj 28815158, PIB 109089912, sedište Beograd, adresa sedišta Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd. Pišite nam na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).

Ovi uslovi uređuju korišćenje portala i članstvo u ligi. Korišćenjem portala prihvatate ih; ako se ne slažete, portal nemojte koristiti.

Na članstvo i rad Udruženja primenjuje se [Statut Sportskog udruženja BTL](/BTL%20Statut.pdf). U slučaju nesaglasnosti Statuta i drugih akata Udruženja, primenjuje se Statut.

Uz njih važe još dva dokumenta: [opšti pravilnik lige](/pravilnik), koji uređuje samo takmičenje i donosi se za svaku sezonu, i politika privatnosti, koja uređuje šta radimo sa vašim podacima. Ako se uslovi i pravilnik razlikuju u nečemu što se tiče takmičenja, važi pravilnik.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 2, '2. Ko može biti član', 'Registracija na portalu predstavlja prijavu za članstvo. Prijem u članstvo vrši se u skladu sa Statutom i aktima Upravnog odbora. Članstvo proizvodi dejstvo po evidentiranoj uplati članarine, ako je članarina za to lice utvrđena.

Ne tražimo nikakav rezultat ni prethodno iskustvo, boduju se trke bilo gde na svetu, i članstvo je otvoreno za takmičare iz svake zemlje.

Takmičarski status za sezonu je nešto drugo od članstva. Dok takmičarski status nije aktivan, nalog postoji, ali se rezultati ne unose, ne rangiraju i ne ulaze u tabele, a profil se ne prikazuje. Članarina se, dakle, ne plaća za pristup sajtu nego za članstvo u ligi.

Donje granice uzrasta nema. Za člana mlađeg od 14 godina potrebna je prethodna saglasnost roditelja ili staratelja. Za članove mlađe od 16 godina nalog na portalu održava roditelj ili staratelj. Ko ima 14 ili 15 godina sam prihvata članstvo, a nalog mu i dalje održava roditelj ili staratelj.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 3, '3. Članarina', 'Visinu članarine i rokove plaćanja utvrđuje Upravni odbor posebnom odlukom. Važeći cenovnik objavljuje se u [opštem pravilniku lige](/pravilnik), uz član o članarini.

Članarina se plaća za sezonu, koja traje od 1. januara do 31. decembra. Cenovnik se ponavlja svake godine: od 1. oktobra se prodaje naredna sezona, a od 1. januara do 30. septembra tekuća, bez prava na rangiranje. Uplate primamo od 1. oktobra. Dinarska cena je fiksirana za celu sezonu i ne menja se sa kursom.

Ko se učlani tokom sezone dobija profil i unosi svoje rezultate, ali ne konkuriše za mesta i ne pojavljuje se u rang listama te sezone.

Povlašćenih cena nema, ali Upravni odbor sme odlukom da redovnog člana oslobodi plaćanja članarine, sa istim pravima; za pravo rangiranja u nekoj sezoni ta odluka mora biti doneta do 31. decembra prethodne godine.

Članarina se ne vraća. Članstvo je usluga vezana za slobodno vreme, sa unapred određenim periodom pružanja: sezona za koju je članarina uplaćena, od 1. januara do 31. decembra te kalendarske godine. Možete se odjaviti u svakom trenutku, ali uplaćena članarina se ne vraća.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 4, '4. Registracija, uplata i aktivacija', 'Prijava za članstvo podnosi se prvenstveno putem portala.

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
| Srbija | Uplatnicom, za koju portal generiše QR kod, ili karticom |
| Sve ostale zemlje | PayPalom ili karticom |

Članovima iz Srbije PayPal se ne prikazuje, i to nije stvar izbora nego propisa.

Kada plaćate karticom, podatke o kartici ne primamo ni ne čuvamo: unosite ih direktno na strani platnog provajdera, a nama se vraća samo podatak da li je plaćanje uspelo.

Portal ne izdaje račun ni potvrdu o uplati. Dokaz je potvrda vaše banke ili platnog sistema, uz obaveštenje koje šaljemo kada članarinu aktiviramo.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 5, '5. Unos i verifikacija rezultata', 'Rezultati su srce lige i ovo je jedini deo ovih uslova gde ozbiljno računamo na vaše poštenje. Rezultat prijavljujete na dva načina: kroz formu na svom profilu, gde unosite naziv trke, datum, vrstu trke, mesto, dužinu, uspon, spust, vreme i link ka zvaničnim rezultatima; ili dugmetom u redu trke na strani samog događaja, gde portal sa te trke preuzima ono što ona zadaje. Link je obavezan osim ako priložite sliku; tada je obavezan komentar uz nju.

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

Nijedan rezultat ne ulazi u rang liste dok ga ne odobrimo. Neverifikovan rezultat se nigde javno ne prikazuje. Administracija sme da ispravi činjenične podatke rezultata pri verifikaciji: naziv događaja, naziv trke, vrstu trke i vreme. Bodove ne dira nikada, jer su izračunata vrednost. Takmičar koji smatra da je ispravka greška obraća se ligi.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 6, '6. Program preporuke', 'Svaki član ima lični link za preporuku. Ko se preko njega učlani i kome članarina bude aktivirana prvi naredni put, donosi vam iznos koji na taj dan važi, a koji vam stoji ispisan na vašoj strani „Moja članarina", uz sam link. Iznos leže na vaš balans u trenutku aktivacije, ne u trenutku prijave, i o tome vas obaveštavamo porukom.

Balansom se plaćaju buduće članarine, u celini ili delimično. Nikada se ne isplaćuje u novcu i ne prenosi se drugom članu: vezan je za nalog na kome je zarađen. Svaka promena vidljiva vam je na nalogu, sa datumom i razlogom.

Program se ne sme koristiti za registraciju izmišljenih ili tuđih naloga. Takvi nalozi se brišu, a stečeni balans poništava.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 7, '7. Pravila ponašanja i mere', 'Od svakog člana očekujemo fer plej i uvažavanje svih učesnika, bez obzira na pol, etničko poreklo, rasu, veru ili seksualnu orijentaciju. To je etički kodeks lige i deo je pravilnika.

Nisu dozvoljeni: prijava rezultata koji niste istrčali ili sa netačnim podacima; vređanje, pretnje i uznemiravanje drugih članova; postavljanje sadržaja na koji nemate pravo; otvaranje izmišljenih naloga; i pokušaj da se zaobiđu pravila bodovanja ili verifikacije.

Komentari se objavljuju tek posle odobrenja.

### Mere za kršenje pravila

Mere za kršenje pravila i postupak u kom se izriču uređuje [opšti pravilnik lige](/pravilnik). Ukratko: mere idu od opomene, preko diskvalifikacije iz tekuće sezone, a za najteže ili ponovljene prekršaje i do isključenja iz Udruženja. Mera se bira srazmerno težini povrede, posledicama, ponavljanju i nameri.

O meri u prvom stepenu odlučuje Upravni odbor, pisanom i obrazloženom odlukom, pošto vam je omogućio da se izjasnite. Protiv odluke možete podneti žalbu Skupštini u roku od 15 dana od uručenja.

Članarina se ne vraća.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 8, '8. Nagrade', 'Nagrade i priznanja uređuje pravilnik za tekuću sezonu, na strani [pravilnik lige](/pravilnik). Tri pravila vredi znati unapred:

1. Digitalne nagrade i diplome dodeljuju se automatski pri zamrzavanju tabela, svima u istom trenutku, gde god da živite.
2. Rok za preuzimanje fizičkih nagrada je mesec dana, po prethodnom dogovoru sa Udruženjem. Pehare ne šaljemo poštom; majica sezone i finišerska medalja se šalju, i to zajedno, čim član skupi 12 BTL bodova. Poštanske troškove snosi Član. Rok postoji da se preuzimanje ne razvlači u nedogled, a ne da bi neko ostao bez nagrade: ličnu predaju uvek možete dogovoriti.
3. Dugmetom na profilu možete ovlastiti drugog člana da vam preuzme nagradu.

Pehari se uručuju na ceremoniji spojenoj sa BTL dezorijentiringom.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 9, '9. Sadržaj koji postavljate', 'Na portal postavljate profilnu fotografiju, biografiju, tekst o sebi, ocene i komentare na događaje. Taj sadržaj ostaje vaš i ne polažemo pravo na njega.

Postavljanjem nam dajete neisključivo pravo da ga prikazujemo na portalu i koristimo za predstavljanje portala i lige, na primer u slici za deljenje vašeg profila. To pravo prestaje kada sadržaj uklonite, osim tamo gde je već ugrađen u istorijski zapis takmičenja. Postavljanjem potvrđujete i da imate pravo da ga postavite.

Profilnu fotografiju i biografiju odobravamo pre objave, a sadržaj koji krši ova pravila možemo ukloniti, uz obaveštenje vama.

Sadržaj koji je napravio BTL, uključujući tekstove, logo, izgled portala i način obračuna bodova, ostaje naš i ne koristi se bez naše dozvole.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 10, '10. Šta portal jeste i šta nije', 'Ovo je najvažnija sekcija ovih uslova, pa je izdvojena.

### BTL nije organizator tuđih trka

Liga po pravilu ne organizuje trke: ne postavlja staze, ne meri vreme i ne prima prijave, nego vodi rangiranje rekreativaca po sopstvenoj formuli, na osnovu rezultata koje su izmerili organizatori. Izuzetak su takmičenja koja liga organizuje sama, danas Round n Around ultramaraton i BTL dezorijentiring; za njih je liga organizator sa svime što uz to ide.

Za sve ostale trke važi:

- Kalendar je informativan. Datume prikupljamo od organizatora i proveravamo ih, ali jedini merodavan izvor je uvek organizator.
- Prijava na trku ide isključivo kod organizatora, preko linka koji uz trku stoji. Portal prijave ne prima i ne posreduje.
- Za sve na trci odgovoran je organizator: bezbednost staze, merenje vremena, startni paket, otkazivanje i povraćaj startnine.
- Kada na portalu iskažete nameru da idete na trku, to nije prijava ni prema nama ni prema organizatoru, nego informacija drugim članovima radi dogovora oko prevoza.
- Osim u slučaju da je to precizno naznačeno na portalu, BTL ne organizuje prevoz. Za dogovor i za put odgovorni ste vi i osoba sa kojom se dogovarate.

### Trčite na sopstvenu odgovornost

Trčanje i planinarenje nose rizik. Vi ste odgovorni za svoje zdravlje i za procenu da li ste za neku trku spremni, i to pri registraciji i potvrđujete.

### Portal se redovno održava

Trudimo se da portal radi bez prekida i da su podaci tačni, ali to ne možemo garantovati. Ne odgovaramo za štetu nastalu iz korišćenja portala, iz oslanjanja na podatke o trkama, iz nedostupnosti portala, ni iz postupaka drugih članova. To ne važi za štetu koju prouzrokujemo namerno ili grubom nepažnjom, ni za slučajeve u kojima se odgovornost po zakonu ne može isključiti.

### Za organizatore trka

Ako uz svoju trku vidite netačan podatak, ili ne želite da vam trka bude u našem kalendaru, pišite na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net). Zahtev izvršavamo u najkraćem roku, bez rasprave i bez traženja obrazloženja. Uz svaku trku prikazujemo samo činjenice i nigde ne tvrdimo da smo organizator, partner ili mesto prijave.', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 11, '11. Tehnički partneri', 'Portal je tehničko vlasništvo agencije Green Time Consulting iz Beograda.

Spisak mesta i država koji portal nudi pri unosu preuzet je iz baze [GeoNames](https://www.geonames.org/), koja se koristi pod licencom [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).', null),
    ((select id from static_page where slug = 'uslovi-koriscenja'), 12, '12. Odjava, brisanje, izmene i sporovi', '| Šta želite | Šta se dešava |
|---|---|
| Odjava za tekuću sezonu | Prestajete da unosite rezultate te godine, ostajete u istorijskim tabelama, članarina se ne vraća |
| Da ne produžite takmičarski status za narednu sezonu | Profil se više ne prikazuje, ime ostaje u istorijskim tabelama, podatke čuvamo pet godina |
| Brisanje podataka | Uklanjamo ime, prezime i članski broj sa svih mesta, zajedno sa rezultatima; gde ste se pominjali ostaje anonimizovan zapis |

Mere prema članu izriču se po postupku iz sekcije 7. Dok takmičarski status za sezonu nije aktiviran, član se ne pojavljuje u rang listama te sezone i profil mu se ne prikazuje. Kada ga aktivira, prikazuje se ponovo. Kada takmičarski status nije aktivan, profil se ne prikazuje; to je namerno, jer je pristup sopstvenim trkačkim podacima jedna od stvari koje članstvo donosi. Dukati i priznanja ostaju zauvek zabeleženi i vraćaju se sa vama kada produžite.

Ove uslove možemo menjati, a o svakoj bitnoj izmeni obaveštavamo vas elektronskom poštom pre nego što stupi na snagu; ako se sa izmenom ne slažete, možete prekinuti članstvo.

Primenjuje se pravo Republike Srbije. Ako živite u drugoj zemlji, to vam ne uskraćuje zaštitu koju vam daju obavezni propisi zemlje vašeg prebivališta.

Ako imate primedbu, prvo nam pišite na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).

---

Sportsko udruženje BTL
Poslednja izmena: 15.09.2026.', null),
    ((select id from static_page where slug = 'rec-predsednika'), 1, 'Reč predsednika', 'Sportsko udruženje „BTL", pod popularnim imenom Balkanska trkačka liga, godinama je okupljalo i okupljaće neke od najboljih rekreativnih i poluprofesionalnih trkača u regionu. Rangiranje takmičara zavisi od brzine za koju takmičari pređu deonicu određene dužine i vertikalnih nagiba, bilo da se radi o maratonu, krosu, ili bilo kojem drugom organizovanom pešačkom ili trkačkom događaju.

Liga je namenjena svima koji žele da iskuse draž takmičenja, ali članstvo zavisi isključivo od toga koliko je svako spreman da stavi fer-plej i brigu o svojim kolegama na prvo mesto.

Kompletan [pravilnik](/pravilnik) za tekuću sezonu stoji na portalu, a za dodatne informacije nas slobodno kontaktirajte na zvaničnu adresu [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).

**Nikola Minić**
Predsednik Udruženja', null),
    ((select id from static_page where slug = 'pravilnik'), 1, '1. Uvodne odredbe', 'Ovim pravilnikom uređuje se takmičenje Balkanske trkačke lige u sezoni 2027: šta se boduje, kako se računaju bodovi, kako su podeljene kategorije, kako se prijavljuju i proveravaju rezultati, kako se sastavljaju rang liste, šta se osvaja i šta nije dozvoljeno.

### Član 1. Ko donosi pravilnik

Opšti pravilnik lige donosi Skupština Sportskog udruženja BTL. Pravilnik se donosi za svaku sezonu i objavljuje pre njenog početka.

### Član 2. Na koga se primenjuje

Pravilnik obavezuje svakog člana lige u sezoni 2027. Učlanjenjem potvrđujete da ste ga pročitali i da ga prihvatate u celini.

### Član 3. Odnos prema ostalim dokumentima

Na članstvo i rad Udruženja primenjuje se Statut Sportskog udruženja BTL. U slučaju nesaglasnosti Statuta i drugih akata Udruženja, primenjuje se Statut.

Uz pravilnik važe uslovi korišćenja i politika privatnosti portala.

- Pravilnik uređuje isključivo takmičenje.
- Uslovi korišćenja uređuju odnos između vas i udruženja: nalog, članarinu i obaveze pri korišćenju portala.
- Ako se pravilnik i uslovi korišćenja razilaze u nečemu što se tiče takmičenja, važi pravilnik.

### Član 4. Merodavna verzija

Pravilnik se objavljuje na srpskom jeziku, latinicom. Prevod na engleski, ili bilo koji treći jezik, je informativan, a u slučaju razlike merodavna je srpska verzija.

### Član 5. Trajanje i stupanje na snagu

Pravilnik važi za sezonu 2027, koja traje od 1. januara do 31. decembra 2027. godine.

Pravilnik je donet 17. avgusta 2026. godine i stupa na snagu 15. septembra 2026. godine.', null),
    ((select id from static_page where slug = 'pravilnik'), 2, '2. Sezona i rokovi', '### Član 6. Trajanje sezone

Sezona traje od 1. januara u 00:00 do 31. decembra u 24:00 po srednjoevropskom vremenu (CET). Da bi ušla u bodovanje, trka mora početi unutar tog razdoblja.

### Član 7. Zatvaranje sezone

Sezona se zatvara u tri koraka, sve po CET:

| Trenutak | Šta se dešava |
|---|---|
| 31. decembar, 24:00 | Kraj sezone. Trka koja počne posle ovog trenutka pripada narednoj sezoni |
| 1. januar, 10:00 | Poslednji rok da prijavite sve zaostale rezultate prethodne sezone |
| 1. januar, 16:00 | Tabele se zamrzavaju i taj snimak postaje zvanični rezultat sezone |

### Član 8. Posle zamrzavanja

Zamrznuti snimak tabela čuva se kao zvanični rezultat sezone i više se ne menja.

Rezultate sa te sezone i posle zamrzavanja smete unositi, da bi vaš profil bio potpun, ali oni ne ulaze ni u jednu tabelu, rang listu ni priznanje.

### Član 9. Rokovi za promene tima i trkačkog para

Sve promene tima i trkačkog para moraju biti završene do 31. decembra, da bi važile u narednoj sezoni. Detalji su u sekciji 12.', null),
    ((select id from static_page where slug = 'pravilnik'), 3, '3. Ko se takmiči', '### Član 10. Član lige

Član lige je takmičar koji je primljen u članstvo Udruženja i kome je aktiviran takmičarski status za sezonu. Status se aktivira po evidentiranoj uplati članarine ili po odluci Upravnog odbora kojom je član oslobođen plaćanja članarine. Aktivacijom dobijate članski broj oblika `000001`, šestocifren i jedinstven, istog formata za oba pola. Broj ostaje isti kroz sve sezone i prikazuje se javno pored vašeg imena.

Dok takmičarski status nije aktivan, nalog postoji, ali takmičar nije vidljiv na portalu i ne može da prijavljuje rezultate.

### Član 11. Pravo rangiranja

Pravo rangiranja u sezoni 2027. ima član čiji je takmičarski status aktiviran za tu sezonu, po uplati izvršenoj zaključno sa 31. decembrom 2026. godine ili po odluci Upravnog odbora o oslobađanju od članarine donetoj do istog dana. Rok se meri po danu uplate, a ne po danu kada je liga uplatu evidentirala.

Ko se učlani tokom sezone, dakle od 1. januara 2027, dobija profil, unosi svoje rezultate i prati sopstvenu statistiku, ali ne konkuriše za mesta i ne pojavljuje se u rang listama ni u kategoriji za tu sezonu.

### Član 12. Uzrast

Donja granica uzrasta za članstvo ne postoji.

Za člana mlađeg od 14 godina potrebna je prethodna saglasnost roditelja ili staratelja. Za članove mlađe od 16 godina nalog na portalu održava roditelj ili staratelj. Ko ima 14 ili 15 godina sam prihvata članstvo, a nalog mu i dalje održava roditelj ili staratelj.

Obe granice se mere na dan popunjavanja prijave, a ne kroz sezonu.

### Član 13. Odgovornost i zdravstvena sposobnost

Balkanska trkačka liga po pravilu ne organizuje trke: ne postavlja staze, ne meri vreme i ne prima prijave, nego vodi rangiranje na osnovu rezultata koje su izmerili organizatori. Izuzetak su sopstvena takmičenja lige iz sekcije 13, pre svega Round ''n'' Around ultramaraton i BTL dezorijentiring, koja liga organizuje sama.

Za sve na trci, uključujući stazu i njenu bezbednost, odgovoran je organizator tog događaja. Za sopstveno zdravlje i za procenu da li ste za neku trku spremni odgovarate sami, i to potvrđujete izjavom o zdravstvenoj sposobnosti pri registraciji.', null),
    ((select id from static_page where slug = 'pravilnik'), 4, '4. Članarina', '### Član 14. Cena i rokovi

Visinu članarine i rokove plaćanja utvrđuje Upravni odbor posebnom odlukom.

[[gallery]]

Članarina se plaća za celu sezonu, a cena zavisi od datuma uplate.

Uz uplatu u evrima naplaćuje se taksa za obradu plaćanja od 3 EUR. To nije deo članarine nego trošak obrade uplate kod platnog posrednika, i ne donosi nikakvo pravo iz Člana 17. Uplata u dinarima tu taksu nema.

Cenovnik se ponavlja svake godine: od 1. oktobra se prodaje naredna sezona, a od 1. januara do 30. septembra tekuća, bez prava na rangiranje.

Juniorska cena se meri kroz celu sezonu, ne na jedan dan. Ko u sezoni za koju se prijavljuje bar jedan dan ima 14 godina ili manje, plaća juniorsku cenu. Onaj ko puni 15 u toku te sezone, još plaća juniorsku.

Uplate se primaju od 1. oktobra 2026.

### Član 15. Dinarska cena i oslobađanje od članarine

Dinarska cena je fiksirana za celu sezonu i ne menja se sa kursom. Član sa adresom u Srbiji plaća dinarski iznos, član iz inostranstva iznos u evrima, uz koji ide i taksa za obradu plaćanja iz Člana 14, kao odvojena stavka a ne kao veća članarina.

Upravni odbor sme odlukom da redovnog člana oslobodi plaćanja članarine. Član oslobođen članarine ima ista prava kao svaki drugi: aktiviran takmičarski status, članski broj i pravo rangiranja pod uslovima iz Člana 11. Da li neko ima takmičarski status u nekoj sezoni meri se aktiviranim statusom na portalu. Do kada se plaća da bi se steklo pravo rangiranja govori Član 11.

### Član 16. Povraćaj

Uplaćena članarina se ne vraća, ni pri odjavi, ni pri prestanku članstva, ni pri diskvalifikaciji.

### Član 17. Šta članstvo donosi

- Majicu sezone i finišersku medalju, koje stižu zajedno poštom čim skupite 12 BTL bodova u sezoni,
- Pravo na sve funkcije portala,
- Pravo učešća na pratećim takmičenjima i okupljanjima lige,
- Pravo rangiranja pod uslovima iz Člana 11,
- Virtuelni balans iz programa preporuke, koji se nikada ne isplaćuje u novcu.', 'prices'),
    ((select id from static_page where slug = 'pravilnik'), 5, '5. Šta se boduje', '### Član 18. Trke koje ulaze u bodovanje

Boduju se:

- Trke na putu,
- Trail trke,
- Trke na stadionu,
- Trke sa preprekama,
- Trke uz stepenište,
- Planinarski i treking pohodi na kojima je vreme zvanično mereno.

Boduju se trke bilo gde na svetu, bez ograničenja na region.

### Član 19. Šta se ne boduje

- Trkački segment triatlona i duatlona.
- Treninzi. Trening se na portalu ne unosi, ni javno ni nezvanično.
- Periodične i ligaške trening trke.
- Planinarske akcije bez zvaničnog merenja vremena.

### Član 20. Štafete

Štafete ulaze u obračun. Boduje se sopstveni istrčani segment, a zapis nosi naziv trke i oznaku štafete, na primer „Beogradski maraton, štafeta 1", sa dužinom, nagibom i vremenom vaše deonice.

### Član 21. Virtuelne trke

Virtuelna trka se boduje ako je liga verifikuje, po istim uslovima kao svaka druga trka.

### Član 22. Više trka na istom događaju

Jedan događaj ima jednu ili više trka. Sa istog događaja smete imati više rezultata, ali ne dva rezultata sa iste trke.

### Član 23. Nezavršena trka

Odustajanje ne postoji kao zapis. Ako trka nije završena, rezultata nema, i to se nigde ne evidentira, ni na vašem profilu ni u tabelama. Isto važi za nedolazak.

Ako ste tokom trke prešli na drugu trku istog događaja, rezultat priznajemo samo ako se nalazite u zvaničnim rezultatima te trke i / ili organizator to potvrdi.

### Član 24. Uslovi na trci

Vremenske prilike, temperatura, podloga i slični uslovi se ne prate i ne utiču na bodove.

### Član 25. Zvaničan događaj

Događaj je zvaničan ako ispunjava sva tri uslova:

1. Raspis je objavljen blagovremeno, najkasnije mesec dana pre dana održavanja.
2. Zvanični rezultati su objavljeni posle događaja.
3. Na događaju je učestvovalo najmanje 50 učesnika.

Liga zadržava diskreciono pravo da prizna i događaj koji ne ispunjava neki od ova tri uslova.', null),
    ((select id from static_page where slug = 'pravilnik'), 6, '6. Kako se računaju bodovi', '### Član 26. Bodovanje

Bodove za jednu trku računa portal, iz četiri podatka: dužine trke, ukupnog uspona, ukupnog spusta i vremena prelaska.

Duža i teža staza nosi više bodova, brže vreme nosi više bodova, a uspon se u obračunu vrednuje više od spusta, jer je i teži. Kalkulator na naslovnoj strani računa bodove za bilo koju kombinaciju dužine, uspona, spusta i vremena.

### Član 27. Prikaz i zaokruživanje

Bodovi se prikazuju na dve decimale. Zaokružuje se samo prikaz; u obračunu učestvuje puna vrednost.

### Član 28. Vreme

- U obračun ulazi neto vreme, kada trka objavljuje i bruto i neto vreme.
- Vreme se unosi u obliku `hh:mm:ss`, bez desetinki.

### Član 29. Uspon i spust

Izvor podatka o usponu i spustu, po redosledu prednosti:

1. Ono što objavi organizator,
2. Provera iz javno dostupnih izvora.

Dok podatak ne postoji, uspon i spust stoje na nuli. Trka bez podatka o nagibu se boduje, sa vrednostima `0/0`. Kod neslaganja deklarisane dužine i onoga što je izmerio sat, prednost ima podatak organizatora.

### Član 30. Granice bodovanja

- Gornje granice bodova po jednoj trci nema.
- Negativnih bodova nema.
- Bodovi su izračunata vrednost. Ne dodeljuju se, niti ispravljaju ručno.', null),
    ((select id from static_page where slug = 'pravilnik'), 7, '7. Kategorije po dužini trke', '### Član 31. Pet kategorija

Svaka trka svrstava se u jednu od pet kategorija po dužini:

| Kategorija | Dužina |
|---|---|
| Kraće trke | ispod 21,1 km |
| Polumaraton | 21,1 km |
| Duže trke | preko 21,1 km, ispod 42,2 km |
| Maraton | 42,2 km |
| Ultramaraton | preko 42,2 km |

Ovih pet kategorija istovremeno su i osnova za priznanja po broju trka iz sekcije 14.

### Član 32. Bez tolerancije

Svrstavanje ide po tačno unetoj dužini, bez ikakve tolerancije. Maraton je trka uneta kao `42.2`, polumaraton je trka uneta kao `21.1`. Svaka druga vrednost pada u jednu od preostale tri kategorije.

Zato je unos `42.2` i `21.1` obavezna konvencija za te dve distance.', null),
    ((select id from static_page where slug = 'pravilnik'), 8, '8. Takmičarske kategorije', '### Član 33. Podela po polu

Takmiči se u muškoj i ženskoj konkurenciji, i to je jedina podela po polu. Zbirne liste oba pola nema.

### Član 34. Uzrasne kategorije

| Oznaka | Uzrast |
|---|---|
| `24-` | do 24 godine |
| `25-39` | 25 do 39 godina |
| `40-54` | 40 do 54 godine |
| `55+` | 55 godina i više |

### Član 35. Prelazak u stariju kategoriju

Kategorija se određuje po godinama koje punite u toj kalendarskoj godini, i važi od 1. januara te godine. Prelazak na dan rođendana više ne postoji; to je izmena u odnosu na ranije pravilnike.

Kategorija se ne menja tokom sezone. Svi bodovi u sezoni idu u kategoriju dodeljenu na početku godine.

Datum rođenja se ne proverava dokumentom. Unosite ga sami i za njegovu tačnost odgovarate sami.

### Član 36. Početnička kategorija

Ko je nov u ligi takmiči se u početničkoj kategoriji, koja se zove `Početnici` za muškarce i `Početnice` za žene. Naziv opisuje vreme provedeno u ligi, a ne sposobnost.

- Iz početničke kategorije izlazi se kada se jedna zvanična sezona, počev od sezone 2027, završi sa 12 i više BTL bodova, a promena stupa na snagu od naredne sezone. Kategorija se ne menja usred sezone, kao ni uzrasna.
- Izlazak je trajan i nepovratan.
- Početnik ne konkuriše u uzrasnoj kategoriji. Ima sopstvenu rang listu i sopstvene nagrade.
- Nastupa u dve kategorije istovremeno nema. Član je u sezoni ili u početničkoj kategoriji ili u svojoj uzrasnoj kategoriji.', null),
    ((select id from static_page where slug = 'pravilnik'), 9, '9. Prijava rezultata', '### Član 37. Ko prijavljuje i šta

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

Rezultat sa trke koja je u kalendaru prijavljujete i sa strane samog događaja, dugmetom „Unesi rezultat" u redu te trke. Trka je time već poznata, pa portal preuzima sa nje ono što ta trka zadaje, a vi unosite ostalo, uz link ka zvaničnim rezultatima i po želji sliku i komentar, sa istim pravilom obaveznosti kao sa profila.

Na formi sa profila portal vam pomaže da nađete istu trku: kad počnete da kucate naziv trke, posle dva slova nudi trke iz kalendara, od poslednje ka ranijim. Ako izaberete jednu, portal popunjava i zaključava ono što ta trka zadaje. Izmenite li naziv posle toga, veza se prekida, ta polja se prazne i unosite ih sami.

Administracija sme i sama da dođe do zvaničnih rezultata i unese ih takmičarima.

### Član 38. Rok

Rezultat se prijavljuje u roku od dva dana od dana trke.

Kasnija prijava se i dalje unosi i boduje, ali kršenje ovog roka je kršenje pravilnika i može dovesti do mera iz sekcije 16.

### Član 39. Dokazi

- Link ka zvaničnim rezultatima je dokaz koji tražimo i sam po sebi je dovoljan. Obavezan je na obe prijave, i sa profila i sa strane događaja.
- Slika je drugi dokaz i sme da stane umesto linka, ali nikad sama: uz nju je komentar obavezan i u njemu se kaže šta se na slici vidi. Slika bez reči ne dokazuje ništa.
- Svaku priloženu sliku brišemo sa portala odmah posle verifikacije, bez obzira na to da li ste je priložili sami ili na naš zahtev.

### Član 40. Trka koje nema u kalendaru

Ako trke nema u kalendaru portala, svejedno je prijavite. Administracija će uz vaš rezultat kreirati i događaj i trku.

### Član 41. Dužina i nagib

Dužinu, uspon i spust unosite ručno, osim kada ih portal uzme sa same trke, što se dešava kada ih ta trka zadaje: pri prijavi sa strane događaja, i kada na profilu izaberete trku iz ponuđenog spiska (Član 37). Portal ne prima zapis staze u obliku GPX, FIT ili TCX i ne izvodi te vrednosti iz njega.

Ako se vaše merenje razlikuje od onoga što je objavio organizator, prednost ima podatak organizatora (Član 29).

### Član 42. Objava

Verifikovan rezultat objavljuje se i ulazi u tabele u roku od 48 časova od prijave.', null),
    ((select id from static_page where slug = 'pravilnik'), 10, '10. Verifikacija rezultata', '### Član 43. Rezultat ulazi tek posle odobrenja

Nijedan rezultat ne ulazi u rang liste dok ga liga ne odobri. Neverifikovan rezultat se nigde javno ne prikazuje.

### Član 44. Ispravke

Administracija sme da ispravi činjenične podatke rezultata pri verifikaciji: naziv događaja, naziv trke, vrstu trke i vreme. Takmičar koji smatra da je ispravka greška obraća se ligi.', null),
    ((select id from static_page where slug = 'pravilnik'), 11, '11. Rang liste i plasman', '### Član 45. Koje liste postoje

Postoje muška i ženska lista. Zbirne liste oba pola nema.

Za svaku konkurenciju vode se:

- Generalni plasman sezone,
- Tabela po uzrasnoj kategoriji, uključujući početničku.

Top liste, poredak timova i poredak trkačkih parova su zbirni i ne dele se po polu.

### Član 46. Kako se računa generalni plasman

Generalni plasman računa se iz svih trka u sezoni, a ne iz najboljeg izabranog broja rezultata. Svaka bodovana trka ulazi u zbir.

### Član 47. Osvežavanje

Tabele se osvežavaju odmah posle svakog verifikovanog rezultata. Periodičnog obračuna nema.

### Član 48. Top liste

Vode se sledeće Top liste, svaka na deset mesta:

- Najviše kilometara,
- Najduže na stazi,
- Najbolja trka, dakle pojedinačni rezultat sa najviše bodova,
- Najbolji napredak,
- Najbolji tim,
- Najbolji trkački par,
- Najviše ultramaratona, maratona, dužih trka, polumaratona i kraćih trka.

Najbolji napredak meri prirast bodova u odnosu na prethodnu sezonu: razliku između zbira bodova ove i zbira bodova prethodne sezone. Na listi je samo onaj ko je trčao i prethodne sezone, jer prva sezona nema na šta da naraste, i samo onaj čiji je prirast pozitivan, jer nazadovanje nije napredak.

Liste smeju da budu kraće od deset mesta.

### Član 49. Izjednačenje

Načelo je jedno: nagrađuje se veći obim, nikad efikasnost. Manji broj trka se ne nagrađuje ni u jednom poretku. Efikasnost nikad ne obara obim, ali sme da razreši potpuno izjednačenje.

Redosled merila, dok se izjednačenje ne razreši:

| Lista | Merila, redom |
|---|---|
| Generalni plasman | bodovi, pa kilometri, pa više trka, pa više vertikale, pa niži članski broj |
| Najviše kilometara | kilometri, pa bodovi, pa više trka, pa vertikala, pa ranije dostignuto, pa niži članski broj |
| Najduže na stazi | vreme, pa bodovi, pa kilometri, pa više trka, pa vertikala, pa niži članski broj |
| Najbolja trka | bodovi na toj trci, pa veća dužina trke, pa bodovi u sezoni, pa kilometri u sezoni, pa niži članski broj |
| Najbolji tim | bodovi, pa više trka, pa kilometri, pa vreme na stazi, pa stalan redosled timova |
| Najbolji trkački par | bodovi sa zajedničkih trka, pa više zajedničkih trka, pa zajednički kilometri, pa zajedničko vreme na stazi, pa niži zbir članskih brojeva |
| Po broju trka po tipu | broj trka, pa bodovi iz baš tih trka, pa kilometri iz tih trka, pa vertikala iz tih trka, pa ranije dostignuto, pa niži članski broj |

Kod najbolje trke raniji datum se namerno ne koristi kao merilo, jer je u najčešćem slučaju izjednačenja reč o istoj trci istog dana.

### Član 50. Deljenog mesta nema

Kada ni posle svih merila nema razlike:

1. Mesta idu 1, 2, 3 i nijedno se ne preskače. Deljenog mesta nema.
2. Poslednje merilo je članski broj, rastuće: niži ide napred. Kod timova to je stalan redosled koji liga vodi, jer tim nema članski broj; on ne znači ništa i postoji samo zato da tabela ne bi skakala pri svakom preračunu.
3. Nagrada se ne duplira. Jedno mesto, jedan takmičar, jedan pehar.

### Član 51. Arhiva

Zvanični rezultat svake sezone čuva se trajno, na strani sa arhivom sezona. Pregled kroz celu istoriju lige stoji u kući slavnih.', null),
    ((select id from static_page where slug = 'pravilnik'), 12, '12. Timovi, trkački parovi i klubovi', '### Član 52. Tim i klub nisu isto

- Tim je grupa slobodnog naziva koja okuplja članove koji hoće da se takmiče zajedno. Tim je jedini entitet koji ima poredak.
- Klub je organizacija za koju nastupate u stvarnom životu. Na portalu je neobavezan podatak na profilu, bez poretka i bez prava.

### Član 53. Osnivanje tima

Tim registruje bilo koji član i time postaje administrator tog tima. Naziv tima je slobodan tekst, ne sme biti već zauzet, i svaki novi tim odobrava liga pre nego što postane vidljiv.

Administrator tima odobrava zahteve za učlanjenje i šalje pozive. Učlanjenje ide u oba smera: takmičar šalje zahtev, ili administrator tima šalje poziv.

Član sme da bude u samo jednom timu istovremeno.

### Član 54. Poredak timova

Poredak timova je čist zbir bodova svih članova tima, bez normalizacije po broju članova. Svaki bod i svaki dodatni član donose timu prednost, i to je namerno.

### Član 55. Trkački par

- Trkački par se formira obostranom potvrdom: jedna strana šalje zahtev, druga ga prihvata.
- Trkački par mora biti mešovit, jedan muškarac i jedna žena.
- Poredak trkačkih parova računa se iz bodova osvojenih na zajedničkim trkama.
- „Zajednička trka" znači ista trka, ne samo isti događaj. Ako on trči maraton a ona polumaraton na istoj manifestaciji, to nije zajednička trka.

### Član 56. Promene tima i trkačkog para

Promena tima ili trkačkog para sme se zatražiti bilo kada tokom godine, ali stupa na snagu tek 1. januara naredne sezone, i to samo ako je članstvo aktivno za tu sezonu.

Postoji jedan izuzetak, i skup je. Član sme da izađe iz tima odmah, ne čekajući novu sezonu, ali tada:

- brišu se svi njegovi rezultati iz timskog obračuna u toj sezoni, i
- naredne tri godine ne sme se priključiti nijednom timu.

Portal mu obe mogućnosti kaže pre nego što potvrdi, i traži potvrdu baš za ovu.

Sve promene moraju biti završene do 31. decembra. Član na koga promena utiče obaveštava se odmah po nastanku promene, a ne na početku sezone.', null),
    ((select id from static_page where slug = 'pravilnik'), 13, '13. Prateća takmičenja i lige', '### Član 57. Liga kao pojam

Pored glavnog takmičenja postoje i Lige, zasebna takmičenja sa sopstvenim spiskom događaja koji tokom godine ulaze u njih. Spisak događaja sme da se menja tokom godine.

- Svaka Liga boduje se istim BTL bodovima. Posebnog sistema bodovanja nema.
- Svi članovi su u Ligi automatski, bez prijave.
- Svaka Liga ima svoju stranu i tabelu.

Šta se u pojedinoj Ligi osvaja određuje njen organizator i to nije predmet ovog pravilnika.

### Član 58. BTL Round ''n'' Around

Ultramaraton u obliku slobodne trke: prati se ukupna kilometraža i ukupno vreme. Posebnog prikaza za višestruke polumaratone i maratone nema.

Trka može trajati nekoliko minuta ili nekoliko dana, a broj BTL bodova koji se na njoj skupi nije ničim ograničen. Daje sjajnu šansu svima da izvuku iz sebe svoj realan maksimum, i pobednik možda neće biti onaj ko pretrči najviše ili bude najbrži.

Detalji će biti objavljeni na raspisu samog događaja u BTL kalendaru.

### Član 59. BTL dezorijentiring

Nije cilj stići prvi, cilj je tokom sat vremena sakupiti što više BTL bodova. Detalji će biti objavljeni na raspisu samog događaja u BTL kalendaru.

### Član 60. BTL sreda

Redovna trening okupljanja članova lige. Ne boduju se i ne ulaze ni u jednu tabelu.', null),
    ((select id from static_page where slug = 'pravilnik'), 14, '14. Nagrade i priznanja', '### Član 61. Šta se osvaja

| Priznanje | Kome pripada |
|---|---|
| Pehar | pobedniku u timskom plasmanu; najboljem trkačkom paru; prva tri mesta u generalnom plasmanu, muški i ženski; prva tri mesta u svakoj kategoriji, uključujući početničku. Pehari u jednoj kategoriji se ne uručuju ako u toj kategoriji te sezone ima manje od tri člana sa 12 i više BTL bodova |
| Učesnička medalja | svakom članu sa 12 i više BTL bodova u sezoni. Šalje se poštom, zajedno sa majicom sezone, čim se prag pređe |
| Nagradna figura | posebna priznanja iz Člana 62, osim najboljeg tima i trkačkog para godine, koji dobijaju pehar |
| Onlajn diploma | svakom članu po zamrzavanju tabela, sa statistikom sezone |

Priznanje za koje se nije trkalo nije priznanje.

### Član 62. Posebna priznanja

- Najviše kilometara,
- Najduže na stazi,
- Najbolja trka,
- Najbolji napredak,
- Trkački par godine,
- Najbolji tim,
- Najviše ultramaratona, maratona, dužih trka, polumaratona i kraćih trka.

### Član 63. Dodela

Digitalne nagrade i diplome dodeljuju se automatski, u trenutku zamrzavanja tabela, svima istovremeno i bez obzira na to gde ko živi.

Pehari se uručuju na ceremoniji spojenoj sa BTL dezorijentiringom.

### Član 64. Preuzimanje fizičkih nagrada

Pehari se preuzimaju lično, po prethodnom dogovoru sa Udruženjem, u roku od mesec dana od obaveštenja o preuzimanju. Poštom se šalju samo majica sezone i finišerska medalja, i to zajedno, čim član skupi 12 BTL bodova. Poštanske troškove snosi Član.

Rok postoji da se preuzimanje ne razvlači u nedogled, a ne da bi neko ostao bez nagrade. Ličnu predaju uvek možete dogovoriti, i kasnije.

### Član 65. Sponzorske nagrade

Sponzorske nagrade će biti ažurirane uoči i tokom sezone, kako budu obezbeđivane.', null),
    ((select id from static_page where slug = 'pravilnik'), 15, '15. Etički kodeks', '### Član 66. Osnovno pravilo

Od svakog člana očekuje se fer plej i uvažavanje svih učesnika, bez obzira na pol, etničko poreklo, rasu, veru ili seksualnu orijentaciju. To važi na trci, na okupljanjima lige, na portalu i u porukama među članovima.

### Član 67. Šta nije dozvoljeno

- Prijava rezultata koji niste istrčali, ili sa netačnim podacima,
- Prijava trke koja ne ispunjava uslove iz Člana 25,
- Svako namerno zaobilaženje pravila bodovanja ili verifikacije,
- Vređanje, pretnje i uznemiravanje drugih članova,
- Otvaranje izmišljenih naloga, uključujući i one otvorene radi programa preporuke,
- Postavljanje sadržaja na koji nemate pravo.

### Član 68. Šta se od člana očekuje

Da rezultate prijavljuje uredno i u roku, da podatke o trci unosi onako kako ih je objavio organizator, i da grešku u sopstvenom rezultatu prijavi sam čim je primeti.', null),
    ((select id from static_page where slug = 'pravilnik'), 16, '16. Sankcije i diskvalifikacija', '### Član 69. Mere

Za kršenje pravilnika članu se može izreći:

1. opomena;
2. diskvalifikacija iz tekuće sezone;
3. isključenje iz Udruženja za najteže ili ponovljene prekršaje, u slučajevima dozvoljenim Statutom.

Meru bira Upravni odbor srazmerno težini povrede, posledicama, ponavljanju i nameri.

### Član 70. Šta diskvalifikacija znači

- Brišu se svi rezultati i profil takmičara. Rezultati se ne skrivaju iz tabela, nego nestaju.
- Gde god se ime pominjalo ostaje anonimizovan zapis. Oznake „arhiviran takmičar" nema, jer takvo stanje ne postoji.
- Članarina se ne vraća.

### Član 71. Postupak

1. Upravni odbor člana pisano upoznaje sa navodima i omogućava mu da se izjasni.
2. Rok za izjašnjenje, odnosno za otklanjanje propusta kada je to primenljivo, je najviše 30 dana.
3. Odluku u prvom stepenu donosi Upravni odbor. Odluka je pisana i obrazložena i uručuje se članu.
4. Protiv odluke član može podneti žalbu Skupštini u roku od 15 dana od uručenja. Skupština odlučuje o žalbi.

### Član 72. Lakša kršenja

Prijava rezultata posle roka iz Člana 38. je kršenje pravilnika i sama po sebi može pokrenuti postupak iz Člana 71. Rezultat se pri tome i dalje unosi i boduje.

O disciplinskoj meri u prvom stepenu odlučuje Upravni odbor. Protiv odluke član može podneti žalbu Skupštini u roku od 15 dana od uručenja.', null),
    ((select id from static_page where slug = 'pravilnik'), 17, '17. Objavljivanje podataka i fotografije', '### Član 73. Šta je javno

Liga je javno takmičenje, pa su javni:

- Ime i prezime, članski broj i kategorija,
- Mesto i zemlja,
- Profilna fotografija,
- Svi verifikovani rezultati sa dužinom, usponom, spustom, vremenom i datumom,
- Bodovi, plasman, statistika, dukati i priznanja,
- Tim, trkački par i klub.

### Član 74. Šta nikada nije javno

Datum rođenja se nikada ne prikazuje, ni u punom ni u skraćenom obliku. Javna je samo kategorija koja iz njega proizlazi. Isto važi za adresu elektronske pošte, adresu, sve u vezi sa članarinom i privatne poruke.

### Član 75. Fotografije

Saglasnost za objavu fotografija sa okupljanja i takmičenja lige dajete unapred, prihvatanjem ovog pravilnika. Objavljuju se fotografije koje napravi osoblje lige i fotografije koje sami pošaljete i odobrite.

Galerije fotografija sa trka i označavanja ljudi na fotografijama na portalu nema.

### Član 76. Ostalo

Sve ostalo o vašim podacima uređuje [politika privatnosti](/politika-privatnosti) portala, koja je uz ovaj pravilnik i [uslove korišćenja](/uslovi-koriscenja) treći obavezan dokument.', null),
    ((select id from static_page where slug = 'pravilnik'), 18, '18. Dukati', 'Dukat je zapis o onome što ste istrčali, u obliku novčića.

Ne nosi bodove i ne pomera vas u tabeli. Dodeljuje se automatski, onog trenutka kad ono što ste istrčali pređe granicu koja na njemu piše. Jedni se osvajaju svakog meseca, drugi jednom u sezoni, a treći samo jednom.

Osvojen dukat ostaje trajno. Ne skida se kad dođe slabija godina, ni kad se uslovi kasnije promene, ni kad prestanete da se takmičite, i stoji na profilu kao zapis o onome što je istrčano.

Nisu svi jednake težine, i to se na njima vidi: od bronzanih, koje mnogi osvoje već u prvoj sezoni, preko srebrnih, do zlatnih, koji se skupljaju godinama.

[[gallery]]', 'ducats'),
    ((select id from static_page where slug = 'pravilnik'), 19, '19. Izmene pravilnika i završne odredbe', '### Član 77. Nova verzija svake sezone

Pravilnik se piše iznova za svaku sezonu i objavljuje se pre početka te sezone. Verzija koja je važila u jednoj sezoni ostaje objavljena, jer je zvanični rezultat te sezone donet po njoj.

U toku sezone se ne menja, osim člana 65 koji objavljuje specifikaciju stečenog sponzorstva.

### Član 78. Tumačenje

Pravilnik tumači i primenjuje udruženje. Slučaj koji pravilnikom nije pokriven rešava se u duhu njegovih načela, a rešenje se upisuje u narednu verziju pravilnika, da se isto pitanje ne bi rešavalo dvaput različito.

---

Sportsko udruženje BTL
Poslednja izmena: 15.09.2026.', null);
