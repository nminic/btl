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

Ko dokazuje nalaz mutacijom, prvo pročita ovo. Obe zamke **izgledaju kao uspešno merenje**, pa se ne
vide dok se ne potraže.

- **`mvnw.cmd` bez `./` se ne pokreće uopšte.** `cmd /c mvnw.cmd ...` ne traži program u radnom
  direktorijumu: vraća nenulti izlazni kod i log od stotinak bajtova, što je **isto** što vidi i
  uhvaćena mutacija. Jednom agentu je tako dalo **22 lažna prolaza**. Hvata se samo tako što se
  **prvo pusti prolaz BEZ mutacije** i traži **izlazni kod nula i red `Tests run:`**. Iz `bash` se
  zove `./mvnw`.
- **Vraćanje mutacije iz `git show HEAD:` prevodi fajl na LF.** Repo je na CRLF
  (`.gitattributes` + `core.autocrlf=true`), a blob je LF, pa vraćanje sirovih bajtova prepiše
  **svaki red**. `git status` i `git diff --numstat` o tome **ćute**, jer git normalizuje pri
  poređenju. Posledica nije kozmetička: **sledeća mutacija iz iste serije više ne nađe svoj obrazac**
  i serija stane na pola, a izgleda kao da je prošla. Vraća se kroz
  `blob.replace(b"
", b"
").replace(b"
", b"
")`.
- **Uz to i dalje važi:** vraćanje ide u `finally`, polazno stanje se čita **iz gita** a ne iz radnog
  stabla, čita se i piše **binarno** (`text=True` na Windowsu dekodira cp1252 i tiho kvari srpska
  slova), i posle serije se gleda `git status` i `git diff --numstat`, ne samo da li je paket zelen.
- **Kad mutacija „padne", gleda se i ZAŠTO pada.** Poruka o dizanju kontejnera, portu, vezi ili
  isteku nije merenje nego infrastruktura. `Errors:` jednak broju `Tests run:` je skoro uvek
  infrastruktura, a **ista mutacija puštena dvaput mora da da isti broj**.

## Proces

- **Nikad `git add -A` dok recenzija radi u istom radnom direktorijumu.** Recenzent dokazuje nalaz tako što namerno pokvari fajl, pokrene test i vrati ga. Ako se u tom prozoru zapiše sve što je izmenjeno, tuđa privremena mutacija ulazi u commit i CI pada na nečemu što u kodu ne postoji. Desilo se 13.08.2026: član `000004` je za jedan prolaz testa postao platiša i tako gurnut na granu. Zapisuju se **imenovane putanje** onoga što je stvarno menjano, ili recenzija dobija svoj worktree.

- `main` grana prima izmene isključivo kroz PR sa zelenim CI (`.github/workflows/verify.yml`).
- Pre svakog PR-a: pokrenuti oba test paketa lokalno i /code-review prolaz.
- OBAVEZNO pre merge-a netrivijalnog PR-a: nezavisna recenzija kroz subagenta koji NIJE pisao kod. Recenzent dobija isključivo diff i opis PR-a (svež kontekst, bez konteksta autora) i vraća nalaze; kritični i visoki nalazi blokiraju merge dok se ne razreše. Za bezbednosno osetljive izmene (auth, podaci, upload) dodatno i security-reviewer agent.
