/* THE PICTURE LEAVES WHAT YOU ENTER WHEN YOU JOIN, BECAUSE IT WAS NEVER WRITTEN THERE.
 *
 * Found ahead of the privacy policy's public launch on 30.09.2026: politika-privatnosti,
 * section 2 ("2. Koje podatke obrađujemo, zašto i po kom osnovu"), table "Podaci koje
 * unosite pri učlanjenju" ("Data you enter when you join"), names "Profilna fotografija".
 * Measured against RegistrationApi rather than assumed: the class names "photo" in its own
 * NOT_COLLECTED_YET constant, POST /api/registration declares no `consumes` and no method or
 * field of the class carries a MultipartFile or a @RequestPart (grep for both over this one
 * file finds them only inside the class's own doc comment, never in code), and the `insert
 * into competitor` statement the route runs does not name `photo_id` among its twenty
 * columns - checked by reading that statement, not inferred from the doc comment beside it.
 * `photo_id` is nullable (V8), so the row this route writes is legitimate without one and
 * stays that way through registration. The row was never true of what this route persists.
 *
 * WHERE THE PICTURE ACTUALLY ARRIVES. POST /api/me/photo (MePhotoApi, consumes
 * multipart/form-data) is the only route in this backend that ever accepts a picture, called
 * by a member from their own account after the account is already open, and the picture then
 * waits for a moderator's approval like every other verification queue row. PDL.md, "Slika i
 * biografija izlaze iz registracije" (owner, 28.09.2026), moves the same fact one step
 * further: the whole profile section, picture and biography together, is coming off the
 * registration FORM too - his own words, "to će član popunjavati naknadno kad bude odobren".
 * That half of the change was its own increment (branch b159-slika-van-registracije, PR 427)
 * because it crosses WhatRegistrationAsksFor, RegistrationApi's NOT_COLLECTED_YET and
 * CompetitorWriteApi and needed a full backend gate of its own (PDL.md names the same
 * five-step chain as the reason it was a separate branch). It was open, not yet merged to
 * origin/main, when this migration was first written; it merged as 1c19c648 while this
 * branch was still being worked, checked with `gh pr view 427` rather than assumed, and
 * registracija.form.json no longer asks for a picture at all - confirmed by re-reading it
 * and profil.form.json after the merge, neither names "photo". This migration never waited
 * for it either way: the policy row was false about what the server PERSISTS regardless of
 * whether the FORM still asked, which was a fact about this migration's own moment,
 * independent of when that separate increment landed.
 *
 * WHAT DOES NOT MOVE WITH IT. The picture stays on "Izvršenje ugovora" (performance of
 * contract), not "Vaš pristanak" (your consent) like the biography row beside its new home:
 * PDL.md's own 28.09.2026 entry is explicit that the picture stays in
 * WhatRegistrationAsksFor.OF_EVERYBODY (compulsory) while the biography stays in
 * NEVER_REQUIRED (voluntary) - "Menja se KADA se daje, ne DA LI se odobrava" (what changes is
 * WHEN it is given, not WHETHER it is required). So only the table changes; the reason, the
 * legal basis and the retention column of the row itself are the same four cells V41 left,
 * moved whole rather than rewritten, and placed immediately before the biography row rather
 * than copying its basis.
 *
 * WHY A NEW MIGRATION AND NOT AN EDIT OF V24, V26 OR V41. All three are immutable from the day
 * they merged (ADL A2), and MigrationsAreImmutableTest holds Flyway to that. V24 first wrote
 * this section; V26 rewrote it once (the cookie policy correction); V41 rewrote it again (the
 * card leaves the public pages) and is the version this migration edits - confirmed with `git
 * ls-tree origin/main -- backend/src/main/resources/db/migration`, where V41 is present, and
 * cross-checked by extracting V41's own literal string for this position and diffing it line
 * by line against frontend/src/test/mock/pages.json and frontend/src/test/writtenPages.snapshot.json
 * before writing a single line of this file: all three already agreed, byte for byte.
 *
 * ONLY THE ONE ROW MOVES. Every other row of both tables, and both other tables in the same
 * section ("Članarina", "Podaci koji nastaju samim posećivanjem"), is byte for byte what V41
 * left - produced by a script that removed exactly the "Profilna fotografija" line from the
 * first table and reinserted that same line, unchanged, immediately before the "Biografija"
 * line of the second, never by retyping the section - and the diff against V41's text shows
 * exactly that one line moving and nothing else. Total markdown table-row lines in the
 * section: 37 before this migration, 37 after.
 *
 * THE ENGLISH TRANSLATION CARRIES THE SAME MISTAKE, so it moves too, or the two languages
 * would disagree about the same fact. V43 is the only migration that has ever written a row
 * into static_page_section_translation for this section - searched every migration for
 * `insert into static_page_section_translation` and `update static_page_section_translation`
 * and only V37 (which leaves the table empty, by its own header) and V43 appear; V41 predates
 * translation and touches no translation row, by its own header. So this is an UPDATE against
 * the text V43 actually inserted: "Profile picture" moved out of "Data you enter when you
 * join" and into "Data generated while you are a member", immediately before "Biography" - the
 * same position, relative to the same neighbour, as the Serbian row. Nothing else in either
 * language's copy of this section is touched, and the English side keeps 37 markdown
 * table-row lines before and after, the same as the Serbian side.
 *
 * WHAT HOLDS THE SERBIAN COPY TOGETHER, the same pair V26 and V41 each name for the same
 * reason: frontend/src/test/mock/pages.json, which PageApiTest compares this server's Serbian
 * answer against field by field, and frontend/src/test/writtenPages.snapshot.json, which
 * writtenVerification.test.ts holds that mock file to in the other direction. Both are
 * rewritten out of this same corrected text below, not retyped a second time. The English
 * side keeps no fixture of its own: WrittenPageTranslationAppliesTest asks only that Serbian
 * and English carry the same number of markdown table rows per section body, which moving one
 * row within the same section leaves unchanged on both sides - counted above, not assumed.
 *
 * WHAT THIS DOES NOT TOUCH: registracija.form.json and RegistrationApi, which is the separate
 * increment named above; any other row of any other section of any other page; and the fact
 * that the picture is still asked for and still goes through the same approval it always did -
 * only WHEN a member gives it, and which of this policy's own tables says so. */

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
| Profilna fotografija | Prikaz na javnom profilu | Izvršenje ugovora | Sekcija 5 |
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

update static_page_section_translation
set body = $$### Data you enter when you join

| Data | Why | Legal basis | How long we keep it |
|---|---|---|---|
| First and last name | Identification, profile, tables | Performance of contract | Section 5 |
| Date of birth | Age category and applying the rules for minor members | Performance of contract | Section 5 |
| Sex | Men's and women's rankings | Performance of contract | Section 5 |
| Choice of category, rookie or age based | Placement into the rankings | Performance of contract | Section 5 |
| Place and country | Profile, map of countries visited, payment method, and citizenship in the membership records | Performance of contract and legal obligation | Section 5 |
| E-mail address | Sign-in and mandatory notifications | Performance of contract | Section 5 |
| Password | Account protection, kept only as a cryptographic hash | Performance of contract | For as long as the account exists |
| T-shirt size | Making and delivering the T-shirt | Performance of contract | Until delivery |
| Address | Sending the T-shirt and medal, and residential and mailing address in the membership records | Performance of contract and legal obligation | Section 5 |
| Father's name | Membership records the association keeps by law | Legal obligation | Section 5 |
| ID document number | Membership records the association keeps by law. It is requested from a member younger than 16 but is not mandatory, since an ID card is issued at 16. Only the administration sees it; it is not displayed anywhere and stands apart from the data the portal's screens read, in its own table with its own access rights | Legal obligation | Section 5 |
| Phone, optional | To reach you quickly about a payment, an award, or an unclear result | Your consent | Section 5 |
| Statement that you are familiar with the Rulebook and fit to compete | A condition of membership, confirmed in your application | Performance of contract | Section 5 |
| For minors: the parent's or guardian's first and last name, relationship, and the date, time, and IP address the consent was given from | A parent's consent for a member younger than 14 and for maintaining the account of a member younger than 16, and proof that it was given | Performance of contract | Section 5 |

### Data generated while you are a member

| Data | Why | Legal basis | How long we keep it |
|---|---|---|---|
| Race results and everything calculated from them: points, placing, ducats, honours | The substance of the service | Performance of contract | Section 5 |
| A photo of a watch or a screen as evidence | Checking a disputed result | Performance of contract | Deleted immediately after verification |
| Profile picture | Display on the public profile | Performance of contract | Section 5 |
| Biography, text about yourself, links to Strava and Instagram | Self-presentation, voluntary | Your consent | Section 5 |
| Ratings and comments on events | A guide for other members | Performance of contract | Section 5 |
| Team, racing pair, club | Team and pair standings | Performance of contract | Section 5 |
| Private messages between members | Arranging transport and accommodation | Performance of contract | Section 5 |
| Birthday, if you choose to publish it yourself | Birthday list | Your consent, off by default | Until you turn it off |
| Internal administration notes | Records of disputed cases | Legitimate interest | Section 5 |

### Membership fee

| Data | Why | Legal basis | How long we keep it |
|---|---|---|---|
| Amount, date, method, and status of payment | Activating membership | Performance of contract | Section 5 |
| Virtual balance and the ledger of its changes | The referral programme and paying future membership fees | Performance of contract | Section 5 |
| Proof of payment | Bookkeeping | Legal obligation | Section 5 |

### Data generated simply by visiting

| Data | Why | Legal basis | How long we keep it |
|---|---|---|---|
| Choice of light or dark theme (`btl-theme`, local storage) | So the portal opens in the theme you chose | Necessary for the service provided, since you choose it yourself | Until you delete it yourself |
| Security cookie, and a session cookie once sign-in is working | Without them, submitting a form and signing in cannot work safely | Necessary for the service provided | Until the end of the visit, or until sign-out |
| Server logs | Security and detecting abuse | Legitimate interest | 30 days |$$
where language = 'en'
  and section_id = (
    select s.id from static_page_section s join static_page p on p.id = s.page_id
    where p.slug = 'politika-privatnosti' and s.position = 2
  );
