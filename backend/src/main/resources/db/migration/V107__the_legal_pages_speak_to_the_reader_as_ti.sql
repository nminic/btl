/* THE LEGAL PAGES SPEAK TO THE READER AS "TI" IN SERBIAN: 119 SENTENCES CHANGE FROM "VI" TO "TI" EXACTLY AS THE OWNER APPROVED THEM,
   AND THE SIGN-OFF MOVES ON THE THREE DOCUMENTS WHOSE WORDS CHANGE.

   WHOSE DECISION, AND WHERE IT IS WRITTEN. PDL, the entry „Pravni tekstovi prelaze na „ti”" (owner, 21.11.2026): „Pravni tekstovi
   prelaze na „ti”: svih 119 predloženih rečenica (Politika privatnosti, Uslovi korišćenja, Pravilnik, Reč predsednika) odobreno je
   kako je predloženo, uključujući 27 prepisanih bez roda. [...] Spisak staro i novo, doslovno: predlozi/pravni-ti-odobreno-21-11.json.
   Upis ide novom migracijom, posle merenja stvarnog teksta na produkciji, uz nov datum „Poslednja izmena”; prvo QA." The rule for
   the gender of the verb sits in the same decision record: legal texts, whose reader is not known, are rewritten so that the verb
   has no gender, and every such sentence is approved by the owner; the slash form („potvrdio/la”) was refused. The owner's
   permission to change the legal texts covers these 119 sentences and no other word (21.11.2026).

   WHAT IT SAYS. The new text of every edit below is the owner's approved text, character for character, taken out of the list and
   not retyped: the list holds 119 edits, 117 of them in the bodies of sections and 2 in the headings of two sections ("6. Vaša prava"
   of the policy, "8. Sadržaj koji postavljate" of the terms). Where the sentence is the owner's rewrite WITHOUT GENDER the list says
   so, and this file does not tell the two apart: one text goes in, whichever way it was written. Nothing in a sentence was corrected
   here; a sentence that looked wrong would be reported and not changed.

   THE ENGLISH WORDS ARE NOT TOUCHED. English has no "ti" and "Vi", and the decision speaks of the Serbian text, so the sentences
   are edited in the Serbian sections only. The English SIGN-OFF is another matter and moves with the Serbian one, see below.

   THE SIGN-OFF MOVES ON THREE DOCUMENTS, IN BOTH LANGUAGES, ON THE DAY THIS REACHES QA. PDL, "Datum Poslednja izmena na pravnom
   tekstu pomera se uvek kad se reči tog teksta promene, na dan kad izmena stiže na QA" (owner, 07.11.2026), and its addition of
   14.11.2026 (owner, chose between the offered, with the assistant's recommendation): "Datum je datum dokumenta i pomera se na oba
   jezika i kad se reči promene samo u jednom (povod: PR 723 menja samo engleski Član 36, a datum se pomera i u srpskom Pravilniku).
   Ponuđeno i neizabrano: pomera se samo datum jezika čije su se reči promenile." So the day moves in English too although no English
   word changes here: V102 did the same. The policy (V102: 16.11.2026), the terms (V95: 11.11.2026) and the rulebook (V100:
   15.11.2026) all change words in Serbian, so all three move to 21.11.2026, "Poslednja izmena" and "Last amended" alike. The
   president's word carries no sign-off and has none to move. THE DAY IS WRITTEN AS THE DAY IT IS EXPECTED: 21.11.2026 is the day
   this file is written; if it reaches QA on another day the date is moved before the merge, in this file and in every place that
   holds it, which ADL A2 allows because the file has not been applied anywhere.

   HOW. The shape of V93 to V102: every edit is asked how many times its old text stands in the text it is aimed at, and anything but
   exactly once is a problem, and a text that already carries the new words is a problem too, asked of the text with the old words
   taken out first. The edits are applied one after another, so an edit sees what the one before it wrote; all of them are asked and
   not stopped at the first problem; if there is any, one error lists every edit and what it found, the statement is rolled back with
   nothing changed, and Flyway refuses to start the backend. A replace() that matched nothing would be recorded as a migration that
   succeeded while the old text went on being published (V57 has the whole argument). The table has a field column, as V71 has, because
   two of the edits are in a heading and not in a body.

   MEASURED BEFORE IT WAS WRITTEN, on both servers, by reading only: production and QA both stood at V106 and held the same text
   (the same 105559 bytes of page text), and each of the 119 old texts stood exactly once in the Serbian sections, in the place the
   list names. The 3 sign-offs stood once each in Serbian and once each in English, on the days named above.

   WHAT IT DOES NOT TOUCH: no schema, no constraint, no key, no index, no row added or removed; no English word; no word of a legal text
   outside the 119 sentences, and no day outside the three sign-offs (each in two languages).

   WHY A NEW FILE AND NOT AN EDIT OF V93 TO V102: ADL A2. They have been applied, their checksums are in flyway_schema_history, and
   MigrationsAreImmutableTest holds Flyway to it. V107 and not another number: main stood at V106 on 21.11.2026.

   WHAT HOLDS THE HOMES OF THIS TEXT TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares the Serbian answer of
   this server to, field by field; frontend/src/test/writtenPages.snapshot.json, which writtenVerification.test.ts holds that fixture
   to in the other direction; and TheWrittenPagesSpeakToTheReaderAsTiTest and its carried-over twin, for every edit. */

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

            ('TI-001 politika-privatnosti #1 body', 'politika-privatnosti', 1, 'sr', 'body',
             $old$Vašim podacima rukuje Sportsko udruženje BTL, koje vodi Balkansku trkačku ligu i portal [balkanskatrkackaliga.net](https://balkanskatrkackaliga.net).$old$,
             $new$Tvojim podacima rukuje Sportsko udruženje BTL, koje vodi Balkansku trkačku ligu i portal [balkanskatrkackaliga.net](https://balkanskatrkackaliga.net).$new$),

            ('TI-002 politika-privatnosti #2 body', 'politika-privatnosti', 2, 'sr', 'body',
             $old$### Podaci koje unosite pri učlanjenju$old$,
             $new$### Podaci koje unosiš pri učlanjenju$new$),

            ('TI-003 politika-privatnosti #2 body', 'politika-privatnosti', 2, 'sr', 'body',
             $old$| Jezik pošte, srpski ili engleski | Da vam mejlovi stižu na jeziku koji ste izabrali; početni izbor je jezik strane na kojoj ste se učlanili | Izvršenje ugovora | Dok traje nalog |$old$,
             $new$| Jezik pošte, srpski ili engleski | Da ti mejlovi stižu na jeziku koji biraš; početni izbor je jezik strane na kojoj se učlanjuješ | Izvršenje ugovora | Dok traje nalog |$new$),

            ('TI-004 politika-privatnosti #2 body', 'politika-privatnosti', 2, 'sr', 'body',
             $old$| Broj ličnog dokumenta | Evidencija članova koju udruženje vodi po zakonu. Od člana mlađeg od 16 godina se traži, ali nije obavezan. Vidi ga samo administracija i vi, na strani Moji podaci; drugima se ne prikazuje nigde | Pravna obaveza | Sekcija 5 |$old$,
             $new$| Broj ličnog dokumenta | Evidencija članova koju udruženje vodi po zakonu. Od člana mlađeg od 16 godina se traži, ali nije obavezan. Vidi ga samo administracija i ti, na strani Moji podaci; drugima se ne prikazuje nigde | Pravna obaveza | Sekcija 5 |$new$),

            ('TI-005 politika-privatnosti #2 body', 'politika-privatnosti', 2, 'sr', 'body',
             $old$| Telefon, neobavezno | Da vas brzo dobijemo oko uplate, nagrade ili nejasnog rezultata | Vaš pristanak | Sekcija 5 |$old$,
             $new$| Telefon, neobavezno | Da te brzo dobijemo oko uplate, nagrade ili nejasnog rezultata | Tvoj pristanak | Sekcija 5 |$new$),

            ('TI-006 politika-privatnosti #2 body', 'politika-privatnosti', 2, 'sr', 'body',
             $old$| Izjava da ste upoznati sa pravilnikom i zdravstveno sposobni | Uslov za učlanjenje, potvrđujete je u prijavi | Izvršenje ugovora | Sekcija 5 |$old$,
             $new$| Izjava da poznaješ pravilnik i da ti zdravstveno stanje dozvoljava bavljenje rekreativnim sportom | Uslov za učlanjenje, potvrđuješ je u prijavi | Izvršenje ugovora | Sekcija 5 |$new$),

            ('TI-007 politika-privatnosti #2 body', 'politika-privatnosti', 2, 'sr', 'body',
             $old$### Podaci koji nastaju dok ste član$old$,
             $new$### Podaci koji nastaju dok si član$new$),

            ('TI-008 politika-privatnosti #2 body', 'politika-privatnosti', 2, 'sr', 'body',
             $old$| Profilna fotografija | Prikaz na javnom profilu | Vaš pristanak | Sekcija 5 |$old$,
             $new$| Profilna fotografija | Prikaz na javnom profilu | Tvoj pristanak | Sekcija 5 |$new$),

            ('TI-009 politika-privatnosti #2 body', 'politika-privatnosti', 2, 'sr', 'body',
             $old$| Biografija, tekst o sebi, linkovi na Stravu i Instagram | Predstavljanje, dobrovoljno | Vaš pristanak | Sekcija 5 |$old$,
             $new$| Biografija, tekst o sebi, linkovi na Stravu i Instagram | Predstavljanje, dobrovoljno | Tvoj pristanak | Sekcija 5 |$new$),

            ('TI-010 politika-privatnosti #2 body', 'politika-privatnosti', 2, 'sr', 'body',
             $old$| Datum rođenja na profilu (ceo datum ili samo godina), ako sami izaberete da ga objavite | Prikaz na vašem profilu | Vaš pristanak, podrazumevano isključeno | Dok ga ne isključite |$old$,
             $new$| Datum rođenja na profilu (ceo datum ili samo godina), ako izabereš da ga objaviš | Prikaz na tvom profilu | Tvoj pristanak, podrazumevano isključeno | Dok ga ne isključiš |$new$),

            ('TI-011 politika-privatnosti #2 body', 'politika-privatnosti', 2, 'sr', 'body',
             $old$| Izbor svetle ili tamne teme (`btl-theme`, lokalno skladište) | Da vas portal otvori u temi koju ste izabrali | Neophodno za pruženu uslugu, jer ga sami izaberete | Dok ga sami ne obrišete |$old$,
             $new$| Izbor svetle ili tamne teme (`btl-theme`, lokalno skladište) | Da te portal otvori u temi koju izabereš | Neophodno za pruženu uslugu, jer ga izabereš | Dok ga ne obrišeš |$new$),

            ('TI-012 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Liga je javno takmičenje i vaš profil je javna strana.$old$,
             $new$Liga je javno takmičenje i tvoj profil je javna strana.$new$),

            ('TI-013 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Na to pristajete učlanjenjem.$old$,
             $new$Na to pristaješ učlanjenjem.$new$),

            ('TI-014 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Ime i prezime, članski broj, uzrasna i polna kategorija, mesto i zemlja, profilna fotografija, svi verifikovani rezultati sa datumima i merama, bodovi, plasman i statistika, dukati i priznanja, tim, trkački par i klub, biografija, ocene i komentari na događaje, i linkovi koje sami dodate.$old$,
             $new$Ime i prezime, članski broj, uzrasna i polna kategorija, mesto i zemlja, profilna fotografija, svi verifikovani rezultati sa datumima i merama, bodovi, plasman i statistika, dukati i priznanja, tim, trkački par i klub, biografija, ocene i komentari na događaje, i linkovi koje dodaš.$new$),

            ('TI-015 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Kad podelite link svog profila, društvene mreže i aplikacije za poruke prikazuju njegov pregled sa vašim imenom, odobrenom slikom i brojem trka i kilometara.$old$,
             $new$Kad podeliš link svog profila, društvene mreže i aplikacije za poruke prikazuju njegov pregled sa tvojim imenom, odobrenom slikom i brojem trka i kilometara.$new$),

            ('TI-016 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Adresa elektronske pošte, adresa za slanje, sve u vezi sa članarinom i plaćanjem, stanje virtuelnog balansa, veličina majice, ime oca i broj ličnog dokumenta, osim vama, na strani Moji podaci, telefon, privatne poruke, interne beleške administracije, i sve u vezi sa roditeljskim potpisom: ime roditelja, srodstvo, datum, vreme i IP adresa.$old$,
             $new$Adresa elektronske pošte, adresa za slanje, sve u vezi sa članarinom i plaćanjem, stanje virtuelnog balansa, veličina majice, ime oca i broj ličnog dokumenta, osim tebe, na strani Moji podaci, telefon, privatne poruke, interne beleške administracije, i sve u vezi sa roditeljskim potpisom: ime roditelja, srodstvo, datum, vreme i IP adresa.$new$),

            ('TI-017 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Datum rođenja tražimo da bismo znali uzrasnu kategoriju i ne prikazujemo ga drugima ni u punom ni u skraćenom obliku, osim ako sami izaberete da se na vašem profilu vidi ceo datum ili samo godina; ako ne izaberete, ne vidi se ništa.$old$,
             $new$Datum rođenja tražimo da bismo znali uzrasnu kategoriju i ne prikazujemo ga drugima ni u punom ni u skraćenom obliku, osim ako izabereš da se na tvom profilu vidi ceo datum ili samo godina; ako ne izabereš, ne vidi se ništa.$new$),

            ('TI-018 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor.$old$,
             $new$Javna je uvek kategorija koja iz njega proizlazi, bez obzira na tvoj izbor.$new$),

            ('TI-019 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$U podešavanjima možete sakriti profil od svakoga ko nije aktivan član ni administracija, dakle od posetilaca koji nisu prijavljeni i od prijavljenih naloga bez aktivne članarine, ali ne i od ostalih aktivnih članova.$old$,
             $new$U podešavanjima možeš sakriti profil od svakoga ko nije aktivan član ni administracija, dakle od posetilaca koji nisu prijavljeni i od prijavljenih naloga bez aktivne članarine, ali ne i od ostalih aktivnih članova.$new$),

            ('TI-020 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Kad članarina istekne, profil se više ne prikazuje, a ime ostaje u istorijskim tabelama onih sezona u kojima ste bili član.$old$,
             $new$Kad članarina istekne, profil se više ne prikazuje, a ime ostaje u istorijskim tabelama onih sezona u kojima ti je članstvo važilo.$new$),

            ('TI-021 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Jedina vaša fotografija je profilna, koju administrator odobrava pre objave.$old$,
             $new$Jedina tvoja fotografija je profilna, koju administrator odobrava pre objave.$new$),

            ('TI-022 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Za slike koje BTL osoblje napravi na okupljanjima udruženja saglasnost dajete prihvatanjem pravilnika.$old$,
             $new$Za slike koje BTL osoblje napravi na okupljanjima udruženja saglasnost daješ prihvatanjem pravilnika.$new$),

            ('TI-023 politika-privatnosti #3 body', 'politika-privatnosti', 3, 'sr', 'body',
             $old$Ako tražite uklanjanje, sliku na kojoj ste vi predmet uklanjamo, a sa grupne uklanjamo ono što vas identifikuje.$old$,
             $new$Ako tražiš uklanjanje, sliku na kojoj si ti predmet uklanjamo, a sa grupne uklanjamo ono što te identifikuje.$new$),

            ('TI-024 politika-privatnosti #4 body', 'politika-privatnosti', 4, 'sr', 'body',
             $old$Prvi je bezbednosni: brine o tome da obrazac koji pošaljete zaista stigne sa ove strane, a ne podmetnut sa tuđe.$old$,
             $new$Prvi je bezbednosni: brine o tome da obrazac koji pošalješ zaista stigne sa ove strane, a ne podmetnut sa tuđe.$new$),

            ('TI-025 politika-privatnosti #4 body', 'politika-privatnosti', 4, 'sr', 'body',
             $old$Drugi je kolačić sesije, koji vas drži prijavljenim dok se ne odjavite, a najduže 30 dana od kada ste poslednji put koristili portal.$old$,
             $new$Drugi je kolačić sesije, koji te drži prijavljenim dok se ne odjaviš, a najduže 30 dana od poslednjeg korišćenja portala.$new$),

            ('TI-026 politika-privatnosti #4 body', 'politika-privatnosti', 4, 'sr', 'body',
             $old$Nijedan od njih ne prati šta radite, ne pravi vaš profil i ne deli se ni sa kim, pa za njih ne tražimo pristanak.$old$,
             $new$Nijedan od njih ne prati šta radiš, ne pravi tvoj profil i ne deli se ni sa kim, pa za njih ne tražimo pristanak.$new$),

            ('TI-027 politika-privatnosti #4 body', 'politika-privatnosti', 4, 'sr', 'body',
             $old$Pored kolačića, u vašem pregledaču se čuva i još nešto: izbor svetle ili tamne teme, pod imenom `btl-theme`, u lokalnom skladištu.$old$,
             $new$Pored kolačića, u tvom pregledaču se čuva i još nešto: izbor svetle ili tamne teme, pod imenom `btl-theme`, u lokalnom skladištu.$new$),

            ('TI-028 politika-privatnosti #4 body', 'politika-privatnosti', 4, 'sr', 'body',
             $old$Postavlja se tek kad temu sami izaberete.$old$,
             $new$Postavlja se tek kad temu izabereš.$new$),

            ('TI-029 politika-privatnosti #4 body', 'politika-privatnosti', 4, 'sr', 'body',
             $old$Za njega se pristanak ne traži, jer je to podešavanje prikaza koje ste sami zatražili.$old$,
             $new$Za njega se pristanak ne traži, jer je to podešavanje prikaza koje zatražiš.$new$),

            ('TI-030 politika-privatnosti #4 body', 'politika-privatnosti', 4, 'sr', 'body',
             $old$Brišete ga brisanjem podataka sajta u pregledaču, a portal će vas onda otvoriti u tamnoj temi, koja je podrazumevana.$old$,
             $new$Brišeš ga brisanjem podataka sajta u pregledaču, a portal će te onda otvoriti u tamnoj temi, koja je podrazumevana.$new$),

            ('TI-031 politika-privatnosti #4 body', 'politika-privatnosti', 4, 'sr', 'body',
             $old$Vaše podatke ne prodajemo i ne ustupamo oglašivačima.$old$,
             $new$Tvoje podatke ne prodajemo i ne ustupamo oglašivačima.$new$),

            ('TI-032 politika-privatnosti #5 body', 'politika-privatnosti', 5, 'sr', 'body',
             $old$| Dok ste član | Čuvamo dok traje članstvo |$old$,
             $new$| Dok si član | Čuvamo dok traje članstvo |$new$),

            ('TI-033 politika-privatnosti #5 body', 'politika-privatnosti', 5, 'sr', 'body',
             $old$| Prestanete da budete član | Pet godina od poslednje sezone, pa se profil trajno briše |$old$,
             $new$| Prestaneš da budeš član | Pet godina od poslednje sezone, pa se profil trajno briše |$new$),

            ('TI-034 politika-privatnosti #5 body', 'politika-privatnosti', 5, 'sr', 'body',
             $old$Po isteku pet godina, ako niste tražili ništa, u istorijskim tabelama ostaje samo ime i prezime kao običan tekst bez linka: zvanični rezultat sezone je zapis takmičenja koji liga ima legitiman interes da sačuva celovit.$old$,
             $new$Po isteku pet godina, ako ništa ne tražiš, u istorijskim tabelama ostaje samo ime i prezime kao običan tekst bez linka: zvanični rezultat sezone je zapis takmičenja koji liga ima legitiman interes da sačuva celovit.$new$),

            ('TI-035 politika-privatnosti #5 body', 'politika-privatnosti', 5, 'sr', 'body',
             $old$Ako sami tražite brisanje, ili ste diskvalifikovani, brišu se i profil i rezultati, ime i članski broj nestaju, a gde god ste se pominjali ostaje anonimizovan zapis.$old$,
             $new$Ako tražiš brisanje, ili dođe do diskvalifikacije, brišu se i profil i rezultati, ime i članski broj nestaju, a gde god se pominje tvoje ime ostaje anonimizovan zapis.$new$),

            ('TI-036 politika-privatnosti #5 body', 'politika-privatnosti', 5, 'sr', 'body',
             $old$Izuzetak su novčani tragovi: ako ste u administraciji lige doneli odluku o članarini nekog člana, vaše ime ostaje uz tu odluku u evidenciji uplata, članstava i virtuelnog balansa, jer je to zapis o novcu Udruženja.$old$,
             $new$Izuzetak su novčani tragovi: ako u administraciji lige doneseš odluku o članarini nekog člana, tvoje ime ostaje uz tu odluku u evidenciji uplata, članstava i virtuelnog balansa, jer je to zapis o novcu Udruženja.$new$),

            ('TI-037 politika-privatnosti #5 body', 'politika-privatnosti', 5, 'sr', 'body',
             $old$| Brevo (Sendinblue SAS) | Vaša adresa i sadržaj poruke | Francuska |$old$,
             $new$| Brevo (Sendinblue SAS) | Tvoja adresa i sadržaj poruke | Francuska |$new$),

            ('TI-038 politika-privatnosti #5 body', 'politika-privatnosti', 5, 'sr', 'body',
             $old$| Zoho Corporation | Prepiska sa adresom info@: vaša adresa i sadržaj poruka | SAD |$old$,
             $new$| Zoho Corporation | Prepiska sa adresom info@: tvoja adresa i sadržaj poruka | SAD |$new$),

            ('TI-039 politika-privatnosti #6 body', 'politika-privatnosti', 6, 'sr', 'body',
             $old$Imate pravo na: pristup podacima i kopiju; ispravku i dopunu; brisanje; ograničenje obrade; prenosivost; prigovor na obradu po legitimnom interesu; i povlačenje pristanka.$old$,
             $new$Imaš pravo na: pristup podacima i kopiju; ispravku i dopunu; brisanje; ograničenje obrade; prenosivost; prigovor na obradu po legitimnom interesu; i povlačenje pristanka.$new$),

            ('TI-040 politika-privatnosti #6 body', 'politika-privatnosti', 6, 'sr', 'body',
             $old$Sva prava ostvarujete pisanjem na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$old$,
             $new$Sva prava ostvaruješ pisanjem na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$new$),

            ('TI-041 politika-privatnosti #6 body', 'politika-privatnosti', 6, 'sr', 'body',
             $old$Pre nego što bilo šta pošaljemo, proveravamo da ste to zaista vi.$old$,
             $new$Pre nego što bilo šta pošaljemo, proveravamo da si to zaista ti.$new$),

            ('TI-042 politika-privatnosti #6 body', 'politika-privatnosti', 6, 'sr', 'body',
             $old$Polja profila, sliku i tekst o sebi menjate i brišete na strani [Moji podaci](/moji-podaci).$old$,
             $new$Polja profila, sliku i tekst o sebi menjaš i brišeš na strani [Moji podaci](/moji-podaci).$new$),

            ('TI-043 politika-privatnosti #6 body', 'politika-privatnosti', 6, 'sr', 'body',
             $old$Kopiju podataka pripremamo ručno, u CSV ili JSON obliku, kad to tražite.$old$,
             $new$Kopiju podataka pripremamo ručno, u CSV ili JSON obliku, kad to tražiš.$new$),

            ('TI-044 politika-privatnosti #6 body', 'politika-privatnosti', 6, 'sr', 'body',
             $old$### Ako niste zadovoljni$old$,
             $new$### Ako imaš primedbu$new$),

            ('TI-045 politika-privatnosti #6 body', 'politika-privatnosti', 6, 'sr', 'body',
             $old$Prvo nam pišite na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$old$,
             $new$Prvo nam piši na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$new$),

            ('TI-046 politika-privatnosti #7 body', 'politika-privatnosti', 7, 'sr', 'body',
             $old$Ako dođe do povrede podataka koja može da vam naškodi, obaveštavamo vas i nadzorni organ u propisanim rokovima.$old$,
             $new$Ako dođe do povrede podataka koja može da ti naškodi, obaveštavamo tebe i nadzorni organ u propisanim rokovima.$new$),

            ('TI-047 politika-privatnosti #7 body', 'politika-privatnosti', 7, 'sr', 'body',
             $old$Nijednu odluku sa pravnim posledicama po vas ne donosi automat: verifikaciju rezultata, odobravanje profila i sve mere prema članovima donosi čovek.$old$,
             $new$Nijednu odluku sa pravnim posledicama po tebe ne donosi automat: verifikaciju rezultata, odobravanje profila i sve mere prema članovima donosi čovek.$new$),

            ('TI-048 politika-privatnosti #7 body', 'politika-privatnosti', 7, 'sr', 'body',
             $old$Ako izmena bitno utiče na vaša prava, javljamo vam elektronskom poštom pre nego što stupi na snagu.$old$,
             $new$Ako izmena bitno utiče na tvoja prava, javljamo ti elektronskom poštom pre nego što stupi na snagu.$new$),

            ('TI-049 uslovi-koriscenja #1 body', 'uslovi-koriscenja', 1, 'sr', 'body',
             $old$Pišite nam na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$old$,
             $new$Piši nam na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$new$),

            ('TI-050 uslovi-koriscenja #1 body', 'uslovi-koriscenja', 1, 'sr', 'body',
             $old$Korišćenjem portala prihvatate ih; ako se ne slažete, portal nemojte koristiti.$old$,
             $new$Korišćenjem portala prihvataš ih; ako se ne slažeš, portal nemoj koristiti.$new$),

            ('TI-051 uslovi-koriscenja #1 body', 'uslovi-koriscenja', 1, 'sr', 'body',
             $old$Uz njih važe još dva dokumenta: [opšti pravilnik lige](/pravilnik), koji uređuje takmičenje i članarinu i donosi se za svaku sezonu, i politika privatnosti, koja uređuje šta radimo sa vašim podacima.$old$,
             $new$Uz njih važe još dva dokumenta: [opšti pravilnik lige](/pravilnik), koji uređuje takmičenje i članarinu i donosi se za svaku sezonu, i politika privatnosti, koja uređuje šta radimo sa tvojim podacima.$new$),

            ('TI-052 uslovi-koriscenja #3 body', 'uslovi-koriscenja', 3, 'sr', 'body',
             $old$Koliko košta članarina i do kada se plaća, naći ćete u cenovniku u [opštem pravilniku lige](/pravilnik).$old$,
             $new$Koliko košta članarina i do kada se plaća, naći ćeš u cenovniku u [opštem pravilniku lige](/pravilnik).$new$),

            ('TI-053 uslovi-koriscenja #4 body', 'uslovi-koriscenja', 4, 'sr', 'body',
             $old$Popunite formu.$old$,
             $new$Popuni formu.$new$),

            ('TI-054 uslovi-koriscenja #4 body', 'uslovi-koriscenja', 4, 'sr', 'body',
             $old$Potvrdite adresu elektronske pošte.$old$,
             $new$Potvrdi adresu elektronske pošte.$new$),

            ('TI-055 uslovi-koriscenja #4 body', 'uslovi-koriscenja', 4, 'sr', 'body',
             $old$Platite članarinu.$old$,
             $new$Plati članarinu.$new$),

            ('TI-056 uslovi-koriscenja #4 body', 'uslovi-koriscenja', 4, 'sr', 'body',
             $old$Mi evidentiramo uplatu i aktiviramo vam takmičarski status.$old$,
             $new$Mi evidentiramo uplatu i aktiviramo ti takmičarski status.$new$),

            ('TI-057 uslovi-koriscenja #4 body', 'uslovi-koriscenja', 4, 'sr', 'body',
             $old$Status vidite u roku od dva dana, i tada dobijate članski broj.$old$,
             $new$Status vidiš u roku od dva dana, i tada dobijaš članski broj.$new$),

            ('TI-058 uslovi-koriscenja #4 body', 'uslovi-koriscenja', 4, 'sr', 'body',
             $old$Ako napravite pauzu, broj vam je ostao rezervisan.$old$,
             $new$Ako napraviš pauzu, broj ti je ostao rezervisan.$new$),

            ('TI-059 uslovi-koriscenja #4 body', 'uslovi-koriscenja', 4, 'sr', 'body',
             $old$Jedan broj se nikad ne dodeljuje dvaput, pa ostaje potrošen i kad zatražite brisanje podataka.$old$,
             $new$Jedan broj se nikad ne dodeljuje dvaput, pa ostaje potrošen i kad zatražiš brisanje podataka.$new$),

            ('TI-060 uslovi-koriscenja #4 body', 'uslovi-koriscenja', 4, 'sr', 'body',
             $old$| Odakle ste | Kako plaćate |$old$,
             $new$| Odakle si | Kako plaćaš |$new$),

            ('TI-061 uslovi-koriscenja #4 body', 'uslovi-koriscenja', 4, 'sr', 'body',
             $old$Dokaz je potvrda vaše banke ili platnog sistema, uz obaveštenje koje šaljemo kada članarinu aktiviramo.$old$,
             $new$Dokaz je potvrda tvoje banke ili platnog sistema, uz obaveštenje koje šaljemo kada članarinu aktiviramo.$new$),

            ('TI-062 uslovi-koriscenja #5 body', 'uslovi-koriscenja', 5, 'sr', 'body',
             $old$Prijavljujte samo trke koje ste sami istrčali.$old$,
             $new$Prijavljuj samo svoje trke.$new$),

            ('TI-063 uslovi-koriscenja #5 body', 'uslovi-koriscenja', 5, 'sr', 'body',
             $old$Sve o tome kako se rezultat prijavljuje, šta služi kao dokaz, koji su rokovi i kako ga proveravamo, naći ćete u [pravilniku](/pravilnik).$old$,
             $new$Sve o tome kako se rezultat prijavljuje, šta služi kao dokaz, koji su rokovi i kako ga proveravamo, naći ćeš u [pravilniku](/pravilnik).$new$),

            ('TI-064 uslovi-koriscenja #6 body', 'uslovi-koriscenja', 6, 'sr', 'body',
             $old$Ko se preko njega učlani i kome članarina bude aktivirana prvi naredni put, donosi vam iznos koji na taj dan važi, a koji je prikazan na vašoj strani "Moja članarina", uz sam link.$old$,
             $new$Ko se preko njega učlani i kome članarina bude aktivirana prvi naredni put, donosi ti iznos koji na taj dan važi, a koji je prikazan na tvojoj strani "Moja članarina", uz sam link.$new$),

            ('TI-065 uslovi-koriscenja #6 body', 'uslovi-koriscenja', 6, 'sr', 'body',
             $old$Iznos se upisuje na vaš balans u trenutku aktivacije, a ne u trenutku prijave, i o tome vas obaveštavamo porukom.$old$,
             $new$Iznos se upisuje na tvoj balans u trenutku aktivacije, a ne u trenutku prijave, i o tome te obaveštavamo porukom.$new$),

            ('TI-066 uslovi-koriscenja #6 body', 'uslovi-koriscenja', 6, 'sr', 'body',
             $old$Svaka promena vidljiva vam je na nalogu, sa datumom i razlogom.$old$,
             $new$Svaka promena vidljiva ti je na nalogu, sa datumom i razlogom.$new$),

            ('TI-067 uslovi-koriscenja #8 body', 'uslovi-koriscenja', 8, 'sr', 'body',
             $old$Na portal postavljate profilnu fotografiju, biografiju, tekst o sebi, ocene i komentare na događaje.$old$,
             $new$Na portal postavljaš profilnu fotografiju, biografiju, tekst o sebi, ocene i komentare na događaje.$new$),

            ('TI-068 uslovi-koriscenja #8 body', 'uslovi-koriscenja', 8, 'sr', 'body',
             $old$Taj sadržaj ostaje vaš i ne polažemo pravo na njega.$old$,
             $new$Taj sadržaj ostaje tvoj i ne polažemo pravo na njega.$new$),

            ('TI-069 uslovi-koriscenja #8 body', 'uslovi-koriscenja', 8, 'sr', 'body',
             $old$Postavljanjem nam dajete neisključivo pravo da ga prikazujemo na portalu i koristimo za predstavljanje portala i lige, na primer u slici za deljenje vašeg profila.$old$,
             $new$Postavljanjem nam daješ neisključivo pravo da ga prikazujemo na portalu i koristimo za predstavljanje portala i lige, na primer u slici za deljenje tvog profila.$new$),

            ('TI-070 uslovi-koriscenja #8 body', 'uslovi-koriscenja', 8, 'sr', 'body',
             $old$To pravo prestaje kada sadržaj uklonite, osim tamo gde je već ugrađen u istorijski zapis takmičenja.$old$,
             $new$To pravo prestaje kada sadržaj ukloniš, osim tamo gde je već ugrađen u istorijski zapis takmičenja.$new$),

            ('TI-071 uslovi-koriscenja #8 body', 'uslovi-koriscenja', 8, 'sr', 'body',
             $old$Postavljanjem potvrđujete i da imate pravo da ga postavite.$old$,
             $new$Postavljanjem potvrđuješ i da imaš pravo da ga postaviš.$new$),

            ('TI-072 uslovi-koriscenja #8 body', 'uslovi-koriscenja', 8, 'sr', 'body',
             $old$Profilnu fotografiju i biografiju odobravamo pre objave, a sadržaj koji krši ova pravila možemo ukloniti, uz obaveštenje vama.$old$,
             $new$Profilnu fotografiju i biografiju odobravamo pre objave, a sadržaj koji krši ova pravila možemo ukloniti, uz obaveštenje tebi.$new$),

            ('TI-073 uslovi-koriscenja #9 body', 'uslovi-koriscenja', 9, 'sr', 'body',
             $old$- Kada na portalu iskažete nameru da idete na trku, to nije prijava ni prema nama ni prema organizatoru, nego informacija drugim članovima radi dogovora oko prevoza.$old$,
             $new$- Kada na portalu iskažeš nameru da ideš na trku, to nije prijava ni prema nama ni prema organizatoru, nego informacija drugim članovima radi dogovora oko prevoza.$new$),

            ('TI-074 uslovi-koriscenja #9 body', 'uslovi-koriscenja', 9, 'sr', 'body',
             $old$Za dogovor i za put odgovorni ste vi i osoba sa kojom se dogovarate.$old$,
             $new$Za dogovor i za put odgovorni si ti i osoba sa kojom se dogovaraš.$new$),

            ('TI-075 uslovi-koriscenja #9 body', 'uslovi-koriscenja', 9, 'sr', 'body',
             $old$### Trčite na sopstvenu odgovornost$old$,
             $new$### Trči na sopstvenu odgovornost$new$),

            ('TI-076 uslovi-koriscenja #9 body', 'uslovi-koriscenja', 9, 'sr', 'body',
             $old$Vi ste odgovorni za svoje zdravlje i za procenu da li ste za neku trku spremni, i to pri registraciji i potvrđujete.$old$,
             $new$Za svoje zdravlje i za procenu spremnosti za neku trku odgovornost je na tebi, i to pri registraciji potvrđuješ.$new$),

            ('TI-077 uslovi-koriscenja #9 body', 'uslovi-koriscenja', 9, 'sr', 'body',
             $old$Ako uz svoju trku vidite netačan podatak, ili ne želite da vam trka bude u našem kalendaru, pišite na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$old$,
             $new$Ako uz svoju trku vidiš netačan podatak, ili ne želiš da ti trka bude u našem kalendaru, piši na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$new$),

            ('TI-078 uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Iz tekuće sezone možete da se odjavite kad god želite.$old$,
             $new$Iz tekuće sezone možeš da se odjaviš kad god želiš.$new$),

            ('TI-079 uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Od tada više ne unosite rezultate za tu godinu, ali ostajete u istorijskim tabelama.$old$,
             $new$Od tada više ne unosiš rezultate za tu godinu, ali ostaješ u istorijskim tabelama.$new$),

            ('TI-080 uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Ako želite da istupite, postupak opisuje [Statut](/BTL%20Statut.pdf).$old$,
             $new$Ako želiš da istupiš, postupak opisuje [Statut](/BTL%20Statut.pdf).$new$),

            ('TI-081 uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Ako ne obnovite takmičarski status za narednu sezonu, vaš profil se više ne prikazuje, a vaše ime ostaje u tabelama sezona u kojima ste trčali.$old$,
             $new$Ako ne obnoviš takmičarski status za narednu sezonu, tvoj profil se više ne prikazuje, a tvoje ime ostaje u tabelama sezona u kojima ti je rezultat zabeležen.$new$),

            ('TI-082 uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Vi svoj profil i dalje vidite, a dukati i priznanja ostaju zabeleženi i vraćaju se sa vama kad ponovo obnovite status.$old$,
             $new$Ti svoj profil i dalje vidiš, a dukati i priznanja ostaju zabeleženi i vraćaju se sa tobom kad ponovo obnoviš status.$new$),

            ('TI-083 uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Ako zatražite brisanje, uklanjamo vaše ime, prezime i članski broj sa svih mesta, zajedno sa rezultatima.$old$,
             $new$Ako zatražiš brisanje, uklanjamo tvoje ime, prezime i članski broj sa svih mesta, zajedno sa rezultatima.$new$),

            ('TI-084 uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Ostaje samo ono što smo po zakonu dužni da čuvamo, o čemu više piše u politici privatnosti, a tamo gde ste se pominjali ostaje zapis bez imena.$old$,
             $new$Ostaje samo ono što smo po zakonu dužni da čuvamo, o čemu više piše u politici privatnosti, a tamo gde se pominje tvoje ime ostaje zapis bez imena.$new$),

            ('TI-085 uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Ove uslove možemo menjati, a o svakoj bitnoj izmeni obaveštavamo vas elektronskom poštom pre nego što stupi na snagu; ako se sa izmenom ne slažete, možete prekinuti članstvo.$old$,
             $new$Ove uslove možemo menjati, a o svakoj bitnoj izmeni obaveštavamo te elektronskom poštom pre nego što stupi na snagu; ako se sa izmenom ne slažeš, možeš prekinuti članstvo.$new$),

            ('TI-086 uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Ako živite u drugoj zemlji, to vam ne uskraćuje zaštitu koju vam daju obavezni propisi zemlje vašeg prebivališta.$old$,
             $new$Ako živiš u drugoj zemlji, to ti ne uskraćuje zaštitu koju ti daju obavezni propisi zemlje tvog prebivališta.$new$),

            ('TI-087 uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Ako imate primedbu, prvo nam pišite na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$old$,
             $new$Ako imaš primedbu, prvo nam piši na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$new$),

            ('TI-088 rec-predsednika #1 body', 'rec-predsednika', 1, 'sr', 'body',
             $old$Kompletan [pravilnik](/pravilnik) za tekuću sezonu stoji na portalu, a za dodatne informacije pišite nam na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$old$,
             $new$Kompletan [pravilnik](/pravilnik) za tekuću sezonu stoji na portalu, a za dodatne informacije piši nam na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).$new$),

            ('TI-089 pravilnik #1 body', 'pravilnik', 1, 'sr', 'body',
             $old$Učlanjenjem potvrđujete da ste ga pročitali i da ga prihvatate u celini.$old$,
             $new$Učlanjenjem potvrđuješ da poznaješ pravilnik i da ga prihvataš u celini.$new$),

            ('TI-090 pravilnik #1 body', 'pravilnik', 1, 'sr', 'body',
             $old$- Uslovi korišćenja uređuju odnos između vas i udruženja: nalog i obaveze pri korišćenju portala.$old$,
             $new$- Uslovi korišćenja uređuju odnos između tebe i udruženja: nalog i obaveze pri korišćenju portala.$new$),

            ('TI-091 pravilnik #2 body', 'pravilnik', 2, 'sr', 'body',
             $old$| 1. januar, 10:00 | Poslednji rok da prijavite sve zaostale rezultate prethodne sezone |$old$,
             $new$| 1. januar, 10:00 | Poslednji rok da prijaviš sve zaostale rezultate prethodne sezone |$new$),

            ('TI-092 pravilnik #2 body', 'pravilnik', 2, 'sr', 'body',
             $old$Rezultate prethodne sezone možete da prijavite sami do 1. januara u 10:00.$old$,
             $new$Rezultate prethodne sezone možeš da prijaviš do 1. januara u 10:00.$new$),

            ('TI-093 pravilnik #2 body', 'pravilnik', 2, 'sr', 'body',
             $old$Ako vam posle toga neki rezultat nedostaje, obratite nam se i upisaćemo ga na vaš profil, s tim što on više ne ulazi u tabele, rang liste ni priznanja.$old$,
             $new$Ako ti posle toga neki rezultat nedostaje, obrati nam se i upisaćemo ga na tvoj profil, s tim što on više ne ulazi u tabele, rang liste ni priznanja.$new$),

            ('TI-094 pravilnik #5 body', 'pravilnik', 5, 'sr', 'body',
             $old$Boduje se sopstveni istrčani segment, a zapis nosi naziv trke i oznaku štafete, na primer "Beogradski maraton, štafeta 1", sa dužinom, nagibom i vremenom vaše deonice.$old$,
             $new$Boduje se sopstveni istrčani segment, a zapis nosi naziv trke i oznaku štafete, na primer "Beogradski maraton, štafeta 1", sa dužinom, nagibom i vremenom tvoje deonice.$new$),

            ('TI-095 pravilnik #5 body', 'pravilnik', 5, 'sr', 'body',
             $old$Sa istog događaja smete imati više rezultata, ali ne dva rezultata sa iste trke.$old$,
             $new$Sa istog događaja smeš imati više rezultata, ali ne dva rezultata sa iste trke.$new$),

            ('TI-096 pravilnik #5 body', 'pravilnik', 5, 'sr', 'body',
             $old$Ako trka nije završena, rezultata nema, i to se nigde ne evidentira, ni na vašem profilu ni u tabelama.$old$,
             $new$Ako trka nije završena, rezultata nema, i to se nigde ne evidentira, ni na tvom profilu ni u tabelama.$new$),

            ('TI-097 pravilnik #5 body', 'pravilnik', 5, 'sr', 'body',
             $old$Ako ste tokom trke prešli na drugu trku istog događaja, rezultat priznajemo samo ako se nalazite u zvaničnim rezultatima te trke i / ili organizator to potvrdi.$old$,
             $new$Ako dođe do prelaska na drugu trku istog događaja tokom trke, rezultat priznajemo samo ako se nalaziš u zvaničnim rezultatima te trke i / ili organizator to potvrdi.$new$),

            ('TI-098 pravilnik #8 body', 'pravilnik', 8, 'sr', 'body',
             $old$Kategorija se određuje po godinama koje punite u toj kalendarskoj godini, i važi od 1. januara te godine.$old$,
             $new$Kategorija se određuje po godinama koje puniš u toj kalendarskoj godini, i važi od 1. januara te godine.$new$),

            ('TI-099 pravilnik #8 body', 'pravilnik', 8, 'sr', 'body',
             $old$Unosite ga sami i za njegovu tačnost odgovarate sami.$old$,
             $new$Unosiš ga i za njegovu tačnost odgovaraš.$new$),

            ('TI-100 pravilnik #8 body', 'pravilnik', 8, 'sr', 'body',
             $old$Kad se učlanite, birate da li ćete se takmičiti u početničkoj kategoriji (Početnici, Početnice) ili u svojoj uzrasnoj.$old$,
             $new$Kad se učlaniš, biraš da li ćeš se takmičiti u početničkoj kategoriji (Početnici, Početnice) ili u svojoj uzrasnoj.$new$),

            ('TI-101 pravilnik #8 body', 'pravilnik', 8, 'sr', 'body',
             $old$Izbor za narednu sezonu možete da menjate koliko god puta želite, sve do 1. januara u 10:00, kada postaje konačan.$old$,
             $new$Izbor za narednu sezonu možeš da menjaš koliko god puta želiš, sve do 1. januara u 10:00, kada postaje konačan.$new$),

            ('TI-102 pravilnik #8 body', 'pravilnik', 8, 'sr', 'body',
             $old$Čim u nekoj sezoni skupite 12 ili više BTL bodova, od sledeće sezone prelazite u svoju uzrasnu kategoriju i tu ostajete.$old$,
             $new$Čim u nekoj sezoni skupiš 12 ili više BTL bodova, od sledeće sezone prelaziš u svoju uzrasnu kategoriju i tu ostaješ.$new$),

            ('TI-103 pravilnik #8 body', 'pravilnik', 8, 'sr', 'body',
             $old$Tokom sezone ste u jednoj kategoriji i ona se ne menja do kraja godine.$old$,
             $new$Tokom sezone si u jednoj kategoriji i ona se ne menja do kraja godine.$new$),

            ('TI-104 pravilnik #9 body', 'pravilnik', 9, 'sr', 'body',
             $old$Rezultat prijavljujete sami, sa svog profila ili sa strane događaja, dugmetom uz trku.$old$,
             $new$Rezultat prijavljuješ sa svog profila ili sa strane događaja, dugmetom uz trku.$new$),

            ('TI-105 pravilnik #9 body', 'pravilnik', 9, 'sr', 'body',
             $old$Upisujete događaj i trku, dužinu, uspon i spust, vreme i link ka zvaničnim rezultatima.$old$,
             $new$Upisuješ događaj i trku, dužinu, uspon i spust, vreme i link ka zvaničnim rezultatima.$new$),

            ('TI-106 pravilnik #9 body', 'pravilnik', 9, 'sr', 'body',
             $old$Kad izaberete trku iz kalendara, portal sam popuni ono što ta trka zadaje.$old$,
             $new$Kad izabereš trku iz kalendara, portal sam popuni ono što ta trka zadaje.$new$),

            ('TI-107 pravilnik #9 body', 'pravilnik', 9, 'sr', 'body',
             $old$Ako trke nema u kalendaru, rezultat možete da prijavite i tada, a uz njega ćemo napraviti i događaj i trku.$old$,
             $new$Ako trke nema u kalendaru, rezultat možeš da prijaviš i tada, a uz njega ćemo napraviti i događaj i trku.$new$),

            ('TI-108 pravilnik #9 body', 'pravilnik', 9, 'sr', 'body',
             $old$Dužinu, uspon i spust upisujete sami.$old$,
             $new$Dužinu, uspon i spust upisuješ.$new$),

            ('TI-109 pravilnik #9 body', 'pravilnik', 9, 'sr', 'body',
             $old$Ako ga nemate, pošaljite sliku, na primer snimak sata ili diplomu, i kratko napišite zašto linka nema i šta se na slici vidi.$old$,
             $new$Ako ga nemaš, pošalji sliku, na primer snimak sata ili diplomu, i kratko napiši zašto linka nema i šta se na slici vidi.$new$),

            ('TI-110 pravilnik #12 body', 'pravilnik', 12, 'sr', 'body',
             $old$- Klub je organizacija za koju nastupate van lige.$old$,
             $new$- Klub je organizacija za koju nastupaš van lige.$new$),

            ('TI-111 pravilnik #15 body', 'pravilnik', 15, 'sr', 'body',
             $old$- Prijava rezultata koji niste istrčali, ili sa netačnim podacima,$old$,
             $new$- Prijava rezultata koji nije tvoj, ili sa netačnim podacima,$new$),

            ('TI-112 pravilnik #15 body', 'pravilnik', 15, 'sr', 'body',
             $old$- Postavljanje sadržaja na koji nemate pravo.$old$,
             $new$- Postavljanje sadržaja na koji nemaš pravo.$new$),

            ('TI-113 pravilnik #17 body', 'pravilnik', 17, 'sr', 'body',
             $old$Šta je na portalu javno, šta nikada ne prikazujemo i kako možete da sakrijete svoj profil, objašnjava [politika privatnosti](/politika-privatnosti).$old$,
             $new$Šta je na portalu javno, šta nikada ne prikazujemo i kako možeš da sakriješ svoj profil, objašnjava [politika privatnosti](/politika-privatnosti).$new$),

            ('TI-114 pravilnik #17 body', 'pravilnik', 17, 'sr', 'body',
             $old$Prihvatanjem pravilnika dajete saglasnost da liga objavljuje fotografije koje njeno osoblje napravi na okupljanjima i takmičenjima.$old$,
             $new$Prihvatanjem pravilnika daješ saglasnost da liga objavljuje fotografije koje njeno osoblje napravi na okupljanjima i takmičenjima.$new$),

            ('TI-115 pravilnik #18 body', 'pravilnik', 18, 'sr', 'body',
             $old$Dukat je zapis o onome što ste istrčali, u obliku novčića.$old$,
             $new$Dukat je zapis o tvom trčanju, u obliku novčića.$new$),

            ('TI-116 pravilnik #18 body', 'pravilnik', 18, 'sr', 'body',
             $old$Ne nosi bodove i ne pomera vas u tabeli.$old$,
             $new$Ne nosi bodove i ne pomera te u tabeli.$new$),

            ('TI-117 pravilnik #18 body', 'pravilnik', 18, 'sr', 'body',
             $old$Dodeljuje se automatski, onog trenutka kad ono što ste istrčali pređe granicu koja na njemu piše.$old$,
             $new$Dodeljuje se automatski, onog trenutka kad tvoje trčanje pređe granicu koja na njemu piše.$new$),

            ('TI-118 politika-privatnosti #6 heading', 'politika-privatnosti', 6, 'sr', 'heading',
             $old$6. Vaša prava$old$,
             $new$6. Tvoja prava$new$),

            ('TI-119 uslovi-koriscenja #8 heading', 'uslovi-koriscenja', 8, 'sr', 'heading',
             $old$8. Sadržaj koji postavljate$old$,
             $new$8. Sadržaj koji postavljaš$new$),

            ('TI-SIGNOFF pravilnik #19 body', 'pravilnik', 19, 'sr', 'body',
             $old$Poslednja izmena: 15.11.2026.$old$,
             $new$Poslednja izmena: 21.11.2026.$new$),

            ('TI-SIGNOFF uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'sr', 'body',
             $old$Poslednja izmena: 11.11.2026.$old$,
             $new$Poslednja izmena: 21.11.2026.$new$),

            ('TI-SIGNOFF politika-privatnosti #7 body', 'politika-privatnosti', 7, 'sr', 'body',
             $old$Poslednja izmena: 16.11.2026.$old$,
             $new$Poslednja izmena: 21.11.2026.$new$),

            ('TI-SIGNOFF-EN pravilnik #19 body', 'pravilnik', 19, 'en', 'body',
             $old$Last amended: 15.11.2026.$old$,
             $new$Last amended: 21.11.2026.$new$),

            ('TI-SIGNOFF-EN uslovi-koriscenja #11 body', 'uslovi-koriscenja', 11, 'en', 'body',
             $old$Last amended: 11.11.2026.$old$,
             $new$Last amended: 21.11.2026.$new$),

            ('TI-SIGNOFF-EN politika-privatnosti #7 body', 'politika-privatnosti', 7, 'en', 'body',
             $old$Last amended: 16.11.2026.$old$,
             $new$Last amended: 21.11.2026.$new$)

        ) as edits (label, slug, section_position, in_language, field, old_text, new_text)
    loop
        total := total + 1;

        if edit.in_language = 'sr' then
            select case edit.field when 'body' then s.body else s.heading end into current_text
            from static_page_section s
            join static_page p on p.id = s.page_id
            where p.slug = edit.slug and s.position = edit.section_position;
        else
            select case edit.field when 'body' then t.body else t.heading end into current_text
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
        seen := (length(current_text) - length(replace(current_text, edit.old_text, '')))
                / length(edit.old_text);

        /* The new text is asked about too, for every edit, and a text that already holds it is a problem. It is asked of the
           text WITHOUT the old text, which is replaced by a character no page contains. */
        already := strpos(replace(current_text, edit.old_text, chr(1)), edit.new_text) > 0;

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
            set body    = case when edit.field = 'body' then replace(s.body, edit.old_text, edit.new_text) else s.body end,
                heading = case when edit.field = 'heading' then replace(s.heading, edit.old_text, edit.new_text) else s.heading end
            from static_page p
            where p.id = s.page_id and p.slug = edit.slug and s.position = edit.section_position;
        else
            update static_page_section_translation t
            set body    = case when edit.field = 'body' then replace(t.body, edit.old_text, edit.new_text) else t.body end,
                heading = case when edit.field = 'heading' then replace(t.heading, edit.old_text, edit.new_text) else t.heading end
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
