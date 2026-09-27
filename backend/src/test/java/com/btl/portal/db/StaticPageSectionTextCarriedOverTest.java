package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V41 DOES TO THE TWO SECTIONS THAT ALREADY CARRY TEXT, run against a real database.
 *
 * <p><b>Why this exists.</b> V41 is an UPDATE, not an INSERT: {@code static_page_section} already
 * holds both rows by the time Flyway reaches it, one seeded by V24 and left alone since, the other
 * seeded by V24 and already rewritten once by V26. Every test runs the full migration history, V41
 * included, so by the time a case can look, both rows already hold V41's own text either way - a
 * correct {@code where} clause and one that matched the wrong row, or no row at all, would leave the
 * same schema behind. What this file asks is the question a green {@link PageApiTest} cannot: does
 * V41's own statement, run on its own against the text that stood immediately before it, produce
 * exactly the text the owner settled.
 *
 * <p><b>How the two halves are made.</b> Both rows are set back to the text V41 found when Flyway
 * first ran it - V24's own wording for the section V26 never touched, V26's rewritten wording for
 * the one it did - and then THE MIGRATION ITSELF is executed, the file Flyway resolved and applied,
 * never a copy of its statements ({@link DatabaseTest#migrationSql}). Everything happens inside the
 * test's transaction and is rolled back. The shape is {@link MembershipCarriedOverTest}'s, adapted
 * for a migration whose data half is a literal overwrite rather than a derivation from other rows:
 * there is nothing to compute from unrelated columns, so the fixture writes the BEFORE text by hand,
 * and what is measured is that the AFTER text is exactly what V41 says and nothing else moved.
 *
 * <p>Writing V24's wording into BOTH rows before running V41 would have been the wrong fixture: it
 * would ask V41 to run against text V26 had already replaced, which is not what a real database held
 * the moment before this migration deployed. {@code MigrationsAreImmutableTest} is the reason V26
 * cannot simply be re-run to reach that state instead - a migration that has merged is never re-run
 * to prove a later one, it is transcribed once, here, the way V26's own header already did for V24.
 *
 * <p>All four bodies below are transcribed out of the migration files that wrote them (V24, V26 and
 * V41 itself) rather than retyped a third time, the same reason V26's own header gives for doing
 * this once already.
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

	/**
	 * Both rows set back to what V41 found immediately before it ran - not both to V24's wording,
	 * because the privacy policy row was already rewritten once by V26 (see the class comment).
	 */
	private void bothRowsAsV41FoundThem() {
		db.sql("update static_page_section set body = ?"
						+ " where page_id = (select id from static_page where slug = 'uslovi-koriscenja')"
						+ "   and position = 4")
				.param(TERMS_BODY_BEFORE_V41).update();

		db.sql("update static_page_section set body = ?"
						+ " where page_id = (select id from static_page where slug = 'politika-privatnosti')"
						+ "   and position = 2")
				.param(PRIVACY_BODY_BEFORE_V41).update();
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
	void bothSectionsHoldTheTextV41WasWrittenAgainstBeforeTheMigrationRuns() {
		bothRowsAsV41FoundThem();

		assertThat(bodyOf("uslovi-koriscenja", 4))
				.as("the fixture does not hold the text V41 was written against")
				.isEqualTo(TERMS_BODY_BEFORE_V41)
				.contains("karticom");
		assertThat(bodyOf("politika-privatnosti", 2))
				.as("the fixture does not hold the text V41 was written against")
				.isEqualTo(PRIVACY_BODY_BEFORE_V41)
				.contains("platnoj kartici");
	}

	/**
	 * THE PAYMENT METHODS TABLE AND ITS PARAGRAPH ABOUT THE CARD, exactly as the owner settled.
	 */
	@Test
	void thePaymentMethodsSectionIsExactlyWhatTheOwnerSettled() {
		bothRowsAsV41FoundThem();

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
		bothRowsAsV41FoundThem();

		jdbc.execute(migrationSql("41"));

		assertThat(bodyOf("politika-privatnosti", 2))
				.as("V41 did not leave the privacy policy section exactly as the owner settled it")
				.isEqualTo(PRIVACY_BODY_AFTER_V41)
				.doesNotContainIgnoringCase("kartic")
				.contains("Potvrda uplate | Knjigovodstvo | Pravna obaveza | Sekcija 5");
	}
}
