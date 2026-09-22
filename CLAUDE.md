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

### I dalje važi, i nalazi se ovde da se ne traži na dva mesta

- Vraćanje ide u `finally`, da pad skripte ne ostavi mutaciju za sobom.
- Čita se i piše **binarno**; `text=True` na Windowsu dekodira cp1252 i tiho kvari srpska slova.
- **Kad mutacija „padne", gleda se i ZAŠTO.** Poruka o dizanju kontejnera, portu, vezi ili isteku
  nije merenje nego infrastruktura. `Errors:` jednak broju `Tests run:` je skoro uvek
  infrastruktura, a **ista mutacija puštena dvaput mora da da isti broj**.

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

## Proces

- **Nikad `git add -A` dok recenzija radi u istom radnom direktorijumu.** Recenzent dokazuje nalaz tako što namerno pokvari fajl, pokrene test i vrati ga. Ako se u tom prozoru zapiše sve što je izmenjeno, tuđa privremena mutacija ulazi u commit i CI pada na nečemu što u kodu ne postoji. Desilo se 13.08.2026: član `000004` je za jedan prolaz testa postao platiša i tako gurnut na granu. Zapisuju se **imenovane putanje** onoga što je stvarno menjano, ili recenzija dobija svoj worktree.

- `main` grana prima izmene isključivo kroz PR sa zelenim CI (`.github/workflows/verify.yml`).
- Pre svakog PR-a: pokrenuti oba test paketa lokalno i /code-review prolaz.
- OBAVEZNO pre merge-a netrivijalnog PR-a: nezavisna recenzija kroz subagenta koji NIJE pisao kod. Recenzent dobija isključivo diff i opis PR-a (svež kontekst, bez konteksta autora) i vraća nalaze; kritični i visoki nalazi blokiraju merge dok se ne razreše. Za bezbednosno osetljive izmene (auth, podaci, upload) dodatno i security-reviewer agent.
