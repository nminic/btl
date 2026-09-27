# BTL Portal — pravila projekta

> **PRVO PRAVILO, iznad svih ostalih:** poruka vlasniku ne sme da se završi bez
> posla pokrenutog u toj istoj poruci. Ako je poslednje što je u poruci napisano
> najava onoga što sledi, poruka je pogrešna: posao se pokreće pa se piše da je
> počet. Provera pre slanja: da li poslednji red opisuje nešto što je već
> urađeno? Ako ne, poruka se ne šalje.

Portal Balkanske trkačke lige (btl). Monorepo: `backend/` (Java 21, Spring Boot, Maven wrapper), `frontend/` (React + TypeScript, Vite), `docker-compose.yml` (PostgreSQL 18).

## Komunikacija

- Sva komunikacija sa korisnikom je na srpskom jeziku, ali se tehnički elementi (nazivi klasa, polja, komandi) referenciraju na engleskom.
- SAV kod je isključivo na engleskom: nazivi promenljivih, polja, metoda, komentari, poruke izuzetaka, commit poruke, nazivi testova. Jedini srpski u kodu su UI tekstovi vidljivi posetiocima sajta.
- Nikad ne koristiti em-dash (—) u tekstu za korisnika; u krajnjem slučaju n-dash (–).

## Rad bez prekida (obavezno, iznad svega ostalog)

- **Nikad ne stajati.** Rad se ne prekida ni kad stigne pitanje, ni kad je celina
  gotova, ni na kraju izveštaja.
- **Kad vlasnik nešto pita:** odgovoriti kratko i **istog trenutka nastaviti** ono
  na čemu se radilo, u istoj poruci. Odgovor nije kraj rada nego prekid od par
  redova.
- **Izveštavanje:** javljati posle svake gotove celine, kratko i konkretno. Nikad
  ne pisati „SLEDEĆE:" i stati. Piše se **„POČINJEM:"** i tog trenutka se počinje,
  u istoj poruci.
- **Prvo se radi, pa se piše da je početo.** Nijedna poruka ne sme da se završi
  najavom. Reč „POČINJEM" opisuje ono što je u toj istoj poruci već pokrenuto, ne
  ono što sledi. Redosled u poruci je: kratak odgovor ako je bilo pitanje, pa
  posao, pa izveštaj o onome što je upravo urađeno.
  - **Zašto ovo pravilo postoji:** poruka se završava onog trenutka kad prestanu
    pozivi alata. Najava na kraju poruke znači da posao nije pokrenut i da se
    ništa neće izvršiti dok vlasnik ponovo ne piše. Oblik „izveštaj pa najava"
    uvek završi kao prekid; ispravan oblik je „posao pa izveštaj".
  - Jedini dozvoljen kraj bez posla je izričito „stao sam i čekam", uz razlog.
- **Jedino što zaustavlja rad** je izričito „stani" od vlasnika, ili pitanje na
  koje se bez njegovog odgovora ne može dalje. U drugom slučaju se pitanje postavi
  i **odmah nastavi sa onim delom posla koji od tog odgovora ne zavisi**.

## Odluke (izvor istine, pročitati pre rada)

Sve tehničke i produktne odluke žive van repoa, u dva dnevnika odluka koji moraju biti međusobno usklađeni:

- `../btl-produkt/ADL.md` — arhitektura i tehnika: stack, server, edge proxy, deploy, keširanje, bezbednost, analitika, frontend standardi.
- `../btl-produkt/PDL.md` — produkt: pravila lige, formula bodovanja, kategorije, članstvo, rang liste, obim izrade. Stavke nose oznake [ODLUKA] / [NASLEĐENO] / [OTVORENO] / [UKINUTO].

Ništa se ne predlaže ni ne odlučuje u sukobu sa tim fajlovima, a svaka nova odluka se u njih upisuje istog trenutka. Oni su namerno van git repoa jer sadrže operativne detalje servera, a repo je javan.

## Domen (izvor istine)

- Pravila lige: Pravilnik BTL 2017 (domenski kontekst; periodične trke se NE koriste).
- Formula bodova: `BTL = (40 × Le)^3.257 / (2 × Tsec^2.137)`, `Le = L + (1.25×AP + 0.75×AN)/200`. L u km, AP/AN u metrima (AN pozitivan broj), Tsec u sekundama, prikaz na 2 decimale. Stepen 2.137 ide SAMO na Tsec. Implementacija: `backend/src/main/java/com/btl/portal/domain/scoring/BtlScoreCalculator.java`. Zlatni test set u `BtlScoreCalculatorTest` je NEPRIKOSNOVEN: ne menjati očekivane vrednosti.

## Bezbednost (obavezno)

- Nikad kredencijali, tajne ili tokeni u kodu ili commitima; sve kroz env varijable (`.env` je gitignorisan, `.env.example` bez pravih vrednosti).
- Svaki novi endpoint mora imati definisana pravila autorizacije i test autorizacije. **Brojevi su
  401 i 404, ne 403** (ADL A8, odluka vlasnika od 13.09.2026): neprijavljen dobija 401, a prijavljen
  kome pravo nedostaje dobija **404**, isti odgovor kao da adresa ne postoji, jer ne sme ni da sazna
  da radnja postoji. ~~401/403 slučajevi.~~
- Sav korisnički unos se validira na backendu (Bean Validation); upiti isključivo kroz JPA/parametrizovane upite.
- Lozinke: BCrypt/Argon2. Tokeni: httpOnly kolačići, nikad localStorage.

## UI standardi (obavezno za svaku stranicu i komponentu)

- Potpuna responsivnost: mobile-first CSS; ispravan prikaz na mobilnom (od 360px širine), tabletu i desktopu; bez horizontalnog skrola. Svaka UI izmena se verifikuje na sve tri širine ekrana pre PR-a.
- Pristupačnost po WCAG 2.2 AA kao minimum: semantički HTML i landmark elementi, potpuna tastaturna navigacija sa vidljivim fokusom, kontrast teksta najmanje 4.5:1, alt tekstovi na slikama, labele na svim poljima forme, ARIA samo tamo gde semantika nije dovoljna, poštovanje prefers-reduced-motion. Testovi komponenti koriste role/label upite, ne CSS selektore.

## Testiranje i kvalitet

- Coverage prag je 100% (JaCoCo BUNDLE line+branch; Vitest thresholds). Build PADA ispod 100%. Izuzeci od pokrivenosti se dodaju samo uz obrazloženje u PR-u (tipično: čisti config/bootstrap).
- Integracioni testovi idu protiv prave PostgreSQL baze kroz Testcontainers (nikad H2).
- Šema baze se menja isključivo kroz Flyway migracije (`backend/src/main/resources/db/migration`), nikad ručno.

## Komande

- Backend: `cd backend && ./mvnw verify` (build + testovi + coverage prag)
- Frontend: `cd frontend && npm run test:coverage && npm run lint && npm run build`
- Lokalna baza: `docker compose up -d postgres` (traži `.env`, kopiraj iz `.env.example`)
- Ceo stack u kontejnerima: `docker compose --profile full up --build`
- Backend lokalno protiv compose baze: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local`
- Produkcijski deploy: `cd /opt/btl/deploy && docker compose -f compose.prod.yml up -d --build frontend` na hostu. Portove 80/443 drži zajednički edge proxy van ovog repoa; nikad ne dodavati servis koji ih zauzima i nikad ne pokretati `docker compose down` nad tim projektom. Detalji: `deploy/README.md`.

## Mutacije: dve zamke koje su u istom satu uhvatile dva nezavisna agenta (18.09.2026)

Ko dokazuje nalaz mutacijom, prvo pročita ovo. Obe zamke **izgledaju kao uspešno merenje**, pa se
ne vide dok se ne potraže. Sve brojke niže su izmerene, ne procenjene.

### 1. `mvnw.cmd` bez `./` ne krene, a log izgleda isto kao uhvaćena mutacija

Iz Git Bash-a poziv `cmd /c mvnw.cmd ...` vrati **izlazni kod 1, prazan stdout i 99 bajtova na
stderr** (`'mvnw.cmd' is not recognized...`). To je isto što vidi i uhvaćena mutacija, pa je
jednom agentu dalo **22 lažna prolaza**.

**Uzrok nije `cmd.exe` nego okruženje.** `cmd.exe` inače traži program u radnom direktorijumu;
ovde ga sprečava **nasleđena promenljiva** `NoDefaultCurrentDirectoryInExePath=1`. Izmereno u obe
ljuske i u oba smera, isti `cwd`: sa promenljivom `cmd` i `powershell` daju izlazni kod 1, nula
bajtova na stdout i 99 na stderr; bez nje oba daju izlazni kod 0 i 434 bajta. **Dakle ne odlučuje
ljuska nego promenljiva**, i ranija rečenica da „iz PowerShell-a uspeva" je bila netačna. Odakle je
nasleđena nije utvrđeno: nema je ni u registru pod `User` ni pod `Machine`, a `bash.exe` pokrenut
sam je ne postavlja. **CI se ovde ne pominje namerno:**
oba posla u `.github/workflows/verify.yml` rade na `ubuntu-latest` i backend zove
`./mvnw --batch-mode verify`, nikad `mvnw.cmd`, pa se tamo ništa od ovoga ni ne javlja. (Da `cmd`
na tom runneru ne postoji je verovatno, ali se sa ove mašine ne može izmeriti, pa se i ne tvrdi.) Zato „ne radi" nije svojstvo
komande nego onoga odakle se zove.

**Šta se radi:** iz bash-a se zove `./mvnw`. I bez obzira na shell, **prvo se pusti prolaz BEZ
mutacije** i traži se **izlazni kod nula i red `Tests run:`**. To je jedino što ovu klasu hvata u
svakom okruženju.

### 2. Vraćanje iz `git show HEAD:` bajtova menja prelom reda, i to tiho

Repo je pretežno CRLF (`core.autocrlf=true`, `* text=auto`), a blob je LF, pa vraćanje **sirovih**
blob bajtova prepiše svaki red fajla.

**Šta o tome govori a šta ćuti, izmereno tri puta na tri fajla:**

- `git status --porcelain` **progovori**: vraća ` M <put>`. Ne ćuti.
- `git diff` i `git diff --numstat` **ćute**, jer git normalizuje pre poređenja.
- `git ls-files --eol -- <put>` **imenuje stvar**: pređe sa `w/crlf` na `w/lf`.

Dakle ` M` uz prazan `git diff` **nije** zaostala mutacija nego promenjen prelom reda, i obrnuto se
ne sme pretpostaviti: kad ` M` jednom jeste prava zaostala mutacija, ovo razlikovanje je jedino što
to razdvaja.

**Zašto to nije kozmetika:** obrazac koji prelazi preko preloma reda posle konverzije **više se ne
nađe**, pa serija stane na pola a izgleda kao da je prošla. Jednolinijski obrasci se i dalje nalaze,
pa serija ume da se nastavi nad fajlom koji je već prepisan; izmereno na jednom fajlu, isti obrazac
9 puta jednolinijski a 0 puta produžen preko preloma.

**Prelom reda NIJE isti za ceo repo, i slepo prevođenje u CRLF kvari 25 fajlova.**
`backend/.gitattributes` drži `/mvnw` i **`src/main/resources/db/migration/*.sql` na `eol=lf`**, sa
zapisanim razlogom: generisana migracija mora bajt za bajt da bude ono što je
`backend/tools/generate_reference_migrations.py` napisao. Za te fajlove je blob **jednak** radnom
stablu i sirovi bajti su tačno ono što treba.

Broj se **pita gitu, ne pamti**: `git ls-files --eol | grep -c "attr/text eol=lf"` daje danas **25**
(`backend/mvnw` i 24 migracije). Pita se **`attr/` kolona, a ne `w/`**, i to je merena razlika:
`w/` kaže šta je na disku **ovog trenutka**, pa dva radna stabla istog commita daju različite brojeve
(izmereno isti dan: 717 naspram 694 `w/crlf`, uz isti ukupan broj fajlova). `attr/` kaže šta
`.gitattributes` **propisuje**, i to je isto svuda.

**Vraćanje se NE PIŠE RUKOM. Pita se git, jednom komandom, bez ijedne grane:**

```
git checkout -- <put>
```

**Ovo je četvrti oblik ovog pasusa i prva tri su pala iz istog razloga:** svaki je pokušavao da
**rekonstruiše** ono što git ionako ume da uradi. Prvi je normalizovao „za svaki slučaj" i time
kvario fajlove sa usamljenim `CR`. Drugi je granao po `git ls-files --eol` i promašivao, jer ta
kolona opisuje **disk ovog trenutka**. Treći je istu kolonu čitao **pre** mutacije, pa i dalje
promašivao kad na disku zatekne **tuđu zaostalu** mutaciju iz serije koja je ranije pukla. Klasa je
jedna: prelom reda nije svojstvo koje se pogađa nego odluka koju git donosi iz `.gitattributes`,
`core.autocrlf` i sadržaja, i **jedini koji je pouzdano zna je git**.

**Izmereno po jednim fajlom iz svake klase koju repo ima** (`w/crlf`, prikovan `w/lf`, `w/-text`,
`w/none`), i to **iz najgoreg stanja**, zaostala tuđa mutacija pa nova preko nje: vraćeno
bajt-tačno u sva četiri, 2264, 4643, 3690 i 1.277.008 bajtova, izlazni kod nula i `git status`
prazan.

**Jedina opasnost, i zato stoji ovde a ne u fusnoti:** `git checkout -- <put>` **briše svaki
neupisan rad nad tim fajlom**. Zato se pušta **isključivo nad putanjom koju je serija sama
mutirala** i nikad nad fajlom u kom stoji nešto što nije commitovano. Ko to ne može da garantuje,
commituje pre serije. I još jedna razlika koja ume da iznenadi: `git checkout --` vadi iz
**indeksa**, a ne iz `HEAD`; ako je nešto stejdžovano, to su dve različite stvari.

**Sadržaj i dalje dolazi iz gita a ne sa diska**, i sada je to isto merenje: komanda iznad ne gleda
radno stablo uopšte, pa zatečena mutacija ne može da postane osnova.

**Provera posle serije:** `git status --porcelain` mora da bude **prazan**. To je jedina provera
koja hvata i sadržaj i prelom reda, jer `git diff` o prelomu reda ćuti.

### 3. `Nothing to compile` daje ZELEN prolaz nad kodom koji nikad nije preveden (25.09.2026)

Nadjeno na recenziji PR-a 370, i to je **treci oblik** iste klase: merenje koje izgleda uredno a nije
merilo ono sto tvrdi. Za razliku od prva dva, ovaj kvari **zeleni** ishod, ne crveni.

**Sta se desilo.** Mutacija je upisana u Java fajl, prolaz je pusten, i u izlazu je stajalo
`[INFO] Nothing to compile - all classes are up to date`. Paket je bio **zelen o kodu koji nikad
nije preveden**, sto se sa strane ne razlikuje od mutacije koju nijedan slucaj ne hvata. Ista
mutacija (evro granica 1000 → 1001), posle brisanja `target/classes` i `target/test-classes`, daje
**cetiri pada**.

**I drugi oblik istog uzroka:** `git status --porcelain` pusten **odmah** posle `git checkout -- <put>`
odgovorio je **cisto dok je mutacija jos bila na disku** — dokazano `git diff`-om koji je pokazao
izmenjen red — a drugi put je prijavio prljavim fajl koji to nije bio.

**Najverovatniji uzrok je OneDrive sinhronizacija nad radnim folderom**, koja pomera vreme izmene
fajla, pa Maven misli da je prevod svez a git da je stablo cisto. Nije dokazano do kraja i zato stoji
kao najverovatniji uzrok a ne kao cinjenica.

**Sta se radi:**
- **Pre svakog prolaza u seriji mutacija brisu se `target/classes` i `target/test-classes`.** Bez
  toga zelen ishod ne znaci nista.
- **Vracanje se proverava sa `git diff`, ne samo `git status`**, i **dva cista citanja razmaknuta
  dve sekunde**. Jedno citanje odmah posle vracanja moze da slaze u oba smera.
- **Zeleni ishod u seriji mutacija je sumnjiv dok se ne pokaze da je prevod stvarno tekao.** Trazi se
  red koji imenuje broj prevedenih razreda; `Nothing to compile` nije merenje.

**Sta ovo NE obara:** seriju u kojoj **svaka** mutacija pada. Pad dokazuje da je prolaz stvarno
merio. Ugrozen je samo zeleni ishod, dakle bas onaj na osnovu kog se zakljucuje „ovu rupu niko ne
cuva".

### 4. Golo `bash` zvano iz Pythona razresava u WSL, i pad izgleda kao uhvacena mutacija (26.09.2026)

Cetvrti oblik iste klase, nadjen na grani `b102`. Serija mutacija je vratila **„uhvaceno" za svih
14**, uz izlazni kod 1 — i **nijedan slucaj nije bio pokrenut**.

**Uzrok:** `bash` zvan iz Pythona na ovoj masini razresava u `C:\Windows\system32\bash.exe`, dakle u
**WSL**, koji je odgovorio `execvpe(/bin/bash) failed`. Git Bash je na
`C:\Program Files\Git\usr\bin\bash.exe`, sto `cygpath -w /usr/bin/bash` i kaze.

**Sta ga je uhvatilo:** **odsustvo ijednog reda `Tests run:`**. Izlazni kod je bio nenulti, sto je po
starom merilu „mutacija pala"; jedino je taj red razdvojio merenje od nepokrenute komande.

**Postupak:** skripta koja pusta mutacije **odbija da donese sud bez reda `Tests run:`**, i to je
tvrdo pravilo a ne provera na kraju. Ako reda nema, ishod je **„nije merено"**, nikad „uhvaceno".

**Cetiri oblika iste klase do danas**, i svi izgledaju kao uredno merenje:

| oblik | kvari |
|---|---|
| `mvnw.cmd` bez `./` ne krene | **crven** ishod, izgleda kao uhvacena mutacija |
| prelom reda posle vracanja iz `git show` | seriju, tiho, na pola |
| `Nothing to compile` nad neprevedenim kodom | **zelen** ishod, izgleda kao rupa koju niko ne cuva |
| golo `bash` iz Pythona razresi u WSL | **crven** ishod, izgleda kao uhvacena mutacija |

**Nijedan se ne vidi bez reda `Tests run:`.** To je jedina provera koja hvata sva cetiri.

### I dalje važi, i nalazi se ovde da se ne traži na dva mesta

- Vraćanje ide u `finally`, da pad skripte ne ostavi mutaciju za sobom.
- Čita se i piše **binarno**; `text=True` na Windowsu dekodira cp1252 i tiho kvari srpska slova.
- **Kad mutacija „padne", gleda se i ZAŠTO.** Poruka o dizanju kontejnera, portu, vezi ili isteku
  nije merenje nego infrastruktura. `Errors:` jednak broju `Tests run:` je skoro uvek
  infrastruktura, a **ista mutacija puštena dvaput mora da da isti broj**.

  **Dopuna 27.09.2026, nasao agent na `b114`: to merilo ima izuzetak i on je predvidljiv.** Kad
  mutacija obori **samu migraciju**, **svaki** slucaj tog razreda padne u pripremi, pa `Errors`
  postane jednak `Tests run:` **a merenje je stvarno**. Izmereno: mutacija je vratila `Errors: 7` uz
  `Tests run: 7`, sedam puta `already exists` i **nula** poruka o kontejneru, portu ili vezi.

  **Dakle brojevi ne razdvajaju, razdvaja PORUKA.** `already exists`, `violates check constraint`,
  `syntax error` i slicno su **merenje**. `Could not start`, `Container startup failed`,
  `Connection refused`, `Timeout` su **infrastruktura**. Broj je prvi filter, poruka je odluka.

## `pg_stat_activity` ume da prijavi `idle` za bekend koji stvarno čeka na red-lock (21.09.2026)

Nađeno pri pisanju testa koji namerno drži `select ... for update` da bi prisilio dva zahteva da se
sudare na `write()`-ovom `update ... where state = 'waiting'`, umesto da se to prepusti
`CyclicBarrier`-u i nadi da će se poklopiti (`VerificationDecisionConcurrencyTest`,
`theLoserMeetsARowAlreadyClaimedEveryTimeAndNotOnlyWhenTheSchedulerRaces`).

**Prvi pokušaj je gledao `state = 'active'` i `query ilike '<tekst update-a>'`.** Ni jedan uslov
nije nikad pogodio, deset sekundi zaredom, iako su oba `Future` objekta ostajala `done=false` sav
to vreme - dokaz da su zahtevi stvarno bili zaustavljeni, ne završeni.

**Šta `pg_stat_activity` stvarno pokazuje dok su tako zaustavljeni:** oba bekenda nose
`state = idle`, a `query` i dalje pokazuje **prethodnu, davno završenu** komandu
(`SET application_name = ...`), ne `update` koji ih drži. Jedini trag koji se pouzdano menja je
par `wait_event`: jedan `tuple`, drugi `transactionid` - tačno redosled kojim Postgres reda
DRUGOG čekača na red-lock iza prvog, pa je to i jedini dokaz da je red stvarno bio zaustavljen na
tom redu i ni na čemu drugom.

**Šta se radi:** broji se `wait_event_type = 'Lock' and pid <> pg_backend_pid()`, bez ijednog
uslova nad `state` ili `query`. `pg_backend_pid()` isključuje sopstvenu konekciju koja postavlja
pitanje; ništa se ne pretpostavlja o tome kako `state`/`query` izgledaju dok je bekend stvarno
zaustavljen, jer je upravo ta pretpostavka ono što je ovde palo.

## 11. Ogranicenje koje ne prezivljava ZATECENE podatke je nevidljivo svakom paketu koji podatke sam pravi (27.09.2026)

**Ovo je prvi kvar ove nedelje koji je stigao do servera i oborio ga.** Nije nadjen recenzijom, nije
nadjen mutacijom, i nije nadjen kapijom. Nadjen je time sto je QA **pao**.

**Sta se desilo.** `V35` dodaje tri kolone na `membership` i pet ogranicenja, medju njima
`membership_free_of_the_fee_says_who`, koje trazi `decided_by_name is not null` kad je
`basis = 'feeExempt'`. Grana je prosla **pun krug nezavisne recenzije** (26 mutacija, 23 uhvacene),
punu kapiju sa **3053 slucaja i pragom pokrivenosti**, i spojena je.

**Na QA je Flyway pao**, doslovno: `ERROR: check constraint "membership_free_of_the_fee_says_who" of
relation "membership" is violated by some row`. `flyway_schema_history` staje na **34**, bekend ulazi u
petlju restartovanja, `/api/competitors` vraca **502**, a staticna strana i dalje vraca 200 — dakle
portal **izgleda** ziv a nista ne radi.

**Red koji je obara je jedan i stvaran:** `1 | 2027 | feeExempt | (null)`. Clanstvo upisano **pre nego
sto su kolone traga postojale**.

### Zasto nijedna postojeca provera ovu klasu ne hvata, i to je po konstrukciji

- **Testcontainers krece od PRAZNE baze.** Svaki slucaj sam upisuje redove, i pise ih tako da nova
  ogranicenja zadovoljavaju — jer ih autor pise **posle** ogranicenja i zna sta traze.
- **Spisak mutacija meri da li ogranicenje ima cuvara**, ne da li migracija prezivljava podatke koji
  vec stoje.
- **Prag pokrivenosti meri izvrseni kod**, a migracija se izvrsava potpuno i na praznoj bazi.
- **Cetiri poda nad semom** (`MembershipConstraintsTest`, `MigrationsAreImmutableTest`,
  `KeysAndIndexesTest`, `CompetitorEventRaceAndResultTest`) svi rade nad **svezom** bazom.

**Dakle svih pet nasih alata radi nad bazom koju smo sami napravili, a kvar postoji samo nad bazom koju
nismo.**

### Sta se od danas radi

**Svaka migracija koja dodaje `check`, `not null`, `unique` ili strani kljuc dobija slucaj koji je meri
NAD REDOVIMA KOJI VEC STOJE.**

**Oblik je „migracija se izvrsava nad redovima koji su vec stajali", a KAKO se to postize je vec resено
u portalu i ne izmislja se.** ~~Pusti migracije do prethodne verzije, upisi redove, pa pusti ostatak.~~
**[ISPRAVLJENO 27.09.2026, isti dan, nasao agent na `b122`.]** Ta klauzula je propisivala **stepenovan
Flyway**, a ja sam istog dana drugom agentu **izricito odobrio drugi oblik**, pa bi portal dobio dva
oblika za istu klasu i recenzent bi prijavio PR kao neusaglasen sa pravilom napisanim tog jutra.

**Presedan koji se prepisuje:** `db/MembershipCarriedOverTest` i `db/LeagueRacesCarriedOverTest`, oba
nad **istom** tabelom o kojoj je rec. Oblik je: **ponisti ono sto je migracija napravila**, upisi redove
kakve prava baza nosi, pa **izvrsi samu migraciju** kroz `DatabaseTest.migrationSql(version)`, koji fajl
trazi od Flyway-a a ne od kopije izjava. Sve u transakciji testa.

- **Jeftinije je i izmereno:** ne trazi drugi kontejner ni ponovno pustanje trideset i cetiri
  migracije, a `V3` je 47016 gradova i na njega ide vecina minuta.
- **Ponistavanje NE SME da bude rucno pisan spisak.** Jedna izjava `alter table ... drop column ...
  cascade` nad kolonama koje migracija dodaje; zavisnosti racuna PostgreSQL, pa postavka imenuje samo
  ono sto je izmena stvarno dodala.
- **Pod nad samom postavkom je ponasanje, ne upit nad katalogom:** to sto zatecen red **prolazi** jeste
  dokaz da je ponistavanje bilo potpuno, jer bi ga svako prezivelo ogranicenje odbilo.
- **Ponistavanje ne ide u `@BeforeEach`** ako isti razred meri i **semu koju repo isporucuje**: ti
  slucajevi ne smeju da vide semu koju je test rasturio.

**Sta znaci „zateceno stanje", i to se ne pogadja nego cita sa servera:** pre nego sto se ogranicenje
napise, pusti upit nad **pravom** bazom i vidi koji redovi u toj tabeli stoje. Za `membership` je
odgovor bio **jedan red, i taj jedan ga obara**.

**Provera pre commita migracije, jedna recenica:** da li bi ovo ogranicenje proslo na bazi koja vec ima
redove **koje nije napravio moj test**? Ako odgovor nije „izmerio sam", migracija nije gotova.

### I jedno pravilo o popravci, jer je i ono izmereno istog dana

**Migracija koja je PALA nije primenjena, pa se sme menjati u mestu.** `ADL` A2 stiti **primenjene**
migracije, jer njihov kontrolni zbir stoji u `flyway_schema_history`. Migracija koja pada nije upisana
nigde, a **kasnija migracija joj ne moze pomoci**, jer Flyway pada pre nje i nikad ne stigne dalje.
Dakle menjanje u mestu nije izbor nego jedino sto radi.

- **Uslov se PROVERAVA, ne pretpostavlja:** pre menjanja se pogleda `flyway_schema_history` svake baze
  do koje se moze doci. Ako je migracija negde primenjena, ovaj put ne vazi.
- **U zaglavlje fajla ide doslovna recenica** da je menjan posle spajanja, iz kog razloga, i sto je bio
  uslov. Bez nje sledeci citalac pomisli da se migracije smeju prepravljati.

### I jedno o tome sta popravka NE sme da bude

Prva ideja je bila dopuniti zatecen red imenom onoga ko je oslobodjenje odobrio. **Niko ga nije
odobrio**; red je nastao pre nego sto je pojam traga postojao. Upisati ime bilo koga bila bi **lazna
evidencija o odluci**, i to na zapisu o clanstvu vlasnika portala. Ogranicenje se zato dodaje kao
**`not valid`**: to je istinita izjava da oslobodjenje upisano od dana kad trag postoji imenuje ko ga je
dao, a ono upisano pre toga ne moze. **Granica se zapisuje, podatak se ne izmislja.**

## 13. Mutacija koja mora da POKVARI SQL da bi promenila ponasanje nije mutacija (27.09.2026)

Nadjeno na `b123`. Mutacija je citala prvog takmicara kroz `where id = (select min(id) from
competitor)` i time ostavila vezani `?` **neupotrebljenim**, pa je JdbcClient odbio upit:
`Tests run: 77, Failures: 0, Errors: 17`.

**Sedamnaest izuzetaka iz pokvarenog upita, a o clanu nije izmereno nista.** Prepisana kao
`where id <> ? order by id limit 1`, ista mutacija se hvata sa **pet padova i nula gresaka**.

**Zasto postojeca provera to ne hvata:** merilo je `Errors:` jednak `Tests run:`, a ovde je bilo 17
naspram 77. Brojevi su izgledali kao uredno merenje.

**Provera koja se dodaje:** uz pitanje o brojevima ide i **da li greske dolaze iz upita koji ne moze
da se izvrsi**. `BadSqlGrammarException`, `InvalidDataAccessApiUsageException` i slicno su **kvar
mutacije**, ne nalaz o kodu. Mutacija sme da menja **sta** upit pita, nikad da ga ucini
neizvrsivim.

## 14. `git checkout --` vraca kroz smudge filter, pa se `i/lf` fajl vrati kao `w/crlf` (27.09.2026)

Peti oblik zamke o prelomu reda, i razlikuje se od prva cetiri: nastaje **pri vracanju**, ne pri
citanju.

**Izmereno na `b123`:** obrazac preko dva reda pogodio je fajl na **prvoj** mutaciji, a posle prvog
vracanja tog istog fajla prijavljivao „found 0 times". Isto na tri para mutacija nad tri fajla.
`git ls-files --eol` posle serije daje `w/crlf` na sva cetiri, iako repo fajl drzi kao `i/lf`.

**Uzrok:** `git checkout --` vraca kroz `text=auto` smudge filter, pa dobije prelom reda koji
`.gitattributes` propisuje **za disk**, ne onaj koji je blob nosio.

**Lek nije lukaviji obrazac nego SAMO JEDNOLINIJSKI OBRASCI.** Jednolinijski ubija dva uzroka
odjednom: ne prelazi prelom reda, i ne nosi uvlacenje. Na istoj grani je jedna mutacija pala **i iz
drugog razloga** — pet tabova u fajlu naspram cetiri u obrascu.

**Izuzetak koji i dalje vazi:** `db/migration/*.sql` je prikovan na `eol=lf` kroz
`backend/.gitattributes`, pa je za migracije blob jednak radnom stablu i ova zamka ih ne dodiruje.

## 12. Goli `curl` na upisnu rutu vraca 403 zbog CSRF-a, i to NIJE krsenje A8 (27.09.2026)

Izmereno pri dizanju QA. `POST` na dve nove rute je vratio **403**, a `ADL` A8 trazi **401** za
neprijavljenog. Delovalo je kao regresija.

**Nije.** Izmereno na **zatecenim** rutama pre nego sto je ista prijavljeno:

| poziv | odgovor |
|---|---|
| `POST /api/payments` | **403** |
| `POST /api/sign-in` | **403** |
| `POST /api/me/photo` | **403** |
| `GET /api/payments` | **401** |
| `GET /api/teams/1/applications` | **401** |

`POST /api/sign-in` vraca 403 a prijava ocigledno radi, pa uzrok nije autorizacija nego **CSRF
filtar**: goli `curl` ne nosi `XSRF-TOKEN`, pa Spring odbija zahtev **pre** nego sto pogleda ko
poziva. Telo odgovora je Springov podrazumevani `{"status":403,"error":"Forbidden"}`, bez ijedne nase
recenice, sto je i znak da nasa ruta nije ni bila pozvana.

**Sta se radi pri merenju sa servera:**

- **Upisnu rutu meri `GET`-om** ako samo proverava da li postoji i trazi li prijavu; `GET` prolazi
  kroz lanac i vraca **401**, dakle odgovara na pitanje o A8.
- **403 na `POST` bez tokena se ne prijavljuje kao nalaz** dok se ne proveri da ista adresa na `GET`
  daje 401 i da **zatecena** upisna ruta daje isti 403.
- **Ponasanje same upisne rute se meri u testu**, gde token postoji, ne golim `curl`-om sa hosta.

**Zasto ovo vredi zapisati:** merenje sa servera je jedini nacin da se dokaze da je nesto stvarno
isporuceno, pa ce se raditi i dalje; a ova razlika izgleda tacno kao prekrsena odluka vlasnika.

## Proces

- **Nikad `git add -A` dok recenzija radi u istom radnom direktorijumu.** Recenzent dokazuje nalaz tako što namerno pokvari fajl, pokrene test i vrati ga. Ako se u tom prozoru zapiše sve što je izmenjeno, tuđa privremena mutacija ulazi u commit i CI pada na nečemu što u kodu ne postoji. Desilo se 13.08.2026: član `000004` je za jedan prolaz testa postao platiša i tako gurnut na granu. Zapisuju se **imenovane putanje** onoga što je stvarno menjano, ili recenzija dobija svoj worktree.

- `main` grana prima izmene isključivo kroz PR sa zelenim CI (`.github/workflows/verify.yml`).
- Pre svakog PR-a: pokrenuti oba test paketa lokalno i /code-review prolaz.
- OBAVEZNO pre merge-a netrivijalnog PR-a: nezavisna recenzija kroz subagenta koji NIJE pisao kod. Recenzent dobija isključivo diff i opis PR-a (svež kontekst, bez konteksta autora) i vraća nalaze; kritični i visoki nalazi blokiraju merge dok se ne razreše. Za bezbednosno osetljive izmene (auth, podaci, upload) dodatno i security-reviewer agent.

### 5. `git checkout --` PRE prvog commita brise rad, i to je 27.09.2026 pogodilo TRI agenta u jednom danu

Pravilo „ko to ne moze da garantuje, **commituje pre serije**" stoji u ovom fajlu od 18.09.2026, u
pasusu o vracanju mutacija. **Palo je tri puta u jednom danu**, i to kod tri nezavisna agenta koji
se nisu ni videli:

| grana | sta je odneto | kako je nadjeno |
|---|---|---|
| `b107` | prepis `AdminMembers.tsx`, a **netracked `memberWrites.ts` je OSTAO SA MUTACIJOM** (`DELETE_THE_ACCOUNT = 'anonymise'`) | njegov sopstveni slucaj o upisu |
| `b108` | sve izmene u `ProfilePicture.tsx` | skripta je pukla na prelomu reda, `finally` je vratio |
| `b109` | ceo `CompetitorApi.java`, vracen do `main`-a | `git diff --stat` odmah posle |

**Zasto se ponavlja iako je zapisano.** Pravilo je stajalo kao **napomena uz komandu vracanja**, na
kraju duzeg pasusa, a agent ga cita **posle** nego sto je vec napisao kod. U tom trenutku „commituj
pre serije" zvuci kao urednost, ne kao uslov.

**Dva oblika stete i drugi je gori:**

1. **Vraceno do `HEAD`-a**, dakle nestane sve sto nije commitovano. Vidi se odmah, boli, popravi se.
2. **NETRACKED fajl se ne vrati uopste**, pa **mutacija ostane u njemu**. `git checkout -- <put>`
   nad fajlom koji git ne prati ne radi nista i **ne javlja gresku**. Na `b107` je tako ekran
   nekoliko minuta stvarno slao pogresan parametar, a serija je izgledala uredno.

**Postupak, i od danas ide u SVAKI zadatak, ne u fusnotu:**

- **Commit ide pre prve mutacije, uvek.** Nije stvar urednosti nego uslov da vracanje uopste ima
  gde da vrati. Dovoljan je checkpoint commit; grana se ionako ne spaja bez recenzije.
- **Nov fajl se `git add`-uje pre serije**, makar i bez commita. Netracked fajl je **nevidljiv**
  komandi vracanja, i to je jedini oblik ove greske koji se ne vidi odmah.
- **Posle serije se cita `git diff`, ne samo `git status`.** `git status` o prelomu reda cuti, a
  netracked mutacija se u njemu vidi samo kao `??`, sto lici na uredan nov fajl.

**Cena kad se ne uradi:** tri agenta, tri gubitka rada u jednom danu, i jedan slucaj u kom je
**proizvodni kod nekoliko minuta nosio mutaciju** a merenje to nije prijavilo kao pad.

### I jedno merenje istog dana: `vitest run` NE proverava tipove, `npm run build` proverava

Nadjeno na `b109`. Polje koje je postalo `string | null` je oboreno u `ProfileBio.tsx`, ekranu koji
deli isti tip — i **nijedan test to nije video**, jer `vitest` tipove **skida** (esbuild), ne
proverava ih. Uhvatio ga je `npm run build`, dakle `tsc -b`.

**Sto NE znaci da je „build jaci od testova" uopsteno** — ta recenica je 25.09.2026 vec jednom bila
netacna i recenzija ju je oborila. Znaci tacno ovo: **prolaz testova nije provera tipova**, pa
izmena koja menja **tip** trazi `npm run build` pre nego sto se zakljuci da je gotova.

### 6. `forks` pool vitest-a ume da vrati lazan „no tests" sa izlaznim kodom 1 (27.09.2026)

Sesti oblik iste klase, i **kvari CRVEN ishod**, dakle izgleda kao pad grane.

**Sta je izmereno.** Pun `npm run test:coverage` na ovoj masini je vratio izlazni kod **1** uz
`Timeout waiting for worker to respond`, a redovi `Test Files` i `Tests` su rekli **„no tests"**.
**Nijedan slucaj nije bio pokrenut.** Sa `--pool=threads` isti prolaz je prosao.

**Zasto ovo staro pravilo propusta.** Pravilo trazi **red sa brojem slucajeva** kao dokaz da je nesto
mereno. Ovde taj red **postoji** — samo kaze „no tests". Dakle provera „ima li reda" prolazi, a
merenja nema.

**Sta se dodaje proveri:** red mora da nosi **broj veci od nule**. `Tests no tests` i `Tests 0
passed` su **„nije mereno"**, nikad „zeleno" i nikad „uhvaceno".

**I jedno merilo koje razdvaja ovaj oblik od pravog pada:** poruka `Timeout waiting for worker to
respond` je o **radniku**, ne o slucaju. Kao i `Could not start mail server` i
`Container startup failed`, to je infrastruktura i taj prolaz se ne racuna.

### I dva zatecena fajla koja padaju pod opterecenjem a nisu ničija regresija

- **`frontend/src/pages/Registration.test.tsx`**: 8 padova u punoj seriji, **nula** kad se pusti sam.
  Grana `b118` mu je dala `SLOW` na cetiri najteza slucaja, uz merenje pre i posle pod opterecenjem.
- **`frontend/src/i18n/format.test.ts`**: jedan slucaj sam ispisuje svoj razlog („the zone did not
  move on this machine, so this case measures nothing") — Node na nekim masinama ne resetuje
  kesiranu vremensku zonu posle `process.env.TZ = ...`. Autor je to predvideo; nije nicija regresija.

### 7. Mutacija moze da PREZIVI zato sto je merena u pogresnom RAZREDU (27.09.2026)

Nadjeno na `b116`. Mutacija je prezivela **i posle** nego sto je za nju napisan nov slucaj — a cuvar
je bio ispravan. **Serija je bila usmerena na `MembershipConstraintsTest`, a nov slucaj zivi u
`MembershipWriteApiTest`.**

**Prezivljavanje je time bilo o tome GDE se meri, ne o tome sta cuvar radi.** To je najpodmukliji
oblik koji smo videli, jer se cita kao **nalaz o kodu** a nalaz je o **komandi**.

- **Provera nad svakom prezivelom mutacijom, pre nego sto se proglasi rupom:** da li je slucaj koji
  bi je uhvatio uopste **u razredu koji je pusten**? Ako nije, ishod je **„nije mereno"**, ne
  „preziveo".
- **I obrnuto, o sopstvenoj alatki:** isti agent je istog dana imao **jos jednu** prezivelu koja je
  bila **njegova losa mutacija**, ne rupa: `where id >= ? order by id limit 1` je za svaki nalog u
  postavci vracao **samog pozivaoca**, dakle bila je prazna izmena. **Preziveli su dakle tri
  razlicite stvari** i samo je jedna bila rupa.

### 8. Kapija koja padne na testu NE GOVORI NISTA o pragu pokrivenosti (27.09.2026)

`./mvnw verify` **staje na padu testa pre nego sto `jacoco:check` uopste krene**. Dakle prolaz koji
je pao na jednom slucaju **nije izmerio prag**, i recenica „kapija je pala, valjda i pokrivenost"
nema osnova. Tek **drugi, zelen** prolaz kaze nesto o pragu.

### 9. Spisak podova koje nova migracija OBAVEZNO obara (27.09.2026)

Izmereno na `b116`: cetiri fajla nose pisane spiskove koje nova migracija mora da dopuni, i **dva od
cetiri su nasla ono sto je autor promasio**.

| fajl | sta trazi |
|---|---|
| `db/MembershipConstraintsTest.java` | rusec red za **svako** novo ogranicenje, **kljuceve ukljucujuci** |
| `db/MigrationsAreImmutableTest.java` | kontrolnu sumu koju **Flyway sam izracuna**, poredjenu u oba smera |
| `db/KeysAndIndexesTest.java` | svaki nov kljuc i indeks |
| `db/CompetitorEventRaceAndResultTest.java` | svaki nov strani kljuc i njegovo ponasanje pri brisanju |

**I jedno pravilo o redosledu koje je iz toga ispalo:** kontrolna suma migracije se prikiva
**POSLEDNJA**, kad je fajl konacan. Commit koji posle toga ispravi i jednu recenicu u zaglavlju
menja bajtove, pa kapija padne na sumi koja je bila tacna kad je pisana.

### 10. Presek je i RED U SPISKU VIOLACIJA, i taj pad imenuje pogresnu stvar (27.09.2026)

Sedma klasa preseka, i najteza za citanje. Do danas smo brojali fajlove, tabele, fiksne portove,
recnike, odluke u izvrsavanju i scratchpad.

**Sta je izmereno.** Grana `b116` dodaje ogranicenje koje trazi trag uz oslobodjenje od clanarine.
Grana `b114` u testovima upisuje **pet** takvih redova **bez traga**, u cetiri fajla. Jedan od tih
pet **nije obicna postavka nego red u spisku VIOLACIJA**: on ocekuje da padne na **odredjenom**
ogranicenju, a posle spajanja pada na **tudjem**.

- **Zasto je bas taj oblik najgori:** test **padne**, dakle ne prolazi tiho — ali poruka imenuje
  **pogresno ogranicenje**, pa covek koji je cita trazi kvar tamo gde ga nema.
- **Provera koja se dodaje:** ako grana dodaje ogranicenje, pretrazi `src/test` i po **redovima koji
  namerno krse** ogranicenja te tabele, ne samo po `insert into`. Red koji krsi **dva** ogranicenja
  ne govori nista ni o jednom.
- **Red spajanja se bira po tome gde popravka pada:** prva ide grana posle koje popravka pada na
  stranu koja **tek treba da prodje kapiju**, ne na onu koja je vec zelena.

## 15. `gh pr checks` nenultim kodom kaze NEDOVRSENO, a kod nas nenulti kod znaci PAD (27.09.2026)

Osmi oblik klase „merenje koje izgleda uredno a nije merilo ono sto tvrdi", i jedini kod kog je
**znak obrnut** od svega ostalog kod nas.

**Sta je izmereno, na PR-u 397.** Agent je cekao CI petljom napisanom kao „dok **ijedan** red nije
`pending`". Bekend je prosao za pet minuta, uslov je time bio zadovoljen, i **petlja je izasla dok je
frontend jos radio** — jos skoro sest minuta. Da je procitan samo tekst ispisa, prijavljen bi bio
gotov CI nad poslom koji nije zavrsen.

**Sta ga je uhvatilo:** izlazni kod procitan **iz fajla** bio je **8**, ne 0. Ispis je pritom
pokazivao jedan uredan `pass`.

- **`gh pr checks` izlaznim kodom 8 kaze „ima nedovrsenih", ne „palo je".** Svuda drugde kod nas
  nenulti kod znaci pad, pa ko ga procita po navici zakljuci **suprotno od istine**: ili da je CI pao
  kad nije, ili, gore, prekine cekanje i prijavi gotovo.
- **Pravilo koje vec stoji i ovde je bilo jedino sto je radilo:** izlazni kod se cita **iz fajla**,
  nikad kroz cev i nikad iz obavestenja o pozadinskom zadatku.
- **Uslov cekanja se pise nad prisustvom, ne nad odsustvom:** „dok **ijedan red sadrzi** `pending`,
  cekaj". Oblik „dok ijedan red **nije** pending" je zadovoljen prvim poslom koji zavrsi.
- **I zato `gh pr checks` nikad nije cuvar petlje sam po sebi.** Dok ista visi, on je nenulti; dakle
  ne razlikuje „jos traje" od „palo" bez citanja teksta.

## 16. Cetiri oblika laznog merenja nadjena 27.09.2026, sva cetiri na frontend kapiji

Uz cetiri koja vec stoje gore, danas su izmerena jos cetiri. **Nijedan se ne vidi bez broja uz
`passed`.**

### 16a. `-t` filter koji ne pogodi ime: `skipped` uz izlazni kod NULA

Agent je pustio `vitest -t "next member"` da izmeri jedan slucaj. Filter nije pogodio ime, pa je izlaz
glasio **`Tests 7 skipped (7)`**, izlazni kod **0**.

**To prolazi obe nase provere odjednom:** red **postoji**, broj je **iznad nule**, kod je **nula**. A
nijedan slucaj nije bio pokrenut.

- **Merilo:** broj uz **`passed`** mora biti veci od nule. `skipped`, `no tests` i `0 passed` su
  **„nije mereno"**, bez obzira na izlazni kod.
- **Gde se javlja:** ime slucaja se promeni, filter ostane, i od tog trenutka je svako merenje tim
  filterom prazno a izgleda zeleno.

### 16b. Odsustvo reda `All files` NE znaci da prag nije meren

Agent je trazio `All files` u ispisu pokrivenosti, nije ga nasao, i procitao to kao „prag nije ni
ocenjen". **Tabela lista samo fajlove ISPOD praga**, pa je prazna **upravo zato sto ih nema**.

**Dokaz da je merenje teklo** je red `Coverage enabled with v8` **plus apsolutni brojevi u sazetku**
(`Statements : 100% ( 5608/5608 )`), nikad prisustvo tabele.

**Ovaj oblik greska vuce u OBRNUTOM smeru od ostalih:** nateruje te da **zelen** ishod proglasis
nemerenim.

### 16c. `npm run test:coverage` je DVE komande sa `&&`, pa pad prve preseca drugi dan

Skript je `vitest run --coverage && npm run test:another-day`. **Prolaz koji padne na pragu nije
izmerio drugi dan uopste**, iako izgleda kao da je pusten ceo. Ko hoce oba merena, pusta ih kao **dve
komande sa dva izlazna koda**.

### 16d. Vitest se pusta iz `frontend/`, ne iz korena worktree-a

Test koji cita `src/test/mock` inace pukne sa `ENOENT: no such file or directory, scandir` i vrati
**`Tests no tests`** uz izlazni kod 1, sto izgleda kao pad grane a nije.

## 17. Git Bash pretvara obrazac sa vodecom kosom crtom u Windows putanju (27.09.2026)

Kvari **prazan** ishod, dakle najgori smer: izgleda kao da necega nema.

| komanda | odgovor | zasto |
|---|---|---|
| `git log --all -S'/decision' -- frontend/src` | **0** | obrazac pretvoren u `C:/Program Files/Git/decision` |
| `MSYS_NO_PATHCONV=1 git log --all -S'/decision' -- frontend/src` | **6** | isti upit, bez pretvaranja |
| `git grep "/decision" origin/main` | **0** | isto pretvaranje |
| `git grep "api/verification/" origin/main` | **sest fajlova** | obrazac ne pocinje kosom crtom |

**Uzrok je mehanicki:** Git Bash to radi svakom argumentu koji pocinje kosom crtom pre nego sto ga
preda **nativnom** programu. `git.exe` je nativan; `grep` je MSYS pa njegov obrazac nije diran —
**zato `grep` radi a `git grep` laze**.

- Svaki `-S`, `-G` ili obrazac za `git` koji pocinje kosom crtom pise se **bez nje** ili uz
  **`MSYS_NO_PATHCONV=1`**.
- **Nula iz `git grep` ili `git log -S` nad takvim obrascem nije nalaz nego nemerenje.**
- **I druga polovina iste greske:** merenje u radnom stablu koje je **13 commita iza** `origin/main`.
  Pre svake tvrdnje o tome cega u kodu nema, `git fetch` pa pitaj **`origin/main`**, ne svoj disk.

**Cena kad se ne uradi:** vlasniku je prijavljeno da ekran ne ume da upise odluku, a ume i radi.

## 18. „Commituj pre prve mutacije" je pogresna formulacija: commit ide pre SVAKE serije (27.09.2026)

Pravilo stoji od 18.09.2026 i danas je **cetvrti put** koga kosta rada. Prva tri puta su bili agenti
koji nisu commitovali uopste. **Cetvrti je drugaciji:** agent je **commitovao pre prve serije**, kako
pravilo kaze, pa **dopisao kod** i pustio **drugu** seriju bez novog commita. `git checkout HEAD --`
je vratio fajl na stanje koje nov slucaj nije sadrzalo, i slucaj je nestao.

- **Commit ide pre SVAKE serije.** „Pre prve mutacije" se cita kao jednokratna priprema, a opasnost se
  vraca **svaki put kad se doda kod**.
- **Provera je mehanicka:** pre serije `git status` mora da bude **prazan**.
- **Pravilo koje se moze ispuniti a ipak izgubiti rad je pogresno napisano**, ne pogresno sprovedeno.

## 19. Cekanje nadzivi agenta koji ga je pokrenuo (27.09.2026)

**Dvaput u jednom danu**, i oba puta je vlasnik primetio pre mene: ujutru je prolaz stajao **10 sati i
29 minuta**, uvece petlja **3 sata i 59 minuta**.

**Izmereno kad je pogledano:** **nula** Java procesa, dakle nijedna kapija nije radila; ziv **jedan**
agent star cetiri minuta, a ljuske od **14:31 i 14:44**. Cetiri sirocica agenata koji su odavno
zavrsili.

- **Cekanje koje agent pokrene mora da se zavrsi PRE nego sto preda izvestaj.** Ako mora da preda
  ranije, to izricito kaze.
- **Provera je mehanicka:** `Get-Process bash,sh` sa `StartTime` uporedjen sa spiskom zivih agenata.
  **Svaka ljuska starija od sat vremena koja ne pripada nijednom zivom agentu je siroce i gasi se.**
  Uz nju `Get-Process java,node`: ako ih nema, nijedna kapija ne radi i cekanje nema sta da ceka.

## 20. Cetiri oblika laznog merenja u kojima je kvar u CITACU, ne u komandi (27.09.2026 uvece)

Devetnaest oblika iznad kvare **komandu**: ne krene, razresi u WSL, ne prevede, preseca se na `&&`.
Cetiri nadjena uvece 27.09.2026 su drugacija klasa: **komanda je uredno merila, a presuda o njenom
ispisu je bila pogresna.** Zato ih nijedna postojeca provera ne hvata: sve nase provere gledaju
**ispis**, a ovde je pokvaren **citalac ispisa**.

### 20a. `grep` bez `-a` pretvara UHVACENU mutaciju u „nije mereno"

Nadjeno na `b136`. Log prolaza nad razredom koji tvrdi nad **nizovima bajtova** nosi **sirove JPEG i
PNG bajtove**, jer ih AssertJ ispise u poruku pada. `grep` fajl zato proglasi binarnim i ispise
`Binary file ... matches` **umesto reda**, pa provera „ima li red `Tests run:` sa brojem iznad nule"
vrati **prazno**, i presuda postane **„nije mereno"** nad mutacijom koja je uredno pala sa
`Tests run: 12, Failures: 1` i izlaznim kodom 1.

**Zasto je gori od svih osamnaest pre njega:** ostali kvare **ishod**, ovaj kvari **presudu o
ishodu**, pa se procita kao „ovu rupu niko ne cuva" nad rupom koja **ima** cuvara. Vodi na pisanje
testa koji vec postoji.

**Lek je jedno slovo: `grep -a`**, uvek, nad svakim logom koji bi mogao da nosi binarne bajtove.

### 20b. Parser koji trazi `Tests run:` na POCETKU reda nikad ne pogodi, jer surefire pise `[INFO]`

Nadjeno na `b137`. Skripta je proveravala `part.startswith("Tests run:")`, a surefire ispisuje
`[INFO] Tests run: 38, ...`. Ukupan broj je time ostajao **0**, pa je **svaka** mutacija bila
„`Tests run: 0`", dakle **„nije mereno"** za svih sedamnaest.

**Sta je radilo, i zato se tako i pise:** pravilo je formulisano tako da **odbije sud** kad ne vidi
broj, pa je palo u **bezbednom smeru**. Da je bilo napisano obrnuto (pretpostavi izmereno), bilo bi
prijavljeno sedamnaest uhvacenih mutacija nad merenjem koje se nije desilo.

**Provera koja iz toga sledi:** **parser ispisa se pusti nad zatecenim ZELENIM I CRVENIM logom pre
serije.** Cetiri stanja (`zelen`, `crven`, `bez reda`, `nula slucajeva`) moraju da daju cetiri
razlicita suda. Traje deset sekundi.

### 20c. `rm -rf target/classes target/test-classes` NE cisti `target/surefire-reports`

Nadjeno na `b135`. Citanje brojeva iz tog foldera zato pokaze **razrede koje taj prolaz nije ni
pokrenuo**, pa izgleda kao da je sve proslo. **Ovaj laze u ZELENOM smeru**, dakle u onom na osnovu kog
se zakljucuje „ovu rupu niko ne cuva".

**Postupak:** pre svakog prolaza u seriji brisu se **sva tri** foldera, `target/classes`,
`target/test-classes` **i** `target/surefire-reports`.

### 20d. `./mvnw -q test` na USPESNOM prolazu ne ispise zbirni red uopste

Nadjeno na `b135`. Dakle **`-q` i pravilo „presuda trazi red sa brojem slucajeva" ne idu zajedno**, i
prolaz pusten sa `-q` je po nasem merilu „nije mereno" iako je stvarno merio.

**Postupak: `-q` se ne koristi u seriji mutacija.** Ispis ide u fajl pa se fajl cita; velicina loga
nije problem koji `-q` treba da resava.

## 21. Bekend grana koja BRISE konstantu mora da pusti i FRONTEND kapiju (27.09.2026)

Osma klasa preseka, i razlikuje se od prethodnih sedam time da presek **nije u fajlu** nego u
**izvedenom podu koji cita tudji izvorni kod**.

**Sta se desilo.** Grana `b136` je cisto bekend: obrisala je konstantu `A_PICTURE_ALREADY_WAITS` iz
`MePhotoApi.java`, jer je vlasnik odlucio da ponovno slanje slike **pregazi** red koji ceka umesto da
bude odbijeno sa 409. Grana **nije dirnula nijedan frontend fajl**, pa je i njena kapija bila samo
bekend, a nezavisna recenzija je merila bekend razrede. **Bekend CI je prosao, frontend je pao.**

**Pad, doslovno:**

    FAIL src/pages/account/refusals.test.ts > the reasons the server can name
         > are all answered on the screen that meets MePhotoApi.java
    AssertionError: expected [ 'theFormIsNotComplete', ...(6) ] to have a length of 6 but got 7

    FAIL ... > and the screens claim no reason their route cannot answer
    AssertionError: expected [ 'aPictureAlreadyWaits' ] to deeply equal []

**Uzrok.** `refusals.test.ts` je **izveden pod**: cita **svaku** odbijenicu koju `MePhotoApi.java`
deklarise i trazi da ekran nosi **tacno njih, u oba smera**. Ekran je i dalje nabrajao ukinutu, pa je
pao sa obe strane odjednom.

- **Nalaz je bio prijavljen kao NIZAK**, uz recenicu „izmerio sam da im kapija ne pada". **Ta recenica
  je bila netacna, i to je najvazniji deo ove pouke:** mereno je nad `i18n/keys.test.ts`, koji trazi
  da kljuc **postoji** za ono sto kod cita, a pao je **drugi** pod, onaj koji trazi **tacnu jednakost
  skupa**. **Merenje nad jednim podom ne govori nista o drugom podu nad istom cinjenicom.**
- **Provera koja iz ovoga sledi:** kad grana **brise ili preimenuje** konstantu, enum vrednost ili
  ime greske na bekendu, pretrazi `frontend/src` po **imenu te konstante** i po **imenu Java fajla**
  koji je deklarise. Svaki pod koji imenuje bekend fajl je presek, i onda kad grana ne dira nijedan
  frontend fajl.
- **I obrnuto:** grana koja **dodaje** konstantu obara isti pod iz drugog smera (ekran nabraja manje
  nego server), pa pravilo vazi u oba smera.

## 22. `git reset --hard` posle NEUSPELOG push-a brise commit koji si upravo napravio (27.09.2026)

**Ovo je moja greska, ne agentova, i zato stoji ovde.**

`gh pr update-branch` je spojio `main` u granu **na serveru**. Moj `git push` je zato odbijen
(`non-fast-forward`), i ja sam odmah pustio `git reset --hard origin/<grana>` da uzmem serverovo
stanje. Time je **commit sa ispravkom visokog nalaza otisao**, jer nikad nije stigao do servera.

- **Uzrok nije komanda nego REDOSLED:** `update-branch` pomera granu na serveru, pa lokalna grana
  postaje razlicita, pa push pada, pa reset uzima serverovo stanje **i odbacuje lokalno**.
- **Nadjeno odmah** jer je `git merge-base --is-ancestor` vratilo „nije u HEAD-u", i vraceno jednim
  `git cherry-pick`-om, jer commit i dalje stoji u objektnoj bazi.
- **Postupak:** **push ide PRE `update-branch`-a, ne posle.** Ako je push vec odbijen, umesto reseta
  se pusta `git merge origin/<grana>` ili se posle reseta **odmah proveri** da li je commit predak
  HEAD-a, i cherry-pick ako nije.
- **Provera koja je mehanicka:** posle svakog reseta nad granom na kojoj je bilo lokalnog rada,
  `git log --oneline origin/main..HEAD` mora da nabroji **sve** commite koje ocekujes. Ako ih je
  manje, nesto je odbaceno i stoji u reflogu.

## 23. Prag pokrivenosti je nasao mrtvu granu koju spisak mutacija po konstrukciji ne vidi, drugi put istog dana (27.09.2026)

Pravilo od 25.09.2026 kaze da mutacija meri **da li nesto sto radi ima cuvara**, a ne **da li nesto
uopste radi**, i da za drugo pitanje postoji samo prag pokrivenosti. Danas je to potvrdjeno drugim
merenjem, na `b134`.

**Sta je bilo.** `useInbox` je racunao pozivaoca **iz sesije** i odgovarao `null` kad ga nema. Ta
grana je **nedostizna**, jer sva tri poziva kapiraju pre crtanja. Nijedna od osamnaest mutacija je
nije videla; prag je pao i imenovao je.

**Resenje je bilo da broj clana postane ARGUMENT**, ne da se doda slucaj koji gadja nedostiznu granu.
Kad grana ne moze da se dosegne kroz proizvodni put, ne pise se test koji je dosegne zaobilazno nego
se **grana ukloni**, a pitanje preseli tamo gde odgovor vec postoji.

**Merilo koje iz toga sledi:** kad kapija padne na pragu a svi testovi su zeleni, prvo pitanje nije
„koji test nedostaje" nego **„koji kod se ne izvrsava i zasto postoji"**.

## 24. Podovi nad CELIM portalom ne stoje u folderu koji diras, pa ih usko merenje nikad ne pokrene (28.09.2026)

Nadjeno na `b141`. Grana je usko merena po fajlovima koje dira, sve je bilo zeleno, i **puna kapija
je pala na tri poda**. **Sva tri su bila moja, sva tri se reprodukuju i kad se fajl pusti sam**,
dakle nijedan nije opterecenje niti zatecen krhak fajl.

**Klasa je jedna i po konstrukciji je nevidljiva uskom merenju:** pod koji pita nesto o **celom
portalu** ne zivi u folderu u kom radim. `styles/scale.test.ts` cita svaki `.css` koji repo ima,
`data/servedAge.test.ts` cita svaki fajl pod `test/mock`, `styles/writtenInCode.test.ts` cita svaki
nacrtani izvor. Pravilo „pusti fajlove koje si menjao" ih **nikad** ne pokrene, a **tri od tri**
pada su bila tamo.

### Sta NIJE lek

**Puna kapija posle svake izmene.** To je vec izmereno kao preskupo i to merilo ostaje: prolaz traje
oko **11 minuta**, a spisak mutacija po grani ima **8 do 13** stavki, pa bi to bilo sat i po do dva i
po cistog pokretanja testova po agentu. Ovo pravilo se ne sme procitati kao poziv da se kapija pusta
uvek.

### Sta JESTE lek

**Uz fajlove koje menjam pustam i podove nad KLASOM stvari koju dodajem.** Ne nad celim paketom, nego
nad onim sto je nova vrsta stvari:

| sta dodajem | sta uz to pustam |
|---|---|
| nov `.css` fajl ili novo pravilo u postojecem | `src/styles/` |
| novo polje koje ruta servira, ili izmena u `test/mock` | `src/data/servedAge.test.ts` |
| nov atribut u nacrtanom izvoru (`aria-*`, `data-*`) | `src/styles/writtenInCode.test.ts` |
| nov kljuc recnika | `src/i18n/` i oba snimka recnika |
| nova mapa odbijanja sa ekrana | `src/pages/account/refusals.test.ts` |

**Tri fajla vise, ne 208.** Cena je nekoliko sekundi, a hvata tacno onu klasu koju usko merenje ne
moze da vidi.

### Tri pada doslovno, jer klasa bez instance ne pomaze

**1. `styles/scale.test.ts` je pao na JEDINICI I MESTU PREKRETNICE, ne na golom broju u
`padding`.** Doslovno: „`components/Prompt.css` sets the breakpoint at 30 in rem: expected 'rem' to
be 'em'". **Pretpostavka pre merenja je bila da je pad o golom `20px` u `padding|margin|gap`; nije
bila tacna**, i to je zapisano zato sto bi po njoj ispravka bila pisana na pogresnom mestu. Taj pod
trazi **dve** stvari i obe su bile prekrsene:

- **prekretnica se pise u `em`, nikad u `rem`**, i pod to sam obrazlaze: `em` u upitu o sirini se
  meri prema velicini od koje **citalacev pregledac krece**, a `rem` prati koren koji stilski fajl
  sme da pomeri, pa prekretnica u `rem` putuje kad neko promeni koren;
- **postoji zatvoren spisak sirina na kojima portal menja oblik**, svaka sa zapisanim razlogom
  (559.98, 560, 620, 699.98, 700, 780, 819.98, 820, 860, 900, 1000). Moje dve (480 i 1024) nisu bile
  na njemu.

**2. `styles/writtenInCode.test.ts` je pao na spisku imena atributa: 60 naspram 59.** Nedostajalo je
**`aria-modal`**, prvi u portalu. Odluka koju taj pod trazi je jedna: **cuje li ga citalac?**
`aria-modal` nosi rec „true" koju niko ne cuje; ono sto citalac cuje je da je to dijalog, i to mu
pregledac kaze na njegovom jeziku. Dakle masinerija, uz `aria-hidden`, a ne govor uz `alt` i
`placeholder`.

**3. `data/servedAge.test.ts` je pao na tri nova servirana polja** (`accounts.currency`,
`accounts.expected`, `accounts.balance`). Taj snimak se pise **rukom** i to je namerno: nema komande
koja ga regenerise, jer snimak koji nesto drugo prepisuje niko ne cita.

### I ono sto je od svega najvrednije: prekretnice su OBRISANE, ne premestene

Prva pomisao je bila premestiti obe na sirinu sa zatvorenog spiska. **To bi trazilo da pozajmim tudji
razlog:** svaka sirina na tom spisku stoji tamo zbog necega odredjenog („telefon prestaje da bude
telefon", „tabela odustaje od kolona"), a moje pitanje nije bilo nijedno od toga.

**Obe su obrisane, i ispalo je bolje od onoga sto menja.** U dijalogu `flex: 1 1 auto` uz zatecen
`wrap` znaci da dugmad sede u redu kad stanu a lome se kad ne stanu, dakle odluku donosi **duzina
labele**, sto je prava cinjenica; prekretnica bi bila nagadjanje koliko je duga srpska recenica.
**Izmereno posle brisanja: tri reda na 360, dva na 768 i dva na 1280**, dakle isto ponasanje koje je
upit davao. Druga prekretnica je davala `nowrap` labeli kucice; brisanje ne kosta nista jer kolonu
drzi `18ch`, a tabela stoji u `.table-scroll`, pa prelomljena labela nikad nista ne gura sa strane.

**Portal time ne dobija nijednu novu sirinu na kojoj menja oblik.**

**Zatvoren spisak sirina nije prepreka nego je uradio tacno ono zbog cega postoji:** naterao je da se
odgovori na pitanje „zasto bas ovde", i odgovor je bio da prekretnica uopste ne treba.

**Provera koja iz ovoga sledi, jedna recenica:** koju **vrstu** stvari ova grana uvodi prvi put, i
koji pod nad tom vrstom stoji van foldera koji diram?
