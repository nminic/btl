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
ovde ga sprečava `NoDefaultCurrentDirectoryInExePath=1`, koju **Git Bash postavlja**. Isti poziv
iz PowerShell-a na ovoj mašini uspeva (izlazni kod 0, 434 bajta). **CI se ovde ne pominje namerno:**
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

**Klasa nisu dve nego četiri.** Pored `w/crlf` (717) i prikovanih `w/lf` (25), `git ls-files --eol`
prijavljuje i `w/-text` (10) i `w/none` (1), a poreklo im **nije isto** i ne sme se pripisati jednom
uzroku: devet od deset `w/-text` nosi `attr/-text` pravo iz korenskog `.gitattributes`
(`*.png binary` i slično) i to su binarni fajlovi sa NUL bajtovima; `w/none` je
`frontend/public/mock/places.json`, koji **jeste** u tekstualnoj klasi a nema nijedan prelom reda
uopšte (jedan red od 1.277.008 bajtova); i tek jedan jedini, `frontend/src/components/TeamMark.tsx`,
je tamo zato što nosi usamljen `CR`. Za sve njih, kao i za prikovane, **blob je bajt u bajt jednak
disku**, i to je izmereno nad svih 36.

**Postupak, i ima tačno jednu granu, na vrednosti koju git sam izgovara:** polazno stanje se čita
**iz gita** a ne iz radnog stabla (da zatečena mutacija ne postane osnova), a grana se bira po
`git ls-files --eol -- <put>`:

- ako je `w/crlf`, blob se prevede iz LF u CRLF;
- **u svakom drugom slučaju** (`w/lf`, `w/-text`, `w/none`, `w/mixed`) blob se piše **sirovo**.

**`w/` SE OČITA PRE MUTACIJE I ZAPAMTI. Posle mutacije ta kolona više ne opisuje fajl nego
mutaciju.** To je jedini deo ovog odeljka koji se ne sme preskočiti, i pao je baš tu: `w/` kaže šta
je na disku **ovog trenutka**, pa čim se mutacija upiše iz blob bajtova, isti fajl prijavljuje
`w/lf` umesto `w/crlf`. Grana se tada izabere pogrešno, blob se upiše sirovo, i fajl ostane **2200
umesto 2264 bajta** — `git status` kaže ` M`, `git diff` **0 bajtova**, dakle tačno tiho stanje
zbog kog ceo ovaj odeljak i postoji. I ne popravlja se ponavljanjem: posle neuspelog vraćanja `w/`
je i dalje `w/lf`, pa svaki sledeći pokušaj daje isti pogrešan rezultat. Izmereno na
`frontend/src/app/AccountMenu.tsx`; pogađa 717 od 753 fajla. Delimična mutacija koja u `w/crlf`
fajl upiše i jedan `
` daje `w/mixed`, sa istim ishodom.

**Nikad se ne normalizuje „za svaki slučaj".** Merenje: recept koji blob prvo svede na LF pa vrati
u CRLF samo za `w/crlf` **kvari** `w/-text` fajlove, jer im prvi korak uništi usamljene `CR`.
Izmereno na `TeamMark.tsx`: 3690 bajtova pre, **3686** posle, i `git diff` od 1162 bajta. Olakšanje
je što za tu klasu `git diff` **nije** prazan, pa provera niže tu štetu vidi; tihi je samo CRLF
slučaj zbog kog ovaj odeljak i postoji.

**Provera posle serije:** `git status --porcelain` mora da bude **prazan**. Ako prijavi ` M` a
`git diff` je prazan, sadržaj je tačan a prelom reda nije, i `git ls-files --eol` kaže koji je.

### I dalje važi, i nalazi se ovde da se ne traži na dva mesta

- Vraćanje ide u `finally`, da pad skripte ne ostavi mutaciju za sobom.
- Čita se i piše **binarno**; `text=True` na Windowsu dekodira cp1252 i tiho kvari srpska slova.
- **Kad mutacija „padne", gleda se i ZAŠTO.** Poruka o dizanju kontejnera, portu, vezi ili isteku
  nije merenje nego infrastruktura. `Errors:` jednak broju `Tests run:` je skoro uvek
  infrastruktura, a **ista mutacija puštena dvaput mora da da isti broj**.

## Proces

- **Nikad `git add -A` dok recenzija radi u istom radnom direktorijumu.** Recenzent dokazuje nalaz tako što namerno pokvari fajl, pokrene test i vrati ga. Ako se u tom prozoru zapiše sve što je izmenjeno, tuđa privremena mutacija ulazi u commit i CI pada na nečemu što u kodu ne postoji. Desilo se 13.08.2026: član `000004` je za jedan prolaz testa postao platiša i tako gurnut na granu. Zapisuju se **imenovane putanje** onoga što je stvarno menjano, ili recenzija dobija svoj worktree.

- `main` grana prima izmene isključivo kroz PR sa zelenim CI (`.github/workflows/verify.yml`).
- Pre svakog PR-a: pokrenuti oba test paketa lokalno i /code-review prolaz.
- OBAVEZNO pre merge-a netrivijalnog PR-a: nezavisna recenzija kroz subagenta koji NIJE pisao kod. Recenzent dobija isključivo diff i opis PR-a (svež kontekst, bez konteksta autora) i vraća nalaze; kritični i visoki nalazi blokiraju merge dok se ne razreše. Za bezbednosno osetljive izmene (auth, podaci, upload) dodatno i security-reviewer agent.
