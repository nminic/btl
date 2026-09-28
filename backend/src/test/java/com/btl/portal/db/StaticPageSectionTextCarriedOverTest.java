package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V41 DOES TO THE SIX SECTIONS THAT ALREADY CARRY TEXT, run against a real database.
 *
 * <p><b>Why this exists.</b> V41 is an UPDATE, not an INSERT: {@code static_page_section} already
 * holds every one of these rows by the time Flyway reaches it, seeded once by V24 and left alone
 * since, except for the one V26 already rewrote. Every test runs the full migration history, V41
 * included, so by the time a case can look, every row already holds V41's own text either way - a
 * correct {@code where} clause and one that matched the wrong row, or no row at all, would leave
 * the same schema behind. What this file asks is the question a green {@link PageApiTest} cannot:
 * does each of V41's own statements, run on its own against the text that stood immediately before
 * it, produce exactly the text the owner settled.
 *
 * <p><b>Six rows, not two.</b> V41 began as two statements (uslovi-koriscenja position 4,
 * politika-privatnosti position 2) removing the two homes of the card the independent review of
 * PR 410 first found. That same review found a THIRD home, politika-privatnosti position 5,
 * missed by both the guard below and the search run over the live server before this correction,
 * because the word there is "kartično", with č, searched for with the root "kartic", with a plain
 * c - the two strings never meet, and {@code doesNotContainIgnoringCase} folds case, never
 * diacritics. A fourth statement was added the same day for an unrelated reason: this migration's
 * own first statement edits uslovi-koriscenja for the first time since V24 wrote its sign-off
 * (position 12), which makes that sign-off's date false the moment V41 runs; by the 22.08.2026
 * decision that all three public documents are signed together, moving one date moves all three -
 * politika-privatnosti position 7 and pravilnik position 19 besides, the latter untouched by
 * anything else V41 does.
 *
 * <p><b>How the six halves are made.</b> Every row is set back to the text V41 found when Flyway
 * first ran it - V24's own wording for the five rows nothing else has ever touched, V26's already
 * rewritten wording for the one it did - and then THE MIGRATION ITSELF is executed, the file
 * Flyway resolved and applied, never a copy of its statements ({@link DatabaseTest#migrationSql}).
 * Everything happens inside the test's transaction and is rolled back. The shape is
 * {@link MembershipCarriedOverTest}'s, adapted for a migration whose data half is a literal
 * overwrite rather than a derivation from other rows: there is nothing to compute from unrelated
 * columns, so the fixture writes the BEFORE text by hand, and what is measured is that the AFTER
 * text is exactly what V41 says and nothing else moved.
 *
 * <p>Writing V24's wording into both politika-privatnosti rows before running V41 would have been
 * the wrong fixture for position 2 alone: it would ask V41 to run against text V26 had already
 * replaced, which is not what a real database held the moment before this migration deployed.
 * Positions 5 and 7 of the same page were never touched by V26, so V24's wording is exactly right
 * for them - checked, not assumed: every migration was searched for `update static_page_section`
 * and only V26 and V41 itself ever appear. {@code MigrationsAreImmutableTest} is the reason V26
 * cannot simply be re-run to reach that state instead - a migration that has merged is never
 * re-run to prove a later one, it is transcribed once, here, the way V26's own header already did
 * for V24.
 *
 * <p>All bodies below are transcribed out of the migration files that wrote them (V24, V26 and V41
 * itself) rather than retyped a third time, the same reason V26's own header gives for doing this
 * once already.
 */
class StaticPageSectionTextCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/** V24's own wording for "4. Registracija, uplata i aktivacija", untouched since the day it was
	 * written - searched across every migration for {@code update static_page_section} to be sure. */
	private static final String TERMS_BODY_BEFORE_V41 = """
Prijava za članstvo podnosi se prvenstveno putem portala.

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

Portal ne izdaje račun ni potvrdu o uplati. Dokaz je potvrda vaše banke ili platnog sistema, uz obaveštenje koje šaljemo kada članarinu aktiviramo.\
		""";

	/** What V41 says the owner settled on 28.09.2026: the payment methods table without "ili
	 * karticom" on either row, and the whole paragraph about card data gone. */
	private static final String TERMS_BODY_AFTER_V41 = """
Prijava za članstvo podnosi se prvenstveno putem portala.

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

Portal ne izdaje račun ni potvrdu o uplati. Dokaz je potvrda vaše banke ili platnog sistema, uz obaveštenje koje šaljemo kada članarinu aktiviramo.\
		""";

	/** V26's rewritten wording for "2. Koje podatke obrađujemo, zašto i po kom osnovu" - not V24's,
	 * which V26 already replaced (20.09.2026, the cookie policy correction). */
	private static final String PRIVACY_BODY_BEFORE_V41 = """
### Podaci koje unosite pri učlanjenju

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
| Zapisi servera | Bezbednost i otkrivanje zloupotreba | Legitimni interes | 30 dana |\
		""";

	/** What V41 says the owner settled: the sentence about never seeing or keeping card data is
	 * gone, and the "Potvrda uplate" row just above it, which is about proof of payment in general
	 * and not about the card, is untouched. */
	private static final String PRIVACY_BODY_AFTER_V41 = """
### Podaci koje unosite pri učlanjenju

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
| Zapisi servera | Bezbednost i otkrivanje zloupotreba | Legitimni interes | 30 dana |\
		""";

	/** V24's own wording for "5. Koliko čuvamo i kome prosleđujemo", untouched since the day it
	 * was written - searched across every migration for {@code update static_page_section} to be
	 * sure. */
	private static final String PRIVACY_RETENTION_BODY_BEFORE_V41 = """
| Situacija | Šta se dešava |
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

Server je u Nemačkoj, dakle u Evropskoj uniji. Za prenos van Evropske unije koristimo propisane mehanizme zaštite.\
		""";

	/** What V41 says the owner settled on 28.09.2026: the one sentence promising a future card
	 * processor is gone, and nothing else in the section moved. */
	private static final String PRIVACY_RETENTION_BODY_AFTER_V41 = """
| Situacija | Šta se dešava |
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

Server je u Nemačkoj, dakle u Evropskoj uniji. Za prenos van Evropske unije koristimo propisane mehanizme zaštite.\
		""";

	/** V24's own wording for politika-privatnosti's sign-off (position 7), untouched since the
	 * day it was written - searched across every migration for {@code update static_page_section}
	 * to be sure. */
	private static final String PRIVACY_SIGNOFF_BODY_BEFORE_V41 = """
Sav saobraćaj ide preko šifrovane veze, lozinke se čuvaju samo kao kriptografski otisak, pristup podacima ima mali broj ljudi sa tačno određenim pravima, a nalog sa najširim pravima koristi dvofaktorsku prijavu. Nijedan sistem nije potpuno bezbedan; ako dođe do povrede podataka koja može da vam naškodi, obaveštavamo vas i nadzorni organ u propisanim rokovima.

Portal automatski računa bodove, plasman i dukate, što je matematika po javno poznatim pravilima. Nijednu odluku sa pravnim posledicama po vas ne donosi automat: verifikaciju rezultata, odobravanje profila i sve mere prema članovima donosi čovek.

Politiku menjamo kada se promeni ono što radimo. Ako izmena bitno utiče na vaša prava, javljamo vam elektronskom poštom pre nego što stupi na snagu.

---

Sportsko udruženje BTL
Poslednja izmena: 15.09.2026.\
		""";

	/** What V41 says the owner settled on 28.09.2026: the sign-off date moves to 28.09.2026,
	 * together with the other two documents', and nothing else moved. */
	private static final String PRIVACY_SIGNOFF_BODY_AFTER_V41 = """
Sav saobraćaj ide preko šifrovane veze, lozinke se čuvaju samo kao kriptografski otisak, pristup podacima ima mali broj ljudi sa tačno određenim pravima, a nalog sa najširim pravima koristi dvofaktorsku prijavu. Nijedan sistem nije potpuno bezbedan; ako dođe do povrede podataka koja može da vam naškodi, obaveštavamo vas i nadzorni organ u propisanim rokovima.

Portal automatski računa bodove, plasman i dukate, što je matematika po javno poznatim pravilima. Nijednu odluku sa pravnim posledicama po vas ne donosi automat: verifikaciju rezultata, odobravanje profila i sve mere prema članovima donosi čovek.

Politiku menjamo kada se promeni ono što radimo. Ako izmena bitno utiče na vaša prava, javljamo vam elektronskom poštom pre nego što stupi na snagu.

---

Sportsko udruženje BTL
Poslednja izmena: 28.09.2026.\
		""";

	/** V24's own wording for uslovi-koriscenja's sign-off (position 12), untouched from the day
	 * it was written until this migration's own first statement above - searched across every
	 * migration for {@code update static_page_section} to be sure. */
	private static final String TERMS_SIGNOFF_BODY_BEFORE_V41 = """
| Šta želite | Šta se dešava |
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
Poslednja izmena: 15.09.2026.\
		""";

	/** What V41 says the owner settled on 28.09.2026: the sign-off date moves to 28.09.2026, and
	 * nothing else moved. */
	private static final String TERMS_SIGNOFF_BODY_AFTER_V41 = """
| Šta želite | Šta se dešava |
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
Poslednja izmena: 28.09.2026.\
		""";

	/** V24's own wording for pravilnik's sign-off (position 19), untouched since the day it was
	 * written - searched across every migration for {@code update static_page_section} to be
	 * sure. */
	private static final String RULEBOOK_SIGNOFF_BODY_BEFORE_V41 = """
### Član 77. Nova verzija svake sezone

Pravilnik se piše iznova za svaku sezonu i objavljuje se pre početka te sezone. Verzija koja je važila u jednoj sezoni ostaje objavljena, jer je zvanični rezultat te sezone donet po njoj.

U toku sezone se ne menja, osim člana 65 koji objavljuje specifikaciju stečenog sponzorstva.

### Član 78. Tumačenje

Pravilnik tumači i primenjuje udruženje. Slučaj koji pravilnikom nije pokriven rešava se u duhu njegovih načela, a rešenje se upisuje u narednu verziju pravilnika, da se isto pitanje ne bi rešavalo dvaput različito.

---

Sportsko udruženje BTL
Poslednja izmena: 15.09.2026.\
		""";

	/** What V41 says the owner settled on 28.09.2026: the sign-off date moves to 28.09.2026,
	 * together with the other two documents', though not one word of pravilnik's own text
	 * moved. */
	private static final String RULEBOOK_SIGNOFF_BODY_AFTER_V41 = """
### Član 77. Nova verzija svake sezone

Pravilnik se piše iznova za svaku sezonu i objavljuje se pre početka te sezone. Verzija koja je važila u jednoj sezoni ostaje objavljena, jer je zvanični rezultat te sezone donet po njoj.

U toku sezone se ne menja, osim člana 65 koji objavljuje specifikaciju stečenog sponzorstva.

### Član 78. Tumačenje

Pravilnik tumači i primenjuje udruženje. Slučaj koji pravilnikom nije pokriven rešava se u duhu njegovih načela, a rešenje se upisuje u narednu verziju pravilnika, da se isto pitanje ne bi rešavalo dvaput različito.

---

Sportsko udruženje BTL
Poslednja izmena: 28.09.2026.\
		""";

	/**
	 * Every row this migration touches, set back to what V41 found immediately before it ran - V24's
	 * own wording for the five it is the first to touch, V26's already-rewritten wording for the one
	 * (position 2) it touches for the second time (see the class comment).
	 */
	private void everyRowV41TouchesSetBackToWhatItFoundThere() {
		db.sql("update static_page_section set body = ?"
						+ " where page_id = (select id from static_page where slug = 'uslovi-koriscenja')"
						+ "   and position = 4")
				.param(TERMS_BODY_BEFORE_V41).update();

		db.sql("update static_page_section set body = ?"
						+ " where page_id = (select id from static_page where slug = 'politika-privatnosti')"
						+ "   and position = 2")
				.param(PRIVACY_BODY_BEFORE_V41).update();

		db.sql("update static_page_section set body = ?"
						+ " where page_id = (select id from static_page where slug = 'politika-privatnosti')"
						+ "   and position = 5")
				.param(PRIVACY_RETENTION_BODY_BEFORE_V41).update();

		db.sql("update static_page_section set body = ?"
						+ " where page_id = (select id from static_page where slug = 'politika-privatnosti')"
						+ "   and position = 7")
				.param(PRIVACY_SIGNOFF_BODY_BEFORE_V41).update();

		db.sql("update static_page_section set body = ?"
						+ " where page_id = (select id from static_page where slug = 'uslovi-koriscenja')"
						+ "   and position = 12")
				.param(TERMS_SIGNOFF_BODY_BEFORE_V41).update();

		db.sql("update static_page_section set body = ?"
						+ " where page_id = (select id from static_page where slug = 'pravilnik')"
						+ "   and position = 19")
				.param(RULEBOOK_SIGNOFF_BODY_BEFORE_V41).update();
	}

	private String bodyOf(String slug, int position) {
		return db.sql("select s.body from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " where p.slug = ? and s.position = ?")
				.params(slug, position)
				.query(String.class)
				.single();
	}

	/**
	 * THE FIXTURE ITSELF IS A REAL BEFORE STATE, not an empty table. Written first and on its own,
	 * because a fixture that already matched V41's answer would make every case below pass whether
	 * the migration ran or not.
	 */
	@Test
	void everySectionHoldsTheTextV41WasWrittenAgainstBeforeTheMigrationRuns() {
		everyRowV41TouchesSetBackToWhatItFoundThere();

		assertThat(bodyOf("uslovi-koriscenja", 4))
				.as("the fixture does not hold the text V41 was written against")
				.isEqualTo(TERMS_BODY_BEFORE_V41)
				.contains("karticom");
		assertThat(bodyOf("politika-privatnosti", 2))
				.as("the fixture does not hold the text V41 was written against")
				.isEqualTo(PRIVACY_BODY_BEFORE_V41)
				.contains("platnoj kartici");
		assertThat(bodyOf("politika-privatnosti", 5))
				.as("the fixture does not hold the text V41 was written against")
				.isEqualTo(PRIVACY_RETENTION_BODY_BEFORE_V41)
				.contains("kartično");
		assertThat(bodyOf("politika-privatnosti", 7))
				.as("the fixture does not hold the text V41 was written against")
				.isEqualTo(PRIVACY_SIGNOFF_BODY_BEFORE_V41)
				.contains("Poslednja izmena: 15.09.2026.");
		assertThat(bodyOf("uslovi-koriscenja", 12))
				.as("the fixture does not hold the text V41 was written against")
				.isEqualTo(TERMS_SIGNOFF_BODY_BEFORE_V41)
				.contains("Poslednja izmena: 15.09.2026.");
		assertThat(bodyOf("pravilnik", 19))
				.as("the fixture does not hold the text V41 was written against")
				.isEqualTo(RULEBOOK_SIGNOFF_BODY_BEFORE_V41)
				.contains("Poslednja izmena: 15.09.2026.");
	}

	/**
	 * THE PAYMENT METHODS TABLE AND ITS PARAGRAPH ABOUT THE CARD, exactly as the owner settled.
	 */
	@Test
	void thePaymentMethodsSectionIsExactlyWhatTheOwnerSettled() {
		everyRowV41TouchesSetBackToWhatItFoundThere();

		jdbc.execute(migrationSql("41"));

		assertThat(bodyOf("uslovi-koriscenja", 4))
				.as("V41 did not leave the payment methods section exactly as the owner settled it")
				.isEqualTo(TERMS_BODY_AFTER_V41)
				.doesNotContainIgnoringCase("kartic");
	}

	/**
	 * THE PRIVACY POLICY SENTENCE ABOUT CARD DATA IS GONE, and the row above it about proof of
	 * payment, which V41 must not touch, still reads the same.
	 */
	@Test
	void thePrivacyPolicySectionIsExactlyWhatTheOwnerSettled() {
		everyRowV41TouchesSetBackToWhatItFoundThere();

		jdbc.execute(migrationSql("41"));

		assertThat(bodyOf("politika-privatnosti", 2))
				.as("V41 did not leave the privacy policy section exactly as the owner settled it")
				.isEqualTo(PRIVACY_BODY_AFTER_V41)
				.doesNotContainIgnoringCase("kartic")
				.contains("Potvrda uplate | Knjigovodstvo | Pravna obaveza | Sekcija 5");
	}

	/**
	 * THE PRIVACY POLICY RETENTION SECTION NO LONGER PROMISES A CARD PROCESSOR THAT NEVER ARRIVED,
	 * exactly as the owner settled on 28.09.2026 - and the row above it, about the mail archive, and
	 * the heading below it are both untouched: the removed sentence was its own paragraph, sitting
	 * alone between them. Checked with the WIDER root, "karti", not the "kartic" that missed this very
	 * sentence the first time (see the class comment) - {@code kartic} alone would pass here even if
	 * this statement's {@code where} clause were wrong, because it would still just be testing itself.
	 */
	@Test
	void theRetentionSectionNoLongerPromisesACardProcessorThatNeverArrived() {
		everyRowV41TouchesSetBackToWhatItFoundThere();

		jdbc.execute(migrationSql("41"));

		assertThat(bodyOf("politika-privatnosti", 5))
				.as("V41 did not leave the retention section exactly as the owner settled it")
				.isEqualTo(PRIVACY_RETENTION_BODY_AFTER_V41)
				.doesNotContainIgnoringCase("karti")
				.contains("Arhiva odlaznih mejlova")
				.contains("Dva načina na koja podaci nestaju");
	}

	/**
	 * ALL THREE PUBLIC DOCUMENTS SIGN OFF ON 28.09.2026, not only uslovi-koriscenja whose own edit
	 * (position 4, above) made 15.09.2026 false: politika-privatnosti (already false for eight days,
	 * since V26) and pravilnik (never touched by anything else at all) move with it, because the
	 * 22.08.2026 decision holds all three to the same date on purpose. Nothing but the date moved in
	 * any of the three - each AFTER constant is its BEFORE constant with only that one substring
	 * replaced, so equality against it is already proof of that, and the negative check below is
	 * belt and braces on top of equality, not a replacement for it.
	 */
	@Test
	void allThreeDocumentsSignOffOnTheTwentyEighthOfSeptember() {
		everyRowV41TouchesSetBackToWhatItFoundThere();

		jdbc.execute(migrationSql("41"));

		assertThat(bodyOf("politika-privatnosti", 7))
				.as("V41 did not move politika-privatnosti's sign-off")
				.isEqualTo(PRIVACY_SIGNOFF_BODY_AFTER_V41)
				.contains("Poslednja izmena: 28.09.2026.")
				.doesNotContain("15.09.2026");
		assertThat(bodyOf("uslovi-koriscenja", 12))
				.as("V41 did not move uslovi-koriscenja's sign-off")
				.isEqualTo(TERMS_SIGNOFF_BODY_AFTER_V41)
				.contains("Poslednja izmena: 28.09.2026.")
				.doesNotContain("15.09.2026");
		assertThat(bodyOf("pravilnik", 19))
				.as("V41 did not move pravilnik's sign-off")
				.isEqualTo(RULEBOOK_SIGNOFF_BODY_AFTER_V41)
				.contains("Poslednja izmena: 28.09.2026.")
				.doesNotContain("15.09.2026");
	}

	/**
	 * NO SECTION OF EITHER PUBLIC PAGE MENTIONS THE CARD, ANYWHERE - not only the three sections the
	 * three statements above rewrite. This is the guard that should have caught the third home before
	 * the independent review of PR 410 did: politika-privatnosti position 5 said "Kad kartično
	 * plaćanje bude uvedeno..." and a search for "kartic" does not find "kartično", because that word
	 * carries č and {@code doesNotContainIgnoringCase} only folds case, never diacritics. The root
	 * below is "karti", short enough to also catch every other inflection this repository uses for the
	 * card (kartica, karticom, karticama) and, checked across every migration and both frontend
	 * fixtures for a stray hit, nothing else - it never matches the dative of "karta" ("na karti") or
	 * any other unrelated word. It runs with {@code ilike} against every section of both pages exactly
	 * as Flyway leaves them after the real migration history runs - not a fixture this test builds, so
	 * a fourth home would fail here the day it is written rather than the day someone happens to search
	 * for it.
	 */
	@Test
	void noSectionOfEitherPublicPageMentionsTheCardAnywhere() {
		List<String> stillMentionsTheCard = db.sql("select p.slug || ' position ' || s.position"
						+ " from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " where p.slug in ('uslovi-koriscenja', 'politika-privatnosti')"
						+ "   and s.body ilike '%karti%'")
				.query(String.class)
				.list();

		assertThat(stillMentionsTheCard)
				.as("every section of both public pages, not only the ones this migration itself rewrites")
				.isEmpty();
	}
}
